/**
 * script.js - Lógica principal de "El Fulbo"
 * API: ESPN pública (sin key, sin límites, sin restricción de temporada)
 */

const ESPN = 'https://site.api.espn.com/apis/site/v2/sports/soccer';

// Cada liga tiene un "slug" que ESPN usa en la URL
const LEAGUES = {
    // ── EUROPA TOP 5 ─────────────────────────────
    PREMIER_LEAGUE:    { slug: 'eng.1',              name: "Premier League",       country: "England",     flag: "🏴󠁧󠁢󠁥󠁮󠁧󠁿" },
    BUNDESLIGA:        { slug: 'ger.1',              name: "Bundesliga",            country: "Germany",     flag: "🇩🇪" },
    SERIE_A:           { slug: 'ita.1',              name: "Serie A",               country: "Italy",       flag: "🇮🇹" },
    LIGUE_1:           { slug: 'fra.1',              name: "Ligue 1",               country: "France",      flag: "🇫🇷" },
    LA_LIGA:           { slug: 'esp.1',              name: "La Liga",               country: "Spain",       flag: "🇪🇸" },
    // ── EUROPA OTRAS ─────────────────────────────
    EREDIVISIE:        { slug: 'ned.1',              name: "Eredivisie",            country: "Netherlands", flag: "🇳🇱" },
    PRIMEIRA_LIGA:     { slug: 'por.1',              name: "Primeira Liga",         country: "Portugal",    flag: "🇵🇹" },
    // ── COPAS INGLESAS ───────────────────────────
    CARABAO_CUP:       { slug: 'eng.league_cup',     name: "Carabao Cup",           country: "England",     flag: "🏴󠁧󠁢󠁥󠁮󠁧󠁿" },
    FA_CUP:            { slug: 'eng.fa',             name: "FA Cup",                country: "England",     flag: "🏴󠁧󠁢󠁥󠁮󠁧󠁿" },
    // ── UEFA ─────────────────────────────────────
    CHAMPIONS_LEAGUE:  { slug: 'uefa.champions',     name: "Champions League",      country: "Europe",      flag: "🇪🇺" },
    EUROPA_LEAGUE:     { slug: 'uefa.europa',        name: "Europa League",         country: "Europe",      flag: "🇪🇺" },
    CONFERENCE_LEAGUE: { slug: 'uefa.europa.conf',   name: "Conference League",     country: "Europe",      flag: "🇪🇺" },
    UEFA_SUPER_CUP:    { slug: 'uefa.super_cup',     name: "UEFA Super Cup",        country: "Europe",      flag: "🇪🇺" },
    // ── MUNDIAL ───────────────────────────────────
    WORLD_CUP:         { slug: 'fifa.world',         name: "FIFA World Cup",        country: "World",       flag: "🌍" },
    FRIENDLIES_INTL:   { slug: 'fifa.friendly',      name: "Amistosos Pre-Mundial", country: "World",       flag: "🌍" },
    // ── CONMEBOL ─────────────────────────────────
    COPA_LIBERTADORES: { slug: 'conmebol.libertadores', name: "Copa Libertadores",  country: "CONMEBOL",    flag: "🌎" },
    COPA_SUDAMERICANA: { slug: 'conmebol.sudamericana', name: "Copa Sudamericana",  country: "CONMEBOL",    flag: "🌎" },
    // ── ARGENTINA ────────────────────────────────
    LIGA_PROFESIONAL:  { slug: 'arg.1',              name: "Liga Profesional",      country: "Argentina",   flag: "🇦🇷" },
    COPA_ARGENTINA:    { slug: 'arg.copa',           name: "Copa Argentina",        country: "Argentina",   flag: "🇦🇷" },
    // ── BRASIL ───────────────────────────────────
    BRASILEIRAO:       { slug: 'bra.1',              name: "Brasileirao",           country: "Brazil",      flag: "🇧🇷" },
};

// Cache para no repetir llamadas
const teamsCache = {};

const appData = {
    user: { subscriptionLevel: 10 },
    leagues: Object.values(LEAGUES),
    match: {
        teams: { local: "Arsenal", visitor: "FCB" },
        score: { local: 2, visitor: 1 },
        timeline: [
            { minute: 28, event: "Yellow Card", player: "Gibbs" },
            { minute: 32, event: "Goal",        player: "Messi" },
            { minute: 48, event: "Injured",     player: "Neymar" },
            { minute: 62, event: "Goal",        player: "Sánchez" }
        ],
        lineups: {
            local: [
                { number: 1,  name: "GK" }, { number: 9,  name: "FW" },
                { number: 18, name: "MF" }, { number: 17, name: "MF" },
                { number: 5,  name: "DF" }
            ],
            visitor: [
                { number: 1,  name: "GK" }, { number: 8,  name: "DF" },
                { number: 21, name: "DF" }, { number: 13, name: "DF" },
                { number: 3,  name: "DF" }
            ]
        }
    }
};

// ── API ESPN ──────────────────────────────────────────────────────────────────

