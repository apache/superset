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
# pylint: disable=C,R,W
"""The main config file for Superset

All configuration in this file can be overridden by providing a superset_config
in your PYTHONPATH as there is a ``from superset_config import *``
at the end of this file.
"""
from collections import OrderedDict
import imp
import json
import os
import sys

from celery.schedules import crontab
from dateutil import tz
from flask_appbuilder.security.manager import AUTH_DB

from superset.stats_logger import DummyStatsLogger

# Realtime stats logger, a StatsD implementation exists
STATS_LOGGER = DummyStatsLogger()

BASE_DIR = os.path.abspath(os.path.dirname(__file__))
if 'SUPERSET_HOME' in os.environ:
    DATA_DIR = os.environ['SUPERSET_HOME']
else:
    DATA_DIR = os.path.join(os.path.expanduser('~'), '.superset')

# ---------------------------------------------------------
# Superset specific config
# ---------------------------------------------------------
PACKAGE_DIR = os.path.join(BASE_DIR, 'static', 'assets')
PACKAGE_FILE = os.path.join(PACKAGE_DIR, 'package.json')
with open(PACKAGE_FILE) as package_file:
    VERSION_STRING = json.load(package_file)['version']

ROW_LIMIT = 50000
VIZ_ROW_LIMIT = 10000
# max rows retrieved by filter select auto complete
FILTER_SELECT_ROW_LIMIT = 10000
SUPERSET_WORKERS = 2  # deprecated
SUPERSET_CELERY_WORKERS = 32  # deprecated

SUPERSET_WEBSERVER_ADDRESS = '0.0.0.0'
SUPERSET_WEBSERVER_PORT = 8088

# This is an important setting, and should be lower than your
# [load balancer / proxy / envoy / kong / ...] timeout settings.
# You should also make sure to configure your WSGI server
# (gunicorn, nginx, apache, ...) timeout setting to be <= to this setting
SUPERSET_WEBSERVER_TIMEOUT = 60

SUPERSET_DASHBOARD_POSITION_DATA_LIMIT = 65535
EMAIL_NOTIFICATIONS = False
CUSTOM_SECURITY_MANAGER = None
SQLALCHEMY_TRACK_MODIFICATIONS = False
# ---------------------------------------------------------

# Your App secret key
SECRET_KEY = '\2\1thisismyscretkey\1\2\e\y\y\h'  # noqa

# The SQLAlchemy connection string.
SQLALCHEMY_DATABASE_URI = 'sqlite:///' + os.path.join(DATA_DIR, 'superset.db')
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

# The limit of queries fetched for query search
QUERY_SEARCH_LIMIT = 1000

# Flask-WTF flag for CSRF
WTF_CSRF_ENABLED = True

# Add endpoints that need to be exempt from CSRF protection
WTF_CSRF_EXEMPT_LIST = ['superset.views.core.log']

# Whether to run the web server in debug mode or not
DEBUG = os.environ.get('FLASK_ENV') == 'development'
FLASK_USE_RELOAD = True

# Whether to show the stacktrace on 500 error
SHOW_STACKTRACE = True

# Extract and use X-Forwarded-For/X-Forwarded-Proto headers?
ENABLE_PROXY_FIX = False

# ------------------------------
# GLOBALS FOR APP Builder
# ------------------------------
# Uncomment to setup Your App name
APP_NAME = 'Superset'

# Uncomment to setup an App icon
APP_ICON = '/static/assets/images/superset-logo@2x.png'
APP_ICON_WIDTH = 126

# Uncomment to specify where clicking the logo would take the user
# e.g. setting it to '/welcome' would take the user to '/superset/welcome'
LOGO_TARGET_PATH = None

# Druid query timezone
# tz.tzutc() : Using utc timezone
# tz.tzlocal() : Using local timezone
# tz.gettz('Asia/Shanghai') : Using the time zone with specific name
# [TimeZone List]
# See: https://en.wikipedia.org/wiki/List_of_tz_database_time_zones
# other tz can be overridden by providing a local_config
DRUID_IS_ACTIVE = True
DRUID_TZ = tz.tzutc()
DRUID_ANALYSIS_TYPES = ['cardinality']

