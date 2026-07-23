"""
Buzón de sugerencias: mensajes cortos que el usuario envía sobre la app
(idea, error u otro). Es una bandeja de salida propia -- se lista y se puede
borrar (retractar), pero no se edita: una sugerencia ya enviada no se
"corrige", se borra y se reenvía si hace falta.

Mismo patrón que Glosario/Plantillas: GET/POST/DELETE simples, sin relación
con otras tablas. Ver `script_sugerencias_supabase.sql` (raíz del repo).
"""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from app.auth import bearer_token, require_user
from app.routers.playlists import _postgrest

router = APIRouter(prefix="/api", tags=["sugerencias"])

_SELECT = "id,categoria,mensaje,created_at"


class SugerenciaCreate(BaseModel):
    categoria: str = Field(pattern="^(idea|error|otro)$")
    mensaje: str = Field(min_length=1, max_length=2000)


@router.get("/sugerencias", summary="Lista las sugerencias enviadas por el usuario")
def list_sugerencias(
    user: dict = Depends(require_user),
    token: str = Depends(bearer_token),
) -> list[dict]:
    resp = _postgrest(
        "GET",
        "/sugerencias",
        token,
        params={"select": _SELECT, "order": "created_at.desc"},
    )
    return resp.json()


@router.post("/sugerencias", status_code=201, summary="Envía una sugerencia")
def create_sugerencia(
    payload: SugerenciaCreate,
    user: dict = Depends(require_user),
    token: str = Depends(bearer_token),
) -> dict:
    mensaje = payload.mensaje.strip()
    if not mensaje:
        raise HTTPException(status_code=422, detail="El mensaje no puede estar vacío.")

    resp = _postgrest(
        "POST",
        "/sugerencias",
        token,
        prefer="return=representation",
        json_body={"user_id": user["id"], "categoria": payload.categoria, "mensaje": mensaje},
    )
    created = resp.json()
    return created[0] if isinstance(created, list) and created else created


@router.delete("/sugerencias/{sugerencia_id}", status_code=204, summary="Retira una sugerencia enviada")
def delete_sugerencia(
    sugerencia_id: str,
    user: dict = Depends(require_user),
    token: str = Depends(bearer_token),
) -> None:
    resp = _postgrest(
        "DELETE",
        "/sugerencias",
        token,
        params={"id": f"eq.{sugerencia_id}"},
        prefer="return=representation",
    )
    if not resp.json():
        raise HTTPException(status_code=404, detail="Esa sugerencia no existe.")
