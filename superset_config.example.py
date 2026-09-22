# Licensed to the Apache Software Foundation (ASF) under one
# or more contributor license agreements.
"""
MoH Superset — SINGLE configuration template.

Copy to the project root and edit secrets / URLs:

    cp superset_config.example.py superset_config.py

Then point Superset at it (local + production):

    export SUPERSET_CONFIG_PATH=/abs/path/to/moh-superset/superset_config.py

Restart Superset after any change. All MoH routes (/hpc/, /monitoring-dashboard/,
/ai-chat/, org-unit API, static assets) register via BLUEPRINTS below — no other
config file is required.

Docker dev: `docker/pythonpath_dev/superset_config_docker.py` auto-loads
`superset_config.py` from the repo root (falls back to this example file).
"""

import logging
import os
from urllib.parse import urlparse as _urlparse

from cachelib.redis import RedisCache
from celery.schedules import crontab
from superset.config import (
    THEME_DARK as _APACHE_THEME_DARK,
    THEME_DEFAULT as _APACHE_THEME_DEFAULT,
)

# -----------------------------------------------------------------------------
# SECURITY
# -----------------------------------------------------------------------------
SECRET_KEY = os.environ.get(
    "SUPERSET_SECRET_KEY",
    "CHANGE_ME_in_production_or_set_SUPERSET_SECRET_KEY_env_var",
)

# -----------------------------------------------------------------------------
# DATABASE
# -----------------------------------------------------------------------------
SQLALCHEMY_DATABASE_URI = os.environ.get(
    "SUPERSET_DATABASE_URI",
    "postgresql+psycopg2://superset:CHANGE_ME@localhost:5432/superset",
)

# -----------------------------------------------------------------------------
# EXTERNAL SERVICES
# -----------------------------------------------------------------------------
MAPBOX_API_KEY = os.environ.get("MAPBOX_API_KEY", "")

# -----------------------------------------------------------------------------
# GUEST ACCESS
# -----------------------------------------------------------------------------
GUEST_TOKEN_JWT_EXP_SECONDS = 3600

# -----------------------------------------------------------------------------
# LOGGING
# -----------------------------------------------------------------------------
LOG_LEVEL = getattr(
    logging, os.environ.get("SUPERSET_LOG_LEVEL", "INFO").upper(), logging.INFO
)

# -----------------------------------------------------------------------------
# CORS
# -----------------------------------------------------------------------------
ENABLE_CORS = True
CORS_OPTIONS = {
    "supports_credentials": True,
    "allow_headers": "*",
    "expose_headers": "*",
    "resources": "*",
    "origins": os.environ.get(
        "MOH_CORS_ORIGINS", "localhost,mohss.habtechsolution.com"
    ).split(","),
}

# -----------------------------------------------------------------------------
# DATA STORAGE
# -----------------------------------------------------------------------------
DATA_DIR = os.environ.get("MOH_DATA_DIR", "/home/superset/etls")

# -----------------------------------------------------------------------------
# SECURITY HEADERS & TALISMAN
# -----------------------------------------------------------------------------
OVERRIDE_HTTP_HEADERS = {"X-Frame-Options": "ALLOWALL"}
TALISMAN_ENABLED = False
FAB_ADD_SECURITY_API = True
FAB_API_SWAGGER_UI = True
WTF_CSRF_ENABLED = False
HTTP_HEADERS = {"X-Frame-Options": "ALLOWALL"}

# -----------------------------------------------------------------------------
# CSS TEMPLATES
# -----------------------------------------------------------------------------
ENABLE_CSS_TEMPLATES = True

# -----------------------------------------------------------------------------
# BRANDING & IDENTITY
# -----------------------------------------------------------------------------
VERSION_STRING = "MoH 6.0"
APP_NAME = "MoH Analytics Portal"
APP_ICON = "/moh-static/logomohnewww.png"
APP_ICON_WIDTH = 150
LOGO_TARGET_PATH = "/"
LOGO_TOOLTIP = "MoH Analytics Portal"
LOGO_RIGHT_TEXT = ""
FAVICONS = [{"href": "/moh-static/moh_icon.png"}]

