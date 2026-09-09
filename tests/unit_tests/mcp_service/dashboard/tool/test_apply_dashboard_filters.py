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
Unit tests for the apply_dashboard_filters MCP tool.

Follows the pattern from test_manage_native_filters.py: tests run through
the async MCP Client, patches are applied at source locations, and auth is
mocked by the autouse ``mock_auth`` fixture in this directory's conftest.

Covers:
- Value resolution per filter type (filter_select, filter_time)
- Filters addressed by display name, by ID, and case-insensitively
- Clearing a selection, including the enableEmptyFilter branch
- Unknown, ambiguous, duplicate, and wrong-type targets -> clear errors
- Unsupported filter types -> clear error
- Dashboard not found and permission denial
- A dataMask round trip: the permalink this tool writes is read back
  through get_dashboard_layout's permalink read path
"""

import logging
from typing import Any
from unittest.mock import Mock, patch

import pytest
from fastmcp import Client

from superset.commands.dashboard.exceptions import (
    DashboardAccessDeniedError,
    DashboardNotFoundError,
)
from superset.utils import json

logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

DAO_GET = "superset.daos.dashboard.DashboardDAO.get_by_id_or_slug"
CREATE_PERMALINK = (
    "superset.mcp_service.dashboard.permalink.CreateDashboardPermalinkCommand"
)
GET_PERMALINK = "superset.mcp_service.dashboard.permalink.GetDashboardPermalinkCommand"
CAN_VIEW_DATA_MODEL = (
    "superset.mcp_service.dashboard.permalink.user_can_view_data_model_metadata"
)

SELECT_FILTER: dict[str, Any] = {
    "id": "NATIVE_FILTER-region",
    "type": "NATIVE_FILTER",
    "filterType": "filter_select",
    "name": "Region",
    "scope": {"rootPath": ["ROOT_ID"], "excluded": []},
    "targets": [{"datasetId": 5, "column": {"name": "region"}}],
    "controlValues": {"multiSelect": True, "enableEmptyFilter": False},
    "defaultDataMask": {"filterState": {"value": None}, "extraFormData": {}},
}

REQUIRED_SELECT_FILTER: dict[str, Any] = {
    **SELECT_FILTER,
    "id": "NATIVE_FILTER-required",
    "name": "Required Region",
    "controlValues": {"multiSelect": True, "enableEmptyFilter": True},
}

TIME_FILTER: dict[str, Any] = {
    "id": "NATIVE_FILTER-time",
    "type": "NATIVE_FILTER",
    "filterType": "filter_time",
    "name": "Time Range",
    "scope": {"rootPath": ["ROOT_ID"], "excluded": []},
    "targets": [{}],
    "controlValues": {},
    "defaultDataMask": {"filterState": {"value": None}, "extraFormData": {}},
}

RANGE_FILTER: dict[str, Any] = {
    "id": "NATIVE_FILTER-cost",
    "type": "NATIVE_FILTER",
    "filterType": "filter_range",
    "name": "Cost",
    "targets": [{"datasetId": 5, "column": {"name": "cost"}}],
    "controlValues": {},
}


def _mock_dashboard(filters: list[dict[str, Any]] | None = None, id: int = 1) -> Mock:
    """Build a mock dashboard carrying the given native filter config."""
    dashboard = Mock()
    dashboard.id = id
    dashboard.uuid = "8f2ab3c4-0000-4000-8000-000000000001"
    dashboard.dashboard_title = "Test Dashboard"
    dashboard.json_metadata = json.dumps({"native_filter_configuration": filters or []})
    return dashboard


def _mock_permalink_command(captured: dict[str, Any], key: str = "permakey123"):
    """Build a mock CreateDashboardPermalinkCommand capturing its state."""

    def factory(dashboard_id: str, state: dict[str, Any]) -> Mock:
        captured["dashboard_id"] = dashboard_id
        captured["state"] = state
        command = Mock()
        command.run = lambda: key
        return command

    return factory


async def _call(mcp_server: object, request: dict[str, Any]) -> dict[str, Any]:
    """Invoke apply_dashboard_filters via the MCP client, returning its JSON."""
    async with Client(mcp_server) as client:
        result = await client.call_tool("apply_dashboard_filters", {"request": request})
        return json.loads(result.content[0].text)


# ---------------------------------------------------------------------------
# Value resolution per filter type
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_apply_select_values_by_name(mcp_server):
    captured: dict[str, Any] = {}

    with (
        patch(DAO_GET, return_value=_mock_dashboard([SELECT_FILTER])),
        patch(CREATE_PERMALINK, side_effect=_mock_permalink_command(captured)),
    ):
        data = await _call(
            mcp_server,
            {
                "dashboard_id": 1,
                "filters": [
                    {"filter_name_or_id": "Region", "values": ["EMEA", "APAC"]}
                ],
            },
        )

    assert data["error"] is None
    assert data["permalink_key"] == "permakey123"
    assert data["dashboard_url"].endswith("/dashboard/p/permakey123/")
    assert data["live_update_pushed"] is False
    assert data["applied_filters"] == [
        {
            "id": "NATIVE_FILTER-region",
            "name": "Region",
            "filter_type": "filter_select",
            "values": ["EMEA", "APAC"],
            "time_range": None,
        }
    ]

    entry = captured["state"]["dataMask"]["NATIVE_FILTER-region"]
    assert entry["extraFormData"] == {
        "filters": [{"col": "region", "op": "IN", "val": ["EMEA", "APAC"]}]
    }
    assert entry["filterState"] == {
        "value": ["EMEA", "APAC"],
        "label": "EMEA, APAC",
    }
    assert entry["id"] == "NATIVE_FILTER-region"
    assert entry["ownState"] == {}


@pytest.mark.asyncio
async def test_apply_time_range(mcp_server):
    captured: dict[str, Any] = {}

    with (
        patch(DAO_GET, return_value=_mock_dashboard([TIME_FILTER])),
        patch(CREATE_PERMALINK, side_effect=_mock_permalink_command(captured)),
    ):
        data = await _call(
            mcp_server,
            {
                "dashboard_id": 1,
                "filters": [
                    {"filter_name_or_id": "Time Range", "time_range": "Last month"}
                ],
            },
        )

    assert data["error"] is None
    assert data["applied_filters"][0]["time_range"] == "Last month"
    assert data["applied_filters"][0]["values"] is None

    entry = captured["state"]["dataMask"]["NATIVE_FILTER-time"]
    assert entry["extraFormData"] == {"time_range": "Last month"}
    assert entry["filterState"] == {"value": "Last month"}


@pytest.mark.asyncio
async def test_no_filter_time_range_clears_the_filter(mcp_server):
    captured: dict[str, Any] = {}

    with (
        patch(DAO_GET, return_value=_mock_dashboard([TIME_FILTER])),
        patch(CREATE_PERMALINK, side_effect=_mock_permalink_command(captured)),
    ):
        data = await _call(
            mcp_server,
            {
                "dashboard_id": 1,
                "filters": [
                    {"filter_name_or_id": "Time Range", "time_range": "No filter"}
                ],
            },
        )

    assert data["error"] is None
    entry = captured["state"]["dataMask"]["NATIVE_FILTER-time"]
    assert entry["extraFormData"] == {}
    assert entry["filterState"] == {"value": None}


@pytest.mark.asyncio
async def test_empty_values_clear_an_optional_select(mcp_server):
    captured: dict[str, Any] = {}

    with (
        patch(DAO_GET, return_value=_mock_dashboard([SELECT_FILTER])),
        patch(CREATE_PERMALINK, side_effect=_mock_permalink_command(captured)),
    ):
        data = await _call(
            mcp_server,
            {
                "dashboard_id": 1,
                "filters": [{"filter_name_or_id": "Region", "values": []}],
            },
        )

    assert data["error"] is None
    entry = captured["state"]["dataMask"]["NATIVE_FILTER-region"]
    assert entry["extraFormData"] == {}
    assert entry["filterState"] == {"value": None}


@pytest.mark.asyncio
async def test_empty_values_on_required_select_block_all_rows(mcp_server):
    """A required filter with nothing selected matches nothing, as in the UI."""
    captured: dict[str, Any] = {}

    with (
        patch(DAO_GET, return_value=_mock_dashboard([REQUIRED_SELECT_FILTER])),
        patch(CREATE_PERMALINK, side_effect=_mock_permalink_command(captured)),
    ):
        data = await _call(
            mcp_server,
            {
                "dashboard_id": 1,
                "filters": [{"filter_name_or_id": "Required Region", "values": []}],
            },
        )

    assert data["error"] is None
    entry = captured["state"]["dataMask"]["NATIVE_FILTER-required"]
    assert entry["extraFormData"] == {
        "adhoc_filters": [
            {
                "expressionType": "SQL",
                "clause": "WHERE",
                "sqlExpression": "1 = 0",
            }
        ]
    }


@pytest.mark.asyncio
async def test_mixed_value_types_are_preserved(mcp_server):
    captured: dict[str, Any] = {}

    with (
        patch(DAO_GET, return_value=_mock_dashboard([SELECT_FILTER])),
        patch(CREATE_PERMALINK, side_effect=_mock_permalink_command(captured)),
    ):
        data = await _call(
            mcp_server,
            {
                "dashboard_id": 1,
                "filters": [
                    {
                        "filter_name_or_id": "Region",
                        "values": ["EMEA", 7, 1.5, True, None],
                    }
                ],
            },
        )

    assert data["error"] is None
    entry = captured["state"]["dataMask"]["NATIVE_FILTER-region"]
    assert entry["extraFormData"]["filters"][0]["val"] == ["EMEA", 7, 1.5, True, None]
    assert entry["filterState"]["label"] == "EMEA, 7, 1.5, TRUE, <NULL>"


# ---------------------------------------------------------------------------
# Targeting
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_filter_addressed_by_id(mcp_server):
    captured: dict[str, Any] = {}

    with (
        patch(DAO_GET, return_value=_mock_dashboard([SELECT_FILTER, TIME_FILTER])),
        patch(CREATE_PERMALINK, side_effect=_mock_permalink_command(captured)),
    ):
        data = await _call(
            mcp_server,
            {
                "dashboard_id": 1,
                "filters": [
                    {
                        "filter_name_or_id": "NATIVE_FILTER-region",
                        "values": ["EMEA"],
                    }
                ],
            },
        )

    assert data["error"] is None
    assert list(captured["state"]["dataMask"]) == ["NATIVE_FILTER-region"]


@pytest.mark.asyncio
async def test_filter_name_match_is_case_insensitive(mcp_server):
    captured: dict[str, Any] = {}

    with (
        patch(DAO_GET, return_value=_mock_dashboard([SELECT_FILTER])),
        patch(CREATE_PERMALINK, side_effect=_mock_permalink_command(captured)),
    ):
        data = await _call(
            mcp_server,
            {
                "dashboard_id": 1,
                "filters": [{"filter_name_or_id": "  region ", "values": ["EMEA"]}],
            },
        )

    assert data["error"] is None
    assert list(captured["state"]["dataMask"]) == ["NATIVE_FILTER-region"]


@pytest.mark.asyncio
async def test_multiple_filters_applied_in_one_call(mcp_server):
    captured: dict[str, Any] = {}

    with (
        patch(DAO_GET, return_value=_mock_dashboard([SELECT_FILTER, TIME_FILTER])),
        patch(CREATE_PERMALINK, side_effect=_mock_permalink_command(captured)),
    ):
        data = await _call(
            mcp_server,
            {
                "dashboard_id": 1,
                "filters": [
                    {"filter_name_or_id": "Region", "values": ["EMEA"]},
                    {"filter_name_or_id": "Time Range", "time_range": "Last week"},
                ],
            },
        )

    assert data["error"] is None
    assert [f["id"] for f in data["applied_filters"]] == [
        "NATIVE_FILTER-region",
        "NATIVE_FILTER-time",
    ]
    assert set(captured["state"]["dataMask"]) == {
        "NATIVE_FILTER-region",
        "NATIVE_FILTER-time",
    }


# ---------------------------------------------------------------------------
# Errors
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_unknown_filter_name_lists_the_available_filters(mcp_server):
    with patch(DAO_GET, return_value=_mock_dashboard([SELECT_FILTER, TIME_FILTER])):
        data = await _call(
            mcp_server,
            {
                "dashboard_id": 1,
                "filters": [{"filter_name_or_id": "Country", "values": ["FR"]}],
            },
        )

    assert data["permalink_key"] is None
    assert "No filter named 'Country'" in data["error"]
    assert "Region (id=NATIVE_FILTER-region" in data["error"]
    assert "Time Range (id=NATIVE_FILTER-time" in data["error"]
    assert data["permission_denied"] is False


@pytest.mark.asyncio
async def test_ambiguous_filter_name_asks_for_an_id(mcp_server):
    duplicate = {**SELECT_FILTER, "id": "NATIVE_FILTER-region2"}

    with patch(DAO_GET, return_value=_mock_dashboard([SELECT_FILTER, duplicate])):
        data = await _call(
            mcp_server,
            {
                "dashboard_id": 1,
                "filters": [{"filter_name_or_id": "Region", "values": ["EMEA"]}],
            },
        )

    assert "matches more than one filter" in data["error"]
    assert "NATIVE_FILTER-region" in data["error"]
    assert "NATIVE_FILTER-region2" in data["error"]


@pytest.mark.asyncio
async def test_exact_id_match_wins_over_a_name_collision(mcp_server):
    """A filter named after another filter's ID cannot shadow that filter."""
    captured: dict[str, Any] = {}
    decoy = {
        **SELECT_FILTER,
        "id": "NATIVE_FILTER-decoy",
        "name": "NATIVE_FILTER-region",
    }

    with (
        patch(DAO_GET, return_value=_mock_dashboard([SELECT_FILTER, decoy])),
        patch(CREATE_PERMALINK, side_effect=_mock_permalink_command(captured)),
    ):
        data = await _call(
            mcp_server,
            {
                "dashboard_id": 1,
                "filters": [
                    {
                        "filter_name_or_id": "NATIVE_FILTER-region",
                        "values": ["EMEA"],
                    }
                ],
            },
        )

    assert data["error"] is None
    assert list(captured["state"]["dataMask"]) == ["NATIVE_FILTER-region"]


