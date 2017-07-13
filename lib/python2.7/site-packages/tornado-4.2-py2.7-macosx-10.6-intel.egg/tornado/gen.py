"""``tornado.gen`` is a generator-based interface to make it easier to
work in an asynchronous environment.  Code using the ``gen`` module
is technically asynchronous, but it is written as a single generator
instead of a collection of separate functions.

For example, the following asynchronous handler:

.. testcode::

    class AsyncHandler(RequestHandler):
        @asynchronous
        def get(self):
            http_client = AsyncHTTPClient()
            http_client.fetch("http://example.com",
                              callback=self.on_fetch)

        def on_fetch(self, response):
            do_something_with_response(response)
            self.render("template.html")

.. testoutput::
   :hide:

could be written with ``gen`` as:

.. testcode::

    class GenAsyncHandler(RequestHandler):
        @gen.coroutine
        def get(self):
            http_client = AsyncHTTPClient()
            response = yield http_client.fetch("http://example.com")
            do_something_with_response(response)
            self.render("template.html")

.. testoutput::
   :hide:

Most asynchronous functions in Tornado return a `.Future`;
yielding this object returns its `~.Future.result`.

You can also yield a list or dict of ``Futures``, which will be
started at the same time and run in parallel; a list or dict of results will
be returned when they are all finished:

.. testcode::

    @gen.coroutine
    def get(self):
        http_client = AsyncHTTPClient()
        response1, response2 = yield [http_client.fetch(url1),
                                      http_client.fetch(url2)]
        response_dict = yield dict(response3=http_client.fetch(url3),
                                   response4=http_client.fetch(url4))
        response3 = response_dict['response3']
        response4 = response_dict['response4']

.. testoutput::
   :hide:

If the `~functools.singledispatch` library is available (standard in
Python 3.4, available via the `singledispatch
<https://pypi.python.org/pypi/singledispatch>`_ package on older
versions), additional types of objects may be yielded. Tornado includes
support for ``asyncio.Future`` and Twisted's ``Deferred`` class when
``tornado.platform.asyncio`` and ``tornado.platform.twisted`` are imported.
See the `convert_yielded` function to extend this mechanism.

.. versionchanged:: 3.2
   Dict support added.

.. versionchanged:: 4.1
   Support added for yielding ``asyncio`` Futures and Twisted Deferreds
   via ``singledispatch``.

"""
from __future__ import absolute_import, division, print_function, with_statement

import collections
import functools
import itertools
import sys
import types
import weakref

from tornado.concurrent import Future, TracebackFuture, is_future, chain_future
from tornado.ioloop import IOLoop
from tornado.log import app_log
from tornado import stack_context
from tornado.util import raise_exc_info

try:
    from functools import singledispatch  # py34+
except ImportError as e:
    try:
        from singledispatch import singledispatch  # backport
    except ImportError:
        singledispatch = None


class KeyReuseError(Exception):
    pass


class UnknownKeyError(Exception):
    pass


class LeakedCallbackError(Exception):
    pass


class BadYieldError(Exception):
    pass


class ReturnValueIgnoredError(Exception):
    pass


class TimeoutError(Exception):
    """Exception raised by ``with_timeout``."""


def engine(func):
    """Callback-oriented decorator for asynchronous generators.

    This is an older interface; for new code that does not need to be
    compatible with versions of Tornado older than 3.0 the
    `coroutine` decorator is recommended instead.

    This decorator is similar to `coroutine`, except it does not
    return a `.Future` and the ``callback`` argument is not treated
    specially.

    In most cases, functions decorated with `engine` should take
    a ``callback`` argument and invoke it with their result when
    they are finished.  One notable exception is the
    `~tornado.web.RequestHandler` :ref:`HTTP verb methods <verbs>`,
    which use ``self.finish()`` in place of a callback argument.
    """
    func = _make_coroutine_wrapper(func, replace_callback=False)

    @functools.wraps(func)
    def wrapper(*args, **kwargs):
        future = func(*args, **kwargs)

        def final_callback(future):
            if future.result() is not None:
                raise ReturnValueIgnoredError(
                    "@gen.engine functions cannot return values: %r" %
                    (future.result(),))
        # The engine interface doesn't give us any way to return
        # errors but to raise them into the stack context.
        # Save the stack context here to use when the Future has resolved.
        future.add_done_callback(stack_context.wrap(final_callback))
    return wrapper


