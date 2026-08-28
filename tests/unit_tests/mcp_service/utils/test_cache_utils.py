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
Unit tests for MCP service cache utilities.
"""

from datetime import datetime, timedelta, timezone
from typing import Any

from superset.mcp_service.common.cache_schemas import CacheStatus
from superset.mcp_service.utils.cache_utils import (
    apply_cache_control_to_query_context,
    get_cache_key_info,
    get_cache_status_from_result,
    should_use_metadata_cache,
)

# ---------------------------------------------------------------------------
# get_cache_status_from_result
# ---------------------------------------------------------------------------


def test_get_cache_status_from_result_reads_from_queries_list() -> None:
    """Should pull cache_hit from the first entry of a 'queries' list."""
    result: dict[str, Any] = {"queries": [{"is_cached": True}]}

    status: CacheStatus = get_cache_status_from_result(result)

    assert status.cache_hit is True
    assert status.cache_type == "query"


def test_get_cache_status_from_result_falls_back_to_top_level_dict() -> None:
    """Should read cache info directly from the result when no 'queries' key."""
    result: dict[str, Any] = {"is_cached": False}

    status = get_cache_status_from_result(result)

    assert status.cache_hit is False
    assert status.cache_type == "none"


def test_get_cache_status_from_result_empty_queries_list_uses_top_level() -> None:
    """Should fall back to the top-level dict when 'queries' is an empty list."""
    result: dict[str, Any] = {"queries": [], "is_cached": True}

    status = get_cache_status_from_result(result)

    assert status.cache_hit is True


def test_get_cache_status_from_result_defaults_cache_hit_to_false() -> None:
    """Should treat a missing 'is_cached' key as not cached."""
    result: dict[str, Any] = {}

    status = get_cache_status_from_result(result)

    assert status.cache_hit is False
    assert status.cache_type == "none"


def test_get_cache_status_from_result_reflects_force_refresh_flag() -> None:
    """Should surface the caller-provided force_refresh value on the status."""
    result: dict[str, Any] = {"is_cached": True}

    status = get_cache_status_from_result(result, force_refresh=True)

    assert status.refreshed is True


def test_get_cache_status_from_result_parses_iso_string_cache_age() -> None:
    """Should compute cache_age_seconds from an ISO-formatted cache_dttm string."""
    cache_dt: datetime = datetime.now(timezone.utc) - timedelta(seconds=120)
    result: dict[str, Any] = {
        "is_cached": True,
        "cache_dttm": cache_dt.isoformat(),
    }

    status = get_cache_status_from_result(result)

    assert status.cache_age_seconds is not None
    assert status.cache_age_seconds >= 119


def test_get_cache_status_from_result_parses_z_suffixed_string() -> None:
    """Should handle a trailing 'Z' UTC designator in the cache_dttm string."""
    result: dict[str, Any] = {
        "is_cached": True,
        "cache_dttm": "2020-01-01T00:00:00Z",
    }

    status = get_cache_status_from_result(result)

    assert status.cache_age_seconds is not None
    assert status.cache_age_seconds > 0


def test_get_cache_status_from_result_parses_datetime_object_cache_age() -> None:
    """Should compute cache_age_seconds when cache_dttm is already a datetime."""
    cache_dt = datetime.now(timezone.utc) - timedelta(seconds=60)
    result: dict[str, Any] = {"is_cached": True, "cache_dttm": cache_dt}

    status = get_cache_status_from_result(result)

    assert status.cache_age_seconds is not None
    assert status.cache_age_seconds >= 59


def test_get_cache_status_from_result_handles_unparseable_cache_dttm() -> None:
    """Should swallow parse errors and leave cache_age_seconds as None."""
    result: dict[str, Any] = {"is_cached": True, "cache_dttm": "not-a-date"}

    status = get_cache_status_from_result(result)

    assert status.cache_age_seconds is None
    # The rest of the status should still be populated correctly.
    assert status.cache_hit is True


def test_get_cache_status_from_result_no_cache_dttm_leaves_age_none() -> None:
    """Should leave cache_age_seconds as None when cache_dttm is absent."""
    result: dict[str, Any] = {"is_cached": True}

    status = get_cache_status_from_result(result)

    assert status.cache_age_seconds is None


# ---------------------------------------------------------------------------
# apply_cache_control_to_query_context
# ---------------------------------------------------------------------------


def test_apply_cache_control_sets_force_when_cache_disabled() -> None:
    """Should set force=True on the query context when use_cache is False."""
    ctx: dict[str, Any] = apply_cache_control_to_query_context(
        {"queries": []}, use_cache=False
    )

    assert ctx["force"] is True


def test_apply_cache_control_sets_force_when_force_refresh_requested() -> None:
    """Should set force=True on the query context when force_refresh is True."""
    ctx = apply_cache_control_to_query_context(
        {"queries": []}, use_cache=True, force_refresh=True
    )

    assert ctx["force"] is True


def test_apply_cache_control_does_not_set_force_when_using_cache() -> None:
    """Should leave 'force' unset when caching is enabled and not refreshing."""
    ctx = apply_cache_control_to_query_context(
        {"queries": []}, use_cache=True, force_refresh=False
    )

    assert "force" not in ctx


def test_apply_cache_control_applies_cache_timeout_to_every_query() -> None:
    """Should stamp cache_timeout onto every query in the context."""
    ctx = apply_cache_control_to_query_context(
        {"queries": [{"metric": "a"}, {"metric": "b"}]}, cache_timeout=60
    )

    assert ctx["queries"][0]["cache_timeout"] == 60
    assert ctx["queries"][1]["cache_timeout"] == 60


def test_apply_cache_control_leaves_queries_untouched_when_timeout_is_none() -> None:
    """Should not add a cache_timeout key when none is provided."""
    ctx = apply_cache_control_to_query_context(
        {"queries": [{"metric": "a"}]}, cache_timeout=None
    )

    assert "cache_timeout" not in ctx["queries"][0]


def test_apply_cache_control_missing_queries_key_is_a_noop_for_timeout() -> None:
    """Should not raise or add a 'queries' key when applying a cache_timeout."""
    ctx = apply_cache_control_to_query_context({}, cache_timeout=60)

    assert "queries" not in ctx


def test_apply_cache_control_returns_the_same_dict_instance() -> None:
    """Should mutate and return the same query_context object it was given."""
    original: dict[str, Any] = {"queries": []}

    result = apply_cache_control_to_query_context(original, use_cache=False)

    assert result is original


# ---------------------------------------------------------------------------
# should_use_metadata_cache
# ---------------------------------------------------------------------------


def test_should_use_metadata_cache_true_by_default() -> None:
    """Should default to using the metadata cache."""
    assert should_use_metadata_cache() is True


def test_should_use_metadata_cache_false_when_cache_disabled() -> None:
    """Should return False when use_cache is False."""
    assert should_use_metadata_cache(use_cache=False) is False


def test_should_use_metadata_cache_false_when_refresh_requested() -> None:
    """Should return False when refresh_metadata is True, even with use_cache."""
    assert should_use_metadata_cache(use_cache=True, refresh_metadata=True) is False


def test_should_use_metadata_cache_true_when_enabled_and_not_refreshing() -> None:
    """Should return True when caching is enabled and no refresh is requested."""
    assert should_use_metadata_cache(use_cache=True, refresh_metadata=False) is True


# ---------------------------------------------------------------------------
# get_cache_key_info
# ---------------------------------------------------------------------------


def test_get_cache_key_info_returns_none_for_none_input() -> None:
    """Should return None when no cache key is provided."""
    assert get_cache_key_info(None) is None


def test_get_cache_key_info_returns_none_for_empty_string() -> None:
    """Should treat an empty string cache key the same as no key."""
    assert get_cache_key_info("") is None


def test_get_cache_key_info_returns_short_keys_unchanged() -> None:
    """Should return short cache keys unmodified."""
    key: str = "short_cache_key"
    assert get_cache_key_info(key) == key


def test_get_cache_key_info_truncates_long_keys() -> None:
    """Should truncate cache keys longer than 50 characters with an ellipsis."""
    key = "a" * 60

    result = get_cache_key_info(key)

    assert result == "a" * 47 + "..."
    assert result is not None
    assert len(result) == 50


def test_get_cache_key_info_exactly_fifty_chars_is_not_truncated() -> None:
    """Should leave a cache key of exactly 50 characters untouched."""
    key = "b" * 50
    assert get_cache_key_info(key) == key
