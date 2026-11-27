# Despliegue del frontend en Amazon S3 (AWS Academy)

Esta guía publica **solo el frontend estático** (contenido de `dist/`) como sitio
web en Amazon S3. El backend (`api/gemini`) **no** se despliega aquí: S3 solo
sirve archivos estáticos. Para que el asistente de IA funcione en el sitio
publicado, `api/` se despliega aparte (por ejemplo en Vercel Functions) y el
build se genera con `VITE_AI_ENDPOINT` apuntando a esa función. Sin esa variable,
el widget muestra el aviso de "modo demostración" o el error controlado.

---

## Requisitos

- Node.js LTS + npm.
- Acceso a **AWS Academy Learner Lab** con la sesión iniciada.
- (Opcional, para el método con script) **AWS CLI v2** instalado.

---

## Paso 1 — Generar el build

Desde la raíz del proyecto:

```powershell
npm run build
```

Esto crea `dist/` con **solo archivos estáticos**:

```
dist/
├─ index.html
├─ favicon.svg
├─ icons.svg
└─ assets/
   ├─ index-*.js
   ├─ index-*.css
   ├─ MapasPage-*.js
   ├─ MapasPage-*.css
   └─ maplibre-gl-worker-*.js
```

> `dist/` **no** contiene `api/` ni código de servidor. Es exactamente lo que se
> sube a S3.

---

## Paso 2 — Obtener credenciales en AWS Academy

1. En el laboratorio, pulsa **AWS Details**.
2. En **AWS CLI**, pulsa **Show** y copia:
   - `aws_access_key_id`
   - `aws_secret_access_key`
   - `aws_session_token`

> Las credenciales son temporales: caducan al terminar la sesión del laboratorio.

Elige **una** de las dos opciones siguientes.

---

## Opción A — Consola de AWS (recomendada para la entrega con capturas)

### A.1 Crear el bucket

1. Entra a **S3 → Create bucket**.
2. **Bucket name**: único a nivel global, solo minúsculas/números/guiones, por
   ejemplo `ecuador-travel-planner-2026`.
3. **AWS Region**: `us-east-1` (N. Virginia) o la que use tu laboratorio.
4. **Object Ownership**: `ACLs disabled` (por defecto).
5. **Block Public Access settings for this bucket**: **desmarca**
   “Block all public access” y marca la casilla de advertencia.
6. **Default encryption**: `SSE-S3` (por defecto). Crea el bucket.

### A.2 Activar el sitio web estático

1. Abre el bucket → pestaña **Properties**.
2. Baja hasta **Static website hosting** → **Edit**.
3. Selecciona **Enable**.
4. **Index document**: `index.html`
5. **Error document**: `index.html`  ← permite que funcionen rutas como `/resenas`.
6. **Save**.

### A.3 Permisos públicos

