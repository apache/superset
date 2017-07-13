from __future__ import absolute_import, print_function

import os
import socket

from collections import deque
from datetime import datetime, timedelta
from threading import Event

from amqp import ChannelError
from kombu import Connection
from kombu.common import QoS, ignore_errors
from kombu.transport.base import Message

from celery.app.defaults import DEFAULTS
from celery.bootsteps import RUN, CLOSE, StartStopStep
from celery.concurrency.base import BasePool
from celery.datastructures import AttributeDict
from celery.exceptions import (
    WorkerShutdown, WorkerTerminate, TaskRevokedError,
)
from celery.five import Empty, range, Queue as FastQueue
from celery.utils import uuid
from celery.worker import components
from celery.worker import consumer
from celery.worker.consumer import Consumer as __Consumer
from celery.worker.job import Request
from celery.utils import worker_direct
from celery.utils.serialization import pickle
from celery.utils.timer2 import Timer

from celery.tests.case import AppCase, Mock, SkipTest, patch, restore_logging


def MockStep(step=None):
    step = Mock() if step is None else step
    step.blueprint = Mock()
    step.blueprint.name = 'MockNS'
    step.name = 'MockStep(%s)' % (id(step), )
    return step


def mock_event_dispatcher():
    evd = Mock(name='event_dispatcher')
    evd.groups = ['worker']
    evd._outbound_buffer = deque()
    return evd


class PlaceHolder(object):
        pass


def find_step(obj, typ):
    return obj.blueprint.steps[typ.name]


class Consumer(__Consumer):

    def __init__(self, *args, **kwargs):
        kwargs.setdefault('without_mingle', True)  # disable Mingle step
        kwargs.setdefault('without_gossip', True)  # disable Gossip step
        kwargs.setdefault('without_heartbeat', True)  # disable Heart step
        super(Consumer, self).__init__(*args, **kwargs)


class _MyKombuConsumer(Consumer):
    broadcast_consumer = Mock()
    task_consumer = Mock()

    def __init__(self, *args, **kwargs):
        kwargs.setdefault('pool', BasePool(2))
        super(_MyKombuConsumer, self).__init__(*args, **kwargs)

    def restart_heartbeat(self):
        self.heart = None


class MyKombuConsumer(Consumer):

    def loop(self, *args, **kwargs):
        pass


class MockNode(object):
    commands = []

    def handle_message(self, body, message):
        self.commands.append(body.pop('command', None))


class MockEventDispatcher(object):
    sent = []
    closed = False
    flushed = False
    _outbound_buffer = []

    def send(self, event, *args, **kwargs):
        self.sent.append(event)

    def close(self):
        self.closed = True

    def flush(self):
        self.flushed = True


class MockHeart(object):
    closed = False

    def stop(self):
        self.closed = True


def create_message(channel, **data):
    data.setdefault('id', uuid())
    channel.no_ack_consumers = set()
    m = Message(channel, body=pickle.dumps(dict(**data)),
                content_type='application/x-python-serialize',
                content_encoding='binary',
                delivery_info={'consumer_tag': 'mock'})
    m.accept = ['application/x-python-serialize']
    return m


