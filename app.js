// app.js - Enrutador Principal e Interfaz Dinámica SPA
// ── ESTRATEGIA DE INTEGRACIÓN COMPLETA ────────────────────────────────────
//   · Conserva todos los módulos originales (H2H, Info, Home, Ligas).
//   · Tablas de Posiciones por Grupos para el Mundial 2026.
//   · Conexión inquebrantable a ESPN Roster (/all/teams/).
//   · Inyección de Estadísticas Verosímiles en Jugadores Reales (Si la API devuelve 0).
//   · Pizarra Táctica con círculos (número + nombre) y solo el equipo propio.
//
// ── SISTEMA DE SIGLAS ESPN (verificado con datos reales) ──────────────────
//   Cada sigla tiene { fila, orden } donde:
//     fila  → 0=portero, 1=defensa, 2=mediocampo, 3=ataque
//     orden → posición relativa dentro de la fila (0=izquierda … N=derecha)
//   La X final se calcula distribuyendo equitativamente los jugadores de cada
//   fila según cuántos haya, usando el orden como criterio de sort.
//   Esto permite que CM-L sea "centro-izq en un 4-4-2" pero "centro en un
//   4-3-3" sin hardcodear coordenadas.
// ─────────────────────────────────────────────────────────────────────────

const App = (() => {
    const appContainer = document.getElementById('app');

    // ══════════════════════════════════════════════════════════════════════════
    // SISTEMA TÁCTICO — usa formationPlace + formación para calcular filas
    // ══════════════════════════════════════════════════════════════════════════

    // Parsea una formación "4-3-3" → [1, 4, 3, 3] (GK + líneas)
    const _parsearFormacion = (formStr = '') => {
        const nums = formStr.split('-').map(Number).filter(n => !isNaN(n) && n > 0);
        if (nums.length >= 2 && nums.reduce((a,b) => a+b, 0) <= 10) {
            return [1, ...nums];
        }
        return [1, 4, 3, 3];
    };

    // Orden X por sigla de posición ESPN (izquierda=0 → derecha=10)
    const _ordenPosicion = (abbr = '') => {
        const a = abbr.toUpperCase().trim();
        const mapa = {
            // Portero
            'G': 5, 'GK': 5,
            // Defensas
            'LB': 0, 'LWB': 0,
            'CD-L': 1, 'CB-L': 1,
            'CB': 5, 'CD': 5,
            'CD-R': 9, 'CB-R': 9,
            'RB': 10, 'RWB': 10,
            // Mediocampo — ESPN usa LM/RM para volantes centrales izq/der
            'LM': 2,   // volante por izquierda (ej: Koné)
            'CDM': 4, 'DM': 4,
            'CM': 5, 'M': 5,
            'CAM': 5,
            'RM': 8,   // volante por derecha (ej: Tchouaméni)
            // Extremos y mediapuntas
            'AM-L': 1, // extremo izquierdo (ej: Doué)
            'AM': 5,   // mediapunta centro (ej: Olise)
            'AM-R': 9, // extremo derecho (ej: Dembélé)
            'CM-L': 2, 'CM-R': 8,
            // Delanteros
            'LF': 0, 'LW': 0, 'CF-L': 2, 'ST-L': 2,
            'ST': 5, 'CF': 5, 'F': 5, 'FW': 5,
            'CF-R': 8, 'ST-R': 8,
            'RW': 10, 'RF': 10,
        };
        if (mapa[a] !== undefined) return mapa[a];
        if (a.startsWith('L')) return 0;
        if (a.startsWith('R')) return 10;
        return 5;
    };

    // Determina la fila táctica (0=GK, 1=DEF, 2=MED, 3=ATQ/EXT, 4=DEL) por sigla ESPN
    const _filaDesigla = (abbr = '') => {
        const a = abbr.toUpperCase().trim();
        // Portero
        if (a === 'G' || a === 'GK') return 0;
        // Categorías genéricas de una letra (ESPN a veces no manda sigla detallada)
        if (a === 'D') return 1;
        if (a === 'M') return 2;
        if (a === 'F') return 4;
        // Defensas
        if (['LB','LWB','RB','RWB','CB','CB-L','CB-R','CD','CD-L','CD-R','SW'].includes(a)) return 1;
        if (a.startsWith('CB') || a.startsWith('CD')) return 1;
        // Volantes defensivos / mediocampo base (incluye variantes L/R: RCM, LDM, etc.)
        if (['CDM','DM','CM','LM','RM','CM-L','CM-R','RCM','LCM','RDM','LDM'].includes(a)) return 2;
        // Mediapuntas y extremos (incluye variantes L/R: RAM, LAM)
        if (['CAM','AM','AM-L','AM-R','LW','RW','LF','RF','WF','RAM','LAM'].includes(a)) return 3;
        if (a.startsWith('AM') || a.startsWith('LW') || a.startsWith('RW')) return 3;
        // Delanteros
        if (['ST','CF','FW','ST-L','ST-R','CF-L','CF-R','SS'].includes(a)) return 4;
        if (a.startsWith('ST') || a.startsWith('CF') || a === 'FW') return 4;
        // Sin match: por defecto al medio (más seguro que asumir defensa por prefijo L/R,
        // que terminaba metiendo volantes tipo "RCM" en la línea de defensores)
        return 2;
    };

    // Puntaje de profundidad por sigla (0=arco, 10=punta pura).
    // Usado para ORDENAR jugadores de atrás hacia adelante dentro de la formación.
    const _profundidadPosicion = (abbr = '') => {
        const a = abbr.toUpperCase().trim();
        const mapa = {
            'G':0,'GK':0,
            'D':2,'LB':2,'LWB':2.5,'RB':2,'RWB':2.5,'CB':1.5,'CB-L':1.5,'CB-R':1.5,'CD':1.5,'CD-L':1.5,'CD-R':1.5,'SW':1.5,
            'CDM':4,'DM':4,'RDM':4,'LDM':4,
            'M':5,'CM':5,'LM':5,'RM':5,'CM-L':5,'CM-R':5,'RCM':5,'LCM':5,
            'CAM':7,'AM':7,'AM-L':7,'AM-R':7,'RAM':7,'LAM':7,
            'LW':8,'RW':8,'LF':8,'RF':8,'WF':8,'SS':8,
            'F':9,'ST':9,'CF':9,'FW':9,'ST-L':9,'ST-R':9,'CF-L':9,'CF-R':9,
        };
        if (mapa[a] !== undefined) return mapa[a];
        if (a.startsWith('CB') || a.startsWith('CD')) return 1.5;
        if (a.startsWith('AM')) return 7;
        if (a.startsWith('ST') || a.startsWith('CF')) return 9;
        return 5; // default al medio
    };

    // Calcula posiciones X/Y.
    // Paso 1: agrupar por sigla de posición (funciona bien cuando ESPN manda siglas
    //         detalladas, como en Suiza 4-2-3-1).
    // Paso 2: si hay formación válida y las cantidades no coinciden con el agrupamiento
    //         por sigla, redistribuir — sacando jugadores de filas sobrepobladas y
    //         promoviéndolos a la siguiente (por profundidad). Esto arregla casos como
    //         Colombia 4-4-1-1 donde Rodríguez tiene sigla genérica "M" igual que los
    //         otros 4 mediocampistas y termina 4-5-1 en vez de 4-4-1-1.
    const _calcularPosicionesTacticas = (titulares, svgW = 400, svgH = 560, formacionStr = '') => {
        // ── Paso 1: agrupar por sigla ──
        const filas = {0:[], 1:[], 2:[], 3:[], 4:[]};
        titulares.forEach(j => {
            const fila = _filaDesigla(j.position?.abbreviation ?? '');
            filas[fila].push(j);
        });

        // ── Paso 2: ajustar con formación si existe ──
        const numsFormacion = (formacionStr || '').split('-').map(n => parseInt(n, 10)).filter(n => !isNaN(n) && n > 0);
        const sumaFormacion = numsFormacion.reduce((a, b) => a + b, 0);

        if (numsFormacion.length >= 2 && sumaFormacion === titulares.length - 1) {
            // Armar el target: fila 0 = arquero (1), fila 1..N = números de la formación
            const target = { 0: 1 };
            numsFormacion.forEach((n, i) => { target[i + 1] = n; });

            // Compactar filas vacías intermedias para que coincidan con la cantidad
            // de líneas de la formación (ej: si sigla dio filas 0,1,2,4 pero formación
            // tiene 4 líneas, las reindexamos a 0,1,2,3,4)
            const filasConJugadores = [0, ...([1,2,3,4].filter(f => filas[f].length > 0))];
            if (filasConJugadores.length - 1 < numsFormacion.length) {
                // Hay menos filas ocupadas que líneas en la formación — hay que partir alguna
                // Redistribuimos: juntamos todos los de campo, ordenamos por profundidad,
                // y cortamos según la formación
                const arqueros = filas[0];
                const campo = [1,2,3,4].flatMap(f => filas[f]);
                campo.sort((a, b) =>
                    _profundidadPosicion(a.position?.abbreviation ?? '') -
                    _profundidadPosicion(b.position?.abbreviation ?? '')
                );
                // Limpiar filas
                for (let f = 0; f <= 4; f++) filas[f] = [];
                filas[0] = arqueros;
                let cursor = 0;
                numsFormacion.forEach((cant, idx) => {
                    filas[idx + 1] = campo.slice(cursor, cursor + cant);
                    cursor += cant;
                });
            } else {
                // Misma cantidad de filas o más — ajustar las que sobran/faltan
                for (let f = 1; f <= numsFormacion.length; f++) {
                    const esperado = target[f] ?? 0;
                    while (filas[f].length > esperado && f + 1 <= numsFormacion.length) {
                        // Sobra gente en esta fila: promover al más "adelantado" a la siguiente
                        filas[f].sort((a, b) =>
                            _profundidadPosicion(a.position?.abbreviation ?? '') -
                            _profundidadPosicion(b.position?.abbreviation ?? '')
                        );
                        const promovido = filas[f].pop(); // el de mayor profundidad
                        filas[f + 1] = filas[f + 1] ?? [];
                        filas[f + 1].unshift(promovido);
                    }
                }
            }
        }

        // Ordenar dentro de cada fila de izquierda a derecha
        Object.values(filas).forEach(grupo => {
            grupo.sort((a, b) =>
                _ordenPosicion(a.position?.abbreviation ?? '') -
                _ordenPosicion(b.position?.abbreviation ?? '')
            );
        });

        // Filas ocupadas de abajo (GK) hacia arriba (DEL)
        const indicesFilas   = Object.keys(filas).map(Number).sort((a, b) => a - b);
        const filasOcupadas  = indicesFilas.filter(f => filas[f].length > 0);

        const yGK  = svgH * 0.90;
        const yFWD = svgH * 0.12;
        const totalLineas = filasOcupadas.length;
        const coordsMap = new Map();

        filasOcupadas.forEach((fila, idx) => {
            const grupo = filas[fila];
            const count = grupo.length;
            const t = totalLineas === 1 ? 0 : idx / (totalLineas - 1);
            const y = Math.round(yGK - t * (yGK - yFWD));

            const spread = count === 1 ? 0 :
                           count === 2 ? 0.25 :
                           count === 3 ? 0.35 :
                           count === 4 ? 0.42 : 0.45;
            const xMin = svgW * (0.5 - spread);
            const xMax = svgW * (0.5 + spread);

            grupo.forEach((j, i) => {
                const x = count === 1 ? svgW / 2 : Math.round(xMin + (i / (count - 1)) * (xMax - xMin));
                coordsMap.set(j.formationPlace, { x, y, n: count });
            });
        });

        return coordsMap;
    };

    // ── SIDEBAR ───────────────────────────────────────────────────────────────
    const _sidebarAbierta = () => localStorage.getItem('sidebar_open') !== 'false';
    const _sidebarToggle  = () => {
        const abierta = _sidebarAbierta();
        localStorage.setItem('sidebar_open', String(!abierta));
        const sb  = document.getElementById('app-sidebar');
        const wp  = document.getElementById('sidebar-wrapper');
        if (!sb || !wp) return;
        sb.classList.toggle('closed', abierta);
        wp.classList.toggle('sidebar-closed', abierta);
        const btn = document.getElementById('sidebar-toggle-btn');
        if (btn) btn.textContent = abierta ? '›' : '‹';
    };

    const renderNavbar = (activeHash) => {
        if (!window.FirebaseAuth?.isAuthenticated()) return '';

        const isLigasActive = activeHash === '#/ligas'
            || activeHash.includes('#/liga?id=')
            || activeHash.includes('#/equipo?id=')
            || activeHash.includes('#/grupo?id=');

        const plan    = window.FirebaseAuth?.getPlan() ?? 'free';
        const nombre  = window.FirebaseAuth?.getNombre()?.split(' ')[0] ?? '';
        const abierta = _sidebarAbierta();

        const planMeta = {
            free:   { color: '#888',    bg: 'rgba(136,136,136,0.2)', emoji: '⚽', label: 'POPULAR' },
            pro:    { color: '#3D6FFF', bg: 'rgba(61,111,255,0.2)',   emoji: '🎟️', label: 'PLATEA'  },
            promax: { color: '#ffd700', bg: 'rgba(255,215,0,0.2)',   emoji: '👑', label: 'PALCO'   },
        };
        const pm = planMeta[plan] ?? planMeta.free;

        const links = [
            { href: '#/home',   icon: '🏠', label: 'Inicio',  active: activeHash === '#/home' },
            { href: '#/h2h',    icon: '⚔️', label: 'H2H',     active: activeHash === '#/h2h' },
            { href: '#/info',   icon: '📰', label: 'Info',    active: activeHash === '#/info' },
            { href: '#/awards', icon: '🏅', label: 'Awards',  active: activeHash === '#/awards' },
            { href: '#/perfil', icon: '👤', label: 'Perfil',  active: activeHash === '#/perfil' },
        ];

        // Deportes con sub-ligas desplegables
        const isAdmin = window.location.hash.includes('admin=1');
        const futbolGrupos = Object.entries(LIGAS)
            .filter(([, g]) => !g.hidden || isAdmin)
            .map(([gid, g]) => ({
                nombre: g.nombre,
                ligas: g.competiciones.map(c => ({
                    id: c.id, nombre: c.nombre, flag: c.flag,
                    active: activeHash.includes(`#/liga?id=${c.id}`)
                }))
            }));

        const otherSportsItems = [
            { id: 'f1',        nombre: 'Fórmula 1',          emoji: '🏎️', href: '#/other-sports?deporte=f1' },
            { id: 'nba',       nombre: 'NBA',                emoji: '🏀', href: '#/other-sports?deporte=nba' },
            { id: 'nfl',       nombre: 'NFL',                emoji: '🏈', href: '#/other-sports?deporte=nfl' },
            { id: 'tennis',    nombre: 'Tenis',              emoji: '🎾', href: '#/other-sports?deporte=tennis' },
            { id: 'golf',      nombre: 'Golf',               emoji: '⛳', href: '#/other-sports?deporte=golf' },
            { id: 'hockey',    nombre: 'Hockey sobre Hielo', emoji: '🏒', href: '#/other-sports?deporte=hockey' },
            { id: 'mma',       nombre: 'MMA',                emoji: '🥊', href: '#/other-sports?deporte=mma' },
            { id: 'rugby',     nombre: 'Rugby',              emoji: '🏉', href: '#/other-sports?deporte=rugby' },
            { id: 'patin',     nombre: 'Patín sobre Hielo',  emoji: '⛸️', href: '#/other-sports?deporte=patin' },
        ];

        // Estado desplegado (guardado en memoria para que sobreviva re-renders)
        if (!window._sidebarAccordion) window._sidebarAccordion = {};
        const acc = window._sidebarAccordion;
        // Auto-abrir solo la primera vez que se entra a esa sección
        // (si el usuario ya lo cerró manualmente, no lo volvemos a abrir)
        if (isLigasActive && acc.futbol === undefined) acc.futbol = true;
        if (activeHash.includes('#/other-sports') && acc.other === undefined) acc.other = true;

        const _accordionBtn = (key, icon, label, isOpen) => `
            <button class="sidebar-link sidebar-accordion-btn ${isOpen ? 'open' : ''}"
                onclick="window._sidebarAccordion['${key}'] = !window._sidebarAccordion['${key}']; window._refreshSidebar();"
                style="width:100%; display:flex; align-items:center; justify-content:space-between;">
                <span style="display:flex; align-items:center; gap:0;">
                    <span class="sidebar-icon">${icon}</span>
                    <span class="sidebar-label">${label}</span>
                </span>
                <span class="sidebar-label sidebar-chevron" style="font-size:0.6rem; opacity:0.5; transition:transform 0.2s; transform:rotate(${isOpen ? '90deg' : '0deg'});">▶</span>
            </button>`;

        const futbolSublinks = acc.futbol ? futbolGrupos.map(g => `
            <div class="sidebar-subgroup">
                <div class="sidebar-sublabel">${g.nombre}</div>
                ${g.ligas.map(l => `
                    <a href="#/liga?id=${l.id}" class="sidebar-link sidebar-sublink ${l.active ? 'active' : ''}">
                        <span class="sidebar-icon" style="font-size:0.85rem;">${l.flag}</span>
                        <span class="sidebar-label">${l.nombre}</span>
                    </a>`).join('')}
            </div>`).join('') : '';

        const otherSublinks = acc.other ? otherSportsItems.map(s => `
            <a href="${s.href}" class="sidebar-link sidebar-sublink ${activeHash.includes(s.id) ? 'active' : ''}">
                <span class="sidebar-icon" style="font-size:0.85rem;">${s.emoji}</span>
                <span class="sidebar-label">${s.nombre}</span>
            </a>`).join('') : '';

        return `
            <aside id="app-sidebar" class="sidebar ${abierta ? '' : 'closed'}">
                <div class="sidebar-header">
                    <div class="sidebar-logo">
                        <div class="sidebar-logo-icon">W</div>
                        <div class="sidebar-logo-text">
                            <div style="font-family:var(--font-heading);font-size:.95rem;font-weight:700;color:#fff;letter-spacing:-.01em;">Whistle</div>
                            <div style="font-family:var(--font-display);font-size:.55rem;letter-spacing:.16em;color:var(--muted);">SPORTS LIVE</div>
                        </div>
                    </div>
                    <button id="sidebar-toggle-btn" class="sidebar-toggle"
                        onclick="window._sidebarToggle()" title="Expandir / retraer">
                        ${abierta ? '‹' : '›'}
                    </button>
                </div>
                <nav class="sidebar-nav">
                    <a href="#/home" class="sidebar-link ${activeHash === '#/home' ? 'active' : ''}">
                        <span class="sidebar-icon">🏠</span>
                        <span class="sidebar-label">Inicio</span>
                    </a>

                    ${_accordionBtn('futbol', '⚽', 'Fútbol', acc.futbol)}
                    <div class="sidebar-accordion-body ${acc.futbol ? 'open' : ''}">
                        ${futbolSublinks}
                    </div>

                    ${_accordionBtn('other', '🎽', 'Other Sports', acc.other)}
                    <div class="sidebar-accordion-body ${acc.other ? 'open' : ''}">
                        ${otherSublinks}
                    </div>

                    ${links.filter(l => l.href !== '#/home').map(l => `
                        <a href="${l.href}" class="sidebar-link ${l.active ? 'active' : ''}">
                            <span class="sidebar-icon">${l.icon}</span>
                            <span class="sidebar-label">${l.label}</span>
                        </a>`).join('')}
                    <div class="sidebar-divider"></div>
                </nav>
                <div class="sidebar-footer">
                    <div class="sidebar-plan">
                        <span class="sidebar-plan-badge"
                            style="background:rgba(255,255,255,0.22); color:#fff;">
                            ${pm.emoji} ${pm.label}
                        </span>
                        <span class="sidebar-plan-name">${nombre || 'Mi cuenta'}</span>
                    </div>
                    <button class="sidebar-link" onclick="window.FirebaseAuth?.logout()"
                        style="color:var(--red-live);">
                        <span class="sidebar-icon">🚪</span>
                        <span class="sidebar-label">Salir</span>
                    </button>
                </div>
            </aside>
            <div id="sidebar-wrapper" class="sidebar-page-wrapper ${abierta ? '' : 'sidebar-closed'}">
                ${_renderTicker()}
        `;
    };

    const _closeSidebarWrapper = () => window.FirebaseAuth?.isAuthenticated() ? '</div>' : '';
    window._sidebarToggle = _sidebarToggle;
    window._refreshSidebar = () => {
        const sb = document.getElementById('app-sidebar');
        if (!sb) return;
        const hash = window.location.hash || '#/home';
        const nuevoHTML = renderNavbar(hash);
        // Extraer solo el <aside> del HTML generado y reemplazarlo
        const tmp = document.createElement('div');
        tmp.innerHTML = nuevoHTML;
        const nuevoAside = tmp.querySelector('aside');
        if (nuevoAside) sb.replaceWith(nuevoAside);
    };

    // ── TICKER DE SCORES ─────────────────────────────────────────────────────
    // Fuentes de datos: fútbol (ligas principales) + otros deportes
    const TICKER_SOURCES = [
        // Fútbol
        ...['fifa.world','eng.1','esp.1','ger.1','ita.1','fra.1','uefa.champions','conmebol.libertadores','arg.1']
            .map(slug => ({ sport: 'soccer', slug, emoji: '⚽', color: '#2FD98B', label: slug.split('.')[0].toUpperCase() })),
        // Otros deportes
        { sport: 'basketball/nba',  slug: null, emoji: '🏀', color: '#FF6B35', label: 'NBA' },
        { sport: 'hockey/nhl',      slug: null, emoji: '🏒', color: '#6CABDD', label: 'NHL' },
        { sport: 'baseball/mlb',    slug: null, emoji: '⚾', color: '#E63946', label: 'MLB' },
        { sport: 'football/nfl',    slug: null, emoji: '🏈', color: '#8B5CF6', label: 'NFL' },
        { sport: 'mma/ufc',         slug: null, emoji: '🥊', color: '#FF4D6D', label: 'UFC' },
    ];

    const _renderTicker = () => `<div id="ticker-bar" class="ticker-bar"><div class="ticker-content"><span class="ticker-loading">🏟️ Cargando eventos del día...</span></div></div>`;

    const _initTicker = async () => {
        const bar = document.getElementById('ticker-bar');
        if (!bar) return;
        const content = bar.querySelector('.ticker-content');
        if (!content) return;
        const CF_WORKER = 'https://whistle.solgoyhe.workers.dev';
        const hoy = new Date().toISOString().slice(0,10).replace(/-/g,'');
        // No tocar el contenido actual mientras carga — solo lo reemplazamos cuando tenemos datos nuevos

        try {
            const results = await Promise.allSettled(
                TICKER_SOURCES.map(src => {
                    const url = src.slug
                        ? `https://site.api.espn.com/apis/site/v2/sports/soccer/${src.slug}/scoreboard?dates=${hoy}`
                        : `https://site.api.espn.com/apis/site/v2/sports/${src.sport}/scoreboard?dates=${hoy}`;
                    return fetch(`${CF_WORKER}/?url=${encodeURIComponent(url)}`)
                        .then(r => r.ok ? r.json() : {})
                        .then(d => (d.events ?? []).map(ev => {
                            const comp = ev.competitions?.[0];
                            const home = comp?.competitors?.find(c => c.homeAway === 'home');
                            const away = comp?.competitors?.find(c => c.homeAway === 'away');
                            const estado = comp?.status?.type?.state ?? 'pre';
                            const hora = new Date(ev.date).toLocaleTimeString('es-AR', {hour:'2-digit', minute:'2-digit'});
                            return { home, away, estado, hora, id: ev.id, emoji: src.emoji, color: src.color, label: src.label, sport: src.sport };
                        }));
                })
            );

            const partidos = results
                .filter(r => r.status === 'fulfilled')
                .flatMap(r => r.value)
                .filter(p => p.home && p.away);

            if (!partidos.length) {
                content.innerHTML = '<span class="ticker-item" style="opacity:0.5;">🏟️ No hay eventos programados para hoy</span>';
                return;
            }

            // Ordenar: en vivo primero, después finalizados, después próximos
            const orden = { 'in': 0, 'post': 1, 'pre': 2 };
            partidos.sort((a, b) => (orden[a.estado] ?? 3) - (orden[b.estado] ?? 3));

            const items = partidos.map(p => {
                const hName = p.home.team?.abbreviation ?? p.home.team?.shortDisplayName ?? '???';
                const aName = p.away.team?.abbreviation ?? p.away.team?.shortDisplayName ?? '???';
                const hScore = p.home.score ?? '';
                const aScore = p.away.score ?? '';
                const hLogo = p.home.team?.logo ? `<img src="${p.home.team.logo}" alt="" class="ticker-logo">` : '';
                const aLogo = p.away.team?.logo ? `<img src="${p.away.team.logo}" alt="" class="ticker-logo">` : '';
                const badge = `<span class="ticker-badge" style="background:${p.color}20; color:${p.color};">${p.emoji} ${p.label}</span>`;

                if (p.estado === 'in') {
                    return `<a href="#/partido?id=${p.id}" class="ticker-item ticker-live">
                        ${badge}
                        <span class="ticker-live-dot"></span>
                        ${hLogo} <span class="ticker-team">${hName}</span>
                        <span class="ticker-score" style="color:${p.color};">${hScore} - ${aScore}</span>
                        <span class="ticker-team">${aName}</span> ${aLogo}
                    </a>`;
                } else if (p.estado === 'post') {
                    return `<a href="#/partido?id=${p.id}" class="ticker-item ticker-post">
                        ${badge}
                        ${hLogo} <span class="ticker-team">${hName}</span>
                        <span class="ticker-score">${hScore} - ${aScore}</span>
                        <span class="ticker-team">${aName}</span> ${aLogo}
                        <span class="ticker-ft">FT</span>
                    </a>`;
                } else {
                    return `<a href="#/partido?id=${p.id}" class="ticker-item ticker-pre">
                        ${badge}
                        ${hLogo} <span class="ticker-team">${hName}</span>
                        <span class="ticker-vs">vs</span>
                        <span class="ticker-team">${aName}</span> ${aLogo}
                        <span class="ticker-hora">${p.hora}</span>
                    </a>`;
                }
            }).join('<span class="ticker-sep"></span>');

            // Duplicar para loop continuo
            content.innerHTML = items + '<span class="ticker-sep"></span>' + items;

            // Calcular duración de la animación según el ancho
            requestAnimationFrame(() => {
                const w = content.scrollWidth / 2;
                const speed = 50; // px por segundo (más lento para leer mejor)
                content.style.animationDuration = `${w / speed}s`;
                content.classList.add('ticker-scroll');
            });
        } catch(err) {
            console.error('[Ticker]', err);
        }
    };

    // Refrescar ticker cada 2 minutos
    const _startTickerRefresh = () => {
        _initTicker();
        if (window._tickerInterval) clearInterval(window._tickerInterval);
        window._tickerInterval = setInterval(_initTicker, 120000);
    };

    // ── EFECTOS DE CARGA (SKELETONS) ──────────────────────────────────────────
    const _skeletonTabla = () => {
        let rows = '';
        for (let i = 0; i < 10; i++) {
            rows += `
                <tr>
                    <td><div class="skel-cell" style="width: 20px;"></div></td>
                    <td><div class="skel-cell" style="width: 140px;"></div></td>
                    <td><div class="skel-cell" style="width: 25px;"></div></td>
                    <td><div class="skel-cell" style="width: 25px;"></div></td>
                    <td><div class="skel-cell" style="width: 25px;"></div></td>
                    <td><div class="skel-cell" style="width: 25px;"></div></td>
                    <td><div class="skel-cell" style="width: 30px;"></div></td>
                </tr>
            `;
        }
        return `
            <table class="standings-table">
                <thead>
                    <tr>
                        <th style="width: 40px;">#</th>
                        <th>Equipo</th>
                        <th style="width: 45px;">PJ</th>
                        <th style="width: 45px;">PG</th>
                        <th style="width: 45px;">PE</th>
                        <th style="width: 45px;">PP</th>
                        <th style="width: 50px;">PTS</th>
                    </tr>
                </thead>
                <tbody>${rows}</tbody>
            </table>
        `;
    };

    const _skeletonPartidos = () => {
        let items = '';
        for (let i = 0; i < 4; i++) {
            items += `
                <div class="match-item" style="padding: 15px 0;">
                    <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                        <div class="skel-cell" style="width: 100px;"></div>
                        <div class="skel-cell" style="width: 20px;"></div>
                    </div>
                    <div style="display: flex; justify-content: space-between;">
                        <div class="skel-cell" style="width: 110px;"></div>
                        <div class="skel-cell" style="width: 20px;"></div>
                    </div>
                </div>
            `;
        }
        return `<div class="match-list">${items}</div>`;
    };

    // ── VISTAS PRINCIPALES ────────────────────────────────────────────────────
    // ── Competencias que sigue el usuario ────────────────────────────────────
    // El perfil guarda slugs de ESPN (eng.1, arg.1, uefa.champions…), elegidos en #/setup.
    // Dos quedaron mal grabados en cuentas viejas: 'uefa.cl' y 'uefa.el' dan HTTP 400.
    // Los corregimos al leer, así no hay que migrar Firestore.
    const SLUG_ARREGLOS = {
        'uefa.cl': 'uefa.champions',
        'uefa.el': 'uefa.europa',
    };
    const _normalizarSlug = (s) => SLUG_ARREGLOS[s] ?? s;

    // Torneos de selecciones que ya jugaron su edición. Pasada la fecha de cierre
    // no deben "copar" el home: grupos, partido destacado y goleadores quedarían
    // clavados en un torneo finalizado (el scoreboard sigue devolviendo la final).
    // Al terminar, se los saca de las competencias del usuario y el home cae en su
    // liga nacional, que es la que sigue activa. Solo hay que actualizar la fecha
    // cuando arranque la próxima edición.
    const TORNEOS_FIN = {
        'fifa.world': '2026-07-20',   // Mundial 2026: final 19-jul. Próxima edición: 2030.
        'uefa.euro':  '2024-07-15',   // Euro 2024 terminó. Próxima: 2028.
    };
    const _hoyISO = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' });
    const _torneoTerminado = (slug) => {
        const fin = TORNEOS_FIN[slug];
        return fin ? _hoyISO() >= fin : false;
    };

    // Etiqueta de día para un partido. La home lista los próximos 7 días, así que
    // mostrar solo la hora no alcanza: no se distingue el de hoy del del jueves.
    // Devuelve 'Hoy', 'Mañana' o 'jue 23/7'.
    const _etiquetaDia = (fecha) => {
        const TZ = 'America/Argentina/Buenos_Aires';
        const f  = (fecha instanceof Date) ? fecha : new Date(fecha ?? '');
        if (isNaN(f)) return '';
        const soloDia = (d) => d.toLocaleDateString('en-CA', { timeZone: TZ });
        const hoy     = new Date();
        const manana  = new Date(hoy.getTime() + 24 * 60 * 60 * 1000);
        const diaEv   = soloDia(f);
        if (diaEv === soloDia(hoy))    return 'Hoy';
        if (diaEv === soloDia(manana)) return 'Mañana';
        return f.toLocaleDateString('es-AR', { timeZone: TZ, weekday: 'short' })
             + ' ' + f.toLocaleDateString('es-AR', { timeZone: TZ, day: 'numeric', month: 'numeric' });
    };

    // Liga nacional por país (mismo mapeo que el wizard de #/setup, acá aplanado)
    // para poder elegir un fallback sensato cuando la única competencia del usuario
    // era un torneo que ya terminó.
    const LIGA_NACIONAL_POR_PAIS = {
        AR:'arg.1', ES:'esp.1', MX:'mex.1', CO:'col.1', CL:'chi.1', UY:'uru.1',
        PE:'per.1', BR:'bra.1', PY:'par.1', EC:'ecu.1', GB:'eng.1', DE:'ger.1',
        IT:'ita.1', FR:'fra.1', PT:'por.1', NL:'ned.1',
    };

    const _competenciasUsuario = () => {
        const p = window.FirebaseAuth?.getPerfil() ?? {};
        const elegidas = [p.ligaNacional, p.ligaInternacional]
            .filter(Boolean)
            .map(_normalizarSlug)
            .filter(slug => !_torneoTerminado(slug));   // sacar torneos ya finalizados
        if (elegidas.length) return [...new Set(elegidas)];
        // Sin competencias activas (perfil incompleto, o solo tenía el Mundial):
        // caemos en la liga nacional del país del usuario, o Liga Argentina por defecto.
        return [LIGA_NACIONAL_POR_PAIS[p.pais] ?? 'arg.1'];
    };

    const renderHome = async () => {
        const CF_WORKER  = 'https://whistle.solgoyhe.workers.dev';
        const perfil     = window.FirebaseAuth?.getPerfil() ?? {};
        const nombre     = window.FirebaseAuth?.getNombre()?.split(' ')[0] ?? '';
        const deportes   = perfil.deportes ?? [];
        const esProMax   = _esProMax();

        const DEPORTE_INFO = {
            basketball: {nombre:'Básquet',          emoji:'🏀', slug:'basketball/nba',          liga:'NBA'},
            tennis:     {nombre:'Tenis',             emoji:'🎾', slug:'tennis/atp',              liga:'ATP'},
            racing:     {nombre:'Fórmula 1',         emoji:'🏎️', slug:'racing/f1',               liga:'F1'},
            football:   {nombre:'Fútbol Americano',  emoji:'🏈', slug:'football/nfl',            liga:'NFL'},
            baseball:   {nombre:'Baseball',          emoji:'⚾', slug:'baseball/mlb',            liga:'MLB'},
            hockey:     {nombre:'Hockey sobre Hielo',emoji:'🏒', slug:'hockey/nhl',              liga:'NHL'},
            golf:       {nombre:'Golf',              emoji:'⛳', slug:'golf/pga',                liga:'PGA'},
            mma:        {nombre:'MMA',               emoji:'🥊', slug:'mma/ufc',                 liga:'UFC'},
            rugby:      {nombre:'Rugby',             emoji:'🏉', slug:'rugby/180659',            liga:'Rugby'},
        };

        // Render inicial con skeleton
        appContainer.innerHTML = `
            ${renderNavbar('#/home')}
            <main class="page-container fade-in home-page">

                <!-- Saludo -->
                <div class="home-head">
                    <div>
                        <h2 class="home-hola">${nombre ? 'Hola, ' + nombre : 'Bienvenido'} 👋</h2>
                        <p class="home-tagline">The sound of sport.</p>
                    </div>
                    <a href="#/ligas" style="font-family:var(--font-body);font-size:.78rem;font-weight:600;color:var(--blue);text-decoration:none;">Ver ligas →</a>
                </div>

                <div class="home-grid">
                  <div class="home-col">

                    <!-- Partido destacado -->
                    <div id="home-hero" class="hero-card">
                        <div class="skel-cell" style="width:110px;height:24px;border-radius:20px;"></div>
                        <div class="skel-cell" style="width:55%;height:46px;margin:22px auto;"></div>
                        <div class="skel-cell" style="width:35%;height:16px;margin:0 auto;"></div>
                    </div>

                    <!-- Cronología del partido destacado -->
                    <div id="home-crono" class="glass-panel" style="display:none;"></div>

                    <!-- Partidos del día -->
                    <div>
                        <div class="home-section-head">
                            <span class="home-section-label" id="home-liga-label">⚽ Fútbol</span>
                            <a href="#/ligas" class="subsection-link">Ver todas →</a>
                        </div>
                        <div class="glass-panel" style="gap:12px;">
                            <div class="tabs-row" id="home-tabs"></div>
                            <div id="home-lista">
                                <div style="display:flex;gap:8px;align-items:center;padding:6px 0;">
                                    <div style="width:18px;height:18px;border:2px solid var(--blue);border-right-color:transparent;border-radius:50%;animation:spin 1s linear infinite;"></div>
                                    <span style="color:var(--muted);font-size:.82rem;">Cargando partidos...</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Grupos del Mundial -->
                    <div id="home-grupos" style="display:none;"></div>

                    <!-- Alineaciones del partido destacado -->
                    <div id="home-alineaciones" class="glass-panel" style="display:none;"></div>

                    <!-- Noticias -->
                    <div id="home-noticias" style="display:none;"></div>

                    <!-- Deportes elegidos -->
                    <div id="home-otros-deportes">
                    ${deportes.length > 0 && esProMax ? deportes.map(d => {
                        const info = DEPORTE_INFO[d];
                        if (!info) return '';
                        return `
                            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;">
                                <span style="font-family:var(--font-display);font-size:.7rem;font-weight:700;text-transform:uppercase;letter-spacing:.1em;color:var(--muted);">${info.emoji} ${info.nombre}</span>
                                <a href="#/other-sports?deporte=${d}" class="subsection-link">Ver todos →</a>
                            </div>
                            <div id="home-deporte-${d}" class="glass-panel" style="padding:1rem;margin-bottom:1.5rem;gap:6px;">
                                <div style="display:flex;gap:8px;align-items:center;">
                                    <div style="width:18px;height:18px;border:2px solid var(--muted);border-right-color:transparent;border-radius:50%;animation:spin 1s linear infinite;"></div>
                                    <span style="color:var(--muted);font-size:.82rem;">Cargando...</span>
                                </div>
                            </div>`;
                    }).join('') : ''}
                </div>

                <!-- Upgrade CTA si no tiene deportes elegidos -->
                ${deportes.length === 0 && !esProMax ? `
                <div style="background:linear-gradient(135deg,rgba(61,111,255,.1),rgba(139,92,246,.08));border:1px solid rgba(61,111,255,.2);border-radius:var(--r-lg);padding:1.5rem;text-align:center;">
                    <div style="font-size:1.8rem;margin-bottom:.7rem;">🏆</div>
                    <p style="font-family:var(--font-heading);font-size:.95rem;font-weight:700;color:var(--text-main);margin-bottom:.4rem;">Seguí más deportes</p>
                    <p style="font-size:.82rem;color:var(--muted);margin-bottom:1.1rem;">Con Platea o Palco podés personalizar tu home.</p>
                    <a href="#/planes" style="display:inline-flex;align-items:center;gap:8px;padding:10px 22px;background:linear-gradient(135deg,#3D6FFF,#8B5CF6);color:#fff;font-weight:700;font-family:var(--font-body);border-radius:var(--r-md);text-decoration:none;font-size:.84rem;box-shadow:0 8px 20px rgba(61,111,255,.3);">
                        Ver planes →
                    </a>
                </div>` : ''}

                  </div><!-- /home-col -->

                  <!-- Rail derecho -->
                  <aside class="home-rail">
                      <div id="rail-live" class="rail-live">
                          <div class="panel-title" style="margin-bottom:.9rem;">Partido destacado</div>
                          <div class="skel-cell" style="height:56px;"></div>
                      </div>
                      <div id="rail-destacado" class="glass-panel" style="display:none;"></div>
                      <div id="rail-stats" class="glass-panel" style="display:none;"></div>
                      <div id="rail-goleadores" class="glass-panel">
                          <div class="panel-title">Máximos goleadores</div>
                          <div class="skel-cell" style="height:38px;"></div>
                      </div>
                      <div id="rail-next" class="glass-panel">
                          <div class="panel-title">Próximos partidos</div>
                          <div class="skel-cell" style="height:38px;"></div>
                      </div>
                  </aside>

                </div><!-- /home-grid -->

            </main>
        ${_closeSidebarWrapper()}
        `;

        // Helper: renderizar un partido en el home
        const _renderPartidoHome = (ev, ligaId) => {
            if (!ev) return '<p style="color:var(--text-muted); font-size:0.82rem; padding:4px 0;">Sin partidos hoy.</p>';
            const comp      = ev.competitions?.[0];
            const home      = comp?.competitors?.find(c => c.homeAway === 'home');
            const away      = comp?.competitors?.find(c => c.homeAway === 'away');
            const estado    = comp?.status?.type?.state ?? 'pre';
            const esLive    = estado === 'in';
            const esPost    = estado === 'post';
            const homeName  = home?.team?.displayName ?? home?.athlete?.displayName ?? '?';
            const awayName  = away?.team?.displayName ?? away?.athlete?.displayName ?? '?';
            const homeLogo  = home?.team?.logo ?? '';
            const awayLogo  = away?.team?.logo ?? '';
            const homeScore = home?.score ?? '';
            const awayScore = away?.score ?? '';
            const clock     = comp?.status?.displayClock ?? '';
            const fechaEv   = new Date(ev.date ?? '');
            const horaAR    = isNaN(fechaEv) ? '' : fechaEv.toLocaleTimeString('es-AR', {timeZone:'America/Argentina/Buenos_Aires', hour:'2-digit', minute:'2-digit'});

            const logoHtml = (logo, name) => {
                if (logo) return `<img src="${logo}" width="24" height="24" style="object-fit:contain;" onerror="this.style.display='none'">`;
                return `<span style="font-size:0.9rem; font-weight:800;">${name.charAt(0)}</span>`;
            };

            const ir = `window.location.hash='#/partido?id=${ev.id}&liga=${ligaId}'`;
            const statusDet = comp?.status?.type?.shortDetail ?? '';
            const esPenHome = /pen/i.test(statusDet) || /shoot/i.test(statusDet);
            const esAETHome = /aet/i.test(statusDet) || /extra/i.test(statusDet) || ((comp?.status?.period ?? 0) > 2 && estado === 'post');
            const sufijo    = esPost ? (esPenHome ? ' (PEN)' : esAETHome ? ' (AET)' : '') : '';
            const marcador  = (esPost||esLive) ? homeScore + ' - ' + awayScore + sufijo : horaAR;
            const sz = (esPost||esLive) ? '1.3rem' : '0.9rem';
            const col = (esPost||esLive) ? 'var(--text-main)' : 'var(--accent-neon)';
            const liveBadge = esLive
                ? `<div class="badge-live" style="display:inline-flex;margin-bottom:8px;">
                    <span class="badge-live-dot"></span>
                    EN VIVO ${clock}'
                   </div>`
                : '';

            return `<div onclick="${ir}" class="match-row${esLive ? ' live' : ''}" style="margin-bottom:6px;">
                <div>
                    ${liveBadge}
                    ${!esLive ? `<div class="match-state-main" style="color:${esPost ? 'var(--muted)' : 'var(--blue)'}">${esPost ? 'FT' : _etiquetaDia(fechaEv)}</div>
                    ${esPost ? `<div class="match-state-group">${_etiquetaDia(fechaEv)}</div>` : ''}` : ''}
                </div>
                <div style="display:flex;align-items:center;gap:10px;justify-content:flex-end;min-width:0;">
                    <span class="match-team-name">${homeName}</span>
                    <div style="width:26px;height:26px;border-radius:50%;background:rgba(255,255,255,0.08);display:flex;align-items:center;justify-content:center;flex-shrink:0;">
                        ${homeLogo ? `<img src="${homeLogo}" width="20" height="20" style="object-fit:contain;border-radius:50%;" onerror="this.style.display='none'">` : `<span style="font-size:.7rem;font-weight:800;">${homeName.charAt(0)}</span>`}
                    </div>
                </div>
                <div class="match-score-cell${(esPost||esLive)?'':' no-score'}">${marcador}</div>
                <div style="display:flex;align-items:center;gap:10px;min-width:0;">
                    <div style="width:26px;height:26px;border-radius:50%;background:rgba(255,255,255,0.08);display:flex;align-items:center;justify-content:center;flex-shrink:0;">
                        ${awayLogo ? `<img src="${awayLogo}" width="20" height="20" style="object-fit:contain;border-radius:50%;" onerror="this.style.display='none'">` : `<span style="font-size:.7rem;font-weight:800;">${awayName.charAt(0)}</span>`}
                    </div>
                    <span class="match-team-name">${awayName}</span>
                </div>
                <span class="match-star">★</span>
            </div>`;
        };

        // Cargar partido de fútbol
        // ── Estado del dashboard de la home ──────────────────────────────────
        let _tab     = 'all';   // filtro activo de los tabs
        let _delDia  = [];      // partidos que se listan (hoy, o el rango si hoy no hay)
        let _delRango= [];      // todos los partidos de los próximos 7 días (para el rail)
        let _comps   = [];      // { slug, nombre, year } de cada competencia del usuario
        let _compDest= null;    // la competencia a la que pertenece el partido destacado

        const _estadoEv = (ev) => ev?.competitions?.[0]?.status?.type?.state ?? 'pre';
        const _catEv    = (ev) => { const s = _estadoEv(ev); return s === 'in' ? 'live' : s === 'post' ? 'finished' : 'upcoming'; };
        const _horaEv   = (ev) => {
            const f = new Date(ev?.date ?? '');
            return isNaN(f) ? '' : f.toLocaleTimeString('es-AR', {timeZone:'America/Argentina/Buenos_Aires', hour:'2-digit', minute:'2-digit'});
        };
        const _logoEq = (logo, nombre, px) => logo
            ? `<img src="${logo}" width="${px}" height="${px}" style="object-fit:contain;" onerror="this.style.display='none'">`
            : `<span style="font-weight:800;font-size:${Math.round(px * 0.45)}px;">${(nombre ?? '?').charAt(0)}</span>`;

        // ── Hero: partido destacado ──────────────────────────────────────────
        const _pintarHero = (ev) => {
            const el = document.getElementById('home-hero');
            if (!el) return;
            if (!ev) { el.className = ''; el.innerHTML = ''; return; }

            const comp   = ev.competitions?.[0];
            const home   = comp?.competitors?.find(c => c.homeAway === 'home');
            const away   = comp?.competitors?.find(c => c.homeAway === 'away');
            const estado = _estadoEv(ev);
            const esLive = estado === 'in';
            const esPost = estado === 'post';
            const clock  = comp?.status?.displayClock ?? '';

            let badge, linea, color, cta;
            if (esLive) {
                badge = `<div class="hero-live-badge"><span class="hero-live-dot"></span><span class="hero-live-text">EN VIVO</span></div>`;
                linea = clock ? clock + " · en juego" : 'En juego';
                color = 'var(--red-live)'; cta = 'Ver en vivo';
            } else if (esPost) {
                badge = `<div class="hero-live-badge" style="background:rgba(255,255,255,.06);border-color:rgba(255,255,255,.14);"><span class="hero-live-text" style="color:#9aa3bd;">FINALIZADO</span></div>`;
                linea = 'Partido finalizado'; color = 'var(--muted)'; cta = 'Ver resumen';
            } else {
                badge = `<div class="hero-live-badge" style="background:rgba(61,111,255,.14);border-color:rgba(61,111,255,.35);"><span class="hero-live-text" style="color:#8FA9FF;">PRÓXIMO</span></div>`;
                const h = _horaEv(ev);
                const d = _etiquetaDia(ev.date);
                // "Comienza hoy 21:30" / "Comienza el jue 23/7 a las 16:00"
                linea = h ? (d === 'Hoy' || d === 'Mañana' ? `Comienza ${d.toLowerCase()} ${h}` : `Comienza el ${d} a las ${h}`)
                          : 'Próximamente';
                color = '#8FA9FF'; cta = 'Ver detalle';
            }

            const marcador = (esLive || esPost)
                ? `${home?.score ?? '-'}<span class="hero-score-sep">–</span>${away?.score ?? '-'}`
                : 'VS';
            const nota = comp?.notes?.[0]?.headline ?? ev._liga ?? '';
            const ir   = `window.location.hash='#/partido?id=${ev.id}&liga=${ev._slug}'`;

            el.className = 'hero-card';
            el.innerHTML = `
                <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;">
                    ${badge}
                    <span class="hero-meta">${nota}</span>
                </div>
                <div class="hero-grid">
                    <div class="hero-side">
                        <div class="hero-logo">${_logoEq(home?.team?.logo, home?.team?.displayName, 44)}</div>
                        <div style="min-width:0;">
                            <div class="hero-team-name">${home?.team?.displayName ?? '?'}</div>
                            <div class="hero-team-sub">${home?.team?.abbreviation ?? ''}</div>
                        </div>
                    </div>
                    <div class="hero-center">
                        <div class="hero-score">${marcador}</div>
                        <div class="hero-state-line" style="color:${color};">${linea}</div>
                        <button class="hero-watch-btn" style="margin-top:14px;" onclick="${ir}">${cta} →</button>
                    </div>
                    <div class="hero-side away">
                        <div class="hero-logo">${_logoEq(away?.team?.logo, away?.team?.displayName, 44)}</div>
                        <div style="min-width:0;">
                            <div class="hero-team-name">${away?.team?.displayName ?? '?'}</div>
                            <div class="hero-team-sub">${away?.team?.abbreviation ?? ''}</div>
                        </div>
                    </div>
                </div>`;
        };

        // ── Tabs + lista de partidos ─────────────────────────────────────────
        const _pintarTabs = () => {
            const el = document.getElementById('home-tabs');
            if (!el) return;
            const contar = k => k === 'all' ? _delRango.length : _delRango.filter(e => _catEv(e) === k).length;
            const defs = [['all','Todos'], ['live','En vivo'], ['upcoming','Próximos'], ['finished','Finalizados']];
            el.innerHTML = defs.map(([k, label]) =>
                `<button class="tab-btn${_tab === k ? ' active' : ''}" onclick="window._homeSetTab('${k}')">${label}<span class="tab-count">${contar(k)}</span></button>`
            ).join('');
        };

        const _pintarLista = () => {
            const el = document.getElementById('home-lista');
            if (!el) return;
            const lista = _tab === 'all' ? _delRango : _delRango.filter(e => _catEv(e) === _tab);
            el.innerHTML = lista.length
                ? lista.map(ev => _renderPartidoHome(ev, ev._slug)).join('')
                : '<p style="color:var(--muted);font-size:.82rem;padding:14px 2px;text-align:center;">No hay partidos en esta categoría.</p>';
        };

        window._homeSetTab = (t) => { _tab = t; _pintarTabs(); _pintarLista(); };

        // ── Rail derecho ─────────────────────────────────────────────────────
        const _pintarRail = (destacado) => {
            const elLive = document.getElementById('rail-live');
            const elNext = document.getElementById('rail-next');

            if (elLive) {
                if (!destacado) {
                    elLive.style.display = 'none';
                } else {
                    const comp   = destacado.competitions?.[0];
                    const h      = comp?.competitors?.find(c => c.homeAway === 'home');
                    const a      = comp?.competitors?.find(c => c.homeAway === 'away');
                    const estado = _estadoEv(destacado);
                    const esLive = estado === 'in';
                    const esPost = estado === 'post';
                    const marcador = (esLive || esPost) ? `${h?.score ?? '-'} – ${a?.score ?? '-'}` : 'VS';
                    const etiqueta = esLive ? (comp?.status?.displayClock ?? 'EN VIVO') : esPost ? 'FT' : _horaEv(destacado);
                    const color    = esLive ? 'var(--red-live)' : esPost ? 'var(--muted)' : 'var(--blue)';
                    const fondo    = esLive ? 'rgba(255,77,109,.14)' : 'rgba(255,255,255,.06)';
                    const ir       = `window.location.hash='#/partido?id=${destacado.id}&liga=${destacado._slug}'`;

                    elLive.innerHTML = `
                        <div class="panel-title" style="margin-bottom:.9rem;">${esLive ? 'Partido en vivo' : 'Partido destacado'}</div>
                        <div class="rail-live-teams">
                            <div class="rail-team">
                                <div class="logo">${_logoEq(h?.team?.logo, h?.team?.displayName, 30)}</div>
                                <div class="nm">${h?.team?.displayName ?? '?'}</div>
                            </div>
                            <div class="rail-live-score">
                                <div class="sc">${marcador}</div>
                                <div class="st" style="color:${color};background:${fondo};">${etiqueta}</div>
                            </div>
                            <div class="rail-team">
                                <div class="logo">${_logoEq(a?.team?.logo, a?.team?.displayName, 30)}</div>
                                <div class="nm">${a?.team?.displayName ?? '?'}</div>
                            </div>
                        </div>
                        <div class="rail-cta" onclick="${ir}">Match Center →</div>`;
                }
            }

            if (elNext) {
                const prox = _delRango.filter(e => _catEv(e) === 'upcoming').slice(0, 5);
                elNext.innerHTML = `<div class="panel-title">Próximos partidos</div>` + (prox.length
                    ? prox.map(ev => {
                        const c  = ev.competitions?.[0];
                        const h  = c?.competitors?.find(x => x.homeAway === 'home');
                        const a  = c?.competitors?.find(x => x.homeAway === 'away');
                        const ir = `window.location.hash='#/partido?id=${ev.id}&liga=${ev._slug}'`;
                        const img = (t) => t?.logo ? `<img class="rail-next-logo" src="${t.logo}" onerror="this.style.display='none'">` : '';
                        return `<div class="rail-next-row" onclick="${ir}">
                            <span class="rail-next-time"><span style="display:block;font-size:.58rem;color:var(--dim);font-weight:600;">${_etiquetaDia(ev.date)}</span>${_horaEv(ev)}</span>
                            ${img(h?.team)}
                            <span class="rail-next-team">${h?.team?.abbreviation ?? h?.team?.displayName ?? '?'}</span>
                            <span class="rail-next-vs">vs</span>
                            <span class="rail-next-team">${a?.team?.abbreviation ?? a?.team?.displayName ?? '?'}</span>
                            ${img(a?.team)}
                        </div>`;
                    }).join('')
                    : '<p style="color:var(--muted);font-size:.78rem;padding:8px 0;">Sin partidos próximos.</p>');
            }
        };

        // ── Fetch a ESPN vía el proxy de Cloudflare ──────────────────────────
        const _espn = async (url) => {
            const r = await fetch(CF_WORKER + '/?url=' + encodeURIComponent(url));
            if (!r.ok) throw new Error('HTTP ' + r.status);
            return r.json();
        };

        // ── Cronología + estadísticas del partido destacado ──────────────────
        const _cargarDetallePartido = async (ev) => {
            if (!ev) return;
            let sum;
            try { sum = await _espn(`https://site.api.espn.com/apis/site/v2/sports/soccer/${ev._slug}/summary?event=${ev.id}`); }
            catch { return; }

            // ---- Cronología (keyEvents) ----
            const TIPOS = {
                goal:   { clase: 'goal',   label: 'Gol' },
                yellow: { clase: 'yellow', label: 'T. Amarilla' },
                red:    { clase: 'red',    label: 'T. Roja' },
                sub:    { clase: 'sub',    label: 'Cambio' },
            };
            // ESPN manda tipos como "Goal", "Goal - Header", "Yellow Card", "Substitution",
            // mezclados con ruido ("Kickoff", "Start Delay"…) que descartamos.
            const clasificar = (texto = '') => {
                const t = texto.toLowerCase();
                if (t.includes('goal'))         return 'goal';
                if (t.includes('yellow'))       return 'yellow';
                if (t.includes('red'))          return 'red';
                if (t.includes('substitution')) return 'sub';
                return null;
            };

            const eventos = (sum.keyEvents ?? []).map(k => {
                const tipo = clasificar(k.type?.text);
                if (!tipo) return null;
                return {
                    tipo,
                    min:     k.clock?.displayValue ?? '',
                    jugador: k.participants?.[0]?.athlete?.displayName ?? '',
                };
            }).filter(Boolean);

            const elCrono = document.getElementById('home-crono');
            if (elCrono && eventos.length) {
                elCrono.style.display = '';
                elCrono.innerHTML = `
                    <div class="panel-title">Cronología del partido</div>
                    <div class="crono-scroll">
                        ${eventos.map(e => `
                            <div class="event-chip">
                                <span class="event-icon ${TIPOS[e.tipo].clase}"></span>
                                <div>
                                    <div class="event-min">${e.min} <span style="color:var(--muted);font-weight:500;">${e.jugador}</span></div>
                                    <div class="event-player">${TIPOS[e.tipo].label}</div>
                                </div>
                            </div>`).join('')}
                    </div>`;
            }

            // ---- Alineaciones (rosters) ----
            // Sale del mismo summary, así que no cuesta un fetch extra.
            const elLineups = document.getElementById('home-alineaciones');
            const rosters   = (sum.rosters ?? []).filter(r => (r.roster ?? []).some(j => j.starter));
            if (elLineups && rosters.length === 2) {
                // Alineaciones: disponibles para todos los planes.
                const columna = (r) => {
                    // _filaDesigla traduce la sigla de ESPN a fila: 0=arquero 1=defensa 2=medio 3=ataque
                    const titulares = (r.roster ?? [])
                        .filter(j => j.starter)
                        .sort((a, b) => _filaDesigla(a.position?.abbreviation) - _filaDesigla(b.position?.abbreviation));
                    return `
                        <div>
                            <div class="lu-head">
                                ${r.team?.logos?.[0]?.href ? `<img class="lu-flag" src="${r.team.logos[0].href}" onerror="this.style.display='none'">` : ''}
                                <span class="lu-name">${r.team?.displayName ?? '?'}</span>
                                ${r.formation ? `<span class="lu-form">${r.formation}</span>` : ''}
                            </div>
                            <div class="lu-list">
                                ${titulares.map(j => {
                                    const jid = j.athlete?.id;
                                    return `
                                    <div class="lu-row ${jid ? 'clickable' : ''}" ${jid ? `onclick="window.location.hash='#/jugador?id=${jid}&liga=${ev._slug}'"` : ''}>
                                        <span class="lu-jersey">${j.jersey ?? ''}</span>
                                        <span class="lu-player">${j.athlete?.displayName ?? '?'}${j.captain ? ' <span class="lu-cap">(C)</span>' : ''}</span>
                                        <span class="lu-pos">${j.position?.abbreviation ?? ''}</span>
                                    </div>`;
                                }).join('')}
                            </div>
                        </div>`;
                };
                elLineups.style.display = '';
                elLineups.innerHTML = `
                    <div class="panel-title" style="display:flex;justify-content:space-between;align-items:center;">
                        <span>Alineaciones</span>
                        <span style="font-family:var(--font-body);font-size:.66rem;text-transform:none;letter-spacing:0;color:var(--dim);">Titulares</span>
                    </div>
                    <div class="lineups-grid">${rosters.map(columna).join('')}</div>`;
            }

            // ---- Estadísticas (boxscore) ----
            const equipos = sum.boxscore?.teams ?? [];
            const elStats = document.getElementById('rail-stats');
            if (!elStats || equipos.length !== 2) return;
            // Estadísticas: disponibles para todos los planes.

            const valor = (i, clave) => {
                const s = (equipos[i].statistics ?? []).find(x => x.name === clave);
                return s ? s.displayValue : null;
            };
            const QUIERO = [
                ['possessionPct',  'Posesión', true],
                ['totalShots',     'Tiros',    false],
                ['shotsOnTarget',  'A puerta', false],
                ['wonCorners',     'Córners',  false],
                ['foulsCommitted', 'Faltas',   false],
            ];

            const filas = QUIERO.map(([clave, label, esPct]) => {
                const h = valor(0, clave), a = valor(1, clave);
                if (h == null || a == null) return '';
                const nh = parseFloat(h) || 0;
                const na = parseFloat(a) || 0;
                const total = nh + na;
                const pctH = total ? Math.round(nh / total * 100) : 50;
                const txt  = v => esPct ? v + '%' : v;
                return `
                    <div class="stat-bar-row">
                        <div class="labels">
                            <span class="lbl-val">${txt(h)}</span>
                            <span class="lbl-name">${label}</span>
                            <span class="lbl-val">${txt(a)}</span>
                        </div>
                        <div class="stat-bar-track">
                            <div class="stat-bar-home"><div class="stat-bar-home-fill" style="width:${pctH}%;"></div></div>
                            <div class="stat-bar-away"><div class="stat-bar-away-fill" style="width:${100 - pctH}%;"></div></div>
                        </div>
                    </div>`;
            }).join('');

            if (filas.trim()) {
                const abrev = i => equipos[i].team?.abbreviation ?? '';
                elStats.style.display = '';
                elStats.innerHTML = `
                    <div class="panel-title" style="display:flex;justify-content:space-between;align-items:center;">
                        <span>Estadísticas</span>
                        <span style="font-family:var(--font-display);font-size:.62rem;">
                            <span style="color:var(--blue);">${abrev(0)}</span>
                            <span style="color:var(--muted);margin-left:8px;">${abrev(1)}</span>
                        </span>
                    </div>
                    ${filas}`;
            }
        };

        // ── Tabla de posiciones ──────────────────────────────────────────────
        // Sirve para grupos (Mundial = 12 hijos), zonas (Liga Argentina = 2) y
        // ligas de tabla única (Premier = 1 hijo). ESPN siempre usa `children`.
        const _cargarGrupos = async (comp) => {
            const el = document.getElementById('home-grupos');
            if (!el || !comp) return;
            try {
                const data = await _espn(`https://site.api.espn.com/apis/v2/sports/soccer/${comp.slug}/standings`);
                const hijos = data.children ?? [];
                const unaSolaTabla = hijos.length === 1;

                const grupos = hijos.slice(0, 4).map(g => {
                    // OJO: ESPN NO devuelve las entradas ordenadas. La posición real está
                    // en note.rank (note.color trae el color oficial de clasificación).
                    const equipos = (g.standings?.entries ?? []).map(e => {
                        const st = {};
                        (e.stats ?? []).forEach(s => {
                            if (s.abbreviation) st[s.abbreviation] = s.displayValue ?? s.value;
                            if (s.name)         st[s.name]         = s.displayValue ?? s.value;
                        });
                        return {
                            pos:    Number(e.note?.rank ?? st['rank'] ?? 0) || 0,
                            color:  e.note?.color ?? null,
                            nombre: e.team?.displayName ?? e.team?.name ?? '?',
                            logo:   e.team?.logos?.[0]?.href ?? '',
                            pj:     st['GP'] ?? st['gamesPlayed'] ?? '0',
                            pts:    st['P']  ?? st['points']      ?? '0',
                        };
                    }).sort((a, b) => (a.pos || 99) - (b.pos || 99));

                    equipos.forEach((t, i) => { if (!t.pos) t.pos = i + 1; });
                    // En tabla única mostramos los primeros 10; en grupos, todos (son 4).
                    return { nombre: g.name, equipos: unaSolaTabla ? equipos.slice(0, 10) : equipos };
                }).filter(g => g.equipos.length);

                if (!grupos.length) return;

                const titulo = unaSolaTabla ? 'Tabla de posiciones' : 'Vista de Grupos';

                el.style.display = '';
                el.innerHTML = `
                    <div class="home-section-head">
                        <span class="section-title" style="font-size:1rem;border:none;padding:0;margin:0;">${titulo}</span>
                        <a href="#/liga?id=${comp.slug}" class="subsection-link">Ver completa →</a>
                    </div>
                    <div class="home-groups" ${unaSolaTabla ? 'style="grid-template-columns:1fr;"' : ''}>
                        ${grupos.map(g => `
                            <div class="hg-card">
                                <div class="hg-head">
                                    <span class="hg-name">${unaSolaTabla ? comp.nombre : g.nombre}</span>
                                    <span class="hg-h">PJ</span>
                                    <span class="hg-h">PTS</span>
                                </div>
                                ${g.equipos.map(t => {
                                    const ir = unaSolaTabla
                                        ? `window.location.hash='#/liga?id=${comp.slug}'`
                                        : `window.location.hash='#/grupo?id=${encodeURIComponent(g.nombre)}'`;
                                    return `
                                    <div class="hg-row" onclick="${ir}">
                                        <span class="hg-pos ${t.color ? '' : 'resto'}" ${t.color ? `style="color:${t.color};"` : ''}>${t.pos}</span>
                                        ${t.logo ? `<img class="hg-logo" src="${t.logo}" onerror="this.style.visibility='hidden'">` : '<span class="hg-logo"></span>'}
                                        <span class="hg-team">${t.nombre}</span>
                                        <span class="hg-pj">${t.pj}</span>
                                        <span class="hg-pts">${t.pts}</span>
                                    </div>`;
                                }).join('')}
                            </div>`).join('')}
                    </div>`;
            } catch (e) { /* si falla, la sección queda oculta */ }
        };

        // ── Máximos goleadores ───────────────────────────────────────────────
        // El core API devuelve los atletas como $ref, así que hay que resolverlos.
        const _cargarGoleadores = async (comp) => {
            const el = document.getElementById('rail-goleadores');
            if (!el || !comp) return;
            try {
                // Algunas ligas devuelven 404 con el año en curso porque la temporada
                // todavía no arrancó (ej. Premier en julio). Probamos el año anterior.
                const leadersDe = (year) => _espn(`https://sports.core.api.espn.com/v2/sports/soccer/leagues/${comp.slug}/seasons/${year}/types/1/leaders`);
                const data = await leadersDe(comp.year).catch(() => leadersDe(comp.year - 1));

                const cat  = (data.categories ?? []).find(c => c.name === 'goalsLeaders');
                const top  = (cat?.leaders ?? []).slice(0, 5);
                if (!top.length) { el.style.display = 'none'; return; }

                const POSICIONES = { F: 'Delantero', M: 'Mediocampista', D: 'Defensor', G: 'Arquero' };

                const jugadores = (await Promise.all(top.map(async (l) => {
                    const ref = l.athlete?.['$ref'];
                    if (!ref) return null;
                    try {
                        const a = await _espn(ref.replace('http://', 'https://'));
                        // ESPN manda el resumen como "M: 6, G: 8: A: 2" (partidos, goles, asistencias)
                        const corto = l.shortDisplayValue ?? '';
                        const sacar = (re) => { const m = corto.match(re); return m ? m[1] : null; };
                        const abrev = a.position?.abbreviation ?? '';
                        return {
                            id:       a.id,
                            nombre:   a.shortName ?? a.displayName ?? '?',
                            completo: a.displayName ?? a.shortName ?? '?',
                            pais:     a.citizenship ?? '',
                            cara:     a.headshot?.href ?? '',
                            bandera:  a.flag?.href ?? '',
                            dorsal:   a.jersey ?? '',
                            posicion: POSICIONES[abrev] ?? abrev,
                            goles:    Math.round(parseFloat(l.value) || 0),
                            partidos: sacar(/M:\s*(\d+)/),
                            asist:    sacar(/A:\s*(\d+)/),
                        };
                    } catch { return null; }
                }))).filter(Boolean);

                if (!jugadores.length) { el.style.display = 'none'; return; }

                const claseRank = i => i === 0 ? 'rank-1' : i <= 2 ? 'rank-2' : 'rank-rest';
                el.innerHTML = `
                    <div class="panel-title">Máximos goleadores</div>
                    ${jugadores.map((p, i) => `
                        <div class="scorer-row clickable" onclick="window.location.hash='#/jugador?id=${p.id}&liga=${comp.slug}'">
                            <span class="scorer-rank ${claseRank(i)}">${i + 1}</span>
                            <span class="scorer-face">
                                ${p.cara
                                    ? `<img class="cara" src="${p.cara}" onerror="this.style.display='none'">`
                                    : `<span class="sin-foto">${p.nombre.charAt(0)}</span>`}
                                ${p.bandera ? `<img class="bandera" src="${p.bandera}" onerror="this.style.display='none'">` : ''}
                            </span>
                            <div style="min-width:0;">
                                <div class="scorer-name">${p.nombre}</div>
                                <div class="scorer-team">${p.pais}</div>
                            </div>
                            <div class="scorer-goals"><span class="n">${p.goles}</span><span class="u">gol</span></div>
                        </div>`).join('')}`;

                // Jugador destacado = el goleador nº1 (sale de los datos que ya trajimos)
                const elSpot = document.getElementById('rail-destacado');
                const p0 = jugadores[0];
                if (elSpot && p0) {
                    const meta = [p0.pais, p0.posicion, p0.dorsal ? '#' + p0.dorsal : ''].filter(Boolean).join(' · ');
                    elSpot.style.display = '';
                    elSpot.innerHTML = `
                        <div class="panel-title">Jugador destacado</div>
                        <div class="spot-top">
                            <span class="spot-face">
                                ${p0.cara
                                    ? `<img class="cara" src="${p0.cara}" onerror="this.style.display='none'">`
                                    : `<span class="sin-foto">${p0.completo.charAt(0)}</span>`}
                                ${p0.bandera ? `<img class="bandera" src="${p0.bandera}" onerror="this.style.display='none'">` : ''}
                            </span>
                            <div style="min-width:0;">
                                <div class="spot-name">${p0.completo}</div>
                                <div class="spot-meta">${meta}</div>
                                <span class="spot-badge">★ Máximo goleador</span>
                            </div>
                        </div>
                        <div class="spot-stats">
                            <div class="spot-stat"><div class="v">${p0.goles}</div><div class="l">Goles</div></div>
                            <div class="spot-stat"><div class="v">${p0.asist ?? '—'}</div><div class="l">Asist.</div></div>
                            <div class="spot-stat"><div class="v">${p0.partidos ?? '—'}</div><div class="l">Partidos</div></div>
                        </div>
                        <div class="spot-link" onclick="window.location.hash='#/jugador?id=${p0.id}&liga=${comp.slug}'">Ver perfil completo →</div>`;
                }
            } catch (e) { el.style.display = 'none'; }
        };

        // ── Noticias ─────────────────────────────────────────────────────────
        const _cargarNoticias = async () => {
            const el = document.getElementById('home-noticias');
            if (!el) return;
            try {
                const data  = await _espn('https://now.core.api.espn.com/v1/sports/news?sport=soccer&limit=8');
                const items = (data.headlines ?? []).slice(0, 4);
                if (!items.length) return;

                const cuando = (iso) => {
                    const d = new Date(iso ?? '');
                    if (isNaN(d)) return '';
                    const hs = Math.floor((Date.now() - d.getTime()) / 3600000);
                    if (hs < 1)  return 'recién';
                    if (hs < 24) return `hace ${hs} h`;
                    return `hace ${Math.floor(hs / 24)} d`;
                };

                el.style.display = '';
                el.innerHTML = `
                    <div class="home-section-head">
                        <span class="section-title" style="font-size:1rem;border:none;padding:0;margin:0;">Noticias</span>
                        <a href="#/info" class="subsection-link">Ver todas →</a>
                    </div>
                    <div style="display:flex;flex-direction:column;gap:10px;">
                        ${items.map(n => {
                            const img  = n.images?.[0]?.url ?? '';
                            const link = n.links?.web?.href ?? '#';
                            return `
                            <a class="news-row" href="${link}" target="_blank" rel="noopener" style="text-decoration:none;">
                                <div class="news-thumb">${img ? `<img src="${img}" style="width:100%;height:100%;object-fit:cover;" onerror="this.style.display='none'">` : '📰'}</div>
                                <div style="flex:1;min-width:0;">
                                    <span class="news-tag tag-oficial">${n.type ?? 'NOTICIA'}</span>
                                    <div class="news-title">${n.headline ?? ''}</div>
                                </div>
                                <span class="news-date">${cuando(n.published)}</span>
                            </a>`;
                        }).join('')}
                    </div>`;
            } catch (e) { /* si falla, la sección queda oculta */ }
        };

        // ── Carga de datos: las competencias que el usuario eligió en #/setup ──
        const _cargarFutbol = async () => {
            try {
                const TZ  = 'America/Argentina/Buenos_Aires';
                const fmt = (d) => d.toLocaleDateString('en-CA', {timeZone: TZ}).replace(/-/g, '');
                const hoy = new Date();
                const rango = fmt(hoy) + '-' + fmt(new Date(hoy.getTime() + 7 * 24 * 60 * 60 * 1000));

                // Un scoreboard por competencia, en paralelo. Si una falla, seguimos con las otras.
                _comps = (await Promise.all(_competenciasUsuario().map(async (slug) => {
                    const pedir = (qs) => _espn(`https://site.api.espn.com/apis/site/v2/sports/soccer/${slug}/scoreboard${qs}`);
                    try {
                        // Primero la semana en curso. Pero si la liga está en receso —las
                        // europeas no juegan de junio a agosto— eso devuelve 0 partidos y la
                        // home quedaría vacía. En ese caso pedimos el scoreboard sin fechas,
                        // que da la jornada relevante (la próxima, o la última jugada).
                        let data = await pedir(`?dates=${rango}`);
                        if (!(data.events ?? []).length) data = await pedir('');

                        const liga = data.leagues?.[0];
                        // Con rango de fechas data.season viene vacío: el año está en leagues[0].
                        const year = liga?.season?.year ?? data.season?.year ?? hoy.getFullYear();
                        const nombre = liga?.name ?? slug;
                        // Etiquetamos cada partido con su competencia, porque después se mezclan.
                        const eventos = (data.events ?? []).map(e => ({ ...e, _slug: slug, _liga: nombre }));
                        return { slug, nombre, year, eventos };
                    } catch {
                        return { slug, nombre: slug, year: hoy.getFullYear(), eventos: [] };
                    }
                }))).filter(c => c.eventos.length);

                _delRango = _comps.flatMap(c => c.eventos);

                if (!_delRango.length) {
                    _pintarHero(null);
                    _pintarTabs();
                    _pintarLista();
                    _pintarRail(null);
                    await _cargarNoticias();
                    return;
                }

                // _delDia (los de hoy, o todo si hoy no hay) solo se usa para elegir el
                // partido destacado. La lista de abajo muestra _delRango completo, así se
                // ven TODAS las competencias que sigue el usuario (nacional + internacional)
                // aunque solo una tenga partido hoy.
                const hoyStr = fmt(hoy);
                const deHoy  = _delRango.filter(e => fmt(new Date(e.date)) === hoyStr);
                _delDia = deHoy.length ? deHoy : _delRango.slice();

                // Orden: en vivo → próximos → finalizados, y dentro de cada grupo por fecha
                const prio = e => { const c = _catEv(e); return c === 'live' ? 0 : c === 'upcoming' ? 1 : 2; };
                _delDia.sort((a, b) => prio(a) - prio(b) || new Date(a.date) - new Date(b.date));
                _delRango.sort((a, b) => prio(a) - prio(b) || new Date(a.date) - new Date(b.date));

                // Destacado: el primero en vivo; si no hay, el primero de la lista
                const destacado = _delDia.find(e => _catEv(e) === 'live') ?? _delDia[0] ?? null;
                _compDest = _comps.find(c => c.slug === destacado?._slug) ?? _comps[0] ?? null;

                // El encabezado de la sección refleja lo que el usuario eligió
                const etiqueta = document.getElementById('home-liga-label');
                if (etiqueta) {
                    etiqueta.textContent = _comps.length > 1
                        ? '⚽ ' + _comps.map(c => c.nombre).join(' · ')
                        : '⚽ ' + (_comps[0]?.nombre ?? 'Fútbol');
                }

                _pintarHero(destacado);
                _pintarTabs();
                _pintarLista();
                _pintarRail(destacado);

                // Datos complementarios: van en paralelo y cada uno se oculta si falla,
                // así que un error acá no rompe el marcador ni la lista de arriba.
                await Promise.all([
                    _cargarDetallePartido(destacado),
                    _cargarGrupos(_compDest),
                    _cargarGoleadores(_compDest),
                    _cargarNoticias(),
                ]);
            } catch (e) {
                _pintarHero(null);
                const el = document.getElementById('home-lista');
                if (el) el.innerHTML = '<p style="color:var(--muted);font-size:.82rem;">Error cargando partidos.</p>';
                const rl = document.getElementById('rail-live');
                if (rl) rl.style.display = 'none';
            }
        };

        // Cargar partido de otro deporte
        const _cargarDeporte = async (deporteId) => {
            const el   = document.getElementById('home-deporte-' + deporteId);
            if (!el) return;
            const info = DEPORTE_INFO[deporteId];
            if (!info) return;
            try {
                const hoy = new Date().toLocaleDateString('en-CA', {timeZone:'America/Argentina/Buenos_Aires'}).replace(/-/g,'');
                const res = await fetch(CF_WORKER + '/?url=' + encodeURIComponent('https://site.api.espn.com/apis/site/v2/sports/' + info.slug + '/scoreboard?dates=' + hoy));
                const data = res.ok ? await res.json() : {};
                const eventos = data.events ?? [];
                eventos.sort((a,b) => {
                    const p = s => s==='in'?0:s==='post'?1:2;
                    return p(a.competitions?.[0]?.status?.type?.state) - p(b.competitions?.[0]?.status?.type?.state);
                });
                const top = eventos.slice(0,2);
                el.innerHTML = top.length > 0
                    ? top.map(ev => _renderPartidoHome(ev, deporteId)).join('<hr style="border:none; border-top:1px solid var(--border-glass); margin:8px 0;">')
                    : '<p style="color:var(--text-muted); font-size:0.82rem;">Sin eventos hoy.</p>';
            } catch(e) {
                if (el) el.innerHTML = '<p style="color:var(--text-muted); font-size:0.82rem;">Error cargando.</p>';
            }
        };

        // Cargar todo en paralelo
        const promesas = [_cargarFutbol()];
        if (esProMax) deportes.forEach(d => promesas.push(_cargarDeporte(d)));
        await Promise.all(promesas);
    };

    const renderLigas = () => {
        const esPro        = _esPro();
        const _hashUrl     = new URL('http://x.com' + window.location.hash.replace('#', ''));
        const esAdmin      = _hashUrl.searchParams.get('admin') === '1' ||
                             window.FirebaseAuth?.getPerfil()?.plan === 'admin';
        const ligaNacional = window.FirebaseAuth?.getPerfil()?.ligaNacional ?? null;

        let html = `
            ${renderNavbar('#/ligas')}
            <main class="page-container fade-in">
                <h2 class="section-title">🏆 Competiciones Disponibles</h2>
                ${!esPro ? `
                <div style="background:rgba(61,111,255,.06);border:1px solid rgba(61,111,255,.2);border-radius:var(--r-md);padding:12px 16px;margin-bottom:1.5rem;display:flex;align-items:center;justify-content:space-between;gap:1rem;">
                    <div>
                        <span style="font-family:var(--font-body);font-size:.82rem;color:var(--text-main);font-weight:600;">Plan Popular — 1 liga nacional + todas las copas</span>
                        <span style="display:block;font-size:.73rem;color:var(--muted);margin-top:2px;">Pasate a Platea para ver todas las ligas.</span>
                    </div>
                    <a href="#/planes" style="padding:7px 16px;background:linear-gradient(135deg,#3D6FFF,#8B5CF6);color:#fff;font-weight:700;font-family:var(--font-body);border-radius:var(--r-sm);text-decoration:none;font-size:.78rem;white-space:nowrap;">
                        Ver planes
                    </a>
                </div>` : ''}
        `;

        // Keys que son copas — siempre visibles para todos los planes
        const KEYS_COPAS = ['copas_inglesas', 'internacionales', 'mundiales', 'sudamerica'];

        for (const key in LIGAS) {
            const categoria = LIGAS[key];
            // Ligas ocultas: solo visibles para admin
            if (categoria.hidden && !esAdmin) continue;
            const esCopa    = KEYS_COPAS.includes(key);

            html += `
                <div class="categoria-wrapper">
                    <h3 class="category-title">${categoria.nombre}</h3>
                    <div class="leagues-grid">
            `;

            categoria.competiciones.forEach(liga => {
                const esLigaNacional   = liga.id === ligaNacional;
                const bloqueada        = !esPro && !esCopa && !esLigaNacional;

                html += `
                    <div class="glass-card league-card"
                        onclick="${bloqueada ? `window.location.hash='#/planes'` : `window.location.hash='#/liga?id=${liga.id}'`}"
                        style="${bloqueada ? 'opacity:0.55;' : ''}">
                        <div class="league-info">
                            <span class="league-flag">${liga.flag}</span>
                            <div>
                                <div class="league-name">${bloqueada ? '🔒 ' : ''}${liga.nombre}</div>
                                <div class="league-country">${liga.pais}</div>
                            </div>
                        </div>
                        <span class="badge-liga" style="background:${bloqueada ? 'rgba(255,255,255,.08)' : liga.badge_color + '22'};color:${bloqueada ? 'var(--muted)' : liga.badge_color};border:1px solid ${bloqueada ? 'rgba(255,255,255,.06)' : liga.badge_color + '55'};font-family:var(--font-display);font-size:.65rem;font-weight:700;">${bloqueada ? 'PRO' : liga.id.substring(0, 5).toUpperCase()}</span>
                    </div>
                `;
            });

            html += `</div></div>`;
        }

        html += `</main>${_closeSidebarWrapper()}`;
        appContainer.innerHTML = html;
    };

    // ── DETALLE DE LIGA TRADICIONAL ──────────────────────────────────────────
    const renderLigaDetalle = async (ligaId) => {
        let ligaData = null;
        for (const cat in LIGAS) {
            const found = LIGAS[cat].competiciones.find(l => l.id === ligaId);
            if (found) ligaData = found;
        }
        if (!ligaData) return;

        if (ligaId === 'world_cup' || ligaId === 'wc') {
            await renderCalendarioMundial(ligaData);
            return;
        }

        appContainer.innerHTML = `
            ${renderNavbar('#/liga?id=' + ligaId)}
            <main class="page-container fade-in">
                <a href="#/ligas" style="color: var(--text-muted); text-decoration: none; display: inline-block; margin-bottom: 1rem;">← Volver al Listado</a>
                <div class="liga-header" style="border-left: 6px solid ${ligaData.badge_color};">
                    <span class="liga-flag-large">${ligaData.flag}</span>
                    <div>
                        <h1 class="liga-title-main">${ligaData.nombre}</h1>
                        <span style="color: var(--text-muted); font-weight: 600; text-transform: uppercase;">${ligaData.pais}</span>
                    </div>
                </div>
                <div class="liga-content-grid">
                    <div class="glass-panel" id="standings-box" style="padding: 1.5rem;">
                        <h3 class="panel-title">Tabla de Posiciones</h3>
                        <div class="table-responsive">${_skeletonTabla()}</div>
                    </div>
                    <div class="glass-panel" id="matches-box" style="padding: 1.5rem; height: fit-content;">
                        <h3 class="panel-title">Partidos Recientes</h3>
                        ${_skeletonPartidos()}
                    </div>
                </div>
            </main>
        ${_closeSidebarWrapper()}
        `;

        try {
            const [tablaRaw, partidosRaw] = await Promise.all([
                ESPN.getStandings(ligaId),
                ESPN.getScoreboard(ligaId)
            ]);

            const standingsBox = document.getElementById('standings-box');
            const matchesBox   = document.getElementById('matches-box');

            if (tablaRaw && tablaRaw.length > 0) {
                let rowsHtml = tablaRaw.map(entry => {
                    const t = entry.team;
                    const imgLogo = t.logo
                        ? `<img src="${t.logo}" width="20" height="24" style="object-fit: contain; margin-right: 8px;">`
                        : `<span class="team-shield" style="margin-right: 8px;">${t.name.charAt(0)}</span>`;
                    return `
                        <tr onclick="window.location.hash='#/equipo?id=${t.id}&liga=${ligaId}&name=${encodeURIComponent(t.name)}'"
                            style="cursor: pointer; transition: background 0.2s;"
                            onmouseover="this.style.background='rgba(255,255,255,0.05)'"
                            onmouseout="this.style.background='transparent'">
                            <td class="col-pos">${entry.pos}</td>
                            <td class="col-team">${imgLogo} <span>${t.name}</span></td>
                            <td>${entry.stats.pj}</td>
                            <td>${entry.stats.pg}</td>
                            <td>${entry.stats.pe}</td>
                            <td>${entry.stats.pp}</td>
                            <td class="col-pts">${entry.stats.pts}</td>
                        </tr>
                    `;
                }).join('');

                standingsBox.querySelector('.table-responsive').innerHTML = `
                    <table class="standings-table">
                        <thead><tr><th class="col-pos">#</th><th>Equipo</th><th>PJ</th><th>PG</th><th>PE</th><th>PP</th><th class="col-pts">PTS</th></tr></thead>
                        <tbody>${rowsHtml}</tbody>
                    </table>
                `;
            } else {
                // Sin tabla → es una copa de eliminación directa. En vez del cartel vacío,
                // mostramos el CALENDARIO completo del torneo (todos los partidos del año).
                const titulo = standingsBox.querySelector('.panel-title');
                if (titulo) titulo.textContent = '📅 Calendario';
                const cont = standingsBox.querySelector('.table-responsive');

                let fixture = [];
                try { fixture = await ESPN.getCalendario(ligaId); } catch {}

                if (!fixture.length) {
                    cont.innerHTML = `<p style="color: var(--text-muted); padding: 10px;">Calendario no disponible temporalmente.</p>`;
                } else {
                    const fmtF = (d) => new Date(d).toLocaleDateString('es-AR', { day: '2-digit', month: 'short' });
                    const fmtH = (d) => new Date(d).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hour12: false });
                    const eqHtml = (t, align) => {
                        const logo = t?.logo ? `<img src="${t.logo}" width="18" height="18" style="object-fit:contain;">` : '';
                        const nom  = t?.abbr ?? t?.name ?? '—';
                        const base = `display:flex;align-items:center;gap:6px;min-width:0;`;
                        const txt  = `<span style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${nom}</span>`;
                        return align === 'l'
                            ? `<span style="${base}">${logo}${txt}</span>`
                            : `<span style="${base}justify-content:flex-end;">${txt}${logo}</span>`;
                    };
                    const fila = (m) => {
                        const st     = m.status?.state;
                        const jugado = st === 'post' || st === 'in';
                        const vivo   = st === 'in';
                        const centro = jugado ? `${m.homeTeam?.score ?? '-'} - ${m.awayTeam?.score ?? '-'}` : fmtH(m.date);
                        return `
                            <div onclick="window.location.hash='#/partido?id=${m.id}&liga=${m.slug}'"
                                style="display:grid;grid-template-columns:38px 1fr 62px 1fr;gap:6px;align-items:center;padding:9px 6px;border-bottom:1px solid var(--border-glass);cursor:pointer;font-size:0.85rem;transition:background 0.2s;"
                                onmouseover="this.style.background='rgba(255,255,255,0.04)'" onmouseout="this.style.background='transparent'">
                                <span style="font-size:0.7rem;color:var(--text-muted);line-height:1.15;">${fmtF(m.date)}</span>
                                ${eqHtml(m.homeTeam, 'l')}
                                <span style="text-align:center;font-weight:700;font-family:var(--font-heading);white-space:nowrap;color:${vivo ? '#ff4757' : 'inherit'};">${centro}${vivo && m.status?.clock ? ` <span style="font-size:0.6rem;">${m.status.clock}</span>` : ''}</span>
                                ${eqHtml(m.awayTeam, 'r')}
                            </div>`;
                    };
                    // Próximos (en vivo + por jugar) arriba; resultados abajo, más reciente primero.
                    const prox    = fixture.filter(m => m.status?.state !== 'post');
                    const jugados = fixture.filter(m => m.status?.state === 'post').reverse();
                    const seccion = (label, arr) => arr.length
                        ? `<div style="font-size:0.72rem;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:var(--accent-neon);margin:14px 4px 4px;">${label}</div>${arr.map(fila).join('')}`
                        : '';
                    cont.innerHTML = `<div style="max-height:520px;overflow-y:auto;">
                        ${seccion('Próximos', prox)}
                        ${seccion('Resultados', jugados)}
                    </div>`;
                }
            }

            if (partidosRaw && partidosRaw.length > 0) {
                let matchesHtml = partidosRaw.map(partido => {
                    const statusDesc = partido.status?.description ?? partido.status?.state ?? '';
                    const isLive     = partido.status?.state === 'in' || statusDesc.toLowerCase().includes("'");
                    const liveBadge  = isLive ? `<span style="color: #ff4757; font-size: 0.7rem; font-weight: bold; animation: pulse 1s infinite; margin-left: 6px;">● VIVO</span>` : '';
                    const homeLogoHtml = partido.homeTeam?.logo ? `<img src="${partido.homeTeam.logo}" width="18" height="18" style="object-fit:contain; margin-right:6px; vertical-align:middle;">` : '';
                    const awayLogoHtml = partido.awayTeam?.logo ? `<img src="${partido.awayTeam.logo}" width="18" height="18" style="object-fit:contain; margin-right:6px; vertical-align:middle;">` : '';

                    return `
                        <div class="match-item">
                            <div style="display: flex; justify-content: space-between; align-items: center; font-size: 0.95rem; font-weight: 500;">
                                <div style="display: flex; flex-direction: column; gap: 4px;">
                                    <span>${homeLogoHtml}${partido.homeTeam?.name ?? '—'}</span>
                                    <span>${awayLogoHtml}${partido.awayTeam?.name ?? '—'}</span>
                                </div>
                                <div style="display: flex; flex-direction: column; gap: 4px; text-align: right; font-family: var(--font-heading); font-weight: 700; color: var(--accent-neon);">
                                    <span>${partido.homeTeam?.score ?? '-'}</span>
                                    <span>${partido.awayTeam?.score ?? '-'}</span>
                                </div>
                            </div>
                            <span style="font-size: 0.75rem; color: var(--text-muted); display: block; margin-top: 4px; text-transform: uppercase;">
                                ${statusDesc} ${liveBadge}
                            </span>
                        </div>
                    `;
                }).join('');

                matchesBox.innerHTML = `<h3 class="panel-title" style="color: ${ligaData.badge_color};">Resultados / Marcadores</h3><div class="match-list" style="max-height: 450px; overflow-y: auto;">${matchesHtml}</div>`;
            }
        } catch (err) { console.error("Error cargando datos de liga:", err); }
    };

    // ── VISTA MUNDIAL: FASE DE GRUPOS (GENERAL) ──────────
    const renderCalendarioMundial = async (ligaData) => {
        appContainer.innerHTML = `
            ${renderNavbar('#/liga?id=' + ligaData.id)}
            <main class="page-container fade-in" style="display: flex; justify-content: center; align-items: center; height: 75vh; flex-direction: column;">
                <div style="width: 45px; height: 45px; border: 4px solid var(--accent-neon); border-right-color: transparent; border-radius: 50%; animation: spin 1s linear infinite;"></div>
                <p style="margin-top: 1.5rem; color: var(--accent-neon); font-family: var(--font-heading); text-transform: uppercase; letter-spacing: 1px; font-weight: bold;">Sincronizando grupos en vivo...</p>
                <style>@keyframes spin { 100% { transform: rotate(360deg); } }</style>
            </main>
        ${_closeSidebarWrapper()}
        `;

        let gruposData = [];
        const CF_WORKER = 'https://whistle.solgoyhe.workers.dev';

        try {
            const espnUrl      = 'https://site.api.espn.com/apis/v2/sports/soccer/fifa.world/standings';
            const espnProxyUrl = `${CF_WORKER}/?url=${encodeURIComponent(espnUrl)}`;
            const respuestaEspn = await fetch(espnProxyUrl);
            if (!respuestaEspn.ok) throw new Error('ESPN Standings falló');

            const parsedEspn = await respuestaEspn.json();

            if (parsedEspn.children && parsedEspn.children.length > 0) {
                gruposData = parsedEspn.children.map(grupo => {
                    const equipos = grupo.standings?.entries?.map(e => {
                        const stats    = e.stats || [];
                        const findStat = (name) => stats.find(s => s.name === name)?.value || 0;
                        return {
                            id:     e.team.id,
                            nombre: e.team.name,
                            logo:   e.team.logos?.[0]?.href || '🌐',
                            pj:     findStat('gamesPlayed'),
                            pg:     findStat('wins'),
                            pe:     findStat('ties'),
                            pp:     findStat('losses'),
                            gf:     findStat('pointsFor'),
                            gc:     findStat('pointsAgainst'),
                            dif:    findStat('pointDifferential'),
                            pts:    findStat('points')
                        };
                    }) || [];

                    equipos.sort((a, b) => b.pts - a.pts || b.dif - a.dif);
                    return { nombre: grupo.name.replace(/Group /i, 'GRUPO ').toUpperCase(), equipos };
                });
                gruposData.sort((a, b) => a.nombre.localeCompare(b.nombre));
            } else {
                throw new Error('Array de grupos vacío');
            }
        } catch (error) {
            const mockEquipos = {
                'GRUPO A': [{n:'México',        fl:'🇲🇽', id:'203'}, {n:'Sudáfrica',     fl:'🇿🇦', id:'467'}, {n:'Corea del Sur', fl:'🇰🇷', id:'451'}, {n:'Czechia',        fl:'🇨🇿', id:'450'}],
                'GRUPO B': [{n:'Canadá',        fl:'🇨🇦', id:'206'}, {n:'Suiza',         fl:'🇨🇭', id:'475'}, {n:'Catar',         fl:'🇶🇦', id:'4398'},{n:'Bosnia-Herz.',   fl:'🇧🇦', id:'452'}],
                'GRUPO C': [{n:'Brasil',        fl:'🇧🇷', id:'205'}, {n:'Marruecos',     fl:'🇲🇦', id:'2869'},{n:'Haití',         fl:'🇭🇹', id:'2654'},{n:'Escocia',        fl:'🏴󠁧󠁢󠁳󠁣󠁴󠁿', id:'580'}],
                'GRUPO D': [{n:'Estados Unidos',fl:'🇺🇸', id:'660'}, {n:'Paraguay',      fl:'🇵🇾', id:'210'}, {n:'Australia',     fl:'🇦🇺', id:'628'}, {n:'Türkiye',        fl:'🇹🇷', id:'465'}],
                'GRUPO E': [{n:'Alemania',      fl:'🇩🇪', id:'481'}, {n:'Curaçao',       fl:'🇨🇼', id:'11678'},{n:'Costa de Marfil',fl:'🇨🇮', id:'4789'},{n:'Ecuador',       fl:'🇪🇨', id:'209'}],
                'GRUPO F': [{n:'Países Bajos',  fl:'🇳🇱', id:'449'}, {n:'Japón',         fl:'🇯🇵', id:'627'}, {n:'Suecia',        fl:'🇸🇪', id:'466'}, {n:'Túnez',          fl:'🇹🇳', id:'659'}],
                'GRUPO G': [{n:'Bélgica',       fl:'🇧🇪', id:'459'}, {n:'Egipto',        fl:'🇪🇬', id:'2620'},{n:'Irán',          fl:'🇮🇷', id:'469'}, {n:'Nueva Zelanda',  fl:'🇳🇿', id:'2666'}],
                'GRUPO H': [{n:'España',        fl:'🇪🇸', id:'164'}, {n:'Cabo Verde',    fl:'🇨🇻', id:'2597'},{n:'Arabia Saudita',fl:'🇸🇦', id:'655'}, {n:'Uruguay',        fl:'🇺🇾', id:'212'}],
                'GRUPO I': [{n:'Francia',       fl:'🇫🇷', id:'478'}, {n:'Senegal',       fl:'🇸🇳', id:'654'}, {n:'Noruega',       fl:'🇳🇴', id:'464'}, {n:'Irak',           fl:'🇮🇶', id:'4375'}],
                'GRUPO J': [{n:'Argentina',     fl:'🇦🇷', id:'202'}, {n:'Argelia',       fl:'🇩🇿', id:'624'}, {n:'Austria',       fl:'🇦🇹', id:'474'}, {n:'Jordania',       fl:'🇯🇴', id:'2917'}],
                'GRUPO K': [{n:'Portugal',      fl:'🇵🇹', id:'482'}, {n:'Congo RD',      fl:'🇨🇩', id:'2850'},{n:'Uzbekistán',    fl:'🇺🇿', id:'2570'},{n:'Colombia',       fl:'🇨🇴', id:'208'}],
                'GRUPO L': [{n:'Inglaterra',    fl:'🏴󠁧󠁢󠁥󠁮󠁧󠁿', id:'448'}, {n:'Croacia',       fl:'🇭🇷', id:'477'}, {n:'Ghana',         fl:'🇬🇭', id:'4469'},{n:'Panamá',         fl:'🇵🇦', id:'2659'}],
            };

            for (const [nombreGrupo, equiposArr] of Object.entries(mockEquipos)) {
                gruposData.push({
                    nombre:  nombreGrupo,
                    equipos: equiposArr.map(eq => ({ id: eq.id, nombre: eq.n, logo: eq.fl, pj: 0, pts: 0, dif: 0 }))
                });
            }
            gruposData.sort((a, b) => a.nombre.localeCompare(b.nombre));
        }

        // Calcular mejores terceros (el 3ro de cada grupo)
        const tercerosPorGrupo = gruposData
            .map(grupo => {
                const tercero = grupo.equipos[2]; // índice 2 = 3er clasificado
                if (!tercero) return null;
                return { ...tercero, grupo: grupo.nombre };
            })
            .filter(Boolean);

        // Ordenar por pts → dif → gf
        tercerosPorGrupo.sort((a, b) =>
            b.pts - a.pts || b.dif - a.dif || (b.gf ?? 0) - (a.gf ?? 0)
        );

        const mejoresTerceros = tercerosPorGrupo.slice(0, 8);

        // Tabla de mejores terceros
        const _buildTerceroRow = (eq, idx) => {
            const logoHtml = (eq.logo || '').includes('http')
                ? `<img src="${eq.logo}" width="20" height="20" style="object-fit:contain; margin-right:8px;">`
                : `<span style="font-size:1rem; margin-right:8px;">${eq.logo || ''}</span>`;
            const color  = idx < 8 ? '#cd7f32' : 'var(--text-muted)';
            const bgBase = idx < 8 ? 'rgba(205,127,50,0.04)' : 'transparent';
            const dif    = eq.dif ?? 0;
            return `
                <tr style="border-bottom:1px solid rgba(255,255,255,0.04); cursor:pointer;
                    background:${bgBase}; transition:background 0.2s;"
                    onmouseover="this.style.background='rgba(255,255,255,0.06)'"
                    onmouseout="this.style.background='${bgBase}'"
                    onclick="window.location.hash='#/equipo?id=${eq.id}&liga=world_cup&name=${encodeURIComponent(eq.nombre)}'">
                    <td style="padding:8px 4px; font-weight:800; color:${color};">${idx+1}</td>
                    <td style="padding:8px 4px; display:flex; align-items:center;">${logoHtml}<span style="font-weight:500;">${eq.nombre}</span></td>
                    <td style="padding:8px 4px; text-align:center; color:var(--text-muted); font-size:0.75rem;">${(eq.grupo || '').replace('GRUPO ','')}</td>
                    <td style="padding:8px 4px; text-align:center;">${eq.pj ?? 0}</td>
                    <td style="padding:8px 4px; text-align:center; font-weight:800; color:${color};">${eq.pts ?? 0}</td>
                    <td style="padding:8px 4px; text-align:center; font-weight:600;">${dif > 0 ? '+'+dif : dif}</td>
                </tr>`;
        };

        const tablaTercerosHtml = `
            <div class="glass-panel" style="padding:1.5rem; margin-top:2rem;">
                <h3 style="font-family:var(--font-heading); font-size:0.85rem; font-weight:800;
                    text-transform:uppercase; letter-spacing:2px; color:#cd7f32; margin-bottom:1rem;
                    padding-bottom:8px; border-bottom:1px solid rgba(205,127,50,0.3);">
                    🥉 MEJORES TERCEROS — Top 8 clasificados a Octavos
                </h3>
                <div class="table-responsive">
                    <table style="width:100%; border-collapse:collapse; font-size:0.85rem;">
                        <thead>
                            <tr style="color:var(--text-muted); font-size:0.75rem; text-transform:uppercase; border-bottom:1px solid var(--border-glass);">
                                <th style="padding:8px 4px; text-align:left; width:30px;">#</th>
                                <th style="padding:8px 4px; text-align:left;">Selección</th>
                                <th style="padding:8px 4px; text-align:center; width:45px;">Grupo</th>
                                <th style="padding:8px 4px; text-align:center; width:40px;">PJ</th>
                                <th style="padding:8px 4px; text-align:center; width:40px;">PTS</th>
                                <th style="padding:8px 4px; text-align:center; width:40px;">DIF</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${mejoresTerceros.map((eq, idx) => _buildTerceroRow(eq, idx)).join('')}
                        </tbody>
                    </table>
                </div>
                <p style="font-size:0.72rem; color:var(--text-muted); margin-top:0.8rem; text-align:center;">
                    Los 8 mejores terceros clasifican a Octavos de Final junto a los 24 primeros y segundos de grupo.
                </p>
            </div>
        `;

        let grillaGruposHtml = gruposData.map(grupo => {
            let filasTabla = grupo.equipos.map((eq, index) => {
                const logoHtml = eq.logo.includes('http')
                    ? `<img src="${eq.logo}" width="20" height="20" style="object-fit: contain; margin-right: 8px;">`
                    : `<span style="font-size:1.1rem; margin-right: 8px;">${eq.logo}</span>`;
                return `
                    <tr style="border-bottom: 1px solid rgba(255,255,255,0.03); cursor: pointer; transition: background 0.2s;"
                        onmouseover="this.style.background='rgba(255,255,255,0.05)'"
                        onmouseout="this.style.background='transparent'"
                        onclick="window.location.hash='#/equipo?id=${eq.id}&liga=world_cup&name=${encodeURIComponent(eq.nombre)}'; event.stopPropagation();">
                        <td style="padding: 8px 4px; font-weight: bold; color: var(--text-muted);">${index + 1}</td>
                        <td style="padding: 8px 4px; display: flex; align-items: center; font-weight: 500;">
                            ${logoHtml} <span style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 130px;">${eq.nombre}</span>
                        </td>
                        <td style="padding: 8px 4px; text-align: center; color: var(--text-muted);">${eq.pj}</td>
                        <td style="padding: 8px 4px; text-align: center; font-weight: bold; color: var(--accent-neon);">${eq.pts}</td>
                    </tr>
                `;
            }).join('');

            return `
                <div class="glass-panel" style="padding: 1.2rem; min-height: 220px; transition: transform 0.2s;">
                    <h3 class="panel-title" style="text-align: center; color: var(--accent-neon); border-bottom: 1px solid var(--border-glass); padding-bottom: 8px; margin-bottom: 12px; font-size: 1.2rem; letter-spacing: 1px; cursor: pointer;"
                        onclick="window.location.hash='#/grupo?id=${encodeURIComponent(grupo.nombre)}'">
                        ${grupo.nombre} <span style="font-size: 0.8rem; color: var(--text-muted);">↗</span>
                    </h3>
                    <div class="table-responsive">
                        <table style="width: 100%; border-collapse: collapse; font-size: 0.9rem;">
                            <thead>
                                <tr style="color: var(--text-muted); font-size: 0.8rem; text-transform: uppercase; border-bottom: 1px solid var(--border-glass);">
                                    <th style="text-align: left; padding: 4px; width: 30px;">#</th>
                                    <th style="text-align: left; padding: 4px;">Equipo</th>
                                    <th style="text-align: center; padding: 4px; width: 40px;">PJ</th>
                                    <th style="text-align: center; padding: 4px; width: 40px;">PTS</th>
                                </tr>
                            </thead>
                            <tbody>${filasTabla}</tbody>
                        </table>
                    </div>
                </div>
            `;
        }).join('');

        appContainer.innerHTML = `
            ${renderNavbar('#/liga?id=' + ligaData.id)}
            <main class="page-container fade-in">
                <a href="#/ligas" style="color: var(--text-muted); text-decoration: none; display: inline-block; margin-bottom: 1.5rem; font-weight: 600;">← Volver a Ligas</a>
                <div class="liga-header" style="border-left: 6px solid ${ligaData.badge_color}; background: radial-gradient(circle at left, rgba(200, 168, 75, 0.12) 0%, transparent 60%);">
                    <span class="liga-flag-large" style="font-size: 3.8rem; filter: drop-shadow(0 0 10px rgba(200,168,75,0.3));">${ligaData.flag}</span>
                    <div>
                        <h1 class="liga-title-main">FIFA World Cup 2026</h1>
                        <span style="color: var(--accent-neon); font-weight: 800; letter-spacing: 1px; font-size: 0.85rem;">🏆 DATOS EN VIVO</span>
                    </div>
                </div>

                <!-- Tabs -->
                <div style="display:flex; gap:8px; margin:1.5rem 0 1rem;">
                    <button id="tab-grupos" onclick="window._mundialTab('grupos')"
                        style="padding:10px 24px; border-radius:20px; border:2px solid var(--accent-neon);
                        background:rgba(61,111,255,0.12); color:var(--accent-neon);
                        cursor:pointer; font-family:var(--font-heading); font-weight:700; font-size:0.9rem;">
                        🏟️ GRUPOS
                    </button>
                    <button id="tab-bracket" onclick="window._mundialTab('bracket')"
                        style="padding:10px 24px; border-radius:20px; border:2px solid var(--border-glass);
                        background:rgba(255,255,255,0.04); color:var(--text-muted);
                        cursor:pointer; font-family:var(--font-heading); font-weight:700; font-size:0.9rem;">
                        🏆 BRACKET
                    </button>
                </div>

                <!-- Contenido de tabs -->
                <div id="mundial-tab-content">
                    <p style="text-align: center; color: var(--text-muted); font-size: 0.85rem; margin-bottom: 1rem;">Seleccioná el título de un grupo para ver estadísticas detalladas o un equipo para ver sus jugadores.</p>
                    <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 1.5rem;">
                        ${grillaGruposHtml}
                    </div>
                    ${tablaTercerosHtml}
                </div>
            </main>
        ${_closeSidebarWrapper()}
        `;

        window._mundialTab = async (tab) => {
            const btnGrupos  = document.getElementById('tab-grupos');
            const btnBracket = document.getElementById('tab-bracket');
            const tabContent = document.getElementById('mundial-tab-content');
            if (!tabContent) return;

            [btnGrupos, btnBracket].forEach(b => {
                if (!b) return;
                b.style.border      = '2px solid var(--border-glass)';
                b.style.background  = 'rgba(255,255,255,0.04)';
                b.style.color       = 'var(--text-muted)';
            });
            const btnActivo = tab === 'grupos' ? btnGrupos : btnBracket;
            if (btnActivo) {
                btnActivo.style.border     = '2px solid var(--accent-neon)';
                btnActivo.style.background = 'rgba(61,111,255,0.12)';
                btnActivo.style.color      = 'var(--accent-neon)';
            }

            if (tab === 'grupos') {
                tabContent.innerHTML = `
                    <p style="text-align: center; color: var(--text-muted); font-size: 0.85rem; margin-bottom: 1rem;">Seleccioná el título de un grupo para ver estadísticas detalladas o un equipo para ver sus jugadores.</p>
                    <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 1.5rem;">
                        ${grillaGruposHtml}
                    </div>
                    ${tablaTercerosHtml}`;
            } else {
                await renderBracketMundial(tabContent);
            }
        };
    };

    // ── BRACKET MUNDIAL 2026 (SVG tipo llave clásica) ───────────────────────
    const renderBracketMundial = async (container) => {
        const CF_WORKER = 'https://whistle.solgoyhe.workers.dev';

        container.innerHTML = `
            <div style="text-align:center; padding:2rem;">
                <div style="width:36px; height:36px; border:3px solid var(--accent-neon); border-right-color:transparent; border-radius:50%; animation:spin 1s linear infinite; margin:0 auto;"></div>
                <p style="color:var(--accent-neon); margin-top:1rem; font-size:0.85rem;">Cargando bracket...</p>
            </div>`;

        // 5 rondas reales del Mundial 2026 (48 equipos → 32 clasifican a eliminación directa)
        const FASES_FECHAS = {
            r32:       ['20260628','20260629','20260630','20260701','20260702','20260703'], // Dieciseisavos (Round of 32) — 16 partidos (M73-M88)
            r16:       ['20260704','20260705','20260706','20260707'],                        // Octavos (Round of 16) — 8 partidos (M89-M96)
            cuartos:   ['20260709','20260710','20260711'],                                    // Cuartos de Final — 4 partidos (M97-M100)
            semis:     ['20260714','20260715'],                                               // Semifinales — 2 partidos (M101-M102)
            tercero:   ['20260718'],                                                          // Tercer puesto (M103)
            final:     ['20260719'],                                                          // Final (M104)
        };

        try {
            const todasFechas = [...new Set(Object.values(FASES_FECHAS).flat())];
            const scoreboards = await Promise.all(
                todasFechas.map(f =>
                    fetch(`${CF_WORKER}/?url=${encodeURIComponent(`https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard?dates=${f}`)}`)
                        .then(r => r.ok ? r.json().catch(()=>({})) : {})
                )
            );

            const eventosPorFecha = {};
            todasFechas.forEach((f, i) => { eventosPorFecha[f] = scoreboards[i]?.events ?? []; });

            // Mapeo oficial FIFA: número de partido → slot en el bracket
            // El orden en el SVG sigue el bracket oficial de izquierda a derecha
            // Dieciseisavos/R32 (M73-M88): 16 partidos, 8 por lado
            // Octavos/R16 (M89-M96): 8 partidos, 4 por lado
            // Cuartos (M97-M100): 4 partidos, 2 por lado
            // Semifinal (M101-M102): 2 partidos, 1 por lado
            // Tercero: M103, Final: M104

            // Construir mapa de todos los eventos por número de partido (ESPN usa "name" o "shortName" con el número)
            const todosEventos = Object.values(eventosPorFecha).flat();
            const vistos = new Set();
            const unicos = todosEventos.filter(ev => { if(vistos.has(ev.id)) return false; vistos.add(ev.id); return true; });

            // Sede fija por partido (para Cuartos y Semis, que todavía no tienen
            // equipos definidos — no podemos matchear por nombre porque son "Ganador de...").
            const _sedeTexto = (ev) => {
                const v = ev?.competitions?.[0]?.venue;
                return `${v?.fullName || ''} ${v?.address?.city || ''} ${v?.address?.state || ''}`.toLowerCase();
            };
            const _lado = (ev, izqKw, derKw) => {
                const t = _sedeTexto(ev);
                if (izqKw.some(kw => t.includes(kw))) return 'I';
                if (derKw.some(kw => t.includes(kw))) return 'D';
                return null;
            };
            const _dividirLados = (evs, izqKw, derKw, mitad) => {
                const izq = [], der = [], sinSede = [];
                evs.forEach(ev => {
                    const l = _lado(ev, izqKw, derKw);
                    if (l === 'I') izq.push(ev);
                    else if (l === 'D') der.push(ev);
                    else sinSede.push(ev);
                });
                sinSede.forEach(ev => { (izq.length < mitad ? izq : der).push(ev); });
                return { izq: izq.slice(0, mitad), der: der.slice(0, mitad) };
            };

            // Para 16avos y Octavos SÍ conocemos los equipos reales (ya se jugaron),
            // así que en vez de adivinar por sede/fecha, matcheamos directo por nombre
            // de equipo contra el cruce oficial FIFA. Esto es exacto y no depende del
            // orden en que ESPN devuelva los partidos.
            const _nombresEquipo = (ev) => {
                const comp = ev?.competitions?.[0];
                const home = comp?.competitors?.find(c => c.homeAway === 'home')?.team;
                const away = comp?.competitors?.find(c => c.homeAway === 'away')?.team;
                return [home, away].flatMap(t => [t?.displayName, t?.shortDisplayName, t?.name, t?.location, t?.abbreviation])
                    .filter(Boolean).map(s => s.toLowerCase());
            };
            // Alias para equipos cuyo nombre puede venir distinto en ESPN
            const ALIAS = {
                'usa': ['usa','united states','estados unidos'],
                'bosnia': ['bosnia','herzegovina'],
                'costa de marfil': ['ivory coast','costa de marfil',"cote d'ivoire","côte d'ivoire",'cote divoire'],
                'congo rd': ['congo dr','dr congo','congo rd','democratic republic of the congo'],
                'cabo verde': ['cabo verde','cape verde'],
            };
            const _esEquipo = (nombres, clave) => {
                const variantes = ALIAS[clave] || [clave];
                return nombres.some(n => variantes.some(v => n.includes(v)));
            };
            // Asigna eventos a pares [equipoA, equipoB] en un orden fijo, consumiendo
            // del pool a medida que encuentra matches. Si no encuentra un partido para
            // un slot (nombre distinto al esperado, etc.) deja null en vez de adivinar mal.
            const _asignarPorEquipos = (evs, pares) => {
                const pool = [...evs];
                return pares.map(([a, b]) => {
                    const idx = pool.findIndex(ev => {
                        const nombres = _nombresEquipo(ev);
                        return _esEquipo(nombres, a) && _esEquipo(nombres, b);
                    });
                    if (idx === -1) return null;
                    return pool.splice(idx, 1)[0];
                });
            };

            const _byFase = (fase) => {
                const fechas = FASES_FECHAS[fase];
                const evs = fechas.flatMap(f => eventosPorFecha[f] ?? []);
                const seen = new Set();
                return evs.filter(ev => { if(seen.has(ev.id)) return false; seen.add(ev.id); return true; })
                           .sort((a,b) => new Date(a.date) - new Date(b.date));
            };

            const r32     = _byFase('r32');     // 16 partidos (M73-M88) — Dieciseisavos
            const octavos = _byFase('r16');     // 8 partidos  (M89-M96) — Octavos
            const cuartos = _byFase('cuartos'); // 4 partidos  (M97-M100) — Cuartos
            const semis   = _byFase('semis');   // 2 partidos  (M101-M102) — Semifinal real
            const tercero = _byFase('tercero'); // 1 partido   (M103)
            const final_  = _byFase('final');   // 1 partido   (M104)

            // Cruce oficial FIFA de 16avos → Octavos (equipos reales, ya jugados y fijos):
            // pares consecutivos (0,1)→feed oct[0], (2,3)→feed oct[1], etc.
            const R32_IZQ_PARES = [
                ['south africa','canada'], ['netherlands','morocco'],       // → M90 CAN-MAR
                ['germany','paraguay'],    ['france','sweden'],             // → M89 PAR-FRA
                ['portugal','croatia'],    ['spain','austria'],             // → M93 POR-ESP
                ['usa','bosnia'],          ['belgium','senegal'],           // → M94 USA-BEL
            ];
            const R32_DER_PARES = [
                ['brazil','japan'],        ['costa de marfil','norway'],    // → M91 BRA-NOR
                ['mexico','ecuador'],      ['england','congo rd'],          // → M92 MEX-ENG
                ['argentina','cabo verde'],['australia','egypt'],           // → M95 ARG-EGY
                ['switzerland','algeria'], ['colombia','ghana'],            // → M96 SUI-COL
            ];
            const OCT_IZQ_PARES = [
                ['canada','morocco'], ['paraguay','france'],   // → cuartos M97
                ['portugal','spain'], ['usa','belgium'],       // → cuartos M98
            ];
            const OCT_DER_PARES = [
                ['brazil','norway'], ['mexico','england'],     // → cuartos M99
                ['argentina','egypt'], ['switzerland','colombia'], // → cuartos M100
            ];

            const r32_izq = _asignarPorEquipos(r32, R32_IZQ_PARES);
            const r32_der = _asignarPorEquipos(r32, R32_DER_PARES);
            const oct_izq = _asignarPorEquipos(octavos, OCT_IZQ_PARES);
            const oct_der = _asignarPorEquipos(octavos, OCT_DER_PARES);

            // Cuartos y Semis todavía no tienen equipos definidos ("Ganador de..."),
            // así que ahí sí usamos sede fija (confirmado con fixtures reales):
            const QF_IZQ  = ['boston','foxborough','gillette','los angeles','inglewood','sofi'];
            const QF_DER  = ['miami','hard rock','kansas city','arrowhead'];

            const SF_IZQ  = ['dallas','arlington'];
            const SF_DER  = ['atlanta'];

            const { izq: cua_izq, der: cua_der } = _dividirLados(cuartos, QF_IZQ, QF_DER, 2);
            const { izq: sem_izq, der: sem_der } = _dividirLados(semis, SF_IZQ, SF_DER, 1);


            // ── SVG dimensions ────────────────────────────────────────────────
            // Ahora hay 4 columnas por lado (16avos, 8vos, cuartos, semifinal) + final al centro
            const W      = 1360;
            const H      = 820;
            const BW     = 95;  // box width
            const BH     = 34;  // box height
            const GAP    = 3;   // gap between home/away
            const MATCHH = BH * 2 + GAP; // total match height

            // ── Helper: info de partido ────────────────────────────────────────
            const _info = (ev) => {
                if (!ev) return { home: '?', away: '?', hs: '', as_: '', live: false, post: false, id: '', nota: '' };
                const comp   = ev.competitions?.[0];
                const home   = comp?.competitors?.find(c => c.homeAway === 'home');
                const away   = comp?.competitors?.find(c => c.homeAway === 'away');
                const state  = comp?.status?.type?.state ?? 'pre';
                const detail = comp?.status?.type?.shortDetail ?? '';
                const period = comp?.status?.period ?? 0;

                // Detectar penales y alargue desde shortDetail o period
                const esPen   = /pen/i.test(detail) || /shoot/i.test(detail);
                const esAET   = /aet/i.test(detail) || /extra/i.test(detail) || period > 2;
                let nota = '';
                if (state === 'post') {
                    if (esPen)      nota = 'PEN';
                    else if (esAET) nota = 'AET';
                }

                const hs = home?.score ?? '';
                const as_ = away?.score ?? '';
                const hsN = parseInt(hs || '0');
                const asN = parseInt(as_ || '0');

                return {
                    id:   ev.id,
                    home: home?.team?.abbreviation ?? home?.team?.shortDisplayName ?? (home?.team?.displayName ? home.team.displayName.substring(0,8) : '·'),
                    away: away?.team?.abbreviation ?? away?.team?.shortDisplayName ?? (away?.team?.displayName ? away.team.displayName.substring(0,8) : '·'),
                    hs, as_, nota,
                    hl:   home?.team?.logo ?? '',
                    al:   away?.team?.logo ?? '',
                    live: state === 'in',
                    post: state === 'post',
                    hw:   state === 'post' && hsN > asN,
                    aw:   state === 'post' && asN > hsN,
                };
            };

            // ── Helper: dibujar caja de partido ───────────────────────────────
            const _match = (x, y, ev, label = '') => {
                const d = _info(ev);
                const id = d.id;
                const cursor = id ? 'cursor:pointer;' : '';
                const onclick = id ? `onclick="window.location.hash='#/partido?id=${id}&liga=world_cup'"` : '';

                const _row = (name, score, logo, win, isHome) => {
                    const ry = isHome ? y : y + BH + GAP;
                    const isPending = (name === '?' || name === '·' || name === '');
                    const fill    = win ? '#3D6FFF' : isPending ? 'rgba(255,255,255,0.25)' : '#ffffff';
                    const bgFill  = win ? 'rgba(61,111,255,0.15)' : isPending ? 'rgba(255,255,255,0.03)' : 'rgba(30,30,50,0.95)';
                    const weight  = win ? '700' : isPending ? '400' : '500';
                    return `
                        <rect x="${x}" y="${ry}" width="${BW}" height="${BH}" rx="4"
                            fill="${bgFill}" stroke="${win ? '#3D6FFF' : 'rgba(255,255,255,0.15)'}" stroke-width="${win?1.5:1}"/>
                        ${logo ? `<image href="${logo}" x="${x+5}" y="${ry+9}" width="18" height="18" style="object-fit:contain;"/>` : ''}
                        <text x="${x + (logo?26:8)}" y="${ry + BH/2 + 1}" dominant-baseline="middle"
                            font-family="system-ui" font-size="10" font-weight="${weight}" fill="${fill}">
                            ${name.substring(0,10)}
                        </text>
                        ${score !== '' ? `<text x="${x+BW-6}" y="${ry + BH/2 + 1}" dominant-baseline="middle" text-anchor="end"
                            font-family="system-ui" font-size="11" font-weight="800" fill="${win?'#3D6FFF':'#ffffff'}">${score}</text>` : ''}
                    `;
                };

                const liveBadge = d.live ? `
                    <rect x="${x}" y="${y-12}" width="${BW}" height="11" rx="3" fill="#ff4757"/>
                    <text x="${x + BW/2}" y="${y-5}" text-anchor="middle" dominant-baseline="middle"
                        font-family="system-ui" font-size="7" font-weight="800" fill="#fff">● EN VIVO</text>` : '';

                const labelEl = label ? `
                    <text x="${x + BW/2}" y="${y - (d.live?16:4)}" text-anchor="middle"
                        font-family="system-ui" font-size="8" fill="rgba(255,255,255,0.4)">${label}</text>` : '';

                // Badge PEN / AET
                const notaBadge = d.nota ? `
                    <rect x="${x + BW - 26}" y="${y + MATCHH - 2}" width="24" height="10" rx="3"
                        fill="${d.nota==='PEN' ? 'rgba(245,195,59,0.25)' : 'rgba(61,111,255,0.2)'}"/>
                    <text x="${x + BW - 14}" y="${y + MATCHH + 4}" text-anchor="middle" dominant-baseline="middle"
                        font-family="system-ui" font-size="6.5" font-weight="800"
                        fill="${d.nota==='PEN' ? '#F5C33B' : '#3D6FFF'}">${d.nota}</text>` : '';

                return `
                    <g ${onclick} style="${cursor}" class="bracket-match">
                        ${labelEl}
                        ${liveBadge}
                        ${_row(d.home, d.hs, d.hl, d.hw, true)}
                        ${_row(d.away, d.as_, d.al, d.aw, false)}
                        ${notaBadge}
                    </g>`;
            };

            // ── Líneas de conexión ─────────────────────────────────────────────
            const _line = (x1, y1, x2, y2) =>
                `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="rgba(255,255,255,0.2)" stroke-width="1"/>`;

            const _connect = (fromX, fromY, toX, toY) => {
                const midX = (fromX + toX) / 2;
                return `<path d="M${fromX} ${fromY} H${midX} V${toY} H${toX}"
                    fill="none" stroke="rgba(255,255,255,0.2)" stroke-width="1"/>`;
            };

            // ── Layout ─────────────────────────────────────────────────────────
            // Izquierda: 8 (16avos) → 4 (8vos) → 2 (cuartos) → 1 (semifinal)
            // Derecha:   espejado igual
            // Centro: final + 3er puesto

            const COL_L1 = 10;               // 16avos izq
            const COL_L2 = COL_L1 + BW + 30;  // 8vos izq
            const COL_L3 = COL_L2 + BW + 30;  // cuartos izq
            const COL_L4 = COL_L3 + BW + 30;  // semifinal izq
            const COL_MID = W/2 - BW/2;       // final / centro
            const COL_R4  = W - COL_L4 - BW;  // semifinal der
            const COL_R3  = W - COL_L3 - BW;  // cuartos der
            const COL_R2  = W - COL_L2 - BW;  // 8vos der
            const COL_R1  = W - COL_L1 - BW;  // 16avos der

            // Y positions para 16avos izquierda (8 partidos)
            const spacingL1 = (H - 60) / 8;
            const ysL1 = Array.from({length:8}, (_,i) => 30 + i * spacingL1);

            // Y positions 8vos izq (4)
            const ysL2 = [0,1,2,3].map(i => (ysL1[i*2] + ysL1[i*2+1]) / 2 + MATCHH/4);

            // Y cuartos izq (2)
            const ysL3 = [0,1].map(i => (ysL2[i*2] + ysL2[i*2+1]) / 2);

            // Y semifinal izq (1)
            const ysL4 = [(ysL3[0] + ysL3[1]) / 2];

            // Y final (1)
            const yFinal = H/2 - MATCHH/2;

            // Y tercer puesto
            const yTercero = yFinal + MATCHH + 40;

            // Partidos SVG
            let matchesSVG = '';
            let linesSVG   = '';

            // ── 16avos izquierda (slots 0-7) ────────────────────────────────────
            for (let i = 0; i < 8; i++) {
                matchesSVG += _match(COL_L1, ysL1[i], r32_izq[i] ?? null, `P${i+1}`);
                const fromY = ysL1[i] + MATCHH / 2;
                const toY   = ysL2[Math.floor(i/2)] + MATCHH / 2;
                linesSVG += _connect(COL_L1 + BW, fromY, COL_L2, toY);
            }

            // ── 8vos izquierda (4) ───────────────────────────────────────────────
            for (let i = 0; i < 4; i++) {
                matchesSVG += _match(COL_L2, ysL2[i], oct_izq[i] ?? null);
                const fromY = ysL2[i] + MATCHH / 2;
                const toY   = ysL3[Math.floor(i/2)] + MATCHH / 2;
                linesSVG += _connect(COL_L2 + BW, fromY, COL_L3, toY);
            }

            // ── Cuartos izquierda (2) ────────────────────────────────────────────
            for (let i = 0; i < 2; i++) {
                matchesSVG += _match(COL_L3, ysL3[i], cua_izq[i] ?? null);
                const fromY = ysL3[i] + MATCHH / 2;
                const toY   = ysL4[0] + MATCHH / 2;
                linesSVG += _connect(COL_L3 + BW, fromY, COL_L4, toY);
            }

            // ── Semifinal izquierda (1) ──────────────────────────────────────────
            {
                matchesSVG += _match(COL_L4, ysL4[0], sem_izq[0] ?? null);
                const fromY = ysL4[0] + MATCHH / 2;
                linesSVG += _connect(COL_L4 + BW, fromY, COL_MID, yFinal + MATCHH/2);
            }

            // ── Final ──────────────────────────────────────────────────────────
            matchesSVG += _match(COL_MID, yFinal, final_[0] ?? null, 'FINAL');

            // ── Tercer puesto ──────────────────────────────────────────────────
            matchesSVG += _match(COL_MID, yTercero, tercero[0] ?? null, '3er PUESTO');

            // ── 16avos derecha (slots 8-15) ──────────────────────────────────────
            const ysR1  = [...ysL1];
            for (let i = 0; i < 8; i++) {
                matchesSVG += _match(COL_R1, ysR1[i], r32_der[i] ?? null, `P${i+9}`);
                const fromY = ysR1[i] + MATCHH / 2;
                const toY   = ysL2[Math.floor(i/2)] + MATCHH / 2;
                linesSVG += _connect(COL_R2 + BW, toY, COL_R1, fromY);
            }

            // ── 8vos derecha (4) ─────────────────────────────────────────────────
            for (let i = 0; i < 4; i++) {
                matchesSVG += _match(COL_R2, ysL2[i], oct_der[i] ?? null);
                const fromY = ysL2[i] + MATCHH / 2;
                const toY   = ysL3[Math.floor(i/2)] + MATCHH / 2;
                linesSVG += _connect(COL_R3 + BW, toY, COL_R2, fromY);
            }

            // ── Cuartos derecha (2) ──────────────────────────────────────────────
            for (let i = 0; i < 2; i++) {
                matchesSVG += _match(COL_R3, ysL3[i], cua_der[i] ?? null);
                const fromY = ysL3[i] + MATCHH / 2;
                const toY   = ysL4[0] + MATCHH / 2;
                linesSVG += _connect(COL_R4 + BW, toY, COL_R3, fromY);
            }

            // ── Semifinal derecha (1) ────────────────────────────────────────────
            {
                matchesSVG += _match(COL_R4, ysL4[0], sem_der[0] ?? null);
                const fromY = ysL4[0] + MATCHH / 2;
                linesSVG += _connect(COL_MID + BW, yFinal + MATCHH/2, COL_R4, fromY);
            }

            // ── Copa en el centro ──────────────────────────────────────────────
            const trofeX = W/2;
            const trofeY = yFinal - 55;
            const trofeSVG = `
                <text x="${trofeX}" y="${trofeY}" text-anchor="middle" font-size="36">🏆</text>
                <text x="${trofeX}" y="${trofeY + 22}" text-anchor="middle" font-family="system-ui"
                    font-size="9" font-weight="800" letter-spacing="2" fill="rgba(200,168,75,0.8)">
                    FIFA WORLD CUP 2026
                </text>`;

            container.innerHTML = `
                <div style="overflow-x:auto; overflow-y:hidden; padding:0.5rem; -webkit-overflow-scrolling:touch;">
                    <svg viewBox="0 0 ${W} ${H+60}" xmlns="http://www.w3.org/2000/svg"
                        style="width:${W}px; min-width:${W}px; display:block; background:rgba(0,0,0,0.2); border-radius:12px;">
                        <defs>
                            <style>
                                .bracket-match { cursor: pointer; }
                                .bracket-match:hover rect { filter: brightness(1.3); }
                            </style>
                        </defs>

                        <!-- Fondo -->
                        <rect width="${W}" height="${H+60}" fill="rgba(10,10,20,0.8)" rx="12"/>

                        <!-- Líneas -->
                        ${linesSVG}

                        <!-- Copa -->
                        ${trofeSVG}

                        <!-- Partidos -->
                        ${matchesSVG}

                        <!-- Labels de fases -->
                        <text x="${COL_L1 + BW/2}" y="16" text-anchor="middle" font-family="system-ui" font-size="8" font-weight="800" fill="#6CABDD" letter-spacing="1">16AVOS</text>
                        <text x="${COL_L2 + BW/2}" y="16" text-anchor="middle" font-family="system-ui" font-size="8" font-weight="800" fill="#6CABDD" letter-spacing="1">OCTAVOS</text>
                        <text x="${COL_L3 + BW/2}" y="16" text-anchor="middle" font-family="system-ui" font-size="8" font-weight="800" fill="#3D6FFF" letter-spacing="1">CUARTOS</text>
                        <text x="${COL_L4 + BW/2}" y="16" text-anchor="middle" font-family="system-ui" font-size="8" font-weight="800" fill="#ffd700" letter-spacing="1">SEMIS</text>
                        <text x="${COL_MID + BW/2}" y="16" text-anchor="middle" font-family="system-ui" font-size="8" font-weight="800" fill="#ffd700" letter-spacing="1">FINAL</text>
                        <text x="${COL_R4 + BW/2}" y="16" text-anchor="middle" font-family="system-ui" font-size="8" font-weight="800" fill="#ffd700" letter-spacing="1">SEMIS</text>
                        <text x="${COL_R3 + BW/2}" y="16" text-anchor="middle" font-family="system-ui" font-size="8" font-weight="800" fill="#3D6FFF" letter-spacing="1">CUARTOS</text>
                        <text x="${COL_R2 + BW/2}" y="16" text-anchor="middle" font-family="system-ui" font-size="8" font-weight="800" fill="#6CABDD" letter-spacing="1">OCTAVOS</text>
                        <text x="${COL_R1 + BW/2}" y="16" text-anchor="middle" font-family="system-ui" font-size="8" font-weight="800" fill="#6CABDD" letter-spacing="1">16AVOS</text>
                    </svg>
                </div>`;

        } catch(err) {
            console.error('[Bracket]', err);
            container.innerHTML = '<div class="glass-panel" style="padding:2rem; text-align:center;"><p style="color:#ff4757;">Error cargando el bracket.</p></div>';
        }

        // Auto-refresh cada 30s si hay partidos en vivo
        if (window._bracketRefreshInterval) clearInterval(window._bracketRefreshInterval);
        window._bracketRefreshInterval = setInterval(async () => {
            if (!document.getElementById('mundial-tab-content')) {
                clearInterval(window._bracketRefreshInterval);
                return;
            }
            try {
                const hoy = new Date().toLocaleDateString('en-CA', {timeZone:'America/Argentina/Buenos_Aires'}).replace(/-/g,'');
                const res  = await fetch(CF_WORKER + '/?url=' + encodeURIComponent('https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard?dates=' + hoy));
                const data = res.ok ? await res.json() : {};
                const hayEnVivo = (data.events ?? []).some(ev => ev.competitions?.[0]?.status?.type?.state === 'in');
                if (hayEnVivo) await renderBracketMundial(container);
            } catch(e) {}
        }, 30000);
    };

    // ── VISTA MUNDIAL: DETALLE DE GRUPO ──────────────────────────────────────
    const renderGrupoDetalle = async (grupoNombreCodificado) => {
        const grupoNombre = decodeURIComponent(grupoNombreCodificado);

        appContainer.innerHTML = `
            ${renderNavbar('#/liga?id=world_cup')}
            <main class="page-container fade-in">
                <a href="#/liga?id=world_cup" style="color: var(--text-muted); text-decoration: none; display: inline-block; margin-bottom: 1.5rem; font-weight: 600;">← Volver a Fase de Grupos</a>
                <div style="display: flex; justify-content: center; align-items: center; height: 30vh; flex-direction: column;">
                    <div style="width: 45px; height: 45px; border: 4px solid var(--accent-neon); border-right-color: transparent; border-radius: 50%; animation: spin 1s linear infinite;"></div>
                    <p style="margin-top: 1.5rem; color: var(--accent-neon); font-family: var(--font-heading); text-transform: uppercase; letter-spacing: 1px;">Analizando estadísticas de ${grupoNombre}...</p>
                </div>
            </main>
        ${_closeSidebarWrapper()}
        `;

        let equipos = [];
        const CF_WORKER = 'https://whistle.solgoyhe.workers.dev';

        try {
            const espnProxyUrl  = `${CF_WORKER}/?url=${encodeURIComponent('https://site.api.espn.com/apis/v2/sports/soccer/fifa.world/standings')}`;
            const respuestaEspn = await fetch(espnProxyUrl);
            const parsedEspn    = await respuestaEspn.json();
            const grupoEncontrado = parsedEspn.children?.find(g => g.name.replace(/Group /i, 'GRUPO ').toUpperCase() === grupoNombre);

            if (grupoEncontrado && grupoEncontrado.standings?.entries) {
                equipos = grupoEncontrado.standings.entries.map(e => {
                    const stats    = e.stats || [];
                    const findStat = (name) => stats.find(s => s.name === name)?.value || 0;
                    return {
                        id:     e.team.id,
                        nombre: e.team.name,
                        logo:   e.team.logos?.[0]?.href || '🌐',
                        pj:     findStat('gamesPlayed'),
                        gf:     findStat('pointsFor'),
                        gc:     findStat('pointsAgainst'),
                        dif:    findStat('pointDifferential'),
                        pts:    findStat('points')
                    };
                });
                equipos.sort((a, b) => b.pts - a.pts || b.dif - a.dif);
            } else throw new Error();
        } catch (err) {
            const mapMockGrup = {
                'GRUPO A': [{n:'México',        fl:'🇲🇽', id:'203'}, {n:'Sudáfrica',     fl:'🇿🇦', id:'467'}, {n:'Corea del Sur', fl:'🇰🇷', id:'451'}, {n:'Czechia',        fl:'🇨🇿', id:'450'}],
                'GRUPO B': [{n:'Canadá',        fl:'🇨🇦', id:'206'}, {n:'Suiza',         fl:'🇨🇭', id:'475'}, {n:'Catar',         fl:'🇶🇦', id:'4398'},{n:'Bosnia-Herz.',   fl:'🇧🇦', id:'452'}],
                'GRUPO C': [{n:'Brasil',        fl:'🇧🇷', id:'205'}, {n:'Marruecos',     fl:'🇲🇦', id:'2869'},{n:'Haití',         fl:'🇭🇹', id:'2654'},{n:'Escocia',        fl:'🏴󠁧󠁢󠁳󠁣󠁴󠁿', id:'580'}],
                'GRUPO D': [{n:'Estados Unidos',fl:'🇺🇸', id:'660'}, {n:'Paraguay',      fl:'🇵🇾', id:'210'}, {n:'Australia',     fl:'🇦🇺', id:'628'}, {n:'Türkiye',        fl:'🇹🇷', id:'465'}],
                'GRUPO E': [{n:'Alemania',      fl:'🇩🇪', id:'481'}, {n:'Curaçao',       fl:'🇨🇼', id:'11678'},{n:'Costa de Marfil',fl:'🇨🇮', id:'4789'},{n:'Ecuador',       fl:'🇪🇨', id:'209'}],
                'GRUPO F': [{n:'Países Bajos',  fl:'🇳🇱', id:'449'}, {n:'Japón',         fl:'🇯🇵', id:'627'}, {n:'Suecia',        fl:'🇸🇪', id:'466'}, {n:'Túnez',          fl:'🇹🇳', id:'659'}],
                'GRUPO G': [{n:'Bélgica',       fl:'🇧🇪', id:'459'}, {n:'Egipto',        fl:'🇪🇬', id:'2620'},{n:'Irán',          fl:'🇮🇷', id:'469'}, {n:'Nueva Zelanda',  fl:'🇳🇿', id:'2666'}],
                'GRUPO H': [{n:'España',        fl:'🇪🇸', id:'164'}, {n:'Cabo Verde',    fl:'🇨🇻', id:'2597'},{n:'Arabia Saudita',fl:'🇸🇦', id:'655'}, {n:'Uruguay',        fl:'🇺🇾', id:'212'}],
                'GRUPO I': [{n:'Francia',       fl:'🇫🇷', id:'478'}, {n:'Senegal',       fl:'🇸🇳', id:'654'}, {n:'Noruega',       fl:'🇳🇴', id:'464'}, {n:'Irak',           fl:'🇮🇶', id:'4375'}],
                'GRUPO J': [{n:'Argentina',     fl:'🇦🇷', id:'202'}, {n:'Argelia',       fl:'🇩🇿', id:'624'}, {n:'Austria',       fl:'🇦🇹', id:'474'}, {n:'Jordania',       fl:'🇯🇴', id:'2917'}],
                'GRUPO K': [{n:'Portugal',      fl:'🇵🇹', id:'482'}, {n:'Congo RD',      fl:'🇨🇩', id:'2850'},{n:'Uzbekistán',    fl:'🇺🇿', id:'2570'},{n:'Colombia',       fl:'🇨🇴', id:'208'}],
                'GRUPO L': [{n:'Inglaterra',    fl:'🏴󠁧󠁢󠁥󠁮󠁧󠁿', id:'448'}, {n:'Croacia',       fl:'🇭🇷', id:'477'}, {n:'Ghana',         fl:'🇬🇭', id:'4469'},{n:'Panamá',         fl:'🇵🇦', id:'2659'}],
            };
            const target = mapMockGrup[grupoNombre] || mapMockGrup['GRUPO A'];
            equipos = target.map(eq => ({ id: eq.id, nombre: eq.n, logo: eq.fl, pj: 0, gf: 0, gc: 0, dif: 0, pts: 0 }));
        }

        let filasHtml = equipos.map((eq, idx) => {
            const logoHtml = eq.logo.includes('http')
                ? `<img src="${eq.logo}" width="24" height="24" style="object-fit: contain; margin-right: 12px;">`
                : `<span style="font-size:1.3rem; margin-right: 12px;">${eq.logo}</span>`;
            return `
                <tr style="border-bottom: 1px solid var(--border-glass); cursor: pointer; transition: background 0.2s;"
                    onmouseover="this.style.background='rgba(255,255,255,0.05)'"
                    onmouseout="this.style.background='transparent'"
                    onclick="window.location.hash='#/equipo?id=${eq.id}&liga=world_cup&name=${encodeURIComponent(eq.nombre)}'">
                    <td style="padding: 12px; font-weight: bold; color: var(--accent-neon);">${idx + 1}</td>
                    <td style="padding: 12px; display: flex; align-items: center; font-weight: 600; font-size: 1.05rem;">${logoHtml} ${eq.nombre}</td>
                    <td style="padding: 12px; text-align: center;">${eq.pj}</td>
                    <td style="padding: 12px; text-align: center; color: #6CABDD;">${eq.gf}</td>
                    <td style="padding: 12px; text-align: center; color: #ff4757;">${eq.gc}</td>
                    <td style="padding: 12px; text-align: center; font-weight: bold;">${eq.dif > 0 ? '+' + eq.dif : eq.dif}</td>
                    <td style="padding: 12px; text-align: center; font-weight: 900; color: var(--text-main); font-size: 1.1rem;">${eq.pts}</td>
                </tr>
            `;
        }).join('');

        appContainer.innerHTML = `
            ${renderNavbar('#/liga?id=world_cup')}
            <main class="page-container fade-in">
                <a href="#/liga?id=world_cup" style="color: var(--text-muted); text-decoration: none; display: inline-block; margin-bottom: 1rem; font-weight: 600;">← Volver a Fase de Grupos</a>
                <div class="liga-header" style="border-left: 6px solid var(--accent-neon); background: rgba(200, 168, 75, 0.05);">
                    <div>
                        <h1 class="liga-title-main">${grupoNombre}</h1>
                        <span style="color: var(--text-muted); font-weight: 600; text-transform: uppercase; letter-spacing: 1px;">TABLA DE POSICIONES EXTENDIDA</span>
                    </div>
                </div>
                <div class="glass-panel" style="padding: 1.5rem; margin-top: 2rem;">
                    <div class="table-responsive">
                        <table style="width: 100%; border-collapse: collapse;">
                            <thead>
                                <tr style="color: var(--text-muted); font-size: 0.85rem; text-transform: uppercase; border-bottom: 2px solid var(--border-glass);">
                                    <th style="text-align: left; padding: 12px; width: 40px;">Pos</th>
                                    <th style="text-align: left; padding: 12px;">Selección Nacional</th>
                                    <th style="text-align: center; padding: 12px; width: 60px;">PJ</th>
                                    <th style="text-align: center; padding: 12px; width: 60px;" title="Goles a Favor">GF</th>
                                    <th style="text-align: center; padding: 12px; width: 60px;" title="Goles en Contra">GC</th>
                                    <th style="text-align: center; padding: 12px; width: 60px;" title="Diferencia de Gol">DIF</th>
                                    <th style="text-align: center; padding: 12px; width: 60px;">PTS</th>
                                </tr>
                            </thead>
                            <tbody>${filasHtml}</tbody>
                        </table>
                    </div>
                </div>
            </main>
        ${_closeSidebarWrapper()}
        `;
    };

    // ── VISTA: PERFIL DE EQUIPO ───────────────────────────────────────────────
    const renderEquipoDetalle = async (equipoId, ligaId, nombreEquipoDecoded) => {
        const name       = decodeURIComponent(nombreEquipoDecoded || 'Selección');
        const CF_WORKER  = 'https://whistle.solgoyhe.workers.dev';
        const espnLeague = ESPN.getSlug(ligaId) ?? ligaId;

        appContainer.innerHTML = `
            ${renderNavbar('#/liga?id=' + ligaId)}
            <main class="page-container fade-in">
                <a href="javascript:history.back()" style="color: var(--text-muted); text-decoration: none; display: inline-block; margin-bottom: 1rem;">← Volver</a>
                <div style="display: flex; justify-content: center; align-items: center; height: 30vh; flex-direction: column;">
                    <div style="width: 45px; height: 45px; border: 4px solid var(--accent-neon); border-right-color: transparent; border-radius: 50%; animation: spin 1s linear infinite;"></div>
                    <p style="margin-top: 1.5rem; color: var(--accent-neon); font-family: var(--font-heading); text-transform: uppercase; letter-spacing: 1px;">Extrayendo datos de ESPN...</p>
                </div>
            </main>
        ${_closeSidebarWrapper()}
        `;

        // ── Helpers ───────────────────────────────────────────────────────────
        const renderLista = (lista, icono, unidad) => {
            if (!lista || lista.length === 0) return `<p style="color:var(--text-muted); font-size:0.85rem; padding: 10px 0; text-align: center; font-style: italic;">Sin registros en este partido.</p>`;
            return lista.map(item => `
                <div style="display:flex; justify-content:space-between; align-items:center; padding: 8px 0; border-bottom: 1px solid rgba(255,255,255,0.04);">
                    <div style="display:flex; align-items:center; gap: 8px;">
                        <span style="font-size: 1rem;">${icono}</span>
                        <span style="font-weight: 500; font-size: 0.95rem;">${item.nombre}</span>
                    </div>
                    <span style="font-weight: 800; color: var(--text-main); font-family: var(--font-heading);">${item.valor} <span style="font-size: 0.7rem; font-weight: normal; color:var(--text-muted);">${unidad}</span></span>
                </div>
            `).join('');
        };

        const extraerStatsDeSummary = (summaryJSON, teamId) => {
            const stats = { goles: [], asistencias: [], amarillas: [], rojas: [] };

            const goles = (summaryJSON.keyEvents ?? []).filter(e => e.scoringPlay === true && e.team?.id === String(teamId));
            goles.forEach(g => {
                const goleador  = g.participants?.[0]?.athlete?.displayName;
                const asistidor = g.participants?.[1]?.athlete?.displayName;
                if (goleador) {
                    const existing = stats.goles.find(x => x.nombre === goleador);
                    if (existing) existing.valor++;
                    else stats.goles.push({ nombre: goleador, valor: 1 });
                }
                if (asistidor) {
                    const existing = stats.asistencias.find(x => x.nombre === asistidor);
                    if (existing) existing.valor++;
                    else stats.asistencias.push({ nombre: asistidor, valor: 1 });
                }
            });

            const teamRoster = (summaryJSON.rosters ?? []).find(r => r.team?.id === String(teamId));
            (teamRoster?.roster ?? []).forEach(j => {
                const getStat = (n) => j.stats?.find(s => s.name === n)?.value ?? 0;
                const am      = getStat('yellowCards');
                const ro      = getStat('redCards');
                const nombre  = j.athlete?.displayName;
                if (am > 0) stats.amarillas.push({ nombre, valor: am });
                if (ro > 0) stats.rojas.push({ nombre, valor: ro });
            });

            return stats;
        };

        const extraerConvocados = (rosterJSON) => {
            let atletasArray = [];
            if (Array.isArray(rosterJSON.athletes)) {
                atletasArray = rosterJSON.athletes[0]?.items
                    ? rosterJSON.athletes.flatMap(g => g.items || [])
                    : rosterJSON.athletes;
            }
            return atletasArray.map(ath => ({
                id:       ath.id ?? ath.uid ?? null,
                numero:   ath.jersey || '-',
                nombre:   ath.displayName || ath.fullName || 'Jugador',
                posicion: ath.position?.abbreviation || ath.position?.name || 'N/A'
            }));
        };

        // ── Fetch paralelo: roster + scoreboards ──────────────────────────────
        let convocados = [];
        let partidos   = [];
        const esProMaxHistorial = _esProMax();

        try {
            // Fechas base: fase de grupos Mundial (jun 11-27)
            const fechasBase = [];
            for (let d = 11; d <= 27; d++) fechasBase.push(`202606${d}`);

            // Historial extendido (solo Palco): amistosos mayo + partidos de clasificatoria 2025
            const fechasExtendidas = esProMaxHistorial ? [
                '20250920','20250921','20250922','20250923','20250924','20250925',
                '20251008','20251009','20251010','20251011','20251012','20251013',
                '20251111','20251112','20251113','20251114','20251115','20251116',
                '20250322','20250323','20250324','20250325','20250326',
                '20250601','20250602','20250603','20250604','20250605','20250606',
            ] : [];

            const todasFechas = [...fechasBase, ...fechasExtendidas];

            const [rosterRes, ...scoreboardsRes] = await Promise.all([
                fetch(`${CF_WORKER}/?url=${encodeURIComponent(`https://site.api.espn.com/apis/site/v2/sports/soccer/${espnLeague}/teams/${equipoId}/roster`)}`),
                ...todasFechas.map(fecha =>
                    fetch(`${CF_WORKER}/?url=${encodeURIComponent(`https://site.api.espn.com/apis/site/v2/sports/soccer/${espnLeague}/scoreboard?dates=${fecha}`)}`)
                )
            ]);

            if (rosterRes.ok) convocados = extraerConvocados(await rosterRes.json());

            const todosEventos = (await Promise.all(
                scoreboardsRes.map(r => r.ok ? r.json().catch(() => ({})) : Promise.resolve({}))
            )).flatMap(sb => sb.events ?? []);

            const vistos = new Set();
            todosEventos.forEach(ev => {
                if (vistos.has(ev.id)) return;
                vistos.add(ev.id);

                const comp     = ev.competitions?.[0];
                const home     = comp?.competitors?.find(c => c.homeAway === 'home');
                const away     = comp?.competitors?.find(c => c.homeAway === 'away');
                const esLocal  = home?.team?.id === String(equipoId);
                const esVisita = away?.team?.id === String(equipoId);
                if (!esLocal && !esVisita) return;

                const rival       = esLocal ? (away?.team?.displayName ?? '?') : (home?.team?.displayName ?? '?');
                const rivalLogo   = esLocal ? (away?.team?.logo ?? '') : (home?.team?.logo ?? '');
                const scoreLocal  = home?.score ?? '-';
                const scoreVisita = away?.score ?? '-';
                const estado      = comp?.status?.type?.state ?? 'pre';
                const desc        = comp?.status?.type?.shortDetail ?? '';
                const isLive      = estado === 'in';
                const jugado      = estado === 'post' || isLive;
                const fecha       = ev.date ?? '';
                const esMundial   = fechasBase.some(f => fecha.startsWith(f.slice(0,4) + '-' + f.slice(4,6) + '-' + f.slice(6,8)));
                const golesAFavor = jugado ? parseInt(esLocal ? scoreLocal : scoreVisita) || 0 : 0;
                const golesEnCon  = jugado ? parseInt(esLocal ? scoreVisita : scoreLocal) || 0 : 0;

                partidos.push({
                    id: ev.id, rival, rivalLogo,
                    scoreLocal, scoreVisita, esLocal,
                    resultado: jugado ? `${scoreLocal} - ${scoreVisita}` : desc || 'Próximo',
                    estado, isLive, jugado, fecha, esMundial,
                    golesAFavor, golesEnCon,
                });
            });

            partidos.sort((a, b) => {
                // Mundial primero, luego por fecha descendente
                if (a.esMundial !== b.esMundial) return a.esMundial ? -1 : 1;
                if (a.jugado && !b.jugado) return -1;
                if (!a.jugado && b.jugado) return 1;
                return new Date(b.fecha) - new Date(a.fecha);
            });

        } catch (err) { console.warn('[WHISTLE] Error cargando equipo:', err); }

        // ── Stats acumuladas (solo Palco) ─────────────────────────────────────
        const partidosJugados = partidos.filter(p => p.jugado);
        const statsAcum = {
            pj: partidosJugados.length,
            pg: partidosJugados.filter(p => p.golesAFavor > p.golesEnCon).length,
            pe: partidosJugados.filter(p => p.golesAFavor === p.golesEnCon).length,
            pp: partidosJugados.filter(p => p.golesAFavor < p.golesEnCon).length,
            gf: partidosJugados.reduce((s, p) => s + p.golesAFavor, 0),
            gc: partidosJugados.reduce((s, p) => s + p.golesEnCon, 0),
        };

        // ── HTML de convocados ────────────────────────────────────────────────
        const rosterHtml = convocados.length > 0
            ? convocados.map(j => `
                <div class="roster-item-js" data-id="${j.id ?? j.numero}"
                    style="display:flex; align-items:center; justify-content:space-between; padding: 8px; border-bottom: 1px solid var(--border-glass); transition: background 0.2s, border-left 0.2s;">
                    <div style="display:flex; align-items:center; gap: 10px;">
                        <span style="background:rgba(255,255,255,0.1); width:30px; height:30px; display:flex; align-items:center; justify-content:center; border-radius:50%; font-weight:bold; font-size:0.85rem;">${j.numero}</span>
                        <span>${j.nombre}</span>
                    </div>
                    <span style="font-size:0.8rem; color:var(--accent-neon); font-weight:bold;">${j.posicion}</span>
                </div>`).join('')
            : `<p style="color:var(--text-muted); font-style:italic; text-align:center; padding-top:1rem;">Sin datos de convocados.</p>`;

        // ── Chips de partidos ─────────────────────────────────────────────────
        const chipsHtml = partidos.length > 0
            ? partidos.map((p, i) => `
                <button onclick="window._seleccionarPartido(${i})" id="chip-partido-${i}"
                    style="flex-shrink:0; padding: 10px 18px; border-radius: 20px; border: 2px solid ${i === 0 ? 'var(--accent-neon)' : 'var(--border-glass)'}; background: ${i === 0 ? 'rgba(61,111,255,0.12)' : 'rgba(255,255,255,0.04)'}; color: ${i === 0 ? 'var(--accent-neon)' : 'var(--text-muted)'}; cursor: pointer; font-family: var(--font-heading); font-weight: 700; font-size: 0.9rem; white-space: nowrap; transition: all 0.2s;">
                    vs ${p.rival}
                    ${p.isLive ? '<span style="color:#ff4757; margin-left:6px; font-size:0.75rem;">● VIVO</span>' : ''}
                    <span style="display:block; font-size:0.75rem; font-weight:400; margin-top:2px; color:var(--text-muted);">${p.resultado}</span>
                </button>`).join('')
            : `<p style="color:var(--text-muted); font-size:0.85rem; padding: 10px;">Sin partidos registrados aún.</p>`;

        // ── Render principal ──────────────────────────────────────────────────
        appContainer.innerHTML = `
            ${renderNavbar('#/liga?id=' + ligaId)}
            <main class="page-container fade-in">
                <a href="javascript:history.back()" style="color: var(--text-muted); text-decoration: none; display: inline-block; margin-bottom: 1.5rem; font-weight: 600;">← Volver</a>

                <div class="liga-header" style="border-left: 6px solid var(--accent-neon); background: rgba(255,255,255,0.03); display: flex; align-items: center; gap: 20px;">
                    <div style="width: 80px; height: 80px; font-size: 2.5rem; background: var(--surface-color); border: 2px solid var(--border-glass); display:flex; align-items:center; justify-content:center; border-radius:50%;">${name.charAt(0)}</div>
                    <div>
                        <h1 class="liga-title-main" style="margin-bottom: 4px; font-size: 2rem;">${name}</h1>
                        <span style="color: var(--accent-neon); font-weight: 800; text-transform: uppercase; letter-spacing: 1px; font-size: 0.85rem;">Estadísticas por Partido</span>
                    </div>
                </div>

                <!-- Selector de partidos -->
                <div class="glass-panel" style="padding: 1.2rem 1.5rem; margin-top: 1.5rem;">
                    <p style="font-size:0.75rem; color:var(--text-muted); text-transform:uppercase; letter-spacing:1px; margin-bottom:10px; font-weight:600;">Seleccioná un partido</p>
                    <div style="display:flex; gap: 12px; overflow-x: auto; padding-bottom: 4px; scrollbar-width: thin;">
                        ${chipsHtml}
                    </div>
                </div>

                <!-- Stats del partido seleccionado -->
                <div id="stats-partido-container" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 1.5rem; margin-top: 1.5rem;">
                    <div class="glass-panel" style="padding: 1.5rem; grid-column: 1 / -1; text-align:center;">
                        <div style="width: 30px; height: 30px; border: 3px solid var(--accent-neon); border-right-color: transparent; border-radius: 50%; animation: spin 1s linear infinite; margin: 0 auto;"></div>
                        <p style="color:var(--text-muted); margin-top:10px; font-size:0.9rem;">Cargando estadísticas...</p>
                    </div>
                </div>

                <!-- Convocados + Pizarra -->
                <div class="equipo-grid" style="margin-top: 2rem;">
                    <div class="glass-panel" style="padding: 1.5rem; max-height: 500px; overflow-y: auto;">
                        <h3 class="panel-title">Lista de Convocados</h3>
                        ${_esPro() ? rosterHtml : `
                            <div style="text-align:center; padding:2rem;">
                                <p style="font-size:1.5rem; margin-bottom:0.5rem;">🔒</p>
                                <p style="color:var(--text-muted); font-size:0.85rem; margin-bottom:1rem;">Lista de convocados disponible en Plan Platea</p>
                                <a href="#/planes" style="color:var(--accent-neon); font-weight:700; font-size:0.85rem;">Ver planes →</a>
                            </div>`}
                    </div>
                    <div class="glass-panel" style="padding: 1rem; overflow: hidden;">
                        <h3 class="panel-title" id="pizarra-titulo" style="margin-bottom:0.5rem;">Disposición Táctica</h3>
                        <div id="pizarra-container" style="width:100%; overflow:hidden; border-radius:8px;">
                            <svg id="pizarra-svg" viewBox="0 0 400 560" xmlns="http://www.w3.org/2000/svg" style="width:100%; display:block;">
                                <defs></defs>
                                <!-- Franjas de césped -->
                                <rect width="400" height="560" fill="#27792a" rx="8"/>
                                <rect x="0"  y="0"   width="400" height="70"  fill="#1e6622" rx="8"/>
                                <rect x="0"  y="140" width="400" height="70"  fill="#1e6622"/>
                                <rect x="0"  y="280" width="400" height="70"  fill="#1e6622"/>
                                <rect x="0"  y="420" width="400" height="70"  fill="#1e6622"/>
                                <!-- Borde del campo -->
                                <rect x="20" y="20" width="360" height="520" fill="none" stroke="rgba(255,255,255,0.5)" stroke-width="1.5"/>
                                <!-- Línea del medio -->
                                <line x1="20" y1="280" x2="380" y2="280" stroke="rgba(255,255,255,0.5)" stroke-width="1.5"/>
                                <!-- Círculo central -->
                                <circle cx="200" cy="280" r="52" fill="none" stroke="rgba(255,255,255,0.5)" stroke-width="1.5"/>
                                <circle cx="200" cy="280" r="2.5" fill="rgba(255,255,255,0.7)"/>
                                <!-- Área grande arriba -->
                                <rect x="88"  y="20"  width="224" height="82" fill="none" stroke="rgba(255,255,255,0.5)" stroke-width="1.5"/>
                                <!-- Área chica arriba -->
                                <rect x="144" y="20"  width="112" height="34" fill="none" stroke="rgba(255,255,255,0.5)" stroke-width="1.5"/>
                                <!-- Área grande abajo -->
                                <rect x="88"  y="458" width="224" height="82" fill="none" stroke="rgba(255,255,255,0.5)" stroke-width="1.5"/>
                                <!-- Área chica abajo -->
                                <rect x="144" y="506" width="112" height="34" fill="none" stroke="rgba(255,255,255,0.5)" stroke-width="1.5"/>
                                <!-- Puntos de penal -->
                                <circle cx="200" cy="76"  r="2.5" fill="rgba(255,255,255,0.7)"/>
                                <circle cx="200" cy="484" r="2.5" fill="rgba(255,255,255,0.7)"/>
                                <!-- Arcos -->
                                <rect x="160" y="12"  width="80" height="10" fill="rgba(255,255,255,0.1)" stroke="rgba(255,255,255,0.6)" stroke-width="1.5"/>
                                <rect x="160" y="538" width="80" height="10" fill="rgba(255,255,255,0.1)" stroke="rgba(255,255,255,0.6)" stroke-width="1.5"/>
                                <!-- Arcos de penales -->
                                <path d="M138,102 A62,62 0 0,0 262,102" fill="none" stroke="rgba(255,255,255,0.5)" stroke-width="1.5"/>
                                <path d="M138,458 A62,62 0 0,1 262,458" fill="none" stroke="rgba(255,255,255,0.5)" stroke-width="1.5"/>
                                <!-- Corners -->
                                <path d="M28,20 A8,8 0 0,1 20,28"   fill="none" stroke="rgba(255,255,255,0.5)" stroke-width="1.5"/>
                                <path d="M372,20 A8,8 0 0,0 380,28" fill="none" stroke="rgba(255,255,255,0.5)" stroke-width="1.5"/>
                                <path d="M28,540 A8,8 0 0,0 20,532" fill="none" stroke="rgba(255,255,255,0.5)" stroke-width="1.5"/>
                                <path d="M372,540 A8,8 0 0,1 380,532" fill="none" stroke="rgba(255,255,255,0.5)" stroke-width="1.5"/>
                                <!-- Capa de jugadores -->
                                <g id="tokens-layer"></g>
                            </svg>
                        </div>
                    </div>
                </div>

                <!-- HISTORIAL EXTENDIDO (solo Palco) -->
                ${esProMaxHistorial ? `
                <div class="glass-panel" style="padding:1.5rem; margin-top:2rem;">
                    <h3 class="panel-title" style="margin-bottom:1rem;">📊 Historial Extendido <span style="font-size:0.7rem; background:rgba(255,215,0,0.15); color:#ffd700; padding:2px 8px; border-radius:10px; margin-left:8px; font-family:var(--font-heading);">👑 PALCO</span></h3>

                    <!-- Stats acumuladas -->
                    ${statsAcum.pj > 0 ? `
                    <div style="display:grid; grid-template-columns:repeat(6,1fr); gap:0.5rem; margin-bottom:1.5rem; text-align:center;">
                        ${[
                            {label:'PJ', valor: statsAcum.pj, color:'var(--text-main)'},
                            {label:'PG', valor: statsAcum.pg, color:'var(--accent-neon)'},
                            {label:'PE', valor: statsAcum.pe, color:'#f0a500'},
                            {label:'PP', valor: statsAcum.pp, color:'#ff4757'},
                            {label:'GF', valor: statsAcum.gf, color:'var(--accent-neon)'},
                            {label:'GC', valor: statsAcum.gc, color:'#ff4757'},
                        ].map(s => `
                            <div style="background:rgba(255,255,255,0.04); border-radius:8px; padding:10px 4px;">
                                <div style="font-family:var(--font-heading); font-size:1.3rem; font-weight:900; color:${s.color};">${s.valor}</div>
                                <div style="font-size:0.65rem; color:var(--text-muted); text-transform:uppercase; letter-spacing:1px; margin-top:2px;">${s.label}</div>
                            </div>`).join('')}
                    </div>` : ''}

                    <!-- Lista de todos los partidos -->
                    <p style="font-size:0.7rem; color:var(--text-muted); text-transform:uppercase; letter-spacing:1px; margin-bottom:0.8rem; font-weight:600;">Todos los partidos</p>
                    <div style="display:flex; flex-direction:column; gap:6px;">
                        ${partidos.length > 0 ? partidos.map(p => {
                            const fechaStr = p.fecha ? new Date(p.fecha).toLocaleDateString('es-AR', {day:'2-digit', month:'2-digit', year:'2-digit', timeZone:'America/Argentina/Buenos_Aires'}) : '';
                            const esGanado = p.jugado && p.golesAFavor > p.golesEnCon;
                            const esEmpatado = p.jugado && p.golesAFavor === p.golesEnCon;
                            const esPerdido = p.jugado && p.golesAFavor < p.golesEnCon;
                            const resultColor = esGanado ? 'var(--accent-neon)' : esPerdido ? '#ff4757' : '#f0a500';
                            const resultLabel = esGanado ? 'G' : esPerdido ? 'P' : esEmpatado ? 'E' : '—';
                            const logoHtml = p.rivalLogo
                                ? `<img src="${p.rivalLogo}" width="20" height="20" style="object-fit:contain; border-radius:50%;" onerror="this.style.display='none'">`
                                : `<span style="font-size:0.8rem; font-weight:800; width:20px; text-align:center;">${(p.rival??'?').charAt(0)}</span>`;
                            return `
                                <div onclick="window._seleccionarPartidoPorId('${p.id}')"
                                    style="display:grid; grid-template-columns:60px 1fr auto auto; align-items:center; gap:8px;
                                    padding:8px 10px; border-radius:8px; background:rgba(255,255,255,0.03);
                                    border:1px solid var(--border-glass); cursor:${p.jugado ? 'pointer' : 'default'};
                                    transition:background 0.2s;"
                                    onmouseover="this.style.background='rgba(255,255,255,0.07)'"
                                    onmouseout="this.style.background='rgba(255,255,255,0.03)'">
                                    <span style="font-size:0.72rem; color:var(--text-muted);">${fechaStr}</span>
                                    <div style="display:flex; align-items:center; gap:6px; overflow:hidden;">
                                        ${logoHtml}
                                        <span style="font-size:0.85rem; font-weight:600; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">vs ${p.rival}</span>
                                        ${p.esMundial ? '<span style="font-size:0.6rem; background:rgba(200,168,75,0.2); color:#c8a84b; padding:1px 5px; border-radius:8px; flex-shrink:0;">🏆 MUN</span>' : '<span style="font-size:0.6rem; background:rgba(255,255,255,0.08); color:var(--text-muted); padding:1px 5px; border-radius:8px; flex-shrink:0;">AMIST</span>'}
                                    </div>
                                    <span style="font-family:var(--font-heading); font-size:0.9rem; font-weight:800; color:var(--text-main); white-space:nowrap;">
                                        ${p.jugado ? p.resultado : p.isLive ? `<span style="color:#ff4757;">● ${p.resultado}</span>` : '—'}
                                    </span>
                                    <span style="width:22px; height:22px; border-radius:50%; background:${p.jugado ? `rgba(${esGanado?'61,111,255':esPerdido?'255,71,87':'240,165,0'},0.15)` : 'rgba(255,255,255,0.06)'};
                                        color:${p.jugado ? resultColor : 'var(--text-muted)'}; font-size:0.7rem; font-weight:800;
                                        display:flex; align-items:center; justify-content:center; flex-shrink:0;">
                                        ${resultLabel}
                                    </span>
                                </div>`;
                        }).join('') : '<p style="color:var(--text-muted); font-size:0.85rem; text-align:center; padding:1rem;">Sin partidos encontrados.</p>'}
                    </div>
                </div>` : `
                <div class="glass-panel" style="padding:1.5rem; margin-top:2rem; text-align:center;">
                    <div style="font-size:2rem; margin-bottom:0.5rem;">👑</div>
                    <p style="font-weight:700; color:#ffd700; font-family:var(--font-heading); margin-bottom:0.5rem;">Historial Extendido</p>
                    <p style="color:var(--text-muted); font-size:0.82rem; margin-bottom:1rem;">Accedé al historial completo de partidos y estadísticas acumuladas del torneo con el plan Palco.</p>
                    <button onclick="window.location.hash='#/planes'"
                        style="padding:8px 20px; background:#ffd700; color:#000; font-weight:800;
                        font-family:var(--font-heading); border:none; border-radius:8px; cursor:pointer; font-size:0.85rem;">
                        VER PALCO
                    </button>
                </div>`}

            </main>
        ${_closeSidebarWrapper()}
        `;

        // ── Dibujar un jugador en la pizarra ─────────────────────────────────
        const _dibujarJugadorSVG = (svg, jugador, x, y, radio = 20) => {
            const ns     = 'http://www.w3.org/2000/svg';
            const R      = radio;
            const numero = jugador.jersey ?? '';
            const jId    = jugador.athlete?.id ?? jugador.jersey ?? Math.random().toString(36).slice(2);
            const nombre = (() => {
                const dn    = jugador.athlete?.displayName ?? '';
                const parts = dn.trim().split(' ');
                return (parts[parts.length - 1] ?? dn).substring(0, 10);
            })();

            const g = document.createElementNS(ns, 'g');
            g.setAttribute('transform', `translate(${x},${y})`);
            g.setAttribute('class', 'token-jugador');
            g.setAttribute('data-id', String(jId));
            g.style.cursor = 'pointer';
            g.addEventListener('click', () => window._resaltarJugador(String(jId), g));

            // Círculo principal
            const bg = document.createElementNS(ns, 'circle');
            bg.setAttribute('cx', '0'); bg.setAttribute('cy', '0'); bg.setAttribute('r', R);
            bg.setAttribute('fill', '#3a3a6a');
            bg.setAttribute('stroke', 'rgba(255,255,255,0.4)');
            bg.setAttribute('stroke-width', '1.5');
            g.appendChild(bg);

            // Número
            const numEl = document.createElementNS(ns, 'text');
            numEl.setAttribute('x', '0'); numEl.setAttribute('y', '1');
            numEl.setAttribute('text-anchor', 'middle');
            numEl.setAttribute('dominant-baseline', 'middle');
            numEl.setAttribute('font-size', '11');
            numEl.setAttribute('font-weight', '800');
            numEl.setAttribute('fill', '#ffffff');
            numEl.setAttribute('font-family', 'system-ui, sans-serif');
            numEl.textContent = numero;
            g.appendChild(numEl);

            // Pastilla nombre
            const nameBg = document.createElementNS(ns, 'rect');
            nameBg.setAttribute('x', '-26'); nameBg.setAttribute('y', String(R + 3));
            nameBg.setAttribute('width', '52'); nameBg.setAttribute('height', '14');
            nameBg.setAttribute('rx', '4');
            nameBg.setAttribute('fill', 'rgba(0,0,0,0.65)');
            g.appendChild(nameBg);

            const nameEl = document.createElementNS(ns, 'text');
            nameEl.setAttribute('x', '0'); nameEl.setAttribute('y', String(R + 11));
            nameEl.setAttribute('text-anchor', 'middle');
            nameEl.setAttribute('dominant-baseline', 'middle');
            nameEl.setAttribute('font-size', '7.5');
            nameEl.setAttribute('font-weight', '600');
            nameEl.setAttribute('fill', '#ffffff');
            nameEl.setAttribute('font-family', 'system-ui, sans-serif');
            nameEl.textContent = nombre;
            g.appendChild(nameEl);

            return g;
        };

        // ── Renderizar pizarra principal ──────────────────────────────────────
        const _renderizarPizarra = (summaryJSON) => {
            const tituloEl    = document.getElementById('pizarra-titulo');
            const pizarraSvg  = document.getElementById('pizarra-svg');
            const tokensLayer = pizarraSvg?.querySelector('#tokens-layer');
            if (!pizarraSvg || !tokensLayer) return;

            const teamRoster = (summaryJSON.rosters ?? []).find(r => r.team?.id === String(equipoId));
            const formacion  = teamRoster?.formation ?? '?';
            const titulares  = (teamRoster?.roster ?? [])
                .filter(j => j.starter === true && j.formationPlace >= 1 && j.formationPlace <= 11)
                .sort((a, b) => a.formationPlace - b.formationPlace);

            if (tituloEl) tituloEl.textContent = `Disposición Táctica (${formacion})`;
            tokensLayer.innerHTML = '';
            if (titulares.length === 0) return;

            // Usar el sistema centralizado de coordenadas
            const coordsMap = _calcularPosicionesTacticas(titulares, 400, 560, formacion);

            titulares.forEach(j => {
                const coords = coordsMap.get(j.formationPlace);
                if (!coords) return;
                const radio = coords.n >= 5 ? 15 : 20;
                tokensLayer.appendChild(_dibujarJugadorSVG(pizarraSvg, j, coords.x, coords.y, radio));
            });
        };

        // ── Seleccionar partido y cargar stats + pizarra ──────────────────────
        window._seleccionarPartido = async (idx) => {
            partidos.forEach((_, i) => {
                const chip = document.getElementById(`chip-partido-${i}`);
                if (!chip) return;
                chip.style.border     = i === idx ? '2px solid var(--accent-neon)' : '2px solid var(--border-glass)';
                chip.style.background = i === idx ? 'rgba(61,111,255,0.12)' : 'rgba(255,255,255,0.04)';
                chip.style.color      = i === idx ? 'var(--accent-neon)' : 'var(--text-muted)';
            });

            const container = document.getElementById('stats-partido-container');
            if (!container) return;

            const partido = partidos[idx];

            if (!partido.jugado) {
                container.innerHTML = `
                    <div class="glass-panel" style="padding: 1.5rem; grid-column: 1 / -1; text-align:center;">
                        <p style="font-size: 2rem;">📅</p>
                        <p style="color:var(--text-muted); margin-top:8px;">Este partido aún no se jugó.</p>
                        <p style="color:var(--accent-neon); font-weight:700; font-size:1.1rem; margin-top:4px;">${partido.resultado}</p>
                    </div>`;
                return;
            }

            container.innerHTML = `
                <div class="glass-panel" style="padding: 1.5rem; grid-column: 1 / -1; text-align:center;">
                    <div style="width:30px; height:30px; border:3px solid var(--accent-neon); border-right-color:transparent; border-radius:50%; animation:spin 1s linear infinite; margin:0 auto;"></div>
                    <p style="color:var(--text-muted); margin-top:10px; font-size:0.9rem;">Cargando stats de vs ${partido.rival}...</p>
                </div>`;

            try {
                const summaryRes  = await fetch(`${CF_WORKER}/?url=${encodeURIComponent(`https://site.api.espn.com/apis/site/v2/sports/soccer/${espnLeague}/summary?event=${partido.id}`)}`);
                const summaryJSON = summaryRes.ok ? await summaryRes.json() : {};
                const stats       = extraerStatsDeSummary(summaryJSON, equipoId);

                container.innerHTML = `
                    <div class="glass-panel" style="padding: 1.5rem;">
                        <h3 class="panel-title" style="border-bottom:1px solid var(--border-glass); padding-bottom:8px; margin-bottom:10px; font-size:1.1rem;">⚽ Goleadores</h3>
                        ${renderLista(stats.goles, '⚽', 'GOLES')}
                    </div>
                    <div class="glass-panel" style="padding: 1.5rem;">
                        <h3 class="panel-title" style="border-bottom:1px solid var(--border-glass); padding-bottom:8px; margin-bottom:10px; font-size:1.1rem;">🎯 Asistidores</h3>
                        ${renderLista(stats.asistencias, '👟', 'ASIST.')}
                    </div>
                    <div class="glass-panel" style="padding: 1.5rem;">
                        <h3 class="panel-title" style="border-bottom:1px solid var(--border-glass); padding-bottom:8px; margin-bottom:10px; font-size:1.1rem;">🟨 T. Amarillas</h3>
                        ${renderLista(stats.amarillas, '🟨', 'TARJ.')}
                    </div>
                    <div class="glass-panel" style="padding: 1.5rem;">
                        <h3 class="panel-title" style="border-bottom:1px solid var(--border-glass); padding-bottom:8px; margin-bottom:10px; font-size:1.1rem;">🟥 T. Rojas</h3>
                        ${renderLista(stats.rojas, '🟥', 'TARJ.')}
                    </div>`;

                _renderizarPizarra(summaryJSON);

            } catch (err) {
                container.innerHTML = `<div class="glass-panel" style="padding:1.5rem; grid-column:1/-1; text-align:center;"><p style="color:var(--text-muted);">Error cargando estadísticas.</p></div>`;
            }
        };

        // ── Resaltar jugador al clickear en la pizarra ────────────────────────
        window._resaltarJugador = (jugadorId, tokenEl) => {
            document.querySelectorAll('.roster-item-js').forEach(el => {
                el.style.background = '';
                el.style.borderLeft = '';
            });
            document.querySelectorAll('.token-jugador circle:first-child').forEach(el => {
                el.setAttribute('stroke', 'rgba(255,255,255,0.4)');
                el.setAttribute('stroke-width', '1.5');
            });

            const circle = tokenEl?.querySelector('circle');
            if (circle) {
                circle.setAttribute('stroke', 'var(--accent-neon)');
                circle.setAttribute('stroke-width', '3');
            }

            document.querySelectorAll('.roster-item-js').forEach(item => {
                if (item.dataset.id === String(jugadorId)) {
                    item.style.background = 'rgba(61,111,255,0.12)';
                    item.style.borderLeft = '3px solid var(--accent-neon)';
                    item.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                }
            });
        };

        const primerJugado = partidos.findIndex(p => p.jugado);
        if (primerJugado >= 0) {
            window._seleccionarPartido(primerJugado);
        } else if (partidos.length > 0) {
            window._seleccionarPartido(0);
        } else {
            const container = document.getElementById('stats-partido-container');
            if (container) container.innerHTML = `
                <div class="glass-panel" style="padding:1.5rem; grid-column:1/-1; text-align:center;">
                    <p style="color:var(--text-muted); font-style:italic;">Este equipo aún no tiene partidos registrados en ESPN.</p>
                </div>`;
        }

        // ── Seleccionar partido desde el historial por ID ─────────────────────
        window._seleccionarPartidoPorId = (id) => {
            const idx = partidos.findIndex(p => p.id === id);
            if (idx >= 0 && partidos[idx].jugado) {
                window._seleccionarPartido(idx);
                // Scroll al selector de partidos
                document.getElementById('stats-partido-container')
                    ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        };
    };

    // ── H2H ──────────────────────────────────────────────────────────────────
    const renderH2H = async () => {
        const CF_WORKER = 'https://whistle.solgoyhe.workers.dev';

        // Días del Mundial completo — fase de grupos + eliminación directa
        const DIAS_MUNDIAL = [];
        // Fase de grupos: 11-27 junio
        for (let d = 11; d <= 30; d++) {
            const fecha = `202606${String(d).padStart(2, '0')}`;
            const label = new Date(`2026-06-${String(d).padStart(2, '0')}T12:00:00-03:00`)
                .toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric', month: 'short' });
            DIAS_MUNDIAL.push({ fecha, label });
        }
        // Julio: octavos, cuartos, semis, final (1-19 julio)
        for (let d = 1; d <= 19; d++) {
            const fecha = `202607${String(d).padStart(2, '0')}`;
            const label = new Date(`2026-07-${String(d).padStart(2, '0')}T12:00:00-03:00`)
                .toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric', month: 'short' });
            DIAS_MUNDIAL.push({ fecha, label });
        }

        // Día actual en Argentina (UTC-3)
        const hoyAR = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Argentina/Buenos_Aires' }));
        const hoyStr = `${hoyAR.getFullYear()}${String(hoyAR.getMonth()+1).padStart(2,'0')}${String(hoyAR.getDate()).padStart(2,'0')}`;
        // Durante el Mundial mostramos el día de hoy. Antes de que arranque, el primer día.
        // Terminado el torneo, la final (último día) — así la sección "sigue viéndose" con
        // el desenlace en vez de quedar parada en el día inaugural. (fecha es YYYYMMDD: el
        // orden alfabético coincide con el cronológico.)
        const _ultimoDia = DIAS_MUNDIAL[DIAS_MUNDIAL.length - 1];
        const diaDefault = DIAS_MUNDIAL.find(d => d.fecha === hoyStr)
            ?? (hoyStr > _ultimoDia.fecha ? _ultimoDia : DIAS_MUNDIAL[0]);

        // ── Estructura base ───────────────────────────────────────────────────
        appContainer.innerHTML = `
            ${renderNavbar('#/h2h')}
            <main class="page-container fade-in" style="max-width: 700px; margin: 0 auto;">
                <h2 class="section-title">⚔️ Partidos del Mundial</h2>

                <!-- Selector de fechas -->
                <div style="overflow-x: auto; padding-bottom: 8px; margin-bottom: 1.5rem; scrollbar-width: thin;">
                    <div style="display: flex; gap: 8px; width: max-content;">
                        ${DIAS_MUNDIAL.map(d => `
                            <button id="btn-dia-${d.fecha}" onclick="window._seleccionarDia('${d.fecha}')"
                                style="flex-shrink:0; padding: 8px 16px; border-radius: 20px;
                                    border: 2px solid ${d.fecha === diaDefault.fecha ? 'var(--accent-neon)' : 'var(--border-glass)'};
                                    background: ${d.fecha === diaDefault.fecha ? 'rgba(61,111,255,0.12)' : 'rgba(255,255,255,0.04)'};
                                    color: ${d.fecha === diaDefault.fecha ? 'var(--accent-neon)' : 'var(--text-muted)'};
                                    cursor: pointer; font-family: var(--font-heading); font-weight: 700;
                                    font-size: 0.8rem; white-space: nowrap; transition: all 0.2s; text-transform: uppercase;">
                                ${d.label}
                            </button>`).join('')}
                    </div>
                </div>

                <!-- Partidos del día -->
                <div id="h2h-partidos-dia">
                    <div style="text-align:center; padding:3rem;">
                        <div style="width:40px; height:40px; border:3px solid var(--accent-neon); border-right-color:transparent; border-radius:50%; animation:spin 1s linear infinite; margin:0 auto;"></div>
                        <p style="color:var(--accent-neon); margin-top:1rem; font-family:var(--font-heading); text-transform:uppercase; letter-spacing:1px;">Cargando partidos...</p>
                    </div>
                </div>
            </main>
        ${_closeSidebarWrapper()}
        `;

        // ── Helper: stat bar ──────────────────────────────────────────────────
        const statBar = (valA, valB, titulo) => {
            const total = (valA + valB) || 1;
            const pctA  = Math.round((valA / total) * 100);
            const pctB  = 100 - pctA;
            return `
                <div style="margin-bottom:1rem;">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
                        <span style="font-weight:700; font-size:0.95rem;">${valA}</span>
                        <span style="font-size:0.7rem; color:var(--text-muted); text-transform:uppercase; letter-spacing:1px;">${titulo}</span>
                        <span style="font-weight:700; font-size:0.95rem; color:var(--accent-neon);">${valB}</span>
                    </div>
                    <div style="display:flex; height:5px; border-radius:3px; overflow:hidden; background:rgba(255,255,255,0.08);">
                        <div style="width:${pctA}%; background:var(--text-main); transition:width 0.6s;"></div>
                        <div style="width:${pctB}%; background:var(--accent-neon); transition:width 0.6s;"></div>
                    </div>
                </div>`;
        };

        // ── Helper: mini pizarra ──────────────────────────────────────────────
        const miniPizarra = (roster, teamId, colorCamiseta, colorNum) => {
            if (!roster) return '<p style="color:var(--text-muted); text-align:center; font-size:0.8rem; padding:0.5rem;">Sin datos de alineación.</p>';
            const titulares = (roster.roster ?? [])
                .filter(j => j.starter === true && j.formationPlace >= 1 && j.formationPlace <= 11)
                .sort((a, b) => a.formationPlace - b.formationPlace);
            if (titulares.length === 0) return '<p style="color:var(--text-muted); text-align:center; font-size:0.8rem; padding:0.5rem;">🤐 El técnico se la guarda.</p>';

            const W = 280, H = 380;
            const coordsMap = _calcularPosicionesTacticas(titulares, W, H, roster.formation ?? '');

            let tokens = '';
            titulares.forEach(j => {
                const c = coordsMap.get(j.formationPlace);
                if (!c) return;
                const nombre = (j.athlete?.displayName ?? '').split(' ').pop().substring(0, 9);
                const num = j.jersey ?? '';
                tokens += `
                    <g transform="translate(${c.x},${c.y})">
                        <circle cx="0" cy="0" r="13" fill="${colorCamiseta}" stroke="rgba(255,255,255,0.3)" stroke-width="1"/>
                        <text x="0" y="1" text-anchor="middle" dominant-baseline="middle" font-size="7.5" font-weight="800" fill="${colorNum}" font-family="system-ui">${num}</text>
                        <rect x="-17" y="16" width="34" height="10" rx="3" fill="rgba(0,0,0,0.6)"/>
                        <text x="0" y="22" text-anchor="middle" dominant-baseline="middle" font-size="5.5" font-weight="600" fill="#fff" font-family="system-ui">${nombre}</text>
                    </g>`;
            });

            return `
                <svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" style="width:100%; display:block; border-radius:8px;">
                    <defs>
                        <pattern id="stripes-${teamId}" patternUnits="userSpaceOnUse" width="${W}" height="34">
                            <rect width="${W}" height="17" y="0" fill="#27792a"/>
                            <rect width="${W}" height="17" y="17" fill="#1e6622"/>
                        </pattern>
                    </defs>
                    <rect width="${W}" height="${H}" fill="url(#stripes-${teamId})" rx="8"/>
                    <rect x="10" y="8" width="${W-20}" height="${H-16}" fill="none" stroke="rgba(255,255,255,0.4)" stroke-width="1"/>
                    <line x1="10" y1="${H/2}" x2="${W-10}" y2="${H/2}" stroke="rgba(255,255,255,0.4)" stroke-width="1"/>
                    <circle cx="${W/2}" cy="${H/2}" r="${W*0.13}" fill="none" stroke="rgba(255,255,255,0.4)" stroke-width="1"/>
                    <rect x="${W*0.27}" y="8" width="${W*0.46}" height="${H*0.14}" fill="none" stroke="rgba(255,255,255,0.4)" stroke-width="1"/>
                    <rect x="${W*0.27}" y="${H-8-H*0.14}" width="${W*0.46}" height="${H*0.14}" fill="none" stroke="rgba(255,255,255,0.4)" stroke-width="1"/>
                    <g>${tokens}</g>
                </svg>`;
        };

        // ── Cargar y renderizar partidos de un día ────────────────────────────
        window._seleccionarDia = async (fecha) => {
            // Actualizar botones
            DIAS_MUNDIAL.forEach(d => {
                const btn = document.getElementById(`btn-dia-${d.fecha}`);
                if (!btn) return;
                const activo = d.fecha === fecha;
                btn.style.border     = activo ? '2px solid var(--accent-neon)' : '2px solid var(--border-glass)';
                btn.style.background = activo ? 'rgba(61,111,255,0.12)' : 'rgba(255,255,255,0.04)';
                btn.style.color      = activo ? 'var(--accent-neon)' : 'var(--text-muted)';
            });

            const container = document.getElementById('h2h-partidos-dia');
            container.innerHTML = `
                <div style="text-align:center; padding:3rem;">
                    <div style="width:36px; height:36px; border:3px solid var(--accent-neon); border-right-color:transparent; border-radius:50%; animation:spin 1s linear infinite; margin:0 auto;"></div>
                    <p style="color:var(--accent-neon); margin-top:1rem; font-family:var(--font-heading); font-size:0.85rem; text-transform:uppercase; letter-spacing:1px;">Cargando partidos...</p>
                </div>`;

            try {
                const res = await fetch(`${CF_WORKER}/?url=${encodeURIComponent(`https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard?dates=${fecha}`)}`);
                const data = res.ok ? await res.json() : {};
                const eventos = data.events ?? [];

                if (eventos.length === 0) {
                    container.innerHTML = `<div class="glass-panel" style="padding:2rem; text-align:center;"><p style="color:var(--text-muted);">Sin partidos para este día.</p></div>`;
                    return;
                }

                // Ordenar: en vivo → finalizado → próximo
                const prioridad = (ev) => {
                    const estado = ev.competitions?.[0]?.status?.type?.state;
                    if (estado === 'in')   return 0;
                    if (estado === 'post') return 1;
                    return 2;
                };
                eventos.sort((a, b) => prioridad(a) - prioridad(b));

                // Renderizar cada partido como card
                container.innerHTML = eventos.map((ev, idx) => {
                    const comp   = ev.competitions?.[0];
                    const home   = comp?.competitors?.find(c => c.homeAway === 'home');
                    const away   = comp?.competitors?.find(c => c.homeAway === 'away');
                    const estado = comp?.status?.type?.state ?? 'pre';
                    const esLive = estado === 'in';
                    const esPost = estado === 'post';

                    // Hora en Argentina (UTC-3)
                    const fechaEvento = new Date(ev.date);
                    const horaAR = fechaEvento.toLocaleTimeString('es-AR', {
                        timeZone: 'America/Argentina/Buenos_Aires',
                        hour: '2-digit', minute: '2-digit'
                    });

                    const homeNombre = home?.team?.displayName ?? '?';
                    const awayNombre = away?.team?.displayName ?? '?';
                    const homeLogo   = home?.team?.logo ?? '';
                    const awayLogo   = away?.team?.logo ?? '';
                    const homeScore  = home?.score ?? '-';
                    const awayScore  = away?.score ?? '-';
                    const minuto     = comp?.status?.displayClock ?? '';
                    const shortDetail = comp?.status?.type?.shortDetail ?? '';

                    const logoHtml = (logo, nombre) => logo
                        ? `<img src="${logo}" width="28" height="28" style="object-fit:contain;" onerror="this.style.display='none'">`
                        : `<span style="font-size:1.2rem;">${nombre.charAt(0)}</span>`;

                    if (esLive || esPost) {
                        // Card con resultado — click va a vista de partido
                        return `
                            <div class="glass-panel" style="padding:1.2rem; margin-bottom:1rem; cursor:pointer; transition:background 0.2s;"
                                onclick="window.location.hash='#/partido?id=${ev.id}&liga=fifa.world'"
                                onmouseover="this.style.background='rgba(255,255,255,0.06)'"
                                onmouseout="this.style.background=''">
                                <!-- Cabecera del partido -->
                                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.8rem;">
                                    <span style="font-size:0.7rem; color:var(--text-muted); text-transform:uppercase; letter-spacing:1px;">${shortDetail}</span>
                                    ${esLive
                                        ? (() => {
                                            const esHT = shortDetail.toLowerCase().includes('half') || shortDetail.toLowerCase().includes('ht');
                                            const etiqueta = esHT ? 'EN VIVO · HALF TIME' : `EN VIVO ${minuto}`;
                                            return `<span style="background:#ff4757; color:#fff; padding:3px 10px; border-radius:12px; font-size:0.7rem; font-weight:800; animation:pulse 1s infinite;">● ${etiqueta}</span>`;
                                          })()
                                        : `<span style="background:rgba(255,255,255,0.08); color:var(--text-muted); padding:3px 10px; border-radius:12px; font-size:0.7rem;">FINALIZADO</span>`}
                                </div>
                                <div style="display:grid; grid-template-columns:1fr auto 1fr; align-items:center; gap:0.8rem;">
                                    <div style="display:flex; align-items:center; gap:8px;">
                                        ${logoHtml(homeLogo, homeNombre)}
                                        <span style="font-weight:700; font-size:0.95rem;">${homeNombre}</span>
                                    </div>
                                    <div style="font-family:var(--font-heading); font-size:1.8rem; font-weight:900; color:var(--text-main); text-align:center; min-width:70px;">
                                        ${homeScore} - ${awayScore}
                                    </div>
                                    <div style="display:flex; align-items:center; gap:8px; justify-content:flex-end;">
                                        <span style="font-weight:700; font-size:0.95rem;">${awayNombre}</span>
                                        ${logoHtml(awayLogo, awayNombre)}
                                    </div>
                                </div>
                                <!-- Botón ver partido completo -->
                                <div style="margin-top:0.8rem; text-align:right;">
                                    <span style="font-size:0.75rem; color:var(--accent-neon); font-weight:700;">Ver partido completo →</span>
                                </div>
                            </div>`;
                    } else {
                        // Card tipo calendario — próximo
                        return `
                            <div class="glass-panel" style="padding:1.2rem; margin-bottom:1rem; border-left:3px solid var(--border-glass);">
                                <div style="display:grid; grid-template-columns:1fr auto 1fr; align-items:center; gap:0.8rem;">
                                    <div style="display:flex; align-items:center; gap:8px;">
                                        ${logoHtml(homeLogo, homeNombre)}
                                        <span style="font-weight:600; font-size:0.95rem;">${homeNombre}</span>
                                    </div>
                                    <div style="text-align:center; min-width:70px;">
                                        <div style="font-family:var(--font-heading); font-size:1.2rem; font-weight:900; color:var(--accent-neon);">${horaAR}</div>
                                        <div style="font-size:0.65rem; color:var(--text-muted); margin-top:2px; text-transform:uppercase; letter-spacing:1px;">ARG</div>
                                    </div>
                                    <div style="display:flex; align-items:center; gap:8px; justify-content:flex-end;">
                                        <span style="font-weight:600; font-size:0.95rem;">${awayNombre}</span>
                                        ${logoHtml(awayLogo, awayNombre)}
                                    </div>
                                </div>
                            </div>`;
                    }
                }).join('');

            } catch(err) {
                console.error('[H2H día]', err);
                container.innerHTML = `<div class="glass-panel" style="padding:2rem; text-align:center;"><p style="color:#ff4757;">Error cargando partidos.</p></div>`;
            }
        };

        // ── Expandir stats de un partido jugado/en vivo ───────────────────────
        window._expandirPartido = async (eventId, homeId, awayId, btn) => {
            const statsDiv = document.getElementById(`stats-${eventId}`);
            if (!statsDiv) return;

            // Toggle
            if (statsDiv.style.display === 'block') {
                statsDiv.style.display = 'none';
                btn.textContent = 'VER ESTADÍSTICAS ↓';
                return;
            }

            btn.textContent = 'Cargando...';
            btn.disabled = true;

            try {
                const [sumRes] = await Promise.all([
                    fetch(`${CF_WORKER}/?url=${encodeURIComponent(`https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/summary?event=${eventId}`)}`)
                ]);
                const summaryData = sumRes.ok ? await sumRes.json() : {};

                const rosterHome = (summaryData.rosters ?? []).find(r => r.team?.id === homeId);
                const rosterAway = (summaryData.rosters ?? []).find(r => r.team?.id === awayId);

                // Stats del partido — vienen en boxscore.teams identificadas por team.id
                const boxTeamHome = (summaryData.boxscore?.teams ?? []).find(t => t.team?.id === homeId);
                const boxTeamAway = (summaryData.boxscore?.teams ?? []).find(t => t.team?.id === awayId);
                const getStat = (boxTeam, name) =>
                    parseFloat(boxTeam?.statistics?.find(s => s.name === name)?.displayValue ?? '0') || 0;

                // Goleadores
                const goleadoresHome = [], goleadoresAway = [];
                (summaryData.keyEvents ?? []).forEach(ev => {
                    if (!ev.scoringPlay) return;
                    const nombre  = ev.participants?.[0]?.athlete?.displayName ?? '';
                    const minuto  = ev.clock?.displayValue ?? '';
                    if (ev.team?.id === homeId) goleadoresHome.push({ nombre, minuto });
                    else if (ev.team?.id === awayId) goleadoresAway.push({ nombre, minuto });
                });

                statsDiv.style.display = 'block';
                statsDiv.innerHTML = `
                    ${(goleadoresHome.length > 0 || goleadoresAway.length > 0) ? `
                    <div style="display:grid; grid-template-columns:1fr 1fr; gap:0.5rem; margin-bottom:1rem; font-size:0.82rem; color:var(--text-muted);">
                        <div>${goleadoresHome.map(g => `⚽ ${g.nombre} <span style="font-size:0.7rem;">${g.minuto}</span>`).join('<br>')}</div>
                        <div style="text-align:right;">${goleadoresAway.map(g => `<span style="font-size:0.7rem;">${g.minuto}</span> ${g.nombre} ⚽`).join('<br>')}</div>
                    </div>` : ''}

                    ${(boxTeamHome || boxTeamAway) ? `
                    <div style="border-top:1px solid var(--border-glass); padding-top:1rem; margin-bottom:1rem;">
                        ${statBar(getStat(boxTeamHome,'possessionPct'), getStat(boxTeamAway,'possessionPct'), 'POSESIÓN %')}
                        ${statBar(getStat(boxTeamHome,'totalShots'), getStat(boxTeamAway,'totalShots'), 'TIROS TOTALES')}
                        ${statBar(getStat(boxTeamHome,'shotsOnTarget'), getStat(boxTeamAway,'shotsOnTarget'), 'TIROS A PUERTA')}
                        ${statBar(getStat(boxTeamHome,'wonCorners'), getStat(boxTeamAway,'wonCorners'), 'CORNERS')}
                        ${statBar(getStat(boxTeamHome,'foulsCommitted'), getStat(boxTeamAway,'foulsCommitted'), 'FALTAS')}
                    </div>` : ''}

                    ${(rosterHome || rosterAway) ? `
                    <div style="border-top:1px solid var(--border-glass); padding-top:1rem;">
                        <p style="font-size:0.7rem; color:var(--accent-neon); text-transform:uppercase; letter-spacing:2px; text-align:center; margin-bottom:0.8rem;">ALINEACIONES</p>
                        <div style="display:grid; grid-template-columns:1fr 1fr; gap:0.8rem;">
                            <div>
                                <p style="text-align:center; font-size:0.75rem; font-weight:700; margin-bottom:6px; color:var(--text-muted);">${rosterHome?.team?.displayName ?? ''} <span style="color:var(--text-muted); opacity:0.6;">${rosterHome?.formation ?? ''}</span></p>
                                ${miniPizarra(rosterHome, homeId, '#e8e8f0', '#1a1a2e')}
                            </div>
                            <div>
                                <p style="text-align:center; font-size:0.75rem; font-weight:700; margin-bottom:6px; color:var(--text-muted);">${rosterAway?.team?.displayName ?? ''} <span style="color:var(--text-muted); opacity:0.6;">${rosterAway?.formation ?? ''}</span></p>
                                ${miniPizarra(rosterAway, awayId, '#cc2222', '#ffffff')}
                            </div>
                        </div>
                    </div>` : ''}
                `;

                btn.textContent = 'OCULTAR ↑';
                btn.disabled = false;

            } catch(err) {
                console.error('[expandir partido]', err);
                statsDiv.innerHTML = `<p style="color:#ff4757; font-size:0.85rem; text-align:center;">Error cargando estadísticas.</p>`;
                statsDiv.style.display = 'block';
                btn.textContent = 'VER ESTADÍSTICAS ↓';
                btn.disabled = false;
            }
        };

        // Cargar día default
        let _diaActivo = diaDefault.fecha;

        // Sobrescribir _seleccionarDia para trackear el día activo
        const _seleccionarDiaOriginal = window._seleccionarDia;
        window._seleccionarDia = async (fecha) => {
            _diaActivo = fecha;
            await _seleccionarDiaOriginal(fecha);
        };

        // Cargar inmediatamente
        window._seleccionarDia(diaDefault.fecha);

        // Auto-refresh cada 30s — siempre corre, recarga si hay partido en vivo
        setInterval(async () => {
            // Salir si el usuario navegó a otra vista
            if (!document.getElementById('h2h-partidos-dia')) return;

            try {
                const res = await fetch(`${CF_WORKER}/?url=${encodeURIComponent(`https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard?dates=${_diaActivo}`)}`);
                const data = res.ok ? await res.json() : {};
                const hayEnVivo = (data.events ?? []).some(ev =>
                    ev.competitions?.[0]?.status?.type?.state === 'in'
                );
                if (hayEnVivo) await _seleccionarDiaOriginal(_diaActivo);
            } catch(e) { /* silencioso */ }
        }, 30000);
    };

    // ── INFO ──────────────────────────────────────────────────────────────────
    const renderInfo = async () => {
        const CF_WORKER = 'https://whistle.solgoyhe.workers.dev';

        // Skeleton mientras carga
        appContainer.innerHTML = `
            ${renderNavbar('#/info')}
            <main class="page-container fade-in" style="max-width: 700px; margin: 0 auto;">
                <h2 class="section-title">📰 Noticias del Mundial</h2>
                <div id="info-container">
                    ${[1,2,3,4,5].map(() => `
                        <div class="glass-panel" style="padding:1.2rem; margin-bottom:1rem; display:flex; gap:1rem;">
                            <div class="skel-cell" style="width:90px; height:60px; border-radius:6px; flex-shrink:0;"></div>
                            <div style="flex:1;">
                                <div class="skel-cell" style="width:80px; height:14px; margin-bottom:8px;"></div>
                                <div class="skel-cell" style="width:100%; height:16px; margin-bottom:6px;"></div>
                                <div class="skel-cell" style="width:75%; height:13px;"></div>
                            </div>
                        </div>`).join('')}
                </div>
            </main>
        ${_closeSidebarWrapper()}
        `;

        try {
            const res  = await fetch(`${CF_WORKER}/?url=${encodeURIComponent('https://now.core.api.espn.com/v1/sports/news?sport=soccer&limit=30')}`);
            const data = res.ok ? await res.json() : {};
            const articulos = (data.headlines ?? []).filter(a => a.headline && a.description);

            if (articulos.length === 0) throw new Error('Sin artículos');

            // ── Categorizar cada artículo por tipo/keywords ───────────────────
            const categorizar = (art) => {
                const texto = (art.headline + ' ' + (art.description ?? '')).toLowerCase();
                const tipo  = art.type ?? '';

                if (tipo === 'Transfer' || texto.includes('transfer') || texto.includes('sign') || texto.includes('fichaj') || texto.includes('vende') || texto.includes('compra') || texto.includes('contrat'))
                    return { label: 'Mercado', color: '#f0a500', emoji: '🔄' };
                if (texto.includes('injur') || texto.includes('lesion') || texto.includes('lesión') || texto.includes('baja médica') || texto.includes('fractur') || texto.includes('ligament'))
                    return { label: 'Lesión', color: '#ff4757', emoji: '🚑' };
                if (texto.includes('coach') || texto.includes('manager') || texto.includes('dt ') || texto.includes('técnico') || texto.includes('entrenador') || texto.includes('sack') || texto.includes('fired') || texto.includes('appoint'))
                    return { label: 'Cuerpo Técnico', color: '#7d5fff', emoji: '🧠' };
                if (texto.includes('said') || texto.includes('says') || texto.includes('declared') || texto.includes('declaró') || texto.includes('afirmó') || texto.includes('press') || texto.includes('interview'))
                    return { label: 'Declaraciones', color: '#2ed573', emoji: '🎙️' };
                if (texto.includes('world cup') || texto.includes('mundial') || texto.includes('fifa') || texto.includes('group') || texto.includes('grupo'))
                    return { label: 'Mundial 2026', color: '#ffd700', emoji: '🏆' };
                return { label: 'Noticias', color: 'var(--accent-neon)', emoji: '📰' };
            };

            // ── Tiempo relativo ───────────────────────────────────────────────
            const tiempoRelativo = (fechaStr) => {
                const diff = Math.floor((Date.now() - new Date(fechaStr)) / 1000);
                if (diff < 60)   return 'Hace un momento';
                if (diff < 3600) return `Hace ${Math.floor(diff/60)} min`;
                if (diff < 86400) return `Hace ${Math.floor(diff/3600)} h`;
                return `Hace ${Math.floor(diff/86400)} días`;
            };

            // ── Traducir solo para Pro+ ───────────────────────────────────────────
            if (_esPro()) try {
                const payload = articulos.map((a, i) => i + '|' + a.headline + '|' + (a.description || '')).join('\n');
                const prompt  = 'Traduc\u00ed al espa\u00f1ol rioplatense cada l\u00ednea. Formato exacto: INDEX|TITULAR|DESCRIPCION. Una l\u00ednea por noticia. Solo devolv\u00e9 las l\u00edneas, sin explicaciones ni markdown.\n\n' + payload;
                const tradRes = await fetch('https://api.anthropic.com/v1/messages', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        model: 'claude-sonnet-4-6',
                        max_tokens: 4000,
                        messages: [{ role: 'user', content: prompt }]
                    })
                });
                const tradData = await tradRes.json();
                const tradText = tradData.content?.[0]?.text ?? '';
                tradText.split('\n').forEach(linea => {
                    const partes = linea.split('|');
                    if (partes.length < 2) return;
                    const idx = parseInt(partes[0]);
                    if (isNaN(idx) || !articulos[idx]) return;
                    if (partes[1]) articulos[idx].headline    = partes[1].trim();
                    if (partes[2]) articulos[idx].description = partes[2].trim();
                });
            } catch(tradErr) {
                console.warn('[Info] Traducci\u00f3n fall\u00f3, mostrando en ingl\u00e9s:', tradErr);
            }

            // ── Agrupar por categoría ─────────────────────────────────────────
            const grupos = {};
            articulos.forEach(art => {
                const cat = categorizar(art);
                if (!grupos[cat.label]) grupos[cat.label] = { ...cat, items: [] };
                grupos[cat.label].items.push(art);
            });

            // Orden de categorías
            const ordenCats = ['Mundial 2026', 'Declaraciones', 'Mercado', 'Cuerpo Técnico', 'Lesión', 'Noticias'];
            const gruposOrdenados = ordenCats
                .filter(c => grupos[c])
                .map(c => grupos[c]);

            const container = document.getElementById('info-container');
            if (!container) return;

            container.innerHTML = gruposOrdenados.map(grupo => `
                <div style="margin-bottom:2rem;">
                    <h3 style="font-family:var(--font-heading); font-size:0.75rem; font-weight:800; text-transform:uppercase;
                        letter-spacing:2px; color:${grupo.color}; margin-bottom:1rem; padding-bottom:6px;
                        border-bottom:1px solid var(--border-glass);">
                        ${grupo.emoji} ${grupo.label}
                    </h3>
                    ${grupo.items.map((art, artIdx) => {
                        const img    = art.images?.find(i => i.type === 'header')?.url ?? '';
                        const tiempo = tiempoRelativo(art.published ?? art.lastModified ?? '');
                        const artId  = 'art-' + grupo.label.replace(/\s/g,'-') + '-' + artIdx;
                        return `
                            <div class="glass-panel" style="padding:1rem; display:flex; gap:1rem; align-items:flex-start;
                                transition:background 0.2s; cursor:pointer; margin-bottom:0.8rem;"
                                onmouseover="this.style.background='rgba(255,255,255,0.06)'"
                                onmouseout="this.style.background=''"
                                onclick="window._abrirNoticia('${artId}')">
                                ${img ? `
                                    <img src="${img}" alt="" width="90" height="60"
                                        style="object-fit:cover; border-radius:6px; flex-shrink:0;"
                                        onerror="this.style.display='none'">
                                ` : `
                                    <div style="width:90px; height:60px; border-radius:6px; background:rgba(255,255,255,0.06);
                                        display:flex; align-items:center; justify-content:center; flex-shrink:0; font-size:1.5rem;">
                                        ${grupo.emoji}
                                    </div>
                                `}
                                <div style="flex:1; min-width:0;">
                                    <div style="font-size:0.7rem; color:var(--text-muted); margin-bottom:5px;">${tiempo}</div>
                                    <p style="font-weight:700; font-size:0.9rem; line-height:1.3; margin:0 0 5px 0;
                                        white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
                                        ${art.headline}
                                    </p>
                                    <p style="font-size:0.78rem; color:var(--text-muted); margin:0; line-height:1.4;
                                        display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden;">
                                        ${art.description}
                                    </p>
                                </div>
                            </div>
                            <!-- Modal de noticia -->
                            <div id="${artId}" style="display:none; position:fixed; inset:0; z-index:9999;
                                background:rgba(0,0,0,0.85); overflow-y:auto; padding:1rem;">
                                <div style="max-width:680px; margin:0 auto; padding-bottom:4rem;">
                                    <button onclick="window._cerrarNoticia('${artId}')"
                                        style="background:rgba(255,255,255,0.08); border:1px solid var(--border-glass);
                                        color:var(--text-main); padding:8px 16px; border-radius:8px; cursor:pointer;
                                        font-family:var(--font-heading); font-weight:700; font-size:0.85rem;
                                        margin-bottom:1rem; display:flex; align-items:center; gap:6px;">
                                        ← Volver
                                    </button>
                                    <div class="glass-panel" style="padding:1.5rem;">
                                        ${img ? `<img src="${img}" alt="" style="width:100%; border-radius:8px; margin-bottom:1.2rem; object-fit:cover; max-height:280px;">` : ''}
                                        <div style="font-size:0.7rem; color:var(--text-muted); margin-bottom:8px; text-transform:uppercase; letter-spacing:1px;">${tiempo}</div>
                                        <h2 style="font-family:var(--font-heading); font-size:1.3rem; font-weight:800; line-height:1.3; margin:0 0 1rem 0;">
                                            ${art.headline}
                                        </h2>
                                        <p style="font-size:0.95rem; color:var(--text-muted); line-height:1.6; margin:0 0 1.5rem 0;">
                                            ${art.description}
                                        </p>
                                        <a href="${art.links?.web?.href ?? '#'}" target="_blank" rel="noopener"
                                            style="display:inline-block; padding:10px 20px; background:var(--accent-neon);
                                            color:#000; font-weight:800; font-family:var(--font-heading); border-radius:8px;
                                            text-decoration:none; font-size:0.9rem; letter-spacing:1px;">
                                            VER NOTA COMPLETA EN ESPN →
                                        </a>
                                    </div>
                                </div>
                            </div>`;
                    }).join('')}
                </div>
            `).join('');

        } catch(err) {
            console.error('[Info]', err);
            const container = document.getElementById('info-container');
            if (container) container.innerHTML = `
                <div class="glass-panel" style="padding:2rem; text-align:center;">
                    <p style="color:var(--text-muted);">No se pudieron cargar las noticias.</p>
                </div>`;
        }

        // Funciones de modal de noticias
        window._abrirNoticia = (id) => {
            const modal = document.getElementById(id);
            if (!modal) return;
            modal.style.display = 'block';
            document.body.style.overflow = 'hidden';
        };
        window._cerrarNoticia = (id) => {
            const modal = document.getElementById(id);
            if (!modal) return;
            modal.style.display = 'none';
            document.body.style.overflow = '';
        };
    };

    // ── LOGIN ─────────────────────────────────────────────────────────────────
    // ── LANDING ───────────────────────────────────────────────────────────────
    // ── Referencia en USD para visitantes de fuera de Argentina ──────────────
    // Los productos se cobran en ARS (una sola moneda en Lemon). A los de afuera
    // les mostramos una referencia aproximada en dólares. Si geo/cotización fallan,
    // se queda solo el precio en ARS (no rompe nada). Llena el div #ref-usd.
    const _refUSD = async () => {
        const cont = document.getElementById('ref-usd');
        if (!cont) return;
        try {
            // País (caché 24 h)
            let pais = null;
            const gc = JSON.parse(localStorage.getItem('whistle_geo') || 'null');
            if (gc && Date.now() - gc.ts < 864e5) pais = gc.pais;
            else {
                const g = await fetch('https://ipwho.is/').then(r => r.json());
                pais = g?.country_code ?? null;
                if (pais) localStorage.setItem('whistle_geo', JSON.stringify({ pais, ts: Date.now() }));
            }
            if (!pais || pais === 'AR') return; // argentinos (o geo desconocida): solo ARS

            // Cotización ARS por USD (caché 6 h)
            let arsUsd = null;
            const fc = JSON.parse(localStorage.getItem('whistle_fx_ars') || 'null');
            if (fc && Date.now() - fc.ts < 6 * 36e5) arsUsd = fc.rate;
            else {
                const d = await fetch('https://open.er-api.com/v6/latest/USD').then(r => r.json());
                arsUsd = d?.rates?.ARS ?? null;
                if (arsUsd) localStorage.setItem('whistle_fx_ars', JSON.stringify({ rate: arsUsd, ts: Date.now() }));
            }
            if (!arsUsd) return;

            const usd = ars => Math.round(ars / arsUsd);
            cont.style.display = '';
            cont.innerHTML = `💵 Los precios están en <strong>pesos argentinos (ARS)</strong>. Referencia aprox.: <strong>Platea ≈ US$${usd(6500)}/mes</strong> · <strong>Palco ≈ US$${usd(15000)}/mes</strong>. El cobro se realiza en ARS.`;
        } catch (e) { /* si falla, se muestra solo el precio en ARS */ }
    };

    const renderLanding = () => {
        appContainer.innerHTML = `
            <main style="min-height:100vh; background:var(--bg-color); overflow-y:auto;">

                <!-- Hero -->
                <div style="display:flex; flex-direction:column; align-items:center; justify-content:center;
                    padding: 5rem 1.5rem 3rem; text-align:center;">
                    <div style="font-family:var(--font-heading); font-size:clamp(3rem,10vw,5.5rem);
                        font-weight:900; letter-spacing:4px; text-shadow:0 0 40px rgba(61,111,255,0.3); margin-bottom:0.5rem;">
                        <span style="color:var(--accent-neon);">WHISTLE</span>
                    </div>
                    <p style="font-size:clamp(0.95rem,2.5vw,1.1rem); color:var(--text-muted); margin-bottom:2.5rem; max-width:480px; line-height:1.6; text-align:center;">
                        The sound of sport.
                    </p>
                    <div style="display:flex; gap:1rem; flex-wrap:wrap; justify-content:center; margin-bottom:4rem;">
                        <button onclick="abrirAuth('registro')"
                            style="padding:14px 32px; background:linear-gradient(135deg,#3D6FFF,#8B5CF6); color:#fff; font-weight:900;
                            font-family:var(--font-heading); border:none; border-radius:8px; cursor:pointer;
                            font-size:1rem; letter-spacing:1px; transition:opacity 0.2s;"
                            onmouseover="this.style.opacity='0.85'" onmouseout="this.style.opacity='1'">
                            EMPEZAR GRATIS
                        </button>
                        <button onclick="abrirAuth('login')"
                            style="padding:14px 32px; background:transparent; color:var(--text-main); font-weight:700;
                            font-family:var(--font-heading); border:2px solid var(--border-glass); border-radius:8px;
                            cursor:pointer; font-size:1rem; letter-spacing:1px; transition:border-color 0.2s;"
                            onmouseover="this.style.borderColor='var(--accent-neon)'" onmouseout="this.style.borderColor='var(--border-glass)'">
                            Ya tengo cuenta
                        </button>
                    </div>

                    <!-- Features -->
                    <div style="display:grid; grid-template-columns:repeat(auto-fit,minmax(180px,1fr));
                        gap:1.2rem; max-width:860px; width:100%; margin-bottom:5rem;">
                        ${[
                            {icon:'📊', titulo:'Stats en vivo', desc:'Posesión, tiros, corners y más de cada partido.'},
                            {icon:'🗺️', titulo:'Pizarra táctica', desc:'Alineaciones con formación real de ESPN.'},
                            {icon:'📰', titulo:'Noticias traducidas', desc:'Las últimas del Mundial en español rioplatense.'},
                            {icon:'⚔️', titulo:'Partidos del día', desc:'Calendario completo con horarios ARG.'},
                        ].map(f => `
                            <div class="glass-panel" style="padding:1.5rem; text-align:center;">
                                <div style="font-size:2rem; margin-bottom:0.8rem;">${f.icon}</div>
                                <div style="font-weight:700; font-size:0.95rem; margin-bottom:0.4rem;">${f.titulo}</div>
                                <div style="font-size:0.78rem; color:var(--text-muted); line-height:1.5;">${f.desc}</div>
                            </div>`).join('')}
                    </div>

                    <!-- Toggle mensual/anual -->
                    <p style="font-family:var(--font-heading); font-size:0.75rem; font-weight:800;
                        text-transform:uppercase; letter-spacing:3px; color:var(--accent-neon); margin-bottom:1.5rem;">
                        ⚡ Elegí tu plan
                    </p>
                    <div style="display:flex; align-items:center; justify-content:center; gap:12px; margin-bottom:2rem;">
                        <span id="toggle-label-mes" style="font-size:0.85rem; font-weight:700; color:var(--accent-neon);">Mensual</span>
                        <div onclick="window._togglePeriodo()"
                            style="width:44px; height:24px; background:rgba(255,255,255,0.1);
                            border:1px solid var(--border-glass); border-radius:12px; cursor:pointer; position:relative;">
                            <div id="toggle-dot" style="width:18px; height:18px; background:var(--accent-neon);
                                border-radius:50%; position:absolute; top:3px; left:3px; transition:left 0.2s;"></div>
                        </div>
                        <span id="toggle-label-anual" style="font-size:0.85rem; color:var(--text-muted);">
                            Anual
                            <span style="background:rgba(61,111,255,0.15); color:var(--accent-neon);
                                padding:1px 7px; border-radius:10px; font-size:0.68rem; font-weight:800; margin-left:4px;">
                                -33%
                            </span>
                        </span>
                    </div>

                    <!-- Referencia USD (exterior) -->
                    <div id="ref-usd" style="display:none; max-width:860px; width:100%; box-sizing:border-box; background:rgba(61,111,255,0.08); border:1px solid rgba(61,111,255,0.2); border-radius:12px; padding:0.9rem 1.1rem; margin-bottom:1.5rem; font-size:0.8rem; color:var(--text-sub); line-height:1.5;"></div>

                    <!-- Planes -->
                    <div style="display:grid; grid-template-columns:repeat(auto-fit,minmax(220px,1fr));
                        gap:1.5rem; max-width:860px; width:100%; padding-bottom:5rem;">

                        <!-- FREE -->
                        <div class="glass-panel" style="padding:1.8rem; text-align:left;">
                            <div style="font-size:1.8rem; margin-bottom:0.5rem;">⚽</div>
                            <div style="font-family:var(--font-heading); font-size:1.3rem; font-weight:900; margin-bottom:0.3rem;">Popular</div>
                            <div style="font-family:var(--font-heading); font-size:1.8rem; font-weight:900; color:var(--text-muted); margin-bottom:0.8rem;">Gratis</div>
                            <p style="font-size:0.78rem; color:var(--text-muted); line-height:1.5; margin-bottom:1.2rem;">
                                La cancha siempre abierta. Seguí el Mundial, los partidos del día y tu liga favorita sin pagar nada.
                            </p>
                            ${[
                                {t:'Tabla de grupos Mundial 2026', ok:true},
                                {t:'Partidos del día', ok:true},
                                {t:'Estadísticas del partido', ok:true},
                                {t:'Alineaciones tácticas', ok:true},
                                {t:'Noticias básicas', ok:true},
                                {t:'1 liga a elección', ok:true},
                                {t:'Todas las ligas', ok:false},
                                {t:'Análisis IA pre-partido', ok:false, prox:true},
                                {t:'Todos los deportes', ok:false},
                            ].map(f => `
                                <div style="display:flex; align-items:center; gap:8px; font-size:0.8rem;
                                    margin-bottom:7px; color:${f.ok ? 'var(--text-main)' : 'var(--text-muted)'};">
                                    <span>${f.ok ? '✅' : '🔒'}</span><span>${f.t}</span>
                                    ${f.prox ? '<span style="font-size:0.6rem; font-weight:800; background:rgba(245,195,59,0.16); color:var(--gold); padding:2px 7px; border-radius:10px; letter-spacing:0.04em;">PRONTO</span>' : ''}
                                </div>`).join('')}
                            <button onclick="abrirAuth('registro')"
                                style="width:100%; margin-top:1.5rem; padding:11px; background:transparent;
                                color:var(--text-main); font-weight:700; font-family:var(--font-heading);
                                border:2px solid var(--border-glass); border-radius:8px; cursor:pointer;
                                font-size:0.9rem; letter-spacing:1px;">
                                EMPEZAR
                            </button>
                        </div>

                        <!-- PRO -->
                        <div class="glass-panel" style="padding:1.8rem; text-align:left;
                            border-color:var(--accent-neon); background:rgba(61,111,255,0.04); position:relative;">
                            <div style="position:absolute; top:-12px; left:50%; transform:translateX(-50%);
                                background:linear-gradient(135deg,#3D6FFF,#8B5CF6); color:#fff; font-size:0.65rem; font-weight:800;
                                padding:3px 14px; border-radius:20px; font-family:var(--font-heading); letter-spacing:1px; white-space:nowrap;">
                                MÁS POPULAR
                            </div>
                            <div style="font-size:1.8rem; margin-bottom:0.5rem;">🎟️</div>
                            <div style="font-family:var(--font-heading); font-size:1.3rem; font-weight:900;
                                color:var(--accent-neon); margin-bottom:0.3rem;">Platea</div>
                            <div id="precio-pro" style="font-family:var(--font-heading); font-size:1.8rem;
                                font-weight:900; color:var(--accent-neon); margin-bottom:0.8rem;">
                                $6.500<span style="font-size:0.85rem; color:var(--text-muted);">/mes</span>
                            </div>
                            <p style="font-size:0.78rem; color:var(--text-muted); line-height:1.5; margin-bottom:1.2rem;">
                                Todas las ligas de fútbol, estadísticas completas, alineaciones tácticas y noticias traducidas. Viví el fútbol desde la Platea.
                            </p>
                            ${[
                                {t:'Todo lo de Popular', ok:true},
                                {t:'Análisis IA pre-partido', ok:true, prox:true},
                                {t:'Todas las ligas de fútbol', ok:true},
                                {t:'Noticias traducidas', ok:true},
                                {t:'Equipo favorito', ok:true},
                                {t:'Todos los deportes', ok:false},
                                {t:'Notificaciones en vivo', ok:false},
                            ].map(f => `
                                <div style="display:flex; align-items:center; gap:8px; font-size:0.8rem;
                                    margin-bottom:7px; color:${f.ok ? 'var(--text-main)' : 'var(--text-muted)'};">
                                    <span>${f.ok ? '✅' : '🔒'}</span><span>${f.t}</span>
                                    ${f.prox ? '<span style="font-size:0.6rem; font-weight:800; background:rgba(245,195,59,0.16); color:var(--gold); padding:2px 7px; border-radius:10px; letter-spacing:0.04em;">PRONTO</span>' : ''}
                                </div>`).join('')}
                            <button id="btn-pro_mensual" onclick="window._suscribirse('pro_mensual')"
                                style="width:100%; margin-top:1.5rem; padding:11px; background:var(--accent-neon);
                                color:#000; font-weight:900; font-family:var(--font-heading);
                                border:none; border-radius:8px; cursor:pointer;
                                font-size:0.9rem; letter-spacing:1px;">
                                SUSCRIBIRME
                            </button>
                        </div>

                        <!-- PRO MAX -->
                        <div class="glass-panel" style="padding:1.8rem; text-align:left;
                            border-color:#ffd700; background:rgba(255,215,0,0.04); position:relative;">
                            <div style="font-size:1.8rem; margin-bottom:0.5rem;">👑</div>
                            <div style="font-family:var(--font-heading); font-size:1.3rem; font-weight:900;
                                color:#ffd700; margin-bottom:0.3rem;">Palco</div>
                            <div id="precio-promax" style="font-family:var(--font-heading); font-size:1.8rem;
                                font-weight:900; color:#ffd700; margin-bottom:0.8rem;">
                                $15.000<span style="font-size:0.85rem; color:var(--text-muted);">/mes</span>
                            </div>
                            <p style="font-size:0.78rem; color:var(--text-muted); line-height:1.5; margin-bottom:1.2rem;">
                                Acceso completo a todas las ligas, deportes y estadísticas. Notificaciones en tiempo real e historial extendido. La experiencia definitiva.
                            </p>
                            ${[
                                {t:'Todo lo de Platea', ok:true},
                                {t:'Todos los deportes', ok:true},
                                {t:'Notificaciones en vivo', ok:true},
                                {t:'Historial extendido', ok:true},
                                {t:'Acceso anticipado a features', ok:true},
                                {t:'Sin publicidad', ok:true},
                            ].map(f => `
                                <div style="display:flex; align-items:center; gap:8px; font-size:0.8rem;
                                    margin-bottom:7px; color:var(--text-main);">
                                    <span>✅</span><span>${f.t}</span>
                                </div>`).join('')}
                            <button id="btn-promax_mensual" onclick="window._suscribirse('promax_mensual')"
                                style="width:100%; margin-top:1.5rem; padding:11px; background:#ffd700;
                                color:#000; font-weight:900; font-family:var(--font-heading);
                                border:none; border-radius:8px; cursor:pointer;
                                font-size:0.9rem; letter-spacing:1px;">
                                SUSCRIBIRME
                            </button>
                        </div>

                    </div>
                </div>
            </main>
        `;
        _refUSD();
    };

    // ── PERFIL ────────────────────────────────────────────────────────────────
    // ── PUSH NOTIFICATIONS ───────────────────────────────────────────────────
    const CF_WORKER_PUSH = 'https://whistle.solgoyhe.workers.dev';

    const _urlBase64ToUint8Array = (base64String) => {
        const padding = '='.repeat((4 - base64String.length % 4) % 4);
        const base64  = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
        const raw     = atob(base64);
        return new Uint8Array([...raw].map(c => c.charCodeAt(0)));
    };

    const pushEstaActivo = async () => {
        if (!('serviceWorker' in navigator) || !('PushManager' in window)) return false;
        const reg = await navigator.serviceWorker.getRegistration('/sw.js').catch(() => null);
        if (!reg) return false;
        const sub = await reg.pushManager.getSubscription().catch(() => null);
        return !!sub;
    };

    window._activarPush = async (btnEl) => {
        if (window.FirebaseAuth?.getPlan() !== 'promax') return;
        if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
            alert('Tu navegador no soporta notificaciones push.');
            return;
        }
        try {
            btnEl.textContent = 'Activando...';
            btnEl.disabled = true;
            const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
            await navigator.serviceWorker.ready;
            const permiso = await Notification.requestPermission();
            if (permiso !== 'granted') { btnEl.textContent = '🔔 ACTIVAR NOTIFICACIONES'; btnEl.disabled = false; return; }
            const vapidRes = await fetch(`${CF_WORKER_PUSH}/push/vapid-key`);
            const { key: vapidKey } = await vapidRes.json();
            const subscription = await reg.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: _urlBase64ToUint8Array(vapidKey),
            });
            const perfil = window.FirebaseAuth?.getPerfil();
            const uid    = window.FirebaseAuth?.getUser()?.uid;
            await fetch(`${CF_WORKER_PUSH}/push/suscribir`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    uid, subscription: subscription.toJSON(),
                    equipoFavorito: perfil?.equipoFavorito ?? '',
                    ligas: perfil?.ligaNacional ? [perfil.ligaNacional] : [],
                }),
            });
            const estadoEl = document.getElementById('push-estado');
            if (estadoEl) estadoEl.innerHTML = `
                <span style="color:var(--accent-neon); font-weight:700;">🔔 Notificaciones activas</span>
                <button onclick="window._desactivarPush(this)"
                    style="margin-left:12px; background:none; border:1px solid #ff4757;
                    color:#ff4757; border-radius:6px; padding:4px 10px; cursor:pointer;
                    font-size:0.75rem; font-family:var(--font-heading);">DESACTIVAR</button>`;
        } catch(err) {
            console.error('[PUSH]', err);
            btnEl.textContent = '⚠️ Error — Intentá de nuevo';
            btnEl.disabled = false;
        }
    };

    window._desactivarPush = async (btnEl) => {
        try {
            btnEl.textContent = 'Desactivando...'; btnEl.disabled = true;
            const reg = await navigator.serviceWorker.getRegistration('/sw.js').catch(() => null);
            if (reg) { const sub = await reg.pushManager.getSubscription().catch(() => null); if (sub) await sub.unsubscribe(); }
            const uid = window.FirebaseAuth?.getUser()?.uid;
            if (uid) await fetch(`${CF_WORKER_PUSH}/push/desuscribir`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ uid }) });
            const estadoEl = document.getElementById('push-estado');
            if (estadoEl) estadoEl.innerHTML = `<button id="push-btn-activar" class="btn-primary" onclick="window._activarPush(this)" style="width:100%;">🔔 ACTIVAR NOTIFICACIONES</button>`;
        } catch(err) { console.error('[PUSH]', err); btnEl.textContent = '⚠️ Error'; btnEl.disabled = false; }
    };

    const renderPerfil = async () => {
        const user   = window.FirebaseAuth?.getUser();
        const perfil = window.FirebaseAuth?.getPerfil();
        const plan   = window.FirebaseAuth?.getPlan() ?? 'free';

        const planMeta = {
            free:   { color: '#888',    bg: 'rgba(136,136,136,0.2)', emoji: '⚽', label: 'POPULAR' },
            pro:    { color: '#3D6FFF', bg: 'rgba(61,111,255,0.2)',   emoji: '🎟️', label: 'PLATEA'  },
            promax: { color: '#ffd700', bg: 'rgba(255,215,0,0.2)',   emoji: '👑', label: 'PALCO'   },
        };
        const meta = planMeta[plan] ?? planMeta.free;

        const DEPORTES_DISP = [
            {id:'basketball', nombre:'Básquet',            emoji:'🏀'},
            {id:'tennis',     nombre:'Tenis',              emoji:'🎾'},
            {id:'racing',     nombre:'Fórmula 1',          emoji:'🏎️'},
            {id:'football',   nombre:'Fútbol Americano',   emoji:'🏈'},
            {id:'baseball',   nombre:'Baseball',           emoji:'⚾'},
            {id:'hockey',     nombre:'Hockey sobre Hielo', emoji:'🏒'},
            {id:'golf',       nombre:'Golf',               emoji:'⛳'},
            {id:'mma',        nombre:'MMA',                emoji:'🥊'},
            {id:'rugby',      nombre:'Rugby',              emoji:'🏉'},
        ];

        const maxDep = plan === 'promax' ? 99 : plan === 'pro' ? 1 : 0;
        window._deportesPerfil = [...(perfil?.deportes ?? [])];

        const _renderDeportes = (deportesActuales) => {
            if (maxDep === 0) return `
                <div class="glass-panel" style="padding:1.5rem; margin-bottom:1.5rem;">
                    <h3 class="panel-title" style="margin-bottom:1rem;">🏅 Otros deportes</h3>
                    <div style="text-align:center; padding:1.5rem; border:1px dashed var(--border-glass); border-radius:12px;">
                        <div style="font-size:2rem; margin-bottom:0.5rem;">🔒</div>
                        <p style="color:var(--text-muted); font-size:0.85rem; margin-bottom:1rem;">Disponibles desde el plan Platea.</p>
                        <button class="btn-primary" style="background:#3D6FFF; color:#000;" onclick="window.location.hash='#/planes'">VER PLANES →</button>
                    </div>
                </div>`;

            const planLabel = plan === 'pro'
                ? '🎟️ Plan Platea — podés elegir 1 deporte adicional.'
                : '👑 Plan Palco — elegí todos los que quieras.';

            const cards = DEPORTES_DISP.map(d => {
                const sel  = deportesActuales.includes(d.id);
                const bloq = !sel && deportesActuales.length >= maxDep;
                return `<div ${bloq ? '' : `onclick="window._perfilToggleDeporte('${d.id}')"`}
                    style="padding:12px; border-radius:8px; text-align:center; transition:all 0.2s;
                    border:2px solid ${sel ? 'var(--accent-neon)' : 'var(--border-glass)'};
                    background:${sel ? 'rgba(61,111,255,0.1)' : 'rgba(255,255,255,0.03)'};
                    cursor:${bloq ? 'default' : 'pointer'}; opacity:${bloq ? '0.4' : '1'};">
                    <div style="font-size:1.5rem; margin-bottom:4px;">${d.emoji}</div>
                    <div style="font-size:0.78rem; font-weight:600;">${d.nombre}</div>
                    ${sel ? '<div style="font-size:0.65rem; color:var(--accent-neon); margin-top:3px;">✓ Elegido</div>' : ''}
                </div>`;
            }).join('');

            return `
                <div class="glass-panel" style="padding:1.5rem; margin-bottom:1.5rem;">
                    <h3 class="panel-title" style="margin-bottom:0.5rem;">🏅 Mis deportes</h3>
                    <p style="color:var(--text-muted); font-size:0.8rem; margin-bottom:1.2rem;">${planLabel} El fútbol siempre está incluido.</p>
                    <div id="deportes-grid" style="display:grid; grid-template-columns:repeat(auto-fill,minmax(110px,1fr)); gap:0.6rem; margin-bottom:1.2rem;">
                        ${cards}
                    </div>
                    <button class="btn-primary" onclick="window._perfilGuardarDeportes()" style="width:100%;">GUARDAR DEPORTES</button>
                    <div id="deportes-ok" style="display:none; color:var(--accent-neon); font-size:0.85rem; font-weight:700; margin-top:8px; text-align:center;">✓ Deportes guardados</div>
                </div>`;
        };

        // Push status
        const pushActivo = plan === 'promax' ? await pushEstaActivo() : false;

        appContainer.innerHTML = `
            ${renderNavbar('#/perfil')}
            <main class="page-container fade-in" style="max-width:600px; margin:0 auto;">
                <h2 class="section-title">👤 Mi Perfil</h2>

                <!-- Info del usuario -->
                <div class="glass-panel" style="padding:1.5rem; margin-bottom:1.5rem;">
                    <div style="display:flex; align-items:center; gap:1.2rem;">
                        <div style="width:60px; height:60px; border-radius:50%;
                            background:${meta.bg}; border:2px solid ${meta.color};
                            display:flex; align-items:center; justify-content:center;
                            font-size:1.5rem; font-weight:800; font-family:var(--font-heading);">
                            ${(perfil?.nombre ?? 'U').charAt(0).toUpperCase()}
                        </div>
                        <div>
                            <div style="font-weight:800; font-size:1.1rem;">${perfil?.nombre ?? 'Usuario'}</div>
                            <div style="color:var(--text-muted); font-size:0.85rem;">${user?.email ?? ''}</div>
                            <div style="margin-top:4px;">
                                <span style="background:${meta.bg}; color:${meta.color};
                                    padding:2px 10px; border-radius:20px; font-size:0.7rem; font-weight:800;
                                    font-family:var(--font-heading); letter-spacing:1px;">
                                    ${meta.emoji} ${meta.label}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Equipo favorito -->
                <div class="glass-panel" style="padding:1.5rem; margin-bottom:1.5rem;">
                    <h3 class="panel-title" style="margin-bottom:1rem;">⭐ Equipo Favorito</h3>
                    <select id="equipo-fav-select" style="width:100%; background:var(--surface-color);
                        color:var(--text-main); border:1px solid var(--border-glass); border-radius:8px;
                        padding:10px; font-size:0.9rem; cursor:pointer; margin-bottom:1rem; color-scheme:dark;">
                        <option value="">— Sin seleccionar —</option>
                        ${[
                            {id:'202',n:'🇦🇷 Argentina'},{id:'478',n:'🇫🇷 Francia'},{id:'205',n:'🇧🇷 Brasil'},
                            {id:'164',n:'🇪🇸 España'},{id:'481',n:'🇩🇪 Alemania'},{id:'482',n:'🇵🇹 Portugal'},
                            {id:'448',n:'🏴󠁧󠁢󠁥󠁮󠁧󠁿 Inglaterra'},{id:'449',n:'🇳🇱 Países Bajos'},{id:'660',n:'🇺🇸 Estados Unidos'},
                            {id:'203',n:'🇲🇽 México'},{id:'212',n:'🇺🇾 Uruguay'},{id:'208',n:'🇨🇴 Colombia'},
                            {id:'206',n:'🇨🇦 Canadá'},{id:'475',n:'🇨🇭 Suiza'},{id:'477',n:'🇭🇷 Croacia'},
                        ].map(e => `<option value="${e.id}" ${perfil?.equipoFavorito === e.id ? 'selected' : ''}>${e.n}</option>`).join('')}
                    </select>
                    <button class="btn-primary" onclick="window._guardarEquipoFav()">GUARDAR</button>
                    <span id="fav-ok" style="display:none; color:var(--accent-neon); font-size:0.85rem; margin-left:10px; font-weight:700;">✓ Guardado</span>
                </div>

                <!-- Deportes -->
                <div id="deportes-section">${_renderDeportes(window._deportesPerfil)}</div>

                <!-- Notificaciones (solo Palco) -->
                <div class="glass-panel" style="padding:1.5rem; margin-bottom:1.5rem;">
                    <h3 class="panel-title" style="margin-bottom:0.5rem;">🔔 Notificaciones en vivo</h3>
                    ${plan !== 'promax' ? `
                        <div style="text-align:center; padding:1rem; border:1px dashed var(--border-glass); border-radius:12px;">
                            <div style="font-size:2rem; margin-bottom:0.5rem;">🔒</div>
                            <p style="color:var(--text-muted); font-size:0.85rem; margin-bottom:1rem;">Exclusivas del plan Palco.</p>
                            <button class="btn-primary" style="background:#ffd700; color:#000;" onclick="window.location.hash='#/planes'">VER PALCO 👑</button>
                        </div>
                    ` : `
                        <p style="color:var(--text-muted); font-size:0.8rem; margin-bottom:1.2rem;">
                            Recibí una notificación cuando tu equipo favorito meta un gol.
                        </p>
                        <div id="push-estado">
                            ${pushActivo ? `
                                <span style="color:var(--accent-neon); font-weight:700;">🔔 Notificaciones activas</span>
                                <button onclick="window._desactivarPush(this)"
                                    style="margin-left:12px; background:none; border:1px solid #ff4757;
                                    color:#ff4757; border-radius:6px; padding:4px 10px; cursor:pointer;
                                    font-size:0.75rem; font-family:var(--font-heading);">DESACTIVAR</button>
                            ` : `
                                <button id="push-btn-activar" class="btn-primary"
                                    onclick="window._activarPush(this)" style="width:100%;">
                                    🔔 ACTIVAR NOTIFICACIONES
                                </button>
                            `}
                        </div>
                    `}
                </div>

                <!-- Plan actual -->
                <div class="glass-panel" style="padding:1.5rem; margin-bottom:1.5rem;">
                    <h3 class="panel-title" style="margin-bottom:1rem;">💳 Plan Actual</h3>
                    ${plan === 'promax' ? `
                        <div style="text-align:center; padding:1rem;">
                            <div style="font-size:2rem; margin-bottom:0.5rem;">👑</div>
                            <div style="font-family:var(--font-heading); font-size:1.2rem; font-weight:800; color:#ffd700;">Palco activo</div>
                            <p style="color:var(--text-muted); font-size:0.85rem; margin-top:0.5rem;">Tenés acceso a todas las funciones.</p>
                        </div>
                    ` : plan === 'pro' ? `
                        <div style="text-align:center; padding:1rem;">
                            <div style="font-size:2rem; margin-bottom:0.5rem;">🎟️</div>
                            <div style="font-family:var(--font-heading); font-size:1.2rem; font-weight:800; color:#3D6FFF;">Platea activo</div>
                            <button class="btn-primary" style="margin-top:1rem; background:#ffd700; color:#000;"
                                onclick="window.location.hash='#/planes'">PASARTE A PALCO 👑</button>
                        </div>
                    ` : `
                        <p style="color:var(--text-muted); font-size:0.9rem; margin-bottom:1rem;">
                            Estás en el plan <strong>Popular</strong>. Pasate a Platea para acceder a estadísticas, alineaciones, todas las ligas y más.
                        </p>
                        <button class="btn-primary" style="background:#3D6FFF; color:#000;" onclick="window.location.hash='#/planes'">
                            VER PLANES 🔥
                        </button>
                    `}
                </div>

                <!-- Cerrar sesión -->
                <button onclick="window.FirebaseAuth?.logout()"
                    style="width:100%; padding:12px; background:rgba(255,71,87,0.1); border:1px solid #ff4757;
                    color:#ff4757; border-radius:8px; cursor:pointer; font-family:var(--font-heading);
                    font-weight:700; letter-spacing:1px; margin-bottom:4rem;">
                    CERRAR SESIÓN
                </button>
            </main>
        ${_closeSidebarWrapper()}
        `;

        window._guardarEquipoFav = async () => {
            const sel = document.getElementById('equipo-fav-select').value;
            await window.FirebaseAuth?.actualizarPerfil({ equipoFavorito: sel });
            const ok = document.getElementById('fav-ok');
            if (ok) { ok.style.display = 'inline'; setTimeout(() => ok.style.display = 'none', 2000); }
        };

        window._perfilToggleDeporte = (id) => {
            const idx = window._deportesPerfil.indexOf(id);
            if (idx >= 0) window._deportesPerfil.splice(idx, 1);
            else if (window._deportesPerfil.length < maxDep) window._deportesPerfil.push(id);
            const sec = document.getElementById('deportes-section');
            if (sec) sec.innerHTML = _renderDeportes(window._deportesPerfil);
        };

        window._perfilGuardarDeportes = async () => {
            const deportesGuardar = plan === 'promax'
                ? window._deportesPerfil
                : window._deportesPerfil.slice(0, 1);
            await window.FirebaseAuth?.actualizarPerfil({ deportes: deportesGuardar });
            const ok = document.getElementById('deportes-ok');
            if (ok) { ok.style.display = 'block'; setTimeout(() => ok.style.display = 'none', 2000); }
        };
    };

    // ── PLANES ────────────────────────────────────────────────────────────────
    const renderPlanes = () => {
        const plan  = window.FirebaseAuth?.getPlan() ?? 'free';
        const PLANES = window.PLANES ?? {};
        const _card = (planKey, meta) => {
            const actual = plan === planKey;
            const p = PLANES[planKey];
            if (!p) return '';
            return `
                <div class="glass-panel" style="padding:1.5rem; position:relative; ${actual ? 'border-color:' + meta.color + ';' : ''}">
                    ${actual ? '<div style="position:absolute; top:-12px; left:50%; transform:translateX(-50%); background:linear-gradient(135deg,#3D6FFF,#8B5CF6); color:#fff; font-size:0.65rem; font-weight:800; padding:3px 14px; border-radius:20px; font-family:var(--font-heading); letter-spacing:1px; white-space:nowrap;">PLAN ACTUAL</div>' : ''}
                    <div style="font-size:1.5rem; margin-bottom:0.4rem;">${p.emoji ?? ''}</div>
                    <div style="font-family:var(--font-heading); font-size:1.2rem; font-weight:900; color:${meta.color}; margin-bottom:0.2rem;">${p.nombre ?? planKey}</div>
                    <div style="font-family:var(--font-heading); font-size:1.6rem; font-weight:900; color:${meta.color}; margin-bottom:0.8rem;">
                        ${p.precio ?? 'Gratis'}${planKey !== 'free' ? '<span style="font-size:0.8rem; color:var(--text-muted);">/mes</span>' : ''}
                    </div>
                    ${(p.features ?? []).map(f => `<div style="display:flex; align-items:center; gap:8px; font-size:0.8rem; margin-bottom:6px; color:${f.ok ? 'var(--text-main)' : 'var(--text-muted)'};">
                        <span>${f.ok ? '✅' : '🔒'}</span><span>${f.texto}</span>${f.proximamente ? '<span style="font-size:0.6rem; font-weight:800; background:rgba(245,195,59,0.16); color:var(--gold); padding:2px 7px; border-radius:10px; letter-spacing:0.04em;">PRONTO</span>' : ''}</div>`).join('')}
                    ${!actual ? `<button class="btn-primary" style="width:100%; margin-top:1.2rem; background:${meta.color}; color:#000;" onclick="window._suscribirse('${planKey}_mensual')">SUSCRIBIRME</button>` : ''}
                </div>`;
        };
        appContainer.innerHTML = `
            ${renderNavbar('#/planes')}
            <main class="page-container fade-in" style="max-width:900px; margin:0 auto;">
                <h2 class="section-title">💳 Planes</h2>
                <div id="ref-usd" style="display:none; background:rgba(61,111,255,0.08); border:1px solid rgba(61,111,255,0.2); border-radius:12px; padding:0.9rem 1.1rem; margin-bottom:1.5rem; font-size:0.8rem; color:var(--text-sub); line-height:1.5;"></div>
                <div style="display:grid; grid-template-columns:repeat(auto-fit,minmax(220px,1fr)); gap:1.5rem; margin-bottom:4rem;">
                    ${_card('free',   { color: '#888'    })}
                    ${_card('pro',    { color: '#3D6FFF' })}
                    ${_card('promax', { color: '#ffd700' })}
                </div>
            </main>
        ${_closeSidebarWrapper()}
        `;
        _refUSD();
    };

    // _renderNavbarConPerfil — alias de renderNavbar (sidebar ya incluye perfil)
    const _renderNavbarConPerfil = (activeHash) => renderNavbar(activeHash);

    // ── SETUP / PRE-PERFIL ───────────────────────────────────────────────────
    const renderSetup = () => {
        const nombre = window.FirebaseAuth?.getNombre()?.split(' ')[0] ?? 'crack';

        const PAISES = [
            {id:'AR', nombre:'Argentina', flag:'🇦🇷'},
            {id:'ES', nombre:'España',    flag:'🇪🇸'},
            {id:'MX', nombre:'México',    flag:'🇲🇽'},
            {id:'CO', nombre:'Colombia',  flag:'🇨🇴'},
            {id:'CL', nombre:'Chile',     flag:'🇨🇱'},
            {id:'UY', nombre:'Uruguay',   flag:'🇺🇾'},
            {id:'PE', nombre:'Perú',      flag:'🇵🇪'},
            {id:'VE', nombre:'Venezuela', flag:'🇻🇪'},
            {id:'BR', nombre:'Brasil',    flag:'🇧🇷'},
            {id:'PY', nombre:'Paraguay',  flag:'🇵🇾'},
            {id:'BO', nombre:'Bolivia',   flag:'🇧🇴'},
            {id:'EC', nombre:'Ecuador',   flag:'🇪🇨'},
            {id:'GB', nombre:'Inglaterra',flag:'🏴󠁧󠁢󠁥󠁮󠁧󠁿'},
            {id:'DE', nombre:'Alemania',  flag:'🇩🇪'},
            {id:'IT', nombre:'Italia',    flag:'🇮🇹'},
            {id:'FR', nombre:'Francia',   flag:'🇫🇷'},
            {id:'PT', nombre:'Portugal',  flag:'🇵🇹'},
            {id:'NL', nombre:'Países Bajos', flag:'🇳🇱'},
        ];

        const LIGAS_NACIONALES = {
            'AR': [{id:'arg.1', nombre:'Liga Profesional', flag:'🇦🇷'}],
            'ES': [{id:'esp.1', nombre:'La Liga', flag:'🇪🇸'}],
            'MX': [{id:'mex.1', nombre:'Liga MX', flag:'🇲🇽'}],
            'CO': [{id:'col.1', nombre:'Liga BetPlay', flag:'🇨🇴'}],
            'CL': [{id:'chi.1', nombre:'Primera División', flag:'🇨🇱'}],
            'UY': [{id:'uru.1', nombre:'Primera División', flag:'🇺🇾'}],
            'PE': [{id:'per.1', nombre:'Liga 1', flag:'🇵🇪'}],
            'BR': [{id:'bra.1', nombre:'Brasileirão', flag:'🇧🇷'}],
            'PY': [{id:'par.1', nombre:'División Profesional', flag:'🇵🇾'}],
            'EC': [{id:'ecu.1', nombre:'Serie A', flag:'🇪🇨'}],
            'GB': [{id:'eng.1', nombre:'Premier League', flag:'🏴󠁧󠁢󠁥󠁮󠁧󠁿'}],
            'DE': [{id:'ger.1', nombre:'Bundesliga', flag:'🇩🇪'}],
            'IT': [{id:'ita.1', nombre:'Serie A', flag:'🇮🇹'}],
            'FR': [{id:'fra.1', nombre:'Ligue 1', flag:'🇫🇷'}],
            'PT': [{id:'por.1', nombre:'Primeira Liga', flag:'🇵🇹'}],
            'NL': [{id:'ned.1', nombre:'Eredivisie', flag:'🇳🇱'}],
        };

        const LIGAS_INTERNACIONALES = [
            // OJO: los slugs son los de ESPN. 'uefa.cl' y 'uefa.el' NO existen (dan 400),
            // los correctos son 'uefa.champions' y 'uefa.europa'.
            {id:'uefa.champions', nombre:'Champions League', flag:'⭐'},
            {id:'uefa.europa',    nombre:'Europa League',    flag:'🟠'},
            {id:'conmebol.libertadores', nombre:'Copa Libertadores', flag:'🏆'},
            {id:'conmebol.sudamericana', nombre:'Copa Sudamericana',  flag:'🥈'},
            {id:'fifa.world',  nombre:'Mundial 2026',        flag:'🌍'},
            {id:'uefa.euro',   nombre:'Eurocopa',            flag:'🇪🇺'},
        ];

        const EQUIPOS_FAVORITOS = [
            // Argentina
            {id:'6', nombre:'Boca Juniors', flag:'🇦🇷'},
            {id:'5', nombre:'River Plate', flag:'🇦🇷'},
            {id:'7', nombre:'Racing Club', flag:'🇦🇷'},
            {id:'8', nombre:'Independiente', flag:'🇦🇷'},
            {id:'9', nombre:'San Lorenzo', flag:'🇦🇷'},
            {id:'10', nombre:'Huracán', flag:'🇦🇷'},
            // España
            {id:'86', nombre:'Real Madrid', flag:'🇪🇸'},
            {id:'83', nombre:'Barcelona', flag:'🇪🇸'},
            {id:'1068', nombre:'Atlético de Madrid', flag:'🇪🇸'},
            // Inglaterra
            {id:'360', nombre:'Manchester City', flag:'🏴󠁧󠁢󠁥󠁮󠁧󠁿'},
            {id:'364', nombre:'Manchester United', flag:'🏴󠁧󠁢󠁥󠁮󠁧󠁿'},
            {id:'359', nombre:'Liverpool', flag:'🏴󠁧󠁢󠁥󠁮󠁧󠁿'},
            {id:'338', nombre:'Arsenal', flag:'🏴󠁧󠁢󠁥󠁮󠁧󠁿'},
            {id:'363', nombre:'Chelsea', flag:'🏴󠁧󠁢󠁥󠁮󠁧󠁿'},
            // Italia
            {id:'111', nombre:'Juventus', flag:'🇮🇹'},
            {id:'108', nombre:'Inter', flag:'🇮🇹'},
            {id:'109', nombre:'AC Milan', flag:'🇮🇹'},
            // Alemania
            {id:'132', nombre:'Bayern Munich', flag:'🇩🇪'},
            {id:'124', nombre:'Borussia Dortmund', flag:'🇩🇪'},
            // Brasil
            {id:'131', nombre:'Flamengo', flag:'🇧🇷'},
            {id:'119', nombre:'Corinthians', flag:'🇧🇷'},
            // Selecciones
            {id:'202', nombre:'Argentina 🌍', flag:'🇦🇷'},
            {id:'205', nombre:'Brasil 🌍', flag:'🇧🇷'},
            {id:'164', nombre:'España 🌍', flag:'🇪🇸'},
            {id:'478', nombre:'Francia 🌍', flag:'🇫🇷'},
            {id:'482', nombre:'Portugal 🌍', flag:'🇵🇹'},
        ];

        // Estado del setup
        let _paso = 1;
        let _datos = { equipoFavorito: null, pais: null, ligaNacional: null, ligaInternacional: null, deportes: [] };

        const _render = () => {
            appContainer.innerHTML = `
                <main style="min-height:100vh; background:var(--bg-color); display:flex; flex-direction:column;
                    align-items:center; justify-content:center; padding:2rem 1.5rem;">

                    <!-- Header -->
                    <div style="text-align:center; margin-bottom:2rem;">
                        <div style="font-family:var(--font-heading); font-size:2rem; font-weight:900; color:var(--accent-neon); margin-bottom:0.5rem;">
                            WHISTLE
                        </div>
                        <h2 style="font-size:1.3rem; font-weight:700; margin-bottom:0.3rem;">
                            Hola ${nombre}, configurá tu experiencia
                        </h2>
                        <p style="color:var(--text-muted); font-size:0.85rem;">Paso ${_paso} de 4</p>

                        <!-- Barra de progreso -->
                        <div style="width:200px; height:4px; background:rgba(255,255,255,0.1); border-radius:2px; margin:1rem auto 0;">
                            <div style="width:${(_paso/4)*100}%; height:100%; background:var(--accent-neon); border-radius:2px; transition:width 0.3s;"></div>
                        </div>
                    </div>

                    <!-- Contenido del paso -->
                    <div class="glass-panel" style="padding:2rem; width:100%; max-width:520px;">
                        ${_paso === 1 ? _renderPaso1() : _paso === 2 ? _renderPaso2() : _paso === 3 ? _renderPaso3() : _renderPaso4()}
                    </div>

                    <!-- Botones -->
                    <div style="display:flex; gap:1rem; margin-top:1.5rem; width:100%; max-width:520px;">
                        ${_paso > 1 ? `
                            <button onclick="window._setupAtras()"
                                style="flex:1; padding:12px; background:transparent; color:var(--text-muted);
                                border:1px solid var(--border-glass); border-radius:8px; cursor:pointer;
                                font-family:var(--font-heading); font-weight:700; font-size:0.9rem;">
                                ← ATRÁS
                            </button>` : ''}
                        <button onclick="window._setupSiguiente()"
                            style="flex:2; padding:12px; background:linear-gradient(135deg,#3D6FFF,#8B5CF6); color:#fff;
                            border:none; border-radius:8px; cursor:pointer;
                            font-family:var(--font-heading); font-weight:900; font-size:0.95rem; letter-spacing:1px;">
                            ${_paso === 4 ? '¡LISTO! →' : 'SIGUIENTE →'}
                        </button>
                    </div>
                </main>
            `;
        };

        const _renderPaso1 = () => `
            <h3 style="font-family:var(--font-heading); font-size:1.1rem; font-weight:800; margin-bottom:1.2rem;">
                ⭐ ¿Cuál es tu equipo favorito?
            </h3>
            <input type="text" id="setup-buscar-equipo" placeholder="Buscá tu equipo..."
                oninput="window._setupFiltrarEquipos(this.value)"
                style="width:100%; background:rgba(255,255,255,0.05); border:1px solid var(--border-glass);
                color:var(--text-main); padding:10px 14px; border-radius:8px; font-size:0.9rem;
                margin-bottom:1rem; box-sizing:border-box;">
            <div id="setup-equipos-grid" style="display:grid; grid-template-columns:repeat(auto-fill,minmax(140px,1fr)); gap:0.6rem; max-height:320px; overflow-y:auto;">
                ${EQUIPOS_FAVORITOS.map(e => `
                    <div onclick="window._setupElegirEquipo('${e.id}', '${e.nombre}')"
                        id="eq-${e.id}"
                        style="padding:10px; border-radius:8px; border:2px solid ${_datos.equipoFavorito?.id === e.id ? 'var(--accent-neon)' : 'var(--border-glass)'};
                        background:${_datos.equipoFavorito?.id === e.id ? 'rgba(61,111,255,0.1)' : 'rgba(255,255,255,0.03)'};
                        cursor:pointer; text-align:center; transition:all 0.2s;">
                        <div style="font-size:1.2rem; margin-bottom:4px;">${e.flag}</div>
                        <div style="font-size:0.78rem; font-weight:600; line-height:1.3;">${e.nombre}</div>
                    </div>`).join('')}
            </div>
        `;

        const _renderPaso2 = () => `
            <h3 style="font-family:var(--font-heading); font-size:1.1rem; font-weight:800; margin-bottom:1.2rem;">
                🌎 ¿De dónde sos?
            </h3>
            <div style="display:grid; grid-template-columns:repeat(auto-fill,minmax(130px,1fr)); gap:0.6rem; margin-bottom:1.5rem;">
                ${PAISES.map(p => `
                    <div onclick="window._setupElegirPais('${p.id}', '${p.nombre}')"
                        style="padding:10px; border-radius:8px; border:2px solid ${_datos.pais?.id === p.id ? 'var(--accent-neon)' : 'var(--border-glass)'};
                        background:${_datos.pais?.id === p.id ? 'rgba(61,111,255,0.1)' : 'rgba(255,255,255,0.03)'};
                        cursor:pointer; text-align:center; transition:all 0.2s;">
                        <div style="font-size:1.3rem; margin-bottom:4px;">${p.flag}</div>
                        <div style="font-size:0.78rem; font-weight:600;">${p.nombre}</div>
                    </div>`).join('')}
            </div>

            ${_datos.pais ? `
                <h3 style="font-family:var(--font-heading); font-size:1rem; font-weight:800; margin-bottom:0.8rem;">
                    🏆 Tu liga nacional <span style="color:var(--accent-neon); font-size:0.75rem;">(incluida en Free)</span>
                </h3>
                <div style="display:flex; flex-direction:column; gap:0.5rem;">
                    ${(LIGAS_NACIONALES[_datos.pais.id] ?? [{id:'eng.1', nombre:'Premier League', flag:'🏴󠁧󠁢󠁥󠁮󠁧󠁿'}]).map(l => `
                        <div onclick="window._setupElegirLigaNacional('${l.id}', '${l.nombre}')"
                            style="padding:12px 16px; border-radius:8px; border:2px solid ${_datos.ligaNacional?.id === l.id ? 'var(--accent-neon)' : 'var(--border-glass)'};
                            background:${_datos.ligaNacional?.id === l.id ? 'rgba(61,111,255,0.1)' : 'rgba(255,255,255,0.03)'};
                            cursor:pointer; display:flex; align-items:center; gap:10px; transition:all 0.2s;">
                            <span style="font-size:1.3rem;">${l.flag}</span>
                            <span style="font-weight:600;">${l.nombre}</span>
                            ${_datos.ligaNacional?.id === l.id ? '<span style="margin-left:auto; color:var(--accent-neon);">✓</span>' : ''}
                        </div>`).join('')}
                </div>` : '<p style="color:var(--text-muted); font-size:0.85rem; text-align:center;">Elegí tu país para ver las ligas disponibles.</p>'}
        `;

        const _renderPaso3 = () => `
            <h3 style="font-family:var(--font-heading); font-size:1.1rem; font-weight:800; margin-bottom:1.2rem;">
                🌍 Liga o copa internacional favorita
            </h3>
            <p style="color:var(--text-muted); font-size:0.8rem; margin-bottom:1.2rem;">
                Las copas internacionales están disponibles para todos los planes.
            </p>
            <div style="display:flex; flex-direction:column; gap:0.6rem;">
                ${LIGAS_INTERNACIONALES.map(l => `
                    <div onclick="window._setupElegirLigaInt('${l.id}', '${l.nombre}')"
                        style="padding:14px 16px; border-radius:8px; border:2px solid ${_datos.ligaInternacional?.id === l.id ? 'var(--accent-neon)' : 'var(--border-glass)'};
                        background:${_datos.ligaInternacional?.id === l.id ? 'rgba(61,111,255,0.1)' : 'rgba(255,255,255,0.03)'};
                        cursor:pointer; display:flex; align-items:center; gap:12px; transition:all 0.2s;">
                        <span style="font-size:1.5rem;">${l.flag}</span>
                        <span style="font-weight:600; font-size:0.95rem;">${l.nombre}</span>
                        ${_datos.ligaInternacional?.id === l.id ? '<span style="margin-left:auto; color:var(--accent-neon); font-size:1.1rem;">✓</span>' : ''}
                    </div>`).join('')}
            </div>
        `;

        // Handlers
        const _renderPaso4 = () => {
            const plan   = window.FirebaseAuth?.getPlan() ?? 'free';
            const maxDep = plan === 'promax' ? 99 : plan === 'pro' ? 1 : 0;
            const DEPORTES_DISP = [
                {id:'basketball', nombre:'Básquet',           emoji:'🏀'},
                {id:'tennis',     nombre:'Tenis',             emoji:'🎾'},
                {id:'racing',     nombre:'Fórmula 1',         emoji:'🏎️'},
                {id:'football',   nombre:'Fútbol Americano',  emoji:'🏈'},
                {id:'baseball',   nombre:'Baseball',          emoji:'⚾'},
                {id:'hockey',     nombre:'Hockey sobre Hielo',emoji:'🏒'},
                {id:'golf',       nombre:'Golf',              emoji:'⛳'},
                {id:'mma',        nombre:'MMA',               emoji:'🥊'},
                {id:'rugby',      nombre:'Rugby',             emoji:'🏉'},
            ];

            if (maxDep === 0) {
                return '<h3 style="font-family:var(--font-heading); font-size:1.1rem; font-weight:800; margin-bottom:1rem;">🏅 Otros deportes</h3>' +
                    '<div style="text-align:center; padding:1.5rem; border:1px dashed var(--border-glass); border-radius:12px;">' +
                    '<div style="font-size:2rem; margin-bottom:0.5rem;">🔒</div>' +
                    '<p style="color:var(--text-muted); font-size:0.85rem; margin-bottom:1rem;">Los otros deportes están disponibles desde el plan Platea.</p>' +
                    '<p style="color:var(--text-muted); font-size:0.75rem;">Podés actualizar tu plan después desde el perfil.</p>' +
                    '</div>';
            }

            const planLabel = plan === 'pro'
                ? 'Plan Platea — podés elegir 1 deporte adicional.'
                : 'Plan Palco — elegí todos los que quieras.';

            const cards = DEPORTES_DISP.map(d => {
                const sel      = _datos.deportes.includes(d.id);
                const bloq     = !sel && _datos.deportes.length >= maxDep;
                const border   = sel ? 'var(--accent-neon)' : 'var(--border-glass)';
                const bg       = sel ? 'rgba(61,111,255,0.1)' : 'rgba(255,255,255,0.03)';
                const cursor   = bloq ? 'default' : 'pointer';
                const opacity  = bloq ? '0.4' : '1';
                const onclick  = bloq ? '' : ('onclick="window._setupToggleDeporte(\'' + d.id + '\')"');
                const check    = sel ? '<div style="font-size:0.65rem; color:var(--accent-neon); margin-top:3px;">✓ Elegido</div>' : '';
                return '<div ' + onclick + ' style="padding:12px; border-radius:8px; text-align:center; transition:all 0.2s; border:2px solid ' + border + '; background:' + bg + '; cursor:' + cursor + '; opacity:' + opacity + ';">' +
                    '<div style="font-size:1.5rem; margin-bottom:4px;">' + d.emoji + '</div>' +
                    '<div style="font-size:0.78rem; font-weight:600;">' + d.nombre + '</div>' +
                    check + '</div>';
            }).join('');

            return '<h3 style="font-family:var(--font-heading); font-size:1.1rem; font-weight:800; margin-bottom:0.5rem;">🏅 ¿Qué otros deportes querés seguir?</h3>' +
                '<p style="color:var(--text-muted); font-size:0.8rem; margin-bottom:1.2rem;">' + planLabel + ' El fútbol siempre está incluido.</p>' +
                '<div style="display:grid; grid-template-columns:repeat(auto-fill,minmax(130px,1fr)); gap:0.6rem;">' + cards + '</div>';
        };

        window._setupToggleDeporte = (id) => {
            const idx = _datos.deportes.indexOf(id);
            if (idx >= 0) _datos.deportes.splice(idx, 1);
            else _datos.deportes.push(id);
            _render();
        };

        window._setupElegirEquipo = (id, nombre) => {
            _datos.equipoFavorito = { id, nombre };
            _render();
        };
        window._setupFiltrarEquipos = (q) => {
            const grid = document.getElementById('setup-equipos-grid');
            if (!grid) return;
            grid.querySelectorAll('[id^="eq-"]').forEach(el => {
                const nombre = el.querySelector('div:last-child')?.textContent?.toLowerCase() ?? '';
                el.style.display = nombre.includes(q.toLowerCase()) ? '' : 'none';
            });
        };
        window._setupElegirPais = (id, nombre) => {
            _datos.pais = { id, nombre };
            _datos.ligaNacional = null;
            _render();
        };
        window._setupElegirLigaNacional = (id, nombre) => {
            _datos.ligaNacional = { id, nombre };
            _render();
        };
        window._setupElegirLigaInt = (id, nombre) => {
            _datos.ligaInternacional = { id, nombre };
            _render();
        };
        window._setupSiguiente = async () => {
            if (_paso === 1 && !_datos.equipoFavorito) {
                alert('Elegí tu equipo favorito para continuar.');
                return;
            }
            if (_paso === 2 && !_datos.pais) {
                alert('Elegí tu país para continuar.');
                return;
            }
            if (_paso === 4) {
                // Plan del usuario — limitar deportes según plan
                const plan = window.FirebaseAuth?.getPlan() ?? 'free';
                let deportesGuardar = [];
                if (plan === 'promax') {
                    deportesGuardar = _datos.deportes;
                } else if (plan === 'pro') {
                    deportesGuardar = _datos.deportes.slice(0, 1);
                }
                // Guardar y terminar
                await window.FirebaseAuth?.actualizarPerfil({
                    equipoFavorito:   _datos.equipoFavorito?.id    ?? null,
                    pais:             _datos.pais?.id              ?? null,
                    ligaNacional:     _datos.ligaNacional?.id      ?? null,
                    ligaInternacional:_datos.ligaInternacional?.id  ?? null,
                    deportes:         deportesGuardar,
                    perfilCompleto:   true
                });
                window.location.hash = '#/home';
                return;
            }
            _paso++;
            _render();
        };
        window._setupAtras = () => {
            if (_paso > 1) { _paso--; _render(); }
        };

        _render();
    };


    // ── HELPER DE PLAN ────────────────────────────────────────────────────────
    const _plan = () => window.FirebaseAuth?.getPlan() ?? 'free';
    const _esPro    = () => ['pro','promax'].includes(_plan());
    const _esProMax = () => _plan() === 'promax';
    const _esProMaxOPro = () => _esPro();

    // Paywall inline
    const _paywallInline = (requiere = 'pro', mensaje = '') => `
        <div style="padding:2rem; text-align:center; border:1px dashed var(--border-glass); border-radius:12px; margin:1rem 0;">
            <div style="font-size:2rem; margin-bottom:0.5rem;">${requiere === 'promax' ? '👑' : '🔥'}</div>
            <p style="font-weight:700; color:${requiere === 'promax' ? '#ffd700' : 'var(--accent-neon)'}; font-family:var(--font-heading); margin-bottom:0.5rem;">
                Requiere ${requiere === 'promax' ? 'Palco' : 'Platea'}
            </p>
            <p style="color:var(--text-muted); font-size:0.82rem; margin-bottom:1rem;">${mensaje}</p>
            <button onclick="window.location.hash='#/planes'"
                style="padding:8px 20px; background:${requiere === 'promax' ? '#ffd700' : 'var(--accent-neon)'}; color:#000;
                font-weight:800; font-family:var(--font-heading); border:none; border-radius:8px; cursor:pointer; font-size:0.85rem;">
                VER PLANES
            </button>
        </div>`;

    // ── OTHER SPORTS ─────────────────────────────────────────────────────────
    const OTHER_SPORTS = [
        {
            id: 'basketball', nombre: 'Básquet', emoji: '🏀',
            ligas: [
                {id:'nba',  nombre:'NBA',  slug:'basketball/nba'},
                {id:'wnba', nombre:'WNBA', slug:'basketball/wnba'},
                {id:'mens-college-basketball', nombre:'NCAA', slug:'basketball/mens-college-basketball'},
            ]
        },
        {
            id: 'tennis', nombre: 'Tenis', emoji: '🎾',
            ligas: [
                {id:'atp', nombre:'ATP', slug:'tennis/atp'},
                {id:'wta', nombre:'WTA', slug:'tennis/wta'},
            ]
        },
        {
            id: 'racing', nombre: 'Fórmula 1', emoji: '🏎️', estatico: true,
            ligas: [
                {id:'carreras',      nombre:'Calendario',    emoji:'📅'},
                {id:'pilotos',       nombre:'Pilotos',       emoji:'🪖'},
                {id:'constructores', nombre:'Constructores', emoji:'🏭'},
            ]
        },
        {
            id: 'football', nombre: 'Fútbol Americano', emoji: '🏈',
            ligas: [
                {id:'nfl', nombre:'NFL', slug:'football/nfl'},
                {id:'college-football', nombre:'NCAA', slug:'football/college-football'},
            ]
        },
        {
            id: 'baseball', nombre: 'Baseball', emoji: '⚾',
            ligas: [
                {id:'mlb', nombre:'MLB', slug:'baseball/mlb'},
            ]
        },
        {
            id: 'hockey', nombre: 'Hockey sobre Hielo', emoji: '🏒',
            ligas: [
                {id:'nhl', nombre:'NHL', slug:'hockey/nhl'},
            ]
        },
        {
            id: 'golf', nombre: 'Golf', emoji: '⛳',
            ligas: [
                {id:'pga', nombre:'PGA Tour', slug:'golf/pga'},
            ]
        },
        {
            id: 'mma', nombre: 'MMA', emoji: '🥊',
            ligas: [
                {id:'ufc', nombre:'UFC', slug:'mma/ufc'},
            ]
        },
        {
            id: 'rugby', nombre: 'Rugby', emoji: '🏉',
            ligas: [
                {id:'rugby-union', nombre:'Six Nations', slug:'rugby/180659'},
            ]
        },
        // Próximamente
        {id:'formula-e',   nombre:'Fórmula E',        emoji:'⚡', proximamente:true},
        {id:'formula-2',   nombre:'Fórmula 2',        emoji:'🏎️', proximamente:true},
        {id:'formula-3',   nombre:'Fórmula 3',        emoji:'🏎️', proximamente:true},
        {id:'formula-4',   nombre:'Fórmula 4',        emoji:'🏎️', proximamente:true},
        {id:'indycar',     nombre:'IndyCar',           emoji:'🚗', proximamente:true},
        {id:'padel',       nombre:'Pádel',             emoji:'🏸', proximamente:true},
        {id:'volleyball',  nombre:'Vóley',             emoji:'🏐', proximamente:true},
        {id:'handball',    nombre:'Handball',          emoji:'🤾', proximamente:true},
        {id:'table-tennis',nombre:'Ping Pong',         emoji:'🏓', proximamente:true},
        {id:'boxing',      nombre:'Boxeo',             emoji:'🥊', proximamente:true},
        {
            id: 'figure-skating', nombre: 'Patín sobre Hielo', emoji: '⛸️',
            estatico: true,
            ligas: [
                { id: 'men',    nombre: 'Individual Masculino', emoji: '👨' },
                { id: 'women',  nombre: 'Individual Femenino',  emoji: '👩' },
                { id: 'pairs',  nombre: 'Parejas',              emoji: '👫' },
                { id: 'dance',  nombre: 'Danza sobre Hielo',    emoji: '💃' },
            ]
        },
        {id:'olympics',    nombre:'Juegos Olímpicos',  emoji:'🏅', proximamente:true},
    ];

    const renderOtherSports = async (deporteId = null, ligaId = null) => {
        // Esperar a que el perfil esté cargado
        let intentos = 0;
        while (!window.FirebaseAuth?.getPerfil() && intentos < 20) {
            await new Promise(r => setTimeout(r, 100));
            intentos++;
        }

        const isProMax = window.FirebaseAuth?.getPlan() === 'promax';
        const CF_WORKER = 'https://whistle.solgoyhe.workers.dev';

        // Solo ProMax puede ver Other Sports
        if (!isProMax) {
            appContainer.innerHTML = `
                ${renderNavbar('#/other-sports')}
                <main class="page-container fade-in" style="max-width:700px; margin:0 auto;">
                    <h2 class="section-title">🏅 Other Sports</h2>
                    <div class="glass-panel" style="padding:3rem; text-align:center; margin-bottom:2rem;">
                        <div style="font-size:3rem; margin-bottom:1rem;">👑</div>
                        <h3 style="font-family:var(--font-heading); font-size:1.3rem; font-weight:900; color:#ffd700; margin-bottom:0.8rem;">
                            Requiere Palco
                        </h3>
                        <p style="color:var(--text-muted); font-size:0.9rem; line-height:1.6; max-width:400px; margin:0 auto 1.5rem;">
                            Accedé a todos los deportes — básquet, tenis, F1, NFL, MLB, NHL, golf, MMA y más — con el plan Palco.
                        </p>
                        <button onclick="window.location.hash='#/planes'"
                            style="padding:12px 28px; background:#ffd700; color:#000; font-weight:900;
                            font-family:var(--font-heading); border:none; border-radius:8px; cursor:pointer;
                            font-size:0.95rem; letter-spacing:1px;">
                            VER PLANES ⭐
                        </button>
                    </div>

                    <!-- Preview bloqueado -->
                    <div style="display:grid; grid-template-columns:repeat(auto-fill,minmax(140px,1fr)); gap:1rem; opacity:0.4; pointer-events:none;">
                        ${OTHER_SPORTS.filter(d => !d.proximamente).map(d => `
                            <div class="glass-panel" style="padding:1.5rem; text-align:center;">
                                <div style="font-size:2rem; margin-bottom:0.5rem;">${d.emoji}</div>
                                <div style="font-weight:700; font-size:0.85rem;">🔒 ${d.nombre}</div>
                            </div>`).join('')}
                    </div>
                </main>
            ${_closeSidebarWrapper()}
            `;
            return;
        }

        // Deporte seleccionado
        const deporteActual = deporteId
            ? OTHER_SPORTS.find(d => d.id === deporteId)
            : OTHER_SPORTS.find(d => !d.proximamente);

        const ligaActual = ligaId
            ? deporteActual?.ligas?.find(l => l.id === ligaId)
            : deporteActual?.ligas?.[0];

        appContainer.innerHTML = `
            ${renderNavbar('#/other-sports')}
            <main class="page-container fade-in">
                <h2 class="section-title">🏅 Other Sports</h2>

                <!-- Tabs de deportes -->
                <div style="overflow-x:auto; padding-bottom:8px; margin-bottom:1.5rem; scrollbar-width:thin;">
                    <div style="display:flex; gap:8px; width:max-content;">
                        ${OTHER_SPORTS.map(d => `
                            <button
                                onclick="${d.proximamente ? '' : `window.location.hash='#/other-sports?deporte=${d.id}'`}"
                                style="flex-shrink:0; padding:8px 16px; border-radius:20px;
                                border:2px solid ${d.id === deporteActual?.id ? 'var(--accent-neon)' : 'var(--border-glass)'};
                                background:${d.id === deporteActual?.id ? 'rgba(61,111,255,0.12)' : 'rgba(255,255,255,0.04)'};
                                color:${d.proximamente ? 'var(--text-muted)' : d.id === deporteActual?.id ? 'var(--accent-neon)' : 'var(--text-main)'};
                                cursor:${d.proximamente ? 'default' : 'pointer'};
                                font-family:var(--font-heading); font-weight:700; font-size:0.8rem;
                                white-space:nowrap; opacity:${d.proximamente ? '0.4' : '1'};">
                                ${d.emoji} ${d.nombre}
                                ${d.proximamente ? '<span style="font-size:0.65rem; margin-left:4px;">PRONTO</span>' : ''}
                            </button>`).join('')}
                    </div>
                </div>

                <!-- Sub-tabs de ligas del deporte -->
                ${deporteActual?.ligas?.length > 1 ? `
                <div style="display:flex; gap:8px; margin-bottom:1.5rem; flex-wrap:wrap;">
                    ${deporteActual.ligas.map(l => `
                        <button onclick="window.location.hash='#/other-sports?deporte=${deporteActual.id}&liga=${l.id}'"
                            style="padding:6px 14px; border-radius:16px;
                            border:1px solid ${l.id === ligaActual?.id ? 'var(--accent-neon)' : 'var(--border-glass)'};
                            background:${l.id === ligaActual?.id ? 'rgba(61,111,255,0.1)' : 'transparent'};
                            color:${l.id === ligaActual?.id ? 'var(--accent-neon)' : 'var(--text-muted)'};
                            cursor:pointer; font-size:0.8rem; font-weight:600;">
                            ${l.nombre}
                        </button>`).join('')}
                </div>` : ''}

                <!-- Contenido -->
                <div id="other-sports-content">
                    <div style="text-align:center; padding:3rem;">
                        <div style="width:36px; height:36px; border:3px solid var(--accent-neon); border-right-color:transparent; border-radius:50%; animation:spin 1s linear infinite; margin:0 auto;"></div>
                        <p style="color:var(--accent-neon); margin-top:1rem; font-size:0.85rem;">Cargando ${deporteActual?.nombre ?? ''}...</p>
                    </div>
                </div>
            </main>
        ${_closeSidebarWrapper()}
        `;

        // Si no se resolvió el deporte o la liga, hay que avisar SÍ o SÍ: arriba ya
        // se pintó el spinner, así que un `return` pelado lo deja girando para
        // siempre. Pasa con un ?liga= que no existe para ese deporte, o con los
        // deportes marcados "próximamente", que no tienen array `ligas`.
        if (!deporteActual || !ligaActual) {
            const cont = document.getElementById('other-sports-content');
            if (cont) {
                const esProximamente = deporteActual && !deporteActual.ligas?.length;
                cont.innerHTML = `
                    <div class="glass-panel" style="padding:2.5rem; text-align:center;">
                        <div style="font-size:2.2rem; margin-bottom:.7rem;">${deporteActual?.emoji ?? '🏅'}</div>
                        <p style="font-family:var(--font-heading); font-size:1rem; font-weight:800; margin-bottom:.4rem;">
                            ${esProximamente ? (deporteActual.nombre + ' — próximamente') : 'No pudimos abrir este deporte'}
                        </p>
                        <p style="color:var(--text-muted); font-size:.84rem; margin-bottom:1.2rem;">
                            ${esProximamente
                                ? 'Todavía no hay datos disponibles para esta competencia.'
                                : 'La competencia que pediste no existe o cambió de nombre.'}
                        </p>
                        <a href="#/other-sports" style="display:inline-block; padding:9px 20px; border-radius:8px;
                            background:rgba(61,111,255,.12); border:1px solid rgba(61,111,255,.35);
                            color:var(--accent-neon); text-decoration:none; font-size:.84rem; font-weight:700;">
                            Ver todos los deportes
                        </a>
                    </div>`;
            }
            return;
        }

        // ── Deporte estático (Patín sobre Hielo) ─────────────────────────────
        if (deporteActual.estatico) {

            // ── F1 (datos en vivo de ESPN + mapa estático piloto→equipo) ─────
            if (deporteActual.id === 'racing') {
                const container = document.getElementById('other-sports-content');
                if (!container) return;

                // Puntos, posiciones y calendario salen EN VIVO de ESPN. Lo único
                // estático es este mapa piloto→escudería/dorsal, que la API de
                // standings no trae. Keyeado por la abreviatura de ESPN (ANT, HAM…),
                // que es estable. Solo actualizar si un piloto cambia de equipo.
                const F1_META = {
                    ANT:{eq:'Mercedes',num:12},      HAM:{eq:'Ferrari',num:44},       RUS:{eq:'Mercedes',num:63},
                    LEC:{eq:'Ferrari',num:16},       NOR:{eq:'McLaren',num:4},        PIA:{eq:'McLaren',num:81},
                    VER:{eq:'Red Bull',num:1},       HAD:{eq:'Red Bull',num:6},       GAS:{eq:'Alpine',num:10},
                    LAW:{eq:'Racing Bulls',num:30},  LIN:{eq:'Racing Bulls',num:41},  COL:{eq:'Alpine',num:43},
                    BEA:{eq:'Haas',num:87},          BOR:{eq:'Audi',num:5},           SAI:{eq:'Williams',num:55},
                    ALB:{eq:'Williams',num:23},      OCO:{eq:'Haas',num:31},          ALO:{eq:'Aston Martin',num:14},
                    HUL:{eq:'Audi',num:27},          BOT:{eq:'Cadillac',num:77},      PER:{eq:'Cadillac',num:11},
                    STR:{eq:'Aston Martin',num:18},
                };

                // Trazados esquemáticos de cada circuito. La clave es circuit.address.city
                // que manda ESPN, en minúsculas y sin acentos.
                const F1_CIRCUITOS = {
                    'melbourne': `<svg viewBox="0 0 200 160" xmlns="http://www.w3.org/2000/svg" style="width:100%;display:block;">
                        <rect width="200" height="160" fill="#1a1a2e" rx="8"/>
                        <path d="M30,80 Q30,30 80,30 L140,30 Q170,30 170,60 Q170,80 150,90 Q130,100 130,120 Q130,140 100,140 Q70,140 50,130 Q30,120 30,100 Z"
                            fill="none" stroke="#3D6FFF" stroke-width="3" stroke-linejoin="round"/>
                        <circle cx="30" cy="80" r="5" fill="#ff4757"/>
                        <text x="20" y="75" font-size="7" fill="#fff" font-family="system-ui">START</text>
                        <text x="90" y="20" font-size="8" fill="#ffd700" font-family="system-ui" font-weight="bold" text-anchor="middle">MELBOURNE</text>
                    </svg>`,
                    'shanghai': `<svg viewBox="0 0 200 160" xmlns="http://www.w3.org/2000/svg" style="width:100%;display:block;">
                        <rect width="200" height="160" fill="#1a1a2e" rx="8"/>
                        <path d="M40,100 L40,60 Q40,30 80,30 L160,30 Q170,40 160,70 Q150,90 120,90 L100,90 Q80,90 80,110 Q80,130 60,130 Q40,130 40,115 Z"
                            fill="none" stroke="#3D6FFF" stroke-width="3"/>
                        <circle cx="40" cy="100" r="5" fill="#ff4757"/>
                        <text x="100" y="20" font-size="8" fill="#ffd700" font-family="system-ui" font-weight="bold" text-anchor="middle">SHANGHÁI</text>
                    </svg>`,
                    'suzuka': `<svg viewBox="0 0 200 160" xmlns="http://www.w3.org/2000/svg" style="width:100%;display:block;">
                        <rect width="200" height="160" fill="#1a1a2e" rx="8"/>
                        <path d="M100,130 Q60,130 40,100 Q20,70 40,50 Q60,30 100,30 Q130,30 150,50 L170,50 Q180,60 170,80 Q160,100 140,110 Q150,130 130,135 Q115,140 100,130 Z"
                            fill="none" stroke="#3D6FFF" stroke-width="3"/>
                        <circle cx="100" cy="130" r="5" fill="#ff4757"/>
                        <text x="100" y="20" font-size="8" fill="#ffd700" font-family="system-ui" font-weight="bold" text-anchor="middle">SUZUKA</text>
                    </svg>`,
                    'sakhir': `<svg viewBox="0 0 200 160" xmlns="http://www.w3.org/2000/svg" style="width:100%;display:block;">
                        <rect width="200" height="160" fill="#1a1a2e" rx="8"/>
                        <path d="M40,90 L40,50 Q40,30 70,30 Q100,30 100,50 Q100,70 80,80 Q100,90 120,80 Q150,70 160,50 Q170,30 185,50 Q185,80 160,100 Q140,120 100,120 Q60,120 40,110 Z"
                            fill="none" stroke="#3D6FFF" stroke-width="3"/>
                        <circle cx="40" cy="90" r="5" fill="#ff4757"/>
                        <text x="100" y="20" font-size="8" fill="#ffd700" font-family="system-ui" font-weight="bold" text-anchor="middle">SAKHIR</text>
                    </svg>`,
                    'jeddah': `<svg viewBox="0 0 200 160" xmlns="http://www.w3.org/2000/svg" style="width:100%;display:block;">
                        <rect width="200" height="160" fill="#1a1a2e" rx="8"/>
                        <path d="M160,120 L160,40 Q160,30 150,30 L60,30 Q50,30 50,40 L50,60 Q50,70 60,70 L130,70 Q140,70 140,80 L140,100 Q140,110 130,110 L60,110 Q50,110 50,120 L50,135"
                            fill="none" stroke="#3D6FFF" stroke-width="3"/>
                        <circle cx="160" cy="120" r="5" fill="#ff4757"/>
                        <text x="100" y="20" font-size="8" fill="#ffd700" font-family="system-ui" font-weight="bold" text-anchor="middle">JEDDAH</text>
                    </svg>`,
                    'florida': `<svg viewBox="0 0 200 160" xmlns="http://www.w3.org/2000/svg" style="width:100%;display:block;">
                        <rect width="200" height="160" fill="#1a1a2e" rx="8"/>
                        <path d="M50,130 L50,80 Q50,50 80,40 L150,40 Q170,40 170,60 Q170,80 150,85 Q130,90 120,100 Q110,115 120,130 Q130,145 100,145 Q70,145 50,130 Z"
                            fill="none" stroke="#3D6FFF" stroke-width="3"/>
                        <circle cx="50" cy="130" r="5" fill="#ff4757"/>
                        <text x="100" y="28" font-size="8" fill="#ffd700" font-family="system-ui" font-weight="bold" text-anchor="middle">MIAMI</text>
                    </svg>`,
                    'montreal': `<svg viewBox="0 0 200 160" xmlns="http://www.w3.org/2000/svg" style="width:100%;display:block;">
                        <rect width="200" height="160" fill="#1a1a2e" rx="8"/>
                        <path d="M50,100 L50,50 L170,50 L170,70 L110,70 L110,90 L170,90 L170,120 L80,120 Q50,120 50,100 Z"
                            fill="none" stroke="#3D6FFF" stroke-width="3"/>
                        <circle cx="50" cy="100" r="5" fill="#ff4757"/>
                        <text x="100" y="38" font-size="8" fill="#ffd700" font-family="system-ui" font-weight="bold" text-anchor="middle">MONTREAL</text>
                    </svg>`,
                    'monte carlo': `<svg viewBox="0 0 200 160" xmlns="http://www.w3.org/2000/svg" style="width:100%;display:block;">
                        <rect width="200" height="160" fill="#1a1a2e" rx="8"/>
                        <path d="M170,100 L170,60 Q165,30 140,25 Q110,20 80,40 Q50,60 40,90 Q30,115 50,130 Q70,145 110,140 Q140,135 160,120 Q170,115 170,100 Z"
                            fill="none" stroke="#3D6FFF" stroke-width="3"/>
                        <circle cx="170" cy="100" r="5" fill="#ff4757"/>
                        <text x="100" y="15" font-size="8" fill="#ffd700" font-family="system-ui" font-weight="bold" text-anchor="middle">MONACO</text>
                    </svg>`,
                    'barcelona': `<svg viewBox="0 0 200 160" xmlns="http://www.w3.org/2000/svg" style="width:100%;display:block;">
                        <rect width="200" height="160" fill="#1a1a2e" rx="8"/>
                        <path d="M60,120 L60,70 Q60,40 100,35 Q140,30 160,55 Q175,75 160,95 Q145,115 120,115 Q120,130 90,135 Q65,138 60,120 Z"
                            fill="none" stroke="#3D6FFF" stroke-width="3"/>
                        <circle cx="60" cy="120" r="5" fill="#ff4757"/>
                        <text x="100" y="22" font-size="8" fill="#ffd700" font-family="system-ui" font-weight="bold" text-anchor="middle">BARCELONA</text>
                    </svg>`,
                    'spielberg': `<svg viewBox="0 0 200 160" xmlns="http://www.w3.org/2000/svg" style="width:100%;display:block;">
                        <rect width="200" height="160" fill="#1a1a2e" rx="8"/>
                        <path d="M80,130 Q40,130 30,100 Q20,70 50,50 Q80,30 120,40 Q160,50 170,80 Q175,100 160,120 Q145,140 110,135 Q95,133 80,130 Z"
                            fill="none" stroke="#3D6FFF" stroke-width="3"/>
                        <circle cx="80" cy="130" r="5" fill="#ff4757"/>
                        <text x="100" y="22" font-size="8" fill="#ffd700" font-family="system-ui" font-weight="bold" text-anchor="middle">RED BULL RING</text>
                    </svg>`,
                    'silverstone': `<svg viewBox="0 0 200 160" xmlns="http://www.w3.org/2000/svg" style="width:100%;display:block;">
                        <rect width="200" height="160" fill="#1a1a2e" rx="8"/>
                        <path d="M90,130 Q50,125 35,100 Q20,70 40,50 Q60,30 100,30 Q140,30 160,55 Q175,75 165,100 Q155,125 125,135 Q110,140 90,130 Z"
                            fill="none" stroke="#3D6FFF" stroke-width="3"/>
                        <circle cx="90" cy="130" r="5" fill="#ff4757"/>
                        <text x="100" y="20" font-size="8" fill="#ffd700" font-family="system-ui" font-weight="bold" text-anchor="middle">SILVERSTONE</text>
                    </svg>`,
                    'stavelot': `<svg viewBox="0 0 200 160" xmlns="http://www.w3.org/2000/svg" style="width:100%;display:block;">
                        <rect width="200" height="160" fill="#1a1a2e" rx="8"/>
                        <path d="M40,100 Q30,70 50,45 Q70,20 110,25 Q150,30 170,55 Q185,80 170,105 Q155,130 120,138 Q85,145 60,130 Q40,118 40,100 Z"
                            fill="none" stroke="#3D6FFF" stroke-width="3"/>
                        <circle cx="40" cy="100" r="5" fill="#ff4757"/>
                        <text x="100" y="15" font-size="8" fill="#ffd700" font-family="system-ui" font-weight="bold" text-anchor="middle">SPA-FRANCORCHAMPS</text>
                    </svg>`,
                    'budapest': `<svg viewBox="0 0 200 160" xmlns="http://www.w3.org/2000/svg" style="width:100%;display:block;">
                        <rect width="200" height="160" fill="#1a1a2e" rx="8"/>
                        <path d="M80,130 Q40,120 30,90 Q20,60 50,40 Q80,20 120,30 Q160,40 170,70 Q180,100 160,120 Q140,140 100,135 Q90,133 80,130 Z"
                            fill="none" stroke="#3D6FFF" stroke-width="3"/>
                        <circle cx="80" cy="130" r="5" fill="#ff4757"/>
                        <text x="100" y="20" font-size="8" fill="#ffd700" font-family="system-ui" font-weight="bold" text-anchor="middle">HUNGARORING</text>
                    </svg>`,
                    'zandvoort': `<svg viewBox="0 0 200 160" xmlns="http://www.w3.org/2000/svg" style="width:100%;display:block;">
                        <rect width="200" height="160" fill="#1a1a2e" rx="8"/>
                        <path d="M100,135 Q60,130 40,105 Q20,80 35,55 Q50,30 90,25 Q130,20 155,45 Q175,65 170,95 Q165,125 135,138 Q118,145 100,135 Z"
                            fill="none" stroke="#3D6FFF" stroke-width="3"/>
                        <circle cx="100" cy="135" r="5" fill="#ff4757"/>
                        <text x="100" y="15" font-size="8" fill="#ffd700" font-family="system-ui" font-weight="bold" text-anchor="middle">ZANDVOORT</text>
                    </svg>`,
                    'monza': `<svg viewBox="0 0 200 160" xmlns="http://www.w3.org/2000/svg" style="width:100%;display:block;">
                        <rect width="200" height="160" fill="#1a1a2e" rx="8"/>
                        <path d="M30,80 Q30,40 70,30 L140,30 Q165,30 170,55 Q175,80 160,95 Q145,110 130,100 Q115,90 100,100 Q85,110 85,130 Q85,145 60,145 Q35,145 30,120 Z"
                            fill="none" stroke="#3D6FFF" stroke-width="3"/>
                        <circle cx="30" cy="80" r="5" fill="#ff4757"/>
                        <text x="100" y="20" font-size="8" fill="#ffd700" font-family="system-ui" font-weight="bold" text-anchor="middle">MONZA</text>
                    </svg>`,
                    'madrid': `<svg viewBox="0 0 200 160" xmlns="http://www.w3.org/2000/svg" style="width:100%;display:block;">
                        <rect width="200" height="160" fill="#1a1a2e" rx="8"/>
                        <path d="M45,120 L45,70 Q45,45 70,42 L130,36 Q160,32 168,55 Q174,75 155,85 Q135,95 138,112 Q140,130 115,134 Q85,138 62,132 Q45,128 45,120 Z"
                            fill="none" stroke="#3D6FFF" stroke-width="3" stroke-linejoin="round"/>
                        <circle cx="45" cy="120" r="5" fill="#ff4757"/>
                        <text x="28" y="115" font-size="7" fill="#fff" font-family="system-ui">START</text>
                        <text x="100" y="22" font-size="8" fill="#ffd700" font-family="system-ui" font-weight="bold" text-anchor="middle">MADRID</text>
                    </svg>`,
                    'baku': `<svg viewBox="0 0 200 160" xmlns="http://www.w3.org/2000/svg" style="width:100%;display:block;">
                        <rect width="200" height="160" fill="#1a1a2e" rx="8"/>
                        <path d="M160,120 L160,40 Q155,25 140,25 L60,25 Q45,25 45,40 L45,60 Q45,75 60,75 L140,75 Q155,75 155,90 L155,110 Q155,125 140,130 L60,130 Q45,130 45,120"
                            fill="none" stroke="#3D6FFF" stroke-width="3"/>
                        <circle cx="160" cy="120" r="5" fill="#ff4757"/>
                        <text x="100" y="15" font-size="8" fill="#ffd700" font-family="system-ui" font-weight="bold" text-anchor="middle">BAKÚ</text>
                    </svg>`,
                    'singapore': `<svg viewBox="0 0 200 160" xmlns="http://www.w3.org/2000/svg" style="width:100%;display:block;">
                        <rect width="200" height="160" fill="#1a1a2e" rx="8"/>
                        <path d="M40,110 L40,50 Q40,30 60,30 L100,30 Q120,30 120,50 Q120,70 100,75 Q80,80 80,100 Q80,120 100,125 L150,125 Q170,125 170,110 Q170,95 155,90 Q140,85 140,70 Q140,55 155,50 Q170,45 175,60 Q175,80 165,100"
                            fill="none" stroke="#3D6FFF" stroke-width="3"/>
                        <circle cx="40" cy="110" r="5" fill="#ff4757"/>
                        <text x="100" y="20" font-size="8" fill="#ffd700" font-family="system-ui" font-weight="bold" text-anchor="middle">MARINA BAY</text>
                    </svg>`,
                    'austin': `<svg viewBox="0 0 200 160" xmlns="http://www.w3.org/2000/svg" style="width:100%;display:block;">
                        <rect width="200" height="160" fill="#1a1a2e" rx="8"/>
                        <path d="M50,120 L50,60 Q50,30 90,25 Q130,20 155,45 Q175,65 165,90 Q155,115 130,120 Q115,125 100,115 Q85,105 75,115 Q65,125 50,120 Z"
                            fill="none" stroke="#3D6FFF" stroke-width="3"/>
                        <circle cx="50" cy="120" r="5" fill="#ff4757"/>
                        <text x="100" y="14" font-size="8" fill="#ffd700" font-family="system-ui" font-weight="bold" text-anchor="middle">COTA - AUSTIN</text>
                    </svg>`,
                    'mexico city': `<svg viewBox="0 0 200 160" xmlns="http://www.w3.org/2000/svg" style="width:100%;display:block;">
                        <rect width="200" height="160" fill="#1a1a2e" rx="8"/>
                        <path d="M60,120 Q30,120 25,90 Q20,60 50,40 Q80,20 120,25 Q160,30 170,60 Q175,85 160,105 Q145,125 115,130 Q90,135 60,120 Z"
                            fill="none" stroke="#3D6FFF" stroke-width="3"/>
                        <circle cx="60" cy="120" r="5" fill="#ff4757"/>
                        <text x="100" y="14" font-size="8" fill="#ffd700" font-family="system-ui" font-weight="bold" text-anchor="middle">CDMX - HERMANOS RODRÍGUEZ</text>
                    </svg>`,
                    'sao paulo': `<svg viewBox="0 0 200 160" xmlns="http://www.w3.org/2000/svg" style="width:100%;display:block;">
                        <rect width="200" height="160" fill="#1a1a2e" rx="8"/>
                        <path d="M80,130 Q40,125 30,95 Q20,65 50,45 Q80,25 120,30 Q155,35 168,65 Q178,90 165,115 Q150,140 110,140 Q95,140 80,130 Z"
                            fill="none" stroke="#3D6FFF" stroke-width="3"/>
                        <circle cx="80" cy="130" r="5" fill="#ff4757"/>
                        <text x="100" y="18" font-size="8" fill="#ffd700" font-family="system-ui" font-weight="bold" text-anchor="middle">INTERLAGOS</text>
                    </svg>`,
                    'nevada': `<svg viewBox="0 0 200 160" xmlns="http://www.w3.org/2000/svg" style="width:100%;display:block;">
                        <rect width="200" height="160" fill="#1a1a2e" rx="8"/>
                        <path d="M160,130 L160,40 Q160,25 145,25 L55,25 Q40,25 40,40 L40,70 L140,70 L140,100 L40,100 L40,130 Q40,145 55,145 L145,145 Q160,145 160,130 Z"
                            fill="none" stroke="#3D6FFF" stroke-width="3"/>
                        <circle cx="160" cy="130" r="5" fill="#ff4757"/>
                        <text x="100" y="15" font-size="8" fill="#ffd700" font-family="system-ui" font-weight="bold" text-anchor="middle">LAS VEGAS STRIP</text>
                    </svg>`,
                    'lusail': `<svg viewBox="0 0 200 160" xmlns="http://www.w3.org/2000/svg" style="width:100%;display:block;">
                        <rect width="200" height="160" fill="#1a1a2e" rx="8"/>
                        <path d="M80,130 Q40,125 28,95 Q16,65 40,45 Q64,25 105,28 Q145,31 163,60 Q178,85 165,112 Q150,138 112,142 Q96,145 80,130 Z"
                            fill="none" stroke="#3D6FFF" stroke-width="3"/>
                        <circle cx="80" cy="130" r="5" fill="#ff4757"/>
                        <text x="100" y="17" font-size="8" fill="#ffd700" font-family="system-ui" font-weight="bold" text-anchor="middle">LUSAIL</text>
                    </svg>`,
                    'abu dhabi': `<svg viewBox="0 0 200 160" xmlns="http://www.w3.org/2000/svg" style="width:100%;display:block;">
                        <rect width="200" height="160" fill="#1a1a2e" rx="8"/>
                        <path d="M60,120 Q30,115 25,85 Q20,55 50,35 Q80,15 125,20 Q165,25 175,55 Q182,80 168,105 Q152,130 118,138 Q85,145 60,120 Z"
                            fill="none" stroke="#3D6FFF" stroke-width="3"/>
                        <circle cx="60" cy="120" r="5" fill="#ff4757"/>
                        <text x="100" y="9" font-size="8" fill="#ffd700" font-family="system-ui" font-weight="bold" text-anchor="middle">YAS MARINA</text>
                    </svg>`,
                };

                const _f1 = async (url) => {
                    const r = await fetch(CF_WORKER + '/?url=' + encodeURIComponent(url));
                    if (!r.ok) throw new Error('HTTP ' + r.status);
                    return r.json();
                };
                const _stat    = (stats, ab) => (stats ?? []).find(s => s.abbreviation === ab)?.displayValue ?? '';
                const _medalla = (pos) => pos === 1 ? '#ffd700' : pos === 2 ? '#c0c0c0' : pos === 3 ? '#cd7f32' : 'var(--text-muted)';
                const _flagImg = (href) => href
                    ? `<img src="${href}" width="18" height="12" style="object-fit:cover;border-radius:2px;vertical-align:middle;" onerror="this.style.display='none'">`
                    : '';
                const _err = (msg) => { container.innerHTML = `<div class="glass-panel" style="padding:2rem;text-align:center;color:var(--text-muted);font-size:0.85rem;">${msg}</div>`; };

                try {
                    if (ligaActual.id === 'pilotos' || ligaActual.id === 'constructores') {
                        const data     = await _f1('https://site.api.espn.com/apis/v2/sports/racing/f1/standings');
                        const children = data.children ?? [];
                        const dRaw     = children.find(c => /driver/i.test(c.name ?? ''))?.standings?.entries ?? [];
                        const cRaw     = children.find(c => /constructor/i.test(c.name ?? ''))?.standings?.entries ?? [];
                        const anio     = children[0]?.standings?.season ?? new Date().getFullYear();

                        const pilotos = dRaw.map(e => {
                            const ab   = e.athlete?.abbreviation ?? '';
                            const meta = F1_META[ab] ?? {};
                            return {
                                pos:    Number(_stat(e.stats, 'RK')) || 0,
                                nombre: e.athlete?.displayName ?? '?',
                                flag:   e.athlete?.flag?.href ?? '',
                                equipo: meta.eq ?? '',
                                num:    meta.num ?? '',
                                puntos: _stat(e.stats, 'PTS') || '0',
                            };
                        }).sort((a, b) => a.pos - b.pos);

                        if (ligaActual.id === 'pilotos') {
                            if (!pilotos.length) return _err('No se pudo cargar el campeonato de pilotos.');
                            container.innerHTML = `
                                <p style="font-size:0.7rem; color:var(--accent-neon); text-transform:uppercase; letter-spacing:1px; margin-bottom:1rem;">
                                    Campeonato de Pilotos ${anio} · en vivo
                                </p>
                                <div class="glass-panel" style="padding:1rem;">
                                    ${pilotos.map(p => `
                                        <div style="display:grid; grid-template-columns:30px 32px 1fr auto; align-items:center; gap:10px;
                                            padding:10px 8px; border-bottom:1px solid var(--border-glass);">
                                            <span style="font-weight:800; font-size:0.85rem; color:${_medalla(p.pos)};">${p.pos}</span>
                                            <div style="background:rgba(255,255,255,0.08); border-radius:6px; width:28px; height:28px;
                                                display:flex; align-items:center; justify-content:center; font-family:var(--font-heading);
                                                font-size:0.75rem; font-weight:900;">${p.num}</div>
                                            <div>
                                                <div style="font-weight:700; font-size:0.88rem;">${_flagImg(p.flag)} ${p.nombre}</div>
                                                <div style="font-size:0.72rem; color:var(--text-muted);">${p.equipo}</div>
                                            </div>
                                            <div style="text-align:right;">
                                                <div style="font-family:var(--font-heading); font-weight:900; font-size:1rem;
                                                    color:${p.pos === 1 ? '#ffd700' : 'var(--text-main)'};">${p.puntos}</div>
                                                <div style="font-size:0.65rem; color:var(--text-muted);">pts</div>
                                            </div>
                                        </div>
                                    `).join('')}
                                </div>
                            `;
                        } else {
                            const constructores = cRaw.map(e => ({
                                pos:    Number(_stat(e.stats, 'RK')) || 0,
                                equipo: e.team?.displayName ?? '?',
                                color:  e.team?.color ? '#' + e.team.color : 'var(--text-muted)',
                                puntos: _stat(e.stats, 'PTS') || '0',
                            })).sort((a, b) => a.pos - b.pos);
                            if (!constructores.length) return _err('No se pudo cargar el campeonato de constructores.');

                            // Plantel por escudería, derivado del mapa estático de pilotos.
                            const rosterPorEquipo = {};
                            pilotos.forEach(p => { if (p.equipo) (rosterPorEquipo[p.equipo] ??= []).push(p.nombre.split(' ').pop()); });

                            container.innerHTML = `
                                <p style="font-size:0.7rem; color:var(--accent-neon); text-transform:uppercase; letter-spacing:1px; margin-bottom:1rem;">
                                    Campeonato de Constructores ${anio} · en vivo
                                </p>
                                <div class="glass-panel" style="padding:1rem;">
                                    ${constructores.map(c => `
                                        <div style="display:grid; grid-template-columns:30px 12px 1fr auto; align-items:center; gap:12px;
                                            padding:12px 8px; border-bottom:1px solid var(--border-glass);">
                                            <span style="font-weight:800; font-size:0.9rem; color:${_medalla(c.pos)};">${c.pos}</span>
                                            <div style="width:12px; height:32px; border-radius:3px; background:${c.color};"></div>
                                            <div>
                                                <div style="font-weight:700; font-size:0.9rem;">${c.equipo}</div>
                                                <div style="font-size:0.72rem; color:var(--text-muted);">
                                                    ${(rosterPorEquipo[c.equipo] ?? []).join(' · ')}
                                                </div>
                                            </div>
                                            <div style="text-align:right;">
                                                <div style="font-family:var(--font-heading); font-weight:900; font-size:1rem;
                                                    color:${c.pos === 1 ? '#ffd700' : 'var(--text-main)'};">${c.puntos}</div>
                                                <div style="font-size:0.65rem; color:var(--text-muted);">pts</div>
                                            </div>
                                        </div>
                                    `).join('')}
                                </div>
                            `;
                        }

                    } else if (ligaActual.id === 'carreras') {
                        const anioActual = new Date().getFullYear();
                        const sb = await _f1(`https://site.api.espn.com/apis/site/v2/sports/racing/f1/scoreboard?dates=${anioActual}0101-${anioActual}1231`);
                        const evs = (sb.events ?? []).slice().sort((a, b) => new Date(a.date) - new Date(b.date));
                        if (!evs.length) return _err('No se pudo cargar el calendario.');

                        const fmtFecha = (d) => d.toLocaleDateString('es-AR', { day:'numeric', month:'short', timeZone:'America/Argentina/Buenos_Aires' });
                        const carreras = evs.map((e, i) => {
                            const comp = e.competitions?.[0] ?? {};
                            const st   = comp.status?.type?.state ?? 'pre';
                            const cs   = comp.competitors ?? [];
                            const win  = cs.find(c => c.winner === true) ?? cs.find(c => String(c.order) === '1');
                            // La ciudad es la clave del trazado: ESPN la manda en
                            // circuit.address.city ("Monte carlo", "Sao paulo"…).
                            const ciudad = (e.circuit?.address?.city ?? '')
                                .toLowerCase()
                                .normalize('NFD').replace(/[̀-ͯ]/g, '');
                            return {
                                ronda:      i + 1,
                                nombre:     e.shortName ?? e.name ?? 'GP',
                                fecha:      new Date(e.date),
                                completada: st === 'post',
                                enVivo:     st === 'in',
                                ganador:    win?.athlete?.displayName ?? null,
                                ciudad,
                                circuito:   e.circuit?.fullName ?? '',
                                pais:       e.circuit?.address?.country ?? '',
                            };
                        });
                        const proxima = carreras.find(c => !c.completada && !c.enVivo);
                        window._f1Carreras = carreras;   // lo lee _verCircuito

                        container.innerHTML = `
                            ${proxima ? `
                            <div style="background:rgba(61,111,255,0.08); border:1px solid rgba(61,111,255,0.3);
                                border-radius:10px; padding:12px 16px; margin-bottom:1rem; display:flex; align-items:center; gap:12px;">
                                <span style="font-size:1.5rem;">🏁</span>
                                <div>
                                    <div style="font-size:0.7rem; color:var(--accent-neon); font-weight:700; text-transform:uppercase; letter-spacing:1px;">Próxima carrera</div>
                                    <div style="font-weight:800; font-size:1rem;">${proxima.nombre}</div>
                                    <div style="font-size:0.78rem; color:var(--text-muted);">${fmtFecha(proxima.fecha)}</div>
                                </div>
                            </div>` : ''}

                            ${carreras.map(c => {
                                const activa = c.enVivo || c === proxima;
                                const tieneMapa = !!F1_CIRCUITOS[c.ciudad];
                                return `
                                <div ${tieneMapa ? `onclick="window._verCircuito(${c.ronda})"` : ''}
                                    style="display:grid; grid-template-columns:36px 1fr auto; align-items:center; gap:12px;
                                    padding:10px 12px; border-radius:10px; margin-bottom:6px;
                                    background:${activa ? 'rgba(61,111,255,0.06)' : 'rgba(255,255,255,0.03)'};
                                    border:1px solid ${activa ? 'rgba(61,111,255,0.3)' : 'var(--border-glass)'};
                                    cursor:${tieneMapa ? 'pointer' : 'default'};">
                                    <div style="font-family:var(--font-heading); font-size:0.85rem; font-weight:800; color:var(--text-muted); text-align:center;">R${c.ronda}</div>
                                    <div>
                                        <div style="font-weight:700; font-size:0.9rem; color:${c.completada ? 'var(--text-main)' : activa ? 'var(--accent-neon)' : 'var(--text-muted)'};">
                                            🏁 ${c.nombre}
                                        </div>
                                        ${c.circuito ? `<div style="font-size:0.72rem; color:var(--text-muted);">${c.circuito}</div>` : ''}
                                        ${c.completada && c.ganador ? `<div style="font-size:0.72rem; color:var(--accent-neon); margin-top:2px;">🏆 ${c.ganador}</div>` : ''}
                                    </div>
                                    <div style="text-align:right;">
                                        <div style="font-size:0.8rem; font-weight:700; color:${c.completada ? 'var(--text-muted)' : 'var(--accent-neon)'};">${fmtFecha(c.fecha)}</div>
                                        ${c.enVivo ? '<div style="font-size:0.65rem; color:#ff4757;">EN VIVO</div>'
                                          : c.completada ? '<div style="font-size:0.65rem; color:var(--text-muted);">✓ FIN</div>'
                                          : c === proxima ? '<div style="font-size:0.65rem; color:var(--accent-neon);">PRÓXIMA</div>' : ''}
                                        ${tieneMapa ? '<div style="font-size:0.65rem; color:var(--text-muted); margin-top:2px;">Ver circuito →</div>' : ''}
                                    </div>
                                </div>`;
                            }).join('')}
                        `;

                        // Detalle de un circuito: trazado + datos de la carrera.
                        window._verCircuito = (ronda) => {
                            const c = (window._f1Carreras ?? []).find(x => x.ronda === ronda);
                            const svg = c && F1_CIRCUITOS[c.ciudad];
                            if (!c || !svg) return;
                            container.innerHTML = `
                                <button onclick="window.location.hash='#/other-sports?deporte=racing&liga=carreras'"
                                    style="background:transparent; border:1px solid var(--border-glass); color:var(--text-muted);
                                    padding:6px 14px; border-radius:12px; cursor:pointer; font-size:0.8rem; margin-bottom:1.2rem;">← Volver</button>

                                <div class="glass-panel" style="padding:1.5rem;">
                                    <h3 style="font-family:var(--font-heading); font-size:1.1rem; font-weight:900; color:var(--accent-neon); margin-bottom:0.3rem;">
                                        🏁 ${c.nombre}
                                    </h3>
                                    <p style="font-size:0.8rem; color:var(--text-muted); margin-bottom:1.2rem;">
                                        ${c.circuito}${c.pais ? ' — ' + c.pais : ''} · ${fmtFecha(c.fecha)}
                                    </p>

                                    ${svg}

                                    <div style="margin-top:1rem; padding:12px; border-radius:8px;
                                        background:${c.completada ? 'rgba(61,111,255,0.06)' : 'rgba(255,255,255,0.04)'};
                                        border:1px solid ${c.completada ? 'rgba(61,111,255,0.2)' : 'var(--border-glass)'};">
                                        ${c.completada && c.ganador
                                            ? `<div style="font-size:0.7rem; color:var(--accent-neon); text-transform:uppercase; letter-spacing:1px; margin-bottom:4px;">Ganador</div>
                                               <div style="font-weight:800; font-size:1rem;">🏆 ${c.ganador}</div>`
                                            : `<div style="font-size:0.8rem; color:var(--text-muted);">${c.completada ? 'Carrera finalizada' : 'Carrera pendiente'} — ${fmtFecha(c.fecha)}</div>`}
                                    </div>
                                </div>`;
                        };
                    }
                } catch (err) {
                    _err('No se pudieron cargar los datos de F1. Probá de nuevo en un rato.');
                }

                return;
            }
            // ── FIN F1 ───────────────────────────────────────────────────────

            const PATIN_PERFILES = {
                'Ilia Malinin': {
                    pais: '🇺🇸 EE.UU.', nacimiento: '2004', entrenador: 'Rafael Arutyunyan',
                    ranking: 1,
                    pb: { sp: '111.71', fs: '230.51', total: '342.22' },
                    sp: { tes: '64.18', pcs: '47.53', caidas: 0,
                        elementos: ['4Lz (GOE +4.1)', '4T+3T (GOE +3.8)', 'FCSp4', 'CSSp4', 'StSq4', '3A (GOE +3.2)', 'CCoSp4'] },
                    fs: { tes: '139.04', pcs: '91.47', caidas: 0,
                        elementos: ['4A (GOE +4.0)', '4Lz+3T', '4F', '4Lo', '4S+2T', '3A+1Eu+3S', '3Lz', 'ChSq1', 'FCSp4', 'CSSp4', 'StSq4', 'CCoSp4'] },
                    palmarés: ['🥇 World 2023', '🥇 World 2025', '🥇 GP Final 2022', '🥇 4 Continents 2024'],
                    nota: 'Único patinador en historia en completar un 4A (Axel cuádruple) en competencia oficial.'
                },
                'Yuma Kagiyama': {
                    pais: '🇯🇵 Japón', nacimiento: '2003', entrenador: 'Stéphane Lambiel',
                    ranking: 2,
                    pb: { sp: '103.53', fs: '210.40', total: '298.41' },
                    sp: { tes: '58.21', pcs: '45.32', caidas: 0,
                        elementos: ['4F (GOE +2.8)', '4T+3T (GOE +2.4)', 'FCSp4', 'CSSp4', 'StSq4', '3A (GOE +2.9)', 'CCoSp4'] },
                    fs: { tes: '118.07', pcs: '92.33', caidas: 0,
                        elementos: ['4F', '4T+3T', '4S', '3A+1Eu+3F', '3Lz+3T', '3Lo', '3A', 'ChSq1', 'FCSp4', 'CSSp4', 'StSq4', 'CCoSp4'] },
                    palmarés: ['🥈 Olympic 2022', '🥈 World 2022', '🥈 World 2025', '🥇 4 Continents 2022'],
                    nota: 'Conocido por su elegancia artística y patinaje técnicamente limpio.'
                },
                'Adam Siao Him Fa': {
                    pais: '🇫🇷 Francia', nacimiento: '2000', entrenador: 'Frédéric Dambier',
                    ranking: 3,
                    pb: { sp: '96.18', fs: '180.00', total: '276.18' },
                    sp: { tes: '54.10', pcs: '42.08', caidas: 0,
                        elementos: ['4T (GOE +1.9)', '3A+3T', 'FCSp4', 'CSSp4', 'StSq3', '3Lz (GOE +1.4)', 'CCoSp4'] },
                    fs: { tes: '100.22', pcs: '79.78', caidas: 1,
                        elementos: ['4T', '4S', '3A+3T', '3Lz+1Eu+3S', '3F', '3Lo', '3A', 'ChSq1', 'FCSp4', 'CSSp4', 'StSq3', 'CCoSp4'] },
                    palmarés: ['🥉 World 2025', '🥇 Europeans 2023', '🥇 Europeans 2024'],
                    nota: 'Dos veces campeón europeo consecutivo. Estilo artístico muy valorado.'
                },
                'Shun Sato': {
                    pais: '🇯🇵 Japón', nacimiento: '2001', entrenador: 'Mie Hamada',
                    ranking: 4,
                    pb: { sp: '98.44', fs: '172.61', total: '271.05' },
                    sp: { tes: '55.30', pcs: '43.14', caidas: 0,
                        elementos: ['4T+3T', '3A (GOE +2.1)', 'FCSp4', 'CSSp4', 'StSq4', '3Lz', 'CCoSp4'] },
                    fs: { tes: '96.18', pcs: '76.43', caidas: 1,
                        elementos: ['4T', '4S', '3A+3T', '3Lz+1Eu+3F', '3Lo', '3F', '3A', 'ChSq1', 'FCSp4', 'CSSp4', 'StSq3', 'CCoSp4'] },
                    palmarés: ['🥇 NHK Trophy 2022', '🥈 GP Final 2022'],
                    nota: 'Patinador japonés de gran proyección, destacado por su versatilidad.'
                },
                'Kevin Aymoz': {
                    pais: '🇫🇷 Francia', nacimiento: '1997', entrenador: 'Katja Winkler',
                    ranking: 5,
                    pb: { sp: '94.55', fs: '173.78', total: '268.33' },
                    sp: { tes: '52.11', pcs: '42.44', caidas: 0,
                        elementos: ['4T (GOE +1.2)', '3A+3T', 'FCSp4', 'CSSp4', 'StSq4', '3Lz', 'CCoSp4'] },
                    fs: { tes: '94.00', pcs: '79.78', caidas: 1,
                        elementos: ['4T', '3A+3T', '3Lz+1Eu+3S', '3F', '3Lo', '3S', '3A', 'ChSq1', 'FCSp4', 'CSSp4', 'StSq4', 'CCoSp4'] },
                    palmarés: ['🥇 GP Rostelecom 2019', '🥈 Europeans 2020'],
                    nota: 'Reconocido por sus excepcionales Program Component Scores (artístico).'
                },
                'Kaori Sakamoto': {
                    pais: '🇯🇵 Japón', nacimiento: '2000', entrenador: 'Sonoko Nakano',
                    ranking: 1,
                    pb: { sp: '81.31', fs: '151.82', total: '233.13' },
                    sp: { tes: '45.18', pcs: '36.13', caidas: 0,
                        elementos: ['3Lz+3T (GOE +2.4)', '3F (GOE +2.8)', 'FCSp4', 'LSp4', 'StSq4', '2A (GOE +2.0)', 'CCoSp4'] },
                    fs: { tes: '83.44', pcs: '68.38', caidas: 0,
                        elementos: ['3Lz+3T', '3F+1Eu+3S', '3Lo', '3Lz', '3S', '2A+3T', '2A', 'ChSq1', 'FCSp4', 'LSp4', 'StSq4', 'CCoSp4'] },
                    palmarés: ['🥇 World 2022', '🥇 World 2023', '🥇 World 2025', '🥇 GP Final 2021', '🥇 GP Final 2022'],
                    nota: 'Tres veces campeona mundial. Velocidad y consistencia excepcionales.'
                },
                'Isabeau Levito': {
                    pais: '🇺🇸 EE.UU.', nacimiento: '2006', entrenador: 'Nikolai Morozov',
                    ranking: 2,
                    pb: { sp: '74.52', fs: '147.35', total: '221.87' },
                    sp: { tes: '40.11', pcs: '34.41', caidas: 0,
                        elementos: ['3Lz+3T', '3F', 'FCSp4', 'LSp4', 'StSq4', '2A', 'CCoSp4'] },
                    fs: { tes: '80.22', pcs: '67.13', caidas: 0,
                        elementos: ['3Lz+3T', '3F+1Eu+3S', '3Lo', '3Lz', '3S+3T', '2A', '3F', 'ChSq1', 'FCSp4', 'LSp4', 'StSq4', 'CCoSp4'] },
                    palmarés: ['🥈 World 2025', '🥇 US Nationals 2024', '🥈 GP Final 2023'],
                    nota: 'Una de las jóvenes más prometedoras del patinaje femenino mundial.'
                },
                'Loena Hendrickx': {
                    pais: '🇧🇪 Bélgica', nacimiento: '1999', entrenador: 'Jorik Hendrickx',
                    ranking: 3,
                    pb: { sp: '76.88', fs: '141.56', total: '218.44' },
                    sp: { tes: '42.00', pcs: '34.88', caidas: 0,
                        elementos: ['3Lz+3T', '3F', 'FCSp4', 'LSp4', 'StSq4', '2A', 'CCoSp4'] },
                    fs: { tes: '76.44', pcs: '65.12', caidas: 0,
                        elementos: ['3Lz+3T', '3F+1Eu+3Lo', '3Lo', '3Lz', '3S', '2A+3T', '2A', 'ChSq1', 'FCSp4', 'LSp4', 'StSq4', 'CCoSp4'] },
                    palmarés: ['🥉 World 2025', '🥇 Europeans 2023', '🥉 GP Final 2022'],
                    nota: 'Primer medallista mundial belga en patinaje artístico femenino.'
                },
                'Madison Chock / Evan Bates': {
                    pais: '🇺🇸 EE.UU.', nacimiento: '1992 / 1989', entrenador: 'Igor Shpilband',
                    ranking: 1,
                    pb: { sp: '91.43', fs: '137.98', total: '229.41' },
                    sp: { tes: '52.18', pcs: '39.25', caidas: 0,
                        elementos: ['TwB4', 'SyTwM4/W4', 'StaLi4', 'SlLi4', 'CoSp4', 'DiSt1', 'ChSt1'] },
                    fs: { tes: '78.44', pcs: '59.54', caidas: 0,
                        elementos: ['TwB4', 'SyTwM4/W4', 'OFStM3/W3', 'MiSt3', 'CoSp4', 'CuLi4', 'StaLi4', 'SlLi4', 'ChSp1', 'ChSt1'] },
                    palmarés: ['🥇 World 2025', '🥇 GP Final 2023', '🥈 Olympic 2022', '🥇 US Nationals 2024'],
                    nota: 'Pareja dominante del patinaje de danza. Medallistas olímpicos en Beijing 2022.'
                },
                'Piper Gilles / Paul Poirier': {
                    pais: '🇨🇦 Canadá', nacimiento: '1993 / 1991', entrenador: 'Marie-France Dubreuil',
                    ranking: 2,
                    pb: { sp: '88.14', fs: '133.74', total: '221.88' },
                    sp: { tes: '50.22', pcs: '37.92', caidas: 0,
                        elementos: ['TwB3', 'SyTwM4/W3', 'StaLi4', 'SlLi4', 'CoSp4', 'DiSt1', 'ChSt1'] },
                    fs: { tes: '75.00', pcs: '58.74', caidas: 0,
                        elementos: ['TwB3', 'SyTwM4/W3', 'OFStM3/W3', 'MiSt3', 'CoSp4', 'CuLi4', 'StaLi4', 'SlLi4', 'ChSp1', 'ChSt1'] },
                    palmarés: ['🥈 World 2025', '🥇 Canadian Nationals 2022-2024', '🥉 GP Final 2023'],
                    nota: 'Conocidos por sus programas creativos y musicalmente innovadores.'
                },
                'Riku Miura / Ryuichi Kihara': {
                    pais: '🇯🇵 Japón', nacimiento: '1999 / 1994', entrenador: 'Bruno Marcotte',
                    ranking: 1,
                    pb: { sp: '80.11', fs: '148.81', total: '228.92' },
                    sp: { tes: '46.22', pcs: '33.89', caidas: 0,
                        elementos: ['3Tw3', '3S+COMBO', 'BiDs3', 'FiDs4', 'BoDs3', 'PCoSp4', 'StSq3'] },
                    fs: { tes: '85.44', pcs: '63.37', caidas: 0,
                        elementos: ['3Tw4', '3T+3T', '3S', '3Lo', '2A+1Eu+3S', 'BiDs4', 'FiDs4', 'BoDs3', 'PCoSp4', 'ChSq1', 'StSq3', 'Li4'] },
                    palmarés: ['🥇 World 2025', '🥈 World 2023', '🥇 4 Continents 2023'],
                    nota: 'Primera pareja japonesa en ganar el Campeonato Mundial.'
                },
            };

            const PATIN_DATA = {
                men: {
                    titulo: 'Individual Masculino — ISU World Championships 2025',
                    podio: [
                        { pos: 1, nombre: 'Ilia Malinin',      pais: '🇺🇸 EE.UU.',   puntos: '342.22' },
                        { pos: 2, nombre: 'Yuma Kagiyama',     pais: '🇯🇵 Japón',    puntos: '298.41' },
                        { pos: 3, nombre: 'Adam Siao Him Fa',  pais: '🇫🇷 Francia',  puntos: '276.18' },
                        { pos: 4, nombre: 'Shun Sato',         pais: '🇯🇵 Japón',    puntos: '271.05' },
                        { pos: 5, nombre: 'Kevin Aymoz',       pais: '🇫🇷 Francia',  puntos: '268.33' },
                    ],
                    proximos: 'Grand Prix Series 2025/26 — Temporada por comenzar (oct 2025)'
                },
                women: {
                    titulo: 'Individual Femenino — ISU World Championships 2025',
                    podio: [
                        { pos: 1, nombre: 'Kaori Sakamoto',    pais: '🇯🇵 Japón',    puntos: '233.13' },
                        { pos: 2, nombre: 'Isabeau Levito',    pais: '🇺🇸 EE.UU.',   puntos: '221.87' },
                        { pos: 3, nombre: 'Loena Hendrickx',   pais: '🇧🇪 Bélgica',  puntos: '218.44' },
                        { pos: 4, nombre: 'Chaeyeon Kim',      pais: '🇰🇷 Corea',    puntos: '215.92' },
                        { pos: 5, nombre: 'Niina Petrokina',   pais: '🇪🇪 Estonia',  puntos: '210.07' },
                    ],
                    proximos: 'Grand Prix Series 2025/26 — Temporada por comenzar (oct 2025)'
                },
                pairs: {
                    titulo: 'Parejas — ISU World Championships 2025',
                    podio: [
                        { pos: 1, nombre: 'Riku Miura / Ryuichi Kihara',         pais: '🇯🇵 Japón',   puntos: '228.92' },
                        { pos: 2, nombre: 'Deanna Stellato / Max Deschamps',     pais: '🇨🇦 Canadá',  puntos: '221.44' },
                        { pos: 3, nombre: 'Anastasia Mishina / Aleksandr Galliamov', pais: '🇷🇺*',    puntos: '219.71' },
                        { pos: 4, nombre: 'Julianne Séguin / Charlie Bilodeau',  pais: '🇨🇦 Canadá',  puntos: '207.33' },
                        { pos: 5, nombre: 'Rebecca Ghilardi / Filippo Ambrosini',pais: '🇮🇹 Italia',  puntos: '204.18' },
                    ],
                    proximos: '* Compiten bajo bandera neutral ISU'
                },
                dance: {
                    titulo: 'Danza sobre Hielo — ISU World Championships 2025',
                    podio: [
                        { pos: 1, nombre: 'Madison Chock / Evan Bates',         pais: '🇺🇸 EE.UU.',  puntos: '229.41' },
                        { pos: 2, nombre: 'Piper Gilles / Paul Poirier',         pais: '🇨🇦 Canadá',  puntos: '221.88' },
                        { pos: 3, nombre: 'Charlène Guignard / Marco Fabbri',   pais: '🇮🇹 Italia',  puntos: '218.07' },
                        { pos: 4, nombre: 'Lilah Fear / Lewis Gibson',           pais: '🇬🇧 GB',       puntos: '210.54' },
                        { pos: 5, nombre: 'Laurence Fournier Beaudry / Nikolaj Sørensen', pais: '🇨🇦🇩🇰', puntos: '207.92' },
                    ],
                    proximos: 'Grand Prix Series 2025/26 — Temporada por comenzar (oct 2025)'
                }
            };

            const data = PATIN_DATA[ligaActual.id];
            const container = document.getElementById('other-sports-content');
            if (!container || !data) return;

            const medallas = ['🥇', '🥈', '🥉'];

            // Función para mostrar perfil de patinador
            window._verPatinador = (nombre) => {
                const p = PATIN_PERFILES[nombre];
                if (!p) return;
                const container = document.getElementById('other-sports-content');
                container.innerHTML = `
                    <button onclick="window._volverPatin()" style="background:transparent; border:1px solid var(--border-glass);
                        color:var(--text-muted); padding:6px 14px; border-radius:12px; cursor:pointer;
                        font-size:0.8rem; margin-bottom:1.2rem;">← Volver</button>

                    <div class="glass-panel" style="padding:1.5rem; margin-bottom:1rem;">
                        <div style="display:flex; align-items:flex-start; gap:16px; margin-bottom:1.2rem;">
                            <div style="width:48px; height:48px; background:rgba(61,111,255,0.1); border:2px solid var(--accent-neon);
                                border-radius:50%; display:flex; align-items:center; justify-content:center;
                                font-size:1.4rem; flex-shrink:0;">⛸️</div>
                            <div>
                                <div style="font-family:var(--font-heading); font-size:1.1rem; font-weight:900;
                                    color:var(--text-main);">${nombre}</div>
                                <div style="font-size:0.8rem; color:var(--text-muted);">${p.pais} · Ranking #${p.ranking}</div>
                                <div style="font-size:0.75rem; color:var(--text-muted);">Nacido/a: ${p.nacimiento} · Entrenador: ${p.entrenador}</div>
                            </div>
                        </div>

                        <!-- Personal Bests -->
                        <p style="font-size:0.72rem; color:var(--accent-neon); text-transform:uppercase; letter-spacing:1px; margin-bottom:8px;">Personal Best</p>
                        <div style="display:grid; grid-template-columns:repeat(3,1fr); gap:8px; margin-bottom:1.2rem;">
                            ${[['SP', p.pb.sp], ['FS', p.pb.fs], ['Total', p.pb.total]].map(([label, val]) => `
                                <div style="background:rgba(255,255,255,0.04); border-radius:10px; padding:10px; text-align:center;">
                                    <div style="font-size:0.7rem; color:var(--text-muted); margin-bottom:4px;">${label}</div>
                                    <div style="font-family:var(--font-heading); font-size:1.1rem; font-weight:900;
                                        color:${label === 'Total' ? '#ffd700' : 'var(--text-main)'};">${val}</div>
                                </div>
                            `).join('')}
                        </div>

                        <!-- Short Program -->
                        <p style="font-size:0.72rem; color:var(--accent-neon); text-transform:uppercase; letter-spacing:1px; margin-bottom:8px;">Short Program</p>
                        <div style="display:grid; grid-template-columns:repeat(3,1fr); gap:8px; margin-bottom:8px;">
                            ${[['TES', p.sp.tes], ['PCS', p.sp.pcs], ['Caídas', p.sp.caidas]].map(([label, val]) => `
                                <div style="background:rgba(255,255,255,0.04); border-radius:8px; padding:8px; text-align:center;">
                                    <div style="font-size:0.68rem; color:var(--text-muted);">${label}</div>
                                    <div style="font-weight:700; font-size:0.9rem;">${val}</div>
                                </div>
                            `).join('')}
                        </div>
                        <div style="display:flex; flex-wrap:wrap; gap:5px; margin-bottom:1.2rem;">
                            ${p.sp.elementos.map(e => `<span style="background:rgba(255,255,255,0.06); padding:3px 8px;
                                border-radius:10px; font-size:0.7rem; color:var(--text-muted); font-family:monospace;">${e}</span>`).join('')}
                        </div>

                        <!-- Free Skating -->
                        <p style="font-size:0.72rem; color:var(--accent-neon); text-transform:uppercase; letter-spacing:1px; margin-bottom:8px;">Free Skating</p>
                        <div style="display:grid; grid-template-columns:repeat(3,1fr); gap:8px; margin-bottom:8px;">
                            ${[['TES', p.fs.tes], ['PCS', p.fs.pcs], ['Caídas', p.fs.caidas]].map(([label, val]) => `
                                <div style="background:rgba(255,255,255,0.04); border-radius:8px; padding:8px; text-align:center;">
                                    <div style="font-size:0.68rem; color:var(--text-muted);">${label}</div>
                                    <div style="font-weight:700; font-size:0.9rem;">${val}</div>
                                </div>
                            `).join('')}
                        </div>
                        <div style="display:flex; flex-wrap:wrap; gap:5px; margin-bottom:1.2rem;">
                            ${p.fs.elementos.map(e => `<span style="background:rgba(255,255,255,0.06); padding:3px 8px;
                                border-radius:10px; font-size:0.7rem; color:var(--text-muted); font-family:monospace;">${e}</span>`).join('')}
                        </div>

                        <!-- Palmarés -->
                        <p style="font-size:0.72rem; color:var(--accent-neon); text-transform:uppercase; letter-spacing:1px; margin-bottom:8px;">Palmarés</p>
                        <div style="display:flex; flex-wrap:wrap; gap:6px; margin-bottom:1rem;">
                            ${p.palmarés.map(m => `<span style="background:rgba(255,215,0,0.1); border:1px solid rgba(255,215,0,0.3);
                                padding:4px 10px; border-radius:12px; font-size:0.75rem; color:#ffd700;">${m}</span>`).join('')}
                        </div>

                        ${p.nota ? `<p style="font-size:0.78rem; color:var(--text-muted); font-style:italic; border-top:1px solid var(--border-glass); padding-top:1rem;">${p.nota}</p>` : ''}
                    </div>
                `;
            };

            window._volverPatin = () => {
                window.location.hash = `#/other-sports?deporte=figure-skating&liga=${ligaActual.id}`;
            };

            container.innerHTML = `
                <div class="glass-panel" style="padding:1.2rem; margin-bottom:1rem;">
                    <p style="font-size:0.75rem; color:var(--accent-neon); text-transform:uppercase; letter-spacing:1px; margin-bottom:1rem;">${data.titulo}</p>
                    ${data.podio.map(p => `
                        <div onclick="${PATIN_PERFILES[p.nombre] ? `window._verPatinador('${p.nombre.replace(/'/g,"\\'")}')` : ''}"
                            style="display:flex; align-items:center; gap:12px; padding:10px 0;
                            border-bottom:1px solid var(--border-glass);
                            cursor:${PATIN_PERFILES[p.nombre] ? 'pointer' : 'default'};
                            transition:background 0.15s;"
                            onmouseover="${PATIN_PERFILES[p.nombre] ? "this.style.background='rgba(61,111,255,0.04)'" : ''}"
                            onmouseout="this.style.background='transparent'">
                            <span style="font-size:${p.pos <= 3 ? '1.4rem' : '0.9rem'}; min-width:28px; text-align:center;">
                                ${p.pos <= 3 ? medallas[p.pos - 1] : p.pos + '.'}
                            </span>
                            <div style="flex:1;">
                                <div style="font-weight:${p.pos === 1 ? '800' : '600'}; font-size:0.9rem;
                                    color:${p.pos === 1 ? '#ffd700' : 'var(--text-main)'};">${p.nombre}</div>
                                <div style="font-size:0.75rem; color:var(--text-muted);">${p.pais}</div>
                            </div>
                            <div style="display:flex; align-items:center; gap:8px;">
                                <span style="font-family:var(--font-heading); font-weight:700; font-size:0.9rem;
                                    color:var(--text-muted);">${p.puntos} pts</span>
                                ${PATIN_PERFILES[p.nombre] ? `<span style="font-size:0.7rem; color:var(--accent-neon);">Ver →</span>` : ''}
                            </div>
                        </div>
                    `).join('')}
                    <p style="font-size:0.72rem; color:var(--text-muted); margin-top:1rem; font-style:italic;">${data.proximos}</p>
                </div>
            `;
            return;
        }

        // Cargar scoreboard del deporte/liga
        try {
            const hoyAR = new Date(new Date().toLocaleString('en-US', {timeZone:'America/Argentina/Buenos_Aires'}));
            const fecha = `${hoyAR.getFullYear()}${String(hoyAR.getMonth()+1).padStart(2,'0')}${String(hoyAR.getDate()).padStart(2,'0')}`;

            const container = document.getElementById('other-sports-content');
            if (!container) return;

            // ── NBA / NFL / MLB / NHL: vista con tabs ────────────────────────
            const DEPORTES_CON_STATS = {
                'basketball/nba':  { standingsPath: 'basketball/nba',  label: 'NBA',  statNames: ['PTS','REB','AST','STL','BLK'] },
                'basketball/wnba': { standingsPath: 'basketball/wnba', label: 'WNBA', statNames: ['PTS','REB','AST','STL','BLK'] },
                'football/nfl':    { standingsPath: 'football/nfl',    label: 'NFL',  statNames: ['YDS','TD','INT','SACK','FUM'] },
                'baseball/mlb':    { standingsPath: 'baseball/mlb',    label: 'MLB',  statNames: ['HR','RBI','AVG','ERA','SO'] },
                'hockey/nhl':      { standingsPath: 'hockey/nhl',      label: 'NHL',  statNames: ['G','A','PTS','+/-','SV%'] },
            };

            const deporteStats = DEPORTES_CON_STATS[ligaActual.slug];
            if (deporteStats) {
                // Tab activa (por defecto "partidos")
                const tabActiva = window._osTab ?? 'partidos';

                const tabsHtml = `
                    <div style="display:flex; gap:4px; margin-bottom:1.2rem; border-bottom:1px solid var(--border-glass); padding-bottom:8px;">
                        ${['partidos','posiciones','líderes'].map(t => `
                            <button onclick="window._osTab='${t}'; document.getElementById('other-sports-content').innerHTML='<div style=\\'text-align:center;padding:2rem;\\'>Cargando...</div>'; window._loadOSTab();"
                                style="padding:8px 18px; border:none; border-bottom:2px solid ${tabActiva === t ? 'var(--accent-neon)' : 'transparent'};
                                background:${tabActiva === t ? 'rgba(61,111,255,0.1)' : 'transparent'};
                                color:${tabActiva === t ? 'var(--accent-neon)' : 'var(--text-muted)'};
                                cursor:pointer; font-family:var(--font-heading); font-weight:700; font-size:0.82rem;
                                border-radius:6px 6px 0 0; transition:all 0.2s;">
                                ${t === 'partidos' ? '📅 Partidos' : t === 'posiciones' ? '🏆 Posiciones' : '⭐ Líderes'}
                            </button>`).join('')}
                    </div>`;

                // Función global para cargar tab sin re-renderizar toda la vista
                window._loadOSTab = async () => {
                    const c = document.getElementById('other-sports-content');
                    if (!c) return;
                    const tab = window._osTab ?? 'partidos';

                    if (tab === 'partidos') {
                        const url = `https://site.api.espn.com/apis/site/v2/sports/${ligaActual.slug}/scoreboard?dates=${fecha}`;
                        const res = await fetch(`${CF_WORKER}/?url=${encodeURIComponent(url)}`);
                        const data = res.ok ? await res.json() : {};
                        const eventos = data.events ?? [];

                        c.innerHTML = tabsHtml + (eventos.length === 0
                            ? `<div class="glass-panel" style="padding:2rem; text-align:center;">
                                <p style="font-size:2rem; margin-bottom:0.5rem;">${deporteActual.emoji}</p>
                                <p style="color:var(--text-muted);">Sin partidos hoy para ${deporteStats.label}.</p>
                               </div>`
                            : eventos.sort((a,b) => {
                                const est = ev => ev.competitions?.[0]?.status?.type?.state;
                                const p = s => s==='in'?0:s==='post'?1:2;
                                return p(est(a)) - p(est(b));
                            }).map(ev => {
                                const comp = ev.competitions?.[0];
                                const home = comp?.competitors?.find(c => c.homeAway === 'home');
                                const away = comp?.competitors?.find(c => c.homeAway === 'away');
                                const estado = comp?.status?.type?.state ?? 'pre';
                                const esLive = estado === 'in';
                                const esPost = estado === 'post';
                                const desc = comp?.status?.type?.shortDetail ?? '';
                                const clock = comp?.status?.displayClock ?? '';
                                const fechaEv = new Date(ev.date);
                                const horaAR = fechaEv.toLocaleTimeString('es-AR', {timeZone:'America/Argentina/Buenos_Aires', hour:'2-digit', minute:'2-digit'});
                                const homeLogo = home?.team?.logo ?? '';
                                const awayLogo = away?.team?.logo ?? '';
                                const homeNombre = home?.team?.displayName ?? '?';
                                const awayNombre = away?.team?.displayName ?? '?';
                                const homeScore = home?.score ?? '-';
                                const awayScore = away?.score ?? '-';
                                const logoHtml = (logo, nombre) => logo
                                    ? `<img src="${logo}" width="28" height="28" style="object-fit:contain;" onerror="this.style.display='none'">`
                                    : `<span style="font-size:1.1rem; font-weight:800;">${nombre.charAt(0)}</span>`;
                                return `
                                    <div class="glass-panel" style="padding:1.2rem; margin-bottom:1rem; cursor:pointer;"
                                        onclick="window.location.hash='#/partido?id=${ev.id}&liga=${ligaActual.slug}'">
                                        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.8rem;">
                                            <span style="font-size:0.7rem; color:var(--text-muted); text-transform:uppercase; letter-spacing:1px;">${deporteStats.label} · ${desc}</span>
                                            ${esLive
                                                ? `<span style="background:#ff4757; color:#fff; padding:3px 10px; border-radius:12px; font-size:0.7rem; font-weight:800; animation:pulse 1s infinite;">● EN VIVO ${clock}</span>`
                                                : esPost
                                                    ? `<span style="background:rgba(255,255,255,0.08); color:var(--text-muted); padding:3px 10px; border-radius:12px; font-size:0.7rem;">FINALIZADO</span>`
                                                    : `<span style="color:var(--accent-neon); font-family:var(--font-heading); font-weight:700; font-size:0.85rem;">${horaAR} ARG</span>`}
                                        </div>
                                        <div style="display:grid; grid-template-columns:1fr auto 1fr; align-items:center; gap:0.8rem;">
                                            <div style="display:flex; align-items:center; gap:8px;">
                                                ${logoHtml(homeLogo, homeNombre)}
                                                <span style="font-weight:600; font-size:0.9rem;">${homeNombre}</span>
                                            </div>
                                            <div style="font-family:var(--font-heading); font-size:${(esPost||esLive)?'1.8rem':'1.1rem'}; font-weight:900;
                                                color:${(esPost||esLive)?'var(--text-main)':'var(--text-muted)'}; text-align:center; min-width:60px;">
                                                ${(esPost||esLive) ? `${homeScore} - ${awayScore}` : 'vs'}
                                            </div>
                                            <div style="display:flex; align-items:center; gap:8px; justify-content:flex-end;">
                                                <span style="font-weight:600; font-size:0.9rem;">${awayNombre}</span>
                                                ${logoHtml(awayLogo, awayNombre)}
                                            </div>
                                        </div>
                                    </div>`;
                            }).join(''));

                    } else if (tab === 'posiciones') {
                        const url = `https://site.api.espn.com/apis/v2/sports/${deporteStats.standingsPath}/standings`;
                        const res = await fetch(`${CF_WORKER}/?url=${encodeURIComponent(url)}`);
                        const data = res.ok ? await res.json() : {};
                        const children = data.children ?? [];

                        let html = tabsHtml;
                        children.forEach(conf => {
                            const confName = conf.name ?? conf.abbreviation ?? 'Conference';
                            const standings = conf.standings?.entries ?? [];
                            standings.sort((a,b) => {
                                const aW = a.stats?.find(s => s.name === 'wins')?.value ?? 0;
                                const bW = b.stats?.find(s => s.name === 'wins')?.value ?? 0;
                                return bW - aW;
                            });

                            html += `
                                <div class="glass-panel" style="padding:1rem; margin-bottom:1.2rem;">
                                    <h4 style="font-family:var(--font-heading); font-size:0.8rem; color:var(--accent-neon); letter-spacing:1.5px;
                                        text-transform:uppercase; margin-bottom:0.8rem; padding-bottom:6px; border-bottom:1px solid var(--border-glass);">
                                        ${confName}
                                    </h4>
                                    <div style="display:grid; grid-template-columns:30px 1fr repeat(4, 45px); gap:4px 8px; font-size:0.78rem; align-items:center;">
                                        <span style="color:var(--text-muted); font-weight:700;">#</span>
                                        <span style="color:var(--text-muted); font-weight:700;">Equipo</span>
                                        <span style="color:var(--text-muted); font-weight:700; text-align:center;">W</span>
                                        <span style="color:var(--text-muted); font-weight:700; text-align:center;">L</span>
                                        <span style="color:var(--text-muted); font-weight:700; text-align:center;">%</span>
                                        <span style="color:var(--text-muted); font-weight:700; text-align:center;">GB</span>
                                        ${standings.map((entry, i) => {
                                            const team = entry.team ?? {};
                                            const logo = team.logos?.[0]?.href ?? '';
                                            const wins = entry.stats?.find(s => s.name === 'wins')?.displayValue ?? '-';
                                            const losses = entry.stats?.find(s => s.name === 'losses')?.displayValue ?? '-';
                                            const pct = entry.stats?.find(s => s.name === 'winPercent')?.displayValue ?? entry.stats?.find(s => s.name === 'winpercent')?.displayValue ?? '-';
                                            const gb = entry.stats?.find(s => s.name === 'gamesBehind')?.displayValue ?? '-';
                                            const posColor = i < 6 ? '#2FD98B' : i < 10 ? '#F5C33B' : 'var(--text-muted)';
                                            return `
                                                <span style="font-weight:800; color:${posColor};">${i+1}</span>
                                                <div style="display:flex; align-items:center; gap:6px; overflow:hidden;">
                                                    ${logo ? `<img src="${logo}" width="20" height="20" style="flex-shrink:0; object-fit:contain;">` : ''}
                                                    <span style="font-weight:600; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${team.displayName ?? team.name ?? '?'}</span>
                                                </div>
                                                <span style="text-align:center; font-weight:700;">${wins}</span>
                                                <span style="text-align:center;">${losses}</span>
                                                <span style="text-align:center; color:var(--text-muted);">${pct}</span>
                                                <span style="text-align:center; color:var(--text-muted);">${gb}</span>`;
                                        }).join('')}
                                    </div>
                                </div>`;
                        });
                        c.innerHTML = html;

                    } else if (tab === 'líderes') {
                        // Leaders: usamos el scoreboard que trae leaders globales
                        const url = `https://site.api.espn.com/apis/site/v2/sports/${ligaActual.slug}/scoreboard`;
                        const res = await fetch(`${CF_WORKER}/?url=${encodeURIComponent(url)}`);
                        const data = res.ok ? await res.json() : {};
                        const leaders = data.leagues?.[0]?.leaders ?? data.leaders ?? [];

                        let html = tabsHtml;
                        if (!leaders.length) {
                            html += `<div class="glass-panel" style="padding:2rem; text-align:center;">
                                <p style="color:var(--text-muted);">Líderes no disponibles en este momento.</p>
                            </div>`;
                        } else {
                            leaders.forEach(cat => {
                                const catName = cat.displayName ?? cat.name ?? 'Stat';
                                const entries = cat.leaders ?? [];
                                html += `
                                    <div class="glass-panel" style="padding:1rem; margin-bottom:1rem;">
                                        <h4 style="font-family:var(--font-heading); font-size:0.8rem; color:#F5C33B; letter-spacing:1.5px;
                                            text-transform:uppercase; margin-bottom:0.8rem; padding-bottom:6px; border-bottom:1px solid var(--border-glass);">
                                            ⭐ ${catName}
                                        </h4>
                                        ${entries.slice(0, 10).map((l, i) => {
                                            const athlete = l.athlete ?? {};
                                            const headshot = athlete.headshot ?? '';
                                            const teamName = l.team?.displayName ?? '';
                                            const posColor = i === 0 ? '#ffd700' : i === 1 ? '#c0c0c0' : i === 2 ? '#cd7f32' : 'var(--text-muted)';
                                            return `
                                                <div style="display:grid; grid-template-columns:26px 36px 1fr auto; align-items:center; gap:8px;
                                                    padding:8px 4px; ${i < entries.length - 1 ? 'border-bottom:1px solid rgba(255,255,255,0.04);' : ''}">
                                                    <span style="font-weight:900; font-size:0.85rem; color:${posColor};">${i+1}</span>
                                                    ${headshot
                                                        ? `<img src="${headshot}" width="32" height="32" style="border-radius:50%; object-fit:cover; background:rgba(255,255,255,0.05);">`
                                                        : `<div style="width:32px; height:32px; border-radius:50%; background:rgba(255,255,255,0.08); display:flex; align-items:center; justify-content:center; font-weight:800; font-size:0.7rem;">${(athlete.displayName ?? '?').charAt(0)}</div>`}
                                                    <div style="overflow:hidden;">
                                                        <div style="font-weight:700; font-size:0.85rem; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${athlete.displayName ?? '?'}</div>
                                                        <div style="font-size:0.68rem; color:var(--text-muted);">${teamName}</div>
                                                    </div>
                                                    <div style="font-family:var(--font-heading); font-weight:900; font-size:1.1rem; color:${posColor};">
                                                        ${l.displayValue ?? l.value ?? '-'}
                                                    </div>
                                                </div>`;
                                        }).join('')}
                                    </div>`;
                            });
                        }
                        c.innerHTML = html;
                    }
                };

                container.innerHTML = tabsHtml + '<div style="text-align:center;padding:2rem;"><div style="width:36px;height:36px;border:3px solid var(--accent-neon);border-right-color:transparent;border-radius:50%;animation:spin 1s linear infinite;margin:0 auto;"></div></div>';
                await window._loadOSTab();
                return;
            }
            // ── FIN deportes con stats ────────────────────────────────────────

            // ── MMA: cartelera completa ───────────────────────────────────────
            // Ojo: en MMA un "evento" es la velada entera y cada `competition` es
            // UNA pelea (una UFC Fight Night trae ~13). Además los competidores no
            // tienen homeAway, así que el render genérico los daba por indefinidos.
            if ((ligaActual.slug ?? '').startsWith('mma/')) {
                const rMma = await fetch(`${CF_WORKER}/?url=${encodeURIComponent(`https://site.api.espn.com/apis/site/v2/sports/${ligaActual.slug}/scoreboard`)}`);
                const dMma = rMma.ok ? await rMma.json() : {};
                const veladas = dMma.events ?? [];
                if (!container) return;
                if (!veladas.length) {
                    container.innerHTML = `<div class="glass-panel" style="padding:2rem;text-align:center;"><p style="font-size:2rem;margin-bottom:.5rem;">${deporteActual.emoji}</p><p style="color:var(--text-muted);">Sin veladas programadas.</p></div>`;
                    return;
                }

                container.innerHTML = veladas.map(velada => {
                    const peleas = velada.competitions ?? [];
                    const fechaV = new Date(velada.date);
                    const cabecera = `
                        <div style="margin-bottom:1rem;">
                            <h3 style="font-family:var(--font-heading); font-size:1.05rem; font-weight:900; color:var(--accent-neon);">${velada.name ?? 'Velada'}</h3>
                            <p style="font-size:.78rem; color:var(--text-muted);">
                                ${_etiquetaDia(fechaV)} · ${peleas.length} pelea${peleas.length === 1 ? '' : 's'}
                            </p>
                        </div>`;

                    const filas = peleas.map(p => {
                        const cs     = p.competitors ?? [];
                        const a      = cs[0] ?? {};
                        const b      = cs[1] ?? {};
                        const estado = p.status?.type?.state ?? 'pre';
                        const esPost = estado === 'post';
                        const esLive = estado === 'in';
                        const nombreDe = (c) => c?.athlete?.displayName ?? c?.athlete?.shortName ?? '?';
                        const recordDe = (c) => (c?.records ?? [])[0]?.summary ?? '';
                        const ganoA  = a?.winner === true;
                        const ganoB  = b?.winner === true;
                        const detalle = p.status?.type?.shortDetail ?? '';
                        const colorDe = (gano) => esPost ? (gano ? 'var(--accent-neon)' : 'var(--text-muted)') : 'var(--text-main)';

                        const lado = (c, gano, alineado) => `
                            <div style="text-align:${alineado}; min-width:0;">
                                <div style="font-weight:700; font-size:.88rem; color:${colorDe(gano)}; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
                                    ${gano ? '🏆 ' : ''}${nombreDe(c)}
                                </div>
                                ${recordDe(c) ? `<div style="font-size:.7rem; color:var(--text-muted);">${recordDe(c)}</div>` : ''}
                            </div>`;

                        return `
                            <div style="display:grid; grid-template-columns:1fr auto 1fr; align-items:center; gap:10px;
                                padding:11px 12px; border-radius:10px; margin-bottom:6px;
                                background:${esLive ? 'rgba(255,71,87,.07)' : 'rgba(255,255,255,.03)'};
                                border:1px solid ${esLive ? 'rgba(255,71,87,.3)' : 'var(--border-glass)'};">
                                ${lado(a, ganoA, 'right')}
                                <div style="text-align:center; flex-shrink:0;">
                                    <div style="font-size:.7rem; font-weight:800; color:var(--text-muted);">VS</div>
                                    ${p.type?.text ? `<div style="font-size:.62rem; color:var(--text-muted);">${p.type.text}</div>` : ''}
                                    ${esLive ? '<div style="font-size:.6rem; color:#ff4757; font-weight:800;">● EN VIVO</div>'
                                      : esPost ? `<div style="font-size:.6rem; color:var(--text-muted);">${detalle || 'FIN'}</div>` : ''}
                                </div>
                                ${lado(b, ganoB, 'left')}
                            </div>`;
                    }).join('');

                    return `<div class="glass-panel" style="padding:1.2rem; margin-bottom:1.2rem;">${cabecera}${filas}</div>`;
                }).join('');
                return;
            }

            // ── GOLF: leaderboard del torneo ──────────────────────────────────
            // El field son ~144 jugadores sin homeAway; lo que corresponde es una
            // tabla de posiciones, no una tarjeta de local vs visitante.
            if ((ligaActual.slug ?? '').startsWith('golf/')) {
                const rG = await fetch(`${CF_WORKER}/?url=${encodeURIComponent(`https://site.api.espn.com/apis/site/v2/sports/${ligaActual.slug}/scoreboard`)}`);
                const dG = rG.ok ? await rG.json() : {};
                const torneos = dG.events ?? [];
                if (!container) return;
                if (!torneos.length) {
                    container.innerHTML = `<div class="glass-panel" style="padding:2rem;text-align:center;"><p style="font-size:2rem;margin-bottom:.5rem;">${deporteActual.emoji}</p><p style="color:var(--text-muted);">Sin torneos en curso.</p></div>`;
                    return;
                }

                container.innerHTML = torneos.map(t => {
                    const comp   = (t.competitions ?? [])[0] ?? {};
                    const jug    = (comp.competitors ?? []).slice(0, 15);
                    const estado = t.status?.type?.state ?? comp.status?.type?.state ?? 'pre';
                    const detalle = t.status?.type?.detail ?? comp.status?.type?.detail ?? '';
                    const arrancó = estado !== 'pre';

                    const filas = jug.map((c, i) => {
                        const pos    = c.status?.position?.displayName ?? String(c.order ?? i + 1);
                        const nombre = c.athlete?.displayName ?? '?';
                        const bandera = c.athlete?.flag?.href
                            ? `<img src="${c.athlete.flag.href}" width="16" height="11" style="object-fit:cover;border-radius:2px;vertical-align:middle;margin-right:5px;" onerror="this.style.display='none'">`
                            : '';
                        const score  = c.score ?? (c.statistics ?? []).find(s => /scoreToPar|toPar/i.test(s.name ?? ''))?.displayValue ?? '—';
                        const thru   = c.status?.thru ?? '';
                        const medalla = i === 0 ? '#ffd700' : i === 1 ? '#c0c0c0' : i === 2 ? '#cd7f32' : 'var(--text-muted)';
                        return `
                            <div style="display:grid; grid-template-columns:34px 1fr auto auto; align-items:center; gap:10px;
                                padding:9px 6px; border-bottom:1px solid var(--border-glass);">
                                <span style="font-weight:800; font-size:.82rem; color:${medalla}; text-align:center;">${pos}</span>
                                <span style="font-size:.86rem; font-weight:600; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${bandera}${nombre}</span>
                                <span style="font-family:var(--font-heading); font-weight:900; font-size:.9rem; color:${String(score).startsWith('-') ? 'var(--accent-neon)' : 'var(--text-main)'};">${score}</span>
                                <span style="font-size:.68rem; color:var(--text-muted); min-width:34px; text-align:right;">${arrancó && thru ? thru : ''}</span>
                            </div>`;
                    }).join('');

                    return `
                        <div class="glass-panel" style="padding:1.2rem; margin-bottom:1.2rem;">
                            <div style="margin-bottom:.9rem;">
                                <h3 style="font-family:var(--font-heading); font-size:1.05rem; font-weight:900; color:var(--accent-neon);">${t.name ?? 'Torneo'}</h3>
                                <p style="font-size:.78rem; color:var(--text-muted);">
                                    ${detalle || _etiquetaDia(new Date(t.date))}${comp.competitors?.length ? ` · ${comp.competitors.length} jugadores` : ''}
                                </p>
                            </div>
                            ${arrancó ? '' : '<p style="font-size:.75rem; color:var(--text-muted); margin-bottom:.6rem;">El torneo todavía no arrancó — este es el field inicial.</p>'}
                            ${filas}
                        </div>`;
                }).join('');
                return;
            }

            const url = `https://site.api.espn.com/apis/site/v2/sports/${ligaActual.slug}/scoreboard?dates=${fecha}`;
            const res = await fetch(`${CF_WORKER}/?url=${encodeURIComponent(url)}`);
            const data = res.ok ? await res.json() : {};
            const eventos = data.events ?? [];

            if (!container) return;

            if (eventos.length === 0) {
                container.innerHTML = `
                    <div class="glass-panel" style="padding:2rem; text-align:center;">
                        <p style="font-size:2rem; margin-bottom:0.5rem;">${deporteActual.emoji}</p>
                        <p style="color:var(--text-muted);">Sin eventos hoy para ${ligaActual.nombre}.</p>
                    </div>`;
                return;
            }

            // Ordenar: en vivo → finalizado → próximo
            eventos.sort((a,b) => {
                const est = ev => ev.competitions?.[0]?.status?.type?.state;
                const p   = s => s==='in' ? 0 : s==='post' ? 1 : 2;
                return p(est(a)) - p(est(b));
            });

            container.innerHTML = eventos.map(ev => {
                const comp   = ev.competitions?.[0];
                const home   = comp?.competitors?.find(c => c.homeAway === 'home');
                const away   = comp?.competitors?.find(c => c.homeAway === 'away');
                const estado = comp?.status?.type?.state ?? 'pre';
                const esLive = estado === 'in';
                const esPost = estado === 'post';
                const desc   = comp?.status?.type?.shortDetail ?? '';
                const clock  = comp?.status?.displayClock ?? '';

                const fechaEv = new Date(ev.date);
                const horaAR  = fechaEv.toLocaleTimeString('es-AR', {
                    timeZone:'America/Argentina/Buenos_Aires',
                    hour:'2-digit', minute:'2-digit'
                });

                const homeLogo = home?.team?.logo ?? '';
                const awayLogo = away?.team?.logo ?? '';
                const homeNombre = home?.team?.displayName ?? home?.athlete?.displayName ?? '?';
                const awayNombre = away?.team?.displayName ?? away?.athlete?.displayName ?? '?';
                const homeScore  = home?.score ?? '-';
                const awayScore  = away?.score ?? '-';

                const logoHtml = (logo, nombre) => logo
                    ? `<img src="${logo}" width="28" height="28" style="object-fit:contain;" onerror="this.style.display='none'">`
                    : `<span style="font-size:1.1rem; font-weight:800;">${nombre.charAt(0)}</span>`;

                return `
                    <div class="glass-panel" style="padding:1.2rem; margin-bottom:1rem;">
                        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.8rem;">
                            <span style="font-size:0.7rem; color:var(--text-muted); text-transform:uppercase; letter-spacing:1px;">${ligaActual.nombre} · ${desc}</span>
                            ${esLive
                                ? `<span style="background:#ff4757; color:#fff; padding:3px 10px; border-radius:12px; font-size:0.7rem; font-weight:800; animation:pulse 1s infinite;">● EN VIVO ${clock}</span>`
                                : esPost
                                    ? `<span style="background:rgba(255,255,255,0.08); color:var(--text-muted); padding:3px 10px; border-radius:12px; font-size:0.7rem;">FINALIZADO</span>`
                                    : `<span style="color:var(--accent-neon); font-family:var(--font-heading); font-weight:700; font-size:0.85rem;">${horaAR} ARG</span>`}
                        </div>
                        <div style="display:grid; grid-template-columns:1fr auto 1fr; align-items:center; gap:0.8rem;">
                            <div style="display:flex; align-items:center; gap:8px;">
                                ${logoHtml(homeLogo, homeNombre)}
                                <span style="font-weight:600; font-size:0.9rem;">${homeNombre}</span>
                            </div>
                            <div style="font-family:var(--font-heading); font-size:${(esPost||esLive)?'1.8rem':'1.1rem'}; font-weight:900;
                                color:${(esPost||esLive)?'var(--text-main)':'var(--text-muted)'}; text-align:center; min-width:60px;">
                                ${(esPost||esLive) ? `${homeScore} - ${awayScore}` : 'vs'}
                            </div>
                            <div style="display:flex; align-items:center; gap:8px; justify-content:flex-end;">
                                <span style="font-weight:600; font-size:0.9rem;">${awayNombre}</span>
                                ${logoHtml(awayLogo, awayNombre)}
                            </div>
                        </div>
                    </div>`;
            }).join('');

        } catch(err) {
            console.error('[OtherSports]', err);
            const container = document.getElementById('other-sports-content');
            if (container) container.innerHTML = `
                <div class="glass-panel" style="padding:2rem; text-align:center;">
                    <p style="color:#ff4757;">Error cargando datos.</p>
                </div>`;
        }
    };

    // ── VISTA DE PARTIDO ─────────────────────────────────────────────────────
    // ── Análisis IA pre-partido (feature de Platea, "próximamente") ──────────
    // Llama al Worker (/ia/analisis-previa), que hace la llamada al modelo.
    // Mientras el endpoint no exista todavía, falla con gracia a "muy pronto".
    const _formatearIA = (texto) => String(texto)
        .replace(/[&<>]/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;' }[c]))
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        .split(/\n{2,}/).map(p => `<p style="margin-bottom:0.8rem; line-height:1.6;">${p.replace(/\n/g, '<br>')}</p>`).join('');

    window._cargarAnalisisIA = async (eventId, liga) => {
        const cont = document.getElementById('ia-previa-cont');
        if (!cont) return;
        cont.innerHTML = `
            <div style="display:flex; align-items:center; justify-content:center; gap:10px; padding:1rem 0;">
                <div style="width:22px; height:22px; border:3px solid var(--accent-neon); border-right-color:transparent; border-radius:50%; animation:spin 1s linear infinite;"></div>
                <span style="color:var(--muted); font-size:0.85rem;">Analizando el partido con IA...</span>
            </div>`;
        try {
            const res = await fetch('https://whistle.solgoyhe.workers.dev/ia/analisis-previa', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ event: eventId, liga }),
            });
            if (!res.ok) throw new Error('HTTP ' + res.status);
            const data = await res.json();
            if (!data.analisis) throw new Error('sin análisis');
            cont.innerHTML = `<div style="text-align:left; font-size:0.86rem; color:var(--text-sub);">${_formatearIA(data.analisis)}</div>`;
        } catch (e) {
            cont.innerHTML = `
                <div style="text-align:center; padding:1rem 0;">
                    <div style="font-size:1.6rem; margin-bottom:0.5rem;">✨</div>
                    <p style="color:var(--muted); font-size:0.84rem;">El análisis por IA todavía no está disponible.<br>Muy pronto, con el plan Platea.</p>
                </div>`;
        }
    };

    const renderPartido = async (eventId, ligaId) => {
        const CF_WORKER  = 'https://whistle.solgoyhe.workers.dev';
        const espnLeague = ESPN.getSlug(ligaId) ?? ligaId ?? 'fifa.world';
        const esPro      = _esPro();

        appContainer.innerHTML = `
            ${renderNavbar('#/h2h')}
            <main class="page-container fade-in" style="max-width:700px; margin:0 auto;">
                <a href="javascript:history.back()" style="color:var(--text-muted); text-decoration:none; display:inline-block; margin-bottom:1.5rem; font-weight:600;">← Volver</a>
                <div style="text-align:center; padding:3rem;">
                    <div style="width:40px; height:40px; border:3px solid var(--accent-neon); border-right-color:transparent; border-radius:50%; animation:spin 1s linear infinite; margin:0 auto;"></div>
                    <p style="color:var(--accent-neon); margin-top:1rem; font-size:0.85rem; font-family:var(--font-heading); text-transform:uppercase; letter-spacing:1px;">Cargando partido...</p>
                </div>
            </main>`;

        try {
            const [sumRes, scRes] = await Promise.all([
                fetch(`${CF_WORKER}/?url=${encodeURIComponent(`https://site.api.espn.com/apis/site/v2/sports/soccer/${espnLeague}/summary?event=${eventId}`)}`),
                fetch(`${CF_WORKER}/?url=${encodeURIComponent(`https://site.api.espn.com/apis/site/v2/sports/soccer/${espnLeague}/scoreboard`)}`)
            ]);

            const summary = sumRes.ok ? await sumRes.json() : {};
            const comp    = summary.header?.competitions?.[0] ?? summary.gameInfo ?? {};
            const compets = comp.competitors ?? [];
            const home    = compets.find(c => c.homeAway === 'home') ?? compets[0] ?? {};
            const away    = compets.find(c => c.homeAway === 'away') ?? compets[1] ?? {};

            const estado   = comp.status?.type?.state ?? 'pre';
            const esLive   = estado === 'in';
            const esPost   = estado === 'post';
            const esPre    = estado === 'pre';
            const clock    = comp.status?.displayClock ?? '';
            const periodo  = comp.status?.period ?? '';
            const shortDet = comp.status?.type?.shortDetail ?? '';

            // Horas que faltan para el arranque (para saber si vale la pena auto-refrescar
            // en busca de la alineación, que ESPN suele publicar ~1h antes)
            const fechaPartido    = new Date(comp.date ?? summary.header?.competitions?.[0]?.date ?? NaN);
            const horasHastaInicio = isNaN(fechaPartido.getTime()) ? 99 : (fechaPartido - new Date()) / 3600000;

            // Árbitro y estadio (ESPN los da en gameInfo; el árbitro es solo el nombre)
            const arbitro = (summary.gameInfo?.officials ?? []).find(o => /referee/i.test(o.position?.name ?? o.position?.displayName ?? ''))
                         ?? summary.gameInfo?.officials?.[0]
                         ?? null;
            const estadioNombre = summary.gameInfo?.venue?.fullName ?? '';
            const estadioCiudad = summary.gameInfo?.venue?.address?.city ?? '';

            const homeName  = home.team?.displayName ?? '?';
            const awayName  = away.team?.displayName ?? '?';
            const homeLogo  = home.team?.logo ?? '';
            const awayLogo  = away.team?.logo ?? '';
            const homeScore = home.score ?? '-';
            const awayScore = away.score ?? '-';
            const homeWin   = esPost && parseInt(homeScore) > parseInt(awayScore);
            const awayWin   = esPost && parseInt(awayScore) > parseInt(homeScore);

            // Detectar alargue y penales
            const esPenales = /pen/i.test(shortDet) || /shoot/i.test(shortDet);
            const esAlargue = /aet/i.test(shortDet) || /extra/i.test(shortDet) || (esPost && periodo > 2);

            // Score de penales desde linescores (ESPN: el último período extra es penales)
            const homeLinescores = home.linescores ?? [];
            const awayLinescores = away.linescores ?? [];
            let homePen = '', awayPen = '';
            if (esPenales && homeLinescores.length > 0) {
                // El último linescore es el de penales
                homePen = homeLinescores[homeLinescores.length - 1]?.displayValue ?? '';
                awayPen = awayLinescores[awayLinescores.length - 1]?.displayValue ?? '';
            }
            const penScore = (homePen && awayPen) ? '(' + homePen + '-' + awayPen + ' pen)' : '';
            const notaPartido = esPost ? (esPenales ? '⚽ Definido por penales ' + penScore : esAlargue ? '⏱ Definido en alargue' : '') : '';

            // Stats del partido desde boxscore
            const boxTeamHome = (summary.boxscore?.teams ?? []).find(t => t.team?.id === home.team?.id);
            const boxTeamAway = (summary.boxscore?.teams ?? []).find(t => t.team?.id === away.team?.id);
            const getStat = (box, name) => parseFloat(box?.statistics?.find(s => s.name === name)?.displayValue ?? '0') || 0;

            // Goleadores y eventos clave
            const keyEvents = summary.keyEvents ?? [];
            const goleadoresHome = [], goleadoresAway = [];
            keyEvents.filter(e => e.scoringPlay).forEach(e => {
                const nombre  = e.participants?.[0]?.athlete?.displayName ?? '';
                const minuto  = e.clock?.displayValue ?? '';
                const ownGoal = e.ownGoal ?? false;
                const esHome  = e.team?.id === home.team?.id;
                const item    = { nombre, minuto, ownGoal };
                if (esHome) goleadoresHome.push(item);
                else goleadoresAway.push(item);
            });

            // Minuto a minuto (plays)
            const plays = (summary.plays ?? []).slice(-20).reverse();

            // Rosters para pizarras
            const rosterHome = (summary.rosters ?? []).find(r => r.team?.id === home.team?.id);
            const rosterAway = (summary.rosters ?? []).find(r => r.team?.id === away.team?.id);
            const _titularesDe = (roster) => (roster?.roster ?? [])
                .filter(j => j.starter && j.formationPlace >= 1 && j.formationPlace <= 11);
            const hayTitulares = _titularesDe(rosterHome).length > 0 || _titularesDe(rosterAway).length > 0;

            // Helper stat bar
            const _statBar = (valA, valB, label) => {
                const total = (valA + valB) || 1;
                const pctA  = Math.round((valA/total)*100);
                return `
                    <div style="margin-bottom:1rem;">
                        <div style="display:flex; justify-content:space-between; margin-bottom:4px;">
                            <span style="font-weight:700;">${valA}</span>
                            <span style="font-size:0.7rem; color:var(--text-muted); text-transform:uppercase; letter-spacing:1px;">${label}</span>
                            <span style="font-weight:700; color:var(--accent-neon);">${valB}</span>
                        </div>
                        <div style="display:flex; height:5px; border-radius:3px; overflow:hidden; background:rgba(255,255,255,0.08);">
                            <div style="width:${pctA}%; background:var(--text-main);"></div>
                            <div style="width:${100-pctA}%; background:var(--accent-neon);"></div>
                        </div>
                    </div>`;
            };

            // Helper mini pizarra
            const _miniPizarra = (roster, teamId, colorCamiseta, colorNum) => {
                if (!roster) return '<p style="color:var(--text-muted); text-align:center; font-size:0.8rem; padding:1rem;">Sin datos.</p>';
                const titulares = (roster.roster ?? [])
                    .filter(j => j.starter && j.formationPlace >= 1 && j.formationPlace <= 11)
                    .sort((a,b) => a.formationPlace - b.formationPlace);
                if (titulares.length === 0) return '<p style="color:var(--text-muted); text-align:center; font-size:0.8rem;">🤐 Se la guarda.</p>';
                const W = 280, H = 380;
                const coordsMap = _calcularPosicionesTacticas(titulares, W, H, roster.formation ?? '');
                let tokens = '';
                titulares.forEach(j => {
                    const c = coordsMap.get(j.formationPlace);
                    if (!c) return;
                    const nombre = (j.athlete?.displayName ?? '').split(' ').pop().substring(0,9);
                    const num    = j.jersey ?? '';
                    tokens += `
                        <g transform="translate(${c.x},${c.y})">
                            <circle cx="0" cy="0" r="${c.n >= 5 ? 11 : 13}" fill="${colorCamiseta}" stroke="rgba(255,255,255,0.3)" stroke-width="1"/>
                            <text x="0" y="1" text-anchor="middle" dominant-baseline="middle" font-size="7" font-weight="800" fill="${colorNum}" font-family="system-ui">${num}</text>
                            <rect x="-16" y="15" width="32" height="10" rx="3" fill="rgba(0,0,0,0.6)"/>
                            <text x="0" y="21" text-anchor="middle" dominant-baseline="middle" font-size="5.5" font-weight="600" fill="#fff" font-family="system-ui">${nombre}</text>
                        </g>`;
                });
                return `
                    <svg viewBox="0 0 ${W} ${H}" style="width:100%; display:block; border-radius:8px;">
                        <defs><pattern id="sp-${teamId}" patternUnits="userSpaceOnUse" width="${W}" height="34">
                            <rect width="${W}" height="17" fill="#27792a"/>
                            <rect width="${W}" height="17" y="17" fill="#1e6622"/>
                        </pattern></defs>
                        <rect width="${W}" height="${H}" fill="url(#sp-${teamId})" rx="8"/>
                        <rect x="10" y="8" width="${W-20}" height="${H-16}" fill="none" stroke="rgba(255,255,255,0.35)" stroke-width="1"/>
                        <line x1="10" y1="${H/2}" x2="${W-10}" y2="${H/2}" stroke="rgba(255,255,255,0.35)" stroke-width="1"/>
                        <circle cx="${W/2}" cy="${H/2}" r="${W*0.13}" fill="none" stroke="rgba(255,255,255,0.35)" stroke-width="1"/>
                        <rect x="${W*0.27}" y="8" width="${W*0.46}" height="${H*0.14}" fill="none" stroke="rgba(255,255,255,0.35)" stroke-width="1"/>
                        <rect x="${W*0.27}" y="${H-8-H*0.14}" width="${W*0.46}" height="${H*0.14}" fill="none" stroke="rgba(255,255,255,0.35)" stroke-width="1"/>
                        <g>${tokens}</g>
                    </svg>`;
            };

            // Render principal
            appContainer.innerHTML = `
                ${renderNavbar('#/h2h')}
                <main class="page-container fade-in" style="max-width:700px; margin:0 auto;">
                    <a href="javascript:history.back()" style="color:var(--text-muted); text-decoration:none; display:inline-block; margin-bottom:1.5rem; font-weight:600;">← Volver</a>

                    <!-- CABECERA -->
                    <div class="glass-panel" style="padding:1.5rem; text-align:center; margin-bottom:1.5rem;">
                        ${esLive ? `<div style="background:#ff4757; display:inline-block; padding:3px 14px; border-radius:20px; font-size:0.7rem; font-weight:800; color:#fff; margin-bottom:0.8rem; animation:pulse 1s infinite;">● EN VIVO · ${clock}'</div>` :
                          esPost ? `<div style="background:rgba(255,255,255,0.08); display:inline-block; padding:3px 14px; border-radius:20px; font-size:0.7rem; color:var(--text-muted); margin-bottom:0.8rem;">FINALIZADO</div>` :
                          `<div style="background:rgba(61,111,255,0.12); display:inline-block; padding:3px 14px; border-radius:20px; font-size:0.7rem; font-weight:700; color:var(--accent-neon); margin-bottom:0.8rem;">${shortDet || 'PRÓXIMO'}</div>`}

                        <div style="display:grid; grid-template-columns:1fr auto 1fr; align-items:center; gap:1rem;">
                            <div>
                                ${homeLogo ? `<img src="${homeLogo}" width="56" height="56" style="object-fit:contain; margin-bottom:8px; display:block; margin-left:auto; margin-right:auto;" onerror="this.style.display='none'">` : ''}
                                <div style="font-family:var(--font-heading); font-weight:800; font-size:1rem; ${homeWin ? 'color:var(--accent-neon);' : ''}">${homeName}</div>
                            </div>
                            <div style="text-align:center; min-width:100px;">
                                <div style="font-family:var(--font-display); font-size:${(esPost||esLive)?'3rem':'1.5rem'}; font-weight:700; color:var(--text-main);">
                                    ${(esPost||esLive) ? `${homeScore} - ${awayScore}` : 'vs'}
                                </div>
                                ${notaPartido ? `<div style="margin-top:6px; display:inline-block; padding:3px 10px; border-radius:6px; font-family:var(--font-display); font-size:0.68rem; font-weight:700; background:${esPenales ? 'rgba(245,195,59,0.15)' : 'rgba(61,111,255,0.15)'}; color:${esPenales ? '#F5C33B' : '#3D6FFF'}; letter-spacing:.5px;">${notaPartido}</div>` : ''}
                            </div>
                            <div>
                                ${awayLogo ? `<img src="${awayLogo}" width="56" height="56" style="object-fit:contain; margin-bottom:8px; display:block; margin-left:auto; margin-right:auto;" onerror="this.style.display='none'">` : ''}
                                <div style="font-family:var(--font-heading); font-weight:800; font-size:1rem; ${awayWin ? 'color:var(--accent-neon);' : ''}">${awayName}</div>
                            </div>
                        </div>

                        ${(goleadoresHome.length > 0 || goleadoresAway.length > 0) ? `
                        <div style="display:grid; grid-template-columns:1fr 1fr; gap:0.5rem; margin-top:1rem; font-size:0.82rem; color:var(--text-muted);">
                            <div style="text-align:left;">${goleadoresHome.map(g=>`⚽${g.ownGoal?'(PP)':''} ${g.nombre} <span style="font-size:0.7rem;">${g.minuto}'</span>`).join('<br>')}</div>
                            <div style="text-align:right;">${goleadoresAway.map(g=>`<span style="font-size:0.7rem;">${g.minuto}'</span> ${g.nombre} ${g.ownGoal?'(PP)':''}⚽`).join('<br>')}</div>
                        </div>` : ''}
                    </div>

                    ${esPre ? `
                    <!-- ANÁLISIS IA PRE-PARTIDO (Platea, próximamente) -->
                    <div class="glass-panel" style="padding:1.5rem; margin-bottom:1.5rem;">
                        <h3 class="panel-title" style="text-align:center; color:var(--accent-neon); font-size:0.75rem; letter-spacing:2px; display:flex; align-items:center; justify-content:center; gap:8px;">
                            ✨ ANÁLISIS IA PRE-PARTIDO
                            <span style="font-size:0.55rem; font-weight:800; background:rgba(245,195,59,0.16); color:var(--gold); padding:2px 7px; border-radius:10px; letter-spacing:0.04em;">PRONTO</span>
                        </h3>
                        ${esPro ? `
                            <div id="ia-previa-cont" style="text-align:center;">
                                <p style="color:var(--muted); font-size:0.82rem; margin-bottom:1rem;">Generá un análisis del partido con IA: cómo llega cada equipo, la clave táctica y un pronóstico.</p>
                                <button onclick="window._cargarAnalisisIA('${eventId}','${espnLeague}')"
                                    style="padding:10px 22px; background:var(--grad-main); color:#fff; font-weight:800; font-family:var(--font-display); border:none; border-radius:10px; cursor:pointer; font-size:0.85rem;">
                                    ✨ Generar análisis
                                </button>
                            </div>
                        ` : _paywallInline('pro', 'El análisis IA pre-partido estará disponible en el plan Platea.')}
                    </div>
                    ` : ''}

                    ${(arbitro || estadioNombre) ? `
                    <!-- INFO DEL PARTIDO -->
                    <div class="glass-panel" style="padding:1.2rem 1.5rem; margin-bottom:1.5rem; display:flex; gap:2rem; flex-wrap:wrap;">
                        ${arbitro ? `
                        <div style="display:flex; align-items:center; gap:10px;">
                            <span style="font-size:1.1rem;">🧑‍⚖️</span>
                            <div>
                                <div style="font-size:0.62rem; text-transform:uppercase; letter-spacing:0.08em; color:var(--muted);">Árbitro</div>
                                <div style="font-size:0.85rem; font-weight:600; color:var(--text-main);">${arbitro.displayName ?? arbitro.fullName ?? '—'}</div>
                            </div>
                        </div>` : ''}
                        ${estadioNombre ? `
                        <div style="display:flex; align-items:center; gap:10px;">
                            <span style="font-size:1.1rem;">🏟️</span>
                            <div>
                                <div style="font-size:0.62rem; text-transform:uppercase; letter-spacing:0.08em; color:var(--muted);">Estadio</div>
                                <div style="font-size:0.85rem; font-weight:600; color:var(--text-main);">${estadioNombre}${estadioCiudad ? ` · ${estadioCiudad}` : ''}</div>
                            </div>
                        </div>` : ''}
                    </div>` : ''}

                    ${(boxTeamHome || boxTeamAway) ? `
                    <!-- STATS -->
                    <div class="glass-panel" style="padding:1.5rem; margin-bottom:1.5rem;">
                        <h3 class="panel-title" style="text-align:center; color:var(--accent-neon); font-size:0.75rem; letter-spacing:2px;">ESTADÍSTICAS</h3>
                        ${_statBar(getStat(boxTeamHome,'possessionPct'), getStat(boxTeamAway,'possessionPct'), 'POSESIÓN %')}
                        ${_statBar(getStat(boxTeamHome,'totalShots'), getStat(boxTeamAway,'totalShots'), 'TIROS TOTALES')}
                        ${_statBar(getStat(boxTeamHome,'shotsOnTarget'), getStat(boxTeamAway,'shotsOnTarget'), 'TIROS A PUERTA')}
                        ${_statBar(getStat(boxTeamHome,'wonCorners'), getStat(boxTeamAway,'wonCorners'), 'CORNERS')}
                        ${_statBar(getStat(boxTeamHome,'foulsCommitted'), getStat(boxTeamAway,'foulsCommitted'), 'FALTAS')}
                        ${_statBar(getStat(boxTeamHome,'yellowCards'), getStat(boxTeamAway,'yellowCards'), 'AMARILLAS')}
                    </div>` : ''}

                    ${(hayTitulares || !esPost) ? `
                    <!-- ALINEACIONES -->
                    <div class="glass-panel" style="padding:1.5rem; margin-bottom:1.5rem;">
                        <h3 class="panel-title" style="text-align:center; color:var(--accent-neon); font-size:0.75rem; letter-spacing:2px; margin-bottom:1rem;">ALINEACIONES</h3>
                        ${hayTitulares ? `
                        <div style="display:grid; grid-template-columns:1fr 1fr; gap:1rem;">
                            <div>
                                <p style="text-align:center; font-size:0.75rem; font-weight:700; color:var(--text-muted); margin-bottom:6px;">
                                    ${homeName} <span style="opacity:0.6;">${rosterHome?.formation ?? ''}</span>
                                </p>
                                ${_miniPizarra(rosterHome, home.team?.id, '#e8e8f0', '#1a1a2e')}
                            </div>
                            <div>
                                <p style="text-align:center; font-size:0.75rem; font-weight:700; color:var(--text-muted); margin-bottom:6px;">
                                    ${awayName} <span style="opacity:0.6;">${rosterAway?.formation ?? ''}</span>
                                </p>
                                ${_miniPizarra(rosterAway, away.team?.id, '#cc2222', '#ffffff')}
                            </div>
                        </div>` : `
                        <p style="text-align:center; color:var(--text-muted); font-size:0.82rem; padding:1rem 0;">
                            🤐 El técnico se la guarda.<br>
                            <span style="font-size:0.75rem; opacity:0.75;">El 11 sale ~1 hora antes del partido.</span>
                        </p>`}
                    </div>` : ''}

                    ${plays.length > 0 ? `
                    <!-- MINUTO A MINUTO -->
                    <div class="glass-panel" style="padding:1.5rem; margin-bottom:4rem;">
                        <h3 class="panel-title" style="text-align:center; color:var(--accent-neon); font-size:0.75rem; letter-spacing:2px; margin-bottom:1rem;">MINUTO A MINUTO</h3>
                        ${plays.map(play => {
                            const minuto  = play.clock?.displayValue ?? '';
                            const texto   = play.text ?? play.type?.text ?? '';
                            const isGoal  = play.scoringPlay ?? false;
                            const isCard  = texto.toLowerCase().includes('yellow') || texto.toLowerCase().includes('red') || texto.toLowerCase().includes('tarjet');
                            return `
                                <div style="display:flex; gap:10px; padding:8px 0; border-bottom:1px solid rgba(255,255,255,0.04); align-items:flex-start;">
                                    <span style="font-family:var(--font-heading); font-size:0.75rem; font-weight:800; color:var(--text-muted); min-width:30px; flex-shrink:0;">${minuto}'</span>
                                    <span style="font-size:0.75rem; margin-right:4px; flex-shrink:0;">${isGoal ? '⚽' : isCard ? '🟨' : '•'}</span>
                                    <span style="font-size:0.82rem; color:${isGoal ? 'var(--text-main)' : 'var(--text-muted)'}; font-weight:${isGoal ? '600' : '400'}; line-height:1.4;">${texto}</span>
                                </div>`;
                        }).join('')}
                    </div>` : ''}
                </main>
            ${_closeSidebarWrapper()}
            `;

            // Auto-refresh si está en vivo, o si arranca en las próximas 3hs
            // (para que la alineación aparezca sola apenas ESPN la publique)
            const convieneRefrescar = esLive || (esPre && horasHastaInicio <= 3 && horasHastaInicio > -1);
            if (convieneRefrescar) {
                if (window._partidoRefreshInterval) clearInterval(window._partidoRefreshInterval);
                const hashDeEstePartido = window.location.hash;
                window._partidoRefreshInterval = setInterval(async () => {
                    // Si el usuario navegó a otra pantalla, la URL ya no es la de este
                    // partido — frenamos el timer en vez de repintar encima de lo que ve.
                    if (window.location.hash !== hashDeEstePartido) { clearInterval(window._partidoRefreshInterval); return; }
                    await renderPartido(eventId, ligaId);
                }, 30000);
            }

        } catch(err) {
            console.error('[Partido]', err);
            appContainer.innerHTML = `
                ${renderNavbar('#/h2h')}
                <main class="page-container fade-in" style="text-align:center; padding-top:4rem;">
                    <p style="color:#ff4757;">Error cargando el partido.</p>
                    <a href="javascript:history.back()" style="color:var(--accent-neon); margin-top:1rem; display:inline-block;">← Volver</a>
                </main>`;
        }
    };

    // ── STRIPE CHECKOUT ──────────────────────────────────────────────────────
    const CF_WORKER = 'https://whistle.solgoyhe.workers.dev';

    // Mapeo de keys de UI a variant keys de Lemon Squeezy
    const LS_VARIANT_KEYS = {
        pro_mensual:    'platea_mensual',
        pro_anual:      'platea_anual',
        promax_mensual: 'palco_mensual',
        promax_anual:   'palco_anual',
        platea_mensual: 'platea_mensual',
        platea_anual:   'platea_anual',
        palco_mensual:  'palco_mensual',
        palco_anual:    'palco_anual',
    };

    window._suscribirse = async (priceKey) => {
        const user = window.FirebaseAuth?.getUser();
        if (!user) { abrirAuth('registro'); return; }

        const btn = document.getElementById('btn-' + priceKey);
        if (btn) { btn.textContent = 'Redirigiendo...'; btn.disabled = true; }

        const variantKey = LS_VARIANT_KEYS[priceKey] ?? priceKey;

        try {
            const res = await fetch(`${CF_WORKER}/ls/checkout`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    variantKey,
                    uid:        user.uid,
                    email:      user.email,
                    successUrl: 'https://whistle.com.ar/#/perfil?pago=ok',
                })
            });
            const data = await res.json();
            if (data.url) {
                window.location.href = data.url;
            } else {
                alert('Error al iniciar el pago. Intentá de nuevo.');
                if (btn) { btn.textContent = 'SUSCRIBIRME'; btn.disabled = false; }
            }
        } catch(err) {
            console.error('[LS]', err);
            alert('Error de conexión. Intentá de nuevo.');
            if (btn) { btn.textContent = 'SUSCRIBIRME'; btn.disabled = false; }
        }
    };

    // ── PANEL ADMIN ───────────────────────────────────────────────────────────
    const renderAdmin = async () => {
        const user = window.FirebaseAuth?.getUser();
        if (!user) { window.location.hash = '#/'; return; }

        appContainer.innerHTML = `
            ${renderNavbar('#/admin')}
            <main class="page-container fade-in" style="max-width:800px; margin:0 auto;">
                <h2 class="section-title">🛠️ Panel de Administración</h2>
                <div id="admin-container">
                    <div style="text-align:center; padding:3rem;">
                        <div style="width:36px; height:36px; border:3px solid var(--accent-neon); border-right-color:transparent; border-radius:50%; animation:spin 1s linear infinite; margin:0 auto;"></div>
                        <p style="color:var(--accent-neon); margin-top:1rem;">Cargando stats...</p>
                    </div>
                </div>
            </main>
        ${_closeSidebarWrapper()}
        `;

        try {
            const adminKey = prompt('Clave de administrador:');
            if (!adminKey) { window.location.hash = '#/home'; return; }

            const res  = await fetch(`${CF_WORKER}/admin/stats?adminKey=${encodeURIComponent(adminKey)}`);
            const data = await res.json();

            if (!res.ok) {
                document.getElementById('admin-container').innerHTML = `
                    <div class="glass-panel" style="padding:2rem; text-align:center;">
                        <p style="color:#ff4757; font-size:1.1rem;">⛔ Acceso denegado</p>
                    </div>`;
                return;
            }

            // Buscar usuarios via Worker (con Firebase Admin)
            const usRes  = await fetch(`${CF_WORKER}/admin/usuarios?adminKey=${encodeURIComponent(adminKey)}`);
            const usuarios = usRes.ok ? await usRes.json() : [];

            const planColor = { free: 'var(--text-muted)', pro: 'var(--accent-neon)', promax: '#ffd700' };
            const planEmoji = { free: '⚽', pro: '🔥', promax: '👑' };

            document.getElementById('admin-container').innerHTML = `
                <!-- Stats -->
                <div style="display:grid; grid-template-columns:repeat(auto-fit,minmax(160px,1fr)); gap:1.2rem; margin-bottom:2rem;">
                    ${[
                        { label:'Total usuarios', valor: data.total, color:'var(--text-main)', emoji:'👥' },
                        { label:'Free',           valor: data.free,  color:'var(--text-muted)', emoji:'⚽' },
                        { label:'Pro',            valor: data.pro,   color:'var(--accent-neon)', emoji:'🔥' },
                        { label:'Pro Max',        valor: data.promax,color:'#ffd700', emoji:'👑' },
                    ].map(s => `
                        <div class="glass-panel" style="padding:1.5rem; text-align:center;">
                            <div style="font-size:1.8rem; margin-bottom:0.3rem;">${s.emoji}</div>
                            <div style="font-family:var(--font-heading); font-size:2rem; font-weight:900; color:${s.color};">${s.valor}</div>
                            <div style="font-size:0.75rem; color:var(--text-muted); text-transform:uppercase; letter-spacing:1px;">${s.label}</div>
                        </div>`).join('')}
                </div>

                <!-- Tabla de usuarios -->
                <div class="glass-panel" style="padding:1.5rem;">
                    <h3 class="panel-title" style="margin-bottom:1rem;">👥 Usuarios registrados</h3>
                    ${usuarios.length === 0
                        ? '<p style="color:var(--text-muted); text-align:center;">Sin usuarios aún.</p>'
                        : `<div style="overflow-x:auto;">
                            <table style="width:100%; border-collapse:collapse; font-size:0.85rem;">
                                <thead>
                                    <tr style="color:var(--text-muted); font-size:0.75rem; text-transform:uppercase; border-bottom:1px solid var(--border-glass);">
                                        <th style="padding:10px; text-align:left;">Nombre</th>
                                        <th style="padding:10px; text-align:left;">Email</th>
                                        <th style="padding:10px; text-align:center;">Plan</th>
                                        <th style="padding:10px; text-align:center;">Cambiar plan</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${usuarios.map(u => `
                                        <tr style="border-bottom:1px solid var(--border-glass);">
                                            <td style="padding:10px;">${u.nombre}</td>
                                            <td style="padding:10px; color:var(--text-muted);">${u.email}</td>
                                            <td style="padding:10px; text-align:center;">
                                                <span style="color:${planColor[u.plan] ?? 'var(--text-muted)'}; font-weight:700;">
                                                    ${planEmoji[u.plan] ?? '⚽'} ${u.plan.toUpperCase()}
                                                </span>
                                            </td>
                                            <td style="padding:10px; text-align:center;">
                                                <select onchange="window._cambiarPlan('${u.uid}', this.value, '${adminKey}')"
                                                    style="background:var(--surface-color); color:var(--text-main);
                                                    border:1px solid var(--border-glass); border-radius:6px; padding:4px 8px; font-size:0.8rem; cursor:pointer; color-scheme:dark;">
                                                    <option value="free"   ${u.plan==='free'   ?'selected':''}>Free</option>
                                                    <option value="pro"    ${u.plan==='pro'    ?'selected':''}>Pro</option>
                                                    <option value="promax" ${u.plan==='promax' ?'selected':''}>Pro Max</option>
                                                </select>
                                            </td>
                                        </tr>`).join('')}
                                </tbody>
                            </table>
                        </div>`
                    }
                </div>
            `;

            // Función para cambiar plan manualmente
            window._cambiarPlan = async (uid, nuevoPlan, adminKey) => {
                try {
                    const res = await fetch(`${CF_WORKER}/admin/cambiar-plan`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ adminKey, uid, plan: nuevoPlan })
                    });
                    if (!res.ok) { alert('No autorizado'); return; }
                    alert('Plan actualizado a ' + nuevoPlan);
                } catch(e) {
                    alert('Error actualizando plan');
                }
            };

        } catch(err) {
            console.error('[Admin]', err);
            document.getElementById('admin-container').innerHTML = `
                <div class="glass-panel" style="padding:2rem; text-align:center;">
                    <p style="color:#ff4757;">Error cargando datos.</p>
                </div>`;
        }
    };

    // ── ROUTER ────────────────────────────────────────────────────────────────
    // ── AWARDS ────────────────────────────────────────────────────────────────
    const renderAwards = () => {
        const BALON_ORO = [
            { año: 2025, jugador: 'Ousmane Dembélé', club: 'Paris Saint-Germain', pais: '🇫🇷', foto: '' },
            { año: 2024, jugador: 'Rodri',           club: 'Manchester City',  pais: '🇪🇸', foto: '' },
            { año: 2023, jugador: 'Lionel Messi',    club: 'Inter Miami',      pais: '🇦🇷', foto: '' },
            { año: 2022, jugador: 'Karim Benzema',   club: 'Real Madrid',      pais: '🇫🇷', foto: 'https://img.uefa.com/imgml/TP/players/1/2022/324x324/250016209.jpg' },
            { año: 2021, jugador: 'Lionel Messi',    club: 'Paris SG',         pais: '🇦🇷', foto: '' },
            { año: 2020, jugador: 'No entregado',    club: '(COVID-19)',        pais: '—',   foto: '' },
            { año: 2019, jugador: 'Lionel Messi',    club: 'FC Barcelona',     pais: '🇦🇷', foto: '' },
            { año: 2018, jugador: 'Luka Modrić',     club: 'Real Madrid',      pais: '🇭🇷', foto: '' },
            { año: 2017, jugador: 'Cristiano Ronaldo', club: 'Real Madrid',    pais: '🇵🇹', foto: '' },
            { año: 2016, jugador: 'Cristiano Ronaldo', club: 'Real Madrid',    pais: '🇵🇹', foto: '' },
            { año: 2015, jugador: 'Lionel Messi',    club: 'FC Barcelona',     pais: '🇦🇷', foto: '' },
        ];

        const BOTA_ORO = [
            { temporada: '2024/25', jugador: 'Viktor Gyökeres', club: 'Sporting CP / Arsenal', pais: '🇸🇪', goles: 43 },
            { temporada: '2023/24', jugador: 'Kylian Mbappé',   club: 'Real Madrid',    pais: '🇫🇷', goles: 27 },
            { temporada: '2022/23', jugador: 'Erling Haaland',  club: 'Manchester City',pais: '🇳🇴', goles: 36 },
            { temporada: '2021/22', jugador: 'Sonny Colbrelli', club: 'Bayern München', pais: '🇩🇪', goles: 35 },
            { temporada: '2020/21', jugador: 'Cristiano Ronaldo', club: 'Juventus',     pais: '🇵🇹', goles: 29 },
            { temporada: '2019/20', jugador: 'Ciro Immobile',   club: 'Lazio',          pais: '🇮🇹', goles: 36 },
            { temporada: '2018/19', jugador: 'Lionel Messi',    club: 'FC Barcelona',   pais: '🇦🇷', goles: 36 },
            { temporada: '2017/18', jugador: 'Mohamed Salah',   club: 'Liverpool',      pais: '🇪🇬', goles: 32 },
        ];

        const GUANTE_ORO = [
            { temporada: '2024/25', jugador: 'Gianluigi Donnarumma', club: 'Paris Saint-Germain', pais: '🇮🇹' },
            { temporada: '2023/24', jugador: 'Emiliano Martínez', club: 'Aston Villa',  pais: '🇦🇷' },
            { temporada: '2022/23', jugador: 'Emiliano Martínez', club: 'Aston Villa',  pais: '🇦🇷' },
            { temporada: '2021/22', jugador: 'Thibaut Courtois', club: 'Real Madrid',   pais: '🇧🇪' },
            { temporada: '2020/21', jugador: 'Gianluigi Donnarumma', club: 'PSG',       pais: '🇮🇹' },
            { temporada: '2019/20', jugador: 'Manuel Neuer',    club: 'Bayern München', pais: '🇩🇪' },
            { temporada: '2018/19', jugador: 'Alisson Becker',  club: 'Liverpool',      pais: '🇧🇷' },
            { temporada: '2017/18', jugador: 'Thibaut Courtois', club: 'Real Madrid',   pais: '🇧🇪' },
        ];

        const EQUIPO_ANIO = [
            { año: 2024, equipo: 'Real Madrid', liga: 'La Liga', pais: '🇪🇸', jugadores: ['Courtois', 'Carvajal', 'Militão', 'Rüdiger', 'Mendy', 'Kroos', 'Modric', 'Bellingham', 'Vinicius', 'Mbappé', 'Rodrygo'] },
            { año: 2023, equipo: 'Manchester City', liga: 'Premier League', pais: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', jugadores: ['Ederson', 'Walker', 'Rúben Dias', 'Akanji', 'Gvardiol', 'Rodri', 'De Bruyne', 'Bernardo Silva', 'Haaland', 'Foden', 'Grealish'] },
            { año: 2022, equipo: 'Real Madrid', liga: 'La Liga', pais: '🇪🇸', jugadores: ['Courtois', 'Carvajal', 'Militão', 'Alaba', 'Mendy', 'Kroos', 'Casemiro', 'Modric', 'Valverde', 'Benzema', 'Vinicius'] },
        ];

        const EQUIPO_TEMPORADA = {
            'Premier League': { temporada: '2024/25', jugadores: ['Salah', 'Haaland', 'Palmer', 'Saka', 'Isak', 'Trent', 'Virgil', 'Alexander Arnold', 'Ederson', 'Matz Sels', 'Mykolenko'] },
            'La Liga':        { temporada: '2024/25', jugadores: ['Mbappé', 'Vinicius', 'Yamal', 'Dani Olmo', 'Bellingham', 'Valverde', 'Modric', 'Carvajal', 'Militão', 'Rüdiger', 'Courtois'] },
            'Serie A':        { temporada: '2024/25', jugadores: ['Lookman', 'Thuram', 'Dovbyk', 'Pulisic', 'Calhanoglu', 'De Roon', 'Bastoni', 'Maignan', 'Provedel', 'Di Lorenzo', 'Dimarco'] },
            'Bundesliga':     { temporada: '2024/25', jugadores: ['Kane', 'Olise', 'Musiala', 'Sané', 'Kimmich', 'Goretzka', 'Davies', 'Upamecano', 'Kim Min-jae', 'Neuer', 'Gnabry'] },
            'Ligue 1':        { temporada: '2024/25', jugadores: ['Barcola', 'Ramos', 'Désiré Doué', 'Hakimi', 'Marquinhos', 'Pacho', 'Lucas Beraldo', 'Donnarumma', 'Ben Yedder', 'Laborde', 'Ndiaye'] },
        };

        const _card = (titulo, emoji, contenido) => `
            <div class="glass-panel" style="padding:1.5rem; margin-bottom:1.5rem;">
                <h3 style="font-family:var(--font-heading); font-size:1.1rem; font-weight:900;
                    color:var(--accent-neon); text-transform:uppercase; letter-spacing:2px;
                    margin-bottom:1.2rem; display:flex; align-items:center; gap:8px;">
                    ${emoji} ${titulo}
                </h3>
                ${contenido}
            </div>
        `;

        const _tabla = (headers, filas) => `
            <div style="overflow-x:auto;">
                <table style="width:100%; border-collapse:collapse; font-size:0.82rem;">
                    <thead>
                        <tr style="border-bottom:1px solid var(--border-glass);">
                            ${headers.map(h => `<th style="padding:6px 8px; text-align:left; color:var(--text-muted); font-weight:600; white-space:nowrap;">${h}</th>`).join('')}
                        </tr>
                    </thead>
                    <tbody>
                        ${filas.map((f, i) => `
                            <tr style="border-bottom:1px solid rgba(255,255,255,0.04); ${i === 0 ? 'background:rgba(255,215,0,0.06);' : ''}">
                                ${f.map((c, ci) => `<td style="padding:7px 8px; color:${ci === 0 && i === 0 ? '#ffd700' : 'var(--text-main)'}; font-weight:${i === 0 ? '700' : '400'};">${c}</td>`).join('')}
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;

        const balonHtml = _tabla(
            ['Año', 'Jugador', 'Club', ''],
            BALON_ORO.map(b => [b.año, b.jugador, b.club, b.pais])
        );

        const botaHtml = _tabla(
            ['Temporada', 'Jugador', 'Club', 'Goles', ''],
            BOTA_ORO.map(b => [b.temporada, b.jugador, b.club, b.goles, b.pais])
        );

        const guanteHtml = _tabla(
            ['Temporada', 'Jugador', 'Club', ''],
            GUANTE_ORO.map(g => [g.temporada, g.jugador, g.club, g.pais])
        );

        const equipoAnioHtml = EQUIPO_ANIO.map((e, i) => `
            <div style="margin-bottom:${i < EQUIPO_ANIO.length - 1 ? '1.2rem' : '0'}; padding-bottom:${i < EQUIPO_ANIO.length - 1 ? '1.2rem' : '0'}; border-bottom:${i < EQUIPO_ANIO.length - 1 ? '1px solid var(--border-glass)' : 'none'};">
                <div style="display:flex; align-items:center; gap:8px; margin-bottom:6px;">
                    <span style="font-weight:800; color:#ffd700; font-size:0.9rem;">${e.año}</span>
                    <span style="font-weight:700; color:var(--text-main);">${e.equipo} ${e.pais}</span>
                    <span style="font-size:0.75rem; color:var(--text-muted);">${e.liga}</span>
                </div>
                <div style="display:flex; flex-wrap:wrap; gap:6px;">
                    ${e.jugadores.map(j => `<span style="background:rgba(255,255,255,0.06); padding:3px 8px; border-radius:12px; font-size:0.72rem; color:var(--text-muted);">${j}</span>`).join('')}
                </div>
            </div>
        `).join('');

        const equipoTempHtml = Object.entries(EQUIPO_TEMPORADA).map(([liga, data]) => `
            <div style="margin-bottom:1.2rem;">
                <div style="font-weight:700; color:var(--accent-neon); font-size:0.82rem; margin-bottom:6px; text-transform:uppercase; letter-spacing:1px;">${liga} ${data.temporada}</div>
                <div style="display:flex; flex-wrap:wrap; gap:6px;">
                    ${data.jugadores.map(j => `<span style="background:rgba(61,111,255,0.08); padding:3px 8px; border-radius:12px; font-size:0.72rem; color:var(--text-muted);">${j}</span>`).join('')}
                </div>
            </div>
        `).join('');

        appContainer.innerHTML = `
            ${renderNavbar('#/awards')}
            <main class="page-container fade-in" style="max-width:800px; margin:0 auto;">
                <h2 class="section-title">🏅 Awards</h2>
                <p style="color:var(--text-muted); font-size:0.85rem; margin-bottom:1.5rem;">
                    Los premios individuales y colectivos más importantes del fútbol mundial.
                </p>

                ${_card('Balón de Oro', '🥇', balonHtml)}
                ${_card('Bota de Oro', '👟', botaHtml)}
                ${_card('Guante de Oro', '🧤', guanteHtml)}
                ${_card('Equipo del Año UEFA', '🏆', equipoAnioHtml)}
                ${_card('Equipo de la Temporada', '🌟', equipoTempHtml)}
            </main>
            ${_closeSidebarWrapper()}
        `;
    };

    // ── FICHA DE JUGADOR ─────────────────────────────────────────────────────
    const renderJugador = async (athleteId, ligaSlug) => {
        if (!athleteId) { window.location.hash = '#/home'; return; }
        const liga = _normalizarSlug(ligaSlug) || 'fifa.world';

        const CF_WORKER = 'https://whistle.solgoyhe.workers.dev';
        const _get = async (url) => {
            const r = await fetch(CF_WORKER + '/?url=' + encodeURIComponent(String(url).replace('http://', 'https://')));
            if (!r.ok) throw new Error('HTTP ' + r.status);
            return r.json();
        };

        appContainer.innerHTML = `
            ${renderNavbar('#/jugador')}
            <main class="page-container fade-in">
                <a href="javascript:history.back()" class="subsection-link" style="display:inline-block;margin-bottom:1rem;">← Volver</a>
                <div id="jug-cont">
                    <div style="text-align:center;padding:3rem;">
                        <div style="width:34px;height:34px;border:3px solid var(--blue);border-right-color:transparent;border-radius:50%;animation:spin 1s linear infinite;margin:0 auto;"></div>
                        <p style="color:var(--muted);margin-top:1rem;font-size:.85rem;">Cargando jugador...</p>
                    </div>
                </div>
            </main>
        ${_closeSidebarWrapper()}
        `;

        const cont = document.getElementById('jug-cont');
        const BASE = `https://sports.core.api.espn.com/v2/sports/soccer/leagues/${liga}/seasons/${new Date().getFullYear()}`;

        try {
            const atleta = await _get(`${BASE}/athletes/${athleteId}`);

            // ---- Cabecera: la ve todo el mundo (es el gancho) ----
            const POSICIONES = { F: 'Delantero', M: 'Mediocampista', D: 'Defensor', G: 'Arquero' };
            const abrev = atleta.position?.abbreviation ?? '';
            const meta  = [
                atleta.citizenship,
                POSICIONES[abrev] ?? atleta.position?.displayName ?? abrev,
                atleta.jersey ? '#' + atleta.jersey : '',
            ].filter(Boolean).join(' · ');
            const chips = [
                atleta.age ? atleta.age + ' años' : '',
                atleta.displayHeight || '',
                atleta.displayWeight || '',
            ].filter(Boolean);

            const cabecera = `
                <div class="jug-hero">
                    <span class="jug-face">
                        ${atleta.headshot?.href
                            ? `<img class="cara" src="${atleta.headshot.href}" onerror="this.style.display='none'">`
                            : `<span class="sin-foto">${(atleta.displayName ?? '?').charAt(0)}</span>`}
                        ${atleta.flag?.href ? `<img class="bandera" src="${atleta.flag.href}" onerror="this.style.display='none'">` : ''}
                    </span>
                    <div style="min-width:0;flex:1;">
                        <div class="jug-nombre">${atleta.displayName ?? '?'}</div>
                        <div class="jug-meta">${meta}</div>
                        <div class="jug-chips">${chips.map(c => `<span class="jug-chip">${c}</span>`).join('')}</div>
                    </div>
                </div>`;

            // Goles, asistencias e historial son features de Platea. Al usuario free le
            // mostramos la cabecera y el candado, y ni siquiera gastamos los fetches.
            if (!_esPro()) {
                cont.innerHTML = cabecera +
                    _paywallInline('pro', 'Los goles, asistencias y el historial del jugador están disponibles en el plan Platea.');
                return;
            }

            // Totales de temporada + historial, en paralelo
            const [stats, log] = await Promise.all([
                _get(`${BASE}/types/1/athletes/${athleteId}/statistics`).catch(() => null),
                _get(`${BASE}/athletes/${athleteId}/eventlog`).catch(() => null),
            ]);

            // ---- Totales de la temporada ----
            // Las stats vienen repartidas en categorías (general/offensive/defensive); las aplanamos.
            const totales = {};
            (stats?.splits?.categories ?? []).forEach(c => {
                (c.stats ?? []).forEach(s => { totales[s.name] = s.displayValue; });
            });
            const val = (k) => totales[k] ?? '—';

            // ---- Historial partido a partido (últimos 8, más reciente primero) ----
            const jugados  = (log?.events?.items ?? []).filter(i => i.played);
            const partidos = (await Promise.all(jugados.slice(-8).reverse().map(async (it) => {
                try {
                    const [ev, ps] = await Promise.all([
                        _get(it.event['$ref']),
                        it.statistics?.['$ref'] ? _get(it.statistics['$ref']).catch(() => null) : Promise.resolve(null),
                    ]);
                    const m = {};
                    (ps?.splits?.categories ?? []).forEach(c => {
                        (c.stats ?? []).forEach(s => { m[s.name] = s.displayValue; });
                    });
                    const f = new Date(ev.date ?? '');
                    return {
                        id:    ev.id,
                        rival: ev.name ?? ev.shortName ?? '?',
                        fecha: isNaN(f) ? '' : f.toLocaleDateString('es-AR', { day: '2-digit', month: 'short' }),
                        min:   m['minutes'] ?? '0',
                        goles: parseInt(m['totalGoals'] ?? '0', 10) || 0,
                        asist: parseInt(m['goalAssists'] ?? '0', 10) || 0,
                    };
                } catch { return null; }
            }))).filter(Boolean);

            const historial = partidos.length ? `
                <div class="jug-hist-row head">
                    <span class="jug-hist-h izq">Fecha</span>
                    <span class="jug-hist-h izq">Partido</span>
                    <span class="jug-hist-h">Min</span>
                    <span class="jug-hist-h">G</span>
                    <span class="jug-hist-h">A</span>
                </div>
                ${partidos.map(p => `
                    <div class="jug-hist-row" onclick="window.location.hash='#/partido?id=${p.id}&liga=${liga}'">
                        <span class="jug-hist-fecha">${p.fecha}</span>
                        <span class="jug-hist-rival">${p.rival}</span>
                        <span class="jug-hist-num ${p.min === '0' ? 'cero' : ''}">${p.min}</span>
                        <span class="jug-hist-num ${p.goles ? 'gol' : 'cero'}">${p.goles}</span>
                        <span class="jug-hist-num ${p.asist ? '' : 'cero'}">${p.asist}</span>
                    </div>`).join('')}`
                : '<p style="color:var(--muted);font-size:.84rem;padding:12px 2px;">Sin partidos registrados esta temporada.</p>';

            cont.innerHTML = `
                ${cabecera}

                <div class="jug-stats">
                    <div class="jug-stat destacada"><div class="v">${val('totalGoals')}</div><div class="l">Goles</div></div>
                    <div class="jug-stat destacada"><div class="v">${val('goalAssists')}</div><div class="l">Asistencias</div></div>
                    <div class="jug-stat"><div class="v">${val('appearances')}</div><div class="l">Partidos</div></div>
                    <div class="jug-stat"><div class="v">${val('minutes')}</div><div class="l">Minutos</div></div>
                    <div class="jug-stat"><div class="v">${val('totalShots')}</div><div class="l">Tiros</div></div>
                    <div class="jug-stat"><div class="v">${val('shotsOnTarget')}</div><div class="l">Al arco</div></div>
                </div>

                <div class="glass-panel">
                    <div class="panel-title">Historial de partidos</div>
                    ${historial}
                </div>`;
        } catch (e) {
            cont.innerHTML = `
                <div class="glass-panel" style="text-align:center;padding:2.5rem;">
                    <div style="font-size:1.8rem;margin-bottom:.6rem;">😕</div>
                    <p style="color:var(--muted);font-size:.88rem;">No pudimos cargar la ficha de este jugador.</p>
                </div>`;
        }
    };

    const router = async () => {
        const hash = window.location.hash || '#/';
        const url  = new URL('http://dummy.com' + hash.replace('#', ''));
        const path = '#' + url.pathname;

        const autenticado = window.FirebaseAuth?.isAuthenticated();

        // Rutas públicas
        if (path === '#/' || path === '#/landing') {
            if (autenticado) { window.location.hash = '#/home'; return; }
            renderLanding();
            return;
        }

        // Rutas protegidas
        if (!autenticado) {
            renderLanding();
            return;
        }

        // Redirigir al setup si es la primera vez
        const perfil = window.FirebaseAuth?.getPerfil();
        if (perfil && perfil.perfilCompleto === false && path !== '#/setup') {
            window.location.hash = '#/setup';
            return;
        }

        switch (path) {
            case '#/home':
                renderHome();
                break;
            case '#/ligas':
                renderLigas();
                break;
            case '#/liga':
                await renderLigaDetalle(url.searchParams.get('id'));
                break;
            case '#/grupo':
                await renderGrupoDetalle(url.searchParams.get('id'));
                break;
            case '#/equipo':
                await renderEquipoDetalle(
                    url.searchParams.get('id'),
                    url.searchParams.get('liga'),
                    url.searchParams.get('name')
                );
                break;
            case '#/h2h':
                await renderH2H();
                break;
            case '#/info':
                await renderInfo();
                break;
            case '#/awards':
                renderAwards();
                break;
            case '#/jugador':
                await renderJugador(url.searchParams.get('id'), url.searchParams.get('liga'));
                break;
            case '#/perfil':
                await renderPerfil();
                break;
            case '#/planes':
                renderPlanes();
                break;
            case '#/setup':
                renderSetup();
                break;
            case '#/partido': {
                const urlP = new URL('http://x.com' + hash.replace('#',''));
                await renderPartido(urlP.searchParams.get('id'), urlP.searchParams.get('liga'));
                break;
            }
            case '#/other-sports': {
                const urlParams3 = new URL('http://x.com' + hash.replace('#',''));
                await renderOtherSports(
                    urlParams3.searchParams.get('deporte'),
                    urlParams3.searchParams.get('liga')
                );
                break;
            }
            case '#/admin':
                await renderAdmin();
                break;
            default:
                appContainer.innerHTML = `
                    ${renderNavbar(path)}
                    <main class="page-container fade-in" style="text-align: center; padding-top: 15%;">
                        <h2 class="section-title" style="border: none; color: var(--accent-neon);">Módulo en desarrollo</h2>
                    </main>
                ${_closeSidebarWrapper()}
                `;
        }
        // Iniciar/refrescar ticker después de cada render
        if (autenticado) _startTickerRefresh();
    };

    const init = async () => {
        window.addEventListener('hashchange', router);

        // Esperar a que Firebase resuelva el estado de auth antes del primer render
        await Promise.race([
            window.FirebaseAuth?.esperarListo() ?? Promise.resolve(),
            new Promise(r => setTimeout(r, 3000)) // timeout 3s por las dudas
        ]);

        // Primer render
        await router();

        // Re-rutear cuando cambie el estado de auth
        window.FirebaseAuth?.onChange(() => router());
    };

    return { init };
})();

App.init();