_MOH_BRAND_TOKENS = {
    "brandLogoUrl": APP_ICON,
    "brandLogoAlt": "Ministry of Health",
    "brandAppName": APP_NAME,
    "brandLogoHref": "/",
    "brandLogoHeight": "32px",
    "brandSpinnerUrl": "/moh-static/moh_icon.png",
    "colorPrimary": "#1a5cff",
    "colorLink": "#1a5cff",
}

THEME_DEFAULT = {
    **_APACHE_THEME_DEFAULT,
    "token": {**_APACHE_THEME_DEFAULT["token"], **_MOH_BRAND_TOKENS},
}

THEME_DARK = (
    {
        **_APACHE_THEME_DARK,
        "token": {**_APACHE_THEME_DARK["token"], **_MOH_BRAND_TOKENS},
    }
    if _APACHE_THEME_DARK
    else None
)

# -----------------------------------------------------------------------------
# FEATURE FLAGS
# -----------------------------------------------------------------------------
FEATURE_FLAGS = {
    "ALERT_REPORTS": True,
    "DATASET_FOLDERS": True,
    "ENABLE_TEMPLATE_PROCESSING": True,
    "ENABLE_JAVASCRIPT_CONTROLS": True,
    "EMBEDDED_SUPERSET": True,
    "ENABLE_GEOCODE": True,
    "GUEST_TOKEN_JWT_ALGO": "HS256",
    "GLOBAL_ASYNC_QUERIES": True,
    "ALERT_REPORT_TABS": True,
    "EXTRA_HTML_CONTENT": True,
    "FILTERBAR_CLOSED_BY_DEFAULT": True,
}

# -----------------------------------------------------------------------------
# CONTENT SECURITY POLICY
# -----------------------------------------------------------------------------
_MOH_CSP_DEV_ORIGIN = os.environ.get("MOH_CSP_DEV_ORIGIN")
_MOH_AI_IFRAME_URL = os.environ.get("MOH_AI_IFRAME_URL")


def _origin_of(url):
    if not url:
        return None
    p = _urlparse(url)
    if p.scheme and p.netloc:
        return f"{p.scheme}://{p.netloc}"
    return url


_MOH_CSP_DEV_ORIGIN = _origin_of(_MOH_CSP_DEV_ORIGIN)
_MOH_AI_IFRAME_ORIGIN = _origin_of(_MOH_AI_IFRAME_URL)
_MOH_CSP_EXTRA_ORIGINS = [
    o for o in (_MOH_CSP_DEV_ORIGIN, _MOH_AI_IFRAME_ORIGIN) if o
]

_MOH_CSP = {
    "default-src": ["'self'"],
    "img-src": ["'self'", "data:"] + _MOH_CSP_EXTRA_ORIGINS,
    "style-src": ["'self'", "'unsafe-inline'"],
    "script-src": ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
    "font-src": ["'self'", "data:"],
    "frame-src": ["'self'"] + _MOH_CSP_EXTRA_ORIGINS,
    "frame-ancestors": ["'self'"],
    "connect-src": [
        "'self'",
        "https://api.mapbox.com",
        "https://events.mapbox.com",
        "https://tile.openstreetmap.org",
        "https://basemaps.cartocdn.com",
        "https://*.basemaps.cartocdn.com",
    ]
    + _MOH_CSP_EXTRA_ORIGINS,
    "worker-src": ["'self'", "blob:"],
}

TALISMAN_DEV_CONFIG = {
    "force_https": False,
    "session_cookie_secure": False,
    "content_security_policy": _MOH_CSP,
}

