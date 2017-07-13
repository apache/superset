# -*- coding: utf-8 -*-
"""
    celery.concurrency.threads
    ~~~~~~~~~~~~~~~~~~~~~~~~~~

    Pool implementation using threads.

"""
from __future__ import absolute_import

from celery.five import UserDict

from .base import apply_target, BasePool

__all__ = ['TaskPool']


class NullDict(UserDict):

    def __setitem__(self, key, value):
        pass


class TaskPool(BasePool):

    def __init__(self, *args, **kwargs):
        try:
            import threadpool
        except ImportError:
            raise ImportError(
                'The threaded pool requires the threadpool module.')
        self.WorkRequest = threadpool.WorkRequest
        self.ThreadPool = threadpool.ThreadPool
        super(TaskPool, self).__init__(*args, **kwargs)

    def on_start(self):
        self._pool = self.ThreadPool(self.limit)
        # threadpool stores all work requests until they are processed
        # we don't need this dict, and it occupies way too much memory.
        self._pool.workRequests = NullDict()
        self._quick_put = self._pool.putRequest
        self._quick_clear = self._pool._results_queue.queue.clear

    def on_stop(self):
        self._pool.dismissWorkers(self.limit, do_join=True)

    def on_apply(self, target, args=None, kwargs=None, callback=None,
                 accept_callback=None, **_):
        req = self.WorkRequest(apply_target, (target, args, kwargs, callback,
                                              accept_callback))
        self._quick_put(req)
        # threadpool also has callback support,
        # but for some reason the callback is not triggered
        # before you've collected the results.
        # Clear the results (if any), so it doesn't grow too large.
        self._quick_clear()
        return req