def coroutine(func, replace_callback=True):
    """Decorator for asynchronous generators.

    Any generator that yields objects from this module must be wrapped
    in either this decorator or `engine`.

    Coroutines may "return" by raising the special exception
    `Return(value) <Return>`.  In Python 3.3+, it is also possible for
    the function to simply use the ``return value`` statement (prior to
    Python 3.3 generators were not allowed to also return values).
    In all versions of Python a coroutine that simply wishes to exit
    early may use the ``return`` statement without a value.

    Functions with this decorator return a `.Future`.  Additionally,
    they may be called with a ``callback`` keyword argument, which
    will be invoked with the future's result when it resolves.  If the
    coroutine fails, the callback will not be run and an exception
    will be raised into the surrounding `.StackContext`.  The
    ``callback`` argument is not visible inside the decorated
    function; it is handled by the decorator itself.

    From the caller's perspective, ``@gen.coroutine`` is similar to
    the combination of ``@return_future`` and ``@gen.engine``.

    .. warning::

       When exceptions occur inside a coroutine, the exception
       information will be stored in the `.Future` object. You must
       examine the result of the `.Future` object, or the exception
       may go unnoticed by your code. This means yielding the function
       if called from another coroutine, using something like
       `.IOLoop.run_sync` for top-level calls, or passing the `.Future`
       to `.IOLoop.add_future`.

    """
    return _make_coroutine_wrapper(func, replace_callback=True)


def _make_coroutine_wrapper(func, replace_callback):
    """The inner workings of ``@gen.coroutine`` and ``@gen.engine``.

    The two decorators differ in their treatment of the ``callback``
    argument, so we cannot simply implement ``@engine`` in terms of
    ``@coroutine``.
    """
    @functools.wraps(func)
    def wrapper(*args, **kwargs):
        future = TracebackFuture()

        if replace_callback and 'callback' in kwargs:
            callback = kwargs.pop('callback')
            IOLoop.current().add_future(
                future, lambda future: callback(future.result()))

        try:
            result = func(*args, **kwargs)
        except (Return, StopIteration) as e:
            result = getattr(e, 'value', None)
        except Exception:
            future.set_exc_info(sys.exc_info())
            return future
        else:
            if isinstance(result, types.GeneratorType):
                # Inline the first iteration of Runner.run.  This lets us
                # avoid the cost of creating a Runner when the coroutine
                # never actually yields, which in turn allows us to
                # use "optional" coroutines in critical path code without
                # performance penalty for the synchronous case.
                try:
                    orig_stack_contexts = stack_context._state.contexts
                    yielded = next(result)
                    if stack_context._state.contexts is not orig_stack_contexts:
                        yielded = TracebackFuture()
                        yielded.set_exception(
                            stack_context.StackContextInconsistentError(
                                'stack_context inconsistency (probably caused '
                                'by yield within a "with StackContext" block)'))
                except (StopIteration, Return) as e:
                    future.set_result(getattr(e, 'value', None))
                except Exception:
                    future.set_exc_info(sys.exc_info())
                else:
                    Runner(result, future, yielded)
                try:
                    return future
                finally:
                    # Subtle memory optimization: if next() raised an exception,
                    # the future's exc_info contains a traceback which
                    # includes this stack frame.  This creates a cycle,
                    # which will be collected at the next full GC but has
                    # been shown to greatly increase memory usage of
                    # benchmarks (relative to the refcount-based scheme
                    # used in the absence of cycles).  We can avoid the
                    # cycle by clearing the local variable after we return it.
                    future = None
        future.set_result(result)
        return future
    return wrapper


class Return(Exception):
    """Special exception to return a value from a `coroutine`.

    If this exception is raised, its value argument is used as the
    result of the coroutine::

        @gen.coroutine
        def fetch_json(url):
            response = yield AsyncHTTPClient().fetch(url)
            raise gen.Return(json_decode(response.body))

    In Python 3.3, this exception is no longer necessary: the ``return``
    statement can be used directly to return a value (previously
    ``yield`` and ``return`` with a value could not be combined in the
    same function).

    By analogy with the return statement, the value argument is optional,
    but it is never necessary to ``raise gen.Return()``.  The ``return``
    statement can be used with no arguments instead.
    """
    def __init__(self, value=None):
        super(Return, self).__init__()
        self.value = value


