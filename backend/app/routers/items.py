"""
GET /api/folders/{folder_id}/items

Devuelve el contenido paginado (carpetas + archivos) de los hijos DIRECTOS de
una carpeta, usando la lista de adyacencia (`parent_id`). Las carpetas se
listan primero y luego los archivos, ambos en orden alfabético.
"""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func
from sqlmodel import Session, select

from app.database import get_session
from app.models import Item
from app.schemas import FolderItemsResponse, ItemRead, PageMeta

router = APIRouter(prefix="/api", tags=["items"])


@router.get(
    "/folders/{folder_id}/items",
    response_model=FolderItemsResponse,
    summary="Contenido paginado de una carpeta",
)
def get_folder_items(
    folder_id: str,
    page: int = Query(1, ge=1, description="Número de página (empieza en 1)"),
    page_size: int = Query(100, ge=1, le=500, description="Elementos por página"),
    session: Session = Depends(get_session),
) -> FolderItemsResponse:
    # 1) Validar que la carpeta existe, está activa y es realmente una carpeta.
    folder = session.get(Item, folder_id)
    if folder is None or folder.trashed:
        raise HTTPException(
            status_code=404, detail=f"Carpeta '{folder_id}' no encontrada."
        )
    if not folder.is_folder:
        raise HTTPException(
            status_code=400, detail=f"El elemento '{folder_id}' no es una carpeta."
        )

    # 2) Total de hijos directos activos (para la paginación).
    total = session.scalar(
        select(func.count())
        .select_from(Item)
        .where(Item.parent_id == folder_id, Item.trashed == False)  # noqa: E712
    ) or 0

    # 3) Página solicitada: carpetas primero, luego archivos, orden alfabético.
    items = session.exec(
        select(Item)
        .where(Item.parent_id == folder_id, Item.trashed == False)  # noqa: E712
        .order_by(Item.is_folder.desc(), func.lower(Item.name))
        .offset((page - 1) * page_size)
        .limit(page_size)
    ).all()

    total_pages = (total + page_size - 1) // page_size if total else 0
    pagination = PageMeta(
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages,
        has_next=page < total_pages,
        has_prev=page > 1,
    )

    return FolderItemsResponse(
        folder=ItemRead.model_validate(folder),
        pagination=pagination,
        items=[ItemRead.model_validate(i) for i in items],
    )
