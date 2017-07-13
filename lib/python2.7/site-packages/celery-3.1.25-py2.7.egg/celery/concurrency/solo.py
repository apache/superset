# -*- coding: utf-8 -*-
"""
    celery.concurrency.solo
    ~~~~~~~~~~~~~~~~~~~~~~~

    Single-threaded pool implementation.

"""
from __future__ import absolute_import

import os

from .base import BasePool, apply_target

__all__ = ['TaskPool']


class TaskPool(BasePool):
    """Solo task pool (blocking, inline, fast)."""

    def __init__(self, *args, **kwargs):
        super(TaskPool, self).__init__(*args, **kwargs)
        self.on_apply = apply_target

    def _get_info(self):
        return {'max-concurrency': 1,
                'processes': [os.getpid()],
                'max-tasks-per-child': None,
                'put-guarded-by-semaphore': True,
                'timeouts': ()}
