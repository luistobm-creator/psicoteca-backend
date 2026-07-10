import { ChevronRight, Folder, FolderOpen, Lock } from './icons.jsx';

export default function TreeNode({
  node,
  depth,
  selectedId,
  expanded,
  plan = 'free',
  onToggle,
  onSelect,
}) {
  const isOpen = expanded.has(node.id);
  const isSelected = node.id === selectedId;
  const hasChildren = (node.child_count ?? node.children?.length ?? 0) > 0;
  const locked = !!node.is_premium && plan !== 'pro';

  return (
    <div className="tree__node">
      <div
        className={
          'tree__row' +
          (isSelected ? ' is-selected' : '') +
          (locked ? ' tree__row--locked' : '')
        }
        style={{ paddingLeft: 6 + depth * 14 }}
        onClick={() => onSelect(node)}
        title={locked ? `${node.name} · Contenido Pro` : node.name}
      >
        <button
          type="button"
          className={
            'tree__chevron' +
            (isOpen ? ' is-open' : '') +
            (hasChildren ? '' : ' is-hidden')
          }
          onClick={(e) => {
            e.stopPropagation();
            if (hasChildren) onToggle(node.id);
          }}
          tabIndex={-1}
          aria-label={isOpen ? 'Contraer' : 'Expandir'}
        >
          <ChevronRight width={14} height={14} />
        </button>
        <span className="tree__icon">
          {isOpen && hasChildren ? <FolderOpen width={16} height={16} /> : <Folder width={16} height={16} />}
        </span>
        <span className="tree__label">{node.name}</span>
        {locked ? (
          <span className="tree__lock" aria-label="Contenido Pro" title="Contenido Pro">
            <Lock width={12} height={12} />
          </span>
        ) : (
          hasChildren && <span className="tree__count">{node.child_count}</span>
        )}
      </div>

      {isOpen && hasChildren && (
        <div className="tree__children">
          {node.children.map((child) => (
            <TreeNode
              key={child.id}
              node={child}
              depth={depth + 1}
              selectedId={selectedId}
              expanded={expanded}
              plan={plan}
              onToggle={onToggle}
              onSelect={onSelect}
            />
          ))}
        </div>
      )}
    </div>
  );
}
