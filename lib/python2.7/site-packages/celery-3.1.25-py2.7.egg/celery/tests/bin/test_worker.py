from __future__ import absolute_import

import logging
import os
import sys

from billiard import current_process
from kombu import Exchange, Queue

from celery import platforms
from celery import signals
from celery.app import trace
from celery.apps import worker as cd
from celery.bin.worker import worker, main as worker_main
from celery.exceptions import (
    ImproperlyConfigured, WorkerShutdown, WorkerTerminate,
)
from celery.utils.log import ensure_process_aware_logger
from celery.worker import state

from celery.tests.case import (
    AppCase,
    Mock,
    SkipTest,
    disable_stdouts,
    patch,
    skip_if_pypy,
    skip_if_jython,
)

ensure_process_aware_logger()


class WorkerAppCase(AppCase):

    def tearDown(self):
        super(WorkerAppCase, self).tearDown()
        trace.reset_worker_optimizations()


class Worker(cd.Worker):
    redirect_stdouts = False

    def start(self, *args, **kwargs):
        self.on_start()


class test_Worker(WorkerAppCase):
    Worker = Worker

    @disable_stdouts
    def test_queues_string(self):
        w = self.app.Worker()
        w.setup_queues('foo,bar,baz')
        self.assertTrue('foo' in self.app.amqp.queues)

    @disable_stdouts
    def test_cpu_count(self):
        with patch('celery.worker.cpu_count') as cpu_count:
            cpu_count.side_effect = NotImplementedError()
            w = self.app.Worker(concurrency=None)
            self.assertEqual(w.concurrency, 2)
        w = self.app.Worker(concurrency=5)
        self.assertEqual(w.concurrency, 5)

    @disable_stdouts
    def test_windows_B_option(self):
        self.app.IS_WINDOWS = True
        with self.assertRaises(SystemExit):
            worker(app=self.app).run(beat=True)

    def test_setup_concurrency_very_early(self):
        x = worker()
        x.run = Mock()
        with self.assertRaises(ImportError):
            x.execute_from_commandline(['worker', '-P', 'xyzybox'])

    def test_run_from_argv_basic(self):
        x = worker(app=self.app)
        x.run = Mock()
        x.maybe_detach = Mock()

        def run(*args, **kwargs):
            pass
        x.run = run
        x.run_from_argv('celery', [])
        self.assertTrue(x.maybe_detach.called)

    def test_maybe_detach(self):
        x = worker(app=self.app)
        with patch('celery.bin.worker.detached_celeryd') as detached:
            x.maybe_detach([])
            self.assertFalse(detached.called)
            with self.assertRaises(SystemExit):
                x.maybe_detach(['--detach'])
            self.assertTrue(detached.called)

    @disable_stdouts
    def test_invalid_loglevel_gives_error(self):
        x = worker(app=self.app)
        with self.assertRaises(SystemExit):
            x.run(loglevel='GRIM_REAPER')

    def test_no_loglevel(self):
        self.app.Worker = Mock()
        worker(app=self.app).run(loglevel=None)

    def test_tasklist(self):
        worker = self.app.Worker()
        self.assertTrue(worker.app.tasks)
        self.assertTrue(worker.app.finalized)
        self.assertTrue(worker.tasklist(include_builtins=True))
        worker.tasklist(include_builtins=False)

    def test_extra_info(self):
        worker = self.app.Worker()
        worker.loglevel = logging.WARNING
        self.assertFalse(worker.extra_info())
        worker.loglevel = logging.INFO
        self.assertTrue(worker.extra_info())

    @disable_stdouts
    def test_loglevel_string(self):
        worker = self.Worker(app=self.app, loglevel='INFO')
        self.assertEqual(worker.loglevel, logging.INFO)

    @disable_stdouts
    def test_run_worker(self):
        handlers = {}

        class Signals(platforms.Signals):

            def __setitem__(self, sig, handler):
                handlers[sig] = handler

        p = platforms.signals
        platforms.signals = Signals()
        try:
            w = self.Worker(app=self.app)
            w._isatty = False
            w.on_start()
            for sig in 'SIGINT', 'SIGHUP', 'SIGTERM':
                self.assertIn(sig, handlers)

            handlers.clear()
            w = self.Worker(app=self.app)
            w._isatty = True
            w.on_start()
            for sig in 'SIGINT', 'SIGTERM':
                self.assertIn(sig, handlers)
            self.assertNotIn('SIGHUP', handlers)
        finally:
            platforms.signals = p

    @disable_stdouts
    def test_startup_info(self):
        worker = self.Worker(app=self.app)
        worker.on_start()
        self.assertTrue(worker.startup_info())
        worker.loglevel = logging.DEBUG
        self.assertTrue(worker.startup_info())
        worker.loglevel = logging.INFO
        self.assertTrue(worker.startup_info())
        worker.autoscale = 13, 10
        self.assertTrue(worker.startup_info())

        prev_loader = self.app.loader
        worker = self.Worker(app=self.app, queues='foo,bar,baz,xuzzy,do,re,mi')
        self.app.loader = Mock()
        self.app.loader.__module__ = 'acme.baked_beans'
        self.assertTrue(worker.startup_info())

        self.app.loader = Mock()
        self.app.loader.__module__ = 'celery.loaders.foo'
        self.assertTrue(worker.startup_info())

        from celery.loaders.app import AppLoader
        self.app.loader = AppLoader(app=self.app)
        self.assertTrue(worker.startup_info())

        self.app.loader = prev_loader
        worker.send_events = True
        self.assertTrue(worker.startup_info())

        # test when there are too few output lines
        # to draft the ascii art onto
        prev, cd.ARTLINES = cd.ARTLINES, ['the quick brown fox']
        try:
            self.assertTrue(worker.startup_info())
        finally:
            cd.ARTLINES = prev

    @disable_stdouts
    def test_run(self):
        self.Worker(app=self.app).on_start()
        self.Worker(app=self.app, purge=True).on_start()
        worker = self.Worker(app=self.app)
        worker.on_start()

    @disable_stdouts
    def test_purge_messages(self):
        self.Worker(app=self.app).purge_messages()

    @disable_stdouts
    def test_init_queues(self):
        app = self.app
        c = app.conf
        app.amqp.queues = app.amqp.Queues({
            'celery': {'exchange': 'celery',
                       'routing_key': 'celery'},
            'video': {'exchange': 'video',
                      'routing_key': 'video'},
        })
        worker = self.Worker(app=self.app)
        worker.setup_queues(['video'])
        self.assertIn('video', app.amqp.queues)
        self.assertIn('video', app.amqp.queues.consume_from)
        self.assertIn('celery', app.amqp.queues)
        self.assertNotIn('celery', app.amqp.queues.consume_from)

        c.CELERY_CREATE_MISSING_QUEUES = False
        del(app.amqp.queues)
        with self.assertRaises(ImproperlyConfigured):
            self.Worker(app=self.app).setup_queues(['image'])
        del(app.amqp.queues)
        c.CELERY_CREATE_MISSING_QUEUES = True
        worker = self.Worker(app=self.app)
        worker.setup_queues(['image'])
        self.assertIn('image', app.amqp.queues.consume_from)
        self.assertEqual(
            Queue('image', Exchange('image'), routing_key='image'),
            app.amqp.queues['image'],
        )

    @disable_stdouts
    def test_autoscale_argument(self):
        worker1 = self.Worker(app=self.app, autoscale='10,3')
        self.assertListEqual(worker1.autoscale, [10, 3])
        worker2 = self.Worker(app=self.app, autoscale='10')
        self.assertListEqual(worker2.autoscale, [10, 0])
        self.assert_no_logging_side_effect()

    def test_include_argument(self):
        worker1 = self.Worker(app=self.app, include='os')
        self.assertListEqual(worker1.include, ['os'])
        worker2 = self.Worker(app=self.app,
                              include='os,sys')
        self.assertListEqual(worker2.include, ['os', 'sys'])
        self.Worker(app=self.app, include=['os', 'sys'])

    @disable_stdouts
    def test_unknown_loglevel(self):
        with self.assertRaises(SystemExit):
            worker(app=self.app).run(loglevel='ALIEN')
        worker1 = self.Worker(app=self.app, loglevel=0xFFFF)
        self.assertEqual(worker1.loglevel, 0xFFFF)

    @disable_stdouts
    @patch('os._exit')
    def test_warns_if_running_as_privileged_user(self, _exit):
        app = self.app
        if app.IS_WINDOWS:
            raise SkipTest('Not applicable on Windows')

        with patch('os.getuid') as getuid:
            getuid.return_value = 0
            self.app.conf.CELERY_ACCEPT_CONTENT = ['pickle']
            worker = self.Worker(app=self.app)
            worker.on_start()
            _exit.assert_called_with(1)
            from celery import platforms
            platforms.C_FORCE_ROOT = True
            try:
                with self.assertWarnsRegex(
                        RuntimeWarning,
                        r'absolutely not recommended'):
                    worker = self.Worker(app=self.app)
                    worker.on_start()
            finally:
                platforms.C_FORCE_ROOT = False
            self.app.conf.CELERY_ACCEPT_CONTENT = ['json']
            with self.assertWarnsRegex(
                    RuntimeWarning,
                    r'absolutely not recommended'):
                worker = self.Worker(app=self.app)
                worker.on_start()

    @disable_stdouts
    def test_redirect_stdouts(self):
        self.Worker(app=self.app, redirect_stdouts=False)
        with self.assertRaises(AttributeError):
            sys.stdout.logger

    @disable_stdouts
    def test_on_start_custom_logging(self):
        self.app.log.redirect_stdouts = Mock()
        worker = self.Worker(app=self.app, redirect_stoutds=True)
        worker._custom_logging = True
        worker.on_start()
        self.assertFalse(self.app.log.redirect_stdouts.called)

    def test_setup_logging_no_color(self):
        worker = self.Worker(
            app=self.app, redirect_stdouts=False, no_color=True,
        )
        prev, self.app.log.setup = self.app.log.setup, Mock()
        try:
            worker.setup_logging()
            self.assertFalse(self.app.log.setup.call_args[1]['colorize'])
        finally:
            self.app.log.setup = prev

    @disable_stdouts
    def test_startup_info_pool_is_str(self):
        worker = self.Worker(app=self.app, redirect_stdouts=False)
        worker.pool_cls = 'foo'
        worker.startup_info()

    def test_redirect_stdouts_already_handled(self):
        logging_setup = [False]

        @signals.setup_logging.connect
        def on_logging_setup(**kwargs):
            logging_setup[0] = True

        try:
            worker = self.Worker(app=self.app, redirect_stdouts=False)
            worker.app.log.already_setup = False
            worker.setup_logging()
            self.assertTrue(logging_setup[0])
            with self.assertRaises(AttributeError):
                sys.stdout.logger
        finally:
            signals.setup_logging.disconnect(on_logging_setup)

    @disable_stdouts
    def test_platform_tweaks_osx(self):

        class OSXWorker(Worker):
            proxy_workaround_installed = False

            def osx_proxy_detection_workaround(self):
                self.proxy_workaround_installed = True

        worker = OSXWorker(app=self.app, redirect_stdouts=False)

        def install_HUP_nosupport(controller):
            controller.hup_not_supported_installed = True

        class Controller(object):
            pass

        prev = cd.install_HUP_not_supported_handler
        cd.install_HUP_not_supported_handler = install_HUP_nosupport
        try:
            worker.app.IS_OSX = True
            controller = Controller()
            worker.install_platform_tweaks(controller)
            self.assertTrue(controller.hup_not_supported_installed)
            self.assertTrue(worker.proxy_workaround_installed)
        finally:
            cd.install_HUP_not_supported_handler = prev

    @disable_stdouts
    def test_general_platform_tweaks(self):

        restart_worker_handler_installed = [False]

        def install_worker_restart_handler(worker):
            restart_worker_handler_installed[0] = True

        class Controller(object):
            pass

        prev = cd.install_worker_restart_handler
        cd.install_worker_restart_handler = install_worker_restart_handler
        try:
            worker = self.Worker(app=self.app)
            worker.app.IS_OSX = False
            worker.install_platform_tweaks(Controller())
            self.assertTrue(restart_worker_handler_installed[0])
        finally:
            cd.install_worker_restart_handler = prev

    @disable_stdouts
    def test_on_consumer_ready(self):
        worker_ready_sent = [False]

        @signals.worker_ready.connect
        def on_worker_ready(**kwargs):
            worker_ready_sent[0] = True

        self.Worker(app=self.app).on_consumer_ready(object())
        self.assertTrue(worker_ready_sent[0])