class WaitIterator(object):
    """Provides an iterator to yield the results of futures as they finish.

    Yielding a set of futures like this:

    ``results = yield [future1, future2]``

    pauses the coroutine until both ``future1`` and ``future2``
    return, and then restarts the coroutine with the results of both
    futures. If either future is an exception, the expression will
    raise that exception and all the results will be lost.

    If you need to get the result of each future as soon as possible,
    or if you need the result of some futures even if others produce
    errors, you can use ``WaitIterator``::

      wait_iterator = gen.WaitIterator(future1, future2)
      while not wait_iterator.done():
          try:
              result = yield wait_iterator.next()
          except Exception as e:
              print("Error {} from {}".format(e, wait_iterator.current_future))
          else:
              print("Result {} received from {} at {}".format(
                  result, wait_iterator.current_future,
                  wait_iterator.current_index))

    Because results are returned as soon as they are available the
    output from the iterator *will not be in the same order as the
    input arguments*. If you need to know which future produced the
    current result, you can use the attributes
    ``WaitIterator.current_future``, or ``WaitIterator.current_index``
    to get the index of the future from the input list. (if keyword
    arguments were used in the construction of the `WaitIterator`,
    ``current_index`` will use the corresponding keyword).

    .. versionadded:: 4.1
    """
    def __init__(self, *args, **kwargs):
        if args and kwargs:
            raise ValueError(
                "You must provide args or kwargs, not both")

        if kwargs:
            self._unfinished = dict((f, k) for (k, f) in kwargs.items())
            futures = list(kwargs.values())
        else:
            self._unfinished = dict((f, i) for (i, f) in enumerate(args))
            futures = args

        self._finished = collections.deque()
        self.current_index = self.current_future = None
        self._running_future = None

        for future in futures:
            future.add_done_callback(self._done_callback)

    def done(self):
        """Returns True if this iterator has no more results."""
        if self._finished or self._unfinished:
            return False
        # Clear the 'current' values when iteration is done.
        self.current_index = self.current_future = None
        return True

    def next(self):
        """Returns a `.Future` that will yield the next available result.

        Note that this `.Future` will not be the same object as any of
        the inputs.
        """
        self._running_future = TracebackFuture()

        if self._finished:
            self._return_result(self._finished.popleft())

        return self._running_future

    def _done_callback(self, done):
        if self._running_future and not self._running_future.done():
            self._return_result(done)
        else:
            self._finished.append(done)

    def _return_result(self, done):
        """Called set the returned future's state that of the future
        we yielded, and set the current future for the iterator.
        """
        chain_future(done, self._running_future)

        self.current_future = done
        self.current_index = self._unfinished.pop(done)


class YieldPoint(object):
    """Base class for objects that may be yielded from the generator.

    .. deprecated:: 4.0
       Use `Futures <.Future>` instead.
    """
    def start(self, runner):
        """Called by the runner after the generator has yielded.

        No other methods will be called on this object before ``start``.
        """
        raise NotImplementedError()

    def is_ready(self):
        """Called by the runner to determine whether to resume the generator.

        Returns a boolean; may be called more than once.
        """
        raise NotImplementedError()

    def get_result(self):
        """Returns the value to use as the result of the yield expression.

        This method will only be called once, and only after `is_ready`
        has returned true.
        """
        raise NotImplementedError()


class Callback(YieldPoint):
    """Returns a callable object that will allow a matching `Wait` to proceed.

    The key may be any value suitable for use as a dictionary key, and is
    used to match ``Callbacks`` to their corresponding ``Waits``.  The key
    must be unique among outstanding callbacks within a single run of the
    generator function, but may be reused across different runs of the same
    function (so constants generally work fine).

    The callback may be called with zero or one arguments; if an argument
    is given it will be returned by `Wait`.

    .. deprecated:: 4.0
       Use `Futures <.Future>` instead.
    """
    def __init__(self, key):
        self.key = key

    def start(self, runner):
        self.runner = runner
        runner.register_callback(self.key)

    def is_ready(self):
        return True

    def get_result(self):
        return self.runner.result_callback(self.key)


class Wait(YieldPoint):
    """Returns the argument passed to the result of a previous `Callback`.

    .. deprecated:: 4.0
       Use `Futures <.Future>` instead.
    """
    def __init__(self, key):
        self.key = key

    def start(self, runner):
        self.runner = runner

    def is_ready(self):
        return self.runner.is_ready(self.key)

    def get_result(self):
        return self.runner.pop_result(self.key)


