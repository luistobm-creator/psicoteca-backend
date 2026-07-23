import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AlertTriangle, ArrowLeft, DollarSign, Library, Plus, TrendingUp, X } from '../components/icons.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useCountUp } from '../lib/useCountUp.js';
import * as api from '../api.js';

const CARD =
  'group relative overflow-hidden rounded-2xl border border-border bg-surface shadow-sm ' +
  'transition-all duration-300 hover:-translate-y-1 hover:border-accent/30 hover:shadow-lift dark:hover:shadow-lift-dark';

function MoneyStat({ icon, value, label, featured = false, tone = 'accent' }) {
  const animated = useCountUp(Math.round(value));
  const toneClasses =
    tone === 'danger'
      ? 'bg-danger/10 text-danger'
      : 'bg-accent-gradient text-white';
  return (
    <div className={CARD + ' flex flex-col gap-3 p-4' + (featured ? ' sm:col-span-2' : '')}>
      <span className={'flex h-11 w-11 items-center justify-center rounded-xl shadow-sm ' + toneClasses}>
        {icon}
      </span>
      <div>
        <div className={'font-black leading-none tabular-nums text-ink ' + (featured ? 'text-4xl' : 'text-2xl')}>
          ${animated.toLocaleString('es-MX')}
        </div>
        <div className="mt-1.5 text-xs font-medium text-ink-muted">{label}</div>
      </div>
    </div>
  );
}

