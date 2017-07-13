from __future__ import absolute_import

import datetime
import uuid

from pickle import loads, dumps

from celery import states
from celery.backends import mongodb as module
from celery.backends.mongodb import MongoBackend, pymongo
from celery.exceptions import ImproperlyConfigured
from celery.tests.case import (
    AppCase, MagicMock, Mock, SkipTest, ANY,
    depends_on_current_app, disable_stdouts, patch, sentinel,
)

COLLECTION = 'taskmeta_celery'
TASK_ID = str(uuid.uuid1())
MONGODB_HOST = 'localhost'
MONGODB_PORT = 27017
MONGODB_USER = 'mongo'
MONGODB_PASSWORD = '1234'
MONGODB_DATABASE = 'testing'
MONGODB_COLLECTION = 'collection1'


class test_MongoBackend(AppCase):

    default_url = 'mongodb://uuuu:pwpw@hostname.dom/database'
    replica_set_url = (
        'mongodb://uuuu:pwpw@hostname.dom,'
        'hostname.dom/database?replicaSet=rs'
    )
    sanitized_default_url = 'mongodb://uuuu:**@hostname.dom/database'
    sanitized_replica_set_url = (
        'mongodb://uuuu:**@hostname.dom/,'
        'hostname.dom/database?replicaSet=rs'
    )

    def setup(self):
        if pymongo is None:
            raise SkipTest('pymongo is not installed.')

        R = self._reset = {}
        R['encode'], MongoBackend.encode = MongoBackend.encode, Mock()
        R['decode'], MongoBackend.decode = MongoBackend.decode, Mock()
        R['Binary'], module.Binary = module.Binary, Mock()
        R['datetime'], datetime.datetime = datetime.datetime, Mock()

        self.backend = MongoBackend(app=self.app, url=self.default_url)

    def teardown(self):
        MongoBackend.encode = self._reset['encode']
        MongoBackend.decode = self._reset['decode']
        module.Binary = self._reset['Binary']
        datetime.datetime = self._reset['datetime']

    def test_init_no_mongodb(self):
        prev, module.pymongo = module.pymongo, None
        try:
            with self.assertRaises(ImproperlyConfigured):
                MongoBackend(app=self.app)
        finally:
            module.pymongo = prev

    def test_init_no_settings(self):
        self.app.conf.CELERY_MONGODB_BACKEND_SETTINGS = []
        with self.assertRaises(ImproperlyConfigured):
            MongoBackend(app=self.app)

    def test_init_settings_is_None(self):
        self.app.conf.CELERY_MONGODB_BACKEND_SETTINGS = None
        MongoBackend(app=self.app)

    def test_restore_group_no_entry(self):
        x = MongoBackend(app=self.app)
        x.collection = Mock()
        fo = x.collection.find_one = Mock()
        fo.return_value = None
        self.assertIsNone(x._restore_group('1f3fab'))

    @depends_on_current_app
    def test_reduce(self):
        x = MongoBackend(app=self.app)
        self.assertTrue(loads(dumps(x)))

    def test_get_connection_connection_exists(self):

        with patch('pymongo.MongoClient') as mock_Connection:
            self.backend._connection = sentinel._connection

            connection = self.backend._get_connection()

            self.assertEqual(sentinel._connection, connection)
            self.assertFalse(mock_Connection.called)

    def test_get_connection_no_connection_host(self):

        with patch('pymongo.MongoClient') as mock_Connection:
            self.backend._connection = None
            self.backend.host = MONGODB_HOST
            self.backend.port = MONGODB_PORT
            mock_Connection.return_value = sentinel.connection

            connection = self.backend._get_connection()
            mock_Connection.assert_called_once_with(
                host='mongodb://localhost:27017',
                **self.backend._prepare_client_options()
            )
            self.assertEqual(sentinel.connection, connection)

    def test_get_connection_no_connection_mongodb_uri(self):

        with patch('pymongo.MongoClient') as mock_Connection:
            mongodb_uri = 'mongodb://%s:%d' % (MONGODB_HOST, MONGODB_PORT)
            self.backend._connection = None
            self.backend.host = mongodb_uri

            mock_Connection.return_value = sentinel.connection

            connection = self.backend._get_connection()
            mock_Connection.assert_called_once_with(
                host=mongodb_uri, **self.backend._prepare_client_options()
            )
            self.assertEqual(sentinel.connection, connection)

    @patch('celery.backends.mongodb.MongoBackend._get_connection')
    def test_get_database_no_existing(self, mock_get_connection):
        # Should really check for combinations of these two, to be complete.
        self.backend.user = MONGODB_USER
        self.backend.password = MONGODB_PASSWORD

        mock_database = Mock()
        mock_connection = MagicMock(spec=['__getitem__'])
        mock_connection.__getitem__.return_value = mock_database
        mock_get_connection.return_value = mock_connection

        database = self.backend.database

        self.assertTrue(database is mock_database)
        self.assertTrue(self.backend.__dict__['database'] is mock_database)
        mock_database.authenticate.assert_called_once_with(
            MONGODB_USER, MONGODB_PASSWORD)

    @patch('celery.backends.mongodb.MongoBackend._get_connection')
    def test_get_database_no_existing_no_auth(self, mock_get_connection):
        # Should really check for combinations of these two, to be complete.
        self.backend.user = None
        self.backend.password = None

        mock_database = Mock()
        mock_connection = MagicMock(spec=['__getitem__'])
        mock_connection.__getitem__.return_value = mock_database
        mock_get_connection.return_value = mock_connection

        database = self.backend.database

        self.assertTrue(database is mock_database)
        self.assertFalse(mock_database.authenticate.called)
        self.assertTrue(self.backend.__dict__['database'] is mock_database)

    def test_process_cleanup(self):
        self.backend._connection = None
        self.backend.process_cleanup()
        self.assertEqual(self.backend._connection, None)

        self.backend._connection = 'not none'
        self.backend.process_cleanup()
        self.assertEqual(self.backend._connection, None)

    @patch('celery.backends.mongodb.MongoBackend._get_database')
    def test_store_result(self, mock_get_database):
        self.backend.taskmeta_collection = MONGODB_COLLECTION

        mock_database = MagicMock(spec=['__getitem__', '__setitem__'])
        mock_collection = Mock()

        mock_get_database.return_value = mock_database
        mock_database.__getitem__.return_value = mock_collection

        ret_val = self.backend._store_result(
            sentinel.task_id, sentinel.result, sentinel.status)

        mock_get_database.assert_called_once_with()
        mock_database.__getitem__.assert_called_once_with(MONGODB_COLLECTION)
        mock_collection.save.assert_called_once_with(ANY)
        self.assertEqual(sentinel.result, ret_val)

    @patch('celery.backends.mongodb.MongoBackend._get_database')
    def test_get_task_meta_for(self, mock_get_database):
        datetime.datetime = self._reset['datetime']
        self.backend.taskmeta_collection = MONGODB_COLLECTION

        mock_database = MagicMock(spec=['__getitem__', '__setitem__'])
        mock_collection = Mock()
        mock_collection.find_one.return_value = MagicMock()

        mock_get_database.return_value = mock_database
        mock_database.__getitem__.return_value = mock_collection

        ret_val = self.backend._get_task_meta_for(sentinel.task_id)

        mock_get_database.assert_called_once_with()
        mock_database.__getitem__.assert_called_once_with(MONGODB_COLLECTION)
        self.assertEqual(
            list(sorted(['status', 'task_id', 'date_done', 'traceback',
                         'result', 'children'])),
            list(sorted(ret_val.keys())),
        )

    @patch('celery.backends.mongodb.MongoBackend._get_database')
    def test_get_task_meta_for_no_result(self, mock_get_database):
        self.backend.taskmeta_collection = MONGODB_COLLECTION

        mock_database = MagicMock(spec=['__getitem__', '__setitem__'])
        mock_collection = Mock()
        mock_collection.find_one.return_value = None

        mock_get_database.return_value = mock_database
        mock_database.__getitem__.return_value = mock_collection

        ret_val = self.backend._get_task_meta_for(sentinel.task_id)

        mock_get_database.assert_called_once_with()
        mock_database.__getitem__.assert_called_once_with(MONGODB_COLLECTION)
        self.assertEqual({'status': states.PENDING, 'result': None}, ret_val)

    @patch('celery.backends.mongodb.MongoBackend._get_database')
    def test_save_group(self, mock_get_database):
        self.backend.taskmeta_collection = MONGODB_COLLECTION

        mock_database = MagicMock(spec=['__getitem__', '__setitem__'])
        mock_collection = Mock()

        mock_get_database.return_value = mock_database
        mock_database.__getitem__.return_value = mock_collection

        ret_val = self.backend._save_group(
            sentinel.taskset_id, sentinel.result)

        mock_get_database.assert_called_once_with()
        mock_database.__getitem__.assert_called_once_with(MONGODB_COLLECTION)
        mock_collection.save.assert_called_once_with(ANY)
        self.assertEqual(sentinel.result, ret_val)

    @patch('celery.backends.mongodb.MongoBackend._get_database')
    def test_restore_group(self, mock_get_database):
        self.backend.taskmeta_collection = MONGODB_COLLECTION

        mock_database = MagicMock(spec=['__getitem__', '__setitem__'])
        mock_collection = Mock()
        mock_collection.find_one.return_value = MagicMock()

        mock_get_database.return_value = mock_database
        mock_database.__getitem__.return_value = mock_collection

        ret_val = self.backend._restore_group(sentinel.taskset_id)

        mock_get_database.assert_called_once_with()
        mock_database.__getitem__.assert_called_once_with(MONGODB_COLLECTION)
        mock_collection.find_one.assert_called_once_with(
            {'_id': sentinel.taskset_id})
        self.assertItemsEqual(
            ['date_done', 'result', 'task_id'],
            list(ret_val.keys()),
        )

    @patch('celery.backends.mongodb.MongoBackend._get_database')
    def test_delete_group(self, mock_get_database):
        self.backend.taskmeta_collection = MONGODB_COLLECTION

        mock_database = MagicMock(spec=['__getitem__', '__setitem__'])
        mock_collection = Mock()

        mock_get_database.return_value = mock_database
        mock_database.__getitem__.return_value = mock_collection

        self.backend._delete_group(sentinel.taskset_id)

        mock_get_database.assert_called_once_with()
        mock_database.__getitem__.assert_called_once_with(MONGODB_COLLECTION)
        mock_collection.remove.assert_called_once_with(
            {'_id': sentinel.taskset_id})

    @patch('celery.backends.mongodb.MongoBackend._get_database')
    def test_forget(self, mock_get_database):
        self.backend.taskmeta_collection = MONGODB_COLLECTION

        mock_database = MagicMock(spec=['__getitem__', '__setitem__'])
        mock_collection = Mock()

        mock_get_database.return_value = mock_database
        mock_database.__getitem__.return_value = mock_collection

        self.backend._forget(sentinel.task_id)

        mock_get_database.assert_called_once_with()
        mock_database.__getitem__.assert_called_once_with(
            MONGODB_COLLECTION)
        mock_collection.remove.assert_called_once_with(
            {'_id': sentinel.task_id})

    @patch('celery.backends.mongodb.MongoBackend._get_database')
    def test_cleanup(self, mock_get_database):
        datetime.datetime = self._reset['datetime']
        self.backend.taskmeta_collection = MONGODB_COLLECTION

        mock_database = MagicMock(spec=['__getitem__', '__setitem__'])
        self.backend.collections = mock_collection = Mock()

        mock_get_database.return_value = mock_database
        mock_database.__getitem__.return_value = mock_collection

        self.backend.app.now = datetime.datetime.utcnow
        self.backend.cleanup()

        mock_get_database.assert_called_once_with()
        mock_database.__getitem__.assert_called_once_with(
            MONGODB_COLLECTION)
        self.assertTrue(mock_collection.remove.called)

    def test_get_database_authfailure(self):
        x = MongoBackend(app=self.app)
        x._get_connection = Mock()
        conn = x._get_connection.return_value = {}
        db = conn[x.database_name] = Mock()
        db.authenticate.return_value = False
        x.user = 'jerry'
        x.password = 'cere4l'
        with self.assertRaises(ImproperlyConfigured):
            x._get_database()
        db.authenticate.assert_called_with('jerry', 'cere4l')

    @patch('celery.backends.mongodb.detect_environment')
    def test_prepare_client_options_for_ver_2(self, m_detect_env):
        m_detect_env.return_value = 'default'
        with patch('pymongo.version_tuple', new=(2, 6, 3)):
            options = self.backend._prepare_client_options()
            self.assertDictEqual(options, {
                'max_pool_size': self.backend.max_pool_size,
                'auto_start_request': False
            })

    def test_as_uri_include_password(self):
        self.assertEqual(self.backend.as_uri(True), self.default_url)

    def test_as_uri_exclude_password(self):
        self.assertEqual(self.backend.as_uri(), self.sanitized_default_url)

    def test_as_uri_include_password_replica_set(self):
        backend = MongoBackend(app=self.app, url=self.replica_set_url)
        self.assertEqual(backend.as_uri(True), self.replica_set_url)

    def test_as_uri_exclude_password_replica_set(self):
        backend = MongoBackend(app=self.app, url=self.replica_set_url)
        self.assertEqual(backend.as_uri(), self.sanitized_replica_set_url)

    @disable_stdouts
    def test_regression_worker_startup_info(self):
        self.app.conf.result_backend = (
            'mongodb://user:password@host0.com:43437,host1.com:43437'
            '/work4us?replicaSet=rs&ssl=true'
        )
        worker = self.app.Worker()
        worker.on_start()
        self.assertTrue(worker.startup_info())
