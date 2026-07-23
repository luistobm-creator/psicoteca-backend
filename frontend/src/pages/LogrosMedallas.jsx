import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Brain,
  BookOpen,
  Check,
  ClipboardList,
  Crown,
  GraduationCap,
  Library,
  Lock,
  Sparkles,
  Star,
  Users,
} from '../components/icons.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useCountUp } from '../lib/useCountUp.js';
import * as api from '../api.js';

const CARD =
  'group relative overflow-hidden rounded-2xl border border-border bg-surface shadow-sm ' +
  'transition-all duration-300 hover:-translate-y-1 hover:border-accent/30 hover:shadow-lift dark:hover:shadow-lift-dark';

function MiniStat({ icon, value, display, label }) {
  const animated = useCountUp(typeof value === 'number' ? value : 0);
  return (
    <div className={CARD + ' flex items-center gap-3 p-4'}>
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-accent-gradient text-white shadow-sm">
        {icon}
      </span>
      <div className="min-w-0">
        <div className="text-2xl font-black leading-none tabular-nums text-ink">
          {display != null ? display : animated}
        </div>
        <div className="mt-1 text-xs font-medium text-ink-muted">{label}</div>
      </div>
    </div>
  );
}

// Cada logro se calcula de datos reales ya existentes (pacientes, tareas,
// glosario, examenes, lectura) -- sin tabla nueva, sin nada inventado. Los de
// goal=1 son binarios (desbloqueado/no); el resto muestra progreso "x/goal".
const LOGROS = [
  { id: 'primer-paciente', label: 'Primer paciente', desc: 'Agrega tu primer paciente al directorio.', icon: Users, goal: 1, metric: 'pacientes' },
  { id: 'diez-pacientes', label: 'Consultorio en marcha', desc: 'Registra 10 pacientes en tu directorio.', icon: Users, goal: 10, metric: 'pacientes' },
  { id: 'primera-tarea', label: 'Primer paso', desc: 'Crea tu primera tarea terapéutica.', icon: ClipboardList, goal: 1, metric: 'tareasCreadas' },
  { id: 'diez-tareas', label: 'Organizador', desc: 'Completa 10 tareas terapéuticas.', icon: Check, goal: 10, metric: 'tareasCompletadas' },
  { id: '25-terminos', label: 'Coleccionista de términos', desc: 'Agrega 25 términos a tu Glosario clínico.', icon: Brain, goal: 25, metric: 'glosario' },
  { id: '100-terminos', label: 'Glosario robusto', desc: 'Alcanza 100 términos en tu Glosario clínico.', icon: Brain, goal: 100, metric: 'glosario' },
  { id: 'primer-examen', label: 'Primer examen', desc: 'Completa tu primer Modo examen.', icon: GraduationCap, goal: 1, metric: 'examenes' },
  { id: 'buen-desempeno', label: 'Buen desempeño', desc: 'Aprueba un examen con 70% o más.', icon: Star, goal: 1, metric: 'examenesAprobados' },
  { id: 'racha-examenes', label: 'Racha de estudio', desc: 'Completa 5 exámenes.', icon: Sparkles, goal: 5, metric: 'examenes' },
  { id: 'maestria', label: 'Maestría', desc: 'Promedio de 90% o más (mínimo 3 exámenes).', icon: Crown, goal: 1, metric: 'maestria' },
  { id: 'lector-activo', label: 'Lector activo', desc: 'Abre 20 documentos de la biblioteca.', icon: BookOpen, goal: 20, metric: 'lecturas' },
];

