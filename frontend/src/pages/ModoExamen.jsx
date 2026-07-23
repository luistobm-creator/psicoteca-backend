import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Check, Clock, GraduationCap, Library, Star, Trash, TrendingUp, X } from '../components/icons.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useCountUp } from '../lib/useCountUp.js';
import * as api from '../api.js';

const CARD =
  'group relative overflow-hidden rounded-2xl border border-border bg-surface shadow-sm ' +
  'transition-all duration-300 hover:-translate-y-1 hover:border-accent/30 hover:shadow-lift dark:hover:shadow-lift-dark';
const PANEL = 'rounded-2xl border border-border bg-surface shadow-sm p-6';
const PRIMARY_BTN =
  'w-full rounded-xl bg-accent-gradient px-4 py-3 text-sm font-bold text-white shadow-[0_2px_10px_-2px_var(--accent-soft)] ' +
  'transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_6px_18px_-4px_var(--accent-soft)] active:translate-y-0 ' +
  'disabled:opacity-60 disabled:hover:translate-y-0';

function MiniStat({ icon, value, display, label }) {
  const animated = useCountUp(typeof value === 'number' ? value : 0);
  return (
    <div className={CARD + ' flex items-center gap-3 p-4'}>
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-accent-gradient text-white shadow-sm">
        {icon}
      </span>
      <div className="min-w-0">
        <div className="text-2xl font-black leading-none tabular-nums text-ink">
          {display != null ? display : animated}
        </div>
        <div className="mt-1 text-xs font-medium text-ink-muted">{label}</div>
      </div>
    </div>
  );
}

const NUM_PREGUNTAS_OPCIONES = [5, 10, 15, 20];
const TODAS = ''; // valor de categoriaSel para "todas las categorías"

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Genera N preguntas de opción múltiple a partir de un pool de términos del
// Glosario: cada pregunta pide la definición correcta de un término, con 3
// definiciones de otros términos del mismo pool como distractores.
function generarPreguntas(pool, n) {
  const elegidos = shuffle(pool).slice(0, n);
  return elegidos.map((term) => {
    const distractores = shuffle(pool.filter((t) => t.id !== term.id))
      .slice(0, 3)
      .map((t) => t.definicion);
    const opciones = shuffle([term.definicion, ...distractores]);
    return {
      termino: term.termino,
      opciones,
      correcta: opciones.indexOf(term.definicion),
      elegida: null,
    };
  });
}

