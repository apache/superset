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

"""Canvas contracts through protected registration and the MCP protocol."""

from __future__ import annotations

import importlib
from collections.abc import Iterator
from copy import deepcopy
from types import SimpleNamespace
from typing import Any
from unittest.mock import MagicMock, patch

import pytest
from cachelib import SimpleCache
from fastmcp import Client, FastMCP
from fastmcp.utilities.json_schema import dereference_refs
from flask_appbuilder.security.sqla.models import Role, User
from jsonschema import Draft202012Validator
from mcp.types import CallToolResult, TextContent
from pytest_mock import MockerFixture
from sqlalchemy import create_engine
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool

from superset import security_manager
from superset.app import SupersetApp
from superset.canvas.data import PlacementData
from superset.canvas.definition import registry
from superset.canvas.definition.validation import Issue
from superset.commands.canvas.exceptions import (
    CanvasDraftNotFoundError,
    CanvasForbiddenError,
    CanvasNotFoundError,
    DefinitionConflictError,
    DefinitionInvalidError,
    DraftConflictError,
)
from superset.connectors.sqla.models import SqlaTable
from superset.mcp_service.mcp_config import (
    MCP_NATIVE_TOOL_LIST_CONFIG,
    MCP_TOOL_SEARCH_CONFIG,
)
from superset.mcp_service.server import (
    _apply_compact_tool_list_transform,
    _apply_tool_search_transform,
    build_middleware_list,
)
from superset.models.canvas import Canvas
from superset.subjects.models import Subject
from superset.subjects.types import SubjectType
from superset.utils import json
from superset.widgets.models import Widget
from superset.widgets.registry import registry as widget_registry
from tests.unit_tests.canvas import placement_data_test
from tests.unit_tests.canvas.fixtures import canvas_widget_types
from tests.unit_tests.canvas.placement_data_test import published_state

pytestmark = pytest.mark.parametrize(
    "app", [{"FEATURE_FLAGS": {"CANVAS": True}}], indirect=True
)
aggregate_table = placement_data_test.aggregate_table

MODULE = "superset.mcp_service.canvas.tool"
TOOLS = (
    "apply_canvas_draft_ops",
    "create_canvas",
    "preview_widget",
    "get_canvas",
    "create_canvas_draft",
    "get_canvas_draft",
    "commit_canvas_draft",
    "delete_canvas_draft",
    "update_canvas",
)


@pytest.fixture(autouse=True)
def principal(
    app: SupersetApp, disable_mcp_rbac: None, mocker: MockerFixture
) -> Iterator[User]:
    """Inject a FAB principal with operator-defined roles and real RBAC checks."""
    user = User(
        id=701,
        username="canvas-contract-editor",
        first_name="Canvas",
        last_name="Editor",
        email="canvas@example.com",
        active=True,
        roles=[Role(name="Canvas contract editor")],
    )
    mocker.patch.dict(
        security_manager.builtin_roles,
        {
            "Canvas contract editor": [["^Canvas$", "^can_(read|write)$"]],
            "Canvas contract reader": [["^Canvas$", "^can_read$"]],
            "Canvas query viewer": [["^Dashboard$", "^can_view_query$"]],
        },
    )
    app.config["MCP_RBAC_ENABLED"] = True
    mocker.patch("superset.mcp_service.auth.get_user_from_request", return_value=user)
    mocker.patch(
        "superset.mcp_service.middleware.get_user_from_request", return_value=user
    )
    # Principal resolution is injected; permission checks use the real manager.
    # The transient principal has no audit-log row.
    mocker.patch("superset.mcp_service.middleware.event_logger")
    yield user
    app.config["MCP_RBAC_ENABLED"] = False


@pytest.fixture
def session_engine() -> Iterator[Engine]:
    """Share only this test's in-memory metadata across sequential tool workers."""
    engine = create_engine(
        "sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool
    )
    yield engine
    engine.dispose()