// Fetch con timeout
async function fetchWithTimeout(url, ms = 8000) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), ms);
    try {
        const res = await fetch(url, { signal: controller.signal });
        clearTimeout(timer);
        return res;
    } catch (err) {
        clearTimeout(timer);
        throw err;
    }
}

// Proxies en cascada — si uno falla prueba el siguiente
async function fetchViaProxy(targetUrl) {
    const proxies = [
        async (url) => {
            const res = await fetchWithTimeout(`https://api.codetabs.com/v1/proxy/?quest=${encodeURIComponent(url)}`);
            if (!res.ok) throw new Error(`CodeTabs ${res.status}`);
            return res.json();
        },
        async (url) => {
            const res = await fetchWithTimeout(`https://corsfix.com/${encodeURIComponent(url)}`);
            if (!res.ok) throw new Error(`Corsfix ${res.status}`);
            return res.json();
        },
        async (url) => {
            const res = await fetchWithTimeout(`https://api.allorigins.win/get?url=${encodeURIComponent(url)}`);
            if (!res.ok) throw new Error(`AllOrigins ${res.status}`);
            const wrapper = await res.json();
            return JSON.parse(wrapper.contents);
        },
    ];

    for (const proxy of proxies) {
        try {
            return await proxy(targetUrl);
        } catch (err) {
            console.warn('Proxy falló, probando el siguiente...', err.message);
        }
    }
    throw new Error('Todos los proxies fallaron');
}

async function fetchTeams(slug) {
    if (teamsCache[slug]) return teamsCache[slug];

    const espnUrl = `${ESPN}/${slug}/teams?limit=100`;
    const data = await fetchViaProxy(espnUrl);


    // ESPN anida los equipos en data.sports[0].leagues[0].teams
    const raw = data?.sports?.[0]?.leagues?.[0]?.teams ?? [];
    const teams = raw.map(t => ({
        id:     t.team.id,
        name:   t.team.displayName,
        abbr:   t.team.abbreviation,
        logo:   t.team.logos?.[0]?.href ?? '',
        color:  t.team.color ? `#${t.team.color}` : null,
        venue:  t.team.venue?.fullName ?? '—',
    }));

    teamsCache[slug] = teams;
    return teams;
}

// ── RENDERIZADO ───────────────────────────────────────────────────────────────

const App = (() => {
    const elements = {
        dataDisplay: document.getElementById('data-display'),
        navButtons:  document.querySelectorAll('#bottom-nav .nav-item')
    };

    // ── Cronología ────────────────────────────────────────────────────────────
    const renderLiveCommentary = () => {
        const timelineHTML = appData.match.timeline.map(item => `
            <div class="event">
                <span>${item.minute}'</span> — <strong>${item.player}</strong>: ${item.event}
            </div>
        `).join('');
        elements.dataDisplay.innerHTML = `
            <p class="section-header">Cronología del Partido</p>
            <div class="timeline-container">${timelineHTML}</div>
        `;
    };

    // ── Alineaciones ─────────────────────────────────────────────────────────
    const buildFormationHTML = (teamArray, type) => {
        return ['GK','DF','MF','FW'].map(pos => {
            const line = teamArray.filter(p => p.name === pos);
            if (!line.length) return '';
            return `<div class="formation-row">${
                line.map(p => `<div class="player ${type}">${p.number}</div>`).join('')
            }</div>`;
        }).join('');
    };

    const renderLineups = () => {
        elements.dataDisplay.innerHTML = `
            <p class="section-header">Alineaciones</p>
            <div class="pitch">
                <div class="team-visitor">${buildFormationHTML(appData.match.lineups.visitor, 'visitor')}</div>
                <div class="center-circle"></div>
                <div class="center-line"></div>
                <div class="team-local">${buildFormationHTML(appData.match.lineups.local, 'local')}</div>
            </div>
        `;
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
            <p class="section-header">Ligas</p>
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
                <p class="section-header">${leagueName} · Equipos</p>
            </div>
            <div class="teams-grid">
                ${Array(12).fill('<div class="skeleton"></div>').join('')}
            </div>
        `;
        document.getElementById('btn-back').addEventListener('click', renderLeagues);

        try {
            const teams = await fetchTeams(slug);

            if (!teams.length) {
                elements.dataDisplay.querySelector('.teams-grid').innerHTML =
                    `<p class="empty-msg">No se encontraron equipos.</p>`;
                return;
            }

            elements.dataDisplay.querySelector('.teams-grid').innerHTML =
                teams.map(team => `
                    <div class="team-card">
                        ${team.logo
                            ? `<img class="team-logo" src="${team.logo}" alt="${team.name}" loading="lazy" onerror="this.style.opacity='0.15'">`
                            : `<div class="team-logo-placeholder"></div>`
                        }
                        <div class="team-info">
                            <span class="team-name">${team.name}</span>
                            <span class="team-venue">${team.venue}</span>
                        </div>
                    </div>
                `).join('');

        } catch (err) {
            elements.dataDisplay.querySelector('.teams-grid').innerHTML =
                `<p class="empty-msg error-msg">No se pudo cargar esta liga.<br>Puede que ESPN no la tenga disponible.</p>`;
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
                </div>`;
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
