#!/usr/bin/env bash
#
# Licensed to the Apache Software Foundation (ASF) under one or more
# contributor license agreements.  See the NOTICE file distributed with
# this work for additional information regarding copyright ownership.
# The ASF licenses this file to You under the Apache License, Version 2.0
# (the "License"); you may not use this file except in compliance with
# the License.  You may obtain a copy of the License at
#
#    http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.
#

# -----------------------------------------------------------------------
# Smart docker-compose wrapper for running multiple Superset instances
#
# Features:
#   - Auto-generates unique project name from directory
#   - Finds available ports automatically
#   - No manual .env-local editing needed
#
# Usage:
#   ./scripts/docker-compose-up.sh [docker-compose args...]
#
# Examples:
#   ./scripts/docker-compose-up.sh           # Start all services
#   ./scripts/docker-compose-up.sh -d        # Start detached
#   ./scripts/docker-compose-up.sh down      # Stop services
# -----------------------------------------------------------------------

set -e

# Get the repo root directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# Generate project name from directory name (sanitized for Docker)
DIR_NAME=$(basename "$REPO_ROOT")
PROJECT_NAME=$(echo "$DIR_NAME" | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9]/-/g' | sed 's/--*/-/g' | sed 's/^-//' | sed 's/-$//')

# Function to check if a port is available
is_port_available() {
    local port=$1
    if command -v lsof &> /dev/null; then
        ! lsof -i ":$port" &> /dev/null
    elif command -v netstat &> /dev/null; then
        ! netstat -tuln 2>/dev/null | grep -q ":$port "
    elif command -v ss &> /dev/null; then
        ! ss -tuln 2>/dev/null | grep -q ":$port "
    else
        # If no tool available, assume port is available
        return 0
    fi
}

# Track ports we've already claimed in this session
CLAIMED_PORTS=""

# Function to check if port is available and not already claimed
is_port_free() {
    local port=$1
    # Check not already claimed by us
    if [[ " $CLAIMED_PORTS " =~ " $port " ]]; then
        return 1
    fi
    # Check not in use on system
    is_port_available $port
}

# Function to find and claim next available port starting from base
# Sets the result in the variable named by $2
find_and_claim_port() {
    local base_port=$1
    local var_name=$2
    local max_attempts=100
    local port=$base_port

    for ((i=0; i<max_attempts; i++)); do
        if is_port_free $port; then
            CLAIMED_PORTS="$CLAIMED_PORTS $port"
            eval "$var_name=$port"
            return 0
        fi
        ((port++))
    done

    echo "ERROR: Could not find available port starting from $base_port" >&2
    return 1
}

# Base ports (defaults from docker-compose.yml)
BASE_NGINX=80
BASE_SUPERSET=8088
BASE_NODE=9000
BASE_WEBSOCKET=8080
BASE_CYPRESS=8081
BASE_DATABASE=5432
BASE_REDIS=6379

# Find available ports (no subshells - claims persist correctly)
echo "🔍 Finding available ports..."
find_and_claim_port $BASE_NGINX NGINX_PORT
find_and_claim_port $BASE_SUPERSET SUPERSET_PORT
find_and_claim_port $BASE_NODE NODE_PORT
find_and_claim_port $BASE_WEBSOCKET WEBSOCKET_PORT
find_and_claim_port $BASE_CYPRESS CYPRESS_PORT
find_and_claim_port $BASE_DATABASE DATABASE_PORT
find_and_claim_port $BASE_REDIS REDIS_PORT

# Export for docker-compose
export COMPOSE_PROJECT_NAME="$PROJECT_NAME"

# Function to get port from running container, or use the found available port
get_running_port() {
    local service=$1
    local container_port=$2
    local fallback=$3
    local running_port=$(docker compose port "$service" "$container_port" 2>/dev/null | cut -d: -f2)
    if [[ -n "$running_port" ]]; then
        echo "$running_port"
    else
        echo "$fallback"
    fi
}

# Check if containers are running and get actual ports, otherwise use available ports
cd "$REPO_ROOT"
if docker compose ps --status running 2>/dev/null | grep -q "$PROJECT_NAME"; then
    # Containers are running - get actual ports
    NGINX_PORT=$(get_running_port nginx 80 $NGINX_PORT)
    SUPERSET_PORT=$(get_running_port superset 8088 $SUPERSET_PORT)
    NODE_PORT=$(get_running_port superset-node 9000 $NODE_PORT)
    WEBSOCKET_PORT=$(get_running_port superset-websocket 8080 $WEBSOCKET_PORT)
    DATABASE_PORT=$(get_running_port db 5432 $DATABASE_PORT)
    REDIS_PORT=$(get_running_port redis 6379 $REDIS_PORT)
fi

export NGINX_PORT
export SUPERSET_PORT
export NODE_PORT
export WEBSOCKET_PORT
export CYPRESS_PORT
export DATABASE_PORT
export REDIS_PORT

# Function to print connection info
print_connection_info() {
    echo ""
    echo "🐳 Superset ($PROJECT_NAME):"
    echo "   Dev Server: http://localhost:$NODE_PORT  ← Use this for development"
    echo "   Superset:   http://localhost:$SUPERSET_PORT"
    echo "   Nginx:      http://localhost:$NGINX_PORT"
    echo "   WebSocket:  localhost:$WEBSOCKET_PORT"
    echo "   Database:   localhost:$DATABASE_PORT"
    echo "   Redis:      localhost:$REDIS_PORT"
    echo ""
}

# Function to open browser (macOS/Linux compatible)
open_browser() {
    local url="http://localhost:$NODE_PORT"
    if command -v open &> /dev/null; then
        open "$url"  # macOS
    elif command -v xdg-open &> /dev/null; then
        xdg-open "$url"  # Linux
    else
        echo "Open in browser: $url"
    fi
}

print_connection_info

# Handle special commands
case "${1:-}" in
    --dry-run)
        echo "✅ Dry run complete. To start, run without --dry-run"
        exit 0
        ;;
    --env)
        # Output as sourceable environment variables
        echo "export COMPOSE_PROJECT_NAME='$PROJECT_NAME'"
        echo "export NGINX_PORT=$NGINX_PORT"
        echo "export SUPERSET_PORT=$SUPERSET_PORT"
        echo "export NODE_PORT=$NODE_PORT"
        echo "export WEBSOCKET_PORT=$WEBSOCKET_PORT"
        echo "export CYPRESS_PORT=$CYPRESS_PORT"
        echo "export DATABASE_PORT=$DATABASE_PORT"
        echo "export REDIS_PORT=$REDIS_PORT"
        exit 0
        ;;
    ports)
        # Just show the ports (already printed above)
        exit 0
        ;;
    open)
        # Open browser to the dev server
        echo "🌐 Opening browser..."
        open_browser
        exit 0
        ;;
    down|stop|logs|ps|exec|restart)
        # Pass through to docker compose
        docker compose "$@"
        ;;
    nuke)
        # Nuclear option: remove everything (containers, volumes, local images)
        echo "💥 Nuking all containers, volumes, and locally-built images for $PROJECT_NAME..."
        docker compose down -v --rmi local
        echo "✅ Done. Run 'make up' or './scripts/docker-compose-up.sh' to start fresh."
        ;;
    *)
        # Default: start services
        # Print connection info again when user exits (Ctrl+C)
        trap 'echo ""; print_connection_info; echo "Run '\''make open'\'' to open browser, '\''make ports'\'' to see ports"' EXIT
        docker compose up "$@"
        ;;
esac
