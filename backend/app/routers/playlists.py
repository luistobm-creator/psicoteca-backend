"""
Favoritos estilo playlists.

Las relaciones favorito↔usuario viven en Supabase Postgres (persistente, con
RLS), NO en la SQLite del backend (efímera en Render, se reconstruye desde Drive
en cada sync). Este router habla con Supabase vía PostgREST REENVIANDO el JWT del
usuario, de modo que las políticas RLS (`auth.uid() = user_id`) hacen cumplir la
propiedad a nivel de base de datos: un usuario nunca ve/toca playlists de otro.

Los metadatos de cada PDF (nombre, is_premium, …) NO están en Postgres: viven en
el catálogo (`items` en SQLite) y se resolverán ahí cuando haga falta (p. ej. al
listar los ítems de una playlist, en un endpoint posterior).
"""
from __future__ import annotations

from typing import List, Optional

import requests
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlmodel import Session, select

from app.auth import bearer_token, require_user
from app.config import settings
from app.database import get_session
from app.models import Item
from app.schemas import ItemRead

router = APIRouter(prefix="/api", tags=["playlists"])


# --- Modelos de request ------------------------------------------------------
class PlaylistCreate(BaseModel):
    name: str = Field(min_length=1, max_length=80)


# --- Cliente PostgREST (reenvía el JWT del usuario → RLS aplica) --------------
def _postgrest(
    method: str,
    path: str,
    token: str,
    *,
    params: dict | None = None,
    json_body: dict | list | None = None,
    prefer: str | None = None,
    raise_on_error: bool = True,
) -> requests.Response:
    """Llama a la API REST (PostgREST) de Supabase con el JWT del usuario.

    Al ir el token del usuario (no la service_role), Postgres aplica las políticas
    RLS automáticamente: no hace falta filtrar por user_id a mano y es imposible
    filtrar datos de otro usuario aunque el código tuviera un descuido.
    """
    base = (settings.supabase_url or "").rstrip("/")
    anon = settings.supabase_anon_key or ""
    if not base or not anon:
        raise HTTPException(status_code=500, detail="Configuración de Supabase incompleta.")
    headers = {
        "apikey": anon,
        "Authorization": f"Bearer {token}",  # JWT del usuario: RLS filtra por dueño
        "Content-Type": "application/json",
    }
    if prefer:
        headers["Prefer"] = prefer
    try:
        resp = requests.request(
            method,
            f"{base}/rest/v1{path}",
            headers=headers,
            params=params,
            json=json_body,
            timeout=10,
        )
    except requests.RequestException:
        raise HTTPException(status_code=502, detail="No se pudo conectar con la base de datos.")
    if raise_on_error and resp.status_code >= 400:
        detail = "Error en la base de datos de favoritos."
        try:
            detail = resp.json().get("message", detail)
        except Exception:
            pass
        raise HTTPException(status_code=502, detail=detail)
    return resp


# --- Endpoints ---------------------------------------------------------------
@router.get("/playlists", summary="Lista las playlists de favoritos del usuario")
def list_playlists(
    user: dict = Depends(require_user),
    token: str = Depends(bearer_token),
) -> list[dict]:
    """Devuelve las playlists del usuario, con el número de ítems de cada una."""
    resp = _postgrest(
        "GET",
        "/playlists",
        token,
        params={
            "select": "id,name,created_at,updated_at,playlist_items(count)",
            "order": "created_at.desc",
        },
    )
    playlists = resp.json()
    # PostgREST anida el conteo como [{"count": N}]; lo aplanamos a `item_count`.
    for p in playlists:
        embedded = p.pop("playlist_items", None) or []
        p["item_count"] = embedded[0]["count"] if embedded else 0
    return playlists


@router.post("/playlists", status_code=201, summary="Crea una playlist de favoritos")
def create_playlist(
    payload: PlaylistCreate,
    user: dict = Depends(require_user),
    token: str = Depends(bearer_token),
) -> dict:
    """Crea una playlist vacía para el usuario autenticado.

    El `user_id` se toma del usuario validado (no del cliente). RLS exige además
    que coincida con `auth.uid()`, así que es imposible crear playlists a nombre
    de otro.
    """
    name = payload.name.strip()
    if not name:
        raise HTTPException(status_code=422, detail="El nombre no puede estar vacío.")
    resp = _postgrest(
        "POST",
        "/playlists",
        token,
        prefer="return=representation",
        json_body={"user_id": user["id"], "name": name},
    )
    created = resp.json()
    row = created[0] if isinstance(created, list) and created else created
    row["item_count"] = 0
    return row


# --- Modelos de request/response de ítems y edición --------------------------
class PlaylistUpdate(BaseModel):
    name: str = Field(min_length=1, max_length=80)


class ItemAdd(BaseModel):
    item_id: str = Field(min_length=1)


class PlaylistItemRead(BaseModel):
    item_id: str
    position: int = 0
    added_at: str
    # Metadata FRESCA del catálogo (nombre/is_premium/ruta). None si el PDF ya no
    # está en la biblioteca (borrado o a mitad de sync) → usar `item_name`.
    item: Optional[ItemRead] = None
    # Snapshot del nombre guardado al agregarlo (fallback para mostrar).
    item_name: Optional[str] = None


class PlaylistDetail(BaseModel):
    id: str
    name: str
    created_at: str
    updated_at: str
    items: List[PlaylistItemRead]


