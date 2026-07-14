import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { openBillingPortal } from '../lib/stripe.js';
import { deleteAccount } from '../api.js';
import {
  ArrowLeft,
  Library,
  Crown,
  Sparkles,
  Trash,
  AlertTriangle,
} from '../components/icons.jsx';

// Pantalla de Configuración (/configuracion). Reúne la gestión de la cuenta:
// datos básicos, acceso al portal de Stripe (suscripción) y el borrado de cuenta.
// Es una página independiente (como Login/Register), protegida: sin sesión
// redirige a /login.
export default function Settings() {
  const { user, plan, isAuthenticated, loading, logout } = useAuth();
  const navigate = useNavigate();
  const isPro = plan === 'pro';

  // Guard de sesión: si no hay usuario (y ya terminó de restaurar), al login.
  useEffect(() => {
    if (!loading && !isAuthenticated) navigate('/login', { replace: true });
  }, [loading, isAuthenticated, navigate]);

  // --- Portal de Stripe (gestionar/cancelar suscripción) ---
  const [portalLoading, setPortalLoading] = useState(false);
  const [portalError, setPortalError] = useState(null);
  const handlePortal = async () => {
    setPortalError(null);
    setPortalLoading(true);
    try {
      // Si va bien, el navegador navega a Stripe y no vuelve aquí.
      await openBillingPortal();
    } catch (err) {
      setPortalError(err.message || 'No se pudo abrir el portal de pagos.');
      setPortalLoading(false);
    }
  };

  // --- Borrar cuenta (con confirmación escribiendo el correo) ---
  const [confirmText, setConfirmText] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState(null);
  const canDelete = useMemo(() => {
    const email = (user?.email || '').trim().toLowerCase();
    return !!email && confirmText.trim().toLowerCase() === email;
  }, [confirmText, user]);

  const handleDelete = async () => {
    if (!canDelete || deleting) return;
    setDeleteError(null);
    setDeleting(true);
    try {
      await deleteAccount();
      // Cuenta borrada: la sesión ya no vale → cerrar sesión y volver a la landing.
      await logout();
      navigate('/', { replace: true });
    } catch (err) {
      setDeleteError(err.message || 'No se pudo borrar la cuenta.');
      setDeleting(false);
    }
  };

  // Evita un parpadeo de contenido antes de que actúe el guard.
  if (loading || !user) return null;

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
          <Link to="/app" className="settings__back">
            <ArrowLeft width={15} height={15} />
            Volver a la biblioteca
          </Link>
        </div>

        <header className="settings__head">
          <h1 className="settings__title">Configuración</h1>
          <p className="settings__subtitle">Gestiona tu cuenta y tu suscripción.</p>
        </header>

        {/* --- Cuenta --- */}
        <section className="settings__card">
          <h2 className="settings__cardtitle">Cuenta</h2>
          <div className="settings__row">
            <span className="settings__label">Correo</span>
            <span className="settings__value">{user.email}</span>
          </div>
          <div className="settings__row">
            <span className="settings__label">Plan</span>
            <span className={'plan-chip plan-chip--' + (isPro ? 'pro' : 'free')}>
              {isPro ? 'Pro' : 'Free'}
            </span>
          </div>
        </section>

        {/* --- Suscripción --- */}
        <section className="settings__card">
          <h2 className="settings__cardtitle">Suscripción</h2>
          {isPro ? (
            <>
              <p className="settings__muted">
                Gestiona tu método de pago, consulta tus facturas o cancela tu
                plan desde el portal seguro de Stripe.
              </p>
              <button
                type="button"
                className="settings__btn"
                onClick={handlePortal}
                disabled={portalLoading}
              >
                <Crown width={16} height={16} />
                {portalLoading ? 'Abriendo portal…' : 'Gestionar suscripción'}
              </button>
              {portalError && (
                <div className="settings__error" role="alert">
                  {portalError}
                </div>
              )}
            </>
          ) : (
            <>
              <p className="settings__muted">
                Estás en el plan <strong>Free</strong> (acceso a la biblioteca
                base). Mejora a Pro para desbloquear la biblioteca completa.
              </p>
              <Link to="/" className="settings__btn settings__btn--accent">
                <Sparkles width={16} height={16} />
                Ver planes Pro
              </Link>
            </>
          )}
        </section>

        {/* --- Zona de peligro --- */}
        <section className="settings__card settings__card--danger">
          <h2 className="settings__cardtitle settings__cardtitle--danger">
            <AlertTriangle width={16} height={16} />
            Zona de peligro
          </h2>
          <p className="settings__muted">
            Borrar tu cuenta es <strong>permanente e irreversible</strong>: se
            eliminan tu perfil y tus favoritos.
            {isPro &&
              ' Tu suscripción Pro se cancelará automáticamente para que no se te vuelva a cobrar.'}
          </p>
          <label className="settings__confirm">
            <span className="settings__label">
              Escribe tu correo (<code>{user.email}</code>) para confirmar
            </span>
            <input
              className="settings__input"
              type="email"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder={user.email}
              autoComplete="off"
              autoCapitalize="off"
              spellCheck="false"
            />
          </label>
          <button
            type="button"
            className="settings__btn settings__btn--danger"
            onClick={handleDelete}
            disabled={!canDelete || deleting}
          >
            <Trash width={16} height={16} />
            {deleting ? 'Borrando cuenta…' : 'Borrar mi cuenta'}
          </button>
          {deleteError && (
            <div className="settings__error" role="alert">
              {deleteError}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
