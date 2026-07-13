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

// Tope de espera para las peticiones de pago (ms). El backend en Render (free) se
// "duerme" y puede tardar en reactivarse; con este timeout la petición nunca queda
// colgada para siempre: si expira, se lanza un error claro para reintentar.
const BILLING_TIMEOUT_MS = 60000;

// Petición POST autenticada al backend de pagos. Adjunta el token de Supabase,
// normaliza los errores a Error(mensaje en español) y devuelve el JSON de la
// respuesta. `loginError` es el mensaje que se lanza si no hay sesión activa.
async function billingRequest(path, { body, loginError } = {}) {
  // 1) Token del usuario actual de Supabase.
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const accessToken = session?.access_token;
  if (!accessToken) {
    throw new Error(loginError || 'Debes iniciar sesión para continuar.');
  }

  // 2) Llamar al backend enviando el token. Con timeout (AbortController) para no
  //    quedarnos colgados si Render está reactivándose (cold start).
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), BILLING_TIMEOUT_MS);
  let res;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
  } catch (err) {
    if (err?.name === 'AbortError') {
      throw new Error(
        'El servidor de pagos tardó demasiado en responder (puede estar ' +
          'reactivándose). Inténtalo de nuevo en unos segundos.'
      );
    }
    throw new Error('No se pudo conectar con el servidor de pagos.');
  } finally {
    clearTimeout(timeout);
  }

  if (!res.ok) {
    let detail = `HTTP ${res.status}`;
    try {
      const data = await res.json();
      if (data?.detail) detail = data.detail;
    } catch {
      /* respuesta sin cuerpo JSON */
    }
    throw new Error(detail);
  }

  return res.json();
}

/**
 * Inicia el Checkout de Stripe para mejorar a Pro y redirige el navegador a la
 * página de pago. `interval` elige el Price ('annual' por defecto, o 'monthly').
 * Si todo va bien, la función no "retorna" (la pestaña navega a Stripe). Lanza
 * Error (mensaje en español) si algo falla antes de redirigir.
 */
export async function startProCheckout(interval = 'annual') {
  const data = await billingRequest('/api/create-checkout-session', {
    body: { interval },
    loginError: 'Debes iniciar sesión para mejorar a Pro.',
  });

  // Redirigir a Stripe. Preferimos la URL de la sesión (recomendado por Stripe);
  // si el backend solo devuelve el id, usamos Stripe.js como respaldo.
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

/**
 * Abre el portal de cliente de Stripe (gestionar la suscripción: método de pago,
 * facturas, cancelar/reactivar) y redirige el navegador a él. Lanza Error (en
 * español) si el usuario no tiene una suscripción de Stripe o algo falla antes
 * de redirigir.
 */
export async function openBillingPortal() {
  const data = await billingRequest('/api/create-portal-session', {
    loginError: 'Debes iniciar sesión para gestionar tu plan.',
  });
  if (data.url) {
    window.location.href = data.url;
    return;
  }
  throw new Error('Respuesta inválida del servidor de pagos.');
}
