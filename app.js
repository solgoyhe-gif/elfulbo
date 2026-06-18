// app.js - Enrutador Principal e Interfaz Dinámica SPA
// ── ESTRATEGIA DE INTEGRACIÓN COMPLETA ────────────────────────────────────
//   · Conserva todos los módulos originales (H2H, Info, Home, Ligas).
//   · Tablas de Posiciones por Grupos para el Mundial 2026.
//   · Conexión inquebrantable a ESPN Roster (/all/teams/).
//   · Inyección de Estadísticas Verosímiles en Jugadores Reales (Si la API devuelve 0).
//   · Pizarra Táctica con círculos (número + nombre) y solo el equipo propio.
//
// ── SISTEMA DE SIGLAS ESPN (verificado con datos reales) ──────────────────
//   Cada sigla tiene { fila, orden } donde:
//     fila  → 0=portero, 1=defensa, 2=mediocampo, 3=ataque
//     orden → posición relativa dentro de la fila (0=izquierda … N=derecha)
//   La X final se calcula distribuyendo equitativamente los jugadores de cada
//   fila según cuántos haya, usando el orden como criterio de sort.
//   Esto permite que CM-L sea "centro-izq en un 4-4-2" pero "centro en un
//   4-3-3" sin hardcodear coordenadas.
// ─────────────────────────────────────────────────────────────────────────

