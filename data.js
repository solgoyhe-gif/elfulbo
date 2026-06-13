// js/data.js - Base de Datos Estática y Motor de Red (API en Cascada)

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
            { id: "liga_prof",    nombre: "Liga Profesional",    pais: "Argentina", flag: "🇦🇷", badge_color: "#4395d1" },
            { id: "copa_liga",    nombre: "Copa de la Liga",     pais: "Argentina", flag: "🇦🇷", badge_color: "#1c355e" }
        ]
    }
};

// ── MOTOR DE RED (CASCADA DE APIS) ───────────────────────────────────────────
const ApiService = (() => {
    // Endpoints Estratégicos
    const URL_PRIMARY = 'https://api.worldcup26.ir/api/v1/matches'; // (Base referencial sin CORS issues)
    const URL_FALLBACK = 'https://site.api.espn.com/apis/site/v2/sports/soccer/all/scoreboard';

    // Fetch con límite de tiempo. Si un server no responde en X segundos, aborta y pasa al siguiente.
    const fetchWithTimeout = async (url, options = {}, timeout = 5000) => {
        const controller = new AbortController();
        const id = setTimeout(() => controller.abort(), timeout);
        try {
            const response = await fetch(url, { ...options, signal: controller.signal });
            clearTimeout(id);
            return response;
        } catch (error) {
            clearTimeout(id);
            throw error;
        }
    };

    const getPartidos = async () => {
        try {
            // 1. INTENTO PRIMARIO: worldcup26.ir
            console.log('📡 [API] Buscando en fuente primaria (worldcup26.ir)...');
            const res = await fetchWithTimeout(URL_PRIMARY, {}, 4000);
            
            if (!res.ok) throw new Error(`HTTP Error: ${res.status}`);
            const data = await res.json();
            return normalizeWorldCupData(data);

        } catch (errorPrimario) {
            console.warn('⚠️ [API] Fuente primaria caída o bloqueada. Iniciando CASCADA a ESPN...', errorPrimario.message);
            
            try {
                // 2. INTENTO SECUNDARIO (FALLBACK): ESPN API
                console.log('📡 [API] Buscando en fuente de respaldo (ESPN)...');
                const resESPN = await fetchWithTimeout(URL_FALLBACK, {}, 5000);
                
                if (!resESPN.ok) throw new Error(`HTTP Error: ${resESPN.status}`);
                const dataESPN = await resESPN.json();
                return normalizeEspnData(dataESPN);

            } catch (errorSecundario) {
                console.error('❌ [API] Ambas fuentes caídas (Fallo de Red Local). Usando Mock de emergencia.', errorSecundario.message);
                return getEmergencyMock();
            }
        }
    };

    // Formateadores: Las distintas APIs devuelven estructuras diferentes (JSON). 
    // Estas funciones las homogeneizan para que nuestra UI no se rompa nunca.
    
    const normalizeWorldCupData = (data) => {
        console.log("✅ [API] Datos de WorldCup cargados con éxito.");
        // Ajustamos al formato que suele devolver este endpoint
        const matches = data.data || data.matches || []; 
        return matches.map(m => ({
            id: m.id || Math.random(),
            equipoLocal: m.home_team?.name || m.home_team_en || 'Local',
            golesLocal: m.home_score !== null ? m.home_score : '-',
            escudoLocal: m.home_team?.logo || m.home_flag || '🛡️',
            equipoVisita: m.away_team?.name || m.away_team_en || 'Visita',
            golesVisita: m.away_score !== null ? m.away_score : '-',
            escudoVisita: m.away_team?.logo || m.away_flag || '🛡️',
            estado: m.time || m.status || 'Finalizado'
        }));
    };

    const normalizeEspnData = (data) => {
        console.log("✅ [API] Fallback de ESPN cargado con éxito.");
        if (!data.events) return [];
        
        return data.events.map(evento => {
            const competicion = evento.competitions[0];
            const local = competicion.competitors.find(c => c.homeAway === 'home');
            const visita = competicion.competitors.find(c => c.homeAway === 'away');
            
            return {
                id: evento.id,
                fecha: evento.date,
                estado: evento.status.type.description,
                equipoLocal: local.team.name,
                golesLocal: local.score !== undefined ? local.score : '-',
                escudoLocal: local.team.logo || '🛡️',
                equipoVisita: visita.team.name,
                golesVisita: visita.score !== undefined ? visita.score : '-',
                escudoVisita: visita.team.logo || '🛡️'
            };
        });
    };

    const getEmergencyMock = () => {
        return [
            { equipoLocal: "Offline", golesLocal: "-", equipoVisita: "Revisa tu red", golesVisita: "-", estado: "Error de Red", escudoLocal: '⚠️', escudoVisita: '⚠️' }
        ];
    };

    return { getPartidos };
})();
