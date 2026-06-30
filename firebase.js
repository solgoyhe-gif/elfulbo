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
        nombre: 'Popular',
        precio: 'Gratis',
        precioAnual: null,
        color: '#888',
        emoji: '⚽',
        descripcion: 'La cancha siempre abierta. Seguí el Mundial, los partidos del día y tu liga favorita sin pagar nada.',
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
        nombre: 'Platea',
        precio: '$4.99',
        precioAnual: '$39.99',
        color: '#6C5CE7',
        emoji: '🎟️',
        descripcion: 'Todas las ligas de fútbol, estadísticas completas, alineaciones tácticas y noticias traducidas. Viví el fútbol desde la Platea.',
        features: [
            { texto: 'Todo lo de Popular',                 ok: true  },
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
        nombre: 'Palco',
        precio: '$14.99',
        precioAnual: '$119.99',
        color: '#F59E0B',
        emoji: '👑',
        descripcion: 'Acceso completo a todas las ligas, deportes y estadísticas. Notificaciones en tiempo real e historial extendido. La experiencia definitiva.',
        features: [
            { texto: 'Todo lo de Platea',                  ok: true  },
            { texto: 'Todos los deportes',                 ok: true  },
            { texto: 'Notificaciones en vivo',             ok: true  },
            { texto: 'Historial extendido',                ok: true  },
            { texto: 'Acceso anticipado a features',       ok: true  },
            { texto: 'Sin publicidad',                     ok: true  },
        ]
    }
};
