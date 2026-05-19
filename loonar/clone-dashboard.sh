#!/usr/bin/env bash

clear

set -euo pipefail

# ─── Configurações ────────────────────────────────────────────────
SUPERSET_URL=""     # URL base do Superset (sem barra no final). Se preenchido aqui, tem prioridade sobre .env
SUPERSET_USER=""
SUPERSET_PASS=""
DASHBOARD_ID=""                          # Dashboard modelo (origem dos clones)
DASHBOARD_PREFIX=""                      # Prefixo do nome do dashboard clonado
ROLE_SUFFIX=""                           # Sufixo das roles a serem pesquisadas
NO_INTERACTIVE=false
AUTO_YES=false

print_usage() {
	cat <<'EOF'
Uso: ./clone-dashboard.sh [--no-interactive]

Opções:
  --no-interactive   Executa sem prompts de confirmação.
  -h, --help         Exibe esta ajuda.
EOF
}

parse_args() {
	while [[ $# -gt 0 ]]; do
		case "$1" in
			--no-interactive)
				NO_INTERACTIVE=true
				AUTO_YES=true
				;;
			-h|--help)
				print_usage
				exit 0
				;;
			*)
				printf "\n❌ Parâmetro inválido: %s\n\n" "$1" >&2
				print_usage >&2
				exit 1
				;;
		esac
		shift
	done
}

parse_args "$@"

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="${SCRIPT_DIR}/.env"

if [[ ! -f "$ENV_FILE" ]]; then
	printf "\n" >&2
	printf "${COLOR_RED}${COLOR_BOLD}❌ Arquivo .env não encontrado em ${SCRIPT_DIR}${COLOR_RESET}\n\n" >&2
	exit 1
fi

