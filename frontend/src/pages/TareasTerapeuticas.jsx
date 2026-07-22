import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Check, Library, Plus, X } from '../components/icons.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import * as api from '../api.js';

const TIPOS = [
  { value: 'ejercicio', label: 'Ejercicio' },
  { value: 'lectura', label: 'Lectura' },
  { value: 'registro', label: 'Registro' },
];

function pad(n) {
  return String(n).padStart(2, '0');
}
function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
function formatShort(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('es', { day: 'numeric', month: 'short' });
}
function tipoLabel(tipo) {
  return TIPOS.find((t) => t.value === tipo)?.label || tipo;
}

// Tareas terapéuticas: asignar ejercicios/lecturas/registros a un paciente del
// Directorio para hacer entre sesiones, y ver su estado. Lista plana (todos
// los pacientes a la vez, como un tablero de pendientes de la consulta) con
// pestañas Pendientes/Completadas. "Cancelar" es el único borrado (soft,
// estado=cancelada) — igual criterio que Agenda de citas.
export default function TareasTerapeuticas() {
  const { isAuthenticated, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!authLoading && !isAuthenticated) navigate('/login', { replace: true });
  }, [authLoading, isAuthenticated, navigate]);

  const [tareas, setTareas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [tab, setTab] = useState('pendiente');
  const [showNew, setShowNew] = useState(false);

  const load = () => {
    setLoading(true);
    api
      .getTareas()
      .then((data) => {
        setTareas(data);
        setError(null);
      })
      .catch((err) => setError(err.message || 'No se pudieron cargar las tareas.'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (isAuthenticated) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated]);

  const hoy = useMemo(() => todayISO(), []);
  const isVencida = (t) => t.estado === 'pendiente' && t.fecha_limite && t.fecha_limite < hoy;

  const visibles = useMemo(() => tareas.filter((t) => t.estado === tab), [tareas, tab]);
  const pendientesCount = useMemo(() => tareas.filter((t) => t.estado === 'pendiente').length, [tareas]);

  // Actualización optimista con rollback, igual que patch() en AgendaDeCitas.
  const patch = async (id, changes) => {
    const prev = tareas;
    setTareas((cur) => cur.map((t) => (t.id === id ? { ...t, ...changes } : t)));
    try {
      const updated = await api.updateTarea(id, changes);
      setTareas((cur) => cur.map((t) => (t.id === id ? updated : t)));
    } catch {
      setTareas(prev);
    }
  };

  const handleCancel = (tarea) => {
    if (!window.confirm(`¿Cancelar "${tarea.titulo}"? Ya no aparecerá en la lista.`)) return;
    const prev = tareas;
    setTareas((cur) => cur.filter((t) => t.id !== tarea.id));
    api.updateTarea(tarea.id, { estado: 'cancelada' }).catch(() => setTareas(prev));
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
            <h1 className="settings__title">Tareas terapéuticas</h1>
            <p className="settings__subtitle">
              {pendientesCount} {pendientesCount === 1 ? 'pendiente' : 'pendientes'} en tu consulta
            </p>
          </div>
          <button type="button" className="glosario__addbtn" onClick={() => setShowNew(true)}>
            <Plus width={16} height={16} />
            Nueva tarea
          </button>
        </header>

        <div className="agenda__modetoggle">
          <button type="button" className={tab === 'pendiente' ? 'is-active' : ''} onClick={() => setTab('pendiente')}>
            Pendientes
          </button>
          <button type="button" className={tab === 'completada' ? 'is-active' : ''} onClick={() => setTab('completada')}>
            Completadas
          </button>
        </div>

        {loading && <p className="settings__muted">Cargando…</p>}
        {!loading && error && <p className="settings__error">{error}</p>}
        {!loading && !error && visibles.length === 0 && (
          <div className="agenda__empty">
            <p className="settings__title" style={{ fontSize: 16 }}>
              {tab === 'pendiente' ? 'Sin pendientes' : 'Sin completadas'}
            </p>
            <p className="settings__muted">
              {tab === 'pendiente' ? 'No tienes tareas asignadas por hacer.' : 'Aún no marcas ninguna tarea como completada.'}
            </p>
          </div>
        )}

        {!loading &&
          !error &&
          visibles.map((t) => (
            <article key={t.id} className="agenda__card">
              <div className="agenda__bar" />
              <div className="agenda__body">
                <div className="agenda__patient">{t.paciente_nombre}</div>
                <div className="settings__muted">{t.titulo}</div>
                {t.descripcion && <p className="settings__muted" style={{ marginTop: 4 }}>{t.descripcion}</p>}
                <div className="agenda__chips">
                  <span className="agenda__chip">{tipoLabel(t.tipo)}</span>
                  {t.estado === 'pendiente' && t.fecha_limite && (
                    <span className={'agenda__chip' + (isVencida(t) ? ' agenda__chip--danger' : '')}>
                      {isVencida(t) ? 'Vencida · ' : 'Vence '}
                      {formatShort(t.fecha_limite)}
                    </span>
                  )}
                  {t.estado === 'completada' && t.completed_at && (
                    <span className="agenda__chip">Completada {formatShort(t.completed_at.slice(0, 10))}</span>
                  )}
                  {t.estado === 'pendiente' && (
                    <button
                      type="button"
                      className="agenda__chip agenda__chip--btn"
                      onClick={() => patch(t.id, { estado: 'completada' })}
                    >
                      <Check width={12} height={12} />
                      Marcar completada
                    </button>
                  )}
                  {t.estado === 'completada' && (
                    <button
                      type="button"
                      className="agenda__chip agenda__chip--btn"
                      onClick={() => patch(t.id, { estado: 'pendiente' })}
                    >
                      Reabrir
                    </button>
                  )}
                  <button
                    type="button"
                    className="agenda__chip agenda__chip--btn agenda__chip--danger"
                    onClick={() => handleCancel(t)}
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            </article>
          ))}
      </div>

      {showNew && (
        <NewTareaModal
          onClose={() => setShowNew(false)}
          onCreated={(tarea) => {
            setTareas((cur) => [...cur, tarea]);
            setTab('pendiente');
            setShowNew(false);
          }}
        />
      )}
    </div>
  );
}

function NewTareaModal({ onClose, onCreated }) {
  const [pacientes, setPacientes] = useState([]);
  const [pacientesError, setPacientesError] = useState(null);
  const [pacienteId, setPacienteId] = useState('');
  const [titulo, setTitulo] = useState('');
  const [tipo, setTipo] = useState(TIPOS[0].value);
  const [descripcion, setDescripcion] = useState('');
  const [fechaLimite, setFechaLimite] = useState('');
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

  const canSave = pacienteId && titulo.trim().length > 0 && !saving;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!canSave) return;
    setSaving(true);
    setError(null);
    try {
      const created = await api.createTarea({
        paciente_id: pacienteId,
        titulo: titulo.trim(),
        tipo,
        descripcion: descripcion.trim() || null,
        fecha_limite: fechaLimite || null,
      });
      onCreated(created);
    } catch (err) {
      setError(err.message || 'No se pudo guardar la tarea.');
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose} role="presentation">
      <div className="modal modal--form" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="modal__close" onClick={onClose} aria-label="Cerrar">
          <X width={18} height={18} />
        </button>
        <h2 className="modal__title">Nueva tarea</h2>

        {pacientesError && <p className="settings__error">{pacientesError}</p>}
        {!pacientesError && pacientes.length === 0 && (
          <p className="settings__muted">
            Necesitas al menos un paciente en tu <Link to="/app/pacientes">Directorio</Link> para asignarle una tarea.
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

            <div className="modal__field">
              <label className="settings__label">Título</label>
              <input
                className="settings__input"
                value={titulo}
                onChange={(e) => setTitulo(e.target.value)}
                placeholder="p. ej. Registro de pensamientos automáticos"
                autoFocus
              />
            </div>

            <div className="modal__row">
              <div className="modal__field">
                <label className="settings__label">Tipo</label>
                <select className="settings__input" value={tipo} onChange={(e) => setTipo(e.target.value)}>
                  {TIPOS.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="modal__field">
                <label className="settings__label">Fecha límite</label>
                <input
                  type="date"
                  className="settings__input"
                  value={fechaLimite}
                  onChange={(e) => setFechaLimite(e.target.value)}
                />
              </div>
            </div>

            <div className="modal__field">
              <label className="settings__label">Descripción</label>
              <textarea
                className="modal__textarea"
                value={descripcion}
                onChange={(e) => setDescripcion(e.target.value)}
                rows={3}
                placeholder="Instrucciones para el paciente (opcional)"
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
