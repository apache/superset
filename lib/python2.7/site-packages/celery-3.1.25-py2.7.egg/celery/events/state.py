# -*- coding: utf-8 -*-
"""
    celery.events.state
    ~~~~~~~~~~~~~~~~~~~

    This module implements a datastructure used to keep
    track of the state of a cluster of workers and the tasks
    it is working on (by consuming events).

    For every event consumed the state is updated,
    so the state represents the state of the cluster
    at the time of the last event.

    Snapshots (:mod:`celery.events.snapshot`) can be used to
    take "pictures" of this state at regular intervals
    to e.g. store that in a database.

"""
from __future__ import absolute_import

import bisect
import sys
import threading

from datetime import datetime
from decimal import Decimal
from itertools import islice
from operator import itemgetter
from time import time
from weakref import ref

from kombu.clocks import timetuple
from kombu.utils import cached_property, kwdict

from celery import states
from celery.five import class_property, items, values
from celery.utils import deprecated
from celery.utils.functional import LRUCache, memoize
from celery.utils.log import get_logger

PYPY = hasattr(sys, 'pypy_version_info')

# The window (in percentage) is added to the workers heartbeat
# frequency.  If the time between updates exceeds this window,
# then the worker is considered to be offline.
HEARTBEAT_EXPIRE_WINDOW = 200

# Max drift between event timestamp and time of event received
# before we alert that clocks may be unsynchronized.
HEARTBEAT_DRIFT_MAX = 16

DRIFT_WARNING = """\
Substantial drift from %s may mean clocks are out of sync.  Current drift is
%s seconds.  [orig: %s recv: %s]
"""

CAN_KWDICT = sys.version_info >= (2, 6, 5)

logger = get_logger(__name__)
warn = logger.warning

R_STATE = '<State: events={0.event_count} tasks={0.task_count}>'
R_WORKER = '<Worker: {0.hostname} ({0.status_string} clock:{0.clock})'
R_TASK = '<Task: {0.name}({0.uuid}) {0.state} clock:{0.clock}>'

__all__ = ['Worker', 'Task', 'State', 'heartbeat_expires']


@memoize(maxsize=1000, keyfun=lambda a, _: a[0])
def _warn_drift(hostname, drift, local_received, timestamp):
    # we use memoize here so the warning is only logged once per hostname
    warn(DRIFT_WARNING, hostname, drift,
         datetime.fromtimestamp(local_received),
         datetime.fromtimestamp(timestamp))


def heartbeat_expires(timestamp, freq=60,
                      expire_window=HEARTBEAT_EXPIRE_WINDOW,
                      Decimal=Decimal, float=float, isinstance=isinstance):
    # some json implementations returns decimal.Decimal objects,
    # which are not compatible with float.
    freq = float(freq) if isinstance(freq, Decimal) else freq
    if isinstance(timestamp, Decimal):
        timestamp = float(timestamp)
    return timestamp + (freq * (expire_window / 1e2))


def _depickle_task(cls, fields):
    return cls(**(fields if CAN_KWDICT else kwdict(fields)))


def with_unique_field(attr):

    def _decorate_cls(cls):

        def __eq__(this, other):
            if isinstance(other, this.__class__):
                return getattr(this, attr) == getattr(other, attr)
            return NotImplemented
        cls.__eq__ = __eq__

        def __ne__(this, other):
            return not this.__eq__(other)
        cls.__ne__ = __ne__

        def __hash__(this):
            return hash(getattr(this, attr))
        cls.__hash__ = __hash__

        return cls
    return _decorate_cls