# ----------------------------------------------------
# AUTHENTICATION CONFIG
# ----------------------------------------------------
# The authentication type
# AUTH_OID : Is for OpenID
# AUTH_DB : Is for database (username/password()
# AUTH_LDAP : Is for LDAP
# AUTH_REMOTE_USER : Is for using REMOTE_USER from web server
AUTH_TYPE = AUTH_DB

# Uncomment to setup Full admin role name
# AUTH_ROLE_ADMIN = 'Admin'

# Uncomment to setup Public role name, no authentication needed
# AUTH_ROLE_PUBLIC = 'Public'

# Will allow user self registration
# AUTH_USER_REGISTRATION = True

# The default user self registration role
# AUTH_USER_REGISTRATION_ROLE = "Public"

# When using LDAP Auth, setup the ldap server
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
BABEL_DEFAULT_LOCALE = 'en'
# Your application default translation path
BABEL_DEFAULT_FOLDER = 'superset/translations'
# The allowed translation for you app
LANGUAGES = {
    'en': {'flag': 'us', 'name': 'English'},
    'it': {'flag': 'it', 'name': 'Italian'},
    'fr': {'flag': 'fr', 'name': 'French'},
    'zh': {'flag': 'cn', 'name': 'Chinese'},
    'ja': {'flag': 'jp', 'name': 'Japanese'},
    'de': {'flag': 'de', 'name': 'German'},
    'pt': {'flag': 'pt', 'name': 'Portuguese'},
    'pt_BR': {'flag': 'br', 'name': 'Brazilian Portuguese'},
    'ru': {'flag': 'ru', 'name': 'Russian'},
    'ko': {'flag': 'kr', 'name': 'Korean'},
}

# ---------------------------------------------------
# Feature flags
# ---------------------------------------------------
# Feature flags that are set by default go here. Their values can be
# overwritten by those specified under FEATURE_FLAGS in super_config.py
# For example, DEFAULT_FEATURE_FLAGS = { 'FOO': True, 'BAR': False } here
# and FEATURE_FLAGS = { 'BAR': True, 'BAZ': True } in superset_config.py
# will result in combined feature flags of { 'FOO': True, 'BAR': True, 'BAZ': True }
DEFAULT_FEATURE_FLAGS = {
    # Experimental feature introducing a client (browser) cache
    'CLIENT_CACHE': False,
}

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
# def GET_FEATURE_FLAGS_FUNC(feature_flags_dict):
#     feature_flags_dict['some_feature'] = g.user and g.user.id == 5
#     return feature_flags_dict
GET_FEATURE_FLAGS_FUNC = None


# ---------------------------------------------------
# Image and file configuration
# ---------------------------------------------------
# The file upload folder, when using models with files
UPLOAD_FOLDER = BASE_DIR + '/app/static/uploads/'

# The image upload folder, when using models with images
IMG_UPLOAD_FOLDER = BASE_DIR + '/app/static/uploads/'

# The image upload url, when using models with images
IMG_UPLOAD_URL = '/static/uploads/'
# Setup image size default is (300, 200, True)
# IMG_SIZE = (300, 200, True)

CACHE_DEFAULT_TIMEOUT = 60 * 60 * 24
CACHE_CONFIG = {'CACHE_TYPE': 'null'}
TABLE_NAMES_CACHE_CONFIG = {'CACHE_TYPE': 'null'}

# CORS Options
ENABLE_CORS = False
CORS_OPTIONS = {}

# Chrome allows up to 6 open connections per domain at a time. When there are more
# than 6 slices in dashboard, a lot of time fetch requests are queued up and wait for
# next available socket. PR #5039 is trying to allow domain sharding for Superset,
# and this feature will be enabled by configuration only (by default Superset
# doesn't allow cross-domain request).
SUPERSET_WEBSERVER_DOMAINS = None

