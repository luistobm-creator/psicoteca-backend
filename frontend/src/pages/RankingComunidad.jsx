import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Crown, Library, Star } from '../components/icons.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useComunidadPerfil } from '../lib/useComunidadPerfil.js';
import { useCountUp } from '../lib/useCountUp.js';
import PerfilComunidadForm from '../components/PerfilComunidadForm.jsx';
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

// Ranking de la comunidad: el puntaje SIEMPRE lo calcula el backend (nunca
// se acepta un valor del cliente) leyendo tu propio Glosario/Exámenes — ver
// comunidad_perfiles.py. Aquí solo se muestra un número agregado por
// persona, nunca el contenido de sus exámenes ni de su glosario.
export default function RankingComunidad() {
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!authLoading && !isAuthenticated) navigate('/login', { replace: true });
  }, [authLoading, isAuthenticated, navigate]);

  const { perfil, loading: perfilLoading, refresh } = useComunidadPerfil();

  const [ranking, setRanking] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadRanking = () => {
    setLoading(true);
    api
      .getRankingComunidad()
      .then((data) => {
        setRanking(data);
        setError(null);
      })
      .catch((err) => setError(err.message || 'No se pudo cargar el ranking.'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (isAuthenticated) loadRanking();
  }, [isAuthenticated]);

  const handleSaved = (nuevoPerfil) => {
    refresh();
    loadRanking();
  };

  const miPosicion = useMemo(() => {
    const idx = ranking.findIndex((p) => p.user_id === user?.id);
    return idx === -1 ? null : idx + 1;
  }, [ranking, user?.id]);
  const misPuntos = useMemo(
    () => ranking.find((p) => p.user_id === user?.id)?.puntos ?? null,
    [ranking, user?.id]
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
            <h1 className="settings__title">Ranking de la comunidad</h1>
            <p className="settings__subtitle">Compite sanamente con otros terapeutas de Psicoteca.</p>
          </div>
        </header>

        {perfilLoading && <p className="settings__muted">Cargando…</p>}
        {!perfilLoading && !perfil && (
          <p className="settings__error">No se pudo cargar tu perfil de comunidad. Intenta de nuevo más tarde.</p>
        )}
        {!perfilLoading && perfil && <PerfilComunidadForm perfil={perfil} onSaved={handleSaved} />}

        <p className="settings__muted">
          Puntaje: 1 punto por cada término de tu Glosario clínico + 5 puntos por cada examen aprobado (≥70%).
        </p>

        {miPosicion != null && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <MiniStat icon={<Crown width={18} height={18} />} display={`#${miPosicion}`} label="Tu posición" />
            <MiniStat icon={<Star width={18} height={18} />} value={misPuntos} label="Tus puntos" />
          </div>
        )}

        {loading && <p className="settings__muted">Cargando…</p>}
        {!loading && error && <p className="settings__error">{error}</p>}
        {!loading && !error && ranking.length === 0 && (
          <p className="settings__muted">Aún no hay nadie en el ranking — sé el primero en activar tu perfil.</p>
        )}

        {!loading && !error && ranking.length > 0 && (
          <div className="flex flex-col gap-2.5">
            {ranking.map((p, i) => {
              const esYo = p.user_id === user?.id;
              const iniciales = (p.nombre_publico || '?')
                .trim()
                .split(/\s+/)
                .slice(0, 2)
                .map((s) => s[0])
                .join('')
                .toUpperCase();
              return (
                <div
                  key={p.user_id}
                  className={
                    'flex items-center gap-4 rounded-xl border px-4 py-3 transition-all duration-200 ' +
                    (esYo
                      ? 'border-accent bg-accent-weak'
                      : i === 0
                        ? 'border-[var(--pro-border)] bg-[var(--pro-weak)]'
                        : 'border-border bg-surface hover:border-accent/20')
                  }
                >
                  <span
                    className={
                      'w-7 shrink-0 text-center text-sm font-black ' +
                      (i === 0 ? 'text-[var(--pro-strong)]' : 'text-ink-muted')
                    }
                  >
                    {i === 0 ? <Crown width={16} height={16} className="mx-auto" /> : `#${i + 1}`}
                  </span>
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent-gradient text-sm font-bold text-white">
                    {iniciales}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold text-ink">{p.nombre_publico || 'Sin nombre'}</div>
                    {p.especialidad && <div className="truncate text-xs text-ink-muted">{p.especialidad}</div>}
                  </div>
                  <span className="shrink-0 text-sm font-bold text-accent">{p.puntos} pts</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
