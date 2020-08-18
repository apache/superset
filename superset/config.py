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
"""The main config file for Superset

All configuration in this file can be overridden by providing a superset_config
in your PYTHONPATH as there is a ``from superset_config import *``
at the end of this file.
"""
import imp
import importlib.util
import json
import logging
import os
import sys
from collections import OrderedDict
from datetime import date
from typing import Any, Callable, Dict, List, Optional, Type, TYPE_CHECKING

from cachelib.base import BaseCache
from celery.schedules import crontab
from dateutil import tz
from flask import Blueprint
from flask_appbuilder.security.manager import AUTH_DB
from pandas.io.parsers import STR_NA_VALUES

from superset.jinja_context import (  # pylint: disable=unused-import
    BaseTemplateProcessor,
)
from superset.stats_logger import DummyStatsLogger
from superset.typing import CacheConfig
from superset.utils.log import DBEventLogger
from superset.utils.logging_configurator import DefaultLoggingConfigurator

logger = logging.getLogger(__name__)

if TYPE_CHECKING:
    from flask_appbuilder.security.sqla import models  # pylint: disable=unused-import
    from superset.models.core import Database  # pylint: disable=unused-import

# Realtime stats logger, a StatsD implementation exists
STATS_LOGGER = DummyStatsLogger()
EVENT_LOGGER = DBEventLogger()

SUPERSET_LOG_VIEW = True

BASE_DIR = os.path.abspath(os.path.dirname(__file__))
if "SUPERSET_HOME" in os.environ:
    DATA_DIR = os.environ["SUPERSET_HOME"]
else:
    DATA_DIR = os.path.join(os.path.expanduser("~"), ".superset")

# ---------------------------------------------------------
# Superset specific config
# ---------------------------------------------------------
VERSION_INFO_FILE = os.path.join(BASE_DIR, "static", "version_info.json")
PACKAGE_JSON_FILE = os.path.join(BASE_DIR, "static", "assets", "package.json")

# Multiple favicons can be specified here. The "href" property
# is mandatory, but "sizes," "type," and "rel" are optional.
# For example:
# {
#     "href":path/to/image.png",
#     "sizes": "16x16",
#     "type": "image/png"
#     "rel": "icon"
# },
FAVICONS = [{"href": "/static/assets/images/favicon.png"}]


def _try_json_readversion(filepath: str) -> Optional[str]:
    try:
        with open(filepath, "r") as f:
            return json.load(f).get("version")
    except Exception:  # pylint: disable=broad-except
        return None


def _try_json_readsha(  # pylint: disable=unused-argument
    filepath: str, length: int
) -> Optional[str]:
    try:
        with open(filepath, "r") as f:
            return json.load(f).get("GIT_SHA")[:length]
    except Exception:  # pylint: disable=broad-except
        return None


# Depending on the context in which this config is loaded, the
# version_info.json file may or may not be available, as it is
# generated on install via setup.py. In the event that we're
# actually running Superset, we will have already installed,
# therefore it WILL exist. When unit tests are running, however,
# it WILL NOT exist, so we fall back to reading package.json
VERSION_STRING = _try_json_readversion(VERSION_INFO_FILE) or _try_json_readversion(
    PACKAGE_JSON_FILE
)

VERSION_SHA_LENGTH = 8
VERSION_SHA = _try_json_readsha(VERSION_INFO_FILE, VERSION_SHA_LENGTH)

ROW_LIMIT = 50000
VIZ_ROW_LIMIT = 10000
# max rows retreieved when requesting samples from datasource in explore view
SAMPLES_ROW_LIMIT = 1000
# max rows retrieved by filter select auto complete
FILTER_SELECT_ROW_LIMIT = 10000
SUPERSET_WORKERS = 2  # deprecated
SUPERSET_CELERY_WORKERS = 32  # deprecated

SUPERSET_WEBSERVER_PROTOCOL = "http"
SUPERSET_WEBSERVER_ADDRESS = "0.0.0.0"
SUPERSET_WEBSERVER_PORT = 8088

# This is an important setting, and should be lower than your
# [load balancer / proxy / envoy / kong / ...] timeout settings.
# You should also make sure to configure your WSGI server
# (gunicorn, nginx, apache, ...) timeout setting to be <= to this setting
SUPERSET_WEBSERVER_TIMEOUT = 60

# this 2 settings are used by dashboard period force refresh feature
# When user choose auto force refresh frequency
# < SUPERSET_DASHBOARD_PERIODICAL_REFRESH_LIMIT
# they will see warning message in the Refresh Interval Modal.
# please check PR #9886
SUPERSET_DASHBOARD_PERIODICAL_REFRESH_LIMIT = 0
SUPERSET_DASHBOARD_PERIODICAL_REFRESH_WARNING_MESSAGE = None

SUPERSET_DASHBOARD_POSITION_DATA_LIMIT = 65535
CUSTOM_SECURITY_MANAGER = None
SQLALCHEMY_TRACK_MODIFICATIONS = False
# ---------------------------------------------------------

# Your App secret key
SECRET_KEY = (
    "\2\1thisismyscretkey\1\2\e\y\y\h"  # pylint: disable=anomalous-backslash-in-string
)

# The SQLAlchemy connection string.
SQLALCHEMY_DATABASE_URI = "sqlite:///" + os.path.join(DATA_DIR, "superset.db")
# SQLALCHEMY_DATABASE_URI = 'mysql://myapp@localhost/myapp'
# SQLALCHEMY_DATABASE_URI = 'postgresql://root:password@localhost/myapp'

# In order to hook up a custom password store for all SQLACHEMY connections
# implement a function that takes a single argument of type 'sqla.engine.url',
# returns a password and set SQLALCHEMY_CUSTOM_PASSWORD_STORE.
#
# e.g.:
# def lookup_password(url):
#     return 'secret'
# SQLALCHEMY_CUSTOM_PASSWORD_STORE = lookup_password
SQLALCHEMY_CUSTOM_PASSWORD_STORE = None

# The limit of queries fetched for query search
QUERY_SEARCH_LIMIT = 1000

# Flask-WTF flag for CSRF
WTF_CSRF_ENABLED = True

# Add endpoints that need to be exempt from CSRF protection
WTF_CSRF_EXEMPT_LIST = ["superset.views.core.log", "superset.charts.api.data"]

# Whether to run the web server in debug mode or not
DEBUG = os.environ.get("FLASK_ENV") == "development"
FLASK_USE_RELOAD = True

# Superset allows server-side python stacktraces to be surfaced to the
# user when this feature is on. This may has security implications
# and it's more secure to turn it off in production settings.
SHOW_STACKTRACE = True

# Use all X-Forwarded headers when ENABLE_PROXY_FIX is True.
# When proxying to a different port, set "x_port" to 0 to avoid downstream issues.
ENABLE_PROXY_FIX = False
PROXY_FIX_CONFIG = {"x_for": 1, "x_proto": 1, "x_host": 1, "x_port": 1, "x_prefix": 1}

# ------------------------------
# GLOBALS FOR APP Builder
# ------------------------------
# Uncomment to setup Your App name
APP_NAME = "Superset"

# Uncomment to setup an App icon
APP_ICON = "/static/assets/images/superset-logo-horiz.png"
APP_ICON_WIDTH = 126

