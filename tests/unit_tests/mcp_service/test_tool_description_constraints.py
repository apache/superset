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

"""Calling guidance must survive discovery without relying on truncated prose."""

import pytest

from superset.mcp_service.app import mcp
from superset.mcp_service.server import _create_search_result_serializer

CONSTRAINTS = {
    "list_dashboards": ("Do NOT pass", "top-level", '{"request": {'),
    "list_charts": ("Do NOT pass", "top-level", '{"request": {'),
    "list_datasets": ("Do NOT pass", "top-level", '{"request": {'),
    "get_chart_info": (
        "NOT chart name",
        "form_data_key",
        "permalink_key",
        '{"request": {',
    ),
    "get_dashboard_info": (
        "filter_state",
        "permalink_key",
        "not query predicates",
        '{"request": {',
    ),
    "generate_dashboard": ("Never use as a fallback", "accessible", '{"request": {'),
}


@pytest.mark.asyncio
@pytest.mark.parametrize("name", CONSTRAINTS)
@pytest.mark.parametrize("include_schemas", [True, False])
@pytest.mark.parametrize("max_desc", [1, 20, 300, 0])
async def test_registered_tool_calling_constraints(
    name: str, include_schemas: bool, max_desc: int
) -> None:
    """Exercise real registrations, including small limits and summary discovery."""
    tool = await mcp.get_tool(name)
    assert tool is not None
    entry = _create_search_result_serializer(
        {"include_schemas": include_schemas, "max_description_length": max_desc}
    )([tool])[0]
    if include_schemas:
        guidance = entry["inputSchema"]["properties"]["request"].get("description", "")
    else:
        guidance = entry.get("parameters_hint", "")
    for constraint in CONSTRAINTS[name]:
        assert constraint in guidance, (name, constraint, entry["description"])
    if max_desc:
        assert len(entry["description"]) <= max_desc


@pytest.mark.asyncio
@pytest.mark.parametrize("name", CONSTRAINTS)
async def test_registered_constraints_have_bounded_size(name: str) -> None:
    """Critical metadata has its own fixed ceiling, not an unbounded IMPORTANT block."""
    tool = await mcp.get_tool(name)
    assert tool is not None
    instructions = tool.parameters["properties"]["request"]["description"]
    assert len(instructions) <= 300
    entry = _create_search_result_serializer({"include_schemas": True})([tool])[0]
    assert len(instructions) + len(entry["description"]) <= 300


@pytest.mark.asyncio
@pytest.mark.parametrize("name", CONSTRAINTS)
@pytest.mark.parametrize("include_schemas", [True, False])
async def test_oversized_registered_description_keeps_calling_constraints(
    name: str, include_schemas: bool
) -> None:
    """Long introductory prose cannot displace metadata or exhaust its budget."""
    tool = await mcp.get_tool(name)
    assert tool is not None
    oversized = tool.model_copy(
        update={"description": "Long introduction. " * 10_000 + tool.description}
    )
    entry = _create_search_result_serializer({"include_schemas": include_schemas})(
        [oversized]
    )[0]
    instructions = tool.parameters["properties"]["request"]["description"]
    if include_schemas:
        assert entry["inputSchema"]["properties"]["request"]["description"] == (
            instructions
        )
    else:
        assert instructions in entry["parameters_hint"]
    assert len(entry["description"]) + len(instructions) <= 300


@pytest.mark.asyncio
async def test_direct_inventory_keeps_bounded_calling_metadata() -> None:
    """Direct tools/list also carries instructions without relying on search."""
    for tool in await mcp.list_tools(run_middleware=False):
        schema = tool.to_mcp_tool().inputSchema
        instructions = (
            schema.get("properties", {}).get("request", {}).get("description", "")
        )
        assert len(instructions) <= 300, tool.name
        if tool.name in CONSTRAINTS:
            assert all(part in instructions for part in CONSTRAINTS[tool.name])
