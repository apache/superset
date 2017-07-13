from __future__ import absolute_import

import pickle
import socket

from copy import copy, deepcopy

from kombu import Connection, Consumer, Producer, parse_url
from kombu.connection import Resource
from kombu.five import items, range

from .case import Case, Mock, SkipTest, patch, skip_if_not_module
from .mocks import Transport


class test_connection_utils(Case):

    def setUp(self):
        self.url = 'amqp://user:pass@localhost:5672/my/vhost'
        self.nopass = 'amqp://user:**@localhost:5672/my/vhost'
        self.expected = {
            'transport': 'amqp',
            'userid': 'user',
            'password': 'pass',
            'hostname': 'localhost',
            'port': 5672,
            'virtual_host': 'my/vhost',
        }

    def test_parse_url(self):
        result = parse_url(self.url)
        self.assertDictEqual(result, self.expected)

    def test_parse_generated_as_uri(self):
        conn = Connection(self.url)
        info = conn.info()
        for k, v in self.expected.items():
            self.assertEqual(info[k], v)
        # by default almost the same- no password
        self.assertEqual(conn.as_uri(), self.nopass)
        self.assertEqual(conn.as_uri(include_password=True), self.url)

    def test_as_uri_when_prefix(self):
        conn = Connection('redis+socket:///var/spool/x/y/z/redis.sock')
        self.assertEqual(
            conn.as_uri(), 'redis+socket:///var/spool/x/y/z/redis.sock',
        )

    @skip_if_not_module('pymongo')
    def test_as_uri_when_mongodb(self):
        x = Connection('mongodb://localhost')
        self.assertTrue(x.as_uri())

    def test_bogus_scheme(self):
        with self.assertRaises(KeyError):
            Connection('bogus://localhost:7421').transport

    def assert_info(self, conn, **fields):
        info = conn.info()
        for field, expected in items(fields):
            self.assertEqual(info[field], expected)

    def test_rabbitmq_example_urls(self):
        # see Appendix A of http://www.rabbitmq.com/uri-spec.html

        self.assert_info(
            Connection('amqp://user:pass@host:10000/vhost'),
            userid='user', password='pass', hostname='host',
            port=10000, virtual_host='vhost',
        )

        self.assert_info(
            Connection('amqp://user%61:%61pass@ho%61st:10000/v%2fhost'),
            userid='usera', password='apass', hostname='hoast',
            port=10000, virtual_host='v/host',
        )

        self.assert_info(
            Connection('amqp://'),
            userid='guest', password='guest', hostname='localhost',
            port=5672, virtual_host='/',
        )

        self.assert_info(
            Connection('amqp://:@/'),
            userid='guest', password='guest', hostname='localhost',
            port=5672, virtual_host='/',
        )

        self.assert_info(
            Connection('amqp://user@/'),
            userid='user', password='guest', hostname='localhost',
            port=5672, virtual_host='/',
        )

        self.assert_info(
            Connection('amqp://user:pass@/'),
            userid='user', password='pass', hostname='localhost',
            port=5672, virtual_host='/',
        )

        self.assert_info(
            Connection('amqp://host'),
            userid='guest', password='guest', hostname='host',
            port=5672, virtual_host='/',
        )

        self.assert_info(
            Connection('amqp://:10000'),
            userid='guest', password='guest', hostname='localhost',
            port=10000, virtual_host='/',
        )

        self.assert_info(
            Connection('amqp:///vhost'),
            userid='guest', password='guest', hostname='localhost',
            port=5672, virtual_host='vhost',
        )

        self.assert_info(
            Connection('amqp://host/'),
            userid='guest', password='guest', hostname='host',
            port=5672, virtual_host='/',
        )

        self.assert_info(
            Connection('amqp://host/%2f'),
            userid='guest', password='guest', hostname='host',
            port=5672, virtual_host='/',
        )

    def test_url_IPV6(self):
        raise SkipTest("urllib can't parse ipv6 urls")

        self.assert_info(
            Connection('amqp://[::1]'),
            userid='guest', password='guest', hostname='[::1]',
            port=5672, virtual_host='/',
        )

    def test_connection_copy(self):
        conn = Connection(self.url, alternates=['amqp://host'])
        clone = deepcopy(conn)
        self.assertEqual(clone.alt, ['amqp://host'])


