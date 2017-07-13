from __future__ import absolute_import

try:
    import unittest  # noqa
    unittest.skip
    from unittest.util import safe_repr, unorderable_list_difference
except AttributeError:
    import unittest2 as unittest  # noqa
    from unittest2.util import safe_repr, unorderable_list_difference  # noqa

import importlib
import inspect
import logging
import numbers
import os
import platform
import re
import sys
import threading
import time
import types
import warnings

from contextlib import contextmanager
from copy import deepcopy
from datetime import datetime, timedelta
from functools import partial, wraps
from types import ModuleType

try:
    from unittest import mock
except ImportError:
    import mock  # noqa
from nose import SkipTest
from kombu import Queue
from kombu.log import NullHandler
from kombu.utils import nested, symbol_by_name

from celery import Celery
from celery.app import current_app
from celery.backends.cache import CacheBackend, DummyClient
from celery.exceptions import CDeprecationWarning, CPendingDeprecationWarning
from celery.five import (
    WhateverIO, builtins, items, reraise,
    string_t, values, open_fqdn,
)
from celery.utils.functional import noop
from celery.utils.imports import qualname

__all__ = [
    'Case', 'AppCase', 'Mock', 'MagicMock', 'ANY',
    'patch', 'call', 'sentinel', 'skip_unless_module',
    'wrap_logger', 'with_environ', 'sleepdeprived',
    'skip_if_environ', 'todo', 'skip', 'skip_if',
    'skip_unless', 'mask_modules', 'override_stdouts', 'mock_module',
    'replace_module_value', 'sys_platform', 'reset_modules',
    'patch_modules', 'mock_context', 'mock_open', 'patch_many',
    'assert_signal_called', 'skip_if_pypy',
    'skip_if_jython', 'body_from_sig', 'restore_logging',
]
patch = mock.patch
call = mock.call
sentinel = mock.sentinel
MagicMock = mock.MagicMock
ANY = mock.ANY

PY3 = sys.version_info[0] == 3

CASE_REDEFINES_SETUP = """\
{name} (subclass of AppCase) redefines private "setUp", should be: "setup"\
"""
CASE_REDEFINES_TEARDOWN = """\
{name} (subclass of AppCase) redefines private "tearDown", \
should be: "teardown"\
"""
CASE_LOG_REDIRECT_EFFECT = """\
Test {0} did not disable LoggingProxy for {1}\
"""
CASE_LOG_LEVEL_EFFECT = """\
Test {0} Modified the level of the root logger\
"""
CASE_LOG_HANDLER_EFFECT = """\
Test {0} Modified handlers for the root logger\
"""

CELERY_TEST_CONFIG = {
    #: Don't want log output when running suite.
    'CELERYD_HIJACK_ROOT_LOGGER': False,
    'CELERY_SEND_TASK_ERROR_EMAILS': False,
    'CELERY_DEFAULT_QUEUE': 'testcelery',
    'CELERY_DEFAULT_EXCHANGE': 'testcelery',
    'CELERY_DEFAULT_ROUTING_KEY': 'testcelery',
    'CELERY_QUEUES': (
        Queue('testcelery', routing_key='testcelery'),
    ),
    'CELERY_ENABLE_UTC': True,
    'CELERY_TIMEZONE': 'UTC',
    'CELERYD_LOG_COLOR': False,

    # Mongo results tests (only executed if installed and running)
    'CELERY_MONGODB_BACKEND_SETTINGS': {
        'host': os.environ.get('MONGO_HOST') or 'localhost',
        'port': os.environ.get('MONGO_PORT') or 27017,
        'database': os.environ.get('MONGO_DB') or 'celery_unittests',
        'taskmeta_collection': (os.environ.get('MONGO_TASKMETA_COLLECTION') or
                                'taskmeta_collection'),
        'user': os.environ.get('MONGO_USER'),
        'password': os.environ.get('MONGO_PASSWORD'),
    }
}


class Trap(object):

    def __getattr__(self, name):
        raise RuntimeError('Test depends on current_app')


