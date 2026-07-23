"""
Grupos de estudio: nombre + descripción visibles para cualquier usuario
autenticado (hace falta poder "descubrir" un grupo antes de unirte); la
membresía y los mensajes del grupo solo son legibles para sus miembros
ACTUALES (si sales del grupo, pierdes acceso a su historial).

Unirse a un grupo requiere tener el perfil de Comunidad activo (`activo`),
igual que enviar un mensaje directo — se valida aquí en el backend, no solo
en el frontend.

Ver `script_comunidad_supabase.sql` (raíz del repo) para el esquema.
"""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from app.auth import bearer_token, require_user
from app.routers.comunidad_perfiles import tengo_perfil_activo
from app.routers.playlists import _postgrest

router = APIRouter(prefix="/api/comunidad", tags=["comunidad"])

_SELECT_GRUPO = "id,nombre,descripcion,creado_por,created_at,miembros:grupos_miembros(count)"
_SELECT_MENSAJE = "id,grupo_id,user_id,contenido,created_at"


class GrupoCreate(BaseModel):
    nombre: str = Field(min_length=1, max_length=120)
    descripcion: str | None = Field(default=None, max_length=600)


class MensajeGrupoCreate(BaseModel):
    contenido: str = Field(min_length=1, max_length=2000)


@router.get("/grupos", summary="Lista todos los grupos de estudio (con número de miembros)")
def list_grupos(
    user: dict = Depends(require_user),
    token: str = Depends(bearer_token),
) -> list[dict]:
    resp = _postgrest(
        "GET",
        "/grupos_estudio",
        token,
        params={"select": _SELECT_GRUPO, "order": "created_at.desc"},
    )
    return resp.json()


@router.get("/grupos/mis-membresias", summary="Los grupos a los que ya pertenezco")
def list_mis_membresias(
    user: dict = Depends(require_user),
    token: str = Depends(bearer_token),
) -> list[dict]:
    resp = _postgrest(
        "GET",
        "/grupos_miembros",
        token,
        params={"select": "grupo_id,rol,joined_at", "user_id": f"eq.{user['id']}"},
    )
    return resp.json()


@router.post("/grupos", status_code=201, summary="Crea un grupo de estudio (y te une como creador)")
def create_grupo(
    payload: GrupoCreate,
    user: dict = Depends(require_user),
    token: str = Depends(bearer_token),
) -> dict:
    if not tengo_perfil_activo(user["id"], token):
        raise HTTPException(status_code=403, detail="Activa tu perfil de comunidad para crear un grupo.")

    resp = _postgrest(
        "POST",
        "/grupos_estudio",
        token,
        prefer="return=representation",
        raise_on_error=False,
        json_body={
            "nombre": payload.nombre.strip(),
            "descripcion": (payload.descripcion or "").strip() or None,
            "creado_por": user["id"],
        },
    )
    if resp.status_code >= 400:
        raise HTTPException(status_code=502, detail="No se pudo crear el grupo.")
    grupo = resp.json()
    grupo = grupo[0] if isinstance(grupo, list) and grupo else grupo

    # Auto-unir al creador como primer miembro (rol 'creador'). Si esto
    # falla, el grupo queda creado pero sin miembros -- no revertimos la
    # creación por un fallo secundario, el creador puede unirse manualmente.
    _postgrest(
        "POST",
        "/grupos_miembros",
        token,
        raise_on_error=False,
        json_body={"grupo_id": grupo["id"], "user_id": user["id"], "rol": "creador"},
    )
    grupo["miembros"] = [{"count": 1}]
    return grupo


@router.post("/grupos/{grupo_id}/unirse", status_code=201, summary="Únete a un grupo de estudio")
def unirse_a_grupo(
    grupo_id: str,
    user: dict = Depends(require_user),
    token: str = Depends(bearer_token),
) -> dict:
    if not tengo_perfil_activo(user["id"], token):
        raise HTTPException(status_code=403, detail="Activa tu perfil de comunidad para unirte a un grupo.")

    resp = _postgrest(
        "POST",
        "/grupos_miembros",
        token,
        prefer="return=representation",
        raise_on_error=False,
        json_body={"grupo_id": grupo_id, "user_id": user["id"], "rol": "miembro"},
    )
    if resp.status_code >= 400:
        raise HTTPException(status_code=502, detail="No se pudo unir al grupo (¿ya eres miembro?).")
    created = resp.json()
    return created[0] if isinstance(created, list) and created else created


@router.delete("/grupos/{grupo_id}/salir", status_code=204, summary="Sal de un grupo de estudio")
def salir_de_grupo(
    grupo_id: str,
    user: dict = Depends(require_user),
    token: str = Depends(bearer_token),
) -> None:
    _postgrest(
        "DELETE",
        "/grupos_miembros",
        token,
        params={"grupo_id": f"eq.{grupo_id}", "user_id": f"eq.{user['id']}"},
    )


@router.get("/grupos/{grupo_id}/mensajes", summary="Mensajes de un grupo (solo si eres miembro)")
def list_mensajes_grupo(
    grupo_id: str,
    user: dict = Depends(require_user),
    token: str = Depends(bearer_token),
) -> list[dict]:
    resp = _postgrest(
        "GET",
        "/grupos_mensajes",
        token,
        params={
            "select": _SELECT_MENSAJE,
            "grupo_id": f"eq.{grupo_id}",
            "order": "created_at.asc",
            "limit": "500",
        },
    )
    return resp.json()


@router.post("/grupos/{grupo_id}/mensajes", status_code=201, summary="Envía un mensaje al grupo")
def create_mensaje_grupo(
    grupo_id: str,
    payload: MensajeGrupoCreate,
    user: dict = Depends(require_user),
    token: str = Depends(bearer_token),
) -> dict:
    resp = _postgrest(
        "POST",
        "/grupos_mensajes",
        token,
        prefer="return=representation",
        raise_on_error=False,
        json_body={"grupo_id": grupo_id, "user_id": user["id"], "contenido": payload.contenido.strip()},
    )
    if resp.status_code >= 400:
        raise HTTPException(status_code=403, detail="No se pudo enviar el mensaje (¿eres miembro de este grupo?).")
    created = resp.json()
    return created[0] if isinstance(created, list) and created else created
