"""
Fase 4 — Sincronización automática en segundo plano (APScheduler).

Arranca un `BackgroundScheduler` (basado en hilos) que ejecuta `run_sync()`
periódicamente para mantener la caché local en sintonía con Google Drive. Se usa
`BackgroundScheduler` (y NO `AsyncIOScheduler`) porque `run_sync()` es código
síncrono y bloqueante (llamadas HTTP a Drive + escrituras en SQLite): así se
ejecuta en un hilo aparte sin bloquear el bucle de eventos de FastAPI.

Diseño seguro para la nube (sin duplicar tareas):

  * `max_instances=1` + `coalesce=True`  -> el planificador nunca lanza dos
    ejecuciones del mismo job a la vez ni acumula disparos atrasados.
  * `_sync_lock` (cerrojo no bloqueante)  -> aunque coincidan el sync de
    arranque, el periódico y el manual, solo uno se ejecuta; el resto se OMITE
    (SQLite es de escritor único). Nunca se encolan sincronizaciones en cascada.
  * Debe ejecutarse con UN ÚNICO proceso/worker de Uvicorn (el arranque por
    defecto en Render). Con varios workers, cada uno crearía su propio
    planificador: en ese caso, deja el scheduler activo en UNO solo y pon
    SCHEDULER_ENABLED=false en el resto (o usa un servicio worker dedicado).
"""
from __future__ import annotations

import logging
import threading
from datetime import datetime, timezone

from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.interval import IntervalTrigger

from app.config import settings
from app.sync import run_sync

log = logging.getLogger("psicoteca.scheduler")

_JOB_ID = "drive_sync"

# Cerrojo global de proceso: garantiza que jamás corran dos sincronizaciones a la
# vez. Un intento solapado se descarta (no se encola).
_sync_lock = threading.Lock()

# Instancia única del planificador (se crea al arrancar la app).
_scheduler: BackgroundScheduler | None = None

# Estado observable del último sync, expuesto por GET /api/sync/status.
_last_result: dict = {
    "status": "never",     # never | running | ok | error
    "trigger": None,       # startup | scheduler | manual
    "started_at": None,
    "finished_at": None,
    "error": None,
}


def is_syncing() -> bool:
    """True si hay una sincronización en curso ahora mismo."""
    return _sync_lock.locked()


def safe_sync(trigger: str = "scheduler") -> None:
    """
    Ejecuta `run_sync()` protegido por el cerrojo global. Si ya hay una
    sincronización en curso, se omite silenciosamente (no se encola).
    """
    if not _sync_lock.acquire(blocking=False):
        log.warning(
            "Sync omitido (disparador: %s): ya hay una sincronización en curso.",
            trigger,
        )
        return

    started = datetime.now(timezone.utc)
    _last_result.update(
        status="running",
        trigger=trigger,
        started_at=started.isoformat(),
        finished_at=None,
        error=None,
    )
    try:
        log.info("Sincronización automática iniciada (disparador: %s).", trigger)
        run_sync()
        _last_result.update(
            status="ok",
            finished_at=datetime.now(timezone.utc).isoformat(),
        )
        log.info("Sincronización automática completada (disparador: %s).", trigger)
    except (Exception, SystemExit) as exc:  # noqa: BLE001
        # Se registra y se continúa: un fallo del sync no debe tumbar el servidor.
        # (SystemExit cubre el `sys.exit(1)` de sync.py si no se encuentra la
        #  carpeta raíz; fija ROOT_FOLDER_ID para evitarlo.)
        _last_result.update(
            status="error",
            finished_at=datetime.now(timezone.utc).isoformat(),
            error=str(exc) or exc.__class__.__name__,
        )
        log.exception("La sincronización automática falló: %s", exc)
    finally:
        _sync_lock.release()


def trigger_sync(trigger: str = "manual") -> bool:
    """
    Lanza una sincronización en un hilo aparte (no bloquea a quien la invoca).
    Devuelve False si ya hay una en curso.
    """
    if is_syncing():
        return False
    threading.Thread(
        target=safe_sync,
        kwargs={"trigger": trigger},
        name=f"{trigger}-sync",
        daemon=True,
    ).start()
    return True


def start_scheduler() -> BackgroundScheduler | None:
    """
    Crea y arranca el planificador si SCHEDULER_ENABLED=true. Idempotente.
    Si SYNC_ON_STARTUP=true, dispara además un sync inicial en un hilo aparte
    (no bloquea el arranque del servidor web: vital para que Render detecte el
    puerto abierto a tiempo).
    """
    global _scheduler

    if not settings.scheduler_enabled:
        log.info("Planificador deshabilitado (SCHEDULER_ENABLED=false).")
        return None

    if _scheduler and _scheduler.running:
        return _scheduler

    scheduler = BackgroundScheduler(
        timezone="UTC",
        job_defaults={
            "coalesce": True,        # unifica disparos atrasados en uno solo
            "max_instances": 1,      # nunca dos ejecuciones simultáneas del job
            "misfire_grace_time": 300,
        },
    )
    scheduler.add_job(
        safe_sync,
        trigger=IntervalTrigger(
            minutes=settings.sync_interval_minutes,
            jitter=settings.sync_jitter_seconds,
            timezone="UTC",
        ),
        id=_JOB_ID,
        name="Sincronización de Google Drive",
        replace_existing=True,
        kwargs={"trigger": "scheduler"},
    )
    scheduler.start()
    _scheduler = scheduler
    log.info(
        "Planificador iniciado: sync automático cada %d min (jitter %ds).",
        settings.sync_interval_minutes,
        settings.sync_jitter_seconds,
    )

    if settings.sync_on_startup:
        log.info("Lanzando sincronización inicial de arranque en segundo plano…")
        trigger_sync(trigger="startup")

    return scheduler


def shutdown_scheduler() -> None:
    """Detiene el planificador (al apagar la app). No espera a los jobs en curso."""
    global _scheduler
    if _scheduler and _scheduler.running:
        _scheduler.shutdown(wait=False)
        log.info("Planificador detenido.")
    _scheduler = None


def scheduler_status() -> dict:
    """Diagnóstico del planificador y del último sync (para GET /api/sync/status)."""
    job = _scheduler.get_job(_JOB_ID) if _scheduler else None
    next_run = getattr(job, "next_run_time", None) if job else None
    return {
        "enabled": settings.scheduler_enabled,
        "running": bool(_scheduler and _scheduler.running),
        "interval_minutes": settings.sync_interval_minutes,
        "syncing_now": is_syncing(),
        "next_run": next_run.isoformat() if next_run else None,
        "last_result": dict(_last_result),
    }
