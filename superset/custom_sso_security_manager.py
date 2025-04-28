from superset import SupersetSecurityManager
import json


class CustomSsoSecurityManager(SupersetSecurityManager):
    def oauth_user_info(self, provider, response=None):
        if provider == 'signin-oidc':
            # Get user info from the userinfo endpoint
            me = self.appbuilder.sm.oauth_remotes[provider].get(
                'https://cybqa.pesapal.com/pesapalsso/v2/connect/userinfo')

            data = me.json()
            print("user_data: {0}".format(data))
            print("response: {0}".format(response))
            # {
            #     'access_token': '',
            #     'token_type': 'Bearer',
            #     'expires_in': 1199,
            #     'scope': 'openid',
            #     'id_token': 'eyJhbGciOiJSUzI1NiIsImtpZCI6IkM4MjQ1RDQyN0Y3RjVBQjk3MkZBQkVDNTlGOTgxNEEyRDEwOUQ4MTEiLCJ4NXQiOiJ5Q1JkUW45X1dybHktcjdGbjVnVW90RUoyQkUiLCJ0eXAiOiJKV1QifQ.eyJlbWFpbCI6Imlhbi5rYW5nZXRoZUBwZXNhcGFsLmNvbSIsImZhbWlseV9uYW1lIjoiS2FuZ2V0aGUiLCJnaXZlbl9uYW1lIjoiSWFuIiwicm9sZSI6WyJEZXZlbG9wZXIiLCJEYXRhRW5naW5lZXIiXSwic3ViIjoiaWFuLmthbmdldGhlQHBlc2FwYWwuY29tIiwiaXNzIjoiaHR0cHM6Ly9jeWJxYS5wZXNhcGFsLmNvbS9wZXNhcGFsc3NvIiwib2lfYXVfaWQiOiI0ZWRjYzAyZC1hY2EzLTQ2NDAtOWM3MS05YTZmZGE4MmZjMjgiLCJhenAiOiI5NDU3ZjRhOS1iOGY3LTQ1ZjYtYTNkYi01MGU5NDAxOWM2MDAiLCJub25jZSI6IlFVMXdwRmJyamNXVVBoVTV6ZXlqIiwiYXRfaGFzaCI6IktBamxtWUI2ZURCZmRTMjZGSEdKYnciLCJvaV90a25faWQiOiJhMmJiZmUyZC03MGM5LTQwNzEtYjhhZi1jNTkwYThiODYwZTciLCJhdWQiOiI5NDU3ZjRhOS1iOGY3LTQ1ZjYtYTNkYi01MGU5NDAxOWM2MDAiLCJleHAiOjE3NDU4MzIxMjIsImlhdCI6MTc0NTgzMDkyMn0.E9Uv2VtwcAfOT_yw-q4Ul4iOMOmrV2-y7Yt_LuuMWnKIeqqXISN794GkrbmACC7iFLLwOW_Qg3p1Vp4uZhJ1T16_cSEljocJmvEm-FJIbsLjDoigM_P1ZlrnSvABGRtFpzYnYeTH0etU5LL17NvHqdqzmAlIQOvFxEo5vvywjoMB7aDj2IPSvNVDho9VMBCUcTln-FnEERhMsiOrExVd8IAuM7rOXPwL6Utqn6Rck5bd2En7rtQetwBkDklLUCItTftoaFmjEArWqc-v5maVrM-YmeSkCAOuS0uG0bhoRbLAJH5mSqfIdkFSO11Y6I6nfQoaIAGy7AA5ho-czSYDAg',
            #     'expires_at': 1745832122,
            #     'userinfo': {'email': 'ian.kangethe@pesapal.com',
            #                  'family_name': 'Kangethe', 'given_name': 'Ian',
            #                  'role': ['Developer', 'DataEngineer'],
            #                  'sub': 'ian.kangethe@pesapal.com',
            #                  'iss': 'https://cybqa.pesapal.com/pesapalsso',
            #                  'oi_au_id': '4edcc02d-aca3-4640-9c71-9a6fda82fc28',
            #                  'azp': '9457f4a9-b8f7-45f6-a3db-50e94019c600',
            #                  'nonce': 'QU1wpFbrjcWUPhU5zeyj',
            #                  'at_hash': 'KAjlmYB6eDBfdS26FHGJbw',
            #                  'oi_tkn_id': 'a2bbfe2d-70c9-4071-b8af-c590a8b860e7',
            #                  'aud': '9457f4a9-b8f7-45f6-a3db-50e94019c600',
            #                  'exp': 1745832122, 'iat': 1745830922}}

            return {
                'name': response['userinfo']['given_name']+''+response['userinfo']['family_name'],
                'email': response['userinfo']['email'],
                'id': data['sub'],
                'username': data['sub'],
                'first_name': response['userinfo']['given_name'],
                'last_name': response['userinfo']['family_name'],
                'role_keys': response['userinfo']['role']
            }
