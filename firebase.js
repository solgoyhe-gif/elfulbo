// firebase.js — Sin módulos ES, compatible con scripts normales
const _firebaseConfig = {
    apiKey: "AIzaSyAsk59PCfgGBSkev0wZzlstFdMpcgImoyE",
    authDomain: "fulbo-3b2ba.firebaseapp.com",
    projectId: "fulbo-3b2ba",
    storageBucket: "fulbo-3b2ba.firebasestorage.app",
    messagingSenderId: "6505043622",
    appId: "1:6505043622:web:654759f7457e97424d0667"
};

// Firebase se carga via CDN en index.html como módulos
// Este archivo solo define la config y los PLANES globales
window.FIREBASE_CONFIG = _firebaseConfig;

window.PLANES = {
    free: {
        nombre: 'Free',
        precio: 'Gratis',
        precioAnual: null,
        color: '#888',
        emoji: '⚽',
        descripcion: 'Para el que quiere seguir el Mundial sin complicarse.',
        features: [
            { texto: 'Tabla de grupos Mundial 2026',       ok: true  },
            { texto: 'Partidos del día',                   ok: true  },
            { texto: 'Noticias básicas',                   ok: true  },
            { texto: '1 liga a elección',                  ok: true  },
            { texto: 'Todas las ligas de fútbol',          ok: false },
            { texto: 'Estadísticas y alineaciones',        ok: false },
            { texto: 'Noticias traducidas',                ok: false },
            { texto: 'Todos los deportes',                 ok: false },
        ]
    },
    pro: {
        nombre: 'Pro',
        precio: '$4.99',
        precioAnual: '$39.99',
        color: '#39ff14',
        emoji: '🔥',
        descripcion: 'Para el futbolero de verdad. Todas las ligas y stats completas.',
        features: [
            { texto: 'Todo lo de Free',                    ok: true  },
            { texto: 'Todas las ligas de fútbol',          ok: true  },
            { texto: 'Estadísticas del partido',           ok: true  },
            { texto: 'Alineaciones tácticas',              ok: true  },
            { texto: 'Noticias traducidas',                ok: true  },
            { texto: 'Equipo favorito',                    ok: true  },
            { texto: 'Todos los deportes',                 ok: false },
            { texto: 'Notificaciones en vivo',             ok: false },
        ]
    },
    promax: {
        nombre: 'Pro Max',
        precio: '$14.99',
        precioAnual: '$119.99',
        color: '#ffd700',
        emoji: '👑',
        descripcion: 'Para el fanático total. Todo lo de Pro más todos los deportes y notificaciones en vivo.',
        features: [
            { texto: 'Todo lo de Pro',                     ok: true  },
            { texto: 'Todos los deportes',                 ok: true  },
            { texto: 'Notificaciones en vivo',             ok: true  },
            { texto: 'Historial extendido',                ok: true  },
            { texto: 'Acceso anticipado a features',       ok: true  },
            { texto: 'Sin publicidad',                     ok: true  },
        ]
    }
};
