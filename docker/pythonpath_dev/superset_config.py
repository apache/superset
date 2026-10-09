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
from typing import Any

from celery.schedules import crontab
from flask_caching.backends.filesystemcache import FileSystemCache

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
        "superset.tasks.deletion_retention",
        "superset.tasks.scheduler",
        "superset.tasks.thumbnails",
        "superset.tasks.cache",
        "superset.tasks.export_dashboard_excel",
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
        # Gated on the SOFT_DELETE feature flag, which is off by default: the
        # task is scheduled either way, but purges nothing while the flag is
        # unset. Enable it in FEATURE_FLAGS below to exercise retention locally.
        "deletion_retention.purge_soft_deleted": {
            "task": "deletion_retention.purge_soft_deleted",
            "schedule": crontab(minute=0, hour=0),
        },
    }


CELERY_CONFIG = CeleryConfig

FEATURE_FLAGS = {
    "ALERT_REPORTS": True,
    "DATASET_FOLDERS": True,
    "EMBEDDED_SUPERSET": True,
    "ENABLE_EXTENSIONS": True,
    "ENABLE_TEMPLATE_PROCESSING": True,
    "MOBILE_CONSUMPTION_MODE": True,
    "SEMANTIC_LAYERS": True,
}

_jinja_logger = logging.getLogger("superset.jinja_context")


def get_user_attribute(attr: str, default: Any = None) -> Any:
    """Return an attribute from the logged-in Superset user."""
    try:
        from flask_login import current_user

        return getattr(current_user, attr, default)
    except Exception:  # noqa: BLE001
        return default


def guest_attr(attr: str, default: Any = None) -> Any:
    """Return a custom user attribute from an embedded guest token."""
    try:
        from flask_login import current_user

        if getattr(current_user, "is_guest_user", False):
            return current_user.guest_token.get("user", {}).get(attr, default)
        return default
    except Exception as exc:  # noqa: BLE001
        _jinja_logger.warning("[guest_attr] ERROR attr=%r exc=%r", attr, exc)
        return default


JINJA_CONTEXT_ADDONS = {
    "get_user_attribute": get_user_attribute,
    "guest_attr": guest_attr,
}


def GUEST_TOKEN_VALIDATOR_HOOK(body: dict[str, Any]) -> bool:  # noqa: N802
    """Preserve custom guest user attributes when minting a guest token."""
    try:
        from flask import request as flask_request

        raw_user = (flask_request.json or {}).get("user", {})
        standard_keys = {"username", "first_name", "last_name"}
        custom_fields = {
            key: value for key, value in raw_user.items() if key not in standard_keys
        }
        if custom_fields:
            body.setdefault("user", {}).update(custom_fields)
    except Exception as exc:  # noqa: BLE001
        logger.warning("GUEST_TOKEN_VALIDATOR_HOOK error: %r", exc)
    return True


EXTENSIONS_PATH = "/app/docker/extensions"
ALERT_REPORTS_NOTIFICATION_DRY_RUN = True
# The Docker Compose app service is named "superset" and listens on 8088. Report
# paths are root-relative, so urljoin drops the base path; only the scheme, host,
# and port must be correct here. SUPERSET_APP_ROOT is kept for consumers that
# concatenate paths directly (e.g. cache warm-up). For screenshots in the dev
# stack (unbuilt static assets) point this at the nginx service instead:
# http://nginx{SUPERSET_APP_ROOT}/
WEBDRIVER_BASEURL = f"http://superset:8088{os.environ.get('SUPERSET_APP_ROOT', '/')}/"
# The base URL for the email report hyperlinks.
WEBDRIVER_BASEURL_USER_FRIENDLY = (
    f"http://localhost:8888/{os.environ.get('SUPERSET_APP_ROOT', '/')}/"
)
SQLLAB_CTAS_NO_LIMIT = True

log_level_text = os.getenv("SUPERSET_LOG_LEVEL", "INFO")
LOG_LEVEL = getattr(logging, log_level_text.upper(), logging.INFO)

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
