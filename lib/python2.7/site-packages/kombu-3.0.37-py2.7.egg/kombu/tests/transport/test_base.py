from __future__ import absolute_import

from kombu import Connection, Consumer, Exchange, Producer, Queue
from kombu.five import text_t
from kombu.message import Message
from kombu.transport.base import StdChannel, Transport, Management

from kombu.tests.case import Case, Mock


class test_StdChannel(Case):

    def setUp(self):
        self.conn = Connection('memory://')
        self.channel = self.conn.channel()
        self.channel.queues.clear()
        self.conn.connection.state.clear()

    def test_Consumer(self):
        q = Queue('foo', Exchange('foo'))
        print(self.channel.queues)
        cons = self.channel.Consumer(q)
        self.assertIsInstance(cons, Consumer)
        self.assertIs(cons.channel, self.channel)

    def test_Producer(self):
        prod = self.channel.Producer()
        self.assertIsInstance(prod, Producer)
        self.assertIs(prod.channel, self.channel)

    def test_interface_get_bindings(self):
        with self.assertRaises(NotImplementedError):
            StdChannel().get_bindings()

    def test_interface_after_reply_message_received(self):
        self.assertIsNone(
            StdChannel().after_reply_message_received(Queue('foo')),
        )


class test_Message(Case):

    def setUp(self):
        self.conn = Connection('memory://')
        self.channel = self.conn.channel()
        self.message = Message(self.channel, delivery_tag=313)

    def test_postencode(self):
        m = Message(self.channel, text_t('FOO'), postencode='ccyzz')
        with self.assertRaises(LookupError):
            m._reraise_error()
        m.ack()

    def test_ack_respects_no_ack_consumers(self):
        self.channel.no_ack_consumers = set(['abc'])
        self.message.delivery_info['consumer_tag'] = 'abc'
        ack = self.channel.basic_ack = Mock()

        self.message.ack()
        self.assertNotEqual(self.message._state, 'ACK')
        self.assertFalse(ack.called)

    def test_ack_missing_consumer_tag(self):
        self.channel.no_ack_consumers = set(['abc'])
        self.message.delivery_info = {}
        ack = self.channel.basic_ack = Mock()

        self.message.ack()
        ack.assert_called_with(self.message.delivery_tag)

    def test_ack_not_no_ack(self):
        self.channel.no_ack_consumers = set()
        self.message.delivery_info['consumer_tag'] = 'abc'
        ack = self.channel.basic_ack = Mock()

        self.message.ack()
        ack.assert_called_with(self.message.delivery_tag)

    def test_ack_log_error_when_no_error(self):
        ack = self.message.ack = Mock()
        self.message.ack_log_error(Mock(), KeyError)
        ack.assert_called_with()

    def test_ack_log_error_when_error(self):
        ack = self.message.ack = Mock()
        ack.side_effect = KeyError('foo')
        logger = Mock()
        self.message.ack_log_error(logger, KeyError)
        ack.assert_called_with()
        self.assertTrue(logger.critical.called)
        self.assertIn("Couldn't ack", logger.critical.call_args[0][0])

    def test_reject_log_error_when_no_error(self):
        reject = self.message.reject = Mock()
        self.message.reject_log_error(Mock(), KeyError, requeue=True)
        reject.assert_called_with(requeue=True)

    def test_reject_log_error_when_error(self):
        reject = self.message.reject = Mock()
        reject.side_effect = KeyError('foo')
        logger = Mock()
        self.message.reject_log_error(logger, KeyError)
        reject.assert_called_with(requeue=False)
        self.assertTrue(logger.critical.called)
        self.assertIn("Couldn't reject", logger.critical.call_args[0][0])


class test_interface(Case):

    def test_establish_connection(self):
        with self.assertRaises(NotImplementedError):
            Transport(None).establish_connection()

    def test_close_connection(self):
        with self.assertRaises(NotImplementedError):
            Transport(None).close_connection(None)

    def test_create_channel(self):
        with self.assertRaises(NotImplementedError):
            Transport(None).create_channel(None)

    def test_close_channel(self):
        with self.assertRaises(NotImplementedError):
            Transport(None).close_channel(None)

    def test_drain_events(self):
        with self.assertRaises(NotImplementedError):
            Transport(None).drain_events(None)

    def test_heartbeat_check(self):
        Transport(None).heartbeat_check(Mock(name='connection'))

    def test_driver_version(self):
        self.assertTrue(Transport(None).driver_version())

    def test_register_with_event_loop(self):
        Transport(None).register_with_event_loop(Mock(name='loop'))

    def test_manager(self):
        self.assertTrue(Transport(None).manager)


class test_Management(Case):

    def test_get_bindings(self):
        m = Management(Mock(name='transport'))
        with self.assertRaises(NotImplementedError):
            m.get_bindings()
