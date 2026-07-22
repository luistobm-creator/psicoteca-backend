import { Link } from 'react-router-dom';
import { Files, Users, ClipboardList, Brain, Stethoscope, ArrowRight, LayoutGrid } from './icons.jsx';
import { formatDate } from '../lib/fileType.js';
import { categoryIcon } from '../lib/categoryIcons.jsx';
import { Skeleton, SkeletonCollections } from './Skeleton.jsx';
import { PROFILE_MENU } from '../lib/profileMenu.js';
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

// Módulos clínicos y de estudio destacados en el Dashboard. El icono y el
// label salen de PROFILE_MENU (la misma fuente que ya usa Perfil.jsx) para
// no duplicar los paths SVG — solo se agrega aquí una descripción corta.
const FEATURED_MODULES = [
  { to: '/app/pacientes', desc: 'Historial y expedientes' },
  { to: '/app/notas-voz', desc: 'Documenta cada sesión' },
  { to: '/app/agenda', desc: 'Tu semana de citas' },
  { to: '/app/tareas', desc: 'Ejercicios entre sesiones' },
  { to: '/app/modo-examen', desc: 'Ponte a prueba' },
  { to: '/app/tarjetas-repaso', desc: 'Repaso rápido y activo' },
];
const ALL_MENU_ROWS = PROFILE_MENU.flatMap((section) => section.rows);
const modules = FEATURED_MODULES.map(({ to, desc }) => {
  const row = ALL_MENU_ROWS.find((r) => r.to === to);
  return row ? { to, desc, label: row.label, iconPath: row.iconPath } : null;
}).filter(Boolean);

export default function Dashboard({
  stats,
  statsLoading = false,
  treeLoading = false,
  topFolders = [],
  recents = [],
  plan = 'free',
  ecosystem = null,
  ecosystemLoading = false,
  onOpenFolder,
  onOpenFile,
}) {
  const fmt = (n) => (n == null ? '—' : Number(n).toLocaleString('es'));
  const isPro = plan === 'pro';
  // Free: el gancho de upgrade ya existente. Pro: no hace falta venderle
  // nada, así que ahí se aprovecha el mismo hint para la fecha de sync.
  const documentosHint = !isPro
    ? '(Desbloquea la biblioteca completa con Pro)'
    : stats?.last_sync
      ? `Sincronizado ${formatDate(stats.last_sync)}`
      : null;

  return (
    <div className="dashboard">
      <section className="hero fade-in">
        <span className="hero__eyebrow">Psicoteca</span>
        <h1 className="hero__title">Tu sistema integral de psicología clínica y estudio</h1>
        <p className="hero__subtitle">
          Consultorio, agenda y estudio clínico en un solo lugar, con tu
          biblioteca de referencia siempre a la mano.
        </p>
      </section>

      <div className="stats fade-in">
        <StatTile
          icon={<Users width={20} height={20} />}
          value={fmt(ecosystem?.pacientes)}
          label="Pacientes activos"
          tone="accent"
          loading={ecosystemLoading}
        />
        <StatTile
          icon={<ClipboardList width={20} height={20} />}
          value={fmt(ecosystem?.tareasPendientes)}
          label="Tareas pendientes"
          loading={ecosystemLoading}
        />
        <StatTile
          icon={<Brain width={20} height={20} />}
          value={fmt(ecosystem?.glosarioTerminos)}
          label="Términos en el Glosario"
          loading={ecosystemLoading}
        />
        <StatTile
          icon={<Files width={20} height={20} />}
          value={fmt(stats?.total_files)}
          label="Documentos"
          loading={statsLoading}
          hint={documentosHint}
        />
      </div>

      <section className="dash-section fade-in">
        <header className="dash-section__head">
          <h2 className="dash-section__title">
            <Stethoscope width={17} height={17} />
            Tu consultorio y estudio
          </h2>
          <span className="muted">{modules.length} herramientas</span>
        </header>

        <div className="modules">
          {modules.map((m) => (
            <Link key={m.to} to={m.to} className="module">
              <span className="module__icon">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                  <path d={m.iconPath} />
                </svg>
              </span>
              <span className="module__name">{m.label}</span>
              <span className="module__desc">
                {m.desc}
                <ArrowRight className="module__arrow" width={15} height={15} />
              </span>
            </Link>
          ))}
        </div>
      </section>

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
