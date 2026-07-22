import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Bell, Library, Plus, X } from '../components/icons.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import * as api from '../api.js';

const SESSION_TYPES = ['Individual', 'Pareja', 'Familiar', 'Evaluación', 'Seguimiento'];

function pad(n) {
  return String(n).padStart(2, '0');
}
// Fecha local (no UTC: toISOString() correría el día según la zona horaria).
function toISODate(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
function addDays(d, n) {
  const copy = new Date(d);
  copy.setDate(copy.getDate() + n);
  return copy;
}
function dayLabel(d) {
  return d.toLocaleDateString('es', { weekday: 'short' }).replace('.', '');
}
function formatLong(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  const text = new Date(y, m - 1, d).toLocaleDateString('es', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
  // Solo la primera letra ("Miércoles, 22 de julio"): un capitalize de CSS
  // pondría mayúscula también en "de", que en español no lleva.
  return text.charAt(0).toUpperCase() + text.slice(1);
}

// Agenda de citas personal: crear, ver por día (tira de 7 días), reprogramar,
// cancelar y alternar el recordatorio. El paciente es texto libre (el
// "Directorio de pacientes" es otra herramienta, todavía "Próximamente").
// Misma página protegida que Perfil.jsx/GlosarioClinico.jsx.
export default function AgendaDeCitas() {
  const { isAuthenticated, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!authLoading && !isAuthenticated) navigate('/login', { replace: true });
  }, [authLoading, isAuthenticated, navigate]);

  const week = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return Array.from({ length: 7 }, (_, i) => addDays(today, i));
  }, []);
  const weekISO = useMemo(() => week.map(toISODate), [week]);

  const [selected, setSelected] = useState(weekISO[0]);
  const [citas, setCitas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showNew, setShowNew] = useState(false);
  const [reschedTarget, setReschedTarget] = useState(null);

  const load = () => {
    setLoading(true);
    api
      .getAgenda({ desde: weekISO[0], hasta: weekISO[weekISO.length - 1] })
      .then((data) => {
        setCitas(data);
        setError(null);
      })
      .catch((err) => setError(err.message || 'No se pudo cargar la agenda.'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (isAuthenticated) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated]);

  const dayHasCitas = useMemo(() => {
    const set = new Set(citas.map((c) => c.fecha));
    return (iso) => set.has(iso);
  }, [citas]);

  const dayCitas = useMemo(
    () => citas.filter((c) => c.fecha === selected).sort((a, b) => a.hora.localeCompare(b.hora)),
    [citas, selected]
  );

  const patch = async (id, changes) => {
    const prev = citas;
    setCitas((cur) => cur.map((c) => (c.id === id ? { ...c, ...changes } : c)));
    try {
      await api.updateCita(id, changes);
    } catch {
      setCitas(prev);
    }
  };

  const handleCancel = (cita) => {
    if (!window.confirm(`¿Cancelar la cita con ${cita.paciente_nombre}?`)) return;
    setCitas((cur) => cur.filter((c) => c.id !== cita.id));
    api.updateCita(cita.id, { estado: 'cancelada' }).catch(() => load());
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
            <h1 className="settings__title">Agenda de citas</h1>
            <p className="settings__subtitle">Tus próximas sesiones, día por día.</p>
          </div>
          <button type="button" className="glosario__addbtn" onClick={() => setShowNew(true)}>
            <Plus width={16} height={16} />
            Nueva cita
          </button>
        </header>

        <div className="agenda__week">
          {week.map((d, i) => {
            const iso = weekISO[i];
            return (
              <button
                key={iso}
                type="button"
                className={'agenda__day' + (iso === selected ? ' is-selected' : '')}
                onClick={() => setSelected(iso)}
              >
                <span className="agenda__dayname">{dayLabel(d)}</span>
                <span className="agenda__daynum">{d.getDate()}</span>
                <span className={'agenda__daydot' + (dayHasCitas(iso) ? ' is-visible' : '')} />
              </button>
            );
          })}
        </div>

        <p className="settings__subtitle agenda__selectedlabel">{formatLong(selected)}</p>

        {loading && <p className="settings__muted">Cargando…</p>}
        {!loading && error && <p className="settings__error">{error}</p>}
        {!loading && !error && dayCitas.length === 0 && (
          <div className="agenda__empty">
            <p className="settings__title" style={{ fontSize: 16 }}>
              Día libre
            </p>
            <p className="settings__muted">No tienes citas programadas.</p>
          </div>
        )}

        {!loading &&
          !error &&
          dayCitas.map((c) => (
            <article key={c.id} className="agenda__card">
              <div className="agenda__time">
                <span className="agenda__hour">{c.hora.slice(0, 5)}</span>
                <span className="agenda__dur">{c.duracion_minutos} min</span>
              </div>
              <div className="agenda__bar" />
              <div className="agenda__body">
                <div className="agenda__patient">{c.paciente_nombre}</div>
                {c.tipo_sesion && <div className="settings__muted">{c.tipo_sesion}</div>}
                <div className="agenda__chips">
                  <span className="agenda__chip">
                    {c.modalidad === 'en_linea' ? 'En línea' : 'Presencial'}
                  </span>
                  <button
                    type="button"
                    className={'agenda__chip agenda__chip--btn' + (c.recordatorio ? ' is-on' : '')}
                    onClick={() => patch(c.id, { recordatorio: !c.recordatorio })}
                  >
                    <Bell width={12} height={12} />
                    {c.recordatorio ? 'Recordatorio activo' : 'Recordatorio apagado'}
                  </button>
                  <button
                    type="button"
                    className="agenda__chip agenda__chip--btn"
                    onClick={() => setReschedTarget(c)}
                  >
                    Reprogramar
                  </button>
                  <button
                    type="button"
                    className="agenda__chip agenda__chip--btn agenda__chip--danger"
                    onClick={() => handleCancel(c)}
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            </article>
          ))}
      </div>

      {showNew && (
        <NewCitaModal
          onClose={() => setShowNew(false)}
          onCreated={(cita) => {
            setCitas((cur) => [...cur, cita]);
            setSelected(cita.fecha);
            setShowNew(false);
          }}
        />
      )}

      {reschedTarget && (
        <ReschedModal
          cita={reschedTarget}
          onClose={() => setReschedTarget(null)}
          onSaved={(changes) => {
            patch(reschedTarget.id, changes);
            setReschedTarget(null);
          }}
        />
      )}
    </div>
  );
}