@pytest.mark.asyncio
async def test_values_on_a_time_filter_is_rejected(mcp_server):
    with patch(DAO_GET, return_value=_mock_dashboard([TIME_FILTER])):
        data = await _call(
            mcp_server,
            {
                "dashboard_id": 1,
                "filters": [{"filter_name_or_id": "Time Range", "values": ["x"]}],
            },
        )

    assert "is a filter_time filter" in data["error"]
    assert "provide 'time_range'" in data["error"]


@pytest.mark.asyncio
async def test_time_range_on_a_select_filter_is_rejected(mcp_server):
    with patch(DAO_GET, return_value=_mock_dashboard([SELECT_FILTER])):
        data = await _call(
            mcp_server,
            {
                "dashboard_id": 1,
                "filters": [{"filter_name_or_id": "Region", "time_range": "Last week"}],
            },
        )

    assert "is a filter_select filter" in data["error"]
    assert "provide 'values'" in data["error"]


@pytest.mark.asyncio
async def test_unsupported_filter_type_is_rejected(mcp_server):
    with patch(DAO_GET, return_value=_mock_dashboard([RANGE_FILTER])):
        data = await _call(
            mcp_server,
            {
                "dashboard_id": 1,
                "filters": [{"filter_name_or_id": "Cost", "values": [1, 2]}],
            },
        )

    assert "has type 'filter_range'" in data["error"]
    assert "filter_select, filter_time" in data["error"]


