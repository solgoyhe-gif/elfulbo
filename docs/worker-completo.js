// ═══════════════════════════════════════════════════════════════════════════
//  WORKER COMPLETO DE WHISTLE — copiar TODO y pegar en el editor de Cloudflare
//  (Ctrl+A para seleccionar todo lo que hay, Ctrl+V para reemplazarlo, Deploy)
//
//  Cambios respecto a la versión anterior:
//    1. /ia/analisis-previa ahora usa GEMINI (gratis) en vez de Anthropic.
//    2. El contexto que se le manda al modelo estaba mal armado y salía casi
//       vacío: leía la forma reciente con `shortName`, campo que ESPN no usa
//       ahí. Ahora usa lastFiveGames[].events[] con gameResult/score/opponent,
//       y suma goleador destacado + probabilidad implícita de las cuotas.
//    3. /version devuelve IA-GEMINI-OK para confirmar que el deploy entró.
//
//  Secret necesario en el Worker:
//    Settings → Variables and Secrets → Add → tipo Secret
//      Nombre: GEMINI_API_KEY     Valor: tu key de aistudio.google.com/apikey
// ═══════════════════════════════════════════════════════════════════════════

// ── Lemon Squeezy Variant IDs ─────────────────────────────────────────────────

const LS_VARIANTS = {
    platea_mensual: 1834599,
    platea_anual:   1834604,
    palco_mensual:  1834609,
    palco_anual:    1834620,
};


const LS_PLAN_MAP = {
    1834599: 'pro',      // Platea mensual
    1834604: 'pro',      // Platea anual
    1834609: 'promax',   // Palco mensual
    1834620: 'promax',   // Palco anual
};

const LS_STORE_ID = '383758';

const FIREBASE_PROJECT = 'fulbo-3b2ba';
const LS_API_BASE      = 'https://api.lemonsqueezy.com/v1';
const ESPN_SITE        = 'https://site.api.espn.com/apis/site/v2/sports/soccer';

const VAPID_PUBLIC_KEY = 'BGniXzF9U_3oUAJmA12ukC2hugwh9lXImLtvljwAu0k1KtGn3vO7FKyx-yTKbP_1xH7Hm4P4rGAJAeTV_WmpGvE';

const SLUGS_MONITOREAR = [
    'fifa.world', 'uefa.champions', 'arg.1', 'eng.1',
    'esp.1', 'ger.1', 'ita.1', 'fra.1',
    'conmebol.libertadores', 'conmebol.sudamericana',
];

const CORS = {
    "Access-Control-Allow-Origin":  "*",
    "Access-Control-Allow-Methods": "GET, HEAD, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

// ── ES Module export ──────────────────────────────────────────────────────────
export default {
    async fetch(request, env, ctx) {
        return handleRequest(request, env);
    },
    async scheduled(event, env, ctx) {
        ctx.waitUntil(pollGolesYEnviarPush(env));
    }
};

// ── Firebase Admin Token ──────────────────────────────────────────────────────
async function getFirebaseAdminToken(env) {
    const email      = env.FIREBASE_CLIENT_EMAIL ?? '';
    const privateKey = (env.FIREBASE_PRIVATE_KEY ?? '').replace(/\\n/g, '\n');
    if (!email || !privateKey) throw new Error('Firebase credentials no configuradas');

    const now = Math.floor(Date.now() / 1000);
    const payload = {
        iss: email, sub: email,
        aud: 'https://oauth2.googleapis.com/token',
        iat: now, exp: now + 3600,
        scope: 'https://www.googleapis.com/auth/datastore https://www.googleapis.com/auth/firebase',
    };

    const pemBody = privateKey
        .replace('-----BEGIN PRIVATE KEY-----', '')
        .replace('-----END PRIVATE KEY-----', '')
        .replace(/\s/g, '');
    const der = Uint8Array.from(atob(pemBody), c => c.charCodeAt(0));
    const key = await crypto.subtle.importKey(
        'pkcs8', der.buffer,
        { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
        false, ['sign']
    );

    const header = btoa(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_');
    const body   = btoa(JSON.stringify(payload)).replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_');
    const input  = new TextEncoder().encode(`${header}.${body}`);
    const sig    = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, input);
    const sigB64 = btoa(String.fromCharCode(...new Uint8Array(sig))).replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_');
    const jwt    = `${header}.${body}.${sigB64}`;

    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: jwt })
    });
    const tokenData = await tokenRes.json();
    if (!tokenData.access_token) throw new Error('No se pudo obtener access token: ' + JSON.stringify(tokenData));
    return tokenData.access_token;
}

