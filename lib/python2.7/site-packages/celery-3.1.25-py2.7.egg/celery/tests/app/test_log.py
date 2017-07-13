from __future__ import absolute_import

import sys
import logging

from collections import defaultdict
from io import StringIO
from tempfile import mktemp

from celery import signals
from celery.app.log import TaskFormatter
from celery.utils.log import LoggingProxy
from celery.utils import uuid
from celery.utils.log import (
    get_logger,
    ColorFormatter,
    logger as base_logger,
    get_task_logger,
    task_logger,
    in_sighandler,
    logger_isa,
    ensure_process_aware_logger,
)
from celery.tests.case import (
    AppCase, Mock, SkipTest,
    get_handlers, override_stdouts, patch, wrap_logger, restore_logging,
)


class test_TaskFormatter(AppCase):

    def test_no_task(self):
        class Record(object):
            msg = 'hello world'
            levelname = 'info'
            exc_text = exc_info = None
            stack_info = None

            def getMessage(self):
                return self.msg
        record = Record()
        x = TaskFormatter()
        x.format(record)
        self.assertEqual(record.task_name, '???')
        self.assertEqual(record.task_id, '???')


class test_logger_isa(AppCase):

    def test_isa(self):
        x = get_task_logger('Z1george')
        self.assertTrue(logger_isa(x, task_logger))
        prev_x, x.parent = x.parent, None
        try:
            self.assertFalse(logger_isa(x, task_logger))
        finally:
            x.parent = prev_x

        y = get_task_logger('Z1elaine')
        y.parent = x
        self.assertTrue(logger_isa(y, task_logger))
        self.assertTrue(logger_isa(y, x))
        self.assertTrue(logger_isa(y, y))

        z = get_task_logger('Z1jerry')
        z.parent = y
        self.assertTrue(logger_isa(z, task_logger))
        self.assertTrue(logger_isa(z, y))
        self.assertTrue(logger_isa(z, x))
        self.assertTrue(logger_isa(z, z))

    def test_recursive(self):
        x = get_task_logger('X1foo')
        prev, x.parent = x.parent, x
        try:
            with self.assertRaises(RuntimeError):
                logger_isa(x, task_logger)
        finally:
            x.parent = prev

        y = get_task_logger('X2foo')
        z = get_task_logger('X2foo')
        prev_y, y.parent = y.parent, z
        try:
            prev_z, z.parent = z.parent, y
            try:
                with self.assertRaises(RuntimeError):
                    logger_isa(y, task_logger)
            finally:
                z.parent = prev_z
        finally:
            y.parent = prev_y


class test_ColorFormatter(AppCase):

    @patch('celery.utils.log.safe_str')
    @patch('logging.Formatter.formatException')
    def test_formatException_not_string(self, fe, safe_str):
        x = ColorFormatter()
        value = KeyError()
        fe.return_value = value
        self.assertIs(x.formatException(value), value)
        self.assertTrue(fe.called)
        self.assertFalse(safe_str.called)

    @patch('logging.Formatter.formatException')
    @patch('celery.utils.log.safe_str')
    def test_formatException_string(self, safe_str, fe):
        x = ColorFormatter()
        fe.return_value = 'HELLO'
        try:
            raise Exception()
        except Exception:
            self.assertTrue(x.formatException(sys.exc_info()))
        if sys.version_info[0] == 2:
            self.assertTrue(safe_str.called)

    @patch('logging.Formatter.format')
    def test_format_object(self, _format):
        x = ColorFormatter()
        x.use_color = True
        record = Mock()
        record.levelname = 'ERROR'
        record.msg = object()
        self.assertTrue(x.format(record))

    @patch('celery.utils.log.safe_str')
    def test_format_raises(self, safe_str):
        x = ColorFormatter()

        def on_safe_str(s):
            try:
                raise ValueError('foo')
            finally:
                safe_str.side_effect = None
        safe_str.side_effect = on_safe_str

        class Record(object):
            levelname = 'ERROR'
            msg = 'HELLO'
            exc_info = 1
            exc_text = 'error text'
            stack_info = None

            def __str__(self):
                return on_safe_str('')

            def getMessage(self):
                return self.msg

        record = Record()
        safe_str.return_value = record

        msg = x.format(record)
        self.assertIn('<Unrepresentable', msg)
        self.assertEqual(safe_str.call_count, 1)

    @patch('celery.utils.log.safe_str')
    def test_format_raises_no_color(self, safe_str):
        if sys.version_info[0] == 3:
            raise SkipTest('py3k')
        x = ColorFormatter(use_color=False)
        record = Mock()
        record.levelname = 'ERROR'
        record.msg = 'HELLO'
        record.exc_text = 'error text'
        x.format(record)
        self.assertEqual(safe_str.call_count, 1)


