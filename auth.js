// js/auth.js - Módulo de Autenticación de El Fulbo
const Auth = (() => {
    const KEY = 'fulbo_session';

    // Comprueba el estado de la sesión en el almacenamiento local
    const isAuthenticated = () => {
        return localStorage.getItem(KEY) !== null;
    };

    // Lógica para registrar credenciales y redirigir al dashboard
    const login = (email, password) => {
        if (email.trim() !== '' && password.trim() !== '') {
            localStorage.setItem(KEY, JSON.stringify({ email: email.trim(), token: 'mock-token-777-es6' }));
            window.location.hash = '#/home';
            return true;
        }
        return false;
    };

    // Lógica para destruir la sesión y forzar la expulsión al login
    const logout = () => {
        localStorage.removeItem(KEY);
        window.location.hash = '#/login';
    };

    return { isAuthenticated, login, logout };
})();
