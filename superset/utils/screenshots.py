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
from collections.abc import Callable
from datetime import datetime
from enum import Enum
from io import BytesIO
from typing import cast, NotRequired, TYPE_CHECKING, TypedDict

from flask import current_app as app

from superset import thumbnail_cache
from superset.distributed_lock import DistributedLock
from superset.exceptions import (
    AcquireDistributedLockFailedException,
    LockAlreadyHeldException,
    ReleaseDistributedLockFailedException,
    ScreenshotImageNotAvailableException,
)
from superset.extensions import event_logger
from superset.utils.cache import set_cache_value
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
DASHBOARD_SCREENSHOT_CAPTURE_CONTRACT = "dashboard-complete-v1"

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


class ScreenshotCacheError(RuntimeError):
    """Base exception for screenshot-cache access failures."""


class ScreenshotCacheReadError(ScreenshotCacheError):
    """Raised when a screenshot state cannot be read."""


class ScreenshotCacheWriteError(ScreenshotCacheError):
    """Raised when a screenshot state cannot be persisted."""


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
    scope: NotRequired[str | None]
    # Identifies the validation contract enforced by the worker that produced
    # an artifact. Legacy workers omit unknown fields when serializing, so a
    # rolling deployment cannot accidentally bless their unvalidated result.
    capture_contract: NotRequired[str | None]


