import { useCallback, useEffect, useRef, useState } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
// El worker se sirve como asset propio de Vite (mismo origen, sin CDN externo).
import workerSrc from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { formatSize } from '../lib/fileType.js';

pdfjsLib.GlobalWorkerOptions.workerSrc = workerSrc;

// Cap de nitidez: en móviles devicePixelRatio puede ser 3; limitarlo a 2 evita
// que los <canvas> disparen el consumo de memoria (Safari iOS es sensible).
const MAX_DPR = 2;
// A partir de este tamaño mostramos "documento grande" durante la carga.
const HEAVY_BYTES = 15 * 1024 * 1024;
// Zoom.
const ZOOM_MIN = 0.6;
const ZOOM_MAX = 2.6;
const ZOOM_STEP = 0.2;
const MAX_PAGE_WIDTH = 900; // ancho base de página a zoom 100%

/**
 * Visor de PDF con scroll nativo y renderizado PEREZOSO por página.
 *
 * Dos modos de carga:
 *  - `url` (+ `httpHeaders`): carga PROGRESIVA por rangos (`disableAutoFetch`).
 *    PDF.js baja solo el índice y las páginas visibles → un PDF de 97 MB muestra
 *    la 1ª página en segundos, sin descargar el archivo entero.
 *  - `blob`: carga en memoria (para exports nativos de Google, ya descargados).
 *
 * Controles: zoom (±) y salto a página, en una barra flotante. El zoom RE-RENDERIZA
 * las páginas visibles al nuevo tamaño (nítido, no un escalado CSS borroso).
 *
 * `sizeBytes` (opcional) avisa de un documento grande en la carga.
 * `onForbidden` se invoca si el backend responde 403 (contenido Pro sin plan).
 */