get_env_value() {
	local key="$1"
	awk -v k="$key" '
		/^[[:space:]]*(#|$)/ { next }
		{
			line=$0
			sub(/^[[:space:]]+/, "", line)
			if (line ~ /^export[[:space:]]+/) { sub(/^export[[:space:]]+/, "", line) }
			if (index(line, k "=") == 1) {
				val=substr(line, length(k)+2)
				gsub(/\r$/, "", val)
				sub(/^[[:space:]]+/, "", val)
				if (val ~ /^\x27/) {
					sub(/^\x27/, "", val)
					sub(/\x27.*$/, "", val)
				} else if (val ~ /^\x22/) {
					sub(/^\x22/, "", val)
					sub(/\x22.*$/, "", val)
				} else {
					sub(/[[:space:]]+#.*$/, "", val)
					sub(/[[:space:]]+$/, "", val)
				}
				print val
				exit
			}
		}
	' "$ENV_FILE"
}

ENV_SUPERSET_URL="$(get_env_value "SUPERSET_HOST")"
SUPERSET_USER="$(get_env_value "LOONAR_CLONE_SUPERSET_USER")"
SUPERSET_PASS="$(get_env_value "LOONAR_CLONE_SUPERSET_PASS")"
DASHBOARD_ID="$(get_env_value "LOONAR_CLONE_DASHBOARD_ID")"
DASHBOARD_PREFIX="$(get_env_value "LOONAR_CLONE_DASHBOARD_PREFIX")"
ROLE_SUFFIX="$(get_env_value "LOONAR_CLONE_ROLE_SUFFIX")"

# SUPERSET_URL definido no script tem prioridade; usa .env apenas se estiver vazio.
if [[ -z "$SUPERSET_URL" ]]; then
	SUPERSET_URL="$ENV_SUPERSET_URL"
fi

if [[ -z "$SUPERSET_URL" || -z "$SUPERSET_USER" || -z "$SUPERSET_PASS" || -z "$DASHBOARD_ID" || -z "$DASHBOARD_PREFIX" || -z "$ROLE_SUFFIX" ]]; then
	printf "\n" >&2
	printf "${COLOR_RED}${COLOR_BOLD}❌ Variáveis obrigatórias ausentes no .env:${COLOR_RESET}\n" >&2
	printf "  - SUPERSET_HOST (ou SUPERSET_URL definido no script)\n" >&2
	printf "  - LOONAR_CLONE_SUPERSET_USER\n" >&2
	printf "  - LOONAR_CLONE_SUPERSET_PASS\n" >&2
	printf "  - LOONAR_CLONE_DASHBOARD_ID\n" >&2
	printf "  - LOONAR_CLONE_DASHBOARD_PREFIX\n" >&2
	printf "  - LOONAR_CLONE_ROLE_SUFFIX\n\n" >&2
	exit 1
fi

if [[ ! "$SUPERSET_URL" =~ ^https?:// ]]; then
	SUPERSET_URL="https://${SUPERSET_URL}"
fi

# Opções TLS/certificado: só se aplicam para HTTPS. Em HTTP, são ignoradas.
CURL_TLS_OPTS=()
if [[ "$SUPERSET_URL" =~ ^https:// ]]; then
	CURL_TLS_OPTS=(--insecure)
fi

curl_run() {
	curl "${CURL_TLS_OPTS[@]}" "$@"
}

# ──────────────────────────────────────────────────────────────────

COLOR_RESET="\033[0m"
COLOR_BOLD="\033[1m"
COLOR_RED="\033[31m"
COLOR_GREEN="\033[32m"
COLOR_YELLOW="\033[33m"
COLOR_BLUE="\033[34m"
COLOR_MAGENTA="\033[35m"
COLOR_CYAN="\033[36m"

say_info()   { printf "%b\n\n" "${COLOR_CYAN}${COLOR_BOLD}ℹ️  $*${COLOR_RESET}"; }
say_ok()     { printf "%b\n\n" "${COLOR_GREEN}${COLOR_BOLD}✅ $*${COLOR_RESET}"; }
say_warn()   { printf "%b\n\n" "${COLOR_YELLOW}${COLOR_BOLD}⚠️  $*${COLOR_RESET}"; }
say_err()    { printf "%b\n\n" "${COLOR_RED}${COLOR_BOLD}❌ $*${COLOR_RESET}"; }
say_action() { printf "%b\n\n" "${COLOR_MAGENTA}${COLOR_BOLD}🚀 $*${COLOR_RESET}"; }

confirm_continue() {
	local message="$1"
	if [[ "$NO_INTERACTIVE" == "true" ]]; then
		return 0
	fi
	local prompt
	prompt=$(printf "%b" "${COLOR_BLUE}${COLOR_BOLD}❓ ${message} (s/N): ${COLOR_RESET}")
	read -r -p "$prompt" reply
	printf "\n\n"
	case "${reply}" in
		s|S|sim|Sim|SIM|y|Y|yes|YES) return 0 ;;
		*) return 1 ;;
	esac
}

confirm_continue_or_all() {
	local message="$1"
	if [[ "$NO_INTERACTIVE" == "true" ]]; then
		return 0
	fi
	local prompt
	prompt=$(printf "%b" "${COLOR_BLUE}${COLOR_BOLD}❓ ${message} (s/N/T): ${COLOR_RESET}")
	read -r -p "$prompt" reply
	printf "\n\n"
	case "${reply}" in
		s|S|sim|Sim|SIM|y|Y|yes|YES) return 0 ;;
		t|T) return 2 ;;
		*) return 1 ;;
	esac
}

detect_package_manager() {
	if command -v apt-get >/dev/null 2>&1; then echo "apt-get"
	elif command -v dnf >/dev/null 2>&1; then echo "dnf"
	elif command -v yum >/dev/null 2>&1; then echo "yum"
	elif command -v pacman >/dev/null 2>&1; then echo "pacman"
	else echo ""; fi
}

PKG_MANAGER=""
APT_UPDATED=false

pkg_install() {
	local pkg="$1"
	case "$PKG_MANAGER" in
		apt-get)
			if [[ "$APT_UPDATED" == false ]]; then
				sudo apt-get update -qq
				APT_UPDATED=true
			fi
			sudo apt-get install -y "$pkg"
			;;
		dnf)     sudo dnf install -y "$pkg" ;;
		yum)     sudo yum install -y "$pkg" ;;
		pacman)  sudo pacman -Sy --noconfirm "$pkg" ;;
	esac
}