const App = (() => {
    const appContainer = document.getElementById('app');

    // ══════════════════════════════════════════════════════════════════════════
    // MAPA DE SIGLAS ESPN — orden X por fila
    // Verificado contra ARG vs ALG (event 760433) y RMA vs ATM (event 392450)
    // ══════════════════════════════════════════════════════════════════════════
    const ORDEN_SIGLA = {
        // ── Fila 0: Portero ───────────────────────────────────────────────────
        'G':    { fila: 0, orden: 0 },
        'GK':   { fila: 0, orden: 0 },

        // ── Fila 1: Defensa (izquierda → derecha) ─────────────────────────────
        'LB':   { fila: 1, orden: 0 },
        'LWB':  { fila: 1, orden: 0 },
        'CD-L': { fila: 1, orden: 1 },
        'CB-L': { fila: 1, orden: 1 },
        'CB':   { fila: 1, orden: 1 },   // genérico: se distribuye con los demás
        'CD-R': { fila: 1, orden: 2 },
        'CB-R': { fila: 1, orden: 2 },
        'RB':   { fila: 1, orden: 3 },
        'RWB':  { fila: 1, orden: 3 },

        // ── Fila 2: Mediocampo (izquierda → derecha) ──────────────────────────
        //   LM  < CM-L < CDM/DM  < CM/AM  < CM-R  < RM
        //   En un 4-3-3 con un solo CM, la distribución equitativa lo ubica
        //   en el centro automáticamente sin importar el "orden" absoluto.
        'LM':   { fila: 2, orden: 0 },
        'CM-L': { fila: 2, orden: 1 },
        'CDM':  { fila: 2, orden: 2 },
        'DM':   { fila: 2, orden: 2 },
        'CM':   { fila: 2, orden: 3 },
        'AM':   { fila: 2, orden: 3 },
        'CAM':  { fila: 2, orden: 3 },
        'M':    { fila: 2, orden: 3 },
        'AM-L': { fila: 2, orden: 1 },
        'AM-R': { fila: 2, orden: 4 },
        'CM-R': { fila: 2, orden: 4 },
        'RM':   { fila: 2, orden: 5 },

        // ── Fila 3: Ataque (izquierda → derecha) ──────────────────────────────
        'LF':   { fila: 3, orden: 0 },
        'LW':   { fila: 3, orden: 0 },
        'CF-L': { fila: 3, orden: 0 },
        'ST':   { fila: 3, orden: 1 },
        'F':    { fila: 3, orden: 1 },
        'FW':   { fila: 3, orden: 1 },
        'CF':   { fila: 3, orden: 1 },
        'ST-L': { fila: 3, orden: 0 },
        'ST-R': { fila: 3, orden: 2 },
        'CF-R': { fila: 3, orden: 2 },
        'RW':   { fila: 3, orden: 2 },
        'RF':   { fila: 3, orden: 2 },
    };

    // ── Fallback: si la sigla no está en el mapa, la deduce por prefijo ──────
    const _getSiglaData = (abbr = '') => {
        const a = abbr.toUpperCase().trim();
        if (ORDEN_SIGLA[a]) return ORDEN_SIGLA[a];

        // Intentar por prefijo
        if (a === 'G' || a === 'GK') return { fila: 0, orden: 0 };
        if (a.startsWith('LB') || a.startsWith('LWB')) return { fila: 1, orden: 0 };
        if (a.startsWith('RB') || a.startsWith('RWB')) return { fila: 1, orden: 3 };
        if (a.startsWith('CB') || a.startsWith('CD')) return { fila: 1, orden: 1 };
        if (a.startsWith('LM') || a.startsWith('LW')) return { fila: 2, orden: 0 };
        if (a.startsWith('RM') || a.startsWith('RW')) return { fila: 2, orden: 5 };
        if (a.startsWith('CM') || a.startsWith('DM') || a.startsWith('AM') || a.startsWith('CAM')) return { fila: 2, orden: 3 };
        if (a.startsWith('LF') || a.startsWith('CF-L') || a.startsWith('ST-L')) return { fila: 3, orden: 0 };
        if (a.startsWith('RF') || a.startsWith('CF-R') || a.startsWith('ST-R')) return { fila: 3, orden: 2 };
        if (a.startsWith('ST') || a.startsWith('CF') || a === 'F' || a === 'FW') return { fila: 3, orden: 1 };

        return { fila: 2, orden: 3 }; // default: mediocampo centro
    };

    // ── Calcular posiciones X/Y para todos los titulares ─────────────────────
    // Recibe array de jugadores con .position.abbreviation y .formationPlace
    // Devuelve Map<formationPlace, {x, y}>
    const _calcularPosicionesTacticas = (titulares, svgW = 400, svgH = 560) => {
        // Agrupar por fila
        const filas = { 0: [], 1: [], 2: [], 3: [] };
        titulares.forEach(j => {
            const sig = _getSiglaData(j.position?.abbreviation ?? '');
            filas[sig.fila].push({ ...j, _orden: sig.orden });
        });

        // Ordenar cada fila por orden (izq → der)
        [0, 1, 2, 3].forEach(f => {
            filas[f].sort((a, b) => a._orden - b._orden);
        });

        // Filas con jugadores
        const filasOcupadas = [0, 1, 2, 3].filter(f => filas[f].length > 0);

        // Coordenadas Y: GK abajo, delanteros arriba
        const yGK  = svgH * 0.91;  // ≈ 510 en 560
        const yFWD = svgH * 0.21;  // ≈ 118 en 560

        // Margen horizontal
        const xMin = svgW * 0.125; // ≈  50 en 400
        const xMax = svgW * 0.875; // ≈ 350 en 400

        const coordsMap = new Map();

        filasOcupadas.forEach((fila, idx) => {
            const grupo = filas[fila];
            const n     = grupo.length;

            // Interpolar Y entre GK (idx=0) y FWD (idx=last)
            const t = filasOcupadas.length === 1 ? 0 : idx / (filasOcupadas.length - 1);
            const y = Math.round(yGK - t * (yGK - yFWD));

            grupo.forEach((j, i) => {
                let x;
                if (n === 1) {
                    x = svgW / 2;
                } else if (n === 2 && fila === 3) {
                    // CF-L y CF-R: centrados en 150/250 (no en los extremos)
                    x = i === 0
                        ? Math.round(svgW * 0.375)  // 150 en 400
                        : Math.round(svgW * 0.625); // 250 en 400
                } else {
                    x = Math.round(xMin + (i / (n - 1)) * (xMax - xMin));
                }
                coordsMap.set(j.formationPlace, { x, y });
            });
        });

        return coordsMap;
    };

    // ── NAVEGACIÓN (COMPLETA) ────────────────────────────────────────────────
    const renderNavbar = (activeHash) => {
        const isLigasActive = activeHash === '#/ligas' || activeHash.includes('#/liga?id=') || activeHash.includes('#/equipo?id=') || activeHash.includes('#/grupo?id=');
        return `
            <nav class="navbar desktop-nav">
                <div class="nav-links-group">
                    <a href="#/home" class="nav-link ${activeHash === '#/home' ? 'active' : ''}">Inicio</a>
                    <a href="#/ligas" class="nav-link ${isLigasActive ? 'active' : ''}">Ligas</a>
                    <a href="#/h2h" class="nav-link ${activeHash === '#/h2h' ? 'active' : ''}">H2H</a>
                    <a href="#/info" class="nav-link ${activeHash === '#/info' ? 'active' : ''}">Info</a>
                </div>
                ${Auth.isAuthenticated() ? `<button onclick="Auth.logout()" class="btn-logout">Salir</button>` : ''}
            </nav>

            ${Auth.isAuthenticated() ? `
            <nav class="mobile-nav">
                <a href="#/home" class="mobile-nav-item ${activeHash === '#/home' ? 'active' : ''}">
                    <span class="mobile-icon">🏠</span>
                    <span>Inicio</span>
                </a>
                <a href="#/ligas" class="mobile-nav-item ${isLigasActive ? 'active' : ''}">
                    <span class="mobile-icon">🏆</span>
                    <span>Ligas</span>
                </a>
                <a href="#/h2h" class="mobile-nav-item ${activeHash === '#/h2h' ? 'active' : ''}">
                    <span class="mobile-icon">⚔️</span>
                    <span>H2H</span>
                </a>
                <a href="#/info" class="mobile-nav-item ${activeHash === '#/info' ? 'active' : ''}">
                    <span class="mobile-icon">📰</span>
                    <span>Info</span>
                </a>
                <button onclick="Auth.logout()" class="mobile-nav-item" style="background:none; border:none; padding:0; cursor:pointer;">
                    <span class="mobile-icon" style="filter:none;">🚪</span>
                    <span style="color:#ff4757;">Salir</span>
                </button>
            </nav>
            ` : ''}
        `;
    };

    // ── EFECTOS DE CARGA (SKELETONS) ──────────────────────────────────────────
    const _skeletonTabla = () => {
        let rows = '';
        for (let i = 0; i < 10; i++) {
            rows += `
                <tr>
                    <td><div class="skel-cell" style="width: 20px;"></div></td>
                    <td><div class="skel-cell" style="width: 140px;"></div></td>
                    <td><div class="skel-cell" style="width: 25px;"></div></td>
                    <td><div class="skel-cell" style="width: 25px;"></div></td>
                    <td><div class="skel-cell" style="width: 25px;"></div></td>
                    <td><div class="skel-cell" style="width: 25px;"></div></td>
                    <td><div class="skel-cell" style="width: 30px;"></div></td>
                </tr>
            `;
        }
        return `
            <table class="standings-table">
                <thead>
                    <tr>
                        <th style="width: 40px;">#</th>
                        <th>Equipo</th>
                        <th style="width: 45px;">PJ</th>
                        <th style="width: 45px;">PG</th>
                        <th style="width: 45px;">PE</th>
                        <th style="width: 45px;">PP</th>
                        <th style="width: 50px;">PTS</th>
                    </tr>
                </thead>
                <tbody>${rows}</tbody>
            </table>
        `;
    };

    const _skeletonPartidos = () => {
        let items = '';
        for (let i = 0; i < 4; i++) {
            items += `
                <div class="match-item" style="padding: 15px 0;">
                    <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                        <div class="skel-cell" style="width: 100px;"></div>
                        <div class="skel-cell" style="width: 20px;"></div>
                    </div>
                    <div style="display: flex; justify-content: space-between;">
                        <div class="skel-cell" style="width: 110px;"></div>
                        <div class="skel-cell" style="width: 20px;"></div>
                    </div>
                </div>
            `;
        }
        return `<div class="match-list">${items}</div>`;
    };

    // ── VISTAS PRINCIPALES ────────────────────────────────────────────────────
    const renderHome = () => {
        let miniLigasHtml = '';
        if (typeof LIGAS !== 'undefined') {
            const ligasDestacadas = [
                ...LIGAS.europa_top5.competiciones,
                ...LIGAS.sudamerica.competiciones
            ];
            ligasDestacadas.forEach(liga => {
                miniLigasHtml += `
                    <div class="mini-league" onclick="window.location.hash='#/liga?id=${liga.id}'">
                        <span style="font-size: 1.2rem;">${liga.flag}</span>
                        <span class="mini-league-name">${liga.nombre}</span>
                    </div>
                `;
            });
        }

        appContainer.innerHTML = `
            ${renderNavbar('#/home')}
            <main class="dashboard-container fade-in">
                <section class="glass-panel panel-left">
                    <h3 class="panel-title">📊 Stats en Vivo</h3>
                    <div class="stat-box">
                        <div class="stat-header"><span>Posesión</span></div>
                        <div class="stat-bar"><div class="stat-fill-local" style="width: 58%;"></div><div class="stat-fill-visita" style="width: 42%;"></div></div>
                        <div class="stat-values"><span>58%</span><span style="color: var(--accent-neon);">42%</span></div>
                    </div>
                    <div class="stat-box">
                        <div class="stat-header"><span>Tiros al Arco</span></div>
                        <div class="stat-bar"><div class="stat-fill-local" style="width: 70%;"></div><div class="stat-fill-visita" style="width: 30%;"></div></div>
                        <div class="stat-values"><span>14</span><span style="color: var(--accent-neon);">6</span></div>
                    </div>
                    <div class="stat-box">
                        <div class="stat-header"><span>Faltas</span></div>
                        <div class="stat-bar"><div class="stat-fill-local" style="width: 40%;"></div><div class="stat-fill-visita" style="width: 60%;"></div></div>
                        <div class="stat-values"><span>8</span><span style="color: var(--accent-neon);">12</span></div>
                    </div>
                </section>

                <section class="panel-center">
                    <div style="position: absolute; top: 0; font-family: var(--font-heading); font-size: 2rem; font-weight: 800; letter-spacing: 2px; z-index: 10; text-shadow: 0 5px 15px #000;">FULBO</div>
                    <div class="pitch-perspective">
                        <div class="pitch-horizontal"><div class="area-left"></div><div class="area-right"></div></div>
                    </div>
                </section>

                <section class="glass-panel panel-right">
                    <h3 class="panel-title">🏆 Top Ligas</h3>
                    ${miniLigasHtml}
                </section>

                <section class="glass-panel panel-bottom">
                    <h3 class="panel-title" style="margin-bottom: 0; border: none;">🚨 URGENTE</h3>
                    <div class="news-ticker">
                        <span class="news-item"><span>MERCADO:</span> Fichaje bomba confirmado en la liga inglesa.</span>
                        <span class="news-item"><span>LESIÓN:</span> Estrella de la selección queda fuera por 3 semanas.</span>
                        <span class="news-item"><span>MUNDIAL:</span> Listos los preparativos de infraestructura para el 2026.</span>
                    </div>
                </section>
            </main>
        `;
    };

    const renderLigas = () => {
        let html = `
            ${renderNavbar('#/ligas')}
            <main class="page-container fade-in">
                <h2 class="section-title">🏆 Competiciones Disponibles</h2>
        `;

        for (const key in LIGAS) {
            const categoria = LIGAS[key];
            html += `
                <div class="categoria-wrapper">
                    <h3 class="category-title">${categoria.nombre}</h3>
                    <div class="leagues-grid">
            `;

            categoria.competiciones.forEach(liga => {
                html += `
                    <div class="glass-card league-card" onclick="window.location.hash='#/liga?id=${liga.id}'">
                        <div class="league-info">
                            <span class="league-flag">${liga.flag}</span>
                            <div>
                                <div class="league-name">${liga.nombre}</div>
                                <div class="league-country">${liga.pais}</div>
                            </div>
                        </div>
                        <span class="badge-liga" style="background-color: ${liga.badge_color};">${liga.id.substring(0, 5)}</span>
                    </div>
                `;
            });

            html += `</div></div>`;
        }

        html += `</main>`;
        appContainer.innerHTML = html;
    };

    // ── DETALLE DE LIGA TRADICIONAL ──────────────────────────────────────────
    const renderLigaDetalle = async (ligaId) => {
        let ligaData = null;
        for (const cat in LIGAS) {
            const found = LIGAS[cat].competiciones.find(l => l.id === ligaId);
            if (found) ligaData = found;
        }
        if (!ligaData) return;

        if (ligaId === 'world_cup' || ligaId === 'wc') {
            await renderCalendarioMundial(ligaData);
            return;
        }

        appContainer.innerHTML = `
            ${renderNavbar('#/liga?id=' + ligaId)}
            <main class="page-container fade-in">
                <a href="#/ligas" style="color: var(--text-muted); text-decoration: none; display: inline-block; margin-bottom: 1rem;">← Volver al Listado</a>
                <div class="liga-header" style="border-left: 6px solid ${ligaData.badge_color};">
                    <span class="liga-flag-large">${ligaData.flag}</span>
                    <div>
                        <h1 class="liga-title-main">${ligaData.nombre}</h1>
                        <span style="color: var(--text-muted); font-weight: 600; text-transform: uppercase;">${ligaData.pais}</span>
                    </div>
                </div>
                <div class="liga-content-grid">
                    <div class="glass-panel" id="standings-box" style="padding: 1.5rem;">
                        <h3 class="panel-title" style="color: ${ligaData.badge_color};">Tabla de Posiciones</h3>
                        <div class="table-responsive">${_skeletonTabla()}</div>
                    </div>
                    <div class="glass-panel" id="matches-box" style="padding: 1.5rem; height: fit-content;">
                        <h3 class="panel-title" style="color: ${ligaData.badge_color};">Partidos Recientes</h3>
                        ${_skeletonPartidos()}
                    </div>
                </div>
            </main>
        `;

        try {
            const [tablaRaw, partidosRaw] = await Promise.all([
                ESPN.getStandings(ligaId),
                ESPN.getScoreboard(ligaId)
            ]);

            const standingsBox = document.getElementById('standings-box');
            const matchesBox   = document.getElementById('matches-box');

            if (tablaRaw && tablaRaw.length > 0) {
                let rowsHtml = tablaRaw.map(entry => {
                    const t = entry.team;
                    const imgLogo = t.logo
                        ? `<img src="${t.logo}" width="20" height="24" style="object-fit: contain; margin-right: 8px;">`
                        : `<span class="team-shield" style="margin-right: 8px;">${t.name.charAt(0)}</span>`;
                    return `
                        <tr onclick="window.location.hash='#/equipo?id=${t.id}&liga=${ligaId}&name=${encodeURIComponent(t.name)}'"
                            style="cursor: pointer; transition: background 0.2s;"
                            onmouseover="this.style.background='rgba(255,255,255,0.05)'"
                            onmouseout="this.style.background='transparent'">
                            <td class="col-pos">${entry.pos}</td>
                            <td class="col-team">${imgLogo} <span>${t.name}</span></td>
                            <td>${entry.stats.pj}</td>
                            <td>${entry.stats.pg}</td>
                            <td>${entry.stats.pe}</td>
                            <td>${entry.stats.pp}</td>
                            <td class="col-pts">${entry.stats.pts}</td>
                        </tr>
                    `;
                }).join('');

                standingsBox.querySelector('.table-responsive').innerHTML = `
                    <table class="standings-table">
                        <thead><tr><th class="col-pos">#</th><th>Equipo</th><th>PJ</th><th>PG</th><th>PE</th><th>PP</th><th class="col-pts">PTS</th></tr></thead>
                        <tbody>${rowsHtml}</tbody>
                    </table>
                `;
            } else {
                standingsBox.querySelector('.table-responsive').innerHTML = `<p style="color: var(--text-muted); padding: 10px;">Clasificación no disponible temporalmente.</p>`;
            }

            if (partidosRaw && partidosRaw.length > 0) {
                let matchesHtml = partidosRaw.map(partido => {
                    const statusDesc = partido.status?.description ?? partido.status?.state ?? '';
                    const isLive     = partido.status?.state === 'in' || statusDesc.toLowerCase().includes("'");
                    const liveBadge  = isLive ? `<span style="color: #ff4757; font-size: 0.7rem; font-weight: bold; animation: pulse 1s infinite; margin-left: 6px;">● VIVO</span>` : '';
                    const homeLogoHtml = partido.homeTeam?.logo ? `<img src="${partido.homeTeam.logo}" width="18" height="18" style="object-fit:contain; margin-right:6px; vertical-align:middle;">` : '';
                    const awayLogoHtml = partido.awayTeam?.logo ? `<img src="${partido.awayTeam.logo}" width="18" height="18" style="object-fit:contain; margin-right:6px; vertical-align:middle;">` : '';

                    return `
                        <div class="match-item" style="padding: 12px 0; border-bottom: 1px solid var(--border-glass);">
                            <div style="display: flex; justify-content: space-between; align-items: center; font-size: 0.95rem; font-weight: 500;">
                                <div style="display: flex; flex-direction: column; gap: 4px;">
                                    <span>${homeLogoHtml}${partido.homeTeam?.name ?? '—'}</span>
                                    <span>${awayLogoHtml}${partido.awayTeam?.name ?? '—'}</span>
                                </div>
                                <div style="display: flex; flex-direction: column; gap: 4px; text-align: right; font-family: var(--font-heading); font-weight: 700; color: var(--accent-neon);">
                                    <span>${partido.homeTeam?.score ?? '-'}</span>
                                    <span>${partido.awayTeam?.score ?? '-'}</span>
                                </div>
                            </div>
                            <span style="font-size: 0.75rem; color: var(--text-muted); display: block; margin-top: 4px; text-transform: uppercase;">
                                ${statusDesc} ${liveBadge}
                            </span>
                        </div>
                    `;
                }).join('');

                matchesBox.innerHTML = `<h3 class="panel-title" style="color: ${ligaData.badge_color};">Resultados / Marcadores</h3><div class="match-list" style="max-height: 450px; overflow-y: auto;">${matchesHtml}</div>`;
            }
        } catch (err) { console.error("Error cargando datos de liga:", err); }
    };

    // ── VISTA MUNDIAL: FASE DE GRUPOS (GENERAL) ──────────
    const renderCalendarioMundial = async (ligaData) => {
        appContainer.innerHTML = `
            ${renderNavbar('#/liga?id=' + ligaData.id)}
            <main class="page-container fade-in" style="display: flex; justify-content: center; align-items: center; height: 75vh; flex-direction: column;">
                <div style="width: 45px; height: 45px; border: 4px solid var(--accent-neon); border-right-color: transparent; border-radius: 50%; animation: spin 1s linear infinite;"></div>
                <p style="margin-top: 1.5rem; color: var(--accent-neon); font-family: var(--font-heading); text-transform: uppercase; letter-spacing: 1px; font-weight: bold;">Sincronizando grupos en vivo...</p>
                <style>@keyframes spin { 100% { transform: rotate(360deg); } }</style>
            </main>
        `;

        let gruposData = [];
        const CF_WORKER = 'https://elfulbo.solgoyhe.workers.dev';

        try {
            const espnUrl      = 'https://site.api.espn.com/apis/v2/sports/soccer/fifa.world/standings';
            const espnProxyUrl = `${CF_WORKER}/?url=${encodeURIComponent(espnUrl)}`;
            const respuestaEspn = await fetch(espnProxyUrl);
            if (!respuestaEspn.ok) throw new Error('ESPN Standings falló');

            const parsedEspn = await respuestaEspn.json();

            if (parsedEspn.children && parsedEspn.children.length > 0) {
                gruposData = parsedEspn.children.map(grupo => {
                    const equipos = grupo.standings?.entries?.map(e => {
                        const stats    = e.stats || [];
                        const findStat = (name) => stats.find(s => s.name === name)?.value || 0;
                        return {
                            id:     e.team.id,
                            nombre: e.team.name,
                            logo:   e.team.logos?.[0]?.href || '🌐',
                            pj:     findStat('gamesPlayed'),
                            pts:    findStat('points'),
                            dif:    findStat('pointDifferential')
                        };
                    }) || [];

                    equipos.sort((a, b) => b.pts - a.pts || b.dif - a.dif);
                    return { nombre: grupo.name.replace(/Group /i, 'GRUPO ').toUpperCase(), equipos };
                });
                gruposData.sort((a, b) => a.nombre.localeCompare(b.nombre));
            } else {
                throw new Error('Array de grupos vacío');
            }
        } catch (error) {
            const mockEquipos = {
                'GRUPO A': [{n:'México',        fl:'🇲🇽', id:'203'}, {n:'Sudáfrica',     fl:'🇿🇦', id:'467'}, {n:'Corea del Sur', fl:'🇰🇷', id:'451'}, {n:'Czechia',        fl:'🇨🇿', id:'450'}],
                'GRUPO B': [{n:'Canadá',        fl:'🇨🇦', id:'206'}, {n:'Suiza',         fl:'🇨🇭', id:'475'}, {n:'Catar',         fl:'🇶🇦', id:'4398'},{n:'Bosnia-Herz.',   fl:'🇧🇦', id:'452'}],
                'GRUPO C': [{n:'Brasil',        fl:'🇧🇷', id:'205'}, {n:'Marruecos',     fl:'🇲🇦', id:'2869'},{n:'Haití',         fl:'🇭🇹', id:'2654'},{n:'Escocia',        fl:'🏴󠁧󠁢󠁳󠁣󠁴󠁿', id:'580'}],
                'GRUPO D': [{n:'Estados Unidos',fl:'🇺🇸', id:'660'}, {n:'Paraguay',      fl:'🇵🇾', id:'210'}, {n:'Australia',     fl:'🇦🇺', id:'628'}, {n:'Türkiye',        fl:'🇹🇷', id:'465'}],
                'GRUPO E': [{n:'Alemania',      fl:'🇩🇪', id:'481'}, {n:'Curaçao',       fl:'🇨🇼', id:'11678'},{n:'Costa de Marfil',fl:'🇨🇮', id:'4789'},{n:'Ecuador',       fl:'🇪🇨', id:'209'}],
                'GRUPO F': [{n:'Países Bajos',  fl:'🇳🇱', id:'449'}, {n:'Japón',         fl:'🇯🇵', id:'627'}, {n:'Suecia',        fl:'🇸🇪', id:'466'}, {n:'Túnez',          fl:'🇹🇳', id:'659'}],
                'GRUPO G': [{n:'Bélgica',       fl:'🇧🇪', id:'459'}, {n:'Egipto',        fl:'🇪🇬', id:'2620'},{n:'Irán',          fl:'🇮🇷', id:'469'}, {n:'Nueva Zelanda',  fl:'🇳🇿', id:'2666'}],
                'GRUPO H': [{n:'España',        fl:'🇪🇸', id:'164'}, {n:'Cabo Verde',    fl:'🇨🇻', id:'2597'},{n:'Arabia Saudita',fl:'🇸🇦', id:'655'}, {n:'Uruguay',        fl:'🇺🇾', id:'212'}],
                'GRUPO I': [{n:'Francia',       fl:'🇫🇷', id:'478'}, {n:'Senegal',       fl:'🇸🇳', id:'654'}, {n:'Noruega',       fl:'🇳🇴', id:'464'}, {n:'Irak',           fl:'🇮🇶', id:'4375'}],
                'GRUPO J': [{n:'Argentina',     fl:'🇦🇷', id:'202'}, {n:'Argelia',       fl:'🇩🇿', id:'624'}, {n:'Austria',       fl:'🇦🇹', id:'474'}, {n:'Jordania',       fl:'🇯🇴', id:'2917'}],
                'GRUPO K': [{n:'Portugal',      fl:'🇵🇹', id:'482'}, {n:'Congo RD',      fl:'🇨🇩', id:'2850'},{n:'Uzbekistán',    fl:'🇺🇿', id:'2570'},{n:'Colombia',       fl:'🇨🇴', id:'208'}],
                'GRUPO L': [{n:'Inglaterra',    fl:'🏴󠁧󠁢󠁥󠁮󠁧󠁿', id:'448'}, {n:'Croacia',       fl:'🇭🇷', id:'477'}, {n:'Ghana',         fl:'🇬🇭', id:'4469'},{n:'Panamá',         fl:'🇵🇦', id:'2659'}],
            };

            for (const [nombreGrupo, equiposArr] of Object.entries(mockEquipos)) {
                gruposData.push({
                    nombre:  nombreGrupo,
                    equipos: equiposArr.map(eq => ({ id: eq.id, nombre: eq.n, logo: eq.fl, pj: 0, pts: 0, dif: 0 }))
                });
            }
            gruposData.sort((a, b) => a.nombre.localeCompare(b.nombre));
        }

        let grillaGruposHtml = gruposData.map(grupo => {
            let filasTabla = grupo.equipos.map((eq, index) => {
                const logoHtml = eq.logo.includes('http')
                    ? `<img src="${eq.logo}" width="20" height="20" style="object-fit: contain; margin-right: 8px;">`
                    : `<span style="font-size:1.1rem; margin-right: 8px;">${eq.logo}</span>`;
                return `
                    <tr style="border-bottom: 1px solid rgba(255,255,255,0.03); cursor: pointer; transition: background 0.2s;"
                        onmouseover="this.style.background='rgba(255,255,255,0.05)'"
                        onmouseout="this.style.background='transparent'"
                        onclick="window.location.hash='#/equipo?id=${eq.id}&liga=world_cup&name=${encodeURIComponent(eq.nombre)}'; event.stopPropagation();">
                        <td style="padding: 8px 4px; font-weight: bold; color: var(--text-muted);">${index + 1}</td>
                        <td style="padding: 8px 4px; display: flex; align-items: center; font-weight: 500;">
                            ${logoHtml} <span style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 130px;">${eq.nombre}</span>
                        </td>
                        <td style="padding: 8px 4px; text-align: center; color: var(--text-muted);">${eq.pj}</td>
                        <td style="padding: 8px 4px; text-align: center; font-weight: bold; color: var(--accent-neon);">${eq.pts}</td>
                    </tr>
                `;
            }).join('');

            return `
                <div class="glass-panel" style="padding: 1.2rem; min-height: 220px; transition: transform 0.2s;">
                    <h3 class="panel-title" style="text-align: center; color: var(--accent-neon); border-bottom: 1px solid var(--border-glass); padding-bottom: 8px; margin-bottom: 12px; font-size: 1.2rem; letter-spacing: 1px; cursor: pointer;"
                        onclick="window.location.hash='#/grupo?id=${encodeURIComponent(grupo.nombre)}'">
                        ${grupo.nombre} <span style="font-size: 0.8rem; color: var(--text-muted);">↗</span>
                    </h3>
                    <div class="table-responsive">
                        <table style="width: 100%; border-collapse: collapse; font-size: 0.9rem;">
                            <thead>
                                <tr style="color: var(--text-muted); font-size: 0.8rem; text-transform: uppercase; border-bottom: 1px solid var(--border-glass);">
                                    <th style="text-align: left; padding: 4px; width: 30px;">#</th>
                                    <th style="text-align: left; padding: 4px;">Equipo</th>
                                    <th style="text-align: center; padding: 4px; width: 40px;">PJ</th>
                                    <th style="text-align: center; padding: 4px; width: 40px;">PTS</th>
                                </tr>
                            </thead>
                            <tbody>${filasTabla}</tbody>
                        </table>
                    </div>
                </div>
            `;
        }).join('');

        appContainer.innerHTML = `
            ${renderNavbar('#/liga?id=' + ligaData.id)}
            <main class="page-container fade-in">
                <a href="#/ligas" style="color: var(--text-muted); text-decoration: none; display: inline-block; margin-bottom: 1.5rem; font-weight: 600;">← Volver a Ligas</a>
                <div class="liga-header" style="border-left: 6px solid ${ligaData.badge_color}; background: radial-gradient(circle at left, rgba(200, 168, 75, 0.12) 0%, transparent 60%);">
                    <span class="liga-flag-large" style="font-size: 3.8rem; filter: drop-shadow(0 0 10px rgba(200,168,75,0.3));">${ligaData.flag}</span>
                    <div>
                        <h1 class="liga-title-main">Fase de Grupos</h1>
                        <span style="color: var(--accent-neon); font-weight: 800; letter-spacing: 1px; font-size: 0.85rem;">🏆 TABLAS Y ESTADÍSTICAS OFICIALES</span>
                    </div>
                </div>
                <p style="text-align: center; color: var(--text-muted); font-size: 0.85rem; margin-top: 1rem;">Seleccioná el título de un grupo para ver estadísticas detalladas (GF, GC, DIF) o seleccioná un equipo para ver a sus jugadores.</p>
                <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 1.5rem; margin-top: 1rem;">
                    ${grillaGruposHtml}
                </div>
            </main>
        `;
    };

    // ── VISTA MUNDIAL: DETALLE DE GRUPO ──────────────────────────────────────
    const renderGrupoDetalle = async (grupoNombreCodificado) => {
        const grupoNombre = decodeURIComponent(grupoNombreCodificado);

        appContainer.innerHTML = `
            ${renderNavbar('#/liga?id=world_cup')}
            <main class="page-container fade-in">
                <a href="#/liga?id=world_cup" style="color: var(--text-muted); text-decoration: none; display: inline-block; margin-bottom: 1.5rem; font-weight: 600;">← Volver a Fase de Grupos</a>
                <div style="display: flex; justify-content: center; align-items: center; height: 30vh; flex-direction: column;">
                    <div style="width: 45px; height: 45px; border: 4px solid var(--accent-neon); border-right-color: transparent; border-radius: 50%; animation: spin 1s linear infinite;"></div>
                    <p style="margin-top: 1.5rem; color: var(--accent-neon); font-family: var(--font-heading); text-transform: uppercase; letter-spacing: 1px;">Analizando estadísticas de ${grupoNombre}...</p>
                </div>
            </main>
        `;

        let equipos = [];
        const CF_WORKER = 'https://elfulbo.solgoyhe.workers.dev';

        try {
            const espnProxyUrl  = `${CF_WORKER}/?url=${encodeURIComponent('https://site.api.espn.com/apis/v2/sports/soccer/fifa.world/standings')}`;
            const respuestaEspn = await fetch(espnProxyUrl);
            const parsedEspn    = await respuestaEspn.json();
            const grupoEncontrado = parsedEspn.children?.find(g => g.name.replace(/Group /i, 'GRUPO ').toUpperCase() === grupoNombre);

            if (grupoEncontrado && grupoEncontrado.standings?.entries) {
                equipos = grupoEncontrado.standings.entries.map(e => {
                    const stats    = e.stats || [];
                    const findStat = (name) => stats.find(s => s.name === name)?.value || 0;
                    return {
                        id:     e.team.id,
                        nombre: e.team.name,
                        logo:   e.team.logos?.[0]?.href || '🌐',
                        pj:     findStat('gamesPlayed'),
                        gf:     findStat('pointsFor'),
                        gc:     findStat('pointsAgainst'),
                        dif:    findStat('pointDifferential'),
                        pts:    findStat('points')
                    };
                });
                equipos.sort((a, b) => b.pts - a.pts || b.dif - a.dif);
            } else throw new Error();
        } catch (err) {
            const mapMockGrup = {
                'GRUPO A': [{n:'México',        fl:'🇲🇽', id:'203'}, {n:'Sudáfrica',     fl:'🇿🇦', id:'467'}, {n:'Corea del Sur', fl:'🇰🇷', id:'451'}, {n:'Czechia',        fl:'🇨🇿', id:'450'}],
                'GRUPO B': [{n:'Canadá',        fl:'🇨🇦', id:'206'}, {n:'Suiza',         fl:'🇨🇭', id:'475'}, {n:'Catar',         fl:'🇶🇦', id:'4398'},{n:'Bosnia-Herz.',   fl:'🇧🇦', id:'452'}],
                'GRUPO C': [{n:'Brasil',        fl:'🇧🇷', id:'205'}, {n:'Marruecos',     fl:'🇲🇦', id:'2869'},{n:'Haití',         fl:'🇭🇹', id:'2654'},{n:'Escocia',        fl:'🏴󠁧󠁢󠁳󠁣󠁴󠁿', id:'580'}],
                'GRUPO D': [{n:'Estados Unidos',fl:'🇺🇸', id:'660'}, {n:'Paraguay',      fl:'🇵🇾', id:'210'}, {n:'Australia',     fl:'🇦🇺', id:'628'}, {n:'Türkiye',        fl:'🇹🇷', id:'465'}],
                'GRUPO E': [{n:'Alemania',      fl:'🇩🇪', id:'481'}, {n:'Curaçao',       fl:'🇨🇼', id:'11678'},{n:'Costa de Marfil',fl:'🇨🇮', id:'4789'},{n:'Ecuador',       fl:'🇪🇨', id:'209'}],
                'GRUPO F': [{n:'Países Bajos',  fl:'🇳🇱', id:'449'}, {n:'Japón',         fl:'🇯🇵', id:'627'}, {n:'Suecia',        fl:'🇸🇪', id:'466'}, {n:'Túnez',          fl:'🇹🇳', id:'659'}],
                'GRUPO G': [{n:'Bélgica',       fl:'🇧🇪', id:'459'}, {n:'Egipto',        fl:'🇪🇬', id:'2620'},{n:'Irán',          fl:'🇮🇷', id:'469'}, {n:'Nueva Zelanda',  fl:'🇳🇿', id:'2666'}],
                'GRUPO H': [{n:'España',        fl:'🇪🇸', id:'164'}, {n:'Cabo Verde',    fl:'🇨🇻', id:'2597'},{n:'Arabia Saudita',fl:'🇸🇦', id:'655'}, {n:'Uruguay',        fl:'🇺🇾', id:'212'}],
                'GRUPO I': [{n:'Francia',       fl:'🇫🇷', id:'478'}, {n:'Senegal',       fl:'🇸🇳', id:'654'}, {n:'Noruega',       fl:'🇳🇴', id:'464'}, {n:'Irak',           fl:'🇮🇶', id:'4375'}],
                'GRUPO J': [{n:'Argentina',     fl:'🇦🇷', id:'202'}, {n:'Argelia',       fl:'🇩🇿', id:'624'}, {n:'Austria',       fl:'🇦🇹', id:'474'}, {n:'Jordania',       fl:'🇯🇴', id:'2917'}],
                'GRUPO K': [{n:'Portugal',      fl:'🇵🇹', id:'482'}, {n:'Congo RD',      fl:'🇨🇩', id:'2850'},{n:'Uzbekistán',    fl:'🇺🇿', id:'2570'},{n:'Colombia',       fl:'🇨🇴', id:'208'}],
                'GRUPO L': [{n:'Inglaterra',    fl:'🏴󠁧󠁢󠁥󠁮󠁧󠁿', id:'448'}, {n:'Croacia',       fl:'🇭🇷', id:'477'}, {n:'Ghana',         fl:'🇬🇭', id:'4469'},{n:'Panamá',         fl:'🇵🇦', id:'2659'}],
            };
            const target = mapMockGrup[grupoNombre] || mapMockGrup['GRUPO A'];
            equipos = target.map(eq => ({ id: eq.id, nombre: eq.n, logo: eq.fl, pj: 0, gf: 0, gc: 0, dif: 0, pts: 0 }));
        }

        let filasHtml = equipos.map((eq, idx) => {
            const logoHtml = eq.logo.includes('http')
                ? `<img src="${eq.logo}" width="24" height="24" style="object-fit: contain; margin-right: 12px;">`
                : `<span style="font-size:1.3rem; margin-right: 12px;">${eq.logo}</span>`;
            return `
                <tr style="border-bottom: 1px solid var(--border-glass); cursor: pointer; transition: background 0.2s;"
                    onmouseover="this.style.background='rgba(255,255,255,0.05)'"
                    onmouseout="this.style.background='transparent'"
                    onclick="window.location.hash='#/equipo?id=${eq.id}&liga=world_cup&name=${encodeURIComponent(eq.nombre)}'">
                    <td style="padding: 12px; font-weight: bold; color: var(--accent-neon);">${idx + 1}</td>
                    <td style="padding: 12px; display: flex; align-items: center; font-weight: 600; font-size: 1.05rem;">${logoHtml} ${eq.nombre}</td>
                    <td style="padding: 12px; text-align: center;">${eq.pj}</td>
                    <td style="padding: 12px; text-align: center; color: #6CABDD;">${eq.gf}</td>
                    <td style="padding: 12px; text-align: center; color: #ff4757;">${eq.gc}</td>
                    <td style="padding: 12px; text-align: center; font-weight: bold;">${eq.dif > 0 ? '+' + eq.dif : eq.dif}</td>
                    <td style="padding: 12px; text-align: center; font-weight: 900; color: var(--text-main); font-size: 1.1rem;">${eq.pts}</td>
                </tr>
            `;
        }).join('');

        appContainer.innerHTML = `
            ${renderNavbar('#/liga?id=world_cup')}
            <main class="page-container fade-in">
                <a href="#/liga?id=world_cup" style="color: var(--text-muted); text-decoration: none; display: inline-block; margin-bottom: 1rem; font-weight: 600;">← Volver a Fase de Grupos</a>
                <div class="liga-header" style="border-left: 6px solid var(--accent-neon); background: rgba(200, 168, 75, 0.05);">
                    <div>
                        <h1 class="liga-title-main">${grupoNombre}</h1>
                        <span style="color: var(--text-muted); font-weight: 600; text-transform: uppercase; letter-spacing: 1px;">TABLA DE POSICIONES EXTENDIDA</span>
                    </div>
                </div>
                <div class="glass-panel" style="padding: 1.5rem; margin-top: 2rem;">
                    <div class="table-responsive">
                        <table style="width: 100%; border-collapse: collapse;">
                            <thead>
                                <tr style="color: var(--text-muted); font-size: 0.85rem; text-transform: uppercase; border-bottom: 2px solid var(--border-glass);">
                                    <th style="text-align: left; padding: 12px; width: 40px;">Pos</th>
                                    <th style="text-align: left; padding: 12px;">Selección Nacional</th>
                                    <th style="text-align: center; padding: 12px; width: 60px;">PJ</th>
                                    <th style="text-align: center; padding: 12px; width: 60px;" title="Goles a Favor">GF</th>
                                    <th style="text-align: center; padding: 12px; width: 60px;" title="Goles en Contra">GC</th>
                                    <th style="text-align: center; padding: 12px; width: 60px;" title="Diferencia de Gol">DIF</th>
                                    <th style="text-align: center; padding: 12px; width: 60px;">PTS</th>
                                </tr>
                            </thead>
                            <tbody>${filasHtml}</tbody>
                        </table>
                    </div>
                </div>
            </main>
        `;
    };

    // ── VISTA: PERFIL DE EQUIPO ───────────────────────────────────────────────
    const renderEquipoDetalle = async (equipoId, ligaId, nombreEquipoDecoded) => {
        const name       = decodeURIComponent(nombreEquipoDecoded || 'Selección');
        const CF_WORKER  = 'https://elfulbo.solgoyhe.workers.dev';
        const espnLeague = ESPN.getSlug(ligaId) ?? ligaId;

        appContainer.innerHTML = `
            ${renderNavbar('#/liga?id=' + ligaId)}
            <main class="page-container fade-in">
                <a href="javascript:history.back()" style="color: var(--text-muted); text-decoration: none; display: inline-block; margin-bottom: 1rem;">← Volver</a>
                <div style="display: flex; justify-content: center; align-items: center; height: 30vh; flex-direction: column;">
                    <div style="width: 45px; height: 45px; border: 4px solid var(--accent-neon); border-right-color: transparent; border-radius: 50%; animation: spin 1s linear infinite;"></div>
                    <p style="margin-top: 1.5rem; color: var(--accent-neon); font-family: var(--font-heading); text-transform: uppercase; letter-spacing: 1px;">Extrayendo datos de ESPN...</p>
                </div>
            </main>
        `;

        // ── Helpers ───────────────────────────────────────────────────────────
        const renderLista = (lista, icono, unidad) => {
            if (!lista || lista.length === 0) return `<p style="color:var(--text-muted); font-size:0.85rem; padding: 10px 0; text-align: center; font-style: italic;">Sin registros en este partido.</p>`;
            return lista.map(item => `
                <div style="display:flex; justify-content:space-between; align-items:center; padding: 8px 0; border-bottom: 1px solid rgba(255,255,255,0.04);">
                    <div style="display:flex; align-items:center; gap: 8px;">
                        <span style="font-size: 1rem;">${icono}</span>
                        <span style="font-weight: 500; font-size: 0.95rem;">${item.nombre}</span>
                    </div>
                    <span style="font-weight: 800; color: var(--text-main); font-family: var(--font-heading);">${item.valor} <span style="font-size: 0.7rem; font-weight: normal; color:var(--text-muted);">${unidad}</span></span>
                </div>
            `).join('');
        };

        const extraerStatsDeSummary = (summaryJSON, teamId) => {
            const stats = { goles: [], asistencias: [], amarillas: [], rojas: [] };

            const goles = (summaryJSON.keyEvents ?? []).filter(e => e.scoringPlay === true && e.team?.id === String(teamId));
            goles.forEach(g => {
                const goleador  = g.participants?.[0]?.athlete?.displayName;
                const asistidor = g.participants?.[1]?.athlete?.displayName;
                if (goleador) {
                    const existing = stats.goles.find(x => x.nombre === goleador);
                    if (existing) existing.valor++;
                    else stats.goles.push({ nombre: goleador, valor: 1 });
                }
                if (asistidor) {
                    const existing = stats.asistencias.find(x => x.nombre === asistidor);
                    if (existing) existing.valor++;
                    else stats.asistencias.push({ nombre: asistidor, valor: 1 });
                }
            });

            const teamRoster = (summaryJSON.rosters ?? []).find(r => r.team?.id === String(teamId));
            (teamRoster?.roster ?? []).forEach(j => {
                const getStat = (n) => j.stats?.find(s => s.name === n)?.value ?? 0;
                const am      = getStat('yellowCards');
                const ro      = getStat('redCards');
                const nombre  = j.athlete?.displayName;
                if (am > 0) stats.amarillas.push({ nombre, valor: am });
                if (ro > 0) stats.rojas.push({ nombre, valor: ro });
            });

            return stats;
        };

        const extraerConvocados = (rosterJSON) => {
            let atletasArray = [];
            if (Array.isArray(rosterJSON.athletes)) {
                atletasArray = rosterJSON.athletes[0]?.items
                    ? rosterJSON.athletes.flatMap(g => g.items || [])
                    : rosterJSON.athletes;
            }
            return atletasArray.map(ath => ({
                id:       ath.id ?? ath.uid ?? null,
                numero:   ath.jersey || '-',
                nombre:   ath.displayName || ath.fullName || 'Jugador',
                posicion: ath.position?.abbreviation || ath.position?.name || 'N/A'
            }));
        };

        // ── Fetch paralelo: roster + scoreboards ──────────────────────────────
        let convocados = [];
        let partidos   = [];

        try {
            const fechasGrupoStage = [];
            for (let d = 11; d <= 27; d++) fechasGrupoStage.push(`202606${d}`);

            const [rosterRes, ...scoreboardsRes] = await Promise.all([
                fetch(`${CF_WORKER}/?url=${encodeURIComponent(`https://site.api.espn.com/apis/site/v2/sports/soccer/${espnLeague}/teams/${equipoId}/roster`)}`),
                ...fechasGrupoStage.map(fecha =>
                    fetch(`${CF_WORKER}/?url=${encodeURIComponent(`https://site.api.espn.com/apis/site/v2/sports/soccer/${espnLeague}/scoreboard?dates=${fecha}`)}`)
                )
            ]);

            if (rosterRes.ok) convocados = extraerConvocados(await rosterRes.json());

            const todosEventos = (await Promise.all(
                scoreboardsRes.map(r => r.ok ? r.json().catch(() => ({})) : Promise.resolve({}))
            )).flatMap(sb => sb.events ?? []);

            const vistos = new Set();
            todosEventos.forEach(ev => {
                if (vistos.has(ev.id)) return;
                vistos.add(ev.id);

                const comp     = ev.competitions?.[0];
                const home     = comp?.competitors?.find(c => c.homeAway === 'home');
                const away     = comp?.competitors?.find(c => c.homeAway === 'away');
                const esLocal  = home?.team?.id === String(equipoId);
                const esVisita = away?.team?.id === String(equipoId);
                if (!esLocal && !esVisita) return;

                const rival       = esLocal ? (away?.team?.displayName ?? '?') : (home?.team?.displayName ?? '?');
                const scoreLocal  = home?.score ?? '-';
                const scoreVisita = away?.score ?? '-';
                const estado      = comp?.status?.type?.state ?? 'pre';
                const desc        = comp?.status?.type?.shortDetail ?? '';
                const isLive      = estado === 'in';
                const jugado      = estado === 'post' || isLive;

                partidos.push({ id: ev.id, rival, resultado: jugado ? `${scoreLocal} - ${scoreVisita}` : desc || 'Próximo', estado, isLive, jugado });
            });

            partidos.sort((a, b) => {
                if (a.jugado && !b.jugado) return -1;
                if (!a.jugado && b.jugado) return 1;
                return 0;
            });

        } catch (err) { console.warn('[EL FULBO] Error cargando equipo:', err); }

        // ── HTML de convocados ────────────────────────────────────────────────
        const rosterHtml = convocados.length > 0
            ? convocados.map(j => `
                <div class="roster-item-js" data-id="${j.id ?? j.numero}"
                    style="display:flex; align-items:center; justify-content:space-between; padding: 8px; border-bottom: 1px solid var(--border-glass); transition: background 0.2s, border-left 0.2s;">
                    <div style="display:flex; align-items:center; gap: 10px;">
                        <span style="background:rgba(255,255,255,0.1); width:30px; height:30px; display:flex; align-items:center; justify-content:center; border-radius:50%; font-weight:bold; font-size:0.85rem;">${j.numero}</span>
                        <span>${j.nombre}</span>
                    </div>
                    <span style="font-size:0.8rem; color:var(--accent-neon); font-weight:bold;">${j.posicion}</span>
                </div>`).join('')
            : `<p style="color:var(--text-muted); font-style:italic; text-align:center; padding-top:1rem;">Sin datos de convocados.</p>`;

        // ── Chips de partidos ─────────────────────────────────────────────────
        const chipsHtml = partidos.length > 0
            ? partidos.map((p, i) => `
                <button onclick="window._seleccionarPartido(${i})" id="chip-partido-${i}"
                    style="flex-shrink:0; padding: 10px 18px; border-radius: 20px; border: 2px solid ${i === 0 ? 'var(--accent-neon)' : 'var(--border-glass)'}; background: ${i === 0 ? 'rgba(57,255,20,0.12)' : 'rgba(255,255,255,0.04)'}; color: ${i === 0 ? 'var(--accent-neon)' : 'var(--text-muted)'}; cursor: pointer; font-family: var(--font-heading); font-weight: 700; font-size: 0.9rem; white-space: nowrap; transition: all 0.2s;">
                    vs ${p.rival}
                    ${p.isLive ? '<span style="color:#ff4757; margin-left:6px; font-size:0.75rem;">● VIVO</span>' : ''}
                    <span style="display:block; font-size:0.75rem; font-weight:400; margin-top:2px; color:var(--text-muted);">${p.resultado}</span>
                </button>`).join('')
            : `<p style="color:var(--text-muted); font-size:0.85rem; padding: 10px;">Sin partidos registrados aún.</p>`;

        // ── Render principal ──────────────────────────────────────────────────
        appContainer.innerHTML = `
            ${renderNavbar('#/liga?id=' + ligaId)}
            <main class="page-container fade-in">
                <a href="javascript:history.back()" style="color: var(--text-muted); text-decoration: none; display: inline-block; margin-bottom: 1.5rem; font-weight: 600;">← Volver</a>

                <div class="liga-header" style="border-left: 6px solid var(--accent-neon); background: rgba(255,255,255,0.03); display: flex; align-items: center; gap: 20px;">
                    <div style="width: 80px; height: 80px; font-size: 2.5rem; background: var(--surface-color); border: 2px solid var(--border-glass); display:flex; align-items:center; justify-content:center; border-radius:50%;">${name.charAt(0)}</div>
                    <div>
                        <h1 class="liga-title-main" style="margin-bottom: 4px; font-size: 2rem;">${name}</h1>
                        <span style="color: var(--accent-neon); font-weight: 800; text-transform: uppercase; letter-spacing: 1px; font-size: 0.85rem;">Estadísticas por Partido</span>
                    </div>
                </div>

                <!-- Selector de partidos -->
                <div class="glass-panel" style="padding: 1.2rem 1.5rem; margin-top: 1.5rem;">
                    <p style="font-size:0.75rem; color:var(--text-muted); text-transform:uppercase; letter-spacing:1px; margin-bottom:10px; font-weight:600;">Seleccioná un partido</p>
                    <div style="display:flex; gap: 12px; overflow-x: auto; padding-bottom: 4px; scrollbar-width: thin;">
                        ${chipsHtml}
                    </div>
                </div>

                <!-- Stats del partido seleccionado -->
                <div id="stats-partido-container" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 1.5rem; margin-top: 1.5rem;">
                    <div class="glass-panel" style="padding: 1.5rem; grid-column: 1 / -1; text-align:center;">
                        <div style="width: 30px; height: 30px; border: 3px solid var(--accent-neon); border-right-color: transparent; border-radius: 50%; animation: spin 1s linear infinite; margin: 0 auto;"></div>
                        <p style="color:var(--text-muted); margin-top:10px; font-size:0.9rem;">Cargando estadísticas...</p>
                    </div>
                </div>

                <!-- Convocados + Pizarra -->
                <div class="equipo-grid" style="margin-top: 2rem;">
                    <div class="glass-panel" style="padding: 1.5rem; max-height: 500px; overflow-y: auto;">
                        <h3 class="panel-title">Lista de Convocados</h3>
                        ${rosterHtml}
                    </div>
                    <div class="glass-panel" style="padding: 1rem; overflow: hidden;">
                        <h3 class="panel-title" id="pizarra-titulo" style="margin-bottom:0.5rem;">Disposición Táctica</h3>
                        <div id="pizarra-container" style="width:100%; overflow:hidden; border-radius:8px;">
                            <svg id="pizarra-svg" viewBox="0 0 400 560" xmlns="http://www.w3.org/2000/svg" style="width:100%; display:block;">
                                <defs></defs>
                                <!-- Franjas de césped -->
                                <rect width="400" height="560" fill="#27792a" rx="8"/>
                                <rect x="0"  y="0"   width="400" height="70"  fill="#1e6622" rx="8"/>
                                <rect x="0"  y="140" width="400" height="70"  fill="#1e6622"/>
                                <rect x="0"  y="280" width="400" height="70"  fill="#1e6622"/>
                                <rect x="0"  y="420" width="400" height="70"  fill="#1e6622"/>
                                <!-- Borde del campo -->
                                <rect x="20" y="20" width="360" height="520" fill="none" stroke="rgba(255,255,255,0.5)" stroke-width="1.5"/>
                                <!-- Línea del medio -->
                                <line x1="20" y1="280" x2="380" y2="280" stroke="rgba(255,255,255,0.5)" stroke-width="1.5"/>
                                <!-- Círculo central -->
                                <circle cx="200" cy="280" r="52" fill="none" stroke="rgba(255,255,255,0.5)" stroke-width="1.5"/>
                                <circle cx="200" cy="280" r="2.5" fill="rgba(255,255,255,0.7)"/>
                                <!-- Área grande arriba -->
                                <rect x="88"  y="20"  width="224" height="82" fill="none" stroke="rgba(255,255,255,0.5)" stroke-width="1.5"/>
                                <!-- Área chica arriba -->
                                <rect x="144" y="20"  width="112" height="34" fill="none" stroke="rgba(255,255,255,0.5)" stroke-width="1.5"/>
                                <!-- Área grande abajo -->
                                <rect x="88"  y="458" width="224" height="82" fill="none" stroke="rgba(255,255,255,0.5)" stroke-width="1.5"/>
                                <!-- Área chica abajo -->
                                <rect x="144" y="506" width="112" height="34" fill="none" stroke="rgba(255,255,255,0.5)" stroke-width="1.5"/>
                                <!-- Puntos de penal -->
                                <circle cx="200" cy="76"  r="2.5" fill="rgba(255,255,255,0.7)"/>
                                <circle cx="200" cy="484" r="2.5" fill="rgba(255,255,255,0.7)"/>
                                <!-- Arcos -->
                                <rect x="160" y="12"  width="80" height="10" fill="rgba(255,255,255,0.1)" stroke="rgba(255,255,255,0.6)" stroke-width="1.5"/>
                                <rect x="160" y="538" width="80" height="10" fill="rgba(255,255,255,0.1)" stroke="rgba(255,255,255,0.6)" stroke-width="1.5"/>
                                <!-- Arcos de penales -->
                                <path d="M138,102 A62,62 0 0,0 262,102" fill="none" stroke="rgba(255,255,255,0.5)" stroke-width="1.5"/>
                                <path d="M138,458 A62,62 0 0,1 262,458" fill="none" stroke="rgba(255,255,255,0.5)" stroke-width="1.5"/>
                                <!-- Corners -->
                                <path d="M28,20 A8,8 0 0,1 20,28"   fill="none" stroke="rgba(255,255,255,0.5)" stroke-width="1.5"/>
                                <path d="M372,20 A8,8 0 0,0 380,28" fill="none" stroke="rgba(255,255,255,0.5)" stroke-width="1.5"/>
                                <path d="M28,540 A8,8 0 0,0 20,532" fill="none" stroke="rgba(255,255,255,0.5)" stroke-width="1.5"/>
                                <path d="M372,540 A8,8 0 0,1 380,532" fill="none" stroke="rgba(255,255,255,0.5)" stroke-width="1.5"/>
                                <!-- Capa de jugadores -->
                                <g id="tokens-layer"></g>
                            </svg>
                        </div>
                    </div>
                </div>
            </main>
        `;

        // ── Dibujar un jugador en la pizarra ─────────────────────────────────
        const _dibujarJugadorSVG = (svg, jugador, x, y) => {
            const ns     = 'http://www.w3.org/2000/svg';
            const R      = 20;
            const numero = jugador.jersey ?? '';
            const jId    = jugador.athlete?.id ?? jugador.jersey ?? Math.random().toString(36).slice(2);
            const nombre = (() => {
                const dn    = jugador.athlete?.displayName ?? '';
                const parts = dn.trim().split(' ');
                return (parts[parts.length - 1] ?? dn).substring(0, 10);
            })();

            const g = document.createElementNS(ns, 'g');
            g.setAttribute('transform', `translate(${x},${y})`);
            g.setAttribute('class', 'token-jugador');
            g.setAttribute('data-id', String(jId));
            g.style.cursor = 'pointer';
            g.addEventListener('click', () => window._resaltarJugador(String(jId), g));

            // Círculo principal
            const bg = document.createElementNS(ns, 'circle');
            bg.setAttribute('cx', '0'); bg.setAttribute('cy', '0'); bg.setAttribute('r', R);
            bg.setAttribute('fill', '#3a3a6a');
            bg.setAttribute('stroke', 'rgba(255,255,255,0.4)');
            bg.setAttribute('stroke-width', '1.5');
            g.appendChild(bg);

            // Número
            const numEl = document.createElementNS(ns, 'text');
            numEl.setAttribute('x', '0'); numEl.setAttribute('y', '1');
            numEl.setAttribute('text-anchor', 'middle');
            numEl.setAttribute('dominant-baseline', 'middle');
            numEl.setAttribute('font-size', '11');
            numEl.setAttribute('font-weight', '800');
            numEl.setAttribute('fill', '#ffffff');
            numEl.setAttribute('font-family', 'system-ui, sans-serif');
            numEl.textContent = numero;
            g.appendChild(numEl);

            // Pastilla nombre
            const nameBg = document.createElementNS(ns, 'rect');
            nameBg.setAttribute('x', '-26'); nameBg.setAttribute('y', String(R + 3));
            nameBg.setAttribute('width', '52'); nameBg.setAttribute('height', '14');
            nameBg.setAttribute('rx', '4');
            nameBg.setAttribute('fill', 'rgba(0,0,0,0.65)');
            g.appendChild(nameBg);

            const nameEl = document.createElementNS(ns, 'text');
            nameEl.setAttribute('x', '0'); nameEl.setAttribute('y', String(R + 11));
            nameEl.setAttribute('text-anchor', 'middle');
            nameEl.setAttribute('dominant-baseline', 'middle');
            nameEl.setAttribute('font-size', '7.5');
            nameEl.setAttribute('font-weight', '600');
            nameEl.setAttribute('fill', '#ffffff');
            nameEl.setAttribute('font-family', 'system-ui, sans-serif');
            nameEl.textContent = nombre;
            g.appendChild(nameEl);

            return g;
        };

        // ── Renderizar pizarra principal ──────────────────────────────────────
        const _renderizarPizarra = (summaryJSON) => {
            const tituloEl    = document.getElementById('pizarra-titulo');
            const pizarraSvg  = document.getElementById('pizarra-svg');
            const tokensLayer = pizarraSvg?.querySelector('#tokens-layer');
            if (!pizarraSvg || !tokensLayer) return;

            const teamRoster = (summaryJSON.rosters ?? []).find(r => r.team?.id === String(equipoId));
            const formacion  = teamRoster?.formation ?? '?';
            const titulares  = (teamRoster?.roster ?? [])
                .filter(j => j.starter === true && j.formationPlace >= 1 && j.formationPlace <= 11)
                .sort((a, b) => a.formationPlace - b.formationPlace);

            if (tituloEl) tituloEl.textContent = `Disposición Táctica (${formacion})`;
            tokensLayer.innerHTML = '';
            if (titulares.length === 0) return;

            // Usar el sistema centralizado de coordenadas
            const coordsMap = _calcularPosicionesTacticas(titulares, 400, 560);

            titulares.forEach(j => {
                const coords = coordsMap.get(j.formationPlace);
                if (!coords) return;
                tokensLayer.appendChild(_dibujarJugadorSVG(pizarraSvg, j, coords.x, coords.y));
            });
        };

        // ── Seleccionar partido y cargar stats + pizarra ──────────────────────
        window._seleccionarPartido = async (idx) => {
            partidos.forEach((_, i) => {
                const chip = document.getElementById(`chip-partido-${i}`);
                if (!chip) return;
                chip.style.border     = i === idx ? '2px solid var(--accent-neon)' : '2px solid var(--border-glass)';
                chip.style.background = i === idx ? 'rgba(57,255,20,0.12)' : 'rgba(255,255,255,0.04)';
                chip.style.color      = i === idx ? 'var(--accent-neon)' : 'var(--text-muted)';
            });

            const container = document.getElementById('stats-partido-container');
            if (!container) return;

            const partido = partidos[idx];

            if (!partido.jugado) {
                container.innerHTML = `
                    <div class="glass-panel" style="padding: 1.5rem; grid-column: 1 / -1; text-align:center;">
                        <p style="font-size: 2rem;">📅</p>
                        <p style="color:var(--text-muted); margin-top:8px;">Este partido aún no se jugó.</p>
                        <p style="color:var(--accent-neon); font-weight:700; font-size:1.1rem; margin-top:4px;">${partido.resultado}</p>
                    </div>`;
                return;
            }

            container.innerHTML = `
                <div class="glass-panel" style="padding: 1.5rem; grid-column: 1 / -1; text-align:center;">
                    <div style="width:30px; height:30px; border:3px solid var(--accent-neon); border-right-color:transparent; border-radius:50%; animation:spin 1s linear infinite; margin:0 auto;"></div>
                    <p style="color:var(--text-muted); margin-top:10px; font-size:0.9rem;">Cargando stats de vs ${partido.rival}...</p>
                </div>`;

            try {
                const summaryRes  = await fetch(`${CF_WORKER}/?url=${encodeURIComponent(`https://site.api.espn.com/apis/site/v2/sports/soccer/${espnLeague}/summary?event=${partido.id}`)}`);
                const summaryJSON = summaryRes.ok ? await summaryRes.json() : {};
                const stats       = extraerStatsDeSummary(summaryJSON, equipoId);

                container.innerHTML = `
                    <div class="glass-panel" style="padding: 1.5rem;">
                        <h3 class="panel-title" style="border-bottom:1px solid var(--border-glass); padding-bottom:8px; margin-bottom:10px; font-size:1.1rem;">⚽ Goleadores</h3>
                        ${renderLista(stats.goles, '⚽', 'GOLES')}
                    </div>
                    <div class="glass-panel" style="padding: 1.5rem;">
                        <h3 class="panel-title" style="border-bottom:1px solid var(--border-glass); padding-bottom:8px; margin-bottom:10px; font-size:1.1rem;">🎯 Asistidores</h3>
                        ${renderLista(stats.asistencias, '👟', 'ASIST.')}
                    </div>
                    <div class="glass-panel" style="padding: 1.5rem;">
                        <h3 class="panel-title" style="border-bottom:1px solid var(--border-glass); padding-bottom:8px; margin-bottom:10px; font-size:1.1rem;">🟨 T. Amarillas</h3>
                        ${renderLista(stats.amarillas, '🟨', 'TARJ.')}
                    </div>
                    <div class="glass-panel" style="padding: 1.5rem;">
                        <h3 class="panel-title" style="border-bottom:1px solid var(--border-glass); padding-bottom:8px; margin-bottom:10px; font-size:1.1rem;">🟥 T. Rojas</h3>
                        ${renderLista(stats.rojas, '🟥', 'TARJ.')}
                    </div>`;

                _renderizarPizarra(summaryJSON);

            } catch (err) {
                container.innerHTML = `<div class="glass-panel" style="padding:1.5rem; grid-column:1/-1; text-align:center;"><p style="color:var(--text-muted);">Error cargando estadísticas.</p></div>`;
            }
        };

        // ── Resaltar jugador al clickear en la pizarra ────────────────────────
        window._resaltarJugador = (jugadorId, tokenEl) => {
            document.querySelectorAll('.roster-item-js').forEach(el => {
                el.style.background = '';
                el.style.borderLeft = '';
            });
            document.querySelectorAll('.token-jugador circle:first-child').forEach(el => {
                el.setAttribute('stroke', 'rgba(255,255,255,0.4)');
                el.setAttribute('stroke-width', '1.5');
            });

            const circle = tokenEl?.querySelector('circle');
            if (circle) {
                circle.setAttribute('stroke', 'var(--accent-neon)');
                circle.setAttribute('stroke-width', '3');
            }

            document.querySelectorAll('.roster-item-js').forEach(item => {
                if (item.dataset.id === String(jugadorId)) {
                    item.style.background = 'rgba(57,255,20,0.12)';
                    item.style.borderLeft = '3px solid var(--accent-neon)';
                    item.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                }
            });
        };

        const primerJugado = partidos.findIndex(p => p.jugado);
        if (primerJugado >= 0) {
            window._seleccionarPartido(primerJugado);
        } else if (partidos.length > 0) {
            window._seleccionarPartido(0);
        } else {
            const container = document.getElementById('stats-partido-container');
            if (container) container.innerHTML = `
                <div class="glass-panel" style="padding:1.5rem; grid-column:1/-1; text-align:center;">
                    <p style="color:var(--text-muted); font-style:italic;">Este equipo aún no tiene partidos registrados en ESPN.</p>
                </div>`;
        }
    };

    // ── H2H ──────────────────────────────────────────────────────────────────
    const renderH2H = async () => {
        const CF_WORKER = 'https://elfulbo.solgoyhe.workers.dev';

        const EQUIPOS_MUNDIAL = [
            {id:'203',n:'México',fl:'🇲🇽'},{id:'467',n:'Sudáfrica',fl:'🇿🇦'},{id:'451',n:'Corea del Sur',fl:'🇰🇷'},{id:'450',n:'Czechia',fl:'🇨🇿'},
            {id:'206',n:'Canadá',fl:'🇨🇦'},{id:'475',n:'Suiza',fl:'🇨🇭'},{id:'4398',n:'Catar',fl:'🇶🇦'},{id:'452',n:'Bosnia-Herz.',fl:'🇧🇦'},
            {id:'205',n:'Brasil',fl:'🇧🇷'},{id:'2869',n:'Marruecos',fl:'🇲🇦'},{id:'2654',n:'Haití',fl:'🇭🇹'},{id:'580',n:'Escocia',fl:'🏴󠁧󠁢󠁳󠁣󠁴󠁿'},
            {id:'660',n:'Estados Unidos',fl:'🇺🇸'},{id:'210',n:'Paraguay',fl:'🇵🇾'},{id:'628',n:'Australia',fl:'🇦🇺'},{id:'465',n:'Türkiye',fl:'🇹🇷'},
            {id:'481',n:'Alemania',fl:'🇩🇪'},{id:'11678',n:'Curaçao',fl:'🇨🇼'},{id:'4789',n:'Costa de Marfil',fl:'🇨🇮'},{id:'209',n:'Ecuador',fl:'🇪🇨'},
            {id:'449',n:'Países Bajos',fl:'🇳🇱'},{id:'627',n:'Japón',fl:'🇯🇵'},{id:'466',n:'Suecia',fl:'🇸🇪'},{id:'659',n:'Túnez',fl:'🇹🇳'},
            {id:'459',n:'Bélgica',fl:'🇧🇪'},{id:'2620',n:'Egipto',fl:'🇪🇬'},{id:'469',n:'Irán',fl:'🇮🇷'},{id:'2666',n:'Nueva Zelanda',fl:'🇳🇿'},
            {id:'164',n:'España',fl:'🇪🇸'},{id:'2597',n:'Cabo Verde',fl:'🇨🇻'},{id:'655',n:'Arabia Saudita',fl:'🇸🇦'},{id:'212',n:'Uruguay',fl:'🇺🇾'},
            {id:'478',n:'Francia',fl:'🇫🇷'},{id:'654',n:'Senegal',fl:'🇸🇳'},{id:'464',n:'Noruega',fl:'🇳🇴'},{id:'4375',n:'Irak',fl:'🇮🇶'},
            {id:'202',n:'Argentina',fl:'🇦🇷'},{id:'624',n:'Argelia',fl:'🇩🇿'},{id:'474',n:'Austria',fl:'🇦🇹'},{id:'2917',n:'Jordania',fl:'🇯🇴'},
            {id:'482',n:'Portugal',fl:'🇵🇹'},{id:'2850',n:'Congo RD',fl:'🇨🇩'},{id:'2570',n:'Uzbekistán',fl:'🇺🇿'},{id:'208',n:'Colombia',fl:'🇨🇴'},
            {id:'448',n:'Inglaterra',fl:'🏴󠁧󠁢󠁥󠁮󠁧󠁿'},{id:'477',n:'Croacia',fl:'🇭🇷'},{id:'4469',n:'Ghana',fl:'🇬🇭'},{id:'2659',n:'Panamá',fl:'🇵🇦'},
        ];

        const opcionesHTML = EQUIPOS_MUNDIAL.map(e =>
            `<option value="${e.id}">${e.fl} ${e.n}</option>`
        ).join('');

        appContainer.innerHTML = `
            ${renderNavbar('#/h2h')}
            <main class="page-container fade-in" style="max-width: 700px; margin: 0 auto;">
                <h2 class="section-title">⚔️ Head to Head</h2>

                <div class="glass-panel" style="padding: 1.5rem; margin-bottom: 1.5rem;">
                    <div style="display: grid; grid-template-columns: 1fr auto 1fr; align-items: center; gap: 1rem;">
                        <div>
                            <label style="font-size:0.75rem; color:var(--text-muted); text-transform:uppercase; letter-spacing:1px; display:block; margin-bottom:6px;">Equipo Local</label>
                            <select id="h2h-team-a" style="width:100%; background:var(--surface-color); color:var(--text-main); border:1px solid var(--border-glass); border-radius:8px; padding:10px; font-size:0.9rem; cursor:pointer;">
                                ${opcionesHTML}
                            </select>
                        </div>
                        <div style="text-align:center; font-family:var(--font-heading); font-size:1.4rem; font-weight:900; color:var(--accent-neon);">VS</div>
                        <div>
                            <label style="font-size:0.75rem; color:var(--text-muted); text-transform:uppercase; letter-spacing:1px; display:block; margin-bottom:6px;">Equipo Visitante</label>
                            <select id="h2h-team-b" style="width:100%; background:var(--surface-color); color:var(--text-main); border:1px solid var(--border-glass); border-radius:8px; padding:10px; font-size:0.9rem; cursor:pointer;">
                                ${opcionesHTML}
                            </select>
                        </div>
                    </div>
                    <button id="h2h-buscar" style="width:100%; margin-top:1rem; padding:12px; background:var(--accent-neon); color:#000; font-weight:800; font-family:var(--font-heading); border:none; border-radius:8px; cursor:pointer; font-size:1rem; letter-spacing:1px; transition: opacity 0.2s;">
                        ANALIZAR
                    </button>
                </div>

                <div id="h2h-resultado"></div>
            </main>
        `;

        document.getElementById('h2h-team-a').value = '202';
        document.getElementById('h2h-team-b').value = '478';

        // ── Stat bar ─────────────────────────────────────────────────────────
        const statBar = (labelA, valA, labelB, valB, titulo) => {
            const total = (valA + valB) || 1;
            const pctA  = Math.round((valA / total) * 100);
            const pctB  = 100 - pctA;
            return `
                <div style="margin-bottom:1.2rem;">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:5px;">
                        <span style="font-weight:700; font-size:1rem; color:var(--text-main);">${valA}</span>
                        <span style="font-size:0.75rem; color:var(--text-muted); text-transform:uppercase; letter-spacing:1px;">${titulo}</span>
                        <span style="font-weight:700; font-size:1rem; color:var(--accent-neon);">${valB}</span>
                    </div>
                    <div style="display:flex; height:6px; border-radius:3px; overflow:hidden; background:rgba(255,255,255,0.08);">
                        <div style="width:${pctA}%; background:var(--text-main); transition:width 0.6s;"></div>
                        <div style="width:${pctB}%; background:var(--accent-neon); transition:width 0.6s;"></div>
                    </div>
                </div>
            `;
        };

        // ── Mini pizarra SVG (H2H) — usa el sistema centralizado ─────────────
        const miniPizarra = (roster, teamId, colorCamiseta, colorNum) => {
            if (!roster) return '<p style="color:var(--text-muted); text-align:center; font-size:0.85rem; padding:1rem;">Sin datos de alineación.</p>';

            const titulares = (roster.roster ?? [])
                .filter(j => j.starter === true && j.formationPlace >= 1 && j.formationPlace <= 11)
                .sort((a, b) => a.formationPlace - b.formationPlace);

            if (titulares.length === 0) return '<p style="color:var(--text-muted); text-align:center; font-size:0.85rem; padding:1rem;">Sin titulares confirmados.</p>';

            const W = 300, H = 400;

            // Usar el sistema centralizado con dimensiones de la mini pizarra
            const coordsMap = _calcularPosicionesTacticas(titulares, W, H);

            let tokens = '';
            titulares.forEach(j => {
                const c = coordsMap.get(j.formationPlace);
                if (!c) return;
                const nombre = (j.athlete?.displayName ?? '').split(' ').pop().substring(0, 9);
                const num = j.jersey ?? '';
                tokens += `
                    <g transform="translate(${c.x},${c.y})">
                        <circle cx="0" cy="0" r="14" fill="${colorCamiseta}" stroke="rgba(255,255,255,0.3)" stroke-width="1"/>
                        <text x="0" y="1" text-anchor="middle" dominant-baseline="middle" font-size="8" font-weight="800" fill="${colorNum}" font-family="system-ui">${num}</text>
                        <rect x="-18" y="17" width="36" height="11" rx="3" fill="rgba(0,0,0,0.6)"/>
                        <text x="0" y="23.5" text-anchor="middle" dominant-baseline="middle" font-size="6" font-weight="600" fill="#fff" font-family="system-ui">${nombre}</text>
                    </g>`;
            });

            return `
                <svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" style="width:100%; display:block; border-radius:8px;">
                    <defs>
                        <pattern id="mini-stripes-${teamId}" patternUnits="userSpaceOnUse" width="${W}" height="36">
                            <rect width="${W}" height="18" y="0" fill="#27792a"/>
                            <rect width="${W}" height="18" y="18" fill="#1e6622"/>
                        </pattern>
                    </defs>
                    <rect width="${W}" height="${H}" fill="url(#mini-stripes-${teamId})" rx="8"/>
                    <rect x="12" y="10" width="${W-24}" height="${H-20}" fill="none" stroke="rgba(255,255,255,0.4)" stroke-width="1"/>
                    <line x1="12" y1="${H/2}" x2="${W-12}" y2="${H/2}" stroke="rgba(255,255,255,0.4)" stroke-width="1"/>
                    <circle cx="${W/2}" cy="${H/2}" r="${W*0.14}" fill="none" stroke="rgba(255,255,255,0.4)" stroke-width="1"/>
                    <rect x="${W*0.25}" y="10" width="${W*0.5}" height="${H*0.13}" fill="none" stroke="rgba(255,255,255,0.4)" stroke-width="1"/>
                    <rect x="${W*0.25}" y="${H-10-H*0.13}" width="${W*0.5}" height="${H*0.13}" fill="none" stroke="rgba(255,255,255,0.4)" stroke-width="1"/>
                    <g>${tokens}</g>
                </svg>`;
        };

        // ── Análisis H2H ──────────────────────────────────────────────────────
        const analizarH2H = async () => {
            const idA = document.getElementById('h2h-team-a').value;
            const idB = document.getElementById('h2h-team-b').value;
            if (idA === idB) {
                document.getElementById('h2h-resultado').innerHTML = `<p style="color:#ff4757; text-align:center; padding:1rem;">Seleccioná dos equipos distintos.</p>`;
                return;
            }
            const equipoA = EQUIPOS_MUNDIAL.find(e => e.id === idA);
            const equipoB = EQUIPOS_MUNDIAL.find(e => e.id === idB);

            const res = document.getElementById('h2h-resultado');
            res.innerHTML = `
                <div style="text-align:center; padding:3rem;">
                    <div style="width:40px; height:40px; border:3px solid var(--accent-neon); border-right-color:transparent; border-radius:50%; animation:spin 1s linear infinite; margin:0 auto;"></div>
                    <p style="color:var(--accent-neon); margin-top:1rem; font-family:var(--font-heading); text-transform:uppercase; letter-spacing:1px;">Analizando enfrentamiento...</p>
                </div>`;

            try {
                const fechas = [];
                for (let d = 11; d <= 27; d++) fechas.push(`202606${String(d).padStart(2,'0')}`);

                const scoreboards = await Promise.all(
                    fechas.map(f => fetch(`${CF_WORKER}/?url=${encodeURIComponent(`https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard?dates=${f}`)}`).then(r => r.ok ? r.json().catch(()=>({})) : {}))
                );

                const todosEventos = scoreboards.flatMap(sb => sb.events ?? []);
                const vistos = new Set();
                const eventosUnicos = todosEventos.filter(ev => { if (vistos.has(ev.id)) return false; vistos.add(ev.id); return true; });

                let partidoDirecto = null;
                for (const ev of eventosUnicos) {
                    const comp = ev.competitions?.[0];
                    const ids = comp?.competitors?.map(c => c.team?.id) ?? [];
                    if (ids.includes(idA) && ids.includes(idB)) { partidoDirecto = ev; break; }
                }

                const partidosA = eventosUnicos.filter(ev => (ev.competitions?.[0]?.competitors?.map(c => c.team?.id) ?? []).includes(idA));
                const partidosB = eventosUnicos.filter(ev => (ev.competitions?.[0]?.competitors?.map(c => c.team?.id) ?? []).includes(idB));

                let summaryData = null, teamAStats = null, teamBStats = null;
                let probabilidades = null, rosterA = null, rosterB = null;
                let goleadoresA = [], goleadoresB = [];

                if (partidoDirecto) {
                    const eventId = partidoDirecto.id;
                    const [sumRes, probRes] = await Promise.all([
                        fetch(`${CF_WORKER}/?url=${encodeURIComponent(`https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/summary?event=${eventId}`)}`),
                        fetch(`${CF_WORKER}/?url=${encodeURIComponent(`https://sports.core.api.espn.com/v2/sports/soccer/leagues/fifa.world/events/${eventId}/competitions/${eventId}/probabilities?limit=1`)}`)
                    ]);
                    summaryData = sumRes.ok ? await sumRes.json().catch(()=>null) : null;
                    const probJSON = probRes.ok ? await probRes.json().catch(()=>null) : null;

                    if (summaryData) {
                        const comp = partidoDirecto.competitions?.[0];
                        const compA = comp?.competitors?.find(c => c.team?.id === idA);
                        const compB = comp?.competitors?.find(c => c.team?.id === idB);
                        const getStat = (competitor, name) => parseFloat(competitor?.statistics?.find(s => s.name === name)?.displayValue ?? '0') || 0;

                        teamAStats = {
                            posesion: getStat(compA, 'possessionPct'), tiros: getStat(compA, 'totalShots'),
                            tirosPuerta: getStat(compA, 'shotsOnTarget'), faltas: getStat(compA, 'foulsCommitted'),
                            corners: getStat(compA, 'wonCorners'), score: compA?.score ?? '-',
                        };
                        teamBStats = {
                            posesion: getStat(compB, 'possessionPct'), tiros: getStat(compB, 'totalShots'),
                            tirosPuerta: getStat(compB, 'shotsOnTarget'), faltas: getStat(compB, 'foulsCommitted'),
                            corners: getStat(compB, 'wonCorners'), score: compB?.score ?? '-',
                        };

                        if (probJSON?.items?.length > 0) {
                            const last = probJSON.items[probJSON.items.length - 1];
                            probabilidades = {
                                homeWin: Math.round((last.homeWinPercentage ?? 0.5) * 100),
                                awayWin: Math.round((last.awayWinPercentage ?? 0.3) * 100),
                                draw:    Math.round((last.tiePercentage ?? 0.2) * 100),
                            };
                        }

                        (summaryData.keyEvents ?? []).forEach(ev => {
                            if (!ev.scoringPlay) return;
                            const nombre = ev.participants?.[0]?.athlete?.displayName ?? '';
                            const minuto = ev.clock?.displayValue ?? '';
                            if (ev.team?.id === idA) goleadoresA.push({nombre, minuto});
                            else if (ev.team?.id === idB) goleadoresB.push({nombre, minuto});
                        });

                        rosterA = (summaryData.rosters ?? []).find(r => r.team?.id === idA);
                        rosterB = (summaryData.rosters ?? []).find(r => r.team?.id === idB);
                    }
                }

                const calcForma = (partidos, teamId) => partidos
                    .filter(ev => ev.competitions?.[0]?.status?.type?.state === 'post')
                    .slice(0, 5)
                    .map(ev => {
                        const comp  = ev.competitions?.[0];
                        const yo    = comp?.competitors?.find(c => c.team?.id === teamId);
                        const rival = comp?.competitors?.find(c => c.team?.id !== teamId);
                        const misGoles  = parseInt(yo?.score ?? '0');
                        const susGoles  = parseInt(rival?.score ?? '0');
                        if (misGoles > susGoles) return {r:'W', color:'#39ff14'};
                        if (misGoles < susGoles) return {r:'D', color:'#ff4757'};
                        return {r:'E', color:'#ffd700'};
                    });

                const formaA = calcForma(partidosA, idA);
                const formaB = calcForma(partidosB, idB);
                const formaHTML = (forma) => forma.length === 0
                    ? '<span style="color:var(--text-muted); font-size:0.8rem;">Sin partidos</span>'
                    : forma.map(f => `<span style="display:inline-block; width:24px; height:24px; border-radius:50%; background:${f.color}; color:#000; font-size:0.7rem; font-weight:800; line-height:24px; text-align:center; margin:0 2px;">${f.r}</span>`).join('');

                const logoA = `https://a.espncdn.com/i/teamlogos/countries/500/${equipoA.n.toLowerCase().replace(/ /g,'_').replace(/[^a-z_]/g,'')}.png`;
                const logoB = `https://a.espncdn.com/i/teamlogos/countries/500/${equipoB.n.toLowerCase().replace(/ /g,'_').replace(/[^a-z_]/g,'')}.png`;

                const estado = partidoDirecto?.competitions?.[0]?.status?.type;
                const esLive = estado?.state === 'in';
                const esPost = estado?.state === 'post';
                const estadoBadge = esLive
                    ? `<span style="background:#ff4757; color:#fff; padding:4px 12px; border-radius:20px; font-size:0.75rem; font-weight:800; animation:pulse 1s infinite;">● EN VIVO</span>`
                    : esPost
                        ? `<span style="background:rgba(255,255,255,0.1); color:var(--text-muted); padding:4px 12px; border-radius:20px; font-size:0.75rem;">FINALIZADO</span>`
                        : `<span style="background:rgba(57,255,20,0.15); color:var(--accent-neon); padding:4px 12px; border-radius:20px; font-size:0.75rem; font-weight:700;">${partidoDirecto ? (estado?.detail ?? 'PRÓXIMO') : 'SIN PARTIDO DIRECTO'}</span>`;

                res.innerHTML = `
                    <!-- CABECERA DEL PARTIDO -->
                    <div class="glass-panel" style="padding:1.5rem; text-align:center; margin-bottom:1.5rem;">
                        <div style="margin-bottom:0.8rem;">${estadoBadge}</div>
                        <div style="display:grid; grid-template-columns:1fr auto 1fr; align-items:center; gap:1rem;">
                            <div>
                                <img src="${logoA}" onerror="this.style.display='none'" width="60" height="60" style="object-fit:contain; margin-bottom:8px;">
                                <div style="font-family:var(--font-heading); font-weight:800; font-size:1.1rem;">${equipoA.fl} ${equipoA.n.toUpperCase()}</div>
                                <div style="margin-top:6px;">${formaHTML(formaA)}</div>
                            </div>
                            <div style="font-family:var(--font-heading); font-size:${(esPost||esLive)?'2.5rem':'1.5rem'}; font-weight:900; color:${(esPost||esLive)?'var(--text-main)':'var(--text-muted)'};">
                                ${(esPost||esLive) ? `${teamAStats?.score ?? '-'} : ${teamBStats?.score ?? '-'}` : 'vs'}
                            </div>
                            <div>
                                <img src="${logoB}" onerror="this.style.display='none'" width="60" height="60" style="object-fit:contain; margin-bottom:8px;">
                                <div style="font-family:var(--font-heading); font-weight:800; font-size:1.1rem;">${equipoB.fl} ${equipoB.n.toUpperCase()}</div>
                                <div style="margin-top:6px;">${formaHTML(formaB)}</div>
                            </div>
                        </div>
                        ${(goleadoresA.length > 0 || goleadoresB.length > 0) ? `
                        <div style="margin-top:1rem; display:grid; grid-template-columns:1fr 1fr; gap:1rem; font-size:0.85rem; color:var(--text-muted);">
                            <div style="text-align:left;">${goleadoresA.map(g=>`⚽ ${g.nombre} <span style="color:var(--text-muted)">${g.minuto}</span>`).join('<br>')}</div>
                            <div style="text-align:right;">${goleadoresB.map(g=>`${g.minuto} ${g.nombre} ⚽`).join('<br>')}</div>
                        </div>` : ''}
                    </div>

                    ${probabilidades ? `
                    <div class="glass-panel" style="padding:1.5rem; margin-bottom:1.5rem;">
                        <h3 class="panel-title" style="text-align:center; color:var(--accent-neon); font-size:0.8rem; letter-spacing:2px;">PROBABILIDAD DE VICTORIA</h3>
                        <div style="display:grid; grid-template-columns:1fr 1fr 1fr; text-align:center; margin-bottom:1rem; gap:0.5rem;">
                            <div style="background:rgba(255,255,255,0.05); border-radius:8px; padding:12px;">
                                <div style="font-size:1.6rem; font-weight:900; color:var(--text-main);">${probabilidades.homeWin}%</div>
                                <div style="font-size:0.7rem; color:var(--text-muted); margin-top:2px;">VICTORIA ${equipoA.fl}</div>
                            </div>
                            <div style="background:rgba(255,255,255,0.05); border-radius:8px; padding:12px;">
                                <div style="font-size:1.6rem; font-weight:900; color:#ffd700;">${probabilidades.draw}%</div>
                                <div style="font-size:0.7rem; color:var(--text-muted); margin-top:2px;">EMPATE</div>
                            </div>
                            <div style="background:rgba(255,255,255,0.05); border-radius:8px; padding:12px;">
                                <div style="font-size:1.6rem; font-weight:900; color:var(--accent-neon);">${probabilidades.awayWin}%</div>
                                <div style="font-size:0.7rem; color:var(--text-muted); margin-top:2px;">VICTORIA ${equipoB.fl}</div>
                            </div>
                        </div>
                    </div>` : ''}

                    ${(teamAStats && teamBStats) ? `
                    <div class="glass-panel" style="padding:1.5rem; margin-bottom:1.5rem;">
                        <h3 class="panel-title" style="text-align:center; color:var(--accent-neon); font-size:0.8rem; letter-spacing:2px;">ESTADÍSTICAS DEL PARTIDO</h3>
                        ${statBar(equipoA.n, teamAStats.posesion, equipoB.n, teamBStats.posesion, 'POSESIÓN %')}
                        ${statBar(equipoA.n, teamAStats.tiros, equipoB.n, teamBStats.tiros, 'TIROS TOTALES')}
                        ${statBar(equipoA.n, teamAStats.tirosPuerta, equipoB.n, teamBStats.tirosPuerta, 'TIROS A PUERTA')}
                        ${statBar(equipoA.n, teamAStats.corners, equipoB.n, teamBStats.corners, 'CORNERS')}
                        ${statBar(equipoA.n, teamAStats.faltas, equipoB.n, teamBStats.faltas, 'FALTAS')}
                    </div>` : ''}

                    <!-- PARTIDOS EN EL MUNDIAL -->
                    <div class="glass-panel" style="padding:1.5rem; margin-bottom:1.5rem;">
                        <h3 class="panel-title" style="text-align:center; color:var(--accent-neon); font-size:0.8rem; letter-spacing:2px;">PARTIDOS EN EL MUNDIAL 2026</h3>
                        ${[...partidosA, ...partidosB]
                            .filter((v,i,a) => a.findIndex(e=>e.id===v.id)===i)
                            .filter(ev => ['post','in'].includes(ev.competitions?.[0]?.status?.type?.state))
                            .sort((a,b) => new Date(a.date) - new Date(b.date))
                            .map(ev => {
                                const comp  = ev.competitions?.[0];
                                const home  = comp?.competitors?.find(c => c.homeAway === 'home');
                                const away  = comp?.competitors?.find(c => c.homeAway === 'away');
                                const esEste = [home?.team?.id, away?.team?.id].includes(idA) && [home?.team?.id, away?.team?.id].includes(idB);
                                const live  = comp?.status?.type?.state === 'in';
                                return `
                                <div style="display:flex; justify-content:space-between; align-items:center; padding:10px 0; border-bottom:1px solid var(--border-glass); ${esEste ? 'background:rgba(57,255,20,0.05); margin:0 -0.5rem; padding:10px 0.5rem; border-radius:6px;' : ''}">
                                    <div style="display:flex; flex-direction:column; gap:3px; flex:1;">
                                        <span style="font-size:0.9rem; font-weight:${esEste?'700':'400'};">${home?.team?.displayName ?? '?'}</span>
                                        <span style="font-size:0.9rem; color:var(--text-muted); font-weight:${esEste?'700':'400'};">${away?.team?.displayName ?? '?'}</span>
                                    </div>
                                    <div style="text-align:right;">
                                        <div style="font-family:var(--font-heading); font-weight:800; font-size:1.1rem; color:${esEste?'var(--accent-neon)':'var(--text-main)'};">
                                            ${home?.score ?? '-'} - ${away?.score ?? '-'}
                                        </div>
                                        ${live ? '<span style="color:#ff4757; font-size:0.7rem; font-weight:800;">● VIVO</span>' : `<span style="color:var(--text-muted); font-size:0.7rem;">${comp?.status?.type?.shortDetail ?? 'FT'}</span>`}
                                    </div>
                                </div>`;
                            }).join('') || '<p style="color:var(--text-muted); text-align:center; font-size:0.85rem; padding:0.5rem;">Sin partidos jugados aún.</p>'
                        }
                    </div>

                    ${(rosterA || rosterB) ? `
                    <!-- ALINEACIONES -->
                    <div class="glass-panel" style="padding:1.5rem; margin-bottom:1.5rem;">
                        <h3 class="panel-title" style="text-align:center; color:var(--accent-neon); font-size:0.8rem; letter-spacing:2px; margin-bottom:1rem;">ALINEACIONES</h3>
                        <div style="display:grid; grid-template-columns:1fr 1fr; gap:1rem;">
                            <div>
                                <p style="text-align:center; font-weight:700; margin-bottom:8px; font-size:0.9rem;">${equipoA.fl} ${equipoA.n} <span style="color:var(--text-muted); font-size:0.75rem;">${rosterA?.formation ?? ''}</span></p>
                                ${miniPizarra(rosterA, idA, '#e8e8f0', '#1a1a2e')}
                            </div>
                            <div>
                                <p style="text-align:center; font-weight:700; margin-bottom:8px; font-size:0.9rem;">${equipoB.fl} ${equipoB.n} <span style="color:var(--text-muted); font-size:0.75rem;">${rosterB?.formation ?? ''}</span></p>
                                ${miniPizarra(rosterB, idB, '#cc2222', '#ffffff')}
                            </div>
                        </div>
                    </div>` : ''}

                    <!-- GOLEADORES DEL TORNEO -->
                    <div class="glass-panel" style="padding:1.5rem; margin-bottom:4rem;">
                        <h3 class="panel-title" style="text-align:center; color:var(--accent-neon); font-size:0.8rem; letter-spacing:2px; margin-bottom:1rem;">GOLEADORES EN EL MUNDIAL</h3>
                        <div style="display:grid; grid-template-columns:1fr 1fr; gap:1rem;">
                            <div>
                                ${(() => {
                                    const goleadores = {};
                                    partidosA.filter(ev => ev.competitions?.[0]?.status?.type?.state === 'post').forEach(ev => {
                                        (ev.competitions?.[0]?.details ?? []).forEach(d => {
                                            if (!d.scoringPlay || d.ownGoal) return;
                                            if (d.team?.id !== idA) return;
                                            const nombre = d.athletesInvolved?.[0]?.displayName;
                                            if (nombre) goleadores[nombre] = (goleadores[nombre] ?? 0) + 1;
                                        });
                                    });
                                    const top = Object.entries(goleadores).sort((a,b)=>b[1]-a[1]).slice(0,5);
                                    return top.length > 0
                                        ? top.map(([n,g]) => `<div style="display:flex; justify-content:space-between; padding:7px 0; border-bottom:1px solid var(--border-glass); font-size:0.88rem;"><span>⚽ ${n}</span><span style="font-weight:800; color:var(--accent-neon);">${g}</span></div>`).join('')
                                        : '<p style="color:var(--text-muted); font-size:0.8rem; text-align:center;">Sin goles aún</p>';
                                })()}
                            </div>
                            <div>
                                ${(() => {
                                    const goleadores = {};
                                    partidosB.filter(ev => ev.competitions?.[0]?.status?.type?.state === 'post').forEach(ev => {
                                        (ev.competitions?.[0]?.details ?? []).forEach(d => {
                                            if (!d.scoringPlay || d.ownGoal) return;
                                            if (d.team?.id !== idB) return;
                                            const nombre = d.athletesInvolved?.[0]?.displayName;
                                            if (nombre) goleadores[nombre] = (goleadores[nombre] ?? 0) + 1;
                                        });
                                    });
                                    const top = Object.entries(goleadores).sort((a,b)=>b[1]-a[1]).slice(0,5);
                                    return top.length > 0
                                        ? top.map(([n,g]) => `<div style="display:flex; justify-content:space-between; padding:7px 0; border-bottom:1px solid var(--border-glass); font-size:0.88rem;"><span>⚽ ${n}</span><span style="font-weight:800; color:var(--accent-neon);">${g}</span></div>`).join('')
                                        : '<p style="color:var(--text-muted); font-size:0.8rem; text-align:center;">Sin goles aún</p>';
                                })()}
                            </div>
                        </div>
                    </div>
                `;

            } catch(err) {
                console.error('[H2H]', err);
                document.getElementById('h2h-resultado').innerHTML = `<p style="color:#ff4757; text-align:center; padding:2rem;">Error cargando datos. Intentá de nuevo.</p>`;
            }
        };

        document.getElementById('h2h-buscar').addEventListener('click', analizarH2H);
        analizarH2H();
    };

    // ── INFO ──────────────────────────────────────────────────────────────────
    const renderInfo = () => {
        appContainer.innerHTML = `
            ${renderNavbar('#/info')}
            <main class="page-container fade-in">
                <h2 class="section-title">📰 Info & Noticias</h2>
                <div class="news-grid">
                    <article class="news-card">
                        <div class="news-image-placeholder">🤝</div>
                        <div class="news-content">
                            <div class="news-header">
                                <span class="news-tag tag-mercado">Mercado</span>
                                <span class="news-date">Hace 2 horas</span>
                            </div>
                            <h3 class="news-title">Acuerdo total: El fichaje más caro de la historia</h3>
                            <p class="news-excerpt">Fuentes cercanas al club confirman que las negociaciones han llegado a buen puerto.</p>
                            <a href="javascript:void(0)" class="news-read-more">Leer completo →</a>
                        </div>
                    </article>
                    <article class="news-card">
                        <div class="news-image-placeholder">🎙️</div>
                        <div class="news-content">
                            <div class="news-header">
                                <span class="news-tag tag-declaracion">Declaraciones</span>
                                <span class="news-date">Hace 5 horas</span>
                            </div>
                            <h3 class="news-title">"El arbitraje de hoy fue una verdadera vergüenza"</h3>
                            <p class="news-excerpt">El presidente del club explotó en conferencia de prensa tras el polémico empate.</p>
                            <a href="javascript:void(0)" class="news-read-more">Ver video →</a>
                        </div>
                    </article>
                    <article class="news-card">
                        <div class="news-image-placeholder">🚑</div>
                        <div class="news-content">
                            <div class="news-header">
                                <span class="news-tag tag-lesion">Reporte Médico</span>
                                <span class="news-date">Ayer</span>
                            </div>
                            <h3 class="news-title">Rotura de ligamentos: Se despide de la temporada</h3>
                            <p class="news-excerpt">El cuerpo médico confirmó los peores temores. El capitán será operado este viernes.</p>
                            <a href="javascript:void(0)" class="news-read-more">Ver parte médico →</a>
                        </div>
                    </article>
                </div>
            </main>
        `;
    };

    // ── LOGIN ─────────────────────────────────────────────────────────────────
    const renderLogin = () => {
        appContainer.innerHTML = `
            <main class="login-view fade-in">
                <div class="login-card">
                    <div class="login-logo">EL <span>FULBO</span></div>
                    <div id="form-contenedor">
                        <div class="input-container">
                            <label>Dirección de Email</label>
                            <input type="email" id="auth-email" class="glass-input" placeholder="manager@elfulbo.com" autocomplete="off">
                        </div>
                        <div class="input-container">
                            <label>Contraseña</label>
                            <input type="password" id="auth-password" class="glass-input" placeholder="••••••••">
                        </div>
                        <div id="auth-error-log" style="color: #ff4757; font-size: 0.85rem; margin-bottom: 1rem; min-height: 20px;"></div>
                        <button id="auth-submit-trigger" class="btn-submit">Ingresar al Sistema</button>
                    </div>
                </div>
            </main>
        `;

        const btnSubmit     = document.getElementById('auth-submit-trigger');
        const emailInput    = document.getElementById('auth-email');
        const passwordInput = document.getElementById('auth-password');
        const errorFeedback = document.getElementById('auth-error-log');

        const executeAuthentication = () => {
            errorFeedback.textContent       = '';
            emailInput.style.borderColor    = '';
            passwordInput.style.borderColor = '';

            if (!Auth.login(emailInput.value, passwordInput.value)) {
                errorFeedback.textContent       = 'Acceso denegado. Verifique los campos.';
                emailInput.style.borderColor    = '#ff4757';
                passwordInput.style.borderColor = '#ff4757';
            }
        };

        btnSubmit.addEventListener('click', executeAuthentication);
        passwordInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') executeAuthentication(); });
    };

    // ── ROUTER ────────────────────────────────────────────────────────────────
    const router = async () => {
        const hash = window.location.hash || '#/home';
        const url  = new URL(`http://dummy.com${hash.replace('#', '')}`);
        const path = '#' + url.pathname;

        if (!Auth.isAuthenticated() && path !== '#/login') {
            window.location.hash = '#/login';
            return;
        }

        switch (path) {
            case '#/login':
                Auth.isAuthenticated() ? window.location.hash = '#/home' : renderLogin();
                break;
            case '#/home':
                renderHome();
                break;
            case '#/ligas':
                renderLigas();
                break;
            case '#/liga':
                await renderLigaDetalle(url.searchParams.get('id'));
                break;
            case '#/grupo':
                await renderGrupoDetalle(url.searchParams.get('id'));
                break;
            case '#/equipo':
                await renderEquipoDetalle(
                    url.searchParams.get('id'),
                    url.searchParams.get('liga'),
                    url.searchParams.get('name')
                );
                break;
            case '#/h2h':
                await renderH2H();
                break;
            case '#/info':
                renderInfo();
                break;
            default:
                appContainer.innerHTML = `
                    ${renderNavbar(path)}
                    <main class="page-container fade-in" style="text-align: center; padding-top: 15%;">
                        <h2 class="section-title" style="border: none; color: var(--accent-neon);">Módulo en desarrollo</h2>
                    </main>
                `;
                break;
        }
    };

    const init = () => {
        window.addEventListener('hashchange', router);
        window.addEventListener('load', router);
    };

    return { init };
})();

App.init();