function formatFecha(iso) {
  return new Date(iso).toLocaleDateString('es', { day: 'numeric', month: 'short', year: 'numeric' });
}
function formatMinSeg(totalSeg) {
  if (totalSeg == null) return null;
  const m = Math.floor(totalSeg / 60);
  const s = totalSeg % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

// Modo examen: exámenes de opción múltiple generados a partir del Glosario
// clínico (sin banco de preguntas propio — se muestrea al vuelo). Máquina de
// estados con 4 pantallas: config -> en_progreso -> resultados, más un
// historial aparte. Misma página protegida que el resto de Perfil/*.
export default function ModoExamen() {
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

  const [modo, setModo] = useState('config'); // 'config' | 'en_progreso' | 'resultados' | 'historial'
  const [categoriaSel, setCategoriaSel] = useState(TODAS);
  const pool = useMemo(
    () => (categoriaSel ? terminos.filter((t) => t.categoria === categoriaSel) : terminos),
    [terminos, categoriaSel]
  );

  const opcionesNum = useMemo(() => {
    const base = NUM_PREGUNTAS_OPCIONES.filter((n) => n <= pool.length);
    return base.length > 0 ? base : pool.length >= 4 ? [pool.length] : [];
  }, [pool]);
  const [numPreguntasSel, setNumPreguntasSel] = useState(NUM_PREGUNTAS_OPCIONES[0]);
  useEffect(() => {
    if (opcionesNum.length > 0 && !opcionesNum.includes(numPreguntasSel)) {
      setNumPreguntasSel(opcionesNum[opcionesNum.length - 1]);
    }
  }, [opcionesNum, numPreguntasSel]);

  const [cronometroActivo, setCronometroActivo] = useState(false);
  const [minutosCronometro, setMinutosCronometro] = useState(10);

  const [preguntas, setPreguntas] = useState([]);
  const [respuestas, setRespuestas] = useState([]);
  const [indiceActual, setIndiceActual] = useState(0);
  const [tiempoLimiteSegundos, setTiempoLimiteSegundos] = useState(null);
  const [tiempoRestante, setTiempoRestante] = useState(null);
  const [resultado, setResultado] = useState(null);
  const [guardadoError, setGuardadoError] = useState(null);

  const startedAtRef = useRef(0);
  const finalizedRef = useRef(false);

  const comenzar = () => {
    const generadas = generarPreguntas(pool, numPreguntasSel);
    setPreguntas(generadas);
    setRespuestas(new Array(generadas.length).fill(null));
    setIndiceActual(0);
    setResultado(null);
    setGuardadoError(null);
    finalizedRef.current = false;
    const limite = cronometroActivo ? minutosCronometro * 60 : null;
    setTiempoLimiteSegundos(limite);
    setTiempoRestante(limite);
    startedAtRef.current = Date.now();
    setModo('en_progreso');
  };

  const finalizarExamen = () => {
    if (finalizedRef.current) return;
    finalizedRef.current = true;
    const tiempoUsado = Math.round((Date.now() - startedAtRef.current) / 1000);
    const conRespuesta = preguntas.map((p, i) => ({ ...p, elegida: respuestas[i] ?? null }));
    const correctas = conRespuesta.filter((p) => p.elegida === p.correcta).length;
    setResultado({ preguntas: conRespuesta, correctas, tiempoUsado });
    setModo('resultados');
    api
      .createExamen({
        categoria: categoriaSel || null,
        num_preguntas: conRespuesta.length,
        respuestas_correctas: correctas,
        tiempo_limite_segundos: tiempoLimiteSegundos,
        tiempo_usado_segundos: tiempoUsado,
        preguntas: conRespuesta,
      })
      .catch((err) => setGuardadoError(err.message || 'No se pudo guardar el resultado.'));
  };

  // Cuenta regresiva: solo decrementa (efecto puro); un efecto aparte reacciona al 0.
  useEffect(() => {
    if (modo !== 'en_progreso' || tiempoLimiteSegundos == null) return undefined;
    const interval = setInterval(() => {
      setTiempoRestante((cur) => Math.max(0, (cur ?? 1) - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, [modo, tiempoLimiteSegundos]);

  useEffect(() => {
    if (modo === 'en_progreso' && tiempoLimiteSegundos != null && tiempoRestante === 0) {
      finalizarExamen();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tiempoRestante]);

  const seleccionarOpcion = (idx) => {
    setRespuestas((cur) => {
      const next = [...cur];
      next[indiceActual] = idx;
      return next;
    });
  };

  const siguiente = () => {
    if (indiceActual < preguntas.length - 1) {
      setIndiceActual((i) => i + 1);
    } else {
      finalizarExamen();
    }
  };

  // --- Historial ---
  const [historial, setHistorial] = useState([]);
  const [historialLoading, setHistorialLoading] = useState(false);
  const [historialError, setHistorialError] = useState(null);
  const [expandido, setExpandido] = useState(null);

  const cargarHistorial = () => {
    setHistorialLoading(true);
    api
      .getExamenes()
      .then((data) => {
        setHistorial(data);
        setHistorialError(null);
      })
      .catch((err) => setHistorialError(err.message || 'No se pudo cargar el historial.'))
      .finally(() => setHistorialLoading(false));
  };

  const irAHistorial = () => {
    setModo('historial');
    setExpandido(null);
    cargarHistorial();
  };

  // Mini-stats del historial, derivadas de `historial` ya cargado.
  const promedioPct = useMemo(() => {
    if (historial.length === 0) return null;
    const pcts = historial.map((e) => (e.respuestas_correctas / e.num_preguntas) * 100);
    return Math.round(pcts.reduce((a, b) => a + b, 0) / pcts.length);
  }, [historial]);
  const mejorPct = useMemo(() => {
    if (historial.length === 0) return null;
    return Math.round(Math.max(...historial.map((e) => (e.respuestas_correctas / e.num_preguntas) * 100)));
  }, [historial]);

  const borrarResultado = async (id) => {
    if (!window.confirm('¿Borrar este resultado del historial?')) return;
    const prev = historial;
    setHistorial((cur) => cur.filter((e) => e.id !== id));
    try {
      await api.deleteExamen(id);
    } catch {
      setHistorial(prev);
    }
  };

  if (authLoading || !isAuthenticated) return null;

  const puedeComenzar = opcionesNum.length > 0 && !terminosLoading;

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
            <h1 className="settings__title">Modo examen</h1>
            <p className="settings__subtitle">Ponte a prueba con los términos de tu Glosario clínico.</p>
          </div>
          {modo !== 'historial' && (
            <button type="button" className="settings__btn" onClick={irAHistorial}>
              Ver historial
            </button>
          )}
        </header>

        {terminosLoading && <p className="settings__muted">Cargando tu glosario…</p>}
        {!terminosLoading && terminosError && <p className="settings__error">{terminosError}</p>}

        {!terminosLoading && !terminosError && terminos.length === 0 && (
          <p className="settings__muted">
            Tu <Link to="/app/glosario">Glosario clínico</Link> está vacío — agrega algunos términos para poder
            generar un examen.
          </p>
        )}

        {!terminosLoading && !terminosError && terminos.length > 0 && modo === 'config' && (
          <div className={PANEL + ' flex flex-col gap-4'}>
            <div className="flex flex-col gap-1.5">
              <label className="settings__label">Categoría</label>
              <select
                className="settings__input"
                value={categoriaSel}
                onChange={(e) => setCategoriaSel(e.target.value)}
              >
                <option value={TODAS}>Todas ({terminos.length} términos)</option>
                {categorias.map((c) => (
                  <option key={c} value={c}>
                    {c} ({terminos.filter((t) => t.categoria === c).length})
                  </option>
                ))}
              </select>
            </div>

            {pool.length < 4 ? (
              <p className="rounded-xl bg-danger/10 px-4 py-3 text-sm text-danger">
                Necesitas al menos 4 términos en esta categoría para generar un examen (tienes {pool.length}).
              </p>
            ) : (
              <>
                <div className="flex flex-col gap-1.5">
                  <label className="settings__label">Número de preguntas</label>
                  <select
                    className="settings__input"
                    value={numPreguntasSel}
                    onChange={(e) => setNumPreguntasSel(Number(e.target.value))}
                  >
                    {opcionesNum.map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="settings__label">Cronómetro</label>
                  <div className="agenda__modetoggle">
                    <button type="button" className={!cronometroActivo ? 'is-active' : ''} onClick={() => setCronometroActivo(false)}>
                      Sin límite
                    </button>
                    <button type="button" className={cronometroActivo ? 'is-active' : ''} onClick={() => setCronometroActivo(true)}>
                      Con límite
                    </button>
                  </div>
                </div>

                {cronometroActivo && (
                  <div className="flex flex-col gap-1.5">
                    <label className="settings__label">Minutos</label>
                    <input
                      type="number"
                      min={1}
                      max={180}
                      className="settings__input"
                      value={minutosCronometro}
                      onChange={(e) => setMinutosCronometro(Number(e.target.value) || 1)}
                    />
                  </div>
                )}

                <button type="button" className={PRIMARY_BTN + ' mt-2'} disabled={!puedeComenzar} onClick={comenzar}>
                  Comenzar examen
                </button>
              </>
            )}
          </div>
        )}

        {modo === 'en_progreso' && preguntas.length > 0 && (
          <div className={PANEL}>
            <div className="mb-4 flex items-center justify-between text-sm font-semibold text-ink-muted">
              <span>
                Pregunta {indiceActual + 1} de {preguntas.length}
              </span>
              {tiempoRestante != null && (
                <span
                  className={
                    'inline-flex items-center gap-1.5 font-bold ' + (tiempoRestante <= 30 ? 'text-danger' : 'text-ink')
                  }
                >
                  <Clock width={13} height={13} />
                  {formatMinSeg(tiempoRestante)}
                </span>
              )}
            </div>

            <div className="mb-5 h-1.5 w-full overflow-hidden rounded-full bg-surface-2">
              <div
                className="h-full rounded-full bg-accent-gradient transition-all duration-300"
                style={{ width: `${(indiceActual / preguntas.length) * 100}%` }}
              />
            </div>

            <p className="text-sm text-ink-muted">¿Cuál es la definición correcta de…</p>
            <h2 className="mb-5 mt-1 text-xl font-black leading-snug text-ink">{preguntas[indiceActual].termino}</h2>

            <div className="mb-5 flex flex-col gap-2.5">
              {preguntas[indiceActual].opciones.map((op, idx) => {
                const selected = respuestas[indiceActual] === idx;
                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => seleccionarOpcion(idx)}
                    className={
                      'rounded-xl border px-4 py-3 text-left text-sm leading-relaxed transition-all duration-150 ' +
                      (selected
                        ? 'border-accent bg-accent-weak text-ink'
                        : 'border-border-strong bg-bg text-ink hover:border-accent/50')
                    }
                  >
                    {op}
                  </button>
                );
              })}
            </div>

            <button type="button" className={PRIMARY_BTN} disabled={respuestas[indiceActual] == null} onClick={siguiente}>
              {indiceActual < preguntas.length - 1 ? 'Siguiente' : 'Terminar'}
            </button>
          </div>
        )}

        {modo === 'resultados' && resultado && (
          <>
            <div className={PANEL + ' text-center'}>
              <div className="text-5xl font-black leading-none text-accent">
                {resultado.correctas}/{resultado.preguntas.length}
              </div>
              <p className="mt-2.5 text-sm font-medium text-ink-muted">
                {Math.round((resultado.correctas / resultado.preguntas.length) * 100)}% correcto
                {resultado.tiempoUsado != null && ` · ${formatMinSeg(resultado.tiempoUsado)} min`}
              </p>
              {guardadoError && <p className="mt-2 text-sm text-danger">{guardadoError}</p>}
            </div>

            <RevisionPreguntas preguntas={resultado.preguntas} />

            <button type="button" className={PRIMARY_BTN} onClick={() => setModo('config')}>
              Nuevo examen
            </button>
          </>
        )}

        {modo === 'historial' && (
          <>
            {historialLoading && <p className="settings__muted">Cargando…</p>}
            {!historialLoading && historialError && <p className="settings__error">{historialError}</p>}
            {!historialLoading && !historialError && historial.length === 0 && (
              <p className="settings__muted">Todavía no has hecho ningún examen.</p>
            )}

            {!historialLoading && historial.length > 0 && (
              <>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <MiniStat icon={<GraduationCap width={18} height={18} />} value={historial.length} label="Exámenes hechos" />
                  <MiniStat
                    icon={<TrendingUp width={18} height={18} />}
                    display={promedioPct == null ? '—' : `${promedioPct}%`}
                    label="Promedio de aciertos"
                  />
                  <MiniStat
                    icon={<Star width={18} height={18} />}
                    display={mejorPct == null ? '—' : `${mejorPct}%`}
                    label="Mejor resultado"
                  />
                </div>

                <div className="flex flex-col gap-3">
                  {historial.map((e) => (
                    <div key={e.id} className={CARD + ' flex flex-col gap-3 p-4'}>
                      <div className="flex items-start gap-3">
                        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-accent-gradient text-xs font-black text-white shadow-sm">
                          {Math.round((e.respuestas_correctas / e.num_preguntas) * 100)}%
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="font-bold text-ink">{e.categoria || 'Todas las categorías'}</div>
                          <div className="text-xs text-ink-muted">
                            {formatFecha(e.created_at)} · {e.respuestas_correctas}/{e.num_preguntas} correctas
                            {e.tiempo_usado_segundos != null && ` · ${formatMinSeg(e.tiempo_usado_segundos)} min`}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => borrarResultado(e.id)}
                          aria-label="Borrar resultado"
                          title="Borrar resultado"
                          className="shrink-0 rounded-lg p-1.5 text-ink-soft transition-colors duration-150 hover:bg-danger/10 hover:text-danger"
                        >
                          <Trash width={15} height={15} />
                        </button>
                      </div>
                      <button
                        type="button"
                        onClick={() => setExpandido((cur) => (cur === e.id ? null : e.id))}
                        className="self-start rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-ink-muted transition-colors duration-150 hover:border-accent/40 hover:text-accent"
                      >
                        {expandido === e.id ? 'Ocultar detalle' : 'Ver detalle'}
                      </button>
                      {expandido === e.id && <RevisionPreguntas preguntas={e.preguntas} />}
                    </div>
                  ))}
                </div>
              </>
            )}

            <button type="button" className="settings__btn w-full" onClick={() => setModo('config')}>
              Volver
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// Revisión pregunta-por-pregunta: se reutiliza tanto recién terminado el
// examen como al expandir un resultado del historial (ambos ya traen
// `elegida` fijada).
function RevisionPreguntas({ preguntas }) {
  return (
    <div className="flex flex-col gap-3">
      {preguntas.map((p, i) => (
        <div key={i} className={PANEL}>
          <p className="mb-3 text-sm font-bold text-ink">{p.termino}</p>
          <div className="flex flex-col gap-2">
            {p.opciones.map((op, idx) => {
              const isCorrect = idx === p.correcta;
              const isWrongPick = idx === p.elegida && idx !== p.correcta;
              return (
                <div
                  key={idx}
                  className={
                    'flex items-center justify-between gap-2 rounded-xl border px-4 py-2.5 text-sm leading-relaxed ' +
                    (isCorrect
                      ? 'border-[#2f9e44]/40 bg-[#2f9e44]/10 text-[#2f9e44]'
                      : isWrongPick
                        ? 'border-danger/40 bg-danger/10 text-danger'
                        : 'border-border-strong text-ink-muted')
                  }
                >
                  {op}
                  {isCorrect && <Check width={14} height={14} className="shrink-0" />}
                  {isWrongPick && <X width={14} height={14} className="shrink-0" />}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
