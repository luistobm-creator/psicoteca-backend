// Esqueletos de carga: dan sensación de rapidez mientras la API responde, en
// lugar de un texto "Cargando…". Puramente decorativos (aria-hidden).

export function Skeleton({ className = '', style }) {
  return (
    <span className={'skeleton' + (className ? ' ' + className : '')} style={style} aria-hidden="true" />
  );
}

export function SkeletonCard() {
  return (
    <div className="card card--skeleton" aria-hidden="true">
      <Skeleton className="skeleton--chip" />
      <div className="card__body">
        <Skeleton className="skeleton--line" style={{ width: '82%' }} />
        <Skeleton className="skeleton--line skeleton--sm" style={{ width: '48%' }} />
      </div>
    </div>
  );
}

export function SkeletonGrid({ count = 8, compact = false }) {
  return (
    <div className={'grid' + (compact ? ' grid--compact' : '')} aria-hidden="true">
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  );
}

export function SkeletonCollections({ count = 6 }) {
  return (
    <div className="collections" aria-hidden="true">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="collection collection--skeleton">
          <Skeleton className="skeleton--icon" />
          <Skeleton className="skeleton--line" style={{ width: '70%' }} />
          <Skeleton className="skeleton--line skeleton--sm" style={{ width: '45%' }} />
        </div>
      ))}
    </div>
  );
}
