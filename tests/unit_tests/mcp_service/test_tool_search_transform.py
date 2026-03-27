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
    _normalize_call_tool_arguments,
    _serialize_tools_without_output_schema,
    _simplify_input_schema,
)
from superset.utils import json


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


# -- _normalize_call_tool_arguments tests --


def test_normalize_serializes_dict_with_anyof_string():
    """Dict value is JSON-serialized when schema has anyOf with string type."""
    arguments = {"request": {"dataset_id": 1, "config": {"key": "val"}}}
    schema = {
        "properties": {
            "request": {
                "anyOf": [
                    {"type": "string"},
                    {"$ref": "#/$defs/SomeModel"},
                ]
            }
        }
    }

    result = _normalize_call_tool_arguments(arguments, schema)

    assert isinstance(result["request"], str)
    assert json.loads(result["request"]) == {
        "dataset_id": 1,
        "config": {"key": "val"},
    }


def test_normalize_serializes_dict_with_oneof_string():
    """Dict value is JSON-serialized when schema has oneOf with string type."""
    arguments = {"request": {"name": "test"}}
    schema = {
        "properties": {
            "request": {
                "oneOf": [
                    {"type": "string"},
                    {"type": "object"},
                ]
            }
        }
    }

    result = _normalize_call_tool_arguments(arguments, schema)

    assert isinstance(result["request"], str)


def test_normalize_leaves_dict_without_string_variant():
    """Dict value is left as-is when schema has no string variant."""
    arguments = {"config": {"key": "val"}}
    schema = {
        "properties": {
            "config": {
                "anyOf": [
                    {"type": "object"},
                    {"type": "null"},
                ]
            }
        }
    }

    result = _normalize_call_tool_arguments(arguments, schema)

    assert isinstance(result["config"], dict)
    assert result["config"] == {"key": "val"}


def test_normalize_leaves_non_dict_unchanged():
    """Non-dict/list values pass through unchanged."""
    arguments = {"name": "test", "count": 42, "flag": True}
    schema = {
        "properties": {
            "name": {"type": "string"},
            "count": {"type": "integer"},
            "flag": {"type": "boolean"},
        }
    }

    result = _normalize_call_tool_arguments(arguments, schema)

    assert result == {"name": "test", "count": 42, "flag": True}


def test_normalize_returns_none_for_none_arguments():
    """None arguments returns None."""
    result = _normalize_call_tool_arguments(None, {"properties": {}})

    assert result is None


def test_normalize_returns_arguments_for_non_dict_schema():
    """Non-dict schema returns arguments unchanged."""
    arguments = {"request": {"key": "val"}}

    result = _normalize_call_tool_arguments(arguments, None)

    assert result is arguments


def test_normalize_serializes_list_with_anyof_string():
    """List value is JSON-serialized when schema has anyOf with string type."""
    arguments = {"items": [1, 2, 3]}
    schema = {
        "properties": {
            "items": {
                "anyOf": [
                    {"type": "string"},
                    {"type": "array", "items": {"type": "integer"}},
                ]
            }
        }
    }

    result = _normalize_call_tool_arguments(arguments, schema)

    assert isinstance(result["items"], str)
    assert json.loads(result["items"]) == [1, 2, 3]


def test_normalize_ignores_keys_not_in_schema():
    """Dict values for keys not in schema properties are left unchanged."""
    arguments = {"unknown_key": {"nested": True}}
    schema = {"properties": {"other_key": {"type": "string"}}}

    result = _normalize_call_tool_arguments(arguments, schema)

    assert isinstance(result["unknown_key"], dict)


# -- _resolve_refs / _simplify_input_schema tests --


def test_simplify_resolves_ref_in_anyof():
    """anyOf[string, $ref] is resolved to the inlined object."""
    schema = {
        "type": "object",
        "properties": {
            "request": {
                "anyOf": [
                    {"type": "string"},
                    {"$ref": "#/$defs/ListChartsRequest"},
                ]
            }
        },
        "required": ["request"],
        "$defs": {
            "ListChartsRequest": {
                "type": "object",
                "properties": {
                    "page": {"type": "integer", "default": 1},
                },
            }
        },
    }

    result = _simplify_input_schema(schema)

    assert "$defs" not in result
    req = result["properties"]["request"]
    assert "anyOf" not in req
    assert req["type"] == "object"
    assert "page" in req["properties"]


