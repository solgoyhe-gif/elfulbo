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
            return [1, ...nums]; // agregar GK
        }
        return [1, 4, 3, 3]; // default 4-3-3
    };

    // Calcula posiciones X/Y usando formationPlace (1=GK, 2-11=campo)
    // y la formación del equipo para saber qué fila le toca a cada jugador
    const _calcularPosicionesTacticas = (titulares, svgW = 400, svgH = 560, formacionStr = '') => {
        // Ordenar por formationPlace
        const sorted = [...titulares].sort((a, b) => a.formationPlace - b.formationPlace);

        // Parsear formación → saber cuántos jugadores van en cada fila
        const lineas = _parsearFormacion(formacionStr);
        // lineas[0]=1 (GK), lineas[1]=defensas, lineas[2]=medios, etc.

        // Asignar fila a cada jugador según su posición en el orden
        // formationPlace 1 = GK, 2..N = campo en orden de fila
        const coordsMap = new Map();

        const yGK  = svgH * 0.90;
        const yFWD = svgH * 0.12;
        const totalLineas = lineas.length;

        let placeIdx = 0;
        lineas.forEach((count, lineaIdx) => {
            // Y interpolado: GK (lineaIdx=0) → FWD (lineaIdx=last)
            const t = totalLineas === 1 ? 0 : lineaIdx / (totalLineas - 1);
            const y = Math.round(yGK - t * (yGK - yFWD));

            // Margen horizontal dinámico según cantidad de jugadores
            // Con 1 → centrado, con 2 → algo centrado, con 4-5 → bien abiertos
            const spread = count === 1 ? 0 :
                           count === 2 ? 0.25 :
                           count === 3 ? 0.35 :
                           count === 4 ? 0.42 : 0.45;
            const xMin = svgW * (0.5 - spread);
            const xMax = svgW * (0.5 + spread);

            for (let i = 0; i < count; i++) {
                if (placeIdx >= sorted.length) break;
                const j = sorted[placeIdx];
                let x;
                if (count === 1) {
                    x = svgW / 2;
                } else {
                    x = Math.round(xMin + (i / (count - 1)) * (xMax - xMin));
                }
                coordsMap.set(j.formationPlace, { x, y, n: count });
                placeIdx++;
            }
        });

        // Si sobraron jugadores (formación no coincide), distribuirlos en una fila extra
        if (placeIdx < sorted.length) {
            const restantes = sorted.slice(placeIdx);
            const y = Math.round(yFWD);
            const xMin = svgW * 0.10;
            const xMax = svgW * 0.90;
            const n = restantes.length;
            restantes.forEach((j, i) => {
                const x = n === 1 ? svgW/2 : Math.round(xMin + (i/(n-1))*(xMax-xMin));
                coordsMap.set(j.formationPlace, { x, y, n });
            });
        }

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
            pro:    { color: '#39ff14', bg: 'rgba(57,255,20,0.2)',   emoji: '🎟️', label: 'PLATEA'  },
            promax: { color: '#ffd700', bg: 'rgba(255,215,0,0.2)',   emoji: '👑', label: 'PALCO'   },
        };
        const pm = planMeta[plan] ?? planMeta.free;

        const links = [
            { href: '#/home',         icon: '🏠', label: 'Inicio',       active: activeHash === '#/home' },
            { href: '#/ligas',        icon: '🏆', label: 'Ligas',        active: isLigasActive },
            { href: '#/h2h',          icon: '⚔️', label: 'H2H',          active: activeHash === '#/h2h' },
            { href: '#/info',         icon: '📰', label: 'Info',         active: activeHash === '#/info' },
            { href: '#/other-sports', icon: '🎽', label: 'Other Sports', active: activeHash.includes('#/other-sports') },
            { href: '#/perfil',       icon: '👤', label: 'Perfil',       active: activeHash === '#/perfil' },
        ];

        return `
            <aside id="app-sidebar" class="sidebar ${abierta ? '' : 'closed'}">
                <div class="sidebar-header">
                    <span class="sidebar-logo">WHISTLE</span>
                    <button id="sidebar-toggle-btn" class="sidebar-toggle"
                        onclick="window._sidebarToggle()" title="Expandir / retraer">
                        ${abierta ? '‹' : '›'}
                    </button>
                </div>
                <nav class="sidebar-nav">
                    ${links.map(l => `
                        <a href="${l.href}" class="sidebar-link ${l.active ? 'active' : ''}">
                            <span class="sidebar-icon">${l.icon}</span>
                            <span class="sidebar-label">${l.label}</span>
                        </a>`).join('')}
                    <div class="sidebar-divider"></div>
                </nav>
                <div class="sidebar-footer">
                    <div class="sidebar-plan">
                        <span class="sidebar-plan-badge"
                            style="background:${pm.bg}; color:${pm.color};">
                            ${pm.emoji} ${pm.label}
                        </span>
                        <span class="sidebar-plan-name">${nombre}</span>
                    </div>
                    <button class="sidebar-link" onclick="window.FirebaseAuth?.logout()"
                        style="color:#ff4757;">
                        <span class="sidebar-icon">🚪</span>
                        <span class="sidebar-label">Salir</span>
                    </button>
                </div>
            </aside>
            <div id="sidebar-wrapper" class="sidebar-page-wrapper ${abierta ? '' : 'sidebar-closed'}">
        `;
    };

    const _closeSidebarWrapper = () => window.FirebaseAuth?.isAuthenticated() ? '</div>' : '';
    window._sidebarToggle = _sidebarToggle;

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
    const renderHome = async () => {
        const CF_WORKER  = 'https://elfulbo.solgoyhe.workers.dev';
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
            rugby:      {nombre:'Rugby',             emoji:'🏉', slug:'rugby-union/international',liga:'Rugby'},
        };

        // Render inicial con skeleton
        appContainer.innerHTML = `
            ${renderNavbar('#/home')}
            <main class="page-container fade-in" style="max-width:800px; margin:0 auto;">

                <!-- Saludo -->
                <div style="margin-bottom:1.5rem;">
                    <h2 style="font-family:var(--font-heading); font-size:1.6rem; font-weight:900; margin-bottom:0.2rem;">
                        Hola${nombre ? ', ' + nombre : ''} 👋
                    </h2>
                    <p style="color:var(--text-muted); font-size:0.85rem;">The sound of sport.</p>
                </div>

                <!-- Sección fútbol -->
                <div style="margin-bottom:0.5rem; display:flex; align-items:center; justify-content:space-between;">
                    <h3 style="font-family:var(--font-heading); font-size:0.8rem; font-weight:800; text-transform:uppercase; letter-spacing:2px; color:var(--accent-neon);">
                        ⚽ FÚTBOL
                    </h3>
                    <a href="#/h2h" style="font-size:0.75rem; color:var(--text-muted); text-decoration:none;">Ver todos →</a>
                </div>
                <div id="home-futbol" class="glass-panel" style="padding:1rem; margin-bottom:1.5rem;">
                    <div style="display:flex; gap:8px; align-items:center;">
                        <div style="width:20px; height:20px; border:2px solid var(--accent-neon); border-right-color:transparent; border-radius:50%; animation:spin 1s linear infinite;"></div>
                        <span style="color:var(--text-muted); font-size:0.82rem;">Cargando partidos...</span>
                    </div>
                </div>

                <!-- Deportes elegidos -->
                <div id="home-otros-deportes">
                    ${deportes.length > 0 && esProMax ? deportes.map(d => {
                        const info = DEPORTE_INFO[d];
                        if (!info) return '';
                        return `
                            <div style="margin-bottom:0.5rem; display:flex; align-items:center; justify-content:space-between;">
                                <h3 style="font-family:var(--font-heading); font-size:0.8rem; font-weight:800; text-transform:uppercase; letter-spacing:2px; color:var(--text-muted);">
                                    ${info.emoji} ${info.nombre.toUpperCase()}
                                </h3>
                                <a href="#/other-sports?deporte=${d}" style="font-size:0.75rem; color:var(--text-muted); text-decoration:none;">Ver todos →</a>
                            </div>
                            <div id="home-deporte-${d}" class="glass-panel" style="padding:1rem; margin-bottom:1.5rem;">
                                <div style="display:flex; gap:8px; align-items:center;">
                                    <div style="width:20px; height:20px; border:2px solid var(--text-muted); border-right-color:transparent; border-radius:50%; animation:spin 1s linear infinite;"></div>
                                    <span style="color:var(--text-muted); font-size:0.82rem;">Cargando...</span>
                                </div>
                            </div>`;
                    }).join('') : ''}
                </div>

                <!-- Upgrade CTA si no tiene deportes elegidos -->
                ${deportes.length === 0 && !esProMax ? `
                <div class="glass-panel" style="padding:1.5rem; text-align:center; border-color:rgba(57,255,20,0.2);">
                    <p style="font-size:0.9rem; color:var(--text-muted); margin-bottom:1rem;">
                        ¿Querés seguir más deportes en tu home?
                    </p>
                    <a href="#/planes" style="padding:8px 20px; background:var(--accent-neon); color:#000; font-weight:800; font-family:var(--font-heading); border-radius:8px; text-decoration:none; font-size:0.85rem;">
                        VER PLANES
                    </a>
                </div>` : ''}

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
            const marcador = (esPost||esLive) ? homeScore + ' - ' + awayScore : horaAR;
            const sz = (esPost||esLive) ? '1.3rem' : '0.9rem';
            const col = (esPost||esLive) ? 'var(--text-main)' : 'var(--accent-neon)';
            const liveBadge = esLive ? `<span style="background:#ff4757; color:#fff; padding:2px 8px; border-radius:10px; font-size:0.65rem; font-weight:800; display:inline-block; margin-bottom:6px; animation:pulse 1s infinite;">● EN VIVO ${clock}'</span>` : '';

            return `<div onclick="${ir}" style="cursor:pointer; transition:opacity 0.2s;" onmouseover="this.style.opacity='0.8'" onmouseout="this.style.opacity='1'">
                ${liveBadge}
                <div style="display:grid; grid-template-columns:1fr auto 1fr; align-items:center; gap:0.5rem;">
                    <div style="display:flex; align-items:center; gap:6px;">${logoHtml(homeLogo,homeName)}<span style="font-size:0.88rem; font-weight:600;">${homeName}</span></div>
                    <div style="font-family:var(--font-heading); font-weight:900; font-size:${sz}; color:${col}; text-align:center; min-width:50px;">${marcador}</div>
                    <div style="display:flex; align-items:center; gap:6px; justify-content:flex-end;"><span style="font-size:0.88rem; font-weight:600;">${awayName}</span>${logoHtml(awayLogo,awayName)}</div>
                </div>
            </div>`;
        };

        // Cargar partido de fútbol
        const _cargarFutbol = async () => {
            const futbolEl = document.getElementById('home-futbol');
            if (!futbolEl) return;
            try {
                const hoy = new Date().toLocaleDateString('en-CA', {timeZone:'America/Argentina/Buenos_Aires'}).replace(/-/g,'');
                const res = await fetch(CF_WORKER + '/?url=' + encodeURIComponent('https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard?dates=' + hoy));
                const data = res.ok ? await res.json() : {};
                const eventos = data.events ?? [];

                // Priorizar: en vivo → finalizado → próximo
                eventos.sort((a,b) => {
                    const p = s => s==='in'?0:s==='post'?1:2;
                    return p(a.competitions?.[0]?.status?.type?.state) - p(b.competitions?.[0]?.status?.type?.state);
                });

                const top3 = eventos.slice(0,3);
                if (top3.length === 0) {
                    futbolEl.innerHTML = '<p style="color:var(--text-muted); font-size:0.82rem;">Sin partidos hoy.</p>';
                    return;
                }
                futbolEl.innerHTML = top3.map(ev => _renderPartidoHome(ev, 'fifa.world')).join('<hr style="border:none; border-top:1px solid var(--border-glass); margin:8px 0;">');
            } catch(e) {
                if (futbolEl) futbolEl.innerHTML = '<p style="color:var(--text-muted); font-size:0.82rem;">Error cargando partidos.</p>';
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
        const esPro       = _esPro();
        const ligaNacional = window.FirebaseAuth?.getPerfil()?.ligaNacional ?? null;

        let html = `
            ${renderNavbar('#/ligas')}
            <main class="page-container fade-in">
                <h2 class="section-title">🏆 Competiciones Disponibles</h2>
                ${!esPro ? `
                <div style="background:rgba(57,255,20,0.06); border:1px solid rgba(57,255,20,0.2); border-radius:10px;
                    padding:12px 16px; margin-bottom:1.5rem; display:flex; align-items:center; justify-content:space-between; gap:1rem;">
                    <div>
                        <span style="font-size:0.82rem; color:var(--text-main); font-weight:600;">Plan Popular — 1 liga nacional + todas las copas</span>
                        <span style="display:block; font-size:0.75rem; color:var(--text-muted);">Pasate a Platea para ver todas las ligas.</span>
                    </div>
                    <a href="#/planes" style="padding:6px 14px; background:var(--accent-neon); color:#000; font-weight:800;
                        font-family:var(--font-heading); border-radius:6px; text-decoration:none; font-size:0.78rem; white-space:nowrap;">
                        VER PRO
                    </a>
                </div>` : ''}
        `;

        // Keys que son copas — siempre visibles para todos los planes
        const KEYS_COPAS = ['copas_inglesas', 'internacionales', 'mundiales', 'sudamerica'];

        for (const key in LIGAS) {
            const categoria = LIGAS[key];
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
                        style="${bloqueada ? 'opacity:0.6;' : ''}">
                        <div class="league-info">
                            <span class="league-flag">${liga.flag}</span>
                            <div>
                                <div class="league-name">${bloqueada ? '🔒 ' : ''}${liga.nombre}</div>
                                <div class="league-country">${liga.pais}</div>
                            </div>
                        </div>
                        <span class="badge-liga" style="background-color: ${bloqueada ? '#444' : liga.badge_color};">${bloqueada ? 'PRO' : liga.id.substring(0, 5)}</span>
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
                        <h3 class="panel-title" style="color: ${ligaData.badge_color};">Tabla de Posiciones</h3>
                        <div class="table-responsive">${_skeletonTabla()}</div>
                    </div>
                    <div class="glass-panel" id="matches-box" style="padding: 1.5rem; height: fit-content;">
                        <h3 class="panel-title" style="color: ${ligaData.badge_color};">Partidos Recientes</h3>
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
                standingsBox.querySelector('.table-responsive').innerHTML = `<p style="color: var(--text-muted); padding: 10px;">Clasificación no disponible temporalmente.</p>`;
            }

            if (partidosRaw && partidosRaw.length > 0) {
                let matchesHtml = partidosRaw.map(partido => {
                    const statusDesc = partido.status?.description ?? partido.status?.state ?? '';
                    const isLive     = partido.status?.state === 'in' || statusDesc.toLowerCase().includes("'");
                    const liveBadge  = isLive ? `<span style="color: #ff4757; font-size: 0.7rem; font-weight: bold; animation: pulse 1s infinite; margin-left: 6px;">● VIVO</span>` : '';
                    const homeLogoHtml = partido.homeTeam?.logo ? `<img src="${partido.homeTeam.logo}" width="18" height="18" style="object-fit:contain; margin-right:6px; vertical-align:middle;">` : '';
                    const awayLogoHtml = partido.awayTeam?.logo ? `<img src="${partido.awayTeam.logo}" width="18" height="18" style="object-fit:contain; margin-right:6px; vertical-align:middle;">` : '';

                    return `
                        <div class="match-item" style="padding: 12px 0; border-bottom: 1px solid var(--border-glass);">
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
        const CF_WORKER = 'https://elfulbo.solgoyhe.workers.dev';

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
                        background:rgba(57,255,20,0.12); color:var(--accent-neon);
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
                btnActivo.style.background = 'rgba(57,255,20,0.12)';
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
        const CF_WORKER = 'https://elfulbo.solgoyhe.workers.dev';

        container.innerHTML = `
            <div style="text-align:center; padding:2rem;">
                <div style="width:36px; height:36px; border:3px solid var(--accent-neon); border-right-color:transparent; border-radius:50%; animation:spin 1s linear infinite; margin:0 auto;"></div>
                <p style="color:var(--accent-neon); margin-top:1rem; font-size:0.85rem;">Cargando bracket...</p>
            </div>`;

        const FASES_FECHAS = {
            octavos:   ['20260628','20260629','20260630','20260701','20260702','20260703','20260704'],
            cuartos:   ['20260707','20260708','20260709','20260710'],
            semis:     ['20260714','20260715'],
            tercero:   ['20260718'],
            final:     ['20260719'],
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

            const _getPartidos = (fase) => {
                const fechas  = FASES_FECHAS[fase];
                const eventos = fechas.flatMap(f => eventosPorFecha[f] ?? []);
                const vistos  = new Set();
                return eventos.filter(ev => { if (vistos.has(ev.id)) return false; vistos.add(ev.id); return true; });
            };

            const octavos = _getPartidos('octavos');
            const cuartos = _getPartidos('cuartos');
            const semis   = _getPartidos('semis');
            const tercero = _getPartidos('tercero');
            const final_  = _getPartidos('final');

            // ── SVG dimensions ────────────────────────────────────────────────
            const W      = 1200;
            const H      = 900;
            const BW     = 130; // box width
            const BH     = 38;  // box height
            const GAP    = 4;   // gap between home/away
            const MATCHH = BH * 2 + GAP; // total match height

            // ── Helper: info de partido ────────────────────────────────────────
            const _info = (ev) => {
                if (!ev) return { home: '?', away: '?', hs: '', as_: '', live: false, post: false, id: '' };
                const comp  = ev.competitions?.[0];
                const home  = comp?.competitors?.find(c => c.homeAway === 'home');
                const away  = comp?.competitors?.find(c => c.homeAway === 'away');
                const state = comp?.status?.type?.state ?? 'pre';
                return {
                    id:   ev.id,
                    home: home?.team?.abbreviation ?? home?.team?.shortDisplayName ?? '?',
                    away: away?.team?.abbreviation ?? away?.team?.shortDisplayName ?? '?',
                    hs:   home?.score ?? '',
                    as_:  away?.score ?? '',
                    hl:   home?.team?.logo ?? '',
                    al:   away?.team?.logo ?? '',
                    live: state === 'in',
                    post: state === 'post',
                    hw:   state === 'post' && parseInt(home?.score??'0') > parseInt(away?.score??'0'),
                    aw:   state === 'post' && parseInt(away?.score??'0') > parseInt(home?.score??'0'),
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
                    const fill    = win ? '#39ff14' : '#ffffff';
                    const bgFill  = win ? 'rgba(57,255,20,0.15)' : 'rgba(30,30,50,0.95)';
                    const weight  = win ? '700' : '400';
                    return `
                        <rect x="${x}" y="${ry}" width="${BW}" height="${BH}" rx="4"
                            fill="${bgFill}" stroke="${win ? '#39ff14' : 'rgba(255,255,255,0.15)'}" stroke-width="${win?1.5:1}"/>
                        ${logo ? `<image href="${logo}" x="${x+5}" y="${ry+9}" width="18" height="18" style="object-fit:contain;"/>` : ''}
                        <text x="${x + (logo?26:8)}" y="${ry + BH/2 + 1}" dominant-baseline="middle"
                            font-family="system-ui" font-size="10" font-weight="${weight}" fill="${fill}">
                            ${name.substring(0,10)}
                        </text>
                        ${score !== '' ? `<text x="${x+BW-6}" y="${ry + BH/2 + 1}" dominant-baseline="middle" text-anchor="end"
                            font-family="system-ui" font-size="11" font-weight="800" fill="${win?'#39ff14':'#ffffff'}">${score}</text>` : ''}
                    `;
                };

                const liveBadge = d.live ? `
                    <rect x="${x}" y="${y-12}" width="${BW}" height="11" rx="3" fill="#ff4757"/>
                    <text x="${x + BW/2}" y="${y-5}" text-anchor="middle" dominant-baseline="middle"
                        font-family="system-ui" font-size="7" font-weight="800" fill="#fff">● EN VIVO</text>` : '';

                const labelEl = label ? `
                    <text x="${x + BW/2}" y="${y - (d.live?16:4)}" text-anchor="middle"
                        font-family="system-ui" font-size="8" fill="rgba(255,255,255,0.4)">${label}</text>` : '';

                return `
                    <g ${onclick} style="${cursor}" class="bracket-match">
                        ${labelEl}
                        ${liveBadge}
                        ${_row(d.home, d.hs, d.hl, d.hw, true)}
                        ${_row(d.away, d.as_, d.al, d.aw, false)}
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
            // Izquierda: 8 partidos de octavos (R1-R8)
            // Derecha:   8 partidos de octavos (R9-R16)
            // Centro: cuartos → semis → final

            const COL_L1 = 10;           // octavos izq
            const COL_L2 = COL_L1 + BW + 40; // cuartos izq
            const COL_L3 = COL_L2 + BW + 40; // semis izq
            const COL_MID = W/2 - BW/2;       // final / centro
            const COL_R3  = W - COL_L3 - BW;  // semis der
            const COL_R2  = W - COL_L2 - BW;  // cuartos der
            const COL_R1  = W - COL_L1 - BW;  // octavos der

            // Y positions para octavos izquierda (8 partidos)
            const spacingL1 = (H - 60) / 8;
            const ysL1 = Array.from({length:8}, (_,i) => 30 + i * spacingL1);

            // Y positions cuartos izq (4)
            const ysL2 = [0,1,2,3].map(i => (ysL1[i*2] + ysL1[i*2+1]) / 2 + MATCHH/4);

            // Y semis izq (2)
            const ysL3 = [0,1].map(i => (ysL2[i*2] + ysL2[i*2+1]) / 2);

            // Y final (1)
            const yFinal = H/2 - MATCHH/2;

            // Y tercer puesto
            const yTercero = yFinal + MATCHH + 40;

            // Partidos SVG
            let matchesSVG = '';
            let linesSVG   = '';

            // ── Octavos izquierda (slots 0-7) ─────────────────────────────────
            const oct_l = octavos.slice(0, 8);
            for (let i = 0; i < 8; i++) {
                matchesSVG += _match(COL_L1, ysL1[i], oct_l[i] ?? null, `P${i+1}`);
                // línea al cuarto
                const fromY = ysL1[i] + MATCHH / 2;
                const toY   = ysL2[Math.floor(i/2)] + MATCHH / 2;
                linesSVG += _connect(COL_L1 + BW, fromY, COL_L2, toY);
            }

            // ── Cuartos izquierda ──────────────────────────────────────────────
            const cua_l = cuartos.slice(0, 4);
            for (let i = 0; i < 4; i++) {
                matchesSVG += _match(COL_L2, ysL2[i], cua_l[i] ?? null);
                const fromY = ysL2[i] + MATCHH / 2;
                const toY   = ysL3[Math.floor(i/2)] + MATCHH / 2;
                linesSVG += _connect(COL_L2 + BW, fromY, COL_L3, toY);
            }

            // ── Semis izquierda ────────────────────────────────────────────────
            const sem_l = semis.slice(0, 2);
            for (let i = 0; i < 2; i++) {
                matchesSVG += _match(COL_L3, ysL3[i], sem_l[i] ?? null);
                const fromY = ysL3[i] + MATCHH / 2;
                linesSVG += _connect(COL_L3 + BW, fromY, COL_MID, yFinal + MATCHH/2);
            }

            // ── Final ──────────────────────────────────────────────────────────
            matchesSVG += _match(COL_MID, yFinal, final_[0] ?? null, 'FINAL');

            // ── Tercer puesto ──────────────────────────────────────────────────
            matchesSVG += _match(COL_MID, yTercero, tercero[0] ?? null, '3er PUESTO');

            // ── Octavos derecha (slots 8-15) ───────────────────────────────────
            const oct_r = octavos.slice(8, 16);
            const ysR1  = [...ysL1];
            for (let i = 0; i < 8; i++) {
                matchesSVG += _match(COL_R1, ysR1[i], oct_r[i] ?? null, `P${i+9}`);
                const fromY = ysR1[i] + MATCHH / 2;
                const toY   = ysL2[Math.floor(i/2)] + MATCHH / 2;
                linesSVG += _connect(COL_R2 + BW, toY, COL_R1, fromY);
            }

            // ── Cuartos derecha ────────────────────────────────────────────────
            const cua_r = cuartos.slice(4, 8);
            for (let i = 0; i < 4; i++) {
                matchesSVG += _match(COL_R2, ysL2[i], cua_r[i] ?? null);
                const fromY = ysL2[i] + MATCHH / 2;
                const toY   = ysL3[Math.floor(i/2)] + MATCHH / 2;
                linesSVG += _connect(COL_R3 + BW, toY, COL_R2, fromY);
            }

            // ── Semis derecha ──────────────────────────────────────────────────
            const sem_r = semis.slice(2, 4);
            for (let i = 0; i < 2; i++) {
                matchesSVG += _match(COL_R3, ysL3[i], sem_r[i] ?? null);
                const fromY = ysL3[i] + MATCHH / 2;
                linesSVG += _connect(COL_MID + BW, yFinal + MATCHH/2, COL_R3, fromY);
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
                <div style="overflow-x:auto; overflow-y:auto; padding:0.5rem;">
                    <svg viewBox="0 0 ${W} ${H+60}" xmlns="http://www.w3.org/2000/svg"
                        style="width:100%; min-width:900px; display:block; background:rgba(0,0,0,0.2); border-radius:12px;">
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
                        <text x="${COL_L1 + BW/2}" y="16" text-anchor="middle" font-family="system-ui" font-size="8" font-weight="800" fill="#6CABDD" letter-spacing="1">OCTAVOS</text>
                        <text x="${COL_L2 + BW/2}" y="16" text-anchor="middle" font-family="system-ui" font-size="8" font-weight="800" fill="#39ff14" letter-spacing="1">CUARTOS</text>
                        <text x="${COL_L3 + BW/2}" y="16" text-anchor="middle" font-family="system-ui" font-size="8" font-weight="800" fill="#ffd700" letter-spacing="1">SEMIS</text>
                        <text x="${COL_MID + BW/2}" y="16" text-anchor="middle" font-family="system-ui" font-size="8" font-weight="800" fill="#ffd700" letter-spacing="1">FINAL</text>
                        <text x="${COL_R3 + BW/2}" y="16" text-anchor="middle" font-family="system-ui" font-size="8" font-weight="800" fill="#ffd700" letter-spacing="1">SEMIS</text>
                        <text x="${COL_R2 + BW/2}" y="16" text-anchor="middle" font-family="system-ui" font-size="8" font-weight="800" fill="#39ff14" letter-spacing="1">CUARTOS</text>
                        <text x="${COL_R1 + BW/2}" y="16" text-anchor="middle" font-family="system-ui" font-size="8" font-weight="800" fill="#6CABDD" letter-spacing="1">OCTAVOS</text>
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
        const CF_WORKER = 'https://elfulbo.solgoyhe.workers.dev';

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
        const CF_WORKER  = 'https://elfulbo.solgoyhe.workers.dev';
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
                    style="flex-shrink:0; padding: 10px 18px; border-radius: 20px; border: 2px solid ${i === 0 ? 'var(--accent-neon)' : 'var(--border-glass)'}; background: ${i === 0 ? 'rgba(57,255,20,0.12)' : 'rgba(255,255,255,0.04)'}; color: ${i === 0 ? 'var(--accent-neon)' : 'var(--text-muted)'}; cursor: pointer; font-family: var(--font-heading); font-weight: 700; font-size: 0.9rem; white-space: nowrap; transition: all 0.2s;">
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
                                    <span style="width:22px; height:22px; border-radius:50%; background:${p.jugado ? `rgba(${esGanado?'57,255,20':esPerdido?'255,71,87':'240,165,0'},0.15)` : 'rgba(255,255,255,0.06)'};
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
                chip.style.background = i === idx ? 'rgba(57,255,20,0.12)' : 'rgba(255,255,255,0.04)';
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
                    item.style.background = 'rgba(57,255,20,0.12)';
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
        const CF_WORKER = 'https://elfulbo.solgoyhe.workers.dev';

        // Días del Mundial fase de grupos (UTC-3 Argentina)
        const DIAS_MUNDIAL = [];
        for (let d = 11; d <= 27; d++) {
            const fecha = `202606${String(d).padStart(2, '0')}`;
            const label = new Date(`2026-06-${String(d).padStart(2, '0')}T12:00:00-03:00`)
                .toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric', month: 'short' });
            DIAS_MUNDIAL.push({ fecha, label });
        }

        // Día actual en Argentina (UTC-3)
        const hoyAR = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Argentina/Buenos_Aires' }));
        const hoyStr = `${hoyAR.getFullYear()}${String(hoyAR.getMonth()+1).padStart(2,'0')}${String(hoyAR.getDate()).padStart(2,'0')}`;
        const diaDefault = DIAS_MUNDIAL.find(d => d.fecha === hoyStr) ?? DIAS_MUNDIAL[0];

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
                                    background: ${d.fecha === diaDefault.fecha ? 'rgba(57,255,20,0.12)' : 'rgba(255,255,255,0.04)'};
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
            if (titulares.length === 0) return '<p style="color:var(--text-muted); text-align:center; font-size:0.8rem; padding:0.5rem;">Sin titulares confirmados.</p>';

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
                btn.style.background = activo ? 'rgba(57,255,20,0.12)' : 'rgba(255,255,255,0.04)';
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
        const CF_WORKER = 'https://elfulbo.solgoyhe.workers.dev';

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
    const renderLanding = () => {
        appContainer.innerHTML = `
            <main style="min-height:100vh; background:var(--bg-color); overflow-y:auto;">

                <!-- Hero -->
                <div style="display:flex; flex-direction:column; align-items:center; justify-content:center;
                    padding: 5rem 1.5rem 3rem; text-align:center;">
                    <div style="font-family:var(--font-heading); font-size:clamp(3rem,10vw,5.5rem);
                        font-weight:900; letter-spacing:4px; text-shadow:0 0 40px rgba(57,255,20,0.3); margin-bottom:0.5rem;">
                        <span style="color:var(--accent-neon);">WHISTLE</span>
                    </div>
                    <p style="font-size:clamp(0.95rem,2.5vw,1.1rem); color:var(--text-muted); margin-bottom:2.5rem; max-width:480px; line-height:1.6; text-align:center;">
                        The sound of sport.
                    </p>
                    <div style="display:flex; gap:1rem; flex-wrap:wrap; justify-content:center; margin-bottom:4rem;">
                        <button onclick="abrirAuth('registro')"
                            style="padding:14px 32px; background:var(--accent-neon); color:#000; font-weight:900;
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
                            <span style="background:rgba(57,255,20,0.15); color:var(--accent-neon);
                                padding:1px 7px; border-radius:10px; font-size:0.68rem; font-weight:800; margin-left:4px;">
                                -33%
                            </span>
                        </span>
                    </div>

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
                                {t:'Noticias básicas', ok:true},
                                {t:'1 liga a elección', ok:true},
                                {t:'Todas las ligas', ok:false},
                                {t:'Estadísticas y alineaciones', ok:false},
                                {t:'Noticias traducidas', ok:false},
                                {t:'Todos los deportes', ok:false},
                            ].map(f => `
                                <div style="display:flex; align-items:center; gap:8px; font-size:0.8rem;
                                    margin-bottom:7px; color:${f.ok ? 'var(--text-main)' : 'var(--text-muted)'};">
                                    <span>${f.ok ? '✅' : '🔒'}</span><span>${f.t}</span>
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
                            border-color:var(--accent-neon); background:rgba(57,255,20,0.04); position:relative;">
                            <div style="position:absolute; top:-12px; left:50%; transform:translateX(-50%);
                                background:var(--accent-neon); color:#000; font-size:0.65rem; font-weight:800;
                                padding:3px 14px; border-radius:20px; font-family:var(--font-heading); letter-spacing:1px; white-space:nowrap;">
                                MÁS POPULAR
                            </div>
                            <div style="font-size:1.8rem; margin-bottom:0.5rem;">🎟️</div>
                            <div style="font-family:var(--font-heading); font-size:1.3rem; font-weight:900;
                                color:var(--accent-neon); margin-bottom:0.3rem;">Platea</div>
                            <div id="precio-pro" style="font-family:var(--font-heading); font-size:1.8rem;
                                font-weight:900; color:var(--accent-neon); margin-bottom:0.8rem;">
                                $4.99<span style="font-size:0.85rem; color:var(--text-muted);">/mes</span>
                            </div>
                            <p style="font-size:0.78rem; color:var(--text-muted); line-height:1.5; margin-bottom:1.2rem;">
                                Todas las ligas de fútbol, estadísticas completas, alineaciones tácticas y noticias traducidas. Viví el fútbol desde la Platea.
                            </p>
                            ${[
                                {t:'Todo lo de Popular', ok:true},
                                {t:'Todas las ligas de fútbol', ok:true},
                                {t:'Estadísticas del partido', ok:true},
                                {t:'Alineaciones tácticas', ok:true},
                                {t:'Noticias traducidas', ok:true},
                                {t:'Equipo favorito', ok:true},
                                {t:'Todos los deportes', ok:false},
                                {t:'Notificaciones en vivo', ok:false},
                            ].map(f => `
                                <div style="display:flex; align-items:center; gap:8px; font-size:0.8rem;
                                    margin-bottom:7px; color:${f.ok ? 'var(--text-main)' : 'var(--text-muted)'};">
                                    <span>${f.ok ? '✅' : '🔒'}</span><span>${f.t}</span>
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
                                $14.99<span style="font-size:0.85rem; color:var(--text-muted);">/mes</span>
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
    };

    // ── PERFIL ────────────────────────────────────────────────────────────────
    const renderPerfil = async () => {
        const user   = window.FirebaseAuth?.getUser();
        const perfil = window.FirebaseAuth?.getPerfil();
        const plan   = window.FirebaseAuth?.getPlan() ?? 'free';

        appContainer.innerHTML = `
            ${renderNavbar('#/perfil')}
            <main class="page-container fade-in" style="max-width:600px; margin:0 auto;">
                <h2 class="section-title">👤 Mi Perfil</h2>

                <!-- Info del usuario -->
                <div class="glass-panel" style="padding:1.5rem; margin-bottom:1.5rem;">
                    <div style="display:flex; align-items:center; gap:1.2rem; margin-bottom:1.2rem;">
                        <div style="width:60px; height:60px; border-radius:50%; background:rgba(57,255,20,0.15);
                            border:2px solid var(--accent-neon); display:flex; align-items:center;
                            justify-content:center; font-size:1.5rem; font-weight:800; font-family:var(--font-heading);">
                            ${(perfil?.nombre ?? 'U').charAt(0).toUpperCase()}
                        </div>
                        <div>
                            <div style="font-weight:800; font-size:1.1rem;">${perfil?.nombre ?? 'Usuario'}</div>
                            <div style="color:var(--text-muted); font-size:0.85rem;">${user?.email ?? ''}</div>
                            <div style="margin-top:4px;">
                                <span style="background:${plan === 'premium' ? 'rgba(255,215,0,0.15)' : 'rgba(255,255,255,0.08)'};
                                    color:${plan === 'premium' ? '#ffd700' : 'var(--text-muted)'};
                                    padding:2px 10px; border-radius:20px; font-size:0.7rem; font-weight:800;
                                    font-family:var(--font-heading); letter-spacing:1px;">
                                    ${plan.toUpperCase()}
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
                        padding:10px; font-size:0.9rem; cursor:pointer; margin-bottom:1rem;
                        color-scheme:dark;">
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
                            <div style="font-family:var(--font-heading); font-size:1.2rem; font-weight:800; color:#39ff14;">Platea activo</div>
                            <button class="btn-primary" style="margin-top:1rem; background:#ffd700; color:#000;"
                                onclick="window.location.hash='#/planes'">
                                PASARTE A PALCO 👑
                            </button>
                        </div>
                    ` : `
                        <p style="color:var(--text-muted); font-size:0.9rem; margin-bottom:1rem;">
                            Estás en el plan <strong>Popular</strong>. Pasate a Platea para acceder a estadísticas, alineaciones, todas las ligas y más.
                        </p>
                        <button class="btn-primary" style="background:#39ff14; color:#000;" onclick="window.location.hash='#/planes'">
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
                    ${actual ? '<div style="position:absolute; top:-12px; left:50%; transform:translateX(-50%); background:var(--accent-neon); color:#000; font-size:0.65rem; font-weight:800; padding:3px 14px; border-radius:20px; font-family:var(--font-heading); letter-spacing:1px; white-space:nowrap;">PLAN ACTUAL</div>' : ''}
                    <div style="font-size:1.5rem; margin-bottom:0.4rem;">${p.emoji ?? ''}</div>
                    <div style="font-family:var(--font-heading); font-size:1.2rem; font-weight:900; color:${meta.color}; margin-bottom:0.2rem;">${p.nombre ?? planKey}</div>
                    <div style="font-family:var(--font-heading); font-size:1.6rem; font-weight:900; color:${meta.color}; margin-bottom:0.8rem;">
                        ${p.precio ?? 'Gratis'}${planKey !== 'free' ? '<span style="font-size:0.8rem; color:var(--text-muted);">/mes</span>' : ''}
                    </div>
                    ${(p.features ?? []).map(f => `<div style="display:flex; align-items:center; gap:8px; font-size:0.8rem; margin-bottom:6px; color:${f.ok ? 'var(--text-main)' : 'var(--text-muted)'};">
                        <span>${f.ok ? '✅' : '🔒'}</span><span>${f.texto}</span></div>`).join('')}
                    ${!actual ? `<button class="btn-primary" style="width:100%; margin-top:1.2rem; background:${meta.color}; color:#000;" onclick="window._suscribirse('${planKey}_mensual')">SUSCRIBIRME</button>` : ''}
                </div>`;
        };
        appContainer.innerHTML = `
            ${renderNavbar('#/planes')}
            <main class="page-container fade-in" style="max-width:900px; margin:0 auto;">
                <h2 class="section-title">💳 Planes</h2>
                <div style="display:grid; grid-template-columns:repeat(auto-fit,minmax(220px,1fr)); gap:1.5rem; margin-bottom:4rem;">
                    ${_card('free',   { color: '#888'    })}
                    ${_card('pro',    { color: '#39ff14' })}
                    ${_card('promax', { color: '#ffd700' })}
                </div>
            </main>
        ${_closeSidebarWrapper()}
        `;
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
            {id:'uefa.cl',     nombre:'Champions League',    flag:'⭐'},
            {id:'uefa.el',     nombre:'Europa League',       flag:'🟠'},
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
                            style="flex:2; padding:12px; background:var(--accent-neon); color:#000;
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
                        background:${_datos.equipoFavorito?.id === e.id ? 'rgba(57,255,20,0.1)' : 'rgba(255,255,255,0.03)'};
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
                        background:${_datos.pais?.id === p.id ? 'rgba(57,255,20,0.1)' : 'rgba(255,255,255,0.03)'};
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
                            background:${_datos.ligaNacional?.id === l.id ? 'rgba(57,255,20,0.1)' : 'rgba(255,255,255,0.03)'};
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
                        background:${_datos.ligaInternacional?.id === l.id ? 'rgba(57,255,20,0.1)' : 'rgba(255,255,255,0.03)'};
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
                const bg       = sel ? 'rgba(57,255,20,0.1)' : 'rgba(255,255,255,0.03)';
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
            id: 'racing', nombre: 'Fórmula 1', emoji: '🏎️',
            ligas: [
                {id:'f1', nombre:'Formula 1', slug:'racing/f1'},
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
                {id:'rugby-union', nombre:'Rugby Union', slug:'rugby-union/international'},
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
        {id:'figure-skating',nombre:'Patín sobre Hielo',emoji:'⛸️', proximamente:true},
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
        const CF_WORKER = 'https://elfulbo.solgoyhe.workers.dev';

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
                                background:${d.id === deporteActual?.id ? 'rgba(57,255,20,0.12)' : 'rgba(255,255,255,0.04)'};
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
                            background:${l.id === ligaActual?.id ? 'rgba(57,255,20,0.1)' : 'transparent'};
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

        if (!deporteActual || !ligaActual) return;

        // Cargar scoreboard del deporte/liga
        try {
            const hoyAR = new Date(new Date().toLocaleString('en-US', {timeZone:'America/Argentina/Buenos_Aires'}));
            const fecha = `${hoyAR.getFullYear()}${String(hoyAR.getMonth()+1).padStart(2,'0')}${String(hoyAR.getDate()).padStart(2,'0')}`;

            const url = `https://site.api.espn.com/apis/site/v2/sports/${ligaActual.slug}/scoreboard?dates=${fecha}`;
            const res = await fetch(`${CF_WORKER}/?url=${encodeURIComponent(url)}`);
            const data = res.ok ? await res.json() : {};
            const eventos = data.events ?? [];

            const container = document.getElementById('other-sports-content');
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
    const renderPartido = async (eventId, ligaId) => {
        const CF_WORKER  = 'https://elfulbo.solgoyhe.workers.dev';
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
            const clock    = comp.status?.displayClock ?? '';
            const periodo  = comp.status?.period ?? '';
            const shortDet = comp.status?.type?.shortDetail ?? '';

            const homeName  = home.team?.displayName ?? '?';
            const awayName  = away.team?.displayName ?? '?';
            const homeLogo  = home.team?.logo ?? '';
            const awayLogo  = away.team?.logo ?? '';
            const homeScore = home.score ?? '-';
            const awayScore = away.score ?? '-';
            const homeWin   = esPost && parseInt(homeScore) > parseInt(awayScore);
            const awayWin   = esPost && parseInt(awayScore) > parseInt(homeScore);

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
                if (titulares.length === 0) return '<p style="color:var(--text-muted); text-align:center; font-size:0.8rem;">Sin titulares.</p>';
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
                          `<div style="background:rgba(57,255,20,0.12); display:inline-block; padding:3px 14px; border-radius:20px; font-size:0.7rem; font-weight:700; color:var(--accent-neon); margin-bottom:0.8rem;">${shortDet || 'PRÓXIMO'}</div>`}

                        <div style="display:grid; grid-template-columns:1fr auto 1fr; align-items:center; gap:1rem;">
                            <div>
                                ${homeLogo ? `<img src="${homeLogo}" width="56" height="56" style="object-fit:contain; margin-bottom:8px; display:block; margin-left:auto; margin-right:auto;" onerror="this.style.display='none'">` : ''}
                                <div style="font-family:var(--font-heading); font-weight:800; font-size:1rem; ${homeWin ? 'color:var(--accent-neon);' : ''}">${homeName}</div>
                            </div>
                            <div style="font-family:var(--font-heading); font-size:${(esPost||esLive)?'3rem':'1.5rem'}; font-weight:900; color:var(--text-main); min-width:100px; text-align:center;">
                                ${(esPost||esLive) ? `${homeScore} - ${awayScore}` : 'vs'}
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

                    ${(boxTeamHome || boxTeamAway) ? `
                    <!-- STATS -->
                    <div class="glass-panel" style="padding:1.5rem; margin-bottom:1.5rem;">
                        <h3 class="panel-title" style="text-align:center; color:var(--accent-neon); font-size:0.75rem; letter-spacing:2px;">ESTADÍSTICAS</h3>
                        ${esPro ? `
                            ${_statBar(getStat(boxTeamHome,'possessionPct'), getStat(boxTeamAway,'possessionPct'), 'POSESIÓN %')}
                            ${_statBar(getStat(boxTeamHome,'totalShots'), getStat(boxTeamAway,'totalShots'), 'TIROS TOTALES')}
                            ${_statBar(getStat(boxTeamHome,'shotsOnTarget'), getStat(boxTeamAway,'shotsOnTarget'), 'TIROS A PUERTA')}
                            ${_statBar(getStat(boxTeamHome,'wonCorners'), getStat(boxTeamAway,'wonCorners'), 'CORNERS')}
                            ${_statBar(getStat(boxTeamHome,'foulsCommitted'), getStat(boxTeamAway,'foulsCommitted'), 'FALTAS')}
                            ${_statBar(getStat(boxTeamHome,'yellowCards'), getStat(boxTeamAway,'yellowCards'), 'AMARILLAS')}
                        ` : _paywallInline('pro', 'Las estadísticas completas están disponibles en el plan Platea.')}
                    </div>` : ''}

                    ${(rosterHome || rosterAway) ? `
                    <!-- ALINEACIONES -->
                    <div class="glass-panel" style="padding:1.5rem; margin-bottom:1.5rem;">
                        <h3 class="panel-title" style="text-align:center; color:var(--accent-neon); font-size:0.75rem; letter-spacing:2px; margin-bottom:1rem;">ALINEACIONES</h3>
                        ${esPro ? `
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
                        </div>` : _paywallInline('pro', 'Las alineaciones tácticas están disponibles en el plan Platea.')}
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

            // Auto-refresh si está en vivo
            if (esLive) {
                if (window._partidoRefreshInterval) clearInterval(window._partidoRefreshInterval);
                window._partidoRefreshInterval = setInterval(async () => {
                    if (!document.querySelector('.page-container')) { clearInterval(window._partidoRefreshInterval); return; }
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
    const CF_WORKER = 'https://elfulbo.solgoyhe.workers.dev';

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
                    successUrl: 'https://solgoyhe-gif.github.io/elfulbo/#/perfil?pago=ok',
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
