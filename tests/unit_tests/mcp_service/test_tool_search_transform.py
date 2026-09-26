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

import logging
from types import SimpleNamespace
from unittest.mock import MagicMock, Mock, patch

import pytest
from fastmcp.server.transforms.search import BM25SearchTransform, RegexSearchTransform
from flask import Flask, g

from superset.mcp_service.auth import CLASS_PERMISSION_ATTR, METHOD_PERMISSION_ATTR
from superset.mcp_service.mcp_config import MCP_TOOL_SEARCH_CONFIG
from superset.mcp_service.privacy import requires_data_model_metadata_access
from superset.mcp_service.server import (
    _apply_tool_search_transform,
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
    assert MCP_TOOL_SEARCH_CONFIG["include_schemas"] is True


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


# -- search schema fidelity tests --


def test_search_schema_preserves_references_and_constraints() -> None:
    """Shared and recursive definitions remain resolvable without losing constraints."""
    schema = {
        "type": "object",
        "properties": {
            "first": {"$ref": "#/$defs/Node", "description": "First", "maxItems": 2},
            "second": {"$ref": "#/$defs/Node"},
        },
        "required": ["first"],
        "additionalProperties": False,
        "$defs": {
            "Node": {
                "type": "array",
                "minItems": 1,
                "items": {
                    "anyOf": [{"$ref": "#/$defs/Node"}, {"type": "integer"}],
                },
            },
        },
    }
    serializer = _create_search_result_serializer({"include_schemas": True})
    result = serializer([_make_mock_tool("tree", "A tree.", schema)])

    assert result[0]["inputSchema"] == schema


def test_search_schema_preserves_nullable_unions() -> None:
    """Nullable unions, siblings, defaults, and discriminator mappings are guidance."""
    schema = {
        "type": "object",
        "properties": {
            "config": {
                "oneOf": [{"$ref": "#/$defs/Config"}, {"type": "null"}],
                "description": "Optional config",
                "default": None,
                "discriminator": {
                    "propertyName": "kind",
                    "mapping": {"table": "#/$defs/Config"},
                },
            },
            "count": {
                "anyOf": [{"type": "integer", "minimum": 1}, {"type": "null"}],
                "default": None,
            },
        },
        "$defs": {
            "Config": {
                "type": "object",
                "properties": {"kind": {"const": "table"}},
                "required": ["kind"],
            },
        },
    }
    serializer = _create_search_result_serializer({"include_schemas": True})
    result = serializer([_make_mock_tool("nullable", "Nullable.", schema)])

    assert result[0]["inputSchema"] == schema


# -- _truncate_description tests --


def test_truncate_description_short_text():
    """Short text is returned as-is."""
    assert _truncate_description("Hello world", 300) == "Hello world"


def test_truncate_description_cuts_at_sentence():
    """Long text is cut at the last sentence boundary."""
    text = "First sentence. Second sentence. Third sentence that is quite long."
    result = _truncate_description(text, 40)
    assert result == "First sentence. Second sentence."


def test_truncate_description_without_sentence_boundary():
    """Omit prose rather than advertising a partial instruction."""
    text = "A very long single sentence without periods that goes on and on"
    result = _truncate_description(text, 30)
    assert result == ""


def test_truncate_description_empty():
    """Empty string returns empty."""
    assert _truncate_description("", 300) == ""


def test_truncate_description_zero_max():
    """No prose remains when schema instructions consume the entire budget."""
    text = "Some text"
    result = _truncate_description(text, 0)
    assert result == ""


@pytest.mark.parametrize("limit", [1, 2, 20, 300])
def test_truncate_description_oversized(limit: int) -> None:
    """Oversized prose never exceeds even a very small configured budget."""
    assert _truncate_description("x" * 100_000, limit) == ""


def test_truncate_description_multiline_sentence() -> None:
    """A newline after punctuation is a sentence boundary too."""
    assert _truncate_description(
        "First sentence.\nA long instruction follows.", 20
    ) == ("First sentence.")


@pytest.mark.parametrize("marker", ["IMPORTANT:", "**IMPORTANT**:"])
def test_truncate_description_important_block_sentence(marker: str) -> None:
    """Do not advertise a half instruction when the cut falls in an IMPORTANT block."""
    prefix = f"Summary.\n\n{marker} First rule."
    text = prefix + "\n" + "An instruction too long for the remaining budget " * 100
    assert _truncate_description(text, 100) == prefix


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
    """Search serialization keeps shared definitions and their references."""
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
    assert schema["$defs"]["ChartFilter"]["properties"] == {"col": {"type": "string"}}
    assert schema["properties"]["filters"]["items"] == {"$ref": "#/$defs/ChartFilter"}


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


@pytest.mark.parametrize("compact", [False, True])
def test_create_serializer_disabled(compact: bool) -> None:
    """An explicit zero description limit disables truncation in either mode."""
    tool = _make_mock_tool(
        "test_tool",
        "A long description " * 20,
        {
            "type": "object",
            "$defs": {"Model": {"type": "object"}},
        },
    )

    serializer = _create_search_result_serializer(
        {
            "include_schemas": True,
            "compact_schemas": compact,
            "max_description_length": 0,
        }
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
            "superset.mcp_service.auth.security_manager", new_callable=MagicMock
        ) as security_manager:
            security_manager.can_access.side_effect = [True, False]

            result = _filter_tools_by_current_user_permission(
                [permitted, denied, public]
            )

    assert result == [permitted, public]
    security_manager.can_access.assert_any_call("can_get_drill_info", "Dataset")


def test_tool_search_permission_filter_hides_protected_tools_without_user() -> None:
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


def test_tool_search_permission_filter_denies_all_on_invalid_credentials() -> None:
    """Invalid credentials (PermissionError) deny all tools, including public ones."""
    app = Flask(__name__)
    app.config["MCP_RBAC_ENABLED"] = True

    def protected_tool():
        pass

    setattr(protected_tool, CLASS_PERMISSION_ATTR, "Dataset")
    setattr(protected_tool, METHOD_PERMISSION_ATTR, "read")

    protected = SimpleNamespace(fn=protected_tool)
    public = SimpleNamespace(fn=lambda: None)

    with app.app_context():
        with patch(
            "superset.mcp_service.auth.get_user_from_request",
            side_effect=PermissionError("Invalid API key"),
        ):
            result = _filter_tools_by_current_user_permission([protected, public])

    assert result == []


def test_tool_search_filter_hides_metadata_tools_without_access() -> None:
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
            "superset.mcp_service.privacy.user_can_view_data_model_metadata",
            return_value=False,
        ):
            result = _filter_tools_by_current_user_permission([metadata, public])

    assert result == [public]


