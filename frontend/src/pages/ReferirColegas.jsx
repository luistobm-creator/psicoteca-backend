import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Check, Library, Share, Users } from '../components/icons.jsx';
import { useAuth } from '../context/AuthContext.jsx';

// Código corto y estable derivado del propio user_id (sin tabla nueva: no hay
// nada que trackear todavía, es solo un identificador legible para el enlace).
function codigoDe(userId) {
  return (userId || '').replace(/-/g, '').slice(0, 8).toUpperCase();
}

// Refiere colegas: enlace de invitación personal. 100% frontend — se deriva
// del propio usuario autenticado, sin tabla nueva. Es honestamente solo un
// enlace para compartir: no hay conteo de referidos ni recompensas todavía
// (eso implicaría un backend de atribución que no existe).
export default function ReferirColegas() {
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!authLoading && !isAuthenticated) navigate('/login', { replace: true });
  }, [authLoading, isAuthenticated, navigate]);

  const [copiado, setCopiado] = useState(false);

  const codigo = useMemo(() => codigoDe(user?.id), [user?.id]);
  const enlace = useMemo(
    () => `${window.location.origin}/register?ref=${codigo}`,
    [codigo]
  );
  const mensaje = `Te comparto Psicoteca, la biblioteca clínica que uso para estudiar y llevar mi consulta: ${enlace}`;

  const handleCopiar = async () => {
    try {
      await navigator.clipboard.writeText(enlace);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      /* sin permiso de portapapeles: el usuario puede seleccionar el texto a mano */
    }
  };

  const handleCompartir = () => {
    navigator.share({ title: 'Psicoteca', text: mensaje, url: enlace }).catch(() => {});
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
            <h1 className="settings__title">Refiere colegas</h1>
            <p className="settings__subtitle">Invita a otros psicólogos a unirse a Psicoteca con tu enlace personal.</p>
          </div>
        </header>

        <div className="referidos__card">
          <div className="referidos__icon">
            <Users width={22} height={22} />
          </div>
          <div style={{ flex: '1 1 auto', minWidth: 0 }}>
            <p className="settings__label" style={{ marginBottom: 6 }}>
              Tu enlace de invitación
            </p>
            <div className="apa-preview" style={{ wordBreak: 'break-all' }}>
              {enlace}
            </div>
          </div>
        </div>

        <div className="modal__actions" style={{ justifyContent: 'flex-start', marginTop: 14 }}>
          <button type="button" className="settings__btn settings__btn--accent" onClick={handleCopiar}>
            {copiado ? (
              <>
                <Check width={15} height={15} /> ¡Copiado!
              </>
            ) : (
              'Copiar enlace'
            )}
          </button>
          {typeof navigator !== 'undefined' && navigator.share && (
            <button type="button" className="settings__btn" onClick={handleCompartir}>
              <Share width={15} height={15} />
              Compartir
            </button>
          )}
        </div>

        <p className="settings__muted" style={{ marginTop: 18 }}>
          Es un enlace de invitación simple: por ahora no llevamos un conteo de referidos ni recompensas.
        </p>
      </div>
    </div>
  );
}
