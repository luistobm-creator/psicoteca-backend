"""
Rutas de pagos (Stripe + Supabase).

POST /api/create-checkout-session
  Crea una sesión de Stripe Checkout para suscribir al usuario al plan Pro. El
  importe y la moneda (MXN) los define el Price en Stripe, no este código.
    - El frontend envía el access_token de Supabase en `Authorization: Bearer …`.
    - Validamos el token contra Supabase (/auth/v1/user) y obtenemos id + email.
    - Creamos la sesión en modo "subscription" para el Price configurado, guardando
      el id de usuario de Supabase en el metadata (y en client_reference_id y en el
      metadata de la suscripción) para que el webhook sepa a quién activar el Pro.
    - Devolvemos {url, id}; el frontend redirige a Stripe.

POST /api/webhook
  Recibe los eventos de Stripe. Ante `checkout.session.completed`, verifica la
  firma, lee `supabase_user_id` del metadata y activa el plan Pro del usuario
  (escribe `plan: "pro"` en su app_metadata vía la Admin API de Supabase).

Nota: el módulo se llama `billing` (no `stripe`) a propósito, para no ensombrecer
el paquete `import stripe`.
"""
from __future__ import annotations

import json
import logging

import requests
import stripe
from fastapi import APIRouter, Header, HTTPException, Request

from app.config import settings

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api", tags=["billing"])


def _require(value: str | None, name: str) -> str:
    if not value:
        raise HTTPException(
            status_code=500,
            detail=f"Configuración de pagos incompleta: falta {name}.",
        )
    return value


def _supabase_user(authorization: str | None) -> dict:
    """Valida el Bearer token contra Supabase y devuelve el usuario ({id, email, ...})."""
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="Falta el token de autenticación.")
    token = authorization.split(" ", 1)[1].strip()

    base = _require(settings.supabase_url, "SUPABASE_URL").rstrip("/")
    anon = _require(settings.supabase_anon_key, "SUPABASE_ANON_KEY")
    try:
        resp = requests.get(
            f"{base}/auth/v1/user",
            headers={"apikey": anon, "Authorization": f"Bearer {token}"},
            timeout=10,
        )
    except requests.RequestException:
        raise HTTPException(status_code=502, detail="No se pudo validar la sesión con Supabase.")

    if resp.status_code != 200:
        raise HTTPException(status_code=401, detail="Sesión inválida o expirada.")
    user = resp.json()
    if not user.get("id"):
        raise HTTPException(status_code=401, detail="No se pudo identificar al usuario.")
    return user


def _set_supabase_plan_pro(user_id: str) -> None:
    """Marca a un usuario como Pro escribiendo `plan: "pro"` en su app_metadata.

    Se usa app_metadata (NO user_metadata) porque es controlado por el servidor:
    el usuario no puede modificarlo desde el cliente. Para escribirlo hace falta
    la SERVICE ROLE key (la anon no puede tocar a otros usuarios), llamando a la
    Admin API de Supabase. Supabase fusiona las claves de app_metadata, así que
    no se pierde `provider`/`providers` ni otros campos existentes.
    """
    base = _require(settings.supabase_url, "SUPABASE_URL").rstrip("/")
    service_key = _require(
        settings.supabase_service_role_key, "SUPABASE_SERVICE_ROLE_KEY"
    )
    try:
        resp = requests.put(
            f"{base}/auth/v1/admin/users/{user_id}",
            headers={
                "apikey": service_key,
                "Authorization": f"Bearer {service_key}",
                "Content-Type": "application/json",
            },
            json={"app_metadata": {"plan": "pro"}},
            timeout=10,
        )
    except requests.RequestException:
        raise HTTPException(
            status_code=502, detail="No se pudo actualizar el plan en Supabase."
        )
    if resp.status_code not in (200, 201):
        # Log del detalle (solo servidor) para diagnosticar rechazos del Admin API.
        logger.error(
            "Supabase Admin API %s al fijar el plan Pro: %s",
            resp.status_code,
            resp.text[:300],
        )
        raise HTTPException(
            status_code=502,
            detail=(
                "Supabase rechazó la actualización del plan "
                f"(HTTP {resp.status_code})."
            ),
        )