class WaitAll(YieldPoint):
    """Returns the results of multiple previous `Callbacks <Callback>`.

    The argument is a sequence of `Callback` keys, and the result is
    a list of results in the same order.

    `WaitAll` is equivalent to yielding a list of `Wait` objects.

    .. deprecated:: 4.0
       Use `Futures <.Future>` instead.
    """
    def __init__(self, keys):
        self.keys = keys

    def start(self, runner):
        self.runner = runner

    def is_ready(self):
        return all(self.runner.is_ready(key) for key in self.keys)

    def get_result(self):
        return [self.runner.pop_result(key) for key in self.keys]


def Task(func, *args, **kwargs):
    """Adapts a callback-based asynchronous function for use in coroutines.

    Takes a function (and optional additional arguments) and runs it with
    those arguments plus a ``callback`` keyword argument.  The argument passed
    to the callback is returned as the result of the yield expression.

    .. versionchanged:: 4.0
       ``gen.Task`` is now a function that returns a `.Future`, instead of
       a subclass of `YieldPoint`.  It still behaves the same way when
       yielded.
    """
    future = Future()

    def handle_exception(typ, value, tb):
        if future.done():
            return False
        future.set_exc_info((typ, value, tb))
        return True

    def set_result(result):
        if future.done():
            return
        future.set_result(result)
    with stack_context.ExceptionStackContext(handle_exception):
        func(*args, callback=_argument_adapter(set_result), **kwargs)
    return future


class YieldFuture(YieldPoint):
    def __init__(self, future, io_loop=None):
        """Adapts a `.Future` to the `YieldPoint` interface.

        .. versionchanged:: 4.1
           The ``io_loop`` argument is deprecated.
        """
        self.future = future
        self.io_loop = io_loop or IOLoop.current()

    def start(self, runner):
        if not self.future.done():
            self.runner = runner
            self.key = object()
            runner.register_callback(self.key)
            self.io_loop.add_future(self.future, runner.result_callback(self.key))
        else:
            self.runner = None
            self.result_fn = self.future.result

    def is_ready(self):
        if self.runner is not None:
            return self.runner.is_ready(self.key)
        else:
            return True

    def get_result(self):
        if self.runner is not None:
            return self.runner.pop_result(self.key).result()
        else:
            return self.result_fn()


class Multi(YieldPoint):
    """Runs multiple asynchronous operations in parallel.

    Takes a list of ``YieldPoints`` or ``Futures`` and returns a list of
    their responses.  It is not necessary to call `Multi` explicitly,
    since the engine will do so automatically when the generator yields
    a list of ``YieldPoints`` or a mixture of ``YieldPoints`` and ``Futures``.

    Instead of a list, the argument may also be a dictionary whose values are
    Futures, in which case a parallel dictionary is returned mapping the same
    keys to their results.

    It is not normally necessary to call this class directly, as it
    will be created automatically as needed. However, calling it directly
    allows you to use the ``quiet_exceptions`` argument to control
    the logging of multiple exceptions.

    .. versionchanged:: 4.2
       If multiple ``YieldPoints`` fail, any exceptions after the first
       (which is raised) will be logged. Added the ``quiet_exceptions``
       argument to suppress this logging for selected exception types.
    """
    def __init__(self, children, quiet_exceptions=()):
        self.keys = None
        if isinstance(children, dict):
            self.keys = list(children.keys())
            children = children.values()
        self.children = []
        for i in children:
            if is_future(i):
                i = YieldFuture(i)
            self.children.append(i)
        assert all(isinstance(i, YieldPoint) for i in self.children)
        self.unfinished_children = set(self.children)
        self.quiet_exceptions = quiet_exceptions

    def start(self, runner):
        for i in self.children:
            i.start(runner)

    def is_ready(self):
        finished = list(itertools.takewhile(
            lambda i: i.is_ready(), self.unfinished_children))
        self.unfinished_children.difference_update(finished)
        return not self.unfinished_children

    def get_result(self):
        result_list = []
        exc_info = None
        for f in self.children:
            try:
                result_list.append(f.get_result())
            except Exception as e:
                if exc_info is None:
                    exc_info = sys.exc_info()
                else:
                    if not isinstance(e, self.quiet_exceptions):
                        app_log.error("Multiple exceptions in yield list",
                                      exc_info=True)
        if exc_info is not None:
            raise_exc_info(exc_info)
        if self.keys is not None:
            return dict(zip(self.keys, result_list))
        else:
            return list(result_list)


