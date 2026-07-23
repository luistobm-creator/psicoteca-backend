"""
Mensajes directos (1 a 1) entre miembros de la Comunidad.

Enviar un mensaje requiere que TANTO el remitente como el destinatario
tengan el perfil de Comunidad activo (`activo=true`) -- si nadie puede verte
en el directorio, tampoco tiene sentido que te escriban. Se valida aquí en
el backend, no solo en el frontend.

La bandeja (`list_mensajes`) trae TODOS los mensajes propios (enviados y
recibidos, límite 500) y el frontend los agrupa por conversación -- volumen
bajo esperado para un feature nuevo, así que no hace falta una vista SQL de
"última conversación por contacto" todavía.

Ver `script_comunidad_supabase.sql` (raíz del repo) para el esquema.
"""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from app.auth import bearer_token, require_user
from app.routers.comunidad_perfiles import tengo_perfil_activo
from app.routers.playlists import _postgrest

router = APIRouter(prefix="/api/comunidad", tags=["comunidad"])

_SELECT = "id,remitente_id,destinatario_id,contenido,leido,created_at"


class MensajeCreate(BaseModel):
    destinatario_id: str
    contenido: str = Field(min_length=1, max_length=2000)


class MensajeMarcarLeido(BaseModel):
    leido: bool = True


@router.get("/mensajes", summary="Todos mis mensajes directos (enviados y recibidos)")
def list_mensajes(
    user: dict = Depends(require_user),
    token: str = Depends(bearer_token),
) -> list[dict]:
    resp = _postgrest(
        "GET",
        "/mensajes_directos",
        token,
        params={
            "select": _SELECT,
            "or": f"(remitente_id.eq.{user['id']},destinatario_id.eq.{user['id']})",
            "order": "created_at.desc",
            "limit": "500",
        },
    )
    return resp.json()


@router.get("/mensajes/{otro_user_id}", summary="Hilo de mensajes con un usuario concreto")
def get_hilo(
    otro_user_id: str,
    user: dict = Depends(require_user),
    token: str = Depends(bearer_token),
) -> list[dict]:
    resp = _postgrest(
        "GET",
        "/mensajes_directos",
        token,
        params={
            "select": _SELECT,
            "or": (
                f"(and(remitente_id.eq.{user['id']},destinatario_id.eq.{otro_user_id}),"
                f"and(remitente_id.eq.{otro_user_id},destinatario_id.eq.{user['id']}))"
            ),
            "order": "created_at.asc",
            "limit": "500",
        },
    )
    return resp.json()


@router.post("/mensajes", status_code=201, summary="Envía un mensaje directo")
def create_mensaje(
    payload: MensajeCreate,
    user: dict = Depends(require_user),
    token: str = Depends(bearer_token),
) -> dict:
    if payload.destinatario_id == user["id"]:
        raise HTTPException(status_code=422, detail="No puedes enviarte un mensaje a ti mismo.")
    if not tengo_perfil_activo(user["id"], token):
        raise HTTPException(status_code=403, detail="Activa tu perfil de comunidad para enviar mensajes.")
    if not tengo_perfil_activo(payload.destinatario_id, token):
        raise HTTPException(status_code=404, detail="Ese destinatario no tiene un perfil de comunidad activo.")

    resp = _postgrest(
        "POST",
        "/mensajes_directos",
        token,
        prefer="return=representation",
        raise_on_error=False,
        json_body={
            "remitente_id": user["id"],
            "destinatario_id": payload.destinatario_id,
            "contenido": payload.contenido.strip(),
        },
    )
    if resp.status_code >= 400:
        raise HTTPException(status_code=502, detail="No se pudo enviar el mensaje.")
    created = resp.json()
    return created[0] if isinstance(created, list) and created else created


@router.patch("/mensajes/{mensaje_id}", summary="Marca un mensaje recibido como leído")
def marcar_leido(
    mensaje_id: str,
    payload: MensajeMarcarLeido,
    user: dict = Depends(require_user),
    token: str = Depends(bearer_token),
) -> dict:
    resp = _postgrest(
        "PATCH",
        "/mensajes_directos",
        token,
        params={"id": f"eq.{mensaje_id}", "select": _SELECT},
        json_body={"leido": payload.leido},
        prefer="return=representation",
        raise_on_error=False,
    )
    rows = resp.json() if resp.status_code < 400 else []
    if not rows:
        raise HTTPException(status_code=404, detail="Ese mensaje no existe o no eres el destinatario.")
    return rows[0]
