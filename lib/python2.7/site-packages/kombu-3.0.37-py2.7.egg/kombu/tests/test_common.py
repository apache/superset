from __future__ import absolute_import

import socket

from amqp import RecoverableConnectionError

from kombu import common
from kombu.common import (
    Broadcast, maybe_declare,
    send_reply, collect_replies,
    declaration_cached, ignore_errors,
    QoS, PREFETCH_COUNT_MAX,
)

from .case import Case, ContextMock, Mock, MockPool, patch


class test_ignore_errors(Case):

    def test_ignored(self):
        connection = Mock()
        connection.channel_errors = (KeyError, )
        connection.connection_errors = (KeyError, )

        with ignore_errors(connection):
            raise KeyError()

        def raising():
            raise KeyError()

        ignore_errors(connection, raising)

        connection.channel_errors = connection.connection_errors = \
            ()

        with self.assertRaises(KeyError):
            with ignore_errors(connection):
                raise KeyError()


class test_declaration_cached(Case):

    def test_when_cached(self):
        chan = Mock()
        chan.connection.client.declared_entities = ['foo']
        self.assertTrue(declaration_cached('foo', chan))

    def test_when_not_cached(self):
        chan = Mock()
        chan.connection.client.declared_entities = ['bar']
        self.assertFalse(declaration_cached('foo', chan))


class test_Broadcast(Case):

    def test_arguments(self):
        q = Broadcast(name='test_Broadcast')
        self.assertTrue(q.name.startswith('bcast.'))
        self.assertEqual(q.alias, 'test_Broadcast')
        self.assertTrue(q.auto_delete)
        self.assertEqual(q.exchange.name, 'test_Broadcast')
        self.assertEqual(q.exchange.type, 'fanout')

        q = Broadcast('test_Broadcast', 'explicit_queue_name')
        self.assertEqual(q.name, 'explicit_queue_name')
        self.assertEqual(q.exchange.name, 'test_Broadcast')

        q2 = q(Mock())
        self.assertEqual(q2.name, q.name)


class test_maybe_declare(Case):

    def test_cacheable(self):
        channel = Mock()
        client = channel.connection.client = Mock()
        client.declared_entities = set()
        entity = Mock()
        entity.can_cache_declaration = True
        entity.auto_delete = False
        entity.is_bound = True
        entity.channel = channel

        maybe_declare(entity, channel)
        self.assertEqual(entity.declare.call_count, 1)
        self.assertIn(
            hash(entity), channel.connection.client.declared_entities,
        )

        maybe_declare(entity, channel)
        self.assertEqual(entity.declare.call_count, 1)

        entity.channel.connection = None
        with self.assertRaises(RecoverableConnectionError):
            maybe_declare(entity)

    def test_binds_entities(self):
        channel = Mock()
        channel.connection.client.declared_entities = set()
        entity = Mock()
        entity.can_cache_declaration = True
        entity.is_bound = False
        entity.bind.return_value = entity
        entity.bind.return_value.channel = channel

        maybe_declare(entity, channel)
        entity.bind.assert_called_with(channel)

    def test_with_retry(self):
        channel = Mock()
        client = channel.connection.client = Mock()
        client.declared_entities = set()
        entity = Mock()
        entity.can_cache_declaration = True
        entity.is_bound = True
        entity.channel = channel

        maybe_declare(entity, channel, retry=True)
        self.assertTrue(channel.connection.client.ensure.call_count)