@router.post(
    "/create-checkout-session",
    summary="Crea una sesión de Stripe Checkout para el plan Pro (suscripción)",
)
def create_checkout_session(authorization: str | None = Header(default=None)) -> dict:
    # 1) Identificar al usuario a partir del token de Supabase.
    user = _supabase_user(authorization)
    user_id = user["id"]
    user_email = user.get("email")

    # 2) Configurar Stripe.
    stripe.api_key = _require(settings.stripe_secret_key, "STRIPE_SECRET_KEY")
    price_id = _require(settings.stripe_price_id, "STRIPE_PRICE_ID")

    # 3) Crear la sesión de Checkout (modo suscripción).
    try:
        session = stripe.checkout.Session.create(
            mode="subscription",
            line_items=[{"price": price_id, "quantity": 1}],
            customer_email=user_email,                       # prefill + asociación
            client_reference_id=user_id,                     # id de Supabase (campo nativo)
            metadata={"supabase_user_id": user_id},          # ← VITAL (lo pediste)
            subscription_data={"metadata": {"supabase_user_id": user_id}},
            success_url=f"{settings.frontend_base_url}/app?checkout=success",
            cancel_url=f"{settings.frontend_base_url}/app?checkout=cancel",
            allow_promotion_codes=True,
        )
    except stripe.error.StripeError as exc:
        raise HTTPException(status_code=502, detail=f"Error de Stripe: {exc.user_message or str(exc)}")

    # 4) Devolver la URL (y el id) para que el frontend redirija.
    return {"url": session.url, "id": session.id}


@router.post(
    "/webhook",
    summary="Webhook de Stripe: activa el plan Pro tras un pago exitoso",
)
async def stripe_webhook(request: Request) -> dict:
    """Recibe los eventos de Stripe y, ante `checkout.session.completed`, activa
    el plan Pro del usuario correspondiente.

    Seguridad: se verifica la FIRMA del evento con STRIPE_WEBHOOK_SECRET usando el
    cuerpo CRUDO tal cual llegó (no un JSON re-serializado). Así garantizamos que
    el evento viene de Stripe y no fue manipulado; sin esto, cualquiera podría
    hacer POST y regalarse el plan Pro.
    """
    # 1) Cuerpo crudo + cabecera de firma.
    payload = await request.body()
    sig_header = request.headers.get("stripe-signature")
    webhook_secret = _require(settings.stripe_webhook_secret, "STRIPE_WEBHOOK_SECRET")

    # 2) Verificar autenticidad e integridad del evento (firma).
    try:
        stripe.Webhook.construct_event(payload, sig_header, webhook_secret)
    except ValueError:
        # Cuerpo ilegible / no es JSON de Stripe.
        raise HTTPException(status_code=400, detail="Payload inválido.")
    except stripe.error.SignatureVerificationError:
        raise HTTPException(status_code=400, detail="Firma de webhook inválida.")

    # Ya verificada la firma, leemos los campos desde el JSON CRUDO (dicts planos).
    # IMPORTANTE: en stripe-python 15.x el objeto del evento es un StripeObject que
    # NO expone .get() como un dict → usar json.loads(payload) evita el
    # AttributeError y es más robusto.
    event = json.loads(payload)

    # 3) Solo actuamos ante el pago completado del Checkout.
    if event.get("type") == "checkout.session.completed":
        session = event.get("data", {}).get("object", {})
        # id de Supabase que guardamos al crear la sesión (metadata). Respaldo en
        # client_reference_id, que también rellenamos al crear el Checkout.
        metadata = session.get("metadata") or {}
        user_id = metadata.get("supabase_user_id") or session.get("client_reference_id")
        if not user_id:
            # Sin id no podemos activar a nadie. Devolvemos 200 (no 4xx/5xx) para
            # que Stripe NO reintente un evento que nunca podrá resolverse.
            logger.warning(
                "checkout.session.completed sin supabase_user_id; se ignora."
            )
            return {"received": True, "updated": False}

        # Idempotente: fijar el plan Pro varias veces es inofensivo (Stripe puede
        # reenviar el mismo evento).
        _set_supabase_plan_pro(user_id)
        logger.info("Plan Pro activado para el usuario %s.", user_id)
        return {"received": True, "updated": True}

    # 4) Otros eventos: acuse de recibo sin efectos.
    return {"received": True}
