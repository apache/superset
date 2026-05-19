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

# =============================
# CARREGAR VARIÁVEIS DE AMBIENTE DO .env
# =============================
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE=""

if [[ -f "${SCRIPT_DIR}/.env" ]]; then
  ENV_FILE="${SCRIPT_DIR}/.env"
else
  echo "Arquivo de configuração não encontrado em .env)" >&2
  exit 1
fi

read_env_value() {
  local key="$1"
  python3 - "$ENV_FILE" "$key" <<'PY'
from __future__ import annotations

import sys

path = sys.argv[1]
target = sys.argv[2]

with open(path, encoding="utf-8") as handle:
    for raw_line in handle:
        line = raw_line.strip()
        if not line or line.startswith("#"):
            continue
        if line.startswith("export "):
            line = line[len("export ") :].lstrip()
        if "=" not in line:
            continue
        key, value = line.split("=", 1)
        key = key.strip()
        if key != target:
            continue
        value = value.strip()
        if len(value) >= 2 and value[0] == value[-1] and value[0] in {'"', "'"}:
            value = value[1:-1]
        print(value)
        raise SystemExit(0)

print("")
PY
}

LOONAR_LDAP_MODE="$(read_env_value "LOONAR_LDAP_MODE")"
if [[ -z "$LOONAR_LDAP_MODE" ]]; then
  echo "LOONAR_LDAP_MODE não está definido no $ENV_FILE" >&2
  exit 1
fi

if [[ "$LOONAR_LDAP_MODE" == "real" ]]; then
  AD_URI="$(read_env_value "LOONAR_LDAP_SERVER_REAL")"
  AD_DN_BASE="$(read_env_value "LOONAR_LDAP_USER_BASE_REAL")"
  AD_SVC_USER="$(read_env_value "LOONAR_LDAP_BIND_DN_REAL")"
  AD_SVC_PASSWORD="$(read_env_value "LOONAR_LDAP_BIND_PASSWORD_REAL")"
else
  AD_URI="$(read_env_value "LOONAR_LDAP_SERVER_MOCK")"
  AD_DN_BASE="$(read_env_value "LOONAR_LDAP_USER_BASE_MOCK")"
  AD_SVC_USER="$(read_env_value "LOONAR_LDAP_BIND_DN_MOCK")"
  AD_SVC_PASSWORD="$(read_env_value "LOONAR_LDAP_BIND_PASSWORD_MOCK")"
fi

# Variáveis comuns (independem de mock/real)
AD_GROUP_FILTERTERM="$(read_env_value "LOONAR_LDAP_GROUP_FILTERTERM")"
ASF_ROLE_BASE="$(read_env_value "LOONAR_LDAP_BASE_ROLE")"
AD_EMAIL_INVALID="$(read_env_value "LOONAR_LDAP_EMAIL_DOMAIN")"
SUPERSET_CONTAINER_NAME="superset_app"
AD_GROUPS=()
RESOLVED_SUPERSET_CONTAINER=""
OU_ENTRIES=()
PARTIAL_ISSUES=()

exit_with_error() {
  printf '%s\n' "$1" >&2
  exit 1
}

add_partial_issue() {
  local message="$1"
  PARTIAL_ISSUES+=("$message")
}

