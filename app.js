// js/app.js - Enrutador Principal e Interfaz Dinámica SPA
const App = (() => {
    const appContainer = document.getElementById('app');

    const renderNavbar = (activeHash) => {
        const isLigasActive = activeHash === '#/ligas' || activeHash.includes('#/liga?id=') || activeHash.includes('#/equipo?id=');
        
        return `
            <nav class="navbar">
                <div class="nav-links-group">
                    <a href="#/home" class="nav-link ${activeHash === '#/home' ? 'active' : ''}">Inicio</a>
                    <a href="#/ligas" class="nav-link ${isLigasActive ? 'active' : ''}">Ligas</a>
                    <a href="#/h2h" class="nav-link ${activeHash === '#/h2h' ? 'active' : ''}">H2H</a>
                    <a href="#/info" class="nav-link ${activeHash === '#/info' ? 'active' : ''}">Info</a>
                </div>
                ${Auth.isAuthenticated() ? `<button onclick="Auth.logout()" class="btn-logout">Salir</button>` : ''}
            </nav>
        `;
    };

    // DASHBOARD PRINCIPAL
    const renderHome = () => {
        let miniLigasHtml = '';
        if (typeof LIGAS !== 'undefined') {
            const ligasDestacadas = [...LIGAS.europa_top5.competiciones, ...LIGAS.sudamerica.competiciones];
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
                            <div class="stat-fill-local" style="width: 60%;"></div>
                            <div class="stat-fill-visita" style="width: 40%;"></div>
                        </div>
                        <div class="stat-values">
                            <span>60%</span>
                            <span style="color:var(--accent-neon)">40%</span>
                        </div>
                    </div>

                    <div class="stat-box">
                        <div class="stat-header">
                            <span>Tiros a Puerta</span>
                        </div>
                        <div class="stat-bar">
                            <div class="stat-fill-local" style="width: 75%;"></div>
                            <div class="stat-fill-visita" style="width: 25%;"></div>
                        </div>
                        <div class="stat-values">
                            <span>12</span>
                            <span style="color:var(--accent-neon)">4</span>
                        </div>
                    </div>

                    <div class="stat-box">
                        <div class="stat-header">
                            <span>Faltas</span>
                        </div>
                        <div class="stat-bar">
                            <div class="stat-fill-local" style="width: 45%;"></div>
                            <div class="stat-fill-visita" style="width: 55%;"></div>
                        </div>
                        <div class="stat-values">
                            <span>9</span>
                            <span style="color:var(--accent-neon)">11</span>
                        </div>
                    </div>
                </section>

                <section class="panel-center">
                    <div style="position:absolute; top:0; font-family:var(--font-heading); font-size:2rem; font-weight:800; letter-spacing:2px; z-index:10; text-shadow: 0 5px 15px #000;">EL FULBO</div>
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
                    <h3 class="panel-title" style="margin-bottom:0; border:none;">🚨 URGENTE</h3>
                    <div class="news-ticker">
                        <span class="news-item"><span>MERCADO:</span> Fichaje bomba confirmado en la liga inglesa.</span>
                        <span class="news-item"><span>LESIÓN:</span> Estrella fuera por 3 semanas.</span>
                        <span class="news-item"><span>SORTEO:</span> Definidos los cruces de cuartos de final.</span>
                    </div>
                </section>

            </main>
        `;
    };

    // LISTADO GLOBAL DE LIGAS
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

    // VISTA DETALLADA DE LA LIGA
    const renderLigaDetalle = (ligaId) => {
        let ligaData = null;
        for (const cat in LIGAS) { 
            const found = LIGAS[cat].competiciones.find(l => l.id === ligaId); 
            if (found) ligaData = found; 
        }

        if (!ligaData) {
            appContainer.innerHTML = `
                ${renderNavbar('#/ligas')}
                <main class="page-container fade-in">
                    <h2 class="section-title">Error: Liga no encontrada</h2>
                    <a href="#/ligas" class="nav-link">Volver</a>
                </main>
            `;
            return;
        }

        const mockNombres = ['Atlético', 'Sporting', 'United', 'Real', 'Deportivo', 'City', 'Rovers', 'Wanderers'];
        let tablaHtml = '';
        for(let i = 1; i <= 8; i++) {
            const pts = 30 - (i * 3) + Math.floor(Math.random() * 3);
            const nombreEquipo = mockNombres[i-1] + ' ' + ligaData.pais.substring(0,3);
            
            tablaHtml += `
                <tr onclick="window.location.hash='#/equipo?id=${encodeURIComponent(nombreEquipo)}'">
                    <td class="col-pos">${i}</td>
                    <td class="col-team">
                        <span class="team-shield">${ligaData.nombre.charAt(0)}</span> 
                        ${nombreEquipo}
                    </td>
                    <td>10</td>
                    <td>${Math.floor(pts/3)}</td>
                    <td>0</td>
                    <td>0</td>
                    <td class="col-pts">${pts}</td>
                </tr>
            `;
        }

        appContainer.innerHTML = `
            ${renderNavbar('#/liga?id=' + ligaId)}
            <main class="page-container fade-in">
                <a href="#/ligas" style="color: var(--text-muted); text-decoration: none; display: inline-block; margin-bottom: 1rem;">← Volver al Listado</a>
                
                <div class="liga-header" style="border-left: 6px solid ${ligaData.badge_color};">
                    <span class="liga-flag-large">${ligaData.flag}</span>
                    <div>
                        <h1 class="liga-title-main">${ligaData.nombre}</h1>
                        <span style="color: var(--text-muted); font-weight: 600;">${ligaData.pais}</span>
                    </div>
                </div>

                <div class="liga-content-grid">
                    <div class="glass-panel" style="padding: 1.5rem;">
                        <h3 class="panel-title" style="color: ${ligaData.badge_color};">Tabla de Posiciones</h3>
                        <div class="table-responsive">
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
                                    ${tablaHtml}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <div class="glass-panel" style="padding: 1.5rem; height: fit-content;">
                        <h3 class="panel-title" style="color: ${ligaData.badge_color};">Próxima Fecha</h3>
                        <div class="match-list">
                            <div class="match-item">
                                <div class="match-teams">
                                    <span>${mockNombres[0]}</span>
                                    <span>${mockNombres[3]}</span>
                                </div>
                                <span class="match-date">SÁB 15:00</span>
                            </div>
                        </div>
                    </div>
                </div>
            </main>
        `;
    };

    // PERFIL DE EQUIPO
    const renderEquipoDetalle = (equipoId) => {
        const decodedName = decodeURIComponent(equipoId || 'Equipo');
        
        const jugadores = [
            {num:1,n:'J. Martínez',p:'POR'},
            {num:4,n:'A. Davies',p:'DEF'},
            {num:3,n:'M. Silva',p:'DEF'},
            {num:2,n:'L. Hernández',p:'DEF'},
            {num:5,n:'R. Varane',p:'DEF'},
            {num:8,n:'T. Kroos',p:'MED'},
            {num:6,n:'N. Kanté',p:'MED'},
            {num:10,n:'L. Messi',p:'MED'},
            {num:7,n:'K. Mbappé',p:'DEL'},
            {num:9,n:'E. Haaland',p:'DEL'},
            {num:11,n:'V. Júnior',p:'DEL'}
        ];

        let rosterHtml = '';
        jugadores.forEach(j => {
            rosterHtml += `
                <div class="roster-item">
                    <span class="player-num">${j.num}</span>
                    <span class="player-name">${j.n}</span>
                    <span class="player-pos">${j.p}</span>
                </div>
            `;
        });

        appContainer.innerHTML = `
            ${renderNavbar('#/equipo?id=' + equipoId)}
            <main class="page-container fade-in">
                <a href="javascript:history.back()" style="color: var(--text-muted); text-decoration: none; display: inline-block; margin-bottom: 1rem;">← Volver a la Tabla</a>
                
                <div class="equipo-header">
                    <div class="team-shield" style="width: 70px; height: 70px; font-size: 2rem;">${decodedName.charAt(0)}</div>
                    <div>
                        <h1 class="equipo-title">${decodedName}</h1>
                        <span style="color: var(--text-muted); font-weight: 600;">ANÁLISIS TÁCTICO & PLANTILLA</span>
                    </div>
                </div>

                <div class="equipo-grid">
                    <div class="glass-panel" style="padding: 1.5rem;">
                        <h3 class="panel-title">Lista de Convocados</h3>
                        <div class="roster-list">
                            ${rosterHtml}
                        </div>
                    </div>

                    <div class="glass-panel" style="padding: 1.5rem;">
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
    };

    // MÓDULO HEAD TO HEAD (H2H)
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
                    
                    <div class="h2h-stat-row" style="margin-top: 1rem;">
                        <div class="h2h-stat-labels">
                            <span style="color:var(--text-main)">48%</span>
                            <span class="lbl-center">Posesión Media Temp.</span>
                            <span style="color:var(--accent-neon)">68%</span>
                        </div>
                        <div class="h2h-bar-container">
                            <div class="h2h-bar-left" style="width: 41%;"></div>
                            <div class="h2h-bar-right" style="width: 59%;"></div>
                        </div>
                    </div>

                </div>
            </main>
        `;
    };

    // NUEVO: PASO 8 - MÓDULO INFO (PERFIL DEL MÁNAGER)
    const renderInfo = () => {
        appContainer.innerHTML = `
            ${renderNavbar('#/info')}
            <main class="page-container fade-in">
                <div class="profile-header">
                    <div class="profile-avatar">👤</div>
                    <div class="profile-email">manager@elfulbo.com</div>
                    <div class="profile-role">Pro Manager Nivel 42</div>
                </div>

                <div class="info-grid">
                    <div class="glass-panel" style="padding: 1.5rem;">
                        <h3 class="panel-title">📈 Estadísticas Globales</h3>
                        
                        <div class="stat-box" style="margin-top: 1rem;">
                            <div class="stat-header">
                                <span>Partidos Dirigidos</span>
                                <span style="color:var(--text-main); font-size: 1.2rem;">342</span>
                            </div>
                        </div>
                        
                        <div class="stat-box" style="margin-top: 1rem;">
                            <div class="stat-header">
                                <span>Porcentaje de Victorias</span>
                                <span style="color:var(--accent-neon); font-size: 1.2rem;">68.4%</span>
                            </div>
                        </div>
                        
                        <div class="stat-box" style="margin-top: 1rem;">
                            <div class="stat-header">
                                <span>Títulos Ganados</span>
                                <span style="color:var(--text-main); font-size: 1.2rem;">14</span>
                            </div>
                        </div>
                        
                        <div class="stat-box" style="margin-top: 1rem;">
                            <div class="stat-header">
                                <span>Ranking Global</span>
                                <span style="color:var(--accent-neon); font-size: 1.2rem; font-family: var(--font-heading);">#1.402</span>
                            </div>
                        </div>
                    </div>

                    <div class="glass-panel" style="padding: 1.5rem;">
                        <h3 class="panel-title">⚙️ Preferencias del Sistema</h3>
                        
                        <div class="settings-row">
                            <span>Notificaciones Push</span>
                            <div class="toggle-btn"></div>
                        </div>
                        
                        <div class="settings-row">
                            <span>Modo Rendimiento (Gráficos 3D)</span>
                            <div class="toggle-btn"></div>
                        </div>
                        
                        <div class="settings-row">
                            <span>Idioma de la Interfaz</span>
                            <span style="color: var(--accent-neon); font-weight: bold; cursor: pointer;">ESPAÑOL ▼</span>
                        </div>
                        
                        <div class="settings-row" style="margin-top: 1rem; justify-content: center; border-bottom: none;">
                            <button onclick="Auth.logout()" class="btn-submit" style="background: transparent; color: #ff4757; border: 1px solid #ff4757;">Cerrar Sesión Segura</button>
                        </div>
                    </div>
                </div>
            </main>
        `;
    };

    // FORMULARIO DE LOGIN
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

    // NÚCLEO DEL ENRUTADOR
    const router = () => {
        const hash = window.location.hash || '#/home';
        const url = new URL(`http://dummy.com${hash.replace('#', '')}`);
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
                renderLigaDetalle(url.searchParams.get('id')); 
                break;
            case '#/equipo': 
                renderEquipoDetalle(url.searchParams.get('id')); 
                break;
            case '#/h2h': 
                renderH2H(); 
                break;
            case '#/info': 
                renderInfo(); // INTERCEPCIÓN PASO 8
                break;
            default:
                appContainer.innerHTML = `
                    ${renderNavbar(path)}
                    <main class="page-container fade-in" style="text-align: center; padding-top: 15%;">
                        <h2 class="section-title" style="border:none; color: var(--accent-neon);">Módulo en desarrollo</h2>
                    </main>
                `;
                break;
        }
    };

    // INICIALIZACIÓN
    const init = () => {
        window.addEventListener('hashchange', router);
        window.addEventListener('load', router);
    };

    return { init };
})();

App.init();
