import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Calendar, Clock, Library, Mic, Square, Trash } from '../components/icons.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useCountUp } from '../lib/useCountUp.js';
import * as api from '../api.js';

const CARD =
  'group relative overflow-hidden rounded-2xl border border-border bg-surface shadow-sm ' +
  'transition-all duration-300 hover:-translate-y-1 hover:border-accent/30 hover:shadow-lift dark:hover:shadow-lift-dark';

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

  // Mini-stats del paciente seleccionado, derivadas de `notas` ya cargadas.
  const duracionTotal = useMemo(
    () => notas.reduce((sum, n) => sum + (n.duracion_segundos || 0), 0),
    [notas]
  );
  const ultimaNotaLabel = useMemo(() => {
    if (notas.length === 0) return '—';
    return new Date(notas[0].created_at).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' });
  }, [notas]);

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
      <div className="settings__panel fade-in max-w-[860px]">
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
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <MiniStat icon={<Mic width={18} height={18} />} value={notas.length} label="Notas guardadas" />
              <MiniStat
                icon={<Clock width={18} height={18} />}
                display={formatDuration(duracionTotal)}
                label="Duración total"
              />
              <MiniStat icon={<Calendar width={18} height={18} />} display={ultimaNotaLabel} label="Última nota" />
            </div>

            <div className="flex max-w-[380px] flex-col gap-1.5">
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

            <div className={CARD + ' flex flex-col items-center gap-4 p-8 text-center'}>
              {!pending ? (
                <>
                  <button
                    type="button"
                    onClick={recording ? stopRecording : startRecording}
                    aria-label={recording ? 'Detener grabación' : 'Grabar nota de voz'}
                    className={
                      'flex h-20 w-20 items-center justify-center rounded-full text-white transition-all duration-300 ' +
                      (recording
                        ? 'bg-danger shadow-[0_0_0_8px_rgba(229,72,77,0.15)]'
                        : 'bg-accent-gradient shadow-lg hover:scale-105 hover:shadow-glow active:scale-95')
                    }
                  >
                    {recording ? <Square width={22} height={22} /> : <Mic width={28} height={28} />}
                  </button>
                  {recording ? (
                    <div className="flex items-center gap-2 text-sm font-bold text-danger">
                      <span className="h-2 w-2 animate-pulse rounded-full bg-danger" />
                      Grabando… {formatDuration(elapsed)}
                    </div>
                  ) : (
                    <p className="text-sm text-ink-muted">Grabar para {pacienteActual?.nombre}</p>
                  )}
                </>
              ) : (
                <div className="flex w-full max-w-md flex-col gap-3">
                  <audio controls src={pending.url} className="w-full" />
                  <input
                    type="text"
                    className="settings__input"
                    value={titulo}
                    onChange={(e) => setTitulo(e.target.value)}
                    placeholder="Título (opcional), p. ej. Seguimiento sesión 12"
                    maxLength={120}
                    autoFocus
                  />
                  <div className="flex justify-center gap-2">
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
              {recError && <p className="text-sm text-danger">{recError}</p>}
            </div>

            {notasLoading && <p className="settings__muted">Cargando notas…</p>}
            {!notasLoading && notasError && <p className="settings__error">{notasError}</p>}
            {!notasLoading && !notasError && notas.length === 0 && (
              <p className="settings__muted">{pacienteActual?.nombre} todavía no tiene notas de voz.</p>
            )}

            {!notasLoading && notas.length > 0 && (
              <div className="flex flex-col gap-3">
                {notas.map((n) => (
                  <div key={n.id} className={CARD + ' flex items-center gap-4 p-4'}>
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-accent-gradient text-white shadow-sm">
                      <Mic width={18} height={18} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="font-bold text-ink">{n.titulo || 'Nota de voz'}</div>
                      <div className="text-xs text-ink-muted">
                        {[formatWhen(n.created_at), n.duracion_segundos != null ? formatDuration(n.duracion_segundos) : null]
                          .filter(Boolean)
                          .join(' · ')}
                      </div>
                      {audioUrls[n.id] && (
                        <audio controls autoPlay src={audioUrls[n.id]} className="mt-2 w-full" />
                      )}
                    </div>
                    <div className="flex shrink-0 items-center gap-1.5">
                      {!audioUrls[n.id] && (
                        <button
                          type="button"
                          onClick={() => playNota(n.id)}
                          disabled={loadingAudioId === n.id}
                          className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-ink-muted transition-colors duration-150 hover:border-accent/40 hover:text-accent disabled:opacity-60"
                        >
                          {loadingAudioId === n.id ? 'Cargando…' : 'Reproducir'}
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => handleDelete(n)}
                        aria-label="Borrar nota"
                        title="Borrar nota"
                        className="shrink-0 rounded-lg p-1.5 text-ink-soft transition-colors duration-150 hover:bg-danger/10 hover:text-danger"
                      >
                        <Trash width={16} height={16} />
                      </button>
                    </div>
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
