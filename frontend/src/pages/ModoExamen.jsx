import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Check, Clock, Library, Trash, X } from '../components/icons.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import * as api from '../api.js';

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
          <div className="examen__card">
            <div className="modal__field">
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

            {pool.length < 4 ? (
              <p className="settings__error">
                Necesitas al menos 4 términos en esta categoría para generar un examen (tienes {pool.length}).
              </p>
            ) : (
              <>
                <div className="modal__field">
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

                <div className="modal__field">
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
                  <div className="modal__field">
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

                <button
                  type="button"
                  className="settings__btn settings__btn--accent"
                  disabled={!puedeComenzar}
                  onClick={comenzar}
                  style={{ width: '100%', marginTop: 8 }}
                >
                  Comenzar examen
                </button>
              </>
            )}
          </div>
        )}

        {modo === 'en_progreso' && preguntas.length > 0 && (
          <div className="examen__card">
            <div className="examen__progress">
              Pregunta {indiceActual + 1} de {preguntas.length}
              {tiempoRestante != null && (
                <span className="examen__timer">
                  <Clock width={13} height={13} />
                  {formatMinSeg(tiempoRestante)}
                </span>
              )}
            </div>
            <p className="examen__prompt">¿Cuál es la definición correcta de…</p>
            <h2 className="examen__termino">{preguntas[indiceActual].termino}</h2>

            <div className="examen__opciones">
              {preguntas[indiceActual].opciones.map((op, idx) => (
                <button
                  key={idx}
                  type="button"
                  className={'examen__opcion' + (respuestas[indiceActual] === idx ? ' is-selected' : '')}
                  onClick={() => seleccionarOpcion(idx)}
                >
                  {op}
                </button>
              ))}
            </div>

            <button
              type="button"
              className="settings__btn settings__btn--accent"
              disabled={respuestas[indiceActual] == null}
              onClick={siguiente}
              style={{ width: '100%' }}
            >
              {indiceActual < preguntas.length - 1 ? 'Siguiente' : 'Terminar'}
            </button>
          </div>
        )}

        {modo === 'resultados' && resultado && (
          <>
            <div className="examen__score">
              <div className="examen__scorenum">
                {resultado.correctas}/{resultado.preguntas.length}
              </div>
              <p className="examen__scorelabel">
                {Math.round((resultado.correctas / resultado.preguntas.length) * 100)}% correcto
                {resultado.tiempoUsado != null && ` · ${formatMinSeg(resultado.tiempoUsado)} min`}
              </p>
              {guardadoError && <p className="settings__error">{guardadoError}</p>}
            </div>

            <RevisionPreguntas preguntas={resultado.preguntas} />

            <button
              type="button"
              className="settings__btn settings__btn--accent"
              onClick={() => setModo('config')}
              style={{ width: '100%', marginTop: 16 }}
            >
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
              <div className="notasvoz__list">
                {historial.map((e) => (
                  <div key={e.id} className="notasvoz__item">
                    <div className="notasvoz__itemhead">
                      <span className="notasvoz__iteminfo">
                        <span className="notasvoz__itemtitle">{e.categoria || 'Todas las categorías'}</span>
                        <span className="settings__muted">
                          {formatFecha(e.created_at)} · {e.respuestas_correctas}/{e.num_preguntas} correctas
                          {e.tiempo_usado_segundos != null && ` · ${formatMinSeg(e.tiempo_usado_segundos)} min`}
                        </span>
                      </span>
                      <button
                        type="button"
                        className="glosario__delete"
                        onClick={() => borrarResultado(e.id)}
                        aria-label="Borrar resultado"
                        title="Borrar resultado"
                      >
                        <Trash width={16} height={16} />
                      </button>
                    </div>
                    <button
                      type="button"
                      className="settings__btn"
                      onClick={() => setExpandido((cur) => (cur === e.id ? null : e.id))}
                    >
                      {expandido === e.id ? 'Ocultar detalle' : 'Ver detalle'}
                    </button>
                    {expandido === e.id && <RevisionPreguntas preguntas={e.preguntas} />}
                  </div>
                ))}
              </div>
            )}

            <button
              type="button"
              className="settings__btn"
              onClick={() => setModo('config')}
              style={{ width: '100%', marginTop: 16 }}
            >
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
    <div className="examen__revision">
      {preguntas.map((p, i) => (
        <div key={i} className="examen__card examen__revisioncard">
          <p className="examen__prompt">{p.termino}</p>
          <div className="examen__opciones">
            {p.opciones.map((op, idx) => {
              let cls = 'examen__opcion examen__opcion--static';
              if (idx === p.correcta) cls += ' is-correct';
              else if (idx === p.elegida) cls += ' is-wrong';
              return (
                <div key={idx} className={cls}>
                  {op}
                  {idx === p.correcta && <Check width={14} height={14} />}
                  {idx === p.elegida && idx !== p.correcta && <X width={14} height={14} />}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
