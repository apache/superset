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
from typing import Any, TYPE_CHECKING, Dict
from urllib.parse import urlparse

from flask import current_app, request, Response, session
from flask_login import login_user
from werkzeug.http import parse_cookie

from superset import feature_flag_manager
from superset.extensions import machine_auth_provider_factory
from superset.utils.retries import retry_call
from superset.utils.urls import headless_url

WindowSize = tuple[int, int]
logger = logging.getLogger(__name__)

if TYPE_CHECKING:
    from flask_appbuilder.security.sqla.models import User

from playwright.sync_api import (
    BrowserContext,
    ElementHandle,
    Error as PlaywrightError,
    Page,
    sync_playwright,
    TimeoutError as PlaywrightTimeout,
)


class DashboardStandaloneMode(Enum):
    HIDE_NAV = 1
    HIDE_NAV_AND_TITLE = 2
    REPORT = 2


class ChartStandaloneMode(Enum):
    HIDE_NAV = "true"
    SHOW_NAV = 0


class WebDriverProxy(ABC):
    def __init__(self, driver_type: str, window: WindowSize | None = None):
        self._driver_type = driver_type
        self._window: WindowSize = window or (800, 600)
        self._screenshot_locate_wait = current_app.config["SCREENSHOT_LOCATE_WAIT"]
        self._screenshot_load_wait = current_app.config["SCREENSHOT_LOAD_WAIT"]

    def auth(self, user: User, browser_context: BrowserContext) -> BrowserContext:
        url = urlparse(current_app.config["WEBDRIVER_BASEURL"])

        # Setting cookies requires doing a request first
        page = browser_context.new_page()
        page.goto(headless_url("/login/"))

        cookies = self.get_auth_cookies(user)

        browser_context.clear_cookies()
        browser_context.add_cookies(
            [
                {
                    "name": cookie_name,
                    "value": cookie_val,
                    "domain": url.netloc,
                    "path": "/",
                    "sameSite": "Lax",
                    "httpOnly": True,
                }
                for cookie_name, cookie_val in cookies.items()
            ]
        )
        return browser_context


    @staticmethod
    def get_auth_cookies(user: User) -> Dict[str, str]:
        # Login with the user specified to get the reports
        with current_app.test_request_context("/login"):
            login_user(user)
            # A mock response object to get the cookie information from
            response = Response()
            current_app.session_interface.save_session(current_app, session, response)

        cookies = {}

        # Grab any "set-cookie" headers from the login response
        for name, value in response.headers:
            if name.lower() == "set-cookie":
                # This yields a MultiDict, which is ordered -- something like
                # MultiDict([('session', 'value-we-want), ('HttpOnly', ''), etc...
                # Therefore, we just need to grab the first tuple and add it to our
                # final dict
                cookie = parse_cookie(value)
                cookie_tuple = list(cookie.items())[0]
                cookies[cookie_tuple[0]] = cookie_tuple[1]

        return cookies
    
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
                page.wait_for_selector(
                    ".ant-modal-content",
                    timeout=current_app.config[
                        "SCREENSHOT_WAIT_FOR_ERROR_MODAL_VISIBLE"
                    ]
                    * 1000,
                    state="visible",
                )
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
                page.wait_for_selector(
                    ".ant-modal-content",
                    timeout=current_app.config[
                        "SCREENSHOT_WAIT_FOR_ERROR_MODAL_INVISIBLE"
                    ]
                    * 1000,
                    state="detached",
                )
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

    def get_screenshot(self, url: str, element_name: str, user: User) -> bytes | None:
        with sync_playwright() as playwright:
            browser = playwright.chromium.launch()
            pixel_density = current_app.config["WEBDRIVER_WINDOW"].get(
                "pixel_density", 1
            )
            context = browser.new_context(
                bypass_csp=True,
                viewport={
                    "height": self._window[1],
                    "width": self._window[0],
                },
                device_scale_factor=pixel_density,
            )
            context = self.auth(user, context)
            page = context.new_page()
            page.goto(
                url, wait_until='load'
            )
            img: bytes | None = None
            selenium_headstart = current_app.config["SCREENSHOT_SELENIUM_HEADSTART"]
            logger.debug("Sleeping for %i seconds", selenium_headstart)
            page.wait_for_timeout(selenium_headstart * 1000)
            element: ElementHandle
            try:
                try:
                    logger.debug(
                        "Wait for the presence of %s at url: %s", element_name, url
                    )
                    # override the dashboard selector, otherwise use the element name as a class selecto
                    if element_name == "standalone":
                        element = page.wait_for_selector(f"#GRID_ID", timeout=self._screenshot_locate_wait * 1000)
                    else:
                        element = page.wait_for_selector(f".{element_name}", timeout=self._screenshot_locate_wait * 1000)
                except PlaywrightTimeout as ex:
                    # page didn't load
                    logger.exception("Timed out requesting url %s", url)
                    raise ex

                try:
                    # chart containers didn't render
                    logger.debug("Wait for chart containers to draw at url: %s", url)
                    page.wait_for_selector(
                        ".slice_container", timeout=self._screenshot_locate_wait * 1000
                    )
                except PlaywrightTimeout as ex:
                    logger.exception(
                        "Timed out waiting for chart containers to draw at url %s",
                        url,
                    )
                    raise ex
                try:
                    # charts took too long to load
                    logger.debug(
                        "Wait for loading element of charts to be gone at url: %s", url
                    )
                    page.wait_for_selector(
                        ".loading",
                        timeout=self._screenshot_load_wait * 1000,
                        state="detached",
                    )
                except PlaywrightTimeout as ex:
                    logger.exception(
                        "Timed out waiting for charts to load at url %s", url
                    )
                    # Raise if you want the dashboards to fail if a chart takes too long to load
                    # raise ex

                selenium_animation_wait = current_app.config[
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
                if current_app.config["SCREENSHOT_REPLACE_UNEXPECTED_ERRORS"]:
                    unexpected_errors = WebDriverProxy.find_unexpected_errors(page)
                    if unexpected_errors:
                        logger.warning(
                            "%i errors found in the screenshot. URL: %s. Errors are: %s",
                            len(unexpected_errors),
                            url,
                            unexpected_errors,
                        )
                img = element.screenshot()
            except PlaywrightTimeout:
                # raise again for the finally block, but handled above
                pass
            except PlaywrightError:
                logger.exception(
                    "Encountered an unexpected error when requesting url %s", url
                )
            return img