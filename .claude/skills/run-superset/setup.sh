#!/usr/bin/env bash
# Apache Superset — full setup script
# Installs prerequisites, configures env, pulls Docker images, starts the app,
# prompts for your database connection, and runs a browser smoke test.
#
# Usage (from repo root):
#   bash .claude/skills/run-superset/setup.sh

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
SKILL_DIR="$REPO_ROOT/.claude/skills/run-superset"
cd "$REPO_ROOT"

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

ok()   { echo -e "${GREEN}✅ $*${NC}"; }
warn() { echo -e "${YELLOW}⚠️  $*${NC}"; }
fail() { echo -e "${RED}❌ $*${NC}"; exit 1; }
step() { echo -e "\n${YELLOW}── $* ${NC}"; }

echo ""
echo "╔══════════════════════════════════════════╗"
echo "║      Apache Superset — Local Setup       ║"
echo "╚══════════════════════════════════════════╝"

# ── 1. Check Docker Desktop ─────────────────────────────────────────────────────
step "1/7  Checking Docker Desktop"
if ! docker info &>/dev/null; then
  fail "Docker Desktop is not running. Open Docker Desktop first, then re-run this script."
fi
COMPOSE_VERSION=$(docker compose version --short 2>/dev/null || echo "")
if [ -z "$COMPOSE_VERSION" ]; then
  fail "docker compose (v2) not found. Install Docker Desktop — it bundles the compose plugin."
fi
ok "Docker Desktop is running (compose $COMPOSE_VERSION)"

# ── 2. Stop conflicting Homebrew services ───────────────────────────────────────
step "2/7  Freeing ports 5432 and 6379"
STOPPED_ANYTHING=false
for svc in postgresql postgresql@14 postgresql@15 postgresql@16 postgresql@17 postgresql@18 redis; do
  if brew services list 2>/dev/null | grep -qE "^${svc}\s+started"; then
    echo "  Stopping $svc..."
    brew services stop "$svc" 2>/dev/null || true
    STOPPED_ANYTHING=true
  fi
done
$STOPPED_ANYTHING && sleep 2

for port in 5432 6379; do
  if lsof -i ":$port" &>/dev/null 2>&1; then
    PROC=$(lsof -i ":$port" -sTCP:LISTEN -t 2>/dev/null | head -1)
    warn "Port $port is still in use by PID $PROC. Kill it manually before continuing."
  fi
done
ok "Ports 5432 and 6379 are free"

# ── 3. Configure docker/.env-local ──────────────────────────────────────────────
step "3/7  Configuring docker/.env-local"
cat > docker/.env-local << 'ENVEOF'
COMPOSE_PROJECT_NAME=superset
ENVEOF
ok "docker/.env-local written"

# ── 4. Install Playwright Chromium browser ───────────────────────────────────────
step "4/7  Ensuring Playwright browser is installed"
if [ ! -d "superset-frontend/node_modules/playwright" ]; then
  echo "  Running npm ci in superset-frontend/ (first time only, takes a few minutes)..."
  cd superset-frontend && npm ci --quiet && cd ..
