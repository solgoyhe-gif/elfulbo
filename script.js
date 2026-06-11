/**
 * script.js - Lógica principal de "El Fulbo"
 * Arquitectura: Event-driven, Estado Centralizado, Renderizado Modular
 */
const ESPN = 'https://site.api.espn.com/apis/site/v2/sports/soccer';

const LEAGUES = {
    PREMIER_LEAGUE:    { slug: 'eng.1',              name: "Premier League",       country: "England",     flag: "🏴󠁧󠁢󠁥󠁮󠁧󠁿" },
    BUNDESLIGA:        { slug: 'ger.1',              name: "Bundesliga",           country: "Germany",     flag: "🇩🇪" },
    SERIE_A:           { slug: 'ita.1',              name: "Serie A",              country: "Italy",       flag: "🇮🇹" },
    LIGUE_1:           { slug: 'fra.1',              name: "Ligue 1",              country: "France",      flag: "🇫🇷" },
    LA_LIGA:           { slug: 'esp.1',              name: "La Liga",              country: "Spain",       flag: "🇪🇸" },
    EREDIVISIE:        { slug: 'ned.1',              name: "Eredivisie",           country: "Netherlands", flag: "🇳🇱" },
    PRIMEIRA_LIGA:     { slug: 'por.1',              name: "Primeira Liga",        country: "Portugal",    flag: "🇵🇹" },
    CARABAO_CUP:       { slug: 'eng.league_cup',     name: "Carabao Cup",          country: "England",     flag: "🏴󠁧󠁢󠁥󠁮󠁧󠁿" },
    FA_CUP:            { slug: 'eng.fa',             name: "FA Cup",               country: "England",     flag: "🏴󠁧󠁢󠁥󠁮󠁧󠁿" },
    CHAMPIONS_LEAGUE:  { slug: 'uefa.champions',     name: "Champions League",     country: "Europe",      flag: "🇪🇺" },
    EUROPA_LEAGUE:     { slug: 'uefa.europa',        name: "Europa League",        country: "Europe",      flag: "🇪🇺" },
    CONFERENCE_LEAGUE: { slug: 'uefa.europa.conf',   name: "Conference League",    country: "Europe",      flag: "🇪🇺" },
    UEFA_SUPER_CUP:    { slug: 'uefa.super_cup',     name: "UEFA Super Cup",       country: "Europe",      flag: "🇪🇺" },
    WORLD_CUP:         { slug: 'fifa.world',         name: "FIFA World Cup",       country: "World",       flag: "🌍" },
    FRIENDLIES_INTL:   { slug: 'fifa.friendly',      name: "Amistosos Pre-Mundial", country: "World",      flag: "🌍" },
    COPA_LIBERTADORES: { slug: 'conmebol.libertadores', name: "Copa Libertadores",  country: "CONMEBOL",    flag: "🌎" },
    COPA_SUDAMERICANA: { slug: 'conmebol.sudamericana', name: "Copa Sudamericana",  country: "CONMEBOL",    flag: "🌎" },
    LIGA_PROFESIONAL:  { slug: 'arg.1',              name: "Liga Profesional",     country: "Argentina",   flag: "🇦🇷" },
    COPA_ARGENTINA:    { slug: 'arg.copa',           name: "Copa Argentina",       country: "Argentina",   flag: "🇦🇷" },
    BRASILEIRAO:       { slug: 'bra.1',              name: "Brasileirao",          country: "Brazil",      flag: "🇧🇷" }
};

const teamsCache = {};