# Allowed format types for upload on Database view
# TODO: Add processing of other spreadsheet formats (xls, xlsx etc)
ALLOWED_EXTENSIONS = set(['csv'])

# CSV Options: key/value pairs that will be passed as argument to DataFrame.to_csv method
# note: index option should not be overridden
CSV_EXPORT = {
    'encoding': 'utf-8',
}

# ---------------------------------------------------
# Time grain configurations
# ---------------------------------------------------
# List of time grains to disable in the application (see list of builtin
# time grains in superset/db_engine_specs.builtin_time_grains).
# For example: to disable 1 second time grain:
# TIME_GRAIN_BLACKLIST = ['PT1S']
TIME_GRAIN_BLACKLIST = []

# Additional time grains to be supported using similar definitions as in
# superset/db_engine_specs.builtin_time_grains.
# For example: To add a new 2 second time grain:
# TIME_GRAIN_ADDONS = {'PT2S': '2 second'}
TIME_GRAIN_ADDONS = {}

# Implementation of additional time grains per engine.
# For example: To implement 2 second time grain on clickhouse engine:
# TIME_GRAIN_ADDON_FUNCTIONS = {
#     'clickhouse': {
#         'PT2S': 'toDateTime(intDiv(toUInt32(toDateTime({col})), 2)*2)'
#     }
# }
TIME_GRAIN_ADDON_FUNCTIONS = {}

# ---------------------------------------------------
# List of viz_types not allowed in your environment
# For example: Blacklist pivot table and treemap:
#  VIZ_TYPE_BLACKLIST = ['pivot_table', 'treemap']
# ---------------------------------------------------

VIZ_TYPE_BLACKLIST = []

# ---------------------------------------------------
# List of data sources not to be refreshed in druid cluster
# ---------------------------------------------------

DRUID_DATA_SOURCE_BLACKLIST = []

# --------------------------------------------------
# Modules, datasources and middleware to be registered
# --------------------------------------------------
DEFAULT_MODULE_DS_MAP = OrderedDict([
    ('superset.connectors.sqla.models', ['SqlaTable']),
    ('superset.connectors.druid.models', ['DruidDatasource']),
])
ADDITIONAL_MODULE_DS_MAP = {}
ADDITIONAL_MIDDLEWARE = []

"""
1) https://docs.python-guide.org/writing/logging/
2) https://docs.python.org/2/library/logging.config.html
"""

# Console Log Settings

LOG_FORMAT = '%(asctime)s:%(levelname)s:%(name)s:%(message)s'
LOG_LEVEL = 'DEBUG'

# ---------------------------------------------------
# Enable Time Rotate Log Handler
# ---------------------------------------------------
# LOG_LEVEL = DEBUG, INFO, WARNING, ERROR, CRITICAL

ENABLE_TIME_ROTATE = False
TIME_ROTATE_LOG_LEVEL = 'DEBUG'
FILENAME = os.path.join(DATA_DIR, 'superset.log')
ROLLOVER = 'midnight'
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
# ):
#     pass

# Set this API key to enable Mapbox visualizations
MAPBOX_API_KEY = os.environ.get('MAPBOX_API_KEY', '')

# Maximum number of rows returned from a database
# in async mode, no more than SQL_MAX_ROW will be returned and stored
# in the results backend. This also becomes the limit when exporting CSVs
SQL_MAX_ROW = 100000

# Default row limit for SQL Lab queries
DEFAULT_SQLLAB_LIMIT = 1000

# Maximum number of tables/views displayed in the dropdown window in SQL Lab.
MAX_TABLE_NAMES = 3000

# Adds a warning message on sqllab save query modal.
SQLLAB_SAVE_WARNING_MESSAGE = None

# If defined, shows this text in an alert-warning box in the navbar
# one example use case may be "STAGING" to make it clear that this is
# not the production version of the site.
WARNING_MSG = None

