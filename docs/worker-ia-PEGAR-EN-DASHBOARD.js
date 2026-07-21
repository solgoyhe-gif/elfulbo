/* ═══════════════════════════════════════════════════════════════════════════
 *  ANÁLISIS IA PRE-PARTIDO — versión para PEGAR en el editor de Cloudflare
 * ═══════════════════════════════════════════════════════════════════════════
 *
 *  Usá ESTE archivo si tu Worker es un solo archivo editado en el dashboard.
 *  (El otro, worker-ia-analisis-previa.js, usa `export` y sirve solo si tenés
 *  el Worker dividido en módulos con wrangler.)
 *
 *  ─── PASOS ──────────────────────────────────────────────────────────────
 *
 *  1) SECRET
 *     Settings → Variables and Secrets → Add
 *       Tipo:   Secret        (NO "Text")
 *       Nombre: GEMINI_API_KEY
 *       Valor:  tu key de aistudio.google.com/apikey
 *
 *  2) BORRAR LO VIEJO
 *     En Edit code, buscá con Ctrl+F:   IA no configurada
 *     Eso te lleva a la función vieja del análisis. Borrala entera
 *     (desde su `async function ...` hasta su llave de cierre).
 *
 *  3) PEGAR ESTO
 *     Copiá TODO este archivo (desde la línea de abajo hasta el final)
 *     y pegalo al final de tu Worker, después del `export default { ... }`.
 *
 *  4) ENGANCHAR LA RUTA
 *     Dentro de tu `async fetch(request, env, ctx)`, junto a las otras rutas:
 *
 *         if (url.pathname === '/ia/analisis-previa') {
 *           return manejarAnalisisPrevia(request, env);
 *         }
 *
 *     Si ya había un `if` para esa ruta apuntando a la función vieja,
 *     cambiale el nombre de la función por manejarAnalisisPrevia.
 *
 *  5) DEPLOY
 *     Botón azul Deploy. Verificá que cambie el hash de versión.
 *     Guardar NO alcanza.
 *
 *  ─── CÓMO SABER SI QUEDÓ BIEN ───────────────────────────────────────────
 *  Probá el endpoint. Según lo que devuelva:
 *    "IA no configurada"                        → seguís con el código viejo
 *    "Falta configurar GEMINI_API_KEY..."       → código nuevo OK, falta el secret
 *    un párrafo de análisis                     → listo ✅
 * ═══════════════════════════════════════════════════════════════════════════ */


// ─── Análisis IA pre-partido (Gemini) ────────────────────────────────────────

const IA_MODELO = 'gemini-flash-latest';   // alias al Flash vigente. NO usar
                                           // gemini-2.5-flash (deprecado para
                                           // cuentas nuevas) ni gemini-2.0-flash
                                           // (sin cuota gratuita).

