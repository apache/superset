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
        # Registers ai.run_turn. This class replaces the shipped CeleryConfig
        # rather than extending it, so an import added there does not reach the
        # worker here — without this line, worker execution enqueues a task the
        # worker rejects as unregistered and the stream never produces a frame.
        "superset.ai.tasks",
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
    "ENABLE_EXTENSIONS": True,
    "MOBILE_CONSUMPTION_MODE": True,
    "SEMANTIC_LAYERS": True,
}

#
# AI assistant, for local development.
#
# Enabled only when an endpoint and key are present in the environment, so
# `docker compose up` with no AI variables behaves exactly as before. Put them in
# docker/.env-local (untracked) — see docker/.env-local.example.
#
# Any OpenAI-compatible endpoint works, including a private gateway: point
# SUPERSET_AI_LLM_BASE_URL at it and name your models. Nothing is sent anywhere
# until these are set.
#
SUPERSET_AI_LLM_BASE_URL = os.getenv("SUPERSET_AI_LLM_BASE_URL")
SUPERSET_AI_LLM_API_KEY = os.getenv("SUPERSET_AI_LLM_API_KEY")

if SUPERSET_AI_LLM_BASE_URL and SUPERSET_AI_LLM_API_KEY:
    FEATURE_FLAGS["AI_ASSISTANT"] = True
    AI_LLM_PROVIDER_CLASS = os.getenv(
        "SUPERSET_AI_LLM_PROVIDER_CLASS",
        "superset.ai.llm.openai_compatible.OpenAICompatibleProvider",
    )
    AI_LLM_PROVIDER_CONFIG = {
        "base_url": SUPERSET_AI_LLM_BASE_URL,
        "api_key": SUPERSET_AI_LLM_API_KEY,
        "models": {
            # A tier left unset is an error when requested rather than a silent
            # substitution, so the default tier at minimum has to be named.
            "default": os.getenv("SUPERSET_AI_MODEL_DEFAULT", "gpt-4o-mini"),
            "fast": os.getenv(
                "SUPERSET_AI_MODEL_FAST",
                os.getenv("SUPERSET_AI_MODEL_DEFAULT", "gpt-4o-mini"),
            ),
            "reasoning": os.getenv(
                "SUPERSET_AI_MODEL_REASONING",
                os.getenv("SUPERSET_AI_MODEL_DEFAULT", "gpt-4o-mini"),
            ),
        },
    }
    logger.info("AI assistant enabled, pointed at %s", SUPERSET_AI_LLM_BASE_URL)

if FEATURE_FLAGS.get("AI_ASSISTANT"):
    # Traces to the container log, so a local run shows what the agent did
    # without standing up a monitoring stack.
    from superset.ai.telemetry import LoggingAITelemetry  # noqa: E402

    AI_TELEMETRY = [LoggingAITelemetry()]
    # Local development wants to see the prompts and SQL in those traces; the
    # production default withholds them.
    AI_TELEMETRY_REDACT_CONTENT = False

    # Where a turn runs. Inline by default, matching the shipped default: the
    # turn executes inside the streaming request and needs neither Celery nor
    # Redis, so the assistant works on a plain `docker compose up`.
    #
    # The trade-off is that the stream request *is* the run, so closing it — by
    # reloading the page or navigating away — abandons the turn mid-flight and the
    # answer is lost. Set SUPERSET_AI_EXECUTION_MODE=worker to run turns on the
    # Celery worker instead, which decouples the run from any reader and lets a
    # returning client re-attach to one already in progress.
    AI_ASSISTANT_EXECUTION_MODE = os.getenv("SUPERSET_AI_EXECUTION_MODE", "inline")

    # Worker execution needs a bus that crosses processes. The in-process default
    # cannot carry events from the Celery worker to the web process holding the
    # stream open, and the runtime refuses to start rather than hang — so this is
    # configured alongside the mode above. Streams use commands the
    # general-purpose cache client does not expose, hence its own connection
    # rather than CACHE_CONFIG's.
    if AI_ASSISTANT_EXECUTION_MODE == "worker":
        AI_ASSISTANT_EVENT_BUS = "redis"
        AI_ASSISTANT_EVENT_BUS_CACHE_CONFIG = {
            "CACHE_TYPE": "RedisCache",
            "CACHE_REDIS_HOST": REDIS_HOST,
            "CACHE_REDIS_PORT": int(REDIS_PORT),
            "CACHE_REDIS_USER": "",
            "CACHE_REDIS_PASSWORD": "",
            "CACHE_REDIS_DB": int(os.getenv("REDIS_AI_EVENTS_DB", "3")),
            "CACHE_DEFAULT_TIMEOUT": 300,
            "CACHE_REDIS_SSL": False,
        }
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
