// js/auth.js
const Auth = (() => {
    const KEY = 'fulbo_session';

    // Comprueba si existe la sesión en localStorage
    const isAuthenticated = () => !!localStorage.getItem(KEY);

    // Lógica de acceso (simulada)
    const login = (email, password) => {
        if (email.trim() !== '' && password.trim() !== '') {
            localStorage.setItem(KEY, JSON.stringify({ email, token: 'mock-token-777' }));
            window.location.hash = '#/home'; // Redirige al dashboard
            return true;
        }
        return false;
    };

    // Lógica de cierre de sesión
    const logout = () => {
        localStorage.removeItem(KEY);
        window.location.hash = '#/login'; // Expulsa al login
    };

    return { isAuthenticated, login, logout };
})();
