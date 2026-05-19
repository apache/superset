#!/usr/bin/env bash

clear

set -euo pipefail

COLOR_RESET="\033[0m"
COLOR_BOLD="\033[1m"
COLOR_RED="\033[31m"
COLOR_GREEN="\033[32m"
COLOR_YELLOW="\033[33m"
COLOR_BLUE="\033[34m"
COLOR_MAGENTA="\033[35m"
COLOR_CYAN="\033[36m"

say_info() {
	printf "%b\n\n" "${COLOR_CYAN}${COLOR_BOLD}ℹ️  $*${COLOR_RESET}"
}

say_ok() {
	printf "%b\n\n" "${COLOR_GREEN}${COLOR_BOLD}✅ $*${COLOR_RESET}"
}

say_warn() {
	printf "%b\n\n" "${COLOR_YELLOW}${COLOR_BOLD}⚠️  $*${COLOR_RESET}"
}

say_err() {
	printf "%b\n\n" "${COLOR_RED}${COLOR_BOLD}❌ $*${COLOR_RESET}"
}

say_action() {
	printf "%b\n\n" "${COLOR_MAGENTA}${COLOR_BOLD}🚀 $*${COLOR_RESET}"
}

PIP_FLAGS=""

offer_install_deps() {
	if [[ "$(uname -s)" != "Linux" ]]; then
		return 0
	fi

	if confirm_continue "Instalar dependências do sistema para os navegadores (sudo playwright install-deps)?"; then
		say_action "Instalando dependências do sistema (Playwright)..."
		if ! sudo "$PYTHON" -m playwright install-deps; then
			say_warn "Falha ao instalar dependências do sistema. Você pode tentar novamente mais tarde."
		fi
	else
		say_warn "Dependências do sistema não instaladas."
	fi
}

git_root() {
	git rev-parse --show-toplevel 2>/dev/null || true
}

script_dir() {
	cd "$(dirname "${BASH_SOURCE[0]}")" && pwd
}

choose_venv_base() {
	local repo_root=""
	local choice=""
	local base=""

	repo_root=$(git_root)
	base=$(script_dir)

	if [[ -n "$repo_root" ]]; then
		printf "%b\n\n" "${COLOR_CYAN}${COLOR_BOLD}ℹ️  Onde deseja criar o .venv?${COLOR_RESET}" >&2
		printf "%b\n\n" "${COLOR_BOLD}1)${COLOR_RESET} Diretório do script: ${base}" >&2
		printf "%b\n\n" "${COLOR_BOLD}2)${COLOR_RESET} Raiz do repositório: ${repo_root}" >&2
		printf "%b" "${COLOR_BLUE}${COLOR_BOLD}❓ Escolha 1 ou 2 (padrão 1): ${COLOR_RESET}" >&2
		read -r choice
		printf "\n\n" >&2

		case "$choice" in
			2)
				echo "$repo_root"
				;;
			""|1)
				echo "$base"
				;;
			*)
				say_err "Opção inválida."
				return 1
				;;
		esac
	else
		echo "$base"
	fi
}

confirm_continue() {
	local message="$1"
	local prompt
	prompt=$(printf "%b" "${COLOR_BLUE}${COLOR_BOLD}❓ ${message} (s/N): ${COLOR_RESET}")
	read -r -p "$prompt" reply
	printf "\n\n"
	case "${reply}" in
		s|S|sim|Sim|SIM|y|Y|yes|YES)
			return 0
			;;
		*)
			return 1
			;;
	esac
}

confirm_continue_default_yes() {
	local message="$1"
	local prompt
	prompt=$(printf "%b" "${COLOR_BLUE}${COLOR_BOLD}❓ ${message} (S/n): ${COLOR_RESET}")
	read -r -p "$prompt" reply
	printf "\n\n"
	case "${reply}" in
		n|N|nao|Nao|NAO|no|No|NO)
			return 1
			;;
		*)
			return 0
			;;
	esac
}

