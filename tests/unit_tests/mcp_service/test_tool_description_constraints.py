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

import inspect
import re

import pytest

from superset.mcp_service.app import mcp
from superset.mcp_service.mcp_config import MCP_TOOL_SEARCH_CONFIG
from superset.mcp_service.server import (
    _create_search_result_serializer,
    _request_instructions,
    _truncate_description,
)

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
    """Served tools/list carries bounded instructions, measured after middleware.

    The list_tools middleware inlines each request model, copying its docstring
    onto ``properties.request``. Only authored request-parameter instructions
    count toward the 300-character cap and the prose deduction.
    """
    for tool in await mcp.list_tools(run_middleware=True):
        schema = tool.to_mcp_tool().inputSchema
        served = schema.get("properties", {}).get("request", {})
        instructions = _request_instructions(tool)
        assert len(instructions) <= 300, tool.name
        if instructions:
            assert served["description"] == instructions, tool.name
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
    tool = await mcp.get_tool(name)
    assert tool is not None
    docstring = re.sub(r"\s+", " ", tool.description or "").strip()
    purpose = re.match(r".+?[.!?](?=\s|$)", docstring)
    assert purpose is not None, name
    config = {**MCP_TOOL_SEARCH_CONFIG, "include_schemas": include_schemas}
    entry = _create_search_result_serializer(config)([tool])[0]
    assert entry["description"].startswith(purpose.group(0)), (name, entry)


DIRECT_CATALOG_CONSTRAINTS = {
    "generate_chart": (
        "save_chart=True saves",
        "MUST display chart URL",
        "numeric ID/UUID",
        "NOT schema.table_name",
        "config.chart_type required",
        "line/bar/area/scatter are xy kind values",
        "get_chart_type_schema",
    ),
    "create_virtual_dataset": (
        "SQL and a dataset name",
        "returned id as dataset_id",
        "generate_chart or generate_explore_link",
        "columns from returned columns",
    ),
    "update_chart": (
        "generate_preview=True previews; False persists immediately",
        "MUST display explore URL",
        "ID/UUID, NOT chart name",
        "Omit config to rename only",
        "add_columns appends table columns",
    ),
    "update_chart_preview": (
        "Cached preview only, not saved",
        "form_data_key is invalidated",
        "use the returned key",
        "MUST display explore_url",
        "config + dataset_id and omit form_data_key",
    ),
}


@pytest.mark.asyncio
@pytest.mark.parametrize("name", DIRECT_CATALOG_CONSTRAINTS)
@pytest.mark.parametrize("strategy", ["bm25", "regex"])
@pytest.mark.parametrize("include_schemas", [True, False])
async def test_direct_no_query_catalog_preserves_priority_guidance(
    name: str, strategy: str, include_schemas: bool
) -> None:
    """Reporter cases use real registrations and no-query search, without writes."""
    from unittest.mock import AsyncMock, MagicMock, patch

    from superset.mcp_service.server import _apply_tool_search_transform
    from superset.utils import json

    server = MagicMock()
    _apply_tool_search_transform(
        server,
        {
            **MCP_TOOL_SEARCH_CONFIG,
            "strategy": strategy,
            "include_schemas": include_schemas,
        },
    )
    transform = server.add_transform.call_args.args[0]
    tools = await mcp.list_tools(run_middleware=False)
    # Only discovery of visible tools is substituted; rendering and serialization
    # run as in a direct MCP call, with no query and the default 300-char budget.
    with patch.object(transform, "_get_visible_tools", AsyncMock(return_value=tools)):
        result = await transform._make_search_tool().fn()
    catalog = json.loads(result) if isinstance(result, str) else result
    assert len(catalog) == len(tools)
    entry = next(item for item in catalog if item["name"] == name)
    tool = next(item for item in tools if item.name == name)
    instructions = tool.parameters["properties"]["request"]["description"]
    text = _discovery_text(entry, include_schemas)
    assert 'Wrap as {"request": {...}}.' in text
    assert all(phrase in text for phrase in DIRECT_CATALOG_CONSTRAINTS[name]), text
    assert len(entry["description"]) + len(instructions) <= 300
    # A purpose paragraph survives; any subsequent paragraphs are whole, never
    # an incomplete bullet or the misleading numbered-list fragment "Workflow: 1."
    description = inspect.cleandoc(tool.description or "")
    paragraphs = re.split(r"\n\s*\n", description)
    assert entry["description"].startswith(paragraphs[0])
    assert entry["description"] in [
        description[: match.start()].strip()
        for match in re.finditer(r"\n\s*\n", description)
    ]


