# -*- coding: utf-8 -*-
"""
    celery.task.sets
    ~~~~~~~~~~~~~~~~

    Old ``group`` implementation, this module should
    not be used anymore use :func:`celery.group` instead.

"""
from __future__ import absolute_import

from celery._state import get_current_worker_task
from celery.app import app_or_default
from celery.canvas import maybe_signature  # noqa
from celery.utils import uuid, warn_deprecated

from celery.canvas import subtask   # noqa

warn_deprecated(
    'celery.task.sets and TaskSet', removal='4.0',
    alternative="""\
Please use "group" instead (see the Canvas section in the userguide)\
""")


class TaskSet(list):
    """A task containing several subtasks, making it possible
    to track how many, or when all of the tasks have been completed.

    :param tasks: A list of :class:`subtask` instances.

    Example::

        >>> from myproj.tasks import refresh_feed

        >>> urls = ('http://cnn.com/rss', 'http://bbc.co.uk/rss')
        >>> s = TaskSet(refresh_feed.s(url) for url in urls)
        >>> taskset_result = s.apply_async()
        >>> list_of_return_values = taskset_result.join()  # *expensive*

    """
    app = None

    def __init__(self, tasks=None, app=None, Publisher=None):
        self.app = app_or_default(app or self.app)
        super(TaskSet, self).__init__(
            maybe_signature(t, app=self.app) for t in tasks or []
        )
        self.Publisher = Publisher or self.app.amqp.TaskProducer
        self.total = len(self)  # XXX compat

    def apply_async(self, connection=None, publisher=None, taskset_id=None):
        """Apply TaskSet."""
        app = self.app

        if app.conf.CELERY_ALWAYS_EAGER:
            return self.apply(taskset_id=taskset_id)

        with app.connection_or_acquire(connection) as conn:
            setid = taskset_id or uuid()
            pub = publisher or self.Publisher(conn)
            results = self._async_results(setid, pub)

            result = app.TaskSetResult(setid, results)
            parent = get_current_worker_task()
            if parent:
                parent.add_trail(result)
            return result

    def _async_results(self, taskset_id, publisher):
        return [task.apply_async(taskset_id=taskset_id, publisher=publisher)
                for task in self]

    def apply(self, taskset_id=None):
        """Applies the TaskSet locally by blocking until all tasks return."""
        setid = taskset_id or uuid()
        return self.app.TaskSetResult(setid, self._sync_results(setid))

    def _sync_results(self, taskset_id):
        return [task.apply(taskset_id=taskset_id) for task in self]

    @property
    def tasks(self):
        return self

    @tasks.setter  # noqa
    def tasks(self, tasks):
        self[:] = tasks