# Uncomment to specify where clicking the logo would take the user
# e.g. setting it to '/welcome' would take the user to '/superset/welcome'
LOGO_TARGET_PATH = None

# Enables SWAGGER UI for superset openapi spec
# ex: http://localhost:8080/swagger/v1
FAB_API_SWAGGER_UI = True

# Druid query timezone
# tz.tzutc() : Using utc timezone
# tz.tzlocal() : Using local timezone
# tz.gettz('Asia/Shanghai') : Using the time zone with specific name
# [TimeZone List]
# See: https://en.wikipedia.org/wiki/List_of_tz_database_time_zones
# other tz can be overridden by providing a local_config
DRUID_TZ = tz.tzutc()
DRUID_ANALYSIS_TYPES = ["cardinality"]

# Legacy Druid NoSQL (native) connector
# Druid supports a SQL interface in its newer versions.
# Setting this flag to True enables the deprecated, API-based Druid
# connector. This feature may be removed at a future date.
DRUID_IS_ACTIVE = False

# If Druid is active whether to include the links to scan/refresh Druid datasources.
# This should be disabled if you are trying to wean yourself off of the Druid NoSQL
# connector.
DRUID_METADATA_LINKS_ENABLED = True

# ----------------------------------------------------
# AUTHENTICATION CONFIG
# ----------------------------------------------------
# The authentication type
# AUTH_OID : Is for OpenID
# AUTH_DB : Is for database (username/password)
# AUTH_LDAP : Is for LDAP
# AUTH_REMOTE_USER : Is for using REMOTE_USER from web server
# AUTH_TYPE = AUTH_DB

# Uncomment to setup Full admin role name
# AUTH_ROLE_ADMIN = 'Admin'

# Uncomment to setup Public role name, no authentication needed
# AUTH_ROLE_PUBLIC = 'Public'

# Will allow user self registration
# AUTH_USER_REGISTRATION = True

# The default user self registration role
# AUTH_USER_REGISTRATION_ROLE = "Public"

# When using LDAP Auth, setup the LDAP server
# AUTH_LDAP_SERVER = "ldap://ldapserver.new"

# Uncomment to setup OpenID providers example for OpenID authentication
# OPENID_PROVIDERS = [
#    { 'name': 'Yahoo', 'url': 'https://open.login.yahoo.com/' },
#    { 'name': 'Flickr', 'url': 'https://www.flickr.com/<username>' },

# ---------------------------------------------------
# Roles config
# ---------------------------------------------------
# Grant public role the same set of permissions as for the GAMMA role.
# This is useful if one wants to enable anonymous users to view
# dashboards. Explicit grant on specific datasets is still required.
PUBLIC_ROLE_LIKE_GAMMA = False

# ---------------------------------------------------
# Babel config for translations
# ---------------------------------------------------
# Setup default language
BABEL_DEFAULT_LOCALE = "zh"
# Your application default translation path
BABEL_DEFAULT_FOLDER = "superset/translations"
# The allowed translation for you app
LANGUAGES = {
    "en": {"flag": "us", "name": "English"},
    "es": {"flag": "es", "name": "Spanish"},
    "it": {"flag": "it", "name": "Italian"},
    "fr": {"flag": "fr", "name": "French"},
    "zh": {"flag": "cn", "name": "Chinese"},
    "ja": {"flag": "jp", "name": "Japanese"},
    "de": {"flag": "de", "name": "German"},
    "pt": {"flag": "pt", "name": "Portuguese"},
    "pt_BR": {"flag": "br", "name": "Brazilian Portuguese"},
    "ru": {"flag": "ru", "name": "Russian"},
    "ko": {"flag": "kr", "name": "Korean"},
}

# ---------------------------------------------------
# Feature flags
# ---------------------------------------------------
# Feature flags that are set by default go here. Their values can be
# overwritten by those specified under FEATURE_FLAGS in super_config.py
# For example, DEFAULT_FEATURE_FLAGS = { 'FOO': True, 'BAR': False } here
# and FEATURE_FLAGS = { 'BAR': True, 'BAZ': True } in superset_config.py
# will result in combined feature flags of { 'FOO': True, 'BAR': True, 'BAZ': True }
DEFAULT_FEATURE_FLAGS: Dict[str, bool] = {
    # Experimental feature introducing a client (browser) cache
    "CLIENT_CACHE": False,
    "ENABLE_EXPLORE_JSON_CSRF_PROTECTION": False,
    "KV_STORE": False,
    "PRESTO_EXPAND_DATA": False,
    # Exposes API endpoint to compute thumbnails
    "THUMBNAILS": False,
    "REDUCE_DASHBOARD_BOOTSTRAP_PAYLOAD": True,
    "SHARE_QUERIES_VIA_KV_STORE": False,
    "SIP_38_VIZ_REARCHITECTURE": False,
    "TAGGING_SYSTEM": False,
    "SQLLAB_BACKEND_PERSISTENCE": False,
    "LIST_VIEWS_SIP34_FILTER_UI": False,
}

# This is merely a default.
FEATURE_FLAGS: Dict[str, bool] = {}

# A function that receives a dict of all feature flags
# (DEFAULT_FEATURE_FLAGS merged with FEATURE_FLAGS)
# can alter it, and returns a similar dict. Note the dict of feature
# flags passed to the function is a deepcopy of the dict in the config,
# and can therefore be mutated without side-effect
#
# GET_FEATURE_FLAGS_FUNC can be used to implement progressive rollouts,
# role-based features, or a full on A/B testing framework.
#
# from flask import g, request
# def GET_FEATURE_FLAGS_FUNC(feature_flags_dict: Dict[str, bool]) -> Dict[str, bool]:
#     if hasattr(g, "user") and g.user.is_active:
#         feature_flags_dict['some_feature'] = g.user and g.user.id == 5
#     return feature_flags_dict
GET_FEATURE_FLAGS_FUNC: Optional[Callable[[Dict[str, bool]], Dict[str, bool]]] = None

# ---------------------------------------------------
# Thumbnail config (behind feature flag)
# ---------------------------------------------------
THUMBNAIL_SELENIUM_USER = "Admin"
THUMBNAIL_CACHE_CONFIG: CacheConfig = {
    "CACHE_TYPE": "null",
    "CACHE_NO_NULL_WARNING": True,
}

# ---------------------------------------------------
# Image and file configuration
# ---------------------------------------------------
# The file upload folder, when using models with files
UPLOAD_FOLDER = BASE_DIR + "/app/static/uploads/"
UPLOAD_CHUNK_SIZE = 4096

# The image upload folder, when using models with images
IMG_UPLOAD_FOLDER = BASE_DIR + "/app/static/uploads/"

# The image upload url, when using models with images
IMG_UPLOAD_URL = "/static/uploads/"
# Setup image size default is (300, 200, True)
# IMG_SIZE = (300, 200, True)

CACHE_DEFAULT_TIMEOUT = 60 * 60 * 24
CACHE_CONFIG: CacheConfig = {"CACHE_TYPE": "null"}
TABLE_NAMES_CACHE_CONFIG: CacheConfig = {"CACHE_TYPE": "null"}

