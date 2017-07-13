from __future__ import absolute_import

from kombu import Connection, Exchange, Queue
from kombu import compat

from .case import Case, Mock, patch
from .mocks import Transport, Channel


class test_misc(Case):

    def test_iterconsume(self):

        class MyConnection(object):
            drained = 0

            def drain_events(self, *args, **kwargs):
                self.drained += 1
                return self.drained

        class Consumer(object):
            active = False

            def consume(self, *args, **kwargs):
                self.active = True

        conn = MyConnection()
        consumer = Consumer()
        it = compat._iterconsume(conn, consumer)
        self.assertEqual(next(it), 1)
        self.assertTrue(consumer.active)

        it2 = compat._iterconsume(conn, consumer, limit=10)
        self.assertEqual(list(it2), [2, 3, 4, 5, 6, 7, 8, 9, 10, 11])

    def test_Queue_from_dict(self):
        defs = {'binding_key': 'foo.#',
                'exchange': 'fooex',
                'exchange_type': 'topic',
                'durable': True,
                'auto_delete': False}

        q1 = Queue.from_dict('foo', **dict(defs))
        self.assertEqual(q1.name, 'foo')
        self.assertEqual(q1.routing_key, 'foo.#')
        self.assertEqual(q1.exchange.name, 'fooex')
        self.assertEqual(q1.exchange.type, 'topic')
        self.assertTrue(q1.durable)
        self.assertTrue(q1.exchange.durable)
        self.assertFalse(q1.auto_delete)
        self.assertFalse(q1.exchange.auto_delete)

        q2 = Queue.from_dict('foo', **dict(defs,
                                           exchange_durable=False))
        self.assertTrue(q2.durable)
        self.assertFalse(q2.exchange.durable)

        q3 = Queue.from_dict('foo', **dict(defs,
                                           exchange_auto_delete=True))
        self.assertFalse(q3.auto_delete)
        self.assertTrue(q3.exchange.auto_delete)

        q4 = Queue.from_dict('foo', **dict(defs,
                                           queue_durable=False))
        self.assertFalse(q4.durable)
        self.assertTrue(q4.exchange.durable)

        q5 = Queue.from_dict('foo', **dict(defs,
                                           queue_auto_delete=True))
        self.assertTrue(q5.auto_delete)
        self.assertFalse(q5.exchange.auto_delete)

        self.assertEqual(Queue.from_dict('foo', **dict(defs)),
                         Queue.from_dict('foo', **dict(defs)))


class test_Publisher(Case):

    def setUp(self):
        self.connection = Connection(transport=Transport)

    def test_constructor(self):
        pub = compat.Publisher(self.connection,
                               exchange='test_Publisher_constructor',
                               routing_key='rkey')
        self.assertIsInstance(pub.backend, Channel)
        self.assertEqual(pub.exchange.name, 'test_Publisher_constructor')
        self.assertTrue(pub.exchange.durable)
        self.assertFalse(pub.exchange.auto_delete)
        self.assertEqual(pub.exchange.type, 'direct')

        pub2 = compat.Publisher(self.connection,
                                exchange='test_Publisher_constructor2',
                                routing_key='rkey',
                                auto_delete=True,
                                durable=False)
        self.assertTrue(pub2.exchange.auto_delete)
        self.assertFalse(pub2.exchange.durable)

        explicit = Exchange('test_Publisher_constructor_explicit',
                            type='topic')
        pub3 = compat.Publisher(self.connection,
                                exchange=explicit)
        self.assertEqual(pub3.exchange, explicit)

        compat.Publisher(self.connection,
                         exchange='test_Publisher_constructor3',
                         channel=self.connection.default_channel)

    def test_send(self):
        pub = compat.Publisher(self.connection,
                               exchange='test_Publisher_send',
                               routing_key='rkey')
        pub.send({'foo': 'bar'})
        self.assertIn('basic_publish', pub.backend)
        pub.close()

    def test__enter__exit__(self):
        pub = compat.Publisher(self.connection,
                               exchange='test_Publisher_send',
                               routing_key='rkey')
        x = pub.__enter__()
        self.assertIs(x, pub)
        x.__exit__()
        self.assertTrue(pub._closed)


