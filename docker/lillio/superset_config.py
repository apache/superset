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

import logging
import os as _os
import threading as _threading
from copy import deepcopy as _deepcopy
from datetime import timedelta as _timedelta
from typing import Any, cast
from urllib.parse import quote as _urlquote

from celery.schedules import crontab as _crontab
from celery.signals import worker_init as _worker_init
from celery.signals import worker_ready as _worker_ready
from celery.signals import worker_shutdown as _worker_shutdown
from flask_caching.backends.rediscache import RedisCache as _RedisCache
from jinja2 import pass_context as _pass_context
from jinja2.runtime import Context as _JinjaContext, Undefined as _JinjaUndefined
from redis import Redis as _Redis
from redis.backoff import ExponentialBackoff as _ExponentialBackoff
from redis.exceptions import BusyLoadingError as _BusyLoadingError
from redis.exceptions import ConnectionError as _RedisConnectionError
from redis.exceptions import TimeoutError as _RedisTimeoutError
from redis.retry import Retry as _Retry
from superset import config as _superset_config

logger = logging.getLogger(__name__)
_jinja_logger = logging.getLogger("superset.jinja_context")

# ---------------------------------------------------------------------------
# File-based Celery worker health check
# Mirrors the implementation in helm/superset/templates/_helpers.tpl so ECS
# can use a simple file-mtime check instead of `celery inspect ping`, which
# requires loading the full Flask app on every health check interval.
# ---------------------------------------------------------------------------
_HC_READY_FILE = "/tmp/celery_worker_ready"  # noqa: S108
_HC_ALIVE_FILE = "/tmp/celery_worker_alive"  # noqa: S108
_HC_HEARTBEAT_INTERVAL = 10  # seconds
_hc_liveness_thread = None
_hc_liveness_stop_event = None


@_worker_ready.connect
def _hc_create_ready_file(sender: Any = None, **kwargs: Any) -> None:
    try:
        open(_HC_READY_FILE, "w").close()  # noqa: WPS515
    except Exception as exc:  # noqa: BLE001
        logger.warning("health-check: could not create ready file: %r", exc)


@_worker_shutdown.connect
def _hc_remove_ready_file(sender: Any = None, **kwargs: Any) -> None:
    global _hc_liveness_thread, _hc_liveness_stop_event  # noqa: PLW0603
    if _hc_liveness_stop_event:
        _hc_liveness_stop_event.set()
    if _hc_liveness_thread:
        _hc_liveness_thread.join(timeout=5)
    for path in (_HC_READY_FILE, _HC_ALIVE_FILE):
        try:
            if _os.path.exists(path):
                _os.remove(path)
        except Exception as exc:  # noqa: BLE001
            logger.warning("health-check: could not remove %s: %r", path, exc)


@_worker_init.connect
def _hc_start_liveness_heartbeat(sender: Any = None, **kwargs: Any) -> None:
    global _hc_liveness_thread, _hc_liveness_stop_event  # noqa: PLW0603
    _hc_liveness_stop_event = _threading.Event()

    def _beat() -> None:
        while not _hc_liveness_stop_event.is_set():
            try:
                with open(_HC_ALIVE_FILE, "w") as fh:
                    fh.write(str(_os.getpid()))
            except Exception as exc:  # noqa: BLE001
                logger.warning("health-check: could not update alive file: %r", exc)
            _hc_liveness_stop_event.wait(_HC_HEARTBEAT_INTERVAL)

    _hc_liveness_thread = _threading.Thread(target=_beat, daemon=True)
    _hc_liveness_thread.start()


FEATURE_FLAGS = {
    "ALERT_REPORTS": True,
    "DATE_RANGE_TIMESHIFTS_ENABLED": True,
    "EMBEDDED_SUPERSET": True,
    "ENABLE_TEMPLATE_PROCESSING": True,
    "GLOBAL_ASYNC_QUERIES": True,
    "PLAYWRIGHT_REPORTS_AND_THUMBNAILS": True,
    "SQLLAB_FORCE_RUN_ASYNC": True,
    # A core migration (add_granular_export_permissions) unconditionally
    # deletes the legacy "can_csv on Superset" permission when it runs,
    # regardless of this flag. With the flag left off, the runtime code
    # still checks for that now-deleted permission, so CSV/chart export
    # can never be granted to any role. Turning this on switches the
    # runtime checks to the granular permissions the migration actually
    # created (can_export_data / can_export_image / can_copy_clipboard).
    "GRANULAR_EXPORT_CONTROLS": True,
}

