import ItemCard from './ItemCard.jsx';

export default function FileGrid({
  items,
  loading,
  error,
  emptyText,
  activeId,
  compact,
  onOpenFolder,
  onOpenFile,
}) {
  if (loading) return <div className="grid-state muted">Cargando…</div>;
  if (error) return <div className="grid-state error">Error: {error}</div>;
  if (!items.length) return <div className="grid-state muted">{emptyText}</div>;

  return (
    <div className={'grid' + (compact ? ' grid--compact' : '')}>
      {items.map((item) => (
        <ItemCard
          key={item.id}
          item={item}
          activeId={activeId}
          onOpenFolder={onOpenFolder}
          onOpenFile={onOpenFile}
        />
      ))}
    </div>
  );
}