@with_unique_field('hostname')
class Worker(object):
    """Worker State."""
    heartbeat_max = 4
    expire_window = HEARTBEAT_EXPIRE_WINDOW

    _fields = ('hostname', 'pid', 'freq', 'heartbeats', 'clock',
               'active', 'processed', 'loadavg', 'sw_ident',
               'sw_ver', 'sw_sys')
    if not PYPY:
        __slots__ = _fields + ('event', '__dict__', '__weakref__')

    def __init__(self, hostname=None, pid=None, freq=60,
                 heartbeats=None, clock=0, active=None, processed=None,
                 loadavg=None, sw_ident=None, sw_ver=None, sw_sys=None):
        self.hostname = hostname
        self.pid = pid
        self.freq = freq
        self.heartbeats = [] if heartbeats is None else heartbeats
        self.clock = clock or 0
        self.active = active
        self.processed = processed
        self.loadavg = loadavg
        self.sw_ident = sw_ident
        self.sw_ver = sw_ver
        self.sw_sys = sw_sys
        self.event = self._create_event_handler()

    def __reduce__(self):
        return self.__class__, (self.hostname, self.pid, self.freq,
                                self.heartbeats, self.clock, self.active,
                                self.processed, self.loadavg, self.sw_ident,
                                self.sw_ver, self.sw_sys)

    def _create_event_handler(self):
        _set = object.__setattr__
        hbmax = self.heartbeat_max
        heartbeats = self.heartbeats
        hb_pop = self.heartbeats.pop
        hb_append = self.heartbeats.append

        def event(type_, timestamp=None,
                  local_received=None, fields=None,
                  max_drift=HEARTBEAT_DRIFT_MAX, items=items, abs=abs, int=int,
                  insort=bisect.insort, len=len):
            fields = fields or {}
            for k, v in items(fields):
                _set(self, k, v)
            if type_ == 'offline':
                heartbeats[:] = []
            else:
                if not local_received or not timestamp:
                    return
                drift = abs(int(local_received) - int(timestamp))
                if drift > HEARTBEAT_DRIFT_MAX:
                    _warn_drift(self.hostname, drift,
                                local_received, timestamp)
                if local_received:
                    hearts = len(heartbeats)
                    if hearts > hbmax - 1:
                        hb_pop(0)
                    if hearts and local_received > heartbeats[-1]:
                        hb_append(local_received)
                    else:
                        insort(heartbeats, local_received)
        return event

    def update(self, f, **kw):
        for k, v in items(dict(f, **kw) if kw else f):
            setattr(self, k, v)

    def __repr__(self):
        return R_WORKER.format(self)

    @property
    def status_string(self):
        return 'ONLINE' if self.alive else 'OFFLINE'

    @property
    def heartbeat_expires(self):
        return heartbeat_expires(self.heartbeats[-1],
                                 self.freq, self.expire_window)

    @property
    def alive(self, nowfun=time):
        return bool(self.heartbeats and nowfun() < self.heartbeat_expires)

    @property
    def id(self):
        return '{0.hostname}.{0.pid}'.format(self)

    @deprecated(3.2, 3.3)
    def update_heartbeat(self, received, timestamp):
        self.event(None, timestamp, received)

    @deprecated(3.2, 3.3)
    def on_online(self, timestamp=None, local_received=None, **fields):
        self.event('online', timestamp, local_received, fields)

    @deprecated(3.2, 3.3)
    def on_offline(self, timestamp=None, local_received=None, **fields):
        self.event('offline', timestamp, local_received, fields)

    @deprecated(3.2, 3.3)
    def on_heartbeat(self, timestamp=None, local_received=None, **fields):
        self.event('heartbeat', timestamp, local_received, fields)

    @class_property
    def _defaults(cls):
        """Deprecated, to be removed in 3.3"""
        source = cls()
        return dict((k, getattr(source, k)) for k in cls._fields)


