"""Testing module for the kombu.transport.SQS package.

NOTE: The SQSQueueMock and SQSConnectionMock classes originally come from
http://github.com/pcsforeducation/sqs-mock-python. They have been patched
slightly.
"""

from __future__ import absolute_import

import sys

from kombu import Connection
from kombu import messaging
from kombu import five
from kombu.tests.case import Case, SkipTest
import kombu


if sys.version_info[0] >= 3:
    SQS, skip_reason = None, 'boto does not support Python 3'  # noqa
else:
    try:
        from kombu.transport import SQS
    except ImportError:
        # Boto must not be installed if the SQS transport fails to import,
        # so we skip all unit tests. Set SQS to None here, and it will be
        # checked during the setUp() phase later.
        SQS, skip_reason = None, 'boto not installed'  # noqa


class SQSQueueMock(object):

    def __init__(self, name):
        self.name = name
        self.messages = []
        self._get_message_calls = 0

    def clear(self, page_size=10, vtimeout=10):
        empty, self.messages[:] = not self.messages, []
        return not empty

    def count(self, page_size=10, vtimeout=10):
        return len(self.messages)
    count_slow = count

    def delete(self):
        self.messages[:] = []
        return True

    def delete_message(self, message):
        try:
            self.messages.remove(message)
        except ValueError:
            return False
        return True

    def get_messages(self, num_messages=1, visibility_timeout=None,
                     attributes=None, *args, **kwargs):
        self._get_message_calls += 1
        return self.messages[:num_messages]

    def read(self, visibility_timeout=None):
        return self.messages.pop(0)

    def write(self, message):
        self.messages.append(message)
        return True


class SQSConnectionMock(object):

    def __init__(self):
        self.queues = {}

    def get_queue(self, queue):
        return self.queues.get(queue)

    def get_all_queues(self, prefix=""):
        return self.queues.values()

    def delete_queue(self, queue, force_deletion=False):
        q = self.get_queue(queue)
        if q:
            if q.count():
                return False
            q.clear()
            self.queues.pop(queue, None)

    def delete_message(self, queue, message):
        return queue.delete_message(message)

    def create_queue(self, name, *args, **kwargs):
        q = self.queues[name] = SQSQueueMock(name)
        return q


