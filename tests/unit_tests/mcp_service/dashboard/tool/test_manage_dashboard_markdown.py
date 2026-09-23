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

"""
Unit tests for the manage_dashboard_markdown MCP tool.

Follows the pattern from test_manage_native_filters.py:
- Tests run through the async MCP Client (not direct function calls)
- auth/editorship are mocked via the directory's autouse mock_auth fixture
  (tests/unit_tests/mcp_service/dashboard/tool/conftest.py)
- Patches applied at source locations (superset.daos.dashboard.*, etc.)

Covers:
- Adding markdown/header/divider components to the default grid and to a tab
- Updating an existing component (type-specific field rejection)
- Removing a component (including pruning the wrapper ROW a markdown tile
  leaves behind)
- Validation errors: unknown removal ID, update+remove conflict, duplicate
  update IDs, malformed position_json, missing target tab
- Header text sanitization
- Dashboard not found / permission denied
- "at least one operation" request validation (ToolError at the call boundary)
"""

from collections.abc import Iterator
from typing import Any
from unittest.mock import Mock, patch, PropertyMock

import pytest
from fastmcp import Client, FastMCP
from fastmcp.exceptions import ToolError
from sqlalchemy.exc import SQLAlchemyError

from superset.commands.dashboard.exceptions import DashboardNotFoundError
from superset.exceptions import SupersetSecurityException
from superset.utils import json

DAO_GET = "superset.daos.dashboard.DashboardDAO.get_by_id_or_slug"


@pytest.fixture(autouse=True)
def mock_event_logging() -> Iterator[None]:
    """Isolate dashboard commits from the event logger's separate audit commits."""
    with patch("superset.extensions.event_logger.log_context"):
        yield


def _empty_grid_layout() -> dict[str, Any]:
    """Build an empty frontend-compatible grid."""
    return {
        "DASHBOARD_VERSION_KEY": "v2",
        "ROOT_ID": {"type": "ROOT", "id": "ROOT_ID", "children": ["GRID_ID"]},
        "GRID_ID": {"type": "GRID", "id": "GRID_ID", "children": []},
    }


def _grid_layout_with_existing_components() -> dict[str, Any]:
    """Build a grid with each supported component type."""
    layout = _empty_grid_layout()
    layout["GRID_ID"]["children"] = [
        "ROW-existing1",
        "HEADER-existing1",
        "DIVIDER-existing1",
    ]
    layout["ROW-existing1"] = {
        "type": "ROW",
        "id": "ROW-existing1",
        "children": ["MARKDOWN-existing1"],
        "meta": {"background": "BACKGROUND_TRANSPARENT"},
        "parents": ["ROOT_ID", "GRID_ID"],
    }
    layout["MARKDOWN-existing1"] = {
        "type": "MARKDOWN",
        "id": "MARKDOWN-existing1",
        "children": [],
        "meta": {"code": "Hello", "width": 4, "height": 50},
        "parents": ["ROOT_ID", "GRID_ID", "ROW-existing1"],
    }
    layout["HEADER-existing1"] = {
        "type": "HEADER",
        "id": "HEADER-existing1",
        "children": [],
        "meta": {
            "text": "Old header",
            "headerSize": "MEDIUM_HEADER",
            "background": "BACKGROUND_TRANSPARENT",
        },
        "parents": ["ROOT_ID", "GRID_ID"],
    }
    layout["DIVIDER-existing1"] = {
        "type": "DIVIDER",
        "id": "DIVIDER-existing1",
        "children": [],
        "meta": {},
        "parents": ["ROOT_ID", "GRID_ID"],
    }
    return layout


def _tabbed_layout() -> dict[str, Any]:
    """Build a top-level tab layout."""
    return {
        "DASHBOARD_VERSION_KEY": "v2",
        "ROOT_ID": {"type": "ROOT", "id": "ROOT_ID", "children": ["TABS-1"]},
        "TABS-1": {
            "type": "TABS",
            "id": "TABS-1",
            "children": ["TAB-a", "TAB-b"],
            "meta": {},
        },
        "TAB-a": {
            "type": "TAB",
            "id": "TAB-a",
            "children": [],
            "meta": {"text": "Overview"},
            "parents": ["ROOT_ID", "TABS-1"],
        },
        "TAB-b": {
            "type": "TAB",
            "id": "TAB-b",
            "children": [],
            "meta": {"text": "Details"},
            "parents": ["ROOT_ID", "TABS-1"],
        },
    }


