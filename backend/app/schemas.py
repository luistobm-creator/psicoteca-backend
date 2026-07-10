"""
Esquemas Pydantic para las respuestas de la API.

Separados de los modelos de tabla (`app.models`) para poder exponer solo los
campos que interesan al frontend y documentar automáticamente la API en /docs.
"""
from __future__ import annotations

from typing import List, Optional

from pydantic import BaseModel, ConfigDict


class ItemRead(BaseModel):
    """Un archivo o carpeta tal como se devuelve al frontend."""

    # Permite construir el esquema directamente desde un objeto `Item` (ORM).
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    mime_type: str
    is_folder: bool
    parent_id: Optional[str] = None
    size: Optional[int] = None
    modified_time: Optional[str] = None
    created_time: Optional[str] = None
    web_view_link: Optional[str] = None
    icon_link: Optional[str] = None
    path: Optional[str] = None
    depth: Optional[int] = None


class TreeNode(BaseModel):
    """Nodo de carpeta para el árbol jerárquico del Sidebar (solo carpetas)."""

    id: str
    name: str
    path: Optional[str] = None
    depth: Optional[int] = None
    child_count: int = 0             # nº de subcarpetas directas
    children: List["TreeNode"] = []


class PageMeta(BaseModel):
    """Metadatos de paginación."""

    total: int
    page: int
    page_size: int
    total_pages: int
    has_next: bool
    has_prev: bool


class FolderItemsResponse(BaseModel):
    """Contenido paginado de una carpeta (carpetas + archivos hijos directos)."""

    folder: ItemRead
    pagination: PageMeta
    items: List[ItemRead]


class SearchResponse(BaseModel):
    """Resultados de una búsqueda full-text."""

    query: str
    total: int                       # total de coincidencias en la BD
    count: int                       # nº de resultados en esta página
    limit: int
    offset: int
    items: List[ItemRead]


# Necesario para resolver la auto-referencia `children: List["TreeNode"]`.
TreeNode.model_rebuild()
