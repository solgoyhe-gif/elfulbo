/**
 * script.js - Lógica principal de "El Fulbo"
 * API: ESPN pública con sistema de proxies en cascada optimizado.
 */

const ESPN = 'https://site.api.espn.com/apis/site/v2/sports/soccer';

const LEAGUES = {
    // ── EUROPA TOP 5 ─────────────────────────────
    PREMIER_LEAGUE:    { id: 39,  slug: 'eng.1',              name: "Premier League",      country: "England",     flag: "🏴󠁧󠁢󠁥󠁮󠁧󠁿", season: 2025 },
    BUNDESLIGA:        { id: 78,  slug: 'ger.1',              name: "Bundesliga",          country: "Germany",     flag: "🇩🇪", season: 2025 },
    SERIE_A:           { id: 135, slug: 'ita.1',              name: "Serie A",             country: "Italy",       flag: "🇮🇹", season: 2025 },
    LIGUE_1:           { id: 61,  slug: 'fra.1',              name: "Ligue 1",             country: "France",      flag: "🇫🇷", season: 2025 },
    LA_LIGA:           { id: 140, slug: 'esp.1',              name: "La Liga",             country: "Spain",       flag: "🇪🇸", season: 2025 },
    // ── EUROPA OTRAS ─────────────────────────────
    EREDIVISIE:        { id: 88,  slug: 'ned.1',              name: "Eredivisie",          country: "Netherlands", flag: "🇳🇱", season: 2025 },
    PRIMEIRA_LIGA:     { id: 94,  slug: 'por.1',              name: "Primeira Liga",       country: "Portugal",    flag: "🇵🇹", season: 2025 },
    // ── COPAS INGLESAS ───────────────────────────
    CARABAO_CUP:       { id: 48,  slug: 'eng.league_cup',     name: "Carabao Cup",         country: "England",     flag: "🏴󠁧󠁢󠁥󠁮󠁧󠁿", season: 2025 },
    FA_CUP:            { id: 45,  slug: 'eng.fa',             name: "FA Cup",              country: "England",     flag: "🏴󠁧󠁢󠁥󠁮󠁧󠁿", season: 2025 },
    // ── UEFA ─────────────────────────────────────
    CHAMPIONS_LEAGUE:  { id: 2,   slug: 'uefa.champions',     name: "Champions League",    country: "Europe",      flag: "🇪🇺", season: 2025 },
    EUROPA_LEAGUE:     { id: 3,   slug: 'uefa.europa',        name: "Europa League",       country: "Europe",      flag: "🇪🇺", season: 2025 },
    CONFERENCE_LEAGUE: { id: 848, slug: 'uefa.europa.conf',   name: "Conference League",   country: "Europe",      flag: "🇪🇺", season: 2025 },
    UEFA_SUPER_CUP:    { id: 531, slug: 'uefa.super_cup',     name: "UEFA Super Cup",      country: "Europe",      flag: "🇪🇺", season: 2025 },
    // ── MUNDIAL ───────────────────────────────────
    WORLD_CUP:         { id: 1,   slug: 'fifa.world',         name: "FIFA World Cup",      country: "World",       flag: "🌍", season: 2026 },
    FRIENDLIES_INTL:   { id: 10,  slug: 'fifa.friendly',      name: "Amistosos Pre-Mundial", country: "World",     flag: "🌍", season: 2026 },
    // ── CONMEBOL ─────────────────────────────────
    COPA_LIBERTADORES: { id: 13,  slug: 'conmebol.libertadores', name: "Copa Libertadores", country: "CONMEBOL",   flag: "🌎", season: 2026 },
    COPA_SUDAMERICANA: { id: 11,  slug: 'conmebol.sudamericana', name: "Copa Sudamericana", country: "CONMEBOL",   flag: "🌎", season: 2026 },
    // ── ARGENTINA ────────────────────────────────
    LIGA_PROFESIONAL:  { id: 128, slug: 'arg.1',              name: "Liga Profesional",    country: "Argentina",   flag: "🇦🇷", season: 2026 },
    COPA_ARGENTINA:    { id: 130, slug: 'arg.copa',           name: "Copa Argentina",      country: "Argentina",   flag: "🇦🇷", season: 2025 },
    // ── BRASIL ───────────────────────────────────
    BRASILEIRAO:       { id: 71,  slug: 'bra.1',              name: "Brasileirao",         country: "Brazil",      flag: "🇧🇷", season: 2025 },
};

const teamsCache = {};

