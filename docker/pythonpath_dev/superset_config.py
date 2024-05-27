import logging
import os

from celery.schedules import crontab
from flask_caching.backends.rediscache import RedisCache

logger = logging.getLogger()

DATABASE_DIALECT = os.getenv("DATABASE_DIALECT", "mysql")
DATABASE_USER = os.getenv("DATABASE_USER", "superset")
DATABASE_PASSWORD = os.getenv("DATABASE_PASSWORD", "superset")
DATABASE_HOST = os.getenv("DATABASE_HOST", "db")
DATABASE_PORT = os.getenv("DATABASE_PORT", "3306")
DATABASE_DB = os.getenv("DATABASE_DB", "superset")

EXAMPLES_USER = os.getenv("EXAMPLES_USER", "examples")
EXAMPLES_PASSWORD = os.getenv("EXAMPLES_PASSWORD", "examples")
EXAMPLES_HOST = os.getenv("EXAMPLES_HOST", "db")
EXAMPLES_PORT = os.getenv("EXAMPLES_PORT", "5432")
EXAMPLES_DB = os.getenv("EXAMPLES_DB", "examples")

# The SQLAlchemy connection string.
SQLALCHEMY_DATABASE_URI = (
    f"{DATABASE_DIALECT}://"
    f"{DATABASE_USER}:{DATABASE_PASSWORD}@"
    f"{DATABASE_HOST}:{DATABASE_PORT}/{DATABASE_DB}"
)

SQLALCHEMY_EXAMPLES_URI = (
    f"{DATABASE_DIALECT}://"
    f"{EXAMPLES_USER}:{EXAMPLES_PASSWORD}@"
    f"{EXAMPLES_HOST}:{EXAMPLES_PORT}/{EXAMPLES_DB}"
)

REDIS_HOST = os.getenv("REDIS_HOST", "redis")
REDIS_PORT = os.getenv("REDIS_PORT", "6379")
REDIS_CELERY_DB = os.getenv("REDIS_CELERY_DB", "0")
REDIS_RESULTS_DB = os.getenv("REDIS_RESULTS_DB", "1")

RESULTS_BACKEND = RedisCache(host=REDIS_HOST, port=REDIS_PORT, key_prefix='superset_results')

CACHE_CONFIG = {
    "CACHE_TYPE": "RedisCache",
    "CACHE_DEFAULT_TIMEOUT": 172800,  # 48h
    "CACHE_KEY_PREFIX": "superset_",
    "CACHE_REDIS_HOST": REDIS_HOST,
    "CACHE_REDIS_PORT": REDIS_PORT,
    "CACHE_REDIS_DB": REDIS_RESULTS_DB,
}
DATA_CACHE_CONFIG = CACHE_CONFIG


class CeleryConfig:
    broker_url = f"redis://{REDIS_HOST}:{REDIS_PORT}/{REDIS_CELERY_DB}"
    imports = ("superset.sql_lab", "superset.tasks")
    result_backend = f"redis://{REDIS_HOST}:{REDIS_PORT}/{REDIS_RESULTS_DB}"
    worker_prefetch_multiplier = 10
    task_acks_late = True
    worker_log_level = "DEBUG"
    task_annotations = {
        'sql_lab.get_sql_results': {
            'rate_limit': '100/s',
        },
        'reports.send': {
            'rate_limit': '1/s',
            'time_limit': 120,
            'soft_time_limit': 150,
            'ignore_result': True,
        },
    }
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

SQLLAB_CTAS_NO_LIMIT = True

# reports
ALERT_REPORTS_NOTIFICATION_DRY_RUN = False
WEBDRIVER_BASEURL = "http://superset:8088/"
WEBDRIVER_BASEURL_USER_FRIENDLY = os.getenv("WEBDRIVER_BASEURL_USER_FRIENDLY", "http://localhost:8088/")
SLACK_API_TOKEN = os.getenv("SLACK_API_TOKEN", "")
SMTP_HOST = "smtp.mandrillapp.com"
SMTP_PORT = 587
SMTP_STARTTLS = False
SMTP_SSL_SERVER_AUTH = False
SMTP_SSL = False
SMTP_MAIL_FROM = "support@cloudadmin.io"
SMTP_USER = "CloudAdmin"
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD", "")

# custom config
GLOBAL_ASYNC_QUERIES_JWT_SECRET = "fhKfBi8hwNXBZmBsHtrCooxX3xT26SwnfhKfBi8hwNXBZmBsHtrCooxX3xT26Swn"
GLOBAL_ASYNC_QUERIES_POLLING_DELAY = 1500
GLOBAL_ASYNC_QUERIES_REDIS_CONFIG = {
    "port": REDIS_PORT,
    "host": REDIS_HOST,
    "password": "",
    "db": 0,
    "ssl": False,
}
GLOBAL_ASYNC_QUERIES_REDIS_STREAM_PREFIX = "async-events-"
GLOBAL_ASYNC_QUERIES_JWT_COOKIE_NAME = "async-token"
GLOBAL_ASYNC_QUERIES_JWT_COOKIE_SECURE = False

# security
ALLOW_ORIGINS = ["https://cloudadmin.io", "https://development.cloudadmin.io", "http://localhost:8001"]
ENABLE_CORS = True
CORS_OPTIONS = {
    "supports_credentials": True,
    "allow_headers": ["*"],
    "resources": ["*"],
    "origins": ALLOW_ORIGINS
}
TALISMAN_ENABLED = True
TALISMAN_CONFIG = {
    "content_security_policy": {
        "frame-ancestors": ALLOW_ORIGINS
    },
    "force_https": False,
    "force_https_permanent": False,
    "frame_options": "ALLOWFROM",
    "frame_options_allow_from": "*"
}
WTF_CSRF_ENABLED = False
WTF_CSRF_EXEMPT_LIST = [
    "superset.views.core.log",
    "superset.views.core.explore_json",
    "superset.charts.data.api.data",
    "superset.charts.data.api.refresh_cache",
    "superset.security.api.guest_token"
]
ENABLE_PROXY_FIX = True
GUEST_ROLE_NAME = "Public"
FEATURE_FLAGS = {
    "ENABLE_TEMPLATE_PROCESSING": True,
    "EMBEDDED_SUPERSET": True,
    "HORIZONTAL_FILTER_BAR": True,
    "GLOBAL_ASYNC_QUERIES": True,
    "DRILL_TO_DETAIL": False,
    "DRILL_BY": True,
    "ALERT_REPORTS": True
}
APP_ICON = "https://development.cloudadmin.io/static/logos/cloudadmin-logo-color@2x.png"
SUPERSET_LOAD_EXAMPLES = False

from security import CustomSecurityManager
CUSTOM_SECURITY_MANAGER = CustomSecurityManager

#
# Optionally import superset_config_docker.py (which will have been included on
# the PYTHONPATH) in order to allow for local settings to be overridden
#
try:
    import superset_config_docker
    from superset_config_docker import *  # noqa

    logger.info(
        f"Loaded your Docker configuration at " f"[{superset_config_docker.__file__}]"
    )
except ImportError:
    logger.info("Using default Docker config...")
