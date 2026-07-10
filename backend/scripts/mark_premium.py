"""
Curaduría de contenido Pro.

Marca (o desmarca) carpetas de la biblioteca como Pro (`items.is_premium`),
buscándolas por NOMBRE, e incluye a TODOS sus descendientes (subcarpetas y
archivos) para que el bloqueo sea hermético. Es idempotente y re-ejecutable.

El sync NO pisa `is_premium` (ver app/sync.py), así que la curaduría persiste
entre sincronizaciones.

La biblioteca vive en SQLite (backend/…/psicoteca.db, según DATABASE_PATH del
.env), NO en Supabase. Este script usa la misma configuración que la API.

Uso (desde la carpeta backend/, con el venv activado):

    # Marcar las carpetas por defecto (CURATED_FOLDERS):
    python scripts/mark_premium.py

    # Marcar carpetas concretas (por nombre; ojo con espacios → comillas):
    python scripts/mark_premium.py "DSM V" "E M D R Y BRAINSPOTTYNG"

    # Ver las carpetas Pro actuales:
    python scripts/mark_premium.py --list

    # Quitar la marca:
    python scripts/mark_premium.py --unmark "DSM V"

Equivalente en SQL (una carpeta y su subárbol, por prefijo de ruta):

    UPDATE items SET is_premium = 1
    WHERE path = 'PSICOTECA/DSM V'
       OR path LIKE 'PSICOTECA/DSM V/%';
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

# Permite ejecutar el script directamente (añade backend/ a sys.path).
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from sqlalchemy import text  # noqa: E402

from app.database import engine, init_db  # noqa: E402

# La consola de Windows suele ser cp1252; forzamos UTF-8 para imprimir rutas con
# acentos y símbolos sin romper.
for _stream in (sys.stdout, sys.stderr):
    try:
        _stream.reconfigure(encoding="utf-8", errors="replace")
    except (AttributeError, ValueError):
        pass

# Carpetas Pro por defecto (ajústalas a tu estrategia de negocio).
CURATED_FOLDERS = [
    "DSM V",
    "E M D R Y BRAINSPOTTYNG",
    "1012 TEST",
]


def _like_prefix(path: str) -> str:
    """Prefijo seguro para LIKE (escapa %, _ y \\ con ESCAPE '\\')."""
    escaped = path.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
    return f"{escaped}/%"


def _find_folders(conn, name: str) -> list[dict]:
    rows = (
        conn.execute(
            text(
                "SELECT id, path FROM items "
                "WHERE is_folder = 1 AND trashed = 0 AND name = :name COLLATE NOCASE"
            ),
            {"name": name},
        )
        .mappings()
        .all()
    )
    return [dict(r) for r in rows]


def _set_premium_by_path(
    conn, path: str, value: int, files_only: bool = False
) -> int:
    """Marca/desmarca la carpeta y TODO su subárbol (prefijo de ruta).

    Con `files_only=True` solo afecta a ARCHIVOS (is_folder = 0): las carpetas de
    la rama quedan intactas (para poder navegar el catálogo aunque los documentos
    finales estén bloqueados).
    """
    folder_clause = " AND is_folder = 0" if files_only else ""
    result = conn.execute(
        text(
            "UPDATE items SET is_premium = :v "
            f"WHERE (path = :p OR path LIKE :prefix ESCAPE '\\'){folder_clause}"
        ),
        {"v": value, "p": path, "prefix": _like_prefix(path)},
    )
    return result.rowcount or 0


def apply(names: list[str], value: int, files_only: bool = False) -> None:
    init_db()  # asegura la columna is_premium (migración) antes de tocarla
    verb = "Marcando" if value else "Desmarcando"
    scope = " (solo archivos, carpetas libres)" if files_only else " (carpeta + descendientes)"
    with engine.begin() as conn:
        for name in names:
            folders = _find_folders(conn, name)
            if not folders:
                print(f"  ! '{name}': no se encontró ninguna carpeta con ese nombre.")
                continue
            for f in folders:
                affected = _set_premium_by_path(conn, f["path"], value, files_only)
                print(f"  {verb} '{f['path']}' -> {affected} elementos{scope}.")


def show_list() -> None:
    with engine.connect() as conn:
        folders = conn.execute(
            text(
                "SELECT path FROM items "
                "WHERE is_folder = 1 AND is_premium = 1 AND trashed = 0 "
                "ORDER BY path"
            )
        ).all()
        total = conn.execute(
            text("SELECT COUNT(*) FROM items WHERE is_premium = 1 AND trashed = 0")
        ).scalar_one()
    print(f"Carpetas Pro marcadas: {len(folders)}  |  Elementos Pro totales: {total}")
    for (p,) in folders:
        print(f"  • {p}")


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Curaduría de contenido Pro (columna items.is_premium)."
    )
    parser.add_argument("names", nargs="*", help="Nombres de carpeta a marcar/desmarcar.")
    parser.add_argument(
        "--unmark", action="store_true", help="Quitar la marca Pro en vez de ponerla."
    )
    parser.add_argument(
        "--list", action="store_true", help="Listar las carpetas Pro actuales y salir."
    )
    parser.add_argument(
        "--files-only",
        action="store_true",
        dest="files_only",
        help="Marcar SOLO los archivos de la rama; deja las carpetas libres.",
    )
    args = parser.parse_args()

    if args.list:
        show_list()
        return

    names = args.names or CURATED_FOLDERS
    apply(names, value=0 if args.unmark else 1, files_only=args.files_only)
    print()
    show_list()


if __name__ == "__main__":
    main()