class test_Connection(Case):

    def setUp(self):
        self.conn = Connection(port=5672, transport=Transport)

    def test_establish_connection(self):
        conn = self.conn
        conn.connect()
        self.assertTrue(conn.connection.connected)
        self.assertEqual(conn.host, 'localhost:5672')
        channel = conn.channel()
        self.assertTrue(channel.open)
        self.assertEqual(conn.drain_events(), 'event')
        _connection = conn.connection
        conn.close()
        self.assertFalse(_connection.connected)
        self.assertIsInstance(conn.transport, Transport)

    def test_multiple_urls(self):
        conn1 = Connection('amqp://foo;amqp://bar')
        self.assertEqual(conn1.hostname, 'foo')
        self.assertListEqual(conn1.alt, ['amqp://foo', 'amqp://bar'])

        conn2 = Connection(['amqp://foo', 'amqp://bar'])
        self.assertEqual(conn2.hostname, 'foo')
        self.assertListEqual(conn2.alt, ['amqp://foo', 'amqp://bar'])

    def test_collect(self):
        connection = Connection('memory://')
        trans = connection._transport = Mock(name='transport')
        _collect = trans._collect = Mock(name='transport._collect')
        _close = connection._close = Mock(name='connection._close')
        connection.declared_entities = Mock(name='decl_entities')
        uconn = connection._connection = Mock(name='_connection')
        connection.collect()

        self.assertFalse(_close.called)
        _collect.assert_called_with(uconn)
        connection.declared_entities.clear.assert_called_with()
        self.assertIsNone(trans.client)
        self.assertIsNone(connection._transport)
        self.assertIsNone(connection._connection)

    def test_collect_no_transport(self):
        connection = Connection('memory://')
        connection._transport = None
        connection._close = Mock()
        connection.collect()
        connection._close.assert_called_with()

        connection._close.side_effect = socket.timeout()
        connection.collect()

    def test_collect_transport_gone(self):
        connection = Connection('memory://')
        uconn = connection._connection = Mock(name='conn._conn')
        trans = connection._transport = Mock(name='transport')
        collect = trans._collect = Mock(name='transport._collect')

        def se(conn):
            connection._transport = None
        collect.side_effect = se

        connection.collect()
        collect.assert_called_with(uconn)
        self.assertIsNone(connection._transport)

    def test_uri_passthrough(self):
        transport = Mock(name='transport')
        with patch('kombu.connection.get_transport_cls') as gtc:
            gtc.return_value = transport
            transport.can_parse_url = True
            with patch('kombu.connection.parse_url') as parse_url:
                c = Connection('foo+mysql://some_host')
                self.assertEqual(c.transport_cls, 'foo')
                self.assertFalse(parse_url.called)
                self.assertEqual(c.hostname, 'mysql://some_host')
                self.assertTrue(c.as_uri().startswith('foo+'))
            with patch('kombu.connection.parse_url') as parse_url:
                c = Connection('mysql://some_host', transport='foo')
                self.assertEqual(c.transport_cls, 'foo')
                self.assertFalse(parse_url.called)
                self.assertEqual(c.hostname, 'mysql://some_host')
        c = Connection('pyamqp+sqlite://some_host')
        self.assertTrue(c.as_uri().startswith('pyamqp+'))

    def test_default_ensure_callback(self):
        with patch('kombu.connection.logger') as logger:
            c = Connection(transport=Mock)
            c._default_ensure_callback(KeyError(), 3)
            self.assertTrue(logger.error.called)

    def test_ensure_connection_on_error(self):
        c = Connection('amqp://A;amqp://B')
        with patch('kombu.connection.retry_over_time') as rot:
            c.ensure_connection()
            self.assertTrue(rot.called)

            args = rot.call_args[0]
            cb = args[4]
            intervals = iter([1, 2, 3, 4, 5])
            self.assertEqual(cb(KeyError(), intervals, 0), 0)
            self.assertEqual(cb(KeyError(), intervals, 1), 1)
            self.assertEqual(cb(KeyError(), intervals, 2), 0)
            self.assertEqual(cb(KeyError(), intervals, 3), 2)
            self.assertEqual(cb(KeyError(), intervals, 4), 0)
            self.assertEqual(cb(KeyError(), intervals, 5), 3)
            self.assertEqual(cb(KeyError(), intervals, 6), 0)
            self.assertEqual(cb(KeyError(), intervals, 7), 4)

            errback = Mock()
            c.ensure_connection(errback=errback)
            args = rot.call_args[0]
            cb = args[4]
            self.assertEqual(cb(KeyError(), intervals, 0), 0)
            self.assertTrue(errback.called)

    def test_supports_heartbeats(self):
        c = Connection(transport=Mock)
        c.transport.supports_heartbeats = False
        self.assertFalse(c.supports_heartbeats)

    def test_is_evented(self):
        c = Connection(transport=Mock)
        c.transport.supports_ev = False
        self.assertFalse(c.is_evented)

    def test_register_with_event_loop(self):
        c = Connection(transport=Mock)
        loop = Mock(name='loop')
        c.register_with_event_loop(loop)
        c.transport.register_with_event_loop.assert_called_with(
            c.connection, loop,
        )

    def test_manager(self):
        c = Connection(transport=Mock)
        self.assertIs(c.manager, c.transport.manager)

    def test_copy(self):
        c = Connection('amqp://example.com')
        self.assertEqual(copy(c).info(), c.info())

    def test_copy_multiples(self):
        c = Connection('amqp://A.example.com;amqp://B.example.com')
        self.assertTrue(c.alt)
        d = copy(c)
        self.assertEqual(d.alt, c.alt)

    def test_switch(self):
        c = Connection('amqp://foo')
        c._closed = True
        c.switch('redis://example.com//3')
        self.assertFalse(c._closed)
        self.assertEqual(c.hostname, 'example.com')
        self.assertEqual(c.transport_cls, 'redis')
        self.assertEqual(c.virtual_host, '/3')

    def test_maybe_switch_next(self):
        c = Connection('amqp://foo;redis://example.com//3')
        c.maybe_switch_next()
        self.assertFalse(c._closed)
        self.assertEqual(c.hostname, 'example.com')
        self.assertEqual(c.transport_cls, 'redis')
        self.assertEqual(c.virtual_host, '/3')

    def test_maybe_switch_next_no_cycle(self):
        c = Connection('amqp://foo')
        c.maybe_switch_next()
        self.assertFalse(c._closed)
        self.assertEqual(c.hostname, 'foo')
        self.assertIn(c.transport_cls, ('librabbitmq', 'pyamqp', 'amqp'))

    def test_heartbeat_check(self):
        c = Connection(transport=Transport)
        c.transport.heartbeat_check = Mock()
        c.heartbeat_check(3)
        c.transport.heartbeat_check.assert_called_with(c.connection, rate=3)

    def test_completes_cycle_no_cycle(self):
        c = Connection('amqp://')
        self.assertTrue(c.completes_cycle(0))
        self.assertTrue(c.completes_cycle(1))

    def test_completes_cycle(self):
        c = Connection('amqp://a;amqp://b;amqp://c')
        self.assertFalse(c.completes_cycle(0))
        self.assertFalse(c.completes_cycle(1))
        self.assertTrue(c.completes_cycle(2))

    def test__enter____exit__(self):
        conn = self.conn
        context = conn.__enter__()
        self.assertIs(context, conn)
        conn.connect()
        self.assertTrue(conn.connection.connected)
        conn.__exit__()
        self.assertIsNone(conn.connection)
        conn.close()    # again

    def test_close_survives_connerror(self):

        class _CustomError(Exception):
            pass

        class MyTransport(Transport):
            connection_errors = (_CustomError, )

            def close_connection(self, connection):
                raise _CustomError('foo')

        conn = Connection(transport=MyTransport)
        conn.connect()
        conn.close()
        self.assertTrue(conn._closed)

    def test_close_when_default_channel(self):
        conn = self.conn
        conn._default_channel = Mock()
        conn._close()
        conn._default_channel.close.assert_called_with()

    def test_close_when_default_channel_close_raises(self):

        class Conn(Connection):

            @property
            def connection_errors(self):
                return (KeyError, )

        conn = Conn('memory://')
        conn._default_channel = Mock()
        conn._default_channel.close.side_effect = KeyError()

        conn._close()
        conn._default_channel.close.assert_called_with()

    def test_revive_when_default_channel(self):
        conn = self.conn
        defchan = conn._default_channel = Mock()
        conn.revive(Mock())

        defchan.close.assert_called_with()
        self.assertIsNone(conn._default_channel)

    def test_ensure_connection(self):
        self.assertTrue(self.conn.ensure_connection())

    def test_ensure_success(self):
        def publish():
            return 'foobar'

        ensured = self.conn.ensure(None, publish)
        self.assertEqual(ensured(), 'foobar')

    def test_ensure_failure(self):
        class _CustomError(Exception):
            pass

        def publish():
            raise _CustomError('bar')

        ensured = self.conn.ensure(None, publish)
        with self.assertRaises(_CustomError):
            ensured()

    def test_ensure_connection_failure(self):
        class _ConnectionError(Exception):
            pass

        def publish():
            raise _ConnectionError('failed connection')

        self.conn.transport.connection_errors = (_ConnectionError,)
        ensured = self.conn.ensure(self.conn, publish)
        with self.assertRaises(_ConnectionError):
            ensured()

    def test_autoretry(self):
        myfun = Mock()

        self.conn.transport.connection_errors = (KeyError, )

        def on_call(*args, **kwargs):
            myfun.side_effect = None
            raise KeyError('foo')

        myfun.side_effect = on_call
        insured = self.conn.autoretry(myfun)
        insured()

        self.assertTrue(myfun.called)

    def test_SimpleQueue(self):
        conn = self.conn
        q = conn.SimpleQueue('foo')
        self.assertIs(q.channel, conn.default_channel)
        chan = conn.channel()
        q2 = conn.SimpleQueue('foo', channel=chan)
        self.assertIs(q2.channel, chan)

    def test_SimpleBuffer(self):
        conn = self.conn
        q = conn.SimpleBuffer('foo')
        self.assertIs(q.channel, conn.default_channel)
        chan = conn.channel()
        q2 = conn.SimpleBuffer('foo', channel=chan)
        self.assertIs(q2.channel, chan)

    def test_Producer(self):
        conn = self.conn
        self.assertIsInstance(conn.Producer(), Producer)
        self.assertIsInstance(conn.Producer(conn.default_channel), Producer)

    def test_Consumer(self):
        conn = self.conn
        self.assertIsInstance(conn.Consumer(queues=[]), Consumer)
        self.assertIsInstance(conn.Consumer(queues=[],
                              channel=conn.default_channel), Consumer)

    def test__repr__(self):
        self.assertTrue(repr(self.conn))

    def test__reduce__(self):
        x = pickle.loads(pickle.dumps(self.conn))
        self.assertDictEqual(x.info(), self.conn.info())

    def test_channel_errors(self):

        class MyTransport(Transport):
            channel_errors = (KeyError, ValueError)

        conn = Connection(transport=MyTransport)
        self.assertTupleEqual(conn.channel_errors, (KeyError, ValueError))

    def test_connection_errors(self):

        class MyTransport(Transport):
            connection_errors = (KeyError, ValueError)

        conn = Connection(transport=MyTransport)
        self.assertTupleEqual(conn.connection_errors, (KeyError, ValueError))


