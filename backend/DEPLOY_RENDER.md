# Despliegue del backend en Render + conexión con el frontend

Guía para publicar la **Psicoteca API** (FastAPI) en Render.com (plan gratuito)
y conectarla con el frontend ya alojado en `https://psicoteca.miceliocreate.com`.

---

## 1. Preparativos (una sola vez)

1. **Repositorio Git.** Render despliega desde GitHub/GitLab. Sube el proyecto a
   un repositorio. Verifica que estos archivos **NO** se suban (ya están en
   `.gitignore`): `.env`, `credentials.json`, `*.db`, `venv/`.
2. **Ten a mano el `credentials.json`** de la Service Account (lo pegarás como
   variable de entorno, no como archivo).
3. **Consigue el ID de la carpeta raíz** de Drive (`PSICOTECA`). Aparece en el
   log del primer sync local, o en la URL de la carpeta en Drive
   (`.../folders/ESTE_ES_EL_ID`).

---

## 2. Crear el servicio en Render

### Opción A — Blueprint (recomendada, usa `render.yaml`)

1. En Render: **New + → Blueprint** y conecta el repositorio.
2. Render leerá `render.yaml` (en la raíz) y creará el servicio web.
3. Cuando lo pida, rellena las variables marcadas como secretas (ver tabla).

### Opción B — Manual (Web Service)

1. **New + → Web Service** y conecta el repositorio.
2. Configura:
   - **Root Directory:** `backend`
   - **Runtime:** Python 3
   - **Build Command:** `pip install -r requirements.txt`
   - **Start Command:** `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
   - **Health Check Path:** `/api/health`
3. Añade las variables de entorno de la tabla siguiente.

---

## 3. Variables de entorno (en el panel de Render)

| Variable | Valor | Obligatoria |
|---|---|---|
| `GOOGLE_CREDENTIALS_JSON` | *Contenido íntegro del `credentials.json`* (pégalo tal cual) | ✅ Sí |
| `ROOT_FOLDER_ID` | ID de la carpeta `PSICOTECA` en Drive | ✅ Recomendada |
| `CORS_ALLOW_ORIGINS` | `https://psicoteca.miceliocreate.com` | ✅ Sí |
| `ROOT_FOLDER_NAME` | `PSICOTECA` | Opcional |
| `SCHEDULER_ENABLED` | `true` | Opcional (por defecto true) |
| `SYNC_INTERVAL_MINUTES` | `60` | Opcional |
| `SYNC_ON_STARTUP` | `true` | Opcional |
| `SYNC_JITTER_SECONDS` | `30` | Opcional |
| `SYNC_TRIGGER_TOKEN` | *(un secreto tuyo)* | Opcional (activa `POST /api/sync`) |
| `PYTHON_VERSION` | `3.12.8` | Opcional |

> **`GOOGLE_CREDENTIALS_JSON`**: no subas `credentials.json` al repo. Copia su
> contenido completo (un JSON de una línea) y pégalo como valor de esta variable.
> El código lo prioriza sobre cualquier archivo en disco.

---

## 4. Puerto (PORT) — ya resuelto

Render inyecta la variable `PORT`. El **Start Command** usa
`--port $PORT`, y como red de seguridad `python -m app.main` también lee `PORT`.
No hay que hacer nada más.

---

## 5. Sincronización automática (Fase 4) — cómo funciona

- Al arrancar, si `SYNC_ON_STARTUP=true`, se lanza un **sync inicial en segundo
  plano** (no bloquea el arranque del servidor).
- Después, un `BackgroundScheduler` ejecuta el sync **cada
  `SYNC_INTERVAL_MINUTES`**.
- **Sin duplicados:** un cerrojo global + `max_instances=1` + `coalesce=True`
  garantizan que nunca corran dos sincronizaciones a la vez.
- **Un solo worker:** el Start Command arranca **un único proceso** de Uvicorn.
  ⚠️ No añadas `--workers 2+` ni uses Gunicorn con varios workers: cada worker
  crearía su propio planificador. Si algún día escalas, deja el scheduler activo
  en un solo sitio y pon `SCHEDULER_ENABLED=false` en el resto.
- **Disco efímero (plan free):** la BD SQLite se borra en cada despliegue/arranque
  en frío; el sync de arranque la repuebla. Para persistirla, usa un disco
  (plan de pago) y `DATABASE_PATH=/var/data/psicoteca.db` (ver `render.yaml`).
- **Plan free y suspensión:** tras ~15 min sin tráfico, Render suspende la
  instancia y el planificador se pausa; al recibir la siguiente visita, arranca
  y vuelve a sincronizar. Para syncs garantizados 24/7, usa un plan de pago o un
  Cron Job de Render.

### Verificar que el sync funciona
- `GET https://TU-APP.onrender.com/api/health` → `{"status":"ok"}`
- `GET https://TU-APP.onrender.com/api/sync/status` → estado del planificador,
  próxima ejecución y resultado del último sync.
- `GET https://TU-APP.onrender.com/api/stats` → totales (tras el primer sync).
- Disparo manual (si configuraste `SYNC_TRIGGER_TOKEN`):
  `POST /api/sync` con la cabecera `X-Sync-Token: <tu-token>`.

---

## 6. Conectar el FRONTEND a la URL de Render

El frontend usa la variable **`VITE_API_BASE`** (ver `frontend/src/api.js`).
Es una variable de **tiempo de compilación** (Vite la incrusta en el `build`),
por lo que hay que **recompilar y volver a subir** el frontend a Hostinger.

1. En la carpeta `frontend/`, crea un archivo **`.env.production`** con la URL de
   Render (⚠️ **sin barra final**):

   ```
   VITE_API_BASE=https://TU-APP.onrender.com
   ```

2. Recompila:

   ```
   npm install
   npm run build
   ```

3. Sube el contenido de **`frontend/dist/`** a Hostinger (reemplazando el
   despliegue actual de `psicoteca.miceliocreate.com`).

A partir de ahí, el frontend llamará a `https://TU-APP.onrender.com/api/...` y el
CORS del backend ya autoriza ese dominio.

> Sustituye `TU-APP.onrender.com` por la URL real que te asigne Render
> (aparece en el panel del servicio, arriba).
