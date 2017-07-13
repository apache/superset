# -*- coding: utf-8 -*-
"""
    flask_testing.utils
    ~~~~~~~~~~~~~~~~~~~

    Flask unittest integration.

    :copyright: (c) 2010 by Dan Jacob.
    :license: BSD, see LICENSE for more details.
"""
from __future__ import absolute_import, with_statement

import gc
import multiprocessing
import socket
import time

try:
    import socketserver
except ImportError:
    # Python 2 SocketServer fallback
    import SocketServer as socketserver

try:
    import unittest2 as unittest
except ImportError:
    import unittest

try:
    from urllib.parse import urlparse, urljoin
except ImportError:
    # Python 2 urlparse fallback
    from urlparse import urlparse, urljoin

from werkzeug import cached_property

# Use Flask's preferred JSON module so that our runtime behavior matches.
from flask import json_available, templating, template_rendered

try:
    from flask import message_flashed

    _is_message_flashed = True
except ImportError:
    message_flashed = None
    _is_message_flashed = False

if json_available:
    from flask import json

# we'll use signals for template-related tests if
# available in this version of Flask
try:
    import blinker

    _is_signals = True
except ImportError:  # pragma: no cover
    _is_signals = False

__all__ = ["TestCase"]


class ContextVariableDoesNotExist(Exception):
    pass


class JsonResponseMixin(object):
    """
    Mixin with testing helper methods
    """

    @cached_property
    def json(self):
        if not json_available:  # pragma: no cover
            raise NotImplementedError
        return json.loads(self.data)


def _make_test_response(response_class):
    class TestResponse(response_class, JsonResponseMixin):
        pass

    return TestResponse


def _empty_render(template, context, app):
    """
    Used to monkey patch the render_template flask method when
    the render_templates property is set to False in the TestCase
    """
    if _is_signals:
        template_rendered.send(app, template=template, context=context)

    return ""


def _check_for_message_flashed_support():
    if not _is_signals or not _is_message_flashed:
        raise RuntimeError(
            "Your version of Flask doesn't support message_flashed. "
            "This requires Flask 0.10+ with the blinker module installed."
        )


def _check_for_signals_support():
    if not _is_signals:
        raise RuntimeError(
            "Your version of Flask doesn't support signals. "
            "This requires Flask 0.6+ with the blinker module installed."
        )