@with_unique_field('uuid')
class Task(object):
    """Task State."""
    name = received = sent = started = succeeded = failed = retried = \
        revoked = args = kwargs = eta = expires = retries = worker = result = \
        exception = timestamp = runtime = traceback = exchange = \
        routing_key = client = None
    state = states.PENDING
    clock = 0

    _fields = ('uuid', 'name', 'state', 'received', 'sent', 'started',
               'succeeded', 'failed', 'retried', 'revoked', 'args', 'kwargs',
               'eta', 'expires', 'retries', 'worker', 'result', 'exception',
               'timestamp', 'runtime', 'traceback', 'exchange', 'routing_key',
               'clock', 'client')
    if not PYPY:
        __slots__ = ('__dict__', '__weakref__')

    #: How to merge out of order events.
    #: Disorder is detected by logical ordering (e.g. :event:`task-received`
    #: must have happened before a :event:`task-failed` event).
    #:
    #: A merge rule consists of a state and a list of fields to keep from
    #: that state. ``(RECEIVED, ('name', 'args')``, means the name and args
    #: fields are always taken from the RECEIVED state, and any values for
    #: these fields received before or after is simply ignored.
    merge_rules = {states.RECEIVED: ('name', 'args', 'kwargs',
                                     'retries', 'eta', 'expires')}

    #: meth:`info` displays these fields by default.
    _info_fields = ('args', 'kwargs', 'retries', 'result', 'eta', 'runtime',
                    'expires', 'exception', 'exchange', 'routing_key')

    def __init__(self, uuid=None, **kwargs):
        self.uuid = uuid
        if kwargs:
            for k, v in items(kwargs):
                setattr(self, k, v)

    def event(self, type_, timestamp=None, local_received=None, fields=None,
              precedence=states.precedence, items=items, dict=dict,
              PENDING=states.PENDING, RECEIVED=states.RECEIVED,
              STARTED=states.STARTED, FAILURE=states.FAILURE,
              RETRY=states.RETRY, SUCCESS=states.SUCCESS,
              REVOKED=states.REVOKED):
        fields = fields or {}
        if type_ == 'sent':
            state, self.sent = PENDING, timestamp
        elif type_ == 'received':
            state, self.received = RECEIVED, timestamp
        elif type_ == 'started':
            state, self.started = STARTED, timestamp
        elif type_ == 'failed':
            state, self.failed = FAILURE, timestamp
        elif type_ == 'retried':
            state, self.retried = RETRY, timestamp
        elif type_ == 'succeeded':
            state, self.succeeded = SUCCESS, timestamp
        elif type_ == 'revoked':
            state, self.revoked = REVOKED, timestamp
        else:
            state = type_.upper()

        # note that precedence here is reversed
        # see implementation in celery.states.state.__lt__
        if state != RETRY and self.state != RETRY and \
                precedence(state) > precedence(self.state):
            # this state logically happens-before the current state, so merge.
            keep = self.merge_rules.get(state)
            if keep is not None:
                fields = dict(
                    (k, v) for k, v in items(fields) if k in keep
                )
            for key, value in items(fields):
                setattr(self, key, value)
        else:
            self.state = state
            self.timestamp = timestamp
            for key, value in items(fields):
                setattr(self, key, value)

    def info(self, fields=None, extra=[]):
        """Information about this task suitable for on-screen display."""
        fields = self._info_fields if fields is None else fields

        def _keys():
            for key in list(fields) + list(extra):
                value = getattr(self, key, None)
                if value is not None:
                    yield key, value

        return dict(_keys())

    def __repr__(self):
        return R_TASK.format(self)

    def as_dict(self):
        get = object.__getattribute__
        return dict(
            (k, get(self, k)) for k in self._fields
        )

    def __reduce__(self):
        return _depickle_task, (self.__class__, self.as_dict())

    @property
    def origin(self):
        return self.client if self.worker is None else self.worker.id

    @property
    def ready(self):
        return self.state in states.READY_STATES

    @deprecated(3.2, 3.3)
    def on_sent(self, timestamp=None, **fields):
        self.event('sent', timestamp, fields)

    @deprecated(3.2, 3.3)
    def on_received(self, timestamp=None, **fields):
        self.event('received', timestamp, fields)

    @deprecated(3.2, 3.3)
    def on_started(self, timestamp=None, **fields):
        self.event('started', timestamp, fields)

    @deprecated(3.2, 3.3)
    def on_failed(self, timestamp=None, **fields):
        self.event('failed', timestamp, fields)

    @deprecated(3.2, 3.3)
    def on_retried(self, timestamp=None, **fields):
        self.event('retried', timestamp, fields)

    @deprecated(3.2, 3.3)
    def on_succeeded(self, timestamp=None, **fields):
        self.event('succeeded', timestamp, fields)

    @deprecated(3.2, 3.3)
    def on_revoked(self, timestamp=None, **fields):
        self.event('revoked', timestamp, fields)

    @deprecated(3.2, 3.3)
    def on_unknown_event(self, shortype, timestamp=None, **fields):
        self.event(shortype, timestamp, fields)

    @deprecated(3.2, 3.3)
    def update(self, state, timestamp, fields,
               _state=states.state, RETRY=states.RETRY):
        return self.event(state, timestamp, None, fields)

    @deprecated(3.2, 3.3)
    def merge(self, state, timestamp, fields):
        keep = self.merge_rules.get(state)
        if keep is not None:
            fields = dict((k, v) for k, v in items(fields) if k in keep)
        for key, value in items(fields):
            setattr(self, key, value)

    @class_property
    def _defaults(cls):
        """Deprecated, to be removed in 3.3."""
        source = cls()
        return dict((k, getattr(source, k)) for k in source._fields)