class test_replies(Case):

    def test_send_reply(self):
        req = Mock()
        req.content_type = 'application/json'
        req.content_encoding = 'binary'
        req.properties = {'reply_to': 'hello',
                          'correlation_id': 'world'}
        channel = Mock()
        exchange = Mock()
        exchange.is_bound = True
        exchange.channel = channel
        producer = Mock()
        producer.channel = channel
        producer.channel.connection.client.declared_entities = set()
        send_reply(exchange, req, {'hello': 'world'}, producer)

        self.assertTrue(producer.publish.call_count)
        args = producer.publish.call_args
        self.assertDictEqual(args[0][0], {'hello': 'world'})
        self.assertDictEqual(args[1], {'exchange': exchange,
                                       'routing_key': 'hello',
                                       'correlation_id': 'world',
                                       'serializer': 'json',
                                       'retry': False,
                                       'retry_policy': None,
                                       'content_encoding': 'binary'})

    @patch('kombu.common.itermessages')
    def test_collect_replies_with_ack(self, itermessages):
        conn, channel, queue = Mock(), Mock(), Mock()
        body, message = Mock(), Mock()
        itermessages.return_value = [(body, message)]
        it = collect_replies(conn, channel, queue, no_ack=False)
        m = next(it)
        self.assertIs(m, body)
        itermessages.assert_called_with(conn, channel, queue, no_ack=False)
        message.ack.assert_called_with()

        with self.assertRaises(StopIteration):
            next(it)

        channel.after_reply_message_received.assert_called_with(queue.name)

    @patch('kombu.common.itermessages')
    def test_collect_replies_no_ack(self, itermessages):
        conn, channel, queue = Mock(), Mock(), Mock()
        body, message = Mock(), Mock()
        itermessages.return_value = [(body, message)]
        it = collect_replies(conn, channel, queue)
        m = next(it)
        self.assertIs(m, body)
        itermessages.assert_called_with(conn, channel, queue, no_ack=True)
        self.assertFalse(message.ack.called)

    @patch('kombu.common.itermessages')
    def test_collect_replies_no_replies(self, itermessages):
        conn, channel, queue = Mock(), Mock(), Mock()
        itermessages.return_value = []
        it = collect_replies(conn, channel, queue)
        with self.assertRaises(StopIteration):
            next(it)

        self.assertFalse(channel.after_reply_message_received.called)


class test_insured(Case):

    @patch('kombu.common.logger')
    def test_ensure_errback(self, logger):
        common._ensure_errback('foo', 30)
        self.assertTrue(logger.error.called)

    def test_revive_connection(self):
        on_revive = Mock()
        channel = Mock()
        common.revive_connection(Mock(), channel, on_revive)
        on_revive.assert_called_with(channel)

        common.revive_connection(Mock(), channel, None)

    def get_insured_mocks(self, insured_returns=('works', 'ignored')):
        conn = ContextMock()
        pool = MockPool(conn)
        fun = Mock()
        insured = conn.autoretry.return_value = Mock()
        insured.return_value = insured_returns
        return conn, pool, fun, insured

    def test_insured(self):
        conn, pool, fun, insured = self.get_insured_mocks()

        ret = common.insured(pool, fun, (2, 2), {'foo': 'bar'})
        self.assertEqual(ret, 'works')
        conn.ensure_connection.assert_called_with(
            errback=common._ensure_errback,
        )

        self.assertTrue(insured.called)
        i_args, i_kwargs = insured.call_args
        self.assertTupleEqual(i_args, (2, 2))
        self.assertDictEqual(i_kwargs, {'foo': 'bar',
                                        'connection': conn})

        self.assertTrue(conn.autoretry.called)
        ar_args, ar_kwargs = conn.autoretry.call_args
        self.assertTupleEqual(ar_args, (fun, conn.default_channel))
        self.assertTrue(ar_kwargs.get('on_revive'))
        self.assertTrue(ar_kwargs.get('errback'))

    def test_insured_custom_errback(self):
        conn, pool, fun, insured = self.get_insured_mocks()

        custom_errback = Mock()
        common.insured(pool, fun, (2, 2), {'foo': 'bar'},
                       errback=custom_errback)
        conn.ensure_connection.assert_called_with(errback=custom_errback)


class MockConsumer(object):
    consumers = set()

    def __init__(self, channel, queues=None, callbacks=None, **kwargs):
        self.channel = channel
        self.queues = queues
        self.callbacks = callbacks

    def __enter__(self):
        self.consumers.add(self)
        return self

    def __exit__(self, *exc_info):
        self.consumers.discard(self)


class test_itermessages(Case):

    class MockConnection(object):
        should_raise_timeout = False

        def drain_events(self, **kwargs):
            if self.should_raise_timeout:
                raise socket.timeout()
            for consumer in MockConsumer.consumers:
                for callback in consumer.callbacks:
                    callback('body', 'message')

    def test_default(self):
        conn = self.MockConnection()
        channel = Mock()
        channel.connection.client = conn
        conn.Consumer = MockConsumer
        it = common.itermessages(conn, channel, 'q', limit=1)

        ret = next(it)
        self.assertTupleEqual(ret, ('body', 'message'))

        with self.assertRaises(StopIteration):
            next(it)

    def test_when_raises_socket_timeout(self):
        conn = self.MockConnection()
        conn.should_raise_timeout = True
        channel = Mock()
        channel.connection.client = conn
        conn.Consumer = MockConsumer
        it = common.itermessages(conn, channel, 'q', limit=1)

        with self.assertRaises(StopIteration):
            next(it)

    @patch('kombu.common.deque')
    def test_when_raises_IndexError(self, deque):
        deque_instance = deque.return_value = Mock()
        deque_instance.popleft.side_effect = IndexError()
        conn = self.MockConnection()
        channel = Mock()
        conn.Consumer = MockConsumer
        it = common.itermessages(conn, channel, 'q', limit=1)

        with self.assertRaises(StopIteration):
            next(it)


