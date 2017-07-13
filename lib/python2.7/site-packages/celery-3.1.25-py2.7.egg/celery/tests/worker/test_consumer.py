from __future__ import absolute_import

import errno
import socket

from billiard.exceptions import RestartFreqExceeded

from celery.datastructures import LimitedSet
from celery.worker import state as worker_state
from celery.worker.consumer import (
    Consumer,
    Heart,
    Tasks,
    Agent,
    Mingle,
    Gossip,
    dump_body,
    CLOSE,
)

from celery.tests.case import AppCase, ContextMock, Mock, SkipTest, call, patch


class test_Consumer(AppCase):

    def get_consumer(self, no_hub=False, **kwargs):
        consumer = Consumer(
            on_task_request=Mock(),
            init_callback=Mock(),
            pool=Mock(),
            app=self.app,
            timer=Mock(),
            controller=Mock(),
            hub=None if no_hub else Mock(),
            **kwargs
        )
        consumer.blueprint = Mock()
        consumer._restart_state = Mock()
        consumer.connection = _amqp_connection()
        consumer.connection_errors = (socket.error, OSError, )
        return consumer

    def test_taskbuckets_defaultdict(self):
        c = self.get_consumer()
        self.assertIsNone(c.task_buckets['fooxasdwx.wewe'])

    def test_dump_body_buffer(self):
        msg = Mock()
        msg.body = 'str'
        try:
            buf = buffer(msg.body)
        except NameError:
            raise SkipTest('buffer type not available')
        self.assertTrue(dump_body(msg, buf))

    def test_sets_heartbeat(self):
        c = self.get_consumer(amqheartbeat=10)
        self.assertEqual(c.amqheartbeat, 10)
        self.app.conf.BROKER_HEARTBEAT = 20
        c = self.get_consumer(amqheartbeat=None)
        self.assertEqual(c.amqheartbeat, 20)

    def test_gevent_bug_disables_connection_timeout(self):
        with patch('celery.worker.consumer._detect_environment') as de:
            de.return_value = 'gevent'
            self.app.conf.BROKER_CONNECTION_TIMEOUT = 33.33
            self.get_consumer()
            self.assertIsNone(self.app.conf.BROKER_CONNECTION_TIMEOUT)

    def test_limit_task(self):
        c = self.get_consumer()

        with patch('celery.worker.consumer.task_reserved') as reserved:
            bucket = Mock()
            request = Mock()
            bucket.can_consume.return_value = True

            c._limit_task(request, bucket, 3)
            bucket.can_consume.assert_called_with(3)
            reserved.assert_called_with(request)
            c.on_task_request.assert_called_with(request)

        with patch('celery.worker.consumer.task_reserved') as reserved:
            bucket.can_consume.return_value = False
            bucket.expected_time.return_value = 3.33
            c._limit_task(request, bucket, 4)
            bucket.can_consume.assert_called_with(4)
            c.timer.call_after.assert_called_with(
                3.33, c._limit_task, (request, bucket, 4),
            )
            bucket.expected_time.assert_called_with(4)
            self.assertFalse(reserved.called)

    def test_start_blueprint_raises_EMFILE(self):
        c = self.get_consumer()
        exc = c.blueprint.start.side_effect = OSError()
        exc.errno = errno.EMFILE

        with self.assertRaises(OSError):
            c.start()

    def test_max_restarts_exceeded(self):
        c = self.get_consumer()

        def se(*args, **kwargs):
            c.blueprint.state = CLOSE
            raise RestartFreqExceeded()
        c._restart_state.step.side_effect = se
        c.blueprint.start.side_effect = socket.error()

        with patch('celery.worker.consumer.sleep') as sleep:
            c.start()
            sleep.assert_called_with(1)

    def _closer(self, c):
        def se(*args, **kwargs):
            c.blueprint.state = CLOSE
        return se

    def test_collects_at_restart(self):
        c = self.get_consumer()
        c.connection.collect.side_effect = MemoryError()
        c.blueprint.start.side_effect = socket.error()
        c.blueprint.restart.side_effect = self._closer(c)
        c.start()
        c.connection.collect.assert_called_with()

    def test_register_with_event_loop(self):
        c = self.get_consumer()
        c.register_with_event_loop(Mock(name='loop'))

    def test_on_close_clears_semaphore_timer_and_reqs(self):
        with patch('celery.worker.consumer.reserved_requests') as reserved:
            c = self.get_consumer()
            c.on_close()
            c.controller.semaphore.clear.assert_called_with()
            c.timer.clear.assert_called_with()
            reserved.clear.assert_called_with()
            c.pool.flush.assert_called_with()

            c.controller = None
            c.timer = None
            c.pool = None
            c.on_close()

    def test_connect_error_handler(self):
        self.app.connection = _amqp_connection()
        conn = self.app.connection.return_value
        c = self.get_consumer()
        self.assertTrue(c.connect())
        self.assertTrue(conn.ensure_connection.called)
        errback = conn.ensure_connection.call_args[0][0]
        conn.alt = [(1, 2, 3)]
        errback(Mock(), 0)


