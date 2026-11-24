/**
 * Cliente del asistente de viajes.
 * Habla con /api/gemini (proxy serverless) para que la API key de Gemini
 * se quede en el servidor.
 */

const ENDPOINT = '/api/gemini';

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
        .slice(0, 4)
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
  };
}

/**
 * @param {Array<{role: 'user'|'assistant', content: string}>} mensajes
 * @param {{ signal?: AbortSignal }} opciones
 */
export async function solicitarSugerencias(mensajes, { signal } = {}) {
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
