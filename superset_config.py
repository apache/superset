import logging
import os

from cachelib.redis import RedisCache
from superset.superset_typing import CacheConfig
from celery.schedules import crontab
from superset.tasks.types import ExecutorType

logger = logging.getLogger()

SQLALCHEMY_TRACK_MODIFICATIONS = True

DATABASE_DIALECT = os.getenv("DATABASE_DIALECT")
DATABASE_USER = os.getenv("DATABASE_USER")
DATABASE_PASSWORD = os.getenv("DATABASE_PASSWORD")
DATABASE_HOST = os.getenv("DATABASE_HOST")
DATABASE_PORT = os.getenv("DATABASE_PORT")
DATABASE_DB = os.getenv("DATABASE_DB")

WEBDRIVER_BASEURL = os.getenv("WEBDRIVER_BASEURL", "http://test-euw2-superset.test-euw2-cluster:8088/")
FRAME_ANCESTORS = os.getenv("FRAME_ANCESTORS", "test-euw2-dashboards.preprod.brokerinsights.com")

# The SQLAlchemy connection string.
SQLALCHEMY_DATABASE_URI = (
    f"{DATABASE_DIALECT}://"
    f"{DATABASE_USER}:{DATABASE_PASSWORD}@"
    f"{DATABASE_HOST}:{DATABASE_PORT}/{DATABASE_DB}"
)

SQLALCHEMY_EXAMPLES_URI = SQLALCHEMY_DATABASE_URI # WP: is that necessary to even have that defined ?

REDIS_HOST = os.getenv("REDIS_HOST", "redis")
REDIS_PORT = os.getenv("REDIS_PORT", "6379")
REDIS_CELERY_DB = os.getenv("REDIS_CELERY_DB", "0")
REDIS_RESULTS_DB = os.getenv("REDIS_RESULTS_DB", "1")

RESULTS_BACKEND = RedisCache(
    host=REDIS_HOST,
    port=REDIS_PORT,
    key_prefix="superset_results"
)

CACHE_CONFIG = {
    "CACHE_TYPE": "RedisCache",
    "CACHE_DEFAULT_TIMEOUT": 300,
    "CACHE_KEY_PREFIX": "superset_",
    "CACHE_REDIS_HOST": REDIS_HOST,
    "CACHE_REDIS_PORT": REDIS_PORT,
    "CACHE_REDIS_DB": REDIS_RESULTS_DB,
}
DATA_CACHE_CONFIG = CACHE_CONFIG

class CeleryConfig:
    broker_url = f"redis://{REDIS_HOST}:{REDIS_PORT}/{REDIS_CELERY_DB}"
    imports = (
        "superset.sql_lab",
        "superset.tasks.scheduler",
        "superset.tasks.thumbnails",
        "superset.tasks.cache",
    )
    result_backend = f"redis://{REDIS_HOST}:{REDIS_PORT}/{REDIS_RESULTS_DB}"
    worker_prefetch_multiplier = 1
    task_acks_late = False
    beat_schedule = {
        "reports.scheduler": {
            "task": "reports.scheduler",
            "schedule": crontab(minute="*", hour="*"),
        },
        "reports.prune_log": {
            "task": "reports.prune_log",
            "schedule": crontab(minute=10, hour=0),
        },
    }


CELERY_CONFIG = CeleryConfig


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
## wp - cut this off ?
#ALERT_REPORTS_NOTIFICATION_DRY_RUN = True
# The base URL for the email report hyperlinks.
#SQLLAB_CTAS_NO_LIMIT = True
# endo


# Custom configuration and overrides // Add your configuration below
# https://superset.apache.org/docs/installation/configuring-superset

THUMBNAIL_CACHE_CONFIG: CacheConfig = {
    'CACHE_TYPE': 'redis',
    'CACHE_DEFAULT_TIMEOUT': 24*60*60*7,
    'CACHE_KEY_PREFIX': 'thumbnail_',
    'CACHE_REDIS_URL': f"redis://{REDIS_HOST}:{REDIS_PORT}/{REDIS_RESULTS_DB}"
}

THUMBNAIL_SELENIUM_USER = "admin"
THUMBNAIL_EXECUTE_AS = [ExecutorType.CURRENT_USER, ExecutorType.SELENIUM]

WEBDRIVER_BASEURL_USER_FRIENDLY = WEBDRIVER_BASEURL

PREVENT_UNSAFE_DB_CONNECTIONS = False

# To embed dashboards, uncomment the TALISMAN_CONFIG and add your Superset URL to "frame-ancestors".
# If you are deploying for the first time, just start your superset app and Restack will provision an URL for you.