def test_tool_search_permission_filter_still_applies_rbac_to_metadata_tools() -> None:
    """Privacy-marked tools still require the underlying tool permission."""
    app = Flask(__name__)
    app.config["MCP_RBAC_ENABLED"] = True

    @requires_data_model_metadata_access
    def metadata_tool():
        pass

    setattr(metadata_tool, CLASS_PERMISSION_ATTR, "Dataset")
    setattr(metadata_tool, METHOD_PERMISSION_ATTR, "get_drill_info")

    metadata = SimpleNamespace(fn=metadata_tool)
    public = SimpleNamespace(fn=lambda: None)

    with app.app_context():
        g.user = SimpleNamespace(username="viewer")
        with (
            patch(
                "superset.mcp_service.privacy.user_can_view_data_model_metadata",
                return_value=True,
            ),
            patch(
                "superset.mcp_service.auth.security_manager", new_callable=Mock
            ) as security_manager,
        ):
            security_manager.can_access.return_value = False
            result = _filter_tools_by_current_user_permission([metadata, public])

    assert result == [public]


def test_tool_search_permission_filter_resolves_user_from_request() -> None:
    """Search filtering resolves the current user when g.user is not already set."""
    app = Flask(__name__)
    app.config["MCP_RBAC_ENABLED"] = True

    def protected_tool():
        pass

    setattr(protected_tool, CLASS_PERMISSION_ATTR, "Dataset")
    setattr(protected_tool, METHOD_PERMISSION_ATTR, "read")

    protected = SimpleNamespace(fn=protected_tool)

    with app.app_context():
        with (
            patch(
                "superset.mcp_service.auth.get_user_from_request",
                return_value=SimpleNamespace(username="viewer"),
            ),
            patch(
                "superset.mcp_service.auth.security_manager", new_callable=Mock
            ) as security_manager,
        ):
            security_manager.can_access.return_value = True
            result = _filter_tools_by_current_user_permission([protected])

    assert result == [protected]


def test_tool_search_permission_filter_keeps_get_schema_visible_without_metadata() -> (
    None
):
    """get_schema remains discoverable when only safe model types are available."""
    from superset.mcp_service.system.tool.get_schema import get_schema

    app = Flask(__name__)
    app.config["MCP_RBAC_ENABLED"] = True

    schema_tool = SimpleNamespace(fn=get_schema)

    with app.app_context():
        g.user = SimpleNamespace(username="viewer")
        with (
            patch(
                "superset.mcp_service.privacy.user_can_view_data_model_metadata",
                return_value=False,
            ),
            patch(
                "superset.mcp_service.auth.security_manager", new_callable=Mock
            ) as security_manager,
        ):
            security_manager.can_access.return_value = True
            result = _filter_tools_by_current_user_permission([schema_tool])

    assert result == [schema_tool]


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
    """The legacy compact setting must not expand or weaken input schemas."""
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
    assert result[0]["inputSchema"] == schema


# -- search_tools optional query tests --


