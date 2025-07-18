"""
Configuration objects and complex types that can't be JSON serialized.

This module contains all the complex Python objects used in configuration
that need to be imported and used as actual Python objects rather than
simple JSON-serializable values.
"""

from collections import OrderedDict
from datetime import timedelta
from typing import Any

from superset.advanced_data_type.plugins.internet_address import internet_address
from superset.advanced_data_type.plugins.internet_port import internet_port
from superset.constants import CHANGE_ME_SECRET_KEY, NO_TIME_RANGE
from superset.db_engine_specs.utils import SQLAlchemyUtilsAdapter
from superset.extensions import feature_flag_manager
from superset.key_value.types import JsonKeyValueCodec
from superset.stats_logger import DummyStatsLogger
from superset.utils.core import parse_boolean_string
from superset.utils.log import DBEventLogger
from superset.utils.logging_configurator import DefaultLoggingConfigurator

# Define complex objects that can't be JSON serialized
COMPLEX_CONFIG_OBJECTS = {
    "STATS_LOGGER": DummyStatsLogger(),
    "EVENT_LOGGER": DBEventLogger(),
    "NO_TIME_RANGE": NO_TIME_RANGE,
    "CHANGE_ME_SECRET_KEY": CHANGE_ME_SECRET_KEY,
    "LOGGING_CONFIGURATOR": DefaultLoggingConfigurator(),
    "JSON_KEY_VALUE_CODEC": JsonKeyValueCodec(),
    "SQLALCHEMY_UTILS_ADAPTER": SQLAlchemyUtilsAdapter,
    "ADVANCED_DATA_TYPES": [internet_address, internet_port],
    "PARSE_BOOLEAN_STRING": parse_boolean_string,
    "FEATURE_FLAG_MANAGER": feature_flag_manager,
}

# Default collections and dictionaries
DEFAULT_COLLECTIONS = {
    "EXCEL_EXTENSIONS": {"xlsx", "xls"},
    "CSV_EXTENSIONS": {"csv", "tsv", "txt"},
    "COLUMNAR_EXTENSIONS": {"parquet", "zip"},
    "CURRENCIES": ["USD", "EUR", "GBP", "INR", "MXN", "JPY", "CNY"],
    "BLUEPRINTS": [],
    "ADDITIONAL_MIDDLEWARE": [],
    "CUSTOM_TEMPLATE_PROCESSORS": {},
    "ALLOWED_EXTRA_AUTHENTICATIONS": {},
    "DBS_AVAILABLE_DENYLIST": {},
    "QUERY_COST_FORMATTERS_BY_ENGINE": {},
    "SQLGLOT_DIALECTS_EXTENSIONS": {},
    "DB_POLL_INTERVAL_SECONDS": {},
    "DEFAULT_HTTP_HEADERS": {},
    "OVERRIDE_HTTP_HEADERS": {},
    "HTTP_HEADERS": {},
    "JINJA_CONTEXT_ADDONS": {},
    "WTF_CSRF_EXEMPT_LIST": [
        "superset.views.core.log",
        "superset.views.core.explore_json",
        "superset.charts.data.api.data",
        "superset.dashboards.api.cache_dashboard_screenshot",
    ],
    "ROBOT_PERMISSION_ROLES": ["Public", "Gamma", "Alpha", "Admin", "sql_lab"],
    "VIZ_TYPE_DENYLIST": [],
    "PREFERRED_DATABASES": [
        "PostgreSQL",
        "Presto",
        "MySQL",
        "SQLite",
    ],
    "DASHBOARD_AUTO_REFRESH_INTERVALS": [
        [0, "Don't refresh"],
        [10, "10 seconds"],
        [30, "30 seconds"],
        [60, "1 minute"],
        [300, "5 minutes"],
        [1800, "30 minutes"],
        [3600, "1 hour"],
        [21600, "6 hours"],
        [43200, "12 hours"],
        [86400, "24 hours"],
    ],
    "LANGUAGES": {
        "en": {"flag": "us", "name": "English"},
        "es": {"flag": "es", "name": "Spanish"},
        "it": {"flag": "it", "name": "Italian"},
        "fr": {"flag": "fr", "name": "French"},
        "zh": {"flag": "cn", "name": "Chinese"},
        "zh_TW": {"flag": "tw", "name": "Traditional Chinese"},
        "ja": {"flag": "jp", "name": "Japanese"},
        "pt": {"flag": "pt", "name": "Portuguese"},
        "pt_BR": {"flag": "br", "name": "Brazilian Portuguese"},
        "ru": {"flag": "ru", "name": "Russian"},
        "ko": {"flag": "kr", "name": "Korean"},
        "sk": {"flag": "sk", "name": "Slovak"},
        "sl": {"flag": "si", "name": "Slovenian"},
        "nl": {"flag": "nl", "name": "Dutch"},
        "uk": {"flag": "uk", "name": "Ukrainian"},
    },
    "FAVICONS": [{"href": "/static/assets/images/favicon.png"}],
    "PROXY_FIX_CONFIG": {
        "x_for": 1,
        "x_proto": 1,
        "x_host": 1,
        "x_port": 1,
        "x_prefix": 1,
    },
    "WEBDRIVER_WINDOW": {
        "dashboard": (1600, 2000),
        "slice": (3000, 1200),
        "pixel_density": 1,
    },
    "WEBDRIVER_CONFIGURATION": {
        "options": {"capabilities": {}, "preferences": {}, "binary_location": ""},
        "service": {
            "log_output": "/dev/null",
            "service_args": [],
            "port": 0,
            "env": {},
        },
    },
    "WEBDRIVER_OPTION_ARGS": ["--headless"],
    "CSV_EXPORT": {"encoding": "utf-8"},
    "EXCEL_EXPORT": {},
    "GLOBAL_ASYNC_QUERIES_CACHE_BACKEND": {
        "CACHE_TYPE": "RedisCache",
        "CACHE_REDIS_HOST": "localhost",
        "CACHE_REDIS_PORT": 6379,
        "CACHE_REDIS_USER": "",
        "CACHE_REDIS_PASSWORD": "",
        "CACHE_REDIS_DB": 0,
        "CACHE_DEFAULT_TIMEOUT": 300,
    },
    "TALISMAN_CONFIG": {
        "content_security_policy": {
            "base-uri": ["'self'"],
            "default-src": ["'self'"],
            "img-src": ["'self'", "blob:", "data:"],
            "worker-src": ["'self'", "blob:"],
            "connect-src": ["'self'"],
            "object-src": "'none'",
            "style-src": ["'self'", "'unsafe-inline'"],
            "script-src": ["'self'", "'strict-dynamic'"],
        },
        "content_security_policy_nonce_in": ["script-src"],
        "force_https": False,
        "session_cookie_secure": False,
    },
    "TALISMAN_DEV_CONFIG": {
        "content_security_policy": {
            "base-uri": ["'self'"],
            "default-src": ["'self'"],
            "img-src": ["'self'", "blob:", "data:"],
            "worker-src": ["'self'", "blob:"],
            "connect-src": ["'self'"],
            "object-src": "'none'",
            "style-src": ["'self'", "'unsafe-inline'"],
            "script-src": ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
        },
        "content_security_policy_nonce_in": ["script-src"],
        "force_https": False,
        "session_cookie_secure": False,
    },
}

