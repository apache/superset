from __future__ import absolute_import

import socket
import types

from anyjson import dumps, loads
from collections import defaultdict
from contextlib import contextmanager
from itertools import count

from kombu import Connection, Exchange, Queue, Consumer, Producer
from kombu.exceptions import InconsistencyError, VersionMismatch
from kombu.five import Empty, Queue as _Queue
from kombu.transport import virtual
from kombu.utils import eventio  # patch poll

from kombu.tests.case import (
    Case, ContextMock, Mock, call, module_exists, skip_if_not_module, patch,
)


class JSONEqual(object):
    # The order in which a dict is serialized to json depends on the hashseed
    # so we have this to support json in .assert_has_call*.

    def __init__(self, expected):
        self.expected = expected

    def __eq__(self, other):
        return loads(other) == loads(self.expected)

    def __str__(self):
        return self.expected

    def __repr__(self):
        return '(json)%r' % (self.expected,)


class _poll(eventio._select):

    def register(self, fd, flags):
        if flags & eventio.READ:
            self._rfd.add(fd)

    def poll(self, timeout):
        events = []
        for fd in self._rfd:
            if fd.data:
                events.append((fd.fileno(), eventio.READ))
        return events


eventio.poll = _poll
# must import after poller patch
from kombu.transport import redis  # noqa


class ResponseError(Exception):
    pass


class Client(object):
    queues = {}
    sets = defaultdict(set)
    hashes = defaultdict(dict)
    shard_hint = None

    def __init__(self, db=None, port=None, connection_pool=None, **kwargs):
        self._called = []
        self._connection = None
        self.bgsave_raises_ResponseError = False
        self.connection = self._sconnection(self)

    def bgsave(self):
        self._called.append('BGSAVE')
        if self.bgsave_raises_ResponseError:
            raise ResponseError()

    def delete(self, key):
        self.queues.pop(key, None)

    def exists(self, key):
        return key in self.queues or key in self.sets

    def hset(self, key, k, v):
        self.hashes[key][k] = v

    def hget(self, key, k):
        return self.hashes[key].get(k)

    def hdel(self, key, k):
        self.hashes[key].pop(k, None)

    def sadd(self, key, member, *args):
        self.sets[key].add(member)
    zadd = sadd

    def smembers(self, key):
        return self.sets.get(key, set())

    def srem(self, key, *args):
        self.sets.pop(key, None)
    zrem = srem

    def llen(self, key):
        try:
            return self.queues[key].qsize()
        except KeyError:
            return 0

    def lpush(self, key, value):
        self.queues[key].put_nowait(value)

    def parse_response(self, connection, type, **options):
        cmd, queues = self.connection._sock.data.pop()
        assert cmd == type
        self.connection._sock.data = []
        if type == 'BRPOP':
            item = self.brpop(queues, 0.001)
            if item:
                return item
            raise Empty()

    def brpop(self, keys, timeout=None):
        key = keys[0]
        try:
            item = self.queues[key].get(timeout=timeout)
        except Empty:
            pass
        else:
            return key, item

    def rpop(self, key):
        try:
            return self.queues[key].get_nowait()
        except KeyError:
            pass

    def __contains__(self, k):
        return k in self._called

    def pipeline(self):
        return Pipeline(self)

    def encode(self, value):
        return str(value)

    def _new_queue(self, key):
        self.queues[key] = _Queue()

    class _sconnection(object):
        disconnected = False

        class _socket(object):
            blocking = True
            filenos = count(30)

            def __init__(self, *args):
                self._fileno = next(self.filenos)
                self.data = []

            def fileno(self):
                return self._fileno

            def setblocking(self, blocking):
                self.blocking = blocking

        def __init__(self, client):
            self.client = client
            self._sock = self._socket()

        def disconnect(self):
            self.disconnected = True

        def send_command(self, cmd, *args):
            self._sock.data.append((cmd, args))

    def info(self):
        return {'foo': 1}

    def pubsub(self, *args, **kwargs):
        connection = self.connection

        class ConnectionPool(object):

            def get_connection(self, *args, **kwargs):
                return connection
        self.connection_pool = ConnectionPool()

        return self

    def __repr__(self):
        return '<MockClient: %r' % (id(self),)


class Pipeline(object):

    def __init__(self, client):
        self.client = client
        self.stack = []

    def __enter__(self):
        return self

    def __exit__(self, *exc_info):
        pass

    def __getattr__(self, key):
        if key not in self.__dict__:

            def _add(*args, **kwargs):
                self.stack.append((getattr(self.client, key), args, kwargs))
                return self

            return _add
        return self.__dict__[key]

    def execute(self):
        stack = list(self.stack)
        self.stack[:] = []
        return [fun(*args, **kwargs) for fun, args, kwargs in stack]


