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

"""Size and schema-first invocation regressions for chart tool inventory entries."""

from collections.abc import Callable, Iterator
from copy import deepcopy
from typing import Any

import pytest
from fastmcp.tools import FunctionTool
from jsonschema import Draft202012Validator
from pydantic import BaseModel

from superset.mcp_service.app import mcp
from superset.mcp_service.chart.schemas import (
    CHART_CONFIG_REFERENCE_SCHEMA,
    CHART_TYPE_VALUES,
    GenerateChartRequest,
    GenerateExploreLinkRequest,
    UpdateChartPreviewRequest,
    UpdateChartRequest,
)
from superset.mcp_service.chart.tool.get_chart_type_schema import (
    _get_chart_type_schema_impl,
)
from superset.mcp_service.mcp_config import MCP_TOOL_SEARCH_CONFIG
from superset.mcp_service.server import (
    _create_search_result_serializer,
    _strip_titles,
)
from superset.utils import json

CHART_TOOLS = [
    ("generate_chart", GenerateChartRequest),
    ("update_chart", UpdateChartRequest),
    ("update_chart_preview", UpdateChartPreviewRequest),
    ("generate_explore_link", GenerateExploreLinkRequest),
]

# Compact JSON, measured as UTF-8 bytes, including tool metadata. Chart tools
# advertise ``config`` as a compact discriminated reference (chart_type plus a
# pointer to get_chart_type_schema), so their size no longer grows with each
# registered chart type. Inlining every chart type's schema measured
# generate_chart 49,531 B, update_chart 53,395 B, update_chart_preview
# 52,409 B and generate_explore_link 49,230 B with 15 types, and grew by
# several kB per added type. Budgets follow the small-tool snapshot rule:
# ceil(measured_bytes / 100) * 100 + 100.
TOOL_BUDGETS = [
    ("generate_chart", 2_500),
    ("update_chart", 4_200),
    ("update_chart_preview", 2_200),
    ("generate_explore_link", 2_000),
]


def _references(node: Any) -> Iterator[str]:
    """Collect schema references, including discriminator mapping targets."""
    if isinstance(node, dict):
        if "$ref" in node:
            yield node["$ref"]
        if "discriminator" in node:
            yield from node["discriminator"].get("mapping", {}).values()
        for value in node.values():
            yield from _references(value)
    elif isinstance(node, list):
        for value in node:
            yield from _references(value)


def _resolve_pointer(schema: dict[str, Any], ref: str) -> Any:
    """Resolve a local JSON Pointer against this tool's input schema."""
    assert ref.startswith("#/")
    target: Any = schema
    for part in ref[2:].split("/"):
        target = target[part.replace("~1", "/").replace("~0", "~")]
    return target


async def _input_schema(name: str) -> dict[str, Any]:
    tool = await mcp.get_tool(name)
    return _create_search_result_serializer(MCP_TOOL_SEARCH_CONFIG)([tool])[0][
        "inputSchema"
    ]


def _config_schema(schema: dict[str, Any], model: type[BaseModel]) -> dict[str, Any]:
    """Return the advertised config schema, unwrapping an optional config."""
    request_schema = _resolve_pointer(schema, schema["properties"]["request"]["$ref"])
    assert request_schema == _strip_titles(schema["$defs"][model.__name__])
    config = request_schema["properties"]["config"]
    for option in config.get("anyOf", []):
        if option.get("type") == "object":
            return option
    return config


def _type_schema(chart_type: str) -> dict[str, Any]:
    """Return the per-type schema a client fetches from get_chart_type_schema."""
    response = _get_chart_type_schema_impl(chart_type, include_examples=False)
    assert "schema" in response, response
    return response["schema"]


@pytest.mark.asyncio
@pytest.mark.parametrize(("name", "byte_budget"), TOOL_BUDGETS)
async def test_chart_tool_inventory_size(name: str, byte_budget: int) -> None:
    """Measure each real registered inventory entry, not a hand-built schema."""
    tool = await mcp.get_tool(name)
    serializer = _create_search_result_serializer(MCP_TOOL_SEARCH_CONFIG)
    entry = serializer([tool])[0]
    assert "inputSchema" in entry  # Summary mode must not mask a size regression.
    text = json.dumps(entry, ensure_ascii=False, separators=(",", ":"))
    byte_count = len(text.encode("utf-8"))

    assert byte_count <= byte_budget, (name, byte_count)


@pytest.mark.asyncio
@pytest.mark.parametrize(("name", "model"), CHART_TOOLS)
async def test_chart_tool_schema_is_independent_of_chart_type_count(
    name: str, model: type[BaseModel]
) -> None:
    """Chart tools advertise a compact config; per-type schemas are not inlined."""
    schema = await _input_schema(name)
    inlined = [key for key in schema.get("$defs", {}) if key.endswith("ChartConfig")]
    assert not inlined, inlined
    request_schema = _resolve_pointer(schema, schema["properties"]["request"]["$ref"])
    assert "get_chart_type_schema" in request_schema["properties"]["config"].get(
        "description", ""
    )
    config = _config_schema(schema, model)
    assert {k: v for k, v in config.items() if k != "description"} == (
        CHART_CONFIG_REFERENCE_SCHEMA
    )
    assert config["properties"]["chart_type"]["enum"] == CHART_TYPE_VALUES