class UnitLogging(symbol_by_name(Celery.log_cls)):

    def __init__(self, *args, **kwargs):
        super(UnitLogging, self).__init__(*args, **kwargs)
        self.already_setup = True


def UnitApp(name=None, broker=None, backend=None,
            set_as_current=False, log=UnitLogging, **kwargs):

    app = Celery(name or 'celery.tests',
                 broker=broker or 'memory://',
                 backend=backend or 'cache+memory://',
                 set_as_current=set_as_current,
                 log=log,
                 **kwargs)
    app.add_defaults(deepcopy(CELERY_TEST_CONFIG))
    return app


class Mock(mock.Mock):

    def __init__(self, *args, **kwargs):
        attrs = kwargs.pop('attrs', None) or {}
        super(Mock, self).__init__(*args, **kwargs)
        for attr_name, attr_value in items(attrs):
            setattr(self, attr_name, attr_value)


class _ContextMock(Mock):
    """Dummy class implementing __enter__ and __exit__
    as the with statement requires these to be implemented
    in the class, not just the instance."""

    def __enter__(self):
        pass

    def __exit__(self, *exc_info):
        pass


def ContextMock(*args, **kwargs):
    obj = _ContextMock(*args, **kwargs)
    obj.attach_mock(_ContextMock(), '__enter__')
    obj.attach_mock(_ContextMock(), '__exit__')
    obj.__enter__.return_value = obj
    # if __exit__ return a value the exception is ignored,
    # so it must return None here.
    obj.__exit__.return_value = None
    return obj


def _bind(f, o):
    @wraps(f)
    def bound_meth(*fargs, **fkwargs):
        return f(o, *fargs, **fkwargs)
    return bound_meth


if PY3:  # pragma: no cover
    def _get_class_fun(meth):
        return meth
else:
    def _get_class_fun(meth):
        return meth.__func__


class MockCallbacks(object):

    def __new__(cls, *args, **kwargs):
        r = Mock(name=cls.__name__)
        _get_class_fun(cls.__init__)(r, *args, **kwargs)
        for key, value in items(vars(cls)):
            if key not in ('__dict__', '__weakref__', '__new__', '__init__'):
                if inspect.ismethod(value) or inspect.isfunction(value):
                    r.__getattr__(key).side_effect = _bind(value, r)
                else:
                    r.__setattr__(key, value)
        return r


def skip_unless_module(module):

    def _inner(fun):

        @wraps(fun)
        def __inner(*args, **kwargs):
            try:
                importlib.import_module(module)
            except ImportError:
                raise SkipTest('Does not have %s' % (module, ))

            return fun(*args, **kwargs)

        return __inner
    return _inner


# -- adds assertWarns from recent unittest2, not in Python 2.7.

class _AssertRaisesBaseContext(object):

    def __init__(self, expected, test_case, callable_obj=None,
                 expected_regex=None):
        self.expected = expected
        self.failureException = test_case.failureException
        self.obj_name = None
        if isinstance(expected_regex, string_t):
            expected_regex = re.compile(expected_regex)
        self.expected_regex = expected_regex


def _is_magic_module(m):
    # some libraries create custom module types that are lazily
    # lodaded, e.g. Django installs some modules in sys.modules that
    # will load _tkinter and other shit when touched.

    # pyflakes refuses to accept 'noqa' for this isinstance.
    cls, modtype = type(m), types.ModuleType
    try:
        variables = vars(cls)
    except TypeError:
        return True
    else:
        return (cls is not modtype and (
            '__getattr__' in variables or
            '__getattribute__' in variables))


