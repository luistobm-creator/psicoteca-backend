import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import { ArrowLeft, CalendarCheck, DollarSign, Library, Users } from '../components/icons.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useCountUp } from '../lib/useCountUp.js';
import Gauge from '../components/Gauge.jsx';
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

const MESES_CORTOS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

function formatMonto(n) {
  return `$${Number(n).toLocaleString('es-MX', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

// Últimos `n` meses (más antiguo primero), como {key: 'YYYY-MM', label: 'ene 2026'}.
function ultimosMeses(n) {
  const out = [];
  const now = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    out.push({ key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`, label: `${MESES_CORTOS[d.getMonth()]}` });
  }
  return out;
}

// Estadísticas del consultorio: cruza pacientes + agenda + facturación para
// ingresos mensuales, índice de asistencia y retención de pacientes. 100%
// frontend — deriva todo de los 3 endpoints ya existentes, sin tabla ni
// endpoint nuevo (mismo criterio que el Dashboard).
export default function EstadisticasConsultorio() {
  const { isAuthenticated, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!authLoading && !isAuthenticated) navigate('/login', { replace: true });
  }, [authLoading, isAuthenticated, navigate]);

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  // allSettled: cada fuente puede faltar de forma independiente (p. ej.
  // facturacion antes de correr su script SQL) sin tirar abajo las gráficas
  // que sí tienen datos — mismo criterio que el ecosystem del Dashboard.
  useEffect(() => {
    if (!isAuthenticated) return;
    setLoading(true);
    Promise.allSettled([api.getPacientes(), api.getAgenda(), api.getFacturacion()]).then(
      ([pacientesR, agendaR, facturacionR]) => {
        setData({
          pacientes: pacientesR.status === 'fulfilled' ? pacientesR.value : null,
          agenda: agendaR.status === 'fulfilled' ? agendaR.value : null,
          facturacion: facturacionR.status === 'fulfilled' ? facturacionR.value : null,
          errors: {
            pacientes: pacientesR.status === 'rejected' ? pacientesR.reason?.message : null,
            agenda: agendaR.status === 'rejected' ? agendaR.reason?.message : null,
            facturacion: facturacionR.status === 'rejected' ? facturacionR.reason?.message : null,
          },
        });
        setLoading(false);
      }
    );
  }, [isAuthenticated]);

  const tieneFacturacion = !!data?.facturacion;
  const tieneAgenda = !!data?.agenda;
  const tienePacientes = !!data?.pacientes;

  const ingresosPorMes = useMemo(() => {
    const meses = ultimosMeses(6);
    if (!tieneFacturacion) return null;
    const totales = {};
    data.facturacion
      .filter((c) => c.estado === 'pagado')
      .forEach((c) => {
        const key = c.fecha.slice(0, 7); // 'YYYY-MM'
        totales[key] = (totales[key] || 0) + Number(c.monto);
      });
    return meses.map((m) => ({ ...m, monto: Math.round(totales[m.key] || 0) }));
  }, [data, tieneFacturacion]);

  const ingresosEsteMes = ingresosPorMes ? ingresosPorMes[ingresosPorMes.length - 1]?.monto ?? 0 : null;

  const asistencia = useMemo(() => {
    if (!tieneAgenda) return null;
    const marcadas = data.agenda.filter((c) => c.asistio != null);
    if (marcadas.length === 0) return null;
    const asistieron = marcadas.filter((c) => c.asistio === true).length;
    return Math.round((asistieron / marcadas.length) * 100);
  }, [data, tieneAgenda]);

  const retencion = useMemo(() => {
    if (!tieneAgenda || !tienePacientes || data.pacientes.length === 0) return null;
    const hace60 = new Date();
    hace60.setDate(hace60.getDate() - 60);
    const citasPorPaciente = new Set(
      data.agenda
        .filter((c) => c.paciente_id && new Date(c.fecha) >= hace60)
        .map((c) => c.paciente_id)
    );
    const retenidos = data.pacientes.filter((p) => citasPorPaciente.has(p.id)).length;
    return Math.round((retenidos / data.pacientes.length) * 100);
  }, [data, tieneAgenda, tienePacientes]);

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
          <h1 className="settings__title">Estadísticas del consultorio</h1>
          <p className="settings__subtitle">Ingresos, asistencia y retención, cruzando tus datos reales.</p>
        </header>

        {loading && <p className="settings__muted">Cargando…</p>}

        {!loading && data && (
          <>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <MiniStat
                icon={<DollarSign width={18} height={18} />}
                display={ingresosEsteMes == null ? '—' : formatMonto(ingresosEsteMes)}
                label="Ingresos este mes"
                hint={!tieneFacturacion ? data.errors.facturacion || 'No disponible' : null}
              />
              <MiniStat
                icon={<CalendarCheck width={18} height={18} />}
                display={asistencia == null ? '—' : `${asistencia}%`}
                label="Índice de asistencia"
                hint={
                  tieneAgenda && asistencia == null
                    ? 'Marca asistencia en tu Agenda para calcularlo'
                    : !tieneAgenda
                      ? data.errors.agenda || 'No disponible'
                      : null
                }
              />
              <MiniStat
                icon={<Users width={18} height={18} />}
                display={retencion == null ? '—' : `${retencion}%`}
                label="Retención de pacientes"
                hint={
                  tieneAgenda && tienePacientes
                    ? 'Con cita en los últimos 60 días'
                    : data.errors.agenda || data.errors.pacientes || 'No disponible'
                }
              />
            </div>

            <section className="dash-section fade-in">
              <header className="dash-section__head">
                <h2 className="dash-section__title">Ingresos mensuales</h2>
                <span className="muted">Últimos 6 meses · solo cobros pagados</span>
              </header>
              {!tieneFacturacion ? (
                <p className="settings__muted">
                  Aún no hay datos de facturación disponibles ({data.errors.facturacion}).
                </p>
              ) : (
                <div className="chart-box">
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={ingresosPorMes} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                      <XAxis dataKey="label" stroke="var(--text-muted)" fontSize={12} tickLine={false} axisLine={false} />
                      <YAxis stroke="var(--text-muted)" fontSize={12} tickLine={false} axisLine={false} width={48} />
                      <Tooltip
                        formatter={(v) => [formatMonto(v), 'Ingresos']}
                        contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8 }}
                      />
                      <Bar dataKey="monto" fill="var(--accent)" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </section>

            <section className="dash-section fade-in">
              <header className="dash-section__head">
                <h2 className="dash-section__title">Asistencia y retención</h2>
              </header>
              <div className="gauges">
                <Gauge label="Asistencia" value={asistencia} />
                <Gauge label="Retención" value={retencion} />
              </div>
            </section>
          </>
        )}
      </div>
    </div>
  );
}
