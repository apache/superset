import logging
import json
from os import environ
from datetime import timedelta, datetime

import boto3
from flask_login import login_user
from botocore.config import Config

"""
 By default read timeout of boto is 60 seconds but since timeout of API gateway
 is 30 seconds so we need to overwrite this default boto timeout value for our superset.
 We are setting these values to 10 seconds timeout and 3 retries, because we want to
 keep it to little reasonable. That is, not too short and not too long.
"""

BOTO_READ_TIMEOUT = float(environ.get('BOTO_READ_TIMEOUT', 10))
BOTO_MAX_ATTEMPTS = int(environ.get('BOTO_MAX_ATTEMPTS', 3))
config = Config(read_timeout=BOTO_READ_TIMEOUT, retries={'total_max_attempts': BOTO_MAX_ATTEMPTS})

lambda_client = boto3.client('lambda', config=config)

def has_dashboard_write_access(privileges):
    for config in privileges['level']['tenant']['tenants']:
        if config['tenant'] == environ['TENANT']:
            for resource in config['resources']:
                if ((resource['name'] == 'DASHBOARD')
                   and (resource['action'] == 'write')):
                    return True
    return False

def authorize(token, sm, login=True):
    username = 'guest'
    try:
        lambda_payload = json.dumps({
                'authorizationToken': token
            })
        response = lambda_client.invoke(
            FunctionName='ais-service-authentication-{}-auth'.format(
                           environ['STAGE']
                          ),
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
            privileges = json.loads(auth_response['privileges'])
            if has_dashboard_write_access(privileges):
                username = 'peakuser'

        user = sm.find_user(username)

        # perform login if boolean argument is True
        if login:
            login_user(user, remember=False,
                        duration=timedelta(
                            auth_response['exp'] - int(
                                datetime.now().timestamp())))

        logging.info("Authentication successful for username: %s", username)
        return username
    except Exception as e:
        logging.info("Failed to login!")
        raise e
