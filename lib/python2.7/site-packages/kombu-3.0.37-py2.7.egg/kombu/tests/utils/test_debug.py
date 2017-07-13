from __future__ import absolute_import

import logging

from kombu.utils.debug import (
    setup_logging,
    Logwrapped,
)
from kombu.tests.case import Case, Mock, patch


class test_setup_logging(Case):

    def test_adds_handlers_sets_level(self):
        with patch('kombu.utils.debug.get_logger') as get_logger:
            logger = get_logger.return_value = Mock()
            setup_logging(loggers=['kombu.test'])

            get_logger.assert_called_with('kombu.test')

            self.assertTrue(logger.addHandler.called)
            logger.setLevel.assert_called_with(logging.DEBUG)


class test_Logwrapped(Case):

    def test_wraps(self):
        with patch('kombu.utils.debug.get_logger') as get_logger:
            logger = get_logger.return_value = Mock()

            W = Logwrapped(Mock(), 'kombu.test')
            get_logger.assert_called_with('kombu.test')
            self.assertIsNotNone(W.instance)
            self.assertIs(W.logger, logger)

            W.instance.__repr__ = lambda s: 'foo'
            self.assertEqual(repr(W), 'foo')
            W.instance.some_attr = 303
            self.assertEqual(W.some_attr, 303)

            W.instance.some_method.__name__ = 'some_method'
            W.some_method(1, 2, kw=1)
            W.instance.some_method.assert_called_with(1, 2, kw=1)

            W.some_method()
            W.instance.some_method.assert_called_with()

            W.some_method(kw=1)
            W.instance.some_method.assert_called_with(kw=1)

            W.ident = 'ident'
            W.some_method(kw=1)
            self.assertTrue(logger.debug.called)
            self.assertIn('ident', logger.debug.call_args[0][0])

            self.assertEqual(dir(W), dir(W.instance))
