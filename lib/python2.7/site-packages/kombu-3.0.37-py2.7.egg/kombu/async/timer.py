# -*- coding: utf-8 -*-
"""
kombu.async.timer
=================

Timer scheduling Python callbacks.

"""
from __future__ import absolute_import

import heapq
import sys

from collections import namedtuple
from datetime import datetime
from functools import wraps
from time import time
from weakref import proxy as weakrefproxy

from kombu.five import monotonic
from kombu.log import get_logger
from kombu.utils.compat import timedelta_seconds

try:
    from pytz import utc
except ImportError:
    utc = None

DEFAULT_MAX_INTERVAL = 2
EPOCH = datetime.utcfromtimestamp(0).replace(tzinfo=utc)
IS_PYPY = hasattr(sys, 'pypy_version_info')

logger = get_logger(__name__)

__all__ = ['Entry', 'Timer', 'to_timestamp']

scheduled = namedtuple('scheduled', ('eta', 'priority', 'entry'))


def to_timestamp(d, default_timezone=utc):
    if isinstance(d, datetime):
        if d.tzinfo is None:
            d = d.replace(tzinfo=default_timezone)
        return timedelta_seconds(d - EPOCH)
    return d


class Entry(object):
    if not IS_PYPY:  # pragma: no cover
        __slots__ = (
            'fun', 'args', 'kwargs', 'tref', 'cancelled',
            '_last_run', '__weakref__',
        )

    def __init__(self, fun, args=None, kwargs=None):
        self.fun = fun
        self.args = args or []
        self.kwargs = kwargs or {}
        self.tref = weakrefproxy(self)
        self._last_run = None
        self.cancelled = False

    def __call__(self):
        return self.fun(*self.args, **self.kwargs)

    def cancel(self):
        try:
            self.tref.cancelled = True
        except ReferenceError:  # pragma: no cover
            pass

    def __repr__(self):
        return '<TimerEntry: {0}(*{1!r}, **{2!r})'.format(
            self.fun.__name__, self.args, self.kwargs)

    def __hash__(self):
        return hash((self.fun, repr(self.args), repr(self.kwargs)))

    # must not use hash() to order entries
    def __lt__(self, other):
        return id(self) < id(other)

    def __gt__(self, other):
        return id(self) > id(other)

    def __le__(self, other):
        return id(self) <= id(other)

    def __ge__(self, other):
        return id(self) >= id(other)

    def __eq__(self, other):
        return hash(self) == hash(other)

    def __ne__(self, other):
        return not self.__eq__(other)


class Timer(object):
    """ETA scheduler."""
    Entry = Entry

    on_error = None

    def __init__(self, max_interval=None, on_error=None, **kwargs):
        self.max_interval = float(max_interval or DEFAULT_MAX_INTERVAL)
        self.on_error = on_error or self.on_error
        self._queue = []

    def __enter__(self):
        return self

    def __exit__(self, *exc_info):
        self.stop()

    def call_at(self, eta, fun, args=(), kwargs={}, priority=0):
        return self.enter_at(self.Entry(fun, args, kwargs), eta, priority)

    def call_after(self, secs, fun, args=(), kwargs={}, priority=0):
        return self.enter_after(secs, self.Entry(fun, args, kwargs), priority)

    def call_repeatedly(self, secs, fun, args=(), kwargs={}, priority=0):
        tref = self.Entry(fun, args, kwargs)

        @wraps(fun)
        def _reschedules(*args, **kwargs):
            last, now = tref._last_run, monotonic()
            lsince = (now - tref._last_run) if last else secs
            try:
                if lsince and lsince >= secs:
                    tref._last_run = now
                    return fun(*args, **kwargs)
            finally:
                if not tref.cancelled:
                    last = tref._last_run
                    next = secs - (now - last) if last else secs
                    self.enter_after(next, tref, priority)

        tref.fun = _reschedules
        tref._last_run = None
        return self.enter_after(secs, tref, priority)

    def enter_at(self, entry, eta=None, priority=0, time=time):
        """Enter function into the scheduler.

        :param entry: Item to enter.
        :keyword eta: Scheduled time as a :class:`datetime.datetime` object.
        :keyword priority: Unused.

        """
        if eta is None:
            eta = time()
        if isinstance(eta, datetime):
            try:
                eta = to_timestamp(eta)
            except Exception as exc:
                if not self.handle_error(exc):
                    raise
                return
        return self._enter(eta, priority, entry)

    def enter_after(self, secs, entry, priority=0, time=time):
        return self.enter_at(entry, time() + secs, priority)

    def _enter(self, eta, priority, entry, push=heapq.heappush):
        push(self._queue, scheduled(eta, priority, entry))
        return entry

    def apply_entry(self, entry):
        try:
            entry()
        except Exception as exc:
            if not self.handle_error(exc):
                logger.error('Error in timer: %r', exc, exc_info=True)

    def handle_error(self, exc_info):
        if self.on_error:
            self.on_error(exc_info)
            return True

    def stop(self):
        pass

    def __iter__(self, min=min, nowfun=time,
                 pop=heapq.heappop, push=heapq.heappush):
        """This iterator yields a tuple of ``(entry, wait_seconds)``,
        where if entry is :const:`None` the caller should wait
        for ``wait_seconds`` until it polls the schedule again."""
        max_interval = self.max_interval
        queue = self._queue

        while 1:
            if queue:
                eventA = queue[0]
                now, eta = nowfun(), eventA[0]

                if now < eta:
                    yield min(eta - now, max_interval), None
                else:
                    eventB = pop(queue)

                    if eventB is eventA:
                        entry = eventA[2]
                        if not entry.cancelled:
                            yield None, entry
                        continue
                    else:
                        push(queue, eventB)
            else:
                yield None, None

    def clear(self):
        self._queue[:] = []  # atomic, without creating a new list.

    def cancel(self, tref):
        tref.cancel()

    def __len__(self):
        return len(self._queue)

    def __nonzero__(self):
        return True

    @property
    def queue(self, _pop=heapq.heappop):
        """Snapshot of underlying datastructure."""
        events = list(self._queue)
        return [_pop(v) for v in [events] * len(events)]

    @property
    def schedule(self):
        return self
