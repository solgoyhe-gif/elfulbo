// app.js - Enrutador Principal e Interfaz Dinámica SPA
// ── ESTRATEGIA DE INTEGRACIÓN COMPLETA ────────────────────────────────────
//   · Conserva el uso del módulo ESPN para ligas tradicionales.
//   · Implementa Tablas de Posiciones Generales y Detalladas por Grupo.
//   · Implementa Perfil de Equipo con Estadísticas de Jugadores (Goles/Tarjetas).
//   · NÚMEROS IZQUIERDOS ORDENADOS MATEMÁTICAMENTE (1 al 4 forzado).
// ─────────────────────────────────────────────────────────────────────────

const App = (() => {
    const appContainer = document.getElementById('app');

    // ── NAVEGACIÓN (LIMPIA) ──────────────────────────────────────────────────
    const renderNavbar = (activeHash) => {
        const isLigasActive = activeHash === '#/ligas' || activeHash.includes('#/liga?id=') || activeHash.includes('#/equipo?id=') || activeHash.includes('#/grupo?id=');
        return `
            <nav class="navbar desktop-nav">
                <div class="nav-links-group">
                    <a href="#/home" class="nav-link ${activeHash === '#/home' ? 'active' : ''}">Inicio</a>
                    <a href="#/ligas" class="nav-link ${isLigasActive ? 'active' : ''}">Ligas</a>
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

    // ── VISTA EXCLUSIVA 1: TABLA DE GRUPOS DEL MUNDIAL (GENERAL) ──────────
    const renderCalendarioMundial = async (ligaData) => {
        appContainer.innerHTML = `
            ${renderNavbar('#/liga?id=' + ligaData.id)}
            <main class="page-container fade-in" style="display: flex; justify-content: center; align-items: center; height: 75vh; flex-direction: column;">
                <div style="width: 45px; height: 45px; border: 4px solid var(--accent-neon); border-right-color: transparent; border-radius: 50%; animation: spin 1s linear infinite;"></div>
                <p style="margin-top: 1.5rem; color: var(--accent-neon); font-family: var(--font-heading); text-transform: uppercase; letter-spacing: 1px; font-weight: bold;" id="loading-text">Sincronizando grupos en vivo...</p>
                <style>@keyframes spin { 100% { transform: rotate(360deg); } }</style>
            </main>
        `;

        let gruposData = [];
        let proveedor = 'ESPN API';
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
                            id: e.team.id, // ID real para enviar a la vista de equipo
                            nombre: e.team.name,
                            logo: e.team.logos?.[0]?.href || '🌐',
                            pj: findStat('gamesPlayed'),
                            pts: findStat('points'),
                            dif: findStat('pointDifferential')
                        };
                    }) || [];

                    // Orden estricto interno por Puntos y Diferencia de Gol para que se acomoden bien
                    equipos.sort((a, b) => b.pts - a.pts || b.dif - a.dif);

                    let nombreGrupo = grupo.name.replace(/Group /i, 'GRUPO ').toUpperCase();
                    return { nombre: nombreGrupo, equipos: equipos };
                });

                // Orden estricto de los grupos de la A a la L
                gruposData.sort((a, b) => a.nombre.localeCompare(b.nombre));

            } else {
                throw new Error('ESPN devolvió array de grupos vacío');
            }

        } catch (error) {
            console.warn('⚠️ [Grupos] ESPN no disponible o vacío:', error.message);
            proveedor = 'SISTEMA DE SIMULACIÓN VISUAL (MOCK 48 EQUIPOS)';
            
            // Mock de Grupos
            const mockEquipos = {
                'GRUPO A': [{n:'México', fl:'🇲🇽', id:'1'}, {n:'Alemania', fl:'🇩🇪', id:'2'}, {n:'Japón', fl:'🇯🇵', id:'3'}, {n:'Mali', fl:'🇲🇱', id:'4'}],
                'GRUPO B': [{n:'Canadá', fl:'🇨🇦', id:'5'}, {n:'España', fl:'🇪🇸', id:'6'}, {n:'Colombia', fl:'🇨🇴', id:'7'}, {n:'Corea del Sur', fl:'🇰🇷', id:'8'}],
                'GRUPO C': [{n:'Estados Unidos', fl:'🇺🇸', id:'9'}, {n:'Francia', fl:'🇫🇷', id:'10'}, {n:'Senegal', fl:'🇸🇳', id:'11'}, {n:'Arabia Saudita', fl:'🇸🇦', id:'12'}],
                'GRUPO D': [{n:'Argentina', fl:'🇦🇷', id:'13'}, {n:'Inglaterra', fl:'🏴󠁧󠁢󠁥󠁮󠁧󠁿', id:'14'}, {n:'Ecuador', fl:'🇪🇨', id:'15'}, {n:'Costa Rica', fl:'🇨🇷', id:'16'}],
                'GRUPO E': [{n:'Brasil', fl:'🇧🇷', id:'17'}, {n:'Países Bajos', fl:'🇳🇱', id:'18'}, {n:'Marruecos', fl:'🇲🇦', id:'19'}, {n:'Australia', fl:'🇦🇺', id:'20'}],
                'GRUPO F': [{n:'Portugal', fl:'🇵🇹', id:'21'}, {n:'Croacia', fl:'🇭🇷', id:'22'}, {n:'Uruguay', fl:'🇺🇾', id:'23'}, {n:'Catar', fl:'🇶🇦', id:'24'}],
                'GRUPO G': [{n:'Italia', fl:'🇮🇹', id:'25'}, {n:'Bélgica', fl:'🇧🇪', id:'26'}, {n:'Suecia', fl:'🇸🇪', id:'27'}, {n:'Egipto', fl:'🇪🇬', id:'28'}],
                'GRUPO H': [{n:'Suiza', fl:'🇨🇭', id:'29'}, {n:'Nigeria', fl:'🇳🇬', id:'30'}, {n:'Irán', fl:'🇮🇷', id:'31'}, {n:'Gales', fl:'🏴󠁧󠁢󠁷󠁬󠁳󠁿', id:'32'}],
                'GRUPO I': [{n:'Dinamarca', fl:'🇩🇰', id:'33'}, {n:'Serbia', fl:'🇷🇸', id:'34'}, {n:'Chile', fl:'🇨🇱', id:'35'}, {n:'Perú', fl:'🇵🇪', id:'36'}],
                'GRUPO J': [{n:'Polonia', fl:'🇵🇱', id:'37'}, {n:'Costa de Marfil', fl:'🇨🇮', id:'38'}, {n:'Irak', fl:'🇮🇶', id:'39'}, {n:'Jamaica', fl:'🇯🇲', id:'40'}],
                'GRUPO K': [{n:'Austria', fl:'🇦🇹', id:'41'}, {n:'Ucrania', fl:'🇺🇦', id:'42'}, {n:'Camerún', fl:'🇨🇲', id:'43'}, {n:'Argelia', fl:'🇩🇿', id:'44'}],
                'GRUPO L': [{n:'Turquía', fl:'🇹🇷', id:'45'}, {n:'Hungría', fl:'🇭🇺', id:'46'}, {n:'Panamá', fl:'🇵🇦', id:'47'}, {n:'Venezuela', fl:'🇻🇪', id:'48'}]
            };

            for (const [nombreGrupo, equiposArr] of Object.entries(mockEquipos)) {
                gruposData.push({
                    nombre: nombreGrupo,
                    equipos: equiposArr.map(eq => ({
                        id: eq.id,
                        nombre: eq.n,
                        logo: eq.fl,
                        pj: 0,
                        pts: 0,
                        dif: 0
                    }))
                });
            }
            gruposData.sort((a, b) => a.nombre.localeCompare(b.nombre));
        }

        let grillaGruposHtml = '';
        gruposData.forEach(grupo => {
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

            // Hacemos que el título del grupo sea clickeable para ver el detalle
            grillaGruposHtml += `
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
                            <tbody>
                                ${filasTabla}
                            </tbody>
                        </table>
                    </div>
                </div>
            `;
        });

        appContainer.innerHTML = `
            ${renderNavbar('#/liga?id=' + ligaData.id)}
            <main class="page-container fade-in">
                <a href="#/ligas" style="color: var(--text-muted); text-decoration: none; display: inline-block; margin-bottom: 1.5rem; font-weight: 600;">← Volver a Ligas</a>
                
                <div class="liga-header" style="border-left: 6px solid ${ligaData.badge_color}; background: radial-gradient(circle at left, rgba(200, 168, 75, 0.12) 0%, transparent 60%);">
                    <span class="liga-flag-large" style="font-size: 3.8rem; filter: drop-shadow(0 0 10px rgba(200,168,75,0.3));">${ligaData.flag}</span>
                    <div>
                        <h1 class="liga-title-main">Fase de Grupos</h1>
                        <span style="color: var(--accent-neon); font-weight: 800; letter-spacing: 1px; font-size: 0.85rem;">🏆 TABLAS PROVISTAS POR ${proveedor}</span>
                    </div>
                </div>
                
                <p style="text-align: center; color: var(--text-muted); font-size: 0.85rem; margin-top: 1rem;">Selecciona el título de un grupo para ver estadísticas detalladas (GF, GC, DIF) o selecciona un equipo para ver a sus jugadores.</p>

                <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 1.5rem; margin-top: 1rem;">
                    ${grillaGruposHtml}
                </div>
            </main>
        `;
    };

    // ── VISTA EXCLUSIVA 2: DETALLE EXTENDIDO DE UN GRUPO (GF, GC, DIF) ────────
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
            const espnUrl = 'https://site.api.espn.com/apis/v2/sports/soccer/fifa.world/standings';
            const espnProxyUrl = `${CF_WORKER}/?url=${encodeURIComponent(espnUrl)}`;
            const respuestaEspn = await fetch(espnProxyUrl);
            if (!respuestaEspn.ok) throw new Error('Falló fetch a standings');
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
            } else {
                throw new Error('Grupo no encontrado en la API');
            }
        } catch (err) {
            console.warn("Usando mock estricto para detalle de grupo", err);
            // Mock de seguridad para la vista
            equipos = [
                {id: '1', nombre: `Líder ${grupoNombre}`, logo: '⭐', pj: 3, gf: 5, gc: 1, dif: 4, pts: 9},
                {id: '2', nombre: `Escolta ${grupoNombre}`, logo: '⚡', pj: 3, gf: 3, gc: 2, dif: 1, pts: 6},
                {id: '3', nombre: `Tercero ${grupoNombre}`, logo: '⚔️', pj: 3, gf: 2, gc: 4, dif: -2, pts: 3},
                {id: '4', nombre: `Cuarto ${grupoNombre}`, logo: '🛡️', pj: 3, gf: 0, gc: 3, dif: -3, pts: 0}
            ];
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
                            <tbody>
                                ${filasHtml}
                            </tbody>
                        </table>
                    </div>
                    <p style="text-align:right; font-size:0.75rem; color: var(--text-muted); margin-top: 1rem;">Selecciona un equipo para ver estadísticas de jugadores.</p>
                </div>
            </main>
        `;
    };

    // ── VISTA EXCLUSIVA 3: PERFIL DE EQUIPO Y ESTADÍSTICAS DE JUGADORES ──────
    const renderEquipoDetalle = async (equipoId, ligaId, nombreEquipoDecoded) => {
        const name = decodeURIComponent(nombreEquipoDecoded || 'Selección');
        
        appContainer.innerHTML = `
            ${renderNavbar('#/liga?id=world_cup')}
            <main class="page-container fade-in">
                <a href="javascript:history.back()" style="color: var(--text-muted); text-decoration: none; display: inline-block; margin-bottom: 1rem;">← Volver a la Tabla</a>
                <div style="display: flex; justify-content: center; align-items: center; height: 30vh; flex-direction: column;">
                    <div style="width: 45px; height: 45px; border: 4px solid var(--accent-neon); border-right-color: transparent; border-radius: 50%; animation: spin 1s linear infinite;"></div>
                    <p style="margin-top: 1.5rem; color: var(--accent-neon); font-family: var(--font-heading); text-transform: uppercase; letter-spacing: 1px;">Recopilando datos de jugadores...</p>
                </div>
            </main>
        `;

        // Generador visual de estadísticas para probar la UI (Dado que ESPN restringe estos datos por CORS en torneos)
        // Crea nombres genéricos o verosímiles basados en el nombre del equipo para dar realismo a la maqueta
        const generarMockPlayer = (tipo, cantidad) => {
            const apellidos = ['García', 'Smith', 'Müller', 'Silva', 'Rossi', 'Kim', 'Diop', 'Al-Dawsari', 'Jones', 'González'];
            const randomList = [];
            for(let i=0; i<cantidad; i++){
                randomList.push({
                    nombre: `J. ${apellidos[Math.floor(Math.random() * apellidos.length)]}`,
                    valor: Math.floor(Math.random() * 3) + 1
                });
            }
            return randomList.sort((a,b) => b.valor - a.valor);
        };

        const goleadores = generarMockPlayer('goles', 3);
        const asistidores = generarMockPlayer('asistencias', 3);
        const amarillas = generarMockPlayer('amarillas', 4);
        const rojas = generarMockPlayer('rojas', 1);

        const renderLista = (lista, icono, unidad) => {
            if(lista.length === 0) return `<p style="color:var(--text-muted); font-size:0.85rem; padding: 10px 0;">Sin registros aún.</p>`;
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

        appContainer.innerHTML = `
            ${renderNavbar('#/liga?id=' + ligaId)}
            <main class="page-container fade-in">
                <a href="javascript:history.back()" style="color: var(--text-muted); text-decoration: none; display: inline-block; margin-bottom: 1.5rem; font-weight: 600;">← Volver</a>
                
                <div class="equipo-header" style="border-left: 6px solid var(--accent-neon); background: rgba(255, 255, 255, 0.03);">
                    <div class="team-shield" style="width: 70px; height: 70px; font-size: 2rem; background: var(--surface-color); border: 2px solid var(--border-glass);">${name.charAt(0)}</div>
                    <div>
                        <h1 class="equipo-title" style="margin-bottom: 4px;">${name}</h1>
                        <span style="color: var(--accent-neon); font-weight: 800; text-transform: uppercase; letter-spacing: 1px; font-size: 0.8rem;">Estadísticas de Plantilla</span>
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
                    <div class="glass-panel" style="padding: 1.5rem;">
                        <h3 class="panel-title">Lista de Convocados Base</h3>
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
