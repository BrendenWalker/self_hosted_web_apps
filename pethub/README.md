# PetHub

Pet activity tracking (toilet visits, water, reports, multi-user pets). Migrated from the standalone PetDB Flask project into this monorepo and renamed to PetHub.

## Stack

| Layer | Technology |
|--------|------------|
| Backend | Python 3.13, Flask, SQLAlchemy 2, Alembic, Gunicorn |
| Data | PostgreSQL |
| Frontend | React 18 + Vite, nginx serves the built SPA and proxies `/api/*` to Flask |

The hub layout matches other services: `backend/`, `frontend/`, `database/`, `docker-compose.yml`, `portainer-stack.yml`, and `env.example`.

Ports follow the monorepo convention after RetirementHub (8100/8110): **backend 8120**, **frontend 8130** (host maps to container port 80).

## Local development

From `pethub/`:

1. Copy `env.example` to `.env` and set `SECRET_KEY`, database credentials, and optional SMTP variables.
2. Ensure PostgreSQL is reachable (local instance or existing server).
3. Run the stack:

```bash
docker compose up --build
```

Open **http://localhost:8130**. The UI is the React SPA; JSON APIs live under `/api` on the same origin (proxied to Flask).

### Frontend only (Vite dev server)

From `pethub/frontend` after `npm install`:

```bash
npm run dev
```

Vite listens on **port 3002** and proxies `/api` to `http://localhost:8120` (override with `VITE_API_PROXY_TARGET`). Set `CORS_ORIGINS` on the backend to include `http://localhost:3002` (see `env.example`) so session cookies work when testing cross-origin.

**Offline activity queue:** Home activity saves use the same `localStorage` key as the legacy app (`pending_activities_v1`). If you are offline or the quick POST times out (~1.5s), the payload is queued and flushed when you are back online and signed in. The header shows pending count and an “Offline” badge; closing the tab while offline with pending items triggers the usual beforeunload warning.

For Flask’s dev server without Docker, from `pethub/backend` with a virtualenv and `pip install -r requirements.txt`:

```bash
set PORT=8120
python app.py
```

## Database

- **Alembic** migrations live under `pethub/backend/alembic/`. The container entrypoint runs `alembic upgrade head` when `DATABASE_URL` is set or when `DB_HOST` is set (URL is built like `db.py`).
- **`database/schema.sql`** is a reference snapshot for greenfield installs; existing databases created as `petdb` can keep the same `DB_NAME` and Alembic history.

## CI and releases

GitHub Actions builds `pethub-backend` and `pethub-frontend` images on pull requests (no push) and on tags `pethub/X.Y.Z`, same semver rules as other hubs.

## Legacy Jinja UI

The Flask app still contains Jinja templates and `/auth` form routes for backwards compatibility; production traffic through nginx uses the React build. You can remove the template stack once you no longer need server-rendered pages.
