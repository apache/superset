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
from contrib.docker import helpers

superset_env = helpers.get_env_variable("SUPERSET_ENV")
is_production = superset_env == "production"


#######
#
# SUPERSET_DB_USER_SECRET env variable will grab credentials from the secrets provider of your choice.
# SECRETS_PROVIDER is necessary to specify which provider to use
# You will probably want to make some modifications
#
#######
try:
    secret_key = helpers.get_env_variable("SUPERSET_DB_USER_SECRET")
    secrets_provider = helpers.get_env_variable("SECRETS_PROVIDER")

    secrets = helpers.get_secret(secrets_provider=secrets_provider, secret_key=secret_key)

    # It is sometimes necessary to use different connection details if for example you are behind a jumphost/bastion
    POSTGRES_HOST = secrets['POSTGRES_HOST'] if is_production else helpers.get_env_variable("POSTGRES_HOST")
    POSTGRES_USER = secrets['POSTGRES_USER']
    POSTGRES_PASSWORD = secrets['POSTGRES_PASSWORD']
    POSTGRES_PORT = int(secrets['POSTGRES_PORT'])
    POSTGRES_DB = secrets['POSTGRES_DB']
except Exception:  # Just being broad as a fallback
    POSTGRES_USER = helpers.get_env_variable('POSTGRES_USER')
    POSTGRES_PASSWORD = helpers.get_env_variable('POSTGRES_PASSWORD')
    POSTGRES_HOST = helpers.get_env_variable('POSTGRES_HOST')
    POSTGRES_PORT = int(helpers.get_env_variable('POSTGRES_PORT'))
    POSTGRES_DB = helpers.get_env_variable('POSTGRES_DB')

# The SQLAlchemy connection string.
SQLALCHEMY_DATABASE_URI = 'postgresql://%s:%s@%s:%s/%s' % (POSTGRES_USER,
                                                           POSTGRES_PASSWORD,
                                                           POSTGRES_HOST,
                                                           POSTGRES_PORT,
                                                           POSTGRES_DB)

#######
#
# Redis Details if you want to utilize Redis
#
#######

# REDIS_HOST = helpers.get_env_variable('REDIS_HOST')
# REDIS_PORT = helpers.get_env_variable('REDIS_PORT')


#######
#
# Uncomment to utilize Celery (which does rely on redis at this point)
#
#######

# class CeleryConfig(object):
#     BROKER_URL = 'redis://%s:%s/0' % (REDIS_HOST, REDIS_PORT)
#     CELERY_IMPORTS = ('superset.sql_lab', )
#     CELERY_RESULT_BACKEND = 'redis://%s:%s/1' % (REDIS_HOST, REDIS_PORT)
#     CELERY_ANNOTATIONS = {'tasks.add': {'rate_limit': '10/s'}}
#     CELERY_TASK_PROTOCOL = 1
# CELERY_CONFIG = CeleryConfig


#######
#
# Allow use behind a load balancer This will often be set but comment out if not needed.
#
#######

ENABLE_PROXY_FIX = True

#######
#
# This is a flask parameter that forces logout after n seconds.
# A browser close will also log the user out.
#
#######

PERMANENT_SESSION_LIFETIME = 60 * 10
