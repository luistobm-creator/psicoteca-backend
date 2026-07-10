import { Folder, BookOpen, Lock } from './icons.jsx';
import { fileType, formatSize, formatDate } from '../lib/fileType.js';
import ProBadge from './ProBadge.jsx';

export default function ItemCard({ item, activeId, plan = 'free', onOpenFolder, onOpenFile }) {
  const premium = !!item.is_premium;
  const locked = premium && plan !== 'pro';

  // Indicador de esquina: candado si está bloqueado; si es Pro y ya tiene acceso,
  // el badge "Pro" desbloqueado.
  const corner = locked ? (
    <span className="card__lock" title="Contenido Pro" aria-label="Contenido Pro">
      <Lock width={14} height={14} />
    </span>
  ) : premium ? (
    <ProBadge plan={plan} size="xs" className="card__badge" />
  ) : null;

  // --- Carpeta ---
  if (item.is_folder) {
    return (
      <button
        type="button"
        className={'card card--folder' + (locked ? ' card--locked' : '')}
        onClick={() => onOpenFolder(item)}
        title={locked ? `${item.name} · Contenido Pro` : item.name}
      >
        <div className="card__icon card__icon--folder">
          <Folder width={22} height={22} />
        </div>
        <div className="card__body">
          <div className="card__name">{item.name}</div>
          <div className="card__meta">Carpeta</div>
        </div>
        {corner}
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
      className={
        'card card--file' +
        (isActive ? ' is-active' : '') +
        (locked ? ' card--locked' : '')
      }
      onClick={() => onOpenFile(item)}
      title={locked ? `${item.name} · Contenido Pro` : item.name}
    >
      <div className="card__icon card__icon--file" style={{ '--chip': color }}>
        <span className="card__ext">{label}</span>
      </div>
      <div className="card__body">
        <div className="card__name">{item.name}</div>
        <div className="card__meta">{meta}</div>
      </div>
      {locked ? (
        corner
      ) : (
        <span className="card__open" aria-hidden="true">
          <BookOpen width={16} height={16} />
        </span>
      )}
    </button>
  );
}