# Cache configurations
CACHE_CONFIGS = {
    "CACHE_CONFIG": {"CACHE_TYPE": "NullCache"},
    "DATA_CACHE_CONFIG": {"CACHE_TYPE": "NullCache"},
    "THUMBNAIL_CACHE_CONFIG": {
        "CACHE_TYPE": "NullCache",
        "CACHE_DEFAULT_TIMEOUT": int(timedelta(days=7).total_seconds()),
        "CACHE_NO_NULL_WARNING": True,
    },
    "EXPLORE_FORM_DATA_CACHE_CONFIG": {
        "CACHE_TYPE": "NullCache",
        "CACHE_DEFAULT_TIMEOUT": int(timedelta(days=7).total_seconds()),
        "REFRESH_TIMEOUT_ON_RETRIEVAL": True,
        "CODEC": JsonKeyValueCodec(),
    },
}

# Computed values that depend on other variables
COMPUTED_VALUES = {
    "ALLOWED_EXTENSIONS": lambda: {
        *DEFAULT_COLLECTIONS["EXCEL_EXTENSIONS"],
        *DEFAULT_COLLECTIONS["CSV_EXTENSIONS"],
        *DEFAULT_COLLECTIONS["COLUMNAR_EXTENSIONS"],
    },
    "DEFAULT_MODULE_DS_MAP": lambda: OrderedDict(
        [
            ("superset.connectors.sqla.models", ["SqlaTable"]),
        ]
    ),
}

# Lambda functions and callables
LAMBDA_FUNCTIONS = {
    "TRACKING_URL_TRANSFORMER": lambda url: url,
    "SQLA_TABLE_MUTATOR": lambda table: table,
    "SQL_QUERY_MUTATOR": lambda sql, **kwargs: sql,
    "EMAIL_HEADER_MUTATOR": lambda msg, **kwargs: msg,
}

