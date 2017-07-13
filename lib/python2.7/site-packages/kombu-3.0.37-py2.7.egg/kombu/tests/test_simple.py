from __future__ import absolute_import

from kombu import Connection, Exchange, Queue

from .case import Case, Mock


class SimpleBase(Case):
    abstract = True

    def Queue(self, name, *args, **kwargs):
        q = name
        if not isinstance(q, Queue):
            q = self.__class__.__name__
            if name:
                q = '%s.%s' % (q, name)
        return self._Queue(q, *args, **kwargs)

    def _Queue(self, *args, **kwargs):
        raise NotImplementedError()

    def setUp(self):
        if not self.abstract:
            self.connection = Connection(transport='memory')
            with self.connection.channel() as channel:
                channel.exchange_declare('amq.direct')
            self.q = self.Queue(None, no_ack=True)

    def tearDown(self):
        if not self.abstract:
            self.q.close()
            self.connection.close()

    def test_produce__consume(self):
        if self.abstract:
            return
        q = self.Queue('test_produce__consume', no_ack=True)

        q.put({'hello': 'Simple'})

        self.assertEqual(q.get(timeout=1).payload, {'hello': 'Simple'})
        with self.assertRaises(q.Empty):
            q.get(timeout=0.1)

    def test_produce__basic_get(self):
        if self.abstract:
            return
        q = self.Queue('test_produce__basic_get', no_ack=True)
        q.put({'hello': 'SimpleSync'})
        self.assertEqual(q.get_nowait().payload, {'hello': 'SimpleSync'})
        with self.assertRaises(q.Empty):
            q.get_nowait()

        q.put({'hello': 'SimpleSync'})
        self.assertEqual(q.get(block=False).payload, {'hello': 'SimpleSync'})
        with self.assertRaises(q.Empty):
            q.get(block=False)

    def test_clear(self):
        if self.abstract:
            return
        q = self.Queue('test_clear', no_ack=True)

        for i in range(10):
            q.put({'hello': 'SimplePurge%d' % (i, )})

        self.assertEqual(q.clear(), 10)

    def test_enter_exit(self):
        if self.abstract:
            return
        q = self.Queue('test_enter_exit')
        q.close = Mock()

        self.assertIs(q.__enter__(), q)
        q.__exit__()
        q.close.assert_called_with()

    def test_qsize(self):
        if self.abstract:
            return
        q = self.Queue('test_clear', no_ack=True)

        for i in range(10):
            q.put({'hello': 'SimplePurge%d' % (i, )})

        self.assertEqual(q.qsize(), 10)
        self.assertEqual(len(q), 10)

    def test_autoclose(self):
        if self.abstract:
            return
        channel = self.connection.channel()
        q = self.Queue('test_autoclose', no_ack=True, channel=channel)
        q.close()

    def test_custom_Queue(self):
        if self.abstract:
            return
        n = self.__class__.__name__
        exchange = Exchange('%s-test.custom.Queue' % (n, ))
        queue = Queue('%s-test.custom.Queue' % (n, ),
                      exchange,
                      'my.routing.key')

        q = self.Queue(queue)
        self.assertEqual(q.consumer.queues[0], queue)
        q.close()

    def test_bool(self):
        if self.abstract:
            return
        q = self.Queue('test_nonzero')
        self.assertTrue(q)


class test_SimpleQueue(SimpleBase):
    abstract = False

    def _Queue(self, *args, **kwargs):
        return self.connection.SimpleQueue(*args, **kwargs)

    def test_is_ack(self):
        q = self.Queue('test_is_no_ack')
        self.assertFalse(q.no_ack)


class test_SimpleBuffer(SimpleBase):
    abstract = False

    def Queue(self, *args, **kwargs):
        return self.connection.SimpleBuffer(*args, **kwargs)

    def test_is_no_ack(self):
        q = self.Queue('test_is_no_ack')
        self.assertTrue(q.no_ack)
