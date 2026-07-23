"""
Actividad de biblioteca: registro de qué documentos ve y descarga el
usuario. Alimenta dos pantallas del menú Perfil con la MISMA tabla
(`accion='vista'` -> Historial de lectura, `accion='descarga'` -> Mis
descargas), en vez de dos tablas idénticas por separado.

El registro lo dispara el propio frontend (fire-and-forget, no bloquea la
lectura/descarga si falla) desde `openFileInReader` en App.jsx y
`handleDownload` en ReaderPanel.jsx. Ver
`script_actividad_biblioteca_supabase.sql` (raíz del repo) para el esquema.

Solo lectura + inserción: es un historial, no se edita ni se borra fila por
fila.
"""
from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field

from app.auth import bearer_token, require_user
from app.routers.playlists import _postgrest

router = APIRouter(prefix="/api", tags=["actividad_biblioteca"])

_SELECT = "id,item_id,item_name,item_path,item_mime,item_is_premium,accion,created_at"


class ActividadCreate(BaseModel):
    item_id: str
    item_name: str = Field(max_length=300)
    item_path: Optional[str] = Field(default=None, max_length=1000)
    item_mime: Optional[str] = Field(default=None, max_length=200)
    item_is_premium: bool = False
    accion: str = Field(pattern="^(vista|descarga)$")


@router.get("/actividad-biblioteca", summary="Historial de lectura o descargas del usuario")
def list_actividad(
    accion: Optional[str] = Query(default=None, pattern="^(vista|descarga)$"),
    limit: int = Query(default=100, ge=1, le=500),
    user: dict = Depends(require_user),
    token: str = Depends(bearer_token),
) -> list[dict]:
    params: list[tuple[str, str]] = [
        ("select", _SELECT),
        ("order", "created_at.desc"),
        ("limit", str(limit)),
    ]
    if accion:
        params.append(("accion", f"eq.{accion}"))

    resp = _postgrest("GET", "/actividad_biblioteca", token, params=params)
    return resp.json()


@router.post("/actividad-biblioteca", status_code=201, summary="Registra un evento de lectura/descarga")
def create_actividad(
    payload: ActividadCreate,
    user: dict = Depends(require_user),
    token: str = Depends(bearer_token),
) -> dict:
    body = payload.model_dump(mode="json")
    body["user_id"] = user["id"]

    resp = _postgrest(
        "POST",
        "/actividad_biblioteca",
        token,
        prefer="return=representation",
        raise_on_error=False,
        json_body=body,
    )
    if resp.status_code >= 400:
        # No debe romper la lectura/descarga real si el registro falla.
        raise HTTPException(status_code=502, detail="No se pudo registrar la actividad.")
    created = resp.json()
    return created[0] if isinstance(created, list) and created else created
