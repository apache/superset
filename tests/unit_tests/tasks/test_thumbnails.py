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

from unittest.mock import MagicMock, patch

import pytest

from superset.utils.screenshots import ScreenshotCachePayload


@pytest.fixture
def mock_thumbnail_cache():
    with patch("superset.tasks.thumbnails.thumbnail_cache", True):
        yield


@pytest.fixture
def mock_dashboard():
    dashboard = MagicMock()
    dashboard.id = 1
    dashboard.digest = "test_digest"
    return dashboard


@pytest.fixture
def mock_screenshot():
    screenshot = MagicMock()
    screenshot.get_cache_key.return_value = "test_cache_key"
    return screenshot


@patch("superset.tasks.thumbnails.get_executor")
@patch("superset.tasks.thumbnails.security_manager")
@patch("superset.tasks.thumbnails.override_user")
@patch("superset.tasks.thumbnails.get_url_path")
@patch("superset.tasks.thumbnails.DashboardScreenshot")
def test_cache_dashboard_thumbnail_skips_when_already_computing(
    mock_screenshot_cls,
    mock_get_url_path,
    mock_override_user,
    mock_security_manager,
    mock_get_executor,
    mock_dashboard,
    mock_thumbnail_cache,
):
    """Task should skip when another task is already computing the same thumbnail."""
    from superset.tasks.thumbnails import cache_dashboard_thumbnail

    # Set up a COMPUTING payload that is NOT stale
    computing_payload = ScreenshotCachePayload()
    computing_payload.computing()

    mock_screenshot = MagicMock()
    mock_screenshot.get_cache_key.return_value = "test_cache_key"
    mock_screenshot.get_from_cache_key.return_value = computing_payload
    mock_screenshot_cls.return_value = mock_screenshot

    with patch("superset.models.dashboard.Dashboard.get", return_value=mock_dashboard):
        cache_dashboard_thumbnail(
            current_user="admin",
            dashboard_id=1,
            force=True,
            cache_key="test_cache_key",
        )

    # compute_and_cache should NOT be called since another task is computing
    mock_screenshot.compute_and_cache.assert_not_called()


@patch("superset.tasks.thumbnails.get_executor")
@patch("superset.tasks.thumbnails.security_manager")
@patch("superset.tasks.thumbnails.override_user")
@patch("superset.tasks.thumbnails.get_url_path")
@patch("superset.tasks.thumbnails.DashboardScreenshot")
def test_cache_dashboard_thumbnail_proceeds_when_computing_is_stale(
    mock_screenshot_cls,
    mock_get_url_path,
    mock_override_user,
    mock_security_manager,
    mock_get_executor,
    mock_dashboard,
    mock_thumbnail_cache,
):
    """Task should proceed when computing status is stale (stuck task)."""
    from superset.tasks.thumbnails import cache_dashboard_thumbnail

    # Set up a COMPUTING payload that IS stale
    computing_payload = ScreenshotCachePayload()
    computing_payload.computing()
    computing_payload.is_computing_stale = MagicMock(return_value=True)

    mock_screenshot = MagicMock()
    mock_screenshot.get_cache_key.return_value = "test_cache_key"
    mock_screenshot.get_from_cache_key.return_value = computing_payload
    mock_screenshot_cls.return_value = mock_screenshot

    mock_get_executor.return_value = (None, "admin")
    mock_security_manager.find_user.return_value = MagicMock()

    with patch("superset.models.dashboard.Dashboard.get", return_value=mock_dashboard):
        cache_dashboard_thumbnail(
            current_user="admin",
            dashboard_id=1,
            force=True,
            cache_key="test_cache_key",
        )

    # compute_and_cache SHOULD be called since the computing status is stale
    mock_screenshot.compute_and_cache.assert_called_once()


@patch("superset.tasks.thumbnails.get_executor")
@patch("superset.tasks.thumbnails.security_manager")
@patch("superset.tasks.thumbnails.override_user")
@patch("superset.tasks.thumbnails.get_url_path")
@patch("superset.tasks.thumbnails.DashboardScreenshot")
def test_cache_dashboard_thumbnail_proceeds_when_no_existing_cache(
    mock_screenshot_cls,
    mock_get_url_path,
    mock_override_user,
    mock_security_manager,
    mock_get_executor,
    mock_dashboard,
    mock_thumbnail_cache,
):
    """Task should proceed when there's no existing cache entry."""
    from superset.tasks.thumbnails import cache_dashboard_thumbnail

    mock_screenshot = MagicMock()
    mock_screenshot.get_cache_key.return_value = "test_cache_key"
    mock_screenshot.get_from_cache_key.return_value = None
    mock_screenshot_cls.return_value = mock_screenshot

    mock_get_executor.return_value = (None, "admin")
    mock_security_manager.find_user.return_value = MagicMock()

    with patch("superset.models.dashboard.Dashboard.get", return_value=mock_dashboard):
        cache_dashboard_thumbnail(
            current_user="admin",
            dashboard_id=1,
            force=False,
            cache_key="test_cache_key",
        )

    mock_screenshot.compute_and_cache.assert_called_once()


