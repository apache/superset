## Mandatory configuration // Do not change

import os

from cachelib.redis import RedisCache

from superset.superset_typing import CacheConfig

from superset.tasks.types import ExecutorType


def env(key, default=None):
    return os.getenv(key, default)


CACHE_CONFIG = {
      "CACHE_TYPE": "redis",
      "CACHE_DEFAULT_TIMEOUT": 43200,
      "CACHE_KEY_PREFIX": "superset_",
      "CACHE_REDIS_HOST": env("REDIS_HOST"),
      "CACHE_REDIS_PORT": env("REDIS_PORT"),
      "CACHE_REDIS_PASSWORD": env("REDIS_PASSWORD"),
      "CACHE_REDIS_DB": env("REDIS_DB", 1),
}

DATA_CACHE_CONFIG = CACHE_CONFIG

SQLALCHEMY_DATABASE_URI = f"postgresql+psycopg2://{env('DB_USER')}:{env('DB_PASS')}@{env('DB_HOST')}:{env('DB_PORT')}/{env('DB_NAME')}"

SQLALCHEMY_EXAMPLES_URI  = f"postgresql+psycopg2://{env('DB_USER')}:{env('DB_PASS')}@{env('DB_HOST')}:{env('DB_PORT')}/{env('DB_NAME')}"

SQLALCHEMY_TRACK_MODIFICATIONS = True


class CeleryConfig(object):
  CELERY_IMPORTS = ("superset.sql_lab", )
  CELERY_ANNOTATIONS = {"tasks.add": {"rate_limit": "10/s"}}
  BROKER_URL = f"redis://{env('REDIS_HOST')}:{env('REDIS_PORT')}/0"
  CELERY_RESULT_BACKEND = f"redis://{env('REDIS_HOST')}:{env('REDIS_PORT')}/0"

CELERY_CONFIG = CeleryConfig

RESULTS_BACKEND = RedisCache(
      host=env("REDIS_HOST"),
      port=env("REDIS_PORT"),
      key_prefix="superset_results"
)

## This needs to match the name of the environment variable on your application settings on restack console

SECRET_KEY= env("SUPERSET_SECRET_KEY")

## Custom configuration and overrides // Add your configuration below
## https://superset.apache.org/docs/installation/configuring-superset

# Feature flags
# https://superset.apache.org/docs/installation/configuring-superset#feature-flags

FEATURE_FLAGS = {
    "ALERTS_ATTACH_REPORTS": True,
    "ALLOW_ADHOC_SUBQUERY": True,
    "DASHBOARD_CROSS_FILTERS": True,
    "DASHBOARD_NATIVE_FILTERS": True,
    "DASHBOARD_RBAC": True,
    "DISABLE_LEGACY_DATASOURCE_EDITOR": True,
    "DRUID_JOINS": True,
    "EMBEDDABLE_CHARTS": True,
    "EMBEDDED_SUPERSET": True,
    "ENABLE_DND_WITH_CLICK_UX": True,
    "ENABLE_EXPLORE_DRAG_AND_DROP": True,
    "ENABLE_TEMPLATE_PROCESSING": True,
    "ENFORCE_DB_ENCRYPTION_UI": True,
    "ESCAPE_MARKDOWN_HTML": True,
    "LISTVIEWS_DEFAULT_CARD_VIEW": True,
    "SCHEDULED_QUERIES": True,
    "SQLLAB_BACKEND_PERSISTENCE": True,
    "SQL_VALIDATORS_BY_ENGINE": True,
    "THUMBNAILS": False,
    "THUMBNAILS_SQLA_LISTENERS": False,
    "ALERT_REPORTS": True,
    "ENABLE_JAVASCRIPT_CONTROLS": True,
    "DASHBOARD_NATIVE_FILTERS_SET": True,
    "SUPERSET_WEBSERVER_TIMEOUT": 300,
    "SQLLAB_PREVIEW_DB_TABLE": False,
    "TAGGING_SYSTEM": False
}


# Custom configuration and overrides // Add your configuration below
# https://superset.apache.org/docs/installation/configuring-superset

