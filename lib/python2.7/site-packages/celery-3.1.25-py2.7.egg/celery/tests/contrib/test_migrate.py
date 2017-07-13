from __future__ import absolute_import, unicode_literals

from contextlib import contextmanager

from amqp import ChannelError

from kombu import Connection, Producer, Queue, Exchange

from kombu.transport.virtual import QoS

from celery.contrib.migrate import (
    StopFiltering,
    State,
    migrate_task,
    migrate_tasks,
    filter_callback,
    _maybe_queue,
    filter_status,
    move_by_taskmap,
    move_by_idmap,
    move_task_by_id,
    start_filter,
    task_id_in,
    task_id_eq,
    expand_dest,
    move,
)
from celery.utils.encoding import bytes_t, ensure_bytes
from celery.tests.case import AppCase, Mock, override_stdouts, patch

# hack to ignore error at shutdown
QoS.restore_at_shutdown = False


def Message(body, exchange='exchange', routing_key='rkey',
            compression=None, content_type='application/json',
            content_encoding='utf-8'):
    return Mock(
        attrs={
            'body': body,
            'delivery_info': {
                'exchange': exchange,
                'routing_key': routing_key,
            },
            'headers': {
                'compression': compression,
            },
            'content_type': content_type,
            'content_encoding': content_encoding,
            'properties': {}
        },
    )


class test_State(AppCase):

    def test_strtotal(self):
        x = State()
        self.assertEqual(x.strtotal, '?')
        x.total_apx = 100
        self.assertEqual(x.strtotal, '100')

    def test_repr(self):
        x = State()
        self.assertTrue(repr(x))
        x.filtered = 'foo'
        self.assertTrue(repr(x))


class test_move(AppCase):

    @contextmanager
    def move_context(self, **kwargs):
        with patch('celery.contrib.migrate.start_filter') as start:
            with patch('celery.contrib.migrate.republish') as republish:
                pred = Mock(name='predicate')
                move(pred, app=self.app,
                     connection=self.app.connection(), **kwargs)
                self.assertTrue(start.called)
                callback = start.call_args[0][2]
                yield callback, pred, republish

    def msgpair(self, **kwargs):
        body = dict({'task': 'add', 'id': 'id'}, **kwargs)
        return body, Message(body)

    def test_move(self):
        with self.move_context() as (callback, pred, republish):
            pred.return_value = None
            body, message = self.msgpair()
            callback(body, message)
            self.assertFalse(message.ack.called)
            self.assertFalse(republish.called)

            pred.return_value = 'foo'
            callback(body, message)
            message.ack.assert_called_with()
            self.assertTrue(republish.called)

    def test_move_transform(self):
        trans = Mock(name='transform')
        trans.return_value = Queue('bar')
        with self.move_context(transform=trans) as (callback, pred, republish):
            pred.return_value = 'foo'
            body, message = self.msgpair()
            with patch('celery.contrib.migrate.maybe_declare') as maybed:
                callback(body, message)
                trans.assert_called_with('foo')
                self.assertTrue(maybed.called)
                self.assertTrue(republish.called)

    def test_limit(self):
        with self.move_context(limit=1) as (callback, pred, republish):
            pred.return_value = 'foo'
            body, message = self.msgpair()
            with self.assertRaises(StopFiltering):
                callback(body, message)
            self.assertTrue(republish.called)

    def test_callback(self):
        cb = Mock()
        with self.move_context(callback=cb) as (callback, pred, republish):
            pred.return_value = 'foo'
            body, message = self.msgpair()
            callback(body, message)
            self.assertTrue(republish.called)
            self.assertTrue(cb.called)


class test_start_filter(AppCase):

    def test_start(self):
        with patch('celery.contrib.migrate.eventloop') as evloop:
            app = Mock()
            filt = Mock(name='filter')
            conn = Connection('memory://')
            evloop.side_effect = StopFiltering()
            app.amqp.queues = {'foo': Queue('foo'), 'bar': Queue('bar')}
            consumer = app.amqp.TaskConsumer.return_value = Mock(name='consum')
            consumer.queues = list(app.amqp.queues.values())
            consumer.channel = conn.default_channel
            consumer.__enter__ = Mock(name='consumer.__enter__')
            consumer.__exit__ = Mock(name='consumer.__exit__')
            consumer.callbacks = []

            def register_callback(x):
                consumer.callbacks.append(x)
            consumer.register_callback = register_callback

            start_filter(app, conn, filt,
                         queues='foo,bar', ack_messages=True)
            body = {'task': 'add', 'id': 'id'}
            for callback in consumer.callbacks:
                callback(body, Message(body))
            consumer.callbacks[:] = []
            cb = Mock(name='callback=')
            start_filter(app, conn, filt, tasks='add,mul', callback=cb)
            for callback in consumer.callbacks:
                callback(body, Message(body))
            self.assertTrue(cb.called)

            on_declare_queue = Mock()
            start_filter(app, conn, filt, tasks='add,mul', queues='foo',
                         on_declare_queue=on_declare_queue)
            self.assertTrue(on_declare_queue.called)
            start_filter(app, conn, filt, queues=['foo', 'bar'])
            consumer.callbacks[:] = []
            state = State()
            start_filter(app, conn, filt,
                         tasks='add,mul', callback=cb, state=state, limit=1)
            stop_filtering_raised = False
            for callback in consumer.callbacks:
                try:
                    callback(body, Message(body))
                except StopFiltering:
                    stop_filtering_raised = True
            self.assertTrue(state.count)
            self.assertTrue(stop_filtering_raised)


