import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Check, Library, Plus, Users, X } from '../components/icons.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useComunidadPerfil } from '../lib/useComunidadPerfil.js';
import { useCountUp } from '../lib/useCountUp.js';
import PerfilComunidadForm from '../components/PerfilComunidadForm.jsx';
import ChatThread from '../components/ChatThread.jsx';
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

export default function GruposEstudio() {
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!authLoading && !isAuthenticated) navigate('/login', { replace: true });
  }, [authLoading, isAuthenticated, navigate]);

  const { perfil, loading: perfilLoading, refresh: refreshPerfil } = useComunidadPerfil();

  const [grupos, setGrupos] = useState([]);
  const [membresias, setMembresias] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = () => {
    setLoading(true);
    Promise.all([api.getGrupos(), api.getMisMembresias()])
      .then(([g, m]) => {
        setGrupos(g);
        setMembresias(m);
        setError(null);
      })
      .catch((err) => setError(err.message || 'No se pudieron cargar los grupos.'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (isAuthenticated) load();
  }, [isAuthenticated]);

  const misGrupoIds = useMemo(() => new Set(membresias.map((m) => m.grupo_id)), [membresias]);
  const misGruposCount = useMemo(
    () => grupos.filter((g) => misGrupoIds.has(g.id)).length,
    [grupos, misGrupoIds]
  );

  const [showNew, setShowNew] = useState(false);
  const [grupoActivo, setGrupoActivo] = useState(null);
  const [mensajes, setMensajes] = useState([]);
  const [mensajesError, setMensajesError] = useState(null);

  const abrirGrupo = (grupo) => {
    setGrupoActivo(grupo);
    setMensajesError(null);
    api
      .getMensajesGrupo(grupo.id)
      .then(setMensajes)
      .catch((err) => setMensajesError(err.message || 'No se pudieron cargar los mensajes.'));
  };

  const handleUnirse = async (grupo) => {
    try {
      await api.unirseAGrupo(grupo.id);
      load();
    } catch (err) {
      alert(err.message || 'No se pudo unir al grupo.');
    }
  };

  const handleSalir = async (grupo) => {
    if (!window.confirm(`¿Salir de "${grupo.nombre}"?`)) return;
    await api.salirDeGrupo(grupo.id);
    if (grupoActivo?.id === grupo.id) setGrupoActivo(null);
    load();
  };

  const handleEnviar = async (texto) => {
    const creado = await api.enviarMensajeGrupo(grupoActivo.id, texto);
    setMensajes((cur) => [...cur, creado]);
  };

  const mensajesNormalizados = useMemo(
    () => mensajes.map((m) => ({ ...m, esMio: m.user_id === user?.id })),
    [mensajes, user?.id]
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

        <header className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="settings__title">Grupos de estudio</h1>
            <p className="settings__subtitle">Únete o crea un grupo para discutir con otros terapeutas.</p>
          </div>
          {perfil?.activo && (
            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-xl bg-accent-gradient px-4 py-2.5 text-sm font-bold text-white shadow-[0_2px_10px_-2px_var(--accent-soft)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_6px_18px_-4px_var(--accent-soft)] active:translate-y-0"
              onClick={() => setShowNew(true)}
            >
              <Plus width={16} height={16} />
              Nuevo grupo
            </button>
          )}
        </header>

        {!perfilLoading && !perfil && (
          <p className="settings__error">No se pudo cargar tu perfil de comunidad. Intenta de nuevo más tarde.</p>
        )}
        {!perfilLoading && perfil && !perfil.activo && <PerfilComunidadForm perfil={perfil} onSaved={refreshPerfil} />}

        {loading && <p className="settings__muted">Cargando…</p>}
        {!loading && error && <p className="settings__error">{error}</p>}
        {!loading && !error && grupos.length === 0 && (
          <p className="settings__muted">Todavía no hay grupos de estudio. Sé el primero en crear uno.</p>
        )}

        {!loading && !error && grupos.length > 0 && (
          <>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <MiniStat icon={<Users width={18} height={18} />} value={grupos.length} label="Grupos disponibles" />
              <MiniStat icon={<Check width={18} height={18} />} value={misGruposCount} label="Donde participo" />
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {grupos.map((g) => {
                const soyMiembro = misGrupoIds.has(g.id);
                const numMiembros = g.miembros?.[0]?.count ?? 0;
                return (
                  <article key={g.id} className={CARD + ' flex flex-col gap-2.5 p-4'}>
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-accent-gradient text-white shadow-sm">
                      <Users width={18} height={18} />
                    </span>
                    <span className="font-bold text-ink">{g.nombre}</span>
                    {g.descripcion && (
                      <p className="line-clamp-2 flex-1 text-xs text-ink-muted">{g.descripcion}</p>
                    )}
                    <span className="text-xs text-ink-soft">
                      {numMiembros} {numMiembros === 1 ? 'miembro' : 'miembros'}
                    </span>
                    <div className="mt-1 flex flex-wrap gap-2">
                      {soyMiembro ? (
                        <>
                          <button
                            type="button"
                            onClick={() => abrirGrupo(g)}
                            className="rounded-lg bg-accent-gradient px-3 py-1.5 text-xs font-bold text-white shadow-sm transition-transform duration-150 hover:-translate-y-0.5"
                          >
                            Abrir chat
                          </button>
                          <button
                            type="button"
                            onClick={() => handleSalir(g)}
                            className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-ink-muted transition-colors duration-150 hover:border-danger/40 hover:text-danger"
                          >
                            Salir
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleUnirse(g)}
                          disabled={!perfil?.activo}
                          title={!perfil?.activo ? 'Activa tu perfil de comunidad para unirte' : undefined}
                          className="rounded-lg bg-accent-gradient px-3 py-1.5 text-xs font-bold text-white shadow-sm transition-transform duration-150 hover:-translate-y-0.5 disabled:opacity-50 disabled:hover:translate-y-0"
                        >
                          Unirse
                        </button>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          </>
        )}

        {grupoActivo && (
          <section className="dash-section fade-in" style={{ marginTop: 24 }}>
            <header className="dash-section__head">
              <h2 className="dash-section__title">{grupoActivo.nombre}</h2>
              <button type="button" className="settings__back" onClick={() => setGrupoActivo(null)}>
                <X width={14} height={14} />
                Cerrar
              </button>
            </header>
            {mensajesError && <p className="settings__error">{mensajesError}</p>}
            {!mensajesError && (
              <ChatThread
                mensajes={mensajesNormalizados}
                onEnviar={handleEnviar}
                placeholder="Escribe algo para el grupo…"
                vacio="Todavía no hay mensajes en este grupo. ¡Rompe el hielo!"
              />
            )}
          </section>
        )}
      </div>

      {showNew && (
        <NuevoGrupoModal
          onClose={() => setShowNew(false)}
          onCreado={() => {
            setShowNew(false);
            load();
          }}
        />
      )}
    </div>
  );
}

function NuevoGrupoModal({ onClose, onCreado }) {
  const [nombre, setNombre] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!nombre.trim() || saving) return;
    setSaving(true);
    setError(null);
    try {
      await api.crearGrupo({ nombre: nombre.trim(), descripcion: descripcion.trim() || null });
      onCreado();
    } catch (err) {
      setError(err.message || 'No se pudo crear el grupo.');
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose} role="presentation">
      <div className="modal modal--form" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="modal__close" onClick={onClose} aria-label="Cerrar">
          <X width={18} height={18} />
        </button>
        <h2 className="modal__title">Nuevo grupo de estudio</h2>

        <form onSubmit={handleSubmit}>
          <div className="modal__field">
            <label className="settings__label">Nombre</label>
            <input
              className="settings__input"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="p. ej. TCC para principiantes"
              autoFocus
            />
          </div>
          <div className="modal__field">
            <label className="settings__label">Descripción (opcional)</label>
            <textarea
              className="modal__textarea"
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              rows={3}
            />
          </div>

          {error && <div className="modal__error">{error}</div>}

          <div className="modal__actions">
            <button type="button" className="settings__btn" onClick={onClose} disabled={saving}>
              Cancelar
            </button>
            <button type="submit" className="settings__btn settings__btn--accent" disabled={!nombre.trim() || saving}>
              {saving ? (
                'Creando…'
              ) : (
                <>
                  <Check width={14} height={14} /> Crear grupo
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
