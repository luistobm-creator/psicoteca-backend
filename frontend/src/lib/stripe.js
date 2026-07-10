// Integración con Stripe Checkout para el upgrade a Pro (cobros en MXN).
//
// Flujo:
//   1) El usuario (autenticado en Supabase) pulsa "Mejorar a Pro".
//   2) Pedimos al backend (POST /api/create-checkout-session) que cree una sesión
//      de Checkout, enviando el access_token de Supabase (Authorization: Bearer …)
//      para identificar al usuario.
//   3) El backend valida el token, guarda el id de usuario en el metadata de la
//      sesión de Stripe y responde con la URL (y el id) del Checkout.
//   4) Redirigimos el navegador a esa URL de Stripe.
//
// La PUBLISHABLE key (VITE_STRIPE_PUBLIC_KEY) es pública: puede ir en el bundle.
// La SECRET key nunca toca el frontend; vive solo en el backend.

import { loadStripe } from '@stripe/stripe-js';
import { supabase } from './supabaseClient.js';

// Mismo criterio que api.js: rutas relativas en dev (proxy de Vite) o VITE_API_BASE.
const API_BASE = import.meta.env.VITE_API_BASE ?? '';
const STRIPE_PUBLIC_KEY = import.meta.env.VITE_STRIPE_PUBLIC_KEY;

// loadStripe carga el script de Stripe una sola vez; memorizamos la promesa.
let stripePromise = null;
export function getStripe() {
  if (!STRIPE_PUBLIC_KEY) {
    console.error(
      '[Stripe] Falta VITE_STRIPE_PUBLIC_KEY. Revisa frontend/.env.local.'
    );
    return Promise.resolve(null);
  }
  if (!stripePromise) stripePromise = loadStripe(STRIPE_PUBLIC_KEY);
  return stripePromise;
}

/**
 * Inicia el Checkout de Stripe para mejorar a Pro y redirige el navegador a la
 * página de pago. Si todo va bien, la función no "retorna" (la pestaña navega a
 * Stripe). Lanza Error (mensaje en español) si algo falla antes de redirigir.
 */
export async function startProCheckout() {
  // 1) Token del usuario actual de Supabase.
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const accessToken = session?.access_token;
  if (!accessToken) {
    throw new Error('Debes iniciar sesión para mejorar a Pro.');
  }

  // 2) Pedir la sesión de Checkout al backend (enviando el token).
  let res;
  try {
    res = await fetch(`${API_BASE}/api/create-checkout-session`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
    });
  } catch {
    throw new Error('No se pudo conectar con el servidor de pagos.');
  }

  if (!res.ok) {
    let detail = `HTTP ${res.status}`;
    try {
      const body = await res.json();
      if (body?.detail) detail = body.detail;
    } catch {
      /* respuesta sin cuerpo JSON */
    }
    throw new Error(detail);
  }

  const data = await res.json();

  // 3) Redirigir a Stripe. Preferimos la URL de la sesión (recomendado por
  //    Stripe); si el backend solo devuelve el id, usamos Stripe.js como respaldo.
  if (data.url) {
    window.location.href = data.url;
    return;
  }
  if (data.id) {
    const stripe = await getStripe();
    if (!stripe) throw new Error('No se pudo inicializar Stripe.');
    const { error } = await stripe.redirectToCheckout({ sessionId: data.id });
    if (error) throw new Error(error.message || 'No se pudo abrir el Checkout.');
    return;
  }
  throw new Error('Respuesta inválida del servidor de pagos.');
}
