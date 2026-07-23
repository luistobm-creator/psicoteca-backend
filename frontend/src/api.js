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

// ---------------------------------------------------------------------------
// Directorio de pacientes. Mismo esquema de sesión/RLS. Los pacientes se
// archivan (activo:false) en vez de borrarse.
// ---------------------------------------------------------------------------

/** Lista pacientes activos. `q` (opcional) filtra por nombre o motivo en el servidor. */
export function getPacientes(q) {
  const qs = q && q.trim() ? `?q=${encodeURIComponent(q.trim())}` : '';
  return request('GET', `/api/pacientes${qs}`);
}

/** Crea un paciente. `payload`: nombre, edad, telefono, motivo, notas (todos menos nombre son opcionales). */
export function createPaciente(payload) {
  return request('POST', '/api/pacientes', payload);
}

/** Actualiza datos de un paciente, o lo archiva con `{ activo: false }`. */
export function updatePaciente(id, changes) {
  return request('PATCH', `/api/pacientes/${encodeURIComponent(id)}`, changes);
}

// ---------------------------------------------------------------------------
// Notas de voz. El audio vive en Supabase Storage (bucket privado); esta capa
// nunca ve ni expone un link directo — solo sube el blob y, para reproducir,
// pide el proxy autenticado del backend (igual que los PDFs de Drive).
// ---------------------------------------------------------------------------

/** Lista las notas de voz (metadatos) de un paciente. */
export function getNotasVoz(pacienteId) {
  return request('GET', `/api/notas-voz?paciente_id=${encodeURIComponent(pacienteId)}`);
}

/**
 * Sube una nota de voz nueva. `blob`: el audio grabado (Blob de MediaRecorder).
 * `meta`: { paciente_id, cita_id?, titulo?, duracion_segundos? }.
 * Es multipart/form-data, así que NO pasa por `request()` (que siempre manda JSON).
 */
export async function uploadNotaVoz(blob, meta) {
  // La extensión sigue el mimeType real del blob (varía por navegador: Chrome
  // suele grabar audio/webm, Safari audio/mp4) para que el backend guarde el
  // archivo con la extensión correcta en Storage.
  const subtype = (blob.type || 'audio/webm').split(';')[0].split('/')[1] || 'webm';
  const form = new FormData();
  form.append('audio', blob, `nota.${subtype}`);
  form.append('paciente_id', meta.paciente_id);
  if (meta.cita_id) form.append('cita_id', meta.cita_id);
  if (meta.titulo) form.append('titulo', meta.titulo);
  if (meta.duracion_segundos != null) form.append('duracion_segundos', String(meta.duracion_segundos));

  const res = await fetch(`${API_BASE}/api/notas-voz`, {
    method: 'POST',
    headers: await authHeaders(), // sin Content-Type: el navegador pone el boundary correcto
    body: form,
  });
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
  return res.json();
}

/** Elimina una nota de voz (audio + metadatos) definitivamente. */
export function deleteNotaVoz(id) {
  return request('DELETE', `/api/notas-voz/${encodeURIComponent(id)}`);
}

/**
 * Descarga el audio de una nota como blob y devuelve un object URL listo para
 * un <audio src=…>. Un <audio> nativo no puede mandar el header
 * Authorization, así que no se le puede dar la URL del backend directo (como
 * sí se hace con PDF.js, que sí soporta headers propios) — se pide con
 * fetch() autenticado, igual que `fetchContent()` para archivos no-PDF.
 * El llamador debe revocar la URL con URL.revokeObjectURL cuando ya no se use.
 */
export async function fetchNotaVozAudio(id) {
  const res = await fetch(`${API_BASE}/api/notas-voz/${encodeURIComponent(id)}/audio`, {
    headers: await authHeaders(),
  });
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
  return URL.createObjectURL(blob);
}

