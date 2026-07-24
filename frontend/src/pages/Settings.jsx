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
        <section className="rounded-2xl border border-border bg-surface p-6 shadow-sm transition-all duration-300 hover:border-accent/30 hover:shadow-lift dark:hover:shadow-lift-dark">
          <h2 className="text-base font-bold text-ink">Cuenta</h2>
          <div className="mt-3 flex items-center justify-between gap-3">
            <span className="text-sm text-ink-muted">Correo</span>
            <span className="text-sm font-semibold text-ink">{user.email}</span>
          </div>
          <div className="mt-3 flex items-center justify-between gap-3">
            <span className="text-sm text-ink-muted">Plan</span>
            <span className={'plan-chip plan-chip--' + (isPro ? 'pro' : 'free')}>
              {isPro ? 'Pro' : 'Free'}
            </span>
          </div>
        </section>

        {/* --- Suscripción --- */}
        <section className="rounded-2xl border border-border bg-surface p-6 shadow-sm transition-all duration-300 hover:border-accent/30 hover:shadow-lift dark:hover:shadow-lift-dark">
          <h2 className="text-base font-bold text-ink">Suscripción</h2>
          {isPro ? (
            <>
              <p className="mt-2 text-sm text-ink-muted">
                Gestiona tu método de pago, consulta tus facturas o cancela tu
                plan desde el portal seguro de Stripe.
              </p>
              <button
                type="button"
                onClick={handlePortal}
                disabled={portalLoading}
                className="mt-3 inline-flex w-fit items-center gap-2 rounded-xl border border-border-strong bg-surface-2 px-4 py-2.5 text-sm font-semibold text-ink transition-colors duration-150 hover:border-accent/40 disabled:opacity-60"
              >
                <Crown width={16} height={16} />
                {portalLoading ? 'Abriendo portal…' : 'Gestionar suscripción'}
              </button>
              {portalError && (
                <div className="mt-2 text-sm text-danger" role="alert">
                  {portalError}
                </div>
              )}
            </>
          ) : (
            <>
              <p className="mt-2 text-sm text-ink-muted">
                Estás en el plan <strong>Free</strong> (acceso a la biblioteca
                base). Mejora a Pro para desbloquear la biblioteca completa.
              </p>
              <Link
                to="/"
                className="mt-3 inline-flex w-fit items-center gap-2 rounded-xl bg-accent-gradient px-4 py-2.5 text-sm font-bold text-white shadow-[0_2px_10px_-2px_var(--accent-soft)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_6px_18px_-4px_var(--accent-soft)]"
              >
                <Sparkles width={16} height={16} />
                Ver planes Pro
              </Link>
            </>
          )}
        </section>

        {/* --- Zona de peligro --- */}
        <section className="rounded-2xl border border-[var(--danger-border)] bg-[var(--danger-weak)] p-6 shadow-sm">
          <h2 className="flex items-center gap-2 text-base font-bold text-danger">
            <AlertTriangle width={16} height={16} />
            Zona de peligro
          </h2>
          <p className="mt-2 text-sm text-ink-muted">
            Borrar tu cuenta es <strong>permanente e irreversible</strong>: se
            eliminan tu perfil y tus favoritos.
            {isPro &&
              ' Tu suscripción Pro se cancelará automáticamente para que no se te vuelva a cobrar.'}
          </p>
          <label className="mt-4 flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-ink-muted">
              Escribe tu correo (<code className="font-bold text-ink">{user.email}</code>) para confirmar
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
            onClick={handleDelete}
            disabled={!canDelete || deleting}
            className="mt-3 inline-flex items-center gap-2 rounded-xl bg-danger px-4 py-2.5 text-sm font-bold text-white transition-[filter] duration-150 hover:brightness-110 disabled:opacity-50 disabled:hover:brightness-100"
          >
            <Trash width={16} height={16} />
            {deleting ? 'Borrando cuenta…' : 'Borrar mi cuenta'}
          </button>
          {deleteError && (
            <div className="mt-2 text-sm text-danger" role="alert">
              {deleteError}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
