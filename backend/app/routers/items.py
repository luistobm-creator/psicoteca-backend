"""
Contenido de carpetas y apertura de un item.

GET /api/folders/{folder_id}/items
    Contenido paginado (carpetas + archivos) de los hijos DIRECTOS de una
    carpeta. Envía TODOS los items (incluidos los Pro) con su flag `is_premium`;
    NO filtra por plan. El bloqueo es visual (frontend).

GET /api/items/{item_id}/content
    Proxy autenticado del contenido real del archivo: lo descarga con la Service
    Account y lo streamea al cliente. Es el ÚNICO punto que sirve el fichero y
    donde se aplica la seguridad de plan (403 si es Pro y el usuario no lo es).
    Los enlaces de Drive nunca llegan al navegador.
"""
from __future__ import annotations

from fastapi import APIRouter, Depends, Header, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy import func
from sqlmodel import Session, select

from app.auth import get_user_plan
from app.database import get_session
from app.drive_client import get_drive_service, iter_media, open_media_stream
from app.models import Item
from app.schemas import FolderItemsResponse, ItemRead, PageMeta

router = APIRouter(prefix="/api", tags=["items"])


@router.get(
    "/folders/{folder_id}/items",
    response_model=FolderItemsResponse,
    summary="Contenido paginado de una carpeta (todos los items, con flag Pro)",
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


# Los documentos nativos de Google (Docs/Sheets/Slides) no se pueden descargar
# tal cual: se EXPORTAN a PDF para previsualizarlos.
_GOOGLE_NATIVE_PREFIX = "application/vnd.google-apps."
_EXPORT_MIME = "application/pdf"


def _safe_filename(name: str, native: bool) -> str:
    """Nombre de archivo seguro para la cabecera Content-Disposition (ASCII)."""
    safe = "".join(
        c for c in (name or "") if c.isascii() and (c.isalnum() or c in " ._-()")
    ).strip()
    safe = safe or "archivo"
    if native and not safe.lower().endswith(".pdf"):
        safe += ".pdf"
    return safe


@router.get(
    "/items/{item_id}/content",
    summary="Proxy del contenido real del archivo (403 si es Pro y el plan no lo es)",
)
def get_item_content(
    item_id: str,
    download: bool = Query(
        False, description="Fuerza la descarga (attachment). Exclusivo del plan Pro."
    ),
    range_header: str | None = Header(default=None, alias="Range"),
    session: Session = Depends(get_session),
    plan: str = Depends(get_user_plan),
) -> StreamingResponse:
    """Sirve el archivo a través del backend usando la Service Account.

    Es el ÚNICO punto que entrega el contenido real. Los enlaces de Drive NUNCA
    llegan al cliente: así, aunque los archivos de Drive sean privados, el usuario
    autorizado puede verlos, y uno no autorizado recibe 403 (no un enlace robable).
    """
    item = session.get(Item, item_id)
    if item is None or item.trashed:
        raise HTTPException(status_code=404, detail=f"Elemento '{item_id}' no encontrado.")
    if item.is_folder:
        raise HTTPException(
            status_code=400, detail="Una carpeta no tiene contenido descargable."
        )

    # Seguridad (antes de abrir el stream): el contenido Pro exige plan Pro.
    if item.is_premium and plan != "pro":
        raise HTTPException(status_code=403, detail="Contenido exclusivo del plan Pro.")

    # Descargar (attachment) es una acción EXCLUSIVA del plan Pro, aunque el
    # documento sea libre (la lectura online sí es gratuita). Este gate protege el
    # acceso directo al endpoint; en el lector, el usuario Pro descarga reutilizando
    # los bytes que ya cargó para la vista previa (descarga instantánea).
    if download and plan != "pro":
        raise HTTPException(
            status_code=403, detail="Las descargas son exclusivas del plan Pro."
        )

    native = item.mime_type.startswith(_GOOGLE_NATIVE_PREFIX)
    content_type = _EXPORT_MIME if native else (item.mime_type or "application/octet-stream")
    disposition = "attachment" if download else "inline"
    base_headers = {
        "Content-Disposition": f'{disposition}; filename="{_safe_filename(item.name, native)}"',
        "Cache-Control": "private, max-age=300",
        "X-Content-Type-Options": "nosniff",
    }

    # Documentos NATIVOS de Google (Docs/Sheets/Slides): se EXPORTAN a PDF al vuelo,
    # sin tamaño conocido → no admiten Range. Se streamean completos (son pequeños).
    if native:
        return StreamingResponse(
            iter_media(get_drive_service(), item.id, _EXPORT_MIME),
            media_type=content_type,
            headers=base_headers,
        )

    # Binarios (PDFs, etc.): admiten RANGE. Reenviamos la cabecera Range a Drive y
    # devolvemos 206 Partial Content, así el visor carga de forma PROGRESIVA (índice
    # + páginas visibles) en vez de bajar el archivo entero. Anunciamos Accept-Ranges
    # para que PDF.js active la carga por rangos.
    resp = open_media_stream(item.id, range_header)
    if resp.status_code not in (200, 206):
        resp.close()
        raise HTTPException(
            status_code=502, detail="No se pudo leer el archivo desde el almacenamiento."
        )

    headers = {**base_headers, "Accept-Ranges": "bytes"}
    for h in ("Content-Length", "Content-Range"):
        value = resp.headers.get(h)
        if value:
            headers[h] = value

    def _body():
        try:
            for chunk in resp.iter_content(chunk_size=256 * 1024):
                if chunk:
                    yield chunk
        finally:
            resp.close()

    return StreamingResponse(
        _body(),
        status_code=resp.status_code,
        media_type=content_type,
        headers=headers,
    )
