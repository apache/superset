# Copyright 2015 The Tornado Authors
#
# Licensed under the Apache License, Version 2.0 (the "License"); you may
# not use this file except in compliance with the License. You may obtain
# a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS, WITHOUT
# WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the
# License for the specific language governing permissions and limitations
# under the License.

"""
.. testsetup:: *

    from tornado import ioloop, gen, locks
    io_loop = ioloop.IOLoop.current()
"""

from __future__ import absolute_import, division, print_function, with_statement

__all__ = ['Condition', 'Event', 'Semaphore', 'BoundedSemaphore', 'Lock']

import collections

from tornado import gen, ioloop
from tornado.concurrent import Future


class _TimeoutGarbageCollector(object):
    """Base class for objects that periodically clean up timed-out waiters.

    Avoids memory leak in a common pattern like:

        while True:
            yield condition.wait(short_timeout)
            print('looping....')
    """
    def __init__(self):
        self._waiters = collections.deque()  # Futures.
        self._timeouts = 0

    def _garbage_collect(self):
        # Occasionally clear timed-out waiters.
        self._timeouts += 1
        if self._timeouts > 100:
            self._timeouts = 0
            self._waiters = collections.deque(
                w for w in self._waiters if not w.done())


class Condition(_TimeoutGarbageCollector):
    """A condition allows one or more coroutines to wait until notified.

    Like a standard `threading.Condition`, but does not need an underlying lock
    that is acquired and released.

    With a `Condition`, coroutines can wait to be notified by other coroutines:

    .. testcode::

        condition = locks.Condition()

        @gen.coroutine
        def waiter():
            print("I'll wait right here")
            yield condition.wait()  # Yield a Future.
            print("I'm done waiting")

        @gen.coroutine
        def notifier():
            print("About to notify")
            condition.notify()
            print("Done notifying")

        @gen.coroutine
        def runner():
            # Yield two Futures; wait for waiter() and notifier() to finish.
            yield [waiter(), notifier()]

        io_loop.run_sync(runner)

    .. testoutput::

        I'll wait right here
        About to notify
        Done notifying
        I'm done waiting

    `wait` takes an optional ``timeout`` argument, which is either an absolute
    timestamp::

        io_loop = ioloop.IOLoop.current()

        # Wait up to 1 second for a notification.
        yield condition.wait(timeout=io_loop.time() + 1)

    ...or a `datetime.timedelta` for a timeout relative to the current time::

        # Wait up to 1 second.
        yield condition.wait(timeout=datetime.timedelta(seconds=1))

    The method raises `tornado.gen.TimeoutError` if there's no notification
    before the deadline.
    """

    def __init__(self):
        super(Condition, self).__init__()
        self.io_loop = ioloop.IOLoop.current()

    def __repr__(self):
        result = '<%s' % (self.__class__.__name__, )
        if self._waiters:
            result += ' waiters[%s]' % len(self._waiters)
        return result + '>'

    def wait(self, timeout=None):
        """Wait for `.notify`.

        Returns a `.Future` that resolves ``True`` if the condition is notified,
        or ``False`` after a timeout.
        """
        waiter = Future()
        self._waiters.append(waiter)
        if timeout:
            def on_timeout():
                waiter.set_result(False)
                self._garbage_collect()
            io_loop = ioloop.IOLoop.current()
            timeout_handle = io_loop.add_timeout(timeout, on_timeout)
            waiter.add_done_callback(
                lambda _: io_loop.remove_timeout(timeout_handle))
        return waiter

    def notify(self, n=1):
        """Wake ``n`` waiters."""
        waiters = []  # Waiters we plan to run right now.
        while n and self._waiters:
            waiter = self._waiters.popleft()
            if not waiter.done():  # Might have timed out.
                n -= 1
                waiters.append(waiter)

        for waiter in waiters:
            waiter.set_result(True)

    def notify_all(self):
        """Wake all waiters."""
        self.notify(len(self._waiters))


