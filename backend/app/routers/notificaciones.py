"""
Notificaciones: preferencias de aviso del usuario (recordatorio de citas,
tareas pendientes, resumen semanal, novedades de producto).

Mismo patrón que `consultorio_config.py`: una sola fila por usuario, upsert
vía PostgREST (`Prefer: resolution=merge-duplicates` + `on_conflict=user_id`).

Nota importante: esto guarda la PREFERENCIA, no dispara envíos -- el backend
todavía no tiene infraestructura de correo/push. Ver
`script_notificaciones_supabase.sql` (raíz del repo) para el esquema.
"""
from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends
from pydantic import BaseModel

from app.auth import bearer_token, require_user
from app.routers.playlists import _postgrest

router = APIRouter(prefix="/api", tags=["notificaciones"])

_SELECT = "recordatorio_citas,tareas_pendientes,resumen_semanal,novedades_producto,updated_at"

_DEFAULTS = {
    "recordatorio_citas": True,
    "tareas_pendientes": True,
    "resumen_semanal": True,
    "novedades_producto": True,
    "updated_at": None,
}


class NotificacionesUpdate(BaseModel):
    recordatorio_citas: Optional[bool] = None
    tareas_pendientes: Optional[bool] = None
    resumen_semanal: Optional[bool] = None
    novedades_producto: Optional[bool] = None


@router.get("/notificaciones", summary="Lee las preferencias de notificación")
def get_notificaciones(
    user: dict = Depends(require_user),
    token: str = Depends(bearer_token),
) -> dict:
    resp = _postgrest(
        "GET",
        "/notificaciones_config",
        token,
        params={"select": _SELECT, "user_id": f"eq.{user['id']}"},
    )
    rows = resp.json()
    return rows[0] if rows else dict(_DEFAULTS)


@router.put("/notificaciones", summary="Guarda (crea o actualiza) las preferencias")
def upsert_notificaciones(
    payload: NotificacionesUpdate,
    user: dict = Depends(require_user),
    token: str = Depends(bearer_token),
) -> dict:
    body = payload.model_dump(mode="json", exclude_unset=True)
    body["user_id"] = user["id"]

    resp = _postgrest(
        "POST",
        "/notificaciones_config",
        token,
        params={"select": _SELECT, "on_conflict": "user_id"},
        prefer="resolution=merge-duplicates,return=representation",
        json_body=body,
    )
    created = resp.json()
    return created[0] if isinstance(created, list) and created else created
