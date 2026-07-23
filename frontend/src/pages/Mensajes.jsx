import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Library, MessageCircle, X } from '../components/icons.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useComunidadPerfil } from '../lib/useComunidadPerfil.js';
import PerfilComunidadForm from '../components/PerfilComunidadForm.jsx';
import PersonaRow from '../components/PersonaRow.jsx';
import ChatThread from '../components/ChatThread.jsx';
import { timeAgo } from '../lib/fileType.js';
import * as api from '../api.js';

export default function Mensajes() {
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!authLoading && !isAuthenticated) navigate('/login', { replace: true });
  }, [authLoading, isAuthenticated, navigate]);

  const { perfil, loading: perfilLoading, refresh: refreshPerfil } = useComunidadPerfil();

  const [directorio, setDirectorio] = useState([]);
  const [mensajes, setMensajes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = () => {
    setLoading(true);
    Promise.all([api.getDirectorioComunidad(), api.getMensajesDirectos()])
      .then(([dir, msgs]) => {
        setDirectorio(dir);
        setMensajes(msgs);
        setError(null);
      })
      .catch((err) => setError(err.message || 'No se pudo cargar la bandeja.'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (isAuthenticated && perfil?.activo) load();
    else setLoading(false);
  }, [isAuthenticated, perfil?.activo]);

  const perfilPorId = useMemo(() => Object.fromEntries(directorio.map((p) => [p.user_id, p])), [directorio]);

  // `mensajes` ya viene ordenado created_at.desc desde el backend, así que
  // la primera aparición de cada `otroId` ya es su mensaje más reciente.
  const conversaciones = useMemo(() => {
    if (!user) return [];
    const byOtro = new Map();
    for (const m of mensajes) {
      const otroId = m.remitente_id === user.id ? m.destinatario_id : m.remitente_id;
      if (!byOtro.has(otroId)) byOtro.set(otroId, { otroId, ultimo: m, noLeidos: 0 });
      if (m.destinatario_id === user.id && !m.leido) byOtro.get(otroId).noLeidos += 1;
    }
    return [...byOtro.values()];
  }, [mensajes, user]);

  const idsConversados = useMemo(() => new Set(conversaciones.map((c) => c.otroId)), [conversaciones]);
  const directorioNuevo = directorio.filter((p) => !idsConversados.has(p.user_id));

  const [hiloConId, setHiloConId] = useState(null);
  const [hilo, setHilo] = useState([]);
  const [hiloError, setHiloError] = useState(null);

  const abrirHilo = async (otroId) => {
    setHiloConId(otroId);
    setHiloError(null);
    try {
      const data = await api.getHiloMensajes(otroId);
      setHilo(data);
      // Marca como leídos los mensajes que ellos me enviaron (mejor esfuerzo).
      const pendientes = data.filter((m) => m.destinatario_id === user.id && !m.leido);
      if (pendientes.length) {
        Promise.all(pendientes.map((m) => api.marcarMensajeLeido(m.id))).then(load);
      }
    } catch (err) {
      setHiloError(err.message || 'No se pudo cargar la conversación.');
    }
  };

  const handleEnviar = async (texto) => {
    const creado = await api.enviarMensajeDirecto(hiloConId, texto);
    setHilo((cur) => [...cur, creado]);
  };

  const hiloNormalizado = useMemo(
    () => hilo.map((m) => ({ ...m, esMio: m.remitente_id === user?.id })),
    [hilo, user?.id]
  );

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
            <h1 className="settings__title">Mensajes</h1>
            <p className="settings__subtitle">Conversa directamente con otros terapeutas de la comunidad.</p>
          </div>
        </header>

        {perfilLoading && <p className="settings__muted">Cargando…</p>}
        {!perfilLoading && !perfil && (
          <p className="settings__error">No se pudo cargar tu perfil de comunidad. Intenta de nuevo más tarde.</p>
        )}
        {!perfilLoading && perfil && !perfil.activo && <PerfilComunidadForm perfil={perfil} onSaved={refreshPerfil} />}

        {!perfilLoading && perfil?.activo && (
          <>
            {loading && <p className="settings__muted">Cargando…</p>}
            {!loading && error && <p className="settings__error">{error}</p>}

            {!loading && !error && (
              <>
                {conversaciones.length > 0 && (
                  <div className="inbox__list" style={{ marginBottom: 20 }}>
                    {conversaciones.map((c) => {
                      const p = perfilPorId[c.otroId];
                      const nombre = p?.nombre_publico || 'Perfil no disponible';
                      const iniciales = nombre
                        .trim()
                        .split(/\s+/)
                        .slice(0, 2)
                        .map((s) => s[0])
                        .join('')
                        .toUpperCase();
                      return (
                        <button
                          key={c.otroId}
                          type="button"
                          className={'inbox__row' + (hiloConId === c.otroId ? ' is-active' : '')}
                          onClick={() => abrirHilo(c.otroId)}
                        >
                          <div className="persona__avatar">{iniciales}</div>
                          <span className="persona__nombre" style={{ flex: '0 0 auto', maxWidth: 140 }}>
                            {nombre}
                          </span>
                          <span className="inbox__preview">{c.ultimo.contenido}</span>
                          <span className="settings__muted" style={{ fontSize: 11, flex: '0 0 auto' }}>
                            {timeAgo(new Date(c.ultimo.created_at))}
                          </span>
                          {c.noLeidos > 0 && <span className="inbox__unread" title={`${c.noLeidos} sin leer`} />}
                        </button>
                      );
                    })}
                  </div>
                )}

                <h2 className="dash-section__title" style={{ marginBottom: 12 }}>
                  <MessageCircle width={17} height={17} />
                  Directorio
                </h2>
                {directorioNuevo.length === 0 && conversaciones.length === 0 && (
                  <p className="settings__muted">
                    Todavía no hay otros terapeutas activos en la comunidad. Cuando alguien active su perfil,
                    aparecerá aquí.
                  </p>
                )}
                <div className="inbox__list">
                  {directorioNuevo.map((p) => (
                    <PersonaRow
                      key={p.user_id}
                      nombre={p.nombre_publico}
                      especialidad={p.especialidad}
                      right={
                        <button type="button" className="settings__btn settings__btn--accent" onClick={() => abrirHilo(p.user_id)}>
                          Mensaje
                        </button>
                      }
                    />
                  ))}
                </div>
              </>
            )}

            {hiloConId && (
              <section className="dash-section fade-in" style={{ marginTop: 24 }}>
                <header className="dash-section__head">
                  <h2 className="dash-section__title">{perfilPorId[hiloConId]?.nombre_publico || 'Conversación'}</h2>
                  <button type="button" className="settings__back" onClick={() => setHiloConId(null)}>
                    <X width={14} height={14} />
                    Cerrar
                  </button>
                </header>
                {hiloError && <p className="settings__error">{hiloError}</p>}
                {!hiloError && (
                  <ChatThread mensajes={hiloNormalizado} onEnviar={handleEnviar} placeholder="Escribe tu mensaje…" />
                )}
              </section>
            )}
          </>
        )}
      </div>
    </div>
  );
}
