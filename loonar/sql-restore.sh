#!/usr/bin/env bash

set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
COMPOSE_FILE="${REPO_ROOT}/docker-compose-loonar.yml"
ENV_FILE="${SCRIPT_DIR}/.env"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

info() {
	printf "%bℹ️  %s%b\n\n" "${CYAN}" "$1" "${NC}"
}

ok() {
	printf "%b✅ %s%b\n\n" "${GREEN}" "$1" "${NC}"
}

warn() {
	printf "%b⚠️  %s%b\n\n" "${YELLOW}" "$1" "${NC}"
}

fail() {
	printf "%b❌ %s%b\n\n" "${RED}" "$1" "${NC}" >&2
	exit 1
}

on_error() {
	local exit_code=$?
	local line_no=$1
	fail "Falha na restauração (linha ${line_no}, código ${exit_code}). Operação abortada."
}

trap 'on_error $LINENO' ERR

usage() {
	printf "%bUso:%b %s --backup-file <arquivo>.gz\n\n" "${BOLD}" "${NC}" "$(basename "$0")"
}

get_env_var() {
	local key="$1"
	local value

	value="$(grep -E "^${key}=" "${ENV_FILE}" | tail -n1 | sed -E "s/^${key}=//" || true)"
	value="${value%\"}"
	value="${value#\"}"
	value="${value%\'}"
	value="${value#\'}"

	printf "%s" "${value}"
}

sql_escape_literal() {
	local input="$1"
	printf "%s" "${input//\'/\'\'}"
}

sql_escape_ident() {
	local input="$1"
	printf "%s" "${input//\"/\"\"}"
}

discover_db_service_and_container_name() {
	local compose_file="$1"

	python3 - "$compose_file" <<'PY'
import json
import subprocess
import sys

compose_file = sys.argv[1]

try:
		out = subprocess.check_output(
				["docker", "compose", "-f", compose_file, "config", "--format", "json"],
				text=True,
		)
except Exception:
		sys.exit(1)

try:
		data = json.loads(out)
except json.JSONDecodeError:
		sys.exit(2)

services = data.get("services", {})
for name, svc in services.items():
		build = svc.get("build") or {}
		dockerfile = (build.get("dockerfile") or "").strip()
		image = (svc.get("image") or "").strip().lower()

		if dockerfile.endswith("docker/postgres/Dockerfile") or "postgres" in image:
				container_name = (svc.get("container_name") or "").strip()
				print(f"{name}|{container_name}")
				sys.exit(0)

sys.exit(3)
PY
}

get_running_container_name_for_service() {
	local compose_file="$1"
	local service="$2"
	local cid

	cid="$(docker compose -f "${compose_file}" ps -q "${service}" 2>/dev/null | head -n1 || true)"
	if [[ -z "${cid}" ]]; then
		return 1
	fi

	docker inspect --format '{{.Name}}' "${cid}" | sed 's#^/##'
}

