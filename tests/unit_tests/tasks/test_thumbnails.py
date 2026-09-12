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

from collections.abc import Callable, Iterator
from typing import Any
from unittest.mock import ANY, MagicMock, patch

import pytest


@pytest.fixture
def mock_thumbnail_cache() -> Iterator[None]:
    """Enable thumbnail cache mocking so tasks don't exit early."""
    cache = MagicMock()
    cache.cache = MagicMock()
    with patch("superset.tasks.thumbnails.thumbnail_cache", cache):
        yield


@pytest.fixture
def mock_dashboard() -> MagicMock:
    """Return a mocked Dashboard with id=1 and a fixed digest."""
    dashboard = MagicMock()
    dashboard.id = 1
    dashboard.digest = "test_digest"
    return dashboard


def _make_screenshot_mock(cache_key: str = "test_cache_key") -> MagicMock:
    """Return a MagicMock screenshot whose get_cache_key returns cache_key."""
    screenshot = MagicMock()
    screenshot.get_cache_key.return_value = cache_key
    return screenshot


# ---------------------------------------------------------------------------
# Helpers shared across tests
# ---------------------------------------------------------------------------

_COMMON_PATCHES = [
    "superset.tasks.thumbnails.get_executor",
    "superset.tasks.thumbnails.security_manager",
    "superset.tasks.thumbnails.override_user",
    "superset.tasks.thumbnails.get_url_path",
    "superset.tasks.thumbnails.DashboardScreenshot",
]


def _apply_patches(fn: Callable[..., Any]) -> Callable[..., Any]:
    """Stack the five common patches onto a test function."""
    for p in reversed(_COMMON_PATCHES):
        fn = patch(p, new_callable=MagicMock)(fn)
    return fn


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------


@patch("superset.tasks.thumbnails.thumbnail_cache", None)
def test_cache_dashboard_thumbnail_skips_when_no_cache() -> None:
    """Task exits early when no thumbnail cache is configured."""
    from superset.tasks.thumbnails import cache_dashboard_thumbnail

    result = cache_dashboard_thumbnail(current_user="admin", dashboard_id=1, force=True)

    assert result is None


@_apply_patches
def test_cache_dashboard_thumbnail_always_delegates_to_compute_and_cache(
    mock_screenshot_cls: MagicMock,
    mock_get_url_path: MagicMock,
    mock_override_user: MagicMock,
    mock_security_manager: MagicMock,
    mock_get_executor: MagicMock,
    mock_dashboard: MagicMock,
    mock_thumbnail_cache: None,
) -> None:
    """Task always calls compute_and_cache; dedup lives inside compute_and_cache."""
    from superset.tasks.thumbnails import cache_dashboard_thumbnail

    mock_screenshot = _make_screenshot_mock()
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


@_apply_patches
def test_cache_dashboard_thumbnail_resolves_cache_key_when_not_provided(
    mock_screenshot_cls: MagicMock,
    mock_get_url_path: MagicMock,
    mock_override_user: MagicMock,
    mock_security_manager: MagicMock,
    mock_get_executor: MagicMock,
    mock_dashboard: MagicMock,
    mock_thumbnail_cache: None,
) -> None:
    """Task resolves cache_key from the screenshot object when none is given."""
    from superset.tasks.thumbnails import cache_dashboard_thumbnail

    mock_screenshot = _make_screenshot_mock("resolved_cache_key")
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

    mock_screenshot.get_cache_key.assert_called_once()
    mock_screenshot.compute_and_cache.assert_called_once_with(
        user=ANY,
        window_size=None,
        thumb_size=None,
        force=False,
        cache_key="resolved_cache_key",
    )


@_apply_patches
def test_cache_dashboard_screenshot_requires_complete_capture(
    mock_screenshot_cls: MagicMock,
    mock_get_url_path: MagicMock,
    mock_override_user: MagicMock,
    mock_security_manager: MagicMock,
    mock_get_executor: MagicMock,
    mock_dashboard: MagicMock,
    mock_thumbnail_cache: None,
) -> None:
    """Direct API captures opt into fail-closed rendering."""
    from superset.tasks.thumbnails import cache_dashboard_screenshot

    mock_screenshot = _make_screenshot_mock()
    mock_screenshot_cls.return_value = mock_screenshot
    mock_get_executor.return_value = (None, "admin")
    mock_security_manager.find_user.return_value = MagicMock()

    with patch("superset.models.dashboard.Dashboard.get", return_value=mock_dashboard):
        cache_dashboard_screenshot(
            username="admin",
            dashboard_id=1,
            dashboard_url="/dashboard/p/test/",
            force=False,
            cache_key="test_cache_key",
        )

    mock_screenshot_cls.assert_called_once_with(
        "/dashboard/p/test/",
        "test_digest",
        require_complete_capture=True,
    )
    mock_screenshot.compute_and_cache.assert_called_once_with(
        user=ANY,
        window_size=None,
        thumb_size=None,
        cache_key="test_cache_key",
        force=False,
        retry_fresh_error=True,
    )


@_apply_patches
def test_cache_dashboard_screenshot_setup_failure_persists_error(
    mock_screenshot_cls: MagicMock,
    mock_get_url_path: MagicMock,
    mock_override_user: MagicMock,
    mock_security_manager: MagicMock,
    mock_get_executor: MagicMock,
    mock_dashboard: MagicMock,
    mock_thumbnail_cache: None,
) -> None:
    """Failures before browser capture still produce a terminal API status."""
    from superset.tasks.thumbnails import cache_dashboard_screenshot

    mock_get_executor.side_effect = RuntimeError("executor unavailable")

    with (
        patch("superset.models.dashboard.Dashboard.get", return_value=mock_dashboard),
        pytest.raises(RuntimeError, match="executor unavailable"),
    ):
        cache_dashboard_screenshot(
            username="admin",
            dashboard_id=1,
            dashboard_url="/dashboard/p/test/",
            force=False,
            cache_key="test_cache_key",
        )

    mock_screenshot_cls.store_error_if_no_active_task.assert_called_once_with(
        "test_cache_key",
        scope="dashboard:1",
    )


def test_cache_dashboard_screenshot_skips_real_null_cache() -> None:
    """The truthy default NullCache must not accept invisible screenshot work."""
    from flask_caching.backends import NullCache

    from superset.tasks.thumbnails import cache_dashboard_screenshot

    cache = MagicMock()
    cache.cache = NullCache()
    with (
        patch("superset.tasks.thumbnails.thumbnail_cache", cache),
        patch("superset.models.dashboard.Dashboard.get") as mock_get_dashboard,
    ):
        cache_dashboard_screenshot(
            username="admin",
            dashboard_id=1,
            dashboard_url="/dashboard/p/test/",
            force=False,
            cache_key="test_cache_key",
        )

    mock_get_dashboard.assert_not_called()
