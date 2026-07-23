// Utilidades de presentación de archivos: etiqueta/color por tipo, tamaño y fecha.

// Extensión -> [etiqueta, color]. El color se usa para el "chip" del icono.
const EXT_MAP = {
  pdf: ['PDF', '#e5484d'],
  doc: ['DOC', '#2f6feb'],
  docx: ['DOC', '#2f6feb'],
  xls: ['XLS', '#2ea043'],
  xlsx: ['XLS', '#2ea043'],
  csv: ['CSV', '#2ea043'],
  ppt: ['PPT', '#e8830c'],
  pptx: ['PPT', '#e8830c'],
  mp3: ['AUDIO', '#8957e5'],
  wav: ['AUDIO', '#8957e5'],
  m4a: ['AUDIO', '#8957e5'],
  ogg: ['AUDIO', '#8957e5'],
  flac: ['AUDIO', '#8957e5'],
  mp4: ['VIDEO', '#d6336c'],
  mov: ['VIDEO', '#d6336c'],
  avi: ['VIDEO', '#d6336c'],
  mkv: ['VIDEO', '#d6336c'],
  webm: ['VIDEO', '#d6336c'],
  jpg: ['IMG', '#0d9488'],
  jpeg: ['IMG', '#0d9488'],
  png: ['IMG', '#0d9488'],
  gif: ['IMG', '#0d9488'],
  webp: ['IMG', '#0d9488'],
  svg: ['IMG', '#0d9488'],
  zip: ['ZIP', '#6b7280'],
  rar: ['ZIP', '#6b7280'],
  '7z': ['ZIP', '#6b7280'],
  txt: ['TXT', '#6b7280'],
  rtf: ['TXT', '#6b7280'],
  epub: ['EPUB', '#0891b2'],
  mobi: ['EPUB', '#0891b2'],
};

// Tipos nativos de Google Drive (no tienen extensión en el nombre).
const GOOGLE_MAP = {
  'application/vnd.google-apps.document': ['GDOC', '#2f6feb'],
  'application/vnd.google-apps.spreadsheet': ['GSHEET', '#2ea043'],
  'application/vnd.google-apps.presentation': ['GSLIDES', '#e8830c'],
  'application/vnd.google-apps.form': ['GFORM', '#7c3aed'],
  'application/vnd.google-apps.drawing': ['GDRAW', '#d6336c'],
};

/** Devuelve { label, color } para el icono de un archivo. */
export function fileType(item) {
  if (item.mime_type && GOOGLE_MAP[item.mime_type]) {
    const [label, color] = GOOGLE_MAP[item.mime_type];
    return { label, color };
  }
  const name = item.name || '';
  const dot = name.lastIndexOf('.');
  const ext = dot > 0 ? name.slice(dot + 1).toLowerCase() : '';
  if (ext && EXT_MAP[ext]) {
    return { label: EXT_MAP[ext][0], color: EXT_MAP[ext][1] };
  }
  return { label: (ext || 'FILE').slice(0, 4).toUpperCase(), color: '#64748b' };
}

/** Formatea bytes de forma legible (p. ej. 2.3 MB). */
export function formatSize(bytes) {
  if (bytes == null) return '';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let n = bytes;
  let i = 0;
  while (n >= 1024 && i < units.length - 1) {
    n /= 1024;
    i += 1;
  }
  const decimals = i === 0 || n >= 10 ? 0 : 1;
  return `${n.toFixed(decimals)} ${units[i]}`;
}

/** Formatea una fecha ISO a algo corto en español (p. ej. 5 mar 2024). */
export function formatDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('es', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

/** Hora relativa breve en español ("hace 2 días"), para timelines/actividad. */
export function timeAgo(date) {
  const diffMs = Date.now() - date.getTime();
  const min = Math.floor(diffMs / 60000);
  if (min < 1) return 'ahora';
  if (min < 60) return `hace ${min} min`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `hace ${hr} h`;
  const day = Math.floor(hr / 24);
  if (day === 1) return 'ayer';
  if (day < 7) return `hace ${day} días`;
  const week = Math.floor(day / 7);
  if (week < 5) return `hace ${week} sem`;
  return date.toLocaleDateString('es', { day: 'numeric', month: 'short' });
}