get_current_version() {
	local pkg="$1"
	case "$pkg" in
		jq)    jq --version 2>&1 | sed 's/jq-//' ;;
		curl)  curl --version 2>&1 | head -1 | awk '{print $2}' ;;
		unzip) unzip --help 2>&1 | head -1 | grep -oP '[\d.]+' | head -1 ;;
		zip)   zip --version 2>&1 | head -2 | grep -oP 'Zip\s+\K[\d.]+' || echo "desconhecida" ;;
		sed)   sed --version 2>&1 | head -1 | grep -oP '[\d.]+' | head -1 ;;
		grep)  grep --version 2>&1 | head -1 | grep -oP '[\d.]+' | head -1 ;;
		*)     echo "desconhecida" ;;
	esac
}

get_candidate_version() {
	local pkg="$1"
	case "$PKG_MANAGER" in
		apt-get) apt-cache policy "$pkg" 2>/dev/null | awk '/Candidate:/{print $2}' || true ;;
		*)       echo "" ;;
	esac
}

# ─── Verificação genérica de dependência ─────────────────────────
ensure_pkg() {
	local pkg="$1"
	say_action "Verificando ${pkg}..."

	if command -v "$pkg" >/dev/null 2>&1; then
		local current_version
		current_version=$(get_current_version "$pkg")
		say_ok "${pkg} encontrado: versão ${current_version}"

		local latest_version=""
		latest_version=$(get_candidate_version "$pkg")

		if [[ -n "$latest_version" && "$latest_version" != "$current_version" ]]; then
			if confirm_continue "Atualizar ${pkg} (de: ${current_version} → para: ${latest_version})?"; then
				say_action "Atualizando ${pkg}..."
				pkg_install "$pkg"
				say_ok "${pkg} atualizado."
			else
				say_warn "Atualização do ${pkg} ignorada."
			fi
		fi
	else
		say_warn "${pkg} não encontrado."

		if [[ -z "$PKG_MANAGER" ]]; then
			say_err "Nenhum gerenciador de pacotes suportado. Instale o ${pkg} manualmente."
			exit 1
		fi

		if confirm_continue "Instalar ${pkg} (de: ausente → via ${PKG_MANAGER})?"; then
			say_action "Instalando ${pkg}..."
			pkg_install "$pkg"
			say_ok "${pkg} instalado."
		else
			say_err "Instalação de ${pkg} abortada pelo usuário."
			exit 1
		fi
	fi
}

# ─── Verificação de todas as dependências ────────────────────────
say_info "Verificando dependências necessárias: curl, jq, unzip, zip, sed, grep"

PKG_MANAGER=$(detect_package_manager)

DEPS=(curl jq unzip zip sed grep)
for dep in "${DEPS[@]}"; do
	ensure_pkg "$dep"
done

say_ok "Todas as dependências verificadas."

# ─── 1) Login via formulário customizado (provider=database) ──────
say_action "Autenticando no Superset via formulário customizado (provider=database)..."

AUTH_PROVIDER="database"
COOKIE_JAR=$(mktemp)
trap 'rm -f "$COOKIE_JAR" 2>/dev/null' EXIT