class test_filter_callback(AppCase):

    def test_filter(self):
        callback = Mock()
        filt = filter_callback(callback, ['add', 'mul'])
        t1 = {'task': 'add'}
        t2 = {'task': 'div'}

        message = Mock()
        filt(t2, message)
        self.assertFalse(callback.called)
        filt(t1, message)
        callback.assert_called_with(t1, message)


class test_utils(AppCase):

    def test_task_id_in(self):
        self.assertTrue(task_id_in(['A'], {'id': 'A'}, Mock()))
        self.assertFalse(task_id_in(['A'], {'id': 'B'}, Mock()))

    def test_task_id_eq(self):
        self.assertTrue(task_id_eq('A', {'id': 'A'}, Mock()))
        self.assertFalse(task_id_eq('A', {'id': 'B'}, Mock()))

    def test_expand_dest(self):
        self.assertEqual(expand_dest(None, 'foo', 'bar'), ('foo', 'bar'))
        self.assertEqual(expand_dest(('b', 'x'), 'foo', 'bar'), ('b', 'x'))

    def test_maybe_queue(self):
        app = Mock()
        app.amqp.queues = {'foo': 313}
        self.assertEqual(_maybe_queue(app, 'foo'), 313)
        self.assertEqual(_maybe_queue(app, Queue('foo')), Queue('foo'))

    def test_filter_status(self):
        with override_stdouts() as (stdout, stderr):
            filter_status(State(), {'id': '1', 'task': 'add'}, Mock())
            self.assertTrue(stdout.getvalue())

    def test_move_by_taskmap(self):
        with patch('celery.contrib.migrate.move') as move:
            move_by_taskmap({'add': Queue('foo')})
            self.assertTrue(move.called)
            cb = move.call_args[0][0]
            self.assertTrue(cb({'task': 'add'}, Mock()))

    def test_move_by_idmap(self):
        with patch('celery.contrib.migrate.move') as move:
            move_by_idmap({'123f': Queue('foo')})
            self.assertTrue(move.called)
            cb = move.call_args[0][0]
            self.assertTrue(cb({'id': '123f'}, Mock()))

    def test_move_task_by_id(self):
        with patch('celery.contrib.migrate.move') as move:
            move_task_by_id('123f', Queue('foo'))
            self.assertTrue(move.called)
            cb = move.call_args[0][0]
            self.assertEqual(
                cb({'id': '123f'}, Mock()),
                Queue('foo'),
            )


class test_migrate_task(AppCase):

    def test_removes_compression_header(self):
        x = Message('foo', compression='zlib')
        producer = Mock()
        migrate_task(producer, x.body, x)
        self.assertTrue(producer.publish.called)
        args, kwargs = producer.publish.call_args
        self.assertIsInstance(args[0], bytes_t)
        self.assertNotIn('compression', kwargs['headers'])
        self.assertEqual(kwargs['compression'], 'zlib')
        self.assertEqual(kwargs['content_type'], 'application/json')
        self.assertEqual(kwargs['content_encoding'], 'utf-8')
        self.assertEqual(kwargs['exchange'], 'exchange')
        self.assertEqual(kwargs['routing_key'], 'rkey')


class test_migrate_tasks(AppCase):

    def test_migrate(self, name='testcelery'):
        x = Connection('memory://foo')
        y = Connection('memory://foo')
        # use separate state
        x.default_channel.queues = {}
        y.default_channel.queues = {}

        ex = Exchange(name, 'direct')
        q = Queue(name, exchange=ex, routing_key=name)
        q(x.default_channel).declare()
        Producer(x).publish('foo', exchange=name, routing_key=name)
        Producer(x).publish('bar', exchange=name, routing_key=name)
        Producer(x).publish('baz', exchange=name, routing_key=name)
        self.assertTrue(x.default_channel.queues)
        self.assertFalse(y.default_channel.queues)

        migrate_tasks(x, y, accept=['text/plain'], app=self.app)

        yq = q(y.default_channel)
        self.assertEqual(yq.get().body, ensure_bytes('foo'))
        self.assertEqual(yq.get().body, ensure_bytes('bar'))
        self.assertEqual(yq.get().body, ensure_bytes('baz'))

        Producer(x).publish('foo', exchange=name, routing_key=name)
        callback = Mock()
        migrate_tasks(x, y,
                      callback=callback, accept=['text/plain'], app=self.app)
        self.assertTrue(callback.called)
        migrate = Mock()
        Producer(x).publish('baz', exchange=name, routing_key=name)
        migrate_tasks(x, y, callback=callback,
                      migrate=migrate, accept=['text/plain'], app=self.app)
        self.assertTrue(migrate.called)

        with patch('kombu.transport.virtual.Channel.queue_declare') as qd:

            def effect(*args, **kwargs):
                if kwargs.get('passive'):
                    raise ChannelError('some channel error')
                return 0, 3, 0
            qd.side_effect = effect
            migrate_tasks(x, y, app=self.app)

        x = Connection('memory://')
        x.default_channel.queues = {}
        y.default_channel.queues = {}
        callback = Mock()
        migrate_tasks(x, y,
                      callback=callback, accept=['text/plain'], app=self.app)
        self.assertFalse(callback.called)
