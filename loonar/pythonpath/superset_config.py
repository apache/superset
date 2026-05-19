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

import logging
import os
from datetime import timedelta
from typing import Any, Optional, Type
from urllib.parse import urlparse

from cachelib.redis import RedisCache
from celery.schedules import crontab
from flask_appbuilder.security.manager import AUTH_DB, AUTH_LDAP
from flask_appbuilder.security.sqla.manager import SecurityManager

from loonar import LoonarAppInitializer
from loonar.ldap_config import get_ldap_setting, get_ldap_user_base_aliases
from loonar.security import LoonarSecurityManager
from superset.security import SupersetSecurityManager

# =============================
# SUPORTE A IDIOMA PT-BR
# IMPORTANTE: Superset desabilita i18n por padrão (LANGUAGES = {}),
# então precisamos reabilitar com os idiomas desejados.
# Isso DEVE estar aqui, ANTES de qualquer outro import que possa 
# sobrescrever LANGUAGES.
LANGUAGES = {
    "en": {"flag": "us", "name": "English"},
    "pt_BR": {"flag": "br", "name": "Português (Brasil)"},
}
BABEL_DEFAULT_LOCALE = "pt_BR"
# Garanta que i18n está habilitado
# (Superset por padrão desabilita com LANGUAGES = {})
ENABLE_LANGUAGE_PACK = True

# Formato numérico D3 padrão para pt_BR (ponto como separador de milhar e vírgula decimal)
# Pode ser sobrescrito por D3_FORMAT no ambiente de produção, se desejado.
D3_FORMAT = {
    "decimal": ",",
    "thousands": ".",
    "grouping": [3],
    "currency": ["R$", ""],
}

# Diretórios onde Babel pode encontrar as traduções compiladas
BABEL_TRANSLATION_DIRECTORIES = "superset/translations"

# Garanta que o locale padrão é pt_BR (não permite fallback para pt)
# Se houver requisição para 'pt' sem '_BR', redireciona para 'pt_BR'
SUPPORTED_LANGUAGES = {
    "en": "English",
    "pt_BR": "Português (Brasil)",
}

# =============================
# BLOCO: CONFIGURAÇÃO DE AUTENTICAÇÃO - SELEÇÃO DO FORMULÁRIO DE LOGIN
ENABLE_FLASK_LOGIN = True
# =============================
# Determinar qual SecurityManager usar baseado na variável de ambiente
_LOGIN_FORM_TYPE: str = os.getenv("SUPERSET_LOGIN_FORM_TYPE", "ldap").lower()

# Escolher SecurityManager e template baseado na configuração
# Usando ternário para evitar redefinição de variáveis (problema do mypy)
_security_manager: Type[SecurityManager] = (
    SupersetSecurityManager if _LOGIN_FORM_TYPE == "superset" else LoonarSecurityManager
)
_login_template: Optional[str] = (
    None if _LOGIN_FORM_TYPE == "superset" else "security/login.html"
)

# Atribuições finais
CUSTOM_SECURITY_MANAGER = _security_manager
SECURITY_LOGIN_TEMPLATE = _login_template
APP_INITIALIZER = LoonarAppInitializer

# Logging para ajudar no debug
_logger: logging.Logger = logging.getLogger(__name__)
_logger.info(
    f"Login form type: {_LOGIN_FORM_TYPE} | Using: {CUSTOM_SECURITY_MANAGER.__name__}"
)

# =============================
# BLOCO: SEGURANÇA ORIGINAL
# =============================

# Security
SECRET_KEY = os.environ.get("SUPERSET_SECRET_KEY") or os.environ.get("SECRET_KEY")
if not SECRET_KEY:
    raise ValueError("SECRET_KEY must be set in production")

# Usar LDAP quando LoonarSecurityManager estiver ativo, caso contrário DB
AUTH_TYPE = AUTH_LDAP if _LOGIN_FORM_TYPE == "ldap" else AUTH_DB
_auth_user_registration_default = "true" if _LOGIN_FORM_TYPE == "ldap" else "false"
AUTH_USER_REGISTRATION = (
    os.getenv("AUTH_USER_REGISTRATION", _auth_user_registration_default).strip().lower()
    == "true"
)
AUTH_USER_REGISTRATION_ROLE = "Gamma"

