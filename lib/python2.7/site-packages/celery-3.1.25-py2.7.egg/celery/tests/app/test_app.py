from __future__ import absolute_import

import gc
import os
import itertools

from copy import deepcopy
from pickle import loads, dumps

from amqp import promise
from kombu import Exchange

from celery import shared_task, current_app
from celery import app as _app
from celery import _state
from celery.app import base as _appbase
from celery.app import defaults
from celery.exceptions import ImproperlyConfigured
from celery.five import items
from celery.loaders.base import BaseLoader
from celery.platforms import pyimplementation
from celery.utils.serialization import pickle

from celery.tests.case import (
    CELERY_TEST_CONFIG,
    AppCase,
    Mock,
    depends_on_current_app,
    mask_modules,
    patch,
    platform_pyimp,
    sys_platform,
    pypy_version,
    with_environ,
)
from celery.utils import uuid
from celery.utils.mail import ErrorMail

THIS_IS_A_KEY = 'this is a value'


class ObjectConfig(object):
    FOO = 1
    BAR = 2

object_config = ObjectConfig()
dict_config = dict(FOO=10, BAR=20)


class ObjectConfig2(object):
    LEAVE_FOR_WORK = True
    MOMENT_TO_STOP = True
    CALL_ME_BACK = 123456789
    WANT_ME_TO = False
    UNDERSTAND_ME = True


class Object(object):

    def __init__(self, **kwargs):
        for key, value in items(kwargs):
            setattr(self, key, value)


def _get_test_config():
    return deepcopy(CELERY_TEST_CONFIG)
test_config = _get_test_config()


class test_module(AppCase):

    def test_default_app(self):
        self.assertEqual(_app.default_app, _state.default_app)

    def test_bugreport(self):
        self.assertTrue(_app.bugreport(app=self.app))