@pytest.fixture
def metadata_session(
    session: Session, principal: User, mocker: MockerFixture
) -> Iterator[Session]:
    """Persist the injected principal and use isolated metadata and draft cache."""
    Canvas.metadata.create_all(session.get_bind())  # pylint: disable=no-member
    session.add(principal)
    session.flush()
    if not session.query(Subject).filter_by(user_id=principal.id).first():
        session.add(
            Subject(
                user_id=principal.id, label=principal.username, type=SubjectType.USER
            )
        )
    session.commit()
    mocker.patch(
        "superset.commands.canvas.draft.cache_manager",
        SimpleNamespace(explore_form_data_cache=SimpleCache()),
    )
    mocker.patch("superset.commands.canvas.apply_ops.publish_realtime")
    registry.set_widget_resolver(None)
    yield session
    session.rollback()
    registry.set_widget_resolver(None)


@pytest.fixture
def draft_state(metadata_session: Session, mocker: MockerFixture) -> Session:
    """Use small widget schemas with actual persisted widgets and editorship."""
    mocker.patch.dict(widget_registry, canvas_widget_types(), clear=True)
    return metadata_session


async def _server(
    *,
    structured: bool,
    proxy: bool = False,
    compact: bool = False,
    summary: bool = False,
) -> FastMCP:
    """Register actual tools with production decorators and middleware."""
    server = FastMCP(
        "canvas-contract",
        middleware=build_middleware_list(structured_output_enabled=structured),
    )
    with patch("superset.mcp_service.app.mcp", server):
        for name in TOOLS:
            importlib.reload(importlib.import_module(f"{MODULE}.{name}"))
    for name in TOOLS:
        tool = await server.get_tool(name)
        assert tool is not None
        assert getattr(tool.fn, "_mcp_auth_protected", False)
    if proxy:
        _apply_tool_search_transform(
            server,
            {
                **MCP_TOOL_SEARCH_CONFIG,
                "always_visible": [],
                "include_schemas": not summary,
                "max_results": len(TOOLS),
            },
        )
    elif compact:
        _apply_compact_tool_list_transform(
            server, {**MCP_NATIVE_TOOL_LIST_CONFIG, "compact": True}
        )
    return server


async def _call(
    client: Client[Any], name: str, arguments: dict[str, Any], *, proxy: bool
) -> CallToolResult:
    """Invoke the same named tool directly or through the search transform."""
    return await client.call_tool_mcp(
        "call_tool" if proxy else name,
        {"name": name, "arguments": arguments} if proxy else arguments,
    )


def _data(result: CallToolResult, *, structured: bool) -> dict[str, Any]:
    """Check both result envelopes and decode the Canvas result data."""
    assert result.isError is False
    block = result.content[0]
    assert isinstance(block, TextContent)
    data = json.loads(block.text)
    assert result.structuredContent == (data if structured else None)
    return data


def _assert_operation_schema(
    schema: dict[str, Any], *, create: bool, discriminator: bool = False
) -> None:
    """Check the advertised operation grammar after resolving local references."""
    Draft202012Validator.check_schema(schema)
    if discriminator:
        raw_ops = schema["properties"]["ops"]
        if create:
            raw_ops = next(
                option for option in raw_ops["anyOf"] if option.get("type") == "array"
            )
        assert raw_ops["items"]["discriminator"]["propertyName"] == "op"
    resolved = dereference_refs(schema)
    assert set(resolved["properties"]) == (
        {"title", "slug", "description", "ops"}
        if create
        else {"token", "revision", "ops"}
    )
    ops = resolved["properties"]["ops"]
    if create:
        assert "ops" not in resolved["required"]
        assert {"type": "null"} in ops["anyOf"]
        ops = next(option for option in ops["anyOf"] if option.get("type") == "array")
        assert "minItems" not in ops
    else:
        assert ops["minItems"] == 1
    variants = {
        item["properties"]["op"]["const"]: item for item in ops["items"]["oneOf"]
    }
    assert set(variants) == {
        "add",
        "remove",
        "move",
        "place",
        "set_props",
        "set_scope",
        "set_settings",
    }
    assert all("op" in variant["required"] for variant in variants.values())
    assert "widgetType" in variants["add"]["properties"]
    assert "widget_type" not in variants["add"]["properties"]
    assert variants["move"]["properties"]["index"]["anyOf"][0]["minimum"] == 0
    assert "layout" not in variants["move"]["required"]
    for op, field in (("set_scope", "scope"), ("set_settings", "value")):
        assert field in variants[op]["required"]
        assert {"type": "null"} in variants[op]["properties"][field]["anyOf"]
    validator = Draft202012Validator(ops["items"])
    assert validator.is_valid({"op": "remove", "id": "chart"})
    assert not validator.is_valid({"id": "chart"})
    assert not validator.is_valid({"op": "unknown", "id": "chart"})
    assert not validator.is_valid({"op": "move", "id": "chart", "index": -1})


