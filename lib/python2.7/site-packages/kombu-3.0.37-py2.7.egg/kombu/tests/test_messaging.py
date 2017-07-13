from __future__ import absolute_import, unicode_literals

import anyjson
import pickle

from collections import defaultdict

from kombu import Connection, Consumer, Producer, Exchange, Queue
from kombu.exceptions import MessageStateError
from kombu.utils import ChannelPromise

from .case import Case, Mock, patch
from .mocks import Transport


class test_Producer(Case):

    def setUp(self):
        self.exchange = Exchange('foo', 'direct')
        self.connection = Connection(transport=Transport)
        self.connection.connect()
        self.assertTrue(self.connection.connection.connected)
        self.assertFalse(self.exchange.is_bound)

    def test_repr(self):
        p = Producer(self.connection)
        self.assertTrue(repr(p))

    def test_pickle(self):
        chan = Mock()
        producer = Producer(chan, serializer='pickle')
        p2 = pickle.loads(pickle.dumps(producer))
        self.assertEqual(p2.serializer, producer.serializer)

    def test_no_channel(self):
        p = Producer(None)
        self.assertFalse(p._channel)

    @patch('kombu.messaging.maybe_declare')
    def test_maybe_declare(self, maybe_declare):
        p = self.connection.Producer()
        q = Queue('foo')
        p.maybe_declare(q)
        maybe_declare.assert_called_with(q, p.channel, False)

    @patch('kombu.common.maybe_declare')
    def test_maybe_declare_when_entity_false(self, maybe_declare):
        p = self.connection.Producer()
        p.maybe_declare(None)
        self.assertFalse(maybe_declare.called)

    def test_auto_declare(self):
        channel = self.connection.channel()
        p = Producer(channel, self.exchange, auto_declare=True)
        self.assertIsNot(p.exchange, self.exchange,
                         'creates Exchange clone at bind')
        self.assertTrue(p.exchange.is_bound)
        self.assertIn('exchange_declare', channel,
                      'auto_declare declares exchange')

    def test_manual_declare(self):
        channel = self.connection.channel()
        p = Producer(channel, self.exchange, auto_declare=False)
        self.assertTrue(p.exchange.is_bound)
        self.assertNotIn('exchange_declare', channel,
                         'auto_declare=False does not declare exchange')
        p.declare()
        self.assertIn('exchange_declare', channel,
                      'p.declare() declares exchange')

    def test_prepare(self):
        message = {'the quick brown fox': 'jumps over the lazy dog'}
        channel = self.connection.channel()
        p = Producer(channel, self.exchange, serializer='json')
        m, ctype, cencoding = p._prepare(message, headers={})
        self.assertDictEqual(message, anyjson.loads(m))
        self.assertEqual(ctype, 'application/json')
        self.assertEqual(cencoding, 'utf-8')

    def test_prepare_compression(self):
        message = {'the quick brown fox': 'jumps over the lazy dog'}
        channel = self.connection.channel()
        p = Producer(channel, self.exchange, serializer='json')
        headers = {}
        m, ctype, cencoding = p._prepare(message, compression='zlib',
                                         headers=headers)
        self.assertEqual(ctype, 'application/json')
        self.assertEqual(cencoding, 'utf-8')
        self.assertEqual(headers['compression'], 'application/x-gzip')
        import zlib
        self.assertEqual(
            anyjson.loads(zlib.decompress(m).decode('utf-8')),
            message,
        )

    def test_prepare_custom_content_type(self):
        message = 'the quick brown fox'.encode('utf-8')
        channel = self.connection.channel()
        p = Producer(channel, self.exchange, serializer='json')
        m, ctype, cencoding = p._prepare(message, content_type='custom')
        self.assertEqual(m, message)
        self.assertEqual(ctype, 'custom')
        self.assertEqual(cencoding, 'binary')
        m, ctype, cencoding = p._prepare(message, content_type='custom',
                                         content_encoding='alien')
        self.assertEqual(m, message)
        self.assertEqual(ctype, 'custom')
        self.assertEqual(cencoding, 'alien')

    def test_prepare_is_already_unicode(self):
        message = 'the quick brown fox'
        channel = self.connection.channel()
        p = Producer(channel, self.exchange, serializer='json')
        m, ctype, cencoding = p._prepare(message, content_type='text/plain')
        self.assertEqual(m, message.encode('utf-8'))
        self.assertEqual(ctype, 'text/plain')
        self.assertEqual(cencoding, 'utf-8')
        m, ctype, cencoding = p._prepare(message, content_type='text/plain',
                                         content_encoding='utf-8')
        self.assertEqual(m, message.encode('utf-8'))
        self.assertEqual(ctype, 'text/plain')
        self.assertEqual(cencoding, 'utf-8')

    def test_publish_with_Exchange_instance(self):
        p = self.connection.Producer()
        p.channel = Mock()
        p.publish('hello', exchange=Exchange('foo'), delivery_mode='transient')
        self.assertEqual(
            p._channel.basic_publish.call_args[1]['exchange'], 'foo',
        )

    def test_set_on_return(self):
        chan = Mock()
        chan.events = defaultdict(Mock)
        p = Producer(ChannelPromise(lambda: chan), on_return='on_return')
        p.channel
        chan.events['basic_return'].add.assert_called_with('on_return')

    def test_publish_retry_calls_ensure(self):
        p = Producer(Mock())
        p._connection = Mock()
        ensure = p.connection.ensure = Mock()
        p.publish('foo', exchange='foo', retry=True)
        self.assertTrue(ensure.called)

    def test_publish_retry_with_declare(self):
        p = self.connection.Producer()
        p.maybe_declare = Mock()
        p.connection.ensure = Mock()
        ex = Exchange('foo')
        p._publish('hello', 0, '', '', {}, {}, 'rk', 0, 0, ex, declare=[ex])
        p.maybe_declare.assert_called_with(ex)

    def test_revive_when_channel_is_connection(self):
        p = self.connection.Producer()
        p.exchange = Mock()
        new_conn = Connection('memory://')
        defchan = new_conn.default_channel
        p.revive(new_conn)

        self.assertIs(p.channel, defchan)
        p.exchange.revive.assert_called_with(defchan)

    def test_enter_exit(self):
        p = self.connection.Producer()
        p.release = Mock()

        self.assertIs(p.__enter__(), p)
        p.__exit__()
        p.release.assert_called_with()

    def test_connection_property_handles_AttributeError(self):
        p = self.connection.Producer()
        p.channel = object()
        p.__connection__ = None
        self.assertIsNone(p.connection)

    def test_publish(self):
        channel = self.connection.channel()
        p = Producer(channel, self.exchange, serializer='json')
        message = {'the quick brown fox': 'jumps over the lazy dog'}
        ret = p.publish(message, routing_key='process')
        self.assertIn('prepare_message', channel)
        self.assertIn('basic_publish', channel)

        m, exc, rkey = ret
        self.assertDictEqual(message, anyjson.loads(m['body']))
        self.assertDictContainsSubset({'content_type': 'application/json',
                                       'content_encoding': 'utf-8',
                                       'priority': 0}, m)
        self.assertDictContainsSubset({'delivery_mode': 2}, m['properties'])
        self.assertEqual(exc, p.exchange.name)
        self.assertEqual(rkey, 'process')

    def test_no_exchange(self):
        chan = self.connection.channel()
        p = Producer(chan)
        self.assertFalse(p.exchange.name)

    def test_revive(self):
        chan = self.connection.channel()
        p = Producer(chan)
        chan2 = self.connection.channel()
        p.revive(chan2)
        self.assertIs(p.channel, chan2)
        self.assertIs(p.exchange.channel, chan2)

    def test_on_return(self):
        chan = self.connection.channel()

        def on_return(exception, exchange, routing_key, message):
            pass

        p = Producer(chan, on_return=on_return)
        self.assertTrue(on_return in chan.events['basic_return'])
        self.assertTrue(p.on_return)