def test_call_tool_proxy_rejects_synthetic_names_with_warning_log_level() -> None:
    """call_tool proxy raises ToolError(log_level=WARNING) for synthetic names.

    FastMCP logs ToolError at the exception's log_level before middleware sees
    it.  Synthetic-name rejections are LLM misuse (a 400-class error), not
    system failures, so WARNING prevents them from reaching Sentry via the
    ERROR-level LoggingIntegration.
    """
    import asyncio

    from fastmcp.exceptions import ToolError as FastMCPToolError

    mock_mcp = MagicMock()
    config = {
        "strategy": "bm25",
        "max_results": 5,
        "always_visible": [],
        "search_tool_name": "search_tools",
        "call_tool_name": "call_tool",
    }
    _apply_tool_search_transform(mock_mcp, config)
    transform = mock_mcp.add_transform.call_args[0][0]
    call_tool_obj = transform._make_call_tool()

    async def _run_and_capture(name: str) -> FastMCPToolError:
        import pytest

        with pytest.raises(FastMCPToolError) as exc_info:
            await call_tool_obj.fn(name=name, arguments=None, ctx=None)
        return exc_info.value

    for synthetic_name in ("search_tools", "call_tool"):
        exc = asyncio.run(_run_and_capture(synthetic_name))
        assert exc.log_level == logging.WARNING, (
            f"Expected WARNING for '{synthetic_name}', got {exc.log_level}"
        )
        assert synthetic_name in str(exc)


def test_search_tool_query_is_optional_in_schema() -> None:
    """search_tools schema marks query optional with a flat concrete type.

    The query schema must not use ``anyOf`` — MCP bridges (mcp-remote,
    Claude Desktop) strip ``anyOf`` and leave the field typeless, the same
    failure mode ``_fix_call_tool_arguments`` guards against.
    """
    mock_mcp = MagicMock()
    config = {
        "strategy": "bm25",
        "max_results": 5,
        "always_visible": [],
        "search_tool_name": "search_tools",
        "call_tool_name": "call_tool",
    }
    _apply_tool_search_transform(mock_mcp, config)
    transform = mock_mcp.add_transform.call_args[0][0]
    search_tool = transform._make_search_tool()

    params = search_tool.parameters
    assert "query" not in params.get("required", [])
    query_schema = params["properties"]["query"]
    assert query_schema["type"] == "string"
    assert "anyOf" not in query_schema


def test_search_tool_with_no_query_returns_all_visible_tools() -> None:
    """search_tools returns all visible tools when called with no arguments."""
    import asyncio
    from unittest.mock import AsyncMock

    mock_mcp = MagicMock()
    config = {
        "strategy": "bm25",
        "max_results": 5,
        "always_visible": [],
        "search_tool_name": "search_tools",
        "call_tool_name": "call_tool",
    }
    _apply_tool_search_transform(mock_mcp, config)
    transform = mock_mcp.add_transform.call_args[0][0]

    tool_a = MagicMock()
    tool_b = MagicMock()
    all_tools = [tool_a, tool_b]

    async def run() -> list[MagicMock]:
        transform._get_visible_tools = AsyncMock(return_value=all_tools)
        transform._render_results = AsyncMock(return_value=[{"name": "tool_a"}])
        search_tool = transform._make_search_tool()
        await search_tool.run({})  # must not raise ValidationError
        return transform._render_results.call_args[0][0]

    rendered_with = asyncio.run(run())
    assert rendered_with == all_tools


def test_search_tool_empty_string_query_returns_all_visible_tools() -> None:
    """An explicitly empty query is treated like an omitted one (fail open).

    BM25/regex search with no search terms would rank nothing and return
    an empty catalog — the same discovery footgun as the required-query
    bug. Clients sending ``{"query": ""}`` to mean "list everything" get
    the full visible catalog instead.
    """
    import asyncio
    from unittest.mock import AsyncMock

    mock_mcp = MagicMock()
    config = {
        "strategy": "bm25",
        "max_results": 5,
        "always_visible": [],
        "search_tool_name": "search_tools",
        "call_tool_name": "call_tool",
    }
    _apply_tool_search_transform(mock_mcp, config)
    transform = mock_mcp.add_transform.call_args[0][0]

    all_tools = [MagicMock(), MagicMock()]

    async def run() -> list[MagicMock]:
        transform._get_visible_tools = AsyncMock(return_value=all_tools)
        transform._search = AsyncMock()
        transform._render_results = AsyncMock(return_value=[])
        search_tool = transform._make_search_tool()
        await search_tool.run({"query": ""})
        return transform._render_results.call_args[0][0]

    rendered_with = asyncio.run(run())
    assert rendered_with == all_tools
    assert not transform._search.called


def test_search_tool_regex_with_no_query_returns_all_visible_tools() -> None:
    """Regex strategy returns all visible tools when called with no arguments."""
    import asyncio
    from unittest.mock import AsyncMock

    mock_mcp = MagicMock()
    config = {
        "strategy": "regex",
        "max_results": 5,
        "always_visible": [],
        "search_tool_name": "search_tools",
        "call_tool_name": "call_tool",
    }
    _apply_tool_search_transform(mock_mcp, config)
    transform = mock_mcp.add_transform.call_args[0][0]

    all_tools = [MagicMock(), MagicMock()]

    async def run() -> list[MagicMock]:
        transform._get_visible_tools = AsyncMock(return_value=all_tools)
        transform._render_results = AsyncMock(return_value=[])
        search_tool = transform._make_search_tool()
        await search_tool.run({})
        return transform._render_results.call_args[0][0]

    rendered_with = asyncio.run(run())
    assert rendered_with == all_tools
