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

"""MCP Apps: what a View can reach, and what reaches a View.

A View calls tools through its host, on the viewer's connection, so the
server can't tell its calls from the model's. These tests pin the controls
that keep tool reach closed over a real FastMCP server with Superset's
middleware and tool search: tools are model-only by default once a View
exists, ``search_tools`` and ``call_tool`` are model-only, and ``call_tool``
never reaches an app-only tool. They also cover the structured results that
Views need, the pinning that lets hosts see them, and the decorators.
"""

import hashlib
import sys
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from types import SimpleNamespace
from typing import Any
from unittest.mock import Mock, patch

import pytest
from fastmcp import Client, FastMCP
from fastmcp.apps.config import AppConfig, ResourceCSP
from fastmcp.exceptions import McpError, ToolError
from fastmcp.tools.base import ToolResult
from pydantic import BaseModel, ValidationError

from superset.mcp_service.mcp_apps import (
    declared_visibility,
    feeds_view,
    ModelOnlyByDefaultTransform,
    tool_meta,
)
from superset.mcp_service.mcp_config import MCP_TOOL_SEARCH_CONFIG
from superset.mcp_service.middleware import ToolResultCompatibilityMiddleware
from superset.mcp_service.server import (
    _apply_mcp_apps_transforms,
    _apply_tool_search_transform,
    build_middleware_list,
)

VIEW_URI = "ui://superset/test-viewer/v1"
SERVICE_APP = "superset.mcp_service.app"


class Payload(BaseModel):
    rows: list[dict[str, int]]


def _build(*, with_view: bool = True, search: bool = True) -> FastMCP:
    """A throwaway server with Superset's middleware, transforms and search."""
    server = FastMCP("mcp-apps-test")

    @server.tool
    def run_query(sql: str) -> str:
        """A powerful tool that declares no audience, like execute_sql."""
        return f"ran {sql}"

    @server.tool(app=AppConfig(visibility=["model"]))
    def model_tool() -> str:
        """Declares the model only."""
        return "model"

    if with_view:

        @server.tool(app=AppConfig(resource_uri=VIEW_URI, visibility=["model", "app"]))
        def show_thing() -> Payload:
            """Renders in a View."""
            return Payload(rows=[{"a": 1}])

        @server.tool(app=AppConfig(visibility=["app"]))
        def thing_rows() -> Payload:
            """App only: the View's own data."""
            return Payload(rows=[{"a": 2}])

    for middleware in build_middleware_list(structured_output_enabled=False):
        server.add_middleware(middleware)
    _apply_mcp_apps_transforms(server)
    if search:
        _apply_tool_search_transform(
            server, {**MCP_TOOL_SEARCH_CONFIG, "always_visible": ["health_check"]}
        )
    return server


@asynccontextmanager
async def _client(server: FastMCP) -> AsyncIterator[Client]:
    async with Client(server) as client:
        yield client


def _visibility(tool: Any) -> list[str] | None:
    return ((tool.meta or {}).get("ui") or {}).get("visibility")


@pytest.mark.asyncio
async def test_tools_without_an_audience_are_model_only_once_a_view_exists() -> None:
    async with _client(_build(search=False)) as client:
        listed = {tool.name: tool for tool in await client.list_tools()}

    assert _visibility(listed["run_query"]) == ["model"]
    # Declared audiences are kept as declared.
    assert _visibility(listed["model_tool"]) == ["model"]
    assert _visibility(listed["show_thing"]) == ["model", "app"]
    assert _visibility(listed["thing_rows"]) == ["app"]


@pytest.mark.asyncio
async def test_listing_is_unchanged_without_any_view() -> None:
    async with _client(_build(with_view=False, search=False)) as client:
        listed = {tool.name: tool for tool in await client.list_tools()}

    assert _visibility(listed["run_query"]) is None
    assert _visibility(listed["model_tool"]) == ["model"]


