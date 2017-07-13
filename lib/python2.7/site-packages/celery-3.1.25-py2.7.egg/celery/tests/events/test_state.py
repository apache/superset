from __future__ import absolute_import

import pickle

from decimal import Decimal
from random import shuffle
from time import time
from itertools import count

from celery import states
from celery.events import Event
from celery.events.state import (
    State,
    Worker,
    Task,
    HEARTBEAT_EXPIRE_WINDOW,
    HEARTBEAT_DRIFT_MAX,
)
from celery.five import range
from celery.utils import uuid
from celery.tests.case import AppCase, Mock, patch

try:
    Decimal(2.6)
except TypeError:  # pragma: no cover
    # Py2.6: Must first convert float to str
    _float_to_decimal = str
else:
    def _float_to_decimal(f):  # noqa
        return f


class replay(object):

    def __init__(self, state):
        self.state = state
        self.rewind()
        self.setup()
        self.current_clock = 0

    def setup(self):
        pass

    def next_event(self):
        ev = self.events[next(self.position)]
        ev['local_received'] = ev['timestamp']
        try:
            self.current_clock = ev['clock']
        except KeyError:
            ev['clock'] = self.current_clock = self.current_clock + 1
        return ev

    def __iter__(self):
        return self

    def __next__(self):
        try:
            self.state.event(self.next_event())
        except IndexError:
            raise StopIteration()
    next = __next__

    def rewind(self):
        self.position = count(0)
        return self

    def play(self):
        for _ in self:
            pass


class ev_worker_online_offline(replay):

    def setup(self):
        self.events = [
            Event('worker-online', hostname='utest1'),
            Event('worker-offline', hostname='utest1'),
        ]


class ev_worker_heartbeats(replay):

    def setup(self):
        self.events = [
            Event('worker-heartbeat', hostname='utest1',
                  timestamp=time() - HEARTBEAT_EXPIRE_WINDOW * 2),
            Event('worker-heartbeat', hostname='utest1'),
        ]


class ev_task_states(replay):

    def setup(self):
        tid = self.tid = uuid()
        self.events = [
            Event('task-received', uuid=tid, name='task1',
                  args='(2, 2)', kwargs="{'foo': 'bar'}",
                  retries=0, eta=None, hostname='utest1'),
            Event('task-started', uuid=tid, hostname='utest1'),
            Event('task-revoked', uuid=tid, hostname='utest1'),
            Event('task-retried', uuid=tid, exception="KeyError('bar')",
                  traceback='line 2 at main', hostname='utest1'),
            Event('task-failed', uuid=tid, exception="KeyError('foo')",
                  traceback='line 1 at main', hostname='utest1'),
            Event('task-succeeded', uuid=tid, result='4',
                  runtime=0.1234, hostname='utest1'),
        ]


def QTEV(type, uuid, hostname, clock, name=None, timestamp=None):
    """Quick task event."""
    return Event('task-{0}'.format(type), uuid=uuid, hostname=hostname,
                 clock=clock, name=name, timestamp=timestamp or time())


class ev_logical_clock_ordering(replay):

    def __init__(self, state, offset=0, uids=None):
        self.offset = offset or 0
        self.uids = self.setuids(uids)
        super(ev_logical_clock_ordering, self).__init__(state)

    def setuids(self, uids):
        uids = self.tA, self.tB, self.tC = uids or [uuid(), uuid(), uuid()]
        return uids

    def setup(self):
        offset = self.offset
        tA, tB, tC = self.uids
        self.events = [
            QTEV('received', tA, 'w1', name='tA', clock=offset + 1),
            QTEV('received', tB, 'w2', name='tB', clock=offset + 1),
            QTEV('started', tA, 'w1', name='tA', clock=offset + 3),
            QTEV('received', tC, 'w2', name='tC', clock=offset + 3),
            QTEV('started', tB, 'w2', name='tB', clock=offset + 5),
            QTEV('retried', tA, 'w1', name='tA', clock=offset + 7),
            QTEV('succeeded', tB, 'w2', name='tB', clock=offset + 9),
            QTEV('started', tC, 'w2', name='tC', clock=offset + 10),
            QTEV('received', tA, 'w3', name='tA', clock=offset + 13),
            QTEV('succeded', tC, 'w2', name='tC', clock=offset + 12),
            QTEV('started', tA, 'w3', name='tA', clock=offset + 14),
            QTEV('succeeded', tA, 'w3', name='TA', clock=offset + 16),
        ]

    def rewind_with_offset(self, offset, uids=None):
        self.offset = offset
        self.uids = self.setuids(uids or self.uids)
        self.setup()
        self.rewind()


