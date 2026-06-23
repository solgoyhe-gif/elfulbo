// auth.js — FirebaseAuth global, sin módulos ES
// Firebase SDK se carga como módulo en index.html y expone window._firebaseAuth

window.FirebaseAuth = {
    _usuario: null,
    _perfil:  null,
    _listeners: [],
    _listo: false,       // true después del primer disparo del observer
    _resolvers: [],      // callbacks esperando que el observer se dispare
    PLANES: window.PLANES,

    init(auth, db) {
        this._auth = auth;
        this._db   = db;
        auth.onAuthStateChanged(async (user) => {
            this._usuario = user;
            if (user) {
                try {
                    const snap = await db.collection('usuarios').doc(user.uid).get();
                    this._perfil = snap.exists ? snap.data() : { plan: 'free', nombre: user.displayName ?? '' };
                } catch(e) {
                    this._perfil = { plan: 'free', nombre: user.displayName ?? '' };
                }
            } else {
                this._perfil = null;
            }
            // Marcar como listo y resolver los que estaban esperando
            if (!this._listo) {
                this._listo = true;
                this._resolvers.forEach(fn => fn());
                this._resolvers = [];
            }
            this._listeners.forEach(fn => fn(user));
        });
    },

    // Esperar a que el observer se dispare al menos una vez
    esperarListo() {
        if (this._listo) return Promise.resolve();
        return new Promise(resolve => this._resolvers.push(resolve));
    },

    onChange(fn)          { this._listeners.push(fn); },
    isAuthenticated()     { return !!this._usuario; },
    getUser()             { return this._usuario; },
    getPerfil()           { return this._perfil; },
    getNombre()           { return this._perfil?.nombre ?? this._usuario?.displayName ?? 'Usuario'; },
    getPlan()             { return this._perfil?.plan ?? 'free'; },
    isPremium()           { return ['pro','promax'].includes(this._perfil?.plan); },
    getEquipoFavorito()   { return this._perfil?.equipoFavorito ?? null; },

    async login(email, password) {
        const cred = await this._auth.signInWithEmailAndPassword(email, password);
        return cred.user;
    },

    async registrar(email, password, nombre) {
        const cred = await this._auth.createUserWithEmailAndPassword(email, password);
        await cred.user.updateProfile({ displayName: nombre });
        try {
            await this._db.collection('usuarios').doc(cred.user.uid).set({
                nombre, email, plan: 'free',
                equipoFavorito: null,
                ligaNacional: null,
                ligaInternacional: null,
                pais: null,
                perfilCompleto: false,
                creadoEn: new Date().toISOString()
            });
        } catch(e) { console.warn('Firestore no disponible, perfil solo en memoria'); }
        this._perfil = { nombre, email, plan: 'free', equipoFavorito: null };
        return cred.user;
    },

    async logout() {
        await this._auth.signOut();
        window.location.hash = '#/';
    },

    async recuperarPassword(email) {
        await this._auth.sendPasswordResetEmail(email);
    },

    async actualizarPerfil(datos) {
        if (!this._usuario) return;
        try {
            await this._db.collection('usuarios').doc(this._usuario.uid).update(datos);
        } catch(e) { console.warn('Firestore no disponible'); }
        this._perfil = { ...this._perfil, ...datos };
    }
};
