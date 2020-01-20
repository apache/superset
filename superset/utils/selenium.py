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
from typing import Optional, Tuple, TYPE_CHECKING

from flask import current_app, request, Response, session, url_for
from flask_login import login_user
from retry.api import retry_call
from selenium.common.exceptions import TimeoutException, WebDriverException
from selenium.webdriver import chrome, firefox
from selenium.webdriver.common.by import By
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.support.ui import WebDriverWait
from werkzeug.http import parse_cookie
from PIL import Image

if TYPE_CHECKING:
    # pylint: disable=unused-import
    from flask_appbuilder.security.sqla.models import User
    from flask_caching import Cache


# Time in seconds, we will wait for the page to load and render
SELENIUM_CHECK_INTERVAL = 2
SELENIUM_RETRIES = 5
SELENIUM_HEADSTART = 3


def headless_url(path: str):
    return urllib.parse.urljoin(current_app.config.get("WEBDRIVER_BASEURL", ""), path)


def get_url_path(view: str, **kwargs):
    with current_app.test_request_context():
        return headless_url(url_for(view, **kwargs))


class BaseScreenshot:
    thumbnail_type: Optional[str] = None
    element: Optional[str] = None
    window_size: Tuple[int, int] = (800, 600)
    thumb_size: Tuple[int, int] = (400, 300)

    def __init__(self, model_id: int):
        self.model_id: int = model_id
        self.screenshot: Optional[bytes] = None

    @property
    def cache_key(self):
        return f"thumb__{self.thumbnail_type}__{self.model_id}"

    @property
    def url(self):
        raise NotImplementedError()

    def fetch_screenshot(self, user: "User", window_size: Tuple[int, int] = None):
        window_size = window_size or self.window_size
        self.screenshot = get_png_from_url(
            self.url, window_size, self.element, user=user
        )
        return self.screenshot

    def get_thumb_as_bytes(self, *args, **kwargs) -> Optional[BytesIO]:
        payload = self.get_thumb(*args, **kwargs)
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
        cache: "Cache" = None,
        window_size: Tuple[int, int] = None,
        thumb_size: Tuple[int, int] = None,
        force: bool = True,
    ) -> Optional[bytes]:
        """
        Fetches the screenshot, computes the thumbnail and caches the result

        :param user: If no user is given will use the current context
        :param cache: The cache to keep the thumbnail payload
        :param window_size: The window size from which will process the thumb
        :param thumb_size: The final thumbnail size
        :param force: Will for the computation even if it's already cached
        :return: Image payload
        """
        cache_key = self.cache_key
        if not force and cache and cache.get(cache_key):
            logging.info("Thumb already cached, skipping...")
            return None
        window_size = window_size or self.window_size
        thumb_size = thumb_size or self.thumb_size
        logging.info(f"Processing url for thumbnail: {cache_key}")

        payload = None

        # Assuming all sorts of things can go wrong with Selenium
        try:
            payload = self.fetch_screenshot(window_size=window_size, user=user)
        except Exception as e:  # pylint: disable=broad-except
            logging.error("Failed at generating thumbnail")
            logging.exception(e)

        if payload and window_size != thumb_size:
            try:
                payload = self.resize_image(payload, size=thumb_size)
            except Exception as e:  # pylint: disable=broad-except
                logging.error("Failed at resizing thumbnail")
                logging.exception(e)
                payload = None

        if payload and cache:
            logging.info(f"Caching thumbnail: {cache_key}")
            cache.set(cache_key, payload)
        return payload

    def get_thumb(
        self,
        user: "User" = None,
        window_size: Tuple[int, int] = None,
        thumb_size: Tuple[int, int] = None,
        cache: "Cache" = None,
    ) -> Optional[bytes]:
        payload = None
        cache_key = self.cache_key
        window_size = window_size or self.window_size
        thumb_size = thumb_size or self.thumb_size
        if cache:
            payload = cache.get(cache_key)
        if not payload:
            payload = self.compute_and_cache(user, cache, window_size, thumb_size)
        else:
            logging.info(f"Loaded thumbnail from cache: {cache_key}")
        return payload

    @classmethod
    def resize_image(
        cls,
        img_bytes: bytes,
        output: str = "png",
        size: Tuple[int, int] = None,
        crop: bool = True,
    ) -> bytes:
        size = size or cls.thumb_size
        img = Image.open(BytesIO(img_bytes))
        logging.debug(f"Selenium image size: {img.size}")
        if crop and img.size[1] != cls.window_size[1]:
            desired_ratio = float(cls.window_size[1]) / cls.window_size[0]
            desired_width = int(img.size[0] * desired_ratio)
            logging.debug(f"Cropping to: {img.size[0]}*{desired_width}")
            img = img.crop((0, 0, img.size[0], desired_width))
        logging.debug(f"Resizing to {size}")
        img = img.resize(size, Image.ANTIALIAS)
        new_img = BytesIO()
        if output != "png":
            img = img.convert("RGB")
        img.save(new_img, output)
        new_img.seek(0)
        return new_img.read()