# What the draft tools must advertise even within the shipped prose budgets of
# tool search and compact native listings.
DRAFT_RECOVERY_GUIDANCE = {
    "apply_canvas_draft_ops": (
        "in order and atomically",
        "Only the draft changes; ``commit_canvas_draft`` publishes it",
        "Send the last ``draft_revision`` as ``revision``",
        "``DraftRevisionConflict``, reload the draft",
    ),
    "commit_canvas_draft": (
        "Publish a canvas draft and delete it",
        "only when the person asks to publish",
        "On ``CanvasRevisionConflict`` or ``WidgetRevisionConflict``, "
        "start a fresh draft",
        "``DraftRevisionConflict``, reload the draft",
    ),
}


def _assert_draft_recovery_guidance(
    descriptions: dict[str, str], *, budget: int | None
) -> None:
    """Publish intent and conflict recovery survive the advertised prose budget."""
    for name, phrases in DRAFT_RECOVERY_GUIDANCE.items():
        description = descriptions[name]
        if budget:
            assert len(description) <= budget, name
        prose = " ".join(description.split())
        assert [phrase for phrase in phrases if phrase not in prose] == [], name


@pytest.mark.asyncio
@pytest.mark.parametrize("structured", [False, True])
@pytest.mark.parametrize("compact", [False, True])
async def test_native_canvas_schemas_expose_canonical_operations(
    structured: bool, compact: bool
) -> None:
    """Native and compact listings preserve operation constraints in both modes."""
    server = await _server(structured=structured, compact=compact)
    for name in TOOLS[:2]:
        registered = await server.get_tool(name)
        assert registered is not None
        _assert_operation_schema(
            registered.parameters, create=name == "create_canvas", discriminator=True
        )
    async with Client(server) as client:
        tools = {tool.name: tool for tool in await client.list_tools()}
    budget = MCP_NATIVE_TOOL_LIST_CONFIG["max_description_length"]
    _assert_draft_recovery_guidance(
        {name: tools[name].description or "" for name in DRAFT_RECOVERY_GUIDANCE},
        budget=budget if compact else None,
    )
    for name in TOOLS[:2]:
        tool = tools[name]
        _assert_operation_schema(tool.inputSchema, create=name == "create_canvas")
        assert (tool.outputSchema is not None) == structured
        if compact:
            assert len(tool.description or "") <= budget


@pytest.mark.asyncio
@pytest.mark.parametrize("structured", [False, True])
@pytest.mark.parametrize("summary", [False, True])
async def test_canvas_search_preserves_full_schema_or_explicit_summary(
    structured: bool, summary: bool
) -> None:
    """Full search retains the grammar; summary mode exposes only flat hints."""
    server = await _server(structured=structured, proxy=True, summary=summary)
    async with Client(server) as client:
        result = await client.call_tool_mcp("search_tools", {})
    assert result.isError is False
    block = result.content[0]
    assert isinstance(block, TextContent)
    entries = {tool["name"]: tool for tool in json.loads(block.text)}
    # Search shortens descriptions with or without schemas.
    _assert_draft_recovery_guidance(
        {name: entries[name]["description"] for name in DRAFT_RECOVERY_GUIDANCE},
        budget=MCP_TOOL_SEARCH_CONFIG["max_description_length"],
    )
    for name in TOOLS[:2]:
        tool = entries[name]
        if summary:
            assert "inputSchema" not in tool
            assert tool["parameters_hint"] == (
                "title, slug, description, ops"
                if name == "create_canvas"
                else "token, revision, ops"
            )
        else:
            _assert_operation_schema(
                tool["inputSchema"], create=name == "create_canvas"
            )


