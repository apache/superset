from __future__ import absolute_import

from collections import defaultdict

from amqp.channel import Channel
from amqp.exceptions import NotConfirmed
from amqp.serialization import AMQPWriter, AMQPReader

from amqp.tests.case import Case, Mock


class NoOpenChannel(Channel):

    def _x_open(self):
        pass


class test_Channel(Case):

    def setUp(self):
        self.args = AMQPWriter()
        self.connection = Mock(name='connection')
        self.connection.channels = defaultdict(lambda: None)
        self.channel = NoOpenChannel(self.connection, channel_id=1)

    def test_basic_nack(self, delivery_tag=3172312312):
        self.args.write_longlong(delivery_tag)
        self.args.write_bit(0)
        self.args.write_bit(0)
        with self.assertRaises(NotConfirmed):
            self.channel._basic_nack(AMQPReader(self.args.getvalue()))
        callback = Mock(name='callback')
        self.channel.events['basic_nack'].add(callback)
        self.channel._basic_nack(AMQPReader(self.args.getvalue()))
        callback.assert_called_with(delivery_tag, False, False)
