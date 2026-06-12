// js/app.js - Enrutador Principal e Interfaz Dinámica SPA
const App = (() => {
    const appContainer = document.getElementById('app');

    // Estructura compartida de la barra de navegación (Navbar / Tab Bar)
    const renderNavbar = (activeHash) => {
        return `
            <nav class="navbar">
                <div class="nav-links-group">
                    <a href="#/home" class="nav-link ${activeHash === '#/home' ? 'active' : ''}">Inicio</a>
                    <a href="#/ligas" class="nav-link ${activeHash === '#/ligas' ? 'active' : ''}">Ligas</a>
                    <a href="#/h2h" class="nav-link ${activeHash === '#/h2h' ? 'active' : ''}">H2H</a>
                    <a href="#/info" class="nav-link ${activeHash === '#/info' ? 'active' : ''}">Info</a>
                </div>
                ${Auth.isAuthenticated() ? `<button onclick="Auth.logout()" class="btn-logout">Salir</button>` : ''}
            </nav>
        `;
    };

    // Renderizado de la Vista Principal (PASO 2)
    const renderHome = () => {
        appContainer.innerHTML = `
            ${renderNavbar('#/home')}
            <main class="home-view fade-in">
                <h1 class="hero-title">EL FULBO</h1>
                <div class="pitch-perspective">
                    <div class="pitch-3d">
                        <div class="area-top"></div>
                        <div class="area-bottom"></div>
                    </div>
                </div>
            </main>
        `;
    };

    // Renderizado del Listado de Competiciones por Categoría (PASO 4)
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

    // Renderizado de la Vista de Login (PASO 3 - Eventos nativos sin <form>)
    const renderLogin = () => {
        appContainer.innerHTML = `
            <main class="login-view fade-in">
                <div class="login-card">
                    <div class="login-logo">EL <span>FULBO</span></div>
                    
                    <div class="auth-form-wrapper" id="form-contenedor">
                        <div class="input-container">
                            <label>Dirección de Email</label>
                            <input type="email" id="auth-email" class="glass-input" placeholder="manager@elfulbo.com" autocomplete="off">
                        </div>
                        
                        <div class="input-container">
                            <label>Contraseña</label>
                            <input type="password" id="auth-password" class="glass-input" placeholder="••••••••">
                        </div>
                        
                        <div id="auth-error-log" class="error-feedback"></div>
                        
                        <button id="auth-submit-trigger" class="btn-submit">Ingresar al Sistema</button>
                    </div>
                </div>
            </main>
        `;

        // Captura de elementos e inyección de listeners controlados por JS
        const btnSubmit = document.getElementById('auth-submit-trigger');
        const emailInput = document.getElementById('auth-email');
        const passwordInput = document.getElementById('auth-password');
        const errorFeedback = document.getElementById('auth-error-log');

        const executeAuthentication = () => {
            errorFeedback.textContent = '';
            emailInput.style.borderColor = '';
            passwordInput.style.borderColor = '';

            const isLogged = Auth.login(emailInput.value, passwordInput.value);
            if (!isLogged) {
                errorFeedback.textContent = 'Acceso denegado. Verifique los campos.';
                emailInput.style.borderColor = '#ff4757';
                passwordInput.style.borderColor = '#ff4757';
            }
        };

        btnSubmit.addEventListener('click', executeAuthentication);
        
        // Manejo táctil / teclado intuitivo
        passwordInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') executeAuthentication();
        });
    };

    // Núcleo del Enrutador Dinámico
    const router = () => {
        const hash = window.location.hash || '#/home';
        const url = new URL(`http://dummy.com${hash.replace('#', '')}`);
        const path = '#' + url.pathname;

        // Guardia de Seguridad Perimetral
        if (!Auth.isAuthenticated() && path !== '#/login') {
            window.location.hash = '#/login';
            return;
        }

        switch (path) {
            case '#/login':
                if (Auth.isAuthenticated()) {
                    window.location.hash = '#/home';
                } else {
                    renderLogin();
                }
                break;
            case '#/home':
                renderHome();
                break;
            case '#/ligas':
                renderLigas();
                break;
            default:
                // Fallback dinámico
                appContainer.innerHTML = `
                    ${renderNavbar(path)}
                    <main class="page-container fade-in" style="text-align: center; padding-top: 15%;">
                        <h2 class="section-title" style="border:none; color: var(--accent-neon);">Procesando Vista Módulo: ${path}</h2>
                        <p style="color: var(--text-muted)">ID Solicitado de Competición: ${url.searchParams.get('id') || 'Global'}</p>
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

// Inicialización de la SPA
App.init();
