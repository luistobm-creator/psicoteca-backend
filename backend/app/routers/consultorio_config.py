"""
Configurar consultorio: datos generales del consultorio del usuario (nombre,
dirección, teléfono, duración de sesión y moneda por defecto).

Una sola fila por usuario -- `user_id` es la propia llave primaria, no hay
lista que paginar. Mismo patrón `_postgrest` de siempre, pero con upsert
(PostgREST `Prefer: resolution=merge-duplicates` + `on_conflict=user_id`) en
vez de POST/PATCH separados, porque desde el frontend no importa si ya
existía la fila o no: siempre es "guarda mi configuración".

Ver `script_consultorio_config_supabase.sql` (raíz del repo) para el esquema.
"""
from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field

from app.auth import bearer_token, require_user
from app.routers.playlists import _postgrest

router = APIRouter(prefix="/api", tags=["consultorio_config"])

_SELECT = "nombre_consultorio,direccion,telefono,duracion_sesion_default,moneda,updated_at"

_DEFAULTS = {
    "nombre_consultorio": None,
    "direccion": None,
    "telefono": None,
    "duracion_sesion_default": 50,
    "moneda": "MXN",
    "updated_at": None,
}


class ConfigUpdate(BaseModel):
    nombre_consultorio: Optional[str] = Field(default=None, max_length=200)
    direccion: Optional[str] = Field(default=None, max_length=300)
    telefono: Optional[str] = Field(default=None, max_length=40)
    duracion_sesion_default: Optional[int] = Field(default=None, ge=5, le=480)
    moneda: Optional[str] = Field(default=None, max_length=10)


@router.get("/consultorio-config", summary="Lee la configuración del consultorio")
def get_config(
    user: dict = Depends(require_user),
    token: str = Depends(bearer_token),
) -> dict:
    resp = _postgrest(
        "GET",
        "/consultorio_config",
        token,
        params={"select": _SELECT, "user_id": f"eq.{user['id']}"},
    )
    rows = resp.json()
    # Sin fila todavía (usuario nuevo): defaults razonables, no 404 -- es una
    # pantalla de "editar mi configuración", no un recurso que deba existir.
    return rows[0] if rows else dict(_DEFAULTS)


@router.put("/consultorio-config", summary="Guarda (crea o actualiza) la configuración")
def upsert_config(
    payload: ConfigUpdate,
    user: dict = Depends(require_user),
    token: str = Depends(bearer_token),
) -> dict:
    body = payload.model_dump(mode="json", exclude_unset=True)
    body["user_id"] = user["id"]

    resp = _postgrest(
        "POST",
        "/consultorio_config",
        token,
        params={"select": _SELECT, "on_conflict": "user_id"},
        prefer="resolution=merge-duplicates,return=representation",
        json_body=body,
    )
    created = resp.json()
    return created[0] if isinstance(created, list) and created else created