class test_funs(WorkerAppCase):

    def test_active_thread_count(self):
        self.assertTrue(cd.active_thread_count())

    @disable_stdouts
    def test_set_process_status(self):
        try:
            __import__('setproctitle')
        except ImportError:
            raise SkipTest('setproctitle not installed')
        worker = Worker(app=self.app, hostname='xyzza')
        prev1, sys.argv = sys.argv, ['Arg0']
        try:
            st = worker.set_process_status('Running')
            self.assertIn('celeryd', st)
            self.assertIn('xyzza', st)
            self.assertIn('Running', st)
            prev2, sys.argv = sys.argv, ['Arg0', 'Arg1']
            try:
                st = worker.set_process_status('Running')
                self.assertIn('celeryd', st)
                self.assertIn('xyzza', st)
                self.assertIn('Running', st)
                self.assertIn('Arg1', st)
            finally:
                sys.argv = prev2
        finally:
            sys.argv = prev1

    @disable_stdouts
    def test_parse_options(self):
        cmd = worker()
        cmd.app = self.app
        opts, args = cmd.parse_options('worker', ['--concurrency=512',
                                       '--heartbeat-interval=10'])
        self.assertEqual(opts.concurrency, 512)
        self.assertEqual(opts.heartbeat_interval, 10)

    @disable_stdouts
    def test_main(self):
        p, cd.Worker = cd.Worker, Worker
        s, sys.argv = sys.argv, ['worker', '--discard']
        try:
            worker_main(app=self.app)
        finally:
            cd.Worker = p
            sys.argv = s


