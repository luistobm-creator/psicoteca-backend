// "Accesos rápidos": últimos documentos abiertos, persistidos en el propio
// navegador (no hay tabla de servidor para esto). App.jsx escribe aquí cada
// vez que se abre un archivo; cualquier otra pantalla puede leerlo para
// ofrecer "continuar donde te quedaste" sin depender de estado en memoria.
export const RECENTS_KEY = 'psicoteca-recents-v1';
export const RECENTS_MAX = 6;

/** Lista de archivos recientes (más nuevo primero). Nunca lanza. */
export function readRecents() {
  try {
    const raw = localStorage.getItem(RECENTS_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/** El archivo abierto más recientemente, o null si no hay ninguno. */
export function readLastOpened() {
  return readRecents()[0] || null;
}
