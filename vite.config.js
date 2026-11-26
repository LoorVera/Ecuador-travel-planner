import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'
import geminiHandler from './api/gemini.js'

/**
 * En desarrollo, Vite no ejecuta funciones serverless. Este middleware
 * monta /api/gemini en el servidor de Vite usando el mismo handler que
 * se despliega en Vercel, y así la API key nunca llega al navegador.
 */
function geminiDevApi() {
  return {
    name: 'gemini-dev-api',
    configureServer(server) {
      server.middlewares.use('/api/gemini', async (req, res) => {
        try {
          const partes = []
          for await (const parte of req) partes.push(parte)
          const crudo = Buffer.concat(partes).toString('utf8')
          req.body = crudo ? JSON.parse(crudo) : {}

          const adaptador = {
            setHeader(nombre, valor) {
              res.setHeader(nombre, valor)
              return this
            },
            status(codigo) {
              res.statusCode = codigo
              return this
            },
            json(payload) {
              if (res.writableEnded) return this
              res.setHeader('Content-Type', 'application/json; charset=utf-8')
              res.end(JSON.stringify(payload))
              return this
            },
            end(payload) {
              if (!res.writableEnded) res.end(payload)
              return this
            },
          }

          await geminiHandler(req, adaptador)
        } catch (error) {
          server.config.logger.error(`[gemini-dev-api] ${error?.message || error}`)
          if (!res.writableEnded) {
            res.statusCode = 500
            res.setHeader('Content-Type', 'application/json; charset=utf-8')
            res.end(JSON.stringify({ error: 'No se pudo procesar la solicitud.' }))
          }
        }
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // Carga también variables sin prefijo VITE_ (solo para el servidor).
  const env = loadEnv(mode, process.cwd(), '')
  if (!process.env.GEMINI_API_KEY && env.GEMINI_API_KEY) {
    process.env.GEMINI_API_KEY = env.GEMINI_API_KEY
  }
  if (!process.env.GEMINI_MODEL && env.GEMINI_MODEL) {
    process.env.GEMINI_MODEL = env.GEMINI_MODEL
  }

  return {
    plugins: [react(), geminiDevApi()],
  }
})
