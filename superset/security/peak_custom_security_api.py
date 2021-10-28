import json
from json import loads
from os import environ
import boto3
from botocore.config import Config

from flask import request
from flask_jwt_extended import (
    create_access_token,
    create_refresh_token,
)

from flask_appbuilder.api import safe
from flask_appbuilder.security.api import SecurityApi
from flask_appbuilder.const import (
    API_SECURITY_ACCESS_TOKEN_KEY,
    API_SECURITY_PASSWORD_KEY,
    API_SECURITY_PROVIDER_DB,
    API_SECURITY_PROVIDER_KEY,
    API_SECURITY_PROVIDER_LDAP,
    API_SECURITY_REFRESH_KEY,
    API_SECURITY_REFRESH_TOKEN_KEY,
    API_SECURITY_USERNAME_KEY,
)
from flask_appbuilder.views import expose

API_SECURITY_PROVIDER_JWT = "jwt"
API_SECURITY_AUTH_TOKEN_KEY = "auth_token"

# By default read timeout of boto is 60 seconds. but since timeout of API gateway is 30 seconds so we need to overwrite this default boto timeout value for our superset. we are setting these values to 10 seconds timeout and 3 retries, because we want to keep to in the little reasonable. That is, not too short and not too long. we are using exact same values in superset/custom_auth.py
BOTO_READ_TIMEOUT = float(environ.get('BOTO_READ_TIMEOUT', 10))
BOTO_MAX_ATTEMPTS = int(environ.get('BOTO_MAX_ATTEMPTS', 3))
config = Config(
    read_timeout=BOTO_READ_TIMEOUT,
    retries={'total_max_attempts': BOTO_MAX_ATTEMPTS})

lambda_client = boto3.client('lambda', config=config)

def has_solution_write_access(privileges):
    for config in privileges['level']['tenant']['tenants']:
        if config['tenant'] == environ['TENANT']:
            for resource in config['resources']:
                if (resource['name'] == 'SOLUTION MANAGER') and (resource['action'] == 'write'):
                    return True
    return False

class PeakCustomSecurityApi(SecurityApi):
    def get_authenticated_username(self, auth_token):
        username = ''
        auth_response = dict()
        try:
            token = 'Bearer {}'.format(auth_token)
            lambda_payload = json.dumps({
                    'authorizationToken': token
                })
            response = lambda_client.invoke(
                FunctionName='ais-service-authentication-{}-auth'.format(environ['STAGE']),
                Payload=lambda_payload)
            result = json.loads(response['Payload'].read())
            auth_response = result['context']
            if not auth_response['tenant'] == environ['TENANT']:
                raise Exception('Tenant mismatch in token')
            if (auth_response['role'] == 'tenantManager'):
                username = 'admin'
            elif (auth_response['role'] == 'tenantAdmin'):
                username = 'peakadmin'
            else:
                privileges = loads(auth_response['privileges'])
                if has_solution_write_access(privileges):
                    username = 'peakuser'
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
                    token: peak bearer token for authentication
                      type: string
                    username:
                      description: The username for authentication
                      example: admin
                      type: string
                    password:
                      description: The password for authentication
                      example: complex-password
                      type: string
                    provider:
                      description: Choose an authentication provider
                      example: db
                      type: string
                      enum:
                      - db
                      - ldap
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
        username = request.json.get(API_SECURITY_USERNAME_KEY, None)
        password = request.json.get(API_SECURITY_PASSWORD_KEY, None)
        refresh = request.json.get(API_SECURITY_REFRESH_KEY, False)

        if not provider or (not auth_token and (not username or not password)):
            return self.response_400(message="Missing required parameter")

        # AUTH
        if provider == API_SECURITY_PROVIDER_JWT:
            username = self.get_authenticated_username(auth_token)
            user  = self.appbuilder.sm.find_user(username)
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
