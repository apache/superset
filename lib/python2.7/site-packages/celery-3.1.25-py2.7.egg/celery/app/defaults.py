# -*- coding: utf-8 -*-
"""
    celery.app.defaults
    ~~~~~~~~~~~~~~~~~~~

    Configuration introspection and defaults.

"""
from __future__ import absolute_import

import sys

from collections import deque, namedtuple
from datetime import timedelta

from celery.five import items
from celery.utils import strtobool
from celery.utils.functional import memoize

__all__ = ['Option', 'NAMESPACES', 'flatten', 'find']

is_jython = sys.platform.startswith('java')
is_pypy = hasattr(sys, 'pypy_version_info')

DEFAULT_POOL = 'prefork'
if is_jython:
    DEFAULT_POOL = 'threads'
elif is_pypy:
    if sys.pypy_version_info[0:3] < (1, 5, 0):
        DEFAULT_POOL = 'solo'
    else:
        DEFAULT_POOL = 'prefork'

DEFAULT_ACCEPT_CONTENT = ['json', 'pickle', 'msgpack', 'yaml']
DEFAULT_PROCESS_LOG_FMT = """
    [%(asctime)s: %(levelname)s/%(processName)s] %(message)s
""".strip()
DEFAULT_LOG_FMT = '[%(asctime)s: %(levelname)s] %(message)s'
DEFAULT_TASK_LOG_FMT = """[%(asctime)s: %(levelname)s/%(processName)s] \
%(task_name)s[%(task_id)s]: %(message)s"""

_BROKER_OLD = {'deprecate_by': '2.5', 'remove_by': '4.0',
               'alt': 'BROKER_URL setting'}
_REDIS_OLD = {'deprecate_by': '2.5', 'remove_by': '4.0',
              'alt': 'URL form of CELERY_RESULT_BACKEND'}

searchresult = namedtuple('searchresult', ('namespace', 'key', 'type'))


# logging: processName first introduced in Py 2.6.2 (Issue #1644).
if sys.version_info < (2, 6, 2):
    DEFAULT_PROCESS_LOG_FMT = DEFAULT_LOG_FMT


class Option(object):
    alt = None
    deprecate_by = None
    remove_by = None
    typemap = dict(string=str, int=int, float=float, any=lambda v: v,
                   bool=strtobool, dict=dict, tuple=tuple)

    def __init__(self, default=None, *args, **kwargs):
        self.default = default
        self.type = kwargs.get('type') or 'string'
        for attr, value in items(kwargs):
            setattr(self, attr, value)

    def to_python(self, value):
        return self.typemap[self.type](value)

    def __repr__(self):
        return '<Option: type->{0} default->{1!r}>'.format(self.type,
                                                           self.default)

