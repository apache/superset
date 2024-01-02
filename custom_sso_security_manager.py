import logging
import os

from superset.security import SupersetSecurityManager

logger = logging.getLogger("auth0_login")


class CustomSsoSecurityManager(SupersetSecurityManager):
    def oauth_user_info(self, provider, response=None):  # type: ignore
        if provider == "auth0":
            res = self.appbuilder.sm.oauth_remotes[provider].get(
                f'{os.getenv("AUTH0_DOMAIN")}/userinfo'
            )

            if res.status_code != 200:
                logger.error("Failed to obtain user info: %s", res.data)
                return
            # Response does not contains data prop
            me = res.json()

            # With role an organization we should store those values in the user table or a extended version of user table
            # https://github.com/dpgaspar/Flask-AppBuilder/blob/dae4dd47d51e1e2eb5894bce55221c1d26864c3b/flask_appbuilder/security/manager.py#L1287-L1302

            logger.debug("Auth0 user_data: %s", me)

            given_name = (
                me["given_name"]
                if "given_name" in me
                else me["name"].split(" ")[0]
                if len(me["name"].split(" ")) > 0
                else ""
            )

            family_name = (
                me["family_name"]
                if "family_name" in me
                else me["name"].split(" ")[1]
                if len(me["name"].split(" ")) > 1
                else ""
            )

            # prefix = "Superset"
            return {
                "username": me["email"],
                "name": me["name"],
                "email": me["email"],
                "first_name": given_name,
                "last_name": family_name,
                "role_keys": me["role_keys"] if "role_keys" in me else [],
                # "organization": me["organization"],
            }
