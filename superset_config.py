import os

# DB config
DATABASE_DIALECT = os.getenv("DATABASE_DIALECT")
DATABASE_USER = os.getenv("DATABASE_USER")
DATABASE_PASSWORD = os.getenv("DATABASE_PASSWORD")
DATABASE_HOST = os.getenv("DATABASE_HOST")
DATABASE_PORT = os.getenv("DATABASE_PORT")
DATABASE_DB = os.getenv("DATABASE_DB")

# The SQLAlchemy connection string.
SQLALCHEMY_DATABASE_URI = (
    f"{DATABASE_DIALECT}://"
    f"{DATABASE_USER}{f':{DATABASE_PASSWORD}' if DATABASE_PASSWORD is not None else '' }@"
    f"{DATABASE_HOST}:{DATABASE_PORT}/{DATABASE_DB}"
)

APP_NAME = "Immersa"

APP_ICON = os.getenv("APP_ICON_URL")

LOGO_TARGET_PATH = os.getenv("LOGO_TARGET_URL")

LOGO_TOOLTIP = "Go to Immersa Web App"

SESSION_COOKIE_SAMESITE = "None"

SESSION_COOKIE_SECURE = True

SESSION_COOKIE_HTTPONLY = False

ENABLE_PROXY_FIX = True

HTTP_HEADERS = {"X-Frame-Options": "ALLOWALL"}

OVERRIDE_HTTP_HEADERS = {"X-Frame-Options": "ALLOWALL"}

PUBLIC_ROLE_LIKE = "Gamma"

ENABLE_CORS = True

CORS_OPTIONS = {
    "supports_credentials": True,
    "allow_headers": ["*"],
    "resources": ["*"],
    "origins": ["*"],
}

# Thumbnails feature will required redis and celery configuration
FEATURE_FLAGS = {"EMBEDDED_SUPERSET": True, "THUMBNAILS": True}

# Can enabled or disabled based on the env
FAB_API_SWAGGER_UI = True

# Library related to CSP
TALISMAN_ENABLED = False

# For Custom SSo - Auth0
from flask_appbuilder.security.manager import AUTH_OAUTH

from custom_sso_security_manager import CustomSsoSecurityManager

CUSTOM_SECURITY_MANAGER = CustomSsoSecurityManager
basedir = os.path.abspath(os.path.dirname(__file__))

PUBLIC_ROLE_LIKE_GAMMA = True

if os.getenv("GUEST_TOKEN_JWT_EXP_SECONDS") is not None:
    GUEST_TOKEN_JWT_EXP_SECONDS = int(os.getenv("GUEST_TOKEN_JWT_EXP_SECONDS") or 300)

AUTH_TYPE = AUTH_OAUTH

# Auto register new users
AUTH_USER_REGISTRATION = True

AUTH_USER_REGISTRATION_ROLE = ""

# Check roles on every login
AUTH_ROLES_SYNC_AT_LOGIN = True

# Roles mapping with OAuth roles_key claim
AUTH_ROLES_MAPPING = {
    "superset_super_users": ["Standard User", "Super User", "sql_lab"],
    "superset_users": ["Standard User"],
    "superset_admins": ["Admin"],
}

OAUTH_PROVIDERS = [
    {
        "name": "auth0",
        "token_key": "access_token",
        "icon": "fa-google",  # For now, need to find a better icon
        "remote_app": {
            "client_id": os.getenv("AUTH0_CLIENT_ID"),
            "client_secret": os.getenv("AUTH0_SECRET_ID"),
            "client_kwargs": {
                "scope": "openid profile email",
            },
            "base_url": os.getenv("AUTH0_DOMAIN"),
            "jwks_uri": f'{os.getenv("AUTH0_DOMAIN")}/.well-known/jwks.json',
            "access_token_url": f'{os.getenv("AUTH0_DOMAIN")}/oauth/token',
            "authorize_url": f'{os.getenv("AUTH0_DOMAIN")}/authorize',
            "access_token_method": "POST",
        },
    }
]

from flask import g, redirect, request
from flask_appbuilder import expose, IndexView

from superset.extensions import appbuilder
from superset.superset_typing import FlaskResponse
from superset.utils.core import get_user_id


class SupersetIndexView(IndexView):
    @expose("/")
    @expose("/login/")
    @expose("/login")
    @expose("/superset/welcome/")
    @expose("/superset/welcome")
    def index(self) -> FlaskResponse:
        if not g.user or not get_user_id():
            next = f"?next={request.args.get('next', '')}"
            provider_login_url = f"{appbuilder.get_url_for_login}auth0{next}"

            return redirect(provider_login_url)

        return redirect("/dashboard/list")


FAB_INDEX_VIEW = f"{SupersetIndexView.__module__}.{SupersetIndexView.__name__}"
