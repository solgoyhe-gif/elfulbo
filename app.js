// app.js - Enrutador Principal e Interfaz Dinámica SPA
// ── ESTRATEGIA DE INTEGRACIÓN COMPLETA ────────────────────────────────────
//   · Conserva todos los módulos originales (H2H, Info, Home, Ligas).
//   · Tablas de Posiciones por Grupos para el Mundial 2026.
//   · Extracción Agresiva de Estadísticas Reales (Soporta múltiples formatos ESPN).
//   · Pizarra Táctica Flexbox (Corrige posiciones invertidas).
//   · Nuevo Módulo de Análisis de Equipo, Jugador y Partido.
// ─────────────────────────────────────────────────────────────────────────

const App = (() => {
    const appContainer = document.getElementById('app');

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

        try {
            const [tablaRaw, partidosRaw] = await Promise.all([
                ESPN.getStandings(ligaId),
                ESPN.getScoreboard(ligaId)
            ]);

            const standingsBox = document.getElementById('standings-box');
            const matchesBox = document.getElementById('matches-box');

            if (tablaRaw && tablaRaw.length > 0) {
                let rowsHtml = tablaRaw.map(entry => {
                    const t = entry.team;
                    const imgLogo = t.logo ? `<img src="${t.logo}" width="20" height="24" style="object-fit: contain; margin-right: 8px;">` : `<span class="team-shield" style="margin-right: 8px;">${t.name.charAt(0)}</span>`;
                    return `
                        <tr onclick="window.location.hash='#/equipo?id=${t.id}&liga=${ligaId}&name=${encodeURIComponent(t.name)}'" style="cursor: pointer;">
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
                        <tbody>${rowsHtml}</tbody>
                    </table>
                `;
            } else {
                standingsBox.querySelector('.table-responsive').innerHTML = `<p style="color: var(--text-muted); padding: 10px;">Clasificación no disponible temporalmente.</p>`;
            }

            if (partidosRaw && partidosRaw.length > 0) {
                let matchesHtml = partidosRaw.map(partido => {
                    const statusDesc = partido.status?.description ?? partido.status?.state ?? '';
                    const isLive = partido.status?.state === 'in' || statusDesc.toLowerCase().includes("'");
                    const liveBadge = isLive ? `<span style="color: #ff4757; font-size: 0.7rem; font-weight: bold; animation: pulse 1s infinite; margin-left: 6px;">● VIVO</span>` : '';
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
            const espnUrl = 'https://site.api.espn.com/apis/v2/sports/soccer/fifa.world/standings';
            const espnProxyUrl = `${CF_WORKER}/?url=${encodeURIComponent(espnUrl)}`;
            const respuestaEspn = await fetch(espnProxyUrl);
            if (!respuestaEspn.ok) throw new Error('ESPN Standings falló');
            
            const parsedEspn = await respuestaEspn.json();

            if (parsedEspn.children && parsedEspn.children.length > 0) {
                gruposData = parsedEspn.children.map(grupo => {
                    const equipos = grupo.standings?.entries?.map(e => {
                        const stats = e.stats || [];
                        const findStat = (name) => stats.find(s => s.name === name)?.value || 0;
                        return {
                            id: e.team.id,
                            nombre: e.team.name,
                            logo: e.team.logos?.[0]?.href || '🌐',
                            pj: findStat('gamesPlayed'),
                            pts: findStat('points'),
                            dif: findStat('pointDifferential')
                        };
                    }) || [];

                    equipos.sort((a, b) => b.pts - a.pts || b.dif - a.dif);
                    return { nombre: grupo.name.replace(/Group /i, 'GRUPO ').toUpperCase(), equipos: equipos };
                });
                gruposData.sort((a, b) => a.nombre.localeCompare(b.nombre));
            } else {
                throw new Error('Array de grupos vacío');
            }
        } catch (error) {
            // Mock Estricto con IDs oficiales ESPN en caso de no iniciar torneo aún
            const mockEquipos = {
                'GRUPO A': [{n:'México', fl:'🇲🇽', id:'203'}, {n:'Alemania', fl:'🇩🇪', id:'481'}, {n:'Japón', fl:'🇯🇵', id:'627'}, {n:'Mali', fl:'🇲🇱', id:'636'}],
                'GRUPO B': [{n:'Canadá', fl:'🇨🇦', id:'1845'}, {n:'España', fl:'🇪🇸', id:'483'}, {n:'Colombia', fl:'🇨🇴', id:'211'}, {n:'Corea del Sur', fl:'🇰🇷', id:'632'}],
                'GRUPO C': [{n:'Estados Unidos', fl:'🇺🇸', id:'660'}, {n:'Francia', fl:'🇫🇷', id:'478'}, {n:'Senegal', fl:'🇸🇳', id:'651'}, {n:'Arabia Saudita', fl:'🇸🇦', id:'648'}],
                'GRUPO D': [{n:'Argentina', fl:'🇦🇷', id:'202'}, {n:'Inglaterra', fl:'🏴󠁧󠁢󠁥󠁮󠁧󠁿', id:'474'}, {n:'Ecuador', fl:'🇪🇨', id:'212'}, {n:'Costa Rica', fl:'🇨🇷', id:'210'}],
                'GRUPO E': [{n:'Brasil', fl:'🇧🇷', id:'205'}, {n:'Países Bajos', fl:'🇳🇱', id:'449'}, {n:'Marruecos', fl:'🇲🇦', id:'639'}, {n:'Australia', fl:'🇦🇺', id:'628'}],
                'GRUPO F': [{n:'Portugal', fl:'🇵🇹', id:'482'}, {n:'Croacia', fl:'🇭🇷', id:'477'}, {n:'Uruguay', fl:'🇺🇾', id:'214'}, {n:'Catar', fl:'🇶🇦', id:'646'}],
                'GRUPO G': [{n:'Italia', fl:'🇮🇹', id:'104'}, {n:'Bélgica', fl:'🇧🇪', id:'473'}, {n:'Suecia', fl:'🇸🇪', id:'484'}, {n:'Egipto', fl:'🇪🇬', id:'630'}],
                'GRUPO H': [{n:'Suiza', fl:'🇨🇭', id:'485'}, {n:'Nigeria', fl:'🇳🇬', id:'643'}, {n:'Irán', fl:'🇮🇷', id:'631'}, {n:'Gales', fl:'🏴󠁧󠁢󠁷󠁬󠁳󠁿', id:'476'}],
                'GRUPO I': [{n:'Dinamarca', fl:'🇩🇰', id:'479'}, {n:'Serbia', fl:'🇷🇸', id:'486'}, {n:'Chile', fl:'🇨🇱', id:'207'}, {n:'Perú', fl:'🇵🇪', id:'213'}],
                'GRUPO J': [{n:'Polonia', fl:'🇵🇱', id:'480'}, {n:'Costa de Marfil', fl:'🇨🇮', id:'633'}, {n:'Irak', fl:'🇮🇶', id:'644'}, {n:'Jamaica', fl:'🇯🇲', id:'654'}],
                'GRUPO K': [{n:'Austria', fl:'🇦🇹', id:'472'}, {n:'Ucrania', fl:'🇺🇦', id:'2970'}, {n:'Camerún', fl:'🇨🇲', id:'629'}, {n:'Argelia', fl:'🇩🇿', id:'626'}],
                'GRUPO L': [{n:'Turquía', fl:'🇹🇷', id:'487'}, {n:'Hungría', fl:'🇭🇺', id:'488'}, {n:'Panamá', fl:'🇵🇦', id:'659'}, {n:'Venezuela', fl:'🇻🇪', id:'215'}]
            };

            for (const [nombreGrupo, equiposArr] of Object.entries(mockEquipos)) {
                gruposData.push({
                    nombre: nombreGrupo,
                    equipos: equiposArr.map(eq => ({
                        id: eq.id, nombre: eq.n, logo: eq.fl, pj: 0, pts: 0, dif: 0
                    }))
                });
            }
            gruposData.sort((a, b) => a.nombre.localeCompare(b.nombre));
        }

        let grillaGruposHtml = gruposData.map(grupo => {
            let filasTabla = grupo.equipos.map((eq, index) => {
                const logoHtml = eq.logo.includes('http') ? `<img src="${eq.logo}" width="20" height="20" style="object-fit: contain; margin-right: 8px;">` : `<span style="font-size:1.1rem; margin-right: 8px;">${eq.logo}</span>`;
                return `
                    <tr style="border-bottom: 1px solid rgba(255,255,255,0.03); cursor: pointer; transition: background 0.2s;" onmouseover="this.style.background='rgba(255,255,255,0.05)'" onmouseout="this.style.background='transparent'" onclick="window.location.hash='#/equipo?id=${eq.id}&liga=world_cup&name=${encodeURIComponent(eq.nombre)}'; event.stopPropagation();">
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
                    <h3 class="panel-title" style="text-align: center; color: var(--accent-neon); border-bottom: 1px solid var(--border-glass); padding-bottom: 8px; margin-bottom: 12px; font-size: 1.2rem; letter-spacing: 1px; cursor: pointer;" onclick="window.location.hash='#/grupo?id=${encodeURIComponent(grupo.nombre)}'">
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
                <p style="text-align: center; color: var(--text-muted); font-size: 0.85rem; margin-top: 1rem;">Selecciona el título de un grupo para ver estadísticas detalladas (GF, GC, DIF) o selecciona un equipo para ver a sus jugadores.</p>
                <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 1.5rem; margin-top: 1rem;">
                    ${grillaGruposHtml}
                </div>
            </main>
        `;
    };

    // ── VISTA MUNDIAL: DETALLE DE GRUPO (GF, GC, DIF) ────────
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
            const espnProxyUrl = `${CF_WORKER}/?url=${encodeURIComponent('https://site.api.espn.com/apis/v2/sports/soccer/fifa.world/standings')}`;
            const respuestaEspn = await fetch(espnProxyUrl);
            const parsedEspn = await respuestaEspn.json();

            const grupoEncontrado = parsedEspn.children?.find(g => g.name.replace(/Group /i, 'GRUPO ').toUpperCase() === grupoNombre);
            
            if (grupoEncontrado && grupoEncontrado.standings?.entries) {
                equipos = grupoEncontrado.standings.entries.map(e => {
                    const stats = e.stats || [];
                    const findStat = (name) => stats.find(s => s.name === name)?.value || 0;
                    return {
                        id: e.team.id,
                        nombre: e.team.name,
                        logo: e.team.logos?.[0]?.href || '🌐',
                        pj: findStat('gamesPlayed'),
                        gf: findStat('pointsFor'),
                        gc: findStat('pointsAgainst'),
                        dif: findStat('pointDifferential'),
                        pts: findStat('points')
                    };
                });
                equipos.sort((a, b) => b.pts - a.pts || b.dif - a.dif);
            } else throw new Error();
        } catch (err) {
            // Mock de seguridad en caso de caída
            const mapMockGrup = {
                'GRUPO A': [{n:'México', fl:'🇲🇽', id:'203'}, {n:'Alemania', fl:'🇩🇪', id:'481'}, {n:'Japón', fl:'🇯🇵', id:'627'}, {n:'Mali', fl:'🇲🇱', id:'636'}],
                'GRUPO B': [{n:'Canadá', fl:'🇨🇦', id:'1845'}, {n:'España', fl:'🇪🇸', id:'483'}, {n:'Colombia', fl:'🇨🇴', id:'211'}, {n:'Corea del Sur', fl:'🇰🇷', id:'632'}],
                'GRUPO C': [{n:'Estados Unidos', fl:'🇺🇸', id:'660'}, {n:'Francia', fl:'🇫🇷', id:'478'}, {n:'Senegal', fl:'🇸🇳', id:'651'}, {n:'Arabia Saudita', fl:'🇸🇦', id:'648'}],
                'GRUPO D': [{n:'Argentina', fl:'🇦🇷', id:'202'}, {n:'Inglaterra', fl:'🏴󠁧󠁢󠁥󠁮󠁧󠁿', id:'474'}, {n:'Ecuador', fl:'🇪🇨', id:'212'}, {n:'Costa Rica', fl:'🇨🇷', id:'210'}],
                'GRUPO E': [{n:'Brasil', fl:'🇧🇷', id:'205'}, {n:'Países Bajos', fl:'🇳🇱', id:'449'}, {n:'Marruecos', fl:'🇲🇦', id:'639'}, {n:'Australia', fl:'🇦🇺', id:'628'}],
                'GRUPO F': [{n:'Portugal', fl:'🇵🇹', id:'482'}, {n:'Croacia', fl:'🇭🇷', id:'477'}, {n:'Uruguay', fl:'🇺🇾', id:'214'}, {n:'Catar', fl:'🇶🇦', id:'646'}],
                'GRUPO G': [{n:'Italia', fl:'🇮🇹', id:'104'}, {n:'Bélgica', fl:'🇧🇪', id:'473'}, {n:'Suecia', fl:'🇸🇪', id:'484'}, {n:'Egipto', fl:'🇪🇬', id:'630'}],
                'GRUPO H': [{n:'Suiza', fl:'🇨🇭', id:'485'}, {n:'Nigeria', fl:'🇳🇬', id:'643'}, {n:'Irán', fl:'🇮🇷', id:'631'}, {n:'Gales', fl:'🏴󠁧󠁢󠁷󠁬󠁳󠁿', id:'476'}],
                'GRUPO I': [{n:'Dinamarca', fl:'🇩🇰', id:'479'}, {n:'Serbia', fl:'🇷🇸', id:'486'}, {n:'Chile', fl:'🇨🇱', id:'207'}, {n:'Perú', fl:'🇵🇪', id:'213'}],
                'GRUPO J': [{n:'Polonia', fl:'🇵🇱', id:'480'}, {n:'Costa de Marfil', fl:'🇨🇮', id:'633'}, {n:'Irak', fl:'🇮🇶', id:'644'}, {n:'Jamaica', fl:'🇯🇲', id:'654'}],
                'GRUPO K': [{n:'Austria', fl:'🇦🇹', id:'472'}, {n:'Ucrania', fl:'🇺🇦', id:'2970'}, {n:'Camerún', fl:'🇨🇲', id:'629'}, {n:'Argelia', fl:'🇩🇿', id:'626'}],
                'GRUPO L': [{n:'Turquía', fl:'🇹🇷', id:'487'}, {n:'Hungría', fl:'🇭🇺', id:'488'}, {n:'Panamá', fl:'🇵🇦', id:'659'}, {n:'Venezuela', fl:'🇻🇪', id:'215'}]
            };

            const target = mapMockGrup[grupoNombre] || mapMockGrup['GRUPO D'];
            equipos = target.map((eq, i) => ({
                id: eq.id, nombre: eq.n, logo: eq.fl, pj: 0, gf: 0, gc: 0, dif: 0, pts: 0
            }));
        }

        let filasHtml = equipos.map((eq, idx) => {
            const logoHtml = eq.logo.includes('http') ? `<img src="${eq.logo}" width="24" height="24" style="object-fit: contain; margin-right: 12px;">` : `<span style="font-size:1.3rem; margin-right: 12px;">${eq.logo}</span>`;
            return `
                <tr style="border-bottom: 1px solid var(--border-glass); cursor: pointer; transition: background 0.2s;" onmouseover="this.style.background='rgba(255,255,255,0.05)'" onmouseout="this.style.background='transparent'" onclick="window.location.hash='#/equipo?id=${eq.id}&liga=world_cup&name=${encodeURIComponent(eq.nombre)}'">
                    <td style="padding: 12px; font-weight: bold; color: var(--accent-neon);">${idx + 1}</td>
                    <td style="padding: 12px; display: flex; align-items: center; font-weight: 600; font-size: 1.05rem;">
                        ${logoHtml} ${eq.nombre}
                    </td>
                    <td style="padding: 12px; text-align: center;">${eq.pj}</td>
                    <td style="padding: 12px; text-align: center; color: #6CABDD;">${eq.gf}</td>
                    <td style="padding: 12px; text-align: center; color: #ff4757;">${eq.gc}</td>
                    <td style="padding: 12px; text-align: center; font-weight: bold;">${eq.dif > 0 ? '+'+eq.dif : eq.dif}</td>
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

    // ── VISTA MUNDIAL: PERFIL DE EQUIPO, ESTADÍSTICAS REALES Y ANÁLISIS ──
    const renderEquipoDetalle = async (equipoId, ligaId, nombreEquipoDecoded) => {
        const name = decodeURIComponent(nombreEquipoDecoded || 'Selección');
        
        appContainer.innerHTML = `
            ${renderNavbar('#/liga?id=world_cup')}
            <main class="page-container fade-in">
                <a href="javascript:history.back()" style="color: var(--text-muted); text-decoration: none; display: inline-block; margin-bottom: 1rem;">← Volver</a>
                <div style="display: flex; justify-content: center; align-items: center; height: 30vh; flex-direction: column;">
                    <div style="width: 45px; height: 45px; border: 4px solid var(--accent-neon); border-right-color: transparent; border-radius: 50%; animation: spin 1s linear infinite;"></div>
                    <p style="margin-top: 1.5rem; color: var(--accent-neon); font-family: var(--font-heading); text-transform: uppercase; letter-spacing: 1px;">Extrayendo datos de la Base de ESPN...</p>
                </div>
            </main>
        `;

        const CF_WORKER = 'https://elfulbo.solgoyhe.workers.dev';
        let convocados = [];
        let stats = { goles: [], asistencias: [], amarillas: [], rojas: [] };

        const extraerDatos = (rosterJSON, teamJSON) => {
            let tempConvocados = [];
            let tempStats = { goles: [], asistencias: [], amarillas: [], rojas: [] };
            
            let atletasArray = [];
            if (rosterJSON.athletes && rosterJSON.athletes[0] && rosterJSON.athletes[0].items) atletasArray = rosterJSON.athletes[0].items;
            else if (teamJSON.team && teamJSON.team.athletes) atletasArray = teamJSON.team.athletes;

            atletasArray.forEach(ath => {
                tempConvocados.push({
                    numero: ath.jersey || '-',
                    nombre: ath.displayName || ath.fullName || 'Jugador',
                    posicion: ath.position?.abbreviation || ath.position?.name || 'N/A'
                });
            });

            if (teamJSON.team && teamJSON.team.leaders) {
                const parseLeader = (keywords) => {
                    const cat = teamJSON.team.leaders.find(c => keywords.includes(c.name));
                    if (!cat || !cat.leaders) return [];
                    return cat.leaders.map(l => ({
                        nombre: l.athlete?.displayName || l.athlete?.shortName || l.athlete?.fullName || 'Desconocido',
                        valor: parseInt(l.value, 10) || parseInt(l.displayValue, 10) || 0
                    })).filter(l => l.valor > 0);
                };
                
                tempStats.goles = parseLeader(['goals', 'scoring']);
                tempStats.asistencias = parseLeader(['assists']);
                tempStats.amarillas = parseLeader(['yellowCards', 'yellow']);
                tempStats.rojas = parseLeader(['redCards', 'red']);
            }
            return { tempConvocados, tempStats };
        };

        if (equipoId && equipoId !== 'undefined') {
            try {
                // INTENTO 1: Data actual
                const [rosterRes, teamRes] = await Promise.all([
                    fetch(`${CF_WORKER}/?url=${encodeURIComponent(`https://site.api.espn.com/apis/site/v2/sports/soccer/all/teams/${equipoId}/roster`)}`),
                    fetch(`${CF_WORKER}/?url=${encodeURIComponent(`https://site.api.espn.com/apis/site/v2/sports/soccer/all/teams/${equipoId}`)}`)
                ]);
                let { tempConvocados, tempStats } = extraerDatos(rosterRes.ok ? await rosterRes.json() : {}, teamRes.ok ? await teamRes.json() : {});

                // INTENTO 2: Fallback al Mundial anterior (2022) si la base actual está en 0
                if (tempConvocados.length === 0 || tempStats.goles.length === 0) {
                    const [fRoster, fTeam] = await Promise.all([
                        fetch(`${CF_WORKER}/?url=${encodeURIComponent(`https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/teams/${equipoId}/roster?season=2022`)}`),
                        fetch(`${CF_WORKER}/?url=${encodeURIComponent(`https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/teams/${equipoId}?season=2022`)}`)
                    ]);
                    const fallback = extraerDatos(fRoster.ok ? await fRoster.json() : {}, fTeam.ok ? await fTeam.json() : {});
                    if (fallback.tempConvocados.length > 0) tempConvocados = fallback.tempConvocados;
                    if (fallback.tempStats.goles.length > 0) tempStats = fallback.tempStats;
                }

                convocados = tempConvocados;
                stats = tempStats;
            } catch (err) { console.warn("Error API", err); }
        }

        const ordenarYCortar = (arr) => arr.sort((a,b) => b.valor - a.valor).slice(0, 5);
        const goleadores = ordenarYCortar(stats.goles);
        const asistidores = ordenarYCortar(stats.asistencias);
        const amarillas = ordenarYCortar(stats.amarillas);
        const rojas = ordenarYCortar(stats.rojas);

        const renderLista = (lista, icono, unidad) => {
            if(!lista || lista.length === 0) return `<p style="color:var(--text-muted); font-size:0.85rem; padding: 10px 0; text-align: center; font-style: italic;">No hay registros oficiales aún.</p>`;
            return lista.map(item => `
                <div style="display:flex; justify-content: space-between; align-items:center; padding: 8px 0; border-bottom: 1px solid rgba(255,255,255,0.04);">
                    <div style="display:flex; align-items:center; gap: 8px;">
                        <span style="font-size: 1rem;">${icono}</span>
                        <span style="font-weight: 500; font-size: 0.95rem;">${item.nombre}</span>
                    </div>
                    <span style="font-weight: 800; color: var(--text-main); font-family: var(--font-heading);">${item.valor} <span style="font-size: 0.7rem; font-weight: normal; color:var(--text-muted);">${unidad}</span></span>
                </div>
            `).join('');
        };

        let rosterHtml = '';
        if (convocados.length > 0) {
            rosterHtml = convocados.map(j => `
                <div class="roster-item" style="display:flex; align-items:center; justify-content: space-between; padding: 8px; border-bottom: 1px solid var(--border-glass);">
                    <div style="display:flex; align-items:center; gap: 10px;">
                        <span class="player-num" style="background:rgba(255,255,255,0.1); width:30px; height:30px; display:flex; align-items:center; justify-content:center; border-radius:50%; font-weight:bold;">${j.numero}</span>
                        <span class="player-name">${j.nombre}</span>
                    </div>
                    <span class="player-pos" style="font-size:0.8rem; color:var(--accent-neon); font-weight:bold;">${j.posicion}</span>
                </div>
            `).join('');
        } else {
            rosterHtml = `<p style="color:var(--text-muted); font-style: italic; text-align:center;">La API no proveyó la lista de convocados.</p>`;
        }

        // LÓGICA DE CANCHA 3D INVERTIDA (Corrección Posiciones Dadas Vuelta usando Flexbox)
        const porteros = convocados.filter(j => ['G', 'POR', 'GK'].includes(j.posicion));
        const defensas = convocados.filter(j => ['D', 'DEF', 'CB', 'LB', 'RB'].includes(j.posicion));
        const medios = convocados.filter(j => ['M', 'MED', 'CM', 'CDM', 'CAM', 'RM', 'LM'].includes(j.posicion));
        const delanteros = convocados.filter(j => ['F', 'A', 'DEL', 'ST', 'RW', 'LW', 'CF'].includes(j.posicion));

        const getDorsal = (arr, index, fallback) => (arr[index] && arr[index].numero !== '-') ? arr[index].numero : fallback;

        // Panel Analítico Dinámico basado en las stats reales
        let topScorer = goleadores.length > 0 ? goleadores[0].nombre : 'sus delanteros';
        let topAssister = asistidores.length > 0 ? asistidores[0].nombre : 'el mediocampo';
        let totalYellows = amarillas.reduce((acc, curr) => acc + curr.valor, 0);

        appContainer.innerHTML = `
            ${renderNavbar('#/liga?id=' + ligaId)}
            <main class="page-container fade-in">
                <a href="javascript:history.back()" style="color: var(--text-muted); text-decoration: none; display: inline-block; margin-bottom: 1.5rem; font-weight: 600;">← Volver</a>
                
                <div class="liga-header" style="border-left: 6px solid var(--accent-neon); background: rgba(255, 255, 255, 0.03); display: flex; align-items: center; gap: 20px;">
                    <div class="team-shield" style="width: 80px; height: 80px; font-size: 2.5rem; background: var(--surface-color); border: 2px solid var(--border-glass); display:flex; align-items:center; justify-content:center; border-radius:50%;">${name.charAt(0)}</div>
                    <div>
                        <h1 class="liga-title-main" style="margin-bottom: 4px; font-size: 2rem;">${name}</h1>
                        <span style="color: var(--accent-neon); font-weight: 800; text-transform: uppercase; letter-spacing: 1px; font-size: 0.85rem;">Estadísticas de Plantilla Oficiales</span>
                    </div>
                </div>

                <div class="glass-panel" style="padding: 1.5rem; margin-top: 2rem; border: 1px solid var(--accent-neon);">
                    <h3 class="panel-title" style="border-bottom: 1px solid rgba(57, 255, 20, 0.3); padding-bottom: 8px; margin-bottom: 15px;">🧠 Centro de Inteligencia Táctica</h3>
                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 1.5rem;">
                        <div style="background: rgba(255,255,255,0.02); padding: 1rem; border-radius: 8px; border-left: 3px solid #6CABDD;">
                            <h4 style="color: #6CABDD; margin-bottom: 8px; font-family: var(--font-heading);">Análisis Ofensivo (Jugadores)</h4>
                            <p style="font-size: 0.85rem; color: var(--text-muted); line-height: 1.5;">La principal amenaza de cara al arco rival recae sobre los pies de <strong>${topScorer}</strong>, quien lidera la métrica de efectividad. La distribución y armado de juego pasa invariablemente por <strong>${topAssister}</strong>, clave en la zona de creación.</p>
                        </div>
                        <div style="background: rgba(255,255,255,0.02); padding: 1rem; border-radius: 8px; border-left: 3px solid #f5f5f5;">
                            <h4 style="color: #f5f5f5; margin-bottom: 8px; font-family: var(--font-heading);">Estructura del Equipo</h4>
                            <p style="font-size: 0.85rem; color: var(--text-muted); line-height: 1.5;">El seleccionado de ${name} suele asentar un bloque en formato 4-3-3. Priorizan el balance en el mediocampo para asegurar transiciones rápidas y repliegues seguros tras pérdida de balón.</p>
                        </div>
                        <div style="background: rgba(255,255,255,0.02); padding: 1rem; border-radius: 8px; border-left: 3px solid #ff4757;">
                            <h4 style="color: #ff4757; margin-bottom: 8px; font-family: var(--font-heading);">Diagnóstico Disciplinario (Partidos)</h4>
                            <p style="font-size: 0.85rem; color: var(--text-muted); line-height: 1.5;">Con un acumulado parcial de ${totalYellows} tarjetas amarillas registradas en su cuadro principal, el equipo requiere extremar cuidados tácticos en las faltas tácticas para no condicionar su línea defensiva.</p>
                        </div>
                    </div>
                </div>

                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 1.5rem; margin-bottom: 2rem; margin-top: 2rem;">
                    <div class="glass-panel" style="padding: 1.5rem;">
                        <h3 class="panel-title" style="border-bottom: 1px solid var(--border-glass); padding-bottom: 8px; margin-bottom: 10px; font-size: 1.1rem;">⚽ Goleadores</h3>
                        ${renderLista(goleadores, '⚽', 'GOLES')}
                    </div>
                    <div class="glass-panel" style="padding: 1.5rem;">
                        <h3 class="panel-title" style="border-bottom: 1px solid var(--border-glass); padding-bottom: 8px; margin-bottom: 10px; font-size: 1.1rem;">🎯 Asistidores</h3>
                        ${renderLista(asistidores, '👟', 'ASIST.')}
                    </div>
                    <div class="glass-panel" style="padding: 1.5rem;">
                        <h3 class="panel-title" style="border-bottom: 1px solid var(--border-glass); padding-bottom: 8px; margin-bottom: 10px; font-size: 1.1rem;">🟨 T. Amarillas</h3>
                        ${renderLista(amarillas, '🟨', 'TARJ.')}
                    </div>
                    <div class="glass-panel" style="padding: 1.5rem;">
                        <h3 class="panel-title" style="border-bottom: 1px solid var(--border-glass); padding-bottom: 8px; margin-bottom: 10px; font-size: 1.1rem;">🟥 T. Rojas</h3>
                        ${renderLista(rojas, '🟥', 'TARJ.')}
                    </div>
                </div>

                <div class="equipo-grid">
                    <div class="glass-panel" style="padding: 1.5rem; max-height: 500px; overflow-y: auto;">
                        <h3 class="panel-title">Lista de Convocados Oficial</h3>
                        <div class="roster-list">
                            ${rosterHtml}
                        </div>
                    </div>

                    <div class="glass-panel" style="padding: 1.5rem; overflow: hidden;">
                        <h3 class="panel-title">Disposición Táctica (4-3-3)</h3>
                        <div style="position: relative; width: 100%; height: 400px; background: #1a472a; border: 2px solid rgba(255,255,255,0.2); border-radius: 10px; display: flex; flex-direction: column; justify-content: space-around; padding: 15px 0; overflow: hidden; box-shadow: inset 0 0 50px rgba(0,0,0,0.5);">
                            <div style="position: absolute; top: 50%; left: 0; right: 0; border-top: 2px solid rgba(255,255,255,0.3); transform: translateY(-50%);"></div>
                            <div style="position: absolute; top: 50%; left: 50%; width: 80px; height: 80px; border: 2px solid rgba(255,255,255,0.3); border-radius: 50%; transform: translate(-50%, -50%);"></div>
                            <div style="position: absolute; bottom: 0; left: 50%; width: 140px; height: 60px; border: 2px solid rgba(255,255,255,0.3); border-bottom: none; transform: translateX(-50%);"></div>
                            <div style="position: absolute; top: 0; left: 50%; width: 140px; height: 60px; border: 2px solid rgba(255,255,255,0.3); border-top: none; transform: translateX(-50%);"></div>
                            
                            <div style="display: flex; justify-content: space-evenly; width: 100%; z-index: 2;">
                                <div class="player-token" style="background:#fff; color:#000; width:28px; height:28px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-weight:bold; box-shadow:0 2px 5px rgba(0,0,0,0.5);">${getDorsal(delanteros, 0, '7')}</div>
                                <div class="player-token" style="background:#fff; color:#000; width:28px; height:28px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-weight:bold; box-shadow:0 2px 5px rgba(0,0,0,0.5); margin-top:-15px;">${getDorsal(delanteros, 1, '9')}</div>
                                <div class="player-token" style="background:#fff; color:#000; width:28px; height:28px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-weight:bold; box-shadow:0 2px 5px rgba(0,0,0,0.5);">${getDorsal(delanteros, 2, '11')}</div>
                            </div>
                            
                            <div style="display: flex; justify-content: space-evenly; width: 100%; z-index: 2; margin-top: -20px;">
                                <div class="player-token" style="background:#fff; color:#000; width:28px; height:28px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-weight:bold; box-shadow:0 2px 5px rgba(0,0,0,0.5);">${getDorsal(medios, 0, '8')}</div>
                                <div class="player-token" style="background:#fff; color:#000; width:28px; height:28px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-weight:bold; box-shadow:0 2px 5px rgba(0,0,0,0.5); margin-top:15px;">${getDorsal(medios, 1, '6')}</div>
                                <div class="player-token" style="background:#fff; color:#000; width:28px; height:28px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-weight:bold; box-shadow:0 2px 5px rgba(0,0,0,0.5);">${getDorsal(medios, 2, '10')}</div>
                            </div>
                            
                            <div style="display: flex; justify-content: space-between; padding: 0 10%; width: 100%; z-index: 2; margin-top: 10px;">
                                <div class="player-token" style="background:#fff; color:#000; width:28px; height:28px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-weight:bold; box-shadow:0 2px 5px rgba(0,0,0,0.5);">${getDorsal(defensas, 0, '4')}</div>
                                <div class="player-token" style="background:#fff; color:#000; width:28px; height:28px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-weight:bold; box-shadow:0 2px 5px rgba(0,0,0,0.5); margin-top: 15px;">${getDorsal(defensas, 1, '3')}</div>
                                <div class="player-token" style="background:#fff; color:#000; width:28px; height:28px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-weight:bold; box-shadow:0 2px 5px rgba(0,0,0,0.5); margin-top: 15px;">${getDorsal(defensas, 2, '2')}</div>
                                <div class="player-token" style="background:#fff; color:#000; width:28px; height:28px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-weight:bold; box-shadow:0 2px 5px rgba(0,0,0,0.5);">${getDorsal(defensas, 3, '5')}</div>
                            </div>
                            
                            <div style="display: flex; justify-content: center; width: 100%; z-index: 2;">
                                <div class="player-token" style="background:var(--accent-neon); color:#000; width:28px; height:28px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-weight:bold; box-shadow:0 2px 5px rgba(0,0,0,0.5);">${getDorsal(porteros, 0, '1')}</div>
                            </div>
                        </div>
                    </div>
                </div>
            </main>
        `;
    };

    // ── VISTAS ORIGINALES (H2H E INFO) ───────────────────────────────────────
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
