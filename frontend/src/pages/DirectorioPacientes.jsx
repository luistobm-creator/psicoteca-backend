import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Calendar, Library, Plus, Search, UserPlus, Users, X } from '../components/icons.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useCountUp } from '../lib/useCountUp.js';
import * as api from '../api.js';

const CARD =
  'group relative overflow-hidden rounded-2xl border border-border bg-surface shadow-sm ' +
  'transition-all duration-300 hover:-translate-y-1 hover:border-accent/30 hover:shadow-lift dark:hover:shadow-lift-dark';

function initialsFrom(name) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  const chars = parts.slice(0, 2).map((p) => p[0]).join('');
  return (chars || '?').toUpperCase();
}

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

// Directorio de pacientes: crear, buscar, editar y archivar (soft-delete,
// igual criterio que las citas canceladas). El "Expediente del paciente"
// (notas de sesión, documentos) es otra herramienta, sigue "Próximamente".
// Misma página protegida que Perfil/Glosario/Agenda.
export default function DirectorioPacientes() {
  const { isAuthenticated, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!authLoading && !isAuthenticated) navigate('/login', { replace: true });
  }, [authLoading, isAuthenticated, navigate]);

  const [pacientes, setPacientes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [query, setQuery] = useState('');
  const [showNew, setShowNew] = useState(false);
  const [editing, setEditing] = useState(null);

  const load = (q) => {
    setLoading(true);
    api
      .getPacientes(q)
      .then((data) => {
        setPacientes(data);
        setError(null);
      })
      .catch((err) => setError(err.message || 'No se pudo cargar el directorio.'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (isAuthenticated) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated]);

  // Búsqueda en el servidor con un pequeño debounce (evita una petición por tecla).
  useEffect(() => {
    if (!isAuthenticated) return undefined;
    const handle = setTimeout(() => load(query), 300);
    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, isAuthenticated]);

  // Mini-stats derivadas del directorio ya cargado (sin llamadas nuevas).
  const totalSesiones = useMemo(() => pacientes.reduce((sum, p) => sum + (p.citas_count || 0), 0), [pacientes]);
  const nuevosEsteMes = useMemo(() => {
    const now = new Date();
    return pacientes.filter((p) => {
      if (!p.created_at) return false;
      const d = new Date(p.created_at);
      return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
    }).length;
  }, [pacientes]);

  if (authLoading || !isAuthenticated) return null;

  return (
    <div className="settings">
      <div className="settings__panel fade-in max-w-[900px]">
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
            <h1 className="settings__title">Directorio de pacientes</h1>
            <p className="settings__subtitle">Historial y expedientes de tu consultorio.</p>
          </div>
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-xl bg-accent-gradient px-4 py-2.5 text-sm font-bold text-white shadow-[0_2px_10px_-2px_var(--accent-soft)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_6px_18px_-4px_var(--accent-soft)] active:translate-y-0"
            onClick={() => setShowNew(true)}
          >
            <Plus width={16} height={16} />
            Nuevo paciente
          </button>
        </header>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <MiniStat icon={<Users width={18} height={18} />} value={pacientes.length} label="Pacientes activos" />
          <MiniStat icon={<Calendar width={18} height={18} />} value={totalSesiones} label="Sesiones totales" />
          <MiniStat icon={<UserPlus width={18} height={18} />} value={nuevosEsteMes} label="Nuevos este mes" />
        </div>

        <div className="flex items-center gap-2 rounded-xl border border-border-strong bg-bg px-3 transition-colors duration-150 focus-within:border-accent focus-within:shadow-[0_0_0_3px_var(--accent-weak)]">
          <Search width={16} height={16} className="shrink-0 text-ink-muted" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por nombre o motivo…"
            aria-label="Buscar pacientes"
            className="h-11 w-full border-none bg-transparent text-sm text-ink outline-none placeholder:text-ink-soft"
          />
        </div>

        {loading && <p className="settings__muted">Cargando…</p>}
        {!loading && error && <p className="settings__error">{error}</p>}
        {!loading && !error && pacientes.length === 0 && (
          <p className="settings__muted">
            {query ? 'Sin pacientes. Prueba con otro nombre o motivo.' : 'Todavía no tienes pacientes. Agrega el primero.'}
          </p>
        )}

        {!loading && !error && pacientes.length > 0 && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {pacientes.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setEditing(p)}
                className={CARD + ' flex flex-col gap-3 p-4 text-left'}
              >
                <div className="flex items-center gap-3">
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-accent-gradient text-sm font-bold text-white shadow-sm transition-transform duration-300 group-hover:scale-105">
                    {initialsFrom(p.nombre)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-bold text-ink">{p.nombre}</div>
                    {p.edad != null && <div className="text-xs text-ink-muted">{p.edad} años</div>}
                  </div>
                </div>
                {p.motivo && <div className="line-clamp-2 text-xs text-ink-muted">{p.motivo}</div>}
                <div className="mt-auto flex items-center gap-1.5 text-xs font-semibold text-accent">
                  <Calendar width={13} height={13} />
                  {p.citas_count} {p.citas_count === 1 ? 'sesión' : 'sesiones'}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {showNew && (
        <PacienteModal
          onClose={() => setShowNew(false)}
          onSaved={(p) => {
            setPacientes((cur) => [...cur, p].sort((a, b) => a.nombre.localeCompare(b.nombre)));
            setShowNew(false);
          }}
        />
      )}

      {editing && (
        <PacienteModal
          paciente={editing}
          onClose={() => setEditing(null)}
          onSaved={(p) => {
            setPacientes((cur) => cur.map((x) => (x.id === p.id ? p : x)));
            setEditing(null);
          }}
          onArchived={(id) => {
            setPacientes((cur) => cur.filter((x) => x.id !== id));
            setEditing(null);
          }}
        />
      )}
    </div>
  );
}

function PacienteModal({ paciente, onClose, onSaved, onArchived }) {
  const isEdit = !!paciente;
  const [nombre, setNombre] = useState(paciente?.nombre || '');
  const [edad, setEdad] = useState(paciente?.edad ?? '');
  const [telefono, setTelefono] = useState(paciente?.telefono || '');
  const [motivo, setMotivo] = useState(paciente?.motivo || '');
  const [notas, setNotas] = useState(paciente?.notas || '');
  const [saving, setSaving] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [error, setError] = useState(null);

  const canSave = nombre.trim().length > 0 && !saving;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!canSave) return;
    setSaving(true);
    setError(null);
    const payload = {
      nombre: nombre.trim(),
      edad: edad === '' ? null : Number(edad),
      telefono: telefono.trim() || null,
      motivo: motivo.trim() || null,
      notas: notas.trim() || null,
    };
    try {
      const saved = isEdit ? await api.updatePaciente(paciente.id, payload) : await api.createPaciente(payload);
      onSaved(saved);
    } catch (err) {
      setError(err.message || 'No se pudo guardar el paciente.');
      setSaving(false);
    }
  };

  const handleArchive = async () => {
    if (!window.confirm(`¿Archivar a ${paciente.nombre}? Ya no aparecerá en el directorio.`)) return;
    setArchiving(true);
    try {
      await api.updatePaciente(paciente.id, { activo: false });
      onArchived(paciente.id);
    } catch (err) {
      setError(err.message || 'No se pudo archivar.');
      setArchiving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose} role="presentation">
      <div className="modal modal--form" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="modal__close" onClick={onClose} aria-label="Cerrar">
          <X width={18} height={18} />
        </button>
        <h2 className="modal__title">{isEdit ? 'Editar paciente' : 'Nuevo paciente'}</h2>

        <form onSubmit={handleSubmit}>
          <div className="modal__field">
            <label className="settings__label">Nombre completo</label>
            <input
              className="settings__input"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="p. ej. María López"
              autoFocus
            />
          </div>

          <div className="modal__row">
            <div className="modal__field">
              <label className="settings__label">Edad</label>
              <input
                type="number"
                min={0}
                max={130}
                className="settings__input"
                value={edad}
                onChange={(e) => setEdad(e.target.value)}
              />
            </div>
            <div className="modal__field">
              <label className="settings__label">Teléfono</label>
              <input
                className="settings__input"
                value={telefono}
                onChange={(e) => setTelefono(e.target.value)}
                placeholder="opcional"
              />
            </div>
          </div>

          <div className="modal__field">
            <label className="settings__label">Motivo / diagnóstico</label>
            <input
              className="settings__input"
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="p. ej. Ansiedad (opcional)"
            />
          </div>

          <div className="modal__field">
            <label className="settings__label">Notas</label>
            <textarea
              className="modal__textarea"
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
              rows={3}
              placeholder="Notas generales (opcional)"
            />
          </div>

          {error && <div className="modal__error">{error}</div>}

          <div className="modal__actions">
            {isEdit && (
              <button
                type="button"
                className="settings__btn settings__btn--danger"
                onClick={handleArchive}
                disabled={archiving || saving}
                style={{ marginRight: 'auto' }}
              >
                {archiving ? 'Archivando…' : 'Archivar paciente'}
              </button>
            )}
            <button type="button" className="settings__btn" onClick={onClose} disabled={saving || archiving}>
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
