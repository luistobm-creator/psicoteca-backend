import { useEffect, useRef, useState } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
// El worker se sirve como asset propio de Vite (mismo origen, sin CDN externo).
import workerSrc from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

pdfjsLib.GlobalWorkerOptions.workerSrc = workerSrc;

// Cap de nitidez: en móviles devicePixelRatio puede ser 3; limitarlo a 2 evita
// que los <canvas> disparen el consumo de memoria (Safari iOS es sensible).
const MAX_DPR = 2;

/**
 * Visor de PDF que renderiza cada página a un <canvas> apilado dentro de un
 * contenedor con scroll nativo. Sustituye al <iframe>, que en iOS/Safari solo
 * muestra la primera página sin poder desplazarse.
 *
 * Renderizado PEREZOSO: crea un placeholder por página (con altura estimada) y
 * solo dibuja las páginas cercanas al viewport (IntersectionObserver); al
 * alejarse, libera su canvas. Así un PDF de cientos de páginas no agota memoria.
 *
 * `blob`: el Blob del PDF (ya descargado por el proxy autenticado del backend).
 */
export default function PdfViewer({ blob }) {
  const scrollRef = useRef(null);
  const pagesRef = useRef(null);
  const [status, setStatus] = useState({ loading: true, error: null });

  useEffect(() => {
    let cancelled = false;
    let pdf = null;
    let observer = null;
    const renderTasks = new Map(); // pageNum -> RenderTask (para poder cancelar)

    const scroller = scrollRef.current;
    const pagesEl = pagesRef.current;
    if (pagesEl) pagesEl.innerHTML = '';
    setStatus({ loading: true, error: null });

    (async () => {
      let data;
      try {
        data = await blob.arrayBuffer();
      } catch {
        if (!cancelled) setStatus({ loading: false, error: 'No se pudo leer el archivo.' });
        return;
      }

      try {
        pdf = await pdfjsLib.getDocument({ data }).promise;
      } catch {
        if (!cancelled) setStatus({ loading: false, error: 'No se pudo abrir el PDF.' });
        return;
      }
      if (cancelled) {
        pdf.destroy();
        return;
      }

      const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
      const cssWidth = Math.max((pagesEl.clientWidth || 800) - 4, 120);

      // Altura estimada de página (según la 1ª) para dimensionar los placeholders
      // y mantener estable la barra de scroll antes de renderizar cada página.
      let estHeight = cssWidth * 1.414; // A4 vertical por defecto
      try {
        const base = (await pdf.getPage(1)).getViewport({ scale: 1 });
        estHeight = (cssWidth / base.width) * base.height;
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
          const scaleCss = cssWidth / base.width;
          const viewport = page.getViewport({ scale: scaleCss * dpr });

          const canvas = document.createElement('canvas');
          canvas.className = 'pdfpage';
          canvas.width = Math.floor(viewport.width);
          canvas.height = Math.floor(viewport.height);
          canvas.style.width = '100%';
          // Altura CSS exacta de esta página (corrige la estimación inicial).
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
        if (holder.dataset.rendered !== '1') return;
        const task = renderTasks.get(Number(holder.dataset.page));
        if (task) {
          try {
            task.cancel();
          } catch {
            /* noop */
          }
          renderTasks.delete(Number(holder.dataset.page));
        }
        holder.innerHTML = ''; // conserva la altura ya fijada -> layout estable
        holder.dataset.rendered = '0';
      }

      // Renderiza al acercarse al viewport; libera al alejarse (recicla memoria).
      observer = new IntersectionObserver(
        (entries) => {
          for (const e of entries) {
            if (e.isIntersecting) renderPage(e.target);
            else freePage(e.target);
          }
        },
        { root: scroller, rootMargin: '800px 0px' }
      );

      // Un placeholder por página con la altura estimada.
      const frag = document.createDocumentFragment();
      for (let n = 1; n <= pdf.numPages; n++) {
        const holder = document.createElement('div');
        holder.className = 'pdfpage-holder';
        holder.dataset.page = String(n);
        holder.style.height = `${estHeight}px`;
        frag.appendChild(holder);
      }
      if (cancelled) {
        pdf.destroy();
        return;
      }
      pagesEl.appendChild(frag);
      pagesEl.querySelectorAll('.pdfpage-holder').forEach((h) => observer.observe(h));

      setStatus({ loading: false, error: null });
    })();

    return () => {
      cancelled = true;
      if (observer) observer.disconnect();
      renderTasks.forEach((t) => {
        try {
          t.cancel();
        } catch {
          /* noop */
        }
      });
      renderTasks.clear();
      if (pdf) {
        try {
          pdf.destroy();
        } catch {
          /* noop */
        }
      }
    };
  }, [blob]);

  return (
    <div className="pdfviewer" ref={scrollRef}>
      {status.loading && <div className="pdfviewer__state muted">Cargando PDF…</div>}
      {status.error && <div className="pdfviewer__state error">{status.error}</div>}
      <div className="pdfviewer__pages" ref={pagesRef} />
    </div>
  );
}
