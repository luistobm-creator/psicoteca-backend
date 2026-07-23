import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import { ArrowLeft, BookOpen, Brain, GraduationCap, Library, TrendingUp } from '../components/icons.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useCountUp } from '../lib/useCountUp.js';
import Gauge from '../components/Gauge.jsx';
import { dailyCounts } from '../lib/stats.js';
import * as api from '../api.js';

const CARD =
  'group relative overflow-hidden rounded-2xl border border-border bg-surface shadow-sm ' +
  'transition-all duration-300 hover:-translate-y-1 hover:border-accent/30 hover:shadow-lift dark:hover:shadow-lift-dark';

function MiniStat({ icon, value, display, label, hint }) {
  const animated = useCountUp(typeof value === 'number' ? value : 0);
  return (
    <div className={CARD + ' flex flex-col gap-3 p-4'}>
      <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-accent-gradient text-white shadow-sm">
        {icon}
      </span>
      <div>
        <div className="text-2xl font-black leading-none tabular-nums text-ink">
          {display != null ? display : animated}
        </div>
        <div className="mt-1.5 text-xs font-medium text-ink-muted">{label}</div>
        {hint && <div className="mt-1 text-[11px] font-semibold text-accent">{hint}</div>}
      </div>
    </div>
  );
}

const DIAS_CORTOS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];

// Etiquetas de los últimos `n` días (más antiguo primero), alineadas con el
// orden de buckets que produce `dailyCounts`.
function ultimosDias(n) {
  const out = [];
  const hoy = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() - i);
    out.push(DIAS_CORTOS[d.getDay()]);
  }
  return out;
}