@pytest.mark.asyncio
async def test_duplicate_target_is_rejected(mcp_server):
    with patch(DAO_GET, return_value=_mock_dashboard([SELECT_FILTER])):
        data = await _call(
            mcp_server,
            {
                "dashboard_id": 1,
                "filters": [
                    {"filter_name_or_id": "Region", "values": ["EMEA"]},
                    {"filter_name_or_id": "NATIVE_FILTER-region", "values": ["APAC"]},
                ],
            },
        )

    assert "given a value more than once" in data["error"]


@pytest.mark.asyncio
async def test_both_values_and_time_range_is_rejected(mcp_server):
    with patch(DAO_GET, return_value=_mock_dashboard([SELECT_FILTER])):
        with pytest.raises(Exception, match="exactly one of values"):
            await _call(
                mcp_server,
                {
                    "dashboard_id": 1,
                    "filters": [
                        {
                            "filter_name_or_id": "Region",
                            "values": ["EMEA"],
                            "time_range": "Last week",
                        }
                    ],
                },
            )


@pytest.mark.asyncio
async def test_neither_values_nor_time_range_is_rejected(mcp_server):
    with patch(DAO_GET, return_value=_mock_dashboard([SELECT_FILTER])):
        with pytest.raises(Exception, match="exactly one of values"):
            await _call(
                mcp_server,
                {
                    "dashboard_id": 1,
                    "filters": [{"filter_name_or_id": "Region"}],
                },
            )


