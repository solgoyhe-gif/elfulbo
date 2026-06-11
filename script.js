/**
 * script.js — El Fulbo
 * Arquitectura: Estado centralizado · Renderizado modular · Caché con TTL
 */

// ── Constantes ─────────────────────────────────────────────────────────────
const ESPN    = 'https://site.api.espn.com/apis/site/v2/sports/soccer';
const CF_WORKER = 'https://elfulbo.solgoyhe.workers.dev';
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24hs en ms

const LEAGUES = {
    PREMIER_LEAGUE:    { slug: 'eng.1',               name: 'Premier League',       country: 'England',     flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', region: 'europe' },
    BUNDESLIGA:        { slug: 'ger.1',               name: 'Bundesliga',           country: 'Germany',     flag: '🇩🇪', region: 'europe' },
    SERIE_A:           { slug: 'ita.1',               name: 'Serie A',              country: 'Italy',       flag: '🇮🇹', region: 'europe' },
    LIGUE_1:           { slug: 'fra.1',               name: 'Ligue 1',              country: 'France',      flag: '🇫🇷', region: 'europe' },
    LA_LIGA:           { slug: 'esp.1',               name: 'La Liga',              country: 'Spain',       flag: '🇪🇸', region: 'europe' },
    EREDIVISIE:        { slug: 'ned.1',               name: 'Eredivisie',           country: 'Netherlands', flag: '🇳🇱', region: 'europe' },
    PRIMEIRA_LIGA:     { slug: 'por.1',               name: 'Primeira Liga',        country: 'Portugal',    flag: '🇵🇹', region: 'europe' },
    FA_CUP:            { slug: 'eng.fa',              name: 'FA Cup',               country: 'England',     flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', region: 'cup' },
    CARABAO_CUP:       { slug: 'eng.league_cup',      name: 'Carabao Cup',          country: 'England',     flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', region: 'cup' },
    CHAMPIONS_LEAGUE:  { slug: 'uefa.champions',      name: 'Champions League',     country: 'Europe',      flag: '🇪🇺', region: 'europe' },
    EUROPA_LEAGUE:     { slug: 'uefa.europa',         name: 'Europa League',        country: 'Europe',      flag: '🇪🇺', region: 'europe' },
    CONFERENCE_LEAGUE: { slug: 'uefa.europa.conf',    name: 'Conference League',    country: 'Europe',      flag: '🇪🇺', region: 'europe' },
    UEFA_SUPER_CUP:    { slug: 'uefa.super_cup',      name: 'UEFA Super Cup',       country: 'Europe',      flag: '🇪🇺', region: 'cup' },
    WORLD_CUP:         { slug: 'fifa.world',          name: 'FIFA World Cup',       country: 'World',       flag: '🌍', region: 'world' },
    FRIENDLIES_INTL:   { slug: 'fifa.friendly',       name: 'Amistosos Pre-Mundial', country: 'World',      flag: '🌍', region: 'world' },
    COPA_LIBERTADORES: { slug: 'conmebol.libertadores', name: 'Copa Libertadores',  country: 'CONMEBOL',    flag: '🌎', region: 'conmebol' },
    COPA_SUDAMERICANA: { slug: 'conmebol.sudamericana', name: 'Copa Sudamericana',  country: 'CONMEBOL',    flag: '🌎', region: 'conmebol' },
    LIGA_PROFESIONAL:  { slug: 'arg.1',               name: 'Liga Profesional',     country: 'Argentina',   flag: '🇦🇷', region: 'arg' },
    COPA_ARGENTINA:    { slug: 'arg.copa',            name: 'Copa Argentina',       country: 'Argentina',   flag: '🇦🇷', region: 'arg' },
    BRASILEIRAO:       { slug: 'bra.1',               name: 'Brasileirao',          country: 'Brazil',      flag: '🇧🇷', region: 'bra' },
};

const REGION_COLORS = {
    europe:   '#3b82f6',
    world:    '#8b5cf6',
    conmebol: '#10b981',
    arg:      '#60a5fa',
    bra:      '#34d399',
    cup:      '#f59e0b',
};

const REGION_LABELS = {
    europe:   'Europa',
    world:    'Mundo',
    conmebol: 'CONMEBOL',
    arg:      'Argentina',
    bra:      'Brasil',
    cup:      'Copas',
};

// ── Estado de la app ────────────────────────────────────────────────────────
const teamsCache = {};

const appData = {
    user: { subscriptionLevel: 10 },
    leagues: Object.values(LEAGUES),
    match: {
        teams: {
            local:   { name: 'Arsenal',   abbr: 'ARS', formation: '4-3-3' },
            visitor: { name: 'Barcelona', abbr: 'FCB', formation: '4-3-3' },
        },
        score: { local: 2, visitor: 1 },
        status: "62'",
        stats: [
            { label: 'xG',                local: 2.1,  visitor: 0.9,  type: 'decimal' },
            { label: 'Posesión',          local: 42,   visitor: 58,   type: 'percent' },
            { label: 'Pases',             local: 342,  visitor: 512,  type: 'number'  },
            { label: 'Precisión pases',   local: 81,   visitor: 89,   type: 'percent' },
            { label: 'Tiros totales',     local: 14,   visitor: 8,    type: 'number'  },
            { label: 'Tiros al arco',     local: 6,    visitor: 3,    type: 'number'  },
            { label: 'Faltas',            local: 12,   visitor: 9,    type: 'number'  },
            { label: 'Córners',           local: 5,    visitor: 7,    type: 'number'  },
            { label: 'Km recorridos',     local: 108.4,visitor: 105.2,type: 'decimal' },
        ],
        analysis: [
            { val: '+34%',  cls: 'trend-up',      label: 'Presión alta',  sub: 'Arsenal domina la presión en los últimos 20 min' },
            { val: '1.82',  cls: 'trend-neutral',  label: 'xG Arsenal',    sub: 'Supera el esperado (1.4) para este partido' },
            { val: '0.94',  cls: 'trend-down',     label: 'xG Barcelona',  sub: 'Por debajo del promedio histórico de 1.6' },
            { val: '7.4',   cls: '',               label: 'PPDA Arsenal',  sub: 'Presión efectiva — menos pases permitidos' },
            { val: '63%',   cls: 'trend-up',       label: 'Banda izq.',    sub: 'Arsenal construye la mayoría por el lado izquierdo' },
            { val: '4.2',   cls: 'trend-neutral',  label: 'Duelos/min',    sub: 'Partido físico, por encima del promedio UCL' },
        ],
        timeline: [
            { minute: 28, icon: '🟨', player: 'Gibbs',   type: 'Tarjeta amarilla' },
            { minute: 32, icon: '⚽', player: 'Messi',   type: 'Gol — Barcelona' },
            { minute: 48, icon: '🩹', player: 'Neymar',  type: 'Lesión' },
            { minute: 58, icon: '⚽', player: 'Saka',    type: 'Gol — Arsenal' },
            { minute: 62, icon: '⚽', player: 'Havertz', type: 'Gol — Arsenal' },
        ],
        lineups: {
            local: [
                { number: 1,  name: 'Ramsdale',   role: 'GK' },
                { number: 4,  name: 'White',      role: 'DF' },
                { number: 12, name: 'Saliba',     role: 'DF' },
                { number: 6,  name: 'Gabriel',    role: 'DF' },
                { number: 35, name: 'Zinchenko',  role: 'DF' },
                { number: 8,  name: 'Ødegaard',   role: 'MF' },
                { number: 5,  name: 'Partey',     role: 'MF' },
                { number: 34, name: 'Xhaka',      role: 'MF' },
                { number: 7,  name: 'Saka',       role: 'FW' },
                { number: 9,  name: 'Jesus',      role: 'FW' },
                { number: 11, name: 'Martinelli', role: 'FW' },
            ],
            visitor: [
                { number: 1,  name: 'Ter Stegen',   role: 'GK' },
                { number: 23, name: 'Koundé',       role: 'DF' },
                { number: 4,  name: 'Araujo',       role: 'DF' },
                { number: 15, name: 'Christensen',  role: 'DF' },
                { number: 28, name: 'Balde',        role: 'DF' },
                { number: 8,  name: 'Pedri',        role: 'MF' },
                { number: 5,  name: 'Busquets',     role: 'MF' },
                { number: 21, name: 'De Jong',      role: 'MF' },
                { number: 11, name: 'Raphinha',     role: 'FW' },
                { number: 9,  name: 'Lewandowski',  role: 'FW' },
                { number: 30, name: 'Gavi',         role: 'FW' },
            ],
        },
    },
};

// ── Caché localStorage con TTL ──────────────────────────────────────────────
function lsGet(slug) {
    try {
        const raw = localStorage.getItem(`elfulbo_${slug}`);
        if (!raw) return null;
        const { ts, data } = JSON.parse(raw);
        if (Date.now() - ts > CACHE_TTL) { localStorage.removeItem(`elfulbo_${slug}`); return null; }
        return data;
    } catch { return null; }
}
function lsSet(slug, data) {
    try { localStorage.setItem(`elfulbo_${slug}`, JSON.stringify({ ts: Date.now(), data })); } catch {}
}

// ── API ESPN con cascada de proxies ─────────────────────────────────────────
async function fetchTeams(slug) {
    if (teamsCache[slug]) return teamsCache[slug];

    const cached = lsGet(slug);
    if (cached) { teamsCache[slug] = cached; return cached; }

    const espnUrl  = `${ESPN}/${slug}/teams?limit=100`;
    const encoded  = encodeURIComponent(espnUrl);
    const proxies  = [
        { url: `${CF_WORKER}?url=${encoded}`,                     parse: r => r.json() },
        { url: `https://api.allorigins.win/get?url=${encoded}`,   parse: async r => JSON.parse((await r.json()).contents) },
        { url: `https://api.codetabs.com/v1/proxy/?quest=${encoded}`, parse: r => r.json() },
    ];

    const statusBar = document.getElementById('status-bar');

    for (const proxy of proxies) {
        try {
            if (statusBar) { statusBar.className = 'status-warn'; statusBar.textContent = `↑ ${new URL(proxy.url).hostname}`; }
            const res = await fetch(proxy.url);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data = await proxy.parse(res);

            const sportsArray = data?.sports?.[0];
            const targetLeague =
                sportsArray?.leagues?.find(l => l.slug === slug) ||
                sportsArray?.leagues?.find(l => l.abbreviation?.toLowerCase() === slug.toLowerCase()) ||
                sportsArray?.leagues?.[0];

            const raw   = targetLeague?.teams ?? [];
            const teams = raw.map(t => ({
                id:    t.team.id,
                name:  t.team.displayName,
                logo:  t.team.logos?.[0]?.href ?? '',
                venue: t.team.venue?.fullName ?? '—',
                color: t.team.color ? `#${t.team.color}` : null,
            }));

            teamsCache[slug] = teams;
            lsSet(slug, teams);
            if (statusBar) { statusBar.className = 'status-ok'; statusBar.textContent = '✓ online'; setTimeout(() => { statusBar.textContent = ''; statusBar.className = ''; }, 3000); }
            return teams;
        } catch (err) {
            console.warn(`[proxy] fallo ${new URL(proxy.url).hostname}: ${err.message}`);
        }
    }

    if (statusBar) { statusBar.className = 'status-error'; statusBar.textContent = '✗ sin conexión'; }
    throw new Error('Todos los proxies fallaron');
}

// ── Precarga en background ──────────────────────────────────────────────────
async function preloadAllLeagues() {
    const priority = [
        'eng.1','esp.1','ger.1','ita.1','fra.1','uefa.champions',
        'ned.1','por.1','conmebol.libertadores','conmebol.sudamericana',
        'eng.fa','eng.league_cup','arg.copa','uefa.europa','uefa.europa.conf',
        'arg.1','bra.1','fifa.world','fifa.friendly','uefa.super_cup',
    ];
    for (const slug of priority) {
        if (teamsCache[slug]) continue;
        try { await fetchTeams(slug); } catch {}
        await new Promise(r => setTimeout(r, 400));
    }
}

// ══════════════════════════════════════════════════════════════════════════════
// RENDERIZADO
// ══════════════════════════════════════════════════════════════════════════════
const App = (() => {
    const display = () => document.getElementById('data-display');

    // ── Cancha 3D isométrica ─────────────────────────────────────────────────
    function buildPitchSVG(lineups) {
        const local   = lineups.local;
        const visitor = lineups.visitor;

        // Posicionar jugadores en la cancha perspectiva
        // viewBox 560×340, cancha: top 62, bottom 292, left 30, right 530
        const roles = ['GK', 'DF', 'MF', 'FW'];

        // Y rows para cada equipo (visitante arriba, local abajo)
        const visitorYRows = { GK: 78, DF: 107, MF: 140, FW: 163 };
        const localYRows   = { FW: 193, MF: 218, DF: 245, GK: 277 };

        // X spread: para perspectiva, más estrecho arriba y más ancho abajo
        function getXPositions(count, yRow) {
            const minX = 140 + (yRow - 62) * (30 / 230);
            const maxX = 420 - (yRow - 62) * (30 / 230);
            if (count === 1) return [280];
            const step = (maxX - minX) / (count - 1);
            return Array.from({ length: count }, (_, i) => Math.round(minX + i * step));
        }

        function renderTeam(team, yRows, isLocal) {
            let html = '';
            roles.forEach(role => {
                const players = team.filter(p => p.role === role);
                if (!players.length) return;
                const y = yRows[role];
                const xs = getXPositions(players.length, y);
                players.forEach((p, i) => {
                    const fill   = isLocal ? '#f0f2f7' : '#f04b5a';
                    const stroke = isLocal ? 'rgba(220,248,54,0.9)' : 'rgba(255,255,255,0.6)';
                    const txt    = isLocal ? '#080b11' : '#ffffff';
                    html += `
                    <g transform="translate(${xs[i]},${y})" style="cursor:default">
                        <circle r="11" fill="${fill}" stroke="${stroke}" stroke-width="1.5"/>
                        <text text-anchor="middle" dy="4" font-family="Inter,sans-serif" font-size="8.5" font-weight="900" fill="${txt}">${p.number}</text>
                    </g>`;
                });
            });
            return html;
        }

        return `
        <svg class="pitch-svg" viewBox="0 0 560 340" xmlns="http://www.w3.org/2000/svg">
            <defs>
                <linearGradient id="pitchGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stop-color="#1a5c20"/>
                    <stop offset="100%" stop-color="#0f3d14"/>
                </linearGradient>
                <pattern id="stripes" x="0" y="0" width="38" height="1" patternUnits="userSpaceOnUse" patternTransform="skewX(-28)">
                    <rect width="19" height="1" fill="rgba(255,255,255,0.04)"/>
                </pattern>
            </defs>
            <ellipse cx="280" cy="326" rx="220" ry="16" fill="#000" opacity=".3"/>
            <polygon points="140,62 420,62 530,292 30,292" fill="url(#pitchGrad)"/>
            <polygon points="140,62 420,62 530,292 30,292" fill="url(#stripes)"/>
            <polygon points="140,62 420,62 530,292 30,292" fill="none" stroke="rgba(255,255,255,0.28)" stroke-width="1.5"/>

            <!-- Centro -->
            <line x1="30" y1="177" x2="530" y2="177" stroke="rgba(255,255,255,0.2)" stroke-width="1"/>
            <ellipse cx="280" cy="177" rx="68" ry="22" fill="none" stroke="rgba(255,255,255,0.2)" stroke-width="1"/>
            <circle cx="280" cy="177" r="2.5" fill="rgba(255,255,255,0.28)"/>

            <!-- Área penal arriba -->
            <polygon points="192,62 368,62 386,118 174,118" fill="none" stroke="rgba(255,255,255,0.18)" stroke-width="1"/>
            <polygon points="228,62 332,62 342,88 218,88" fill="none" stroke="rgba(255,255,255,0.15)" stroke-width="1"/>
            <rect x="237" y="51" width="86" height="13" rx="1" fill="rgba(255,255,255,0.07)" stroke="rgba(255,255,255,0.18)" stroke-width="1"/>

            <!-- Área penal abajo -->
            <polygon points="174,236 386,236 368,292 192,292" fill="none" stroke="rgba(255,255,255,0.18)" stroke-width="1"/>
            <polygon points="218,262 342,262 332,292 228,292" fill="none" stroke="rgba(255,255,255,0.15)" stroke-width="1"/>
            <rect x="237" y="290" width="86" height="13" rx="1" fill="rgba(255,255,255,0.07)" stroke="rgba(255,255,255,0.18)" stroke-width="1"/>

            <!-- Labels equipo -->
            <text x="80" y="96" text-anchor="middle" font-size="8" font-weight="800" fill="rgba(240,75,90,0.75)" font-family="Inter,sans-serif" letter-spacing="1">${appData.match.teams.visitor.abbr}</text>
            <text x="80" y="264" text-anchor="middle" font-size="8" font-weight="800" fill="rgba(220,248,54,0.75)" font-family="Inter,sans-serif" letter-spacing="1">${appData.match.teams.local.abbr}</text>

            ${renderTeam(visitor, visitorYRows, false)}
            ${renderTeam(local,   localYRows,   true)}
        </svg>`;
    }

    // ── Stats bars ────────────────────────────────────────────────────────────
    function buildStatsBars() {
        return appData.match.stats.map(stat => {
            let wA = 50, wB = 50;
            if (typeof stat.local === 'number' && typeof stat.visitor === 'number') {
                const tot = stat.local + stat.visitor;
                if (tot > 0) { wA = (stat.local / tot) * 100; wB = 100 - wA; }
            }
            const dispA = stat.type === 'percent' ? `${stat.local}%` : stat.local;
            const dispB = stat.type === 'percent' ? `${stat.visitor}%` : stat.visitor;
            return `
            <div class="stat-row">
                <div class="stat-bar-wrap">
                    <span class="stat-val right">${dispA}</span>
                    <div class="bar-bg"><div class="bar-fill bar-a" style="width:${wA.toFixed(0)}%"></div></div>
                </div>
                <span class="stat-label">${stat.label}</span>
                <div class="stat-bar-wrap">
                    <div class="bar-bg"><div class="bar-fill bar-b" style="width:${wB.toFixed(0)}%"></div></div>
                    <span class="stat-val">${dispB}</span>
                </div>
            </div>`;
        }).join('');
    }

    // ── Analysis cards ────────────────────────────────────────────────────────
    function buildAnalysisCards() {
        return appData.match.analysis.map(c => `
        <div class="analysis-card">
            <div class="a-card-val ${c.cls}">${c.val}</div>
            <div class="a-card-label">${c.label}</div>
            <div class="a-card-sub">${c.sub}</div>
        </div>`).join('');
    }

    // ── Player lists (dos columnas) ───────────────────────────────────────────
    function buildPlayerLists() {
        const col = (team) => team.map(p => `
            <div class="player-list-item">
                <div class="player-role-indicator ${p.role.toLowerCase()}"></div>
                <span class="player-num">${p.number}</span>
                <span class="player-name">${p.name}</span>
            </div>`).join('');
        return `
        <div class="player-lists-wrapper">
            <div>
                <div class="col-title">${appData.match.teams.local.name}</div>
                <div class="player-list">${col(appData.match.lineups.local)}</div>
            </div>
            <div>
                <div class="col-title">${appData.match.teams.visitor.name}</div>
                <div class="player-list">${col(appData.match.lineups.visitor)}</div>
            </div>
        </div>`;
    }

    // ── Vista Alineaciones ────────────────────────────────────────────────────
    function renderLineups() {
        const m = appData.match;
        display().innerHTML = `
            <div class="match-header">
                <div class="team-side">
                    <div class="team-badge badge-local">${m.teams.local.abbr}</div>
                    <div>
                        <div class="team-label">${m.teams.local.name}</div>
                        <div class="team-formation">${m.teams.local.formation}</div>
                    </div>
                </div>
                <div class="score-block">
                    <div class="score">${m.score.local} — ${m.score.visitor}</div>
                    <div class="match-status"><span class="live-dot"></span>${m.status}</div>
                </div>
                <div class="team-side right">
                    <div class="team-badge badge-visitor">${m.teams.visitor.abbr}</div>
                    <div>
                        <div class="team-label">${m.teams.visitor.name}</div>
                        <div class="team-formation">${m.teams.visitor.formation}</div>
                    </div>
                </div>
            </div>

            <div class="pitch-wrap">${buildPitchSVG(m.lineups)}</div>

            <div class="lineup-tabs-nav">
                <button class="lineup-tab active" data-target="panel-players">Jugadores</button>
                <button class="lineup-tab" data-target="panel-stats">Estadísticas</button>
                <button class="lineup-tab" data-target="panel-analysis">Análisis</button>
            </div>

            <div id="panel-players" class="lineup-panel active">
                ${buildPlayerLists()}
            </div>
            <div id="panel-stats" class="lineup-panel">
                <div class="stats-section">${buildStatsBars()}</div>
            </div>
            <div id="panel-analysis" class="lineup-panel">
                <div class="analysis-grid">${buildAnalysisCards()}</div>
            </div>
        `;
    }

    // ── Vista Live ────────────────────────────────────────────────────────────
    function renderLive() {
        const m = appData.match;
        const items = m.timeline.map(ev => `
            <div class="event-item">
                <span class="event-minute">${ev.minute}'</span>
                <span class="event-icon">${ev.icon}</span>
                <span class="event-player">${ev.player}</span>
                <span class="event-type">${ev.type}</span>
            </div>`).join('');

        display().innerHTML = `
            <div class="match-header-compact">
                <div class="score-pill"><span class="live-dot"></span>${m.status}</div>
                <span>${m.teams.local.name} ${m.score.local} – ${m.score.visitor} ${m.teams.visitor.name}</span>
            </div>
            <div class="section-title">Cronología</div>
            <div class="timeline-container">${items}</div>
        `;
    }

    // ── Vista Ligas ───────────────────────────────────────────────────────────
    function renderLeagues() {
        // Agrupar por región
        const groups = {};
        appData.leagues.forEach(l => {
            if (!groups[l.region]) groups[l.region] = [];
            groups[l.region].push(l);
        });

        const regionOrder = ['europe', 'cup', 'world', 'conmebol', 'arg', 'bra'];
        const groupsHTML = regionOrder.map(region => {
            const leagues = groups[region];
            if (!leagues) return '';
            const color = REGION_COLORS[region] || '#4a5268';
            const label = REGION_LABELS[region] || region;
            const cardsHTML = leagues.map(l => {
                const inCache = !!teamsCache[l.slug];
                return `
                <div class="league-card" data-slug="${l.slug}" data-name="${l.name}"
                     style="--region-color:${color}">
                    <div class="league-card-header">
                        <span class="league-flag">${l.flag}</span>
                        <span class="league-country">${l.country}</span>
                        ${inCache ? '<span class="cache-dot" title="En caché"></span>' : ''}
                    </div>
                    <h4>${l.name}</h4>
                </div>`;
            }).join('');
            return `
            <div class="league-group">
                <div class="league-group-label">${label}</div>
                <div class="leagues-grid">${cardsHTML}</div>
            </div>`;
        }).join('');

        display().innerHTML = `
            <h2 class="section-header">Ligas</h2>
            ${groupsHTML}
        `;
    }

    async function renderLeagueTeams(slug, leagueName) {
        display().innerHTML = `
            <div class="back-header">
                <button class="btn-back" data-action="back-to-leagues">← Volver</button>
                <h2 class="section-header">${leagueName}</h2>
            </div>
            <div class="teams-grid">
                ${Array(12).fill('<div class="skeleton"></div>').join('')}
            </div>`;

        try {
            const teams = await fetchTeams(slug);
            const grid  = display().querySelector('.teams-grid');
            if (!grid) return;

            if (!teams.length) {
                grid.innerHTML = `<div class="empty-msg">No se encontraron equipos para esta liga.</div>`;
                return;
            }

            grid.innerHTML = teams.map(team => {
                const style = team.color ? `style="border-top-color:${team.color}"` : '';
                return `
                <div class="team-card" ${style}>
                    ${team.logo
                        ? `<img src="${team.logo}" class="team-logo" alt="${team.name}" loading="lazy">`
                        : `<div class="team-logo-placeholder"></div>`}
                    <div class="team-info">
                        <span class="team-name">${team.name}</span>
                        <span class="team-venue">${team.venue}</span>
                    </div>
                </div>`;
            }).join('');

        } catch {
            const grid = display().querySelector('.teams-grid');
            if (grid) grid.innerHTML = `<div class="empty-msg error-msg">No se pudo cargar esta liga.<br>ESPN puede no tenerla disponible.</div>`;
        }
    }

    // ── Router ────────────────────────────────────────────────────────────────
    const TIER = { live: 5, lineups: 10, leagues: 0 };

    function renderView(view) {
        const required = TIER[view] ?? 0;
        if (appData.user.subscriptionLevel < required) {
            display().innerHTML = `
                <div class="access-denied">
                    <h3>Vista bloqueada</h3>
                    <p>Esta vista requiere un plan activo.</p>
                    <span class="plan-badge">Plan $${required}/mes</span>
                </div>`;
            return;
        }
        switch (view) {
            case 'live':    renderLive();    break;
            case 'lineups': renderLineups(); break;
            case 'leagues': renderLeagues(); break;
        }
    }

    // ── Init ──────────────────────────────────────────────────────────────────
    function init() {
        document.body.addEventListener('click', e => {
            // Nav principal
            const navBtn = e.target.closest('[data-view]');
            if (navBtn && navBtn.closest('#bottom-nav')) {
                document.querySelectorAll('#bottom-nav .nav-item').forEach(b =>
                    b.classList.toggle('active', b === navBtn));
                renderView(navBtn.dataset.view);
                return;
            }

            // Card de liga
            const leagueCard = e.target.closest('.league-card');
            if (leagueCard) {
                renderLeagueTeams(leagueCard.dataset.slug, leagueCard.dataset.name);
                return;
            }

            // Botón volver
            const backBtn = e.target.closest('[data-action="back-to-leagues"]');
            if (backBtn) { renderLeagues(); return; }

            // Tabs de alineaciones
            const lineupTab = e.target.closest('.lineup-tab');
            if (lineupTab) {
                document.querySelectorAll('.lineup-tab').forEach(t => t.classList.remove('active'));
                document.querySelectorAll('.lineup-panel').forEach(p => {
                    p.classList.remove('active');
                    p.style.display = 'none';
                });
                lineupTab.classList.add('active');
                const panel = document.getElementById(lineupTab.dataset.target);
                if (panel) { panel.classList.add('active'); panel.style.display = 'block'; }
                return;
            }
        });

        renderView('leagues');
        setTimeout(preloadAllLeagues, 1500);
    }

    return { init };
})();

document.addEventListener('DOMContentLoaded', App.init);
