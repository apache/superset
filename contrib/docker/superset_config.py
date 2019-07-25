# Licensed to the Apache Software Foundation (ASF) under one
# or more contributor license agreements.  See the NOTICE file
# distributed with this work for additional information
# regarding copyright ownership.  The ASF licenses this file
# to you under the Apache License, Version 2.0 (the
# "License"); you may not use this file except in compliance
# with the License.  You may obtain a copy of the License at
#
#   http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing,
# software distributed under the License is distributed on an
# "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
# KIND, either express or implied.  See the License for the
# specific language governing permissions and limitations
# under the License.
import os
import json


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

try:
    # AWS Secrets Manager returns a json string for any key name
    aws_secrets = json.loads(os.environ["POSTGRES_USER"])
    POSTGRES_USER = aws_secrets['POSTGRES_USER']
    POSTGRES_PASSWORD = aws_secrets['POSTGRES_PASSWORD']
    POSTGRES_HOST = aws_secrets['POSTGRES_HOST']
    POSTGRES_PORT = int(aws_secrets['POSTGRES_PORT'])
    POSTGRES_DB = aws_secrets['POSTGRES_DB']
except json.decoder.JSONDecodeError:
    POSTGRES_USER = get_env_variable('POSTGRES_USER')
    POSTGRES_PASSWORD = get_env_variable('POSTGRES_PASSWORD')
    POSTGRES_HOST = get_env_variable('POSTGRES_HOST')
    POSTGRES_PORT = int(get_env_variable('POSTGRES_PORT'))
    POSTGRES_DB = get_env_variable('POSTGRES_DB')

# The SQLAlchemy connection string.
SQLALCHEMY_DATABASE_URI = 'postgresql://%s:%s@%s:%s/%s' % (POSTGRES_USER,
                                                           POSTGRES_PASSWORD,
                                                           POSTGRES_HOST,
                                                           POSTGRES_PORT,
                                                           POSTGRES_DB)

# REDIS_HOST = get_env_variable('REDIS_HOST')
# REDIS_PORT = get_env_variable('REDIS_PORT')


# class CeleryConfig(object):
#     BROKER_URL = 'redis://%s:%s/0' % (REDIS_HOST, REDIS_PORT)
#     CELERY_IMPORTS = ('superset.sql_lab', )
#     CELERY_RESULT_BACKEND = 'redis://%s:%s/1' % (REDIS_HOST, REDIS_PORT)
#     CELERY_ANNOTATIONS = {'tasks.add': {'rate_limit': '10/s'}}
#     CELERY_TASK_PROTOCOL = 1
# CELERY_CONFIG = CeleryConfig



# Allow use behind a load balancer
ENABLE_PROXY_FIX = True

# Though this is badly named, it is a flask parameter that forces logout after n seconds.
# A browser close will also log the user out.
PERMANENT_SESSION_LIFETIME = 60 * 10