# Default celery config is to use SQLA as a broker, in a production setting
# you'll want to use a proper broker as specified here:
# http://docs.celeryproject.org/en/latest/getting-started/brokers/index.html


class CeleryConfig(object):
    BROKER_URL = 'sqla+sqlite:///celerydb.sqlite'
    CELERY_IMPORTS = (
        'superset.sql_lab',
        'superset.tasks',
    )
    CELERY_RESULT_BACKEND = 'db+sqlite:///celery_results.sqlite'
    CELERYD_LOG_LEVEL = 'DEBUG'
    CELERYD_PREFETCH_MULTIPLIER = 1
    CELERY_ACKS_LATE = True
    CELERY_ANNOTATIONS = {
        'sql_lab.get_sql_results': {
            'rate_limit': '100/s',
        },
        'email_reports.send': {
            'rate_limit': '1/s',
            'time_limit': 120,
            'soft_time_limit': 150,
            'ignore_result': True,
        },
    }
    CELERYBEAT_SCHEDULE = {
        'email_reports.schedule_hourly': {
            'task': 'email_reports.schedule_hourly',
            'schedule': crontab(minute=1, hour='*'),
        },
    }


CELERY_CONFIG = CeleryConfig

"""
# Set celery config to None to disable all the above configuration
CELERY_CONFIG = None
"""

# static http headers to be served by your Superset server.
# This header prevents iFrames from other domains and
# "clickjacking" as a result
HTTP_HEADERS = {'X-Frame-Options': 'SAMEORIGIN'}
# If you need to allow iframes from other domains (and are
# aware of the risks), you can disable this header:
# HTTP_HEADERS = {}

# The db id here results in selecting this one as a default in SQL Lab
DEFAULT_DB_ID = None

# Timeout duration for SQL Lab synchronous queries
SQLLAB_TIMEOUT = 30

# SQLLAB_DEFAULT_DBID
SQLLAB_DEFAULT_DBID = None

# The MAX duration (in seconds) a query can run for before being killed
# by celery.
SQLLAB_ASYNC_TIME_LIMIT_SEC = 60 * 60 * 6

# An instantiated derivative of werkzeug.contrib.cache.BaseCache
# if enabled, it can be used to store the results of long-running queries
# in SQL Lab by using the "Run Async" button/feature
RESULTS_BACKEND = None

# The S3 bucket where you want to store your external hive tables created
# from CSV files. For example, 'companyname-superset'
CSV_TO_HIVE_UPLOAD_S3_BUCKET = None

# The directory within the bucket specified above that will
# contain all the external tables
CSV_TO_HIVE_UPLOAD_DIRECTORY = 'EXTERNAL_HIVE_TABLES/'

# The namespace within hive where the tables created from
# uploading CSVs will be stored.
UPLOADED_CSV_HIVE_NAMESPACE = None

# A dictionary of items that gets merged into the Jinja context for
# SQL Lab. The existing context gets updated with this dictionary,
# meaning values for existing keys get overwritten by the content of this
# dictionary.
JINJA_CONTEXT_ADDONS = {}

# Roles that are controlled by the API / Superset and should not be changes
# by humans.
ROBOT_PERMISSION_ROLES = ['Public', 'Gamma', 'Alpha', 'Admin', 'sql_lab']

CONFIG_PATH_ENV_VAR = 'SUPERSET_CONFIG_PATH'

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
SMTP_HOST = 'localhost'
SMTP_STARTTLS = True
SMTP_SSL = False
SMTP_USER = 'superset'
SMTP_PORT = 25
SMTP_PASSWORD = 'superset'
SMTP_MAIL_FROM = 'superset@superset.com'

if not CACHE_DEFAULT_TIMEOUT:
    CACHE_DEFAULT_TIMEOUT = CACHE_CONFIG.get('CACHE_DEFAULT_TIMEOUT')

# Whether to bump the logging level to ERROR on the flask_appbuilder package
# Set to False if/when debugging FAB related issues like
# permission management
SILENCE_FAB = True

