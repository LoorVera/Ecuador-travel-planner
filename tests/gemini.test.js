/**
 * Pruebas del núcleo de Gemini con `fetch` simulado: modelo vigente,
 * parámetros compatibles, respaldo ante 404 y traducción de errores.
 *
 * Ejecutar con: npm test
 */
import assert from 'node:assert/strict';
import test from 'node:test';

import { generarSugerencias, prepararContenido } from '../api/_gemini.js';

const MENSAJES = [{ role: 'user', content: 'Quiero playa y surf en Ecuador' }];
const CLAVE = 'clave-de-prueba';

const textoRespuesta = JSON.stringify({
  mensaje: 'Te recomiendo la costa ecuatoriana.',
  sugerencias: [
    {
      destinoId: 1,
      nombre: 'Baños de Agua Santa',
      region: 'Sierra',
      motivo: 'Tiene aguas termales y cataratas.',
      diasSugeridos: 3,
      precioEstimado: 180,
    },
  ],
  preguntasSugeridas: ['¿Cuál es la mejor época?'],
});

function respuestaValida() {
  return {
    ok: true,
    status: 200,
    json: async () => ({
      candidates: [{ content: { parts: [{ text: textoRespuesta }] } }],
    }),
  };
}

function respuestaConError(status) {
  return {
    ok: false,
    status,
    text: async () => JSON.stringify({ error: { message: `Error ${status}` } }),
  };
}

async function conFetch(fetchSimulado, accion) {
  const fetchOriginal = globalThis.fetch;
  const modeloOriginal = process.env.GEMINI_MODEL;
  const consolaOriginal = console.error;

  globalThis.fetch = fetchSimulado;
  console.error = () => {};
  try {
    return await accion();
  } finally {
    globalThis.fetch = fetchOriginal;
    process.env.GEMINI_MODEL = modeloOriginal;
    console.error = consolaOriginal;
  }
}

test('generarSugerencias usa un modelo vigente y una configuración compatible con Gemini 3', async () => {
  process.env.GEMINI_MODEL = 'gemini-3.5-flash-lite';
  const llamadas = [];

  const resultado = await conFetch(
    async (url, opciones) => {
      llamadas.push({ url, opciones });
      return respuestaValida();
    },
    () => generarSugerencias(MENSAJES, CLAVE),
  );

  assert.equal(llamadas.length, 1);
  const { url, opciones } = llamadas[0];
  assert.match(url, /\/models\/gemini-3\.5-flash-lite:generateContent$/);
  assert.ok(!url.includes('key='), 'la clave no debe viajar en la URL');
  assert.equal(opciones.headers['x-goog-api-key'], CLAVE);

  const cuerpo = JSON.parse(opciones.body);
  assert.equal(cuerpo.generationConfig.temperature, undefined);
  assert.equal(cuerpo.generationConfig.top_p, undefined);
  assert.equal(cuerpo.generationConfig.thinkingConfig.thinkingBudget, undefined);
  assert.equal(cuerpo.generationConfig.thinkingConfig.thinkingLevel, 'low');
  assert.ok(cuerpo.generationConfig.maxOutputTokens >= 2048);
  assert.ok(cuerpo.generationConfig.responseSchema);

  assert.equal(resultado.sugerencias.length, 1);
  assert.equal(resultado.sugerencias[0].nombre, 'Baños de Agua Santa');
  assert.equal(resultado.preguntasSugeridas.length, 1);
});

test('generarSugerencias prueba modelos de respaldo si el principal está retirado (404)', async () => {
  process.env.GEMINI_MODEL = 'modelo-retirado';
  const urls = [];

  const resultado = await conFetch(
    async (url) => {
      urls.push(url);
      return urls.length === 1 ? respuestaConError(404) : respuestaValida();
    },
    () => generarSugerencias(MENSAJES, CLAVE),
  );

  assert.equal(urls.length, 2);
  assert.match(urls[1], /\/models\/gemini-3\.8-flash:generateContent$/);
  assert.equal(resultado.sugerencias.length, 1);
});

test('generarSugerencias distingue errores de configuración, clave y saturación', async () => {
  await conFetch(async () => respuestaConError(400), async () => {
    await assert.rejects(() => generarSugerencias(MENSAJES, CLAVE), (error) => {
      assert.equal(error.status, 502);
      assert.match(error.message, /GEMINI_MODEL/);
      assert.doesNotMatch(error.message, /clave de Gemini no es válida/i);
      return true;
    });
  });

  await conFetch(async () => respuestaConError(401), async () => {
    await assert.rejects(() => generarSugerencias(MENSAJES, CLAVE), /GEMINI_API_KEY/);
  });

  await conFetch(async () => respuestaConError(429), async () => {
    await assert.rejects(() => generarSugerencias(MENSAJES, CLAVE), (error) => {
      assert.equal(error.status, 429);
      return true;
    });
  });

  await conFetch(async () => respuestaConError(503), async () => {
    await assert.rejects(() => generarSugerencias(MENSAJES, CLAVE), (error) => {
      assert.equal(error.status, 503);
      return true;
    });
  });
});

test('generarSugerencias rechaza respuestas que no son JSON', async () => {
  await conFetch(
    async () => ({
      ok: true,
      status: 200,
      json: async () => ({ candidates: [{ content: { parts: [{ text: 'no es json' }] } }] }),
    }),
    async () => {
      await assert.rejects(() => generarSugerencias(MENSAJES, CLAVE), (error) => {
        assert.equal(error.status, 502);
        assert.match(error.message, /formato inesperado/);
        return true;
      });
    },
  );
});

test('generarSugerencias valida la entrada y la clave antes de llamar a Gemini', async () => {
  let llamadas = 0;
  await conFetch(
    async () => {
      llamadas += 1;
      return respuestaValida();
    },
    async () => {
      await assert.rejects(() => generarSugerencias([], CLAVE), (error) => error.status === 400);
      await assert.rejects(() => generarSugerencias(MENSAJES, ''), (error) => error.status === 500);
    },
  );
  assert.equal(llamadas, 0);
});

test('prepararContenido conserva las respuestas del asistente cuando tienen content', () => {
  const contenido = prepararContenido([
    { role: 'user', content: '¿Qué hay en la costa?' },
    { role: 'assistant', content: 'Montañita tiene playa y surf.' },
    { role: 'user', content: '¿Y para 5 días?' },
  ]);

  assert.equal(contenido.length, 3);
  assert.deepEqual(
    contenido.map(({ role }) => role),
    ['user', 'model', 'user'],
  );
  assert.equal(contenido[1].parts[0].text, 'Montañita tiene playa y surf.');

  // Sin `content` el mensaje del asistente se descarta y los dos turnos del
  // usuario se fusionan: por eso el widget guarda el texto de la respuesta.
  const sinTexto = prepararContenido([
    { role: 'user', content: 'Hola' },
    { role: 'assistant', mensaje: 'Respuesta sin content' },
    { role: 'user', content: 'Otra pregunta' },
  ]);
  assert.equal(sinTexto.length, 1);
  assert.match(sinTexto[0].parts[0].text, /Hola[\s\S]*Otra pregunta/);
});