# Timeout values using timedelta
TIMEOUT_VALUES = {
    "SUPERSET_WEBSERVER_TIMEOUT": int(timedelta(minutes=1).total_seconds()),
    "CELERY_BEAT_SCHEDULER_EXPIRES": timedelta(weeks=1),
    "SQLLAB_TIMEOUT": int(timedelta(seconds=30).total_seconds()),
    "SQLLAB_VALIDATION_TIMEOUT": int(timedelta(seconds=10).total_seconds()),
    "SQLLAB_ASYNC_TIME_LIMIT_SEC": int(timedelta(hours=6).total_seconds()),
    "SQLLAB_QUERY_COST_ESTIMATE_TIMEOUT": int(timedelta(seconds=10).total_seconds()),
    "CACHE_DEFAULT_TIMEOUT": int(timedelta(days=1).total_seconds()),
    "THUMBNAIL_ERROR_CACHE_TTL": int(timedelta(days=1).total_seconds()),
    "SCREENSHOT_LOCATE_WAIT": int(timedelta(seconds=10).total_seconds()),
    "SCREENSHOT_LOAD_WAIT": int(timedelta(minutes=1).total_seconds()),
    "SCREENSHOT_PLAYWRIGHT_DEFAULT_TIMEOUT": int(
        timedelta(seconds=60).total_seconds() * 1000
    ),
    "WTF_CSRF_TIME_LIMIT": int(timedelta(weeks=1).total_seconds()),
    "EMAIL_PAGE_RENDER_WAIT": int(timedelta(seconds=30).total_seconds()),
    "TEST_DATABASE_CONNECTION_TIMEOUT": timedelta(seconds=30),
    "DATABASE_OAUTH2_TIMEOUT": timedelta(seconds=30),
    "SEND_FILE_MAX_AGE_DEFAULT": int(timedelta(days=365).total_seconds()),
    "GLOBAL_ASYNC_QUERIES_POLLING_DELAY": int(
        timedelta(milliseconds=500).total_seconds() * 1000
    ),
    "ALERT_REPORTS_WORKING_TIME_OUT_LAG": int(timedelta(seconds=10).total_seconds()),
    "ALERT_REPORTS_WORKING_SOFT_TIME_OUT_LAG": int(
        timedelta(seconds=1).total_seconds()
    ),
    "ALERT_MINIMUM_INTERVAL": int(timedelta(minutes=0).total_seconds()),
    "REPORT_MINIMUM_INTERVAL": int(timedelta(minutes=0).total_seconds()),
    "SLACK_CACHE_TIMEOUT": int(timedelta(days=1).total_seconds()),
}


def get_object_type_description(obj: Any) -> str:
    """Get a human-readable description of a Python object type."""
    if callable(obj):
        if hasattr(obj, "__name__"):
            # Try to get the full module path
            module = getattr(obj, "__module__", None)
            if module:
                return f"Function: {module}.{obj.__name__}"
            else:
                return f"Function: {obj.__name__}"
        else:
            return "Callable function"
    elif hasattr(obj, "__class__"):
        # Get fully qualified class name
        cls = obj.__class__
        module = getattr(cls, "__module__", None)
        if module and module != "builtins":
            return f"Instance of {module}.{cls.__name__}"
        else:
            return f"Instance of {cls.__name__}"
    else:
        # Get type information
        obj_type = type(obj)
        module = getattr(obj_type, "__module__", None)
        if module and module != "builtins":
            return f"Object of type {module}.{obj_type.__name__}"
        else:
            return f"Object of type {obj_type.__name__}"


def get_fully_qualified_type(obj: Any) -> str:
    """Get the fully qualified type name of an object."""
    if obj is None:
        return "NoneType"

    obj_type = type(obj)
    module = getattr(obj_type, "__module__", None)

    if module and module != "builtins":
        return f"{module}.{obj_type.__name__}"
    else:
        return obj_type.__name__


def get_default_for_complex_object(key: str) -> tuple[Any, str]:
    """Get a string representation and type of complex objects for documentation."""
    if key in COMPLEX_CONFIG_OBJECTS:
        obj = COMPLEX_CONFIG_OBJECTS[key]
        return f"<{get_object_type_description(obj)}>", get_fully_qualified_type(obj)
    elif key in DEFAULT_COLLECTIONS:
        obj = DEFAULT_COLLECTIONS[key]
        return obj, get_fully_qualified_type(obj)
    elif key in CACHE_CONFIGS:
        obj = CACHE_CONFIGS[key]
        return obj, get_fully_qualified_type(obj)
    elif key in COMPUTED_VALUES:
        # For computed values, try to call them to get the actual value
        try:
            func = COMPUTED_VALUES[key]
            obj = func()  # type: ignore
            return obj, get_fully_qualified_type(obj)
        except Exception:
            return f"<Computed: {key}>", "callable"
    elif key in LAMBDA_FUNCTIONS:
        obj = LAMBDA_FUNCTIONS[key]
        return "<Lambda function>", get_fully_qualified_type(obj)
    elif key in TIMEOUT_VALUES:
        obj = TIMEOUT_VALUES[key]
        return obj, get_fully_qualified_type(obj)
    else:
        return f"<Complex object: {key}>", "unknown"


def is_complex_object(key: str) -> bool:
    """Check if a configuration key represents a complex object."""
    return (
        key in COMPLEX_CONFIG_OBJECTS
        or key in COMPUTED_VALUES
        or key in LAMBDA_FUNCTIONS
    )


def get_object_import_info(obj: Any) -> dict[str, Any]:
    """Get import information for an object."""
    if hasattr(obj, "__module__") and hasattr(obj, "__name__"):
        return {
            "module": obj.__module__,
            "name": obj.__name__,
            "import_statement": f"from {obj.__module__} import {obj.__name__}",
        }
    elif hasattr(obj, "__class__"):
        cls = obj.__class__
        if hasattr(cls, "__module__"):
            return {
                "module": cls.__module__,
                "name": cls.__name__,
                "import_statement": f"from {cls.__module__} import {cls.__name__}",
            }

    return {"module": None, "name": str(type(obj).__name__), "import_statement": None}
