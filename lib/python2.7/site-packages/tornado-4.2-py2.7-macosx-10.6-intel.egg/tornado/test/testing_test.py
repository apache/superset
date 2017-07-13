#!/usr/bin/env python

from __future__ import absolute_import, division, print_function, with_statement

from tornado import gen, ioloop
from tornado.log import app_log
from tornado.testing import AsyncTestCase, gen_test, ExpectLog
from tornado.test.util import unittest

import contextlib
import os
import traceback


@contextlib.contextmanager
def set_environ(name, value):
    old_value = os.environ.get(name)
    os.environ[name] = value

    try:
        yield
    finally:
        if old_value is None:
            del os.environ[name]
        else:
            os.environ[name] = old_value


class AsyncTestCaseTest(AsyncTestCase):
    def test_exception_in_callback(self):
        self.io_loop.add_callback(lambda: 1 / 0)
        try:
            self.wait()
            self.fail("did not get expected exception")
        except ZeroDivisionError:
            pass

    def test_wait_timeout(self):
        time = self.io_loop.time

        # Accept default 5-second timeout, no error
        self.io_loop.add_timeout(time() + 0.01, self.stop)
        self.wait()

        # Timeout passed to wait()
        self.io_loop.add_timeout(time() + 1, self.stop)
        with self.assertRaises(self.failureException):
            self.wait(timeout=0.01)

        # Timeout set with environment variable
        self.io_loop.add_timeout(time() + 1, self.stop)
        with set_environ('ASYNC_TEST_TIMEOUT', '0.01'):
            with self.assertRaises(self.failureException):
                self.wait()

    def test_subsequent_wait_calls(self):
        """
        This test makes sure that a second call to wait()
        clears the first timeout.
        """
        self.io_loop.add_timeout(self.io_loop.time() + 0.01, self.stop)
        self.wait(timeout=0.02)
        self.io_loop.add_timeout(self.io_loop.time() + 0.03, self.stop)
        self.wait(timeout=0.15)

    def test_multiple_errors(self):
        def fail(message):
            raise Exception(message)
        self.io_loop.add_callback(lambda: fail("error one"))
        self.io_loop.add_callback(lambda: fail("error two"))
        # The first error gets raised; the second gets logged.
        with ExpectLog(app_log, "multiple unhandled exceptions"):
            with self.assertRaises(Exception) as cm:
                self.wait()
        self.assertEqual(str(cm.exception), "error one")


class AsyncTestCaseWrapperTest(unittest.TestCase):
    def test_undecorated_generator(self):
        class Test(AsyncTestCase):
            def test_gen(self):
                yield
        test = Test('test_gen')
        result = unittest.TestResult()
        test.run(result)
        self.assertEqual(len(result.errors), 1)
        self.assertIn("should be decorated", result.errors[0][1])

    def test_undecorated_generator_with_skip(self):
        class Test(AsyncTestCase):
            @unittest.skip("don't run this")
            def test_gen(self):
                yield
        test = Test('test_gen')
        result = unittest.TestResult()
        test.run(result)
        self.assertEqual(len(result.errors), 0)
        self.assertEqual(len(result.skipped), 1)

    def test_other_return(self):
        class Test(AsyncTestCase):
            def test_other_return(self):
                return 42
        test = Test('test_other_return')
        result = unittest.TestResult()
        test.run(result)
        self.assertEqual(len(result.errors), 1)
        self.assertIn("Return value from test method ignored", result.errors[0][1])


class SetUpTearDownTest(unittest.TestCase):
    def test_set_up_tear_down(self):
        """
        This test makes sure that AsyncTestCase calls super methods for
        setUp and tearDown.

        InheritBoth is a subclass of both AsyncTestCase and
        SetUpTearDown, with the ordering so that the super of
        AsyncTestCase will be SetUpTearDown.
        """
        events = []
        result = unittest.TestResult()

        class SetUpTearDown(unittest.TestCase):
            def setUp(self):
                events.append('setUp')

            def tearDown(self):
                events.append('tearDown')

        class InheritBoth(AsyncTestCase, SetUpTearDown):
            def test(self):
                events.append('test')

        InheritBoth('test').run(result)
        expected = ['setUp', 'test', 'tearDown']
        self.assertEqual(expected, events)


class GenTest(AsyncTestCase):
    def setUp(self):
        super(GenTest, self).setUp()
        self.finished = False

    def tearDown(self):
        self.assertTrue(self.finished)
        super(GenTest, self).tearDown()

    @gen_test
    def test_sync(self):
        self.finished = True

    @gen_test
    def test_async(self):
        yield gen.Task(self.io_loop.add_callback)
        self.finished = True

    def test_timeout(self):
        # Set a short timeout and exceed it.
        @gen_test(timeout=0.1)
        def test(self):
            yield gen.Task(self.io_loop.add_timeout, self.io_loop.time() + 1)

        # This can't use assertRaises because we need to inspect the
        # exc_info triple (and not just the exception object)
        try:
            test(self)
            self.fail("did not get expected exception")
        except ioloop.TimeoutError:
            # The stack trace should blame the add_timeout line, not just
            # unrelated IOLoop/testing internals.
            self.assertIn(
                "gen.Task(self.io_loop.add_timeout, self.io_loop.time() + 1)",
                traceback.format_exc())

        self.finished = True

    def test_no_timeout(self):
        # A test that does not exceed its timeout should succeed.
        @gen_test(timeout=1)
        def test(self):
            time = self.io_loop.time
            yield gen.Task(self.io_loop.add_timeout, time() + 0.1)

        test(self)
        self.finished = True

    def test_timeout_environment_variable(self):
        @gen_test(timeout=0.5)
        def test_long_timeout(self):
            time = self.io_loop.time
            yield gen.Task(self.io_loop.add_timeout, time() + 0.25)

        # Uses provided timeout of 0.5 seconds, doesn't time out.
        with set_environ('ASYNC_TEST_TIMEOUT', '0.1'):
            test_long_timeout(self)

        self.finished = True

    def test_no_timeout_environment_variable(self):
        @gen_test(timeout=0.01)
        def test_short_timeout(self):
            time = self.io_loop.time
            yield gen.Task(self.io_loop.add_timeout, time() + 1)

        # Uses environment-variable timeout of 0.1, times out.
        with set_environ('ASYNC_TEST_TIMEOUT', '0.1'):
            with self.assertRaises(ioloop.TimeoutError):
                test_short_timeout(self)

        self.finished = True

    def test_with_method_args(self):
        @gen_test
        def test_with_args(self, *args):
            self.assertEqual(args, ('test',))
            yield gen.Task(self.io_loop.add_callback)

        test_with_args(self, 'test')
        self.finished = True

    def test_with_method_kwargs(self):
        @gen_test
        def test_with_kwargs(self, **kwargs):
            self.assertDictEqual(kwargs, {'test': 'test'})
            yield gen.Task(self.io_loop.add_callback)

        test_with_kwargs(self, test='test')
        self.finished = True

if __name__ == '__main__':
    unittest.main()