const appData = {
    user: { subscriptionLevel: 10 },
    leagues: Object.values(LEAGUES),
    match: {
        id: "match-001",
        teams: { local: "Arsenal", visitor: "Barcelona" },
        score: { local: 2, visitor: 1 },
        minute: "62'",
        timeline: [
            { minute: 28, event: "Yellow Card", player: "Gibbs" },
            { minute: 32, event: "Goal", player: "Messi" },
            { minute: 48, event: "Injured", player: "Neymar" },
            { minute: 62, event: "Goal", player: "Sánchez" }
        ],
        lineups: {
            local: [
                { number: 1, name: "GK", playerName: "Raya" }, 
                { number: 4, name: "DF", playerName: "White" },
                { number: 2, name: "DF", playerName: "Saliba" },
                { number: 6, name: "DF", playerName: "Gabriel" },
                { number: 3, name: "DF", playerName: "Zinchenko" },
                { number: 8, name: "MF", playerName: "Ødegaard" },
                { number: 41, name: "MF", playerName: "Rice" },
                { number: 5, name: "MF", playerName: "Partey" },
                { number: 7, name: "FW", playerName: "Saka" },
                { number: 9, name: "FW", playerName: "Havertz" },
                { number: 11, name: "FW", playerName: "Martinelli" }
            ],
            visitor: [
                { number: 1, name: "GK", playerName: "Ter Stegen" }, 
                { number: 23, name: "DF", playerName: "Koundé" },
                { number: 4, name: "DF", playerName: "Araujo" },
                { number: 15, name: "DF", playerName: "Christensen" },
                { number: 3, name: "DF", playerName: "Balde" },
                { number: 8, name: "MF", playerName: "Pedri" },
                { number: 21, name: "MF", playerName: "De Jong" },
                { number: 22, name: "MF", playerName: "Gündoğan" },
                { number: 27, name: "FW", playerName: "Yamal" },
                { number: 9, name: "FW", playerName: "Lewandowski" },
                { number: 11, name: "FW", playerName: "Raphinha" }
            ]
        }
    }
};

// ── API ESPN (Proxies en Cascada sin Cache Buster agresivo) ───────────────────
async function fetchTeams(slug) {
    if (!slug || slug === "undefined") {
        throw new Error("Slug inválido o ausente en la configuración de ligas.");
    }

    if (teamsCache[slug]) return teamsCache[slug];
    
    // Eliminado el `_t=${Date.now()}` para permitir que los proxies cacheen y evitar errores 400
    const espnUrl = `${ESPN}/${slug}/teams?limit=100`;
    
    const proxies = [
        `https://api.allorigins.win/get?url=${encodeURIComponent(espnUrl)}`,
        `https://api.codetabs.com/v1/proxy/?quest=${encodeURIComponent(espnUrl)}`
    ];

    let data = null;
    let lastError = null;

    for (const proxyUrl of proxies) {
        try {
            const res = await fetch(proxyUrl);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            
            if (proxyUrl.includes('allorigins.win/get')) {
                const jsonRes = await res.json();
                if (!jsonRes.contents) throw new Error("AllOrigins no devolvió contents");
                data = JSON.parse(jsonRes.contents);
            } else {
                data = await res.json();
            }

            if (data && data.sports) break; 
        } catch (err) {
            lastError = err;
            data = null;
            console.warn(`Fallo en proxy: ${proxyUrl}. Intentando alternativa...`);
        }
    }

    if (!data) throw lastError || new Error("Todos los proxies fallaron al obtener equipos.");
    
    const raw = data?.sports?.[0]?.leagues?.[0]?.teams ?? [];
    
    const teams = raw.map(t => ({
        id:    t.team.id,
        name:  t.team.displayName,
        abbr:  t.team.abbreviation,
        logo:  t.team.logos?.[0]?.href ?? '',
        color: t.team.color ? `#${t.team.color}` : null,
        venue: t.team.venue?.fullName ?? '—',
    }));
    
    teamsCache[slug] = teams;
    return teams;
}