class test_Consumer(AppCase):

    def setup(self):
        self.buffer = FastQueue()
        self.timer = Timer()

        @self.app.task(shared=False)
        def foo_task(x, y, z):
            return x * y * z
        self.foo_task = foo_task

    def teardown(self):
        self.timer.stop()

    def test_info(self):
        l = MyKombuConsumer(self.buffer.put, timer=self.timer, app=self.app)
        l.task_consumer = Mock()
        l.qos = QoS(l.task_consumer.qos, 10)
        l.connection = Mock()
        l.connection.info.return_value = {'foo': 'bar'}
        l.controller = l.app.WorkController()
        l.controller.pool = Mock()
        l.controller.pool.info.return_value = [Mock(), Mock()]
        l.controller.consumer = l
        info = l.controller.stats()
        self.assertEqual(info['prefetch_count'], 10)
        self.assertTrue(info['broker'])

    def test_start_when_closed(self):
        l = MyKombuConsumer(self.buffer.put, timer=self.timer, app=self.app)
        l.blueprint.state = CLOSE
        l.start()

    def test_connection(self):
        l = MyKombuConsumer(self.buffer.put, timer=self.timer, app=self.app)

        l.blueprint.start(l)
        self.assertIsInstance(l.connection, Connection)

        l.blueprint.state = RUN
        l.event_dispatcher = None
        l.blueprint.restart(l)
        self.assertTrue(l.connection)

        l.blueprint.state = RUN
        l.shutdown()
        self.assertIsNone(l.connection)
        self.assertIsNone(l.task_consumer)

        l.blueprint.start(l)
        self.assertIsInstance(l.connection, Connection)
        l.blueprint.restart(l)

        l.stop()
        l.shutdown()
        self.assertIsNone(l.connection)
        self.assertIsNone(l.task_consumer)

    def test_close_connection(self):
        l = MyKombuConsumer(self.buffer.put, timer=self.timer, app=self.app)
        l.blueprint.state = RUN
        step = find_step(l, consumer.Connection)
        conn = l.connection = Mock()
        step.shutdown(l)
        self.assertTrue(conn.close.called)
        self.assertIsNone(l.connection)

        l = MyKombuConsumer(self.buffer.put, timer=self.timer, app=self.app)
        eventer = l.event_dispatcher = mock_event_dispatcher()
        eventer.enabled = True
        heart = l.heart = MockHeart()
        l.blueprint.state = RUN
        Events = find_step(l, consumer.Events)
        Events.shutdown(l)
        Heart = find_step(l, consumer.Heart)
        Heart.shutdown(l)
        self.assertTrue(eventer.close.call_count)
        self.assertTrue(heart.closed)

    @patch('celery.worker.consumer.warn')
    def test_receive_message_unknown(self, warn):
        l = _MyKombuConsumer(self.buffer.put, timer=self.timer, app=self.app)
        l.blueprint.state = RUN
        l.steps.pop()
        backend = Mock()
        m = create_message(backend, unknown={'baz': '!!!'})
        l.event_dispatcher = mock_event_dispatcher()
        l.node = MockNode()

        callback = self._get_on_message(l)
        callback(m.decode(), m)
        self.assertTrue(warn.call_count)

    @patch('celery.worker.strategy.to_timestamp')
    def test_receive_message_eta_OverflowError(self, to_timestamp):
        to_timestamp.side_effect = OverflowError()
        l = _MyKombuConsumer(self.buffer.put, timer=self.timer, app=self.app)
        l.blueprint.state = RUN
        l.steps.pop()
        m = create_message(Mock(), task=self.foo_task.name,
                           args=('2, 2'),
                           kwargs={},
                           eta=datetime.now().isoformat())
        l.event_dispatcher = mock_event_dispatcher()
        l.node = MockNode()
        l.update_strategies()
        l.qos = Mock()

        callback = self._get_on_message(l)
        callback(m.decode(), m)
        self.assertTrue(m.acknowledged)

    @patch('celery.worker.consumer.error')
    def test_receive_message_InvalidTaskError(self, error):
        l = _MyKombuConsumer(self.buffer.put, timer=self.timer, app=self.app)
        l.blueprint.state = RUN
        l.event_dispatcher = mock_event_dispatcher()
        l.steps.pop()
        m = create_message(Mock(), task=self.foo_task.name,
                           args=(1, 2), kwargs='foobarbaz', id=1)
        l.update_strategies()
        l.event_dispatcher = mock_event_dispatcher()

        callback = self._get_on_message(l)
        callback(m.decode(), m)
        self.assertIn('Received invalid task message', error.call_args[0][0])

    @patch('celery.worker.consumer.crit')
    def test_on_decode_error(self, crit):
        l = Consumer(self.buffer.put, timer=self.timer, app=self.app)

        class MockMessage(Mock):
            content_type = 'application/x-msgpack'
            content_encoding = 'binary'
            body = 'foobarbaz'

        message = MockMessage()
        l.on_decode_error(message, KeyError('foo'))
        self.assertTrue(message.ack.call_count)
        self.assertIn("Can't decode message body", crit.call_args[0][0])

    def _get_on_message(self, l):
        if l.qos is None:
            l.qos = Mock()
        l.event_dispatcher = mock_event_dispatcher()
        l.task_consumer = Mock()
        l.connection = Mock()
        l.connection.drain_events.side_effect = WorkerShutdown()

        with self.assertRaises(WorkerShutdown):
            l.loop(*l.loop_args())
        self.assertTrue(l.task_consumer.register_callback.called)
        return l.task_consumer.register_callback.call_args[0][0]

    def test_receieve_message(self):
        l = Consumer(self.buffer.put, timer=self.timer, app=self.app)
        l.blueprint.state = RUN
        l.event_dispatcher = mock_event_dispatcher()
        m = create_message(Mock(), task=self.foo_task.name,
                           args=[2, 4, 8], kwargs={})
        l.update_strategies()
        callback = self._get_on_message(l)
        callback(m.decode(), m)

        in_bucket = self.buffer.get_nowait()
        self.assertIsInstance(in_bucket, Request)
        self.assertEqual(in_bucket.name, self.foo_task.name)
        self.assertEqual(in_bucket.execute(), 2 * 4 * 8)
        self.assertTrue(self.timer.empty())

    def test_start_channel_error(self):

        class MockConsumer(Consumer):
            iterations = 0

            def loop(self, *args, **kwargs):
                if not self.iterations:
                    self.iterations = 1
                    raise KeyError('foo')
                raise SyntaxError('bar')

        l = MockConsumer(self.buffer.put, timer=self.timer,
                         send_events=False, pool=BasePool(), app=self.app)
        l.channel_errors = (KeyError, )
        with self.assertRaises(KeyError):
            l.start()
        l.timer.stop()

    def test_start_connection_error(self):

        class MockConsumer(Consumer):
            iterations = 0

            def loop(self, *args, **kwargs):
                if not self.iterations:
                    self.iterations = 1
                    raise KeyError('foo')
                raise SyntaxError('bar')

        l = MockConsumer(self.buffer.put, timer=self.timer,
                         send_events=False, pool=BasePool(), app=self.app)

        l.connection_errors = (KeyError, )
        self.assertRaises(SyntaxError, l.start)
        l.timer.stop()

    def test_loop_ignores_socket_timeout(self):

        class Connection(self.app.connection().__class__):
            obj = None

            def drain_events(self, **kwargs):
                self.obj.connection = None
                raise socket.timeout(10)

        l = MyKombuConsumer(self.buffer.put, timer=self.timer, app=self.app)
        l.connection = Connection()
        l.task_consumer = Mock()
        l.connection.obj = l
        l.qos = QoS(l.task_consumer.qos, 10)
        l.loop(*l.loop_args())

    def test_loop_when_socket_error(self):

        class Connection(self.app.connection().__class__):
            obj = None

            def drain_events(self, **kwargs):
                self.obj.connection = None
                raise socket.error('foo')

        l = Consumer(self.buffer.put, timer=self.timer, app=self.app)
        l.blueprint.state = RUN
        c = l.connection = Connection()
        l.connection.obj = l
        l.task_consumer = Mock()
        l.qos = QoS(l.task_consumer.qos, 10)
        with self.assertRaises(socket.error):
            l.loop(*l.loop_args())

        l.blueprint.state = CLOSE
        l.connection = c
        l.loop(*l.loop_args())

    def test_loop(self):

        class Connection(self.app.connection().__class__):
            obj = None

            def drain_events(self, **kwargs):
                self.obj.connection = None

        l = Consumer(self.buffer.put, timer=self.timer, app=self.app)
        l.blueprint.state = RUN
        l.connection = Connection()
        l.connection.obj = l
        l.task_consumer = Mock()
        l.qos = QoS(l.task_consumer.qos, 10)

        l.loop(*l.loop_args())
        l.loop(*l.loop_args())
        self.assertTrue(l.task_consumer.consume.call_count)
        l.task_consumer.qos.assert_called_with(prefetch_count=10)
        self.assertEqual(l.qos.value, 10)
        l.qos.decrement_eventually()
        self.assertEqual(l.qos.value, 9)
        l.qos.update()
        self.assertEqual(l.qos.value, 9)
        l.task_consumer.qos.assert_called_with(prefetch_count=9)

    def test_ignore_errors(self):
        l = MyKombuConsumer(self.buffer.put, timer=self.timer, app=self.app)
        l.connection_errors = (AttributeError, KeyError, )
        l.channel_errors = (SyntaxError, )
        ignore_errors(l, Mock(side_effect=AttributeError('foo')))
        ignore_errors(l, Mock(side_effect=KeyError('foo')))
        ignore_errors(l, Mock(side_effect=SyntaxError('foo')))
        with self.assertRaises(IndexError):
            ignore_errors(l, Mock(side_effect=IndexError('foo')))

    def test_apply_eta_task(self):
        from celery.worker import state
        l = MyKombuConsumer(self.buffer.put, timer=self.timer, app=self.app)
        l.qos = QoS(None, 10)

        task = object()
        qos = l.qos.value
        l.apply_eta_task(task)
        self.assertIn(task, state.reserved_requests)
        self.assertEqual(l.qos.value, qos - 1)
        self.assertIs(self.buffer.get_nowait(), task)

    def test_receieve_message_eta_isoformat(self):
        l = _MyKombuConsumer(self.buffer.put, timer=self.timer, app=self.app)
        l.blueprint.state = RUN
        l.steps.pop()
        m = create_message(
            Mock(), task=self.foo_task.name,
            eta=(datetime.now() + timedelta(days=1)).isoformat(),
            args=[2, 4, 8], kwargs={},
        )

        l.task_consumer = Mock()
        l.qos = QoS(l.task_consumer.qos, 1)
        current_pcount = l.qos.value
        l.event_dispatcher = mock_event_dispatcher()
        l.enabled = False
        l.update_strategies()
        callback = self._get_on_message(l)
        callback(m.decode(), m)
        l.timer.stop()
        l.timer.join(1)

        items = [entry[2] for entry in self.timer.queue]
        found = 0
        for item in items:
            if item.args[0].name == self.foo_task.name:
                found = True
        self.assertTrue(found)
        self.assertGreater(l.qos.value, current_pcount)
        l.timer.stop()

    def test_pidbox_callback(self):
        l = MyKombuConsumer(self.buffer.put, timer=self.timer, app=self.app)
        con = find_step(l, consumer.Control).box
        con.node = Mock()
        con.reset = Mock()

        con.on_message('foo', 'bar')
        con.node.handle_message.assert_called_with('foo', 'bar')

        con.node = Mock()
        con.node.handle_message.side_effect = KeyError('foo')
        con.on_message('foo', 'bar')
        con.node.handle_message.assert_called_with('foo', 'bar')

        con.node = Mock()
        con.node.handle_message.side_effect = ValueError('foo')
        con.on_message('foo', 'bar')
        con.node.handle_message.assert_called_with('foo', 'bar')
        self.assertTrue(con.reset.called)

    def test_revoke(self):
        l = _MyKombuConsumer(self.buffer.put, timer=self.timer, app=self.app)
        l.blueprint.state = RUN
        l.steps.pop()
        backend = Mock()
        id = uuid()
        t = create_message(backend, task=self.foo_task.name, args=[2, 4, 8],
                           kwargs={}, id=id)
        from celery.worker.state import revoked
        revoked.add(id)

        callback = self._get_on_message(l)
        callback(t.decode(), t)
        self.assertTrue(self.buffer.empty())

    def test_receieve_message_not_registered(self):
        l = _MyKombuConsumer(self.buffer.put, timer=self.timer, app=self.app)
        l.blueprint.state = RUN
        l.steps.pop()
        backend = Mock()
        m = create_message(backend, task='x.X.31x', args=[2, 4, 8], kwargs={})

        l.event_dispatcher = mock_event_dispatcher()
        callback = self._get_on_message(l)
        self.assertFalse(callback(m.decode(), m))
        with self.assertRaises(Empty):
            self.buffer.get_nowait()
        self.assertTrue(self.timer.empty())

    @patch('celery.worker.consumer.warn')
    @patch('celery.worker.consumer.logger')
    def test_receieve_message_ack_raises(self, logger, warn):
        l = Consumer(self.buffer.put, timer=self.timer, app=self.app)
        l.blueprint.state = RUN
        backend = Mock()
        m = create_message(backend, args=[2, 4, 8], kwargs={})

        l.event_dispatcher = mock_event_dispatcher()
        l.connection_errors = (socket.error, )
        m.reject = Mock()
        m.reject.side_effect = socket.error('foo')
        callback = self._get_on_message(l)
        self.assertFalse(callback(m.decode(), m))
        self.assertTrue(warn.call_count)
        with self.assertRaises(Empty):
            self.buffer.get_nowait()
        self.assertTrue(self.timer.empty())
        m.reject.assert_called_with(requeue=False)
        self.assertTrue(logger.critical.call_count)

    def test_receive_message_eta(self):
        import sys
        from functools import partial
        if os.environ.get('C_DEBUG_TEST'):
            pp = partial(print, file=sys.__stderr__)
        else:
            def pp(*args, **kwargs):
                pass
        pp('TEST RECEIVE MESSAGE ETA')
        pp('+CREATE MYKOMBUCONSUMER')
        l = _MyKombuConsumer(self.buffer.put, timer=self.timer, app=self.app)
        pp('-CREATE MYKOMBUCONSUMER')
        l.steps.pop()
        l.event_dispatcher = mock_event_dispatcher()
        backend = Mock()
        pp('+ CREATE MESSAGE')
        m = create_message(
            backend, task=self.foo_task.name,
            args=[2, 4, 8], kwargs={},
            eta=(datetime.now() + timedelta(days=1)).isoformat(),
        )
        pp('- CREATE MESSAGE')

        try:
            pp('+ BLUEPRINT START 1')
            l.blueprint.start(l)
            pp('- BLUEPRINT START 1')
            p = l.app.conf.BROKER_CONNECTION_RETRY
            l.app.conf.BROKER_CONNECTION_RETRY = False
            pp('+ BLUEPRINT START 2')
            l.blueprint.start(l)
            pp('- BLUEPRINT START 2')
            l.app.conf.BROKER_CONNECTION_RETRY = p
            pp('+ BLUEPRINT RESTART')
            l.blueprint.restart(l)
            pp('- BLUEPRINT RESTART')
            l.event_dispatcher = mock_event_dispatcher()
            pp('+ GET ON MESSAGE')
            callback = self._get_on_message(l)
            pp('- GET ON MESSAGE')
            pp('+ CALLBACK')
            callback(m.decode(), m)
            pp('- CALLBACK')
        finally:
            pp('+ STOP TIMER')
            l.timer.stop()
            pp('- STOP TIMER')
            try:
                pp('+ JOIN TIMER')
                l.timer.join()
                pp('- JOIN TIMER')
            except RuntimeError:
                pass

        in_hold = l.timer.queue[0]
        self.assertEqual(len(in_hold), 3)
        eta, priority, entry = in_hold
        task = entry.args[0]
        self.assertIsInstance(task, Request)
        self.assertEqual(task.name, self.foo_task.name)
        self.assertEqual(task.execute(), 2 * 4 * 8)
        with self.assertRaises(Empty):
            self.buffer.get_nowait()

    def test_reset_pidbox_node(self):
        l = MyKombuConsumer(self.buffer.put, timer=self.timer, app=self.app)
        con = find_step(l, consumer.Control).box
        con.node = Mock()
        chan = con.node.channel = Mock()
        l.connection = Mock()
        chan.close.side_effect = socket.error('foo')
        l.connection_errors = (socket.error, )
        con.reset()
        chan.close.assert_called_with()

    def test_reset_pidbox_node_green(self):
        from celery.worker.pidbox import gPidbox
        pool = Mock()
        pool.is_green = True
        l = MyKombuConsumer(self.buffer.put, timer=self.timer, pool=pool,
                            app=self.app)
        con = find_step(l, consumer.Control)
        self.assertIsInstance(con.box, gPidbox)
        con.start(l)
        l.pool.spawn_n.assert_called_with(
            con.box.loop, l,
        )

    def test__green_pidbox_node(self):
        pool = Mock()
        pool.is_green = True
        l = MyKombuConsumer(self.buffer.put, timer=self.timer, pool=pool,
                            app=self.app)
        l.node = Mock()
        controller = find_step(l, consumer.Control)

        class BConsumer(Mock):

            def __enter__(self):
                self.consume()
                return self

            def __exit__(self, *exc_info):
                self.cancel()

        controller.box.node.listen = BConsumer()
        connections = []

        class Connection(object):
            calls = 0

            def __init__(self, obj):
                connections.append(self)
                self.obj = obj
                self.default_channel = self.channel()
                self.closed = False

            def __enter__(self):
                return self

            def __exit__(self, *exc_info):
                self.close()

            def channel(self):
                return Mock()

            def as_uri(self):
                return 'dummy://'

            def drain_events(self, **kwargs):
                if not self.calls:
                    self.calls += 1
                    raise socket.timeout()
                self.obj.connection = None
                controller.box._node_shutdown.set()

            def close(self):
                self.closed = True

        l.connection = Mock()
        l.connect = lambda: Connection(obj=l)
        controller = find_step(l, consumer.Control)
        controller.box.loop(l)

        self.assertTrue(controller.box.node.listen.called)
        self.assertTrue(controller.box.consumer)
        controller.box.consumer.consume.assert_called_with()

        self.assertIsNone(l.connection)
        self.assertTrue(connections[0].closed)

    @patch('kombu.connection.Connection._establish_connection')
    @patch('kombu.utils.sleep')
    def test_connect_errback(self, sleep, connect):
        l = MyKombuConsumer(self.buffer.put, timer=self.timer, app=self.app)
        from kombu.transport.memory import Transport
        Transport.connection_errors = (ChannelError, )

        def effect():
            if connect.call_count > 1:
                return
            raise ChannelError('error')
        connect.side_effect = effect
        l.connect()
        connect.assert_called_with()

    def test_stop_pidbox_node(self):
        l = MyKombuConsumer(self.buffer.put, timer=self.timer, app=self.app)
        cont = find_step(l, consumer.Control)
        cont._node_stopped = Event()
        cont._node_shutdown = Event()
        cont._node_stopped.set()
        cont.stop(l)

    def test_start__loop(self):

        class _QoS(object):
            prev = 3
            value = 4

            def update(self):
                self.prev = self.value

        class _Consumer(MyKombuConsumer):
            iterations = 0

            def reset_connection(self):
                if self.iterations >= 1:
                    raise KeyError('foo')

        init_callback = Mock()
        l = _Consumer(self.buffer.put, timer=self.timer,
                      init_callback=init_callback, app=self.app)
        l.task_consumer = Mock()
        l.broadcast_consumer = Mock()
        l.qos = _QoS()
        l.connection = Connection()
        l.iterations = 0

        def raises_KeyError(*args, **kwargs):
            l.iterations += 1
            if l.qos.prev != l.qos.value:
                l.qos.update()
            if l.iterations >= 2:
                raise KeyError('foo')

        l.loop = raises_KeyError
        with self.assertRaises(KeyError):
            l.start()
        self.assertEqual(l.iterations, 2)
        self.assertEqual(l.qos.prev, l.qos.value)

        init_callback.reset_mock()
        l = _Consumer(self.buffer.put, timer=self.timer, app=self.app,
                      send_events=False, init_callback=init_callback)
        l.qos = _QoS()
        l.task_consumer = Mock()
        l.broadcast_consumer = Mock()
        l.connection = Connection()
        l.loop = Mock(side_effect=socket.error('foo'))
        with self.assertRaises(socket.error):
            l.start()
        self.assertTrue(l.loop.call_count)

    def test_reset_connection_with_no_node(self):
        l = Consumer(self.buffer.put, timer=self.timer, app=self.app)
        l.steps.pop()
        self.assertEqual(None, l.pool)
        l.blueprint.start(l)