detect_package_manager() {
	if command -v apt-get >/dev/null 2>&1; then
		echo "apt-get"
	elif command -v dnf >/dev/null 2>&1; then
		echo "dnf"
	elif command -v yum >/dev/null 2>&1; then
		echo "yum"
	elif command -v pacman >/dev/null 2>&1; then
		echo "pacman"
	else
		echo ""
	fi
}

install_python() {
	local pkg_manager
	pkg_manager=$(detect_package_manager)

	if [[ -z "$pkg_manager" ]]; then
		say_err "Nenhum gerenciador de pacotes suportado encontrado. Instale o Python 3 manualmente e tente novamente."
		exit 1
	fi

	case "$pkg_manager" in
		apt-get)
			sudo apt-get update
			sudo apt-get install -y python3 python3-pip
			;;
		dnf)
			sudo dnf install -y python3 python3-pip
			;;
		yum)
			sudo yum install -y python3 python3-pip
			;;
		pacman)
			sudo pacman -Sy --noconfirm python python-pip
			;;
	esac
}

ensure_pip() {
	if ! "$PYTHON" -m pip --version >/dev/null 2>&1; then
		say_warn "pip não encontrado para $PYTHON."
		if is_venv; then
			if confirm_continue "Instalar pip no venv (de: ausente → para: ensurepip)?"; then
				"$PYTHON" -m ensurepip --upgrade
			else
				say_err "Instalação abortada pelo usuário."
				exit 1
			fi
		else
			if confirm_continue "Instalar pip (de: ausente → para: python3-pip via sistema)?"; then
				install_python
			else
				say_err "Instalação abortada pelo usuário."
				exit 1
			fi
		fi
	fi
}

get_latest_playwright_version() {
	"$PYTHON" -m pip index versions playwright 2>/dev/null | head -n 1 | sed -E 's/.*\(([^)]+)\).*/\1/'
}

version_lt() {
	local current="$1"
	local target="$2"

	"$PYTHON" - <<'PY' "$current" "$target"
import sys
import re

current = sys.argv[1]
target = sys.argv[2]

def normalize(version: str) -> list[int]:
	parts = [p for p in re.split(r"[^0-9]+", version) if p]
	return [int(p) for p in parts]

cur = normalize(current)
tar = normalize(target)

max_len = max(len(cur), len(tar))
cur.extend([0] * (max_len - len(cur)))
tar.extend([0] * (max_len - len(tar)))

sys.exit(0 if cur < tar else 1)
PY
}

is_venv() {
	"$PYTHON" - <<'PY'
import sys
sys.exit(0 if getattr(sys, "base_prefix", sys.prefix) != sys.prefix else 1)
PY
}

externally_managed_marker() {
	"$PYTHON" - <<'PY'
import sysconfig
from pathlib import Path

paths = {sysconfig.get_path("stdlib"), sysconfig.get_path("platstdlib")}
for p in filter(None, paths):
	marker = Path(p) / "EXTERNALLY-MANAGED"
	if marker.exists():
		print(marker)
		raise SystemExit(0)
raise SystemExit(1)
PY
}

maybe_use_existing_venv() {
	local script_venv=""
	local repo_root=""
	local repo_venv=""

	script_venv="$(script_dir)/.venv-playwright"
	if [[ -d "$script_venv" && -x "$script_venv/bin/python" ]]; then
		say_info "Encontrado .venv-playwright no diretório do script."
		if confirm_continue_default_yes "Usar este .venv existente?"; then
			PYTHON="$script_venv/bin/python"
			say_ok "Usando Python do venv: $PYTHON"
			return 0
		fi
	fi

	repo_root=$(git_root)
	if [[ -n "$repo_root" ]]; then
		repo_venv="$repo_root/.venv-playwright"
		if [[ -d "$repo_venv" && -x "$repo_venv/bin/python" ]]; then
			say_info "Encontrado .venv-playwright na raiz do repositório."
			if confirm_continue_default_yes "Usar este .venv existente?"; then
				PYTHON="$repo_venv/bin/python"
				say_ok "Usando Python do venv: $PYTHON"
				return 0
			fi
		fi
	fi

	return 1
}