class test_Channel(Case):

    def handleMessageCallback(self, message):
        self.callback_message = message

    def setUp(self):
        """Mock the back-end SQS classes"""
        # Sanity check... if SQS is None, then it did not import and we
        # cannot execute our tests.
        if SQS is None:
            raise SkipTest(skip_reason)

        SQS.Channel._queue_cache.clear()

        # Common variables used in the unit tests
        self.queue_name = 'unittest'

        # Mock the sqs() method that returns an SQSConnection object and
        # instead return an SQSConnectionMock() object.
        self.sqs_conn_mock = SQSConnectionMock()

        def mock_sqs():
            return self.sqs_conn_mock
        SQS.Channel.sqs = mock_sqs()

        # Set up a task exchange for passing tasks through the queue
        self.exchange = kombu.Exchange('test_SQS', type='direct')
        self.queue = kombu.Queue(self.queue_name,
                                 self.exchange,
                                 self.queue_name)

        # Mock up a test SQS Queue with the SQSQueueMock class (and always
        # make sure its a clean empty queue)
        self.sqs_queue_mock = SQSQueueMock(self.queue_name)

        # Now, create our Connection object with the SQS Transport and store
        # the connection/channel objects as references for use in these tests.
        self.connection = Connection(transport=SQS.Transport)
        self.channel = self.connection.channel()

        self.queue(self.channel).declare()
        self.producer = messaging.Producer(self.channel,
                                           self.exchange,
                                           routing_key=self.queue_name)

        # Lastly, make sure that we're set up to 'consume' this queue.
        self.channel.basic_consume(self.queue_name,
                                   no_ack=True,
                                   callback=self.handleMessageCallback,
                                   consumer_tag='unittest')

    def test_init(self):
        """kombu.SQS.Channel instantiates correctly with mocked queues"""
        self.assertIn(self.queue_name, self.channel._queue_cache)

    def test_new_queue(self):
        queue_name = 'new_unittest_queue'
        self.channel._new_queue(queue_name)
        self.assertIn(queue_name, self.sqs_conn_mock.queues)
        # For cleanup purposes, delete the queue and the queue file
        self.channel._delete(queue_name)

    def test_delete(self):
        queue_name = 'new_unittest_queue'
        self.channel._new_queue(queue_name)
        self.channel._delete(queue_name)
        self.assertNotIn(queue_name, self.channel._queue_cache)

    def test_get_from_sqs(self):
        # Test getting a single message
        message = 'my test message'
        self.producer.publish(message)
        results = self.channel._get_from_sqs(self.queue_name)
        self.assertEqual(len(results), 1)

        # Now test getting many messages
        for i in range(3):
            message = 'message: {0}'.format(i)
            self.producer.publish(message)

        results = self.channel._get_from_sqs(self.queue_name, count=3)
        self.assertEqual(len(results), 3)

    def test_get_with_empty_list(self):
        with self.assertRaises(five.Empty):
            self.channel._get(self.queue_name)

    def test_get_bulk_raises_empty(self):
        with self.assertRaises(five.Empty):
            self.channel._get_bulk(self.queue_name)

    def test_messages_to_python(self):
        message_count = 3
        # Create several test messages and publish them
        for i in range(message_count):
            message = 'message: %s' % i
            self.producer.publish(message)

        # Get the messages now
        messages = self.channel._get_from_sqs(
            self.queue_name, count=message_count,
        )

        # Now convert them to payloads
        payloads = self.channel._messages_to_python(
            messages, self.queue_name,
        )

        # We got the same number of payloads back, right?
        self.assertEqual(len(payloads), message_count)

        # Make sure they're payload-style objects
        for p in payloads:
            self.assertTrue('properties' in p)

    def test_put_and_get(self):
        message = 'my test message'
        self.producer.publish(message)
        results = self.queue(self.channel).get().payload
        self.assertEqual(message, results)

    def test_puts_and_gets(self):
        for i in range(3):
            message = 'message: %s' % i
            self.producer.publish(message)

        for i in range(3):
            self.assertEqual('message: %s' % i,
                             self.queue(self.channel).get().payload)

    def test_put_and_get_bulk(self):
        # With QoS.prefetch_count = 0
        message = 'my test message'
        self.producer.publish(message)
        results = self.channel._get_bulk(self.queue_name)
        self.assertEqual(1, len(results))

    def test_puts_and_get_bulk(self):
        # Generate 8 messages
        message_count = 8

        # Set the prefetch_count to 5
        self.channel.qos.prefetch_count = 5

        # Now, generate all the messages
        for i in range(message_count):
            message = 'message: %s' % i
            self.producer.publish(message)

        # Count how many messages are retrieved the first time. Should
        # be 5 (message_count).
        results = self.channel._get_bulk(self.queue_name)
        self.assertEqual(5, len(results))

        # Now, do the get again, the number of messages returned should be 3.
        results = self.channel._get_bulk(self.queue_name)
        self.assertEqual(3, len(results))

    def test_drain_events_with_empty_list(self):
        def mock_can_consume():
            return False
        self.channel.qos.can_consume = mock_can_consume
        with self.assertRaises(five.Empty):
            self.channel.drain_events()

    def test_drain_events_with_prefetch_5(self):
        # Generate 20 messages
        message_count = 20
        expected_get_message_count = 4

        # Set the prefetch_count to 5
        self.channel.qos.prefetch_count = 5

        # Now, generate all the messages
        for i in range(message_count):
            self.producer.publish('message: %s' % i)

        # Now drain all the events
        for i in range(message_count):
            self.channel.drain_events()

        # How many times was the SQSConnectionMock get_message method called?
        self.assertEqual(
            expected_get_message_count,
            self.channel._queue_cache[self.queue_name]._get_message_calls)

    def test_drain_events_with_prefetch_none(self):
        # Generate 20 messages
        message_count = 20
        expected_get_message_count = 2

        # Set the prefetch_count to None
        self.channel.qos.prefetch_count = None

        # Now, generate all the messages
        for i in range(message_count):
            self.producer.publish('message: %s' % i)

        # Now drain all the events
        for i in range(message_count):
            self.channel.drain_events()

        # How many times was the SQSConnectionMock get_message method called?
        self.assertEqual(
            expected_get_message_count,
            self.channel._queue_cache[self.queue_name]._get_message_calls)
