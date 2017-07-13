from __future__ import absolute_import, division, print_function, with_statement

import collections
from contextlib import closing
import errno
import gzip
import logging
import os
import re
import socket
import ssl
import sys

from tornado import gen
from tornado.httpclient import AsyncHTTPClient
from tornado.httputil import HTTPHeaders, ResponseStartLine
from tornado.ioloop import IOLoop
from tornado.log import gen_log
from tornado.netutil import Resolver, bind_sockets
from tornado.simple_httpclient import SimpleAsyncHTTPClient, _default_ca_certs
from tornado.test.httpclient_test import ChunkHandler, CountdownHandler, HelloWorldHandler
from tornado.test import httpclient_test
from tornado.testing import AsyncHTTPTestCase, AsyncHTTPSTestCase, AsyncTestCase, ExpectLog
from tornado.test.util import skipOnTravis, skipIfNoIPv6, refusing_port, unittest
from tornado.web import RequestHandler, Application, asynchronous, url, stream_request_body


class SimpleHTTPClientCommonTestCase(httpclient_test.HTTPClientCommonTestCase):
    def get_http_client(self):
        client = SimpleAsyncHTTPClient(io_loop=self.io_loop,
                                       force_instance=True)
        self.assertTrue(isinstance(client, SimpleAsyncHTTPClient))
        return client


class TriggerHandler(RequestHandler):
    def initialize(self, queue, wake_callback):
        self.queue = queue
        self.wake_callback = wake_callback

    @asynchronous
    def get(self):
        logging.debug("queuing trigger")
        self.queue.append(self.finish)
        if self.get_argument("wake", "true") == "true":
            self.wake_callback()


class HangHandler(RequestHandler):
    @asynchronous
    def get(self):
        pass


class ContentLengthHandler(RequestHandler):
    def get(self):
        self.set_header("Content-Length", self.get_argument("value"))
        self.write("ok")


class HeadHandler(RequestHandler):
    def head(self):
        self.set_header("Content-Length", "7")


class OptionsHandler(RequestHandler):
    def options(self):
        self.set_header("Access-Control-Allow-Origin", "*")
        self.write("ok")


class NoContentHandler(RequestHandler):
    def get(self):
        if self.get_argument("error", None):
            self.set_header("Content-Length", "5")
            self.write("hello")
        self.set_status(204)


class SeeOtherPostHandler(RequestHandler):
    def post(self):
        redirect_code = int(self.request.body)
        assert redirect_code in (302, 303), "unexpected body %r" % self.request.body
        self.set_header("Location", "/see_other_get")
        self.set_status(redirect_code)


class SeeOtherGetHandler(RequestHandler):
    def get(self):
        if self.request.body:
            raise Exception("unexpected body %r" % self.request.body)
        self.write("ok")


class HostEchoHandler(RequestHandler):
    def get(self):
        self.write(self.request.headers["Host"])


class NoContentLengthHandler(RequestHandler):
    @asynchronous
    def get(self):
        if self.request.version.startswith('HTTP/1'):
            # Emulate the old HTTP/1.0 behavior of returning a body with no
            # content-length.  Tornado handles content-length at the framework
            # level so we have to go around it.
            stream = self.request.connection.detach()
            stream.write(b"HTTP/1.0 200 OK\r\n\r\n"
                               b"hello")
            stream.close()
        else:
            self.finish('HTTP/1 required')


class EchoPostHandler(RequestHandler):
    def post(self):
        self.write(self.request.body)


@stream_request_body
class RespondInPrepareHandler(RequestHandler):
    def prepare(self):
        self.set_status(403)
        self.finish("forbidden")


