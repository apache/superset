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
Unit tests for MCP service token utilities.
"""

from typing import Any, List

from pydantic import BaseModel

from superset.mcp_service.utils.token_utils import (
    _replace_collections_with_summaries,
    _summarize_large_dicts,
    _truncate_lists,
    _truncate_strings,
    _truncate_strings_recursive,
    CHARS_PER_TOKEN,
    estimate_response_tokens,
    estimate_token_count,
    extract_query_params,
    format_size_limit_error,
    generate_size_reduction_suggestions,
    get_response_size_bytes,
    INFO_TOOLS,
    truncate_oversized_response,
)


class TestEstimateTokenCount:
    """Test estimate_token_count function."""

    def test_estimate_string(self) -> None:
        """Should estimate tokens for a string."""
        text = "Hello world"
        result = estimate_token_count(text)
        expected = int(len(text) / CHARS_PER_TOKEN)
        assert result == expected

    def test_estimate_bytes(self) -> None:
        """Should estimate tokens for bytes."""
        text = b"Hello world"
        result = estimate_token_count(text)
        expected = int(len(text) / CHARS_PER_TOKEN)
        assert result == expected

    def test_empty_string(self) -> None:
        """Should return 0 for empty string."""
        assert estimate_token_count("") == 0

    def test_json_like_content(self) -> None:
        """Should estimate tokens for JSON-like content."""
        json_str = '{"name": "test", "value": 123, "items": [1, 2, 3]}'
        result = estimate_token_count(json_str)
        assert result > 0
        assert result == int(len(json_str) / CHARS_PER_TOKEN)


class TestEstimateResponseTokens:
    """Test estimate_response_tokens function."""

    class MockResponse(BaseModel):
        """Mock Pydantic response model."""

        name: str
        value: int
        items: List[Any]

    def test_estimate_pydantic_model(self) -> None:
        """Should estimate tokens for Pydantic model."""
        response = self.MockResponse(name="test", value=42, items=[1, 2, 3])
        result = estimate_response_tokens(response)
        assert result > 0

    def test_estimate_dict(self) -> None:
        """Should estimate tokens for dict."""
        response = {"name": "test", "value": 42}
        result = estimate_response_tokens(response)
        assert result > 0

    def test_estimate_list(self) -> None:
        """Should estimate tokens for list."""
        response = [{"name": "item1"}, {"name": "item2"}]
        result = estimate_response_tokens(response)
        assert result > 0

    def test_estimate_string(self) -> None:
        """Should estimate tokens for string response."""
        response = "Hello world"
        result = estimate_response_tokens(response)
        assert result > 0

    def test_estimate_large_response(self) -> None:
        """Should estimate tokens for large response."""
        response = {"items": [{"name": f"item{i}"} for i in range(1000)]}
        result = estimate_response_tokens(response)
        assert result > 1000  # Large response should have many tokens


class TestGetResponseSizeBytes:
    """Test get_response_size_bytes function."""

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
            estimated_tokens=50000,
            token_limit=25000,
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
            estimated_tokens=50000,
            token_limit=25000,
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
            estimated_tokens=50000,
            token_limit=25000,
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
            estimated_tokens=50000,
            token_limit=25000,
        )
        assert any("filter" in s.lower() for s in suggestions)

    def test_tool_specific_suggestions_execute_sql(self) -> None:
        """Should provide SQL-specific suggestions for execute_sql."""
        suggestions = generate_size_reduction_suggestions(
            tool_name="execute_sql",
            params={"sql": "SELECT * FROM table"},
            estimated_tokens=50000,
            token_limit=25000,
        )
        assert any("LIMIT" in s or "limit" in s.lower() for s in suggestions)

    def test_tool_specific_suggestions_list_charts(self) -> None:
        """Should provide chart-specific suggestions for list_charts."""
        suggestions = generate_size_reduction_suggestions(
            tool_name="list_charts",
            params={},
            estimated_tokens=50000,
            token_limit=25000,
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
            estimated_tokens=50000,
            token_limit=25000,
        )
        assert any("search" in s.lower() for s in suggestions)


class TestFormatSizeLimitError:
    """Test format_size_limit_error function."""

    def test_error_contains_token_counts(self) -> None:
        """Should include token counts in error message."""
        error = format_size_limit_error(
            tool_name="list_charts",
            params={},
            estimated_tokens=50000,
            token_limit=25000,
        )
        assert "50,000" in error
        assert "25,000" in error

    def test_error_contains_tool_name(self) -> None:
        """Should include tool name in error message."""
        error = format_size_limit_error(
            tool_name="list_charts",
            params={},
            estimated_tokens=50000,
            token_limit=25000,
        )
        assert "list_charts" in error

    def test_error_contains_suggestions(self) -> None:
        """Should include suggestions in error message."""
        error = format_size_limit_error(
            tool_name="list_charts",
            params={"page_size": 100},
            estimated_tokens=50000,
            token_limit=25000,
        )
        # Should have numbered suggestions
        assert "1." in error

    def test_error_contains_reduction_percentage(self) -> None:
        """Should include reduction percentage in error message."""
        error = format_size_limit_error(
            tool_name="list_charts",
            params={},
            estimated_tokens=50000,
            token_limit=25000,
        )
        # 50% reduction needed
        assert "50%" in error or "Reduction" in error

    def test_error_limits_suggestions_to_five(self) -> None:
        """Should limit suggestions to 5."""
        error = format_size_limit_error(
            tool_name="list_charts",
            params={},
            estimated_tokens=100000,
            token_limit=10000,
        )
        # Count numbered suggestions (1. through 5.)
        suggestion_count = sum(1 for i in range(1, 10) if f"{i}." in error)
        assert suggestion_count <= 5

    def test_error_message_is_readable(self) -> None:
        """Should produce human-readable error message."""
        error = format_size_limit_error(
            tool_name="list_charts",
            params={"page_size": 100},
            estimated_tokens=75000,
            token_limit=25000,
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
            estimated_tokens=50000,  # 2x over limit
            token_limit=25000,
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
            estimated_tokens=75000,  # 3x over limit
            token_limit=25000,
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


class TestTruncateOversizedResponse:
    """Test truncate_oversized_response function."""

    def test_no_truncation_needed(self) -> None:
        """Should return original data when under limit."""
        response = {"id": 1, "name": "test"}
        result, was_truncated, notes = truncate_oversized_response(response, 10000)
        assert was_truncated is False
        assert notes == []

    def test_truncates_large_string_fields(self) -> None:
        """Should truncate long strings to fit."""
        response = {
            "id": 1,
            "description": "x" * 50000,  # Very large description
        }
        result, was_truncated, notes = truncate_oversized_response(response, 500)
        assert was_truncated is True
        assert isinstance(result, dict)
        assert "[truncated" in result["description"]
        assert any("description" in n for n in notes)

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