// ── RENDERIZADO ───────────────────────────────────────────────────────────────
const App = (() => {
    const elements = {
        dataDisplay: document.getElementById('data-display'),
        navButtons: document.querySelectorAll('#main-nav .nav-item')
    };

    // ── Cronología ────────────────────────────────────────────────────────────
    const renderLiveCommentary = () => {
        const timelineHTML = appData.match.timeline.map(item => `
            <div class="event">
                <span>${item.minute}'</span> — <strong>${item.player}</strong>: ${item.event}
            </div>
        `).join('');
        
        elements.dataDisplay.innerHTML = `
            <h3 class="section-header">Cronología del Partido</h3>
            <div class="timeline-container">
                ${timelineHTML}
            </div>
        `;
    };

    // ── Alineaciones 3D ───────────────────────────────────────────────────────
    
    const buildPitchPlayers = (players, isLocal) => {
        const positions = { GK: [], DF: [], MF: [], FW: [] };
        players.forEach(p => { if (positions[p.name]) positions[p.name].push(p); });

        const fill = isLocal ? "#f0f2f7" : "#c8102e";
        const stroke = isLocal ? "rgba(220,248,54,0.9)" : "rgba(255,255,255,0.7)";
        const textFill = isLocal ? "#080b11" : "#fff";

        const yMap = isLocal
            ? { GK: 278, DF: 245, MF: 215, FW: 190 } 
            : { GK: 78,  DF: 108, MF: 142, FW: 162 }; 

        let svgHTML = '';
        for (const [pos, posPlayers] of Object.entries(positions)) {
            const count = posPlayers.length;
            if (count === 0) continue;
            
            const cy = yMap[pos];
            const areaWidth = 240; 
            const startX = 280 - (areaWidth / 2);
            const spacing = areaWidth / (count + 1);

            posPlayers.forEach((p, idx) => {
                const cx = count === 1 ? 280 : startX + (spacing * (idx + 1));
                svgHTML += `
                    <circle cx="${cx}" cy="${cy}" r="12" fill="${fill}" stroke="${stroke}" stroke-width="1.8"/>
                    <text x="${cx}" y="${cy + 3}" text-anchor="middle" font-size="9" font-weight="900" fill="${textFill}" font-family="Inter,sans-serif">${p.number}</text>
                `;
            });
        }
        return svgHTML;
    };

    const buildPlayerList = (players) => {
        return players.map(p => `
            <div class="player-row">
                <span class="p-num">${p.number}</span>
                <span class="p-pos pos-${p.name.toLowerCase()}">${p.name}</span>
                <span class="p-name">${p.playerName || `Jugador ${p.number}`}</span>
                <span class="p-rating">-</span>
            </div>
        `).join('');
    };

    const renderLineups = () => {
        elements.dataDisplay.innerHTML = `
            <h2 class="sr-only">Vista de alineaciones: ${appData.match.teams.local} vs ${appData.match.teams.visitor}, ${appData.match.score.local}-${appData.match.score.visitor} en vivo</h2>
            <div class="root">
                <div class="match-header">
                    <div class="team-side">
                        <div class="team-badge badge-a">${appData.match.teams.local.substring(0,3).toUpperCase()}</div>
                        <div>
                            <div class="team-label">${appData.match.teams.local}</div>
                            <div style="font-size:.62rem;color:var(--text-muted);font-weight:600">4-3-3</div>
                        </div>
                    </div>
                    <div class="score-block">
                        <div class="score">${appData.match.score.local} — ${appData.match.score.visitor}</div>
                        <div class="match-status"><span class="live-dot"></span>${appData.match.minute}</div>
                    </div>
                    <div class="team-side right">
                        <div class="team-badge badge-b">${appData.match.teams.visitor.substring(0,3).toUpperCase()}</div>
                        <div>
                            <div class="team-label">${appData.match.teams.visitor}</div>
                            <div style="font-size:.62rem;color:var(--text-muted);font-weight:600">4-3-3</div>
                        </div>
                    </div>
                </div>

                <div class="pitch-wrap">
                    <svg class="pitch-svg" viewBox="0 0 560 340" xmlns="http://www.w3.org/2000/svg">
                        <defs>
                            <linearGradient id="gp" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stop-color="#1a5c20"/>
                                <stop offset="100%" stop-color="#0f3d14"/>
                            </linearGradient>
                            <pattern id="stripes" x="0" y="0" width="36" height="1" patternUnits="userSpaceOnUse" patternTransform="skewX(-30) scale(1,1)">
                                <rect width="18" height="1" fill="rgba(255,255,255,0.04)"/>
                            </pattern>
                        </defs>
                        <ellipse cx="280" cy="330" rx="230" ry="18" fill="#000" opacity=".35"/>
                        <polygon points="140,62 420,62 530,292 30,292" fill="url(#gp)"/>
                        <polygon points="140,62 420,62 530,292 30,292" fill="url(#stripes)"/>
                        <polygon points="140,62 420,62 530,292 30,292" fill="none" stroke="rgba(255,255,255,0.3)" stroke-width="1.5"/>
                        <line x1="30" y1="177" x2="530" y2="177" stroke="rgba(255,255,255,0.22)" stroke-width="1"/>
                        <ellipse cx="280" cy="177" rx="68" ry="22" fill="none" stroke="rgba(255,255,255,0.22)" stroke-width="1"/>
                        <circle cx="280" cy="177" r="2.5" fill="rgba(255,255,255,0.3)"/>
                        
                        <polygon points="193,62 367,62 385,118 175,118" fill="none" stroke="rgba(255,255,255,0.2)" stroke-width="1"/>
                        <polygon points="228,62 332,62 342,88 218,88" fill="none" stroke="rgba(255,255,255,0.18)" stroke-width="1"/>
                        <rect x="238" y="52" width="84" height="12" rx="1" fill="rgba(255,255,255,0.08)" stroke="rgba(255,255,255,0.2)" stroke-width="1"/>
                        <polygon points="175,236 385,236 367,292 193,292" fill="none" stroke="rgba(255,255,255,0.2)" stroke-width="1"/>
                        <polygon points="218,262 342,262 332,292 228,292" fill="none" stroke="rgba(255,255,255,0.18)" stroke-width="1"/>
                        <rect x="238" y="290" width="84" height="12" rx="1" fill="rgba(255,255,255,0.08)" stroke="rgba(255,255,255,0.2)" stroke-width="1"/>
                        <path d="M140,62 Q148,70 140,78" fill="none" stroke="rgba(255,255,255,0.18)" stroke-width="1"/>
                        <path d="M420,62 Q412,70 420,78" fill="none" stroke="rgba(255,255,255,0.18)" stroke-width="1"/>
                        <path d="M30,292 Q40,282 52,290" fill="none" stroke="rgba(255,255,255,0.18)" stroke-width="1"/>
                        <path d="M530,292 Q520,282 508,290" fill="none" stroke="rgba(255,255,255,0.18)" stroke-width="1"/>

                        ${buildPitchPlayers(appData.match.lineups.visitor, false)}
                        ${buildPitchPlayers(appData.match.lineups.local, true)}

                        <text x="75" y="100" text-anchor="middle" font-size="9" font-weight="800" fill="rgba(200,16,46,0.8)" font-family="Inter,sans-serif" letter-spacing="1">${appData.match.teams.visitor.substring(0,3).toUpperCase()}</text>
                        <text x="75" y="260" text-anchor="middle" font-size="9" font-weight="800" fill="rgba(220,248,54,0.8)" font-family="Inter,sans-serif" letter-spacing="1">${appData.match.teams.local.substring(0,3).toUpperCase()}</text>
                    </svg>
                </div>

                <div class="tabs">
                    <div class="tab active" data-target="panel-players">Jugadores</div>
                    <div class="tab" data-target="panel-stats">Estadísticas</div>
                    <div class="tab" data-target="panel-analysis">Análisis</div>
                </div>

                <div id="panel-players" style="display:block">
                    <div class="section-title">${appData.match.teams.local} · Titulares</div>
                    <div class="player-list" style="margin-bottom: 12px;">
                        ${buildPlayerList(appData.match.lineups.local)}
                    </div>
                    <div class="section-title">${appData.match.teams.visitor} · Titulares</div>
                    <div class="player-list">
                        ${buildPlayerList(appData.match.lineups.visitor)}
                    </div>
                </div>

                <div id="panel-stats" class="stats-section" style="display:none">
                    <div class="section-title">Comparativa del partido</div>
                    <div class="stat-row">
                        <div class="stat-bar-wrap">
                            <span class="stat-val right">58%</span>
                            <div class="bar-bg"><div class="bar-fill bar-a" style="width:58%"></div></div>
                        </div>
                        <div class="stat-label">Posesión</div>
                        <div class="stat-bar-wrap">
                            <div class="bar-bg"><div class="bar-fill bar-b" style="width:42%"></div></div>
                            <span class="stat-val">42%</span>
                        </div>
                    </div>
                    <div class="stat-row">
                        <div class="stat-bar-wrap">
                            <span class="stat-val right">7</span>
                            <div class="bar-bg"><div class="bar-fill bar-a" style="width:58%"></div></div>
                        </div>
                        <div class="stat-label">Remates</div>
                        <div class="stat-bar-wrap">
                            <div class="bar-bg"><div class="bar-fill bar-b" style="width:50%"></div></div>
                            <span class="stat-val">6</span>
                        </div>
                    </div>
                </div>

                <div id="panel-analysis" style="display:none">
                    <div class="section-title">Análisis táctico</div>
                    <div class="analysis-grid">
                        <div class="analysis-card">
                            <div class="a-card-val trend-neutral">1.82</div>
                            <div class="a-card-label">xG ${appData.match.teams.local}</div>
                            <div class="a-card-sub">Supera el xG esperado para este partido</div>
                        </div>
                        <div class="analysis-card">
                            <div class="a-card-val trend-down">0.94</div>
                            <div class="a-card-label">xG ${appData.match.teams.visitor}</div>
                            <div class="a-card-sub">Por debajo del promedio histórico</div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        const tabs = elements.dataDisplay.querySelectorAll('.tab');
        tabs.forEach(tab => {
            tab.addEventListener('click', (e) => {
                tabs.forEach(t => t.classList.remove('active'));
                e.target.classList.add('active');
                const targetId = e.target.getAttribute('data-target');
                ['panel-stats', 'panel-analysis', 'panel-players'].forEach(p => {
                    document.getElementById(p).style.display = p === targetId ? 'block' : 'none';
                });
            });
        });
    };

    // ── Listado de ligas ──────────────────────────────────────────────────────
    const renderLeagues = () => {
        const html = appData.leagues.map(league => `
            <div class="league-card" data-slug="${league.slug}" data-name="${league.name}">
                <div class="league-card-header">
                    <span class="league-flag">${league.flag}</span>
                    <span class="league-country">${league.country}</span>
                </div>
                <h4>${league.name}</h4>
            </div>
        `).join('');
        
        elements.dataDisplay.innerHTML = `
            <h3 class="section-header">Ligas</h3>
            <div class="leagues-grid">${html}</div>
        `;

        elements.dataDisplay.querySelectorAll('.league-card').forEach(card => {
            card.addEventListener('click', () => 
                renderLeagueTeams(card.dataset.slug, card.dataset.name)
            );
        });
    };

    // ── Equipos de una liga ───────────────────────────────────────────────────
    const renderLeagueTeams = async (slug, leagueName) => {
        elements.dataDisplay.innerHTML = `
            <div class="back-header">
                <button class="btn-back" id="btn-back">← Volver</button>
                <h3 class="section-header">${leagueName} · Equipos</h3>
            </div>
            <div class="teams-grid">
                ${Array(12).fill('<div class="skeleton"></div>').join('')}
            </div>
        `;
        
        document.getElementById('btn-back').addEventListener('click', renderLeagues);
        
        try {
            const teams = await fetchTeams(slug);
            
            // PROTECCIÓN CONTRA RACE CONDITION DEL DOM
            const grid = elements.dataDisplay.querySelector('.teams-grid');
            if (!grid) return; 

            if (!teams.length) {
                grid.innerHTML = `<div class="empty-msg">No se encontraron equipos en esta liga.</div>`;
                return;
            }
            
            grid.innerHTML = teams.map(team => `
                <div class="team-card">
                    ${team.logo 
                        ? `<img src="${team.logo}" alt="${team.name}" class="team-logo">` 
                        : `<div class="team-logo" style="background:var(--border);border-radius:50%"></div>`
                    }
                    <div class="team-info">
                        <span class="team-name">${team.name}</span>
                        <span class="team-venue">${team.venue}</span>
                    </div>
                </div>
            `).join('');
        } catch (err) {
            console.error(slug, err);
            const grid = elements.dataDisplay.querySelector('.teams-grid');
            if (grid) {
                grid.innerHTML = `<div class="empty-msg">No se pudo cargar esta liga. ESPN no devolvió datos o el proxy falló.</div>`;
            }
        }
    };

    // ── Router ────────────────────────────────────────────────────────────────
    const getRequiredTier = (view) => ({ live: 5, lineups: 10, leagues: 0 }[view] ?? 0);

    const setActiveNav = (viewType) => {
        elements.navButtons.forEach(btn => 
            btn.classList.toggle('active', btn.dataset.view === viewType)
        );
    };

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
        elements.navButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const button = e.target.closest('.nav-item');
                if (!button) return;
                setActiveNav(button.dataset.view);
                renderView(button.dataset.view);
            });
        });
        
        renderView('leagues');
    };

    return { init };
})();

document.addEventListener('DOMContentLoaded', App.init);