class SimpleHTTPClientTestMixin(object):
    def get_app(self):
        # callable objects to finish pending /trigger requests
        self.triggers = collections.deque()
        return Application([
            url("/trigger", TriggerHandler, dict(queue=self.triggers,
                                                 wake_callback=self.stop)),
            url("/chunk", ChunkHandler),
            url("/countdown/([0-9]+)", CountdownHandler, name="countdown"),
            url("/hang", HangHandler),
            url("/hello", HelloWorldHandler),
            url("/content_length", ContentLengthHandler),
            url("/head", HeadHandler),
            url("/options", OptionsHandler),
            url("/no_content", NoContentHandler),
            url("/see_other_post", SeeOtherPostHandler),
            url("/see_other_get", SeeOtherGetHandler),
            url("/host_echo", HostEchoHandler),
            url("/no_content_length", NoContentLengthHandler),
            url("/echo_post", EchoPostHandler),
            url("/respond_in_prepare", RespondInPrepareHandler),
        ], gzip=True)

    def test_singleton(self):
        # Class "constructor" reuses objects on the same IOLoop
        self.assertTrue(SimpleAsyncHTTPClient(self.io_loop) is
                        SimpleAsyncHTTPClient(self.io_loop))
        # unless force_instance is used
        self.assertTrue(SimpleAsyncHTTPClient(self.io_loop) is not
                        SimpleAsyncHTTPClient(self.io_loop,
                                              force_instance=True))
        # different IOLoops use different objects
        with closing(IOLoop()) as io_loop2:
            self.assertTrue(SimpleAsyncHTTPClient(self.io_loop) is not
                            SimpleAsyncHTTPClient(io_loop2))

    def test_connection_limit(self):
        with closing(self.create_client(max_clients=2)) as client:
            self.assertEqual(client.max_clients, 2)
            seen = []
            # Send 4 requests.  Two can be sent immediately, while the others
            # will be queued
            for i in range(4):
                client.fetch(self.get_url("/trigger"),
                             lambda response, i=i: (seen.append(i), self.stop()))
            self.wait(condition=lambda: len(self.triggers) == 2)
            self.assertEqual(len(client.queue), 2)

            # Finish the first two requests and let the next two through
            self.triggers.popleft()()
            self.triggers.popleft()()
            self.wait(condition=lambda: (len(self.triggers) == 2 and
                                         len(seen) == 2))
            self.assertEqual(set(seen), set([0, 1]))
            self.assertEqual(len(client.queue), 0)

            # Finish all the pending requests
            self.triggers.popleft()()
            self.triggers.popleft()()
            self.wait(condition=lambda: len(seen) == 4)
            self.assertEqual(set(seen), set([0, 1, 2, 3]))
            self.assertEqual(len(self.triggers), 0)

    def test_redirect_connection_limit(self):
        # following redirects should not consume additional connections
        with closing(self.create_client(max_clients=1)) as client:
            client.fetch(self.get_url('/countdown/3'), self.stop,
                         max_redirects=3)
            response = self.wait()
            response.rethrow()

    def test_gzip(self):
        # All the tests in this file should be using gzip, but this test
        # ensures that it is in fact getting compressed.
        # Setting Accept-Encoding manually bypasses the client's
        # decompression so we can see the raw data.
        response = self.fetch("/chunk", use_gzip=False,
                              headers={"Accept-Encoding": "gzip"})
        self.assertEqual(response.headers["Content-Encoding"], "gzip")
        self.assertNotEqual(response.body, b"asdfqwer")
        # Our test data gets bigger when gzipped.  Oops.  :)
        self.assertEqual(len(response.body), 34)
        f = gzip.GzipFile(mode="r", fileobj=response.buffer)
        self.assertEqual(f.read(), b"asdfqwer")

    def test_max_redirects(self):
        response = self.fetch("/countdown/5", max_redirects=3)
        self.assertEqual(302, response.code)
        # We requested 5, followed three redirects for 4, 3, 2, then the last
        # unfollowed redirect is to 1.
        self.assertTrue(response.request.url.endswith("/countdown/5"))
        self.assertTrue(response.effective_url.endswith("/countdown/2"))
        self.assertTrue(response.headers["Location"].endswith("/countdown/1"))

    def test_header_reuse(self):
        # Apps may reuse a headers object if they are only passing in constant
        # headers like user-agent.  The header object should not be modified.
        headers = HTTPHeaders({'User-Agent': 'Foo'})
        self.fetch("/hello", headers=headers)
        self.assertEqual(list(headers.get_all()), [('User-Agent', 'Foo')])

    def test_see_other_redirect(self):
        for code in (302, 303):
            response = self.fetch("/see_other_post", method="POST", body="%d" % code)
            self.assertEqual(200, response.code)
            self.assertTrue(response.request.url.endswith("/see_other_post"))
            self.assertTrue(response.effective_url.endswith("/see_other_get"))
            # request is the original request, is a POST still
            self.assertEqual("POST", response.request.method)

    @skipOnTravis
    def test_request_timeout(self):
        timeout = 0.1
        timeout_min, timeout_max = 0.099, 0.15
        if os.name == 'nt':
            timeout = 0.5
            timeout_min, timeout_max = 0.4, 0.6

        response = self.fetch('/trigger?wake=false', request_timeout=timeout)
        self.assertEqual(response.code, 599)
        self.assertTrue(timeout_min < response.request_time < timeout_max,
                        response.request_time)
        self.assertEqual(str(response.error), "HTTP 599: Timeout")
        # trigger the hanging request to let it clean up after itself
        self.triggers.popleft()()

    @skipIfNoIPv6
    def test_ipv6(self):
        try:
            [sock] = bind_sockets(None, '::1', family=socket.AF_INET6)
            port = sock.getsockname()[1]
            self.http_server.add_socket(sock)
        except socket.gaierror as e:
            if e.args[0] == socket.EAI_ADDRFAMILY:
                # python supports ipv6, but it's not configured on the network
                # interface, so skip this test.
                return
            raise
        url = '%s://[::1]:%d/hello' % (self.get_protocol(), port)

        # ipv6 is currently enabled by default but can be disabled
        self.http_client.fetch(url, self.stop, allow_ipv6=False)
        response = self.wait()
        self.assertEqual(response.code, 599)

        self.http_client.fetch(url, self.stop)
        response = self.wait()
        self.assertEqual(response.body, b"Hello world!")

    def xtest_multiple_content_length_accepted(self):
        response = self.fetch("/content_length?value=2,2")
        self.assertEqual(response.body, b"ok")
        response = self.fetch("/content_length?value=2,%202,2")
        self.assertEqual(response.body, b"ok")

        response = self.fetch("/content_length?value=2,4")
        self.assertEqual(response.code, 599)
        response = self.fetch("/content_length?value=2,%202,3")
        self.assertEqual(response.code, 599)

    def test_head_request(self):
        response = self.fetch("/head", method="HEAD")
        self.assertEqual(response.code, 200)
        self.assertEqual(response.headers["content-length"], "7")
        self.assertFalse(response.body)

    def test_options_request(self):
        response = self.fetch("/options", method="OPTIONS")
        self.assertEqual(response.code, 200)
        self.assertEqual(response.headers["content-length"], "2")
        self.assertEqual(response.headers["access-control-allow-origin"], "*")
        self.assertEqual(response.body, b"ok")

    def test_no_content(self):
        response = self.fetch("/no_content")
        self.assertEqual(response.code, 204)
        # 204 status doesn't need a content-length, but tornado will
        # add a zero content-length anyway.
        #
        # A test without a content-length header is included below
        # in HTTP204NoContentTestCase.
        self.assertEqual(response.headers["Content-length"], "0")

        # 204 status with non-zero content length is malformed
        with ExpectLog(gen_log, "Malformed HTTP message"):
            response = self.fetch("/no_content?error=1")
        self.assertEqual(response.code, 599)

    def test_host_header(self):
        host_re = re.compile(b"^localhost:[0-9]+$")
        response = self.fetch("/host_echo")
        self.assertTrue(host_re.match(response.body))

        url = self.get_url("/host_echo").replace("http://", "http://me:secret@")
        self.http_client.fetch(url, self.stop)
        response = self.wait()
        self.assertTrue(host_re.match(response.body), response.body)

    def test_connection_refused(self):
        cleanup_func, port = refusing_port()
        self.addCleanup(cleanup_func)
        with ExpectLog(gen_log, ".*", required=False):
            self.http_client.fetch("http://127.0.0.1:%d/" % port, self.stop)
            response = self.wait()
        self.assertEqual(599, response.code)

        if sys.platform != 'cygwin':
            # cygwin returns EPERM instead of ECONNREFUSED here
            contains_errno = str(errno.ECONNREFUSED) in str(response.error)
            if not contains_errno and hasattr(errno, "WSAECONNREFUSED"):
                contains_errno = str(errno.WSAECONNREFUSED) in str(response.error)
            self.assertTrue(contains_errno, response.error)
            # This is usually "Connection refused".
            # On windows, strerror is broken and returns "Unknown error".
            expected_message = os.strerror(errno.ECONNREFUSED)
            self.assertTrue(expected_message in str(response.error),
                            response.error)

    def test_queue_timeout(self):
        with closing(self.create_client(max_clients=1)) as client:
            client.fetch(self.get_url('/trigger'), self.stop,
                         request_timeout=10)
            # Wait for the trigger request to block, not complete.
            self.wait()
            client.fetch(self.get_url('/hello'), self.stop,
                         connect_timeout=0.1)
            response = self.wait()

            self.assertEqual(response.code, 599)
            self.assertTrue(response.request_time < 1, response.request_time)
            self.assertEqual(str(response.error), "HTTP 599: Timeout")
            self.triggers.popleft()()
            self.wait()

    def test_no_content_length(self):
        response = self.fetch("/no_content_length")
        if response.body == b"HTTP/1 required":
            self.skipTest("requires HTTP/1.x")
        else:
            self.assertEquals(b"hello", response.body)

    def sync_body_producer(self, write):
        write(b'1234')
        write(b'5678')

    @gen.coroutine
    def async_body_producer(self, write):
        yield write(b'1234')
        yield gen.Task(IOLoop.current().add_callback)
        yield write(b'5678')

    def test_sync_body_producer_chunked(self):
        response = self.fetch("/echo_post", method="POST",
                              body_producer=self.sync_body_producer)
        response.rethrow()
        self.assertEqual(response.body, b"12345678")

    def test_sync_body_producer_content_length(self):
        response = self.fetch("/echo_post", method="POST",
                              body_producer=self.sync_body_producer,
                              headers={'Content-Length': '8'})
        response.rethrow()
        self.assertEqual(response.body, b"12345678")

    def test_async_body_producer_chunked(self):
        response = self.fetch("/echo_post", method="POST",
                              body_producer=self.async_body_producer)
        response.rethrow()
        self.assertEqual(response.body, b"12345678")

    def test_async_body_producer_content_length(self):
        response = self.fetch("/echo_post", method="POST",
                              body_producer=self.async_body_producer,
                              headers={'Content-Length': '8'})
        response.rethrow()
        self.assertEqual(response.body, b"12345678")

    def test_100_continue(self):
        response = self.fetch("/echo_post", method="POST",
                              body=b"1234",
                              expect_100_continue=True)
        self.assertEqual(response.body, b"1234")

    def test_100_continue_early_response(self):
        def body_producer(write):
            raise Exception("should not be called")
        response = self.fetch("/respond_in_prepare", method="POST",
                              body_producer=body_producer,
                              expect_100_continue=True)
        self.assertEqual(response.code, 403)


