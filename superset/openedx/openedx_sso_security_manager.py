import logging
import time

import jwt
import requests
from authlib.common.urls import add_params_to_qs, add_params_to_uri
from authlib.integrations.flask_client import OAuthError
from flask import current_app, session
from superset.extensions import cache_manager
from superset.security import SupersetSecurityManager

log = logging.getLogger(__name__)


def add_to_headers(token, headers=None):
    """Add a Bearer Token to the request URI.
    Recommended method of passing bearer tokens.
    Authorization: Bearer h480djs93hd8
    """
    headers = headers or {}
    headers["Authorization"] = "JWT {}".format(token)
    return headers


def add_bearer_jwt_token(token, uri, headers, body, placement="header"):
    """Add a Bearer Token to the request."""
    if placement in ("uri", "url", "query"):
        uri = add_params_to_uri(token, uri)
    elif placement in ("header", "headers"):
        headers = add_to_headers(token, headers)
    elif placement == "body":
        body = add_params_to_qs(token, body)
    return uri, headers, body


class OpenEdxSsoSecurityManager(SupersetSecurityManager):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.oauth.oauth2_client_cls.client_cls.token_auth_class.SIGN_METHODS.update(
            {
                "jwt": add_bearer_jwt_token,
            }
        )

    def set_oauth_session(self, provider, oauth_response):
        """
        Store the oauth token in the session for later retrieval.
        """
        res = super().set_oauth_session(provider, oauth_response)

        if provider == "openedxsso":
            session["oauth_token"] = oauth_response
        return res

    def decoded_user_info(self):
        return jwt.decode(
            self.access_token, algorithms=["HS256"], options={"verify_signature": False}
        )

    def get_preferences(self, username):
        openedx_apis = current_app.config["OPENEDX_API_URLS"]
        url = openedx_apis["get_preference"].format(username=username)
        oauth_remote = self.oauth_remotes.get("openedxsso")
        locale_preference = "en"
        try:
            response = oauth_remote.get(url, token=self.get_oauth_token()).json()
            locale_preference = response.get("pref-lang", "en").replace("-", "_")
        except Exception as e:
            return locale_preference

        if locale_preference not in current_app.config["DASHBOARD_LOCALES"]:
            log.warning(
                f"Language {locale_preference} is not supported by Superset"
            )
            return locale_preference

        return locale_preference

    def oauth_user_info(self, provider, response=None):
        if provider == "openedxsso":
            user_profile = self.decoded_user_info()

            locale_preference = self.get_preferences(user_profile["preferred_username"])

            user_roles = self._get_user_roles(
                user_profile.get("preferred_username"), locale_preference
            )

            log.info(f"User roles for {user_profile['preferred_username']}:"
                     f" {user_roles}")

            return {
                "name": user_profile["name"],
                "email": user_profile["email"],
                "id": user_profile["preferred_username"],
                "username": user_profile["preferred_username"],
                "first_name": user_profile.get("given_name")
                or user_profile.get("name", ""),
                "last_name": user_profile.get("family_name"),
                "role_keys": user_roles,
            }

    def get_oauth_token(self):
        """
        Retrieves the oauth token from the session.
        If the access token is expired, it will try to refresh it using the refresh token.
        """
        token = session.get("oauth_token", {})

        if not token:
            raise Exception("No OAuth token found.")

        if not self.is_token_expired(token):
            return token

        try:
            new_token = self.refresh_token(token)
        except OAuthError as e:
            raise OAuthError(f"Failed to refresh the token: {e}")

        session["oauth_token"] = new_token

        refreshed_token = session.get("oauth_token", {})
        return refreshed_token

    def is_token_expired(self, token):
        """
        Checks if the given token is expired.
        """
        is_expired = time.time() > token.get("expires_at", 0)
        return is_expired

    def refresh_token(self, token):
        """
        Uses the refresh token to obtain a new access token.
        """
        provider = session.get("oauth_provider")
        oauth_remote = self.oauth_remotes.get(provider)

        if not oauth_remote:
            raise Exception("No OAuth remote object found")

        refresh_token = token.get("refresh_token")
        lms_root_url = current_app.config["OPENEDX_LMS_ROOT_URL"]
        refresh_url = f"{lms_root_url}/oauth2/access_token/"

        data = {
            "client_id": oauth_remote.client_id,
            "client_secret": oauth_remote.client_secret,
            "grant_type": "refresh_token",
            "refresh_token": refresh_token,
            "token_type": "JWT",
        }
        response = requests.post(refresh_url, data=data)
        if response.status_code == 200:
            new_token = response.json()
            return new_token
        return token

    @property
    def access_token(self):
        """
        Returns the string access_token portion of the current OAuth token.
        """
        return self.get_oauth_token().get("access_token")

    def _get_user_roles(self, username, locale):
        """
        Returns the Superset roles that should be associated with the given user.
        """
        decoded_access_token = self.decoded_user_info()

        if decoded_access_token.get("superuser", False):
            return ["admin", f"admin-{locale}"]
        elif decoded_access_token.get("administrator", False):
            return ["alpha", "operator", f"operator-{locale}"]
        else:
            # User has to have staff access to one or more courses to view any content
            # here. Since this is only called on login, we take the opportunity
            # to force refresh the user's courses from LMS. This allows them to bust
            # the course permissions cache if necessary by logging out and back in.
            courses = self.get_courses(username, force=True)
            if courses:
                return ["instructor", f"instructor-{locale}"]
            else:
                roles = self.extra_get_user_roles(username, decoded_access_token)
                if roles:
                    if {{SUPERSET_BLOCK_STUDENT_ACCESS}} and 'student' in roles:
                        raise Exception(f"Student access not allowed for {username} due to SUPERSET_BLOCK_STUDENT_ACCESS setting.")
                    return roles

                if {{SUPERSET_BLOCK_STUDENT_ACCESS}}:
                    raise Exception(f"Student {username} tried to access Superset")
                else:
                    return ["student", f"student-{locale}"]

    def extra_get_user_roles(self, username, decoded_access_token):
        """
        Returns the Superset roles that should be associated with the given user.
        """
        {{patch("superset-sso-assignment-rules") | indent(8)}}
        return None

    def get_courses(self, username, permission="staff", next_url=None, force=False):
        """
        Returns the list of courses the current user has access to.

        Calls itself recursively if the response is paginated.
        Force will cause a force refresh of the cache, we do this on login to make
        sure that the user always has an ability to update this data.
        """
        cache = cache_manager.cache
        cache_key = f"{username}+{permission}"

        # Only return from the cache when we're at the top level
        # (not in recursion)
        if not next_url and not force:
            obj = cache.get(cache_key)
            if obj is not None:
                return obj

        courses = []
        provider = session.get("oauth_provider")
        oauth_remote = self.oauth_remotes.get(provider)
        if not oauth_remote:
            logging.error("No OAuth2 provider? expected openedx")
            return courses

        token = self.get_oauth_token()
        if not token:
            logging.error("No oauth token? expected one provided by openedx")
            return courses

        openedx_apis = current_app.config["OPENEDX_API_URLS"]
        courses_url = openedx_apis["get_courses"].format(
            username=username, permission=permission
        )
        url = next_url or courses_url
        resp = oauth_remote.get(url, token=token)
        resp.raise_for_status()
        response = resp.json()

        for course in response.get("results", []):
            course_id = course.get("course_id")
            if course_id:
                courses.append(course_id)

        # Recurse to iterate over all the pages of results
        if response.get("next"):
            next_courses = self.get_courses(
                username, permission=permission, next_url=response["next"]
            )
            for course_id in next_courses:
                courses.append(course_id)

        log.info(f"Courses for {username}: {courses}")

        # Only cache the top level (non-recursive) response
        if not next_url:
            cache.set(cache_key, courses, timeout=300)

        return courses
