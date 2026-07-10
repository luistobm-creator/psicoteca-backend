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
    """Activa WAL (mejor concurrencia lectura/escritura) en cada conexión."""
    cursor = dbapi_connection.cursor()
    cursor.execute("PRAGMA journal_mode=WAL;")
    cursor.execute("PRAGMA synchronous=NORMAL;")
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


def init_db() -> None:
    """Crea la carpeta de la BD, las tablas, los índices y el motor FTS5."""
    settings.database_path.parent.mkdir(parents=True, exist_ok=True)

    # Tablas e índices definidos por los modelos SQLModel.
    SQLModel.metadata.create_all(engine)

    # Tabla virtual FTS5 + triggers (SQL nativo).
    with engine.begin() as conn:
        for statement in _FTS_STATEMENTS:
            conn.exec_driver_sql(statement)


def get_session() -> Iterator[Session]:
    """Dependencia FastAPI: entrega una sesión de BD por petición y la cierra."""
    with Session(engine) as session:
        yield session
