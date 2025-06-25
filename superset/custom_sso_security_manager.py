from superset import SupersetSecurityManager
import json


class CustomSsoSecurityManager(SupersetSecurityManager):
    def oauth_user_info(self, provider, response=None):
        if provider == 'signin-oidc':
            # Get user info from the userinfo endpoint
            me = self.appbuilder.sm.oauth_remotes[provider].get(
                'https://myaccount.pesapal.com/v2/connect/userinfo')

            data = me.json()
            print("user_data: {0}".format(data))
            print("response: {0}".format(response))

            # get user specific role info
            user_sso_roles = response.get('userinfo', {}).get('role', [])

            # print out for debugging

            print(f"Raw roles from SSO: {user_sso_roles}")
            print(f"Type of user roles from SSO: {type(user_sso_roles)}")

            if isinstance(user_sso_roles, str):
                role_keys = [user_sso_roles]
    
            elif isinstance(user_sso_roles, list):
                role_keys = user_sso_roles
            else:
                role_keys = []

            return {
                'name': response['userinfo']['given_name']+''+response['userinfo']['family_name'],
                'email': response['userinfo']['email'],
                'id': data['sub'],
                'username': data['sub'],
                'first_name': response['userinfo']['given_name'],
                'last_name': response['userinfo']['family_name'],
                'role_keys': role_keys
            }
