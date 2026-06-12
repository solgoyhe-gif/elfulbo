const App = (() => {
    const appContainer = document.getElementById('app');

    const renderNavbar = (activeHash) => `
        <nav class="navbar">
            <a href="#/home" class="nav-link ${activeHash === '#/home' ? 'active' : ''}">Inicio</a>
            <a href="#/ligas" class="nav-link ${activeHash === '#/ligas' ? 'active' : ''}">Ligas</a>
            <a href="#/h2h" class="nav-link ${activeHash === '#/h2h' ? 'active' : ''}">H2H</a>
            <a href="#/info" class="nav-link ${activeHash === '#/info' ? 'active' : ''}">Info</a>
        </nav>
    `;

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

    const renderLigas = () => {
        let html = `
            ${renderNavbar('#/ligas')}
            <main class="page-container fade-in">
                <h2 class="section-title">🏆 Competiciones Disponibles</h2>
        `;

        // Iterar sobre el objeto LIGAS de data.js
        for (const key in LIGAS) {
            const categoria = LIGAS[key];
            html += `
                <div class="categoria-section">
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
                            <span class="badge" style="background-color: ${liga.badge_color};">${liga.id.toUpperCase().substring(0, 5)}</span>
                        </div>
                `;
            });

            html += `</div></div>`;
        }

        html += `</main>`;
        appContainer.innerHTML = html;
    };

    const router = () => {
        const hash = window.location.hash || '#/home';
        
        // Simulación auth
        if (!Auth.isAuthenticated() && hash !== '#/login') {
            window.location.hash = '#/login';
            return;
        }

        if (hash === '#/home') {
            renderHome();
        } else if (hash === '#/ligas') {
            renderLigas();
        } else {
            // Placeholder para rutas no implementadas aún
            appContainer.innerHTML = `
                ${renderNavbar(hash)}
                <main class="page-container fade-in" style="text-align: center; padding-top: 200px;">
                    <h2 class="section-title" style="border:none; color: var(--accent-neon);">Construyendo vista...</h2>
                </main>
            `;
        }
    };

    const init = () => {
        window.addEventListener('hashchange', router);
        window.addEventListener('load', router);
    };

    return { init };
})();

App.init();
