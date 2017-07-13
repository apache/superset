#!/usr/bin/env python
#
# Copyright 2009 Facebook
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

"""WSGI support for the Tornado web framework.

WSGI is the Python standard for web servers, and allows for interoperability
between Tornado and other Python web frameworks and servers.  This module
provides WSGI support in two ways:

* `WSGIAdapter` converts a `tornado.web.Application` to the WSGI application
  interface.  This is useful for running a Tornado app on another
  HTTP server, such as Google App Engine.  See the `WSGIAdapter` class
  documentation for limitations that apply.
* `WSGIContainer` lets you run other WSGI applications and frameworks on the
  Tornado HTTP server.  For example, with this class you can mix Django
  and Tornado handlers in a single server.
"""

from __future__ import absolute_import, division, print_function, with_statement

import sys
from io import BytesIO
import tornado

from tornado.concurrent import Future
from tornado import escape
from tornado import httputil
from tornado.log import access_log
from tornado import web
from tornado.escape import native_str
from tornado.util import unicode_type


try:
    import urllib.parse as urllib_parse  # py3
except ImportError:
    import urllib as urllib_parse

# PEP 3333 specifies that WSGI on python 3 generally deals with byte strings
# that are smuggled inside objects of type unicode (via the latin1 encoding).
# These functions are like those in the tornado.escape module, but defined
# here to minimize the temptation to use them in non-wsgi contexts.
if str is unicode_type:
    def to_wsgi_str(s):
        assert isinstance(s, bytes)
        return s.decode('latin1')

    def from_wsgi_str(s):
        assert isinstance(s, str)
        return s.encode('latin1')
else:
    def to_wsgi_str(s):
        assert isinstance(s, bytes)
        return s

    def from_wsgi_str(s):
        assert isinstance(s, str)
        return s


class WSGIApplication(web.Application):
    """A WSGI equivalent of `tornado.web.Application`.

    .. deprecated:: 4.0

       Use a regular `.Application` and wrap it in `WSGIAdapter` instead.
    """
    def __call__(self, environ, start_response):
        return WSGIAdapter(self)(environ, start_response)


# WSGI has no facilities for flow control, so just return an already-done
# Future when the interface requires it.
_dummy_future = Future()
_dummy_future.set_result(None)


class _WSGIConnection(httputil.HTTPConnection):
    def __init__(self, method, start_response, context):
        self.method = method
        self.start_response = start_response
        self.context = context
        self._write_buffer = []
        self._finished = False
        self._expected_content_remaining = None
        self._error = None

    def set_close_callback(self, callback):
        # WSGI has no facility for detecting a closed connection mid-request,
        # so we can simply ignore the callback.
        pass

    def write_headers(self, start_line, headers, chunk=None, callback=None):
        if self.method == 'HEAD':
            self._expected_content_remaining = 0
        elif 'Content-Length' in headers:
            self._expected_content_remaining = int(headers['Content-Length'])
        else:
            self._expected_content_remaining = None
        self.start_response(
            '%s %s' % (start_line.code, start_line.reason),
            [(native_str(k), native_str(v)) for (k, v) in headers.get_all()])
        if chunk is not None:
            self.write(chunk, callback)
        elif callback is not None:
            callback()
        return _dummy_future

    def write(self, chunk, callback=None):
        if self._expected_content_remaining is not None:
            self._expected_content_remaining -= len(chunk)
            if self._expected_content_remaining < 0:
                self._error = httputil.HTTPOutputError(
                    "Tried to write more data than Content-Length")
                raise self._error
        self._write_buffer.append(chunk)
        if callback is not None:
            callback()
        return _dummy_future

    def finish(self):
        if (self._expected_content_remaining is not None and
                self._expected_content_remaining != 0):
            self._error = httputil.HTTPOutputError(
                "Tried to write %d bytes less than Content-Length" %
                self._expected_content_remaining)
            raise self._error
        self._finished = True