class test_QoS(Case):

    class _QoS(QoS):
        def __init__(self, value):
            self.value = value
            QoS.__init__(self, None, value)

        def set(self, value):
            return value

    def test_qos_exceeds_16bit(self):
        with patch('kombu.common.logger') as logger:
            callback = Mock()
            qos = QoS(callback, 10)
            qos.prev = 100
            # cannot use 2 ** 32 because of a bug on OSX Py2.5:
            # https://jira.mongodb.org/browse/PYTHON-389
            qos.set(4294967296)
            self.assertTrue(logger.warn.called)
            callback.assert_called_with(prefetch_count=0)

    def test_qos_increment_decrement(self):
        qos = self._QoS(10)
        self.assertEqual(qos.increment_eventually(), 11)
        self.assertEqual(qos.increment_eventually(3), 14)
        self.assertEqual(qos.increment_eventually(-30), 14)
        self.assertEqual(qos.decrement_eventually(7), 7)
        self.assertEqual(qos.decrement_eventually(), 6)

    def test_qos_disabled_increment_decrement(self):
        qos = self._QoS(0)
        self.assertEqual(qos.increment_eventually(), 0)
        self.assertEqual(qos.increment_eventually(3), 0)
        self.assertEqual(qos.increment_eventually(-30), 0)
        self.assertEqual(qos.decrement_eventually(7), 0)
        self.assertEqual(qos.decrement_eventually(), 0)
        self.assertEqual(qos.decrement_eventually(10), 0)

    def test_qos_thread_safe(self):
        qos = self._QoS(10)

        def add():
            for i in range(1000):
                qos.increment_eventually()

        def sub():
            for i in range(1000):
                qos.decrement_eventually()

        def threaded(funs):
            from threading import Thread
            threads = [Thread(target=fun) for fun in funs]
            for thread in threads:
                thread.start()
            for thread in threads:
                thread.join()

        threaded([add, add])
        self.assertEqual(qos.value, 2010)

        qos.value = 1000
        threaded([add, sub])  # n = 2
        self.assertEqual(qos.value, 1000)

    def test_exceeds_short(self):
        qos = QoS(Mock(), PREFETCH_COUNT_MAX - 1)
        qos.update()
        self.assertEqual(qos.value, PREFETCH_COUNT_MAX - 1)
        qos.increment_eventually()
        self.assertEqual(qos.value, PREFETCH_COUNT_MAX)
        qos.increment_eventually()
        self.assertEqual(qos.value, PREFETCH_COUNT_MAX + 1)
        qos.decrement_eventually()
        self.assertEqual(qos.value, PREFETCH_COUNT_MAX)
        qos.decrement_eventually()
        self.assertEqual(qos.value, PREFETCH_COUNT_MAX - 1)

    def test_consumer_increment_decrement(self):
        mconsumer = Mock()
        qos = QoS(mconsumer.qos, 10)
        qos.update()
        self.assertEqual(qos.value, 10)
        mconsumer.qos.assert_called_with(prefetch_count=10)
        qos.decrement_eventually()
        qos.update()
        self.assertEqual(qos.value, 9)
        mconsumer.qos.assert_called_with(prefetch_count=9)
        qos.decrement_eventually()
        self.assertEqual(qos.value, 8)
        mconsumer.qos.assert_called_with(prefetch_count=9)
        self.assertIn({'prefetch_count': 9}, mconsumer.qos.call_args)

        # Does not decrement 0 value
        qos.value = 0
        qos.decrement_eventually()
        self.assertEqual(qos.value, 0)
        qos.increment_eventually()
        self.assertEqual(qos.value, 0)

    def test_consumer_decrement_eventually(self):
        mconsumer = Mock()
        qos = QoS(mconsumer.qos, 10)
        qos.decrement_eventually()
        self.assertEqual(qos.value, 9)
        qos.value = 0
        qos.decrement_eventually()
        self.assertEqual(qos.value, 0)

    def test_set(self):
        mconsumer = Mock()
        qos = QoS(mconsumer.qos, 10)
        qos.set(12)
        self.assertEqual(qos.prev, 12)
        qos.set(qos.prev)