function ModalityToggle({ value, onChange }) {
  return (
    <div className="agenda__modetoggle">
      <button
        type="button"
        className={value === 'presencial' ? 'is-active' : ''}
        onClick={() => onChange('presencial')}
      >
        Presencial
      </button>
      <button
        type="button"
        className={value === 'en_linea' ? 'is-active' : ''}
        onClick={() => onChange('en_linea')}
      >
        En línea
      </button>
    </div>
  );
}

// Valor especial del <select> de pacientes para "no elegí uno del directorio,
// voy a escribir el nombre a mano" (flujo original, sin cambios).
const NUEVO_NOMBRE = '__nuevo__';

function NewCitaModal({ onClose, onCreated }) {
  const [pacientes, setPacientes] = useState([]);
  const [pacienteId, setPacienteId] = useState(NUEVO_NOMBRE);
  const [nombre, setNombre] = useState('');
  const [tipo, setTipo] = useState(SESSION_TYPES[0]);
  const [fecha, setFecha] = useState(toISODate(new Date()));
  const [hora, setHora] = useState('09:00');
  const [duracion, setDuracion] = useState(50);
  const [modalidad, setModalidad] = useState('presencial');
  const [recordatorio, setRecordatorio] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  // Directorio para elegir paciente existente; si falla, no rompe el modal —
  // simplemente el <select> queda solo con la opción de escribir a mano.
  useEffect(() => {
    api.getPacientes().then(setPacientes).catch(() => {});
  }, []);

  const usingDirectorio = pacienteId !== NUEVO_NOMBRE;
  const canSave = (usingDirectorio || nombre.trim().length > 0) && fecha && hora && !saving;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!canSave) return;
    setSaving(true);
    setError(null);
    try {
      const created = await api.createCita({
        ...(usingDirectorio ? { paciente_id: pacienteId } : { paciente_nombre: nombre.trim() }),
        tipo_sesion: tipo,
        fecha,
        hora,
        duracion_minutos: Number(duracion) || 50,
        modalidad,
        recordatorio,
      });
      onCreated(created);
    } catch (err) {
      setError(err.message || 'No se pudo guardar la cita.');
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose} role="presentation">
      <div className="modal modal--form" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="modal__close" onClick={onClose} aria-label="Cerrar">
          <X width={18} height={18} />
        </button>
        <h2 className="modal__title">Nueva cita</h2>

        <form onSubmit={handleSubmit}>
          <div className="modal__field">
            <label className="settings__label">Paciente</label>
            <select
              className="settings__input"
              value={pacienteId}
              onChange={(e) => setPacienteId(e.target.value)}
            >
              <option value={NUEVO_NOMBRE}>Escribir nombre nuevo…</option>
              {pacientes.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nombre}
                </option>
              ))}
            </select>
          </div>

          {!usingDirectorio && (
            <div className="modal__field">
              <label className="settings__label">Nombre del paciente</label>
              <input
                className="settings__input"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                placeholder="p. ej. María López"
                autoFocus
              />
            </div>
          )}

          <div className="modal__field">
            <label className="settings__label">Tipo de sesión</label>
            <select className="settings__input" value={tipo} onChange={(e) => setTipo(e.target.value)}>
              {SESSION_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>

          <div className="modal__row">
            <div className="modal__field">
              <label className="settings__label">Día</label>
              <input
                type="date"
                className="settings__input"
                value={fecha}
                onChange={(e) => setFecha(e.target.value)}
              />
            </div>
            <div className="modal__field">
              <label className="settings__label">Hora</label>
              <input
                type="time"
                className="settings__input"
                value={hora}
                onChange={(e) => setHora(e.target.value)}
              />
            </div>
          </div>

          <div className="modal__field">
            <label className="settings__label">Duración (minutos)</label>
            <input
              type="number"
              min={5}
              max={480}
              step={5}
              className="settings__input"
              value={duracion}
              onChange={(e) => setDuracion(e.target.value)}
            />
          </div>

          <div className="modal__field">
            <label className="settings__label">Modalidad</label>
            <ModalityToggle value={modalidad} onChange={setModalidad} />
          </div>

          <label className="agenda__remindrow">
            <span>
              <span className="settings__value">Recordatorio</span>
              <span className="settings__muted"> — notificación antes de la cita</span>
            </span>
            <input
              type="checkbox"
              checked={recordatorio}
              onChange={(e) => setRecordatorio(e.target.checked)}
            />
          </label>

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
      </div>
    </div>
  );
}

