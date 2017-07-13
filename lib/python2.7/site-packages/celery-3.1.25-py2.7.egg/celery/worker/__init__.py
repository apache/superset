# -*- coding: utf-8 -*-
"""
    celery.worker
    ~~~~~~~~~~~~~

    :class:`WorkController` can be used to instantiate in-process workers.

    The worker consists of several components, all managed by bootsteps
    (mod:`celery.bootsteps`).

"""
from __future__ import absolute_import

import os
import sys
import traceback
try:
    import resource
except ImportError:  # pragma: no cover
    resource = None  # noqa

from billiard import cpu_count
from billiard.util import Finalize
from kombu.syn import detect_environment

from celery import bootsteps
from celery.bootsteps import RUN, TERMINATE
from celery import concurrency as _concurrency
from celery import platforms
from celery import signals
from celery.exceptions import (
    ImproperlyConfigured, WorkerTerminate, TaskRevokedError,
)
from celery.five import string_t, values
from celery.utils import default_nodename, worker_direct
from celery.utils.imports import reload_from_cwd
from celery.utils.log import mlevel, worker_logger as logger
from celery.utils.threads import default_socket_timeout

from . import state

__all__ = ['WorkController', 'default_nodename']

#: Default socket timeout at shutdown.
SHUTDOWN_SOCKET_TIMEOUT = 5.0

SELECT_UNKNOWN_QUEUE = """\
Trying to select queue subset of {0!r}, but queue {1} is not
defined in the CELERY_QUEUES setting.

If you want to automatically declare unknown queues you can
enable the CELERY_CREATE_MISSING_QUEUES setting.
"""

DESELECT_UNKNOWN_QUEUE = """\
Trying to deselect queue subset of {0!r}, but queue {1} is not
defined in the CELERY_QUEUES setting.
"""


def str_to_list(s):
    if isinstance(s, string_t):
        return s.split(',')
    return s