class Channel(redis.Channel):
    Client = Client

    def _get_async_client(self):
        return Client

    def _create_client(self, async=False):
        return Client()

    def _get_pool(self, async=False):
        return Mock()

    @contextmanager
    def conn_or_acquire(self, client=None):
        yield client if client is not None else self._create_client()

    def _get_response_error(self):
        return ResponseError

    def _new_queue(self, queue, **kwargs):
        self.client._new_queue(queue)

    def pipeline(self):
        return Pipeline(Client())


class Transport(redis.Transport):
    Channel = Channel

    def _get_errors(self):
        return ((KeyError, ), (IndexError, ))


class test_Channel(Case):

    @skip_if_not_module('redis')
    def setUp(self):
        self.connection = self.create_connection()
        self.channel = self.connection.default_channel

    def create_connection(self, **kwargs):
        kwargs.setdefault('transport_options', {'fanout_patterns': True})
        return Connection(transport=Transport, **kwargs)

    def _get_one_delivery_tag(self, n='test_uniq_tag'):
        with self.create_connection() as conn1:
            chan = conn1.default_channel
            chan.exchange_declare(n)
            chan.queue_declare(n)
            chan.queue_bind(n, n, n)
            msg = chan.prepare_message('quick brown fox')
            chan.basic_publish(msg, n, n)
            q, payload = chan.client.brpop([n])
            self.assertEqual(q, n)
            self.assertTrue(payload)
            pymsg = chan.message_to_python(loads(payload))
            return pymsg.delivery_tag

    def test_delivery_tag_is_uuid(self):
        seen = set()
        for i in range(100):
            tag = self._get_one_delivery_tag()
            self.assertNotIn(tag, seen)
            seen.add(tag)
            with self.assertRaises(ValueError):
                int(tag)
            self.assertEqual(len(tag), 36)

    def test_disable_ack_emulation(self):
        conn = Connection(transport=Transport, transport_options={
            'ack_emulation': False,
        })

        chan = conn.channel()
        self.assertFalse(chan.ack_emulation)
        self.assertEqual(chan.QoS, virtual.QoS)

    def test_redis_info_raises(self):
        pool = Mock(name='pool')
        pool_at_init = [pool]
        client = Mock(name='client')

        class XChannel(Channel):

            def __init__(self, *args, **kwargs):
                self._pool = pool_at_init[0]
                super(XChannel, self).__init__(*args, **kwargs)

            def _create_client(self, async=False):
                return client

        class XTransport(Transport):
            Channel = XChannel

        conn = Connection(transport=XTransport)
        client.info.side_effect = RuntimeError()
        with self.assertRaises(RuntimeError):
            conn.channel()
        pool.disconnect.assert_called_with()
        pool.disconnect.reset_mock()

        pool_at_init = [None]
        with self.assertRaises(RuntimeError):
            conn.channel()
        self.assertFalse(pool.disconnect.called)

    def test_after_fork(self):
        self.channel._pool = None
        self.channel._after_fork()

        pool = self.channel._pool = Mock(name='pool')
        self.channel._after_fork()
        pool.disconnect.assert_called_with()

    def test_next_delivery_tag(self):
        self.assertNotEqual(
            self.channel._next_delivery_tag(),
            self.channel._next_delivery_tag(),
        )

    def test_do_restore_message(self):
        client = Mock(name='client')
        pl1 = {'body': 'BODY'}
        spl1 = dumps(pl1)
        lookup = self.channel._lookup = Mock(name='_lookup')
        lookup.return_value = ['george', 'elaine']
        self.channel._do_restore_message(
            pl1, 'ex', 'rkey', client,
        )
        client.rpush.assert_has_calls([
            call('george', spl1), call('elaine', spl1),
        ])
        client.rpush.reset_mock()

        pl2 = {'body': 'BODY2', 'headers': {'x-funny': 1}}
        headers_after = dict(pl2['headers'], redelivered=True)
        spl2 = dumps(dict(pl2, headers=headers_after))
        self.channel._do_restore_message(
            pl2, 'ex', 'rkey', client,
        )

        client.rpush.assert_has_calls([
            call('george', JSONEqual(spl2)),
            call('elaine', JSONEqual(spl2)),
        ])

        client.rpush.side_effect = KeyError()
        with patch('kombu.transport.redis.crit') as crit:
            self.channel._do_restore_message(
                pl2, 'ex', 'rkey', client,
            )
            self.assertTrue(crit.called)

    def test_restore(self):
        message = Mock(name='message')
        with patch('kombu.transport.redis.loads') as loads:
            loads.return_value = 'M', 'EX', 'RK'
            client = self.channel._create_client = Mock(name='client')
            client = client()
            client.pipeline = ContextMock()
            restore = self.channel._do_restore_message = Mock(
                name='_do_restore_message',
            )
            pipe = client.pipeline.return_value
            pipe_hget = Mock(name='pipe.hget')
            pipe.hget.return_value = pipe_hget
            pipe_hget_hdel = Mock(name='pipe.hget.hdel')
            pipe_hget.hdel.return_value = pipe_hget_hdel
            result = Mock(name='result')
            pipe_hget_hdel.execute.return_value = None, None

            self.channel._restore(message)
            client.pipeline.assert_called_with()
            unacked_key = self.channel.unacked_key
            self.assertFalse(loads.called)

            tag = message.delivery_tag
            pipe.hget.assert_called_with(unacked_key, tag)
            pipe_hget.hdel.assert_called_with(unacked_key, tag)
            pipe_hget_hdel.execute.assert_called_with()

            pipe_hget_hdel.execute.return_value = result, None
            self.channel._restore(message)
            loads.assert_called_with(result)
            restore.assert_called_with('M', 'EX', 'RK', client, False)

    def test_qos_restore_visible(self):
        client = self.channel._create_client = Mock(name='client')
        client = client()

        def pipe(*args, **kwargs):
            return Pipeline(client)
        client.pipeline = pipe
        client.zrevrangebyscore.return_value = [
            (1, 10),
            (2, 20),
            (3, 30),
        ]
        qos = redis.QoS(self.channel)
        restore = qos.restore_by_tag = Mock(name='restore_by_tag')
        qos._vrestore_count = 1
        qos.restore_visible()
        self.assertFalse(client.zrevrangebyscore.called)
        self.assertEqual(qos._vrestore_count, 2)

        qos._vrestore_count = 0
        qos.restore_visible()
        restore.assert_has_calls([
            call(1, client), call(2, client), call(3, client),
        ])
        self.assertEqual(qos._vrestore_count, 1)

        qos._vrestore_count = 0
        restore.reset_mock()
        client.zrevrangebyscore.return_value = []
        qos.restore_visible()
        self.assertFalse(restore.called)
        self.assertEqual(qos._vrestore_count, 1)

        qos._vrestore_count = 0
        client.setnx.side_effect = redis.MutexHeld()
        qos.restore_visible()

    def test_basic_consume_when_fanout_queue(self):
        self.channel.exchange_declare(exchange='txconfan', type='fanout')
        self.channel.queue_declare(queue='txconfanq')
        self.channel.queue_bind(queue='txconfanq', exchange='txconfan')

        self.assertIn('txconfanq', self.channel._fanout_queues)
        self.channel.basic_consume('txconfanq', False, None, 1)
        self.assertIn('txconfanq', self.channel.active_fanout_queues)
        self.assertEqual(self.channel._fanout_to_queue.get('txconfan'),
                         'txconfanq')

    def test_basic_cancel_unknown_delivery_tag(self):
        self.assertIsNone(self.channel.basic_cancel('txaseqwewq'))

    def test_subscribe_no_queues(self):
        self.channel.subclient = Mock()
        self.channel.active_fanout_queues.clear()
        self.channel._subscribe()

        self.assertFalse(self.channel.subclient.subscribe.called)

    def test_subscribe(self):
        self.channel.subclient = Mock()
        self.channel.active_fanout_queues.add('a')
        self.channel.active_fanout_queues.add('b')
        self.channel._fanout_queues.update(a=('a', ''), b=('b', ''))

        self.channel._subscribe()
        self.assertTrue(self.channel.subclient.psubscribe.called)
        s_args, _ = self.channel.subclient.psubscribe.call_args
        self.assertItemsEqual(s_args[0], ['a', 'b'])

        self.channel.subclient.connection._sock = None
        self.channel._subscribe()
        self.channel.subclient.connection.connect.assert_called_with()

    def test_handle_unsubscribe_message(self):
        s = self.channel.subclient
        s.subscribed = True
        self.channel._handle_message(s, ['unsubscribe', 'a', 0])
        self.assertFalse(s.subscribed)

    def test_handle_pmessage_message(self):
        self.assertDictEqual(
            self.channel._handle_message(
                self.channel.subclient,
                ['pmessage', 'pattern', 'channel', 'data'],
            ),
            {
                'type': 'pmessage',
                'pattern': 'pattern',
                'channel': 'channel',
                'data': 'data',
            },
        )

    def test_handle_message(self):
        self.assertDictEqual(
            self.channel._handle_message(
                self.channel.subclient,
                ['type', 'channel', 'data'],
            ),
            {
                'type': 'type',
                'pattern': None,
                'channel': 'channel',
                'data': 'data',
            },
        )

    def test_brpop_start_but_no_queues(self):
        self.assertIsNone(self.channel._brpop_start())

    def test_receive(self):
        s = self.channel.subclient = Mock()
        self.channel._fanout_to_queue['a'] = 'b'
        s.parse_response.return_value = ['message', 'a',
                                         dumps({'hello': 'world'})]
        payload, queue = self.channel._receive()
        self.assertDictEqual(payload, {'hello': 'world'})
        self.assertEqual(queue, 'b')

    def test_receive_raises(self):
        self.channel._in_listen = True
        s = self.channel.subclient = Mock()
        s.parse_response.side_effect = KeyError('foo')

        with self.assertRaises(redis.Empty):
            self.channel._receive()
        self.assertFalse(self.channel._in_listen)

    def test_receive_empty(self):
        s = self.channel.subclient = Mock()
        s.parse_response.return_value = None

        with self.assertRaises(redis.Empty):
            self.channel._receive()

    def test_receive_different_message_Type(self):
        s = self.channel.subclient = Mock()
        s.parse_response.return_value = ['message', '/foo/', 0, 'data']

        with self.assertRaises(redis.Empty):
            self.channel._receive()

    def test_brpop_read_raises(self):
        c = self.channel.client = Mock()
        c.parse_response.side_effect = KeyError('foo')

        with self.assertRaises(redis.Empty):
            self.channel._brpop_read()

        c.connection.disconnect.assert_called_with()

    def test_brpop_read_gives_None(self):
        c = self.channel.client = Mock()
        c.parse_response.return_value = None

        with self.assertRaises(redis.Empty):
            self.channel._brpop_read()

    def test_poll_error(self):
        c = self.channel.client = Mock()
        c.parse_response = Mock()
        self.channel._poll_error('BRPOP')

        c.parse_response.assert_called_with(c.connection, 'BRPOP')

        c.parse_response.side_effect = KeyError('foo')
        with self.assertRaises(KeyError):
            self.channel._poll_error('BRPOP')

    def test_poll_error_on_type_LISTEN(self):
        c = self.channel.subclient = Mock()
        c.parse_response = Mock()
        self.channel._poll_error('LISTEN')

        c.parse_response.assert_called_with()

        c.parse_response.side_effect = KeyError('foo')
        with self.assertRaises(KeyError):
            self.channel._poll_error('LISTEN')

    def test_put_fanout(self):
        self.channel._in_poll = False
        c = self.channel._create_client = Mock()

        body = {'hello': 'world'}
        self.channel._put_fanout('exchange', body, '')
        c().publish.assert_called_with('exchange', JSONEqual(dumps(body)))

    def test_put_priority(self):
        client = self.channel._create_client = Mock(name='client')
        msg1 = {'properties': {'delivery_info': {'priority': 3}}}

        self.channel._put('george', msg1)
        client().lpush.assert_called_with(
            self.channel._q_for_pri('george', 3), JSONEqual(dumps(msg1)),
        )

        msg2 = {'properties': {'delivery_info': {'priority': 313}}}
        self.channel._put('george', msg2)
        client().lpush.assert_called_with(
            self.channel._q_for_pri('george', 9), JSONEqual(dumps(msg2)),
        )

        msg3 = {'properties': {'delivery_info': {}}}
        self.channel._put('george', msg3)
        client().lpush.assert_called_with(
            self.channel._q_for_pri('george', 0), JSONEqual(dumps(msg3)),
        )

    def test_delete(self):
        x = self.channel
        x._create_client = Mock()
        x._create_client.return_value = x.client
        delete = x.client.delete = Mock()
        srem = x.client.srem = Mock()

        x._delete('queue', 'exchange', 'routing_key', None)
        delete.assert_any_call('queue')
        srem.assert_called_once_with(
            x.keyprefix_queue % ('exchange', ),
            x.sep.join(['routing_key', '', 'queue'])
        )

    def test_has_queue(self):
        self.channel._create_client = Mock()
        self.channel._create_client.return_value = self.channel.client
        exists = self.channel.client.exists = Mock()
        exists.return_value = True
        self.assertTrue(self.channel._has_queue('foo'))
        exists.assert_any_call('foo')

        exists.return_value = False
        self.assertFalse(self.channel._has_queue('foo'))

    def test_close_when_closed(self):
        self.channel.closed = True
        self.channel.close()

    def test_close_deletes_autodelete_fanout_queues(self):
        self.channel._fanout_queues = {'foo': ('foo', ''), 'bar': ('bar', '')}
        self.channel.auto_delete_queues = ['foo']
        self.channel.queue_delete = Mock(name='queue_delete')

        self.channel.close()
        self.channel.queue_delete.assert_has_calls([call('foo')])

    def test_close_client_close_raises(self):
        c = self.channel.client = Mock()
        c.connection.disconnect.side_effect = self.channel.ResponseError()

        self.channel.close()
        c.connection.disconnect.assert_called_with()

    def test_invalid_database_raises_ValueError(self):

        with self.assertRaises(ValueError):
            self.channel.connection.client.virtual_host = 'dwqeq'
            self.channel._connparams()

    @skip_if_not_module('redis')
    def test_connparams_allows_slash_in_db(self):
        self.channel.connection.client.virtual_host = '/123'
        self.assertEqual(self.channel._connparams()['db'], 123)

    @skip_if_not_module('redis')
    def test_connparams_db_can_be_int(self):
        self.channel.connection.client.virtual_host = 124
        self.assertEqual(self.channel._connparams()['db'], 124)

    def test_new_queue_with_auto_delete(self):
        redis.Channel._new_queue(self.channel, 'george', auto_delete=False)
        self.assertNotIn('george', self.channel.auto_delete_queues)
        redis.Channel._new_queue(self.channel, 'elaine', auto_delete=True)
        self.assertIn('elaine', self.channel.auto_delete_queues)

    @skip_if_not_module('redis')
    def test_connparams_regular_hostname(self):
        self.channel.connection.client.hostname = 'george.vandelay.com'
        self.assertEqual(
            self.channel._connparams()['host'],
            'george.vandelay.com',
        )

    def test_rotate_cycle_ValueError(self):
        cycle = self.channel._queue_cycle = ['kramer', 'jerry']
        self.channel._rotate_cycle('kramer')
        self.assertEqual(cycle, ['jerry', 'kramer'])
        self.channel._rotate_cycle('elaine')

    @skip_if_not_module('redis')
    def test_get_async_client(self):
        import redis as R
        KombuRedis = redis.Channel._get_async_client(self.channel)
        self.assertTrue(KombuRedis)

        Rv = getattr(R, 'VERSION', None)
        try:
            R.VERSION = (2, 4, 0)
            with self.assertRaises(VersionMismatch):
                redis.Channel._get_async_client(self.channel)
        finally:
            if Rv is not None:
                R.VERSION = Rv

    @skip_if_not_module('redis')
    def test_get_response_error(self):
        from redis.exceptions import ResponseError
        self.assertIs(redis.Channel._get_response_error(self.channel),
                      ResponseError)

    def test_register_with_event_loop(self):
        transport = self.connection.transport
        transport.cycle = Mock(name='cycle')
        transport.cycle.fds = {12: 'LISTEN', 13: 'BRPOP'}
        conn = Mock(name='conn')
        loop = Mock(name='loop')
        redis.Transport.register_with_event_loop(transport, conn, loop)
        transport.cycle.on_poll_init.assert_called_with(loop.poller)
        loop.call_repeatedly.assert_called_with(
            10, transport.cycle.maybe_restore_messages,
        )
        self.assertTrue(loop.on_tick.add.called)
        on_poll_start = loop.on_tick.add.call_args[0][0]

        on_poll_start()
        transport.cycle.on_poll_start.assert_called_with()
        loop.add_reader.assert_has_calls([
            call(12, transport.on_readable, 12),
            call(13, transport.on_readable, 13),
        ])

    def test_transport_on_readable(self):
        transport = self.connection.transport
        cycle = transport.cycle = Mock(name='cyle')
        cycle.on_readable.return_value = None

        redis.Transport.on_readable(transport, 13)
        cycle.on_readable.assert_called_with(13)
        cycle.on_readable.reset_mock()

        queue = Mock(name='queue')
        ret = (Mock(name='message'), queue)
        cycle.on_readable.return_value = ret
        with self.assertRaises(KeyError):
            redis.Transport.on_readable(transport, 14)

        cb = transport._callbacks[queue] = Mock(name='callback')
        redis.Transport.on_readable(transport, 14)
        cb.assert_called_with(ret[0])

    @skip_if_not_module('redis')
    def test_transport_get_errors(self):
        self.assertTrue(redis.Transport._get_errors(self.connection.transport))

    @skip_if_not_module('redis')
    def test_transport_driver_version(self):
        self.assertTrue(
            redis.Transport.driver_version(self.connection.transport),
        )

    @skip_if_not_module('redis')
    def test_transport_get_errors_when_InvalidData_used(self):
        from redis import exceptions

        class ID(Exception):
            pass

        DataError = getattr(exceptions, 'DataError', None)
        InvalidData = getattr(exceptions, 'InvalidData', None)
        exceptions.InvalidData = ID
        exceptions.DataError = None
        try:
            errors = redis.Transport._get_errors(self.connection.transport)
            self.assertTrue(errors)
            self.assertIn(ID, errors[1])
        finally:
            if DataError is not None:
                exceptions.DataError = DataError
            if InvalidData is not None:
                exceptions.InvalidData = InvalidData

    def test_empty_queues_key(self):
        channel = self.channel
        channel._in_poll = False
        key = channel.keyprefix_queue % 'celery'

        # Everything is fine, there is a list of queues.
        channel.client.sadd(key, 'celery\x06\x16\x06\x16celery')
        self.assertListEqual(channel.get_table('celery'),
                             [('celery', '', 'celery')])

        # ... then for some reason, the _kombu.binding.celery key gets lost
        channel.client.srem(key)

        # which raises a channel error so that the consumer/publisher
        # can recover by redeclaring the required entities.
        with self.assertRaises(InconsistencyError):
            self.channel.get_table('celery')

    @skip_if_not_module('redis')
    def test_socket_connection(self):
        with patch('kombu.transport.redis.Channel._create_client'):
            with Connection('redis+socket:///tmp/redis.sock') as conn:
                connparams = conn.default_channel._connparams()
                self.assertTrue(issubclass(
                    connparams['connection_class'],
                    redis.redis.UnixDomainSocketConnection,
                ))
                self.assertEqual(connparams['path'], '/tmp/redis.sock')