class test_WorkController(AppCase):

    def setup(self):
        self.worker = self.create_worker()
        from celery import worker
        self._logger = worker.logger
        self._comp_logger = components.logger
        self.logger = worker.logger = Mock()
        self.comp_logger = components.logger = Mock()

        @self.app.task(shared=False)
        def foo_task(x, y, z):
            return x * y * z
        self.foo_task = foo_task

    def teardown(self):
        from celery import worker
        worker.logger = self._logger
        components.logger = self._comp_logger

    def create_worker(self, **kw):
        worker = self.app.WorkController(concurrency=1, loglevel=0, **kw)
        worker.blueprint.shutdown_complete.set()
        return worker

    def test_on_consumer_ready(self):
        self.worker.on_consumer_ready(Mock())

    def test_setup_queues_worker_direct(self):
        self.app.conf.CELERY_WORKER_DIRECT = True
        self.app.amqp.__dict__['queues'] = Mock()
        self.worker.setup_queues({})
        self.app.amqp.queues.select_add.assert_called_with(
            worker_direct(self.worker.hostname),
        )

    def test_send_worker_shutdown(self):
        with patch('celery.signals.worker_shutdown') as ws:
            self.worker._send_worker_shutdown()
            ws.send.assert_called_with(sender=self.worker)

    def test_process_shutdown_on_worker_shutdown(self):
        raise SkipTest('unstable test')
        from celery.concurrency.prefork import process_destructor
        from celery.concurrency.asynpool import Worker
        with patch('celery.signals.worker_process_shutdown') as ws:
            Worker._make_shortcuts = Mock()
            with patch('os._exit') as _exit:
                worker = Worker(None, None, on_exit=process_destructor)
                worker._do_exit(22, 3.1415926)
                ws.send.assert_called_with(
                    sender=None, pid=22, exitcode=3.1415926,
                )
                _exit.assert_called_with(3.1415926)

    def test_process_task_revoked_release_semaphore(self):
        self.worker._quick_release = Mock()
        req = Mock()
        req.execute_using_pool.side_effect = TaskRevokedError
        self.worker._process_task(req)
        self.worker._quick_release.assert_called_with()

        delattr(self.worker, '_quick_release')
        self.worker._process_task(req)

    def test_shutdown_no_blueprint(self):
        self.worker.blueprint = None
        self.worker._shutdown()

    @patch('celery.platforms.create_pidlock')
    def test_use_pidfile(self, create_pidlock):
        create_pidlock.return_value = Mock()
        worker = self.create_worker(pidfile='pidfilelockfilepid')
        worker.steps = []
        worker.start()
        self.assertTrue(create_pidlock.called)
        worker.stop()
        self.assertTrue(worker.pidlock.release.called)

    @patch('celery.platforms.signals')
    @patch('celery.platforms.set_mp_process_title')
    def test_process_initializer(self, set_mp_process_title, _signals):
        with restore_logging():
            from celery import signals
            from celery._state import _tls
            from celery.concurrency.prefork import (
                process_initializer, WORKER_SIGRESET, WORKER_SIGIGNORE,
            )

            def on_worker_process_init(**kwargs):
                on_worker_process_init.called = True
            on_worker_process_init.called = False
            signals.worker_process_init.connect(on_worker_process_init)

            def Loader(*args, **kwargs):
                loader = Mock(*args, **kwargs)
                loader.conf = {}
                loader.override_backends = {}
                return loader

            with self.Celery(loader=Loader) as app:
                app.conf = AttributeDict(DEFAULTS)
                process_initializer(app, 'awesome.worker.com')
                _signals.ignore.assert_any_call(*WORKER_SIGIGNORE)
                _signals.reset.assert_any_call(*WORKER_SIGRESET)
                self.assertTrue(app.loader.init_worker.call_count)
                self.assertTrue(on_worker_process_init.called)
                self.assertIs(_tls.current_app, app)
                set_mp_process_title.assert_called_with(
                    'celeryd', hostname='awesome.worker.com',
                )

                with patch('celery.app.trace.setup_worker_optimizations') as S:
                    os.environ['FORKED_BY_MULTIPROCESSING'] = "1"
                    try:
                        process_initializer(app, 'luke.worker.com')
                        S.assert_called_with(app)
                    finally:
                        os.environ.pop('FORKED_BY_MULTIPROCESSING', None)

    def test_attrs(self):
        worker = self.worker
        self.assertIsNotNone(worker.timer)
        self.assertIsInstance(worker.timer, Timer)
        self.assertIsNotNone(worker.pool)
        self.assertIsNotNone(worker.consumer)
        self.assertTrue(worker.steps)

    def test_with_embedded_beat(self):
        worker = self.app.WorkController(concurrency=1, loglevel=0, beat=True)
        self.assertTrue(worker.beat)
        self.assertIn(worker.beat, [w.obj for w in worker.steps])

    def test_with_autoscaler(self):
        worker = self.create_worker(
            autoscale=[10, 3], send_events=False,
            timer_cls='celery.utils.timer2.Timer',
        )
        self.assertTrue(worker.autoscaler)

    def test_dont_stop_or_terminate(self):
        worker = self.app.WorkController(concurrency=1, loglevel=0)
        worker.stop()
        self.assertNotEqual(worker.blueprint.state, CLOSE)
        worker.terminate()
        self.assertNotEqual(worker.blueprint.state, CLOSE)

        sigsafe, worker.pool.signal_safe = worker.pool.signal_safe, False
        try:
            worker.blueprint.state = RUN
            worker.stop(in_sighandler=True)
            self.assertNotEqual(worker.blueprint.state, CLOSE)
            worker.terminate(in_sighandler=True)
            self.assertNotEqual(worker.blueprint.state, CLOSE)
        finally:
            worker.pool.signal_safe = sigsafe

    def test_on_timer_error(self):
        worker = self.app.WorkController(concurrency=1, loglevel=0)

        try:
            raise KeyError('foo')
        except KeyError as exc:
            components.Timer(worker).on_timer_error(exc)
            msg, args = self.comp_logger.error.call_args[0]
            self.assertIn('KeyError', msg % args)

    def test_on_timer_tick(self):
        worker = self.app.WorkController(concurrency=1, loglevel=10)

        components.Timer(worker).on_timer_tick(30.0)
        xargs = self.comp_logger.debug.call_args[0]
        fmt, arg = xargs[0], xargs[1]
        self.assertEqual(30.0, arg)
        self.assertIn('Next eta %s secs', fmt)

    def test_process_task(self):
        worker = self.worker
        worker.pool = Mock()
        backend = Mock()
        m = create_message(backend, task=self.foo_task.name, args=[4, 8, 10],
                           kwargs={})
        task = Request(m.decode(), message=m, app=self.app)
        worker._process_task(task)
        self.assertEqual(worker.pool.apply_async.call_count, 1)
        worker.pool.stop()

    def test_process_task_raise_base(self):
        worker = self.worker
        worker.pool = Mock()
        worker.pool.apply_async.side_effect = KeyboardInterrupt('Ctrl+C')
        backend = Mock()
        m = create_message(backend, task=self.foo_task.name, args=[4, 8, 10],
                           kwargs={})
        task = Request(m.decode(), message=m, app=self.app)
        worker.steps = []
        worker.blueprint.state = RUN
        with self.assertRaises(KeyboardInterrupt):
            worker._process_task(task)

    def test_process_task_raise_WorkerTerminate(self):
        worker = self.worker
        worker.pool = Mock()
        worker.pool.apply_async.side_effect = WorkerTerminate()
        backend = Mock()
        m = create_message(backend, task=self.foo_task.name, args=[4, 8, 10],
                           kwargs={})
        task = Request(m.decode(), message=m, app=self.app)
        worker.steps = []
        worker.blueprint.state = RUN
        with self.assertRaises(SystemExit):
            worker._process_task(task)

    def test_process_task_raise_regular(self):
        worker = self.worker
        worker.pool = Mock()
        worker.pool.apply_async.side_effect = KeyError('some exception')
        backend = Mock()
        m = create_message(backend, task=self.foo_task.name, args=[4, 8, 10],
                           kwargs={})
        task = Request(m.decode(), message=m, app=self.app)
        worker._process_task(task)
        worker.pool.stop()

    def test_start_catches_base_exceptions(self):
        worker1 = self.create_worker()
        worker1.blueprint.state = RUN
        stc = MockStep()
        stc.start.side_effect = WorkerTerminate()
        worker1.steps = [stc]
        worker1.start()
        stc.start.assert_called_with(worker1)
        self.assertTrue(stc.terminate.call_count)

        worker2 = self.create_worker()
        worker2.blueprint.state = RUN
        sec = MockStep()
        sec.start.side_effect = WorkerShutdown()
        sec.terminate = None
        worker2.steps = [sec]
        worker2.start()
        self.assertTrue(sec.stop.call_count)

    def test_state_db(self):
        from celery.worker import state
        Persistent = state.Persistent

        state.Persistent = Mock()
        try:
            worker = self.create_worker(state_db='statefilename')
            self.assertTrue(worker._persistence)
        finally:
            state.Persistent = Persistent

    def test_process_task_sem(self):
        worker = self.worker
        worker._quick_acquire = Mock()

        req = Mock()
        worker._process_task_sem(req)
        worker._quick_acquire.assert_called_with(worker._process_task, req)

    def test_signal_consumer_close(self):
        worker = self.worker
        worker.consumer = Mock()

        worker.signal_consumer_close()
        worker.consumer.close.assert_called_with()

        worker.consumer.close.side_effect = AttributeError()
        worker.signal_consumer_close()

    def test_start__stop(self):
        worker = self.worker
        worker.blueprint.shutdown_complete.set()
        worker.steps = [MockStep(StartStopStep(self)) for _ in range(4)]
        worker.blueprint.state = RUN
        worker.blueprint.started = 4
        for w in worker.steps:
            w.start = Mock()
            w.close = Mock()
            w.stop = Mock()

        worker.start()
        for w in worker.steps:
            self.assertTrue(w.start.call_count)
        worker.consumer = Mock()
        worker.stop()
        for stopstep in worker.steps:
            self.assertTrue(stopstep.close.call_count)
            self.assertTrue(stopstep.stop.call_count)

        # Doesn't close pool if no pool.
        worker.start()
        worker.pool = None
        worker.stop()

        # test that stop of None is not attempted
        worker.steps[-1] = None
        worker.start()
        worker.stop()

    def test_step_raises(self):
        worker = self.worker
        step = Mock()
        worker.steps = [step]
        step.start.side_effect = TypeError()
        worker.stop = Mock()
        worker.start()
        worker.stop.assert_called_with()

    def test_state(self):
        self.assertTrue(self.worker.state)

    def test_start__terminate(self):
        worker = self.worker
        worker.blueprint.shutdown_complete.set()
        worker.blueprint.started = 5
        worker.blueprint.state = RUN
        worker.steps = [MockStep() for _ in range(5)]
        worker.start()
        for w in worker.steps[:3]:
            self.assertTrue(w.start.call_count)
        self.assertTrue(worker.blueprint.started, len(worker.steps))
        self.assertEqual(worker.blueprint.state, RUN)
        worker.terminate()
        for step in worker.steps:
            self.assertTrue(step.terminate.call_count)

    def test_Queues_pool_no_sem(self):
        w = Mock()
        w.pool_cls.uses_semaphore = False
        components.Queues(w).create(w)
        self.assertIs(w.process_task, w._process_task)

    def test_Hub_crate(self):
        w = Mock()
        x = components.Hub(w)
        x.create(w)
        self.assertTrue(w.timer.max_interval)

    def test_Pool_crate_threaded(self):
        w = Mock()
        w._conninfo.connection_errors = w._conninfo.channel_errors = ()
        w.pool_cls = Mock()
        w.use_eventloop = False
        pool = components.Pool(w)
        pool.create(w)

    def test_Pool_create(self):
        from kombu.async.semaphore import LaxBoundedSemaphore
        w = Mock()
        w._conninfo.connection_errors = w._conninfo.channel_errors = ()
        w.hub = Mock()

        PoolImp = Mock()
        poolimp = PoolImp.return_value = Mock()
        poolimp._pool = [Mock(), Mock()]
        poolimp._cache = {}
        poolimp._fileno_to_inq = {}
        poolimp._fileno_to_outq = {}

        from celery.concurrency.prefork import TaskPool as _TaskPool

        class MockTaskPool(_TaskPool):
            Pool = PoolImp

            @property
            def timers(self):
                return {Mock(): 30}

        w.pool_cls = MockTaskPool
        w.use_eventloop = True
        w.consumer.restart_count = -1
        pool = components.Pool(w)
        pool.create(w)
        pool.register_with_event_loop(w, w.hub)
        self.assertIsInstance(w.semaphore, LaxBoundedSemaphore)
        P = w.pool
        P.start()