_ldap_mode = os.getenv("LOONAR_LDAP_MODE", "real").strip().lower()
AUTH_LDAP_SERVER = (
    get_ldap_setting("LOONAR_LDAP_SERVER_MOCK")
    if _ldap_mode == "mock"
    else get_ldap_setting("LOONAR_LDAP_SERVER_REAL")
)
AUTH_LDAP_USE_TLS = (
    get_ldap_setting("LOONAR_LDAP_USE_SSL_MOCK", "false")
    if _ldap_mode == "mock"
    else get_ldap_setting("LOONAR_LDAP_USE_SSL_REAL", "false")
).lower() == "true"
AUTH_LDAP_BIND_USER = (
    get_ldap_setting("LOONAR_LDAP_BIND_DN_MOCK")
    if _ldap_mode == "mock"
    else get_ldap_setting("LOONAR_LDAP_BIND_DN_REAL")
)
AUTH_LDAP_BIND_PASSWORD = (
    get_ldap_setting("LOONAR_LDAP_BIND_PASSWORD_MOCK")
    if _ldap_mode == "mock"
    else get_ldap_setting("LOONAR_LDAP_BIND_PASSWORD_REAL")
)
_ldap_user_base_aliases = get_ldap_user_base_aliases("")
AUTH_LDAP_SEARCH = next(iter(_ldap_user_base_aliases.values()), "")
AUTH_LDAP_UID_FIELD = os.getenv("LOONAR_LDAP_UID_ATTR", "sAMAccountName")
AUTH_LDAP_FIRSTNAME_FIELD = os.getenv("LOONAR_LDAP_FIRSTNAME_ATTR", "givenName")
AUTH_LDAP_LASTNAME_FIELD = os.getenv("LOONAR_LDAP_LASTNAME_ATTR", "sn")
AUTH_LDAP_EMAIL_FIELD = os.getenv("LOONAR_LDAP_EMAIL_ATTR", "mail")
AUTH_LDAP_ALLOW_SELF_SIGNED = True
AUTH_LDAP_BIND_FIRST = False
AUTH_LDAP_TLS_DEMAND = False
AUTH_LDAP_TLS_CACERTDIR: str | None = None
AUTH_LDAP_TLS_CACERTFILE: str | None = None
AUTH_LDAP_TLS_CERTFILE: str | None = None
AUTH_LDAP_TLS_KEYFILE: str | None = None
AUTH_LDAP_APPEND_DOMAIN: str | None = None
AUTH_LDAP_USERNAME_FORMAT: str | None = None
AUTH_LDAP_SEARCH_FILTER: str | None = None
AUTH_LDAP_GROUP_FIELD = "memberOf"

# Nota: CUSTOM_SECURITY_MANAGER e SECURITY_LOGIN_TEMPLATE foram movidos
# para a seção de
# "CONFIGURAÇÃO DE AUTENTICAÇÃO - SELEÇÃO DO FORMULÁRIO DE LOGIN"
# acima, pois precisam ser condicionados pela variável SUPERSET_LOGIN_FORM_TYPE


# Ensure reCAPTCHA keys are always present in the config to avoid KeyError
RECAPTCHA_PUBLIC_KEY = os.environ.get("RECAPTCHA_PUBLIC_KEY", "")
RECAPTCHA_PRIVATE_KEY = os.environ.get("RECAPTCHA_PRIVATE_KEY", "")

SUPERSET_ENV = "production"

# Allowed host (used by some reverse proxy setups)
SUPERSET_HOST = os.environ.get("SUPERSET_HOST", "localhost")