// Estado Centralizado Extendido (11vs11, Estadísticas completas, Tácticas)
const appData = {
    user: { subscriptionLevel: 10 },
    leagues: Object.values(LEAGUES),
    match: {
        id: "match-001",
        teams: { local: "Arsenal", visitor: "FCB" },
        score: { local: 2, visitor: 1 },
        status: "62'",
        stats: [
            { label: "Goles Esperados (xG)", local: 2.1, visitor: 0.9, type: "decimal" },
            { label: "Posesión (%)", local: 42, visitor: 58, type: "percent" },
            { label: "Pases Completados", local: 342, visitor: 512, type: "number" },
            { label: "Efectividad de Pases (%)", local: 81, visitor: 89, type: "percent" },
            { label: "Tiros Totales", local: 14, visitor: 8, type: "number" },
            { label: "Tiros al Arco", local: 6, visitor: 3, type: "number" },
            { label: "Faltas Cometidas", local: 12, visitor: 9, type: "number" },
            { label: "Tarjetas (Amarillas/Rojas)", local: "2/0", visitor: "1/0", type: "string" },
            { label: "Córners", local: 5, visitor: 7, type: "number" },
            { label: "Tiros Libres", local: 11, visitor: 14, type: "number" },
            { label: "Kilómetros Recorridos", local: 108.4, visitor: 105.2, type: "decimal" }
        ],
        analysis: {
            ppda: { local: 8.4, visitor: 12.1 },
            highPress: { local: "Alta", visitor: "Media" },
            attackFlank: { local: "Izquierda (45%)", visitor: "Centro (52%)" }
        },
        timeline: [
            { minute: 28, event: "Yellow Card", player: "Gibbs" },
            { minute: 32, event: "Goal", player: "Messi" },
            { minute: 48, event: "Injured", player: "Neymar" },
            { minute: 62, event: "Goal", player: "Sánchez" }
        ],
        lineups: {
            local: [
                { number: 1, name: "Ramsdale", role: "GK" },
                { number: 4, name: "White", role: "DF" }, { number: 12, name: "Saliba", role: "DF" }, { number: 6, name: "Gabriel", role: "DF" }, { number: 35, name: "Zinchenko", role: "DF" },
                { number: 8, name: "Ødegaard", role: "MF" }, { number: 5, name: "Partey", role: "MF" }, { number: 34, name: "Xhaka", role: "MF" },
                { number: 7, name: "Saka", role: "FW" }, { number: 9, name: "Jesus", role: "FW" }, { number: 11, name: "Martinelli", role: "FW" }
            ],
            visitor: [
                { number: 1, name: "Ter Stegen", role: "GK" },
                { number: 23, name: "Koundé", role: "DF" }, { number: 4, name: "Araujo", role: "DF" }, { number: 15, name: "Christensen", role: "DF" }, { number: 28, name: "Balde", role: "DF" },
                { number: 8, name: "Pedri", role: "MF" }, { number: 5, name: "Busquets", role: "MF" }, { number: 21, name: "De Jong", role: "MF" },
                { number: 11, name: "Raphinha", role: "FW" }, { number: 9, name: "Lewandowski", role: "FW" }, { number: 30, name: "Gavi", role: "FW" }
            ]
        }
    }
};

// ── API ESPN (Proxies en cascada) ──────────────────────────────────────────
async function fetchTeams(slug) {
    if (teamsCache[slug]) return teamsCache[slug];

    const espnUrl = `${ESPN}/${slug}/teams?limit=100`;
    const encodedUrl = encodeURIComponent(espnUrl);

    const proxies = [
        `https://api.allorigins.win/get?url=${encodedUrl}`,
        `https://api.codetabs.com/v1/proxy/?quest=${encodedUrl}`
    ];

    let lastError;

    for (const proxyUrl of proxies) {
        try {
            const res = await fetch(proxyUrl);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            
            let data;
            if (proxyUrl.includes('allorigins')) {
                const jsonRes = await res.json();
                data = JSON.parse(jsonRes.contents);
            } else {
                data = await res.json();
            }

            const raw = data?.sports?.[0]?.leagues?.[0]?.teams ?? [];
            const teams = raw.map(t => ({
                id:     t.team.id,
                name:   t.team.displayName,
                logo:   t.team.logos?.[0]?.href ?? '',
                venue:  t.team.venue?.fullName ?? '—',
            }));

            teamsCache[slug] = teams;
            return teams;

        } catch (err) {
            lastError = err;
        }
    }
    throw lastError;
}

