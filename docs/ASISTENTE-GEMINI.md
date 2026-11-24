# Asistente de viajes con Gemini

Botón flotante (abajo a la derecha) disponible en todas las páginas. El usuario
escribe lo que busca y Gemini devuelve hasta 4 destinos de Ecuador; cada
sugerencia se puede agregar al itinerario/presupuesto.

## Arquitectura

```
Navegador
  └─ src/components/AiChatWidget.jsx     UI del chat
       └─ src/lib/gemini.js              fetch a /api/gemini
            └─ api/gemini.js             endpoint serverless (rate limit)
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

## Despliegue en Vercel

1. Importa el repositorio en Vercel (detecta Vite automáticamente).
2. En **Settings → Environment Variables** agrega:
   - `GEMINI_API_KEY`
   - `GEMINI_MODEL` (opcional)
3. Despliega. La función queda en `/api/gemini`.

`vercel.json` incluye el rewrite necesario para que rutas como `/resenas` y
`/mapas` sigan funcionando al recargar la página.

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
- El botón flotante debe verse en `/`, `/resenas` y `/mapas`.
