"""
Aplanado de carpetas "envoltorio" redundantes en la BD cacheada.

Al descomprimir los zips originales quedaron carpetas envoltorio que contienen
EXACTAMENTE una subcarpeta (a menudo con el mismo nombre salvo acentos/mayúsculas)
y ningún archivo, p. ej.:

    DETECCION DE MENTIRAS/            <- envoltorio redundante (W)
        DETECCIÓN DE MENTIRAS/        <- contenido real (C)
            *.pdf

Esto obliga al usuario a dar un clic de más. Este módulo COLAPSA cada envoltorio
en la propia BD (NO toca Google Drive, que además es de solo lectura): sube el
contenido de C a W y descarta C mediante borrado lógico.

Se ejecuta en CADA sync (idempotente) DESPUÉS del BFS y ANTES de la curaduría Pro
declarativa (`apply_declarative`), de modo que `is_premium` se recalcula sobre las
rutas ya aplanadas.

Diseño clave (seguridad del gating Pro):
- Se conserva SIEMPRE la carpeta EXTERIOR (W): su id, nombre, ruta, profundidad e
  `is_premium` quedan intactos; solo se re-cuelga el contenido de la interior (C)
  y se marca C como eliminada (borrado lógico, coherente con el resto del modelo).
- Por defecto (`require_same_name=True`) solo se colapsan envoltorios cuyo nombre
  coincide con el del hijo ignorando acentos/mayúsculas, así el nombre que ve el
  usuario —y el que referencia PREMIUM_FOLDERS— no cambia.

Es una transformación REVERSIBLE del caché: si se desactiva
`FLATTEN_REDUNDANT_FOLDERS`, la siguiente sincronización restaura la estructura
original de Drive.

Uso como INFORME (dry-run, NO modifica nada):

    python -m app.flatten
"""
from __future__ import annotations

import logging
import unicodedata
from dataclasses import dataclass

from sqlalchemy import text

from app.curation import _like_prefix

log = logging.getLogger("psicoteca.flatten")


def _normalize(name: str) -> str:
    """Normaliza un nombre para comparar: sin acentos, minúsculas, espacios colapsados."""
    nfkd = unicodedata.normalize("NFKD", name or "")
    no_marks = "".join(c for c in nfkd if not unicodedata.combining(c))
    return " ".join(no_marks.lower().split())


@dataclass
class Wrapper:
    """Un envoltorio colapsable: la carpeta exterior W y su única subcarpeta C."""

    w_id: str
    w_name: str
    w_path: str
    c_id: str
    c_name: str
    c_path: str


def _find_wrappers(conn, require_same_name: bool) -> list[Wrapper]:
    """Envoltorios colapsables en el estado ACTUAL de la BD.

    Un envoltorio W es una carpeta activa cuyo ÚNICO hijo activo es una carpeta C
    (por tanto no tiene archivos directos). El INNER JOIN descarta las carpetas
    sin hijos activos; `HAVING COUNT = 1 AND MIN(is_folder) = 1` exige que ese
    único hijo sea carpeta. Con `require_same_name`, además el nombre normalizado
    de W y C debe coincidir.
    """
    rows = (
        conn.execute(
            text(
                """
                SELECT w.id AS w_id, w.name AS w_name, w.path AS w_path,
                       MIN(c.id)   AS c_id,
                       MIN(c.name) AS c_name,
                       MIN(c.path) AS c_path
                FROM items w
                JOIN items c ON c.parent_id = w.id AND c.trashed = 0
                WHERE w.is_folder = 1 AND w.trashed = 0
                GROUP BY w.id
                HAVING COUNT(c.id) = 1 AND MIN(c.is_folder) = 1
                """
            )
        )
        .mappings()
        .all()
    )

    wrappers: list[Wrapper] = []
    for r in rows:
        if require_same_name and _normalize(r["w_name"]) != _normalize(r["c_name"]):
            continue
        wrappers.append(
            Wrapper(
                w_id=r["w_id"],
                w_name=r["w_name"],
                w_path=r["w_path"],
                c_id=r["c_id"],
                c_name=r["c_name"],
                c_path=r["c_path"],
            )
        )
    return wrappers


