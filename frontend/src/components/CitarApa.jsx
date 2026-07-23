import { useState } from 'react';
import { X, Check } from './icons.jsx';

// Deriva un título razonable del nombre de archivo: quita la extensión y, si
// no tiene espacios pero sí puntos/guiones bajos usados como separador
// (típico de nombres de Drive: "Manual.de.Trastornos.pdf"), los cambia por
// espacios. Sigue siendo editable — es un punto de partida, no un dato exacto.
function tituloDesdeArchivo(name) {
  const sinExt = (name || '').replace(/\.[^./\\]+$/, '');
  if (!sinExt.includes(' ') && /[._]/.test(sinExt)) {
    return sinExt.replace(/[._]+/g, ' ').trim();
  }
  return sinExt.trim();
}

function escapeHtml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// Generador de referencia APA (7ma edición). La biblioteca (documentos
// sincronizados de Drive) no trae metadatos bibliográficos reales (autor,
// año, editorial) — solo nombre de archivo. Por honestidad, esos campos
// arrancan vacíos y editables (con placeholder [Autor]/[Año]/[Editorial] en
// la vista previa) en vez de inventar datos; el título sí se pre-llena desde
// el nombre real del archivo.
export default function CitarApa({ file, onClose }) {
  const [autor, setAutor] = useState('');
  const [anio, setAnio] = useState('');
  const [titulo, setTitulo] = useState(() => tituloDesdeArchivo(file.name));
  const [editorial, setEditorial] = useState('');
  const [copiado, setCopiado] = useState(false);

  const autorTexto = autor.trim() || '[Autor]';
  const anioTexto = anio.trim() || '[Año]';
  const tituloTexto = titulo.trim() || '[Título]';
  const editorialTexto = editorial.trim() || '[Editorial]';

  const textoPlano = `${autorTexto} (${anioTexto}). ${tituloTexto}. ${editorialTexto}.`;

  const handleCopiar = async () => {
    const textoHtml = `${escapeHtml(autorTexto)} (${escapeHtml(anioTexto)}). <em>${escapeHtml(
      tituloTexto
    )}</em>. ${escapeHtml(editorialTexto)}.`;
    try {
      if (navigator.clipboard?.write && window.ClipboardItem) {
        // Copia texto plano Y html (con el título en cursiva) a la vez, para
        // que al pegar en un procesador de texto se conserve el formato APA.
        await navigator.clipboard.write([
          new ClipboardItem({
            'text/plain': new Blob([textoPlano], { type: 'text/plain' }),
            'text/html': new Blob([textoHtml], { type: 'text/html' }),
          }),
        ]);
      } else {
        await navigator.clipboard.writeText(textoPlano);
      }
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      /* sin permiso de portapapeles: el usuario puede seleccionar el texto a mano */
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose} role="presentation">
      <div className="modal modal--form" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="modal__close" onClick={onClose} aria-label="Cerrar">
          <X width={18} height={18} />
        </button>
        <h2 className="modal__title">Cita APA (7ma edición)</h2>
        <p className="settings__muted" style={{ marginBottom: 14 }}>
          Completa lo que falte — la biblioteca no guarda autor/año/editorial, solo el nombre del archivo.
        </p>

        <div className="modal__row">
          <div className="modal__field">
            <label className="settings__label">Autor</label>
            <input
              className="settings__input"
              value={autor}
              onChange={(e) => setAutor(e.target.value)}
              placeholder="Apellido, A. A."
              autoFocus
            />
          </div>
          <div className="modal__field">
            <label className="settings__label">Año</label>
            <input
              className="settings__input"
              value={anio}
              onChange={(e) => setAnio(e.target.value)}
              placeholder="2024"
            />
          </div>
        </div>

        <div className="modal__field">
          <label className="settings__label">Título</label>
          <input className="settings__input" value={titulo} onChange={(e) => setTitulo(e.target.value)} />
        </div>

        <div className="modal__field">
          <label className="settings__label">Editorial / fuente</label>
          <input
            className="settings__input"
            value={editorial}
            onChange={(e) => setEditorial(e.target.value)}
            placeholder="p. ej. Editorial Manual Moderno"
          />
        </div>

        <div className="apa-preview">
          {autorTexto} ({anioTexto}). <em>{tituloTexto}</em>. {editorialTexto}.
        </div>

        <div className="modal__actions">
          <button type="button" className="settings__btn" onClick={onClose}>
            Cerrar
          </button>
          <button type="button" className="settings__btn settings__btn--accent" onClick={handleCopiar}>
            {copiado ? (
              <>
                <Check width={15} height={15} /> ¡Copiado!
              </>
            ) : (
              'Copiar cita'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