# CORS Options
ENABLE_CORS = False
CORS_OPTIONS: Dict[Any, Any] = {}

# Chrome allows up to 6 open connections per domain at a time. When there are more
# than 6 slices in dashboard, a lot of time fetch requests are queued up and wait for
# next available socket. PR #5039 is trying to allow domain sharding for Superset,
# and this feature will be enabled by configuration only (by default Superset
# doesn't allow cross-domain request).
SUPERSET_WEBSERVER_DOMAINS = None

# Allowed format types for upload on Database view
EXCEL_EXTENSIONS = {"xlsx", "xls"}
CSV_EXTENSIONS = {"csv", "tsv", "txt"}
ALLOWED_EXTENSIONS = {*EXCEL_EXTENSIONS, *CSV_EXTENSIONS}

# CSV Options: key/value pairs that will be passed as argument to DataFrame.to_csv
# method.
# note: index option should not be overridden
CSV_EXPORT = {"encoding": "utf-8"}

# ---------------------------------------------------
# Time grain configurations
# ---------------------------------------------------
# List of time grains to disable in the application (see list of builtin
# time grains in superset/db_engine_specs.builtin_time_grains).
# For example: to disable 1 second time grain:
# TIME_GRAIN_DENYLIST = ['PT1S']
TIME_GRAIN_DENYLIST: List[str] = []

# Additional time grains to be supported using similar definitions as in
# superset/db_engine_specs.builtin_time_grains.
# For example: To add a new 2 second time grain:
# TIME_GRAIN_ADDONS = {'PT2S': '2 second'}
TIME_GRAIN_ADDONS: Dict[str, str] = {}

# Implementation of additional time grains per engine.
# The column to be truncated is denoted `{col}` in the expression.
# For example: To implement 2 second time grain on clickhouse engine:
# TIME_GRAIN_ADDON_EXPRESSIONS = {
#     'clickhouse': {
#         'PT2S': 'toDateTime(intDiv(toUInt32(toDateTime({col})), 2)*2)'
#     }
# }
TIME_GRAIN_ADDON_EXPRESSIONS: Dict[str, Dict[str, str]] = {}

# ---------------------------------------------------
# List of viz_types not allowed in your environment
# For example: Disable pivot table and treemap:
#  VIZ_TYPE_DENYLIST = ['pivot_table', 'treemap']
# ---------------------------------------------------

VIZ_TYPE_DENYLIST: List[str] = []

# ---------------------------------------------------
# List of data sources not to be refreshed in druid cluster
# ---------------------------------------------------

DRUID_DATA_SOURCE_DENYLIST: List[str] = []

# --------------------------------------------------
# Modules, datasources and middleware to be registered
# --------------------------------------------------
DEFAULT_MODULE_DS_MAP = OrderedDict(
    [
        ("superset.connectors.sqla.models", ["SqlaTable"]),
        ("superset.connectors.druid.models", ["DruidDatasource"]),
    ]
)
ADDITIONAL_MODULE_DS_MAP: Dict[str, List[str]] = {}
ADDITIONAL_MIDDLEWARE: List[Callable[..., Any]] = []

# 1) https://docs.python-guide.org/writing/logging/
# 2) https://docs.python.org/2/library/logging.config.html

# Default configurator will consume the LOG_* settings below
LOGGING_CONFIGURATOR = DefaultLoggingConfigurator()

# Console Log Settings

LOG_FORMAT = "%(asctime)s:%(levelname)s:%(name)s:%(message)s"
LOG_LEVEL = "DEBUG"

# ---------------------------------------------------
# Enable Time Rotate Log Handler
# ---------------------------------------------------
# LOG_LEVEL = DEBUG, INFO, WARNING, ERROR, CRITICAL

ENABLE_TIME_ROTATE = False
TIME_ROTATE_LOG_LEVEL = "DEBUG"
FILENAME = os.path.join(DATA_DIR, "superset.log")
ROLLOVER = "midnight"
INTERVAL = 1
BACKUP_COUNT = 30

# Custom logger for auditing queries. This can be used to send ran queries to a
# structured immutable store for auditing purposes. The function is called for
# every query ran, in both SQL Lab and charts/dashboards.
# def QUERY_LOGGER(
#     database,
#     query,
#     schema=None,
#     user=None,
#     client=None,
#     security_manager=None,
#     log_params=None,
# ):
#     pass
QUERY_LOGGER = None

# Set this API key to enable Mapbox visualizations
MAPBOX_API_KEY = os.environ.get("MAPBOX_API_KEY", "")

# Maximum number of rows returned from a database
# in async mode, no more than SQL_MAX_ROW will be returned and stored
# in the results backend. This also becomes the limit when exporting CSVs
SQL_MAX_ROW = 100000

# Maximum number of rows displayed in SQL Lab UI
# Is set to avoid out of memory/localstorage issues in browsers. Does not affect
# exported CSVs
DISPLAY_MAX_ROW = 10000

# Default row limit for SQL Lab queries. Is overridden by setting a new limit in
# the SQL Lab UI
DEFAULT_SQLLAB_LIMIT = 1000

# Maximum number of tables/views displayed in the dropdown window in SQL Lab.
MAX_TABLE_NAMES = 3000

# Adds a warning message on sqllab save query and schedule query modals.
SQLLAB_SAVE_WARNING_MESSAGE = None
SQLLAB_SCHEDULE_WARNING_MESSAGE = None

# If defined, shows this text in an alert-warning box in the navbar
# one example use case may be "STAGING" to make it clear that this is
# not the production version of the site.
WARNING_MSG = None

# Default celery config is to use SQLA as a broker, in a production setting
# you'll want to use a proper broker as specified here:
# http://docs.celeryproject.org/en/latest/getting-started/brokers/index.html


class CeleryConfig:  # pylint: disable=too-few-public-methods
    BROKER_URL = "sqla+sqlite:///celerydb.sqlite"
    CELERY_IMPORTS = ("superset.sql_lab", "superset.tasks")
    CELERY_RESULT_BACKEND = "db+sqlite:///celery_results.sqlite"
    CELERYD_LOG_LEVEL = "DEBUG"
    CELERYD_PREFETCH_MULTIPLIER = 1
    CELERY_ACKS_LATE = False
    CELERY_ANNOTATIONS = {
        "sql_lab.get_sql_results": {"rate_limit": "100/s"},
        "email_reports.send": {
            "rate_limit": "1/s",
            "time_limit": 120,
            "soft_time_limit": 150,
            "ignore_result": True,
        },
    }
    CELERYBEAT_SCHEDULE = {
        "email_reports.schedule_hourly": {
            "task": "email_reports.schedule_hourly",
            "schedule": crontab(minute=1, hour="*"),
        }
    }


CELERY_CONFIG = CeleryConfig  # pylint: disable=invalid-name

# Set celery config to None to disable all the above configuration
# CELERY_CONFIG = None

# Additional static HTTP headers to be served by your Superset server. Note
# Flask-Talisman applies the relevant security HTTP headers.
#
# DEFAULT_HTTP_HEADERS: sets default values for HTTP headers. These may be overridden
# within the app
# OVERRIDE_HTTP_HEADERS: sets override values for HTTP headers. These values will
# override anything set within the app
DEFAULT_HTTP_HEADERS: Dict[str, Any] = {}
OVERRIDE_HTTP_HEADERS: Dict[str, Any] = {}
HTTP_HEADERS: Dict[str, Any] = {}