// ── Firestore helpers ─────────────────────────────────────────────────────────
async function firestoreGet(path, env) {
    const token = await getFirebaseAdminToken(env);
    const res   = await fetch(`https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT}/databases/(default)/documents/${path}`, {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    return { res, token };
}

async function firestorePatch(path, fields, updateMask, env) {
    const token = await getFirebaseAdminToken(env);
    const url   = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT}/databases/(default)/documents/${path}?updateMask.fieldPaths=${updateMask}`;
    return fetch(url, {
        method: 'PATCH',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ fields })
    });
}

async function firestoreSet(path, fields, env) {
    const token = await getFirebaseAdminToken(env);
    const url   = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT}/databases/(default)/documents/${path}`;
    return fetch(url, {
        method: 'PATCH',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ fields })
    });
}

async function firestoreDelete(path, env) {
    const token = await getFirebaseAdminToken(env);
    const url   = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT}/databases/(default)/documents/${path}`;
    return fetch(url, { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` } });
}

function parseFirestoreDoc(doc) {
    const uid = doc.name?.split('/').pop() ?? '';
    const f   = doc.fields ?? {};
    return {
        uid,
        nombre:   f.nombre?.stringValue  ?? '',
        email:    f.email?.stringValue    ?? '',
        plan:     f.plan?.stringValue     ?? 'free',
        creadoEn: f.creadoEn?.stringValue ?? '',
    };
}

// ── VAPID JWT ─────────────────────────────────────────────────────────────────
async function getVapidJwt(audience, env) {
    const privateKeyB64 = env.VAPID_PRIVATE_KEY ?? '';
    const subject       = env.VAPID_SUBJECT ?? 'mailto:admin@whistle.app';
    if (!privateKeyB64) throw new Error('VAPID_PRIVATE_KEY no configurada');

    const privRaw = Uint8Array.from(atob(privateKeyB64.replace(/-/g,'+').replace(/_/g,'/')), c => c.charCodeAt(0));
    const pubRaw  = Uint8Array.from(atob(VAPID_PUBLIC_KEY.replace(/-/g,'+').replace(/_/g,'/')), c => c.charCodeAt(0));
    const x = pubRaw.slice(1, 33);
    const y = pubRaw.slice(33, 65);

    const jwk = {
        kty: 'EC', crv: 'P-256',
        x: btoa(String.fromCharCode(...x)).replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_'),
        y: btoa(String.fromCharCode(...y)).replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_'),
        d: btoa(String.fromCharCode(...privRaw)).replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_'),
    };

    const key = await crypto.subtle.importKey('jwk', jwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
    const now  = Math.floor(Date.now() / 1000);
    const hdr  = { typ: 'JWT', alg: 'ES256' };
    const pay  = { aud: audience, exp: now + 12 * 3600, sub: subject };
    const b64u = s => btoa(JSON.stringify(s)).replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_');
    const unsigned = `${b64u(hdr)}.${b64u(pay)}`;
    const sig = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, new TextEncoder().encode(unsigned));
    const sigB64 = btoa(String.fromCharCode(...new Uint8Array(sig))).replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_');
    return `${unsigned}.${sigB64}`;
}

// ── Enviar push ───────────────────────────────────────────────────────────────
async function sendPush(subscription, payload, env) {
    const endpoint = subscription.endpoint;
    const audience = new URL(endpoint).origin;
    const vapidJwt = await getVapidJwt(audience, env);
    const body     = typeof payload === 'string' ? payload : JSON.stringify(payload);
    const encoded  = new TextEncoder().encode(body);

    const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
            'Authorization':  `vapid t=${vapidJwt},k=${VAPID_PUBLIC_KEY}`,
            'Content-Type':   'application/octet-stream',
            'Content-Length': encoded.length.toString(),
            'TTL':            '86400',
        },
        body: encoded,
    });
    return res.status;
}