def multi_future(children, quiet_exceptions=()):
    """Wait for multiple asynchronous futures in parallel.

    Takes a list of ``Futures`` (but *not* other ``YieldPoints``) and returns
    a new Future that resolves when all the other Futures are done.
    If all the ``Futures`` succeeded, the returned Future's result is a list
    of their results.  If any failed, the returned Future raises the exception
    of the first one to fail.

    Instead of a list, the argument may also be a dictionary whose values are
    Futures, in which case a parallel dictionary is returned mapping the same
    keys to their results.

    It is not normally necessary to call `multi_future` explcitly,
    since the engine will do so automatically when the generator
    yields a list of ``Futures``. However, calling it directly
    allows you to use the ``quiet_exceptions`` argument to control
    the logging of multiple exceptions.

    This function is faster than the `Multi` `YieldPoint` because it
    does not require the creation of a stack context.

    .. versionadded:: 4.0

    .. versionchanged:: 4.2
       If multiple ``Futures`` fail, any exceptions after the first (which is
       raised) will be logged. Added the ``quiet_exceptions``
       argument to suppress this logging for selected exception types.
    """
    if isinstance(children, dict):
        keys = list(children.keys())
        children = children.values()
    else:
        keys = None
    assert all(is_future(i) for i in children)
    unfinished_children = set(children)

    future = Future()
    if not children:
        future.set_result({} if keys is not None else [])

    def callback(f):
        unfinished_children.remove(f)
        if not unfinished_children:
            result_list = []
            for f in children:
                try:
                    result_list.append(f.result())
                except Exception as e:
                    if future.done():
                        if not isinstance(e, quiet_exceptions):
                            app_log.error("Multiple exceptions in yield list",
                                          exc_info=True)
                    else:
                        future.set_exc_info(sys.exc_info())
            if not future.done():
                if keys is not None:
                    future.set_result(dict(zip(keys, result_list)))
                else:
                    future.set_result(result_list)

    listening = set()
    for f in children:
        if f not in listening:
            listening.add(f)
            f.add_done_callback(callback)
    return future


def maybe_future(x):
    """Converts ``x`` into a `.Future`.

    If ``x`` is already a `.Future`, it is simply returned; otherwise
    it is wrapped in a new `.Future`.  This is suitable for use as
    ``result = yield gen.maybe_future(f())`` when you don't know whether
    ``f()`` returns a `.Future` or not.
    """
    if is_future(x):
        return x
    else:
        fut = Future()
        fut.set_result(x)
        return fut


def with_timeout(timeout, future, io_loop=None, quiet_exceptions=()):
    """Wraps a `.Future` in a timeout.

    Raises `TimeoutError` if the input future does not complete before
    ``timeout``, which may be specified in any form allowed by
    `.IOLoop.add_timeout` (i.e. a `datetime.timedelta` or an absolute time
    relative to `.IOLoop.time`)

    If the wrapped `.Future` fails after it has timed out, the exception
    will be logged unless it is of a type contained in ``quiet_exceptions``
    (which may be an exception type or a sequence of types).

    Currently only supports Futures, not other `YieldPoint` classes.

    .. versionadded:: 4.0

    .. versionchanged:: 4.1
       Added the ``quiet_exceptions`` argument and the logging of unhandled
       exceptions.
    """
    # TODO: allow yield points in addition to futures?
    # Tricky to do with stack_context semantics.
    #
    # It's tempting to optimize this by cancelling the input future on timeout
    # instead of creating a new one, but A) we can't know if we are the only
    # one waiting on the input future, so cancelling it might disrupt other
    # callers and B) concurrent futures can only be cancelled while they are
    # in the queue, so cancellation cannot reliably bound our waiting time.
    result = Future()
    chain_future(future, result)
    if io_loop is None:
        io_loop = IOLoop.current()

    def error_callback(future):
        try:
            future.result()
        except Exception as e:
            if not isinstance(e, quiet_exceptions):
                app_log.error("Exception in Future %r after timeout",
                              future, exc_info=True)

    def timeout_callback():
        result.set_exception(TimeoutError("Timeout"))
        # In case the wrapped future goes on to fail, log it.
        future.add_done_callback(error_callback)
    timeout_handle = io_loop.add_timeout(
        timeout, timeout_callback)
    if isinstance(future, Future):
        # We know this future will resolve on the IOLoop, so we don't
        # need the extra thread-safety of IOLoop.add_future (and we also
        # don't care about StackContext here.
        future.add_done_callback(
            lambda future: io_loop.remove_timeout(timeout_handle))
    else:
        # concurrent.futures.Futures may resolve on any thread, so we
        # need to route them back to the IOLoop.
        io_loop.add_future(
            future, lambda future: io_loop.remove_timeout(timeout_handle))
    return result