# The db id here results in selecting this one as a default in SQL Lab
DEFAULT_DB_ID = None

# Timeout duration for SQL Lab synchronous queries
SQLLAB_TIMEOUT = 30

# Timeout duration for SQL Lab query validation
SQLLAB_VALIDATION_TIMEOUT = 10

# SQLLAB_DEFAULT_DBID
SQLLAB_DEFAULT_DBID = None

# The MAX duration (in seconds) a query can run for before being killed
# by celery.
SQLLAB_ASYNC_TIME_LIMIT_SEC = 60 * 60 * 6

# Some databases support running EXPLAIN queries that allow users to estimate
# query costs before they run. These EXPLAIN queries should have a small
# timeout.
SQLLAB_QUERY_COST_ESTIMATE_TIMEOUT = 10  # seconds

# Flag that controls if limit should be enforced on the CTA (create table as queries).
SQLLAB_CTAS_NO_LIMIT = False

# This allows you to define custom logic around the "CREATE TABLE AS" or CTAS feature
# in SQL Lab that defines where the target schema should be for a given user.
# Database `CTAS Schema` has a precedence over this setting.
# Example below returns a username and CTA queries will write tables into the schema
# name `username`
# SQLLAB_CTAS_SCHEMA_NAME_FUNC = lambda database, user, schema, sql: user.username
# This is move involved example where depending on the database you can leverage data
# available to assign schema for the CTA query:
# def compute_schema_name(database: Database, user: User, schema: str, sql: str) -> str:
#     if database.name == 'mysql_payments_slave':
#         return 'tmp_superset_schema'
#     if database.name == 'presto_gold':
#         return user.username
#     if database.name == 'analytics':
#         if 'analytics' in [r.name for r in user.roles]:
#             return 'analytics_cta'
#         else:
#             return f'tmp_{schema}'
# Function accepts database object, user object, schema name and sql that will be run.
SQLLAB_CTAS_SCHEMA_NAME_FUNC: Optional[
    Callable[["Database", "models.User", str, str], str]
] = None

# If enabled, it can be used to store the results of long-running queries
# in SQL Lab by using the "Run Async" button/feature
RESULTS_BACKEND: Optional[BaseCache] = None

# Use PyArrow and MessagePack for async query results serialization,
# rather than JSON. This feature requires additional testing from the
# community before it is fully adopted, so this config option is provided
# in order to disable should breaking issues be discovered.
RESULTS_BACKEND_USE_MSGPACK = True

# The S3 bucket where you want to store your external hive tables created
# from CSV files. For example, 'companyname-superset'
CSV_TO_HIVE_UPLOAD_S3_BUCKET = None

# The directory within the bucket specified above that will
# contain all the external tables
CSV_TO_HIVE_UPLOAD_DIRECTORY = "EXTERNAL_HIVE_TABLES/"
# Function that creates upload directory dynamically based on the
# database used, user and schema provided.
CSV_TO_HIVE_UPLOAD_DIRECTORY_FUNC: Callable[
    ["Database", "models.User", str], Optional[str]
] = lambda database, user, schema: CSV_TO_HIVE_UPLOAD_DIRECTORY

# The namespace within hive where the tables created from
# uploading CSVs will be stored.
UPLOADED_CSV_HIVE_NAMESPACE: Optional[str] = None

# Function that computes the allowed schemas for the CSV uploads.
# Allowed schemas will be a union of schemas_allowed_for_csv_upload
# db configuration and a result of this function.

# mypy doesn't catch that if case ensures list content being always str
ALLOWED_USER_CSV_SCHEMA_FUNC: Callable[
    ["Database", "models.User"], List[str]
] = lambda database, user: [
    UPLOADED_CSV_HIVE_NAMESPACE
] if UPLOADED_CSV_HIVE_NAMESPACE else []

# Values that should be treated as nulls for the csv uploads.
CSV_DEFAULT_NA_NAMES = list(STR_NA_VALUES)

# A dictionary of items that gets merged into the Jinja context for
# SQL Lab. The existing context gets updated with this dictionary,
# meaning values for existing keys get overwritten by the content of this
# dictionary.
JINJA_CONTEXT_ADDONS: Dict[str, Callable[..., Any]] = {}

# A dictionary of macro template processors that gets merged into global
# template processors. The existing template processors get updated with this
# dictionary, which means the existing keys get overwritten by the content of this
# dictionary. The customized addons don't necessarily need to use jinjia templating
# language. This allows you to define custom logic to process macro template.
CUSTOM_TEMPLATE_PROCESSORS: Dict[str, Type[BaseTemplateProcessor]] = {}

# Roles that are controlled by the API / Superset and should not be changes
# by humans.
ROBOT_PERMISSION_ROLES = ["Public", "Gamma", "Alpha", "Admin", "sql_lab"]

CONFIG_PATH_ENV_VAR = "SUPERSET_CONFIG_PATH"

# If a callable is specified, it will be called at app startup while passing
# a reference to the Flask app. This can be used to alter the Flask app
# in whatever way.
# example: FLASK_APP_MUTATOR = lambda x: x.before_request = f
FLASK_APP_MUTATOR = None

# Set this to false if you don't want users to be able to request/grant
# datasource access requests from/to other users.
ENABLE_ACCESS_REQUEST = False

# smtp server configuration
EMAIL_NOTIFICATIONS = False  # all the emails are sent using dryrun
SMTP_HOST = "localhost"
SMTP_STARTTLS = True
SMTP_SSL = False
SMTP_USER = "superset"
SMTP_PORT = 25
SMTP_PASSWORD = "superset"
SMTP_MAIL_FROM = "superset@superset.com"

ENABLE_CHUNK_ENCODING = False

# Whether to bump the logging level to ERROR on the flask_appbuilder package
# Set to False if/when debugging FAB related issues like
# permission management
SILENCE_FAB = True

FAB_ADD_SECURITY_VIEWS = True
FAB_ADD_SECURITY_PERMISSION_VIEW = False
FAB_ADD_SECURITY_VIEW_MENU_VIEW = False
FAB_ADD_SECURITY_PERMISSION_VIEWS_VIEW = False

# The link to a page containing common errors and their resolutions
# It will be appended at the bottom of sql_lab errors.
TROUBLESHOOTING_LINK = ""

# CSRF token timeout, set to None for a token that never expires
WTF_CSRF_TIME_LIMIT = 60 * 60 * 24 * 7

# This link should lead to a page with instructions on how to gain access to a
# Datasource. It will be placed at the bottom of permissions errors.
PERMISSION_INSTRUCTIONS_LINK = ""

# Integrate external Blueprints to the app by passing them to your
# configuration. These blueprints will get integrated in the app
BLUEPRINTS: List[Blueprint] = []

# Provide a callable that receives a tracking_url and returns another
# URL. This is used to translate internal Hadoop job tracker URL
# into a proxied one
TRACKING_URL_TRANSFORMER = lambda x: x

# Interval between consecutive polls when using Hive Engine
HIVE_POLL_INTERVAL = 5

