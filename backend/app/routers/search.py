"""
GET /api/search?q=...

Búsqueda full-text instantánea sobre el NOMBRE y la RUTA de cada elemento,
usando la tabla virtual FTS5 `items_fts` (mantenida en sincronía por triggers).
Se une con `items` por `rowid` y se ordena por relevancia (`rank`, BM25).

La consulta del usuario se sanea antes de pasarla a MATCH: se extraen solo
tokens tipo palabra (soporta acentos y ñ), cada uno se cita para neutralizar la
sintaxis especial de FTS5 (comillas, `*`, `AND`/`OR`/`NEAR`, `:`...) y se marca
como prefijo para permitir búsqueda "mientras se escribe". Así una entrada
arbitraria nunca provoca `fts5: syntax error`.
"""
from __future__ import annotations

import re

from fastapi import APIRouter, Depends, Query
from sqlalchemy import text
from sqlmodel import Session

from app.database import get_session
from app.schemas import ItemRead, SearchResponse

router = APIRouter(prefix="/api", tags=["search"])

# Tokens tipo palabra (con soporte Unicode para acentos y ñ).
_TOKEN_RE = re.compile(r"\w+", re.UNICODE)


def build_match_query(q: str) -> str:
    """Convierte texto libre en una expresión MATCH segura para FTS5.

    Ej.: 'abuso sexual' -> '"abuso"* "sexual"*'  (AND implícito, prefijos).
    Devuelve '' si no hay ningún token utilizable.
    """
    return " ".join(f'"{tok}"*' for tok in _TOKEN_RE.findall(q))


# Columnas de `items` que se proyectan a `ItemRead`.
_SELECT_COLS = """
    i.id, i.name, i.mime_type, i.is_folder, i.parent_id,
    i.size, i.modified_time, i.created_time,
    i.web_view_link, i.icon_link, i.path, i.depth
"""


@router.get(
    "/search",
    response_model=SearchResponse,
    summary="Búsqueda full-text (FTS5) por nombre y ruta",
)
def search(
    q: str = Query(..., min_length=1, description="Texto a buscar (nombre y ruta)"),
    limit: int = Query(50, ge=1, le=200, description="Máx. resultados a devolver"),
    offset: int = Query(0, ge=0, description="Desplazamiento para paginación"),
    folders_only: bool = Query(False, description="Devolver solo carpetas"),
    session: Session = Depends(get_session),
) -> SearchResponse:
    match = build_match_query(q)
    if not match:
        # La consulta no contiene términos buscables: respuesta vacía, sin error.
        return SearchResponse(
            query=q, total=0, count=0, limit=limit, offset=offset, items=[]
        )

    # `folders_only` es un bool controlado por nosotros (no hay inyección posible);
    # el resto de valores van como parámetros vinculados.
    folder_filter = "AND i.is_folder = 1" if folders_only else ""

    total = session.execute(
        text(
            f"""
            SELECT COUNT(*)
            FROM items_fts f
            JOIN items i ON i.rowid = f.rowid
            WHERE items_fts MATCH :match
              AND i.trashed = 0
              {folder_filter}
            """
        ),
        {"match": match},
    ).scalar_one()

    rows = (
        session.execute(
            text(
                f"""
                SELECT {_SELECT_COLS}
                FROM items_fts f
                JOIN items i ON i.rowid = f.rowid
                WHERE items_fts MATCH :match
                  AND i.trashed = 0
                  {folder_filter}
                ORDER BY rank
                LIMIT :limit OFFSET :offset
                """
            ),
            {"match": match, "limit": limit, "offset": offset},
        )
        .mappings()
        .all()
    )

    items = [ItemRead.model_validate(dict(r)) for r in rows]
    return SearchResponse(
        query=q,
        total=total,
        count=len(items),
        limit=limit,
        offset=offset,
        items=items,
    )