const IA_SISTEMA = [
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

const IA_CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

async function manejarAnalisisPrevia(request, env) {
  if (request.method === 'OPTIONS') return new Response(null, { headers: IA_CORS });
  if (request.method !== 'POST')    return iaJson({ error: 'Método no permitido' }, 405);

  let body;
  try { body = await request.json(); } catch { body = {}; }
  const event = String(body.event ?? '').trim();
  const liga  = String(body.liga  ?? '').trim();
  if (!event) return iaJson({ error: 'Falta el parámetro event' }, 400);
  if (!liga)  return iaJson({ error: 'Falta el parámetro liga' }, 400);

  // Caché opcional: si existe el KV IA_CACHE, un análisis dura 6 h.
  const cacheKey = `ia_previa_${liga}_${event}`;
  if (env.IA_CACHE) {
    const hit = await env.IA_CACHE.get(cacheKey);
    if (hit) return iaJson({ analisis: hit, cache: true });
  }

  if (!env.GEMINI_API_KEY) {
    return iaJson({ error: 'Falta configurar GEMINI_API_KEY en el Worker' }, 503);
  }

  let contexto;
  try {
    const r = await fetch(`https://site.api.espn.com/apis/site/v2/sports/soccer/${liga}/summary?event=${event}`);
    contexto = r.ok ? iaContexto(await r.json()) : null;
  } catch {
    contexto = null;
  }
  if (!contexto) return iaJson({ error: 'No se pudo obtener el contexto del partido' }, 502);

  let analisis;
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${IA_MODELO}:generateContent`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-goog-api-key': env.GEMINI_API_KEY },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: IA_SISTEMA }] },
          contents: [{ role: 'user', parts: [{ text: contexto }] }],
          // Generoso a propósito: Gemini gasta tokens internos antes de escribir
          // y con un tope bajo corta el texto por la mitad.
          generationConfig: { maxOutputTokens: 2000, temperature: 0.7 },
        }),
      }
    );
    if (!res.ok) {
      return iaJson({ error: 'Error del modelo', detalle: (await res.text()).slice(0, 300) }, 502);
    }
    const data = await res.json();
    analisis = (data?.candidates?.[0]?.content?.parts ?? []).map(p => p.text ?? '').join('').trim();
  } catch (e) {
    return iaJson({ error: 'Fallo al llamar al modelo', detalle: String(e).slice(0, 200) }, 502);
  }
  if (!analisis) return iaJson({ error: 'El modelo no devolvió texto' }, 502);

  if (env.IA_CACHE) {
    await env.IA_CACHE.put(cacheKey, analisis, { expirationTtl: 6 * 60 * 60 });
  }
  return iaJson({ analisis });
}

// Contexto compacto desde el summary de ESPN.
// OJO: la forma reciente vive en lastFiveGames[].events[] con gameResult /
// score / opponent / atVs. NO en notes[].headline (eso devuelve vacío).
function iaContexto(sum) {
  const comps = sum?.header?.competitions?.[0]?.competitors ?? [];
  if (comps.length !== 2) return null;

  const nombre = (c) => c?.team?.displayName ?? c?.team?.name ?? '?';
  const local     = comps.find(c => c.homeAway === 'home') ?? comps[0];
  const visitante = comps.find(c => c.homeAway === 'away') ?? comps[1];

  const L = [`PARTIDO: ${nombre(local)} (local) vs ${nombre(visitante)} (visitante)`];
  const liga = sum?.header?.league?.name ?? '';
  if (liga) L.push(`COMPETENCIA: ${liga}`);
  L.push('');

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

  const h2h = (sum?.headToHeadGames ?? [])[0];
  const cruces = (h2h?.events ?? []).slice(0, 5);
  if (cruces.length) {
    L.push(`HISTORIAL ENTRE AMBOS (desde la óptica de ${h2h?.team?.displayName ?? '?'}):`);
    for (const e of cruces) {
      L.push(`  ${(e?.gameDate ?? '').slice(0, 10)}  ${e?.gameResult ?? ''}  ${e?.score ?? ''}`);
    }
    L.push('');
  }

  for (const grupo of sum?.leaders ?? []) {
    const cat = (grupo?.leaders ?? []).find(c => /goal/i.test(c?.name ?? c?.displayName ?? ''));
    const top = cat?.leaders?.[0];
    if (top?.athlete?.displayName) {
      L.push(`FIGURA ${grupo?.team?.displayName ?? '?'}: ${top.athlete.displayName} (${top.displayValue ?? ''})`);
    }
  }

  const odds = (sum?.pickcenter ?? [])[0];
  if (odds) {
    const imp = (ml) => (ml == null ? null : ml > 0 ? 100 / (ml + 100) : -ml / (-ml + 100));
    const pL = imp(odds?.homeTeamOdds?.moneyLine);
    const pV = imp(odds?.awayTeamOdds?.moneyLine);
    const pE = imp(odds?.drawOdds?.moneyLine);
    const suma = (pL ?? 0) + (pV ?? 0) + (pE ?? 0);
    if (suma > 0 && pL != null && pV != null) {
      const pct = (p) => Math.round(((p ?? 0) / suma) * 100);
      L.push('');
      L.push(`PROBABILIDAD IMPLÍCITA (según cuotas): local ${pct(pL)}%, empate ${pct(pE)}%, visitante ${pct(pV)}%`);
    }
  }

  const texto = L.join('\n').trim();
  return (texto.includes('FORMA RECIENTE') || texto.includes('HISTORIAL')) ? texto : null;
}

function iaJson(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'content-type': 'application/json', ...IA_CORS },
  });
}
