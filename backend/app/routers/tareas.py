"""
Tareas terapéuticas: ejercicios, lecturas o registros asignados a un paciente
para hacer entre sesiones.

Mismo patrón que Agenda/Pacientes/Notas de voz: Supabase Postgres vía
PostgREST, reenviando el JWT del usuario (RLS = `auth.uid() = user_id`). Ver
`script_tareas_supabase.sql` (raíz del repo) para el esquema.

`paciente_id` es obligatorio (igual que en Notas de voz, a diferencia de la
Agenda original): toda tarea es de un paciente concreto. El nombre del
paciente se trae con un "resource embedding" de PostgREST
(`select=...,pacientes(nombre)`) en vez de guardarlo como snapshot, porque
al ser la relación obligatoria desde el día uno el join siempre resuelve.

El "borrado" normal es cancelar (`estado=cancelada`), igual que las citas.
Existe un DELETE real por paridad con `agenda.py`, pero el frontend no lo usa.
"""
from __future__ import annotations

from datetime import date, datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field

from app.auth import bearer_token, require_user
from app.routers.playlists import _postgrest

router = APIRouter(prefix="/api", tags=["tareas"])

_SELECT = (
    "id,paciente_id,titulo,tipo,descripcion,fecha_limite,estado,completed_at,"
    "created_at,pacientes(nombre)"
)


def _flatten(row: dict) -> dict:
    """Aplana el embed de PostgREST: {"pacientes": {"nombre": X}} -> paciente_nombre."""
    paciente = row.pop("pacientes", None) or {}
    row["paciente_nombre"] = paciente.get("nombre")
    return row


class TareaCreate(BaseModel):
    paciente_id: str
    titulo: str = Field(min_length=1, max_length=200)
    tipo: str = Field(default="ejercicio", pattern="^(ejercicio|lectura|registro)$")
    descripcion: Optional[str] = Field(default=None, max_length=2000)
    fecha_limite: Optional[date] = None


class TareaUpdate(BaseModel):
    """Todos los campos opcionales: marcar completada solo manda estado,
    reprogramar solo manda fecha_limite, editar solo manda lo que cambió."""

    titulo: Optional[str] = Field(default=None, min_length=1, max_length=200)
    tipo: Optional[str] = Field(default=None, pattern="^(ejercicio|lectura|registro)$")
    descripcion: Optional[str] = Field(default=None, max_length=2000)
    fecha_limite: Optional[date] = None
    estado: Optional[str] = Field(default=None, pattern="^(pendiente|completada|cancelada)$")


@router.get("/tareas", summary="Lista las tareas terapéuticas del usuario")
def list_tareas(
    paciente_id: Optional[str] = Query(default=None, description="Filtra a un paciente"),
    user: dict = Depends(require_user),
    token: str = Depends(bearer_token),
) -> list[dict]:
    params: list[tuple[str, str]] = [
        ("select", _SELECT),
        ("estado", "neq.cancelada"),
        ("order", "fecha_limite.asc.nullslast,created_at.desc"),
    ]
    if paciente_id:
        params.append(("paciente_id", f"eq.{paciente_id}"))

    resp = _postgrest("GET", "/tareas_terapeuticas", token, params=params)
    return [_flatten(row) for row in resp.json()]


@router.post("/tareas", status_code=201, summary="Asigna una tarea terapéutica")
def create_tarea(
    payload: TareaCreate,
    user: dict = Depends(require_user),
    token: str = Depends(bearer_token),
) -> dict:
    titulo = payload.titulo.strip()
    if not titulo:
        raise HTTPException(status_code=422, detail="El título no puede estar vacío.")

    # Confirma que el paciente existe y es tuyo (el GET ya está limitado por
    # RLS): un paciente_id ajeno da 404 en vez de crear una fila huérfana.
    resp = _postgrest(
        "GET",
        "/pacientes",
        token,
        params={"id": f"eq.{payload.paciente_id}", "select": "nombre"},
    )
    rows = resp.json()
    if not rows:
        raise HTTPException(status_code=404, detail="Ese paciente no existe.")

    body = payload.model_dump(mode="json")
    body["titulo"] = titulo
    body["user_id"] = user["id"]

    resp = _postgrest(
        "POST",
        "/tareas_terapeuticas",
        token,
        params={"select": _SELECT},
        prefer="return=representation",
        json_body=body,
    )
    created = resp.json()
    row = created[0] if isinstance(created, list) and created else created
    return _flatten(row)


@router.patch("/tareas/{tarea_id}", summary="Actualiza, completa, reabre o cancela una tarea")
def update_tarea(
    tarea_id: str,
    payload: TareaUpdate,
    user: dict = Depends(require_user),
    token: str = Depends(bearer_token),
) -> dict:
    changes = payload.model_dump(mode="json", exclude_unset=True)
    if not changes:
        raise HTTPException(status_code=422, detail="No se envió ningún campo para actualizar.")

    # completed_at lo decide el backend, nunca el cliente: se fija al marcar
    # completada y se limpia si vuelve a pendiente/cancelada.
    if "estado" in changes:
        changes["completed_at"] = (
            datetime.now(timezone.utc).isoformat() if changes["estado"] == "completada" else None
        )

    resp = _postgrest(
        "PATCH",
        "/tareas_terapeuticas",
        token,
        params={"id": f"eq.{tarea_id}", "select": _SELECT},
        json_body=changes,
        prefer="return=representation",
    )
    rows = resp.json()
    if not rows:
        raise HTTPException(status_code=404, detail="Esa tarea no existe.")
    return _flatten(rows[0])


@router.delete("/tareas/{tarea_id}", status_code=204, summary="Elimina una tarea definitivamente")
def delete_tarea(
    tarea_id: str,
    user: dict = Depends(require_user),
    token: str = Depends(bearer_token),
) -> None:
    resp = _postgrest(
        "DELETE",
        "/tareas_terapeuticas",
        token,
        params={"id": f"eq.{tarea_id}"},
        prefer="return=representation",
    )
    if not resp.json():
        raise HTTPException(status_code=404, detail="Esa tarea no existe.")