TALISMAN_CONFIG = {
    "force_https": os.environ.get("MOH_FORCE_HTTPS", "true").lower() == "true",
    "session_cookie_secure": os.environ.get("MOH_FORCE_HTTPS", "true").lower()
    == "true",
    "content_security_policy": _MOH_CSP,
}

# -----------------------------------------------------------------------------
# MCP SERVER
# -----------------------------------------------------------------------------
MCP_AUTH_ENABLED = False
MCP_DEV_USERNAME = "admin"
MCP_TOOL_SEARCH_CONFIG = {"enabled": False}

# -----------------------------------------------------------------------------
# BLUEPRINTS — HIS (/monitoring-dashboard/), PHC (/hpc/), AI chat, org units
# -----------------------------------------------------------------------------
from superset.hpc import hpc_bp as _hpc_bp  # noqa: E402
from superset.moh_ai_chat import ai_chat_bp as _ai_chat_bp  # noqa: E402
from superset.moh_assets import moh_assets_bp as _moh_assets_bp  # noqa: E402
from superset.moh_assets import moh_guide_bp as _moh_guide_bp  # noqa: E402
from superset.moh_monitoring_dashboard import (  # noqa: E402
    monitoring_dashboard_bp as _monitoring_dashboard_bp,
)
from superset.moh_orgunits_api import moh_orgunits_bp as _moh_orgunits_bp  # noqa: E402

BLUEPRINTS = [
    _ai_chat_bp,
    _moh_orgunits_bp,
    _moh_assets_bp,
    _moh_guide_bp,
    _hpc_bp,
    _monitoring_dashboard_bp,
]

# -----------------------------------------------------------------------------
# ORG UNITS (native filter API)
# -----------------------------------------------------------------------------
MOH_ORG_UNITS_DB_NAME = os.environ.get("MOH_ORG_UNITS_DB_NAME", "MOH_Click_Hhouse")
MOH_ORG_UNITS_SCHEMA = os.environ.get("MOH_ORG_UNITS_SCHEMA", "moh")
MOH_ORG_UNITS_TABLE = os.environ.get("MOH_ORG_UNITS_TABLE", "org_units")
MOH_ORG_UNITS_ROOT_LEVEL = int(os.environ.get("MOH_ORG_UNITS_ROOT_LEVEL", "2"))
MOH_ORG_UNITS_MAX_LEVEL = int(os.environ.get("MOH_ORG_UNITS_MAX_LEVEL", "6"))
MOH_USER_ORG_UNITS_TABLE = os.environ.get(
    "MOH_USER_ORG_UNITS_TABLE", "dim_user_orgunit"
)
MOH_USER_ORG_UNITS_SCHEMA = os.environ.get(
    "MOH_USER_ORG_UNITS_SCHEMA", MOH_ORG_UNITS_SCHEMA
)
# Health Intelligence (and similar) dashboards: only users mapped to this
# org-unit level may open them. Confirm the dashboard id on each environment.
MOH_LEVEL_ONE_ORG_UNIT_LEVEL = int(os.environ.get("MOH_LEVEL_ONE_ORG_UNIT_LEVEL", "1"))
MOH_LEVEL_ONE_DASHBOARD_IDS = {
    int(dashboard_id)
    for dashboard_id in os.environ.get("MOH_LEVEL_ONE_DASHBOARD_IDS", "8").split(",")
    if dashboard_id.strip()
}
# Guest-token usernames (the "user.username" minted into the token, e.g. by
# POST /api/v1/security/guest_token/) allowed onto level-one dashboards without
# an org-unit row. Empty by default: no guest can reach a level-one dashboard
# until an identity is explicitly added here. Comma-separated if set via env.
MOH_LEVEL_ONE_GUEST_USERNAMES = {
    name.strip()
    for name in os.environ.get("MOH_LEVEL_ONE_GUEST_USERNAMES", "").split(",")
    if name.strip()
}

from superset.moh_security_manager import MoHSecurityManager

