import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Library, Trash } from '../components/icons.jsx';
import { timeAgo } from '../lib/fileType.js';
import { useAuth } from '../context/AuthContext.jsx';
import * as api from '../api.js';

const CATEGORIAS = [
  { value: 'idea', label: 'Idea' },
  { value: 'error', label: 'Error' },
  { value: 'otro', label: 'Otro' },
];

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

        <form onSubmit={handleSubmit} className="sugerencia__compose">
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
          <div className="modal__actions" style={{ justifyContent: 'flex-start' }}>
            <button type="submit" className="settings__btn settings__btn--accent" disabled={!mensaje.trim() || sending}>
              {sending ? 'Enviando…' : 'Enviar sugerencia'}
            </button>
          </div>
        </form>

        <h2 className="dash-section__title" style={{ marginTop: 28, marginBottom: 12 }}>
          Tus sugerencias enviadas
        </h2>

        {loading && <p className="settings__muted">Cargando…</p>}
        {!loading && error && <p className="settings__error">{error}</p>}
        {!loading && !error && items.length === 0 && (
          <p className="settings__muted">Aún no has enviado ninguna sugerencia.</p>
        )}

        {!loading && !error && items.length > 0 && (
          <div className="sugerencia__list">
            {items.map((it) => {
              const cat = CATEGORIAS.find((c) => c.value === it.categoria) || CATEGORIAS[2];
              return (
                <div key={it.id} className="sugerencia__item">
                  <div className="sugerencia__itemhead">
                    <span className={`sugerencia__chip sugerencia__chip--${it.categoria}`}>{cat.label}</span>
                    <span className="settings__muted">{timeAgo(new Date(it.created_at))}</span>
                    <button
                      type="button"
                      className="glosario__delete"
                      onClick={() => handleDelete(it.id)}
                      aria-label="Retirar sugerencia"
                      title="Retirar sugerencia"
                    >
                      <Trash width={15} height={15} />
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
