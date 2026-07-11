"""
Motor de sincronización de Psicoteca.

Recorre recursivamente (BFS) la carpeta raíz de Google Drive y cachea los
metadatos de cada archivo y carpeta en SQLite mediante *upsert*. Los elementos
que dejan de aparecer se marcan como eliminados (borrado lógico).

Uso (desde la carpeta `backend/`, con el entorno virtual activado):

    python -m app.sync
"""
from __future__ import annotations

import logging
import sys
from collections import deque
from datetime import datetime, timezone

from sqlalchemy import text
from sqlalchemy.dialects.sqlite import insert as sqlite_insert

from app.config import settings
from app.curation import apply_declarative, path_is_premium
from app.database import engine, init_db
from app.drive_client import (
    FOLDER_MIME,
    build_drive_service,
    get_file,
    iter_children,
    search_folders_by_name,
)
from app.models import Item, SyncState

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)-7s | %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger("psicoteca.sync")


# -----------------------------------------------------------------------------
# Utilidades
# -----------------------------------------------------------------------------
def _to_int(value) -> int | None:
    try:
        return int(value) if value is not None else None
    except (TypeError, ValueError):
        return None


def _build_row(
    f: dict,
    parent_id: str | None,
    path: str,
    depth: int,
    run_ts: str,
    is_premium: bool = False,
) -> dict:
    """Traduce un recurso de Drive a una fila de la tabla `items`."""
    return {
        "id": f["id"],
        "name": f.get("name", "(sin nombre)"),
        "mime_type": f["mimeType"],
        "is_folder": f["mimeType"] == FOLDER_MIME,
        "parent_id": parent_id,
        "web_view_link": f.get("webViewLink"),
        "icon_link": f.get("iconLink"),
        "size": _to_int(f.get("size")),
        "modified_time": f.get("modifiedTime"),
        "created_time": f.get("createdTime"),
        "path": path,
        "depth": depth,
        "trashed": False,
        "is_premium": is_premium,
        "synced_at": run_ts,
    }


def _upsert_rows(conn, rows: list[dict]) -> None:
    """Inserta o actualiza filas de `items` en bloque (executemany)."""
    if not rows:
        return
    base = sqlite_insert(Item.__table__)
    # `is_premium` se fija al INSERTAR (curaduría en caliente según
    # PREMIUM_FOLDERS, ver run_sync) y se PRESERVA en conflicto (no se pisa al
    # re-sincronizar una fila existente). La reconciliación declarativa al final
    # del sync (apply_declarative) es la fuente de verdad del estado Pro.
    _preserve = {"id", "is_premium"}
    update_cols = {
        col.name: getattr(base.excluded, col.name)
        for col in Item.__table__.columns
        if col.name not in _preserve
    }
    stmt = base.on_conflict_do_update(index_elements=["id"], set_=update_cols)
    conn.execute(stmt, rows)


def _set_state(conn, key: str, value: str) -> None:
    stmt = sqlite_insert(SyncState.__table__).values(key=key, value=value)
    stmt = stmt.on_conflict_do_update(index_elements=["key"], set_={"value": value})
    conn.execute(stmt)


# -----------------------------------------------------------------------------
# Resolución de la carpeta raíz
# -----------------------------------------------------------------------------
def _resolve_root(service) -> dict:
    """
    Determina la carpeta raíz: por ID si está fijado en .env; si no, la busca
    por nombre entre las carpetas compartidas con la Service Account.
    """
    if settings.root_folder_id:
        meta = get_file(service, settings.root_folder_id)
        log.info("Carpeta raíz (por ID): '%s'  [%s]", meta["name"], meta["id"])
        return meta

    matches = search_folders_by_name(service, settings.root_folder_name)
    if not matches:
        log.error(
            "No se encontró ninguna carpeta llamada '%s' compartida con la "
            "Service Account (%s). Verifica el nombre o comparte la carpeta.",
            settings.root_folder_name,
            settings.google_credentials_path.name,
        )
        sys.exit(1)

    if len(matches) > 1:
        log.warning(
            "Se encontraron %d carpetas llamadas '%s'. Se usará la primera. "
            "Fija ROOT_FOLDER_ID en .env para elegir explícitamente.",
            len(matches),
            settings.root_folder_name,
        )

    root = matches[0]
    log.info("Carpeta raíz (por nombre): '%s'  [%s]", root["name"], root["id"])
    log.info(">> Sugerencia: copia este ID en ROOT_FOLDER_ID dentro de .env.")
    # Completa metadatos que la búsqueda no devuelve.
    return get_file(service, root["id"])


