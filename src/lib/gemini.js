/**
 * Cliente del asistente de viajes.
 *
 * En local llama a `/api/gemini` (middleware de Vite). En el sitio publicado en
 * S3 apunta al backend desplegado mediante `VITE_AI_ENDPOINT`, de modo que la
 * API key de Gemini se quede siempre en el servidor.
 *
 * Si el servicio no responde, y `VITE_AI_FALLBACK` no está en `off`, se usan
 * recomendaciones de demostración (marcadas como tales en la interfaz).
 */
import { generarSugerenciasMock } from './mockIA.js';

// El encadenamiento opcional permite importar este módulo desde las pruebas
// de Node, donde `import.meta.env` no existe (en Vite sí está siempre presente).
const ENDPOINT = import.meta.env?.VITE_AI_ENDPOINT || '/api/gemini';
const USAR_MOCK = import.meta.env?.VITE_AI_FALLBACK !== 'off';

/**
 * Permite forzar el caso de error controlado en la demo: añade `?simularFallo=1`
 * a la URL y el cliente se comporta como si el servicio estuviera caído.
 */
export function falloSimuladoActivo() {
  if (typeof window === 'undefined') return false;
  const parametros = new URLSearchParams(window.location.search);
  return parametros.get('simularFallo') === '1';
}

function normalizarRespuesta(data) {
  const sugerencias = Array.isArray(data?.sugerencias)
    ? data.sugerencias
        .filter((sugerencia) => sugerencia && typeof sugerencia.nombre === 'string')
        .map((sugerencia) => ({
          destinoId: Number.isFinite(Number(sugerencia.destinoId)) ? Number(sugerencia.destinoId) : 0,
          nombre: sugerencia.nombre,
          region: typeof sugerencia.region === 'string' ? sugerencia.region : 'Otro',
          motivo: typeof sugerencia.motivo === 'string' ? sugerencia.motivo : '',
          diasSugeridos: Number(sugerencia.diasSugeridos) || 3,
          precioEstimado: Number(sugerencia.precioEstimado) || 0,
        }))
        .slice(0, 2)
    : [];

  const preguntasSugeridas = Array.isArray(data?.preguntasSugeridas)
    ? data.preguntasSugeridas.filter((pregunta) => typeof pregunta === 'string').slice(0, 3)
    : [];

  return {
    mensaje:
      typeof data?.mensaje === 'string' && data.mensaje.trim()
        ? data.mensaje.trim()
        : 'Estos son los lugares que mejor encajan con lo que buscas.',
    sugerencias,
    preguntasSugeridas,
    modoDemo: false,
    aviso: '',
  };
}

async function pedirAlServicio(mensajes, signal) {
  let response;

  try {
    response = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mensajes }),
      signal,
    });
  } catch (error) {
    if (error?.name === 'AbortError') throw error;
    throw new Error('No pudimos conectar con el asistente. Revisa tu conexión e intenta de nuevo.', {
      cause: error,
    });
  }

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(
      data?.error || 'El asistente no está disponible en este momento. Intenta de nuevo.',
    );
  }

  if (!data || typeof data !== 'object') {
    throw new Error('El asistente devolvió una respuesta vacía. Intenta de nuevo.');
  }

  return normalizarRespuesta(data);
}

/**
 * @param {Array<{role: 'user'|'assistant', content: string}>} mensajes
 * @param {{ signal?: AbortSignal }} opciones
 */
export async function solicitarSugerencias(mensajes, { signal } = {}) {
  if (falloSimuladoActivo()) {
    throw new Error(
      'No pudimos conectar con el asistente de viajes. Revisa tu conexión e intenta de nuevo. (Fallo simulado para la demostración)',
    );
  }

  try {
    return await pedirAlServicio(mensajes, signal);
  } catch (error) {
    if (error?.name === 'AbortError') throw error;
    if (!USAR_MOCK) throw error;
    return generarSugerenciasMock(mensajes, error?.message);
  }
}
