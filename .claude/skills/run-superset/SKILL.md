---
name: run-superset
description: Set up, run, and drive Apache Superset locally. Use when asked to start Superset, run it, take a screenshot, verify login works, connect a database, or open the app in a browser.
---

Apache Superset is a data visualisation platform that runs via Docker Compose. Drive it with `.claude/skills/run-superset/smoke.mjs` (Playwright against the webpack dev server at `http://localhost:9000`) — always runs in headed mode with a visible browser window.

All paths below are relative to the repo root (`/Users/obiora.imah/Documents/Lillio/superset/`).

---

## Prerequisites

- **Docker Desktop** installed and running (`docker compose version` must succeed)
- **Homebrew** for stopping conflicting local services
- **Node.js ≥ 20** (Playwright is already in `superset-frontend/node_modules/`)

Stop any local PostgreSQL and Redis that would conflict with Docker:

```bash
brew services stop postgresql@18   # adjust version if needed
brew services stop redis
```

Verify ports are free:

```bash
lsof -i :5432   # should return nothing
lsof -i :6379   # should return nothing
```

---

## Full Setup (first time)

Run the setup script — it handles everything interactively:

```bash
bash .claude/skills/run-superset/setup.sh
```

The script will:
1. Verify Docker Desktop is running
2. Stop conflicting Homebrew services
3. Write `docker/.env-local`
4. Install the Playwright Chromium browser binary
5. Pull Docker images (~1–2 GB first time)
6. Start all services (`docker compose up -d`)
7. Wait for health (5–20 min first run — webpack build is the slow part)
8. **Prompt for your AWS RDS database connection** (host, port, name, user, password) and add it via the Superset API
9. Run a browser smoke test to verify login works

When prompted for the RDS endpoint, press **Enter** to skip and add it later via **Settings → Database Connections** in the UI.

---

## Run (agent path) — smoke test and browser driver

```bash
node .claude/skills/run-superset/smoke.mjs
```

Opens a real Chromium window, logs in as admin, navigates to the welcome page and dashboard list, takes screenshots, then **stays open** until you press `Ctrl+C`.

Screenshots also land in `/tmp/superset-shots/`:
- `01-login.png` — login form rendered
- `02-credentials.png` — fields filled
- `03-welcome.png` — welcome page with dashboards
- `04-dashboards.png` — dashboard list
- `05-database-connections.png` — database connections page

Custom URL or shots dir:

```bash
SUPERSET_URL=http://localhost:8088 SHOTS_DIR=/tmp/my-shots node .claude/skills/run-superset/smoke.mjs --headless
```

---

## Run (human path)

```bash
make up          # start all services (foreground, streams logs)
make up-detached # start in background
```

Then open **http://localhost:9000** in your browser. Login: `admin` / `admin`.

> Port 9000 is the webpack dev server — it proxies API calls to Flask and serves JS with hot reload.
> Port 8088 (Flask directly) also works but has no hot reload.

---

## Connecting your AWS RDS database

If you skipped during setup, add the database connection at any time:

### Via the API (scriptable)

```bash
# 1. Get a token
TOKEN=$(curl -sf -X POST http://localhost:8088/api/v1/security/login \
  -H 'Content-Type: application/json' \
  -d '{"username":"admin","password":"admin","provider":"db"}' \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['access_token'])")

# 2. Get CSRF token
CSRF=$(curl -sf http://localhost:8088/api/v1/security/csrf_token/ \
  -H "Authorization: Bearer $TOKEN" \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['result'])")

# 3. Add the database
curl -sf -X POST http://localhost:8088/api/v1/database/ \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-CSRFToken: $CSRF" \
  -H "Referer: http://localhost:8088/" \
  -H "Content-Type: application/json" \
  -d '{
    "database_name": "My RDS Database",
    "sqlalchemy_uri": "postgresql://USER:PASS@ENDPOINT:5432/DBNAME?sslmode=require",
    "expose_in_sqllab": true
  }'
```

### Via the UI

**Settings → Database Connections → + Database → PostgreSQL**

Enter URI: `postgresql://USER:PASS@your-db.region.rds.amazonaws.com:5432/DBNAME?sslmode=require`

Click **Test Connection** before saving. If SSL fails, remove `?sslmode=require`.

**Important:** Before connecting, whitelist your Mac's public IP in the RDS security group (port 5432 inbound):
```bash
curl -s https://checkip.amazonaws.com
```

---

## Common commands

```bash
make up-detached   # start in background
make down          # stop (volumes preserved)
make nuke          # destroy containers + volumes (RDS data is unaffected)
make logs          # stream logs from all containers
make ps            # show container status
```

---

## Gotchas

- **Black screen on port 9000** — caused by Superset's strict CSP blocking the webpack dev build's `eval()` source maps. Fixed by `docker/pythonpath_dev/superset_config_docker.py` containing `TALISMAN_ENABLED = False`. If that file is missing or the container hasn't restarted since it was added, re-create it and run `docker compose restart superset`.

- **`superset-init` fails with `port 5433 refused`** — caused by leftover `DATABASE_PORT=5433` in `docker/.env-local` from a previous port-conflict workaround. The fix: `docker/.env-local` must only contain `COMPOSE_PROJECT_NAME=superset`. The internal Docker network always uses port 5432.

- **Nginx loops with `curl: blank argument`** — normal startup noise while webpack is compiling (takes 5–10 min). Once webpack writes `manifest.json`, nginx starts routing and the errors stop.

- **`playwright install chromium` needed after `npm ci`** — the frontend's node_modules has playwright but the browser binary is separate. Run `cd superset-frontend && npx playwright install chromium` if the smoke script says "Executable doesn't exist."

- **`make nuke` only deletes local Docker data** — your AWS RDS database is completely untouched. Only Superset's internal metadata (saved dashboards, chart configs, user accounts) is lost. Re-add the RDS connection after nuking.

---

## Troubleshooting

- **`docker compose: unknown command`** — you have the old `docker-compose` v1 binary. Install Docker Desktop which bundles compose v2: `brew install --cask docker`.

- **`port 5432 already in use`** — run `brew services stop postgresql@18` (adjust version: check with `brew services list`).

- **`port 6379 already in use`** — run `brew services stop redis`.

- **Black screen on login page in browser** — you're hitting port 9000 (webpack proxy). Use port **8088** instead.

- **`superset-init` exits with code 1** — check `docker logs superset-superset-init-1`. Most likely cause: wrong port in `docker/.env-local`. Reset with `docker compose down && echo 'COMPOSE_PROJECT_NAME=superset' > docker/.env-local && docker compose up -d`.

- **RDS connection refused** — your IP isn't whitelisted. Go to AWS Console → RDS → Your instance → Security Groups → Edit Inbound Rules → add PostgreSQL port 5432 from your IP (`curl https://checkip.amazonaws.com`).
