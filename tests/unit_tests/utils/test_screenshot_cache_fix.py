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

from superset.exceptions import (
    AcquireDistributedLockFailedException,
    LockAlreadyHeldException,
    ReleaseDistributedLockFailedException,
)
from superset.utils.screenshots import (
    BaseScreenshot,
    ScreenshotCachePayload,
    ScreenshotCacheWriteError,
    StatusValues,
)

BASE_SCREENSHOT_PATH = "superset.utils.screenshots.BaseScreenshot"
DISTRIBUTED_LOCK_PATH = "superset.utils.screenshots.DistributedLock"

# A minimal valid PNG header, used wherever a test needs bytes that pass
# ScreenshotCachePayload's image validation.
FAKE_PNG_BYTES = b"\x89PNG\r\n\x1a\n" + b"fake-png-body"


class MockCache:
    """A class to manage screenshot cache for testing."""

    def __init__(self):
        self._cache = {}
        self.cache = self

    def set(self, key, value):
        """Set the cache with a new value."""
        self._cache[key] = value

    def get(self, key):
        """Get the cached value."""
        return self._cache.get(key)

    def clear(self):
        """Clear all cached values."""
        self._cache.clear()


class RejectImageCache(MockCache):
    """Simulate a backend that rejects only oversized image payloads."""

    def set(self, key, value):
        if value.get("image") is not None:
            return False
        self._cache[key] = value
        return True


class ReleaseFailingLock:
    """Lock double whose body succeeds but release reports a backend error."""

    def __enter__(self) -> None:
        return None

    def __exit__(self, *args: object) -> None:
        raise ReleaseDistributedLockFailedException("release failed")


@pytest.fixture
def mock_user() -> MagicMock:
    """Fixture to create a mock user."""
    user = MagicMock()
    user.id = 1
    return user


@pytest.fixture
def screenshot_obj() -> BaseScreenshot:
    """Fixture to create a BaseScreenshot object."""
    url = "http://example.com"
    digest = "sample_digest"
    return BaseScreenshot(url, digest)


