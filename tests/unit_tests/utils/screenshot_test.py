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

# pylint: disable=import-outside-toplevel, unused-argument

from unittest.mock import MagicMock, patch

import pytest
from pytest_mock import MockerFixture

from superset.utils.hashing import hash_from_dict
from superset.utils.screenshots import (
    BaseScreenshot,
    ChartScreenshot,
    ScreenshotCachePayload,
    ScreenshotCachePayloadType,
)

BASE_SCREENSHOT_PATH = "superset.utils.screenshots.BaseScreenshot"

# A minimal valid PNG header, used wherever a test needs bytes that pass
# ScreenshotCachePayload's image validation.
FAKE_PNG_BYTES = b"\x89PNG\r\n\x1a\n" + b"fake-png-body"


class MockCache:
    """A class to manage screenshot cache."""

    def __init__(self):
        self._cache = None  # Store the cached value

    def set(self, _key, value):
        """Set the cache with a new value."""
        self._cache = value

    def get(self, _key):
        """Get the cached value."""
        return self._cache


@pytest.fixture
def mock_user():
    """Fixture to create a mock user."""
    mock_user = MagicMock()
    mock_user.id = 1
    return mock_user


@pytest.fixture
def screenshot_obj():
    """Fixture to create a BaseScreenshot object."""
    url = "http://example.com"
    digest = "sample_digest"
    return BaseScreenshot(url, digest)


def test_get_screenshot(mocker: MockerFixture, screenshot_obj):
    """Get screenshot should return a Bytes object"""
    fake_bytes = b"fake_screenshot_data"
    driver = mocker.patch(BASE_SCREENSHOT_PATH + ".driver")
    driver.return_value.get_screenshot.return_value = fake_bytes
    screenshot_data = screenshot_obj.get_screenshot(mock_user)
    assert screenshot_data == fake_bytes


def test_get_cache_key(app_context, screenshot_obj):
    """Test get_cache_key method"""
    expected_cache_key = hash_from_dict(
        {
            "thumbnail_type": "",
            "digest": screenshot_obj.digest,
            "type": "thumb",
            "window_size": screenshot_obj.window_size,
            "thumb_size": screenshot_obj.thumb_size,
        }
    )
    cache_key = screenshot_obj.get_cache_key()
    assert cache_key == expected_cache_key


def test_get_from_cache_key(mocker: MockerFixture, screenshot_obj):
    """get_from_cache_key should always return a ScreenshotCachePayload Object"""
    # backwards compatibility test for retrieving plain bytes
    fake_bytes = FAKE_PNG_BYTES
    BaseScreenshot.cache = MockCache()
    BaseScreenshot.cache.set("key", fake_bytes)
    cache_payload = screenshot_obj.get_from_cache_key("key")
    assert isinstance(cache_payload, ScreenshotCachePayload)
    assert cache_payload._image == fake_bytes  # pylint: disable=protected-access