class _WSGIRequestContext(object):
    def __init__(self, remote_ip, protocol):
        self.remote_ip = remote_ip
        self.protocol = protocol

    def __str__(self):
        return self.remote_ip


class WSGIAdapter(object):
    """Converts a `tornado.web.Application` instance into a WSGI application.

    Example usage::

        import tornado.web
        import tornado.wsgi
        import wsgiref.simple_server

        class MainHandler(tornado.web.RequestHandler):
            def get(self):
                self.write("Hello, world")

        if __name__ == "__main__":
            application = tornado.web.Application([
                (r"/", MainHandler),
            ])
            wsgi_app = tornado.wsgi.WSGIAdapter(application)
            server = wsgiref.simple_server.make_server('', 8888, wsgi_app)
            server.serve_forever()

    See the `appengine demo
    <https://github.com/tornadoweb/tornado/tree/stable/demos/appengine>`_
    for an example of using this module to run a Tornado app on Google
    App Engine.

    In WSGI mode asynchronous methods are not supported.  This means
    that it is not possible to use `.AsyncHTTPClient`, or the
    `tornado.auth` or `tornado.websocket` modules.

    .. versionadded:: 4.0
    """
    def __init__(self, application):
        if isinstance(application, WSGIApplication):
            self.application = lambda request: web.Application.__call__(
                application, request)
        else:
            self.application = application

    def __call__(self, environ, start_response):
        method = environ["REQUEST_METHOD"]
        uri = urllib_parse.quote(from_wsgi_str(environ.get("SCRIPT_NAME", "")))
        uri += urllib_parse.quote(from_wsgi_str(environ.get("PATH_INFO", "")))
        if environ.get("QUERY_STRING"):
            uri += "?" + environ["QUERY_STRING"]
        headers = httputil.HTTPHeaders()
        if environ.get("CONTENT_TYPE"):
            headers["Content-Type"] = environ["CONTENT_TYPE"]
        if environ.get("CONTENT_LENGTH"):
            headers["Content-Length"] = environ["CONTENT_LENGTH"]
        for key in environ:
            if key.startswith("HTTP_"):
                headers[key[5:].replace("_", "-")] = environ[key]
        if headers.get("Content-Length"):
            body = environ["wsgi.input"].read(
                int(headers["Content-Length"]))
        else:
            body = b""
        protocol = environ["wsgi.url_scheme"]
        remote_ip = environ.get("REMOTE_ADDR", "")
        if environ.get("HTTP_HOST"):
            host = environ["HTTP_HOST"]
        else:
            host = environ["SERVER_NAME"]
        connection = _WSGIConnection(method, start_response,
                                     _WSGIRequestContext(remote_ip, protocol))
        request = httputil.HTTPServerRequest(
            method, uri, "HTTP/1.1", headers=headers, body=body,
            host=host, connection=connection)
        request._parse_body()
        self.application(request)
        if connection._error:
            raise connection._error
        if not connection._finished:
            raise Exception("request did not finish synchronously")
        return connection._write_buffer


