import functools
from datetime import timedelta, datetime
from json import loads
from os import environ
import logging
from flask import redirect, g, flash, request, make_response, jsonify
from flask_appbuilder.security.views import AuthDBView
from flask_appbuilder.security.views import expose
from flask_login import login_user
import boto3
from botocore.config import Config
import json

from superset.security import SupersetSecurityManager

ALLOWED_RESOURCES = ['SEGMENT EXPLORER', 'AD OPTIMIZATION', 'RECOMMENDER', 'MERCHANDISER']

BOTO_READ_TIMEOUT = float(environ.get('BOTO_READ_TIMEOUT', 10))
BOTO_MAX_ATTEMPTS = int(environ.get('BOTO_MAX_ATTEMPTS', 3))
config = Config(
    read_timeout=BOTO_READ_TIMEOUT,
    retries={'total_max_attempts': BOTO_MAX_ATTEMPTS})

lambda_client = boto3.client('lambda', config=config)

def has_resource_access(privileges):
    for config in privileges['level']['tenant']['tenants']:
        if config['tenant'] == environ['TENANT']:
            for resource in config['resources']:
                if ('name' in resource) and (resource['name'] in ALLOWED_RESOURCES):
                    return True
    return False

def has_solution_write_access(privileges):
    for config in privileges['level']['tenant']['tenants']:
        if config['tenant'] == environ['TENANT']:
            for resource in config['resources']:
                if (resource['name'] == 'SOLUTION MANAGER') and (resource['action'] == 'write'):
                    return True
    return False


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
        user = 'guest'
        try:
            if request.args.get('redirect') is not None:
                redirect_url = request.args.get('redirect')

            if request.args.get('authToken') is not None:
                token = 'Bearer {}'.format(request.args.get('authToken'))
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
                    user = 'admin'
                elif (auth_response['role'] == 'tenantAdmin'):
                    user = 'peakadmin'
                else:
                    privileges = loads(auth_response['privileges'])
                    if has_solution_write_access(privileges):
                        user = 'peakuser'
                    elif not has_resource_access(privileges):
                        raise Exception('Insufficient Resource Permissions')
                user = self.appbuilder.sm.find_user(user)
                login_user(user, remember=False,
                           duration=timedelta(
                            auth_response['exp'] - int(
                                datetime.now().timestamp())))
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
