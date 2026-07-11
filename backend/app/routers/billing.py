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


def _set_supabase_plan(user_id: str, plan: str, stripe_customer_id: str | None = None) -> None:
    """Fija el plan del usuario en `app_metadata.plan` (`"pro"` o `"free"`).

    Se usa app_metadata (NO user_metadata) porque es controlado por el servidor:
    el usuario no puede modificarlo desde el cliente. Para escribirlo hace falta
    la SERVICE ROLE key (la anon no puede tocar a otros usuarios), llamando a la
    Admin API de Supabase. Supabase fusiona las claves de app_metadata, así que
    no se pierde `provider`/`providers` ni otros campos existentes.

    Si se pasa `stripe_customer_id`, se guarda también en app_metadata: así el
    portal de cliente (gestionar la suscripción) localiza el Customer de Stripe
    directamente, sin depender de una búsqueda por email.
    """
    base = _require(settings.supabase_url, "SUPABASE_URL").rstrip("/")
    service_key = _require(
        settings.supabase_service_role_key, "SUPABASE_SERVICE_ROLE_KEY"
    )
    app_metadata: dict = {"plan": plan}
    if stripe_customer_id:
        app_metadata["stripe_customer_id"] = stripe_customer_id
    try:
        resp = requests.put(
            f"{base}/auth/v1/admin/users/{user_id}",
            headers={
                "apikey": service_key,
                "Authorization": f"Bearer {service_key}",
                "Content-Type": "application/json",
            },
            json={"app_metadata": app_metadata},
            timeout=10,
        )
    except requests.RequestException:
        raise HTTPException(
            status_code=502, detail="No se pudo actualizar el plan en Supabase."
        )
    if resp.status_code not in (200, 201):
        # Log del detalle (solo servidor) para diagnosticar rechazos del Admin API.
        logger.error(
            "Supabase Admin API %s al fijar el plan '%s': %s",
            resp.status_code,
            plan,
            resp.text[:300],
        )
        raise HTTPException(
            status_code=502,
            detail=(
                "Supabase rechazó la actualización del plan "
                f"(HTTP {resp.status_code})."
            ),
        )


def _price_for_interval(interval: str) -> str:
    """Devuelve el Price de Stripe según el intervalo de cobro solicitado.

    'monthly' → Price mensual; cualquier otro valor ('annual' por defecto) → Price
    anual. La fuente de verdad son los valores versionados en config.py
    (STRIPE_PRICE_ID_ANNUAL / STRIPE_PRICE_ID_MONTHLY); el legado STRIPE_PRICE_ID
    solo actúa de respaldo del anual si este quedara vacío.
    """
    if interval == "monthly":
        return _require(settings.stripe_price_id_monthly, "STRIPE_PRICE_ID_MONTHLY")
    return _require(
        settings.stripe_price_id_annual or settings.stripe_price_id,
        "STRIPE_PRICE_ID_ANNUAL",
    )


@router.post(
    "/create-checkout-session",
    summary="Crea una sesión de Stripe Checkout para el plan Pro (suscripción)",
)
async def create_checkout_session(
    request: Request, authorization: str | None = Header(default=None)
) -> dict:
    # 1) Identificar al usuario a partir del token de Supabase.
    user = _supabase_user(authorization)
    user_id = user["id"]
    user_email = user.get("email")

    # 2) Intervalo de cobro solicitado (cuerpo opcional {"interval": "annual"|"monthly"}).
    #    Sin cuerpo, cuerpo vacío o no-JSON → plan anual por defecto.
    interval = "annual"
    try:
        body = await request.json()
        if isinstance(body, dict) and body.get("interval"):
            interval = str(body["interval"]).strip().lower()
    except Exception:
        pass

    # 3) Configurar Stripe.
    stripe.api_key = _require(settings.stripe_secret_key, "STRIPE_SECRET_KEY")
    price_id = _price_for_interval(interval)

    # 4) Crear la sesión de Checkout (modo suscripción).
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

    # 5) Devolver la URL (y el id) para que el frontend redirija.
    return {"url": session.url, "id": session.id}


