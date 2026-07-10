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

import requests
from fastapi import Header

from app.config import settings


def plan_from_user(user: dict) -> str:
    """Deriva el plan de un objeto usuario de Supabase (misma regla que el front).

    Fuente de verdad del plan de pago: `app_metadata` (lo escribe el webhook y el
    usuario no puede modificarlo). Se acepta también `user_metadata` por el toggle
    de desarrollo.
    """
    app_meta = user.get("app_metadata") or {}
    user_meta = user.get("user_metadata") or {}
    if app_meta.get("plan") == "pro" or user_meta.get("plan") == "pro":
        return "pro"
    return "free"


def get_user_plan(authorization: str | None = Header(default=None)) -> str:
    """Dependencia: devuelve 'pro' SOLO si el token es válido y el plan es Pro."""
    if not authorization or not authorization.lower().startswith("bearer "):
        return "free"
    if not settings.supabase_url or not settings.supabase_anon_key:
        return "free"

    token = authorization.split(" ", 1)[1].strip()
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
    return plan_from_user(resp.json())
