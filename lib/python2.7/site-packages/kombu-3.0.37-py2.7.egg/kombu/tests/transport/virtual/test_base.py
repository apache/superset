from __future__ import absolute_import

import warnings

from kombu import Connection
from kombu.exceptions import ResourceError, ChannelError
from kombu.transport import virtual
from kombu.utils import uuid
from kombu.compression import compress

from kombu.tests.case import Case, Mock, patch, redirect_stdouts


def client(**kwargs):
    return Connection(transport='kombu.transport.virtual:Transport', **kwargs)


def memory_client():
    return Connection(transport='memory')


class test_BrokerState(Case):

    def test_constructor(self):
        s = virtual.BrokerState()
        self.assertTrue(hasattr(s, 'exchanges'))
        self.assertTrue(hasattr(s, 'bindings'))

        t = virtual.BrokerState(exchanges=16, bindings=32)
        self.assertEqual(t.exchanges, 16)
        self.assertEqual(t.bindings, 32)


class test_QoS(Case):

    def setUp(self):
        self.q = virtual.QoS(client().channel(), prefetch_count=10)

    def tearDown(self):
        self.q._on_collect.cancel()

    def test_constructor(self):
        self.assertTrue(self.q.channel)
        self.assertTrue(self.q.prefetch_count)
        self.assertFalse(self.q._delivered.restored)
        self.assertTrue(self.q._on_collect)

    @redirect_stdouts
    def test_can_consume(self, stdout, stderr):
        _restored = []

        class RestoreChannel(virtual.Channel):
            do_restore = True

            def _restore(self, message):
                _restored.append(message)

        self.assertTrue(self.q.can_consume())
        for i in range(self.q.prefetch_count - 1):
            self.q.append(i, uuid())
            self.assertTrue(self.q.can_consume())
        self.q.append(i + 1, uuid())
        self.assertFalse(self.q.can_consume())

        tag1 = next(iter(self.q._delivered))
        self.q.ack(tag1)
        self.assertTrue(self.q.can_consume())

        tag2 = uuid()
        self.q.append(i + 2, tag2)
        self.assertFalse(self.q.can_consume())
        self.q.reject(tag2)
        self.assertTrue(self.q.can_consume())

        self.q.channel = RestoreChannel(self.q.channel.connection)
        tag3 = uuid()
        self.q.append(i + 3, tag3)
        self.q.reject(tag3, requeue=True)
        self.q._flush()
        self.q.restore_unacked_once()
        self.assertListEqual(_restored, [11, 9, 8, 7, 6, 5, 4, 3, 2, 1])
        self.assertTrue(self.q._delivered.restored)
        self.assertFalse(self.q._delivered)

        self.q.restore_unacked_once()
        self.q._delivered.restored = False
        self.q.restore_unacked_once()

        self.assertTrue(stderr.getvalue())
        self.assertFalse(stdout.getvalue())

        self.q.restore_at_shutdown = False
        self.q.restore_unacked_once()

    def test_get(self):
        self.q._delivered['foo'] = 1
        self.assertEqual(self.q.get('foo'), 1)


class test_Message(Case):

    def test_create(self):
        c = client().channel()
        data = c.prepare_message('the quick brown fox...')
        tag = data['properties']['delivery_tag'] = uuid()
        message = c.message_to_python(data)
        self.assertIsInstance(message, virtual.Message)
        self.assertIs(message, c.message_to_python(message))
        if message.errors:
            message._reraise_error()

        self.assertEqual(message.body,
                         'the quick brown fox...'.encode('utf-8'))
        self.assertTrue(message.delivery_tag, tag)

    def test_create_no_body(self):
        virtual.Message(Mock(), {
            'body': None,
            'properties': {'delivery_tag': 1}})

    def test_serializable(self):
        c = client().channel()
        body, content_type = compress('the quick brown fox...', 'gzip')
        data = c.prepare_message(body, headers={'compression': content_type})
        tag = data['properties']['delivery_tag'] = uuid()
        message = c.message_to_python(data)
        dict_ = message.serializable()
        self.assertEqual(dict_['body'],
                         'the quick brown fox...'.encode('utf-8'))
        self.assertEqual(dict_['properties']['delivery_tag'], tag)
        self.assertFalse('compression' in dict_['headers'])