def sleep(duration):
    """Return a `.Future` that resolves after the given number of seconds.

    When used with ``yield`` in a coroutine, this is a non-blocking
    analogue to `time.sleep` (which should not be used in coroutines
    because it is blocking)::

        yield gen.sleep(0.5)

    Note that calling this function on its own does nothing; you must
    wait on the `.Future` it returns (usually by yielding it).

    .. versionadded:: 4.1
    """
    f = Future()
    IOLoop.current().call_later(duration, lambda: f.set_result(None))
    return f


_null_future = Future()
_null_future.set_result(None)

moment = Future()
moment.__doc__ = \
    """A special object which may be yielded to allow the IOLoop to run for
one iteration.

This is not needed in normal use but it can be helpful in long-running
coroutines that are likely to yield Futures that are ready instantly.

Usage: ``yield gen.moment``

.. versionadded:: 4.0
"""
moment.set_result(None)


class Runner(object):
    """Internal implementation of `tornado.gen.engine`.

    Maintains information about pending callbacks and their results.

    The results of the generator are stored in ``result_future`` (a
    `.TracebackFuture`)
    """
    def __init__(self, gen, result_future, first_yielded):
        self.gen = gen
        self.result_future = result_future
        self.future = _null_future
        self.yield_point = None
        self.pending_callbacks = None
        self.results = None
        self.running = False
        self.finished = False
        self.had_exception = False
        self.io_loop = IOLoop.current()
        # For efficiency, we do not create a stack context until we
        # reach a YieldPoint (stack contexts are required for the historical
        # semantics of YieldPoints, but not for Futures).  When we have
        # done so, this field will be set and must be called at the end
        # of the coroutine.
        self.stack_context_deactivate = None
        if self.handle_yield(first_yielded):
            self.run()

    def register_callback(self, key):
        """Adds ``key`` to the list of callbacks."""
        if self.pending_callbacks is None:
            # Lazily initialize the old-style YieldPoint data structures.
            self.pending_callbacks = set()
            self.results = {}
        if key in self.pending_callbacks:
            raise KeyReuseError("key %r is already pending" % (key,))
        self.pending_callbacks.add(key)

    def is_ready(self, key):
        """Returns true if a result is available for ``key``."""
        if self.pending_callbacks is None or key not in self.pending_callbacks:
            raise UnknownKeyError("key %r is not pending" % (key,))
        return key in self.results

    def set_result(self, key, result):
        """Sets the result for ``key`` and attempts to resume the generator."""
        self.results[key] = result
        if self.yield_point is not None and self.yield_point.is_ready():
            try:
                self.future.set_result(self.yield_point.get_result())
            except:
                self.future.set_exc_info(sys.exc_info())
            self.yield_point = None
            self.run()

    def pop_result(self, key):
        """Returns the result for ``key`` and unregisters it."""
        self.pending_callbacks.remove(key)
        return self.results.pop(key)

    def run(self):
        """Starts or resumes the generator, running until it reaches a
        yield point that is not ready.
        """
        if self.running or self.finished:
            return
        try:
            self.running = True
            while True:
                future = self.future
                if not future.done():
                    return
                self.future = None
                try:
                    orig_stack_contexts = stack_context._state.contexts
                    exc_info = None

                    try:
                        value = future.result()
                    except Exception:
                        self.had_exception = True
                        exc_info = sys.exc_info()

                    if exc_info is not None:
                        yielded = self.gen.throw(*exc_info)
                        exc_info = None
                    else:
                        yielded = self.gen.send(value)

                    if stack_context._state.contexts is not orig_stack_contexts:
                        self.gen.throw(
                            stack_context.StackContextInconsistentError(
                                'stack_context inconsistency (probably caused '
                                'by yield within a "with StackContext" block)'))
                except (StopIteration, Return) as e:
                    self.finished = True
                    self.future = _null_future
                    if self.pending_callbacks and not self.had_exception:
                        # If we ran cleanly without waiting on all callbacks
                        # raise an error (really more of a warning).  If we
                        # had an exception then some callbacks may have been
                        # orphaned, so skip the check in that case.
                        raise LeakedCallbackError(
                            "finished without waiting for callbacks %r" %
                            self.pending_callbacks)
                    self.result_future.set_result(getattr(e, 'value', None))
                    self.result_future = None
                    self._deactivate_stack_context()
                    return
                except Exception:
                    self.finished = True
                    self.future = _null_future
                    self.result_future.set_exc_info(sys.exc_info())
                    self.result_future = None
                    self._deactivate_stack_context()
                    return
                if not self.handle_yield(yielded):
                    return
        finally:
            self.running = False

    def handle_yield(self, yielded):
        # Lists containing YieldPoints require stack contexts;
        # other lists are handled via multi_future in convert_yielded.
        if (isinstance(yielded, list) and
                any(isinstance(f, YieldPoint) for f in yielded)):
            yielded = Multi(yielded)
        elif (isinstance(yielded, dict) and
              any(isinstance(f, YieldPoint) for f in yielded.values())):
            yielded = Multi(yielded)

        if isinstance(yielded, YieldPoint):
            # YieldPoints are too closely coupled to the Runner to go
            # through the generic convert_yielded mechanism.
            self.future = TracebackFuture()

            def start_yield_point():
                try:
                    yielded.start(self)
                    if yielded.is_ready():
                        self.future.set_result(
                            yielded.get_result())
                    else:
                        self.yield_point = yielded
                except Exception:
                    self.future = TracebackFuture()
                    self.future.set_exc_info(sys.exc_info())

            if self.stack_context_deactivate is None:
                # Start a stack context if this is the first
                # YieldPoint we've seen.
                with stack_context.ExceptionStackContext(
                        self.handle_exception) as deactivate:
                    self.stack_context_deactivate = deactivate

                    def cb():
                        start_yield_point()
                        self.run()
                    self.io_loop.add_callback(cb)
                    return False
            else:
                start_yield_point()
        else:
            try:
                self.future = convert_yielded(yielded)
            except BadYieldError:
                self.future = TracebackFuture()
                self.future.set_exc_info(sys.exc_info())

        if not self.future.done() or self.future is moment:
            self.io_loop.add_future(
                self.future, lambda f: self.run())
            return False
        return True

    def result_callback(self, key):
        return stack_context.wrap(_argument_adapter(
            functools.partial(self.set_result, key)))

    def handle_exception(self, typ, value, tb):
        if not self.running and not self.finished:
            self.future = TracebackFuture()
            self.future.set_exc_info((typ, value, tb))
            self.run()
            return True
        else:
            return False

    def _deactivate_stack_context(self):
        if self.stack_context_deactivate is not None:
            self.stack_context_deactivate()
            self.stack_context_deactivate = None