NAMESPACES = {
    'BROKER': {
        'URL': Option(None, type='string'),
        'CONNECTION_TIMEOUT': Option(4, type='float'),
        'CONNECTION_RETRY': Option(True, type='bool'),
        'CONNECTION_MAX_RETRIES': Option(100, type='int'),
        'FAILOVER_STRATEGY': Option(None, type='string'),
        'HEARTBEAT': Option(None, type='int'),
        'HEARTBEAT_CHECKRATE': Option(3.0, type='int'),
        'LOGIN_METHOD': Option(None, type='string'),
        'POOL_LIMIT': Option(10, type='int'),
        'USE_SSL': Option(False, type='bool'),
        'TRANSPORT': Option(type='string'),
        'TRANSPORT_OPTIONS': Option({}, type='dict'),
        'HOST': Option(type='string', **_BROKER_OLD),
        'PORT': Option(type='int', **_BROKER_OLD),
        'USER': Option(type='string', **_BROKER_OLD),
        'PASSWORD': Option(type='string', **_BROKER_OLD),
        'VHOST': Option(type='string', **_BROKER_OLD),
    },
    'CASSANDRA': {
        'COLUMN_FAMILY': Option(type='string'),
        'DETAILED_MODE': Option(False, type='bool'),
        'KEYSPACE': Option(type='string'),
        'READ_CONSISTENCY': Option(type='string'),
        'SERVERS': Option(type='list'),
        'WRITE_CONSISTENCY': Option(type='string'),
    },
    'CELERY': {
        'ACCEPT_CONTENT': Option(DEFAULT_ACCEPT_CONTENT, type='list'),
        'ACKS_LATE': Option(False, type='bool'),
        'ALWAYS_EAGER': Option(False, type='bool'),
        'ANNOTATIONS': Option(type='any'),
        'BROADCAST_QUEUE': Option('celeryctl'),
        'BROADCAST_EXCHANGE': Option('celeryctl'),
        'BROADCAST_EXCHANGE_TYPE': Option('fanout'),
        'CACHE_BACKEND': Option(),
        'CACHE_BACKEND_OPTIONS': Option({}, type='dict'),
        'CHORD_PROPAGATES': Option(True, type='bool'),
        'COUCHBASE_BACKEND_SETTINGS': Option(None, type='dict'),
        'CREATE_MISSING_QUEUES': Option(True, type='bool'),
        'DEFAULT_RATE_LIMIT': Option(type='string'),
        'DISABLE_RATE_LIMITS': Option(False, type='bool'),
        'DEFAULT_ROUTING_KEY': Option('celery'),
        'DEFAULT_QUEUE': Option('celery'),
        'DEFAULT_EXCHANGE': Option('celery'),
        'DEFAULT_EXCHANGE_TYPE': Option('direct'),
        'DEFAULT_DELIVERY_MODE': Option(2, type='string'),
        'EAGER_PROPAGATES_EXCEPTIONS': Option(False, type='bool'),
        'ENABLE_UTC': Option(True, type='bool'),
        'ENABLE_REMOTE_CONTROL': Option(True, type='bool'),
        'EVENT_SERIALIZER': Option('json'),
        'EVENT_QUEUE_EXPIRES': Option(None, type='float'),
        'EVENT_QUEUE_TTL': Option(None, type='float'),
        'IMPORTS': Option((), type='tuple'),
        'INCLUDE': Option((), type='tuple'),
        'IGNORE_RESULT': Option(False, type='bool'),
        'MAX_CACHED_RESULTS': Option(100, type='int'),
        'MESSAGE_COMPRESSION': Option(type='string'),
        'MONGODB_BACKEND_SETTINGS': Option(type='dict'),
        'REDIS_HOST': Option(type='string', **_REDIS_OLD),
        'REDIS_PORT': Option(type='int', **_REDIS_OLD),
        'REDIS_DB': Option(type='int', **_REDIS_OLD),
        'REDIS_PASSWORD': Option(type='string', **_REDIS_OLD),
        'REDIS_MAX_CONNECTIONS': Option(type='int'),
        'RESULT_BACKEND': Option(type='string'),
        'RESULT_DB_SHORT_LIVED_SESSIONS': Option(False, type='bool'),
        'RESULT_DB_TABLENAMES': Option(type='dict'),
        'RESULT_DBURI': Option(),
        'RESULT_ENGINE_OPTIONS': Option(type='dict'),
        'RESULT_EXCHANGE': Option('celeryresults'),
        'RESULT_EXCHANGE_TYPE': Option('direct'),
        'RESULT_SERIALIZER': Option('pickle'),
        'RESULT_PERSISTENT': Option(None, type='bool'),
        'ROUTES': Option(type='any'),
        'SEND_EVENTS': Option(False, type='bool'),
        'SEND_TASK_ERROR_EMAILS': Option(False, type='bool'),
        'SEND_TASK_SENT_EVENT': Option(False, type='bool'),
        'STORE_ERRORS_EVEN_IF_IGNORED': Option(False, type='bool'),
        'TASK_PUBLISH_RETRY': Option(True, type='bool'),
        'TASK_PUBLISH_RETRY_POLICY': Option({
            'max_retries': 3,
            'interval_start': 0,
            'interval_max': 1,
            'interval_step': 0.2}, type='dict'),
        'TASK_RESULT_EXPIRES': Option(timedelta(days=1), type='float'),
        'TASK_SERIALIZER': Option('pickle'),
        'TIMEZONE': Option(type='string'),
        'TRACK_STARTED': Option(False, type='bool'),
        'REDIRECT_STDOUTS': Option(True, type='bool'),
        'REDIRECT_STDOUTS_LEVEL': Option('WARNING'),
        'QUEUES': Option(type='dict'),
        'QUEUE_HA_POLICY': Option(None, type='string'),
        'SECURITY_KEY': Option(type='string'),
        'SECURITY_CERTIFICATE': Option(type='string'),
        'SECURITY_CERT_STORE': Option(type='string'),
        'WORKER_DIRECT': Option(False, type='bool'),
    },
    'CELERYD': {
        'AGENT': Option(None, type='string'),
        'AUTOSCALER': Option('celery.worker.autoscale:Autoscaler'),
        'AUTORELOADER': Option('celery.worker.autoreload:Autoreloader'),
        'CONCURRENCY': Option(0, type='int'),
        'TIMER': Option(type='string'),
        'TIMER_PRECISION': Option(1.0, type='float'),
        'FORCE_EXECV': Option(False, type='bool'),
        'HIJACK_ROOT_LOGGER': Option(True, type='bool'),
        'CONSUMER': Option('celery.worker.consumer:Consumer', type='string'),
        'LOG_FORMAT': Option(DEFAULT_PROCESS_LOG_FMT),
        'LOG_COLOR': Option(type='bool'),
        'LOG_LEVEL': Option('WARN', deprecate_by='2.4', remove_by='4.0',
                            alt='--loglevel argument'),
        'LOG_FILE': Option(deprecate_by='2.4', remove_by='4.0',
                           alt='--logfile argument'),
        'MAX_TASKS_PER_CHILD': Option(type='int'),
        'POOL': Option(DEFAULT_POOL),
        'POOL_PUTLOCKS': Option(True, type='bool'),
        'POOL_RESTARTS': Option(False, type='bool'),
        'PREFETCH_MULTIPLIER': Option(4, type='int'),
        'STATE_DB': Option(),
        'TASK_LOG_FORMAT': Option(DEFAULT_TASK_LOG_FMT),
        'TASK_SOFT_TIME_LIMIT': Option(type='float'),
        'TASK_TIME_LIMIT': Option(type='float'),
        'WORKER_LOST_WAIT': Option(10.0, type='float')
    },
    'CELERYBEAT': {
        'SCHEDULE': Option({}, type='dict'),
        'SCHEDULER': Option('celery.beat:PersistentScheduler'),
        'SCHEDULE_FILENAME': Option('celerybeat-schedule'),
        'SYNC_EVERY': Option(0, type='int'),
        'MAX_LOOP_INTERVAL': Option(0, type='float'),
        'LOG_LEVEL': Option('INFO', deprecate_by='2.4', remove_by='4.0',
                            alt='--loglevel argument'),
        'LOG_FILE': Option(deprecate_by='2.4', remove_by='4.0',
                           alt='--logfile argument'),
    },
    'CELERYMON': {
        'LOG_LEVEL': Option('INFO', deprecate_by='2.4', remove_by='4.0',
                            alt='--loglevel argument'),
        'LOG_FILE': Option(deprecate_by='2.4', remove_by='4.0',
                           alt='--logfile argument'),
        'LOG_FORMAT': Option(DEFAULT_LOG_FMT),
    },
    'EMAIL': {
        'HOST': Option('localhost'),
        'PORT': Option(25, type='int'),
        'HOST_USER': Option(),
        'HOST_PASSWORD': Option(),
        'TIMEOUT': Option(2, type='float'),
        'USE_SSL': Option(False, type='bool'),
        'USE_TLS': Option(False, type='bool'),
    },
    'SERVER_EMAIL': Option('celery@localhost'),
    'ADMINS': Option((), type='tuple'),
}


