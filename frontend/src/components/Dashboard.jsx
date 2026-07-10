import { Files, Folder, Clock, ArrowRight, LayoutGrid } from './icons.jsx';
import { formatDate } from '../lib/fileType.js';

function StatTile({ icon, value, label, tone }) {
  return (
    <div className={'stat' + (tone ? ' stat--' + tone : '')}>
      <span className="stat__icon">{icon}</span>
      <div className="stat__value">{value}</div>
      <div className="stat__label">{label}</div>
    </div>
  );
}

export default function Dashboard({ stats, topFolders, onOpenFolder }) {
  const fmt = (n) => (n == null ? '—' : Number(n).toLocaleString('es'));

  return (
    <div className="dashboard">
      <section className="hero">
        <span className="hero__eyebrow">Psicoteca</span>
        <h1 className="hero__title">Tu espacio de estudio clínico</h1>
        <p className="hero__subtitle">
          Explora, busca y lee tu biblioteca de psicología sin salir de la
          aplicación. Selecciona una categoría para empezar.
        </p>
      </section>

      <div className="stats">
        <StatTile
          icon={<Files width={20} height={20} />}
          value={fmt(stats?.total_files)}
          label="Documentos"
          tone="accent"
        />
        <StatTile
          icon={<Folder width={20} height={20} />}
          value={fmt(stats?.total_folders)}
          label="Carpetas"
        />
        <StatTile
          icon={<Clock width={20} height={20} />}
          value={stats?.last_sync ? formatDate(stats.last_sync) : '—'}
          label="Última sincronización"
        />
      </div>

      <section className="dash-section">
        <header className="dash-section__head">
          <h2 className="dash-section__title">
            <LayoutGrid width={17} height={17} />
            Categorías principales
          </h2>
          <span className="muted">{topFolders.length} colecciones</span>
        </header>

        <div className="collections">
          {topFolders.map((f) => (
            <button
              key={f.id}
              type="button"
              className="collection"
              onClick={() => onOpenFolder(f)}
              title={f.name}
            >
              <span className="collection__icon">
                <Folder width={20} height={20} />
              </span>
              <span className="collection__name">{f.name}</span>
              <span className="collection__meta">
                {f.child_count > 0
                  ? `${f.child_count} subcarpeta${f.child_count === 1 ? '' : 's'}`
                  : 'Ver documentos'}
                <ArrowRight className="collection__arrow" width={15} height={15} />
              </span>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