# --- Helper de propiedad -----------------------------------------------------
def _fetch_playlist_or_404(playlist_id: str, token: str) -> dict:
    """Devuelve la playlist (solo si es del usuario, por RLS) o lanza 404."""
    resp = _postgrest(
        "GET",
        "/playlists",
        token,
        params={"id": f"eq.{playlist_id}", "select": "id,name,created_at,updated_at"},
    )
    rows = resp.json()
    if not rows:
        raise HTTPException(status_code=404, detail="Playlist no encontrada.")
    return rows[0]


# --- Endpoints de una playlist ----------------------------------------------
@router.get(
    "/playlists/{playlist_id}",
    response_model=PlaylistDetail,
    summary="Detalle de una playlist con sus PDFs (metadata resuelta del catálogo)",
)
def get_playlist(
    playlist_id: str,
    user: dict = Depends(require_user),
    token: str = Depends(bearer_token),
    session: Session = Depends(get_session),
) -> PlaylistDetail:
    playlist = _fetch_playlist_or_404(playlist_id, token)

    resp = _postgrest(
        "GET",
        "/playlist_items",
        token,
        params={
            "playlist_id": f"eq.{playlist_id}",
            "select": "item_id,item_name,position,added_at",
            "order": "position.asc,added_at.asc",
        },
    )
    rows = resp.json()

    # Resolver los item_id contra el catálogo en UNA sola consulta.
    ids = [r["item_id"] for r in rows]
    catalog: dict[str, Item] = {}
    if ids:
        found = session.exec(
            select(Item).where(Item.id.in_(ids), Item.trashed == False)  # noqa: E712
        ).all()
        catalog = {it.id: it for it in found}

    items = [
        PlaylistItemRead(
            item_id=r["item_id"],
            position=r.get("position") or 0,
            added_at=r["added_at"],
            item=(
                ItemRead.model_validate(catalog[r["item_id"]])
                if r["item_id"] in catalog
                else None
            ),
            item_name=r.get("item_name"),
        )
        for r in rows
    ]
    return PlaylistDetail(**playlist, items=items)


@router.patch("/playlists/{playlist_id}", summary="Renombra una playlist")
def rename_playlist(
    playlist_id: str,
    payload: PlaylistUpdate,
    user: dict = Depends(require_user),
    token: str = Depends(bearer_token),
) -> dict:
    name = payload.name.strip()
    if not name:
        raise HTTPException(status_code=422, detail="El nombre no puede estar vacío.")
    resp = _postgrest(
        "PATCH",
        "/playlists",
        token,
        params={"id": f"eq.{playlist_id}"},
        json_body={"name": name},
        prefer="return=representation",
    )
    rows = resp.json()
    if not rows:
        raise HTTPException(status_code=404, detail="Playlist no encontrada.")
    return rows[0]


@router.delete(
    "/playlists/{playlist_id}",
    status_code=204,
    summary="Elimina una playlist (y sus ítems en cascada)",
)
def delete_playlist(
    playlist_id: str,
    user: dict = Depends(require_user),
    token: str = Depends(bearer_token),
) -> None:
    resp = _postgrest(
        "DELETE",
        "/playlists",
        token,
        params={"id": f"eq.{playlist_id}"},
        prefer="return=representation",
    )
    if not resp.json():
        raise HTTPException(status_code=404, detail="Playlist no encontrada.")


# --- Endpoints de ítems dentro de una playlist ------------------------------
@router.post(
    "/playlists/{playlist_id}/items",
    status_code=201,
    response_model=PlaylistItemRead,
    summary="Agrega un PDF a la playlist",
)
def add_item(
    playlist_id: str,
    payload: ItemAdd,
    user: dict = Depends(require_user),
    token: str = Depends(bearer_token),
    session: Session = Depends(get_session),
) -> PlaylistItemRead:
    # 1) La playlist debe existir y ser del usuario.
    _fetch_playlist_or_404(playlist_id, token)

    # 2) El PDF debe existir en el catálogo (y no estar en la papelera).
    item = session.get(Item, payload.item_id)
    if item is None or item.trashed:
        raise HTTPException(
            status_code=400, detail="Ese documento no existe en la biblioteca."
        )
    if item.is_folder:
        raise HTTPException(
            status_code=400, detail="Solo se pueden guardar documentos, no carpetas."
        )

    # 3) Insertar con snapshot del nombre. unique(playlist_id,item_id) evita duplicados.
    resp = _postgrest(
        "POST",
        "/playlist_items",
        token,
        json_body={
            "playlist_id": playlist_id,
            "item_id": item.id,
            "item_name": item.name,
        },
        prefer="return=representation",
        raise_on_error=False,
    )
    if resp.status_code == 409:
        raise HTTPException(status_code=409, detail="Ese PDF ya está en la playlist.")
    if resp.status_code >= 400:
        raise HTTPException(status_code=502, detail="No se pudo agregar el PDF.")

    row = resp.json()[0]
    return PlaylistItemRead(
        item_id=row["item_id"],
        position=row.get("position") or 0,
        added_at=row["added_at"],
        item=ItemRead.model_validate(item),
        item_name=row.get("item_name"),
    )


@router.delete(
    "/playlists/{playlist_id}/items/{item_id}",
    status_code=204,
    summary="Quita un PDF de la playlist",
)
def remove_item(
    playlist_id: str,
    item_id: str,
    user: dict = Depends(require_user),
    token: str = Depends(bearer_token),
) -> None:
    resp = _postgrest(
        "DELETE",
        "/playlist_items",
        token,
        params={"playlist_id": f"eq.{playlist_id}", "item_id": f"eq.{item_id}"},
        prefer="return=representation",
    )
    if not resp.json():
        raise HTTPException(status_code=404, detail="Ese PDF no está en la playlist.")