fi
cd superset-frontend
PLAYWRIGHT_BROWSERS_PATH=$(node -e "
const {execSync} = require('child_process');
try { console.log(execSync('npx playwright --version').toString().trim()); } catch(e) {}
" 2>/dev/null || true)
npx playwright install chromium --quiet 2>/dev/null || true
cd "$REPO_ROOT"
ok "Playwright Chromium ready"

# ── 5. Pull Docker images ───────────────────────────────────────────────────────
step "5/7  Pulling Docker images"
echo "  This downloads ~1-2 GB on first run and may take several minutes..."
docker compose pull
ok "Docker images pulled"

# ── 6. Start Superset ───────────────────────────────────────────────────────────
step "6/7  Starting Superset"
docker compose down --remove-orphans 2>/dev/null || true
docker compose up -d

echo ""
echo "  Waiting for Superset to become healthy (this takes 5–20 min on first run)..."
echo "  The frontend webpack build is the slow part. Watch progress with: make logs"
echo ""

MAX_WAIT=1200  # 20 minutes
ELAPSED=0
DOT_COUNT=0
until curl -sf http://localhost:8088/health &>/dev/null; do
  if [ $ELAPSED -ge $MAX_WAIT ]; then
    fail "Superset did not become healthy after ${MAX_WAIT}s. Run 'make logs' to diagnose."
  fi
  printf "."
  DOT_COUNT=$((DOT_COUNT + 1))
  [ $((DOT_COUNT % 60)) -eq 0 ] && echo " ${ELAPSED}s"
  sleep 5
  ELAPSED=$((ELAPSED + 5))
done
echo ""
ok "Superset is healthy at http://localhost:8088"

# ── 7. Database connection (optional) ───────────────────────────────────────────
step "7/7  Database connection setup"
echo ""
echo "  Superset needs a database to query. You can connect your AWS RDS PostgreSQL"
echo "  instance now (press Enter to skip and do it later via the UI)."
echo ""
read -rp "  RDS endpoint (e.g. mydb.xxxxx.us-east-1.rds.amazonaws.com) [skip]: " DB_HOST

if [ -n "$DB_HOST" ]; then
  read -rp "  Port [5432]: " DB_PORT
  DB_PORT="${DB_PORT:-5432}"
  read -rp "  Database name: " DB_NAME
  read -rp "  Username: " DB_USER
  read -rsp "  Password: " DB_PASS
  echo ""
  read -rp "  Connection name to display in Superset [My Database]: " DB_LABEL
  DB_LABEL="${DB_LABEL:-My Database}"

  echo "  Connecting to Superset API..."

  # Get JWT token
  TOKEN=$(curl -sf -X POST http://localhost:8088/api/v1/security/login \
    -H 'Content-Type: application/json' \
    -d "{\"username\":\"admin\",\"password\":\"admin\",\"provider\":\"db\"}" \
    | python3 -c "import sys,json; print(json.load(sys.stdin)['access_token'])")

  # Get CSRF token
  CSRF=$(curl -sf http://localhost:8088/api/v1/security/csrf_token/ \
    -H "Authorization: Bearer $TOKEN" \
    | python3 -c "import sys,json; print(json.load(sys.stdin)['result'])")

  # Try with SSL first, fall back without
  CONN_URI="postgresql://${DB_USER}:${DB_PASS}@${DB_HOST}:${DB_PORT}/${DB_NAME}?sslmode=require"

  RESPONSE=$(curl -sf -X POST http://localhost:8088/api/v1/database/ \
    -H "Authorization: Bearer $TOKEN" \
    -H "X-CSRFToken: $CSRF" \
    -H "Referer: http://localhost:8088/" \
    -H "Content-Type: application/json" \
    -d "{
      \"database_name\": \"${DB_LABEL}\",
      \"sqlalchemy_uri\": \"${CONN_URI}\",
      \"expose_in_sqllab\": true
    }" 2>&1 || echo "FAILED")

  if echo "$RESPONSE" | python3 -c "import sys,json; d=json.load(sys.stdin); assert 'id' in d.get('result',{})" 2>/dev/null; then
    ok "Database '${DB_LABEL}' connected successfully"
  else
    warn "Could not add database automatically."
    echo "     Add it manually: http://localhost:8088 → Settings → Database Connections → + Database"
    echo "     URI: postgresql://${DB_USER}:****@${DB_HOST}:${DB_PORT}/${DB_NAME}?sslmode=require"
    echo "     If SSL fails, remove ?sslmode=require and try again."
  fi
fi

# ── Run smoke test ──────────────────────────────────────────────────────────────
echo ""
echo "Running browser smoke test..."
node "$SKILL_DIR/smoke.mjs"

# ── Done ────────────────────────────────────────────────────────────────────────
echo ""
echo "╔══════════════════════════════════════════╗"
echo "║           Superset is ready!             ║"
echo "╚══════════════════════════════════════════╝"
echo ""
echo "  App:      http://localhost:8088"
echo "  Login:    admin / admin"
echo ""
echo "  make down          — stop"
echo "  make up-detached   — restart in background"
echo "  make logs          — stream logs"
echo "  make nuke          — full reset (keeps your RDS data)"
echo ""
echo "  To open a browser and watch Superset live:"
echo "    node .claude/skills/run-superset/smoke.mjs"
