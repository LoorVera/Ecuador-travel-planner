/**
 * Recomendaciones de demostración.
 *
 * Se usan SOLO cuando el servicio de IA no responde (por ejemplo, un sitio
 * estático sin backend o una caída de red) para que la interfaz no se rompa.
 * No sustituyen a Gemini: la interfaz marca estas respuestas como "modo
 * demostración" y explica que se generaron con el catálogo local.
 */
import { DESTINOS_ECUADOR } from '../data/destinos.js';

const GRUPOS = [
  {
    region: 'Costa',
    claves: ['playa', 'surf', 'mar', 'costa', 'ballena', 'calor', 'verano'],
  },
  {
    region: 'Amazonía',
    claves: ['amazonia', 'selva', 'jungla', 'fauna', 'aves', 'rio', 'rafting', 'aventura'],
  },
  {
    region: 'Sierra',
    claves: ['sierra', 'montana', 'andes', 'cultura', 'historia', 'colonial', 'termal', 'frio'],
  },
];

const normalizar = (texto) =>
  String(texto)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

function elegirDestinos(consulta) {
  const puntajes = GRUPOS.map(({ region, claves }) => {
    const puntos = claves.reduce(
      (total, clave) => (consulta.includes(clave) ? total + 1 : total),
      0,
    );
    return { region, puntos };
  });

  const conSenal = puntajes.filter(({ puntos }) => puntos > 0);
  const regiones = conSenal.length
    ? conSenal.sort((a, b) => b.puntos - a.puntos).map(({ region }) => region)
    : ['Sierra', 'Costa', 'Amazonía'];

  const presupuestoAjustado = /barat|economic|presupuesto|nino|nina|familia/.test(consulta);
  const candidatos = DESTINOS_ECUADOR.filter((destino) => regiones.includes(destino.region));

  return [...candidatos]
    .sort((a, b) => (presupuestoAjustado ? a.precioBase - b.precioBase : a.id - b.id))
    .slice(0, 3);
}

/**
 * @param {Array<{role: 'user'|'assistant', content: string}>} mensajes
 * @param {string} [aviso] Motivo por el que se usa el modo demostración.
 */
export function generarSugerenciasMock(mensajes = [], aviso = '') {
  const consulta = normalizar(
    (Array.isArray(mensajes) ? mensajes : [])
      .filter((mensaje) => mensaje?.role === 'user' && typeof mensaje.content === 'string')
      .map((mensaje) => mensaje.content)
      .join(' '),
  );

  const sugerencias = elegirDestinos(consulta).map((destino) => ({
    destinoId: destino.id,
    nombre: destino.nombre,
    region: destino.region,
    motivo: destino.descripcion,
    diasSugeridos: destino.precioBase > 250 ? 5 : 3,
    precioEstimado: destino.precioBase,
  }));

  return {
    mensaje:
      'Estas son recomendaciones de demostración: el servicio de IA no respondió, así que las generé con el catálogo local de destinos.',
    sugerencias,
    preguntasSugeridas: [
      '¿Qué destino recomiendas para 5 días?',
      '¿Cuál es la mejor época para viajar?',
    ],
    modoDemo: true,
    aviso:
      aviso ||
      'No se pudo contactar con el servicio de IA. Se muestran recomendaciones de demostración.',
  };
}