class _AssertWarnsContext(_AssertRaisesBaseContext):
    """A context manager used to implement TestCase.assertWarns* methods."""

    def __enter__(self):
        # The __warningregistry__'s need to be in a pristine state for tests
        # to work properly.
        warnings.resetwarnings()
        for v in list(values(sys.modules)):
            # do not evaluate Django moved modules and other lazily
            # initialized modules.
            if v and not _is_magic_module(v):
                # use raw __getattribute__ to protect even better from
                # lazily loaded modules
                try:
                    object.__getattribute__(v, '__warningregistry__')
                except AttributeError:
                    pass
                else:
                    object.__setattr__(v, '__warningregistry__', {})
        self.warnings_manager = warnings.catch_warnings(record=True)
        self.warnings = self.warnings_manager.__enter__()
        warnings.simplefilter('always', self.expected)
        return self

    def __exit__(self, exc_type, exc_value, tb):
        self.warnings_manager.__exit__(exc_type, exc_value, tb)
        if exc_type is not None:
            # let unexpected exceptions pass through
            return
        try:
            exc_name = self.expected.__name__
        except AttributeError:
            exc_name = str(self.expected)
        first_matching = None
        for m in self.warnings:
            w = m.message
            if not isinstance(w, self.expected):
                continue
            if first_matching is None:
                first_matching = w
            if (self.expected_regex is not None and
                    not self.expected_regex.search(str(w))):
                continue
            # store warning for later retrieval
            self.warning = w
            self.filename = m.filename
            self.lineno = m.lineno
            return
        # Now we simply try to choose a helpful failure message
        if first_matching is not None:
            raise self.failureException(
                '%r does not match %r' % (
                    self.expected_regex.pattern, str(first_matching)))
        if self.obj_name:
            raise self.failureException(
                '%s not triggered by %s' % (exc_name, self.obj_name))
        else:
            raise self.failureException('%s not triggered' % exc_name)


class Case(unittest.TestCase):

    def assertWarns(self, expected_warning):
        return _AssertWarnsContext(expected_warning, self, None)

    def assertWarnsRegex(self, expected_warning, expected_regex):
        return _AssertWarnsContext(expected_warning, self,
                                   None, expected_regex)

    @contextmanager
    def assertDeprecated(self):
        with self.assertWarnsRegex(CDeprecationWarning,
                                   r'scheduled for removal'):
            yield

    @contextmanager
    def assertPendingDeprecation(self):
        with self.assertWarnsRegex(CPendingDeprecationWarning,
                                   r'scheduled for deprecation'):
            yield

    def assertDictContainsSubset(self, expected, actual, msg=None):
        missing, mismatched = [], []

        for key, value in items(expected):
            if key not in actual:
                missing.append(key)
            elif value != actual[key]:
                mismatched.append('%s, expected: %s, actual: %s' % (
                    safe_repr(key), safe_repr(value),
                    safe_repr(actual[key])))

        if not (missing or mismatched):
            return

        standard_msg = ''
        if missing:
            standard_msg = 'Missing: %s' % ','.join(map(safe_repr, missing))

        if mismatched:
            if standard_msg:
                standard_msg += '; '
            standard_msg += 'Mismatched values: %s' % (
                ','.join(mismatched))

        self.fail(self._formatMessage(msg, standard_msg))

    def assertItemsEqual(self, expected_seq, actual_seq, msg=None):
        missing = unexpected = None
        try:
            expected = sorted(expected_seq)
            actual = sorted(actual_seq)
        except TypeError:
            # Unsortable items (example: set(), complex(), ...)
            expected = list(expected_seq)
            actual = list(actual_seq)
            missing, unexpected = unorderable_list_difference(
                expected, actual)
        else:
            return self.assertSequenceEqual(expected, actual, msg=msg)

        errors = []
        if missing:
            errors.append(
                'Expected, but missing:\n    %s' % (safe_repr(missing), )
            )
        if unexpected:
            errors.append(
                'Unexpected, but present:\n    %s' % (safe_repr(unexpected), )
            )
        if errors:
            standardMsg = '\n'.join(errors)
            self.fail(self._formatMessage(msg, standardMsg))


def depends_on_current_app(fun):
    if inspect.isclass(fun):
        fun.contained = False
    else:
        @wraps(fun)
        def __inner(self, *args, **kwargs):
            self.app.set_current()
            return fun(self, *args, **kwargs)
        return __inner