class WorkController(object):
    """Unmanaged worker instance."""
    app = None

    pidlock = None
    blueprint = None
    pool = None
    semaphore = None

    class Blueprint(bootsteps.Blueprint):
        """Worker bootstep blueprint."""
        name = 'Worker'
        default_steps = set([
            'celery.worker.components:Hub',
            'celery.worker.components:Queues',
            'celery.worker.components:Pool',
            'celery.worker.components:Beat',
            'celery.worker.components:Timer',
            'celery.worker.components:StateDB',
            'celery.worker.components:Consumer',
            'celery.worker.autoscale:WorkerComponent',
            'celery.worker.autoreload:WorkerComponent',

        ])

    def __init__(self, app=None, hostname=None, **kwargs):
        self.app = app or self.app
        self.hostname = default_nodename(hostname)
        self.app.loader.init_worker()
        self.on_before_init(**kwargs)
        self.setup_defaults(**kwargs)
        self.on_after_init(**kwargs)

        self.setup_instance(**self.prepare_args(**kwargs))
        self._finalize = [
            Finalize(self, self._send_worker_shutdown, exitpriority=10),
        ]

    def setup_instance(self, queues=None, ready_callback=None, pidfile=None,
                       include=None, use_eventloop=None, exclude_queues=None,
                       **kwargs):
        self.pidfile = pidfile
        self.setup_queues(queues, exclude_queues)
        self.setup_includes(str_to_list(include))

        # Set default concurrency
        if not self.concurrency:
            try:
                self.concurrency = cpu_count()
            except NotImplementedError:
                self.concurrency = 2

        # Options
        self.loglevel = mlevel(self.loglevel)
        self.ready_callback = ready_callback or self.on_consumer_ready

        # this connection is not established, only used for params
        self._conninfo = self.app.connection()
        self.use_eventloop = (
            self.should_use_eventloop() if use_eventloop is None
            else use_eventloop
        )
        self.options = kwargs

        signals.worker_init.send(sender=self)

        # Initialize bootsteps
        self.pool_cls = _concurrency.get_implementation(self.pool_cls)
        self.steps = []
        self.on_init_blueprint()
        self.blueprint = self.Blueprint(app=self.app,
                                        on_start=self.on_start,
                                        on_close=self.on_close,
                                        on_stopped=self.on_stopped)
        self.blueprint.apply(self, **kwargs)

    def on_init_blueprint(self):
        pass

    def on_before_init(self, **kwargs):
        pass

    def on_after_init(self, **kwargs):
        pass

    def on_start(self):
        if self.pidfile:
            self.pidlock = platforms.create_pidlock(self.pidfile)

    def on_consumer_ready(self, consumer):
        pass

    def on_close(self):
        self.app.loader.shutdown_worker()

    def on_stopped(self):
        self.timer.stop()
        self.consumer.shutdown()

        if self.pidlock:
            self.pidlock.release()

    def setup_queues(self, include, exclude=None):
        include = str_to_list(include)
        exclude = str_to_list(exclude)
        try:
            self.app.amqp.queues.select(include)
        except KeyError as exc:
            raise ImproperlyConfigured(
                SELECT_UNKNOWN_QUEUE.format(include, exc))
        try:
            self.app.amqp.queues.deselect(exclude)
        except KeyError as exc:
            raise ImproperlyConfigured(
                DESELECT_UNKNOWN_QUEUE.format(exclude, exc))
        if self.app.conf.CELERY_WORKER_DIRECT:
            self.app.amqp.queues.select_add(worker_direct(self.hostname))

    def setup_includes(self, includes):
        # Update celery_include to have all known task modules, so that we
        # ensure all task modules are imported in case an execv happens.
        prev = tuple(self.app.conf.CELERY_INCLUDE)
        if includes:
            prev += tuple(includes)
            [self.app.loader.import_task_module(m) for m in includes]
        self.include = includes
        task_modules = set(task.__class__.__module__
                           for task in values(self.app.tasks))
        self.app.conf.CELERY_INCLUDE = tuple(set(prev) | task_modules)

    def prepare_args(self, **kwargs):
        return kwargs

    def _send_worker_shutdown(self):
        signals.worker_shutdown.send(sender=self)

    def start(self):
        """Starts the workers main loop."""
        try:
            self.blueprint.start(self)
        except WorkerTerminate:
            self.terminate()
        except Exception as exc:
            logger.error('Unrecoverable error: %r', exc, exc_info=True)
            self.stop()
        except (KeyboardInterrupt, SystemExit):
            self.stop()

    def register_with_event_loop(self, hub):
        self.blueprint.send_all(
            self, 'register_with_event_loop', args=(hub, ),
            description='hub.register',
        )

    def _process_task_sem(self, req):
        return self._quick_acquire(self._process_task, req)

    def _process_task(self, req):
        """Process task by sending it to the pool of workers."""
        try:
            req.execute_using_pool(self.pool)
        except TaskRevokedError:
            try:
                self._quick_release()   # Issue 877
            except AttributeError:
                pass
        except Exception as exc:
            logger.critical('Internal error: %r\n%s',
                            exc, traceback.format_exc(), exc_info=True)

    def signal_consumer_close(self):
        try:
            self.consumer.close()
        except AttributeError:
            pass

    def should_use_eventloop(self):
        return (detect_environment() == 'default' and
                self._conninfo.is_evented and not self.app.IS_WINDOWS)

    def stop(self, in_sighandler=False):
        """Graceful shutdown of the worker server."""
        if self.blueprint.state == RUN:
            self.signal_consumer_close()
            if not in_sighandler or self.pool.signal_safe:
                self._shutdown(warm=True)

    def terminate(self, in_sighandler=False):
        """Not so graceful shutdown of the worker server."""
        if self.blueprint.state != TERMINATE:
            self.signal_consumer_close()
            if not in_sighandler or self.pool.signal_safe:
                self._shutdown(warm=False)

    def _shutdown(self, warm=True):
        # if blueprint does not exist it means that we had an
        # error before the bootsteps could be initialized.
        if self.blueprint is not None:
            with default_socket_timeout(SHUTDOWN_SOCKET_TIMEOUT):  # Issue 975
                self.blueprint.stop(self, terminate=not warm)
                self.blueprint.join()

    def reload(self, modules=None, reload=False, reloader=None):
        modules = self.app.loader.task_modules if modules is None else modules
        imp = self.app.loader.import_from_cwd

        for module in set(modules or ()):
            if module not in sys.modules:
                logger.debug('importing module %s', module)
                imp(module)
            elif reload:
                logger.debug('reloading module %s', module)
                reload_from_cwd(sys.modules[module], reloader)

        if self.consumer:
            self.consumer.update_strategies()
            self.consumer.reset_rate_limits()
        try:
            self.pool.restart()
        except NotImplementedError:
            pass

    def info(self):
        return {'total': self.state.total_count,
                'pid': os.getpid(),
                'clock': str(self.app.clock)}

    def rusage(self):
        if resource is None:
            raise NotImplementedError('rusage not supported by this platform')
        s = resource.getrusage(resource.RUSAGE_SELF)
        return {
            'utime': s.ru_utime,
            'stime': s.ru_stime,
            'maxrss': s.ru_maxrss,
            'ixrss': s.ru_ixrss,
            'idrss': s.ru_idrss,
            'isrss': s.ru_isrss,
            'minflt': s.ru_minflt,
            'majflt': s.ru_majflt,
            'nswap': s.ru_nswap,
            'inblock': s.ru_inblock,
            'oublock': s.ru_oublock,
            'msgsnd': s.ru_msgsnd,
            'msgrcv': s.ru_msgrcv,
            'nsignals': s.ru_nsignals,
            'nvcsw': s.ru_nvcsw,
            'nivcsw': s.ru_nivcsw,
        }

    def stats(self):
        info = self.info()
        info.update(self.blueprint.info(self))
        info.update(self.consumer.blueprint.info(self.consumer))
        try:
            info['rusage'] = self.rusage()
        except NotImplementedError:
            info['rusage'] = 'N/A'
        return info

    def __repr__(self):
        return '<Worker: {self.hostname} ({state})>'.format(
            self=self,
            state=(self.blueprint.human_state()
                   if self.blueprint else 'initializing'),  # Issue #2514
        )

    def __str__(self):
        return self.hostname

    @property
    def state(self):
        return state

    def setup_defaults(self, concurrency=None, loglevel=None, logfile=None,
                       send_events=None, pool_cls=None, consumer_cls=None,
                       timer_cls=None, timer_precision=None,
                       autoscaler_cls=None, autoreloader_cls=None,
                       pool_putlocks=None, pool_restarts=None,
                       force_execv=None, state_db=None,
                       schedule_filename=None, scheduler_cls=None,
                       task_time_limit=None, task_soft_time_limit=None,
                       max_tasks_per_child=None, prefetch_multiplier=None,
                       disable_rate_limits=None, worker_lost_wait=None, **_kw):
        self.concurrency = self._getopt('concurrency', concurrency)
        self.loglevel = self._getopt('log_level', loglevel)
        self.logfile = self._getopt('log_file', logfile)
        self.send_events = self._getopt('send_events', send_events)
        self.pool_cls = self._getopt('pool', pool_cls)
        self.consumer_cls = self._getopt('consumer', consumer_cls)
        self.timer_cls = self._getopt('timer', timer_cls)
        self.timer_precision = self._getopt('timer_precision', timer_precision)
        self.autoscaler_cls = self._getopt('autoscaler', autoscaler_cls)
        self.autoreloader_cls = self._getopt('autoreloader', autoreloader_cls)
        self.pool_putlocks = self._getopt('pool_putlocks', pool_putlocks)
        self.pool_restarts = self._getopt('pool_restarts', pool_restarts)
        self.force_execv = self._getopt('force_execv', force_execv)
        self.state_db = self._getopt('state_db', state_db)
        self.schedule_filename = self._getopt(
            'schedule_filename', schedule_filename,
        )
        self.scheduler_cls = self._getopt(
            'celerybeat_scheduler', scheduler_cls,
        )
        self.task_time_limit = self._getopt(
            'task_time_limit', task_time_limit,
        )
        self.task_soft_time_limit = self._getopt(
            'task_soft_time_limit', task_soft_time_limit,
        )
        self.max_tasks_per_child = self._getopt(
            'max_tasks_per_child', max_tasks_per_child,
        )
        self.prefetch_multiplier = int(self._getopt(
            'prefetch_multiplier', prefetch_multiplier,
        ))
        self.disable_rate_limits = self._getopt(
            'disable_rate_limits', disable_rate_limits,
        )
        self.worker_lost_wait = self._getopt(
            'worker_lost_wait', worker_lost_wait,
        )

    def _getopt(self, key, value):
        if value is not None:
            return value
        return self.app.conf.find_value_for_key(key, namespace='celeryd')