class test_Consumer(Case):

    def setUp(self):
        self.connection = Connection(transport=Transport)
        self.connection.connect()
        self.assertTrue(self.connection.connection.connected)
        self.exchange = Exchange('foo', 'direct')

    def test_accept(self):
        a = Consumer(self.connection)
        self.assertIsNone(a.accept)
        b = Consumer(self.connection, accept=['json', 'pickle'])
        self.assertSetEqual(
            b.accept,
            set(['application/json', 'application/x-python-serialize']),
        )
        c = Consumer(self.connection, accept=b.accept)
        self.assertSetEqual(b.accept, c.accept)

    def test_enter_exit_cancel_raises(self):
        c = Consumer(self.connection)
        c.cancel = Mock(name='Consumer.cancel')
        c.cancel.side_effect = KeyError('foo')
        with c:
            pass
        c.cancel.assert_called_with()

    def test_receive_callback_accept(self):
        message = Mock(name='Message')
        message.errors = []
        callback = Mock(name='on_message')
        c = Consumer(self.connection, accept=['json'], on_message=callback)
        c.on_decode_error = None
        c.channel = Mock(name='channel')
        c.channel.message_to_python = None

        c._receive_callback(message)
        callback.assert_called_with(message)
        self.assertSetEqual(message.accept, c.accept)

    def test_accept__content_disallowed(self):
        conn = Connection('memory://')
        q = Queue('foo', exchange=self.exchange)
        p = conn.Producer()
        p.publish(
            {'complex': object()},
            declare=[q], exchange=self.exchange, serializer='pickle',
        )

        callback = Mock(name='callback')
        with conn.Consumer(queues=[q], callbacks=[callback]) as consumer:
            with self.assertRaises(consumer.ContentDisallowed):
                conn.drain_events(timeout=1)
        self.assertFalse(callback.called)

    def test_accept__content_allowed(self):
        conn = Connection('memory://')
        q = Queue('foo', exchange=self.exchange)
        p = conn.Producer()
        p.publish(
            {'complex': object()},
            declare=[q], exchange=self.exchange, serializer='pickle',
        )

        callback = Mock(name='callback')
        with conn.Consumer(queues=[q], accept=['pickle'],
                           callbacks=[callback]):
            conn.drain_events(timeout=1)
        self.assertTrue(callback.called)
        body, message = callback.call_args[0]
        self.assertTrue(body['complex'])

    def test_set_no_channel(self):
        c = Consumer(None)
        self.assertIsNone(c.channel)
        c.revive(Mock())
        self.assertTrue(c.channel)

    def test_set_no_ack(self):
        channel = self.connection.channel()
        queue = Queue('qname', self.exchange, 'rkey')
        consumer = Consumer(channel, queue, auto_declare=True, no_ack=True)
        self.assertTrue(consumer.no_ack)

    def test_add_queue_when_auto_declare(self):
        consumer = self.connection.Consumer(auto_declare=True)
        q = Mock()
        q.return_value = q
        consumer.add_queue(q)
        self.assertIn(q, consumer.queues)
        q.declare.assert_called_with()

    def test_add_queue_when_not_auto_declare(self):
        consumer = self.connection.Consumer(auto_declare=False)
        q = Mock()
        q.return_value = q
        consumer.add_queue(q)
        self.assertIn(q, consumer.queues)
        self.assertFalse(q.declare.call_count)

    def test_consume_without_queues_returns(self):
        consumer = self.connection.Consumer()
        consumer.queues[:] = []
        self.assertIsNone(consumer.consume())

    def test_consuming_from(self):
        consumer = self.connection.Consumer()
        consumer.queues[:] = [Queue('a'), Queue('b'), Queue('d')]
        consumer._active_tags = {'a': 1, 'b': 2}

        self.assertFalse(consumer.consuming_from(Queue('c')))
        self.assertFalse(consumer.consuming_from('c'))
        self.assertFalse(consumer.consuming_from(Queue('d')))
        self.assertFalse(consumer.consuming_from('d'))
        self.assertTrue(consumer.consuming_from(Queue('a')))
        self.assertTrue(consumer.consuming_from(Queue('b')))
        self.assertTrue(consumer.consuming_from('b'))

    def test_receive_callback_without_m2p(self):
        channel = self.connection.channel()
        c = channel.Consumer()
        m2p = getattr(channel, 'message_to_python')
        channel.message_to_python = None
        try:
            message = Mock()
            message.errors = []
            message.decode.return_value = 'Hello'
            recv = c.receive = Mock()
            c._receive_callback(message)
            recv.assert_called_with('Hello', message)
        finally:
            channel.message_to_python = m2p

    def test_set_callbacks(self):
        channel = self.connection.channel()
        queue = Queue('qname', self.exchange, 'rkey')
        callbacks = [lambda x, y: x,
                     lambda x, y: x]
        consumer = Consumer(channel, queue, auto_declare=True,
                            callbacks=callbacks)
        self.assertEqual(consumer.callbacks, callbacks)

    def test_auto_declare(self):
        channel = self.connection.channel()
        queue = Queue('qname', self.exchange, 'rkey')
        consumer = Consumer(channel, queue, auto_declare=True)
        consumer.consume()
        consumer.consume()  # twice is a noop
        self.assertIsNot(consumer.queues[0], queue)
        self.assertTrue(consumer.queues[0].is_bound)
        self.assertTrue(consumer.queues[0].exchange.is_bound)
        self.assertIsNot(consumer.queues[0].exchange, self.exchange)

        for meth in ('exchange_declare',
                     'queue_declare',
                     'queue_bind',
                     'basic_consume'):
            self.assertIn(meth, channel)
        self.assertEqual(channel.called.count('basic_consume'), 1)
        self.assertTrue(consumer._active_tags)

        consumer.cancel_by_queue(queue.name)
        consumer.cancel_by_queue(queue.name)
        self.assertFalse(consumer._active_tags)

    def test_consumer_tag_prefix(self):
        channel = self.connection.channel()
        queue = Queue('qname', self.exchange, 'rkey')
        consumer = Consumer(channel, queue, tag_prefix='consumer_')
        consumer.consume()

        self.assertTrue(
            consumer._active_tags[queue.name].startswith('consumer_'),
        )

    def test_manual_declare(self):
        channel = self.connection.channel()
        queue = Queue('qname', self.exchange, 'rkey')
        consumer = Consumer(channel, queue, auto_declare=False)
        self.assertIsNot(consumer.queues[0], queue)
        self.assertTrue(consumer.queues[0].is_bound)
        self.assertTrue(consumer.queues[0].exchange.is_bound)
        self.assertIsNot(consumer.queues[0].exchange, self.exchange)

        for meth in ('exchange_declare',
                     'queue_declare',
                     'basic_consume'):
            self.assertNotIn(meth, channel)

        consumer.declare()
        for meth in ('exchange_declare',
                     'queue_declare',
                     'queue_bind'):
            self.assertIn(meth, channel)
        self.assertNotIn('basic_consume', channel)

        consumer.consume()
        self.assertIn('basic_consume', channel)

    def test_consume__cancel(self):
        channel = self.connection.channel()
        queue = Queue('qname', self.exchange, 'rkey')
        consumer = Consumer(channel, queue, auto_declare=True)
        consumer.consume()
        consumer.cancel()
        self.assertIn('basic_cancel', channel)
        self.assertFalse(consumer._active_tags)

    def test___enter____exit__(self):
        channel = self.connection.channel()
        queue = Queue('qname', self.exchange, 'rkey')
        consumer = Consumer(channel, queue, auto_declare=True)
        context = consumer.__enter__()
        self.assertIs(context, consumer)
        self.assertTrue(consumer._active_tags)
        res = consumer.__exit__(None, None, None)
        self.assertFalse(res)
        self.assertIn('basic_cancel', channel)
        self.assertFalse(consumer._active_tags)

    def test_flow(self):
        channel = self.connection.channel()
        queue = Queue('qname', self.exchange, 'rkey')
        consumer = Consumer(channel, queue, auto_declare=True)
        consumer.flow(False)
        self.assertIn('flow', channel)

    def test_qos(self):
        channel = self.connection.channel()
        queue = Queue('qname', self.exchange, 'rkey')
        consumer = Consumer(channel, queue, auto_declare=True)
        consumer.qos(30, 10, False)
        self.assertIn('basic_qos', channel)

    def test_purge(self):
        channel = self.connection.channel()
        b1 = Queue('qname1', self.exchange, 'rkey')
        b2 = Queue('qname2', self.exchange, 'rkey')
        b3 = Queue('qname3', self.exchange, 'rkey')
        b4 = Queue('qname4', self.exchange, 'rkey')
        consumer = Consumer(channel, [b1, b2, b3, b4], auto_declare=True)
        consumer.purge()
        self.assertEqual(channel.called.count('queue_purge'), 4)

    def test_multiple_queues(self):
        channel = self.connection.channel()
        b1 = Queue('qname1', self.exchange, 'rkey')
        b2 = Queue('qname2', self.exchange, 'rkey')
        b3 = Queue('qname3', self.exchange, 'rkey')
        b4 = Queue('qname4', self.exchange, 'rkey')
        consumer = Consumer(channel, [b1, b2, b3, b4])
        consumer.consume()
        self.assertEqual(channel.called.count('exchange_declare'), 4)
        self.assertEqual(channel.called.count('queue_declare'), 4)
        self.assertEqual(channel.called.count('queue_bind'), 4)
        self.assertEqual(channel.called.count('basic_consume'), 4)
        self.assertEqual(len(consumer._active_tags), 4)
        consumer.cancel()
        self.assertEqual(channel.called.count('basic_cancel'), 4)
        self.assertFalse(len(consumer._active_tags))

    def test_receive_callback(self):
        channel = self.connection.channel()
        b1 = Queue('qname1', self.exchange, 'rkey')
        consumer = Consumer(channel, [b1])
        received = []

        def callback(message_data, message):
            received.append(message_data)
            message.ack()
            message.payload     # trigger cache

        consumer.register_callback(callback)
        consumer._receive_callback({'foo': 'bar'})

        self.assertIn('basic_ack', channel)
        self.assertIn('message_to_python', channel)
        self.assertEqual(received[0], {'foo': 'bar'})

    def test_basic_ack_twice(self):
        channel = self.connection.channel()
        b1 = Queue('qname1', self.exchange, 'rkey')
        consumer = Consumer(channel, [b1])

        def callback(message_data, message):
            message.ack()
            message.ack()

        consumer.register_callback(callback)
        with self.assertRaises(MessageStateError):
            consumer._receive_callback({'foo': 'bar'})

    def test_basic_reject(self):
        channel = self.connection.channel()
        b1 = Queue('qname1', self.exchange, 'rkey')
        consumer = Consumer(channel, [b1])

        def callback(message_data, message):
            message.reject()

        consumer.register_callback(callback)
        consumer._receive_callback({'foo': 'bar'})
        self.assertIn('basic_reject', channel)

    def test_basic_reject_twice(self):
        channel = self.connection.channel()
        b1 = Queue('qname1', self.exchange, 'rkey')
        consumer = Consumer(channel, [b1])

        def callback(message_data, message):
            message.reject()
            message.reject()

        consumer.register_callback(callback)
        with self.assertRaises(MessageStateError):
            consumer._receive_callback({'foo': 'bar'})
        self.assertIn('basic_reject', channel)

    def test_basic_reject__requeue(self):
        channel = self.connection.channel()
        b1 = Queue('qname1', self.exchange, 'rkey')
        consumer = Consumer(channel, [b1])

        def callback(message_data, message):
            message.requeue()

        consumer.register_callback(callback)
        consumer._receive_callback({'foo': 'bar'})
        self.assertIn('basic_reject:requeue', channel)

    def test_basic_reject__requeue_twice(self):
        channel = self.connection.channel()
        b1 = Queue('qname1', self.exchange, 'rkey')
        consumer = Consumer(channel, [b1])

        def callback(message_data, message):
            message.requeue()
            message.requeue()

        consumer.register_callback(callback)
        with self.assertRaises(MessageStateError):
            consumer._receive_callback({'foo': 'bar'})
        self.assertIn('basic_reject:requeue', channel)

    def test_receive_without_callbacks_raises(self):
        channel = self.connection.channel()
        b1 = Queue('qname1', self.exchange, 'rkey')
        consumer = Consumer(channel, [b1])
        with self.assertRaises(NotImplementedError):
            consumer.receive(1, 2)

    def test_decode_error(self):
        channel = self.connection.channel()
        b1 = Queue('qname1', self.exchange, 'rkey')
        consumer = Consumer(channel, [b1])
        consumer.channel.throw_decode_error = True

        with self.assertRaises(ValueError):
            consumer._receive_callback({'foo': 'bar'})

    def test_on_decode_error_callback(self):
        channel = self.connection.channel()
        b1 = Queue('qname1', self.exchange, 'rkey')
        thrown = []

        def on_decode_error(msg, exc):
            thrown.append((msg.body, exc))

        consumer = Consumer(channel, [b1], on_decode_error=on_decode_error)
        consumer.channel.throw_decode_error = True
        consumer._receive_callback({'foo': 'bar'})

        self.assertTrue(thrown)
        m, exc = thrown[0]
        self.assertEqual(anyjson.loads(m), {'foo': 'bar'})
        self.assertIsInstance(exc, ValueError)

    def test_recover(self):
        channel = self.connection.channel()
        b1 = Queue('qname1', self.exchange, 'rkey')
        consumer = Consumer(channel, [b1])
        consumer.recover()
        self.assertIn('basic_recover', channel)

    def test_revive(self):
        channel = self.connection.channel()
        b1 = Queue('qname1', self.exchange, 'rkey')
        consumer = Consumer(channel, [b1])
        channel2 = self.connection.channel()
        consumer.revive(channel2)
        self.assertIs(consumer.channel, channel2)
        self.assertIs(consumer.queues[0].channel, channel2)
        self.assertIs(consumer.queues[0].exchange.channel, channel2)

    def test__repr__(self):
        channel = self.connection.channel()
        b1 = Queue('qname1', self.exchange, 'rkey')
        self.assertTrue(repr(Consumer(channel, [b1])))

    def test_connection_property_handles_AttributeError(self):
        p = self.connection.Consumer()
        p.channel = object()
        self.assertIsNone(p.connection)
