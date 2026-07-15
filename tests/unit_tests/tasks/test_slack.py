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

from typing import Any, Optional

from superset.tasks.slack import (
    cache_channels,
    DEFAULT_CACHE_WARMUP_TIME_LIMIT,
    get_cache_warmup_options,
)
from superset.utils.slack import (
    SLACK_CHANNELS_CACHE_KEY,
    SLACK_CHANNELS_CONTINUATION_CURSOR_KEY,
)


def _page(ids: list[str], next_cursor: Optional[str], has_more: bool) -> dict[str, Any]:
    return {
        "result": [{"id": channel_id} for channel_id in ids],
        "next_cursor": next_cursor,
        "has_more": has_more,
    }


def _patch_task(mocker, config, fetch_pages):
    """Patch the task's collaborators and return the mocked cache."""
    mock_app = mocker.patch("superset.tasks.slack.current_app")
    mock_app.config = config
    mock_fetch = mocker.patch(
        "superset.tasks.slack._fetch_from_api", side_effect=fetch_pages
    )
    mock_cache = mocker.patch("superset.tasks.slack.cache_manager")
    return mock_fetch, mock_cache


def test_get_cache_warmup_options_uses_configured_timeout(mocker):
    mock_app = mocker.patch("superset.tasks.slack.current_app")
    mock_app.config = {"SLACK_CACHE_WARMUP_TIMEOUT": 600}

    assert get_cache_warmup_options() == {
        "time_limit": 600,
        "soft_time_limit": 480,
    }


def test_get_cache_warmup_options_falls_back_to_default(mocker):
    mock_app = mocker.patch("superset.tasks.slack.current_app")
    mock_app.config = {}

    options = get_cache_warmup_options()

    assert options["time_limit"] == DEFAULT_CACHE_WARMUP_TIME_LIMIT
    assert options["soft_time_limit"] == int(DEFAULT_CACHE_WARMUP_TIME_LIMIT * 0.8)


def test_cache_channels_skips_when_caching_disabled(mocker):
    _, mock_cache = _patch_task(mocker, {"SLACK_ENABLE_CACHING": False}, fetch_pages=[])

    cache_channels()

    mock_cache.cache.set.assert_not_called()


def test_cache_channels_caches_all_and_clears_continuation(mocker):
    """When the whole workspace fits under the cap, cache everything and clear
    the continuation cursor."""
    config = {
        "SLACK_ENABLE_CACHING": True,
        "SLACK_CACHE_TIMEOUT": 86400,
        "SLACK_CACHE_MAX_CHANNELS": 20000,
    }
    pages = [
        _page(["C1", "C2"], next_cursor="cur1", has_more=True),
        _page(["C3"], next_cursor=None, has_more=False),
    ]
    _, mock_cache = _patch_task(mocker, config, pages)

    cache_channels()

    mock_cache.cache.set.assert_called_once_with(
        SLACK_CHANNELS_CACHE_KEY,
        [{"id": "C1"}, {"id": "C2"}, {"id": "C3"}],
        timeout=86400,
    )
    # No truncation -> continuation cursor is cleared, not set.
    mock_cache.cache.delete.assert_called_once_with(
        SLACK_CHANNELS_CONTINUATION_CURSOR_KEY
    )


def test_cache_channels_truncates_and_stores_continuation(mocker):
    """When the workspace exceeds SLACK_CACHE_MAX_CHANNELS, the cache is
    truncated to the cap and a continuation cursor is stored for the rest."""
    config = {
        "SLACK_ENABLE_CACHING": True,
        "SLACK_CACHE_TIMEOUT": 86400,
        "SLACK_CACHE_MAX_CHANNELS": 2,
    }
    pages = [
        _page(["C1", "C2"], next_cursor="cur1", has_more=True),
        # This page must never be requested because the cap is hit first.
        _page(["C3"], next_cursor="cur2", has_more=True),
    ]
    mock_fetch, mock_cache = _patch_task(mocker, config, pages)

    cache_channels()

    # Only the first page is fetched before the cap is reached.
    assert mock_fetch.call_count == 1
    mock_cache.cache.set.assert_any_call(
        SLACK_CHANNELS_CACHE_KEY,
        [{"id": "C1"}, {"id": "C2"}],
        timeout=86400,
    )
    mock_cache.cache.set.assert_any_call(
        SLACK_CHANNELS_CONTINUATION_CURSOR_KEY,
        "cur1",
        timeout=86400,
    )
    mock_cache.cache.delete.assert_not_called()
