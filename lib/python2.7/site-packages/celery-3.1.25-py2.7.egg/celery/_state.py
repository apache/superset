# -*- coding: utf-8 -*-
"""
    celery._state
    ~~~~~~~~~~~~~~~

    This is an internal module containing thread state
    like the ``current_app``, and ``current_task``.

    This module shouldn't be used directly.

"""
from __future__ import absolute_import, print_function

import os
import sys
import threading
import weakref

from celery.local import Proxy
from celery.utils.threads import LocalStack

try:
    from weakref import WeakSet as AppSet
except ImportError:  # XXX Py2.6

    class AppSet(object):  # noqa

        def __init__(self):
            self._refs = set()

        def add(self, app):
            self._refs.add(weakref.ref(app))

        def __iter__(self):
            dirty = []
            try:
                for appref in self._refs:
                    app = appref()
                    if app is None:
                        dirty.append(appref)
                    else:
                        yield app
            finally:
                while dirty:
                    self._refs.discard(dirty.pop())

__all__ = ['set_default_app', 'get_current_app', 'get_current_task',
           'get_current_worker_task', 'current_app', 'current_task',
           'connect_on_app_finalize']

#: Global default app used when no current app.
default_app = None

#: List of all app instances (weakrefs), must not be used directly.
_apps = AppSet()

#: global set of functions to call whenever a new app is finalized
#: E.g. Shared tasks, and builtin tasks are created
#: by adding callbacks here.
_on_app_finalizers = set()

_task_join_will_block = False


def connect_on_app_finalize(callback):
    _on_app_finalizers.add(callback)
    return callback


def _announce_app_finalized(app):
    callbacks = set(_on_app_finalizers)
    for callback in callbacks:
        callback(app)


def _set_task_join_will_block(blocks):
    global _task_join_will_block
    _task_join_will_block = blocks


def task_join_will_block():
    return _task_join_will_block


class _TLS(threading.local):
    #: Apps with the :attr:`~celery.app.base.BaseApp.set_as_current` attribute
    #: sets this, so it will always contain the last instantiated app,
    #: and is the default app returned by :func:`app_or_default`.
    current_app = None
_tls = _TLS()

_task_stack = LocalStack()


def set_default_app(app):
    global default_app
    default_app = app


def _get_current_app():
    if default_app is None:
        #: creates the global fallback app instance.
        from celery.app import Celery
        set_default_app(Celery(
            'default',
            loader=os.environ.get('CELERY_LOADER') or 'default',
            fixups=[],
            set_as_current=False, accept_magic_kwargs=True,
        ))
    return _tls.current_app or default_app


def _set_current_app(app):
    _tls.current_app = app


C_STRICT_APP = os.environ.get('C_STRICT_APP')
if os.environ.get('C_STRICT_APP'):  # pragma: no cover
    def get_current_app():
        raise Exception('USES CURRENT APP')
        import traceback
        print('-- USES CURRENT_APP', file=sys.stderr)  # noqa+
        traceback.print_stack(file=sys.stderr)
        return _get_current_app()
else:
    get_current_app = _get_current_app


def get_current_task():
    """Currently executing task."""
    return _task_stack.top


def get_current_worker_task():
    """Currently executing task, that was applied by the worker.

    This is used to differentiate between the actual task
    executed by the worker and any task that was called within
    a task (using ``task.__call__`` or ``task.apply``)

    """
    for task in reversed(_task_stack.stack):
        if not task.request.called_directly:
            return task


#: Proxy to current app.
current_app = Proxy(get_current_app)

#: Proxy to current task.
current_task = Proxy(get_current_task)


def _register_app(app):
    _apps.add(app)


def _get_active_apps():
    return _apps
