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

from __future__ import annotations

import logging
from abc import ABC, abstractmethod
from enum import Enum
from time import sleep
from typing import TYPE_CHECKING

from flask import current_app as app
from packaging import version
from selenium import __version__ as selenium_version
from selenium.common.exceptions import (
    StaleElementReferenceException,
    TimeoutException,
    WebDriverException,
)
from selenium.webdriver import chrome, firefox, FirefoxProfile
from selenium.webdriver.common.by import By
from selenium.webdriver.common.service import Service
from selenium.webdriver.remote.webdriver import WebDriver
from selenium.webdriver.support import expected_conditions as EC  # noqa: N812
from selenium.webdriver.support.ui import WebDriverWait

from superset.extensions import machine_auth_provider_factory
from superset.utils.retries import retry_call
from superset.utils.screenshot_utils import take_tiled_screenshot

WindowSize = tuple[int, int]
logger = logging.getLogger(__name__)

if TYPE_CHECKING:
    from typing import Any

    from flask_appbuilder.security.sqla.models import User

try:
    from playwright.sync_api import (
        BrowserContext,
        Error as PlaywrightError,
        Locator,
        Page,
        sync_playwright,
        TimeoutError as PlaywrightTimeout,
    )
except ImportError:
    from typing import Any

    # Define dummy classes when playwright is not available
    BrowserContext = Any
    PlaywrightError = Exception
    PlaywrightTimeout = Exception
    Locator = Any
    Page = Any
    sync_playwright = None


class DashboardStandaloneMode(Enum):
    HIDE_NAV = 1
    HIDE_NAV_AND_TITLE = 2
    REPORT = 3


class ChartStandaloneMode(Enum):
    HIDE_NAV = "true"
    SHOW_NAV = 0


# pylint: disable=too-few-public-methods
class WebDriverProxy(ABC):
    def __init__(self, driver_type: str, window: WindowSize | None = None):
        self._driver_type = driver_type
        self._window: WindowSize = window or (800, 600)
        self._screenshot_locate_wait = app.config["SCREENSHOT_LOCATE_WAIT"]
        self._screenshot_load_wait = app.config["SCREENSHOT_LOAD_WAIT"]

    @abstractmethod
    def get_screenshot(self, url: str, element_name: str, user: User) -> bytes | None:
        """
        Run webdriver and return a screenshot
        """


