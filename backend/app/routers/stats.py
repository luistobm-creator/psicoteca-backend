"""
GET /api/stats

Resumen global de la biblioteca para el Dashboard de bienvenida: totales de
documentos y carpetas, además de metadatos del último sincronizado.
"""
from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlmodel import Session

from app.database import get_session

router = APIRouter(prefix="/api", tags=["stats"])


@router.get("/stats", summary="Resumen global de la biblioteca")
def get_stats(session: Session = Depends(get_session)) -> dict:
    counts = (
        session.execute(
            text(
                """
                SELECT
                    COUNT(*) AS total,
                    SUM(CASE WHEN is_folder = 1 THEN 1 ELSE 0 END) AS folders,
                    SUM(CASE WHEN is_folder = 0 THEN 1 ELSE 0 END) AS files
                FROM items
                WHERE trashed = 0
                """
            )
        )
        .mappings()
        .one()
    )

    state = {
        r["key"]: r["value"]
        for r in session.execute(text("SELECT key, value FROM sync_state")).mappings()
    }

    return {
        "total_items": counts["total"] or 0,
        "total_folders": counts["folders"] or 0,
        "total_files": counts["files"] or 0,
        "last_sync": state.get("last_full_sync"),
        "root_name": state.get("root_folder_name"),
    }
