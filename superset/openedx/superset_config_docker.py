import os
from urllib.parse import urljoin

from flask_appbuilder.security.manager import AUTH_OAUTH

# Application secret key

SECRET_KEY = os.environ["SECRET_KEY"]

# Don't limit the number of rows that can be used in queries
ROW_LIMIT = 100_000
SQL_MAX_ROW = ROW_LIMIT

OPENEDX_LMS_ROOT_URL = os.environ["OPENEDX_LMS_ROOT_URL"]
OPENEDX_API_URLS = {
    "get_courses": urljoin(OPENEDX_LMS_ROOT_URL, "{{ SUPERSET_OPENEDX_COURSES_LIST_PATH }}"),
    "get_preference": urljoin(OPENEDX_LMS_ROOT_URL, "{{ SUPERSET_OPENEDX_PREFERENCE_PATH }}"),
}

# Set the authentication type to OAuth
AUTH_TYPE = AUTH_OAUTH

OAUTH_PROVIDERS = [
    {   'name':'openedxsso',
        'token_key':'access_token', # Name of the token in the response of access_token_url
        'icon':'fa-address-card',   # Icon for the provider
        'remote_app': {
            'client_id': os.environ["OAUTH2_CLIENT_ID"],
            'client_secret': os.environ["OAUTH2_CLIENT_SECRET"],
            'client_kwargs':{
                'scope': 'profile email user_id'               # Scope for the Authorization
            },
            'access_token_method':'POST',    # HTTP Method to call access_token_url
            'access_token_params':{        # Additional parameters for calls to access_token_url
                'client_id': os.environ["OAUTH2_CLIENT_ID"],
                'token_type': 'jwt'
            },
            'access_token_headers':{    # Additional headers for calls to access_token_url
                'Authorization': 'JWT Base64EncodedClientIdAndSecret'
            },
            'api_base_url': OPENEDX_LMS_ROOT_URL,
            'access_token_url': urljoin(OPENEDX_LMS_ROOT_URL, os.environ["OAUTH2_ACCESS_TOKEN_PATH"]),
            'authorize_url': urljoin(OPENEDX_LMS_ROOT_URL, os.environ["OAUTH2_AUTHORIZE_PATH"]),
        }
    }
]

TALISMAN_ENABLED = False

# Will allow user self registration, allowing to create Flask users from Authorized User
AUTH_USER_REGISTRATION = True

# Should we replace ALL the user's roles each login, or only on registration?
AUTH_ROLES_SYNC_AT_LOGIN = True

# These are the language dict for Superset configuration, it only supports
# a language, not different locales per language.
LANGUAGES = {{ SUPERSET_SUPPORTED_LANGUAGES }}

# This is a list of Open edX supported locales, some of which are not supported
# by Superset at this time.
DASHBOARD_LOCALES = {{ SUPERSET_DASHBOARD_LOCALES }}

# map from the values of `userinfo["role_keys"]` to a list of Superset roles
# cf https://superset.apache.org/docs/security/#roles
AUTH_ROLES_MAPPING = {
    "admin": ["Admin"],      # Superusers
    "alpha": ["Alpha"],      # Global staff
    "gamma": ["Gamma"],      # Course staff
    "instructor": ["{{SUPERSET_ROLES_MAPPING.instructor}}"], # Course instructors
    "student": ["{{SUPERSET_ROLES_MAPPING.student}}"], # Course students
    "operator": ["{{SUPERSET_ROLES_MAPPING.operator}}"], # Installation operators
    "public": ["Public"],    # AKA anonymous users
}

for locale in DASHBOARD_LOCALES:
    AUTH_ROLES_MAPPING[f"instructor-{locale}"] = [f"{{SUPERSET_ROLES_MAPPING.instructor}} - {locale}"]
    AUTH_ROLES_MAPPING[f"student-{locale}"] = [f"{{SUPERSET_ROLES_MAPPING.student}} - {locale}"]
    AUTH_ROLES_MAPPING[f"operator-{locale}"] = [f"{{SUPERSET_ROLES_MAPPING.operator}} - {locale}"]


from openedx_sso_security_manager import OpenEdxSsoSecurityManager

CUSTOM_SECURITY_MANAGER = OpenEdxSsoSecurityManager


# Enable use of variables in datasets/queries
FEATURE_FLAGS = {
    "ALERT_REPORTS": True,
    "DASHBOARD_RBAC": True,
    "EMBEDDABLE_CHARTS": True,
    "EMBEDDED_SUPERSET": True,
    "ENABLE_TEMPLATE_PROCESSING": True,
    "TAGGING_SYSTEM": False,
}

# Add this custom template processor which returns the list of courses the current user can access
from openedx_jinja_filters import *

def can_view_courses_wrapper(*args, **kwargs):
    """
    Wraps the can_view_courses call in a cache for performance.
    """
    from superset.utils.cache import memoized_func

    kwargs["cache_timeout"] = {{ SUPERSET_USER_PERMISSIONS_CACHE_TIMEOUT }}
    return memoized_func("{username}:{field_name}")(can_view_courses)(*args, **kwargs)


JINJA_CONTEXT_ADDONS = {
    'can_view_courses': can_view_courses_wrapper,
    'translate_column': translate_column,
    'translate_column_bool': translate_column_bool,
    {% for filter in SUPERSET_EXTRA_JINJA_FILTERS %}'{{ filter }}': {{filter}},{% endfor %}
}

{% if SUPERSET_ENABLE_PROXY_FIX %}
# Caddy is running behind a proxy: Superset needs to handle x-forwarded-* headers
# https://flask.palletsprojects.com/en/latest/deploying/proxy_fix/
ENABLE_PROXY_FIX = True
{% endif %}


{{ patch('superset-config-docker')}}