class SimpleHTTPClientTestCase(SimpleHTTPClientTestMixin, AsyncHTTPTestCase):
    def setUp(self):
        super(SimpleHTTPClientTestCase, self).setUp()
        self.http_client = self.create_client()

    def create_client(self, **kwargs):
        return SimpleAsyncHTTPClient(self.io_loop, force_instance=True,
                                     **kwargs)


class SimpleHTTPSClientTestCase(SimpleHTTPClientTestMixin, AsyncHTTPSTestCase):
    def setUp(self):
        super(SimpleHTTPSClientTestCase, self).setUp()
        self.http_client = self.create_client()

    def create_client(self, **kwargs):
        return SimpleAsyncHTTPClient(self.io_loop, force_instance=True,
                                     defaults=dict(validate_cert=False),
                                     **kwargs)

    def test_ssl_options(self):
        resp = self.fetch("/hello", ssl_options={})
        self.assertEqual(resp.body, b"Hello world!")

    @unittest.skipIf(not hasattr(ssl, 'SSLContext'),
                     'ssl.SSLContext not present')
    def test_ssl_context(self):
        resp = self.fetch("/hello",
                          ssl_options=ssl.SSLContext(ssl.PROTOCOL_SSLv23))
        self.assertEqual(resp.body, b"Hello world!")

    def test_ssl_options_handshake_fail(self):
        with ExpectLog(gen_log, "SSL Error|Uncaught exception",
                       required=False):
            resp = self.fetch(
                "/hello", ssl_options=dict(cert_reqs=ssl.CERT_REQUIRED))
        self.assertRaises(ssl.SSLError, resp.rethrow)

    @unittest.skipIf(not hasattr(ssl, 'SSLContext'),
                     'ssl.SSLContext not present')
    def test_ssl_context_handshake_fail(self):
        with ExpectLog(gen_log, "SSL Error|Uncaught exception"):
            ctx = ssl.SSLContext(ssl.PROTOCOL_SSLv23)
            ctx.verify_mode = ssl.CERT_REQUIRED
            resp = self.fetch("/hello", ssl_options=ctx)
        self.assertRaises(ssl.SSLError, resp.rethrow)