# Allow for javascript controls components
# this enables programmers to customize certain charts (like the
# geospatial ones) by inputing javascript in controls. This exposes
# an XSS security vulnerability
ENABLE_JAVASCRIPT_CONTROLS = False

# The id of a template dashboard that should be copied to every new user
DASHBOARD_TEMPLATE_ID = None

# A callable that allows altering the database conneciton URL and params
# on the fly, at runtime. This allows for things like impersonation or
# arbitrary logic. For instance you can wire different users to
# use different connection parameters, or pass their email address as the
# username. The function receives the connection uri object, connection
# params, the username, and returns the mutated uri and params objects.
# Example:
#   def DB_CONNECTION_MUTATOR(uri, params, username, security_manager, source):
#       user = security_manager.find_user(username=username)
#       if user and user.email:
#           uri.username = user.email
#       return uri, params
#
# Note that the returned uri and params are passed directly to sqlalchemy's
# as such `create_engine(url, **params)`
DB_CONNECTION_MUTATOR = None

# A function that intercepts the SQL to be executed and can alter it.
# The use case is can be around adding some sort of comment header
# with information such as the username and worker node information
#
#    def SQL_QUERY_MUTATOR(sql, username, security_manager):
#        dttm = datetime.now().isoformat()
#        return f"-- [SQL LAB] {username} {dttm}\n{sql}"
SQL_QUERY_MUTATOR = None

# Enable / disable scheduled email reports
ENABLE_SCHEDULED_EMAIL_REPORTS = False

# Enable / disable Alerts, where users can define custom SQL that
# will send emails with screenshots of charts or dashboards periodically
# if it meets the criteria
ENABLE_ALERTS = False

# Slack API token for the superset reports
SLACK_API_TOKEN = None
SLACK_PROXY = None

# If enabled, certail features are run in debug mode
# Current list:
# * Emails are sent using dry-run mode (logging only)
SCHEDULED_EMAIL_DEBUG_MODE = False

# Email reports - minimum time resolution (in minutes) for the crontab
EMAIL_REPORTS_CRON_RESOLUTION = 15

# The MAX duration (in seconds) a email schedule can run for before being killed
# by celery.
EMAIL_ASYNC_TIME_LIMIT_SEC = 300

# Email report configuration
# From address in emails
EMAIL_REPORT_FROM_ADDRESS = "reports@superset.org"

# Send bcc of all reports to this address. Set to None to disable.
# This is useful for maintaining an audit trail of all email deliveries.
EMAIL_REPORT_BCC_ADDRESS = None

# User credentials to use for generating reports
# This user should have permissions to browse all the dashboards and
# slices.
# TODO: In the future, login as the owner of the item to generate reports
EMAIL_REPORTS_USER = "admin"
EMAIL_REPORTS_SUBJECT_PREFIX = "[Report] "

# The webdriver to use for generating reports. Use one of the following
# firefox
#   Requires: geckodriver and firefox installations
#   Limitations: can be buggy at times
# chrome:
#   Requires: headless chrome
#   Limitations: unable to generate screenshots of elements
EMAIL_REPORTS_WEBDRIVER = "firefox"

# Window size - this will impact the rendering of the data
WEBDRIVER_WINDOW = {"dashboard": (1600, 2000), "slice": (3000, 1200)}

# Any config options to be passed as-is to the webdriver
WEBDRIVER_CONFIGURATION: Dict[Any, Any] = {}

# The base URL to query for accessing the user interface
WEBDRIVER_BASEURL = "http://0.0.0.0:8080/"
# The base URL for the email report hyperlinks.
WEBDRIVER_BASEURL_USER_FRIENDLY = WEBDRIVER_BASEURL
# Time in seconds, selenium will wait for the page to load
# and render for the email report.
EMAIL_PAGE_RENDER_WAIT = 30

# Send user to a link where they can report bugs
BUG_REPORT_URL = None

# Send user to a link where they can read more about Superset
DOCUMENTATION_URL = None
DOCUMENTATION_TEXT = "Documentation"
DOCUMENTATION_ICON = None  # Recommended size: 16x16

# Enables the replacement react views for all the FAB views (list, edit, show) with
# designs introduced in SIP-34: https://github.com/apache/incubator-superset/issues/8976
# This is a work in progress so not all features available in FAB have been implemented
ENABLE_REACT_CRUD_VIEWS = False

# What is the Last N days relative in the time selector to:
# 'today' means it is midnight (00:00:00) in the local timezone
# 'now' means it is relative to the query issue time
# If both start and end time is set to now, this will make the time
# filter a moving window. By only setting the end time to now,
# start time will be set to midnight, while end will be relative to
# the query issue time.
DEFAULT_RELATIVE_START_TIME = "today"
DEFAULT_RELATIVE_END_TIME = "today"

# Configure which SQL validator to use for each engine
SQL_VALIDATORS_BY_ENGINE = {"presto": "PrestoDBSQLValidator"}

# Do you want Talisman enabled?
TALISMAN_ENABLED = False
# If you want Talisman, how do you want it configured??
TALISMAN_CONFIG = {
    "content_security_policy": None,
    "force_https": True,
    "force_https_permanent": False,
}

# Note that: RowLevelSecurityFilter is only given by default to the Admin role
# and the Admin Role does have the all_datasources security permission.
# But, if users create a specific role with access to RowLevelSecurityFilter MVC
# and a custom datasource access, the table dropdown will not be correctly filtered
# by that custom datasource access. So we are assuming a default security config,
# a custom security config could potentially give access to setting filters on
# tables that users do not have access to.
ENABLE_ROW_LEVEL_SECURITY = False

#
# Flask session cookie options
#
# See https://flask.palletsprojects.com/en/1.1.x/security/#set-cookie-options
# for details
#
SESSION_COOKIE_HTTPONLY = True  # Prevent cookie from being read by frontend JS?
SESSION_COOKIE_SECURE = False  # Prevent cookie from being transmitted over non-tls?
SESSION_COOKIE_SAMESITE = "Lax"  # One of [None, 'Lax', 'Strict']

# Flask configuration variables
SEND_FILE_MAX_AGE_DEFAULT = 60 * 60 * 24 * 365  # Cache static resources

# URI to database storing the example data, points to
# SQLALCHEMY_DATABASE_URI by default if set to `None`
SQLALCHEMY_EXAMPLES_URI = None

# Some sqlalchemy connection strings can open Superset to security risks.
# Typically these should not be allowed.
PREVENT_UNSAFE_DB_CONNECTIONS = True

# Path used to store SSL certificates that are generated when using custom certs.
# Defaults to temporary directory.
# Example: SSL_CERT_PATH = "/certs"
SSL_CERT_PATH: Optional[str] = None

# SIP-15 should be enabled for all new Superset deployments which ensures that the time
# range endpoints adhere to [start, end). For existing deployments admins should provide
# a dedicated period of time to allow chart producers to update their charts before
# mass migrating all charts to use the [start, end) interval.
#
# Note if no end date for the grace period is specified then the grace period is
# indefinite.
SIP_15_ENABLED = True
SIP_15_GRACE_PERIOD_END: Optional[date] = None  # exclusive
SIP_15_DEFAULT_TIME_RANGE_ENDPOINTS = ["unknown", "inclusive"]
SIP_15_TOAST_MESSAGE = (
    "Action Required: Preview then save your chart using the "
    'new time range endpoints <a target="_blank" href="{url}" '
    'class="alert-link">here</a>.'
)


