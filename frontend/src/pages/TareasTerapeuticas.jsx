import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AlertTriangle, ArrowLeft, Check, ClipboardList, Library, Plus, X } from '../components/icons.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useCountUp } from '../lib/useCountUp.js';
import * as api from '../api.js';

const CARD =
  'group relative overflow-hidden rounded-2xl border border-border bg-surface shadow-sm ' +
  'transition-all duration-300 hover:-translate-y-1 hover:border-accent/30 hover:shadow-lift dark:hover:shadow-lift-dark';

function MiniStat({ icon, value, label, featured = false }) {
  const animated = useCountUp(typeof value === 'number' ? value : 0);
  return (
    <div className={CARD + ' flex items-center gap-3 p-4' + (featured ? ' sm:col-span-1' : '')}>
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-accent-gradient text-white shadow-sm">
        {icon}
      </span>
      <div className="min-w-0">
        <div className="text-2xl font-black leading-none tabular-nums text-ink">{animated}</div>
        <div className="mt-1 text-xs font-medium text-ink-muted">{label}</div>
      </div>
    </div>
  );
}

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
  const completadasCount = useMemo(() => tareas.filter((t) => t.estado === 'completada').length, [tareas]);
  const vencidasCount = useMemo(() => tareas.filter((t) => isVencida(t)).length, [tareas, hoy]);

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

  const chipBase =
    'inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs font-semibold text-ink-muted transition-colors duration-150';
  const chipBtn = chipBase + ' hover:border-accent/40 hover:text-accent cursor-pointer';
  const chipOn = 'border-transparent bg-accent-weak text-accent hover:border-transparent hover:text-accent';
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
            <h1 className="settings__title">Tareas terapéuticas</h1>
            <p className="settings__subtitle">
              {pendientesCount} {pendientesCount === 1 ? 'pendiente' : 'pendientes'} en tu consulta
            </p>
          </div>
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-xl bg-accent-gradient px-4 py-2.5 text-sm font-bold text-white shadow-[0_2px_10px_-2px_var(--accent-soft)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_6px_18px_-4px_var(--accent-soft)] active:translate-y-0"
            onClick={() => setShowNew(true)}
          >
            <Plus width={16} height={16} />
            Nueva tarea
          </button>
        </header>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <MiniStat icon={<ClipboardList width={18} height={18} />} value={pendientesCount} label="Pendientes" featured />
          <MiniStat icon={<Check width={18} height={18} />} value={completadasCount} label="Completadas" />
          <div className={CARD + ' flex items-center gap-3 p-4'}>
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-danger/10 text-danger shadow-sm">
              <AlertTriangle width={18} height={18} />
            </span>
            <div>
              <div className="text-2xl font-black leading-none tabular-nums text-ink">{vencidasCount}</div>
              <div className="mt-1 text-xs font-medium text-ink-muted">Vencidas</div>
            </div>
          </div>
        </div>

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
          <div className="rounded-2xl border border-dashed border-border bg-surface-2/40 px-6 py-12 text-center">
            <p className="text-base font-bold text-ink">{tab === 'pendiente' ? 'Sin pendientes' : 'Sin completadas'}</p>
            <p className="mt-1 text-sm text-ink-muted">
              {tab === 'pendiente' ? 'No tienes tareas asignadas por hacer.' : 'Aún no marcas ninguna tarea como completada.'}
            </p>
          </div>
        )}

        <div className="flex flex-col gap-3">
          {!loading &&
            !error &&
            visibles.map((t) => (
              <article key={t.id} className={CARD + ' flex gap-4 p-4'}>
                <div
                  className={
                    'flex min-w-[76px] shrink-0 flex-col items-center justify-center gap-0.5 rounded-xl px-3 py-2 text-white shadow-sm ' +
                    (t.estado === 'pendiente' && isVencida(t) ? 'bg-danger/90' : 'bg-accent-gradient')
                  }
                >
                  {t.estado === 'completada' ? (
                    <>
                      <Check width={20} height={20} />
                      {t.completed_at && (
                        <span className="text-[10.5px] font-semibold opacity-80">
                          {formatShort(t.completed_at.slice(0, 10))}
                        </span>
                      )}
                    </>
                  ) : t.fecha_limite ? (
                    <>
                      <span className="text-base font-black leading-none tabular-nums">
                        {formatShort(t.fecha_limite)}
                      </span>
                      <span className="text-[10.5px] font-semibold opacity-80">
                        {isVencida(t) ? 'Vencida' : 'Vence'}
                      </span>
                    </>
                  ) : (
                    <ClipboardList width={20} height={20} />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-bold text-ink">{t.paciente_nombre}</div>
                  <div className="text-xs text-ink-muted">{t.titulo}</div>
                  {t.descripcion && <p className="mt-1 text-xs text-ink-soft line-clamp-2">{t.descripcion}</p>}
                  <div className="mt-2.5 flex flex-wrap gap-1.5">
                    <span className={chipBase}>{tipoLabel(t.tipo)}</span>
                    {t.estado === 'pendiente' && (
                      <button
                        type="button"
                        className={chipBtn + ' ' + chipOn}
                        onClick={() => patch(t.id, { estado: 'completada' })}
                      >
                        <Check width={12} height={12} />
                        Marcar completada
                      </button>
                    )}
                    {t.estado === 'completada' && (
                      <button type="button" className={chipBtn} onClick={() => patch(t.id, { estado: 'pendiente' })}>
                        Reabrir
                      </button>
                    )}
                    <button type="button" className={chipBtn + ' ' + chipDanger} onClick={() => handleCancel(t)}>
                      Cancelar
                    </button>
                  </div>
                </div>
              </article>
            ))}
        </div>
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