# 1a) Obter CSRF token do formulário de login
if ! FORM_CSRF="$(curl_run -s -c "$COOKIE_JAR" "${SUPERSET_URL}/login/" \
	| grep -oP 'value="\K[^"]{20,}')"; then
	say_err "Falha ao acessar ${SUPERSET_URL}/login/ (verifique SUPERSET_HOST)."
	exit 1
fi

if [[ -z "$FORM_CSRF" ]]; then
	say_err "Não foi possível obter CSRF token da página de login."
	exit 1
fi

# 1b) Login via formulário, forçando banco interno (igual à UI customizada)
if ! LOGIN_CODE="$(curl_run -s -c "$COOKIE_JAR" -b "$COOKIE_JAR" \
	-w "%{http_code}" -o /dev/null \
	-X POST "${SUPERSET_URL}/login/" \
	-H "Content-Type: application/x-www-form-urlencoded" \
	-H "Referer: ${SUPERSET_URL}/login/" \
	--data-urlencode "csrf_token=${FORM_CSRF}" \
	--data-urlencode "username=${SUPERSET_USER}" \
	--data-urlencode "password=${SUPERSET_PASS}" \
	--data-urlencode "auth_provider=${AUTH_PROVIDER}")"; then
	say_err "Falha no POST de login (verifique conexão e credenciais)."
	exit 1
fi

# 302 redirect = login OK
if [[ "$LOGIN_CODE" != "302" && ("$LOGIN_CODE" -lt 200 || "$LOGIN_CODE" -ge 400) ]]; then
	say_err "Falha no login via formulário (HTTP ${LOGIN_CODE})."
	exit 1
fi

# 1c) Obter CSRF token da API para POST/PUT autenticados por sessão
if ! API_CSRF="$(curl_run -s -b "$COOKIE_JAR" -c "$COOKIE_JAR" \
	"${SUPERSET_URL}/api/v1/security/csrf_token/" \
	| jq -r '.result // empty')"; then
	say_err "Falha ao obter CSRF token da API."
	exit 1
fi

if [[ -z "$API_CSRF" ]]; then
	say_err "Não foi possível obter CSRF token da API."
	exit 1
fi

say_ok "Autenticado com sucesso via banco de usuários do Superset (provider=${AUTH_PROVIDER})."

# ─── Exportar template uma única vez ─────────────────────────────
say_action "Exportando dashboard modelo ${DASHBOARD_ID} (template único)..."

TEMPLATE_DIR=$(mktemp -d)
TEMPLATE_ZIP="${TEMPLATE_DIR}/dashboard_template_${DASHBOARD_ID}.zip"
trap 'rm -rf "$COOKIE_JAR" "$TEMPLATE_DIR" 2>/dev/null' EXIT

TEMPLATE_HTTP_CODE="$(curl_run -s -o "$TEMPLATE_ZIP" -w "%{http_code}" \
	-X GET "${SUPERSET_URL}/api/v1/dashboard/export/?q=%5B${DASHBOARD_ID}%5D" \
	-b "$COOKIE_JAR")"

if [[ "$TEMPLATE_HTTP_CODE" -lt 200 || "$TEMPLATE_HTTP_CODE" -ge 300 ]]; then
	say_err "Falha ao exportar dashboard modelo (HTTP ${TEMPLATE_HTTP_CODE})."
	exit 1
fi

if ! unzip -t "$TEMPLATE_ZIP" >/dev/null 2>&1; then
	say_err "Template exportado não é um ZIP válido."
	exit 1
fi

say_ok "Template exportado com sucesso."

# ─── Função auxiliar: renovar CSRF token ─────────────────────────
refresh_csrf() {
	API_CSRF="$(curl_run -s -b "$COOKIE_JAR" -c "$COOKIE_JAR" \
		"${SUPERSET_URL}/api/v1/security/csrf_token/" \
		| jq -r '.result // empty')"
}

# ─── Função auxiliar: ajustar filtro "Cliente" no YAML ───────────
update_cliente_filter() {
	local yaml_file="$1"
	local role_base="$2"
	local tmp_file
	tmp_file=$(mktemp)

	awk -v newval="$role_base" '
		function replace_list_item(line,    m) {
			if (match(line, /^([[:space:]]*-[[:space:]]*).*/, m)) {
				return m[1] newval
			}
			return line
		}
		BEGIN { in_cliente = 0; list_mode = 0; in_adhoc = 0; injected = 0 }
		/^  - id: / {
			if (in_cliente && !injected) {
				print "    adhoc_filters:";
				print "    - clause: WHERE";
				print "      comparator:";
				print "      - " newval;
				print "      datasourceWarning: false";
				print "      expressionType: SIMPLE";
				print "      filterOptionName: filter_prefilter_autogen";
				print "      isExtra: false";
				print "      isNew: false";
				print "      operator: IN";
				print "      operatorId: IN";
				print "      sqlExpression: null";
				print "      subject: account_name";
				print "    time_range: Sem filtro";
				print "    granularity_sqla: null";
				injected = 1;
			}
			if (in_cliente) { in_cliente = 0; list_mode = 0; in_adhoc = 0; injected = 0 }
		}
		{
			line = $0
			if (line ~ /^[[:space:]]*name:[[:space:]]*Cliente[[:space:]]*$/) {
				in_cliente = 1
			}
			if (in_cliente) {
				if (line ~ /^[[:space:]]*adhoc_filters:[[:space:]]*$/) {
					if (!injected) {
						print "    adhoc_filters:";
						print "    - clause: WHERE";
						print "      comparator:";
						print "      - " newval;
						print "      datasourceWarning: false";
						print "      expressionType: SIMPLE";
						print "      filterOptionName: filter_prefilter_autogen";
						print "      isExtra: false";
						print "      isNew: false";
						print "      operator: IN";
						print "      operatorId: IN";
						print "      sqlExpression: null";
						print "      subject: account_name";
						print "    time_range: Sem filtro";
						print "    granularity_sqla: null";
						injected = 1;
					}
					in_adhoc = 1;
					next;
				}
				if (in_adhoc == 1) {
					if (line ~ /^[[:space:]]{4}[A-Za-z_]+:/) {
						in_adhoc = 0;
					} else {
						next;
					}
				}
				if (line ~ /^[[:space:]]*controlValues:[[:space:]]*$/ && !injected) {
					print "    adhoc_filters:";
					print "    - clause: WHERE";
					print "      comparator:";
					print "      - " newval;
					print "      datasourceWarning: false";
					print "      expressionType: SIMPLE";
					print "      filterOptionName: filter_prefilter_autogen";
					print "      isExtra: false";
					print "      isNew: false";
					print "      operator: IN";
					print "      operatorId: IN";
					print "      sqlExpression: null";
					print "      subject: account_name";
					print "    time_range: Sem filtro";
					print "    granularity_sqla: null";
					injected = 1;
				}
				if (line ~ /^[[:space:]]*label:[[:space:]]*/) {
					sub(/label:[[:space:]]*.*/, "label: " newval, line)
				}
				if (line ~ /^[[:space:]]*(comparator|val|value):[[:space:]]*$/) {
					list_mode = 1
				} else if (list_mode == 1) {
					if (line ~ /^[[:space:]]*-[[:space:]]*/) {
						line = replace_list_item(line)
					} else if (line ~ /^[[:space:]]*[A-Za-z_]+:/) {
						list_mode = 0
					}
				}
			}
			print line
		}
	' "$yaml_file" > "$tmp_file" && mv "$tmp_file" "$yaml_file"
}

# ─── Função: clonar dashboard para um nome/role específico ───────
clone_dashboard_for() {
	local dash_name="$1"
	local role_name="$2"
	local role_id="$3"

	# Preparar import (ajustar UUID para criar clone)
	local import_dir
	import_dir=$(mktemp -d)
	local work_zip="${import_dir}/template.zip"
	cp -f "$TEMPLATE_ZIP" "$work_zip"

	unzip -q -o "$work_zip" -d "$import_dir"
	rm -f "$work_zip"

	local dash_yaml
	dash_yaml=$(find "$import_dir" -path '*/dashboards/*.yaml' | head -1)
	if [[ -n "$dash_yaml" ]]; then
		local old_uuid
		old_uuid=$(grep -oP '^uuid:\s*\K\S+' "$dash_yaml" || true)
		if [[ -n "$old_uuid" ]]; then
			local new_uuid
			new_uuid=$(cat /proc/sys/kernel/random/uuid)
			sed -i "s/${old_uuid}/${new_uuid}/g" "$dash_yaml"
			say_info "[${dash_name}] UUID: ${old_uuid:0:8}... → ${new_uuid:0:8}..."
		fi

		local role_base
		role_base="${dash_name#${DASHBOARD_PREFIX}_}"
		update_cliente_filter "$dash_yaml" "$role_base"
		say_info "[${dash_name}] Filtro 'Cliente' ajustado para '${role_base}'."
		sed -i "s/^slug:.*/slug: ${dash_name,,}/" "$dash_yaml" 2>/dev/null || true
	fi

	local import_zip="${import_dir}/import.zip"
	(cd "$import_dir" && zip -r -q "$import_zip" .)

	# Importar
	say_action "[${dash_name}] Importando clone..."
	refresh_csrf

	local import_resp
	import_resp="$(curl_run -s -w "\n%{http_code}" \
		-X POST "${SUPERSET_URL}/api/v1/dashboard/import/" \
		-b "$COOKIE_JAR" \
		-H "X-CSRFToken: ${API_CSRF}" \
		-H "Referer: ${SUPERSET_URL}/" \
		-F "formData=@${import_zip}" \
		-F "overwrite=false")"

	local import_http
	import_http=$(echo "$import_resp" | tail -1)
	local import_body
	import_body=$(echo "$import_resp" | sed '$d')

	rm -rf "$import_dir"

	if [[ "$import_http" -lt 200 || "$import_http" -ge 300 ]]; then
		say_err "[${dash_name}] Falha ao importar (HTTP ${import_http}): ${import_body}"
		return 1
	fi

	say_ok "[${dash_name}] Dashboard importado."

	# Localizar o dashboard clonado (mais recente)
	say_action "[${dash_name}] Localizando clone..."

	local dash_list
	dash_list="$(curl_run -s \
		"${SUPERSET_URL}/api/v1/dashboard/?q=(order_column:changed_on_delta_humanized,order_direction:desc,page_size:5)" \
		-b "$COOKIE_JAR")"

	local new_id=""
	if [[ -n "${new_uuid:-}" ]]; then
		new_id="$(echo "$dash_list" | jq -r --arg uuid "$new_uuid" \
			'.result[] | select(.uuid == $uuid) | .id // empty' 2>/dev/null)"
	fi
	if [[ -z "$new_id" ]]; then
		new_id="$(echo "$dash_list" | jq -r '.result[0].id // empty')"
	fi

	if [[ -z "$new_id" ]]; then
		say_err "[${dash_name}] Não foi possível identificar o dashboard clonado."
		return 1
	fi

	say_ok "[${dash_name}] Clone localizado (ID: ${new_id})."

	# Renomear
	say_action "[${dash_name}] Renomeando para '${dash_name}'..."
	refresh_csrf

	local rename_resp
	rename_resp="$(curl_run -s -o /dev/null -w "%{http_code}" \
		-X PUT "${SUPERSET_URL}/api/v1/dashboard/${new_id}" \
		-b "$COOKIE_JAR" \
		-H "X-CSRFToken: ${API_CSRF}" \
		-H "Referer: ${SUPERSET_URL}/" \
		-H "Content-Type: application/json" \
		-d "{\"dashboard_title\":\"${dash_name}\"}")"

	if [[ "$rename_resp" -lt 200 || "$rename_resp" -ge 300 ]]; then
		say_err "[${dash_name}] Falha ao renomear (HTTP ${rename_resp})."
		return 1
	fi

	say_ok "[${dash_name}] Renomeado."

	# Aplicar role
	say_action "[${dash_name}] Aplicando role '${role_name}' (ID: ${role_id})..."
	refresh_csrf

	local role_resp
	role_resp="$(curl_run -s -o /dev/null -w "%{http_code}" \
		-X PUT "${SUPERSET_URL}/api/v1/dashboard/${new_id}" \
		-b "$COOKIE_JAR" \
		-H "X-CSRFToken: ${API_CSRF}" \
		-H "Referer: ${SUPERSET_URL}/" \
		-H "Content-Type: application/json" \
		-d "{\"roles\":[${role_id}]}")"

	if [[ "$role_resp" -lt 200 || "$role_resp" -ge 300 ]]; then
		say_err "[${dash_name}] Falha ao aplicar role (HTTP ${role_resp})."
		return 1
	fi

	say_ok "[${dash_name}] Role '${role_name}' aplicada ao dashboard (ID: ${new_id})."
}

# ─── 2) Obter roles que terminam com ROLE_SUFFIX ─────────────────
say_action "Listando roles que terminam com '${ROLE_SUFFIX}'..."

# Paginar para obter todas as roles (100 por página)
ALL_ROLES_JSON="[]"
ROLES_PAGE=0
ROLES_PAGE_SIZE=100

while true; do
	PAGE_RESP="$(curl_run -s \
		"${SUPERSET_URL}/api/v1/security/roles/?q=(page:${ROLES_PAGE},page_size:${ROLES_PAGE_SIZE})" \
		-b "$COOKIE_JAR")"

	PAGE_COUNT="$(echo "$PAGE_RESP" | jq '.result | length')"
	ALL_ROLES_JSON="$(echo "$ALL_ROLES_JSON" "$PAGE_RESP" | jq -s '.[0] + (.[1].result // [])')"

	if [[ "$PAGE_COUNT" -lt "$ROLES_PAGE_SIZE" ]]; then
		break
	fi
	ROLES_PAGE=$((ROLES_PAGE + 1))
done

# Filtrar roles cujo nome termina com _CONTROLE ou -CONTROLE (case insensitive)
MATCHING_ROLES="$(echo "$ALL_ROLES_JSON" | jq -r --arg suffix "$ROLE_SUFFIX" \
	'[ .[] | select(
		(.name | ascii_upcase | endswith("_" + ($suffix | ascii_upcase))) or
		(.name | ascii_upcase | endswith("-" + ($suffix | ascii_upcase)))
	) ] | sort_by(.name)')"

