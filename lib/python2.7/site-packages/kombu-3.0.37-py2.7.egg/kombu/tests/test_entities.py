from __future__ import absolute_import

import pickle

from kombu import Connection, Exchange, Producer, Queue, binding
from kombu.exceptions import NotBoundError
from kombu.serialization import registry

from .case import Case, Mock, call
from .mocks import Transport


def get_conn():
    return Connection(transport=Transport)


class test_binding(Case):

    def test_constructor(self):
        x = binding(
            Exchange('foo'), 'rkey',
            arguments={'barg': 'bval'},
            unbind_arguments={'uarg': 'uval'},
        )
        self.assertEqual(x.exchange, Exchange('foo'))
        self.assertEqual(x.routing_key, 'rkey')
        self.assertDictEqual(x.arguments, {'barg': 'bval'})
        self.assertDictEqual(x.unbind_arguments, {'uarg': 'uval'})

    def test_declare(self):
        chan = get_conn().channel()
        x = binding(Exchange('foo'), 'rkey')
        x.declare(chan)
        self.assertIn('exchange_declare', chan)

    def test_declare_no_exchange(self):
        chan = get_conn().channel()
        x = binding()
        x.declare(chan)
        self.assertNotIn('exchange_declare', chan)

    def test_bind(self):
        chan = get_conn().channel()
        x = binding(Exchange('foo'))
        x.bind(Exchange('bar')(chan))
        self.assertIn('exchange_bind', chan)

    def test_unbind(self):
        chan = get_conn().channel()
        x = binding(Exchange('foo'))
        x.unbind(Exchange('bar')(chan))
        self.assertIn('exchange_unbind', chan)

    def test_repr(self):
        b = binding(Exchange('foo'), 'rkey')
        self.assertIn('foo', repr(b))
        self.assertIn('rkey', repr(b))


class test_Exchange(Case):

    def test_bound(self):
        exchange = Exchange('foo', 'direct')
        self.assertFalse(exchange.is_bound)
        self.assertIn('<unbound', repr(exchange))

        chan = get_conn().channel()
        bound = exchange.bind(chan)
        self.assertTrue(bound.is_bound)
        self.assertIs(bound.channel, chan)
        self.assertIn('bound to chan:%r' % (chan.channel_id, ),
                      repr(bound))

    def test_hash(self):
        self.assertEqual(hash(Exchange('a')), hash(Exchange('a')))
        self.assertNotEqual(hash(Exchange('a')), hash(Exchange('b')))

    def test_can_cache_declaration(self):
        self.assertTrue(Exchange('a', durable=True).can_cache_declaration)
        self.assertTrue(Exchange('a', durable=False).can_cache_declaration)

    def test_pickle(self):
        e1 = Exchange('foo', 'direct')
        e2 = pickle.loads(pickle.dumps(e1))
        self.assertEqual(e1, e2)

    def test_eq(self):
        e1 = Exchange('foo', 'direct')
        e2 = Exchange('foo', 'direct')
        self.assertEqual(e1, e2)

        e3 = Exchange('foo', 'topic')
        self.assertNotEqual(e1, e3)

        self.assertEqual(e1.__eq__(True), NotImplemented)

    def test_revive(self):
        exchange = Exchange('foo', 'direct')
        conn = get_conn()
        chan = conn.channel()

        # reviving unbound channel is a noop.
        exchange.revive(chan)
        self.assertFalse(exchange.is_bound)
        self.assertIsNone(exchange._channel)

        bound = exchange.bind(chan)
        self.assertTrue(bound.is_bound)
        self.assertIs(bound.channel, chan)

        chan2 = conn.channel()
        bound.revive(chan2)
        self.assertTrue(bound.is_bound)
        self.assertIs(bound._channel, chan2)

    def test_assert_is_bound(self):
        exchange = Exchange('foo', 'direct')
        with self.assertRaises(NotBoundError):
            exchange.declare()
        conn = get_conn()

        chan = conn.channel()
        exchange.bind(chan).declare()
        self.assertIn('exchange_declare', chan)

    def test_set_transient_delivery_mode(self):
        exc = Exchange('foo', 'direct', delivery_mode='transient')
        self.assertEqual(exc.delivery_mode, Exchange.TRANSIENT_DELIVERY_MODE)

    def test_set_passive_mode(self):
        exc = Exchange('foo', 'direct', passive=True)
        self.assertTrue(exc.passive)

    def test_set_persistent_delivery_mode(self):
        exc = Exchange('foo', 'direct', delivery_mode='persistent')
        self.assertEqual(exc.delivery_mode, Exchange.PERSISTENT_DELIVERY_MODE)

    def test_bind_at_instantiation(self):
        self.assertTrue(Exchange('foo', channel=get_conn().channel()).is_bound)

    def test_create_message(self):
        chan = get_conn().channel()
        Exchange('foo', channel=chan).Message({'foo': 'bar'})
        self.assertIn('prepare_message', chan)

    def test_publish(self):
        chan = get_conn().channel()
        Exchange('foo', channel=chan).publish('the quick brown fox')
        self.assertIn('basic_publish', chan)

    def test_delete(self):
        chan = get_conn().channel()
        Exchange('foo', channel=chan).delete()
        self.assertIn('exchange_delete', chan)

    def test__repr__(self):
        b = Exchange('foo', 'topic')
        self.assertIn('foo(topic)', repr(b))
        self.assertIn('Exchange', repr(b))

    def test_bind_to(self):
        chan = get_conn().channel()
        foo = Exchange('foo', 'topic')
        bar = Exchange('bar', 'topic')
        foo(chan).bind_to(bar)
        self.assertIn('exchange_bind', chan)

    def test_bind_to_by_name(self):
        chan = get_conn().channel()
        foo = Exchange('foo', 'topic')
        foo(chan).bind_to('bar')
        self.assertIn('exchange_bind', chan)

    def test_unbind_from(self):
        chan = get_conn().channel()
        foo = Exchange('foo', 'topic')
        bar = Exchange('bar', 'topic')
        foo(chan).unbind_from(bar)
        self.assertIn('exchange_unbind', chan)

    def test_unbind_from_by_name(self):
        chan = get_conn().channel()
        foo = Exchange('foo', 'topic')
        foo(chan).unbind_from('bar')
        self.assertIn('exchange_unbind', chan)


