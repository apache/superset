# This file overrides the superset/docker/pythonpath_dev/superset_config.py file, in which it is imported
# as a final step as a means to override "defaults".

import os

from celery.schedules import crontab

FEATURE_FLAGS = {
    "ALERT_REPORTS": True,
    "ENABLE_TEMPLATE_PROCESSING": True,
    "TAGGING_SYSTEM": True
}

SQLALCHEMY_POOL_SIZE = 45
SQLALCHEMY_POOL_TIMEOUT = 180
SQLALCHEMY_MAX_OVERFLOW = 30

SQLLAB_ASYNC_TIME_LIMIT_SEC = 60 * 60 * 6
SUPERSET_WEBSERVER_TIMEOUT = 300

# Redis configuration
REDIS_HOST = os.getenv("REDIS_HOST", "redis")
REDIS_PORT = os.getenv("REDIS_PORT", "6379")
REDIS_CELERY_DB = os.getenv("REDIS_CELERY_DB", "0")
REDIS_RESULTS_DB = os.getenv("REDIS_RESULTS_DB", "1")

# Celery configuration
class CeleryConfig:
    broker_url = f"redis://{REDIS_HOST}:{REDIS_PORT}/{REDIS_CELERY_DB}"
    imports = (
        "superset.sql_lab",
        "superset.tasks.scheduler",
        "superset.tasks.thumbnails",
        "superset.tasks.cache",
        "superset.tasks.llm_context",
    )
    result_backend = f"redis://{REDIS_HOST}:{REDIS_PORT}/{REDIS_RESULTS_DB}"
    worker_prefetch_multiplier = 1
    task_acks_late = False

    task_annotations = {
        "sql_lab.get_sql_results": {
            "rate_limit": "100/s",
        },
    }

    beat_schedule = {
        "reports.scheduler": {
            "task": "reports.scheduler",
            "schedule": crontab(minute="*", hour="*"),
        },
        "reports.prune_log": {
            "task": "reports.prune_log",
            "schedule": crontab(minute=10, hour=0),
        },
        # Uncomment to enable cache warmup tasks
        # 'cache-warmup-hourly': {
        #     "task": "cache-warmup",
        #     "schedule": crontab(minute="*/30", hour="*"),
        #     "kwargs": {
        #         "strategy_name": "top_n_dashboards",
        #         "top_n": 10,
        #         "since": "7 days ago",
        #     },
        # },
        "check_for_expired_llm_context": {
            "task": "check_for_expired_llm_context",
            "schedule": crontab(minute='*/5'),
        }
    }

CELERY_CONFIG = CeleryConfig
