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
- Select values checked against the column's data: missing values refused
  with suggestions, case-insensitive matches resolved to the stored value
- Column values read through the column-values API's shared result cache,
  partitioned by effective RLS and never read before the access check
- Unknown, ambiguous, duplicate, and wrong-type targets -> clear errors
- Unsupported filter types -> clear error
- Dashboard not found and permission denial
- A dataMask round trip: the permalink this tool writes is read back
  through get_dashboard_layout's permalink read path
"""

import itertools
from collections.abc import Callable, Iterator
from typing import Any
from unittest.mock import Mock, patch

import pytest
from fastmcp import Client
from fastmcp.exceptions import ToolError
from flask import current_app

from superset.commands.dashboard.exceptions import (
    DashboardAccessDeniedError,
    DashboardNotFoundError,
)
from superset.connectors.sqla.models import SqlaTable
from superset.db_engine_specs.base import TimeGrain
from superset.mcp_service.dashboard.tool.apply_dashboard_filters import (
    _SINGLE_VALUE_EXACT,
    _SINGLE_VALUE_MAXIMUM,
    _SINGLE_VALUE_MINIMUM,
)
from superset.models.core import Database
from superset.utils import json

DAO_GET = "superset.daos.dashboard.DashboardDAO.get_by_id_or_slug"
DATASET_GET = "superset.daos.dataset.DatasetDAO.find_by_id"
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

REQUIRED_RANGE_FILTER: dict[str, Any] = {
    **RANGE_FILTER,
    "id": "NATIVE_FILTER-required-cost",
    "name": "Required Cost",
    "controlValues": {"enableEmptyFilter": True},
}

TIMEGRAIN_FILTER: dict[str, Any] = {
    "id": "NATIVE_FILTER-grain",
    "type": "NATIVE_FILTER",
    "filterType": "filter_timegrain",
    "name": "Granularity",
    "targets": [{"datasetId": 5}],
    "controlValues": {},
}

REQUIRED_TIMEGRAIN_FILTER: dict[str, Any] = {
    **TIMEGRAIN_FILTER,
    "id": "NATIVE_FILTER-required-grain",
    "name": "Required Granularity",
    "controlValues": {"enableEmptyFilter": True},
}

# filter_timecolumn is deliberately not supported by this tool; used to
# exercise the unsupported-type rejection path.
TIMECOLUMN_FILTER: dict[str, Any] = {
    "id": "NATIVE_FILTER-time-column",
    "type": "NATIVE_FILTER",
    "filterType": "filter_timecolumn",
    "name": "Time Column",
    "targets": [{}],
    "controlValues": {},
}


def _mock_dashboard(filters: list[dict[str, Any]] | None = None, id: int = 1) -> Mock:
    """Build a mock dashboard carrying the given native filter config."""
    dashboard = Mock()
    dashboard.id = id
    dashboard.is_managed_externally = False
    dashboard.uuid = "8f2ab3c4-0000-4000-8000-000000000001"
    dashboard.dashboard_title = "Test Dashboard"
    dashboard.json_metadata = json.dumps({"native_filter_configuration": filters or []})
    return dashboard


def _mock_permalink_command(
    captured: dict[str, Any], key: str = "permakey123"
) -> Callable[[str, dict[str, Any]], Mock]:
    """Build a mock CreateDashboardPermalinkCommand capturing its state."""

    def factory(dashboard_id: str, state: dict[str, Any]) -> Mock:
        """Capture the supplied state and return a command stub."""
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
async def test_apply_select_values_by_name(mcp_server: object) -> None:
    """Apply select values by name."""
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
            "range": None,
            "time_grain": None,
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
async def test_apply_time_range(mcp_server: object) -> None:
    """Apply time range."""
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
async def test_no_filter_time_range_clears_the_filter(mcp_server: object) -> None:
    """No filter time range clears the filter."""
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
async def test_required_time_range_cannot_be_cleared(mcp_server: object) -> None:
    """Reject a clear that permalink hydration would replace with the default."""
    required_time_filter = {
        **TIME_FILTER,
        "controlValues": {"enableEmptyFilter": True},
        "defaultDataMask": {
            "filterState": {"value": "Last week"},
            "extraFormData": {"time_range": "Last week"},
        },
    }
    with (
        patch(DAO_GET, return_value=_mock_dashboard([required_time_filter])),
        patch(CREATE_PERMALINK) as create,
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

    assert "requires a time range and cannot be cleared" in data["error"]
    create.assert_not_called()


# ---------------------------------------------------------------------------
# filter_range
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_apply_range_distinct_bounds(mcp_server: object) -> None:
    """Distinct lower/upper bounds produce a >=/<= predicate pair."""
    captured: dict[str, Any] = {}

    with (
        patch(DAO_GET, return_value=_mock_dashboard([RANGE_FILTER])),
        patch(CREATE_PERMALINK, side_effect=_mock_permalink_command(captured)),
    ):
        data = await _call(
            mcp_server,
            {
                "dashboard_id": 1,
                "filters": [{"filter_name_or_id": "Cost", "range": [10, 100]}],
            },
        )

    assert data["error"] is None
    assert data["applied_filters"][0]["range"] == [10, 100]
    entry = captured["state"]["dataMask"]["NATIVE_FILTER-cost"]
    assert entry["extraFormData"] == {
        "filters": [
            {"col": "cost", "op": ">=", "val": 10},
            {"col": "cost", "op": "<=", "val": 100},
        ]
    }
    assert entry["filterState"] == {"value": [10, 100], "label": "10 ≤ x ≤ 100"}


@pytest.mark.asyncio
async def test_apply_range_equal_bounds_produces_equality_predicate(
    mcp_server: object,
) -> None:
    """Equal lower/upper bounds collapse to a single == predicate."""
    captured: dict[str, Any] = {}

    with (
        patch(DAO_GET, return_value=_mock_dashboard([RANGE_FILTER])),
        patch(CREATE_PERMALINK, side_effect=_mock_permalink_command(captured)),
    ):
        data = await _call(
            mcp_server,
            {
                "dashboard_id": 1,
                "filters": [{"filter_name_or_id": "Cost", "range": [50, 50]}],
            },
        )

    assert data["error"] is None
    entry = captured["state"]["dataMask"]["NATIVE_FILTER-cost"]
    assert entry["extraFormData"] == {
        "filters": [{"col": "cost", "op": "==", "val": 50}]
    }
    assert entry["filterState"] == {"value": [50, 50], "label": "x = 50"}


@pytest.mark.asyncio
async def test_apply_range_one_sided_bounds(mcp_server: object) -> None:
    """A null bound on one side produces only the other side's predicate."""
    captured: dict[str, Any] = {}

    with (
        patch(DAO_GET, return_value=_mock_dashboard([RANGE_FILTER])),
        patch(CREATE_PERMALINK, side_effect=_mock_permalink_command(captured)),
    ):
        data = await _call(
            mcp_server,
            {
                "dashboard_id": 1,
                "filters": [{"filter_name_or_id": "Cost", "range": [10, None]}],
            },
        )

    assert data["error"] is None
    entry = captured["state"]["dataMask"]["NATIVE_FILTER-cost"]
    assert entry["extraFormData"] == {
        "filters": [{"col": "cost", "op": ">=", "val": 10}]
    }
    assert entry["filterState"] == {"value": [10, None], "label": "x ≥ 10"}


@pytest.mark.asyncio
async def test_apply_range_lower_unbounded(mcp_server: object) -> None:
    """A null lower bound produces only the upper side's predicate."""
    captured: dict[str, Any] = {}

    with (
        patch(DAO_GET, return_value=_mock_dashboard([RANGE_FILTER])),
        patch(CREATE_PERMALINK, side_effect=_mock_permalink_command(captured)),
    ):
        data = await _call(
            mcp_server,
            {
                "dashboard_id": 1,
                "filters": [{"filter_name_or_id": "Cost", "range": [None, 100]}],
            },
        )

    assert data["error"] is None
    entry = captured["state"]["dataMask"]["NATIVE_FILTER-cost"]
    assert entry["extraFormData"] == {
        "filters": [{"col": "cost", "op": "<=", "val": 100}]
    }
    assert entry["filterState"] == {"value": [None, 100], "label": "x ≤ 100"}


@pytest.mark.asyncio
async def test_null_range_clears_an_optional_range(mcp_server: object) -> None:
    """[null, null] clears an optional range filter."""
    captured: dict[str, Any] = {}

    with (
        patch(DAO_GET, return_value=_mock_dashboard([RANGE_FILTER])),
        patch(CREATE_PERMALINK, side_effect=_mock_permalink_command(captured)),
    ):
        data = await _call(
            mcp_server,
            {
                "dashboard_id": 1,
                "filters": [{"filter_name_or_id": "Cost", "range": [None, None]}],
            },
        )

    assert data["error"] is None
    entry = captured["state"]["dataMask"]["NATIVE_FILTER-cost"]
    assert entry["extraFormData"] == {}
    assert entry["filterState"] == {"value": [None, None], "label": ""}


@pytest.mark.asyncio
async def test_required_range_cannot_be_cleared(mcp_server: object) -> None:
    """A range filter marked enableEmptyFilter rejects a [null, null] clear."""
    with (
        patch(DAO_GET, return_value=_mock_dashboard([REQUIRED_RANGE_FILTER])),
        patch(CREATE_PERMALINK) as create,
    ):
        data = await _call(
            mcp_server,
            {
                "dashboard_id": 1,
                "filters": [
                    {"filter_name_or_id": "Required Cost", "range": [None, None]}
                ],
            },
        )

    assert "requires a value and cannot be cleared" in data["error"]
    create.assert_not_called()


@pytest.mark.asyncio
async def test_range_lower_greater_than_upper_is_rejected(mcp_server: object) -> None:
    """A lower bound greater than the upper bound fails schema validation."""
    with patch(DAO_GET, return_value=_mock_dashboard([RANGE_FILTER])):
        with pytest.raises(ToolError, match="cannot be greater than"):
            await _call(
                mcp_server,
                {
                    "dashboard_id": 1,
                    "filters": [{"filter_name_or_id": "Cost", "range": [100, 10]}],
                },
            )


@pytest.mark.asyncio
async def test_range_on_a_select_filter_is_rejected(mcp_server: object) -> None:
    """Range on a select filter is rejected."""
    with patch(DAO_GET, return_value=_mock_dashboard([SELECT_FILTER])):
        data = await _call(
            mcp_server,
            {
                "dashboard_id": 1,
                "filters": [{"filter_name_or_id": "Region", "range": [1, 2]}],
            },
        )

    assert "is a filter_select filter" in data["error"]
    assert "provide 'values'" in data["error"]


@pytest.mark.asyncio
async def test_values_on_a_range_filter_is_rejected(mcp_server: object) -> None:
    """Values on a range filter is rejected."""
    with patch(DAO_GET, return_value=_mock_dashboard([RANGE_FILTER])):
        data = await _call(
            mcp_server,
            {
                "dashboard_id": 1,
                "filters": [{"filter_name_or_id": "Cost", "values": [1]}],
            },
        )

    assert "is a filter_range filter" in data["error"]
    assert "provide 'range'" in data["error"]


@pytest.mark.asyncio
async def test_range_filter_without_target_column_is_rejected(
    mcp_server: object,
) -> None:
    """A range filter with no target column cannot have a value applied."""
    filter_without_target = {**RANGE_FILTER, "targets": [{}]}

    with patch(DAO_GET, return_value=_mock_dashboard([filter_without_target])):
        data = await _call(
            mcp_server,
            {
                "dashboard_id": 1,
                "filters": [{"filter_name_or_id": "Cost", "range": [10, 100]}],
            },
        )

    assert "has no target column" in data["error"]


@pytest.mark.asyncio
async def test_range_minimum_mode_rejects_an_upper_bound(mcp_server: object) -> None:
    """A single lower-bound range filter cannot be given an upper bound."""
    conf = {
        **RANGE_FILTER,
        "controlValues": {"enableSingleValue": _SINGLE_VALUE_MINIMUM},
    }
    with patch(DAO_GET, return_value=_mock_dashboard([conf])):
        data = await _call(
            mcp_server,
            {
                "dashboard_id": 1,
                "filters": [{"filter_name_or_id": "Cost", "range": [10, 100]}],
            },
        )

    assert "configured for a single lower-bound value" in data["error"]


@pytest.mark.asyncio
async def test_range_minimum_mode_accepts_a_lower_bound(mcp_server: object) -> None:
    """A single lower-bound range filter accepts [value, null]."""
    captured: dict[str, Any] = {}
    conf = {
        **RANGE_FILTER,
        "controlValues": {"enableSingleValue": _SINGLE_VALUE_MINIMUM},
    }

    with (
        patch(DAO_GET, return_value=_mock_dashboard([conf])),
        patch(CREATE_PERMALINK, side_effect=_mock_permalink_command(captured)),
    ):
        data = await _call(
            mcp_server,
            {
                "dashboard_id": 1,
                "filters": [{"filter_name_or_id": "Cost", "range": [10, None]}],
            },
        )

    assert data["error"] is None
    entry = captured["state"]["dataMask"]["NATIVE_FILTER-cost"]
    assert entry["extraFormData"] == {
        "filters": [{"col": "cost", "op": ">=", "val": 10}]
    }


