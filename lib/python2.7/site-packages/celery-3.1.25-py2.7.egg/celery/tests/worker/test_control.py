from __future__ import absolute_import

import sys
import socket

from collections import defaultdict
from datetime import datetime, timedelta

from kombu import pidbox

from celery.datastructures import AttributeDict
from celery.five import Queue as FastQueue
from celery.utils import uuid
from celery.utils.timer2 import Timer
from celery.worker import WorkController as _WC
from celery.worker import consumer
from celery.worker import control
from celery.worker import state as worker_state
from celery.worker.job import Request
from celery.worker.state import revoked
from celery.worker.control import Panel
from celery.worker.pidbox import Pidbox, gPidbox

from celery.tests.case import AppCase, Mock, call, patch

hostname = socket.gethostname()


class WorkController(object):
    autoscaler = None

    def stats(self):
        return {'total': worker_state.total_count}


class Consumer(consumer.Consumer):

    def __init__(self, app):
        self.app = app
        self.buffer = FastQueue()
        self.handle_task = self.buffer.put
        self.timer = Timer()
        self.event_dispatcher = Mock()
        self.controller = WorkController()
        self.task_consumer = Mock()
        self.prefetch_multiplier = 1
        self.initial_prefetch_count = 1

        from celery.concurrency.base import BasePool
        self.pool = BasePool(10)
        self.task_buckets = defaultdict(lambda: None)


class test_Pidbox(AppCase):

    def test_shutdown(self):
        with patch('celery.worker.pidbox.ignore_errors') as eig:
            parent = Mock()
            pbox = Pidbox(parent)
            pbox._close_channel = Mock()
            self.assertIs(pbox.c, parent)
            pconsumer = pbox.consumer = Mock()
            cancel = pconsumer.cancel
            pbox.shutdown(parent)
            eig.assert_called_with(parent, cancel)
            pbox._close_channel.assert_called_with(parent)


class test_Pidbox_green(AppCase):

    def test_stop(self):
        parent = Mock()
        g = gPidbox(parent)
        stopped = g._node_stopped = Mock()
        shutdown = g._node_shutdown = Mock()
        close_chan = g._close_channel = Mock()

        g.stop(parent)
        shutdown.set.assert_called_with()
        stopped.wait.assert_called_with()
        close_chan.assert_called_with(parent)
        self.assertIsNone(g._node_stopped)
        self.assertIsNone(g._node_shutdown)

        close_chan.reset()
        g.stop(parent)
        close_chan.assert_called_with(parent)

    def test_resets(self):
        parent = Mock()
        g = gPidbox(parent)
        g._resets = 100
        g.reset()
        self.assertEqual(g._resets, 101)

    def test_loop(self):
        parent = Mock()
        conn = parent.connect.return_value = self.app.connection()
        drain = conn.drain_events = Mock()
        g = gPidbox(parent)
        parent.connection = Mock()
        do_reset = g._do_reset = Mock()

        call_count = [0]

        def se(*args, **kwargs):
            if call_count[0] > 2:
                g._node_shutdown.set()
            g.reset()
            call_count[0] += 1
        drain.side_effect = se
        g.loop(parent)

        self.assertEqual(do_reset.call_count, 4)


