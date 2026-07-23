import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Check, Library, Plus, Trash, X } from '../components/icons.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import * as api from '../api.js';

const CARD =
  'group relative overflow-hidden rounded-2xl border border-border bg-surface shadow-sm ' +
  'transition-all duration-300 hover:-translate-y-1 hover:border-accent/30 hover:shadow-lift dark:hover:shadow-lift-dark';

// Plantillas de formato: textos reutilizables (estructuras de nota de
// sesión, formatos de informe) que el propio usuario redacta. CRUD simple,
// con botón de copiar al portapapeles para usarlas donde haga falta.
export default function PlantillasFormato() {
  const { isAuthenticated, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!authLoading && !isAuthenticated) navigate('/login', { replace: true });
  }, [authLoading, isAuthenticated, navigate]);

  const [plantillas, setPlantillas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showNew, setShowNew] = useState(false);
  const [editing, setEditing] = useState(null);
  const [copiedId, setCopiedId] = useState(null);

  const load = () => {
    setLoading(true);
    api
      .getPlantillas()
      .then((data) => {
        setPlantillas(data);
        setError(null);
      })
      .catch((err) => setError(err.message || 'No se pudieron cargar las plantillas.'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (isAuthenticated) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated]);

  const handleDelete = async (id) => {
    if (!window.confirm('¿Borrar esta plantilla?')) return;
    const prev = plantillas;
    setPlantillas((cur) => cur.filter((p) => p.id !== id));
    try {
      await api.deletePlantilla(id);
    } catch {
      setPlantillas(prev);
    }
  };

  const handleCopiar = async (p) => {
    try {
      await navigator.clipboard.writeText(p.contenido);
      setCopiedId(p.id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      /* sin permiso de portapapeles */
    }
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

        <header className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="settings__title">Plantillas de formato</h1>
            <p className="settings__subtitle">Textos reutilizables para tus notas e informes.</p>
          </div>
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-xl bg-accent-gradient px-4 py-2.5 text-sm font-bold text-white shadow-[0_2px_10px_-2px_var(--accent-soft)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_6px_18px_-4px_var(--accent-soft)] active:translate-y-0"
            onClick={() => setShowNew(true)}
          >
            <Plus width={16} height={16} />
            Nueva plantilla
          </button>
        </header>

        {loading && <p className="settings__muted">Cargando…</p>}
        {!loading && error && <p className="settings__error">{error}</p>}
        {!loading && !error && plantillas.length === 0 && (
          <p className="settings__muted">Todavía no tienes plantillas. Agrega la primera.</p>
        )}

        {!loading && !error && plantillas.length > 0 && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {plantillas.map((p) => (
              <article key={p.id} className={CARD + ' flex flex-col gap-3 p-4'}>
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-bold leading-snug text-ink">{p.nombre}</h3>
                  <button
                    type="button"
                    onClick={() => handleDelete(p.id)}
                    aria-label={`Borrar ${p.nombre}`}
                    title="Borrar plantilla"
                    className="shrink-0 rounded-lg p-1.5 text-ink-soft transition-colors duration-150 hover:bg-danger/10 hover:text-danger"
                  >
                    <Trash width={14} height={14} />
                  </button>
                </div>
                <p className="line-clamp-4 whitespace-pre-line text-[13.5px] leading-relaxed text-ink-muted">
                  {p.contenido}
                </p>
                <div className="mt-auto flex gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setEditing(p)}
                    className="flex-1 rounded-lg border border-border px-3 py-2 text-xs font-semibold text-ink-muted transition-colors duration-150 hover:border-accent/40 hover:text-accent"
                  >
                    Editar
                  </button>
                  <button
                    type="button"
                    onClick={() => handleCopiar(p)}
                    className="flex-1 rounded-lg bg-accent-gradient px-3 py-2 text-xs font-bold text-white shadow-sm transition-transform duration-200 hover:-translate-y-0.5"
                  >
                    {copiedId === p.id ? (
                      <span className="inline-flex items-center justify-center gap-1">
                        <Check width={13} height={13} /> Copiado
                      </span>
                    ) : (
                      'Copiar'
                    )}
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>

      {showNew && (
        <PlantillaModal
          onClose={() => setShowNew(false)}
          onSaved={(p) => {
            setPlantillas((cur) => [...cur, p].sort((a, b) => a.nombre.localeCompare(b.nombre)));
            setShowNew(false);
          }}
        />
      )}

      {editing && (
        <PlantillaModal
          plantilla={editing}
          onClose={() => setEditing(null)}
          onSaved={(p) => {
            setPlantillas((cur) => cur.map((x) => (x.id === p.id ? p : x)));
            setEditing(null);
          }}
        />
      )}
    </div>
  );
}

function PlantillaModal({ plantilla, onClose, onSaved }) {
  const isEdit = !!plantilla;
  const [nombre, setNombre] = useState(plantilla?.nombre || '');
  const [contenido, setContenido] = useState(plantilla?.contenido || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const canSave = nombre.trim().length > 0 && contenido.trim().length > 0 && !saving;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!canSave) return;
    setSaving(true);
    setError(null);
    try {
      const payload = { nombre: nombre.trim(), contenido: contenido.trim() };
      const saved = isEdit ? await api.updatePlantilla(plantilla.id, payload) : await api.createPlantilla(payload);
      onSaved(saved);
    } catch (err) {
      setError(err.message || 'No se pudo guardar la plantilla.');
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose} role="presentation">
      <div className="modal modal--form" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="modal__close" onClick={onClose} aria-label="Cerrar">
          <X width={18} height={18} />
        </button>
        <h2 className="modal__title">{isEdit ? 'Editar plantilla' : 'Nueva plantilla'}</h2>

        <form onSubmit={handleSubmit}>
          <div className="modal__field">
            <label className="settings__label">Nombre</label>
            <input
              className="settings__input"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="p. ej. Nota de seguimiento"
              autoFocus
            />
          </div>

          <div className="modal__field">
            <label className="settings__label">Contenido</label>
            <textarea
              className="modal__textarea"
              value={contenido}
              onChange={(e) => setContenido(e.target.value)}
              rows={8}
              placeholder="Escribe el texto de la plantilla…"
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
      </div>
    </div>
  );
}
