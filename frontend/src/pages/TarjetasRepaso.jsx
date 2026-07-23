import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Library } from '../components/icons.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import * as api from '../api.js';

const TODAS = ''; // valor de categoriaSel para "todas las categorías"

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Tarjetas de repaso: estudio rápido y efímero (sin registro de resultados,
// a diferencia de Modo examen) de los términos del Glosario clínico. Sin
// backend propio: reutiliza getGlosario() y filtra/baraja en el cliente.
export default function TarjetasRepaso() {
  const { isAuthenticated, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!authLoading && !isAuthenticated) navigate('/login', { replace: true });
  }, [authLoading, isAuthenticated, navigate]);

  const [terminos, setTerminos] = useState([]);
  const [terminosLoading, setTerminosLoading] = useState(true);
  const [terminosError, setTerminosError] = useState(null);

  useEffect(() => {
    if (!isAuthenticated) return;
    api
      .getGlosario()
      .then((data) => {
        setTerminos(data);
        setTerminosError(null);
      })
      .catch((err) => setTerminosError(err.message || 'No se pudo cargar el glosario.'))
      .finally(() => setTerminosLoading(false));
  }, [isAuthenticated]);

  const categorias = useMemo(
    () => [...new Set(terminos.map((t) => t.categoria).filter(Boolean))].sort(),
    [terminos]
  );

  const [categoriaSel, setCategoriaSel] = useState(TODAS);
  const pool = useMemo(
    () => (categoriaSel ? terminos.filter((t) => t.categoria === categoriaSel) : terminos),
    [terminos, categoriaSel]
  );

  const [queue, setQueue] = useState([]);
  const [totalSesion, setTotalSesion] = useState(0);
  const [knownCount, setKnownCount] = useState(0);
  const [flipped, setFlipped] = useState(false);

  const iniciarSesion = () => {
    setQueue(shuffle(pool));
    setTotalSesion(pool.length);
    setKnownCount(0);
    setFlipped(false);
  };

  // Nueva baraja cada vez que cambia el pool (categoría distinta o datos recién cargados).
  useEffect(() => {
    setQueue(shuffle(pool));
    setTotalSesion(pool.length);
    setKnownCount(0);
    setFlipped(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pool]);

  const marcarRepasar = () => {
    setQueue((cur) => (cur.length > 0 ? [...cur.slice(1), cur[0]] : cur));
    setFlipped(false);
  };

  const marcarLoSe = () => {
    setQueue((cur) => cur.slice(1));
    setKnownCount((c) => c + 1);
    setFlipped(false);
  };

  // Atajos de teclado: Espacio voltea; con la tarjeta volteada, 1/← repasa
  // de nuevo y 2/→/Enter marca "lo sé". Se ignoran si el foco está en el
  // selector de categoría (para no interferir con su propia navegación).
  useEffect(() => {
    const onKey = (e) => {
      const tag = document.activeElement?.tagName;
      if (tag === 'SELECT' || tag === 'INPUT' || tag === 'TEXTAREA') return;
      if (queue.length === 0) return;
      if (e.code === 'Space') {
        e.preventDefault();
        setFlipped((f) => !f);
      } else if (flipped && (e.key === '1' || e.key === 'ArrowLeft')) {
        marcarRepasar();
      } else if (flipped && (e.key === '2' || e.key === 'ArrowRight' || e.key === 'Enter')) {
        marcarLoSe();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flipped, queue.length]);

  if (authLoading || !isAuthenticated) return null;

  const actual = queue[0];
  const progresoPct = totalSesion > 0 ? Math.round((knownCount / totalSesion) * 100) : 0;

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
            <h1 className="settings__title">Tarjetas de repaso</h1>
            <p className="settings__subtitle">Voltea, repasa y domina los términos de tu Glosario clínico.</p>
          </div>
        </header>

        {terminosLoading && <p className="settings__muted">Cargando tu glosario…</p>}
        {!terminosLoading && terminosError && <p className="settings__error">{terminosError}</p>}

        {!terminosLoading && !terminosError && terminos.length === 0 && (
          <p className="settings__muted">
            Tu <Link to="/app/glosario">Glosario clínico</Link> está vacío — agrega algunos términos para poder
            repasar.
          </p>
        )}

        {!terminosLoading && !terminosError && terminos.length > 0 && (
          <>
            <div className="flex max-w-[380px] flex-col gap-1.5">
              <label className="settings__label">Categoría</label>
              <select className="settings__input" value={categoriaSel} onChange={(e) => setCategoriaSel(e.target.value)}>
                <option value={TODAS}>Todas ({terminos.length} términos)</option>
                {categorias.map((c) => (
                  <option key={c} value={c}>
                    {c} ({terminos.filter((t) => t.categoria === c).length})
                  </option>
                ))}
              </select>
            </div>

            {pool.length === 0 && (
              <p className="settings__muted">Esta categoría no tiene términos todavía.</p>
            )}

            {pool.length > 0 && actual && (
              <>
                <div className="flex flex-col gap-2 text-sm text-ink-muted">
                  <span>
                    {knownCount} de {totalSesion} dominadas · quedan {queue.length}
                  </span>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-2">
                    <div
                      className="h-full rounded-full bg-accent-gradient transition-all duration-300"
                      style={{ width: `${progresoPct}%` }}
                    />
                  </div>
                </div>

                <div className="flashcard" onClick={() => setFlipped((f) => !f)} role="button" tabIndex={0}>
                  <div className={'flashcard__inner' + (flipped ? ' is-flipped' : '')}>
                    <div className="flashcard__face flashcard__face--front">
                      <span className="flashcard__hint">Término</span>
                      <h2 className="flashcard__termino">{actual.termino}</h2>
                    </div>
                    <div className="flashcard__face flashcard__face--back">
                      {actual.categoria && <span className="glosario__chip">{actual.categoria}</span>}
                      <p className="flashcard__definicion">{actual.definicion}</p>
                    </div>
                  </div>
                </div>

                {!flipped ? (
                  <p className="text-center text-xs text-ink-soft">Toca la tarjeta (o Espacio) para ver la definición.</p>
                ) : (
                  <div className="flex justify-center gap-3">
                    <button
                      type="button"
                      onClick={marcarRepasar}
                      className="rounded-xl border border-border px-5 py-2.5 text-sm font-semibold text-ink-muted transition-colors duration-150 hover:border-accent/40 hover:text-accent"
                    >
                      Repasar de nuevo
                    </button>
                    <button
                      type="button"
                      onClick={marcarLoSe}
                      className="rounded-xl bg-accent-gradient px-5 py-2.5 text-sm font-bold text-white shadow-[0_2px_10px_-2px_var(--accent-soft)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_6px_18px_-4px_var(--accent-soft)] active:translate-y-0"
                    >
                      Lo sé
                    </button>
                  </div>
                )}
                {flipped && (
                  <p className="text-center text-xs text-ink-soft">Atajos: 1/← repasar · 2/→/Enter lo sé</p>
                )}
              </>
            )}

            {pool.length > 0 && !actual && (
              <div className="flex flex-col items-center gap-2 rounded-2xl border border-border bg-surface px-6 py-10 text-center shadow-sm">
                <p className="text-xl font-black text-ink">¡Repaso completo!</p>
                <p className="text-sm text-ink-muted">Dominaste las {totalSesion} tarjetas de esta sesión.</p>
                <button
                  type="button"
                  onClick={iniciarSesion}
                  className="mt-2 rounded-xl bg-accent-gradient px-5 py-2.5 text-sm font-bold text-white shadow-[0_2px_10px_-2px_var(--accent-soft)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_6px_18px_-4px_var(--accent-soft)] active:translate-y-0"
                >
                  Repasar de nuevo
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
