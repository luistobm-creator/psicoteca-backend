"""
GET /api/tree

Devuelve la estructura jerárquica de CARPETAS (sin archivos) para el Sidebar
del frontend. El árbol se reconstruye en memoria a partir de la lista de
adyacencia (`items.parent_id`): se cargan todas las carpetas de una vez y se
enlazan padres con hijos en una sola pasada (O(n)). Con ~3.8k carpetas esto es
instantáneo y evita consultas recursivas.

Estrategia de contenido Pro (gating visual): NO se ocultan carpetas. Se envía el
árbol COMPLETO con el flag `is_premium` por nodo; el frontend muestra el candado
y bloquea la navegación. La seguridad real vive en el endpoint de contenido
(`/api/items/{id}/open`), no aquí.
"""
from __future__ import annotations

from typing import List

from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlmodel import Session

from app.database import get_session
from app.schemas import TreeNode

router = APIRouter(prefix="/api", tags=["tree"])


@router.get(
    "/tree",
    response_model=List[TreeNode],
    summary="Árbol jerárquico de carpetas (Sidebar)",
)
def get_tree(session: Session = Depends(get_session)) -> List[dict]:
    # Solo carpetas activas. Ordenar por (depth, name) garantiza que, dentro de
    # cada padre, los hijos se añadan ya ordenados alfabéticamente.
    rows = (
        session.execute(
            text(
                """
                SELECT id, name, parent_id, path, depth, is_premium
                FROM items
                WHERE is_folder = 1 AND trashed = 0
                ORDER BY depth, name COLLATE NOCASE
                """
            )
        )
        .mappings()
        .all()
    )

    # 1) Crear todos los nodos indexados por id.
    nodes: dict[str, dict] = {
        r["id"]: {
            "id": r["id"],
            "name": r["name"],
            "path": r["path"],
            "depth": r["depth"],
            "is_premium": bool(r["is_premium"]),
            "child_count": 0,
            "children": [],
        }
        for r in rows
    }

    # 2) Enlazar cada nodo con su padre. Los que no tienen padre en el conjunto
    #    (raíz con parent_id NULL, o carpetas huérfanas) suben al nivel superior.
    roots: List[dict] = []
    for r in rows:
        node = nodes[r["id"]]
        parent = nodes.get(r["parent_id"]) if r["parent_id"] else None
        if parent is not None:
            parent["children"].append(node)
            parent["child_count"] += 1
        else:
            roots.append(node)

    return roots
