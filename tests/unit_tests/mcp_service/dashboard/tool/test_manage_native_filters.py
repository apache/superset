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
Unit tests for the manage_native_filters MCP tool.

Follows the pattern from test_add_chart_to_existing_dashboard.py:
- Tests run through the async MCP Client (not direct function calls)
- Patches applied at source locations (superset.daos.dashboard.*, etc.)
- auth is mocked via the autouse mock_auth fixture

Covers:
- Adding a filter_select filter (full config shape, scope translation)
- Adding a filter_time filter (with default time range)
- Updating a filter (merge produces a FULL config, not a delta)
- Removing a filter
- Reordering filters (including incomplete-reorder validation)
- Invalid dataset / column errors
- Dashboard not found
- Permission denied (DashboardForbiddenError)
"""

import logging
from typing import Any
from unittest.mock import Mock, patch

import pytest
from fastmcp import Client

from superset.commands.dashboard.exceptions import DashboardForbiddenError
from superset.mcp_service.app import mcp
from superset.utils import json

logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

DAO_FIND_BY_ID = "superset.daos.dashboard.DashboardDAO.find_by_id"
DATASET_FIND_BY_ID = "superset.daos.dataset.DatasetDAO.find_by_id"
COMMAND_PATH = "superset.commands.dashboard.update.UpdateDashboardNativeFiltersCommand"


@pytest.fixture
def mcp_server() -> object:
    """Return the FastMCP app instance for use in MCP client tests."""
    return mcp


@pytest.fixture(autouse=True)
def mock_auth():
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


EXISTING_SELECT_FILTER = {
    "id": "NATIVE_FILTER-existing1",
    "type": "NATIVE_FILTER",
    "filterType": "filter_select",
    "name": "Region",
    "description": "",
    "scope": {"rootPath": ["ROOT_ID"], "excluded": []},
    "targets": [{"datasetId": 5, "column": {"name": "region"}}],
    "controlValues": {
        "multiSelect": True,
        "defaultToFirstItem": False,
        "enableEmptyFilter": False,
        "searchAllOptions": False,
    },
    "defaultDataMask": {"filterState": {"value": None}, "extraFormData": {}},
    "cascadeParentIds": [],
}

EXISTING_TIME_FILTER = {
    "id": "NATIVE_FILTER-existing2",
    "type": "NATIVE_FILTER",
    "filterType": "filter_time",
    "name": "Time Range",
    "description": "",
    "scope": {"rootPath": ["ROOT_ID"], "excluded": []},
    "targets": [{}],
    "controlValues": {},
    "defaultDataMask": {"filterState": {"value": None}, "extraFormData": {}},
    "cascadeParentIds": [],
}


def _mock_dashboard(
    id: int = 1,
    filters: list[dict[str, Any]] | None = None,
    chart_ids: list[int] | None = None,
) -> Mock:
    dashboard = Mock()
    dashboard.id = id
    dashboard.dashboard_title = "Test Dashboard"
    dashboard.json_metadata = json.dumps({"native_filter_configuration": filters or []})
    slices = []
    for chart_id in chart_ids or [10, 11]:
        slc = Mock()
        slc.id = chart_id
        slices.append(slc)
    dashboard.slices = slices
    return dashboard


def _mock_dataset(columns: list[str] | None = None) -> Mock:
    dataset = Mock()
    dataset.id = 5
    cols = []
    for name in columns or ["region", "country", "ds"]:
        col = Mock()
        col.column_name = name
        cols.append(col)
    dataset.columns = cols
    return dataset


def _mock_command(captured: dict[str, Any]):
    """Build a mock UpdateDashboardNativeFiltersCommand class.

    Captures constructor args and returns the modified configuration
    the way the real DAO would (existing filters with substitutions,
    new filters appended, deletions removed).
    """

    def command_factory(dashboard_id, payload):
        captured["dashboard_id"] = dashboard_id
        captured["payload"] = payload

        command = Mock()

        def run():
            current = captured.get("current_config", [])
            deleted = payload.get("deleted", [])
            modified = payload.get("modified", [])
            result = []
            for conf in current:
                if conf["id"] in deleted:
                    continue
                replacement = next((m for m in modified if m["id"] == conf["id"]), None)
                result.append(replacement if replacement else conf)
            for m in modified:
                if m["id"] not in [c["id"] for c in result]:
                    result.append(m)
            if reordered := list(payload.get("reordered", [])):
                for m in modified:
                    if m["id"] not in reordered:
                        reordered.append(m["id"])
                by_id = {c["id"]: c for c in result}
                result = [by_id[fid] for fid in reordered if fid in by_id]
            captured["result"] = result
            return result

        command.run = run
        return command

    return command_factory


async def _call(mcp_server, request: dict[str, Any]) -> dict[str, Any]:
    async with Client(mcp_server) as client:
        result = await client.call_tool("manage_native_filters", {"request": request})
        return json.loads(result.content[0].text)


# ---------------------------------------------------------------------------
# Add
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_add_filter_select(mcp_server):
    captured: dict = {"current_config": []}
    dashboard = _mock_dashboard(filters=[], chart_ids=[10, 11, 12])

    with (
        patch(DAO_FIND_BY_ID, return_value=dashboard),
        patch(DATASET_FIND_BY_ID, return_value=_mock_dataset()),
        patch(COMMAND_PATH, side_effect=_mock_command(captured)),
    ):
        data = await _call(
            mcp_server,
            {
                "dashboard_id": 1,
                "add": [
                    {
                        "filter_type": "filter_select",
                        "name": "Region",
                        "dataset_id": 5,
                        "column": "region",
                        "multi_select": False,
                        "default_to_first_item": True,
                        "enable_empty_filter": True,
                        "sort_ascending": False,
                        "search_all_options": True,
                        "scope_chart_ids": [10, 11],
                    }
                ],
            },
        )

    assert data["error"] is None
    assert len(data["added_filter_ids"]) == 1
    new_id = data["added_filter_ids"][0]
    assert new_id.startswith("NATIVE_FILTER-")

    payload = captured["payload"]
    assert "deleted" not in payload
    assert "reordered" not in payload
    assert len(payload["modified"]) == 1
    config = payload["modified"][0]
    assert config == {
        "id": new_id,
        "type": "NATIVE_FILTER",
        "filterType": "filter_select",
        "name": "Region",
        "description": "",
        "scope": {"rootPath": ["ROOT_ID"], "excluded": [12]},
        "targets": [{"datasetId": 5, "column": {"name": "region"}}],
        "controlValues": {
            "multiSelect": False,
            "defaultToFirstItem": True,
            "enableEmptyFilter": True,
            "searchAllOptions": True,
            "sortAscending": False,
        },
        "defaultDataMask": {"filterState": {"value": None}, "extraFormData": {}},
        "cascadeParentIds": [],
    }
    assert data["filters"][0]["id"] == new_id
    assert data["filters"][0]["filter_type"] == "filter_select"


@pytest.mark.asyncio
async def test_add_filter_time(mcp_server):
    captured: dict = {"current_config": []}
    dashboard = _mock_dashboard(filters=[])

    with (
        patch(DAO_FIND_BY_ID, return_value=dashboard),
        patch(COMMAND_PATH, side_effect=_mock_command(captured)),
    ):
        data = await _call(
            mcp_server,
            {
                "dashboard_id": 1,
                "add": [
                    {
                        "filter_type": "filter_time",
                        "name": "Time Range",
                        "default_time_range": "Last week",
                    }
                ],
            },
        )

    assert data["error"] is None
    new_id = data["added_filter_ids"][0]
    config = captured["payload"]["modified"][0]
    assert config["id"] == new_id
    assert config["type"] == "NATIVE_FILTER"
    assert config["filterType"] == "filter_time"
    assert config["targets"] == [{}]
    assert config["controlValues"] == {}
    assert config["scope"] == {"rootPath": ["ROOT_ID"], "excluded": []}
    assert config["defaultDataMask"] == {
        "filterState": {"value": "Last week"},
        "extraFormData": {"time_range": "Last week"},
    }


# ---------------------------------------------------------------------------
# Update
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_update_merge_produces_full_config(mcp_server):
    captured: dict = {"current_config": [EXISTING_SELECT_FILTER]}
    dashboard = _mock_dashboard(filters=[EXISTING_SELECT_FILTER])

    with (
        patch(DAO_FIND_BY_ID, return_value=dashboard),
        patch(DATASET_FIND_BY_ID, return_value=_mock_dataset()),
        patch(COMMAND_PATH, side_effect=_mock_command(captured)),
    ):
        data = await _call(
            mcp_server,
            {
                "dashboard_id": 1,
                "update": [
                    {
                        "id": "NATIVE_FILTER-existing1",
                        "name": "Region (updated)",
                        "column": "country",
                        "multi_select": False,
                    }
                ],
            },
        )

    assert data["error"] is None
    assert data["updated_filter_ids"] == ["NATIVE_FILTER-existing1"]

    config = captured["payload"]["modified"][0]
    # Full config substituted, not a delta: untouched fields preserved
    assert config["id"] == "NATIVE_FILTER-existing1"
    assert config["type"] == "NATIVE_FILTER"
    assert config["filterType"] == "filter_select"
    assert config["name"] == "Region (updated)"
    assert config["targets"] == [{"datasetId": 5, "column": {"name": "country"}}]
    assert config["controlValues"]["multiSelect"] is False
    # Untouched control values preserved from the existing config
    assert config["controlValues"]["enableEmptyFilter"] is False
    assert config["controlValues"]["searchAllOptions"] is False
    assert config["defaultDataMask"] == EXISTING_SELECT_FILTER["defaultDataMask"]
    assert config["cascadeParentIds"] == []
    assert config["scope"] == EXISTING_SELECT_FILTER["scope"]


@pytest.mark.asyncio
async def test_update_unknown_filter_id(mcp_server):
    dashboard = _mock_dashboard(filters=[EXISTING_SELECT_FILTER])

    with patch(DAO_FIND_BY_ID, return_value=dashboard):
        data = await _call(
            mcp_server,
            {
                "dashboard_id": 1,
                "update": [{"id": "NATIVE_FILTER-nope", "name": "X"}],
            },
        )

    assert "not found on the" in data["error"]
    assert "NATIVE_FILTER-existing1" in data["error"]


@pytest.mark.asyncio
async def test_update_time_field_on_select_filter_rejected(mcp_server):
    dashboard = _mock_dashboard(filters=[EXISTING_SELECT_FILTER])

    with patch(DAO_FIND_BY_ID, return_value=dashboard):
        data = await _call(
            mcp_server,
            {
                "dashboard_id": 1,
                "update": [
                    {
                        "id": "NATIVE_FILTER-existing1",
                        "default_time_range": "Last week",
                    }
                ],
            },
        )

    assert "default_time_range" in data["error"]
    assert "filter_time" in data["error"]


# ---------------------------------------------------------------------------
# Remove
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_remove_filter(mcp_server):
    captured: dict = {"current_config": [EXISTING_SELECT_FILTER, EXISTING_TIME_FILTER]}
    dashboard = _mock_dashboard(filters=[EXISTING_SELECT_FILTER, EXISTING_TIME_FILTER])

    with (
        patch(DAO_FIND_BY_ID, return_value=dashboard),
        patch(COMMAND_PATH, side_effect=_mock_command(captured)),
    ):
        data = await _call(
            mcp_server,
            {"dashboard_id": 1, "remove": ["NATIVE_FILTER-existing1"]},
        )

    assert data["error"] is None
    assert data["removed_filter_ids"] == ["NATIVE_FILTER-existing1"]
    assert captured["payload"] == {"deleted": ["NATIVE_FILTER-existing1"]}
    assert [f["id"] for f in data["filters"]] == ["NATIVE_FILTER-existing2"]


@pytest.mark.asyncio
async def test_remove_unknown_filter_id(mcp_server):
    dashboard = _mock_dashboard(filters=[EXISTING_SELECT_FILTER])

    with patch(DAO_FIND_BY_ID, return_value=dashboard):
        data = await _call(
            mcp_server,
            {"dashboard_id": 1, "remove": ["NATIVE_FILTER-nope"]},
        )

    assert "do not exist" in data["error"]


# ---------------------------------------------------------------------------
# Reorder
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_reorder_filters(mcp_server):
    captured: dict = {"current_config": [EXISTING_SELECT_FILTER, EXISTING_TIME_FILTER]}
    dashboard = _mock_dashboard(filters=[EXISTING_SELECT_FILTER, EXISTING_TIME_FILTER])

    with (
        patch(DAO_FIND_BY_ID, return_value=dashboard),
        patch(COMMAND_PATH, side_effect=_mock_command(captured)),
    ):
        data = await _call(
            mcp_server,
            {
                "dashboard_id": 1,
                "reorder": [
                    "NATIVE_FILTER-existing2",
                    "NATIVE_FILTER-existing1",
                ],
            },
        )

    assert data["error"] is None
    assert captured["payload"] == {
        "reordered": ["NATIVE_FILTER-existing2", "NATIVE_FILTER-existing1"]
    }
    assert [f["id"] for f in data["filters"]] == [
        "NATIVE_FILTER-existing2",
        "NATIVE_FILTER-existing1",
    ]


@pytest.mark.asyncio
async def test_reorder_must_include_all_filters(mcp_server):
    """The DAO silently drops filters missing from the reordered list,
    so the tool must reject incomplete reorders."""
    dashboard = _mock_dashboard(filters=[EXISTING_SELECT_FILTER, EXISTING_TIME_FILTER])

    with patch(DAO_FIND_BY_ID, return_value=dashboard):
        data = await _call(
            mcp_server,
            {"dashboard_id": 1, "reorder": ["NATIVE_FILTER-existing2"]},
        )

    assert "every remaining filter" in data["error"]
    assert "NATIVE_FILTER-existing1" in data["error"]


# ---------------------------------------------------------------------------
# Validation errors
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_add_with_invalid_dataset(mcp_server):
    dashboard = _mock_dashboard(filters=[])

    with (
        patch(DAO_FIND_BY_ID, return_value=dashboard),
        patch(DATASET_FIND_BY_ID, return_value=None),
    ):
        data = await _call(
            mcp_server,
            {
                "dashboard_id": 1,
                "add": [
                    {
                        "filter_type": "filter_select",
                        "name": "Region",
                        "dataset_id": 999,
                        "column": "region",
                    }
                ],
            },
        )

    assert "Dataset with ID 999 not found" in data["error"]


@pytest.mark.asyncio
async def test_add_with_invalid_column(mcp_server):
    dashboard = _mock_dashboard(filters=[])

    with (
        patch(DAO_FIND_BY_ID, return_value=dashboard),
        patch(DATASET_FIND_BY_ID, return_value=_mock_dataset(["region", "ds"])),
    ):
        data = await _call(
            mcp_server,
            {
                "dashboard_id": 1,
                "add": [
                    {
                        "filter_type": "filter_select",
                        "name": "Region",
                        "dataset_id": 5,
                        "column": "nonexistent",
                    }
                ],
            },
        )

    assert "Column 'nonexistent' not found in dataset 5" in data["error"]
    assert "region" in data["error"]


@pytest.mark.asyncio
async def test_scope_chart_ids_not_on_dashboard(mcp_server):
    dashboard = _mock_dashboard(filters=[], chart_ids=[10, 11])

    with (
        patch(DAO_FIND_BY_ID, return_value=dashboard),
        patch(DATASET_FIND_BY_ID, return_value=_mock_dataset()),
    ):
        data = await _call(
            mcp_server,
            {
                "dashboard_id": 1,
                "add": [
                    {
                        "filter_type": "filter_select",
                        "name": "Region",
                        "dataset_id": 5,
                        "column": "region",
                        "scope_chart_ids": [10, 99],
                    }
                ],
            },
        )

    assert "not on the dashboard" in data["error"]
    assert "99" in data["error"]


# ---------------------------------------------------------------------------
# Not found / forbidden
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_dashboard_not_found(mcp_server):
    with patch(DAO_FIND_BY_ID, return_value=None):
        data = await _call(
            mcp_server,
            {"dashboard_id": 42, "remove": ["NATIVE_FILTER-x"]},
        )

    assert "Dashboard with ID 42 not found" in data["error"]
    assert data["permission_denied"] is False


@pytest.mark.asyncio
async def test_dashboard_forbidden(mcp_server):
    dashboard = _mock_dashboard(filters=[EXISTING_SELECT_FILTER])

    with (
        patch(DAO_FIND_BY_ID, return_value=dashboard),
        patch(COMMAND_PATH, side_effect=DashboardForbiddenError),
    ):
        data = await _call(
            mcp_server,
            {"dashboard_id": 1, "remove": ["NATIVE_FILTER-existing1"]},
        )

    assert data["permission_denied"] is True
    assert "permission" in data["error"]