class WSGIContainer(object):
    r"""Makes a WSGI-compatible function runnable on Tornado's HTTP server.

    .. warning::

       WSGI is a *synchronous* interface, while Tornado's concurrency model
       is based on single-threaded asynchronous execution.  This means that
       running a WSGI app with Tornado's `WSGIContainer` is *less scalable*
       than running the same app in a multi-threaded WSGI server like
       ``gunicorn`` or ``uwsgi``.  Use `WSGIContainer` only when there are
       benefits to combining Tornado and WSGI in the same process that
       outweigh the reduced scalability.

    Wrap a WSGI function in a `WSGIContainer` and pass it to `.HTTPServer` to
    run it. For example::

        def simple_app(environ, start_response):
            status = "200 OK"
            response_headers = [("Content-type", "text/plain")]
            start_response(status, response_headers)
            return ["Hello world!\n"]

        container = tornado.wsgi.WSGIContainer(simple_app)
        http_server = tornado.httpserver.HTTPServer(container)
        http_server.listen(8888)
        tornado.ioloop.IOLoop.current().start()

    This class is intended to let other frameworks (Django, web.py, etc)
    run on the Tornado HTTP server and I/O loop.

    The `tornado.web.FallbackHandler` class is often useful for mixing
    Tornado and WSGI apps in the same server.  See
    https://github.com/bdarnell/django-tornado-demo for a complete example.
    """
    def __init__(self, wsgi_application):
        self.wsgi_application = wsgi_application

    def __call__(self, request):
        data = {}
        response = []

        def start_response(status, response_headers, exc_info=None):
            data["status"] = status
            data["headers"] = response_headers
            return response.append
        app_response = self.wsgi_application(
            WSGIContainer.environ(request), start_response)
        try:
            response.extend(app_response)
            body = b"".join(response)
        finally:
            if hasattr(app_response, "close"):
                app_response.close()
        if not data:
            raise Exception("WSGI app did not call start_response")

        status_code, reason = data["status"].split(' ', 1)
        status_code = int(status_code)
        headers = data["headers"]
        header_set = set(k.lower() for (k, v) in headers)
        body = escape.utf8(body)
        if status_code != 304:
            if "content-length" not in header_set:
                headers.append(("Content-Length", str(len(body))))
            if "content-type" not in header_set:
                headers.append(("Content-Type", "text/html; charset=UTF-8"))
        if "server" not in header_set:
            headers.append(("Server", "TornadoServer/%s" % tornado.version))

        start_line = httputil.ResponseStartLine("HTTP/1.1", status_code, reason)
        header_obj = httputil.HTTPHeaders()
        for key, value in headers:
            header_obj.add(key, value)
        request.connection.write_headers(start_line, header_obj, chunk=body)
        request.connection.finish()
        self._log(status_code, request)

    @staticmethod
    def environ(request):
        """Converts a `tornado.httputil.HTTPServerRequest` to a WSGI environment.
        """
        hostport = request.host.split(":")
        if len(hostport) == 2:
            host = hostport[0]
            port = int(hostport[1])
        else:
            host = request.host
            port = 443 if request.protocol == "https" else 80
        environ = {
            "REQUEST_METHOD": request.method,
            "SCRIPT_NAME": "",
            "PATH_INFO": to_wsgi_str(escape.url_unescape(
                request.path, encoding=None, plus=False)),
            "QUERY_STRING": request.query,
            "REMOTE_ADDR": request.remote_ip,
            "SERVER_NAME": host,
            "SERVER_PORT": str(port),
            "SERVER_PROTOCOL": request.version,
            "wsgi.version": (1, 0),
            "wsgi.url_scheme": request.protocol,
            "wsgi.input": BytesIO(escape.utf8(request.body)),
            "wsgi.errors": sys.stderr,
            "wsgi.multithread": False,
            "wsgi.multiprocess": True,
            "wsgi.run_once": False,
        }
        if "Content-Type" in request.headers:
            environ["CONTENT_TYPE"] = request.headers.pop("Content-Type")
        if "Content-Length" in request.headers:
            environ["CONTENT_LENGTH"] = request.headers.pop("Content-Length")
        for key, value in request.headers.items():
            environ["HTTP_" + key.replace("-", "_").upper()] = value
        return environ

    def _log(self, status_code, request):
        if status_code < 400:
            log_method = access_log.info
        elif status_code < 500:
            log_method = access_log.warning
        else:
            log_method = access_log.error
        request_time = 1000.0 * request.request_time()
        summary = request.method + " " + request.uri + " (" + \
            request.remote_ip + ")"
        log_method("%d %s %.2fms", status_code, summary, request_time)


HTTPRequest = httputil.HTTPServerRequest
