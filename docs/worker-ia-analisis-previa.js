/**
 * ─────────────────────────────────────────────────────────────────────────────
 *  Análisis IA pre-partido — endpoint para el Cloudflare Worker de Whistle
 * ─────────────────────────────────────────────────────────────────────────────
 *
 *  Esto NO corre en el repo del sitio (que es estático). Va en el Worker
 *  `whistle.solgoyhe.workers.dev`, junto a los endpoints /ls/checkout, /push/*, etc.
 *
 *  Qué hace:
 *    - Recibe POST /ia/analisis-previa con { event, liga }.
 *    - Trae el "summary" de ESPN del partido (forma reciente, H2H, figuras, cuotas).
 *    - Le pide a Gemini un análisis previo en español rioplatense.
 *    - Devuelve { analisis: "..." }.
 *
 *  Requisitos en el Worker:
 *    1. Guardar la API key de Google AI Studio como secret:
 *         wrangler secret put GEMINI_API_KEY
 *       (o en el dashboard: Settings → Variables and Secrets → tipo Secret)
 *    2. (Opcional pero recomendado) un KV namespace `IA_CACHE` para cachear el
 *       análisis por partido y no quemar cuota en cada click.
 *
 *  Modelo: gemini-flash-latest.
 *    - Es un ALIAS que siempre apunta al Flash vigente. No usar `gemini-2.5-flash`
 *      (deprecado para cuentas nuevas) ni `gemini-2.0-flash` (sin cuota gratuita).
 *    - El tier gratuito de Google AI Studio no requiere tarjeta. OJO: si activás
 *      billing en ese proyecto de Google Cloud, perdés el tier gratuito.
 *
 *  Para volver a Anthropic algún día: cambiar llamarModelo() por una llamada a
 *  api.anthropic.com. El resto del archivo (contexto, prompt, caché) no cambia.
 */

const GEMINI_MODEL = 'gemini-flash-latest';
const GEMINI_URL   = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;
const ESPN_SUMMARY = (liga, event) =>
  `https://site.api.espn.com/apis/site/v2/sports/soccer/${liga}/summary?event=${event}`;

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

const SISTEMA = [
  'Sos el analista de Whistle, una app deportiva argentina. Escribís análisis previos',
  'de partidos de fútbol en español rioplatense (voseo natural, sin exagerar el lunfardo),',
  'para hinchas que saben de fútbol.',
  '',
  'Reglas:',
  '- 3 párrafos cortos, máximo 160 palabras en total.',
  '- Párrafo 1: cómo llegan los dos equipos, usando la forma reciente.',
  '- Párrafo 2: qué dice el historial entre ambos y las figuras de cada lado.',
  '- Párrafo 3: qué esperar del partido. Podés mencionar el favorito según las',
  '  probabilidades, pero NO des consejos de apuestas.',
  '- Usá SOLO los datos del contexto. No inventes lesiones, declaraciones,',
  '  posiciones de tabla ni estadísticas que no estén.',
  '- Si un dato falta, simplemente no lo menciones.',
  '- Nada de títulos, listas ni markdown. Solo texto corrido.',
  '- No empieces con "Análisis" ni "En este partido". Entrá directo.',
].join('\n');

// ── Handler principal (integralo a tu router del Worker) ─────────────────────
export async function manejarAnalisisPrevia(request, env) {
  if (request.method === 'OPTIONS') return new Response(null, { headers: CORS });
  if (request.method !== 'POST')    return json({ error: 'Método no permitido' }, 405);

  let body;
  try { body = await request.json(); } catch { body = {}; }
  const event = String(body.event ?? '').trim();
  const liga  = String(body.liga  ?? '').trim();
  if (!event) return json({ error: 'Falta el parámetro event' }, 400);
  if (!liga)  return json({ error: 'Falta el parámetro liga' }, 400);

  // ── Caché: un análisis por partido dura 6 h ─────────────────────────────
  const cacheKey = `ia_previa_${liga}_${event}`;
  if (env.IA_CACHE) {
    const hit = await env.IA_CACHE.get(cacheKey);
    if (hit) return json({ analisis: hit, cache: true });
  }

  if (!env.GEMINI_API_KEY) {
    return json({ error: 'Falta configurar GEMINI_API_KEY en el Worker' }, 503);
  }

  // ── Contexto del partido desde ESPN ─────────────────────────────────────
  let contexto;
  try {
    const r   = await fetch(ESPN_SUMMARY(liga, event));
    const sum = r.ok ? await r.json() : {};
    contexto  = construirContexto(sum);
  } catch {
    contexto = null;
  }
  if (!contexto) return json({ error: 'No se pudo obtener el contexto del partido' }, 502);

  // ── Llamada al modelo ───────────────────────────────────────────────────
  let analisis;
  try {
    analisis = await llamarModelo(contexto, env.GEMINI_API_KEY);
  } catch (e) {
    return json({ error: 'Fallo al llamar al modelo', detalle: String(e).slice(0, 200) }, 502);
  }
  if (!analisis) return json({ error: 'El modelo no devolvió texto' }, 502);

  if (env.IA_CACHE) {
    await env.IA_CACHE.put(cacheKey, analisis, { expirationTtl: 6 * 60 * 60 });
  }
  return json({ analisis });
}