class TestCacheOnlyOnSuccess:
    """Test that cache is only saved when image generation succeeds."""

    def _setup_mocks(
        self, mocker: MockerFixture, screenshot_obj: BaseScreenshot
    ) -> MagicMock:
        """Helper method to set up common mocks."""
        mocker.patch(DISTRIBUTED_LOCK_PATH)
        mocker.patch(BASE_SCREENSHOT_PATH + ".get_from_cache_key", return_value=None)
        get_screenshot = mocker.patch(
            BASE_SCREENSHOT_PATH + ".get_screenshot", return_value=FAKE_PNG_BYTES
        )
        # Mock resize_image to avoid PIL errors with fake image data
        mocker.patch(
            BASE_SCREENSHOT_PATH + ".resize_image", return_value=FAKE_PNG_BYTES
        )
        BaseScreenshot.cache = MockCache()
        return get_screenshot

    def test_cache_error_status_when_screenshot_fails(
        self, mocker: MockerFixture, screenshot_obj, mock_user
    ):
        """Test that error status is cached when screenshot generation fails."""
        mocker.patch(DISTRIBUTED_LOCK_PATH)
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

    def test_cache_error_status_when_screenshot_returns_empty_bytes(
        self,
        mocker: MockerFixture,
        screenshot_obj: BaseScreenshot,
        mock_user: MagicMock,
    ) -> None:
        """Empty bytes from get_screenshot must set ERROR, not leave COMPUTING,
        and must log a WARNING that includes the cache key."""
        mocker.patch(DISTRIBUTED_LOCK_PATH)
        mocker.patch(BASE_SCREENSHOT_PATH + ".get_from_cache_key", return_value=None)
        mocker.patch(
            BASE_SCREENSHOT_PATH + ".get_screenshot",
            return_value=b"",
        )
        mock_logger = mocker.patch("superset.utils.screenshots.logger")
        BaseScreenshot.cache = MockCache()

        screenshot_obj.compute_and_cache(user=mock_user, force=True)

        cache_key = screenshot_obj.get_cache_key()
        cached_value = BaseScreenshot.cache.get(cache_key)
        assert cached_value is not None
        assert cached_value["status"] == "Error"
        assert cached_value.get("image") is None
        assert any(
            cache_key in call.args and "empty" in call.args
            for call in mock_logger.warning.call_args_list
        )

    def test_cache_error_status_when_screenshot_returns_garbage_bytes(
        self,
        mocker: MockerFixture,
        screenshot_obj: BaseScreenshot,
        mock_user: MagicMock,
    ) -> None:
        """Non-empty bytes without a valid image header must set ERROR, not be
        cached as a success, and must log a WARNING that includes the cache key."""
        mocker.patch(DISTRIBUTED_LOCK_PATH)
        mocker.patch(BASE_SCREENSHOT_PATH + ".get_from_cache_key", return_value=None)
        mocker.patch(
            BASE_SCREENSHOT_PATH + ".get_screenshot",
            return_value=b"this-is-not-a-real-image",
        )
        mocker.patch(
            BASE_SCREENSHOT_PATH + ".resize_image",
            return_value=b"this-is-not-a-real-image",
        )
        mock_logger = mocker.patch("superset.utils.screenshots.logger")
        BaseScreenshot.cache = MockCache()

        screenshot_obj.compute_and_cache(user=mock_user, force=True)

        cache_key = screenshot_obj.get_cache_key()
        cached_value = BaseScreenshot.cache.get(cache_key)
        assert cached_value is not None
        assert cached_value["status"] == "Error"
        assert cached_value.get("image") is None
        assert any(
            cache_key in call.args and "undecodable" in call.args
            for call in mock_logger.warning.call_args_list
        )

    def test_computing_status_written_to_cache_early(
        self,
        mocker: MockerFixture,
        screenshot_obj: BaseScreenshot,
        mock_user: MagicMock,
    ) -> None:
        """compute_and_cache writes COMPUTING to cache before taking the screenshot
        so concurrent tasks can detect it and avoid duplicate work."""
        mocker.patch(DISTRIBUTED_LOCK_PATH)
        mocker.patch(BASE_SCREENSHOT_PATH + ".get_from_cache_key", return_value=None)
        BaseScreenshot.cache = MockCache()

        def check_cache_during_screenshot(*args: object, **kwargs: object) -> bytes:
            cache_key = screenshot_obj.get_cache_key()
            cached_value = BaseScreenshot.cache.get(cache_key)
            assert cached_value is not None, (
                "Cache should be set to COMPUTING before screenshot starts"
            )
            assert cached_value["status"] == "Computing"
            return FAKE_PNG_BYTES

        mocker.patch(
            BASE_SCREENSHOT_PATH + ".get_screenshot",
            side_effect=check_cache_during_screenshot,
        )
        mocker.patch(
            BASE_SCREENSHOT_PATH + ".resize_image", return_value=FAKE_PNG_BYTES
        )

        screenshot_obj.compute_and_cache(user=mock_user, force=True)

        cache_key = screenshot_obj.get_cache_key()
        cached_value = BaseScreenshot.cache.get(cache_key)
        assert cached_value is not None
        assert cached_value["status"] == "Updated"

    def test_rejected_image_write_replaces_computing_with_error(
        self,
        mocker: MockerFixture,
        screenshot_obj: BaseScreenshot,
        mock_user: MagicMock,
    ) -> None:
        """A Memcached-style False result must become an image-free Error."""

        mocker.patch(DISTRIBUTED_LOCK_PATH)
        mocker.patch(BASE_SCREENSHOT_PATH + ".get_from_cache_key", return_value=None)
        mocker.patch(
            BASE_SCREENSHOT_PATH + ".get_screenshot",
            return_value=FAKE_PNG_BYTES,
        )
        mocker.patch(
            BASE_SCREENSHOT_PATH + ".resize_image",
            return_value=FAKE_PNG_BYTES,
        )
        BaseScreenshot.cache = RejectImageCache()

        with pytest.raises(ScreenshotCacheWriteError, match="persist Updated"):
            screenshot_obj.compute_and_cache(user=mock_user, force=True)

        cache_key = screenshot_obj.get_cache_key()
        cached_value = BaseScreenshot.cache.get(cache_key)
        assert cached_value is not None
        assert cached_value["status"] == "Error"
        assert cached_value["image"] is None


def test_error_state_preserves_an_existing_thumbnail_image() -> None:
    payload = ScreenshotCachePayload(image=FAKE_PNG_BYTES)

    payload.error()

    assert payload.get_status() == "Error"
    assert payload.to_dict()["image"] is not None


