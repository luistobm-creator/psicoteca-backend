import { X, ExternalLink } from './icons.jsx';
import { fileType } from '../lib/fileType.js';
import { drivePreviewUrl } from '../lib/drive.js';

export default function ReaderPanel({ file, onClose }) {
  const { label, color } = fileType(file);
  const src = drivePreviewUrl(file);

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
          {file.web_view_link && (
            <a
              className="iconbtn iconbtn--sm"
              href={file.web_view_link}
              target="_blank"
              rel="noreferrer"
              title="Abrir en Google Drive"
              aria-label="Abrir en Google Drive"
            >
              <ExternalLink width={16} height={16} />
            </a>
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
        {src ? (
          <iframe
            key={file.id}
            className="reader__iframe"
            src={src}
            title={file.name}
            allow="autoplay; encrypted-media"
          />
        ) : (
          <div className="grid-state muted">
            Este elemento no se puede previsualizar.
          </div>
        )}
      </div>

      <footer className="reader__foot">
        <span className="muted">
          ¿No se ve? La vista previa usa tu sesión de Google Drive.
        </span>
        {file.web_view_link && (
          <a
            className="link"
            href={file.web_view_link}
            target="_blank"
            rel="noreferrer"
          >
            Abrir en Drive
          </a>
        )}
      </footer>
    </aside>
  );
}