class WebDriverPlaywright(WebDriverProxy):
    @staticmethod
    def auth(user: User, context: BrowserContext) -> BrowserContext:
        return machine_auth_provider_factory.instance.authenticate_browser_context(
            context, user
        )

    @staticmethod
    def find_unexpected_errors(page: Page) -> list[str]:
        error_messages = []

        try:
            alert_divs = page.get_by_role("alert").all()

            logger.debug(
                "%i alert elements have been found in the screenshot", len(alert_divs)
            )

            for alert_div in alert_divs:
                # See More button
                alert_div.get_by_role("button").click()

                # wait for modal to show up
                page.locator(".ant-modal-content").wait_for(state="visible")
                err_msg_div = page.locator(".ant-modal-content .ant-modal-body")
                #
                # # collect error message
                error_messages.append(err_msg_div.text_content())
                #
                # # Use HTML so that error messages are shown in the same style (color)
                error_as_html = err_msg_div.inner_html().replace("'", "\\'")
                #
                # # close modal after collecting error messages
                page.locator(".ant-modal-content .ant-modal-close").click()
                #
                # # wait until the modal becomes invisible
                page.locator(".ant-modal-content").wait_for(state="detached")
                try:
                    # Even if some errors can't be updated in the screenshot,
                    # keep all the errors in the server log and do not fail the loop
                    alert_div.evaluate(
                        "(node, error_html) => node.innerHtml = error_html",
                        [error_as_html],
                    )
                except PlaywrightError:
                    logger.exception("Failed to update error messages using alert_div")
        except PlaywrightError:
            logger.exception("Failed to capture unexpected errors")

        return error_messages

    @staticmethod
    def _get_screenshot(page: Page, element: Locator, element_name: str) -> bytes:
        if element_name == "standalone":
            return page.screenshot(full_page=True)
        else:
            return element.screenshot()

    def get_screenshot(  # pylint: disable=too-many-locals, too-many-statements  # noqa: C901
        self, url: str, element_name: str, user: User
    ) -> bytes | None:
        with sync_playwright() as playwright:
            browser_args = app.config["WEBDRIVER_OPTION_ARGS"]
            browser = playwright.chromium.launch(args=browser_args)
            pixel_density = app.config["WEBDRIVER_WINDOW"].get("pixel_density", 1)
            viewport_height = self._window[1]
            viewport_width = self._window[0]
            context = browser.new_context(
                bypass_csp=True,
                viewport={
                    "height": viewport_height,
                    "width": viewport_width,
                },
                device_scale_factor=pixel_density,
            )
            context.set_default_timeout(
                app.config["SCREENSHOT_PLAYWRIGHT_DEFAULT_TIMEOUT"]
            )
            self.auth(user, context)
            page = context.new_page()
            try:
                page.goto(
                    url,
                    wait_until=app.config["SCREENSHOT_PLAYWRIGHT_WAIT_EVENT"],
                )
            except PlaywrightTimeout:
                logger.exception(
                    "Web event %s not detected. Page %s might not have been fully loaded",  # noqa: E501
                    app.config["SCREENSHOT_PLAYWRIGHT_WAIT_EVENT"],
                    url,
                )

            img: bytes | None = None
            selenium_headstart = app.config["SCREENSHOT_SELENIUM_HEADSTART"]
            logger.debug("Sleeping for %i seconds", selenium_headstart)
            page.wait_for_timeout(selenium_headstart * 1000)
            element: Locator
            try:
                try:
                    # page didn't load
                    logger.debug(
                        "Wait for the presence of %s at url: %s", element_name, url
                    )
                    element = page.locator(f".{element_name}")
                    element.wait_for()
                except PlaywrightTimeout:
                    logger.exception("Timed out requesting url %s", url)
                    raise

                try:
                    # chart containers didn't render
                    logger.debug("Wait for chart containers to draw at url: %s", url)
                    slice_container_locator = page.locator(".chart-container")
                    for slice_container_elem in slice_container_locator.all():
                        slice_container_elem.wait_for()
                except PlaywrightTimeout:
                    logger.exception(
                        "Timed out waiting for chart containers to draw at url %s",
                        url,
                    )
                    raise
                try:
                    # charts took too long to load
                    logger.debug(
                        "Wait for loading element of charts to be gone at url: %s", url
                    )
                    for loading_element in page.locator(".loading").all():
                        loading_element.wait_for(state="detached")
                except PlaywrightTimeout:
                    logger.exception(
                        "Timed out waiting for charts to load at url %s", url
                    )
                    raise

                selenium_animation_wait = app.config[
                    "SCREENSHOT_SELENIUM_ANIMATION_WAIT"
                ]
                logger.debug(
                    "Wait %i seconds for chart animation", selenium_animation_wait
                )
                page.wait_for_timeout(selenium_animation_wait * 1000)
                logger.debug(
                    "Taking a PNG screenshot of url %s as user %s",
                    url,
                    user.username,
                )
                if app.config["SCREENSHOT_REPLACE_UNEXPECTED_ERRORS"]:
                    unexpected_errors = WebDriverPlaywright.find_unexpected_errors(page)
                    if unexpected_errors:
                        logger.warning(
                            "%i errors found in the screenshot. URL: %s. Errors are: %s",  # noqa: E501
                            len(unexpected_errors),
                            url,
                            unexpected_errors,
                        )
                # Detect large dashboards and use tiled screenshots if enabled
                tiled_enabled = app.config.get("SCREENSHOT_TILED_ENABLED", False)

                if tiled_enabled:
                    chart_count = page.evaluate(
                        'document.querySelectorAll(".chart-container").length'
                    )
                    dashboard_height = page.evaluate(
                        f'document.querySelector(".{element_name}").scrollHeight || 0'
                    )
                    chart_threshold = app.config.get(
                        "SCREENSHOT_TILED_CHART_THRESHOLD", 20
                    )
                    height_threshold = app.config.get(
                        "SCREENSHOT_TILED_HEIGHT_THRESHOLD", 5000
                    )
                    tile_height = app.config.get(
                        "SCREENSHOT_TILED_VIEWPORT_HEIGHT", viewport_height
                    )

                    # Use tiled screenshots for large dashboards
                    use_tiled = (
                        chart_count >= chart_threshold
                        or dashboard_height > height_threshold
                    ) and dashboard_height > tile_height

                    if use_tiled:
                        logger.info(
                            (
                                f"Large dashboard detected: {chart_count} charts, "
                                f"{dashboard_height}px height. Using tiled screenshots."
                            )
                        )
                        # set viewport height to tile height for easier calculations
                        page.set_viewport_size(
                            {"height": tile_height, "width": viewport_width}
                        )
                        img = take_tiled_screenshot(page, element_name, tile_height)
                        if img is None:
                            logger.warning(
                                (
                                    "Tiled screenshot failed, "
                                    "falling back to standard screenshot"
                                )
                            )
                            img = WebDriverPlaywright._get_screenshot(
                                page, element, element_name
                            )
                    else:
                        img = WebDriverPlaywright._get_screenshot(
                            page, element, element_name
                        )
                else:
                    img = WebDriverPlaywright._get_screenshot(
                        page, element, element_name
                    )

            except PlaywrightTimeout:
                # raise again for the finally block, but handled above
                pass
            except PlaywrightError:
                logger.exception(
                    "Encountered an unexpected error when requesting url %s", url
                )
            return img