class TestCase(unittest.TestCase):
    render_templates = True
    run_gc_after_test = False

    def create_app(self):
        """
        Create your Flask app here, with any
        configuration you need.
        """
        raise NotImplementedError

    def __call__(self, result=None):
        """
        Does the required setup, doing it here
        means you don't have to call super.setUp
        in subclasses.
        """
        try:
            self._pre_setup()
            super(TestCase, self).__call__(result)
        finally:
            self._post_teardown()

    def _pre_setup(self):
        self.app = self.create_app()

        self._orig_response_class = self.app.response_class
        self.app.response_class = _make_test_response(self.app.response_class)

        self.client = self.app.test_client()

        self._ctx = self.app.test_request_context()
        self._ctx.push()

        if not self.render_templates:
            # Monkey patch the original template render with a empty render
            self._original_template_render = templating._render
            templating._render = _empty_render

        self.templates = []
        self.flashed_messages = []

        if _is_signals:
            template_rendered.connect(self._add_template)

            if _is_message_flashed:
                message_flashed.connect(self._add_flash_message)

    def _add_flash_message(self, app, message, category):
        self.flashed_messages.append((message, category))

    def _add_template(self, app, template, context):
        if len(self.templates) > 0:
            self.templates = []
        self.templates.append((template, context))

    def _post_teardown(self):
        if getattr(self, '_ctx', None) is not None:
            self._ctx.pop()
            del self._ctx

        if getattr(self, 'app', None) is not None:
            if getattr(self, '_orig_response_class', None) is not None:
                self.app.response_class = self._orig_response_class
            del self.app

        if hasattr(self, 'client'):
            del self.client

        if hasattr(self, 'templates'):
            del self.templates

        if hasattr(self, 'flashed_messages'):
            del self.flashed_messages

        if _is_signals:
            template_rendered.disconnect(self._add_template)

            if _is_message_flashed:
                message_flashed.disconnect(self._add_flash_message)

        if hasattr(self, '_original_template_render'):
            templating._render = self._original_template_render

        if self.run_gc_after_test:
            gc.collect()

    def assertMessageFlashed(self, message, category='message'):
        """
        Checks if a given message was flashed.
        Only works if your version of Flask has message_flashed
        signal support (0.10+) and blinker is installed.

        :param message: expected message
        :param category: expected message category
        """
        _check_for_message_flashed_support()

        for _message, _category in self.flashed_messages:
            if _message == message and _category == category:
                return True

        raise AssertionError("Message '%s' in category '%s' wasn't flashed" % (message, category))

    assert_message_flashed = assertMessageFlashed

    def assertTemplateUsed(self, name, tmpl_name_attribute='name'):
        """
        Checks if a given template is used in the request.
        Only works if your version of Flask has signals
        support (0.6+) and blinker is installed.
        If the template engine used is not Jinja2, provide
        ``tmpl_name_attribute`` with a value of its `Template`
        class attribute name which contains the provided ``name`` value.

        :versionadded: 0.2
        :param name: template name
        :param tmpl_name_attribute: template engine specific attribute name
        """
        _check_for_signals_support()

        used_templates = []

        for template, context in self.templates:
            if getattr(template, tmpl_name_attribute) == name:
                return True

            used_templates.append(template)

        raise AssertionError("Template %s not used. Templates were used: %s" % (name, ' '.join(repr(used_templates))))

    assert_template_used = assertTemplateUsed

    def get_context_variable(self, name):
        """
        Returns a variable from the context passed to the
        template. Only works if your version of Flask
        has signals support (0.6+) and blinker is installed.

        Raises a ContextVariableDoesNotExist exception if does
        not exist in context.

        :versionadded: 0.2
        :param name: name of variable
        """
        _check_for_signals_support()

        for template, context in self.templates:
            if name in context:
                return context[name]
        raise ContextVariableDoesNotExist

    def assertContext(self, name, value, message=None):
        """
        Checks if given name exists in the template context
        and equals the given value.

        :versionadded: 0.2
        :param name: name of context variable
        :param value: value to check against
        """

        try:
            self.assertEqual(self.get_context_variable(name), value, message)
        except ContextVariableDoesNotExist:
            self.fail(message or "Context variable does not exist: %s" % name)

    assert_context = assertContext

    def assertRedirects(self, response, location, message=None):
        """
        Checks if response is an HTTP redirect to the
        given location.

        :param response: Flask response
        :param location: relative URL path to SERVER_NAME or an absolute URL
        """
        parts = urlparse(location)

        if parts.netloc:
            expected_location = location
        else:
            server_name = self.app.config.get('SERVER_NAME') or 'localhost'
            expected_location = urljoin("http://%s" % server_name, location)

        valid_status_codes = (301, 302, 303, 305, 307)
        valid_status_code_str = ', '.join(str(code) for code in valid_status_codes)
        not_redirect = "HTTP Status %s expected but got %d" % (valid_status_code_str, response.status_code)
        self.assertTrue(response.status_code in valid_status_codes, message or not_redirect)
        self.assertEqual(response.location, expected_location, message)

    assert_redirects = assertRedirects

    def assertStatus(self, response, status_code, message=None):
        """
        Helper method to check matching response status.

        :param response: Flask response
        :param status_code: response status code (e.g. 200)
        :param message: Message to display on test failure
        """

        message = message or 'HTTP Status %s expected but got %s' \
                             % (status_code, response.status_code)
        self.assertEqual(response.status_code, status_code, message)

    assert_status = assertStatus

    def assert200(self, response, message=None):
        """
        Checks if response status code is 200

        :param response: Flask response
        :param message: Message to display on test failure
        """

        self.assertStatus(response, 200, message)

    assert_200 = assert200

    def assert400(self, response, message=None):
        """
        Checks if response status code is 400

        :versionadded: 0.2.5
        :param response: Flask response
        :param message: Message to display on test failure
        """

        self.assertStatus(response, 400, message)

    assert_400 = assert400

    def assert401(self, response, message=None):
        """
        Checks if response status code is 401

        :versionadded: 0.2.1
        :param response: Flask response
        :param message: Message to display on test failure
        """

        self.assertStatus(response, 401, message)

    assert_401 = assert401

    def assert403(self, response, message=None):
        """
        Checks if response status code is 403

        :versionadded: 0.2
        :param response: Flask response
        :param message: Message to display on test failure
        """

        self.assertStatus(response, 403, message)

    assert_403 = assert403

    def assert404(self, response, message=None):
        """
        Checks if response status code is 404

        :param response: Flask response
        :param message: Message to display on test failure
        """

        self.assertStatus(response, 404, message)

    assert_404 = assert404

    def assert405(self, response, message=None):
        """
        Checks if response status code is 405

        :versionadded: 0.2
        :param response: Flask response
        :param message: Message to display on test failure
        """

        self.assertStatus(response, 405, message)

    assert_405 = assert405

    def assert500(self, response, message=None):
        """
        Checks if response status code is 500

        :versionadded: 0.4.1
        :param response: Flask response
        :param message: Message to display on test failure
        """

        self.assertStatus(response, 500, message)

    assert_500 = assert500


