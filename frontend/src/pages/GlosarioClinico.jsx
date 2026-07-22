import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Library, Plus, Search, Trash, X } from '../components/icons.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import * as api from '../api.js';

// Glosario clínico personal: cada usuario agrega, busca y lee sus propios
// términos (Supabase, tabla `glosario_clinico`, ver script_glosario_supabase.sql
// y backend/app/routers/glosario.py). Misma página protegida que Settings.jsx/
// Perfil.jsx (redirige a /login sin sesión).
export default function GlosarioClinico() {
  const { isAuthenticated, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!authLoading && !isAuthenticated) navigate('/login', { replace: true });
  }, [authLoading, isAuthenticated, navigate]);

  const [terms, setTerms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [query, setQuery] = useState('');
  const [modalOpen, setModalOpen] = useState(false);

  const load = () => {
    setLoading(true);
    api
      .getGlosario()
      .then((data) => {
        setTerms(data);
        setError(null);
      })
      .catch((err) => setError(err.message || 'No se pudo cargar el glosario.'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (isAuthenticated) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return terms;
    return terms.filter(
      (t) =>
        t.termino.toLowerCase().includes(q) ||
        t.definicion.toLowerCase().includes(q) ||
        (t.categoria || '').toLowerCase().includes(q)
    );
  }, [terms, query]);

  const handleDelete = async (id) => {
    const prev = terms;
    setTerms((cur) => cur.filter((t) => t.id !== id));
    try {
      await api.deleteGlosarioTermino(id);
    } catch {
      setTerms(prev);
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
          <h1 className="settings__title">Glosario clínico</h1>
          <p className="settings__subtitle">Tus propios términos, definiciones y notas.</p>
        </header>

        <div className="glosario__toolbar">
          <div className="glosario__search">
            <Search width={16} height={16} />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar término, definición o categoría…"
              aria-label="Buscar en el glosario"
            />
          </div>
          <button type="button" className="glosario__addbtn" onClick={() => setModalOpen(true)}>
            <Plus width={16} height={16} />
            Agregar término
          </button>
        </div>

        {loading && <p className="settings__muted">Cargando…</p>}
        {!loading && error && <p className="settings__error">{error}</p>}
        {!loading && !error && filtered.length === 0 && (
          <p className="settings__muted">
            {terms.length === 0
              ? 'Todavía no tienes términos. Agrega el primero.'
              : 'Sin resultados para tu búsqueda.'}
          </p>
        )}

        {!loading && !error && filtered.length > 0 && (
          <div className="glosario__grid">
            {filtered.map((t) => (
              <article key={t.id} className="glosario__card">
                <div className="glosario__cardhead">
                  <h3 className="glosario__termino">{t.termino}</h3>
                  <button
                    type="button"
                    className="glosario__delete"
                    onClick={() => handleDelete(t.id)}
                    aria-label={`Borrar ${t.termino}`}
                    title="Borrar término"
                  >
                    <Trash width={15} height={15} />
                  </button>
                </div>
                {t.categoria && <span className="glosario__chip">{t.categoria}</span>}
                <p className="glosario__definicion">{t.definicion}</p>
              </article>
            ))}
          </div>
        )}
      </div>

      {modalOpen && (
        <NewTermModal
          onClose={() => setModalOpen(false)}
          onCreated={(term) => {
            setTerms((cur) => [...cur, term].sort((a, b) => a.termino.localeCompare(b.termino)));
            setModalOpen(false);
          }}
        />
      )}
    </div>
  );
}

function NewTermModal({ onClose, onCreated }) {
  const [termino, setTermino] = useState('');
  const [definicion, setDefinicion] = useState('');
  const [categoria, setCategoria] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const canSave = termino.trim().length > 0 && definicion.trim().length > 0 && !saving;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!canSave) return;
    setSaving(true);
    setError(null);
    try {
      const created = await api.createGlosarioTermino({
        termino: termino.trim(),
        definicion: definicion.trim(),
        categoria: categoria.trim() || null,
      });
      onCreated(created);
    } catch (err) {
      setError(err.message || 'No se pudo guardar el término.');
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose} role="presentation">
      <div
        className="modal modal--form"
        role="dialog"
        aria-modal="true"
        aria-labelledby="new-term-title"
        onClick={(e) => e.stopPropagation()}
      >
        <button type="button" className="modal__close" onClick={onClose} aria-label="Cerrar">
          <X width={18} height={18} />
        </button>
        <h2 id="new-term-title" className="modal__title">
          Agregar término
        </h2>

        <form onSubmit={handleSubmit}>
          <div className="modal__field">
            <label className="settings__label" htmlFor="term-name">
              Término
            </label>
            <input
              id="term-name"
              className="settings__input"
              value={termino}
              onChange={(e) => setTermino(e.target.value)}
              placeholder="p. ej. Disonancia cognitiva"
              autoFocus
            />
          </div>

          <div className="modal__field">
            <label className="settings__label" htmlFor="term-def">
              Definición
            </label>
            <textarea
              id="term-def"
              className="modal__textarea"
              value={definicion}
              onChange={(e) => setDefinicion(e.target.value)}
              placeholder="Escribe la definición o tus notas…"
              rows={4}
            />
          </div>

          <div className="modal__field">
            <label className="settings__label" htmlFor="term-cat">
              Categoría <span className="settings__muted">(opcional)</span>
            </label>
            <input
              id="term-cat"
              className="settings__input"
              value={categoria}
              onChange={(e) => setCategoria(e.target.value)}
              placeholder="p. ej. Psicología social"
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
