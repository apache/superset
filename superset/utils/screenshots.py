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
import urllib.parse
from io import BytesIO
from typing import Any, Callable, Dict, List, Optional, Tuple, TYPE_CHECKING

from flask import current_app, request, Response, session, url_for
from flask_login import login_user
from retry.api import retry_call
from selenium.common.exceptions import TimeoutException, WebDriverException
from selenium.webdriver import chrome, firefox
from selenium.webdriver.common.by import By
from selenium.webdriver.remote.webdriver import WebDriver
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.support.ui import WebDriverWait
from werkzeug.http import parse_cookie

logger = logging.getLogger(__name__)

try:
    from PIL import Image  # pylint: disable=import-error
except ModuleNotFoundError:
    logger.info("No PIL installation found")

if TYPE_CHECKING:
    # pylint: disable=unused-import
    from flask_appbuilder.security.sqla.models import User
    from flask_caching import Cache

# Time in seconds, we will wait for the page to load and render
SELENIUM_CHECK_INTERVAL = 2
SELENIUM_RETRIES = 5
SELENIUM_HEADSTART = 3

WindowSize = Tuple[int, int]


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


def auth_driver(driver: WebDriver, user: "User") -> WebDriver:
    """
        Default AuthDriverFuncType type that sets a session cookie flask-login style
    :return: WebDriver
    """
    if user:
        # Set the cookies in the driver
        for cookie in get_auth_cookies(user):
            info = dict(name="session", value=cookie)
            driver.add_cookie(info)
    elif request.cookies:
        cookies = request.cookies
        for k, v in cookies.items():
            cookie = dict(name=k, value=v)
            driver.add_cookie(cookie)
    return driver


def headless_url(path: str) -> str:
    return urllib.parse.urljoin(current_app.config.get("WEBDRIVER_BASEURL", ""), path)


def get_url_path(view: str, **kwargs: Any) -> str:
    with current_app.test_request_context():
        return headless_url(url_for(view, **kwargs))


