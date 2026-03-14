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

from types import SimpleNamespace
from unittest.mock import MagicMock

from fastmcp.server.transforms.search import BM25SearchTransform, RegexSearchTransform

from superset.mcp_service.mcp_config import MCP_TOOL_SEARCH_CONFIG
from superset.mcp_service.server import (
    _apply_tool_search_transform,
    _fix_call_tool_arguments,
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
    """BM25 subclass is created and added when strategy is 'bm25'."""
    mock_mcp = MagicMock()
    config = {
        "strategy": "bm25",
        "max_results": 5,
        "always_visible": ["health_check"],
        "search_tool_name": "search_tools",
        "call_tool_name": "call_tool",
    }

    _apply_tool_search_transform(mock_mcp, config)

    mock_mcp.add_transform.assert_called_once()
    transform = mock_mcp.add_transform.call_args[0][0]
    assert isinstance(transform, BM25SearchTransform)


def test_apply_regex_transform():
    """Regex subclass is created and added when strategy is 'regex'."""
    mock_mcp = MagicMock()
    config = {
        "strategy": "regex",
        "max_results": 10,
        "always_visible": ["health_check", "get_instance_info"],
        "search_tool_name": "find_tools",
        "call_tool_name": "invoke_tool",
    }

    _apply_tool_search_transform(mock_mcp, config)

    mock_mcp.add_transform.assert_called_once()
    transform = mock_mcp.add_transform.call_args[0][0]
    assert isinstance(transform, RegexSearchTransform)


def test_apply_transform_uses_defaults_for_missing_keys():
    """Missing config keys fall back to sensible defaults (BM25)."""
    mock_mcp = MagicMock()
    config = {}  # All keys missing — should use defaults

    _apply_tool_search_transform(mock_mcp, config)

    mock_mcp.add_transform.assert_called_once()
    transform = mock_mcp.add_transform.call_args[0][0]
    assert isinstance(transform, BM25SearchTransform)


def test_fix_call_tool_arguments_replaces_anyof():
    """_fix_call_tool_arguments replaces anyOf with flat type: object."""
    tool = SimpleNamespace(
        parameters={
            "type": "object",
            "properties": {
                "name": {"type": "string"},
                "arguments": {
                    "anyOf": [
                        {"type": "object", "additionalProperties": True},
                        {"type": "null"},
                    ],
                    "default": None,
                },
            },
        }
    )

    result = _fix_call_tool_arguments(tool)

    assert result.parameters["properties"]["arguments"] == {
        "additionalProperties": True,
        "default": None,
        "description": "Arguments to pass to the tool",
        "type": "object",
    }
    # Other properties untouched
    assert result.parameters["properties"]["name"] == {"type": "string"}


def test_fix_call_tool_arguments_no_arguments_field():
    """_fix_call_tool_arguments is a no-op when arguments field is absent."""
    tool = SimpleNamespace(
        parameters={
            "type": "object",
            "properties": {"name": {"type": "string"}},
        }
    )

    result = _fix_call_tool_arguments(tool)

    assert "arguments" not in result.parameters["properties"]


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