class test_Redis(Case):

    @skip_if_not_module('redis')
    def setUp(self):
        self.connection = Connection(transport=Transport)
        self.exchange = Exchange('test_Redis', type='direct')
        self.queue = Queue('test_Redis', self.exchange, 'test_Redis')

    def tearDown(self):
        self.connection.close()

    def test_publish__get(self):
        channel = self.connection.channel()
        producer = Producer(channel, self.exchange, routing_key='test_Redis')
        self.queue(channel).declare()

        producer.publish({'hello': 'world'})

        self.assertDictEqual(self.queue(channel).get().payload,
                             {'hello': 'world'})
        self.assertIsNone(self.queue(channel).get())
        self.assertIsNone(self.queue(channel).get())
        self.assertIsNone(self.queue(channel).get())

    def test_publish__consume(self):
        connection = Connection(transport=Transport)
        channel = connection.channel()
        producer = Producer(channel, self.exchange, routing_key='test_Redis')
        consumer = Consumer(channel, queues=[self.queue])

        producer.publish({'hello2': 'world2'})
        _received = []

        def callback(message_data, message):
            _received.append(message_data)
            message.ack()

        consumer.register_callback(callback)
        consumer.consume()

        self.assertIn(channel, channel.connection.cycle._channels)
        try:
            connection.drain_events(timeout=1)
            self.assertTrue(_received)
            with self.assertRaises(socket.timeout):
                connection.drain_events(timeout=0.01)
        finally:
            channel.close()

    def test_purge(self):
        channel = self.connection.channel()
        producer = Producer(channel, self.exchange, routing_key='test_Redis')
        self.queue(channel).declare()

        for i in range(10):
            producer.publish({'hello': 'world-%s' % (i, )})

        self.assertEqual(channel._size('test_Redis'), 10)
        self.assertEqual(self.queue(channel).purge(), 10)
        channel.close()

    def test_db_values(self):
        Connection(virtual_host=1,
                   transport=Transport).channel()

        Connection(virtual_host='1',
                   transport=Transport).channel()

        Connection(virtual_host='/1',
                   transport=Transport).channel()

        with self.assertRaises(Exception):
            Connection('redis:///foo').channel()

    def test_db_port(self):
        c1 = Connection(port=None, transport=Transport).channel()
        c1.close()

        c2 = Connection(port=9999, transport=Transport).channel()
        c2.close()

    def test_close_poller_not_active(self):
        c = Connection(transport=Transport).channel()
        cycle = c.connection.cycle
        c.client.connection
        c.close()
        self.assertNotIn(c, cycle._channels)

    def test_close_ResponseError(self):
        c = Connection(transport=Transport).channel()
        c.client.bgsave_raises_ResponseError = True
        c.close()

    def test_close_disconnects(self):
        c = Connection(transport=Transport).channel()
        conn1 = c.client.connection
        conn2 = c.subclient.connection
        c.close()
        self.assertTrue(conn1.disconnected)
        self.assertTrue(conn2.disconnected)

    def test_get__Empty(self):
        channel = self.connection.channel()
        with self.assertRaises(Empty):
            channel._get('does-not-exist')
        channel.close()

    def test_get_async_client(self):

        myredis, exceptions = _redis_modules()

        @module_exists(myredis, exceptions)
        def _do_test():
            conn = Connection(transport=Transport)
            chan = conn.channel()
            self.assertTrue(chan.Client)
            self.assertTrue(chan.ResponseError)
            self.assertTrue(conn.transport.connection_errors)
            self.assertTrue(conn.transport.channel_errors)

        _do_test()


