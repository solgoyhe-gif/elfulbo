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
        // Add-on de IA para este plan. Precio en ARS (≈US$5 a ~$1.400/US$).
        ia: { precio: '$6.999', periodo: '/mes', prueba: '3 días gratis', variant: 'popular_ia_mensual' },
        descripcion: 'La cancha siempre abierta. Todo el fútbol argentino y el Mundial, sin pagar nada.',
        features: [
            { texto: 'Todo el fútbol argentino (1ª, ascenso y copas)', ok: true  },
            { texto: 'Mundial 2026 y partidos del día',    ok: true  },
            { texto: 'Estadísticas y alineaciones tácticas',ok: true  },
            { texto: 'Otros deportes: tabla de la liga principal', ok: true  },
            { texto: 'Ligas y copas del resto del mundo',  ok: false },
            { texto: 'Todos los deportes completos',       ok: false },
            { texto: 'Análisis IA pre-partido',            ok: false },
        ]
    },
    pro: {
        nombre: 'Platea',
        precio: '$6.499',
        precioAnual: '$73.999',
        color: '#6C5CE7',
        emoji: '🎟️',
        recomendado: true,
        elegidoPct: '68%',
        // Add-on de IA: ≈US$2 (60% OFF respecto de sumarla en Popular).
        ia: { precio: '$2.799', periodo: '/mes', prueba: '7 días de prueba', descuento: '-60%', variant: 'platea_ia_mensual' },
        descripcion: 'Todas las ligas y copas de fútbol del mundo, más todas las competencias de cada deporte. Viví el fútbol desde la Platea.',
        features: [
            { texto: 'Todo lo de Popular',                 ok: true  },
            { texto: 'Ligas y copas del mundo (tabla y partidos)', ok: true  },
            { texto: 'Otros deportes: todas las competencias', ok: true  },
            { texto: 'Noticias traducidas',                ok: true  },
            { texto: 'Plantillas y fichas de jugador del mundo', ok: false },
            { texto: 'Otros deportes con detalle completo',ok: false },
            { texto: 'Análisis IA pre-partido',            ok: false },
        ]
    },
    promax: {
        nombre: 'Palco',
        precio: '$14.999',
        precioAnual: '$145.999',
        color: '#F59E0B',
        emoji: '👑',
        ia: { incluida: true },
        descripcion: 'Todo lo de Platea más el Análisis IA pre-partido, el detalle completo de cada deporte y las notificaciones de gol en vivo. La experiencia definitiva.',
        features: [
            { texto: 'Todo lo de Platea',                  ok: true  },
            { texto: 'Análisis IA pre-partido',            ok: true  },
            { texto: 'Plantillas y fichas de jugador de todo el mundo', ok: true  },
            { texto: 'Otros deportes con detalle completo',ok: true  },
            { texto: 'Notificaciones de gol en vivo',      ok: true  },
            { texto: 'Historial extendido',                ok: true  },
            { texto: 'Sin publicidad',                     ok: true  },
        ]
    }
};
