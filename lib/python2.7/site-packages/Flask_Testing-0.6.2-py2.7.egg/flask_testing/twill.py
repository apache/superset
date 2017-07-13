# -*- coding: utf-8 -*-
"""
    flask_testing.twill
    ~~~~~~~~~~~~~~~~~~~

    Flask unittest integration.

    :copyright: (c) 2010 by Dan Jacob.
    :license: BSD, see LICENSE for more details.
"""

from __future__ import absolute_import

import StringIO
import twill

from .utils import TestCase


class Twill(object):
    """

    :versionadded: 0.3

    Twill wrapper utility class.

    Creates a Twill ``browser`` instance and handles
    WSGI intercept.

    Usage::

        t = Twill(self.app)
        with t:
            t.browser.go("/")
            t.url("/")

    """
    def __init__(self, app, host='127.0.0.1', port=5000, scheme='http'):
        self.app = app
        self.host = host
        self.port = port
        self.scheme = scheme

        self.browser = twill.get_browser()

    def __enter__(self):
        twill.set_output(StringIO.StringIO())
        twill.commands.clear_cookies()
        twill.add_wsgi_intercept(self.host,
                                 self.port,
                                 lambda: self.app)

        return self

    def __exit__(self, exc_type, exc_value, tb):
        twill.remove_wsgi_intercept(self.host,
                                    self.port)

        twill.commands.reset_output()

    def url(self, url):
        """
        Makes complete URL based on host, port and scheme
        Twill settings.

        :param url: relative URL
        """
        return "%s://%s:%d%s" % (self.scheme,
                                 self.host,
                                 self.port,
                                 url)


class TwillTestCase(TestCase):
    """
    :deprecated: use Twill helper class instead.

    Creates a Twill ``browser`` instance and handles
    WSGI intercept.
    """

    twill_host = "127.0.0.1"
    twill_port = 5000
    twill_scheme = "http"

    def _pre_setup(self):
        super(TwillTestCase, self)._pre_setup()
        twill.set_output(StringIO.StringIO())
        twill.commands.clear_cookies()
        twill.add_wsgi_intercept(self.twill_host,
                                 self.twill_port,
                                 lambda: self.app)

        self.browser = twill.get_browser()

    def _post_teardown(self):

        twill.remove_wsgi_intercept(self.twill_host,
                                    self.twill_port)

        twill.commands.reset_output()

        super(TwillTestCase, self)._post_teardown()

    def make_twill_url(self, url):
        """
        Makes complete URL based on host, port and scheme
        Twill settings.

        :param url: relative URL
        """
        return "%s://%s:%d%s" % (self.twill_scheme,
                                 self.twill_host,
                                 self.twill_port,
                                 url)