def _mock_dashboard(
    id: int = 1,
    layout: dict[str, Any] | None = None,
    chart_ids: list[int] | None = None,
    slug: str | None = None,
) -> Mock:
    """Build a dashboard without touching the metadata database."""
    dashboard = Mock()
    dashboard.id = id
    dashboard.dashboard_title = "Test Dashboard"
    dashboard.slug = slug
    dashboard.position_json = json.dumps(
        layout if layout is not None else _empty_grid_layout()
    )
    slices = []
    for chart_id in chart_ids or []:
        slc = Mock()
        slc.id = chart_id
        slices.append(slc)
    dashboard.slices = slices
    return dashboard


async def _call(mcp_server: FastMCP, request: dict[str, Any]) -> dict[str, Any]:
    """Exercise validation and serialization through the MCP boundary."""
    async with Client(mcp_server) as client:
        result = await client.call_tool(
            "manage_dashboard_markdown", {"request": request}
        )
        return json.loads(result.content[0].text)


# ---------------------------------------------------------------------------
# Add
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_add_markdown_creates_new_row(mcp_server: FastMCP) -> None:
    dashboard = _mock_dashboard()

    with (
        patch(DAO_GET, return_value=dashboard),
        patch("superset.extensions.db.session"),
    ):
        data = await _call(
            mcp_server,
            {
                "dashboard_id": 1,
                "add": [{"component_type": "markdown", "code": "**Hello**"}],
            },
        )

    assert data["error"] is None
    assert len(data["added_component_ids"]) == 1
    markdown_id = data["added_component_ids"][0]
    assert markdown_id.startswith("MARKDOWN-")

    saved_layout = json.loads(dashboard.position_json)
    markdown_node = saved_layout[markdown_id]
    assert markdown_node["type"] == "MARKDOWN"
    assert markdown_node["meta"] == {"code": "**Hello**", "width": 4, "height": 50}

    # Markdown tiles are wrapped in their own new ROW, not placed directly
    # under GRID_ID.
    row_key = next(
        key
        for key, node in saved_layout.items()
        if isinstance(node, dict)
        and node.get("type") == "ROW"
        and markdown_id in node.get("children", [])
    )
    assert row_key in saved_layout["GRID_ID"]["children"]

    summary = next(c for c in data["components"] if c["id"] == markdown_id)
    assert summary["component_type"] == "markdown"


@pytest.mark.asyncio
async def test_add_header_placed_directly_under_grid(mcp_server: FastMCP) -> None:
    dashboard = _mock_dashboard()

    with (
        patch(DAO_GET, return_value=dashboard),
        patch("superset.extensions.db.session"),
    ):
        data = await _call(
            mcp_server,
            {
                "dashboard_id": 1,
                "add": [
                    {
                        "component_type": "header",
                        "text": "Sales",
                        "header_size": "LARGE_HEADER",
                    }
                ],
            },
        )

    assert data["error"] is None
    header_id = data["added_component_ids"][0]
    assert header_id.startswith("HEADER-")

    saved_layout = json.loads(dashboard.position_json)
    # HEADER is a full-width band: a direct child of GRID_ID, not wrapped
    # in a ROW (ROW does not accept HEADER children).
    assert header_id in saved_layout["GRID_ID"]["children"]
    assert saved_layout[header_id]["meta"] == {
        "text": "Sales",
        "headerSize": "LARGE_HEADER",
        "background": "BACKGROUND_TRANSPARENT",
    }


