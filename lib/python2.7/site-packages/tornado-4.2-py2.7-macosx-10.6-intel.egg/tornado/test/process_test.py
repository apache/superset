#!/usr/bin/env python


from __future__ import absolute_import, division, print_function, with_statement
import logging
import os
import signal
import subprocess
import sys
from tornado.httpclient import HTTPClient, HTTPError
from tornado.httpserver import HTTPServer
from tornado.ioloop import IOLoop
from tornado.log import gen_log
from tornado.process import fork_processes, task_id, Subprocess
from tornado.simple_httpclient import SimpleAsyncHTTPClient
from tornado.testing import bind_unused_port, ExpectLog, AsyncTestCase, gen_test
from tornado.test.util import unittest, skipIfNonUnix
from tornado.web import RequestHandler, Application


def skip_if_twisted():
    if IOLoop.configured_class().__name__.endswith(('TwistedIOLoop',
                                                    'AsyncIOMainLoop')):
        raise unittest.SkipTest("Process tests not compatible with "
                                "TwistedIOLoop or AsyncIOMainLoop")

# Not using AsyncHTTPTestCase because we need control over the IOLoop.


@skipIfNonUnix
class ProcessTest(unittest.TestCase):
    def get_app(self):
        class ProcessHandler(RequestHandler):
            def get(self):
                if self.get_argument("exit", None):
                    # must use os._exit instead of sys.exit so unittest's
                    # exception handler doesn't catch it
                    os._exit(int(self.get_argument("exit")))
                if self.get_argument("signal", None):
                    os.kill(os.getpid(),
                            int(self.get_argument("signal")))
                self.write(str(os.getpid()))
        return Application([("/", ProcessHandler)])

    def tearDown(self):
        if task_id() is not None:
            # We're in a child process, and probably got to this point
            # via an uncaught exception.  If we return now, both
            # processes will continue with the rest of the test suite.
            # Exit now so the parent process will restart the child
            # (since we don't have a clean way to signal failure to
            # the parent that won't restart)
            logging.error("aborting child process from tearDown")
            logging.shutdown()
            os._exit(1)
        # In the surviving process, clear the alarm we set earlier
        signal.alarm(0)
        super(ProcessTest, self).tearDown()

    def test_multi_process(self):
        # This test can't work on twisted because we use the global reactor
        # and have no way to get it back into a sane state after the fork.
        skip_if_twisted()
        with ExpectLog(gen_log, "(Starting .* processes|child .* exited|uncaught exception)"):
            self.assertFalse(IOLoop.initialized())
            sock, port = bind_unused_port()

            def get_url(path):
                return "http://127.0.0.1:%d%s" % (port, path)
            # ensure that none of these processes live too long
            signal.alarm(5)  # master process
            try:
                id = fork_processes(3, max_restarts=3)
                self.assertTrue(id is not None)
                signal.alarm(5)  # child processes
            except SystemExit as e:
                # if we exit cleanly from fork_processes, all the child processes
                # finished with status 0
                self.assertEqual(e.code, 0)
                self.assertTrue(task_id() is None)
                sock.close()
                return
            try:
                if id in (0, 1):
                    self.assertEqual(id, task_id())
                    server = HTTPServer(self.get_app())
                    server.add_sockets([sock])
                    IOLoop.current().start()
                elif id == 2:
                    self.assertEqual(id, task_id())
                    sock.close()
                    # Always use SimpleAsyncHTTPClient here; the curl
                    # version appears to get confused sometimes if the
                    # connection gets closed before it's had a chance to
                    # switch from writing mode to reading mode.
                    client = HTTPClient(SimpleAsyncHTTPClient)

                    def fetch(url, fail_ok=False):
                        try:
                            return client.fetch(get_url(url))
                        except HTTPError as e:
                            if not (fail_ok and e.code == 599):
                                raise

                    # Make two processes exit abnormally
                    fetch("/?exit=2", fail_ok=True)
                    fetch("/?exit=3", fail_ok=True)

                    # They've been restarted, so a new fetch will work
                    int(fetch("/").body)

                    # Now the same with signals
                    # Disabled because on the mac a process dying with a signal
                    # can trigger an "Application exited abnormally; send error
                    # report to Apple?" prompt.
                    # fetch("/?signal=%d" % signal.SIGTERM, fail_ok=True)
                    # fetch("/?signal=%d" % signal.SIGABRT, fail_ok=True)
                    # int(fetch("/").body)

                    # Now kill them normally so they won't be restarted
                    fetch("/?exit=0", fail_ok=True)
                    # One process left; watch it's pid change
                    pid = int(fetch("/").body)
                    fetch("/?exit=4", fail_ok=True)
                    pid2 = int(fetch("/").body)
                    self.assertNotEqual(pid, pid2)

                    # Kill the last one so we shut down cleanly
                    fetch("/?exit=0", fail_ok=True)

                    os._exit(0)
            except Exception:
                logging.error("exception in child process %d", id, exc_info=True)
                raise


