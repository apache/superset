from __future__ import absolute_import

from kombu import Connection
from kombu.transport.virtual import exchange

from kombu.tests.case import Case, Mock
from kombu.tests.mocks import Transport


class ExchangeCase(Case):
    type = None

    def setUp(self):
        if self.type:
            self.e = self.type(Connection(transport=Transport).channel())


class test_Direct(ExchangeCase):
    type = exchange.DirectExchange
    table = [('rFoo', None, 'qFoo'),
             ('rFoo', None, 'qFox'),
             ('rBar', None, 'qBar'),
             ('rBaz', None, 'qBaz')]

    def test_lookup(self):
        self.assertListEqual(
            self.e.lookup(self.table, 'eFoo', 'rFoo', None),
            ['qFoo', 'qFox'],
        )
        self.assertListEqual(
            self.e.lookup(self.table, 'eMoz', 'rMoz', 'DEFAULT'),
            [],
        )
        self.assertListEqual(
            self.e.lookup(self.table, 'eBar', 'rBar', None),
            ['qBar'],
        )


class test_Fanout(ExchangeCase):
    type = exchange.FanoutExchange
    table = [(None, None, 'qFoo'),
             (None, None, 'qFox'),
             (None, None, 'qBar')]

    def test_lookup(self):
        self.assertListEqual(
            self.e.lookup(self.table, 'eFoo', 'rFoo', None),
            ['qFoo', 'qFox', 'qBar'],
        )

    def test_deliver_when_fanout_supported(self):
        self.e.channel = Mock()
        self.e.channel.supports_fanout = True
        message = Mock()

        self.e.deliver(message, 'exchange', 'rkey')
        self.e.channel._put_fanout.assert_called_with(
            'exchange', message, 'rkey',
        )

    def test_deliver_when_fanout_unsupported(self):
        self.e.channel = Mock()
        self.e.channel.supports_fanout = False

        self.e.deliver(Mock(), 'exchange', None)
        self.assertFalse(self.e.channel._put_fanout.called)


class test_Topic(ExchangeCase):
    type = exchange.TopicExchange
    table = [
        ('stock.#', None, 'rFoo'),
        ('stock.us.*', None, 'rBar'),
    ]

    def setUp(self):
        super(test_Topic, self).setUp()
        self.table = [(rkey, self.e.key_to_pattern(rkey), queue)
                      for rkey, _, queue in self.table]

    def test_prepare_bind(self):
        x = self.e.prepare_bind('qFoo', 'eFoo', 'stock.#', {})
        self.assertTupleEqual(x, ('stock.#', r'^stock\..*?$', 'qFoo'))

    def test_lookup(self):
        self.assertListEqual(
            self.e.lookup(self.table, 'eFoo', 'stock.us.nasdaq', None),
            ['rFoo', 'rBar'],
        )
        self.assertTrue(self.e._compiled)
        self.assertListEqual(
            self.e.lookup(self.table, 'eFoo', 'stock.europe.OSE', None),
            ['rFoo'],
        )
        self.assertListEqual(
            self.e.lookup(self.table, 'eFoo', 'stockxeuropexOSE', None),
            [],
        )
        self.assertListEqual(
            self.e.lookup(self.table, 'eFoo',
                          'candy.schleckpulver.snap_crackle', None),
            [],
        )

    def test_deliver(self):
        self.e.channel = Mock()
        self.e.channel._lookup.return_value = ('a', 'b')
        message = Mock()
        self.e.deliver(message, 'exchange', 'rkey')

        expected = [(('a', message), {}),
                    (('b', message), {})]
        self.assertListEqual(self.e.channel._put.call_args_list, expected)


class test_ExchangeType(ExchangeCase):
    type = exchange.ExchangeType

    def test_lookup(self):
        with self.assertRaises(NotImplementedError):
            self.e.lookup([], 'eFoo', 'rFoo', None)

    def test_prepare_bind(self):
        self.assertTupleEqual(
            self.e.prepare_bind('qFoo', 'eFoo', 'rFoo', {}),
            ('rFoo', None, 'qFoo'),
        )

    def test_equivalent(self):
        e1 = dict(
            type='direct',
            durable=True,
            auto_delete=True,
            arguments={},
        )
        self.assertTrue(
            self.e.equivalent(e1, 'eFoo', 'direct', True, True, {}),
        )
        self.assertFalse(
            self.e.equivalent(e1, 'eFoo', 'topic', True, True, {}),
        )
        self.assertFalse(
            self.e.equivalent(e1, 'eFoo', 'direct', False, True, {}),
        )
        self.assertFalse(
            self.e.equivalent(e1, 'eFoo', 'direct', True, False, {}),
        )
        self.assertFalse(
            self.e.equivalent(e1, 'eFoo', 'direct', True, True,
                              {'expires': 3000}),
        )
        e2 = dict(e1, arguments={'expires': 3000})
        self.assertTrue(
            self.e.equivalent(e2, 'eFoo', 'direct', True, True,
                              {'expires': 3000}),
        )
        self.assertFalse(
            self.e.equivalent(e2, 'eFoo', 'direct', True, True,
                              {'expires': 6000}),
        )
