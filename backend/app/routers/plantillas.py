"""
Plantillas de formato: textos reutilizables (estructuras de nota de sesión,
formatos de informe, etc.) que el propio usuario redacta y reutiliza.

Mismo patrón que Glosario (`glosario.py`): GET/POST/PATCH/DELETE simples,
sin relación con otras tablas. Ver `script_plantillas_supabase.sql` (raíz
del repo) para el esquema.
"""
from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from app.auth import bearer_token, require_user
from app.routers.playlists import _postgrest

router = APIRouter(prefix="/api", tags=["plantillas"])

_SELECT = "id,nombre,contenido,created_at"


class PlantillaCreate(BaseModel):
    nombre: str = Field(min_length=1, max_length=150)
    contenido: str = Field(min_length=1, max_length=8000)


class PlantillaUpdate(BaseModel):
    nombre: Optional[str] = Field(default=None, min_length=1, max_length=150)
    contenido: Optional[str] = Field(default=None, min_length=1, max_length=8000)


@router.get("/plantillas", summary="Lista las plantillas del usuario")
def list_plantillas(
    user: dict = Depends(require_user),
    token: str = Depends(bearer_token),
) -> list[dict]:
    resp = _postgrest(
        "GET",
        "/plantillas_formato",
        token,
        params={"select": _SELECT, "order": "nombre.asc"},
    )
    return resp.json()


@router.post("/plantillas", status_code=201, summary="Crea una plantilla")
def create_plantilla(
    payload: PlantillaCreate,
    user: dict = Depends(require_user),
    token: str = Depends(bearer_token),
) -> dict:
    nombre = payload.nombre.strip()
    contenido = payload.contenido.strip()
    if not nombre or not contenido:
        raise HTTPException(status_code=422, detail="Nombre y contenido no pueden estar vacíos.")

    resp = _postgrest(
        "POST",
        "/plantillas_formato",
        token,
        prefer="return=representation",
        json_body={"user_id": user["id"], "nombre": nombre, "contenido": contenido},
    )
    created = resp.json()
    return created[0] if isinstance(created, list) and created else created


@router.patch("/plantillas/{plantilla_id}", summary="Actualiza una plantilla")
def update_plantilla(
    plantilla_id: str,
    payload: PlantillaUpdate,
    user: dict = Depends(require_user),
    token: str = Depends(bearer_token),
) -> dict:
    changes = payload.model_dump(mode="json", exclude_unset=True)
    if not changes:
        raise HTTPException(status_code=422, detail="No se envió ningún campo para actualizar.")

    resp = _postgrest(
        "PATCH",
        "/plantillas_formato",
        token,
        params={"id": f"eq.{plantilla_id}", "select": _SELECT},
        json_body=changes,
        prefer="return=representation",
    )
    rows = resp.json()
    if not rows:
        raise HTTPException(status_code=404, detail="Esa plantilla no existe.")
    return rows[0]


@router.delete("/plantillas/{plantilla_id}", status_code=204, summary="Elimina una plantilla")
def delete_plantilla(
    plantilla_id: str,
    user: dict = Depends(require_user),
    token: str = Depends(bearer_token),
) -> None:
    resp = _postgrest(
        "DELETE",
        "/plantillas_formato",
        token,
        params={"id": f"eq.{plantilla_id}"},
        prefer="return=representation",
    )
    if not resp.json():
        raise HTTPException(status_code=404, detail="Esa plantilla no existe.")