// Estadísticas de estudio: cruza Modo examen + Glosario + Historial de
// lectura. 100% frontend, deriva todo de los 3 endpoints ya existentes
// (mismo criterio que Estadísticas del consultorio) — sin tabla nueva.
export default function EstadisticasEstudio() {
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
    Promise.allSettled([api.getExamenes(), api.getGlosario(), api.getActividadBiblioteca('vista')]).then(
      ([examenesR, glosarioR, lecturaR]) => {
        setData({
          examenes: examenesR.status === 'fulfilled' ? examenesR.value : null,
          glosario: glosarioR.status === 'fulfilled' ? glosarioR.value : null,
          lectura: lecturaR.status === 'fulfilled' ? lecturaR.value : null,
          errors: {
            examenes: examenesR.status === 'rejected' ? examenesR.reason?.message : null,
            glosario: glosarioR.status === 'rejected' ? glosarioR.reason?.message : null,
            lectura: lecturaR.status === 'rejected' ? lecturaR.reason?.message : null,
          },
        });
        setLoading(false);
      }
    );
  }, [isAuthenticated]);

  const tieneExamenes = !!data?.examenes;
  const tieneGlosario = !!data?.glosario;
  const tieneLectura = !!data?.lectura;

  const progresoExamenes = useMemo(() => {
    if (!tieneExamenes || data.examenes.length === 0) return null;
    return [...data.examenes]
      .sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
      .slice(-10)
      .map((e, i) => ({
        intento: `#${i + 1}`,
        pct: Math.round((e.respuestas_correctas / e.num_preguntas) * 100),
      }));
  }, [data, tieneExamenes]);

  const promedioGeneral = useMemo(() => {
    if (!progresoExamenes) return null;
    const suma = progresoExamenes.reduce((acc, e) => acc + e.pct, 0);
    return Math.round(suma / progresoExamenes.length);
  }, [progresoExamenes]);

  const tasaAprobacion = useMemo(() => {
    if (!progresoExamenes) return null;
    const aprobados = progresoExamenes.filter((e) => e.pct >= 70).length;
    return Math.round((aprobados / progresoExamenes.length) * 100);
  }, [progresoExamenes]);

  const lecturaPorDia = useMemo(() => {
    if (!tieneLectura) return null;
    const dias = ultimosDias(7);
    const counts = dailyCounts(data.lectura, 7);
    return dias.map((label, i) => ({ label, lecturas: counts[i] }));
  }, [data, tieneLectura]);

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
          <h1 className="settings__title">Estadísticas de estudio</h1>
          <p className="settings__subtitle">Tu Modo examen, tu Glosario y tu lectura, cruzados en un solo lugar.</p>
        </header>

        {loading && <p className="settings__muted">Cargando…</p>}

        {!loading && data && (
          <>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <MiniStat
                icon={<GraduationCap width={18} height={18} />}
                value={tieneExamenes ? data.examenes.length : null}
                display={!tieneExamenes ? '—' : undefined}
                label="Exámenes realizados"
                hint={!tieneExamenes ? data.errors.examenes || 'No disponible' : null}
              />
              <MiniStat
                icon={<TrendingUp width={18} height={18} />}
                display={promedioGeneral == null ? '—' : `${promedioGeneral}%`}
                label="Promedio general"
                hint={tieneExamenes && promedioGeneral == null ? 'Realiza un examen para calcularlo' : null}
              />
              <MiniStat
                icon={<Brain width={18} height={18} />}
                value={tieneGlosario ? data.glosario.length : null}
                display={!tieneGlosario ? '—' : undefined}
                label="Términos en el glosario"
                hint={!tieneGlosario ? data.errors.glosario || 'No disponible' : null}
              />
              <MiniStat
                icon={<BookOpen width={18} height={18} />}
                value={tieneLectura ? data.lectura.length : null}
                display={!tieneLectura ? '—' : undefined}
                label="Documentos leídos"
                hint={!tieneLectura ? data.errors.lectura || 'No disponible' : null}
              />
            </div>

            <section className="dash-section fade-in">
              <header className="dash-section__head">
                <h2 className="dash-section__title">Progreso en Modo examen</h2>
                <span className="muted">Últimos {progresoExamenes?.length || 0} intentos</span>
              </header>
              {!progresoExamenes ? (
                <p className="settings__muted">
                  {tieneExamenes
                    ? 'Aún no has realizado ningún examen.'
                    : `Aún no hay datos de exámenes disponibles (${data.errors.examenes}).`}
                </p>
              ) : (
                <div className="chart-box">
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={progresoExamenes} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                      <XAxis dataKey="intento" stroke="var(--text-muted)" fontSize={12} tickLine={false} axisLine={false} />
                      <YAxis
                        stroke="var(--text-muted)"
                        fontSize={12}
                        tickLine={false}
                        axisLine={false}
                        width={40}
                        domain={[0, 100]}
                      />
                      <Tooltip
                        formatter={(v) => [`${v}%`, 'Calificación']}
                        contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8 }}
                      />
                      <Bar dataKey="pct" fill="var(--accent)" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </section>

            <section className="dash-section fade-in">
              <header className="dash-section__head">
                <h2 className="dash-section__title">Desempeño general</h2>
              </header>
              <div className="gauges">
                <Gauge label="Promedio general" value={promedioGeneral} />
                <Gauge label="Tasa de aprobación (≥70%)" value={tasaAprobacion} />
              </div>
            </section>

            <section className="dash-section fade-in">
              <header className="dash-section__head">
                <h2 className="dash-section__title">Lectura de los últimos 7 días</h2>
              </header>
              {!tieneLectura ? (
                <p className="settings__muted">Aún no hay datos de lectura disponibles ({data.errors.lectura}).</p>
              ) : (
                <div className="chart-box">
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={lecturaPorDia} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                      <XAxis dataKey="label" stroke="var(--text-muted)" fontSize={12} tickLine={false} axisLine={false} />
                      <YAxis stroke="var(--text-muted)" fontSize={12} tickLine={false} axisLine={false} width={32} allowDecimals={false} />
                      <Tooltip
                        formatter={(v) => [v, 'Documentos abiertos']}
                        contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8 }}
                      />
                      <Bar dataKey="lecturas" fill="var(--serene)" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </div>
  );
}