@pytest.mark.asyncio
async def test_dashboard_without_filters_reports_so(mcp_server):
    with patch(DAO_GET, return_value=_mock_dashboard([])):
        data = await _call(
            mcp_server,
            {
                "dashboard_id": 1,
                "filters": [{"filter_name_or_id": "Region", "values": ["EMEA"]}],
            },
        )

    assert "This dashboard has no native filters." in data["error"]


# ---------------------------------------------------------------------------
# Not found / forbidden
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_dashboard_not_found(mcp_server):
    with patch(DAO_GET, side_effect=DashboardNotFoundError):
        data = await _call(
            mcp_server,
            {
                "dashboard_id": 42,
                "filters": [{"filter_name_or_id": "Region", "values": ["EMEA"]}],
            },
        )

    assert "Dashboard with ID 42 not found" in data["error"]
    assert data["permission_denied"] is False


@pytest.mark.asyncio
async def test_permission_denied(mcp_server):
    with patch(DAO_GET, side_effect=DashboardAccessDeniedError):
        data = await _call(
            mcp_server,
            {
                "dashboard_id": 1,
                "filters": [{"filter_name_or_id": "Region", "values": ["EMEA"]}],
            },
        )

    assert data["permission_denied"] is True
    assert "permission" in data["error"]
    assert data["permalink_key"] is None


