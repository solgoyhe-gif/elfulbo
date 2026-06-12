const App = (() => {
    const appContainer = document.getElementById('app');

    // Generador de Navbar compartido
    const getNavbarHTML = (activeRoute) => `
        <nav class="navbar">
            <a href="#/home" class="nav-link ${activeRoute === 'home' ? 'active' : ''}">Inicio</a>
            <a href="#/ligas" class="nav-link ${activeRoute === 'ligas' ? 'active' : ''}">Ligas</a>
            <a href="#/h2h" class="nav-link ${activeRoute === 'h2h' ? 'active' : ''}">H2H</a>
            <a href="#/info" class="nav-link ${activeRoute === 'info' ? 'active' : ''}">Info</a>
        </nav>
    `;

    // Vista HOME (Paso 2)
    const renderHome = () => {
        appContainer.innerHTML = `
            ${getNavbarHTML('home')}
            <main class="hero-container fade-in">
                <h1 class="hero-title">EL FULBO</h1>
                <div class="pitch-wrapper">
                    <div class="pitch-3d">
                        <div class="penalty-area-top"></div>
                        <div class="penalty-area-bottom"></div>
                    </div>
                </div>
            </main>
        `;
    };

    // Vista Placeholder para otras rutas temporales
    const renderPlaceholder = (title, route) => {
        appContainer.innerHTML = `
            ${getNavbarHTML(route)}
            <main class="fade-in" style="padding: 100px 20px; text-align: center;">
                <h2 style="font-family: var(--font-heading); color: var(--accent-neon); font-size: 2rem;">${title}</h2>
                <p>En desarrollo...</p>
            </main>
        `;
    };

    // Router Core
    const router = () => {
        const hash = window.location.hash || '#/home';
        
        // Simulación de protección de rutas
        if (!Auth.isAuthenticated() && hash !== '#/login') {
            window.location.hash = '#/login';
            return;
        }

        appContainer.innerHTML = ''; // Clean DOM

        if (hash === '#/home') {
            renderHome();
        } else if (hash === '#/login') {
            // Se implementará en el PASO 3
            renderPlaceholder('Login / Registro', 'login'); 
        } else if (hash === '#/ligas') {
            // Se implementará en el PASO 4
            renderPlaceholder('Módulo de Ligas', 'ligas');
        } else if (hash.startsWith('#/liga?id=')) {
            renderPlaceholder('Vista de Liga Detalle', 'ligas');
        } else if (hash === '#/h2h') {
            renderPlaceholder('Head to Head', 'h2h');
        } else if (hash === '#/info') {
            renderPlaceholder('Noticias e Info', 'info');
        } else {
            renderHome();
        }
    };

    const init = () => {
        window.addEventListener('hashchange', router);
        window.addEventListener('load', router);
    };

    return { init };
})();

// Inicializar la SPA
App.init();
