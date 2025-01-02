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
from flask_appbuilder.security.manager import AUTH_OAUTH

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
PREVENT_UNSAFE_DB_CONNECTIONS = False
JWT_VERIFY_SUB=False
# The SQLAlchemy connection string.
SQLALCHEMY_DATABASE_URI = (
    f"mysql://"
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

RESULTS_BACKEND = FileSystemCache("/app/superset_home/sqllab")

CACHE_CONFIG = {
    "CACHE_TYPE": "RedisCache",
    "CACHE_DEFAULT_TIMEOUT": 300,
    "CACHE_KEY_PREFIX": "superset_",
    "CACHE_REDIS_HOST": REDIS_HOST,
    "CACHE_REDIS_PORT": REDIS_PORT,
    "CACHE_REDIS_DB": REDIS_RESULTS_DB,
}

# DATA_CACHE_CONFIG = CACHE_CONFIG
DATA_CACHE_CONFIG = {
    'CACHE_TYPE': 'SimpleCache',
    'CACHE_DEFAULT_TIMEOUT': 86400 # 24 hours in seconds
}

ENABLE_PROXY_FIX = True

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

FEATURE_FLAGS = {"ALERT_REPORTS": True}
ALERT_REPORTS_NOTIFICATION_DRY_RUN = True
WEBDRIVER_BASEURL = "http://superset:8088/"  # When using docker compose baseurl should be http://superset_app:8088/
# The base URL for the email report hyperlinks.
WEBDRIVER_BASEURL_USER_FRIENDLY = WEBDRIVER_BASEURL
SQLLAB_CTAS_NO_LIMIT = True

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


OKTA_CLIENT_ID = os.getenv("OKTA_CLIENT_ID")
OKTA_CLIENT_SECRET = os.getenv("OKTA_CLIENT_SECRET")
OKTA_CLIENT_SCOPE = os.getenv("OKTA_CLIENT_SCOPE")
OKTA_BASE_URL = os.getenv("OKTA_BASE_URL")
OKTA_API_BASE_URL = os.getenv("OKTA_API_BASE_URL")
OKTA_SERVER_METADATA_URL = os.getenv("OKTA_SERVER_METADATA_URL")

AUTH_USER_REGISTRATION = True  # allow self-registration (login creates a user)
AUTH_USER_REGISTRATION_ROLE = "Gamma"  # default is a Gamma user
APP_NAME = "Superset Fiverr"
LOGO_RIGHT_TEXT = "Superset Fiverr"

APP_ICON = "/static/assets/images/fiverr_logo.png"
# APP_ICON = "/static/assets/images/superset-logo-horiz.png"
SUPERSET_CONTEXT_PATH = '/superset/workspaces/'
LOGO_TARGET_PATH = '/superset/workspaces/'
LOGO_TOOLTIP = 'Change Workspace'

PREFERRED_DATABASES = [
    "Google BigQuery",
    "Google Sheets",
    "MySQL",
]

FEATURE_FLAGS = {
    'DASHBOARD_RBAC': True,
}

AUTH_TYPE = AUTH_OAUTH
OAUTH_PROVIDERS = [{
    'name':'okta',
    'icon':'fa-circle-o',
    'token_key': 'access_token',
    'remote_app': {
        'client_id':OKTA_CLIENT_ID,
        'client_secret':OKTA_CLIENT_SECRET,
        'access_token_method': 'POST',
        'api_base_url': f'{OKTA_BASE_URL}/{OKTA_API_BASE_URL}/',
        'access_token_url': f'{OKTA_BASE_URL}/{OKTA_API_BASE_URL}/token',
        'authorize_url': f'{OKTA_BASE_URL}/{OKTA_API_BASE_URL}/authorize',
        'grant_type': 'authorization_code',
        'server_metadata_url': f'{OKTA_BASE_URL}/{OKTA_SERVER_METADATA_URL}',
        'client_kwargs':{
            'scope': OKTA_CLIENT_SCOPE
        },
    }
}]

from superset.security import SupersetSecurityManager

logger = logging.getLogger('okta_login')


class CustomSsoSecurityManager(SupersetSecurityManager):

    def __init__(self, appbuilder):
        super(CustomSsoSecurityManager, self).__init__(appbuilder)

    def oauth_user_info(self, provider, response=None):
        logger.info(response)

        if provider == 'okta':
            me = self.appbuilder.sm.oauth_remotes[provider].get("userinfo")
            data = me.json()
            logger.info(data)

            prefix = 'Superset_'
            groups = [
                x.replace(prefix, '').strip() for x in data['groups']
                if x.startswith(prefix)
            ]

            return {
                'username' : data.get('preferred_username', ''),
                'name' : data.get('name',''),
                'email' : data.get('email',''),
                'first_name': data.get('given_name',''),
                'last_name': data.get('family_name',''),
                'roles': groups,
            }

    def auth_user_oauth(self, userinfo):
        logger.debug("checking if User %s found", userinfo['username'])
        user = self.find_user(email=userinfo['username'])

        if user is None:  # first time user
            super().auth_user_oauth(userinfo)  # save user to db
            user = self.find_user(email=userinfo['username'])

        roles = [self.find_role(x) for x in userinfo['roles']]
        roles = [x for x in roles if x is not None]
        user.roles = roles
        logger.debug(' Update <User: %s> role to %s', user.username, roles)
        self.update_user(user)  # update user roles
        return user

CUSTOM_SECURITY_MANAGER = CustomSsoSecurityManager
from flask import Blueprint
from superset.custom.views.workspaces.routes import workspaces

BLUEPRINTS: list[Blueprint] = [workspaces]
