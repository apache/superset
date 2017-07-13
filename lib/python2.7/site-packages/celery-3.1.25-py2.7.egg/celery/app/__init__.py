# -*- coding: utf-8 -*-
"""
    celery.app
    ~~~~~~~~~~

    Celery Application.

"""
from __future__ import absolute_import

import os

from celery.local import Proxy
from celery import _state
from celery._state import (
    get_current_app as current_app,
    get_current_task as current_task,
    connect_on_app_finalize, set_default_app, _get_active_apps, _task_stack,
)
from celery.utils import gen_task_name

from .base import Celery, AppPickler

__all__ = ['Celery', 'AppPickler', 'default_app', 'app_or_default',
           'bugreport', 'enable_trace', 'disable_trace', 'shared_task',
           'set_default_app', 'current_app', 'current_task',
           'push_current_task', 'pop_current_task']

#: Proxy always returning the app set as default.
default_app = Proxy(lambda: _state.default_app)

#: Function returning the app provided or the default app if none.
#:
#: The environment variable :envvar:`CELERY_TRACE_APP` is used to
#: trace app leaks.  When enabled an exception is raised if there
#: is no active app.
app_or_default = None

#: The 'default' loader is the default loader used by old applications.
#: This is deprecated and should no longer be used as it's set too early
#: to be affected by --loader argument.
default_loader = os.environ.get('CELERY_LOADER') or 'default'  # XXX


#: Function used to push a task to the thread local stack
#: keeping track of the currently executing task.
#: You must remember to pop the task after.
push_current_task = _task_stack.push

#: Function used to pop a task from the thread local stack
#: keeping track of the currently executing task.
pop_current_task = _task_stack.pop


def bugreport(app=None):
    return (app or current_app()).bugreport()


def _app_or_default(app=None):
    if app is None:
        return _state.get_current_app()
    return app


def _app_or_default_trace(app=None):  # pragma: no cover
    from traceback import print_stack
    from billiard import current_process
    if app is None:
        if getattr(_state._tls, 'current_app', None):
            print('-- RETURNING TO CURRENT APP --')  # noqa+
            print_stack()
            return _state._tls.current_app
        if current_process()._name == 'MainProcess':
            raise Exception('DEFAULT APP')
        print('-- RETURNING TO DEFAULT APP --')      # noqa+
        print_stack()
        return _state.default_app
    return app


def enable_trace():
    global app_or_default
    app_or_default = _app_or_default_trace


def disable_trace():
    global app_or_default
    app_or_default = _app_or_default

if os.environ.get('CELERY_TRACE_APP'):  # pragma: no cover
    enable_trace()
else:
    disable_trace()

App = Celery  # XXX Compat


def shared_task(*args, **kwargs):
    """Create shared tasks (decorator).
    Will return a proxy that always takes the task from the current apps
    task registry.

    This can be used by library authors to create tasks that will work
    for any app environment.

    Example:

        >>> from celery import Celery, shared_task
        >>> @shared_task
        ... def add(x, y):
        ...     return x + y

        >>> app1 = Celery(broker='amqp://')
        >>> add.app is app1
        True

        >>> app2 = Celery(broker='redis://')
        >>> add.app is app2

    """

    def create_shared_task(**options):

        def __inner(fun):
            name = options.get('name')
            # Set as shared task so that unfinalized apps,
            # and future apps will load the task.
            connect_on_app_finalize(
                lambda app: app._task_from_fun(fun, **options)
            )

            # Force all finalized apps to take this task as well.
            for app in _get_active_apps():
                if app.finalized:
                    with app._finalize_mutex:
                        app._task_from_fun(fun, **options)

            # Return a proxy that always gets the task from the current
            # apps task registry.
            def task_by_cons():
                app = current_app()
                return app.tasks[
                    name or gen_task_name(app, fun.__name__, fun.__module__)
                ]
            return Proxy(task_by_cons)
        return __inner

    if len(args) == 1 and callable(args[0]):
        return create_shared_task(**kwargs)(args[0])
    return create_shared_task(*args, **kwargs)
