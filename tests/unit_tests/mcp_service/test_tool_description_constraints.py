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

import re

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


# Each docstring constraint sentence, paired with the phrases that must carry it
# through default discovery. Wrapper boilerplate alone does not satisfy the audit.
DOCSTRING_CONSTRAINTS: dict[str, list[tuple[str, tuple[str, ...]]]] = {
    "list_datasets": [
        ("must be wrapped in a ``request`` object", ('{"request": {',)),
        ("Do NOT pass ``search``", ("Do NOT pass", "top-level")),
        ("Results are candidates, not a relevance ranking", ("not a ranking",)),
        (
            "when multiple candidates fit, explain the alternatives and clarify "
            "before querying",
            ("explain alternatives", "clarify before querying"),
        ),
        (
            "An empty search result does not establish that the requested data "
            "does not exist",
            ("empty result", "prove absence"),
        ),
        ("Never substitute a different dataset", ("Never substitute",)),
        ("call find_users to resolve the name to a user ID", ("find_users",)),
        ("Do not pass the name as search", ("not search",)),
    ],
    "list_charts": [
        ("must be wrapped in a ``request`` object", ('{"request": {',)),
        ("Do NOT pass ``search``", ("Do NOT pass", "top-level")),
        ("call find_users to resolve the name to a user ID", ("find_users",)),
        ("Do not pass the name as search", ("not search",)),
    ],
    "list_dashboards": [
        ("must be wrapped in a ``request`` object", ('{"request": {',)),
        ("Do NOT pass ``search``", ("Do NOT pass", "top-level")),
        ("call find_users to resolve the name to a user ID", ("find_users",)),
        ("do NOT pass the name as the search parameter", ("not search",)),
    ],
    "get_chart_info": [
        ("Use numeric ID or UUID string (NOT chart name)", ("NOT chart name",)),
        ("To find a chart ID, use the list_charts tool first", ("list_charts",)),
        ("When form_data_key is provided", ("form_data_key", "unsaved")),
        ("so identifier is optional", ("permalink_key", "identifier optional")),
    ],
    "get_dashboard_info": [
        ("supply its permalink_key or filter_state", ("permalink_key", "filter_state")),
        ("Check native_filter_values_incomplete", ("native_filter_values_incomplete",)),
        (
            "Missing state is not evidence of no filters",
            ("Missing state", "no filters"),
        ),
        ("not automatically enforced query predicates", ("not query predicates",)),
        ("Respect filter scope", ("scope",)),
        ("do not guess columns", ("guess columns",)),
        ("query workspace-wide data", ("workspace-wide",)),
        ("Ask for clarification instead", ("clarify",)),
        ("To retrieve the complete list of charts", ("list_charts",)),
    ],
    "generate_dashboard": [
        ("Use this tool ONLY when creating a brand-new", ("NEW dashboards only",)),
        ("use add_chart_to_existing_dashboard", ("add_chart_to_existing_dashboard",)),
        ("Never use this tool as a fallback", ("Never use as a fallback",)),
        ("must exist and be accessible", ("exist", "accessible")),
        ("When ``position_json`` is supplied", ("position_json",)),
    ],
}


def _discovery_text(entry: dict[str, object], include_schemas: bool) -> str:
    """Everything a client sees for one tool in a search result."""
    if include_schemas:
        schema = entry["inputSchema"]
        assert isinstance(schema, dict)
        guidance = schema["properties"]["request"].get("description", "")
    else:
        guidance = entry.get("parameters_hint", "")
    return f"{entry.get('description', '')} {guidance}"


def test_docstring_constraint_audit_covers_touched_tools() -> None:
    """Every tool carrying request instructions is audited sentence by sentence."""
    assert set(DOCSTRING_CONSTRAINTS) == set(CONSTRAINTS)


@pytest.mark.asyncio
@pytest.mark.parametrize("name", DOCSTRING_CONSTRAINTS)
@pytest.mark.parametrize("include_schemas", [True, False])
async def test_docstring_constraints_survive_default_discovery(
    name: str, include_schemas: bool
) -> None:
    """Default compact and summary results keep each constraint the docstring states."""
    from superset.mcp_service.mcp_config import MCP_TOOL_SEARCH_CONFIG

    tool = await mcp.get_tool(name)
    assert tool is not None
    docstring = re.sub(r"\s+", " ", tool.description or "")
    config = {**MCP_TOOL_SEARCH_CONFIG, "include_schemas": include_schemas}
    entry = _create_search_result_serializer(config)([tool])[0]
    text = _discovery_text(entry, include_schemas)
    missing: list[tuple[str, str]] = []
    for sentence, phrases in DOCSTRING_CONSTRAINTS[name]:
        assert sentence in docstring, (name, sentence)
        missing.extend((sentence, phrase) for phrase in phrases if phrase not in text)
    assert not missing, (name, missing, text)
