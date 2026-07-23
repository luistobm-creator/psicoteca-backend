import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Files, Users, ClipboardList, Brain, Check, Stethoscope, ArrowRight, LayoutGrid } from './icons.jsx';
import { formatDate } from '../lib/fileType.js';
import { categoryIcon } from '../lib/categoryIcons.jsx';
import { Skeleton, SkeletonCollections } from './Skeleton.jsx';
import { PROFILE_MENU } from '../lib/profileMenu.js';
import QuickAccess from './QuickAccess.jsx';
import ActivityFeed from './ActivityFeed.jsx';
import ProBadge from './ProBadge.jsx';

// Altas por día (a partir de created_at) de los últimos `days` días,
// terminando hoy. Base real tanto del sparkline como de la tendencia
// ("+N esta semana") — nunca son números inventados.
function dailyCounts(rows, days = 7) {
  const buckets = new Array(days).fill(0);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  rows.forEach((row) => {
    if (!row.created_at) return;
    const d = new Date(row.created_at);
    const dMidnight = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const dayDiff = Math.round((today - dMidnight) / 86400000);
    const idx = days - 1 - dayDiff;
    if (idx >= 0 && idx < days) buckets[idx] += 1;
  });
  return buckets;
}

// Mini-gráfico de barras hecho a mano (sin librería nueva, mismo criterio
// que los SVG de icons.jsx). La barra de hoy se resalta en acento.
function Sparkline({ data }) {
  const max = Math.max(1, ...data);
  const w = data.length * 7 - 2;
  return (
    <svg className="sparkline" width={w} height={26} viewBox={`0 0 ${w} 26`} aria-hidden="true">
      {data.map((v, i) => {
        const h = Math.max(2, Math.round((v / max) * 22));
        const isNow = i === data.length - 1;
        return (
          <rect
            key={i}
            x={i * 7}
            y={26 - h}
            width={5}
            height={h}
            rx={1.5}
            className={'sparkline__bar' + (isNow ? ' sparkline__bar--now' : '')}
          />
        );
      })}
    </svg>
  );
}

function StatTile({ icon, value, label, loading, hint, spark, trend }) {
  return (
    <div className="stat">
      <div className="stat__top">
        <span className="stat__icon">{icon}</span>
        {spark && <Sparkline data={spark} />}
      </div>
      <div className="stat__value">
        {loading ? <Skeleton className="skeleton--stat" /> : value}
      </div>
      <div className="stat__label">{label}</div>
      {!loading && trend > 0 && <div className="stat__trend">+{trend} esta semana</div>}
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
  const fmt = (n) => (n == null ? '—' : Number(n).toLocaleString('es'));
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
          value={fmt(pacientesCount)}
          label="Pacientes activos"
          loading={ecosystemLoading}
          spark={pacientesSpark}
          trend={sum(pacientesSpark)}
        />
        <StatTile
          icon={<ClipboardList width={20} height={20} />}
          value={fmt(tareasPendientesCount)}
          label="Tareas pendientes"
          loading={ecosystemLoading}
          spark={tareasSpark}
          trend={sum(tareasSpark)}
        />
        <StatTile
          icon={<Brain width={20} height={20} />}
          value={fmt(glosarioCount)}
          label="Términos en el Glosario"
          loading={ecosystemLoading}
          spark={glosarioSpark}
          trend={sum(glosarioSpark)}
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
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
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

      <ActivityFeed events={activityEvents} loading={ecosystemLoading} />

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
