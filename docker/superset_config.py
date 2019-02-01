# -*- coding: utf-8 -*-
from __future__ import absolute_import
from __future__ import division
from __future__ import print_function
from __future__ import unicode_literals

import os
import yaml

from flask_appbuilder.security.manager import AUTH_DB,AUTH_LDAP,AUTH_OID,AUTH_OAUTH

def boolify(str):
    parsed = yaml.load(str)
    return parsed

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

# LDAP configuration
AUTH_TYPE = eval(get_env_variable('AUTH_TYPE'))

if AUTH_TYPE == AUTH_LDAP:
    AUTH_USER_REGISTRATION = boolify(get_env_variable('AUTH_USER_REGISTRATION'))
    AUTH_USER_REGISTRATION_ROLE = get_env_variable('AUTH_USER_REGISTRATION_ROLE')
    AUTH_LDAP_USE_TLS = boolify(get_env_variable('AUTH_LDAP_USE_TLS'))
    AUTH_LDAP_SERVER = get_env_variable('AUTH_LDAP_SERVER')
    AUTH_LDAP_BIND_USER = get_env_variable('AUTH_LDAP_BIND_USER')
    AUTH_LDAP_BIND_PASSWORD = get_env_variable('AUTH_LDAP_BIND_PASSWORD')
    AUTH_LDAP_SEARCH = get_env_variable('AUTH_LDAP_SEARCH')
    AUTH_LDAP_UID_FIELD = get_env_variable('AUTH_LDAP_UID_FIELD')
    AUTH_LDAP_TLS_DEMAND = boolify(get_env_variable('AUTH_LDAP_TLS_DEMAND'))
    AUTH_LDAP_FIRSTNAME_FIELD = get_env_variable('AUTH_LDAP_FIRSTNAME_FIELD')
    AUTH_LDAP_LASTNAME_FIELD = get_env_variable('AUTH_LDAP_LASTNAME_FIELD')
    AUTH_LDAP_EMAIL_FIELD = get_env_variable('AUTH_LDAP_EMAIL_FIELD')
    AUTH_LDAP_APPEND_DOMAIN = get_env_variable('AUTH_LDAP_APPEND_DOMAIN')
    AUTH_LDAP_USERNAME_FORMAT = get_env_variable('AUTH_LDAP_USERNAME_FORMAT')
    AUTH_ROLE_ADMIN = get_env_variable('AUTH_ROLE_ADMIN')
    AUTH_ROLE_PUBLIC = get_env_variable('AUTH_ROLE_PUBLIC')
    AUTH_LDAP_ALLOW_SELF_SIGNED = boolify(get_env_variable('AUTH_LDAP_ALLOW_SELF_SIGNED'))
    AUTH_LDAP_TLS_CACERTDIR = get_env_variable('AUTH_LDAP_TLS_CACERTDIR')
    AUTH_LDAP_TLS_CACERTFILE = get_env_variable('AUTH_LDAP_TLS_CACERTFILE')
    AUTH_LDAP_TLS_CERTFILE = get_env_variable('AUTH_LDAP_TLS_CERTFILE')
    AUTH_LDAP_TLS_KEYFILE = get_env_variable('AUTH_LDAP_TLS_KEYFILE')
    AUTH_LDAP_SEARCH_FILTER = get_env_variable('AUTH_LDAP_SEARCH_FILTER')


POSTGRES_USER = get_env_variable('POSTGRES_USER')
POSTGRES_PASSWORD = get_env_variable('POSTGRES_PASSWORD')
POSTGRES_HOST = get_env_variable('POSTGRES_HOST')
POSTGRES_PORT = get_env_variable('POSTGRES_PORT')
POSTGRES_DB = get_env_variable('POSTGRES_DB')

# Timeout duration for SQL Lab synchronous queries
SQLLAB_TIMEOUT = 3600

# The SQLAlchemy connection string.
SQLALCHEMY_DATABASE_URI = 'postgresql://%s:%s@%s:%s/%s' % (POSTGRES_USER,
                                                           POSTGRES_PASSWORD,
                                                           POSTGRES_HOST,
                                                           POSTGRES_PORT,
                                                           POSTGRES_DB)

REDIS_HOST = get_env_variable('REDIS_HOST')
REDIS_PORT = get_env_variable('REDIS_PORT')


class CeleryConfig(object):
    BROKER_URL = 'redis://%s:%s/0' % (REDIS_HOST, REDIS_PORT)
    CELERY_IMPORTS = ('superset.sql_lab', )
    CELERY_RESULT_BACKEND = 'redis://%s:%s/1' % (REDIS_HOST, REDIS_PORT)
    CELERY_ANNOTATIONS = {'tasks.add': {'rate_limit': '10/s'}}
    CELERY_TASK_PROTOCOL = 1


CELERY_CONFIG = CeleryConfig