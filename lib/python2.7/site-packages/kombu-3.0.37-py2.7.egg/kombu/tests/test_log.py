from __future__ import absolute_import

import logging
import sys

from kombu.log import (
    NullHandler,
    get_logger,
    get_loglevel,
    safeify_format,
    Log,
    LogMixin,
    setup_logging,
)

from .case import Case, Mock, patch


class test_NullHandler(Case):

    def test_emit(self):
        h = NullHandler()
        h.emit('record')


class test_get_logger(Case):

    def test_when_string(self):
        l = get_logger('foo')

        self.assertIs(l, logging.getLogger('foo'))
        h1 = l.handlers[0]
        self.assertIsInstance(h1, NullHandler)

    def test_when_logger(self):
        l = get_logger(logging.getLogger('foo'))
        h1 = l.handlers[0]
        self.assertIsInstance(h1, NullHandler)

    def test_with_custom_handler(self):
        l = logging.getLogger('bar')
        handler = NullHandler()
        l.addHandler(handler)

        l = get_logger('bar')
        self.assertIs(l.handlers[0], handler)

    def test_get_loglevel(self):
        self.assertEqual(get_loglevel('DEBUG'), logging.DEBUG)
        self.assertEqual(get_loglevel('ERROR'), logging.ERROR)
        self.assertEqual(get_loglevel(logging.INFO), logging.INFO)


class test_safe_format(Case):

    def test_formatting(self):
        fmt = 'The %r jumped %x over the %s'
        args = ['frog', 'foo', 'elephant']

        res = list(safeify_format(fmt, args))
        self.assertListEqual(res, ["'frog'", 'foo', 'elephant'])


class test_LogMixin(Case):

    def setUp(self):
        self.log = Log('Log', Mock())
        self.logger = self.log.logger

    def test_debug(self):
        self.log.debug('debug')
        self.logger.log.assert_called_with(logging.DEBUG, 'Log - debug')

    def test_info(self):
        self.log.info('info')
        self.logger.log.assert_called_with(logging.INFO, 'Log - info')

    def test_warning(self):
        self.log.warn('warning')
        self.logger.log.assert_called_with(logging.WARN, 'Log - warning')

    def test_error(self):
        self.log.error('error', exc_info='exc')
        self.logger.log.assert_called_with(
            logging.ERROR, 'Log - error', exc_info='exc',
        )

    def test_critical(self):
        self.log.critical('crit', exc_info='exc')
        self.logger.log.assert_called_with(
            logging.CRITICAL, 'Log - crit', exc_info='exc',
        )

    def test_error_when_DISABLE_TRACEBACKS(self):
        from kombu import log
        log.DISABLE_TRACEBACKS = True
        try:
            self.log.error('error')
            self.logger.log.assert_called_with(logging.ERROR, 'Log - error')
        finally:
            log.DISABLE_TRACEBACKS = False

    def test_get_loglevel(self):
        self.assertEqual(self.log.get_loglevel('DEBUG'), logging.DEBUG)
        self.assertEqual(self.log.get_loglevel('ERROR'), logging.ERROR)
        self.assertEqual(self.log.get_loglevel(logging.INFO), logging.INFO)

    def test_is_enabled_for(self):
        self.logger.isEnabledFor.return_value = True
        self.assertTrue(self.log.is_enabled_for('DEBUG'))
        self.logger.isEnabledFor.assert_called_with(logging.DEBUG)

    def test_LogMixin_get_logger(self):
        self.assertIs(LogMixin().get_logger(),
                      logging.getLogger('LogMixin'))

    def test_Log_get_logger(self):
        self.assertIs(Log('test_Log').get_logger(),
                      logging.getLogger('test_Log'))

    def test_log_when_not_enabled(self):
        self.logger.isEnabledFor.return_value = False
        self.log.debug('debug')
        self.assertFalse(self.logger.log.called)

    def test_log_with_format(self):
        self.log.debug('Host %r removed', 'example.com')
        self.logger.log.assert_called_with(
            logging.DEBUG, 'Log - Host %s removed', "'example.com'",
        )


class test_setup_logging(Case):

    @patch('logging.getLogger')
    def test_set_up_default_values(self, getLogger):
        logger = logging.getLogger.return_value = Mock()
        logger.handlers = []
        setup_logging()

        logger.setLevel.assert_called_with(logging.ERROR)
        self.assertTrue(logger.addHandler.called)
        ah_args, _ = logger.addHandler.call_args
        handler = ah_args[0]
        self.assertIsInstance(handler, logging.StreamHandler)
        self.assertIs(handler.stream, sys.__stderr__)

    @patch('logging.getLogger')
    @patch('kombu.log.WatchedFileHandler')
    def test_setup_custom_values(self, getLogger, WatchedFileHandler):
        logger = logging.getLogger.return_value = Mock()
        logger.handlers = []
        setup_logging(loglevel=logging.DEBUG, logfile='/var/logfile')

        logger.setLevel.assert_called_with(logging.DEBUG)
        self.assertTrue(logger.addHandler.called)
        self.assertTrue(WatchedFileHandler.called)

    @patch('logging.getLogger')
    def test_logger_already_setup(self, getLogger):
        logger = logging.getLogger.return_value = Mock()
        logger.handlers = [Mock()]
        setup_logging()

        self.assertFalse(logger.setLevel.called)
