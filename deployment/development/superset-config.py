import os
from logging.handlers import RotatingFileHandler
from celery.schedules import crontab
from flask_caching.backends.rediscache import RedisCache
import json


#------------------ REDIS SETUP ---------------------

REDIS_HOST = os.getenv('REDIS_HOST')
REDIS_PORT = int(os.getenv('REDIS_PORT'))
REDIS_PASSWORD = os.getenv('REDIS_PASSWORD')
CACHE_CONFIG = {
    'CACHE_TYPE': 'RedisCache',
    'CACHE_DEFAULT_TIMEOUT': 86400,
    'CACHE_KEY_PREFIX': 'superset_cache_',
    'CACHE_REDIS_URL': f'redis://:{REDIS_PASSWORD}@{REDIS_HOST}:{REDIS_PORT}/5'
}
DATA_CACHE_CONFIG = CACHE_CONFIG
FILTER_STATE_CACHE_CONFIG = CACHE_CONFIG
EXPLORE_FORM_DATA_CACHE_CONFIG = CACHE_CONFIG

#-------------------- Postgres------------------------

POSTGRES_USER = os.getenv('POSTGRES_USER')
POSTGRES_PASSWORD = os.getenv('POSTGRES_PASSWORD')
POSTGRES_HOST = os.getenv('POSTGRES_HOST')
POSTGRES_PORT = os.getenv('POSTGRES_PORT')
POSTGRES_DB = os.getenv('POSTGRES_DB')

SQLALCHEMY_DATABASE_URI = 'postgresql://{0}:{1}@{2}:{3}/{4}'.format(
    POSTGRES_USER,
    POSTGRES_PASSWORD,
    POSTGRES_HOST,
    POSTGRES_PORT,
    POSTGRES_DB
)

#---------------DEBUGGING--------------------

DEBUG=True
LOG_LEVEL = 'DEBUG'

#----------------- Feature Flags ------------------
FEATURE_FLAGS = {
    "ALERT_REPORTS": True,
    "EMBEDDED_SUPERSET": True,
    "ENABLE_TEMPLATE_PROCESSING": True,
    "DRILL_TO_DETAIL": True,
    "ADHOC_DASHBOARD_NATIVE_FILTERS": True,
    "CHART_PLUGINS_EXPERIMENTAL": True,
    "DASHBOARD_VIRTUALIZATION": False
}

ALERT_REPORTS_NOTIFICATION_DRY_RUN = True
SQLLAB_CTAS_NO_LIMIT = True
# ------------------ Embedded Configurations --------------------

BASE_URL = os.getenv('SUPERSET_URL')
ALEX_BACKEND_URL = os.getenv('ALEX_BACKEND_URL')
FRONTEND_URL = os.getenv('FRONTEND_URL')
SECRET_KEY = os.getenv('SECRET_KEY')
SUPERSET_WEBSERVER_TIMEOUT = 300
ENABLE_PROXY_FIX = True
TALISMAN_ENABLED = False # since we our using embedded sdk, so we dont this option to embedded dashboard access.
OVERRIDE_HTTP_HEADERS = { "Content-Security-Policy": f"frame-ancestors {FRONTEND_URL}" }
GUEST_TOKEN_JWT_EXP_SECONDS = 1800
GUEST_ROLE_NAME = "Gamma"
WTF_CSRF_ENABLED = True
WTF_CSRF_TIME_LIMIT = 60 * 60 * 24 * 7
ENABLE_CORS = True

PUBLIC_PATH = "/superset/"
DEFAULT_URL = "/superset/"

CORS_OPTIONS = {
    "supports_credentials": True,
    "allow_headers": ["Content-Type", "Authorization"],
    "expose_headers": ["Content-Type", "Authorization"],
    "allow_methods": ["GET", "POST", "OPTIONS", "PUT", "DELETE"],
     'origins': [f'{ALEX_BACKEND_URL}']
}
    

#---------------- Custom Methods ---------------------------


def parse_url_param(param):
    try:
        arr = param.split(',')
        res = "('" + "', '".join(arr) + "')"
        return res
    except json.JSONDecodeError as e:
        print("ERROR: ",e.msg)
        return param
def to_int(value):
    try:
        return int(value)
    except (ValueError, TypeError):
        return value  # Return the original value if conversion fails

JINJA_CONTEXT_ADDONS = {
     'parse_url_param': parse_url_param,
     'to_int':to_int
}