class test_ControlPanel(AppCase):

    def setup(self):
        self.panel = self.create_panel(consumer=Consumer(self.app))

        @self.app.task(name='c.unittest.mytask', rate_limit=200, shared=False)
        def mytask():
            pass
        self.mytask = mytask

    def create_state(self, **kwargs):
        kwargs.setdefault('app', self.app)
        kwargs.setdefault('hostname', hostname)
        return AttributeDict(kwargs)

    def create_panel(self, **kwargs):
        return self.app.control.mailbox.Node(hostname=hostname,
                                             state=self.create_state(**kwargs),
                                             handlers=Panel.data)

    def test_enable_events(self):
        consumer = Consumer(self.app)
        panel = self.create_panel(consumer=consumer)
        evd = consumer.event_dispatcher
        evd.groups = set()
        panel.handle('enable_events')
        self.assertFalse(evd.groups)
        evd.groups = set(['worker'])
        panel.handle('enable_events')
        self.assertIn('task', evd.groups)
        evd.groups = set(['task'])
        self.assertIn('already enabled', panel.handle('enable_events')['ok'])

    def test_disable_events(self):
        consumer = Consumer(self.app)
        panel = self.create_panel(consumer=consumer)
        evd = consumer.event_dispatcher
        evd.enabled = True
        evd.groups = set(['task'])
        panel.handle('disable_events')
        self.assertNotIn('task', evd.groups)
        self.assertIn('already disabled', panel.handle('disable_events')['ok'])

    def test_clock(self):
        consumer = Consumer(self.app)
        panel = self.create_panel(consumer=consumer)
        panel.state.app.clock.value = 313
        x = panel.handle('clock')
        self.assertEqual(x['clock'], 313)

    def test_hello(self):
        consumer = Consumer(self.app)
        panel = self.create_panel(consumer=consumer)
        panel.state.app.clock.value = 313
        worker_state.revoked.add('revoked1')
        try:
            x = panel.handle('hello', {'from_node': 'george@vandelay.com'})
            self.assertIn('revoked1', x['revoked'])
            self.assertEqual(x['clock'], 314)  # incremented
        finally:
            worker_state.revoked.discard('revoked1')

    def test_conf(self):
        return
        consumer = Consumer(self.app)
        panel = self.create_panel(consumer=consumer)
        self.app.conf.SOME_KEY6 = 'hello world'
        x = panel.handle('dump_conf')
        self.assertIn('SOME_KEY6', x)

    def test_election(self):
        consumer = Consumer(self.app)
        panel = self.create_panel(consumer=consumer)
        consumer.gossip = Mock()
        panel.handle(
            'election', {'id': 'id', 'topic': 'topic', 'action': 'action'},
        )
        consumer.gossip.election.assert_called_with('id', 'topic', 'action')

    def test_heartbeat(self):
        consumer = Consumer(self.app)
        panel = self.create_panel(consumer=consumer)
        consumer.event_dispatcher.enabled = True
        panel.handle('heartbeat')
        self.assertIn(('worker-heartbeat', ),
                      consumer.event_dispatcher.send.call_args)

    def test_time_limit(self):
        panel = self.create_panel(consumer=Mock())
        r = panel.handle('time_limit', arguments=dict(
            task_name=self.mytask.name, hard=30, soft=10))
        self.assertEqual(
            (self.mytask.time_limit, self.mytask.soft_time_limit),
            (30, 10),
        )
        self.assertIn('ok', r)
        r = panel.handle('time_limit', arguments=dict(
            task_name=self.mytask.name, hard=None, soft=None))
        self.assertEqual(
            (self.mytask.time_limit, self.mytask.soft_time_limit),
            (None, None),
        )
        self.assertIn('ok', r)

        r = panel.handle('time_limit', arguments=dict(
            task_name='248e8afya9s8dh921eh928', hard=30))
        self.assertIn('error', r)

    def test_active_queues(self):
        import kombu

        x = kombu.Consumer(self.app.connection(),
                           [kombu.Queue('foo', kombu.Exchange('foo'), 'foo'),
                            kombu.Queue('bar', kombu.Exchange('bar'), 'bar')],
                           auto_declare=False)
        consumer = Mock()
        consumer.task_consumer = x
        panel = self.create_panel(consumer=consumer)
        r = panel.handle('active_queues')
        self.assertListEqual(list(sorted(q['name'] for q in r)),
                             ['bar', 'foo'])

    def test_dump_tasks(self):
        info = '\n'.join(self.panel.handle('dump_tasks'))
        self.assertIn('mytask', info)
        self.assertIn('rate_limit=200', info)

    def test_stats(self):
        prev_count, worker_state.total_count = worker_state.total_count, 100
        try:
            self.assertDictContainsSubset({'total': 100},
                                          self.panel.handle('stats'))
        finally:
            worker_state.total_count = prev_count

    def test_report(self):
        self.panel.handle('report')

    def test_active(self):
        r = Request({
            'task': self.mytask.name,
            'id': 'do re mi',
            'args': (),
            'kwargs': {},
        }, app=self.app)
        worker_state.active_requests.add(r)
        try:
            self.assertTrue(self.panel.handle('dump_active'))
        finally:
            worker_state.active_requests.discard(r)

    def test_pool_grow(self):

        class MockPool(object):

            def __init__(self, size=1):
                self.size = size

            def grow(self, n=1):
                self.size += n

            def shrink(self, n=1):
                self.size -= n

            @property
            def num_processes(self):
                return self.size

        consumer = Consumer(self.app)
        consumer.prefetch_multiplier = 8
        consumer.qos = Mock(name='qos')
        consumer.pool = MockPool(1)
        panel = self.create_panel(consumer=consumer)

        panel.handle('pool_grow')
        self.assertEqual(consumer.pool.size, 2)
        consumer.qos.increment_eventually.assert_called_with(8)
        self.assertEqual(consumer.initial_prefetch_count, 16)
        panel.handle('pool_shrink')
        self.assertEqual(consumer.pool.size, 1)
        consumer.qos.decrement_eventually.assert_called_with(8)
        self.assertEqual(consumer.initial_prefetch_count, 8)

        panel.state.consumer = Mock()
        panel.state.consumer.controller = Mock()
        sc = panel.state.consumer.controller.autoscaler = Mock()
        panel.handle('pool_grow')
        self.assertTrue(sc.force_scale_up.called)
        panel.handle('pool_shrink')
        self.assertTrue(sc.force_scale_down.called)

    def test_add__cancel_consumer(self):

        class MockConsumer(object):
            queues = []
            canceled = []
            consuming = False

            def add_queue(self, queue):
                self.queues.append(queue.name)

            def consume(self):
                self.consuming = True

            def cancel_by_queue(self, queue):
                self.canceled.append(queue)

            def consuming_from(self, queue):
                return queue in self.queues

        consumer = Consumer(self.app)
        consumer.task_consumer = MockConsumer()
        panel = self.create_panel(consumer=consumer)

        panel.handle('add_consumer', {'queue': 'MyQueue'})
        self.assertIn('MyQueue', consumer.task_consumer.queues)
        self.assertTrue(consumer.task_consumer.consuming)
        panel.handle('add_consumer', {'queue': 'MyQueue'})
        panel.handle('cancel_consumer', {'queue': 'MyQueue'})
        self.assertIn('MyQueue', consumer.task_consumer.canceled)

    def test_revoked(self):
        worker_state.revoked.clear()
        worker_state.revoked.add('a1')
        worker_state.revoked.add('a2')

        try:
            self.assertEqual(sorted(self.panel.handle('dump_revoked')),
                             ['a1', 'a2'])
        finally:
            worker_state.revoked.clear()

    def test_dump_schedule(self):
        consumer = Consumer(self.app)
        panel = self.create_panel(consumer=consumer)
        self.assertFalse(panel.handle('dump_schedule'))
        r = Request({
            'task': self.mytask.name,
            'id': 'CAFEBABE',
            'args': (),
            'kwargs': {},
        }, app=self.app)
        consumer.timer.schedule.enter_at(
            consumer.timer.Entry(lambda x: x, (r, )),
            datetime.now() + timedelta(seconds=10))
        consumer.timer.schedule.enter_at(
            consumer.timer.Entry(lambda x: x, (object(), )),
            datetime.now() + timedelta(seconds=10))
        self.assertTrue(panel.handle('dump_schedule'))

    def test_dump_reserved(self):
        consumer = Consumer(self.app)
        worker_state.reserved_requests.add(Request({
            'task': self.mytask.name,
            'id': uuid(),
            'args': (2, 2),
            'kwargs': {},
        }, app=self.app))
        try:
            panel = self.create_panel(consumer=consumer)
            response = panel.handle('dump_reserved', {'safe': True})
            self.assertDictContainsSubset(
                {'name': self.mytask.name,
                 'args': (2, 2),
                 'kwargs': {},
                 'hostname': socket.gethostname()},
                response[0],
            )
            worker_state.reserved_requests.clear()
            self.assertFalse(panel.handle('dump_reserved'))
        finally:
            worker_state.reserved_requests.clear()

    def test_rate_limit_invalid_rate_limit_string(self):
        e = self.panel.handle('rate_limit', arguments=dict(
            task_name='tasks.add', rate_limit='x1240301#%!'))
        self.assertIn('Invalid rate limit string', e.get('error'))

    def test_rate_limit(self):

        class xConsumer(object):
            reset = False

            def reset_rate_limits(self):
                self.reset = True

        consumer = xConsumer()
        panel = self.create_panel(app=self.app, consumer=consumer)

        task = self.app.tasks[self.mytask.name]
        panel.handle('rate_limit', arguments=dict(task_name=task.name,
                                                  rate_limit='100/m'))
        self.assertEqual(task.rate_limit, '100/m')
        self.assertTrue(consumer.reset)
        consumer.reset = False
        panel.handle('rate_limit', arguments=dict(task_name=task.name,
                                                  rate_limit=0))
        self.assertEqual(task.rate_limit, 0)
        self.assertTrue(consumer.reset)

    def test_rate_limit_nonexistant_task(self):
        self.panel.handle('rate_limit', arguments={
            'task_name': 'xxxx.does.not.exist',
            'rate_limit': '1000/s'})

    def test_unexposed_command(self):
        with self.assertRaises(KeyError):
            self.panel.handle('foo', arguments={})

    def test_revoke_with_name(self):
        tid = uuid()
        m = {'method': 'revoke',
             'destination': hostname,
             'arguments': {'task_id': tid,
                           'task_name': self.mytask.name}}
        self.panel.handle_message(m, None)
        self.assertIn(tid, revoked)

    def test_revoke_with_name_not_in_registry(self):
        tid = uuid()
        m = {'method': 'revoke',
             'destination': hostname,
             'arguments': {'task_id': tid,
                           'task_name': 'xxxxxxxxx33333333388888'}}
        self.panel.handle_message(m, None)
        self.assertIn(tid, revoked)

    def test_revoke(self):
        tid = uuid()
        m = {'method': 'revoke',
             'destination': hostname,
             'arguments': {'task_id': tid}}
        self.panel.handle_message(m, None)
        self.assertIn(tid, revoked)

        m = {'method': 'revoke',
             'destination': 'does.not.exist',
             'arguments': {'task_id': tid + 'xxx'}}
        self.panel.handle_message(m, None)
        self.assertNotIn(tid + 'xxx', revoked)

    def test_revoke_terminate(self):
        request = Mock()
        request.id = tid = uuid()
        worker_state.reserved_requests.add(request)
        try:
            r = control.revoke(Mock(), tid, terminate=True)
            self.assertIn(tid, revoked)
            self.assertTrue(request.terminate.call_count)
            self.assertIn('terminate:', r['ok'])
            # unknown task id only revokes
            r = control.revoke(Mock(), uuid(), terminate=True)
            self.assertIn('tasks unknown', r['ok'])
        finally:
            worker_state.reserved_requests.discard(request)

    def test_autoscale(self):
        self.panel.state.consumer = Mock()
        self.panel.state.consumer.controller = Mock()
        sc = self.panel.state.consumer.controller.autoscaler = Mock()
        sc.update.return_value = 10, 2
        m = {'method': 'autoscale',
             'destination': hostname,
             'arguments': {'max': '10', 'min': '2'}}
        r = self.panel.handle_message(m, None)
        self.assertIn('ok', r)

        self.panel.state.consumer.controller.autoscaler = None
        r = self.panel.handle_message(m, None)
        self.assertIn('error', r)

    def test_ping(self):
        m = {'method': 'ping',
             'destination': hostname}
        r = self.panel.handle_message(m, None)
        self.assertEqual(r, {'ok': 'pong'})

    def test_shutdown(self):
        m = {'method': 'shutdown',
             'destination': hostname}
        with self.assertRaises(SystemExit):
            self.panel.handle_message(m, None)

    def test_panel_reply(self):

        replies = []

        class _Node(pidbox.Node):

            def reply(self, data, exchange, routing_key, **kwargs):
                replies.append(data)

        panel = _Node(hostname=hostname,
                      state=self.create_state(consumer=Consumer(self.app)),
                      handlers=Panel.data,
                      mailbox=self.app.control.mailbox)
        r = panel.dispatch('ping', reply_to={'exchange': 'x',
                                             'routing_key': 'x'})
        self.assertEqual(r, {'ok': 'pong'})
        self.assertDictEqual(replies[0], {panel.hostname: {'ok': 'pong'}})

    def test_pool_restart(self):
        consumer = Consumer(self.app)
        consumer.controller = _WC(app=self.app)
        consumer.controller.consumer = consumer
        consumer.controller.pool.restart = Mock()
        consumer.reset_rate_limits = Mock(name='reset_rate_limits()')
        consumer.update_strategies = Mock(name='update_strategies()')
        consumer.event_dispatcher = Mock(name='evd')
        panel = self.create_panel(consumer=consumer)
        assert panel.state.consumer.controller.consumer is consumer
        panel.app = self.app
        _import = panel.app.loader.import_from_cwd = Mock()
        _reload = Mock()

        with self.assertRaises(ValueError):
            panel.handle('pool_restart', {'reloader': _reload})

        self.app.conf.CELERYD_POOL_RESTARTS = True
        panel.handle('pool_restart', {'reloader': _reload})
        self.assertTrue(consumer.controller.pool.restart.called)
        consumer.reset_rate_limits.assert_called_with()
        consumer.update_strategies.assert_called_with()
        self.assertFalse(_reload.called)
        self.assertFalse(_import.called)

    def test_pool_restart_import_modules(self):
        consumer = Consumer(self.app)
        consumer.controller = _WC(app=self.app)
        consumer.controller.consumer = consumer
        consumer.controller.pool.restart = Mock()
        consumer.reset_rate_limits = Mock(name='reset_rate_limits()')
        consumer.update_strategies = Mock(name='update_strategies()')
        panel = self.create_panel(consumer=consumer)
        panel.app = self.app
        assert panel.state.consumer.controller.consumer is consumer
        _import = consumer.controller.app.loader.import_from_cwd = Mock()
        _reload = Mock()

        self.app.conf.CELERYD_POOL_RESTARTS = True
        panel.handle('pool_restart', {'modules': ['foo', 'bar'],
                                      'reloader': _reload})

        self.assertTrue(consumer.controller.pool.restart.called)
        consumer.reset_rate_limits.assert_called_with()
        consumer.update_strategies.assert_called_with()
        self.assertFalse(_reload.called)
        self.assertItemsEqual(
            [call('bar'), call('foo')],
            _import.call_args_list,
        )

    def test_pool_restart_reload_modules(self):
        consumer = Consumer(self.app)
        consumer.controller = _WC(app=self.app)
        consumer.controller.consumer = consumer
        consumer.controller.pool.restart = Mock()
        consumer.reset_rate_limits = Mock(name='reset_rate_limits()')
        consumer.update_strategies = Mock(name='update_strategies()')
        panel = self.create_panel(consumer=consumer)
        panel.app = self.app
        _import = panel.app.loader.import_from_cwd = Mock()
        _reload = Mock()

        self.app.conf.CELERYD_POOL_RESTARTS = True
        with patch.dict(sys.modules, {'foo': None}):
            panel.handle('pool_restart', {'modules': ['foo'],
                                          'reload': False,
                                          'reloader': _reload})

            self.assertTrue(consumer.controller.pool.restart.called)
            self.assertFalse(_reload.called)
            self.assertFalse(_import.called)

            _import.reset_mock()
            _reload.reset_mock()
            consumer.controller.pool.restart.reset_mock()

            panel.handle('pool_restart', {'modules': ['foo'],
                                          'reload': True,
                                          'reloader': _reload})

            self.assertTrue(consumer.controller.pool.restart.called)
            self.assertTrue(_reload.called)
            self.assertFalse(_import.called)
