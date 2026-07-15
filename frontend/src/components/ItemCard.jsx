import { Folder, BookOpen, Lock } from './icons.jsx';
import { fileType, formatSize, formatDate } from '../lib/fileType.js';
import ProBadge from './ProBadge.jsx';
import FavoriteButton from './FavoriteButton.jsx';

export default function ItemCard({ item, activeId, plan = 'free', onOpenFolder, onOpenFile }) {
  const premium = !!item.is_premium;
  // Solo los ARCHIVOS Pro se bloquean (se abren con el modal). Las carpetas Pro
  // son navegables para todos (escaparate), así que nunca se ven "bloqueadas":
  // llevan el chip "Pro" que invita a explorar y a suscribirse.
  const fileLocked = premium && !item.is_folder && plan !== 'pro';
  const proBadge = <ProBadge plan={plan} size="xs" className="card__badge" />;

  // --- Carpeta (navegable; chip "Pro" si su contenido es de pago) ---
  if (item.is_folder) {
    return (
      <button
        type="button"
        className="card card--folder"
        onClick={() => onOpenFolder(item)}
        title={premium ? `${item.name} · Contenido Pro` : item.name}
      >
        <div className="card__icon card__icon--folder">
          <Folder width={22} height={22} />
        </div>
        <div className="card__body">
          <div className="card__name">{item.name}</div>
          <div className="card__meta">Carpeta</div>
        </div>
        {premium && proBadge}
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
    <div className="card-wrap">
      <button
        type="button"
        className={
          'card card--file' +
          (isActive ? ' is-active' : '') +
          (fileLocked ? ' card--locked' : '')
        }
        onClick={() => onOpenFile(item)}
        title={fileLocked ? `${item.name} · Contenido Pro` : item.name}
      >
        <div className="card__icon card__icon--file" style={{ '--chip': color }}>
          <span className="card__ext">{label}</span>
        </div>
        <div className="card__body">
          <div className="card__name">{item.name}</div>
          <div className="card__meta">{meta}</div>
        </div>
        {fileLocked ? (
          <span className="card__lock" title="Contenido Pro" aria-label="Contenido Pro">
            <Lock width={14} height={14} />
          </span>
        ) : (
          <span className="card__open" aria-hidden="true">
            <BookOpen width={16} height={16} />
          </span>
        )}
      </button>
      <FavoriteButton item={item} />
    </div>
  );
}