class AppCase(Case):
    contained = True

    def __init__(self, *args, **kwargs):
        super(AppCase, self).__init__(*args, **kwargs)
        if self.__class__.__dict__.get('setUp'):
            raise RuntimeError(
                CASE_REDEFINES_SETUP.format(name=qualname(self)),
            )
        if self.__class__.__dict__.get('tearDown'):
            raise RuntimeError(
                CASE_REDEFINES_TEARDOWN.format(name=qualname(self)),
            )

    def Celery(self, *args, **kwargs):
        return UnitApp(*args, **kwargs)

    def setUp(self):
        self._threads_at_setup = list(threading.enumerate())
        from celery import _state
        from celery import result
        result.task_join_will_block = \
            _state.task_join_will_block = lambda: False
        self._current_app = current_app()
        self._default_app = _state.default_app
        trap = Trap()
        self._prev_tls = _state._tls
        _state.set_default_app(trap)

        class NonTLS(object):
            current_app = trap
        _state._tls = NonTLS()

        self.app = self.Celery(set_as_current=False)
        if not self.contained:
            self.app.set_current()
        root = logging.getLogger()
        self.__rootlevel = root.level
        self.__roothandlers = root.handlers
        _state._set_task_join_will_block(False)
        try:
            self.setup()
        except:
            self._teardown_app()
            raise

    def _teardown_app(self):
        from celery.utils.log import LoggingProxy
        assert sys.stdout
        assert sys.stderr
        assert sys.__stdout__
        assert sys.__stderr__
        this = self._get_test_name()
        if isinstance(sys.stdout, (LoggingProxy, Mock)) or \
                isinstance(sys.__stdout__, (LoggingProxy, Mock)):
            raise RuntimeError(CASE_LOG_REDIRECT_EFFECT.format(this, 'stdout'))
        if isinstance(sys.stderr, (LoggingProxy, Mock)) or \
                isinstance(sys.__stderr__, (LoggingProxy, Mock)):
            raise RuntimeError(CASE_LOG_REDIRECT_EFFECT.format(this, 'stderr'))
        backend = self.app.__dict__.get('backend')
        if backend is not None:
            if isinstance(backend, CacheBackend):
                if isinstance(backend.client, DummyClient):
                    backend.client.cache.clear()
                backend._cache.clear()
        from celery import _state
        _state._set_task_join_will_block(False)

        _state.set_default_app(self._default_app)
        _state._tls = self._prev_tls
        _state._tls.current_app = self._current_app
        if self.app is not self._current_app:
            self.app.close()
        self.app = None
        self.assertEqual(
            self._threads_at_setup, list(threading.enumerate()),
        )

    def _get_test_name(self):
        return '.'.join([self.__class__.__name__, self._testMethodName])

    def tearDown(self):
        try:
            self.teardown()
        finally:
            self._teardown_app()
        self.assert_no_logging_side_effect()

    def assert_no_logging_side_effect(self):
        this = self._get_test_name()
        root = logging.getLogger()
        if root.level != self.__rootlevel:
            raise RuntimeError(CASE_LOG_LEVEL_EFFECT.format(this))
        if root.handlers != self.__roothandlers:
            raise RuntimeError(CASE_LOG_HANDLER_EFFECT.format(this))

    def setup(self):
        pass

    def teardown(self):
        pass


def get_handlers(logger):
    return [h for h in logger.handlers if not isinstance(h, NullHandler)]


@contextmanager
def wrap_logger(logger, loglevel=logging.ERROR):
    old_handlers = get_handlers(logger)
    sio = WhateverIO()
    siohandler = logging.StreamHandler(sio)
    logger.handlers = [siohandler]

    try:
        yield sio
    finally:
        logger.handlers = old_handlers


def with_environ(env_name, env_value):

    def _envpatched(fun):

        @wraps(fun)
        def _patch_environ(*args, **kwargs):
            prev_val = os.environ.get(env_name)
            os.environ[env_name] = env_value
            try:
                return fun(*args, **kwargs)
            finally:
                os.environ[env_name] = prev_val or ''

        return _patch_environ
    return _envpatched


def sleepdeprived(module=time):

    def _sleepdeprived(fun):

        @wraps(fun)
        def __sleepdeprived(*args, **kwargs):
            old_sleep = module.sleep
            module.sleep = noop
            try:
                return fun(*args, **kwargs)
            finally:
                module.sleep = old_sleep

        return __sleepdeprived

    return _sleepdeprived


