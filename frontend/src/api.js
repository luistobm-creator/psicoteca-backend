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

// Petición genérica con el token de Supabase. Soporta método, cuerpo JSON y
// respuestas 204 (sin cuerpo, p. ej. DELETE). Adjunta `.status` al error para
// que el llamador distinga 401 (sin sesión), 403 (Pro), 409 (duplicado), etc.
async function request(method, path, body) {
  const headers = { ...(await authHeaders()) };
  const opts = { method, headers };
  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    opts.body = JSON.stringify(body);
  }
  const res = await fetch(`${API_BASE}${path}`, opts);
  if (!res.ok) {
    let detail = `HTTP ${res.status}`;
    try {
      const errBody = await res.json();
      if (errBody && errBody.detail) detail = errBody.detail;
    } catch {
      /* respuesta sin cuerpo JSON */
    }
    const err = new Error(detail);
    err.status = res.status;
    throw err;
  }
  if (res.status === 204) return null;
  return res.json();
}

// GET simple (retrocompatible con las llamadas existentes).
function http(path) {
  return request('GET', path);
}

/** Resumen global de la biblioteca (para el Dashboard). */
export function getStats() {
  return http('/api/stats');
}

/** Árbol jerárquico de carpetas (para el Sidebar). */
export function getTree() {
  return http('/api/tree');
}

/**
 * Contenido paginado (carpetas + archivos) de una carpeta.
 * `orderBy`: name | name_desc | recent | oldest | largest | smallest.
 */
export function getFolderItems(
  folderId,
  { page = 1, pageSize = 60, orderBy = 'name' } = {}
) {
  const qs = new URLSearchParams({ page, page_size: pageSize, order_by: orderBy });
  return http(`/api/folders/${encodeURIComponent(folderId)}/items?${qs}`);
}

/** Búsqueda full-text por nombre y ruta. */
export function search(
  q,
  { limit = 50, offset = 0, foldersOnly = false, orderBy = 'relevance' } = {}
) {
  const qs = new URLSearchParams({
    q,
    limit,
    offset,
    folders_only: foldersOnly,
    order_by: orderBy,
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

/** URL absoluta del contenido de un item (para carga progresiva de PDF.js). */
export function contentUrl(id) {
  return `${API_BASE}/api/items/${encodeURIComponent(id)}/content`;
}

/**
 * Token de acceso actual de Supabase, para pasarlo como cabecera a PDF.js en la
 * carga progresiva por rangos. Devuelve null si no hay sesión (documento libre).
 */
export async function getAccessToken() {
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    return session?.access_token ?? null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Favoritos (playlists). Todas requieren sesión: el backend reenvía el JWT a
// Supabase y las políticas RLS garantizan que cada usuario solo ve/toca lo suyo.
// ---------------------------------------------------------------------------

/** Lista las playlists del usuario (cada una con su `item_count`). */
export function getPlaylists() {
  return request('GET', '/api/playlists');
}

/** Crea una playlist con el nombre dado. Devuelve la playlist creada. */
export function createPlaylist(name) {
  return request('POST', '/api/playlists', { name });
}

/** Detalle de una playlist con sus PDFs (metadata resuelta del catálogo). */
export function getPlaylist(playlistId) {
  return request('GET', `/api/playlists/${encodeURIComponent(playlistId)}`);
}

/** Agrega un documento a una playlist. Lanza Error con `.status === 409` si ya estaba. */
export function addToPlaylist(playlistId, itemId) {
  return request('POST', `/api/playlists/${encodeURIComponent(playlistId)}/items`, {
    item_id: itemId,
  });
}

/** Quita un documento de una playlist. */
export function removeFromPlaylist(playlistId, itemId) {
  return request(
    'DELETE',
    `/api/playlists/${encodeURIComponent(playlistId)}/items/${encodeURIComponent(itemId)}`
  );
}

// ---------------------------------------------------------------------------
// Cuenta
// ---------------------------------------------------------------------------

/**
 * Borra DEFINITIVAMENTE la cuenta del usuario autenticado. El backend cancela
 * primero la suscripción de Stripe (si la hay) y luego elimina el usuario en
 * Supabase (sus favoritos caen por cascade). Responde 204 (sin cuerpo). Requiere
 * sesión: el backend identifica al usuario por su token (no por un id de entrada).
 */
export function deleteAccount() {
  return request('DELETE', '/api/account');
}

// ---------------------------------------------------------------------------
// Glosario clínico (términos personales). Requiere sesión: el backend reenvía
// el JWT a Supabase y las políticas RLS garantizan que cada usuario solo ve/
// toca los suyos.
// ---------------------------------------------------------------------------

/** Lista los términos del glosario del usuario (orden alfabético). */
export function getGlosario() {
  return request('GET', '/api/glosario');
}

/** Crea un término. `categoria` es opcional. */
export function createGlosarioTermino({ termino, definicion, categoria }) {
  return request('POST', '/api/glosario', { termino, definicion, categoria });
}

/** Elimina un término (solo si es del usuario autenticado). */
export function deleteGlosarioTermino(id) {
  return request('DELETE', `/api/glosario/${encodeURIComponent(id)}`);
}

// ---------------------------------------------------------------------------
// Agenda de citas. Mismo esquema de sesión/RLS que el Glosario.
// ---------------------------------------------------------------------------

/** Lista las citas programadas del usuario. `desde`/`hasta`: 'YYYY-MM-DD' (opcionales). */
export function getAgenda({ desde, hasta } = {}) {
  const qs = new URLSearchParams();
  if (desde) qs.set('desde', desde);
  if (hasta) qs.set('hasta', hasta);
  const suffix = qs.toString() ? `?${qs}` : '';
  return request('GET', `/api/agenda${suffix}`);
}

/** Crea una cita. `payload`: paciente_nombre, fecha, hora, tipo_sesion, duracion_minutos, modalidad, recordatorio. */
export function createCita(payload) {
  return request('POST', '/api/agenda', payload);
}

/** Actualiza una cita (parcial): reprogramar (fecha/hora), cancelar (estado) o alternar recordatorio. */
export function updateCita(id, changes) {
  return request('PATCH', `/api/agenda/${encodeURIComponent(id)}`, changes);
}

/** Elimina una cita definitivamente. */
export function deleteCita(id) {
  return request('DELETE', `/api/agenda/${encodeURIComponent(id)}`);
}
