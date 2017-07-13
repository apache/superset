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

from __future__ import absolute_import, division, print_function, with_statement

__all__ = ['Queue', 'PriorityQueue', 'LifoQueue', 'QueueFull', 'QueueEmpty']

import collections
import heapq

from tornado import gen, ioloop
from tornado.concurrent import Future
from tornado.locks import Event


class QueueEmpty(Exception):
    """Raised by `.Queue.get_nowait` when the queue has no items."""
    pass


class QueueFull(Exception):
    """Raised by `.Queue.put_nowait` when a queue is at its maximum size."""
    pass


def _set_timeout(future, timeout):
    if timeout:
        def on_timeout():
            future.set_exception(gen.TimeoutError())
        io_loop = ioloop.IOLoop.current()
        timeout_handle = io_loop.add_timeout(timeout, on_timeout)
        future.add_done_callback(
            lambda _: io_loop.remove_timeout(timeout_handle))


class Queue(object):
    """Coordinate producer and consumer coroutines.

    If maxsize is 0 (the default) the queue size is unbounded.

    .. testcode::

        q = queues.Queue(maxsize=2)

        @gen.coroutine
        def consumer():
            while True:
                item = yield q.get()
                try:
                    print('Doing work on %s' % item)
                    yield gen.sleep(0.01)
                finally:
                    q.task_done()

        @gen.coroutine
        def producer():
            for item in range(5):
                yield q.put(item)
                print('Put %s' % item)

        @gen.coroutine
        def main():
            consumer()           # Start consumer.
            yield producer()     # Wait for producer to put all tasks.
            yield q.join()       # Wait for consumer to finish all tasks.
            print('Done')

        io_loop.run_sync(main)

    .. testoutput::

        Put 0
        Put 1
        Put 2
        Doing work on 0
        Doing work on 1
        Put 3
        Doing work on 2
        Put 4
        Doing work on 3
        Doing work on 4
        Done
    """
    def __init__(self, maxsize=0):
        if maxsize is None:
            raise TypeError("maxsize can't be None")

        if maxsize < 0:
            raise ValueError("maxsize can't be negative")

        self._maxsize = maxsize
        self._init()
        self._getters = collections.deque([])  # Futures.
        self._putters = collections.deque([])  # Pairs of (item, Future).
        self._unfinished_tasks = 0
        self._finished = Event()
        self._finished.set()

    @property
    def maxsize(self):
        """Number of items allowed in the queue."""
        return self._maxsize

    def qsize(self):
        """Number of items in the queue."""
        return len(self._queue)

    def empty(self):
        return not self._queue

    def full(self):
        if self.maxsize == 0:
            return False
        else:
            return self.qsize() >= self.maxsize

    def put(self, item, timeout=None):
        """Put an item into the queue, perhaps waiting until there is room.

        Returns a Future, which raises `tornado.gen.TimeoutError` after a
        timeout.
        """
        try:
            self.put_nowait(item)
        except QueueFull:
            future = Future()
            self._putters.append((item, future))
            _set_timeout(future, timeout)
            return future
        else:
            return gen._null_future

    def put_nowait(self, item):
        """Put an item into the queue without blocking.

        If no free slot is immediately available, raise `QueueFull`.
        """
        self._consume_expired()
        if self._getters:
            assert self.empty(), "queue non-empty, why are getters waiting?"
            getter = self._getters.popleft()
            self.__put_internal(item)
            getter.set_result(self._get())
        elif self.full():
            raise QueueFull
        else:
            self.__put_internal(item)

    def get(self, timeout=None):
        """Remove and return an item from the queue.

        Returns a Future which resolves once an item is available, or raises
        `tornado.gen.TimeoutError` after a timeout.
        """
        future = Future()
        try:
            future.set_result(self.get_nowait())
        except QueueEmpty:
            self._getters.append(future)
            _set_timeout(future, timeout)
        return future

    def get_nowait(self):
        """Remove and return an item from the queue without blocking.

        Return an item if one is immediately available, else raise
        `QueueEmpty`.
        """
        self._consume_expired()
        if self._putters:
            assert self.full(), "queue not full, why are putters waiting?"
            item, putter = self._putters.popleft()
            self.__put_internal(item)
            putter.set_result(None)
            return self._get()
        elif self.qsize():
            return self._get()
        else:
            raise QueueEmpty

    def task_done(self):
        """Indicate that a formerly enqueued task is complete.

        Used by queue consumers. For each `.get` used to fetch a task, a
        subsequent call to `.task_done` tells the queue that the processing
        on the task is complete.

        If a `.join` is blocking, it resumes when all items have been
        processed; that is, when every `.put` is matched by a `.task_done`.

        Raises `ValueError` if called more times than `.put`.
        """
        if self._unfinished_tasks <= 0:
            raise ValueError('task_done() called too many times')
        self._unfinished_tasks -= 1
        if self._unfinished_tasks == 0:
            self._finished.set()

    def join(self, timeout=None):
        """Block until all items in the queue are processed.

        Returns a Future, which raises `tornado.gen.TimeoutError` after a
        timeout.
        """
        return self._finished.wait(timeout)

    # These three are overridable in subclasses.
    def _init(self):
        self._queue = collections.deque()

    def _get(self):
        return self._queue.popleft()

    def _put(self, item):
        self._queue.append(item)
    # End of the overridable methods.

    def __put_internal(self, item):
        self._unfinished_tasks += 1
        self._finished.clear()
        self._put(item)

    def _consume_expired(self):
        # Remove timed-out waiters.
        while self._putters and self._putters[0][1].done():
            self._putters.popleft()

        while self._getters and self._getters[0].done():
            self._getters.popleft()

    def __repr__(self):
        return '<%s at %s %s>' % (
            type(self).__name__, hex(id(self)), self._format())

    def __str__(self):
        return '<%s %s>' % (type(self).__name__, self._format())

    def _format(self):
        result = 'maxsize=%r' % (self.maxsize, )
        if getattr(self, '_queue', None):
            result += ' queue=%r' % self._queue
        if self._getters:
            result += ' getters[%s]' % len(self._getters)
        if self._putters:
            result += ' putters[%s]' % len(self._putters)
        if self._unfinished_tasks:
            result += ' tasks=%s' % self._unfinished_tasks
        return result


class PriorityQueue(Queue):
    """A `.Queue` that retrieves entries in priority order, lowest first.

    Entries are typically tuples like ``(priority number, data)``.

    .. testcode::

        q = queues.PriorityQueue()
        q.put((1, 'medium-priority item'))
        q.put((0, 'high-priority item'))
        q.put((10, 'low-priority item'))

        print(q.get_nowait())
        print(q.get_nowait())
        print(q.get_nowait())

    .. testoutput::

        (0, 'high-priority item')
        (1, 'medium-priority item')
        (10, 'low-priority item')
    """
    def _init(self):
        self._queue = []

    def _put(self, item):
        heapq.heappush(self._queue, item)

    def _get(self):
        return heapq.heappop(self._queue)


class LifoQueue(Queue):
    """A `.Queue` that retrieves the most recently put items first.

    .. testcode::

        q = queues.LifoQueue()
        q.put(3)
        q.put(2)
        q.put(1)

        print(q.get_nowait())
        print(q.get_nowait())
        print(q.get_nowait())

    .. testoutput::

        1
        2
        3
    """
    def _init(self):
        self._queue = []

    def _put(self, item):
        self._queue.append(item)

    def _get(self):
        return self._queue.pop()
