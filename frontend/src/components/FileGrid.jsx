import ItemCard from './ItemCard.jsx';
import { SkeletonGrid } from './Skeleton.jsx';

export default function FileGrid({
  items,
  loading,
  error,
  emptyText,
  activeId,
  compact,
  plan = 'free',
  onOpenFolder,
  onOpenFile,
}) {
  if (loading) return <SkeletonGrid count={compact ? 6 : 12} compact={compact} />;
  if (error) return <div className="grid-state error">Error: {error}</div>;
  if (!items.length) return <div className="grid-state muted">{emptyText}</div>;

  return (
    <div className={'grid fade-in' + (compact ? ' grid--compact' : '')}>
      {items.map((item) => (
        <ItemCard
          key={item.id}
          item={item}
          activeId={activeId}
          plan={plan}
          onOpenFolder={onOpenFolder}
          onOpenFile={onOpenFile}
        />
      ))}
    </div>
  );
}