// ── RENDERIZADO MODULAR ───────────────────────────────────────────────────
const App = (() => {
    const elements = {
        dataDisplay: document.getElementById('data-display')
    };

    // 1. Cronología (Live)
    const renderLiveCommentary = () => {
        const timelineHTML = appData.match.timeline.map(item =>
            `<div class="event">
                <span>${item.minute}'</span> — ${item.player}: <strong>${item.event}</strong>
            </div>`
        ).join('');
        
        elements.dataDisplay.innerHTML = `
            <div class="match-header-compact">
                <div class="score-pill">
                    <span class="live-dot"></span>${appData.match.status}
                </div>
                <h2>${appData.match.teams.local} ${appData.match.score.local} - ${appData.match.score.visitor} ${appData.match.teams.visitor}</h2>
            </div>
            <h2 class="section-header">Cronología</h2>
            <div class="timeline-container">
                ${timelineHTML}
            </div>
        `;
    };

    // 2. Alineaciones 3D e Insights
    const buildPitchPlayers = (teamArray, isLocal) => {
        const roles = ['GK', 'DF', 'MF', 'FW'];
        // Invertir el orden visual para el visitante
        const renderRoles = isLocal ? roles : [...roles].reverse();
        
        let html = '';
        renderRoles.forEach((role, rowIndex) => {
            const playersInRole = teamArray.filter(p => p.role === role);
            const yPos = isLocal ? 60 + (rowIndex * 18) : 10 + (rowIndex * 18);
            
            playersInRole.forEach((p, idx) => {
                const spacing = 80 / (playersInRole.length + 1);
                const xPos = 10 + (spacing * (idx + 1));
                const color = isLocal ? '#ffffff' : '#ff4757';
                const textCol = isLocal ? '#000000' : '#ffffff';
                
                html += `
                    <g transform="translate(${xPos}, ${yPos})">
                        <circle cx="0" cy="0" r="3.5" fill="${color}" stroke="rgba(255,255,255,0.3)" stroke-width="0.5"/>
                        <text x="0" y="1.2" font-family="sans-serif" font-size="2.8" font-weight="bold" fill="${textCol}" text-anchor="middle">${p.number}</text>
                    </g>
                `;
            });
        });
        return html;
    };

    const buildStatsBars = () => {
        return appData.match.stats.map(stat => {
            let localWidth = 50;
            let visitorWidth = 50;
            
            if (typeof stat.local === 'number' && typeof stat.visitor === 'number') {
                const total = stat.local + stat.visitor;
                if (total > 0) {
                    localWidth = (stat.local / total) * 100;
                    visitorWidth = (stat.visitor / total) * 100;
                }
            }

            return `
            <div class="stat-row">
                <div class="stat-values">
                    <span class="stat-val local">${stat.local}</span>
                    <span class="stat-label">${stat.label}</span>
                    <span class="stat-val visitor">${stat.visitor}</span>
                </div>
                <div class="stat-bar-container">
                    <div class="stat-bar local" style="width: ${localWidth}%"></div>
                    <div class="stat-bar visitor" style="width: ${visitorWidth}%"></div>
                </div>
            </div>`;
        }).join('');
    };

    const buildPlayerList = () => {
        const buildCol = (team, isLocal) => {
            return team.map(p => `
                <div class="player-list-item">
                    <div class="player-role-indicator ${p.role.toLowerCase()}"></div>
                    <span class="player-num">${p.number}</span>
                    <span class="player-name">${p.name}</span>
                </div>
            `).join('');
        };

        return `
            <div class="player-lists-wrapper">
                <div class="player-col">
                    <h4 class="col-title">${appData.match.teams.local}</h4>
                    ${buildCol(appData.match.lineups.local, true)}
                </div>
                <div class="player-col">
                    <h4 class="col-title">${appData.match.teams.visitor}</h4>
                    ${buildCol(appData.match.lineups.visitor, false)}
                </div>
            </div>
        `;
    };

    const renderLineups = () => {
        elements.dataDisplay.innerHTML = `
            <div class="match-header-compact">
                <h2>${appData.match.teams.local} ${appData.match.score.local} - ${appData.match.score.visitor} ${appData.match.teams.visitor}</h2>
            </div>
            
            <div class="pitch-container">
                <svg viewBox="0 0 100 130" class="isometric-pitch" preserveAspectRatio="xMidYMid meet">
                    <defs>
                        <radialGradient id="pitchLight" cx="50%" cy="50%" r="70%">
                            <stop offset="0%" stop-color="rgba(255,255,255,0.15)"/>
                            <stop offset="100%" stop-color="rgba(0,0,0,0.4)"/>
                        </radialGradient>
                        <filter id="grassNoise">
                            <feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="3" result="noise"/>
                            <feColorMatrix type="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 0.05 0" in="noise" result="coloredNoise"/>
                            <feBlend in="SourceGraphic" in2="coloredNoise" mode="overlay"/>
                        </filter>
                    </defs>
                    <rect width="100" height="130" fill="var(--pitch-green)" filter="url(#grassNoise)"/>
                    <rect width="100" height="130" fill="url(#pitchLight)"/>
                    
                    <g stroke="rgba(255,255,255,0.4)" stroke-width="0.5" fill="none">
                        <rect x="2" y="2" width="96" height="126" />
                        <line x1="2" y1="65" x2="98" y2="65" />
                        <circle cx="50" cy="65" r="10" />
                        <rect x="25" y="2" width="50" height="18" />
                        <rect x="38" y="2" width="24" height="6" />
                        <path d="M 40 20 A 10 10 0 0 0 60 20" />
                        <rect x="25" y="110" width="50" height="18" />
                        <rect x="38" y="122" width="24" height="6" />
                        <path d="M 60 110 A 10 10 0 0 0 40 110" />
                    </g>
                    
                    ${buildPitchPlayers(appData.match.lineups.visitor, false)}
                    ${buildPitchPlayers(appData.match.lineups.local, true)}
                </svg>
            </div>

            <div class="lineup-tabs-nav">
                <button class="lineup-tab active" data-target="panel-players">Jugadores</button>
                <button class="lineup-tab" data-target="panel-stats">Estadísticas</button>
                <button class="lineup-tab" data-target="panel-analysis">Análisis</button>
            </div>

            <div id="panel-players" class="lineup-panel active">
                ${buildPlayerList()}
            </div>
            <div id="panel-stats" class="lineup-panel" style="display:none;">
                <div class="stats-container">
                    ${buildStatsBars()}
                </div>
            </div>
            <div id="panel-analysis" class="lineup-panel" style="display:none;">
                <div class="analysis-grid">
                    <div class="analysis-card">
                        <h5>Intensidad de Presión (PPDA)</h5>
                        <p><span style="color:var(--accent)">${appData.match.analysis.ppda.local}</span> vs <span style="color:var(--red)">${appData.match.analysis.ppda.visitor}</span></p>
                    </div>
                    <div class="analysis-card">
                        <h5>Bloque Defensivo</h5>
                        <p>${appData.match.analysis.highPress.local} vs ${appData.match.analysis.highPress.visitor}</p>
                    </div>
                    <div class="analysis-card">
                        <h5>Ataque Principal</h5>
                        <p>${appData.match.analysis.attackFlank.local}</p>
                    </div>
                </div>
            </div>
        `;
    };

    // 3. Ligas y Equipos
    const renderLeagues = () => {
        const html = appData.leagues.map(league =>
            `<div class="league-card" data-slug="${league.slug}" data-name="${league.name}">
                <div class="league-card-header">
                    <span class="league-flag">${league.flag}</span>
                    <span class="league-country">${league.country}</span>
                </div>
                <h4>${league.name}</h4>
            </div>`
        ).join('');

        elements.dataDisplay.innerHTML = `
            <h2 class="section-header">Ligas</h2>
            <div class="leagues-grid">
                ${html}
            </div>
        `;
    };

    const renderLeagueTeams = async (slug, leagueName) => {
        elements.dataDisplay.innerHTML = `
            <div class="back-header">
                <button class="btn-back" data-action="back-to-leagues">← Volver</button>
                <h2 class="section-header">${leagueName}</h2>
            </div>
            <div class="teams-grid">
                ${Array(12).fill('<div class="skeleton"></div>').join('')}
            </div>
        `;

        try {
            const teams = await fetchTeams(slug);
            const grid = elements.dataDisplay.querySelector('.teams-grid');
            if (!grid) return; // Protección DOM (Race Condition)

            if (!teams.length) {
                grid.innerHTML = `<div class="empty-msg">No se encontraron equipos para la temporada actual.</div>`;
                return;
            }

            grid.innerHTML = teams.map(team =>
                `<div class="team-card">
                    ${team.logo 
                        ? `<img src="${team.logo}" class="team-logo" alt="${team.name}" loading="lazy">` 
                        : `<div class="team-logo" style="background: var(--border); border-radius: 50%;"></div>`
                    }
                    <div class="team-info">
                        <span class="team-name">${team.name}</span>
                        <span class="team-venue">${team.venue}</span>
                    </div>
                </div>`
            ).join('');

        } catch (err) {
            const grid = elements.dataDisplay.querySelector('.teams-grid');
            if (!grid) return;
            grid.innerHTML = `<div class="empty-msg">No se pudo cargar esta liga.<br>Puede que ESPN no la tenga disponible actualmente.</div>`;
            console.warn(`[API Info] Fallo al cargar datos para ${slug}`);
        }
    };

    // ── Router y Control de Accesos ─────────────────────────────────────────
    const getRequiredTier = (view) => ({ live: 5, lineups: 10, leagues: 0 }[view] ?? 0);

    const renderView = (viewType) => {
        if (appData.user.subscriptionLevel < getRequiredTier(viewType)) {
            elements.dataDisplay.innerHTML = `
                <div class="access-denied">
                    <h3>Acceso denegado</h3>
                    <p>Se requiere plan de $${getRequiredTier(viewType)}.</p>
                </div>
            `;
            return;
        }

        switch (viewType) {
            case 'live':    renderLiveCommentary(); break;
            case 'lineups': renderLineups();        break;
            case 'leagues': renderLeagues();        break;
        }
    };

    const init = () => {
        // Delegación de Eventos Global en el Body
        document.body.addEventListener('click', (e) => {
            
            // 1. Navegación Principal Bottom Nav
            const navBtn = e.target.closest('[data-view]');
            if (navBtn) {
                document.querySelectorAll('[data-view]').forEach(btn => 
                    btn.classList.toggle('active', btn === navBtn)
                );
                renderView(navBtn.dataset.view);
                return;
            }

            // 2. Navegación de Ligas a Equipos
            const leagueCard = e.target.closest('.league-card');
            if (leagueCard) {
                renderLeagueTeams(leagueCard.dataset.slug, leagueCard.dataset.name);
                return;
            }

            // 3. Botón de retroceso de Equipos a Ligas
            const backBtn = e.target.closest('[data-action="back-to-leagues"]');
            if (backBtn) {
                renderLeagues();
                return;
            }

            // 4. Sub-pestañas internas de Alineaciones (Jugadores/Stats/Análisis)
            const lineupTab = e.target.closest('.lineup-tab');
            if (lineupTab) {
                document.querySelectorAll('.lineup-tab').forEach(t => t.classList.remove('active'));
                document.querySelectorAll('.lineup-panel').forEach(p => p.style.display = 'none');
                
                lineupTab.classList.add('active');
                document.getElementById(lineupTab.dataset.target).style.display = 'block';
                return;
            }
        });

        // Render inicial
        renderView('leagues');
    };

    return { init };
})();

document.addEventListener('DOMContentLoaded', App.init);