@pytest.mark.asyncio
async def test_add_divider_placed_directly_under_grid(mcp_server: FastMCP) -> None:
    dashboard = _mock_dashboard()

    with (
        patch(DAO_GET, return_value=dashboard),
        patch("superset.extensions.db.session"),
    ):
        data = await _call(
            mcp_server,
            {"dashboard_id": 1, "add": [{"component_type": "divider"}]},
        )

    assert data["error"] is None
    divider_id = data["added_component_ids"][0]
    assert divider_id.startswith("DIVIDER-")

    saved_layout = json.loads(dashboard.position_json)
    assert divider_id in saved_layout["GRID_ID"]["children"]
    assert saved_layout[divider_id]["meta"] == {}


@pytest.mark.asyncio
async def test_add_multiple_components_in_request_order(mcp_server: FastMCP) -> None:
    dashboard = _mock_dashboard()

    with (
        patch(DAO_GET, return_value=dashboard),
        patch("superset.extensions.db.session"),
    ):
        data = await _call(
            mcp_server,
            {
                "dashboard_id": 1,
                "add": [
                    {"component_type": "header", "text": "Section 1"},
                    {"component_type": "markdown", "code": "text"},
                    {"component_type": "divider"},
                ],
            },
        )

    assert data["error"] is None
    assert len(data["added_component_ids"]) == 3
    types = [c["component_type"] for c in data["components"]]
    assert set(types) == {"header", "markdown", "divider"}


@pytest.mark.asyncio
async def test_add_to_target_tab_by_name(mcp_server: FastMCP) -> None:
    dashboard = _mock_dashboard(layout=_tabbed_layout())

    with (
        patch(DAO_GET, return_value=dashboard),
        patch("superset.extensions.db.session"),
    ):
        data = await _call(
            mcp_server,
            {
                "dashboard_id": 1,
                "add": [
                    {
                        "component_type": "header",
                        "text": "Details header",
                        "target_tab": "Details",
                    }
                ],
            },
        )

    assert data["error"] is None
    header_id = data["added_component_ids"][0]
    saved_layout = json.loads(dashboard.position_json)
    assert header_id in saved_layout["TAB-b"]["children"]
    assert header_id not in saved_layout["TAB-a"]["children"]


@pytest.mark.asyncio
async def test_add_target_tab_not_found_lists_available_tabs(
    mcp_server: FastMCP,
) -> None:
    dashboard = _mock_dashboard(layout=_tabbed_layout())

    with (
        patch(DAO_GET, return_value=dashboard),
        patch("superset.extensions.db.session"),
    ):
        data = await _call(
            mcp_server,
            {
                "dashboard_id": 1,
                "add": [
                    {
                        "component_type": "divider",
                        "target_tab": "Nonexistent",
                    }
                ],
            },
        )

    assert "Nonexistent" in data["error"]
    assert "Overview" in data["error"]
    assert "Details" in data["error"]


@pytest.mark.asyncio
async def test_add_target_tab_on_dashboard_without_tabs(mcp_server: FastMCP) -> None:
    dashboard = _mock_dashboard()

    with (
        patch(DAO_GET, return_value=dashboard),
        patch("superset.extensions.db.session"),
    ):
        data = await _call(
            mcp_server,
            {
                "dashboard_id": 1,
                "add": [{"component_type": "divider", "target_tab": "Anything"}],
            },
        )

    assert "no tabs" in data["error"]


# ---------------------------------------------------------------------------
# Update
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_update_markdown_code(mcp_server: FastMCP) -> None:
    dashboard = _mock_dashboard(layout=_grid_layout_with_existing_components())

    with (
        patch(DAO_GET, return_value=dashboard),
        patch("superset.extensions.db.session"),
    ):
        data = await _call(
            mcp_server,
            {
                "dashboard_id": 1,
                "update": [{"id": "MARKDOWN-existing1", "code": "**Updated**"}],
            },
        )

    assert data["error"] is None
    assert data["updated_component_ids"] == ["MARKDOWN-existing1"]
    saved_layout = json.loads(dashboard.position_json)
    meta = saved_layout["MARKDOWN-existing1"]["meta"]
    # Only `code` was passed; width/height are preserved from the existing
    # config (a partial update merges into the full component, it does not
    # replace it).
    assert meta == {"code": "**Updated**", "width": 4, "height": 50}


