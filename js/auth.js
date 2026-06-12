const Auth = (() => {
    const KEY = 'fulbo_session';

    const isAuthenticated = () => !!localStorage.getItem(KEY);

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
