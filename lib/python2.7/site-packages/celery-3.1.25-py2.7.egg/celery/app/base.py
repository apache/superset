# -*- coding: utf-8 -*-
"""
    celery.app.base
    ~~~~~~~~~~~~~~~

    Actual App instance implementation.

"""
from __future__ import absolute_import

import os
import threading
import warnings

from collections import defaultdict, deque
from copy import deepcopy
from operator import attrgetter

from amqp import promise
from billiard.util import register_after_fork
from kombu.clocks import LamportClock
from kombu.common import oid_from
from kombu.utils import cached_property, uuid

from celery import platforms
from celery import signals
from celery._state import (
    _task_stack, get_current_app, _set_current_app, set_default_app,
    _register_app, get_current_worker_task, connect_on_app_finalize,
    _announce_app_finalized,
)
from celery.exceptions import AlwaysEagerIgnored, ImproperlyConfigured
from celery.five import values
from celery.loaders import get_loader_cls
from celery.local import PromiseProxy, maybe_evaluate
from celery.utils.functional import first, maybe_list
from celery.utils.imports import instantiate, symbol_by_name
from celery.utils.objects import FallbackContext, mro_lookup

from .annotations import prepare as prepare_annotations
from .defaults import DEFAULTS, find_deprecated_settings
from .registry import TaskRegistry
from .utils import (
    AppPickler, Settings, bugreport, _unpickle_app, _unpickle_app_v2, appstr,
)

# Load all builtin tasks
from . import builtins  # noqa

__all__ = ['Celery']

_EXECV = os.environ.get('FORKED_BY_MULTIPROCESSING')
BUILTIN_FIXUPS = frozenset([
    'celery.fixups.django:fixup',
])

ERR_ENVVAR_NOT_SET = """\
The environment variable {0!r} is not set,
and as such the configuration could not be loaded.
Please set this variable and make it point to
a configuration module."""

_after_fork_registered = False


def app_has_custom(app, attr):
    return mro_lookup(app.__class__, attr, stop=(Celery, object),
                      monkey_patched=[__name__])


def _unpickle_appattr(reverse_name, args):
    """Given an attribute name and a list of args, gets
    the attribute from the current app and calls it."""
    return get_current_app()._rgetattr(reverse_name)(*args)


def _global_after_fork(obj):
    # Previously every app would call:
    #    `register_after_fork(app, app._after_fork)`
    # but this created a leak as `register_after_fork` stores concrete object
    # references and once registered an object cannot be removed without
    # touching and iterating over the private afterfork registry list.
    #
    # See Issue #1949
    from celery import _state
    from multiprocessing import util as mputil
    for app in _state._apps:
        try:
            app._after_fork(obj)
        except Exception as exc:
            if mputil._logger:
                mputil._logger.info(
                    'after forker raised exception: %r', exc, exc_info=1)


def _ensure_after_fork():
    global _after_fork_registered
    _after_fork_registered = True
    register_after_fork(_global_after_fork, _global_after_fork)


