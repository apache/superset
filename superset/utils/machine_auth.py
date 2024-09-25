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
from typing import Any, Callable, TYPE_CHECKING
from urllib.parse import urlparse

from flask import current_app, Flask, request, Response, session
from flask_login import login_user
from selenium.webdriver.remote.webdriver import WebDriver
from werkzeug.http import parse_cookie

from superset.utils.class_utils import load_class_from_name
from superset.utils.urls import headless_url

logger = logging.getLogger(__name__)

if TYPE_CHECKING:
    from flask_appbuilder.security.sqla.models import User

    try:
        from playwright.sync_api import BrowserContext
    except ModuleNotFoundError:
        BrowserContext = Any


class MachineAuthProvider:
    def __init__(
        self,
        auth_webdriver_func_override: Callable[
            [WebDriver | BrowserContext, User], WebDriver | BrowserContext
        ]
        | None = None,
    ):
        # This is here in order to allow for the authenticate_webdriver
        # or authenticate_browser_context (if PLAYWRIGHT_REPORTS_AND_THUMBNAILS is
        # enabled) func to be overridden via config, as opposed to the entire
        # provider implementation
        self._auth_webdriver_func_override = auth_webdriver_func_override

    def authenticate_webdriver(
        self,
        driver: WebDriver,
        user: User,
    ) -> WebDriver:
        """
        Default AuthDriverFuncType type that sets a session cookie flask-login style
        :return: The WebDriver passed in (fluent)
        """
        # Short-circuit this method if we have an override configured
        if self._auth_webdriver_func_override:
            return self._auth_webdriver_func_override(driver, user)

        # Setting cookies requires doing a request first
        driver.get(headless_url("/login/"))

        cookies = self.get_cookies(user)

        for cookie_name, cookie_val in cookies.items():
            driver.add_cookie({"name": cookie_name, "value": cookie_val})

        return driver

    def authenticate_browser_context(
        self,
        browser_context: BrowserContext,
        user: User,
    ) -> BrowserContext:
        # Short-circuit this method if we have an override configured
        if self._auth_webdriver_func_override:
            return self._auth_webdriver_func_override(browser_context, user)

        url = urlparse(current_app.config["WEBDRIVER_BASEURL"])

        # Setting cookies requires doing a request first
        page = browser_context.new_page()
        page.goto(headless_url("/login/"))

        cookies = self.get_cookies(user)

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

    def get_cookies(self, user: User | None) -> dict[str, str]:
        if user:
            cookies = self.get_auth_cookies(user)
        elif request.cookies:
            cookies = request.cookies
        else:
            cookies = {}
        return cookies

    @staticmethod
    def get_auth_cookies(user: User) -> dict[str, str]:
        # Login with the user specified to get the reports
        with current_app.test_request_context("/login"):
            login_user(user)
            # A mock response object to get the cookie information from
            response = Response()
            # To ensure all `after_request` functions are called i.e Websockets JWT Auth
            current_app.process_response(response)
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


class MachineAuthProviderFactory:
    def __init__(self) -> None:
        self._auth_provider: MachineAuthProvider | None = None

    def init_app(self, app: Flask) -> None:
        self._auth_provider = load_class_from_name(
            app.config["MACHINE_AUTH_PROVIDER_CLASS"]
        )(app.config["WEBDRIVER_AUTH_FUNC"])

    @property
    def instance(self) -> MachineAuthProvider:
        return self._auth_provider  # type: ignore
