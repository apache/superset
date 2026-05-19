#!/usr/bin/env bash
# Licensed to the Apache Software Foundation (ASF) under one
# or more contributor license agreements.  See the NOTICE file
# distributed with this work for additional information
# regarding copyright ownership.  The ASF licenses this file
# to you under the Apache License, Version 2.0 (the
# "License"); you may not use this file except in compliance
# with the License.  You may obtain a copy of the License at
#
#   http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing,
# software distributed under the License is distributed on an
# "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
# KIND, either express or implied.  See the License for the
# specific language governing permissions and limitations
# under the License.

set -euo pipefail
IFS=$'\n\t'

SUPERSET_CONTAINER_NAME="superset_app"
RESOLVED_SUPERSET_CONTAINER=""
TARGET_USER=""

# Cores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
MAGENTA='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m'

info() {
  printf "${BLUE}ℹ️  %s${NC}\n\n" "$1" >&2
}

warn() {
  printf "${YELLOW}⚠️  %s${NC}\n\n" "$1" >&2
}

success() {
  printf "${GREEN}✅ %s${NC}\n\n" "$1" >&2
}

error() {
  printf "${RED}❌ %s${NC}\n\n" "$1" >&2
  exit 1
}

secret_msg() {
  printf "${CYAN}🔐 %s${NC}\n\n" "$1" >&2
}

usage() {
  printf "${MAGENTA}🛠️  Uso: %s --user <username>${NC}\n\n" "$(basename "$0")" >&2
  exit 1
}

ensure_command() {
  local bin="$1"
  if ! command -v "$bin" >/dev/null 2>&1; then
    error "Dependência obrigatória não encontrada: $bin"
  fi
}

parse_args() {
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --user)
        if [[ $# -lt 2 ]]; then
          usage
        fi
        TARGET_USER="$2"
        shift 2
        ;;
      -h|--help)
        usage
        ;;
      *)
        error "Parâmetro inválido: $1"
        ;;
    esac
  done

  if [[ -z "$TARGET_USER" ]]; then
    usage
  fi
}

ensure_container_running() {
  local candidates=()
  candidates+=("$SUPERSET_CONTAINER_NAME")
  candidates+=("superset-$SUPERSET_CONTAINER_NAME")
  local name=""

  for name in "${candidates[@]}"; do
    if docker inspect -f '{{.State.Running}}' "$name" >/dev/null 2>&1; then
      if docker exec "$name" /bin/true >/dev/null 2>&1; then
        RESOLVED_SUPERSET_CONTAINER="$name"
        return 0
      fi
    fi
  done

  RESOLVED_SUPERSET_CONTAINER=$(docker ps --format '{{.Names}}' | grep -E '(^|_)superset_app$|superset-superset_app$' | head -n 1 || true)
  if [[ -n "$RESOLVED_SUPERSET_CONTAINER" ]]; then
    if docker exec "$RESOLVED_SUPERSET_CONTAINER" /bin/true >/dev/null 2>&1; then
      return 0
    fi
  fi

  local available
  available=$(docker ps --format '{{.Names}}' | tr '\n' ' ')
  error "Não foi possível localizar um container do Superset (ex: 'superset_app' ou 'superset-superset_app'). Disponíveis: ${available:-nenhum}"
}

reset_user_password() {
  local username="$1"
  local output=""
  local control_line=""

  if ! output=$(docker exec -i "$RESOLVED_SUPERSET_CONTAINER" python3 - "$username" <<'PY'
from __future__ import annotations

import secrets
import sys
from werkzeug.security import generate_password_hash
from superset.app import create_app
from superset.extensions import db, security_manager


def main(username: str) -> None:
    app = create_app()
    with app.app_context():
        user = security_manager.find_user(username=username)
        if user is None:
            print(f"USER_NOT_FOUND:{username}")
            raise SystemExit(2)

        password = secrets.token_urlsafe(24)
        user.password = generate_password_hash(
            password=password,
            method=app.config.get("FAB_PASSWORD_HASH_METHOD", "scrypt"),
            salt_length=app.config.get("FAB_PASSWORD_HASH_SALT_LENGTH", 16),
        )
        db.session.add(user)
        db.session.commit()

        print(f"PASSWORD_RESET_OK:{password}")


if __name__ == "__main__":
    if len(sys.argv) != 2:
        raise SystemExit("Uso: reset_ass_userdb.py <username>")
    main(sys.argv[1])
PY
  ); then
    printf '%s\n\n' "$output" >&2
    control_line=$(printf '%s\n' "$output" | grep -E '^(PASSWORD_RESET_OK:|USER_NOT_FOUND:)' | tail -n 1 || true)
    if [[ "$control_line" == USER_NOT_FOUND:* ]]; then
      error "Usuário '${username}' não encontrado no Superset."
    fi
    error "Falha ao resetar senha do usuário '${username}'."
  fi

  control_line=$(printf '%s\n' "$output" | grep -E '^(PASSWORD_RESET_OK:|USER_NOT_FOUND:)' | tail -n 1 || true)

  if [[ "$control_line" == USER_NOT_FOUND:* ]]; then
    error "Usuário '${username}' não encontrado no Superset."
  fi

  if [[ "$control_line" == PASSWORD_RESET_OK:* ]]; then
    local new_password="${control_line#PASSWORD_RESET_OK:}"
    success "Senha resetada com sucesso para o usuário '${username}'. 🎉"
    secret_msg "Nova senha atribuída: ${new_password}"
    return 0
  fi

  warn "Resposta inesperada do processo interno: ${output}"
  error "Não foi possível confirmar o reset da senha."
}

main() {
  parse_args "$@"

  ensure_command docker
  ensure_container_running

  info "Container Superset identificado: ${RESOLVED_SUPERSET_CONTAINER}"
  info "Verificando usuário '${TARGET_USER}' e resetando senha..."

  reset_user_password "$TARGET_USER"

  success "Processo concluído. 🚀"
}

main "$@"
