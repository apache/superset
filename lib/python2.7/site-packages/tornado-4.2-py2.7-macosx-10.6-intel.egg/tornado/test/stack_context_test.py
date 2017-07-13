#!/usr/bin/env python
from __future__ import absolute_import, division, print_function, with_statement

from tornado import gen
from tornado.log import app_log
from tornado.stack_context import (StackContext, wrap, NullContext, StackContextInconsistentError,
                                   ExceptionStackContext, run_with_stack_context, _state)
from tornado.testing import AsyncHTTPTestCase, AsyncTestCase, ExpectLog, gen_test
from tornado.test.util import unittest
from tornado.web import asynchronous, Application, RequestHandler
import contextlib
import functools
import logging


class TestRequestHandler(RequestHandler):
    def __init__(self, app, request, io_loop):
        super(TestRequestHandler, self).__init__(app, request)
        self.io_loop = io_loop

    @asynchronous
    def get(self):
        logging.debug('in get()')
        # call self.part2 without a self.async_callback wrapper.  Its
        # exception should still get thrown
        self.io_loop.add_callback(self.part2)

    def part2(self):
        logging.debug('in part2()')
        # Go through a third layer to make sure that contexts once restored
        # are again passed on to future callbacks
        self.io_loop.add_callback(self.part3)

    def part3(self):
        logging.debug('in part3()')
        raise Exception('test exception')

    def write_error(self, status_code, **kwargs):
        if 'exc_info' in kwargs and str(kwargs['exc_info'][1]) == 'test exception':
            self.write('got expected exception')
        else:
            self.write('unexpected failure')


class HTTPStackContextTest(AsyncHTTPTestCase):
    def get_app(self):
        return Application([('/', TestRequestHandler,
                             dict(io_loop=self.io_loop))])

    def test_stack_context(self):
        with ExpectLog(app_log, "Uncaught exception GET /"):
            self.http_client.fetch(self.get_url('/'), self.handle_response)
            self.wait()
        self.assertEqual(self.response.code, 500)
        self.assertTrue(b'got expected exception' in self.response.body)

    def handle_response(self, response):
        self.response = response
        self.stop()