# SQLA table mutator, every time we fetch the metadata for a certain table
# (superset.connectors.sqla.models.SqlaTable), we call this hook
# to allow mutating the object with this callback.
# This can be used to set any properties of the object based on naming
# conventions and such. You can find examples in the tests.
SQLA_TABLE_MUTATOR = lambda table: table

if CONFIG_PATH_ENV_VAR in os.environ:
    # Explicitly import config module that is not necessarily in pythonpath; useful
    # for case where app is being executed via pex.
    try:
        cfg_path = os.environ[CONFIG_PATH_ENV_VAR]
        module = sys.modules[__name__]
        override_conf = imp.load_source("superset_config", cfg_path)
        for key in dir(override_conf):
            if key.isupper():
                setattr(module, key, getattr(override_conf, key))

        print(f"Loaded your LOCAL configuration at [{cfg_path}]")
    except Exception:
        logger.exception(
            "Failed to import config for %s=%s", CONFIG_PATH_ENV_VAR, cfg_path
        )
        raise
elif importlib.util.find_spec("superset_config"):
    try:
        from superset_config import *  # pylint: disable=import-error,wildcard-import,unused-wildcard-import
        import superset_config  # pylint: disable=import-error

        print(f"Loaded your LOCAL configuration at [{superset_config.__file__}]")
    except Exception:
        logger.exception("Found but failed to import local superset_config")
        raise

from flask_appbuilder.security.manager import AUTH_OAUTH
import os
import logging
import json
import jwt
import re
import binascii
import base64
import requests

from flask import Flask
from flask import request, redirect, flash
from flask_login import logout_user, login_user
from flask_appbuilder.api import expose
from flask_appbuilder.security.views import AuthOAuthView
from Crypto.Cipher import AES
from Crypto.Util import Counter
from Crypto.Util.number import bytes_to_long
from datetime import datetime
from jose import jws
from logstash_async.handler import AsynchronousLogstashHandler
from logstash_async.formatter import FlaskLogstashFormatter
from superset import db
from superset.security import SupersetSecurityManager

SQLALCHEMY_DATABASE_URI = 'postgresql://'+os.environ['username']+':'+os.environ['password']+'@cn-testing-write-cn-northwest-1.cvnuvxsizepf.rds.cn-northwest-1.amazonaws.com.cn/superset'
CACHE_CONFIG = {'CACHE_TYPE': 'simple'}
LANGUAGES = {
    'zh': {'flag': 'cn', 'name': 'Chinese'},
}

# Config superset to authorize by improbable auth system.
# See https://superset.apache.org/installation.html#custom-oauth2-configuration
CONSOLE_ROOT = 'https://console-cn-testing.spatialoschina.com'
API_BASE_URL = 'https://auth-cn-testing.spatialoschina.com'
AUTH_TYPE = AUTH_OAUTH
AUTH_USER_REGISTRATION = True
AUTH_USER_REGISTRATION_ROLE = "View"
ENABLE_ROW_LEVEL_SECURITY = True
CSRF_ENABLED = True
OAUTH_PROVIDERS = [
    {
        'name': 'Improbable',
        'token_key': 'access_token',  # Name of the token in the response of access_token_url
        'icon': 'fa-user-circle',  # Icon for the provider
        'remote_app': {
            'client_id': os.getenv("SUPERSET_OAUTH_KEY", ""),  # Client Id (Identify Superset application)
            'client_secret': os.getenv("SUPERSET_OAUTH_SECRET", ""),  # Secret for this Client Id (Identify Superset application)
            'client_kwargs': {
                'scope': '[r]:auth/acc/* [r]:org/* [r]:prj/*'  # Scope for the Authorization
            },
            'access_token_method': 'POST',  # HTTP Method to call access_token_url
            'access_token_params': {  # Additional parameters for calls to access_token_url
                'client_id': os.getenv("SUPERSET_OAUTH_KEY", "")
            },
            'access_token_headers': {  # Additional headers for calls to access_token_url
                'Authorization': 'Basic Base64EncodedClientIdAndSecret'
            },
            'api_base_url': API_BASE_URL + '/auth/v1/',
            'access_token_url': API_BASE_URL + '/auth/v1/token',
            'authorize_url': API_BASE_URL + '/auth/v1/authorize'
        }
    }
]

# Send runtime logs to logstash through tcp conn asynchronously.
# See https://www.techchorus.net/blog/logging-from-flask-application-to-elasticsearch-via-logstash/
app = Flask(__name__)
LOGSTASH_HOST = os.getenv("LOGSTASH_INFRA_HOST", "")
LOGSTASH_DB_PATH = "/var/log/superset/logstash.db"
LOGSTASH_TRANSPORT = "logstash_async.transport.TcpTransport"
LOGSTASH_PORT = os.getenv("LOGSTASH_INFRA_PORT", "")
logstash_handler = AsynchronousLogstashHandler(
    LOGSTASH_HOST,
    LOGSTASH_PORT,
    database_path=LOGSTASH_DB_PATH,
    transport=LOGSTASH_TRANSPORT,
)
logstash_handler.formatter = FlaskLogstashFormatter()
app.logger.addHandler(logstash_handler)

logger = logging.getLogger("oauth2_login")

class TokenExpiredException(Exception):
    def __str__(self):
        return "token expired"


class DecodeTokenException(Exception):
    def __init__(self, msg):
        self.msg = msg

    def __str__(self):
        return "decode token with error:" + self.msg


class ReadAuthCookieException(Exception):
    def __init__(self, msg):
        self.msg = msg

    def __str__(self):
        return "Read auth cookie error:" + self.msg


class AccessToken:
    def __init__(self, sub, exp, jti, scope, userinfo):
        self.Subject = sub
        self.Expiration = exp
        self.UUID = jti
        self.Scope = scope
        self.UserInfo = userinfo

    def is_expired(self):
        expireAt = datetime.utcfromtimestamp(self.Expiration)
        return (expireAt - datetime.utcnow()).seconds < 0


class JSONWebSignature:
    def __init__(self, payload):
        self.payload = payload
        self.Signatures = []


class Header:
    def __init__(self, keyID="", jsonWebKey=None, algorithm="", nonce="", certificates=None, extraHeaders=None):
        self.ExtraHeaders = extraHeaders or {}
        self.Certificates = certificates or {}
        self.Nonce = nonce
        self.Algorithm = algorithm
        self.JSONWebKey = jsonWebKey or {}
        self.KeyID = keyID


class RawHeader:
    def __init__(self, rawHeader=None):
        self.rawHeader = rawHeader or {}

    def sanitized(self) -> Header:
        h = Header()
        for key, value in self.rawHeader.items():
            if value is None:
                continue
            if key == "alg":
                h.Algorithm = value
            if key == "kid":
                h.KeyID = value
        return h


