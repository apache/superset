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
"""``search_tools`` honors its advertised output schema for restricted callers.

``search_tools`` is typed ``str | list[dict]``, so FastMCP advertises an
``outputSchema`` for it whenever structured output is enabled. MCP clients
reject a successful call that omits ``structuredContent`` or returns content
that does not satisfy that schema ("Tool search_tools has an output schema but
did not return structured content"). A caller with few permissions sees a
mostly or fully filtered catalog, so these tests drive ``search_tools`` over
the real streamable-HTTP stack as such callers and validate the wire result
against the schema advertised in ``tools/list``.
"""

from collections.abc import Callable, Iterator
from contextlib import ExitStack
from unittest.mock import Mock, patch

import jsonschema
import pytest
from fastmcp import FastMCP
from flask import Flask

from superset.mcp_service.app import mcp
from superset.mcp_service.mcp_config import MCP_TOOL_SEARCH_CONFIG
from superset.mcp_service.server import (
    _apply_tool_search_transform,
    build_middleware_list,
)
from tests.unit_tests.mcp_service.test_mcp_e2e_smoke import _asgi_client

SEARCH_TOOL = "search_tools"

# Permissions a viewer limited to dashboards holds: dashboard and chart reads,
# plus the dataset read that dashboard rendering needs. No write access, no
# SQL Lab, and no dataset-metadata access.
DASHBOARDS_ONLY_PERMISSIONS = frozenset(
    {
        ("can_read", "Dashboard"),
        ("can_read", "Chart"),
        ("can_read", "Dataset"),
    }
)
NO_PERMISSIONS: frozenset[tuple[str, str]] = frozenset()

# Tools a dashboards-only viewer must never be offered.
WRITE_AND_SQL_TOOLS = {
    "generate_chart",
    "delete_chart",
    "update_dashboard",
    "execute_sql",
}


@pytest.fixture
def rbac_enabled(app: Flask) -> Iterator[None]:
    """Enforce RBAC; the package-wide autouse fixture disables it."""
    with patch.dict(app.config, {"MCP_RBAC_ENABLED": True}):
        yield


async def _build_server(strategy: str, *, structured_output_enabled: bool) -> FastMCP:
    """Serve the real tool catalog behind the production middleware and search.

    The shared ``mcp`` singleton is left untouched: its tools are re-registered
    on a throwaway server so the search transform and middleware cannot leak
    into other tests.
    """
    server = FastMCP("tool-search-structured-output")
    for tool in await mcp.list_tools():
        server.add_tool(tool)
    for middleware in build_middleware_list(
        structured_output_enabled=structured_output_enabled
    ):
        server.add_middleware(middleware)
    _apply_tool_search_transform(
        server, {**MCP_TOOL_SEARCH_CONFIG, "strategy": strategy}
    )
    return server


@pytest.fixture
def as_caller() -> Iterator[Callable[[frozenset[tuple[str, str]]], None]]:
    """Return a function that authenticates the request as a permissioned caller."""
    with ExitStack() as stack:

        def _as_caller(granted: frozenset[tuple[str, str]]) -> None:
            user = Mock()
            user.id = 1
            user.username = "viewer"
            stack.enter_context(
                patch(
                    "superset.mcp_service.auth.get_user_from_request",
                    return_value=user,
                )
            )
            # Tool visibility reads the manager through ``auth``, and the
            # data-model privacy gate reads it from ``superset``.
            for target in (
                "superset.mcp_service.auth.security_manager",
                "superset.security_manager",
            ):
                manager = stack.enter_context(patch(target))
                manager.can_access = (
                    lambda permission, view: (
                        permission,
                        view,
                    )
                    in granted
                )
                manager.is_guest_user = lambda: False

        yield _as_caller


@pytest.mark.asyncio
@pytest.mark.parametrize("strategy", ["bm25", "regex"])
@pytest.mark.parametrize("query", [None, "", "bar chart", "no such capability zzz"])
@pytest.mark.parametrize(
    "granted", [DASHBOARDS_ONLY_PERMISSIONS, NO_PERMISSIONS], ids=["dashboards", "none"]
)
async def test_search_tools_returns_schema_valid_structured_content(
    rbac_enabled: None,
    as_caller: Callable[[frozenset[tuple[str, str]]], None],
    strategy: str,
    query: str | None,
    granted: frozenset[tuple[str, str]],
) -> None:
    """A restricted caller gets structured content that satisfies the schema."""
    as_caller(granted)
    server = await _build_server(strategy, structured_output_enabled=True)
    arguments = {} if query is None else {"query": query}

    async with _asgi_client(server) as client:
        listed = {tool.name: tool for tool in await client.list_tools()}
        result = await client.call_tool(SEARCH_TOOL, arguments)

    output_schema = listed[SEARCH_TOOL].outputSchema
    assert output_schema is not None, "structured output is enabled"
    assert result.structured_content is not None, (
        "search_tools advertised an outputSchema but returned no structuredContent"
    )
    jsonschema.validate(result.structured_content, output_schema)
    returned = result.structured_content["result"]
    assert isinstance(returned, list)

    offered = {entry["name"] for entry in returned}
    assert not offered & WRITE_AND_SQL_TOOLS
    if granted is NO_PERMISSIONS:
        # Only tools that require no permission can remain, and none of the
        # permission-gated read tools may leak through.
        assert not offered & {"list_dashboards", "list_charts", "get_dashboard_info"}
    elif query in (None, ""):
        assert {"list_dashboards", "list_charts"} <= offered


@pytest.mark.asyncio
@pytest.mark.parametrize("strategy", ["bm25", "regex"])
async def test_search_tools_without_structured_output_advertises_no_schema(
    rbac_enabled: None,
    as_caller: Callable[[frozenset[tuple[str, str]]], None],
    strategy: str,
) -> None:
    """With structured output off, neither side of the contract is present."""
    as_caller(DASHBOARDS_ONLY_PERMISSIONS)
    server = await _build_server(strategy, structured_output_enabled=False)

    async with _asgi_client(server) as client:
        listed = {tool.name: tool for tool in await client.list_tools()}
        result = await client.call_tool(SEARCH_TOOL, {"query": "list dashboards"})

    assert listed[SEARCH_TOOL].outputSchema is None
    assert result.structured_content is None
    assert result.content
