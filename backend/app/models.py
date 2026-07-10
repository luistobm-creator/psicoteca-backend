"""
Modelos de datos (SQLModel) que definen el esquema de SQLite.

- `Item`      : una fila por CADA archivo O carpeta de Drive (modelo unificado,
                lista de adyacencia mediante `parent_id`).
- `SyncState` : almacén clave/valor para el estado del sincronizador
                (token incremental, fecha del último sync, etc.).

La tabla virtual FTS5 y sus triggers NO se definen aquí (son SQL nativo);
se crean en `database.py`.
"""
from __future__ import annotations

from typing import Optional

from sqlmodel import Field, SQLModel


class Item(SQLModel, table=True):
    __tablename__ = "items"

    # ID nativo de Google Drive (clave primaria de texto).
    id: str = Field(primary_key=True)

    name: str = Field(index=True)
    mime_type: str

    # 1 si es carpeta (application/vnd.google-apps.folder). Indexado para
    # separar rápidamente carpetas de archivos.
    is_folder: bool = Field(default=False, index=True)

    # Carpeta contenedora. FK auto-referenciada (lista de adyacencia).
    parent_id: Optional[str] = Field(
        default=None, foreign_key="items.id", index=True
    )

    # Metadatos útiles para el frontend.
    web_view_link: Optional[str] = None      # enlace nativo para abrir en Drive
    icon_link: Optional[str] = None
    size: Optional[int] = None               # bytes; NULL en carpetas / Docs nativos
    modified_time: Optional[str] = None      # ISO 8601 (tal cual lo entrega Drive)
    created_time: Optional[str] = None

    # Ruta desnormalizada, p. ej. "PSICOTECA/ABUSO SEXUAL/archivo.pdf".
    path: Optional[str] = Field(default=None, index=True)
    depth: Optional[int] = None

    # Borrado lógico: 1 cuando un elemento ya no aparece en Drive.
    trashed: bool = Field(default=False, index=True)

    # Contenido Pro (curado manualmente con scripts/mark_premium.py). El sync NO
    # lo modifica —se excluye del upsert—, así que la curaduría persiste entre
    # sincronizaciones. Alimenta el "gating visual" del frontend y el 403 del
    # endpoint de contenido.
    is_premium: bool = Field(default=False)

    # Marca temporal (ISO) de la última vez que el sync tocó esta fila.
    synced_at: Optional[str] = None


class SyncState(SQLModel, table=True):
    __tablename__ = "sync_state"

    key: str = Field(primary_key=True)
    value: Optional[str] = None
