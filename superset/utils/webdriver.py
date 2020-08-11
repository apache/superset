# Licensed to the Apache Software Foundation (ASF) under one
# or more contributor license agreements.  See the NOTICE file
# distributed with this work for additional information
# regarding copyright ownership.  The ASF licenses this file
# to you under the Apache License, Version 2.0 (the
# "License"); you may not use this file except in compliance
# with the License.  You may obtain a copy of the License at
#
#   http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing,
# software distributed under the License is distributed on an
# "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
# KIND, either express or implied.  See the License for the
# specific language governing permissions and limitations
# under the License.

import logging
import time
from typing import Any, Callable, Dict, List, Optional, Tuple, TYPE_CHECKING

from flask import current_app, request, Response, session
from flask_login import login_user
from retry.api import retry_call
from selenium.common.exceptions import TimeoutException, WebDriverException
from selenium.webdriver import chrome, firefox
from selenium.webdriver.common.by import By
from selenium.webdriver.remote.webdriver import WebDriver
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.support.ui import WebDriverWait
from werkzeug.http import parse_cookie

from superset.utils.urls import headless_url

WindowSize = Tuple[int, int]
logger = logging.getLogger(__name__)

# Time in seconds, we will wait for the page to load and render
SELENIUM_CHECK_INTERVAL = 2
SELENIUM_RETRIES = 5
SELENIUM_HEADSTART = 3


if TYPE_CHECKING:
    # pylint: disable=unused-import
    from flask_appbuilder.security.sqla.models import User


def get_auth_cookies(user: "User") -> List[Dict[Any, Any]]:
    # Login with the user specified to get the reports
    with current_app.test_request_context("/login"):
        login_user(user)
        # A mock response object to get the cookie information from
        response = Response()
        current_app.session_interface.save_session(current_app, session, response)

    cookies = []

    # Set the cookies in the driver
    for name, value in response.headers:
        if name.lower() == "set-cookie":
            cookie = parse_cookie(value)
            cookies.append(cookie["session"])
    return cookies


def auth_driver(
    driver: WebDriver,
    user: "User",
    auth_cookies_func: Optional[Callable[["User"], List[Dict[Any, Any]]]] = None,
) -> WebDriver:
    """
        Default AuthDriverFuncType type that sets a session cookie flask-login style
    :return: WebDriver
    """

    if user:
        # Set the cookies in the driver
        for cookie in (auth_cookies_func or get_auth_cookies)(user):
            info = dict(name="session", value=cookie)
            driver.add_cookie(info)
    elif request.cookies:
        cookies = request.cookies
        for k, v in cookies.items():
            cookie = dict(name=k, value=v)
            driver.add_cookie(cookie)
    return driver


class WebDriverProxy:
    def __init__(
        self,
        driver_type: str,
        window: Optional[WindowSize] = None,
        auth_func: Optional[
            Callable[..., Any]
        ] = None,  # pylint: disable=bad-whitespace
        get_cookies_func: Optional[
            Callable[..., Any]
        ] = None,  # pylint: disable=bad-whitespace
    ):
        self._driver_type = driver_type
        self._window: WindowSize = window or (800, 600)

        config_auth_func = current_app.config["WEBDRIVER_AUTH_FUNC"] or auth_driver
        self._auth_func = auth_func or config_auth_func

        config_auth_cookies_func = (
            current_app.config["WEBDRIVER_AUTH_COOKIES_FUNC"] or get_auth_cookies
        )
        self._auth_cookies_func = get_cookies_func or config_auth_cookies_func

    def create(self) -> WebDriver:
        if self._driver_type == "firefox":
            driver_class = firefox.webdriver.WebDriver
            options = firefox.options.Options()
        elif self._driver_type == "chrome":
            driver_class = chrome.webdriver.WebDriver
            options = chrome.options.Options()
            arg: str = f"--window-size={self._window[0]},{self._window[1]}"
            options.add_argument(arg)
            # TODO: 2 lines attempting retina PPI don't seem to be working
            options.add_argument("--force-device-scale-factor=2.0")
            options.add_argument("--high-dpi-support=2.0")
        else:
            raise Exception(f"Webdriver name ({self._driver_type}) not supported")
        # Prepare args for the webdriver init
        options.add_argument("--headless")
        kwargs: Dict[Any, Any] = dict(options=options)
        kwargs.update(current_app.config["WEBDRIVER_CONFIGURATION"])
        logger.info("Init selenium driver")
        return driver_class(**kwargs)

    def auth(self, user: "User") -> WebDriver:
        driver = self.create()
        # Setting cookies requires doing a request first
        driver.get(headless_url("/login/"))
        return self._auth_func(driver, user, auth_cookies_func=self._auth_cookies_func)

    def get_auth_cookies(self, user: "User") -> List[Dict[Any, Any]]:
        return self._auth_cookies_func(user)

    @staticmethod
    def destroy(driver: WebDriver, tries: int = 2) -> None:
        """Destroy a driver"""
        # This is some very flaky code in selenium. Hence the retries
        # and catch-all exceptions
        try:
            retry_call(driver.close, tries=tries)
        except Exception:  # pylint: disable=broad-except
            pass
        try:
            driver.quit()
        except Exception:  # pylint: disable=broad-except
            pass

    def get_screenshot(
        self,
        url: str,
        element_name: str,
        user: "User",
        retries: int = SELENIUM_RETRIES,
    ) -> Optional[bytes]:
        driver = self.auth(user)
        driver.set_window_size(*self._window)
        driver.get(url)
        img: Optional[bytes] = None
        logger.debug("Sleeping for %i seconds", SELENIUM_HEADSTART)
        time.sleep(SELENIUM_HEADSTART)
        try:
            logger.debug("Wait for the presence of %s", element_name)
            element = WebDriverWait(
                driver, current_app.config["SCREENSHOT_LOCATE_WAIT"]
            ).until(EC.presence_of_element_located((By.CLASS_NAME, element_name)))
            logger.debug("Wait for .loading to be done")
            WebDriverWait(driver, current_app.config["SCREENSHOT_LOAD_WAIT"]).until_not(
                EC.presence_of_all_elements_located((By.CLASS_NAME, "loading"))
            )
            logger.info("Taking a PNG screenshot")
            img = element.screenshot_as_png
        except TimeoutException:
            logger.error("Selenium timed out")
        except WebDriverException as ex:
            logger.error(ex)
            # Some webdrivers do not support screenshots for elements.
            # In such cases, take a screenshot of the entire page.
            img = driver.screenshot()  # pylint: disable=no-member
        finally:
            self.destroy(driver, retries)
        return img
