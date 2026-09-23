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
import tiktoken
from fastmcp.tools import FunctionTool
from jsonschema import Draft202012Validator
from pydantic import BaseModel

from superset.mcp_service.app import mcp
from superset.mcp_service.chart.schemas import (
    GenerateChartRequest,
    GenerateExploreLinkRequest,
    UpdateChartRequest,
)
from superset.mcp_service.mcp_config import MCP_TOOL_SEARCH_CONFIG
from superset.mcp_service.server import (
    _create_search_result_serializer,
    _strip_titles,
)
from superset.utils import json

# Compact JSON, UTF-8 bytes and tiktoken 0.14.0 / cl100k_base tokens measured
# independently (BPE estimates, not a Claude tokenizer or bytes/token conversion).
# Apache f8f293d2 -> reference-preserving inventory, including tool metadata:
# generate_chart:        97013 B / 23543 tok -> 49531 B / 11849 tok
# update_chart:         104163 B / 25227 tok -> 53395 B / 12759 tok
# generate_explore_link: 96581 B / 23478 tok -> 49230 B / 11806 tok
# update_chart exceeds the proposed 50 kB target; 55 kB retains the entire
# contract and stays below the 100 kB delivery cap. All use a 20k token budget.
TOOL_BUDGETS = [
    ("generate_chart", 50_000),
    ("update_chart", 55_000),
    ("generate_explore_link", 50_000),
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


@pytest.mark.asyncio()
@pytest.mark.parametrize(("name", "byte_budget"), TOOL_BUDGETS)
async def test_chart_tool_inventory_size(name: str, byte_budget: int) -> None:
    """Measure each real registered inventory entry, not a hand-built schema."""
    tool = await mcp.get_tool(name)
    serializer = _create_search_result_serializer(MCP_TOOL_SEARCH_CONFIG)
    entry = serializer([tool])[0]
    assert "inputSchema" in entry  # Summary mode must not mask a size regression.
    text = json.dumps(entry, ensure_ascii=False, separators=(",", ":"))
    byte_count = len(text.encode("utf-8"))
    token_count = len(
        tiktoken.get_encoding("cl100k_base").encode(text, disallowed_special=())
    )

    assert byte_count <= byte_budget, (name, byte_count)
    assert token_count <= 20_000, (name, token_count)


@pytest.mark.asyncio()
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
    request["config"]["columns"] = [{"name": ""}]
    assert not validator.is_valid({"request": request})


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


@pytest.mark.asyncio()
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
    """Follow published refs to build an invocation for a controlled tool body."""
    tool = await mcp.get_tool(name)
    schema = _create_search_result_serializer(MCP_TOOL_SEARCH_CONFIG)([tool])[0][
        "inputSchema"
    ]
    request_schema = _resolve_pointer(schema, schema["properties"]["request"]["$ref"])
    assert request_schema == _strip_titles(schema["$defs"][model.__name__])
    # Resolve the advertised table variant and column model rather than inlining
    # or substituting a generic object when a client encounters a reference.
    table_ref = next(
        ref
        for ref in _references(request_schema["properties"]["config"])
        if _resolve_pointer(schema, ref)
        .get("properties", {})
        .get("chart_type", {})
        .get("const")
        == "table"
    )
    table_schema = _resolve_pointer(schema, table_ref)
    column_schema = _resolve_pointer(
        schema, table_schema["properties"]["columns"]["items"]["$ref"]
    )
    assert "columns" in table_schema["required"]
    assert "name" in column_schema["properties"]
    request: dict[str, Any] = {
        key: 1 for key in request_schema["required"] if key != "config"
    }
    request["config"] = {
        "chart_type": table_schema["properties"]["chart_type"]["const"],
        "columns": [{"name": "region"}],
    }
    arguments = {"request": request}
    Draft202012Validator(schema).validate(arguments)
    # Use the same request model through FastMCP's real argument validation,
    # but replace persistence/query execution with the explicitly typed fixture.
    controlled_tool = FunctionTool.from_function(fixture)
    result = await controlled_tool.run(arguments)
    assert result.content[0].text == "table"