1. Pestaña **Permissions** → **Block public access (bucket settings)** → **Edit**.
2. Desmarca **Block all public access** → **Save** → confirma.
3. En **Bucket policy** → **Edit**, pega este JSON cambiando `MI_BUCKET` por el
   nombre real del bucket:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "PublicReadGetObject",
      "Effect": "Allow",
      "Principal": "*",
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::MI_BUCKET/*"
    }
  ]
}
```

4. **Save**.

### A.4 Subir el contenido de `dist/`

1. Pestaña **Objects** → **Upload**.
2. **Add files**: selecciona `index.html`, `favicon.svg` e `icons.svg`
   (los que están **dentro** de `dist/`).
3. **Add folder**: selecciona la carpeta `dist/assets`.
4. **Upload**.

> ⚠️ Sube el **contenido** de `dist/`, no la carpeta `dist` completa. Si los
> archivos quedan dentro de `dist/` en el bucket, el sitio dará error porque no
> encontrará `index.html` en la raíz.

### A.5 Obtener el enlace

1. Pestaña **Properties** → **Static website hosting**.
2. Copia el **Bucket website endpoint**, con esta forma:

```
http://MI_BUCKET.s3-website-us-east-1.amazonaws.com
```

Ese es el enlace que debes entregar.

---

## Opción B — Script con AWS CLI

### B.1 Instalar AWS CLI v2

Descárgalo e instálalo desde:
<https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html>

Verifica:

```powershell
aws --version
```

### B.2 Cargar las credenciales temporales

En la **misma** ventana de PowerShell:

```powershell
$env:AWS_ACCESS_KEY_ID     = "TU_ACCESS_KEY"
$env:AWS_SECRET_ACCESS_KEY = "TU_SECRET_KEY"
$env:AWS_SESSION_TOKEN     = "TU_SESSION_TOKEN"
$env:AWS_DEFAULT_REGION    = "us-east-1"
```

### B.3 Ejecutar el script

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\deploy-s3.ps1 -Bucket mi-bucket-unico-2026 -Region us-east-1
```

El script hace todo automáticamente: build, creación del bucket, acceso público,
hosting estático, política y subida de `dist/`. Al final imprime el enlace.

Si ya tienes el build hecho y solo quieres subir:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\deploy-s3.ps1 -Bucket mi-bucket-unico-2026 -Region us-east-1 -SkipBuild
```

---

## Opción C — Despliegue continuo con GitHub Actions

El workflow `.github/workflows/ci.yml` genera el artefacto `dist/`. El workflow
independiente `.github/workflows/deploy.yml` se dispara con `workflow_run`
cuando el CI termina en verde, y **solo publica `main`** (nunca Pull Requests).
Hace: descargar el artefacto de ese run → autenticarse → crear/verificar el
bucket → activar hosting estático y lectura pública → `aws s3 sync` → mostrar la
URL en el resumen del run.

### C.1 Registrar credenciales (Secrets)

En el repositorio: **Settings → Secrets and variables → Actions → Secrets → New
repository secret**. Copia los valores del panel **AWS Details → AWS CLI** del
Learner Lab:

| Secret | Valor |
| --- | --- |
| `AWS_ACCESS_KEY_ID` | `aws_access_key_id` |
| `AWS_SECRET_ACCESS_KEY` | `aws_secret_access_key` |
| `AWS_SESSION_TOKEN` | `aws_session_token` |

> Son temporales: al reanudar el laboratorio hay que generar otras y actualizar
> los tres Secrets. Nunca las pegues en el código ni en el workflow.

### C.2 Registrar bucket y región (Variables)

En la pestaña **Variables → New repository variable**:

| Variable | Ejemplo |
| --- | --- |
| `AWS_REGION` | `us-east-2` |
| `S3_BUCKET_NAME` | `ecuador-travel` |

El bucket debe ser único a nivel global. El job lo crea si no existe; si ya
está creado desde la consola, lo reutiliza y aplica la misma configuración.

### C.3 Publicar

```powershell
git add .
git commit -m "Deploy continuo a S3"
git push origin main
```

Abre la pestaña **Actions**: verás el run de `CI - Ecuador Travel Planner` en
verde y, justo después, el run de `CD - Ecuador Travel Planner (S3)`, que imprime
la URL (`http://<bucket>.s3-website-<region>.amazonaws.com`) en el resumen. Para
volver a publicar sin hacer commit, relanza el run del CI desde Actions: el CD se
dispara de nuevo. Los Pull Requests solo ejecutan el CI; no despliegan.

> Si el laboratorio bloquea “Block all public access”, el paso de permisos falla
> con un mensaje explicativo. En ese caso usa la Opción A/B y entrega la
> evidencia equivalente descrita más abajo.

---

## Verificación

Abre el enlace en el navegador y comprueba:

- `/` → carga el planificador.
- `/resenas` → carga la página de reseñas (no debe dar 404 de S3).
- `/mapas` → carga el visor de mapas.
- La consola del navegador no debe mostrar errores de MIME ni 403.

> El widget de chat con IA usa `VITE_AI_ENDPOINT`. Si el build se generó sin esa
> variable, `/api/gemini` no existe en S3 y el widget mostrará el modo
> demostración (o el error controlado si `VITE_AI_FALLBACK=off`).

---

## Si el laboratorio restringe el acceso público

Algunos entornos de AWS Academy bloquean desactivar “Block all public access”.
En ese caso, entrega **evidencia equivalente** con capturas de:

1. El bucket con los archivos subidos (Objects: `index.html`, `assets/`, etc.).
2. La configuración **Static website hosting** activada con `index.html`.
3. La **Bucket policy** aplicada.
4. El sitio intentando abrirse (y el error si aplica), o la consola del
   navegador.

Como alternativa con HTTPS se puede usar **CloudFront** con origen en el bucket
(ver abajo), pero requiere más pasos y permisos.

---

## HTTPS (opcional)

El endpoint de sitio web de S3 es **solo HTTP**. Para HTTPS hace falta otra capa:

- Crear una distribución de **CloudFront** con origen en el bucket.
- **Default root object**: `index.html`.
- **Custom error responses**: para `403` y `404` devolver `/index.html` con
  código `200` (así funcionan las rutas del SPA).
- (Opcional) Usar Origin Access Control y quitar la política pública del bucket.

No es necesario para esta entrega si se acepta el enlace HTTP de S3.

---

## Problemas frecuentes

| Síntoma | Causa / solución |
| --- | --- |
| `403 AccessDenied` al abrir el sitio | Falta la bucket policy o sigue activo “Block all public access”. |
| Se descarga `index.html` en vez de mostrarse | Content-Type incorrecto. Vuelve a subirlo como `text/html`. |
| Página en blanco y error de MIME en consola | El `.js` se sirvió como `binary/octet-stream`. Corrige su Content-Type a `text/javascript` o `application/javascript`. |
| `/resenas` da `404` | El **Error document** no está en `index.html`. |
| `BucketAlreadyExists` | El nombre de bucket es global; elige otro. |
| `AccessDenied` al crear el bucket | Región o permisos del laboratorio; revisa que sea la cuenta/región del lab. |
| El chat de IA muestra "Modo demostración" | Falta `VITE_AI_ENDPOINT` en el build o el backend no responde; revisa CORS y la URL de la función. |

---

## Limpieza (evitar cargos)

Al terminar la entrega, vacía y elimina el bucket:

```powershell
aws s3 rm "s3://MI_BUCKET" --recursive
aws s3api delete-bucket --bucket MI_BUCKET --region us-east-1
```