Arguments = collections.namedtuple('Arguments', ['args', 'kwargs'])


def _argument_adapter(callback):
    """Returns a function that when invoked runs ``callback`` with one arg.

    If the function returned by this function is called with exactly
    one argument, that argument is passed to ``callback``.  Otherwise
    the args tuple and kwargs dict are wrapped in an `Arguments` object.
    """
    def wrapper(*args, **kwargs):
        if kwargs or len(args) > 1:
            callback(Arguments(args, kwargs))
        elif args:
            callback(args[0])
        else:
            callback(None)
    return wrapper


def convert_yielded(yielded):
    """Convert a yielded object into a `.Future`.

    The default implementation accepts lists, dictionaries, and Futures.

    If the `~functools.singledispatch` library is available, this function
    may be extended to support additional types. For example::

        @convert_yielded.register(asyncio.Future)
        def _(asyncio_future):
            return tornado.platform.asyncio.to_tornado_future(asyncio_future)

    .. versionadded:: 4.1
    """
    # Lists and dicts containing YieldPoints were handled separately
    # via Multi().
    if isinstance(yielded, (list, dict)):
        return multi_future(yielded)
    elif is_future(yielded):
        return yielded
    else:
        raise BadYieldError("yielded unknown object %r" % (yielded,))

if singledispatch is not None:
    convert_yielded = singledispatch(convert_yielded)