@pytest.mark.asyncio
async def test_search_proxies_are_model_only_and_view_tools_are_pinned() -> None:
    async with _client(_build()) as client:
        listed = {tool.name: tool for tool in await client.list_tools()}

    assert _visibility(listed["search_tools"]) == ["model"]
    assert _visibility(listed["call_tool"]) == ["model"]
    # Hosts read a View's tools from tools/list, so they are pinned there.
    assert {"show_thing", "thing_rows"} <= listed.keys()
    assert listed["show_thing"].meta["ui"]["resourceUri"] == VIEW_URI
    # Everything else stays behind search.
    assert "run_query" not in listed


@pytest.mark.asyncio
async def test_call_tool_never_reaches_an_app_only_tool() -> None:
    async with _client(_build()) as client:
        with pytest.raises(ToolError, match="Unknown tool: 'thing_rows'"):
            await client.call_tool("call_tool", {"name": "thing_rows", "arguments": {}})
        reached = await client.call_tool(
            "call_tool", {"name": "run_query", "arguments": {"sql": "select 1"}}
        )

    assert reached.content[0].text == "ran select 1"


@pytest.mark.asyncio
async def test_call_tool_refuses_names_it_cannot_list() -> None:
    async with _client(_build()) as client:
        with pytest.raises(ToolError, match="Unknown tool: 'nope'"):
            await client.call_tool("call_tool", {"name": "nope", "arguments": {}})


@pytest.mark.asyncio
async def test_search_never_offers_an_app_only_tool() -> None:
    async with _client(_build()) as client:
        result = await client.call_tool("search_tools", {})

    offered = result.content[0].text
    assert "run_query" in offered
    assert "thing_rows" not in offered
    # Pinned tools leave the search results.
    assert "show_thing" not in offered


@pytest.mark.asyncio
async def test_view_tools_keep_structured_results_when_output_is_text_only() -> None:
    async with _client(_build(search=False)) as client:
        listed = {tool.name: tool for tool in await client.list_tools()}
        shown = await client.call_tool("show_thing", {})
        rows = await client.call_tool("thing_rows", {})
        plain = await client.call_tool("model_tool", {})

    assert listed["show_thing"].outputSchema is not None
    assert listed["thing_rows"].outputSchema is not None
    assert listed["model_tool"].outputSchema is None
    assert shown.structured_content == {"rows": [{"a": 1}]}
    assert rows.structured_content == {"rows": [{"a": 2}]}
    assert plain.structured_content is None


@pytest.mark.asyncio
async def test_unresolvable_tool_keeps_the_text_only_result() -> None:
    middleware = ToolResultCompatibilityMiddleware(structured_output_enabled=False)
    context = SimpleNamespace(message=SimpleNamespace(name="x"), fastmcp_context=None)

    async def call_next(_: Any) -> ToolResult:
        return ToolResult(content="hi", structured_content={"a": 1})

    result = await middleware.on_call_tool(context, call_next)

    assert result.structured_content is None


def test_feeds_view_counts_only_what_a_tool_declares() -> None:
    def tool(ui: Any) -> SimpleNamespace:
        return SimpleNamespace(meta=None if ui is None else {"ui": ui})

    assert feeds_view(tool({"resourceUri": VIEW_URI}))
    assert feeds_view(tool({"visibility": ["app"]}))
    assert not feeds_view(tool({"visibility": ["model"]}))
    assert not feeds_view(tool(None))
    assert declared_visibility(tool({})) is None


@pytest.mark.asyncio
async def test_default_transform_leaves_tool_lookups_alone() -> None:
    transform = ModelOnlyByDefaultTransform()
    plain = SimpleNamespace(name="a", meta=None)

    async def call_next(name: str, version: Any = None) -> Any:
        return plain

    assert await transform.get_tool("a", call_next) is plain


def test_mcp_apps_transforms_install_once() -> None:
    server = FastMCP("mcp-apps-install-test")

    _apply_mcp_apps_transforms(server)
    _apply_mcp_apps_transforms(server)

    installed = [
        transform
        for transform in server.transforms
        if isinstance(transform, ModelOnlyByDefaultTransform)
    ]
    assert len(installed) == 1


