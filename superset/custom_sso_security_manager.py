from superset import SupersetSecurityManager


class CustomSsoSecurityManager(SupersetSecurityManager):
    def oauth_user_info(self, provider, response=None):
        if provider == 'signin-oidc':
            # Get user info from the userinfo endpoint
            me = self.appbuilder.sm.oauth_remotes[provider].get(
                'https://cybqa.pesapal.com/pesapalsso/v2/connect/userinfo')
            data = me.json()
            print("user_data: {0}".format(data))

            # # Extract email from the 'sub' or 'email' field
            # email = data.get('email', data.get('sub'))
            #
            # # Extract username from email (before the @ symbol)
            # username = email.split('@')[0] if '@' in email else email
            #
            # # Split the username to get first and last name
            # # This is a simple approach - you might want to improve it
            # name_parts = username.split('.')
            # first_name = name_parts[0].capitalize() if len(name_parts) > 0 else ''
            # last_name = name_parts[1].capitalize() if len(name_parts) > 1 else ''
            #
            # # Full name
            # name = f"{first_name} {last_name}".strip()

            # return {
            #     'name': name,
            #     'email': email,
            #     'id': email,  # Using email as the unique identifier
            #     'username': username,
            #     'first_name': first_name,
            #     'last_name': last_name,
            #     # You can also store the user_apps as additional user attributes if needed
            #     # 'user_apps': data.get('user_apps', [])
            # }
            return {
                'name': data['sub'],
                'email': data['email'],
                'id': data['sub'],
                'username': data['sub'],
                'first_name': data['sub'],
                'last_name': data['sub']
            }
