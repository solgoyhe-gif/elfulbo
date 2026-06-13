// app.js - Enrutador Principal e Interfaz Dinámica SPA
// ── CAMBIOS vs versión anterior ───────────────────────────────────────────
//   · renderLigaDetalle → tabla real de ESPN + próximos partidos reales
//   · renderEquipoDetalle → equipos reales con escudo ESPN
//   · Todo lo demás (router, login, H2H, noticias, navbar) INTACTO
// ─────────────────────────────────────────────────────────────────────────

const App = (() => {
    const appContainer = document.getElementById('app');

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
                    <span class="mobile-icon">🏠</span><span>Inicio</span>
                </a>
                <a href="#/ligas" class="mobile-nav-item ${isLigasActive ? 'active' : ''}">
                    <span class="mobile-icon">🏆</span><span>Ligas</span>
                </a>
                <a href="#/h2h" class="mobile-nav-item ${activeHash === '#/h2h' ? 'active' : ''}">
                    <span class="mobile-icon">⚔️</span><span>H2H</span>
                </a>
                <a href="#/info" class="mobile-nav-item ${activeHash === '#/info' ? 'active' : ''}">
                    <span class="mobile-icon">📰</span><span>Info</span>
                </a>
                <button onclick="Auth.logout()" class="mobile-nav-item" style="background:none; border:none; padding:0; cursor:pointer;">
                    <span class="mobile-icon" style="filter:none;">🚪</span><span style="color:#ff4757;">Salir</span>
                </button>
            </nav>
            ` : ''}
        `;
    };

    // ── HELPERS DE RENDER ─────────────────────────────────────────────────────

    // Esqueleto animado para la tabla mientras carga
    const _skeletonTabla = () => {
        let rows = '';
        for (let i = 0; i < 10; i++) {
            rows += `<tr>
                <td><div class="skel-cell" style="width:20px"></div></td>
                <td><div class="skel-cell" style="width:140px"></div></td>
                <td><div class="skel-cell" style="width:24px"></div></td>
                <td><div class="skel-cell" style="width:24px"></div></td>
                <td><div class="skel-cell" style="width:24px"></div></td>
                <td><div class="skel-cell" style="width:24px"></div></td>
                <td><div class="skel-cell" style="width:30px"></div></td>
            </tr>`;
        }
        return `<table class="standings-table"><thead><tr>
            <th class="col-pos">#</th><th>Equipo</th><th>PJ</th><th>PG</th><th>PE</th><th>PP</th><th class="col-pts">PTS</th>
        </tr></thead><tbody>${rows}</tbody></table>`;
    };

    // Fila de tabla con escudo real
    const _standingRow = (entry, ligaId) => {
        const { pos, team, stats } = entry;
        const logo = team.logo
            ? `<img src="${team.logo}" alt="${team.name}" style="width:22px;height:22px;object-fit:contain;vertical-align:middle;margin-right:8px;filter:drop-shadow(0 1px 3px rgba(0,0,0,.6))">`
            : `<span class="team-shield" style="width:22px;height:22px;font-size:.7rem;margin-right:8px;">${team.abbr.charAt(0)}</span>`;
        const rowStyle = pos <= 4 ? 'border-left:3px solid var(--accent-neon)' : pos === 5 ? 'border-left:3px solid #f7931e' : '';
        return `<tr style="${rowStyle}" onclick="window.location.hash='#/equipo?id=${encodeURIComponent(team.id)}&liga=${ligaId}&name=${encodeURIComponent(team.name)}'">
            <td class="col-pos">${pos}</td>
            <td class="col-team">${logo}${team.name}</td>
            <td>${stats.pj}</td>
            <td>${stats.pg}</td>
            <td>${stats.pe}</td>
            <td>${stats.pp}</td>
            <td class="col-pts">${stats.pts}</td>
        </tr>`;
    };

    // Card de partido del scoreboard
    const _matchCard = (match) => {
        const isLive = match.status.state === 'in';
        const isDone = match.status.state === 'post';
        const statusLabel = isLive
            ? `<span style="color:var(--accent-neon);font-weight:800;animation:pulse 1s infinite">● ${match.status.clock || 'EN VIVO'}</span>`
            : isDone
                ? `<span style="color:var(--text-muted)">FIN</span>`
                : `<span style="color:var(--text-muted)">${_formatDate(match.date)}</span>`;

        const homeLogo = match.homeTeam.logo ? `<img src="${match.homeTeam.logo}" style="width:24px;height:24px;object-fit:contain">` : '';
        const awayLogo = match.awayTeam.logo ? `<img src="${match.awayTeam.logo}" style="width:24px;height:24px;object-fit:contain">` : '';

        return `
        <div class="match-item" style="display:flex;align-items:center;gap:8px;padding:10px 0;border-bottom:1px solid var(--border-glass)">
            <div style="flex:1;display:flex;align-items:center;gap:6px;justify-content:flex-end">
                <span style="font-weight:600;font-size:.9rem;text-align:right">${match.homeTeam.name}</span>
                ${homeLogo}
            </div>
            <div style="min-width:70px;text-align:center;font-family:var(--font-heading);font-size:1.1rem;font-weight:800">
                ${(isLive || isDone)
                    ? `<span style="${isLive ? 'color:var(--accent-neon)' : ''}">${match.homeTeam.score} – ${match.awayTeam.score}</span>`
                    : `<span style="color:var(--text-muted);font-size:.75rem">VS</span>`}
                <div style="font-size:.65rem;margin-top:2px">${statusLabel}</div>
            </div>
            <div style="flex:1;display:flex;align-items:center;gap:6px">
                ${awayLogo}
                <span style="font-weight:600;font-size:.9rem">${match.awayTeam.name}</span>
            </div>
        </div>`;
    };

    const _formatDate = (iso) => {
        if (!iso) return '—';
        const d = new Date(iso);
        return d.toLocaleDateString('es-AR', { weekday:'short', day:'numeric', month:'short', hour:'2-digit', minute:'2-digit' });
    };

    const _errorPanel = (msg) => `
        <div style="padding:2rem;text-align:center;color:var(--text-muted)">
            <div style="font-size:2rem;margin-bottom:.5rem">📡</div>
            <p style="font-size:.9rem">${msg}</p>
            <p style="font-size:.75rem;margin-top:.5rem">ESPN puede no tener esta liga disponible en este momento.</p>
        </div>`;

    // ── DASHBOARD PRINCIPAL — sin cambios ─────────────────────────────────────
    const renderHome = () => {
        let miniLigasHtml = '';
        if (typeof LIGAS !== 'undefined') {
            const ligasDestacadas = [...LIGAS.europa_top5.competiciones, ...LIGAS.sudamerica.competiciones];
            ligasDestacadas.forEach(liga => {
                miniLigasHtml += `<div class="mini-league" onclick="window.location.hash='#/liga?id=${liga.id}'"><span style="font-size:1.2rem">${liga.flag}</span><span class="mini-league-name">${liga.nombre}</span></div>`;
            });
        }
        appContainer.innerHTML = `
            ${renderNavbar('#/home')}
            <main class="dashboard-container fade-in">
                <section class="glass-panel panel-left">
                    <h3 class="panel-title">📊 Stats en Vivo</h3>
                    <div class="stat-box"><div class="stat-header"><span>Posesión</span></div><div class="stat-bar"><div class="stat-fill-local" style="width:60%"></div><div class="stat-fill-visita" style="width:40%"></div></div><div class="stat-values"><span>60%</span><span style="color:var(--accent-neon)">40%</span></div></div>
                    <div class="stat-box"><div class="stat-header"><span>Tiros a Puerta</span></div><div class="stat-bar"><div class="stat-fill-local" style="width:75%"></div><div class="stat-fill-visita" style="width:25%"></div></div><div class="stat-values"><span>12</span><span style="color:var(--accent-neon)">4</span></div></div>
                    <div class="stat-box"><div class="stat-header"><span>Faltas</span></div><div class="stat-bar"><div class="stat-fill-local" style="width:45%"></div><div class="stat-fill-visita" style="width:55%"></div></div><div class="stat-values"><span>9</span><span style="color:var(--accent-neon)">11</span></div></div>
                </section>
                <section class="panel-center">
                    <div style="position:absolute;top:0;font-family:var(--font-heading);font-size:2rem;font-weight:800;letter-spacing:2px;z-index:10;text-shadow:0 5px 15px #000">EL FULBO</div>
                    <div class="pitch-perspective"><div class="pitch-horizontal"><div class="area-left"></div><div class="area-right"></div></div></div>
                </section>
                <section class="glass-panel panel-right"><h3 class="panel-title">🏆 Top Ligas</h3>${miniLigasHtml}</section>
                <section class="glass-panel panel-bottom">
                    <h3 class="panel-title" style="margin-bottom:0;border:none">🚨 URGENTE</h3>
                    <div class="news-ticker">
                        <span class="news-item"><span>MERCADO:</span> Fichaje bomba confirmado en la liga inglesa.</span>
                        <span class="news-item"><span>LESIÓN:</span> Estrella fuera por 3 semanas.</span>
                        <span class="news-item"><span>SORTEO:</span> Definidos los cruces de cuartos.</span>
                    </div>
                </section>
            </main>
        `;
    };

    // ── LISTADO GLOBAL DE LIGAS — sin cambios ─────────────────────────────────
    const renderLigas = () => {
        let html = `${renderNavbar('#/ligas')}<main class="page-container fade-in"><h2 class="section-title">🏆 Competiciones Disponibles</h2>`;
        for (const key in LIGAS) {
            html += `<div class="categoria-wrapper"><h3 class="category-title">${LIGAS[key].nombre}</h3><div class="leagues-grid">`;
            LIGAS[key].competiciones.forEach(liga => {
                html += `<div class="glass-card league-card" onclick="window.location.hash='#/liga?id=${liga.id}'"><div class="league-info"><span class="league-flag">${liga.flag}</span><div><div class="league-name">${liga.nombre}</div><div class="league-country">${liga.pais}</div></div></div><span class="badge-liga" style="background-color:${liga.badge_color}">${liga.id.substring(0,5)}</span></div>`;
            });
            html += `</div></div>`;
        }
        appContainer.innerHTML = html + `</main>`;
    };

    // ── DETALLE DE LIGA — REEMPLAZADO CON ESPN REAL ───────────────────────────
    const renderLigaDetalle = async (ligaId) => {
        // Buscar datos de la liga en data.js
        let ligaData = null;
        for (const cat in LIGAS) {
            const found = LIGAS[cat].competiciones.find(l => l.id === ligaId);
            if (found) { ligaData = found; break; }
        }
        if (!ligaData) return;

        // Renderizar estructura inmediata con skeletons mientras carga ESPN
        appContainer.innerHTML = `
            ${renderNavbar('#/liga?id=' + ligaId)}
            <main class="page-container fade-in">
                <a href="#/ligas" style="color:var(--text-muted);text-decoration:none;display:inline-block;margin-bottom:1rem">← Volver al Listado</a>
                <div class="liga-header" style="border-left:6px solid ${ligaData.badge_color}">
                    <span class="liga-flag-large">${ligaData.flag}</span>
                    <div>
                        <h1 class="liga-title-main">${ligaData.nombre}</h1>
                        <span style="color:var(--text-muted);font-weight:600">${ligaData.pais}</span>
                    </div>
                </div>
                <div class="liga-content-grid">
                    <div class="glass-panel" style="padding:1.5rem">
                        <h3 class="panel-title" style="color:${ligaData.badge_color}">Tabla de Posiciones</h3>
                        <div id="tabla-container" class="table-responsive">${_skeletonTabla()}</div>
                    </div>
                    <div class="glass-panel" style="padding:1.5rem;height:fit-content">
                        <h3 class="panel-title" style="color:${ligaData.badge_color}">Partidos</h3>
                        <div id="partidos-container"><div style="color:var(--text-muted);font-size:.85rem;padding:.5rem 0">Cargando partidos...</div></div>
                    </div>
                </div>
            </main>
        `;

        // Traer datos ESPN en paralelo
        const [standingsResult, scoreboardResult] = await Promise.allSettled([
            ESPN.getStandings(ligaId),
            ESPN.getScoreboard(ligaId),
        ]);

        // Tabla de posiciones
        const tablaContainer = document.getElementById('tabla-container');
        if (tablaContainer) {
            if (standingsResult.status === 'fulfilled' && standingsResult.value.length > 0) {
                const rows = standingsResult.value.map(e => _standingRow(e, ligaId)).join('');
                tablaContainer.innerHTML = `
                    <table class="standings-table">
                        <thead><tr><th class="col-pos">#</th><th>Equipo</th><th>PJ</th><th>PG</th><th>PE</th><th>PP</th><th class="col-pts">PTS</th></tr></thead>
                        <tbody>${rows}</tbody>
                    </table>`;
            } else {
                tablaContainer.innerHTML = _errorPanel('No se pudo cargar la tabla de posiciones.');
            }
        }

        // Scoreboard
        const partidosContainer = document.getElementById('partidos-container');
        if (partidosContainer) {
            if (scoreboardResult.status === 'fulfilled' && scoreboardResult.value.length > 0) {
                const cards = scoreboardResult.value.map(_matchCard).join('');
                partidosContainer.innerHTML = `<div style="display:flex;flex-direction:column">${cards}</div>`;
            } else {
                partidosContainer.innerHTML = `<div style="color:var(--text-muted);font-size:.85rem;padding:.5rem 0">No hay partidos programados para hoy.</div>`;
            }
        }
    };

    // ── DETALLE DE EQUIPO — REEMPLAZADO CON ESPN REAL ─────────────────────────
    const renderEquipoDetalle = async (equipoId, ligaId, equipoName) => {
        const decodedName = decodeURIComponent(equipoName || equipoId || 'Equipo');

        // Estructura inmediata
        appContainer.innerHTML = `
            ${renderNavbar('#/equipo?id=' + equipoId)}
            <main class="page-container fade-in">
                <a href="javascript:history.back()" style="color:var(--text-muted);text-decoration:none;display:inline-block;margin-bottom:1rem">← Volver a la Tabla</a>
                <div class="equipo-header">
                    <div id="equipo-logo-wrap">
                        <div class="team-shield" style="width:70px;height:70px;font-size:2rem">${decodedName.charAt(0)}</div>
                    </div>
                    <div>
                        <h1 class="equipo-title">${decodedName}</h1>
                        <span style="color:var(--text-muted);font-weight:600">ANÁLISIS TÁCTICO &amp; PLANTILLA</span>
                    </div>
                </div>
                <div class="equipo-grid">
                    <div class="glass-panel" style="padding:1.5rem">
                        <h3 class="panel-title">Lista de Convocados</h3>
                        <div id="roster-container" class="roster-list">
                            ${Array(11).fill('<div class="skel-cell" style="height:44px;margin-bottom:6px;border-radius:8px"></div>').join('')}
                        </div>
                    </div>
                    <div class="glass-panel" style="padding:1.5rem">
                        <h3 class="panel-title">Formación 4-3-3</h3>
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

        // Intentar cargar el roster real de ESPN si hay liga
        if (!ligaId) return;

        try {
            const teams = await ESPN.getTeams(ligaId);
            const team  = teams.find(t => String(t.id) === String(decodeURIComponent(equipoId)));
            if (!team) return;

            // Actualizar logo si lo tenemos
            const logoWrap = document.getElementById('equipo-logo-wrap');
            if (logoWrap && team.logo) {
                logoWrap.innerHTML = `<img src="${team.logo}" alt="${team.name}" style="width:70px;height:70px;object-fit:contain;filter:drop-shadow(0 4px 12px rgba(0,0,0,.7))">`;
                // Borde accent con el color del equipo
                const header = document.querySelector('.equipo-header');
                if (header && team.color) header.style.borderLeft = `6px solid ${team.color}`;
            }

            // Actualizar roster container con info del venue al menos
            const rosterContainer = document.getElementById('roster-container');
            if (rosterContainer && team.venue) {
                rosterContainer.innerHTML = `
                    <div style="padding:.75rem;background:rgba(255,255,255,.03);border:1px solid var(--border-glass);border-radius:8px;margin-bottom:1rem">
                        <span style="color:var(--text-muted);font-size:.8rem;text-transform:uppercase;letter-spacing:.5px">Estadio</span>
                        <div style="font-weight:600;margin-top:2px">${team.venue}</div>
                    </div>
                    <div style="padding:1rem;color:var(--text-muted);font-size:.85rem;text-align:center;border:1px dashed var(--border-glass);border-radius:8px">
                        Las plantillas con jugadores y dorsales reales requieren un endpoint de roster (disponible en API-Football Premium o ESPN App API autenticada).
                    </div>`;
            }
        } catch (err) {
            console.warn('[renderEquipoDetalle] No se pudo cargar equipo:', err.message);
        }
    };

    // ── H2H — sin cambios ─────────────────────────────────────────────────────
    const renderH2H = () => {
        appContainer.innerHTML = `
            ${renderNavbar('#/h2h')}
            <main class="page-container fade-in">
                <h2 class="section-title">⚔️ Head to Head</h2>
                <div class="glass-panel h2h-header-panel">
                    <div class="h2h-team"><div class="team-shield" style="background:rgba(255,255,255,.9);color:#000">RMA</div><div class="h2h-team-name">Real Madrid</div><span class="badge-liga" style="background:#001489">ESPAÑA</span></div>
                    <div class="h2h-vs">VS</div>
                    <div class="h2h-team"><div class="team-shield" style="background:#6CABDD;color:#fff">MCI</div><div class="h2h-team-name">Man. City</div><span class="badge-liga" style="background:#3d195b">INGLATERRA</span></div>
                </div>
                <div class="glass-panel h2h-stats-board">
                    <h3 class="panel-title" style="text-align:center;border:none">Probabilidad de Victoria</h3>
                    <div class="h2h-stat-row"><div class="h2h-stat-labels"><span style="color:var(--text-main)">45%</span><span class="lbl-center">Probabilidad Algorítmica</span><span style="color:var(--accent-neon)">55%</span></div><div class="h2h-bar-container"><div class="h2h-bar-left" style="width:45%"></div><div class="h2h-bar-right" style="width:55%"></div></div></div>
                    <div class="h2h-stat-row" style="margin-top:1rem"><div class="h2h-stat-labels"><span style="color:var(--text-main)">2.4</span><span class="lbl-center">Goles Esperados (xG)</span><span style="color:var(--accent-neon)">2.1</span></div><div class="h2h-bar-container"><div class="h2h-bar-left" style="width:53%"></div><div class="h2h-bar-right" style="width:47%"></div></div></div>
                    <div class="h2h-stat-row" style="margin-top:1rem"><div class="h2h-stat-labels"><span style="color:var(--text-main)">14</span><span class="lbl-center">Títulos Internacionales</span><span style="color:var(--accent-neon)">1</span></div><div class="h2h-bar-container"><div class="h2h-bar-left" style="width:93%"></div><div class="h2h-bar-right" style="width:7%"></div></div></div>
                    <div class="h2h-stat-row" style="margin-top:1rem"><div class="h2h-stat-labels"><span style="color:var(--text-main)">48%</span><span class="lbl-center">Posesión Media Temp.</span><span style="color:var(--accent-neon)">68%</span></div><div class="h2h-bar-container"><div class="h2h-bar-left" style="width:41%"></div><div class="h2h-bar-right" style="width:59%"></div></div></div>
                </div>
            </main>
        `;
    };

    // ── INFO — sin cambios ────────────────────────────────────────────────────
    const renderInfo = () => {
        appContainer.innerHTML = `
            ${renderNavbar('#/info')}
            <main class="page-container fade-in">
                <h2 class="section-title">📰 Info &amp; Noticias</h2>
                <div class="news-grid">
                    <article class="news-card"><div class="news-image-placeholder">🤝</div><div class="news-content"><div class="news-header"><span class="news-tag tag-mercado">Mercado</span><span class="news-date">Hace 2 horas</span></div><h3 class="news-title">Acuerdo total: El fichaje más caro de la historia</h3><p class="news-excerpt">Fuentes cercanas al club confirman que las negociaciones han llegado a buen puerto. El anuncio oficial se hará mañana al mediodía.</p><a href="#" class="news-read-more">Leer completo →</a></div></article>
                    <article class="news-card"><div class="news-image-placeholder">🎙️</div><div class="news-content"><div class="news-header"><span class="news-tag tag-declaracion">Declaraciones</span><span class="news-date">Hace 5 horas</span></div><h3 class="news-title">"El arbitraje de hoy fue una verdadera vergüenza"</h3><p class="news-excerpt">El presidente del club explotó en conferencia de prensa tras el polémico empate. Pidió sanciones severas.</p><a href="#" class="news-read-more">Ver video →</a></div></article>
                    <article class="news-card"><div class="news-image-placeholder">🚑</div><div class="news-content"><div class="news-header"><span class="news-tag tag-lesion">Reporte Médico</span><span class="news-date">Ayer</span></div><h3 class="news-title">Rotura de ligamentos: Se despide de la temporada</h3><p class="news-excerpt">El cuerpo médico confirmó los peores temores. El capitán será operado este viernes y tendrá un tiempo estimado de recuperación de 8 meses.</p><a href="#" class="news-read-more">Ver parte médico →</a></div></article>
                    <article class="news-card"><div class="news-image-placeholder">👀</div><div class="news-content"><div class="news-header"><span class="news-tag tag-mercado">Rumores</span><span class="news-date">Ayer</span></div><h3 class="news-title">¿Vuelve a casa? El guiño en redes sociales</h3><p class="news-excerpt">El ídolo histórico posteó una foto misteriosa que enloqueció a los hinchas. Ya es agente libre para negociar.</p><a href="#" class="news-read-more">Leer rumores →</a></div></article>
                </div>
            </main>
        `;
    };

    // ── LOGIN — sin cambios ───────────────────────────────────────────────────
    const renderLogin = () => {
        appContainer.innerHTML = `
            <main class="login-view fade-in">
                <div class="login-card">
                    <div class="login-logo">EL <span>FULBO</span></div>
                    <div id="form-contenedor">
                        <div class="input-container"><label>Dirección de Email</label><input type="email" id="auth-email" class="glass-input" placeholder="manager@elfulbo.com" autocomplete="off"></div>
                        <div class="input-container"><label>Contraseña</label><input type="password" id="auth-password" class="glass-input" placeholder="••••••••"></div>
                        <div id="auth-error-log" style="color:#ff4757;font-size:.85rem;margin-bottom:1rem;min-height:20px"></div>
                        <button id="auth-submit-trigger" class="btn-submit">Ingresar al Sistema</button>
                    </div>
                </div>
            </main>
        `;
        const btn = document.getElementById('auth-submit-trigger');
        const emailInput = document.getElementById('auth-email');
        const passwordInput = document.getElementById('auth-password');
        const errorFeedback = document.getElementById('auth-error-log');
        const executeAuth = () => {
            errorFeedback.textContent = '';
            emailInput.style.borderColor = '';
            passwordInput.style.borderColor = '';
            if (!Auth.login(emailInput.value, passwordInput.value)) {
                errorFeedback.textContent = 'Acceso denegado.';
                emailInput.style.borderColor = '#ff4757';
                passwordInput.style.borderColor = '#ff4757';
            }
        };
        btn.addEventListener('click', executeAuth);
        passwordInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') executeAuth(); });
    };

    // ── ROUTER ────────────────────────────────────────────────────────────────
    const router = () => {
        const hash = window.location.hash || '#/home';
        const url  = new URL(`http://dummy.com${hash.replace('#', '')}`);
        const path = '#' + url.pathname;

        if (!Auth.isAuthenticated() && path !== '#/login') { window.location.hash = '#/login'; return; }

        switch (path) {
            case '#/login':  Auth.isAuthenticated() ? window.location.hash = '#/home' : renderLogin(); break;
            case '#/home':   renderHome();   break;
            case '#/ligas':  renderLigas();  break;
            case '#/liga':   renderLigaDetalle(url.searchParams.get('id')); break;
            case '#/equipo': renderEquipoDetalle(
                url.searchParams.get('id'),
                url.searchParams.get('liga'),
                url.searchParams.get('name')
            ); break;
            case '#/h2h':    renderH2H();    break;
            case '#/info':   renderInfo();   break;
            default: appContainer.innerHTML = `${renderNavbar(path)}<main class="page-container fade-in" style="text-align:center;padding-top:15%"><h2 class="section-title" style="border:none;color:var(--accent-neon)">Módulo en desarrollo</h2></main>`; break;
        }
    };

    const init = () => {
        window.addEventListener('hashchange', router);
        window.addEventListener('load', router);
    };

    return { init };
})();

App.init();
