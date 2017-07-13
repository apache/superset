from __future__ import absolute_import

import socket

from kombu.async import Hub, READ, WRITE, ERR

from celery.bootsteps import CLOSE, RUN
from celery.exceptions import InvalidTaskError, WorkerShutdown, WorkerTerminate
from celery.five import Empty
from celery.worker import state
from celery.worker.consumer import Consumer
from celery.worker.loops import asynloop, synloop

from celery.tests.case import AppCase, Mock, body_from_sig


class X(object):

    def __init__(self, app, heartbeat=None, on_task_message=None,
                 transport_driver_type=None):
        hub = Hub()
        (
            self.obj,
            self.connection,
            self.consumer,
            self.blueprint,
            self.hub,
            self.qos,
            self.heartbeat,
            self.clock,
        ) = self.args = [Mock(name='obj'),
                         Mock(name='connection'),
                         Mock(name='consumer'),
                         Mock(name='blueprint'),
                         hub,
                         Mock(name='qos'),
                         heartbeat,
                         Mock(name='clock')]
        self.connection.supports_heartbeats = True
        self.connection.get_heartbeat_interval.side_effect = (
            lambda: self.heartbeat
        )
        self.consumer.callbacks = []
        self.obj.strategies = {}
        self.connection.connection_errors = (socket.error, )
        if transport_driver_type:
            self.connection.transport.driver_type = transport_driver_type
        self.hub.readers = {}
        self.hub.writers = {}
        self.hub.consolidate = set()
        self.hub.timer = Mock(name='hub.timer')
        self.hub.timer._queue = [Mock()]
        self.hub.fire_timers = Mock(name='hub.fire_timers')
        self.hub.fire_timers.return_value = 1.7
        self.hub.poller = Mock(name='hub.poller')
        self.hub.close = Mock(name='hub.close()')  # asynloop calls hub.close
        self.Hub = self.hub
        self.blueprint.state = RUN
        # need this for create_task_handler
        _consumer = Consumer(Mock(), timer=Mock(), app=app)
        _consumer.on_task_message = on_task_message or []
        self.obj.create_task_handler = _consumer.create_task_handler
        self.on_unknown_message = self.obj.on_unknown_message = Mock(
            name='on_unknown_message',
        )
        _consumer.on_unknown_message = self.on_unknown_message
        self.on_unknown_task = self.obj.on_unknown_task = Mock(
            name='on_unknown_task',
        )
        _consumer.on_unknown_task = self.on_unknown_task
        self.on_invalid_task = self.obj.on_invalid_task = Mock(
            name='on_invalid_task',
        )
        _consumer.on_invalid_task = self.on_invalid_task
        _consumer.strategies = self.obj.strategies

    def timeout_then_error(self, mock):

        def first(*args, **kwargs):
            mock.side_effect = socket.error()
            self.connection.more_to_read = False
            raise socket.timeout()
        mock.side_effect = first

    def close_then_error(self, mock=None, mod=0, exc=None):
        mock = Mock() if mock is None else mock

        def first(*args, **kwargs):
            if not mod or mock.call_count > mod:
                self.close()
                self.connection.more_to_read = False
                raise (socket.error() if exc is None else exc)
        mock.side_effect = first
        return mock

    def close(self, *args, **kwargs):
        self.blueprint.state = CLOSE

    def closer(self, mock=None, mod=0):
        mock = Mock() if mock is None else mock

        def closing(*args, **kwargs):
            if not mod or mock.call_count >= mod:
                self.close()
        mock.side_effect = closing
        return mock


def get_task_callback(*args, **kwargs):
    x = X(*args, **kwargs)
    x.blueprint.state = CLOSE
    asynloop(*x.args)
    return x, x.consumer.callbacks[0]


