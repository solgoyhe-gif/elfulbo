// auth.js — Wrapper de autenticación Firebase para la SPA
import { 
    login, logout, registrar, recuperarPassword,
    onAuth, usuarioActual, getPerfil, updatePerfil, PLANES
} from './firebase.js';

window.FirebaseAuth = {
    // Estado
    _usuario: null,
    _perfil:  null,
    _listeners: [],

    // Inicializar observer
    init() {
        onAuth(async (user) => {
            this._usuario = user;
            if (user) {
                this._perfil = await getPerfil(user.uid);
            } else {
                this._perfil = null;
            }
            this._listeners.forEach(fn => fn(user));
        });
    },

    // Suscribirse a cambios de auth
    onChange(fn) {
        this._listeners.push(fn);
    },

    // Getters
    isAuthenticated() { return !!this._usuario; },
    getUser()         { return this._usuario; },
    getPerfil()       { return this._perfil; },
    getNombre()       { return this._perfil?.nombre ?? this._usuario?.displayName ?? 'Usuario'; },
    getPlan()         { return this._perfil?.plan ?? 'free'; },
    isPremium()       { return this._perfil?.plan === 'premium'; },
    getEquipoFavorito() { return this._perfil?.equipoFavorito ?? null; },

    // Acciones
    async login(email, password) {
        const user = await login(email, password);
        return user;
    },

    async registrar(email, password, nombre) {
        const user = await registrar(email, password, nombre);
        return user;
    },

    async logout() {
        await logout();
    },

    async recuperarPassword(email) {
        await recuperarPassword(email);
    },

    async actualizarPerfil(datos) {
        if (!this._usuario) return;
        await updatePerfil(this._usuario.uid, datos);
        this._perfil = { ...this._perfil, ...datos };
    },

    PLANES
};

// Inicializar inmediatamente
window.FirebaseAuth.init();
