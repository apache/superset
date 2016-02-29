"""
All configuration in this file can be overridden by providing a local_config
in your PYTHONPATH.

There' a ``from local_config import *`` at the end of this file.
"""
import os
from flask_appbuilder.security.manager import AUTH_DB
# from flask_appbuilder.security.manager import (
#    AUTH_OID, AUTH_REMOTE_USER, AUTH_DB, AUTH_LDAP, AUTH_OAUTH)
BASE_DIR = os.path.abspath(os.path.dirname(__file__))
from dateutil import tz


# ---------------------------------------------------------
# Panoramix specifix config
# ---------------------------------------------------------
ROW_LIMIT = 50000
WEBSERVER_THREADS = 8

PANORAMIX_WEBSERVER_PORT = 8088
PANORAMIX_WEBSERVER_TIMEOUT = 60

CUSTOM_SECURITY_MANAGER = None
# ---------------------------------------------------------

# Your App secret key
SECRET_KEY = '\2\1thisismyscretkey\1\2\e\y\y\h'

# The SQLAlchemy connection string.
SQLALCHEMY_DATABASE_URI = 'sqlite:////tmp/panoramix.db'
# SQLALCHEMY_DATABASE_URI = 'mysql://myapp@localhost/myapp'
# SQLALCHEMY_DATABASE_URI = 'postgresql://root:password@localhost/myapp'

# Flask-WTF flag for CSRF
CSRF_ENABLED = True

# Whether to run the web server in debug mode or not
DEBUG = True

# Whether to show the stacktrace on 500 error
SHOW_STACKTRACE = True

# ------------------------------
# GLOBALS FOR APP Builder
# ------------------------------
# Uncomment to setup Your App name
APP_NAME = "Panoramix"

# Uncomment to setup Setup an App icon
APP_ICON = "/static/img/chaudron_white.png"

# Druid query timezone
# tz.tzutc() : Using utc timezone
# tz.tzlocal() : Using local timezone
# other tz can be overridden by providing a local_config
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
# Babel config for translations
# ---------------------------------------------------
# Setup default language
BABEL_DEFAULT_LOCALE = 'en'
# Your application default translation path
BABEL_DEFAULT_FOLDER = 'translations'
# The allowed translation for you app
LANGUAGES = {
    'en': {'flag': 'us', 'name': 'English'},
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

# ---------------------------------------------------
# Theme configuration
# ---------------------------------------------------
CSS_THEME = '/static/assets/stylesheets/themes/panoramix-bootstrap-theme.css'
# CSS_THEME = '/static/assets/stylesheets/themes/bootswatch.paper.min.css'
# CSS_THEME = "/static/appbuilder/css/bootstrap.min.css"  # default bootstrap
# CSS_THEME = "/static/appbuilder/css/themes/cerulean.css"
# CSS_THEME = "/static/appbuilder/css/themes/amelia.css"
# CSS_THEME = "/static/appbuilder/css/themes/cosmo.css"
# CSS_THEME = "/static/appbuilder/css/themes/cyborg.css"
# CSS_THEME = "/static/appbuilder/css/themes/flatly.css"
# CSS_THEME = "/static/appbuilder/css/themes/journal.css"
# CSS_THEME = "/static/appbuilder/css/themes/readable.css"
# CSS_THEME = "/static/appbuilder/css/themes/simplex.css"
# CSS_THEME = "/static/appbuilder/css/themes/slate.css"
# CSS_THEME = "/static/appbuilder/css/themes/spacelab.css"
# CSS_THEME = "/static/appbuilder/css/themes/united.css"
# CSS_THEME = "/static/appbuilder/css/themes/yeti.css"

try:
    from panoramix_config import *
except Exception:
    pass
