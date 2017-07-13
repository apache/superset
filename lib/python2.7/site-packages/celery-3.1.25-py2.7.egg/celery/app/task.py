# -*- coding: utf-8 -*-
"""
    celery.app.task
    ~~~~~~~~~~~~~~~

    Task Implementation: Task request context, and the base task class.

"""
from __future__ import absolute_import

import sys

from billiard.einfo import ExceptionInfo

from celery import current_app
from celery import states
from celery._state import _task_stack
from celery.canvas import signature
from celery.exceptions import MaxRetriesExceededError, Reject, Retry
from celery.five import class_property, items, with_metaclass
from celery.local import Proxy
from celery.result import EagerResult
from celery.utils import gen_task_name, fun_takes_kwargs, uuid, maybe_reraise
from celery.utils.functional import mattrgetter, maybe_list
from celery.utils.imports import instantiate
from celery.utils.mail import ErrorMail

from .annotations import resolve_all as resolve_all_annotations
from .registry import _unpickle_task_v2
from .utils import appstr

__all__ = ['Context', 'Task']

#: extracts attributes related to publishing a message from an object.
extract_exec_options = mattrgetter(
    'queue', 'routing_key', 'exchange', 'priority', 'expires',
    'serializer', 'delivery_mode', 'compression', 'time_limit',
    'soft_time_limit', 'immediate', 'mandatory',  # imm+man is deprecated
)

# We take __repr__ very seriously around here ;)
R_BOUND_TASK = '<class {0.__name__} of {app}{flags}>'
R_UNBOUND_TASK = '<unbound {0.__name__}{flags}>'
R_SELF_TASK = '<@task {0.name} bound to other {0.__self__}>'
R_INSTANCE = '<@task: {0.name} of {app}{flags}>'


class _CompatShared(object):

    def __init__(self, name, cons):
        self.name = name
        self.cons = cons

    def __hash__(self):
        return hash(self.name)

    def __repr__(self):
        return '<OldTask: %r>' % (self.name, )

    def __call__(self, app):
        return self.cons(app)


def _strflags(flags, default=''):
    if flags:
        return ' ({0})'.format(', '.join(flags))
    return default


def _reprtask(task, fmt=None, flags=None):
    flags = list(flags) if flags is not None else []
    flags.append('v2 compatible') if task.__v2_compat__ else None
    if not fmt:
        fmt = R_BOUND_TASK if task._app else R_UNBOUND_TASK
    return fmt.format(
        task, flags=_strflags(flags),
        app=appstr(task._app) if task._app else None,
    )


class Context(object):
    # Default context
    logfile = None
    loglevel = None
    hostname = None
    id = None
    args = None
    kwargs = None
    retries = 0
    eta = None
    expires = None
    is_eager = False
    headers = None
    delivery_info = None
    reply_to = None
    correlation_id = None
    taskset = None   # compat alias to group
    group = None
    chord = None
    utc = None
    called_directly = True
    callbacks = None
    errbacks = None
    timelimit = None
    _children = None   # see property
    _protected = 0

    def __init__(self, *args, **kwargs):
        self.update(*args, **kwargs)

    def update(self, *args, **kwargs):
        return self.__dict__.update(*args, **kwargs)

    def clear(self):
        return self.__dict__.clear()

    def get(self, key, default=None):
        return getattr(self, key, default)

    def __repr__(self):
        return '<Context: {0!r}>'.format(vars(self))

    @property
    def children(self):
        # children must be an empy list for every thread
        if self._children is None:
            self._children = []
        return self._children


