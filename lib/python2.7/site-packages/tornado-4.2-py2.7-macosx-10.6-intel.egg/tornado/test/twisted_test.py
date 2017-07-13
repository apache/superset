# Author: Ovidiu Predescu
# Date: July 2011
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
Unittest for the twisted-style reactor.
"""

from __future__ import absolute_import, division, print_function, with_statement

import logging
import os
import shutil
import signal
import sys
import tempfile
import threading
import warnings

try:
    import fcntl
    from twisted.internet.defer import Deferred, inlineCallbacks, returnValue
    from twisted.internet.interfaces import IReadDescriptor, IWriteDescriptor
    from twisted.internet.protocol import Protocol
    from twisted.python import log
    from tornado.platform.twisted import TornadoReactor, TwistedIOLoop
    from zope.interface import implementer
    have_twisted = True
except ImportError:
    have_twisted = False

# The core of Twisted 12.3.0 is available on python 3, but twisted.web is not
# so test for it separately.
try:
    from twisted.web.client import Agent, readBody
    from twisted.web.resource import Resource
    from twisted.web.server import Site
    # As of Twisted 15.0.0, twisted.web is present but fails our
    # tests due to internal str/bytes errors.
    have_twisted_web = sys.version_info < (3,)
except ImportError:
    have_twisted_web = False

try:
    import thread  # py2
except ImportError:
    import _thread as thread  # py3

from tornado.escape import utf8
from tornado import gen
from tornado.httpclient import AsyncHTTPClient
from tornado.httpserver import HTTPServer
from tornado.ioloop import IOLoop
from tornado.platform.auto import set_close_exec
from tornado.platform.select import SelectIOLoop
from tornado.testing import bind_unused_port
from tornado.test.util import unittest
from tornado.util import import_object
from tornado.web import RequestHandler, Application

skipIfNoTwisted = unittest.skipUnless(have_twisted,
                                      "twisted module not present")

skipIfNoSingleDispatch = unittest.skipIf(
    gen.singledispatch is None, "singledispatch module not present")


def save_signal_handlers():
    saved = {}
    for sig in [signal.SIGINT, signal.SIGTERM, signal.SIGCHLD]:
        saved[sig] = signal.getsignal(sig)
    if "twisted" in repr(saved):
        if not issubclass(IOLoop.configured_class(), TwistedIOLoop):
            # when the global ioloop is twisted, we expect the signal
            # handlers to be installed.  Otherwise, it means we're not
            # cleaning up after twisted properly.
            raise Exception("twisted signal handlers already installed")
    return saved


def restore_signal_handlers(saved):
    for sig, handler in saved.items():
        signal.signal(sig, handler)


class ReactorTestCase(unittest.TestCase):
    def setUp(self):
        self._saved_signals = save_signal_handlers()
        self._io_loop = IOLoop()
        self._reactor = TornadoReactor(self._io_loop)

    def tearDown(self):
        self._io_loop.close(all_fds=True)
        restore_signal_handlers(self._saved_signals)


@skipIfNoTwisted
class ReactorWhenRunningTest(ReactorTestCase):
    def test_whenRunning(self):
        self._whenRunningCalled = False
        self._anotherWhenRunningCalled = False
        self._reactor.callWhenRunning(self.whenRunningCallback)
        self._reactor.run()
        self.assertTrue(self._whenRunningCalled)
        self.assertTrue(self._anotherWhenRunningCalled)

    def whenRunningCallback(self):
        self._whenRunningCalled = True
        self._reactor.callWhenRunning(self.anotherWhenRunningCallback)
        self._reactor.stop()

    def anotherWhenRunningCallback(self):
        self._anotherWhenRunningCalled = True


@skipIfNoTwisted
class ReactorCallLaterTest(ReactorTestCase):
    def test_callLater(self):
        self._laterCalled = False
        self._now = self._reactor.seconds()
        self._timeout = 0.001
        dc = self._reactor.callLater(self._timeout, self.callLaterCallback)
        self.assertEqual(self._reactor.getDelayedCalls(), [dc])
        self._reactor.run()
        self.assertTrue(self._laterCalled)
        self.assertTrue(self._called - self._now > self._timeout)
        self.assertEqual(self._reactor.getDelayedCalls(), [])

    def callLaterCallback(self):
        self._laterCalled = True
        self._called = self._reactor.seconds()
        self._reactor.stop()


@skipIfNoTwisted
class ReactorTwoCallLaterTest(ReactorTestCase):
    def test_callLater(self):
        self._later1Called = False
        self._later2Called = False
        self._now = self._reactor.seconds()
        self._timeout1 = 0.0005
        dc1 = self._reactor.callLater(self._timeout1, self.callLaterCallback1)
        self._timeout2 = 0.001
        dc2 = self._reactor.callLater(self._timeout2, self.callLaterCallback2)
        self.assertTrue(self._reactor.getDelayedCalls() == [dc1, dc2] or
                        self._reactor.getDelayedCalls() == [dc2, dc1])
        self._reactor.run()
        self.assertTrue(self._later1Called)
        self.assertTrue(self._later2Called)
        self.assertTrue(self._called1 - self._now > self._timeout1)
        self.assertTrue(self._called2 - self._now > self._timeout2)
        self.assertEqual(self._reactor.getDelayedCalls(), [])

    def callLaterCallback1(self):
        self._later1Called = True
        self._called1 = self._reactor.seconds()

    def callLaterCallback2(self):
        self._later2Called = True
        self._called2 = self._reactor.seconds()
        self._reactor.stop()


@skipIfNoTwisted
class ReactorCallFromThreadTest(ReactorTestCase):
    def setUp(self):
        super(ReactorCallFromThreadTest, self).setUp()
        self._mainThread = thread.get_ident()

    def tearDown(self):
        self._thread.join()
        super(ReactorCallFromThreadTest, self).tearDown()

    def _newThreadRun(self):
        self.assertNotEqual(self._mainThread, thread.get_ident())
        if hasattr(self._thread, 'ident'):  # new in python 2.6
            self.assertEqual(self._thread.ident, thread.get_ident())
        self._reactor.callFromThread(self._fnCalledFromThread)

    def _fnCalledFromThread(self):
        self.assertEqual(self._mainThread, thread.get_ident())
        self._reactor.stop()

    def _whenRunningCallback(self):
        self._thread = threading.Thread(target=self._newThreadRun)
        self._thread.start()

    def testCallFromThread(self):
        self._reactor.callWhenRunning(self._whenRunningCallback)
        self._reactor.run()


@skipIfNoTwisted
class ReactorCallInThread(ReactorTestCase):
    def setUp(self):
        super(ReactorCallInThread, self).setUp()
        self._mainThread = thread.get_ident()

    def _fnCalledInThread(self, *args, **kwargs):
        self.assertNotEqual(thread.get_ident(), self._mainThread)
        self._reactor.callFromThread(lambda: self._reactor.stop())

    def _whenRunningCallback(self):
        self._reactor.callInThread(self._fnCalledInThread)

    def testCallInThread(self):
        self._reactor.callWhenRunning(self._whenRunningCallback)
        self._reactor.run()


class Reader(object):
    def __init__(self, fd, callback):
        self._fd = fd
        self._callback = callback

    def logPrefix(self):
        return "Reader"

    def close(self):
        self._fd.close()

    def fileno(self):
        return self._fd.fileno()

    def readConnectionLost(self, reason):
        self.close()

    def connectionLost(self, reason):
        self.close()

    def doRead(self):
        self._callback(self._fd)
if have_twisted:
    Reader = implementer(IReadDescriptor)(Reader)


class Writer(object):
    def __init__(self, fd, callback):
        self._fd = fd
        self._callback = callback

    def logPrefix(self):
        return "Writer"

    def close(self):
        self._fd.close()

    def fileno(self):
        return self._fd.fileno()

    def connectionLost(self, reason):
        self.close()

    def doWrite(self):
        self._callback(self._fd)
if have_twisted:
    Writer = implementer(IWriteDescriptor)(Writer)


@skipIfNoTwisted
class ReactorReaderWriterTest(ReactorTestCase):
    def _set_nonblocking(self, fd):
        flags = fcntl.fcntl(fd, fcntl.F_GETFL)
        fcntl.fcntl(fd, fcntl.F_SETFL, flags | os.O_NONBLOCK)

    def setUp(self):
        super(ReactorReaderWriterTest, self).setUp()
        r, w = os.pipe()
        self._set_nonblocking(r)
        self._set_nonblocking(w)
        set_close_exec(r)
        set_close_exec(w)
        self._p1 = os.fdopen(r, "rb", 0)
        self._p2 = os.fdopen(w, "wb", 0)

    def tearDown(self):
        super(ReactorReaderWriterTest, self).tearDown()
        self._p1.close()
        self._p2.close()

    def _testReadWrite(self):
        """
        In this test the writer writes an 'x' to its fd. The reader
        reads it, check the value and ends the test.
        """
        self.shouldWrite = True

        def checkReadInput(fd):
            self.assertEquals(fd.read(1), b'x')
            self._reactor.stop()

        def writeOnce(fd):
            if self.shouldWrite:
                self.shouldWrite = False
                fd.write(b'x')
        self._reader = Reader(self._p1, checkReadInput)
        self._writer = Writer(self._p2, writeOnce)

        self._reactor.addWriter(self._writer)

        # Test that adding the reader twice adds it only once to
        # IOLoop.
        self._reactor.addReader(self._reader)
        self._reactor.addReader(self._reader)

    def testReadWrite(self):
        self._reactor.callWhenRunning(self._testReadWrite)
        self._reactor.run()

    def _testNoWriter(self):
        """
        In this test we have no writer. Make sure the reader doesn't
        read anything.
        """
        def checkReadInput(fd):
            self.fail("Must not be called.")

        def stopTest():
            # Close the writer here since the IOLoop doesn't know
            # about it.
            self._writer.close()
            self._reactor.stop()
        self._reader = Reader(self._p1, checkReadInput)

        # We create a writer, but it should never be invoked.
        self._writer = Writer(self._p2, lambda fd: fd.write('x'))

        # Test that adding and removing the writer leaves us with no writer.
        self._reactor.addWriter(self._writer)
        self._reactor.removeWriter(self._writer)

        # Test that adding and removing the reader doesn't cause
        # unintended effects.
        self._reactor.addReader(self._reader)

        # Wake up after a moment and stop the test
        self._reactor.callLater(0.001, stopTest)

    def testNoWriter(self):
        self._reactor.callWhenRunning(self._testNoWriter)
        self._reactor.run()

# Test various combinations of twisted and tornado http servers,
# http clients, and event loop interfaces.


@skipIfNoTwisted
@unittest.skipIf(not have_twisted_web, 'twisted web not present')
class CompatibilityTests(unittest.TestCase):
    def setUp(self):
        self.saved_signals = save_signal_handlers()
        self.io_loop = IOLoop()
        self.io_loop.make_current()
        self.reactor = TornadoReactor(self.io_loop)

    def tearDown(self):
        self.reactor.disconnectAll()
        self.io_loop.clear_current()
        self.io_loop.close(all_fds=True)
        restore_signal_handlers(self.saved_signals)

    def start_twisted_server(self):
        class HelloResource(Resource):
            isLeaf = True

            def render_GET(self, request):
                return "Hello from twisted!"
        site = Site(HelloResource())
        port = self.reactor.listenTCP(0, site, interface='127.0.0.1')
        self.twisted_port = port.getHost().port

    def start_tornado_server(self):
        class HelloHandler(RequestHandler):
            def get(self):
                self.write("Hello from tornado!")
        app = Application([('/', HelloHandler)],
                          log_function=lambda x: None)
        server = HTTPServer(app, io_loop=self.io_loop)
        sock, self.tornado_port = bind_unused_port()
        server.add_sockets([sock])

    def run_ioloop(self):
        self.stop_loop = self.io_loop.stop
        self.io_loop.start()
        self.reactor.fireSystemEvent('shutdown')

    def run_reactor(self):
        self.stop_loop = self.reactor.stop
        self.stop = self.reactor.stop
        self.reactor.run()

    def tornado_fetch(self, url, runner):
        responses = []
        client = AsyncHTTPClient(self.io_loop)

        def callback(response):
            responses.append(response)
            self.stop_loop()
        client.fetch(url, callback=callback)
        runner()
        self.assertEqual(len(responses), 1)
        responses[0].rethrow()
        return responses[0]

    def twisted_fetch(self, url, runner):
        # http://twistedmatrix.com/documents/current/web/howto/client.html
        chunks = []
        client = Agent(self.reactor)
        d = client.request(b'GET', utf8(url))

        class Accumulator(Protocol):
            def __init__(self, finished):
                self.finished = finished

            def dataReceived(self, data):
                chunks.append(data)

            def connectionLost(self, reason):
                self.finished.callback(None)

        def callback(response):
            finished = Deferred()
            response.deliverBody(Accumulator(finished))
            return finished
        d.addCallback(callback)

        def shutdown(failure):
            if hasattr(self, 'stop_loop'):
                self.stop_loop()
            elif failure is not None:
                # loop hasn't been initialized yet; try our best to
                # get an error message out. (the runner() interaction
                # should probably be refactored).
                try:
                    failure.raiseException()
                except:
                    logging.error('exception before starting loop', exc_info=True)
        d.addBoth(shutdown)
        runner()
        self.assertTrue(chunks)
        return ''.join(chunks)

    def twisted_coroutine_fetch(self, url, runner):
        body = [None]

        @gen.coroutine
        def f():
            # This is simpler than the non-coroutine version, but it cheats
            # by reading the body in one blob instead of streaming it with
            # a Protocol.
            client = Agent(self.reactor)
            response = yield client.request(b'GET', utf8(url))
            with warnings.catch_warnings():
                # readBody has a buggy DeprecationWarning in Twisted 15.0:
                # https://twistedmatrix.com/trac/changeset/43379
                warnings.simplefilter('ignore', category=DeprecationWarning)
                body[0] = yield readBody(response)
            self.stop_loop()
        self.io_loop.add_callback(f)
        runner()
        return body[0]

    def testTwistedServerTornadoClientIOLoop(self):
        self.start_twisted_server()
        response = self.tornado_fetch(
            'http://127.0.0.1:%d' % self.twisted_port, self.run_ioloop)
        self.assertEqual(response.body, 'Hello from twisted!')

    def testTwistedServerTornadoClientReactor(self):
        self.start_twisted_server()
        response = self.tornado_fetch(
            'http://127.0.0.1:%d' % self.twisted_port, self.run_reactor)
        self.assertEqual(response.body, 'Hello from twisted!')

    def testTornadoServerTwistedClientIOLoop(self):
        self.start_tornado_server()
        response = self.twisted_fetch(
            'http://127.0.0.1:%d' % self.tornado_port, self.run_ioloop)
        self.assertEqual(response, 'Hello from tornado!')

    def testTornadoServerTwistedClientReactor(self):
        self.start_tornado_server()
        response = self.twisted_fetch(
            'http://127.0.0.1:%d' % self.tornado_port, self.run_reactor)
        self.assertEqual(response, 'Hello from tornado!')

    @skipIfNoSingleDispatch
    def testTornadoServerTwistedCoroutineClientIOLoop(self):
        self.start_tornado_server()
        response = self.twisted_coroutine_fetch(
            'http://127.0.0.1:%d' % self.tornado_port, self.run_ioloop)
        self.assertEqual(response, 'Hello from tornado!')


@skipIfNoTwisted
@skipIfNoSingleDispatch
class ConvertDeferredTest(unittest.TestCase):
    def test_success(self):
        @inlineCallbacks
        def fn():
            if False:
                # inlineCallbacks doesn't work with regular functions;
                # must have a yield even if it's unreachable.
                yield
            returnValue(42)
        f = gen.convert_yielded(fn())
        self.assertEqual(f.result(), 42)

    def test_failure(self):
        @inlineCallbacks
        def fn():
            if False:
                yield
            1 / 0
        f = gen.convert_yielded(fn())
        with self.assertRaises(ZeroDivisionError):
            f.result()


if have_twisted:
    # Import and run as much of twisted's test suite as possible.
    # This is unfortunately rather dependent on implementation details,
    # but there doesn't appear to be a clean all-in-one conformance test
    # suite for reactors.
    #
    # This is a list of all test suites using the ReactorBuilder
    # available in Twisted 11.0.0 and 11.1.0 (and a blacklist of
    # specific test methods to be disabled).
    twisted_tests = {
        'twisted.internet.test.test_core.ObjectModelIntegrationTest': [],
        'twisted.internet.test.test_core.SystemEventTestsBuilder': [
            'test_iterate',  # deliberately not supported
            # Fails on TwistedIOLoop and AsyncIOLoop.
            'test_runAfterCrash',
        ],
        'twisted.internet.test.test_fdset.ReactorFDSetTestsBuilder': [
            "test_lostFileDescriptor",  # incompatible with epoll and kqueue
        ],
        'twisted.internet.test.test_process.ProcessTestsBuilder': [
            # Only work as root.  Twisted's "skip" functionality works
            # with py27+, but not unittest2 on py26.
            'test_changeGID',
            'test_changeUID',
        ],
        # Process tests appear to work on OSX 10.7, but not 10.6
        # 'twisted.internet.test.test_process.PTYProcessTestsBuilder': [
        #    'test_systemCallUninterruptedByChildExit',
        #    ],
        'twisted.internet.test.test_tcp.TCPClientTestsBuilder': [
            'test_badContext',  # ssl-related; see also SSLClientTestsMixin
        ],
        'twisted.internet.test.test_tcp.TCPPortTestsBuilder': [
            # These use link-local addresses and cause firewall prompts on mac
            'test_buildProtocolIPv6AddressScopeID',
            'test_portGetHostOnIPv6ScopeID',
            'test_serverGetHostOnIPv6ScopeID',
            'test_serverGetPeerOnIPv6ScopeID',
        ],
        'twisted.internet.test.test_tcp.TCPConnectionTestsBuilder': [],
        'twisted.internet.test.test_tcp.WriteSequenceTests': [],
        'twisted.internet.test.test_tcp.AbortConnectionTestCase': [],
        'twisted.internet.test.test_threads.ThreadTestsBuilder': [],
        'twisted.internet.test.test_time.TimeTestsBuilder': [],
        # Extra third-party dependencies (pyOpenSSL)
        # 'twisted.internet.test.test_tls.SSLClientTestsMixin': [],
        'twisted.internet.test.test_udp.UDPServerTestsBuilder': [],
        'twisted.internet.test.test_unix.UNIXTestsBuilder': [
            # Platform-specific.  These tests would be skipped automatically
            # if we were running twisted's own test runner.
            'test_connectToLinuxAbstractNamespace',
            'test_listenOnLinuxAbstractNamespace',
            # These tests use twisted's sendmsg.c extension and sometimes
            # fail with what looks like uninitialized memory errors
            # (more common on pypy than cpython, but I've seen it on both)
            'test_sendFileDescriptor',
            'test_sendFileDescriptorTriggersPauseProducing',
            'test_descriptorDeliveredBeforeBytes',
            'test_avoidLeakingFileDescriptors',
        ],
        'twisted.internet.test.test_unix.UNIXDatagramTestsBuilder': [
            'test_listenOnLinuxAbstractNamespace',
        ],
        'twisted.internet.test.test_unix.UNIXPortTestsBuilder': [],
    }
    if sys.version_info >= (3,):
        # In Twisted 15.2.0 on Python 3.4, the process tests will try to run
        # but fail, due in part to interactions between Tornado's strict
        # warnings-as-errors policy and Twisted's own warning handling
        # (it was not obvious how to configure the warnings module to
        # reconcile the two), and partly due to what looks like a packaging
        # error (process_cli.py missing). For now, just skip it.
        del twisted_tests['twisted.internet.test.test_process.ProcessTestsBuilder']
    for test_name, blacklist in twisted_tests.items():
        try:
            test_class = import_object(test_name)
        except (ImportError, AttributeError):
            continue
        for test_func in blacklist:
            if hasattr(test_class, test_func):
                # The test_func may be defined in a mixin, so clobber
                # it instead of delattr()
                setattr(test_class, test_func, lambda self: None)

        def make_test_subclass(test_class):
            class TornadoTest(test_class):
                _reactors = ["tornado.platform.twisted._TestReactor"]

                def setUp(self):
                    # Twisted's tests expect to be run from a temporary
                    # directory; they create files in their working directory
                    # and don't always clean up after themselves.
                    self.__curdir = os.getcwd()
                    self.__tempdir = tempfile.mkdtemp()
                    os.chdir(self.__tempdir)
                    super(TornadoTest, self).setUp()

                def tearDown(self):
                    super(TornadoTest, self).tearDown()
                    os.chdir(self.__curdir)
                    shutil.rmtree(self.__tempdir)

                def buildReactor(self):
                    self.__saved_signals = save_signal_handlers()
                    return test_class.buildReactor(self)

                def unbuildReactor(self, reactor):
                    test_class.unbuildReactor(self, reactor)
                    # Clean up file descriptors (especially epoll/kqueue
                    # objects) eagerly instead of leaving them for the
                    # GC.  Unfortunately we can't do this in reactor.stop
                    # since twisted expects to be able to unregister
                    # connections in a post-shutdown hook.
                    reactor._io_loop.close(all_fds=True)
                    restore_signal_handlers(self.__saved_signals)

            TornadoTest.__name__ = test_class.__name__
            return TornadoTest
        test_subclass = make_test_subclass(test_class)
        globals().update(test_subclass.makeTestCaseClasses())

    # Since we're not using twisted's test runner, it's tricky to get
    # logging set up well.  Most of the time it's easiest to just
    # leave it turned off, but while working on these tests you may want
    # to uncomment one of the other lines instead.
    log.defaultObserver.stop()
    # import sys; log.startLogging(sys.stderr, setStdout=0)
    # log.startLoggingWithObserver(log.PythonLoggingObserver().emit, setStdout=0)
    # import logging; logging.getLogger('twisted').setLevel(logging.WARNING)

if have_twisted:
    class LayeredTwistedIOLoop(TwistedIOLoop):
        """Layers a TwistedIOLoop on top of a TornadoReactor on a SelectIOLoop.

        This is of course silly, but is useful for testing purposes to make
        sure we're implementing both sides of the various interfaces
        correctly.  In some tests another TornadoReactor is layered on top
        of the whole stack.
        """
        def initialize(self, **kwargs):
            # When configured to use LayeredTwistedIOLoop we can't easily
            # get the next-best IOLoop implementation, so use the lowest common
            # denominator.
            self.real_io_loop = SelectIOLoop()
            reactor = TornadoReactor(io_loop=self.real_io_loop)
            super(LayeredTwistedIOLoop, self).initialize(reactor=reactor, **kwargs)
            self.add_callback(self.make_current)

        def close(self, all_fds=False):
            super(LayeredTwistedIOLoop, self).close(all_fds=all_fds)
            # HACK: This is the same thing that test_class.unbuildReactor does.
            for reader in self.reactor._internalReaders:
                self.reactor.removeReader(reader)
                reader.connectionLost(None)
            self.real_io_loop.close(all_fds=all_fds)

        def stop(self):
            # One of twisted's tests fails if I don't delay crash()
            # until the reactor has started, but if I move this to
            # TwistedIOLoop then the tests fail when I'm *not* running
            # tornado-on-twisted-on-tornado.  I'm clearly missing something
            # about the startup/crash semantics, but since stop and crash
            # are really only used in tests it doesn't really matter.
            self.reactor.callWhenRunning(self.reactor.crash)

if __name__ == "__main__":
    unittest.main()