@pytest.mark.asyncio
async def test_update_header_fields(mcp_server: FastMCP) -> None:
    dashboard = _mock_dashboard(layout=_grid_layout_with_existing_components())

    with (
        patch(DAO_GET, return_value=dashboard),
        patch("superset.extensions.db.session"),
    ):
        data = await _call(
            mcp_server,
            {
                "dashboard_id": 1,
                "update": [
                    {
                        "id": "HEADER-existing1",
                        "text": "New header",
                        "header_size": "SMALL_HEADER",
                    }
                ],
            },
        )

    assert data["error"] is None
    saved_layout = json.loads(dashboard.position_json)
    meta = saved_layout["HEADER-existing1"]["meta"]
    assert meta == {
        "text": "New header",
        "headerSize": "SMALL_HEADER",
        "background": "BACKGROUND_TRANSPARENT",
    }


@pytest.mark.asyncio
async def test_update_rejects_field_from_wrong_component_type(
    mcp_server: FastMCP,
) -> None:
    dashboard = _mock_dashboard(layout=_grid_layout_with_existing_components())

    with (
        patch(DAO_GET, return_value=dashboard),
        patch("superset.extensions.db.session"),
    ):
        data = await _call(
            mcp_server,
            {
                "dashboard_id": 1,
                "update": [{"id": "HEADER-existing1", "code": "not markdown"}],
            },
        )

    assert "only apply to markdown components" in data["error"]


@pytest.mark.asyncio
async def test_update_unknown_component_id(mcp_server: FastMCP) -> None:
    dashboard = _mock_dashboard(layout=_grid_layout_with_existing_components())

    with (
        patch(DAO_GET, return_value=dashboard),
        patch("superset.extensions.db.session"),
    ):
        data = await _call(
            mcp_server,
            {
                "dashboard_id": 1,
                "update": [{"id": "MARKDOWN-nonexistent", "code": "x"}],
            },
        )

    assert "MARKDOWN-nonexistent" in data["error"]


@pytest.mark.asyncio
async def test_duplicate_update_ids_rejected(mcp_server: FastMCP) -> None:
    dashboard = _mock_dashboard(layout=_grid_layout_with_existing_components())

    with (
        patch(DAO_GET, return_value=dashboard),
        patch("superset.extensions.db.session"),
    ):
        data = await _call(
            mcp_server,
            {
                "dashboard_id": 1,
                "update": [
                    {"id": "MARKDOWN-existing1", "code": "a"},
                    {"id": "MARKDOWN-existing1", "code": "b"},
                ],
            },
        )

    assert "duplicate component IDs" in data["error"]


# ---------------------------------------------------------------------------
# Remove
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_remove_header(mcp_server: FastMCP) -> None:
    dashboard = _mock_dashboard(layout=_grid_layout_with_existing_components())

    with (
        patch(DAO_GET, return_value=dashboard),
        patch("superset.extensions.db.session"),
    ):
        data = await _call(
            mcp_server,
            {"dashboard_id": 1, "remove": ["HEADER-existing1"]},
        )

    assert data["error"] is None
    assert data["removed_component_ids"] == ["HEADER-existing1"]
    saved_layout = json.loads(dashboard.position_json)
    assert "HEADER-existing1" not in saved_layout
    assert "HEADER-existing1" not in saved_layout["GRID_ID"]["children"]


@pytest.mark.asyncio
async def test_remove_markdown_prunes_empty_wrapping_row(mcp_server: FastMCP) -> None:
    dashboard = _mock_dashboard(layout=_grid_layout_with_existing_components())

    with (
        patch(DAO_GET, return_value=dashboard),
        patch("superset.extensions.db.session"),
    ):
        data = await _call(
            mcp_server,
            {"dashboard_id": 1, "remove": ["MARKDOWN-existing1"]},
        )

    assert data["error"] is None
    saved_layout = json.loads(dashboard.position_json)
    assert "MARKDOWN-existing1" not in saved_layout
    # The wrapping ROW-existing1 had only the removed markdown as a child,
    # so it must be pruned too rather than left as an empty orphan.
    assert "ROW-existing1" not in saved_layout
    assert "ROW-existing1" not in saved_layout["GRID_ID"]["children"]


@pytest.mark.asyncio
async def test_remove_unknown_id_rejected(mcp_server: FastMCP) -> None:
    dashboard = _mock_dashboard(layout=_grid_layout_with_existing_components())

    with (
        patch(DAO_GET, return_value=dashboard),
        patch("superset.extensions.db.session"),
    ):
        data = await _call(
            mcp_server,
            {"dashboard_id": 1, "remove": ["MARKDOWN-nonexistent"]},
        )

    assert "MARKDOWN-nonexistent" in data["error"]


@pytest.mark.asyncio
async def test_update_and_remove_conflict_rejected(mcp_server: FastMCP) -> None:
    dashboard = _mock_dashboard(layout=_grid_layout_with_existing_components())

    with (
        patch(DAO_GET, return_value=dashboard),
        patch("superset.extensions.db.session"),
    ):
        data = await _call(
            mcp_server,
            {
                "dashboard_id": 1,
                "update": [{"id": "HEADER-existing1", "text": "x"}],
                "remove": ["HEADER-existing1"],
            },
        )

    assert "HEADER-existing1" in data["error"]
    assert "both updated and removed" in data["error"]


# ---------------------------------------------------------------------------
# Validation / error paths
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_malformed_position_json(mcp_server: FastMCP) -> None:
    dashboard = _mock_dashboard()
    dashboard.position_json = "not valid json"

    with (
        patch(DAO_GET, return_value=dashboard),
        patch("superset.extensions.db.session"),
    ):
        data = await _call(
            mcp_server,
            {"dashboard_id": 1, "add": [{"component_type": "divider"}]},
        )

    assert "malformed layout" in data["error"]


@pytest.mark.asyncio
async def test_dashboard_not_found(mcp_server: FastMCP) -> None:
    with patch(DAO_GET, side_effect=DashboardNotFoundError()):
        data = await _call(
            mcp_server,
            {"dashboard_id": 999, "add": [{"component_type": "divider"}]},
        )

    assert data["error"] is not None
    assert data["permission_denied"] is False


@pytest.mark.asyncio
async def test_permission_denied(mcp_server: FastMCP) -> None:
    dashboard = _mock_dashboard()

    with (
        patch(DAO_GET, return_value=dashboard),
        patch(
            "superset.security_manager.raise_for_editorship",
            side_effect=SupersetSecurityException(Mock()),
        ),
    ):
        data = await _call(
            mcp_server,
            {"dashboard_id": 1, "add": [{"component_type": "divider"}]},
        )

    assert data["permission_denied"] is True


@pytest.mark.asyncio
async def test_at_least_one_operation_required(mcp_server: FastMCP) -> None:
    """Request-schema validation happens at the MCP tool-call boundary,
    before the tool body runs, so the client raises ToolError rather than
    returning a JSON error body (mirrors manage_native_filters)."""
    dashboard = _mock_dashboard()

    with patch(DAO_GET, return_value=dashboard):
        with pytest.raises(ToolError, match="At least one operation"):
            await _call(mcp_server, {"dashboard_id": 1})


@pytest.mark.asyncio
async def test_header_text_html_is_sanitized(mcp_server: FastMCP) -> None:
    dashboard = _mock_dashboard()

    with (
        patch(DAO_GET, return_value=dashboard),
        patch("superset.extensions.db.session"),
    ):
        data = await _call(
            mcp_server,
            {
                "dashboard_id": 1,
                "add": [
                    {
                        "component_type": "header",
                        "text": "<script>alert(1)</script>Sales",
                    }
                ],
            },
        )

    assert data["error"] is None
    header_id = data["added_component_ids"][0]
    saved_layout = json.loads(dashboard.position_json)
    assert "<script>" not in saved_layout[header_id]["meta"]["text"]
    assert "Sales" in saved_layout[header_id]["meta"]["text"]


@pytest.mark.asyncio
async def test_header_text_all_html_rejected(mcp_server: FastMCP) -> None:
    dashboard = _mock_dashboard()

    with patch(DAO_GET, return_value=dashboard):
        with pytest.raises(ToolError, match="no content left after sanitization"):
            await _call(
                mcp_server,
                {
                    "dashboard_id": 1,
                    "add": [{"component_type": "header", "text": "<script></script>"}],
                },
            )


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "operations",
    [
        {"add": [{"component_type": "markdown", "code": "x", "width": 13}]},
        {"add": [{"component_type": "markdown", "code": "x", "height": 0}]},
        {"add": [{"component_type": "chart"}]},
        {"add": [{"component_type": "markdown"}]},
        {"add": [{"component_type": "divider", "code": "ignored?"}]},
        {"update": [{"id": "MARKDOWN-existing1", "component_type": "header"}]},
        {"update": [{"id": "HEADER-existing1", "header_size": "HUGE"}]},
        {"add": [{"component_type": "divider"}], "dashboard_id": True},
    ],
)
async def test_schema_rejects_invalid_operations(
    mcp_server: FastMCP, operations: dict[str, Any]
) -> None:
    """Invalid inputs cannot reach dashboard lookup or persistence."""
    with patch(DAO_GET) as lookup:
        with pytest.raises(ToolError):
            await _call(mcp_server, {"dashboard_id": 1, **operations})
    lookup.assert_not_called()


@pytest.mark.asyncio
@pytest.mark.parametrize("position_json", ["[]", "null", '{"ROOT_ID": 1}'])
async def test_malformed_layout_is_not_replaced(
    mcp_server: FastMCP, position_json: str
) -> None:
    """Corrupt layouts are rejected rather than discarded or traversed."""
    dashboard = _mock_dashboard()
    dashboard.position_json = position_json
    with (
        patch(DAO_GET, return_value=dashboard),
        patch("superset.extensions.db.session") as session,
    ):
        data = await _call(
            mcp_server, {"dashboard_id": 1, "add": [{"component_type": "divider"}]}
        )
    assert "malformed layout" in data["error"]
    assert dashboard.position_json == position_json
    session.commit.assert_not_called()


@pytest.mark.asyncio
async def test_failed_batch_does_not_save_partial_updates(mcp_server: FastMCP) -> None:
    """A failed add must not persist earlier valid updates and removals."""
    dashboard = _mock_dashboard(layout=_grid_layout_with_existing_components())
    before = dashboard.position_json
    with (
        patch(DAO_GET, return_value=dashboard),
        patch("superset.extensions.db.session") as session,
    ):
        data = await _call(
            mcp_server,
            {
                "dashboard_id": 1,
                "update": [{"id": "MARKDOWN-existing1", "code": "changed"}],
                "remove": ["HEADER-existing1"],
                "add": [{"component_type": "divider", "target_tab": "missing"}],
            },
        )
    assert data["error"]
    assert dashboard.position_json == before
    session.commit.assert_not_called()


@pytest.mark.asyncio
@pytest.mark.parametrize("operation", ["update", "remove"])
async def test_reserved_title_and_charts_cannot_be_mutated(
    mcp_server: FastMCP, operation: str
) -> None:
    """Only text tiles, not dashboard title metadata or charts, are editable."""
    layout = _grid_layout_with_existing_components()
    layout["HEADER_ID"] = {
        "id": "HEADER_ID",
        "type": "HEADER",
        "meta": {"text": "Title"},
    }
    layout["CHART-1"] = {"id": "CHART-1", "type": "CHART", "meta": {"chartId": 7}}
    layout["ROW-existing1"]["children"].append("CHART-1")
    dashboard = _mock_dashboard(layout=layout, chart_ids=[7])
    before = dashboard.position_json
    with (
        patch(DAO_GET, return_value=dashboard),
        patch("superset.extensions.db.session") as session,
    ):
        for component_id in ("HEADER_ID", "CHART-1"):
            payload: list[dict[str, str]] | list[str]
            if operation == "update":
                payload = [{"id": component_id, "text": "changed"}]
            else:
                payload = [component_id]
            data = await _call(mcp_server, {"dashboard_id": 1, operation: payload})
            assert data["error"]
    assert dashboard.position_json == before
    session.commit.assert_not_called()


