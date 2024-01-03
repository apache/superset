import logging
import os

from superset.security import SupersetSecurityManager

logger = logging.getLogger("auth0_login")

SUPERSET_ADMIN_MAPPING_ROLE_NAME = "superset_admins"


class CustomSsoSecurityManager(SupersetSecurityManager):
    def extract_name_claim(
        self,
        me: dict[str, str],
        claim: str,
        index: int = 0,
    ) -> str:
        return (
            me[claim]
            if claim in me
            else me["name"].split(" ")[index]
            if len(me["name"].split(" ")) > index
            else ""
        )

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

            email = me["email"]

            given_name = self.extract_name_claim(me, "given_name", 0)

            family_name = self.extract_name_claim(me, "family_name", 1)

            organization: str = me["organization"] if "organization" in me else None

            superset_roles: list[str] = me["role_keys"] if "role_keys" in me else []

            is_admin: bool = SUPERSET_ADMIN_MAPPING_ROLE_NAME in superset_roles

            if not is_admin:
                if organization is not None and len(organization) > 0:
                    self.auth_roles_mapping[organization] = [organization.capitalize()]
                    superset_roles.append(organization)
                else:
                    logger.error(f"User ${email} does not have an organization.")

            return {
                "username": me["email"],
                "name": me["name"],
                "email": email,
                "first_name": given_name,
                "last_name": family_name,
                "role_keys": superset_roles,
            }
