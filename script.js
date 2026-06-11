/**
 * script.js - Lógica principal de "El Fulbo"
 * API: ESPN pública con sistema de proxies en cascada y cache buster.
 */

const ESPN = 'https://site.api.espn.com/apis/site/v2/sports/soccer';

const LEAGUES = {
    // ── EUROPA TOP 5 ─────────────────────────────
    PREMIER_LEAGUE:    { slug: 'eng.1',              name: "Premier League",      country: "England",     flag: "🏴󠁧󠁢󠁥󠁮󠁧󠁿" },
    BUNDESLIGA:        { slug: 'ger.1',              name: "Bundesliga",          country: "Germany",     flag: "🇩🇪" },
    SERIE_A:           { slug: 'ita.1',              name: "Serie A",             country: "Italy",       flag: "🇮🇹" },
    LIGUE_1:           { slug: 'fra.1',              name: "Ligue 1",             country: "France",      flag: "🇫🇷" },
    LA_LIGA:           { slug: 'esp.1',              name: "La Liga",             country: "Spain",       flag: "🇪🇸" },
    // ── EUROPA OTRAS ─────────────────────────────
    EREDIVISIE:        { slug: 'ned.1',              name: "Eredivisie",          country: "Netherlands", flag: "🇳🇱" },
    PRIMEIRA_LIGA:     { slug: 'por.1',              name: "Primeira Liga",       country: "Portugal",    flag: "🇵🇹" },
    // ── COPAS INGLESAS ───────────────────────────
    CARABAO_CUP:       { slug: 'eng.league_cup',     name: "Carabao Cup",         country: "England",     flag: "🏴󠁧󠁢󠁥󠁮󠁧󠁿" },
    FA_CUP:            { slug: 'eng.fa',             name: "FA Cup",              country: "England",     flag: "🏴󠁧󠁢󠁥󠁮󠁧󠁿" },
    // ── UEFA ─────────────────────────────────────
    CHAMPIONS_LEAGUE:  { slug: 'uefa.champions',     name: "Champions League",    country: "Europe",      flag: "🇪🇺" },
    EUROPA_LEAGUE:     { slug: 'uefa.europa',        name: "Europa League",       country: "Europe",      flag: "🇪🇺" },
    CONFERENCE_LEAGUE: { slug: 'uefa.europa.conf',   name: "Conference League",   country: "Europe",      flag: "🇪🇺" },
    UEFA_SUPER_CUP:    { slug: 'uefa.super_cup',     name: "UEFA Super Cup",      country: "Europe",      flag: "🇪🇺" },
    // ── MUNDIAL ───────────────────────────────────
    WORLD_CUP:         { slug: 'fifa.world',         name: "FIFA World Cup",      country: "World",       flag: "🌍" },
    FRIENDLIES_INTL:   { slug: 'fifa.friendly',      name: "Amistosos Pre-Mundial", country: "World",     flag: "🌍" },
    // ── CONMEBOL ─────────────────────────────────
    COPA_LIBERTADORES: { slug: 'conmebol.libertadores', name: "Copa Libertadores", country: "CONMEBOL",   flag: "🌎" },
    COPA_SUDAMERICANA: { slug: 'conmebol.sudamericana', name: "Copa Sudamericana", country: "CONMEBOL",   flag: "🌎" },
    // ── ARGENTINA ────────────────────────────────
    LIGA_PROFESIONAL:  { slug: 'arg.1',              name: "Liga Profesional",    country: "Argentina",   flag: "🇦🇷" },
    COPA_ARGENTINA:    { slug: 'arg.copa',           name: "Copa Argentina",      country: "Argentina",   flag: "🇦🇷" },
    // ── BRASIL ───────────────────────────────────
    BRASILEIRAO:       { slug: 'bra.1',              name: "Brasileirao",         country: "Brazil",      flag: "🇧🇷" },
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
        ]
    }
};