@skipIfNonUnix
class SubprocessTest(AsyncTestCase):
    def test_subprocess(self):
        if IOLoop.configured_class().__name__.endswith('LayeredTwistedIOLoop'):
            # This test fails non-deterministically with LayeredTwistedIOLoop.
            # (the read_until('\n') returns '\n' instead of 'hello\n')
            # This probably indicates a problem with either TornadoReactor
            # or TwistedIOLoop, but I haven't been able to track it down
            # and for now this is just causing spurious travis-ci failures.
            raise unittest.SkipTest("Subprocess tests not compatible with "
                                    "LayeredTwistedIOLoop")
        subproc = Subprocess([sys.executable, '-u', '-i'],
                             stdin=Subprocess.STREAM,
                             stdout=Subprocess.STREAM, stderr=subprocess.STDOUT,
                             io_loop=self.io_loop)
        self.addCleanup(lambda: os.kill(subproc.pid, signal.SIGTERM))
        subproc.stdout.read_until(b'>>> ', self.stop)
        self.wait()
        subproc.stdin.write(b"print('hello')\n")
        subproc.stdout.read_until(b'\n', self.stop)
        data = self.wait()
        self.assertEqual(data, b"hello\n")

        subproc.stdout.read_until(b">>> ", self.stop)
        self.wait()
        subproc.stdin.write(b"raise SystemExit\n")
        subproc.stdout.read_until_close(self.stop)
        data = self.wait()
        self.assertEqual(data, b"")

    def test_close_stdin(self):
        # Close the parent's stdin handle and see that the child recognizes it.
        subproc = Subprocess([sys.executable, '-u', '-i'],
                             stdin=Subprocess.STREAM,
                             stdout=Subprocess.STREAM, stderr=subprocess.STDOUT,
                             io_loop=self.io_loop)
        self.addCleanup(lambda: os.kill(subproc.pid, signal.SIGTERM))
        subproc.stdout.read_until(b'>>> ', self.stop)
        self.wait()
        subproc.stdin.close()
        subproc.stdout.read_until_close(self.stop)
        data = self.wait()
        self.assertEqual(data, b"\n")

    def test_stderr(self):
        subproc = Subprocess([sys.executable, '-u', '-c',
                              r"import sys; sys.stderr.write('hello\n')"],
                             stderr=Subprocess.STREAM,
                             io_loop=self.io_loop)
        self.addCleanup(lambda: os.kill(subproc.pid, signal.SIGTERM))
        subproc.stderr.read_until(b'\n', self.stop)
        data = self.wait()
        self.assertEqual(data, b'hello\n')

    def test_sigchild(self):
        # Twisted's SIGCHLD handler and Subprocess's conflict with each other.
        skip_if_twisted()
        Subprocess.initialize(io_loop=self.io_loop)
        self.addCleanup(Subprocess.uninitialize)
        subproc = Subprocess([sys.executable, '-c', 'pass'],
                             io_loop=self.io_loop)
        subproc.set_exit_callback(self.stop)
        ret = self.wait()
        self.assertEqual(ret, 0)
        self.assertEqual(subproc.returncode, ret)

    @gen_test
    def test_sigchild_future(self):
        skip_if_twisted()
        Subprocess.initialize()
        self.addCleanup(Subprocess.uninitialize)
        subproc = Subprocess([sys.executable, '-c', 'pass'])
        ret = yield subproc.wait_for_exit()
        self.assertEqual(ret, 0)
        self.assertEqual(subproc.returncode, ret)

    def test_sigchild_signal(self):
        skip_if_twisted()
        Subprocess.initialize(io_loop=self.io_loop)
        self.addCleanup(Subprocess.uninitialize)
        subproc = Subprocess([sys.executable, '-c',
                              'import time; time.sleep(30)'],
                             io_loop=self.io_loop)
        subproc.set_exit_callback(self.stop)
        os.kill(subproc.pid, signal.SIGTERM)
        ret = self.wait()
        self.assertEqual(subproc.returncode, ret)
        self.assertEqual(ret, -signal.SIGTERM)

    @gen_test
    def test_wait_for_exit_raise(self):
        skip_if_twisted()
        Subprocess.initialize()
        self.addCleanup(Subprocess.uninitialize)
        subproc = Subprocess([sys.executable, '-c', 'import sys; sys.exit(1)'])
        with self.assertRaises(subprocess.CalledProcessError) as cm:
            yield subproc.wait_for_exit()
        self.assertEqual(cm.exception.returncode, 1)

    @gen_test
    def test_wait_for_exit_raise_disabled(self):
        skip_if_twisted()
        Subprocess.initialize()
        self.addCleanup(Subprocess.uninitialize)
        subproc = Subprocess([sys.executable, '-c', 'import sys; sys.exit(1)'])
        ret = yield subproc.wait_for_exit(raise_error=False)
        self.assertEqual(ret, 1)
