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
    "list_datasets": (
        "Do NOT pass",
        "search/page/filters",
        "top-level",
        "out-of-scope",
        '{"request": {',
    ),
    "get_chart_info": (
        "NOT chart name",
        "form_data_key",
        "permalink_key",
        '{"request": {',
    ),
    "get_dashboard_info": (
        "filter_state",
        "permalink_key",
        "snapshots, not query predicates",
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
        schema_text = _schema_text(entry["inputSchema"])
        for _, phrases in SCHEMA_DOCSTRING_CONSTRAINTS[name]:
            assert all(phrase in schema_text for phrase in phrases), (name, phrases)
    else:
        guidance = str(entry.get("parameters_hint", ""))
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
        schema_text = _schema_text(entry["inputSchema"])
        for _, phrases in SCHEMA_DOCSTRING_CONSTRAINTS[name]:
            assert all(phrase in schema_text for phrase in phrases), (name, phrases)
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
SUMMARY_DOCSTRING_CONSTRAINTS: dict[str, list[tuple[str, tuple[str, ...]]]] = {
    "list_datasets": [
        ("must be wrapped in a ``request`` object", ('{"request": {',)),
        ("Do NOT pass ``search``, ``page``", ("Do NOT pass", "page", "top-level")),
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
        (
            "Never substitute a different dataset for one outside the MCP scope",
            ("Never substitute", "out-of-scope"),
        ),
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
        (
            "snapshot values, not automatically enforced query predicates",
            ("snapshot", "not query predicates"),
        ),
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


# Field-level details are available in compact discovery's full inputSchema,
# not in schema-free summary mode. Audit both without expanding the prose budget.
SCHEMA_DOCSTRING_CONSTRAINTS: dict[str, list[tuple[str, tuple[str, ...]]]] = {
    "list_datasets": [
        (
            "Search matches schema, SQL, table name, and description as "
            "case-insensitive substrings",
            ("Case-insensitive substring search of schema, SQL, table name",),
        ),
        (
            "A complete UUID passed as ``search`` is treated as an exact UUID",
            ("A complete UUID is an exact UUID lookup", "uuid filter"),
        ),
        (
            "Compare descriptions and metadata",
            ("Compare candidate descriptions and metadata",),
        ),
        (
            "Sortable columns for ``order_column``",
            ("Sortable columns: id, table_name, schema, changed_on, created_on",),
        ),
        (
            "``changed_on_delta_humanized`` (alias for ``changed_on``)",
            ("changed_on_delta_humanized is an alias for changed_on",),
        ),
        (
            "Set ``request.certified`` to true",
            (
                "true to return only certified datasets",
                "false to return only uncertified",
                "omit to return both",
            ),
        ),
        (
            "Valid filter columns for ``filters[].col``",
            (
                "uuid",
                "table_name",
                "schema",
                "database_name",
                "created_by_fk",
                "changed_by_fk",
            ),
        ),
        (
            'filters=[{"col": "created_by_fk", "opr": "eq", "value": <id>}]',
            ("created_by_fk or changed_by_fk with that integer ID",),
        ),
    ],
    "list_dashboards": [
        (
            "Sortable columns for ``order_column``",
            (
                "Sortable columns: id, dashboard_title, slug, published, "
                "changed_on, created_on",
            ),
        ),
        (
            "``changed_on_delta_humanized`` (alias for ``changed_on``)",
            ("changed_on_delta_humanized is an alias for changed_on",),
        ),
        (
            "search matches titles and slugs only",
            ("Search matches titles and slugs only",),
        ),
        (
            "Use select_columns to request additional fields",
            (
                "select_columns",
                "List of columns to select",
            ),
        ),
        (
            "Valid filter columns for ``filters[].col``",
            (
                "dashboard_title",
                "published",
                "editor",
                "favorite",
                "created_by_fk",
                "changed_by_fk",
            ),
        ),
        (
            'filters=[{"col": "created_by_fk", "opr": "eq", "value": <id>}]',
            ("created_by_fk or changed_by_fk with that integer ID",),
        ),
    ],
    "list_charts": [
        (
            "Sortable columns for ``order_column``",
            (
                "Sortable columns: id, slice_name, viz_type, description, "
                "changed_on, created_on",
            ),
        ),
        (
            "``changed_on_delta_humanized`` (alias for ``changed_on``)",
            ("changed_on_delta_humanized is an alias for changed_on",),
        ),
        (
            "Set ``request.certified`` to true",
            (
                "true to return only certified charts",
                "false to return only uncertified",
                "omit to return both",
            ),
        ),
        (
            "Valid filter columns for ``filters[].col``",
            (
                "slice_name",
                "viz_type",
                "datasource_name",
                "editor",
                "created_by_fk",
                "changed_by_fk",
                "dashboards",
            ),
        ),
        (
            'filters=[{"col": "created_by_fk", "opr": "eq", "value": <id>}]',
            ("created_by_fk or changed_by_fk with that integer ID",),
        ),
    ],
    "get_dashboard_info": [
        (
            "use the returned filter_state as context",
            ("Use returned filter_state as context",),
        ),
        (
            "Restricted users receive native_filter_values",
            (
                "native_filter_values (names, types, values, labels, exclusion flags)",
                "not raw dataMask/column targets",
            ),
        ),
        (
            "unsupported filters and chart state cannot be summarized safely",
            (
                "native_filter_values_incomplete flags unsupported filters/chart state",
                "cannot be summarized safely",
            ),
        ),
        (
            "lists may be capped below their true size",
            ("Charts/native_filters may be capped", "chart_count", "_truncation_notes"),
        ),
        (
            "To retrieve the complete list of charts",
            (
                'list_charts with request={"filters": [{"col": "dashboards", '
                '"opr": "eq", "value": <dashboard id>}]}',
                "paginate with page/page_size",
            ),
        ),
        (
            "pass the URL or bare key as ``identifier``",
            (
                "bare permalink key",
                "shared URL",
                "/superset/dashboard/p/<key>/",
                "identifier",
            ),
        ),
        (
            "or use ``permalink_key`` alone",
            ("no identifier is required",),
        ),
    ],
    "get_chart_info": [
        (
            "URL field links to the chart's explore page",
            ("url field links to the chart's Explore page",),
        ),
        ("form_data_key from Explore URL", ("Cache key from the Explore URL",)),
        (
            "With an Explore permalink (key or full URL)",
            ("full permalink URL", "/explore/p/<key>/"),
        ),
        (
            "When dashboard_id is provided",
            (
                "dashboard_id",
                "column, operator, and value under filters.dashboard_filters",
                "scope for this chart",
            ),
        ),
    ],
    "generate_dashboard": [
        ("auto-generated 2-column grid", ("auto-generated 2-column grid",)),
        ("MARKDOWN/HEADER components", ("MARKDOWN", "HEADER components")),
        (
            "``parents`` is recomputed from its ``children`` edges",
            (
                "parents is recomputed from its children edges",
                "omitted or incomplete parents arrays are fine",
            ),
        ),
    ],
}

DOCSTRING_CONSTRAINTS = {
    name: constraints + SCHEMA_DOCSTRING_CONSTRAINTS[name]
    for name, constraints in SUMMARY_DOCSTRING_CONSTRAINTS.items()
}


def _schema_text(value: object) -> str:
    """Collect schema text, including referenced definitions, without JSON escaping."""
    if isinstance(value, dict):
        return " ".join(f"{key} {_schema_text(item)}" for key, item in value.items())
    if isinstance(value, list):
        return " ".join(_schema_text(item) for item in value)
    return str(value)


def _discovery_text(entry: dict[str, object], include_schemas: bool) -> str:
    """Everything a client sees for one tool in a search result."""
    if include_schemas:
        schema = entry["inputSchema"]
        assert isinstance(schema, dict)
        guidance = _schema_text(schema)
    else:
        guidance = str(entry.get("parameters_hint", ""))
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
    constraints = (
        DOCSTRING_CONSTRAINTS[name]
        if include_schemas
        else SUMMARY_DOCSTRING_CONSTRAINTS[name]
    )
    for sentence, phrases in constraints:
        assert sentence in docstring, (name, sentence)
        missing.extend((sentence, phrase) for phrase in phrases if phrase not in text)
    assert not missing, (name, missing, text)


@pytest.mark.asyncio
@pytest.mark.parametrize("name", CONSTRAINTS)
@pytest.mark.parametrize("include_schemas", [True, False])
async def test_default_discovery_keeps_purpose_line(
    name: str, include_schemas: bool
) -> None:
    """Request guidance must leave room for the docstring's first purpose sentence."""
    from superset.mcp_service.mcp_config import MCP_TOOL_SEARCH_CONFIG

    tool = await mcp.get_tool(name)
    assert tool is not None
    docstring = re.sub(r"\s+", " ", tool.description or "").strip()
    purpose = re.match(r".+?[.!?](?=\s|$)", docstring)
    assert purpose is not None, name
    config = {**MCP_TOOL_SEARCH_CONFIG, "include_schemas": include_schemas}
    entry = _create_search_result_serializer(config)([tool])[0]
    assert entry["description"].startswith(purpose.group(0)), (name, entry)
