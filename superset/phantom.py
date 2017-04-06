"""Wrapping phantom JS into a context manager

Ported from code written by John Bodley @ Airbnb by Maxime Beauchemin"""
from __future__ import absolute_import
from __future__ import division
from __future__ import print_function
from __future__ import unicode_literals

import io
import os
import signal
import socket
from urlparse import urljoin
from werkzeug.urls import Href
from PIL import Image
from selenium import webdriver
from selenium.common.exceptions import TimeoutException, WebDriverException
from selenium.webdriver.support import ui


class BrowserSession(object):
    """
    A context manager representing a Superset browser session accessed via the
    PhantomJS web-driver.
    """
    def __init__(self, base_url, headers=None):
        self.base_url = base_url
        self.headers = headers or {}

    def __enter__(self):
        """
        Start a Superset browser session.
        Note that the user is logged in via internal authorization.
        :returns: The Superset browser session context manager
        :rtype: BrowserSession
        """
        for key, value in self.headers.iteritems():
            field = 'phantomjs.page.customHeaders.{}'.format(key)
            webdriver.DesiredCapabilities.PHANTOMJS[field] = value

        url = urljoin(self.base_url, '/login/')
        self.driver = webdriver.PhantomJS(service_log_path=os.path.devnull)
        self.driver.get(url)

        return self

    def __exit__(self, *args):
        """
        End the Superset browser session by quitting the PhantomJS web-driver
        and ensuring that the forked child process is terminated.
        Note the the user is not logged out given that the PhantomJS web-driver
        may be non-responsive.
        """

        self.driver.service.process.send_signal(signal.SIGTERM)
        self.driver.quit()

    def capture(self, path, wait=15, width=1024):
        """
        Capture the screenshot of the rendered path as a PNG image using the
        PhantomJS headless browser.
        The PhantomJS web-driver waits until the page is loaded in the browser
        however not all AJAX elements within the page may have loaded and thus
        an explicit wait is defined prior to proceeding to capture the
        screenshot.
        If the page contains '.loading' CSS selector elements the page is deemed
        renderable when all the elements are hidden, otherwise the web-driver
        will wait the entire period.
        Note for an unknown reason the AJAX request may cause the web-driver to
        become non-responsive rendering the browser inoperable and eventually
        causing PhantomJS to crash. An explicit socket timeout signifies such
        an event.
        The PhantomJS web-driver only strictly adheres to the window width and
        window height is resized if needed to ensure that the entire page is
        encapsulated within the window.
        :param path: The Superset URL path
        :type path: str
        :param wait: The maximum time to wait for AJAX content in seconds
        :type wait: int
        :param width: The screenshot width in pixels
        :type width: int
        :returns: The captured image
        :rtype: PIL.Image
        :raises HTTPException: If the HTTP request fails
        :raises socket.timeout: If the page becomes non-responsive
        :raises URLError: If the connection is refused
        """

        href = Href(urljoin(self.base_url, path))
        url = href({'standalone': 'true'})
        print(url)
        self.driver.get(url)

        # The non-zero window height is merely a lower bound.
        self.driver.set_window_size(width, 1)

        try:
            elements = self.driver.find_elements_by_css_selector('.loading')
            try:
                # Ensure that the socket timeout exceeds the implicit wait.
                timeout = max(wait + 1, 60)
                socket.setdefaulttimeout(timeout)

                ui.WebDriverWait(self.driver, wait).until_not(
                    lambda x: any([elem.is_displayed() for elem in elements])
                )
            except TimeoutException:
                pass
            finally:
                socket.setdefaulttimeout(None)
        except WebDriverException:
            self.driver.implicitly_wait(wait)
        png = self.driver.get_screenshot_as_png()
        import StringIO
        box = (0, 0, 1366, 728)
        im = Image.open(StringIO.StringIO(png))
        region = im.crop(box)
        region.save('/tmp/test.jpg', 'JPEG', optimize=True, quality=95)
        return io.BytesIO(png)
