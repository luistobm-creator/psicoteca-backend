import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Library, Mic, Square, Trash } from '../components/icons.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import * as api from '../api.js';

// Tope propio (no pedido por el usuario, decisión de diseño): evita archivos
// gigantes por accidente si alguien olvida detener la grabación.
const MAX_SECONDS = 10 * 60;

function formatDuration(totalSeconds) {
  const s = Math.max(0, Math.round(totalSeconds || 0));
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${String(sec).padStart(2, '0')}`;
}

function formatWhen(iso) {
  const d = new Date(iso);
  const date = d.toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' });
  const time = d.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
  return `${date} · ${time}`;
}

// Notas de voz: grabación posterior a sesión, por paciente. El audio vive en
// Supabase Storage (proxy autenticado del backend, nunca un link directo);
// aquí solo se graba con MediaRecorder, se sube y se reproduce bajo demanda.
// Misma página protegida que Perfil/Glosario/Agenda/Pacientes.
export default function NotasDeVoz() {
  const { isAuthenticated, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!authLoading && !isAuthenticated) navigate('/login', { replace: true });
  }, [authLoading, isAuthenticated, navigate]);

  const [pacientes, setPacientes] = useState([]);
  const [pacientesError, setPacientesError] = useState(null);
  const [pacienteId, setPacienteId] = useState('');

  useEffect(() => {
    if (!isAuthenticated) return;
    api
      .getPacientes()
      .then((data) => {
        setPacientes(data);
        setPacientesError(null);
        setPacienteId((cur) => cur || data[0]?.id || '');
      })
      .catch((err) => setPacientesError(err.message || 'No se pudo cargar el directorio.'));
  }, [isAuthenticated]);

  const [notas, setNotas] = useState([]);
  const [notasLoading, setNotasLoading] = useState(false);
  const [notasError, setNotasError] = useState(null);

  const loadNotas = (pid) => {
    if (!pid) {
      setNotas([]);
      return;
    }
    setNotasLoading(true);
    api
      .getNotasVoz(pid)
      .then((data) => {
        setNotas(data);
        setNotasError(null);
      })
      .catch((err) => setNotasError(err.message || 'No se pudieron cargar las notas.'))
      .finally(() => setNotasLoading(false));
  };

  useEffect(() => {
    loadNotas(pacienteId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pacienteId]);

  // --- Grabación (MediaRecorder nativo, sin librerías) ---
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [recError, setRecError] = useState(null);
  const [pending, setPending] = useState(null); // { blob, url } — grabación lista, aún no subida
  const [titulo, setTitulo] = useState('');
  const [saving, setSaving] = useState(false);

  const recorderRef = useRef(null);
  const chunksRef = useRef([]);
  const streamRef = useRef(null);
  const intervalRef = useRef(null);
  const startedAtRef = useRef(0);

  const stopTimer = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  };

  const stopStream = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  };

  const stopRecording = () => {
    stopTimer();
    if (recorderRef.current && recorderRef.current.state !== 'inactive') {
      recorderRef.current.stop();
    }
    setRecording(false);
  };

  const startRecording = async () => {
    setRecError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      // Sin forzar mimeType: cada navegador graba en su formato nativo (Chrome
      // suele usar audio/webm, Safari audio/mp4); el Blob final toma ese tipo real.
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' });
        chunksRef.current = [];
        setPending({ blob, url: URL.createObjectURL(blob) });
        stopStream();
      };
      recorder.start();
      recorderRef.current = recorder;
      startedAtRef.current = Date.now();
      setElapsed(0);
      setRecording(true);
      intervalRef.current = setInterval(() => {
        const secs = (Date.now() - startedAtRef.current) / 1000;
        setElapsed(secs);
        if (secs >= MAX_SECONDS) stopRecording();
      }, 250);
    } catch {
      setRecError('No se pudo acceder al micrófono. Revisa los permisos del navegador.');
    }
  };

  const handleDiscard = () => {
    if (pending) URL.revokeObjectURL(pending.url);
    setPending(null);
    setTitulo('');
  };

  const handleSave = async () => {
    if (!pending || !pacienteId) return;
    setSaving(true);
    try {
      const created = await api.uploadNotaVoz(pending.blob, {
        paciente_id: pacienteId,
        titulo: titulo.trim() || null,
        duracion_segundos: Math.round(elapsed),
      });
      setNotas((cur) => [created, ...cur]);
      handleDiscard();
    } catch (err) {
      setNotasError(err.message || 'No se pudo guardar la nota.');
    } finally {
      setSaving(false);
    }
  };

  // Limpieza al salir de la página: libera el micrófono si seguía grabando.
  useEffect(() => {
    return () => {
      stopTimer();
      stopStream();
      if (recorderRef.current && recorderRef.current.state !== 'inactive') {
        recorderRef.current.stop();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --- Reproducción (blob autenticado bajo demanda, no precarga toda la lista) ---
  const [audioUrls, setAudioUrls] = useState({});
  const [loadingAudioId, setLoadingAudioId] = useState(null);

  const playNota = async (id) => {
    if (audioUrls[id] || loadingAudioId) return;
    setLoadingAudioId(id);
    try {
      const url = await api.fetchNotaVozAudio(id);
      setAudioUrls((cur) => ({ ...cur, [id]: url }));
    } catch (err) {
      setNotasError(err.message || 'No se pudo reproducir el audio.');
    } finally {
      setLoadingAudioId(null);
    }
  };

  // Revoca los object URLs de audio al salir de la página.
  useEffect(() => {
    return () => {
      Object.values(audioUrls).forEach((url) => URL.revokeObjectURL(url));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleDelete = async (nota) => {
    const label = nota.titulo ? `"${nota.titulo}"` : 'esta nota de voz';
    if (!window.confirm(`¿Borrar ${label}? Esta acción no se puede deshacer.`)) return;
    try {
      await api.deleteNotaVoz(nota.id);
      setNotas((cur) => cur.filter((n) => n.id !== nota.id));
      setAudioUrls((cur) => {
        if (!cur[nota.id]) return cur;
        URL.revokeObjectURL(cur[nota.id]);
        const next = { ...cur };
        delete next[nota.id];
        return next;
      });
    } catch (err) {
      setNotasError(err.message || 'No se pudo borrar la nota.');
    }
  };

  if (authLoading || !isAuthenticated) return null;

  const pacienteActual = pacientes.find((p) => p.id === pacienteId);
  const selectorLocked = recording || !!pending || saving;

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
            <h1 className="settings__title">Notas de voz</h1>
            <p className="settings__subtitle">Documenta lo que ocurre después de cada sesión.</p>
          </div>
        </header>

        {pacientesError && <p className="settings__error">{pacientesError}</p>}

        {!pacientesError && pacientes.length === 0 && (
          <p className="settings__muted">
            Todavía no tienes pacientes en tu directorio.{' '}
            <Link to="/app/pacientes">Agrega uno</Link> para poder grabar notas.
          </p>
        )}

        {pacientes.length > 0 && (
          <>
            <div className="notasvoz__patientsel">
              <label className="settings__label" htmlFor="notasvoz-paciente">
                Paciente
              </label>
              <select
                id="notasvoz-paciente"
                className="settings__input"
                value={pacienteId}
                onChange={(e) => setPacienteId(e.target.value)}
                disabled={selectorLocked}
              >
                {pacientes.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nombre}
                  </option>
                ))}
              </select>
            </div>

            <div className="notasvoz__recorder">
              {!pending ? (
                <div className="notasvoz__recordrow">
                  <button
                    type="button"
                    className={`notasvoz__recbtn${recording ? ' is-recording' : ''}`}
                    onClick={recording ? stopRecording : startRecording}
                    aria-label={recording ? 'Detener grabación' : 'Grabar nota de voz'}
                  >
                    {recording ? <Square width={20} height={20} /> : <Mic width={24} height={24} />}
                  </button>
                  <div className="notasvoz__recstatus">
                    {recording ? (
                      <>
                        <span className="notasvoz__recdot" />
                        Grabando… {formatDuration(elapsed)}
                      </>
                    ) : (
                      <span className="settings__muted">Grabar para {pacienteActual?.nombre}</span>
                    )}
                  </div>
                </div>
              ) : (
                <div className="notasvoz__review">
                  <audio controls src={pending.url} className="notasvoz__audio" />
                  <input
                    type="text"
                    className="settings__input"
                    value={titulo}
                    onChange={(e) => setTitulo(e.target.value)}
                    placeholder="Título (opcional), p. ej. Seguimiento sesión 12"
                    maxLength={120}
                    autoFocus
                  />
                  <div className="modal__actions">
                    <button type="button" className="settings__btn" onClick={handleDiscard} disabled={saving}>
                      Descartar
                    </button>
                    <button
                      type="button"
                      className="settings__btn settings__btn--accent"
                      onClick={handleSave}
                      disabled={saving}
                    >
                      {saving ? 'Guardando…' : 'Guardar nota'}
                    </button>
                  </div>
                </div>
              )}
              {recError && <p className="settings__error">{recError}</p>}
            </div>

            {notasLoading && <p className="settings__muted">Cargando notas…</p>}
            {!notasLoading && notasError && <p className="settings__error">{notasError}</p>}
            {!notasLoading && !notasError && notas.length === 0 && (
              <p className="settings__muted">{pacienteActual?.nombre} todavía no tiene notas de voz.</p>
            )}

            {!notasLoading && notas.length > 0 && (
              <div className="notasvoz__list">
                {notas.map((n) => (
                  <div key={n.id} className="notasvoz__item">
                    <div className="notasvoz__itemhead">
                      <span className="notasvoz__iteminfo">
                        <span className="notasvoz__itemtitle">{n.titulo || 'Nota de voz'}</span>
                        <span className="settings__muted">
                          {[formatWhen(n.created_at), n.duracion_segundos != null ? formatDuration(n.duracion_segundos) : null]
                            .filter(Boolean)
                            .join(' · ')}
                        </span>
                      </span>
                      <button
                        type="button"
                        className="glosario__delete"
                        onClick={() => handleDelete(n)}
                        aria-label="Borrar nota"
                        title="Borrar nota"
                      >
                        <Trash width={16} height={16} />
                      </button>
                    </div>
                    {audioUrls[n.id] ? (
                      <audio controls autoPlay src={audioUrls[n.id]} className="notasvoz__audio" />
                    ) : (
                      <button
                        type="button"
                        className="settings__btn"
                        onClick={() => playNota(n.id)}
                        disabled={loadingAudioId === n.id}
                      >
                        {loadingAudioId === n.id ? 'Cargando…' : 'Reproducir'}
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