function ReschedModal({ cita, onClose, onSaved }) {
  const [fecha, setFecha] = useState(cita.fecha);
  const [hora, setHora] = useState(cita.hora.slice(0, 5));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await api.updateCita(cita.id, { fecha, hora });
      onSaved({ fecha, hora });
    } catch (err) {
      setError(err.message || 'No se pudo reprogramar.');
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose} role="presentation">
      <div className="modal modal--form" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="modal__close" onClick={onClose} aria-label="Cerrar">
          <X width={18} height={18} />
        </button>
        <h2 className="modal__title">Reprogramar</h2>
        <p className="settings__muted" style={{ marginBottom: 16 }}>
          Nueva fecha para la cita con <strong>{cita.paciente_nombre}</strong>.
        </p>

        <form onSubmit={handleSubmit}>
          <div className="modal__row">
            <div className="modal__field">
              <label className="settings__label">Día</label>
              <input
                type="date"
                className="settings__input"
                value={fecha}
                onChange={(e) => setFecha(e.target.value)}
              />
            </div>
            <div className="modal__field">
              <label className="settings__label">Hora</label>
              <input
                type="time"
                className="settings__input"
                value={hora}
                onChange={(e) => setHora(e.target.value)}
              />
            </div>
          </div>

          {error && <div className="modal__error">{error}</div>}

          <div className="modal__actions">
            <button type="button" className="settings__btn" onClick={onClose} disabled={saving}>
              Cancelar
            </button>
            <button type="submit" className="settings__btn settings__btn--accent" disabled={saving}>
              {saving ? 'Guardando…' : 'Confirmar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
