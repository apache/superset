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
import sys

from celery.schedules import crontab
from flask_caching.backends.filesystemcache import FileSystemCache

from redis import Redis
from datetime import timedelta

from superset.security.session_validation import SessionValidationSecurityManager  # noqa: F401

logger = logging.getLogger()


def env_bool(name: str, default: bool) -> bool:
    """Read a boolean env var ("true"/"1"/"yes"/"on" are truthy)."""
    value = os.getenv(name)
    if value is None:
        return default
    return value.strip().lower() in ("true", "1", "yes", "on")


def env_list(name: str, default: str = "") -> list[str]:
    """Read a comma-separated env var into a list of non-empty strings."""
    return [
        item.strip() for item in os.getenv(name, default).split(",") if item.strip()
    ]


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

# Use environment variable if set, otherwise construct from components
# This MUST take precedence over any other configuration
SQLALCHEMY_EXAMPLES_URI = os.getenv(
    "SUPERSET__SQLALCHEMY_EXAMPLES_URI",
    (
        f"{DATABASE_DIALECT}://"
        f"{EXAMPLES_USER}:{EXAMPLES_PASSWORD}@"
        f"{EXAMPLES_HOST}:{EXAMPLES_PORT}/{EXAMPLES_DB}"
    ),
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
DATA_CACHE_CONFIG = CACHE_CONFIG
THUMBNAIL_CACHE_CONFIG = CACHE_CONFIG


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

FEATURE_FLAGS = {"ALERT_REPORTS": True, "DATASET_FOLDERS": True}
ALERT_REPORTS_NOTIFICATION_DRY_RUN = True
WEBDRIVER_BASEURL = f"http://superset_app{os.environ.get('SUPERSET_APP_ROOT', '/')}/"  # When using docker compose baseurl should be http://superset_nginx{ENV{BASEPATH}}/  # noqa: E501
# The base URL for the email report hyperlinks.
WEBDRIVER_BASEURL_USER_FRIENDLY = (
    f"http://localhost:8888/{os.environ.get('SUPERSET_APP_ROOT', '/')}/"
)
SQLLAB_CTAS_NO_LIMIT = True

log_level_text = os.getenv("SUPERSET_LOG_LEVEL", "INFO")
LOG_LEVEL = getattr(logging, log_level_text.upper(), logging.INFO)

if os.getenv("CYPRESS_CONFIG") == "true":
    # When running the service as a cypress backend, we need to import the config
    # located @ tests/integration_tests/superset_test_config.py
    base_dir = os.path.dirname(__file__)
    module_folder = os.path.abspath(
        os.path.join(base_dir, "../../tests/integration_tests/")
    )
    sys.path.insert(0, module_folder)
    from superset_test_config import *  # noqa

    sys.path.pop(0)

#
# Optionally import superset_config_docker.py (which will have been included on
# the PYTHONPATH) in order to allow for local settings to be overridden
#
try:
    import superset_config_docker
    from superset_config_docker import *  # noqa: F403

    logger.info(
        "Loaded your Docker configuration at [%s]", superset_config_docker.__file__
    )
except ImportError:
    logger.info("Using default Docker config...")

# REQUIRED — use server-side sessions

SESSION_LIFETIME = int(os.getenv("SESSION_LIFETIME", "30"))
SESSION_REDIS_DB = int(os.getenv("SESSION_REDIS_DB", "0"))
SESSION_REDIS_HOST = os.getenv("SESSION_REDIS_HOST", REDIS_HOST)
SESSION_REDIS_PORT = int(os.getenv("SESSION_REDIS_PORT", REDIS_PORT))

SESSION_SERVER_SIDE = True

# Use Redis as session store
SESSION_TYPE = "redis"
SESSION_REDIS = Redis(
    host=SESSION_REDIS_HOST, port=SESSION_REDIS_PORT, db=SESSION_REDIS_DB
)

# Sign the session ID cookie
SESSION_USE_SIGNER = True

# Session expires
PERMANENT_SESSION_LIFETIME = timedelta(minutes=SESSION_LIFETIME)

# Cookie hardening
# Own cookie name: other Flask apps on localhost (e.g. the Integrator on :2021) also use
# "session", and cookies are shared across ports, so they would log each other out
SESSION_COOKIE_NAME = os.getenv("SESSION_COOKIE_NAME", "superset_session")
SESSION_COOKIE_SECURE = True
SESSION_COOKIE_HTTPONLY = True
SESSION_COOKIE_SAMESITE = "Strict"

# Flask/FAB protection
SESSION_PROTECTION = "strong"

# Only applies if using AUTH_DB (local username/password auth)

FAB_PASSWORD_COMPLEXITY_ENABLED = True


# --- REGISTER CUSTOM SECURITY MANAGER ---
CUSTOM_SECURITY_MANAGER = SessionValidationSecurityManager


# --- EMBEDDING & CORS CONFIGURATION ---
ENABLE_CORS = env_bool("ENABLE_CORS", True)
CORS_OPTIONS = {
    "supports_credentials": True,
    "allow_headers": ["*"],
    "resources": ["*"],
    "origins": env_list("SUPERSET_CORS_ORIGINS"),
}

TALISMAN_ENABLED = env_bool("TALISMAN_ENABLED", True)
WTF_CSRF_ENABLED = env_bool("WTF_CSRF_ENABLED", True)
# If Superset continues setting X-Frame-Options to SAMEORIGIN, override it here
HTTP_HEADERS = {"X-Frame-Options": os.getenv("HTTP_X_FRAME_OPTIONS", "SAMEORIGIN")}

GUEST_ROLE_NAME = os.getenv("GUEST_ROLE_NAME", "Public")
PUBLIC_ROLE_LIKE = os.getenv("PUBLIC_ROLE_LIKE") or None
