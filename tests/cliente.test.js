/**
 * Pruebas del cliente del chat: normalización, degradación a modo
 * demostración y fallo simulado para la demo.
 * Ejecutar con: npm test
 */
import assert from 'node:assert/strict';
import test from 'node:test';

import { falloSimuladoActivo, solicitarSugerencias } from '../src/lib/gemini.js';

const OK = {
  ok: true,
  status: 200,
  json: async () => ({
    mensaje:  '  Te recomiendo tres destinos.  ',
    sugerencias: [
      { destinoId: 1, nombre: 'Montañita', region: 'Costa', motivo: 'Surf', diasSugeridos: 3, precioEstimado: 180 },
      { destinoId: 2, nombre: 'Baños', region: 'Sierra', motivo: 'Naturaleza', diasSugeridos: 4, precioEstimado: 90 },
      { destinoId: 3, nombre: 'Otro', region: 'Costa', motivo: 'Playa', diasSugeridos: 2, precioEstimado: 50 },
    ],
    preguntasSugeridas: ['¿Cuál es la mejor época?'],
  }),
};

const FALLO = {
  ok: false,
  status: 503,
  json: async () => ({ error: 'La IA está saturada en este momento.' }),
};

async function conFetch(fetchSimulado, accion) {
  const original = globalThis.fetch;
  globalThis.fetch = fetchSimulado;
  try {
    return await accion();
  } finally {
    globalThis.fetch = original;
  }
}

test('solicitarSugerencias normaliza la respuesta real y limita a 2 sugerencias', async () => {
  const respuesta = await conFetch(async () => OK, () =>
    solicitarSugerencias([{ role: 'user', content: 'Quiero playa' }]),
  );

  assert.equal(respuesta.modoDemo, false);
  assert.equal(respuesta.mensaje, 'Te recomiendo tres destinos.');
  assert.equal(respuesta.sugerencias.length, 2);
  assert.equal(respuesta.preguntasSugeridas.length, 1);
});

test('solicitarSugerencias usa el modo demostración si el servicio falla', async () => {
  const respuesta = await conFetch(async () => FALLO, () =>
    solicitarSugerencias([{ role: 'user', content: 'Quiero playa' }]),
  );

  assert.equal(respuesta.modoDemo, true);
  assert.match(respuesta.aviso, /saturada/);
  assert.ok(respuesta.sugerencias.length > 0);
  assert.ok(respuesta.sugerencias.length > 0);
});

test('?simularFallo=1 falla antes de llamar al servicio', async () => {
  let llamadas = 0;
  globalThis.window = { location: { search: '?simularFallo=1' } };

  try {
    assert.equal(falloSimuladoActivo(), true);
    await conFetch(
      async () => {
        llamadas += 1;
        return OK;
      },
      async () => {
        await assert.rejects(() => solicitarSugerencias([{ role: 'user', content: 'Hola' }]), /Fallo simulado/);
      },
    );
  } finally {
    delete globalThis.window;
  }

  assert.equal(llamadas, 0);
});
