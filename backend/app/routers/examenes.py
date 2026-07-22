"""
Modo examen: exámenes de opción múltiple generados a partir del Glosario
clínico personal.

La generación de preguntas (muestreo aleatorio de términos + distractores) y
la calificación ocurren enteramente en el frontend, reutilizando
`getGlosario()` — no hay endpoint de lectura del glosario nuevo aquí. Este
router solo persiste el RESULTADO de un examen ya terminado (snapshot de
preguntas/respuestas + calificación), igual patrón que Glosario
(`glosario.py`): GET/POST/DELETE, sin PATCH — un resultado no se edita, solo
se borra. Ver `script_examenes_supabase.sql` (raíz del repo) para el esquema.
"""
from __future__ import annotations

from typing import Any, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from app.auth import bearer_token, require_user
from app.routers.playlists import _postgrest

router = APIRouter(prefix="/api", tags=["examenes"])

_SELECT = (
    "id,categoria,num_preguntas,respuestas_correctas,tiempo_limite_segundos,"
    "tiempo_usado_segundos,preguntas,created_at"
)


class ExamenCreate(BaseModel):
    categoria: Optional[str] = Field(default=None, max_length=80)
    num_preguntas: int = Field(ge=1, le=100)
    respuestas_correctas: int = Field(ge=0)
    tiempo_limite_segundos: Optional[int] = Field(default=None, ge=1)
    tiempo_usado_segundos: Optional[int] = Field(default=None, ge=0)
    preguntas: list[dict[str, Any]]


@router.get("/examenes", summary="Historial de exámenes del usuario")
def list_examenes(
    user: dict = Depends(require_user),
    token: str = Depends(bearer_token),
) -> list[dict]:
    resp = _postgrest(
        "GET",
        "/examenes",
        token,
        params={"select": _SELECT, "order": "created_at.desc"},
    )
    return resp.json()


@router.post("/examenes", status_code=201, summary="Guarda el resultado de un examen terminado")
def create_examen(
    payload: ExamenCreate,
    user: dict = Depends(require_user),
    token: str = Depends(bearer_token),
) -> dict:
    if payload.respuestas_correctas > payload.num_preguntas:
        raise HTTPException(
            status_code=422,
            detail="respuestas_correctas no puede ser mayor que num_preguntas.",
        )

    body = payload.model_dump(mode="json")
    body["user_id"] = user["id"]

    resp = _postgrest(
        "POST",
        "/examenes",
        token,
        params={"select": _SELECT},
        prefer="return=representation",
        json_body=body,
    )
    created = resp.json()
    return created[0] if isinstance(created, list) and created else created


@router.delete("/examenes/{examen_id}", status_code=204, summary="Borra un resultado del historial")
def delete_examen(
    examen_id: str,
    user: dict = Depends(require_user),
    token: str = Depends(bearer_token),
) -> None:
    resp = _postgrest(
        "DELETE",
        "/examenes",
        token,
        params={"id": f"eq.{examen_id}"},
        prefer="return=representation",
    )
    if not resp.json():
        raise HTTPException(status_code=404, detail="Ese examen no existe.")