class TestComputeAndCache:
    def _setup_compute_and_cache(self, mocker: MockerFixture, screenshot_obj):
        """Helper method to handle the common setup for the tests."""
        # Patch the methods
        get_from_cache_key = mocker.patch(
            BASE_SCREENSHOT_PATH + ".get_from_cache_key", return_value=None
        )
        get_screenshot = mocker.patch(
            BASE_SCREENSHOT_PATH + ".get_screenshot", return_value=FAKE_PNG_BYTES
        )
        resize_image = mocker.patch(
            BASE_SCREENSHOT_PATH + ".resize_image", return_value=FAKE_PNG_BYTES
        )
        BaseScreenshot.cache = MockCache()
        return {
            "get_from_cache_key": get_from_cache_key,
            "get_screenshot": get_screenshot,
            "resize_image": resize_image,
        }

    def test_happy_path(self, mocker: MockerFixture, screenshot_obj):
        self._setup_compute_and_cache(mocker, screenshot_obj)
        screenshot_obj.compute_and_cache(force=False)
        cache_payload: ScreenshotCachePayloadType = screenshot_obj.cache.get("key")
        assert cache_payload["status"] == "Updated"

    def test_stamps_cache_scope_when_set(self, mocker: MockerFixture, screenshot_obj):
        """A caller (the thumbnail Celery tasks) sets `cache_scope` before
        calling compute_and_cache so the persisted entry can later be checked
        against the object a caller-supplied digest is being used to access."""
        self._setup_compute_and_cache(mocker, screenshot_obj)
        screenshot_obj.cache_scope = "dashboard:5"
        screenshot_obj.compute_and_cache(force=False)
        cache_payload: ScreenshotCachePayloadType = screenshot_obj.cache.get("key")
        assert cache_payload["scope"] == "dashboard:5"

    def test_scope_unset_when_caller_never_sets_it(
        self, mocker: MockerFixture, screenshot_obj
    ):
        self._setup_compute_and_cache(mocker, screenshot_obj)
        screenshot_obj.compute_and_cache(force=False)
        cache_payload: ScreenshotCachePayloadType = screenshot_obj.cache.get("key")
        assert cache_payload["scope"] is None

    def test_passes_cache_key_log_context_to_capture(
        self, mocker: MockerFixture, screenshot_obj
    ):
        """compute_and_cache must thread its cache_key into the capture layer
        as log_context, so every webdriver/screenshot log line produced by a
        thumbnail or direct-download run can be traced back to the exact
        cached entry it was computing (reports already do this with their
        execution_id)."""
        mocks = self._setup_compute_and_cache(mocker, screenshot_obj)
        cache_key = screenshot_obj.get_cache_key()
        screenshot_obj.compute_and_cache(force=False)

        get_screenshot: MagicMock = mocks.get("get_screenshot")
        get_screenshot.assert_called_once()
        assert (
            get_screenshot.call_args.kwargs["log_context"] == f"cache_key={cache_key}"
        )
        resize_image: MagicMock = mocks.get("resize_image")
        resize_image.assert_called_once()
        assert resize_image.call_args.kwargs["log_context"] == f"cache_key={cache_key}"

    def test_screenshot_error(self, mocker: MockerFixture, screenshot_obj):
        mocks = self._setup_compute_and_cache(mocker, screenshot_obj)
        get_screenshot: MagicMock = mocks.get("get_screenshot")
        get_screenshot.side_effect = Exception
        screenshot_obj.compute_and_cache(force=False)
        cache_payload: ScreenshotCachePayloadType = screenshot_obj.cache.get("key")
        assert cache_payload["status"] == "Error"

    def test_resize_error(self, mocker: MockerFixture, screenshot_obj):
        mocks = self._setup_compute_and_cache(mocker, screenshot_obj)
        resize_image: MagicMock = mocks.get("resize_image")
        resize_image.side_effect = Exception
        screenshot_obj.compute_and_cache(force=False)
        cache_payload: ScreenshotCachePayloadType = screenshot_obj.cache.get("key")
        assert cache_payload["status"] == "Error"

    def test_skips_if_computing(self, mocker: MockerFixture, screenshot_obj):
        mocks = self._setup_compute_and_cache(mocker, screenshot_obj)
        cached_value = ScreenshotCachePayload()
        cached_value.computing()
        get_from_cache_key = mocks.get("get_from_cache_key")
        get_from_cache_key.return_value = cached_value

        # Ensure that it skips when thumbnail status is computing
        screenshot_obj.compute_and_cache(force=False)
        get_screenshot = mocks.get("get_screenshot")
        get_screenshot.assert_not_called()

        # Ensure that it processes when force = True
        screenshot_obj.compute_and_cache(force=True)
        get_screenshot.assert_called_once()
        cache_payload: ScreenshotCachePayloadType = screenshot_obj.cache.get("key")
        assert cache_payload["status"] == "Updated"

    def test_skips_if_updated(self, mocker: MockerFixture, screenshot_obj):
        mocks = self._setup_compute_and_cache(mocker, screenshot_obj)
        cached_value = ScreenshotCachePayload(image=b"initial_value")
        get_from_cache_key = mocks.get("get_from_cache_key")
        get_from_cache_key.return_value = cached_value

        # Ensure that it skips when thumbnail status is updated
        window_size = thumb_size = (10, 10)
        screenshot_obj.compute_and_cache(
            force=False, window_size=window_size, thumb_size=thumb_size
        )
        get_screenshot = mocks.get("get_screenshot")
        get_screenshot.assert_not_called()

        # Ensure that it processes when force = True
        screenshot_obj.compute_and_cache(
            force=True, window_size=window_size, thumb_size=thumb_size
        )
        get_screenshot.assert_called_once()
        cache_payload: ScreenshotCachePayloadType = screenshot_obj.cache.get("key")
        assert cache_payload["image"] != b"initial_value"

    def test_recomputes_updated_entry_with_mismatched_scope(
        self, mocker: MockerFixture, screenshot_obj
    ):
        """A cache entry that already has a valid image but a scope that
        doesn't match this screenshot object's `cache_scope` (e.g. an entry
        written before scope tracking existed, or written for a different
        object) must be treated as a cache miss and recomputed -- otherwise
        it can never be re-stamped with the right scope and stays
        unservable forever."""
        mocks = self._setup_compute_and_cache(mocker, screenshot_obj)
        cached_value = ScreenshotCachePayload(image=b"initial_value")
        get_from_cache_key = mocks.get("get_from_cache_key")
        get_from_cache_key.return_value = cached_value

        screenshot_obj.cache_scope = "dashboard:5"
        screenshot_obj.compute_and_cache(force=False)

        get_screenshot = mocks.get("get_screenshot")
        get_screenshot.assert_called_once()
        cache_payload: ScreenshotCachePayloadType = screenshot_obj.cache.get("key")
        assert cache_payload["image"] != b"initial_value"
        assert cache_payload["scope"] == "dashboard:5"

    def test_resize(self, mocker: MockerFixture, screenshot_obj):
        mocks = self._setup_compute_and_cache(mocker, screenshot_obj)
        window_size = thumb_size = (10, 10)
        resize_image: MagicMock = mocks.get("resize_image")
        screenshot_obj.compute_and_cache(
            force=False, window_size=window_size, thumb_size=thumb_size
        )
        resize_image.assert_not_called()
        screenshot_obj.compute_and_cache(
            force=False, window_size=(1, 1), thumb_size=thumb_size
        )
        resize_image.assert_called_once()