class Signature:
    def __init__(self, header=None, protected=None, unprotected=None, signature=bytes, rawProtected=None,
                 rawHeader=None, original=None):
        self.Signature = signature or Header()
        self.Unprotected = unprotected or Header()
        self.Protected = protected or RawHeader()
        self.Header = header or Header()
        self.Original = original or {}
        self.RawHeader = rawHeader or RawHeader()
        self.RawProtected = rawProtected or RawHeader()

    def merge_headers(self) -> RawHeader:
        out = self.RawProtected.rawHeader.copy()
        out.update(self.RawHeader.rawHeader)
        return RawHeader(out)


class Verifier:
    def __init__(self):
        self.CertUrl = API_BASE_URL + '/auth/v1/certs'
        self.CurrentCertMap = {}
        self.LastCertMapSync = datetime.strptime("2001-02-01", "%Y-%m-%d")

    def get_public(self, certId):
        if len(self.CurrentCertMap) > 0 and self.CurrentCertMap[certId] is not None:
            cert = self.CurrentCertMap[certId]
            return cert
        now = datetime.utcnow()
        if (now - self.LastCertMapSync).seconds < 30:
            raise Exception("unknown cert authority")
        if len(self.CurrentCertMap) > 0 and self.CurrentCertMap[certId] is not None:
            cert = self.CurrentCertMap[certId]
            return cert
        certs = self.fetch_certs()
        self.CurrentCertMap = certs
        return certs[certId]

    def fetch_certs(self):
        response = requests.get(self.CertUrl)
        if response.status_code != 200:
            raise Exception("cannot fetch AccessCode certificates")
        self.LastCertMapSync = datetime.utcnow()
        return response.json()['certs']


class RawJSONWebSignature:
    def __init__(self, payload, protected, signature, header=None):
        self.Payload = payload
        self.Signatures = []
        self.Protected = protected
        self.Header = header or {}
        self.Signature = signature

    def sanitized(self) -> JSONWebSignature:
        if self.Payload is None:
            raise Exception("missing payload in JWS message")
        obj = JSONWebSignature(self.Payload)
        if len(self.Signatures) == 0:
            if self.Protected is not None and len(self.Protected) > 0:
                signature = Signature()
                rawProtected = json.loads(self.Protected)
                signature.RawProtected = RawHeader(rawProtected)
                if len(self.Header) > 0 and self.Header["nonce"] != "":
                    raise Exception("Nonce parameter included in unprotected header")
                signature.RawHeader = RawHeader(self.Header)
                signature.Signature = self.Signature
                signature.Original = {"protected": self.Protected, "header": self.Header, "signature": self.Signature}
                rawh = signature.merge_headers()
                signature.Header = rawh.sanitized()
                if signature.RawProtected != {}:
                    rp = signature.RawProtected.sanitized()
                    signature.Protected = rp
                obj.Signatures.append(signature)
        return obj


class AuthCookie:
    def __init__(self, Expires, AccessToken, RefreshToken):
        self.Expires = Expires
        self.AccessToken = AccessToken
        self.RefreshToken = RefreshToken
        self.Verifier = Verifier()

def read_auth_cookie():
    cookie = request.cookies.get(os.getenv("COOKIE_NAME", ""))
    if cookie is None or cookie == "":
        raise ReadAuthCookieException("no cookie " + os.getenv("COOKIE_NAME", ""))
    authCookie = decode_cookie(cookie)
    return authCookie

def decode_access_token(accessToken, verifier):
    jwt = parse_singed_compact(accessToken)
    if len(jwt.Signatures) != 1:
        raise DecodeTokenException("exactly one JWT signature expected")
    signature = jwt.Signatures[0]
    if signature.Header.Algorithm != jws.ALGORITHMS.RS384:
        raise DecodeTokenException("AccessToken secret must be signed with RS384")
    keyid = signature.Header.KeyID
    cert = verifier.get_public(keyid)
    payload = jws.verify(accessToken, cert, algorithms=jws.ALGORITHMS.RS384)
    ret = json.loads(payload)
    return AccessToken(ret['sub'], ret['exp'], ret['jti'], ret['scope'], ret['user_info'])

def parse_singed_compact(input) -> JSONWebSignature:
    parts = input.split(".")
    if len(parts) != 3:
        raise Exception("JWS format must have three parts")
    rawProtected = base64.urlsafe_b64decode(parts[0] + "===")
    payload = base64.urlsafe_b64decode(parts[1] + "===")
    signature = base64.urlsafe_b64decode(parts[2] + "===")
    raw = RawJSONWebSignature(payload, signature=signature, protected=rawProtected)
    return raw.sanitized()

def validate_access_token(accessToken):
    if len(accessToken) > 3072:
        raise DecodeTokenException("accesstoken too long")
    if not accessToken.startswith("eyJ"):
        raise DecodeTokenException("bad token format")
    token = decode_access_token(accessToken, Verifier())
    if token.is_expired():
        raise TokenExpiredException("access token is expired")
    return token

def decode_cookie(cookie) -> AuthCookie:
    parts = cookie.split('|')
    if len(parts) > 3:
        raise ReadAuthCookieException("parts length larget than 3:" + str(len(parts)))
    plain = decode_expire_time(parts[0])
    exprT = datetime.utcfromtimestamp(int(plain))
    return AuthCookie(exprT, parts[1], parts[2])

def hexlify(binary):
    return binascii.hexlify(binary)

def decode_expire_time(base64ExpireTime) -> str:
    blockKey = "02efa5831608a11e622c305d4a7a0ea8".encode("utf-8")
    expirTime = base64.urlsafe_b64decode(base64ExpireTime)
    if len(expirTime) > 16:
        iv = expirTime[:16]
        value = expirTime[16:]
        btl = bytes_to_long(iv)
        ctr = Counter.new(128, initial_value=btl)
        cipher = AES.new(blockKey, AES.MODE_CTR, counter=ctr)
        stream = cipher.decrypt(value)
        return stream.decode("utf-8")
    raise DecodeTokenException("expirTime length exception")

