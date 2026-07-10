import SearchBar from './SearchBar.jsx';
import TreeNode from './TreeNode.jsx';

export default function Sidebar({
  tree,
  loading,
  error,
  selectedId,
  expanded,
  onToggle,
  onSelect,
  searchValue,
  onSearchChange,
  onSearchClear,
}) {
  return (
    <aside className="sidebar">
      <div className="sidebar__search">
        <SearchBar
          value={searchValue}
          onChange={onSearchChange}
          onClear={onSearchClear}
        />
      </div>

      <div className="sidebar__tree">
        {loading && <div className="pad muted">Cargando árbol…</div>}
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
              onToggle={onToggle}
              onSelect={onSelect}
            />
          ))}
      </div>
    </aside>
  );
}
