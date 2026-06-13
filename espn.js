/**
 * espn.js — El Fulbo
 * Módulo de datos ESPN — se enchufan en la arquitectura existente sin tocar el router.
 *
 * Cómo funciona:
 *   1. Cloudflare Worker propio como proxy (sin CORS, sin límites de key)
 *   2. allorigins como fallback
 *   3. Caché en memoria + localStorage con TTL de 24hs
 *
 * API usada: ESPN pública — sin API key, sin registro
 */

const ESPN = (() => {

    // ── Config ────────────────────────────────────────────────────────────────
    const CF_WORKER  = 'https://elfulbo.solgoyhe.workers.dev';
    const ESPN_BASE  = 'https://site.api.espn.com/apis/site/v2/sports/soccer';
    const CACHE_TTL  = 24 * 60 * 60 * 1000; // 24 horas en ms

    // Mapeo de los IDs de data.js → slugs reales de ESPN
    const SLUG_MAP = {
        premier:       'eng.1',
        bundesliga:    'ger.1',
        serie_a:       'ita.1',
        ligue1:        'fra.1',
        laliga:        'esp.1',
        eredivisie:    'ned.1',
        primera:       'por.1',
        efl_cup:       'eng.league_cup',
        fa_cup:        'eng.fa',
        champions:     'uefa.champions',
        europa_league: 'uefa.europa',
        conference:    'uefa.europa.conf',
        supercup_uefa: 'uefa.super_cup',
        world_cup:     'fifa.world',
        amistosos_wc:  'fifa.friendly',
        libertadores:  'conmebol.libertadores',
        sudamericana:  'conmebol.sudamericana',
        liga_prof:     'arg.1',
        copa_arg:      'arg.copa',
        brasileirao:   'bra.1',
    };

    // ── Caché ─────────────────────────────────────────────────────────────────
    const _mem = {};

    const _lsGet = (key) => {
        try {
            const raw = localStorage.getItem(`elfulbo_${key}`);
            if (!raw) return null;
            const { ts, data } = JSON.parse(raw);
            if (Date.now() - ts > CACHE_TTL) { localStorage.removeItem(`elfulbo_${key}`); return null; }
            return data;
        } catch { return null; }
    };

    const _lsSet = (key, data) => {
        try { localStorage.setItem(`elfulbo_${key}`, JSON.stringify({ ts: Date.now(), data })); } catch {}
    };

    // ── Fetch con cascada de proxies ──────────────────────────────────────────
    const _fetch = async (espnUrl) => {
        const encoded = encodeURIComponent(espnUrl);
        const proxies = [
            { url: `${CF_WORKER}?url=${encoded}`,                       parse: r => r.json() },
            { url: `https://api.allorigins.win/get?url=${encoded}`,     parse: async r => JSON.parse((await r.json()).contents) },
        ];

        for (const proxy of proxies) {
            try {
                const res = await fetch(proxy.url, { signal: AbortSignal.timeout(8000) });
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                return await proxy.parse(res);
            } catch (err) {
                console.warn(`[ESPN] proxy falló (${new URL(proxy.url).hostname}): ${err.message}`);
            }
        }
        throw new Error('Todos los proxies fallaron');
    };

    // ── API pública ───────────────────────────────────────────────────────────

    /**
     * Obtiene el slug ESPN a partir del id de data.js
     */
    const getSlug = (ligaId) => SLUG_MAP[ligaId] ?? null;

    /**
     * Tabla de posiciones de una liga
     * Devuelve array de { pos, team: {id, name, logo, color}, stats: {pj,pg,pe,pp,gf,gc,pts} }
     */
    const getStandings = async (ligaId) => {
        const slug = getSlug(ligaId);
        if (!slug) throw new Error(`Sin slug para liga: ${ligaId}`);

        const cacheKey = `standings_${slug}`;
        if (_mem[cacheKey]) return _mem[cacheKey];
        const cached = _lsGet(cacheKey);
        if (cached) { _mem[cacheKey] = cached; return cached; }

        const url  = `${ESPN_BASE}/${slug}/standings`;
        const data = await _fetch(url);

        // ESPN devuelve standings en data.standings[0].entries
        const entries = data?.standings?.[0]?.entries ?? [];

        const result = entries.map((entry, idx) => {
            const team = entry.team;
            const stats = {};
            (entry.stats ?? []).forEach(s => { stats[s.abbreviation] = s.value; });
            return {
                pos:  idx + 1,
                team: {
                    id:    team.id,
                    name:  team.displayName,
                    logo:  team.logos?.[0]?.href ?? '',
                    color: team.color ? `#${team.color}` : null,
                    abbr:  team.abbreviation ?? team.displayName.substring(0, 3).toUpperCase(),
                },
                stats: {
                    pj:  stats['GP']  ?? stats['GS'] ?? 0,
                    pg:  stats['W']   ?? 0,
                    pe:  stats['T']   ?? stats['D']  ?? 0,
                    pp:  stats['L']   ?? 0,
                    gf:  stats['GF']  ?? 0,
                    gc:  stats['GA']  ?? 0,
                    pts: stats['PTS'] ?? stats['Pts'] ?? 0,
                },
            };
        });

        _mem[cacheKey] = result;
        _lsSet(cacheKey, result);
        return result;
    };

    /**
     * Partidos de hoy / scoreboard
     * Devuelve array de { id, homeTeam, awayTeam, score, status, date }
     */
    const getScoreboard = async (ligaId) => {
        const slug = getSlug(ligaId);
        if (!slug) throw new Error(`Sin slug para liga: ${ligaId}`);

        const cacheKey = `scoreboard_${slug}`;
        // Scoreboard: TTL corto (5 min) porque cambia en vivo
        const SHORT_TTL = 5 * 60 * 1000;
        try {
            const raw = localStorage.getItem(`elfulbo_${cacheKey}`);
            if (raw) { const { ts, data } = JSON.parse(raw); if (Date.now() - ts < SHORT_TTL) return data; }
        } catch {}

        const url  = `${ESPN_BASE}/${slug}/scoreboard`;
        const data = await _fetch(url);
        const events = data?.events ?? [];

        const result = events.map(ev => {
            const comp = ev.competitions?.[0];
            const home = comp?.competitors?.find(c => c.homeAway === 'home');
            const away = comp?.competitors?.find(c => c.homeAway === 'away');
            return {
                id:       ev.id,
                slug:     slug,
                date:     ev.date,
                status:   {
                    state:       comp?.status?.type?.state ?? 'pre',        // 'pre' | 'in' | 'post'
                    description: comp?.status?.type?.shortDetail ?? '',
                    clock:       comp?.status?.displayClock ?? '',
                    period:      comp?.status?.period ?? 0,
                },
                homeTeam: {
                    id:    home?.team?.id,
                    name:  home?.team?.displayName,
                    abbr:  home?.team?.abbreviation,
                    logo:  home?.team?.logo ?? '',
                    color: home?.team?.color ? `#${home.team.color}` : null,
                    score: home?.score ?? '-',
                },
                awayTeam: {
                    id:    away?.team?.id,
                    name:  away?.team?.displayName,
                    abbr:  away?.team?.abbreviation,
                    logo:  away?.team?.logo ?? '',
                    color: away?.team?.color ? `#${away.team.color}` : null,
                    score: away?.score ?? '-',
                },
            };
        });

        try { localStorage.setItem(`elfulbo_${cacheKey}`, JSON.stringify({ ts: Date.now(), data: result })); } catch {}
        return result;
    };

    /**
     * Equipos de una liga (para la vista de equipos)
     * Devuelve array de { id, name, logo, color, venue }
     */
    const getTeams = async (ligaId) => {
        const slug = getSlug(ligaId);
        if (!slug) throw new Error(`Sin slug para liga: ${ligaId}`);

        const cacheKey = `teams_${slug}`;
        if (_mem[cacheKey]) return _mem[cacheKey];
        const cached = _lsGet(cacheKey);
        if (cached) { _mem[cacheKey] = cached; return cached; }

        const url  = `${ESPN_BASE}/${slug}/teams?limit=100`;
        const data = await _fetch(url);

        const sportsArray = data?.sports?.[0];
        const targetLeague =
            sportsArray?.leagues?.find(l => l.slug === slug) ||
            sportsArray?.leagues?.find(l => l.abbreviation?.toLowerCase() === slug.toLowerCase()) ||
            sportsArray?.leagues?.[0];

        const result = (targetLeague?.teams ?? []).map(t => ({
            id:    t.team.id,
            name:  t.team.displayName,
            abbr:  t.team.abbreviation,
            logo:  t.team.logos?.[0]?.href ?? '',
            color: t.team.color ? `#${t.team.color}` : null,
            venue: t.team.venue?.fullName ?? '—',
        }));

        _mem[cacheKey] = result;
        _lsSet(cacheKey, result);
        return result;
    };

    /**
     * Limpia toda la caché localStorage (útil para debug)
     */
    const clearCache = () => {
        Object.keys(localStorage)
            .filter(k => k.startsWith('elfulbo_'))
            .forEach(k => localStorage.removeItem(k));
        Object.keys(_mem).forEach(k => delete _mem[k]);
        console.log('[ESPN] Caché limpiado');
    };

    return { getSlug, getStandings, getScoreboard, getTeams, clearCache };
})();
