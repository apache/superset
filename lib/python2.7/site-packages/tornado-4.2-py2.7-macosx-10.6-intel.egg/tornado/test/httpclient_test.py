#!/usr/bin/env python

from __future__ import absolute_import, division, print_function, with_statement

import base64
import binascii
from contextlib import closing
import functools
import sys
import threading
import datetime
from io import BytesIO

from tornado.escape import utf8
from tornado import gen
from tornado.httpclient import HTTPRequest, HTTPResponse, _RequestProxy, HTTPError, HTTPClient
from tornado.httpserver import HTTPServer
from tornado.ioloop import IOLoop
from tornado.iostream import IOStream
from tornado.log import gen_log
from tornado import netutil
from tornado.stack_context import ExceptionStackContext, NullContext
from tornado.testing import AsyncHTTPTestCase, bind_unused_port, gen_test, ExpectLog
from tornado.test.util import unittest, skipOnTravis
from tornado.util import u
from tornado.web import Application, RequestHandler, url
from tornado.httputil import format_timestamp, HTTPHeaders


class HelloWorldHandler(RequestHandler):
    def get(self):
        name = self.get_argument("name", "world")
        self.set_header("Content-Type", "text/plain")
        self.finish("Hello %s!" % name)


class PostHandler(RequestHandler):
    def post(self):
        self.finish("Post arg1: %s, arg2: %s" % (
            self.get_argument("arg1"), self.get_argument("arg2")))


class PutHandler(RequestHandler):
    def put(self):
        self.write("Put body: ")
        self.write(self.request.body)


class RedirectHandler(RequestHandler):
    def prepare(self):
        self.redirect(self.get_argument("url"),
                      status=int(self.get_argument("status", "302")))


class ChunkHandler(RequestHandler):
    @gen.coroutine
    def get(self):
        self.write("asdf")
        self.flush()
        # Wait a bit to ensure the chunks are sent and received separately.
        yield gen.sleep(0.01)
        self.write("qwer")


class AuthHandler(RequestHandler):
    def get(self):
        self.finish(self.request.headers["Authorization"])


class CountdownHandler(RequestHandler):
    def get(self, count):
        count = int(count)
        if count > 0:
            self.redirect(self.reverse_url("countdown", count - 1))
        else:
            self.write("Zero")


class EchoPostHandler(RequestHandler):
    def post(self):
        self.write(self.request.body)


class UserAgentHandler(RequestHandler):
    def get(self):
        self.write(self.request.headers.get('User-Agent', 'User agent not set'))


class ContentLength304Handler(RequestHandler):
    def get(self):
        self.set_status(304)
        self.set_header('Content-Length', 42)

    def _clear_headers_for_304(self):
        # Tornado strips content-length from 304 responses, but here we
        # want to simulate servers that include the headers anyway.
        pass


class PatchHandler(RequestHandler):

    def patch(self):
        "Return the request payload - so we can check it is being kept"
        self.write(self.request.body)


class AllMethodsHandler(RequestHandler):
    SUPPORTED_METHODS = RequestHandler.SUPPORTED_METHODS + ('OTHER',)

    def method(self):
        self.write(self.request.method)

    get = post = put = delete = options = patch = other = method

# These tests end up getting run redundantly: once here with the default
# HTTPClient implementation, and then again in each implementation's own
# test suite.