class State(object):
    """Records clusters state."""
    Worker = Worker
    Task = Task
    event_count = 0
    task_count = 0
    heap_multiplier = 4

    def __init__(self, callback=None,
                 workers=None, tasks=None, taskheap=None,
                 max_workers_in_memory=5000, max_tasks_in_memory=10000,
                 on_node_join=None, on_node_leave=None):
        self.event_callback = callback
        self.workers = (LRUCache(max_workers_in_memory)
                        if workers is None else workers)
        self.tasks = (LRUCache(max_tasks_in_memory)
                      if tasks is None else tasks)
        self._taskheap = [] if taskheap is None else taskheap
        self.max_workers_in_memory = max_workers_in_memory
        self.max_tasks_in_memory = max_tasks_in_memory
        self.on_node_join = on_node_join
        self.on_node_leave = on_node_leave
        self._mutex = threading.Lock()
        self.handlers = {}
        self._seen_types = set()
        self.rebuild_taskheap()

    @cached_property
    def _event(self):
        return self._create_dispatcher()

    def freeze_while(self, fun, *args, **kwargs):
        clear_after = kwargs.pop('clear_after', False)
        with self._mutex:
            try:
                return fun(*args, **kwargs)
            finally:
                if clear_after:
                    self._clear()

    def clear_tasks(self, ready=True):
        with self._mutex:
            return self._clear_tasks(ready)

    def _clear_tasks(self, ready=True):
        if ready:
            in_progress = dict(
                (uuid, task) for uuid, task in self.itertasks()
                if task.state not in states.READY_STATES)
            self.tasks.clear()
            self.tasks.update(in_progress)
        else:
            self.tasks.clear()
        self._taskheap[:] = []

    def _clear(self, ready=True):
        self.workers.clear()
        self._clear_tasks(ready)
        self.event_count = 0
        self.task_count = 0

    def clear(self, ready=True):
        with self._mutex:
            return self._clear(ready)

    def get_or_create_worker(self, hostname, **kwargs):
        """Get or create worker by hostname.

        Return tuple of ``(worker, was_created)``.
        """
        try:
            worker = self.workers[hostname]
            if kwargs:
                worker.update(kwargs)
            return worker, False
        except KeyError:
            worker = self.workers[hostname] = self.Worker(
                hostname, **kwargs)
            return worker, True

    def get_or_create_task(self, uuid):
        """Get or create task by uuid."""
        try:
            return self.tasks[uuid], False
        except KeyError:
            task = self.tasks[uuid] = self.Task(uuid)
            return task, True

    def event(self, event):
        with self._mutex:
            return self._event(event)

    def task_event(self, type_, fields):
        """Deprecated, use :meth:`event`."""
        return self._event(dict(fields, type='-'.join(['task', type_])))[0]

    def worker_event(self, type_, fields):
        """Deprecated, use :meth:`event`."""
        return self._event(dict(fields, type='-'.join(['worker', type_])))[0]

    def _create_dispatcher(self):
        get_handler = self.handlers.__getitem__
        event_callback = self.event_callback
        wfields = itemgetter('hostname', 'timestamp', 'local_received')
        tfields = itemgetter('uuid', 'hostname', 'timestamp',
                             'local_received', 'clock')
        taskheap = self._taskheap
        th_append = taskheap.append
        th_pop = taskheap.pop
        # Removing events from task heap is an O(n) operation,
        # so easier to just account for the common number of events
        # for each task (PENDING->RECEIVED->STARTED->final)
        #: an O(n) operation
        max_events_in_heap = self.max_tasks_in_memory * self.heap_multiplier
        add_type = self._seen_types.add
        on_node_join, on_node_leave = self.on_node_join, self.on_node_leave
        tasks, Task = self.tasks, self.Task
        workers, Worker = self.workers, self.Worker
        # avoid updating LRU entry at getitem
        get_worker, get_task = workers.data.__getitem__, tasks.data.__getitem__

        def _event(event,
                   timetuple=timetuple, KeyError=KeyError,
                   insort=bisect.insort, created=True):
            self.event_count += 1
            if event_callback:
                event_callback(self, event)
            group, _, subject = event['type'].partition('-')
            try:
                handler = get_handler(group)
            except KeyError:
                pass
            else:
                return handler(subject, event), subject

            if group == 'worker':
                try:
                    hostname, timestamp, local_received = wfields(event)
                except KeyError:
                    pass
                else:
                    is_offline = subject == 'offline'
                    try:
                        worker, created = get_worker(hostname), False
                    except KeyError:
                        if is_offline:
                            worker, created = Worker(hostname), False
                        else:
                            worker = workers[hostname] = Worker(hostname)
                    worker.event(subject, timestamp, local_received, event)
                    if on_node_join and (created or subject == 'online'):
                        on_node_join(worker)
                    if on_node_leave and is_offline:
                        on_node_leave(worker)
                        workers.pop(hostname, None)
                    return (worker, created), subject
            elif group == 'task':
                (uuid, hostname, timestamp,
                 local_received, clock) = tfields(event)
                # task-sent event is sent by client, not worker
                is_client_event = subject == 'sent'
                try:
                    task, created = get_task(uuid), False
                except KeyError:
                    task = tasks[uuid] = Task(uuid)
                if is_client_event:
                    task.client = hostname
                else:
                    try:
                        worker, created = get_worker(hostname), False
                    except KeyError:
                        worker = workers[hostname] = Worker(hostname)
                    task.worker = worker
                    if worker is not None and local_received:
                        worker.event(None, local_received, timestamp)

                origin = hostname if is_client_event else worker.id

                # remove oldest event if exceeding the limit.
                heaps = len(taskheap)
                if heaps + 1 > max_events_in_heap:
                    th_pop(0)

                # most events will be dated later than the previous.
                timetup = timetuple(clock, timestamp, origin, ref(task))
                if heaps and timetup > taskheap[-1]:
                    th_append(timetup)
                else:
                    insort(taskheap, timetup)

                if subject == 'received':
                    self.task_count += 1
                task.event(subject, timestamp, local_received, event)
                task_name = task.name
                if task_name is not None:
                    add_type(task_name)
                return (task, created), subject
        return _event

    def rebuild_taskheap(self, timetuple=timetuple):
        heap = self._taskheap[:] = [
            timetuple(t.clock, t.timestamp, t.origin, ref(t))
            for t in values(self.tasks)
        ]
        heap.sort()

    def itertasks(self, limit=None):
        for index, row in enumerate(items(self.tasks)):
            yield row
            if limit and index + 1 >= limit:
                break

    def tasks_by_time(self, limit=None):
        """Generator giving tasks ordered by time,
        in ``(uuid, Task)`` tuples."""
        seen = set()
        for evtup in islice(reversed(self._taskheap), 0, limit):
            task = evtup[3]()
            if task is not None:
                uuid = task.uuid
                if uuid not in seen:
                    yield uuid, task
                    seen.add(uuid)
    tasks_by_timestamp = tasks_by_time

    def tasks_by_type(self, name, limit=None):
        """Get all tasks by type.

        Return a list of ``(uuid, Task)`` tuples.

        """
        return islice(
            ((uuid, task) for uuid, task in self.tasks_by_time()
             if task.name == name),
            0, limit,
        )

    def tasks_by_worker(self, hostname, limit=None):
        """Get all tasks by worker.

        """
        return islice(
            ((uuid, task) for uuid, task in self.tasks_by_time()
             if task.worker.hostname == hostname),
            0, limit,
        )

    def task_types(self):
        """Return a list of all seen task types."""
        return sorted(self._seen_types)

    def alive_workers(self):
        """Return a list of (seemingly) alive workers."""
        return [w for w in values(self.workers) if w.alive]

    def __repr__(self):
        return R_STATE.format(self)

    def __reduce__(self):
        return self.__class__, (
            self.event_callback, self.workers, self.tasks, None,
            self.max_workers_in_memory, self.max_tasks_in_memory,
            self.on_node_join, self.on_node_leave,
        )
