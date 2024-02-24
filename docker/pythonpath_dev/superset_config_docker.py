from flask_appbuilder.security.manager import AUTH_OAUTH
import os
from dotenv import load_dotenv

load_dotenv(verbose=True)

SECRET_KEY = os.environ['SECRET_KEY']
PREVIOUS_SECRET_KEY=os.environ['P_SECRET_KEY']
FEATURE_FLAGS = {"EMBEDDED_SUPERSET": True}
ENABLE_JAVASCRIPT_CONTROLS = True
TALISMAN_ENABLED = False
HTTP_HEADERS = {'X-Frame-Options': 'ALLOWALL'}
#enable user auto registation as public user
AUTH_USER_REGISTRATION = True
LOGOUT_REDIRECT_URL=os.environ['LOGOUT_REDIRECT_URL']
AUTH_ROLES_MAPPING = { "superset_gamma": ["Gamma"], "superset_admin": ["Admin"],"superset_alpha":["Alpha"] }
AUTH_USER_REGISTRATION_ROLE = "Public"
AUTH_TYPE = AUTH_OAUTH
AUTH_ROLES_SYNC_AT_LOGIN=True
OAUTH_PROVIDERS = [
    {
        'name': 'keycloak',
        'icon': 'fa-key',
        'token_key': 'access_token',
        'remote_app': {
                    'client_id': os.environ['CLIENT_ID'],
                    'client_secret': os.environ['CLIENT_SECRET'],
                    'client_kwargs': {
                        'scope': 'openid profile email',
                        },
                    'access_token_headers':{    # Additional headers for calls to access_token_url
                        'Authorization': 'Basic Base64EncodedClientIdAndSecret',
                        'Content-Type':'application/x-www-form-urlencoded',
                        },
                    'server_metadata_url': os.environ['SERVER_METADATA_URL'],
                    'api_base_url': os.environ['API_BASE_URL'],
                    'access_token_url':'https://auth.team.hexalogy.com/realms/Hexalogy/protocol/openid-connect/token',
                    "request_token_url": None,
                    },
    }
]
from custom_sso_security_manager import CustomSsoSecurityManager
CUSTOM_SECURITY_MANAGER = CustomSsoSecurityManager