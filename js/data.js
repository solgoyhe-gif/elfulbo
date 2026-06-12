// js/data.js - Mock Database

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
            { id: "primeira",   nombre: "Primeira Liga",    pais: "Portugal",     flag: "🇵🇹", badge_color: "#006600" }
        ]
    },
    copas_inglesas: {
        nombre: "Copas Inglesas",
        competiciones: [
            { id: "efl_cup",    nombre: "EFL Cup (Carabao Cup)", pais: "Inglaterra", flag: "🏴󠁧󠁢󠁥󠁮󠁧󠁿", badge_color: "#00a650" },
            { id: "fa_cup",     nombre: "FA Cup",                pais: "Inglaterra", flag: "🏴󠁧󠁢󠁥󠁮󠁧󠁿", badge_color: "#d4af37" }
        ]
    },
    uefa: {
        nombre: "UEFA",
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
            { id: "liga_prof",    nombre: "Liga Profesional", pais: "Argentina", flag: "🇦🇷", badge_color: "#74acdf" },
            { id: "copa_arg",     nombre: "Copa Argentina",   pais: "Argentina", flag: "🇦🇷", badge_color: "#f5f5f5" }
        ]
    },
    brasil: {
        nombre: "Brasil",
        competiciones: [
            { id: "brasileirao",  nombre: "Brasileirao", pais: "Brasil", flag: "🇧🇷", badge_color: "#009c3b" }
        ]
    }
};

// Equipos Mock distribuidos en distintas ligas
const EQUIPOS_DB = [
    { id: "mci", nombre: "Manchester City", liga_id: "premier" },
    { id: "ars", nombre: "Arsenal", liga_id: "premier" },
    { id: "rma", nombre: "Real Madrid", liga_id: "laliga" },
    { id: "bay", nombre: "Bayern Munich", liga_id: "bundesliga" },
    { id: "psg", nombre: "PSG", liga_id: "ligue1" },
    { id: "boc", nombre: "Boca Juniors", liga_id: "liga_prof" },
    { id: "fla", nombre: "Flamengo", liga_id: "brasileirao" }
];

// Partidos Mock con referencia a competiciones
const PARTIDOS_DB = [
    { id: "match1", local: "mci", visitante: "ars", competicion_id: "premier", fecha: "2026-06-15T15:00:00Z" },
    { id: "match2", local: "rma", visitante: "bay", competicion_id: "champions", fecha: "2026-06-16T20:00:00Z" },
    { id: "match3", local: "boc", visitante: "fla", competicion_id: "libertadores", fecha: "2026-06-18T21:30:00Z" }
];
