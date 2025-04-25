from superset import SupersetSecurityManager


class CustomSsoSecurityManager(SupersetSecurityManager):
    def oauth_user_info(self, provider, response=None):
        if provider == 'signin-oidc':
            # Get user info from the userinfo endpoint
            me = self.appbuilder.sm.oauth_remotes[provider].get(
                'https://cybqa.pesapal.com/pesapalsso/v2/connect/userinfo')
            data = me.json()
            print("user_data: {0}".format(data))
            return {
                'name': data['name'],
                'email': data['email'],
                'id': data['preferred_username'],
                'username': data['preferred_username'],
                'first_name': data['given_name'],
                'last_name': data['family_name']
            }
