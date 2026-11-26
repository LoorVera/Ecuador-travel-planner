# Evidencias para la entrega

Guarda aquí las capturas del proyecto. Nombres sugeridos (el registro de
versiones las referencia):

| Archivo | Qué debe mostrar |
| --- | --- |
| `s3-sitio-home.png` | Sitio publicado en S3, con la URL visible en la barra del navegador |
| `s3-rutas.png` | `/resenas` o `/mapas` cargando al recargar (prueba del error document) |
| `bucket-objetos.png` | Consola de S3 con `index.html`, `assets/`, `favicon.svg` e `icons.svg` |
| `bucket-hosting.png` | *Static website hosting* activo con `index.html` como index y error |
| `bucket-politica.png` | *Bucket policy* de lectura pública |
| `ci-verde.png` | Ejecución del workflow en verde (pestaña Actions) |
| `ci-artifact.png` | Artifact `dist` generado en esa misma ejecución |
| `ia-funcionando.png` | Chat con recomendaciones reales de Gemini |
| `ia-error.png` | Caso de error controlado (`?simularFallo=1`) con el botón Reintentar |
| `v1-antes.png` | Sitio con la versión 1 publicada |
| `v1-despues.png` | Sitio con la versión 2 publicada y el cambio visible |

## Consejos

- Incluye siempre la URL del sitio en la captura: demuestra que es el S3 real.
- Para el error controlado usa `?simularFallo=1`; es reproducible y no depende de
  que Gemini falle ese día.
- Si el laboratorio bloquea el acceso público del bucket, captura además
  `bucket-objetos.png`, `bucket-hosting.png` y `bucket-politica.png` como
  evidencia equivalente (ver `docs/DESPLIEGUE-S3.md`).
- Toma las capturas del artifact antes de que expire (14 días desde el run).
