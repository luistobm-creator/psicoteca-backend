import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Files, Users, ClipboardList, Brain, Check, Stethoscope, ArrowRight, LayoutGrid } from './icons.jsx';
import { formatDate } from '../lib/fileType.js';
import { dailyCounts } from '../lib/stats.js';
import { useCountUp } from '../lib/useCountUp.js';
import { categoryIcon } from '../lib/categoryIcons.jsx';
import { Skeleton, SkeletonCollections } from './Skeleton.jsx';
import { PROFILE_MENU } from '../lib/profileMenu.js';
import QuickAccess from './QuickAccess.jsx';
import ActivityFeed from './ActivityFeed.jsx';
import ProBadge from './ProBadge.jsx';
import Sparkline from './Sparkline.jsx';

const CARD =
  'group relative overflow-hidden rounded-2xl border border-border bg-surface p-5 shadow-soft ' +
  'transition-all duration-300 hover:-translate-y-1 hover:border-accent/30 hover:shadow-lift dark:hover:shadow-lift-dark';

function StatTile({ icon, value, label, loading, hint, spark, trend, featured = false }) {
  const numeric = typeof value === 'number' ? value : null;
  const animated = useCountUp(numeric ?? 0);
  const display = loading ? null : numeric != null ? animated.toLocaleString('es') : value;

  return (
    <div
      className={
        CARD +
        ' flex flex-col justify-between ' +
        (featured ? 'sm:col-span-2 lg:col-span-2 lg:row-span-2 min-h-[220px]' : 'min-h-[140px]')
      }
    >
      {/* halo decorativo, solo en la tarjeta destacada */}
      {featured && (
        <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-accent-gradient opacity-[0.08] blur-2xl" />
      )}

      <div className="flex items-start justify-between">
        <span
          className={
            'flex items-center justify-center rounded-xl bg-accent-gradient text-white shadow-sm ' +
            (featured ? 'h-12 w-12' : 'h-10 w-10')
          }
        >
          {icon}
        </span>
        {spark && <Sparkline data={spark} />}
      </div>

      <div className="mt-4">
        <div
          className={
            'font-black tabular-nums leading-none text-ink ' + (featured ? 'text-5xl' : 'text-3xl')
          }
        >
          {loading ? <Skeleton className="skeleton--stat" /> : display}
        </div>
        <div className={'mt-2 font-medium text-ink-muted ' + (featured ? 'text-sm' : 'text-xs')}>{label}</div>
        {!loading && trend > 0 && (
          <div className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-accent-weak px-2 py-0.5 text-xs font-semibold text-accent">
            +{trend} esta semana
          </div>
        )}
        {hint && !loading && <div className="mt-1.5 text-xs text-ink-soft">{hint}</div>}
      </div>
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
  { to: '/app/facturacion-consulta', desc: 'Cobros y deudores' },
  { to: '/app/consultorio/estadisticas', desc: 'Ingresos, asistencia y retención' },
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
  const isPro = plan === 'pro';
  // Free: el gancho de upgrade ya existente. Pro: no hace falta venderle
  // nada, así que ahí se aprovecha el mismo hint para la fecha de sync.
  const documentosHint = !isPro
    ? '(Desbloquea la biblioteca completa con Pro)'
    : stats?.last_sync
      ? `Sincronizado ${formatDate(stats.last_sync)}`
      : null;

  const pacientesList = ecosystem?.pacientes ?? null;
  const tareasList = ecosystem?.tareas ?? null;
  const glosarioList = ecosystem?.glosario ?? null;
  const examenesList = ecosystem?.examenes ?? null;

  const pacientesCount = pacientesList ? pacientesList.length : null;
  const tareasPendientesCount = tareasList
    ? tareasList.filter((t) => t.estado === 'pendiente').length
    : null;
  const glosarioCount = glosarioList ? glosarioList.length : null;

  // Sparklines y tendencia ("+N esta semana"): reales, calculados a partir
  // de created_at — no aparecen (null) si esa fuente no cargó, en vez de
  // mostrar una barra plana que insinuaría "cero actividad confirmada".
  const pacientesSpark = useMemo(() => (pacientesList ? dailyCounts(pacientesList) : null), [pacientesList]);
  const tareasSpark = useMemo(() => (tareasList ? dailyCounts(tareasList) : null), [tareasList]);
  const glosarioSpark = useMemo(() => (glosarioList ? dailyCounts(glosarioList) : null), [glosarioList]);
  const sum = (arr) => (arr ? arr.reduce((a, b) => a + b, 0) : 0);

  // Feed de "Actividad reciente": altas/eventos reales combinados de las 4
  // fuentes, ordenados por fecha. Notas de voz queda fuera (su API pide un
  // paciente concreto, agregarla aquí implicaría N llamadas extra).
  const activityEvents = useMemo(() => {
    const events = [];
    (pacientesList || []).forEach((p) => {
      if (!p.created_at) return;
      events.push({
        id: `pac-${p.id}`,
        icon: <Users width={16} height={16} />,
        label: 'Nuevo paciente',
        sublabel: p.nombre,
        at: new Date(p.created_at),
        to: '/app/pacientes',
      });
    });
    (tareasList || []).forEach((t) => {
      if (t.created_at) {
        events.push({
          id: `tarea-c-${t.id}`,
          icon: <ClipboardList width={16} height={16} />,
          label: 'Tarea asignada',
          sublabel: t.titulo,
          at: new Date(t.created_at),
          to: '/app/tareas',
        });
      }
      if (t.completed_at) {
        events.push({
          id: `tarea-d-${t.id}`,
          icon: <Check width={16} height={16} />,
          label: 'Tarea completada',
          sublabel: t.titulo,
          at: new Date(t.completed_at),
          to: '/app/tareas',
        });
      }
    });
    (glosarioList || []).forEach((g) => {
      if (!g.created_at) return;
      events.push({
        id: `gloss-${g.id}`,
        icon: <Brain width={16} height={16} />,
        label: 'Nuevo término del glosario',
        sublabel: g.termino,
        at: new Date(g.created_at),
        to: '/app/glosario',
      });
    });
    (examenesList || []).forEach((e) => {
      if (!e.created_at) return;
      events.push({
        id: `examen-${e.id}`,
        icon: <Check width={16} height={16} />,
        label: 'Examen completado',
        sublabel: `${e.respuestas_correctas}/${e.num_preguntas} correctas`,
        at: new Date(e.created_at),
        to: '/app/modo-examen',
      });
    });
    return events.sort((a, b) => b.at - a.at).slice(0, 8);
  }, [pacientesList, tareasList, glosarioList, examenesList]);

  return (
    <div className="dashboard flex flex-col gap-6">
      {/* -------- Hero -------- */}
      <section className="relative overflow-hidden rounded-2xl border border-border bg-surface px-7 py-9 shadow-soft animate-fade-up sm:px-10">
        <div className="absolute inset-0 bg-mesh-light dark:bg-mesh-dark" aria-hidden="true" />
        <div className="relative">
          <span className="inline-block rounded-full bg-accent-weak px-3 py-1 text-xs font-bold uppercase tracking-wider text-accent">
            Psicoteca
          </span>
          <h1 className="mt-4 max-w-2xl text-3xl font-black leading-tight tracking-tight text-ink sm:text-4xl">
            Tu sistema integral de psicología clínica y estudio
          </h1>
          <p className="mt-3 max-w-xl text-sm text-ink-muted sm:text-base">
            Consultorio, agenda y estudio clínico en un solo lugar, con tu biblioteca de referencia siempre a la
            mano.
          </p>
        </div>
      </section>

      {/* -------- Stats: bento asimétrico -------- */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 animate-fade-up">
        <StatTile
          featured
          icon={<Users width={22} height={22} />}
          value={pacientesCount}
          label="Pacientes activos"
          loading={ecosystemLoading}
          spark={pacientesSpark}
          trend={sum(pacientesSpark)}
        />
        <StatTile
          icon={<ClipboardList width={18} height={18} />}
          value={tareasPendientesCount}
          label="Tareas pendientes"
          loading={ecosystemLoading}
          spark={tareasSpark}
          trend={sum(tareasSpark)}
        />
        <StatTile
          icon={<Brain width={18} height={18} />}
          value={glosarioCount}
          label="Términos en el Glosario"
          loading={ecosystemLoading}
          spark={glosarioSpark}
          trend={sum(glosarioSpark)}
        />
        <StatTile
          icon={<Files width={18} height={18} />}
          value={stats?.total_files ?? null}
          label="Documentos"
          loading={statsLoading}
          hint={documentosHint}
        />
      </div>

      {/* -------- Módulos -------- */}
      <section className="animate-fade-up">
        <header className="mb-4 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-lg font-bold text-ink">
            <Stethoscope width={17} height={17} className="text-accent" />
            Tu consultorio y estudio
          </h2>
          <span className="text-sm text-ink-muted">{modules.length} herramientas</span>
        </header>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {modules.map((m) => (
            <Link key={m.to} to={m.to} className={CARD + ' flex flex-col gap-3'}>
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-accent-gradient text-white shadow-sm transition-transform duration-300 group-hover:scale-110">
                <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d={m.iconPath} />
                </svg>
              </span>
              <span className="text-sm font-bold text-ink">{m.label}</span>
              <span className="flex items-center gap-1 text-xs text-ink-muted">
                {m.desc}
                <ArrowRight
                  width={13}
                  height={13}
                  className="ml-auto shrink-0 -translate-x-1 text-accent opacity-0 transition-all duration-300 group-hover:translate-x-0 group-hover:opacity-100"
                />
              </span>
            </Link>
          ))}
        </div>
      </section>

      <div className="animate-fade-up">
        <ActivityFeed events={activityEvents} loading={ecosystemLoading} />
      </div>

      <div className="animate-fade-up">
        <QuickAccess
          recents={recents}
          topFolders={topFolders}
          plan={plan}
          onOpenFile={onOpenFile}
          onOpenFolder={onOpenFolder}
        />
      </div>

      {/* -------- Categorías -------- */}
      <section className="animate-fade-up">
        <header className="mb-4 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-lg font-bold text-ink">
            <LayoutGrid width={17} height={17} className="text-accent" />
            Categorías principales
          </h2>
          {!treeLoading && <span className="text-sm text-ink-muted">{topFolders.length} colecciones</span>}
        </header>

        {treeLoading ? (
          <SkeletonCollections />
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {topFolders.map((f) => {
              const premium = !!f.is_premium;
              return (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => onOpenFolder(f)}
                  title={premium ? `${f.name} · Contenido Pro` : f.name}
                  className={CARD + ' flex flex-col gap-3 text-left'}
                >
                  <span className="flex items-center justify-between">
                    <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-surface-2 text-accent transition-transform duration-300 group-hover:scale-110">
                      {categoryIcon(f.name, 19)}
                    </span>
                    {premium && <ProBadge plan={plan} />}
                  </span>
                  <span className="text-sm font-bold text-ink">{f.name}</span>
                  <span className="flex items-center gap-1 text-xs text-ink-muted">
                    {f.child_count > 0
                      ? `${f.child_count} subcarpeta${f.child_count === 1 ? '' : 's'}`
                      : 'Ver documentos'}
                    <ArrowRight
                      width={13}
                      height={13}
                      className="ml-auto shrink-0 -translate-x-1 text-accent opacity-0 transition-all duration-300 group-hover:translate-x-0 group-hover:opacity-100"
                    />
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
