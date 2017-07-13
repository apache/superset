"""
Keys and certificates for tests (KEY1 is a private key of CERT1, etc.)

Generated with:

.. code-block:: bash

    $ openssl genrsa -des3 -passout pass:test -out key1.key 1024
    $ openssl req -new -key key1.key -out key1.csr -passin pass:test
    $ cp key1.key key1.key.org
    $ openssl rsa -in key1.key.org -out key1.key -passin pass:test
    $ openssl x509 -req -days 365 -in cert1.csr \
              -signkey key1.key -out cert1.crt
    $ rm key1.key.org cert1.csr

"""
from __future__ import absolute_import

from kombu.serialization import disable_insecure_serializers

from celery.exceptions import ImproperlyConfigured, SecurityError
from celery.five import builtins
from celery.security.utils import reraise_errors
from kombu.serialization import registry

from .case import SecurityCase

from celery.tests.case import Mock, mock_open, patch


class test_security(SecurityCase):

    def teardown(self):
        registry._disabled_content_types.clear()

    def test_disable_insecure_serializers(self):
        try:
            disabled = registry._disabled_content_types
            self.assertTrue(disabled)

            disable_insecure_serializers(
                ['application/json', 'application/x-python-serialize'],
            )
            self.assertIn('application/x-yaml', disabled)
            self.assertNotIn('application/json', disabled)
            self.assertNotIn('application/x-python-serialize', disabled)
            disabled.clear()

            disable_insecure_serializers(allowed=None)
            self.assertIn('application/x-yaml', disabled)
            self.assertIn('application/json', disabled)
            self.assertIn('application/x-python-serialize', disabled)
        finally:
            disable_insecure_serializers(allowed=['json'])

    def test_setup_security(self):
        disabled = registry._disabled_content_types
        self.assertEqual(0, len(disabled))

        self.app.conf.CELERY_TASK_SERIALIZER = 'json'
        self.app.setup_security()
        self.assertIn('application/x-python-serialize', disabled)
        disabled.clear()

    @patch('celery.security.register_auth')
    @patch('celery.security._disable_insecure_serializers')
    def test_setup_registry_complete(self, dis, reg, key='KEY', cert='CERT'):
        calls = [0]

        def effect(*args):
            try:
                m = Mock()
                m.read.return_value = 'B' if calls[0] else 'A'
                return m
            finally:
                calls[0] += 1

        self.app.conf.CELERY_TASK_SERIALIZER = 'auth'
        with mock_open(side_effect=effect):
            with patch('celery.security.registry') as registry:
                store = Mock()
                self.app.setup_security(['json'], key, cert, store)
                dis.assert_called_with(['json'])
                reg.assert_called_with('A', 'B', store, 'sha1', 'json')
                registry._set_default_serializer.assert_called_with('auth')

    def test_security_conf(self):
        self.app.conf.CELERY_TASK_SERIALIZER = 'auth'
        with self.assertRaises(ImproperlyConfigured):
            self.app.setup_security()

        _import = builtins.__import__

        def import_hook(name, *args, **kwargs):
            if name == 'OpenSSL':
                raise ImportError
            return _import(name, *args, **kwargs)

        builtins.__import__ = import_hook
        with self.assertRaises(ImproperlyConfigured):
            self.app.setup_security()
        builtins.__import__ = _import

    def test_reraise_errors(self):
        with self.assertRaises(SecurityError):
            with reraise_errors(errors=(KeyError, )):
                raise KeyError('foo')
        with self.assertRaises(KeyError):
            with reraise_errors(errors=(ValueError, )):
                raise KeyError('bar')
