from __future__ import absolute_import, division, print_function, with_statement
from wsgiref.validate import validator

from tornado.escape import json_decode
from tornado.test.httpserver_test import TypeCheckHandler
from tornado.testing import AsyncHTTPTestCase
from tornado.util import u
from tornado.web import RequestHandler, Application
from tornado.wsgi import WSGIApplication, WSGIContainer, WSGIAdapter


class WSGIContainerTest(AsyncHTTPTestCase):
    def wsgi_app(self, environ, start_response):
        status = "200 OK"
        response_headers = [("Content-Type", "text/plain")]
        start_response(status, response_headers)
        return [b"Hello world!"]

    def get_app(self):
        return WSGIContainer(validator(self.wsgi_app))

    def test_simple(self):
        response = self.fetch("/")
        self.assertEqual(response.body, b"Hello world!")


class WSGIApplicationTest(AsyncHTTPTestCase):
    def get_app(self):
        class HelloHandler(RequestHandler):
            def get(self):
                self.write("Hello world!")

        class PathQuotingHandler(RequestHandler):
            def get(self, path):
                self.write(path)

        # It would be better to run the wsgiref server implementation in
        # another thread instead of using our own WSGIContainer, but this
        # fits better in our async testing framework and the wsgiref
        # validator should keep us honest
        return WSGIContainer(validator(WSGIApplication([
            ("/", HelloHandler),
            ("/path/(.*)", PathQuotingHandler),
            ("/typecheck", TypeCheckHandler),
        ])))

    def test_simple(self):
        response = self.fetch("/")
        self.assertEqual(response.body, b"Hello world!")

    def test_path_quoting(self):
        response = self.fetch("/path/foo%20bar%C3%A9")
        self.assertEqual(response.body, u("foo bar\u00e9").encode("utf-8"))

    def test_types(self):
        headers = {"Cookie": "foo=bar"}
        response = self.fetch("/typecheck?foo=bar", headers=headers)
        data = json_decode(response.body)
        self.assertEqual(data, {})

        response = self.fetch("/typecheck", method="POST", body="foo=bar", headers=headers)
        data = json_decode(response.body)
        self.assertEqual(data, {})

# This is kind of hacky, but run some of the HTTPServer tests through
# WSGIContainer and WSGIApplication to make sure everything survives
# repeated disassembly and reassembly.
from tornado.test import httpserver_test
from tornado.test import web_test


class WSGIConnectionTest(httpserver_test.HTTPConnectionTest):
    def get_app(self):
        return WSGIContainer(validator(WSGIApplication(self.get_handlers())))


def wrap_web_tests_application():
    result = {}
    for cls in web_test.wsgi_safe_tests:
        class WSGIApplicationWrappedTest(cls):
            def get_app(self):
                self.app = WSGIApplication(self.get_handlers(),
                                           **self.get_app_kwargs())
                return WSGIContainer(validator(self.app))
        result["WSGIApplication_" + cls.__name__] = WSGIApplicationWrappedTest
    return result
globals().update(wrap_web_tests_application())


def wrap_web_tests_adapter():
    result = {}
    for cls in web_test.wsgi_safe_tests:
        class WSGIAdapterWrappedTest(cls):
            def get_app(self):
                self.app = Application(self.get_handlers(),
                                       **self.get_app_kwargs())
                return WSGIContainer(validator(WSGIAdapter(self.app)))
        result["WSGIAdapter_" + cls.__name__] = WSGIAdapterWrappedTest
    return result
globals().update(wrap_web_tests_adapter())