class Event(object):
    """An event blocks coroutines until its internal flag is set to True.

    Similar to `threading.Event`.

    A coroutine can wait for an event to be set. Once it is set, calls to
    ``yield event.wait()`` will not block unless the event has been cleared:

    .. testcode::

        event = locks.Event()

        @gen.coroutine
        def waiter():
            print("Waiting for event")
            yield event.wait()
            print("Not waiting this time")
            yield event.wait()
            print("Done")

        @gen.coroutine
        def setter():
            print("About to set the event")
            event.set()

        @gen.coroutine
        def runner():
            yield [waiter(), setter()]

        io_loop.run_sync(runner)

    .. testoutput::

        Waiting for event
        About to set the event
        Not waiting this time
        Done
    """
    def __init__(self):
        self._future = Future()

    def __repr__(self):
        return '<%s %s>' % (
            self.__class__.__name__, 'set' if self.is_set() else 'clear')

    def is_set(self):
        """Return ``True`` if the internal flag is true."""
        return self._future.done()

    def set(self):
        """Set the internal flag to ``True``. All waiters are awakened.

        Calling `.wait` once the flag is set will not block.
        """
        if not self._future.done():
            self._future.set_result(None)

    def clear(self):
        """Reset the internal flag to ``False``.
        
        Calls to `.wait` will block until `.set` is called.
        """
        if self._future.done():
            self._future = Future()

    def wait(self, timeout=None):
        """Block until the internal flag is true.

        Returns a Future, which raises `tornado.gen.TimeoutError` after a
        timeout.
        """
        if timeout is None:
            return self._future
        else:
            return gen.with_timeout(timeout, self._future)


class _ReleasingContextManager(object):
    """Releases a Lock or Semaphore at the end of a "with" statement.

        with (yield semaphore.acquire()):
            pass

        # Now semaphore.release() has been called.
    """
    def __init__(self, obj):
        self._obj = obj

    def __enter__(self):
        pass

    def __exit__(self, exc_type, exc_val, exc_tb):
        self._obj.release()


class Semaphore(_TimeoutGarbageCollector):
    """A lock that can be acquired a fixed number of times before blocking.

    A Semaphore manages a counter representing the number of `.release` calls
    minus the number of `.acquire` calls, plus an initial value. The `.acquire`
    method blocks if necessary until it can return without making the counter
    negative.

    Semaphores limit access to a shared resource. To allow access for two
    workers at a time:

    .. testsetup:: semaphore

       from collections import deque

       from tornado import gen, ioloop
       from tornado.concurrent import Future

       # Ensure reliable doctest output: resolve Futures one at a time.
       futures_q = deque([Future() for _ in range(3)])

       @gen.coroutine
       def simulator(futures):
           for f in futures:
               yield gen.moment
               f.set_result(None)

       ioloop.IOLoop.current().add_callback(simulator, list(futures_q))

       def use_some_resource():
           return futures_q.popleft()

    .. testcode:: semaphore

        sem = locks.Semaphore(2)

        @gen.coroutine
        def worker(worker_id):
            yield sem.acquire()
            try:
                print("Worker %d is working" % worker_id)
                yield use_some_resource()
            finally:
                print("Worker %d is done" % worker_id)
                sem.release()

        @gen.coroutine
        def runner():
            # Join all workers.
            yield [worker(i) for i in range(3)]

        io_loop.run_sync(runner)

    .. testoutput:: semaphore

        Worker 0 is working
        Worker 1 is working
        Worker 0 is done
        Worker 2 is working
        Worker 1 is done
        Worker 2 is done

    Workers 0 and 1 are allowed to run concurrently, but worker 2 waits until
    the semaphore has been released once, by worker 0.

    `.acquire` is a context manager, so ``worker`` could be written as::

        @gen.coroutine
        def worker(worker_id):
            with (yield sem.acquire()):
                print("Worker %d is working" % worker_id)
                yield use_some_resource()

            # Now the semaphore has been released.
            print("Worker %d is done" % worker_id)
    """
    def __init__(self, value=1):
        super(Semaphore, self).__init__()
        if value < 0:
            raise ValueError('semaphore initial value must be >= 0')

        self._value = value

    def __repr__(self):
        res = super(Semaphore, self).__repr__()
        extra = 'locked' if self._value == 0 else 'unlocked,value:{0}'.format(
            self._value)
        if self._waiters:
            extra = '{0},waiters:{1}'.format(extra, len(self._waiters))
        return '<{0} [{1}]>'.format(res[1:-1], extra)

    def release(self):
        """Increment the counter and wake one waiter."""
        self._value += 1
        while self._waiters:
            waiter = self._waiters.popleft()
            if not waiter.done():
                self._value -= 1

                # If the waiter is a coroutine paused at
                #
                #     with (yield semaphore.acquire()):
                #
                # then the context manager's __exit__ calls release() at the end
                # of the "with" block.
                waiter.set_result(_ReleasingContextManager(self))
                break

    def acquire(self, timeout=None):
        """Decrement the counter. Returns a Future.

        Block if the counter is zero and wait for a `.release`. The Future
        raises `.TimeoutError` after the deadline.
        """
        waiter = Future()
        if self._value > 0:
            self._value -= 1
            waiter.set_result(_ReleasingContextManager(self))
        else:
            self._waiters.append(waiter)
            if timeout:
                def on_timeout():
                    waiter.set_exception(gen.TimeoutError())
                    self._garbage_collect()
                io_loop = ioloop.IOLoop.current()
                timeout_handle = io_loop.add_timeout(timeout, on_timeout)
                waiter.add_done_callback(
                    lambda _: io_loop.remove_timeout(timeout_handle))
        return waiter

    def __enter__(self):
        raise RuntimeError(
            "Use Semaphore like 'with (yield semaphore.acquire())', not like"
            " 'with semaphore'")

    __exit__ = __enter__