@pytest.mark.asyncio
async def test_range_maximum_mode_rejects_a_lower_bound(mcp_server: object) -> None:
    """A single upper-bound range filter cannot be given a lower bound."""
    conf = {
        **RANGE_FILTER,
        "controlValues": {"enableSingleValue": _SINGLE_VALUE_MAXIMUM},
    }
    with patch(DAO_GET, return_value=_mock_dashboard([conf])):
        data = await _call(
            mcp_server,
            {
                "dashboard_id": 1,
                "filters": [{"filter_name_or_id": "Cost", "range": [10, 100]}],
            },
        )

    assert "configured for a single upper-bound value" in data["error"]


@pytest.mark.asyncio
async def test_range_maximum_mode_accepts_an_upper_bound(mcp_server: object) -> None:
    """A single upper-bound range filter accepts [null, value]."""
    captured: dict[str, Any] = {}
    conf = {
        **RANGE_FILTER,
        "controlValues": {"enableSingleValue": _SINGLE_VALUE_MAXIMUM},
    }

    with (
        patch(DAO_GET, return_value=_mock_dashboard([conf])),
        patch(CREATE_PERMALINK, side_effect=_mock_permalink_command(captured)),
    ):
        data = await _call(
            mcp_server,
            {
                "dashboard_id": 1,
                "filters": [{"filter_name_or_id": "Cost", "range": [None, 100]}],
            },
        )

    assert data["error"] is None
    entry = captured["state"]["dataMask"]["NATIVE_FILTER-cost"]
    assert entry["extraFormData"] == {
        "filters": [{"col": "cost", "op": "<=", "val": 100}]
    }


@pytest.mark.asyncio
async def test_range_exact_mode_rejects_mismatched_bounds(mcp_server: object) -> None:
    """A single exact-value range filter cannot be given distinct bounds."""
    conf = {**RANGE_FILTER, "controlValues": {"enableSingleValue": _SINGLE_VALUE_EXACT}}
    with patch(DAO_GET, return_value=_mock_dashboard([conf])):
        data = await _call(
            mcp_server,
            {
                "dashboard_id": 1,
                "filters": [{"filter_name_or_id": "Cost", "range": [10, 100]}],
            },
        )

    assert "configured for a single exact value" in data["error"]


@pytest.mark.asyncio
async def test_range_exact_mode_accepts_matching_bounds(mcp_server: object) -> None:
    """A single exact-value range filter accepts [value, value]."""
    captured: dict[str, Any] = {}
    conf = {**RANGE_FILTER, "controlValues": {"enableSingleValue": _SINGLE_VALUE_EXACT}}

    with (
        patch(DAO_GET, return_value=_mock_dashboard([conf])),
        patch(CREATE_PERMALINK, side_effect=_mock_permalink_command(captured)),
    ):
        data = await _call(
            mcp_server,
            {
                "dashboard_id": 1,
                "filters": [{"filter_name_or_id": "Cost", "range": [50, 50]}],
            },
        )

    assert data["error"] is None
    entry = captured["state"]["dataMask"]["NATIVE_FILTER-cost"]
    assert entry["extraFormData"] == {
        "filters": [{"col": "cost", "op": "==", "val": 50}]
    }


# ---------------------------------------------------------------------------
# filter_timegrain
# ---------------------------------------------------------------------------


@pytest.fixture
def sqlite_dataset() -> SqlaTable:
    """Expose datasource time-grain options from SQLite without querying it."""
    return SqlaTable(database=Database(sqlalchemy_uri="sqlite://"))


@pytest.mark.asyncio
@pytest.mark.parametrize("allowlist", [None, []])
@pytest.mark.parametrize("grain", ["P1D", "PT1H", "1969-12-28T00:00:00Z/P1W"])
async def test_apply_timegrain(
    mcp_server: object,
    sqlite_dataset: SqlaTable,
    allowlist: list[str] | None,
    grain: str,
) -> None:
    """Without an allowlist, apply only a datasource-supported time grain."""
    conf = {**TIMEGRAIN_FILTER, "time_grains": allowlist}
    captured: dict[str, Any] = {}

    with (
        patch(DAO_GET, return_value=_mock_dashboard([conf])),
        patch(DATASET_GET, return_value=sqlite_dataset) as get_dataset,
        patch(CREATE_PERMALINK, side_effect=_mock_permalink_command(captured)),
    ):
        data = await _call(
            mcp_server,
            {
                "dashboard_id": 1,
                "filters": [
                    {"filter_name_or_id": "Granularity", "time_grain": [grain]}
                ],
            },
        )

    assert data["error"] is None
    assert data["applied_filters"][0]["time_grain"] == [grain]
    entry = captured["state"]["dataMask"]["NATIVE_FILTER-grain"]
    assert entry["extraFormData"] == {"time_grain_sqla": grain}
    assert entry["filterState"] == {
        "value": [grain],
        "label": next(
            g["name"]
            for g in sqlite_dataset.get_time_grains()
            if g["duration"] == grain
        ),
    }
    get_dataset.assert_called_once_with(5)


@pytest.mark.asyncio
async def test_apply_timegrain_custom_engine_option(
    mcp_server: object, sqlite_dataset: SqlaTable
) -> None:
    """Custom engine options are accepted through the datasource property."""
    captured: dict[str, Any] = {}
    with (
        patch(DAO_GET, return_value=_mock_dashboard([TIMEGRAIN_FILTER])),
        patch(DATASET_GET, return_value=sqlite_dataset),
        patch.object(
            sqlite_dataset.database,
            "grains",
            return_value=[
                TimeGrain("Two days", "Two days", "custom expression", "P2D")
            ],
        ),
        patch(CREATE_PERMALINK, side_effect=_mock_permalink_command(captured)),
    ):
        data = await _call(
            mcp_server,
            {
                "dashboard_id": 1,
                "filters": [
                    {"filter_name_or_id": "Granularity", "time_grain": ["P2D"]}
                ],
            },
        )
    assert data["error"] is None
    entry = captured["state"]["dataMask"]["NATIVE_FILTER-grain"]
    assert entry["extraFormData"] == {"time_grain_sqla": "P2D"}
    assert entry["filterState"] == {"value": ["P2D"], "label": "Two days"}


@pytest.mark.asyncio
async def test_empty_timegrain_clears_the_filter(mcp_server: object) -> None:
    """An empty time_grain list clears an optional time grain filter."""
    captured: dict[str, Any] = {}

    with (
        patch(DAO_GET, return_value=_mock_dashboard([TIMEGRAIN_FILTER])),
        patch(CREATE_PERMALINK, side_effect=_mock_permalink_command(captured)),
    ):
        data = await _call(
            mcp_server,
            {
                "dashboard_id": 1,
                "filters": [{"filter_name_or_id": "Granularity", "time_grain": []}],
            },
        )

    assert data["error"] is None
    entry = captured["state"]["dataMask"]["NATIVE_FILTER-grain"]
    assert entry["extraFormData"] == {}
    assert entry["filterState"] == {"value": None}


@pytest.mark.asyncio
async def test_required_timegrain_cannot_be_cleared(mcp_server: object) -> None:
    """A time grain filter marked enableEmptyFilter rejects an empty clear."""
    with (
        patch(DAO_GET, return_value=_mock_dashboard([REQUIRED_TIMEGRAIN_FILTER])),
        patch(CREATE_PERMALINK) as create,
    ):
        data = await _call(
            mcp_server,
            {
                "dashboard_id": 1,
                "filters": [
                    {"filter_name_or_id": "Required Granularity", "time_grain": []}
                ],
            },
        )

    assert "requires a time grain and cannot be cleared" in data["error"]
    create.assert_not_called()


@pytest.mark.asyncio
async def test_invalid_timegrain_value_is_rejected(mcp_server: object) -> None:
    """An empty duration string is not a filter clear and fails validation."""
    with patch(DAO_GET, return_value=_mock_dashboard([TIMEGRAIN_FILTER])):
        with pytest.raises(ToolError, match="time_grain"):
            await _call(
                mcp_server,
                {
                    "dashboard_id": 1,
                    "filters": [
                        {
                            "filter_name_or_id": "Granularity",
                            "time_grain": [""],
                        }
                    ],
                },
            )


@pytest.mark.asyncio
@pytest.mark.parametrize("allowlist", [None, []])
@pytest.mark.parametrize("grain", ["P2D", "PT2H", "garbage", " ", "\t", "P", "PT"])
async def test_timegrain_without_allowlist_rejects_unsupported(
    mcp_server: object,
    sqlite_dataset: SqlaTable,
    allowlist: list[str] | None,
    grain: str,
) -> None:
    """Parseable durations and built-in grains must be supported by the engine."""
    conf = {**TIMEGRAIN_FILTER, "time_grains": allowlist}
    with (
        patch(DAO_GET, return_value=_mock_dashboard([conf])),
        patch(DATASET_GET, return_value=sqlite_dataset),
        patch(CREATE_PERMALINK) as create,
    ):
        data = await _call(
            mcp_server,
            {
                "dashboard_id": 1,
                "filters": [
                    {"filter_name_or_id": "Granularity", "time_grain": [grain]}
                ],
            },
        )
    assert f"Time grain '{grain}' is not supported by dataset 5" in data["error"]
    assert "Granularity" in data["error"]
    supported = [duration for duration, _ in sqlite_dataset.time_grain_sqla if duration]
    assert f"Available time grains: {', '.join(supported)}." in data["error"]
    create.assert_not_called()


@pytest.mark.asyncio
@pytest.mark.parametrize("targets", [[], [{}], [{"datasetId": 999}]])
async def test_timegrain_without_allowlist_rejects_unresolvable_dataset(
    mcp_server: object, targets: list[dict[str, int]]
) -> None:
    """Missing or unknown target datasets cannot validate a time grain."""
    conf = {**TIMEGRAIN_FILTER, "targets": targets}
    with (
        patch(DAO_GET, return_value=_mock_dashboard([conf])),
        patch(DATASET_GET, return_value=None) as get_dataset,
        patch(CREATE_PERMALINK) as create,
    ):
        data = await _call(
            mcp_server,
            {
                "dashboard_id": 1,
                "filters": [
                    {"filter_name_or_id": "Granularity", "time_grain": ["P1D"]}
                ],
            },
        )
    assert "Cannot resolve target dataset" in data["error"]
    assert "Granularity" in data["error"]
    assert "supported time grains cannot be determined" in data["error"]
    if targets and targets[0].get("datasetId") is not None:
        get_dataset.assert_called_once_with(999)
    else:
        get_dataset.assert_not_called()
    create.assert_not_called()


@pytest.mark.asyncio
async def test_timegrain_outside_allowlist_is_rejected(mcp_server: object) -> None:
    """A valid duration cannot bypass the filter's configured options."""
    conf = {**TIMEGRAIN_FILTER, "time_grains": ["P1D", "P1W"]}
    with (
        patch(DAO_GET, return_value=_mock_dashboard([conf])),
        patch(DATASET_GET) as get_dataset,
        patch(CREATE_PERMALINK) as create,
    ):
        data = await _call(
            mcp_server,
            {
                "dashboard_id": 1,
                "filters": [
                    {"filter_name_or_id": "Granularity", "time_grain": ["PT1H"]}
                ],
            },
        )

    assert "not allowed" in data["error"]
    assert "Available time grains: P1D, P1W" in data["error"]
    get_dataset.assert_not_called()
    create.assert_not_called()


@pytest.fixture
def postgres_dataset() -> SqlaTable:
    """Expose datasource time-grain options from Postgres without querying it."""
    return SqlaTable(database=Database(sqlalchemy_uri="postgresql://u:p@h/db"))


@pytest.mark.asyncio
async def test_timegrain_in_allowlist_but_unsupported_by_dataset_is_rejected(
    mcp_server: object, postgres_dataset: SqlaTable
) -> None:
    """An allowlisted grain still has to be one the dataset can produce.

    The allowlist and the dataset's own grains can drift apart (the dataset
    is repointed at another database, or the dashboard is imported), and
    the frontend plugin intersects both sets rather than trusting the
    allowlist alone: PT6H has no grain expression on Postgres even though
    it is a valid TimeGrain value, so a chart would fail to render it.
    """
    conf = {**TIMEGRAIN_FILTER, "time_grains": ["PT6H", "P1D"]}
    with (
        patch(DAO_GET, return_value=_mock_dashboard([conf])),
        patch(DATASET_GET, return_value=postgres_dataset),
        patch(CREATE_PERMALINK) as create,
    ):
        data = await _call(
            mcp_server,
            {
                "dashboard_id": 1,
                "filters": [
                    {"filter_name_or_id": "Granularity", "time_grain": ["PT6H"]}
                ],
            },
        )

    assert "is not supported by dataset 5" in data["error"]
    assert "Granularity" in data["error"]
    create.assert_not_called()


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "allowlist, selection",
    [(["P1D"], ["P1D"]), (["P1D"], [])],
)
async def test_timegrain_allowlist_accepts_dataset_supported_and_clear_values(
    mcp_server: object,
    sqlite_dataset: SqlaTable,
    allowlist: list[str],
    selection: list[str],
) -> None:
    """A grain the allowlist and the dataset both support, or a clear, apply.

    The allowlist narrows which of the dataset's own grains are offered; it
    cannot widen that set to a grain the dataset cannot produce (see
    ``test_timegrain_in_allowlist_but_unsupported_by_dataset_is_rejected``).
    """
    conf = {**TIMEGRAIN_FILTER, "time_grains": allowlist}
    captured: dict[str, Any] = {}
    with (
        patch(DAO_GET, return_value=_mock_dashboard([conf])),
        patch(DATASET_GET, return_value=sqlite_dataset) as get_dataset,
        patch(CREATE_PERMALINK, side_effect=_mock_permalink_command(captured)),
    ):
        data = await _call(
            mcp_server,
            {
                "dashboard_id": 1,
                "filters": [
                    {"filter_name_or_id": "Granularity", "time_grain": selection}
                ],
            },
        )

    assert data["error"] is None
    assert data["applied_filters"][0]["time_grain"] == selection
    entry = captured["state"]["dataMask"]["NATIVE_FILTER-grain"]
    assert entry["extraFormData"] == (
        {"time_grain_sqla": selection[0]} if selection else {}
    )
    expected_state: dict[str, Any] = {"value": selection or None}
    if selection == ["P1D"]:
        expected_state["label"] = "Day"
    assert entry["filterState"] == expected_state
    if selection:
        get_dataset.assert_called_once_with(5)
    else:
        get_dataset.assert_not_called()