THUMBNAIL_CACHE_CONFIG: CacheConfig = {
    'CACHE_TYPE': 'redis',
    'CACHE_DEFAULT_TIMEOUT': 24*60*60*7,
    'CACHE_KEY_PREFIX': 'thumbnail_',
    'CACHE_REDIS_URL': f"redis://{env('REDIS_HOST')}:{env('REDIS_PORT')}/1"  # 'redis://redis:6379/1'
}

THUMBNAIL_SELENIUM_USER = "admin"
THUMBNAIL_EXECUTE_AS = [ExecutorType.CURRENT_USER, ExecutorType.SELENIUM]

# Replace {{ restack_application_short_id}} with your application ID
WEBDRIVER_BASEURL = "http://suj8msfw-superset:8088/"
# The base URL for the email report hyperlinks.
WEBDRIVER_BASEURL_USER_FRIENDLY = WEBDRIVER_BASEURL

PREVENT_UNSAFE_DB_CONNECTIONS = False

# To embed dashboards, uncomment the TALISMAN_CONFIG and add your Superset URL to "frame-ancestors".
# If you are deploying for the first time, just start your superset app and Restack will provision an URL for you.

TALISMAN_CONFIG = { "content_security_policy": {
"base-uri": ["'self'"],"default-src": ["'self'"], "img-src": [
      "'self'",
      "blob:",
      "data:",
      "https://apachesuperset.gateway.scarf.sh",
      "https://static.scarf.sh/",
],
"worker-src": ["'self'", "blob:"], "connect-src": [
      "'self'",
      "https://api.mapbox.com",
      "https://events.mapbox.com",
],
"object-src": "'none'", "style-src": [
"'self'",
      "'unsafe-inline'",
    ],
"script-src": ["'self'", "'strict-dynamic'"],
"frame-ancestors": "suj8msfw.clj5khk.gcp.restack.it"
},
"content_security_policy_nonce_in": ["script-src"], "force_https": False,
"session_cookie_secure": False,
}


# Data cache config
# https://superset.apache.org/docs/installation/cache/#fallback-metastore-cache

# Enable this will enable you to get additional headers when superset is running behind a load balancer
ENABLE_PROXY_FIX = True

# Enable CORS
ENABLE_CORS = True

# Allow CORS requests from a specific domain
CORS_OPTIONS = {
"supports_credentials": True,
"allow_headers": ["*"],
"resources": ["*"],
"origins": ["*"] # Replace this with a list of the domains you want to enable
}

# Superset specific config
ROW_LIMIT = 5000

# Flask-WTF flag for CSRF
WTF_CSRF_ENABLED = False
TALISMAN_ENABLED=False

# Add endpoints that need to be exempt from CSRF protection
WTF_CSRF_EXEMPT_LIST = ["/api/v1/security/guest_token/"]

# A CSRF token that expires in 1 year
WTF_CSRF_TIME_LIMIT = 60 * 60 * 24 * 365

# Set an API key to enable Mapbox visualizations
MAPBOX_API_KEY = env("MAPBOX_API_KEY")

# For allowing anonymous users to see specific Dashboards
# AUTH_ROLE_PUBLIC = "Public"
# PUBLIC_ROLE_LIKE = "Restricted Gamma Public Access"
PUBLIC_ROLE_LIKE = "Gamma"

GUEST_ROLE_NAME = "Guest"

# To facilitate iFrame embedding of public dashboard
# SESSION_COOKIE_SAMESITE = "None"
# SESSION_COOKIE_SECURE = True
# SESSION_COOKIE_HTTPONLY = True

EXTRA_CATEGORICAL_COLOR_SCHEMES = [
    {
        "id": 'BI_Vision_Colour_scheme',
        "description": '',
        "label": 'BI Vision Chart Colours',
        "isDefault": True,
        "colors":
         ['#181932', '#F68818', '#4373A5', '#E2A607', '#D06F57', '#A476B4', '#6EC5CD',
         '#8CCCBB', '#9397CA', '#ECF2F9', '#9798A4', '#2D3165']
    }]