class test_asynloop(AppCase):

    def setup(self):

        @self.app.task(shared=False)
        def add(x, y):
            return x + y
        self.add = add

    def test_drain_after_consume(self):
        x, _ = get_task_callback(self.app, transport_driver_type='amqp')
        self.assertIn(
            x.connection.drain_events, [p.fun for p in x.hub._ready],
        )

    def test_setup_heartbeat(self):
        x = X(self.app, heartbeat=10)
        x.hub.call_repeatedly = Mock(name='x.hub.call_repeatedly()')
        x.blueprint.state = CLOSE
        asynloop(*x.args)
        x.consumer.consume.assert_called_with()
        x.obj.on_ready.assert_called_with()
        x.hub.call_repeatedly.assert_called_with(
            10 / 2.0, x.connection.heartbeat_check, 2.0,
        )

    def task_context(self, sig, **kwargs):
        x, on_task = get_task_callback(self.app, **kwargs)
        body = body_from_sig(self.app, sig)
        message = Mock()
        strategy = x.obj.strategies[sig.task] = Mock()
        return x, on_task, body, message, strategy

    def test_on_task_received(self):
        _, on_task, body, msg, strategy = self.task_context(self.add.s(2, 2))
        on_task(body, msg)
        strategy.assert_called_with(
            msg, body, msg.ack_log_error, msg.reject_log_error, [],
        )

    def test_on_task_received_executes_on_task_message(self):
        cbs = [Mock(), Mock(), Mock()]
        _, on_task, body, msg, strategy = self.task_context(
            self.add.s(2, 2), on_task_message=cbs,
        )
        on_task(body, msg)
        strategy.assert_called_with(
            msg, body, msg.ack_log_error, msg.reject_log_error, cbs,
        )

    def test_on_task_message_missing_name(self):
        x, on_task, body, msg, strategy = self.task_context(self.add.s(2, 2))
        body.pop('task')
        on_task(body, msg)
        x.on_unknown_message.assert_called_with(body, msg)

    def test_on_task_not_registered(self):
        x, on_task, body, msg, strategy = self.task_context(self.add.s(2, 2))
        exc = strategy.side_effect = KeyError(self.add.name)
        on_task(body, msg)
        x.on_unknown_task.assert_called_with(body, msg, exc)

    def test_on_task_InvalidTaskError(self):
        x, on_task, body, msg, strategy = self.task_context(self.add.s(2, 2))
        exc = strategy.side_effect = InvalidTaskError()
        on_task(body, msg)
        x.on_invalid_task.assert_called_with(body, msg, exc)

    def test_should_terminate(self):
        x = X(self.app)
        # XXX why aren't the errors propagated?!?
        state.should_terminate = True
        try:
            with self.assertRaises(WorkerTerminate):
                asynloop(*x.args)
        finally:
            state.should_terminate = False

    def test_should_terminate_hub_close_raises(self):
        x = X(self.app)
        # XXX why aren't the errors propagated?!?
        state.should_terminate = True
        x.hub.close.side_effect = MemoryError()
        try:
            with self.assertRaises(WorkerTerminate):
                asynloop(*x.args)
        finally:
            state.should_terminate = False

    def test_should_stop(self):
        x = X(self.app)
        state.should_stop = True
        try:
            with self.assertRaises(WorkerShutdown):
                asynloop(*x.args)
        finally:
            state.should_stop = False

    def test_updates_qos(self):
        x = X(self.app)
        x.qos.prev = 3
        x.qos.value = 3
        x.hub.on_tick.add(x.closer(mod=2))
        x.hub.timer._queue = [1]
        asynloop(*x.args)
        self.assertFalse(x.qos.update.called)

        x = X(self.app)
        x.qos.prev = 1
        x.qos.value = 6
        x.hub.on_tick.add(x.closer(mod=2))
        asynloop(*x.args)
        x.qos.update.assert_called_with()
        x.hub.fire_timers.assert_called_with(propagate=(socket.error, ))

    def test_poll_empty(self):
        x = X(self.app)
        x.hub.readers = {6: Mock()}
        x.hub.timer._queue = [1]
        x.close_then_error(x.hub.poller.poll)
        x.hub.fire_timers.return_value = 33.37
        poller = x.hub.poller
        poller.poll.return_value = []
        with self.assertRaises(socket.error):
            asynloop(*x.args)
        poller.poll.assert_called_with(33.37)

    def test_poll_readable(self):
        x = X(self.app)
        reader = Mock(name='reader')
        x.hub.add_reader(6, reader, 6)
        x.hub.on_tick.add(x.close_then_error(Mock(name='tick'), mod=4))
        poller = x.hub.poller
        poller.poll.return_value = [(6, READ)]
        with self.assertRaises(socket.error):
            asynloop(*x.args)
        reader.assert_called_with(6)
        self.assertTrue(poller.poll.called)

    def test_poll_readable_raises_Empty(self):
        x = X(self.app)
        reader = Mock(name='reader')
        x.hub.add_reader(6, reader, 6)
        x.hub.on_tick.add(x.close_then_error(Mock(name='tick'), 2))
        poller = x.hub.poller
        poller.poll.return_value = [(6, READ)]
        reader.side_effect = Empty()
        with self.assertRaises(socket.error):
            asynloop(*x.args)
        reader.assert_called_with(6)
        self.assertTrue(poller.poll.called)

    def test_poll_writable(self):
        x = X(self.app)
        writer = Mock(name='writer')
        x.hub.add_writer(6, writer, 6)
        x.hub.on_tick.add(x.close_then_error(Mock(name='tick'), 2))
        poller = x.hub.poller
        poller.poll.return_value = [(6, WRITE)]
        with self.assertRaises(socket.error):
            asynloop(*x.args)
        writer.assert_called_with(6)
        self.assertTrue(poller.poll.called)

    def test_poll_writable_none_registered(self):
        x = X(self.app)
        writer = Mock(name='writer')
        x.hub.add_writer(6, writer, 6)
        x.hub.on_tick.add(x.close_then_error(Mock(name='tick'), 2))
        poller = x.hub.poller
        poller.poll.return_value = [(7, WRITE)]
        with self.assertRaises(socket.error):
            asynloop(*x.args)
        self.assertTrue(poller.poll.called)

    def test_poll_unknown_event(self):
        x = X(self.app)
        writer = Mock(name='reader')
        x.hub.add_writer(6, writer, 6)
        x.hub.on_tick.add(x.close_then_error(Mock(name='tick'), 2))
        poller = x.hub.poller
        poller.poll.return_value = [(6, 0)]
        with self.assertRaises(socket.error):
            asynloop(*x.args)
        self.assertTrue(poller.poll.called)

    def test_poll_keep_draining_disabled(self):
        x = X(self.app)
        x.hub.writers = {6: Mock()}
        poll = x.hub.poller.poll

        def se(*args, **kwargs):
            poll.side_effect = socket.error()
        poll.side_effect = se

        poller = x.hub.poller
        poll.return_value = [(6, 0)]
        with self.assertRaises(socket.error):
            asynloop(*x.args)
        self.assertTrue(poller.poll.called)

    def test_poll_err_writable(self):
        x = X(self.app)
        writer = Mock(name='writer')
        x.hub.add_writer(6, writer, 6, 48)
        x.hub.on_tick.add(x.close_then_error(Mock(), 2))
        poller = x.hub.poller
        poller.poll.return_value = [(6, ERR)]
        with self.assertRaises(socket.error):
            asynloop(*x.args)
        writer.assert_called_with(6, 48)
        self.assertTrue(poller.poll.called)

    def test_poll_write_generator(self):
        x = X(self.app)
        x.hub.remove = Mock(name='hub.remove()')

        def Gen():
            yield 1
            yield 2
        gen = Gen()

        x.hub.add_writer(6, gen)
        x.hub.on_tick.add(x.close_then_error(Mock(name='tick'), 2))
        x.hub.poller.poll.return_value = [(6, WRITE)]
        with self.assertRaises(socket.error):
            asynloop(*x.args)
        self.assertTrue(gen.gi_frame.f_lasti != -1)
        self.assertFalse(x.hub.remove.called)

    def test_poll_write_generator_stopped(self):
        x = X(self.app)

        def Gen():
            raise StopIteration()
            yield
        gen = Gen()
        x.hub.add_writer(6, gen)
        x.hub.on_tick.add(x.close_then_error(Mock(name='tick'), 2))
        x.hub.poller.poll.return_value = [(6, WRITE)]
        x.hub.remove = Mock(name='hub.remove()')
        with self.assertRaises(socket.error):
            asynloop(*x.args)
        self.assertIsNone(gen.gi_frame)

    def test_poll_write_generator_raises(self):
        x = X(self.app)

        def Gen():
            raise ValueError('foo')
            yield
        gen = Gen()
        x.hub.add_writer(6, gen)
        x.hub.remove = Mock(name='hub.remove()')
        x.hub.on_tick.add(x.close_then_error(Mock(name='tick'), 2))
        x.hub.poller.poll.return_value = [(6, WRITE)]
        with self.assertRaises(ValueError):
            asynloop(*x.args)
        self.assertIsNone(gen.gi_frame)
        x.hub.remove.assert_called_with(6)

    def test_poll_err_readable(self):
        x = X(self.app)
        reader = Mock(name='reader')
        x.hub.add_reader(6, reader, 6, 24)
        x.hub.on_tick.add(x.close_then_error(Mock(), 2))
        poller = x.hub.poller
        poller.poll.return_value = [(6, ERR)]
        with self.assertRaises(socket.error):
            asynloop(*x.args)
        reader.assert_called_with(6, 24)
        self.assertTrue(poller.poll.called)

    def test_poll_raises_ValueError(self):
        x = X(self.app)
        x.hub.readers = {6: Mock()}
        poller = x.hub.poller
        x.close_then_error(poller.poll, exc=ValueError)
        asynloop(*x.args)
        self.assertTrue(poller.poll.called)


class test_synloop(AppCase):

    def test_timeout_ignored(self):
        x = X(self.app)
        x.timeout_then_error(x.connection.drain_events)
        with self.assertRaises(socket.error):
            synloop(*x.args)
        self.assertEqual(x.connection.drain_events.call_count, 2)

    def test_updates_qos_when_changed(self):
        x = X(self.app)
        x.qos.prev = 2
        x.qos.value = 2
        x.timeout_then_error(x.connection.drain_events)
        with self.assertRaises(socket.error):
            synloop(*x.args)
        self.assertFalse(x.qos.update.called)

        x.qos.value = 4
        x.timeout_then_error(x.connection.drain_events)
        with self.assertRaises(socket.error):
            synloop(*x.args)
        x.qos.update.assert_called_with()

    def test_ignores_socket_errors_when_closed(self):
        x = X(self.app)
        x.close_then_error(x.connection.drain_events)
        self.assertIsNone(synloop(*x.args))
