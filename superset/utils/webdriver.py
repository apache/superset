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
from enum import Enum
from time import sleep
from typing import Any, Dict, Optional, Tuple, TYPE_CHECKING

from flask import current_app
from selenium.common.exceptions import (
    StaleElementReferenceException,
    TimeoutException,
    WebDriverException,
)
from selenium.webdriver import chrome, firefox, FirefoxProfile
from selenium.webdriver.common.by import By
from selenium.webdriver.remote.webdriver import WebDriver
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.support.ui import WebDriverWait

from superset.extensions import machine_auth_provider_factory
from superset.utils.retries import retry_call

WindowSize = Tuple[int, int]
logger = logging.getLogger(__name__)


if TYPE_CHECKING:
    from flask_appbuilder.security.sqla.models import User


class DashboardStandaloneMode(Enum):
    HIDE_NAV = 1
    HIDE_NAV_AND_TITLE = 2
    REPORT = 3


class WebDriverProxy:
    def __init__(
        self, driver_type: str, window: Optional[WindowSize] = None, user: "User" = None
    ):
        self._driver_type = driver_type
        self._window: WindowSize = window or (800, 600)
        self._screenshot_locate_wait = current_app.config["SCREENSHOT_LOCATE_WAIT"]
        self._screenshot_load_wait = current_app.config["SCREENSHOT_LOAD_WAIT"]
        self._user = user
        self._driver = None

    def __del__(self) -> None:
        self._destroy()

    @property
    def driver(self) -> WebDriver:
        if not self._driver:
            self._driver = self._create()
            self._driver.set_window_size(*self._window)  # type: ignore
            if self._user:
                self._auth(self._user)
        return self._driver

    def _create(self) -> WebDriver:
        pixel_density = current_app.config["WEBDRIVER_WINDOW"].get("pixel_density", 1)
        if self._driver_type == "firefox":
            driver_class = firefox.webdriver.WebDriver
            options = firefox.options.Options()
            profile = FirefoxProfile()
            profile.set_preference("layout.css.devPixelsPerPx", str(pixel_density))
            kwargs: Dict[Any, Any] = dict(options=options, firefox_profile=profile)
        elif self._driver_type == "chrome":
            driver_class = chrome.webdriver.WebDriver
            options = chrome.options.Options()
            options.add_argument(f"--force-device-scale-factor={pixel_density}")
            options.add_argument(f"--window-size={self._window[0]},{self._window[1]}")
            kwargs = dict(options=options)
        else:
            raise Exception(f"Webdriver name ({self._driver_type}) not supported")
        # Prepare args for the webdriver init

        # Add additional configured options
        for arg in current_app.config["WEBDRIVER_OPTION_ARGS"]:
            options.add_argument(arg)

        kwargs.update(current_app.config["WEBDRIVER_CONFIGURATION"])
        logger.info("Init selenium driver")

        return driver_class(**kwargs)

    def _auth(self, user: "User") -> WebDriver:
        return machine_auth_provider_factory.instance.authenticate_webdriver(
            self.driver, user
        )

    def _destroy(self) -> None:
        """Destroy a driver"""

        if not self._driver:
            return

        # This is some very flaky code in selenium. Hence the retries
        # and catch-all exceptions

        try:
            retry_call(
                self._driver.close,
                max_tries=current_app.config["SCREENSHOT_SELENIUM_RETRIES"],
            )
        except Exception:  # pylint: disable=broad-except
            pass
        try:
            self._driver.quit()
        except Exception:  # pylint: disable=broad-except
            pass

        self._driver = None

    def get_screenshot(self, url: str, element_name: str) -> Optional[bytes]:
        self.driver.get(url)
        img: Optional[bytes] = None
        selenium_headstart = current_app.config["SCREENSHOT_SELENIUM_HEADSTART"]
        logger.debug("Sleeping for %i seconds", selenium_headstart)
        sleep(selenium_headstart)

        try:
            logger.debug("Wait for the presence of %s", element_name)
            element = WebDriverWait(self.driver, self._screenshot_locate_wait).until(
                EC.presence_of_element_located((By.CLASS_NAME, element_name))
            )
            logger.debug("Wait for .loading to be done")
            WebDriverWait(self.driver, self._screenshot_load_wait).until_not(
                EC.presence_of_all_elements_located((By.CLASS_NAME, "loading"))
            )
            logger.debug("Wait for chart to have content")
            WebDriverWait(self.driver, self._screenshot_locate_wait).until(
                EC.visibility_of_all_elements_located(
                    (By.CLASS_NAME, "slice_container")
                )
            )
            selenium_animation_wait = current_app.config[
                "SCREENSHOT_SELENIUM_ANIMATION_WAIT"
            ]
            logger.debug("Wait %i seconds for chart animation", selenium_animation_wait)
            sleep(selenium_animation_wait)
            logger.info("Taking a PNG screenshot of url %s", url)
            img = element.screenshot_as_png
        except TimeoutException:
            logger.warning("Selenium timed out requesting url %s", url, exc_info=True)
            img = element.screenshot_as_png
        except StaleElementReferenceException:
            logger.error(
                "Selenium got a stale element while requesting url %s",
                url,
                exc_info=True,
            )
        except WebDriverException as ex:
            logger.error(ex, exc_info=True)
        return img
