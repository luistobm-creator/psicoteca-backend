import { Folder, BookOpen } from './icons.jsx';
import { fileType, formatSize, formatDate } from '../lib/fileType.js';

export default function ItemCard({ item, activeId, onOpenFolder, onOpenFile }) {
  // --- Carpeta ---
  if (item.is_folder) {
    return (
      <button
        type="button"
        className="card card--folder"
        onClick={() => onOpenFolder(item)}
        title={item.name}
      >
        <div className="card__icon card__icon--folder">
          <Folder width={22} height={22} />
        </div>
        <div className="card__body">
          <div className="card__name">{item.name}</div>
          <div className="card__meta">Carpeta</div>
        </div>
      </button>
    );
  }

  // --- Archivo (abre en el panel de lectura) ---
  const { label, color } = fileType(item);
  const isActive = item.id === activeId;
  const meta =
    [formatSize(item.size), formatDate(item.modified_time)]
      .filter(Boolean)
      .join(' · ') || 'Archivo';

  return (
    <button
      type="button"
      className={'card card--file' + (isActive ? ' is-active' : '')}
      onClick={() => onOpenFile(item)}
      title={item.name}
    >
      <div className="card__icon card__icon--file" style={{ '--chip': color }}>
        <span className="card__ext">{label}</span>
      </div>
      <div className="card__body">
        <div className="card__name">{item.name}</div>
        <div className="card__meta">{meta}</div>
      </div>
      <span className="card__open" aria-hidden="true">
        <BookOpen width={16} height={16} />
      </span>
    </button>
  );
}
