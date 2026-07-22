"""
Directorio de pacientes.

Mismo patrón que Favoritos/Glosario/Agenda: Supabase Postgres vía PostgREST,
reenviando el JWT del usuario (RLS = `auth.uid() = user_id`). Ver
`script_pacientes_supabase.sql` (raíz del repo) para el esquema, incluido el
ALTER TABLE aditivo que agrega `agenda_citas.paciente_id`.

Los pacientes se ARCHIVAN (`activo=false`), nunca se borran de verdad —mismo
criterio que ya se usa para cancelar citas.
"""
from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field

from app.auth import bearer_token, require_user
from app.routers.playlists import _postgrest

router = APIRouter(prefix="/api", tags=["pacientes"])

_SELECT = "id,nombre,edad,telefono,motivo,notas,activo,created_at,agenda_citas(count)"


def _flatten(row: dict) -> dict:
    """PostgREST anida el conteo como [{"count": N}]; lo aplanamos a `citas_count`."""
    embedded = row.pop("agenda_citas", None) or []
    row["citas_count"] = embedded[0]["count"] if embedded else 0
    return row


class PacienteCreate(BaseModel):
    nombre: str = Field(min_length=1, max_length=200)
    edad: Optional[int] = Field(default=None, ge=0, le=130)
    telefono: Optional[str] = Field(default=None, max_length=40)
    motivo: Optional[str] = Field(default=None, max_length=120)
    notas: Optional[str] = Field(default=None, max_length=2000)


class PacienteUpdate(BaseModel):
    nombre: Optional[str] = Field(default=None, min_length=1, max_length=200)
    edad: Optional[int] = Field(default=None, ge=0, le=130)
    telefono: Optional[str] = Field(default=None, max_length=40)
    motivo: Optional[str] = Field(default=None, max_length=120)
    notas: Optional[str] = Field(default=None, max_length=2000)
    activo: Optional[bool] = None


@router.get("/pacientes", summary="Lista los pacientes activos del usuario")
def list_pacientes(
    q: Optional[str] = Query(default=None, description="Filtra por nombre o motivo"),
    user: dict = Depends(require_user),
    token: str = Depends(bearer_token),
) -> list[dict]:
    params: list[tuple[str, str]] = [
        ("select", _SELECT),
        ("activo", "eq.true"),
        ("order", "nombre.asc"),
    ]
    if q and q.strip():
        needle = q.strip().replace(",", " ")  # evita romper la sintaxis or() de PostgREST
        params.append(("or", f"(nombre.ilike.*{needle}*,motivo.ilike.*{needle}*)"))

    resp = _postgrest("GET", "/pacientes", token, params=params)
    return [_flatten(row) for row in resp.json()]


@router.post("/pacientes", status_code=201, summary="Crea un paciente")
def create_paciente(
    payload: PacienteCreate,
    user: dict = Depends(require_user),
    token: str = Depends(bearer_token),
) -> dict:
    nombre = payload.nombre.strip()
    if not nombre:
        raise HTTPException(status_code=422, detail="El nombre no puede estar vacío.")

    body = payload.model_dump(mode="json")
    body["nombre"] = nombre
    body["user_id"] = user["id"]

    resp = _postgrest(
        "POST", "/pacientes", token, prefer="return=representation", json_body=body
    )
    created = resp.json()
    row = created[0] if isinstance(created, list) and created else created
    row["citas_count"] = 0
    return row


@router.patch("/pacientes/{paciente_id}", summary="Actualiza o archiva un paciente")
def update_paciente(
    paciente_id: str,
    payload: PacienteUpdate,
    user: dict = Depends(require_user),
    token: str = Depends(bearer_token),
) -> dict:
    changes = payload.model_dump(mode="json", exclude_unset=True)
    if not changes:
        raise HTTPException(status_code=422, detail="No se envió ningún campo para actualizar.")

    resp = _postgrest(
        "PATCH",
        "/pacientes",
        token,
        params={"id": f"eq.{paciente_id}", "select": _SELECT},
        json_body=changes,
        prefer="return=representation",
    )
    rows = resp.json()
    if not rows:
        raise HTTPException(status_code=404, detail="Ese paciente no existe.")
    return _flatten(rows[0])