GUEST_TOKEN_JWT_SECRET = _os.environ["SUPERSET__GUEST_TOKEN_JWT_SECRET"]


def _register_cache_key(ctx: _JinjaContext, value: Any) -> None:
    """
    Fold ``value`` into the query's cache key via the sibling ``cache_key_wrapper``
    macro that Superset's ``ExtraCache`` exposes in the same template context.

    Without this, a per-guest/per-user value returned by a JINJA_CONTEXT_ADDONS
    function never varies the cache key, so every viewer's query result is
    cached under the same key: the first value computed "wins" and gets served
    to everyone else until the cache entry expires.
    """
    cache_key_wrapper = ctx.resolve("cache_key_wrapper")
    # Jinja's base Undefined defines __call__ (it raises when actually invoked),
    # so `callable(...)` alone can't tell "missing from context" apart from
    # "a real callable" -- check for Undefined explicitly.
    if callable(cache_key_wrapper) and not isinstance(
        cache_key_wrapper, _JinjaUndefined
    ):
        hashable_value = tuple(value) if isinstance(value, list) else value
        cache_key_wrapper(hashable_value)


def _get_template_user() -> Any:
    """Return the request or Celery-task user used by Superset.

    Async chart tasks restore their user with ``override_user()``, which writes
    to ``flask.g.user``. ``flask_login.current_user`` requires a request context
    and therefore resolves incorrectly in a Celery worker.
    """
    try:
        from flask import g

        if (user := getattr(g, "user", None)) is not None:
            return user
    except RuntimeError:
        # Synchronous template rendering outside an application context can
        # still use Flask-Login's request-local proxy.
        pass

    from flask_login import current_user

    return current_user


@_pass_context
def get_user_attribute(ctx: _JinjaContext, attr: str, default: Any = None) -> Any:
    try:
        value = getattr(_get_template_user(), attr, default)
    except Exception:  # noqa: BLE001
        value = default
    _register_cache_key(ctx, value)
    return value


@_pass_context
def guest_attr(ctx: _JinjaContext, attr: str, default: Any = None) -> Any:
    try:
        user = _get_template_user()
        if getattr(user, "is_guest_user", False):
            token_user = user.guest_token.get("user", {})
            value = token_user.get(attr, default)
        else:
            value = default
    except Exception as exc:  # noqa: BLE001
        _jinja_logger.warning("[guest_attr] ERROR attr=%r exc=%r", attr, exc)
        value = default
    _register_cache_key(ctx, value)
    return value


JINJA_CONTEXT_ADDONS = {
    "get_user_attribute": get_user_attribute,
    "guest_attr": guest_attr,
}


def GUEST_TOKEN_VALIDATOR_HOOK(body: dict[str, Any]) -> bool:  # noqa: N802
    try:
        from flask import request as flask_request

        raw_user = (flask_request.json or {}).get("user", {})
        allowed_keys = {"username", "first_name", "last_name"}
        custom_fields = {k: v for k, v in raw_user.items() if k not in allowed_keys}
        if custom_fields:
            body.setdefault("user", {}).update(custom_fields)
    except Exception as exc:  # noqa: BLE001
        logger.warning("GUEST_TOKEN_VALIDATOR_HOOK error: %r", exc)
    return True


ENABLE_PROXY_FIX = True
DEBUG = False

TALISMAN_ENABLED = True
TALISMAN_CONFIG = cast(dict[str, Any], _deepcopy(_superset_config.TALISMAN_CONFIG))
TALISMAN_CONFIG["content_security_policy"]["frame-ancestors"] = [
    "'self'",
    "https://app.lillio.com",
    "https://staging-app.lillio.com",
    "https://*.herokuapp.com",
]
TALISMAN_CONFIG["force_https"] = False
TALISMAN_CONFIG["session_cookie_secure"] = True
TALISMAN_CONFIG["session_cookie_samesite"] = "None"
TALISMAN_CONFIG["frame_options"] = None