class ev_snapshot(replay):

    def setup(self):
        self.events = [
            Event('worker-online', hostname='utest1'),
            Event('worker-online', hostname='utest2'),
            Event('worker-online', hostname='utest3'),
        ]
        for i in range(20):
            worker = not i % 2 and 'utest2' or 'utest1'
            type = not i % 2 and 'task2' or 'task1'
            self.events.append(Event('task-received', name=type,
                               uuid=uuid(), hostname=worker))


class test_Worker(AppCase):

    def test_equality(self):
        self.assertEqual(Worker(hostname='foo').hostname, 'foo')
        self.assertEqual(
            Worker(hostname='foo'), Worker(hostname='foo'),
        )
        self.assertNotEqual(
            Worker(hostname='foo'), Worker(hostname='bar'),
        )
        self.assertEqual(
            hash(Worker(hostname='foo')), hash(Worker(hostname='foo')),
        )
        self.assertNotEqual(
            hash(Worker(hostname='foo')), hash(Worker(hostname='bar')),
        )

    def test_compatible_with_Decimal(self):
        w = Worker('george@vandelay.com')
        timestamp, local_received = Decimal(_float_to_decimal(time())), time()
        w.event('worker-online', timestamp, local_received, fields={
            'hostname': 'george@vandelay.com',
            'timestamp': timestamp,
            'local_received': local_received,
            'freq': Decimal(_float_to_decimal(5.6335431)),
        })
        self.assertTrue(w.alive)

    def test_survives_missing_timestamp(self):
        worker = Worker(hostname='foo')
        worker.event('heartbeat')
        self.assertEqual(worker.heartbeats, [])

    def test_repr(self):
        self.assertTrue(repr(Worker(hostname='foo')))

    def test_drift_warning(self):
        worker = Worker(hostname='foo')
        with patch('celery.events.state.warn') as warn:
            worker.event(None, time() + (HEARTBEAT_DRIFT_MAX * 2), time())
            self.assertTrue(warn.called)
            self.assertIn('Substantial drift', warn.call_args[0][0])

    def test_updates_heartbeat(self):
        worker = Worker(hostname='foo')
        worker.event(None, time(), time())
        self.assertEqual(len(worker.heartbeats), 1)
        h1 = worker.heartbeats[0]
        worker.event(None, time(), time() - 10)
        self.assertEqual(len(worker.heartbeats), 2)
        self.assertEqual(worker.heartbeats[-1], h1)


class test_Task(AppCase):

    def test_equality(self):
        self.assertEqual(Task(uuid='foo').uuid, 'foo')
        self.assertEqual(
            Task(uuid='foo'), Task(uuid='foo'),
        )
        self.assertNotEqual(
            Task(uuid='foo'), Task(uuid='bar'),
        )
        self.assertEqual(
            hash(Task(uuid='foo')), hash(Task(uuid='foo')),
        )
        self.assertNotEqual(
            hash(Task(uuid='foo')), hash(Task(uuid='bar')),
        )

    def test_info(self):
        task = Task(uuid='abcdefg',
                    name='tasks.add',
                    args='(2, 2)',
                    kwargs='{}',
                    retries=2,
                    result=42,
                    eta=1,
                    runtime=0.0001,
                    expires=1,
                    foo=None,
                    exception=1,
                    received=time() - 10,
                    started=time() - 8,
                    exchange='celery',
                    routing_key='celery',
                    succeeded=time())
        self.assertEqual(sorted(list(task._info_fields)),
                         sorted(task.info().keys()))

        self.assertEqual(sorted(list(task._info_fields + ('received', ))),
                         sorted(task.info(extra=('received', ))))

        self.assertEqual(sorted(['args', 'kwargs']),
                         sorted(task.info(['args', 'kwargs']).keys()))
        self.assertFalse(list(task.info('foo')))

    def test_ready(self):
        task = Task(uuid='abcdefg',
                    name='tasks.add')
        task.event('received', time(), time())
        self.assertFalse(task.ready)
        task.event('succeeded', time(), time())
        self.assertTrue(task.ready)

    def test_sent(self):
        task = Task(uuid='abcdefg',
                    name='tasks.add')
        task.event('sent', time(), time())
        self.assertEqual(task.state, states.PENDING)

    def test_merge(self):
        task = Task()
        task.event('failed', time(), time())
        task.event('started', time(), time())
        task.event('received', time(), time(), {
            'name': 'tasks.add', 'args': (2, 2),
        })
        self.assertEqual(task.state, states.FAILURE)
        self.assertEqual(task.name, 'tasks.add')
        self.assertTupleEqual(task.args, (2, 2))
        task.event('retried', time(), time())
        self.assertEqual(task.state, states.RETRY)

    def test_repr(self):
        self.assertTrue(repr(Task(uuid='xxx', name='tasks.add')))