// ---------------------------------------------------------------------------
// Tareas terapéuticas. Mismo esquema de sesión/RLS. Lista TODAS las tareas del
// usuario (across pacientes) salvo que se pida un paciente puntual; "borrar"
// normal es cancelar (PATCH estado), no hay botón de borrado duro en la UI.
// ---------------------------------------------------------------------------

/** Lista las tareas (pendientes + completadas, nunca canceladas). `pacienteId` opcional. */
export function getTareas(pacienteId) {
  const qs = pacienteId ? `?paciente_id=${encodeURIComponent(pacienteId)}` : '';
  return request('GET', `/api/tareas${qs}`);
}

/** Asigna una tarea. `payload`: paciente_id, titulo, tipo, descripcion, fecha_limite (los últimos 2 opcionales). */
export function createTarea(payload) {
  return request('POST', '/api/tareas', payload);
}

/** Actualiza una tarea: editar campos, marcar completada/reabrir (estado) o cancelar (estado). */
export function updateTarea(id, changes) {
  return request('PATCH', `/api/tareas/${encodeURIComponent(id)}`, changes);
}

// ---------------------------------------------------------------------------
// Modo examen. Las preguntas se generan en el propio cliente a partir de
// getGlosario() (sin endpoint nuevo de lectura del glosario); esta capa solo
// guarda y lista el HISTORIAL de resultados ya calificados.
// ---------------------------------------------------------------------------

/** Historial de exámenes del usuario (más reciente primero). */
export function getExamenes() {
  return request('GET', '/api/examenes');
}

/** Guarda el resultado de un examen recién terminado (ya calificado en el cliente). */
export function createExamen(payload) {
  return request('POST', '/api/examenes', payload);
}

/** Borra un resultado del historial. */
export function deleteExamen(id) {
  return request('DELETE', `/api/examenes/${encodeURIComponent(id)}`);
}

// ---------------------------------------------------------------------------
// Facturación y pagos. Mismo esquema de sesión/RLS. Un cobro no se borra: se
// anula (PATCH estado='anulado'), igual criterio que tareas/pacientes/citas.
// ---------------------------------------------------------------------------

/** Lista los cobros del usuario (más reciente primero). `pacienteId` opcional. */
export function getFacturacion(pacienteId) {
  const qs = pacienteId ? `?paciente_id=${encodeURIComponent(pacienteId)}` : '';
  return request('GET', `/api/facturacion${qs}`);
}

/** Registra un cobro. `payload`: paciente_id, monto, fecha, concepto (opcional). */
export function createFacturacion(payload) {
  return request('POST', '/api/facturacion', payload);
}

/** Actualiza un cobro: corregir campos, marcar pagado o anular (estado). */
export function updateFacturacion(id, changes) {
  return request('PATCH', `/api/facturacion/${encodeURIComponent(id)}`, changes);
}

// ---------------------------------------------------------------------------
// Configurar consultorio. Una sola fila por usuario (upsert).
// ---------------------------------------------------------------------------

/** Lee la configuración del consultorio (defaults razonables si aún no existe). */
export function getConsultorioConfig() {
  return request('GET', '/api/consultorio-config');
}

/** Guarda (crea o actualiza) la configuración del consultorio. */
export function saveConsultorioConfig(payload) {
  return request('PUT', '/api/consultorio-config', payload);
}

// ---------------------------------------------------------------------------
// Plantillas de formato. Mismo esquema de sesión/RLS que el Glosario.
// ---------------------------------------------------------------------------

/** Lista las plantillas del usuario (orden alfabético). */
export function getPlantillas() {
  return request('GET', '/api/plantillas');
}

/** Crea una plantilla. */
export function createPlantilla(payload) {
  return request('POST', '/api/plantillas', payload);
}

/** Actualiza (edita) una plantilla. */
export function updatePlantilla(id, changes) {
  return request('PATCH', `/api/plantillas/${encodeURIComponent(id)}`, changes);
}

/** Elimina una plantilla. */
export function deletePlantilla(id) {
  return request('DELETE', `/api/plantillas/${encodeURIComponent(id)}`);
}
