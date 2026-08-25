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

from superset.exceptions import LockAlreadyHeldException
from superset.utils.screenshots import (
    BaseScreenshot,
    ChartScreenshot,
    DashboardScreenshot,
    ScreenshotCachePayload,
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
    def test_trigger_on_stale_updated_with_scope(self, mock_app: MagicMock) -> None:
        """A stale-but-valid UPDATED entry on a caller that opts into
        updated-staleness (the dashboard on-demand endpoint) must re-trigger --
        this is the regression test for the bug where a force-less caller
        served a bad-but-valid cached capture forever."""
        mock_app.config = {"THUMBNAIL_UPDATED_CACHE_TTL": 300}

        old_timestamp = (datetime.now() - timedelta(seconds=400)).isoformat()
        # Matching scope so the pre-existing scope-mismatch clause doesn't
        # decide the result -- the staleness clause must be what fires.
        payload = ScreenshotCachePayload(
            image=FAKE_PNG_BYTES, timestamp=old_timestamp, scope="dashboard:1"
        )

        assert (
            payload.should_trigger_task(
                force=False,
                expected_scope="dashboard:1",
                check_updated_staleness=True,
            )
            is True
        )

    @patch("superset.utils.screenshots.app")
    def test_no_trigger_on_stale_updated_when_staleness_disabled(
        self, mock_app: MagicMock
    ) -> None:
        """The same stale UPDATED entry with a matching scope must NOT
        re-trigger when the caller does not opt into updated-staleness (the
        chart on-demand endpoint, whose pre-wipe+UPDATED-only serving would
        otherwise surface a transient 404), proving the new clause is gated on
        ``check_updated_staleness`` rather than firing for every scoped
        caller."""
        mock_app.config = {"THUMBNAIL_UPDATED_CACHE_TTL": 300}

        old_timestamp = (datetime.now() - timedelta(seconds=400)).isoformat()
        payload = ScreenshotCachePayload(
            image=FAKE_PNG_BYTES, timestamp=old_timestamp, scope="dashboard:1"
        )

        assert (
            payload.should_trigger_task(
                force=False,
                expected_scope="dashboard:1",
                check_updated_staleness=False,
            )
            is False
        )

    @patch("superset.utils.screenshots.app")
    def test_no_trigger_on_fresh_updated_with_scope(self, mock_app: MagicMock) -> None:
        """A fresh UPDATED entry must NOT re-trigger even with staleness
        enabled -- isolates freshness from the opt-in gate."""
        mock_app.config = {"THUMBNAIL_UPDATED_CACHE_TTL": 300}

        fresh_timestamp = (datetime.now() - timedelta(seconds=100)).isoformat()
        payload = ScreenshotCachePayload(
            image=FAKE_PNG_BYTES, timestamp=fresh_timestamp, scope="dashboard:1"
        )

        assert (
            payload.should_trigger_task(
                force=False,
                expected_scope="dashboard:1",
                check_updated_staleness=True,
            )
            is False
        )

    @patch("superset.utils.screenshots.app")
    def test_no_trigger_when_ttl_disabled(self, mock_app: MagicMock) -> None:
        """With the TTL disabled (0), even a very old UPDATED entry with
        staleness enabled must NOT re-trigger -- the instant opt-out / rollback
        switch, isolated from the opt-in gate."""
        mock_app.config = {"THUMBNAIL_UPDATED_CACHE_TTL": 0}

        very_old_timestamp = (datetime.now() - timedelta(days=365)).isoformat()
        payload = ScreenshotCachePayload(
            image=FAKE_PNG_BYTES, timestamp=very_old_timestamp, scope="dashboard:1"
        )

        assert (
            payload.should_trigger_task(
                force=False,
                expected_scope="dashboard:1",
                check_updated_staleness=True,
            )
            is False
        )


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

    @patch("superset.utils.screenshots.logger")
    @patch("superset.utils.screenshots.app")
    def test_computing_unparseable_timestamp_is_stale(
        self, mock_app: MagicMock, mock_logger: MagicMock
    ) -> None:
        """A corrupt timestamp (ValueError) does not raise; it is logged and
        treated as stale so the entry self-heals."""
        mock_app.config = {"THUMBNAIL_COMPUTING_CACHE_TTL": 300}

        payload = ScreenshotCachePayload(
            status=StatusValues.COMPUTING, timestamp="not-a-date"
        )

        assert payload.is_computing_stale() is True
        mock_logger.warning.assert_called_once()

    @patch("superset.utils.screenshots.logger")
    @patch("superset.utils.screenshots.app")
    def test_computing_tz_aware_timestamp_is_stale(
        self, mock_app: MagicMock, mock_logger: MagicMock
    ) -> None:
        """A legacy tz-aware timestamp parses but cannot be subtracted from
        naive now() (TypeError); it does not raise -- it is logged and treated
        as stale."""
        mock_app.config = {"THUMBNAIL_COMPUTING_CACHE_TTL": 300}

        payload = ScreenshotCachePayload(
            status=StatusValues.COMPUTING, timestamp="2020-01-01T00:00:00+00:00"
        )

        assert payload.is_computing_stale() is True
        mock_logger.warning.assert_called_once()

    @patch("superset.utils.screenshots.logger")
    @patch("superset.utils.screenshots.app")
    def test_computing_future_timestamp_is_stale(
        self, mock_app: MagicMock, mock_logger: MagicMock
    ) -> None:
        """A future timestamp (negative age, e.g. a worker whose clock is ahead)
        does not raise; it is logged and treated as stale so the entry
        self-heals rather than being served for the TTL plus the clock skew."""
        mock_app.config = {"THUMBNAIL_COMPUTING_CACHE_TTL": 300}

        future_timestamp = (datetime.now() + timedelta(seconds=600)).isoformat()
        payload = ScreenshotCachePayload(
            status=StatusValues.COMPUTING, timestamp=future_timestamp
        )

        assert payload.is_computing_stale() is True
        mock_logger.warning.assert_called_once()


class TestIsErrorCacheTtlExpired:
    """Test the is_error_cache_ttl_expired method."""

    @patch("superset.utils.screenshots.app")
    def test_error_is_expired(self, mock_app: MagicMock) -> None:
        """An ERROR entry older than the TTL is expired."""
        mock_app.config = {"THUMBNAIL_ERROR_CACHE_TTL": 300}

        old_timestamp = (datetime.now() - timedelta(seconds=400)).isoformat()
        payload = ScreenshotCachePayload(
            status=StatusValues.ERROR, timestamp=old_timestamp
        )

        assert payload.is_error_cache_ttl_expired() is True

    @patch("superset.utils.screenshots.app")
    def test_error_is_not_expired(self, mock_app: MagicMock) -> None:
        """A fresh ERROR entry is not expired."""
        mock_app.config = {"THUMBNAIL_ERROR_CACHE_TTL": 300}

        fresh_timestamp = (datetime.now() - timedelta(seconds=100)).isoformat()
        payload = ScreenshotCachePayload(
            status=StatusValues.ERROR, timestamp=fresh_timestamp
        )

        assert payload.is_error_cache_ttl_expired() is False

    @patch("superset.utils.screenshots.logger")
    @patch("superset.utils.screenshots.app")
    def test_error_unparseable_timestamp_is_expired(
        self, mock_app: MagicMock, mock_logger: MagicMock
    ) -> None:
        """A corrupt timestamp (ValueError) does not raise; it is logged and
        treated as expired so the entry self-heals."""
        mock_app.config = {"THUMBNAIL_ERROR_CACHE_TTL": 300}

        payload = ScreenshotCachePayload(
            status=StatusValues.ERROR, timestamp="not-a-date"
        )

        assert payload.is_error_cache_ttl_expired() is True
        mock_logger.warning.assert_called_once()

    @patch("superset.utils.screenshots.logger")
    @patch("superset.utils.screenshots.app")
    def test_error_tz_aware_timestamp_is_expired(
        self, mock_app: MagicMock, mock_logger: MagicMock
    ) -> None:
        """A legacy tz-aware timestamp parses but cannot be subtracted from
        naive now() (TypeError); it does not raise -- it is logged and treated
        as expired."""
        mock_app.config = {"THUMBNAIL_ERROR_CACHE_TTL": 300}

        payload = ScreenshotCachePayload(
            status=StatusValues.ERROR, timestamp="2020-01-01T00:00:00+00:00"
        )

        assert payload.is_error_cache_ttl_expired() is True
        mock_logger.warning.assert_called_once()

    @patch("superset.utils.screenshots.logger")
    @patch("superset.utils.screenshots.app")
    def test_error_future_timestamp_is_expired(
        self, mock_app: MagicMock, mock_logger: MagicMock
    ) -> None:
        """A future timestamp (negative age, e.g. a worker whose clock is ahead)
        does not raise; it is logged and treated as expired so the entry
        self-heals rather than being served for the TTL plus the clock skew."""
        mock_app.config = {"THUMBNAIL_ERROR_CACHE_TTL": 300}

        future_timestamp = (datetime.now() + timedelta(seconds=600)).isoformat()
        payload = ScreenshotCachePayload(
            status=StatusValues.ERROR, timestamp=future_timestamp
        )

        assert payload.is_error_cache_ttl_expired() is True
        mock_logger.warning.assert_called_once()


class TestIsUpdatedStale:
    """Test the is_updated_stale method."""

    @patch("superset.utils.screenshots.app")
    def test_updated_is_stale(self, mock_app: MagicMock) -> None:
        """An UPDATED entry older than the TTL is stale."""
        mock_app.config = {"THUMBNAIL_UPDATED_CACHE_TTL": 300}

        old_timestamp = (datetime.now() - timedelta(seconds=400)).isoformat()
        payload = ScreenshotCachePayload(image=FAKE_PNG_BYTES, timestamp=old_timestamp)

        assert payload.is_updated_stale() is True

    @patch("superset.utils.screenshots.app")
    def test_updated_just_past_ttl(self, mock_app: MagicMock) -> None:
        """Just past the TTL (301s) the entry is stale."""
        mock_app.config = {"THUMBNAIL_UPDATED_CACHE_TTL": 300}

        past_ttl_timestamp = (datetime.now() - timedelta(seconds=301)).isoformat()
        payload = ScreenshotCachePayload(
            image=FAKE_PNG_BYTES, timestamp=past_ttl_timestamp
        )

        assert payload.is_updated_stale() is True

    @patch("superset.utils.screenshots.app")
    def test_updated_is_fresh(self, mock_app: MagicMock) -> None:
        """A recently-rendered UPDATED entry is not stale."""
        mock_app.config = {"THUMBNAIL_UPDATED_CACHE_TTL": 300}

        fresh_timestamp = (datetime.now() - timedelta(seconds=100)).isoformat()
        payload = ScreenshotCachePayload(
            image=FAKE_PNG_BYTES, timestamp=fresh_timestamp
        )

        assert payload.is_updated_stale() is False

    @patch("superset.utils.screenshots.app")
    def test_updated_just_under_ttl(self, mock_app: MagicMock) -> None:
        """Just under the TTL (299s) the entry is still fresh. Paired with the
        301s case to bracket the strict-'>' boundary without an
        unpinnable exactly-at-TTL wall-clock case."""
        mock_app.config = {"THUMBNAIL_UPDATED_CACHE_TTL": 300}

        under_ttl_timestamp = (datetime.now() - timedelta(seconds=299)).isoformat()
        payload = ScreenshotCachePayload(
            image=FAKE_PNG_BYTES, timestamp=under_ttl_timestamp
        )

        assert payload.is_updated_stale() is False

    @patch("superset.utils.screenshots.app")
    def test_disabled_with_zero_ttl(self, mock_app: MagicMock) -> None:
        """A TTL of 0 disables the check, so even a very old entry is not
        stale."""
        mock_app.config = {"THUMBNAIL_UPDATED_CACHE_TTL": 0}

        very_old_timestamp = (datetime.now() - timedelta(days=365)).isoformat()
        payload = ScreenshotCachePayload(
            image=FAKE_PNG_BYTES, timestamp=very_old_timestamp
        )

        assert payload.is_updated_stale() is False

    @patch("superset.utils.screenshots.app")
    def test_disabled_with_none_ttl(self, mock_app: MagicMock) -> None:
        """A missing/None TTL (unconfigured or legacy deployment) disables the
        check via ``app.config.get`` without raising."""
        mock_app.config = {"THUMBNAIL_UPDATED_CACHE_TTL": None}

        very_old_timestamp = (datetime.now() - timedelta(days=365)).isoformat()
        payload = ScreenshotCachePayload(
            image=FAKE_PNG_BYTES, timestamp=very_old_timestamp
        )

        assert payload.is_updated_stale() is False

    @patch("superset.utils.screenshots.logger")
    @patch("superset.utils.screenshots.app")
    def test_unparseable_timestamp_is_stale(
        self, mock_app: MagicMock, mock_logger: MagicMock
    ) -> None:
        """A corrupt timestamp (ValueError) is logged and treated as stale so
        the entry self-heals rather than being served forever."""
        mock_app.config = {"THUMBNAIL_UPDATED_CACHE_TTL": 300}

        payload = ScreenshotCachePayload(image=FAKE_PNG_BYTES, timestamp="not-a-date")

        assert payload.is_updated_stale() is True
        mock_logger.warning.assert_called_once()

    @patch("superset.utils.screenshots.logger")
    @patch("superset.utils.screenshots.app")
    def test_tz_aware_timestamp_is_stale(
        self, mock_app: MagicMock, mock_logger: MagicMock
    ) -> None:
        """A legacy tz-aware timestamp parses but cannot be subtracted from
        naive now() (TypeError); it is logged and treated as stale."""
        mock_app.config = {"THUMBNAIL_UPDATED_CACHE_TTL": 300}

        payload = ScreenshotCachePayload(
            image=FAKE_PNG_BYTES, timestamp="2020-01-01T00:00:00+00:00"
        )

        assert payload.is_updated_stale() is True
        mock_logger.warning.assert_called_once()

    @patch("superset.utils.screenshots.logger")
    @patch("superset.utils.screenshots.app")
    def test_future_timestamp_is_stale(
        self, mock_app: MagicMock, mock_logger: MagicMock
    ) -> None:
        """A future timestamp (negative age, e.g. a worker whose clock is ahead)
        is logged and treated as stale so the entry self-heals rather than being
        served for the TTL plus the clock skew."""
        mock_app.config = {"THUMBNAIL_UPDATED_CACHE_TTL": 300}

        future_timestamp = (datetime.now() + timedelta(seconds=600)).isoformat()
        payload = ScreenshotCachePayload(
            image=FAKE_PNG_BYTES, timestamp=future_timestamp
        )

        assert payload.is_updated_stale() is True
        mock_logger.warning.assert_called_once()

    @patch("superset.utils.screenshots.logger")
    @patch("superset.utils.screenshots.app")
    def test_disabled_with_future_timestamp(
        self, mock_app: MagicMock, mock_logger: MagicMock
    ) -> None:
        """The disabled-feature guard wins: with the TTL unset/0, a future
        timestamp must NOT be stale because the guard short-circuits before
        _age_seconds is ever consulted (so no warning is logged either)."""
        mock_app.config = {"THUMBNAIL_UPDATED_CACHE_TTL": 0}

        future_timestamp = (datetime.now() + timedelta(seconds=600)).isoformat()
        payload = ScreenshotCachePayload(
            image=FAKE_PNG_BYTES, timestamp=future_timestamp
        )

        assert payload.is_updated_stale() is False
        mock_logger.warning.assert_not_called()

    @patch("superset.utils.screenshots.logger")
    def test_age_seconds_future_timestamp_returns_none(
        self, mock_logger: MagicMock
    ) -> None:
        """_age_seconds returns None directly for a future timestamp so every
        caller's ``age is None`` branch treats the entry as expired/stale."""
        future_timestamp = (datetime.now() + timedelta(seconds=600)).isoformat()
        payload = ScreenshotCachePayload(
            image=FAKE_PNG_BYTES, timestamp=future_timestamp
        )

        assert payload._age_seconds() is None
        mock_logger.warning.assert_called_once()


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

    @patch("superset.utils.screenshots.app")
    def test_stale_updated_triggers_recompute(
        self,
        mock_app: MagicMock,
        mocker: MockerFixture,
        mock_user: MagicMock,
    ) -> None:
        """
        Integration test: a stale-but-valid UPDATED entry on a DashboardScreenshot
        (supports_updated_staleness=True) self-heals -- should_trigger_task returns
        True and compute_and_cache re-renders, refreshing the timestamp and image.
        This exercises the worker-guard re-check
        (check_updated_staleness=self.supports_updated_staleness) inside
        compute_and_cache, not just should_trigger_task in isolation.
        """
        # Both keys are required: THUMBNAIL_UPDATED_CACHE_TTL drives the new
        # staleness clause, and THUMBNAIL_COMPUTING_CACHE_TTL is read as the
        # DistributedLock ttl_seconds even with the lock mocked.
        mock_app.config = {
            "THUMBNAIL_UPDATED_CACHE_TTL": 300,
            "THUMBNAIL_COMPUTING_CACHE_TTL": 360,
        }
        mocker.patch(DISTRIBUTED_LOCK_PATH)
        BaseScreenshot.cache = MockCache()

        # The dashboard on-demand endpoint opts into updated-staleness; the
        # worker-guard re-check in compute_and_cache passes
        # supports_updated_staleness (True here) as check_updated_staleness.
        # Without it the clause is gated off and the recompute is skipped.
        screenshot_obj = DashboardScreenshot("http://example.com", "sample_digest")
        screenshot_obj.cache_scope = "dashboard:1"

        # Seed a stale (400s old) but valid UPDATED entry with a *matching*
        # scope so the pre-existing scope-mismatch clause doesn't fire first.
        old_timestamp = (datetime.now() - timedelta(seconds=400)).isoformat()
        stale_payload = ScreenshotCachePayload(
            image=FAKE_PNG_BYTES, timestamp=old_timestamp, scope="dashboard:1"
        )
        cache_key = screenshot_obj.get_cache_key()
        BaseScreenshot.cache.set(cache_key, stale_payload.to_dict())
        seeded_image = BaseScreenshot.cache.get(cache_key)["image"]

        new_image = b"\x89PNG\r\n\x1a\n" + b"freshly-rendered-body"
        mocker.patch(BASE_SCREENSHOT_PATH + ".get_screenshot", return_value=new_image)
        mocker.patch(BASE_SCREENSHOT_PATH + ".resize_image", return_value=new_image)

        # Stale UPDATED with a matching scope and staleness enabled triggers a
        # recompute.
        assert (
            stale_payload.should_trigger_task(
                expected_scope="dashboard:1", check_updated_staleness=True
            )
            is True
        )

        screenshot_obj.compute_and_cache(user=mock_user, force=False)

        cached_value = BaseScreenshot.cache.get(cache_key)
        assert cached_value is not None
        assert cached_value["status"] == "Updated"
        assert cached_value["timestamp"] != old_timestamp
        assert cached_value["image"] is not None
        assert cached_value["image"] != seeded_image

    @patch("superset.utils.screenshots.app")
    def test_stale_updated_not_recomputed_for_chart(
        self,
        mock_app: MagicMock,
        mocker: MockerFixture,
        mock_user: MagicMock,
    ) -> None:
        """
        Regression test for the finding: a ChartScreenshot
        (supports_updated_staleness=False) must NOT recompute a stale-but-valid
        UPDATED entry on a force-less request. The chart on-demand path pre-wipes
        the cache to PENDING and serves only UPDATED, so a stale-driven recompute
        could turn a healthy thumbnail into a transient 404. The worker guard must
        skip the render and leave the cached image/timestamp untouched.
        """
        mock_app.config = {
            "THUMBNAIL_UPDATED_CACHE_TTL": 300,
            "THUMBNAIL_COMPUTING_CACHE_TTL": 360,
        }
        mocker.patch(DISTRIBUTED_LOCK_PATH)
        BaseScreenshot.cache = MockCache()

        screenshot_obj = ChartScreenshot("http://example.com", "sample_digest")
        screenshot_obj.cache_scope = "chart:1"

        # Seed a stale (400s old) but valid UPDATED entry with a matching scope.
        old_timestamp = (datetime.now() - timedelta(seconds=400)).isoformat()
        stale_payload = ScreenshotCachePayload(
            image=FAKE_PNG_BYTES, timestamp=old_timestamp, scope="chart:1"
        )
        cache_key = screenshot_obj.get_cache_key()
        BaseScreenshot.cache.set(cache_key, stale_payload.to_dict())
        seeded = BaseScreenshot.cache.get(cache_key)

        get_screenshot = mocker.patch(
            BASE_SCREENSHOT_PATH + ".get_screenshot",
            return_value=b"\x89PNG\r\n\x1a\n" + b"should-not-be-used",
        )

        # Chart caller does not opt into staleness, so no recompute is triggered.
        assert (
            stale_payload.should_trigger_task(
                expected_scope="chart:1", check_updated_staleness=False
            )
            is False
        )

        screenshot_obj.compute_and_cache(user=mock_user, force=False)

        # The worker guard skipped the render; cache is byte-identical.
        get_screenshot.assert_not_called()
        cached_value = BaseScreenshot.cache.get(cache_key)
        assert cached_value is not None
        assert cached_value["status"] == "Updated"
        assert cached_value["timestamp"] == old_timestamp
        assert cached_value["image"] == seeded["image"]

    def test_supports_updated_staleness_flags(self) -> None:
        """The per-type opt-in is False for charts (their serving path would
        surface a transient 404 on a stale-driven recompute) and True for
        dashboards (which serve on image-present and degrade gracefully)."""
        assert ChartScreenshot.supports_updated_staleness is False
        assert DashboardScreenshot.supports_updated_staleness is True

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


class TestDeserializationPreservesStatus:
    """A persisted ERROR/COMPUTING entry keeps its previous image, so
    to_dict()/from_dict() must round-trip its status. from_dict() builds through
    __init__, which infers UPDATED whenever an image is present; without the
    explicit restore in from_dict() the entry would be masked as a fresh UPDATED
    and bypass the shorter ERROR/COMPUTING recovery TTLs, so a failed or stuck
    render would not be retried until the 7-day UPDATED TTL elapsed."""

    def test_error_status_survives_round_trip_with_image(self) -> None:
        # error() keeps the previous image so a stale thumbnail stays servable.
        payload = ScreenshotCachePayload(image=FAKE_PNG_BYTES)
        payload.error()
        assert payload.status == StatusValues.ERROR
        assert payload._image == FAKE_PNG_BYTES

        restored = ScreenshotCachePayload.from_dict(payload.to_dict())

        assert restored.status == StatusValues.ERROR
        assert restored.get_image().read() == FAKE_PNG_BYTES

    def test_computing_status_survives_round_trip_with_image(self) -> None:
        # computing() likewise preserves the previous image.
        payload = ScreenshotCachePayload(image=FAKE_PNG_BYTES)
        payload.computing()
        assert payload.status == StatusValues.COMPUTING
        assert payload._image == FAKE_PNG_BYTES

        restored = ScreenshotCachePayload.from_dict(payload.to_dict())

        assert restored.status == StatusValues.COMPUTING
        assert restored.get_image().read() == FAKE_PNG_BYTES

    def test_updated_status_survives_round_trip_with_image(self) -> None:
        # A genuine UPDATED entry still round-trips to UPDATED with its image.
        payload = ScreenshotCachePayload(image=FAKE_PNG_BYTES)
        assert payload.status == StatusValues.UPDATED

        restored = ScreenshotCachePayload.from_dict(payload.to_dict())

        assert restored.status == StatusValues.UPDATED
        assert restored.get_image().read() == FAKE_PNG_BYTES

    def test_convenience_image_constructor_still_infers_updated(self) -> None:
        """The `ScreenshotCachePayload(image=bytes)` convenience path (used by
        the update flow and by tests) must still infer UPDATED from the image."""
        assert ScreenshotCachePayload(image=FAKE_PNG_BYTES).status == (
            StatusValues.UPDATED
        )

    def test_legacy_bytes_reconstruction_still_infers_updated(self) -> None:
        """The legacy positional-bytes reconstruction path (older cache entries
        stored raw image bytes, rebuilt via `ScreenshotCachePayload(payload)`)
        must still yield UPDATED."""
        assert ScreenshotCachePayload(FAKE_PNG_BYTES).status == StatusValues.UPDATED
