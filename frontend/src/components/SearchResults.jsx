import { Folder, BookOpen, Lock } from './icons.jsx';
import { fileType, formatSize, formatDate } from '../lib/fileType.js';
import FavoriteButton from './FavoriteButton.jsx';

function ResultRow({ item, activeId, plan = 'free', onOpenFolder, onOpenFile }) {
  const isFolder = item.is_folder;
  const ft = isFolder ? null : fileType(item);
  const isActive = item.id === activeId;
  const locked = !!item.is_premium && plan !== 'pro';

  // Ruta del contenedor (sin el propio nombre) para ubicar el resultado.
  const parentPath = (item.path || '').split('/').slice(0, -1).join(' › ');

  const meta = isFolder
    ? 'Carpeta'
    : [formatSize(item.size), formatDate(item.modified_time)]
        .filter(Boolean)
        .join(' · ');

  const inner = (
    <>
      <div
        className={'result__icon' + (isFolder ? ' result__icon--folder' : '')}
        style={ft ? { '--chip': ft.color } : undefined}
      >
        {isFolder ? <Folder width={20} height={20} /> : <span className="result__ext">{ft.label}</span>}
      </div>
      <div className="result__body">
        <div className="result__name">{item.name}</div>
        <div className="result__path">{parentPath || 'PSICOTECA'}</div>
      </div>
      <div className="result__meta">{meta}</div>
      <span className="result__open" aria-hidden="true">
        {locked ? (
          <Lock width={15} height={15} />
        ) : isFolder ? null : (
          <BookOpen width={15} height={15} />
        )}
      </span>
    </>
  );

  if (isFolder) {
    return (
      <button
        type="button"
        className={'result result--folder' + (locked ? ' result--locked' : '')}
        onClick={() => onOpenFolder(item)}
        title={locked ? `${item.name} · Contenido Pro` : item.name}
      >
        {inner}
      </button>
    );
  }

  return (
    <div className="result-wrap">
      <button
        type="button"
        className={
          'result' + (isActive ? ' is-active' : '') + (locked ? ' result--locked' : '')
        }
        onClick={() => onOpenFile(item)}
        title={locked ? `${item.name} · Contenido Pro` : item.name}
      >
        {inner}
      </button>
      <FavoriteButton item={item} />
    </div>
  );
}

export default function SearchResults({
  results,
  total,
  totalCapped = false,
  tooShort = false,
  minChars = 3,
  loading,
  error,
  activeId,
  plan = 'free',
  onOpenFolder,
  onOpenFile,
}) {
  if (tooShort)
    return (
      <div className="grid-state muted">
        Escribe al menos {minChars} caracteres para buscar.
      </div>
    );
  if (loading) return <div className="grid-state muted">Buscando…</div>;
  if (error) return <div className="grid-state error">Error: {error}</div>;
  if (!results.length) return <div className="grid-state muted">Sin resultados.</div>;

  return (
    <div className="results">
      {results.map((item) => (
        <ResultRow
          key={item.id}
          item={item}
          activeId={activeId}
          plan={plan}
          onOpenFolder={onOpenFolder}
          onOpenFile={onOpenFile}
        />
      ))}
      {total > results.length && (
        <div className="results__more muted">
          Mostrando {results.length} de {total}{totalCapped ? '+' : ''} coincidencias. Afina la búsqueda para acotar.
        </div>
      )}
    </div>
  );
}
