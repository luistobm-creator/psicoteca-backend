import TreeNode from './TreeNode.jsx';
import { categoryIcon } from '../lib/categoryIcons.jsx';
import { Library, X, Heart, ChevronRight } from './icons.jsx';

export default function Sidebar({
  tree,
  loading,
  error,
  selectedId,
  expanded,
  plan = 'free',
  open = false,
  collapsed = false,
  onToggleCollapsed,
  showFavorites = false,
  favoritesActive = false,
  favoritesCount = 0,
  onOpenFavorites,
  onClose,
  onToggle,
  onSelect,
}) {
  const topLevel = tree[0]?.children ?? [];
  const collectionCount = topLevel.length;

  return (
    <aside className={'sidebar' + (open ? ' is-open' : '') + (collapsed ? ' is-collapsed' : '')}>
      <div className="sidebar__head">
        <span className="sidebar__headicon" aria-hidden="true">
          <Library width={16} height={16} />
        </span>
        {!collapsed && (
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
        )}
        {onToggleCollapsed && (
          <button
            type="button"
            className="sidebar__collapse-btn"
            onClick={onToggleCollapsed}
            aria-label={collapsed ? 'Expandir menú' : 'Colapsar menú'}
            title={collapsed ? 'Expandir menú' : 'Colapsar menú'}
          >
            <ChevronRight width={15} height={15} style={{ transform: 'rotate(180deg)' }} />
          </button>
        )}
        {onClose && !collapsed && (
          <button
            type="button"
            className="sidebar__close iconbtn iconbtn--sm"
            onClick={onClose}
            aria-label="Cerrar menú"
          >
            <X width={16} height={16} />
          </button>
        )}
      </div>

      {collapsed ? (
        <nav className="sidebar__rail" aria-label="Categorías (menú colapsado)">
          {showFavorites && (
            <button
              type="button"
              className={'sidebar__railitem' + (favoritesActive ? ' is-active' : '')}
              onClick={onOpenFavorites}
              title="Mis Favoritos"
              aria-label="Mis Favoritos"
            >
              <Heart width={17} height={17} fill={favoritesActive ? 'currentColor' : 'none'} />
            </button>
          )}
          {topLevel.map((node) => (
            <button
              key={node.id}
              type="button"
              className={'sidebar__railitem' + (selectedId === node.id ? ' is-active' : '')}
              onClick={() => onSelect(node)}
              title={node.name}
              aria-label={node.name}
            >
              {categoryIcon(node.name, 18)}
            </button>
          ))}
        </nav>
      ) : (
        <>
          {showFavorites && (
            <nav className="sidebar__nav" aria-label="Favoritos">
              <button
                type="button"
                className={'sidebar__navitem' + (favoritesActive ? ' is-active' : '')}
                onClick={onOpenFavorites}
                aria-current={favoritesActive ? 'page' : undefined}
              >
                <span className="sidebar__navicon" aria-hidden="true">
                  <Heart
                    width={16}
                    height={16}
                    fill={favoritesActive ? 'currentColor' : 'none'}
                  />
                </span>
                <span className="sidebar__navlabel">Mis Favoritos</span>
                {favoritesCount > 0 && (
                  <span className="sidebar__navcount">{favoritesCount}</span>
                )}
              </button>
            </nav>
          )}

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
        </>
      )}
    </aside>
  );
}
