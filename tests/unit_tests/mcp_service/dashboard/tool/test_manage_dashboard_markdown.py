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

from typing import Any
from unittest.mock import Mock, patch

import pytest
from fastmcp import Client

from superset.commands.dashboard.exceptions import DashboardNotFoundError
from superset.exceptions import SupersetSecurityException
from superset.utils import json

DAO_GET = "superset.daos.dashboard.DashboardDAO.get_by_id_or_slug"


def _empty_grid_layout() -> dict[str, Any]:
    return {
        "DASHBOARD_VERSION_KEY": "v2",
        "ROOT_ID": {"type": "ROOT", "id": "ROOT_ID", "children": ["GRID_ID"]},
        "GRID_ID": {"type": "GRID", "id": "GRID_ID", "children": []},
    }


def _grid_layout_with_existing_components() -> dict[str, Any]:
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


async def _call(mcp_server: object, request: dict[str, Any]) -> dict[str, Any]:
    async with Client(mcp_server) as client:
        result = await client.call_tool(
            "manage_dashboard_markdown", {"request": request}
        )
        return json.loads(result.content[0].text)


# ---------------------------------------------------------------------------
# Add
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_add_markdown_creates_new_row(mcp_server):
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
async def test_add_header_placed_directly_under_grid(mcp_server):
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
async def test_add_divider_placed_directly_under_grid(mcp_server):
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
async def test_add_multiple_components_in_request_order(mcp_server):
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
async def test_add_to_target_tab_by_name(mcp_server):
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
async def test_add_target_tab_not_found_lists_available_tabs(mcp_server):
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
async def test_add_target_tab_on_dashboard_without_tabs(mcp_server):
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
async def test_update_markdown_code(mcp_server):
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
async def test_update_header_fields(mcp_server):
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
async def test_update_rejects_field_from_wrong_component_type(mcp_server):
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
async def test_update_unknown_component_id(mcp_server):
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
async def test_duplicate_update_ids_rejected(mcp_server):
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
async def test_remove_header(mcp_server):
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
async def test_remove_markdown_prunes_empty_wrapping_row(mcp_server):
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
async def test_remove_unknown_id_rejected(mcp_server):
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
async def test_update_and_remove_conflict_rejected(mcp_server):
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
async def test_malformed_position_json(mcp_server):
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
async def test_dashboard_not_found(mcp_server):
    with patch(DAO_GET, side_effect=DashboardNotFoundError()):
        data = await _call(
            mcp_server,
            {"dashboard_id": 999, "add": [{"component_type": "divider"}]},
        )

    assert data["error"] is not None
    assert data["permission_denied"] is False


@pytest.mark.asyncio
async def test_permission_denied(mcp_server):
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
async def test_at_least_one_operation_required(mcp_server):
    """Request-schema validation happens at the MCP tool-call boundary,
    before the tool body runs, so the client raises ToolError rather than
    returning a JSON error body (mirrors manage_native_filters)."""
    from fastmcp.exceptions import ToolError

    dashboard = _mock_dashboard()

    with patch(DAO_GET, return_value=dashboard):
        with pytest.raises(ToolError, match="At least one operation"):
            await _call(mcp_server, {"dashboard_id": 1})


@pytest.mark.asyncio
async def test_header_text_html_is_sanitized(mcp_server):
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
async def test_header_text_all_html_rejected(mcp_server):
    from fastmcp.exceptions import ToolError

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