class CustomOAuthView(AuthOAuthView):
    @expose("/login/")
    @expose("/login/<provider>")
    @expose("/login/<provider>/<register>")
    def login(self, provider=None, register=None):
        if provider is None and len(OAUTH_PROVIDERS) == 1:
            return super().login(OAUTH_PROVIDERS[0]["name"], register)
        else:
            return super().login(provider, register)

    @expose("/logout/")
    def logout(self):
        logout_user()
        return redirect('%s/auth/sign_out' % CONSOLE_ROOT)

    # overwrite default oauth_authorized function, trigger apply user role and row level filter after login_user
    @expose("/oauth-authorized/<provider>")
    def oauth_authorized(self, provider):
        logger.debug("Authorized init")
        resp = self.appbuilder.sm.oauth_remotes[provider].authorize_access_token()
        if resp is None:
            flash(u"You denied the request to sign in.", "warning")
            return redirect(self.appbuilder.get_url_for_login)
        logger.debug("OAUTH Authorized resp: {0}".format(resp))
        # Retrieves specific user info from the provider
        try:
            self.appbuilder.sm.set_oauth_session(provider, resp)
            userinfo = self.appbuilder.sm.oauth_user_info(provider, resp)
        except Exception as e:
            logger.error("Error returning OAuth user info: {0}".format(e))
            user = None
        else:
            logger.debug("User info retrieved from {0}: {1}".format(provider, userinfo))
            # User email is not whitelisted
            if provider in self.appbuilder.sm.oauth_whitelists:
                whitelist = self.appbuilder.sm.oauth_whitelists[provider]
                allow = False
                for e in whitelist:
                    if re.search(e, userinfo["email"]):
                        allow = True
                        break
                if not allow:
                    flash(u"You are not authorized.", "warning")
                    return redirect(self.appbuilder.get_url_for_login)
            else:
                logger.debug("No whitelist for OAuth provider")
            user = self.appbuilder.sm.auth_user_oauth(userinfo)

        if user is None:
            flash(as_unicode(self.invalid_login_message), "warning")
            return redirect(self.appbuilder.get_url_for_login)
        else:
            login_user(user)
            # create user project role and row level filter
            if not self.appbuilder.sm.is_admin(user):
                self.appbuilder.sm.apply_user_organisation_role(user, userinfo["org_id"])
                self.appbuilder.sm.apply_view_role(user)
                if not self.appbuilder.sm.is_owner(user):
                    self.appbuilder.sm.apply_user_project_role(user, userinfo["scope"])
            try:
                state = jwt.decode(
                    request.args["state"],
                    self.appbuilder.app.config["SECRET_KEY"],
                    algorithms=["HS256"],
                )
            except jwt.InvalidTokenError:
                raise Exception("State signature is not valid!")

            try:
                next_url = state["next"][0] or self.appbuilder.get_url_for_index
            except (KeyError, IndexError):
                next_url = self.appbuilder.get_url_for_index

            return redirect(next_url)


class CustomSsoSecurityManager(SupersetSecurityManager):
    authoauthview = CustomOAuthView
    rls_table_name = "report"

    def oauth_user_info(self, provider, response=None):
        try:
            return self.check_cookie_before_login(provider)
        except Exception as ex:
            logging.error("read user cookie error: {0}".format(ex))
            logging.info("Oauth2 provider: {0}.".format(provider))
            if provider == 'Improbable':
                user_data = self.appbuilder.sm.oauth_remotes[provider].get('access_token_info').content
                ud = json.loads(user_data)
                user_info = ud["user_info"]
                return self.user_login_info(ud['scope'], user_info)

    def apply_user_project_role(self, user, scope):
        """
        Apply a superset role based on user's platform project permission
        For example: "[*]:prj/beta_a [*]:prj/beta_b" -> prj-beta_a-beta_b
        Trigger create new row level security filter if new role created
        """
        for role in user.roles:
            if role.name.startswith('prj-'):
                current_prj_role = role
            else:
                current_prj_role = None

        sections = scope.split()
        projects = set()
        for section in sections:
            words = section.split("/")
            if len(words) > 1 and words[0].split(':')[1] == "prj":
                if words[1] == '*':
                    self._remove_user_role(user, current_prj_role)
                    return
                else:
                    projects.add(words[1])

        role_name = "prj-" + "-".join(projects)
        new_prj_role = self._replace_user_role(user, current_prj_role, role_name)
        if new_prj_role:
            self._create_row_level_security_filter(role, 'projectname in {}'.format(tuple(projects)), self.rls_table_name)

    def apply_user_organisation_role(self, user, org_id):
        """
        Apply a superset role based on user's platform organisation id
        For example: "[*]:org/beta_a/*" -> org-beta_a
        Trigger create new row level security filter if new role created
        """
        for role in user.roles:
            if role.name.startswith('org-'):
                current_org_role = role
            else:
                current_org_role = None

        role_name = "org-" + str(org_id)
        new_org_role = self._replace_user_role(user, current_org_role, role_name)
        if new_org_role:
            pv = self.add_permission_view_menu("all_datasource_access", "all_datasource_access")
            self.add_permission_role(new_org_role, pv)
            self._create_row_level_security_filter(role, 'organisationid={}'.format(org_id), self.rls_table_name)

    def apply_view_role(self, user):
        view_role = self.find_role("View")
        self._assign_user_role(user, view_role)

    def _replace_user_role(self, user, current_role, target_role_name):
        """
        Replace existing user role with target role, return role if new role created
        """
        new_role = None
        if current_role is None or current_role.name != target_role_name:
            self._remove_user_role(user, current_role)
            role = self.find_role(target_role_name)
            if role is None:
                role = self.add_role(target_role_name)
                new_role = role
            self._assign_user_role(user, role)
        return new_role

    def _assign_user_role(self, user, role):
        user.roles.append(role)
        self.update_user(user)

    def _remove_user_role(self, user, role):
        if role in user.roles:
            user.roles.remove(role)
            self.update_user(user)

    @staticmethod
    def is_admin(user):
        for role in user.roles:
            if role.name == "Admin":
                return True
        return False

    @staticmethod
    def is_owner(user):
        for role in user.roles:
            if role.name.endswith("_owner"):
                return True
        return False

    @staticmethod
    def _create_row_level_security_filter(role, clause, table_name):
        from superset.connectors.sqla.models import RowLevelSecurityFilter, SqlaTable
        rls = RowLevelSecurityFilter()
        rls.clause = clause
        rls.roles.append(role)
        rls.tables.append(db.session.query(SqlaTable).filter_by(table_name=table_name).first())

    def check_cookie_before_login(self, provider, response=None):
        try:
            authCookie = read_auth_cookie()
            logging.info("authCookie========>{0}".format(authCookie.AccessToken))
            token = validate_access_token(authCookie.AccessToken)
            logging.info("========>")
            logging.info("========>")
            logging.info("token========>{0}".format(token.UserInfo))
            logging.info("========>")
            logging.info("========>")
            return self.user_login_info(token.Scope,token.UserInfo)
        except ReadAuthCookieException as rex:
            raise rex
        except TokenExpiredException as ex:
            # refresh token
            payload = {
                "grant_type": "refresh_token",
                "refresh_token": authCookie.RefreshToken,
                "client_id": os.getenv("IMPROBABLE_WEB_SERVER_OAUTH_KEY", ""),
                "client_secret": os.getenv("IMPROBABLE_WEB_SERVER_OAUTH_SECRET", ""),
                "scope": "[r]:auth/acc/* [r]:org/* [r]:prj/*",
            }
            resp = requests.post(API_BASE_URL + "/auth/v1/token", payload)
            if resp is None or resp.status_code != 200:
                # refresh token failed, just go to login part
                user_data = self.appbuilder.sm.oauth_remotes[provider].get('access_token_info').content
                logger.info("user_data: {0}".format(user_data))
                ud = json.loads(user_data)
                user_info = ud["user_info"]
                return self.user_login_info(ud['scope'],user_info)
            logging.info("get refreshtoken, validate accesstoken again")
            access_token = resp.json()['access_token']
            token = validate_access_token(access_token)
            return self.user_login_info(token.Scope,token.UserInfo)

    def user_login_info(self,scope,user_info):
        name = user_info['email'].split('@')[0]
        return {'name': name,
                'email': user_info['email'],
                'id': user_info['email'],
                'username': user_info['email'],
                'first_name': name,
                'last_name': name,
                "scope": scope,
                "org_id": user_info['organisation_id']}

CUSTOM_SECURITY_MANAGER = CustomSsoSecurityManager