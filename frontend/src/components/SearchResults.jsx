import { Folder, BookOpen } from './icons.jsx';
import { fileType, formatSize, formatDate } from '../lib/fileType.js';

function ResultRow({ item, activeId, onOpenFolder, onOpenFile }) {
  const isFolder = item.is_folder;
  const ft = isFolder ? null : fileType(item);
  const isActive = item.id === activeId;

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
        {isFolder ? null : <BookOpen width={15} height={15} />}
      </span>
    </>
  );

  if (isFolder) {
    return (
      <button
        type="button"
        className="result result--folder"
        onClick={() => onOpenFolder(item.id)}
        title={item.name}
      >
        {inner}
      </button>
    );
  }

  return (
    <button
      type="button"
      className={'result' + (isActive ? ' is-active' : '')}
      onClick={() => onOpenFile(item)}
      title={item.name}
    >
      {inner}
    </button>
  );
}

export default function SearchResults({
  results,
  total,
  loading,
  error,
  activeId,
  onOpenFolder,
  onOpenFile,
}) {
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
          onOpenFolder={onOpenFolder}
          onOpenFile={onOpenFile}
        />
      ))}
      {total > results.length && (
        <div className="results__more muted">
          Mostrando {results.length} de {total} coincidencias. Afina la búsqueda para acotar.
        </div>
      )}
    </div>
  );
}
