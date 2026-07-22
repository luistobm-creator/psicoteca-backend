import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronDown, Crown, Settings, LogOut, Sparkles, LayoutGrid } from './icons.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { startProCheckout, openBillingPortal } from '../lib/stripe.js';
import PlanSelector from './PlanSelector.jsx';

// Menú de cuenta del usuario autenticado. Todos los datos provienen del
// AuthContext (ya no hay usuario "quemado"). Solo se muestra cuando hay sesión;
// el Header decide cuándo renderizarlo.
export default function UserMenu() {
  const { user, plan, logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const isPro = plan === 'pro';

  // Estado del flujo de pago (upgrade a Pro vía Stripe Checkout).
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [checkoutError, setCheckoutError] = useState(null);
  const [billingInterval, setBillingInterval] = useState('annual');

  // Estado del portal de cliente (gestionar la suscripción en Stripe).
  const [portalLoading, setPortalLoading] = useState(false);
  const [portalError, setPortalError] = useState(null);

  // Aviso de "cold start": si una petición de pago tarda unos segundos, mostramos
  // una nota para que el usuario sepa que el servidor se está reactivando (y no que
  // la app se congeló). Solo uno de los dos flujos puede estar activo a la vez.
  const [slow, setSlow] = useState(false);
  const busy = checkoutLoading || portalLoading;

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

  // Muestra el aviso de "reactivando" tras un breve umbral mientras se espera al
  // backend (checkout o portal).
  useEffect(() => {
    if (!busy) {
      setSlow(false);
      return undefined;
    }
    const t = setTimeout(() => setSlow(true), 4000);
    return () => clearTimeout(t);
  }, [busy]);

  // Al cerrar el menú, resetear los estados de carga/error para que al reabrirlo los
  // botones estén frescos (evita que "Redirigiendo a Stripe…" quede pegado si una
  // petición previa se colgó durante un cold start de Render).
  useEffect(() => {
    if (open) return undefined;
    setCheckoutLoading(false);
    setCheckoutError(null);
    setPortalLoading(false);
    setPortalError(null);
    return undefined;
  }, [open]);

  // "Mejorar a Pro": pide al backend una sesión de Checkout y redirige a Stripe.
  const handleUpgrade = async () => {
    setCheckoutError(null);
    setCheckoutLoading(true);
    try {
      // Si tiene éxito, el navegador navega a Stripe y no vuelve aquí.
      await startProCheckout(billingInterval);
    } catch (err) {
      setCheckoutError(err.message || 'No se pudo iniciar el pago.');
      setCheckoutLoading(false);
    }
  };

  // "Gestionar plan Pro": abre el portal de cliente de Stripe (gestionar/cancelar).
  const handleManagePlan = async () => {
    setPortalError(null);
    setPortalLoading(true);
    try {
      // Si tiene éxito, el navegador navega a Stripe y no vuelve aquí.
      await openBillingPortal();
    } catch (err) {
      setPortalError(err.message || 'No se pudo abrir el portal de pagos.');
      setPortalLoading(false);
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
              <PlanSelector value={billingInterval} onChange={setBillingInterval} />
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
              {checkoutLoading && slow && (
                <div className="usermenu__hint" role="status">
                  El servidor está reactivándose… esto puede tardar unos segundos.
                </div>
              )}
              {checkoutError && (
                <div className="usermenu__error" role="alert">
                  {checkoutError}
                </div>
              )}
            </>
          ) : (
            <>
              <button
                type="button"
                className="usermenu__item"
                onClick={handleManagePlan}
                disabled={portalLoading}
                role="menuitem"
              >
                <Crown width={16} height={16} />
                {portalLoading ? 'Abriendo portal…' : 'Gestionar plan Pro'}
              </button>
              {portalLoading && slow && (
                <div className="usermenu__hint" role="status">
                  El servidor está reactivándose… esto puede tardar unos segundos.
                </div>
              )}
              {portalError && (
                <div className="usermenu__error" role="alert">
                  {portalError}
                </div>
              )}
            </>
          )}

          <div className="usermenu__sep" />

          <button
            type="button"
            className="usermenu__item"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              navigate('/app/perfil');
            }}
          >
            <LayoutGrid width={16} height={16} />
            Menú completo
          </button>
          <button
            type="button"
            className="usermenu__item"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              navigate('/configuracion');
            }}
          >
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
