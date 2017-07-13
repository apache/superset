# -*- coding: utf-8 -*-
"""
    celery.signals
    ~~~~~~~~~~~~~~

    This module defines the signals (Observer pattern) sent by
    both workers and clients.

    Functions can be connected to these signals, and connected
    functions are called whenever a signal is called.

    See :ref:`signals` for more information.

"""
from __future__ import absolute_import
from .utils.dispatch import Signal

__all__ = ['before_task_publish', 'after_task_publish',
           'task_prerun', 'task_postrun', 'task_success',
           'task_retry', 'task_failure', 'task_revoked', 'celeryd_init',
           'celeryd_after_setup', 'worker_init', 'worker_process_init',
           'worker_ready', 'worker_shutdown', 'setup_logging',
           'after_setup_logger', 'after_setup_task_logger',
           'beat_init', 'beat_embedded_init', 'eventlet_pool_started',
           'eventlet_pool_preshutdown', 'eventlet_pool_postshutdown',
           'eventlet_pool_apply']

before_task_publish = Signal(providing_args=[
    'body', 'exchange', 'routing_key', 'headers', 'properties',
    'declare', 'retry_policy',
])
after_task_publish = Signal(providing_args=[
    'body', 'exchange', 'routing_key',
])
#: Deprecated, use after_task_publish instead.
task_sent = Signal(providing_args=[
    'task_id', 'task', 'args', 'kwargs', 'eta', 'taskset',
])
task_prerun = Signal(providing_args=['task_id', 'task', 'args', 'kwargs'])
task_postrun = Signal(providing_args=[
    'task_id', 'task', 'args', 'kwargs', 'retval',
])
task_success = Signal(providing_args=['result'])
task_retry = Signal(providing_args=[
    'request', 'reason', 'einfo',
])
task_failure = Signal(providing_args=[
    'task_id', 'exception', 'args', 'kwargs', 'traceback', 'einfo',
])
task_revoked = Signal(providing_args=[
    'request', 'terminated', 'signum', 'expired',
])
celeryd_init = Signal(providing_args=['instance', 'conf', 'options'])
celeryd_after_setup = Signal(providing_args=['instance', 'conf'])
import_modules = Signal(providing_args=[])
worker_init = Signal(providing_args=[])
worker_process_init = Signal(providing_args=[])
worker_process_shutdown = Signal(providing_args=[])
worker_ready = Signal(providing_args=[])
worker_shutdown = Signal(providing_args=[])
setup_logging = Signal(providing_args=[
    'loglevel', 'logfile', 'format', 'colorize',
])
after_setup_logger = Signal(providing_args=[
    'logger', 'loglevel', 'logfile', 'format', 'colorize',
])
after_setup_task_logger = Signal(providing_args=[
    'logger', 'loglevel', 'logfile', 'format', 'colorize',
])
beat_init = Signal(providing_args=[])
beat_embedded_init = Signal(providing_args=[])
eventlet_pool_started = Signal(providing_args=[])
eventlet_pool_preshutdown = Signal(providing_args=[])
eventlet_pool_postshutdown = Signal(providing_args=[])
eventlet_pool_apply = Signal(providing_args=['target', 'args', 'kwargs'])
user_preload_options = Signal(providing_args=['app', 'options'])