ROLE_COUNT="$(echo "$MATCHING_ROLES" | jq 'length')"

if [[ "$ROLE_COUNT" -eq 0 ]]; then
	say_warn "Nenhuma role encontrada com sufixo '${ROLE_SUFFIX}'."
	exit 0
fi

say_ok "${ROLE_COUNT} role(s) encontrada(s) com sufixo '${ROLE_SUFFIX}':"

echo "$MATCHING_ROLES" | jq -r '.[] | "   • \(.name) (ID: \(.id))"'
printf "\n"

# ─── 3) Obter todos os dashboards existentes ─────────────────────
say_action "Listando todos os dashboards existentes..."

ALL_DASH_JSON="[]"
DASH_PAGE=0
DASH_PAGE_SIZE=100

while true; do
	PAGE_RESP="$(curl_run -s \
		"${SUPERSET_URL}/api/v1/dashboard/?q=(page:${DASH_PAGE},page_size:${DASH_PAGE_SIZE})" \
		-b "$COOKIE_JAR")"

	PAGE_COUNT="$(echo "$PAGE_RESP" | jq '.result | length')"
	ALL_DASH_JSON="$(echo "$ALL_DASH_JSON" "$PAGE_RESP" | jq -s '.[0] + (.[1].result // [])')"

	if [[ "$PAGE_COUNT" -lt "$DASH_PAGE_SIZE" ]]; then
		break
	fi
	DASH_PAGE=$((DASH_PAGE + 1))
