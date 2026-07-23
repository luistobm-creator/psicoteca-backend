import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Library, MessageCircle, Trash } from '../components/icons.jsx';
import { timeAgo } from '../lib/fileType.js';
import { useAuth } from '../context/AuthContext.jsx';
import * as api from '../api.js';

const CARD =
  'group relative overflow-hidden rounded-2xl border border-border bg-surface shadow-sm ' +
  'transition-all duration-300 hover:-translate-y-1 hover:border-accent/30 hover:shadow-lift dark:hover:shadow-lift-dark';

const CATEGORIAS = [
  { value: 'idea', label: 'Idea' },
  { value: 'error', label: 'Error' },
  { value: 'otro', label: 'Otro' },
];

const CHIP_TONE = {
  idea: 'bg-[var(--serene-weak)] text-[var(--serene)]',
  error: 'bg-danger/10 text-danger',
  otro: 'bg-surface-3 text-ink-muted',
};

// Buzón de sugerencias: bandeja de salida propia. El usuario escribe y ve lo
// que ha enviado (sin estado de "revisado" — no existe un panel de soporte
// del otro lado que lo actualice, así que mostrar uno sería inventar un
// seguimiento que no ocurre de verdad).
export default function SugerenciasBuzon() {
  const { isAuthenticated, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!authLoading && !isAuthenticated) navigate('/login', { replace: true });
  }, [authLoading, isAuthenticated, navigate]);

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [categoria, setCategoria] = useState('idea');
  const [mensaje, setMensaje] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState(null);

  const load = () => {
    setLoading(true);
    api
      .getSugerencias()
      .then((data) => {
        setItems(data);
        setError(null);
      })
      .catch((err) => setError(err.message || 'No se pudieron cargar tus sugerencias.'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (isAuthenticated) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const texto = mensaje.trim();
    if (!texto || sending) return;
    setSending(true);
    setSendError(null);
    try {
      const created = await api.createSugerencia({ categoria, mensaje: texto });
      setItems((cur) => [created, ...cur]);
      setMensaje('');
    } catch (err) {
      setSendError(err.message || 'No se pudo enviar la sugerencia.');
    } finally {
      setSending(false);
    }
  };

  const handleDelete = async (id) => {
    const prev = items;
    setItems((cur) => cur.filter((i) => i.id !== id));
    try {
      await api.deleteSugerencia(id);
    } catch {
      setItems(prev);
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
            <h1 className="settings__title">Buzón de sugerencias</h1>
            <p className="settings__subtitle">Cuéntanos qué falta, qué mejorarías o si encontraste un error.</p>
          </div>
        </header>

        <form onSubmit={handleSubmit} className={CARD + ' flex flex-col gap-3 p-5'}>
          <div className="agenda__modetoggle">
            {CATEGORIAS.map((c) => (
              <button
                key={c.value}
                type="button"
                className={categoria === c.value ? 'is-active' : ''}
                onClick={() => setCategoria(c.value)}
              >
                {c.label}
              </button>
            ))}
          </div>
          <div className="modal__field">
            <textarea
              className="modal__textarea"
              value={mensaje}
              onChange={(e) => setMensaje(e.target.value)}
              rows={4}
              maxLength={2000}
              placeholder="Escribe tu sugerencia, idea o el error que encontraste…"
            />
          </div>
          {sendError && <div className="modal__error">{sendError}</div>}
          <div>
            <button
              type="submit"
              className="inline-flex items-center gap-2 rounded-xl bg-accent-gradient px-4 py-2.5 text-sm font-bold text-white shadow-[0_2px_10px_-2px_var(--accent-soft)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_6px_18px_-4px_var(--accent-soft)] active:translate-y-0 disabled:opacity-60 disabled:hover:translate-y-0"
              disabled={!mensaje.trim() || sending}
            >
              {sending ? 'Enviando…' : 'Enviar sugerencia'}
            </button>
          </div>
        </form>

        <h2 className="flex items-center gap-2 text-lg font-bold text-ink">
          <MessageCircle width={17} height={17} className="text-accent" />
          Tus sugerencias enviadas
        </h2>

        {loading && <p className="settings__muted">Cargando…</p>}
        {!loading && error && <p className="settings__error">{error}</p>}
        {!loading && !error && items.length === 0 && (
          <p className="settings__muted">Aún no has enviado ninguna sugerencia.</p>
        )}

        {!loading && !error && items.length > 0 && (
          <div className="flex flex-col gap-3">
            {items.map((it) => {
              const cat = CATEGORIAS.find((c) => c.value === it.categoria) || CATEGORIAS[2];
              return (
                <div key={it.id} className={CARD + ' flex flex-col gap-2.5 p-4'}>
                  <div className="flex items-center gap-2.5">
                    <span
                      className={
                        'shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold ' +
                        (CHIP_TONE[it.categoria] || CHIP_TONE.otro)
                      }
                    >
                      {cat.label}
                    </span>
                    <span className="flex-1 text-xs text-ink-muted">{timeAgo(new Date(it.created_at))}</span>
                    <button
                      type="button"
                      onClick={() => handleDelete(it.id)}
                      aria-label="Retirar sugerencia"
                      title="Retirar sugerencia"
                      className="shrink-0 rounded-lg p-1.5 text-ink-soft transition-colors duration-150 hover:bg-danger/10 hover:text-danger"
                    >
                      <Trash width={14} height={14} />
                    </button>
                  </div>
                  <p className="sugerencia__msg">{it.mensaje}</p>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
