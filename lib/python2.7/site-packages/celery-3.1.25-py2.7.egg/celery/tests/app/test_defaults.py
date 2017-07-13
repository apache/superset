from __future__ import absolute_import

import sys

from importlib import import_module

from celery.app.defaults import NAMESPACES

from celery.tests.case import (
    AppCase, Mock, patch, pypy_version, sys_platform,
)


class test_defaults(AppCase):

    def setup(self):
        self._prev = sys.modules.pop('celery.app.defaults', None)

    def teardown(self):
        if self._prev:
            sys.modules['celery.app.defaults'] = self._prev

    def test_option_repr(self):
        self.assertTrue(repr(NAMESPACES['BROKER']['URL']))

    def test_any(self):
        val = object()
        self.assertIs(self.defaults.Option.typemap['any'](val), val)

    def test_default_pool_pypy_14(self):
        with sys_platform('darwin'):
            with pypy_version((1, 4, 0)):
                self.assertEqual(self.defaults.DEFAULT_POOL, 'solo')

    def test_default_pool_pypy_15(self):
        with sys_platform('darwin'):
            with pypy_version((1, 5, 0)):
                self.assertEqual(self.defaults.DEFAULT_POOL, 'prefork')

    def test_deprecated(self):
        source = Mock()
        source.CELERYD_LOG_LEVEL = 2
        with patch('celery.utils.warn_deprecated') as warn:
            self.defaults.find_deprecated_settings(source)
            self.assertTrue(warn.called)

    def test_default_pool_jython(self):
        with sys_platform('java 1.6.51'):
            self.assertEqual(self.defaults.DEFAULT_POOL, 'threads')

    def test_find(self):
        find = self.defaults.find

        self.assertEqual(find('server_email')[2].default, 'celery@localhost')
        self.assertEqual(find('default_queue')[2].default, 'celery')
        self.assertEqual(find('celery_default_exchange')[2], 'celery')

    @property
    def defaults(self):
        return import_module('celery.app.defaults')
