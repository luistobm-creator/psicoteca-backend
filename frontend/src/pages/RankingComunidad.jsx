import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Crown, Library } from '../components/icons.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useComunidadPerfil } from '../lib/useComunidadPerfil.js';
import PerfilComunidadForm from '../components/PerfilComunidadForm.jsx';
import * as api from '../api.js';

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

        <p className="settings__muted" style={{ marginBottom: 14 }}>
          Puntaje: 1 punto por cada término de tu Glosario clínico + 5 puntos por cada examen aprobado (≥70%).
        </p>

        {loading && <p className="settings__muted">Cargando…</p>}
        {!loading && error && <p className="settings__error">{error}</p>}
        {!loading && !error && ranking.length === 0 && (
          <p className="settings__muted">Aún no hay nadie en el ranking — sé el primero en activar tu perfil.</p>
        )}

        {!loading && !error && ranking.length > 0 && (
          <div className="ranking__list">
            {ranking.map((p, i) => (
              <div key={p.user_id} className={'ranking__row' + (p.user_id === user?.id ? ' is-me' : '')}>
                <span className="ranking__pos">{i === 0 ? <Crown width={16} height={16} /> : `#${i + 1}`}</span>
                <div className="persona__avatar">
                  {(p.nombre_publico || '?')
                    .trim()
                    .split(/\s+/)
                    .slice(0, 2)
                    .map((s) => s[0])
                    .join('')
                    .toUpperCase()}
                </div>
                <div className="persona__body">
                  <div className="persona__nombre">{p.nombre_publico || 'Sin nombre'}</div>
                  {p.especialidad && <div className="persona__especialidad">{p.especialidad}</div>}
                </div>
                <span className="ranking__puntos">{p.puntos} pts</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
