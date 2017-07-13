# -*- coding: utf-8 -*-
"""
    celery.concurrency.base
    ~~~~~~~~~~~~~~~~~~~~~~~

    TaskPool interface.

"""
from __future__ import absolute_import

import logging
import os
import sys

from billiard.einfo import ExceptionInfo
from billiard.exceptions import WorkerLostError
from kombu.utils.encoding import safe_repr

from celery.exceptions import WorkerShutdown, WorkerTerminate
from celery.five import monotonic, reraise
from celery.utils import timer2
from celery.utils.text import truncate
from celery.utils.log import get_logger

__all__ = ['BasePool', 'apply_target']

logger = get_logger('celery.pool')


def apply_target(target, args=(), kwargs={}, callback=None,
                 accept_callback=None, pid=None, getpid=os.getpid,
                 propagate=(), monotonic=monotonic, **_):
    if accept_callback:
        accept_callback(pid or getpid(), monotonic())
    try:
        ret = target(*args, **kwargs)
    except propagate:
        raise
    except Exception:
        raise
    except (WorkerShutdown, WorkerTerminate):
        raise
    except BaseException as exc:
        try:
            reraise(WorkerLostError, WorkerLostError(repr(exc)),
                    sys.exc_info()[2])
        except WorkerLostError:
            callback(ExceptionInfo())
    else:
        callback(ret)


class BasePool(object):
    RUN = 0x1
    CLOSE = 0x2
    TERMINATE = 0x3

    Timer = timer2.Timer

    #: set to true if the pool can be shutdown from within
    #: a signal handler.
    signal_safe = True

    #: set to true if pool uses greenlets.
    is_green = False

    _state = None
    _pool = None

    #: only used by multiprocessing pool
    uses_semaphore = False

    task_join_will_block = True

    def __init__(self, limit=None, putlocks=True,
                 forking_enable=True, callbacks_propagate=(), **options):
        self.limit = limit
        self.putlocks = putlocks
        self.options = options
        self.forking_enable = forking_enable
        self.callbacks_propagate = callbacks_propagate
        self._does_debug = logger.isEnabledFor(logging.DEBUG)

    def on_start(self):
        pass

    def did_start_ok(self):
        return True

    def flush(self):
        pass

    def on_stop(self):
        pass

    def register_with_event_loop(self, loop):
        pass

    def on_apply(self, *args, **kwargs):
        pass

    def on_terminate(self):
        pass

    def on_soft_timeout(self, job):
        pass

    def on_hard_timeout(self, job):
        pass

    def maintain_pool(self, *args, **kwargs):
        pass

    def terminate_job(self, pid, signal=None):
        raise NotImplementedError(
            '{0} does not implement kill_job'.format(type(self)))

    def restart(self):
        raise NotImplementedError(
            '{0} does not implement restart'.format(type(self)))

    def stop(self):
        self.on_stop()
        self._state = self.TERMINATE

    def terminate(self):
        self._state = self.TERMINATE
        self.on_terminate()

    def start(self):
        self.on_start()
        self._state = self.RUN

    def close(self):
        self._state = self.CLOSE
        self.on_close()

    def on_close(self):
        pass

    def apply_async(self, target, args=[], kwargs={}, **options):
        """Equivalent of the :func:`apply` built-in function.

        Callbacks should optimally return as soon as possible since
        otherwise the thread which handles the result will get blocked.

        """
        if self._does_debug:
            logger.debug('TaskPool: Apply %s (args:%s kwargs:%s)',
                         target, truncate(safe_repr(args), 1024),
                         truncate(safe_repr(kwargs), 1024))

        return self.on_apply(target, args, kwargs,
                             waitforslot=self.putlocks,
                             callbacks_propagate=self.callbacks_propagate,
                             **options)

    def _get_info(self):
        return {}

    @property
    def info(self):
        return self._get_info()

    @property
    def active(self):
        return self._state == self.RUN

    @property
    def num_processes(self):
        return self.limit
