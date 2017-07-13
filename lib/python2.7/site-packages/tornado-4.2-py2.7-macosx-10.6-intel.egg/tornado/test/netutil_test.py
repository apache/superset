from __future__ import absolute_import, division, print_function, with_statement

import os
import signal
import socket
from subprocess import Popen
import sys
import time

from tornado.netutil import BlockingResolver, ThreadedResolver, is_valid_ip, bind_sockets
from tornado.stack_context import ExceptionStackContext
from tornado.testing import AsyncTestCase, gen_test
from tornado.test.util import unittest, skipIfNoNetwork

try:
    from concurrent import futures
except ImportError:
    futures = None

try:
    import pycares
except ImportError:
    pycares = None
else:
    from tornado.platform.caresresolver import CaresResolver

try:
    import twisted
    import twisted.names
except ImportError:
    twisted = None
else:
    from tornado.platform.twisted import TwistedResolver


class _ResolverTestMixin(object):
    def test_localhost(self):
        self.resolver.resolve('localhost', 80, callback=self.stop)
        result = self.wait()
        self.assertIn((socket.AF_INET, ('127.0.0.1', 80)), result)

    @gen_test
    def test_future_interface(self):
        addrinfo = yield self.resolver.resolve('localhost', 80,
                                               socket.AF_UNSPEC)
        self.assertIn((socket.AF_INET, ('127.0.0.1', 80)),
                      addrinfo)


# It is impossible to quickly and consistently generate an error in name
# resolution, so test this case separately, using mocks as needed.
class _ResolverErrorTestMixin(object):
    def test_bad_host(self):
        def handler(exc_typ, exc_val, exc_tb):
            self.stop(exc_val)
            return True  # Halt propagation.

        with ExceptionStackContext(handler):
            self.resolver.resolve('an invalid domain', 80, callback=self.stop)

        result = self.wait()
        self.assertIsInstance(result, Exception)

    @gen_test
    def test_future_interface_bad_host(self):
        with self.assertRaises(Exception):
            yield self.resolver.resolve('an invalid domain', 80,
                                        socket.AF_UNSPEC)


def _failing_getaddrinfo(*args):
    """Dummy implementation of getaddrinfo for use in mocks"""
    raise socket.gaierror("mock: lookup failed")


@skipIfNoNetwork
class BlockingResolverTest(AsyncTestCase, _ResolverTestMixin):
    def setUp(self):
        super(BlockingResolverTest, self).setUp()
        self.resolver = BlockingResolver(io_loop=self.io_loop)


# getaddrinfo-based tests need mocking to reliably generate errors;
# some configurations are slow to produce errors and take longer than
# our default timeout.
class BlockingResolverErrorTest(AsyncTestCase, _ResolverErrorTestMixin):
    def setUp(self):
        super(BlockingResolverErrorTest, self).setUp()
        self.resolver = BlockingResolver(io_loop=self.io_loop)
        self.real_getaddrinfo = socket.getaddrinfo
        socket.getaddrinfo = _failing_getaddrinfo

    def tearDown(self):
        socket.getaddrinfo = self.real_getaddrinfo
        super(BlockingResolverErrorTest, self).tearDown()


@skipIfNoNetwork
@unittest.skipIf(futures is None, "futures module not present")
class ThreadedResolverTest(AsyncTestCase, _ResolverTestMixin):
    def setUp(self):
        super(ThreadedResolverTest, self).setUp()
        self.resolver = ThreadedResolver(io_loop=self.io_loop)

    def tearDown(self):
        self.resolver.close()
        super(ThreadedResolverTest, self).tearDown()


class ThreadedResolverErrorTest(AsyncTestCase, _ResolverErrorTestMixin):
    def setUp(self):
        super(ThreadedResolverErrorTest, self).setUp()
        self.resolver = BlockingResolver(io_loop=self.io_loop)
        self.real_getaddrinfo = socket.getaddrinfo
        socket.getaddrinfo = _failing_getaddrinfo

    def tearDown(self):
        socket.getaddrinfo = self.real_getaddrinfo
        super(ThreadedResolverErrorTest, self).tearDown()


@skipIfNoNetwork
@unittest.skipIf(futures is None, "futures module not present")
@unittest.skipIf(sys.platform == 'win32', "preexec_fn not available on win32")
class ThreadedResolverImportTest(unittest.TestCase):
    def test_import(self):
        TIMEOUT = 5

        # Test for a deadlock when importing a module that runs the
        # ThreadedResolver at import-time. See resolve_test.py for
        # full explanation.
        command = [
            sys.executable,
            '-c',
            'import tornado.test.resolve_test_helper']

        start = time.time()
        popen = Popen(command, preexec_fn=lambda: signal.alarm(TIMEOUT))
        while time.time() - start < TIMEOUT:
            return_code = popen.poll()
            if return_code is not None:
                self.assertEqual(0, return_code)
                return  # Success.
            time.sleep(0.05)

        self.fail("import timed out")


# We do not test errors with CaresResolver:
# Some DNS-hijacking ISPs (e.g. Time Warner) return non-empty results
# with an NXDOMAIN status code.  Most resolvers treat this as an error;
# C-ares returns the results, making the "bad_host" tests unreliable.
# C-ares will try to resolve even malformed names, such as the
# name with spaces used in this test.
@skipIfNoNetwork
@unittest.skipIf(pycares is None, "pycares module not present")
class CaresResolverTest(AsyncTestCase, _ResolverTestMixin):
    def setUp(self):
        super(CaresResolverTest, self).setUp()
        self.resolver = CaresResolver(io_loop=self.io_loop)


# TwistedResolver produces consistent errors in our test cases so we
# can test the regular and error cases in the same class.
@skipIfNoNetwork
@unittest.skipIf(twisted is None, "twisted module not present")
@unittest.skipIf(getattr(twisted, '__version__', '0.0') < "12.1", "old version of twisted")
class TwistedResolverTest(AsyncTestCase, _ResolverTestMixin,
                          _ResolverErrorTestMixin):
    def setUp(self):
        super(TwistedResolverTest, self).setUp()
        self.resolver = TwistedResolver(io_loop=self.io_loop)


class IsValidIPTest(unittest.TestCase):
    def test_is_valid_ip(self):
        self.assertTrue(is_valid_ip('127.0.0.1'))
        self.assertTrue(is_valid_ip('4.4.4.4'))
        self.assertTrue(is_valid_ip('::1'))
        self.assertTrue(is_valid_ip('2620:0:1cfe:face:b00c::3'))
        self.assertTrue(not is_valid_ip('www.google.com'))
        self.assertTrue(not is_valid_ip('localhost'))
        self.assertTrue(not is_valid_ip('4.4.4.4<'))
        self.assertTrue(not is_valid_ip(' 127.0.0.1'))
        self.assertTrue(not is_valid_ip(''))
        self.assertTrue(not is_valid_ip(' '))
        self.assertTrue(not is_valid_ip('\n'))
        self.assertTrue(not is_valid_ip('\x00'))


class TestPortAllocation(unittest.TestCase):
    def test_same_port_allocation(self):
        if 'TRAVIS' in os.environ:
            self.skipTest("dual-stack servers often have port conflicts on travis")
        sockets = bind_sockets(None, 'localhost')
        try:
            port = sockets[0].getsockname()[1]
            self.assertTrue(all(s.getsockname()[1] == port
                                for s in sockets[1:]))
        finally:
            for sock in sockets:
                sock.close()