@pytest.mark.parametrize("chart_type", CHART_TYPE_VALUES)
def test_every_advertised_chart_type_has_a_served_schema(chart_type: str) -> None:
    """Every advertised chart_type is served, or reported as disabled by the host."""
    response = _get_chart_type_schema_impl(chart_type, include_examples=False)
    if "error" in response:
        assert response["error"]["error_type"] == "disabled_chart_type"
        return
    schema = response["schema"]
    Draft202012Validator.check_schema(schema)
    assert schema["properties"]["chart_type"]["const"] == chart_type


@pytest.mark.asyncio
@pytest.mark.parametrize("name", [row[0] for row in TOOL_BUDGETS])
async def test_chart_tool_inventory_preserves_complete_schema(name: str) -> None:
    """All constraints and reference targets survive the production serializer."""
    tool = await mcp.get_tool(name)
    original = deepcopy(tool.parameters)
    entry = _create_search_result_serializer(MCP_TOOL_SEARCH_CONFIG)([tool])[0]
    schema = entry["inputSchema"]

    assert schema == _strip_titles(original)
    assert tool.parameters == original
    Draft202012Validator.check_schema(schema)
    refs = list(_references(schema))
    assert refs
    for ref in refs:
        assert _resolve_pointer(schema, ref) == _strip_titles(
            _resolve_pointer(original, ref)
        )

    validator = Draft202012Validator(schema)
    request: dict[str, Any] = {
        "identifier" if name == "update_chart" else "dataset_id": 1,
        "config": {"chart_type": "table", "columns": [{"name": "region"}]},
    }
    validator.validate({"request": request})
    # The tool schema rejects unknown chart types; field constraints are
    # enforced by the per-type schema served through get_chart_type_schema.
    request["config"]["chart_type"] = "not_a_chart_type"
    assert not validator.is_valid({"request": request})
    del request["config"]["chart_type"]
    assert not validator.is_valid({"request": request})
    type_validator = Draft202012Validator(_type_schema("table"))
    assert type_validator.is_valid(
        {"chart_type": "table", "columns": [{"name": "region"}]}
    )
    assert not type_validator.is_valid(
        {"chart_type": "table", "columns": [{"name": ""}]}
    )


def _generate_fixture(request: GenerateChartRequest) -> str:
    """Accept a typed request without creating charts or querying a database."""
    return request.config.chart_type


def _update_fixture(request: UpdateChartRequest) -> str:
    """Accept a typed update without changing a saved chart."""
    assert request.config is not None
    return request.config.chart_type


def _explore_fixture(request: GenerateExploreLinkRequest) -> str:
    """Accept a typed request without writing to the permalink cache."""
    assert request.config is not None
    return request.config.chart_type


@pytest.mark.asyncio
@pytest.mark.parametrize(
    ("name", "fixture", "model"),
    [
        ("generate_chart", _generate_fixture, GenerateChartRequest),
        ("update_chart", _update_fixture, UpdateChartRequest),
        ("generate_explore_link", _explore_fixture, GenerateExploreLinkRequest),
    ],
)
async def test_chart_tool_schema_first_invocation(
    name: str, fixture: Callable[..., str], model: type[BaseModel]
) -> None:
    """Build an invocation from the tool schema plus get_chart_type_schema."""
    schema = await _input_schema(name)
    request_schema = _resolve_pointer(schema, schema["properties"]["request"]["$ref"])
    config_schema = _config_schema(schema, model)
    assert "table" in config_schema["properties"]["chart_type"]["enum"]
    # Resolve the table variant and its column model from the per-type schema
    # the client fetches, rather than substituting a generic object.
    table_schema = _type_schema("table")
    column_schema = _resolve_pointer(
        table_schema, table_schema["properties"]["columns"]["items"]["$ref"]
    )
    assert "columns" in table_schema["required"]
    assert "name" in column_schema["properties"]
    config = {
        "chart_type": table_schema["properties"]["chart_type"]["const"],
        "columns": [{"name": "region"}],
    }
    Draft202012Validator(table_schema).validate(config)
    request: dict[str, Any] = {
        key: 1 for key in request_schema["required"] if key != "config"
    }
    request["config"] = config
    arguments = {"request": request}
    Draft202012Validator(schema).validate(arguments)
    # Use the same request model through FastMCP's real argument validation,
    # but replace persistence/query execution with the explicitly typed fixture.
    controlled_tool = FunctionTool.from_function(fixture)
    result = await controlled_tool.run(arguments)
    assert result.content[0].text == "table"


@pytest.mark.asyncio
async def test_compact_schema_keeps_server_side_validation() -> None:
    """Invalid per-type fields are still rejected by the request model."""
    controlled_tool = FunctionTool.from_function(_generate_fixture)
    with pytest.raises(Exception, match="columns|name"):
        await controlled_tool.run(
            {
                "request": {
                    "dataset_id": 1,
                    "config": {"chart_type": "table", "columns": [{"name": ""}]},
                }
            }
        )
