"""
Notas de voz: grabación posterior a sesión, por paciente.

El audio vive en Supabase Storage (bucket privado "notas-voz"), NO en la BD:
`notas_voz` solo guarda metadatos + la ruta del archivo. Igual que los PDFs
de Drive, el audio nunca se sirve con un link directo — siempre por este
proxy (`get_audio`), que reenvía el JWT del usuario tanto a PostgREST como al
API de Storage, así que la RLS de ambos aplica igual. Ver
`script_notas_voz_supabase.sql` (raíz del repo) para el esquema, el bucket y
las políticas.
"""
from __future__ import annotations

import uuid
from typing import Optional

import requests
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from fastapi.responses import StreamingResponse

from app.auth import bearer_token, require_user
from app.config import settings
from app.routers.playlists import _postgrest

router = APIRouter(prefix="/api", tags=["notas_voz"])

_BUCKET = "notas-voz"
_SELECT = "id,paciente_id,cita_id,duracion_segundos,titulo,transcripcion,created_at"


def _storage_headers(token: str, content_type: str | None = None) -> dict:
    headers = {
        "apikey": settings.supabase_anon_key or "",
        "Authorization": f"Bearer {token}",
    }
    if content_type:
        headers["Content-Type"] = content_type
    return headers


def _storage_url(path: str) -> str:
    base = (settings.supabase_url or "").rstrip("/")
    return f"{base}/storage/v1/object/{_BUCKET}/{path}"


@router.get("/notas-voz", summary="Lista las notas de voz de un paciente")
def list_notas(
    paciente_id: str,
    user: dict = Depends(require_user),
    token: str = Depends(bearer_token),
) -> list[dict]:
    resp = _postgrest(
        "GET",
        "/notas_voz",
        token,
        params={
            "select": _SELECT,
            "paciente_id": f"eq.{paciente_id}",
            "order": "created_at.desc",
        },
    )
    return resp.json()


@router.post("/notas-voz", status_code=201, summary="Sube una nota de voz nueva")
async def create_nota(
    paciente_id: str = Form(...),
    cita_id: Optional[str] = Form(default=None),
    titulo: Optional[str] = Form(default=None),
    duracion_segundos: Optional[int] = Form(default=None),
    audio: UploadFile = File(...),
    user: dict = Depends(require_user),
    token: str = Depends(bearer_token),
) -> dict:
    data = await audio.read()
    if not data:
        raise HTTPException(status_code=422, detail="El archivo de audio está vacío.")

    nota_id = str(uuid.uuid4())
    ext = "webm"
    if audio.filename and "." in audio.filename:
        ext = audio.filename.rsplit(".", 1)[-1][:8]
    storage_path = f"{user['id']}/{nota_id}.{ext}"

    upload_resp = requests.post(
        _storage_url(storage_path),
        headers=_storage_headers(token, audio.content_type or "audio/webm"),
        data=data,
        timeout=30,
    )
    if upload_resp.status_code >= 400:
        raise HTTPException(status_code=502, detail="No se pudo subir el audio.")

    resp = _postgrest(
        "POST",
        "/notas_voz",
        token,
        prefer="return=representation",
        raise_on_error=False,
        json_body={
            "id": nota_id,
            "user_id": user["id"],
            "paciente_id": paciente_id,
            "cita_id": cita_id,
            "storage_path": storage_path,
            "duracion_segundos": duracion_segundos,
            "titulo": titulo,
        },
    )
    if resp.status_code >= 400:
        # No dejar un archivo huérfano si la fila de metadatos falla.
        requests.delete(_storage_url(storage_path), headers=_storage_headers(token))
        raise HTTPException(status_code=502, detail="No se pudo guardar la nota.")

    created = resp.json()
    return created[0] if isinstance(created, list) and created else created


@router.get("/notas-voz/{nota_id}/audio", summary="Transmite el audio (proxy autenticado)")
def get_audio(
    nota_id: str,
    user: dict = Depends(require_user),
    token: str = Depends(bearer_token),
) -> StreamingResponse:
    resp = _postgrest(
        "GET",
        "/notas_voz",
        token,
        params={"id": f"eq.{nota_id}", "select": "storage_path"},
    )
    rows = resp.json()
    if not rows:
        raise HTTPException(status_code=404, detail="Esa nota no existe.")
    storage_path = rows[0]["storage_path"]

    audio_resp = requests.get(
        _storage_url(storage_path),
        headers=_storage_headers(token),
        stream=True,
        timeout=30,
    )
    if audio_resp.status_code >= 400:
        audio_resp.close()
        raise HTTPException(status_code=404, detail="No se pudo leer el audio.")

    def _body():
        try:
            for chunk in audio_resp.iter_content(chunk_size=65536):
                if chunk:
                    yield chunk
        finally:
            audio_resp.close()

    content_type = audio_resp.headers.get("Content-Type", "audio/webm")
    return StreamingResponse(_body(), media_type=content_type)


@router.delete(
    "/notas-voz/{nota_id}",
    status_code=204,
    summary="Borra una nota de voz definitivamente (audio + metadatos)",
)
def delete_nota(
    nota_id: str,
    user: dict = Depends(require_user),
    token: str = Depends(bearer_token),
) -> None:
    resp = _postgrest(
        "DELETE",
        "/notas_voz",
        token,
        params={"id": f"eq.{nota_id}"},
        prefer="return=representation",
    )
    rows = resp.json()
    if not rows:
        raise HTTPException(status_code=404, detail="Esa nota no existe.")
    requests.delete(_storage_url(rows[0]["storage_path"]), headers=_storage_headers(token))