CUSTOM_SECURITY_MANAGER = MoHSecurityManager

# -----------------------------------------------------------------------------
# LANDING PAGE
# -----------------------------------------------------------------------------
MOH_FEATURED_DASHBOARD = os.environ.get("MOH_FEATURED_DASHBOARD") or None
if MOH_FEATURED_DASHBOARD and MOH_FEATURED_DASHBOARD.isdigit():
    MOH_FEATURED_DASHBOARD = int(MOH_FEATURED_DASHBOARD)

# Prefer a relative path so the tile hits THIS server's access checks.
MOH_HEALTH_INTELLIGENCE_URL = os.environ.get(
    "MOH_HEALTH_INTELLIGENCE_URL",
    "/superset/dashboard/8/",
)

# HIS + PHC iframe pages — required for /monitoring-dashboard/ and /hpc/
MOH_MONITORING_DASHBOARD_IFRAME_URL = os.environ.get(
    "MOH_MONITORING_DASHBOARD_IFRAME_URL",
    "https://system.dhis.et/",
)
PHC_MONITORING_DASHBOARD_IFRAME_URL = os.environ.get(
    "PHC_MONITORING_DASHBOARD_IFRAME_URL",
    "https://public.tableau.com/views/PHCDashboard2026/EthiopiaPHCDashboard2026?:embed=y&:showVizHome=no",
)

# -----------------------------------------------------------------------------
# MAP — Ethiopian-focused basemaps
# -----------------------------------------------------------------------------
DECKGL_BASE_MAP = [
    ["/moh-static/blank-style.json", "Blank (Ethiopia only)"],
    ["https://basemaps.cartocdn.com/gl/positron-gl-style/style.json", "Light (Carto)"],
    ["https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json", "Dark (Carto)"],
    ["https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json", "Streets (Carto)"],
    ["https://tiles.openfreemap.org/styles/liberty", "Liberty (OpenFreeMap)"],
]

DEFAULT_LATITUDE = 9.145
DEFAULT_LONGITUDE = 40.489
DEFAULT_ZOOM = 5.8

# -----------------------------------------------------------------------------
# TV / KIOSK SLIDESHOW — /moh-static/tv
# -----------------------------------------------------------------------------
MOH_TV_INTERVAL_SECONDS = int(os.environ.get("MOH_TV_INTERVAL_SECONDS", "30"))
MOH_TV_SLIDES = []

# -----------------------------------------------------------------------------
# REDIS
# -----------------------------------------------------------------------------
REDIS_HOST = os.environ.get("SUPERSET_REDIS_HOST", "localhost")
REDIS_PORT = int(os.environ.get("SUPERSET_REDIS_PORT", "6379"))

# -----------------------------------------------------------------------------
# CACHE
# -----------------------------------------------------------------------------
CACHE_CONFIG = {
    "CACHE_TYPE": "RedisCache",
    "CACHE_DEFAULT_TIMEOUT": 86400,
    "CACHE_KEY_PREFIX": "superset_",
    "CACHE_REDIS_HOST": REDIS_HOST,
    "CACHE_REDIS_PORT": REDIS_PORT,
    "CACHE_REDIS_DB": 1,
}
DATA_CACHE_CONFIG = {
    **CACHE_CONFIG,
    "CACHE_DEFAULT_TIMEOUT": 3600,
    "CACHE_REDIS_DB": 2,
}
THUMBNAIL_CACHE_CONFIG = {
    **CACHE_CONFIG,
    "CACHE_REDIS_DB": 3,
}

# -----------------------------------------------------------------------------
# CELERY
# -----------------------------------------------------------------------------
class CeleryConfig:
    broker_url = f"redis://{REDIS_HOST}:{REDIS_PORT}/0"
    result_backend = f"redis://{REDIS_HOST}:{REDIS_PORT}/6"
    imports = (
        "superset.sql_lab",
        "superset.tasks.scheduler",
        "superset.tasks.thumbnails",
        "superset.tasks.cache",
    )
    worker_prefetch_multiplier = 1
    task_acks_late = False
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