// Logros y medallas: umbrales calculados en el cliente a partir de 5 fuentes
// ya existentes. 100% frontend, Promise.allSettled para que cada fuente se
// pueda degradar sola sin romper el resto (mismo criterio que Dashboard y
// las páginas de Estadísticas).
export default function LogrosMedallas() {
  const { isAuthenticated, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!authLoading && !isAuthenticated) navigate('/login', { replace: true });
  }, [authLoading, isAuthenticated, navigate]);

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isAuthenticated) return;
    setLoading(true);
    Promise.allSettled([
      api.getPacientes(),
      api.getTareas(),
      api.getGlosario(),
      api.getExamenes(),
      api.getActividadBiblioteca('vista'),
    ]).then(([pacientesR, tareasR, glosarioR, examenesR, lecturaR]) => {
      setData({
        pacientes: pacientesR.status === 'fulfilled' ? pacientesR.value : null,
        tareas: tareasR.status === 'fulfilled' ? tareasR.value : null,
        glosario: glosarioR.status === 'fulfilled' ? glosarioR.value : null,
        examenes: examenesR.status === 'fulfilled' ? examenesR.value : null,
        lectura: lecturaR.status === 'fulfilled' ? lecturaR.value : null,
        errores: [pacientesR, tareasR, glosarioR, examenesR, lecturaR].some((r) => r.status === 'rejected'),
        lecturaError: lecturaR.status === 'rejected' ? lecturaR.reason?.message : null,
      });
      setLoading(false);
    });
  }, [isAuthenticated]);

  const metrics = useMemo(() => {
    if (!data) return null;
    const examenes = data.examenes || [];
    const aprobados = examenes.filter((e) => e.respuestas_correctas / e.num_preguntas >= 0.7).length;
    const promedio = examenes.length
      ? examenes.reduce((acc, e) => acc + e.respuestas_correctas / e.num_preguntas, 0) / examenes.length
      : 0;
    return {
      pacientes: data.pacientes?.length ?? 0,
      tareasCreadas: data.tareas?.length ?? 0,
      tareasCompletadas: data.tareas?.filter((t) => t.estado === 'completada').length ?? 0,
      glosario: data.glosario?.length ?? 0,
      examenes: examenes.length,
      examenesAprobados: aprobados,
      maestria: examenes.length >= 3 && promedio >= 0.9 ? 1 : 0,
      lecturas: data.lectura?.length ?? 0,
    };
  }, [data]);

  const logrosConProgreso = useMemo(() => {
    if (!metrics) return [];
    return LOGROS.map((l) => {
      const current = Math.min(metrics[l.metric] ?? 0, l.goal);
      return { ...l, current, unlocked: current >= l.goal };
    });
  }, [metrics]);

  const desbloqueados = logrosConProgreso.filter((l) => l.unlocked).length;

  if (authLoading || !isAuthenticated) return null;

  return (
    <div className="settings">
      <div className="settings__panel fade-in">
        <div className="settings__topbar">
          <Link to="/app" className="settings__brand" title="Ir a la biblioteca">
            <span className="settings__logo">
              <Library width={20} height={20} />
            </span>
            Psicoteca
          </Link>
          <Link to="/app/perfil" className="settings__back">
            <ArrowLeft width={15} height={15} />
            Volver al menú
          </Link>
        </div>

        <header className="settings__head">
          <div>
            <h1 className="settings__title">Logros y medallas</h1>
            <p className="settings__subtitle">
              {loading ? 'Cargando…' : `${desbloqueados} de ${LOGROS.length} logros desbloqueados`}
            </p>
          </div>
        </header>

        {!loading && data?.errores && (
          <p className="settings__muted">
            Algunos logros no se pudieron calcular del todo{data.lecturaError ? ` (${data.lecturaError})` : ''}, pero
            el resto sigue funcionando.
          </p>
        )}

        {loading && <p className="settings__muted">Cargando…</p>}

        {!loading && metrics && (
          <>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <MiniStat icon={<Crown width={18} height={18} />} value={desbloqueados} label="Desbloqueados" />
              <MiniStat
                icon={<Lock width={18} height={18} />}
                value={LOGROS.length - desbloqueados}
                label="Por desbloquear"
              />
              <MiniStat
                icon={<Sparkles width={18} height={18} />}
                display={`${Math.round((desbloqueados / LOGROS.length) * 100)}%`}
                label="Progreso total"
              />
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {logrosConProgreso.map((l) => {
                const Icon = l.icon;
                return (
                  <article
                    key={l.id}
                    className={
                      'flex flex-col gap-1.5 rounded-2xl border border-border bg-surface p-4 shadow-sm transition-opacity duration-300 ' +
                      (l.unlocked ? 'opacity-100' : 'opacity-60')
                    }
                  >
                    <span
                      className={
                        'flex h-11 w-11 items-center justify-center rounded-xl shadow-sm ' +
                        (l.unlocked ? 'bg-accent-gradient text-white' : 'bg-surface-3 text-ink-soft')
                      }
                    >
                      {l.unlocked ? <Icon width={20} height={20} /> : <Lock width={18} height={18} />}
                    </span>
                    <h3 className="mt-1 text-sm font-bold text-ink">{l.label}</h3>
                    <p className="flex-1 text-xs leading-relaxed text-ink-muted">{l.desc}</p>
                    {l.goal > 1 && (
                      <div className="mt-1 flex items-center gap-2">
                        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-3">
                          <div
                            className="h-full rounded-full bg-accent-gradient transition-all duration-300"
                            style={{ width: `${(l.current / l.goal) * 100}%` }}
                          />
                        </div>
                        <span className="text-[11px] font-bold text-ink-muted">
                          {l.current}/{l.goal}
                        </span>
                      </div>
                    )}
                    {l.goal === 1 && (
                      <span
                        className={
                          'mt-1 w-fit rounded-full px-2.5 py-1 text-[11px] font-bold ' +
                          (l.unlocked ? 'bg-accent-weak text-accent' : 'bg-surface-3 text-ink-soft')
                        }
                      >
                        {l.unlocked ? '¡Desbloqueado!' : 'Pendiente'}
                      </span>
                    )}
                  </article>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