class HTTPClientCommonTestCase(AsyncHTTPTestCase):
    def get_app(self):
        return Application([
            url("/hello", HelloWorldHandler),
            url("/post", PostHandler),
            url("/put", PutHandler),
            url("/redirect", RedirectHandler),
            url("/chunk", ChunkHandler),
            url("/auth", AuthHandler),
            url("/countdown/([0-9]+)", CountdownHandler, name="countdown"),
            url("/echopost", EchoPostHandler),
            url("/user_agent", UserAgentHandler),
            url("/304_with_content_length", ContentLength304Handler),
            url("/all_methods", AllMethodsHandler),
            url('/patch', PatchHandler),
        ], gzip=True)

    def test_patch_receives_payload(self):
        body = b"some patch data"
        response = self.fetch("/patch", method='PATCH', body=body)
        self.assertEqual(response.code, 200)
        self.assertEqual(response.body, body)

    @skipOnTravis
    def test_hello_world(self):
        response = self.fetch("/hello")
        self.assertEqual(response.code, 200)
        self.assertEqual(response.headers["Content-Type"], "text/plain")
        self.assertEqual(response.body, b"Hello world!")
        self.assertEqual(int(response.request_time), 0)

        response = self.fetch("/hello?name=Ben")
        self.assertEqual(response.body, b"Hello Ben!")

    def test_streaming_callback(self):
        # streaming_callback is also tested in test_chunked
        chunks = []
        response = self.fetch("/hello",
                              streaming_callback=chunks.append)
        # with streaming_callback, data goes to the callback and not response.body
        self.assertEqual(chunks, [b"Hello world!"])
        self.assertFalse(response.body)

    def test_post(self):
        response = self.fetch("/post", method="POST",
                              body="arg1=foo&arg2=bar")
        self.assertEqual(response.code, 200)
        self.assertEqual(response.body, b"Post arg1: foo, arg2: bar")

    def test_chunked(self):
        response = self.fetch("/chunk")
        self.assertEqual(response.body, b"asdfqwer")

        chunks = []
        response = self.fetch("/chunk",
                              streaming_callback=chunks.append)
        self.assertEqual(chunks, [b"asdf", b"qwer"])
        self.assertFalse(response.body)

    def test_chunked_close(self):
        # test case in which chunks spread read-callback processing
        # over several ioloop iterations, but the connection is already closed.
        sock, port = bind_unused_port()
        with closing(sock):
            def write_response(stream, request_data):
                if b"HTTP/1." not in request_data:
                    self.skipTest("requires HTTP/1.x")
                stream.write(b"""\
HTTP/1.1 200 OK
Transfer-Encoding: chunked

1
1
1
2
0

""".replace(b"\n", b"\r\n"), callback=stream.close)

            def accept_callback(conn, address):
                # fake an HTTP server using chunked encoding where the final chunks
                # and connection close all happen at once
                stream = IOStream(conn, io_loop=self.io_loop)
                stream.read_until(b"\r\n\r\n",
                                  functools.partial(write_response, stream))
            netutil.add_accept_handler(sock, accept_callback, self.io_loop)
            self.http_client.fetch("http://127.0.0.1:%d/" % port, self.stop)
            resp = self.wait()
            resp.rethrow()
            self.assertEqual(resp.body, b"12")
            self.io_loop.remove_handler(sock.fileno())

    def test_streaming_stack_context(self):
        chunks = []
        exc_info = []

        def error_handler(typ, value, tb):
            exc_info.append((typ, value, tb))
            return True

        def streaming_cb(chunk):
            chunks.append(chunk)
            if chunk == b'qwer':
                1 / 0

        with ExceptionStackContext(error_handler):
            self.fetch('/chunk', streaming_callback=streaming_cb)

        self.assertEqual(chunks, [b'asdf', b'qwer'])
        self.assertEqual(1, len(exc_info))
        self.assertIs(exc_info[0][0], ZeroDivisionError)

    def test_basic_auth(self):
        self.assertEqual(self.fetch("/auth", auth_username="Aladdin",
                                    auth_password="open sesame").body,
                         b"Basic QWxhZGRpbjpvcGVuIHNlc2FtZQ==")

    def test_basic_auth_explicit_mode(self):
        self.assertEqual(self.fetch("/auth", auth_username="Aladdin",
                                    auth_password="open sesame",
                                    auth_mode="basic").body,
                         b"Basic QWxhZGRpbjpvcGVuIHNlc2FtZQ==")

    def test_unsupported_auth_mode(self):
        # curl and simple clients handle errors a bit differently; the
        # important thing is that they don't fall back to basic auth
        # on an unknown mode.
        with ExpectLog(gen_log, "uncaught exception", required=False):
            with self.assertRaises((ValueError, HTTPError)):
                response = self.fetch("/auth", auth_username="Aladdin",
                                      auth_password="open sesame",
                                      auth_mode="asdf")
                response.rethrow()

    def test_follow_redirect(self):
        response = self.fetch("/countdown/2", follow_redirects=False)
        self.assertEqual(302, response.code)
        self.assertTrue(response.headers["Location"].endswith("/countdown/1"))

        response = self.fetch("/countdown/2")
        self.assertEqual(200, response.code)
        self.assertTrue(response.effective_url.endswith("/countdown/0"))
        self.assertEqual(b"Zero", response.body)

    def test_credentials_in_url(self):
        url = self.get_url("/auth").replace("http://", "http://me:secret@")
        self.http_client.fetch(url, self.stop)
        response = self.wait()
        self.assertEqual(b"Basic " + base64.b64encode(b"me:secret"),
                         response.body)

    def test_body_encoding(self):
        unicode_body = u("\xe9")
        byte_body = binascii.a2b_hex(b"e9")

        # unicode string in body gets converted to utf8
        response = self.fetch("/echopost", method="POST", body=unicode_body,
                              headers={"Content-Type": "application/blah"})
        self.assertEqual(response.headers["Content-Length"], "2")
        self.assertEqual(response.body, utf8(unicode_body))

        # byte strings pass through directly
        response = self.fetch("/echopost", method="POST",
                              body=byte_body,
                              headers={"Content-Type": "application/blah"})
        self.assertEqual(response.headers["Content-Length"], "1")
        self.assertEqual(response.body, byte_body)

        # Mixing unicode in headers and byte string bodies shouldn't
        # break anything
        response = self.fetch("/echopost", method="POST", body=byte_body,
                              headers={"Content-Type": "application/blah"},
                              user_agent=u("foo"))
        self.assertEqual(response.headers["Content-Length"], "1")
        self.assertEqual(response.body, byte_body)

    def test_types(self):
        response = self.fetch("/hello")
        self.assertEqual(type(response.body), bytes)
        self.assertEqual(type(response.headers["Content-Type"]), str)
        self.assertEqual(type(response.code), int)
        self.assertEqual(type(response.effective_url), str)

    def test_header_callback(self):
        first_line = []
        headers = {}
        chunks = []

        def header_callback(header_line):
            if header_line.startswith('HTTP/1.1 101'):
                # Upgrading to HTTP/2
                pass
            elif header_line.startswith('HTTP/'):
                first_line.append(header_line)
            elif header_line != '\r\n':
                k, v = header_line.split(':', 1)
                headers[k.lower()] = v.strip()

        def streaming_callback(chunk):
            # All header callbacks are run before any streaming callbacks,
            # so the header data is available to process the data as it
            # comes in.
            self.assertEqual(headers['content-type'], 'text/html; charset=UTF-8')
            chunks.append(chunk)

        self.fetch('/chunk', header_callback=header_callback,
                   streaming_callback=streaming_callback)
        self.assertEqual(len(first_line), 1, first_line)
        self.assertRegexpMatches(first_line[0], 'HTTP/[0-9]\\.[0-9] 200.*\r\n')
        self.assertEqual(chunks, [b'asdf', b'qwer'])

    def test_header_callback_stack_context(self):
        exc_info = []

        def error_handler(typ, value, tb):
            exc_info.append((typ, value, tb))
            return True

        def header_callback(header_line):
            if header_line.lower().startswith('content-type:'):
                1 / 0

        with ExceptionStackContext(error_handler):
            self.fetch('/chunk', header_callback=header_callback)
        self.assertEqual(len(exc_info), 1)
        self.assertIs(exc_info[0][0], ZeroDivisionError)

    def test_configure_defaults(self):
        defaults = dict(user_agent='TestDefaultUserAgent', allow_ipv6=False)
        # Construct a new instance of the configured client class
        client = self.http_client.__class__(self.io_loop, force_instance=True,
                                            defaults=defaults)
        try:
            client.fetch(self.get_url('/user_agent'), callback=self.stop)
            response = self.wait()
            self.assertEqual(response.body, b'TestDefaultUserAgent')
        finally:
            client.close()

    def test_header_types(self):
        # Header values may be passed as character or utf8 byte strings,
        # in a plain dictionary or an HTTPHeaders object.
        # Keys must always be the native str type.
        # All combinations should have the same results on the wire.
        for value in [u("MyUserAgent"), b"MyUserAgent"]:
            for container in [dict, HTTPHeaders]:
                headers = container()
                headers['User-Agent'] = value
                resp = self.fetch('/user_agent', headers=headers)
                self.assertEqual(
                    resp.body, b"MyUserAgent",
                    "response=%r, value=%r, container=%r" %
                    (resp.body, value, container))

    def test_304_with_content_length(self):
        # According to the spec 304 responses SHOULD NOT include
        # Content-Length or other entity headers, but some servers do it
        # anyway.
        # http://www.w3.org/Protocols/rfc2616/rfc2616-sec10.html#sec10.3.5
        response = self.fetch('/304_with_content_length')
        self.assertEqual(response.code, 304)
        self.assertEqual(response.headers['Content-Length'], '42')

    def test_final_callback_stack_context(self):
        # The final callback should be run outside of the httpclient's
        # stack_context.  We want to ensure that there is not stack_context
        # between the user's callback and the IOLoop, so monkey-patch
        # IOLoop.handle_callback_exception and disable the test harness's
        # context with a NullContext.
        # Note that this does not apply to secondary callbacks (header
        # and streaming_callback), as errors there must be seen as errors
        # by the http client so it can clean up the connection.
        exc_info = []

        def handle_callback_exception(callback):
            exc_info.append(sys.exc_info())
            self.stop()
        self.io_loop.handle_callback_exception = handle_callback_exception
        with NullContext():
            self.http_client.fetch(self.get_url('/hello'),
                                   lambda response: 1 / 0)
        self.wait()
        self.assertEqual(exc_info[0][0], ZeroDivisionError)

    @gen_test
    def test_future_interface(self):
        response = yield self.http_client.fetch(self.get_url('/hello'))
        self.assertEqual(response.body, b'Hello world!')

    @gen_test
    def test_future_http_error(self):
        with self.assertRaises(HTTPError) as context:
            yield self.http_client.fetch(self.get_url('/notfound'))
        self.assertEqual(context.exception.code, 404)
        self.assertEqual(context.exception.response.code, 404)

    @gen_test
    def test_future_http_error_no_raise(self):
        response = yield self.http_client.fetch(self.get_url('/notfound'), raise_error=False)
        self.assertEqual(response.code, 404)

    @gen_test
    def test_reuse_request_from_response(self):
        # The response.request attribute should be an HTTPRequest, not
        # a _RequestProxy.
        # This test uses self.http_client.fetch because self.fetch calls
        # self.get_url on the input unconditionally.
        url = self.get_url('/hello')
        response = yield self.http_client.fetch(url)
        self.assertEqual(response.request.url, url)
        self.assertTrue(isinstance(response.request, HTTPRequest))
        response2 = yield self.http_client.fetch(response.request)
        self.assertEqual(response2.body, b'Hello world!')

    def test_all_methods(self):
        for method in ['GET', 'DELETE', 'OPTIONS']:
            response = self.fetch('/all_methods', method=method)
            self.assertEqual(response.body, utf8(method))
        for method in ['POST', 'PUT', 'PATCH']:
            response = self.fetch('/all_methods', method=method, body=b'')
            self.assertEqual(response.body, utf8(method))
        response = self.fetch('/all_methods', method='HEAD')
        self.assertEqual(response.body, b'')
        response = self.fetch('/all_methods', method='OTHER',
                              allow_nonstandard_methods=True)
        self.assertEqual(response.body, b'OTHER')

    @gen_test
    def test_body_sanity_checks(self):
        hello_url = self.get_url('/hello')
        with self.assertRaises(ValueError) as context:
            yield self.http_client.fetch(hello_url, body='data')

        self.assertTrue('must be None' in str(context.exception))

        with self.assertRaises(ValueError) as context:
            yield self.http_client.fetch(hello_url, method='POST')

        self.assertTrue('must not be None' in str(context.exception))

    # This test causes odd failures with the combination of
    # curl_httpclient (at least with the version of libcurl available
    # on ubuntu 12.04), TwistedIOLoop, and epoll.  For POST (but not PUT),
    # curl decides the response came back too soon and closes the connection
    # to start again.  It does this *before* telling the socket callback to
    # unregister the FD.  Some IOLoop implementations have special kernel
    # integration to discover this immediately.  Tornado's IOLoops
    # ignore errors on remove_handler to accommodate this behavior, but
    # Twisted's reactor does not.  The removeReader call fails and so
    # do all future removeAll calls (which our tests do at cleanup).
    #
    # def test_post_307(self):
    #    response = self.fetch("/redirect?status=307&url=/post",
    #                          method="POST", body=b"arg1=foo&arg2=bar")
    #    self.assertEqual(response.body, b"Post arg1: foo, arg2: bar")

    def test_put_307(self):
        response = self.fetch("/redirect?status=307&url=/put",
                              method="PUT", body=b"hello")
        response.rethrow()
        self.assertEqual(response.body, b"Put body: hello")


