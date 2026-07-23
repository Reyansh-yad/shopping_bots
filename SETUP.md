# PRC Engine — Local Dev Setup

## Prerequisites

| Tool | Version | Install |
|---|---|---|
| Python | ≥ 3.14 | [python.org](https://python.org) |
| uv | latest | `pip install uv` |
| Node.js | ≥ 20 | [nodejs.org](https://nodejs.org) |
| PostgreSQL | ≥ 14 | Local install **or** Docker (see Option B) |
| Docker + Compose | v2 | Optional — only for Option B |

---

## Option A — Run everything locally (no Docker)

### 1. Clone and configure environment

```bash
# In the repo root
cp .env.example .env
# Edit .env — set VITE_API_URL=http://localhost:8000 (already the default)

cp Backend/.env.example Backend/.env
# Edit Backend/.env — fill in your Postgres credentials and confirm:
#   FRONTEND_URL=http://localhost:5173
```

### 2. Set up the database

Make sure PostgreSQL is running locally, then create the database:

```sql
-- Run in psql as a superuser
CREATE DATABASE mydb;
```

> The schema (tables, indexes) is created automatically when the backend starts via `create_schema()` in `main.py`. You do **not** need to run any migration commands manually.

### 3. Start the backend

```bash
cd Backend
uv sync                          # install all Python deps from uv.lock
uv run uvicorn app.main:app --reload --port 8000
```

The first startup will print `INFO: Created schema` and `INFO: Expired sessions cleaned up.` — that means it connected to Postgres successfully.

Backend is now available at: **http://localhost:8000**  
Interactive API docs: **http://localhost:8000/docs**

### 4. Start the frontend

```bash
# From the repo root
npm install
npm run dev
```

Vite will print the local URL — usually **http://localhost:5173** — and open `login.html` automatically.

The Vite proxy in `vite.config.js` forwards `/auth`, `/search`, and `/profile` to `localhost:8000`, so you don't need to configure CORS for local dev.

---

## Option B — Docker (Postgres + Backend), Vite outside

This option runs Postgres and the FastAPI backend in Docker, and Vite locally on your machine. This is the recommended approach if you don't want to install Postgres manually.

### 1. Configure environment

```bash
cp Backend/.env.example Backend/.env
# Edit Backend/.env — at minimum set a DB_PASSWORD
# DB_HOST must stay as 'localhost' in Backend/.env —
# docker-compose.yml overrides it to 'db' for the container.
```

### 2. Start Postgres + Backend

```bash
docker compose up --build
```

- Postgres will be available on `localhost:5432`
- Backend will be available on `localhost:8000`
- Schema is created automatically on backend startup

To run in the background: `docker compose up -d --build`  
To view logs: `docker compose logs -f backend`  
To stop: `docker compose down`

### 3. Start the frontend

```bash
# From the repo root (outside Docker)
npm install
npm run dev
```

---

## Verify everything works

1. Open **http://localhost:5173/Frontend/src/pages/signup.html**
2. Create an account
3. You're redirected to login — log in
4. Dashboard should load with your username and empty tracked products
5. Go to the main page (`/`) — search for a product (e.g. "laptop")
6. Click "Track Price" on a result — it should appear in your dashboard

---

## Environment variable reference

### Root `.env` (frontend / Vite)

| Variable | Default | Description |
|---|---|---|
| `VITE_API_URL` | `http://localhost:8000` | Backend base URL used by `api.js` |

### `Backend/.env`

| Variable | Example | Description |
|---|---|---|
| `DB_NAME` | `mydb` | PostgreSQL database name |
| `DB_USER` | `postgres` | PostgreSQL username |
| `DB_PASSWORD` | *(secret)* | PostgreSQL password |
| `DB_HOST` | `localhost` | PostgreSQL host (Docker overrides to `db`) |
| `DB_PORT` | `5432` | PostgreSQL port |
| `FRONTEND_URL` | `http://localhost:5173` | Allowed CORS origin for the frontend |

---

## API reference (quick)

| Method | Path | Auth required | Description |
|---|---|---|---|
| POST | `/auth/register` | No | Create account |
| POST | `/auth/login` | No | Login, returns `session_id` |
| POST | `/auth/logout` | session_id in body | Invalidate session |
| GET | `/auth/me?session_id=…` | session_id in query | Get current user |
| POST | `/search` | No | Search products across scrapers |
| POST | `/profile/` | session_id in body | Get profile + tracked products |
| POST | `/profile/track` | session_id in body | Start tracking a product |
| POST | `/profile/untrack` | session_id in body | Stop tracking a product |
| POST | `/profile/stats` | session_id in body | Dashboard statistics |

Full interactive docs: **http://localhost:8000/docs**

---

## Common issues

**Backend fails with `could not connect to server`**  
→ PostgreSQL isn't running. Start it, or use `docker compose up db`.

**`ModuleNotFoundError` on backend start**  
→ Run `uv sync` inside `Backend/` first.

**Frontend shows "Search error — is the backend running?"**  
→ The backend isn't reachable. Check that `uvicorn` is running on port 8000.

**Login succeeds but dashboard shows "Failed to load tracked products"**  
→ Check the browser console for a CORS error. Confirm `FRONTEND_URL=http://localhost:5173` in `Backend/.env` and restart the backend.
