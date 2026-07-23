"""
Consentimiento con firma: registro de que un paciente aceptó un texto de
consentimiento informado, con su nombre escrito a modo de firma y la fecha.

Es un registro legal/clínico -- una vez creado no se edita ni se borra
(mismo criterio que Facturación/Agenda: se conserva el historial completo).
El texto se guarda COMPLETO en cada fila (no solo una referencia a una
plantilla) a propósito: así queda constancia exacta de lo que el paciente
aceptó en ese momento, aunque el texto por defecto cambie después.

Ver `script_consentimientos_supabase.sql` (raíz del repo) para el esquema.

IMPORTANTE: esto NO es una firma electrónica certificada (no hay validación
de identidad, biometría ni sello criptográfico) -- es un registro simple de
aceptación con nombre + fecha. El frontend deja esto explícito al usuario.
"""
from __future__ import annotations

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field

from app.auth import bearer_token, require_user
from app.routers.playlists import _postgrest

router = APIRouter(prefix="/api", tags=["consentimientos"])

_SELECT = "id,paciente_id,texto,nombre_firma,firmado_en,created_at"


class ConsentimientoCreate(BaseModel):
    paciente_id: str
    texto: str = Field(min_length=1, max_length=8000)
    nombre_firma: str = Field(min_length=1, max_length=200)


@router.get("/consentimientos", summary="Lista los consentimientos firmados de un paciente")
def list_consentimientos(
    paciente_id: str,
    user: dict = Depends(require_user),
    token: str = Depends(bearer_token),
) -> list[dict]:
    resp = _postgrest(
        "GET",
        "/consentimientos",
        token,
        params={
            "select": _SELECT,
            "paciente_id": f"eq.{paciente_id}",
            "order": "firmado_en.desc",
        },
    )
    return resp.json()


@router.post("/consentimientos", status_code=201, summary="Registra un consentimiento firmado")
def create_consentimiento(
    payload: ConsentimientoCreate,
    user: dict = Depends(require_user),
    token: str = Depends(bearer_token),
) -> dict:
    resp = _postgrest(
        "POST",
        "/consentimientos",
        token,
        prefer="return=representation",
        json_body={
            "user_id": user["id"],
            "paciente_id": payload.paciente_id,
            "texto": payload.texto.strip(),
            "nombre_firma": payload.nombre_firma.strip(),
        },
    )
    created = resp.json()
    return created[0] if isinstance(created, list) and created else created
