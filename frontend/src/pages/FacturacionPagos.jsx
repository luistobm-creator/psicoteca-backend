import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Library, Plus, X } from '../components/icons.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import * as api from '../api.js';

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

        <header className="settings__head agenda__head">
          <div>
            <h1 className="settings__title">Facturación y pagos</h1>
            <p className="settings__subtitle">
              {formatMonto(totalPendiente)} pendiente de cobro
            </p>
          </div>
          <button type="button" className="glosario__addbtn" onClick={() => setShowNew(true)}>
            <Plus width={16} height={16} />
            Nuevo cobro
          </button>
        </header>

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
          <div className="agenda__empty">
            <p className="settings__title" style={{ fontSize: 16 }}>
              {tab === 'pendiente' ? 'Sin pendientes' : 'Sin pagos registrados'}
            </p>
            <p className="settings__muted">
              {tab === 'pendiente' ? 'No tienes cobros pendientes — no hay deudores.' : 'Aún no registras ningún pago.'}
            </p>
          </div>
        )}

        {!loading &&
          !error &&
          visibles.map((c) => (
            <article key={c.id} className="agenda__card">
              <div className="agenda__bar" />
              <div className="agenda__body">
                <div className="agenda__patient">{c.paciente_nombre}</div>
                <div className="settings__muted">{c.concepto || 'Sin concepto'}</div>
                <div className="agenda__chips">
                  <span className="agenda__chip" style={{ fontWeight: 700 }}>
                    {formatMonto(c.monto)}
                  </span>
                  <span className={'agenda__chip' + (isVencido(c) ? ' agenda__chip--danger' : '')}>
                    {isVencido(c) ? 'Vencido · ' : ''}
                    {formatFecha(c.fecha)}
                  </span>
                  {c.estado === 'pendiente' && (
                    <button
                      type="button"
                      className="agenda__chip agenda__chip--btn"
                      onClick={() => patch(c.id, { estado: 'pagado' })}
                    >
                      Marcar pagado
                    </button>
                  )}
                  {c.estado === 'pagado' && (
                    <button
                      type="button"
                      className="agenda__chip agenda__chip--btn"
                      onClick={() => patch(c.id, { estado: 'pendiente' })}
                    >
                      Reabrir
                    </button>
                  )}
                  <button
                    type="button"
                    className="agenda__chip agenda__chip--btn agenda__chip--danger"
                    onClick={() => handleAnular(c)}
                  >
                    Anular
                  </button>
                </div>
              </div>
            </article>
          ))}
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
