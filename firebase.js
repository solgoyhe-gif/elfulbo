// firebase.js — Inicialización y funciones de autenticación
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-app.js";
import { 
    getAuth, 
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    signOut,
    onAuthStateChanged,
    updateProfile,
    sendPasswordResetEmail
} from "https://www.gstatic.com/firebasejs/12.15.0/firebase-auth.js";
import {
    getFirestore,
    doc,
    setDoc,
    getDoc,
    updateDoc
} from "https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyAsk59PCfgGBSkev0wZzlstFdMpcgImoyE",
    authDomain: "fulbo-3b2ba.firebaseapp.com",
    projectId: "fulbo-3b2ba",
    storageBucket: "fulbo-3b2ba.firebasestorage.app",
    messagingSenderId: "6505043622",
    appId: "1:6505043622:web:654759f7457e97424d0667",
    measurementId: "G-EDBDS8WJ96"
};

const app  = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db   = getFirestore(app);

// ── AUTH ──────────────────────────────────────────────────────────────────────

// Registrar nuevo usuario
export const registrar = async (email, password, nombre) => {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    await updateProfile(cred.user, { displayName: nombre });

    // Crear perfil en Firestore
    await setDoc(doc(db, 'usuarios', cred.user.uid), {
        nombre,
        email,
        plan: 'free',
        equipoFavorito: null,
        creadoEn: new Date().toISOString()
    });

    return cred.user;
};

// Iniciar sesión
export const login = async (email, password) => {
    const cred = await signInWithEmailAndPassword(auth, email, password);
    return cred.user;
};

// Cerrar sesión
export const logout = async () => {
    await signOut(auth);
    window.location.hash = '#/login';
};

// Recuperar contraseña
export const recuperarPassword = async (email) => {
    await sendPasswordResetEmail(auth, email);
};

// Observer de estado de auth
export const onAuth = (callback) => {
    return onAuthStateChanged(auth, callback);
};

// Usuario actual
export const usuarioActual = () => auth.currentUser;

// ── PERFIL ────────────────────────────────────────────────────────────────────

// Obtener perfil completo desde Firestore
export const getPerfil = async (uid) => {
    const snap = await getDoc(doc(db, 'usuarios', uid));
    return snap.exists() ? snap.data() : null;
};

// Actualizar perfil
export const updatePerfil = async (uid, datos) => {
    await updateDoc(doc(db, 'usuarios', uid), datos);
};

// ── PLANES ────────────────────────────────────────────────────────────────────
export const PLANES = {
    free: {
        nombre: 'Free',
        precio: 'Gratis',
        color: '#666',
        features: [
            { texto: 'Tabla de grupos Mundial 2026', ok: true },
            { texto: 'Partidos del día', ok: true },
            { texto: 'Noticias básicas', ok: true },
            { texto: 'Estadísticas del partido', ok: false },
            { texto: 'Alineaciones tácticas', ok: false },
            { texto: 'Goleadores del torneo', ok: false },
        ]
    },
    premium: {
        nombre: 'Premium',
        precio: '$4.99/mes',
        color: '#ffd700',
        features: [
            { texto: 'Tabla de grupos Mundial 2026', ok: true },
            { texto: 'Partidos del día', ok: true },
            { texto: 'Noticias completas + traducidas', ok: true },
            { texto: 'Estadísticas del partido', ok: true },
            { texto: 'Alineaciones tácticas', ok: true },
            { texto: 'Goleadores del torneo', ok: true },
        ]
    }
};

export { auth, db };
