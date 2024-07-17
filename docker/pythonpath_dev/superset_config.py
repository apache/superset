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
    "CACHE_DEFAULT_TIMEOUT": 300,
    "CACHE_KEY_PREFIX": "superset_",
    "CACHE_REDIS_HOST": REDIS_HOST,
    "CACHE_REDIS_PORT": REDIS_PORT,
    "CACHE_REDIS_DB": REDIS_RESULTS_DB,
}
DATA_CACHE_CONFIG = CACHE_CONFIG


class CeleryConfig:
    broker_url = f"redis://{REDIS_HOST}:{REDIS_PORT}/{REDIS_CELERY_DB}"
    imports = ("superset.sql_lab",)
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
    "ALERT_REPORTS": True, 
    "EMBEDDED_SUPERSET": True, 
    "TAGGING_SYSTEM": True, 
    "THUMBNAILS": True,
    "THUMBNAILS_SQLA_LISTENERS": True,

}


THUMBNAIL_SELENIUM_USER = "admin"
THUMBNAIL_EXECUTE_AS = [ExecutorType.CURRENT_USER, ExecutorType.SELENIUM]

THUMBNAIL_CACHE_CONFIG: CacheConfig = {
    'CACHE_TYPE': 'redis',
    'CACHE_DEFAULT_TIMEOUT': 24*60*60*7,
    'CACHE_KEY_PREFIX': 'thumbnail_',
    'CACHE_REDIS_URL': 'redis://superset_cache:6379/1'
}


FAB_API_MAX_PAGE_SIZE = 500


ALERT_REPORTS_NOTIFICATION_DRY_RUN = True
WEBDRIVER_BASEURL = "http://superset_app:8088/"
# The base URL for the email report hyperlinks.
WEBDRIVER_BASEURL_USER_FRIENDLY = WEBDRIVER_BASEURL

SQLLAB_CTAS_NO_LIMIT = True


TALISMAN_ENABLED = False
GUEST_ROLE_NAME = "Guest"

##############################################33
# Set the authentication type to OAuth
AUTH_TYPE = AUTH_OAUTH


ENABLE_PROXY_FIX = True
AUTH_USER_REGISTRATION = True
AUTH_USER_REGISTRATION_ROLE = "Gamma"
AUTH_USER_REGISTRATION_ROLE_JMESPATH = "contains(['lautaro@datakimia.com', 'rory@datakimia.com'], email) && 'Admin' || 'Alpha'"
AUTH_ROLES_MAPPING = {
"superset_users": ["Gamma","Alpha"],
"superset_admins": ["Admin"],
}

# Working Example Google
OAUTH_PROVIDERS = [
{
    'name': 'google',
    #'whitelist': ['@company.com'],
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
        'client_id': '1038479848720-3o66nss7jj0jauvditoc4h89vo7qqq6u.apps.googleusercontent.com',
        'client_secret': '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'
    }
}]

# Enable CORS 
ENABLE_CORS = True
CORS_OPTIONS = {   # Replace with your frontend domain(s)
    'origins': [
        'http://localhost:3000',
        'http://localhost:4000',
        'https://product-portal-fe.vercel.app',
        'https://product-portal-fe-git-dev-datakimia-portal.vercel.app',
        'https://product-portal-fe-git-staging-datakimia-portal.vercel.app'
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

SUPERSET_LOAD_EXAMPLES="yes"
PREVIOUS_SECRET_KEY="4MCsZm1ciqjZ4347/jIrefw34vKOPZ37Rr9k2iguLd3OeeCiZ45aw5ha"
SUPERSET_SECRET_KEY="+DLoS9mlyLGxgUIP5QcM1/8IxVB0AG4GCdhDD2uSaQZAgfxwaVL7uO7f"



######

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


