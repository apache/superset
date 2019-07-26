# -*- coding: utf-8 -*-
from __future__ import absolute_import
from __future__ import division
from __future__ import print_function
from __future__ import unicode_literals

import os
import yaml
from datetime import timedelta

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

# handling the case of 'null' and 'simple' cache type
# creating the cache config using util function
# as the kubernetes template variable doesn't support object structure.
def get_cache_config():
    cache_config = {}
    if CACHE_TYPE is not 'null':
        cache_config = {
            'CACHE_TYPE' : CACHE_TYPE, 'CACHE_DEFAULT_TIMEOUT' : int(CACHE_DEFAULT_TIMEOUT)
        }
    else:
        cache_config = {
            'CACHE_TYPE' : CACHE_TYPE
        }

    return cache_config

# Application Root configuration
APPLICATION_PREFIX = get_env_variable('APPLICATION_PREFIX')

# WalkMe feature enabled/disbaled
WALKME_ENABLED = boolify(get_env_variable('WALKME_ENABLED'))

# Help configuration
HELP_ENABLED = boolify(get_env_variable('HELP_ENABLED'))

LOG_LEVEL = boolify(get_env_variable('LOG_LEVEL'))

#stale session timeout
SESSION_LIFETIME_SECONDS = eval(get_env_variable('SESSION_LIFETIME_SECONDS'))
PERMANENT_SESSION_LIFETIME = timedelta(seconds=SESSION_LIFETIME_SECONDS)

# Enable Simple Flask Caching
CACHE_DEFAULT_TIMEOUT = eval(get_env_variable('CACHE_DEFAULT_TIMEOUT'))
CACHE_TYPE = get_env_variable('CACHE_TYPE')
CACHE_CONFIG = get_cache_config()

# Change application name
APP_NAME = get_env_variable('APP_NAME')

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
    AUTH_ADMIN_USER_LIST_STR = get_env_variable('AUTH_ADMIN_USER_LIST').strip()
    if AUTH_ADMIN_USER_LIST_STR:
        AUTH_ADMIN_USER_LIST = AUTH_ADMIN_USER_LIST_STR.split(",")
    else:
        AUTH_ADMIN_USER_LIST = []


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

# KnoxSSO-superset integration constants
IS_KNOX_SSO_ENABLED = boolify(get_env_variable('IS_KNOX_SSO_ENABLED'))
KNOX_SSO_PUBLIC_KEY = get_env_variable('KNOX_SSO_PUBLIC_KEY')  
KNOX_SSO_URL = get_env_variable('KNOX_SSO_URL')
KNOX_SSO_COOKIE_NAME = get_env_variable('KNOX_SSO_COOKIE_NAME')
if not KNOX_SSO_COOKIE_NAME:
    KNOX_SSO_COOKIE_NAME = 'hadoop-jwt'

KNOX_SSO_ORIGINALURL  = get_env_variable('KNOX_SSO_ORIGINALURL')
if not KNOX_SSO_ORIGINALURL:
    KNOX_SSO_ORIGINALURL = 'originalUrl'
