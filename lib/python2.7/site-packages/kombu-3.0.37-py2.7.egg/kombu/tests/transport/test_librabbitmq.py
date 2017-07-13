from __future__ import absolute_import

try:
    import librabbitmq
except ImportError:
    librabbitmq = None  # noqa
else:
    from kombu.transport import librabbitmq  # noqa

from kombu.tests.case import Case, Mock, SkipTest, patch


class lrmqCase(Case):

    def setUp(self):
        if librabbitmq is None:
            raise SkipTest('librabbitmq is not installed')


class test_Message(lrmqCase):

    def test_init(self):
        chan = Mock(name='channel')
        message = librabbitmq.Message(
            chan, {'prop': 42}, {'delivery_tag': 337}, 'body',
        )
        self.assertEqual(message.body, 'body')
        self.assertEqual(message.delivery_tag, 337)
        self.assertEqual(message.properties['prop'], 42)


class test_Channel(lrmqCase):

    def test_prepare_message(self):
        conn = Mock(name='connection')
        chan = librabbitmq.Channel(conn, 1)
        self.assertTrue(chan)

        body = 'the quick brown fox...'
        properties = {'name': 'Elaine M.'}

        body2, props2 = chan.prepare_message(
            body, properties=properties,
            priority=999,
            content_type='ctype',
            content_encoding='cenc',
            headers={'H': 2},
        )

        self.assertEqual(props2['name'], 'Elaine M.')
        self.assertEqual(props2['priority'], 999)
        self.assertEqual(props2['content_type'], 'ctype')
        self.assertEqual(props2['content_encoding'], 'cenc')
        self.assertEqual(props2['headers'], {'H': 2})
        self.assertEqual(body2, body)

        body3, props3 = chan.prepare_message(body, priority=777)
        self.assertEqual(props3['priority'], 777)
        self.assertEqual(body3, body)


class test_Transport(lrmqCase):

    def setUp(self):
        super(test_Transport, self).setUp()
        self.client = Mock(name='client')
        self.T = librabbitmq.Transport(self.client)

    def test_driver_version(self):
        self.assertTrue(self.T.driver_version())

    def test_create_channel(self):
        conn = Mock(name='connection')
        chan = self.T.create_channel(conn)
        self.assertTrue(chan)
        conn.channel.assert_called_with()

    def test_drain_events(self):
        conn = Mock(name='connection')
        self.T.drain_events(conn, timeout=1.33)
        conn.drain_events.assert_called_with(timeout=1.33)

    def test_establish_connection_SSL_not_supported(self):
        self.client.ssl = True
        with self.assertRaises(NotImplementedError):
            self.T.establish_connection()

    def test_establish_connection(self):
        self.T.Connection = Mock(name='Connection')
        self.T.client.ssl = False
        self.T.client.port = None
        self.T.client.transport_options = {}

        conn = self.T.establish_connection()
        self.assertEqual(
            self.T.client.port,
            self.T.default_connection_params['port'],
        )
        self.assertEqual(conn.client, self.T.client)
        self.assertEqual(self.T.client.drain_events, conn.drain_events)

    def test_collect__no_conn(self):
        self.T.client.drain_events = 1234
        self.T._collect(None)
        self.assertIsNone(self.client.drain_events)
        self.assertIsNone(self.T.client)

    def test_collect__with_conn(self):
        self.T.client.drain_events = 1234
        conn = Mock(name='connection')
        chans = conn.channels = {1: Mock(name='chan1'), 2: Mock(name='chan2')}
        conn.callbacks = {'foo': Mock(name='cb1'), 'bar': Mock(name='cb2')}
        for i, chan in enumerate(conn.channels.values()):
            chan.connection = i

        with patch('os.close') as close:
            self.T._collect(conn)
            close.assert_called_with(conn.fileno())
        self.assertFalse(conn.channels)
        self.assertFalse(conn.callbacks)
        for chan in chans.values():
            self.assertIsNone(chan.connection)
        self.assertIsNone(self.client.drain_events)
        self.assertIsNone(self.T.client)

        with patch('os.close') as close:
            self.T.client = self.client
            close.side_effect = OSError()
            self.T._collect(conn)
            close.assert_called_with(conn.fileno())

    def test_register_with_event_loop(self):
        conn = Mock(name='conn')
        loop = Mock(name='loop')
        self.T.register_with_event_loop(conn, loop)
        loop.add_reader.assert_called_with(
            conn.fileno(), self.T.on_readable, conn, loop,
        )

    def test_verify_connection(self):
        conn = Mock(name='connection')
        conn.connected = True
        self.assertTrue(self.T.verify_connection(conn))

    def test_close_connection(self):
        conn = Mock(name='connection')
        self.client.drain_events = 1234
        self.T.close_connection(conn)
        self.assertIsNone(self.client.drain_events)
        conn.close.assert_called_with()
