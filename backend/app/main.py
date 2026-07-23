"""
Punto de entrada de la API REST de Psicoteca.

Levanta FastAPI, habilita CORS con orígenes explícitos (incluido el dominio de
producción del frontend), garantiza el esquema/FTS5 al arrancar, pone en marcha
el planificador de sincronización en segundo plano (Fase 4) y monta los routers
de árbol, contenido de carpetas y búsqueda.

Arranque local (desde la carpeta `backend/`, con el venv activado):

    uvicorn app.main:app --reload

Arranque en producción (Render). El `startCommand` del render.yaml usa:

    uvicorn app.main:app --host 0.0.0.0 --port $PORT

Uvicorn toma el puerto de la variable de entorno PORT (imprescindible en Render).
Como alternativa, `python -m app.main` también lee PORT (ver el bloque final).

Documentación interactiva: http://127.0.0.1:8000/docs
"""
from __future__ import annotations

import os
from contextlib import asynccontextmanager

from fastapi import FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.database import init_db
from app.routers import (
    account,
    actividad_biblioteca,
    agenda,
    billing,
    consultorio_config,
    examenes,
    facturacion,
    glosario,
    items,
    notas_voz,
    pacientes,
    plantillas,
    playlists,
    search,
    stats,
    sugerencias,
    tareas,
    tree,
)
from app.scheduler import (
    scheduler_status,
    shutdown_scheduler,
    start_scheduler,
    trigger_sync,
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Idempotente: crea tablas/índices/FTS5 si no existieran (no borra datos).
    init_db()
    # Fase 4: arranca la sincronización automática en segundo plano (y, si
    # SYNC_ON_STARTUP=true, lanza un sync inicial que NO bloquea el arranque).
    start_scheduler()
    try:
        yield
    finally:
        # Cierre ordenado del planificador al apagar el servidor.
        shutdown_scheduler()


app = FastAPI(
    title="Psicoteca API",
    description=(
        "API REST para explorar y buscar la biblioteca Psicoteca "
        "sincronizada desde Google Drive."
    ),
    version="1.0.0",
    lifespan=lifespan,
)

# --- CORS -------------------------------------------------------------------
# Orígenes explícitos (se configuran con CORS_ALLOW_ORIGINS). Por defecto se
# autoriza el dominio de producción del frontend y los orígenes de desarrollo.
# No se usan cookies/credenciales, así que allow_credentials queda en False.
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
    # Exponer estas cabeceras al JS del navegador es IMPRESCINDIBLE para que PDF.js
    # haga carga por rangos cross-origin (necesita leer Content-Length/Content-Range).
    expose_headers=["Content-Range", "Content-Length", "Accept-Ranges"],
)

# --- Routers ----------------------------------------------------------------
app.include_router(tree.router)
app.include_router(items.router)
app.include_router(search.router)
app.include_router(stats.router)
app.include_router(billing.router)
app.include_router(playlists.router)
app.include_router(account.router)
app.include_router(glosario.router)
app.include_router(agenda.router)
app.include_router(pacientes.router)
app.include_router(notas_voz.router)
app.include_router(tareas.router)
app.include_router(examenes.router)
app.include_router(facturacion.router)
app.include_router(consultorio_config.router)
app.include_router(plantillas.router)
app.include_router(actividad_biblioteca.router)
app.include_router(sugerencias.router)


# --- Endpoints utilitarios --------------------------------------------------
@app.get("/api/health", tags=["health"], summary="Comprobación de estado")
def health() -> dict:
    return {"status": "ok"}


@app.get(
    "/api/sync/status",
    tags=["sync"],
    summary="Estado de la sincronización automática (Fase 4)",
)
def sync_status() -> dict:
    """Diagnóstico del planificador: próxima ejecución, si sincroniza ahora, etc."""
    return scheduler_status()


@app.post(
    "/api/sync",
    tags=["sync"],
    summary="Disparar una sincronización manual (protegido por token)",
)
def sync_now(x_sync_token: str | None = Header(default=None)) -> dict:
    """
    Lanza un sync bajo demanda. Requiere la cabecera `X-Sync-Token` que coincida
    con SYNC_TRIGGER_TOKEN. Si ese token no está configurado, el endpoint queda
    deshabilitado (responde 403).
    """
    if not settings.sync_trigger_token:
        raise HTTPException(
            status_code=403,
            detail="Disparo manual deshabilitado (configura SYNC_TRIGGER_TOKEN).",
        )
    if x_sync_token != settings.sync_trigger_token:
        raise HTTPException(status_code=401, detail="Token de sincronización inválido.")

    started = trigger_sync(trigger="manual")
    if not started:
        return {"status": "already_running"}
    return {"status": "started"}


@app.get("/", include_in_schema=False)
def root() -> dict:
    return {"name": "Psicoteca API", "docs": "/docs", "health": "/api/health"}


# --- Arranque directo (fallback) --------------------------------------------
# Permite `python -m app.main` leyendo el puerto de PORT. En Render se usa el
# startCommand con uvicorn, pero esto sirve de red de seguridad.
if __name__ == "__main__":
    import uvicorn

    port = int(os.environ.get("PORT", "8000"))
    uvicorn.run("app.main:app", host="0.0.0.0", port=port, reload=False)
