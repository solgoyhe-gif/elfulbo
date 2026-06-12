const Auth = (() => {
    const KEY = 'fulbo_user';

    const isAuthenticated = () => {
        return localStorage.getItem(KEY) !== null;
    };

    const login = (email, password) => {
        // Mock de validación
        if(email && password) {
            localStorage.setItem(KEY, JSON.stringify({ email, token: 'mock-token-123' }));
            return true;
        }
        return false;
    };

    const register = (email, password) => {
        if(email && password) {
            localStorage.setItem(KEY, JSON.stringify({ email, token: 'mock-token-123' }));
            return true;
        }
        return false;
    };

    const logout = () => {
        localStorage.removeItem(KEY);
        window.location.hash = '#/login';
    };

    return { isAuthenticated, login, register, logout };
})();
