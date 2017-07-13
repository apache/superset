# -*- coding: utf-8 -*-
"""
    celery.task.base
    ~~~~~~~~~~~~~~~~

    The task implementation has been moved to :mod:`celery.app.task`.

    This contains the backward compatible Task class used in the old API,
    and shouldn't be used in new applications.

"""
from __future__ import absolute_import

from kombu import Exchange

from celery import current_app
from celery.app.task import Context, TaskType, Task as BaseTask  # noqa
from celery.five import class_property, reclassmethod
from celery.schedules import maybe_schedule
from celery.utils.log import get_task_logger

__all__ = ['Task', 'PeriodicTask', 'task']

#: list of methods that must be classmethods in the old API.
_COMPAT_CLASSMETHODS = (
    'delay', 'apply_async', 'retry', 'apply', 'subtask_from_request',
    'AsyncResult', 'subtask', '_get_request', '_get_exec_options',
)


class Task(BaseTask):
    """Deprecated Task base class.

    Modern applications should use :class:`celery.Task` instead.

    """
    abstract = True
    __bound__ = False
    __v2_compat__ = True

    # - Deprecated compat. attributes -:

    queue = None
    routing_key = None
    exchange = None
    exchange_type = None
    delivery_mode = None
    mandatory = False  # XXX deprecated
    immediate = False  # XXX deprecated
    priority = None
    type = 'regular'
    disable_error_emails = False
    accept_magic_kwargs = False

    from_config = BaseTask.from_config + (
        ('exchange_type', 'CELERY_DEFAULT_EXCHANGE_TYPE'),
        ('delivery_mode', 'CELERY_DEFAULT_DELIVERY_MODE'),
    )

    # In old Celery the @task decorator didn't exist, so one would create
    # classes instead and use them directly (e.g. MyTask.apply_async()).
    # the use of classmethods was a hack so that it was not necessary
    # to instantiate the class before using it, but it has only
    # given us pain (like all magic).
    for name in _COMPAT_CLASSMETHODS:
        locals()[name] = reclassmethod(getattr(BaseTask, name))

    @class_property
    def request(cls):
        return cls._get_request()

    @class_property
    def backend(cls):
        if cls._backend is None:
            return cls.app.backend
        return cls._backend

    @backend.setter
    def backend(cls, value):  # noqa
        cls._backend = value

    @classmethod
    def get_logger(self, **kwargs):
        return get_task_logger(self.name)

    @classmethod
    def establish_connection(self):
        """Deprecated method used to get a broker connection.

        Should be replaced with :meth:`@Celery.connection`
        instead, or by acquiring connections from the connection pool:

        .. code-block:: python

            # using the connection pool
            with celery.pool.acquire(block=True) as conn:
                ...

            # establish fresh connection
            with celery.connection() as conn:
                ...
        """
        return self._get_app().connection()

    def get_publisher(self, connection=None, exchange=None,
                      exchange_type=None, **options):
        """Deprecated method to get the task publisher (now called producer).

        Should be replaced with :class:`@amqp.TaskProducer`:

        .. code-block:: python

            with celery.connection() as conn:
                with celery.amqp.TaskProducer(conn) as prod:
                    my_task.apply_async(producer=prod)

        """
        exchange = self.exchange if exchange is None else exchange
        if exchange_type is None:
            exchange_type = self.exchange_type
        connection = connection or self.establish_connection()
        return self._get_app().amqp.TaskProducer(
            connection,
            exchange=exchange and Exchange(exchange, exchange_type),
            routing_key=self.routing_key, **options
        )

    @classmethod
    def get_consumer(self, connection=None, queues=None, **kwargs):
        """Deprecated method used to get consumer for the queue
        this task is sent to.

        Should be replaced with :class:`@amqp.TaskConsumer` instead:

        """
        Q = self._get_app().amqp
        connection = connection or self.establish_connection()
        if queues is None:
            queues = Q.queues[self.queue] if self.queue else Q.default_queue
        return Q.TaskConsumer(connection, queues, **kwargs)


class PeriodicTask(Task):
    """A periodic task is a task that adds itself to the
    :setting:`CELERYBEAT_SCHEDULE` setting."""
    abstract = True
    ignore_result = True
    relative = False
    options = None
    compat = True

    def __init__(self):
        if not hasattr(self, 'run_every'):
            raise NotImplementedError(
                'Periodic tasks must have a run_every attribute')
        self.run_every = maybe_schedule(self.run_every, self.relative)
        super(PeriodicTask, self).__init__()

    @classmethod
    def on_bound(cls, app):
        app.conf.CELERYBEAT_SCHEDULE[cls.name] = {
            'task': cls.name,
            'schedule': cls.run_every,
            'args': (),
            'kwargs': {},
            'options': cls.options or {},
            'relative': cls.relative,
        }


def task(*args, **kwargs):
    """Deprecated decorator, please use :func:`celery.task`."""
    return current_app.task(*args, **dict({'accept_magic_kwargs': False,
                                           'base': Task}, **kwargs))


def periodic_task(*args, **options):
    """Deprecated decorator, please use :setting:`CELERYBEAT_SCHEDULE`."""
    return task(**dict({'base': PeriodicTask}, **options))
