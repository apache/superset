from __future__ import absolute_import

from celery import backends
from celery.exceptions import ImproperlyConfigured
from celery.backends.amqp import AMQPBackend
from celery.backends.cache import CacheBackend
from celery.tests.case import AppCase, depends_on_current_app, patch


class test_backends(AppCase):

    def test_get_backend_aliases(self):
        expects = [('amqp://', AMQPBackend),
                   ('cache+memory://', CacheBackend)]

        for url, expect_cls in expects:
            backend, url = backends.get_backend_by_url(url, self.app.loader)
            self.assertIsInstance(
                backend(app=self.app, url=url),
                expect_cls,
            )

    def test_unknown_backend(self):
        with self.assertRaises(ImportError):
            backends.get_backend_cls('fasodaopjeqijwqe', self.app.loader)

    @depends_on_current_app
    def test_default_backend(self):
        self.assertEqual(backends.default_backend, self.app.backend)

    def test_backend_by_url(self, url='redis://localhost/1'):
        from celery.backends.redis import RedisBackend
        backend, url_ = backends.get_backend_by_url(url, self.app.loader)
        self.assertIs(backend, RedisBackend)
        self.assertEqual(url_, url)

    def test_sym_raises_ValuError(self):
        with patch('celery.backends.symbol_by_name') as sbn:
            sbn.side_effect = ValueError()
            with self.assertRaises(ImproperlyConfigured):
                backends.get_backend_cls('xxx.xxx:foo', self.app.loader)
