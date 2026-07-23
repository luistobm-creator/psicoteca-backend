"""
Facturación y pagos: registro de cobros por paciente.

Mismo patrón que Tareas/Agenda: Supabase Postgres vía PostgREST, reenviando
el JWT del usuario (RLS = `auth.uid() = user_id`). Ver
`script_facturacion_supabase.sql` (raíz del repo) para el esquema.

Un cobro no se borra: se "anula" (estado=anulado), igual criterio de
preservar historial que agenda_citas/pacientes — aquí con más razón, al ser
un registro financiero. "Vencido" no es un estado guardado: se calcula al
vuelo (pendiente + fecha ya pasada), igual que "vencida" en tareas.
"""
from __future__ import annotations

from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field

from app.auth import bearer_token, require_user
from app.routers.playlists import _postgrest

router = APIRouter(prefix="/api", tags=["facturacion"])

_SELECT = "id,paciente_id,monto,fecha,concepto,estado,created_at,pacientes(nombre)"


def _flatten(row: dict) -> dict:
    paciente = row.pop("pacientes", None) or {}
    row["paciente_nombre"] = paciente.get("nombre")
    return row


class FacturacionCreate(BaseModel):
    paciente_id: str
    monto: float = Field(gt=0)
    fecha: date
    concepto: Optional[str] = Field(default=None, max_length=200)


class FacturacionUpdate(BaseModel):
    """Todo opcional: marcar pagado/anular solo manda estado, corregir un
    cobro manda los campos que cambiaron."""

    monto: Optional[float] = Field(default=None, gt=0)
    fecha: Optional[date] = None
    concepto: Optional[str] = Field(default=None, max_length=200)
    estado: Optional[str] = Field(default=None, pattern="^(pendiente|pagado|anulado)$")


@router.get("/facturacion", summary="Lista los cobros del usuario")
def list_facturacion(
    paciente_id: Optional[str] = Query(default=None, description="Filtra a un paciente"),
    user: dict = Depends(require_user),
    token: str = Depends(bearer_token),
) -> list[dict]:
    params: list[tuple[str, str]] = [
        ("select", _SELECT),
        ("order", "fecha.desc,created_at.desc"),
    ]
    if paciente_id:
        params.append(("paciente_id", f"eq.{paciente_id}"))

    resp = _postgrest("GET", "/facturacion", token, params=params)
    return [_flatten(row) for row in resp.json()]


@router.post("/facturacion", status_code=201, summary="Registra un cobro")
def create_facturacion(
    payload: FacturacionCreate,
    user: dict = Depends(require_user),
    token: str = Depends(bearer_token),
) -> dict:
    # Confirma que el paciente existe y es tuyo (mismo truco que tareas.py):
    # el GET ya está limitado por RLS, así que un paciente_id ajeno da 404.
    resp = _postgrest(
        "GET",
        "/pacientes",
        token,
        params={"id": f"eq.{payload.paciente_id}", "select": "nombre"},
    )
    if not resp.json():
        raise HTTPException(status_code=404, detail="Ese paciente no existe.")

    body = payload.model_dump(mode="json")
    body["user_id"] = user["id"]

    resp = _postgrest(
        "POST",
        "/facturacion",
        token,
        params={"select": _SELECT},
        prefer="return=representation",
        json_body=body,
    )
    created = resp.json()
    row = created[0] if isinstance(created, list) and created else created
    return _flatten(row)


@router.patch("/facturacion/{cobro_id}", summary="Actualiza, marca pagado o anula un cobro")
def update_facturacion(
    cobro_id: str,
    payload: FacturacionUpdate,
    user: dict = Depends(require_user),
    token: str = Depends(bearer_token),
) -> dict:
    changes = payload.model_dump(mode="json", exclude_unset=True)
    if not changes:
        raise HTTPException(status_code=422, detail="No se envió ningún campo para actualizar.")

    resp = _postgrest(
        "PATCH",
        "/facturacion",
        token,
        params={"id": f"eq.{cobro_id}", "select": _SELECT},
        json_body=changes,
        prefer="return=representation",
    )
    rows = resp.json()
    if not rows:
        raise HTTPException(status_code=404, detail="Ese cobro no existe.")
    return _flatten(rows[0])
