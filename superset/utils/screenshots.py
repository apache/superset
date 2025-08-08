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

import base64
import logging
from datetime import datetime
from enum import Enum
from io import BytesIO
from typing import cast, TYPE_CHECKING, TypedDict

from flask import current_app as app

from superset import feature_flag_manager, thumbnail_cache
from superset.extensions import event_logger
from superset.utils.hashing import md5_sha_from_dict
from superset.utils.urls import modify_url_query
from superset.utils.webdriver import (
    ChartStandaloneMode,
    DashboardStandaloneMode,
    WebDriver,
    WebDriverPlaywright,
    WebDriverSelenium,
    WindowSize,
)

logger = logging.getLogger(__name__)

DEFAULT_SCREENSHOT_WINDOW_SIZE = 800, 600
DEFAULT_SCREENSHOT_THUMBNAIL_SIZE = 400, 300
DEFAULT_CHART_WINDOW_SIZE = DEFAULT_CHART_THUMBNAIL_SIZE = 800, 600
DEFAULT_DASHBOARD_WINDOW_SIZE = 1600, 1200
DEFAULT_DASHBOARD_THUMBNAIL_SIZE = 800, 600

try:
    from PIL import Image
except ModuleNotFoundError:
    logger.info("No PIL installation found")

if TYPE_CHECKING:
    from flask_appbuilder.security.sqla.models import User
    from flask_caching import Cache


class StatusValues(Enum):
    PENDING = "Pending"
    COMPUTING = "Computing"
    UPDATED = "Updated"
    ERROR = "Error"


class ScreenshotCachePayloadType(TypedDict):
    image: str | None
    timestamp: str
    status: str


class ScreenshotCachePayload:
    def __init__(
        self,
        image: bytes | None = None,
        status: StatusValues = StatusValues.PENDING,
        timestamp: str = "",
    ):
        self._image = image
        self._timestamp = timestamp or datetime.now().isoformat()
        self.status = StatusValues.UPDATED if image else status

    @classmethod
    def from_dict(cls, payload: ScreenshotCachePayloadType) -> ScreenshotCachePayload:
        return cls(
            image=base64.b64decode(payload["image"]) if payload["image"] else None,
            status=StatusValues(payload["status"]),
            timestamp=payload["timestamp"],
        )

    def to_dict(self) -> ScreenshotCachePayloadType:
        return {
            "image": base64.b64encode(self._image).decode("utf-8")
            if self._image
            else None,
            "timestamp": self._timestamp,
            "status": self.status.value,
        }

    def update_timestamp(self) -> None:
        self._timestamp = datetime.now().isoformat()

    def pending(self) -> None:
        self.update_timestamp()
        self._image = None
        self.status = StatusValues.PENDING

    def computing(self) -> None:
        self.update_timestamp()
        self._image = None
        self.status = StatusValues.COMPUTING

    def update(self, image: bytes) -> None:
        self.update_timestamp()
        self.status = StatusValues.UPDATED
        self._image = image

    def error(
        self,
    ) -> None:
        self.update_timestamp()
        self.status = StatusValues.ERROR

    def get_image(self) -> BytesIO | None:
        if not self._image:
            return None
        return BytesIO(self._image)

    def get_timestamp(self) -> str:
        return self._timestamp

    def get_status(self) -> str:
        return self.status.value

    def is_error_cache_ttl_expired(self) -> bool:
        error_cache_ttl = app.config["THUMBNAIL_ERROR_CACHE_TTL"]
        return (
            datetime.now() - datetime.fromisoformat(self.get_timestamp())
        ).total_seconds() > error_cache_ttl

    def should_trigger_task(self, force: bool = False) -> bool:
        return (
            force
            or self.status == StatusValues.PENDING
            or (self.status == StatusValues.ERROR and self.is_error_cache_ttl_expired())
        )