# -----------------------------------------------------------------------------
# ASYNC QUERIES
# -----------------------------------------------------------------------------
GLOBAL_ASYNC_QUERIES_TRANSPORT = "polling"
GLOBAL_ASYNC_QUERIES_POLLING_DELAY = 500
GLOBAL_ASYNC_QUERIES_REDIS_CONFIG = {
    "host": REDIS_HOST,
    "port": REDIS_PORT,
    "db": 4,
    "ssl": False,
}

# -----------------------------------------------------------------------------
# RESULTS BACKEND
# -----------------------------------------------------------------------------
RESULTS_BACKEND = RedisCache(
    host=REDIS_HOST,
    port=REDIS_PORT,
    db=5,
    default_timeout=86400,
)

# -----------------------------------------------------------------------------
# JWT SECRETS
# -----------------------------------------------------------------------------
JWT_SECRET = os.environ.get("SUPERSET_JWT_SECRET", SECRET_KEY)
JWT_SECRET_KEY = JWT_SECRET
GLOBAL_ASYNC_QUERIES_JWT_SECRET = os.environ.get(
    "SUPERSET_GLOBAL_ASYNC_QUERIES_JWT_SECRET",
    JWT_SECRET,
)

# -----------------------------------------------------------------------------
# PUBLIC URLS
# -----------------------------------------------------------------------------
WEBDRIVER_BASEURL_USER_FRIENDLY = os.environ.get(
    "MOH_PUBLIC_URL", "http://localhost:8088/"
)
MCP_SERVICE_URL = os.environ.get("MCP_SERVICE_URL", "http://localhost:8088")

# -----------------------------------------------------------------------------
# ALERTS & REPORTS
# -----------------------------------------------------------------------------
ALERT_REPORTS_NOTIFICATION_DRY_RUN = (
    os.environ.get("ALERT_REPORTS_DRY_RUN", "false").lower() == "true"
)
WEBDRIVER_BASEURL = os.environ.get("WEBDRIVER_BASEURL", "http://localhost:8088/")

# Give slow MoH dashboards more time before screenshot capture fails.
SCREENSHOT_LOCATE_WAIT = 60
SCREENSHOT_LOAD_WAIT = 180

if os.environ.get("MOH_USE_PLAYWRIGHT", "false").lower() == "true":
    FEATURE_FLAGS["PLAYWRIGHT_REPORTS_AND_THUMBNAILS"] = True
else:
    WEBDRIVER_TYPE = os.environ.get("WEBDRIVER_TYPE", "chrome")
    WEBDRIVER_OPTION_ARGS = [
        "--headless=new",
        "--no-sandbox",
        "--disable-gpu",
        "--disable-dev-shm-usage",
        "--disable-setuid-sandbox",
    ]

# -----------------------------------------------------------------------------
# EMAIL (SMTP)
# -----------------------------------------------------------------------------
SMTP_HOST = os.environ.get("SMTP_HOST", "localhost")
SMTP_PORT = int(os.environ.get("SMTP_PORT", "587"))
SMTP_STARTTLS = os.environ.get("SMTP_STARTTLS", "true").lower() == "true"
SMTP_SSL = os.environ.get("SMTP_SSL", "false").lower() == "true"
SMTP_USER = os.environ.get("SMTP_USER", "")
SMTP_PASSWORD = os.environ.get("SMTP_PASSWORD", "")
SMTP_MAIL_FROM = os.environ.get("SMTP_MAIL_FROM", "alerts@moh.gov.et")
EMAIL_NOTIFICATIONS = True

# -----------------------------------------------------------------------------
# SLACK (optional)
# -----------------------------------------------------------------------------
SLACK_API_TOKEN = os.environ.get("SLACK_API_TOKEN") or None