class test_default_logger(AppCase):

    def setup(self):
        self.setup_logger = self.app.log.setup_logger
        self.get_logger = lambda n=None: get_logger(n) if n else logging.root
        signals.setup_logging.receivers[:] = []
        self.app.log.already_setup = False

    def test_get_logger_sets_parent(self):
        logger = get_logger('celery.test_get_logger')
        self.assertEqual(logger.parent.name, base_logger.name)

    def test_get_logger_root(self):
        logger = get_logger(base_logger.name)
        self.assertIs(logger.parent, logging.root)

    def test_setup_logging_subsystem_misc(self):
        with restore_logging():
            self.app.log.setup_logging_subsystem(loglevel=None)

    def test_setup_logging_subsystem_misc2(self):
        with restore_logging():
            self.app.conf.CELERYD_HIJACK_ROOT_LOGGER = True
            self.app.log.setup_logging_subsystem()

    def test_get_default_logger(self):
        self.assertTrue(self.app.log.get_default_logger())

    def test_configure_logger(self):
        logger = self.app.log.get_default_logger()
        self.app.log._configure_logger(logger, sys.stderr, None, '', False)
        logger.handlers[:] = []

    def test_setup_logging_subsystem_colorize(self):
        with restore_logging():
            self.app.log.setup_logging_subsystem(colorize=None)
            self.app.log.setup_logging_subsystem(colorize=True)

    def test_setup_logging_subsystem_no_mputil(self):
        from celery.utils import log as logtools
        with restore_logging():
            mputil, logtools.mputil = logtools.mputil, None
            try:
                self.app.log.setup_logging_subsystem()
            finally:
                logtools.mputil = mputil

    def _assertLog(self, logger, logmsg, loglevel=logging.ERROR):

        with wrap_logger(logger, loglevel=loglevel) as sio:
            logger.log(loglevel, logmsg)
            return sio.getvalue().strip()

    def assertDidLogTrue(self, logger, logmsg, reason, loglevel=None):
        val = self._assertLog(logger, logmsg, loglevel=loglevel)
        return self.assertEqual(val, logmsg, reason)

    def assertDidLogFalse(self, logger, logmsg, reason, loglevel=None):
        val = self._assertLog(logger, logmsg, loglevel=loglevel)
        return self.assertFalse(val, reason)

    def test_setup_logger(self):
        with restore_logging():
            logger = self.setup_logger(loglevel=logging.ERROR, logfile=None,
                                       root=False, colorize=True)
            logger.handlers = []
            self.app.log.already_setup = False
            logger = self.setup_logger(loglevel=logging.ERROR, logfile=None,
                                       root=False, colorize=None)
            self.assertIs(
                get_handlers(logger)[0].stream, sys.__stderr__,
                'setup_logger logs to stderr without logfile argument.',
            )

    def test_setup_logger_no_handlers_stream(self):
        with restore_logging():
            l = self.get_logger()
            l.handlers = []

            with override_stdouts() as outs:
                stdout, stderr = outs
                l = self.setup_logger(logfile=sys.stderr,
                                      loglevel=logging.INFO, root=False)
                l.info('The quick brown fox...')
                self.assertIn('The quick brown fox...', stderr.getvalue())

    @patch('os.fstat')
    def test_setup_logger_no_handlers_file(self, *args):
        tempfile = mktemp(suffix='unittest', prefix='celery')
        _open = ('builtins.open' if sys.version_info[0] == 3
                 else '__builtin__.open')
        with patch(_open) as osopen:
            with restore_logging():
                files = defaultdict(StringIO)

                def open_file(filename, *args, **kwargs):
                    f = files[filename]
                    f.fileno = Mock()
                    f.fileno.return_value = 99
                    return f

                osopen.side_effect = open_file
                l = self.get_logger()
                l.handlers = []
                l = self.setup_logger(
                    logfile=tempfile, loglevel=logging.INFO, root=False,
                )
                self.assertIsInstance(
                    get_handlers(l)[0], logging.FileHandler,
                )
                self.assertIn(tempfile, files)

    def test_redirect_stdouts(self):
        with restore_logging():
            logger = self.setup_logger(loglevel=logging.ERROR, logfile=None,
                                       root=False)
            try:
                with wrap_logger(logger) as sio:
                    self.app.log.redirect_stdouts_to_logger(
                        logger, loglevel=logging.ERROR,
                    )
                    logger.error('foo')
                    self.assertIn('foo', sio.getvalue())
                    self.app.log.redirect_stdouts_to_logger(
                        logger, stdout=False, stderr=False,
                    )
            finally:
                sys.stdout, sys.stderr = sys.__stdout__, sys.__stderr__

    def test_logging_proxy(self):
        with restore_logging():
            logger = self.setup_logger(loglevel=logging.ERROR, logfile=None,
                                       root=False)

            with wrap_logger(logger) as sio:
                p = LoggingProxy(logger, loglevel=logging.ERROR)
                p.close()
                p.write('foo')
                self.assertNotIn('foo', sio.getvalue())
                p.closed = False
                p.write('foo')
                self.assertIn('foo', sio.getvalue())
                lines = ['baz', 'xuzzy']
                p.writelines(lines)
                for line in lines:
                    self.assertIn(line, sio.getvalue())
                p.flush()
                p.close()
                self.assertFalse(p.isatty())

                with override_stdouts() as (stdout, stderr):
                    with in_sighandler():
                        p.write('foo')
                        self.assertTrue(stderr.getvalue())

    def test_logging_proxy_recurse_protection(self):
        with restore_logging():
            logger = self.setup_logger(loglevel=logging.ERROR, logfile=None,
                                       root=False)
            p = LoggingProxy(logger, loglevel=logging.ERROR)
            p._thread.recurse_protection = True
            try:
                self.assertIsNone(p.write('FOOFO'))
            finally:
                p._thread.recurse_protection = False


class test_task_logger(test_default_logger):

    def setup(self):
        logger = self.logger = get_logger('celery.task')
        logger.handlers = []
        logging.root.manager.loggerDict.pop(logger.name, None)
        self.uid = uuid()

        @self.app.task(shared=False)
        def test_task():
            pass
        self.get_logger().handlers = []
        self.task = test_task
        from celery._state import _task_stack
        _task_stack.push(test_task)

    def teardown(self):
        from celery._state import _task_stack
        _task_stack.pop()

    def setup_logger(self, *args, **kwargs):
        return self.app.log.setup_task_loggers(*args, **kwargs)

    def get_logger(self, *args, **kwargs):
        return get_task_logger('test_task_logger')


class test_patch_logger_cls(AppCase):

    def test_patches(self):
        ensure_process_aware_logger()
        with in_sighandler():
            logging.getLoggerClass().log(get_logger('test'))


class MockLogger(logging.Logger):
    _records = None

    def __init__(self, *args, **kwargs):
        self._records = []
        logging.Logger.__init__(self, *args, **kwargs)

    def handle(self, record):
        self._records.append(record)

    def isEnabledFor(self, level):
        return True