class BoundedSemaphore(Semaphore):
    """A semaphore that prevents release() being called too many times.

    If `.release` would increment the semaphore's value past the initial
    value, it raises `ValueError`. Semaphores are mostly used to guard
    resources with limited capacity, so a semaphore released too many times
    is a sign of a bug.
    """
    def __init__(self, value=1):
        super(BoundedSemaphore, self).__init__(value=value)
        self._initial_value = value

    def release(self):
        """Increment the counter and wake one waiter."""
        if self._value >= self._initial_value:
            raise ValueError("Semaphore released too many times")
        super(BoundedSemaphore, self).release()


class Lock(object):
    """A lock for coroutines.

    A Lock begins unlocked, and `acquire` locks it immediately. While it is
    locked, a coroutine that yields `acquire` waits until another coroutine
    calls `release`.

    Releasing an unlocked lock raises `RuntimeError`.

    `acquire` supports the context manager protocol:

    >>> from tornado import gen, locks
    >>> lock = locks.Lock()
    >>>
    >>> @gen.coroutine
    ... def f():
    ...    with (yield lock.acquire()):
    ...        # Do something holding the lock.
    ...        pass
    ...
    ...    # Now the lock is released.
    """
    def __init__(self):
        self._block = BoundedSemaphore(value=1)

    def __repr__(self):
        return "<%s _block=%s>" % (
            self.__class__.__name__,
            self._block)

    def acquire(self, timeout=None):
        """Attempt to lock. Returns a Future.

        Returns a Future, which raises `tornado.gen.TimeoutError` after a
        timeout.
        """
        return self._block.acquire(timeout)

    def release(self):
        """Unlock.

        The first coroutine in line waiting for `acquire` gets the lock.

        If not locked, raise a `RuntimeError`.
        """
        try:
            self._block.release()
        except ValueError:
            raise RuntimeError('release unlocked lock')

    def __enter__(self):
        raise RuntimeError(
            "Use Lock like 'with (yield lock)', not like 'with lock'")

    __exit__ = __enter__
