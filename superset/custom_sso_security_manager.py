from superset import SupersetSecurityManager


class CustomSsoSecurityManager(SupersetSecurityManager):
    def oauth_user_info(self, provider, response=None):
        if provider == 'Pesapal Datawarehouse Dashboard':
            # Get user info from the userinfo endpoint
            me = self.appbuilder.sm.oauth_remotes[provider].get(
                'v2/connect/userinfo').data

            # Map the user information from the response
            # Adjust these fields based on what your provider returns
            return {
                'name': me.get('name', ''),
                'email': me.get('email', ''),
                'id': me.get('sub', ''),
                'username': me.get('preferred_username', me.get('email', '')),
                'first_name': me.get('given_name', ''),
                'last_name': me.get('family_name', ''),
                'role_keys': me.get('role', [])  # If roles are provided
            }
