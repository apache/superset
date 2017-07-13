from __future__ import absolute_import

import logging
import sys

from collections import defaultdict

from celery import beat
from celery import platforms
from celery.bin import beat as beat_bin
from celery.apps import beat as beatapp

from celery.tests.case import AppCase, Mock, patch, restore_logging
from kombu.tests.case import redirect_stdouts


class MockedShelveModule(object):
    shelves = defaultdict(lambda: {})

    def open(self, filename, *args, **kwargs):
        return self.shelves[filename]
mocked_shelve = MockedShelveModule()


class MockService(beat.Service):
    started = False
    in_sync = False
    persistence = mocked_shelve

    def start(self):
        self.__class__.started = True

    def sync(self):
        self.__class__.in_sync = True


class MockBeat(beatapp.Beat):
    running = False

    def run(self):
        MockBeat.running = True


class MockBeat2(beatapp.Beat):
    Service = MockService

    def install_sync_handler(self, b):
        pass


class MockBeat3(beatapp.Beat):
    Service = MockService

    def install_sync_handler(self, b):
        raise TypeError('xxx')


class test_Beat(AppCase):

    def test_loglevel_string(self):
        b = beatapp.Beat(app=self.app, loglevel='DEBUG',
                         redirect_stdouts=False)
        self.assertEqual(b.loglevel, logging.DEBUG)

        b2 = beatapp.Beat(app=self.app, loglevel=logging.DEBUG,
                          redirect_stdouts=False)
        self.assertEqual(b2.loglevel, logging.DEBUG)

    def test_colorize(self):
        self.app.log.setup = Mock()
        b = beatapp.Beat(app=self.app, no_color=True,
                         redirect_stdouts=False)
        b.setup_logging()
        self.assertTrue(self.app.log.setup.called)
        self.assertEqual(self.app.log.setup.call_args[1]['colorize'], False)

    def test_init_loader(self):
        b = beatapp.Beat(app=self.app, redirect_stdouts=False)
        b.init_loader()

    def test_process_title(self):
        b = beatapp.Beat(app=self.app, redirect_stdouts=False)
        b.set_process_title()

    def test_run(self):
        b = MockBeat2(app=self.app, redirect_stdouts=False)
        MockService.started = False
        b.run()
        self.assertTrue(MockService.started)

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

    def test_install_sync_handler(self):
        b = beatapp.Beat(app=self.app, redirect_stdouts=False)
        clock = MockService(app=self.app)
        MockService.in_sync = False
        handlers = self.psig(b.install_sync_handler, clock)
        with self.assertRaises(SystemExit):
            handlers['SIGINT']('SIGINT', object())
        self.assertTrue(MockService.in_sync)
        MockService.in_sync = False

    def test_setup_logging(self):
        with restore_logging():
            try:
                # py3k
                delattr(sys.stdout, 'logger')
            except AttributeError:
                pass
            b = beatapp.Beat(app=self.app, redirect_stdouts=False)
            b.redirect_stdouts = False
            b.app.log.already_setup = False
            b.setup_logging()
            with self.assertRaises(AttributeError):
                sys.stdout.logger

    @redirect_stdouts
    @patch('celery.apps.beat.logger')
    def test_logs_errors(self, logger, stdout, stderr):
        with restore_logging():
            b = MockBeat3(
                app=self.app, redirect_stdouts=False, socket_timeout=None,
            )
            b.start_scheduler()
            self.assertTrue(logger.critical.called)

    @redirect_stdouts
    @patch('celery.platforms.create_pidlock')
    def test_use_pidfile(self, create_pidlock, stdout, stderr):
        b = MockBeat2(app=self.app, pidfile='pidfilelockfilepid',
                      socket_timeout=None, redirect_stdouts=False)
        b.start_scheduler()
        self.assertTrue(create_pidlock.called)


class MockDaemonContext(object):
    opened = False
    closed = False

    def __init__(self, *args, **kwargs):
        pass

    def open(self):
        self.__class__.opened = True
        return self
    __enter__ = open

    def close(self, *args):
        self.__class__.closed = True
    __exit__ = close


class test_div(AppCase):

    def setup(self):
        self.prev, beatapp.Beat = beatapp.Beat, MockBeat
        self.ctx, beat_bin.detached = (
            beat_bin.detached, MockDaemonContext,
        )

    def teardown(self):
        beatapp.Beat = self.prev

    def test_main(self):
        sys.argv = [sys.argv[0], '-s', 'foo']
        try:
            beat_bin.main(app=self.app)
            self.assertTrue(MockBeat.running)
        finally:
            MockBeat.running = False

    def test_detach(self):
        cmd = beat_bin.beat()
        cmd.app = self.app
        cmd.run(detach=True)
        self.assertTrue(MockDaemonContext.opened)
        self.assertTrue(MockDaemonContext.closed)

    def test_parse_options(self):
        cmd = beat_bin.beat()
        cmd.app = self.app
        options, args = cmd.parse_options('celery beat', ['-s', 'foo'])
        self.assertEqual(options.schedule, 'foo')
