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

"""Tests for MCP tool search transform configuration and application."""

from unittest.mock import MagicMock, patch

from superset.mcp_service.mcp_config import MCP_TOOL_SEARCH_CONFIG
from superset.mcp_service.server import (
    _apply_tool_search_transform,
    _serialize_tools_without_output_schema,
)


def test_tool_search_config_defaults():
    """Default config has expected keys and values."""
    assert MCP_TOOL_SEARCH_CONFIG["enabled"] is True
    assert MCP_TOOL_SEARCH_CONFIG["strategy"] == "bm25"
    assert MCP_TOOL_SEARCH_CONFIG["max_results"] == 5
    assert "health_check" in MCP_TOOL_SEARCH_CONFIG["always_visible"]
    assert "get_instance_info" in MCP_TOOL_SEARCH_CONFIG["always_visible"]
    assert MCP_TOOL_SEARCH_CONFIG["search_tool_name"] == "search_tools"
    assert MCP_TOOL_SEARCH_CONFIG["call_tool_name"] == "call_tool"


def test_apply_bm25_transform():
    """BM25SearchTransform is applied when strategy is 'bm25'."""
    mock_mcp = MagicMock()
    config = {
        "strategy": "bm25",
        "max_results": 5,
        "always_visible": ["health_check"],
        "search_tool_name": "search_tools",
        "call_tool_name": "call_tool",
    }

    with patch("fastmcp.server.transforms.search.BM25SearchTransform") as mock_bm25_cls:
        mock_transform = MagicMock()
        mock_bm25_cls.return_value = mock_transform

        _apply_tool_search_transform(mock_mcp, config)

        call_kwargs = mock_bm25_cls.call_args[1]
        assert call_kwargs["max_results"] == 5
        assert call_kwargs["always_visible"] == ["health_check"]
        assert call_kwargs["search_tool_name"] == "search_tools"
        assert call_kwargs["call_tool_name"] == "call_tool"
        assert (
            call_kwargs["search_result_serializer"]
            is _serialize_tools_without_output_schema
        )
        mock_mcp.add_transform.assert_called_once_with(mock_transform)


def test_apply_regex_transform():
    """RegexSearchTransform is applied when strategy is 'regex'."""
    mock_mcp = MagicMock()
    config = {
        "strategy": "regex",
        "max_results": 10,
        "always_visible": ["health_check", "get_instance_info"],
        "search_tool_name": "find_tools",
        "call_tool_name": "invoke_tool",
    }

    with patch(
        "fastmcp.server.transforms.search.RegexSearchTransform"
    ) as mock_regex_cls:
        mock_transform = MagicMock()
        mock_regex_cls.return_value = mock_transform

        _apply_tool_search_transform(mock_mcp, config)

        call_kwargs = mock_regex_cls.call_args[1]
        assert call_kwargs["max_results"] == 10
        assert call_kwargs["always_visible"] == ["health_check", "get_instance_info"]
        assert call_kwargs["search_tool_name"] == "find_tools"
        assert call_kwargs["call_tool_name"] == "invoke_tool"
        assert (
            call_kwargs["search_result_serializer"]
            is _serialize_tools_without_output_schema
        )
        mock_mcp.add_transform.assert_called_once_with(mock_transform)


def test_apply_transform_uses_defaults_for_missing_keys():
    """Missing config keys fall back to sensible defaults."""
    mock_mcp = MagicMock()
    config = {}  # All keys missing — should use defaults

    with patch("fastmcp.server.transforms.search.BM25SearchTransform") as mock_bm25_cls:
        mock_bm25_cls.return_value = MagicMock()

        _apply_tool_search_transform(mock_mcp, config)

        call_kwargs = mock_bm25_cls.call_args[1]
        assert call_kwargs["max_results"] == 5
        assert call_kwargs["always_visible"] == []
        assert call_kwargs["search_tool_name"] == "search_tools"
        assert call_kwargs["call_tool_name"] == "call_tool"


def test_serialize_tools_strips_output_schema():
    """Custom serializer removes outputSchema from tool definitions."""
    mock_tool = MagicMock()
    mock_mcp_tool = MagicMock()
    mock_mcp_tool.model_dump.return_value = {
        "name": "test_tool",
        "description": "A test tool",
        "inputSchema": {"type": "object", "properties": {"x": {"type": "integer"}}},
        "outputSchema": {
            "type": "object",
            "properties": {"result": {"type": "string"}},
        },
    }
    mock_tool.to_mcp_tool.return_value = mock_mcp_tool

    result = _serialize_tools_without_output_schema([mock_tool])

    assert len(result) == 1
    assert result[0]["name"] == "test_tool"
    assert "inputSchema" in result[0]
    assert "outputSchema" not in result[0]


def test_serialize_tools_handles_no_output_schema():
    """Custom serializer works when tool has no outputSchema."""
    mock_tool = MagicMock()
    mock_mcp_tool = MagicMock()
    mock_mcp_tool.model_dump.return_value = {
        "name": "simple_tool",
        "inputSchema": {"type": "object"},
    }
    mock_tool.to_mcp_tool.return_value = mock_mcp_tool

    result = _serialize_tools_without_output_schema([mock_tool])

    assert len(result) == 1
    assert result[0]["name"] == "simple_tool"
    assert "outputSchema" not in result[0]