class test_State(AppCase):

    def test_repr(self):
        self.assertTrue(repr(State()))

    def test_pickleable(self):
        self.assertTrue(pickle.loads(pickle.dumps(State())))

    def test_task_logical_clock_ordering(self):
        state = State()
        r = ev_logical_clock_ordering(state)
        tA, tB, tC = r.uids
        r.play()
        now = list(state.tasks_by_time())
        self.assertEqual(now[0][0], tA)
        self.assertEqual(now[1][0], tC)
        self.assertEqual(now[2][0], tB)
        for _ in range(1000):
            shuffle(r.uids)
            tA, tB, tC = r.uids
            r.rewind_with_offset(r.current_clock + 1, r.uids)
            r.play()
        now = list(state.tasks_by_time())
        self.assertEqual(now[0][0], tA)
        self.assertEqual(now[1][0], tC)
        self.assertEqual(now[2][0], tB)

    def test_worker_online_offline(self):
        r = ev_worker_online_offline(State())
        next(r)
        self.assertTrue(r.state.alive_workers())
        self.assertTrue(r.state.workers['utest1'].alive)
        r.play()
        self.assertFalse(r.state.alive_workers())
        self.assertFalse(r.state.workers['utest1'].alive)

    def test_itertasks(self):
        s = State()
        s.tasks = {'a': 'a', 'b': 'b', 'c': 'c', 'd': 'd'}
        self.assertEqual(len(list(s.itertasks(limit=2))), 2)

    def test_worker_heartbeat_expire(self):
        r = ev_worker_heartbeats(State())
        next(r)
        self.assertFalse(r.state.alive_workers())
        self.assertFalse(r.state.workers['utest1'].alive)
        r.play()
        self.assertTrue(r.state.alive_workers())
        self.assertTrue(r.state.workers['utest1'].alive)

    def test_task_states(self):
        r = ev_task_states(State())

        # RECEIVED
        next(r)
        self.assertTrue(r.tid in r.state.tasks)
        task = r.state.tasks[r.tid]
        self.assertEqual(task.state, states.RECEIVED)
        self.assertTrue(task.received)
        self.assertEqual(task.timestamp, task.received)
        self.assertEqual(task.worker.hostname, 'utest1')

        # STARTED
        next(r)
        self.assertTrue(r.state.workers['utest1'].alive,
                        'any task event adds worker heartbeat')
        self.assertEqual(task.state, states.STARTED)
        self.assertTrue(task.started)
        self.assertEqual(task.timestamp, task.started)
        self.assertEqual(task.worker.hostname, 'utest1')

        # REVOKED
        next(r)
        self.assertEqual(task.state, states.REVOKED)
        self.assertTrue(task.revoked)
        self.assertEqual(task.timestamp, task.revoked)
        self.assertEqual(task.worker.hostname, 'utest1')

        # RETRY
        next(r)
        self.assertEqual(task.state, states.RETRY)
        self.assertTrue(task.retried)
        self.assertEqual(task.timestamp, task.retried)
        self.assertEqual(task.worker.hostname, 'utest1')
        self.assertEqual(task.exception, "KeyError('bar')")
        self.assertEqual(task.traceback, 'line 2 at main')

        # FAILURE
        next(r)
        self.assertEqual(task.state, states.FAILURE)
        self.assertTrue(task.failed)
        self.assertEqual(task.timestamp, task.failed)
        self.assertEqual(task.worker.hostname, 'utest1')
        self.assertEqual(task.exception, "KeyError('foo')")
        self.assertEqual(task.traceback, 'line 1 at main')

        # SUCCESS
        next(r)
        self.assertEqual(task.state, states.SUCCESS)
        self.assertTrue(task.succeeded)
        self.assertEqual(task.timestamp, task.succeeded)
        self.assertEqual(task.worker.hostname, 'utest1')
        self.assertEqual(task.result, '4')
        self.assertEqual(task.runtime, 0.1234)

    def assertStateEmpty(self, state):
        self.assertFalse(state.tasks)
        self.assertFalse(state.workers)
        self.assertFalse(state.event_count)
        self.assertFalse(state.task_count)

    def assertState(self, state):
        self.assertTrue(state.tasks)
        self.assertTrue(state.workers)
        self.assertTrue(state.event_count)
        self.assertTrue(state.task_count)

    def test_freeze_while(self):
        s = State()
        r = ev_snapshot(s)
        r.play()

        def work():
            pass

        s.freeze_while(work, clear_after=True)
        self.assertFalse(s.event_count)

        s2 = State()
        r = ev_snapshot(s2)
        r.play()
        s2.freeze_while(work, clear_after=False)
        self.assertTrue(s2.event_count)

    def test_clear_tasks(self):
        s = State()
        r = ev_snapshot(s)
        r.play()
        self.assertTrue(s.tasks)
        s.clear_tasks(ready=False)
        self.assertFalse(s.tasks)

    def test_clear(self):
        r = ev_snapshot(State())
        r.play()
        self.assertTrue(r.state.event_count)
        self.assertTrue(r.state.workers)
        self.assertTrue(r.state.tasks)
        self.assertTrue(r.state.task_count)

        r.state.clear()
        self.assertFalse(r.state.event_count)
        self.assertFalse(r.state.workers)
        self.assertTrue(r.state.tasks)
        self.assertFalse(r.state.task_count)

        r.state.clear(False)
        self.assertFalse(r.state.tasks)

    def test_task_types(self):
        r = ev_snapshot(State())
        r.play()
        self.assertEqual(sorted(r.state.task_types()), ['task1', 'task2'])

    def test_tasks_by_timestamp(self):
        r = ev_snapshot(State())
        r.play()
        self.assertEqual(len(list(r.state.tasks_by_timestamp())), 20)

    def test_tasks_by_type(self):
        r = ev_snapshot(State())
        r.play()
        self.assertEqual(len(list(r.state.tasks_by_type('task1'))), 10)
        self.assertEqual(len(list(r.state.tasks_by_type('task2'))), 10)

    def test_alive_workers(self):
        r = ev_snapshot(State())
        r.play()
        self.assertEqual(len(r.state.alive_workers()), 3)

    def test_tasks_by_worker(self):
        r = ev_snapshot(State())
        r.play()
        self.assertEqual(len(list(r.state.tasks_by_worker('utest1'))), 10)
        self.assertEqual(len(list(r.state.tasks_by_worker('utest2'))), 10)

    def test_survives_unknown_worker_event(self):
        s = State()
        s.event({
            'type': 'worker-unknown-event-xxx',
            'foo': 'bar',
        })
        s.event({
            'type': 'worker-unknown-event-xxx',
            'hostname': 'xxx',
            'foo': 'bar',
        })

    def test_survives_unknown_worker_leaving(self):
        s = State(on_node_leave=Mock(name='on_node_leave'))
        (worker, created), subject = s.event({
            'type': 'worker-offline',
            'hostname': 'unknown@vandelay.com',
            'timestamp': time(),
            'local_received': time(),
            'clock': 301030134894833,
        })
        self.assertEqual(worker, Worker('unknown@vandelay.com'))
        self.assertFalse(created)
        self.assertEqual(subject, 'offline')
        self.assertNotIn('unknown@vandelay.com', s.workers)
        s.on_node_leave.assert_called_with(worker)

    def test_on_node_join_callback(self):
        s = State(on_node_join=Mock(name='on_node_join'))
        (worker, created), subject = s.event({
            'type': 'worker-online',
            'hostname': 'george@vandelay.com',
            'timestamp': time(),
            'local_received': time(),
            'clock': 34314,
        })
        self.assertTrue(worker)
        self.assertTrue(created)
        self.assertEqual(subject, 'online')
        self.assertIn('george@vandelay.com', s.workers)
        s.on_node_join.assert_called_with(worker)

    def test_survives_unknown_task_event(self):
        s = State()
        s.event(
            {
                'type': 'task-unknown-event-xxx',
                'foo': 'bar',
                'uuid': 'x',
                'hostname': 'y',
                'timestamp': time(),
                'local_received': time(),
                'clock': 0,
            },
        )

    def test_limits_maxtasks(self):
        s = State(max_tasks_in_memory=1)
        s.heap_multiplier = 2
        s.event({
            'type': 'task-unknown-event-xxx',
            'foo': 'bar',
            'uuid': 'x',
            'hostname': 'y',
            'clock': 3,
            'timestamp': time(),
            'local_received': time(),
        })
        s.event({
            'type': 'task-unknown-event-xxx',
            'foo': 'bar',
            'uuid': 'y',
            'hostname': 'y',
            'clock': 4,
            'timestamp': time(),
            'local_received': time(),
        })
        s.event({
            'type': 'task-unknown-event-xxx',
            'foo': 'bar',
            'uuid': 'z',
            'hostname': 'y',
            'clock': 5,
            'timestamp': time(),
            'local_received': time(),
        })
        self.assertEqual(len(s._taskheap), 2)
        self.assertEqual(s._taskheap[0].clock, 4)
        self.assertEqual(s._taskheap[1].clock, 5)

        s._taskheap.append(s._taskheap[0])
        self.assertTrue(list(s.tasks_by_time()))

    def test_callback(self):
        scratch = {}

        def callback(state, event):
            scratch['recv'] = True

        s = State(callback=callback)
        s.event({'type': 'worker-online'})
        self.assertTrue(scratch.get('recv'))
