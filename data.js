// data.js — El Fulbo
// Base de datos estática de competiciones.
// Los slugs ESPN de cada liga están centralizados en espn.js/SLUG_MAP.

const LIGAS = {
    europa_top5: {
        nombre: "Europa Top 5",
        competiciones: [
            { id: "premier",    nombre: "Premier League",   pais: "Inglaterra", flag: "🏴󠁧󠁢󠁥󠁮󠁧󠁿", badge_color: "#3d195b" },
            { id: "bundesliga", nombre: "Bundesliga",       pais: "Alemania",   flag: "🇩🇪", badge_color: "#d3010c" },
            { id: "serie_a",    nombre: "Serie A",          pais: "Italia",     flag: "🇮🇹", badge_color: "#00529f" },
            { id: "ligue1",     nombre: "Ligue 1",          pais: "Francia",    flag: "🇫🇷", badge_color: "#003189" },
            { id: "laliga",     nombre: "La Liga",          pais: "España",     flag: "🇪🇸", badge_color: "#ee8707" }
        ]
    },
    europa_otras: {
        nombre: "Europa Otras",
        competiciones: [
            { id: "eredivisie", nombre: "Eredivisie",       pais: "Países Bajos", flag: "🇳🇱", badge_color: "#f76a1c" },
            { id: "primera",    nombre: "Primeira Liga",    pais: "Portugal",     flag: "🇵🇹", badge_color: "#006600" }
        ]
    },
    copas_inglesas: {
        nombre: "Copas Nacionales",
        competiciones: [
            { id: "fa_cup",  nombre: "FA Cup",  pais: "Inglaterra", flag: "🏴󠁧󠁢󠁥󠁮󠁧󠁿", badge_color: "#e2001a" },
            { id: "efl_cup", nombre: "EFL Cup", pais: "Inglaterra", flag: "🏴󠁧󠁢󠁥󠁮󠁧󠁿", badge_color: "#008752" }
        ]
    },
    internacionales: {
        nombre: "Copas Internacionales",
        competiciones: [
            { id: "champions",     nombre: "Champions League",  pais: "Europa", flag: "🌍", badge_color: "#001489" },
            { id: "europa_league", nombre: "Europa League",     pais: "Europa", flag: "🌍", badge_color: "#f7931e" },
            { id: "conference",    nombre: "Conference League", pais: "Europa", flag: "🌍", badge_color: "#00a94f" },
            { id: "supercup_uefa", nombre: "UEFA Super Cup",    pais: "Europa", flag: "🌍", badge_color: "#003399" }
        ]
    },
    mundiales: {
        nombre: "Mundiales",
        competiciones: [
            { id: "world_cup",    nombre: "FIFA World Cup",        pais: "Mundial", flag: "🌐", badge_color: "#c8a84b" },
            { id: "amistosos_wc", nombre: "Amistosos Pre-Mundial", pais: "Mundial", flag: "🌐", badge_color: "#555555" }
        ]
    },
    sudamerica: {
        nombre: "Sudamérica",
        competiciones: [
            { id: "libertadores", nombre: "Copa Libertadores",   pais: "CONMEBOL", flag: "🌎", badge_color: "#f5d000" },
            { id: "sudamericana", nombre: "Copa Sudamericana",   pais: "CONMEBOL", flag: "🌎", badge_color: "#f5a623" }
        ]
    },
    argentina: {
        nombre: "Argentina",
        competiciones: [
            { id: "liga_prof",     nombre: "Liga Profesional", pais: "Argentina", flag: "🇦🇷", badge_color: "#4395d1" },
            { id: "copa_liga",     nombre: "Copa de la Liga",  pais: "Argentina", flag: "🇦🇷", badge_color: "#1c355e" },
            { id: "copa_argentina",nombre: "Copa Argentina",   pais: "Argentina", flag: "🇦🇷", badge_color: "#75aadb" },
        ]
    },

    // ── LIGAS OCULTAS — visible solo para admin hasta que estén verificadas ────
    // Para activar al público: quitar hidden: true
    sudamerica_extra: {
        nombre: "Sudamérica",
        hidden: true,
        competiciones: [
            { id: "copa_america", nombre: "Copa América",          pais: "CONMEBOL", flag: "🌎", badge_color: "#00843d" },
            { id: "recopa",       nombre: "Recopa Sudamericana",   pais: "CONMEBOL", flag: "🌎", badge_color: "#c8a84b" },
        ]
    },
    concacaf: {
        nombre: "CONCACAF",
        hidden: true,
        competiciones: [
            { id: "concacaf_champions", nombre: "Concacaf Champions Cup", pais: "CONCACAF", flag: "🌎", badge_color: "#003f87" },
            { id: "concacaf_nations",   nombre: "Nations League",         pais: "CONCACAF", flag: "🌎", badge_color: "#00b4d8" },
        ]
    },
    europa_extra: {
        nombre: "Europa",
        hidden: true,
        competiciones: [
            { id: "eurocopa", nombre: "Eurocopa", pais: "Europa", flag: "🇪🇺", badge_color: "#003399" },
        ]
    },
    ligas_extra: {
        nombre: "Ligas del Mundo",
        hidden: true,
        competiciones: [
            { id: "brasileirao", nombre: "Brasileirão Serie A", pais: "Brasil",         flag: "🇧🇷", badge_color: "#009c3b" },
            { id: "mls",         nombre: "MLS",                 pais: "Estados Unidos", flag: "🇺🇸", badge_color: "#1a1a2e" },
            { id: "liga_arabe",  nombre: "Liga Árabe (UAE)",    pais: "Emiratos",       flag: "🇦🇪", badge_color: "#cc0001" },
        ]
    },
};
