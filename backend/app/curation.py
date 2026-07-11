"""
Curaduría de contenido Pro (lógica reutilizable).

Marca carpetas (buscadas por NOMBRE) y TODO su subárbol como `is_premium`.
La usan dos consumidores:

- `app/sync.py`  : re-aplica el marcado en CADA sincronización (declarativo,
  desde `settings.premium_folders_list`). Es IMPRESCINDIBLE en Render free:
  el disco es efímero y la BD se reconstruye en cada arranque, así que sin esta
  re-aplicación el contenido Pro quedaría abierto tras cada deploy/hibernación.
- `scripts/mark_premium.py` : curaduría manual puntual (modo aditivo).

Todas las operaciones son idempotentes y *fail-safe*: si una carpeta de la lista
no existe (nombre mal escrito, aún no sincronizada…), se ignora con un aviso en
el log en lugar de romper el sync.

El marcado se hace por PREFIJO DE RUTA (`path`), así que incluye la carpeta y
todos sus descendientes (subcarpetas + archivos), dejando el bloqueo hermético.
"""
from __future__ import annotations

import logging

from sqlalchemy import text

log = logging.getLogger("psicoteca.curation")


def _like_prefix(path: str) -> str:
    """Prefijo seguro para LIKE (escapa %, _ y \\ con ESCAPE '\\')."""
    escaped = path.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
    return f"{escaped}/%"


def path_is_premium(path: str, premium_prefixes) -> bool:
    """True si `path` coincide con una raíz Pro ya descubierta o cuelga de ella.

    `premium_prefixes` es el conjunto de rutas de las carpetas Pro raíz (las que
    coinciden por nombre con PREMIUM_FOLDERS). La usa el sync para marcar
    is_premium EN CALIENTE al insertar cada fila (ver app/sync.py), cerrando la
    ventana en la que un item Pro existiría como "libre" durante el crawl inicial.
    """
    return any(path == p or path.startswith(p + "/") for p in premium_prefixes)


def find_folder_paths(conn, name: str) -> list[str]:
    """Rutas de todas las carpetas activas cuyo nombre coincide (case-insensitive)."""
    rows = conn.execute(
        text(
            "SELECT path FROM items "
            "WHERE is_folder = 1 AND trashed = 0 AND name = :name COLLATE NOCASE"
        ),
        {"name": name},
    ).all()
    return [r[0] for r in rows if r[0]]


def set_premium_by_path(conn, path: str, value: int, files_only: bool = False) -> int:
    """Marca/desmarca una carpeta y TODO su subárbol (por prefijo de ruta).

    Con `files_only=True` solo afecta a ARCHIVOS (is_folder = 0): las carpetas de
    la rama quedan libres para poder navegar el catálogo aunque los documentos
    finales estén bloqueados. Devuelve el nº de filas afectadas.
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


def mark_folders(
    conn, names: list[str], value: int = 1, files_only: bool = False
) -> dict[str, int]:
    """Marca/desmarca cada carpeta (por nombre) y su subárbol.

    Modo ADITIVO: no toca el resto de la biblioteca. Devuelve {ruta: nº elementos}.
    """
    results: dict[str, int] = {}
    for name in names:
        paths = find_folder_paths(conn, name)
        if not paths:
            log.warning("Curaduría Pro: no se encontró la carpeta '%s'.", name)
            continue
        for path in paths:
            results[path] = set_premium_by_path(conn, path, value, files_only)
    return results


def apply_declarative(
    conn, names: list[str], files_only: bool = False
) -> dict[str, int]:
    """Deja como Pro EXACTAMENTE las carpetas indicadas (resetea el resto).

    Pensada para el arranque/sync: `names` (p. ej. `PREMIUM_FOLDERS`) es la única
    fuente de verdad. Primero pone `is_premium = 0` en toda la tabla y luego marca
    la lista curada. Así el estado Pro refleja siempre la configuración actual,
    aunque la BD se haya reconstruido desde cero o hubiera marcados previos.

    Si `names` está vacío NO hace nada (para no "abrir" todo por una config
    ausente); el llamador decide cómo avisar de ese caso.
    """
    if not names:
        return {}
    conn.execute(text("UPDATE items SET is_premium = 0 WHERE is_premium = 1"))
    return mark_folders(conn, names, value=1, files_only=files_only)