class AuthWebDriverProxy:
    def __init__(
        self,
        driver_type: str,
        window: Optional[WindowSize] = None,
        auth_func: Optional[
            Callable[..., Any]
        ] = None,  # pylint: disable=bad-whitespace
    ):
        self._driver_type = driver_type
        self._window: WindowSize = window or (800, 600)
        config_auth_func = current_app.config.get("WEBDRIVER_AUTH_FUNC", auth_driver)
        self._auth_func = auth_func or config_auth_func

    def create(self) -> WebDriver:
        if self._driver_type == "firefox":
            driver_class = firefox.webdriver.WebDriver
            options = firefox.options.Options()
        elif self._driver_type == "chrome":
            driver_class = chrome.webdriver.WebDriver
            options = chrome.options.Options()
            arg: str = f"--window-size={self._window[0]},{self._window[1]}"
            options.add_argument(arg)
        else:
            raise Exception(f"Webdriver name ({self._driver_type}) not supported")
        # Prepare args for the webdriver init
        options.add_argument("--headless")
        kwargs: Dict[Any, Any] = dict(options=options)
        kwargs.update(current_app.config["WEBDRIVER_CONFIGURATION"])
        logger.info("Init selenium driver")
        return driver_class(**kwargs)

    def auth(self, user: "User") -> WebDriver:
        # Setting cookies requires doing a request first
        driver = self.create()
        driver.get(headless_url("/login/"))
        return self._auth_func(driver, user)

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
        self, url: str, element_name: str, user: "User", retries: int = SELENIUM_RETRIES
    ) -> Optional[bytes]:
        driver = self.auth(user)
        driver.set_window_size(*self._window)
        driver.get(url)
        img: Optional[bytes] = None
        logger.debug(f"Sleeping for {SELENIUM_HEADSTART} seconds")
        time.sleep(SELENIUM_HEADSTART)
        try:
            logger.debug(f"Wait for the presence of {element_name}")
            element = WebDriverWait(driver, 10).until(
                EC.presence_of_element_located((By.CLASS_NAME, element_name))
            )
            logger.debug(f"Wait for .loading to be done")
            WebDriverWait(driver, 60).until_not(
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


class BaseScreenshot:
    driver_type = "chrome"
    thumbnail_type: str = ""
    element: str = ""
    window_size: WindowSize = (800, 600)
    thumb_size: WindowSize = (400, 300)

    def __init__(self, model_id: int):
        self.model_id: int = model_id
        self.screenshot: Optional[bytes] = None
        self._driver = AuthWebDriverProxy(self.driver_type, self.window_size)

    @property
    def cache_key(self) -> str:
        return f"thumb__{self.thumbnail_type}__{self.model_id}"

    @property
    def url(self) -> str:
        raise NotImplementedError()

    def get_screenshot(self, user: "User") -> Optional[bytes]:
        self.screenshot = self._driver.get_screenshot(self.url, self.element, user)
        return self.screenshot

    def get(
        self,
        user: "User" = None,
        cache: "Cache" = None,
        thumb_size: Optional[WindowSize] = None,
    ) -> Optional[BytesIO]:
        """
            Get thumbnail screenshot has BytesIO from cache or fetch

        :param user: None to use current user or User Model to login and fetch
        :param cache: The cache to use
        :param thumb_size: Override thumbnail site
        """
        payload: Optional[bytes] = None
        thumb_size = thumb_size or self.thumb_size
        if cache:
            payload = cache.get(self.cache_key)
        if not payload:
            payload = self.compute_and_cache(
                user=user, thumb_size=thumb_size, cache=cache
            )
        else:
            logger.info(f"Loaded thumbnail from cache: {self.cache_key}")
        if payload:
            return BytesIO(payload)
        return None

    def get_from_cache(self, cache: "Cache") -> Optional[BytesIO]:
        payload = cache.get(self.cache_key)
        if payload:
            return BytesIO(payload)
        return None

    def compute_and_cache(  # pylint: disable=too-many-arguments
        self,
        user: "User" = None,
        thumb_size: Optional[WindowSize] = None,
        cache: "Cache" = None,
        force: bool = True,
    ) -> Optional[bytes]:
        """
        Fetches the screenshot, computes the thumbnail and caches the result

        :param user: If no user is given will use the current context
        :param cache: The cache to keep the thumbnail payload
        :param window_size: The window size from which will process the thumb
        :param thumb_size: The final thumbnail size
        :param force: Will force the computation even if it's already cached
        :return: Image payload
        """
        cache_key = self.cache_key
        if not force and cache and cache.get(cache_key):
            logger.info("Thumb already cached, skipping...")
            return None
        thumb_size = thumb_size or self.thumb_size
        logger.info(f"Processing url for thumbnail: {cache_key}")

        payload = None

        # Assuming all sorts of things can go wrong with Selenium
        try:
            payload = self.get_screenshot(user=user)
        except Exception as ex:  # pylint: disable=broad-except
            logger.error("Failed at generating thumbnail %s", ex)

        if payload and self.window_size != thumb_size:
            try:
                payload = self.resize_image(payload, thumb_size=thumb_size)
            except Exception as ex:  # pylint: disable=broad-except
                logger.error("Failed at resizing thumbnail %s", ex)
                payload = None

        if payload and cache:
            logger.info(f"Caching thumbnail: {cache_key} {cache}")
            cache.set(cache_key, payload)
        return payload

    @classmethod
    def resize_image(
        cls,
        img_bytes: bytes,
        output: str = "png",
        thumb_size: Optional[WindowSize] = None,
        crop: bool = True,
    ) -> bytes:
        thumb_size = thumb_size or cls.thumb_size
        img = Image.open(BytesIO(img_bytes))
        logger.debug(f"Selenium image size: {img.size}")
        if crop and img.size[1] != cls.window_size[1]:
            desired_ratio = float(cls.window_size[1]) / cls.window_size[0]
            desired_width = int(img.size[0] * desired_ratio)
            logger.debug(f"Cropping to: {img.size[0]}*{desired_width}")
            img = img.crop((0, 0, img.size[0], desired_width))
        logger.debug(f"Resizing to {thumb_size}")
        img = img.resize(thumb_size, Image.ANTIALIAS)
        new_img = BytesIO()
        if output != "png":
            img = img.convert("RGB")
        img.save(new_img, output)
        new_img.seek(0)
        return new_img.read()


class ChartScreenshot(BaseScreenshot):
    thumbnail_type: str = "chart"
    element: str = "chart-container"
    window_size: WindowSize = (600, int(600 * 0.75))
    thumb_size: WindowSize = (300, int(300 * 0.75))

    @property
    def url(self) -> str:
        return get_url_path("Superset.slice", slice_id=self.model_id, standalone="true")


class DashboardScreenshot(BaseScreenshot):
    thumbnail_type: str = "dashboard"
    element: str = "grid-container"
    window_size: WindowSize = (1600, int(1600 * 0.75))
    thumb_size: WindowSize = (400, int(400 * 0.75))

    @property
    def url(self) -> str:
        return get_url_path("Superset.dashboard", dashboard_id=self.model_id)