def test_tool_meta_validates_mcp_apps_settings() -> None:
    meta = tool_meta(None, AppConfig(resource_uri=VIEW_URI, visibility=["model"]))
    assert meta == {"ui": {"resourceUri": VIEW_URI, "visibility": ["model"]}}
    assert tool_meta({"x": 1}, None) == {"x": 1}
    assert tool_meta(None, None) is None
    with pytest.raises(ValidationError):
        tool_meta(None, {"visibility": ["everyone"]})
    with pytest.raises(ValueError, match="must start with ui://"):
        tool_meta(None, {"resourceUri": "https://example.com/view"})
    with pytest.raises(ValueError, match="at least one audience"):
        tool_meta({"ui": {"visibility": []}}, None)
    with pytest.raises(ValueError, match="not both"):
        tool_meta({"ui": {}}, {"visibility": ["model"]})


@pytest.mark.asyncio
async def test_tool_decorator_registers_typed_mcp_apps_settings() -> None:
    from superset.core.mcp.core_mcp_injection import create_tool_decorator

    server = FastMCP("decorator-test")
    with patch(f"{SERVICE_APP}.mcp", server):

        @create_tool_decorator(
            protect=False, app={"resourceUri": VIEW_URI, "visibility": ["model"]}
        )
        def decorated() -> str:
            """Docs."""
            return "ok"

        @create_tool_decorator(protect=False, meta={"ui": {"visibility": ["app"]}})
        def from_meta() -> str:
            """Docs."""
            return "ok"

    async with _client(server) as client:
        listed = {tool.name: tool for tool in await client.list_tools()}

    assert listed["decorated"].meta["ui"] == {
        "resourceUri": VIEW_URI,
        "visibility": ["model"],
    }
    assert listed["from_meta"].meta["ui"] == {"visibility": ["app"]}
    # Bad settings fail as the decorator is built, before any function.
    with pytest.raises(ValidationError):
        create_tool_decorator(protect=False, app={"visibility": ["robots"]})
    with pytest.raises(ValueError, match="must start with ui://"):
        create_tool_decorator(meta={"ui": {"resourceUri": "https://example.com"}})


@pytest.mark.asyncio
async def test_resource_decorator_scopes_versions_and_describes_views() -> None:
    from superset.core.mcp.core_mcp_injection import create_resource_decorator

    server = FastMCP("resource-test")
    extension = SimpleNamespace(extension=SimpleNamespace(publisher="acme", name="viz"))
    with (
        patch(f"{SERVICE_APP}.mcp", server),
        patch(
            "superset.core.mcp.core_mcp_injection.get_current_extension_context",
            return_value=extension,
        ),
    ):

        @create_resource_decorator(
            "runner",
            version="v1-abc",
            app=AppConfig(csp=ResourceCSP(), prefers_border=True),
            protect=False,
        )
        def runner() -> str:
            """The runner."""
            return "<!doctype html><title>runner</title>"

    uri = "ui://extensions/acme/viz/runner/v1-abc"
    assert runner.uri == uri  # type: ignore[attr-defined]
    async with _client(server) as client:
        (listed,) = await client.list_resources()
        (read,) = await client.read_resource(uri)

    assert str(listed.uri) == uri
    assert listed.meta["ui"] == {"csp": {}, "prefersBorder": True}
    assert read.meta["ui"] == {"csp": {}, "prefersBorder": True}
    assert read.mime_type == "text/html;profile=mcp-app"
    assert read.text.startswith("<!doctype html>")


@pytest.mark.asyncio
async def test_resource_decorator_protects_and_scopes_host_views() -> None:
    from superset.core.mcp.core_mcp_injection import create_resource_decorator

    server = FastMCP("resource-host-test")
    with (
        patch(f"{SERVICE_APP}.mcp", server),
        patch(
            "superset.mcp_service.auth.mcp_auth_hook", side_effect=lambda f: f
        ) as hook,
    ):

        @create_resource_decorator("/viewer/")
        def viewer() -> str:
            return "<!doctype html>"

    hook.assert_called_once()
    assert viewer.uri == "ui://superset/viewer"  # type: ignore[attr-defined]
    async with _client(server) as client:
        (listed,) = await client.list_resources()

    # A View that declares no settings serves none.
    assert "ui" not in (listed.meta or {})


@pytest.mark.asyncio
async def test_protected_view_is_read_only_by_an_authenticated_user() -> None:
    from superset.core.mcp.core_mcp_injection import create_resource_decorator

    server = FastMCP("resource-auth-test")
    with patch(f"{SERVICE_APP}.mcp", server):

        @create_resource_decorator("viewer")
        def viewer() -> str:
            return "<!doctype html>"

    uri = viewer.uri  # type: ignore[attr-defined]
    user = Mock(id=1, username="viewer", roles=[], groups=[])
    with patch("superset.mcp_service.auth.get_user_from_request", return_value=user):
        async with _client(server) as client:
            (read,) = await client.read_resource(uri)
    assert read.text == "<!doctype html>"

    with patch(
        "superset.mcp_service.auth.get_user_from_request",
        side_effect=ValueError("No authenticated user"),
    ):
        async with _client(server) as client:
            with pytest.raises(McpError, match="No authenticated user"):
                await client.read_resource(uri)


def test_resource_decorator_registers_nothing_where_mcp_is_not_served() -> None:
    from superset.core.mcp import core_mcp_injection

    saved = sys.modules.pop(SERVICE_APP, None)
    try:
        with patch.object(core_mcp_injection, "_skipped_registrations", set()):

            @core_mcp_injection.create_resource_decorator("viewer", version="v2")
            def viewer() -> str:
                return "<!doctype html>"

        assert SERVICE_APP not in sys.modules
        assert viewer() == "<!doctype html>"
        # Tools that link the View still find its URI.
        assert viewer.uri == "ui://superset/viewer/v2"  # type: ignore[attr-defined]
    finally:
        if saved is not None:
            sys.modules[SERVICE_APP] = saved


@pytest.mark.parametrize(
    "path", ["", "/", "../escape", "a/./b", "a//b", "a b", "view?x=1", "a#b", "ü"]
)
def test_resource_decorator_refuses_bad_paths(path: str) -> None:
    from superset.core.mcp.core_mcp_injection import create_resource_decorator

    with pytest.raises(ValueError, match="Invalid MCP Apps resource path"):
        create_resource_decorator(path)


@pytest.mark.parametrize("version", ["", "v/1", "..", "v 1"])
def test_resource_decorator_refuses_bad_versions(version: str) -> None:
    from superset.core.mcp.core_mcp_injection import create_resource_decorator

    with pytest.raises(ValueError, match="Invalid MCP Apps resource version"):
        create_resource_decorator("viewer", version=version)


def test_resource_decorator_takes_a_path_first() -> None:
    from superset.core.mcp.core_mcp_injection import create_resource_decorator

    def viewer() -> str:
        return "<!doctype html>"

    with pytest.raises(TypeError, match="path first"):
        create_resource_decorator(viewer)  # type: ignore[arg-type]


# Named so as not to shadow the Flask ``app`` fixture.
@pytest.mark.parametrize(
    "settings",
    [
        {"visibility": ["app"]},
        {"resourceUri": "ui://superset/other"},
        AppConfig(visibility=["model"]),
    ],
)
def test_resource_decorator_refuses_tool_settings_on_a_view(settings: Any) -> None:
    from superset.core.mcp.core_mcp_injection import create_resource_decorator

    with pytest.raises(ValueError, match="take no resource_uri or visibility"):
        create_resource_decorator("viewer", app=settings)


def test_content_version_is_a_digest_of_the_content() -> None:
    from superset.core.mcp.core_mcp_injection import content_version

    digest = hashlib.sha256(b"<html>").hexdigest()[:12]
    assert content_version("<html>") == f"v1-{digest}"
    assert content_version(b"<html>") == content_version("<html>")
    assert content_version("<html> ") != content_version("<html>")


def test_initialization_installs_the_mcp_apps_decorators() -> None:
    import superset_core.mcp.decorators as core_decorators

    from superset.core.mcp.core_mcp_injection import (
        content_version,
        create_resource_decorator,
        initialize_core_mcp_decorators,
    )

    with (
        patch.object(core_decorators, "resource", None),
        patch.object(core_decorators, "content_version", None),
    ):
        initialize_core_mcp_decorators()

        assert core_decorators.resource is create_resource_decorator
        assert core_decorators.content_version is content_version
