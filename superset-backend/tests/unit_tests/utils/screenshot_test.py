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

from unittest.mock import MagicMock

import pytest
from pytest_mock import MockerFixture

from superset.utils.hashing import md5_sha_from_dict
from superset.utils.screenshots import (
    BaseScreenshot,
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
