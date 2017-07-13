from __future__ import absolute_import

from celery.backends import couchbase as module
from celery.backends.couchbase import CouchBaseBackend
from celery.exceptions import ImproperlyConfigured
from celery import backends
from celery.tests.case import (
    AppCase, MagicMock, Mock, SkipTest, patch, sentinel,
)

try:
    import couchbase
except ImportError:
    couchbase = None  # noqa

COUCHBASE_BUCKET = 'celery_bucket'


class test_CouchBaseBackend(AppCase):

    def setup(self):
        if couchbase is None:
            raise SkipTest('couchbase is not installed.')
        self.backend = CouchBaseBackend(app=self.app)

    def test_init_no_couchbase(self):
        """test init no couchbase raises"""
        prev, module.couchbase = module.couchbase, None
        try:
            with self.assertRaises(ImproperlyConfigured):
                CouchBaseBackend(app=self.app)
        finally:
            module.couchbase = prev

    def test_init_no_settings(self):
        """test init no settings"""
        self.app.conf.CELERY_COUCHBASE_BACKEND_SETTINGS = []
        with self.assertRaises(ImproperlyConfigured):
            CouchBaseBackend(app=self.app)

    def test_init_settings_is_None(self):
        """Test init settings is None"""
        self.app.conf.CELERY_COUCHBASE_BACKEND_SETTINGS = None
        CouchBaseBackend(app=self.app)

    def test_get_connection_connection_exists(self):
        with patch('couchbase.connection.Connection') as mock_Connection:
            self.backend._connection = sentinel._connection

            connection = self.backend._get_connection()

            self.assertEqual(sentinel._connection, connection)
            self.assertFalse(mock_Connection.called)

    def test_get(self):
        """test_get

        CouchBaseBackend.get should return  and take two params
        db conn to couchbase is mocked.
        TODO Should test on key not exists

        """
        self.app.conf.CELERY_COUCHBASE_BACKEND_SETTINGS = {}
        x = CouchBaseBackend(app=self.app)
        x._connection = Mock()
        mocked_get = x._connection.get = Mock()
        mocked_get.return_value.value = sentinel.retval
        # should return None
        self.assertEqual(x.get('1f3fab'), sentinel.retval)
        x._connection.get.assert_called_once_with('1f3fab')

    def test_set(self):
        """test_set

        CouchBaseBackend.set should return None and take two params
        db conn to couchbase is mocked.

        """
        self.app.conf.CELERY_COUCHBASE_BACKEND_SETTINGS = None
        x = CouchBaseBackend(app=self.app)
        x._connection = MagicMock()
        x._connection.set = MagicMock()
        # should return None
        self.assertIsNone(x.set(sentinel.key, sentinel.value))

    def test_delete(self):
        """test_delete

        CouchBaseBackend.delete should return and take two params
        db conn to couchbase is mocked.
        TODO Should test on key not exists

        """
        self.app.conf.CELERY_COUCHBASE_BACKEND_SETTINGS = {}
        x = CouchBaseBackend(app=self.app)
        x._connection = Mock()
        mocked_delete = x._connection.delete = Mock()
        mocked_delete.return_value = None
        # should return None
        self.assertIsNone(x.delete('1f3fab'))
        x._connection.delete.assert_called_once_with('1f3fab')

    def test_config_params(self):
        """test_config_params

        celery.conf.CELERY_COUCHBASE_BACKEND_SETTINGS is properly set
        """
        self.app.conf.CELERY_COUCHBASE_BACKEND_SETTINGS = {
            'bucket': 'mycoolbucket',
            'host': ['here.host.com', 'there.host.com'],
            'username': 'johndoe',
            'password': 'mysecret',
            'port': '1234',
        }
        x = CouchBaseBackend(app=self.app)
        self.assertEqual(x.bucket, 'mycoolbucket')
        self.assertEqual(x.host, ['here.host.com', 'there.host.com'],)
        self.assertEqual(x.username, 'johndoe',)
        self.assertEqual(x.password, 'mysecret')
        self.assertEqual(x.port, 1234)

    def test_backend_by_url(self, url='couchbase://myhost/mycoolbucket'):
        from celery.backends.couchbase import CouchBaseBackend
        backend, url_ = backends.get_backend_by_url(url, self.app.loader)
        self.assertIs(backend, CouchBaseBackend)
        self.assertEqual(url_, url)

    def test_backend_params_by_url(self):
        url = 'couchbase://johndoe:mysecret@myhost:123/mycoolbucket'
        with self.Celery(backend=url) as app:
            x = app.backend
            self.assertEqual(x.bucket, 'mycoolbucket')
            self.assertEqual(x.host, 'myhost')
            self.assertEqual(x.username, 'johndoe')
            self.assertEqual(x.password, 'mysecret')
            self.assertEqual(x.port, 123)