class test_App(AppCase):

    def setup(self):
        self.app.add_defaults(test_config)

    def test_task_autofinalize_disabled(self):
        with self.Celery('xyzibari', autofinalize=False) as app:
            @app.task
            def ttafd():
                return 42

            with self.assertRaises(RuntimeError):
                ttafd()

        with self.Celery('xyzibari', autofinalize=False) as app:
            @app.task
            def ttafd2():
                return 42

            app.finalize()
            self.assertEqual(ttafd2(), 42)

    def test_registry_autofinalize_disabled(self):
        with self.Celery('xyzibari', autofinalize=False) as app:
            with self.assertRaises(RuntimeError):
                app.tasks['celery.chain']
            app.finalize()
            self.assertTrue(app.tasks['celery.chain'])

    def test_task(self):
        with self.Celery('foozibari') as app:

            def fun():
                pass

            fun.__module__ = '__main__'
            task = app.task(fun)
            self.assertEqual(task.name, app.main + '.fun')

    def test_with_config_source(self):
        with self.Celery(config_source=ObjectConfig) as app:
            self.assertEqual(app.conf.FOO, 1)
            self.assertEqual(app.conf.BAR, 2)

    @depends_on_current_app
    def test_task_windows_execv(self):
        prev, _appbase._EXECV = _appbase._EXECV, True
        try:

            @self.app.task(shared=False)
            def foo():
                pass

            self.assertTrue(foo._get_current_object())  # is proxy

        finally:
            _appbase._EXECV = prev
        assert not _appbase._EXECV

    def test_task_takes_no_args(self):
        with self.assertRaises(TypeError):
            @self.app.task(1)
            def foo():
                pass

    def test_add_defaults(self):
        self.assertFalse(self.app.configured)
        _conf = {'FOO': 300}

        def conf():
            return _conf

        self.app.add_defaults(conf)
        self.assertIn(conf, self.app._pending_defaults)
        self.assertFalse(self.app.configured)
        self.assertEqual(self.app.conf.FOO, 300)
        self.assertTrue(self.app.configured)
        self.assertFalse(self.app._pending_defaults)

        # defaults not pickled
        appr = loads(dumps(self.app))
        with self.assertRaises(AttributeError):
            appr.conf.FOO

        # add more defaults after configured
        conf2 = {'FOO': 'BAR'}
        self.app.add_defaults(conf2)
        self.assertEqual(self.app.conf.FOO, 'BAR')

        self.assertIn(_conf, self.app.conf.defaults)
        self.assertIn(conf2, self.app.conf.defaults)

    def test_connection_or_acquire(self):
        with self.app.connection_or_acquire(block=True):
            self.assertTrue(self.app.pool._dirty)

        with self.app.connection_or_acquire(pool=False):
            self.assertFalse(self.app.pool._dirty)

    def test_maybe_close_pool(self):
        cpool = self.app._pool = Mock()
        amqp = self.app.__dict__['amqp'] = Mock()
        ppool = amqp._producer_pool
        self.app._maybe_close_pool()
        cpool.force_close_all.assert_called_with()
        ppool.force_close_all.assert_called_with()
        self.assertIsNone(self.app._pool)
        self.assertIsNone(self.app.__dict__['amqp']._producer_pool)

        self.app._pool = Mock()
        self.app._maybe_close_pool()
        self.app._maybe_close_pool()

    def test_using_v1_reduce(self):
        self.app._using_v1_reduce = True
        self.assertTrue(loads(dumps(self.app)))

    def test_autodiscover_tasks_force(self):
        self.app.loader.autodiscover_tasks = Mock()
        self.app.autodiscover_tasks(['proj.A', 'proj.B'], force=True)
        self.app.loader.autodiscover_tasks.assert_called_with(
            ['proj.A', 'proj.B'], 'tasks',
        )
        self.app.loader.autodiscover_tasks = Mock()
        self.app.autodiscover_tasks(
            lambda: ['proj.A', 'proj.B'],
            related_name='george',
            force=True,
        )
        self.app.loader.autodiscover_tasks.assert_called_with(
            ['proj.A', 'proj.B'], 'george',
        )

    def test_autodiscover_tasks_lazy(self):
        with patch('celery.signals.import_modules') as import_modules:

            def packages():
                return [1, 2, 3]

            self.app.autodiscover_tasks(packages)
            self.assertTrue(import_modules.connect.called)
            prom = import_modules.connect.call_args[0][0]
            self.assertIsInstance(prom, promise)
            self.assertEqual(prom.fun, self.app._autodiscover_tasks)
            self.assertEqual(prom.args[0](), [1, 2, 3])

    @with_environ('CELERY_BROKER_URL', '')
    def test_with_broker(self):
        with self.Celery(broker='foo://baribaz') as app:
            self.assertEqual(app.conf.BROKER_URL, 'foo://baribaz')

    def test_repr(self):
        self.assertTrue(repr(self.app))

    def test_custom_task_registry(self):
        with self.Celery(tasks=self.app.tasks) as app2:
            self.assertIs(app2.tasks, self.app.tasks)

    def test_include_argument(self):
        with self.Celery(include=('foo', 'bar.foo')) as app:
            self.assertEqual(app.conf.CELERY_IMPORTS, ('foo', 'bar.foo'))

    def test_set_as_current(self):
        current = _state._tls.current_app
        try:
            app = self.Celery(set_as_current=True)
            self.assertIs(_state._tls.current_app, app)
        finally:
            _state._tls.current_app = current

    def test_current_task(self):
        @self.app.task
        def foo(shared=False):
            pass

        _state._task_stack.push(foo)
        try:
            self.assertEqual(self.app.current_task.name, foo.name)
        finally:
            _state._task_stack.pop()

    def test_task_not_shared(self):
        with patch('celery.app.base.connect_on_app_finalize') as sh:
            @self.app.task(shared=False)
            def foo():
                pass
            self.assertFalse(sh.called)

    def test_task_compat_with_filter(self):
        with self.Celery(accept_magic_kwargs=True) as app:
            check = Mock()

            def filter(task):
                check(task)
                return task

            @app.task(filter=filter, shared=False)
            def foo():
                pass
            check.assert_called_with(foo)

    def test_task_with_filter(self):
        with self.Celery(accept_magic_kwargs=False) as app:
            check = Mock()

            def filter(task):
                check(task)
                return task

            assert not _appbase._EXECV

            @app.task(filter=filter, shared=False)
            def foo():
                pass
            check.assert_called_with(foo)

    def test_task_sets_main_name_MP_MAIN_FILE(self):
        from celery import utils as _utils
        _utils.MP_MAIN_FILE = __file__
        try:
            with self.Celery('xuzzy') as app:

                @app.task
                def foo():
                    pass

                self.assertEqual(foo.name, 'xuzzy.foo')
        finally:
            _utils.MP_MAIN_FILE = None

    def test_annotate_decorator(self):
        from celery.app.task import Task

        class adX(Task):
            abstract = True

            def run(self, y, z, x):
                return y, z, x

        check = Mock()

        def deco(fun):

            def _inner(*args, **kwargs):
                check(*args, **kwargs)
                return fun(*args, **kwargs)
            return _inner

        self.app.conf.CELERY_ANNOTATIONS = {
            adX.name: {'@__call__': deco}
        }
        adX.bind(self.app)
        self.assertIs(adX.app, self.app)

        i = adX()
        i(2, 4, x=3)
        check.assert_called_with(i, 2, 4, x=3)

        i.annotate()
        i.annotate()

    def test_apply_async_has__self__(self):
        @self.app.task(__self__='hello', shared=False)
        def aawsX():
            pass

        with patch('celery.app.amqp.TaskProducer.publish_task') as dt:
            aawsX.apply_async((4, 5))
            args = dt.call_args[0][1]
            self.assertEqual(args, ('hello', 4, 5))

    def test_apply_async_adds_children(self):
        from celery._state import _task_stack

        @self.app.task(shared=False)
        def a3cX1(self):
            pass

        @self.app.task(shared=False)
        def a3cX2(self):
            pass

        _task_stack.push(a3cX1)
        try:
            a3cX1.push_request(called_directly=False)
            try:
                res = a3cX2.apply_async(add_to_parent=True)
                self.assertIn(res, a3cX1.request.children)
            finally:
                a3cX1.pop_request()
        finally:
            _task_stack.pop()

    def test_pickle_app(self):
        changes = dict(THE_FOO_BAR='bars',
                       THE_MII_MAR='jars')
        self.app.conf.update(changes)
        saved = pickle.dumps(self.app)
        self.assertLess(len(saved), 2048)
        restored = pickle.loads(saved)
        self.assertDictContainsSubset(changes, restored.conf)

    def test_worker_main(self):
        from celery.bin import worker as worker_bin

        class worker(worker_bin.worker):

            def execute_from_commandline(self, argv):
                return argv

        prev, worker_bin.worker = worker_bin.worker, worker
        try:
            ret = self.app.worker_main(argv=['--version'])
            self.assertListEqual(ret, ['--version'])
        finally:
            worker_bin.worker = prev

    def test_config_from_envvar(self):
        os.environ['CELERYTEST_CONFIG_OBJECT'] = 'celery.tests.app.test_app'
        self.app.config_from_envvar('CELERYTEST_CONFIG_OBJECT')
        self.assertEqual(self.app.conf.THIS_IS_A_KEY, 'this is a value')

    def assert_config2(self):
        self.assertTrue(self.app.conf.LEAVE_FOR_WORK)
        self.assertTrue(self.app.conf.MOMENT_TO_STOP)
        self.assertEqual(self.app.conf.CALL_ME_BACK, 123456789)
        self.assertFalse(self.app.conf.WANT_ME_TO)
        self.assertTrue(self.app.conf.UNDERSTAND_ME)

    def test_config_from_object__lazy(self):
        conf = ObjectConfig2()
        self.app.config_from_object(conf)
        self.assertFalse(self.app.loader._conf)
        self.assertIs(self.app._config_source, conf)

        self.assert_config2()

    def test_config_from_object__force(self):
        self.app.config_from_object(ObjectConfig2(), force=True)
        self.assertTrue(self.app.loader._conf)

        self.assert_config2()

    def test_config_from_cmdline(self):
        cmdline = ['.always_eager=no',
                   '.result_backend=/dev/null',
                   'celeryd.prefetch_multiplier=368',
                   '.foobarstring=(string)300',
                   '.foobarint=(int)300',
                   '.result_engine_options=(dict){"foo": "bar"}']
        self.app.config_from_cmdline(cmdline, namespace='celery')
        self.assertFalse(self.app.conf.CELERY_ALWAYS_EAGER)
        self.assertEqual(self.app.conf.CELERY_RESULT_BACKEND, '/dev/null')
        self.assertEqual(self.app.conf.CELERYD_PREFETCH_MULTIPLIER, 368)
        self.assertEqual(self.app.conf.CELERY_FOOBARSTRING, '300')
        self.assertEqual(self.app.conf.CELERY_FOOBARINT, 300)
        self.assertDictEqual(self.app.conf.CELERY_RESULT_ENGINE_OPTIONS,
                             {'foo': 'bar'})

    def test_compat_setting_CELERY_BACKEND(self):
        self.app._preconf = {}  # removes result backend set by AppCase
        self.app.config_from_object(Object(CELERY_BACKEND='set_by_us'))
        self.assertEqual(self.app.conf.CELERY_RESULT_BACKEND, 'set_by_us')

    def test_setting_BROKER_TRANSPORT_OPTIONS(self):

        _args = {'foo': 'bar', 'spam': 'baz'}

        self.app.config_from_object(Object())
        self.assertEqual(self.app.conf.BROKER_TRANSPORT_OPTIONS, {})

        self.app.config_from_object(Object(BROKER_TRANSPORT_OPTIONS=_args))
        self.assertEqual(self.app.conf.BROKER_TRANSPORT_OPTIONS, _args)

    def test_Windows_log_color_disabled(self):
        self.app.IS_WINDOWS = True
        self.assertFalse(self.app.log.supports_color(True))

    def test_compat_setting_CARROT_BACKEND(self):
        self.app.config_from_object(Object(CARROT_BACKEND='set_by_us'))
        self.assertEqual(self.app.conf.BROKER_TRANSPORT, 'set_by_us')

    def test_WorkController(self):
        x = self.app.WorkController
        self.assertIs(x.app, self.app)

    def test_Worker(self):
        x = self.app.Worker
        self.assertIs(x.app, self.app)

    @depends_on_current_app
    def test_AsyncResult(self):
        x = self.app.AsyncResult('1')
        self.assertIs(x.app, self.app)
        r = loads(dumps(x))
        # not set as current, so ends up as default app after reduce
        self.assertIs(r.app, current_app._get_current_object())

    def test_get_active_apps(self):
        self.assertTrue(list(_state._get_active_apps()))

        app1 = self.Celery()
        appid = id(app1)
        self.assertIn(app1, _state._get_active_apps())
        app1.close()
        del(app1)

        gc.collect()

        # weakref removed from list when app goes out of scope.
        with self.assertRaises(StopIteration):
            next(app for app in _state._get_active_apps() if id(app) == appid)

    def test_config_from_envvar_more(self, key='CELERY_HARNESS_CFG1'):
        self.assertFalse(
            self.app.config_from_envvar(
                'HDSAJIHWIQHEWQU', force=True, silent=True),
        )
        with self.assertRaises(ImproperlyConfigured):
            self.app.config_from_envvar(
                'HDSAJIHWIQHEWQU', force=True, silent=False,
            )
        os.environ[key] = __name__ + '.object_config'
        self.assertTrue(self.app.config_from_envvar(key, force=True))
        self.assertEqual(self.app.conf['FOO'], 1)
        self.assertEqual(self.app.conf['BAR'], 2)

        os.environ[key] = 'unknown_asdwqe.asdwqewqe'
        with self.assertRaises(ImportError):
            self.app.config_from_envvar(key, silent=False)
        self.assertFalse(
            self.app.config_from_envvar(key, force=True, silent=True),
        )

        os.environ[key] = __name__ + '.dict_config'
        self.assertTrue(self.app.config_from_envvar(key, force=True))
        self.assertEqual(self.app.conf['FOO'], 10)
        self.assertEqual(self.app.conf['BAR'], 20)

    @patch('celery.bin.celery.CeleryCommand.execute_from_commandline')
    def test_start(self, execute):
        self.app.start()
        self.assertTrue(execute.called)

    def test_mail_admins(self):

        class Loader(BaseLoader):

            def mail_admins(*args, **kwargs):
                return args, kwargs

        self.app.loader = Loader(app=self.app)
        self.app.conf.ADMINS = None
        self.assertFalse(self.app.mail_admins('Subject', 'Body'))
        self.app.conf.ADMINS = [('George Costanza', 'george@vandelay.com')]
        self.assertTrue(self.app.mail_admins('Subject', 'Body'))

    def test_amqp_get_broker_info(self):
        self.assertDictContainsSubset(
            {'hostname': 'localhost',
             'userid': 'guest',
             'password': 'guest',
             'virtual_host': '/'},
            self.app.connection('pyamqp://').info(),
        )
        self.app.conf.BROKER_PORT = 1978
        self.app.conf.BROKER_VHOST = 'foo'
        self.assertDictContainsSubset(
            {'port': 1978, 'virtual_host': 'foo'},
            self.app.connection('pyamqp://:1978/foo').info(),
        )
        conn = self.app.connection('pyamqp:////value')
        self.assertDictContainsSubset({'virtual_host': '/value'},
                                      conn.info())

    def test_amqp_failover_strategy_selection(self):
        # Test passing in a string and make sure the string
        # gets there untouched
        self.app.conf.BROKER_FAILOVER_STRATEGY = 'foo-bar'
        self.assertEqual(
            self.app.connection('amqp:////value').failover_strategy,
            'foo-bar',
        )

        # Try passing in None
        self.app.conf.BROKER_FAILOVER_STRATEGY = None
        self.assertEqual(
            self.app.connection('amqp:////value').failover_strategy,
            itertools.cycle,
        )

        # Test passing in a method
        def my_failover_strategy(it):
            yield True

        self.app.conf.BROKER_FAILOVER_STRATEGY = my_failover_strategy
        self.assertEqual(
            self.app.connection('amqp:////value').failover_strategy,
            my_failover_strategy,
        )

    def test_BROKER_BACKEND_alias(self):
        self.assertEqual(self.app.conf.BROKER_BACKEND,
                         self.app.conf.BROKER_TRANSPORT)

    def test_after_fork(self):
        p = self.app._pool = Mock()
        self.app._after_fork(self.app)
        p.force_close_all.assert_called_with()
        self.assertIsNone(self.app._pool)
        self.app._after_fork(self.app)

    def test_pool_no_multiprocessing(self):
        with mask_modules('multiprocessing.util'):
            pool = self.app.pool
            self.assertIs(pool, self.app._pool)

    def test_bugreport(self):
        self.assertTrue(self.app.bugreport())

    def test_send_task_sent_event(self):

        class Dispatcher(object):
            sent = []

            def publish(self, type, fields, *args, **kwargs):
                self.sent.append((type, fields))

        conn = self.app.connection()
        chan = conn.channel()
        try:
            for e in ('foo_exchange', 'moo_exchange', 'bar_exchange'):
                chan.exchange_declare(e, 'direct', durable=True)
                chan.queue_declare(e, durable=True)
                chan.queue_bind(e, e, e)
        finally:
            chan.close()
        assert conn.transport_cls == 'memory'

        prod = self.app.amqp.TaskProducer(
            conn, exchange=Exchange('foo_exchange'),
            send_sent_event=True,
        )

        dispatcher = Dispatcher()
        self.assertTrue(prod.publish_task('footask', (), {},
                                          exchange='moo_exchange',
                                          routing_key='moo_exchange',
                                          event_dispatcher=dispatcher))
        self.assertTrue(dispatcher.sent)
        self.assertEqual(dispatcher.sent[0][0], 'task-sent')
        self.assertTrue(prod.publish_task('footask', (), {},
                                          event_dispatcher=dispatcher,
                                          exchange='bar_exchange',
                                          routing_key='bar_exchange'))

    def test_error_mail_sender(self):
        x = ErrorMail.subject % {'name': 'task_name',
                                 'id': uuid(),
                                 'exc': 'FOOBARBAZ',
                                 'hostname': 'lana'}
        self.assertTrue(x)

    def test_error_mail_disabled(self):
        task = Mock()
        x = ErrorMail(task)
        x.should_send = Mock()
        x.should_send.return_value = False
        x.send(Mock(), Mock())
        self.assertFalse(task.app.mail_admins.called)