def skip_if_environ(env_var_name):

    def _wrap_test(fun):

        @wraps(fun)
        def _skips_if_environ(*args, **kwargs):
            if os.environ.get(env_var_name):
                raise SkipTest('SKIP %s: %s set\n' % (
                    fun.__name__, env_var_name))
            return fun(*args, **kwargs)

        return _skips_if_environ

    return _wrap_test


def _skip_test(reason, sign):

    def _wrap_test(fun):

        @wraps(fun)
        def _skipped_test(*args, **kwargs):
            raise SkipTest('%s: %s' % (sign, reason))

        return _skipped_test
    return _wrap_test


def todo(reason):
    """TODO test decorator."""
    return _skip_test(reason, 'TODO')


def skip(reason):
    """Skip test decorator."""
    return _skip_test(reason, 'SKIP')


def skip_if(predicate, reason):
    """Skip test if predicate is :const:`True`."""

    def _inner(fun):
        return predicate and skip(reason)(fun) or fun

    return _inner


def skip_unless(predicate, reason):
    """Skip test if predicate is :const:`False`."""
    return skip_if(not predicate, reason)


# Taken from
# http://bitbucket.org/runeh/snippets/src/tip/missing_modules.py
@contextmanager
def mask_modules(*modnames):
    """Ban some modules from being importable inside the context

    For example:

        >>> with mask_modules('sys'):
        ...     try:
        ...         import sys
        ...     except ImportError:
        ...         print('sys not found')
        sys not found

        >>> import sys  # noqa
        >>> sys.version
        (2, 5, 2, 'final', 0)

    """

    realimport = builtins.__import__

    def myimp(name, *args, **kwargs):
        if name in modnames:
            raise ImportError('No module named %s' % name)
        else:
            return realimport(name, *args, **kwargs)

    builtins.__import__ = myimp
    try:
        yield True
    finally:
        builtins.__import__ = realimport


@contextmanager
def override_stdouts():
    """Override `sys.stdout` and `sys.stderr` with `WhateverIO`."""
    prev_out, prev_err = sys.stdout, sys.stderr
    prev_rout, prev_rerr = sys.__stdout__, sys.__stderr__
    mystdout, mystderr = WhateverIO(), WhateverIO()
    sys.stdout = sys.__stdout__ = mystdout
    sys.stderr = sys.__stderr__ = mystderr

    try:
        yield mystdout, mystderr
    finally:
        sys.stdout = prev_out
        sys.stderr = prev_err
        sys.__stdout__ = prev_rout
        sys.__stderr__ = prev_rerr


def disable_stdouts(fun):

    @wraps(fun)
    def disable(*args, **kwargs):
        with override_stdouts():
            return fun(*args, **kwargs)
    return disable


def _old_patch(module, name, mocked):
    module = importlib.import_module(module)

    def _patch(fun):

        @wraps(fun)
        def __patched(*args, **kwargs):
            prev = getattr(module, name)
            setattr(module, name, mocked)
            try:
                return fun(*args, **kwargs)
            finally:
                setattr(module, name, prev)
        return __patched
    return _patch


@contextmanager
def replace_module_value(module, name, value=None):
    has_prev = hasattr(module, name)
    prev = getattr(module, name, None)
    if value:
        setattr(module, name, value)
    else:
        try:
            delattr(module, name)
        except AttributeError:
            pass
    try:
        yield
    finally:
        if prev is not None:
            setattr(module, name, prev)
        if not has_prev:
            try:
                delattr(module, name)
            except AttributeError:
                pass
pypy_version = partial(
    replace_module_value, sys, 'pypy_version_info',
)
platform_pyimp = partial(
    replace_module_value, platform, 'python_implementation',
)


@contextmanager
def sys_platform(value):
    prev, sys.platform = sys.platform, value
    try:
        yield
    finally:
        sys.platform = prev