@router.post(
    "/webhook",
    summary="Webhook de Stripe: activa/desactiva el plan Pro según la suscripción",
)
async def stripe_webhook(request: Request) -> dict:
    """Recibe los eventos de Stripe y ajusta el plan del usuario en Supabase:
    `checkout.session.completed` activa Pro; `customer.subscription.deleted` (o
    `customer.subscription.updated` a estado canceled/unpaid) lo devuelve a Free.

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

        # id del Customer de Stripe: en modo suscripción llega como string en
        # `customer`. Lo guardamos para poder abrir el portal de cliente después.
        customer = session.get("customer")
        customer_id = customer if isinstance(customer, str) else None

        # Idempotente: fijar el plan Pro varias veces es inofensivo (Stripe puede
        # reenviar el mismo evento).
        _set_supabase_plan(user_id, "pro", customer_id)
        logger.info("Plan Pro activado para el usuario %s.", user_id)
        return {"received": True, "updated": True}

    # 4) Fin/anulación de la suscripción → degradar a Free. `subscription.deleted`
    #    salta cuando la suscripción termina (cancelación inmediata o al final del
    #    periodo). `subscription.updated` a estado `canceled`/`unpaid` cubre además
    #    la baja por impago. El id de Supabase viaja en el metadata que guardamos
    #    al crear la suscripción (subscription_data.metadata).
    if event.get("type") in (
        "customer.subscription.deleted",
        "customer.subscription.updated",
    ):
        subscription = event.get("data", {}).get("object", {})
        status = subscription.get("status")
        # `updated` salta por MUCHOS cambios (p. ej. programar la cancelación al
        # final del periodo, donde el estado sigue `active`): solo degradamos
        # cuando la suscripción ya no está vigente.
        if event.get("type") == "customer.subscription.updated" and status not in (
            "canceled",
            "unpaid",
        ):
            return {"received": True, "updated": False}

        user_id = (subscription.get("metadata") or {}).get("supabase_user_id")
        if not user_id:
            logger.warning(
                "%s sin supabase_user_id en metadata; se ignora.", event.get("type")
            )
            return {"received": True, "updated": False}

        # Idempotente: dejar a alguien en Free varias veces es inofensivo.
        _set_supabase_plan(user_id, "free")
        logger.info(
            "Plan Pro DESACTIVADO (%s, estado=%s) para el usuario %s.",
            event.get("type"),
            status,
            user_id,
        )
        return {"received": True, "updated": True}

    # 5) Otros eventos: acuse de recibo sin efectos.
    return {"received": True}


@router.post(
    "/create-portal-session",
    summary="Crea una sesión del portal de cliente de Stripe (gestionar suscripción)",
)
def create_portal_session(authorization: str | None = Header(default=None)) -> dict:
    """Abre el Customer Portal de Stripe para que el usuario gestione su plan Pro
    (método de pago, facturas, cancelar/reactivar la suscripción).

    Necesita el Customer de Stripe del usuario. Se toma de app_metadata
    (`stripe_customer_id`, que guarda el webhook al activar el plan). Como respaldo
    —p. ej. suscripciones anteriores a que guardáramos ese id— se busca por email
    en Stripe. Si no hay Customer (p. ej. un Pro dado de alta a mano, sin pago en
    Stripe), se responde 404 con un mensaje claro.
    """
    # 1) Identificar al usuario a partir del token de Supabase.
    user = _supabase_user(authorization)
    user_email = user.get("email")

    # 2) Configurar Stripe.
    stripe.api_key = _require(settings.stripe_secret_key, "STRIPE_SECRET_KEY")

    # 3) Localizar el Customer de Stripe (primero el id guardado; si no, por email).
    app_metadata = user.get("app_metadata") or {}
    customer_id = app_metadata.get("stripe_customer_id")
    if not customer_id and user_email:
        try:
            found = stripe.Customer.list(email=user_email, limit=1)
        except stripe.error.StripeError as exc:
            raise HTTPException(
                status_code=502, detail=f"Error de Stripe: {exc.user_message or str(exc)}"
            )
        if found.data:
            customer_id = found.data[0].id
    if not customer_id:
        raise HTTPException(
            status_code=404,
            detail=(
                "No encontramos una suscripción de Stripe asociada a tu cuenta. "
                "Si activaste Pro por otro medio, contáctanos."
            ),
        )

    # 4) Crear la sesión del portal y devolver su URL (el frontend redirige).
    try:
        session = stripe.billing_portal.Session.create(
            customer=customer_id,
            return_url=f"{settings.frontend_base_url}/app",
        )
    except stripe.error.StripeError as exc:
        raise HTTPException(
            status_code=502, detail=f"Error de Stripe: {exc.user_message or str(exc)}"
        )

    return {"url": session.url}
