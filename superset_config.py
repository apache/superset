#---------------------------------------------------------
# Superset specific config
#---------------------------------------------------------
ROW_LIMIT = 5000

SUPERSET_WEBSERVER_PORT = 8088
#---------------------------------------------------------

#---------------------------------------------------------
# Flask App Builder configuration
#---------------------------------------------------------
# Your App secret key
SECRET_KEY = '\2\1ulan123456\1\2\e\y\y\h'

# The SQLAlchemy connection string to your database backend
# This connection defines the path to the database that stores your
# superset metadata (slices, connections, tables, dashboards, ...).
# Note that the connection information to connect to the datasources
# you want to explore are managed directly in the web UI
#SQLALCHEMY_DATABASE_URI = 'postgresql+psycopg2://superset:superset@localhost:5432/superset'


# ------------------------------
# GLOBALS FOR APP Builder
# ------------------------------
# Uncomment to setup Your App name
APP_NAME = 'Insights'

# Uncomment to setup an App icon
APP_ICON = '/static/assets/images/qmatic_insights-logo.png'

# Extract and use X-Forwarded-For/X-Forwarded-Proto headers?
ENABLE_PROXY_FIX = True

ENABLE_JAVASCRIPT_CONTROLS = True

'''
import os
from flask_appbuilder.security.manager import AUTH_OID, AUTH_REMOTE_USER, AUTH_DB, AUTH_LDAP, AUTH_OAUTH

basedir = os.path.abspath(os.path.dirname(__file__))
SUPERSET_WORKERS = 8
CSRF_ENABLED = True
AUTH_TYPE = AUTH_OAUTH
AUTH_USER_REGISTRATION = False
AUTH_USER_REGISTRATION_ROLE = "Gamma" #"Public"
OAUTH_PROVIDERS = [
 {
        'name': 'google',
        'icon': 'fa-google',
        'token_key': 'access_token',
        'remote_app': {
                'base_url': 'https://www.googleapis.com/oauth2/v2/',
                'request_token_params': {
                        'scope': 'email profile'
                },
                'request_token_url': None,
                'access_token_url': 'https://accounts.google.com/o/oauth2/token',
                'authorize_url': 'https://accounts.google.com/o/oauth2/auth',
                'consumer_key': '996225546131-1qd2alfrrp1scf6gvkeg63mg2ku85lka.apps.googleusercontent.com',
                'consumer_secret': '3fxwT-a8YA1akyuUYFfakMCz'
       }
 }, 
 {
        'name': 'slatest.qmaticcloud.com',
        'icon': 'fa-google',
        'token_key': 'access_token',
        'remote_app': {
                #'base_url': 'https://slatest.qmaticcloud.com/oauth2server/oauth/',
                'base_url': None,
                'request_token_params': {
                        'scope': 'user_info',
                        'state': '123'
                },
                'request_token_url': None,
                'access_token_url': 'https://slatest.qmaticcloud.com/oauth2server/oauth/token',
                'authorize_url': 'https://slatest.qmaticcloud.com/oauth2server/oauth/authorize',
                'consumer_key': 'businessintelligence',
                'consumer_secret': 'fSmI0K1uSvnORBk3'
       }
 },
 {
        'name': 'msdemo.qmatic.cloud',
        'icon': 'fa-google',
        'token_key': 'access_token',
        'remote_app': {
                'base_url': None,
                'request_token_params': {
                        'scope': 'user_info',
                        'state': '123'
                },
                'request_token_url': None,
                'access_token_url': 'https://msdemo.qmatic.cloud/oauth2server/oauth/token',
                'authorize_url': 'https://msdemo.qmatic.cloud/oauth2server/oauth/authorize',
                'consumer_key': 'businessintelligence',
                'consumer_secret': 'fSmI0K1uSvnORBk3'
       }
 }
]


'''

