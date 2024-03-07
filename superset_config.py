from flask_appbuilder.security.manager import AUTH_OAUTH
import os
from dotenv import load_dotenv
from flask_appbuilder.security.manager import AUTH_OAUTH
import logging
from flask_appbuilder.views import expose
from superset.security import SupersetSecurityManager
from flask_appbuilder.security.views import AuthOAuthView
from werkzeug.wrappers import Response as WerkzeugResponse
from flask import Blueprint, Response, g, request,redirect,flash
from flask_login import login_user

class CustomAuthOAuthView(AuthOAuthView):
    @expose("/oauth-authorized/<provider>")
    def oauth_authorized(self, provider: str) -> WerkzeugResponse:
        logging.debug("Custom Authorized init")
        if provider == 'keycloak2':
            access_token=request.cookies['app_session']
            provider='keycloak'
            resp:Oauth2Token = {"access_token": access_token}
            g._oauth_token_keycloak=resp
            logging.debug(f"access token --------- {access_token}")
            logging.debug(f"response --------- {resp}")
            logging.debug(f"g --------- {g._oauth_token_keycloak}")
            if resp is None:
                flash("You denied the request to sign in.", "warning")
                return redirect(self.appbuilder.get_url_for_login)
            logging.debug("OAUTH Authorized resp: %s", resp)
            # Retrieves specific user info from the provider
            try:
                self.appbuilder.sm.set_oauth_session(provider, resp)
                userinfo = self.appbuilder.sm.oauth_user_info(provider, resp)
            except Exception as e:
                logging.error("Error returning OAuth user info: %s", e)
                user = None
            else:
                logging.debug("User info retrieved from %s: %s", provider, userinfo)
                # User email is not whitelisted
                if provider in self.appbuilder.sm.oauth_whitelists:
                    whitelist = self.appbuilder.sm.oauth_whitelists[provider]
                    allow = False
                    for email in whitelist:
                        if "email" in userinfo and re.search(email, userinfo["email"]):
                            allow = True
                            break
                    if not allow:
                        flash("You are not authorized.", "warning")
                        return redirect(self.appbuilder.get_url_for_login)
                else:
                    logging.debug("No whitelist for OAuth provider")
                user = self.appbuilder.sm.auth_user_oauth(userinfo)

            if user is None:
                flash(as_unicode(self.invalid_login_message), "warning")
                return redirect(self.appbuilder.get_url_for_login)
            else:
                
                login_user(user)
                next_url = request.args['next']
                # Check if there is a next url on state
                return redirect(next_url)
        else:
            if provider not in self.appbuilder.sm.oauth_remotes:
                flash("Provider not supported.", "warning")
                logging.warning("OAuth authorized got an unknown provider %s", provider)
                return redirect(self.appbuilder.get_url_for_login)
            try:
                resp = self.appbuilder.sm.oauth_remotes[provider].authorize_access_token()
            except Exception as e:
                logging.error("Error authorizing OAuth access token: %s", e)
                flash("The request to sign in was denied.", "error")
                return redirect(self.appbuilder.get_url_for_login)
            if resp is None:
                flash("You denied the request to sign in.", "warning")
                return redirect(self.appbuilder.get_url_for_login)
            logging.debug("OAUTH Authorized resp: %s", resp)
            # Retrieves specific user info from the provider
            try:
                self.appbuilder.sm.set_oauth_session(provider, resp)
                userinfo = self.appbuilder.sm.oauth_user_info(provider, resp)
            except Exception as e:
                logging.error("Error returning OAuth user info: %s", e)
                user = None
            else:
                logging.debug("User info retrieved from %s: %s", provider, userinfo)
                # User email is not whitelisted
                if provider in self.appbuilder.sm.oauth_whitelists:
                    whitelist = self.appbuilder.sm.oauth_whitelists[provider]
                    allow = False
                    for email in whitelist:
                        if "email" in userinfo and re.search(email, userinfo["email"]):
                            allow = True
                            break
                    if not allow:
                        flash("You are not authorized.", "warning")
                        return redirect(self.appbuilder.get_url_for_login)
                else:
                    logging.debug("No whitelist for OAuth provider")
                user = self.appbuilder.sm.auth_user_oauth(userinfo)

            if user is None:
                flash(as_unicode(self.invalid_login_message), "warning")
                return redirect(self.appbuilder.get_url_for_login)
            else:
                try:
                    state = jwt.decode(
                        request.args["state"], session["oauth_state"], algorithms=["HS256"]
                    )
                except (jwt.InvalidTokenError, KeyError):
                    flash(as_unicode("Invalid state signature"), "warning")
                    return redirect(self.appbuilder.get_url_for_login)

                login_user(user)
                next_url = self.appbuilder.get_url_for_index
                # Check if there is a next url on state
                if "next" in state and len(state["next"]) > 0:
                    next_url = get_safe_redirect(state["next"][0])
                return redirect(next_url)
class CustomSsoSecurityManager(SupersetSecurityManager):

    authoauthview = CustomAuthOAuthView
    def oauth_user_info(self, provider, response=None):
        logging.debug("Oauth2 provider: {0}.".format(provider))
        if provider == 'keycloak':
            #As example, this line request a GET to base_url + '/' + userDetails with Bearer  Authentication,
            # and expects that authorization server checks the token, and response with user details
            me = self.appbuilder.sm.oauth_remotes[provider].get("userinfo")
            logging.debug("user_data:")
            logging.debug(me.json())
            return {
            "preferred_username": me.json().get("preferred_username",""),
            "first_name": me.json().get("given_name", ""),
            "last_name": me.json().get("family_name", ""),
            "email": me.json().get("email", ""),
            "username": me.json().get("preferred_username",""),
            "role_keys": me.json().get("groups", []),
            }
        else:
            return {}

load_dotenv(verbose=True)


SESSION_COOKIE_SAMESITE = 'None'
SESSION_COOKIE_HTTPONLY = True
SESSION_COOKIE_SECURE = True

ENABLE_PROXY_FIX=True

SECRET_KEY = os.environ['SECRET_KEY']
PREVIOUS_SECRET_KEY=os.environ['P_SECRET_KEY']
FEATURE_FLAGS = {"EMBEDDED_SUPERSET": True}

ENABLE_CORS=True

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
                        'server_metadata_url': os.environ['SERVER_METADATA_URL']
                        ,'api_base_url': os.environ['API_BASE_URL']
                        ,'access_token_url':'https://cea.hexalogy.com/realms/Hexalogy/protocol/openid-connect/token',
                        "request_token_url": None,
                        }
            ,}
]
CUSTOM_SECURITY_MANAGER = CustomSsoSecurityManager