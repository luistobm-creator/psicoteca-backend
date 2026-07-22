"""
Glosario clínico personal.

Igual que Favoritos (`playlists.py`): los términos viven en Supabase Postgres
(no en la SQLite del catálogo, que es solo el espejo de Drive), hablado vía
PostgREST reenviando el JWT del propio usuario, de modo que las políticas RLS
(`auth.uid() = user_id`) hacen cumplir la propiedad a nivel de base de datos.
Ver `script_glosario_supabase.sql` (raíz del repo) para el esquema.
"""
from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from app.auth import bearer_token, require_user
from app.routers.playlists import _postgrest

router = APIRouter(prefix="/api", tags=["glosario"])


class GlosarioCreate(BaseModel):
    termino: str = Field(min_length=1, max_length=200)
    definicion: str = Field(min_length=1, max_length=4000)
    categoria: Optional[str] = Field(default=None, max_length=80)


@router.get("/glosario", summary="Lista los términos del glosario del usuario")
def list_glosario(
    user: dict = Depends(require_user),
    token: str = Depends(bearer_token),
) -> list[dict]:
    resp = _postgrest(
        "GET",
        "/glosario_clinico",
        token,
        params={
            "select": "id,termino,definicion,categoria,created_at",
            "order": "termino.asc",
        },
    )
    return resp.json()


@router.post("/glosario", status_code=201, summary="Crea un término del glosario")
def create_glosario_termino(
    payload: GlosarioCreate,
    user: dict = Depends(require_user),
    token: str = Depends(bearer_token),
) -> dict:
    termino = payload.termino.strip()
    definicion = payload.definicion.strip()
    if not termino or not definicion:
        raise HTTPException(
            status_code=422, detail="Término y definición no pueden estar vacíos."
        )
    categoria = (payload.categoria or "").strip() or None

    resp = _postgrest(
        "POST",
        "/glosario_clinico",
        token,
        prefer="return=representation",
        json_body={
            "user_id": user["id"],
            "termino": termino,
            "definicion": definicion,
            "categoria": categoria,
        },
    )
    created = resp.json()
    return created[0] if isinstance(created, list) and created else created


@router.delete(
    "/glosario/{term_id}",
    status_code=204,
    summary="Elimina un término del glosario (solo si es del usuario)",
)
def delete_glosario_termino(
    term_id: str,
    user: dict = Depends(require_user),
    token: str = Depends(bearer_token),
) -> None:
    resp = _postgrest(
        "DELETE",
        "/glosario_clinico",
        token,
        params={"id": f"eq.{term_id}"},
        prefer="return=representation",
    )
    if not resp.json():
        raise HTTPException(status_code=404, detail="Ese término no existe.")