// ── Polling de goles ──────────────────────────────────────────────────────────
async function pollGolesYEnviarPush(env) {
    try {
        const scoreboards = await Promise.allSettled(
            SLUGS_MONITOREAR.map(slug =>
                fetch(`${ESPN_SITE}/${slug}/scoreboard`)
                    .then(r => r.json())
                    .then(d => ({ slug, events: d?.events ?? [] }))
            )
        );

        const partidosVivos = {};
        for (const result of scoreboards) {
            if (result.status !== 'fulfilled') continue;
            for (const ev of result.value.events) {
                const comp = ev.competitions?.[0];
                if (comp?.status?.type?.state !== 'in') continue;
                const home = comp.competitors?.find(c => c.homeAway === 'home');
                const away = comp.competitors?.find(c => c.homeAway === 'away');
                if (!home || !away) continue;
                partidosVivos[ev.id] = {
                    id: ev.id, slug: result.value.slug,
                    homeId: home.team?.id, homeName: home.team?.displayName ?? '',
                    homeScore: parseInt(home.score ?? '0'),
                    awayId: away.team?.id, awayName: away.team?.displayName ?? '',
                    awayScore: parseInt(away.score ?? '0'),
                    clock: comp.status?.displayClock ?? '',
                };
            }
        }

        if (!Object.keys(partidosVivos).length) return;

        const { res: scoresRes } = await firestoreGet('push_scores', env);
        const scoresData = scoresRes.ok ? await scoresRes.json() : {};
        const scoreDocs  = scoresData.documents ?? [];
        const scoresAnteriores = {};
        for (const doc of scoreDocs) {
            const id = doc.name?.split('/').pop();
            const f  = doc.fields ?? {};
            scoresAnteriores[id] = {
                homeScore: parseInt(f.homeScore?.integerValue ?? 0),
                awayScore: parseInt(f.awayScore?.integerValue ?? 0),
            };
        }

        const golesNuevos = [];
        for (const [id, partido] of Object.entries(partidosVivos)) {
            const ant = scoresAnteriores[id];
            if (!ant) continue;
            if (partido.homeScore > ant.homeScore) golesNuevos.push({ partido, scorer: partido.homeName, min: partido.clock });
            if (partido.awayScore > ant.awayScore) golesNuevos.push({ partido, scorer: partido.awayName, min: partido.clock });
        }

        await Promise.allSettled(
            Object.entries(partidosVivos).map(([id, p]) =>
                firestoreSet(`push_scores/${id}`, {
                    homeScore: { integerValue: p.homeScore },
                    awayScore: { integerValue: p.awayScore },
                    homeId:    { stringValue: p.homeId ?? '' },
                    awayId:    { stringValue: p.awayId ?? '' },
                    slug:      { stringValue: p.slug },
                }, env)
            )
        );

        if (!golesNuevos.length) return;

        const { res: subsRes } = await firestoreGet('push_suscripciones', env);
        const subsData = subsRes.ok ? await subsRes.json() : {};
        const subsDocs = subsData.documents ?? [];

        for (const { partido, scorer, min } of golesNuevos) {
            const title = `⚽ GOL! ${partido.homeName} ${partido.homeScore}-${partido.awayScore} ${partido.awayName}`;
            const body  = `${scorer} anotó — Min. ${min}`;
            const url   = `https://whistle.com.ar/#/partido?id=${partido.id}`;
            const tag   = `gol-${partido.id}`;

            const envios = [];
            for (const doc of subsDocs) {
                const f = doc.fields ?? {};
                const sub = {
                    endpoint:       f.endpoint?.stringValue ?? '',
                    equipoFavorito: f.equipoFavorito?.stringValue ?? '',
                    ligas:          (f.ligas?.arrayValue?.values ?? []).map(v => v.stringValue),
                };
                if (!sub.endpoint) continue;

                const esEquipoFav = sub.equipoFavorito &&
                    (sub.equipoFavorito === partido.homeId || sub.equipoFavorito === partido.awayId);
                const sigueLiga = sub.ligas.includes(partido.slug);
                if (!esEquipoFav && !sigueLiga) continue;

                envios.push(
                    sendPush({ endpoint: sub.endpoint, keys: { p256dh: f.p256dh?.stringValue ?? '', auth: f.auth?.stringValue ?? '' } },
                        { title, body, url, tag }, env)
                        .catch(async (err) => {
                            if (err.status === 410 || err.status === 404) {
                                const docId = doc.name?.split('/').pop();
                                await firestoreDelete(`push_suscripciones/${docId}`, env);
                            }
                        })
                );
            }
            await Promise.allSettled(envios);
        }
    } catch(err) {
        console.error('[PUSH POLL]', err.message);
    }
}