def test_error_state_can_discard_a_rejected_image() -> None:
    payload = ScreenshotCachePayload(image=FAKE_PNG_BYTES)

    payload.error(discard_image=True)

    assert payload.get_status() == "Error"
    assert payload.to_dict()["image"] is None


class TestShouldTriggerTask:
    """Test the should_trigger_task method improvements."""

    @patch("superset.utils.screenshots.app")
    def test_trigger_on_stale_computing_status(self, mock_app: MagicMock) -> None:
        """Test that stale COMPUTING status triggers recomputation."""
        # Set TTL to 300 seconds
        mock_app.config = {"THUMBNAIL_COMPUTING_CACHE_TTL": 300}

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
        mock_app.config = {"THUMBNAIL_COMPUTING_CACHE_TTL": 300}

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
        mock_app.config = {
            "THUMBNAIL_COMPUTING_CACHE_TTL": 300,
            "THUMBNAIL_ERROR_CACHE_TTL": 300,
        }

        # Create payload with ERROR status from 400 seconds ago (expired)
        old_timestamp = (datetime.now() - timedelta(seconds=400)).isoformat()
        payload = ScreenshotCachePayload(
            status=StatusValues.ERROR, timestamp=old_timestamp
        )

        assert payload.should_trigger_task(force=False) is True

    @patch("superset.utils.screenshots.app")
    def test_no_trigger_on_fresh_error(self, mock_app: MagicMock) -> None:
        """Test that fresh ERROR status does not trigger task."""
        mock_app.config = {
            "THUMBNAIL_COMPUTING_CACHE_TTL": 300,
            "THUMBNAIL_ERROR_CACHE_TTL": 300,
        }

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

    @patch("superset.utils.screenshots.app")
    def test_fresh_pending_request_is_not_enqueued_again(
        self, mock_app: MagicMock
    ) -> None:
        mock_app.config = {"THUMBNAIL_COMPUTING_CACHE_TTL": 300}
        payload = ScreenshotCachePayload(status=StatusValues.PENDING)

        assert payload.should_enqueue_task(force=False) is False
        assert payload.should_enqueue_task(force=True) is False

    @patch("superset.utils.screenshots.app")
    def test_stale_pending_request_is_enqueued_again(self, mock_app: MagicMock) -> None:
        mock_app.config = {"THUMBNAIL_COMPUTING_CACHE_TTL": 300}
        old_timestamp = (datetime.now() - timedelta(seconds=400)).isoformat()
        payload = ScreenshotCachePayload(
            status=StatusValues.PENDING, timestamp=old_timestamp
        )

        assert payload.should_enqueue_task(force=False) is True

    @patch("superset.utils.screenshots.app")
    def test_fresh_in_progress_scope_mismatch_is_enqueued_again(
        self, mock_app: MagicMock
    ) -> None:
        mock_app.config = {"THUMBNAIL_COMPUTING_CACHE_TTL": 300}
        payload = ScreenshotCachePayload(
            status=StatusValues.COMPUTING,
            scope="dashboard:other",
        )

        assert (
            payload.should_enqueue_task(
                force=False,
                expected_scope="dashboard:expected",
            )
            is True
        )

    def test_force_enqueues_updated_payload(self) -> None:
        payload = ScreenshotCachePayload(image=b"image_data")

        assert payload.should_enqueue_task(force=True) is True

    @patch("superset.utils.screenshots.app")
    def test_accepted_worker_can_retry_a_fresh_error(self, mock_app: MagicMock) -> None:
        mock_app.config = {"THUMBNAIL_ERROR_CACHE_TTL": 300}
        payload = ScreenshotCachePayload(status=StatusValues.ERROR)

        assert payload.should_trigger_task(force=False) is False
        assert payload.should_trigger_task(force=False, retry_fresh_error=True) is True


