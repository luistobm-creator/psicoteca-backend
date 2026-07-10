export default function Breadcrumb({ trail, onNavigate }) {
  if (!trail.length) return <div className="breadcrumb" />;

  return (
    <nav className="breadcrumb" aria-label="Ruta">
      {trail.map((node, i) => {
        const isCurrent = i === trail.length - 1;
        return (
          <span key={node.id} className="breadcrumb__item">
            <button
              type="button"
              className={'breadcrumb__link' + (isCurrent ? ' is-current' : '')}
              onClick={() => !isCurrent && onNavigate(node)}
              disabled={isCurrent}
            >
              {node.name}
            </button>
            {!isCurrent && <span className="breadcrumb__sep">›</span>}
          </span>
        );
      })}
    </nav>
  );
}