class TestScreenshotCachePayloadGetImage:
    """Test the get_image method behavior including exception handling"""

    def test_get_image_returns_bytesio_when_image_exists(self):
        """Test that get_image returns BytesIO object when image data exists"""
        image_data = b"test image data"
        payload = ScreenshotCachePayload(image=image_data)

        result = payload.get_image()

        assert result is not None
        assert result.read() == image_data

    def test_get_image_raises_exception_when_no_image(self):
        """Test get_image raises ScreenshotImageNotAvailableException when no image"""
        from superset.exceptions import ScreenshotImageNotAvailableException

        payload = ScreenshotCachePayload()  # No image data

        with pytest.raises(ScreenshotImageNotAvailableException):
            payload.get_image()

    def test_get_image_raises_exception_when_image_is_none(self):
        """Test that get_image raises exception when image is explicitly set to None"""
        from superset.exceptions import ScreenshotImageNotAvailableException

        payload = ScreenshotCachePayload(image=None)

        with pytest.raises(ScreenshotImageNotAvailableException):
            payload.get_image()

    def test_get_image_multiple_reads(self):
        """Test that get_image returns fresh BytesIO each time"""
        image_data = b"test image data"
        payload = ScreenshotCachePayload(image=image_data)

        result1 = payload.get_image()
        result2 = payload.get_image()

        # Both should be valid BytesIO objects
        assert result1.read() == image_data
        assert result2.read() == image_data

        # Should be different BytesIO instances
        assert result1 is not result2


class TestScreenshotCachePayloadScope:
    """
    Cache entries are shared across every dashboard and chart in the same
    cache backend. `scope` records which object (e.g. "dashboard:5") an
    entry was actually rendered for, so a caller-supplied digest/cache_key
    can be checked against the object it's being used to authorize before
    serving the image.
    """

    def test_scope_defaults_to_none(self):
        payload = ScreenshotCachePayload(image=b"data")
        assert payload.get_scope() is None

    def test_set_scope(self):
        payload = ScreenshotCachePayload(image=b"data")
        payload.set_scope("dashboard:5")
        assert payload.get_scope() == "dashboard:5"

    def test_scope_round_trips_through_to_dict_from_dict(self):
        payload = ScreenshotCachePayload(image=b"data", scope="dashboard:5")
        restored = ScreenshotCachePayload.from_dict(payload.to_dict())
        assert restored.get_scope() == "dashboard:5"

    def test_legacy_dict_without_scope_key_tolerated(self):
        """A cache entry written before `scope` existed has no "scope" key at
        all -- from_dict must not raise and must report no scope rather than
        matching any caller-supplied scope."""
        legacy_dict: ScreenshotCachePayloadType = {
            "image": None,
            "timestamp": "2024-01-01T00:00:00",
            "status": "Updated",
        }  # type: ignore[typeddict-item]
        restored = ScreenshotCachePayload.from_dict(legacy_dict)
        assert restored.get_scope() is None

    def test_should_trigger_task_ignores_scope_by_default(self):
        """Without an `expected_scope`, an updated entry with a real image is
        never re-triggered -- existing (scope-agnostic) callers keep their
        current behavior."""
        payload = ScreenshotCachePayload(image=b"data", scope="dashboard:5")
        assert payload.should_trigger_task(force=False) is False

    def test_should_trigger_task_true_on_scope_mismatch(self):
        """An updated entry whose scope doesn't match what the caller expects
        (including a legacy entry with no scope at all) must be treated as a
        cache miss so it gets recomputed and re-scoped."""
        payload = ScreenshotCachePayload(image=b"data", scope=None)
        assert (
            payload.should_trigger_task(force=False, expected_scope="dashboard:5")
            is True
        )

        mismatched = ScreenshotCachePayload(image=b"data", scope="dashboard:6")
        assert (
            mismatched.should_trigger_task(force=False, expected_scope="dashboard:5")
            is True
        )

    def test_should_trigger_task_false_on_scope_match(self):
        payload = ScreenshotCachePayload(image=b"data", scope="dashboard:5")
        assert (
            payload.should_trigger_task(force=False, expected_scope="dashboard:5")
            is False
        )


