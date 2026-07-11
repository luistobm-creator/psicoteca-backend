import { lazy, Suspense, useEffect, useState } from 'react';
import { X, Lock } from './icons.jsx';
import { fileType } from '../lib/fileType.js';
import * as api from '../api.js';

// El visor PDF.js (y su ~1 MB de dependencia) se carga solo al abrir un PDF.
const PdfViewer = lazy(() => import('./PdfViewer.jsx'));

// El contenido se sirve SIEMPRE por el proxy autenticado del backend
// (`/api/items/{id}/content`): se descarga con el token de Supabase y se
// incrusta como object URL. Ningún enlace de Drive llega al navegador. Si el
// backend responde 403 (contenido Pro sin plan), se muestra el bloqueo.
export default function ReaderPanel({ file, onClose }) {
  const { label, color } = fileType(file);
  const [state, setState] = useState({
    loading: true,
    url: null,
    blob: null,
    type: null,
    error: null,
    forbidden: false,
  });

  useEffect(() => {
    let cancelled = false;
    let objectUrl = null;
    setState({ loading: true, url: null, blob: null, type: null, error: null, forbidden: false });

    api
      .fetchContent(file.id)
      .then(({ url, type, blob }) => {
        if (cancelled) {
          URL.revokeObjectURL(url);
          return;
        }
        objectUrl = url;
        setState({ loading: false, url, blob, type, error: null, forbidden: false });
      })
      .catch((err) => {
        if (cancelled) return;
        setState({
          loading: false,
          url: null,
          blob: null,
          type: null,
          error: err.message || 'No se pudo abrir el documento.',
          forbidden: err.status === 403,
        });
      });

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [file.id]);

  const { loading, url, blob, type, error, forbidden } = state;
  // Los PDF (incluidos los Google Docs exportados a PDF por el backend) se
  // renderizan con PDF.js para poder desplazarse en móvil; el iframe de iOS solo
  // muestra la 1ª página.
  const isPdf = type === 'application/pdf' || /\.pdf$/i.test(file.name || '');

  return (
    <aside className="reader">
      <header className="reader__bar">
        <span className="reader__chip" style={{ '--chip': color }}>
          {label}
        </span>
        <span className="reader__name" title={file.name}>
          {file.name}
        </span>
        <div className="reader__actions">
          <button
            type="button"
            className="iconbtn iconbtn--sm"
            onClick={onClose}
            title="Cerrar lector"
            aria-label="Cerrar lector"
          >
            <X width={16} height={16} />
          </button>
        </div>
      </header>

      <div className="reader__frame">
        {loading ? (
          <div className="grid-state muted">Cargando…</div>
        ) : forbidden ? (
          <div className="reader__locked">
            <span className="reader__lockicon" aria-hidden="true">
              <Lock width={26} height={26} />
            </span>
            <p className="reader__lockedtitle">Contenido exclusivo Pro</p>
            <p className="muted">Mejora tu plan para acceder a este documento.</p>
          </div>
        ) : error ? (
          <div className="grid-state error">{error}</div>
        ) : isPdf && blob ? (
          <Suspense fallback={<div className="grid-state muted">Cargando visor…</div>}>
            <PdfViewer key={file.id} blob={blob} />
          </Suspense>
        ) : url ? (
          <iframe
            key={file.id}
            className="reader__iframe"
            src={url}
            title={file.name}
            allow="autoplay; encrypted-media; fullscreen"
          />
        ) : (
          <div className="grid-state muted">Este elemento no se puede previsualizar.</div>
        )}
      </div>

      <footer className="reader__foot">
        <span className="muted">
          La vista previa se sirve de forma segura desde el servidor.
        </span>
      </footer>
    </aside>
  );
}
