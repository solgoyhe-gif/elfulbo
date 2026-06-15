/**
 * espn.js — El Fulbo
 * Módulo de datos ESPN con endpoints correctos para soccer.
 *
 * FIXES:
 *   - Standings: /apis/site/v2/ devuelve {} vacío para soccer.
 *     El endpoint correcto es /apis/v2/sports/soccer/{slug}/standings
 *   - Scoreboard: /apis/site/v2/ sí funciona para soccer.
 *   - Estructura standings: /apis/v2/ devuelve children[].standings[].entries[]
 *
 * Sin API key, sin registro. Proxy Cloudflare propio + allorigins como fallback.
 */

const ESPN = (() => {

    // ── Config ────────────────────────────────────────────────────────────────
    const CF_WORKER  = 'https://elfulbo.solgoyhe.workers.dev';
    const ESPN_V2    = 'https://site.api.espn.com/apis/v2/sports/soccer';    // standings
    const ESPN_SITE  = 'https://site.api.espn.com/apis/site/v2/sports/soccer'; // scoreboard, teams
    const CACHE_TTL  = 24 * 60 * 60 * 1000; // 24 horas

    const SLUG_MAP = {
        premier:       'eng.1',
        bundesliga:    'ger.1',
        serie_a:       'ita.1',
        ligue1:        'fra.1',
        laliga:        'esp.1',
        eredivisie:    'ned.1',
        primeira:      'por.1',
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
            { url: `${CF_WORKER}?url=${encoded}`,                   parse: r => r.json() },
            { url: `https://api.allorigins.win/get?url=${encoded}`, parse: async r => JSON.parse((await r.json()).contents) },
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

    const getSlug = (ligaId) => SLUG_MAP[ligaId] ?? null;

    /**
     * Tabla de posiciones.
     * USA /apis/v2/ — el único endpoint que devuelve datos reales para soccer.
     * Estructura: data.children[].standings[].entries[]  (varía según la liga)
     */
    const getStandings = async (ligaId) => {
        const slug = getSlug(ligaId);
        if (!slug) throw new Error(`Sin slug para liga: ${ligaId}`);

        const cacheKey = `standings_${slug}`;
        if (_mem[cacheKey]) return _mem[cacheKey];
        const cached = _lsGet(cacheKey);
        if (cached) { _mem[cacheKey] = cached; return cached; }

        // Endpoint correcto para soccer standings
        const url  = `${ESPN_V2}/${slug}/standings`;
        const data = await _fetch(url);

        // /apis/v2/ puede devolver:
        //   data.standings[0].entries[]          (ligas simples)
        //   data.children[0].standings[0].entries[]  (ligas con conferencias/grupos)
        let entries = [];

        if (data?.standings?.[0]?.entries?.length) {
            // Formato directo
            entries = data.standings[0].entries;
        } else if (data?.children?.length) {
            // Formato con divisiones/grupos — juntamos todas las conferencias
            for (const child of data.children) {
                const childEntries = child?.standings?.[0]?.entries ?? [];
                entries = entries.concat(childEntries);
            }
        }

        if (!entries.length) {
            console.warn(`[ESPN] standings vacíos para ${slug}. Raw:`, JSON.stringify(data).substring(0, 300));
        }

        const result = entries.map((entry, idx) => {
            const team = entry.team;
            const stats = {};
            (entry.stats ?? []).forEach(s => {
                // ESPN usa abreviaciones mixtas: GP, W, L, T, GF, GA, PTS, etc.
                stats[s.abbreviation] = s.value;
                // Guardar también por nombre largo por si la abrev cambia
                if (s.name) stats[s.name] = s.value;
            });

            return {
                pos:  entry.note?.rank ?? (idx + 1),
                team: {
                    id:    team.id,
                    name:  team.displayName ?? team.name,
                    logo:  team.logos?.[0]?.href ?? '',
                    color: team.color ? `#${team.color}` : null,
                    abbr:  team.abbreviation ?? '',
                },
                stats: {
                    pj:  stats['GP']  ?? stats['GS']           ?? stats['gamesPlayed']    ?? 0,
                    pg:  stats['W']   ?? stats['wins']          ?? 0,
                    pe:  stats['T']   ?? stats['D']             ?? stats['ties']           ?? 0,
                    pp:  stats['L']   ?? stats['losses']        ?? 0,
                    gf:  stats['GF']  ?? stats['pointsFor']     ?? 0,
                    gc:  stats['GA']  ?? stats['pointsAgainst'] ?? 0,
                    dif: stats['GD']  ?? stats['pointsDiff']    ?? 0,
                    pts: stats['PTS'] ?? stats['Pts']           ?? stats['points']         ?? 0,
                },
            };
        });

        _mem[cacheKey] = result;
        _lsSet(cacheKey, result);
        return result;
    };

    /**
     * Partidos / scoreboard.
     * USA /apis/site/v2/ — sí funciona para scoreboard soccer.
     * TTL corto (5 min) porque cambia en vivo.
     */
    const getScoreboard = async (ligaId) => {
        const slug = getSlug(ligaId);
        if (!slug) throw new Error(`Sin slug para liga: ${ligaId}`);

        const cacheKey = `scoreboard_${slug}`;
        const SHORT_TTL = 5 * 60 * 1000;
        try {
            const raw = localStorage.getItem(`elfulbo_${cacheKey}`);
            if (raw) {
                const { ts, data } = JSON.parse(raw);
                if (Date.now() - ts < SHORT_TTL) return data;
            }
        } catch {}

        const url  = `${ESPN_SITE}/${slug}/scoreboard`;
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
                status: {
                    state:       comp?.status?.type?.state        ?? 'pre',
                    description: comp?.status?.type?.shortDetail  ?? comp?.status?.type?.description ?? '',
                    clock:       comp?.status?.displayClock       ?? '',
                    period:      comp?.status?.period             ?? 0,
                },
                homeTeam: {
                    id:    home?.team?.id,
                    name:  home?.team?.displayName ?? home?.team?.name,
                    abbr:  home?.team?.abbreviation,
                    logo:  home?.team?.logo ?? '',
                    color: home?.team?.color ? `#${home.team.color}` : null,
                    score: home?.score ?? '-',
                },
                awayTeam: {
                    id:    away?.team?.id,
                    name:  away?.team?.displayName ?? away?.team?.name,
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
     * Equipos de una liga.
     */
    const getTeams = async (ligaId) => {
        const slug = getSlug(ligaId);
        if (!slug) throw new Error(`Sin slug para liga: ${ligaId}`);

        const cacheKey = `teams_${slug}`;
        if (_mem[cacheKey]) return _mem[cacheKey];
        const cached = _lsGet(cacheKey);
        if (cached) { _mem[cacheKey] = cached; return cached; }

        const url  = `${ESPN_SITE}/${slug}/teams?limit=100`;
        const data = await _fetch(url);

        const sportsArray = data?.sports?.[0];
        const targetLeague =
            sportsArray?.leagues?.find(l => l.slug === slug) ||
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
     * Limpia toda la caché localStorage (útil para debug tras cambios de endpoint)
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