def _redis_modules():

    class ConnectionError(Exception):
        pass

    class AuthenticationError(Exception):
        pass

    class InvalidData(Exception):
        pass

    class InvalidResponse(Exception):
        pass

    class ResponseError(Exception):
        pass

    exceptions = types.ModuleType('redis.exceptions')
    exceptions.ConnectionError = ConnectionError
    exceptions.AuthenticationError = AuthenticationError
    exceptions.InvalidData = InvalidData
    exceptions.InvalidResponse = InvalidResponse
    exceptions.ResponseError = ResponseError

    class Redis(object):
        pass

    myredis = types.ModuleType('redis')
    myredis.exceptions = exceptions
    myredis.Redis = Redis

    return myredis, exceptions


class test_MultiChannelPoller(Case):

    @skip_if_not_module('redis')
    def setUp(self):
        self.Poller = redis.MultiChannelPoller

    def test_on_poll_start(self):
        p = self.Poller()
        p._channels = []
        p.on_poll_start()
        p._register_BRPOP = Mock(name='_register_BRPOP')
        p._register_LISTEN = Mock(name='_register_LISTEN')

        chan1 = Mock(name='chan1')
        p._channels = [chan1]
        chan1.active_queues = []
        chan1.active_fanout_queues = []
        p.on_poll_start()

        chan1.active_queues = ['q1']
        chan1.active_fanout_queues = ['q2']
        chan1.qos.can_consume.return_value = False

        p.on_poll_start()
        p._register_LISTEN.assert_called_with(chan1)
        self.assertFalse(p._register_BRPOP.called)

        chan1.qos.can_consume.return_value = True
        p._register_LISTEN.reset_mock()
        p.on_poll_start()

        p._register_BRPOP.assert_called_with(chan1)
        p._register_LISTEN.assert_called_with(chan1)

    def test_on_poll_init(self):
        p = self.Poller()
        chan1 = Mock(name='chan1')
        p._channels = []
        poller = Mock(name='poller')
        p.on_poll_init(poller)
        self.assertIs(p.poller, poller)

        p._channels = [chan1]
        p.on_poll_init(poller)
        chan1.qos.restore_visible.assert_called_with(
            num=chan1.unacked_restore_limit,
        )

    def test_handle_event(self):
        p = self.Poller()
        chan = Mock(name='chan')
        p._fd_to_chan[13] = chan, 'BRPOP'
        chan.handlers = {'BRPOP': Mock(name='BRPOP')}

        chan.qos.can_consume.return_value = False
        p.handle_event(13, redis.READ)
        self.assertFalse(chan.handlers['BRPOP'].called)

        chan.qos.can_consume.return_value = True
        p.handle_event(13, redis.READ)
        chan.handlers['BRPOP'].assert_called_with()

        p.handle_event(13, redis.ERR)
        chan._poll_error.assert_called_with('BRPOP')

        p.handle_event(13, ~(redis.READ | redis.ERR))

    def test_fds(self):
        p = self.Poller()
        p._fd_to_chan = {1: 2}
        self.assertDictEqual(p.fds, p._fd_to_chan)

    def test_close_unregisters_fds(self):
        p = self.Poller()
        poller = p.poller = Mock()
        p._chan_to_sock.update({1: 1, 2: 2, 3: 3})

        p.close()

        self.assertEqual(poller.unregister.call_count, 3)
        u_args = poller.unregister.call_args_list

        self.assertItemsEqual(u_args, [((1, ), {}),
                                       ((2, ), {}),
                                       ((3, ), {})])

    def test_close_when_unregister_raises_KeyError(self):
        p = self.Poller()
        p.poller = Mock()
        p._chan_to_sock.update({1: 1})
        p.poller.unregister.side_effect = KeyError(1)
        p.close()

    def test_close_resets_state(self):
        p = self.Poller()
        p.poller = Mock()
        p._channels = Mock()
        p._fd_to_chan = Mock()
        p._chan_to_sock = Mock()

        p._chan_to_sock.itervalues.return_value = []
        p._chan_to_sock.values.return_value = []  # py3k

        p.close()
        p._channels.clear.assert_called_with()
        p._fd_to_chan.clear.assert_called_with()
        p._chan_to_sock.clear.assert_called_with()

    def test_register_when_registered_reregisters(self):
        p = self.Poller()
        p.poller = Mock()
        channel, client, type = Mock(), Mock(), Mock()
        sock = client.connection._sock = Mock()
        sock.fileno.return_value = 10

        p._chan_to_sock = {(channel, client, type): 6}
        p._register(channel, client, type)
        p.poller.unregister.assert_called_with(6)
        self.assertTupleEqual(p._fd_to_chan[10], (channel, type))
        self.assertEqual(p._chan_to_sock[(channel, client, type)], sock)
        p.poller.register.assert_called_with(sock, p.eventflags)

        # when client not connected yet
        client.connection._sock = None

        def after_connected():
            client.connection._sock = Mock()
        client.connection.connect.side_effect = after_connected

        p._register(channel, client, type)
        client.connection.connect.assert_called_with()

    def test_register_BRPOP(self):
        p = self.Poller()
        channel = Mock()
        channel.client.connection._sock = None
        p._register = Mock()

        channel._in_poll = False
        p._register_BRPOP(channel)
        self.assertEqual(channel._brpop_start.call_count, 1)
        self.assertEqual(p._register.call_count, 1)

        channel.client.connection._sock = Mock()
        p._chan_to_sock[(channel, channel.client, 'BRPOP')] = True
        channel._in_poll = True
        p._register_BRPOP(channel)
        self.assertEqual(channel._brpop_start.call_count, 1)
        self.assertEqual(p._register.call_count, 1)

    def test_register_LISTEN(self):
        p = self.Poller()
        channel = Mock()
        channel.subclient.connection._sock = None
        channel._in_listen = False
        p._register = Mock()

        p._register_LISTEN(channel)
        p._register.assert_called_with(channel, channel.subclient, 'LISTEN')
        self.assertEqual(p._register.call_count, 1)
        self.assertEqual(channel._subscribe.call_count, 1)

        channel._in_listen = True
        channel.subclient.connection._sock = Mock()
        p._register_LISTEN(channel)
        self.assertEqual(p._register.call_count, 1)
        self.assertEqual(channel._subscribe.call_count, 1)

    def create_get(self, events=None, queues=None, fanouts=None):
        _pr = [] if events is None else events
        _aq = [] if queues is None else queues
        _af = [] if fanouts is None else fanouts
        p = self.Poller()
        p.poller = Mock()
        p.poller.poll.return_value = _pr

        p._register_BRPOP = Mock()
        p._register_LISTEN = Mock()

        channel = Mock()
        p._channels = [channel]
        channel.active_queues = _aq
        channel.active_fanout_queues = _af

        return p, channel

    def test_get_no_actions(self):
        p, channel = self.create_get()

        with self.assertRaises(redis.Empty):
            p.get()

    def test_qos_reject(self):
        p, channel = self.create_get()
        qos = redis.QoS(channel)
        qos.ack = Mock(name='Qos.ack')
        qos.reject(1234)
        qos.ack.assert_called_with(1234)

    def test_get_brpop_qos_allow(self):
        p, channel = self.create_get(queues=['a_queue'])
        channel.qos.can_consume.return_value = True

        with self.assertRaises(redis.Empty):
            p.get()

        p._register_BRPOP.assert_called_with(channel)

    def test_get_brpop_qos_disallow(self):
        p, channel = self.create_get(queues=['a_queue'])
        channel.qos.can_consume.return_value = False

        with self.assertRaises(redis.Empty):
            p.get()

        self.assertFalse(p._register_BRPOP.called)

    def test_get_listen(self):
        p, channel = self.create_get(fanouts=['f_queue'])

        with self.assertRaises(redis.Empty):
            p.get()

        p._register_LISTEN.assert_called_with(channel)

    def test_get_receives_ERR(self):
        p, channel = self.create_get(events=[(1, eventio.ERR)])
        p._fd_to_chan[1] = (channel, 'BRPOP')

        with self.assertRaises(redis.Empty):
            p.get()

        channel._poll_error.assert_called_with('BRPOP')

    def test_get_receives_multiple(self):
        p, channel = self.create_get(events=[(1, eventio.ERR),
                                             (1, eventio.ERR)])
        p._fd_to_chan[1] = (channel, 'BRPOP')

        with self.assertRaises(redis.Empty):
            p.get()

        channel._poll_error.assert_called_with('BRPOP')