function pad(n) {
  return String(n).padStart(2, '0');
}
function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
function formatMonto(n) {
  return `$${Number(n).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
function formatFecha(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('es', { day: 'numeric', month: 'short', year: 'numeric' });
}

// Facturación y pagos: registrar cobros por paciente, ver deudores
// (pendientes, con "vencido" resaltado) e historial de pagados. Un cobro no
// se borra: se anula (mismo criterio de preservar historial que
// tareas/pacientes/citas — aquí con más razón, al ser un registro
// financiero). Misma página protegida que el resto de Perfil/*.
export default function FacturacionPagos() {
  const { isAuthenticated, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!authLoading && !isAuthenticated) navigate('/login', { replace: true });
  }, [authLoading, isAuthenticated, navigate]);

  const [cobros, setCobros] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [tab, setTab] = useState('pendiente'); // 'pendiente' | 'pagado'
  const [showNew, setShowNew] = useState(false);

  const load = () => {
    setLoading(true);
    api
      .getFacturacion()
      .then((data) => {
        setCobros(data);
        setError(null);
      })
      .catch((err) => setError(err.message || 'No se pudieron cargar los cobros.'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (isAuthenticated) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated]);

  const hoy = useMemo(() => todayISO(), []);
  const isVencido = (c) => c.estado === 'pendiente' && c.fecha < hoy;

  const visibles = useMemo(() => cobros.filter((c) => c.estado === tab), [cobros, tab]);
  const totalPendiente = useMemo(
    () => cobros.filter((c) => c.estado === 'pendiente').reduce((sum, c) => sum + Number(c.monto), 0),
    [cobros]
  );
  // Mini-stats adicionales, derivadas de `cobros` (ya cargado) sin llamadas nuevas.
  const totalPagadoMes = useMemo(() => {
    const [y, m] = hoy.split('-');
    return cobros
      .filter((c) => c.estado === 'pagado' && c.fecha.slice(0, 4) === y && c.fecha.slice(5, 7) === m)
      .reduce((sum, c) => sum + Number(c.monto), 0);
  }, [cobros, hoy]);
  const vencidosCount = useMemo(() => cobros.filter((c) => isVencido(c)).length, [cobros, hoy]);

  const patch = async (id, changes) => {
    const prev = cobros;
    setCobros((cur) => cur.map((c) => (c.id === id ? { ...c, ...changes } : c)));
    try {
      const updated = await api.updateFacturacion(id, changes);
      setCobros((cur) => cur.map((c) => (c.id === id ? updated : c)));
    } catch {
      setCobros(prev);
    }
  };

  const handleAnular = (cobro) => {
    if (!window.confirm(`¿Anular el cobro de ${formatMonto(cobro.monto)} a ${cobro.paciente_nombre}?`)) return;
    const prev = cobros;
    setCobros((cur) => cur.filter((c) => c.id !== cobro.id));
    api.updateFacturacion(cobro.id, { estado: 'anulado' }).catch(() => setCobros(prev));
  };

  if (authLoading || !isAuthenticated) return null;

  const chipBase =
    'inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs font-semibold text-ink-muted transition-colors duration-150';
  const chipBtn = chipBase + ' hover:border-accent/40 hover:text-accent cursor-pointer';
  const chipDanger = 'border-transparent bg-danger/10 text-danger hover:border-transparent hover:text-danger';

  return (
    <div className="settings">
      <div className="settings__panel fade-in max-w-[860px]">
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

        <header className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="settings__title">Facturación y pagos</h1>
            <p className="settings__subtitle">Cobros, deudores y pagos de tu consultorio.</p>
          </div>
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-xl bg-accent-gradient px-4 py-2.5 text-sm font-bold text-white shadow-[0_2px_10px_-2px_var(--accent-soft)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_6px_18px_-4px_var(--accent-soft)] active:translate-y-0"
            onClick={() => setShowNew(true)}
          >
            <Plus width={16} height={16} />
            Nuevo cobro
          </button>
        </header>

        {/* -------- Mini-stats (bento) -------- */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <MoneyStat
            featured
            icon={<DollarSign width={20} height={20} />}
            value={totalPendiente}
            label="Pendiente de cobro"
          />
          <MoneyStat icon={<TrendingUp width={18} height={18} />} value={totalPagadoMes} label="Cobrado este mes" />
          <div className={CARD + ' flex items-center gap-3 p-4'}>
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-danger/10 text-danger shadow-sm">
              <AlertTriangle width={18} height={18} />
            </span>
            <div>
              <div className="text-2xl font-black leading-none tabular-nums text-ink">{vencidosCount}</div>
              <div className="mt-1 text-xs font-medium text-ink-muted">Vencidos</div>
            </div>
          </div>
        </div>

        <div className="agenda__modetoggle">
          <button type="button" className={tab === 'pendiente' ? 'is-active' : ''} onClick={() => setTab('pendiente')}>
            Pendientes
          </button>
          <button type="button" className={tab === 'pagado' ? 'is-active' : ''} onClick={() => setTab('pagado')}>
            Pagados
          </button>
        </div>

        {loading && <p className="settings__muted">Cargando…</p>}
        {!loading && error && <p className="settings__error">{error}</p>}
        {!loading && !error && visibles.length === 0 && (
          <div className="rounded-2xl border border-dashed border-border bg-surface-2/40 px-6 py-12 text-center">
            <p className="text-base font-bold text-ink">{tab === 'pendiente' ? 'Sin pendientes' : 'Sin pagos registrados'}</p>
            <p className="mt-1 text-sm text-ink-muted">
              {tab === 'pendiente' ? 'No tienes cobros pendientes — no hay deudores.' : 'Aún no registras ningún pago.'}
            </p>
          </div>
        )}

        <div className="flex flex-col gap-3">
          {!loading &&
            !error &&
            visibles.map((c) => {
              const vencido = isVencido(c);
              return (
                <article key={c.id} className={CARD + ' flex gap-4 p-4'}>
                  <div
                    className={
                      'flex min-w-[100px] shrink-0 flex-col items-center justify-center rounded-xl px-3 py-2 shadow-sm ' +
                      (vencido ? 'bg-danger/10 text-danger' : 'bg-accent-gradient text-white')
                    }
                  >
                    <span className="text-xl font-black leading-none tabular-nums">{formatMonto(c.monto)}</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-bold text-ink">{c.paciente_nombre}</div>
                    <div className="text-xs text-ink-muted">{c.concepto || 'Sin concepto'}</div>
                    <div className="mt-2.5 flex flex-wrap gap-1.5">
                      <span className={chipBase + (vencido ? ' border-transparent bg-danger/10 text-danger' : '')}>
                        {vencido ? 'Vencido · ' : ''}
                        {formatFecha(c.fecha)}
                      </span>
                      {c.estado === 'pendiente' && (
                        <button type="button" className={chipBtn} onClick={() => patch(c.id, { estado: 'pagado' })}>
                          Marcar pagado
                        </button>
                      )}
                      {c.estado === 'pagado' && (
                        <button type="button" className={chipBtn} onClick={() => patch(c.id, { estado: 'pendiente' })}>
                          Reabrir
                        </button>
                      )}
                      <button type="button" className={chipBtn + ' ' + chipDanger} onClick={() => handleAnular(c)}>
                        Anular
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
        </div>
      </div>

      {showNew && (
        <NuevoCobroModal
          onClose={() => setShowNew(false)}
          onCreated={(cobro) => {
            setCobros((cur) => [cobro, ...cur]);
            setTab('pendiente');
            setShowNew(false);
          }}
        />
      )}
    </div>
  );
}

function NuevoCobroModal({ onClose, onCreated }) {
  const [pacientes, setPacientes] = useState([]);
  const [pacientesError, setPacientesError] = useState(null);
  const [pacienteId, setPacienteId] = useState('');
  const [monto, setMonto] = useState('');
  const [fecha, setFecha] = useState(todayISO());
  const [concepto, setConcepto] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    api
      .getPacientes()
      .then((data) => {
        setPacientes(data);
        setPacienteId((cur) => cur || data[0]?.id || '');
      })
      .catch((err) => setPacientesError(err.message || 'No se pudo cargar el directorio.'));
  }, []);

  const montoNum = Number(monto);
  const canSave = pacienteId && montoNum > 0 && fecha && !saving;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!canSave) return;
    setSaving(true);
    setError(null);
    try {
      const created = await api.createFacturacion({
        paciente_id: pacienteId,
        monto: montoNum,
        fecha,
        concepto: concepto.trim() || null,
      });
      onCreated(created);
    } catch (err) {
      setError(err.message || 'No se pudo guardar el cobro.');
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose} role="presentation">
      <div className="modal modal--form" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="modal__close" onClick={onClose} aria-label="Cerrar">
          <X width={18} height={18} />
        </button>
        <h2 className="modal__title">Nuevo cobro</h2>

        {pacientesError && <p className="settings__error">{pacientesError}</p>}
        {!pacientesError && pacientes.length === 0 && (
          <p className="settings__muted">
            Necesitas al menos un paciente en tu <Link to="/app/pacientes">Directorio</Link> para registrar un cobro.
          </p>
        )}

        {pacientes.length > 0 && (
          <form onSubmit={handleSubmit}>
            <div className="modal__field">
              <label className="settings__label">Paciente</label>
              <select className="settings__input" value={pacienteId} onChange={(e) => setPacienteId(e.target.value)}>
                {pacientes.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nombre}
                  </option>
                ))}
              </select>
            </div>

            <div className="modal__row">
              <div className="modal__field">
                <label className="settings__label">Monto</label>
                <input
                  type="number"
                  min={0.01}
                  step="0.01"
                  className="settings__input"
                  value={monto}
                  onChange={(e) => setMonto(e.target.value)}
                  placeholder="p. ej. 800"
                  autoFocus
                />
              </div>
              <div className="modal__field">
                <label className="settings__label">Fecha</label>
                <input
                  type="date"
                  className="settings__input"
                  value={fecha}
                  onChange={(e) => setFecha(e.target.value)}
                />
              </div>
            </div>

            <div className="modal__field">
              <label className="settings__label">Concepto</label>
              <input
                className="settings__input"
                value={concepto}
                onChange={(e) => setConcepto(e.target.value)}
                placeholder="p. ej. Sesión individual (opcional)"
              />
            </div>

            {error && <div className="modal__error">{error}</div>}

            <div className="modal__actions">
              <button type="button" className="settings__btn" onClick={onClose} disabled={saving}>
                Cancelar
              </button>
              <button type="submit" className="settings__btn settings__btn--accent" disabled={!canSave}>
                {saving ? 'Guardando…' : 'Guardar'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