class test_Consumer(Case):

    def setUp(self):
        self.connection = Connection(transport=Transport)

    @patch('kombu.compat._iterconsume')
    def test_iterconsume_calls__iterconsume(self, it, n='test_iterconsume'):
        c = compat.Consumer(self.connection, queue=n, exchange=n)
        c.iterconsume(limit=10, no_ack=True)
        it.assert_called_with(c.connection, c, True, 10)

    def test_constructor(self, n='test_Consumer_constructor'):
        c = compat.Consumer(self.connection, queue=n, exchange=n,
                            routing_key='rkey')
        self.assertIsInstance(c.backend, Channel)
        q = c.queues[0]
        self.assertTrue(q.durable)
        self.assertTrue(q.exchange.durable)
        self.assertFalse(q.auto_delete)
        self.assertFalse(q.exchange.auto_delete)
        self.assertEqual(q.name, n)
        self.assertEqual(q.exchange.name, n)

        c2 = compat.Consumer(self.connection, queue=n + '2',
                             exchange=n + '2',
                             routing_key='rkey', durable=False,
                             auto_delete=True, exclusive=True)
        q2 = c2.queues[0]
        self.assertFalse(q2.durable)
        self.assertFalse(q2.exchange.durable)
        self.assertTrue(q2.auto_delete)
        self.assertTrue(q2.exchange.auto_delete)

    def test__enter__exit__(self, n='test__enter__exit__'):
        c = compat.Consumer(self.connection, queue=n, exchange=n,
                            routing_key='rkey')
        x = c.__enter__()
        self.assertIs(x, c)
        x.__exit__()
        self.assertTrue(c._closed)

    def test_revive(self, n='test_revive'):
        c = compat.Consumer(self.connection, queue=n, exchange=n)

        with self.connection.channel() as c2:
            c.revive(c2)
            self.assertIs(c.backend, c2)

    def test__iter__(self, n='test__iter__'):
        c = compat.Consumer(self.connection, queue=n, exchange=n)
        c.iterqueue = Mock()

        c.__iter__()
        c.iterqueue.assert_called_with(infinite=True)

    def test_iter(self, n='test_iterqueue'):
        c = compat.Consumer(self.connection, queue=n, exchange=n,
                            routing_key='rkey')
        c.close()

    def test_process_next(self, n='test_process_next'):
        c = compat.Consumer(self.connection, queue=n, exchange=n,
                            routing_key='rkey')
        with self.assertRaises(NotImplementedError):
            c.process_next()
        c.close()

    def test_iterconsume(self, n='test_iterconsume'):
        c = compat.Consumer(self.connection, queue=n, exchange=n,
                            routing_key='rkey')
        c.close()

    def test_discard_all(self, n='test_discard_all'):
        c = compat.Consumer(self.connection, queue=n, exchange=n,
                            routing_key='rkey')
        c.discard_all()
        self.assertIn('queue_purge', c.backend)

    def test_fetch(self, n='test_fetch'):
        c = compat.Consumer(self.connection, queue=n, exchange=n,
                            routing_key='rkey')
        self.assertIsNone(c.fetch())
        self.assertIsNone(c.fetch(no_ack=True))
        self.assertIn('basic_get', c.backend)

        callback_called = [False]

        def receive(payload, message):
            callback_called[0] = True

        c.backend.to_deliver.append('42')
        payload = c.fetch().payload
        self.assertEqual(payload, '42')
        c.backend.to_deliver.append('46')
        c.register_callback(receive)
        self.assertEqual(c.fetch(enable_callbacks=True).payload, '46')
        self.assertTrue(callback_called[0])

    def test_discard_all_filterfunc_not_supported(self, n='xjf21j21'):
        c = compat.Consumer(self.connection, queue=n, exchange=n,
                            routing_key='rkey')
        with self.assertRaises(NotImplementedError):
            c.discard_all(filterfunc=lambda x: x)
        c.close()

    def test_wait(self, n='test_wait'):

        class C(compat.Consumer):

            def iterconsume(self, limit=None):
                for i in range(limit):
                    yield i

        c = C(self.connection,
              queue=n, exchange=n, routing_key='rkey')
        self.assertEqual(c.wait(10), list(range(10)))
        c.close()

    def test_iterqueue(self, n='test_iterqueue'):
        i = [0]

        class C(compat.Consumer):

            def fetch(self, limit=None):
                z = i[0]
                i[0] += 1
                return z

        c = C(self.connection,
              queue=n, exchange=n, routing_key='rkey')
        self.assertEqual(list(c.iterqueue(limit=10)), list(range(10)))
        c.close()


class test_ConsumerSet(Case):

    def setUp(self):
        self.connection = Connection(transport=Transport)

    def test_providing_channel(self):
        chan = Mock(name='channel')
        cs = compat.ConsumerSet(self.connection, channel=chan)
        self.assertTrue(cs._provided_channel)
        self.assertIs(cs.backend, chan)

        cs.cancel = Mock(name='cancel')
        cs.close()
        self.assertFalse(chan.close.called)

    @patch('kombu.compat._iterconsume')
    def test_iterconsume(self, _iterconsume, n='test_iterconsume'):
        c = compat.Consumer(self.connection, queue=n, exchange=n)
        cs = compat.ConsumerSet(self.connection, consumers=[c])
        cs.iterconsume(limit=10, no_ack=True)
        _iterconsume.assert_called_with(c.connection, cs, True, 10)

    def test_revive(self, n='test_revive'):
        c = compat.Consumer(self.connection, queue=n, exchange=n)
        cs = compat.ConsumerSet(self.connection, consumers=[c])

        with self.connection.channel() as c2:
            cs.revive(c2)
            self.assertIs(cs.backend, c2)

    def test_constructor(self, prefix='0daf8h21'):
        dcon = {'%s.xyx' % prefix: {'exchange': '%s.xyx' % prefix,
                                    'routing_key': 'xyx'},
                '%s.xyz' % prefix: {'exchange': '%s.xyz' % prefix,
                                    'routing_key': 'xyz'}}
        consumers = [compat.Consumer(self.connection, queue=prefix + str(i),
                                     exchange=prefix + str(i))
                     for i in range(3)]
        c = compat.ConsumerSet(self.connection, consumers=consumers)
        c2 = compat.ConsumerSet(self.connection, from_dict=dcon)

        self.assertEqual(len(c.queues), 3)
        self.assertEqual(len(c2.queues), 2)

        c.add_consumer(compat.Consumer(self.connection,
                                       queue=prefix + 'xaxxxa',
                                       exchange=prefix + 'xaxxxa'))
        self.assertEqual(len(c.queues), 4)
        for cq in c.queues:
            self.assertIs(cq.channel, c.channel)

        c2.add_consumer_from_dict({
            '%s.xxx' % prefix: {
                'exchange': '%s.xxx' % prefix,
                'routing_key': 'xxx',
            },
        })
        self.assertEqual(len(c2.queues), 3)
        for c2q in c2.queues:
            self.assertIs(c2q.channel, c2.channel)

        c.discard_all()
        self.assertEqual(c.channel.called.count('queue_purge'), 4)
        c.consume()

        c.close()
        c2.close()
        self.assertIn('basic_cancel', c.channel)
        self.assertIn('close', c.channel)
        self.assertIn('close', c2.channel)