# Database
DATABASE_DIALECT = os.environ.get("DATABASE_DIALECT", "postgresql")
DATABASE_USER = os.environ.get("DATABASE_USER", "superset")
DATABASE_PASSWORD = os.environ.get("DATABASE_PASSWORD", "")
DATABASE_HOST = os.environ.get("DATABASE_HOST", "db")
DATABASE_PORT = os.environ.get("DATABASE_PORT", "5432")
DATABASE_DB = os.environ.get("DATABASE_DB", "superset")
SQLALCHEMY_DATABASE_URI = os.environ.get("DATABASE_URL") or (
    f"{DATABASE_DIALECT}://{DATABASE_USER}:{DATABASE_PASSWORD}"
    f"@{DATABASE_HOST}:{DATABASE_PORT}/{DATABASE_DB}"
)
SQLALCHEMY_TRACK_MODIFICATIONS = False
SQLALCHEMY_ENGINE_OPTIONS = {
    "pool_size": 10,
    "pool_recycle": 3600,
    "pool_pre_ping": True,
    "max_overflow": 20,
}

# Redis
REDIS_HOST = os.environ.get("REDIS_HOST", "redis")
REDIS_PORT = int(os.environ.get("REDIS_PORT", 6379))
REDIS_PASSWORD = os.environ.get("REDIS_PASSWORD", os.environ.get("REDIS_PASS", ""))
REDIS_CELERY_DB = int(os.environ.get("REDIS_CELERY_DB", 0))
REDIS_RESULTS_DB = int(os.environ.get("REDIS_RESULTS_DB", 1))

REDIS_URL = f"redis://:{REDIS_PASSWORD}@{REDIS_HOST}:{REDIS_PORT}/{REDIS_CELERY_DB}"
REDIS_RESULTS_URL = (
    f"redis://:{REDIS_PASSWORD}@{REDIS_HOST}:{REDIS_PORT}/{REDIS_RESULTS_DB}"
)

RESULTS_BACKEND = RedisCache(
    host=REDIS_HOST,
    port=REDIS_PORT,
    password=REDIS_PASSWORD or None,
    db=REDIS_RESULTS_DB,
    key_prefix="superset_results_",
)

# Cache
CACHE_CONFIG = {
    "CACHE_TYPE": "RedisCache",
    "CACHE_DEFAULT_TIMEOUT": 300,
    "CACHE_KEY_PREFIX": "superset_",
    "CACHE_REDIS_URL": (f"redis://:{REDIS_PASSWORD}@{REDIS_HOST}:{REDIS_PORT}/2"),
}

DATA_CACHE_CONFIG = {
    **CACHE_CONFIG,
    "CACHE_DEFAULT_TIMEOUT": 3600,
    "CACHE_KEY_PREFIX": "superset_data_",
}


# Celery
class CeleryConfig:
    broker_url = REDIS_URL
    imports = ("superset.sql_lab", "superset.tasks.scheduler")
    result_backend = REDIS_RESULTS_URL
    worker_prefetch_multiplier = 1
    task_acks_late = True
    task_annotations = {
        "sql_lab.get_sql_results": {"rate_limit": "100/s"},
        "email_reports.send": {
            "rate_limit": "1/s",
            "time_limit": 120,
            "soft_time_limit": 150,
        },
    }
    beat_schedule = {
        "reports.scheduler": {
            "task": "reports.scheduler",
            "schedule": crontab(minute="*", hour="*"),
        },
        "reports.prune_log": {
            "task": "reports.prune_log",
            "schedule": crontab(minute=0, hour=0),
        },
    }


CELERY_CONFIG = CeleryConfig

# Static assets / CDN support
STATIC_ASSETS_PREFIX = os.environ.get("STATIC_ASSETS_PREFIX", "").rstrip("/")


def _parse_extra_csp_hosts() -> set[str]:
    hosts: set[str] = set()
    if asset_prefix := STATIC_ASSETS_PREFIX:
        parsed = urlparse(asset_prefix)
        if parsed.scheme and parsed.netloc:
            hosts.add(f"{parsed.scheme}://{parsed.netloc}")

    extra_hosts = os.environ.get("CSP_ADDITIONAL_HOSTS", "")
    for host in (value.strip() for value in extra_hosts.split(",")):
        if host:
            hosts.add(host)

    return hosts