class CreateAsyncHTTPClientTestCase(AsyncTestCase):
    def setUp(self):
        super(CreateAsyncHTTPClientTestCase, self).setUp()
        self.saved = AsyncHTTPClient._save_configuration()

    def tearDown(self):
        AsyncHTTPClient._restore_configuration(self.saved)
        super(CreateAsyncHTTPClientTestCase, self).tearDown()

    def test_max_clients(self):
        AsyncHTTPClient.configure(SimpleAsyncHTTPClient)
        with closing(AsyncHTTPClient(
                self.io_loop, force_instance=True)) as client:
            self.assertEqual(client.max_clients, 10)
        with closing(AsyncHTTPClient(
                self.io_loop, max_clients=11, force_instance=True)) as client:
            self.assertEqual(client.max_clients, 11)

        # Now configure max_clients statically and try overriding it
        # with each way max_clients can be passed
        AsyncHTTPClient.configure(SimpleAsyncHTTPClient, max_clients=12)
        with closing(AsyncHTTPClient(
                self.io_loop, force_instance=True)) as client:
            self.assertEqual(client.max_clients, 12)
        with closing(AsyncHTTPClient(
                self.io_loop, max_clients=13, force_instance=True)) as client:
            self.assertEqual(client.max_clients, 13)
        with closing(AsyncHTTPClient(
                self.io_loop, max_clients=14, force_instance=True)) as client:
            self.assertEqual(client.max_clients, 14)


