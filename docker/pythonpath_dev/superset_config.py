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
import redis
import logging
import os
from datetime import timedelta
from typing import Optional

from cachelib.file import FileSystemCache
from celery.schedules import crontab

logger = logging.getLogger()


def get_env_variable(var_name: str, default: Optional[str] = None) -> str:
    """Get the environment variable or raise exception."""
    try:
        return os.environ[var_name]
    except KeyError:
        if default is not None:
            return default
        else:
            error_msg = "The environment variable {} was missing, abort...".format(
                var_name
            )
            raise EnvironmentError(error_msg)




SUPERSET_WEBSERVER_DOMAINS=["supersetuat.xaana.net","supersetuat1.xaana.net","supersetuat2.xaana.net","supersetuat3.xaana.net"]
ENABLE_CORS = True
CORS_OPTIONS = {
    'supports_credentials': True,
    'allow_headers': [
        'X-CSRFToken','X-GuestToken', 'Content-Type', 'Origin', 'X-Requested-With', 'Accept','Access-Control-Allow-Origin'
    ],
    'origins': ['https://supersetuat.xaana.net','https://supersetuat1.xaana.net','https://supersetuat2.xaana.net','https://supersetuat3.xaana.net','https://supersetuat4.xaana.net']
}
FEATURE_FLAGS = { "ALERT_REPORTS": True,
                 "EMBEDDED_SUPERSET" : True

        }


DATABASE_DIALECT = get_env_variable("DATABASE_DIALECT")
DATABASE_USER = get_env_variable("DATABASE_USER")
DATABASE_PASSWORD = get_env_variable("DATABASE_PASSWORD")
DATABASE_HOST = get_env_variable("DATABASE_HOST")
DATABASE_PORT = get_env_variable("DATABASE_PORT")
DATABASE_DB = get_env_variable("DATABASE_DB")

# The SQLAlchemy connection string.
SQLALCHEMY_DATABASE_URI = "%s://%s:%s@%s:%s/%s" % (
    DATABASE_DIALECT,
    DATABASE_USER,
    DATABASE_PASSWORD,
    DATABASE_HOST,
    DATABASE_PORT,
    DATABASE_DB,
)

REDIS_HOST = get_env_variable("REDIS_HOST")
REDIS_PORT = get_env_variable("REDIS_PORT")
REDIS_CELERY_DB = get_env_variable("REDIS_CELERY_DB", "0")
REDIS_RESULTS_DB = get_env_variable("REDIS_RESULTS_DB", "1")

#CACHE_CONFIG = {"CACHE_TYPE" : "redis",
#        'CACHE_DEFAULT_TIMEOUT': 60 * 60 * 12, # 12 hour default (in secs)
#    'CACHE_KEY_PREFIX': 'superset_results',

#'CACHE_MEMCACHED_SERVERS': ['redis'],


#        }
GUEST_TOKEN_JWT_EXP_SECONDS = 16018400 # 6 months
CACHE_CONFIG = {
    "CACHE_TYPE": "redis",
    "CACHE_DEFAULT_TIMEOUT": 60 * 60 * 24, # 1 day default (in secs)
    "CACHE_KEY_PREFIX": "superset_results",
    "CACHE_REDIS_URL": f"redis://{REDIS_HOST}:{REDIS_PORT}/{REDIS_RESULTS_DB}",
}

#RESULTS_BACKEND = FileSystemCache("/app/superset_home/sqllab")
RESULTS_BACKEND = redis.Redis(
    host=REDIS_HOST, port=REDIS_PORT)

class CeleryConfig:
    BROKER_URL = 'redis://%s:%s/0' % (REDIS_HOST, REDIS_PORT)
    CELERY_IMPORTS = ('superset.sql_lab', "superset.tasks", "superset.tasks.thumbnails", )
    CELERY_RESULT_BACKEND = 'redis://%s:%s/0' % (REDIS_HOST, REDIS_PORT)
    CELERYD_PREFETCH_MULTIPLIER = 10
    CELERY_ACKS_LATE = True
    CELERY_ANNOTATIONS = {
        'sql_lab.get_sql_results': {
            'rate_limit': '100/s',
        },
        'email_reports.send': {
            'rate_limit': '1/s',
            'time_limit': 600,
            'soft_time_limit': 600,
            'ignore_result': True,
        },
    }
    CELERYBEAT_SCHEDULE = {
        'reports.scheduler': {
            'task': 'reports.scheduler',
            'schedule': crontab(minute='*', hour='*'),
        },
        'reports.prune_log': {
            'task': 'reports.prune_log',
            'schedule': crontab(minute=0, hour=0),
        },
    }


CELERY_CONFIG = CeleryConfig

SCREENSHOT_LOCATE_WAIT = 100
SCREENSHOT_LOAD_WAIT = 600

PUBLIC_ROLE_LIKE = "Public"
# Email configuration
#ALERT_REPORTS_NOTIFICATION_DRY_RUN = False
#EMAIL_NOTIFICATIONS = True
SMTP_HOST = "smtp.office365.com" #change to your host
SMTP_STARTTLS = True
SMTP_SSL = False
SMTP_USER = "test.enso@xaana.ai"
SMTP_PORT = 587 # your port eg. 587
SMTP_PASSWORD = "Welcome1"
SMTP_MAIL_FROM = "test.enso@xaana.ai"

# WebDriver configuration
# If you use Firefox, you can stick with default values
# If you use Chrome, then add the following WEBDRIVER_TYPE and WEBDRIVER_OPTION_ARGS
#WEBDRIVER_TYPE = "chrome"
#WEBDRIVER_OPTION_ARGS = [
#    "--force-device-scale-factor=2.0",
#    "--high-dpi-support=2.0",
#    "--headless",
#    "--disable-gpu",
#    "--disable-dev-shm-usage",
#    "--no-sandbox",
#    "--disable-setuid-sandbox",
#    "--disable-extensions",
#]
# This is the link sent to the recipient, change to your domain eg. https://superset.mydomain.com
#WEBDRIVER_BASEURL_USER_FRIENDLY="http://localhost:8088"
WEBDRIVER_BASEURL = "http://supersetuat:8088/"
# The base URL for the email report hyperlinks.
WEBDRIVER_BASEURL_USER_FRIENDLY = "http://localhost:8088"
SQLLAB_CTAS_NO_LIMIT = True
SUPERSET_WEBSERVER_PROTOCOL = "https"
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