@pytest.mark.asyncio
async def test_timegrain_on_a_select_filter_is_rejected(mcp_server: object) -> None:
    """Time grain on a select filter is rejected."""
    with patch(DAO_GET, return_value=_mock_dashboard([SELECT_FILTER])):
        data = await _call(
            mcp_server,
            {
                "dashboard_id": 1,
                "filters": [{"filter_name_or_id": "Region", "time_grain": ["P1D"]}],
            },
        )

    assert "is a filter_select filter" in data["error"]
    assert "provide 'values'" in data["error"]


@pytest.mark.asyncio
async def test_values_on_a_timegrain_filter_is_rejected(mcp_server: object) -> None:
    """Values on a time grain filter is rejected."""
    with patch(DAO_GET, return_value=_mock_dashboard([TIMEGRAIN_FILTER])):
        data = await _call(
            mcp_server,
            {
                "dashboard_id": 1,
                "filters": [{"filter_name_or_id": "Granularity", "values": ["P1D"]}],
            },
        )

    assert "is a filter_timegrain filter" in data["error"]
    assert "provide 'time_grain'" in data["error"]


@pytest.mark.asyncio
async def test_timegrain_filter_created_by_manage_native_filters_accepts_a_grain(
    mcp_server: object, sqlite_dataset: SqlaTable
) -> None:
    """A filter_timegrain filter manage_native_filters creates is usable here.

    Regression test for the two tools disagreeing on target shape:
    ``_timegrain_data_mask`` needs a dataset target to resolve supported
    grains, but manage_native_filters used to create filter_timegrain
    filters with a dataset-less target (``targets: [{}]``), so a filter it
    had just created could never have a value applied to it by this tool.
    """
    create_payload: dict[str, Any] = {}

    def create_command_factory(dashboard_id: int, payload: dict[str, Any]) -> Mock:
        """Capture the manage_native_filters write payload."""
        create_payload["payload"] = payload
        command = Mock()
        command.run = lambda: [payload["modified"][0]]
        return command

    create_dashboard = Mock()
    create_dashboard.id = 1
    create_dashboard.is_managed_externally = False
    create_dashboard.dashboard_title = "Test Dashboard"
    create_dashboard.json_metadata = json.dumps({"native_filter_configuration": []})
    create_dashboard.slices = []

    with (
        patch(
            "superset.daos.dashboard.DashboardDAO.find_by_id",
            return_value=create_dashboard,
        ),
        patch(DATASET_GET, return_value=sqlite_dataset),
        patch(
            "superset.commands.dashboard.update.UpdateDashboardNativeFiltersCommand",
            side_effect=create_command_factory,
        ),
    ):
        async with Client(mcp_server) as client:
            create_result = await client.call_tool(
                "manage_native_filters",
                {
                    "request": {
                        "dashboard_id": 1,
                        "add": [
                            {
                                "filter_type": "filter_timegrain",
                                "name": "Granularity",
                                "dataset_id": 5,
                            }
                        ],
                    }
                },
            )
            create_data = json.loads(create_result.content[0].text)

    assert create_data["error"] is None
    created_conf = create_payload["payload"]["modified"][0]
    assert created_conf["targets"] == [{"datasetId": 5}]

    captured: dict[str, Any] = {}

    with (
        patch(DAO_GET, return_value=_mock_dashboard([created_conf])),
        patch(DATASET_GET, return_value=sqlite_dataset),
        patch(CREATE_PERMALINK, side_effect=_mock_permalink_command(captured)),
    ):
        apply_data = await _call(
            mcp_server,
            {
                "dashboard_id": 1,
                "filters": [
                    {"filter_name_or_id": "Granularity", "time_grain": ["P1D"]}
                ],
            },
        )

    assert apply_data["error"] is None
    entry = captured["state"]["dataMask"][created_conf["id"]]
    assert entry["extraFormData"] == {"time_grain_sqla": "P1D"}


@pytest.mark.asyncio
async def test_empty_values_clear_an_optional_select(mcp_server: object) -> None:
    """Empty values clear an optional select."""
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
async def test_empty_values_on_required_select_block_all_rows(
    mcp_server: object,
) -> None:
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
async def test_mixed_value_types_are_preserved(mcp_server: object) -> None:
    """Mixed value types are preserved."""
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
# Select values checked against the filter column's data
# ---------------------------------------------------------------------------

REGION_VALUES: list[Any] = ["APAC", "EMEA", "North America", "LATAM"]
_DATASET_IDS = itertools.count(1)

# Closing guidance of a rejection that lists candidate values.
RECOVERY = (
    "Tell the user the value was not found. If a listed value plausibly means "
    "what they asked for, name it (or the few that might) and ask whether to "
    "apply it instead of listing every value; otherwise ask which value they "
    "want. Do not report the filter as applied."
)


def _mock_values_dataset(
    values: list[Any],
    search_results: dict[str, list[Any]] | None = None,
) -> Mock:
    """Build a dataset whose column holds ``values``.

    A search returns ``search_results[term]`` when given, otherwise the
    values containing the term case-insensitively, as the real query does.
    """

    def values_for_column(
        column_name: str,
        limit: int,
        denormalize_column: bool = False,
        search: str | None = None,
        **kwargs: Any,
    ) -> list[Any]:
        """Return the stored values, honoring the limit and search term."""
        if search is None:
            return values[:limit]
        if search_results is not None and search in search_results:
            return search_results[search][:limit]
        return [
            value
            for value in values
            if value is not None and search.lower() in str(value).lower()
        ][:limit]

    dataset = Mock()
    dataset.normalize_columns = False
    # Fields the shared column-values cache key is built from.
    dataset.uid = f"{next(_DATASET_IDS)}__table"
    dataset.changed_on = None
    dataset.cache_timeout = None
    dataset.is_rls_supported = False
    dataset.values_for_column = Mock(side_effect=values_for_column)
    return dataset


class _FakeDataCache:
    """A dict-backed stand-in for ``cache_manager.data_cache``."""

    def __init__(self) -> None:
        self.entries: dict[str, Any] = {}
        self.timeouts: dict[str, int] = {}

    def get(self, key: str) -> Any:
        return self.entries.get(key)

    def set(self, key: str, value: Any, timeout: int) -> None:
        self.entries[key] = value
        self.timeouts[key] = timeout


@pytest.fixture(autouse=True)
def data_cache() -> Iterator[_FakeDataCache]:
    """Give every test an empty column-values cache, as the API reads it."""
    from superset.extensions import security_manager

    cache = _FakeDataCache()
    with (
        patch("superset.datasource.api.cache_manager") as manager,
        # The cache key fingerprints the caller's effective RLS; default to none.
        patch.object(security_manager, "get_rls_filters", return_value=[]),
        patch.object(security_manager, "get_guest_rls_filters", return_value=[]),
    ):
        manager.data_cache = cache
        yield cache


async def _apply_region(
    mcp_server: object,
    values: list[Any],
    dataset: Mock | None,
    captured: dict[str, Any],
) -> dict[str, Any]:
    """Apply ``values`` to the Region filter backed by ``dataset``."""
    with (
        patch(DAO_GET, return_value=_mock_dashboard([SELECT_FILTER])),
        patch(DATASET_GET, return_value=dataset),
        patch(CREATE_PERMALINK, side_effect=_mock_permalink_command(captured)),
    ):
        return await _call(
            mcp_server,
            {
                "dashboard_id": 1,
                "filters": [{"filter_name_or_id": "Region", "values": values}],
            },
        )


@pytest.mark.asyncio
async def test_value_missing_from_the_data_is_rejected(mcp_server: object) -> None:
    """A value the column lacks is refused instead of emptying every chart."""
    captured: dict[str, Any] = {}
    dataset = _mock_values_dataset(REGION_VALUES)

    data = await _apply_region(mcp_server, ["Asia Pacific"], dataset, captured)

    assert "state" not in captured
    assert data["permalink_key"] is None
    assert data["dashboard_url"] is None
    assert data["applied_filters"] == []
    assert data["error"] == (
        "Filter 'Region' has no value 'Asia Pacific' in column 'region'. Unknown "
        "selections can produce empty chart results. No filter values were "
        "applied. Available values: 'APAC', 'EMEA', 'LATAM', "
        "'North America' (4 in total). " + RECOVERY
    )
    dataset.raise_for_access.assert_called_once_with()
    dataset.values_for_column.assert_called_once_with(
        column_name="region",
        limit=current_app.config["FILTER_SELECT_ROW_LIMIT"],
        denormalize_column=True,
        array_elements=False,
        search=None,
    )


@pytest.mark.asyncio
async def test_unknown_abbreviation_lists_all_candidates_with_recovery_guidance(
    mcp_server: object,
) -> None:
    """An abbreviation absent from the column lists every candidate to propose."""
    captured: dict[str, Any] = {}
    dataset = _mock_values_dataset(["Asia-Pacific", "EMEA", "North America"])

    data = await _apply_region(mcp_server, ["APAC"], dataset, captured)

    assert "state" not in captured
    assert data["permalink_key"] is None
    assert data["applied_filters"] == []
    assert (
        "Available values: 'Asia-Pacific', 'EMEA', 'North America' (3 in total)."
        in data["error"]
    )
    assert RECOVERY in data["error"]
    assert "Closest matches" not in data["error"]
    assert "offer these values" not in data["error"]


@pytest.mark.asyncio
async def test_mixed_unknown_values_list_candidates_for_values_without_close_matches(
    mcp_server: object,
) -> None:
    """A close match for one rejected value does not hide the list from another."""
    captured: dict[str, Any] = {}
    dataset = _mock_values_dataset(["Asia-Pacific", "EMEA", "North America"])

    data = await _apply_region(mcp_server, ["Emeaa", "APAC"], dataset, captured)

    assert "state" not in captured
    assert data["applied_filters"] == []
    assert "Closest matches for 'Emeaa': 'EMEA'." in data["error"]
    assert (
        "Available values: 'Asia-Pacific', 'EMEA', 'North America' (3 in total)."
        in data["error"]
    )
    assert RECOVERY in data["error"]


@pytest.mark.asyncio
async def test_literal_abbreviation_present_in_column_is_applied_unchanged(
    mcp_server: object,
) -> None:
    """A stored abbreviation applies as sent, never swapped for a longer name."""
    captured: dict[str, Any] = {}
    dataset = _mock_values_dataset(["APAC", "Asia-Pacific", "EMEA"])

    data = await _apply_region(mcp_server, ["APAC"], dataset, captured)

    assert data["error"] is None
    assert data["applied_filters"][0]["values"] == ["APAC"]


@pytest.mark.asyncio
async def test_one_missing_value_blocks_the_whole_request(mcp_server: object) -> None:
    """No permalink is written when any requested value is missing."""
    captured: dict[str, Any] = {}
    dataset = _mock_values_dataset(REGION_VALUES)

    with (
        patch(DAO_GET, return_value=_mock_dashboard([SELECT_FILTER, TIME_FILTER])),
        patch(DATASET_GET, return_value=dataset),
        patch(CREATE_PERMALINK, side_effect=_mock_permalink_command(captured)),
    ):
        data = await _call(
            mcp_server,
            {
                "dashboard_id": 1,
                "filters": [
                    {"filter_name_or_id": "Time Range", "time_range": "Last week"},
                    {"filter_name_or_id": "Region", "values": ["EMEA", "Mars"]},
                ],
            },
        )

    assert "state" not in captured
    assert data["applied_filters"] == []
    assert "has no value 'Mars'" in data["error"]


@pytest.mark.asyncio
@pytest.mark.parametrize(
    ("requested", "suggested"),
    [
        ("North", "'North America'"),
        ("Emeaa", "'EMEA'"),
    ],
)
async def test_missing_value_suggests_close_matches(
    mcp_server: object, requested: str, suggested: str
) -> None:
    """A partial or misspelled value is refused with its likely matches."""
    captured: dict[str, Any] = {}

    data = await _apply_region(
        mcp_server, [requested], _mock_values_dataset(REGION_VALUES), captured
    )

    assert "state" not in captured
    assert f"Closest matches for '{requested}': {suggested}." in data["error"]
    assert "Available values" not in data["error"]


