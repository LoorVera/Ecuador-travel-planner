/**
 * Pruebas de las reglas que protegen al asistente:
 * validación de entrada (servidor) y respaldo de demostración (cliente).
 *
 * Ejecutar con: npm test
 */
import assert from 'node:assert/strict';
import test from 'node:test';

import { prepararContenido } from '../api/_gemini.js';
import { generarSugerenciasMock } from '../src/lib/mockIA.js';

test('prepararContenido rechaza entradas que no son un arreglo', () => {
  assert.equal(prepararContenido(undefined), null);
  assert.equal(prepararContenido('hola'), null);
  assert.equal(prepararContenido({ role: 'user' }), null);
});

test('prepararContenido descarta mensajes vacíos y empieza con el usuario', () => {
  const contenido = prepararContenido([
    { role: 'assistant', content: 'Hola, soy RutaBot' },
    { role: 'user', content: '   ' },
    { role: 'user', content: 'Quiero playa' },
  ]);

  assert.ok(Array.isArray(contenido));
  assert.equal(contenido[0].role, 'user');
  assert.equal(contenido[0].parts[0].text, 'Quiero playa');
});

test('prepararContenido limita el historial a 10 mensajes', () => {
  const mensajes = Array.from({ length: 25 }, (_, indice) => ({
    role: indice % 2 === 0 ? 'user' : 'assistant',
    content: `Mensaje ${indice}`,
  }));

  const contenido = prepararContenido(mensajes);
  const total = contenido.reduce((suma, parte) => suma + parte.parts[0].text.split('\n\n').length, 0);

  assert.ok(total <= 10);
});

test('prepararContenido recorta mensajes demasiado largos', () => {
  const contenido = prepararContenido([{ role: 'user', content: 'a'.repeat(5000) }]);

  assert.ok(contenido[0].parts[0].text.length <= 1201);
  assert.ok(contenido[0].parts[0].text.endsWith('…'));
});

test('generarSugerenciasMock devuelve sugerencias válidas y marcadas como demo', () => {
  const respuesta = generarSugerenciasMock([
    { role: 'user', content: 'Quiero playa, surf y poco presupuesto' },
  ]);

  assert.equal(respuesta.modoDemo, true);
  assert.ok(respuesta.sugerencias.length > 0);
  assert.ok(respuesta.sugerencias.length <= 4);
  assert.ok(respuesta.preguntasSugeridas.length > 0);

  for (const sugerencia of respuesta.sugerencias) {
    assert.equal(typeof sugerencia.destinoId, 'number');
    assert.equal(typeof sugerencia.nombre, 'string');
    assert.ok(['Sierra', 'Costa', 'Amazonía'].includes(sugerencia.region));
    assert.ok(sugerencia.diasSugeridos >= 1 && sugerencia.diasSugeridos <= 14);
    assert.ok(sugerencia.precioEstimado >= 0);
  }
});

test('generarSugerenciasMock prioriza la región pedida', () => {
  const respuesta = generarSugerenciasMock([{ role: 'user', content: 'Quiero selva y Amazonía' }]);

  assert.ok(respuesta.sugerencias.every((sugerencia) => sugerencia.region === 'Amazonía'));
});

test('generarSugerenciasMock funciona sin historial', () => {
  const respuesta = generarSugerenciasMock([]);

  assert.equal(respuesta.modoDemo, true);
  assert.ok(Array.isArray(respuesta.sugerencias));
  assert.ok(respuesta.sugerencias.length > 0);
});
