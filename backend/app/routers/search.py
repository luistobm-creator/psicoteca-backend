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

Contenido Pro: se devuelven TODOS los resultados con su flag `is_premium`; no se
filtra por plan (gating visual en el frontend).

Rendimiento: se ignoran las consultas con menos de `_MIN_QUERY_CHARS` caracteres
útiles (un prefijo de 1–2 letras casa contra casi todo el índice) y el conteo de
coincidencias se acota a `_COUNT_CAP` (el total exacto solo era cosmético, la
búsqueda no pagina). Ambas cosas eran la causa de los timeouts en Render free.
"""
from __future__ import annotations

import re
from enum import Enum

from fastapi import APIRouter, Depends, Query
from sqlalchemy import text
from sqlmodel import Session

from app.database import get_session
from app.schemas import ItemRead, SearchResponse

router = APIRouter(prefix="/api", tags=["search"])

# Tokens tipo palabra (con soporte Unicode para acentos y ñ).
_TOKEN_RE = re.compile(r"\w+", re.UNICODE)

# Longitud mínima de caracteres útiles para lanzar una búsqueda. Un prefijo de
# 1–2 caracteres (p. ej. "de"*) casa contra casi los +14k ítems y obliga a FTS5
# a recorrer el índice entero (dos veces: conteo + ranking BM25), que era la
# causa de los timeouts en el plan free de Render. El frontend aplica el mismo
# mínimo; esta guarda es defensa en profundidad ante llamadas directas a la API.
_MIN_QUERY_CHARS = 3

# Techo del conteo de coincidencias. No contamos sin límite: al alcanzar el tope
# paramos y el frontend muestra "N+". El total exacto solo era cosmético (la
# búsqueda no pagina), así que acotarlo elimina un escaneo caro sin perder nada.
_COUNT_CAP = 500


class SearchOrderBy(str, Enum):
    """Orden de los resultados de búsqueda (relevancia por defecto)."""

    relevance = "relevance"  # BM25 (rank) — por defecto
    name = "name"            # A → Z
    name_desc = "name_desc"  # Z → A
    recent = "recent"        # modificado: nuevos primero
    oldest = "oldest"        # modificado: antiguos primero
    largest = "largest"      # tamaño: mayores primero
    smallest = "smallest"    # tamaño: menores primero


# Fragmento ORDER BY por modo. SEGURO frente a inyección: la clave viene de un
# enum validado por FastAPI (no de texto libre), igual que `folder_filter`; nunca
# se interpola input del usuario. Para los modos no-relevancia se añade
# `lower(i.name)` como desempate estable.
_SEARCH_ORDER: dict[SearchOrderBy, str] = {
    SearchOrderBy.relevance: "rank",
    SearchOrderBy.name: "lower(i.name)",
    SearchOrderBy.name_desc: "lower(i.name) DESC",
    SearchOrderBy.recent: "i.modified_time DESC, lower(i.name)",
    SearchOrderBy.oldest: "i.modified_time ASC, lower(i.name)",
    SearchOrderBy.largest: "i.size DESC, lower(i.name)",
    SearchOrderBy.smallest: "i.size ASC, lower(i.name)",
}


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
    i.icon_link, i.path, i.depth, i.is_premium
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
    order_by: SearchOrderBy = Query(
        SearchOrderBy.relevance,
        description="Orden: relevance (por defecto), name, name_desc, recent, oldest, largest, smallest",
    ),
    session: Session = Depends(get_session),
) -> SearchResponse:
    match = build_match_query(q)
    # Guarda de rendimiento: descarta consultas demasiado cortas. Un prefijo de
    # 1–2 caracteres casa contra casi todos los ítems y fuerza un escaneo completo
    # del índice (conteo + ranking), la causa de los timeouts en Render free.
    meaningful_chars = sum(len(tok) for tok in _TOKEN_RE.findall(q))
    if not match or meaningful_chars < _MIN_QUERY_CHARS:
        # Sin términos buscables o consulta demasiado corta: vacío, sin error.
        return SearchResponse(
            query=q, total=0, count=0, limit=limit, offset=offset, items=[]
        )

    # `folders_only` es un bool controlado por nosotros (no hay inyección posible);
    # el resto de valores van como parámetros vinculados.
    folder_filter = "AND i.is_folder = 1" if folders_only else ""

    # Conteo ACOTADO: se detiene al llegar a `_COUNT_CAP` coincidencias en lugar
    # de recorrerlas todas. `total_capped` avisa al frontend para mostrar "N+".
    total = session.execute(
        text(
            f"""
            SELECT COUNT(*) FROM (
                SELECT 1
                FROM items_fts f
                JOIN items i ON i.rowid = f.rowid
                WHERE items_fts MATCH :match
                  AND i.trashed = 0
                  {folder_filter}
                LIMIT :cap
            ) AS capped
            """
        ),
        {"match": match, "cap": _COUNT_CAP},
    ).scalar_one()
    total_capped = total >= _COUNT_CAP

    # Fragmento ORDER BY según el modo pedido (relevancia por defecto). La clave es
    # un enum validado, así que la interpolación es segura (ver _SEARCH_ORDER).
    order_clause = _SEARCH_ORDER[order_by]

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
                ORDER BY {order_clause}
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
        total_capped=total_capped,
        count=len(items),
        limit=limit,
        offset=offset,
        items=items,
    )