class test_Heart(AppCase):

    def test_start(self):
        c = Mock()
        c.timer = Mock()
        c.event_dispatcher = Mock()

        with patch('celery.worker.heartbeat.Heart') as hcls:
            h = Heart(c)
            self.assertTrue(h.enabled)
            self.assertEqual(h.heartbeat_interval, None)
            self.assertIsNone(c.heart)

            h.start(c)
            self.assertTrue(c.heart)
            hcls.assert_called_with(c.timer, c.event_dispatcher,
                                    h.heartbeat_interval)
            c.heart.start.assert_called_with()

    def test_start_heartbeat_interval(self):
        c = Mock()
        c.timer = Mock()
        c.event_dispatcher = Mock()

        with patch('celery.worker.heartbeat.Heart') as hcls:
            h = Heart(c, False, 20)
            self.assertTrue(h.enabled)
            self.assertEqual(h.heartbeat_interval, 20)
            self.assertIsNone(c.heart)

            h.start(c)
            self.assertTrue(c.heart)
            hcls.assert_called_with(c.timer, c.event_dispatcher,
                                    h.heartbeat_interval)
            c.heart.start.assert_called_with()


class test_Tasks(AppCase):

    def test_stop(self):
        c = Mock()
        tasks = Tasks(c)
        self.assertIsNone(c.task_consumer)
        self.assertIsNone(c.qos)

        c.task_consumer = Mock()
        tasks.stop(c)

    def test_stop_already_stopped(self):
        c = Mock()
        tasks = Tasks(c)
        tasks.stop(c)


class test_Agent(AppCase):

    def test_start(self):
        c = Mock()
        agent = Agent(c)
        agent.instantiate = Mock()
        agent.agent_cls = 'foo:Agent'
        self.assertIsNotNone(agent.create(c))
        agent.instantiate.assert_called_with(agent.agent_cls, c.connection)


class test_Mingle(AppCase):

    def test_start_no_replies(self):
        c = Mock()
        c.app.connection = _amqp_connection()
        mingle = Mingle(c)
        I = c.app.control.inspect.return_value = Mock()
        I.hello.return_value = {}
        mingle.start(c)

    def test_start(self):
        try:
            c = Mock()
            c.app.connection = _amqp_connection()
            mingle = Mingle(c)
            self.assertTrue(mingle.enabled)

            Aig = LimitedSet()
            Big = LimitedSet()
            Aig.add('Aig-1')
            Aig.add('Aig-2')
            Big.add('Big-1')

            I = c.app.control.inspect.return_value = Mock()
            I.hello.return_value = {
                'A@example.com': {
                    'clock': 312,
                    'revoked': Aig._data,
                },
                'B@example.com': {
                    'clock': 29,
                    'revoked': Big._data,
                },
                'C@example.com': {
                    'error': 'unknown method',
                },
            }

            mingle.start(c)
            I.hello.assert_called_with(c.hostname, worker_state.revoked._data)
            c.app.clock.adjust.assert_has_calls([
                call(312), call(29),
            ], any_order=True)
            self.assertIn('Aig-1', worker_state.revoked)
            self.assertIn('Aig-2', worker_state.revoked)
            self.assertIn('Big-1', worker_state.revoked)
        finally:
            worker_state.revoked.clear()


