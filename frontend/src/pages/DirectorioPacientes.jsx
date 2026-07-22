import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Library, Plus, Search, X } from '../components/icons.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import * as api from '../api.js';

function initialsFrom(name) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  const chars = parts.slice(0, 2).map((p) => p[0]).join('');
  return (chars || '?').toUpperCase();
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
            <h1 className="settings__title">Directorio de pacientes</h1>
            <p className="settings__subtitle">{pacientes.length} pacientes activos</p>
          </div>
          <button type="button" className="glosario__addbtn" onClick={() => setShowNew(true)}>
            <Plus width={16} height={16} />
            Nuevo paciente
          </button>
        </header>

        <div className="glosario__toolbar">
          <div className="glosario__search">
            <Search width={16} height={16} />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar por nombre o motivo…"
              aria-label="Buscar pacientes"
            />
          </div>
        </div>

        {loading && <p className="settings__muted">Cargando…</p>}
        {!loading && error && <p className="settings__error">{error}</p>}
        {!loading && !error && pacientes.length === 0 && (
          <p className="settings__muted">
            {query ? 'Sin pacientes. Prueba con otro nombre o motivo.' : 'Todavía no tienes pacientes. Agrega el primero.'}
          </p>
        )}

        {!loading && !error && pacientes.length > 0 && (
          <div className="pacientes__list">
            {pacientes.map((p) => (
              <button key={p.id} type="button" className="pacientes__row" onClick={() => setEditing(p)}>
                <span className="pacientes__avatar">{initialsFrom(p.nombre)}</span>
                <span className="pacientes__info">
                  <span className="pacientes__name">{p.nombre}</span>
                  <span className="settings__muted">
                    {[p.motivo, `${p.citas_count} ${p.citas_count === 1 ? 'sesión' : 'sesiones'}`]
                      .filter(Boolean)
                      .join(' · ')}
                  </span>
                </span>
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