class TestIsComputingStale:
    """Test the is_computing_stale method."""

    @patch("superset.utils.screenshots.app")
    def test_computing_is_stale(self, mock_app):
        """Test that old COMPUTING status is detected as stale."""
        mock_app.config = {"THUMBNAIL_COMPUTING_CACHE_TTL": 300}

        # Timestamp from 400 seconds ago
        old_timestamp = (datetime.now() - timedelta(seconds=400)).isoformat()
        payload = ScreenshotCachePayload(
            status=StatusValues.COMPUTING, timestamp=old_timestamp
        )

        assert payload.is_computing_stale() is True

    @patch("superset.utils.screenshots.app")
    def test_computing_is_not_stale(self, mock_app):
        """Test that fresh COMPUTING status is not stale."""
        mock_app.config = {"THUMBNAIL_COMPUTING_CACHE_TTL": 300}

        # Timestamp from 100 seconds ago
        fresh_timestamp = (datetime.now() - timedelta(seconds=100)).isoformat()
        payload = ScreenshotCachePayload(
            status=StatusValues.COMPUTING, timestamp=fresh_timestamp
        )

        assert payload.is_computing_stale() is False

    @patch("superset.utils.screenshots.app")
    def test_computing_exactly_at_ttl(self, mock_app):
        """Test boundary condition at exactly TTL."""
        mock_app.config = {"THUMBNAIL_COMPUTING_CACHE_TTL": 300}

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
        mock_app.config = {"THUMBNAIL_COMPUTING_CACHE_TTL": 300}

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
        mocker.patch(DISTRIBUTED_LOCK_PATH)
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
        self,
        mock_app: MagicMock,
        mocker: MockerFixture,
        screenshot_obj: BaseScreenshot,
        mock_user: MagicMock,
    ) -> None:
        """
        Integration test: Stale COMPUTING status should trigger retry
        to recover from stuck tasks.
        """
        mock_app.config = {"THUMBNAIL_COMPUTING_CACHE_TTL": 300}
        mocker.patch(DISTRIBUTED_LOCK_PATH)
        BaseScreenshot.cache = MockCache()

        # Create stale COMPUTING entry and seed it in the cache
        old_timestamp = (datetime.now() - timedelta(seconds=400)).isoformat()
        stale_payload = ScreenshotCachePayload(
            status=StatusValues.COMPUTING, timestamp=old_timestamp
        )
        cache_key = screenshot_obj.get_cache_key()
        BaseScreenshot.cache.set(cache_key, stale_payload.to_dict())

        mocker.patch(
            BASE_SCREENSHOT_PATH + ".get_screenshot", return_value=FAKE_PNG_BYTES
        )
        # Mock resize to avoid PIL errors
        mocker.patch(
            BASE_SCREENSHOT_PATH + ".resize_image", return_value=FAKE_PNG_BYTES
        )

        # Should trigger task because COMPUTING is stale
        assert stale_payload.should_trigger_task() is True

        # Retry should succeed and update cache
        screenshot_obj.compute_and_cache(user=mock_user, force=False)

        cached_value = BaseScreenshot.cache.get(cache_key)
        assert cached_value is not None
        assert cached_value["status"] == "Updated"
        assert cached_value["image"] is not None

    def test_concurrent_task_skips_when_lock_already_held(
        self,
        mocker: MockerFixture,
        screenshot_obj: BaseScreenshot,
        mock_user: MagicMock,
    ) -> None:
        """compute_and_cache exits without rendering when the distributed lock
        is already held by another worker — atomically preventing duplicate Selenium."""
        mock_lock = mocker.patch(DISTRIBUTED_LOCK_PATH)
        mock_lock.return_value.__enter__.side_effect = LockAlreadyHeldException(
            "lock held"
        )
        get_screenshot = mocker.patch(BASE_SCREENSHOT_PATH + ".get_screenshot")
        BaseScreenshot.cache = MockCache()

        screenshot_obj.compute_and_cache(user=mock_user, force=False)

        get_screenshot.assert_not_called()

    @patch("superset.utils.screenshots.app")
    def test_enqueue_task_claims_a_missing_key_atomically(
        self,
        mock_app: MagicMock,
        mocker: MockerFixture,
    ) -> None:
        mock_app.config = {"THUMBNAIL_COMPUTING_CACHE_TTL": 300}
        mock_lock = mocker.patch(DISTRIBUTED_LOCK_PATH)
        enqueue = MagicMock()
        BaseScreenshot.cache = MockCache()

        payload, should_enqueue = BaseScreenshot.prepare_and_enqueue_task(
            "key",
            force=False,
            scope="dashboard:1",
            enqueue=enqueue,
        )

        assert should_enqueue is True
        assert payload.get_status() == "Pending"
        assert payload.get_scope() == "dashboard:1"
        assert BaseScreenshot.cache.get("key")["status"] == "Pending"
        enqueue.assert_called_once_with()
        mock_lock.assert_called_once_with(namespace="thumbnail_enqueue", key="key")

    def test_enqueue_task_preserves_accepted_result_when_lock_release_fails(
        self,
        mocker: MockerFixture,
    ) -> None:
        mocker.patch(DISTRIBUTED_LOCK_PATH, return_value=ReleaseFailingLock())
        enqueue = MagicMock()
        BaseScreenshot.cache = MockCache()

        payload, should_enqueue = BaseScreenshot.prepare_and_enqueue_task(
            "key",
            force=False,
            scope="dashboard:1",
            enqueue=enqueue,
        )

        assert should_enqueue is True
        assert payload.get_status() == "Pending"
        assert BaseScreenshot.cache.get("key")["status"] == "Pending"
        enqueue.assert_called_once_with()

    def test_enqueue_task_preserves_existing_result_when_lock_release_fails(
        self,
        mocker: MockerFixture,
    ) -> None:
        mocker.patch(DISTRIBUTED_LOCK_PATH, return_value=ReleaseFailingLock())
        BaseScreenshot.cache = MockCache()
        BaseScreenshot.cache.set(
            "key",
            ScreenshotCachePayload(
                status=StatusValues.PENDING,
                scope="dashboard:1",
            ).to_dict(),
        )
        enqueue = MagicMock()

        payload, should_enqueue = BaseScreenshot.prepare_and_enqueue_task(
            "key",
            force=False,
            scope="dashboard:1",
            enqueue=enqueue,
        )

        assert should_enqueue is False
        assert payload.get_status() == "Pending"
        enqueue.assert_not_called()

    def test_enqueue_failure_wins_over_lock_release_failure(
        self,
        mocker: MockerFixture,
    ) -> None:
        mocker.patch(DISTRIBUTED_LOCK_PATH, return_value=ReleaseFailingLock())
        BaseScreenshot.cache = MockCache()

        with pytest.raises(RuntimeError, match="broker unavailable"):
            BaseScreenshot.prepare_and_enqueue_task(
                "key",
                force=False,
                scope="dashboard:1",
                enqueue=MagicMock(side_effect=RuntimeError("broker unavailable")),
            )

        assert BaseScreenshot.cache.get("key")["status"] == "Error"

    @patch("superset.utils.screenshots.app")
    def test_enqueue_task_rechecks_fresh_pending_under_lock(
        self,
        mock_app: MagicMock,
        mocker: MockerFixture,
    ) -> None:
        mock_app.config = {"THUMBNAIL_COMPUTING_CACHE_TTL": 300}
        mocker.patch(DISTRIBUTED_LOCK_PATH)
        BaseScreenshot.cache = MockCache()
        BaseScreenshot.cache.set(
            "key",
            ScreenshotCachePayload(
                status=StatusValues.PENDING,
                scope="dashboard:1",
            ).to_dict(),
        )

        enqueue = MagicMock()
        payload, should_enqueue = BaseScreenshot.prepare_and_enqueue_task(
            "key",
            force=True,
            scope="dashboard:1",
            enqueue=enqueue,
        )

        assert should_enqueue is False
        assert payload.get_status() == "Pending"
        enqueue.assert_not_called()

    @patch("superset.utils.screenshots.app")
    def test_enqueue_task_does_not_publish_during_lock_contention(
        self,
        mock_app: MagicMock,
        mocker: MockerFixture,
    ) -> None:
        mock_app.config = {"THUMBNAIL_COMPUTING_CACHE_TTL": 300}
        mock_lock = mocker.patch(DISTRIBUTED_LOCK_PATH)
        mock_lock.return_value.__enter__.side_effect = LockAlreadyHeldException(
            "lock held"
        )
        BaseScreenshot.cache = MockCache()
        BaseScreenshot.cache.set(
            "key",
            ScreenshotCachePayload(
                image=FAKE_PNG_BYTES,
                scope="dashboard:1",
            ).to_dict(),
        )

        enqueue = MagicMock()
        payload, should_enqueue = BaseScreenshot.prepare_and_enqueue_task(
            "key",
            force=True,
            scope="dashboard:1",
            enqueue=enqueue,
        )

        assert should_enqueue is False
        assert payload.get_status() == "Pending"
        assert BaseScreenshot.cache.get("key")["status"] == "Updated"
        enqueue.assert_not_called()

    @patch("superset.utils.screenshots.app")
    def test_enqueue_failure_records_error_before_releasing_producer_lock(
        self,
        mock_app: MagicMock,
        mocker: MockerFixture,
    ) -> None:
        mock_app.config = {"THUMBNAIL_COMPUTING_CACHE_TTL": 300}
        lock_depth = 0

        class TrackingLock:
            def __enter__(self) -> None:
                nonlocal lock_depth
                lock_depth += 1

            def __exit__(self, *args: object) -> None:
                nonlocal lock_depth
                lock_depth -= 1

        mocker.patch(DISTRIBUTED_LOCK_PATH, return_value=TrackingLock())
        BaseScreenshot.cache = MockCache()

        def fail_enqueue() -> None:
            assert lock_depth == 1
            raise RuntimeError("broker unavailable")

        with pytest.raises(RuntimeError, match="broker unavailable"):
            BaseScreenshot.prepare_and_enqueue_task(
                "key",
                force=False,
                scope="dashboard:1",
                enqueue=fail_enqueue,
            )

        assert lock_depth == 0
        assert BaseScreenshot.cache.get("key")["status"] == "Error"

    def test_accepted_worker_retries_error_but_skips_updated(
        self,
        mocker: MockerFixture,
        screenshot_obj: BaseScreenshot,
        mock_user: MagicMock,
    ) -> None:
        mocker.patch(DISTRIBUTED_LOCK_PATH)
        get_screenshot = mocker.patch(
            BASE_SCREENSHOT_PATH + ".get_screenshot",
            return_value=FAKE_PNG_BYTES,
        )
        mocker.patch(
            BASE_SCREENSHOT_PATH + ".resize_image",
            return_value=FAKE_PNG_BYTES,
        )
        BaseScreenshot.cache = MockCache()
        cache_key = screenshot_obj.get_cache_key()
        BaseScreenshot.cache.set(
            cache_key,
            ScreenshotCachePayload(status=StatusValues.ERROR).to_dict(),
        )

        screenshot_obj.compute_and_cache(
            user=mock_user,
            force=False,
            retry_fresh_error=True,
        )

        assert get_screenshot.call_count == 1
        assert BaseScreenshot.cache.get(cache_key)["status"] == "Updated"

        screenshot_obj.compute_and_cache(
            user=mock_user,
            force=False,
            retry_fresh_error=True,
        )

        assert get_screenshot.call_count == 1

    def test_setup_error_does_not_overwrite_an_active_task(
        self,
        mocker: MockerFixture,
    ) -> None:
        """A duplicate setup failure leaves the lock owner's state untouched."""
        mock_lock = mocker.patch(DISTRIBUTED_LOCK_PATH)
        mock_lock.return_value.__enter__.side_effect = LockAlreadyHeldException(
            "lock held"
        )
        BaseScreenshot.cache = MockCache()
        BaseScreenshot.cache.set(
            "key",
            ScreenshotCachePayload(
                status=StatusValues.COMPUTING,
                scope="dashboard:1",
            ).to_dict(),
        )

        assert BaseScreenshot.store_error_if_no_active_task("key", "dashboard:1")
        assert BaseScreenshot.cache.get("key")["status"] == "Computing"

    def test_setup_error_preserves_a_completed_task(
        self,
        mocker: MockerFixture,
    ) -> None:
        """A late duplicate failure cannot replace a completed artifact."""
        mocker.patch(DISTRIBUTED_LOCK_PATH)
        BaseScreenshot.cache = MockCache()
        BaseScreenshot.cache.set(
            "key",
            ScreenshotCachePayload(
                image=FAKE_PNG_BYTES,
                scope="dashboard:1",
            ).to_dict(),
        )

        assert BaseScreenshot.store_error_if_no_active_task("key", "dashboard:1")
        assert BaseScreenshot.cache.get("key")["status"] == "Updated"

    def test_setup_error_replaces_an_unowned_pending_task(
        self,
        mocker: MockerFixture,
    ) -> None:
        """The sole failed worker still records a terminal state."""
        mocker.patch(DISTRIBUTED_LOCK_PATH)
        BaseScreenshot.cache = MockCache()
        BaseScreenshot.cache.set(
            "key",
            ScreenshotCachePayload(
                status=StatusValues.PENDING,
                scope="dashboard:1",
            ).to_dict(),
        )

        assert BaseScreenshot.store_error_if_no_active_task("key", "dashboard:1")
        payload = BaseScreenshot.cache.get("key")
        assert payload["status"] == "Error"
        assert payload["image"] is None

    @pytest.mark.parametrize(
        "lock_error",
        [
            AcquireDistributedLockFailedException("acquire failed"),
            ReleaseDistributedLockFailedException("release failed"),
        ],
    )
    def test_setup_error_reports_lock_backend_failure(
        self,
        mocker: MockerFixture,
        lock_error: Exception,
    ) -> None:
        """Lock-backend failures do not mask the original task failure."""
        mock_lock = mocker.patch(DISTRIBUTED_LOCK_PATH)
        mock_lock.return_value.__enter__.side_effect = lock_error

        assert not BaseScreenshot.store_error_if_no_active_task("key", "dashboard:1")

    def test_computing_preserves_previous_image(
        self,
        mocker: MockerFixture,
        screenshot_obj: BaseScreenshot,
        mock_user: MagicMock,
    ) -> None:
        """computing() must not wipe the cached image so a stale thumbnail remains
        visible while a refresh is in progress."""
        old_image = b"old_thumbnail_bytes"
        payload = ScreenshotCachePayload(image=old_image)
        assert payload._image == old_image

        payload.computing()

        assert payload._image == old_image
        assert payload.status == StatusValues.COMPUTING