# -----------------------------------------------------------------------------
# Sincronización principal
# -----------------------------------------------------------------------------
def run_sync() -> None:
    log.info("Inicializando base de datos: %s", settings.database_path)
    init_db()

    service = build_drive_service()
    root = _resolve_root(service)
    root_id, root_name = root["id"], root["name"]

    run_ts = datetime.now(timezone.utc).isoformat()
    log.info("Sync iniciado (marca de tiempo: %s)", run_ts)

    # 1) Insertar el propio nodo raíz (parent_id = NULL).
    root_row = {
        "id": root_id,
        "name": root_name,
        "mime_type": FOLDER_MIME,
        "is_folder": True,
        "parent_id": None,
        "web_view_link": root.get("webViewLink"),
        "icon_link": root.get("iconLink"),
        "size": None,
        "modified_time": root.get("modifiedTime"),
        "created_time": root.get("createdTime"),
        "path": root_name,
        "depth": 0,
        "trashed": False,
        "is_premium": False,
        "synced_at": run_ts,
    }
    with engine.begin() as conn:
        _upsert_rows(conn, [root_row])

    # 2) Recorrido BFS. Se guarda la ruta/profundidad de cada carpeta para
    #    construir la ruta de sus hijos (el padre siempre se procesa antes).
    path_of: dict[str, str] = {root_id: root_name}
    depth_of: dict[str, int] = {root_id: 0}
    queue: deque[str] = deque([root_id])

    total_folders = 0
    total_files = 0

    # Curaduría Pro EN CALIENTE: marca is_premium al INSERTAR cada fila. Como el
    # BFS procesa cada carpeta antes que sus hijos, cuando se construye un
    # descendiente su carpeta Pro raíz ya está en `premium_prefixes`. Así el
    # contenido Pro nunca existe como "libre" en la BD durante el sync inicial
    # (cierra la ventana del disco efímero de Render en cada cold start).
    # Solo se registran como prefijo las carpetas que coinciden por NOMBRE con
    # PREMIUM_FOLDERS (las raíces); el conjunto queda pequeño (~pocas entradas).
    premium_names = {n.lower() for n in settings.premium_folders_list}
    premium_prefixes: list[str] = []

    while queue:
        folder_id = queue.popleft()
        parent_path = path_of[folder_id]
        parent_depth = depth_of[folder_id]

        batch: list[dict] = []
        for f in iter_children(service, folder_id, settings.drive_page_size):
            name = f.get("name", "(sin nombre)")
            child_path = f"{parent_path}/{name}"
            child_depth = parent_depth + 1
            is_folder = f["mimeType"] == FOLDER_MIME

            # Raíz Pro (por nombre) o descendiente de una ya descubierta.
            if is_folder and name.lower() in premium_names:
                prem = True
                premium_prefixes.append(child_path)
            else:
                prem = path_is_premium(child_path, premium_prefixes)

            batch.append(
                _build_row(f, folder_id, child_path, child_depth, run_ts, prem)
            )

            if is_folder:
                queue.append(f["id"])
                path_of[f["id"]] = child_path
                depth_of[f["id"]] = child_depth
                total_folders += 1
            else:
                total_files += 1

        if batch:
            with engine.begin() as conn:
                _upsert_rows(conn, batch)

        log.info(
            "  %-60s %4d elementos  (pendientes: %d)",
            (parent_path[:57] + "...") if len(parent_path) > 60 else parent_path,
            len(batch),
            len(queue),
        )

    # 3) Marcar como eliminados los elementos que ya no aparecieron.
    #    (Solo se ejecuta si el recorrido terminó sin excepciones.)
    with engine.begin() as conn:
        result = conn.execute(
            text(
                "UPDATE items SET trashed = 1 "
                "WHERE synced_at IS NULL OR synced_at != :run_ts"
            ),
            {"run_ts": run_ts},
        )
        removed = result.rowcount or 0

        _set_state(conn, "root_folder_id", root_id)
        _set_state(conn, "root_folder_name", root_name)
        _set_state(conn, "last_full_sync", run_ts)
        _set_state(conn, "total_folders", str(total_folders))
        _set_state(conn, "total_files", str(total_files))

    # 3.5) Curaduría Pro DECLARATIVA. La BD se acaba de (re)poblar con
    #      is_premium=False por defecto; volvemos a marcar el contenido Pro según
    #      PREMIUM_FOLDERS. Sin este paso, en Render free (disco efímero) todo el
    #      contenido Pro quedaría abierto tras cada arranque.
    premium_names = settings.premium_folders_list
    if premium_names:
        with engine.begin() as conn:
            applied = apply_declarative(conn, premium_names)
        marked = sum(applied.values())
        log.info(
            "Curaduría Pro aplicada: %d elemento(s) en %d carpeta(s).",
            marked,
            len(applied),
        )
        for path, n in sorted(applied.items()):
            log.info("  Pro: %-52s %5d elementos", path, n)
        missing = [
            name
            for name in premium_names
            if not any(p == name or p.endswith(f"/{name}") for p in applied)
        ]
        if missing:
            log.warning(
                "Curaduría Pro: estas carpetas de PREMIUM_FOLDERS no se "
                "encontraron (revisa el nombre exacto): %s",
                ", ".join(missing),
            )
    else:
        log.warning(
            "PREMIUM_FOLDERS vacío: no se marcó ningún contenido Pro "
            "(toda la biblioteca queda libre)."
        )

    # 4) Resumen final.
    with engine.connect() as conn:
        active = conn.execute(
            text("SELECT COUNT(*) FROM items WHERE trashed = 0")
        ).scalar_one()

    log.info("-" * 64)
    log.info("Sincronización COMPLETADA")
    log.info("  Carpetas encontradas : %d", total_folders)
    log.info("  Archivos encontrados : %d", total_files)
    log.info("  Total activo en BD   : %d", active)
    if removed:
        log.info("  Marcados eliminados  : %d", removed)
    log.info("  Base de datos        : %s", settings.database_path)
    log.info("-" * 64)


if __name__ == "__main__":
    try:
        run_sync()
    except KeyboardInterrupt:
        log.warning("Sincronización interrumpida por el usuario.")
        sys.exit(130)
