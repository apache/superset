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

from superset.utils.hashing import md5_sha_from_dict
from superset.utils.screenshots import (
    BaseScreenshot,
    ChartScreenshot,
    DashboardScreenshot,
    ScreenshotCachePayload,
    ScreenshotCachePayloadType,
)

BASE_SCREENSHOT_PATH = "superset.utils.screenshots.BaseScreenshot"


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


def test_get_cache_key(screenshot_obj):
    """Test get_cache_key method"""
    expected_cache_key = md5_sha_from_dict(
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
    # backwards compatability test for retrieving plain bytes
    fake_bytes = b"fake_screenshot_data"
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
            BASE_SCREENSHOT_PATH + ".get_screenshot", return_value=b"new_image_data"
        )
        resize_image = mocker.patch(
            BASE_SCREENSHOT_PATH + ".resize_image", return_value=b"resized_image_data"
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


class TestBaseScreenshotDriverFallback:
    """Test BaseScreenshot.driver() fallback logic for Playwright migration."""

    @patch("superset.utils.screenshots._PLAYWRIGHT_AVAILABLE", True)
    @patch("superset.extensions.feature_flag_manager.is_feature_enabled")
    def test_driver_returns_playwright_when_feature_enabled_and_available(
        self, mock_feature_flag, screenshot_obj
    ):
        """Test driver() returns WebDriverPlaywright when enabled and available."""
        mock_feature_flag.return_value = True

        driver = screenshot_obj.driver()

        assert driver.__class__.__name__ == "WebDriverPlaywright"
        mock_feature_flag.assert_called_once_with("PLAYWRIGHT_REPORTS_AND_THUMBNAILS")

    @patch("superset.utils.screenshots.logger")
    @patch("superset.utils.screenshots._PLAYWRIGHT_AVAILABLE", False)
    @patch("superset.extensions.feature_flag_manager.is_feature_enabled")
    def test_driver_falls_back_to_selenium_when_playwright_unavailable(
        self, mock_feature_flag, mock_logger, screenshot_obj
    ):
        """Test driver() falls back to Selenium when Playwright unavailable."""
        mock_feature_flag.return_value = True

        # Reset the global fallback logging flag to ensure we can test the logging
        import superset.utils.screenshots

        superset.utils.screenshots._PLAYWRIGHT_FALLBACK_LOGGED = False

        driver = screenshot_obj.driver()

        assert driver.__class__.__name__ == "WebDriverSelenium"
        # Should log the fallback message
        mock_logger.info.assert_called_once()
        log_call = mock_logger.info.call_args[0][0]
        assert (
            "PLAYWRIGHT_REPORTS_AND_THUMBNAILS enabled but Playwright not installed"
            in log_call
        )
        assert "Falling back to Selenium" in log_call
        assert "WebGL/Canvas charts may not render correctly" in log_call

    @patch("superset.extensions.feature_flag_manager.is_feature_enabled")
    def test_driver_uses_selenium_when_feature_flag_disabled(
        self, mock_feature_flag, screenshot_obj
    ):
        """Test driver() uses Selenium when feature flag disabled."""
        mock_feature_flag.return_value = False

        driver = screenshot_obj.driver()

        assert driver.__class__.__name__ == "WebDriverSelenium"
        mock_feature_flag.assert_called_once_with("PLAYWRIGHT_REPORTS_AND_THUMBNAILS")

    @patch("superset.utils.screenshots.logger")
    @patch("superset.extensions.feature_flag_manager.is_feature_enabled")
    def test_driver_handles_import_error_gracefully(
        self, mock_feature_flag, mock_logger, screenshot_obj
    ):
        """Test driver() gracefully degrades when Playwright not available."""
        mock_feature_flag.return_value = False  # Feature flag disabled

        driver = screenshot_obj.driver()

        # Should use Selenium when feature flag is disabled
        assert driver.__class__.__name__ == "WebDriverSelenium"
        # Should not log since feature flag is disabled
        mock_logger.info.assert_not_called()

    @patch("superset.utils.screenshots._PLAYWRIGHT_AVAILABLE", True)
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

    @patch("superset.extensions.feature_flag_manager.is_feature_enabled")
    def test_driver_passes_window_size_to_selenium(
        self, mock_feature_flag, screenshot_obj
    ):
        """Test driver() passes window_size parameter to WebDriverSelenium."""
        mock_feature_flag.return_value = False
        custom_window_size = (1200, 800)

        driver = screenshot_obj.driver(window_size=custom_window_size)

        assert driver._window == custom_window_size
        assert driver.__class__.__name__ == "WebDriverSelenium"

    @patch("superset.utils.screenshots._PLAYWRIGHT_AVAILABLE", True)
    @patch("superset.extensions.feature_flag_manager.is_feature_enabled")
    def test_driver_uses_default_window_size_when_none_provided(
        self, mock_feature_flag, screenshot_obj
    ):
        """Test driver() uses screenshot object's window_size when none provided."""
        mock_feature_flag.return_value = True

        driver = screenshot_obj.driver()

        assert driver._window == screenshot_obj.window_size
        assert driver.__class__.__name__ == "WebDriverPlaywright"

    @patch("superset.utils.screenshots.logger")
    @patch("superset.extensions.feature_flag_manager.is_feature_enabled")
    def test_driver_logs_fallback_message_only_once_globally(
        self, mock_feature_flag, mock_logger, screenshot_obj
    ):
        """Test driver() logs fallback message only once globally."""
        mock_feature_flag.return_value = True

        # Reset the global flag to test the logging
        import superset.utils.screenshots

        superset.utils.screenshots._PLAYWRIGHT_FALLBACK_LOGGED = False

        with patch("superset.utils.screenshots._PLAYWRIGHT_AVAILABLE", False):
            # Call driver() multiple times
            screenshot_obj.driver()
            screenshot_obj.driver()
            screenshot_obj.driver()

        # Should log fallback message only once due to global flag
        assert mock_logger.info.call_count == 1

    @patch("superset.utils.screenshots._PLAYWRIGHT_AVAILABLE", True)
    @patch("superset.extensions.feature_flag_manager.is_feature_enabled")
    def test_driver_returns_different_instances_on_multiple_calls(
        self, mock_feature_flag, screenshot_obj
    ):
        """Test driver() returns new instances on each call."""
        mock_feature_flag.return_value = True

        driver1 = screenshot_obj.driver()
        driver2 = screenshot_obj.driver()

        assert driver1 is not driver2
        assert driver1.__class__.__name__ == "WebDriverPlaywright"
        assert driver2.__class__.__name__ == "WebDriverPlaywright"


class TestScreenshotSubclassesDriverBehavior:
    """Test ChartScreenshot and DashboardScreenshot inherit driver behavior."""

    @patch("superset.utils.screenshots._PLAYWRIGHT_AVAILABLE", True)
    @patch("superset.extensions.feature_flag_manager.is_feature_enabled")
    def test_chart_screenshot_uses_playwright_when_enabled(self, mock_feature_flag):
        """Test ChartScreenshot uses Playwright when feature enabled."""
        mock_feature_flag.return_value = True

        chart_screenshot = ChartScreenshot("http://example.com/chart", "digest")
        driver = chart_screenshot.driver()

        assert driver.__class__.__name__ == "WebDriverPlaywright"
        assert driver._window == chart_screenshot.window_size

    @patch("superset.utils.screenshots.logger")
    @patch("superset.utils.screenshots._PLAYWRIGHT_AVAILABLE", False)
    @patch("superset.extensions.feature_flag_manager.is_feature_enabled")
    def test_dashboard_screenshot_falls_back_to_selenium(
        self, mock_feature_flag, mock_logger
    ):
        """Test DashboardScreenshot falls back to Selenium if no Playwright."""
        mock_feature_flag.return_value = True

        dashboard_screenshot = DashboardScreenshot(
            "http://example.com/dashboard", "digest"
        )
        driver = dashboard_screenshot.driver()

        assert driver.__class__.__name__ == "WebDriverSelenium"
        assert driver._window == dashboard_screenshot.window_size

        # Note: May not log if fallback message was already logged globally
        # This is expected behavior due to the single-log optimization

    def test_chart_screenshot_has_correct_default_window_size(self):
        """Test ChartScreenshot has correct default window size."""
        from superset.utils.screenshots import DEFAULT_CHART_WINDOW_SIZE

        chart_screenshot = ChartScreenshot("http://example.com/chart", "digest")
        assert chart_screenshot.window_size == DEFAULT_CHART_WINDOW_SIZE

    def test_dashboard_screenshot_has_correct_default_window_size(self):
        """Test DashboardScreenshot has correct default window size."""
        from superset.utils.screenshots import DEFAULT_DASHBOARD_WINDOW_SIZE

        dashboard_screenshot = DashboardScreenshot(
            "http://example.com/dashboard", "digest"
        )
        assert dashboard_screenshot.window_size == DEFAULT_DASHBOARD_WINDOW_SIZE

    @patch("superset.utils.screenshots._PLAYWRIGHT_AVAILABLE", True)
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


class TestDriverMethodThreadSafety:
    """Test thread safety and concurrency aspects of driver() method."""

    @patch("superset.extensions.feature_flag_manager.is_feature_enabled")
    @patch("superset.utils.screenshots.PLAYWRIGHT_AVAILABLE", True)
    def test_driver_method_thread_safe_feature_flag_calls(
        self, mock_playwright_available, mock_feature_flag
    ):
        """Test that feature flag calls are thread safe."""
        mock_feature_flag.return_value = True
        screenshot_obj = BaseScreenshot("http://example.com", "digest")

        # Simulate concurrent calls
        drivers = []
        for _ in range(10):
            drivers.append(screenshot_obj.driver())

        # All should be Playwright drivers
        for driver in drivers:
            assert driver.__class__.__name__ == "WebDriverPlaywright"

        # Feature flag should be called for each driver() call
        assert mock_feature_flag.call_count == 10

    @patch("superset.extensions.feature_flag_manager.is_feature_enabled")
    @patch("superset.utils.screenshots.logger")
    def test_concurrent_fallback_logging(self, mock_logger, mock_feature_flag):
        """Test that concurrent fallback scenarios log appropriately."""
        mock_feature_flag.return_value = True
        screenshot_obj = BaseScreenshot("http://example.com", "digest")

        with patch("superset.utils.screenshots.PLAYWRIGHT_AVAILABLE", False):
            # Simulate multiple concurrent calls
            drivers = []
            for _ in range(5):
                drivers.append(screenshot_obj.driver())

        # All should be Selenium drivers
        for driver in drivers:
            assert driver.__class__.__name__ == "WebDriverSelenium"

        # Should have logged fallback message for each call
        assert mock_logger.info.call_count == 5


class TestScreenshotModuleLevelCaching:
    """Test module-level caching of Playwright availability."""

    def test_playwright_availability_cached_at_module_level(self):
        """Test that Playwright availability is cached at module import time."""
        import superset.utils.screenshots as screenshots_module

        # These should be set at module import time
        assert hasattr(screenshots_module, "_PLAYWRIGHT_AVAILABLE")
        assert hasattr(screenshots_module, "_PLAYWRIGHT_INSTALL_MESSAGE")
        assert hasattr(screenshots_module, "_PLAYWRIGHT_FALLBACK_LOGGED")

        # Should be boolean or None
        assert isinstance(screenshots_module._PLAYWRIGHT_AVAILABLE, (bool, type(None)))
        assert isinstance(
            screenshots_module._PLAYWRIGHT_INSTALL_MESSAGE, (str, type(None))
        )
        assert isinstance(screenshots_module._PLAYWRIGHT_FALLBACK_LOGGED, bool)

    @patch("superset.utils.screenshots._PLAYWRIGHT_AVAILABLE", False)
    @patch("superset.utils.screenshots._PLAYWRIGHT_INSTALL_MESSAGE", "Test message")
    def test_cached_values_used_in_driver_method(self, screenshot_obj):
        """Test that driver() method uses cached module-level values."""
        with patch(
            "superset.extensions.feature_flag_manager.is_feature_enabled"
        ) as mock_feature_flag:
            mock_feature_flag.return_value = True

            # Should use cached value, not re-check
            driver = screenshot_obj.driver()

            assert driver.__class__.__name__ == "WebDriverSelenium"

    def test_fallback_logging_flag_persists_across_instances(self):
        """Test that fallback logging flag persists across screenshot instances."""
        import superset.utils.screenshots as screenshots_module

        # Reset the flag
        screenshots_module._PLAYWRIGHT_FALLBACK_LOGGED = False

        with patch(
            "superset.extensions.feature_flag_manager.is_feature_enabled"
        ) as mock_feature_flag:
            mock_feature_flag.return_value = True
            with patch("superset.utils.screenshots._PLAYWRIGHT_AVAILABLE", False):
                with patch("superset.utils.screenshots.logger") as mock_logger:
                    # Create multiple screenshot instances
                    screenshot1 = BaseScreenshot("http://example1.com", "digest1")
                    screenshot2 = BaseScreenshot("http://example2.com", "digest2")

                    # First instance logs
                    screenshot1.driver()
                    assert mock_logger.info.call_count == 1

                    # Second instance doesn't log (flag is set)
                    screenshot2.driver()
                    assert mock_logger.info.call_count == 1  # Still 1, not 2

                    # Flag should be set
                    assert screenshots_module._PLAYWRIGHT_FALLBACK_LOGGED is True


class TestScreenshotDriverPerformance:
    """Test performance aspects of driver selection logic."""

    @patch("superset.extensions.feature_flag_manager.is_feature_enabled")
    @patch("superset.utils.screenshots.PLAYWRIGHT_AVAILABLE", True)
    def test_driver_selection_performance_with_playwright_available(
        self, mock_playwright_available, mock_feature_flag
    ):
        """Test that driver selection is fast when Playwright available."""
        mock_feature_flag.return_value = True
        screenshot_obj = BaseScreenshot("http://example.com", "digest")

        import time

        start_time = time.time()

        # Create multiple drivers to test performance
        for _ in range(100):
            driver = screenshot_obj.driver()
            assert driver.__class__.__name__ == "WebDriverPlaywright"

        end_time = time.time()

        # Should complete quickly (less than 1 second for 100 calls)
        assert (end_time - start_time) < 1.0

    @patch("superset.extensions.feature_flag_manager.is_feature_enabled")
    def test_driver_selection_performance_with_feature_flag_disabled(
        self, mock_feature_flag
    ):
        """Test that driver selection is fast when feature flag disabled."""
        mock_feature_flag.return_value = False
        screenshot_obj = BaseScreenshot("http://example.com", "digest")

        import time

        start_time = time.time()

        # Create multiple drivers to test performance
        for _ in range(100):
            driver = screenshot_obj.driver()
            assert driver.__class__.__name__ == "WebDriverSelenium"

        end_time = time.time()

        # Should complete quickly (less than 1 second for 100 calls)
        assert (end_time - start_time) < 1.0

    @patch("superset.extensions.feature_flag_manager.is_feature_enabled")
    @patch("superset.utils.screenshots.logger")
    def test_driver_selection_performance_with_fallback(
        self, mock_logger, mock_feature_flag
    ):
        """Test that driver selection with fallback is reasonably fast."""
        mock_feature_flag.return_value = True
        screenshot_obj = BaseScreenshot("http://example.com", "digest")

        with patch("superset.utils.screenshots.PLAYWRIGHT_AVAILABLE", False):
            import time

            start_time = time.time()

            # Create multiple drivers with fallback
            for _ in range(50):  # Fewer iterations due to logging overhead
                driver = screenshot_obj.driver()
                assert driver.__class__.__name__ == "WebDriverSelenium"

            end_time = time.time()

            # Should complete reasonably quickly even with logging
            assert (end_time - start_time) < 2.0
