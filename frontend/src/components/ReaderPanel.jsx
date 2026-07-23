import { lazy, Suspense, useCallback, useEffect, useState } from 'react';
import { X, Lock, Download, Maximize, Minimize } from './icons.jsx';
import { fileType } from '../lib/fileType.js';
import * as api from '../api.js';
import FavoriteButton from './FavoriteButton.jsx';

// El visor PDF.js (y su ~1 MB de dependencia) se carga solo al abrir un PDF.
const PdfViewer = lazy(() => import('./PdfViewer.jsx'));

// ¿Aplica el visor PROGRESIVO (carga por rangos)? Solo para PDFs binarios, que
// tienen tamaño conocido y Drive sirve por Range. Los Google Docs nativos se
// exportan a PDF al vuelo (sin Range) → modo blob. El resto de tipos → iframe.
function analyzeFile(file) {
  const mime = file.mime_type || '';
  const isNative = mime.startsWith('application/vnd.google-apps.');
  const isPdf = isNative || mime === 'application/pdf' || /\.pdf$/i.test(file.name || '');
  return { isNative, isPdf, progressive: isPdf && !isNative };
}

// El contenido se sirve SIEMPRE por el proxy autenticado del backend
// (`/api/items/{id}/content`). En modo progresivo PDF.js lo pide por rangos con
// el token en la cabecera; en modo blob se descarga completo. Ningún enlace de
// Drive llega al navegador. Un 403 (Pro sin plan) muestra el bloqueo.
export default function ReaderPanel({ file, plan, onRequirePro, onClose, focusMode = false, onToggleFocus }) {
  const { label, color } = fileType(file);
  const { isPdf, progressive } = analyzeFile(file);
  const isPro = plan === 'pro';

  // Modo PROGRESIVO: solo necesitamos el token (PDF.js baja el contenido por rangos).
  const [auth, setAuth] = useState({ ready: false, token: null });
  const [forbidden, setForbidden] = useState(false);
  const [viewerError, setViewerError] = useState(null);

  // Modo BLOB (exports nativos + no-PDF): descarga completa como antes.
  const [blobState, setBlobState] = useState({
    loading: true,
    url: null,
    blob: null,
    type: null,
    error: null,
    forbidden: false,
  });

  useEffect(() => {
    setForbidden(false);
    setViewerError(null);

    if (progressive) {
      setAuth({ ready: false, token: null });
      let active = true;
      api.getAccessToken().then((token) => {
        if (active) setAuth({ ready: true, token });
      });
      return () => {
        active = false;
      };
    }

    // --- Modo blob ---
    let cancelled = false;
    let objectUrl = null;
    setBlobState({ loading: true, url: null, blob: null, type: null, error: null, forbidden: false });
    api
      .fetchContent(file.id)
      .then(({ url, type, blob }) => {
        if (cancelled) {
          URL.revokeObjectURL(url);
          return;
        }
        objectUrl = url;
        setBlobState({ loading: false, url, blob, type, error: null, forbidden: false });
      })
      .catch((err) => {
        if (cancelled) return;
        setBlobState({
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
  }, [file.id, progressive]);

  // Descarga (Pro). Modo blob: reutiliza el blob (instantáneo). Progresivo:
  // re-fetchea el archivo completo al pulsar (no hay blob en memoria).
  const [downloading, setDownloading] = useState(false);
  const handleDownload = useCallback(async () => {
    if (!isPro) {
      onRequirePro?.(file);
      return;
    }
    try {
      setDownloading(true);
      let blob = blobState.blob;
      if (!blob) ({ blob } = await api.fetchContent(file.id));
      const objUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = objUrl;
      let name = file.name || 'documento';
      if (isPdf && !/\.pdf$/i.test(name)) name += '.pdf';
      a.download = name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(objUrl), 1000);
    } catch {
      /* la descarga falló; no rompe el visor */
    } finally {
      setDownloading(false);
    }
  }, [isPro, blobState.blob, file, isPdf, onRequirePro]);

  const isForbidden = progressive ? forbidden : blobState.forbidden;
  const error = progressive ? viewerError : blobState.error;
  // Descarga disponible cuando el documento es accesible (Pro reutiliza/re-fetchea).
  const canDownload =
    !error && !isForbidden && (progressive ? auth.ready : !!blobState.blob);

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
          {onToggleFocus && (
            <button
              type="button"
              className="iconbtn iconbtn--sm"
              onClick={onToggleFocus}
              title={focusMode ? 'Salir del modo enfoque (Esc)' : 'Modo enfoque: lectura sin distracciones'}
              aria-label={focusMode ? 'Salir del modo enfoque' : 'Activar modo enfoque'}
              aria-pressed={focusMode}
            >
              {focusMode ? <Minimize width={16} height={16} /> : <Maximize width={16} height={16} />}
            </button>
          )}
          <FavoriteButton item={file} className="fav--bar" />
          {canDownload && (
            <button
              type="button"
              className={'iconbtn iconbtn--sm' + (isPro ? '' : ' iconbtn--pro')}
              onClick={handleDownload}
              disabled={downloading}
              title={isPro ? 'Descargar' : 'Descargar (Pro)'}
              aria-label={isPro ? 'Descargar documento' : 'Descargar (exclusivo Pro)'}
            >
              <Download width={16} height={16} />
            </button>
          )}
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
        {isForbidden ? (
          <div className="reader__locked">
            <span className="reader__lockicon" aria-hidden="true">
              <Lock width={26} height={26} />
            </span>
            <p className="reader__lockedtitle">Contenido exclusivo Pro</p>
            <p className="muted">Mejora tu plan para acceder a este documento.</p>
          </div>
        ) : error ? (
          <div className="grid-state error">{error}</div>
        ) : progressive ? (
          auth.ready ? (
            <Suspense fallback={<div className="grid-state muted">Cargando visor…</div>}>
              <PdfViewer
                key={file.id}
                url={api.contentUrl(file.id)}
                httpHeaders={
                  auth.token ? { Authorization: `Bearer ${auth.token}` } : undefined
                }
                sizeBytes={file.size}
                onForbidden={() => setForbidden(true)}
              />
            </Suspense>
          ) : (
            <div className="grid-state muted">Cargando…</div>
          )
        ) : blobState.loading ? (
          <div className="grid-state muted">Cargando…</div>
        ) : isPdf && blobState.blob ? (
          <Suspense fallback={<div className="grid-state muted">Cargando visor…</div>}>
            <PdfViewer key={file.id} blob={blobState.blob} />
          </Suspense>
        ) : blobState.url ? (
          <iframe
            key={file.id}
            className="reader__iframe"
            src={blobState.url}
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