PERMANENT_SESSION_LIFETIME = _timedelta(hours=8)
SESSION_COOKIE_HTTPONLY = True
SESSION_COOKIE_SECURE = True
SESSION_COOKIE_SAMESITE = "None"
SESSION_SERVER_SIDE = True
SESSION_TYPE = "redis"
SESSION_USE_SIGNER = True

# flask-session docs recommend retry with ExponentialBackoff for Redis-backed
# sessions so that transient TimeoutError / ConnectionError on stale SSL
# connections reconnect transparently instead of propagating to Flask-Session
# and redirecting the user to /login/.
# See: https://flask-session.readthedocs.io/en/latest/config.html#retries
_session_redis_retry = _Retry(
    _ExponentialBackoff(),
    retries=3,
)
SESSION_REDIS = _Redis(
    host=_os.environ["REDIS_HOST"],
    port=int(_os.environ.get("REDIS_PORT", "6379")),
    password=_os.environ.get("REDIS_PASSWORD"),
    db=1,
    ssl=_os.environ.get("REDIS_SSL", "true").lower() == "true",
    ssl_cert_reqs="required",
    socket_keepalive=True,
    retry=_session_redis_retry,
    retry_on_error=[_BusyLoadingError, _RedisConnectionError, _RedisTimeoutError],
)

_redis_host = _os.environ["REDIS_HOST"]
_redis_port = int(_os.environ.get("REDIS_PORT", "6379"))
_redis_password = _os.environ["REDIS_PASSWORD"]
_redis_password_url = _urlquote(_redis_password, safe="")


# DB 0 — Celery broker only (matches Superset's REDIS_CELERY_DB default)
# DB 1 — everything else: caches, results, rate-limiter, async-events
#         (matches Superset's REDIS_RESULTS_DB default)
_BROKER_DB = 0
_CACHE_DB = 1


def _rediss_url(database: int) -> str:
    return (
        f"rediss://:{_redis_password_url}@{_redis_host}:{_redis_port}/{database}"
        "?ssl_cert_reqs=required"
    )


class CeleryConfig:  # pylint: disable=too-few-public-methods
    broker_url = _rediss_url(_BROKER_DB)
    result_backend = _rediss_url(_CACHE_DB)
    imports = (
        "superset.sql_lab",
        "superset.tasks.scheduler",
        "superset.tasks.thumbnails",
        "superset.tasks.cache",
        "superset.tasks.slack",
    )
    worker_prefetch_multiplier = 1
    task_acks_late = True
    task_annotations = {
        "sql_lab.get_sql_results": {"rate_limit": "100/s"},
    }
    beat_schedule = {
        "reports.scheduler": {
            "task": "reports.scheduler",
            "schedule": _crontab(minute="*", hour="*"),
        },
        "reports.prune_log": {
            "task": "reports.prune_log",
            "schedule": _crontab(minute=0, hour=0),
        },
    }


CELERY_CONFIG = CeleryConfig

RESULTS_BACKEND = _RedisCache(
    host=_redis_host,
    port=_redis_port,
    password=_redis_password,
    db=_CACHE_DB,
    key_prefix="superset_results_",
    ssl=True,
    ssl_cert_reqs="required",
    socket_timeout=5,
    socket_connect_timeout=5,
    socket_keepalive=True,
    health_check_interval=30,
)

RATELIMIT_STORAGE_URI = _rediss_url(_CACHE_DB)

CACHE_CONFIG = {
    "CACHE_TYPE": "RedisCache",
    "CACHE_KEY_PREFIX": "superset_",
    "CACHE_DEFAULT_TIMEOUT": 3600,
    # Flask-Caching's Redis backend does not consume CACHE_REDIS_SSL or
    # CACHE_REDIS_SSL_CERT_REQS. A rediss:// URL is required to make redis-py
    # construct an SSLConnection for ElastiCache's required in-transit TLS.
    "CACHE_REDIS_URL": _rediss_url(_CACHE_DB),
    # Superset's global async-query Redis backend does not consume
    # CACHE_REDIS_URL; it builds its client from these individual fields.
    "CACHE_REDIS_HOST": _redis_host,
    "CACHE_REDIS_PORT": _redis_port,
    "CACHE_REDIS_PASSWORD": _redis_password,
    "CACHE_REDIS_DB": _CACHE_DB,
    "CACHE_REDIS_SSL": True,
    "CACHE_REDIS_SSL_CERT_REQS": "required",
    # Prevent stale SSL connections to ElastiCache from hanging indefinitely.
    # socket_keepalive sends TCP keepalives on idle connections; health_check_interval
    # pings the connection periodically so redis-py detects and replaces dead ones.
    "CACHE_OPTIONS": {
        "socket_timeout": 5,
        "socket_connect_timeout": 5,
        "socket_keepalive": True,
        "health_check_interval": 30,
    },
}