class HTTP100ContinueTestCase(AsyncHTTPTestCase):
    def respond_100(self, request):
        self.http1 = request.version.startswith('HTTP/1.')
        if not self.http1:
            request.connection.write_headers(ResponseStartLine('', 200, 'OK'),
                                             HTTPHeaders())
            request.connection.finish()
            return
        self.request = request
        self.request.connection.stream.write(
            b"HTTP/1.1 100 CONTINUE\r\n\r\n",
            self.respond_200)

    def respond_200(self):
        self.request.connection.stream.write(
            b"HTTP/1.1 200 OK\r\nContent-Length: 1\r\n\r\nA",
            self.request.connection.stream.close)

    def get_app(self):
        # Not a full Application, but works as an HTTPServer callback
        return self.respond_100

    def test_100_continue(self):
        res = self.fetch('/')
        if not self.http1:
            self.skipTest("requires HTTP/1.x")
        self.assertEqual(res.body, b'A')


class HTTP204NoContentTestCase(AsyncHTTPTestCase):
    def respond_204(self, request):
        self.http1 = request.version.startswith('HTTP/1.')
        if not self.http1:
            # Close the request cleanly in HTTP/2; it will be skipped anyway.
            request.connection.write_headers(ResponseStartLine('', 200, 'OK'),
                                             HTTPHeaders())
            request.connection.finish()
            return
        # A 204 response never has a body, even if doesn't have a content-length
        # (which would otherwise mean read-until-close).  Tornado always
        # sends a content-length, so we simulate here a server that sends
        # no content length and does not close the connection.
        #
        # Tests of a 204 response with a Content-Length header are included
        # in SimpleHTTPClientTestMixin.
        stream = request.connection.detach()
        stream.write(
            b"HTTP/1.1 204 No content\r\n\r\n")
        stream.close()

    def get_app(self):
        return self.respond_204

    def test_204_no_content(self):
        resp = self.fetch('/')
        if not self.http1:
            self.skipTest("requires HTTP/1.x")
        self.assertEqual(resp.code, 204)
        self.assertEqual(resp.body, b'')


