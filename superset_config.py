from flask_appbuilder.security.manager import AUTH_OAUTH
import os
from dotenv import load_dotenv
load_dotenv(verbose=True)

SECRET_KEY = os.environ['SECRET_KEY']
# LOGOUT_REDIRECT_URL=os.environ['LOGOUT_REDIRECT_URL']
FEATURE_FLAGS = {"EMBEDDED_SUPERSET": True}
ENABLE_JAVASCRIPT_CONTROLS = True

#enable user auto registation as public user
AUTH_USER_REGISTRATION = True
AUTH_USER_REGISTRATION_ROLE = 'Public'
AUTH_TYPE = AUTH_OAUTH
OAUTH_PROVIDERS = [
    {
        'name': 'keycloak',
        'icon': 'fa-key',
        'token_key': 'access_token',  # Keycloak uses 'access_token' for the access token
        'remote_app': {
            'client_id': os.environ['CLIENT_ID'],
            'client_secret': os.environ['CLIENT_SECRET'],
            'client_kwargs': {
                'scope': 'openid profile email',
            },
            'server_metadata_url': os.environ['SERVER_METADATA_URL'],
            'api_base_url': os.environ['API_BASE_URL'],
        },
    }
    ]