class test_Queue(Case):

    def setUp(self):
        self.exchange = Exchange('foo', 'direct')

    def test_hash(self):
        self.assertEqual(hash(Queue('a')), hash(Queue('a')))
        self.assertNotEqual(hash(Queue('a')), hash(Queue('b')))

    def test_repr_with_bindings(self):
        ex = Exchange('foo')
        x = Queue('foo', bindings=[ex.binding('A'), ex.binding('B')])
        self.assertTrue(repr(x))

    def test_anonymous(self):
        chan = Mock()
        x = Queue(bindings=[binding(Exchange('foo'), 'rkey')])
        chan.queue_declare.return_value = 'generated', 0, 0
        xx = x(chan)
        xx.declare()
        self.assertEqual(xx.name, 'generated')

    def test_basic_get__accept_disallowed(self):
        conn = Connection('memory://')
        q = Queue('foo', exchange=self.exchange)
        p = Producer(conn)
        p.publish(
            {'complex': object()},
            declare=[q], exchange=self.exchange, serializer='pickle',
        )

        message = q(conn).get(no_ack=True)
        self.assertIsNotNone(message)

        with self.assertRaises(q.ContentDisallowed):
            message.decode()

    def test_basic_get__accept_allowed(self):
        conn = Connection('memory://')
        q = Queue('foo', exchange=self.exchange)
        p = Producer(conn)
        p.publish(
            {'complex': object()},
            declare=[q], exchange=self.exchange, serializer='pickle',
        )

        message = q(conn).get(accept=['pickle'], no_ack=True)
        self.assertIsNotNone(message)

        payload = message.decode()
        self.assertTrue(payload['complex'])

    def test_when_bound_but_no_exchange(self):
        q = Queue('a')
        q.exchange = None
        self.assertIsNone(q.when_bound())

    def test_declare_but_no_exchange(self):
        q = Queue('a')
        q.queue_declare = Mock()
        q.queue_bind = Mock()
        q.exchange = None

        q.declare()
        q.queue_declare.assert_called_with(False, passive=False)

    def test_bind_to_when_name(self):
        chan = Mock()
        q = Queue('a')
        q(chan).bind_to('ex')
        self.assertTrue(chan.queue_bind.called)

    def test_get_when_no_m2p(self):
        chan = Mock()
        q = Queue('a')(chan)
        chan.message_to_python = None
        self.assertTrue(q.get())

    def test_multiple_bindings(self):
        chan = Mock()
        q = Queue('mul', [
            binding(Exchange('mul1'), 'rkey1'),
            binding(Exchange('mul2'), 'rkey2'),
            binding(Exchange('mul3'), 'rkey3'),
        ])
        q(chan).declare()
        self.assertIn(
            call(
                nowait=False,
                exchange='mul1',
                auto_delete=False,
                passive=False,
                arguments=None,
                type='direct',
                durable=True,
            ),
            chan.exchange_declare.call_args_list,
        )

    def test_can_cache_declaration(self):
        self.assertTrue(Queue('a', durable=True).can_cache_declaration)
        self.assertTrue(Queue('a', durable=False).can_cache_declaration)

    def test_eq(self):
        q1 = Queue('xxx', Exchange('xxx', 'direct'), 'xxx')
        q2 = Queue('xxx', Exchange('xxx', 'direct'), 'xxx')
        self.assertEqual(q1, q2)
        self.assertEqual(q1.__eq__(True), NotImplemented)

        q3 = Queue('yyy', Exchange('xxx', 'direct'), 'xxx')
        self.assertNotEqual(q1, q3)

    def test_exclusive_implies_auto_delete(self):
        self.assertTrue(
            Queue('foo', self.exchange, exclusive=True).auto_delete,
        )

    def test_binds_at_instantiation(self):
        self.assertTrue(Queue('foo', self.exchange,
                              channel=get_conn().channel()).is_bound)

    def test_also_binds_exchange(self):
        chan = get_conn().channel()
        b = Queue('foo', self.exchange)
        self.assertFalse(b.is_bound)
        self.assertFalse(b.exchange.is_bound)
        b = b.bind(chan)
        self.assertTrue(b.is_bound)
        self.assertTrue(b.exchange.is_bound)
        self.assertIs(b.channel, b.exchange.channel)
        self.assertIsNot(b.exchange, self.exchange)

    def test_declare(self):
        chan = get_conn().channel()
        b = Queue('foo', self.exchange, 'foo', channel=chan)
        self.assertTrue(b.is_bound)
        b.declare()
        self.assertIn('exchange_declare', chan)
        self.assertIn('queue_declare', chan)
        self.assertIn('queue_bind', chan)

    def test_get(self):
        b = Queue('foo', self.exchange, 'foo', channel=get_conn().channel())
        b.get()
        self.assertIn('basic_get', b.channel)

    def test_purge(self):
        b = Queue('foo', self.exchange, 'foo', channel=get_conn().channel())
        b.purge()
        self.assertIn('queue_purge', b.channel)

    def test_consume(self):
        b = Queue('foo', self.exchange, 'foo', channel=get_conn().channel())
        b.consume('fifafo', None)
        self.assertIn('basic_consume', b.channel)

    def test_cancel(self):
        b = Queue('foo', self.exchange, 'foo', channel=get_conn().channel())
        b.cancel('fifafo')
        self.assertIn('basic_cancel', b.channel)

    def test_delete(self):
        b = Queue('foo', self.exchange, 'foo', channel=get_conn().channel())
        b.delete()
        self.assertIn('queue_delete', b.channel)

    def test_queue_unbind(self):
        b = Queue('foo', self.exchange, 'foo', channel=get_conn().channel())
        b.queue_unbind()
        self.assertIn('queue_unbind', b.channel)

    def test_as_dict(self):
        q = Queue('foo', self.exchange, 'rk')
        d = q.as_dict(recurse=True)
        self.assertEqual(d['exchange']['name'], self.exchange.name)

    def test_queue_dump(self):
        b = binding(self.exchange, 'rk')
        q = Queue('foo', self.exchange, 'rk', bindings=[b])
        d = q.as_dict(recurse=True)
        self.assertEqual(d['bindings'][0]['routing_key'], 'rk')
        registry.dumps(d)

    def test__repr__(self):
        b = Queue('foo', self.exchange, 'foo')
        self.assertIn('foo', repr(b))
        self.assertIn('Queue', repr(b))
