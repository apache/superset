from flask_appbuilder.security.manager import AUTH_OID
from superset.security import SupersetSecurityManager
from flask_oidc import OpenIDConnect
from flask_appbuilder.security.views import AuthOIDView
from flask_login import login_user, logout_user
from urllib.parse import quote
from flask_appbuilder.views import ModelView, expose
from flask import redirect, request, session
from typing import Optional
import logging
import json

class OIDCSecurityManager(SupersetSecurityManager):
    def __init__(self, appbuilder: ModelView) -> None:
        super(OIDCSecurityManager, self).__init__(appbuilder)
        if self.auth_type == AUTH_OID:
            self.oid = OpenIDConnect(self.appbuilder.get_app)
        self.authoidview = AuthOIDCView

class AuthOIDCView(AuthOIDView):

    @expose('/login/', methods=['GET', 'POST'])
    def login(self, flag: bool = True) -> Optional[redirect]:
        sm = self.appbuilder.sm
        oidc = sm.oid

        @self.appbuilder.sm.oid.require_login
        def handle_login() -> Optional[redirect]:
            user = sm.auth_user_oid(oidc.user_getfield('email'))
            if user is None:
                info = oidc.user_getinfo(['preferred_username', 'given_name', 'family_name', 'email'])
                default_role = self.appbuilder.app.config.get("AUTH_USER_REGISTRATION_ROLE", "Public")

                user = sm.add_user(
                    info.get('preferred_username'),
                    info.get('given_name'),
                    info.get('family_name'),
                    info.get('email'),
                    sm.find_role(default_role)
                )
            login_user(user, remember=False)
            return redirect(self.appbuilder.get_url_for_index)
        return handle_login()

    @expose('/logout/', methods=['GET', 'POST'])
    def logout(self) -> redirect:
        sm = self.appbuilder.sm
        oidc = sm.oid

        # Initiate logout from the OIDC provider (Keycloak)
        oidc.logout()
        # Call the parent logout (which should log out the user locally)
        super(AuthOIDCView, self).logout()

        # Capture the redirect URL (typically pointing back to the login page)
        redirect_url = request.url_root.strip('/') + self.appbuilder.get_url_for_login

        # Retrieve the id_token from session if available
        auth_token = session.get("oidc_auth_token")
        id_token_hint = None
        if auth_token:
            if isinstance(auth_token, dict):
                id_token_hint = auth_token.get("id_token")
            elif isinstance(auth_token, (str, bytes)):
                try:
                    token_info = json.loads(auth_token)
                    id_token_hint = token_info.get("id_token")
                except Exception as e:
                    logging.warning("Failed to parse oidc_auth_token: %s", e)

        # Build the logout URL
        if id_token_hint:
            logout_url = (
                oidc.client_secrets.get('issuer')
                + '/protocol/openid-connect/logout'
                + '?post_logout_redirect_uri=' + quote(redirect_url)
                + '&id_token_hint=' + quote(id_token_hint)
            )
        else:
            logout_url = (
                oidc.client_secrets.get('issuer')
                + '/protocol/openid-connect/logout'
                + '?post_logout_redirect_uri=' + quote(redirect_url)
                + '&client_id=' + quote(oidc.client_secrets.get('client_id'))
            )
        
        # Explicitly clear the entire session to remove all authentication data.
        session.clear()
        
        # Additionally, log out from Flask-Login if needed.
        logout_user()

        return redirect(logout_url)