/**
 * Endpoint serverless: POST /api/gemini
 * Recibe el historial del chat y devuelve sugerencias de destinos.
 * Funciona en Vercel y en el middleware de desarrollo de Vite.
 */
import { GeminiError, generarSugerencias } from './_gemini.js';

const VENTANA_MS = 60_000;
const LIMITE_PETICIONES = 12;
const solicitudesPorIp = new Map();

// Orígenes permitidos por CORS. `*` por defecto porque el endpoint no usa
// cookies ni credenciales; se puede restringir con ALLOWED_ORIGINS.
const ORIGENES_PERMITIDOS = (process.env.ALLOWED_ORIGINS || '*')
  .split(',')
  .map((origen) => origen.trim())
  .filter(Boolean);

function aplicarCors(req, res) {
  const origen = req.headers?.origin;
  const permitido = ORIGENES_PERMITIDOS.includes('*')
    ? '*'
    : ORIGENES_PERMITIDOS.find((valor) => valor === origen);

  if (permitido) {
    res.setHeader('Access-Control-Allow-Origin', permitido);
    res.setHeader('Vary', 'Origin');
  }

  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Max-Age', '86400');
}

function permitirSolicitud(ip) {
  const ahora = Date.now();
  const registro = solicitudesPorIp.get(ip);

  if (!registro || ahora - registro.inicio > VENTANA_MS) {
    solicitudesPorIp.set(ip, { inicio: ahora, total: 1 });
    return true;
  }

  if (registro.total >= LIMITE_PETICIONES) return false;
  registro.total += 1;
  return true;
}

function obtenerIp(req) {
  const reenviada = req.headers?.['x-forwarded-for'];
  if (typeof reenviada === 'string' && reenviada) return reenviada.split(',')[0].trim();
  return req.socket?.remoteAddress || 'desconocida';
}

function leerCuerpo(body) {
  if (!body) return {};
  if (typeof body === 'string') {
    try {
      return JSON.parse(body);
    } catch {
      return null;
    }
  }
  return body;
}

export default async function handler(req, res) {
  aplicarCors(req, res);

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Método no permitido.' });
  }

  if (!permitirSolicitud(obtenerIp(req))) {
    return res.status(429).json({
      error: 'Demasiadas solicitudes. Espera un minuto antes de volver a preguntar.',
    });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({
      error: 'Falta configurar GEMINI_API_KEY en el servidor. Revisa el archivo .env.local o las variables de Vercel.',
    });
  }

  const body = leerCuerpo(req.body);
  if (!body) {
    return res.status(400).json({ error: 'El cuerpo de la solicitud no es JSON válido.' });
  }

  try {
    const resultado = await generarSugerencias(body.mensajes, apiKey);
    return res.status(200).json(resultado);
  } catch (error) {
    if (error instanceof GeminiError) {
      return res.status(error.status).json({ error: error.message });
    }

    console.error('[gemini] Error inesperado', error);
    return res.status(500).json({ error: 'Ocurrió un error inesperado. Intenta de nuevo.' });
  }
}
