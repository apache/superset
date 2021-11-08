from flask import request
from flask_jwt_extended import (
    create_access_token,
    create_refresh_token,
)

from flask_appbuilder.api import safe
from flask_appbuilder.security.api import SecurityApi
from flask_appbuilder.const import (
    API_SECURITY_ACCESS_TOKEN_KEY,
    API_SECURITY_PROVIDER_KEY,
    API_SECURITY_REFRESH_KEY,
    API_SECURITY_REFRESH_TOKEN_KEY,
)
from flask_appbuilder.views import expose

from superset.peak import authorizer

API_SECURITY_PROVIDER_JWT = "jwt"
API_SECURITY_AUTH_TOKEN_KEY = "auth_token"

class PeakCustomSecurityApi(SecurityApi):
    def get_authenticated_username(self, auth_token):
        username = ''
        try:
            token = 'Bearer {}'.format(auth_token)
            username = authorizer.authorize(token, self.appbuilder.sm, login=False)
        except Exception as e:
            print('Exception in getting authenticated username', e)
        return username

    @expose("/login", methods=["POST"])
    @safe
    def login(self):
        """Login endpoint for the API returns a JWT and optionally a refresh token
        ---
        post:
          description: >-
            Authenticate and get a JWT access and refresh token
          requestBody:
            required: true
            content:
              application/json:
                schema:
                  type: object
                  properties:
                    auth_token: peak bearer token for authentication
                      type: string
                    provider:
                      description: Choose an authentication provider
                      example: jwt
                      type: string
                    refresh:
                      description: If true a refresh token is provided also
                      example: true
                      type: boolean
          responses:
            200:
              description: Authentication Successful
              content:
                application/json:
                  schema:
                    type: object
                    properties:
                      access_token:
                        type: string
                      refresh_token:
                        type: string
            400:
              $ref: '#/components/responses/400'
            401:
              $ref: '#/components/responses/401'
            500:
              $ref: '#/components/responses/500'
        """
        if not request.is_json:
            return self.response_400(message="Request payload is not JSON")

        provider = request.json.get(API_SECURITY_PROVIDER_KEY, None)
        auth_token = request.json.get(API_SECURITY_AUTH_TOKEN_KEY, None)
        refresh = request.json.get(API_SECURITY_REFRESH_KEY, False)

        if not provider or not auth_token:
            return self.response_400(message="Missing required parameter")

        # AUTH
        if provider == API_SECURITY_PROVIDER_JWT:
            username = self.get_authenticated_username(auth_token)
            user = self.appbuilder.sm.find_user(username)
        else:
            return self.response_400(
                message="Provider {} not supported".format(provider)
            )
        if not user:
            return self.response_401()

        # Identity can be any data that is json serializable
        resp = dict()
        resp[API_SECURITY_ACCESS_TOKEN_KEY] = create_access_token(
            identity=user.id, fresh=True
        )
        if refresh:
            resp[API_SECURITY_REFRESH_TOKEN_KEY] = create_refresh_token(
                identity=user.id
            )
        return self.response(200, **resp)