prepare_playwright_install_context() {
	local marker=""
	if marker=$(externally_managed_marker 2>/dev/null); then
		say_warn "Ambiente Python gerenciado externamente detectado: ${marker}"

		if confirm_continue "Criar .venv local e usar para Playwright (recomendado)?"; then
			local venv_base=""
			local venv_path=""
			if ! venv_base=$(choose_venv_base); then
				say_err "Criação de .venv cancelada por opção inválida."
				exit 1
			fi
			venv_path="${venv_base}/.venv-playwright"
			say_action "Criando venv em ${venv_path}..."
			if "$PYTHON" -m venv "$venv_path"; then
				PYTHON="${venv_path}/bin/python"
				say_ok "Usando Python do venv: $PYTHON"
				ensure_pip
				return 0
			else
				say_err "Falha ao criar venv. Verifique se o pacote python3-venv está instalado."
				exit 1
			fi
		fi

		if confirm_continue "Forçar instalação no sistema com --break-system-packages (não recomendado)?"; then
			PIP_FLAGS="--break-system-packages"
			return 0
		fi

		say_err "Instalação/atualização abortada pelo usuário."
		exit 1
	fi
}

say_action "Verificando Python..."

PYTHON=""
if command -v python3 >/dev/null 2>&1; then
	PYTHON="python3"
elif command -v python >/dev/null 2>&1; then
	PYTHON="python"
fi

if [[ -z "$PYTHON" ]]; then
	say_warn "Python não encontrado."
	if confirm_continue "Instalar Python 3 (de: ausente → para: python3 via sistema)?"; then
		install_python
		if command -v python3 >/dev/null 2>&1; then
			PYTHON="python3"
		else
			say_err "Python 3 ainda não está disponível após instalação."
			exit 1
		fi
	else
		say_err "Instalação abortada pelo usuário."
		exit 1
	fi
else
	say_ok "Python encontrado: $($PYTHON --version 2>&1)"
fi

maybe_use_existing_venv || true

ensure_pip

say_action "Verificando Playwright (Python)..."

current_version=""
if "$PYTHON" -m pip show playwright >/dev/null 2>&1; then
	current_version=$($PYTHON -m pip show playwright | awk -F': ' '/^Version/{print $2}')
	say_info "Playwright instalado: versão $current_version"
else
	say_warn "Playwright não encontrado."
fi

latest_version="$(get_latest_playwright_version || true)"
if [[ -z "$latest_version" ]]; then
	latest_version="latest"
fi

if [[ -z "$current_version" ]]; then
	if confirm_continue "Instalar Playwright (de: ausente → para: ${latest_version})?"; then
		say_action "Instalando Playwright..."
		prepare_playwright_install_context
		"$PYTHON" -m pip install --upgrade playwright ${PIP_FLAGS}
		offer_install_deps
		say_action "Instalando navegadores do Playwright..."
		"$PYTHON" -m playwright install
		say_ok "Playwright instalado com sucesso."
	else
		say_err "Instalação abortada pelo usuário."
		exit 1
	fi
else
	if [[ "$latest_version" != "latest" ]] && version_lt "$current_version" "$latest_version"; then
		if confirm_continue "Atualizar Playwright (de: ${current_version} → para: ${latest_version})?"; then
			say_action "Atualizando Playwright..."
			prepare_playwright_install_context
			"$PYTHON" -m pip install --upgrade playwright ${PIP_FLAGS}
			offer_install_deps
			say_action "Atualizando navegadores do Playwright..."
			"$PYTHON" -m playwright install
			say_ok "Playwright atualizado com sucesso."
		else
			say_warn "Atualização abortada pelo usuário."
		fi
	else
		say_ok "Playwright já está atualizado."
	fi
fi

say_action "Executando teste de validação..."

if "$PYTHON" - <<'PY'
from importlib import metadata

print(f"Playwright OK ✅ (versão {metadata.version('playwright')})")
PY
then
	if "$PYTHON" -m playwright --version; then
		say_ok "Teste concluído com sucesso."
	else
		say_warn "Playwright importou, mas o comando CLI falhou. Verifique a instalação dos navegadores."
	fi
else
	say_err "Falha ao importar Playwright."
	exit 1
fi