@pytest.mark.asyncio
async def test_case_insensitive_match_applies_the_stored_value(
    mcp_server: object,
) -> None:
    """A value differing only in case or spacing applies the column's spelling."""
    captured: dict[str, Any] = {}

    data = await _apply_region(
        mcp_server,
        ["emea", "  north   AMERICA ", "EMEA"],
        _mock_values_dataset(REGION_VALUES),
        captured,
    )

    assert data["error"] is None
    entry = captured["state"]["dataMask"]["NATIVE_FILTER-region"]
    assert entry["extraFormData"]["filters"] == [
        {"col": "region", "op": "IN", "val": ["EMEA", "North America"]}
    ]
    assert entry["filterState"] == {
        "value": ["EMEA", "North America"],
        "label": "EMEA, North America",
    }
    assert data["applied_filters"][0]["values"] == ["EMEA", "North America"]


@pytest.mark.asyncio
async def test_text_value_matches_a_numeric_column_value(mcp_server: object) -> None:
    """A number sent as text applies the column's numeric value."""
    captured: dict[str, Any] = {}

    data = await _apply_region(
        mcp_server, ["2024"], _mock_values_dataset([2023, 2024]), captured
    )

    assert data["error"] is None
    entry = captured["state"]["dataMask"]["NATIVE_FILTER-region"]
    assert entry["extraFormData"]["filters"][0]["val"] == [2024]


@pytest.mark.asyncio
async def test_case_insensitive_match_must_be_unambiguous(mcp_server: object) -> None:
    """Several values matching ignoring case are offered, not guessed between."""
    captured: dict[str, Any] = {}

    data = await _apply_region(
        mcp_server, ["Apac"], _mock_values_dataset(["APAC", "apac"]), captured
    )

    assert "state" not in captured
    assert "ambiguous" in data["error"]
    assert '"APAC", "apac"' in data["error"]
    assert data["applied_filters"] == []


@pytest.mark.asyncio
@pytest.mark.parametrize("candidates", [[1, "1"], ["1", 1]])
async def test_same_label_with_different_types_is_ambiguous(
    mcp_server: object, candidates: list[Any]
) -> None:
    """Numeric and text values must not collapse into one normalized match."""
    captured: dict[str, Any] = {}

    data = await _apply_region(
        mcp_server, [" 1 "], _mock_values_dataset(candidates), captured
    )

    assert "state" not in captured
    assert data["error"] is not None
    assert data["applied_filters"] == []


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "stored", ["North America", "North  America", "North\tAmerica"]
)
async def test_whitespace_match_beyond_a_truncated_page(
    mcp_server: object, stored: str
) -> None:
    """Searching must tolerate whitespace in both the request and stored value."""
    captured: dict[str, Any] = {}
    dataset = _mock_values_dataset(["APAC", "EMEA", stored])

    with patch.dict(current_app.config, FILTER_SELECT_ROW_LIMIT=2):
        data = await _apply_region(
            mcp_server, ["  north   AMERICA "], dataset, captured
        )

    assert data["error"] is None
    assert data["applied_filters"][0]["values"] == [stored]
    assert dataset.values_for_column.call_args.kwargs["search"] == "north"


@pytest.mark.asyncio
@pytest.mark.parametrize(
    ("requested", "first", "later"),
    [("Apac", "APAC", "apac"), ("north america", "North America", "North  America")],
)
async def test_normalized_first_page_match_checks_for_later_ambiguity(
    mcp_server: object, requested: str, first: str, later: str
) -> None:
    """A near match on an incomplete page does not establish uniqueness."""
    captured: dict[str, Any] = {}
    dataset = _mock_values_dataset([first, "EMEA", later])

    with patch.dict(current_app.config, FILTER_SELECT_ROW_LIMIT=2):
        data = await _apply_region(mcp_server, [requested], dataset, captured)

    assert "state" not in captured
    assert data["error"] is not None
    assert data["applied_filters"] == []
    assert dataset.values_for_column.call_count == 2


@pytest.mark.asyncio
async def test_truncated_search_cannot_establish_normalized_uniqueness(
    mcp_server: object,
) -> None:
    """Even the narrowed page may hide another normalized match."""
    captured: dict[str, Any] = {}
    dataset = _mock_values_dataset(["APAC", "APAC North", "apac"])

    with patch.dict(current_app.config, FILTER_SELECT_ROW_LIMIT=2):
        data = await _apply_region(mcp_server, ["Apac"], dataset, captured)

    assert "state" not in captured
    assert data["error"] is not None
    assert dataset.values_for_column.call_count == 2


@pytest.mark.asyncio
@pytest.mark.parametrize("requested", [1, "1"])
async def test_exact_match_wins_over_same_label_with_different_types(
    mcp_server: object, requested: int | str
) -> None:
    """Exact numeric and text matches retain the requested type."""
    captured: dict[str, Any] = {}
    dataset = _mock_values_dataset([1, "1"])

    with patch.dict(current_app.config, FILTER_SELECT_ROW_LIMIT=2):
        data = await _apply_region(mcp_server, [requested], dataset, captured)

    assert data["error"] is None
    applied = data["applied_filters"][0]["values"][0]
    assert applied == requested
    assert type(applied) is type(requested)
    dataset.values_for_column.assert_called_once()


@pytest.mark.asyncio
async def test_exact_match_beyond_first_page_wins_over_normalized_match(
    mcp_server: object,
) -> None:
    """A later exact spelling takes precedence over the first page's near match."""
    captured: dict[str, Any] = {}
    dataset = _mock_values_dataset(["APAC", "EMEA", "Apac"])

    with patch.dict(current_app.config, FILTER_SELECT_ROW_LIMIT=2):
        data = await _apply_region(mcp_server, ["Apac"], dataset, captured)

    assert data["error"] is None
    assert data["applied_filters"][0]["values"] == ["Apac"]
    assert dataset.values_for_column.call_count == 2


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "stored",
    [
        ["North America"],
        ["North  America"],
        ["North\tAmerica"],
        ["North America", "North  America"],
    ],
)
async def test_truncated_whitespace_matching_with_real_column_query(
    mcp_server: object, tmp_path: Any, stored: list[str]
) -> None:
    """The real containment query finds whitespace variants without guessing."""
    import sqlite3

    from superset.connectors.sqla.models import TableColumn

    path = tmp_path / "regions.db"
    with sqlite3.connect(path) as conn:
        conn.execute("CREATE TABLE sales (region TEXT)")
        conn.executemany(
            "INSERT INTO sales VALUES (?)", [(v,) for v in ["APAC", "EMEA", *stored]]
        )
    dataset = SqlaTable(
        table_name="sales",
        database=Database(database_name="regions", sqlalchemy_uri=f"sqlite:///{path}"),
        columns=[TableColumn(column_name="region", type="TEXT")],
    )
    captured: dict[str, Any] = {}

    with (
        patch.dict(current_app.config, FILTER_SELECT_ROW_LIMIT=2),
        patch.object(SqlaTable, "raise_for_access"),
        patch.object(SqlaTable, "get_sqla_row_level_filters", return_value=[]),
    ):
        data = await _apply_region(
            mcp_server, ["  north   AMERICA "], dataset, captured
        )

    if len(stored) == 1:
        assert data["error"] is None
        assert data["applied_filters"][0]["values"] == stored
    else:
        assert data["error"] is not None
        assert "state" not in captured


@pytest.mark.asyncio
async def test_value_beyond_a_truncated_first_page_is_found_by_search(
    mcp_server: object,
) -> None:
    """Absence from a truncated first page is confirmed by a full-column search."""
    captured: dict[str, Any] = {}
    dataset = _mock_values_dataset(REGION_VALUES + ["Oceania"])

    with patch.dict(current_app.config, FILTER_SELECT_ROW_LIMIT=2):
        data = await _apply_region(mcp_server, ["oceania"], dataset, captured)

    assert data["error"] is None
    entry = captured["state"]["dataMask"]["NATIVE_FILTER-region"]
    assert entry["extraFormData"]["filters"][0]["val"] == ["Oceania"]
    assert dataset.values_for_column.call_args.kwargs["search"] == "ocean"


@pytest.mark.asyncio
async def test_value_missing_beyond_a_truncated_first_page_is_rejected(
    mcp_server: object,
) -> None:
    """A truncated column only claims the values it lists are a sample."""
    captured: dict[str, Any] = {}

    with patch.dict(current_app.config, FILTER_SELECT_ROW_LIMIT=2):
        data = await _apply_region(
            mcp_server, ["Asia Pacific"], _mock_values_dataset(REGION_VALUES), captured
        )

    assert "state" not in captured
    assert "Available values include: 'APAC', 'EMEA'." in data["error"]
    assert "in total" not in data["error"]


@pytest.mark.asyncio
async def test_null_is_checked_only_against_a_complete_column(
    mcp_server: object,
) -> None:
    """NULL is refused when the full column lacks it, and kept when truncated."""
    rejected: dict[str, Any] = {}
    data = await _apply_region(
        mcp_server, [None], _mock_values_dataset(REGION_VALUES), rejected
    )
    assert "has no value null" in data["error"]

    kept: dict[str, Any] = {}
    with patch.dict(current_app.config, FILTER_SELECT_ROW_LIMIT=2):
        data = await _apply_region(
            mcp_server, [None], _mock_values_dataset(REGION_VALUES), kept
        )
    assert data["error"] is None
    assert kept["state"]["dataMask"]["NATIVE_FILTER-region"]["filterState"][
        "value"
    ] == [None]


@pytest.mark.asyncio
async def test_empty_column_rejects_every_value(mcp_server: object) -> None:
    """A column with no values has nothing to offer instead."""
    captured: dict[str, Any] = {}

    data = await _apply_region(mcp_server, ["EMEA"], _mock_values_dataset([]), captured)

    assert "state" not in captured
    assert data["error"].endswith(
        "The column has no values to filter on. Tell the user the value was "
        "not found instead of reporting the filter as applied."
    )


@pytest.mark.asyncio
async def test_boolean_and_integer_values_stay_distinct(mcp_server: object) -> None:
    """True and 1 compare equal in Python but are separate selections."""
    captured: dict[str, Any] = {}

    data = await _apply_region(
        mcp_server, [1, True, 1], _mock_values_dataset([1, True, 0]), captured
    )

    assert data["error"] is None
    entry = captured["state"]["dataMask"]["NATIVE_FILTER-region"]
    assert entry["extraFormData"]["filters"][0]["val"] == [1, True]


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "requested,stored",
    [(True, [1, 0]), (1, [True, False]), (False, [1, 0]), (0, [True, False])],
)
async def test_boolean_and_integer_are_not_exact_matches(
    mcp_server: object, requested: Any, stored: list[Any]
) -> None:
    """A boolean must not match the column's 1/0, or the reverse."""
    captured: dict[str, Any] = {}
    data = await _apply_region(
        mcp_server, [requested], _mock_values_dataset(stored), captured
    )
    assert "has no value" in data["error"]
    assert "state" not in captured


@pytest.mark.asyncio
async def test_failed_search_applies_the_value_unchecked(mcp_server: object) -> None:
    """A value that cannot be searched for is applied rather than refused."""
    captured: dict[str, Any] = {}
    dataset = _mock_values_dataset(REGION_VALUES)
    first_page = dataset.values_for_column.side_effect

    def fail_search(*args: Any, **kwargs: Any) -> list[Any]:
        """Serve the first page but fail the search query."""
        if kwargs.get("search") is not None:
            raise RuntimeError("search failed")
        return first_page(*args, **kwargs)

    dataset.values_for_column.side_effect = fail_search
    with patch.dict(current_app.config, FILTER_SELECT_ROW_LIMIT=2):
        data = await _apply_region(mcp_server, ["Oceania"], dataset, captured)

    assert data["error"] is None
    entry = captured["state"]["dataMask"]["NATIVE_FILTER-region"]
    assert entry["extraFormData"]["filters"][0]["val"] == ["Oceania"]


@pytest.mark.asyncio
async def test_unreadable_values_apply_the_request_unchecked(
    mcp_server: object,
) -> None:
    """Values are applied as given when the column cannot be read."""
    from superset.errors import ErrorLevel, SupersetError, SupersetErrorType
    from superset.exceptions import SupersetSecurityException

    denied = _mock_values_dataset(REGION_VALUES)
    denied.raise_for_access.side_effect = SupersetSecurityException(
        SupersetError(
            message="denied",
            error_type=SupersetErrorType.DATASOURCE_SECURITY_ACCESS_ERROR,
            level=ErrorLevel.ERROR,
        )
    )
    failing = _mock_values_dataset(REGION_VALUES)
    failing.values_for_column.side_effect = KeyError("region")

    for dataset in (None, denied, failing):
        captured: dict[str, Any] = {}
        data = await _apply_region(mcp_server, ["Asia Pacific"], dataset, captured)
        assert data["error"] is None
        entry = captured["state"]["dataMask"]["NATIVE_FILTER-region"]
        assert entry["extraFormData"]["filters"][0]["val"] == ["Asia Pacific"]

    # An inaccessible dataset's values are never read.
    denied.values_for_column.assert_not_called()


