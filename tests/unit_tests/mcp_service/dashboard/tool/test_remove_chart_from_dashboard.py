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
Unit tests for remove_chart_from_dashboard MCP tool.

Follows the same pattern used in test_add_chart_to_existing_dashboard.py:
- Tool flows run through the async MCP Client (not direct function calls)
- Patches applied at source locations (superset.daos.dashboard.*, etc.)
- auth is mocked via the autouse mock_auth fixture

Covers:
- Dashboard not found
- Permission denied (user does not own the dashboard) -> permission_denied=True
- Chart not present in the dashboard
- Simple grid removal (chart directly inside a ROW) with empty-row pruning
- Chart inside a COLUMN (sibling survives; lone chart prunes COLUMN + ROW)
- Tabbed layout where the chart appears under multiple tabs
- json_metadata cleanup (expanded_slices, timed_refresh_immune_slices,
  filter_scopes, default_filters)
"""

import logging
from collections.abc import Generator
from typing import Any
from unittest.mock import Mock, patch

import pytest
from fastmcp import Client

from superset.mcp_service.app import mcp
from superset.mcp_service.dashboard.tool.remove_chart_from_dashboard import (
    _clean_json_metadata,
    _remove_chart_from_layout,
)
from superset.utils import json

logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture
def mcp_server() -> object:
    """Return the FastMCP app instance for use in MCP client tests."""
    return mcp


@pytest.fixture(autouse=True)
def mock_auth() -> Generator[Mock, None, None]:
    """Mock authentication for all tests."""
    with patch("superset.mcp_service.auth.get_user_from_request") as mock_get_user:
        mock_user = Mock()
        mock_user.id = 1
        mock_user.username = "admin"
        mock_get_user.return_value = mock_user
        yield mock_get_user


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _mock_chart(id: int = 10, slice_name: str = "Test Chart") -> Mock:
    """Create a minimal mock Slice object with the given ID and name."""
    chart = Mock()
    chart.id = id
    chart.slice_name = slice_name
    chart.uuid = f"chart-uuid-{id}"
    chart.tags = []
    chart.editors = []
    chart.viz_type = "table"
    chart.datasource_name = None
    chart.description = None
    return chart


def _mock_dashboard(
    id: int = 1,
    title: str = "Sales Dashboard",
    slices: list[Mock] | None = None,
    position_json: str = "{}",
    json_metadata: str | None = None,
) -> Mock:
    """Create a minimal mock Dashboard object."""
    dashboard = Mock()
    dashboard.id = id
    dashboard.dashboard_title = title
    dashboard.slug = f"test-dashboard-{id}"
    dashboard.description = None
    dashboard.published = True
    dashboard.created_on = None
    dashboard.changed_on = None
    dashboard.created_by_name = "test_user"
    dashboard.changed_by_name = "test_user"
    dashboard.uuid = f"dashboard-uuid-{id}"
    dashboard.slices = slices or []
    dashboard.editors = []
    dashboard.tags = []
    dashboard.position_json = position_json
    dashboard.json_metadata = json_metadata
    dashboard.css = None
    dashboard.certified_by = None
    dashboard.certification_details = None
    dashboard.is_managed_externally = False
    dashboard.external_url = None
    return dashboard


def _chart_node(key: str, chart_id: int, parents: list[str]) -> dict[str, Any]:
    """Build a minimal CHART layout node dict for use in test layouts."""
    return {
        "children": [],
        "id": key,
        "meta": {"chartId": chart_id, "height": 50, "width": 4},
        "parents": parents,
        "type": "CHART",
    }


def _simple_grid_layout() -> dict[str, Any]:
    """ROOT > GRID > [ROW-1 > CHART-10, ROW-2 > CHART-20]."""
    return {
        "DASHBOARD_VERSION_KEY": "v2",
        "ROOT_ID": {"children": ["GRID_ID"], "id": "ROOT_ID", "type": "ROOT"},
        "GRID_ID": {
            "children": ["ROW-1", "ROW-2"],
            "id": "GRID_ID",
            "parents": ["ROOT_ID"],
            "type": "GRID",
        },
        "ROW-1": {
            "children": ["CHART-aaa"],
            "id": "ROW-1",
            "meta": {},
            "parents": ["ROOT_ID", "GRID_ID"],
            "type": "ROW",
        },
        "CHART-aaa": _chart_node("CHART-aaa", 10, ["ROOT_ID", "GRID_ID", "ROW-1"]),
        "ROW-2": {
            "children": ["CHART-bbb"],
            "id": "ROW-2",
            "meta": {},
            "parents": ["ROOT_ID", "GRID_ID"],
            "type": "ROW",
        },
        "CHART-bbb": _chart_node("CHART-bbb", 20, ["ROOT_ID", "GRID_ID", "ROW-2"]),
    }


def _column_layout(column_children: list[tuple[str, int]]) -> dict[str, Any]:
    """ROOT > GRID > ROW-1 > COLUMN-1 > [charts]."""
    layout = {
        "DASHBOARD_VERSION_KEY": "v2",
        "ROOT_ID": {"children": ["GRID_ID"], "id": "ROOT_ID", "type": "ROOT"},
        "GRID_ID": {
            "children": ["ROW-1"],
            "id": "GRID_ID",
            "parents": ["ROOT_ID"],
            "type": "GRID",
        },
        "ROW-1": {
            "children": ["COLUMN-1"],
            "id": "ROW-1",
            "meta": {},
            "parents": ["ROOT_ID", "GRID_ID"],
            "type": "ROW",
        },
        "COLUMN-1": {
            "children": [key for key, _ in column_children],
            "id": "COLUMN-1",
            "meta": {},
            "parents": ["ROOT_ID", "GRID_ID", "ROW-1"],
            "type": "COLUMN",
        },
    }
    for key, chart_id in column_children:
        layout[key] = _chart_node(
            key, chart_id, ["ROOT_ID", "GRID_ID", "ROW-1", "COLUMN-1"]
        )
    return layout


def _tabbed_layout() -> dict[str, Any]:
    """ROOT > TABS > [TAB-1 > ROW-1 > CHART(10), TAB-2 > ROW-2 > CHART(10)]."""
    return {
        "DASHBOARD_VERSION_KEY": "v2",
        "ROOT_ID": {"children": ["TABS-1"], "id": "ROOT_ID", "type": "ROOT"},
        "TABS-1": {
            "children": ["TAB-1", "TAB-2"],
            "id": "TABS-1",
            "meta": {},
            "parents": ["ROOT_ID"],
            "type": "TABS",
        },
        "TAB-1": {
            "children": ["ROW-1"],
            "id": "TAB-1",
            "meta": {"text": "First"},
            "parents": ["ROOT_ID", "TABS-1"],
            "type": "TAB",
        },
        "ROW-1": {
            "children": ["CHART-aaa"],
            "id": "ROW-1",
            "meta": {},
            "parents": ["ROOT_ID", "TABS-1", "TAB-1"],
            "type": "ROW",
        },
        "CHART-aaa": _chart_node(
            "CHART-aaa", 10, ["ROOT_ID", "TABS-1", "TAB-1", "ROW-1"]
        ),
        "TAB-2": {
            "children": ["ROW-2"],
            "id": "TAB-2",
            "meta": {"text": "Second"},
            "parents": ["ROOT_ID", "TABS-1"],
            "type": "TAB",
        },
        "ROW-2": {
            "children": ["CHART-ccc", "CHART-bbb"],
            "id": "ROW-2",
            "meta": {},
            "parents": ["ROOT_ID", "TABS-1", "TAB-2"],
            "type": "ROW",
        },
        "CHART-ccc": _chart_node(
            "CHART-ccc", 10, ["ROOT_ID", "TABS-1", "TAB-2", "ROW-2"]
        ),
        "CHART-bbb": _chart_node(
            "CHART-bbb", 20, ["ROOT_ID", "TABS-1", "TAB-2", "ROW-2"]
        ),
    }


async def _call_remove(
    mcp_server: object, dashboard_id: int = 1, chart_id: int = 10
) -> dict[str, Any]:
    """Call remove_chart_from_dashboard via MCP client; return structured content."""
    async with Client(mcp_server) as client:
        result = await client.call_tool(
            "remove_chart_from_dashboard",
            {"request": {"dashboard_id": dashboard_id, "chart_id": chart_id}},
        )
    return result.structured_content


# ---------------------------------------------------------------------------
# Error-path tests
# ---------------------------------------------------------------------------


@patch("superset.daos.dashboard.DashboardDAO.find_by_id")
@pytest.mark.asyncio
async def test_dashboard_not_found(mock_find_by_id: Mock, mcp_server: object) -> None:
    """Returns a clear error when the target dashboard does not exist."""
    mock_find_by_id.return_value = None

    content = await _call_remove(mcp_server, dashboard_id=999)

    assert content["dashboard"] is None
    assert content["dashboard_url"] is None
    assert content["permission_denied"] is False
    assert "not found" in (content["error"] or "").lower()


@patch("superset.security_manager.raise_for_editorship")
@patch("superset.daos.dashboard.DashboardDAO.find_by_id")
@pytest.mark.asyncio
async def test_permission_denied(
    mock_find_by_id: Mock, mock_raise_for_editorship: Mock, mcp_server: object
) -> None:
    """Returns permission_denied=True when the user cannot edit the dashboard."""
    from superset.errors import ErrorLevel, SupersetError, SupersetErrorType
    from superset.exceptions import SupersetSecurityException

    dashboard = _mock_dashboard(id=1, title="Sales Dashboard")
    mock_find_by_id.return_value = dashboard
    mock_raise_for_editorship.side_effect = SupersetSecurityException(
        SupersetError(
            message="Changing this Dashboard is forbidden",
            error_type=SupersetErrorType.GENERIC_BACKEND_ERROR,
            level=ErrorLevel.ERROR,
        )
    )

    content = await _call_remove(mcp_server)

    assert content["dashboard"] is None
    assert content["permission_denied"] is True
    assert content["error"] is not None
    assert "Sales Dashboard" in content["error"]
    assert "permission" in content["error"].lower()


@patch("superset.security_manager.raise_for_editorship")
@patch("superset.daos.dashboard.DashboardDAO.find_by_id")
@pytest.mark.asyncio
async def test_chart_not_in_dashboard(
    mock_find_by_id: Mock, mock_raise_for_editorship: Mock, mcp_server: object
) -> None:
    """Returns an error when the chart is in neither layout nor slices."""
    other_chart = _mock_chart(id=20)
    dashboard = _mock_dashboard(
        slices=[other_chart], position_json=json.dumps(_simple_grid_layout())
    )
    mock_find_by_id.return_value = dashboard
    mock_raise_for_editorship.return_value = None

    content = await _call_remove(mcp_server, chart_id=99)

    assert content["dashboard"] is None
    assert content["permission_denied"] is False
    assert "99" in (content["error"] or "")
    assert "not in dashboard" in (content["error"] or "")


# ---------------------------------------------------------------------------
# Success-path tests (layout + slices + json_metadata assertions via the
# captured UpdateDashboardCommand payload)
# ---------------------------------------------------------------------------


@patch("superset.commands.dashboard.update.UpdateDashboardCommand")
@patch("superset.security_manager.raise_for_editorship")
@patch("superset.daos.dashboard.DashboardDAO.find_by_id")
@pytest.mark.asyncio
async def test_simple_grid_removal_prunes_empty_row(
    mock_find_by_id: Mock,
    mock_raise_for_editorship: Mock,
    mock_update_cmd_cls: Mock,
    mcp_server: object,
) -> None:
    """Removing a chart that is the only child of a ROW also prunes the ROW."""
    chart_10 = _mock_chart(id=10)
    chart_20 = _mock_chart(id=20)
    dashboard = _mock_dashboard(
        slices=[chart_10, chart_20],
        position_json=json.dumps(_simple_grid_layout()),
    )
    updated_dashboard = _mock_dashboard(id=1, slices=[chart_20])
    mock_find_by_id.side_effect = [dashboard, updated_dashboard]
    mock_raise_for_editorship.return_value = None

    mock_update_cmd = Mock()
    mock_update_cmd.run.return_value = updated_dashboard
    mock_update_cmd_cls.return_value = mock_update_cmd

    content = await _call_remove(mcp_server, chart_id=10)

    assert content["error"] is None
    assert content["permission_denied"] is False
    assert content["dashboard_url"] is not None
    assert "/dashboard/1/" in content["dashboard_url"]
    assert set(content["removed_layout_keys"]) == {"CHART-aaa", "ROW-1"}

    dashboard_id, update_data = mock_update_cmd_cls.call_args.args
    assert dashboard_id == 1
    new_layout = json.loads(update_data["position_json"])
    assert "CHART-aaa" not in new_layout
    assert "ROW-1" not in new_layout
    assert new_layout["GRID_ID"]["children"] == ["ROW-2"]
    assert "CHART-bbb" in new_layout
    assert update_data["slices"] == [chart_20]
    # No stale metadata references -> json_metadata untouched
    assert "json_metadata" not in update_data


@patch("superset.commands.dashboard.update.UpdateDashboardCommand")
@patch("superset.security_manager.raise_for_editorship")
@patch("superset.daos.dashboard.DashboardDAO.find_by_id")
@pytest.mark.asyncio
async def test_chart_in_column_keeps_sibling(
    mock_find_by_id: Mock,
    mock_raise_for_editorship: Mock,
    mock_update_cmd_cls: Mock,
    mcp_server: object,
) -> None:
    """Removing one chart from a COLUMN keeps the COLUMN and its sibling."""
    chart_10 = _mock_chart(id=10)
    chart_20 = _mock_chart(id=20)
    layout = _column_layout([("CHART-aaa", 10), ("CHART-bbb", 20)])
    dashboard = _mock_dashboard(
        slices=[chart_10, chart_20], position_json=json.dumps(layout)
    )
    updated_dashboard = _mock_dashboard(id=1, slices=[chart_20])
    mock_find_by_id.side_effect = [dashboard, updated_dashboard]
    mock_raise_for_editorship.return_value = None

    mock_update_cmd = Mock()
    mock_update_cmd.run.return_value = updated_dashboard
    mock_update_cmd_cls.return_value = mock_update_cmd

    content = await _call_remove(mcp_server, chart_id=10)

    assert content["error"] is None
    assert content["removed_layout_keys"] == ["CHART-aaa"]

    _, update_data = mock_update_cmd_cls.call_args.args
    new_layout = json.loads(update_data["position_json"])
    assert "CHART-aaa" not in new_layout
    assert new_layout["COLUMN-1"]["children"] == ["CHART-bbb"]
    assert new_layout["ROW-1"]["children"] == ["COLUMN-1"]


@patch("superset.commands.dashboard.update.UpdateDashboardCommand")
@patch("superset.security_manager.raise_for_editorship")
@patch("superset.daos.dashboard.DashboardDAO.find_by_id")
@pytest.mark.asyncio
async def test_lone_chart_in_column_prunes_column_and_row(
    mock_find_by_id: Mock,
    mock_raise_for_editorship: Mock,
    mock_update_cmd_cls: Mock,
    mcp_server: object,
) -> None:
    """Removing the only chart in a COLUMN prunes the COLUMN and its ROW."""
    chart_10 = _mock_chart(id=10)
    layout = _column_layout([("CHART-aaa", 10)])
    dashboard = _mock_dashboard(slices=[chart_10], position_json=json.dumps(layout))
    updated_dashboard = _mock_dashboard(id=1, slices=[])
    mock_find_by_id.side_effect = [dashboard, updated_dashboard]
    mock_raise_for_editorship.return_value = None

    mock_update_cmd = Mock()
    mock_update_cmd.run.return_value = updated_dashboard
    mock_update_cmd_cls.return_value = mock_update_cmd

    content = await _call_remove(mcp_server, chart_id=10)

    assert content["error"] is None
    assert set(content["removed_layout_keys"]) == {"CHART-aaa", "COLUMN-1", "ROW-1"}

    _, update_data = mock_update_cmd_cls.call_args.args
    new_layout = json.loads(update_data["position_json"])
    for key in ("CHART-aaa", "COLUMN-1", "ROW-1"):
        assert key not in new_layout
    assert new_layout["GRID_ID"]["children"] == []
    # GRID/ROOT containers are never pruned
    assert "GRID_ID" in new_layout
    assert "ROOT_ID" in new_layout
    assert update_data["slices"] == []


@patch("superset.commands.dashboard.update.UpdateDashboardCommand")
@patch("superset.security_manager.raise_for_editorship")
@patch("superset.daos.dashboard.DashboardDAO.find_by_id")
@pytest.mark.asyncio
async def test_tabbed_layout_removes_all_occurrences(
    mock_find_by_id: Mock,
    mock_raise_for_editorship: Mock,
    mock_update_cmd_cls: Mock,
    mcp_server: object,
) -> None:
    """A chart appearing under multiple tabs is removed everywhere; tabs stay."""
    chart_10 = _mock_chart(id=10)
    chart_20 = _mock_chart(id=20)
    dashboard = _mock_dashboard(
        slices=[chart_10, chart_20], position_json=json.dumps(_tabbed_layout())
    )
    updated_dashboard = _mock_dashboard(id=1, slices=[chart_20])
    mock_find_by_id.side_effect = [dashboard, updated_dashboard]
    mock_raise_for_editorship.return_value = None

    mock_update_cmd = Mock()
    mock_update_cmd.run.return_value = updated_dashboard
    mock_update_cmd_cls.return_value = mock_update_cmd

    content = await _call_remove(mcp_server, chart_id=10)

    assert content["error"] is None
    # CHART-aaa was ROW-1's only child (ROW-1 pruned); CHART-ccc shared
    # ROW-2 with CHART-bbb (ROW-2 kept).
    assert set(content["removed_layout_keys"]) == {"CHART-aaa", "ROW-1", "CHART-ccc"}

    _, update_data = mock_update_cmd_cls.call_args.args
    new_layout = json.loads(update_data["position_json"])
    for key in ("CHART-aaa", "ROW-1", "CHART-ccc"):
        assert key not in new_layout
    # Tabs are never pruned, even when emptied
    assert "TAB-1" in new_layout
    assert new_layout["TAB-1"]["children"] == []
    assert "TAB-2" in new_layout
    assert new_layout["ROW-2"]["children"] == ["CHART-bbb"]
    assert update_data["slices"] == [chart_20]


@patch("superset.commands.dashboard.update.UpdateDashboardCommand")
@patch("superset.security_manager.raise_for_editorship")
@patch("superset.daos.dashboard.DashboardDAO.find_by_id")
@pytest.mark.asyncio
async def test_json_metadata_cleanup(
    mock_find_by_id: Mock,
    mock_raise_for_editorship: Mock,
    mock_update_cmd_cls: Mock,
    mcp_server: object,
) -> None:
    """Stale chart references are removed from json_metadata on removal."""
    chart_10 = _mock_chart(id=10)
    chart_20 = _mock_chart(id=20)
    metadata = {
        "expanded_slices": {"10": True, "20": True},
        "timed_refresh_immune_slices": [10, 20],
        "filter_scopes": {
            "10": {"col": {"scope": ["ROOT_ID"], "immune": []}},
            "30": {"region": {"scope": ["ROOT_ID"], "immune": [10, 20]}},
        },
        "default_filters": json.dumps({"10": {"col": ["val"]}, "20": {"col": ["v2"]}}),
        "refresh_frequency": 300,
    }
    dashboard = _mock_dashboard(
        slices=[chart_10, chart_20],
        position_json=json.dumps(_simple_grid_layout()),
    )
    # json_metadata is read from the re-fetched dashboard (updated_dashboard)
    # to avoid overwriting concurrent metadata edits.
    updated_dashboard = _mock_dashboard(
        id=1, slices=[chart_20], json_metadata=json.dumps(metadata)
    )
    mock_find_by_id.side_effect = [dashboard, updated_dashboard]
    mock_raise_for_editorship.return_value = None

    mock_update_cmd = Mock()
    mock_update_cmd.run.return_value = updated_dashboard
    mock_update_cmd_cls.return_value = mock_update_cmd

    content = await _call_remove(mcp_server, chart_id=10)

    assert content["error"] is None

    _, update_data = mock_update_cmd_cls.call_args.args
    # json_metadata is NOT routed through UpdateDashboardCommand to avoid
    # set_dash_metadata overwriting slices from layout data.
    assert "json_metadata" not in update_data
    # Cleaned metadata is written directly to updated_dashboard.json_metadata.
    new_metadata = json.loads(updated_dashboard.json_metadata)
    assert new_metadata["expanded_slices"] == {"20": True}
    assert new_metadata["timed_refresh_immune_slices"] == [20]
    assert "10" not in new_metadata["filter_scopes"]
    assert new_metadata["filter_scopes"]["30"]["region"]["immune"] == [20]
    # default_filters entry for chart 10 is removed; entry for 20 survives
    new_default_filters = json.loads(new_metadata["default_filters"])
    assert "10" not in new_default_filters
    assert "20" in new_default_filters
    # Unrelated keys are preserved
    assert new_metadata["refresh_frequency"] == 300
    # "positions" is never injected into json_metadata.
    assert "positions" not in new_metadata


@patch("superset.commands.dashboard.update.UpdateDashboardCommand")
@patch("superset.security_manager.raise_for_editorship")
@patch("superset.daos.dashboard.DashboardDAO.find_by_id")
@pytest.mark.asyncio
async def test_chart_in_slices_but_not_in_layout(
    mock_find_by_id: Mock,
    mock_raise_for_editorship: Mock,
    mock_update_cmd_cls: Mock,
    mcp_server: object,
) -> None:
    """A chart attached to the dashboard but absent from the layout is
    still detached from the slices relationship."""
    chart_10 = _mock_chart(id=10)
    dashboard = _mock_dashboard(slices=[chart_10], position_json="{}")
    updated_dashboard = _mock_dashboard(id=1, slices=[])
    mock_find_by_id.side_effect = [dashboard, updated_dashboard]
    mock_raise_for_editorship.return_value = None

    mock_update_cmd = Mock()
    mock_update_cmd.run.return_value = updated_dashboard
    mock_update_cmd_cls.return_value = mock_update_cmd

    content = await _call_remove(mcp_server, chart_id=10)

    assert content["error"] is None
    assert content["removed_layout_keys"] == []

    _, update_data = mock_update_cmd_cls.call_args.args
    assert update_data["slices"] == []


# ---------------------------------------------------------------------------
# Synchronous helper tests
# ---------------------------------------------------------------------------


def test_remove_chart_from_layout_ignores_other_charts() -> None:
    """Removing a chart ID that is not in the layout is a no-op."""
    layout = _simple_grid_layout()
    removed = _remove_chart_from_layout(layout, 99)
    assert removed == []
    assert layout == _simple_grid_layout()


def test_clean_json_metadata_no_changes_returns_false() -> None:
    """Metadata without references to the chart is left untouched."""
    metadata = {
        "expanded_slices": {"20": True},
        "timed_refresh_immune_slices": [20],
        "color_scheme": "supersetColors",
    }
    assert _clean_json_metadata(metadata, 10) is False
    assert metadata == {
        "expanded_slices": {"20": True},
        "timed_refresh_immune_slices": [20],
        "color_scheme": "supersetColors",
    }


def test_clean_json_metadata_handles_string_ids_in_lists() -> None:
    """timed_refresh_immune_slices entries may be string-typed IDs."""
    metadata = {"timed_refresh_immune_slices": ["10", 20]}
    assert _clean_json_metadata(metadata, 10) is True
    assert metadata["timed_refresh_immune_slices"] == [20]


def test_clean_json_metadata_cleans_default_filters() -> None:
    """default_filters entries for the removed chart are pruned."""
    metadata = {
        "default_filters": json.dumps({"10": {"col": ["v"]}, "20": {"col": ["v2"]}}),
    }
    assert _clean_json_metadata(metadata, 10) is True
    remaining = json.loads(metadata["default_filters"])
    assert "10" not in remaining
    assert "20" in remaining


def test_clean_json_metadata_handles_malformed_sections() -> None:
    """Malformed metadata sections are skipped without raising."""
    metadata = {
        "expanded_slices": "not-a-dict",
        "timed_refresh_immune_slices": {"not": "a-list"},
        "filter_scopes": {"10": "not-a-dict", "30": {"col": "not-a-dict"}},
    }
    assert _clean_json_metadata(metadata, 10) is True  # filter_scopes["10"] removed
    assert "10" not in metadata["filter_scopes"]
    assert metadata["expanded_slices"] == "not-a-dict"


def test_clean_json_metadata_reserializes_dict_default_filters() -> None:
    """When default_filters is a dict it is cleaned and re-serialized to a string."""
    metadata: dict[str, Any] = {
        "default_filters": {"10": {"col": ["v"]}, "20": {"col": ["v2"]}},
    }
    assert _clean_json_metadata(metadata, 10) is True
    # Must come back as a JSON-encoded string, not a dict
    assert isinstance(metadata["default_filters"], str)
    remaining = json.loads(metadata["default_filters"])
    assert "10" not in remaining
    assert "20" in remaining


@patch("superset.security_manager.raise_for_editorship")
@patch("superset.daos.dashboard.DashboardDAO.find_by_id")
@pytest.mark.asyncio
async def test_malformed_position_json_returns_error(
    mock_find_by_id: Mock,
    mock_raise_for_editorship: Mock,
    mcp_server: object,
) -> None:
    """Unparseable position_json returns an error instead of wiping the layout."""
    chart_10 = _mock_chart(id=10)
    dashboard = _mock_dashboard(
        slices=[chart_10],
        position_json="INVALID JSON {{{",
    )
    mock_find_by_id.return_value = dashboard
    mock_raise_for_editorship.return_value = None

    content = await _call_remove(mcp_server, chart_id=10)

    assert content["error"] is not None
    assert "malformed" in content["error"].lower()
    assert content["dashboard"] is None


@patch(
    "superset.commands.dashboard.update.UpdateDashboardCommand.run",
)
@patch("superset.security_manager.raise_for_editorship")
@patch("superset.daos.dashboard.DashboardDAO.find_by_id")
@pytest.mark.asyncio
async def test_forbidden_error_from_command_returns_permission_denied(
    mock_find_by_id: Mock,
    mock_raise_for_editorship: Mock,
    mock_run: Mock,
    mcp_server: object,
) -> None:
    """ForbiddenError raised by UpdateDashboardCommand sets permission_denied=True."""
    from superset.commands.dashboard.exceptions import DashboardForbiddenError

    chart_10 = _mock_chart(id=10)
    dashboard = _mock_dashboard(
        slices=[chart_10],
        position_json=json.dumps(_simple_grid_layout()),
    )
    mock_find_by_id.return_value = dashboard
    mock_raise_for_editorship.return_value = None
    mock_run.side_effect = DashboardForbiddenError()

    content = await _call_remove(mcp_server, chart_id=10)

    assert content["permission_denied"] is True
    assert content["dashboard"] is None
    assert content["error"] is not None