class TestReadSideImageValidation:
    """A cached payload that claims a successful screenshot (status UPDATED)
    but carries invalid image bytes must be served as a cache miss, not
    returned to the caller — this is what the dashboard/chart screenshot
    endpoints call to fetch bytes to serve."""

    def test_zero_byte_image_is_treated_as_cache_miss(
        self, mocker: MockerFixture, screenshot_obj: BaseScreenshot
    ) -> None:
        mock_logger = mocker.patch("superset.utils.screenshots.logger")
        BaseScreenshot.cache = MockCache()
        cache_key = screenshot_obj.get_cache_key()
        stale_payload = ScreenshotCachePayload(image=b"", status=StatusValues.UPDATED)
        BaseScreenshot.cache.set(cache_key, stale_payload.to_dict())

        result = screenshot_obj.get_from_cache_key(cache_key)

        assert result is None
        assert any(
            cache_key in call.args and "empty" in call.args
            for call in mock_logger.warning.call_args_list
        )

    def test_garbage_bytes_image_is_treated_as_cache_miss(
        self, mocker: MockerFixture, screenshot_obj: BaseScreenshot
    ) -> None:
        mock_logger = mocker.patch("superset.utils.screenshots.logger")
        BaseScreenshot.cache = MockCache()
        cache_key = screenshot_obj.get_cache_key()
        garbage_payload = ScreenshotCachePayload(image=b"not-an-image-at-all")
        BaseScreenshot.cache.set(cache_key, garbage_payload.to_dict())

        result = screenshot_obj.get_from_cache_key(cache_key)

        assert result is None
        assert any(
            cache_key in call.args and "undecodable" in call.args
            for call in mock_logger.warning.call_args_list
        )

    def test_valid_image_is_served_normally(
        self, screenshot_obj: BaseScreenshot
    ) -> None:
        BaseScreenshot.cache = MockCache()
        cache_key = screenshot_obj.get_cache_key()
        valid_payload = ScreenshotCachePayload(image=FAKE_PNG_BYTES)
        BaseScreenshot.cache.set(cache_key, valid_payload.to_dict())

        result = screenshot_obj.get_from_cache_key(cache_key)

        assert result is not None
        assert result.get_image().read() == FAKE_PNG_BYTES

    def test_pending_status_with_no_image_is_not_rejected(
        self, screenshot_obj: BaseScreenshot
    ) -> None:
        """Non-UPDATED statuses (e.g. PENDING/COMPUTING) aren't claiming a
        successful screenshot, so they should be returned as-is."""
        BaseScreenshot.cache = MockCache()
        cache_key = screenshot_obj.get_cache_key()
        pending_payload = ScreenshotCachePayload(status=StatusValues.PENDING)
        BaseScreenshot.cache.set(cache_key, pending_payload.to_dict())

        result = screenshot_obj.get_from_cache_key(cache_key)

        assert result is not None
        assert result.status == StatusValues.PENDING
