"""Bridges between the `asyncio` module and Tornado IOLoop.

This is a work in progress and interfaces are subject to change.

To test:
python3.4 -m tornado.test.runtests --ioloop=tornado.platform.asyncio.AsyncIOLoop
python3.4 -m tornado.test.runtests --ioloop=tornado.platform.asyncio.AsyncIOMainLoop
(the tests log a few warnings with AsyncIOMainLoop because they leave some
unfinished callbacks on the event loop that fail when it resumes)
"""

from __future__ import absolute_import, division, print_function, with_statement
import functools

import tornado.concurrent
from tornado.gen import convert_yielded
from tornado.ioloop import IOLoop
from tornado import stack_context

try:
    # Import the real asyncio module for py33+ first.  Older versions of the
    # trollius backport also use this name.
    import asyncio
except ImportError as e:
    # Asyncio itself isn't available; see if trollius is (backport to py26+).
    try:
        import trollius as asyncio
    except ImportError:
        # Re-raise the original asyncio error, not the trollius one.
        raise e


class BaseAsyncIOLoop(IOLoop):
    def initialize(self, asyncio_loop, close_loop=False, **kwargs):
        super(BaseAsyncIOLoop, self).initialize(**kwargs)
        self.asyncio_loop = asyncio_loop
        self.close_loop = close_loop
        self.asyncio_loop.call_soon(self.make_current)
        # Maps fd to (fileobj, handler function) pair (as in IOLoop.add_handler)
        self.handlers = {}
        # Set of fds listening for reads/writes
        self.readers = set()
        self.writers = set()
        self.closing = False

    def close(self, all_fds=False):
        self.closing = True
        for fd in list(self.handlers):
            fileobj, handler_func = self.handlers[fd]
            self.remove_handler(fd)
            if all_fds:
                self.close_fd(fileobj)
        if self.close_loop:
            self.asyncio_loop.close()

    def add_handler(self, fd, handler, events):
        fd, fileobj = self.split_fd(fd)
        if fd in self.handlers:
            raise ValueError("fd %s added twice" % fd)
        self.handlers[fd] = (fileobj, stack_context.wrap(handler))
        if events & IOLoop.READ:
            self.asyncio_loop.add_reader(
                fd, self._handle_events, fd, IOLoop.READ)
            self.readers.add(fd)
        if events & IOLoop.WRITE:
            self.asyncio_loop.add_writer(
                fd, self._handle_events, fd, IOLoop.WRITE)
            self.writers.add(fd)

    def update_handler(self, fd, events):
        fd, fileobj = self.split_fd(fd)
        if events & IOLoop.READ:
            if fd not in self.readers:
                self.asyncio_loop.add_reader(
                    fd, self._handle_events, fd, IOLoop.READ)
                self.readers.add(fd)
        else:
            if fd in self.readers:
                self.asyncio_loop.remove_reader(fd)
                self.readers.remove(fd)
        if events & IOLoop.WRITE:
            if fd not in self.writers:
                self.asyncio_loop.add_writer(
                    fd, self._handle_events, fd, IOLoop.WRITE)
                self.writers.add(fd)
        else:
            if fd in self.writers:
                self.asyncio_loop.remove_writer(fd)
                self.writers.remove(fd)

    def remove_handler(self, fd):
        fd, fileobj = self.split_fd(fd)
        if fd not in self.handlers:
            return
        if fd in self.readers:
            self.asyncio_loop.remove_reader(fd)
            self.readers.remove(fd)
        if fd in self.writers:
            self.asyncio_loop.remove_writer(fd)
            self.writers.remove(fd)
        del self.handlers[fd]

    def _handle_events(self, fd, events):
        fileobj, handler_func = self.handlers[fd]
        handler_func(fileobj, events)

    def start(self):
        self._setup_logging()
        self.asyncio_loop.run_forever()

    def stop(self):
        self.asyncio_loop.stop()

    def call_at(self, when, callback, *args, **kwargs):
        # asyncio.call_at supports *args but not **kwargs, so bind them here.
        # We do not synchronize self.time and asyncio_loop.time, so
        # convert from absolute to relative.
        return self.asyncio_loop.call_later(
            max(0, when - self.time()), self._run_callback,
            functools.partial(stack_context.wrap(callback), *args, **kwargs))

    def remove_timeout(self, timeout):
        timeout.cancel()

    def add_callback(self, callback, *args, **kwargs):
        if self.closing:
            raise RuntimeError("IOLoop is closing")
        self.asyncio_loop.call_soon_threadsafe(
            self._run_callback,
            functools.partial(stack_context.wrap(callback), *args, **kwargs))

    add_callback_from_signal = add_callback


class AsyncIOMainLoop(BaseAsyncIOLoop):
    def initialize(self, **kwargs):
        super(AsyncIOMainLoop, self).initialize(asyncio.get_event_loop(),
                                                close_loop=False, **kwargs)


class AsyncIOLoop(BaseAsyncIOLoop):
    def initialize(self, **kwargs):
        super(AsyncIOLoop, self).initialize(asyncio.new_event_loop(),
                                            close_loop=True, **kwargs)


def to_tornado_future(asyncio_future):
    """Convert an ``asyncio.Future`` to a `tornado.concurrent.Future`."""
    tf = tornado.concurrent.Future()
    tornado.concurrent.chain_future(asyncio_future, tf)
    return tf


def to_asyncio_future(tornado_future):
    """Convert a `tornado.concurrent.Future` to an ``asyncio.Future``."""
    af = asyncio.Future()
    tornado.concurrent.chain_future(tornado_future, af)
    return af

if hasattr(convert_yielded, 'register'):
    convert_yielded.register(asyncio.Future, to_tornado_future)
