import TreeNode from './TreeNode.jsx';
import { Library } from './icons.jsx';

export default function Sidebar({
  tree,
  loading,
  error,
  selectedId,
  expanded,
  plan = 'free',
  onToggle,
  onSelect,
}) {
  const collectionCount = tree[0]?.children?.length ?? 0;

  return (
    <aside className="sidebar">
      <div className="sidebar__head">
        <span className="sidebar__headicon" aria-hidden="true">
          <Library width={16} height={16} />
        </span>
        <div className="sidebar__headtext">
          <span className="sidebar__title">Biblioteca</span>
          <span className="sidebar__hint">
            {loading
              ? 'Cargando…'
              : collectionCount > 0
                ? `${collectionCount} colecciones`
                : 'Explora por categorías'}
          </span>
        </div>
      </div>

      <div className="sidebar__tree">
        {loading && (
          <div className="sidebar__loading" aria-hidden="true">
            {Array.from({ length: 7 }).map((_, i) => (
              <span
                key={i}
                className="skeleton skeleton--row"
                style={{ width: `${68 - (i % 3) * 12}%` }}
              />
            ))}
          </div>
        )}
        {error && <div className="pad error">Error: {error}</div>}
        {!loading &&
          !error &&
          tree.map((node) => (
            <TreeNode
              key={node.id}
              node={node}
              depth={0}
              selectedId={selectedId}
              expanded={expanded}
              plan={plan}
              onToggle={onToggle}
              onSelect={onSelect}
            />
          ))}
      </div>
    </aside>
  );
}
