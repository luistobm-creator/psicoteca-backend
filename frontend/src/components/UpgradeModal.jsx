import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Lock, Sparkles, X } from './icons.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { startProCheckout } from '../lib/stripe.js';

// Modal que aparece cuando un usuario sin plan Pro intenta abrir contenido Pro.
// Ofrece el flujo de "Mejorar a Pro" (o iniciar sesión, si es anónimo).
export default function UpgradeModal({ item, onClose, reason = 'content' }) {
  const { isAuthenticated } = useAuth();
  const isDownload = reason === 'download';
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const handleUpgrade = async () => {
    setError(null);
    setLoading(true);
    try {
      // Si tiene éxito, el navegador navega a Stripe y no vuelve aquí.
      await startProCheckout();
    } catch (err) {
      setError(err.message || 'No se pudo iniciar el pago.');
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose} role="presentation">
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="upgrade-title"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          className="modal__close"
          onClick={onClose}
          aria-label="Cerrar"
        >
          <X width={18} height={18} />
        </button>

        <div className="modal__badge" aria-hidden="true">
          <Lock width={22} height={22} />
        </div>

        <h2 id="upgrade-title" className="modal__title">
          {isDownload ? 'Descargas exclusivas de Pro' : 'Contenido exclusivo Pro'}
        </h2>
        <p className="modal__text">
          {isDownload ? (
            <>
              La <strong>lectura online</strong> es gratis, pero las{' '}
              <strong>descargas de PDF</strong> son parte del plan Pro. Mejóralo para
              descargar sin límite a tu dispositivo.
            </>
          ) : (
            <>
              {item?.name && (
                <>
                  <strong>{item.name}</strong>{' '}
                  {item.is_folder ? 'es una carpeta Pro. ' : 'es un documento Pro. '}
                </>
              )}
              Mejora tu plan para desbloquear la biblioteca completa.
            </>
          )}
        </p>

        {isAuthenticated ? (
          <>
            <button
              type="button"
              className="modal__cta"
              onClick={handleUpgrade}
              disabled={loading}
            >
              <Sparkles width={16} height={16} />
              {loading ? 'Redirigiendo a Stripe…' : 'Mejorar a Pro'}
            </button>
            {error && (
              <div className="modal__error" role="alert">
                {error}
              </div>
            )}
          </>
        ) : (
          <>
            <Link to="/register" className="modal__cta" onClick={onClose}>
              <Sparkles width={16} height={16} />
              Crear cuenta para mejorar a Pro
            </Link>
            <p className="modal__alt">
              ¿Ya tienes cuenta?{' '}
              <Link to="/login" className="modal__altlink" onClick={onClose}>
                Iniciar sesión
              </Link>
            </p>
          </>
        )}

        <button type="button" className="modal__dismiss" onClick={onClose}>
          Ahora no
        </button>
      </div>
    </div>
  );
}