# The link to a page containing common errors and their resolutions
# It will be appended at the bottom of sql_lab errors.
TROUBLESHOOTING_LINK = ''

# CSRF token timeout, set to None for a token that never expires
WTF_CSRF_TIME_LIMIT = 60 * 60 * 24 * 7

# This link should lead to a page with instructions on how to gain access to a
# Datasource. It will be placed at the bottom of permissions errors.
PERMISSION_INSTRUCTIONS_LINK = ''

# Integrate external Blueprints to the app by passing them to your
# configuration. These blueprints will get integrated in the app
BLUEPRINTS = []

# Provide a callable that receives a tracking_url and returns another
# URL. This is used to translate internal Hadoop job tracker URL
# into a proxied one
TRACKING_URL_TRANSFORMER = lambda x: x  # noqa: E731

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

# When not using gunicorn, (nginx for instance), you may want to disable
# using flask-compress
ENABLE_FLASK_COMPRESS = True

# Enable / disable scheduled email reports
ENABLE_SCHEDULED_EMAIL_REPORTS = False

# If enabled, certail features are run in debug mode
# Current list:
# * Emails are sent using dry-run mode (logging only)
SCHEDULED_EMAIL_DEBUG_MODE = False

# Email reports - minimum time resolution (in minutes) for the crontab
EMAIL_REPORTS_CRON_RESOLUTION = 15

# Email report configuration
# From address in emails
EMAIL_REPORT_FROM_ADDRESS = 'reports@superset.org'

# Send bcc of all reports to this address. Set to None to disable.
# This is useful for maintaining an audit trail of all email deliveries.
EMAIL_REPORT_BCC_ADDRESS = None

# User credentials to use for generating reports
# This user should have permissions to browse all the dashboards and
# slices.
# TODO: In the future, login as the owner of the item to generate reports
EMAIL_REPORTS_USER = 'admin'
EMAIL_REPORTS_SUBJECT_PREFIX = '[Report] '

# The webdriver to use for generating reports. Use one of the following
# firefox
#   Requires: geckodriver and firefox installations
#   Limitations: can be buggy at times
# chrome:
#   Requires: headless chrome
#   Limitations: unable to generate screenshots of elements
EMAIL_REPORTS_WEBDRIVER = 'firefox'

# Window size - this will impact the rendering of the data
WEBDRIVER_WINDOW = {
    'dashboard': (1600, 2000),
    'slice': (3000, 1200),
}

# Any config options to be passed as-is to the webdriver
WEBDRIVER_CONFIGURATION = {}

# The base URL to query for accessing the user interface
WEBDRIVER_BASEURL = 'http://0.0.0.0:8080/'

# Send user to a link where they can report bugs
BUG_REPORT_URL = None
# Send user to a link where they can read more about Superset
DOCUMENTATION_URL = None

# What is the Last N days relative in the time selector to:
# 'today' means it is midnight (00:00:00) of today in the local timezone
# 'now' means it is relative to the query issue time
DEFAULT_RELATIVE_END_TIME = 'today'

# Is epoch_s/epoch_ms datetime format supposed to be considered since UTC ?
# If not, it is sassumed then the epoch_s/epoch_ms is seconds since 1/1/1970
# localtime (in the tz where the superset webserver is running)
IS_EPOCH_S_TRULY_UTC = False


try:
    if CONFIG_PATH_ENV_VAR in os.environ:
        # Explicitly import config module that is not in pythonpath; useful
        # for case where app is being executed via pex.
        print('Loaded your LOCAL configuration at [{}]'.format(
            os.environ[CONFIG_PATH_ENV_VAR]))
        module = sys.modules[__name__]
        override_conf = imp.load_source(
            'superset_config',
            os.environ[CONFIG_PATH_ENV_VAR])
        for key in dir(override_conf):
            if key.isupper():
                setattr(module, key, getattr(override_conf, key))

    else:
        from superset_config import *  # noqa
        import superset_config
        print('Loaded your LOCAL configuration at [{}]'.format(
            superset_config.__file__))
except ImportError:
    pass
