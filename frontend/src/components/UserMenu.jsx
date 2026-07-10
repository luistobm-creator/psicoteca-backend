import { useEffect, useRef, useState } from 'react';
import { ChevronDown, Crown, Settings, LogOut, Sparkles } from './icons.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { startProCheckout } from '../lib/stripe.js';

// Menú de cuenta del usuario autenticado. Todos los datos provienen del
// AuthContext (ya no hay usuario "quemado"). Solo se muestra cuando hay sesión;
// el Header decide cuándo renderizarlo.
export default function UserMenu() {
  const { user, plan, logout, togglePlan } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const isPro = plan === 'pro';

  // Estado del flujo de pago (upgrade a Pro vía Stripe Checkout).
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [checkoutError, setCheckoutError] = useState(null);

  // Cerrar al hacer clic fuera o con Escape.
  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  // "Mejorar a Pro": pide al backend una sesión de Checkout y redirige a Stripe.
  const handleUpgrade = async () => {
    setCheckoutError(null);
    setCheckoutLoading(true);
    try {
      // Si tiene éxito, el navegador navega a Stripe y no vuelve aquí.
      await startProCheckout();
    } catch (err) {
      setCheckoutError(err.message || 'No se pudo iniciar el pago.');
      setCheckoutLoading(false);
    }
  };

  if (!user) return null;

  return (
    <div className="usermenu" ref={ref}>
      <button
        type="button"
        className={'usermenu__trigger' + (open ? ' is-open' : '')}
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        title={user.name}
      >
        <span className="avatar" aria-hidden="true">
          {user.initials}
          {isPro && (
            <span className="avatar__ring" title="Plan Pro">
              <Crown width={10} height={10} />
            </span>
          )}
        </span>
        <span className={'plan-chip plan-chip--' + (isPro ? 'pro' : 'free')}>
          {isPro ? 'Pro' : 'Free'}
        </span>
        <ChevronDown className="usermenu__caret" width={15} height={15} />
      </button>

      {open && (
        <div className="usermenu__panel" role="menu">
          <div className="usermenu__head">
            <span className="avatar avatar--lg" aria-hidden="true">
              {user.initials}
            </span>
            <div className="usermenu__id">
              <div className="usermenu__name">{user.name}</div>
              <div className="usermenu__email">{user.email}</div>
            </div>
          </div>

          <div className={'planpill planpill--' + (isPro ? 'pro' : 'free')}>
            <span className="planpill__label">
              {isPro ? 'Plan Pro' : 'Plan Free'}
            </span>
            <span className="planpill__note">
              {isPro ? 'Acceso completo' : 'Acceso a la biblioteca base'}
            </span>
          </div>

          {!isPro ? (
            <>
              <button
                type="button"
                className="usermenu__upgrade"
                onClick={handleUpgrade}
                disabled={checkoutLoading}
                role="menuitem"
              >
                <Sparkles width={16} height={16} />
                {checkoutLoading ? 'Redirigiendo a Stripe…' : 'Mejorar a Pro'}
              </button>
              {checkoutError && (
                <div className="usermenu__error" role="alert">
                  {checkoutError}
                </div>
              )}
            </>
          ) : (
            <button
              type="button"
              className="usermenu__item"
              onClick={() => {
                togglePlan();
                setOpen(false);
              }}
              role="menuitem"
            >
              <Crown width={16} height={16} />
              Gestionar plan Pro
            </button>
          )}

          <div className="usermenu__sep" />

          <button type="button" className="usermenu__item" role="menuitem">
            <Settings width={16} height={16} />
            Configuración
          </button>
          <button
            type="button"
            className="usermenu__item"
            onClick={() => {
              logout();
              setOpen(false);
            }}
            role="menuitem"
          >
            <LogOut width={16} height={16} />
            Cerrar sesión
          </button>
        </div>
      )}
    </div>
  );
}
