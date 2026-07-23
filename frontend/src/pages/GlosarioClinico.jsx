import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Brain, Layers, Library, Plus, Search, Sparkles, Trash, X } from '../components/icons.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useCountUp } from '../lib/useCountUp.js';
import { dailyCounts } from '../lib/stats.js';
import * as api from '../api.js';

const CARD =
  'group relative overflow-hidden rounded-2xl border border-border bg-surface shadow-sm ' +
  'transition-all duration-300 hover:-translate-y-1 hover:border-accent/30 hover:shadow-lift dark:hover:shadow-lift-dark';

function MiniStat({ icon, value, label }) {
  const animated = useCountUp(typeof value === 'number' ? value : 0);
  return (
    <div className={CARD + ' flex items-center gap-3 p-4'}>
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

  // Mini-stats derivadas del glosario ya cargado (sin llamadas nuevas).
  const categoriasCount = useMemo(
    () => new Set(terms.map((t) => t.categoria).filter(Boolean)).size,
    [terms]
  );
  const nuevosEstaSemana = useMemo(() => dailyCounts(terms).reduce((a, b) => a + b, 0), [terms]);

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
            <h1 className="settings__title">Glosario clínico</h1>
            <p className="settings__subtitle">Tus propios términos, definiciones y notas.</p>
          </div>
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-xl bg-accent-gradient px-4 py-2.5 text-sm font-bold text-white shadow-[0_2px_10px_-2px_var(--accent-soft)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_6px_18px_-4px_var(--accent-soft)] active:translate-y-0"
            onClick={() => setModalOpen(true)}
          >
            <Plus width={16} height={16} />
            Agregar término
          </button>
        </header>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <MiniStat icon={<Brain width={18} height={18} />} value={terms.length} label="Términos guardados" />
          <MiniStat icon={<Layers width={18} height={18} />} value={categoriasCount} label="Categorías distintas" />
          <MiniStat icon={<Sparkles width={18} height={18} />} value={nuevosEstaSemana} label="Nuevos esta semana" />
        </div>

        <div className="flex items-center gap-2 rounded-xl border border-border-strong bg-bg px-3 transition-colors duration-150 focus-within:border-accent focus-within:shadow-[0_0_0_3px_var(--accent-weak)]">
          <Search width={16} height={16} className="shrink-0 text-ink-muted" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar término, definición o categoría…"
            aria-label="Buscar en el glosario"
            className="h-11 w-full border-none bg-transparent text-sm text-ink outline-none placeholder:text-ink-soft"
          />
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
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((t) => (
              <article key={t.id} className={CARD + ' flex flex-col gap-2.5 p-4'}>
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-bold leading-snug text-ink">{t.termino}</h3>
                  <button
                    type="button"
                    onClick={() => handleDelete(t.id)}
                    aria-label={`Borrar ${t.termino}`}
                    title="Borrar término"
                    className="shrink-0 rounded-lg p-1.5 text-ink-soft transition-colors duration-150 hover:bg-danger/10 hover:text-danger"
                  >
                    <Trash width={14} height={14} />
                  </button>
                </div>
                {t.categoria && (
                  <span className="inline-flex w-fit items-center gap-1 rounded-full bg-accent-weak px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-accent">
                    {t.categoria}
                  </span>
                )}
                <p className="whitespace-pre-line text-[13.5px] leading-relaxed text-ink-muted">{t.definicion}</p>
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
