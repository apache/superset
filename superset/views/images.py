from __future__ import absolute_import
from __future__ import division
from __future__ import print_function
from __future__ import unicode_literals

import io
import os
import signal
import socket
import StringIO

from PIL import Image
from flask import request, send_file, session
from flask_appbuilder import expose

from selenium import webdriver
from selenium.common.exceptions import TimeoutException, WebDriverException
from selenium.webdriver.support import ui

from superset import appbuilder, db
from superset.models.core import Slice
from .base import BaseSupersetView


class BrowserSession(object):
    """
    A context manager representing a Superset browser session accessed via the
    PhantomJS web-driver.
    """
    @staticmethod
    def get_session_cookie(driver):
        """Hack to find the cookie domain, can be removed if predicted"""
        driver.get(request.url_root + 'superset/welcome')
        session_cookie = None
        for cookie in driver.get_cookies():
            if cookie['name'] == 'session':
                session_cookie = cookie
        return session_cookie

    @classmethod
    def flask_to_driver(cls, driver):
        """Copies the flask request into the selenium driver"""
        session_cookie = cls.get_session_cookie(driver)
        if not session_cookie['domain'].statswith('.'):
            session_cookie['domain'] = '.' + session_cookie['domain']
        for k, v in request.cookies.items():
            if k == 'session':
                session_cookie['value'] = v
                driver.add_cookie(session_cookie)
                '''
                driver.add_cookie({
                    'name': k,
                    'value': v,
                    'domain': '.localhost',
                    'path': '/',
                })
                '''

        for k, v in request.headers.items():
            field = 'phantomjs.page.customHeaders.{}'.format(k)
            webdriver.DesiredCapabilities.PHANTOMJS[field] = v

    def __enter__(self):
        """
        Start a Superset browser session.
        Note that the user is logged in via internal authorization.
        :returns: The Superset browser session context manager
        :rtype: BrowserSession
        """
        self.driver = webdriver.PhantomJS(service_log_path=os.path.devnull)
        self.flask_to_driver(self.driver)
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

    def capture(self, path, wait=15, width=1280, height=800):
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
        url = request.url_root[:-1] + path
        self.driver.get(url)

        # The non-zero window height is merely a lower bound.
        self.driver.set_window_size(width, height)
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
        box = (0, 0, 1366, 728)
        im = Image.open(StringIO.StringIO(png))
        region = im.crop(box)
        region.save('/tmp/test.jpg', 'JPEG', optimize=True, quality=95)
        return io.BytesIO(png)


class Img(BaseSupersetView):

    """The base views for Superset!"""

    @expose("/slice/<slice_id>/")
    def slice(self, slice_id):
        """Assigns a list of found users to the given role."""

        slice_id = int(slice_id)
        slc = db.session.query(Slice).filter_by(id=slice_id).first()
        with BrowserSession() as browser:
            img = browser.capture(slc.slice_url + '&standalone=true')
            print(slc.slice_url + '&standalone=true')
            return send_file(img, mimetype='image/png')
        return "Nope"

appbuilder.add_view_no_menu(Img)