@pytest.mark.asyncio
async def test_exact_value_hidden_beyond_truncated_search_is_not_rejected(
    mcp_server: object,
) -> None:
    """An incomplete containment search cannot prove an exact value absent."""
    captured: dict[str, Any] = {}
    dataset = _mock_values_dataset(["APAC North", "APAC South", "APAC"])

    with patch.dict(current_app.config, FILTER_SELECT_ROW_LIMIT=2):
        data = await _apply_region(mcp_server, ["APAC"], dataset, captured)

    assert data["error"] is None
    assert data["applied_filters"][0]["values"] == ["APAC"]


@pytest.mark.asyncio
@pytest.mark.parametrize("candidates", [["APAC", "apac"], [1, "1"]])
async def test_ambiguous_values_offer_distinct_exact_alternatives(
    mcp_server: object, candidates: list[Any]
) -> None:
    """Ambiguity is not absence; the response must show both exact choices."""
    captured: dict[str, Any] = {}
    requested = "Apac" if isinstance(candidates[0], str) else " 1 "
    data = await _apply_region(
        mcp_server, [requested], _mock_values_dataset(candidates), captured
    )

    assert "state" not in captured
    assert "ambiguous" in data["error"]
    assert "has no value" not in data["error"]
    for candidate in candidates:
        assert json.dumps(candidate) in data["error"]
    assert "exact" in data["error"]


@pytest.mark.asyncio
async def test_truncated_normalized_match_reports_uncertainty_not_absence(
    mcp_server: object,
) -> None:
    """A partial normalized match must not claim the column lacks the value."""
    captured: dict[str, Any] = {}
    dataset = _mock_values_dataset(["APAC", "APAC North", "apac"])
    with patch.dict(current_app.config, FILTER_SELECT_ROW_LIMIT=2):
        data = await _apply_region(mcp_server, ["Apac"], dataset, captured)

    assert "state" not in captured
    assert "truncated" in data["error"]
    assert "has no value" not in data["error"]


@pytest.mark.asyncio
async def test_duplicate_requested_values_are_looked_up_once(
    mcp_server: object,
) -> None:
    """Repeated values must not repeat expensive searches on large columns."""
    captured: dict[str, Any] = {}
    dataset = _mock_values_dataset(REGION_VALUES + ["Oceania"])
    with patch.dict(current_app.config, FILTER_SELECT_ROW_LIMIT=2):
        data = await _apply_region(
            mcp_server, ["Oceania", "oceania"] * 50, dataset, captured
        )

    assert data["error"] is None
    assert data["applied_filters"][0]["values"] == ["Oceania"]
    assert dataset.values_for_column.call_count == 2


@pytest.mark.asyncio
@pytest.mark.parametrize("requested", [True, 3.0])
async def test_native_value_is_not_rejected_by_text_search_encoding(
    mcp_server: object, requested: bool | float
) -> None:
    """Database text casts need not use the labels of native JSON values."""
    captured: dict[str, Any] = {}
    dataset = _mock_values_dataset(
        ["APAC", "EMEA", requested],
        search_results={
            "TRUE": [],
            "3.0": [],
        },
    )
    with patch.dict(current_app.config, FILTER_SELECT_ROW_LIMIT=2):
        data = await _apply_region(mcp_server, [requested], dataset, captured)

    assert data["error"] is None
    assert data["applied_filters"][0]["values"] == [requested]


@pytest.mark.asyncio
async def test_null_only_column_offers_null_instead_of_claiming_empty(
    mcp_server: object,
) -> None:
    """NULL is a selectable column value, not an empty column."""
    captured: dict[str, Any] = {}
    data = await _apply_region(
        mcp_server, ["Mars"], _mock_values_dataset([None]), captured
    )
    assert "no values to filter on" not in data["error"]
    assert "Available values: null" in data["error"]


@pytest.mark.asyncio
@pytest.mark.parametrize(
    ("requested", "stored"),
    [
        ("STRASSE", "Straße"),
        ("SKY", "ſky"),
        ("FIRE", "ﬁre"),
        ("FFICIENT", "ﬃcient"),
        ("KELVIN", "Kelvin"),
    ],
)
async def test_casefold_matching_with_real_truncated_column_query(
    mcp_server: object, tmp_path: Any, requested: str, stored: str
) -> None:
    """SQL lower and Python casefold have different Unicode equivalences."""
    import sqlite3

    from superset.connectors.sqla.models import TableColumn

    path = tmp_path / "regions.db"
    with sqlite3.connect(path) as conn:
        conn.execute("CREATE TABLE sales (region TEXT)")
        conn.executemany(
            "INSERT INTO sales VALUES (?)", [(v,) for v in ["APAC", "EMEA", stored]]
        )
    dataset = SqlaTable(
        table_name="sales",
        database=Database(database_name="regions", sqlalchemy_uri=f"sqlite:///{path}"),
        columns=[TableColumn(column_name="region", type="TEXT")],
    )
    captured: dict[str, Any] = {}
    with (
        patch.dict(current_app.config, FILTER_SELECT_ROW_LIMIT=2),
        patch.object(SqlaTable, "raise_for_access"),
        patch.object(SqlaTable, "get_sqla_row_level_filters", return_value=[]),
    ):
        data = await _apply_region(mcp_server, [requested], dataset, captured)
    assert data["error"] is None
    assert data["applied_filters"][0]["values"] == [stored]


@pytest.mark.asyncio
@pytest.mark.parametrize("guest", [False, True])
async def test_real_column_lookup_keeps_rls_restricted_values_out_of_errors(
    mcp_server: object, tmp_path: Any, guest: bool
) -> None:
    """Initial values, search results and suggestions all honor effective RLS."""
    import sqlite3

    from superset.connectors.sqla.models import TableColumn
    from superset.extensions import security_manager

    path = tmp_path / "regions.db"
    with sqlite3.connect(path) as conn:
        conn.execute("CREATE TABLE sales (region TEXT)")
        conn.executemany(
            "INSERT INTO sales VALUES (?)",
            [(v,) for v in ["APAC", "EMEA", "Oceania", "Secret Region"]],
        )
    dataset = SqlaTable(
        table_name="sales",
        database=Database(database_name="regions", sqlalchemy_uri=f"sqlite:///{path}"),
        columns=[TableColumn(column_name="region", type="TEXT")],
    )
    clause = "region != 'Secret Region'"
    rule = Mock(clause=clause, group_key=None)
    with (
        patch.dict(current_app.config, FILTER_SELECT_ROW_LIMIT=2),
        patch.object(SqlaTable, "raise_for_access"),
        patch.object(
            security_manager, "get_rls_filters", return_value=[] if guest else [rule]
        ),
        patch.object(
            security_manager,
            "get_guest_rls_filters",
            return_value=[{"clause": clause}] if guest else [],
        ),
        patch("superset.connectors.sqla.models.is_feature_enabled", return_value=guest),
    ):
        rejected: dict[str, Any] = {}
        data = await _apply_region(mcp_server, ["Secret"], dataset, rejected)
        assert "state" not in rejected
        assert "'Secret Region'" not in data["error"]
        assert "Available values include: 'APAC', 'EMEA'" in data["error"]
        applied: dict[str, Any] = {}
        data = await _apply_region(mcp_server, ["oceania"], dataset, applied)
        assert data["error"] is None
        assert data["applied_filters"][0]["values"] == ["Oceania"]


@pytest.mark.asyncio
async def test_backend_dates_are_resolved_as_json_filter_values(
    mcp_server: object,
) -> None:
    """Driver date values must not break the scalar response schema."""
    from datetime import date, datetime

    for stored in [date(2024, 1, 1), datetime(2024, 1, 1)]:
        captured: dict[str, Any] = {}
        expected = stored.isoformat()
        data = await _apply_region(
            mcp_server, [expected], _mock_values_dataset([stored]), captured
        )
        assert data["error"] is None
        assert data["applied_filters"][0]["values"] == [expected]
        assert captured["state"]["dataMask"][SELECT_FILTER["id"]]["filterState"][
            "value"
        ] == [expected]


@pytest.mark.asyncio
async def test_structured_column_values_do_not_crash_scalar_validation(
    mcp_server: object,
) -> None:
    """Whole arrays are not supported scalar options and remain unchecked."""
    captured: dict[str, Any] = {}
    data = await _apply_region(
        mcp_server, ["['APAC']"], _mock_values_dataset([["APAC"]]), captured
    )
    assert data["error"] is None
    assert data["applied_filters"][0]["values"] == ["['APAC']"]


@pytest.mark.asyncio
async def test_typo_suggestions_preserve_case_collisions(mcp_server: object) -> None:
    """Even fuzzy suggestions should not hide distinct exact choices."""
    captured: dict[str, Any] = {}
    data = await _apply_region(
        mcp_server, ["Emeaa"], _mock_values_dataset(["EMEA", "emea"]), captured
    )
    assert "Closest matches for 'Emeaa': 'EMEA', 'emea'." in data["error"]


@pytest.mark.asyncio
async def test_non_text_column_is_not_rejected_by_database_display_format(
    mcp_server: object,
) -> None:
    """JSON dates use T, whereas the database's text cast may use a space."""
    captured: dict[str, Any] = {}
    dataset = _mock_values_dataset(
        ["2023-01-01T00:00:00", "2023-02-01T00:00:00", "2024-01-01T00:00:00"],
        search_results={"2024-01-01T00:00:00": []},
    )
    dataset.get_column.return_value.is_string = False
    with patch.dict(current_app.config, FILTER_SELECT_ROW_LIMIT=2):
        data = await _apply_region(
            mcp_server, ["2024-01-01T00:00:00"], dataset, captured
        )
    assert data["error"] is None
    assert data["applied_filters"][0]["values"] == ["2024-01-01T00:00:00"]
    dataset.values_for_column.assert_called_once()


@pytest.mark.asyncio
async def test_unicode_exact_value_on_truncated_column_remains_unchecked(
    mcp_server: object,
) -> None:
    """Backend lower() need not implement Python's non-ASCII lowercasing."""
    captured: dict[str, Any] = {}
    dataset = _mock_values_dataset(
        ["APAC", "EMEA", "Éire"], search_results={"Éire": []}
    )
    with patch.dict(current_app.config, FILTER_SELECT_ROW_LIMIT=2):
        data = await _apply_region(mcp_server, ["Éire"], dataset, captured)
    assert data["error"] is None
    assert data["applied_filters"][0]["values"] == ["Éire"]
    dataset.values_for_column.assert_called_once()


@pytest.mark.asyncio
async def test_search_without_a_safe_term_reuses_the_first_page(
    mcp_server: object,
) -> None:
    """An empty safe term must not rerun the same heavy full-column query."""
    captured: dict[str, Any] = {}
    dataset = _mock_values_dataset(["APAC", "EMEA", "K"])
    with patch.dict(current_app.config, FILTER_SELECT_ROW_LIMIT=2):
        data = await _apply_region(mcp_server, ["K"], dataset, captured)
    assert data["error"] is None
    assert data["applied_filters"][0]["values"] == ["K"]
    dataset.values_for_column.assert_called_once()


@pytest.mark.asyncio
@pytest.mark.parametrize("normalized_columns", [False, True])
async def test_value_lookups_respect_sql_row_cap_and_column_normalization(
    mcp_server: object, normalized_columns: bool
) -> None:
    """Both the initial page and searches use bounded, correctly named columns."""
    captured: dict[str, Any] = {}
    dataset = _mock_values_dataset(REGION_VALUES + ["Oceania"])
    dataset.normalize_columns = normalized_columns
    with patch.dict(current_app.config, FILTER_SELECT_ROW_LIMIT=100, SQL_MAX_ROW=2):
        data = await _apply_region(mcp_server, ["oceania"], dataset, captured)
    assert data["error"] is None
    assert data["applied_filters"][0]["values"] == ["Oceania"]
    assert dataset.values_for_column.call_count == 2
    for call in dataset.values_for_column.call_args_list:
        assert call.kwargs["limit"] == 2
        assert call.kwargs["denormalize_column"] is not normalized_columns
        assert call.kwargs["column_name"] == "region"


@pytest.mark.asyncio
async def test_unknown_value_suggestions_are_bounded(mcp_server: object) -> None:
    """A high-cardinality column must not dump every available value in an error."""
    captured: dict[str, Any] = {}
    dataset = _mock_values_dataset([f"Choice {n:02}" for n in range(25)])
    data = await _apply_region(mcp_server, ["Mars"], dataset, captured)
    assert "state" not in captured
    assert data["error"].count("'Choice ") == 10
    assert "(25 in total)" in data["error"]


