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

set -euo pipefail

VERBOSE=0

usage() {
	echo "Uso: $(basename "$0") [--verbose|-v] [--help|-h]"
	echo ""
	echo "Opções:"
	echo "  -v, --verbose   Exibe logs detalhados e stderr do ldapsearch"
	echo "  -h, --help      Exibe esta ajuda"
}

while [[ $# -gt 0 ]]; do
	case "$1" in
	-v|--verbose)
		VERBOSE=1
		shift
		;;
	-h|--help)
		usage
		exit 0
		;;
	*)
		echo "❌ Opção inválida: $1"
		usage
		exit 1
		;;
	esac
done

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="${SCRIPT_DIR}/.env"

if [[ ! -f "${ENV_FILE}" ]]; then
	echo "❌ Arquivo .env não encontrado em: ${ENV_FILE}"
	exit 1
fi

if ! command -v ldapsearch >/dev/null 2>&1; then
	echo "❌ O comando 'ldapsearch' não está disponível. Instale ldap-utils/openldap-clients."
	exit 1
fi

trim() {
	local value="$1"
	value="${value#${value%%[![:space:]]*}}"
	value="${value%${value##*[![:space:]]}}"
	echo "${value}"
}

strip_wrapping_quotes() {
	local value="$1"
	value="$(trim "${value}")"
	if [[ "${value}" =~ ^\'.*\'$ ]]; then
		value="${value:1:${#value}-2}"
	elif [[ "${value}" =~ ^\".*\"$ ]]; then
		value="${value:1:${#value}-2}"
	fi
	echo "${value}"
}

read_env_var() {
	local key="$1"
	local line
	line="$(grep -E "^${key}=" "${ENV_FILE}" | tail -n1 || true)"

	if [[ -z "${line}" ]]; then
		echo ""
		return 0
	fi

	strip_wrapping_quotes "${line#*=}"
}

parse_user_bases() {
	local json_like="$1"
	local compact
	compact="$(echo "${json_like}" | tr -d '\n' | tr -d '\r')"

	echo "${compact}" \
		| sed -E 's/^\s*\{//; s/\}\s*$//' \
		| tr ',' '\n' \
		| sed -E 's/^\s*"[^"]+"\s*:\s*"([^"]+)"\s*$/\1/' \
		| sed -E '/^\s*$/d'
}

directory_base_from_dn() {
	local dn="$1"
	local base
	base="$(echo "${dn}" | grep -oiE 'DC=[^,]+' | paste -sd, - || true)"
	echo "${base}"
}

build_search_filter() {
	local input="$1"

	if [[ "${input}" =~ ^\(.*\)$ ]]; then
		echo "${input}"
		return 0
	fi

	if [[ "${input}" == *=* ]]; then
		echo "(${input})"
		return 0
	fi

	echo "(|(sAMAccountName=${input})(userPrincipalName=${input})(mail=${input})(cn=*${input}*))"
}

run_ldap_search() {
	local base_dn="$1"
	local filter="$2"

	if [[ "${VERBOSE}" -eq 1 ]]; then
		echo "[DEBUG] ldapsearch -H ${LDAP_SERVER} -D ${LDAP_BIND_DN} -b ${base_dn} '${filter}'"
		ldapsearch \
			-x \
			-H "${LDAP_SERVER}" \
			-D "${LDAP_BIND_DN}" \
			-w "${LDAP_BIND_PASSWORD}" \
			-b "${base_dn}" \
			"${filter}" \
			dn cn sn givenName mail sAMAccountName userPrincipalName memberOf || true
	else
		ldapsearch \
			-x \
			-H "${LDAP_SERVER}" \
			-D "${LDAP_BIND_DN}" \
			-w "${LDAP_BIND_PASSWORD}" \
			-b "${base_dn}" \
			"${filter}" \
			dn cn sn givenName mail sAMAccountName userPrincipalName memberOf 2>/dev/null || true
	fi
}

echo "=============================================="
echo "🔎 Teste de busca de usuário no Active Directory"
echo "=============================================="
echo ""
echo "Escolha a base para autenticar no LDAP:"
echo "  1) Mock"
echo "  2) Real"

while true; do
	read -r -p "Opção [1/2]: " ENV_CHOICE
	case "${ENV_CHOICE}" in
		1)
			LDAP_SERVER="$(read_env_var "LOONAR_LDAP_SERVER_MOCK")"
			LDAP_BIND_DN="$(read_env_var "LOONAR_LDAP_BIND_DN_MOCK")"
			LDAP_BIND_PASSWORD="$(read_env_var "LOONAR_LDAP_BIND_PASSWORD_MOCK")"
			LDAP_USE_SSL="$(read_env_var "LOONAR_LDAP_USE_SSL_MOCK")"
			break
			;;
		2)
			LDAP_SERVER="$(read_env_var "LOONAR_LDAP_SERVER_REAL")"
			LDAP_BIND_DN="$(read_env_var "LOONAR_LDAP_BIND_DN_REAL")"
			LDAP_BIND_PASSWORD="$(read_env_var "LOONAR_LDAP_BIND_PASSWORD_REAL")"
			LDAP_USE_SSL="$(read_env_var "LOONAR_LDAP_USE_SSL_REAL")"
			break
			;;
		*)
			echo "⚠️  Opção inválida. Digite 1 (Mock) ou 2 (Real)."
			;;
	esac
done

if [[ -z "${LDAP_SERVER}" || -z "${LDAP_BIND_DN}" || -z "${LDAP_BIND_PASSWORD}" ]]; then
	echo "❌ Parâmetros LDAP obrigatórios não encontrados no .env para a base selecionada."
	exit 1
fi

if [[ "${LDAP_USE_SSL,,}" == "true" && "${LDAP_SERVER}" =~ ^ldap:// ]]; then
	LDAP_SERVER="ldaps://${LDAP_SERVER#ldap://}"
fi

if [[ "${VERBOSE}" -eq 1 ]]; then
	echo "[DEBUG] Modo verbose ativado"
	echo "[DEBUG] Servidor LDAP: ${LDAP_SERVER}"
	echo "[DEBUG] Bind DN: ${LDAP_BIND_DN}"
	echo "[DEBUG] LDAP_USE_SSL: ${LDAP_USE_SSL}"
fi

USER_BASES_RAW="$(read_env_var "LOONAR_LDAP_USER_BASE_MOCK")"
if [[ -z "${USER_BASES_RAW}" ]]; then
	echo "❌ Variável LOONAR_LDAP_USER_BASE_MOCK não encontrada no .env."
	exit 1
fi

mapfile -t USER_BASES < <(parse_user_bases "${USER_BASES_RAW}")
if [[ "${#USER_BASES[@]}" -eq 0 ]]; then
	echo "❌ Não foi possível interpretar as OUs em LOONAR_LDAP_USER_BASE_MOCK."
	exit 1
fi

read -r -p "Informe o usuário/filtro para pesquisa LDAP (ex: afarias ou sAMAccountName=afarias): " SEARCH_INPUT
SEARCH_INPUT="$(trim "${SEARCH_INPUT}")"

if [[ -z "${SEARCH_INPUT}" ]]; then
	echo "❌ Valor de pesquisa não pode ser vazio."
	exit 1
fi

SEARCH_FILTER="$(build_search_filter "${SEARCH_INPUT}")"

echo ""
echo "📌 Filtro utilizado: ${SEARCH_FILTER}"
echo "📌 Busca inicial nas OUs da variável LOONAR_LDAP_USER_BASE_MOCK"
echo ""

FOUND=0

for base_dn in "${USER_BASES[@]}"; do
	base_dn="$(trim "${base_dn}")"
	[[ -z "${base_dn}" ]] && continue

	echo "➡️  Pesquisando em: ${base_dn}"
	result="$(run_ldap_search "${base_dn}" "${SEARCH_FILTER}")"

	if echo "${result}" | grep -q "^dn:"; then
		FOUND=1
		echo "✅ Usuário encontrado na OU/base: ${base_dn}"
		echo "----------------------------------------------"
		echo "${result}"
		echo "----------------------------------------------"
	else
		echo "ℹ️  Nenhum resultado nesta OU."
	fi
done

if [[ "${FOUND}" -eq 1 ]]; then
	echo ""
	echo "🏁 Busca concluída com sucesso nas OUs mapeadas."
	exit 0
fi

echo ""
echo "⚠️  Usuário não encontrado nas OUs mapeadas."
echo "🔄 Tentando busca no diretório inteiro..."

ROOT_BASE="$(directory_base_from_dn "${LDAP_BIND_DN}")"
if [[ -z "${ROOT_BASE}" ]]; then
	ROOT_BASE="$(directory_base_from_dn "${USER_BASES[0]}")"
fi

if [[ -z "${ROOT_BASE}" ]]; then
	echo "❌ Não foi possível determinar a base raiz do diretório para fallback."
	exit 1
fi

fallback_result="$(run_ldap_search "${ROOT_BASE}" "${SEARCH_FILTER}")"

if echo "${fallback_result}" | grep -q "^dn:"; then
	echo "✅ Usuário encontrado no diretório."
	echo "📌 Base raiz consultada: ${ROOT_BASE}"
	echo "----------------------------------------------"
	echo "${fallback_result}"
	echo "----------------------------------------------"
	echo "ℹ️  Verifique o atributo 'dn' para identificar em qual OU o usuário está."
	exit 0
fi

echo "❌ Usuário não encontrado nas OUs configuradas nem no diretório inteiro (${ROOT_BASE})."
exit 1
