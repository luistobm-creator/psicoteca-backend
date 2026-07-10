// Construye la URL de PREVISUALIZACIÓN incrustable de Google Drive.
//
// Importante: el `webViewLink` (…/view) NO se puede meter en un <iframe>
// (Google lo bloquea con X-Frame-Options). En cambio, el endpoint …/preview
// está pensado para incrustar. Como `item.id` es el ID nativo de Drive,
// generamos la URL correcta según el tipo de documento.

export function drivePreviewUrl(item) {
  if (!item || !item.id) return null;
  const id = item.id;
  switch (item.mime_type) {
    case 'application/vnd.google-apps.document':
      return `https://docs.google.com/document/d/${id}/preview`;
    case 'application/vnd.google-apps.spreadsheet':
      return `https://docs.google.com/spreadsheets/d/${id}/preview`;
    case 'application/vnd.google-apps.presentation':
      return `https://docs.google.com/presentation/d/${id}/preview`;
    default:
      // PDF, imágenes, audio, vídeo, ofimática, etc.
      return `https://drive.google.com/file/d/${id}/preview`;
  }
}