@pytest.mark.asyncio
async def test_values_are_checked_with_the_real_column_query(
    mcp_server: object, tmp_path: Any
) -> None:
    """The check runs the dataset's distinct-values query against real data."""
    import sqlite3

    from superset.connectors.sqla.models import TableColumn

    path = tmp_path / "regions.db"
    with sqlite3.connect(path) as conn:
        conn.execute("CREATE TABLE sales (region TEXT)")
        conn.executemany(
            "INSERT INTO sales VALUES (?)", [("APAC",), ("EMEA",), ("EMEA",)]
        )
    dataset = SqlaTable(
        table_name="sales",
        database=Database(database_name="regions", sqlalchemy_uri=f"sqlite:///{path}"),
        columns=[TableColumn(column_name="region", type="TEXT")],
    )

    with (
        patch.object(SqlaTable, "raise_for_access"),
        patch.object(SqlaTable, "get_sqla_row_level_filters", return_value=[]),
    ):
        rejected: dict[str, Any] = {}
        data = await _apply_region(mcp_server, ["Asia Pacific"], dataset, rejected)
        assert "Available values: 'APAC', 'EMEA' (2 in total)." in data["error"]

        applied: dict[str, Any] = {}
        data = await _apply_region(mcp_server, ["apac"], dataset, applied)
        assert data["error"] is None
        entry = applied["state"]["dataMask"]["NATIVE_FILTER-region"]
        assert entry["extraFormData"]["filters"][0]["val"] == ["APAC"]


@pytest.mark.asyncio
async def test_clearing_a_select_does_not_read_the_column(mcp_server: object) -> None:
    """An empty selection needs no data check."""
    captured: dict[str, Any] = {}
    dataset = _mock_values_dataset(REGION_VALUES)

    data = await _apply_region(mcp_server, [], dataset, captured)

    assert data["error"] is None
    dataset.values_for_column.assert_not_called()


# ---------------------------------------------------------------------------
# Targeting
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_filter_addressed_by_id(mcp_server: object) -> None:
    """Filter addressed by id."""
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
async def test_filter_name_match_is_case_insensitive(mcp_server: object) -> None:
    """Filter name match is case insensitive."""
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
async def test_multiple_filters_applied_in_one_call(mcp_server: object) -> None:
    """Multiple filters applied in one call."""
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
async def test_unknown_filter_name_lists_the_available_filters(
    mcp_server: object,
) -> None:
    """Unknown filter name lists the available filters."""
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
@pytest.mark.parametrize("include_filter", [True, False])
async def test_unknown_filter_name_excludes_dividers(
    mcp_server: object, include_filter: bool
) -> None:
    """Available-filter errors omit dividers, including divider-only dashboards."""
    divider = {
        "id": "NATIVE_FILTER_DIVIDER-geography",
        "type": "DIVIDER",
        "title": "Geography",
        "description": "Location filters",
        "scope": {"rootPath": ["ROOT_ID"], "excluded": []},
    }
    configs = [divider, SELECT_FILTER] if include_filter else [divider]
    with (
        patch(DAO_GET, return_value=_mock_dashboard(configs)),
        patch(CREATE_PERMALINK) as create_permalink,
    ):
        data = await _call(
            mcp_server,
            {
                "dashboard_id": 1,
                "filters": [{"filter_name_or_id": "Country", "values": ["FR"]}],
            },
        )

    assert "No filter named 'Country'" in data["error"]
    assert "NATIVE_FILTER_DIVIDER" not in data["error"]
    assert "(unnamed)" not in data["error"]
    assert "type=None" not in data["error"]
    if include_filter:
        assert "Region (id=NATIVE_FILTER-region, type=filter_select)" in data["error"]
    else:
        assert "This dashboard has no native filters." in data["error"]
    create_permalink.assert_not_called()


@pytest.mark.asyncio
async def test_ambiguous_filter_name_asks_for_an_id(mcp_server: object) -> None:
    """Ambiguous filter name asks for an id."""
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
async def test_exact_id_match_wins_over_a_name_collision(mcp_server: object) -> None:
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
async def test_values_on_a_time_filter_is_rejected(mcp_server: object) -> None:
    """Values on a time filter is rejected."""
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
async def test_time_range_on_a_select_filter_is_rejected(mcp_server: object) -> None:
    """Time range on a select filter is rejected."""
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
async def test_unsupported_filter_type_is_rejected(mcp_server: object) -> None:
    """Unsupported filter type is rejected."""
    with patch(DAO_GET, return_value=_mock_dashboard([TIMECOLUMN_FILTER])):
        data = await _call(
            mcp_server,
            {
                "dashboard_id": 1,
                "filters": [{"filter_name_or_id": "Time Column", "values": [1, 2]}],
            },
        )

    assert "has type 'filter_timecolumn'" in data["error"]
    assert "filter_range, filter_select, filter_time, filter_timegrain" in data["error"]


@pytest.mark.asyncio
async def test_divider_id_is_rejected_with_divider_type(mcp_server: object) -> None:
    """Divider IDs report their display type without creating a permalink."""
    divider = {
        "id": "NATIVE_FILTER_DIVIDER-geography",
        "type": "DIVIDER",
        "title": "Geography",
        "description": "Location filters",
        "scope": {"rootPath": ["ROOT_ID"], "excluded": []},
    }
    with (
        patch(DAO_GET, return_value=_mock_dashboard([divider])),
        patch(CREATE_PERMALINK) as create_permalink,
    ):
        data = await _call(
            mcp_server,
            {
                "dashboard_id": 1,
                "filters": [{"filter_name_or_id": divider["id"], "values": ["FR"]}],
            },
        )

    assert data["permalink_key"] is None
    assert (
        "Filter 'NATIVE_FILTER_DIVIDER-geography' has type 'divider', "
        "which this tool cannot apply values to."
    ) in data["error"]
    create_permalink.assert_not_called()


@pytest.mark.asyncio
async def test_duplicate_target_is_rejected(mcp_server: object) -> None:
    """Duplicate target is rejected."""
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
async def test_both_values_and_time_range_is_rejected(mcp_server: object) -> None:
    """Both values and time range is rejected."""
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
async def test_neither_values_nor_time_range_is_rejected(mcp_server: object) -> None:
    """Neither values nor time range is rejected."""
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
async def test_dashboard_without_filters_reports_so(mcp_server: object) -> None:
    """Dashboard without filters reports so."""
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
async def test_dashboard_not_found(mcp_server: object) -> None:
    """Dashboard not found."""
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
async def test_permission_denied(mcp_server: object) -> None:
    """Permission denied."""
    with (
        patch(DAO_GET, side_effect=DashboardAccessDeniedError),
        patch(DATASET_GET) as lookup,
    ):
        data = await _call(
            mcp_server,
            {
                "dashboard_id": 1,
                "filters": [{"filter_name_or_id": "Region", "values": ["EMEA"]}],
            },
        )

    lookup.assert_not_called()
    assert data["permission_denied"] is True
    assert "permission" in data["error"]
    assert data["permalink_key"] is None


@pytest.mark.asyncio
async def test_permission_is_checked_before_filter_names_are_read(
    mcp_server: object,
) -> None:
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
async def test_data_mask_round_trips_through_get_dashboard_layout(
    mcp_server: object,
) -> None:
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


@pytest.mark.asyncio
@pytest.mark.parametrize("websocket_enabled", [None, False, True])
@pytest.mark.parametrize(
    ("backend_defined", "publish_fails", "expected"),
    [(True, False, True), (False, False, False), (True, True, False)],
)
async def test_realtime_publish_outcome(
    mcp_server: object,
    mock_auth: Mock,
    websocket_enabled: bool | None,
    backend_defined: bool,
    publish_fails: bool,
    expected: bool,
) -> None:
    """Publish only an opaque permalink nudge to the authenticated caller."""
    mock_auth.return_value.id = 42
    captured: dict[str, Any] = {}
    with (
        patch.dict(current_app.config, WEBSOCKET_ENABLE=websocket_enabled),
        patch(DAO_GET, return_value=_mock_dashboard([SELECT_FILTER])),
        patch(CREATE_PERMALINK, side_effect=_mock_permalink_command(captured)),
        patch(
            "superset.coordination.base.CoordinationService.is_backend_defined",
            return_value=backend_defined,
        ),
        patch(
            "superset.coordination.base.CoordinationService.publish",
            side_effect=RuntimeError("publish failed") if publish_fails else None,
        ) as publish,
        patch(
            "superset.security_manager.get_current_guest_user_if_guest",
            return_value=None,
        ),
        patch("superset.security_manager.can_access", return_value=True),
    ):
        if websocket_enabled is None:
            current_app.config.pop("WEBSOCKET_ENABLE", None)
        data = await _call(
            mcp_server,
            {
                "dashboard_id": 1,
                "filters": [{"filter_name_or_id": "Region", "values": ["EMEA"]}],
            },
        )

    assert data["live_update_pushed"] is (expected and bool(websocket_enabled))
    assert data["error"] is None
    assert data["permalink_key"] == "permakey123"
    if backend_defined and websocket_enabled:
        publish.assert_called_once()
        assert json.loads(publish.call_args.args[1]) == {
            "topic": "dashboard.filters_applied",
            "scope": "principal",
            "routes": ["user:42"],
            "payload": {"dashboard_id": 1, "permalink_key": "permakey123"},
        }
    else:
        publish.assert_not_called()


@pytest.mark.parametrize("channel", [None, "guest:opaque-hmac"])
def test_realtime_guest_or_missing_principal(channel: str | None) -> None:
    """Guest routing uses the token-derived key; missing identities never broadcast."""
    from superset.mcp_service.dashboard.tool.apply_dashboard_filters import (
        _publish_filters_applied,
    )

    with (
        patch.dict(current_app.config, WEBSOCKET_ENABLE=True),
        patch(
            "superset.coordination.base.CoordinationService.is_backend_defined",
            return_value=True,
        ),
        patch(
            "superset.realtime.publish.publish_realtime", return_value=True
        ) as publish,
        patch(
            "superset.security_manager.get_current_guest_user_if_guest",
            return_value=Mock(),
        ),
        patch(
            "superset.websocket.channel.get_current_guest_subscriber_key",
            return_value=channel,
        ),
        patch("superset.security_manager.can_access", return_value=True),
    ):
        assert _publish_filters_applied(1, "key") is (channel is not None)
    if channel is None:
        publish.assert_not_called()
    else:
        publish.assert_called_once_with(
            topic="dashboard.filters_applied",
            scope="principal",
            payload={"dashboard_id": 1, "permalink_key": "key"},
            routes=[channel],
        )


@pytest.mark.parametrize("can_read_realtime", [True, False])
def test_realtime_publish_requires_realtime_permission(
    can_read_realtime: bool,
) -> None:
    """Publish only when the caller holds the permission its socket is gated on."""
    from superset.mcp_service.dashboard.tool.apply_dashboard_filters import (
        _publish_filters_applied,
    )

    with (
        patch.dict(current_app.config, WEBSOCKET_ENABLE=True),
        patch(
            "superset.coordination.base.CoordinationService.is_backend_defined",
            return_value=True,
        ),
        patch(
            "superset.realtime.publish.publish_realtime", return_value=True
        ) as publish,
        patch(
            "superset.security_manager.get_current_guest_user_if_guest",
            return_value=None,
        ),
        patch("superset.websocket.channel.get_user_id", return_value=42),
        patch(
            "superset.security_manager.can_access", return_value=can_read_realtime
        ) as can_access,
    ):
        assert _publish_filters_applied(1, "key") is can_read_realtime

    can_access.assert_called_once_with("can_read", "Realtime")
    if can_read_realtime:
        publish.assert_called_once_with(
            topic="dashboard.filters_applied",
            scope="principal",
            payload={"dashboard_id": 1, "permalink_key": "key"},
            routes=["user:42"],
        )
    else:
        publish.assert_not_called()


@pytest.mark.asyncio
@pytest.mark.parametrize("reference", ["1", "uuid", "slug"])
async def test_stack_filters_across_turns(mcp_server: object, reference: str) -> None:
    """Stack, replace, and clear without losing unmentioned raw filter entries."""
    from copy import deepcopy

    dashboard = _mock_dashboard([SELECT_FILTER, TIME_FILTER])
    dashboard.slug = "regional-sales"
    references = {"1": "1", "uuid": dashboard.uuid, "slug": dashboard.slug}
    captured: dict[str, Any] = {}
    with (
        patch(DAO_GET, return_value=dashboard),
        patch(CREATE_PERMALINK, side_effect=_mock_permalink_command(captured)),
        patch(GET_PERMALINK) as get_command,
        patch(CAN_VIEW_DATA_MODEL, return_value=False),
        patch(
            "superset.mcp_service.dashboard.permalink."
            "redact_filter_state_data_model_metadata"
        ) as redact,
    ):
        first = await _call(
            mcp_server,
            {
                "dashboard_id": 1,
                "filters": [{"filter_name_or_id": "Region", "values": ["EMEA"]}],
            },
        )
        get_command.assert_not_called()
        first_state = deepcopy(captured["state"])
        assert set(first_state["dataMask"]) == {"NATIVE_FILTER-region"}
        get_command.return_value.run.return_value = {
            "dashboardId": references[reference],
            "state": first_state,
        }
        second = await _call(
            mcp_server,
            {
                "dashboard_id": 1,
                "base_permalink_key": first["permalink_key"],
                "filters": [
                    {
                        "filter_name_or_id": "Time Range",
                        "time_range": "2024-01-01 : 2025-01-01",
                    }
                ],
            },
        )
        assert second["error"] is None
        get_command.assert_called_once_with(first["permalink_key"])
        second_state = deepcopy(captured["state"])
        region = second_state["dataMask"]["NATIVE_FILTER-region"]
        assert region == first_state["dataMask"]["NATIVE_FILTER-region"]
        assert region["extraFormData"]["filters"][0]["col"] == "region"
        assert set(second_state["dataMask"]) == {
            "NATIVE_FILTER-region",
            "NATIVE_FILTER-time",
        }
        assert [f["id"] for f in second["applied_filters"]] == ["NATIVE_FILTER-time"]
        assert "EMEA" not in json.dumps(second)
        assert "dataMask" not in second
        for values in (["APAC"], []):
            get_command.return_value.run.return_value = {
                "dashboardId": references[reference],
                "state": second_state,
            }
            result = await _call(
                mcp_server,
                {
                    "dashboard_id": 1,
                    "base_permalink_key": second["permalink_key"],
                    "filters": [{"filter_name_or_id": "Region", "values": values}],
                },
            )
            assert result["error"] is None
            mask = captured["state"]["dataMask"]
            assert mask["NATIVE_FILTER-region"]["filterState"]["value"] == (
                values or None
            )
            assert (
                mask["NATIVE_FILTER-time"]
                == second_state["dataMask"]["NATIVE_FILTER-time"]
            )
            assert second_state["dataMask"]["NATIVE_FILTER-region"] == region
        redact.assert_not_called()


