# superset_config.py
import os
import datetime
import logging
import json
import traceback
from flask import request, redirect, url_for, g
from superset.security import SupersetSecurityManager
from custom_security.hybrid_azure_manager import HybridAzureSecurityManager
from flask_jwt_extended import decode_token

# redis and celery
import os
from cachelib.redis import RedisCache
 
# Setup logging
logging.basicConfig(
    level=logging.DEBUG,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logging.getLogger('flask_jwt_extended').setLevel(logging.DEBUG)
logging.getLogger('jwt').setLevel(logging.DEBUG)
logging.getLogger('superset').setLevel(logging.DEBUG)
logging.getLogger('werkzeug').setLevel(logging.DEBUG)
jwt_logger = logging.getLogger('superset.jwt')
jwt_logger.setLevel(logging.DEBUG)
 
# Set SECRET_KEY
SECRET_KEY = os.getenv("SUPERSET_SECRET_KEY")

def FLASK_APP_MUTATOR(app):
    @app.before_request
    def handle_proof_token():
        # Only process proof tokens if user is not already authenticated
        if hasattr(g, 'user') and g.user and g.user.is_authenticated:
            return
            
        proof_token = request.args.get('proof')
        if proof_token:
            try:
                logging.critical(f"[Proof Token] Processing proof token: {proof_token[:50]}...")
                sm = app.appbuilder.sm
                
                # Use auth_user_jwt to authenticate with proof token
                user = sm.auth_user_jwt(proof_token)
                
                if user:
                    from flask_login import login_user
                    login_user(user, remember=True)
                    logging.critical(f"[Proof Token] User authenticated: {user.username}")
                else:
                    logging.error(f"[Proof Token] Authentication failed for token")
                    
            except Exception as e:
                logging.error(f"[Proof Token] Error processing proof token: {str(e)}")
                logging.error(f"[Proof Token] Traceback: {traceback.format_exc()}")

    if hasattr(app, 'config') and 'AZURE_SQL_ENGINE' in globals() and AZURE_SQL_ENGINE:
        app.config['AZURE_SQL_ENGINE'] = AZURE_SQL_ENGINE
        logging.info("Azure SQL Engine added to Flask app config")

from flask import g
from flask_login import login_user
import traceback

if not os.getenv("AZURE_TENANT_ID"):
    try:
        with open('/app/.env_azure', 'r') as f:
            for line in f:
                if '=' in line and not line.startswith('#'):
                    key, value = line.strip().split('=', 1)
                    os.environ[key] = value
        logging.info("Loaded Azure environment variables from /app/.env_azure")
    except FileNotFoundError:
        logging.warning("Azure environment file not found, using defaults")
    except Exception as e:
        logging.error(f"Error loading Azure environment: {e}")
#----------------TODO: Remove hard coded values after testing is complete ---------------------
AZURE_TENANT_ID = os.getenv("AZURE_TENANT_ID")
AZURE_CLIENT_ID = os.getenv("AZURE_CLIENT_ID", "39ad4e02-9a76-4464-810b-eac74dbc0950")
AZURE_CLIENT_SECRET = os.getenv("AZURE_CLIENT_SECRET")
AZURE_AUDIENCE = os.getenv("AZURE_AUDIENCE", "api://39ad4e02-9a76-4464-810b-eac74dbc0950")
AZURE_SQL_CONNECTION_STRING = os.getenv("AZURE_SQL_CONNECTION_STRING")
AZURE_SQL_ENGINE = None
if AZURE_SQL_CONNECTION_STRING:
    import sqlalchemy as sa
    AZURE_SQL_ENGINE = sa.create_engine(
        AZURE_SQL_CONNECTION_STRING,
        pool_size=10,
        max_overflow=5,
        pool_pre_ping=True,
        pool_recycle=3600
    )
    logging.info(f"Azure SQL Engine configured for: {AZURE_SQL_CONNECTION_STRING.split('@')[1].split('/')[0]}")

SQLALCHEMY_DATABASE_URI = os.getenv("SUPERSET_DB_URI")
if not SQLALCHEMY_DATABASE_URI:
    DATABASE_DIALECT = os.getenv("DATABASE_DIALECT")
    DATABASE_USER = os.getenv("DATABASE_USER")
    DATABASE_PASSWORD = os.getenv("DATABASE_PASSWORD")
    DATABASE_HOST = os.getenv("DATABASE_HOST")
    DATABASE_PORT = os.getenv("DATABASE_PORT")
    DATABASE_DB = os.getenv("DATABASE_DB")
    
    if DATABASE_DIALECT and DATABASE_USER and DATABASE_PASSWORD and DATABASE_HOST and DATABASE_PORT and DATABASE_DB:
        SQLALCHEMY_DATABASE_URI = (
            f"{DATABASE_DIALECT}://"
            f"{DATABASE_USER}:{DATABASE_PASSWORD}@"
            f"{DATABASE_HOST}:{DATABASE_PORT}/{DATABASE_DB}"
        )
    else:
        raise ValueError("Either SUPERSET_DB_URI or all DATABASE_* environment variables are required!")

REDIS_HOST = os.getenv("REDIS_HOST", "localhost")
REDIS_PORT = int(os.getenv("REDIS_PORT", 6379))
REDIS_CELERY_DB = int(os.getenv("REDIS_CELERY_DB", 0))
REDIS_RESULTS_DB = int(os.getenv("REDIS_RESULTS_DB", 1))
REDIS_CACHE_DB = int(os.getenv("REDIS_CACHE_DB", 2))

RESULTS_BACKEND = RedisCache(
    host=REDIS_HOST,
    port=REDIS_PORT,
    db=REDIS_RESULTS_DB,
    key_prefix='superset_results'
)

CACHE_CONFIG = {
    'CACHE_TYPE': 'RedisCache',
    'CACHE_DEFAULT_TIMEOUT': 86400,  # 24 hours
    'CACHE_KEY_PREFIX': 'superset_',
    'CACHE_REDIS_HOST': REDIS_HOST,
    'CACHE_REDIS_PORT': REDIS_PORT,
    'CACHE_REDIS_DB': REDIS_CACHE_DB,
}

class CeleryConfig:
    broker_url = f"redis://{REDIS_HOST}:{REDIS_PORT}/{REDIS_CELERY_DB}"
    imports = (
        "superset.sql_lab",
        "superset.tasks.thumbnails",
    )
    result_backend = f"redis://{REDIS_HOST}:{REDIS_PORT}/{REDIS_RESULTS_DB}"
    task_annotations = {
        "sql_lab.get_sql_results": {
            "rate_limit": "100/s",
        },
    }
    beat_schedule = {
        "reports.scheduler": {
            "task": "reports.scheduler",
            "schedule": 60.0,
        },
        "reports.prune_log": {
            "task": "reports.prune_log",
            "schedule": 3600.0,  # Every hour
        },
    }

CELERY_CONFIG = CeleryConfig

WEBDRIVER_BASEURL_USER_FRIENDLY = os.getenv("SUPERSET_WEBSERVER_PROTOCOL", "http") + "://" + os.getenv("SUPERSET_WEBSERVER_ADDRESS", "localhost") + ":" + str(os.getenv("SUPERSET_WEBSERVER_PORT", 8088))
WEBDRIVER_BASEURL = WEBDRIVER_BASEURL_USER_FRIENDLY

# Language settings
LANGUAGES = {
    'en': {'flag': 'us', 'name': 'English'},
    'es': {'flag': 'es', 'name': 'Spanish'},
    'fr': {'flag': 'fr', 'name': 'French'},
    'zh': {'flag': 'cn', 'name': 'Chinese'},
    'ja': {'flag': 'jp', 'name': 'Japanese'},
    'de': {'flag': 'de', 'name': 'German'},
    'pt': {'flag': 'pt', 'name': 'Portuguese'},
    'pt_BR': {'flag': 'br', 'name': 'Brazilian Portuguese'},
    'ru': {'flag': 'ru', 'name': 'Russian'},
    'ko': {'flag': 'kr', 'name': 'Korean'},
}

DEFAULT_SQLLAB_LIMIT = 1000
SQL_MAX_ROW = 100000
SQLLAB_ASYNC_TIME_LIMIT_SEC = 300  # 5 minutes
SQLLAB_TIMEOUT = 300
GUEST_ROLE_NAME = "Gamma"
GUEST_TOKEN_JWT_SECRET = SECRET_KEY
GUEST_TOKEN_JWT_ALGO = "HS256"
GUEST_TOKEN_HEADER_NAME = "X-GuestToken"
GUEST_TOKEN_JWT_EXP_SECONDS = 300  # 5 minutes

SMTP_HOST = os.getenv("SMTP_HOST")
SMTP_STARTTLS = True
SMTP_SSL = False
SMTP_USER = os.getenv("SMTP_USER")
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD")
SMTP_PORT = int(os.getenv("SMTP_PORT", 587))
SMTP_MAIL_FROM = os.getenv("SMTP_MAIL_FROM")

# Security settings
WTF_CSRF_ENABLED = True
WTF_CSRF_EXEMPT_LIST = []
WTF_CSRF_TIME_LIMIT = None

# Mapbox (for mapping visualizations)
MAPBOX_API_KEY = os.getenv("MAPBOX_API_KEY")

# Modern Authentication Configuration
AUTH_TYPE = 1  # Flask-AppBuilder AUTH_DB
JWT_IDENTITY_CLAIM = 'username'  # Only JWT setting needed by HybridAzureSecurityManager

# Use Hybrid Azure Security Manager for WordPress integration
CUSTOM_SECURITY_MANAGER = HybridAzureSecurityManager

# Set feature flags (enable the use of async queries, Dashboard RBAC)
FEATURE_FLAGS = {
    'ENABLE_TEMPLATE_PROCESSING': True,  # Enables Jinja templating
    'ALLOW_RUN_ASYNC': True,  # Enables async queries
    'DASHBOARD_RBAC': True, # Enables dashboard-level permissions
    "HORIZONTAL_FILTER_BAR": True # Enables switching of dashboard filters from left side to top
}
 
# Utility functions for Jinja templating
def yesterday_date():
    import datetime
    return (datetime.datetime.now() - datetime.timedelta(days=1)).strftime('%Y-%m-%d')

# Configuration validation logging (keep essential logs for staging testing)
logger = logging.getLogger(__name__)
logger.info(f"Superset SECRET_KEY: {'✓ Configured' if SECRET_KEY else '❌ Missing'}")
logger.info(f"Database URI: {'✓ Configured' if SQLALCHEMY_DATABASE_URI else '❌ Missing'}")
logger.info(f"Azure Tenant: {AZURE_TENANT_ID[:8]}..." if AZURE_TENANT_ID else "❌ Missing")
logger.info(f"Azure Client ID: {AZURE_CLIENT_ID[:8]}..." if AZURE_CLIENT_ID else "❌ Missing")
logger.info(f"Azure Client Secret: {'✓ Configured' if AZURE_CLIENT_SECRET else '❌ Missing'}")
logger.info(f"Azure SQL Connection: {'✓ Configured' if AZURE_SQL_CONNECTION_STRING else '❌ Missing'}")