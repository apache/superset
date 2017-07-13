# -*- coding: utf-8 -*-
"""
celery.contrib.methods
======================

Task decorator that supports creating tasks out of methods.

Examples
--------

.. code-block:: python

    from celery.contrib.methods import task

    class X(object):

        @task()
        def add(self, x, y):
                return x + y

or with any task decorator:

.. code-block:: python

    from celery.contrib.methods import task_method

    class X(object):

        @app.task(filter=task_method)
        def add(self, x, y):
            return x + y

.. note::

    The task must use the new Task base class (:class:`celery.Task`),
    and the old base class using classmethods (``celery.task.Task``,
    ``celery.task.base.Task``).

    This means that you have to use the task decorator from a Celery app
    instance, and not the old-API:

    .. code-block:: python


        from celery import task       # BAD
        from celery.task import task  # ALSO BAD

        # GOOD:
        app = Celery(...)

        @app.task(filter=task_method)
        def foo(self): pass

        # ALSO GOOD:
        from celery import current_app

        @current_app.task(filter=task_method)
        def foo(self): pass

        # ALSO GOOD:
        from celery import shared_task

        @shared_task(filter=task_method)
        def foo(self): pass

Caveats
-------

- Automatic naming won't be able to know what the class name is.

    The name will still be module_name + task_name,
    so two methods with the same name in the same module will collide
    so that only one task can run:

    .. code-block:: python

        class A(object):

            @task()
            def add(self, x, y):
                return x + y

        class B(object):

            @task()
            def add(self, x, y):
                return x + y

    would have to be written as:

    .. code-block:: python

        class A(object):
            @task(name='A.add')
            def add(self, x, y):
                return x + y

        class B(object):
            @task(name='B.add')
            def add(self, x, y):
                return x + y

"""

from __future__ import absolute_import

from celery import current_app

__all__ = ['task_method', 'task']


class task_method(object):

    def __init__(self, task, *args, **kwargs):
        self.task = task

    def __get__(self, obj, type=None):
        if obj is None:
            return self.task
        task = self.task.__class__()
        task.__self__ = obj
        return task


def task(*args, **kwargs):
    return current_app.task(*args, **dict(kwargs, filter=task_method))
