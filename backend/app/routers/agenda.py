"""
Agenda de citas personal.

Mismo patrón que Favoritos/Glosario (`playlists.py`/`glosario.py`): las citas
viven en Supabase Postgres, habladas vía PostgREST reenviando el JWT del
propio usuario, así que RLS (`auth.uid() = user_id`) aplica solo. Ver
`script_agenda_supabase.sql` (raíz del repo) para el esquema.

A diferencia del Glosario, aquí sí hay actualización parcial (PATCH): sirve
tanto para reprogramar (fecha/hora) como para cancelar (estado) o alternar el
recordatorio, sin necesitar tres endpoints casi idénticos.
"""
from __future__ import annotations

from datetime import date, time
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field

from app.auth import bearer_token, require_user
from app.routers.playlists import _postgrest

router = APIRouter(prefix="/api", tags=["agenda"])

_SELECT = "id,paciente_id,paciente_nombre,tipo_sesion,fecha,hora,duracion_minutos,modalidad,recordatorio,estado,notas,asistio,created_at"


class CitaCreate(BaseModel):
    # Uno de los dos, ver create_cita(): paciente_id (del Directorio, el
    # backend toma el nombre actual) o paciente_nombre (texto libre, flujo
    # original sin cambios).
    paciente_nombre: Optional[str] = Field(default=None, max_length=200)
    paciente_id: Optional[str] = None
    fecha: date
    hora: time
    tipo_sesion: Optional[str] = Field(default=None, max_length=80)
    duracion_minutos: int = Field(default=50, ge=5, le=480)
    modalidad: str = Field(default="presencial", pattern="^(presencial|en_linea)$")
    recordatorio: bool = True
    notas: Optional[str] = Field(default=None, max_length=2000)


class CitaUpdate(BaseModel):
    """Todos los campos opcionales: reprogramar solo manda fecha/hora, cancelar
    solo manda estado, el switch de recordatorio solo manda recordatorio."""

    fecha: Optional[date] = None
    hora: Optional[time] = None
    tipo_sesion: Optional[str] = Field(default=None, max_length=80)
    duracion_minutos: Optional[int] = Field(default=None, ge=5, le=480)
    modalidad: Optional[str] = Field(default=None, pattern="^(presencial|en_linea)$")
    recordatorio: Optional[bool] = None
    estado: Optional[str] = Field(default=None, pattern="^(programada|cancelada)$")
    notas: Optional[str] = Field(default=None, max_length=2000)
    # Para Estadísticas del consultorio (índice de asistencia). null = sin marcar.
    asistio: Optional[bool] = None


@router.get("/agenda", summary="Lista las citas del usuario (programadas)")
def list_agenda(
    desde: Optional[date] = Query(default=None, description="Filtra fecha >= desde"),
    hasta: Optional[date] = Query(default=None, description="Filtra fecha <= hasta"),
    user: dict = Depends(require_user),
    token: str = Depends(bearer_token),
) -> list[dict]:
    params: list[tuple[str, str]] = [
        ("select", _SELECT),
        ("estado", "eq.programada"),
        ("order", "fecha.asc,hora.asc"),
    ]
    if desde:
        params.append(("fecha", f"gte.{desde.isoformat()}"))
    if hasta:
        params.append(("fecha", f"lte.{hasta.isoformat()}"))

    resp = _postgrest("GET", "/agenda_citas", token, params=params)
    return resp.json()


@router.post("/agenda", status_code=201, summary="Crea una cita")
def create_cita(
    payload: CitaCreate,
    user: dict = Depends(require_user),
    token: str = Depends(bearer_token),
) -> dict:
    if payload.paciente_id:
        # Paciente del Directorio: se toma su nombre ACTUAL como foto para
        # paciente_nombre (RLS ya limita la búsqueda a los pacientes del
        # propio usuario; si no existe o no es suyo, esto da 404, no otro user).
        resp = _postgrest(
            "GET",
            "/pacientes",
            token,
            params={"id": f"eq.{payload.paciente_id}", "select": "nombre"},
        )
        rows = resp.json()
        if not rows:
            raise HTTPException(status_code=404, detail="Ese paciente no existe.")
        nombre = rows[0]["nombre"]
    else:
        nombre = (payload.paciente_nombre or "").strip()
        if not nombre:
            raise HTTPException(
                status_code=422, detail="El nombre del paciente no puede estar vacío."
            )

    body = payload.model_dump(mode="json")
    body["paciente_nombre"] = nombre
    body["user_id"] = user["id"]

    resp = _postgrest(
        "POST", "/agenda_citas", token, prefer="return=representation", json_body=body
    )
    created = resp.json()
    return created[0] if isinstance(created, list) and created else created


@router.patch("/agenda/{cita_id}", summary="Actualiza una cita (reprogramar, cancelar, recordatorio)")
def update_cita(
    cita_id: str,
    payload: CitaUpdate,
    user: dict = Depends(require_user),
    token: str = Depends(bearer_token),
) -> dict:
    changes = {k: v for k, v in payload.model_dump(mode="json", exclude_unset=True).items()}
    if not changes:
        raise HTTPException(status_code=422, detail="No se envió ningún campo para actualizar.")

    resp = _postgrest(
        "PATCH",
        "/agenda_citas",
        token,
        params={"id": f"eq.{cita_id}"},
        json_body=changes,
        prefer="return=representation",
    )
    rows = resp.json()
    if not rows:
        raise HTTPException(status_code=404, detail="Esa cita no existe.")
    return rows[0]


@router.delete("/agenda/{cita_id}", status_code=204, summary="Elimina una cita definitivamente")
def delete_cita(
    cita_id: str,
    user: dict = Depends(require_user),
    token: str = Depends(bearer_token),
) -> None:
    resp = _postgrest(
        "DELETE",
        "/agenda_citas",
        token,
        params={"id": f"eq.{cita_id}"},
        prefer="return=representation",
    )
    if not resp.json():
        raise HTTPException(status_code=404, detail="Esa cita no existe.")