def test_simplify_preserves_description_on_anyof_collapse():
    """Sibling keys (description, default) survive anyOf collapse."""
    schema = {
        "type": "object",
        "properties": {
            "request": {
                "anyOf": [
                    {"type": "string"},
                    {"$ref": "#/$defs/Req"},
                ],
                "description": "The request parameters",
                "default": "{}",
            }
        },
        "$defs": {
            "Req": {
                "type": "object",
                "properties": {
                    "page": {"type": "integer"},
                },
            }
        },
    }

    result = _simplify_input_schema(schema)

    req = result["properties"]["request"]
    assert req["type"] == "object"
    assert req["description"] == "The request parameters"
    assert req["default"] == "{}"
    assert "page" in req["properties"]


def test_simplify_resolves_nested_ref_in_items():
    """$ref inside array items is inlined recursively."""
    schema = {
        "type": "object",
        "properties": {
            "request": {
                "anyOf": [
                    {"type": "string"},
                    {"$ref": "#/$defs/Outer"},
                ]
            }
        },
        "$defs": {
            "Outer": {
                "type": "object",
                "properties": {
                    "filters": {
                        "type": "array",
                        "items": {"$ref": "#/$defs/Filter"},
                    }
                },
            },
            "Filter": {
                "type": "object",
                "properties": {
                    "col": {"type": "string"},
                    "opr": {"type": "string"},
                },
                "required": ["col", "opr"],
            },
        },
    }

    result = _simplify_input_schema(schema)

    assert "$ref" not in json.dumps(result)
    items_schema = result["properties"]["request"]["properties"]["filters"]["items"]
    assert items_schema["type"] == "object"
    assert "col" in items_schema["properties"]


def test_simplify_keeps_optional_anyof():
    """anyOf[T, null] (Optional) is kept so the LLM knows the field is nullable."""
    schema = {
        "type": "object",
        "properties": {"name": {"anyOf": [{"type": "string"}, {"type": "null"}]}},
    }

    result = _simplify_input_schema(schema)

    assert result["properties"]["name"] == {
        "anyOf": [{"type": "string"}, {"type": "null"}]
    }


def test_simplify_preserves_oneof():
    """oneOf variants are resolved but kept as oneOf (not collapsed)."""
    schema = {
        "type": "object",
        "properties": {
            "config": {
                "oneOf": [
                    {"$ref": "#/$defs/XY"},
                    {"$ref": "#/$defs/Pie"},
                ]
            }
        },
        "$defs": {
            "XY": {
                "type": "object",
                "properties": {"x": {"type": "string"}},
            },
            "Pie": {
                "type": "object",
                "properties": {"dim": {"type": "string"}},
            },
        },
    }

    result = _simplify_input_schema(schema)

    assert "$defs" not in result
    assert "$ref" not in json.dumps(result)
    variants = result["properties"]["config"]["oneOf"]
    assert len(variants) == 2
    assert "x" in variants[0]["properties"]
    assert "dim" in variants[1]["properties"]


def test_simplify_no_defs_passthrough():
    """Schema without $defs passes through unchanged."""
    schema = {
        "type": "object",
        "properties": {
            "page": {"type": "integer"},
        },
    }

    result = _simplify_input_schema(schema)

    assert result == schema


def test_simplify_full_parse_request_pattern():
    """End-to-end: realistic @parse_request schema is fully resolved."""
    schema = {
        "type": "object",
        "properties": {
            "request": {
                "anyOf": [
                    {"type": "string"},
                    {"$ref": "#/$defs/ExecuteSqlRequest"},
                ]
            }
        },
        "required": ["request"],
        "$defs": {
            "ExecuteSqlRequest": {
                "type": "object",
                "properties": {
                    "database_id": {
                        "type": "integer",
                        "description": "The database ID",
                    },
                    "sql": {
                        "type": "string",
                        "description": "SQL query to execute",
                    },
                    "limit": {"type": "integer", "default": 100},
                },
                "required": ["database_id", "sql"],
            }
        },
    }

    result = _simplify_input_schema(schema)

    # Top level: no $defs, request is required
    assert "$defs" not in result
    assert result["required"] == ["request"]

    # request: inlined object with all fields visible
    req = result["properties"]["request"]
    assert req["type"] == "object"
    assert req["required"] == ["database_id", "sql"]
    assert req["properties"]["database_id"]["type"] == "integer"
    assert req["properties"]["sql"]["type"] == "string"
    assert req["properties"]["limit"]["default"] == 100
