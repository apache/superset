from __future__ import absolute_import

import sys

from kombu import Connection

from kombu.tests.case import Case, SkipTest, Mock, mask_modules


class MockConnection(dict):

    def __setattr__(self, key, value):
        self[key] = value

try:
    __import__('amqplib')
except ImportError:
    amqplib = Channel = None
else:
    from kombu.transport import amqplib

    class Channel(amqplib.Channel):
        wait_returns = []

        def _x_open(self, *args, **kwargs):
            pass

        def wait(self, *args, **kwargs):
            return self.wait_returns

        def _send_method(self, *args, **kwargs):
            pass


class amqplibCase(Case):

    def setUp(self):
        if amqplib is None:
            raise SkipTest('amqplib not installed')
        self.setup()

    def setup(self):
        pass


class test_Channel(amqplibCase):

    def setup(self):
        self.conn = Mock()
        self.conn.channels = {}
        self.channel = Channel(self.conn, 0)

    def test_init(self):
        self.assertFalse(self.channel.no_ack_consumers)

    def test_prepare_message(self):
        self.assertTrue(self.channel.prepare_message(
            'foobar', 10, 'application/data', 'utf-8',
            properties={},
        ))

    def test_message_to_python(self):
        message = Mock()
        message.headers = {}
        message.properties = {}
        self.assertTrue(self.channel.message_to_python(message))

    def test_close_resolves_connection_cycle(self):
        self.assertIsNotNone(self.channel.connection)
        self.channel.close()
        self.assertIsNone(self.channel.connection)

    def test_basic_consume_registers_ack_status(self):
        self.channel.wait_returns = 'my-consumer-tag'
        self.channel.basic_consume('foo', no_ack=True)
        self.assertIn('my-consumer-tag', self.channel.no_ack_consumers)

        self.channel.wait_returns = 'other-consumer-tag'
        self.channel.basic_consume('bar', no_ack=False)
        self.assertNotIn('other-consumer-tag', self.channel.no_ack_consumers)

        self.channel.basic_cancel('my-consumer-tag')
        self.assertNotIn('my-consumer-tag', self.channel.no_ack_consumers)


class test_Transport(amqplibCase):

    def setup(self):
        self.connection = Connection('amqplib://')
        self.transport = self.connection.transport

    def test_create_channel(self):
        connection = Mock()
        self.transport.create_channel(connection)
        connection.channel.assert_called_with()

    def test_drain_events(self):
        connection = Mock()
        self.transport.drain_events(connection, timeout=10.0)
        connection.drain_events.assert_called_with(timeout=10.0)

    def test_dnspython_localhost_resolve_bug(self):

        class Conn(object):

            def __init__(self, **kwargs):
                vars(self).update(kwargs)

        self.transport.Connection = Conn
        self.transport.client.hostname = 'localhost'
        conn1 = self.transport.establish_connection()
        self.assertEqual(conn1.host, '127.0.0.1:5672')

        self.transport.client.hostname = 'example.com'
        conn2 = self.transport.establish_connection()
        self.assertEqual(conn2.host, 'example.com:5672')

    def test_close_connection(self):
        connection = Mock()
        connection.client = Mock()
        self.transport.close_connection(connection)

        self.assertIsNone(connection.client)
        connection.close.assert_called_with()

    def test_verify_connection(self):
        connection = Mock()
        connection.channels = None
        self.assertFalse(self.transport.verify_connection(connection))

        connection.channels = {1: 1, 2: 2}
        self.assertTrue(self.transport.verify_connection(connection))

    @mask_modules('ssl')
    def test_import_no_ssl(self):
        pm = sys.modules.pop('kombu.transport.amqplib')
        try:
            from kombu.transport.amqplib import SSLError
            self.assertEqual(SSLError.__module__, 'kombu.transport.amqplib')
        finally:
            if pm is not None:
                sys.modules['kombu.transport.amqplib'] = pm


class test_amqplib(amqplibCase):

    def test_default_port(self):

        class Transport(amqplib.Transport):
            Connection = MockConnection

        c = Connection(port=None, transport=Transport).connect()
        self.assertEqual(c['host'],
                         '127.0.0.1:%s' % (Transport.default_port, ))

    def test_custom_port(self):

        class Transport(amqplib.Transport):
            Connection = MockConnection

        c = Connection(port=1337, transport=Transport).connect()
        self.assertEqual(c['host'], '127.0.0.1:1337')
