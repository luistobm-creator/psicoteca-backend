import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Check, Library, Plus, Trash, X } from '../components/icons.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import * as api from '../api.js';

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

        <header className="settings__head">
          <div>
            <h1 className="settings__title">Plantillas de formato</h1>
            <p className="settings__subtitle">Textos reutilizables para tus notas e informes.</p>
          </div>
          <button type="button" className="glosario__addbtn" onClick={() => setShowNew(true)}>
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
          <div className="glosario__grid">
            {plantillas.map((p) => (
              <article key={p.id} className="glosario__card">
                <div className="glosario__cardhead">
                  <h3 className="glosario__termino">{p.nombre}</h3>
                  <button
                    type="button"
                    className="glosario__delete"
                    onClick={() => handleDelete(p.id)}
                    aria-label={`Borrar ${p.nombre}`}
                    title="Borrar plantilla"
                  >
                    <Trash width={15} height={15} />
                  </button>
                </div>
                <p className="glosario__definicion" style={{ maxHeight: 96, overflow: 'hidden' }}>
                  {p.contenido}
                </p>
                <div className="modal__actions" style={{ marginTop: 4 }}>
                  <button type="button" className="settings__btn" onClick={() => setEditing(p)}>
                    Editar
                  </button>
                  <button type="button" className="settings__btn settings__btn--accent" onClick={() => handleCopiar(p)}>
                    {copiedId === p.id ? (
                      <>
                        <Check width={14} height={14} /> Copiado
                      </>
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
