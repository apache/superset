from __future__ import absolute_import

from datetime import timedelta

from pickle import loads, dumps

from celery import signature
from celery import states
from celery import group
from celery import uuid
from celery.datastructures import AttributeDict
from celery.exceptions import ImproperlyConfigured
from celery.utils.timeutils import timedelta_seconds

from celery.tests.case import (
    AppCase, Mock, MockCallbacks, SkipTest, depends_on_current_app, patch,
)


class Connection(object):
    connected = True

    def disconnect(self):
        self.connected = False


class Pipeline(object):

    def __init__(self, client):
        self.client = client
        self.steps = []

    def __getattr__(self, attr):

        def add_step(*args, **kwargs):
            self.steps.append((getattr(self.client, attr), args, kwargs))
            return self
        return add_step

    def __enter__(self):
        return self

    def __exit__(self, type, value, traceback):
        pass

    def execute(self):
        return [step(*a, **kw) for step, a, kw in self.steps]


class Redis(MockCallbacks):
    Connection = Connection
    Pipeline = Pipeline

    def __init__(self, host=None, port=None, db=None, password=None, **kw):
        self.host = host
        self.port = port
        self.db = db
        self.password = password
        self.keyspace = {}
        self.expiry = {}
        self.connection = self.Connection()

    def get(self, key):
        return self.keyspace.get(key)

    def setex(self, key, value, expires):
        self.set(key, value)
        self.expire(key, expires)

    def set(self, key, value):
        self.keyspace[key] = value

    def expire(self, key, expires):
        self.expiry[key] = expires
        return expires

    def delete(self, key):
        return bool(self.keyspace.pop(key, None))

    def pipeline(self):
        return self.Pipeline(self)

    def _get_list(self, key):
        try:
            return self.keyspace[key]
        except KeyError:
            l = self.keyspace[key] = []
            return l

    def rpush(self, key, value):
        self._get_list(key).append(value)

    def lrange(self, key, start, stop):
        return self._get_list(key)[start:stop]

    def llen(self, key):
        return len(self.keyspace.get(key) or [])


class redis(object):
    VERSION = (2, 4, 10)
    Redis = Redis

    class ConnectionPool(object):

        def __init__(self, **kwargs):
            pass

    class UnixDomainSocketConnection(object):

        def __init__(self, **kwargs):
            pass