// ── Verify LS Signature ───────────────────────────────────────────────────────
async function verifyLSSignature(payload, signature, secret) {
    if (!secret) return true;
    try {
        const key = await crypto.subtle.importKey(
            'raw', new TextEncoder().encode(secret),
            { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
        );
        const computed = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload));
        const hex = Array.from(new Uint8Array(computed)).map(b => b.toString(16).padStart(2,'0')).join('');
        return hex === signature;
    } catch { return false; }
}

function jsonError(msg, status = 400) {
    return new Response(JSON.stringify({ error: msg }), {
        status,
        headers: { ...CORS, 'Content-Type': 'application/json' }
    });
}

// ═══════════════════════════════════════════════════════════════════════════
//  ANÁLISIS IA PRE-PARTIDO (Gemini)
// ═══════════════════════════════════════════════════════════════════════════

// Alias que siempre apunta al Flash vigente. NO usar 'gemini-2.5-flash'
// (deprecado para cuentas nuevas) ni 'gemini-2.0-flash' (sin cuota gratuita).
const IA_MODELO = 'gemini-flash-latest';

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

async function manejarAnalisisPrevia(request, env) {
    const body  = await request.json().catch(() => ({}));
    const event = String(body.event ?? '').trim();
    const liga  = String(body.liga ?? '').trim();
    if (!event) return jsonError('Falta event', 400);
    if (!liga)  return jsonError('Falta liga', 400);

    // Caché opcional: si existe el KV IA_CACHE, el análisis dura 6 h.
    const cacheKey = `ia_previa_${liga}_${event}`;
    if (env.IA_CACHE) {
        const hit = await env.IA_CACHE.get(cacheKey);
        if (hit) {
            return new Response(JSON.stringify({ analisis: hit, cache: true }), {
                headers: { ...CORS, 'Content-Type': 'application/json' }
            });
        }
    }

    if (!env.GEMINI_API_KEY) return jsonError('Falta configurar GEMINI_API_KEY en el Worker', 503);

    let contexto = null;
    try {
        const r = await fetch(`${ESPN_SITE}/${liga}/summary?event=${event}`);
        contexto = r.ok ? iaContexto(await r.json()) : null;
    } catch {}
    if (!contexto) return jsonError('No se pudo obtener el contexto del partido', 502);

    let analisis;
    try {
        const aiRes = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${IA_MODELO}:generateContent`,
            {
                method: 'POST',
                headers: { 'content-type': 'application/json', 'x-goog-api-key': env.GEMINI_API_KEY },
                body: JSON.stringify({
                    systemInstruction: { parts: [{ text: IA_SISTEMA }] },
                    contents: [{ role: 'user', parts: [{ text: contexto }] }],
                    // Generoso a propósito: Gemini gasta tokens internos antes de
                    // escribir, y con un tope bajo corta el texto por la mitad.
                    generationConfig: { maxOutputTokens: 2000, temperature: 0.7 },
                }),
            }
        );
        if (!aiRes.ok) return jsonError('Error del modelo: ' + (await aiRes.text()).slice(0, 200), 502);
        const aiData = await aiRes.json();
        analisis = (aiData?.candidates?.[0]?.content?.parts ?? []).map(p => p.text ?? '').join('').trim();
    } catch (e) {
        return jsonError('Fallo al llamar al modelo', 502);
    }
    if (!analisis) return jsonError('El modelo no devolvió texto', 502);

    if (env.IA_CACHE) {
        await env.IA_CACHE.put(cacheKey, analisis, { expirationTtl: 6 * 60 * 60 });
    }
    return new Response(JSON.stringify({ analisis }), {
        headers: { ...CORS, 'Content-Type': 'application/json' }
    });
}

// Contexto compacto desde el summary de ESPN.
// OJO: la forma reciente vive en lastFiveGames[].events[] con los campos
// gameResult / score / opponent / atVs. NO en shortName (eso devuelve vacío).
function iaContexto(sum) {
    const comps = sum?.header?.competitions?.[0]?.competitors ?? [];
    if (comps.length !== 2) return null;

    const nombre    = (c) => c?.team?.displayName ?? c?.team?.name ?? '?';
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

    const h2h    = (sum?.headToHeadGames ?? [])[0];
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

// ── Request handler ───────────────────────────────────────────────────────────
async function handleRequest(request, env) {
    if (request.method === 'OPTIONS') return new Response(null, { headers: CORS });

    try {
        const url      = new URL(request.url);
        const pathname = url.pathname;

        // ── 0. VERSION (chequeo de deploy) ───────────────────────────────────
        if (pathname === '/version') {
            return new Response('IA-GEMINI-OK', { headers: { ...CORS, 'Content-Type': 'text/plain' } });
        }

        // ── IA: Análisis pre-partido ─────────────────────────────────────────
        if (pathname === '/ia/analisis-previa' && request.method === 'POST') {
            return manejarAnalisisPrevia(request, env);
        }

        // ── 0b. DIAGNÓSTICO: variantes que ve la API key ─────────────────────
        if (pathname === '/ls/variants') {
            const adminKey = url.searchParams.get('adminKey');
            if (adminKey !== env.ADMIN_KEY) return jsonError('No autorizado', 401);
            const r = await fetch(`${LS_API_BASE}/variants?page[size]=100`, {
                headers: { 'Authorization': `Bearer ${env.LS_API_KEY}`, 'Accept': 'application/vnd.api+json' }
            });
            const d = await r.json();
            const lista = (d.data ?? []).map(v => ({
                variant_id: v.id,
                nombre:     v.attributes?.name,
                producto:   v.attributes?.product_id,
                status:     v.attributes?.status,
            }));
            return new Response(JSON.stringify({ status: r.status, total: lista.length, variantes: lista, error: r.ok ? undefined : d }, null, 2), {
                headers: { ...CORS, 'Content-Type': 'application/json' }
            });
        }

        // ── 1. PROXY ESPN ────────────────────────────────────────────────────
        const targetUrl = url.searchParams.get('url');
        if (targetUrl) {
            const response = await fetch(targetUrl);
            const data = await response.text();
            return new Response(data, {
                status: response.status,
                headers: { ...CORS, 'Content-Type': 'application/json' }
            });
        }

        // ── 2. PROXY OPTA ────────────────────────────────────────────────────
        const endpointOpta = url.searchParams.get('endpoint');
        if (endpointOpta) {
            const token   = env.OPTA_TOKEN ?? '';
            const optaUrl = `https://api.performfeeds.com/soccerdata/${endpointOpta}?_fmt=json&_rt=b&tmcl=es-AR`;
            const optaRes = await fetch(optaUrl, {
                headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/json' }
            });
            const data = await optaRes.text();
            return new Response(data, {
                status: optaRes.status,
                headers: { ...CORS, 'Content-Type': 'application/json' }
            });
        }

        // ── 3. LEMON SQUEEZY: Checkout ───────────────────────────────────────
        if (pathname === '/ls/checkout' && request.method === 'POST') {
            const body       = await request.json();
            const variantId  = LS_VARIANTS[body.variantKey];
            console.log('[LS checkout] variantKey:', body.variantKey, '→ variantId:', variantId);
            if (!variantId) return jsonError(`Variant key inválido: ${body.variantKey}`, 400);

            const lsRes = await fetch(`${LS_API_BASE}/checkouts`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${env.LS_API_KEY}`,
                    'Content-Type':  'application/vnd.api+json',
                    'Accept':        'application/vnd.api+json',
                },
                body: JSON.stringify({
                    data: {
                        type: 'checkouts',
                        attributes: {
                            checkout_data: {
                                email:  body.email ?? '',
                                custom: { uid: body.uid ?? '', plan: LS_PLAN_MAP[variantId] },
                            },
                            product_options: {
                                redirect_url: body.successUrl ?? 'https://whistle.com.ar/#/perfil?pago=ok',
                            },
                        },
                        relationships: {
                            store:   { data: { type: 'stores',   id: LS_STORE_ID } },
                            variant: { data: { type: 'variants', id: String(variantId) } }
                        }
                    }
                })
            });

            const lsData = await lsRes.json();
            console.log('[LS checkout response]', lsRes.status, JSON.stringify(lsData).slice(0, 300));
            if (!lsRes.ok) return new Response(JSON.stringify({
                error:          lsData?.errors?.[0]?.detail ?? 'Error Lemon Squeezy',
                lemon:          lsData?.errors ?? lsData,
                variantIdUsado: variantId,
                storeUsado:     LS_STORE_ID,
            }), { status: 400, headers: { ...CORS, 'Content-Type': 'application/json' } });

            const checkoutUrl = lsData?.data?.attributes?.url;
            return new Response(JSON.stringify({ url: checkoutUrl }), {
                headers: { ...CORS, 'Content-Type': 'application/json' }
            });
        }

        // ── 4. LEMON SQUEEZY: Webhook ─────────────────────────────────────────
        if (pathname === '/ls/webhook' && request.method === 'POST') {
            const payload   = await request.text();
            const sigHeader = request.headers.get('x-signature') ?? '';
            const valid     = await verifyLSSignature(payload, sigHeader, env.LS_WEBHOOK_SECRET ?? '');
            if (!valid) return jsonError('Firma inválida', 401);

            const event     = JSON.parse(payload);
            const metaEvt   = event?.meta?.event_name ?? '';
            const custom    = event?.meta?.custom_data ?? {};
            const uid       = custom.uid;
            const variantId = event?.data?.attributes?.variant_id;
            const status    = event?.data?.attributes?.status;

            if (uid && ['subscription_created', 'subscription_updated'].includes(metaEvt)) {
                const plan = LS_PLAN_MAP[variantId] ?? 'pro';
                if (['active', 'on_trial'].includes(status)) {
                    await firestorePatch(`usuarios/${uid}`, { plan: { stringValue: plan } }, 'plan', env);
                }
            }

            if (uid && metaEvt === 'subscription_cancelled') {
                await firestorePatch(`usuarios/${uid}`, { plan: { stringValue: 'free' } }, 'plan', env);
            }

            return new Response(JSON.stringify({ received: true }), {
                headers: { ...CORS, 'Content-Type': 'application/json' }
            });
        }

        // ── 5. LEMON SQUEEZY: Portal ──────────────────────────────────────────
        if (pathname === '/ls/portal' && request.method === 'POST') {
            const body = await request.json();
            const { customerId } = body;
            if (!customerId) return jsonError('Falta customerId', 400);

            const lsRes = await fetch(`${LS_API_BASE}/customers/${customerId}`, {
                headers: { 'Authorization': `Bearer ${env.LS_API_KEY}`, 'Accept': 'application/vnd.api+json' }
            });
            const lsData    = await lsRes.json();
            const portalUrl = lsData?.data?.attributes?.urls?.customer_portal;
            if (!portalUrl) return jsonError('No se pudo obtener el portal', 400);

            return new Response(JSON.stringify({ url: portalUrl }), {
                headers: { ...CORS, 'Content-Type': 'application/json' }
            });
        }

        // ── 6. PUSH: Suscribir ────────────────────────────────────────────────
        if (pathname === '/push/suscribir' && request.method === 'POST') {
            const body = await request.json();
            const { uid, subscription, equipoFavorito, ligas } = body;
            if (!uid || !subscription?.endpoint) return jsonError('Faltan parámetros', 400);

            await firestoreSet(`push_suscripciones/${uid}`, {
                uid:            { stringValue: uid },
                endpoint:       { stringValue: subscription.endpoint },
                p256dh:         { stringValue: subscription.keys?.p256dh ?? '' },
                auth:           { stringValue: subscription.keys?.auth   ?? '' },
                equipoFavorito: { stringValue: equipoFavorito ?? '' },
                ligas:          { arrayValue: { values: (ligas ?? []).map(l => ({ stringValue: l })) } },
                creadoEn:       { stringValue: new Date().toISOString() },
            }, env);

            return new Response(JSON.stringify({ ok: true }), {
                headers: { ...CORS, 'Content-Type': 'application/json' }
            });
        }

        // ── 7. PUSH: Desuscribir ──────────────────────────────────────────────
        if (pathname === '/push/desuscribir' && request.method === 'POST') {
            const body = await request.json();
            const { uid } = body;
            if (!uid) return jsonError('Falta uid', 400);
            await firestoreDelete(`push_suscripciones/${uid}`, env);
            return new Response(JSON.stringify({ ok: true }), {
                headers: { ...CORS, 'Content-Type': 'application/json' }
            });
        }

        // ── 8. PUSH: VAPID key ────────────────────────────────────────────────
        if (pathname === '/push/vapid-key') {
            return new Response(JSON.stringify({ key: VAPID_PUBLIC_KEY }), {
                headers: { ...CORS, 'Content-Type': 'application/json' }
            });
        }

        // ── 9. ADMIN: Stats ───────────────────────────────────────────────────
        if (pathname === '/admin/stats') {
            const adminKey = url.searchParams.get('adminKey');
            if (adminKey !== env.ADMIN_KEY) return jsonError('No autorizado', 401);

            const { res } = await firestoreGet('usuarios', env);
            const fsData  = res.ok ? await res.json() : {};
            const docs    = fsData.documents ?? [];
            const stats   = { total: docs.length, free: 0, pro: 0, promax: 0 };
            docs.forEach(doc => {
                const plan = doc.fields?.plan?.stringValue ?? 'free';
                if (stats[plan] !== undefined) stats[plan]++;
                else stats.free++;
            });

            return new Response(JSON.stringify(stats), {
                headers: { ...CORS, 'Content-Type': 'application/json' }
            });
        }

        // ── 10. ADMIN: Usuarios ───────────────────────────────────────────────
        if (pathname === '/admin/usuarios') {
            const adminKey = url.searchParams.get('adminKey');
            if (adminKey !== env.ADMIN_KEY) return jsonError('No autorizado', 401);

            const { res } = await firestoreGet('usuarios?pageSize=200', env);
            const fsData  = res.ok ? await res.json() : {};
            const docs    = fsData.documents ?? [];

            return new Response(JSON.stringify(docs.map(parseFirestoreDoc)), {
                headers: { ...CORS, 'Content-Type': 'application/json' }
            });
        }

        // ── 11. ADMIN: Cambiar plan ───────────────────────────────────────────
        if (pathname === '/admin/cambiar-plan' && request.method === 'POST') {
            const body     = await request.json();
            if (body.adminKey !== env.ADMIN_KEY) return jsonError('No autorizado', 401);
            const { uid, plan } = body;
            if (!uid || !plan) return jsonError('Faltan parámetros', 400);
            await firestorePatch(`usuarios/${uid}`, { plan: { stringValue: plan } }, 'plan', env);
            return new Response(JSON.stringify({ ok: true }), {
                headers: { ...CORS, 'Content-Type': 'application/json' }
            });
        }

        return jsonError('Parámetro no reconocido', 400);

    } catch(err) {
        console.error('[Worker error]', err.message);
        return jsonError(err.message, 500);
    }
}
