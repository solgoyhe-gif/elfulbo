// js/app.js - Enrutador Principal e Interfaz Dinámica SPA
const App = (() => {
    const appContainer = document.getElementById('app');

    const renderNavbar = (activeHash) => {
        // Asegura que la pestaña Ligas quede iluminada aunque estemos en un detalle
        const isLigasActive = activeHash === '#/ligas' || activeHash.includes('#/liga?id=');
        
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
                        <div class="stat-header"><span>Posesión</span></div>
                        <div class="stat-bar"><div class="stat-fill-local" style="width: 60%;"></div><div class="stat-fill-visita" style="width: 40%;"></div></div>
                        <div class="stat-values"><span>60%</span><span style="color:var(--accent-neon)">40%</span></div>
                    </div>
                    <div class="stat-box">
                        <div class="stat-header"><span>Tiros a Puerta</span></div>
                        <div class="stat-bar"><div class="stat-fill-local" style="width: 75%;"></div><div class="stat-fill-visita" style="width: 25%;"></div></div>
                        <div class="stat-values"><span>12</span><span style="color:var(--accent-neon)">4</span></div>
                    </div>
                    <div class="stat-box">
                        <div class="stat-header"><span>Faltas</span></div>
                        <div class="stat-bar"><div class="stat-fill-local" style="width: 45%;"></div><div class="stat-fill-visita" style="width: 55%;"></div></div>
                        <div class="stat-values"><span>9</span><span style="color:var(--accent-neon)">11</span></div>
                    </div>
                </section>

                <section class="panel-center">
                    <div style="position:absolute; top:0; font-family:var(--font-heading); font-size:2rem; font-weight:800; letter-spacing:2px; z-index:10; text-shadow: 0 5px 15px #000;">EL FULBO</div>
                    <div class="pitch-perspective">
                        <div class="pitch-horizontal"><div class="area-left"></div><div class="area-right"></div></div>
                    </div>
                </section>

                <section class="glass-panel panel-right">
                    <h3 class="panel-title">🏆 Top Ligas</h3>
                    ${miniLigasHtml}
                </section>

                <section class="glass-panel panel-bottom">
                    <h3 class="panel-title" style="margin-bottom:0; border:none;">🚨 URGENTE</h3>
                    <div class="news-ticker">
                        <span class="news-item"><span>MERCADO:</span> Fichaje histórico confirmado para la próxima temporada.</span>
                        <span class="news-item"><span>LESIÓN:</span> Estrella del líder fuera por 3 semanas.</span>
                        <span class="news-item"><span>SORTEO:</span> Definidos los cruces de cuartos de final.</span>
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
            html += `<div class="categoria-wrapper"><h3 class="category-title">${categoria.nombre}</h3><div class="leagues-grid">`;
            categoria.competiciones.forEach(liga => {
                html += `
                    <div class="glass-card league-card" onclick="window.location.hash='#/liga?id=${liga.id}'">
                        <div class="league-info"><span class="league-flag">${liga.flag}</span><div><div class="league-name">${liga.nombre}</div><div class="league-country">${liga.pais}</div></div></div>
                        <span class="badge-liga" style="background-color: ${liga.badge_color};">${liga.id.substring(0, 5)}</span>
                    </div>
                `;
            });
            html += `</div></div>`;
        }
        html += `</main>`;
        appContainer.innerHTML = html;
    };

    // NUEVO: PASO 5 - Renderizado de Detalles de Liga
    const renderLigaDetalle = (ligaId) => {
        // Buscar los datos de la liga en el objeto global
        let ligaData = null;
        for (const cat in LIGAS) {
            const found = LIGAS[cat].competiciones.find(l => l.id === ligaId);
            if (found) ligaData = found;
        }

        if (!ligaData) {
            appContainer.innerHTML = `${renderNavbar('#/ligas')}<main class="page-container fade-in"><h2 class="section-title">Error: Liga no encontrada</h2><a href="#/ligas" class="nav-link">Volver</a></main>`;
            return;
        }

        // Mock de Tabla de Posiciones Generada Dinámicamente
        const mockNombres = ['Atlético', 'Sporting', 'United', 'Real', 'Deportivo', 'City', 'Rovers', 'Wanderers', 'FC', 'Club'];
        let tablaHtml = '';
        for(let i = 1; i <= 8; i++) {
            const pts = 30 - (i * 3) + Math.floor(Math.random() * 3);
            const pg = Math.floor(pts / 3);
            tablaHtml += `
                <tr>
                    <td class="col-pos">${i}</td>
                    <td class="col-team"><span class="team-shield">${ligaData.nombre.charAt(0)}</span> ${mockNombres[i-1]} ${ligaData.pais.substring(0,3)}</td>
                    <td>10</td>
                    <td>${pg}</td>
                    <td>${10 - pg - Math.floor(Math.random()*2)}</td>
                    <td>${Math.floor(Math.random()*4)}</td>
                    <td class="col-pts">${pts}</td>
                </tr>
            `;
        }

        appContainer.innerHTML = `
            ${renderNavbar('#/liga?id=' + ligaId)}
            <main class="page-container fade-in">
                <a href="#/ligas" style="color: var(--text-muted); text-decoration: none; display: inline-block; margin-bottom: 1rem; font-size: 0.9rem;">← Volver al Listado</a>
                
                <div class="liga-header" style="border-left: 6px solid ${ligaData.badge_color};">
                    <span class="liga-flag-large">${ligaData.flag}</span>
                    <div>
                        <h1 class="liga-title-main">${ligaData.nombre}</h1>
                        <span style="color: var(--text-muted); font-weight: 600; text-transform: uppercase; letter-spacing: 2px;">${ligaData.pais}</span>
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
                                <div class="match-teams"><span>${mockNombres[0]}</span><span>${mockNombres[3]}</span></div>
                                <span class="match-date">SÁB 15:00</span>
                            </div>
                            <div class="match-item">
                                <div class="match-teams"><span>${mockNombres[1]}</span><span>${mockNombres[4]}</span></div>
                                <span class="match-date">SÁB 17:30</span>
                            </div>
                            <div class="match-item">
                                <div class="match-teams"><span>${mockNombres[2]}</span><span>${mockNombres[5]}</span></div>
                                <span class="match-date">DOM 14:00</span>
                            </div>
                            <div class="match-item">
                                <div class="match-teams"><span>${mockNombres[6]}</span><span>${mockNombres[7]}</span></div>
                                <span class="match-date">DOM 20:00</span>
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
                        <div class="input-container"><label>Dirección de Email</label><input type="email" id="auth-email" class="glass-input" placeholder="manager@elfulbo.com" autocomplete="off"></div>
                        <div class="input-container"><label>Contraseña</label><input type="password" id="auth-password" class="glass-input" placeholder="••••••••"></div>
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
            errorFeedback.textContent = ''; emailInput.style.borderColor = ''; passwordInput.style.borderColor = '';
            if (!Auth.login(emailInput.value, passwordInput.value)) {
                errorFeedback.textContent = 'Acceso denegado. Verifique los campos.';
                emailInput.style.borderColor = '#ff4757'; passwordInput.style.borderColor = '#ff4757';
            }
        };
        btnSubmit.addEventListener('click', executeAuthentication);
        passwordInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') executeAuthentication(); });
    };

    const router = () => {
        const hash = window.location.hash || '#/home';
        const url = new URL(`http://dummy.com${hash.replace('#', '')}`);
        const path = '#' + url.pathname;

        if (!Auth.isAuthenticated() && path !== '#/login') {
            window.location.hash = '#/login'; return;
        }

        switch (path) {
            case '#/login': Auth.isAuthenticated() ? window.location.hash = '#/home' : renderLogin(); break;
            case '#/home': renderHome(); break;
            case '#/ligas': renderLigas(); break;
            case '#/liga': renderLigaDetalle(url.searchParams.get('id')); break; // INTERCEPCIÓN DEL PASO 5
            default:
                appContainer.innerHTML = `${renderNavbar(path)}<main class="page-container fade-in" style="text-align: center; padding-top: 15%;"><h2 class="section-title" style="border:none; color: var(--accent-neon);">Construyendo módulo...</h2></main>`;
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
