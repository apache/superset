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
    CHARS_PER_TOKEN,
    estimate_response_tokens,
    estimate_token_count,
    extract_query_params,
    format_size_limit_error,
    generate_size_reduction_suggestions,
    get_response_size_bytes,
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
