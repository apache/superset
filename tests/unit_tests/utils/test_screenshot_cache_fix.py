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

"""
Tests for screenshot cache bug fixes:
1. Cache only saved when image generation succeeds
2. Recompute stale COMPUTING tasks and UPDATED without image
"""

from datetime import datetime, timedelta
from unittest.mock import MagicMock, patch

import pytest
from pytest_mock import MockerFixture

from superset.utils.screenshots import (
    BaseScreenshot,
    ScreenshotCachePayload,
    StatusValues,
)

BASE_SCREENSHOT_PATH = "superset.utils.screenshots.BaseScreenshot"


class MockCache:
    """A class to manage screenshot cache for testing."""

    def __init__(self):
        self._cache = {}

    def set(self, key, value):
        """Set the cache with a new value."""
        self._cache[key] = value

    def get(self, key):
        """Get the cached value."""
        return self._cache.get(key)

    def clear(self):
        """Clear all cached values."""
        self._cache.clear()


@pytest.fixture
def mock_user():
    """Fixture to create a mock user."""
    user = MagicMock()
    user.id = 1
    return user


@pytest.fixture
def screenshot_obj():
    """Fixture to create a BaseScreenshot object."""
    url = "http://example.com"
    digest = "sample_digest"
    return BaseScreenshot(url, digest)


class TestCacheOnlyOnSuccess:
    """Test that cache is only saved when image generation succeeds."""

    def _setup_mocks(self, mocker: MockerFixture, screenshot_obj):
        """Helper method to set up common mocks."""
        mocker.patch(BASE_SCREENSHOT_PATH + ".get_from_cache_key", return_value=None)
        get_screenshot = mocker.patch(
            BASE_SCREENSHOT_PATH + ".get_screenshot", return_value=b"image_data"
        )
        # Mock resize_image to avoid PIL errors with fake image data
        mocker.patch(
            BASE_SCREENSHOT_PATH + ".resize_image", return_value=b"resized_image_data"
        )
        BaseScreenshot.cache = MockCache()
        return get_screenshot

    def test_cache_error_status_when_screenshot_fails(
        self, mocker: MockerFixture, screenshot_obj, mock_user
    ):
        """Test that error status is cached when screenshot generation fails."""
        mocker.patch(BASE_SCREENSHOT_PATH + ".get_from_cache_key", return_value=None)
        get_screenshot = mocker.patch(
            BASE_SCREENSHOT_PATH + ".get_screenshot",
            side_effect=Exception("Screenshot failed"),
        )
        BaseScreenshot.cache = MockCache()

        # Execute compute_and_cache
        screenshot_obj.compute_and_cache(user=mock_user, force=True)

        # Verify get_screenshot was called
        get_screenshot.assert_called_once()

        # Cache should be set with ERROR status (to prevent immediate retries)
        cache_key = screenshot_obj.get_cache_key()
        cached_value = BaseScreenshot.cache.get(cache_key)
        assert cached_value is not None
        assert cached_value["status"] == "Error"
        assert cached_value.get("image") is None

    def test_cache_error_status_when_resize_fails(
        self, mocker: MockerFixture, screenshot_obj, mock_user
    ):
        """Test that error status is cached when image resize fails."""
        self._setup_mocks(mocker, screenshot_obj)
        mocker.patch(
            BASE_SCREENSHOT_PATH + ".resize_image",
            side_effect=Exception("Resize failed"),
        )

        # Use different window and thumb sizes to trigger resize
        screenshot_obj.compute_and_cache(
            user=mock_user, force=True, window_size=(800, 600), thumb_size=(400, 300)
        )

        # Cache should be set with ERROR status (to prevent immediate retries)
        cache_key = screenshot_obj.get_cache_key()
        cached_value = BaseScreenshot.cache.get(cache_key)
        assert cached_value is not None
        assert cached_value["status"] == "Error"
        assert cached_value.get("image") is None

    def test_cache_saved_only_when_image_generated(
        self, mocker: MockerFixture, screenshot_obj, mock_user
    ):
        """Test that cache is only saved when image is successfully generated."""
        self._setup_mocks(mocker, screenshot_obj)

        # Execute compute_and_cache
        screenshot_obj.compute_and_cache(user=mock_user, force=True)

        # Cache should be set with UPDATED status and image
        cache_key = screenshot_obj.get_cache_key()
        cached_value = BaseScreenshot.cache.get(cache_key)
        assert cached_value is not None
        assert cached_value["status"] == "Updated"
        assert cached_value["image"] is not None

    def test_no_intermediate_cache_during_computing(
        self, mocker: MockerFixture, screenshot_obj, mock_user
    ):
        """Test that cache is not saved during COMPUTING state."""
        mocker.patch(BASE_SCREENSHOT_PATH + ".get_from_cache_key", return_value=None)
        BaseScreenshot.cache = MockCache()

        # Mock get_screenshot to check cache state during execution
        def check_cache_during_screenshot(*args, **kwargs):
            # At this point, we're in COMPUTING state
            # Cache should NOT be set yet
            cache_key = screenshot_obj.get_cache_key()
            cached_value = BaseScreenshot.cache.get(cache_key)
            # Cache should be empty during screenshot generation
            assert cached_value is None, (
                "Cache should not be saved during COMPUTING state"
            )
            return b"image_data"

        mocker.patch(
            BASE_SCREENSHOT_PATH + ".get_screenshot",
            side_effect=check_cache_during_screenshot,
        )
        # Mock resize to avoid PIL errors with fake image data
        mocker.patch(
            BASE_SCREENSHOT_PATH + ".resize_image", return_value=b"resized_image_data"
        )

        # Execute compute_and_cache
        screenshot_obj.compute_and_cache(user=mock_user, force=True)

        # After completion, cache should be set with UPDATED status
        cache_key = screenshot_obj.get_cache_key()
        cached_value = BaseScreenshot.cache.get(cache_key)
        assert cached_value is not None
        assert cached_value["status"] == "Updated"