// ── API ESPN ──────────────────────────────────────────────────────────────────
async function fetchTeams(slug) {
    if (teamsCache[slug]) return teamsCache[slug];
    
    const espnUrl = `${ESPN}/${slug}/teams?limit=100&_t=${Date.now()}`;
    const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(espnUrl)}`;
    
    const res = await fetch(proxyUrl);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    
    const data = JSON.parse((await res.json()).contents);
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
    const renderLineups = () => {
        elements.dataDisplay.innerHTML = `
            <h2 class="sr-only">Vista de alineaciones: ${appData.match.teams.local} vs ${appData.match.teams.visitor}, ${appData.match.score.local}-${appData.match.score.visitor} en vivo</h2>
            <div class="root">
                <div class="match-header">
                    <div class="team-side">
                        <div class="team-badge badge-a">ARS</div>
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
                        <div class="team-badge badge-b">FCB</div>
                        <div>
                            <div class="team-label">${appData.match.teams.visitor}</div>
                            <div style="font-size:.62rem;color:var(--text-muted);font-weight:600">4-3-3</div>
                        </div>
                    </div>
                </div>

                <div class="formation-row">
                    <span class="formation-label">Formación</span>
                    <div class="formation-pills">
                        <div class="pill active">4-3-3</div>
                        <div class="pill">4-4-2</div>
                        <div class="pill">3-5-2</div>
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

                        <circle cx="280" cy="78" r="12" fill="#c8102e" stroke="rgba(255,255,255,0.7)" stroke-width="1.5"/>
                        <text x="280" y="82" text-anchor="middle" font-size="9" font-weight="900" fill="#fff" font-family="Inter,sans-serif">1</text>
                        <circle cx="170" cy="108" r="12" fill="#c8102e" stroke="rgba(255,255,255,0.7)" stroke-width="1.5"/>
                        <text x="170" y="112" text-anchor="middle" font-size="9" font-weight="900" fill="#fff" font-family="Inter,sans-serif">23</text>
                        <circle cx="228" cy="103" r="12" fill="#c8102e" stroke="rgba(255,255,255,0.7)" stroke-width="1.5"/>
                        <text x="228" y="107" text-anchor="middle" font-size="9" font-weight="900" fill="#fff" font-family="Inter,sans-serif">3</text>
                        <circle cx="332" cy="103" r="12" fill="#c8102e" stroke="rgba(255,255,255,0.7)" stroke-width="1.5"/>
                        <text x="332" y="107" text-anchor="middle" font-size="9" font-weight="900" fill="#fff" font-family="Inter,sans-serif">15</text>
                        <circle cx="390" cy="108" r="12" fill="#c8102e" stroke="rgba(255,255,255,0.7)" stroke-width="1.5"/>
                        <text x="390" y="112" text-anchor="middle" font-size="9" font-weight="900" fill="#fff" font-family="Inter,sans-serif">2</text>
                        <circle cx="200" cy="142" r="12" fill="#c8102e" stroke="rgba(255,255,255,0.7)" stroke-width="1.5"/>
                        <text x="200" y="146" text-anchor="middle" font-size="9" font-weight="900" fill="#fff" font-family="Inter,sans-serif">8</text>
                        <circle cx="280" cy="138" r="12" fill="#c8102e" stroke="rgba(255,255,255,0.7)" stroke-width="1.5"/>
                        <text x="280" y="142" text-anchor="middle" font-size="9" font-weight="900" fill="#fff" font-family="Inter,sans-serif">6</text>
                        <circle cx="360" cy="142" r="12" fill="#c8102e" stroke="rgba(255,255,255,0.7)" stroke-width="1.5"/>
                        <text x="360" y="146" text-anchor="middle" font-size="9" font-weight="900" fill="#fff" font-family="Inter,sans-serif">4</text>
                        <circle cx="185" cy="162" r="12" fill="#c8102e" stroke="rgba(255,255,255,0.7)" stroke-width="1.5"/>
                        <text x="185" y="166" text-anchor="middle" font-size="9" font-weight="900" fill="#fff" font-family="Inter,sans-serif">11</text>
                        <circle cx="280" cy="160" r="12" fill="#c8102e" stroke="rgba(255,255,255,0.7)" stroke-width="1.5"/>
                        <text x="280" y="164" text-anchor="middle" font-size="9" font-weight="900" fill="#fff" font-family="Inter,sans-serif">9</text>
                        <circle cx="375" cy="162" r="12" fill="#c8102e" stroke="rgba(255,255,255,0.7)" stroke-width="1.5"/>
                        <text x="375" y="166" text-anchor="middle" font-size="9" font-weight="900" fill="#fff" font-family="Inter,sans-serif">7</text>

                        <circle cx="180" cy="192" r="12" fill="#f0f2f7" stroke="rgba(220,248,54,0.9)" stroke-width="1.8"/>
                        <text x="180" y="196" text-anchor="middle" font-size="9" font-weight="900" fill="#080b11" font-family="Inter,sans-serif">19</text>
                        <circle cx="280" cy="190" r="12" fill="#f0f2f7" stroke="rgba(220,248,54,0.9)" stroke-width="1.8"/>
                        <text x="280" y="194" text-anchor="middle" font-size="9" font-weight="900" fill="#080b11" font-family="Inter,sans-serif">9</text>
                        <circle cx="380" cy="192" r="12" fill="#f0f2f7" stroke="rgba(220,248,54,0.9)" stroke-width="1.8"/>
                        <text x="380" y="196" text-anchor="middle" font-size="9" font-weight="900" fill="#080b11" font-family="Inter,sans-serif">7</text>
                        <circle cx="193" cy="218" r="12" fill="#f0f2f7" stroke="rgba(220,248,54,0.9)" stroke-width="1.8"/>
                        <text x="193" y="222" text-anchor="middle" font-size="9" font-weight="900" fill="#080b11" font-family="Inter,sans-serif">8</text>
                        <circle cx="280" cy="215" r="12" fill="#f0f2f7" stroke="rgba(220,248,54,0.9)" stroke-width="1.8"/>
                        <text x="280" y="219" text-anchor="middle" font-size="9" font-weight="900" fill="#080b11" font-family="Inter,sans-serif">35</text>
                        <circle cx="367" cy="218" r="12" fill="#f0f2f7" stroke="rgba(220,248,54,0.9)" stroke-width="1.8"/>
                        <text x="367" y="222" text-anchor="middle" font-size="9" font-weight="900" fill="#080b11" font-family="Inter,sans-serif">41</text>
                        <circle cx="148" cy="248" r="12" fill="#f0f2f7" stroke="rgba(220,248,54,0.9)" stroke-width="1.8"/>
                        <text x="148" y="252" text-anchor="middle" font-size="9" font-weight="900" fill="#080b11" font-family="Inter,sans-serif">35</text>
                        <circle cx="226" cy="242" r="12" fill="#f0f2f7" stroke="rgba(220,248,54,0.9)" stroke-width="1.8"/>
                        <text x="226" y="246" text-anchor="middle" font-size="9" font-weight="900" fill="#080b11" font-family="Inter,sans-serif">6</text>
                        <circle cx="334" cy="242" r="12" fill="#f0f2f7" stroke="rgba(220,248,54,0.9)" stroke-width="1.8"/>
                        <text x="334" y="246" text-anchor="middle" font-size="9" font-weight="900" fill="#080b11" font-family="Inter,sans-serif">12</text>
                        <circle cx="412" cy="248" r="12" fill="#f0f2f7" stroke="rgba(220,248,54,0.9)" stroke-width="1.8"/>
                        <text x="412" y="252" text-anchor="middle" font-size="9" font-weight="900" fill="#080b11" font-family="Inter,sans-serif">2</text>
                        <circle cx="280" cy="278" r="12" fill="#f0f2f7" stroke="rgba(220,248,54,0.9)" stroke-width="1.8"/>
                        <text x="280" y="282" text-anchor="middle" font-size="9" font-weight="900" fill="#080b11" font-family="Inter,sans-serif">1</text>

                        <text x="75" y="100" text-anchor="middle" font-size="9" font-weight="800" fill="rgba(200,16,46,0.8)" font-family="Inter,sans-serif" letter-spacing="1">FCB</text>
                        <text x="75" y="260" text-anchor="middle" font-size="9" font-weight="800" fill="rgba(220,248,54,0.8)" font-family="Inter,sans-serif" letter-spacing="1">ARS</text>
                    </svg>
                </div>

                <div class="tabs">
                    <div class="tab active" data-target="panel-stats">Estadísticas</div>
                    <div class="tab" data-target="panel-analysis">Análisis</div>
                    <div class="tab" data-target="panel-players">Jugadores</div>
                </div>

                <div id="panel-stats" class="stats-section">
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
                    <div class="stat-row">
                        <div class="stat-bar-wrap">
                            <span class="stat-val right">4</span>
                            <div class="bar-bg"><div class="bar-fill bar-a" style="width:67%"></div></div>
                        </div>
                        <div class="stat-label">Al arco</div>
                        <div class="stat-bar-wrap">
                            <div class="bar-bg"><div class="bar-fill bar-b" style="width:33%"></div></div>
                            <span class="stat-val">2</span>
                        </div>
                    </div>
                    <div class="stat-row">
                        <div class="stat-bar-wrap">
                            <span class="stat-val right">412</span>
                            <div class="bar-bg"><div class="bar-fill bar-a" style="width:55%"></div></div>
                        </div>
                        <div class="stat-label">Pases</div>
                        <div class="stat-bar-wrap">
                            <div class="bar-bg"><div class="bar-fill bar-b" style="width:45%"></div></div>
                            <span class="stat-val">338</span>
                        </div>
                    </div>
                    <div class="stat-row">
                        <div class="stat-bar-wrap">
                            <span class="stat-val right">88%</span>
                            <div class="bar-bg"><div class="bar-fill bar-a" style="width:88%"></div></div>
                        </div>
                        <div class="stat-label">Precisión</div>
                        <div class="stat-bar-wrap">
                            <div class="bar-bg"><div class="bar-fill bar-b" style="width:83%"></div></div>
                            <span class="stat-val">83%</span>
                        </div>
                    </div>
                    <div class="stat-row">
                        <div class="stat-bar-wrap">
                            <span class="stat-val right">14</span>
                            <div class="bar-bg"><div class="bar-fill bar-a" style="width:47%"></div></div>
                        </div>
                        <div class="stat-label">Faltas</div>
                        <div class="stat-bar-wrap">
                            <div class="bar-bg"><div class="bar-fill bar-b" style="width:53%"></div></div>
                            <span class="stat-val">16</span>
                        </div>
                    </div>
                </div>

                <div id="panel-analysis" style="display:none">
                    <div class="section-title">Análisis táctico</div>
                    <div class="analysis-grid">
                        <div class="analysis-card">
                            <div class="a-card-val trend-up">+34%</div>
                            <div class="a-card-label">Presión alta</div>
                            <div class="a-card-sub">Arsenal domina la presión en los últimos 20 min</div>
                        </div>
                        <div class="analysis-card">
                            <div class="a-card-val trend-neutral">1.82</div>
                            <div class="a-card-label">xG Arsenal</div>
                            <div class="a-card-sub">Supera el xG esperado (1.4) para este partido</div>
                        </div>
                        <div class="analysis-card">
                            <div class="a-card-val trend-down">0.94</div>
                            <div class="a-card-label">xG Barcelona</div>
                            <div class="a-card-sub">Por debajo del promedio histórico de 1.6</div>
                        </div>
                        <div class="analysis-card">
                            <div class="a-card-val" style="color:#3b82f6">7.4</div>
                            <div class="a-card-label">PPDA Arsenal</div>
                            <div class="a-card-sub">Presión efectiva — menos pases permitidos</div>
                        </div>
                        <div class="analysis-card">
                            <div class="a-card-val trend-up">63%</div>
                            <div class="a-card-label">Banda izq.</div>
                            <div class="a-card-sub">Arsenal construye la mayoría por el lado izquierdo</div>
                        </div>
                        <div class="analysis-card">
                            <div class="a-card-val trend-neutral">4.2</div>
                            <div class="a-card-label">Duelos / min</div>
                            <div class="a-card-sub">Partido físico por encima del promedio UCL</div>
                        </div>
                    </div>
                    <div class="section-title" style="margin-top:14px">Línea de tiempo xG</div>
                    <div style="background:var(--bg-card);border:1px solid var(--border);border-radius:8px;padding:12px;position:relative;height:64px">
                        <svg width="100%" height="100%" viewBox="0 0 500 50" preserveAspectRatio="none" style="overflow:visible">
                            <polyline points="0,50 80,50 120,38 160,38 200,28 240,28 280,22 320,15 360,15 400,12 500,10" fill="none" stroke="var(--accent)" stroke-width="2" stroke-linejoin="round"/>
                            <polyline points="0,50 80,42 120,42 160,42 200,35 240,35 280,32 320,32 360,28 400,28 500,28" fill="none" stroke="#c8102e" stroke-width="2" stroke-linejoin="round"/>
                            <circle cx="200" cy="28" r="4" fill="var(--accent)"/>
                            <circle cx="280" cy="32" r="4" fill="#c8102e"/>
                            <circle cx="320" cy="15" r="4" fill="var(--accent)"/>
                            <text x="198" y="22" font-size="7" fill="var(--accent)" font-family="Inter,sans-serif" text-anchor="middle">⚽</text>
                            <text x="278" y="26" font-size="7" fill="#f04b5a" font-family="Inter,sans-serif" text-anchor="middle">⚽</text>
                            <text x="318" y="9" font-size="7" fill="var(--accent)" font-family="Inter,sans-serif" text-anchor="middle">⚽</text>
                        </svg>
                        <div style="position:absolute;bottom:6px;right:8px;display:flex;gap:10px">
                            <span style="font-size:.58rem;color:var(--accent);font-weight:700">— ARS</span>
                            <span style="font-size:.58rem;color:#c8102e;font-weight:700">— FCB</span>
                        </div>
                    </div>
                </div>

                <div id="panel-players" style="display:none">
                    <div class="section-title">Arsenal · titulares</div>
                    <div class="player-list">
                        <div class="player-row"><span class="p-num">1</span><span class="p-pos pos-gk">GK</span><span class="p-name">Raya</span><span class="p-rating">7.2</span></div>
                        <div class="player-row"><span class="p-num">2</span><span class="p-pos pos-df">DF</span><span class="p-name">Ben White</span><span class="p-rating">7.0</span></div>
                        <div class="player-row"><span class="p-num">6</span><span class="p-pos pos-df">DF</span><span class="p-name">Gabriel</span><span class="p-rating">7.5</span></div>
                        <div class="player-row"><span class="p-num">12</span><span class="p-pos pos-df">DF</span><span class="p-name">Saliba</span><span class="p-rating">8.1</span></div>
                        <div class="player-row"><span class="p-num">35</span><span class="p-pos pos-df">DF</span><span class="p-name">Zinchenko</span><span class="p-rating">6.9</span></div>
                        <div class="player-row"><span class="p-num">8</span><span class="p-pos pos-mf">MF</span><span class="p-name">Ødegaard</span><span class="p-rating">8.4</span></div>
                        <div class="player-row"><span class="p-num">35</span><span class="p-pos pos-mf">MF</span><span class="p-name">Jorginho</span><span class="p-rating">7.1</span></div>
                        <div class="player-row"><span class="p-num">41</span><span class="p-pos pos-mf">MF</span><span class="p-name">Rice</span><span class="p-rating">8.6</span></div>
                        <div class="player-row"><span class="p-num">7</span><span class="p-pos pos-fw">FW</span><span class="p-name">Saka</span><span class="p-rating">8.9</span></div>
                        <div class="player-row"><span class="p-num">9</span><span class="p-pos pos-fw">FW</span><span class="p-name">Havertz</span><span class="p-rating">7.8</span></div>
                        <div class="player-row"><span class="p-num">19</span><span class="p-pos pos-fw">FW</span><span class="p-name">Trossard</span><span class="p-rating">7.4</span></div>
                    </div>
                </div>
            </div>
        `;

        // Delegación de eventos locales para los tabs
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

        // Delegación de eventos locales para las pastillas de formación
        const pills = elements.dataDisplay.querySelectorAll('.pill');
        pills.forEach(pill => {
            pill.addEventListener('click', function() {
                pills.forEach(p => p.classList.remove('active'));
                this.classList.add('active');
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
        // Skeleton mientras carga
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
            if (!teams.length) {
                elements.dataDisplay.querySelector('.teams-grid').innerHTML = `
                    <div class="empty-msg">No se encontraron equipos.</div>
                `;
                return;
            }
            
            elements.dataDisplay.querySelector('.teams-grid').innerHTML = teams.map(team => `
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
            elements.dataDisplay.querySelector('.teams-grid').innerHTML = `
                <div class="empty-msg">No se pudo cargar esta liga. Puede que ESPN no la tenga disponible.</div>
            `;
            console.error(slug, err);
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
        
        // Carga inicial
        renderView('leagues');
    };

    return { init };
})();

document.addEventListener('DOMContentLoaded', App.init);