class RequestProxyTest(unittest.TestCase):
    def test_request_set(self):
        proxy = _RequestProxy(HTTPRequest('http://example.com/',
                                          user_agent='foo'),
                              dict())
        self.assertEqual(proxy.user_agent, 'foo')

    def test_default_set(self):
        proxy = _RequestProxy(HTTPRequest('http://example.com/'),
                              dict(network_interface='foo'))
        self.assertEqual(proxy.network_interface, 'foo')

    def test_both_set(self):
        proxy = _RequestProxy(HTTPRequest('http://example.com/',
                                          proxy_host='foo'),
                              dict(proxy_host='bar'))
        self.assertEqual(proxy.proxy_host, 'foo')

    def test_neither_set(self):
        proxy = _RequestProxy(HTTPRequest('http://example.com/'),
                              dict())
        self.assertIs(proxy.auth_username, None)

    def test_bad_attribute(self):
        proxy = _RequestProxy(HTTPRequest('http://example.com/'),
                              dict())
        with self.assertRaises(AttributeError):
            proxy.foo

    def test_defaults_none(self):
        proxy = _RequestProxy(HTTPRequest('http://example.com/'), None)
        self.assertIs(proxy.auth_username, None)


class HTTPResponseTestCase(unittest.TestCase):
    def test_str(self):
        response = HTTPResponse(HTTPRequest('http://example.com'),
                                200, headers={}, buffer=BytesIO())
        s = str(response)
        self.assertTrue(s.startswith('HTTPResponse('))
        self.assertIn('code=200', s)


