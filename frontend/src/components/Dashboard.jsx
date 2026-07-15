import { Files, Folder, Clock, ArrowRight, LayoutGrid } from './icons.jsx';
import { formatDate } from '../lib/fileType.js';
import { categoryIcon } from '../lib/categoryIcons.jsx';
import { Skeleton, SkeletonCollections } from './Skeleton.jsx';
import QuickAccess from './QuickAccess.jsx';
import ProBadge from './ProBadge.jsx';

function StatTile({ icon, value, label, tone, loading, hint }) {
  return (
    <div className={'stat' + (tone ? ' stat--' + tone : '')}>
      <span className="stat__icon">{icon}</span>
      <div className="stat__value">
        {loading ? <Skeleton className="skeleton--stat" /> : value}
      </div>
      <div className="stat__label">{label}</div>
      {hint && !loading && <div className="stat__hint">{hint}</div>}
    </div>
  );
}

export default function Dashboard({
  stats,
  statsLoading = false,
  treeLoading = false,
  topFolders = [],
  recents = [],
  plan = 'free',
  onOpenFolder,
  onOpenFile,
}) {
  const fmt = (n) => (n == null ? '—' : Number(n).toLocaleString('es'));
  // Si el backend aún no devolvió la fecha, informamos que sigue en curso en
  // lugar de un guion mudo.
  const lastSync = stats?.last_sync ? formatDate(stats.last_sync) : 'Sincronizando…';

  return (
    <div className="dashboard">
      <section className="hero fade-in">
        <span className="hero__eyebrow">Psicoteca</span>
        <h1 className="hero__title">Tu espacio de estudio clínico</h1>
        <p className="hero__subtitle">
          Explora, busca y lee tu biblioteca de psicología sin salir de la
          aplicación. Selecciona una categoría para empezar.
        </p>
      </section>

      <div className="stats fade-in">
        <StatTile
          icon={<Files width={20} height={20} />}
          value={fmt(stats?.total_files)}
          label="Documentos"
          tone="accent"
          loading={statsLoading}
          hint={
            plan !== 'pro'
              ? '(Desbloquea la biblioteca completa con Pro)'
              : null
          }
        />
        <StatTile
          icon={<Folder width={20} height={20} />}
          value={fmt(stats?.total_folders)}
          label="Carpetas"
          loading={statsLoading}
        />
        <StatTile
          icon={<Clock width={20} height={20} />}
          value={lastSync}
          label="Última sincronización"
          loading={statsLoading}
        />
      </div>

      <QuickAccess
        recents={recents}
        topFolders={topFolders}
        plan={plan}
        onOpenFile={onOpenFile}
        onOpenFolder={onOpenFolder}
      />

      <section className="dash-section fade-in">
        <header className="dash-section__head">
          <h2 className="dash-section__title">
            <LayoutGrid width={17} height={17} />
            Categorías principales
          </h2>
          {!treeLoading && (
            <span className="muted">{topFolders.length} colecciones</span>
          )}
        </header>

        {treeLoading ? (
          <SkeletonCollections />
        ) : (
          <div className="collections">
            {topFolders.map((f) => {
              const premium = !!f.is_premium;
              return (
                <button
                  key={f.id}
                  type="button"
                  className="collection"
                  onClick={() => onOpenFolder(f)}
                  title={premium ? `${f.name} · Contenido Pro` : f.name}
                >
                  <span className="collection__top">
                    <span className="collection__icon">
                      {categoryIcon(f.name, 20)}
                    </span>
                    {premium && <ProBadge plan={plan} className="collection__badge" />}
                  </span>
                  <span className="collection__name">{f.name}</span>
                  <span className="collection__meta">
                    {f.child_count > 0
                      ? `${f.child_count} subcarpeta${f.child_count === 1 ? '' : 's'}`
                      : 'Ver documentos'}
                    <ArrowRight className="collection__arrow" width={15} height={15} />
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
