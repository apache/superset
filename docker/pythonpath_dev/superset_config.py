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
#
# This file is included in the final Docker image and SHOULD be overridden when
# deploying the image to prod. Settings configured here are intended for use in local
# development environments. Also note that superset_config_docker.py is imported
# as a final step as a means to override "defaults" configured here
#
import logging
import os

import json
from datetime import timedelta
from celery.schedules import crontab
from flask_caching.backends.filesystemcache import FileSystemCache
from superset.tasks.types import ExecutorType
from superset.superset_typing import CacheConfig

#auth libs
from superset.superset_typing import CacheConfig
from superset.tasks.types import ExecutorType
from custom_sso_security_manager import CustomSsoSecurityManager
CUSTOM_SECURITY_MANAGER = CustomSsoSecurityManager
from flask_appbuilder.security.manager import AUTH_OAUTH
#

logger = logging.getLogger()

DATABASE_DIALECT = os.getenv("DATABASE_DIALECT")
DATABASE_USER = os.getenv("DATABASE_USER")
DATABASE_PASSWORD = os.getenv("DATABASE_PASSWORD")
DATABASE_HOST = os.getenv("DATABASE_HOST")
DATABASE_PORT = os.getenv("DATABASE_PORT")
DATABASE_DB = os.getenv("DATABASE_DB")

EXAMPLES_USER = os.getenv("EXAMPLES_USER")
EXAMPLES_PASSWORD = os.getenv("EXAMPLES_PASSWORD")
EXAMPLES_HOST = os.getenv("EXAMPLES_HOST")
EXAMPLES_PORT = os.getenv("EXAMPLES_PORT")
EXAMPLES_DB = os.getenv("EXAMPLES_DB")

COLOR_SCHEMES = os.getenv("COLOR_SCHEMES")

# Read the environment variable
oauth2_providers = os.getenv('OAUTH2_PROVIDERS')

# Split the string into an array
if oauth2_providers:
    oauth2_provider_array = oauth2_providers.split(',')
else:
    oauth2_provider_array = []

# Google credentials
GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID")
GOOGLE_CLIENT_SECRET = os.getenv("GOOGLE_CLIENT_SECRET")

# Azure credentials
AZURE_ENTRA_CLIENT_ID = os.getenv("AZURE_ENTRA_CLIENT_ID")
AZURE_ENTRA_CLIENT_SECRET = os.getenv("AZURE_ENTRA_CLIENT_SECRET")
AZURE_ENTRA_TENANT_ID = os.getenv("AZURE_ENTRA_TENANT_ID")

AUTH0_CLIENT_ID = os.getenv("AUTH0_CLIENT_ID")
AUTH0_CLIENT_SECRET = os.getenv("AUTH0_CLIENT_SECRET")
AUTH0_DOMAIN = os.getenv("AUTH0_DOMAIN")

DOMAIN_WHITELIST = json.loads(os.getenv("AUTH_USER_DOMAIN_WHITELIST"))

CORS_FRONTEND_ORIGIN = os.getenv("CORS_FRONTEND_ORIGIN")


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

REDIS_HOST = os.getenv("REDIS_HOST", "superset_cache")
REDIS_PORT = os.getenv("REDIS_PORT", "6379")
REDIS_CELERY_DB = os.getenv("REDIS_CELERY_DB", "0")
REDIS_RESULTS_DB = os.getenv("REDIS_RESULTS_DB", "1")

RESULTS_BACKEND = FileSystemCache("/app/superset_home/sqllab")