stop_other_compose_services() {
	local compose_file="$1"
	local keep_service="$2"
	local svc
	local services=()
	local to_stop=()

	mapfile -t services < <(docker compose -f "${compose_file}" config --services)

	for svc in "${services[@]}"; do
		if [[ "${svc}" != "${keep_service}" ]]; then
			to_stop+=("${svc}")
		fi
	done

	if [[ ${#to_stop[@]} -eq 0 ]]; then
		warn "Nenhum serviço adicional encontrado para parar no compose."
		return 0
	fi

	info "Parando serviços do compose (exceto '${keep_service}')..."
	docker compose -f "${compose_file}" stop "${to_stop[@]}"
	ok "Serviços não essenciais parados: ${to_stop[*]}"
}

clear
printf "%b🚀 Restauração de backup SQL no PostgreSQL do Superset%b\n\n" "${BLUE}${BOLD}" "${NC}"

if [[ ! -f "${COMPOSE_FILE}" ]]; then
	fail "Arquivo de compose não encontrado: ${COMPOSE_FILE}"
fi

if [[ ! -f "${ENV_FILE}" ]]; then
	fail "Arquivo de variáveis não encontrado: ${ENV_FILE}"
fi

if [[ $# -ne 2 || "$1" != "--backup-file" ]]; then
	usage
	fail "Parâmetro obrigatório ausente ou inválido. Informe: --backup-file <arquivo>.gz"
fi

BACKUP_FILE="$2"
if [[ ! -f "${BACKUP_FILE}" ]]; then
	fail "Arquivo de backup não encontrado: ${BACKUP_FILE}"
fi

if [[ "${BACKUP_FILE}" != *.gz ]]; then
	fail "O arquivo de backup deve ter extensão .gz"
fi

POSTGRES_DB="$(get_env_var "POSTGRES_DB")"
POSTGRES_USER="$(get_env_var "POSTGRES_USER")"
POSTGRES_PASSWORD="$(get_env_var "POSTGRES_PASSWORD")"
DATABASE_USER="$(get_env_var "DATABASE_USER")"
DATABASE_PASSWORD="$(get_env_var "DATABASE_PASSWORD")"

[[ -n "${POSTGRES_DB}" ]] || fail "Variável POSTGRES_DB não definida em ${ENV_FILE}"
[[ -n "${POSTGRES_USER}" ]] || fail "Variável POSTGRES_USER não definida em ${ENV_FILE}"
[[ -n "${POSTGRES_PASSWORD}" ]] || fail "Variável POSTGRES_PASSWORD não definida em ${ENV_FILE}"
[[ -n "${DATABASE_USER}" ]] || fail "Variável DATABASE_USER não definida em ${ENV_FILE}"
[[ -n "${DATABASE_PASSWORD}" ]] || fail "Variável DATABASE_PASSWORD não definida em ${ENV_FILE}"

POSTGRES_DB_IDENT="$(sql_escape_ident "${POSTGRES_DB}")"
POSTGRES_DB_LIT="$(sql_escape_literal "${POSTGRES_DB}")"
POSTGRES_USER_IDENT="$(sql_escape_ident "${POSTGRES_USER}")"

info "Descobrindo serviço/contêiner PostgreSQL no ${COMPOSE_FILE}..."
SERVICE_AND_CONTAINER="$(discover_db_service_and_container_name "${COMPOSE_FILE}" || true)"
[[ -n "${SERVICE_AND_CONTAINER}" ]] || fail "Não foi possível identificar o serviço PostgreSQL no compose."

DB_SERVICE="${SERVICE_AND_CONTAINER%%|*}"
DB_CONTAINER_FROM_COMPOSE="${SERVICE_AND_CONTAINER#*|}"

DB_CONTAINER="$(get_running_container_name_for_service "${COMPOSE_FILE}" "${DB_SERVICE}" || true)"
if [[ -z "${DB_CONTAINER}" ]]; then
	DB_CONTAINER="${DB_CONTAINER_FROM_COMPOSE}"
fi

[[ -n "${DB_CONTAINER}" ]] || fail "Não foi possível resolver o nome do contêiner do PostgreSQL."

if ! docker ps --format '{{.Names}}' | grep -Fxq "${DB_CONTAINER}"; then
	fail "Contêiner '${DB_CONTAINER}' não está em execução. Inicie o ambiente e tente novamente."
fi

ok "Contêiner PostgreSQL identificado: ${DB_CONTAINER} (serviço: ${DB_SERVICE})"

stop_other_compose_services "${COMPOSE_FILE}" "${DB_SERVICE}"

BACKUP_BASENAME="$(basename "${BACKUP_FILE}")"
SQL_BASENAME="${BACKUP_BASENAME%.gz}"
CONTAINER_GZ_PATH="/tmp/${BACKUP_BASENAME}"
CONTAINER_SQL_PATH="/tmp/${SQL_BASENAME}"

info "Copiando backup para ${DB_CONTAINER}:${CONTAINER_GZ_PATH}..."
docker cp "${BACKUP_FILE}" "${DB_CONTAINER}:${CONTAINER_GZ_PATH}"
ok "Backup copiado para o contêiner."

info "Descompactando backup no /tmp do contêiner..."
docker exec "${DB_CONTAINER}" sh -c "rm -f '${CONTAINER_SQL_PATH}'"
docker exec "${DB_CONTAINER}" gunzip -f "${CONTAINER_GZ_PATH}"
docker exec "${DB_CONTAINER}" test -f "${CONTAINER_SQL_PATH}"
ok "Arquivo descompactado em ${CONTAINER_SQL_PATH}."

info "Recriando banco '${POSTGRES_DB}' (DROP/CREATE) para evitar conflitos de restauração..."
docker exec -i -e PGPASSWORD="${POSTGRES_PASSWORD}" "${DB_CONTAINER}" \
	psql -v ON_ERROR_STOP=1 -U "${POSTGRES_USER}" -d postgres <<SQL_CLEAN
SELECT pg_terminate_backend(pid)
FROM pg_stat_activity
WHERE datname = '${POSTGRES_DB_LIT}'
  AND pid <> pg_backend_pid();

DROP DATABASE IF EXISTS "${POSTGRES_DB_IDENT}";
CREATE DATABASE "${POSTGRES_DB_IDENT}" OWNER "${POSTGRES_USER_IDENT}";
SQL_CLEAN
ok "Banco '${POSTGRES_DB}' recriado com sucesso."

info "Restaurando dump SQL a partir de ${CONTAINER_SQL_PATH}..."
docker exec -i -e PGPASSWORD="${POSTGRES_PASSWORD}" "${DB_CONTAINER}" \
	psql -v ON_ERROR_STOP=1 -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" -f "${CONTAINER_SQL_PATH}"
ok "Backup restaurado com sucesso."

DB_USER_IDENT="$(sql_escape_ident "${DATABASE_USER}")"
DB_USER_PASS_LIT="$(sql_escape_literal "${DATABASE_PASSWORD}")"

info "Garantindo usuário '${DATABASE_USER}' e permissões em todos os objetos..."
docker exec -i -e PGPASSWORD="${POSTGRES_PASSWORD}" "${DB_CONTAINER}" \
	psql -v ON_ERROR_STOP=1 -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" <<SQL_ROLE
DO \
\$\$
BEGIN
	IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '${DB_USER_IDENT}') THEN
		EXECUTE 'CREATE ROLE "${DB_USER_IDENT}" LOGIN PASSWORD ''${DB_USER_PASS_LIT}''';
	ELSE
		EXECUTE 'ALTER ROLE "${DB_USER_IDENT}" WITH LOGIN PASSWORD ''${DB_USER_PASS_LIT}''';
	END IF;
END
\$\$;

GRANT CONNECT ON DATABASE "${POSTGRES_DB_IDENT}" TO "${DB_USER_IDENT}";
GRANT USAGE ON SCHEMA public TO "${DB_USER_IDENT}";
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON ALL TABLES IN SCHEMA public TO "${DB_USER_IDENT}";
GRANT USAGE, SELECT, UPDATE ON ALL SEQUENCES IN SCHEMA public TO "${DB_USER_IDENT}";
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO "${DB_USER_IDENT}";

ALTER DEFAULT PRIVILEGES IN SCHEMA public
	GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLES TO "${DB_USER_IDENT}";
ALTER DEFAULT PRIVILEGES IN SCHEMA public
	GRANT USAGE, SELECT, UPDATE ON SEQUENCES TO "${DB_USER_IDENT}";
ALTER DEFAULT PRIVILEGES IN SCHEMA public
	GRANT EXECUTE ON FUNCTIONS TO "${DB_USER_IDENT}";
SQL_ROLE
ok "Usuário '${DATABASE_USER}' validado/recriado e permissões aplicadas."

warn "Restauração concluída. Reinicie os serviços do Superset para aplicar totalmente as mudanças."
ok "Processo finalizado com sucesso! 🎉"