class TaskType(type):
    """Meta class for tasks.

    Automatically registers the task in the task registry (except
    if the :attr:`Task.abstract`` attribute is set).

    If no :attr:`Task.name` attribute is provided, then the name is generated
    from the module and class name.

    """
    _creation_count = {}  # used by old non-abstract task classes

    def __new__(cls, name, bases, attrs):
        new = super(TaskType, cls).__new__
        task_module = attrs.get('__module__') or '__main__'

        # - Abstract class: abstract attribute should not be inherited.
        abstract = attrs.pop('abstract', None)
        if abstract or not attrs.get('autoregister', True):
            return new(cls, name, bases, attrs)

        # The 'app' attribute is now a property, with the real app located
        # in the '_app' attribute.  Previously this was a regular attribute,
        # so we should support classes defining it.
        app = attrs.pop('_app', None) or attrs.pop('app', None)

        # Attempt to inherit app from one the bases
        if not isinstance(app, Proxy) and app is None:
            for base in bases:
                if getattr(base, '_app', None):
                    app = base._app
                    break
            else:
                app = current_app._get_current_object()
        attrs['_app'] = app

        # - Automatically generate missing/empty name.
        task_name = attrs.get('name')
        if not task_name:
            attrs['name'] = task_name = gen_task_name(app, name, task_module)

        if not attrs.get('_decorated'):
            # non decorated tasks must also be shared in case
            # an app is created multiple times due to modules
            # imported under multiple names.
            # Hairy stuff,  here to be compatible with 2.x.
            # People should not use non-abstract task classes anymore,
            # use the task decorator.
            from celery._state import connect_on_app_finalize
            unique_name = '.'.join([task_module, name])
            if unique_name not in cls._creation_count:
                # the creation count is used as a safety
                # so that the same task is not added recursively
                # to the set of constructors.
                cls._creation_count[unique_name] = 1
                connect_on_app_finalize(_CompatShared(
                    unique_name,
                    lambda app: TaskType.__new__(cls, name, bases,
                                                 dict(attrs, _app=app)),
                ))

        # - Create and register class.
        # Because of the way import happens (recursively)
        # we may or may not be the first time the task tries to register
        # with the framework.  There should only be one class for each task
        # name, so we always return the registered version.
        tasks = app._tasks
        if task_name not in tasks:
            tasks.register(new(cls, name, bases, attrs))
        instance = tasks[task_name]
        instance.bind(app)
        return instance.__class__

    def __repr__(cls):
        return _reprtask(cls)


