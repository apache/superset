#
# Licensed to the Apache Software Foundation (ASF) under one or more
# contributor license agreements.  See the NOTICE file distributed with
# this work for additional information regarding copyright ownership.
# The ASF licenses this file to You under the Apache License, Version 2.0
# (the "License"); you may not use this file except in compliance with
# the License.  You may obtain a copy of the License at
#
#    http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.
#

import os
import boto3
import base64
import json
from botocore.exceptions import ClientError


def get_secret(secrets_provider, secret_key, *args, **kwargs):
    """
    This abstraction allows you to implement secrets however you'd like. AWS SecretsManager is set up as an example and
    further work can be done to add implementations for various other popular secrets managers.
    :param secrets_provider: Specify the provider who is hosting your secrets. If not provided, you must add args of the
    environment variables that represent your secrets (see args below)
    :param secret_key: For most managers, a single key can represent and object. If this assumption is incorrect,
    further refactor may be necessary.
    :param args: If you are not using a provider and prefer to just specify secrets in environment variables, you can
    specify the environment variable keys as args, which will be returned as a key:value object with the value
    :param kwargs: Used primarily for provider specifics i.e. aws_region
    :return:
    """
    if secrets_provider.lower() == "aws":
        aws_region = get_env_variable("AWS_REGION")
        return get_aws_secret(secret_name=secret_key, region_name=aws_region)
    elif secrets_provider.lower() == "vault":
        # TODO Implementation
        pass
    elif secrets_provider.lower() == "gcp":
        # TODO Implementation
        pass
    else:
        secret = None
        for arg in args:
            secret[arg] = get_env_variable(arg)
        return secret


def get_aws_secret(secret_name, region_name):
    """
    :param secret_name: the secret to retrieve from SecretsManager
    :param region_name: aws region
    :return: Dict object of the secret
    :notes: Use env vars via docker.env when running locally for credentials. This allows credentials to be picked up
    silently by boto3 and allows an ECS or EC2 instance to use an execution role policy to access api resources.
    `AWS_ACCESS_KEY_ID=XXXXXXX`
    `AWS_SECRET_ACCESS_KEY=XXXXXXXX`
    """
    # Use env vars so that we never have to type a credential for aws
    # Create a Secrets Manager client
    session = boto3.session.Session()
    client = session.client(
        service_name='secretsmanager',
        region_name=region_name
    )

    # In this sample we only handle the specific exceptions for the 'GetSecretValue' API.
    # See https://docs.aws.amazon.com/secretsmanager/latest/apireference/API_GetSecretValue.html
    # We rethrow the exception by default.

    try:
        get_secret_value_response = client.get_secret_value(
            SecretId=secret_name
        )
    except ClientError as e:
        if e.response['Error']['Code'] == 'DecryptionFailureException':
            # Secrets Manager can't decrypt the protected secret text using the provided KMS key.
            # Deal with the exception here, and/or rethrow at your discretion.
            raise e
        elif e.response['Error']['Code'] == 'InternalServiceErrorException':
            # An error occurred on the server side.
            # Deal with the exception here, and/or rethrow at your discretion.
            raise e
        elif e.response['Error']['Code'] == 'InvalidParameterException':
            # You provided an invalid value for a parameter.
            # Deal with the exception here, and/or rethrow at your discretion.
            raise e
        elif e.response['Error']['Code'] == 'InvalidRequestException':
            # You provided a parameter value that is not valid for the current state of the resource.
            # Deal with the exception here, and/or rethrow at your discretion.
            raise e
        elif e.response['Error']['Code'] == 'ResourceNotFoundException':
            # We can't find the resource that you asked for.
            # Deal with the exception here, and/or rethrow at your discretion.
            raise e
    else:
        # Decrypts secret using the associated KMS CMK.
        # Depending on whether the secret is a string or binary, one of these fields will be populated.
        if 'SecretString' in get_secret_value_response:
            return json.loads(get_secret_value_response['SecretString'])
        else:
            return json.loads(base64.b64decode(get_secret_value_response['SecretBinary']))


def get_env_variable(var_name, default=None):
    """Get the environment variable or raise exception."""
    try:
        return os.environ[var_name]
    except KeyError:
        if default is not None:
            return default
        else:
            error_msg = 'The environment variable {} was missing, abort...'\
                        .format(var_name)
            raise EnvironmentError(error_msg)