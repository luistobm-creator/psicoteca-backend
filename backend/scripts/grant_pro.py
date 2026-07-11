"""
Admin: otorgar / quitar el plan Pro manualmente (cortesías, amigos, staff…).

Escribe el plan en `app_metadata.plan` de Supabase —la MISMA fuente de verdad que
usa el webhook de Stripe— mediante la Admin API con la SERVICE_ROLE key. Por eso
NO cobra nada: marca la cuenta como Pro directamente.

⚠️ Usa la SERVICE_ROLE key (SECRETA). Ejecútalo SOLO en un entorno de confianza
(tu máquina con `backend/.env`, o la shell de Render). Nunca lo expongas por HTTP.

El usuario debe haberse REGISTRADO antes con ese correo para poder marcarlo. Tras
otorgar Pro, si ya tenía la sesión abierta debe cerrarla y volver a entrar (o
recargar) para que el nuevo plan viaje en su token.

Uso (desde la carpeta `backend/`, con las dependencias del venv disponibles):

    # Dar Pro a uno o varios correos (cortesía):
    python scripts/grant_pro.py amigo@correo.com otra@correo.com

    # Quitar Pro (vuelve a Free):
    python scripts/grant_pro.py amigo@correo.com --revoke

    # Ver quién tiene Pro ahora mismo:
    python scripts/grant_pro.py --list
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

# Permite ejecutar el script directamente (añade backend/ a sys.path).
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import requests  # noqa: E402

from app.config import settings  # noqa: E402

# La consola de Windows suele ser cp1252; forzamos UTF-8 para imprimir correos y
# símbolos con acentos sin romper.
for _stream in (sys.stdout, sys.stderr):
    try:
        _stream.reconfigure(encoding="utf-8", errors="replace")
    except (AttributeError, ValueError):
        pass


def _admin() -> tuple[str, dict]:
    """URL base y cabeceras autenticadas para la Admin API de Supabase."""
    url = (settings.supabase_url or "").rstrip("/")
    key = settings.supabase_service_role_key or ""
    if not url or not key:
        sys.exit(
            "ERROR: faltan SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en backend/.env."
        )
    headers = {
        "apikey": key,
        "Authorization": f"Bearer {key}",
        "Content-Type": "application/json",
    }
    return url, headers


def _iter_users(base: str, headers: dict):
    """Itera TODOS los usuarios de Supabase (Admin API, paginado).

    Se detiene cuando una página vuelve vacía (robusto aunque el servidor limite
    `per_page` por debajo del valor pedido). Tope de seguridad por si acaso.
    """
    page = 1
    while page <= 1000:
        resp = requests.get(
            f"{base}/auth/v1/admin/users",
            headers=headers,
            params={"page": page, "per_page": 200},
            timeout=20,
        )
        if resp.status_code != 200:
            sys.exit(
                f"ERROR: la Admin API respondió {resp.status_code}: {resp.text[:200]}"
            )
        users = resp.json().get("users", [])
        if not users:
            return
        yield from users
        page += 1


def _plan_of(user: dict) -> str:
    """Plan efectivo: Pro si `app_metadata.plan == "pro"` (ÚNICA fuente de verdad,
    igual que el backend en app/auth.py). `user_metadata` ya NO otorga acceso."""
    return "pro" if (user.get("app_metadata") or {}).get("plan") == "pro" else "free"


def find_user_by_email(base: str, headers: dict, email: str) -> dict | None:
    target = email.strip().lower()
    for user in _iter_users(base, headers):
        if (user.get("email") or "").lower() == target:
            return user
    return None


def set_plan(base: str, headers: dict, user_id: str, pro: bool) -> bool:
    """Fija el plan en app_metadata (ÚNICA fuente de verdad server-side).

    Al REVOCAR limpia también el legado `user_metadata.plan` (del viejo toggle de
    dev, que ya NO otorga acceso) para no dejar datos obsoletos. Supabase FUSIONA
    las claves, así que no se pierden provider/providers ni otros campos.
    """
    body: dict = {"app_metadata": {"plan": "pro" if pro else "free"}}
    if not pro:
        body["user_metadata"] = {"plan": "free"}
    resp = requests.put(
        f"{base}/auth/v1/admin/users/{user_id}",
        headers=headers,
        json=body,
        timeout=20,
    )
    if resp.status_code not in (200, 201):
        print(
            f"    ERROR al actualizar ({resp.status_code}): {resp.text[:200]}",
            file=sys.stderr,
        )
        return False
    return True


def grant(emails: list[str], revoke: bool) -> None:
    base, headers = _admin()
    target_plan = "free" if revoke else "pro"
    print(("Quitando Pro" if revoke else "Otorgando Pro") + f" a {len(emails)} cuenta(s):")
    changed = 0
    for email in emails:
        user = find_user_by_email(base, headers, email)
        if user is None:
            print(f"  ! {email}: no existe una cuenta con ese correo (¿ya se registró?).")
            continue
        before = _plan_of(user)
        if set_plan(base, headers, user["id"], pro=not revoke):
            print(f"  ✓ {email}: {before} → {target_plan}   (id {user['id']})")
            changed += 1
    if changed:
        print(
            f"\nListo: {changed} cuenta(s) actualizada(s). Si el usuario tenía sesión "
            "abierta, debe salir y volver a entrar para ver el cambio."
        )


def show_pro_list() -> None:
    base, headers = _admin()
    pros = [u for u in _iter_users(base, headers) if _plan_of(u) == "pro"]
    print(f"Cuentas con plan Pro: {len(pros)}")
    for user in sorted(pros, key=lambda u: (u.get("email") or "")):
        print(f"  • {user.get('email')}")


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Admin: otorgar o quitar el plan Pro manualmente (cortesías)."
    )
    parser.add_argument("emails", nargs="*", help="Correos a los que dar/quitar Pro.")
    parser.add_argument(
        "--revoke", action="store_true", help="Quitar Pro (volver a Free)."
    )
    parser.add_argument(
        "--list", action="store_true", help="Listar las cuentas Pro actuales y salir."
    )
    args = parser.parse_args()

    if args.list:
        show_pro_list()
        return
    if not args.emails:
        parser.error("indica al menos un correo, o usa --list.")
    grant(args.emails, revoke=args.revoke)


if __name__ == "__main__":
    main()
