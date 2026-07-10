"""
Configuración central de la aplicación.

Lee las variables desde el archivo `.env` (ubicado en la carpeta `backend/`)
usando pydantic-settings. Todos los valores tienen un valor por defecto
razonable derivado de la ubicación del proyecto.
"""
from __future__ import annotations

from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

# .../backend  (la carpeta que contiene el paquete `app`)
BASE_DIR = Path(__file__).resolve().parent.parent
# .../CLAUDE   (la carpeta raíz del proyecto, donde vive credentials.json)
PROJECT_DIR = BASE_DIR.parent


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=BASE_DIR / ".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # Ruta al JSON de la Service Account (desarrollo local / Secret File).
    google_credentials_path: Path = PROJECT_DIR / "credentials.json"

    # Credenciales de la Service Account en formato JSON *inline* (el contenido
    # completo del credentials.json). Es la vía recomendada en la nube (Render):
    # se pega el JSON en la variable de entorno GOOGLE_CREDENTIALS_JSON y así no
    # hace falta subir ningún archivo secreto al repositorio. Si está vacío, se
    # usa el archivo apuntado por `google_credentials_path`.
    google_credentials_json: str | None = None

    # Identificación de la carpeta raíz en Drive.
    root_folder_name: str = "PSICOTECA"
    root_folder_id: str | None = None

    # Base de datos local.
    database_path: Path = BASE_DIR / "psicoteca.db"

    # Límite de resultados por página al consultar la API de Drive.
    drive_page_size: int = 1000

    # --- CORS -----------------------------------------------------------------
    # Orígenes autorizados a consumir la API (separados por comas). En la nube se
    # sobreescribe con la variable de entorno CORS_ALLOW_ORIGINS. Incluye por
    # defecto el dominio de producción del frontend y los orígenes de desarrollo.
    cors_allow_origins: str = (
        "https://psicoteca.miceliocreate.com,"
        "http://localhost:5173,"
        "http://127.0.0.1:5173"
    )

    # --- Fase 4: sincronización automática (APScheduler) ----------------------
    scheduler_enabled: bool = True        # arranca el planificador en segundo plano
    sync_interval_minutes: int = 60       # cada cuántos minutos revisar Google Drive
    sync_on_startup: bool = True          # lanzar un sync al arrancar (repuebla la BD)
    sync_jitter_seconds: int = 30         # desfase aleatorio para no disparar en punto exacto
    # Token opcional para proteger el disparo manual `POST /api/sync`. Si se deja
    # vacío, ese endpoint queda deshabilitado (recomendado si no se necesita).
    sync_trigger_token: str | None = None

    # --- Pagos: Stripe + validación de usuario Supabase (Fase 2) ---
    stripe_secret_key: str | None = None    # sk_test_… / sk_live_… (SECRETO, solo backend)
    stripe_price_id: str | None = None      # price_… del plan Pro (recurrente, en MXN)
    stripe_webhook_secret: str | None = None  # whsec_… verifica la firma del webhook (del panel o `stripe listen`)
    supabase_url: str | None = None         # https://<ref>.supabase.co
    supabase_anon_key: str | None = None    # anon/publishable key (valida el token del usuario)
    # service_role key (SECRETO, SOLO backend): única que puede modificar a otros
    # usuarios vía la Admin API. La usa el webhook para fijar el plan Pro. NUNCA
    # debe exponerse al frontend ni al bundle.
    supabase_service_role_key: str | None = None
    frontend_base_url: str = "https://psicoteca.miceliocreate.com"  # success/cancel de Checkout

    @property
    def database_url(self) -> str:
        return f"sqlite:///{self.database_path}"

    @property
    def cors_origins_list(self) -> list[str]:
        """Lista de orígenes CORS a partir de la cadena separada por comas."""
        return [o.strip() for o in self.cors_allow_origins.split(",") if o.strip()]


# Instancia única importable en todo el proyecto.
settings = Settings()