@patch("superset.tasks.thumbnails.get_executor")
@patch("superset.tasks.thumbnails.security_manager")
@patch("superset.tasks.thumbnails.override_user")
@patch("superset.tasks.thumbnails.get_url_path")
@patch("superset.tasks.thumbnails.DashboardScreenshot")
def test_cache_dashboard_thumbnail_proceeds_when_status_is_pending(
    mock_screenshot_cls,
    mock_get_url_path,
    mock_override_user,
    mock_security_manager,
    mock_get_executor,
    mock_dashboard,
    mock_thumbnail_cache,
):
    """Task should proceed when cache status is PENDING."""
    from superset.tasks.thumbnails import cache_dashboard_thumbnail

    pending_payload = ScreenshotCachePayload()

    mock_screenshot = MagicMock()
    mock_screenshot.get_cache_key.return_value = "test_cache_key"
    mock_screenshot.get_from_cache_key.return_value = pending_payload
    mock_screenshot_cls.return_value = mock_screenshot

    mock_get_executor.return_value = (None, "admin")
    mock_security_manager.find_user.return_value = MagicMock()

    with patch("superset.models.dashboard.Dashboard.get", return_value=mock_dashboard):
        cache_dashboard_thumbnail(
            current_user="admin",
            dashboard_id=1,
            force=False,
            cache_key="test_cache_key",
        )

    mock_screenshot.compute_and_cache.assert_called_once()


@patch("superset.tasks.thumbnails.get_executor")
@patch("superset.tasks.thumbnails.security_manager")
@patch("superset.tasks.thumbnails.override_user")
@patch("superset.tasks.thumbnails.get_url_path")
@patch("superset.tasks.thumbnails.DashboardScreenshot")
def test_cache_dashboard_thumbnail_proceeds_when_status_is_error(
    mock_screenshot_cls,
    mock_get_url_path,
    mock_override_user,
    mock_security_manager,
    mock_get_executor,
    mock_dashboard,
    mock_thumbnail_cache,
):
    """Task should proceed when cache status is ERROR."""
    from superset.tasks.thumbnails import cache_dashboard_thumbnail

    error_payload = ScreenshotCachePayload()
    error_payload.error()

    mock_screenshot = MagicMock()
    mock_screenshot.get_cache_key.return_value = "test_cache_key"
    mock_screenshot.get_from_cache_key.return_value = error_payload
    mock_screenshot_cls.return_value = mock_screenshot

    mock_get_executor.return_value = (None, "admin")
    mock_security_manager.find_user.return_value = MagicMock()

    with patch("superset.models.dashboard.Dashboard.get", return_value=mock_dashboard):
        cache_dashboard_thumbnail(
            current_user="admin",
            dashboard_id=1,
            force=False,
            cache_key="test_cache_key",
        )

    mock_screenshot.compute_and_cache.assert_called_once()


@patch("superset.tasks.thumbnails.thumbnail_cache", None)
def test_cache_dashboard_thumbnail_skips_when_no_cache():
    """Task should skip when no thumbnail cache is configured."""
    from superset.tasks.thumbnails import cache_dashboard_thumbnail

    result = cache_dashboard_thumbnail(
        current_user="admin",
        dashboard_id=1,
        force=True,
    )

    assert result is None


@patch("superset.tasks.thumbnails.get_executor")
@patch("superset.tasks.thumbnails.security_manager")
@patch("superset.tasks.thumbnails.override_user")
@patch("superset.tasks.thumbnails.get_url_path")
@patch("superset.tasks.thumbnails.DashboardScreenshot")
def test_cache_dashboard_thumbnail_resolves_cache_key_when_not_provided(
    mock_screenshot_cls,
    mock_get_url_path,
    mock_override_user,
    mock_security_manager,
    mock_get_executor,
    mock_dashboard,
    mock_thumbnail_cache,
):
    """Task should resolve cache_key from screenshot when not explicitly provided."""
    from superset.tasks.thumbnails import cache_dashboard_thumbnail

    mock_screenshot = MagicMock()
    mock_screenshot.get_cache_key.return_value = "resolved_cache_key"
    mock_screenshot.get_from_cache_key.return_value = None
    mock_screenshot_cls.return_value = mock_screenshot

    mock_get_executor.return_value = (None, "admin")
    mock_security_manager.find_user.return_value = MagicMock()

    with patch("superset.models.dashboard.Dashboard.get", return_value=mock_dashboard):
        cache_dashboard_thumbnail(
            current_user="admin",
            dashboard_id=1,
            force=False,
            cache_key=None,
        )

    # Should resolve cache key from screenshot object
    mock_screenshot.get_cache_key.assert_called_once()
    mock_screenshot.get_from_cache_key.assert_called_once_with("resolved_cache_key")