@with_metaclass(TaskType)
class Task(object):
    """Task base class.

    When called tasks apply the :meth:`run` method.  This method must
    be defined by all tasks (that is unless the :meth:`__call__` method
    is overridden).

    """
    __trace__ = None
    __v2_compat__ = False  # set by old base in celery.task.base

    ErrorMail = ErrorMail
    MaxRetriesExceededError = MaxRetriesExceededError

    #: Execution strategy used, or the qualified name of one.
    Strategy = 'celery.worker.strategy:default'

    #: This is the instance bound to if the task is a method of a class.
    __self__ = None

    #: The application instance associated with this task class.
    _app = None

    #: Name of the task.
    name = None

    #: If :const:`True` the task is an abstract base class.
    abstract = True

    #: If disabled the worker will not forward magic keyword arguments.
    #: Deprecated and scheduled for removal in v4.0.
    accept_magic_kwargs = False

    #: Maximum number of retries before giving up.  If set to :const:`None`,
    #: it will **never** stop retrying.
    max_retries = 3

    #: Default time in seconds before a retry of the task should be
    #: executed.  3 minutes by default.
    default_retry_delay = 3 * 60

    #: Rate limit for this task type.  Examples: :const:`None` (no rate
    #: limit), `'100/s'` (hundred tasks a second), `'100/m'` (hundred tasks
    #: a minute),`'100/h'` (hundred tasks an hour)
    rate_limit = None

    #: If enabled the worker will not store task state and return values
    #: for this task.  Defaults to the :setting:`CELERY_IGNORE_RESULT`
    #: setting.
    ignore_result = None

    #: If enabled the request will keep track of subtasks started by
    #: this task, and this information will be sent with the result
    #: (``result.children``).
    trail = True

    #: If enabled the worker will send monitoring events related to
    #: this task (but only if the worker is configured to send
    #: task related events).
    #: Note that this has no effect on the task-failure event case
    #: where a task is not registered (as it will have no task class
    #: to check this flag).
    send_events = True

    #: When enabled errors will be stored even if the task is otherwise
    #: configured to ignore results.
    store_errors_even_if_ignored = None

    #: If enabled an email will be sent to :setting:`ADMINS` whenever a task
    #: of this type fails.
    send_error_emails = None

    #: The name of a serializer that are registered with
    #: :mod:`kombu.serialization.registry`.  Default is `'pickle'`.
    serializer = None

    #: Hard time limit.
    #: Defaults to the :setting:`CELERYD_TASK_TIME_LIMIT` setting.
    time_limit = None

    #: Soft time limit.
    #: Defaults to the :setting:`CELERYD_TASK_SOFT_TIME_LIMIT` setting.
    soft_time_limit = None

    #: The result store backend used for this task.
    backend = None

    #: If disabled this task won't be registered automatically.
    autoregister = True

    #: If enabled the task will report its status as 'started' when the task
    #: is executed by a worker.  Disabled by default as the normal behaviour
    #: is to not report that level of granularity.  Tasks are either pending,
    #: finished, or waiting to be retried.
    #:
    #: Having a 'started' status can be useful for when there are long
    #: running tasks and there is a need to report which task is currently
    #: running.
    #:
    #: The application default can be overridden using the
    #: :setting:`CELERY_TRACK_STARTED` setting.
    track_started = None

    #: When enabled messages for this task will be acknowledged **after**
    #: the task has been executed, and not *just before* which is the
    #: default behavior.
    #:
    #: Please note that this means the task may be executed twice if the
    #: worker crashes mid execution (which may be acceptable for some
    #: applications).
    #:
    #: The application default can be overridden with the
    #: :setting:`CELERY_ACKS_LATE` setting.
    acks_late = None

    #: Tuple of expected exceptions.
    #:
    #: These are errors that are expected in normal operation
    #: and that should not be regarded as a real error by the worker.
    #: Currently this means that the state will be updated to an error
    #: state, but the worker will not log the event as an error.
    throws = ()

    #: Default task expiry time.
    expires = None

    #: Some may expect a request to exist even if the task has not been
    #: called.  This should probably be deprecated.
    _default_request = None

    _exec_options = None

    __bound__ = False

    from_config = (
        ('send_error_emails', 'CELERY_SEND_TASK_ERROR_EMAILS'),
        ('serializer', 'CELERY_TASK_SERIALIZER'),
        ('rate_limit', 'CELERY_DEFAULT_RATE_LIMIT'),
        ('track_started', 'CELERY_TRACK_STARTED'),
        ('acks_late', 'CELERY_ACKS_LATE'),
        ('ignore_result', 'CELERY_IGNORE_RESULT'),
        ('store_errors_even_if_ignored',
            'CELERY_STORE_ERRORS_EVEN_IF_IGNORED'),
    )

    _backend = None  # set by backend property.

    __bound__ = False

    # - Tasks are lazily bound, so that configuration is not set
    # - until the task is actually used

    @classmethod
    def bind(self, app):
        was_bound, self.__bound__ = self.__bound__, True
        self._app = app
        conf = app.conf
        self._exec_options = None  # clear option cache

        for attr_name, config_name in self.from_config:
            if getattr(self, attr_name, None) is None:
                setattr(self, attr_name, conf[config_name])
        if self.accept_magic_kwargs is None:
            self.accept_magic_kwargs = app.accept_magic_kwargs

        # decorate with annotations from config.
        if not was_bound:
            self.annotate()

            from celery.utils.threads import LocalStack
            self.request_stack = LocalStack()

        # PeriodicTask uses this to add itself to the PeriodicTask schedule.
        self.on_bound(app)

        return app

    @classmethod
    def on_bound(self, app):
        """This method can be defined to do additional actions when the
        task class is bound to an app."""
        pass

    @classmethod
    def _get_app(self):
        if self._app is None:
            self._app = current_app
        if not self.__bound__:
            # The app property's __set__  method is not called
            # if Task.app is set (on the class), so must bind on use.
            self.bind(self._app)
        return self._app
    app = class_property(_get_app, bind)

    @classmethod
    def annotate(self):
        for d in resolve_all_annotations(self.app.annotations, self):
            for key, value in items(d):
                if key.startswith('@'):
                    self.add_around(key[1:], value)
                else:
                    setattr(self, key, value)

    @classmethod
    def add_around(self, attr, around):
        orig = getattr(self, attr)
        if getattr(orig, '__wrapped__', None):
            orig = orig.__wrapped__
        meth = around(orig)
        meth.__wrapped__ = orig
        setattr(self, attr, meth)

    def __call__(self, *args, **kwargs):
        _task_stack.push(self)
        self.push_request()
        try:
            # add self if this is a bound task
            if self.__self__ is not None:
                return self.run(self.__self__, *args, **kwargs)
            return self.run(*args, **kwargs)
        finally:
            self.pop_request()
            _task_stack.pop()

    def __reduce__(self):
        # - tasks are pickled into the name of the task only, and the reciever
        # - simply grabs it from the local registry.
        # - in later versions the module of the task is also included,
        # - and the receiving side tries to import that module so that
        # - it will work even if the task has not been registered.
        mod = type(self).__module__
        mod = mod if mod and mod in sys.modules else None
        return (_unpickle_task_v2, (self.name, mod), None)

    def run(self, *args, **kwargs):
        """The body of the task executed by workers."""
        raise NotImplementedError('Tasks must define the run method.')

    def start_strategy(self, app, consumer, **kwargs):
        return instantiate(self.Strategy, self, app, consumer, **kwargs)

    def delay(self, *args, **kwargs):
        """Star argument version of :meth:`apply_async`.

        Does not support the extra options enabled by :meth:`apply_async`.

        :param \*args: positional arguments passed on to the task.
        :param \*\*kwargs: keyword arguments passed on to the task.

        :returns :class:`celery.result.AsyncResult`:

        """
        return self.apply_async(args, kwargs)

    def apply_async(self, args=None, kwargs=None, task_id=None, producer=None,
                    link=None, link_error=None, **options):
        """Apply tasks asynchronously by sending a message.

        :keyword args: The positional arguments to pass on to the
                       task (a :class:`list` or :class:`tuple`).

        :keyword kwargs: The keyword arguments to pass on to the
                         task (a :class:`dict`)

        :keyword countdown: Number of seconds into the future that the
                            task should execute. Defaults to immediate
                            execution.

        :keyword eta: A :class:`~datetime.datetime` object describing
                      the absolute time and date of when the task should
                      be executed.  May not be specified if `countdown`
                      is also supplied.

        :keyword expires: Either a :class:`int`, describing the number of
                          seconds, or a :class:`~datetime.datetime` object
                          that describes the absolute time and date of when
                          the task should expire.  The task will not be
                          executed after the expiration time.

        :keyword connection: Re-use existing broker connection instead
                             of establishing a new one.

        :keyword retry: If enabled sending of the task message will be retried
                        in the event of connection loss or failure.  Default
                        is taken from the :setting:`CELERY_TASK_PUBLISH_RETRY`
                        setting.  Note that you need to handle the
                        producer/connection manually for this to work.

        :keyword retry_policy:  Override the retry policy used.  See the
                                :setting:`CELERY_TASK_PUBLISH_RETRY_POLICY`
                                setting.

        :keyword routing_key: Custom routing key used to route the task to a
                              worker server. If in combination with a
                              ``queue`` argument only used to specify custom
                              routing keys to topic exchanges.

        :keyword queue: The queue to route the task to.  This must be a key
                        present in :setting:`CELERY_QUEUES`, or
                        :setting:`CELERY_CREATE_MISSING_QUEUES` must be
                        enabled.  See :ref:`guide-routing` for more
                        information.

        :keyword exchange: Named custom exchange to send the task to.
                           Usually not used in combination with the ``queue``
                           argument.

        :keyword priority: The task priority, a number between 0 and 9.
                           Defaults to the :attr:`priority` attribute.

        :keyword serializer: A string identifying the default
                             serialization method to use.  Can be `pickle`,
                             `json`, `yaml`, `msgpack` or any custom
                             serialization method that has been registered
                             with :mod:`kombu.serialization.registry`.
                             Defaults to the :attr:`serializer` attribute.

        :keyword compression: A string identifying the compression method
                              to use.  Can be one of ``zlib``, ``bzip2``,
                              or any custom compression methods registered with
                              :func:`kombu.compression.register`. Defaults to
                              the :setting:`CELERY_MESSAGE_COMPRESSION`
                              setting.
        :keyword link: A single, or a list of tasks to apply if the
                       task exits successfully.
        :keyword link_error: A single, or a list of tasks to apply
                      if an error occurs while executing the task.

        :keyword producer: :class:~@amqp.TaskProducer` instance to use.

        :keyword add_to_parent: If set to True (default) and the task
            is applied while executing another task, then the result
            will be appended to the parent tasks ``request.children``
            attribute.  Trailing can also be disabled by default using the
            :attr:`trail` attribute

        :keyword publisher: Deprecated alias to ``producer``.

        :keyword headers: Message headers to be sent in the
            task (a :class:`dict`)

        :rtype :class:`celery.result.AsyncResult`: if
            :setting:`CELERY_ALWAYS_EAGER` is not set, otherwise
            :class:`celery.result.EagerResult`.

        Also supports all keyword arguments supported by
        :meth:`kombu.Producer.publish`.

        .. note::
            If the :setting:`CELERY_ALWAYS_EAGER` setting is set, it will
            be replaced by a local :func:`apply` call instead.

        """
        app = self._get_app()
        if app.conf.CELERY_ALWAYS_EAGER:
            return self.apply(args, kwargs, task_id=task_id or uuid(),
                              link=link, link_error=link_error, **options)
        # add 'self' if this is a "task_method".
        if self.__self__ is not None:
            args = args if isinstance(args, tuple) else tuple(args or ())
            args = (self.__self__, ) + args
        return app.send_task(
            self.name, args, kwargs, task_id=task_id, producer=producer,
            link=link, link_error=link_error, result_cls=self.AsyncResult,
            **dict(self._get_exec_options(), **options)
        )

    def subtask_from_request(self, request=None, args=None, kwargs=None,
                             queue=None, **extra_options):
        request = self.request if request is None else request
        args = request.args if args is None else args
        kwargs = request.kwargs if kwargs is None else kwargs
        limit_hard, limit_soft = request.timelimit or (None, None)
        options = {
            'task_id': request.id,
            'link': request.callbacks,
            'link_error': request.errbacks,
            'group_id': request.group,
            'chord': request.chord,
            'soft_time_limit': limit_soft,
            'time_limit': limit_hard,
            'reply_to': request.reply_to,
            'headers': request.headers,
        }
        options.update(
            {'queue': queue} if queue else (request.delivery_info or {})
        )
        return self.subtask(args, kwargs, options, type=self, **extra_options)

    def retry(self, args=None, kwargs=None, exc=None, throw=True,
              eta=None, countdown=None, max_retries=None, **options):
        """Retry the task.

        :param args: Positional arguments to retry with.
        :param kwargs: Keyword arguments to retry with.
        :keyword exc: Custom exception to report when the max restart
            limit has been exceeded (default:
            :exc:`~@MaxRetriesExceededError`).

            If this argument is set and retry is called while
            an exception was raised (``sys.exc_info()`` is set)
            it will attempt to reraise the current exception.

            If no exception was raised it will raise the ``exc``
            argument provided.
        :keyword countdown: Time in seconds to delay the retry for.
        :keyword eta: Explicit time and date to run the retry at
                      (must be a :class:`~datetime.datetime` instance).
        :keyword max_retries: If set, overrides the default retry limit for
            this execution. Changes to this parameter do not propagate to
            subsequent task retry attempts. A value of :const:`None`, means
            "use the default", so if you want infinite retries you would
            have to set the :attr:`max_retries` attribute of the task to
            :const:`None` first.
        :keyword time_limit: If set, overrides the default time limit.
        :keyword soft_time_limit: If set, overrides the default soft
                                  time limit.
        :keyword \*\*options: Any extra options to pass on to
                              meth:`apply_async`.
        :keyword throw: If this is :const:`False`, do not raise the
                        :exc:`~@Retry` exception,
                        that tells the worker to mark the task as being
                        retried.  Note that this means the task will be
                        marked as failed if the task raises an exception,
                        or successful if it returns.

        :raises celery.exceptions.Retry: To tell the worker that
            the task has been re-sent for retry. This always happens,
            unless the `throw` keyword argument has been explicitly set
            to :const:`False`, and is considered normal operation.

        **Example**

        .. code-block:: python

            >>> from imaginary_twitter_lib import Twitter
            >>> from proj.celery import app

            >>> @app.task(bind=True)
            ... def tweet(self, auth, message):
            ...     twitter = Twitter(oauth=auth)
            ...     try:
            ...         twitter.post_status_update(message)
            ...     except twitter.FailWhale as exc:
            ...         # Retry in 5 minutes.
            ...         raise self.retry(countdown=60 * 5, exc=exc)

        Although the task will never return above as `retry` raises an
        exception to notify the worker, we use `raise` in front of the retry
        to convey that the rest of the block will not be executed.

        """
        request = self.request
        retries = request.retries + 1
        max_retries = self.max_retries if max_retries is None else max_retries

        # Not in worker or emulated by (apply/always_eager),
        # so just raise the original exception.
        if request.called_directly:
            maybe_reraise()  # raise orig stack if PyErr_Occurred
            raise exc or Retry('Task can be retried', None)

        if not eta and countdown is None:
            countdown = self.default_retry_delay

        is_eager = request.is_eager
        S = self.subtask_from_request(
            request, args, kwargs,
            countdown=countdown, eta=eta, retries=retries,
            **options
        )

        if max_retries is not None and retries > max_retries:
            if exc:
                # first try to reraise the original exception
                maybe_reraise()
                # or if not in an except block then raise the custom exc.
                raise exc
            raise self.MaxRetriesExceededError(
                "Can't retry {0}[{1}] args:{2} kwargs:{3}".format(
                    self.name, request.id, S.args, S.kwargs))

        ret = Retry(exc=exc, when=eta or countdown)

        if is_eager:
            # if task was executed eagerly using apply(),
            # then the retry must also be executed eagerly.
            S.apply().get()
            return ret

        try:
            S.apply_async()
        except Exception as exc:
            raise Reject(exc, requeue=False)
        if throw:
            raise ret
        return ret

    def apply(self, args=None, kwargs=None,
              link=None, link_error=None, **options):
        """Execute this task locally, by blocking until the task returns.

        :param args: positional arguments passed on to the task.
        :param kwargs: keyword arguments passed on to the task.
        :keyword throw: Re-raise task exceptions.  Defaults to
                        the :setting:`CELERY_EAGER_PROPAGATES_EXCEPTIONS`
                        setting.

        :rtype :class:`celery.result.EagerResult`:

        """
        # trace imports Task, so need to import inline.
        from celery.app.trace import eager_trace_task

        app = self._get_app()
        args = args or ()
        # add 'self' if this is a bound method.
        if self.__self__ is not None:
            args = (self.__self__, ) + tuple(args)
        kwargs = kwargs or {}
        task_id = options.get('task_id') or uuid()
        retries = options.get('retries', 0)
        throw = app.either('CELERY_EAGER_PROPAGATES_EXCEPTIONS',
                           options.pop('throw', None))

        # Make sure we get the task instance, not class.
        task = app._tasks[self.name]

        request = {'id': task_id,
                   'retries': retries,
                   'is_eager': True,
                   'logfile': options.get('logfile'),
                   'loglevel': options.get('loglevel', 0),
                   'callbacks': maybe_list(link),
                   'errbacks': maybe_list(link_error),
                   'headers': options.get('headers'),
                   'delivery_info': {'is_eager': True}}
        if self.accept_magic_kwargs:
            default_kwargs = {'task_name': task.name,
                              'task_id': task_id,
                              'task_retries': retries,
                              'task_is_eager': True,
                              'logfile': options.get('logfile'),
                              'loglevel': options.get('loglevel', 0),
                              'delivery_info': {'is_eager': True}}
            supported_keys = fun_takes_kwargs(task.run, default_kwargs)
            extend_with = dict((key, val)
                               for key, val in items(default_kwargs)
                               if key in supported_keys)
            kwargs.update(extend_with)

        tb = None
        retval, info = eager_trace_task(task, task_id, args, kwargs,
                                        app=self._get_app(),
                                        request=request, propagate=throw)
        if isinstance(retval, ExceptionInfo):
            retval, tb = retval.exception, retval.traceback
        state = states.SUCCESS if info is None else info.state
        return EagerResult(task_id, retval, state, traceback=tb)

    def AsyncResult(self, task_id, **kwargs):
        """Get AsyncResult instance for this kind of task.

        :param task_id: Task id to get result for.

        """
        return self._get_app().AsyncResult(task_id, backend=self.backend,
                                           task_name=self.name, **kwargs)

    def subtask(self, args=None, *starargs, **starkwargs):
        """Return :class:`~celery.signature` object for
        this task, wrapping arguments and execution options
        for a single task invocation."""
        starkwargs.setdefault('app', self.app)
        return signature(self, args, *starargs, **starkwargs)

    def s(self, *args, **kwargs):
        """``.s(*a, **k) -> .subtask(a, k)``"""
        return self.subtask(args, kwargs)

    def si(self, *args, **kwargs):
        """``.si(*a, **k) -> .subtask(a, k, immutable=True)``"""
        return self.subtask(args, kwargs, immutable=True)

    def chunks(self, it, n):
        """Creates a :class:`~celery.canvas.chunks` task for this task."""
        from celery import chunks
        return chunks(self.s(), it, n, app=self.app)

    def map(self, it):
        """Creates a :class:`~celery.canvas.xmap` task from ``it``."""
        from celery import xmap
        return xmap(self.s(), it, app=self.app)

    def starmap(self, it):
        """Creates a :class:`~celery.canvas.xstarmap` task from ``it``."""
        from celery import xstarmap
        return xstarmap(self.s(), it, app=self.app)

    def send_event(self, type_, **fields):
        req = self.request
        with self.app.events.default_dispatcher(hostname=req.hostname) as d:
            return d.send(type_, uuid=req.id, **fields)

    def update_state(self, task_id=None, state=None, meta=None):
        """Update task state.

        :keyword task_id: Id of the task to update, defaults to the
                          id of the current task
        :keyword state: New state (:class:`str`).
        :keyword meta: State metadata (:class:`dict`).



        """
        if task_id is None:
            task_id = self.request.id
        self.backend.store_result(task_id, meta, state)

    def on_success(self, retval, task_id, args, kwargs):
        """Success handler.

        Run by the worker if the task executes successfully.

        :param retval: The return value of the task.
        :param task_id: Unique id of the executed task.
        :param args: Original arguments for the executed task.
        :param kwargs: Original keyword arguments for the executed task.

        The return value of this handler is ignored.

        """
        pass

    def on_retry(self, exc, task_id, args, kwargs, einfo):
        """Retry handler.

        This is run by the worker when the task is to be retried.

        :param exc: The exception sent to :meth:`retry`.
        :param task_id: Unique id of the retried task.
        :param args: Original arguments for the retried task.
        :param kwargs: Original keyword arguments for the retried task.

        :keyword einfo: :class:`~billiard.einfo.ExceptionInfo`
                        instance, containing the traceback.

        The return value of this handler is ignored.

        """
        pass

    def on_failure(self, exc, task_id, args, kwargs, einfo):
        """Error handler.

        This is run by the worker when the task fails.

        :param exc: The exception raised by the task.
        :param task_id: Unique id of the failed task.
        :param args: Original arguments for the task that failed.
        :param kwargs: Original keyword arguments for the task
                       that failed.

        :keyword einfo: :class:`~billiard.einfo.ExceptionInfo`
                        instance, containing the traceback.

        The return value of this handler is ignored.

        """
        pass

    def after_return(self, status, retval, task_id, args, kwargs, einfo):
        """Handler called after the task returns.

        :param status: Current task state.
        :param retval: Task return value/exception.
        :param task_id: Unique id of the task.
        :param args: Original arguments for the task.
        :param kwargs: Original keyword arguments for the task.

        :keyword einfo: :class:`~billiard.einfo.ExceptionInfo`
                        instance, containing the traceback (if any).

        The return value of this handler is ignored.

        """
        pass

    def send_error_email(self, context, exc, **kwargs):
        if self.send_error_emails and \
                not getattr(self, 'disable_error_emails', None):
            self.ErrorMail(self, **kwargs).send(context, exc)

    def add_trail(self, result):
        if self.trail:
            self.request.children.append(result)
        return result

    def push_request(self, *args, **kwargs):
        self.request_stack.push(Context(*args, **kwargs))

    def pop_request(self):
        self.request_stack.pop()

    def __repr__(self):
        """`repr(task)`"""
        return _reprtask(self, R_SELF_TASK if self.__self__ else R_INSTANCE)

    def _get_request(self):
        """Get current request object."""
        req = self.request_stack.top
        if req is None:
            # task was not called, but some may still expect a request
            # to be there, perhaps that should be deprecated.
            if self._default_request is None:
                self._default_request = Context()
            return self._default_request
        return req
    request = property(_get_request)

    def _get_exec_options(self):
        if self._exec_options is None:
            self._exec_options = extract_exec_options(self)
        return self._exec_options

    @property
    def backend(self):
        backend = self._backend
        if backend is None:
            return self.app.backend
        return backend

    @backend.setter
    def backend(self, value):  # noqa
        self._backend = value

    @property
    def __name__(self):
        return self.__class__.__name__
BaseTask = Task  # compat alias