@pytest.mark.asyncio
@pytest.mark.parametrize("name", DIRECT_CATALOG_CONSTRAINTS)
async def test_direct_catalog_oversized_prose_keeps_bounded_guidance(name: str) -> None:
    """Priority rules are not displaced by an arbitrarily long introduction."""
    tool = await mcp.get_tool(name)
    assert tool is not None
    oversized = tool.model_copy(update={"description": "Long prose. " * 10_000})
    entry = _create_search_result_serializer({"include_schemas": True})([oversized])[0]
    instructions = entry["inputSchema"]["properties"]["request"]["description"]
    assert all(phrase in instructions for phrase in DIRECT_CATALOG_CONSTRAINTS[name])
    assert len(entry["description"]) + len(instructions) <= 300


@pytest.mark.asyncio
@pytest.mark.parametrize("name", DIRECT_CATALOG_CONSTRAINTS)
async def test_reported_descriptions_truncate_at_whole_paragraphs(name: str) -> None:
    """The reported 300-char cut cannot leave a partial IMPORTANT block or step 1."""
    tool = await mcp.get_tool(name)
    assert tool is not None
    description = inspect.cleandoc(tool.description or "")
    result = _truncate_description(tool.description or "", 300)
    assert result
    assert len(result) <= 300
    assert result in [
        description[: match.start()].strip()
        for match in re.finditer(r"\n\s*\n", description)
    ]


TOOLS_WITH_REQUEST_INSTRUCTIONS = {*CONSTRAINTS, *DIRECT_CATALOG_CONSTRAINTS}


@pytest.mark.asyncio
@pytest.mark.parametrize("include_schemas", [True, False])
async def test_served_discovery_keeps_untouched_tool_descriptions(
    include_schemas: bool,
) -> None:
    """Inlined request-model docstrings never shrink other tools' served prose."""
    tools = await mcp.list_tools(run_middleware=True)
    config = {**MCP_TOOL_SEARCH_CONFIG, "include_schemas": include_schemas}
    max_desc = config.get("max_description_length", 300)
    entries = _create_search_result_serializer(config)(tools)
    assert {tool.name for tool in tools} >= TOOLS_WITH_REQUEST_INSTRUCTIONS
    for tool, entry in zip(tools, entries, strict=True):
        assert entry["description"], tool.name
        assert len(entry["description"]) <= max_desc, tool.name
        if tool.name in TOOLS_WITH_REQUEST_INSTRUCTIONS:
            continue
        assert _request_instructions(tool) == "", tool.name
        assert entry["description"] == _truncate_description(
            tool.description or "", max_desc
        ), tool.name
        if not include_schemas and (hint := entry.get("parameters_hint")):
            properties = tool.to_mcp_tool().inputSchema.get("properties", {})
            assert hint == ", ".join(properties), tool.name


# Tools whose served description was empty or lost a calling rule when the
# request-model docstring was deducted, or when the next paragraph was dropped.
UNTOUCHED_DESCRIPTION_PHRASES = {
    "manage_dashboard_owners": "Owners can edit the dashboard",
    "manage_dashboard_roles": "Dashboard access roles restrict who can view",
    "get_chart_preview": "Returns preview URL or formatted content",
    "get_chart_data": "Returns the actual data behind a chart",
    "generate_bug_report": "Generate a copy-pasteable bug report",
    "manage_dashboard_certification": "Set or clear a dashboard's certification",
    "update_dashboard": "Patch an existing dashboard's layout",
    "get_chart_sql": "Returns the SQL that a chart would execute",
    "find_users": "Resolve a person's name to user IDs",
    "delete_chart": "Identify the chart by numeric ID or UUID string (NOT chart name)",
}


@pytest.mark.asyncio
@pytest.mark.parametrize("name", UNTOUCHED_DESCRIPTION_PHRASES)
@pytest.mark.parametrize("include_schemas", [True, False])
async def test_served_discovery_regressions_keep_prose(
    name: str, include_schemas: bool
) -> None:
    """Reported tools keep their default-limit prose in served search results."""
    tools = await mcp.list_tools(run_middleware=True)
    tool = next(item for item in tools if item.name == name)
    config = {**MCP_TOOL_SEARCH_CONFIG, "include_schemas": include_schemas}
    entry = _create_search_result_serializer(config)([tool])[0]
    assert UNTOUCHED_DESCRIPTION_PHRASES[name] in re.sub(
        r"\s+", " ", entry["description"]
    ), (name, entry["description"])


@pytest.mark.asyncio
async def test_dashboard_datasets_served_request_describes_lookup_and_caps() -> None:
    """Served request metadata describes lookup and preserves cap constraints."""
    tools = await mcp.list_tools(run_middleware=True)
    tool = next(item for item in tools if item.name == "get_dashboard_datasets")
    request = tool.to_mcp_tool().inputSchema["properties"]["request"]
    assert request["description"] == "Dashboard lookup plus per-dataset detail caps."
    assert request["required"] == ["identifier"]
    for field, maximum in (("max_columns", 100), ("max_metrics", 50)):
        cap = request["properties"][field]
        assert cap["minimum"] == 0
        assert cap["maximum"] == maximum
        assert cap["default"] == maximum