# Magic bytes for a cheap image sanity check. This is intentionally not a full
# decode: it catches empty and obviously corrupt payloads before they're cached
# or served, but does not prove that the image is renderable or non-blank.
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
        status: StatusValues | None = None,
        timestamp: str = "",
        scope: str | None = None,
        capture_contract: str | None = None,
    ):
        self._image = image
        self._timestamp = timestamp or datetime.now().isoformat()
        self.status = status or (
            StatusValues.UPDATED if image else StatusValues.PENDING
        )
        self._scope = scope
        self._capture_contract = capture_contract

    @classmethod
    def from_dict(cls, payload: ScreenshotCachePayloadType) -> ScreenshotCachePayload:
        image = payload["image"]
        timestamp = payload["timestamp"]
        scope = payload.get("scope")
        capture_contract = payload.get("capture_contract")
        if image is not None and not isinstance(image, (str, bytes)):
            raise TypeError("Screenshot cache image must be base64 text")
        if not isinstance(timestamp, str):
            raise TypeError("Screenshot cache timestamp must be text")
        parsed_timestamp = datetime.fromisoformat(timestamp)
        if parsed_timestamp.tzinfo is not None:
            raise ValueError("Screenshot cache timestamp must be timezone-naive")
        if scope is not None and not isinstance(scope, str):
            raise TypeError("Screenshot cache scope must be text")
        if capture_contract is not None and not isinstance(capture_contract, str):
            raise TypeError("Screenshot cache capture contract must be text")
        return cls(
            image=base64.b64decode(image, validate=True) if image else None,
            status=StatusValues(payload["status"]),
            timestamp=timestamp,
            # `.get` rather than `payload["scope"]`: entries cached before this
            # field existed won't have the key.
            scope=scope,
            capture_contract=capture_contract,
        )

    def to_dict(self) -> ScreenshotCachePayloadType:
        return {
            "image": base64.b64encode(self._image).decode("utf-8")
            if self._image
            else None,
            "timestamp": self._timestamp,
            "status": self.status.value,
            "scope": self._scope,
            "capture_contract": self._capture_contract,
        }

    def get_scope(self) -> str | None:
        return self._scope

    def set_scope(self, scope: str | None) -> None:
        self._scope = scope

    def get_capture_contract(self) -> str | None:
        return self._capture_contract

    def set_capture_contract(self, capture_contract: str | None) -> None:
        self._capture_contract = capture_contract

    def has_capture_contract(self, expected_capture_contract: str) -> bool:
        return self._capture_contract == expected_capture_contract

    def update_timestamp(self) -> None:
        self._timestamp = datetime.now().isoformat()

    def pending(self) -> None:
        self.update_timestamp()
        self._image = None
        self._capture_contract = None
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

    def is_in_progress_stale(self) -> bool:
        """Check if a pending or computing request has exceeded its TTL."""
        computing_ttl = app.config["THUMBNAIL_COMPUTING_CACHE_TTL"]
        return (
            datetime.now() - datetime.fromisoformat(self.get_timestamp())
        ).total_seconds() >= computing_ttl

    def is_in_progress(self) -> bool:
        """Return whether screenshot computation has not reached a terminal state."""
        return self.status in (StatusValues.PENDING, StatusValues.COMPUTING)

    def is_updated(self) -> bool:
        """Return whether the cached screenshot completed successfully."""
        return self.status == StatusValues.UPDATED

    def should_enqueue_task(
        self,
        force: bool = False,
        expected_scope: str | None = None,
        expected_capture_contract: str | None = None,
    ) -> bool:
        """Check whether an API caller should enqueue screenshot computation.

        A fresh pending or computing payload represents an accepted in-flight
        request, so additional polling and force requests are coalesced. Stale
        in-flight payloads remain retryable through the computing cache TTL.
        """
        if expected_scope is not None and self._scope != expected_scope:
            return True
        if self.is_in_progress():
            return self.is_in_progress_stale()
        return self.should_trigger_task(
            force,
            expected_scope,
            expected_capture_contract=expected_capture_contract,
        )

    def should_trigger_task(
        self,
        force: bool = False,
        expected_scope: str | None = None,
        retry_fresh_error: bool = False,
        expected_capture_contract: str | None = None,
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
            or (
                self.status == StatusValues.UPDATED
                and expected_capture_contract is not None
                and not self.has_capture_contract(expected_capture_contract)
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
    # Set by the caller (e.g. "dashboard:<id>" or "chart:<id>") before
    # compute_and_cache() so the resulting cache entry records which object it
    # was rendered for -- callers that later serve a cache entry by a
    # caller-supplied digest/cache_key must check this against the object
    # they're authorizing, since the same cache backend is shared across
    # every dashboard and chart.
    cache_scope: str | None = None
    capture_contract: str | None = None

    def __init__(
        self,
        url: str,
        digest: str | None,
        require_complete_capture: bool = False,
    ):
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
        return WebDriverPlaywright("", window_size)

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
            require_complete_capture=self.require_complete_capture,
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
    def get_from_cache_key(cls, cache_key: str) -> ScreenshotCachePayload | None:
        logger.info("Attempting to get from cache: %s", cache_key)
        try:
            payload = cls.cache.get(cache_key)
        except Exception as ex:  # pylint: disable=broad-except
            logger.exception("Could not read screenshot cache key %s", cache_key)
            raise ScreenshotCacheReadError(
                f"Could not read screenshot cache key {cache_key}"
            ) from ex
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
                parsed_timestamp = datetime.fromisoformat(payload.get_timestamp())
                if parsed_timestamp.tzinfo is not None:
                    raise ValueError(
                        "Screenshot cache timestamp must be timezone-naive"
                    )
                payload.get_status()
                if invalid_reason := payload.get_invalid_image_reason():
                    logger.warning(
                        "Rejecting cached screenshot for %s: %s image payload; "
                        "treating as a cache miss",
                        cache_key,
                        invalid_reason,
                    )
                    return None
                return payload
            except Exception:  # pylint: disable=broad-except
                logger.warning(
                    "Rejecting malformed screenshot cache payload for %s; "
                    "treating as a cache miss",
                    cache_key,
                    exc_info=True,
                )
                return None
        logger.info("Failed at getting from cache: %s", cache_key)
        return None

    @classmethod
    def store_cache_payload(
        cls,
        cache_key: str,
        cache_payload: ScreenshotCachePayload,
    ) -> bool:
        """Persist screenshot state and report backend write failures."""

        return set_cache_value(cls.cache, cache_key, cache_payload.to_dict())

    @classmethod
    def _prepare_and_enqueue_task_under_lock(
        cls,
        cache_key: str,
        *,
        force: bool,
        scope: str,
        expected_capture_contract: str | None,
        enqueue: Callable[[], None],
    ) -> tuple[ScreenshotCachePayload, bool]:
        """Claim and publish a screenshot task while the producer lock is held."""

        cache_payload = cls.get_from_cache_key(cache_key)
        cache_payload = cache_payload or ScreenshotCachePayload()
        if not cache_payload.should_enqueue_task(
            force,
            expected_scope=scope,
            expected_capture_contract=expected_capture_contract,
        ):
            return cache_payload, False
        cache_payload.pending()
        cache_payload.set_scope(scope)
        cls._store_cache_payload_or_raise(cache_key, cache_payload)
        try:
            enqueue()
        except Exception:  # pylint: disable=broad-except
            try:
                if not cls.store_error_if_no_active_task(cache_key, scope=scope):
                    logger.error(
                        "Could not persist screenshot Error state after enqueue "
                        "failure: %s",
                        cache_key,
                    )
            except ScreenshotCacheError:
                logger.exception(
                    "Could not inspect screenshot state after enqueue failure: %s",
                    cache_key,
                )
            raise
        return cache_payload, True

    @classmethod
    def prepare_and_enqueue_task(
        cls,
        cache_key: str,
        *,
        force: bool,
        scope: str,
        enqueue: Callable[[], None],
        expected_capture_contract: str | None = None,
    ) -> tuple[ScreenshotCachePayload, bool]:
        """Atomically claim a cache key and publish its API task.

        Producers use a short, separate lock from workers. Holding it through
        broker publication prevents a second producer from colliding with a
        fast worker or racing enqueue-failure cleanup. A leaked producer lock
        cannot block an already accepted worker.

        :return: The latest payload and whether the caller owns the enqueue.
        """

        result: tuple[ScreenshotCachePayload, bool] | None = None
        operation_error: Exception | None = None
        release_error: ReleaseDistributedLockFailedException | None = None
        try:
            with DistributedLock(
                namespace="thumbnail_enqueue",
                key=cache_key,
            ):
                try:
                    result = cls._prepare_and_enqueue_task_under_lock(
                        cache_key,
                        force=force,
                        scope=scope,
                        expected_capture_contract=expected_capture_contract,
                        enqueue=enqueue,
                    )
                except Exception as ex:  # pylint: disable=broad-except
                    # Let __exit__ release the producer lock, then preserve the
                    # operation's original exception even if release also fails.
                    operation_error = ex
        except LockAlreadyHeldException:
            # Another API producer owns publication for this key. Polling will
            # observe its Pending transition or terminal result.
            cache_payload = ScreenshotCachePayload(scope=scope)
            cache_payload.pending()
            return cache_payload, False
        except AcquireDistributedLockFailedException as ex:
            raise ScreenshotCacheWriteError(
                f"Could not coordinate screenshot task for {cache_key}"
            ) from ex
        except ReleaseDistributedLockFailedException as ex:
            release_error = ex

        if operation_error is not None:
            raise operation_error
        if release_error is not None:
            if result is None:
                raise ScreenshotCacheWriteError(
                    f"Could not coordinate screenshot task for {cache_key}"
                ) from release_error
            logger.warning(
                "Screenshot task producer lock release failed after the operation "
                "completed for %s; preserving its accepted result: %s",
                cache_key,
                release_error,
            )
        if result is None:
            raise ScreenshotCacheWriteError(
                f"Screenshot task preparation did not complete for {cache_key}"
            )
        return result

    @classmethod
    def store_error_if_no_active_task(cls, cache_key: str, scope: str) -> bool:
        """Persist a setup failure without overwriting another worker's state.

        Worker setup happens before ``compute_and_cache`` acquires its lock. A
        duplicate delivery can therefore fail during setup while the original
        worker owns the screenshot lock. Acquiring that same lock before the
        fallback write keeps the state monotonic: an active worker remains in
        control, and an already completed artifact remains ``Updated``.
        """

        try:
            with DistributedLock(
                namespace="thumbnail",
                key=cache_key,
                ttl_seconds=app.config["THUMBNAIL_COMPUTING_CACHE_TTL"],
            ):
                cache_payload = cls.get_from_cache_key(cache_key)
                if cache_payload and cache_payload.is_updated():
                    logger.info(
                        "Skipping screenshot Error state for completed task: %s",
                        cache_key,
                    )
                    return True
                error_payload = ScreenshotCachePayload(scope=scope)
                error_payload.error()
                return cls.store_cache_payload(cache_key, error_payload)
        except LockAlreadyHeldException:
            logger.info(
                "Skipping screenshot Error state while another task owns %s",
                cache_key,
            )
            return True
        except (
            AcquireDistributedLockFailedException,
            ReleaseDistributedLockFailedException,
        ):
            logger.exception(
                "Could not coordinate screenshot Error state for %s",
                cache_key,
            )
            return False

    @classmethod
    def _store_cache_payload_or_raise(
        cls,
        cache_key: str,
        cache_payload: ScreenshotCachePayload,
        *,
        replace_rejected_image_with_error: bool = False,
    ) -> None:
        """Persist screenshot state, optionally replacing a rejected image."""

        if cls.store_cache_payload(cache_key, cache_payload):
            return
        failed_status = cache_payload.get_status()
        if (
            replace_rejected_image_with_error
            and cache_payload.status == StatusValues.UPDATED
        ):
            # A backend may reject only the image-bearing payload (for example
            # Memcached's item-size limit). Replace it with a small terminal
            # state so API polling observes a truthful Error instead of stale
            # Computing forever.
            cache_payload.error(discard_image=True)
            cls.store_cache_payload(cache_key, cache_payload)
        raise ScreenshotCacheWriteError(
            f"Could not persist {failed_status} state for {cache_key}"
        )

    def compute_and_cache(  # pylint: disable=too-many-arguments
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
                    self.get_from_cache_key(cache_key) or ScreenshotCachePayload()
                )
                if not cache_payload.should_trigger_task(
                    force=force,
                    expected_scope=self.cache_scope,
                    retry_fresh_error=retry_fresh_error,
                    expected_capture_contract=self.capture_contract,
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
                cache_payload.set_capture_contract(self.capture_contract)
                self._store_cache_payload_or_raise(cache_key, cache_payload)
                image = None
                # Assuming all sorts of things can go wrong with Selenium
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
                self._store_cache_payload_or_raise(
                    cache_key,
                    cache_payload,
                    replace_rejected_image_with_error=True,
                )
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
        logger.debug("Selenium image size: %s%s", str(img.size), context_suffix)
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
    ):
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
        if require_complete_capture:
            self.capture_contract = DASHBOARD_SCREENSHOT_CAPTURE_CONTRACT
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
