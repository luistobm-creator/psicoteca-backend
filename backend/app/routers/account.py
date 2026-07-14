"""
Ciclo de vida de la cuenta del usuario.

DELETE /api/account
    Borra DEFINITIVAMENTE la cuenta del usuario AUTENTICADO. Un usuario solo puede
    borrarse a sí mismo: la identidad sale del token validado (`require_user`),
    nunca de un id recibido en la petición.

    Orden IMPORTANTE (para no dejar cuentas huérfanas facturándose):
      1) Si el usuario tiene un Customer de Stripe, se CANCELAN sus suscripciones.
      2) Solo si el paso 1 tuvo éxito (o no había nada que cancelar) se borra el
         usuario en Supabase vía Admin API. Al borrarlo, sus playlists caen por
         `ON DELETE CASCADE` (viven en Supabase Postgres, no en la SQLite efímera).
    Si Stripe rechaza la cancelación, se ABORTA con 502 y la cuenta NO se borra:
    preferimos una cuenta viva a una cuenta borrada que sigue cobrando.
"""
from __future__ import annotations

import logging

import requests
import stripe
from fastapi import APIRouter, Depends, HTTPException, Response

from app.auth import require_user
from app.config import settings

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api", tags=["account"])


def _require(value: str | None, name: str) -> str:
    if not value:
        raise HTTPException(
            status_code=500, detail=f"Configuración incompleta: falta {name}."
        )
    return value


def _resolve_stripe_customer_id(user: dict) -> str | None:
    """Localiza el Customer de Stripe del usuario (id guardado o, si no, por email).

    Mismo criterio que el portal de cliente (billing.py): primero
    `app_metadata.stripe_customer_id` (lo guarda el webhook); como respaldo, una
    búsqueda por email. Devuelve None si no hay Customer (usuario Free sin pago).
    """
    app_metadata = user.get("app_metadata") or {}
    customer_id = app_metadata.get("stripe_customer_id")
    if customer_id:
        return customer_id

    email = user.get("email")
    if not email:
        return None
    try:
        found = stripe.Customer.list(email=email, limit=1)
    except stripe.error.StripeError as exc:
        raise HTTPException(
            status_code=502,
            detail=f"Error de Stripe al localizar tu suscripción: {exc.user_message or str(exc)}",
        )
    return found.data[0].id if found.data else None


def _cancel_stripe_subscriptions(customer_id: str) -> None:
    """Cancela de inmediato TODAS las suscripciones aún vigentes del Customer.

    Si Stripe rechaza la operación, se propaga como 502: el llamador NO debe
    borrar la cuenta, para no dejar al usuario sin acceso y aún facturándose.
    """
    try:
        subs = stripe.Subscription.list(customer=customer_id, status="all", limit=100)
        for sub in subs.auto_paging_iter():
            # Estados ya terminales: no hay nada que cancelar.
            if sub.status in ("canceled", "incomplete_expired"):
                continue
            stripe.Subscription.cancel(sub.id)
    except stripe.error.StripeError as exc:
        raise HTTPException(
            status_code=502,
            detail=(
                "No se pudo cancelar tu suscripción en Stripe, así que no borramos "
                f"la cuenta (para evitar cobros): {exc.user_message or str(exc)}"
            ),
        )


def _delete_supabase_user(user_id: str) -> None:
    """Borra el usuario en Supabase vía Admin API (service_role). Cascade → playlists."""
    base = _require(settings.supabase_url, "SUPABASE_URL").rstrip("/")
    service_key = _require(
        settings.supabase_service_role_key, "SUPABASE_SERVICE_ROLE_KEY"
    )
    try:
        resp = requests.delete(
            f"{base}/auth/v1/admin/users/{user_id}",
            headers={
                "apikey": service_key,
                "Authorization": f"Bearer {service_key}",
            },
            timeout=10,
        )
    except requests.RequestException:
        raise HTTPException(
            status_code=502,
            detail="No se pudo contactar con Supabase para borrar la cuenta.",
        )
    if resp.status_code not in (200, 204):
        logger.error(
            "Supabase Admin API %s al borrar el usuario: %s",
            resp.status_code,
            resp.text[:300],
        )
        raise HTTPException(
            status_code=502,
            detail=f"Supabase rechazó el borrado de la cuenta (HTTP {resp.status_code}).",
        )


@router.delete(
    "/account",
    status_code=204,
    summary="Borra la cuenta del usuario autenticado (cancela Stripe antes)",
)
def delete_account(user: dict = Depends(require_user)) -> Response:
    user_id = user["id"]
    app_metadata = user.get("app_metadata") or {}
    plan = app_metadata.get("plan")

    # 1) Cancelar la suscripción de Stripe ANTES de borrar. Solo tocamos Stripe si
    #    hay motivo (plan Pro o un customer ya guardado) y si está configurado; así
    #    un usuario Free no depende de Stripe para poder borrarse. Si la
    #    cancelación falla, _cancel_* lanza 502 y NO se llega al borrado.
    if settings.stripe_secret_key and (
        plan == "pro" or app_metadata.get("stripe_customer_id")
    ):
        stripe.api_key = settings.stripe_secret_key
        customer_id = _resolve_stripe_customer_id(user)
        if customer_id:
            _cancel_stripe_subscriptions(customer_id)

    # 2) Borrar el usuario en Supabase (cascade elimina sus playlists).
    _delete_supabase_user(user_id)

    logger.info("Cuenta borrada: usuario %s.", user_id)
    return Response(status_code=204)
