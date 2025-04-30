# This file overrides the superset/docker/pythonpath_dev/superset_config.py file, in which it is imported
# as a final step as a means to override "defaults".

import os

FEATURE_FLAGS = {
    "ENABLE_TEMPLATE_PROCESSING": True,
    "TAGGING_SYSTEM": True
}

SQLALCHEMY_POOL_SIZE = 45
SQLALCHEMY_POOL_TIMEOUT = 180
SQLALCHEMY_MAX_OVERFLOW = 30

REDIS_HOST = os.getenv("REDIS_HOST", "redis")
REDIS_PORT = os.getenv("REDIS_PORT", "6379")
REDIS_CELERY_DB = os.getenv("REDIS_CELERY_DB", "0")
REDIS_RESULTS_DB = os.getenv("REDIS_RESULTS_DB", "1")

SQLLAB_ASYNC_TIME_LIMIT_SEC = 60 * 60 * 6
SUPERSET_WEBSERVER_TIMEOUT = 300