class test_signal_handlers(WorkerAppCase):

    class _Worker(object):
        stopped = False
        terminated = False

        def stop(self, in_sighandler=False):
            self.stopped = True

        def terminate(self, in_sighandler=False):
            self.terminated = True

    def psig(self, fun, *args, **kwargs):
        handlers = {}

        class Signals(platforms.Signals):
            def __setitem__(self, sig, handler):
                handlers[sig] = handler

        p, platforms.signals = platforms.signals, Signals()
        try:
            fun(*args, **kwargs)
            return handlers
        finally:
            platforms.signals = p

    @disable_stdouts
    def test_worker_int_handler(self):
        worker = self._Worker()
        handlers = self.psig(cd.install_worker_int_handler, worker)
        next_handlers = {}
        state.should_stop = False
        state.should_terminate = False

        class Signals(platforms.Signals):

            def __setitem__(self, sig, handler):
                next_handlers[sig] = handler

        with patch('celery.apps.worker.active_thread_count') as c:
            c.return_value = 3
            p, platforms.signals = platforms.signals, Signals()
            try:
                handlers['SIGINT']('SIGINT', object())
                self.assertTrue(state.should_stop)
            finally:
                platforms.signals = p
                state.should_stop = False

            try:
                next_handlers['SIGINT']('SIGINT', object())
                self.assertTrue(state.should_terminate)
            finally:
                state.should_terminate = False

        with patch('celery.apps.worker.active_thread_count') as c:
            c.return_value = 1
            p, platforms.signals = platforms.signals, Signals()
            try:
                with self.assertRaises(WorkerShutdown):
                    handlers['SIGINT']('SIGINT', object())
            finally:
                platforms.signals = p

            with self.assertRaises(WorkerTerminate):
                next_handlers['SIGINT']('SIGINT', object())

    @disable_stdouts
    def test_worker_int_handler_only_stop_MainProcess(self):
        try:
            import _multiprocessing  # noqa
        except ImportError:
            raise SkipTest('only relevant for multiprocessing')
        process = current_process()
        name, process.name = process.name, 'OtherProcess'
        with patch('celery.apps.worker.active_thread_count') as c:
            c.return_value = 3
            try:
                worker = self._Worker()
                handlers = self.psig(cd.install_worker_int_handler, worker)
                handlers['SIGINT']('SIGINT', object())
                self.assertTrue(state.should_stop)
            finally:
                process.name = name
                state.should_stop = False

        with patch('celery.apps.worker.active_thread_count') as c:
            c.return_value = 1
            try:
                worker = self._Worker()
                handlers = self.psig(cd.install_worker_int_handler, worker)
                with self.assertRaises(WorkerShutdown):
                    handlers['SIGINT']('SIGINT', object())
            finally:
                process.name = name
                state.should_stop = False

    @disable_stdouts
    def test_install_HUP_not_supported_handler(self):
        worker = self._Worker()
        handlers = self.psig(cd.install_HUP_not_supported_handler, worker)
        handlers['SIGHUP']('SIGHUP', object())

    @disable_stdouts
    def test_worker_term_hard_handler_only_stop_MainProcess(self):
        try:
            import _multiprocessing  # noqa
        except ImportError:
            raise SkipTest('only relevant for multiprocessing')
        process = current_process()
        name, process.name = process.name, 'OtherProcess'
        try:
            with patch('celery.apps.worker.active_thread_count') as c:
                c.return_value = 3
                worker = self._Worker()
                handlers = self.psig(
                    cd.install_worker_term_hard_handler, worker)
                try:
                    handlers['SIGQUIT']('SIGQUIT', object())
                    self.assertTrue(state.should_terminate)
                finally:
                    state.should_terminate = False
            with patch('celery.apps.worker.active_thread_count') as c:
                c.return_value = 1
                worker = self._Worker()
                handlers = self.psig(
                    cd.install_worker_term_hard_handler, worker)
                with self.assertRaises(WorkerTerminate):
                    handlers['SIGQUIT']('SIGQUIT', object())
        finally:
            process.name = name

    @disable_stdouts
    def test_worker_term_handler_when_threads(self):
        with patch('celery.apps.worker.active_thread_count') as c:
            c.return_value = 3
            worker = self._Worker()
            handlers = self.psig(cd.install_worker_term_handler, worker)
            try:
                handlers['SIGTERM']('SIGTERM', object())
                self.assertTrue(state.should_stop)
            finally:
                state.should_stop = False

    @disable_stdouts
    def test_worker_term_handler_when_single_thread(self):
        with patch('celery.apps.worker.active_thread_count') as c:
            c.return_value = 1
            worker = self._Worker()
            handlers = self.psig(cd.install_worker_term_handler, worker)
            try:
                with self.assertRaises(WorkerShutdown):
                    handlers['SIGTERM']('SIGTERM', object())
            finally:
                state.should_stop = False

    @patch('sys.__stderr__')
    @skip_if_pypy
    @skip_if_jython
    def test_worker_cry_handler(self, stderr):
        handlers = self.psig(cd.install_cry_handler)
        self.assertIsNone(handlers['SIGUSR1']('SIGUSR1', object()))
        self.assertTrue(stderr.write.called)

    @disable_stdouts
    def test_worker_term_handler_only_stop_MainProcess(self):
        try:
            import _multiprocessing  # noqa
        except ImportError:
            raise SkipTest('only relevant for multiprocessing')
        process = current_process()
        name, process.name = process.name, 'OtherProcess'
        try:
            with patch('celery.apps.worker.active_thread_count') as c:
                c.return_value = 3
                worker = self._Worker()
                handlers = self.psig(cd.install_worker_term_handler, worker)
                handlers['SIGTERM']('SIGTERM', object())
                self.assertTrue(state.should_stop)
            with patch('celery.apps.worker.active_thread_count') as c:
                c.return_value = 1
                worker = self._Worker()
                handlers = self.psig(cd.install_worker_term_handler, worker)
                with self.assertRaises(WorkerShutdown):
                    handlers['SIGTERM']('SIGTERM', object())
        finally:
            process.name = name
            state.should_stop = False

    @disable_stdouts
    @patch('celery.platforms.close_open_fds')
    @patch('atexit.register')
    @patch('os.close')
    def test_worker_restart_handler(self, _close, register, close_open):
        if getattr(os, 'execv', None) is None:
            raise SkipTest('platform does not have excv')
        argv = []

        def _execv(*args):
            argv.extend(args)

        execv, os.execv = os.execv, _execv
        try:
            worker = self._Worker()
            handlers = self.psig(cd.install_worker_restart_handler, worker)
            handlers['SIGHUP']('SIGHUP', object())
            self.assertTrue(state.should_stop)
            self.assertTrue(register.called)
            callback = register.call_args[0][0]
            callback()
            self.assertTrue(argv)
        finally:
            os.execv = execv
            state.should_stop = False

    @disable_stdouts
    def test_worker_term_hard_handler_when_threaded(self):
        with patch('celery.apps.worker.active_thread_count') as c:
            c.return_value = 3
            worker = self._Worker()
            handlers = self.psig(cd.install_worker_term_hard_handler, worker)
            try:
                handlers['SIGQUIT']('SIGQUIT', object())
                self.assertTrue(state.should_terminate)
            finally:
                state.should_terminate = False

    @disable_stdouts
    def test_worker_term_hard_handler_when_single_threaded(self):
        with patch('celery.apps.worker.active_thread_count') as c:
            c.return_value = 1
            worker = self._Worker()
            handlers = self.psig(cd.install_worker_term_hard_handler, worker)
            with self.assertRaises(WorkerTerminate):
                handlers['SIGQUIT']('SIGQUIT', object())