class HostnameMappingTestCase(AsyncHTTPTestCase):
    def setUp(self):
        super(HostnameMappingTestCase, self).setUp()
        self.http_client = SimpleAsyncHTTPClient(
            self.io_loop,
            hostname_mapping={
                'www.example.com': '127.0.0.1',
                ('foo.example.com', 8000): ('127.0.0.1', self.get_http_port()),
            })

    def get_app(self):
        return Application([url("/hello", HelloWorldHandler), ])

    def test_hostname_mapping(self):
        self.http_client.fetch(
            'http://www.example.com:%d/hello' % self.get_http_port(), self.stop)
        response = self.wait()
        response.rethrow()
        self.assertEqual(response.body, b'Hello world!')

    def test_port_mapping(self):
        self.http_client.fetch('http://foo.example.com:8000/hello', self.stop)
        response = self.wait()
        response.rethrow()
        self.assertEqual(response.body, b'Hello world!')


class ResolveTimeoutTestCase(AsyncHTTPTestCase):
    def setUp(self):
        # Dummy Resolver subclass that never invokes its callback.
        class BadResolver(Resolver):
            def resolve(self, *args, **kwargs):
                pass

        super(ResolveTimeoutTestCase, self).setUp()
        self.http_client = SimpleAsyncHTTPClient(
            self.io_loop,
            resolver=BadResolver())

    def get_app(self):
        return Application([url("/hello", HelloWorldHandler), ])

    def test_resolve_timeout(self):
        response = self.fetch('/hello', connect_timeout=0.1)
        self.assertEqual(response.code, 599)


class MaxHeaderSizeTest(AsyncHTTPTestCase):
    def get_app(self):
        class SmallHeaders(RequestHandler):
            def get(self):
                self.set_header("X-Filler", "a" * 100)
                self.write("ok")

        class LargeHeaders(RequestHandler):
            def get(self):
                self.set_header("X-Filler", "a" * 1000)
                self.write("ok")

        return Application([('/small', SmallHeaders),
                            ('/large', LargeHeaders)])

    def get_http_client(self):
        return SimpleAsyncHTTPClient(io_loop=self.io_loop, max_header_size=1024)

    def test_small_headers(self):
        response = self.fetch('/small')
        response.rethrow()
        self.assertEqual(response.body, b'ok')

    def test_large_headers(self):
        with ExpectLog(gen_log, "Unsatisfiable read"):
            response = self.fetch('/large')
        self.assertEqual(response.code, 599)


class MaxBodySizeTest(AsyncHTTPTestCase):
    def get_app(self):
        class SmallBody(RequestHandler):
            def get(self):
                self.write("a"*1024*64)

        class LargeBody(RequestHandler):
            def get(self):
                self.write("a"*1024*100)

        return Application([('/small', SmallBody),
                            ('/large', LargeBody)])

    def get_http_client(self):
        return SimpleAsyncHTTPClient(io_loop=self.io_loop, max_body_size=1024*64)

    def test_small_body(self):
        response = self.fetch('/small')
        response.rethrow()
        self.assertEqual(response.body, b'a'*1024*64)

    def test_large_body(self):
        with ExpectLog(gen_log, "Malformed HTTP message from None: Content-Length too long"):
            response = self.fetch('/large')
        self.assertEqual(response.code, 599)


class MaxBufferSizeTest(AsyncHTTPTestCase):
    def get_app(self):

        class LargeBody(RequestHandler):
            def get(self):
                self.write("a"*1024*100)

        return Application([('/large', LargeBody)])

    def get_http_client(self):
        # 100KB body with 64KB buffer
        return SimpleAsyncHTTPClient(io_loop=self.io_loop, max_body_size=1024*100, max_buffer_size=1024*64)

    def test_large_body(self):
        response = self.fetch('/large')
        response.rethrow()
        self.assertEqual(response.body, b'a'*1024*100)
