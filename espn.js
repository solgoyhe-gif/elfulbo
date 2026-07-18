/**
 * espn.js — El Fulbo
 * Módulo de datos ESPN con endpoints correctos para soccer.
 *
 * FIXES aplicados:
 *   - Standings: /apis/v2/ es el endpoint correcto para soccer.
 *   - Scoreboard: /apis/site/v2/ funciona para soccer.
 *   - TTL de standings reducido a 2hs durante torneos en vivo.
 *   - copa_liga agregado al SLUG_MAP.
 */

const ESPN = (() => {

    // ── Config ────────────────────────────────────────────────────────────────
    const CF_WORKER  = 'https://whistle.solgoyhe.workers.dev';
    const ESPN_V2    = 'https://site.api.espn.com/apis/v2/sports/soccer';
    const ESPN_SITE  = 'https://site.api.espn.com/apis/site/v2/sports/soccer';

    // TTL diferenciado: standings cambian después de cada partido
    const TTL_STANDINGS  = 2 * 60 * 60 * 1000;  // 2 horas
    const TTL_SCOREBOARD = 5 * 60 * 1000;        // 5 minutos (datos en vivo)
    const TTL_TEAMS      = 24 * 60 * 60 * 1000;  // 24 horas (no cambian)

    // ── SLUG_MAP: ligaId interno → slug ESPN ──────────────────────────────────
    // REGLA: todo ligaId que aparezca en data.js/LIGAS debe tener entrada acá.
    const SLUG_MAP = {
        // Europa Top 5
        premier:       'eng.1',
        bundesliga:    'ger.1',
        serie_a:       'ita.1',
        ligue1:        'fra.1',
        laliga:        'esp.1',
        // Europa otras
        eredivisie:    'ned.1',
        primeira:      'por.1',
        // Copas nacionales
        fa_cup:        'eng.fa',
        efl_cup:       'eng.league_cup',
        // Internacionales
        champions:     'uefa.champions',
        europa_league: 'uefa.europa',
        conference:    'uefa.europa.conf',
        supercup_uefa: 'uefa.super_cup',
        // Mundiales
        world_cup:     'fifa.world',
        amistosos_wc:  'fifa.friendly',
        // Sudamérica
        libertadores:  'conmebol.libertadores',
        sudamericana:  'conmebol.sudamericana',
        // Argentina
        liga_prof:     'arg.1',
        copa_liga:     'arg.copa_lpf',  // Copa de la Liga Profesional (tiene grupos/tabla)
        copa_argentina:'arg.copa',
        // Sudamérica extra (ocultas)
        copa_america:  'conmebol.copa_america',
        recopa:        'conmebol.recopa',
        // CONCACAF (ocultas)
        concacaf_champions: 'concacaf.champions',
        concacaf_nations:   'concacaf.nations',
        // Europa extra (ocultas)
        eurocopa:      'uefa.euro',
        // Ligas nacionales extra (ocultas)
        brasileirao:   'bra.1',
        mls:           'usa.1',
        liga_arabe:    'uae.league',
    };

    // ── Caché en memoria + localStorage ──────────────────────────────────────
    const _mem = {};

    const _lsGet = (key) => {
        try {
            const raw = localStorage.getItem(`elfulbo_${key}`);
            if (!raw) return null;
            const { ts, data, ttl } = JSON.parse(raw);
            if (Date.now() - ts > ttl) { localStorage.removeItem(`elfulbo_${key}`); return null; }
            return data;
        } catch { return null; }
    };

    const _lsSet = (key, data, ttl) => {
        try { localStorage.setItem(`elfulbo_${key}`, JSON.stringify({ ts: Date.now(), data, ttl })); } catch {}
    };

    // ── Fetch con cascada de proxies ──────────────────────────────────────────
    const _fetch = async (espnUrl) => {
        const encoded = encodeURIComponent(espnUrl);
        const proxies = [
            { url: `${CF_WORKER}?url=${encoded}`,                    parse: r => r.json() },
            { url: `https://api.allorigins.win/get?url=${encoded}`,  parse: async r => JSON.parse((await r.json()).contents) },
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
     * Devuelve el slug ESPN para un ligaId interno.
     * Retorna null si la liga no tiene slug (ej: copa_liga).
     */
    const getSlug = (ligaId) => SLUG_MAP[ligaId] ?? null;

    /**
     * Tabla de posiciones.
     * Endpoint: /apis/v2/sports/soccer/{slug}/standings
     */
    const getStandings = async (ligaId) => {
        const slug = getSlug(ligaId);
        if (!slug) {
            console.warn(`[ESPN] Sin slug para liga: ${ligaId} — standings no disponibles`);
            return [];
        }

        const cacheKey = `standings_${slug}`;
        if (_mem[cacheKey]) return _mem[cacheKey];
        const cached = _lsGet(cacheKey);
        if (cached) { _mem[cacheKey] = cached; return cached; }

        const url  = `${ESPN_V2}/${slug}/standings`;
        const data = await _fetch(url);

        // ESPN devuelve las entries en formas distintas según el torneo:
        //   liga simple  → data.standings.entries  (o data.standings[0].entries)
        //   con zonas    → data.children[].standings.entries  (objeto, NO array)
        const _entries = (s) => s?.entries ?? s?.[0]?.entries ?? [];
        let entries = [];
        if (_entries(data?.standings).length) {
            entries = _entries(data.standings);
        } else if (data?.children?.length) {
            for (const child of data.children) {
                entries = entries.concat(_entries(child?.standings));
            }
        }

        if (!entries.length) {
            console.warn(`[ESPN] standings vacíos para ${slug}. Raw:`, JSON.stringify(data).substring(0, 300));
        }

        const result = entries.map((entry, idx) => {
            const team  = entry.team;
            const stats = {};
            (entry.stats ?? []).forEach(s => {
                stats[s.abbreviation] = s.value;
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
        _lsSet(cacheKey, result, TTL_STANDINGS);
        return result;
    };

    // Convierte un evento crudo de ESPN al shape que consume la app.
    const _mapEvento = (ev, slug) => {
        const comp = ev.competitions?.[0];
        const home = comp?.competitors?.find(c => c.homeAway === 'home');
        const away = comp?.competitors?.find(c => c.homeAway === 'away');
        return {
            id:       ev.id,
            slug:     slug,
            date:     ev.date,
            // Ronda/fase del torneo (útil en copas): ESPN la manda en notes/headline.
            ronda:    comp?.notes?.[0]?.headline ?? ev.season?.slug ?? '',
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
    };

    /**
     * Partidos / scoreboard.
     * Endpoint: /apis/site/v2/sports/soccer/{slug}/scoreboard
     * TTL corto (5 min) para datos en vivo.
     */
    const getScoreboard = async (ligaId) => {
        const slug = getSlug(ligaId);
        if (!slug) {
            console.warn(`[ESPN] Sin slug para liga: ${ligaId} — scoreboard no disponible`);
            return [];
        }

        const cacheKey = `scoreboard_${slug}`;
        const cached = _lsGet(cacheKey);
        if (cached) return cached;

        const url  = `${ESPN_SITE}/${slug}/scoreboard`;
        const data = await _fetch(url);
        const events = data?.events ?? [];

        const result = events.map(ev => _mapEvento(ev, slug));

        _lsSet(cacheKey, result, TTL_SCOREBOARD);
        return result;
    };

    /**
     * Fixture COMPLETO del torneo (todo el año calendario).
     * Pensado para copas de eliminación directa, que no tienen tabla:
     * en vez de una tabla mostramos el calendario entero de partidos.
     * Endpoint: scoreboard con rango de fechas de todo el año.
     */
    const getCalendario = async (ligaId) => {
        const slug = getSlug(ligaId);
        if (!slug) return [];

        const year = new Date().getFullYear();
        const cacheKey = `calendario_${slug}_${year}`;
        if (_mem[cacheKey]) return _mem[cacheKey];
        const cached = _lsGet(cacheKey);
        if (cached) { _mem[cacheKey] = cached; return cached; }

        const url  = `${ESPN_SITE}/${slug}/scoreboard?dates=${year}0101-${year}1231`;
        const data = await _fetch(url);
        const events = data?.events ?? [];

        const result = events
            .map(ev => _mapEvento(ev, slug))
            .sort((a, b) => new Date(a.date) - new Date(b.date));

        // TTL medio: el fixture cambia poco, pero los marcadores del día sí.
        _mem[cacheKey] = result;
        _lsSet(cacheKey, result, 30 * 60 * 1000);
        return result;
    };

    /**
     * Equipos de una liga.
     */
    const getTeams = async (ligaId) => {
        const slug = getSlug(ligaId);
        if (!slug) return [];

        const cacheKey = `teams_${slug}`;
        if (_mem[cacheKey]) return _mem[cacheKey];
        const cached = _lsGet(cacheKey);
        if (cached) { _mem[cacheKey] = cached; return cached; }

        const url  = `${ESPN_SITE}/${slug}/teams?limit=100`;
        const data = await _fetch(url);

        const sportsArray  = data?.sports?.[0];
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
        _lsSet(cacheKey, result, TTL_TEAMS);
        return result;
    };

    /**
     * Limpia toda la caché (útil para forzar datos frescos desde consola).
     * Uso: ESPN.clearCache()
     */
    const clearCache = () => {
        Object.keys(localStorage)
            .filter(k => k.startsWith('elfulbo_'))
            .forEach(k => localStorage.removeItem(k));
        Object.keys(_mem).forEach(k => delete _mem[k]);
        console.log('[ESPN] Caché limpiado ✅');
    };

    return { getSlug, getStandings, getScoreboard, getCalendario, getTeams, clearCache };
})();
