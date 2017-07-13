# -*- coding: utf-8 -*-
"""
    celery.worker.state
    ~~~~~~~~~~~~~~~~~~~

    Internal worker state (global)

    This includes the currently active and reserved tasks,
    statistics, and revoked tasks.

"""
from __future__ import absolute_import

import os
import sys
import platform
import shelve
import zlib

from kombu.serialization import pickle, pickle_protocol
from kombu.utils import cached_property

from celery import __version__
from celery.datastructures import LimitedSet
from celery.exceptions import WorkerShutdown, WorkerTerminate
from celery.five import Counter

__all__ = ['SOFTWARE_INFO', 'reserved_requests', 'active_requests',
           'total_count', 'revoked', 'task_reserved', 'maybe_shutdown',
           'task_accepted', 'task_ready', 'task_reserved', 'task_ready',
           'Persistent']

#: Worker software/platform information.
SOFTWARE_INFO = {'sw_ident': 'py-celery',
                 'sw_ver': __version__,
                 'sw_sys': platform.system()}

#: maximum number of revokes to keep in memory.
REVOKES_MAX = 50000

#: how many seconds a revoke will be active before
#: being expired when the max limit has been exceeded.
REVOKE_EXPIRES = 10800

#: set of all reserved :class:`~celery.worker.job.Request`'s.
reserved_requests = set()

#: set of currently active :class:`~celery.worker.job.Request`'s.
active_requests = set()

#: count of tasks accepted by the worker, sorted by type.
total_count = Counter()

#: count of all tasks accepted by the worker
all_total_count = [0]

#: the list of currently revoked tasks.  Persistent if statedb set.
revoked = LimitedSet(maxlen=REVOKES_MAX, expires=REVOKE_EXPIRES)

#: Update global state when a task has been reserved.
task_reserved = reserved_requests.add

should_stop = False
should_terminate = False


def reset_state():
    reserved_requests.clear()
    active_requests.clear()
    total_count.clear()
    all_total_count[:] = [0]
    revoked.clear()


def maybe_shutdown():
    if should_stop:
        raise WorkerShutdown()
    elif should_terminate:
        raise WorkerTerminate()


def task_accepted(request, _all_total_count=all_total_count):
    """Updates global state when a task has been accepted."""
    active_requests.add(request)
    total_count[request.name] += 1
    all_total_count[0] += 1


def task_ready(request):
    """Updates global state when a task is ready."""
    active_requests.discard(request)
    reserved_requests.discard(request)


C_BENCH = os.environ.get('C_BENCH') or os.environ.get('CELERY_BENCH')
C_BENCH_EVERY = int(os.environ.get('C_BENCH_EVERY') or
                    os.environ.get('CELERY_BENCH_EVERY') or 1000)
if C_BENCH:  # pragma: no cover
    import atexit

    from billiard import current_process
    from celery.five import monotonic
    from celery.utils.debug import memdump, sample_mem

    all_count = 0
    bench_first = None
    bench_start = None
    bench_last = None
    bench_every = C_BENCH_EVERY
    bench_sample = []
    __reserved = task_reserved
    __ready = task_ready

    if current_process()._name == 'MainProcess':
        @atexit.register
        def on_shutdown():
            if bench_first is not None and bench_last is not None:
                print('- Time spent in benchmark: {0!r}'.format(
                      bench_last - bench_first))
                print('- Avg: {0}'.format(
                      sum(bench_sample) / len(bench_sample)))
                memdump()

    def task_reserved(request):  # noqa
        global bench_start
        global bench_first
        now = None
        if bench_start is None:
            bench_start = now = monotonic()
        if bench_first is None:
            bench_first = now

        return __reserved(request)

    def task_ready(request):  # noqa
        global all_count
        global bench_start
        global bench_last
        all_count += 1
        if not all_count % bench_every:
            now = monotonic()
            diff = now - bench_start
            print('- Time spent processing {0} tasks (since first '
                  'task received): ~{1:.4f}s\n'.format(bench_every, diff))
            sys.stdout.flush()
            bench_start = bench_last = now
            bench_sample.append(diff)
            sample_mem()
        return __ready(request)


class Persistent(object):
    """This is the persistent data stored by the worker when
    :option:`--statedb` is enabled.

    It currently only stores revoked task id's.

    """
    storage = shelve
    protocol = pickle_protocol
    compress = zlib.compress
    decompress = zlib.decompress
    _is_open = False

    def __init__(self, state, filename, clock=None):
        self.state = state
        self.filename = filename
        self.clock = clock
        self.merge()

    def open(self):
        return self.storage.open(
            self.filename, protocol=self.protocol, writeback=True,
        )

    def merge(self):
        self._merge_with(self.db)

    def sync(self):
        self._sync_with(self.db)
        self.db.sync()

    def close(self):
        if self._is_open:
            self.db.close()
            self._is_open = False

    def save(self):
        self.sync()
        self.close()

    def _merge_with(self, d):
        self._merge_revoked(d)
        self._merge_clock(d)
        return d

    def _sync_with(self, d):
        self._revoked_tasks.purge()
        d.update(
            __proto__=3,
            zrevoked=self.compress(self._dumps(self._revoked_tasks)),
            clock=self.clock.forward() if self.clock else 0,
        )
        return d

    def _merge_clock(self, d):
        if self.clock:
            d['clock'] = self.clock.adjust(d.get('clock') or 0)

    def _merge_revoked(self, d):
        try:
            self._merge_revoked_v3(d['zrevoked'])
        except KeyError:
            try:
                self._merge_revoked_v2(d.pop('revoked'))
            except KeyError:
                pass
        # purge expired items at boot
        self._revoked_tasks.purge()

    def _merge_revoked_v3(self, zrevoked):
        if zrevoked:
            self._revoked_tasks.update(pickle.loads(self.decompress(zrevoked)))

    def _merge_revoked_v2(self, saved):
        if not isinstance(saved, LimitedSet):
            # (pre 3.0.18) used to be stored as a dict
            return self._merge_revoked_v1(saved)
        self._revoked_tasks.update(saved)

    def _merge_revoked_v1(self, saved):
        add = self._revoked_tasks.add
        for item in saved:
            add(item)

    def _dumps(self, obj):
        return pickle.dumps(obj, protocol=self.protocol)

    @property
    def _revoked_tasks(self):
        return self.state.revoked

    @cached_property
    def db(self):
        self._is_open = True
        return self.open()
