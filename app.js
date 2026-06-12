const App = (() => {
    const appContainer = document.getElementById('app');

    const renderNavbar = (activeHash) => `
        <nav class="navbar fade-in">
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

    const renderLogin = () => {
        appContainer.innerHTML = `
            <main class="home-view fade-in" style="flex-direction: column; gap: 2rem;">
                <h1 class="hero-title" style="position: relative; transform: none; top: auto; left: auto;">LOGIN</h1>
                <button onclick="Auth.login('Manager')" style="padding: 10px 30px; background: var(--accent-neon); border: none; font-weight: bold; cursor: pointer; border-radius: 4px;">ENTRAR</button>
            </main>
        `;
    };

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
                renderLogin();
                break;
            case '#/home':
                renderHome();
                break;
            default:
                appContainer.innerHTML = `${renderNavbar(path)}<main class="home-view fade-in" style="align-items: flex-start; padding-top: 100px;"><h2 style="font-family: var(--font-heading); color: var(--accent-neon);">Construyendo ${path}...</h2></main>`;
                break;
        }
    };

    const init = () => {
        window.addEventListener('hashchange', router);
        window.addEventListener('load', router);
        window.Auth = Auth; 
    };

    return { init };
})();

App.init();