class test_Connection_with_transport_options(Case):

    transport_options = {'pool_recycler': 3600, 'echo': True}

    def setUp(self):
        self.conn = Connection(port=5672, transport=Transport,
                               transport_options=self.transport_options)

    def test_establish_connection(self):
        conn = self.conn
        self.assertEqual(conn.transport_options, self.transport_options)


class xResource(Resource):

    def setup(self):
        pass


class ResourceCase(Case):
    abstract = True

    def create_resource(self, limit, preload):
        raise NotImplementedError('subclass responsibility')

    def assertState(self, P, avail, dirty):
        self.assertEqual(P._resource.qsize(), avail)
        self.assertEqual(len(P._dirty), dirty)

    def test_setup(self):
        if self.abstract:
            with self.assertRaises(NotImplementedError):
                Resource()

    def test_acquire__release(self):
        if self.abstract:
            return
        P = self.create_resource(10, 0)
        self.assertState(P, 10, 0)
        chans = [P.acquire() for _ in range(10)]
        self.assertState(P, 0, 10)
        with self.assertRaises(P.LimitExceeded):
            P.acquire()
        chans.pop().release()
        self.assertState(P, 1, 9)
        [chan.release() for chan in chans]
        self.assertState(P, 10, 0)

    def test_acquire_prepare_raises(self):
        if self.abstract:
            return
        P = self.create_resource(10, 0)

        self.assertEqual(len(P._resource.queue), 10)
        P.prepare = Mock()
        P.prepare.side_effect = IOError()
        with self.assertRaises(IOError):
            P.acquire(block=True)
        self.assertEqual(len(P._resource.queue), 10)

    def test_acquire_no_limit(self):
        if self.abstract:
            return
        P = self.create_resource(None, 0)
        P.acquire().release()

    def test_replace_when_limit(self):
        if self.abstract:
            return
        P = self.create_resource(10, 0)
        r = P.acquire()
        P._dirty = Mock()
        P.close_resource = Mock()

        P.replace(r)
        P._dirty.discard.assert_called_with(r)
        P.close_resource.assert_called_with(r)

    def test_replace_no_limit(self):
        if self.abstract:
            return
        P = self.create_resource(None, 0)
        r = P.acquire()
        P._dirty = Mock()
        P.close_resource = Mock()

        P.replace(r)
        self.assertFalse(P._dirty.discard.called)
        P.close_resource.assert_called_with(r)

    def test_interface_prepare(self):
        if not self.abstract:
            return
        x = xResource()
        self.assertEqual(x.prepare(10), 10)

    def test_force_close_all_handles_AttributeError(self):
        if self.abstract:
            return
        P = self.create_resource(10, 10)
        cr = P.collect_resource = Mock()
        cr.side_effect = AttributeError('x')

        P.acquire()
        self.assertTrue(P._dirty)

        P.force_close_all()

    def test_force_close_all_no_mutex(self):
        if self.abstract:
            return
        P = self.create_resource(10, 10)
        P.close_resource = Mock()

        m = P._resource = Mock()
        m.mutex = None
        m.queue.pop.side_effect = IndexError

        P.force_close_all()

    def test_add_when_empty(self):
        if self.abstract:
            return
        P = self.create_resource(None, None)
        P._resource.queue[:] = []
        self.assertFalse(P._resource.queue)
        P._add_when_empty()
        self.assertTrue(P._resource.queue)