TALISMAN_CONFIG = {
    "content_security_policy": {
        "base-uri": ["'self'"],
        "default-src": ["'self'"],
        "img-src": [
          "'self'",
          "blob:",
          "data:",
          "https://apachesuperset.gateway.scarf.sh",
          "https://static.scarf.sh/",
        ],
        "worker-src": ["'self'", "blob:"],
        "connect-src": [
              "'self'",
              "https://api.mapbox.com",
              "https://events.mapbox.com",
        ],
        "object-src": "'none'",
        "style-src": [
            "'self'",
            "'unsafe-inline'",
        ],
        "script-src": ["'self'", "'strict-dynamic'"],
        "frame-ancestors": FRAME_ANCESTORS
    },
    "content_security_policy_nonce_in": ["script-src"],
    "force_https": False, # WP: TODO: env it out or simply fix ?
    "session_cookie_secure": False, # WP: TODO: env it out or simply fix ?
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
MAPBOX_API_KEY = os.getenv("MAPBOX_API_KEY")

# For allowing anonymous users to see specific Dashboards
# AUTH_ROLE_PUBLIC = "Public"
# PUBLIC_ROLE_LIKE = "Restricted Gamma Public Access"
PUBLIC_ROLE_LIKE = "Gamma"

GUEST_ROLE_NAME = "Guest"

# To facilitate iFrame embedding of public dashboard
# SESSION_COOKIE_SAMESITE = "None"
# SESSION_COOKIE_SECURE = True
# SESSION_COOKIE_HTTPONLY = True

EXTRA_CATEGORICAL_COLOR_SCHEMES = [{
    "id": 'BI_Vision_Colour_scheme',
    "description": '',
    "label": 'BI Vision Chart Colours',
    "isDefault": True,
    "colors": ['#181932', '#F68818', '#4373A5', '#E2A607', '#D06F57', '#A476B4', '#6EC5CD', '#8CCCBB', '#9397CA', '#ECF2F9', '#9798A4', '#2D3165']
}]

# WP TODO: add other caches and review warnings:
# FILTER_STATE_CACHE_CONFIG = {
#     'CACHE_TYPE': 'RedisCache',
#     'CACHE_DEFAULT_TIMEOUT': 86400,
#     'CACHE_KEY_PREFIX': 'superset_filter_',
#     'CACHE_REDIS_URL': 'redis://localhost:6379/2'
# }

#FIX yet untested:
RATELIMIT_STORAGE_URI = f"redis://{REDIS_HOST}:{REDIS_PORT}"
# logs:
# sr/local/lib/python3.10/site-packages/flask_limiter/extension.py:333: UserWarning: Using the in-memory storage for tracking rate limits as no storage was explicitly specified. This is not recommended for production use. See: https://flask-limiter.readthedocs.io#configuring-a-storage-backend for documentation about configuring the storage backend.
#    warnings.warn(
#  2024-12-09 21:47:58,154:ERROR:flask_appbuilder.securit

# also getting that all the time: superset redis.exceptions.ResponseError: invalid expire time in 'setex' command suggesting we try to set redis expiry to 0 ?
#
# 2024-12-09 22:52:26,815:WARNING:superset.utils.log:invalid expire time in 'setex' command
# Traceback (most recent call last):
#   File "/app/superset/commands/database/tables.py", line 62, in run
#     self._model.get_all_table_names_in_schema(
#   File "/app/superset/utils/cache.py", line 139, in wrapped_f
#     cache.set(cache_key, obj, timeout=cache_timeout)
#   File "/usr/local/lib/python3.10/site-packages/flask_caching/__init__.py", line 203, in set
#     return self.cache.set(*args, **kwargs)
#   File "/usr/local/lib/python3.10/site-packages/cachelib/redis.py", line 87, in set
#     result = self._write_client.setex(
#   File "/usr/local/lib/python3.10/site-packages/redis/commands/core.py", line 2353, in setex
#     return self.execute_command("SETEX", name, time, value)
#   File "/usr/local/lib/python3.10/site-packages/redis/client.py", line 1269, in execute_command
#     return conn.retry.call_with_retry(
#   File "/usr/local/lib/python3.10/site-packages/redis/retry.py", line 46, in call_with_retry
#     return do()
#   File "/usr/local/lib/python3.10/site-packages/redis/client.py", line 1270, in <lambda>
#     lambda: self._send_command_parse_response(
#   File "/usr/local/lib/python3.10/site-packages/redis/client.py", line 1246, in _send_command_parse_response
#     return self.parse_response(conn, command_name, **options)
#   File "/usr/local/lib/python3.10/site-packages/redis/client.py", line 1286, in parse_response
#     response = connection.read_response()
#   File "/usr/local/lib/python3.10/site-packages/redis/connection.py", line 905, in read_response
#     raise response
# redis.exceptions.ResponseError: invalid expire time in 'setex' command


# potentially useful read:
