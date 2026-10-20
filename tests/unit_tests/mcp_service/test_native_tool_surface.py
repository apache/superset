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

"""Contract tests for the native named-tool surface and its compatibility mode.

The MCP service can serve its catalog in two shapes, both built from the same
registered tool definitions and the same middleware stack:

* native: ``tools/list`` advertises every permitted tool under its real name
  and ``tools/call`` invokes it directly (``MCP_TOOL_SEARCH_CONFIG`` with
  ``enabled=False``);
* compatibility (the default): ``tools/list`` advertises pinned tools plus the
  synthetic ``search_tools``/``call_tool`` pair, and other tools are discovered
  through search and invoked through the ``call_tool`` proxy.

Every registered tool stays callable under its real name in both shapes. These
tests assemble each shape the way ``run_server`` does, from
``build_middleware_list`` and ``_apply_tool_search_transform``, and check that
both expose the same tools, schemas, results, errors, and authorization
decisions.

``native_tool_inventory.json`` records the measured native catalog: each
tool's annotations, description length (full and compact), schema sizes, and
complete ``tools/list`` entry size with structured output disabled and
enabled, plus catalog totals for the default and the opt-in compact listing
(``MCP_NATIVE_TOOL_LIST_CONFIG`` with ``compact=True``). Sizes may shrink
freely but must not grow beyond a small headroom. To accept an intentional
change, regenerate the report with::

    SUPERSET_MCP_UPDATE_TOOL_INVENTORY=1 pytest \\
        tests/unit_tests/mcp_service/test_native_tool_surface.py
"""

import inspect
import math
import os
from collections import Counter
from collections.abc import Iterator
from contextlib import contextmanager
from pathlib import Path
from typing import Any
from unittest.mock import MagicMock, patch

import mcp.types as mt
import pytest
from fastmcp import Client, FastMCP
from fastmcp.client.client import CallToolResult
from fastmcp.tools.tool import Tool
from fastmcp.utilities.json_schema import dereference_refs
from jsonschema import Draft202012Validator

from superset.mcp_service.app import ALLOWED_UNPROTECTED, mcp
from superset.mcp_service.chart.schemas import CHART_TYPE_VALUES
from superset.mcp_service.chart.tool.get_chart_type_schema import VALID_CHART_TYPES
from superset.mcp_service.mcp_config import (
    MCP_NATIVE_TOOL_LIST_CONFIG,
    MCP_TOOL_SEARCH_CONFIG,
)
from superset.mcp_service.server import (
    _apply_compact_tool_list_transform,
    _apply_tool_search_transform,
    _truncate_description,
    build_middleware_list,
)
from superset.utils import json

INVENTORY_PATH = Path(__file__).with_name("native_tool_inventory.json")
UPDATE_INVENTORY_ENV = "SUPERSET_MCP_UPDATE_TOOL_INVENTORY"

SEARCH_TOOL = MCP_TOOL_SEARCH_CONFIG["search_tool_name"]
CALL_TOOL = MCP_TOOL_SEARCH_CONFIG["call_tool_name"]
PINNED_TOOLS = set(MCP_TOOL_SEARCH_CONFIG["always_visible"])

# The opt-in compact listing, at its configured default description budget.
COMPACT_CONFIG = {**MCP_NATIVE_TOOL_LIST_CONFIG, "compact": True}
COMPACT_MAX_DESCRIPTION = COMPACT_CONFIG["max_description_length"]

# Output modes of MCP_STRUCTURED_OUTPUT_ENABLED, keyed as in the inventory.
OUTPUT_MODES = {"text_only": False, "structured": True}

# MCP gateways cap a single list page at 100 KB; see test_tool_inventory.py.
GATEWAY_PAGE_BYTE_LIMIT = 100_000

# The registry-derived chart_type enum grows with every registered chart type,
# so it is excluded from size budgets as in test_tool_inventory.py.
CHART_TYPE_ENUM = json.dumps(
    CHART_TYPE_VALUES, ensure_ascii=False, separators=(",", ":")
)

ANNOTATION_KEYS = ("readOnlyHint", "destructiveHint", "idempotentHint", "openWorldHint")


def compact_bytes(value: Any) -> int:
    """Measure compact UTF-8 JSON, excluding the chart_type enum."""
    text = json.dumps(value, ensure_ascii=False, separators=(",", ":"))
    enum_bytes = len(CHART_TYPE_ENUM.encode("utf-8")) * text.count(CHART_TYPE_ENUM)
    return len(text.encode("utf-8")) - enum_bytes


def size_budget(recorded: int) -> int:
    """Allow incidental growth above a recorded size: 2%, at least 200 bytes."""
    return recorded + max(200, math.ceil(recorded * 0.02))


def wire_entry(tool: mt.Tool) -> dict[str, Any]:
    """Return a tool definition exactly as serialized in ``tools/list``."""
    return tool.model_dump(by_alias=True, mode="json", exclude_none=True)


async def canonical_tools() -> list[Tool]:
    """Return the registered tool definitions, without request middleware."""
    return list(await mcp.list_tools(run_middleware=False))


async def build_server(
    *,
    structured_output_enabled: bool,
    compatibility: bool,
    compact: bool = False,
    max_description_length: int = COMPACT_MAX_DESCRIPTION,
    search_config: dict[str, Any] | None = None,
) -> FastMCP:
    """Assemble a server from the registered tools as ``run_server`` does."""
    server = FastMCP(
        "superset-mcp-surface-test",
        middleware=build_middleware_list(
            structured_output_enabled=structured_output_enabled
        ),
    )
    for tool in await canonical_tools():
        server.add_tool(tool)
    if compatibility:
        _apply_tool_search_transform(
            server, dict(search_config or MCP_TOOL_SEARCH_CONFIG)
        )
    else:
        native_config = COMPACT_CONFIG if compact else MCP_NATIVE_TOOL_LIST_CONFIG
        _apply_compact_tool_list_transform(
            server, {**native_config, "max_description_length": max_description_length}
        )
    return server


async def list_native(
    structured_output_enabled: bool,
    *,
    compact: bool = False,
    max_description_length: int = COMPACT_MAX_DESCRIPTION,
) -> mt.ListToolsResult:
    """List the native catalog over the MCP protocol."""
    server = await build_server(
        structured_output_enabled=structured_output_enabled,
        compatibility=False,
        compact=compact,
        max_description_length=max_description_length,
    )
    async with Client(server) as client:
        return await client.list_tools_mcp()


def unresolved_refs(schema: dict[str, Any]) -> set[str]:
    """Return local ``$ref`` targets that do not resolve inside ``schema``."""
    missing: set[str] = set()

    def resolves(ref: str) -> bool:
        node: Any = schema
        for part in ref.removeprefix("#/").split("/"):
            part = part.replace("~1", "/").replace("~0", "~")
            if not isinstance(node, dict) or part not in node:
                return False
            node = node[part]
        return True

    def walk(node: Any) -> None:
        if isinstance(node, dict):
            ref = node.get("$ref")
            if isinstance(ref, str) and (not ref.startswith("#") or not resolves(ref)):
                missing.add(ref)
            for value in node.values():
                walk(value)
        elif isinstance(node, list):
            for value in node:
                walk(value)

    walk(schema)
    return missing


async def measure_inventory() -> dict[str, Any]:
    """Measure the native catalog in both structured-output modes."""
    listings = {
        mode: await list_native(enabled) for mode, enabled in OUTPUT_MODES.items()
    }
    compact_listings = {
        mode: await list_native(enabled, compact=True)
        for mode, enabled in OUTPUT_MODES.items()
    }
    structured = {tool.name: tool for tool in listings["structured"].tools}
    compact = {tool.name: tool for tool in compact_listings["text_only"].tools}
    tools: dict[str, Any] = {}
    for tool in listings["text_only"].tools:
        annotations = tool.annotations.model_dump() if tool.annotations else {}
        output_schema = structured[tool.name].outputSchema
        tools[tool.name] = {
            "annotations": {key: annotations.get(key) for key in ANNOTATION_KEYS},
            "description_chars": len(tool.description or ""),
            "compact_description_chars": len(compact[tool.name].description or ""),
            "input_schema_bytes": compact_bytes(tool.inputSchema),
            "output_schema_bytes": compact_bytes(output_schema) if output_schema else 0,
            "entry_bytes": {
                "text_only": compact_bytes(wire_entry(tool)),
                "structured": compact_bytes(wire_entry(structured[tool.name])),
            },
        }
    totals: dict[str, Any] = {"tool_count": len(tools), "catalog_bytes": {}}
    totals["compact_catalog_bytes"] = {
        mode: compact_bytes([wire_entry(tool) for tool in listing.tools])
        for mode, listing in compact_listings.items()
    }
    totals["largest_entry"] = {}
    for mode, listing in listings.items():
        entries = {tool.name: wire_entry(tool) for tool in listing.tools}
        totals["catalog_bytes"][mode] = compact_bytes(list(entries.values()))
        name = max(entries, key=lambda key: compact_bytes(entries[key]))
        totals["largest_entry"][mode] = {
            "name": name,
            "bytes": compact_bytes(entries[name]),
        }
    return {"tools": dict(sorted(tools.items())), "totals": totals}


@pytest.mark.asyncio
async def test_native_inventory_report_matches_registered_tools() -> None:
    """The recorded report covers every tool and bounds every measured size."""
    measured = await measure_inventory()
    if os.environ.get(UPDATE_INVENTORY_ENV):
        INVENTORY_PATH.write_text(json.dumps(measured, indent=2, sort_keys=True) + "\n")
    recorded = json.loads(INVENTORY_PATH.read_text())

    assert set(measured["tools"]) == set(recorded["tools"])
    assert measured["totals"]["tool_count"] == recorded["totals"]["tool_count"]

    grown: dict[str, tuple[int, int]] = {}
    for name, entry in measured["tools"].items():
        expected = recorded["tools"][name]
        assert entry["annotations"] == expected["annotations"], name
        for key in (
            "description_chars",
            "compact_description_chars",
            "input_schema_bytes",
            "output_schema_bytes",
        ):
            if entry[key] > size_budget(expected[key]):
                grown[f"{name}.{key}"] = (entry[key], expected[key])
        for mode in OUTPUT_MODES:
            actual = entry["entry_bytes"][mode]
            if actual > size_budget(expected["entry_bytes"][mode]):
                grown[f"{name}.entry_bytes.{mode}"] = (
                    actual,
                    expected["entry_bytes"][mode],
                )
    for mode in OUTPUT_MODES:
        for total in ("catalog_bytes", "compact_catalog_bytes"):
            actual = measured["totals"][total][mode]
            expected_total = recorded["totals"][total][mode]
            if actual > size_budget(expected_total):
                grown[f"{total}.{mode}"] = (actual, expected_total)
    assert not grown, (
        f"Native tool definitions grew beyond the recorded inventory; review the "
        f"growth and rerun with {UPDATE_INVENTORY_ENV}=1: {grown}"
    )


@pytest.mark.asyncio
@pytest.mark.parametrize("mode", OUTPUT_MODES)
async def test_largest_native_entry_fits_one_gateway_page(mode: str) -> None:
    """Any single tool definition fits a gateway list page on its own."""
    listing = await list_native(OUTPUT_MODES[mode])
    sizes = {tool.name: compact_bytes(wire_entry(tool)) for tool in listing.tools}
    largest = max(sizes, key=sizes.__getitem__)
    assert sizes[largest] <= GATEWAY_PAGE_BYTE_LIMIT, (largest, sizes[largest])


@pytest.mark.asyncio
@pytest.mark.parametrize("mode", OUTPUT_MODES)
async def test_compatibility_listing_fits_one_gateway_page(mode: str) -> None:
    """The default compatibility ``tools/list`` is one page under the gateway cap."""
    server = await build_server(
        structured_output_enabled=OUTPUT_MODES[mode], compatibility=True
    )
    async with Client(server) as client:
        listing = await client.list_tools_mcp()
    assert listing.nextCursor is None
    page_bytes = compact_bytes([wire_entry(tool) for tool in listing.tools])
    assert page_bytes <= GATEWAY_PAGE_BYTE_LIMIT, page_bytes


@pytest.mark.asyncio
@pytest.mark.parametrize("mode", OUTPUT_MODES)
async def test_native_list_exposes_every_registered_tool_by_name(mode: str) -> None:
    """Native discovery advertises the canonical definitions.

    FastMCP inlines ``$ref`` definitions on the wire (``dereference_schemas``
    is enabled by default and not overridden by the service), so listed schemas
    equal the dereferenced canonical schemas. Calls still validate against the
    canonical schemas.
    """
    structured_output_enabled = OUTPUT_MODES[mode]
    registered = {tool.name: tool for tool in await canonical_tools()}
    first = await list_native(structured_output_enabled)
    second = await list_native(structured_output_enabled)

    # One deterministic page: tools/list is not paginated by the service.
    assert first.nextCursor is None
    assert [tool.name for tool in first.tools] == [tool.name for tool in second.tools]
    names = [tool.name for tool in first.tools]
    assert len(names) == len(set(names))
    assert set(names) == set(registered)
    assert not {SEARCH_TOOL, CALL_TOOL} & set(names)

    for listed in first.tools:
        expected = registered[listed.name].to_mcp_tool()
        assert listed.description == expected.description
        assert listed.inputSchema == dereference_refs(expected.inputSchema)
        assert listed.annotations == expected.annotations
        if structured_output_enabled:
            assert expected.outputSchema is not None, listed.name
            assert listed.outputSchema == dereference_refs(expected.outputSchema)
        else:
            assert listed.outputSchema is None, listed.name


@pytest.mark.asyncio
async def test_native_schemas_are_valid_and_self_contained() -> None:
    """Every advertised schema is valid JSON Schema with resolvable references."""
    listing = await list_native(structured_output_enabled=True)
    invalid: dict[str, Any] = {}
    for tool in listing.tools:
        for kind, schema in (
            ("input", tool.inputSchema),
            ("output", tool.outputSchema),
        ):
            assert schema is not None, (tool.name, kind)
            Draft202012Validator.check_schema(schema)
            if missing := unresolved_refs(schema):
                invalid[f"{tool.name}.{kind}"] = sorted(missing)
    assert not invalid, f"Schemas reference missing definitions: {invalid}"


@pytest.mark.asyncio
async def test_compatibility_mode_lists_search_interface_and_keeps_names() -> None:
    """Compatibility mode lists the search interface; real names stay callable."""
    server = await build_server(structured_output_enabled=False, compatibility=True)
    registered = {tool.name for tool in await canonical_tools()}
    async with Client(server) as client:
        listed = {tool.name for tool in await client.list_tools()}
        assert listed == PINNED_TOOLS | {SEARCH_TOOL, CALL_TOOL}
        for name in sorted(registered - PINNED_TOOLS):
            # Each non-pinned tool resolves under its real name for direct calls.
            assert await server.get_tool(name) is not None, name


@pytest.mark.asyncio
async def test_native_mode_does_not_serve_compatibility_tools() -> None:
    """Clients that only know search_tools need compatibility mode enabled."""
    server = await build_server(structured_output_enabled=False, compatibility=False)
    async with Client(server) as client:
        for name in (SEARCH_TOOL, CALL_TOOL):
            result = await client.call_tool(name, {}, raise_on_error=False)
            assert result.is_error is True, name


def comparable(result: CallToolResult) -> tuple[Any, ...]:
    """Drop per-call metadata (the call id) from a tool result."""
    return (
        result.is_error,
        [block.model_dump() for block in result.content],
        result.structured_content,
    )


async def call_three_ways(
    native: FastMCP, compatibility: FastMCP, name: str, arguments: dict[str, Any]
) -> dict[str, CallToolResult]:
    """Call a tool natively, directly in compatibility mode, and via call_tool."""
    results: dict[str, CallToolResult] = {}
    async with Client(native) as client:
        results["native"] = await client.call_tool(
            name, arguments, raise_on_error=False
        )
    async with Client(compatibility) as client:
        results["compatibility_direct"] = await client.call_tool(
            name, arguments, raise_on_error=False
        )
        results["compatibility_proxy"] = await client.call_tool(
            CALL_TOOL, {"name": name, "arguments": arguments}, raise_on_error=False
        )
    return results


@pytest.mark.asyncio
@pytest.mark.usefixtures("unprivileged_user")
@pytest.mark.parametrize("mode", OUTPUT_MODES)
async def test_successful_call_is_identical_on_every_path(mode: str) -> None:
    """A successful result has the same content on every path and output mode."""
    structured_output_enabled = OUTPUT_MODES[mode]
    native = await build_server(
        structured_output_enabled=structured_output_enabled, compatibility=False
    )
    compatibility = await build_server(
        structured_output_enabled=structured_output_enabled, compatibility=True
    )
    results = await call_three_ways(
        native,
        compatibility,
        "get_chart_type_schema",
        {"chart_type": "table", "include_examples": False},
    )
    expected = comparable(results["native"])
    assert expected[0] is False
    for path, result in results.items():
        assert comparable(result) == expected, path
        assert result.meta, path
        assert "mcp_call_id" in result.meta, path

    native_result = results["native"]
    text = native_result.content[0]
    assert isinstance(text, mt.TextContent)
    if structured_output_enabled:
        listing = await list_native(structured_output_enabled=True)
        schema = next(
            tool.outputSchema
            for tool in listing.tools
            if tool.name == "get_chart_type_schema"
        )
        assert schema is not None
        Draft202012Validator(schema).validate(native_result.structured_content)
        assert json.loads(text.text) == native_result.structured_content
    else:
        assert native_result.structured_content is None
        assert json.loads(text.text)["chart_type"] == "table"


@pytest.fixture
def unprivileged_user() -> Iterator[MagicMock]:
    """Resolve every request to one authenticated, unprivileged user."""
    user = MagicMock()
    user.username = "surface_test_user"
    user.id = 999
    user.is_active = True
    user.roles = []
    user.groups = []
    with (
        patch("superset.mcp_service.auth.get_user_from_request", return_value=user),
        patch(
            "superset.mcp_service.middleware.get_user_from_request", return_value=user
        ),
        # The audit log references the user id, which has no metadata row.
        patch("superset.mcp_service.middleware.event_logger"),
    ):
        yield user


@pytest.fixture
def rbac_enabled(app: Any) -> Iterator[Any]:
    """Re-enable the RBAC gate that conftest.py disables for this package."""
    app.config["MCP_RBAC_ENABLED"] = True
    yield app
    app.config["MCP_RBAC_ENABLED"] = False


@pytest.fixture
def restricted_policy(app: Any) -> Iterator[dict[str, frozenset[str]]]:
    """Install a mutable restricted-principal allow-list policy."""
    state = {"allowed": frozenset({"health_check"})}
    app.config["MCP_RESTRICTED_TOOL_POLICY"] = lambda _user: state["allowed"]
    yield state
    app.config.pop("MCP_RESTRICTED_TOOL_POLICY", None)


def read_only_access(permission: str, _view: str) -> bool:
    """Grant only read permissions."""
    return permission in {"can_read", "can_get"}


async def search_all(client: Client[Any]) -> set[str]:
    """Return every tool name search_tools returns without a query."""
    found = await client.call_tool(SEARCH_TOOL, {})
    assert found.is_error is False
    if not found.content:  # An empty result list serializes to no content.
        return set()
    text = found.content[0]
    assert isinstance(text, mt.TextContent)
    return {entry["name"] for entry in json.loads(text.text)}


async def visible_tools(native: FastMCP, compatibility: FastMCP) -> dict[str, set[str]]:
    """Return the tools a caller can discover natively and through search."""
    async with Client(native) as client:
        native_names = {tool.name for tool in await client.list_tools()}
    async with Client(compatibility) as client:
        listed = {tool.name for tool in await client.list_tools()}
        searched = await search_all(client)
    return {
        "native": native_names,
        "compatibility": (listed - {SEARCH_TOOL, CALL_TOOL}) | searched,
    }


async def build_both() -> tuple[FastMCP, FastMCP]:
    return (
        await build_server(structured_output_enabled=False, compatibility=False),
        await build_server(structured_output_enabled=False, compatibility=True),
    )


THEME_REQUEST = {"request": {"theme_name": "Surface", "json_data": {"token": {}}}}


def assert_denied_everywhere(results: dict[str, CallToolResult], marker: str) -> None:
    """Every path rejects the call with the same error result."""
    expected = comparable(results["native"])
    assert expected[0] is True
    for path, result in results.items():
        assert comparable(result) == expected, path
    text = results["native"].content[0]
    assert isinstance(text, mt.TextContent)
    assert marker in text.text


@pytest.mark.asyncio
@pytest.mark.usefixtures("unprivileged_user", "rbac_enabled")
async def test_rbac_filters_discovery_and_calls_identically() -> None:
    """A read-only caller sees and may call the same tools on every path."""
    security_manager = MagicMock()
    security_manager.can_access.side_effect = read_only_access
    with (
        patch("superset.mcp_service.auth.security_manager", security_manager),
        patch(
            "superset.mcp_service.privacy.user_can_view_data_model_metadata",
            return_value=False,
        ),
    ):
        native, compatibility = await build_both()
        visible = await visible_tools(native, compatibility)
        assert visible["native"] == visible["compatibility"]
        assert "list_dashboards" in visible["native"]
        assert "create_theme" not in visible["native"]

        # A hidden tool cannot be reached by naming it directly or via proxy.
        results = await call_three_ways(
            native, compatibility, "create_theme", THEME_REQUEST
        )
        assert_denied_everywhere(results, "Permission denied")


@pytest.mark.asyncio
@pytest.mark.usefixtures("unprivileged_user", "rbac_enabled")
async def test_token_scopes_apply_identically() -> None:
    """A read-scoped token cannot write on any path, even with full RBAC."""
    security_manager = MagicMock()
    security_manager.can_access.return_value = True
    with (
        patch("superset.mcp_service.auth.security_manager", security_manager),
        patch(
            "superset.mcp_service.auth._get_token_scopes",
            return_value={"superset:read"},
        ),
    ):
        native, compatibility = await build_both()
        visible = await visible_tools(native, compatibility)
        assert visible["native"] == visible["compatibility"]
        assert "create_theme" not in visible["native"]

        results = await call_three_ways(
            native, compatibility, "create_theme", THEME_REQUEST
        )
        assert_denied_everywhere(results, "Permission denied")


@pytest.mark.asyncio
@pytest.mark.usefixtures("unprivileged_user")
async def test_restricted_principal_policy_applies_identically(
    restricted_policy: dict[str, frozenset[str]],
) -> None:
    """A restricted principal reaches only allow-listed tools on every path."""
    native, compatibility = await build_both()
    visible = await visible_tools(native, compatibility)
    assert visible["native"] == visible["compatibility"] == {"health_check"}

    results = await call_three_ways(
        native,
        compatibility,
        "get_chart_type_schema",
        {"chart_type": "table", "include_examples": False},
    )
    assert_denied_everywhere(results, "denied")


@pytest.mark.asyncio
@pytest.mark.usefixtures("unprivileged_user", "rbac_enabled")
async def test_permission_revocation_takes_effect_on_next_request() -> None:
    """Revoking a permission hides and blocks the tool on every path."""
    granted = {"value": True}
    security_manager = MagicMock()
    security_manager.can_access.side_effect = lambda permission, view: (
        granted["value"] or read_only_access(permission, view)
    )
    theme = MagicMock()
    theme.id = 1
    theme.uuid = "11111111-1111-1111-1111-111111111111"
    theme.theme_name = "Surface"
    with (
        patch("superset.mcp_service.auth.security_manager", security_manager),
        patch("superset.db.session.commit"),
        patch("superset.daos.theme.ThemeDAO.create", return_value=theme),
    ):
        native, compatibility = await build_both()
        before = await visible_tools(native, compatibility)
        assert "create_theme" in before["native"]
        assert before["native"] == before["compatibility"]
        allowed = await call_three_ways(
            native, compatibility, "create_theme", THEME_REQUEST
        )
        for path, result in allowed.items():
            assert result.is_error is False, path

        granted["value"] = False
        after = await visible_tools(native, compatibility)
        assert "create_theme" not in after["native"]
        assert after["native"] == after["compatibility"]
        denied = await call_three_ways(
            native, compatibility, "create_theme", THEME_REQUEST
        )
        assert_denied_everywhere(denied, "Permission denied")


@pytest.mark.asyncio
@pytest.mark.usefixtures("unprivileged_user")
async def test_every_registered_tool_is_callable_by_name_on_every_path(
    restricted_policy: dict[str, frozenset[str]],
) -> None:
    """Every registered tool dispatches under its real name on every path.

    Arguments are omitted and the caller is a restricted principal with an
    empty allow-list, so each call ends at schema validation or the
    authorization gate without running a tool body. Both outcomes must be
    identical error results on the native path, a direct call in
    compatibility mode, and the call_tool proxy. Tools in
    ``ALLOWED_UNPROTECTED`` intentionally run without authentication for every
    caller, on every path, and are checked for that instead.
    """
    restricted_policy["allowed"] = frozenset()
    native, compatibility = await build_both()
    outcomes: dict[str, str] = {}
    mismatched: dict[str, dict[str, Any]] = {}
    for tool in await canonical_tools():
        results = await call_three_ways(native, compatibility, tool.name, {})
        if tool.name in ALLOWED_UNPROTECTED:
            for path, result in results.items():
                assert result.is_error is False, (tool.name, path)
            outcomes[tool.name] = "public"
            continue
        expected = comparable(results["native"])
        assert expected[0] is True, tool.name
        if any(comparable(result) != expected for result in results.values()):
            mismatched[tool.name] = {
                path: comparable(result) for path, result in results.items()
            }
        text = results["native"].content[0]
        assert isinstance(text, mt.TextContent)
        outcomes[tool.name] = (
            "denied" if "denied" in text.text.lower() else "validation"
        )
    assert not mismatched, mismatched
    # Both gates are exercised: required arguments, and tools with none.
    assert {"denied", "validation"} <= set(outcomes.values())
    assert {name for name, kind in outcomes.items() if kind == "public"} == set(
        ALLOWED_UNPROTECTED
    )
    assert outcomes["health_check"] == "denied"
    assert outcomes["get_chart_type_schema"] == "validation"


@pytest.mark.asyncio
async def test_validation_details_are_identical_on_every_path() -> None:
    """Schema validation errors keep the same details through the proxy."""
    native, compatibility = await build_both()
    results = await call_three_ways(
        native, compatibility, "get_chart_type_schema", {"include_examples": "x"}
    )
    expected = comparable(results["native"])
    assert expected[0] is True
    for path, result in results.items():
        assert comparable(result) == expected, path
    text = results["native"].content[0]
    assert isinstance(text, mt.TextContent)
    assert "chart_type" in text.text


@pytest.mark.asyncio
async def test_unregistered_tool_is_unreachable_on_every_path() -> None:
    """A tool absent from the registry (e.g. disabled) has no path in."""
    native, compatibility = await build_both()
    for name in ("execute_sql", "list_dashboards"):
        native.remove_tool(name)
        compatibility.remove_tool(name)
    results = await call_three_ways(native, compatibility, "execute_sql", {})
    for path, result in results.items():
        assert result.is_error is True, path
    async with Client(compatibility) as client:
        names = await search_all(client)
    assert not {"execute_sql", "list_dashboards"} & names


# Compact native listing (MCP_NATIVE_TOOL_LIST_CONFIG["compact"] = True).
#
# Only listed descriptions change, bounded by the rule tool search applies to
# its results. Schemas, annotations, and server-side validation are identical
# to the default listing, and full guidance stays reachable.

# Schema keywords whose preservation the compact listing must not affect.
SCHEMA_KEYWORDS = (
    "$defs",
    "$ref",
    "enum",
    "const",
    "minimum",
    "maximum",
    "exclusiveMinimum",
    "minLength",
    "maxLength",
    "minItems",
    "maxItems",
)


def schema_keywords(schema: Any) -> Counter[str]:
    """Count validation keywords and nullable unions anywhere in a schema."""
    counts: Counter[str] = Counter()

    def walk(node: Any) -> None:
        if isinstance(node, dict):
            for key, value in node.items():
                if key in SCHEMA_KEYWORDS:
                    counts[key] += 1
                if key == "anyOf" and {"type": "null"} in value:
                    counts["nullable"] += 1
                walk(value)
        elif isinstance(node, list):
            for value in node:
                walk(value)

    walk(schema)
    return counts


def test_compact_listing_is_off_by_default() -> None:
    """The default configuration leaves the native listing untouched."""
    assert MCP_NATIVE_TOOL_LIST_CONFIG["compact"] is False
    for config in (
        MCP_NATIVE_TOOL_LIST_CONFIG,
        {},
        {"compact": True, "max_description_length": 0},
    ):
        server = MagicMock()
        _apply_compact_tool_list_transform(server, dict(config))
        server.add_transform.assert_not_called()


@pytest.mark.asyncio
@pytest.mark.parametrize("mode", OUTPUT_MODES)
@pytest.mark.parametrize("max_description_length", [150, 250, 300])
async def test_compact_listing_only_bounds_descriptions(
    mode: str, max_description_length: int
) -> None:
    """Every field except the description is served exactly as by default."""
    structured_output_enabled = OUTPUT_MODES[mode]
    default = await list_native(structured_output_enabled)
    compact = await list_native(
        structured_output_enabled,
        compact=True,
        max_description_length=max_description_length,
    )

    assert compact.nextCursor is None
    assert [tool.name for tool in compact.tools] == [
        tool.name for tool in default.tools
    ]
    shortened = set()
    for full, bounded in zip(default.tools, compact.tools, strict=True):
        full_entry, bounded_entry = wire_entry(full), wire_entry(bounded)
        full_description = full_entry.pop("description", "")
        description = bounded_entry.pop("description", "")
        assert bounded_entry == full_entry, full.name
        # Native mode budgets prose alone; request instructions stay in the schema.
        assert description == _truncate_description(
            full_description, max_description_length
        )
        assert description, full.name
        assert len(description) <= max_description_length, full.name
        assert inspect.cleandoc(full_description).startswith(description), full.name
        if description != full_description:
            shortened.add(full.name)
    datasets = next(tool for tool in compact.tools if tool.name == "list_datasets")
    assert "For semantic views, use list_metrics for discovery and get_table" in (
        datasets.description or ""
    )
    assert {"generate_chart", "update_chart", "list_datasets"} <= shortened
    assert compact_bytes([wire_entry(tool) for tool in compact.tools]) < (
        compact_bytes([wire_entry(tool) for tool in default.tools])
    )


@pytest.mark.asyncio
async def test_compact_schemas_keep_nullability_constraints_and_definitions() -> None:
    """Nullable unions, constraints, and definitions are served unchanged."""
    default = await list_native(structured_output_enabled=True)
    compact = await list_native(structured_output_enabled=True, compact=True)
    totals: Counter[str] = Counter()
    for full, bounded in zip(default.tools, compact.tools, strict=True):
        for kind in ("inputSchema", "outputSchema"):
            expected = getattr(full, kind)
            actual = getattr(bounded, kind)
            assert actual == expected, (full.name, kind)
            assert schema_keywords(actual) == schema_keywords(expected)
            totals += schema_keywords(actual)
    for keyword in ("nullable", "enum", "minimum", "maximum", "maxLength"):
        assert totals[keyword] > 0, keyword


@pytest.mark.asyncio
async def test_compact_listing_keeps_full_definitions_for_calls() -> None:
    """Calls resolve the registered tool with its full description."""
    registered = {tool.name: tool for tool in await canonical_tools()}
    server = await build_server(
        structured_output_enabled=False, compatibility=False, compact=True
    )
    for name, tool in registered.items():
        resolved = await server.get_tool(name)
        assert resolved is not None, name
        assert resolved.description == tool.description, name
        assert resolved.parameters == tool.parameters, name


VALIDATION_CASES = {
    # Constraint violations: page_size is bounded to 1..100.
    "page_size_above_maximum": ("list_charts", {"request": {"page_size": 101}}),
    "page_size_not_positive": ("list_datasets", {"request": {"page_size": 0}}),
    # Wrong types and missing required arguments.
    "wrong_type": ("get_chart_type_schema", {"include_examples": "x"}),
    "missing_required": ("generate_chart", {"request": {"dataset_id": 1}}),
    # Nullable fields accept null and reach the authorization gate.
    "nullable_null": ("list_dashboards", {"request": {"search": None}}),
    "nullable_order": ("list_charts", {"request": {"order_column": None}}),
}


@pytest.mark.asyncio
@pytest.mark.usefixtures("unprivileged_user")
async def test_compact_listing_validates_calls_identically(
    restricted_policy: dict[str, frozenset[str]],
) -> None:
    """Server-side validation gives identical results with either listing.

    The caller is a restricted principal with an empty allow-list, so valid
    arguments end at the authorization gate and invalid ones at validation,
    without running a tool body.
    """
    restricted_policy["allowed"] = frozenset()
    default = await build_server(structured_output_enabled=False, compatibility=False)
    compact = await build_server(
        structured_output_enabled=False, compatibility=False, compact=True
    )
    outcomes: dict[str, str] = {}
    for case, (name, arguments) in VALIDATION_CASES.items():
        results = {}
        for label, server in (("default", default), ("compact", compact)):
            async with Client(server) as client:
                results[label] = await client.call_tool(
                    name, arguments, raise_on_error=False
                )
        assert comparable(results["compact"]) == comparable(results["default"]), case
        assert results["default"].is_error is True, case
        text = results["default"].content[0]
        assert isinstance(text, mt.TextContent)
        outcomes[case] = "denied" if "denied" in text.text.lower() else "validation"
    assert outcomes == {
        "page_size_above_maximum": "validation",
        "page_size_not_positive": "validation",
        "wrong_type": "validation",
        "missing_required": "validation",
        "nullable_null": "denied",
        "nullable_order": "denied",
    }


def listed_text(tool: mt.Tool) -> str:
    """Everything a client reads for one listed tool."""
    return f"{tool.description} {json.dumps(tool.inputSchema)}"


@pytest.mark.asyncio
@pytest.mark.usefixtures("unprivileged_user")
async def test_compact_listing_keeps_chart_guidance_reachable() -> None:
    """Chart tools point to get_chart_type_schema, which serves the details.

    The per-type fields, required fields, and examples that a bounded
    description omits are returned by get_chart_type_schema on the same
    compact server.
    """
    compact = await list_native(structured_output_enabled=False, compact=True)
    listed = {tool.name: tool for tool in compact.tools}
    for name in ("generate_chart", "update_chart", "update_chart_preview"):
        assert "get_chart_type_schema" in listed_text(listed[name]), name
    assert "get_chart_type_schema" in listed

    server = await build_server(
        structured_output_enabled=False, compatibility=False, compact=True
    )
    core_types = [name for name in VALID_CHART_TYPES if name != "interactive_pivot"]
    async with Client(server) as client:
        for chart_type in core_types:
            result = await client.call_tool(
                "get_chart_type_schema", {"chart_type": chart_type}
            )
            text = result.content[0]
            assert isinstance(text, mt.TextContent)
            payload = json.loads(text.text)
            assert payload["chart_type"] == chart_type
            assert payload["schema"].get("required"), chart_type
            assert payload["examples"], chart_type
            if chart_type == "box_plot":
                assert {"metrics", "distribute_across"} <= set(
                    payload["schema"]["required"]
                )
                assert "distribute_across" in payload["schema"]["properties"]
                assert all(
                    example["distribute_across"] for example in payload["examples"]
                )


@contextmanager
def recorded_outcome_metrics() -> Iterator[MagicMock]:
    """Capture the per-tool stats emitted by the logging middleware."""
    with patch("superset.mcp_service.middleware.stats_logger_manager") as stats:
        yield stats.instance


def outcome_keys(stats: MagicMock) -> list[str]:
    return [call.args[0] for call in stats.incr.call_args_list]


def timing_keys(stats: MagicMock) -> list[str]:
    return [call.args[0] for call in stats.timing.call_args_list]


async def call_and_count(
    server: FastMCP,
    name: str,
    arguments: dict[str, Any],
    *,
    proxied: bool,
    proxy_name: str = CALL_TOOL,
) -> tuple[CallToolResult, list[str], list[str]]:
    """Call a tool and return its result with the outcome and timing metrics."""
    with recorded_outcome_metrics() as stats:
        async with Client(server) as client:
            if proxied:
                result = await client.call_tool(
                    proxy_name,
                    {"name": name, "arguments": arguments},
                    raise_on_error=False,
                )
            else:
                result = await client.call_tool(name, arguments, raise_on_error=False)
    return result, outcome_keys(stats), timing_keys(stats)


@pytest.mark.asyncio
@pytest.mark.usefixtures("unprivileged_user")
async def test_proxied_validation_failure_is_one_failure_and_an_error_result() -> None:
    """A validation failure through call_tool is reported as an error result
    and counted once, with the same outcome as the direct call."""
    _, compatibility = await build_both()
    arguments = {"include_examples": "x"}

    direct, direct_keys, direct_timing = await call_and_count(
        compatibility, "get_chart_type_schema", arguments, proxied=False
    )
    proxied, proxied_keys, proxied_timing = await call_and_count(
        compatibility, "get_chart_type_schema", arguments, proxied=True
    )

    assert direct.is_error is True
    assert proxied.is_error is True
    assert direct_keys == ["mcp.tool.get_chart_type_schema.warning"]
    assert proxied_keys == direct_keys
    assert direct_timing == ["mcp.tool.get_chart_type_schema.time"]
    assert proxied_timing == direct_timing


@pytest.mark.asyncio
@pytest.mark.usefixtures("unprivileged_user")
@pytest.mark.parametrize("proxy_name", [CALL_TOOL, "invoke_tool"])
async def test_proxied_failure_is_counted_once_under_any_configured_proxy_name(
    proxy_name: str,
) -> None:
    """The proxy name is configurable; a failure forwarded through it must
    still be counted once, as the inner tool's warning, never also as an
    error on the proxy itself."""
    search_config = {**MCP_TOOL_SEARCH_CONFIG, "call_tool_name": proxy_name}
    flask_app = MagicMock()
    flask_app.config = {"MCP_TOOL_SEARCH_CONFIG": search_config}
    with patch("superset.mcp_service.flask_singleton.get_flask_app") as get_app:
        get_app.return_value = flask_app
        compatibility = await build_server(
            structured_output_enabled=False,
            compatibility=True,
            search_config=search_config,
        )
        proxied, keys, timings = await call_and_count(
            compatibility,
            "get_chart_type_schema",
            {"include_examples": "x"},
            proxied=True,
            proxy_name=proxy_name,
        )

    assert proxied.is_error is True
    assert keys == ["mcp.tool.get_chart_type_schema.warning"]
    assert timings == ["mcp.tool.get_chart_type_schema.time"]


@pytest.mark.asyncio
@pytest.mark.usefixtures("unprivileged_user", "rbac_enabled")
async def test_proxied_permission_failure_is_one_failure_and_an_error_result() -> None:
    """A permission denial through call_tool is reported as an error result
    and counted once, with the same outcome as the direct call."""
    security_manager = MagicMock()
    security_manager.can_access.return_value = True
    with (
        patch("superset.mcp_service.auth.security_manager", security_manager),
        patch(
            "superset.mcp_service.auth._get_token_scopes",
            return_value={"superset:read"},
        ),
    ):
        _, compatibility = await build_both()
        direct, direct_keys, direct_timing = await call_and_count(
            compatibility, "create_theme", THEME_REQUEST, proxied=False
        )
        proxied, proxied_keys, proxied_timing = await call_and_count(
            compatibility, "create_theme", THEME_REQUEST, proxied=True
        )

    assert direct.is_error is True
    assert proxied.is_error is True
    assert len(direct_keys) == 1
    assert direct_keys[0].startswith("mcp.tool.create_theme.")
    assert not direct_keys[0].endswith(".success")
    assert proxied_keys == direct_keys
    assert proxied_timing == direct_timing


@pytest.mark.asyncio
@pytest.mark.usefixtures("unprivileged_user")
async def test_direct_failure_metrics_are_unchanged_in_both_modes() -> None:
    """Direct calls count one failure whether or not the proxy is installed."""
    native, compatibility = await build_both()
    arguments = {"include_examples": "x"}
    for server in (native, compatibility):
        result, keys, timings = await call_and_count(
            server, "get_chart_type_schema", arguments, proxied=False
        )
        assert result.is_error is True
        assert keys == ["mcp.tool.get_chart_type_schema.warning"]
        assert timings == ["mcp.tool.get_chart_type_schema.time"]


@pytest.mark.asyncio
@pytest.mark.usefixtures("unprivileged_user")
async def test_proxied_success_metrics_are_unchanged() -> None:
    """A successful proxied call is still an ordinary success."""
    _, compatibility = await build_both()
    arguments = {"chart_type": "table", "include_examples": False}

    direct, direct_keys, direct_timing = await call_and_count(
        compatibility, "get_chart_type_schema", arguments, proxied=False
    )
    proxied, proxied_keys, proxied_timing = await call_and_count(
        compatibility, "get_chart_type_schema", arguments, proxied=True
    )

    assert direct.is_error is False
    assert proxied.is_error is False
    assert direct_keys == ["mcp.tool.get_chart_type_schema.success"]
    assert proxied_keys == direct_keys
    assert direct_timing == ["mcp.tool.get_chart_type_schema.time"]
    assert proxied_timing == direct_timing


@pytest.mark.asyncio
@pytest.mark.usefixtures("unprivileged_user")
@pytest.mark.parametrize("proxy_name", [CALL_TOOL, "invoke_tool"])
async def test_proxied_success_is_counted_once_under_any_configured_proxy_name(
    proxy_name: str,
) -> None:
    """A forwarded success emits one counter and timing, even with a renamed proxy."""
    search_config = {**MCP_TOOL_SEARCH_CONFIG, "call_tool_name": proxy_name}
    flask_app = MagicMock()
    flask_app.config = {"MCP_TOOL_SEARCH_CONFIG": search_config}
    with patch("superset.mcp_service.flask_singleton.get_flask_app") as get_app:
        get_app.return_value = flask_app
        compatibility = await build_server(
            structured_output_enabled=False,
            compatibility=True,
            search_config=search_config,
        )
        proxied, keys, timings = await call_and_count(
            compatibility,
            "get_chart_type_schema",
            {"chart_type": "table", "include_examples": False},
            proxied=True,
            proxy_name=proxy_name,
        )

    assert proxied.is_error is False
    assert keys == ["mcp.tool.get_chart_type_schema.success"]
    assert timings == ["mcp.tool.get_chart_type_schema.time"]