print_final_status() {
  if (( ${#PARTIAL_ISSUES[@]} == 0 )); then
    printf '\n✓ Sincronização concluída com sucesso!\n' >&2
    return
  fi

  printf '\n⚠ Sincronização concluída parcialmente.\n' >&2
  printf 'Erros/alertas encontrados (%d):\n' "${#PARTIAL_ISSUES[@]}" >&2
  local issue
  for issue in "${PARTIAL_ISSUES[@]}"; do
    printf '  - %s\n' "$issue" >&2
  done
}

ensure_command() {
  local bin="$1"
  if ! command -v "$bin" >/dev/null 2>&1; then
    exit_with_error "Dependência obrigatória não encontrada: $bin"
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
  exit_with_error "Não foi possível localizar um container do Superset (ex: 'superset_app' ou 'superset-superset_app'). Disponíveis: ${available:-nenhum}"
}

validate_env() {
  local missing=()
  [[ -z "$AD_URI" ]] && missing+=("AD_URI")
  [[ -z "$AD_DN_BASE" ]] && missing+=("AD_DN_BASE")
  [[ -z "$AD_SVC_USER" ]] && missing+=("AD_SVC_USER")
  [[ -z "$AD_SVC_PASSWORD" ]] && missing+=("AD_SVC_PASSWORD")
  [[ -z "$AD_GROUP_FILTERTERM" ]] && missing+=("AD_GROUP_FILTERTERM")
  [[ -z "$ASF_ROLE_BASE" ]] && missing+=("ASF_ROLE_BASE")
  if (( ${#missing[@]} > 0 )); then
    exit_with_error "Variáveis obrigatórias ausentes: ${missing[*]}"
  fi

  # Normaliza aspas tipográficas comuns sem remover conteúdo válido.
  AD_DN_BASE=${AD_DN_BASE//“/\"}
  AD_DN_BASE=${AD_DN_BASE//”/\"}
  AD_DN_BASE=${AD_DN_BASE//‘/\'}
  AD_DN_BASE=${AD_DN_BASE//’/\'}

  if ! mapfile -t OU_ENTRIES < <(python3 - "$AD_DN_BASE" <<'PY'
import json
import sys

raw = sys.argv[1]
try:
    data = json.loads(raw)
except json.JSONDecodeError as exc:
    raise SystemExit(f"AD_DN_BASE deve ser um JSON válido: {exc}") from exc

if not isinstance(data, dict) or not data:
    raise SystemExit("AD_DN_BASE deve ser um JSON com pares {\"nome\": \"OU\"} e não pode estar vazio")

for name, dn in data.items():
    if not isinstance(name, str) or not isinstance(dn, str) or not name or not dn:
        raise SystemExit("AD_DN_BASE deve conter chaves e valores string não vazios")
    print(f"{name}\t{dn}")
PY
  ); then
    exit_with_error "AD_DN_BASE inválido. Verifique o JSON nas variáveis LOONAR_LDAP_USER_BASE_*"
  fi
}

ldap_search() {
  local base_dn="$1"
  shift
  local output
  if ! output=$(LDAPTLS_REQCERT=allow ldapsearch -LLL -x -H "$AD_URI" -D "$AD_SVC_USER" -w "$AD_SVC_PASSWORD" -b "$base_dn" "$@" 2>&1); then
    printf '%s' "$output"
    return 1
  fi
  printf '%s' "$output"
}

is_ldap_no_object_error() {
  local text="$1"
  [[ "$text" == *"No such object (32)"* ]]
}

ensure_base_role_exists() {
  local output
  if ! output=$(docker exec -i "$RESOLVED_SUPERSET_CONTAINER" python3 - "$ASF_ROLE_BASE" <<'PY'
from __future__ import annotations

import sys
from superset.app import create_app
from superset.extensions import security_manager


def main(role_name: str) -> None:
    app = create_app()
    with app.app_context():
        role = security_manager.find_role(role_name)
        if role is None:
            raise SystemExit(f"Role base não encontrada: {role_name}")
        print("BASE_ROLE_OK")


if __name__ == "__main__":
    if len(sys.argv) != 2:
        raise SystemExit("Uso: check_base_role.py <role>")
    main(sys.argv[1])
PY
  ); then
    printf '%s\n' "$output" >&2
    exit 1
  fi
}

fetch_ad_groups() {
  local filter="(&(objectClass=group)(cn=*${AD_GROUP_FILTERTERM}*))"
  local raw_output
  local ou_name
  local ou_dn
  local -a ou_groups
  local processed_ou_count=0
  local skipped_ou_count=0

  AD_GROUPS=()

  for entry in "${OU_ENTRIES[@]}"; do
    ou_name="${entry%%$'\t'*}"
    ou_dn="${entry#*$'\t'}"

    if ! raw_output=$(ldap_search "$ou_dn" "$filter" cn); then
      local first_error_line
      first_error_line=$(printf '%s\n' "$raw_output" | head -n 1)
      if is_ldap_no_object_error "$raw_output"; then
        printf 'OU "%s" (%s): não encontrada no LDAP (NO_OBJECT) - pulando\n' "$ou_name" "$ou_dn" >&2
        add_partial_issue "OU '${ou_name}' (${ou_dn}) não encontrada no LDAP durante busca de grupos"
        ((skipped_ou_count+=1))
        continue
      fi
      printf 'OU "%s" (%s): erro ao buscar grupos - pulando\n' "$ou_name" "$ou_dn" >&2
      printf '%s\n' "$raw_output" >&2
      add_partial_issue "Erro ao buscar grupos na OU '${ou_name}' (${ou_dn}): ${first_error_line}"
      ((skipped_ou_count+=1))
      continue
    fi

    mapfile -t ou_groups < <(printf '%s\n' "$raw_output" | awk -F': ' '/^cn: / {print $2}' | sort -u)
    ((processed_ou_count+=1))

    printf 'OU "%s" (%s): %d grupos encontrados\n' "$ou_name" "$ou_dn" "${#ou_groups[@]}" >&2
    if (( ${#ou_groups[@]} > 0 )); then
      printf 'OU "%s": grupos: %s\n' "$ou_name" "${ou_groups[*]}" >&2
    fi

    AD_GROUPS+=("${ou_groups[@]}")
  done

  mapfile -t AD_GROUPS < <(printf '%s\n' "${AD_GROUPS[@]}" | sort -u)

  printf 'Grupos totais (únicos) encontrados no AD: %d\n' "${#AD_GROUPS[@]}" >&2
  if (( ${#AD_GROUPS[@]} > 0 )); then
    printf 'Grupos totais: %s\n' "${AD_GROUPS[*]}" >&2
  fi
  printf 'Resumo OUs (grupos): %d processadas, %d puladas\n' "$processed_ou_count" "$skipped_ou_count" >&2
}

sync_roles_in_superset() {
  local groups_json
  groups_json=$(printf '%s\n' "${AD_GROUPS[@]}" | python3 -c 'import json, sys; print(json.dumps([line.strip() for line in sys.stdin if line.strip()]))')

  printf 'Sincronizando %d roles no Superset (JSON: %s)...\n' "${#AD_GROUPS[@]}" "$groups_json" >&2
  
  local output
  if ! output=$(docker exec -i -e GROUPS_JSON="$groups_json" "$RESOLVED_SUPERSET_CONTAINER" python3 - "$ASF_ROLE_BASE" <<'PY'
from __future__ import annotations

import json
import os
import sys
from superset.app import create_app
from superset.extensions import db, security_manager


def sync_roles(base_role_name: str, groups: list[str]) -> None:
    app = create_app()
    with app.app_context():
        base_role = security_manager.find_role(base_role_name)
        if base_role is None:
            raise SystemExit(f"Role base não encontrada: {base_role_name}")

        print(f"DEBUG: Sincronizando {len(groups)} grupos: {groups}", file=sys.stderr)
        
        created_count = 0
        existing_count = 0
        failed: list[str] = []
        for group in groups:
          try:
            role = security_manager.find_role(group)
            if role is None:
              print(f"DEBUG: Criando role '{group}'", file=sys.stderr)
              role = security_manager.add_role(group)
              role.permissions = list(base_role.permissions)
              db.session.add(role)
              db.session.commit()
              created_count += 1
            else:
              print(f"DEBUG: Role '{group}' já existe - mantendo inalterada", file=sys.stderr)
              existing_count += 1
          except Exception as exc:  # noqa: BLE001
            db.session.rollback()
            failed.append(f"{group}: {exc}")
            print(f"DEBUG: Falha ao sincronizar role '{group}': {exc}", file=sys.stderr)

        print(f"Roles criadas: {created_count}", file=sys.stderr)
        print(f"Roles existentes: {existing_count}", file=sys.stderr)
        print(f"Roles com falha: {len(failed)}", file=sys.stderr)
        print(
          "ROLES_SYNC_SUMMARY:"
          + json.dumps(
            {
              "total": len(groups),
              "created": created_count,
              "existing": existing_count,
              "failed": len(failed),
              "failed_items": failed,
            }
          )
        )


if __name__ == "__main__":
    if len(sys.argv) != 2:
        raise SystemExit("Uso: sync_roles.py <role_base>")
    
    groups_raw = os.environ.get("GROUPS_JSON", "[]")
    print(f"DEBUG: GROUPS_JSON recebido: {groups_raw}", file=sys.stderr)
    
    payload = json.loads(groups_raw)
    if not isinstance(payload, list):
        raise SystemExit("Entrada inválida: esperado JSON list")
    
    sync_roles(sys.argv[1], payload)
PY
  ); then
    printf '%s\n' "$output" >&2
    exit 1
  fi

  local roles_summary
  roles_summary=$(printf '%s\n' "$output" | grep '^ROLES_SYNC_SUMMARY:' || true)
  if [[ -n "$roles_summary" ]]; then
    local role_failed_count
    role_failed_count=$(python3 - "$roles_summary" <<'PY'
import json
import sys

line = sys.argv[1]
if not line or not line.startswith("ROLES_SYNC_SUMMARY:"):
    print(0)
    raise SystemExit(0)

payload = json.loads(line.split(":", 1)[1])
print(payload.get("failed", 0))
PY
)
    if [[ "$role_failed_count" != "0" ]]; then
      add_partial_issue "Falhas na sincronização de roles: ${role_failed_count}"
      printf '%s\n' "$roles_summary" >&2
    fi
  fi

  printf '%s\n' "$output" >&2
}

fetch_ad_users_json() {
  local users_json_parts=()
  local ou_name
  local ou_dn
  local raw_output
  local ou_users_json
  local ou_users_count
  local processed_ou_count=0
  local skipped_ou_count=0

  for entry in "${OU_ENTRIES[@]}"; do
    ou_name="${entry%%$'\t'*}"
    ou_dn="${entry#*$'\t'}"

    if ! raw_output=$(ldap_search "$ou_dn" "(&(objectClass=user)(sAMAccountName=*))" sAMAccountName givenName sn mail userPrincipalName memberOf); then
      local first_error_line
      first_error_line=$(printf '%s\n' "$raw_output" | head -n 1)
      if is_ldap_no_object_error "$raw_output"; then
        printf 'OU "%s" (%s): não encontrada no LDAP (NO_OBJECT) - pulando\n' "$ou_name" "$ou_dn" >&2
        add_partial_issue "OU '${ou_name}' (${ou_dn}) não encontrada no LDAP durante busca de usuários"
        ((skipped_ou_count+=1))
        continue
      fi
      printf 'OU "%s" (%s): erro ao buscar usuários - pulando\n' "$ou_name" "$ou_dn" >&2
      printf '%s\n' "$raw_output" >&2
      add_partial_issue "Erro ao buscar usuários na OU '${ou_name}' (${ou_dn}): ${first_error_line}"
      ((skipped_ou_count+=1))
      continue
    fi

    ou_users_json=$(printf '%s\n' "$raw_output" | python3 -c $'import json\nimport re\nimport sys\n\nfilter_term = sys.argv[1]\nraw_lines = sys.stdin.read().splitlines()\n\nlines = []\nfor line in raw_lines:\n    if line.startswith(" ") and lines:\n        lines[-1] += line[1:]\n    else:\n        lines.append(line)\n\nusers = []\nentry: dict[str, object] = {}\n\nfor line in lines + [""]:\n    if line == "":\n        if entry.get("sAMAccountName"):\n            users.append(entry)\n        entry = {}\n        continue\n    if ":" not in line:\n        continue\n    key, val = line.split(":", 1)\n    val = val.lstrip()\n    if key == "memberOf":\n        entry.setdefault("memberOf", []).append(val)\n    else:\n        entry[key] = val\n\n\ndef dn_to_cn(dn: str) -> str | None:\n    match = re.match(r"CN=([^,]+)", dn, re.IGNORECASE)\n    return match.group(1) if match else None\n\n\nresult = []\nfor user in users:\n    username = user.get("sAMAccountName")\n    if not isinstance(username, str) or not username:\n        continue\n    groups = [\n        cn\n        for dn in user.get("memberOf", [])\n        if isinstance(dn, str) and (cn := dn_to_cn(dn))\n    ]\n    if filter_term:\n        groups = [group for group in groups if filter_term in group]\n    if not groups:\n        continue\n\n    first_name = user.get("givenName") or username\n    last_name = user.get("sn") or username\n    email = user.get("mail") or user.get("userPrincipalName") or f"{username}@invalid.local"\n\n    result.append(\n        {\n            "username": username,\n            "first_name": first_name,\n            "last_name": last_name,\n            "email": email,\n            "roles": sorted(set(groups)),\n        }\n    )\n\nprint(json.dumps(result))' "$AD_GROUP_FILTERTERM")

    ou_users_count=$(python3 - "$ou_users_json" <<'PY'
import json
import sys

raw = sys.argv[1]
try:
  data = json.loads(raw or "[]")
except json.JSONDecodeError:
  data = []

print(len(data) if isinstance(data, list) else 0)
PY
)

    printf 'OU "%s" (%s): %s usuários sincronizáveis\n' "$ou_name" "$ou_dn" "$ou_users_count" >&2
    users_json_parts+=("$ou_users_json")
    ((processed_ou_count+=1))
  done

  printf 'Resumo OUs (usuários): %d processadas, %d puladas\n' "$processed_ou_count" "$skipped_ou_count" >&2

  python3 - "${users_json_parts[@]}" <<'PY'
import json
import sys

merged = []
seen = set()

for raw in sys.argv[1:]:
  if not raw:
    continue
  try:
    payload = json.loads(raw)
  except json.JSONDecodeError:
    continue
  if not isinstance(payload, list):
    continue
  for item in payload:
    if not isinstance(item, dict):
      continue
    username = item.get("username")
    if not isinstance(username, str) or not username:
      continue
    if username in seen:
      continue
    seen.add(username)
    merged.append(item)

print(json.dumps(merged))
PY
}

sync_users_in_superset() {
  local users_json="$1"
  local output
  if ! output=$(docker exec -i -e USERS_JSON="$users_json" -e AD_EMAIL_INVALID="$AD_EMAIL_INVALID" "$RESOLVED_SUPERSET_CONTAINER" python3 - "$ASF_ROLE_BASE" <<'PY'
from __future__ import annotations

import json
import os
import secrets
import sys
from superset.app import create_app
from superset.extensions import db, security_manager


def ensure_role(base_role_name: str, role_name: str):
    role = security_manager.find_role(role_name)
    if role is None:
        base_role = security_manager.find_role(base_role_name)
        if base_role is None:
            raise SystemExit(f"Role base não encontrada: {base_role_name}")
        role = security_manager.add_role(role_name)
        role.permissions = list(base_role.permissions)
        db.session.add(role)
    return role


def sync_user(payload: dict[str, object], base_role_name: str) -> tuple[str, str]:
    username = str(payload.get("username"))
    try:
        first_name = str(payload.get("first_name"))
        last_name = str(payload.get("last_name"))
        email = str(payload.get("email"))

        # Validar email: se inválido, usar padrão
        if not email or email.startswith("http://") or email.startswith("https://") or "@" not in email:
            email_template = os.environ.get("AD_EMAIL_INVALID", "<usuario>@loonardc.local")
            email = email_template.replace("<usuario>", username)
            print(f"Email inválido para usuário '{username}' - usando padrão: {email}", file=sys.stderr)

        role_names = [
          role_name
          for role_name in payload.get("roles", [])
          if isinstance(role_name, str) and role_name and role_name != base_role_name
        ]
        roles = [ensure_role(base_role_name, role_name) for role_name in role_names]
        if not roles:
          return "existing", username

        user = security_manager.find_user(username=username)
        if user is None:
            password = secrets.token_urlsafe(24)
            user = security_manager.add_user(
                username,
                first_name,
                last_name,
                email,
                roles[0],
                password=password,
            )
            # add_user pode retornar False em caso de erro
            if not user:
                print(f"Falha ao criar usuário '{username}' - add_user retornou False", file=sys.stderr)
                return "failed", username

            user.roles = roles
            db.session.add(user)
            return "created", username

        # Usuário já existe: manter dados pessoais e alinhar roles exatamente ao AD.
        role_names_from_ad = {role.name for role in roles}
        current_role_names = {role.name for role in user.roles}

        user.first_name = first_name
        user.last_name = last_name
        user.email = email

        if current_role_names != role_names_from_ad:
            user.roles = roles
            db.session.add(user)
            return "updated", username

        db.session.add(user)
        return "existing", username
    except Exception as e:  # noqa: BLE001
        print(f"Erro ao criar/sincronizar usuário '{username}': {e}", file=sys.stderr)
        db.session.rollback()
        return "failed", f"{username}:{e}"


def main(base_role_name: str) -> None:
    payload = json.loads(os.environ.get("USERS_JSON", "[]"))
    if not isinstance(payload, list):
        raise SystemExit("Entrada inválida: esperado JSON list")

    app = create_app()
    with app.app_context():
        created_count = 0
        updated_count = 0
        existing_count = 0
        failed_count = 0
        failed_items: list[str] = []
        for user_payload in payload:
            if isinstance(user_payload, dict):
                status, username = sync_user(user_payload, base_role_name)
                if status == "created":
                    print(f"Usuário criado: {username}", file=sys.stderr)
                    created_count += 1
                elif status == "updated":
                    print(f"Usuário atualizado (roles sincronizadas): {username}", file=sys.stderr)
                    updated_count += 1
                elif status == "failed":
                    failed_count += 1
                    failed_items.append(username)
                    print(f"Falha ao sincronizar usuário: {username}", file=sys.stderr)
                else:
                    print(f"Usuário já sincronizado (sem mudanças): {username}", file=sys.stderr)
                    existing_count += 1
        db.session.commit()
        print(f"Usuários criados: {created_count}", file=sys.stderr)
        print(f"Usuários atualizados: {updated_count}", file=sys.stderr)
        print(f"Usuários existentes: {existing_count}", file=sys.stderr)
        print(f"Usuários com falha: {failed_count}", file=sys.stderr)
        print(
            "USERS_SYNC_SUMMARY:"
            + json.dumps(
                {
                    "total": len(payload),
                    "created": created_count,
                    "updated": updated_count,
                    "existing": existing_count,
                    "failed": failed_count,
                    "failed_items": failed_items,
                }
            )
        )


if __name__ == "__main__":
    if len(sys.argv) != 2:
        raise SystemExit("Uso: sync_users.py <role_base>")
    main(sys.argv[1])
PY
  ); then
    printf '%s\n' "$output" >&2
    exit 1
  fi

  local users_summary
  users_summary=$(printf '%s\n' "$output" | grep '^USERS_SYNC_SUMMARY:' || true)
  if [[ -n "$users_summary" ]]; then
    local user_failed_count
    user_failed_count=$(python3 - "$users_summary" <<'PY'
import json
import sys

line = sys.argv[1]
if not line or not line.startswith("USERS_SYNC_SUMMARY:"):
    print(0)
    raise SystemExit(0)

payload = json.loads(line.split(":", 1)[1])
print(payload.get("failed", 0))
PY
)
    if [[ "$user_failed_count" != "0" ]]; then
      add_partial_issue "Falhas na sincronização de usuários: ${user_failed_count}"
      printf '%s\n' "$users_summary" >&2
    fi
  fi

  printf '%s\n' "$output" >&2
}

main() {
  validate_env
  ensure_command ldapsearch
  ensure_command docker
  ensure_container_running

  ensure_base_role_exists
  fetch_ad_groups

  if (( ${#AD_GROUPS[@]} == 0 )); then
    exit_with_error "Nenhum grupo encontrado com o termo '${AD_GROUP_FILTERTERM}'."
  fi

  sync_roles_in_superset

  local users_json
  users_json=$(fetch_ad_users_json)

  if [[ -z "$users_json" || "$users_json" == "[]" ]]; then
    exit_with_error "Nenhum usuário encontrado com grupos contendo '${AD_GROUP_FILTERTERM}'."
  fi

  sync_users_in_superset "$users_json"

  print_final_status
}

main "$@"
