const Auth = (() => {
    const KEY = 'fulbo_session';

    // Para esta fase de desarrollo, forzamos que siempre esté autenticado
    // Si quieres probar el login real, cambia esto a: return !!localStorage.getItem(KEY);
    const isAuthenticated = () => true; 

    const login = (username) => {
        localStorage.setItem(KEY, JSON.stringify({ user: username, token: 'mock-123' }));
        window.location.hash = '#/home';
    };

    const logout = () => {
        localStorage.removeItem(KEY);
        window.location.hash = '#/login';
    };

    return { isAuthenticated, login, logout };
})();
