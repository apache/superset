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
import uuid
from datetime import datetime
from enum import Enum
from io import BytesIO
from typing import cast, TYPE_CHECKING, TypedDict

from flask import current_app as app

from superset import thumbnail_cache
from superset.distributed_lock import DistributedLock
from superset.exceptions import (
    LockAlreadyHeldException,
    ScreenshotImageNotAvailableException,
)
from superset.extensions import event_logger
from superset.key_value.types import JsonKeyValueCodec
from superset.key_value.utils import get_uuid_namespace
from superset.utils.hashing import hash_from_dict
from superset.utils.report_execution import ReportExecutionContext
from superset.utils.urls import modify_url_query
from superset.utils.webdriver import (
    ChartStandaloneMode,
    DashboardStandaloneMode,
    WebDriverPlaywright,
    WebDriverProxy,
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

    from superset.extensions.metastore_cache import SupersetMetastoreCache


class StatusValues(Enum):
    PENDING = "Pending"
    COMPUTING = "Computing"
    UPDATED = "Updated"
    ERROR = "Error"


class ScreenshotCacheError(RuntimeError):
    """Raised when screenshot state cannot be read or persisted."""


class ScreenshotCachePayloadType(TypedDict):
    image: str | None
    timestamp: str
    status: str
    # Identifies which object (e.g. "dashboard:<id>" or "chart:<id>") this
    # entry was rendered for. Cache entries written before this field existed
    # (or by a not-yet-upgraded worker during a rolling deploy) have no scope
    # and are treated as belonging to no object -- read access is fail-closed
    # until the entry is recomputed. Optional at the type level via `.get()`
    # in `from_dict` for that reason.
    scope: str | None


class DashboardScreenshotPointerType(TypedDict):
    cache_key: str
    scope: str


# Magic bytes for a cheap image sanity check. This is intentionally not a full
# decode: it's meant to catch 0-byte/corrupt/blank payloads before they're
# cached or served, not to validate the image is renderable.
PNG_MAGIC_BYTES = b"\x89PNG\r\n\x1a\n"
JPEG_MAGIC_BYTES = b"\xff\xd8\xff"


def validate_screenshot_image(image: bytes | None) -> str | None:
    """Cheaply validate screenshot bytes before they're cached or served.

    :return: None if the bytes look like a usable image, otherwise a short
        reason ("empty" or "undecodable") suitable for logging.
    """
    if not image:
        return "empty"
    if not image.startswith((PNG_MAGIC_BYTES, JPEG_MAGIC_BYTES)):
        return "undecodable"
    return None


class ScreenshotCachePayload:
    def __init__(
        self,
        image: bytes | None = None,
        status: StatusValues = StatusValues.PENDING,
        timestamp: str = "",
        scope: str | None = None,
    ):
        self._image = image
        self._timestamp = timestamp or datetime.now().isoformat()
        self.status = StatusValues.UPDATED if image else status
        self._scope = scope

    @classmethod
    def from_dict(cls, payload: ScreenshotCachePayloadType) -> ScreenshotCachePayload:
        return cls(
            image=base64.b64decode(payload["image"]) if payload["image"] else None,
            status=StatusValues(payload["status"]),
            timestamp=payload["timestamp"],
            # `.get` rather than `payload["scope"]`: entries cached before this
            # field existed won't have the key.
            scope=payload.get("scope"),
        )

    def to_dict(self) -> ScreenshotCachePayloadType:
        return {
            "image": base64.b64encode(self._image).decode("utf-8")
            if self._image
            else None,
            "timestamp": self._timestamp,
            "status": self.status.value,
            "scope": self._scope,
        }

    def get_scope(self) -> str | None:
        return self._scope

    def set_scope(self, scope: str | None) -> None:
        self._scope = scope

    def update_timestamp(self) -> None:
        self._timestamp = datetime.now().isoformat()

    def pending(self) -> None:
        self.update_timestamp()
        self._image = None
        self.status = StatusValues.PENDING

    def computing(self) -> None:
        self.update_timestamp()
        self.status = StatusValues.COMPUTING

    def update(self, image: bytes) -> None:
        self.update_timestamp()
        self.status = StatusValues.UPDATED
        self._image = image

    def error(self, *, discard_image: bool = False) -> None:
        self.update_timestamp()
        if discard_image:
            self._image = None
        self.status = StatusValues.ERROR

    def get_image(self) -> BytesIO:
        if self._image is None:
            raise ScreenshotImageNotAvailableException()
        return BytesIO(cast(bytes, self._image))

    def get_timestamp(self) -> str:
        return self._timestamp

    def get_status(self) -> str:
        return self.status.value

    def get_invalid_image_reason(self) -> str | None:
        """Reason this payload's image should not be served/cached, or None if
        it passes validation (or it isn't claiming a successful screenshot)."""
        if self.status != StatusValues.UPDATED:
            return None
        return validate_screenshot_image(self._image)

    def is_error_cache_ttl_expired(self) -> bool:
        error_cache_ttl = app.config["THUMBNAIL_ERROR_CACHE_TTL"]
        return (
            datetime.now() - datetime.fromisoformat(self.get_timestamp())
        ).total_seconds() > error_cache_ttl

    def is_computing_stale(self) -> bool:
        """Check if a COMPUTING status is stale (task likely failed or stuck)."""
        return self.is_in_progress_stale()

    def is_in_progress_stale(self, max_age_seconds: float | None = None) -> bool:
        """Check if a pending or computing request has exceeded its lease."""
        computing_ttl = (
            max_age_seconds
            if max_age_seconds is not None
            else app.config["THUMBNAIL_COMPUTING_CACHE_TTL"]
        )
        return (
            datetime.now() - datetime.fromisoformat(self.get_timestamp())
        ).total_seconds() >= computing_ttl

    def is_in_progress(self) -> bool:
        """Return whether screenshot computation has not reached a terminal state."""

        return self.status in (StatusValues.PENDING, StatusValues.COMPUTING)

    def is_updated(self) -> bool:
        """Return whether screenshot computation completed successfully."""

        return self.status == StatusValues.UPDATED

    def should_enqueue_task(
        self,
        force: bool = False,
        expected_scope: str | None = None,
        force_retry_after_seconds: float | None = None,
    ) -> bool:
        """Return whether an API producer should enqueue a new generation.

        Fresh pending/computing state is already accepted work for ordinary
        callers. An explicit forced request may replace it after an optional
        coalescing window, which lets simultaneous forced requests share one
        generation while still allowing prompt recovery if a producer died before
        broker publication. A stale in-progress state remains retryable without
        force.
        """

        if expected_scope is not None and self._scope != expected_scope:
            return True
        if self.is_in_progress():
            return self.is_in_progress_stale() or (
                force
                and (
                    force_retry_after_seconds is None
                    or self.is_in_progress_stale(force_retry_after_seconds)
                )
            )
        return self.should_trigger_task(force, expected_scope)

    def should_trigger_task(
        self,
        force: bool = False,
        expected_scope: str | None = None,
        retry_fresh_error: bool = False,
    ) -> bool:
        """
        :param expected_scope: The scope (e.g. "dashboard:<id>") the caller
            requires this entry to carry. Entries written before scope
            tracking existed -- or by a stale/mismatched caller -- deserialize
            with no scope (or a different one) and are otherwise
            indistinguishable from a fresh, valid ``UPDATED`` entry, which
            would leave them permanently un-refreshed: the scope check at
            read time rejects them, but nothing ever re-triggers computation.
            Treat a scope mismatch on an ``UPDATED`` entry as a cache miss so
            it gets recomputed and re-scoped.
        """
        return (
            force
            or self.status == StatusValues.PENDING
            or (
                self.status == StatusValues.ERROR
                and (retry_fresh_error or self.is_error_cache_ttl_expired())
            )
            or (self.status == StatusValues.COMPUTING and self.is_computing_stale())
            or (self.status == StatusValues.UPDATED and self._image is None)
            or (
                self.status == StatusValues.UPDATED
                and expected_scope is not None
                and self._scope != expected_scope
            )
        )


class BaseScreenshot:
    url: str
    digest: str | None
    screenshot: bytes | None
    thumbnail_type: str = ""
    element: str = ""
    window_size: WindowSize = DEFAULT_SCREENSHOT_WINDOW_SIZE
    thumb_size: WindowSize = DEFAULT_SCREENSHOT_THUMBNAIL_SIZE
    cache: Cache = thumbnail_cache
    # Tests may inject an in-memory implementation. Production pointers use the
    # metadata-backed cache so their atomic publication does not depend on the
    # configured thumbnail backend supporting conditional writes (S3 and other
    # object-store caches may not).
    api_pointer_cache: SupersetMetastoreCache | None = None
    # Set by the caller (e.g. "dashboard:<id>" or "chart:<id>") before
    # compute_and_cache() so the resulting cache entry records which object it
    # was rendered for -- callers that later serve a cache entry by a
    # caller-supplied digest/cache_key must check this against the object
    # they're authorizing, since the same cache backend is shared across
    # every dashboard and chart.
    cache_scope: str | None = None

    def __init__(
        self,
        url: str,
        digest: str | None,
        require_complete_capture: bool = False,
    ) -> None:
        self.digest = digest
        self.url = url
        self.screenshot = None
        self.require_complete_capture = require_complete_capture

    def driver(
        self,
        window_size: WindowSize | None = None,
    ) -> WebDriverProxy:
        window_size = window_size or self.window_size
        # Empty string for driver_type — unused by WebDriverPlaywright internals
        return WebDriverPlaywright(
            "",
            window_size,
            require_complete_capture=self.require_complete_capture,
        )

    def get_screenshot(
        self,
        user: User,
        window_size: WindowSize | None = None,
        log_context: str | None = None,
        report_execution_context: ReportExecutionContext | None = None,
    ) -> bytes | None:
        driver = self.driver(window_size)
        self.screenshot = driver.get_screenshot(
            self.url,
            self.element,
            user,
            log_context=log_context,
            report_execution_context=report_execution_context,
        )
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
        return hash_from_dict(args)

    def get_from_cache(
        self,
        window_size: WindowSize | None = None,
        thumb_size: WindowSize | None = None,
    ) -> ScreenshotCachePayload | None:
        cache_key = self.get_cache_key(window_size, thumb_size)
        return self.get_from_cache_key(cache_key)

    @classmethod
    def get_from_cache_key(
        cls,
        cache_key: str,
        *,
        raise_on_error: bool = False,
    ) -> ScreenshotCachePayload | None:
        logger.info("Attempting to get from cache: %s", cache_key)
        try:
            payload = cls.cache.get(cache_key)
        except Exception as ex:  # pylint: disable=broad-except
            if raise_on_error:
                raise ScreenshotCacheError(
                    f"Could not read screenshot cache key {cache_key}"
                ) from ex
            # Existing thumbnail/chart callers historically propagate cache
            # backend failures. Only strict API callers opt into the translated
            # error above so they can return a deliberate service response.
            raise
        if payload:
            # Initially, only bytes were stored. This was changed to store an instance
            # of ScreenshotCachePayload, but since it can't be serialized in all
            # backends it was further changed to a dict of attributes.
            try:
                if isinstance(payload, bytes):
                    payload = ScreenshotCachePayload(payload)
                elif isinstance(payload, ScreenshotCachePayload):
                    pass
                elif isinstance(payload, dict):
                    payload = cast(ScreenshotCachePayloadType, payload)
                    payload = ScreenshotCachePayload.from_dict(payload)
                else:
                    raise TypeError(
                        f"Unexpected screenshot cache payload: {type(payload)!r}"
                    )
            except (KeyError, TypeError, ValueError):
                logger.warning(
                    "Rejecting malformed screenshot cache payload for %s",
                    cache_key,
                    exc_info=True,
                )
                return None
            if invalid_reason := payload.get_invalid_image_reason():
                logger.warning(
                    "Rejecting cached screenshot for %s: %s image payload; "
                    "treating as a cache miss",
                    cache_key,
                    invalid_reason,
                )
                return None
            return payload
        logger.info("Failed at getting from cache: %s", cache_key)
        return None

    @classmethod
    def store_cache_payload(
        cls,
        cache_key: str,
        cache_payload: ScreenshotCachePayload,
    ) -> None:
        """Persist screenshot state or raise when the backend rejects it."""

        try:
            stored = cls.cache.set(cache_key, cache_payload.to_dict())
        except Exception as ex:  # pylint: disable=broad-except
            raise ScreenshotCacheError(
                f"Could not persist screenshot cache key {cache_key}"
            ) from ex
        # Flask-Caching permits custom backends whose successful ``set``
        # returns None, so only an explicit False is a failed write.
        if stored is False:
            raise ScreenshotCacheError(
                f"Could not persist screenshot cache key {cache_key}"
            )

    @classmethod
    def mark_cache_error_if_incomplete(cls, cache_key: str, scope: str) -> None:
        """Mark an accepted generation failed without clobbering another worker."""

        try:
            with DistributedLock(
                namespace="thumbnail",
                key=cache_key,
                ttl_seconds=app.config["THUMBNAIL_COMPUTING_CACHE_TTL"],
            ):
                cache_payload = cls.get_from_cache_key(
                    cache_key,
                    raise_on_error=True,
                )
                if cache_payload and cache_payload.is_updated():
                    return
                cache_payload = cache_payload or ScreenshotCachePayload(scope=scope)
                cache_payload.set_scope(scope)
                cache_payload.error(discard_image=True)
                cls.store_cache_payload(cache_key, cache_payload)
        except LockAlreadyHeldException:
            # A worker owns the generation and will persist its terminal state.
            logger.info(
                "Not replacing active screenshot generation with Error: %s",
                cache_key,
            )
        except ScreenshotCacheError:
            logger.exception(
                "Could not persist screenshot Error state for %s",
                cache_key,
            )
        except Exception:  # pylint: disable=broad-except
            logger.exception(
                "Could not coordinate screenshot Error state for %s",
                cache_key,
            )

    def compute_and_cache(  # pylint: disable=too-many-arguments  # noqa: C901
        self,
        force: bool,
        user: User = None,
        window_size: WindowSize | None = None,
        thumb_size: WindowSize | None = None,
        cache_key: str | None = None,
        retry_fresh_error: bool = False,
    ) -> None:
        """
        Computes the thumbnail and caches the result

        :param user: If no user is given will use the current context
        :param cache_key: The cache key to store the thumbnail payload under
        :param window_size: The window size from which will process the thumb
        :param thumb_size: The final thumbnail size
        :param force: Will force the computation even if it's already cached
        :return: Image payload
        """
        cache_key = cache_key or self.get_cache_key(window_size, thumb_size)
        try:
            with DistributedLock(
                namespace="thumbnail",
                key=cache_key,
                ttl_seconds=app.config["THUMBNAIL_COMPUTING_CACHE_TTL"],
            ):
                cache_payload = (
                    self.get_from_cache_key(
                        cache_key,
                        raise_on_error=self.require_complete_capture,
                    )
                    or ScreenshotCachePayload()
                )
                if not cache_payload.should_trigger_task(
                    force=force,
                    expected_scope=self.cache_scope,
                    retry_fresh_error=retry_fresh_error,
                ):
                    logger.info(
                        "Skipping compute - already processed for thumbnail: %s",
                        cache_key,
                    )
                    return

                window_size = window_size or self.window_size
                thumb_size = thumb_size or self.thumb_size
                logger.info("Processing url for thumbnail: %s", cache_key)
                cache_payload.set_scope(self.cache_scope)
                cache_payload.computing()
                if self.require_complete_capture:
                    self.store_cache_payload(cache_key, cache_payload)
                else:
                    self.cache.set(cache_key, cache_payload.to_dict())
                image = None
                try:
                    logger.info(
                        "trying to generate screenshot for cache_key=%s", cache_key
                    )
                    with event_logger.log_context(
                        f"screenshot.compute.{self.thumbnail_type}"
                    ):
                        image = self.get_screenshot(
                            user=user,
                            window_size=window_size,
                            log_context=f"cache_key={cache_key}",
                        )
                except Exception as ex:  # pylint: disable=broad-except
                    logger.warning(
                        "Failed at generating thumbnail for cache_key=%s: %s",
                        cache_key,
                        ex,
                        exc_info=True,
                    )
                    cache_payload.error()
                if image and window_size != thumb_size:
                    try:
                        image = self.resize_image(
                            image,
                            thumb_size=thumb_size,
                            log_context=f"cache_key={cache_key}",
                        )
                    except Exception as ex:  # pylint: disable=broad-except
                        logger.warning(
                            "Failed at resizing thumbnail for cache_key=%s: %s",
                            cache_key,
                            ex,
                            exc_info=True,
                        )
                        cache_payload.error()
                        image = None

                # Cache the result (success or error) to avoid immediate retries
                invalid_reason = validate_screenshot_image(image)
                # `image and` is redundant at runtime (validate_screenshot_image
                # only returns None for truthy, well-formed bytes) but mypy can't
                # infer that image is non-None from invalid_reason being None
                # across the function-call boundary, so it's kept for narrowing.
                if image and invalid_reason is None:
                    with event_logger.log_context(
                        f"screenshot.cache.{self.thumbnail_type}"
                    ):
                        cache_payload.update(image)
                else:
                    if invalid_reason:
                        logger.warning(
                            "Not caching screenshot result for %s: %s image payload",
                            cache_key,
                            invalid_reason,
                        )
                    if cache_payload.status != StatusValues.ERROR:
                        # Only call error() if not already set — avoids overwriting
                        # the timestamp recorded when the actual failure occurred
                        # above.
                        cache_payload.error()

                logger.info("Caching thumbnail: %s", cache_key)
                if self.require_complete_capture:
                    try:
                        self.store_cache_payload(cache_key, cache_payload)
                    except ScreenshotCacheError:
                        if cache_payload.status == StatusValues.UPDATED:
                            # Image-bearing writes can be rejected by bounded
                            # cache backends. Replace the stale Computing state
                            # with a small terminal Error whenever possible.
                            cache_payload.error(discard_image=True)
                            try:
                                self.store_cache_payload(cache_key, cache_payload)
                            except ScreenshotCacheError:
                                logger.exception(
                                    "Could not persist fallback Error state for %s",
                                    cache_key,
                                )
                        raise
                else:
                    self.cache.set(cache_key, cache_payload.to_dict())
                logger.info(
                    "Updated thumbnail cache for %s; Status: %s",
                    cache_key,
                    cache_payload.get_status(),
                )
        except LockAlreadyHeldException:
            logger.info(
                "Skipping duplicate thumbnail task for %s - lock already held",
                cache_key,
            )

    @classmethod
    def resize_image(
        cls,
        img_bytes: bytes,
        output: str = "png",
        thumb_size: WindowSize | None = None,
        crop: bool = True,
        log_context: str | None = None,
    ) -> bytes:
        context_suffix = f" [{log_context}]" if log_context else ""
        thumb_size = thumb_size or cls.thumb_size
        img = Image.open(BytesIO(img_bytes))
        logger.debug("Screenshot image size: %s%s", str(img.size), context_suffix)
        if crop and img.size[1] != cls.window_size[1]:
            desired_ratio = float(cls.window_size[1]) / cls.window_size[0]
            desired_width = int(img.size[0] * desired_ratio)
            logger.debug(
                "Cropping to: %s*%s%s",
                str(img.size[0]),
                str(desired_width),
                context_suffix,
            )
            img = img.crop((0, 0, img.size[0], desired_width))
        logger.debug("Resizing to %s%s", str(thumb_size), context_suffix)
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
        require_complete_capture: bool = False,
    ) -> None:
        # per the element above, dashboard screenshots
        # should always capture in standalone
        url = modify_url_query(
            url,
            standalone=DashboardStandaloneMode.REPORT.value,
        )
        super().__init__(
            url,
            digest,
            require_complete_capture=require_complete_capture,
        )
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
        return hash_from_dict(args)

    def get_api_request_cache_key(
        self,
        window_size: bool | WindowSize | None,
        thumb_size: bool | WindowSize | None,
        permalink_key: str,
        scope: str,
    ) -> str:
        """Return the stable pointer key for one API screenshot request state."""

        return hash_from_dict(
            {
                "type": "dashboard_screenshot_api_request",
                "version": 1,
                "legacy_cache_key": self.get_cache_key(
                    window_size,
                    thumb_size,
                    permalink_key,
                ),
                "scope": scope,
            }
        )

    @staticmethod
    def get_next_api_generation_cache_key(
        request_cache_key: str,
        previous_cache_key: str | None,
    ) -> str:
        """Return a unique successor; the producer lock coalesces racers."""

        return hash_from_dict(
            {
                "type": "dashboard_screenshot_api_generation",
                "request_cache_key": request_cache_key,
                "previous_cache_key": previous_cache_key,
                # The request pointer can expire before its last image because
                # successful image storage refreshes that generation's TTL.
                # A nonce prevents a later request from recreating and
                # overwriting the still-downloadable first-generation key.
                "generation_id": uuid.uuid4().hex,
            }
        )

    @staticmethod
    def get_api_generation_pointer_cache_key(request_cache_key: str) -> str:
        """Return the metadata-cache key for an API screenshot request."""

        return hash_from_dict(
            {
                "type": "dashboard_screenshot_api_generation_pointer",
                "version": 1,
                "request_cache_key": request_cache_key,
            }
        )

    @classmethod
    def _get_api_pointer_cache(cls) -> SupersetMetastoreCache:
        if cls.api_pointer_cache is not None:
            return cls.api_pointer_cache

        # Imported lazily to avoid initializing the metadata-backed cache while
        # Superset's application extensions are still being constructed.
        from superset.extensions.metastore_cache import SupersetMetastoreCache

        thumbnail_backend = cls.cache.cache
        configured_timeout = getattr(
            thumbnail_backend,
            "default_timeout",
            None,
        )
        default_timeout = int(
            configured_timeout
            if configured_timeout is not None
            else app.config["CACHE_DEFAULT_TIMEOUT"]
        )
        return SupersetMetastoreCache(
            namespace=get_uuid_namespace(
                "dashboard_screenshot_api_generation_pointer",
                app,
            ),
            codec=JsonKeyValueCodec(),
            default_timeout=default_timeout,
        )

    @classmethod
    def _get_api_generation_pointer(
        cls, pointer_cache_key: str, scope: str
    ) -> str | None:
        """Read and validate one API generation pointer."""

        try:
            pointer = cls._get_api_pointer_cache().get(pointer_cache_key)
        except Exception as ex:  # pylint: disable=broad-except
            raise ScreenshotCacheError(
                f"Could not read screenshot request key {pointer_cache_key}"
            ) from ex
        if not pointer:
            return None
        if not isinstance(pointer, dict):
            logger.warning(
                "Rejecting malformed screenshot request pointer for %s",
                pointer_cache_key,
            )
            return None
        pointer = cast(DashboardScreenshotPointerType, pointer)
        cache_key = pointer.get("cache_key")
        if pointer.get("scope") != scope or not isinstance(cache_key, str):
            logger.warning(
                "Rejecting mismatched screenshot request pointer for %s",
                pointer_cache_key,
            )
            return None
        return cache_key

    @classmethod
    def get_current_api_generation_cache_key(
        cls,
        request_cache_key: str,
        scope: str,
    ) -> str | None:
        """Resolve the current generation for a stable API request key."""

        pointer_cache_key = cls.get_api_generation_pointer_cache_key(request_cache_key)
        return cls._get_api_generation_pointer(pointer_cache_key, scope)

    @classmethod
    def set_current_api_generation_cache_key(
        cls,
        request_cache_key: str,
        cache_key: str,
        scope: str,
        previous_cache_key: str | None,
    ) -> bool:
        """Publish a generation only if its observed predecessor is still current.

        The pointer uses Superset's metadata-backed cache, whose compare-and-set is
        atomic. This avoids relying on conditional writes from the configured
        thumbnail backend, which may be an object store without that capability.

        :return: ``True`` when this generation won publication, ``False`` when
            another producer already published the same predecessor's successor.
        """

        pointer: DashboardScreenshotPointerType = {
            "cache_key": cache_key,
            "scope": scope,
        }
        pointer_cache_key = cls.get_api_generation_pointer_cache_key(request_cache_key)
        pointer_cache = cls._get_api_pointer_cache()
        expected = (
            {
                "cache_key": previous_cache_key,
                "scope": scope,
            }
            if previous_cache_key is not None
            else None
        )
        try:
            return pointer_cache.compare_and_set(
                pointer_cache_key,
                pointer,
                expected,
            )
        except Exception as ex:  # pylint: disable=broad-except
            raise ScreenshotCacheError(
                f"Could not persist screenshot request key {request_cache_key}"
            ) from ex
