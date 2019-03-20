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


MYSQL_USER = get_env_variable('MYSQL_USER')
MYSQL_PASSWORD = get_env_variable('MYSQL_PASSWORD')
MYSQL_HOST = get_env_variable('MYSQL_HOST')
MYSQL_PORT = get_env_variable('MYSQL_PORT')
MYSQL_DB = get_env_variable('MYSQL_DB')

# The SQLAlchemy connection string.
SQLALCHEMY_DATABASE_URI = 'mysql://%s:%s@%s:%s/%s' % (MYSQL_USER,
                                                           MYSQL_PASSWORD,
                                                           MYSQL_HOST,
                                                           MYSQL_PORT,
                                                           MYSQL_DB)

REDIS_HOST = get_env_variable('REDIS_HOST')
REDIS_PORT = get_env_variable('REDIS_PORT')


class CeleryConfig(object):
    BROKER_URL = 'redis://%s:%s/0' % (REDIS_HOST, REDIS_PORT)
    CELERY_IMPORTS = ('superset.sql_lab', )
    CELERY_RESULT_BACKEND = 'redis://%s:%s/1' % (REDIS_HOST, REDIS_PORT)
    CELERY_ANNOTATIONS = {'tasks.add': {'rate_limit': '10/s'}}
    CELERY_TASK_PROTOCOL = 1


CELERY_CONFIG = CeleryConfig

from werkzeug.contrib.cache import RedisCache
RESULTS_BACKEND = RedisCache(
    host='localhost', port=6379, key_prefix='superset_results')