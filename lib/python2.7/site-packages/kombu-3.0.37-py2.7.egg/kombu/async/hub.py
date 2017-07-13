# -*- coding: utf-8 -*-
"""
kombu.async.hub
===============

Event loop implementation.

"""
from __future__ import absolute_import

import errno

from collections import deque
from contextlib import contextmanager
from time import sleep
from types import GeneratorType as generator

from amqp import promise

from kombu.five import Empty, range
from kombu.log import get_logger
from kombu.utils import cached_property, fileno
from kombu.utils.compat import get_errno
from kombu.utils.eventio import READ, WRITE, ERR, poll

from .timer import Timer

__all__ = ['Hub', 'get_event_loop', 'set_event_loop']
logger = get_logger(__name__)

_current_loop = None

W_UNKNOWN_EVENT = """\
Received unknown event %r for fd %r, please contact support!\
"""


class Stop(BaseException):
    """Stops the event loop."""


def _raise_stop_error():
    raise Stop()


@contextmanager
def _dummy_context(*args, **kwargs):
    yield


def get_event_loop():
    return _current_loop


def set_event_loop(loop):
    global _current_loop
    _current_loop = loop
    return loop


class Hub(object):
    """Event loop object.

    :keyword timer: Specify timer object.

    """
    #: Flag set if reading from an fd will not block.
    READ = READ

    #: Flag set if writing to an fd will not block.
    WRITE = WRITE

    #: Flag set on error, and the fd should be read from asap.
    ERR = ERR

    #: List of callbacks to be called when the loop is exiting,
    #: applied with the hub instance as sole argument.
    on_close = None

    def __init__(self, timer=None):
        self.timer = timer if timer is not None else Timer()

        self.readers = {}
        self.writers = {}
        self.on_tick = set()
        self.on_close = set()
        self._ready = deque()

        self._running = False
        self._loop = None

        # The eventloop (in celery.worker.loops)
        # will merge fds in this set and then instead of calling
        # the callback for each ready fd it will call the
        # :attr:`consolidate_callback` with the list of ready_fds
        # as an argument.  This API is internal and is only
        # used by the multiprocessing pool to find inqueues
        # that are ready to write.
        self.consolidate = set()
        self.consolidate_callback = None

        self.propagate_errors = ()

        self._create_poller()

    def reset(self):
        self.close()
        self._create_poller()

    def _create_poller(self):
        self.poller = poll()
        self._register_fd = self.poller.register
        self._unregister_fd = self.poller.unregister

    def _close_poller(self):
        if self.poller is not None:
            self.poller.close()
            self.poller = None
            self._register_fd = None
            self._unregister_fd = None

    def stop(self):
        self.call_soon(_raise_stop_error)

    def __repr__(self):
        return '<Hub@{0:#x}: R:{1} W:{2}>'.format(
            id(self), len(self.readers), len(self.writers),
        )

    def fire_timers(self, min_delay=1, max_delay=10, max_timers=10,
                    propagate=()):
        timer = self.timer
        delay = None
        if timer and timer._queue:
            for i in range(max_timers):
                delay, entry = next(self.scheduler)
                if entry is None:
                    break
                try:
                    entry()
                except propagate:
                    raise
                except (MemoryError, AssertionError):
                    raise
                except OSError as exc:
                    if get_errno(exc) == errno.ENOMEM:
                        raise
                    logger.error('Error in timer: %r', exc, exc_info=1)
                except Exception as exc:
                    logger.error('Error in timer: %r', exc, exc_info=1)
        return min(delay or min_delay, max_delay)

    def _remove_from_loop(self, fd):
        try:
            self._unregister(fd)
        finally:
            self._discard(fd)

    def add(self, fd, callback, flags, args=(), consolidate=False):
        fd = fileno(fd)
        try:
            self.poller.register(fd, flags)
        except ValueError:
            self._remove_from_loop(fd)
            raise
        else:
            dest = self.readers if flags & READ else self.writers
            if consolidate:
                self.consolidate.add(fd)
                dest[fd] = None
            else:
                dest[fd] = callback, args

    def remove(self, fd):
        fd = fileno(fd)
        self._remove_from_loop(fd)

    def run_forever(self):
        self._running = True
        try:
            while 1:
                try:
                    self.run_once()
                except Stop:
                    break
        finally:
            self._running = False

    def run_once(self):
        try:
            next(self.loop)
        except StopIteration:
            self._loop = None

    def call_soon(self, callback, *args):
        handle = promise(callback, args)
        self._ready.append(handle)
        return handle

    def call_later(self, delay, callback, *args):
        return self.timer.call_after(delay, callback, args)

    def call_at(self, when, callback, *args):
        return self.timer.call_at(when, callback, args)

    def call_repeatedly(self, delay, callback, *args):
        return self.timer.call_repeatedly(delay, callback, args)

    def add_reader(self, fds, callback, *args):
        return self.add(fds, callback, READ | ERR, args)

    def add_writer(self, fds, callback, *args):
        return self.add(fds, callback, WRITE, args)

    def remove_reader(self, fd):
        writable = fd in self.writers
        on_write = self.writers.get(fd)
        try:
            self._remove_from_loop(fd)
        finally:
            if writable:
                cb, args = on_write
                self.add(fd, cb, WRITE, args)

    def remove_writer(self, fd):
        readable = fd in self.readers
        on_read = self.readers.get(fd)
        try:
            self._remove_from_loop(fd)
        finally:
            if readable:
                cb, args = on_read
                self.add(fd, cb, READ | ERR, args)

    def _unregister(self, fd):
        try:
            self.poller.unregister(fd)
        except (AttributeError, KeyError, OSError):
            pass

    def close(self, *args):
        [self._unregister(fd) for fd in self.readers]
        self.readers.clear()
        [self._unregister(fd) for fd in self.writers]
        self.writers.clear()
        self.consolidate.clear()
        self._close_poller()
        for callback in self.on_close:
            callback(self)

    def _discard(self, fd):
        fd = fileno(fd)
        self.readers.pop(fd, None)
        self.writers.pop(fd, None)
        self.consolidate.discard(fd)

    def create_loop(self,
                    generator=generator, sleep=sleep, min=min, next=next,
                    Empty=Empty, StopIteration=StopIteration,
                    KeyError=KeyError, READ=READ, WRITE=WRITE, ERR=ERR):
        readers, writers = self.readers, self.writers
        poll = self.poller.poll
        fire_timers = self.fire_timers
        hub_remove = self.remove
        scheduled = self.timer._queue
        consolidate = self.consolidate
        consolidate_callback = self.consolidate_callback
        on_tick = self.on_tick
        todo = self._ready
        propagate = self.propagate_errors

        while 1:
            for tick_callback in on_tick:
                tick_callback()

            while todo:
                item = todo.popleft()
                if item:
                    item()

            poll_timeout = fire_timers(propagate=propagate) if scheduled else 1
            if readers or writers:
                to_consolidate = []
                try:
                    events = poll(poll_timeout)
                except ValueError:  # Issue 882
                    raise StopIteration()

                for fd, event in events or ():
                    general_error = False
                    if fd in consolidate and \
                            writers.get(fd) is None:
                        to_consolidate.append(fd)
                        continue
                    cb = cbargs = None

                    if event & READ:
                        try:
                            cb, cbargs = readers[fd]
                        except KeyError:
                            self.remove_reader(fd)
                            continue
                    elif event & WRITE:
                        try:
                            cb, cbargs = writers[fd]
                        except KeyError:
                            self.remove_writer(fd)
                            continue
                    elif event & ERR:
                        general_error = True
                    else:
                        logger.info(W_UNKNOWN_EVENT, event, fd)
                        general_error = True

                    if general_error:
                        try:
                            cb, cbargs = (readers.get(fd) or
                                          writers.get(fd))
                        except TypeError:
                            pass

                    if cb is None:
                        self.remove(fd)
                        continue

                    if isinstance(cb, generator):
                        try:
                            next(cb)
                        except OSError as exc:
                            if get_errno(exc) != errno.EBADF:
                                raise
                            hub_remove(fd)
                        except StopIteration:
                            pass
                        except Exception:
                            hub_remove(fd)
                            raise
                    else:
                        try:
                            cb(*cbargs)
                        except Empty:
                            pass
                if to_consolidate:
                    consolidate_callback(to_consolidate)
            else:
                # no sockets yet, startup is probably not done.
                sleep(min(poll_timeout, 0.1))
            yield

    def repr_active(self):
        from .debug import repr_active
        return repr_active(self)

    def repr_events(self, events):
        from .debug import repr_events
        return repr_events(self, events)

    @cached_property
    def scheduler(self):
        return iter(self.timer)

    @property
    def loop(self):
        if self._loop is None:
            self._loop = self.create_loop()
        return self._loop
