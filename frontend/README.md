# Psicoteca · Frontend (Fase 3)

Explorador web de la biblioteca Psicoteca. React + Vite, consume la API REST
de la Fase 2.

## Requisitos

- Node.js 18+ (probado con Node 24).
- El **backend** de la Fase 2 corriendo en `http://127.0.0.1:8000`.

## Puesta en marcha

```bash
# 1) Instalar dependencias (una sola vez)
cd D:\CLAUDE\frontend
npm install

# 2) Levantar el backend en otra terminal (carpeta backend, con el venv):
#    uvicorn app.main:app --reload

# 3) Arrancar el frontend
npm run dev
```

Abre **http://localhost:5173**.

Vite hace de proxy de `/api/*` hacia el backend (ver `vite.config.js`), así que
no hay problemas de CORS en desarrollo.

## Funcionalidad

- **Sidebar**: árbol de carpetas (`GET /api/tree`), con expandir/contraer.
- **Grid**: contenido paginado de la carpeta (`GET /api/folders/{id}/items`),
  carpetas primero. Clic en archivo → lo abre en Google Drive.
- **Búsqueda**: barra superior del sidebar (`GET /api/search`), instantánea
  (FTS5) con _debounce_; muestra la ruta de cada resultado.
- **Breadcrumb** navegable y **tema claro/oscuro** (se recuerda).

## Build de producción

```bash
npm run build      # genera dist/
npm run preview    # sirve el build localmente
```

Para producción, sirve `dist/` detrás del mismo origen que la API, o define
`VITE_API_BASE` con la URL del backend al construir.