@contextmanager
def reset_modules(*modules):
    prev = dict((k, sys.modules.pop(k)) for k in modules if k in sys.modules)
    try:
        yield
    finally:
        sys.modules.update(prev)


@contextmanager
def patch_modules(*modules):
    prev = {}
    for mod in modules:
        prev[mod] = sys.modules.get(mod)
        sys.modules[mod] = ModuleType(mod)
    try:
        yield
    finally:
        for name, mod in items(prev):
            if mod is None:
                sys.modules.pop(name, None)
            else:
                sys.modules[name] = mod


@contextmanager
def mock_module(*names):
    prev = {}

    class MockModule(ModuleType):

        def __getattr__(self, attr):
            setattr(self, attr, Mock())
            return ModuleType.__getattribute__(self, attr)

    mods = []
    for name in names:
        try:
            prev[name] = sys.modules[name]
        except KeyError:
            pass
        mod = sys.modules[name] = MockModule(name)
        mods.append(mod)
    try:
        yield mods
    finally:
        for name in names:
            try:
                sys.modules[name] = prev[name]
            except KeyError:
                try:
                    del(sys.modules[name])
                except KeyError:
                    pass


@contextmanager
def mock_context(mock, typ=Mock):
    context = mock.return_value = Mock()
    context.__enter__ = typ()
    context.__exit__ = typ()

    def on_exit(*x):
        if x[0]:
            reraise(x[0], x[1], x[2])
    context.__exit__.side_effect = on_exit
    context.__enter__.return_value = context
    try:
        yield context
    finally:
        context.reset()


@contextmanager
def mock_open(typ=WhateverIO, side_effect=None):
    with patch(open_fqdn) as open_:
        with mock_context(open_) as context:
            if side_effect is not None:
                context.__enter__.side_effect = side_effect
            val = context.__enter__.return_value = typ()
            val.__exit__ = Mock()
            yield val


def patch_many(*targets):
    return nested(*[patch(target) for target in targets])


@contextmanager
def assert_signal_called(signal, **expected):
    handler = Mock()
    call_handler = partial(handler)
    signal.connect(call_handler)
    try:
        yield handler
    finally:
        signal.disconnect(call_handler)
    handler.assert_called_with(signal=signal, **expected)


def skip_if_pypy(fun):

    @wraps(fun)
    def _inner(*args, **kwargs):
        if getattr(sys, 'pypy_version_info', None):
            raise SkipTest('does not work on PyPy')
        return fun(*args, **kwargs)
    return _inner


def skip_if_jython(fun):

    @wraps(fun)
    def _inner(*args, **kwargs):
        if sys.platform.startswith('java'):
            raise SkipTest('does not work on Jython')
        return fun(*args, **kwargs)
    return _inner


def body_from_sig(app, sig, utc=True):
    sig.freeze()
    callbacks = sig.options.pop('link', None)
    errbacks = sig.options.pop('link_error', None)
    countdown = sig.options.pop('countdown', None)
    if countdown:
        eta = app.now() + timedelta(seconds=countdown)
    else:
        eta = sig.options.pop('eta', None)
    if eta and isinstance(eta, datetime):
        eta = eta.isoformat()
    expires = sig.options.pop('expires', None)
    if expires and isinstance(expires, numbers.Real):
        expires = app.now() + timedelta(seconds=expires)
    if expires and isinstance(expires, datetime):
        expires = expires.isoformat()
    return {
        'task': sig.task,
        'id': sig.id,
        'args': sig.args,
        'kwargs': sig.kwargs,
        'callbacks': [dict(s) for s in callbacks] if callbacks else None,
        'errbacks': [dict(s) for s in errbacks] if errbacks else None,
        'eta': eta,
        'utc': utc,
        'expires': expires,
    }


@contextmanager
def restore_logging():
    outs = sys.stdout, sys.stderr, sys.__stdout__, sys.__stderr__
    root = logging.getLogger()
    level = root.level
    handlers = root.handlers

    try:
        yield
    finally:
        sys.stdout, sys.stderr, sys.__stdout__, sys.__stderr__ = outs
        root.level = level
        root.handlers[:] = handlers
