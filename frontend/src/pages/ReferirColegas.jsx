import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Check, Library, Share, Users } from '../components/icons.jsx';
import { useAuth } from '../context/AuthContext.jsx';

const CARD =
  'group relative overflow-hidden rounded-2xl border border-border bg-surface shadow-sm ' +
  'transition-all duration-300 hover:-translate-y-1 hover:border-accent/30 hover:shadow-lift dark:hover:shadow-lift-dark';

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

        <div className={CARD + ' flex items-start gap-4 p-4'}>
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-accent-gradient text-white shadow-sm">
            <Users width={20} height={20} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-ink-muted">Tu enlace de invitación</p>
            <div className="mt-2 break-all rounded-lg border border-border-strong bg-bg px-3 py-2.5 text-sm text-ink">
              {enlace}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2.5">
          <button
            type="button"
            onClick={handleCopiar}
            className="inline-flex items-center gap-2 rounded-xl bg-accent-gradient px-4 py-2.5 text-sm font-bold text-white shadow-[0_2px_10px_-2px_var(--accent-soft)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_6px_18px_-4px_var(--accent-soft)] active:translate-y-0"
          >
            {copiado ? (
              <>
                <Check width={15} height={15} /> ¡Copiado!
              </>
            ) : (
              'Copiar enlace'
            )}
          </button>
          {typeof navigator !== 'undefined' && navigator.share && (
            <button
              type="button"
              onClick={handleCompartir}
              className="inline-flex items-center gap-2 rounded-xl border border-border px-4 py-2.5 text-sm font-semibold text-ink-muted transition-colors duration-150 hover:border-accent/40 hover:text-accent"
            >
              <Share width={15} height={15} />
              Compartir
            </button>
          )}
        </div>

        <p className="text-sm text-ink-muted">
          Es un enlace de invitación simple: por ahora no llevamos un conteo de referidos ni recompensas.
        </p>
      </div>
    </div>
  );
}
