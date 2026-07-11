// Capa de acceso a la API REST de Psicoteca.
//
// Todas las llamadas usan rutas relativas ('/api/...'). En desarrollo, el proxy
// de Vite las redirige al backend FastAPI (ver vite.config.js). Se puede forzar
// otro origen con la variable de entorno VITE_API_BASE.

import { supabase } from './lib/supabaseClient.js';

const API_BASE = import.meta.env.VITE_API_BASE ?? '';

// Adjunta el token de Supabase (si hay sesión) para que el backend conozca el
// plan del usuario y decida qué contenido enviar. getSession() lee de
// localStorage (sin red), así que es barato.
async function authHeaders() {
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const token = session?.access_token;
    return token ? { Authorization: `Bearer ${token}` } : {};
  } catch {
    return {};
  }
}

async function http(path) {
  const res = await fetch(`${API_BASE}${path}`, { headers: await authHeaders() });
  if (!res.ok) {
    let detail = `HTTP ${res.status}`;
    try {
      const body = await res.json();
      if (body && body.detail) detail = body.detail;
    } catch {
      /* respuesta sin cuerpo JSON */
    }
    const err = new Error(detail);
    err.status = res.status; // permite distinguir 403 (contenido Pro), etc.
    throw err;
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

/**
 * Descarga el contenido REAL del archivo desde el proxy autenticado del backend
 * (envía el token de Supabase). Devuelve el `blob`, su `type` y un object `url`.
 * Los PDF se renderizan con PDF.js a partir del blob (scroll en móvil); el resto
 * de tipos se incrustan con el object URL en un iframe. Lanza un Error con
 * `.status === 403` si el usuario no tiene acceso (contenido Pro). El llamador
 * debe revocar la URL con URL.revokeObjectURL.
 */
export async function fetchContent(id) {
  const res = await fetch(
    `${API_BASE}/api/items/${encodeURIComponent(id)}/content`,
    { headers: await authHeaders() }
  );
  if (!res.ok) {
    let detail = `HTTP ${res.status}`;
    try {
      const body = await res.json();
      if (body && body.detail) detail = body.detail;
    } catch {
      /* respuesta sin cuerpo JSON */
    }
    const err = new Error(detail);
    err.status = res.status;
    throw err;
  }
  const blob = await res.blob();
  return { url: URL.createObjectURL(blob), type: blob.type, blob };
}