class TestBaseScreenshotDriverFallback:
    """Test BaseScreenshot.driver() fallback logic for Playwright migration."""

    @patch("superset.utils.webdriver.PLAYWRIGHT_AVAILABLE", True)
    @patch("superset.extensions.feature_flag_manager.is_feature_enabled")
    def test_driver_returns_playwright_when_feature_enabled_and_available(
        self, mock_feature_flag, screenshot_obj
    ):
        """Test driver() returns WebDriverPlaywright when enabled and available."""
        mock_feature_flag.return_value = True

        driver = screenshot_obj.driver()

        assert driver.__class__.__name__ == "WebDriverPlaywright"

    @patch("superset.utils.webdriver.PLAYWRIGHT_AVAILABLE", True)
    @patch("superset.extensions.feature_flag_manager.is_feature_enabled")
    def test_driver_passes_window_size_to_playwright(
        self, mock_feature_flag, screenshot_obj
    ):
        """Test driver() passes window_size parameter to WebDriverPlaywright."""
        mock_feature_flag.return_value = True
        custom_window_size = (1200, 800)

        driver = screenshot_obj.driver(window_size=custom_window_size)

        assert driver._window == custom_window_size
        assert driver.__class__.__name__ == "WebDriverPlaywright"

    @patch("superset.utils.webdriver.PLAYWRIGHT_AVAILABLE", True)
    @patch("superset.extensions.feature_flag_manager.is_feature_enabled")
    def test_driver_uses_default_window_size_when_none_provided(
        self, mock_feature_flag, screenshot_obj
    ):
        """Test driver() uses screenshot object's window_size when none provided."""
        mock_feature_flag.return_value = True

        driver = screenshot_obj.driver()

        assert driver._window == screenshot_obj.window_size
        assert driver.__class__.__name__ == "WebDriverPlaywright"


class TestScreenshotSubclassesDriverBehavior:
    """Test ChartScreenshot inherits driver behavior."""

    @patch("superset.utils.webdriver.PLAYWRIGHT_AVAILABLE", True)
    @patch("superset.extensions.feature_flag_manager.is_feature_enabled")
    def test_chart_screenshot_uses_playwright_when_enabled(self, mock_feature_flag):
        """Test ChartScreenshot uses Playwright when feature enabled."""
        mock_feature_flag.return_value = True

        chart_screenshot = ChartScreenshot("http://example.com/chart", "digest")
        driver = chart_screenshot.driver()

        assert driver.__class__.__name__ == "WebDriverPlaywright"
        assert driver._window == chart_screenshot.window_size

    @patch("superset.utils.webdriver.PLAYWRIGHT_AVAILABLE", True)
    @patch("superset.extensions.feature_flag_manager.is_feature_enabled")
    def test_custom_window_size_passed_to_driver(self, mock_feature_flag):
        """Test custom window size is passed correctly to driver."""
        mock_feature_flag.return_value = True
        custom_window_size = (1920, 1080)
        custom_thumb_size = (960, 540)

        chart_screenshot = ChartScreenshot(
            "http://example.com/chart",
            "digest",
            window_size=custom_window_size,
            thumb_size=custom_thumb_size,
        )

        driver = chart_screenshot.driver()

        assert driver._window == custom_window_size
        assert chart_screenshot.thumb_size == custom_thumb_size
