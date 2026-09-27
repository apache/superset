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
Unit tests for MCP service response size utilities.
"""

from typing import Any, List
from unittest.mock import patch

import pytest
from pydantic import BaseModel

from superset.mcp_service.utils.response_size_utils import (
    _bisect_string_length,
    _MAX_DICT_KEYS,
    _MAX_STRING_CHARS,
    _MIN_STRING_CHARS,
    _replace_collections_with_summaries,
    _STRING_FIELD_TRUNCATION_MARKERS,
    _summarize_large_dicts,
    _truncate_lists,
    _truncate_strings,
    _truncate_strings_recursive,
    COMMITTED_WRITE_SPECS,
    COMMITTED_WRITE_TOOLS,
    extract_query_params,
    format_size_limit_error,
    generate_size_reduction_suggestions,
    get_response_size_bytes,
    INFO_TOOLS,
    string_clip_chars,
    STRING_FIELD_TRUNCATION_TOOLS,
    truncate_oversized_response,
    truncate_query_result,
    truncate_string_field_response,
    UNMEASURABLE_RESPONSE_BYTES,
)


class TestGetResponseSizeBytes:
    """Test get_response_size_bytes function."""

    class MockResponse(BaseModel):
        """Mock Pydantic response model."""

        name: str
        value: int
        items: List[Any]

    def test_size_dict(self) -> None:
        """Should return size in bytes for dict."""
        response = {"name": "test"}
        result = get_response_size_bytes(response)
        assert result > 0

    def test_size_string(self) -> None:
        """Should return size in bytes for string."""
        response = "Hello world"
        result = get_response_size_bytes(response)
        assert result == len(response.encode("utf-8"))

    def test_size_bytes(self) -> None:
        """Should return size for bytes."""
        response = b"Hello world"
        result = get_response_size_bytes(response)
        assert result == len(response)

    def test_size_pydantic_model(self) -> None:
        """Should return size in bytes for a Pydantic model."""
        response = self.MockResponse(name="test", value=42, items=[1, 2, 3])
        result = get_response_size_bytes(response)
        assert result > 0

    def test_size_list(self) -> None:
        """Should return size in bytes for a list."""
        response = [{"name": "item1"}, {"name": "item2"}]
        result = get_response_size_bytes(response)
        assert result > 0

    def test_size_large_response(self) -> None:
        """A larger response should measure a correspondingly larger size."""
        small = {"items": [{"name": f"item{i}"} for i in range(10)]}
        large = {"items": [{"name": f"item{i}"} for i in range(1000)]}
        assert get_response_size_bytes(large) > get_response_size_bytes(small)

    def test_unmeasurable_response_reads_as_oversized(self) -> None:
        """A serialization failure must exceed any configurable limit.

        A fixed fallback (say 1 MB) would count as "fits" for an operator who
        set ``max_bytes`` at or above it, letting an unmeasured response
        through the guard.
        """
        with patch("superset.utils.json.dumps", side_effect=MemoryError("boom")):
            result = get_response_size_bytes({"data": "x"})
        assert result == UNMEASURABLE_RESPONSE_BYTES
        assert result > 1_000_000_000


class TestStringClipChars:
    """Test the budget-derived string clip length."""

    def test_default_budget_keeps_full_clip_length(self) -> None:
        """The 50 KB default budget must not change the historical clip."""
        assert string_clip_chars(50_000) == _MAX_STRING_CHARS

    def test_small_budget_scales_clip_length_down(self) -> None:
        """A budget below ``4 * ceiling`` shrinks the clip proportionally."""
        assert string_clip_chars(500) == 125
        assert string_clip_chars(1000) == 250

    def test_floor_keeps_strings_recognizable(self) -> None:
        """Even a tiny budget leaves ``_MIN_STRING_CHARS`` of each string."""
        assert string_clip_chars(50) == _MIN_STRING_CHARS
        assert string_clip_chars(0) == _MIN_STRING_CHARS

    def test_ceiling_is_respected(self) -> None:
        """A caller-supplied ceiling (e.g. committed-write fields) is honored."""
        assert string_clip_chars(100_000, ceiling=200) == 200
        assert string_clip_chars(400, ceiling=200) == 100


class TestExtractQueryParams:
    """Test extract_query_params function."""

    def test_extract_pagination_params(self) -> None:
        """Should extract pagination parameters."""
        params = {"page_size": 100, "limit": 50}
        result = extract_query_params(params)
        assert result["page_size"] == 100
        assert result["limit"] == 50

    def test_extract_column_selection(self) -> None:
        """Should extract column selection parameters."""
        params = {"select_columns": ["name", "id"]}
        result = extract_query_params(params)
        assert result["select_columns"] == ["name", "id"]

    def test_extract_from_nested_request(self) -> None:
        """Should extract from nested request object."""
        params = {"request": {"page_size": 50, "filters": [{"col": "name"}]}}
        result = extract_query_params(params)
        assert result["page_size"] == 50
        assert result["filters"] == [{"col": "name"}]

    def test_empty_params(self) -> None:
        """Should return empty dict for empty params."""
        assert extract_query_params(None) == {}
        assert extract_query_params({}) == {}

    def test_extract_filters(self) -> None:
        """Should extract filter parameters."""
        params = {"filters": [{"col": "name", "opr": "eq", "value": "test"}]}
        result = extract_query_params(params)
        assert "filters" in result


class TestGenerateSizeReductionSuggestions:
    """Test generate_size_reduction_suggestions function."""

    def test_suggest_reduce_page_size(self) -> None:
        """Should suggest reducing page_size when present."""
        params = {"page_size": 100}
        suggestions = generate_size_reduction_suggestions(
            tool_name="list_charts",
            params=params,
            actual_bytes=50000,
            max_bytes=25000,
        )
        assert any(
            "page_size" in s.lower() or "limit" in s.lower() for s in suggestions
        )

    def test_suggest_add_limit_for_list_tools(self) -> None:
        """Should suggest adding limit for list tools."""
        params: dict[str, Any] = {}
        suggestions = generate_size_reduction_suggestions(
            tool_name="list_charts",
            params=params,
            actual_bytes=50000,
            max_bytes=25000,
        )
        assert any(
            "limit" in s.lower() or "page_size" in s.lower() for s in suggestions
        )

    def test_suggest_select_columns(self) -> None:
        """Should suggest using select_columns."""
        params: dict[str, Any] = {}
        suggestions = generate_size_reduction_suggestions(
            tool_name="list_charts",
            params=params,
            actual_bytes=50000,
            max_bytes=25000,
        )
        assert any(
            "select_columns" in s.lower() or "columns" in s.lower() for s in suggestions
        )

    def test_suggest_filters(self) -> None:
        """Should suggest adding filters."""
        params: dict[str, Any] = {}
        suggestions = generate_size_reduction_suggestions(
            tool_name="list_charts",
            params=params,
            actual_bytes=50000,
            max_bytes=25000,
        )
        assert any("filter" in s.lower() for s in suggestions)
        assert not any("editor" in s.lower() for s in suggestions)
        assert any("non-user attributes" in s for s in suggestions)

    def test_tool_specific_suggestions_execute_sql(self) -> None:
        """Should provide SQL-specific suggestions for execute_sql."""
        suggestions = generate_size_reduction_suggestions(
            tool_name="execute_sql",
            params={"sql": "SELECT * FROM table"},
            actual_bytes=50000,
            max_bytes=25000,
        )
        combined = " ".join(suggestions)
        # Should suggest SQL LIMIT clause
        assert "LIMIT" in combined
        # Should suggest the tool's limit parameter
        assert "'limit' parameter" in combined.lower() or "limit=" in combined.lower()

    def test_execute_sql_with_limit_param_no_duplicate_suggestion(self) -> None:
        """When limit param is already set, should not suggest adding it again."""
        suggestions = generate_size_reduction_suggestions(
            tool_name="execute_sql",
            params={"sql": "SELECT * FROM table", "limit": 500},
            actual_bytes=50000,
            max_bytes=25000,
        )
        combined = " ".join(suggestions)
        # Should still suggest SQL LIMIT
        assert "LIMIT" in combined
        # Should suggest reducing the existing limit (from general suggestion)
        assert "500" in combined or "limit" in combined.lower()

    def test_tool_specific_suggestions_list_charts(self) -> None:
        """Should provide chart-specific suggestions for list_charts."""
        suggestions = generate_size_reduction_suggestions(
            tool_name="list_charts",
            params={},
            actual_bytes=50000,
            max_bytes=25000,
        )
        # Should suggest excluding params or query_context
        assert any(
            "params" in s.lower() or "query_context" in s.lower() for s in suggestions
        )

    def test_suggests_search_parameter(self) -> None:
        """Should suggest using search parameter."""
        suggestions = generate_size_reduction_suggestions(
            tool_name="list_dashboards",
            params={},
            actual_bytes=50000,
            max_bytes=25000,
        )
        assert any("search" in s.lower() for s in suggestions)


class TestFormatSizeLimitError:
    """Test format_size_limit_error function."""

    def test_error_contains_byte_counts(self) -> None:
        """Should include byte counts in error message."""
        error = format_size_limit_error(
            tool_name="list_charts",
            params={},
            actual_bytes=50000,
            max_bytes=25000,
        )
        assert "50,000" in error
        assert "25,000" in error

    def test_error_contains_tool_name(self) -> None:
        """Should include tool name in error message."""
        error = format_size_limit_error(
            tool_name="list_charts",
            params={},
            actual_bytes=50000,
            max_bytes=25000,
        )
        assert "list_charts" in error

    def test_error_contains_suggestions(self) -> None:
        """Should include suggestions in error message."""
        error = format_size_limit_error(
            tool_name="list_charts",
            params={"page_size": 100},
            actual_bytes=50000,
            max_bytes=25000,
        )
        # Should have numbered suggestions
        assert "1." in error

    def test_error_contains_reduction_percentage(self) -> None:
        """Should include reduction percentage in error message."""
        error = format_size_limit_error(
            tool_name="list_charts",
            params={},
            actual_bytes=50000,
            max_bytes=25000,
        )
        # 50% reduction needed
        assert "50%" in error or "Reduction" in error

    def test_error_limits_suggestions_to_five(self) -> None:
        """Should limit suggestions to 5."""
        error = format_size_limit_error(
            tool_name="list_charts",
            params={},
            actual_bytes=100000,
            max_bytes=10000,
        )
        # Count numbered suggestions (1. through 5.)
        suggestion_count = sum(1 for i in range(1, 10) if f"{i}." in error)
        assert suggestion_count <= 5

    def test_error_message_is_readable(self) -> None:
        """Should produce human-readable error message."""
        error = format_size_limit_error(
            tool_name="list_charts",
            params={"page_size": 100},
            actual_bytes=75000,
            max_bytes=25000,
        )
        # Should be multi-line and contain key information
        lines = error.split("\n")
        assert len(lines) > 5
        assert "Response too large" in error
        assert "Please modify your query" in error


class TestCalculatedSuggestions:
    """Test that suggestions include calculated values."""

    def test_suggested_limit_is_calculated(self) -> None:
        """Should calculate suggested limit based on reduction needed."""
        params = {"page_size": 100}
        suggestions = generate_size_reduction_suggestions(
            tool_name="list_charts",
            params=params,
            actual_bytes=50000,  # 2x over limit
            max_bytes=25000,
        )
        # Find the page_size suggestion
        page_size_suggestion = next(
            (s for s in suggestions if "page_size" in s.lower()), None
        )
        assert page_size_suggestion is not None
        # Should suggest reducing from 100 to approximately 50
        assert "100" in page_size_suggestion
        assert (
            "50" in page_size_suggestion or "reduction" in page_size_suggestion.lower()
        )

    def test_reduction_percentage_in_suggestions(self) -> None:
        """Should include reduction percentage in suggestions."""
        params = {"page_size": 100}
        suggestions = generate_size_reduction_suggestions(
            tool_name="list_charts",
            params=params,
            actual_bytes=75000,  # 3x over limit
            max_bytes=25000,
        )
        # Should mention ~66% reduction needed (int truncation of 66.6%)
        combined = " ".join(suggestions)
        assert "66%" in combined


class TestInfoToolsSet:
    """Test the INFO_TOOLS constant."""

    def test_info_tools_contains_expected_tools(self) -> None:
        """Should contain all info tools."""
        assert "get_chart_info" in INFO_TOOLS
        assert "get_dataset_info" in INFO_TOOLS
        assert "get_dashboard_info" in INFO_TOOLS
        assert "get_instance_info" in INFO_TOOLS

    def test_info_tools_does_not_contain_list_tools(self) -> None:
        """Should not contain list or write tools."""
        assert "list_charts" not in INFO_TOOLS
        assert "execute_sql" not in INFO_TOOLS
        assert "generate_chart" not in INFO_TOOLS


class TestCommittedWriteToolsSet:
    """Test the COMMITTED_WRITE_TOOLS constant."""

    def test_contains_update_chart(self) -> None:
        """update_chart commits before the size guard runs and must be
        truncation-eligible instead of hard-blocked."""
        assert "update_chart" in COMMITTED_WRITE_TOOLS

    def test_does_not_contain_read_only_tools(self) -> None:
        """Read-only tools commit nothing, so an oversized response is safe
        to hard-block: there is no completed write for a retry to replay."""
        assert "get_chart_info" not in COMMITTED_WRITE_TOOLS
        assert "list_charts" not in COMMITTED_WRITE_TOOLS
        assert "execute_sql" not in COMMITTED_WRITE_TOOLS

    def test_contains_update_dashboard(self) -> None:
        """update_dashboard commits (db.session.commit(), before it builds
        UpdateDashboardResponse) just as update_chart does, so it satisfies
        the same invariant and must get the same protection -- otherwise an
        oversized response hard-errors after the dashboard was already
        written, and a retrying client replays the mutation."""
        assert "update_dashboard" in COMMITTED_WRITE_TOOLS

    def test_identifying_fields_are_per_tool(self) -> None:
        """The protected field cannot be a single hardcoded name.

        Protecting 'chart' on a dashboard response would protect nothing:
        the field that carries the write confirmation differs per tool, so
        each spec names its own.
        """
        assert COMMITTED_WRITE_SPECS["update_chart"].identifying_fields == frozenset(
            {"chart"}
        )
        assert COMMITTED_WRITE_SPECS[
            "update_dashboard"
        ].identifying_fields == frozenset({"dashboard"})
        assert COMMITTED_WRITE_SPECS[
            "update_dataset_metric"
        ].identifying_fields == frozenset({"metric"})

    def test_scalar_identity_tools_protect_nothing(self) -> None:
        """No truncation phase drops a top-level scalar, so a response whose
        identity is scalars needs no protected field at all -- delete_chart's
        deleted_id survives even the nuclear phase untouched."""
        assert COMMITTED_WRITE_SPECS["delete_chart"].identifying_fields == frozenset()
        assert COMMITTED_WRITE_SPECS["create_dataset"].identifying_fields == frozenset()

    def test_reports_success_tracks_the_response_model(self) -> None:
        """Consulted only when the payload is unparseable, to decide whether
        synthesizing ``success`` confirms the write or invents a field the
        schema never declares. GenerateChartResponse has one;
        UpdateDashboardResponse does not."""
        assert COMMITTED_WRITE_SPECS["update_chart"].reports_success is True
        assert COMMITTED_WRITE_SPECS["update_dashboard"].reports_success is False


class TestStringFieldTruncationToolsMap:
    """Test the STRING_FIELD_TRUNCATION_TOOLS constant."""

    def test_get_chart_sql_maps_to_sql_field(self) -> None:
        """The map names the field to bisect: get_chart_sql's payload is
        dominated by ``sql``, which is what truncation has to cut down."""
        assert STRING_FIELD_TRUNCATION_TOOLS["get_chart_sql"] == "sql"


class TestTruncateStrings:
    """Test _truncate_strings helper."""

    def test_truncates_long_strings(self) -> None:
        """Should truncate strings exceeding max_chars."""
        data: dict[str, Any] = {"description": "x" * 1000, "name": "short"}
        notes: list[str] = []
        changed = _truncate_strings(data, notes, max_chars=500)
        assert changed is True
        assert len(data["description"]) < 1000
        assert "[truncated from 1000 chars]" in data["description"]
        assert data["name"] == "short"
        assert len(notes) == 1

    def test_does_not_truncate_short_strings(self) -> None:
        """Should not truncate strings within limit."""
        data: dict[str, Any] = {"name": "hello", "id": 123}
        notes: list[str] = []
        changed = _truncate_strings(data, notes, max_chars=500)
        assert changed is False
        assert data["name"] == "hello"
        assert len(notes) == 0


class TestTruncateStringsRecursive:
    """Test _truncate_strings_recursive helper."""

    def test_truncates_nested_strings_in_list_items(self) -> None:
        """Should truncate strings inside list items (e.g. charts[i].description)."""
        data: dict[str, Any] = {
            "id": 1,
            "charts": [
                {"id": 1, "description": "x" * 1000},
                {"id": 2, "description": "short"},
            ],
        }
        notes: list[str] = []
        changed = _truncate_strings_recursive(data, notes, max_chars=500)
        assert changed is True
        assert "[truncated" in data["charts"][0]["description"]
        assert data["charts"][1]["description"] == "short"
        assert len(notes) == 1
        assert "charts[0].description" in notes[0]

    def test_truncates_nested_strings_in_dicts(self) -> None:
        """Should truncate strings inside nested dicts."""
        data: dict[str, Any] = {
            "filter_state": {
                "dataMask": {"some_filter": "y" * 2000},
            },
        }
        notes: list[str] = []
        changed = _truncate_strings_recursive(data, notes, max_chars=500)
        assert changed is True
        assert "[truncated" in data["filter_state"]["dataMask"]["some_filter"]

    def test_respects_depth_limit(self) -> None:
        """Should stop recursing at depth 10."""
        # Build a deeply nested structure (15 levels)
        data: dict[str, Any] = {"level": "x" * 1000}
        current = data
        for _ in range(15):
            current["nested"] = {"level": "x" * 1000}
            current = current["nested"]
        notes: list[str] = []
        _truncate_strings_recursive(data, notes, max_chars=500)
        # Should truncate levels 0-10 but stop before 15
        assert len(notes) <= 11

    def test_handles_empty_structures(self) -> None:
        """Should handle empty dicts and lists gracefully."""
        data: dict[str, Any] = {"items": [], "meta": {}, "name": "ok"}
        notes: list[str] = []
        changed = _truncate_strings_recursive(data, notes, max_chars=500)
        assert changed is False

    def test_dashboard_with_many_charts_edge_case(self) -> None:
        """Simulate a dashboard with 30 charts each having long descriptions."""
        data: dict[str, Any] = {
            "id": 1,
            "dashboard_title": "Big Dashboard",
            "charts": [
                {"id": i, "slice_name": f"Chart {i}", "description": "d" * 2000}
                for i in range(30)
            ],
        }
        notes: list[str] = []
        changed = _truncate_strings_recursive(data, notes, max_chars=500)
        assert changed is True
        # All 30 chart descriptions should be truncated
        assert len(notes) == 30
        for chart in data["charts"]:
            assert len(chart["description"]) < 2000
            assert "[truncated" in chart["description"]


class TestTruncateLists:
    """Test _truncate_lists helper."""

    def test_truncates_long_lists(self) -> None:
        """Should truncate lists exceeding max_items without inline markers."""
        data: dict[str, Any] = {
            "columns": [{"name": f"col_{i}"} for i in range(50)],
            "tags": [1, 2],
        }
        notes: list[str] = []
        changed = _truncate_lists(data, notes, max_items=10)
        assert changed is True
        # Exactly 10 items — no marker appended (preserves type contract)
        assert len(data["columns"]) == 10
        assert all(isinstance(c, dict) and "name" in c for c in data["columns"])
        assert data["tags"] == [1, 2]  # Not truncated
        assert len(notes) == 1
        assert "50" in notes[0]

    def test_does_not_truncate_short_lists(self) -> None:
        """Should not truncate lists within limit."""
        data: dict[str, Any] = {"items": [1, 2, 3]}
        notes: list[str] = []
        changed = _truncate_lists(data, notes, max_items=10)
        assert changed is False


class TestSummarizeLargeDicts:
    """Test _summarize_large_dicts helper."""

    def test_summarizes_large_dicts(self) -> None:
        """Should replace large dicts with key summaries."""
        big_dict = {f"key_{i}": f"value_{i}" for i in range(30)}
        data: dict[str, Any] = {"form_data": big_dict, "id": 1}
        notes: list[str] = []
        changed = _summarize_large_dicts(data, notes, max_keys=20)
        assert changed is True
        assert data["form_data"]["_truncated"] is True
        assert "30 keys" in data["form_data"]["_message"]
        assert data["id"] == 1

    def test_does_not_summarize_small_dicts(self) -> None:
        """Should not summarize dicts within limit."""
        data: dict[str, Any] = {"params": {"a": 1, "b": 2}}
        notes: list[str] = []
        changed = _summarize_large_dicts(data, notes, max_keys=20)
        assert changed is False


class TestReplaceCollectionsWithSummaries:
    """Test _replace_collections_with_summaries helper."""

    def test_replaces_lists_and_dicts(self) -> None:
        """Should clear non-empty collections to reduce size."""
        data: dict[str, Any] = {
            "columns": [1, 2, 3],
            "params": {"a": 1},
            "name": "test",
            "empty": [],
        }
        notes: list[str] = []
        changed = _replace_collections_with_summaries(data, notes)
        assert changed is True
        # Lists become empty lists (preserves type)
        assert data["columns"] == []
        # Dicts become empty dicts (preserves type)
        assert data["params"] == {}
        # Scalars unchanged
        assert data["name"] == "test"
        # Empty collections unchanged
        assert data["empty"] == []
        assert len(notes) == 2

    def test_protected_keys_are_left_untouched(self) -> None:
        """A protected key must survive even this nuclear phase.

        Used so a committed-write tool's identifying field (e.g. 'chart')
        always reaches the caller, even if every other phase failed to
        bring the response under budget.
        """
        data: dict[str, Any] = {
            "chart": {"id": 42, "url": "http://x"},
            "form_data": {"a": 1},
        }
        notes: list[str] = []
        changed = _replace_collections_with_summaries(
            data, notes, protected_keys=frozenset({"chart"})
        )
        assert changed is True
        assert data["chart"] == {"id": 42, "url": "http://x"}
        assert data["form_data"] == {}
        assert len(notes) == 1


class TestTruncateOversizedResponse:
    """Test truncate_oversized_response function."""

    def test_no_truncation_needed(self) -> None:
        """Should return original data when under limit."""
        response = {"id": 1, "name": "test"}
        result, was_truncated, notes = truncate_oversized_response(response, 10000)
        assert was_truncated is False
        assert notes == []

    def test_truncates_large_string_fields(self) -> None:
        """Should truncate long strings to fit.

        With a 500-byte budget, clipping a string to the fixed 500 chars
        (plus its marker) can never fit, so the clip length has to follow
        the budget instead of leaving the response over the limit.
        """
        response = {
            "id": 1,
            "description": "x" * 50000,  # Very large description
        }
        result, was_truncated, notes = truncate_oversized_response(response, 500)
        assert was_truncated is True
        assert isinstance(result, dict)
        assert "[truncated" in result["description"]
        assert any("description" in n for n in notes)
        assert get_response_size_bytes(result) <= 500
        assert result["description"].startswith("x" * _MIN_STRING_CHARS)
        assert "[truncated from 50000 chars]" in result["description"]
        assert notes == ["Field 'description' truncated from 50000 chars"]

    def test_truncates_large_lists(self) -> None:
        """Should truncate lists when strings alone are not enough."""
        response = {
            "id": 1,
            "columns": [{"name": f"col_{i}", "type": "VARCHAR"} for i in range(200)],
        }
        result, was_truncated, notes = truncate_oversized_response(response, 500)
        assert was_truncated is True
        assert isinstance(result, dict)
        # Should have been truncated
        assert len(result["columns"]) < 200

    def test_handles_pydantic_model(self) -> None:
        """Should handle Pydantic model input."""

        class FakeInfo(BaseModel):
            id: int = 1
            description: str = "x" * 5000

        response = FakeInfo()
        result, was_truncated, notes = truncate_oversized_response(response, 200)
        assert was_truncated is True
        assert isinstance(result, dict)

    def test_returns_non_dict_unchanged(self) -> None:
        """Should return non-dict/model responses unchanged."""
        result, was_truncated, notes = truncate_oversized_response("just a string", 100)
        assert was_truncated is False
        assert result == "just a string"

    def test_progressive_truncation(self) -> None:
        """Should progressively apply truncation phases."""
        # Build a response that's quite large
        response = {
            "id": 1,
            "description": "x" * 2000,
            "css": "y" * 2000,
            "columns": [{"name": f"col_{i}"} for i in range(100)],
            "form_data": {f"key_{i}": f"val_{i}" for i in range(50)},
        }
        result, was_truncated, notes = truncate_oversized_response(response, 300)
        assert was_truncated is True
        assert isinstance(result, dict)
        assert result["id"] == 1  # Scalar fields preserved
        assert len(notes) > 0

    @staticmethod
    def _build_large_dashboard_response() -> dict[str, Any]:
        """A dashboard with 463 charts and 48 native_filters, shared by the
        default- and custom-max_list_items regression tests below."""
        return {
            "id": 1,
            "dashboard_title": "x" * 2000,  # forces Phase 2 to trigger
            "charts": [{"id": i, "slice_name": f"chart_{i}"} for i in range(463)],
            "native_filters": [{"id": i, "name": f"filter_{i}"} for i in range(48)],
        }

    def test_large_dashboard_respects_default_max_list_items(self) -> None:
        """Regression test for the Medialab large-dashboard report.

        A dashboard with 463 charts and 48 native_filters should have
        native_filters (48 items) left untouched under the new default cap
        of 100, while charts (463 items) is truncated to 100 — a clear
        improvement over the old flat 30-item cap, which truncated both.
        """
        response: dict[str, Any] = self._build_large_dashboard_response()
        result: Any
        was_truncated: bool
        notes: list[str]
        result, was_truncated, notes = truncate_oversized_response(response, 7000)
        assert was_truncated is True
        assert isinstance(result, dict)
        assert len(result["charts"]) == 100
        assert len(result["native_filters"]) == 48
        assert any("charts" in n and "463" in n for n in notes)
        assert not any("native_filters" in n for n in notes)

    def test_large_dashboard_respects_custom_max_list_items(self) -> None:
        """A custom max_list_items below both list sizes should truncate both fields."""
        response: dict[str, Any] = self._build_large_dashboard_response()
        result: Any
        was_truncated: bool
        notes: list[str]
        result, was_truncated, notes = truncate_oversized_response(
            response, 3000, max_list_items=30
        )
        assert was_truncated is True
        assert isinstance(result, dict)
        assert len(result["charts"]) == 30
        assert len(result["native_filters"]) == 30
        assert any("charts" in n and "30" in n for n in notes)
        assert any("native_filters" in n and "30" in n for n in notes)

    def test_custom_max_list_items_below_phase_four_survives_phase_four(self) -> None:
        """A max_list_items below Phase 4's hardcoded 10 should not be widened.

        Phase 2 truncates ``charts`` to 5 first; the response is still over
        budget because of the oversized ``form_data`` dict, so truncation
        proceeds to Phase 4, whose ``_truncate_lists(..., max_items=10)``
        call only shrinks lists larger than 10 — it must leave the
        already-smaller 5-item list untouched rather than re-expanding it.
        """
        response: dict[str, Any] = {
            "id": 1,
            "charts": [{"id": i, "slice_name": f"chart_{i}"} for i in range(300)],
            "form_data": {f"key_{i}": f"val_{i}" for i in range(50)},
        }
        result: Any
        was_truncated: bool
        notes: list[str]
        result, was_truncated, notes = truncate_oversized_response(
            response, 800, max_list_items=5
        )
        assert was_truncated is True
        assert isinstance(result, dict)
        assert len(result["charts"]) == 5
        assert any("form_data" in n for n in notes)

    def test_protected_keys_survive_nuclear_phase(self) -> None:
        """A protected key must still be present after Phase 5 clears everything.

        Regression test for update_chart: even when every other field is
        oversized enough to reach Phase 5, the 'chart' field (the caller's
        only way to confirm what was written) must not be wiped out.
        """
        response: dict[str, Any] = {
            "id": 1,
            "chart": {"id": 42, "slice_name": "Q1 Revenue", "url": "http://x"},
            # Few enough top-level keys (<=20) to dodge Phase 4's dict
            # summarization, and nested (not top-level) lists to dodge Phase
            # 2/4's list truncation, so this can only shrink under Phase 5.
            "form_data": {f"key_{i}": [f"v_{j}" for j in range(50)] for i in range(10)},
        }
        result, was_truncated, notes = truncate_oversized_response(
            response, 200, protected_keys=frozenset({"chart"})
        )
        assert was_truncated is True
        assert isinstance(result, dict)
        assert result["chart"] == {
            "id": 42,
            "slice_name": "Q1 Revenue",
            "url": "http://x",
        }
        assert result["form_data"] == {}
        assert not any("'chart'" in n for n in notes)

    def test_protected_key_survives_large_dict_summarization(self) -> None:
        """A protected dict with many keys must survive Phase 4, not just Phase 5.

        Regression test: ChartInfo serializes to more than _MAX_DICT_KEYS
        fields, so Phase 4's dict summarizer would replace the whole 'chart'
        field with a {_truncated, _message} marker -- destroying the write
        confirmation before Phase 5 ever got the chance to protect it.
        """
        chart = {"id": 42, "slice_name": "Q1 Revenue"}
        chart.update({f"field_{i}": f"value_{i}" for i in range(_MAX_DICT_KEYS + 5)})
        assert len(chart) > _MAX_DICT_KEYS
        response: dict[str, Any] = {
            "chart": chart,
            "form_data": {f"key_{i}": [f"v_{j}" for j in range(50)] for i in range(10)},
        }
        result, was_truncated, notes = truncate_oversized_response(
            response, 200, protected_keys=frozenset({"chart"})
        )
        assert was_truncated is True
        assert isinstance(result, dict)
        assert result["chart"]["id"] == 42
        assert result["chart"]["slice_name"] == "Q1 Revenue"
        assert "_truncated" not in result["chart"]
        assert not any("'chart'" in n for n in notes)

    def test_unprotected_large_dict_is_still_summarized(self) -> None:
        """Protecting one key must not disable Phase 4 for the others."""
        response: dict[str, Any] = {
            "chart": {"id": 42},
            "form_data": {f"key_{i}": f"value_{i}" for i in range(_MAX_DICT_KEYS + 5)},
        }
        result, was_truncated, notes = truncate_oversized_response(
            response, 50, protected_keys=frozenset({"chart"})
        )
        assert was_truncated is True
        assert isinstance(result, dict)
        assert result["chart"] == {"id": 42}
        assert any("form_data" in n for n in notes)


class TestTruncateStringFieldResponse:
    """Test truncate_string_field_response (used for get_chart_sql)."""

    def test_no_truncation_needed(self) -> None:
        response = {"chart_id": 1, "sql": "SELECT 1"}
        result, was_truncated, notes = truncate_string_field_response(
            response, 25000, "sql"
        )
        assert was_truncated is False
        assert notes == []
        assert result == response

    def test_bisects_sql_field_to_fit(self) -> None:
        """A response just over budget should keep as much SQL as fits."""
        response: dict[str, Any] = {
            "chart_id": 1,
            "chart_name": "Big Chart",
            "sql": "SELECT " + ", ".join(f"col_{i}" for i in range(2000)),
            "language": "sql",
        }
        result, was_truncated, notes = truncate_string_field_response(
            response, 500, "sql"
        )
        assert was_truncated is True
        assert isinstance(result, dict)
        assert 0 < len(result["sql"]) < len(response["sql"])
        assert result["_response_truncated"] is True
        assert get_response_size_bytes(result) <= 500
        assert any("sql" in n for n in notes)

    def test_truncated_sql_is_marked_unexecutable(self) -> None:
        """A bisected SQL prefix must not be silently runnable.

        Cutting a statement before its WHERE/LIMIT clause leaves valid SQL
        that scans far more data than the original, so the kept prefix
        carries an in-band marker that makes it a syntax error.
        """
        columns = ", ".join(f"col_{i}" for i in range(2000))
        sql = " ".join(
            ["SELECT", columns, "FROM big_table", "WHERE tenant_id = 7", "LIMIT 10"]
        )
        response: dict[str, Any] = {"chart_id": 1, "sql": sql}
        result, was_truncated, _ = truncate_string_field_response(response, 500, "sql")
        assert was_truncated is True
        assert isinstance(result, dict)
        assert "LIMIT 10" not in result["sql"]
        assert result["sql"].endswith("DO NOT EXECUTE")
        assert result["sql"].count("'") == 1
        # The marker is inside the measured budget, not appended after it.
        assert get_response_size_bytes(result) <= 500

    def test_truncated_sql_is_rejected_whatever_the_cut_landed_in(self) -> None:
        """The marker must defeat every lexical state the bisect can end in.

        The cut point is arbitrary, so it can land mid-comment or mid-string.
        A bare unterminated quote is swallowed by an open block comment, and a
        bare unterminated /* is not fatal in SQLite -- both leave the
        truncated statement runnable. Checked against a real engine (sqlite3)
        as well as the parser, since sqlglot rejects markers that SQLite
        happily executes.
        """
        import sqlite3

        import sqlglot

        marker = _STRING_FIELD_TRUNCATION_MARKERS["sql"]
        connection = sqlite3.connect(":memory:")
        connection.execute("CREATE TABLE t (a, b)")
        for tail in ("", " /* note aaa", " -- note", " WHERE b = 'xy"):
            truncated = " ".join(["SELECT a, b FROM t", tail, marker])
            with pytest.raises(sqlite3.Error):
                connection.execute(truncated)
            for dialect in (
                "sqlite",
                "mysql",
                "postgres",
                "duckdb",
                "snowflake",
                "bigquery",
                "trino",
                "tsql",
            ):
                with pytest.raises(Exception):  # noqa: B017, PT011
                    sqlglot.parse_one(truncated, dialect=dialect)
        connection.close()

    def test_truncated_sql_carries_the_marker(self) -> None:
        """The real truncation path must actually attach the marker."""
        columns = ", ".join(f"col_{i}" for i in range(2000))
        sql = " ".join(["SELECT", columns, "FROM big_table", "WHERE tenant_id = 7"])
        result, was_truncated, _ = truncate_string_field_response(
            {"chart_id": 1, "sql": sql}, 500, "sql"
        )
        assert was_truncated is True
        assert isinstance(result, dict)
        assert result["sql"].endswith(_STRING_FIELD_TRUNCATION_MARKERS["sql"])

    def test_under_limit_sql_is_returned_verbatim(self) -> None:
        """A response that already fits is passed through untouched."""
        response = {"chart_id": 1, "sql": "SELECT 1 FROM t LIMIT 10"}
        result, was_truncated, _ = truncate_string_field_response(
            response, 25000, "sql"
        )
        assert was_truncated is False
        assert isinstance(result, dict)
        assert result["sql"] == "SELECT 1 FROM t LIMIT 10"

    def test_bisect_does_not_mark_a_value_it_did_not_cut(self) -> None:
        """The marker is appended only when the prefix is actually shorter.

        Exercised directly on _bisect_string_length: the public entry point
        only calls it once the payload is already over budget, so the
        "nothing was cut" branch is not reachable through it.
        """
        data: dict[str, Any] = {"sql": "SELECT 1"}
        kept = _bisect_string_length(data, "sql", "SELECT 1", 25000, suffix="/* CUT")
        assert kept == len("SELECT 1")
        assert data["sql"] == "SELECT 1"

    def test_no_lever_fallback_note_is_actionable(self) -> None:
        """format_size_limit_error's get_chart_sql suggestion is real advice,
        not the unactionable 'Reduction needed: ~0%' the field alone gave."""
        message = format_size_limit_error(
            tool_name="get_chart_sql",
            params={},
            actual_bytes=20400,
            max_bytes=20000,
        )
        assert "no size-reduction parameter" in message

    def test_returns_unchanged_when_field_missing(self) -> None:
        """A ChartError response (no 'sql' field) has nothing to bisect."""
        response = {"error": "x" * 10000, "error_type": "NotFound"}
        result, was_truncated, notes = truncate_string_field_response(
            response, 100, "sql"
        )
        assert was_truncated is False
        assert notes == []


class TestTruncateQueryResult:
    """Tests for ``truncate_query_result`` (data-query row/scalar truncation)."""

    def _rows_response(self, row_field: str, count: int = 200) -> dict[str, Any]:
        row = {f"col_{i}": f"value_{i}" for i in range(10)}
        return {
            "status": "success",
            row_field: [row] * count,
            "row_count": count,
        }

    def test_no_truncation_needed(self) -> None:
        response = self._rows_response("rows", count=3)
        result, was_truncated, notes = truncate_query_result(response, 25000)
        assert was_truncated is False
        assert notes == []
        assert result == response

    def test_truncated_result_fits_under_limit(self) -> None:
        """The final payload (rows + note metadata) must itself fit.

        Regression test: the note is built from the kept row count, but
        that note text also consumes bytes. The bisection must reserve
        room for it up front rather than measuring fit on bare rows and
        appending the note afterward, which could push the final payload
        back over the limit.
        """
        response = self._rows_response("rows")
        result, was_truncated, notes = truncate_query_result(response, 500)
        assert was_truncated is True
        assert isinstance(result, dict)
        assert get_response_size_bytes(result) <= 500
        assert result["row_count"] == len(result["rows"])
        assert result["row_count"] < 200

    def test_single_oversized_row_is_kept_anyway(self) -> None:
        """A single row that alone exceeds the limit is still returned.

        ``truncate_query_result`` always keeps >=1 row when the original
        list is non-empty; it is the caller's (middleware) job to reject
        a still-oversized result rather than ship it silently.
        """
        response = {
            "status": "success",
            "rows": [{"col": "x" * 5000}] * 3,
            "row_count": 3,
        }
        result, was_truncated, notes = truncate_query_result(response, 50)
        assert was_truncated is True
        assert isinstance(result, dict)
        assert len(result["rows"]) == 1
        assert notes

    @pytest.mark.parametrize("marker", ["", "\n[CSV truncated]"])
    def test_truncates_csv_scalar_field_when_rows_empty(self, marker: str) -> None:
        """CSV exports carry their payload in ``csv_data`` with ``data=[]``."""
        response: dict[str, Any] = {
            "chart_id": 1,
            "data": [],
            "csv_data": "col_0,col_1\n" + ("value,value\n" * 2000),
            "format": "csv",
        }
        with patch.dict(_STRING_FIELD_TRUNCATION_MARKERS, {"csv_data": marker}):
            result, was_truncated, notes = truncate_query_result(
                response, 500, tool_name="get_chart_data"
            )
        assert was_truncated is True
        assert isinstance(result, dict)
        assert len(result["csv_data"]) < len(response["csv_data"])
        assert result["csv_data"].endswith(marker)
        assert get_response_size_bytes(result) <= 500
        assert any("CSV" in n for n in notes)

    def test_does_not_truncate_excel_binary_field(self) -> None:
        """excel_data is base64 binary — truncating it would corrupt the file."""
        response = {
            "chart_id": 1,
            "data": [],
            "excel_data": "QUJDREVGRw==" * 5000,
            "format": "excel",
        }
        result, was_truncated, notes = truncate_query_result(response, 500)
        assert was_truncated is False
        assert notes == []
        assert isinstance(result, dict)
        assert result["excel_data"] == response["excel_data"]

    def test_get_chart_data_advice_mentions_limit_param(self) -> None:
        response = self._rows_response("data")
        _, _, notes = truncate_query_result(response, 500, tool_name="get_chart_data")
        assert any("'limit' parameter" in n for n in notes)
        assert not any("LIMIT clause" in n for n in notes)

    def test_query_dataset_advice_mentions_row_limit_param(self) -> None:
        response = self._rows_response("data")
        _, _, notes = truncate_query_result(response, 500, tool_name="query_dataset")
        assert any("'row_limit' parameter" in n for n in notes)
        assert not any("LIMIT clause" in n for n in notes)

    def test_execute_sql_advice_mentions_limit_clause(self) -> None:
        response = self._rows_response("rows")
        _, _, notes = truncate_query_result(response, 500, tool_name="execute_sql")
        assert any("LIMIT clause" in n for n in notes)