// ── Llamada a Gemini (raw HTTP, sin SDK: el Worker no depende de nada) ───────
async function llamarModelo(contexto, apiKey) {
  const res = await fetch(GEMINI_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-goog-api-key': apiKey },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: SISTEMA }] },
      contents: [{ role: 'user', parts: [{ text: contexto }] }],
      // maxOutputTokens generoso: Gemini gasta tokens internos antes de escribir,
      // y si el tope es bajo corta el texto a la mitad.
      generationConfig: { maxOutputTokens: 2000, temperature: 0.7 },
    }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);

  const data = await res.json();
  const cand = data?.candidates?.[0];
  return (cand?.content?.parts ?? []).map(p => p.text ?? '').join('').trim();
}

// ── Contexto compacto desde el summary de ESPN ───────────────────────────────
// OJO: la forma reciente vive en sum.lastFiveGames[].events[], con los campos
// gameResult / score / opponent / atVs. NO en notes[].headline (eso da vacío).
function construirContexto(sum) {
  const comp  = sum?.header?.competitions?.[0];
  const comps = comp?.competitors ?? [];
  if (comps.length !== 2) return null;

  const nombreDe = (c) => c?.team?.displayName ?? c?.team?.name ?? '?';
  const local     = comps.find(c => c.homeAway === 'home') ?? comps[0];
  const visitante = comps.find(c => c.homeAway === 'away') ?? comps[1];

  const L = [];
  L.push(`PARTIDO: ${nombreDe(local)} (local) vs ${nombreDe(visitante)} (visitante)`);
  const liga = sum?.header?.league?.name ?? '';
  if (liga) L.push(`COMPETENCIA: ${liga}`);
  L.push('');

  // Forma reciente de cada equipo
  for (const t of sum?.lastFiveGames ?? []) {
    const partidos = (t?.events ?? []).slice(-5);
    if (!partidos.length) continue;
    L.push(`FORMA RECIENTE - ${t?.team?.displayName ?? '?'}:`);
    for (const e of partidos) {
      const donde = e?.atVs === '@' ? 'de visitante vs' : 'de local vs';
      L.push(`  ${(e?.gameDate ?? '').slice(0, 10)}  ${e?.gameResult ?? ''}  ${e?.score ?? ''}  ${donde} ${e?.opponent?.displayName ?? '?'}`);
    }
    L.push('');
  }

  // Historial entre ambos
  const h2h = (sum?.headToHeadGames ?? [])[0];
  const cruces = (h2h?.events ?? []).slice(0, 5);
  if (cruces.length) {
    L.push(`HISTORIAL ENTRE AMBOS (desde la óptica de ${h2h?.team?.displayName ?? '?'}):`);
    for (const e of cruces) {
      L.push(`  ${(e?.gameDate ?? '').slice(0, 10)}  ${e?.gameResult ?? ''}  ${e?.score ?? ''}`);
    }
    L.push('');
  }

  // Goleador destacado de cada equipo
  for (const grupo of sum?.leaders ?? []) {
    const cat = (grupo?.leaders ?? []).find(c => /goal/i.test(c?.name ?? c?.displayName ?? ''));
    const top = cat?.leaders?.[0];
    if (top?.athlete?.displayName) {
      L.push(`FIGURA ${grupo?.team?.displayName ?? '?'}: ${top.athlete.displayName} (${top.displayValue ?? ''})`);
    }
  }

  // Probabilidad implícita a partir de las cuotas (moneyline americano)
  const odds = (sum?.pickcenter ?? [])[0];
  if (odds) {
    const implicita = (ml) => (ml == null ? null : ml > 0 ? 100 / (ml + 100) : -ml / (-ml + 100));
    const pL = implicita(odds?.homeTeamOdds?.moneyLine);
    const pV = implicita(odds?.awayTeamOdds?.moneyLine);
    const pE = implicita(odds?.drawOdds?.moneyLine);
    const suma = (pL ?? 0) + (pV ?? 0) + (pE ?? 0);
    if (suma > 0 && pL != null && pV != null) {
      const pct = (p) => Math.round(((p ?? 0) / suma) * 100);
      L.push('');
      L.push(`PROBABILIDAD IMPLÍCITA (según cuotas): local ${pct(pL)}%, empate ${pct(pE)}%, visitante ${pct(pV)}%`);
    }
  }

  const texto = L.join('\n').trim();
  // Sin forma ni historial el modelo no tiene nada real que decir.
  return texto.includes('FORMA RECIENTE') || texto.includes('HISTORIAL') ? texto : null;
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'content-type': 'application/json', ...CORS },
  });
}

/*
 *  Cómo engancharlo en tu Worker (ejemplo con el patrón `fetch`):
 *
 *    import { manejarAnalisisPrevia } from './worker-ia-analisis-previa.js';
 *
 *    export default {
 *      async fetch(request, env, ctx) {
 *        const url = new URL(request.url);
 *        if (url.pathname === '/ia/analisis-previa') {
 *          return manejarAnalisisPrevia(request, env);
 *        }
 *        // ... resto de tus rutas (/ls/checkout, /push/*, ?url=..., etc.)
 *      }
 *    }
 */