class test_Mutex(Case):

    @skip_if_not_module('redis')
    def test_mutex(self, lock_id='xxx'):
        client = Mock(name='client')
        with patch('kombu.transport.redis.uuid') as uuid:
            # Won
            uuid.return_value = lock_id
            client.setnx.return_value = True
            client.pipeline = ContextMock()
            pipe = client.pipeline.return_value
            pipe.get.return_value = lock_id
            held = False
            with redis.Mutex(client, 'foo1', 100):
                held = True
            self.assertTrue(held)
            client.setnx.assert_called_with('foo1', lock_id)
            pipe.get.return_value = 'yyy'
            held = False
            with redis.Mutex(client, 'foo1', 100):
                held = True
            self.assertTrue(held)

            # Did not win
            client.expire.reset_mock()
            pipe.get.return_value = lock_id
            client.setnx.return_value = False
            with self.assertRaises(redis.MutexHeld):
                held = False
                with redis.Mutex(client, 'foo1', '100'):
                    held = True
                self.assertFalse(held)
            client.ttl.return_value = 0
            with self.assertRaises(redis.MutexHeld):
                held = False
                with redis.Mutex(client, 'foo1', '100'):
                    held = True
                self.assertFalse(held)
            self.assertTrue(client.expire.called)

            # Wins but raises WatchError (and that is ignored)
            client.setnx.return_value = True
            pipe.watch.side_effect = redis.redis.WatchError()
            held = False
            with redis.Mutex(client, 'foo1', 100):
                held = True
            self.assertTrue(held)