def _extend_csp_sources(base_sources: list[str]) -> list[str]:
    extra_hosts = _parse_extra_csp_hosts()
    extras = [host for host in extra_hosts if host not in base_sources]
    return base_sources + extras if extras else base_sources


# Security Settings
GOOGLE_FONTS_STYLE_SRC = "https://fonts.googleapis.com"
GOOGLE_FONTS_FONT_SRC = "https://fonts.gstatic.com"

TALISMAN_ENABLED = True
TALISMAN_CONFIG = {
    "content_security_policy": {
        "default-src": _extend_csp_sources(["'self'"]),
        "img-src": _extend_csp_sources(["'self'", "data:", "https:"]),
        "script-src": _extend_csp_sources(
            ["'self'", "'unsafe-inline'", "'unsafe-eval'"]
        ),
        "style-src": _extend_csp_sources(
            ["'self'", "'unsafe-inline'", GOOGLE_FONTS_STYLE_SRC]
        ),
        "font-src": _extend_csp_sources(["'self'", "data:", GOOGLE_FONTS_FONT_SRC]),
    },
    "force_https": True,
    "force_https_permanent": True,
    "strict_transport_security": True,
    "strict_transport_security_max_age": 31536000,
    "strict_transport_security_include_subdomains": True,
    "strict_transport_security_preload": True,
}

# CORS
enable_cors = os.environ.get("ENABLE_CORS", "false").lower() == "true"
ENABLE_CORS = enable_cors
CORS_OPTIONS: dict[str, Any] = {}

# Feature Flags
FEATURE_FLAGS = {
    "ALERT_REPORTS": True,
    "DASHBOARD_NATIVE_FILTERS": True,
    "DASHBOARD_CROSS_FILTERS": True,
    "DASHBOARD_RBAC": True,
    "EMBEDDABLE_CHARTS": True,
    "ENABLE_TEMPLATE_PROCESSING": True,
    "SCHEDULED_QUERIES": True,
    "SQL_VALIDATORS_BY_ENGINE": True,
    "THUMBNAILS": True,
    "THUMBNAILS_SQLA_LISTENERS": True,
    "ENABLE_FLASK_LOGIN": True,
    "DISABLE_REACT_LOGIN": True,
}

# WebDriver for thumbnails/alerts
WEBDRIVER_TYPE = os.environ.get("WEBDRIVER_TYPE", "chrome")
WEBDRIVER_OPTION_ARGS = [
    "--force-device-scale-factor=2.0",
    "--high-dpi-support=2.0",
    "--headless",
    "--disable-gpu",
    "--disable-dev-shm-usage",
    "--no-sandbox",
    "--disable-setuid-sandbox",
    "--disable-extensions",
]

# Alerts and Reports
ALERT_REPORTS_NOTIFICATION_DRY_RUN = False
SCREENSHOT_SELENIUM_USER = os.environ.get("SCREENSHOT_SELENIUM_USER", "admin")

# Email
SMTP_HOST = os.environ.get("SMTP_HOST")
SMTP_PORT = int(os.environ.get("SMTP_PORT", 587))
SMTP_STARTTLS = os.environ.get("SMTP_STARTTLS", "True").lower() == "true"
SMTP_SSL = os.environ.get("SMTP_SSL", "False").lower() == "true"
SMTP_USER = os.environ.get("SMTP_USER")
SMTP_PASSWORD = os.environ.get("SMTP_PASSWORD")
SMTP_MAIL_FROM = os.environ.get("SMTP_MAIL_FROM", "superset@example.com")

EMAIL_NOTIFICATIONS = bool(SMTP_HOST)

# Logging
ENABLE_TIME_ROTATE = True
_log_level = os.environ.get("SUPERSET_LOG_LEVEL", "INFO")
LOG_LEVEL = _log_level.upper() if isinstance(_log_level, str) else _log_level
LOG_FORMAT = "%(asctime)s:%(levelname)s:%(name)s:%(message)s"

