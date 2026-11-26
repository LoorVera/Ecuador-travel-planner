# Asistente de viajes con Gemini

Botón flotante (abajo a la derecha) disponible en todas las páginas. El usuario
escribe lo que busca y Gemini devuelve hasta 4 destinos de Ecuador; cada
sugerencia se puede agregar al itinerario/presupuesto.

## Arquitectura

```
Navegador
  └─ src/components/AiChatWidget.jsx     UI del chat
       └─ src/lib/gemini.js              fetch a VITE_AI_ENDPOINT
            ├─ src/lib/mockIA.js         respaldo marcado como "modo demostración"
            └─ api/gemini.js             endpoint serverless (CORS + rate limit)
                 └─ api/_gemini.js       prompt + llamada a Gemini (API key aquí)
```

La clave **nunca** se envía al navegador. No uses variables `VITE_GEMINI_*`.

## Configuración local

1. Obtén una clave en <https://aistudio.google.com/apikey>.
2. Abre `.env.local` y completa:

   ```env
   GEMINI_API_KEY=tu_clave_real
   GEMINI_MODEL=gemini-3.6-flash
   ```

   > `gemini-2.5-flash` ya no está disponible para claves nuevas (Google
   > responde 404). El asistente usa `gemini-3.6-flash` por defecto y prueba
   > modelos de respaldo (`gemini-3.5-flash`, `gemini-3.8-flash`,
   > `gemini-flash-latest`) si el principal está retirado o saturado.

3. Ejecuta `npm run dev`.

En desarrollo, `vite.config.js` monta `/api/gemini` con el mismo handler que se
despliega, así que no hace falta un backend aparte.

## Despliegue

- **Local:** `npm run dev` monta `/api/gemini` con el handler real
  (`vite.config.js`), así que el asistente funciona sin backend aparte.
- **Sitio publicado en Amazon S3:** S3 solo sirve archivos estáticos, por eso
  `api/` se publica aparte y el frontend apunta allí con `VITE_AI_ENDPOINT`.
- **Backend (Vercel Functions):**
  1. Importa el repositorio en Vercel (la copia estática de Vercel no se usa; el
     sitio entregable es S3).
  2. Define `GEMINI_API_KEY` (secreto), `GEMINI_MODEL` (opcional) y
     `ALLOWED_ORIGINS` (opcional; por defecto `*`).
  3. Copia `https://<proyecto>.vercel.app/api/gemini` y úsalo como
     `VITE_AI_ENDPOINT` en `.env.local` y en las *Variables* de GitHub.
- **CORS:** `api/gemini.js` responde al *preflight* `OPTIONS` y envía
  `Access-Control-Allow-Origin`, necesario porque el sitio (S3) y la API viven en
  dominios distintos. Restringe los orígenes con `ALLOWED_ORIGINS` cuando quieras.

## Validación y errores

- **Entrada:** el cliente recorta el texto y limita a 600 caracteres; el servidor
  acepta máximo 10 mensajes, 1200 caracteres por mensaje y 9000 en total, y
  descarta mensajes vacíos o con roles inválidos.
- **Respuesta:** Gemini se llama con `responseSchema` (JSON estructurado) y el
  resultado se normaliza antes de mostrarlo: tipos, región válida, 1–4
  sugerencias, días entre 1 y 14 y precios acotados.
- **Fallos controlados:** `Alert` rojo con botón **Reintentar**; los códigos 429,
  502 y 503 se traducen a mensajes claros.
- **Modo demostración:** si el servicio no responde y `VITE_AI_FALLBACK` no es
  `off`, se muestran recomendaciones locales con un aviso amarillo que aclara que
  no son de Gemini.
- **Fallo simulado:** abre el sitio con `?simularFallo=1` para reproducir el caso
  de error controlado sin tocar el backend.

## Comportamiento y límites

- Hasta 10 mensajes de historial y 1200 caracteres por mensaje.
- 12 peticiones por minuto por IP (memoria del proceso).
- Respuesta JSON estructurada (`mensaje`, `sugerencias`, `preguntasSugeridas`).
- Solo se pueden agregar al itinerario los destinos que existen en
  `src/data/destinos.js`; las sugerencias externas se muestran sin botón.
- Si no hay sesión, el botón de agregar abre el modal de autenticación.

## Pruebas rápidas

- Sin clave configurada, `POST /api/gemini` responde 500 con un mensaje claro.
- Con clave inválida, responde 502 indicando revisar `GEMINI_API_KEY`.
- `OPTIONS /api/gemini` responde 204 con las cabeceras CORS.
- `?simularFallo=1` muestra el error controlado con botón Reintentar.
- El botón flotante debe verse en `/`, `/resenas` y `/mapas`.