class TestShouldTriggerTask:
    """Test the should_trigger_task method improvements."""

    @patch("superset.utils.screenshots.app")
    def test_trigger_on_stale_computing_status(self, mock_app):
        """Test that stale COMPUTING status triggers recomputation."""
        # Set TTL to 300 seconds
        mock_app.config = {"THUMBNAIL_ERROR_CACHE_TTL": 300}

        # Create payload with COMPUTING status from 400 seconds ago (stale)
        old_timestamp = (datetime.now() - timedelta(seconds=400)).isoformat()
        payload = ScreenshotCachePayload(
            status=StatusValues.COMPUTING, timestamp=old_timestamp
        )

        # Should trigger task because COMPUTING is stale
        assert payload.should_trigger_task(force=False) is True

    @patch("superset.utils.screenshots.app")
    def test_no_trigger_on_fresh_computing_status(self, mock_app):
        """Test that fresh COMPUTING status does not trigger recomputation."""
        # Set TTL to 300 seconds
        mock_app.config = {"THUMBNAIL_ERROR_CACHE_TTL": 300}

        # Create payload with COMPUTING status from 100 seconds ago (fresh)
        fresh_timestamp = (datetime.now() - timedelta(seconds=100)).isoformat()
        payload = ScreenshotCachePayload(
            status=StatusValues.COMPUTING, timestamp=fresh_timestamp
        )

        # Should NOT trigger task because COMPUTING is still fresh
        assert payload.should_trigger_task(force=False) is False

    def test_trigger_on_updated_without_image(self):
        """Test that UPDATED status without image triggers recomputation."""
        # Create payload with UPDATED status but no image
        # This simulates the bug where cache was saved without an image
        payload = ScreenshotCachePayload(image=None, status=StatusValues.UPDATED)

        # Should trigger task because UPDATED but has no image
        assert payload.should_trigger_task(force=False) is True

    def test_no_trigger_on_updated_with_image(self):
        """Test that UPDATED status with image does not trigger recomputation."""
        # Create payload with UPDATED status and valid image
        payload = ScreenshotCachePayload(image=b"valid_image_data")

        # Should NOT trigger task because UPDATED with valid image
        assert payload.should_trigger_task(force=False) is False

    def test_trigger_on_pending_status(self):
        """Test that PENDING status triggers task."""
        payload = ScreenshotCachePayload(status=StatusValues.PENDING)

        assert payload.should_trigger_task(force=False) is True

    @patch("superset.utils.screenshots.app")
    def test_trigger_on_expired_error(self, mock_app):
        """Test that expired ERROR status triggers task."""
        # Set TTL to 300 seconds
        mock_app.config = {"THUMBNAIL_ERROR_CACHE_TTL": 300}

        # Create payload with ERROR status from 400 seconds ago (expired)
        old_timestamp = (datetime.now() - timedelta(seconds=400)).isoformat()
        payload = ScreenshotCachePayload(
            status=StatusValues.ERROR, timestamp=old_timestamp
        )

        assert payload.should_trigger_task(force=False) is True

    @patch("superset.utils.screenshots.app")
    def test_no_trigger_on_fresh_error(self, mock_app):
        """Test that fresh ERROR status does not trigger task."""
        # Set TTL to 300 seconds
        mock_app.config = {"THUMBNAIL_ERROR_CACHE_TTL": 300}

        # Create payload with ERROR status from 100 seconds ago (fresh)
        fresh_timestamp = (datetime.now() - timedelta(seconds=100)).isoformat()
        payload = ScreenshotCachePayload(
            status=StatusValues.ERROR, timestamp=fresh_timestamp
        )

        assert payload.should_trigger_task(force=False) is False

    def test_force_always_triggers(self):
        """Test that force=True always triggers task regardless of status."""
        # Test with UPDATED + image (normally wouldn't trigger)
        payload_updated = ScreenshotCachePayload(image=b"image_data")
        assert payload_updated.should_trigger_task(force=True) is True

        # Test with fresh COMPUTING (normally wouldn't trigger)
        payload_computing = ScreenshotCachePayload(status=StatusValues.COMPUTING)
        assert payload_computing.should_trigger_task(force=True) is True


