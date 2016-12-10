"""The main config file for Superset

All configuration in this file can be overridden by providing a superset_config
in your PYTHONPATH as there is a ``from superset_config import *``
at the end of this file.
"""
from __future__ import absolute_import
from __future__ import division
from __future__ import print_function
from __future__ import unicode_literals

import imp
import json
import os

from dateutil import tz
from flask_appbuilder.security.manager import AUTH_DB

BASE_DIR = os.path.abspath(os.path.dirname(__file__))
DATA_DIR = os.path.join(os.path.expanduser('~'), '.superset')
if not os.path.exists(DATA_DIR):
    os.makedirs(DATA_DIR)

# ---------------------------------------------------------
# Superset specific config
# ---------------------------------------------------------
PACKAGE_DIR = os.path.join(BASE_DIR, 'static', 'assets')
PACKAGE_FILE = os.path.join(PACKAGE_DIR, 'package.json')
with open(PACKAGE_FILE) as package_file:
    VERSION_STRING = json.load(package_file)['version']

ROW_LIMIT = 50000
SUPERSET_WORKERS = 2

SUPERSET_WEBSERVER_ADDRESS = '0.0.0.0'
SUPERSET_WEBSERVER_PORT = 8088
SUPERSET_WEBSERVER_TIMEOUT = 60

CUSTOM_SECURITY_MANAGER = None
# ---------------------------------------------------------

# Your App secret key
SECRET_KEY = '\2\1thisismyscretkey\1\2\e\y\y\h'  # noqa

# The SQLAlchemy connection string.
SQLALCHEMY_DATABASE_URI = 'sqlite:///' + os.path.join(DATA_DIR, 'superset.db')
# SQLALCHEMY_DATABASE_URI = 'mysql://myapp@localhost/myapp'
# SQLALCHEMY_DATABASE_URI = 'postgresql://root:password@localhost/myapp'

# The limit of queries fetched for query search
QUERY_SEARCH_LIMIT = 1000

# Flask-WTF flag for CSRF
CSRF_ENABLED = True

# Whether to run the web server in debug mode or not
DEBUG = False

# Whether to show the stacktrace on 500 error
SHOW_STACKTRACE = True

# Extract and use X-Forwarded-For/X-Forwarded-Proto headers?
ENABLE_PROXY_FIX = False

# ------------------------------
# GLOBALS FOR APP Builder
# ------------------------------
# Uncomment to setup Your App name
APP_NAME = "Superset"

# Uncomment to setup Setup an App icon
APP_ICON = "/static/assets/images/superset-logo@2x.png"

# Druid query timezone
# tz.tzutc() : Using utc timezone
# tz.tzlocal() : Using local timezone
# other tz can be overridden by providing a local_config
DRUID_IS_ACTIVE = True
DRUID_TZ = tz.tzutc()

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
#    { 'name': 'Yahoo', 'url': 'https://me.yahoo.com' },
#    { 'name': 'AOL', 'url': 'http://openid.aol.com/<username>' },
#    { 'name': 'Flickr', 'url': 'http://www.flickr.com/<username>' },
#    { 'name': 'MyOpenID', 'url': 'https://www.myopenid.com' }]

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
BABEL_DEFAULT_FOLDER = 'babel/translations'
# The allowed translation for you app
LANGUAGES = {
    'en': {'flag': 'us', 'name': 'English'},
    # 'fr': {'flag': 'fr', 'name': 'French'},
    # 'zh': {'flag': 'cn', 'name': 'Chinese'},
}
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

CACHE_DEFAULT_TIMEOUT = None
CACHE_CONFIG = {'CACHE_TYPE': 'null'}

# CORS Options
ENABLE_CORS = False
CORS_OPTIONS = {}


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
DEFAULT_MODULE_DS_MAP = {'superset.models': ['DruidDatasource', 'SqlaTable']}
ADDITIONAL_MODULE_DS_MAP = {}
ADDITIONAL_MIDDLEWARE = []

"""
1) http://docs.python-guide.org/en/latest/writing/logging/
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

# Set this API key to enable Mapbox visualizations
MAPBOX_API_KEY = ""

# Maximum number of rows returned in the SQL editor
SQL_MAX_ROW = 1000

# If defined, shows this text in an alert-warning box in the navbar
# one example use case may be "STAGING" to make it clear that this is
# not the production version of the site.
WARNING_MSG = None

# Default celery config is to use SQLA as a broker, in a production setting
# you'll want to use a proper broker as specified here:
# http://docs.celeryproject.org/en/latest/getting-started/brokers/index.html
"""
# Example:
class CeleryConfig(object):
  BROKER_URL = 'sqla+sqlite:///celerydb.sqlite'
  CELERY_IMPORTS = ('superset.sql_lab', )
  CELERY_RESULT_BACKEND = 'db+sqlite:///celery_results.sqlite'
  CELERY_ANNOTATIONS = {'tasks.add': {'rate_limit': '10/s'}}
CELERY_CONFIG = CeleryConfig
"""
CELERY_CONFIG = None
SQL_CELERY_DB_FILE_PATH = os.path.join(DATA_DIR, 'celerydb.sqlite')
SQL_CELERY_RESULTS_DB_FILE_PATH = os.path.join(DATA_DIR, 'celery_results.sqlite')

# static http headers to be served by your Superset server.
# The following example prevents iFrame from other domains
# and "clickjacking" as a result
# HTTP_HEADERS = {'X-Frame-Options': 'SAMEORIGIN'}
HTTP_HEADERS = {}

# The db id here results in selecting this one as a default in SQL Lab
DEFAULT_DB_ID = None

# Timeout duration for SQL Lab synchronous queries
SQLLAB_TIMEOUT = 30

# SQLLAB_DEFAULT_DBID
SQLLAB_DEFAULT_DBID = None

# An instantiated derivative of werkzeug.contrib.cache.BaseCache
# if enabled, it can be used to store the results of long-running queries
# in SQL Lab by using the "Run Async" button/feature
RESULTS_BACKEND = None

# A dictionary of items that gets merged into the Jinja context for
# SQL Lab. The existing context gets updated with this dictionary,
# meaning values for existing keys get overwritten by the content of this
# dictionary.
JINJA_CONTEXT_ADDONS = {}

# Roles that are controlled by the API / Superset and should not be changes
# by humans.
ROBOT_PERMISSION_ROLES = ['Public', 'Gamma', 'Alpha', 'Admin', 'sql_lab']

CONFIG_PATH_ENV_VAR = 'SUPERSET_CONFIG_PATH'

try:
    if CONFIG_PATH_ENV_VAR in os.environ:
        # Explicitly import config module that is not in pythonpath; useful
        # for case where app is being executed via pex.
        imp.load_source('superset_config', os.environ[CONFIG_PATH_ENV_VAR])

    from superset_config import *  # noqa
    print('Loaded your LOCAL configuration')
except ImportError:
    pass

if not CACHE_DEFAULT_TIMEOUT:
    CACHE_DEFAULT_TIMEOUT = CACHE_CONFIG.get('CACHE_DEFAULT_TIMEOUT')