def _collapse(conn, w: Wrapper) -> int:
    """Colapsa el envoltorio `w`: sube el subárbol de C a W y descarta C.

    Devuelve cuántos descendientes de C se reubicaron. Como W.path es el prefijo
    de C.path (C.path == W.path + "/" + C.name), reemplazar ese prefijo elimina
    exactamente el nivel sobrante en la ruta de cada descendiente. Se usa
    `length(:cpath)` de SQLite (no `len()` de Python) para cortar por el mismo
    número de caracteres con el que se almacenó la ruta.
    """
    # 1) Reasignar ruta y profundidad de TODO el subárbol de C (excepto C).
    moved = (
        conn.execute(
            text(
                r"""
                UPDATE items
                SET path = :wpath || substr(path, length(:cpath) + 1),
                    depth = depth - 1
                WHERE trashed = 0
                  AND path LIKE :like ESCAPE '\'
                """
            ),
            {"wpath": w.w_path, "cpath": w.c_path, "like": _like_prefix(w.c_path)},
        ).rowcount
        or 0
    )

    # 2) Re-colgar los hijos DIRECTOS de C bajo W.
    conn.execute(
        text(
            "UPDATE items SET parent_id = :wid "
            "WHERE parent_id = :cid AND trashed = 0"
        ),
        {"wid": w.w_id, "cid": w.c_id},
    )

    # 3) Marcar C como eliminada (borrado lógico); su fila permanece.
    conn.execute(
        text("UPDATE items SET trashed = 1 WHERE id = :cid"), {"cid": w.c_id}
    )
    return moved


def flatten_redundant(
    conn, require_same_name: bool = True, max_passes: int = 25
) -> dict:
    """Colapsa TODOS los envoltorios redundantes hasta punto fijo.

    En cada pasada procesa los envoltorios de MÁS PROFUNDOS a menos profundos: así
    colapsar uno interior nunca invalida la relación (aún viva) de uno exterior con
    su hijo, y las cadenas "en cascada" (A→A→A→archivos) se resuelven de forma
    consistente. El bucle externo (punto fijo) capta los envoltorios nuevos que
    surjan al reubicar contenido. Devuelve estadísticas para el log/dry-run.
    """
    collapsed = 0
    moved = 0
    chains: list[tuple[str, str, int]] = []

    for _ in range(max_passes):
        wrappers = _find_wrappers(conn, require_same_name)
        if not wrappers:
            break
        # Más profundo primero (más "/" en la ruta = mayor profundidad).
        wrappers.sort(key=lambda w: w.w_path.count("/"), reverse=True)
        for w in wrappers:
            n = _collapse(conn, w)
            collapsed += 1
            moved += n
            chains.append((w.w_path, w.c_name, n))
    else:
        log.warning(
            "Aplanado: se alcanzó el máximo de %d pasadas; puede quedar alguna "
            "cadena sin colapsar (revisa si hay ciclos o nombres inesperados).",
            max_passes,
        )

    return {"collapsed": collapsed, "moved": moved, "chains": chains}


# -----------------------------------------------------------------------------
# Dry-run: informe de lo que se colapsaría, SIN escribir nada en la BD.
# -----------------------------------------------------------------------------
def _dry_run() -> None:
    from app.config import settings
    from app.database import engine, init_db

    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s | %(levelname)-7s | %(message)s",
        datefmt="%H:%M:%S",
    )
    init_db()

    same = settings.flatten_require_same_name
    log.info(
        "DRY-RUN de aplanado (require_same_name=%s). NO se modifica la BD.", same
    )

    # Ejecuta el aplanado real dentro de una transacción y hace ROLLBACK, de modo
    # que el informe refleja el resultado final (incluidas las cascadas) sin
    # persistir ningún cambio.
    conn = engine.connect()
    trans = conn.begin()
    try:
        stats = flatten_redundant(conn, require_same_name=same)
    finally:
        trans.rollback()
        conn.close()

    if not stats["chains"]:
        log.info("No se encontraron carpetas envoltorio redundantes.")
        return

    log.info("-" * 72)
    for w_path, c_name, n in stats["chains"]:
        shown = (w_path[:52] + "...") if len(w_path) > 55 else w_path
        log.info("  COLAPSAR  %-55s  (absorbe '%s', %d elem.)", shown, c_name, n)
    log.info("-" * 72)
    log.info(
        "TOTAL: %d envoltorio(s) se colapsarían, %d elemento(s) reubicados.",
        stats["collapsed"],
        stats["moved"],
    )
    log.info("Para aplicarlo de verdad, deja FLATTEN_REDUNDANT_FOLDERS=1 y sincroniza.")


if __name__ == "__main__":
    _dry_run()
