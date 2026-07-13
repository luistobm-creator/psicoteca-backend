"""
Capa de base de datos: motor SQLAlchemy, inicialización del esquema y
configuración del motor de búsqueda full-text (FTS5).

`init_db()` es idempotente: puede llamarse en cada arranque sin efectos
secundarios (usa CREATE ... IF NOT EXISTS).
"""
from __future__ import annotations

from collections.abc import Iterator

from sqlalchemy import event
from sqlmodel import Session, SQLModel, create_engine

from app.config import settings
# Importar los modelos registra sus tablas en SQLModel.metadata.
from app import models  # noqa: F401

# check_same_thread=False: la API (que corre los handlers síncronos en el
# threadpool de Starlette) y el sincronizador en segundo plano (APScheduler,
# Fase 4) comparten este engine desde hilos distintos. Con WAL activado y un
# único escritor garantizado por el cerrojo de `scheduler.py`, es seguro.
engine = create_engine(
    settings.database_url,
    echo=False,
    connect_args={"check_same_thread": False},
)


@event.listens_for(engine, "connect")
def _configure_sqlite(dbapi_connection, _connection_record):
    """Ajustes por conexión: WAL + afinado de lectura para la búsqueda FTS.

    Los PRAGMA de caché/mmap/temp aceleran las consultas de solo lectura (la
    búsqueda) sin afectar a la integridad de los datos. Valores moderados,
    pensados para el plan free de Render (512 MB de RAM).
    """
    cursor = dbapi_connection.cursor()
    cursor.execute("PRAGMA journal_mode=WAL;")       # concurrencia lectura/escritura
    cursor.execute("PRAGMA synchronous=NORMAL;")
    cursor.execute("PRAGMA cache_size=-16000;")      # ~16 MB de caché de páginas
    cursor.execute("PRAGMA mmap_size=134217728;")    # 128 MB de E/S mapeada en memoria
    cursor.execute("PRAGMA temp_store=MEMORY;")      # ordenaciones/temporales en RAM
    cursor.close()


# -----------------------------------------------------------------------------
# Motor de búsqueda: FTS5 externo sobre la tabla `items`, mantenido en sincronía
# automáticamente por triggers. Indexa `name` y `path`.
# -----------------------------------------------------------------------------
_FTS_STATEMENTS = [
    """
    CREATE VIRTUAL TABLE IF NOT EXISTS items_fts USING fts5(
        name,
        path,
        content='items',
        content_rowid='rowid'
    );
    """,
    # INSERT -> añadir a FTS
    """
    CREATE TRIGGER IF NOT EXISTS items_ai AFTER INSERT ON items BEGIN
        INSERT INTO items_fts(rowid, name, path)
        VALUES (new.rowid, new.name, new.path);
    END;
    """,
    # DELETE -> quitar de FTS
    """
    CREATE TRIGGER IF NOT EXISTS items_ad AFTER DELETE ON items BEGIN
        INSERT INTO items_fts(items_fts, rowid, name, path)
        VALUES ('delete', old.rowid, old.name, old.path);
    END;
    """,
    # UPDATE -> reemplazar en FTS
    """
    CREATE TRIGGER IF NOT EXISTS items_au AFTER UPDATE ON items BEGIN
        INSERT INTO items_fts(items_fts, rowid, name, path)
        VALUES ('delete', old.rowid, old.name, old.path);
        INSERT INTO items_fts(rowid, name, path)
        VALUES (new.rowid, new.name, new.path);
    END;
    """,
]


def _ensure_columns() -> None:
    """Añade a `items` columnas nuevas del modelo que falten (migración ligera).

    `create_all` NO altera tablas que ya existen, así que en una BD previa hay que
    añadir a mano las columnas nuevas. Idempotente: solo actúa si faltan.
    """
    with engine.begin() as conn:
        existing = {row[1] for row in conn.exec_driver_sql("PRAGMA table_info(items)")}
        if "is_premium" not in existing:
            conn.exec_driver_sql(
                "ALTER TABLE items ADD COLUMN is_premium BOOLEAN NOT NULL DEFAULT 0"
            )


def init_db() -> None:
    """Crea la carpeta de la BD, las tablas, los índices y el motor FTS5."""
    settings.database_path.parent.mkdir(parents=True, exist_ok=True)

    # Tablas e índices definidos por los modelos SQLModel.
    SQLModel.metadata.create_all(engine)

    # Migración ligera: columnas nuevas en tablas ya existentes.
    _ensure_columns()

    # Tabla virtual FTS5 + triggers (SQL nativo).
    with engine.begin() as conn:
        for statement in _FTS_STATEMENTS:
            conn.exec_driver_sql(statement)


def get_session() -> Iterator[Session]:
    """Dependencia FastAPI: entrega una sesión de BD por petición y la cierra."""
    with Session(engine) as session:
        yield session
