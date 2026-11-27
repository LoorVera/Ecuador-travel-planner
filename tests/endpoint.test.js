/**
 * Pruebas del handler serverless /api/gemini (CORS, método, clave y rate limit).
 * Ejecutar con: npm test
 */
import assert from 'node:assert/strict';
import test from 'node:test';

import handler from '../api/gemini.js';

function crearRespuesta() {
  return {
    cabeceras: {},
    setHeader(nombre, valor) {
      this.cabeceras[nombre] = valor;
      return this;
    },
    status(codigo) {
      this.codigo = codigo;
      return this;
    },
    json(payload) {
      this.cuerpo = payload;
      return this;
    },
    end() {
      this.terminada = true;
      return this;
    },
  };
}

function crearPeticion(metodo, ip, cuerpo = {}) {
  return {
    method: metodo,
    headers: { origin: 'http://localhost:5173', 'x-forwarded-for': ip },
    body: cuerpo,
  };
}

test('OPTIONS responde al preflight con cabeceras CORS', async () => {
  const res = crearRespuesta();
  await handler(crearPeticion('OPTIONS', 'ip-options'), res);

  assert.equal(res.codigo, 204);
  assert.equal(res.cabeceras['Access-Control-Allow-Origin'], '*');
  assert.equal(res.cabeceras['Access-Control-Allow-Methods'], 'POST, OPTIONS');
});

test('ALLOWED_ORIGINS se aplica también en el middleware de desarrollo', async () => {
  const original = process.env.ALLOWED_ORIGINS;
  process.env.ALLOWED_ORIGINS = 'https://ejemplo.com';
  const res = crearRespuesta();

  try {
    await handler(crearPeticion('OPTIONS', 'ip-cors'), res);
  } finally {
    if (original === undefined) delete process.env.ALLOWED_ORIGINS;
    else process.env.ALLOWED_ORIGINS = original;
  }

  assert.equal(res.codigo, 204);
  assert.equal(res.cabeceras['Access-Control-Allow-Origin'], undefined);
});

test('solo se permite POST', async () => {
  const res = crearRespuesta();
  await handler(crearPeticion('GET', 'ip-get'), res);

  assert.equal(res.codigo, 405);
  assert.equal(res.cabeceras.Allow, 'POST');
});

test('sin clave en el servidor responde 500 con un mensaje claro', async () => {
  const original = process.env.GEMINI_API_KEY;
  delete process.env.GEMINI_API_KEY;
  const res = crearRespuesta();

  try {
    await handler(crearPeticion('POST', 'ip-sin-clave'), res);
  } finally {
    if (original !== undefined) process.env.GEMINI_API_KEY = original;
  }

  assert.equal(res.codigo, 500);
  assert.match(res.cuerpo.error, /GEMINI_API_KEY/);
});

test('un cuerpo que no es JSON responde 400', async () => {
  const original = process.env.GEMINI_API_KEY;
  process.env.GEMINI_API_KEY = 'clave-de-prueba';
  const res = crearRespuesta();

  try {
    await handler(crearPeticion('POST', 'ip-cuerpo-invalido', '{'), res);
  } finally {
    if (original === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = original;
  }

  assert.equal(res.codigo, 400);
  assert.match(res.cuerpo.error, /JSON válido/);
});

test('el rate limit se activa después de 12 peticiones por IP', async () => {
  const original = process.env.GEMINI_API_KEY;
  delete process.env.GEMINI_API_KEY;
  const codigos = [];

  try {
    for (let intento = 0; intento < 13; intento += 1) {
      const res = crearRespuesta();
      await handler(crearPeticion('POST', 'ip-rate-limit-test'), res);
      codigos.push(res.codigo);
    }
  } finally {
    if (original !== undefined) process.env.GEMINI_API_KEY = original;
  }

  assert.ok(codigos.slice(0, 12).every((codigo) => codigo === 500));
  assert.equal(codigos[12], 429);
});
