# Registro de versiones publicadas

Trazabilidad `commit → CI → build → publicación` de las dos versiones
entregadas. Completa los campos marcados con `TODO` después de cada despliegue.

## Resumen

| Versión | Fecha | Commit | Ejecución de CI | Artifact | URL publicada |
| --- | --- | --- | --- | --- | --- |
| v1.0.0 | TODO | TODO | TODO | TODO | TODO |
| v1.1.0 | TODO | TODO | TODO | TODO | TODO |

## v1.0.0 — versión inicial

- **Commit:** `TODO` (mensaje: `TODO`)
- **Tag:** `v1.0.0`
- **CI:** `TODO` (enlace a `https://github.com/LoorVera/Ecuador-travel-planner/actions/runs/...`)
- **Artifact:** `dist` — `TODO` (ID y fecha de expiración)
- **Build local:** `npm run build` → `dist/`
- **Publicación:** `scripts/deploy-s3.ps1` → bucket `TODO`
- **Cambios incluidos:** frontend React del curso anterior, asistente Gemini con
  validación de entrada/salida, error controlado, CORS y modo demostración.
- **Capturas:** `docs/evidencias/v1-*.png`

## v1.1.0 — cambio de la segunda versión

- **Commit:** `TODO` (mensaje: `TODO`)
- **Tag:** `v1.1.0`
- **CI:** `TODO`
- **Artifact:** `dist` — `TODO`
- **Publicación:** `scripts/deploy-s3.ps1` → bucket `TODO`
- **Qué cambió respecto a v1.0.0:**
  - `TODO` (describe el cambio visible: texto, sección o funcionalidad)
- **Capturas antes/después:** `docs/evidencias/v1-antes.png`,
  `docs/evidencias/v1-despues.png`

## Cómo generar la evidencia de cada versión

```powershell
# 1. Asegura el árbol limpio y el commit publicado
git status
git log -1 --oneline

# 2. Build y publicación
npm run build
powershell -ExecutionPolicy Bypass -File .\scripts\deploy-s3.ps1 -Bucket MI_BUCKET -SkipBuild

# 3. Etiqueta la versión y súbela
git tag -a v1.0.0 -m "v1.0.0 - primera version publicada"
git push origin v1.0.0
```

Después de cada push:

1. Abre la pestaña **Actions** y copia el enlace del run en verde.
2. En el run, descarga el artifact `dist` y anota su ID.
3. Toma las capturas del sitio publicado (incluye la URL en la barra del
   navegador) y guárdalas en `docs/evidencias/`.

## Lista de verificación para la presentación

- [ ] El run de CI de la versión mostrada está en verde.
- [ ] El artifact `dist` del mismo run existe y no ha expirado.
- [ ] El sitio publicado muestra el cambio de la versión.
- [ ] El chat de IA responde (real o modo demostración, indicado en pantalla).
- [ ] `?simularFallo=1` muestra el error controlado con botón Reintentar.
- [ ] Las capturas antes/después están en `docs/evidencias/`.