@pytest.mark.asyncio
@pytest.mark.parametrize("structured", [False, True])
@pytest.mark.parametrize("proxy", [False, True])
async def test_canvas_transport_preserves_omitted_and_explicit_null_operations(
    structured: bool, proxy: bool, mocker: MockerFixture
) -> None:
    """Schema enrichment leaves raw dictionaries and nullable reset keys intact."""
    server = await _server(structured=structured, proxy=proxy)
    ops = [
        {"op": "add", "widgetType": "markdown"},
        {"op": "move", "id": "chart", "parent": "root"},
        {"op": "set_scope", "kind": "filter", "id": "filter", "scope": None},
        {"op": "set_settings", "key": "colors", "value": None},
    ]
    apply = mocker.patch(
        f"{MODULE}.apply_canvas_draft_ops._apply_canvas_draft_ops_impl",
        return_value={"revision": 1},
    )
    async with Client(server) as client:
        result = await _call(
            client,
            "apply_canvas_draft_ops",
            {"token": "tok", "revision": 0, "ops": ops},
            proxy=proxy,
        )
    assert _data(result, structured=structured) == {"revision": 1}
    apply.assert_called_once_with("tok", 0, ops)


@pytest.mark.asyncio
@pytest.mark.parametrize("structured", [False, True])
@pytest.mark.parametrize("proxy", [False, True])
@pytest.mark.parametrize(
    ("ops", "path"),
    [
        ([], "/ops"),
        ([{"op": "set_settings", "key": "colors"}], "/ops/0/value"),
        ([{"op": "set_scope", "kind": "filter", "id": "filter"}], "/ops/0/scope"),
        ([{"op": "add", "widgetId": "saved", "widgetType": "markdown"}], "/ops/0"),
        (
            [
                {"op": "remove", "id": "a"},
                {"op": "move", "id": "b", "parent": "root", "index": -1},
            ],
            "/ops/1/index",
        ),
    ],
)
async def test_invalid_operations_keep_canvas_paths_before_draft_loading(
    structured: bool,
    proxy: bool,
    ops: list[dict[str, Any]],
    path: str,
    mocker: MockerFixture,
) -> None:
    """Canonical helper validation still produces data with precise field paths."""
    server = await _server(structured=structured, proxy=proxy)
    load = mocker.patch(f"{MODULE}.apply_canvas_draft_ops.load_draft")
    command = mocker.patch(
        f"{MODULE}.apply_canvas_draft_ops.ApplyCanvasDraftOperationsCommand"
    )
    async with Client(server) as client:
        result = await _call(
            client,
            "apply_canvas_draft_ops",
            {"token": "unknown", "revision": 0, "ops": ops},
            proxy=proxy,
        )
    data = _data(result, structured=structured)
    assert data["error"] == "Invalid operations"
    assert data["error_type"] == "ValidationError"
    assert data["errors"][0]["path"] == path
    load.assert_not_called()
    command.assert_not_called()


@pytest.mark.asyncio
@pytest.mark.parametrize("structured", [False, True])
@pytest.mark.parametrize("proxy", [False, True])
@pytest.mark.parametrize("extra", [{}, {"ops": None}, {"ops": []}])
async def test_empty_creation_keeps_all_optional_operations_forms(
    structured: bool, proxy: bool, extra: dict[str, Any], mocker: MockerFixture
) -> None:
    """Omitted, null, and empty initial operations all create an empty canvas."""
    server = await _server(structured=structured, proxy=proxy)
    create = mocker.patch(f"{MODULE}.create_canvas.CreateCanvasCommand")
    create.return_value.run.return_value = MagicMock(id=5, url="/canvas/5/", revision=1)
    apply = mocker.patch(f"{MODULE}.create_canvas._apply_canvas_ops_impl")
    async with Client(server) as client:
        result = await _call(
            client, "create_canvas", {"title": "Empty", **extra}, proxy=proxy
        )
    assert _data(result, structured=structured) == {
        "id": 5,
        "url": "/canvas/5/",
        "revision": 1,
    }
    create.assert_called_once_with({"title": "Empty"})
    apply.assert_not_called()


@pytest.mark.asyncio
@pytest.mark.parametrize("structured", [False, True])
@pytest.mark.parametrize("proxy", [False, True])
async def test_denied_principal_cannot_execute_canvas_writes(
    structured: bool, proxy: bool, principal: User, mocker: MockerFixture
) -> None:
    """An authenticated custom role without can_write cannot reach a write helper."""
    principal.roles = [Role(name="Canvas contract reader")]
    server = await _server(structured=structured, proxy=proxy)
    create = mocker.patch(f"{MODULE}.create_canvas._create_canvas_impl")
    async with Client(server) as client:
        result = await _call(client, "create_canvas", {"title": "Denied"}, proxy=proxy)
    assert result.isError is True
    assert any(
        isinstance(block, TextContent) and "Permission denied" in block.text
        for block in result.content
    )
    create.assert_not_called()


@pytest.mark.asyncio
@pytest.mark.parametrize("structured", [False, True])
@pytest.mark.parametrize("proxy", [False, True])
@pytest.mark.parametrize("view_query", [False, True])
async def test_preview_query_visibility_uses_actual_role_grants(
    structured: bool,
    proxy: bool,
    view_query: bool,
    principal: User,
    mocker: MockerFixture,
) -> None:
    """Preview query text requires its Dashboard grant on both invocation paths."""
    if view_query:
        principal.roles.append(Role(name="Canvas query viewer"))
    server = await _server(structured=structured, proxy=proxy)
    dao = mocker.patch(f"{MODULE}.preview_widget.CanvasDAO")
    dao.load.return_value = {
        "nodes": {
            "chart": {
                "widgetType": "metric-tile",
                "props": {"dataBinding": {"datasetId": 13}},
            }
        }
    }
    query = "SELECT SUM(sales) FROM sales"
    mocker.patch(
        f"{MODULE}.preview_widget.run_binding",
        return_value=PlacementData([{"sales": 40}], query, "sql"),
    )
    async with Client(server) as client:
        result = await _call(
            client,
            "preview_widget",
            {"canvas_id": 1, "placement_id": "chart"},
            proxy=proxy,
        )
    data = _data(result, structured=structured)
    assert data.get("query") == (query if view_query else None)
    assert data["sample_rows"] == [{"sales": 40}]


@pytest.mark.asyncio
@pytest.mark.parametrize("structured", [False, True])
@pytest.mark.parametrize("proxy", [False, True])
@pytest.mark.parametrize(
    ("exception", "expected"),
    [
        (CanvasDraftNotFoundError(), {"error_type": "DraftUnavailable"}),
        (
            DraftConflictError(4, draft_revision=4),
            {
                "error_type": "DraftRevisionConflict",
                "revision": 4,
                "draft_revision": 4,
                "canvas_changed": False,
            },
        ),
        (
            DraftConflictError(
                9, canvas_changed=True, draft_revision=4, current_canvas_revision=9
            ),
            {
                "error_type": "CanvasRevisionConflict",
                "revision": 9,
                "draft_revision": 4,
                "current_canvas_revision": 9,
                "canvas_changed": True,
            },
        ),
        (
            DraftConflictError(
                9, widgets=["widget-uuid"], draft_revision=4, current_canvas_revision=9
            ),
            {
                "error_type": "WidgetRevisionConflict",
                "revision": 9,
                "draft_revision": 4,
                "current_canvas_revision": 9,
                "canvas_changed": False,
                "changed_widgets": ["widget-uuid"],
            },
        ),
        (
            DefinitionInvalidError(
                "Invalid placement",
                [Issue("/nodes/chart", "Unknown placement")],
                operation_index=1,
            ),
            {
                "error_type": "ValidationError",
                "operation": 1,
                "errors": [{"path": "/nodes/chart", "message": "Unknown placement"}],
            },
        ),
        (CanvasNotFoundError(), {"error": "Canvas not found, or no access to it"}),
        (
            CanvasForbiddenError(),
            {"error": "Only the canvas' editors can draft changes to it"},
        ),
    ],
)
async def test_recovery_results_preserve_categories_and_revision_provenance(
    structured: bool,
    proxy: bool,
    exception: Exception,
    expected: dict[str, Any],
    mocker: MockerFixture,
) -> None:
    """Domain failures survive response models and both MCP envelope modes."""
    server = await _server(structured=structured, proxy=proxy)
    mocker.patch(f"{MODULE}.commit_canvas_draft.load_draft")
    command = mocker.patch(f"{MODULE}.commit_canvas_draft.CommitCanvasDraftCommand")
    command.return_value.run.side_effect = exception
    async with Client(server) as client:
        result = await _call(
            client,
            "commit_canvas_draft",
            {"token": "private-token", "revision": 3},
            proxy=proxy,
        )
    data = _data(result, structured=structured)
    assert "error" in data
    assert {key: value for key, value in data.items() if key != "error"} == {
        key: value for key, value in expected.items() if key != "error"
    }
    if "error" in expected:
        assert data["error"] == expected["error"]
    assert "private-token" not in json.dumps(data)


@pytest.mark.asyncio
@pytest.mark.parametrize("structured", [False, True])
@pytest.mark.parametrize("proxy", [False, True])
async def test_initial_operation_conflict_keeps_its_canvas_revision(
    structured: bool, proxy: bool, mocker: MockerFixture
) -> None:
    """The write response model ignores unknown keys, so the REST body's
    camelCase revision must reach it in snake_case."""
    server = await _server(structured=structured, proxy=proxy)
    create = mocker.patch(f"{MODULE}.create_canvas.CreateCanvasCommand")
    create.return_value.run.return_value = MagicMock(id=5, url="/canvas/5/", revision=1)
    delete = mocker.patch(f"{MODULE}.create_canvas.DeleteCanvasCommand")
    command = mocker.patch(f"{MODULE}.canvas_ops_common.ApplyCanvasOperationsCommand")
    command.return_value.run.side_effect = DefinitionConflictError(
        2, ["chart"], stale=False
    )
    async with Client(server) as client:
        result = await _call(
            client,
            "create_canvas",
            {"title": "Raced", "ops": [{"op": "remove", "id": "chart"}]},
            proxy=proxy,
        )
    data = _data(result, structured=structured)
    assert data["error_type"] == "CanvasRevisionConflict"
    assert data["revision"] == data["current_canvas_revision"] == 2
    delete.assert_called_once_with([5])


@pytest.mark.asyncio
@pytest.mark.parametrize("structured", [False, True])
@pytest.mark.parametrize("proxy", [False, True])
async def test_real_draft_lifecycle_keeps_published_state_until_commit(
    structured: bool,
    proxy: bool,
    draft_state: Session,
) -> None:
    """Create, edit, read, commit and discard use real commands and role checks."""
    server = await _server(structured=structured, proxy=proxy)
    async with Client(server) as client:

        async def invoke(name: str, **arguments: Any) -> dict[str, Any]:
            """Decode a protected call without replacing any domain command."""
            return _data(
                await _call(client, name, arguments, proxy=proxy), structured=structured
            )

        created = await invoke("create_canvas", title="Private working copy")
        canvas_id = created["id"]
        published = await invoke("get_canvas", canvas_id=canvas_id)
        before = published_state(draft_state)
        draft = await invoke("create_canvas_draft", canvas_id=canvas_id)
        token = draft["token"]
        assert draft["revision"] == draft["draft_revision"] == 0
        added = await invoke(
            "apply_canvas_draft_ops",
            token=token,
            revision=0,
            ops=[
                {
                    "op": "add",
                    "id": "sales",
                    "widgetType": "chart",
                    "props": {"title": "Keep this", "metric": "count"},
                }
            ],
        )
        assert added["revision"] == added["draft_revision"] == 1
        assert published_state(draft_state) == before
        assert await invoke("get_canvas", canvas_id=canvas_id) == published
        effective = await invoke("get_canvas_draft", token=token)
        widget_id = effective["definition"]["nodes"]["sales"]["widgetId"]
        assert draft_state.query(Widget).count() == 0

        rejected = await invoke(
            "apply_canvas_draft_ops",
            token=token,
            revision=1,
            ops=[
                {"op": "add", "id": "temporary", "widgetType": "chart"},
                {"op": "remove", "id": "missing"},
                {"op": "add", "id": "later", "widgetType": "markdown"},
            ],
        )
        assert rejected["error_type"] == "ValidationError"
        assert rejected["operation"] == 1
        assert await invoke("get_canvas_draft", token=token) == effective
        assert published_state(draft_state) == before

        stale = await invoke(
            "apply_canvas_draft_ops",
            token=token,
            revision=0,
            ops=[{"op": "remove", "id": "sales"}],
        )
        assert stale["error_type"] == "DraftRevisionConflict"
        assert stale["revision"] == stale["draft_revision"] == 1
        assert "current_canvas_revision" not in stale
        props = deepcopy(effective["widgets"][widget_id]["props"])
        props["metric"] = "sum"
        changed = await invoke(
            "apply_canvas_draft_ops",
            token=token,
            revision=1,
            ops=[{"op": "set_props", "id": "sales", "props": props}],
        )
        assert changed["draft_revision"] == 2
        committed = await invoke("commit_canvas_draft", token=token, revision=2)
        assert committed["canvas_revision"] == created["revision"] + 1
        unavailable = await invoke("get_canvas_draft", token=token)
        assert unavailable["error_type"] == "DraftUnavailable"
        published = await invoke("get_canvas", canvas_id=canvas_id)
        assert published["widgets"][widget_id]["props"] == props
        assert props["title"] == "Keep this"
        assert draft_state.query(Widget).count() == 1

        draft = await invoke("create_canvas_draft", canvas_id=canvas_id)
        await invoke(
            "apply_canvas_draft_ops",
            token=draft["token"],
            revision=0,
            ops=[{"op": "remove", "id": "sales"}],
        )
        assert await invoke("delete_canvas_draft", token=draft["token"]) == {}
        assert await invoke("get_canvas_draft", token=draft["token"]) == unavailable
        assert await invoke("get_canvas", canvas_id=canvas_id) == published


@pytest.mark.asyncio
@pytest.mark.parametrize("structured", [False, True])
@pytest.mark.parametrize("proxy", [False, True])
async def test_empty_draft_close_reports_the_revision_published_since_the_fork(
    structured: bool,
    proxy: bool,
    draft_state: Session,
) -> None:
    """An empty close returns the observed published revision, not the fork's."""
    server = await _server(structured=structured, proxy=proxy)
    async with Client(server) as client:

        async def invoke(name: str, **arguments: Any) -> dict[str, Any]:
            """Decode a protected call without replacing any domain command."""
            return _data(
                await _call(client, name, arguments, proxy=proxy), structured=structured
            )

        created = await invoke("create_canvas", title="Empty close")
        empty = await invoke("create_canvas_draft", canvas_id=created["id"])
        assert (empty["base_revision"], empty["draft_revision"]) == (1, 0)
        for note in range(3):
            other = await invoke("create_canvas_draft", canvas_id=created["id"])
            await invoke(
                "apply_canvas_draft_ops",
                token=other["token"],
                revision=0,
                ops=[{"op": "add", "id": f"note-{note}", "widgetType": "markdown"}],
            )
            published = await invoke(
                "commit_canvas_draft", token=other["token"], revision=1
            )
        assert published["canvas_revision"] == 4
        before = published_state(draft_state)

        closed = await invoke("commit_canvas_draft", token=empty["token"], revision=0)

        assert closed["canvas_revision"] == 4
        assert published_state(draft_state) == before
        unavailable = await invoke("get_canvas_draft", token=empty["token"])
        assert unavailable["error_type"] == "DraftUnavailable"


@pytest.mark.asyncio
@pytest.mark.parametrize("structured", [False, True])
@pytest.mark.parametrize("proxy", [False, True])
@pytest.mark.parametrize(
    "arguments",
    [
        {"title": ""},
        {"title": "Invalid schema", "ops": [{"op": "unknown"}]},
        {
            "title": "Invalid middle operation",
            "ops": [
                {"op": "add", "widgetType": "chart", "id": "new-chart"},
                {"op": "remove", "id": "missing"},
            ],
        },
    ],
)
async def test_invalid_create_has_no_persisted_canvas_or_widget(
    structured: bool,
    proxy: bool,
    arguments: dict[str, Any],
    draft_state: Session,
) -> None:
    """Rejected metadata and initial operations leave metadata row counts intact."""
    server = await _server(structured=structured, proxy=proxy)
    before = published_state(draft_state)
    async with Client(server) as client:
        result = await _call(client, "create_canvas", arguments, proxy=proxy)
    assert _data(result, structured=structured)["error_type"] == "ValidationError"
    assert published_state(draft_state) == before