export default function PdfViewer({ blob, url, httpHeaders, sizeBytes, onForbidden }) {
  const scrollRef = useRef(null);
  const pagesRef = useRef(null);
  const baseWidthRef = useRef(800);
  const zoomRef = useRef(1);
  const currentPageRef = useRef(1);
  const relayoutRef = useRef(null);
  const goToPageRef = useRef(null);

  const [status, setStatus] = useState({ loading: true, error: null, progress: 0 });
  const [numPages, setNumPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [zoom, setZoom] = useState(1);
  const [pageInput, setPageInput] = useState('1');
  const pageInputFocused = useRef(false);

  useEffect(() => {
    let cancelled = false;
    let pdf = null;
    let loadingTask = null;
    let observer = null;
    let scrollHandler = null;
    let rafId = 0;
    const renderTasks = new Map(); // pageNum -> RenderTask (para poder cancelar)

    const scroller = scrollRef.current;
    const pagesEl = pagesRef.current;
    if (pagesEl) pagesEl.innerHTML = '';
    setStatus({ loading: true, error: null, progress: 0 });
    setNumPages(0);
    setCurrentPage(1);
    currentPageRef.current = 1;

    (async () => {
      try {
        if (url) {
          loadingTask = pdfjsLib.getDocument({
            url,
            httpHeaders: httpHeaders || undefined,
            withCredentials: false,
            disableAutoFetch: true, // no prefetch del archivo entero
            disableStream: false,
            rangeChunkSize: 262144, // 256 KB por rango
          });
        } else {
          const data = await blob.arrayBuffer();
          loadingTask = pdfjsLib.getDocument({ data });
        }
        loadingTask.onProgress = ({ loaded, total }) => {
          if (!cancelled && total) {
            setStatus((s) => ({ ...s, progress: Math.min(1, loaded / total) }));
          }
        };
        pdf = await loadingTask.promise;
      } catch (err) {
        if (cancelled) return;
        // 403 = contenido Pro sin plan: lo delega al ReaderPanel (panel bloqueado).
        if (err && err.status === 403) {
          onForbidden?.();
          setStatus({ loading: false, error: null, progress: 0 });
          return;
        }
        setStatus({ loading: false, error: 'No se pudo abrir el PDF.', progress: 0 });
        return;
      }
      if (cancelled) {
        pdf.destroy();
        return;
      }

      const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
      baseWidthRef.current = Math.min(
        Math.max((pagesEl.clientWidth || 800) - 8, 120),
        MAX_PAGE_WIDTH
      );
      const effWidth = () => baseWidthRef.current * zoomRef.current;

      // Relación alto/ancho (según la 1ª página) para estimar placeholders.
      let ratio = 1.414; // A4 vertical por defecto
      try {
        const b = (await pdf.getPage(1)).getViewport({ scale: 1 });
        ratio = b.height / b.width;
      } catch {
        /* se usa la estimación A4 */
      }
      if (cancelled) {
        pdf.destroy();
        return;
      }

      async function renderPage(holder) {
        if (holder.dataset.rendered === '1' || holder.dataset.rendering === '1') return;
        const num = Number(holder.dataset.page);
        holder.dataset.rendering = '1';
        try {
          const page = await pdf.getPage(num);
          if (cancelled) return;
          const base = page.getViewport({ scale: 1 });
          const scaleCss = effWidth() / base.width;
          const viewport = page.getViewport({ scale: scaleCss * dpr });

          const canvas = document.createElement('canvas');
          canvas.className = 'pdfpage';
          canvas.width = Math.floor(viewport.width);
          canvas.height = Math.floor(viewport.height);
          canvas.style.width = '100%';
          holder.style.height = `${base.height * scaleCss}px`;

          const task = page.render({ canvasContext: canvas.getContext('2d'), viewport });
          renderTasks.set(num, task);
          await task.promise;
          renderTasks.delete(num);
          if (cancelled) return;

          holder.innerHTML = '';
          holder.appendChild(canvas);
          holder.dataset.rendered = '1';
        } catch {
          /* render cancelado o error puntual de página: no rompe el visor */
        } finally {
          holder.dataset.rendering = '0';
        }
      }

      function freePage(holder) {
        const task = renderTasks.get(Number(holder.dataset.page));
        if (task) {
          try {
            task.cancel();
          } catch {
            /* noop */
          }
          renderTasks.delete(Number(holder.dataset.page));
        }
        holder.innerHTML = ''; // el placeholder conserva su tamaño -> layout estable
        holder.dataset.rendered = '0';
        holder.dataset.rendering = '0';
      }

      function sizeHolder(holder) {
        const w = effWidth();
        holder.style.width = `${w}px`;
        holder.style.height = `${w * ratio}px`;
      }

      observer = new IntersectionObserver(
        (entries) => {
          for (const e of entries) {
            if (e.isIntersecting) renderPage(e.target);
            else freePage(e.target);
          }
        },
        { root: scroller, rootMargin: '800px 0px' }
      );

      // Un placeholder por página (tamaño estimado a zoom actual).
      const frag = document.createDocumentFragment();
      for (let n = 1; n <= pdf.numPages; n++) {
        const holder = document.createElement('div');
        holder.className = 'pdfpage-holder';
        holder.dataset.page = String(n);
        holder.style.width = `${effWidth()}px`;
        holder.style.height = `${effWidth() * ratio}px`;
        frag.appendChild(holder);
      }
      if (cancelled) {
        pdf.destroy();
        return;
      }
      pagesEl.appendChild(frag);
      const holders = Array.from(pagesEl.querySelectorAll('.pdfpage-holder'));
      holders.forEach((h) => observer.observe(h));

      // Re-maquetado al cambiar el zoom: re-dimensiona y re-renderiza las visibles.
      relayoutRef.current = () => {
        holders.forEach((h) => {
          freePage(h);
          sizeHolder(h);
        });
        observer.disconnect();
        holders.forEach((h) => observer.observe(h)); // re-dispara render de las visibles
      };

      // Página actual según el scroll.
      scrollHandler = () => {
        if (rafId) return;
        rafId = requestAnimationFrame(() => {
          rafId = 0;
          const top = scroller.scrollTop + 80;
          let cur = 1;
          for (const h of holders) {
            if (h.offsetTop - pagesEl.offsetTop <= top) cur = Number(h.dataset.page);
            else break;
          }
          currentPageRef.current = cur;
          setCurrentPage(cur);
        });
      };
      scroller.addEventListener('scroll', scrollHandler, { passive: true });

      goToPageRef.current = (n) => {
        const idx = Math.min(Math.max(1, n), pdf.numPages);
        const h = holders[idx - 1];
        if (h && scroller) scroller.scrollTop = h.offsetTop - pagesEl.offsetTop;
      };

      setNumPages(pdf.numPages);
      setStatus({ loading: false, error: null, progress: 1 });
    })();

    return () => {
      cancelled = true;
      relayoutRef.current = null;
      goToPageRef.current = null;
      if (rafId) cancelAnimationFrame(rafId);
      if (scrollHandler && scroller) scroller.removeEventListener('scroll', scrollHandler);
      if (observer) observer.disconnect();
      renderTasks.forEach((t) => {
        try {
          t.cancel();
        } catch {
          /* noop */
        }
      });
      renderTasks.clear();
      if (loadingTask) {
        try {
          loadingTask.destroy();
        } catch {
          /* noop */
        }
      }
      if (pdf) {
        try {
          pdf.destroy();
        } catch {
          /* noop */
        }
      }
    };
  }, [blob, url]);

  // Al cambiar el zoom: re-maqueta y conserva la página actual a la vista.
  useEffect(() => {
    zoomRef.current = zoom;
    if (relayoutRef.current) {
      relayoutRef.current();
      requestAnimationFrame(() => goToPageRef.current?.(currentPageRef.current));
    }
  }, [zoom]);

  // Sincroniza el input de página con la página actual (salvo si se está escribiendo).
  useEffect(() => {
    if (!pageInputFocused.current) setPageInput(String(currentPage));
  }, [currentPage]);

  const changeZoom = useCallback((delta) => {
    setZoom((z) =>
      Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Math.round((z + delta) * 100) / 100))
    );
  }, []);

  const submitPage = useCallback(
    (e) => {
      e.preventDefault();
      const n = parseInt(pageInput, 10);
      if (!Number.isNaN(n)) goToPageRef.current?.(n);
    },
    [pageInput]
  );

  const heavy = sizeBytes && sizeBytes > HEAVY_BYTES;
  const pct =
    status.progress > 0 && status.progress < 1
      ? ` ${Math.round(status.progress * 100)}%`
      : '';

  return (
    <div className="pdfviewer" ref={scrollRef}>
      {status.loading && (
        <div className="pdfviewer__state pdfviewer__loading muted">
          <span className="pdfviewer__spinner" aria-hidden="true" />
          <span>
            {heavy ? `Cargando documento grande (${formatSize(sizeBytes)})…` : 'Cargando PDF…'}
            {pct}
          </span>
        </div>
      )}
      {status.error && <div className="pdfviewer__state error">{status.error}</div>}
      <div className="pdfviewer__pages" ref={pagesRef} />

      {numPages > 0 && !status.error && (
        <div className="pdfctl" role="toolbar" aria-label="Controles de lectura">
          <button
            type="button"
            className="pdfctl__btn"
            onClick={() => changeZoom(-ZOOM_STEP)}
            disabled={zoom <= ZOOM_MIN}
            aria-label="Alejar"
            title="Alejar"
          >
            −
          </button>
          <span className="pdfctl__zoom">{Math.round(zoom * 100)}%</span>
          <button
            type="button"
            className="pdfctl__btn"
            onClick={() => changeZoom(ZOOM_STEP)}
            disabled={zoom >= ZOOM_MAX}
            aria-label="Acercar"
            title="Acercar"
          >
            +
          </button>
          <span className="pdfctl__sep" aria-hidden="true" />
          <form className="pdfctl__pageform" onSubmit={submitPage}>
            <input
              className="pdfctl__pageinput"
              value={pageInput}
              onChange={(e) => setPageInput(e.target.value.replace(/[^0-9]/g, ''))}
              onFocus={() => {
                pageInputFocused.current = true;
              }}
              onBlur={() => {
                pageInputFocused.current = false;
                setPageInput(String(currentPage));
              }}
              inputMode="numeric"
              aria-label="Ir a la página"
            />
            <span className="pdfctl__total">/ {numPages}</span>
          </form>
        </div>
      )}
    </div>
  );
}
