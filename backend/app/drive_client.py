"""
Cliente de Google Drive API v3.

Encapsula la autenticación con la Service Account y las operaciones de lectura
que necesita el sincronizador, con reintentos automáticos (backoff exponencial)
ante errores de cuota o transitorios.
"""
from __future__ import annotations

import json
import logging
from typing import Iterator

from google.oauth2 import service_account
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError
from tenacity import (
    retry,
    retry_if_exception,
    stop_after_attempt,
    wait_exponential,
)

from app.config import settings

log = logging.getLogger("psicoteca.drive")

# Solo lectura: coincide con el permiso "Lector" de la Service Account.
SCOPES = ["https://www.googleapis.com/auth/drive.readonly"]

FOLDER_MIME = "application/vnd.google-apps.folder"

# Campos mínimos necesarios (minimizar `fields` reduce el consumo de cuota).
_LIST_FIELDS = (
    "nextPageToken, "
    "files(id, name, mimeType, parents, webViewLink, iconLink, "
    "size, modifiedTime, createdTime)"
)
_GET_FIELDS = "id, name, mimeType, webViewLink, iconLink, modifiedTime, createdTime"


def _is_retryable(exc: BaseException) -> bool:
    """Reintenta solo ante rate-limit (429), errores 5xx o fallos de red."""
    if isinstance(exc, HttpError):
        return exc.resp.status in (429, 500, 502, 503, 504)
    return isinstance(exc, (TimeoutError, ConnectionError, OSError))


# Decorador reutilizable para envolver llamadas a la API.
_with_retry = retry(
    reraise=True,
    stop=stop_after_attempt(5),
    wait=wait_exponential(multiplier=1, min=2, max=60),
    retry=retry_if_exception(_is_retryable),
)


def _load_service_account_credentials():
    """
    Carga las credenciales de la Service Account con este orden de prioridad:

    1) Variable de entorno GOOGLE_CREDENTIALS_JSON con el contenido JSON completo
       del credentials.json. Es la vía recomendada en la nube (Render): no
       requiere subir ningún archivo secreto al repositorio.
    2) Archivo en disco apuntado por GOOGLE_CREDENTIALS_PATH (desarrollo local o
       "Secret File" de Render).
    """
    raw = settings.google_credentials_json
    if raw and raw.strip():
        try:
            info = json.loads(raw)
        except json.JSONDecodeError as exc:
            raise ValueError(
                "GOOGLE_CREDENTIALS_JSON está definida pero no contiene un JSON "
                "válido. Pega el contenido íntegro del credentials.json."
            ) from exc
        log.info("Credenciales de Drive cargadas desde GOOGLE_CREDENTIALS_JSON.")
        return service_account.Credentials.from_service_account_info(
            info, scopes=SCOPES
        )

    path = settings.google_credentials_path
    if path and path.exists():
        log.info("Credenciales de Drive cargadas desde archivo: %s", path)
        return service_account.Credentials.from_service_account_file(
            str(path), scopes=SCOPES
        )

    raise FileNotFoundError(
        "No se encontraron credenciales de Google. Define la variable de entorno "
        "GOOGLE_CREDENTIALS_JSON (contenido del credentials.json, recomendado en "
        f"la nube) o coloca el archivo en: {path}"
    )


def build_drive_service():
    """Construye el cliente autenticado de Drive."""
    creds = _load_service_account_credentials()
    # cache_discovery=False evita warnings y escrituras de caché en disco.
    return build("drive", "v3", credentials=creds, cache_discovery=False)


@_with_retry
def _execute(request):
    return request.execute()


def get_file(service, file_id: str) -> dict:
    """Devuelve los metadatos de un archivo/carpeta por su ID."""
    request = service.files().get(
        fileId=file_id,
        fields=_GET_FIELDS,
        supportsAllDrives=True,
    )
    return _execute(request)


def search_folders_by_name(service, name: str) -> list[dict]:
    """Busca carpetas (no eliminadas) por nombre exacto entre lo accesible."""
    safe_name = name.replace("\\", "\\\\").replace("'", "\\'")
    query = (
        f"mimeType = '{FOLDER_MIME}' "
        f"and name = '{safe_name}' "
        f"and trashed = false"
    )
    request = service.files().list(
        q=query,
        fields="files(id, name)",
        pageSize=100,
        supportsAllDrives=True,
        includeItemsFromAllDrives=True,
        spaces="drive",
    )
    response = _execute(request)
    return response.get("files", [])


def iter_children(service, folder_id: str, page_size: int) -> Iterator[dict]:
    """
    Itera perezosamente sobre TODOS los hijos directos de una carpeta,
    resolviendo la paginación de forma transparente.
    """
    query = f"'{folder_id}' in parents and trashed = false"
    page_token: str | None = None

    while True:
        request = service.files().list(
            q=query,
            fields=_LIST_FIELDS,
            pageSize=page_size,
            pageToken=page_token,
            orderBy="folder,name",
            supportsAllDrives=True,
            includeItemsFromAllDrives=True,
            spaces="drive",
        )
        response = _execute(request)

        for f in response.get("files", []):
            yield f

        page_token = response.get("nextPageToken")
        if not page_token:
            break