class SyncHTTPClientTest(unittest.TestCase):
    def setUp(self):
        if IOLoop.configured_class().__name__ in ('TwistedIOLoop',
                                                  'AsyncIOMainLoop'):
            # TwistedIOLoop only supports the global reactor, so we can't have
            # separate IOLoops for client and server threads.
            # AsyncIOMainLoop doesn't work with the default policy
            # (although it could with some tweaks to this test and a
            # policy that created loops for non-main threads).
            raise unittest.SkipTest(
                'Sync HTTPClient not compatible with TwistedIOLoop or '
                'AsyncIOMainLoop')
        self.server_ioloop = IOLoop()

        sock, self.port = bind_unused_port()
        app = Application([('/', HelloWorldHandler)])
        self.server = HTTPServer(app, io_loop=self.server_ioloop)
        self.server.add_socket(sock)

        self.server_thread = threading.Thread(target=self.server_ioloop.start)
        self.server_thread.start()

        self.http_client = HTTPClient()

    def tearDown(self):
        def stop_server():
            self.server.stop()
            # Delay the shutdown of the IOLoop by one iteration because
            # the server may still have some cleanup work left when
            # the client finishes with the response (this is noticable
            # with http/2, which leaves a Future with an unexamined
            # StreamClosedError on the loop).
            self.server_ioloop.add_callback(self.server_ioloop.stop)
        self.server_ioloop.add_callback(stop_server)
        self.server_thread.join()
        self.http_client.close()
        self.server_ioloop.close(all_fds=True)

    def get_url(self, path):
        return 'http://127.0.0.1:%d%s' % (self.port, path)

    def test_sync_client(self):
        response = self.http_client.fetch(self.get_url('/'))
        self.assertEqual(b'Hello world!', response.body)

    def test_sync_client_error(self):
        # Synchronous HTTPClient raises errors directly; no need for
        # response.rethrow()
        with self.assertRaises(HTTPError) as assertion:
            self.http_client.fetch(self.get_url('/notfound'))
        self.assertEqual(assertion.exception.code, 404)


class HTTPRequestTestCase(unittest.TestCase):
    def test_headers(self):
        request = HTTPRequest('http://example.com', headers={'foo': 'bar'})
        self.assertEqual(request.headers, {'foo': 'bar'})

    def test_headers_setter(self):
        request = HTTPRequest('http://example.com')
        request.headers = {'bar': 'baz'}
        self.assertEqual(request.headers, {'bar': 'baz'})

    def test_null_headers_setter(self):
        request = HTTPRequest('http://example.com')
        request.headers = None
        self.assertEqual(request.headers, {})

    def test_body(self):
        request = HTTPRequest('http://example.com', body='foo')
        self.assertEqual(request.body, utf8('foo'))

    def test_body_setter(self):
        request = HTTPRequest('http://example.com')
        request.body = 'foo'
        self.assertEqual(request.body, utf8('foo'))

    def test_if_modified_since(self):
        http_date = datetime.datetime.utcnow()
        request = HTTPRequest('http://example.com', if_modified_since=http_date)
        self.assertEqual(request.headers,
                         {'If-Modified-Since': format_timestamp(http_date)})