class test_RedisBackend(AppCase):

    def get_backend(self):
        from celery.backends.redis import RedisBackend

        class _RedisBackend(RedisBackend):
            redis = redis

        return _RedisBackend

    def setup(self):
        self.Backend = self.get_backend()

    @depends_on_current_app
    def test_reduce(self):
        try:
            from celery.backends.redis import RedisBackend
            x = RedisBackend(app=self.app, new_join=True)
            self.assertTrue(loads(dumps(x)))
        except ImportError:
            raise SkipTest('redis not installed')

    def test_no_redis(self):
        self.Backend.redis = None
        with self.assertRaises(ImproperlyConfigured):
            self.Backend(app=self.app, new_join=True)

    def test_url(self):
        x = self.Backend(
            'redis://:bosco@vandelay.com:123//1', app=self.app,
            new_join=True,
        )
        self.assertTrue(x.connparams)
        self.assertEqual(x.connparams['host'], 'vandelay.com')
        self.assertEqual(x.connparams['db'], 1)
        self.assertEqual(x.connparams['port'], 123)
        self.assertEqual(x.connparams['password'], 'bosco')

    def test_socket_url(self):
        x = self.Backend(
            'socket:///tmp/redis.sock?virtual_host=/3', app=self.app,
            new_join=True,
        )
        self.assertTrue(x.connparams)
        self.assertEqual(x.connparams['path'], '/tmp/redis.sock')
        self.assertIs(
            x.connparams['connection_class'],
            redis.UnixDomainSocketConnection,
        )
        self.assertNotIn('host', x.connparams)
        self.assertNotIn('port', x.connparams)
        self.assertEqual(x.connparams['db'], 3)

    def test_compat_propertie(self):
        x = self.Backend(
            'redis://:bosco@vandelay.com:123//1', app=self.app,
            new_join=True,
        )
        with self.assertPendingDeprecation():
            self.assertEqual(x.host, 'vandelay.com')
        with self.assertPendingDeprecation():
            self.assertEqual(x.db, 1)
        with self.assertPendingDeprecation():
            self.assertEqual(x.port, 123)
        with self.assertPendingDeprecation():
            self.assertEqual(x.password, 'bosco')

    def test_conf_raises_KeyError(self):
        self.app.conf = AttributeDict({
            'CELERY_RESULT_SERIALIZER': 'json',
            'CELERY_MAX_CACHED_RESULTS': 1,
            'CELERY_ACCEPT_CONTENT': ['json'],
            'CELERY_TASK_RESULT_EXPIRES': None,
        })
        self.Backend(app=self.app, new_join=True)

    def test_expires_defaults_to_config(self):
        self.app.conf.CELERY_TASK_RESULT_EXPIRES = 10
        b = self.Backend(expires=None, app=self.app, new_join=True)
        self.assertEqual(b.expires, 10)

    def test_expires_is_int(self):
        b = self.Backend(expires=48, app=self.app, new_join=True)
        self.assertEqual(b.expires, 48)

    def test_set_new_join_from_url_query(self):
        b = self.Backend('redis://?new_join=True;foobar=1', app=self.app)
        self.assertEqual(b.on_chord_part_return, b._new_chord_return)
        self.assertEqual(b.apply_chord, b._new_chord_apply)

    def test_default_is_old_join(self):
        b = self.Backend(app=self.app)
        self.assertNotEqual(b.on_chord_part_return, b._new_chord_return)
        self.assertNotEqual(b.apply_chord, b._new_chord_apply)

    def test_expires_is_None(self):
        b = self.Backend(expires=None, app=self.app, new_join=True)
        self.assertEqual(b.expires, timedelta_seconds(
            self.app.conf.CELERY_TASK_RESULT_EXPIRES))

    def test_expires_is_timedelta(self):
        b = self.Backend(
            expires=timedelta(minutes=1), app=self.app, new_join=1,
        )
        self.assertEqual(b.expires, 60)

    def test_apply_chord(self):
        self.Backend(app=self.app, new_join=True).apply_chord(
            group(app=self.app), (), 'group_id', {},
            result=[self.app.AsyncResult(x) for x in [1, 2, 3]],
        )

    def test_mget(self):
        b = self.Backend(app=self.app, new_join=True)
        self.assertTrue(b.mget(['a', 'b', 'c']))
        b.client.mget.assert_called_with(['a', 'b', 'c'])

    def test_set_no_expire(self):
        b = self.Backend(app=self.app, new_join=True)
        b.expires = None
        b.set('foo', 'bar')

    @patch('celery.result.GroupResult.restore')
    def test_on_chord_part_return(self, restore):
        b = self.Backend(app=self.app, new_join=True)

        def create_task():
            tid = uuid()
            task = Mock(name='task-{0}'.format(tid))
            task.name = 'foobarbaz'
            self.app.tasks['foobarbaz'] = task
            task.request.chord = signature(task)
            task.request.id = tid
            task.request.chord['chord_size'] = 10
            task.request.group = 'group_id'
            return task

        tasks = [create_task() for i in range(10)]

        for i in range(10):
            b.on_chord_part_return(tasks[i], states.SUCCESS, i)
            self.assertTrue(b.client.rpush.call_count)
            b.client.rpush.reset_mock()
        self.assertTrue(b.client.lrange.call_count)
        gkey = b.get_key_for_group('group_id', '.j')
        b.client.delete.assert_called_with(gkey)
        b.client.expire.assert_called_with(gkey, 86400)

    def test_process_cleanup(self):
        self.Backend(app=self.app, new_join=True).process_cleanup()

    def test_get_set_forget(self):
        b = self.Backend(app=self.app, new_join=True)
        tid = uuid()
        b.store_result(tid, 42, states.SUCCESS)
        self.assertEqual(b.get_status(tid), states.SUCCESS)
        self.assertEqual(b.get_result(tid), 42)
        b.forget(tid)
        self.assertEqual(b.get_status(tid), states.PENDING)

    def test_set_expires(self):
        b = self.Backend(expires=512, app=self.app, new_join=True)
        tid = uuid()
        key = b.get_key_for_task(tid)
        b.store_result(tid, 42, states.SUCCESS)
        b.client.expire.assert_called_with(
            key, 512,
        )
