// Capa de acceso a la API REST de Psicoteca.
//
// Todas las llamadas usan rutas relativas ('/api/...'). En desarrollo, el proxy
// de Vite las redirige al backend FastAPI (ver vite.config.js). Se puede forzar
// otro origen con la variable de entorno VITE_API_BASE.

const API_BASE = import.meta.env.VITE_API_BASE ?? '';

async function http(path) {
  const res = await fetch(`${API_BASE}${path}`);
  if (!res.ok) {
    let detail = `HTTP ${res.status}`;
    try {
      const body = await res.json();
      if (body && body.detail) detail = body.detail;
    } catch {
      /* respuesta sin cuerpo JSON */
    }
    throw new Error(detail);
  }
  return res.json();
}

/** Resumen global de la biblioteca (para el Dashboard). */
export function getStats() {
  return http('/api/stats');
}

/** Árbol jerárquico de carpetas (para el Sidebar). */
export function getTree() {
  return http('/api/tree');
}

/** Contenido paginado (carpetas + archivos) de una carpeta. */
export function getFolderItems(folderId, { page = 1, pageSize = 60 } = {}) {
  const qs = new URLSearchParams({ page, page_size: pageSize });
  return http(`/api/folders/${encodeURIComponent(folderId)}/items?${qs}`);
}

/** Búsqueda full-text por nombre y ruta. */
export function search(q, { limit = 50, offset = 0, foldersOnly = false } = {}) {
  const qs = new URLSearchParams({
    q,
    limit,
    offset,
    folders_only: foldersOnly,
  });
  return http(`/api/search?${qs}`);
}