class SliceScreenshot(BaseScreenshot):
    thumbnail_type: Optional[str] = "slice"
    element: Optional[str] = "chart-container"
    window_size: Tuple[int, int] = (600, int(600 * 0.75))
    thumb_size: Tuple[int, int] = (300, int(300 * 0.75))

    @property
    def url(self) -> str:
        return get_url_path("Superset.slice", slice_id=self.model_id, standalone="true")


class DashboardScreenshot(BaseScreenshot):
    thumbnail_type: Optional[str] = "dashboard"
    element: Optional[str] = "grid-container"
    window_size: Tuple[int, int] = (1600, int(1600 * 0.75))
    thumb_size: Tuple[int, int] = (400, int(400 * 0.75))

    @property
    def url(self) -> str:
        return get_url_path("Superset.dashboard", dashboard_id=self.model_id)


def _destroy_webdriver(driver):
    """Destroy a driver"""
    # This is some very flaky code in selenium. Hence the retries
    # and catch-all exceptions
    try:
        retry_call(driver.close, tries=2)
    except Exception:  # pylint: disable=broad-except
        pass
    try:
        driver.quit()
    except Exception:  # pylint: disable=broad-except
        pass


def get_auth_cookies(user: "User"):
    # Login with the user specified to get the reports
    with current_app.test_request_context():
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


def create_webdriver(
    user: "User" = None, webdriver: str = "chrome", window: Tuple[int, int] = None
):
    """Creates a selenium webdriver

    If no user is specified, we use the current request's context"""
    # Create a webdriver for use in fetching reports
    window = window or (800, 600)
    if webdriver == "firefox":
        driver_class = firefox.webdriver.WebDriver
        options = firefox.options.Options()
    else:
        # webdriver == 'chrome':
        driver_class = chrome.webdriver.WebDriver
        options = chrome.options.Options()
        arg = f"--window-size={window[0]},{window[1]}"
        options.add_argument(arg)

    options.add_argument("--headless")

    # Prepare args for the webdriver init
    kwargs = dict(options=options)
    kwargs.update(current_app.config["WEBDRIVER_CONFIGURATION"])

    logging.info("Init selenium driver")
    driver = driver_class(**kwargs)

    # Setting cookies requires doing a request first
    driver.get(headless_url("/login/"))

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


def get_png_from_url(  # pylint: disable=too-many-arguments
    url: str,
    window: Tuple[int, int],
    element_name: Optional[str],
    user: "User",
    webdriver: str = "chrome",
    retries: int = SELENIUM_RETRIES,
):
    driver = create_webdriver(user, webdriver, window)
    driver.set_window_size(*window)
    driver.get(url)
    img = None
    logging.debug(f"Sleeping for {SELENIUM_HEADSTART} seconds")
    time.sleep(SELENIUM_HEADSTART)
    retry_count = 0
    while retry_count <= retries:
        try:
            logging.debug(f"Wait for the presence of {element_name}")
            element = WebDriverWait(driver, 10).until(
                EC.presence_of_element_located((By.CLASS_NAME, element_name))
            )
            logging.debug(f"Wait for .loading to be done")
            WebDriverWait(driver, 60).until_not(
                EC.presence_of_all_elements_located((By.CLASS_NAME, "loading"))
            )
            logging.info("Taking a PNG screenshot")
            img = element.screenshot_as_png
            break
        except TimeoutException:
            logging.error("Selenium timed out")
            retry_count += 1
        except WebDriverException as e:
            logging.exception(e)
            # Some webdrivers do not support screenshots for elements.
            # In such cases, take a screenshot of the entire page.
            img = driver.screenshot()  # pylint: disable=no-member
            break
        finally:
            _destroy_webdriver(driver)
    return img