class test_defaults(AppCase):

    def test_strtobool(self):
        for s in ('false', 'no', '0'):
            self.assertFalse(defaults.strtobool(s))
        for s in ('true', 'yes', '1'):
            self.assertTrue(defaults.strtobool(s))
        with self.assertRaises(TypeError):
            defaults.strtobool('unsure')


class test_debugging_utils(AppCase):

    def test_enable_disable_trace(self):
        try:
            _app.enable_trace()
            self.assertEqual(_app.app_or_default, _app._app_or_default_trace)
            _app.disable_trace()
            self.assertEqual(_app.app_or_default, _app._app_or_default)
        finally:
            _app.disable_trace()


class test_pyimplementation(AppCase):

    def test_platform_python_implementation(self):
        with platform_pyimp(lambda: 'Xython'):
            self.assertEqual(pyimplementation(), 'Xython')

    def test_platform_jython(self):
        with platform_pyimp():
            with sys_platform('java 1.6.51'):
                self.assertIn('Jython', pyimplementation())

    def test_platform_pypy(self):
        with platform_pyimp():
            with sys_platform('darwin'):
                with pypy_version((1, 4, 3)):
                    self.assertIn('PyPy', pyimplementation())
                with pypy_version((1, 4, 3, 'a4')):
                    self.assertIn('PyPy', pyimplementation())

    def test_platform_fallback(self):
        with platform_pyimp():
            with sys_platform('darwin'):
                with pypy_version():
                    self.assertEqual('CPython', pyimplementation())


class test_shared_task(AppCase):

    def test_registers_to_all_apps(self):
        with self.Celery('xproj', set_as_current=True) as xproj:
            xproj.finalize()

            @shared_task
            def foo():
                return 42

            @shared_task()
            def bar():
                return 84

            self.assertIs(foo.app, xproj)
            self.assertIs(bar.app, xproj)
            self.assertTrue(foo._get_current_object())

            with self.Celery('yproj', set_as_current=True) as yproj:
                self.assertIs(foo.app, yproj)
                self.assertIs(bar.app, yproj)

                @shared_task()
                def baz():
                    return 168

                self.assertIs(baz.app, yproj)