def _amqp_connection():
    connection = ContextMock()
    connection.return_value = ContextMock()
    connection.return_value.transport.driver_type = 'amqp'
    return connection


class test_Gossip(AppCase):

    def test_init(self):
        c = self.Consumer()
        c.app.connection = _amqp_connection()
        g = Gossip(c)
        self.assertTrue(g.enabled)
        self.assertIs(c.gossip, g)

    def test_callbacks(self):
        c = self.Consumer()
        c.app.connection = _amqp_connection()
        g = Gossip(c)
        on_node_join = Mock(name='on_node_join')
        on_node_join2 = Mock(name='on_node_join2')
        on_node_leave = Mock(name='on_node_leave')
        on_node_lost = Mock(name='on.node_lost')
        g.on.node_join.add(on_node_join)
        g.on.node_join.add(on_node_join2)
        g.on.node_leave.add(on_node_leave)
        g.on.node_lost.add(on_node_lost)

        worker = Mock(name='worker')
        g.on_node_join(worker)
        on_node_join.assert_called_with(worker)
        on_node_join2.assert_called_with(worker)
        g.on_node_leave(worker)
        on_node_leave.assert_called_with(worker)
        g.on_node_lost(worker)
        on_node_lost.assert_called_with(worker)

    def test_election(self):
        c = self.Consumer()
        c.app.connection = _amqp_connection()
        g = Gossip(c)
        g.start(c)
        g.election('id', 'topic', 'action')
        self.assertListEqual(g.consensus_replies['id'], [])
        g.dispatcher.send.assert_called_with(
            'worker-elect', id='id', topic='topic', cver=1, action='action',
        )

    def test_call_task(self):
        c = self.Consumer()
        c.app.connection = _amqp_connection()
        g = Gossip(c)
        g.start(c)

        with patch('celery.worker.consumer.signature') as signature:
            sig = signature.return_value = Mock()
            task = Mock()
            g.call_task(task)
            signature.assert_called_with(task, app=c.app)
            sig.apply_async.assert_called_with()

            sig.apply_async.side_effect = MemoryError()
            with patch('celery.worker.consumer.error') as error:
                g.call_task(task)
                self.assertTrue(error.called)

    def Event(self, id='id', clock=312,
              hostname='foo@example.com', pid=4312,
              topic='topic', action='action', cver=1):
        return {
            'id': id,
            'clock': clock,
            'hostname': hostname,
            'pid': pid,
            'topic': topic,
            'action': action,
            'cver': cver,
        }

    def test_on_elect(self):
        c = self.Consumer()
        c.app.connection = _amqp_connection()
        g = Gossip(c)
        g.start(c)

        event = self.Event('id1')
        g.on_elect(event)
        in_heap = g.consensus_requests['id1']
        self.assertTrue(in_heap)
        g.dispatcher.send.assert_called_with('worker-elect-ack', id='id1')

        event.pop('clock')
        with patch('celery.worker.consumer.error') as error:
            g.on_elect(event)
            self.assertTrue(error.called)

    def Consumer(self, hostname='foo@x.com', pid=4312):
        c = Mock()
        c.app.connection = _amqp_connection()
        c.hostname = hostname
        c.pid = pid
        return c

    def setup_election(self, g, c):
        g.start(c)
        g.clock = self.app.clock
        self.assertNotIn('idx', g.consensus_replies)
        self.assertIsNone(g.on_elect_ack({'id': 'idx'}))

        g.state.alive_workers.return_value = [
            'foo@x.com', 'bar@x.com', 'baz@x.com',
        ]
        g.consensus_replies['id1'] = []
        g.consensus_requests['id1'] = []
        e1 = self.Event('id1', 1, 'foo@x.com')
        e2 = self.Event('id1', 2, 'bar@x.com')
        e3 = self.Event('id1', 3, 'baz@x.com')
        g.on_elect(e1)
        g.on_elect(e2)
        g.on_elect(e3)
        self.assertEqual(len(g.consensus_requests['id1']), 3)

        with patch('celery.worker.consumer.info'):
            g.on_elect_ack(e1)
            self.assertEqual(len(g.consensus_replies['id1']), 1)
            g.on_elect_ack(e2)
            self.assertEqual(len(g.consensus_replies['id1']), 2)
            g.on_elect_ack(e3)
            with self.assertRaises(KeyError):
                g.consensus_replies['id1']

    def test_on_elect_ack_win(self):
        c = self.Consumer(hostname='foo@x.com')  # I will win
        g = Gossip(c)
        handler = g.election_handlers['topic'] = Mock()
        self.setup_election(g, c)
        handler.assert_called_with('action')

    def test_on_elect_ack_lose(self):
        c = self.Consumer(hostname='bar@x.com')  # I will lose
        c.app.connection = _amqp_connection()
        g = Gossip(c)
        handler = g.election_handlers['topic'] = Mock()
        self.setup_election(g, c)
        self.assertFalse(handler.called)

    def test_on_elect_ack_win_but_no_action(self):
        c = self.Consumer(hostname='foo@x.com')  # I will win
        g = Gossip(c)
        g.election_handlers = {}
        with patch('celery.worker.consumer.error') as error:
            self.setup_election(g, c)
            self.assertTrue(error.called)

    def test_on_node_join(self):
        c = self.Consumer()
        g = Gossip(c)
        with patch('celery.worker.consumer.debug') as debug:
            g.on_node_join(c)
            debug.assert_called_with('%s joined the party', 'foo@x.com')

    def test_on_node_leave(self):
        c = self.Consumer()
        g = Gossip(c)
        with patch('celery.worker.consumer.debug') as debug:
            g.on_node_leave(c)
            debug.assert_called_with('%s left', 'foo@x.com')

    def test_on_node_lost(self):
        c = self.Consumer()
        g = Gossip(c)
        with patch('celery.worker.consumer.info') as info:
            g.on_node_lost(c)
            info.assert_called_with('missed heartbeat from %s', 'foo@x.com')

    def test_register_timer(self):
        c = self.Consumer()
        g = Gossip(c)
        g.register_timer()
        c.timer.call_repeatedly.assert_called_with(g.interval, g.periodic)
        tref = g._tref
        g.register_timer()
        tref.cancel.assert_called_with()

    def test_periodic(self):
        c = self.Consumer()
        g = Gossip(c)
        g.on_node_lost = Mock()
        state = g.state = Mock()
        worker = Mock()
        state.workers = {'foo': worker}
        worker.alive = True
        worker.hostname = 'foo'
        g.periodic()

        worker.alive = False
        g.periodic()
        g.on_node_lost.assert_called_with(worker)
        with self.assertRaises(KeyError):
            state.workers['foo']

    def test_on_message(self):
        c = self.Consumer()
        g = Gossip(c)
        self.assertTrue(g.enabled)
        prepare = Mock()
        prepare.return_value = 'worker-online', {}
        c.app.events.State.assert_called_with(
            on_node_join=g.on_node_join,
            on_node_leave=g.on_node_leave,
            max_tasks_in_memory=1,
        )
        g.update_state = Mock()
        worker = Mock()
        g.on_node_join = Mock()
        g.on_node_leave = Mock()
        g.update_state.return_value = worker, 1
        message = Mock()
        message.delivery_info = {'routing_key': 'worker-online'}
        message.headers = {'hostname': 'other'}

        handler = g.event_handlers['worker-online'] = Mock()
        g.on_message(prepare, message)
        handler.assert_called_with(message.payload)
        g.event_handlers = {}

        g.on_message(prepare, message)

        message.delivery_info = {'routing_key': 'worker-offline'}
        prepare.return_value = 'worker-offline', {}
        g.on_message(prepare, message)

        message.delivery_info = {'routing_key': 'worker-baz'}
        prepare.return_value = 'worker-baz', {}
        g.update_state.return_value = worker, 0
        g.on_message(prepare, message)

        message.headers = {'hostname': g.hostname}
        g.on_message(prepare, message)
        g.clock.forward.assert_called_with()