@pytest.mark.asyncio
@pytest.mark.parametrize("structured", [False, True])
@pytest.mark.parametrize("proxy", [False, True])
async def test_unavailable_tokens_do_not_disclose_draft_ownership(
    structured: bool,
    proxy: bool,
    draft_state: Session,
) -> None:
    """Unknown, discarded and another editor's tokens return identical data."""
    server = await _server(structured=structured, proxy=proxy)
    other = User(
        id=702,
        username="another-editor",
        first_name="Other",
        last_name="Editor",
        email="other@example.com",
        active=True,
        roles=[draft_state.query(Role).filter_by(name="Canvas contract editor").one()],
    )
    draft_state.add(other)
    draft_state.commit()
    async with Client(server) as client:
        created = _data(
            await _call(
                client, "create_canvas", {"title": "Private draft"}, proxy=proxy
            ),
            structured=structured,
        )
        draft = _data(
            await _call(
                client, "create_canvas_draft", {"canvas_id": created["id"]}, proxy=proxy
            ),
            structured=structured,
        )
        with (
            patch(
                "superset.mcp_service.auth.get_user_from_request", return_value=other
            ),
            patch(
                "superset.mcp_service.middleware.get_user_from_request",
                return_value=other,
            ),
        ):
            foreign = _data(
                await _call(
                    client, "get_canvas_draft", {"token": draft["token"]}, proxy=proxy
                ),
                structured=structured,
            )
        unknown = _data(
            await _call(
                client,
                "get_canvas_draft",
                {"token": "00000000-0000-0000-0000-000000000000"},
                proxy=proxy,
            ),
            structured=structured,
        )
        assert (
            _data(
                await _call(
                    client,
                    "delete_canvas_draft",
                    {"token": draft["token"]},
                    proxy=proxy,
                ),
                structured=structured,
            )
            == {}
        )
        discarded = _data(
            await _call(
                client, "get_canvas_draft", {"token": draft["token"]}, proxy=proxy
            ),
            structured=structured,
        )
    assert foreign == unknown == discarded
    assert foreign["error_type"] == "DraftUnavailable"
    assert set(foreign) == {"error", "error_type"}
    assert draft["token"] not in json.dumps(foreign)


@pytest.mark.asyncio
@pytest.mark.parametrize("structured", [False, True])
@pytest.mark.parametrize("proxy", [False, True])
async def test_real_aggregate_preview_through_protected_transport(
    structured: bool,
    proxy: bool,
    aggregate_table: SqlaTable,
    metadata_session: Session,
    principal: User,
    mocker: MockerFixture,
) -> None:
    """The protected native and proxy paths execute aggregate SQL before limiting."""
    from superset.commands.chart.data.get_data_command import ChartDataCommand

    principal.roles.append(Role(name="Canvas query viewer"))
    editor = metadata_session.query(Subject).filter_by(user_id=principal.id).one()
    aggregate_table.editors = [editor]
    metadata_session.commit()
    server = await _server(structured=structured, proxy=proxy)
    run = mocker.spy(ChartDataCommand, "run")
    async with Client(server) as client:
        created = _data(
            await _call(
                client,
                "create_canvas",
                {
                    "title": "Real aggregate preview",
                    "ops": [
                        {
                            "op": "add",
                            "id": "amounts",
                            "widgetType": "ag-grid-table",
                            "props": {
                                "dataBinding": {
                                    "datasetId": aggregate_table.id,
                                    "metrics": ["total_amount"],
                                    "dimensions": ["category"],
                                    "orderBy": [
                                        {"field": "total_amount", "descending": True}
                                    ],
                                    "rowLimit": 5,
                                }
                            },
                        }
                    ],
                },
                proxy=proxy,
            ),
            structured=structured,
        )
        before = published_state(metadata_session)
        result = await _call(
            client,
            "preview_widget",
            {
                "canvas_id": created["id"],
                "placement_id": "amounts",
            },
            proxy=proxy,
        )
    data = _data(result, structured=structured)
    assert "error" not in data
    assert data["sample_rows"] == [
        {"category": category, "total_amount": total}
        for category, total in [("B", 100), ("F", 90), ("D", 70), ("G", 60), ("A", 40)]
    ]
    assert data["row_count"] == 5
    assert "ORDER BY TOTAL_AMOUNT DESC" in data["query"].upper()
    assert run.call_count == 1
    assert published_state(metadata_session) == before