class WebDriverSelenium(WebDriverProxy):
    def create(self) -> WebDriver:
        pixel_density = app.config["WEBDRIVER_WINDOW"].get("pixel_density", 1)
        if self._driver_type == "firefox":
            driver_class: type[WebDriver] = firefox.webdriver.WebDriver
            service_class: type[Service] = firefox.service.Service
            options = firefox.options.Options()
            profile = FirefoxProfile()
            profile.set_preference("layout.css.devPixelsPerPx", str(pixel_density))
            options.profile = profile
            kwargs = {"options": options}
        elif self._driver_type == "chrome":
            driver_class = chrome.webdriver.WebDriver
            service_class = chrome.service.Service
            options = chrome.options.Options()
            options.add_argument(f"--force-device-scale-factor={pixel_density}")
            options.add_argument(f"--window-size={self._window[0]},{self._window[1]}")
            kwargs = {"options": options}
        else:
            raise Exception(  # pylint: disable=broad-exception-raised
                f"Webdriver name ({self._driver_type}) not supported"
            )

        # Prepare args for the webdriver init
        for arg in list(app.config["WEBDRIVER_OPTION_ARGS"]):
            options.add_argument(arg)

        # Add additional configured webdriver options
        webdriver_conf = dict(app.config["WEBDRIVER_CONFIGURATION"])

        # Set the binary location if provided
        # We need to pop it from the dict due to selenium_version < 4.10.0
        options.binary_location = webdriver_conf.pop("binary_location", "")

        if version.parse(selenium_version) < version.parse("4.10.0"):
            kwargs |= webdriver_conf
        else:
            driver_opts = dict(
                webdriver_conf.get("options", {"capabilities": {}, "preferences": {}})
            )
            driver_srv = dict(
                webdriver_conf.get(
                    "service",
                    {
                        "log_output": "/dev/null",
                        "service_args": [],
                        "port": 0,
                        "env": {},
                    },
                )
            )
            for name, value in driver_opts.get("capabilities", {}).items():
                options.set_capability(name, value)
            if hasattr(options, "profile"):
                for name, value in driver_opts.get("preferences", {}).items():
                    options.profile.set_preference(str(name), value)
            kwargs |= {
                "options": options,
                "service": service_class(**driver_srv),
            }

        logger.debug("Init selenium driver")
        return driver_class(**kwargs)

    def auth(self, user: User) -> WebDriver:
        driver = self.create()
        return machine_auth_provider_factory.instance.authenticate_webdriver(
            driver, user
        )

    @staticmethod
    def destroy(driver: WebDriver, tries: int = 2) -> None:
        """Destroy a driver"""
        # This is some very flaky code in selenium. Hence the retries
        # and catch-all exceptions
        try:
            retry_call(driver.close, max_tries=tries)
        except Exception:  # pylint: disable=broad-except  # noqa: S110
            pass
        try:
            driver.quit()
        except Exception:  # pylint: disable=broad-except  # noqa: S110
            pass

    @staticmethod
    def find_unexpected_errors(driver: WebDriver) -> list[str]:
        error_messages = []

        try:
            alert_divs = driver.find_elements(By.XPATH, "//div[@role = 'alert']")
            logger.debug(
                "%i alert elements have been found in the screenshot", len(alert_divs)
            )

            for alert_div in alert_divs:
                # See More button
                alert_div.find_element(By.XPATH, ".//*[@role = 'button']").click()

                # wait for modal to show up
                modal = WebDriverWait(
                    driver,
                    app.config["SCREENSHOT_WAIT_FOR_ERROR_MODAL_VISIBLE"],
                ).until(
                    EC.visibility_of_any_elements_located(
                        (By.CLASS_NAME, "ant-modal-content")
                    )
                )[0]

                err_msg_div = modal.find_element(By.CLASS_NAME, "ant-modal-body")

                # collect error message
                error_messages.append(err_msg_div.text)

                # close modal after collecting error messages
                modal.find_element(By.CLASS_NAME, "ant-modal-close").click()

                # wait until the modal becomes invisible
                WebDriverWait(
                    driver,
                    app.config["SCREENSHOT_WAIT_FOR_ERROR_MODAL_INVISIBLE"],
                ).until(EC.invisibility_of_element(modal))

                # Use HTML so that error messages are shown in the same style (color)
                error_as_html = err_msg_div.get_attribute("innerHTML").replace(
                    "'", "\\'"
                )

                try:
                    # Even if some errors can't be updated in the screenshot,
                    # keep all the errors in the server log and do not fail the loop
                    driver.execute_script(
                        f"arguments[0].innerHTML = '{error_as_html}'", alert_div
                    )
                except WebDriverException:
                    logger.exception("Failed to update error messages using alert_div")
        except WebDriverException:
            logger.exception("Failed to capture unexpected errors")

        return error_messages

    def get_screenshot(self, url: str, element_name: str, user: User) -> bytes | None:  # noqa: C901
        driver = self.auth(user)
        driver.set_window_size(*self._window)
        driver.get(url)
        img: bytes | None = None
        selenium_headstart = app.config["SCREENSHOT_SELENIUM_HEADSTART"]
        logger.debug("Sleeping for %i seconds", selenium_headstart)
        sleep(selenium_headstart)

        try:
            try:
                # page didn't load
                logger.debug(
                    "Wait for the presence of %s at url: %s", element_name, url
                )
                element = WebDriverWait(driver, self._screenshot_locate_wait).until(
                    EC.presence_of_element_located((By.CLASS_NAME, element_name))
                )
            except TimeoutException:
                logger.exception("Selenium timed out requesting url %s", url)
                raise

            try:
                # chart containers didn't render
                logger.debug("Wait for chart containers to draw at url: %s", url)
                WebDriverWait(driver, self._screenshot_locate_wait).until(
                    EC.visibility_of_all_elements_located(
                        (By.CLASS_NAME, "chart-container")
                    )
                )
            except TimeoutException:
                logger.info("Timeout Exception caught")
                # Fallback to allow a screenshot of an empty dashboard
                try:
                    WebDriverWait(driver, 0).until(
                        EC.visibility_of_all_elements_located(
                            (By.CLASS_NAME, "grid-container")
                        )
                    )
                except:
                    logger.exception(
                        "Selenium timed out waiting for dashboard to draw at url %s",
                        url,
                    )
                    raise

            try:
                # charts took too long to load
                logger.debug(
                    "Wait for loading element of charts to be gone at url: %s", url
                )
                WebDriverWait(driver, self._screenshot_load_wait).until_not(
                    EC.presence_of_all_elements_located((By.CLASS_NAME, "loading"))
                )
            except TimeoutException:
                logger.exception(
                    "Selenium timed out waiting for charts to load at url %s", url
                )
                raise

            selenium_animation_wait = app.config["SCREENSHOT_SELENIUM_ANIMATION_WAIT"]
            logger.debug("Wait %i seconds for chart animation", selenium_animation_wait)
            sleep(selenium_animation_wait)
            logger.debug(
                "Taking a PNG screenshot of url %s as user %s",
                url,
                user.username,
            )

            if app.config["SCREENSHOT_REPLACE_UNEXPECTED_ERRORS"]:
                unexpected_errors = WebDriverSelenium.find_unexpected_errors(driver)
                if unexpected_errors:
                    logger.warning(
                        "%i errors found in the screenshot. URL: %s. Errors are: %s",
                        len(unexpected_errors),
                        url,
                        unexpected_errors,
                    )

            img = element.screenshot_as_png
        except Exception as ex:
            logger.warning("exception in webdriver", exc_info=ex)
            raise
        except TimeoutException:
            # raise again for the finally block, but handled above
            raise
        except StaleElementReferenceException:
            logger.exception(
                "Selenium got a stale element while requesting url %s",
                url,
            )
            raise
        except WebDriverException:
            logger.exception(
                "Encountered an unexpected error when requesting url %s", url
            )
            raise
        finally:
            self.destroy(driver, app.config["SCREENSHOT_SELENIUM_RETRIES"])
        return img