@pytest.mark.asyncio
@pytest.mark.parametrize("target_tab", [None, "TAB-a", "Overview"])
async def test_markdown_tab_placement_rebuilds_full_ancestry(
    mcp_server: FastMCP, target_tab: str | None
) -> None:
    """Default and explicit tab placement produce filter-scope parent chains."""
    dashboard = _mock_dashboard(layout=_tabbed_layout())
    with (
        patch(DAO_GET, return_value=dashboard),
        patch("superset.extensions.db.session"),
    ):
        data = await _call(
            mcp_server,
            {
                "dashboard_id": 1,
                "add": [
                    {
                        "component_type": "markdown",
                        "code": "text",
                        "target_tab": target_tab,
                    }
                ],
            },
        )
    assert data["error"] is None
    layout = json.loads(dashboard.position_json)
    node = layout[data["added_component_ids"][0]]
    row_id = layout["TAB-a"]["children"][0]
    assert node["parents"] == ["ROOT_ID", "TABS-1", "TAB-a", row_id]
    assert layout["ROOT_ID"]["children"] == ["TABS-1"]


@pytest.mark.asyncio
async def test_batch_preserves_charts_metadata_and_markdown_source(
    mcp_server: FastMCP,
) -> None:
    """Layout edits preserve non-target nodes, associated charts, and filters."""
    layout = _grid_layout_with_existing_components()
    layout["CHART-1"] = {
        "id": "CHART-1",
        "type": "CHART",
        "children": [],
        "meta": {"chartId": 7, "width": 4, "height": 50},
        "parents": ["ROOT_ID", "GRID_ID", "ROW-existing1"],
    }
    layout["ROW-existing1"]["children"].append("CHART-1")
    dashboard = _mock_dashboard(layout=layout, chart_ids=[7])
    dashboard.json_metadata = '{"native_filter_configuration": [{"id": "filter-1"}]}'
    before_metadata, before_slices = dashboard.json_metadata, dashboard.slices
    source = "## Notes\n\n<div>**bold** & [link](https://example.com)</div>"
    with (
        patch(DAO_GET, return_value=dashboard),
        patch("superset.extensions.db.session") as session,
    ):
        data = await _call(
            mcp_server,
            {
                "dashboard_id": 1,
                "remove": ["MARKDOWN-existing1"],
                "update": [{"id": "HEADER-existing1", "text": "Revised"}],
                "add": [{"component_type": "markdown", "code": source}],
            },
        )
    assert data["error"] is None
    saved = json.loads(dashboard.position_json)
    assert saved["CHART-1"] == layout["CHART-1"]
    assert saved["ROW-existing1"]["children"] == ["CHART-1"]
    assert saved[data["added_component_ids"][0]]["meta"]["code"] == source
    assert dashboard.slices is before_slices
    assert dashboard.json_metadata == before_metadata
    session.commit.assert_called_once()


@pytest.mark.asyncio
@pytest.mark.parametrize("failure", ["commit", "refresh"])
async def test_database_failure_reports_commit_outcome(
    mcp_server: FastMCP, failure: str
) -> None:
    """Rollback failed commits; a refresh failure must not invite duplicate adds."""
    dashboard = _mock_dashboard()
    with (
        patch(DAO_GET, return_value=dashboard),
        patch("superset.extensions.db.session") as session,
    ):

        def expire_and_fail(*args: object) -> None:
            """Simulate inaccessible ORM attributes after a failed refresh."""
            if failure == "refresh":
                type(dashboard).id = PropertyMock(
                    side_effect=SQLAlchemyError("expired")
                )
                type(dashboard).slug = PropertyMock(
                    side_effect=SQLAlchemyError("expired")
                )
            raise SQLAlchemyError("database error")

        getattr(session, failure).side_effect = expire_and_fail
        data = await _call(
            mcp_server,
            {
                "dashboard_id": 1,
                "add": [{"component_type": "divider"}],
            },
        )
    if failure == "commit":
        assert data["error"]
        assert not data["added_component_ids"]
        session.rollback.assert_called_once()
    else:
        assert data["error"] is None
        assert len(data["added_component_ids"]) == 1
        session.rollback.assert_not_called()