@pytest.mark.asyncio
@pytest.mark.parametrize(
    ("failure", "message", "denied"),
    [
        ("missing", "Base permalink was not found or has expired.", False),
        ("expired", "Base permalink was not found or has expired.", False),
        ("access", "permission to access the base permalink's dashboard", True),
        ("resolve", "Failed to resolve the base permalink", False),
        ("mismatch", "Base permalink does not belong to dashboard 1.", False),
        ("state", "Base permalink contains invalid dashboard state.", False),
        ("mask", "Base permalink contains an invalid dataMask.", False),
    ],
)
async def test_base_permalink_failures_do_not_create_or_publish(
    mcp_server: object, failure: str, message: str, denied: bool
) -> None:
    """Every base resolution failure is explicit and never falls back."""
    from superset.dashboards.permalink.exceptions import (
        DashboardPermalinkGetFailedError,
    )

    with (
        patch(DAO_GET, return_value=_mock_dashboard([SELECT_FILTER])),
        patch(GET_PERMALINK) as get_command,
        patch(CREATE_PERMALINK) as create,
        patch("superset.realtime.publish.publish_realtime") as publish,
    ):
        command = get_command.return_value
        if failure in {"missing", "expired"}:
            command.run.return_value = None
        elif failure == "access":
            command.run.side_effect = DashboardAccessDeniedError()
        elif failure == "resolve":
            command.run.side_effect = DashboardPermalinkGetFailedError()
        else:
            command.run.return_value = {
                "dashboardId": "2" if failure == "mismatch" else "1",
                "state": None if failure == "state" else {"dataMask": []},
            }
        result = await _call(
            mcp_server,
            {
                "dashboard_id": 1,
                "base_permalink_key": "base-key",
                "filters": [{"filter_name_or_id": "Region", "values": ["EMEA"]}],
            },
        )
    assert message in result["error"]
    assert result["permission_denied"] is denied
    assert result["permalink_key"] is None
    create.assert_not_called()
    publish.assert_not_called()


@pytest.mark.parametrize(
    "operator", ["ilike_contains", "ilike_starts_with", "ilike_ends_with"]
)
@pytest.mark.asyncio
async def test_non_exact_select_is_rejected_without_side_effects(
    mcp_server: object, operator: str
) -> None:
    """Never reinterpret a configured pattern filter as exact matching."""
    conf = {
        **SELECT_FILTER,
        "controlValues": {**SELECT_FILTER["controlValues"], "operatorType": operator},
    }
    with (
        patch(DAO_GET, return_value=_mock_dashboard([conf])),
        patch(CREATE_PERMALINK) as create,
        patch(
            "superset.mcp_service.dashboard.tool.apply_dashboard_filters."
            "_publish_filters_applied"
        ) as publish,
    ):
        data = await _call(
            mcp_server,
            {
                "dashboard_id": 1,
                "filters": [{"filter_name_or_id": "Region", "values": ["EM"]}],
            },
        )
    assert "Only exact-match select filters are supported" in data["error"]
    create.assert_not_called()
    publish.assert_not_called()


@pytest.mark.parametrize("values", [["EMEA"], []])
@pytest.mark.parametrize("required", [False, True])
@pytest.mark.asyncio
async def test_inverse_select_is_rejected_without_side_effects(
    mcp_server: object, values: list[str], required: bool
) -> None:
    """Do not create masks that change meaning when inverse filters initialize."""
    conf = {
        **SELECT_FILTER,
        "controlValues": {
            **SELECT_FILTER["controlValues"],
            "inverseSelection": True,
            "enableEmptyFilter": required,
        },
    }
    with (
        patch(DAO_GET, return_value=_mock_dashboard([conf])),
        patch(CREATE_PERMALINK) as create,
        patch(
            "superset.mcp_service.dashboard.tool.apply_dashboard_filters."
            "_publish_filters_applied"
        ) as publish,
    ):
        data = await _call(
            mcp_server,
            {
                "dashboard_id": 1,
                "filters": [{"filter_name_or_id": "Region", "values": values}],
            },
        )
    assert "inverse selection, which this tool does not support" in data["error"]
    create.assert_not_called()
    publish.assert_not_called()


@pytest.mark.asyncio
async def test_single_select_rejects_multiple_values(mcp_server: object) -> None:
    """A single-select control cannot render two values, so refuse to store them."""
    conf = {
        **SELECT_FILTER,
        "controlValues": {**SELECT_FILTER["controlValues"], "multiSelect": False},
    }
    with (
        patch(DAO_GET, return_value=_mock_dashboard([conf])),
        patch(CREATE_PERMALINK) as create,
        patch(
            "superset.mcp_service.dashboard.tool.apply_dashboard_filters."
            "_publish_filters_applied"
        ) as publish,
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
    assert "single-select and accepts at most one value" in data["error"]
    create.assert_not_called()
    publish.assert_not_called()


@pytest.mark.parametrize("values", [["EMEA"], []])
@pytest.mark.asyncio
async def test_single_select_accepts_one_value_or_a_clear(
    mcp_server: object, values: list[str]
) -> None:
    """One value and an explicit clear both stay valid for a single-select."""
    conf = {
        **SELECT_FILTER,
        "controlValues": {**SELECT_FILTER["controlValues"], "multiSelect": False},
    }
    captured: dict[str, Any] = {}
    with (
        patch(DAO_GET, return_value=_mock_dashboard([conf])),
        patch(CREATE_PERMALINK, side_effect=_mock_permalink_command(captured)),
        patch(
            "superset.mcp_service.dashboard.tool.apply_dashboard_filters."
            "_publish_filters_applied"
        ),
    ):
        data = await _call(
            mcp_server,
            {
                "dashboard_id": 1,
                "filters": [{"filter_name_or_id": "Region", "values": values}],
            },
        )
    assert data["error"] is None
    mask = captured["state"]["dataMask"]["NATIVE_FILTER-region"]
    assert mask["filterState"]["value"] == (values or None)


@pytest.mark.asyncio
async def test_inherited_mask_drops_filters_the_dashboard_no_longer_has(
    mcp_server: object,
) -> None:
    """A filter deleted or recreated between turns must not carry state forward."""
    stale_id = "NATIVE_FILTER-deleted"
    base_state = {
        "dataMask": {
            "NATIVE_FILTER-region": {
                "id": "NATIVE_FILTER-region",
                "ownState": {},
                "extraFormData": {
                    "filters": [{"col": "region", "op": "IN", "val": ["EMEA"]}]
                },
                "filterState": {"value": ["EMEA"], "label": "EMEA"},
            },
            stale_id: {
                "id": stale_id,
                "ownState": {},
                "extraFormData": {
                    "filters": [{"col": "gone", "op": "IN", "val": ["x"]}]
                },
                "filterState": {"value": ["x"], "label": "x"},
            },
        }
    }
    captured: dict[str, Any] = {}
    with (
        patch(DAO_GET, return_value=_mock_dashboard([SELECT_FILTER, TIME_FILTER])),
        patch(CREATE_PERMALINK, side_effect=_mock_permalink_command(captured)),
        patch(GET_PERMALINK) as get_command,
        patch(CAN_VIEW_DATA_MODEL, return_value=True),
    ):
        get_command.return_value.run.return_value = {
            "dashboardId": "1",
            "state": base_state,
        }
        data = await _call(
            mcp_server,
            {
                "dashboard_id": 1,
                "base_permalink_key": "base-key",
                "filters": [
                    {
                        "filter_name_or_id": "Time Range",
                        "time_range": "2024-01-01 : 2025-01-01",
                    }
                ],
            },
        )
    assert data["error"] is None
    assert set(captured["state"]["dataMask"]) == {
        "NATIVE_FILTER-region",
        "NATIVE_FILTER-time",
    }


@pytest.mark.parametrize(
    "bounds, label",
    [
        ([1000, 2000000], "1k ≤ x ≤ 2M"),
        ([0.125, None], "x ≥ 0.125"),
        ([0, 0], "x = 0"),
        ([None, -1234], "x ≤ -1.23k"),
    ],
)
def test_range_labels_use_frontend_smart_number_format(
    bounds: list[int | float | None], label: str
) -> None:
    """Range labels mirror the plugin's operators and SMART_NUMBER formatter."""
    from superset.mcp_service.dashboard.tool.apply_dashboard_filters import (
        _range_data_mask,
    )

    assert _range_data_mask(RANGE_FILTER, bounds)["filterState"]["label"] == label


@pytest.mark.parametrize(
    "bounds, label, filters",
    [
        (
            [1.7976931348623157e308, None],
            "x ≥ 1.7976931348623157e+308",
            [{"col": "cost", "op": ">=", "val": 1.7976931348623157e308}],
        ),
        (
            [None, -1.7976931348623157e308],
            "x ≤ -1.7976931348623157e+308",
            [{"col": "cost", "op": "<=", "val": -1.7976931348623157e308}],
        ),
        (
            [1.7976931348623157e308, 1.7976931348623157e308],
            "x = 1.7976931348623157e+308",
            [{"col": "cost", "op": "==", "val": 1.7976931348623157e308}],
        ),
        (
            [1000, 1.7976931348623157e308],
            "1k ≤ x ≤ 1.7976931348623157e+308",
            [
                {"col": "cost", "op": ">=", "val": 1000},
                {"col": "cost", "op": "<=", "val": 1.7976931348623157e308},
            ],
        ),
    ],
)
def test_range_labels_preserve_bounds_that_overflow_smart_number_format(
    bounds: list[int | float | None], label: str, filters: list[dict[str, Any]]
) -> None:
    """Valid extreme bounds produce labels without changing the predicates."""
    from superset.mcp_service.dashboard.tool.apply_dashboard_filters import (
        _range_data_mask,
    )

    mask = _range_data_mask(RANGE_FILTER, bounds)
    assert mask == {
        "extraFormData": {"filters": filters},
        "filterState": {"value": bounds, "label": label},
    }


@pytest.mark.asyncio
@pytest.mark.parametrize("bound", [True, False])
@pytest.mark.parametrize("index", [0, 1])
async def test_range_boolean_bounds_are_rejected(
    mcp_server: object, bound: bool, index: int
) -> None:
    """Reject boolean range bounds without creating a permalink."""
    bounds: list[int] = [0, 100]
    bounds[index] = bound
    with (
        patch(DAO_GET, return_value=_mock_dashboard([RANGE_FILTER])),
        patch(CREATE_PERMALINK) as create,
        pytest.raises(ToolError, match="range bounds must be numbers or null"),
    ):
        await _call(
            mcp_server,
            {
                "dashboard_id": 1,
                "filters": [{"filter_name_or_id": "Cost", "range": bounds}],
            },
        )
    create.assert_not_called()


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "extra_form_data",
    [
        {"time_range": "Last week"},
        {"filters": [{"col": "region", "op": "IN", "val": ["EMEA"]}]},
        {
            "adhoc_filters": [
                {
                    "expressionType": "SQL",
                    "clause": "WHERE",
                    "sqlExpression": "region = 'EMEA'",
                }
            ]
        },
    ],
)
@pytest.mark.parametrize("requested", ["Mars", "Outside scoped vie"])
@pytest.mark.parametrize("limit", [2, 100])
async def test_active_dashboard_scope_rejects_unknown_values_without_suggestions(
    mcp_server: object, extra_form_data: dict[str, Any], requested: str, limit: int
) -> None:
    """A scoped request still rejects missing values without unscoped options."""
    from superset.mcp_service.dashboard_scope import DashboardScope

    scope = DashboardScope(dashboard_id=1, chart_filters={1: extra_form_data})
    dataset = _mock_values_dataset(["EMEA", "Outside scoped view", "LATAM"])
    captured: dict[str, Any] = {}
    with (
        patch(
            "superset.mcp_service.dashboard_scope.get_request_dashboard_scope",
            return_value=scope,
        ),
        patch.dict(current_app.config, FILTER_SELECT_ROW_LIMIT=limit),
    ):
        data = await _apply_region(mcp_server, [requested], dataset, captured)

    assert "has no value" in data["error"]
    assert data["permalink_key"] is None
    assert data["applied_filters"] == []
    assert "state" not in captured
    assert "EMEA" not in data["error"]
    assert "Outside scoped view" not in data["error"]
    assert "LATAM" not in data["error"]
    assert "Available values" not in data["error"]
    assert "Closest matches" not in data["error"]
    dataset.raise_for_access.assert_called_once_with()
    assert dataset.values_for_column.called


@pytest.mark.asyncio
@pytest.mark.parametrize("limit", [2, 100])
async def test_active_dashboard_scope_does_not_expose_ambiguous_alternatives(
    mcp_server: object, limit: int
) -> None:
    """Ambiguous and truncated matches must not list unscoped alternatives."""
    from superset.mcp_service.dashboard_scope import DashboardScope

    dataset = _mock_values_dataset(["APAC", "APAC North", "apac"])
    captured: dict[str, Any] = {}
    with (
        patch(
            "superset.mcp_service.dashboard_scope.get_request_dashboard_scope",
            return_value=DashboardScope(
                dashboard_id=1, chart_filters={1: {"time_range": "Last week"}}
            ),
        ),
        patch.dict(current_app.config, FILTER_SELECT_ROW_LIMIT=limit),
    ):
        data = await _apply_region(mcp_server, ["Apac"], dataset, captured)

    assert "No filter values were applied" in data["error"]
    assert "APAC" not in data["error"]
    assert "apac" not in data["error"]
    assert "Exact column values include" not in data["error"]
    assert "state" not in captured


@pytest.mark.asyncio
async def test_active_dashboard_scope_allows_known_column_value(
    mcp_server: object,
) -> None:
    """Column membership does not claim the value exists in the scoped subset."""
    from superset.mcp_service.dashboard_scope import DashboardScope

    dataset = _mock_values_dataset(["EMEA", "APAC"])
    captured: dict[str, Any] = {}
    with patch(
        "superset.mcp_service.dashboard_scope.get_request_dashboard_scope",
        return_value=DashboardScope(
            dashboard_id=1,
            chart_filters={
                1: {"filters": [{"col": "region", "op": "IN", "val": ["EMEA"]}]}
            },
        ),
    ):
        data = await _apply_region(mcp_server, ["APAC"], dataset, captured)

    assert data["error"] is None
    assert data["applied_filters"][0]["values"] == ["APAC"]
    dataset.raise_for_access.assert_called_once_with()
    dataset.values_for_column.assert_called_once()


@pytest.mark.asyncio
@pytest.mark.parametrize("requested", ["IND", "ind", "Ind"])
async def test_truncated_search_tolerates_locale_sensitive_ascii_i(
    mcp_server: object, requested: str
) -> None:
    """A Turkish-style SQL lower maps ASCII I to dotless ı, unlike Python."""
    dataset = _mock_values_dataset(
        ["APAC", "EMEA", "IND"],
        search_results={"IND": [], "ind": [], "Ind": []},
    )
    captured: dict[str, Any] = {}
    with patch.dict(current_app.config, FILTER_SELECT_ROW_LIMIT=2):
        data = await _apply_region(mcp_server, [requested], dataset, captured)

    assert data["error"] is None
    assert data["applied_filters"][0]["values"] == ["IND"]


@pytest.mark.asyncio
async def test_unconstrained_dashboard_scope_still_validates_values(
    mcp_server: object,
) -> None:
    """An empty scope does not disable ordinary column-value validation."""
    from superset.mcp_service.dashboard_scope import DashboardScope

    dataset = _mock_values_dataset(REGION_VALUES)
    captured: dict[str, Any] = {}
    with patch(
        "superset.mcp_service.dashboard_scope.get_request_dashboard_scope",
        return_value=DashboardScope(dashboard_id=1, chart_filters={}),
    ):
        data = await _apply_region(mcp_server, ["Mars"], dataset, captured)

    assert "has no value 'Mars'" in data["error"]
    assert "state" not in captured
    dataset.values_for_column.assert_called_once()


@pytest.mark.asyncio
@pytest.mark.parametrize("fail_search", [False, True])
async def test_distinct_value_searches_have_a_per_filter_query_budget(
    mcp_server: object,
    fail_search: bool,
) -> None:
    """Many distinct selections must not issue one column scan per value."""
    stored = [f"value{n:02}" for n in range(15)]
    dataset = _mock_values_dataset(["APAC", "EMEA", *stored])
    if fail_search:
        first_page = dataset.values_for_column.side_effect

        def query(*args: Any, **kwargs: Any) -> list[Any]:
            """Failure still consumes the bounded search budget."""
            if kwargs.get("search") is not None:
                raise RuntimeError("search failed")
            return first_page(*args, **kwargs)

        dataset.values_for_column.side_effect = query
    captured: dict[str, Any] = {}
    with patch.dict(current_app.config, FILTER_SELECT_ROW_LIMIT=2):
        data = await _apply_region(
            mcp_server, [value.upper() for value in stored], dataset, captured
        )

    assert data["error"] is None
    assert dataset.values_for_column.call_count == 11
    assert data["applied_filters"][0]["values"] == (
        [value.upper() for value in stored]
        if fail_search
        else [*stored[:10], *(value.upper() for value in stored[10:])]
    )


@pytest.mark.asyncio
async def test_zero_sql_row_cap_never_runs_an_unlimited_values_query(
    mcp_server: object,
) -> None:
    """A zero effective limit means unchecked values, not an unbounded query."""
    dataset = _mock_values_dataset(REGION_VALUES)
    captured: dict[str, Any] = {}
    with patch.dict(current_app.config, SQL_MAX_ROW=0):
        data = await _apply_region(mcp_server, ["Mars"], dataset, captured)

    assert data["error"] is None
    assert data["applied_filters"][0]["values"] == ["Mars"]
    dataset.values_for_column.assert_not_called()


def _column_values_key(dataset: Mock, **query: Any) -> str:
    """Build the key the column-values API uses for the same query."""
    from superset.datasource.api import _column_values_cache_key

    return _column_values_cache_key(
        dataset,
        {
            "col": "region",
            "limit": current_app.config["FILTER_SELECT_ROW_LIMIT"],
            "denorm": True,
            "elements": False,
            "q": None,
            **query,
        },
    )


@pytest.mark.asyncio
async def test_repeated_calls_read_column_values_from_the_shared_cache(
    mcp_server: object, data_cache: _FakeDataCache
) -> None:
    """A second tool call does not re-run the DISTINCT query."""
    dataset = _mock_values_dataset(REGION_VALUES)

    for _ in range(2):
        captured: dict[str, Any] = {}
        data = await _apply_region(mcp_server, ["emea"], dataset, captured)
        assert data["error"] is None
        assert data["applied_filters"][0]["values"] == ["EMEA"]

    dataset.values_for_column.assert_called_once()
    # The entry is the one the column-values API would read and write.
    assert list(data_cache.entries) == [_column_values_key(dataset)]
    assert data_cache.entries[_column_values_key(dataset)] == REGION_VALUES


@pytest.mark.asyncio
async def test_entries_written_by_the_column_values_api_are_reused(
    mcp_server: object, data_cache: _FakeDataCache
) -> None:
    """A UI-warmed entry serves validation without touching the dataset."""
    dataset = _mock_values_dataset(REGION_VALUES)
    data_cache.set(_column_values_key(dataset), REGION_VALUES, timeout=300)

    captured: dict[str, Any] = {}
    data = await _apply_region(mcp_server, ["emea"], dataset, captured)

    assert data["applied_filters"][0]["values"] == ["EMEA"]
    dataset.values_for_column.assert_not_called()


@pytest.mark.asyncio
async def test_searches_are_cached_with_the_api_search_timeout(
    mcp_server: object, data_cache: _FakeDataCache
) -> None:
    """A CONTAINS search is shared with the UI's search and expires quickly."""
    from superset.datasource.api import SEARCH_CACHE_TIMEOUT

    dataset = _mock_values_dataset(REGION_VALUES + ["Oceania"])
    with patch.dict(current_app.config, FILTER_SELECT_ROW_LIMIT=2):
        for _ in range(2):
            captured: dict[str, Any] = {}
            data = await _apply_region(mcp_server, ["oceania"], dataset, captured)
            assert data["applied_filters"][0]["values"] == ["Oceania"]
        search_key = _column_values_key(dataset, limit=2, q="ocean")
        page_key = _column_values_key(dataset, limit=2)

    assert dataset.values_for_column.call_count == 2
    assert set(data_cache.entries) == {page_key, search_key}
    assert data_cache.timeouts[search_key] == SEARCH_CACHE_TIMEOUT
    assert data_cache.timeouts[page_key] == current_app.config.get(
        "CACHE_DEFAULT_TIMEOUT", 300
    )


@pytest.mark.asyncio
async def test_cached_values_are_not_shared_across_different_rls(
    mcp_server: object, data_cache: _FakeDataCache
) -> None:
    """Callers with different effective RLS never read each other's values."""
    from superset.extensions import security_manager

    dataset = _mock_values_dataset(["APAC", "EMEA"])
    unrestricted: list[str] = []
    restricted = ["region != 'EMEA'-"]
    other = ["region = 'EMEA'-"]
    rows = {
        tuple(unrestricted): ["APAC", "EMEA"],
        tuple(restricted): ["APAC"],
        tuple(other): ["EMEA"],
    }
    rls: list[str] = unrestricted

    def query(**kwargs: Any) -> list[Any]:
        """Return the rows the caller's RLS allows."""
        return rows[tuple(rls)]

    dataset.values_for_column.side_effect = query
    results = []
    for rls in (unrestricted, restricted, unrestricted, restricted, other):
        with patch.object(security_manager, "get_rls_cache_key", return_value=rls):
            captured: dict[str, Any] = {}
            results.append(await _apply_region(mcp_server, ["EMEA"], dataset, captured))

    # Callers whose RLS allows EMEA resolve it; the restricted one never gets
    # it from an entry cached for an unrestricted caller, and repeats stay denied.
    assert [bool(data["error"]) for data in results] == [
        False,
        True,
        False,
        True,
        False,
    ]
    for data in (results[1], results[3]):
        assert "Available values: 'APAC' (1 in total)." in data["error"]
    # One query per distinct RLS scope ([], restricted, other); repeats hit.
    assert dataset.values_for_column.call_count == 3
    assert len(data_cache.entries) == 3


@pytest.mark.asyncio
async def test_cache_key_is_scoped_to_the_dataset_and_its_edits(
    mcp_server: object, data_cache: _FakeDataCache
) -> None:
    """Another dataset, or an edited one, never reuses a cached entry."""
    first = _mock_values_dataset(["APAC", "EMEA"])
    second = _mock_values_dataset(["APAC", "EMEA"])
    second.uid = "second__table"
    edited = _mock_values_dataset(["APAC", "EMEA"])
    edited.changed_on = "2026-10-13 00:00:00"

    for dataset in (first, second, edited, first):
        await _apply_region(mcp_server, ["EMEA"], dataset, {})

    assert len({_column_values_key(d) for d in (first, second, edited)}) == 3
    assert len(data_cache.entries) == 3
    first.values_for_column.assert_called_once()
    second.values_for_column.assert_called_once()
    edited.values_for_column.assert_called_once()


@pytest.mark.asyncio
async def test_cache_is_not_read_before_the_access_check(
    mcp_server: object, data_cache: _FakeDataCache
) -> None:
    """A cached entry cannot be served to a caller denied the dataset."""
    from superset.errors import ErrorLevel, SupersetError, SupersetErrorType
    from superset.exceptions import SupersetSecurityException

    dataset = _mock_values_dataset(REGION_VALUES)
    data_cache.set(_column_values_key(dataset), REGION_VALUES, timeout=300)
    dataset.raise_for_access.side_effect = SupersetSecurityException(
        SupersetError(
            message="denied",
            error_type=SupersetErrorType.DATASOURCE_SECURITY_ACCESS_ERROR,
            level=ErrorLevel.ERROR,
        )
    )

    with patch.object(data_cache, "get", wraps=data_cache.get) as cache_get:
        captured: dict[str, Any] = {}
        data = await _apply_region(mcp_server, ["Mars"], dataset, captured)

    # Applied unchecked, with nothing about the cached values revealed.
    assert data["error"] is None
    assert data["applied_filters"][0]["values"] == ["Mars"]
    cache_get.assert_not_called()
    dataset.values_for_column.assert_not_called()


@pytest.mark.asyncio
async def test_failed_queries_are_not_cached(
    mcp_server: object, data_cache: _FakeDataCache
) -> None:
    """An error is retried on the next call instead of being remembered."""
    dataset = _mock_values_dataset(REGION_VALUES)
    working = dataset.values_for_column.side_effect
    dataset.values_for_column.side_effect = RuntimeError("database down")

    data = await _apply_region(mcp_server, ["Mars"], dataset, {})
    assert data["error"] is None
    assert not data_cache.entries

    dataset.values_for_column.side_effect = working
    data = await _apply_region(mcp_server, ["Mars"], dataset, {})
    assert "has no value 'Mars'" in data["error"]
