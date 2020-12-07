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
from io import BytesIO
from typing import Optional, TYPE_CHECKING, Union

from flask import current_app

from superset.utils.hashing import md5_sha_from_dict
from superset.utils.webdriver import WebDriverProxy, WindowSize

logger = logging.getLogger(__name__)

try:
    from PIL import Image
except ModuleNotFoundError:
    logger.info("No PIL installation found")

if TYPE_CHECKING:
    from flask_appbuilder.security.sqla.models import User
    from flask_caching import Cache


class BaseScreenshot:
    driver_type = current_app.config["WEBDRIVER_TYPE"]
    thumbnail_type: str = ""
    element: str = ""
    window_size: WindowSize = (800, 600)
    thumb_size: WindowSize = (400, 300)

    def __init__(self, url: str, digest: str):
        self.digest: str = digest
        self.url = url
        self.screenshot: Optional[bytes] = None

    def driver(self, window_size: Optional[WindowSize] = None) -> WebDriverProxy:
        window_size = window_size or self.window_size
        return WebDriverProxy(self.driver_type, window_size)

    def cache_key(
        self,
        window_size: Optional[Union[bool, WindowSize]] = None,
        thumb_size: Optional[Union[bool, WindowSize]] = None,
    ) -> str:
        window_size = window_size or self.window_size
        thumb_size = thumb_size or self.thumb_size
        args = {
            "thumbnail_type": self.thumbnail_type,
            "digest": self.digest,
            "type": "thumb",
            "window_size": window_size,
            "thumb_size": thumb_size,
        }
        return md5_sha_from_dict(args)

    def get_screenshot(
        self, user: "User", window_size: Optional[WindowSize] = None
    ) -> Optional[bytes]:
        driver = self.driver(window_size)
        self.screenshot = driver.get_screenshot(self.url, self.element, user)
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
        cache_key = self.cache_key(self.window_size, thumb_size)
        if cache:
            payload = cache.get(cache_key)
        if not payload:
            payload = self.compute_and_cache(
                user=user, thumb_size=thumb_size, cache=cache
            )
        else:
            logger.info("Loaded thumbnail from cache: %s", cache_key)
        if payload:
            return BytesIO(payload)
        return None

    def get_from_cache(
        self,
        cache: "Cache",
        window_size: Optional[WindowSize] = None,
        thumb_size: Optional[WindowSize] = None,
    ) -> Optional[BytesIO]:
        cache_key = self.cache_key(window_size, thumb_size)
        return self.get_from_cache_key(cache, cache_key)

    @staticmethod
    def get_from_cache_key(cache: "Cache", cache_key: str) -> Optional[BytesIO]:
        logger.info("Attempting to get from cache: %s", cache_key)
        payload = cache.get(cache_key)
        if payload:
            return BytesIO(payload)
        logger.info("Failed at getting from cache: %s", cache_key)
        return None

    def compute_and_cache(  # pylint: disable=too-many-arguments
        self,
        user: "User" = None,
        window_size: Optional[WindowSize] = None,
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
        cache_key = self.cache_key(window_size, thumb_size)
        window_size = window_size or self.window_size
        thumb_size = thumb_size or self.thumb_size
        if not force and cache and cache.get(cache_key):
            logger.info("Thumb already cached, skipping...")
            return None
        logger.info("Processing url for thumbnail: %s", cache_key)

        payload = None

        # Assuming all sorts of things can go wrong with Selenium
        try:
            payload = self.get_screenshot(user=user, window_size=window_size)
        except Exception as ex:  # pylint: disable=broad-except
            logger.error("Failed at generating thumbnail %s", ex)

        if payload and window_size != thumb_size:
            try:
                payload = self.resize_image(payload, thumb_size=thumb_size)
            except Exception as ex:  # pylint: disable=broad-except
                logger.error("Failed at resizing thumbnail %s", ex)
                payload = None

        if payload:
            logger.info("Caching thumbnail: %s", cache_key)
            cache.set(cache_key, payload)
            logger.info("Done caching thumbnail")
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
        logger.debug("Selenium image size: %s", str(img.size))
        if crop and img.size[1] != cls.window_size[1]:
            desired_ratio = float(cls.window_size[1]) / cls.window_size[0]
            desired_width = int(img.size[0] * desired_ratio)
            logger.debug("Cropping to: %s*%s", str(img.size[0]), str(desired_width))
            img = img.crop((0, 0, img.size[0], desired_width))
        logger.debug("Resizing to %s", str(thumb_size))
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
    window_size: WindowSize = (800, 600)
    thumb_size: WindowSize = (800, 600)


class DashboardScreenshot(BaseScreenshot):
    thumbnail_type: str = "dashboard"
    element: str = "grid-container"
    window_size: WindowSize = (1600, int(1600 * 0.75))
    thumb_size: WindowSize = (800, int(800 * 0.75))
