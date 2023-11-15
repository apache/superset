SECRET_KEY = "tOxxonFjgOCJQZ4B29XslVGJ7LOcXcOm/UIcJ0SMGzqXjL5HiRqC1w6B"
SQLALCHEMY_DATABASE_URI = "postgresql://luiggi@localhost:5432/superset"

import os
from flask_appbuilder.security.manager import (
    AUTH_OAUTH,
)
from custom_sso_security_manager import CustomSsoSecurityManager

CUSTOM_SECURITY_MANAGER = CustomSsoSecurityManager
basedir = os.path.abspath(os.path.dirname(__file__))

PUBLIC_ROLE_LIKE_GAMMA = True

AUTH_TYPE = AUTH_OAUTH
# Auto register new users
AUTH_USER_REGISTRATION = True

AUTH_USER_REGISTRATION_ROLE = "Gamma"
# Check roles on every login
AUTH_ROLES_SYNC_AT_LOGIN = True
# Roles mapping with OAuth roles_key claim
AUTH_ROLES_MAPPING = {
    "superset_super_users": ["Gamma", "Alpha"],
    "superset_users": ["Account"],
    "superset_admins": ["Admin"],
}

OAUTH_PROVIDERS = [
    {
        "name": "auth0",
        "token_key": "access_token",
        "icon": "fa-google",
        "remote_app": {
            "client_id": os.getenv("AUTH0_CLIENT_ID"),
            "client_secret": os.getenv("AUTH0_SECRET_ID"),
            "client_kwargs": {
                "scope": "openid profile email",
            },
            "base_url": os.getenv("AUTH0_DOMAIN"),
            "access_token_url": f'{os.getenv("AUTH0_DOMAIN")}/oauth/token',
            "authorize_url": f'{os.getenv("AUTH0_DOMAIN")}/authorize',
            "access_token_method": "POST",
        },
    }
]