# Session
# Tempo máximo de inatividade antes de expirar a sessão (em minutos)
# Configura via variável de ambiente AUTH_SESSION_TIMEOUT (padrão: 20 minutos)
_session_timeout_minutes = int(os.environ.get("AUTH_SESSION_TIMEOUT", "20"))
PERMANENT_SESSION_LIFETIME = timedelta(minutes=_session_timeout_minutes)
# Revalida o timeout a cada request para manter expiração por inatividade
SESSION_REFRESH_EACH_REQUEST = True
SESSION_COOKIE_HTTPONLY = True
SESSION_COOKIE_SECURE = True
SESSION_COOKIE_SAMESITE = "Lax"

# WTF CSRF
WTF_CSRF_ENABLED = True
WTF_CSRF_TIME_LIMIT = None
WTF_CSRF_SSL_STRICT = True

# Application
ROW_LIMIT = 50000
VIZ_ROW_LIMIT = 10000
SAMPLES_ROW_LIMIT = 1000
FILTER_SELECT_ROW_LIMIT = 10000

# SQL Lab
SQLLAB_ASYNC_TIME_LIMIT_SEC = 300
SQLLAB_TIMEOUT = 300
SUPERSET_WEBSERVER_TIMEOUT = 300

# Performance
COMPRESS_REGISTER = True

# Public role restrictions
PUBLIC_ROLE_LIKE: Optional[str] = None

# Additional security headers
HTTP_HEADERS = {
    "X-Frame-Options": "SAMEORIGIN",
}

# Mapbox (if needed)
MAPBOX_API_KEY = os.environ.get("MAPBOX_API_KEY", "")

# ------------------------------------------------------------------
# Loonar branding (logos + theming)
# ------------------------------------------------------------------
_BRAND_LOGO_BASE = "/static/assets/images/loonar"
_LIGHT_LOGO_PATH = f"{_BRAND_LOGO_BASE}/logo-light.png"
_DARK_LOGO_PATH = f"{_BRAND_LOGO_BASE}/logo-dark.png"

APP_NAME = os.environ.get("APP_NAME", "Loonar FinOps")
APP_ICON = _LIGHT_LOGO_PATH
LOGO_TOOLTIP = "Loonar FinOps - Powered by Superset"

FAVICONS = [{"href": _LIGHT_LOGO_PATH}]

THEME_DEFAULT: dict[str, Any] = {
    "token": {
        "brandLogoUrl": _LIGHT_LOGO_PATH,
        "brandLogoAlt": "Loonar FinOps",
        "brandLogoHeight": "40px",
    }
}

THEME_DARK: dict[str, Any] = {
    "token": {
        "brandLogoUrl": _DARK_LOGO_PATH,
        "brandLogoAlt": "Loonar FinOps",
        "brandLogoHeight": "40px",
    }
}

# ------------------------------------------------------------------
# Configuração de moedas disponíveis no dropdown do frontend
# ------------------------------------------------------------------
CURRENCIES = [
    "USD",
    "GBP",
    "JPY",
    "EUR",
    "INR",
    "CNY",
    "MXN",
    "BRL",
]

# ------------------------------------------------------------------
# D3 Format - Configuração de formatação de moedas
# ------------------------------------------------------------------
# Garante que a lista de moedas seja adicionada sem sobrescrever as
# chaves numéricas (por exemplo: decimal, thousands) definidas acima.
# Utilizamos a lista `CURRENCIES` definida mais acima para evitar duplicação.
D3_FORMAT.setdefault("CURRENCIES", [
    {"symbol": "$", "name": "USD", "symbolPosition": "prefix"},
    {"symbol": "£", "name": "GBP", "symbolPosition": "prefix"},
    {"symbol": "¥", "name": "JPY", "symbolPosition": "prefix"},
    {"symbol": "€", "name": "EUR", "symbolPosition": "prefix"},
    {"symbol": "₹", "name": "INR", "symbolPosition": "prefix"},
    {"symbol": "CN¥", "name": "CNY", "symbolPosition": "prefix"},
    {"symbol": "MX$", "name": "MXN", "symbolPosition": "prefix"},
    {"symbol": "R$", "name": "BRL", "symbolPosition": "prefix"},
])