done

DASH_TOTAL="$(echo "$ALL_DASH_JSON" | jq 'length')"
say_ok "${DASH_TOTAL} dashboard(s) existente(s) encontrado(s)."

# ─── 4) Determinar quais dashboards precisam ser criados ─────────
# Função para trim de espaços (início e fim) usando bash puro
trim_spaces() {
	local var="$1"
	# Remove espaços do início
	var="${var#"${var%%[![:space:]]*}"}"
	# Remove espaços do fim
	var="${var%"${var##*[![:space:]]}"}"
	echo "$var"
}
say_action "Verificando quais dashboards precisam ser criados..."

DASHBOARDS_TO_CREATE=()     # array de "dash_name|role_name|role_id"
IGNORED_ROLES=()            # array de roles ignoradas

# Obter lista de roles a ignorar (separadas por vírgula)
IGNORE_ROLES_RAW="$(get_env_value "LOONAR_CLONE_IGNORE_ROLES")"
# Remove aspas duplas/simples do início e fim
IGNORE_ROLES_RAW="${IGNORE_ROLES_RAW%\"}"
IGNORE_ROLES_RAW="${IGNORE_ROLES_RAW#\"}"
IGNORE_ROLES_RAW="${IGNORE_ROLES_RAW%\'}"
IGNORE_ROLES_RAW="${IGNORE_ROLES_RAW#\'}"
IFS=',' read -r -a IGNORE_ROLES <<< "${IGNORE_ROLES_RAW}"

while IFS= read -r role_line; do
	role_name="$(echo "$role_line" | jq -r '.name')"
	role_id="$(echo "$role_line" | jq -r '.id')"

	# Verificar se role está na lista de ignorados (case insensitive, ignora espaços)
	ignore_this_role=false
	for ignore in "${IGNORE_ROLES[@]}"; do
		ignore_trimmed="$(trim_spaces "$ignore")"
		if [[ -n "$ignore_trimmed" && "${role_name,,}" == "${ignore_trimmed,,}" ]]; then
			ignore_this_role=true
			break
		fi
	done

	if $ignore_this_role; then
		IGNORED_ROLES+=("$role_name")
		say_ok "Role '${role_name}' está na lista de ignorados → não será processada"
		continue
	fi

	# Remover sufixo _CONTROLE ou -CONTROLE do nome da role
	base_name="$(echo "$role_name" | sed -E "s/[_-]${ROLE_SUFFIX}$//" )"

	# Nome esperado do dashboard
	expected_dash="${DASHBOARD_PREFIX}_${base_name}"

	# Verificar se já existe (case insensitive)
	exists="$(echo "$ALL_DASH_JSON" | jq -r --arg name "$expected_dash" \
		'[ .[] | select(.dashboard_title | ascii_upcase == ($name | ascii_upcase)) ] | length')"

	if [[ "$exists" -eq 0 ]]; then
		DASHBOARDS_TO_CREATE+=("${expected_dash}|${role_name}|${role_id}")
		say_warn "Dashboard '${expected_dash}' NÃO encontrado → será criado"
	else
		say_ok "Dashboard '${expected_dash}' já existe → ignorado"
	fi
done < <(echo "$MATCHING_ROLES" | jq -c '.[]')

# ─── 5) Confirmar criação com o usuário ──────────────────────────
CREATE_COUNT=${#DASHBOARDS_TO_CREATE[@]}

if [[ "$CREATE_COUNT" -eq 0 ]]; then
	say_ok "Todos os dashboards já existem. Nada a fazer."
	exit 0
fi


say_info "Resumo: ${CREATE_COUNT} dashboard(s) a ser(em) criado(s):"

for entry in "${DASHBOARDS_TO_CREATE[@]}"; do
	IFS='|' read -r dash_name role_name role_id <<< "$entry"
	printf "   📋 %b%-40s%b ← role: %b%s%b (ID: %s)\n" \
		"${COLOR_CYAN}${COLOR_BOLD}" "$dash_name" "${COLOR_RESET}" \
		"${COLOR_YELLOW}" "$role_name" "${COLOR_RESET}" "$role_id"
done
printf "\n"

# Exibe resumo das roles ignoradas, se houver
IGNORED_COUNT=${#IGNORED_ROLES[@]}
if [[ "$IGNORED_COUNT" -gt 0 ]]; then
	say_info "Roles ignoradas (${IGNORED_COUNT}):"
	for ignored in "${IGNORED_ROLES[@]}"; do
		printf "   ⏭️  %b%s%b\n" "${COLOR_YELLOW}" "$ignored" "${COLOR_RESET}"
	done
	printf "\n"
fi

if ! confirm_continue "Deseja prosseguir com a criação dos ${CREATE_COUNT} dashboard(s) acima?"; then
	say_warn "Operação cancelada pelo usuário."
	exit 0
fi

# ─── 6) Clonar cada dashboard ────────────────────────────────────
CREATED=0
SKIPPED=0
FAILED=0

for entry in "${DASHBOARDS_TO_CREATE[@]}"; do
	IFS='|' read -r dash_name role_name role_id <<< "$entry"

	printf "%b\n" "${COLOR_BLUE}${COLOR_BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${COLOR_RESET}"
	say_info "Próximo: '${dash_name}' (role: ${role_name})"

	if [[ "${AUTO_YES:-false}" != "true" ]]; then
		if confirm_continue_or_all "Criar dashboard '${dash_name}'?"; then
			rc=0
		else
			rc=$?
		fi
		case $rc in
			0) ;; 
			2) AUTO_YES=true ;; 
			*)
				say_warn "Dashboard '${dash_name}' ignorado pelo usuário."
				SKIPPED=$((SKIPPED + 1))
				continue
				;;
		esac
	fi

	if clone_dashboard_for "$dash_name" "$role_name" "$role_id"; then
		CREATED=$((CREATED + 1))
	else
		FAILED=$((FAILED + 1))
		say_err "Falha ao criar '${dash_name}'. Continuando..."
	fi
done

# ─── Resumo final ────────────────────────────────────────────────
printf "\n%b\n" "${COLOR_BLUE}${COLOR_BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${COLOR_RESET}"
say_ok "Concluído!"
say_info "Resumo: ✅ criados=${CREATED}  ⏭️  ignorados=${SKIPPED}  ❌ falhas=${FAILED}"