# Keep rehydratable query contexts and dataframe result payloads in distinct
# namespaces. Their payload schemas and consumers are different.
DATA_CACHE_CONFIG = {
    **CACHE_CONFIG,
    "CACHE_KEY_PREFIX": "superset_data_",
}

GLOBAL_ASYNC_QUERIES_TRANSPORT = "polling"
GLOBAL_ASYNC_QUERIES_JWT_SECRET = _os.environ["GLOBAL_ASYNC_QUERIES_JWT_SECRET"]
GLOBAL_ASYNC_QUERIES_JWT_COOKIE_SECURE = True
GLOBAL_ASYNC_QUERIES_JWT_COOKIE_SAMESITE = "None"
GLOBAL_ASYNC_QUERIES_CACHE_BACKEND = CACHE_CONFIG


SMTP_HOST = _os.environ.get("SMTP_HOST", "email-smtp.us-east-1.amazonaws.com")
SMTP_PORT = int(_os.environ.get("SMTP_PORT", "587"))
SMTP_STARTTLS = True
SMTP_SSL = False
SMTP_SSL_SERVER_AUTH = True
SMTP_USER = _os.environ["SMTP_USER"]
SMTP_PASSWORD = _os.environ["SMTP_PASSWORD"]
SMTP_MAIL_FROM = _os.environ.get("SMTP_MAIL_FROM", "no-reply@lillio.com")
EMAIL_REPORTS_SUBJECT_PREFIX = "[Superset] "
ALERT_REPORTS_NOTIFICATION_DRY_RUN = False

WEBDRIVER_BASEURL = _os.environ.get("SUPERSET_PUBLIC_URL", "https://bitool.lillio.com")
WEBDRIVER_BASEURL_USER_FRIENDLY = WEBDRIVER_BASEURL

# Browser users authenticate through Okta, while the Lillio backend uses its
# database service account to request embedded-dashboard guest tokens.
AUTH_API_LOGIN_ALLOW_MULTIPLE_PROVIDERS = True

if _os.environ.get("OAUTH_CLIENT_ID"):
    from flask_appbuilder.security.manager import AUTH_OAUTH
    from custom_sso_security_manager import CustomSsoSecurityManager

    AUTH_TYPE = AUTH_OAUTH
    CUSTOM_SECURITY_MANAGER = CustomSsoSecurityManager
    AUTH_USER_REGISTRATION = True
    AUTH_USER_REGISTRATION_ROLE = _os.environ.get("OAUTH_DEFAULT_ROLE", "Public")
    AUTH_ROLES_SYNC_AT_LOGIN = True
    AUTH_ROLES_MAPPING = {
        "Superset Admin": ["Admin"],
        "Superset Alpha": ["Alpha"],
        "Superset Gamma": ["Gamma"],
        "Superset sql_lab": ["sql_lab"],
        "Superset Public": ["Public"],
    }

    OAUTH_PROVIDERS = [
        {
            "name": "okta",
            "icon": "fa-circle-o",
            "token_key": "access_token",
            "remote_app": {
                "client_id": _os.environ["OAUTH_CLIENT_ID"],
                "client_secret": _os.environ["OAUTH_CLIENT_SECRET"],
                "server_metadata_url": _os.environ["OAUTH_ISSUER"].rstrip("/")
                + "/.well-known/openid-configuration",
                "client_kwargs": {"scope": "openid email profile groups"},
            },
        }
    ]
    logger.info("Okta OIDC SSO enabled (AUTH_OAUTH)")