# A LiveServerTestCase useful with Selenium or headless browsers
# Inspired by https://docs.djangoproject.com/en/dev/topics/testing/#django.test.LiveServerTestCase

class LiveServerTestCase(unittest.TestCase):
    def create_app(self):
        """
        Create your Flask app here, with any
        configuration you need.
        """
        raise NotImplementedError

    def __call__(self, result=None):
        """
        Does the required setup, doing it here means you don't have to
        call super.setUp in subclasses.
        """

        # Get the app
        self.app = self.create_app()

        self._configured_port = self.app.config.get('LIVESERVER_PORT', 5000)
        self._port_value = multiprocessing.Value('i', self._configured_port)

        # We need to create a context in order for extensions to catch up
        self._ctx = self.app.test_request_context()
        self._ctx.push()

        try:
            self._spawn_live_server()
            super(LiveServerTestCase, self).__call__(result)
        finally:
            self._post_teardown()
            self._terminate_live_server()

    def get_server_url(self):
        """
        Return the url of the test server
        """
        return 'http://localhost:%s' % self._port_value.value

    def _spawn_live_server(self):
        self._process = None
        port_value = self._port_value

        def worker(app, port):
            # Based on solution: http://stackoverflow.com/a/27598916
            # Monkey-patch the server_bind so we can determine the port bound by Flask.
            # This handles the case where the port specified is `0`, which means that
            # the OS chooses the port. This is the only known way (currently) of getting
            # the port out of Flask once we call `run`.
            original_socket_bind = socketserver.TCPServer.server_bind
            def socket_bind_wrapper(self):
                ret = original_socket_bind(self)

                # Get the port and save it into the port_value, so the parent process
                # can read it.
                (_, port) = self.socket.getsockname()
                port_value.value = port
                socketserver.TCPServer.server_bind = original_socket_bind
                return ret

            socketserver.TCPServer.server_bind = socket_bind_wrapper
            app.run(port=port, use_reloader=False)

        self._process = multiprocessing.Process(
            target=worker, args=(self.app, self._configured_port)
        )

        self._process.start()

        # We must wait for the server to start listening, but give up
        # after a specified maximum timeout
        timeout = self.app.config.get('LIVESERVER_TIMEOUT', 5)
        start_time = time.time()

        while True:
            elapsed_time = (time.time() - start_time)
            if elapsed_time > timeout:
                raise RuntimeError(
                    "Failed to start the server after %d seconds. " % timeout
                )

            if self._can_ping_server():
                break

    def _can_ping_server(self):
        host, port = self._get_server_address()
        if port == 0:
            # Port specified by the user was 0, and the OS has not yet assigned
            # the proper port.
            return False

        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        try:
            sock.connect((host, port))
        except socket.error as e:
            success = False
        else:
            success = True
        finally:
            sock.close()

        return success

    def _get_server_address(self):
        """
        Gets the server address used to test the connection with a socket.
        Respects both the LIVESERVER_PORT config value and overriding
        get_server_url()
        """
        parts = urlparse(self.get_server_url())

        host = parts.hostname
        port = parts.port

        if port is None:
            if parts.scheme == 'http':
                port = 80
            elif parts.scheme == 'https':
                port = 443
            else:
                raise RuntimeError(
                    "Unsupported server url scheme: %s" % parts.scheme
                )

        return host, port

    def _post_teardown(self):
        if getattr(self, '_ctx', None) is not None:
            self._ctx.pop()
            del self._ctx

    def _terminate_live_server(self):
        if self._process:
            self._process.terminate()