CACHE_CONFIG = {
    "CACHE_TYPE": "RedisCache",
    "CACHE_DEFAULT_TIMEOUT": 86400,
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
    task_annotations = {
        "sql_lab.get_sql_results": {"rate_limit": "100/s"},
        "email_reports.send": {"rate_limit": "1/s", "time_limit": 120, "soft_time_limit": 150},
        "reports.scheduler": {"rate_limit": "1/s"},
    }    
    worker_prefetch_multiplier = 1
    task_acks_late = False
    beat_schedule = {
        "reports.scheduler": {
            "task": "reports.scheduler",
            "schedule": crontab(minute="0", hour="*"),
        },
        "reports.prune_log": {
            "task": "reports.prune_log",
            "schedule": crontab(minute=10, hour=0),
        },
    }


CELERY_CONFIG = CeleryConfig

FEATURE_FLAGS = {
    "ALERT_REPORTS": True, 
    "KV_STORE": True,
    "SCHEDULED_QUERIES": True,    
    "EMBEDDED_SUPERSET": True, 
    "TAGGING_SYSTEM": True, 
    "THUMBNAILS": True,
    "THUMBNAILS_SQLA_LISTENERS": True,
    "DASHBOARD_RBAC": True,
    "ENABLE_TEMPLATE_PROCESSING": True,
    "DASHBOARD_VIRTUALIZATION": False,
    "HORIZONTAL_FILTER_BAR": True
}


THUMBNAIL_SELENIUM_USER = "admin"
THUMBNAIL_EXECUTE_AS = [ExecutorType.SELENIUM]

THUMBNAIL_CACHE_CONFIG: CacheConfig = {
    'CACHE_TYPE': 'redis',
    'CACHE_DEFAULT_TIMEOUT': 24*60*60*7,
    'CACHE_KEY_PREFIX': 'thumbnail_',
    'CACHE_REDIS_URL': 'redis://superset_cache:6379/1'
}
SCREENSHOT_LOCATE_WAIT=int(timedelta(seconds=120).total_seconds())

FAB_API_MAX_PAGE_SIZE = 500


ALERT_REPORTS_NOTIFICATION_DRY_RUN = True
WEBDRIVER_BASEURL = "http://superset_app:8088/"
# The base URL for the email report hyperlinks.
WEBDRIVER_BASEURL_USER_FRIENDLY = WEBDRIVER_BASEURL

# Async query configuration
SQLLAB_ASYNC_TIME_LIMIT_SEC = 60 * 60 * 6
SQLLAB_CTAS_NO_LIMIT = True
SQLLAB_TIMEOUT = 300


TALISMAN_ENABLED = False
GUEST_ROLE_NAME = "Guest"

##############################################33
# Set the authentication type to OAuth
AUTH_TYPE = AUTH_OAUTH


ENABLE_PROXY_FIX = True
AUTH_USER_REGISTRATION = True
AUTH_USER_REGISTRATION_ROLE = "Guest"
PUBLIC_ROLE_LIKE = "Datakimia_Public" 
AUTH_USER_REGISTRATION_ROLE_JMESPATH = "contains(['lautaro@datakimia.com', 'tomas@datakimia.com', 'juanm@datakimia.com', 'nadia@datakimia.com', 'luciano@datakimia.com'], email) && 'Admin' || 'Guest'"


GOOGLE_PROVIDER = {
    'name': 'google',
    'icon': 'fa-google',
    'token_key': 'access_token',
    'remote_app': {
        'api_base_url': 'https://www.googleapis.com/oauth2/v2/',
        'client_kwargs': {
            'scope': 'email profile'
        },
        'request_token_url': None,
        'access_token_url': 'https://accounts.google.com/o/oauth2/token',
        'authorize_url': 'https://accounts.google.com/o/oauth2/auth',
        'client_id': GOOGLE_CLIENT_ID,
        'client_secret': GOOGLE_CLIENT_SECRET
    }
}

if DOMAIN_WHITELIST:
    GOOGLE_PROVIDER['whitelist'] = DOMAIN_WHITELIST

AZURE_PROVIDER =     {
        'name': 'azure',
        'icon': 'fa-windows',
        'token_key': 'access_token',
        'remote_app': {
            'client_id': AZURE_ENTRA_CLIENT_ID,
            'client_secret': AZURE_ENTRA_CLIENT_SECRET,
            'api_base_url': f'https://login.microsoftonline.com/{AZURE_ENTRA_TENANT_ID}/oauth2',
            'client_kwargs': {
                'scope': 'openid email profile',
                'resource': AZURE_ENTRA_CLIENT_ID,
            },
            'request_token_url': None,
            'access_token_url': f'https://login.microsoftonline.com/{AZURE_ENTRA_TENANT_ID}/oauth2/token',
            'authorize_url': f'https://login.microsoftonline.com/{AZURE_ENTRA_TENANT_ID}/oauth2/authorize',
            'jwks_uri': f'https://login.microsoftonline.com/{AZURE_ENTRA_TENANT_ID}/discovery/v2.0/keys',
        }
    }

if DOMAIN_WHITELIST:
    AZURE_PROVIDER['whitelist'] = DOMAIN_WHITELIST


AUTH0_PROVIDER =     {
        'name': 'auth0',
        'token_key': 'access_token',
        'icon': 'fa-star',
        'remote_app': {
            'client_id': AUTH0_CLIENT_ID,
            'client_secret': AUTH0_CLIENT_SECRET,
            'client_kwargs': {
                'scope': 'openid profile email',
            },
            'access_token_url': f'{AUTH0_DOMAIN}/oauth/token',
            'authorize_url': f'{AUTH0_DOMAIN}/authorize',
            'api_base_url': f'{AUTH0_DOMAIN}',
            'client_kwargs': {
                'scope': 'openid profile email',
            },
            'jwks_uri':f'{AUTH0_DOMAIN}/.well-known/jwks.json',
            'userinfo_endpoint':'{AUTH0_DOMAIN}/userinfo'            
        }
    }

if DOMAIN_WHITELIST:
    AUTH0_PROVIDER['whitelist'] = DOMAIN_WHITELIST

PROVIDERS = {
    'google': GOOGLE_PROVIDER,
    'azure': AZURE_PROVIDER,
    'auth0': AUTH0_PROVIDER
}

# Add configured providers
OAUTH_PROVIDERS = []
for key in oauth2_provider_array:
    if key in PROVIDERS:
        OAUTH_PROVIDERS.append(PROVIDERS[key])

# Enable CORS 
ENABLE_CORS = True
CORS_OPTIONS = {   # Replace with your frontend domain(s)
    'origins': [
        CORS_FRONTEND_ORIGIN
    ],
    'supports_credentials': True,
    "allow_headers": ["*"],
    "resources": ["*"],
}

HTTP_HEADERS = {"X-Frame-Options": "ALLOWALL"} 
FAB_ADD_SECURITY_API = True

# Flask-WTF flag for CSRF 
WTF_CSRF_ENABLED = False

# Add endpoints that need to be exempt from CSRF protection
WTF_CSRF_EXEMPT_LIST = ["/login/google"]

# A CSRF token that expires in 1 year 
WTF_CSRF_TIME_LIMIT = 60 * 60 * 24 * 365

##############################################3end auth

### this is used together with the command "superset re-encrypt-secrets"
#PREVIOUS_SECRET_KEY="TEST_NON_DEV_SECRET"
#SECRET_KEY="+DLoS9mlyLGxgUIP5QcM1/8IxVB0AG4GCdhDD2uSaQZAgfxwaVL7uO7f"
######


######

EXTRA_CATEGORICAL_COLOR_SCHEMES = json.loads(COLOR_SCHEMES)


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