class TestIsComputingStale:
    """Test the is_computing_stale method."""

    @patch("superset.utils.screenshots.app")
    def test_computing_is_stale(self, mock_app):
        """Test that old COMPUTING status is detected as stale."""
        mock_app.config = {"THUMBNAIL_ERROR_CACHE_TTL": 300}

        # Timestamp from 400 seconds ago
        old_timestamp = (datetime.now() - timedelta(seconds=400)).isoformat()
        payload = ScreenshotCachePayload(
            status=StatusValues.COMPUTING, timestamp=old_timestamp
        )

        assert payload.is_computing_stale() is True

    @patch("superset.utils.screenshots.app")
    def test_computing_is_not_stale(self, mock_app):
        """Test that fresh COMPUTING status is not stale."""
        mock_app.config = {"THUMBNAIL_ERROR_CACHE_TTL": 300}

        # Timestamp from 100 seconds ago
        fresh_timestamp = (datetime.now() - timedelta(seconds=100)).isoformat()
        payload = ScreenshotCachePayload(
            status=StatusValues.COMPUTING, timestamp=fresh_timestamp
        )

        assert payload.is_computing_stale() is False

    @patch("superset.utils.screenshots.app")
    def test_computing_exactly_at_ttl(self, mock_app):
        """Test boundary condition at exactly TTL."""
        mock_app.config = {"THUMBNAIL_ERROR_CACHE_TTL": 300}

        # Timestamp from exactly 300 seconds ago
        exact_timestamp = (datetime.now() - timedelta(seconds=300)).isoformat()
        payload = ScreenshotCachePayload(
            status=StatusValues.COMPUTING, timestamp=exact_timestamp
        )

        # At exactly TTL, should be stale (>= TTL)
        assert payload.is_computing_stale() is True

    @patch("superset.utils.screenshots.app")
    def test_computing_just_past_ttl(self, mock_app):
        """Test boundary condition just past TTL."""
        mock_app.config = {"THUMBNAIL_ERROR_CACHE_TTL": 300}

        # Timestamp from 301 seconds ago (just past TTL)
        past_ttl_timestamp = (datetime.now() - timedelta(seconds=301)).isoformat()
        payload = ScreenshotCachePayload(
            status=StatusValues.COMPUTING, timestamp=past_ttl_timestamp
        )

        # Just past TTL should be stale
        assert payload.is_computing_stale() is True


class TestIntegrationCacheBugFix:
    """Integration tests combining both fixes."""

    def test_failed_screenshot_does_not_pollute_cache(
        self, mocker: MockerFixture, screenshot_obj, mock_user
    ):
        """
        Integration test: Failed screenshot should cache error status
        to prevent immediate retries, not leave corrupted cache with image=None.
        """
        mocker.patch(
            BASE_SCREENSHOT_PATH + ".get_screenshot",
            side_effect=Exception("Network error"),
        )
        BaseScreenshot.cache = MockCache()

        # First attempt fails
        screenshot_obj.compute_and_cache(user=mock_user, force=True)

        # Verify cache contains ERROR status (prevents immediate retry)
        cache_key = screenshot_obj.get_cache_key()
        cached_value = BaseScreenshot.cache.get(cache_key)
        assert cached_value is not None
        assert cached_value["status"] == "Error"
        assert cached_value.get("image") is None

        # Cache entry should not trigger task immediately (error is fresh)
        cached_payload = screenshot_obj.get_from_cache_key(cache_key)
        assert cached_payload is not None
        assert cached_payload.should_trigger_task(force=False) is False

    @patch("superset.utils.screenshots.app")
    def test_stale_computing_triggers_retry(
        self, mock_app, mocker: MockerFixture, screenshot_obj, mock_user
    ):
        """
        Integration test: Stale COMPUTING status should trigger retry
        to recover from stuck tasks.
        """
        mock_app.config = {"THUMBNAIL_ERROR_CACHE_TTL": 300}
        BaseScreenshot.cache = MockCache()

        # Create stale COMPUTING entry and seed it in the cache
        old_timestamp = (datetime.now() - timedelta(seconds=400)).isoformat()
        stale_payload = ScreenshotCachePayload(
            status=StatusValues.COMPUTING, timestamp=old_timestamp
        )
        cache_key = screenshot_obj.get_cache_key()
        BaseScreenshot.cache.set(cache_key, stale_payload.to_dict())

        mocker.patch(
            BASE_SCREENSHOT_PATH + ".get_screenshot", return_value=b"recovered_image"
        )
        # Mock resize to avoid PIL errors
        mocker.patch(
            BASE_SCREENSHOT_PATH + ".resize_image", return_value=b"resized_image"
        )

        # Should trigger task because COMPUTING is stale
        assert stale_payload.should_trigger_task() is True

        # Retry should succeed and update cache
        screenshot_obj.compute_and_cache(user=mock_user, force=False)

        cached_value = BaseScreenshot.cache.get(cache_key)
        assert cached_value is not None
        assert cached_value["status"] == "Updated"
        assert cached_value["image"] is not None