class StackContextTest(AsyncTestCase):
    def setUp(self):
        super(StackContextTest, self).setUp()
        self.active_contexts = []

    @contextlib.contextmanager
    def context(self, name):
        self.active_contexts.append(name)
        yield
        self.assertEqual(self.active_contexts.pop(), name)

    # Simulates the effect of an asynchronous library that uses its own
    # StackContext internally and then returns control to the application.
    def test_exit_library_context(self):
        def library_function(callback):
            # capture the caller's context before introducing our own
            callback = wrap(callback)
            with StackContext(functools.partial(self.context, 'library')):
                self.io_loop.add_callback(
                    functools.partial(library_inner_callback, callback))

        def library_inner_callback(callback):
            self.assertEqual(self.active_contexts[-2:],
                             ['application', 'library'])
            callback()

        def final_callback():
            # implementation detail:  the full context stack at this point
            # is ['application', 'library', 'application'].  The 'library'
            # context was not removed, but is no longer innermost so
            # the application context takes precedence.
            self.assertEqual(self.active_contexts[-1], 'application')
            self.stop()
        with StackContext(functools.partial(self.context, 'application')):
            library_function(final_callback)
        self.wait()

    def test_deactivate(self):
        deactivate_callbacks = []

        def f1():
            with StackContext(functools.partial(self.context, 'c1')) as c1:
                deactivate_callbacks.append(c1)
                self.io_loop.add_callback(f2)

        def f2():
            with StackContext(functools.partial(self.context, 'c2')) as c2:
                deactivate_callbacks.append(c2)
                self.io_loop.add_callback(f3)

        def f3():
            with StackContext(functools.partial(self.context, 'c3')) as c3:
                deactivate_callbacks.append(c3)
                self.io_loop.add_callback(f4)

        def f4():
            self.assertEqual(self.active_contexts, ['c1', 'c2', 'c3'])
            deactivate_callbacks[1]()
            # deactivating a context doesn't remove it immediately,
            # but it will be missing from the next iteration
            self.assertEqual(self.active_contexts, ['c1', 'c2', 'c3'])
            self.io_loop.add_callback(f5)

        def f5():
            self.assertEqual(self.active_contexts, ['c1', 'c3'])
            self.stop()
        self.io_loop.add_callback(f1)
        self.wait()

    def test_deactivate_order(self):
        # Stack context deactivation has separate logic for deactivation at
        # the head and tail of the stack, so make sure it works in any order.
        def check_contexts():
            # Make sure that the full-context array and the exception-context
            # linked lists are consistent with each other.
            full_contexts, chain = _state.contexts
            exception_contexts = []
            while chain is not None:
                exception_contexts.append(chain)
                chain = chain.old_contexts[1]
            self.assertEqual(list(reversed(full_contexts)), exception_contexts)
            return list(self.active_contexts)

        def make_wrapped_function():
            """Wraps a function in three stack contexts, and returns
            the function along with the deactivation functions.
            """
            # Remove the test's stack context to make sure we can cover
            # the case where the last context is deactivated.
            with NullContext():
                partial = functools.partial
                with StackContext(partial(self.context, 'c0')) as c0:
                    with StackContext(partial(self.context, 'c1')) as c1:
                        with StackContext(partial(self.context, 'c2')) as c2:
                            return (wrap(check_contexts), [c0, c1, c2])

        # First make sure the test mechanism works without any deactivations
        func, deactivate_callbacks = make_wrapped_function()
        self.assertEqual(func(), ['c0', 'c1', 'c2'])

        # Deactivate the tail
        func, deactivate_callbacks = make_wrapped_function()
        deactivate_callbacks[0]()
        self.assertEqual(func(), ['c1', 'c2'])

        # Deactivate the middle
        func, deactivate_callbacks = make_wrapped_function()
        deactivate_callbacks[1]()
        self.assertEqual(func(), ['c0', 'c2'])

        # Deactivate the head
        func, deactivate_callbacks = make_wrapped_function()
        deactivate_callbacks[2]()
        self.assertEqual(func(), ['c0', 'c1'])

    def test_isolation_nonempty(self):
        # f2 and f3 are a chain of operations started in context c1.
        # f2 is incidentally run under context c2, but that context should
        # not be passed along to f3.
        def f1():
            with StackContext(functools.partial(self.context, 'c1')):
                wrapped = wrap(f2)
            with StackContext(functools.partial(self.context, 'c2')):
                wrapped()

        def f2():
            self.assertIn('c1', self.active_contexts)
            self.io_loop.add_callback(f3)

        def f3():
            self.assertIn('c1', self.active_contexts)
            self.assertNotIn('c2', self.active_contexts)
            self.stop()

        self.io_loop.add_callback(f1)
        self.wait()

    def test_isolation_empty(self):
        # Similar to test_isolation_nonempty, but here the f2/f3 chain
        # is started without any context.  Behavior should be equivalent
        # to the nonempty case (although historically it was not)
        def f1():
            with NullContext():
                wrapped = wrap(f2)
            with StackContext(functools.partial(self.context, 'c2')):
                wrapped()

        def f2():
            self.io_loop.add_callback(f3)

        def f3():
            self.assertNotIn('c2', self.active_contexts)
            self.stop()

        self.io_loop.add_callback(f1)
        self.wait()

    def test_yield_in_with(self):
        @gen.engine
        def f():
            self.callback = yield gen.Callback('a')
            with StackContext(functools.partial(self.context, 'c1')):
                # This yield is a problem: the generator will be suspended
                # and the StackContext's __exit__ is not called yet, so
                # the context will be left on _state.contexts for anything
                # that runs before the yield resolves.
                yield gen.Wait('a')

        with self.assertRaises(StackContextInconsistentError):
            f()
            self.wait()
        # Cleanup: to avoid GC warnings (which for some reason only seem
        # to show up on py33-asyncio), invoke the callback (which will do
        # nothing since the gen.Runner is already finished) and delete it.
        self.callback()
        del self.callback

    @gen_test
    def test_yield_outside_with(self):
        # This pattern avoids the problem in the previous test.
        cb = yield gen.Callback('k1')
        with StackContext(functools.partial(self.context, 'c1')):
            self.io_loop.add_callback(cb)
        yield gen.Wait('k1')

    def test_yield_in_with_exception_stack_context(self):
        # As above, but with ExceptionStackContext instead of StackContext.
        @gen.engine
        def f():
            with ExceptionStackContext(lambda t, v, tb: False):
                yield gen.Task(self.io_loop.add_callback)

        with self.assertRaises(StackContextInconsistentError):
            f()
            self.wait()

    @gen_test
    def test_yield_outside_with_exception_stack_context(self):
        cb = yield gen.Callback('k1')
        with ExceptionStackContext(lambda t, v, tb: False):
            self.io_loop.add_callback(cb)
        yield gen.Wait('k1')

    @gen_test
    def test_run_with_stack_context(self):
        @gen.coroutine
        def f1():
            self.assertEqual(self.active_contexts, ['c1'])
            yield run_with_stack_context(
                StackContext(functools.partial(self.context, 'c2')),
                f2)
            self.assertEqual(self.active_contexts, ['c1'])

        @gen.coroutine
        def f2():
            self.assertEqual(self.active_contexts, ['c1', 'c2'])
            yield gen.Task(self.io_loop.add_callback)
            self.assertEqual(self.active_contexts, ['c1', 'c2'])

        self.assertEqual(self.active_contexts, [])
        yield run_with_stack_context(
            StackContext(functools.partial(self.context, 'c1')),
            f1)
        self.assertEqual(self.active_contexts, [])

if __name__ == '__main__':
    unittest.main()