class test_AbstractChannel(Case):

    def test_get(self):
        with self.assertRaises(NotImplementedError):
            virtual.AbstractChannel()._get('queue')

    def test_put(self):
        with self.assertRaises(NotImplementedError):
            virtual.AbstractChannel()._put('queue', 'm')

    def test_size(self):
        self.assertEqual(virtual.AbstractChannel()._size('queue'), 0)

    def test_purge(self):
        with self.assertRaises(NotImplementedError):
            virtual.AbstractChannel()._purge('queue')

    def test_delete(self):
        with self.assertRaises(NotImplementedError):
            virtual.AbstractChannel()._delete('queue')

    def test_new_queue(self):
        self.assertIsNone(virtual.AbstractChannel()._new_queue('queue'))

    def test_has_queue(self):
        self.assertTrue(virtual.AbstractChannel()._has_queue('queue'))

    def test_poll(self):

        class Cycle(object):
            called = False

            def get(self):
                self.called = True
                return True

        cycle = Cycle()
        self.assertTrue(virtual.AbstractChannel()._poll(cycle))
        self.assertTrue(cycle.called)


class test_Channel(Case):

    def setUp(self):
        self.channel = client().channel()

    def tearDown(self):
        if self.channel._qos is not None:
            self.channel._qos._on_collect.cancel()

    def test_exceeds_channel_max(self):
        c = client()
        t = c.transport
        avail = t._avail_channel_ids = Mock(name='_avail_channel_ids')
        avail.pop.side_effect = IndexError()
        with self.assertRaises(ResourceError):
            virtual.Channel(t)

    def test_exchange_bind_interface(self):
        with self.assertRaises(NotImplementedError):
            self.channel.exchange_bind('dest', 'src', 'key')

    def test_exchange_unbind_interface(self):
        with self.assertRaises(NotImplementedError):
            self.channel.exchange_unbind('dest', 'src', 'key')

    def test_queue_unbind_interface(self):
        with self.assertRaises(NotImplementedError):
            self.channel.queue_unbind('dest', 'ex', 'key')

    def test_management(self):
        m = self.channel.connection.client.get_manager()
        self.assertTrue(m)
        m.get_bindings()
        m.close()

    def test_exchange_declare(self):
        c = self.channel

        with self.assertRaises(ChannelError):
            c.exchange_declare('test_exchange_declare', 'direct',
                               durable=True, auto_delete=True, passive=True)
        c.exchange_declare('test_exchange_declare', 'direct',
                           durable=True, auto_delete=True)
        c.exchange_declare('test_exchange_declare', 'direct',
                           durable=True, auto_delete=True, passive=True)
        self.assertIn('test_exchange_declare', c.state.exchanges)
        # can declare again with same values
        c.exchange_declare('test_exchange_declare', 'direct',
                           durable=True, auto_delete=True)
        self.assertIn('test_exchange_declare', c.state.exchanges)

        # using different values raises NotEquivalentError
        with self.assertRaises(virtual.NotEquivalentError):
            c.exchange_declare('test_exchange_declare', 'direct',
                               durable=False, auto_delete=True)

    def test_exchange_delete(self, ex='test_exchange_delete'):

        class PurgeChannel(virtual.Channel):
            purged = []

            def _purge(self, queue):
                self.purged.append(queue)

        c = PurgeChannel(self.channel.connection)

        c.exchange_declare(ex, 'direct', durable=True, auto_delete=True)
        self.assertIn(ex, c.state.exchanges)
        self.assertNotIn(ex, c.state.bindings)  # no bindings yet
        c.exchange_delete(ex)
        self.assertNotIn(ex, c.state.exchanges)

        c.exchange_declare(ex, 'direct', durable=True, auto_delete=True)
        c.queue_declare(ex)
        c.queue_bind(ex, ex, ex)
        self.assertTrue(c.state.bindings[ex])
        c.exchange_delete(ex)
        self.assertNotIn(ex, c.state.bindings)
        self.assertIn(ex, c.purged)

    def test_queue_delete__if_empty(self, n='test_queue_delete__if_empty'):
        class PurgeChannel(virtual.Channel):
            purged = []
            size = 30

            def _purge(self, queue):
                self.purged.append(queue)

            def _size(self, queue):
                return self.size

        c = PurgeChannel(self.channel.connection)
        c.exchange_declare(n)
        c.queue_declare(n)
        c.queue_bind(n, n, n)
        # tests code path that returns if queue already bound.
        c.queue_bind(n, n, n)

        c.queue_delete(n, if_empty=True)
        self.assertIn(n, c.state.bindings)

        c.size = 0
        c.queue_delete(n, if_empty=True)
        self.assertNotIn(n, c.state.bindings)
        self.assertIn(n, c.purged)

    def test_queue_purge(self, n='test_queue_purge'):

        class PurgeChannel(virtual.Channel):
            purged = []

            def _purge(self, queue):
                self.purged.append(queue)

        c = PurgeChannel(self.channel.connection)
        c.exchange_declare(n)
        c.queue_declare(n)
        c.queue_bind(n, n, n)
        c.queue_purge(n)
        self.assertIn(n, c.purged)

    def test_basic_publish_unique_delivery_tags(self, n='test_uniq_tag'):
        c1 = memory_client().channel()
        c2 = memory_client().channel()

        for c in (c1, c2):
            c.exchange_declare(n)
            c.queue_declare(n)
            c.queue_bind(n, n, n)
        m1 = c1.prepare_message('George Costanza')
        m2 = c2.prepare_message('Elaine Marie Benes')
        c1.basic_publish(m1, n, n)
        c2.basic_publish(m2, n, n)

        r1 = c1.message_to_python(c1.basic_get(n))
        r2 = c2.message_to_python(c2.basic_get(n))

        self.assertNotEqual(r1.delivery_tag, r2.delivery_tag)
        with self.assertRaises(ValueError):
            int(r1.delivery_tag)
        with self.assertRaises(ValueError):
            int(r2.delivery_tag)

    def test_basic_publish__get__consume__restore(self,
                                                  n='test_basic_publish'):
        c = memory_client().channel()

        c.exchange_declare(n)
        c.queue_declare(n)
        c.queue_bind(n, n, n)
        c.queue_declare(n + '2')
        c.queue_bind(n + '2', n, n)

        m = c.prepare_message('nthex quick brown fox...')
        c.basic_publish(m, n, n)

        r1 = c.message_to_python(c.basic_get(n))
        self.assertTrue(r1)
        self.assertEqual(r1.body,
                         'nthex quick brown fox...'.encode('utf-8'))
        self.assertIsNone(c.basic_get(n))

        consumer_tag = uuid()

        c.basic_consume(n + '2', False,
                        consumer_tag=consumer_tag, callback=lambda *a: None)
        self.assertIn(n + '2', c._active_queues)
        r2, _ = c.drain_events()
        r2 = c.message_to_python(r2)
        self.assertEqual(r2.body,
                         'nthex quick brown fox...'.encode('utf-8'))
        self.assertEqual(r2.delivery_info['exchange'], n)
        self.assertEqual(r2.delivery_info['routing_key'], n)
        with self.assertRaises(virtual.Empty):
            c.drain_events()
        c.basic_cancel(consumer_tag)

        c._restore(r2)
        r3 = c.message_to_python(c.basic_get(n))
        self.assertTrue(r3)
        self.assertEqual(r3.body, 'nthex quick brown fox...'.encode('utf-8'))
        self.assertIsNone(c.basic_get(n))

    def test_basic_ack(self):

        class MockQoS(virtual.QoS):
            was_acked = False

            def ack(self, delivery_tag):
                self.was_acked = True

        self.channel._qos = MockQoS(self.channel)
        self.channel.basic_ack('foo')
        self.assertTrue(self.channel._qos.was_acked)

    def test_basic_recover__requeue(self):

        class MockQoS(virtual.QoS):
            was_restored = False

            def restore_unacked(self):
                self.was_restored = True

        self.channel._qos = MockQoS(self.channel)
        self.channel.basic_recover(requeue=True)
        self.assertTrue(self.channel._qos.was_restored)

    def test_restore_unacked_raises_BaseException(self):
        q = self.channel.qos
        q._flush = Mock()
        q._delivered = {1: 1}

        q.channel._restore = Mock()
        q.channel._restore.side_effect = SystemExit

        errors = q.restore_unacked()
        self.assertIsInstance(errors[0][0], SystemExit)
        self.assertEqual(errors[0][1], 1)
        self.assertFalse(q._delivered)

    @patch('kombu.transport.virtual.emergency_dump_state')
    @patch('kombu.transport.virtual.say')
    def test_restore_unacked_once_when_unrestored(self, say,
                                                  emergency_dump_state):
        q = self.channel.qos
        q._flush = Mock()

        class State(dict):
            restored = False

        q._delivered = State({1: 1})
        ru = q.restore_unacked = Mock()
        exc = None
        try:
            raise KeyError()
        except KeyError as exc_:
            exc = exc_
        ru.return_value = [(exc, 1)]

        self.channel.do_restore = True
        q.restore_unacked_once()
        self.assertTrue(say.called)
        self.assertTrue(emergency_dump_state.called)

    def test_basic_recover(self):
        with self.assertRaises(NotImplementedError):
            self.channel.basic_recover(requeue=False)

    def test_basic_reject(self):

        class MockQoS(virtual.QoS):
            was_rejected = False

            def reject(self, delivery_tag, requeue=False):
                self.was_rejected = True

        self.channel._qos = MockQoS(self.channel)
        self.channel.basic_reject('foo')
        self.assertTrue(self.channel._qos.was_rejected)

    def test_basic_qos(self):
        self.channel.basic_qos(prefetch_count=128)
        self.assertEqual(self.channel._qos.prefetch_count, 128)

    def test_lookup__undeliverable(self, n='test_lookup__undeliverable'):
        warnings.resetwarnings()
        with warnings.catch_warnings(record=True) as log:
            self.assertListEqual(
                self.channel._lookup(n, n, 'ae.undeliver'),
                ['ae.undeliver'],
            )
            self.assertTrue(log)
            self.assertIn('could not be delivered', log[0].message.args[0])

    def test_context(self):
        x = self.channel.__enter__()
        self.assertIs(x, self.channel)
        x.__exit__()
        self.assertTrue(x.closed)

    def test_cycle_property(self):
        self.assertTrue(self.channel.cycle)

    def test_flow(self):
        with self.assertRaises(NotImplementedError):
            self.channel.flow(False)

    def test_close_when_no_connection(self):
        self.channel.connection = None
        self.channel.close()
        self.assertTrue(self.channel.closed)

    def test_drain_events_has_get_many(self):
        c = self.channel
        c._get_many = Mock()
        c._poll = Mock()
        c._consumers = [1]
        c._qos = Mock()
        c._qos.can_consume.return_value = True

        c.drain_events(timeout=10.0)
        c._get_many.assert_called_with(c._active_queues, timeout=10.0)

    def test_get_exchanges(self):
        self.channel.exchange_declare(exchange='foo')
        self.assertTrue(self.channel.get_exchanges())

    def test_basic_cancel_not_in_active_queues(self):
        c = self.channel
        c._consumers.add('x')
        c._tag_to_queue['x'] = 'foo'
        c._active_queues = Mock()
        c._active_queues.remove.side_effect = ValueError()

        c.basic_cancel('x')
        c._active_queues.remove.assert_called_with('foo')

    def test_basic_cancel_unknown_ctag(self):
        self.assertIsNone(self.channel.basic_cancel('unknown-tag'))

    def test_list_bindings(self):
        c = self.channel
        c.exchange_declare(exchange='foo')
        c.queue_declare(queue='q')
        c.queue_bind(queue='q', exchange='foo', routing_key='rk')

        self.assertIn(('q', 'foo', 'rk'), list(c.list_bindings()))

    def test_after_reply_message_received(self):
        c = self.channel
        c.queue_delete = Mock()
        c.after_reply_message_received('foo')
        c.queue_delete.assert_called_with('foo')

    def test_queue_delete_unknown_queue(self):
        self.assertIsNone(self.channel.queue_delete('xiwjqjwel'))

    def test_queue_declare_passive(self):
        has_queue = self.channel._has_queue = Mock()
        has_queue.return_value = False
        with self.assertRaises(ChannelError):
            self.channel.queue_declare(queue='21wisdjwqe', passive=True)


class test_Transport(Case):

    def setUp(self):
        self.transport = client().transport

    def test_custom_polling_interval(self):
        x = client(transport_options=dict(polling_interval=32.3))
        self.assertEqual(x.transport.polling_interval, 32.3)

    def test_close_connection(self):
        c1 = self.transport.create_channel(self.transport)
        c2 = self.transport.create_channel(self.transport)
        self.assertEqual(len(self.transport.channels), 2)
        self.transport.close_connection(self.transport)
        self.assertFalse(self.transport.channels)
        del(c1)  # so pyflakes doesn't complain
        del(c2)

    def test_drain_channel(self):
        channel = self.transport.create_channel(self.transport)
        with self.assertRaises(virtual.Empty):
            self.transport._drain_channel(channel)
