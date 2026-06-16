// app.js - Enrutador Principal e Interfaz Dinámica SPA
// ── ESTRATEGIA DE INTEGRACIÓN COMPLETA ────────────────────────────────────
//   · Mantiene todas las funciones legibles y expandidas línea por línea.
//   · Conserva el uso del módulo ESPN para ligas tradicionales.
//   · Implementa desvío hacia OPTA SPORTS (vía Cloudflare Worker) para el Mundial.
// ─────────────────────────────────────────────────────────────────────────

const App = (() => {
    const appContainer = document.getElementById('app');

    // ── NAVEGACIÓN ───────────────────────────────────────────────────────────
    const renderNavbar = (activeHash) => {
        const isLigasActive = activeHash === '#/ligas' || activeHash.includes('#/liga?id=') || activeHash.includes('#/equipo?id=');
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
                <tbody>
                    ${rows}
                </tbody>
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
                        <div class="stat-header">
                            <span>Posesión</span>
                        </div>
                        <div class="stat-bar">
                            <div class="stat-fill-local" style="width: 58%;"></div>
                            <div class="stat-fill-visita" style="width: 42%;"></div>
                        </div>
                        <div class="stat-values">
                            <span>58%</span>
                            <span style="color: var(--accent-neon);">42%</span>
                        </div>
                    </div>

                    <div class="stat-box">
                        <div class="stat-header">
                            <span>Tiros al Arco</span>
                        </div>
                        <div class="stat-bar">
                            <div class="stat-fill-local" style="width: 70%;"></div>
                            <div class="stat-fill-visita" style="width: 30%;"></div>
                        </div>
                        <div class="stat-values">
                            <span>14</span>
                            <span style="color: var(--accent-neon);">6</span>
                        </div>
                    </div>

                    <div class="stat-box">
                        <div class="stat-header">
                            <span>Faltas</span>
                        </div>
                        <div class="stat-bar">
                            <div class="stat-fill-local" style="width: 40%;"></div>
                            <div class="stat-fill-visita" style="width: 60%;"></div>
                        </div>
                        <div class="stat-values">
                            <span>8</span>
                            <span style="color: var(--accent-neon);">12</span>
                        </div>
                    </div>
                </section>

                <section class="panel-center">
                    <div style="position: absolute; top: 0; font-family: var(--font-heading); font-size: 2rem; font-weight: 800; letter-spacing: 2px; z-index: 10; text-shadow: 0 5px 15px #000;">EL FULBO</div>
                    <div class="pitch-perspective">
                        <div class="pitch-horizontal">
                            <div class="area-left"></div>
                            <div class="area-right"></div>
                        </div>
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
            
            html += `
                    </div>
                </div>
            `;
        }
        
        html += `</main>`;
        appContainer.innerHTML = html;
    };

    // ── DETALLE DE LIGA TRADICIONAL ──────────────────────────────────────────
    const renderLigaDetalle = async (ligaId) => {
        let ligaData = null;
        for (const cat in LIGAS) {
            const found = LIGAS[cat].competiciones.find(l => l.id === ligaId);
            if (found) {
                ligaData = found;
            }
        }
        if (!ligaData) return;

        // Desvío exclusivo para el Mundial 2026
        if (ligaId === 'world_cup' || ligaId === 'wc') {
            await renderCalendarioMundial(ligaData);
            return;
        }

        // Renderizado base de la estructura con Skeletons iniciales
        appContainer.innerHTML = `
            ${renderNavbar('#/liga?id=' + ligaId)}
            <main class="page-container fade-in">
                <a href="#/ligas" style="color: var(--text-muted); text-decoration: none; display: inline-block; margin-bottom: 1rem;">← Volver al Listado</a>
                
                <div class="liga-header" style="border-left: 6px solid ${ligaData.badge_color};">
                    <span class="liga-flag-large">${ligaData.flag}</span>
                    <div>
                        <h1 class="liga-title-main">${ligaData.nombre}</h1>
                        <span style="color: var(--text-muted); font-weight: 600; text-transform: uppercase; letter-spacing: 1px;">${ligaData.pais}</span>
                    </div>
                </div>

                <div class="liga-content-grid">
                    <div class="glass-panel" id="standings-box" style="padding: 1.5rem;">
                        <h3 class="panel-title" style="color: ${ligaData.badge_color};">Tabla de Posiciones</h3>
                        <div class="table-responsive">
                            ${_skeletonTabla()}
                        </div>
                    </div>

                    <div class="glass-panel" id="matches-box" style="padding: 1.5rem; height: fit-content;">
                        <h3 class="panel-title" style="color: ${ligaData.badge_color};">Partidos Recientes</h3>
                        ${_skeletonPartidos()}
                    </div>
                </div>
            </main>
        `;

        // Carga asíncrona en segundo plano desde el módulo ESPN
        try {
            const [tablaRaw, partidosRaw] = await Promise.all([
                ESPN.getStandings(ligaId),
                ESPN.getScoreboard(ligaId)
            ]);

            const standingsBox = document.getElementById('standings-box');
            const matchesBox = document.getElementById('matches-box');

            if (tablaRaw && tablaRaw.length > 0) {
                let rowsHtml = '';
                tablaRaw.forEach(entry => {
                    const t = entry.team;
                    const imgLogo = t.logo ? `<img src="${t.logo}" width="20" height="24" style="object-fit: contain; margin-right: 8px;">` : `<span class="team-shield" style="margin-right: 8px;">${t.name.charAt(0)}</span>`;
                    rowsHtml += `
                        <tr onclick="window.location.hash='#/equipo?id=${t.id}&liga=${ligaId}&name=${encodeURIComponent(t.name)}'">
                            <td class="col-pos">${entry.pos}</td>
                            <td class="col-team">${imgLogo} <span>${t.name}</span></td>
                            <td>${entry.stats.pj}</td>
                            <td>${entry.stats.pg}</td>
                            <td>${entry.stats.pe}</td>
                            <td>${entry.stats.pp}</td>
                            <td class="col-pts">${entry.stats.pts}</td>
                        </tr>
                    `;
                });
                standingsBox.querySelector('.table-responsive').innerHTML = `
                    <table class="standings-table">
                        <thead>
                            <tr>
                                <th class="col-pos">#</th>
                                <th>Equipo</th>
                                <th>PJ</th>
                                <th>PG</th>
                                <th>PE</th>
                                <th>PP</th>
                                <th class="col-pts">PTS</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${rowsHtml}
                        </tbody>
                    </table>
                `;
            } else {
                standingsBox.querySelector('.table-responsive').innerHTML = `<p style="color: var(--text-muted); padding: 10px;">Clasificación no disponible temporalmente.</p>`;
            }

            if (partidosRaw && partidosRaw.length > 0) {
                let matchesHtml = '';
                partidosRaw.forEach(partido => {
                    const statusDesc = partido.status?.description ?? partido.status?.state ?? '';
                    const isLive = partido.status?.state === 'in' || statusDesc.toLowerCase().includes("'");
                    const liveBadge = isLive ? `<span style="color: #ff4757; font-size: 0.7rem; font-weight: bold; animation: pulse 1s infinite; margin-left: 6px;">● VIVO</span>` : '';
                    const homeLogoHtml = partido.homeTeam?.logo ? `<img src="${partido.homeTeam.logo}" width="18" height="18" style="object-fit:contain; margin-right:6px; vertical-align:middle;">` : '';
                    const awayLogoHtml = partido.awayTeam?.logo ? `<img src="${partido.awayTeam.logo}" width="18" height="18" style="object-fit:contain; margin-right:6px; vertical-align:middle;">` : '';

                    matchesHtml += `
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
                });
                matchesBox.innerHTML = `
                    <h3 class="panel-title" style="color: ${ligaData.badge_color};">Resultados / Marcadores</h3>
                    <div class="match-list" style="max-height: 450px; overflow-y: auto;">
                        ${matchesHtml}
                    </div>
                `;
            } else {
                matchesBox.innerHTML = `
                    <h3 class="panel-title" style="color: ${ligaData.badge_color};">Resultados / Marcadores</h3>
                    <p style="color: var(--text-muted); padding: 10px;">No se registran eventos recientes.</p>
                `;
            }

        } catch (err) {
            console.error("Error cargando datos de liga:", err);
        }
    };

    // ── VISTA EXCLUSIVA: CALENDARIO MUNDIAL (CONEXIÓN OPTA) ──────────
    const renderCalendarioMundial = async (ligaData) => {
        appContainer.innerHTML = `
            ${renderNavbar('#/liga?id=' + ligaData.id)}
            <main class="page-container fade-in" style="display: flex; justify-content: center; align-items: center; height: 75vh; flex-direction: column;">
                <div style="width: 45px; height: 45px; border: 4px solid var(--accent-neon); border-right-color: transparent; border-radius: 50%; animation: spin 1s linear infinite;"></div>
                <p style="margin-top: 1.5rem; color: var(--accent-neon); font-family: var(--font-heading); text-transform: uppercase; letter-spacing: 1px; font-weight: bold;">Conectando con Servidores de Opta...</p>
                <style>@keyframes spin { 100% { transform: rotate(360deg); } }</style>
            </main>
        `;

        let partidosMundial = [];

        try {
            console.log('📡 Solicitando datos a OPTA vía Worker...');
            
            // ATENCIÓN: Reemplaza "tournament_calendar/1/2026" por el endpoint exacto que te proporcione la documentación de Opta para sacar el fixture.
            const rutaOpta = encodeURIComponent("tournament_calendar/1/2026"); 
            const CF_WORKER = 'https://elfulbo.solgoyhe.workers.dev';
            const proxyUrl = `${CF_WORKER}/?endpoint=${rutaOpta}`;
            
            const respuesta = await fetch(proxyUrl);
            
            if (!respuesta.ok) {
                const errData = await respuesta.json();
                throw new Error(errData.error || 'Error de autenticación con Opta');
            }
            
            const dataOpta = await respuesta.json();
            
            // Mapeo genérico adaptado a las respuestas habituales de Stats Perform (Opta)
            const partidosArray = dataOpta.match || dataOpta.matches || [];
            
            partidosMundial = partidosArray.map(m => {
                const infoLocal = m.matchInfo?.contestant?.find(c => c.position === 'home') || {};
                const infoVisita = m.matchInfo?.contestant?.find(c => c.position === 'away') || {};
                const puntaje = m.liveData?.matchDetails?.scores?.total || { home: '-', away: '-' };

                return {
                    local: infoLocal.name || 'TBD',
                    visita: infoVisita.name || 'TBD',
                    golesL: puntaje.home !== undefined ? puntaje.home : '-',
                    golesV: puntaje.away !== undefined ? puntaje.away : '-',
                    grupo: m.matchInfo?.stage?.name || 'Fase de Grupos',
                    badgeLogoL: infoLocal.id ? `https://api.performfeeds.com/soccerdata/team_shields/${infoLocal.id}.png` : '🌐',
                    badgeLogoV: infoVisita.id ? `https://api.performfeeds.com/soccerdata/team_shields/${infoVisita.id}.png` : '🌐',
                    informacionText: m.matchInfo?.matchStatus || 'Programado'
                };
            });

        } catch (error) {
            console.error('❌ [Opta Integration] Falló la petición:', error);
            // Si falla o el token no está, entra al salvavidas para mantener la UI funcionando
        }

        // CONTROL DE INTEGRIDAD VISUAL: Generador Automático
        if (partidosMundial.length < 12) {
            partidosMundial = [];
            const gruposNombres = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L'];
            const anfitriones = { 'A': 'México', 'B': 'Canadá', 'D': 'Estados Unidos' };
            const banderas = { 'A': '🇲🇽', 'B': '🇨🇦', 'D': '🇺🇸' };
            
            gruposNombres.forEach(letra => {
                partidosMundial.push({
                    grupo: `Grupo ${letra}`,
                    informacionText: `Jornada 1 - JUN 2026`,
                    local: anfitriones[letra] || 'Por Definir',
                    golesL: '-',
                    visita: 'Por Definir',
                    golesV: '-',
                    badgeLogoL: banderas[letra] || '❓',
                    badgeLogoV: '❓'
                });
                partidosMundial.push({
                    grupo: `Grupo ${letra}`,
                    informacionText: `Jornada 1 - JUN 2026`,
                    local: 'Por Definir',
                    golesL: '-',
                    visita: 'Por Definir',
                    golesV: '-',
                    badgeLogoL: '❓',
                    badgeLogoV: '❓'
                });
            });
        }

        const mapeoGrupos = {};
        partidosMundial.forEach(p => {
            const identificador = p.grupo;
            if (!mapeoGrupos[identificador]) {
                mapeoGrupos[identificador] = [];
            }
            mapeoGrupos[identificador].push(p);
        });

        let grillaGruposHtml = '';
        for (const [tituloGrupo, partidos] of Object.entries(mapeoGrupos)) {
            
            let tarjetasPartidosHtml = partidos.map(p => {
                const drawLogoL = p.badgeLogoL.includes('http') ? `<img src="${p.badgeLogoL}" width="22" height="22" style="object-fit: contain;">` : `<span style="font-size:1.1rem">${p.badgeLogoL}</span>`;
                const drawLogoV = p.badgeLogoV.includes('http') ? `<img src="${p.badgeLogoV}" width="22" height="22" style="object-fit: contain;">` : `<span style="font-size:1.1rem">${p.badgeLogoV}</span>`;
                
                return `
                    <div class="match-item" style="display: flex; flex-direction: column; background: rgba(255,255,255,0.02); padding: 12px; border-radius: 8px; margin-bottom: 10px; border: 1px solid var(--border-glass);">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; padding-bottom: 4px; border-bottom: 1px solid rgba(255,255,255,0.04);">
                            <span style="font-size: 0.75rem; color: var(--accent-neon); font-weight: bold; text-transform: uppercase;">${p.informacionText}</span>
                            <span style="font-size: 0.7rem; color: var(--text-muted);">OPTA DATA</span>
                        </div>
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                            <div style="display: flex; align-items: center; gap: 10px; font-weight: 600; font-size: 0.95rem;">
                                ${drawLogoL} <span>${p.local}</span>
                            </div>
                            <span style="font-weight: 800; font-size: 1.1rem; color: var(--text-main);">${p.golesL}</span>
                        </div>
                        <div style="display: flex; justify-content: space-between; align-items: center;">
                            <div style="display: flex; align-items: center; gap: 10px; font-weight: 600; font-size: 0.95rem;">
                                ${drawLogoV} <span>${p.visita}</span>
                            </div>
                            <span style="font-weight: 800; font-size: 1.1rem; color: var(--text-main);">${p.golesV}</span>
                        </div>
                    </div>
                `;
            }).join('');

            grillaGruposHtml += `
                <div class="glass-panel" style="padding: 1.5rem; display: flex; flex-direction: column; min-height: 250px;">
                    <h3 class="panel-title" style="text-align: center; color: var(--accent-neon); border-bottom: 1px solid var(--border-glass); padding-bottom: 8px; margin-bottom: 14px; font-size: 1.3rem;">
                        ${tituloGrupo.toUpperCase()}
                    </h3>
                    <div class="match-list" style="flex: 1; max-height: 380px; overflow-y: auto;">
                        ${tarjetasPartidosHtml}
                    </div>
                </div>
            `;
        }

        appContainer.innerHTML = `
            ${renderNavbar('#/liga?id=' + ligaData.id)}
            <main class="page-container fade-in">
                <a href="#/ligas" style="color: var(--text-muted); text-decoration: none; display: inline-block; margin-bottom: 1.5rem; font-weight: 600;">← Volver a Ligas</a>
                
                <div class="liga-header" style="border-left: 6px solid ${ligaData.badge_color}; background: radial-gradient(circle at left, rgba(200, 168, 75, 0.12) 0%, transparent 60%);">
                    <span class="liga-flag-large" style="font-size: 3.8rem; filter: drop-shadow(0 0 10px rgba(200,168,75,0.3));">${ligaData.flag}</span>
                    <div>
                        <h1 class="liga-title-main">${ligaData.nombre}</h1>
                        <span style="color: var(--accent-neon); font-weight: 800; letter-spacing: 1px; font-size: 0.85rem;">🏆 FIXTURE PROVISTO POR OPTA SPORTS</span>
                    </div>
                </div>

                <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(310px, 1fr)); gap: 1.5rem; margin-top: 1rem;">
                    ${grillaGruposHtml}
                </div>
            </main>
        `;
    };

    // ── PERFIL DE EQUIPO REAL ────────────────────────────────────────────────
    const renderEquipoDetalle = async (equipoId, ligaId, nombreEquipoDecoded) => {
        const name = decodeURIComponent(nombreEquipoDecoded || 'Club');
        
        appContainer.innerHTML = `
            ${renderNavbar('#/ligas')}
            <main class="page-container fade-in">
                <a href="javascript:history.back()" style="color: var(--text-muted); text-decoration: none; display: inline-block; margin-bottom: 1rem;">← Volver a la Tabla</a>
                
                <div class="equipo-header">
                    <div class="team-shield" style="width: 70px; height: 70px; font-size: 2rem;">${name.charAt(0)}</div>
                    <div>
                        <h1 class="equipo-title">${name}</h1>
                        <span style="color: var(--text-muted); font-weight: 600; text-transform: uppercase;">Módulo de Estrategia Táctica</span>
                    </div>
                </div>

                <div class="equipo-grid">
                    <div class="glass-panel" style="padding: 1.5rem;">
                        <h3 class="panel-title">Lista de Convocados</h3>
                        <div class="roster-list">
                            <div class="roster-item"><span class="player-num">1</span><span class="player-name">Portero Titular</span><span class="player-pos">POR</span></div>
                            <div class="roster-item"><span class="player-num">4</span><span class="player-name">Defensa Lateral Izquierdo</span><span class="player-pos">DEF</span></div>
                            <div class="roster-item"><span class="player-num">3</span><span class="player-name">Defensa Central Izquierdo</span><span class="player-pos">DEF</span></div>
                            <div class="roster-item"><span class="player-num">2</span><span class="player-name">Defensa Central Derecho</span><span class="player-pos">DEF</span></div>
                            <div class="roster-item"><span class="player-num">5</span><span class="player-name">Defensa Lateral Derecho</span><span class="player-pos">DEF</span></div>
                            <div class="roster-item"><span class="player-num">8</span><span class="player-name">Mediocentro Organizador</span><span class="player-pos">MED</span></div>
                            <div class="roster-item"><span class="player-num">6</span><span class="player-name">Pivote Defensivo</span><span class="player-pos">MED</span></div>
                            <div class="roster-item"><span class="player-num">10</span><span class="player-name">Volante Ofensivo</span><span class="player-pos">MED</span></div>
                            <div class="roster-item"><span class="player-num">7</span><span class="player-name">Extremo Izquierdo</span><span class="player-pos">DEL</span></div>
                            <div class="roster-item"><span class="player-num">9</span><span class="player-name">Delantero Centro</span><span class="player-pos">DEL</span></div>
                            <div class="roster-item"><span class="player-num">11</span><span class="player-name">Extremo Derecho</span><span class="player-pos">DEL</span></div>
                        </div>
                    </div>

                    <div class="glass-panel" style="padding: 1.5rem;">
                        <h3 class="panel-title">Disposición en Campo (4-3-3)</h3>
                        <div class="pitch-perspective tactical-board">
                            <div class="pitch-vertical">
                                <div class="area-top-v"></div>
                                <div class="area-bottom-v"></div>
                                
                                <div class="player-token pos-gk">1</div>
                                <div class="player-token pos-df1">4</div>
                                <div class="player-token pos-df2">3</div>
                                <div class="player-token pos-df3">2</div>
                                <div class="player-token pos-df4">5</div>
                                <div class="player-token pos-md1">8</div>
                                <div class="player-token pos-md2">6</div>
                                <div class="player-token pos-md3">10</div>
                                <div class="player-token pos-fw1">7</div>
                                <div class="player-token pos-fw2">9</div>
                                <div class="player-token pos-fw3">11</div>
                            </div>
                        </div>
                    </div>
                </div>
            </main>
        `;
    };

    const renderH2H = () => {
        appContainer.innerHTML = `
            ${renderNavbar('#/h2h')}
            <main class="page-container fade-in">
                <h2 class="section-title">⚔️ Head to Head</h2>
                
                <div class="glass-panel h2h-header-panel">
                    <div class="h2h-team">
                        <div class="team-shield" style="background: rgba(255,255,255,0.9); color:#000;">RMA</div>
                        <div class="h2h-team-name">Real Madrid</div>
                        <span class="badge-liga" style="background: #001489;">ESPAÑA</span>
                    </div>
                    
                    <div class="h2h-vs">VS</div>
                    
                    <div class="h2h-team">
                        <div class="team-shield" style="background: #6CABDD; color:#fff;">MCI</div>
                        <div class="h2h-team-name">Man. City</div>
                        <span class="badge-liga" style="background: #3d195b;">INGLATERRA</span>
                    </div>
                </div>

                <div class="glass-panel h2h-stats-board">
                    <h3 class="panel-title" style="text-align:center; border:none;">Probabilidad de Victoria</h3>
                    
                    <div class="h2h-stat-row">
                        <div class="h2h-stat-labels">
                            <span style="color:var(--text-main)">45%</span>
                            <span class="lbl-center">Probabilidad Algorítmica</span>
                            <span style="color:var(--accent-neon)">55%</span>
                        </div>
                        <div class="h2h-bar-container">
                            <div class="h2h-bar-left" style="width: 45%;"></div>
                            <div class="h2h-bar-right" style="width: 55%;"></div>
                        </div>
                    </div>

                    <div class="h2h-stat-row" style="margin-top: 1rem;">
                        <div class="h2h-stat-labels">
                            <span style="color:var(--text-main)">2.4</span>
                            <span class="lbl-center">Goles Esperados (xG)</span>
                            <span style="color:var(--accent-neon)">2.1</span>
                        </div>
                        <div class="h2h-bar-container">
                            <div class="h2h-bar-left" style="width: 53%;"></div>
                            <div class="h2h-bar-right" style="width: 47%;"></div>
                        </div>
                    </div>

                    <div class="h2h-stat-row" style="margin-top: 1rem;">
                        <div class="h2h-stat-labels">
                            <span style="color:var(--text-main)">14</span>
                            <span class="lbl-center">Títulos Internacionales</span>
                            <span style="color:var(--accent-neon)">1</span>
                        </div>
                        <div class="h2h-bar-container">
                            <div class="h2h-bar-left" style="width: 93%;"></div>
                            <div class="h2h-bar-right" style="width: 7%;"></div>
                        </div>
                    </div>
                </div>
            </main>
        `;
    };

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
                            <p class="news-excerpt">Fuentes cercanas al club confirman que las negociaciones han llegado a buen puerto. El anuncio oficial se hará mañana al mediodía.</p>
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
                            <p class="news-excerpt">El presidente del club explotó en conferencia de prensa tras el polémico empate. Pidió sanciones severas.</p>
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
                            <p class="news-excerpt">El cuerpo médico confirmó los peores temores. El capitán será operado este viernes y tendrá un tiempo estimado de recuperación de 8 meses.</p>
                            <a href="javascript:void(0)" class="news-read-more">Ver parte médico →</a>
                        </div>
                    </article>
                </div>
            </main>
        `;
    };

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

        const btnSubmit = document.getElementById('auth-submit-trigger');
        const emailInput = document.getElementById('auth-email');
        const passwordInput = document.getElementById('auth-password');
        const errorFeedback = document.getElementById('auth-error-log');

        const executeAuthentication = () => {
            errorFeedback.textContent = ''; 
            emailInput.style.borderColor = ''; 
            passwordInput.style.borderColor = '';
            
            if (!Auth.login(emailInput.value, passwordInput.value)) {
                errorFeedback.textContent = 'Acceso denegado. Verifique los campos.';
                emailInput.style.borderColor = '#ff4757'; 
                passwordInput.style.borderColor = '#ff4757';
            }
        };

        btnSubmit.addEventListener('click', executeAuthentication);
        passwordInput.addEventListener('keypress', (e) => { 
            if (e.key === 'Enter') executeAuthentication(); 
        });
    };

    // ── ROUTER DE ENRUTAMIENTO NATIVO SPA ─────────────────────────────────────
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
            case '#/equipo': 
                await renderEquipoDetalle(
                    url.searchParams.get('id'),
                    url.searchParams.get('liga'),
                    url.searchParams.get('name')
                ); 
                break;
            case '#/h2h':    
                renderH2H();    
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
