"""
Perfiles de Comunidad + Ranking.

La Comunidad es OPT-IN: un perfil solo es visible para otros (directorio,
ranking, para poder mandarle un mensaje) cuando `activo=true`. Antes de
activarlo, el propio dueño lo sigue viendo (para editarlo) pero nadie más.

El PUNTAJE del ranking (`puntos`) es DELIBERADAMENTE de solo lectura para el
cliente: nunca se acepta por PUT. Se calcula aquí mismo, en el servidor,
leyendo el propio Glosario/Exámenes del usuario con SU PROPIO token — la RLS
de esas tablas (`auth.uid() = user_id`) garantiza que solo puede leer sus
propias filas, así que ni siquiera un cliente manipulado puede inflar su
puntaje ni leer contenido de exámenes/glosario ajeno: aquí solo se publica un
entero agregado, nunca el contenido.

Fórmula (transparente, se muestra tal cual en la UI):
    puntos = 1 × términos del Glosario + 5 × exámenes aprobados (≥70%)

Ver `script_comunidad_supabase.sql` (raíz del repo) para el esquema completo
del ecosistema de Comunidad (perfiles, grupos, mensajes).
"""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field

from app.auth import bearer_token, require_user
from app.routers.playlists import _postgrest

router = APIRouter(prefix="/api/comunidad", tags=["comunidad"])

_SELECT = "user_id,nombre_publico,especialidad,bio,activo,puntos,puntos_actualizado_en,created_at,updated_at"
_SELECT_PUBLICO = "user_id,nombre_publico,especialidad,bio,puntos,puntos_actualizado_en"

_DEFAULTS = {
    "nombre_publico": None,
    "especialidad": None,
    "bio": None,
    "activo": False,
    "puntos": 0,
    "puntos_actualizado_en": None,
}


def tengo_perfil_activo(user_id: str, token: str) -> bool:
    """¿Tiene ESTE user_id el perfil de comunidad activo? Usada por
    grupos/mensajes para exigir un perfil activo antes de participar.

    OJO: el filtro `user_id` explícito es imprescindible -- sin él, la
    policy de select ("activo=true OR auth.uid()=user_id") devolvería
    también perfiles ACTIVOS de OTROS usuarios, no solo el propio.
    """
    resp = _postgrest(
        "GET",
        "/perfiles_comunidad",
        token,
        params={"select": "activo", "user_id": f"eq.{user_id}"},
        raise_on_error=False,
    )
    rows = resp.json() if resp.status_code < 400 else []
    return bool(rows and rows[0].get("activo"))


class PerfilUpdate(BaseModel):
    # Deliberadamente SIN `puntos`: ese campo solo lo escribe
    # `actualizar_puntos`, nunca un PUT directo del cliente.
    nombre_publico: Optional[str] = Field(default=None, max_length=100)
    especialidad: Optional[str] = Field(default=None, max_length=150)
    bio: Optional[str] = Field(default=None, max_length=600)
    activo: Optional[bool] = None


@router.get("/perfil", summary="Lee mi propio perfil de comunidad")
def get_mi_perfil(
    user: dict = Depends(require_user),
    token: str = Depends(bearer_token),
) -> dict:
    resp = _postgrest(
        "GET",
        "/perfiles_comunidad",
        token,
        params={"select": _SELECT, "user_id": f"eq.{user['id']}"},
    )
    rows = resp.json()
    if rows:
        return rows[0]
    return {"user_id": user["id"], **_DEFAULTS}


@router.put("/perfil", summary="Activa/edita mi perfil de comunidad (upsert)")
def upsert_mi_perfil(
    payload: PerfilUpdate,
    user: dict = Depends(require_user),
    token: str = Depends(bearer_token),
) -> dict:
    body = payload.model_dump(mode="json", exclude_unset=True)
    body["user_id"] = user["id"]

    resp = _postgrest(
        "POST",
        "/perfiles_comunidad",
        token,
        params={"select": _SELECT, "on_conflict": "user_id"},
        prefer="resolution=merge-duplicates,return=representation",
        json_body=body,
    )
    created = resp.json()
    return created[0] if isinstance(created, list) and created else created


@router.post("/actualizar-puntos", summary="Recalcula y publica mi puntaje del ranking")
def actualizar_puntos(
    user: dict = Depends(require_user),
    token: str = Depends(bearer_token),
) -> dict:
    glosario_resp = _postgrest(
        "GET", "/glosario_clinico", token, params={"select": "id"}, raise_on_error=False
    )
    examenes_resp = _postgrest(
        "GET",
        "/examenes",
        token,
        params={"select": "respuestas_correctas,num_preguntas"},
        raise_on_error=False,
    )

    num_terminos = len(glosario_resp.json()) if glosario_resp.status_code < 400 else 0
    examenes = examenes_resp.json() if examenes_resp.status_code < 400 else []
    aprobados = sum(
        1 for e in examenes if e["num_preguntas"] and e["respuestas_correctas"] / e["num_preguntas"] >= 0.7
    )
    puntos = num_terminos * 1 + aprobados * 5

    resp = _postgrest(
        "POST",
        "/perfiles_comunidad",
        token,
        params={"select": _SELECT, "on_conflict": "user_id"},
        prefer="resolution=merge-duplicates,return=representation",
        json_body={
            "user_id": user["id"],
            "puntos": puntos,
            "puntos_actualizado_en": datetime.now(timezone.utc).isoformat(),
        },
        raise_on_error=False,
    )
    if resp.status_code >= 400:
        raise HTTPException(status_code=502, detail="No se pudo actualizar tu puntaje.")
    created = resp.json()
    return created[0] if isinstance(created, list) and created else created


@router.get("/directorio", summary="Directorio de perfiles activos de la comunidad")
def get_directorio(
    limit: int = Query(default=100, ge=1, le=300),
    user: dict = Depends(require_user),
    token: str = Depends(bearer_token),
) -> list[dict]:
    resp = _postgrest(
        "GET",
        "/perfiles_comunidad",
        token,
        params={
            "select": _SELECT_PUBLICO,
            "activo": "eq.true",
            "user_id": f"neq.{user['id']}",
            "order": "nombre_publico.asc",
            "limit": str(limit),
        },
    )
    return resp.json()


@router.get("/ranking", summary="Ranking de la comunidad (por puntaje)")
def get_ranking(
    limit: int = Query(default=50, ge=1, le=100),
    user: dict = Depends(require_user),
    token: str = Depends(bearer_token),
) -> list[dict]:
    resp = _postgrest(
        "GET",
        "/perfiles_comunidad",
        token,
        params={
            "select": _SELECT_PUBLICO,
            "activo": "eq.true",
            "order": "puntos.desc,nombre_publico.asc",
            "limit": str(limit),
        },
    )
    return resp.json()


@router.get("/perfiles/{other_user_id}", summary="Ve el perfil público de otro miembro de la comunidad")
def get_perfil_publico(
    other_user_id: str,
    user: dict = Depends(require_user),
    token: str = Depends(bearer_token),
) -> dict:
    resp = _postgrest(
        "GET",
        "/perfiles_comunidad",
        token,
        params={"select": _SELECT_PUBLICO, "user_id": f"eq.{other_user_id}"},
    )
    rows = resp.json()
    if not rows:
        raise HTTPException(status_code=404, detail="Ese perfil no existe o no está activo.")
    return rows[0]
