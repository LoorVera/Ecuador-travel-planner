# RutaEcuador — Ecuador Travel Planner

Aplicación web para planificar viajes por Ecuador: catálogo de destinos, mapa
interactivo, reseñas y un asistente de viajes con IA (Gemini) que sugiere
destinos según lo que busca la persona.

**Stack:** React 19 + Vite 8 · Mantine · React Router · Zustand · MapLibre GL ·
Firebase (Auth + Firestore) · CI con GitHub Actions · despliegue estático en
Amazon S3 · API serverless en `api/` (Vite en desarrollo · Vercel Functions en
producción) · Google Gemini.

**Sitio publicado (S3):** <http://ecuador-travel.s3-website.us-east-2.amazonaws.com/>

> Bucket `ecuador-travel`, región `us-east-2`. El frontend vive en S3; la función
> de IA vive aparte (ver [Desplegar el backend de IA](#desplegar-el-backend-de-ia)).

---

## Instalación

### Requisitos

- **Node.js LTS** (el CI usa Node 24 mediante `actions/setup-node`).
- **npm** (incluido con Node).
- Git para clonar el repositorio.

### Comandos

```bash
# 1. Clonar el repositorio
git clone <URL-del-repositorio>
cd ecuador-travel-planner

# 2. Instalar dependencias (usa package-lock.json)
npm ci
# o, si vas a modificar dependencias:
npm install

# 3. Ejecutar en local (http://localhost:5173)
npm run dev

# 4. Generar el build de producción (carpeta dist/)
npm run build

# 5. Previsualizar el build localmente
npm run preview

# 6. Revisar el código con ESLint
npm run lint
```

> El asistente de IA necesita una clave de Gemini para funcionar (ver
> **Configuración pública**). El resto de la aplicación arranca sin ella.

---

## Configuración pública

Solo se documenta **información pública**. Ninguna clave ni secreto debe ir en el
frontend ni en el repositorio.

### Lo que otra persona necesita para ejecutar el proyecto

| Elemento | Valor público | Dónde vive |
| --- | --- | --- |
| Endpoint del asistente (local) | `POST /api/gemini` (middleware de Vite) | `src/lib/gemini.js` |
| Endpoint del asistente (publicado) | <https://ecuador-travel-planner.vercel.app/api/gemini> (`VITE_AI_ENDPOINT`) | *Variables* de GitHub |
| Proveedor de IA | Google Gemini — `https://generativelanguage.googleapis.com` | Solo en el servidor (`api/_gemini.js`) |
| Mapa base | `https://tile.openstreetmap.org/{z}/{x}/{y}.png` (sin clave) | `src/lib/pmtiles.js` |
| Firebase (config web) | Proyecto `turismo-ecuador-420f5` (variables `VITE_FIREBASE_*`) | `src/config/firebase.js` + `.env.local` |

- El frontend **nunca** llama a Gemini directamente: llama a `/api/gemini` (local)
  o a la URL de `VITE_AI_ENDPOINT` (publicado), y el servidor es quien usa la clave.
- Si el servicio de IA no responde, la app muestra **recomendaciones de
  demostración** marcadas como tales (`VITE_AI_FALLBACK=mock`, activo por
  defecto). No son respuestas de Gemini: sirven para que la interfaz no se rompa.
- La configuración web de Firebase (incluida su `apiKey`) es **pública por
  diseño**: se carga desde variables `VITE_FIREBASE_*` y Vite la inyecta en el
  bundle. La seguridad real se controla con las reglas de Firestore/Storage, no
  ocultando esa configuración.
- No existen variables `VITE_GEMINI_*`: eso expondría la clave en el navegador.

### Secretos (fuera del repositorio)

Se configuran en `.env.local` (ignorado por Git) o como variables de entorno del
hosting. Hay una plantilla pública en `.env.example`:

```env
# .env.local  — NO subir este archivo
# Secreto (solo servidor)
GEMINI_API_KEY=tu_clave_real_de_google_ai_studio
GEMINI_MODEL=gemini-3.5-flash-lite

# Config web pública de Firebase (se inyecta en el bundle)
VITE_FIREBASE_API_KEY=tu_api_key_web
VITE_FIREBASE_AUTH_DOMAIN=tu-proyecto.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=tu-proyecto
VITE_FIREBASE_STORAGE_BUCKET=tu-proyecto.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=000000000000
VITE_FIREBASE_APP_ID=1:000000000000:web:0000000000000000000000
VITE_FIREBASE_MEASUREMENT_ID=G-XXXXXXXXXX

# URL del servicio de IA publicado (vacío en local → usa /api/gemini)
VITE_AI_ENDPOINT=https://ecuador-travel-planner.vercel.app/api/gemini

# `mock` muestra recomendaciones de demostración si la IA falla; `off` solo error
VITE_AI_FALLBACK=mock

# Solo servidor: orígenes permitidos por CORS (o * para cualquiera)
ALLOWED_ORIGINS=*
```

- `GEMINI_API_KEY`: clave de Google AI Studio (<https://aistudio.google.com/apikey>).
  **Único secreto real**; solo se usa en el servidor.
- `GEMINI_MODEL` (opcional): por defecto `gemini-3.5-flash-lite`. Google deprecó
  `gemini-2.5-flash` en noviembre de 2026; si ya existe la variable en Vercel con
  ese valor, actualízala o bórrala para usar el default del código. Respaldos:
  `gemini-3.8-flash` y `gemini-3.6-flash`.
- `VITE_FIREBASE_*`: configuración web pública de Firebase. No son secretos, pero
  son necesarias para que arranquen Auth y Firestore.
- `VITE_AI_ENDPOINT` (pública): URL de la función que expone `/api/gemini` en el
  sitio publicado. Producción: `https://ecuador-travel-planner.vercel.app/api/gemini`.
  Vacía en local (usa el middleware de Vite). Usa el dominio canónico de Vercel:
  la URL directa del deployment puede estar protegida por Vercel Authentication
  y devolver `401` al navegador.
- `VITE_AI_FALLBACK` (pública): `mock` (por defecto) o `off`.
- `ALLOWED_ORIGINS` (solo servidor): lista separada por comas para CORS.

---

## Arquitectura

```
Navegador (SPA)
  └─ src/ … React 19 + Vite + Mantine + React Router + Zustand
       ├─ src/components/AiChatWidget.jsx   UI del chat flotante
       │    └─ src/lib/gemini.js            fetch a VITE_AI_ENDPOINT
       │         └─ src/lib/mockIA.js       respaldo si el servicio falla
       ├─ src/config/firebase.js            Auth + Firestore (cliente)
       └─ src/lib/pmtiles.js                mapa base (MapLibre + OSM)

Servidor / API (`api/`, misma carpeta en local y en Vercel Functions)
  └─ api/gemini.js        POST /api/gemini (CORS + validación + rate limit)
       └─ api/_gemini.js  prompt, esquema JSON y llamada a Gemini (API key aquí)

Despliegue actual (AWS + GitHub)
  ├─ .github/workflows/ci.yml       lint + build + artifact dist/
  ├─ .github/workflows/deploy.yml   workflow_run del CI → bucket, hosting,
  │                                 permisos y sync (solo main, nunca PR)
  ├─ scripts/deploy-s3.ps1          alternativa manual: sube dist/ al bucket S3
  └─ Vercel Functions               publica api/gemini.js (solo el endpoint de IA)
```

### Frontend

Aplicación de una sola página (SPA) construida con **React 19 + Vite**:

- `/` — planificador de viajes (itinerario y presupuesto).
- `/resenas` — reseñas.
- `/mapas` — visor de mapas (carga diferida con `lazy`).
- Widget de chat con IA presente en todas las páginas.

Estado global con **Zustand**; autenticación y persistencia del presupuesto con
**Firebase Auth + Firestore**.

### Backend / API

No hay un servidor tradicional: el backend son **funciones serverless** dentro de
`api/`:

- `api/gemini.js`: valida el método/cuerpo, aplica **rate limit** (12 peticiones
  por minuto por IP) y delega en el núcleo.
- `api/_gemini.js`: arma el prompt, exige salida JSON estructurada y llama a
  Gemini con la clave del servidor. El prefijo `_` evita que se publique como
  endpoint propio si se despliega en Vercel.

En desarrollo, `vite.config.js` monta `/api/gemini` con **el mismo handler**, así
que no hace falta un backend aparte. En el sitio publicado en S3 no hay backend
(S3 solo sirve estáticos), por eso `api/` se despliega aparte en **Vercel
Functions** y el frontend apunta allí con `VITE_AI_ENDPOINT`. El handler añade
**CORS** y responde al *preflight* `OPTIONS` para que el navegador del sitio S3
pueda llamarlo.

### Validación y manejo de errores

- **Entrada:** el cliente recorta el texto y limita a 600 caracteres por mensaje;
  el servidor acepta como máximo 10 mensajes, 1200 caracteres por mensaje y 9000
  en total, descarta vacíos y fuerza roles alternados.
- **Respuesta:** se exige JSON estructurado a Gemini (`responseSchema`) y se
  normaliza antes de mostrarlo: tipos, región válida, 1–2 sugerencias, días entre
  1 y 14 y precios acotados. Un `destinoId` inexistente se convierte en `0`.
- **Fallos:** los errores de red, configuración (`400`), clave (`401/403`), cuota
  (`429`), modelo retirado (`404`), saturación (`503`) y tiempo de espera (`504`)
  se traducen a mensajes claros. La interfaz muestra un aviso rojo con botón
  **Reintentar** en lugar de romperse.
- **Demostración:** con `?simularFallo=1` se fuerza el caso de error controlado;
  con `VITE_AI_FALLBACK=mock` (por defecto) una caída del servicio muestra
  recomendaciones locales marcadas como **modo demostración**.

### Proveedor de IA y simulador (mock)

- **Proveedor:** Google **Gemini** (API `generativelanguage.googleapis.com`).
- **Modelo por defecto:** `gemini-3.5-flash-lite`, con respaldo automático a
  `gemini-3.8-flash` y `gemini-3.6-flash` si el principal está retirado (404) o
  saturado (503). La petición usa `thinkingLevel: low` (no el obsoleto
  `thinkingBudget`) y no envía parámetros de muestreo como `temperature`.
- **Mock:** sí, **solo como respaldo** (`src/lib/mockIA.js`). Las respuestas
  normales son reales de Gemini; el mock se usa cuando el servicio no responde y
  la interfaz lo etiqueta como "Modo demostración". Se puede desactivar con
  `VITE_AI_FALLBACK=off` para ver únicamente el error controlado.

### De `git push` al sitio publicado

1. **Push:** `git push` envía los cambios a GitHub
   (`LoorVera/Ecuador-travel-planner`).
2. **CI (GitHub Actions):** `.github/workflows/ci.yml` se dispara en cada push a
   `main`, en Pull Requests y manualmente (`workflow_dispatch`). Hace
   `actions/checkout`, configura Node 24 con caché de npm y ejecuta `npm ci`.
3. **Validación + artifact (CI):** corre `npm run lint` y `npm run build` (Vite →
   `dist/`) con las `VITE_FIREBASE_*` y `VITE_AI_ENDPOINT` inyectadas desde las
   *Variables* del repositorio. El `dist/` se sube como **artifact**
   (`actions/upload-artifact`, retención 14 días) y es el mismo build que se
   publica en S3.
4. **Despliegue continuo (AWS):** al terminar el CI en verde se dispara
   `.github/workflows/deploy.yml` (`workflow_run`). Ese workflow descarga el
   artefacto `dist` **del mismo run**, se autentica con tus credenciales AWS
   (Access Key + Secret Key), asegura el bucket (lo crea si no existe), activa el
   hosting estático y la lectura pública, y sincroniza los archivos con
   `aws s3 sync`. Alternativa manual: `scripts/deploy-s3.ps1` o la consola. Ver
   [`docs/DESPLIEGUE-S3.md`](docs/DESPLIEGUE-S3.md).
5. **Hosting:** S3 sirve `index.html`, `assets/` y los SVG. Las rutas `/resenas`
   y `/mapas` funcionan al recargar gracias al **Error document = `index.html`**
   configurado en el bucket; no hay rewrite de servidor como en Vercel.
6. **API de IA:** `api/gemini.js` se publica aparte en **Vercel Functions** y el
   frontend lo llama con `VITE_AI_ENDPOINT`. El endpoint aplica CORS, rate limit
   y guarda `GEMINI_API_KEY` solo en el servidor.
7. **CDN:** el *endpoint* de sitio web de S3 **no es una CDN**; sirve los archivos
   directamente desde la región del bucket. Los assets con hash se cachean en el
   navegador (`Cache-Control: public, max-age=31536000, immutable`) y `index.html`
   se sirve con `no-cache`. Para una CDN real y HTTPS habría que anteponer
   **CloudFront** (ver Limitaciones).

> El workflow de despliegue solo corre cuando el CI de `main` termina en verde
> (incluidas las reejecuciones manuales del CI); los Pull Requests únicamente
> validan lint y build. Si faltan las variables públicas o las credenciales, el
> workflow falla a propósito para no publicar un artifact que no arranque en el
> navegador.

### Despliegue en AWS S3 (frontend)

El sitio publicado es el **frontend estático** en Amazon S3. La guía completa
está en [`docs/DESPLIEGUE-S3.md`](docs/DESPLIEGUE-S3.md).

**Automático (CD):** al hacer `push` a `main`, `.github/workflows/deploy.yml`
publica el mismo artefacto generado por el CI. Configura una vez en el
repositorio (*Settings → Secrets and variables → Actions*):

| Tipo | Nombre | Valor |
| --- | --- | --- |
| Secret | `AWS_ACCESS_KEY_ID` | Access Key de tu usuario/rol IAM |
| Secret | `AWS_SECRET_ACCESS_KEY` | Secret Key de ese mismo usuario/rol |
| Variable | `AWS_REGION` | p. ej. `us-east-2` |
| Variable | `S3_BUCKET_NAME` | p. ej. `ecuador-travel` |

> **No se usa session token**: las claves son permanentes. GitHub las enmascara
> en los logs, pero limítalas a un usuario IAM con permisos sobre el bucket
> (creación, lectura/escritura de objetos, política y hosting), y rótalas si se
> filtran.

**Manual (alternativa):**

```powershell
npm run build
# Opción con AWS CLI v2 (credenciales AWS ya cargadas):
powershell -ExecutionPolicy Bypass -File .\scripts\deploy-s3.ps1 -Bucket ecuador-travel -Region us-east-2
```

- Se sube el contenido de `dist/` (solo estáticos, sin backend).
- El sitio queda en <http://ecuador-travel.s3-website.us-east-2.amazonaws.com/>.
- S3 sirve **HTTP**; para HTTPS hace falta CloudFront.
- La IA funciona porque el frontend llama al endpoint publicado aparte; si ese
  servicio cae, aparece el aviso de "modo demostración" o el error controlado.

### Desplegar el backend de IA

1. Importa el repositorio en **Vercel** (detecta Vite y publica `api/` como
   función). La copia estática de Vercel **no** se usa como sitio: el sitio
   entregable sigue siendo S3.
2. En *Settings → Environment Variables* define `GEMINI_API_KEY` (secreto),
   `GEMINI_MODEL` (opcional) y `ALLOWED_ORIGINS` (opcional). Si `GEMINI_MODEL`
   existe con un valor antiguo (`gemini-2.5-flash`), actualízalo a
   `gemini-3.5-flash-lite` o elimínala: su valor sobrescribe el default del
   código. Después de cambiar variables, vuelve a desplegar la función.
3. Usa el **dominio canónico** de Vercel, con la forma
   `https://<proyecto>.vercel.app/api/gemini`. Backend en producción:
   **`https://ecuador-travel-planner.vercel.app/api/gemini`**. La URL directa
   del deployment (`...-od2t0sggq-loorveras-projects.vercel.app`) está protegida
   por Vercel Authentication y responde `401` a peticiones públicas: no la uses
   como `VITE_AI_ENDPOINT`.
4. Añade esa URL como *Variable* de GitHub (`VITE_AI_ENDPOINT`) y vuelve a
   compilar y desplegar en S3. En `.env.local` se deja vacía para desarrollar
   contra el middleware local.

Alternativas al mismo endpoint: Cloudflare Worker o AWS Lambda + Function URL
(esta última requiere empaquetar el handler y permisos del laboratorio).

---

## Registro de versiones y evidencias

- [`docs/REGISTRO-VERSIONES.md`](docs/REGISTRO-VERSIONES.md): qué cambió entre la
  versión 1 y la versión 2, con commit, ejecución de CI, artifact y capturas.
- [`docs/evidencias/`](docs/evidencias/): capturas del sitio publicado, del
  análisis de IA, del error controlado y del CI/artifact.

---

## Limitaciones

- **Dependencia de un servicio externo (Gemini):** cuotas, latencia y caídas
  afectan al asistente. `gemini-2.5-flash` está deprecado desde noviembre de
  2026; el asistente usa modelos 3.x vigentes con respaldos, pero si todos fallan
  se activa el modo demostración.
- **El modo demostración no es IA real:** si el endpoint falla y
  `VITE_AI_FALLBACK=mock`, las sugerencias se generan con el catálogo local y la
  interfaz lo indica. Sirve para no romper la demo, no como sustituto de Gemini.
- **Rate limit en memoria:** los 12 req/min por IP se guardan en memoria del
  proceso; no se comparten entre instancias ni sobreviven a un *cold start*, por
  lo que no es un límite global fiable.
- **Pruebas:** `npm test` ejecuta 22 pruebas unitarias de validación, llamada a
  Gemini, manejo de errores, handler y cliente. El CI corre lint, pruebas y
  build; no hay tests E2E en navegador.
- **Tamaño del bundle:** algunos chunks superan los 500 kB (aviso de Vite); solo
  `/mapas` está dividido con carga diferida. No se aplicó más *code-splitting*.
- **Reglas de Firebase:** la configuración web es pública; la protección real
  depende de las reglas de Firestore/Storage, que se administran en la consola de
  Firebase y **no** forman parte de este repositorio.
- **Hosting estático en S3:** S3 sirve **HTTP** y no ejecuta `/api/*`. El backend
  de IA se publica aparte (Vercel Functions) porque en AWS Academy crear API
  Gateway + Lambda puede chocar con restricciones de permisos/región.
- **Sin CDN real:** el *endpoint* de sitio web de S3 sirve desde la región del
  bucket. Para **HTTPS** y caché de borde haría falta **CloudFront** con origen en
  el bucket y *custom error responses* 403/404 → `/index.html`.
- **Rutas del SPA en S3:** dependen del *Error document = `index.html`* del
  bucket. Al recargar `/resenas` o `/mapas` el usuario ve la página correcta,
  pero S3 responde con código **404**; para un `200` real hace falta CloudFront.
- **Permisos AWS:** el CD depende de que el usuario IAM tenga permisos sobre el
  bucket; si le falta `PutBucketPolicy` o `PutPublicAccessBlock`, el job falla en
  el paso de permisos y hay que ajustar la política IAM (o aplicar esos ajustes
  manualmente).
- **Mapa base público:** depende de los servidores de teselas de OpenStreetMap
  (política de uso y sin SLA); no se usa un proveedor con clave ni CDN propia.
- **Idioma y alcance:** el asistente solo recomienda destinos de Ecuador y no
  gestiona reservas ni pagos reales.
