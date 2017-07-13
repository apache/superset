from __future__ import absolute_import

import sys
import tempfile

from kombu import Connection, Exchange, Queue, Consumer, Producer

from kombu.tests.case import Case, SkipTest


class test_FilesystemTransport(Case):

    def setUp(self):
        if sys.platform == 'win32':
            raise SkipTest('Needs win32con module')
        try:
            data_folder_in = tempfile.mkdtemp()
            data_folder_out = tempfile.mkdtemp()
        except Exception:
            raise SkipTest('filesystem transport: cannot create tempfiles')
        self.c = Connection(transport='filesystem',
                            transport_options={
                                'data_folder_in': data_folder_in,
                                'data_folder_out': data_folder_out,
                            })
        self.p = Connection(transport='filesystem',
                            transport_options={
                                'data_folder_in': data_folder_out,
                                'data_folder_out': data_folder_in,
                            })
        self.e = Exchange('test_transport_filesystem')
        self.q = Queue('test_transport_filesystem',
                       exchange=self.e,
                       routing_key='test_transport_filesystem')
        self.q2 = Queue('test_transport_filesystem2',
                        exchange=self.e,
                        routing_key='test_transport_filesystem2')

    def test_produce_consume_noack(self):
        producer = Producer(self.p.channel(), self.e)
        consumer = Consumer(self.c.channel(), self.q, no_ack=True)

        for i in range(10):
            producer.publish({'foo': i},
                             routing_key='test_transport_filesystem')

        _received = []

        def callback(message_data, message):
            _received.append(message)

        consumer.register_callback(callback)
        consumer.consume()

        while 1:
            if len(_received) == 10:
                break
            self.c.drain_events()

        self.assertEqual(len(_received), 10)

    def test_produce_consume(self):
        producer_channel = self.p.channel()
        consumer_channel = self.c.channel()
        producer = Producer(producer_channel, self.e)
        consumer1 = Consumer(consumer_channel, self.q)
        consumer2 = Consumer(consumer_channel, self.q2)
        self.q2(consumer_channel).declare()

        for i in range(10):
            producer.publish({'foo': i},
                             routing_key='test_transport_filesystem')
        for i in range(10):
            producer.publish({'foo': i},
                             routing_key='test_transport_filesystem2')

        _received1 = []
        _received2 = []

        def callback1(message_data, message):
            _received1.append(message)
            message.ack()

        def callback2(message_data, message):
            _received2.append(message)
            message.ack()

        consumer1.register_callback(callback1)
        consumer2.register_callback(callback2)

        consumer1.consume()
        consumer2.consume()

        while 1:
            if len(_received1) + len(_received2) == 20:
                break
            self.c.drain_events()

        self.assertEqual(len(_received1) + len(_received2), 20)

        # compression
        producer.publish({'compressed': True},
                         routing_key='test_transport_filesystem',
                         compression='zlib')
        m = self.q(consumer_channel).get()
        self.assertDictEqual(m.payload, {'compressed': True})

        # queue.delete
        for i in range(10):
            producer.publish({'foo': i},
                             routing_key='test_transport_filesystem')
        self.assertTrue(self.q(consumer_channel).get())
        self.q(consumer_channel).delete()
        self.q(consumer_channel).declare()
        self.assertIsNone(self.q(consumer_channel).get())

        # queue.purge
        for i in range(10):
            producer.publish({'foo': i},
                             routing_key='test_transport_filesystem2')
        self.assertTrue(self.q2(consumer_channel).get())
        self.q2(consumer_channel).purge()
        self.assertIsNone(self.q2(consumer_channel).get())
