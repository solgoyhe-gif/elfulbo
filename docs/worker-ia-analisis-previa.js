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
 *    - Trae el "summary" de ESPN del partido (forma reciente, H2H, tabla).
 *    - Le pide a Claude un análisis previo en español rioplatense.
 *    - Devuelve { analisis: "..." }.
 *
 *  Requisitos en el Worker:
 *    1. Guardar la API key de Anthropic como secret:
 *         wrangler secret put ANTHROPIC_API_KEY
 *    2. (Opcional pero recomendado) un KV namespace `IA_CACHE` para cachear
 *       el análisis por partido y no pagar el modelo en cada click.
 *
 *  Modelo: claude-opus-4-8 (el más capaz de Anthropic al momento de escribir esto).
 *  Costo aprox: ~1-2 centavos de USD por análisis sin caché. Con caché, casi nada.
 */

const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';
const ESPN_SUMMARY  = (liga, event) =>
  `https://site.api.espn.com/apis/site/v2/sports/soccer/${liga}/summary?event=${event}`;

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

// ── Handler principal (integralo a tu router del Worker) ─────────────────────
export async function manejarAnalisisPrevia(request, env) {
  if (request.method === 'OPTIONS') return new Response(null, { headers: CORS });
  if (request.method !== 'POST') {
    return json({ error: 'Método no permitido' }, 405);
  }

  let body;
  try { body = await request.json(); } catch { body = {}; }
  const event = String(body.event ?? '').trim();
  const liga  = String(body.liga  ?? 'fifa.world').trim();
  if (!event) return json({ error: 'Falta el parámetro event' }, 400);

  // ── Caché (si hay KV configurado): un análisis por partido dura 6 h ──────
  const cacheKey = `ia_previa_${liga}_${event}`;
  if (env.IA_CACHE) {
    const hit = await env.IA_CACHE.get(cacheKey);
    if (hit) return json({ analisis: hit, cache: true });
  }

  // ── Contexto del partido desde ESPN ─────────────────────────────────────
  let contexto;
  try {
    const r = await fetch(ESPN_SUMMARY(liga, event));
    const sum = r.ok ? await r.json() : {};
    contexto = extraerContexto(sum);
  } catch {
    contexto = null;
  }
  if (!contexto) return json({ error: 'No se pudo obtener el contexto del partido' }, 502);

  // ── Prompt ──────────────────────────────────────────────────────────────
  const prompt = construirPrompt(contexto);

  // ── Llamada a Claude (raw HTTP, sin SDK, para que el Worker no dependa de nada) ──
  let analisis;
  try {
    const res = await fetch(ANTHROPIC_URL, {
      method: 'POST',
      headers: {
        'content-type':      'application/json',
        'x-api-key':         env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-opus-4-8',
        max_tokens: 1200,
        system: 'Sos un analista de fútbol para una app argentina (Whistle). Escribís en español rioplatense, con criterio futbolístico y sin relleno. Nunca inventás datos que no estén en el contexto.',
        messages: [{ role: 'user', content: prompt }],
      }),
    });
    if (!res.ok) {
      const err = await res.text();
      return json({ error: 'Error del modelo', detalle: err.slice(0, 300) }, 502);
    }
    const data = await res.json();
    // La respuesta puede traer varios bloques; nos quedamos con el texto.
    analisis = (data.content ?? [])
      .filter(b => b.type === 'text')
      .map(b => b.text)
      .join('\n')
      .trim();
  } catch (e) {
    return json({ error: 'Fallo al llamar al modelo', detalle: String(e).slice(0, 200) }, 502);
  }

  if (!analisis) return json({ error: 'El modelo no devolvió texto' }, 502);

  if (env.IA_CACHE) {
    await env.IA_CACHE.put(cacheKey, analisis, { expirationTtl: 6 * 60 * 60 });
  }
  return json({ analisis });
}

// ── Extrae un contexto compacto del summary de ESPN ──────────────────────────
function extraerContexto(sum) {
  const comp  = sum?.header?.competitions?.[0];
  const comps = comp?.competitors ?? [];
  if (comps.length !== 2) return null;

  const equipo = (c) => {
    const t = c?.team ?? {};
    const record = (c?.record ?? []).map(r => `${r.type ?? r.name}: ${r.summary ?? r.displayValue}`).join(', ');
    return { nombre: t.displayName ?? t.name ?? '?', abrev: t.abbreviation ?? '', local: c?.homeAway === 'home', record };
  };

  const forma = (arr) => (arr ?? []).slice(0, 5).map(g => {
    const ev = g?.competitions?.[0] ?? g;
    return ev?.notes?.[0]?.headline ?? ev?.shortName ?? '';
  }).filter(Boolean);

  const posiciones = (sum?.standings?.groups ?? sum?.standings?.entries ?? [])
    .slice(0, 20)
    .map(e => {
      const eq = e?.team?.displayName ?? e?.team?.name;
      const st = (e?.stats ?? []).find(s => s.name === 'rank' || s.abbreviation === 'R');
      return eq && st ? `${eq}: ${st.displayValue ?? st.value}` : null;
    })
    .filter(Boolean);

  return {
    local:     equipo(comps.find(c => c.homeAway === 'home') ?? comps[0]),
    visitante: equipo(comps.find(c => c.homeAway === 'away') ?? comps[1]),
    fecha:     comp?.date ?? '',
    liga:      sum?.header?.league?.name ?? sum?.header?.season?.displayName ?? '',
    formaLocal:     forma(sum?.lastFiveGames?.[0]?.events),
    formaVisitante: forma(sum?.lastFiveGames?.[1]?.events),
    h2h:       (sum?.headToHeadGames ?? []).slice(0, 5).map(g => g?.notes?.[0]?.headline ?? g?.shortName).filter(Boolean),
    posiciones,
  };
}

// ── Arma el prompt para Claude ───────────────────────────────────────────────
function construirPrompt(ctx) {
  return [
    `Analizá este partido de fútbol y escribí una previa para los hinchas.`,
    ``,
    `Partido: ${ctx.local.nombre} (local) vs ${ctx.visitante.nombre} (visitante)`,
    ctx.liga ? `Competencia: ${ctx.liga}` : '',
    ctx.local.record     ? `Récord ${ctx.local.nombre}: ${ctx.local.record}` : '',
    ctx.visitante.record ? `Récord ${ctx.visitante.nombre}: ${ctx.visitante.record}` : '',
    ctx.formaLocal.length     ? `Últimos partidos ${ctx.local.nombre}: ${ctx.formaLocal.join(' | ')}` : '',
    ctx.formaVisitante.length ? `Últimos partidos ${ctx.visitante.nombre}: ${ctx.formaVisitante.join(' | ')}` : '',
    ctx.h2h.length ? `Historial reciente entre sí: ${ctx.h2h.join(' | ')}` : '',
    ctx.posiciones.length ? `Posiciones: ${ctx.posiciones.join(' · ')}` : '',
    ``,
    `Escribí 3 o 4 párrafos cortos en español rioplatense: cómo llega cada equipo, la clave táctica del partido, y un pronóstico honesto (podés dar un favorito o decir que está parejo). Si el contexto es pobre, sé más general pero no inventes estadísticas. No uses títulos ni viñetas, solo párrafos.`,
  ].filter(Boolean).join('\n');
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