def flatten(d, ns=''):
    stack = deque([(ns, d)])
    while stack:
        name, space = stack.popleft()
        for key, value in items(space):
            if isinstance(value, dict):
                stack.append((name + key + '_', value))
            else:
                yield name + key, value
DEFAULTS = dict((key, value.default) for key, value in flatten(NAMESPACES))


def find_deprecated_settings(source):
    from celery.utils import warn_deprecated
    for name, opt in flatten(NAMESPACES):
        if (opt.deprecate_by or opt.remove_by) and getattr(source, name, None):
            warn_deprecated(description='The {0!r} setting'.format(name),
                            deprecation=opt.deprecate_by,
                            removal=opt.remove_by,
                            alternative='Use the {0.alt} instead'.format(opt))
    return source


@memoize(maxsize=None)
def find(name, namespace='celery'):
    # - Try specified namespace first.
    namespace = namespace.upper()
    try:
        return searchresult(
            namespace, name.upper(), NAMESPACES[namespace][name.upper()],
        )
    except KeyError:
        # - Try all the other namespaces.
        for ns, keys in items(NAMESPACES):
            if ns.upper() == name.upper():
                return searchresult(None, ns, keys)
            elif isinstance(keys, dict):
                try:
                    return searchresult(ns, name.upper(), keys[name.upper()])
                except KeyError:
                    pass
    # - See if name is a qualname last.
    return searchresult(None, name.upper(), DEFAULTS[name.upper()])