class Celery(object):
    #: This is deprecated, use :meth:`reduce_keys` instead
    Pickler = AppPickler

    SYSTEM = platforms.SYSTEM
    IS_OSX, IS_WINDOWS = platforms.IS_OSX, platforms.IS_WINDOWS

    amqp_cls = 'celery.app.amqp:AMQP'
    backend_cls = None
    events_cls = 'celery.events:Events'
    loader_cls = 'celery.loaders.app:AppLoader'
    log_cls = 'celery.app.log:Logging'
    control_cls = 'celery.app.control:Control'
    task_cls = 'celery.app.task:Task'
    registry_cls = TaskRegistry
    _fixups = None
    _pool = None
    builtin_fixups = BUILTIN_FIXUPS

    def __init__(self, main=None, loader=None, backend=None,
                 amqp=None, events=None, log=None, control=None,
                 set_as_current=True, accept_magic_kwargs=False,
                 tasks=None, broker=None, include=None, changes=None,
                 config_source=None, fixups=None, task_cls=None,
                 autofinalize=True, **kwargs):
        self.clock = LamportClock()
        self.main = main
        self.amqp_cls = amqp or self.amqp_cls
        self.events_cls = events or self.events_cls
        self.loader_cls = loader or self.loader_cls
        self.log_cls = log or self.log_cls
        self.control_cls = control or self.control_cls
        self.task_cls = task_cls or self.task_cls
        self.set_as_current = set_as_current
        self.registry_cls = symbol_by_name(self.registry_cls)
        self.accept_magic_kwargs = accept_magic_kwargs
        self.user_options = defaultdict(set)
        self.steps = defaultdict(set)
        self.autofinalize = autofinalize

        self.configured = False
        self._config_source = config_source
        self._pending_defaults = deque()

        self.finalized = False
        self._finalize_mutex = threading.Lock()
        self._pending = deque()
        self._tasks = tasks
        if not isinstance(self._tasks, TaskRegistry):
            self._tasks = TaskRegistry(self._tasks or {})

        # If the class defines a custom __reduce_args__ we need to use
        # the old way of pickling apps, which is pickling a list of
        # args instead of the new way that pickles a dict of keywords.
        self._using_v1_reduce = app_has_custom(self, '__reduce_args__')

        # these options are moved to the config to
        # simplify pickling of the app object.
        self._preconf = changes or {}
        if broker:
            self._preconf['BROKER_URL'] = broker
        if backend:
            self._preconf['CELERY_RESULT_BACKEND'] = backend
        if include:
            self._preconf['CELERY_IMPORTS'] = include

        # - Apply fixups.
        self.fixups = set(self.builtin_fixups) if fixups is None else fixups
        # ...store fixup instances in _fixups to keep weakrefs alive.
        self._fixups = [symbol_by_name(fixup)(self) for fixup in self.fixups]

        if self.set_as_current:
            self.set_current()

        self.on_init()
        _register_app(self)

    def set_current(self):
        _set_current_app(self)

    def set_default(self):
        set_default_app(self)

    def __enter__(self):
        return self

    def __exit__(self, *exc_info):
        self.close()

    def close(self):
        self._maybe_close_pool()

    def on_init(self):
        """Optional callback called at init."""
        pass

    def start(self, argv=None):
        return instantiate(
            'celery.bin.celery:CeleryCommand',
            app=self).execute_from_commandline(argv)

    def worker_main(self, argv=None):
        return instantiate(
            'celery.bin.worker:worker',
            app=self).execute_from_commandline(argv)

    def task(self, *args, **opts):
        """Creates new task class from any callable."""
        if _EXECV and not opts.get('_force_evaluate'):
            # When using execv the task in the original module will point to a
            # different app, so doing things like 'add.request' will point to
            # a differnt task instance.  This makes sure it will always use
            # the task instance from the current app.
            # Really need a better solution for this :(
            from . import shared_task
            return shared_task(*args, _force_evaluate=True, **opts)

        def inner_create_task_cls(shared=True, filter=None, **opts):
            _filt = filter  # stupid 2to3

            def _create_task_cls(fun):
                if shared:
                    def cons(app):
                        return app._task_from_fun(fun, **opts)
                    cons.__name__ = fun.__name__
                    connect_on_app_finalize(cons)
                if self.accept_magic_kwargs:  # compat mode
                    task = self._task_from_fun(fun, **opts)
                    if filter:
                        task = filter(task)
                    return task

                if self.finalized or opts.get('_force_evaluate'):
                    ret = self._task_from_fun(fun, **opts)
                else:
                    # return a proxy object that evaluates on first use
                    ret = PromiseProxy(self._task_from_fun, (fun, ), opts,
                                       __doc__=fun.__doc__)
                    self._pending.append(ret)
                if _filt:
                    return _filt(ret)
                return ret

            return _create_task_cls

        if len(args) == 1:
            if callable(args[0]):
                return inner_create_task_cls(**opts)(*args)
            raise TypeError('argument 1 to @task() must be a callable')
        if args:
            raise TypeError(
                '@task() takes exactly 1 argument ({0} given)'.format(
                    sum([len(args), len(opts)])))
        return inner_create_task_cls(**opts)

    def _task_from_fun(self, fun, **options):
        if not self.finalized and not self.autofinalize:
            raise RuntimeError('Contract breach: app not finalized')
        base = options.pop('base', None) or self.Task
        bind = options.pop('bind', False)

        T = type(fun.__name__, (base, ), dict({
            'app': self,
            'accept_magic_kwargs': False,
            'run': fun if bind else staticmethod(fun),
            '_decorated': True,
            '__doc__': fun.__doc__,
            '__module__': fun.__module__,
            '__wrapped__': fun}, **options))()
        task = self._tasks[T.name]  # return global instance.
        return task

    def finalize(self, auto=False):
        with self._finalize_mutex:
            if not self.finalized:
                if auto and not self.autofinalize:
                    raise RuntimeError('Contract breach: app not finalized')
                self.finalized = True
                _announce_app_finalized(self)

                pending = self._pending
                while pending:
                    maybe_evaluate(pending.popleft())

                for task in values(self._tasks):
                    task.bind(self)

    def add_defaults(self, fun):
        if not callable(fun):
            d, fun = fun, lambda: d
        if self.configured:
            return self.conf.add_defaults(fun())
        self._pending_defaults.append(fun)

    def config_from_object(self, obj, silent=False, force=False):
        self._config_source = obj
        if force or self.configured:
            del(self.conf)
            return self.loader.config_from_object(obj, silent=silent)

    def config_from_envvar(self, variable_name, silent=False, force=False):
        module_name = os.environ.get(variable_name)
        if not module_name:
            if silent:
                return False
            raise ImproperlyConfigured(
                ERR_ENVVAR_NOT_SET.format(variable_name))
        return self.config_from_object(module_name, silent=silent, force=force)

    def config_from_cmdline(self, argv, namespace='celery'):
        self.conf.update(self.loader.cmdline_config_parser(argv, namespace))

    def setup_security(self, allowed_serializers=None, key=None, cert=None,
                       store=None, digest='sha1', serializer='json'):
        from celery.security import setup_security
        return setup_security(allowed_serializers, key, cert,
                              store, digest, serializer, app=self)

    def autodiscover_tasks(self, packages, related_name='tasks', force=False):
        if force:
            return self._autodiscover_tasks(packages, related_name)
        signals.import_modules.connect(promise(
            self._autodiscover_tasks, (packages, related_name),
        ), weak=False, sender=self)

    def _autodiscover_tasks(self, packages, related_name='tasks', **kwargs):
        # argument may be lazy
        packages = packages() if callable(packages) else packages
        self.loader.autodiscover_tasks(packages, related_name)

    def send_task(self, name, args=None, kwargs=None, countdown=None,
                  eta=None, task_id=None, producer=None, connection=None,
                  router=None, result_cls=None, expires=None,
                  publisher=None, link=None, link_error=None,
                  add_to_parent=True, reply_to=None, **options):
        task_id = task_id or uuid()
        producer = producer or publisher  # XXX compat
        router = router or self.amqp.router
        conf = self.conf
        if conf.CELERY_ALWAYS_EAGER:  # pragma: no cover
            warnings.warn(AlwaysEagerIgnored(
                'CELERY_ALWAYS_EAGER has no effect on send_task',
            ), stacklevel=2)
        options = router.route(options, name, args, kwargs)
        if connection:
            producer = self.amqp.TaskProducer(connection)
        with self.producer_or_acquire(producer) as P:
            self.backend.on_task_call(P, task_id)
            task_id = P.publish_task(
                name, args, kwargs, countdown=countdown, eta=eta,
                task_id=task_id, expires=expires,
                callbacks=maybe_list(link), errbacks=maybe_list(link_error),
                reply_to=reply_to or self.oid, **options
            )
        result = (result_cls or self.AsyncResult)(task_id)
        if add_to_parent:
            parent = get_current_worker_task()
            if parent:
                parent.add_trail(result)
        return result

    def connection(self, hostname=None, userid=None, password=None,
                   virtual_host=None, port=None, ssl=None,
                   connect_timeout=None, transport=None,
                   transport_options=None, heartbeat=None,
                   login_method=None, failover_strategy=None, **kwargs):
        conf = self.conf
        return self.amqp.Connection(
            hostname or conf.BROKER_URL,
            userid or conf.BROKER_USER,
            password or conf.BROKER_PASSWORD,
            virtual_host or conf.BROKER_VHOST,
            port or conf.BROKER_PORT,
            transport=transport or conf.BROKER_TRANSPORT,
            ssl=self.either('BROKER_USE_SSL', ssl),
            heartbeat=heartbeat,
            login_method=login_method or conf.BROKER_LOGIN_METHOD,
            failover_strategy=(
                failover_strategy or conf.BROKER_FAILOVER_STRATEGY
            ),
            transport_options=dict(
                conf.BROKER_TRANSPORT_OPTIONS, **transport_options or {}
            ),
            connect_timeout=self.either(
                'BROKER_CONNECTION_TIMEOUT', connect_timeout
            ),
        )
    broker_connection = connection

    def _acquire_connection(self, pool=True):
        """Helper for :meth:`connection_or_acquire`."""
        if pool:
            return self.pool.acquire(block=True)
        return self.connection()

    def connection_or_acquire(self, connection=None, pool=True, *_, **__):
        return FallbackContext(connection, self._acquire_connection, pool=pool)
    default_connection = connection_or_acquire  # XXX compat

    def producer_or_acquire(self, producer=None):
        return FallbackContext(
            producer, self.amqp.producer_pool.acquire, block=True,
        )
    default_producer = producer_or_acquire  # XXX compat

    def prepare_config(self, c):
        """Prepare configuration before it is merged with the defaults."""
        return find_deprecated_settings(c)

    def now(self):
        return self.loader.now(utc=self.conf.CELERY_ENABLE_UTC)

    def mail_admins(self, subject, body, fail_silently=False):
        if self.conf.ADMINS:
            to = [admin_email for _, admin_email in self.conf.ADMINS]
            return self.loader.mail_admins(
                subject, body, fail_silently, to=to,
                sender=self.conf.SERVER_EMAIL,
                host=self.conf.EMAIL_HOST,
                port=self.conf.EMAIL_PORT,
                user=self.conf.EMAIL_HOST_USER,
                password=self.conf.EMAIL_HOST_PASSWORD,
                timeout=self.conf.EMAIL_TIMEOUT,
                use_ssl=self.conf.EMAIL_USE_SSL,
                use_tls=self.conf.EMAIL_USE_TLS,
            )

    def select_queues(self, queues=None):
        return self.amqp.queues.select(queues)

    def either(self, default_key, *values):
        """Fallback to the value of a configuration key if none of the
        `*values` are true."""
        return first(None, values) or self.conf.get(default_key)

    def bugreport(self):
        return bugreport(self)

    def _get_backend(self):
        from celery.backends import get_backend_by_url
        backend, url = get_backend_by_url(
            self.backend_cls or self.conf.CELERY_RESULT_BACKEND,
            self.loader)
        return backend(app=self, url=url)

    def on_configure(self):
        """Callback calld when the app loads configuration"""
        pass

    def _get_config(self):
        self.on_configure()
        if self._config_source:
            self.loader.config_from_object(self._config_source)
        self.configured = True
        s = Settings({}, [self.prepare_config(self.loader.conf),
                          deepcopy(DEFAULTS)])
        # load lazy config dict initializers.
        pending = self._pending_defaults
        while pending:
            s.add_defaults(maybe_evaluate(pending.popleft()()))

        # preconf options must be explicitly set in the conf, and not
        # as defaults or they will not be pickled with the app instance.
        # This will cause errors when `CELERYD_FORCE_EXECV=True` as
        # the workers will not have a BROKER_URL, CELERY_RESULT_BACKEND,
        # or CELERY_IMPORTS set in the config.
        if self._preconf:
            s.update(self._preconf)
        return s

    def _after_fork(self, obj_):
        self._maybe_close_pool()

    def _maybe_close_pool(self):
        pool, self._pool = self._pool, None
        if pool is not None:
            pool.force_close_all()
        amqp = self.__dict__.get('amqp')
        if amqp is not None:
            producer_pool, amqp._producer_pool = amqp._producer_pool, None
            if producer_pool is not None:
                producer_pool.force_close_all()

    def signature(self, *args, **kwargs):
        kwargs['app'] = self
        return self.canvas.signature(*args, **kwargs)

    def create_task_cls(self):
        """Creates a base task class using default configuration
        taken from this app."""
        return self.subclass_with_self(
            self.task_cls, name='Task', attribute='_app',
            keep_reduce=True, abstract=True,
        )

    def subclass_with_self(self, Class, name=None, attribute='app',
                           reverse=None, keep_reduce=False, **kw):
        """Subclass an app-compatible class by setting its app attribute
        to be this app instance.

        App-compatible means that the class has a class attribute that
        provides the default app it should use, e.g.
        ``class Foo: app = None``.

        :param Class: The app-compatible class to subclass.
        :keyword name: Custom name for the target class.
        :keyword attribute: Name of the attribute holding the app,
                            default is 'app'.

        """
        Class = symbol_by_name(Class)
        reverse = reverse if reverse else Class.__name__

        def __reduce__(self):
            return _unpickle_appattr, (reverse, self.__reduce_args__())

        attrs = dict({attribute: self}, __module__=Class.__module__,
                     __doc__=Class.__doc__, **kw)
        if not keep_reduce:
            attrs['__reduce__'] = __reduce__

        return type(name or Class.__name__, (Class, ), attrs)

    def _rgetattr(self, path):
        return attrgetter(path)(self)

    def __repr__(self):
        return '<{0} {1}>'.format(type(self).__name__, appstr(self))

    def __reduce__(self):
        if self._using_v1_reduce:
            return self.__reduce_v1__()
        return (_unpickle_app_v2, (self.__class__, self.__reduce_keys__()))

    def __reduce_v1__(self):
        # Reduce only pickles the configuration changes,
        # so the default configuration doesn't have to be passed
        # between processes.
        return (
            _unpickle_app,
            (self.__class__, self.Pickler) + self.__reduce_args__(),
        )

    def __reduce_keys__(self):
        """Return keyword arguments used to reconstruct the object
        when unpickling."""
        return {
            'main': self.main,
            'changes': self.conf.changes if self.configured else self._preconf,
            'loader': self.loader_cls,
            'backend': self.backend_cls,
            'amqp': self.amqp_cls,
            'events': self.events_cls,
            'log': self.log_cls,
            'control': self.control_cls,
            'accept_magic_kwargs': self.accept_magic_kwargs,
            'fixups': self.fixups,
            'config_source': self._config_source,
            'task_cls': self.task_cls,
        }

    def __reduce_args__(self):
        """Deprecated method, please use :meth:`__reduce_keys__` instead."""
        return (self.main, self.conf.changes,
                self.loader_cls, self.backend_cls, self.amqp_cls,
                self.events_cls, self.log_cls, self.control_cls,
                self.accept_magic_kwargs, self._config_source)

    @cached_property
    def Worker(self):
        return self.subclass_with_self('celery.apps.worker:Worker')

    @cached_property
    def WorkController(self, **kwargs):
        return self.subclass_with_self('celery.worker:WorkController')

    @cached_property
    def Beat(self, **kwargs):
        return self.subclass_with_self('celery.apps.beat:Beat')

    @cached_property
    def Task(self):
        return self.create_task_cls()

    @cached_property
    def annotations(self):
        return prepare_annotations(self.conf.CELERY_ANNOTATIONS)

    @cached_property
    def AsyncResult(self):
        return self.subclass_with_self('celery.result:AsyncResult')

    @cached_property
    def ResultSet(self):
        return self.subclass_with_self('celery.result:ResultSet')

    @cached_property
    def GroupResult(self):
        return self.subclass_with_self('celery.result:GroupResult')

    @cached_property
    def TaskSet(self):  # XXX compat
        """Deprecated! Please use :class:`celery.group` instead."""
        return self.subclass_with_self('celery.task.sets:TaskSet')

    @cached_property
    def TaskSetResult(self):  # XXX compat
        """Deprecated! Please use :attr:`GroupResult` instead."""
        return self.subclass_with_self('celery.result:TaskSetResult')

    @property
    def pool(self):
        if self._pool is None:
            _ensure_after_fork()
            limit = self.conf.BROKER_POOL_LIMIT
            self._pool = self.connection().Pool(limit=limit)
        return self._pool

    @property
    def current_task(self):
        return _task_stack.top

    @cached_property
    def oid(self):
        return oid_from(self)

    @cached_property
    def amqp(self):
        return instantiate(self.amqp_cls, app=self)

    @cached_property
    def backend(self):
        return self._get_backend()

    @cached_property
    def conf(self):
        return self._get_config()

    @cached_property
    def control(self):
        return instantiate(self.control_cls, app=self)

    @cached_property
    def events(self):
        return instantiate(self.events_cls, app=self)

    @cached_property
    def loader(self):
        return get_loader_cls(self.loader_cls)(app=self)

    @cached_property
    def log(self):
        return instantiate(self.log_cls, app=self)

    @cached_property
    def canvas(self):
        from celery import canvas
        return canvas

    @cached_property
    def tasks(self):
        self.finalize(auto=True)
        return self._tasks

    @cached_property
    def timezone(self):
        from celery.utils.timeutils import timezone
        conf = self.conf
        tz = conf.CELERY_TIMEZONE
        if not tz:
            return (timezone.get_timezone('UTC') if conf.CELERY_ENABLE_UTC
                    else timezone.local)
        return timezone.get_timezone(self.conf.CELERY_TIMEZONE)
App = Celery  # compat