class test_ConnectionPool(ResourceCase):
    abstract = False

    def create_resource(self, limit, preload):
        return Connection(port=5672, transport=Transport).Pool(limit, preload)

    def test_setup(self):
        P = self.create_resource(10, 2)
        q = P._resource.queue
        self.assertIsNotNone(q[0]._connection)
        self.assertIsNotNone(q[1]._connection)
        self.assertIsNone(q[2]()._connection)

    def test_acquire_raises_evaluated(self):
        P = self.create_resource(1, 0)
        # evaluate the connection first
        r = P.acquire()
        r.release()
        P.prepare = Mock()
        P.prepare.side_effect = MemoryError()
        P.release = Mock()
        with self.assertRaises(MemoryError):
            with P.acquire():
                assert False
        P.release.assert_called_with(r)

    def test_release_no__debug(self):
        P = self.create_resource(10, 2)
        R = Mock()
        R._debug.side_effect = AttributeError()
        P.release_resource(R)

    def test_setup_no_limit(self):
        P = self.create_resource(None, None)
        self.assertFalse(P._resource.queue)
        self.assertIsNone(P.limit)

    def test_prepare_not_callable(self):
        P = self.create_resource(None, None)
        conn = Connection('memory://')
        self.assertIs(P.prepare(conn), conn)

    def test_acquire_channel(self):
        P = self.create_resource(10, 0)
        with P.acquire_channel() as (conn, channel):
            self.assertIs(channel, conn.default_channel)


class test_ChannelPool(ResourceCase):
    abstract = False

    def create_resource(self, limit, preload):
        return Connection(port=5672, transport=Transport) \
            .ChannelPool(limit, preload)

    def test_setup(self):
        P = self.create_resource(10, 2)
        q = P._resource.queue
        self.assertTrue(q[0].basic_consume)
        self.assertTrue(q[1].basic_consume)
        with self.assertRaises(AttributeError):
            getattr(q[2], 'basic_consume')

    def test_setup_no_limit(self):
        P = self.create_resource(None, None)
        self.assertFalse(P._resource.queue)
        self.assertIsNone(P.limit)

    def test_prepare_not_callable(self):
        P = self.create_resource(10, 0)
        conn = Connection('memory://')
        chan = conn.default_channel
        self.assertIs(P.prepare(chan), chan)