@pytest.mark.asyncio
async def test_permission_is_checked_before_filter_names_are_read(mcp_server):
    """A caller without access learns nothing about the dashboard's filters."""
    with patch(DAO_GET, side_effect=DashboardAccessDeniedError):
        data = await _call(
            mcp_server,
            {
                "dashboard_id": 1,
                "filters": [{"filter_name_or_id": "Region", "values": ["EMEA"]}],
            },
        )

    assert "NATIVE_FILTER" not in data["error"]


# ---------------------------------------------------------------------------
# dataMask round trip through get_dashboard_layout's permalink read path
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_data_mask_round_trips_through_get_dashboard_layout(mcp_server):
    """The permalink this tool writes is readable by get_dashboard_layout."""
    captured: dict[str, Any] = {}
    dashboard = _mock_dashboard([SELECT_FILTER, TIME_FILTER])

    with (
        patch(DAO_GET, return_value=dashboard),
        patch(CREATE_PERMALINK, side_effect=_mock_permalink_command(captured)),
    ):
        applied = await _call(
            mcp_server,
            {
                "dashboard_id": 1,
                "filters": [
                    {"filter_name_or_id": "Region", "values": ["EMEA"]},
                    {"filter_name_or_id": "Time Range", "time_range": "Last month"},
                ],
            },
        )

    key = applied["permalink_key"]
    stored_state = captured["state"]

    # Serve the stored value back the way GetDashboardPermalinkCommand would,
    # keyed on the dashboard UUID CreateDashboardPermalinkCommand records.
    permalink_value = {"dashboardId": str(dashboard.uuid), "state": stored_state}
    layout_dashboard = Mock()
    layout_dashboard.id = 1
    layout_dashboard.uuid = str(dashboard.uuid)
    layout_dashboard.dashboard_title = "Test Dashboard"
    layout_dashboard.position_json = None
    layout_dashboard.slices = []

    get_command = Mock()
    get_command.run = lambda: permalink_value

    with (
        patch(GET_PERMALINK, return_value=get_command),
        patch(CAN_VIEW_DATA_MODEL, return_value=True),
        patch(
            "superset.daos.dashboard.DashboardDAO.find_by_id",
            return_value=layout_dashboard,
        ),
    ):
        async with Client(mcp_server) as client:
            result = await client.call_tool(
                "get_dashboard_layout", {"request": {"permalink_key": key}}
            )
            layout = json.loads(result.content[0].text)

    assert layout["is_permalink_state"] is True
    assert layout["permalink_key"] == key
    round_tripped = layout["filter_state"]["dataMask"]
    assert round_tripped["NATIVE_FILTER-region"]["filterState"]["value"] == ["EMEA"]
    assert round_tripped["NATIVE_FILTER-region"]["extraFormData"] == {
        "filters": [{"col": "region", "op": "IN", "val": ["EMEA"]}]
    }
    assert round_tripped["NATIVE_FILTER-time"]["extraFormData"] == {
        "time_range": "Last month"
    }

    # A caller who may not see data-model metadata gets the same permalink
    # with its dataMask redacted -- the applied values reference dataset
    # columns, so the read path strips them rather than leaking the model.
    with (
        patch(GET_PERMALINK, return_value=get_command),
        patch(CAN_VIEW_DATA_MODEL, return_value=False),
        patch(
            "superset.daos.dashboard.DashboardDAO.find_by_id",
            return_value=layout_dashboard,
        ),
    ):
        async with Client(mcp_server) as client:
            result = await client.call_tool(
                "get_dashboard_layout", {"request": {"permalink_key": key}}
            )
            redacted = json.loads(result.content[0].text)

    assert "dataMask" not in redacted["filter_state"]
