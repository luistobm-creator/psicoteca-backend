"""
Lectura del PLAN del usuario ('free' | 'pro') a partir del token de Supabase.

Se usa como dependencia (opcional) de FastAPI en los endpoints que sirven la
biblioteca, para decidir qué contenido enviar.

Falla CERRADO: si no hay token, es inválido o Supabase no responde, se asume
'free'. Nunca se entrega contenido Pro por error; en el peor caso (un fallo
puntual de Supabase) un usuario Pro vería temporalmente la biblioteca filtrada.

Nota de rendimiento: valida el token contra Supabase (/auth/v1/user) en cada
petición. Consultar /auth/v1/user (en vez de decodificar el JWT) tiene una
ventaja importante: devuelve el `app_metadata` ACTUAL del usuario, así que un
Pro recién activado por el webhook se reconoce de inmediato aunque su JWT aún
lleve el plan antiguo.
"""
from __future__ import annotations

import time

import requests
from fastapi import Header, HTTPException

from app.config import settings


def plan_from_user(user: dict) -> str:
    """Deriva el plan de un objeto usuario de Supabase (misma regla que el front).

    ÚNICA fuente de verdad del plan de pago: `app_metadata.plan`, que solo escribe
    el servidor (webhook de Stripe / Admin API) y el usuario NO puede modificar. NO
    se mira `user_metadata`: el cliente puede escribir ahí con
    `supabase.auth.updateUser`, así que confiar en él dejaría que un usuario Free se
    auto-asignara Pro. Falla cerrado: cualquier otro caso → 'free'.
    """
    app_meta = user.get("app_metadata") or {}
    return "pro" if app_meta.get("plan") == "pro" else "free"


# Caché en memoria del plan por token (TTL corto). Con la carga por RANGOS del
# visor, /content recibe muchas peticiones seguidas del mismo usuario; sin esto
# validaríamos el token contra Supabase en CADA una. TTL bajo para que un cambio
# de plan (alta/baja) se refleje pronto. Solo se cachean validaciones EXITOSAS:
# un fallo transitorio de Supabase nunca cachea 'free' para un usuario Pro. En un
# alta, el frontend renueva el JWT (token distinto → cache miss), así que el Pro
# se reconoce al instante pese a la caché.
_PLAN_CACHE_TTL = 30.0  # segundos
_plan_cache: dict[str, tuple[str, float]] = {}


def get_user_plan(authorization: str | None = Header(default=None)) -> str:
    """Dependencia: devuelve 'pro' SOLO si el token es válido y el plan es Pro."""
    if not authorization or not authorization.lower().startswith("bearer "):
        return "free"
    if not settings.supabase_url or not settings.supabase_anon_key:
        return "free"

    token = authorization.split(" ", 1)[1].strip()

    now = time.monotonic()
    cached = _plan_cache.get(token)
    if cached is not None and cached[1] > now:
        return cached[0]

    base = settings.supabase_url.rstrip("/")
    try:
        resp = requests.get(
            f"{base}/auth/v1/user",
            headers={
                "apikey": settings.supabase_anon_key,
                "Authorization": f"Bearer {token}",
            },
            timeout=8,
        )
    except requests.RequestException:
        return "free"

    if resp.status_code != 200:
        return "free"

    plan = plan_from_user(resp.json())
    _plan_cache[token] = (plan, now + _PLAN_CACHE_TTL)
    # Poda perezosa de entradas caducadas para no crecer sin límite.
    if len(_plan_cache) > 512:
        for k in [key for key, (_p, exp) in _plan_cache.items() if exp <= now]:
            _plan_cache.pop(k, None)
    return plan


def _require_setting(value: str | None, name: str) -> str:
    """Devuelve el valor o lanza 500 si falta (configuración incompleta)."""
    if not value:
        raise HTTPException(
            status_code=500, detail=f"Configuración incompleta: falta {name}."
        )
    return value


def bearer_token(authorization: str | None = Header(default=None)) -> str:
    """Dependencia: extrae el JWT del header `Authorization: Bearer …` (o 401).

    Útil para REENVIAR el token del usuario a PostgREST de Supabase, de modo que
    las políticas RLS (`auth.uid() = user_id`) filtren por dueño.
    """
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="Falta el token de autenticación.")
    return authorization.split(" ", 1)[1].strip()


def require_user(authorization: str | None = Header(default=None)) -> dict:
    """Dependencia: valida el Bearer token contra Supabase (/auth/v1/user) y
    devuelve el usuario ({id, email, app_metadata, …}). Lanza 401 si falta o es
    inválido. Para endpoints que EXIGEN un usuario autenticado (favoritos, etc.).

    A diferencia de `get_user_plan` (que falla cerrado a 'free' para el gating de
    contenido), aquí un token ausente/ inválido es un error 401 explícito.
    """
    token = bearer_token(authorization)
    base = _require_setting(settings.supabase_url, "SUPABASE_URL").rstrip("/")
    anon = _require_setting(settings.supabase_anon_key, "SUPABASE_ANON_KEY")
    try:
        resp = requests.get(
            f"{base}/auth/v1/user",
            headers={"apikey": anon, "Authorization": f"Bearer {token}"},
            timeout=8,
        )
    except requests.RequestException:
        raise HTTPException(
            status_code=502, detail="No se pudo validar la sesión con Supabase."
        )
    if resp.status_code != 200:
        raise HTTPException(status_code=401, detail="Sesión inválida o expirada.")
    user = resp.json()
    if not user.get("id"):
        raise HTTPException(status_code=401, detail="No se pudo identificar al usuario.")
    return user