class BaseScreenshot:
    @property
    def driver_type(self) -> str:
        return app.config["WEBDRIVER_TYPE"]

    url: str
    digest: str | None
    screenshot: bytes | None
    thumbnail_type: str = ""
    element: str = ""
    window_size: WindowSize = DEFAULT_SCREENSHOT_WINDOW_SIZE
    thumb_size: WindowSize = DEFAULT_SCREENSHOT_THUMBNAIL_SIZE
    cache: Cache = thumbnail_cache

    def __init__(self, url: str, digest: str | None):
        self.digest = digest
        self.url = url
        self.screenshot = None

    def driver(self, window_size: WindowSize | None = None) -> WebDriver:
        window_size = window_size or self.window_size
        if feature_flag_manager.is_feature_enabled("PLAYWRIGHT_REPORTS_AND_THUMBNAILS"):
            return WebDriverPlaywright(self.driver_type, window_size)
        return WebDriverSelenium(self.driver_type, window_size)

    def get_screenshot(
        self, user: User, window_size: WindowSize | None = None
    ) -> bytes | None:
        driver = self.driver(window_size)
        self.screenshot = driver.get_screenshot(self.url, self.element, user)
        return self.screenshot

    def get_cache_key(
        self,
        window_size: bool | WindowSize | None = None,
        thumb_size: bool | WindowSize | None = None,
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

    def get_from_cache(
        self,
        window_size: WindowSize | None = None,
        thumb_size: WindowSize | None = None,
    ) -> ScreenshotCachePayload | None:
        cache_key = self.get_cache_key(window_size, thumb_size)
        return self.get_from_cache_key(cache_key)

    @classmethod
    def get_from_cache_key(cls, cache_key: str) -> ScreenshotCachePayload | None:
        logger.info("Attempting to get from cache: %s", cache_key)
        if payload := cls.cache.get(cache_key):
            # Initially, only bytes were stored. This was changed to store an instance
            # of ScreenshotCachePayload, but since it can't be serialized in all
            # backends it was further changed to a dict of attributes.
            if isinstance(payload, bytes):
                payload = ScreenshotCachePayload(payload)
            elif isinstance(payload, ScreenshotCachePayload):
                pass
            elif isinstance(payload, dict):
                payload = cast(ScreenshotCachePayloadType, payload)
                payload = ScreenshotCachePayload.from_dict(payload)
            return payload
        logger.info("Failed at getting from cache: %s", cache_key)
        return None

    def compute_and_cache(  # pylint: disable=too-many-arguments
        self,
        force: bool,
        user: User = None,
        window_size: WindowSize | None = None,
        thumb_size: WindowSize | None = None,
        cache_key: str | None = None,
    ) -> None:
        """
        Computes the thumbnail and caches the result

        :param user: If no user is given will use the current context
        :param cache: The cache to keep the thumbnail payload
        :param window_size: The window size from which will process the thumb
        :param thumb_size: The final thumbnail size
        :param force: Will force the computation even if it's already cached
        :return: Image payload
        """
        cache_key = cache_key or self.get_cache_key(window_size, thumb_size)
        cache_payload = self.get_from_cache_key(cache_key) or ScreenshotCachePayload()
        if (
            cache_payload.status in [StatusValues.COMPUTING, StatusValues.UPDATED]
            and not force
        ):
            logger.info(
                "Skipping compute - already processed for thumbnail: %s", cache_key
            )
            return

        window_size = window_size or self.window_size
        thumb_size = thumb_size or self.thumb_size
        logger.info("Processing url for thumbnail: %s", cache_key)
        cache_payload.computing()
        self.cache.set(cache_key, cache_payload.to_dict())
        image = None
        # Assuming all sorts of things can go wrong with Selenium
        try:
            logger.info("trying to generate screenshot")
            with event_logger.log_context(f"screenshot.compute.{self.thumbnail_type}"):
                image = self.get_screenshot(user=user, window_size=window_size)
        except Exception as ex:  # pylint: disable=broad-except
            logger.warning("Failed at generating thumbnail %s", ex, exc_info=True)
            cache_payload.error()
        if image and window_size != thumb_size:
            try:
                image = self.resize_image(image, thumb_size=thumb_size)
            except Exception as ex:  # pylint: disable=broad-except
                logger.warning("Failed at resizing thumbnail %s", ex, exc_info=True)
                cache_payload.error()
                image = None

        if image:
            logger.info("Caching thumbnail: %s", cache_key)
            with event_logger.log_context(f"screenshot.cache.{self.thumbnail_type}"):
                cache_payload.update(image)
        self.cache.set(cache_key, cache_payload.to_dict())
        logger.info("Updated thumbnail cache; Status: %s", cache_payload.get_status())
        return

    @classmethod
    def resize_image(
        cls,
        img_bytes: bytes,
        output: str = "png",
        thumb_size: WindowSize | None = None,
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
        img = img.resize(thumb_size, Image.Resampling.LANCZOS)
        new_img = BytesIO()
        if output != "png":
            img = img.convert("RGB")
        img.save(new_img, output)
        new_img.seek(0)
        return new_img.read()


class ChartScreenshot(BaseScreenshot):
    thumbnail_type: str = "chart"
    element: str = "chart-container"

    def __init__(
        self,
        url: str,
        digest: str | None,
        window_size: WindowSize | None = None,
        thumb_size: WindowSize | None = None,
    ):
        # Chart reports are in standalone="true" mode
        url = modify_url_query(
            url,
            standalone=ChartStandaloneMode.HIDE_NAV.value,
        )
        super().__init__(url, digest)
        self.window_size = window_size or DEFAULT_CHART_WINDOW_SIZE
        self.thumb_size = thumb_size or DEFAULT_CHART_THUMBNAIL_SIZE


class DashboardScreenshot(BaseScreenshot):
    thumbnail_type: str = "dashboard"
    element: str = "standalone"

    def __init__(
        self,
        url: str,
        digest: str | None,
        window_size: WindowSize | None = None,
        thumb_size: WindowSize | None = None,
    ):
        # per the element above, dashboard screenshots
        # should always capture in standalone
        url = modify_url_query(
            url,
            standalone=DashboardStandaloneMode.REPORT.value,
        )
        super().__init__(url, digest)
        self.window_size = window_size or DEFAULT_DASHBOARD_WINDOW_SIZE
        self.thumb_size = thumb_size or DEFAULT_DASHBOARD_THUMBNAIL_SIZE

    def get_cache_key(
        self,
        window_size: bool | WindowSize | None = None,
        thumb_size: bool | WindowSize | None = None,
        permalink_key: str | None = None,
    ) -> str:
        window_size = window_size or self.window_size
        thumb_size = thumb_size or self.thumb_size
        args = {
            "thumbnail_type": self.thumbnail_type,
            "digest": self.digest,
            "type": "thumb",
            "window_size": window_size,
            "thumb_size": thumb_size,
            "permalink_key": permalink_key,
        }
        return md5_sha_from_dict(args)
