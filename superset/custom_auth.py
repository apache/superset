import functools
from os import environ
import logging
from flask import redirect, g, flash, request, make_response, jsonify
from flask_appbuilder.security.views import AuthDBView
from flask_appbuilder.security.views import expose
import boto3
from botocore.config import Config
import json

from superset.security import SupersetSecurityManager
from superset.peak import authorizer

BOTO_READ_TIMEOUT = float(environ.get('BOTO_READ_TIMEOUT', 10))
BOTO_MAX_ATTEMPTS = int(environ.get('BOTO_MAX_ATTEMPTS', 3))
config = Config(
    read_timeout=BOTO_READ_TIMEOUT,
    retries={'total_max_attempts': BOTO_MAX_ATTEMPTS})

lambda_client = boto3.client('lambda', config=config)

def use_ip_auth(f):
    """
    Use this wrapper to enable IP whitelisting on the APIs
    By default VPC CIDR range is whitelisted
    Will return 404 for unknown IPs
    """
    def wraps(self, *args, **kwargs):
        client_ip = request.headers['x-forwarded-for'] if request.headers.get('x-forwarded-for') else request.remote_addr
        try:
            lambda_payload = json.dumps({
                    'clientIp': client_ip
                })
            response = lambda_client.invoke(
                FunctionName='ais-service-authentication-{}-ipAuth'.format(environ['STAGE']),
                Payload=lambda_payload)
            result = json.loads(response['Payload'].read())

            if result is not True:
                raise Exception('Ip Address mismatch in token')

            return f(self, *args, **kwargs)
        except Exception as e:
            logging.info(e)
            response = make_response(
                jsonify({
                  'message': 'Authentication Failed',
                 }),
                404
            )
            response.headers['Content-Type'] = "application/json"
            return response

    return functools.update_wrapper(wraps, f)


class CustomAuthDBView(AuthDBView):

    @expose('/login/', methods=['GET', 'POST'])
    def login(self):
        redirect_url = self.appbuilder.get_url_for_index
        try:
            if request.args.get('redirect') is not None:
                redirect_url = request.args.get('redirect')

            if request.args.get('authToken') is not None:
                token = 'Bearer {}'.format(request.args.get('authToken'))
                authorizer.authorize(token, self.appbuilder.sm)
                return redirect(redirect_url)
            elif g.user is not None and g.user.is_authenticated:
                return redirect(redirect_url)
            else:
                raise Exception('Login is valid only through "authToken"')
        except Exception as e:
            flash(e, 'warning')
            return super(CustomAuthDBView, self).login()


class CustomSecurityManager(SupersetSecurityManager):
    authdbview = CustomAuthDBView

    def __init__(self, appbuilder):
        super(CustomSecurityManager, self).__init__(appbuilder)
