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
from unittest.mock import MagicMock, patch

from fastmcp.server.transforms.search import BM25SearchTransform, RegexSearchTransform
from flask import Flask, g

from superset.mcp_service.auth import CLASS_PERMISSION_ATTR, METHOD_PERMISSION_ATTR
from superset.mcp_service.mcp_config import MCP_TOOL_SEARCH_CONFIG
from superset.mcp_service.privacy import requires_data_model_metadata_access
from superset.mcp_service.server import (
    _apply_tool_search_transform,
    _compact_schema,
    _create_search_result_serializer,
    _extract_parameter_names,
    _filter_tools_by_current_user_permission,
    _fix_call_tool_arguments,
    _normalize_call_tool_arguments,
    _serialize_tools_without_output_schema,
    _truncate_description,
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
    assert MCP_TOOL_SEARCH_CONFIG["include_schemas"] is False


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


# -- _compact_schema tests --


def test_compact_schema_removes_defs():
    """$defs section is stripped from the schema."""
    schema = {
        "type": "object",
        "properties": {
            "filters": {"items": {"$ref": "#/$defs/MyFilter"}, "type": "array"},
        },
        "$defs": {
            "MyFilter": {
                "type": "object",
                "properties": {"col": {"type": "string"}},
            }
        },
    }

    result = _compact_schema(schema)

    assert "$defs" not in result
    assert result["properties"]["filters"]["items"] == {"type": "object"}


def test_compact_schema_replaces_ref_with_object():
    """Direct $ref is replaced with {"type": "object"}."""
    schema = {"$ref": "#/$defs/SomeModel"}

    result = _compact_schema(schema)

    assert result == {"type": "object"}


def test_compact_schema_preserves_ref_description():
    """$ref replacement preserves sibling description if present."""
    schema = {"$ref": "#/$defs/SomeModel", "description": "A model"}

    result = _compact_schema(schema)

    assert result == {"type": "object", "description": "A model"}


def test_compact_schema_simplifies_optional_ref():
    """anyOf with $ref and null is collapsed to the non-null variant."""
    schema = {
        "anyOf": [
            {"$ref": "#/$defs/SomeModel"},
            {"type": "null"},
        ],
        "description": "Optional model",
    }

    result = _compact_schema(schema)

    assert "anyOf" not in result
    assert result["type"] == "object"
    assert result["description"] == "Optional model"


def test_compact_schema_simplifies_optional_primitive():
    """anyOf with primitive type and null is collapsed."""
    schema = {
        "anyOf": [
            {"type": "integer"},
            {"type": "null"},
        ],
        "default": None,
    }

    result = _compact_schema(schema)

    assert "anyOf" not in result
    assert result["type"] == "integer"
    assert result["default"] is None


def test_compact_schema_preserves_multi_variant_anyof():
    """anyOf with >2 variants or no null is left unchanged."""
    schema = {
        "anyOf": [
            {"type": "integer"},
            {"type": "string"},
        ]
    }

    result = _compact_schema(schema)

    assert "anyOf" in result
    assert len(result["anyOf"]) == 2


def test_compact_schema_nested_in_items():
    """$ref nested inside items/properties is also replaced."""
    schema = {
        "type": "object",
        "properties": {
            "filters": {
                "type": "array",
                "items": {"$ref": "#/$defs/Filter"},
            },
            "name": {"type": "string"},
        },
    }

    result = _compact_schema(schema)

    assert result["properties"]["filters"]["items"] == {"type": "object"}
    assert result["properties"]["name"] == {"type": "string"}


def test_compact_schema_passthrough_simple():
    """Simple schema without $defs/$ref passes through unchanged."""
    schema = {
        "type": "object",
        "properties": {
            "page": {"type": "integer", "default": 1},
            "search": {"type": "string"},
        },
    }

    result = _compact_schema(schema)

    assert result == schema


def test_compact_schema_handles_non_dict():
    """Non-dict inputs pass through unchanged."""
    assert _compact_schema("hello") == "hello"
    assert _compact_schema(42) == 42
    assert _compact_schema(None) is None
    assert _compact_schema([1, 2]) == [1, 2]


# -- _truncate_description tests --


def test_truncate_description_short_text():
    """Short text is returned as-is."""
    assert _truncate_description("Hello world", 300) == "Hello world"


def test_truncate_description_cuts_at_sentence():
    """Long text is cut at the last sentence boundary."""
    text = "First sentence. Second sentence. Third sentence that is quite long."
    result = _truncate_description(text, 40)
    assert result == "First sentence. Second sentence."


def test_truncate_description_ellipsis_fallback():
    """When no sentence boundary, truncates with ellipsis."""
    text = "A very long single sentence without periods that goes on and on"
    result = _truncate_description(text, 30)
    assert result.endswith("...")
    assert len(result) <= 33  # 30 + "..."


def test_truncate_description_empty():
    """Empty string returns empty."""
    assert _truncate_description("", 300) == ""


def test_truncate_description_zero_max():
    """Zero max_length produces ellipsis; the serializer skips calling this."""
    text = "Some text"
    # _truncate_description(text, 0) truncates to 0 chars and appends "...".
    # The caller (_create_search_result_serializer) skips calling it when
    # max_desc=0 so this edge case only matters for direct callers.
    result = _truncate_description(text, 0)
    assert result == "..."


# -- _create_search_result_serializer tests --


def _make_mock_tool(name, description, input_schema):
    """Helper to create a mock tool for serializer tests."""
    mock_tool = MagicMock()
    mock_mcp_tool = MagicMock()
    mock_mcp_tool.model_dump.return_value = {
        "name": name,
        "description": description,
        "inputSchema": input_schema,
    }
    mock_tool.to_mcp_tool.return_value = mock_mcp_tool
    return mock_tool


def test_create_serializer_compacts_schemas():
    """Compact serializer strips $defs and replaces $ref."""
    tool = _make_mock_tool(
        "list_charts",
        "List charts with filtering.",
        {
            "type": "object",
            "properties": {
                "filters": {
                    "type": "array",
                    "items": {"$ref": "#/$defs/ChartFilter"},
                }
            },
            "$defs": {
                "ChartFilter": {
                    "type": "object",
                    "properties": {"col": {"type": "string"}},
                }
            },
        },
    )

    serializer = _create_search_result_serializer(
        {"include_schemas": True, "compact_schemas": True}
    )
    result = serializer([tool])

    assert len(result) == 1
    schema = result[0]["inputSchema"]
    assert "$defs" not in schema
    assert schema["properties"]["filters"]["items"] == {"type": "object"}


def test_create_serializer_truncates_descriptions():
    """Compact serializer truncates long tool descriptions."""
    long_desc = "Short intro. " + "x" * 500
    tool = _make_mock_tool(
        "generate_chart",
        long_desc,
        {"type": "object"},
    )

    serializer = _create_search_result_serializer({"max_description_length": 50})
    result = serializer([tool])

    assert len(result[0]["description"]) <= 53  # 50 + potential "..."


def test_create_serializer_disabled():
    """When compact_schemas=False and max_description_length=0, no compaction."""
    tool = _make_mock_tool(
        "test_tool",
        "A long description " * 20,
        {
            "type": "object",
            "$defs": {"Model": {"type": "object"}},
        },
    )

    serializer = _create_search_result_serializer(
        {"include_schemas": True, "compact_schemas": False, "max_description_length": 0}
    )
    result = serializer([tool])

    # $defs should still be present (compaction disabled)
    assert "$defs" in result[0]["inputSchema"]
    # Description should not be truncated
    assert result[0]["description"] == "A long description " * 20


def test_create_serializer_compact_false_disables_truncation():
    """compact_schemas=False also disables description truncation by default."""
    long_desc = "A very long description. " * 30
    tool = _make_mock_tool(
        "test_tool",
        long_desc,
        {"type": "object", "$defs": {"Model": {"type": "object"}}},
    )

    serializer = _create_search_result_serializer(
        {"include_schemas": True, "compact_schemas": False}
    )
    result = serializer([tool])

    # $defs should still be present (compaction disabled)
    assert "$defs" in result[0]["inputSchema"]
    # Description should NOT be truncated (max_desc defaults to 0 when compact=False)
    assert result[0]["description"] == long_desc


def test_create_serializer_compact_false_explicit_truncation():
    """compact_schemas=False with explicit max_description_length still truncates."""
    long_desc = "First sentence. " + "x" * 500
    tool = _make_mock_tool(
        "test_tool",
        long_desc,
        {"type": "object", "$defs": {"Model": {"type": "object"}}},
    )

    serializer = _create_search_result_serializer(
        {
            "include_schemas": True,
            "compact_schemas": False,
            "max_description_length": 200,
        }
    )
    result = serializer([tool])

    # $defs should still be present (compaction disabled)
    assert "$defs" in result[0]["inputSchema"]
    # Description SHOULD be truncated (explicitly requested)
    assert len(result[0]["description"]) <= 203


def test_create_serializer_uses_config_defaults():
    """Empty config defaults to summary mode (include_schemas=False).

    The new default omits inputSchema and adds parameters_hint instead.
    Descriptions are still truncated to 300 chars.
    """
    long_desc = "First sentence. " + "x" * 500
    tool = _make_mock_tool(
        "test_tool",
        long_desc,
        {
            "type": "object",
            "$defs": {"Model": {"type": "object"}},
            "properties": {"x": {"$ref": "#/$defs/Model"}},
        },
    )

    serializer = _create_search_result_serializer({})
    result = serializer([tool])

    # Summary mode: no inputSchema, parameters_hint present
    assert "inputSchema" not in result[0]
    assert result[0]["parameters_hint"] == "x"
    # Description still truncated to default 300
    assert len(result[0]["description"]) <= 303


def test_apply_transform_uses_compact_serializer():
    """_apply_tool_search_transform wires _create_search_result_serializer."""
    mock_mcp = MagicMock()
    config = {
        "strategy": "bm25",
        "max_results": 5,
        "always_visible": ["health_check"],
        "search_tool_name": "search_tools",
        "call_tool_name": "call_tool",
        "compact_schemas": True,
        "max_description_length": 200,
    }

    _apply_tool_search_transform(mock_mcp, config)

    mock_mcp.add_transform.assert_called_once()
    transform = mock_mcp.add_transform.call_args[0][0]
    # The serializer should NOT be the plain _serialize_tools_without_output_schema
    assert (
        transform._search_result_serializer
        is not _serialize_tools_without_output_schema
    )


def test_tool_search_permission_filter_hides_disallowed_tools():
    """Search candidates exclude tools the current user cannot execute."""
    app = Flask(__name__)
    app.config["MCP_RBAC_ENABLED"] = True

    def permitted_tool():
        pass

    def denied_tool():
        pass

    for func in (permitted_tool, denied_tool):
        setattr(func, CLASS_PERMISSION_ATTR, "Dataset")
        setattr(func, METHOD_PERMISSION_ATTR, "get_drill_info")

    permitted = SimpleNamespace(fn=permitted_tool)
    denied = SimpleNamespace(fn=denied_tool)
    public = SimpleNamespace(fn=lambda: None)

    with app.app_context():
        g.user = SimpleNamespace(username="viewer")
        with patch(
            "superset.security_manager", new_callable=MagicMock
        ) as security_manager:
            security_manager.can_access.side_effect = [True, False]

            result = _filter_tools_by_current_user_permission(
                [permitted, denied, public]
            )

    assert result == [permitted, public]
    security_manager.can_access.assert_any_call("can_get_drill_info", "Dataset")


def test_tool_search_permission_filter_hides_protected_tools_without_user():
    """Protected tools are hidden from search when no Flask user is present."""
    app = Flask(__name__)
    app.config["MCP_RBAC_ENABLED"] = True

    def protected_tool():
        pass

    setattr(protected_tool, CLASS_PERMISSION_ATTR, "Dataset")
    setattr(protected_tool, METHOD_PERMISSION_ATTR, "get_drill_info")

    protected = SimpleNamespace(fn=protected_tool)
    public = SimpleNamespace(fn=lambda: None)

    with app.app_context():
        result = _filter_tools_by_current_user_permission([protected, public])

    assert result == [public]


def test_tool_search_permission_filter_hides_data_model_tools_without_metadata_access():
    """Privacy-marked tools are hidden even if broad Dataset read exists."""
    app = Flask(__name__)
    app.config["MCP_RBAC_ENABLED"] = True

    @requires_data_model_metadata_access
    def metadata_tool():
        pass

    metadata = SimpleNamespace(fn=metadata_tool)
    public = SimpleNamespace(fn=lambda: None)

    with app.app_context():
        g.user = SimpleNamespace(username="viewer")
        with patch(
            "superset.mcp_service.server.user_can_view_data_model_metadata",
            return_value=False,
        ):
            result = _filter_tools_by_current_user_permission([metadata, public])

    assert result == [public]


# -- _extract_parameter_names tests --


def test_extract_parameter_names_basic():
    """Returns comma-separated top-level property names."""
    schema = {
        "type": "object",
        "properties": {
            "page": {"type": "integer"},
            "page_size": {"type": "integer"},
            "search": {"type": "string"},
        },
    }

    result = _extract_parameter_names(schema)

    assert result == "page, page_size, search"


def test_extract_parameter_names_empty_properties():
    """Returns empty string when properties dict is empty."""
    schema = {"type": "object", "properties": {}}

    result = _extract_parameter_names(schema)

    assert result == ""


def test_extract_parameter_names_no_properties_key():
    """Returns empty string when properties key is absent."""
    schema = {"type": "object"}

    result = _extract_parameter_names(schema)

    assert result == ""


def test_extract_parameter_names_with_refs():
    """Extracts names regardless of the shape of property values."""
    schema = {
        "type": "object",
        "properties": {
            "filters": {"type": "array", "items": {"$ref": "#/$defs/ChartFilter"}},
            "select_columns": {"type": "array"},
        },
        "$defs": {"ChartFilter": {"type": "object"}},
    }

    result = _extract_parameter_names(schema)

    assert result == "filters, select_columns"


# -- _create_search_result_serializer summary mode (include_schemas=False) --


def test_create_serializer_summary_mode_strips_input_schema():
    """When include_schemas=False, inputSchema is absent from results."""
    tool = _make_mock_tool(
        "list_charts",
        "List charts.",
        {
            "type": "object",
            "properties": {
                "page": {"type": "integer"},
                "search": {"type": "string"},
            },
        },
    )

    serializer = _create_search_result_serializer({"include_schemas": False})
    result = serializer([tool])

    assert len(result) == 1
    assert "inputSchema" not in result[0]
    assert result[0]["name"] == "list_charts"


def test_create_serializer_summary_mode_adds_parameters_hint():
    """When include_schemas=False, parameters_hint lists top-level param names."""
    tool = _make_mock_tool(
        "list_charts",
        "List charts.",
        {
            "type": "object",
            "properties": {
                "page": {"type": "integer"},
                "page_size": {"type": "integer"},
                "search": {"type": "string"},
            },
        },
    )

    serializer = _create_search_result_serializer({"include_schemas": False})
    result = serializer([tool])

    assert result[0]["parameters_hint"] == "page, page_size, search"


def test_create_serializer_summary_mode_no_hint_when_no_properties():
    """When inputSchema has no properties, parameters_hint is absent."""
    tool = _make_mock_tool(
        "health_check",
        "Health check.",
        {"type": "object"},
    )

    serializer = _create_search_result_serializer({"include_schemas": False})
    result = serializer([tool])

    assert "inputSchema" not in result[0]
    assert "parameters_hint" not in result[0]


def test_create_serializer_summary_mode_truncates_description():
    """Summary mode still truncates descriptions to max_description_length."""
    long_desc = "First sentence. " + "x" * 500
    tool = _make_mock_tool(
        "list_charts",
        long_desc,
        {"type": "object", "properties": {"page": {"type": "integer"}}},
    )

    serializer = _create_search_result_serializer(
        {"include_schemas": False, "max_description_length": 50}
    )
    result = serializer([tool])

    assert len(result[0]["description"]) <= 53


def test_create_serializer_summary_mode_is_default():
    """Empty config defaults to summary mode (include_schemas=False)."""
    tool = _make_mock_tool(
        "list_charts",
        "List charts.",
        {
            "type": "object",
            "properties": {"page": {"type": "integer"}},
        },
    )

    serializer = _create_search_result_serializer({})
    result = serializer([tool])

    assert "inputSchema" not in result[0]
    assert "parameters_hint" in result[0]


def test_create_serializer_include_schemas_true_restores_full_schema():
    """include_schemas=True preserves inputSchema in results."""
    schema = {
        "type": "object",
        "properties": {"page": {"type": "integer"}},
        "$defs": {"Model": {"type": "object"}},
    }
    tool = _make_mock_tool("list_charts", "List charts.", schema)

    serializer = _create_search_result_serializer(
        {"include_schemas": True, "compact_schemas": False, "max_description_length": 0}
    )
    result = serializer([tool])

    assert "inputSchema" in result[0]
    assert "parameters_hint" not in result[0]
    assert "$defs" in result[0]["inputSchema"]


def test_create_serializer_include_schemas_true_with_compact():
    """include_schemas=True + compact_schemas=True still compacts the schema."""
    schema = {
        "type": "object",
        "properties": {
            "filters": {"type": "array", "items": {"$ref": "#/$defs/ChartFilter"}}
        },
        "$defs": {"ChartFilter": {"type": "object"}},
    }
    tool = _make_mock_tool("list_charts", "List charts.", schema)

    serializer = _create_search_result_serializer(
        {"include_schemas": True, "compact_schemas": True}
    )
    result = serializer([tool])

    assert "inputSchema" in result[0]
    assert "$defs" not in result[0]["inputSchema"]
    assert result[0]["inputSchema"]["properties"]["filters"]["items"] == {
        "type": "object"
    }
