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
"""Proof counterexamples for semantic table reselection."""

from typing import Any
from unittest.mock import Mock

import pytest

from superset.mcp_service.chart.schemas import (
    ColumnRef,
    TableChartConfig,
    UpdateChartRequest,
)
from superset.mcp_service.chart.semantic_reselection import prove_table_reselection
from superset.mcp_service.chart.tool.update_chart import _build_update_payload
from superset.utils import json


def _candidate(
    saved: dict[str, Any], config: TableChartConfig
) -> tuple[dict[str, Any], dict[str, Any]]:
    """Exercise the real merge rather than mirror it in expected fixtures."""
    existing: dict[str, Any] = {
        "viz_type": "table",
        "datasource": "7__semantic_view",
        "all_columns": ["old_member"],
        "query_mode": "raw",
        **saved,
    }
    chart: Mock = Mock(
        id=12,
        datasource_id=7,
        datasource_type="semantic_view",
        viz_type="table",
        slice_name="Revenue",
        params=json.dumps(existing),
    )
    payload: Any = _build_update_payload(
        UpdateChartRequest(identifier=12, config=config), chart, config
    )
    assert isinstance(payload, dict)
    return existing, json.loads(payload["params"])


@pytest.mark.parametrize(
    "retained",
    [
        {"granularity_sqla": "member_id"},
        {"include_time": True},
        {"extra_form_data": {"time_compare": ["1 year ago"]}},
        {"metrics_b": ["member_id"]},
        {"unknown_control": False},
        {"unknown_control": 0},
        {"unknown_control": []},
        {"column_config": {"member_id": {"unknown_field": "old_member"}}},
        {"order_by_cols": ['["member_id", false]']},
    ],
)
def test_retained_state_cannot_be_certified(retained: dict[str, Any]) -> None:
    """Even a retained name equal to a valid ID is not a fresh selection."""
    config: TableChartConfig = TableChartConfig(
        columns=[ColumnRef(name="member_id")], filters=[]
    )
    existing: dict[str, Any]
    candidate: dict[str, Any]
    existing, candidate = _candidate(retained, config)
    assert prove_table_reselection(config, config, existing, candidate) is not None


@pytest.mark.parametrize("filters", [{}, {"filters": None}])
def test_default_filters_are_not_an_explicit_clear(filters: dict[str, Any]) -> None:
    """Absence and null must not become intent through mapper defaults."""
    config: TableChartConfig = TableChartConfig.model_validate(
        {
            "columns": [{"name": "member_id"}],
            **filters,
        }
    )
    existing: dict[str, Any]
    candidate: dict[str, Any]
    existing, candidate = _candidate({}, config)
    assert prove_table_reselection(config, config, existing, candidate) == "filters"


def test_aliases_and_explicit_empty_clears_are_fresh() -> None:
    """Schema aliases and explicit clears are verified against final output."""
    config: TableChartConfig = TableChartConfig.model_validate(
        {
            "all_columns": [{"name": "member_id"}],
            "filters": [],
            "order_by": [],
        }
    )
    existing: dict[str, Any]
    candidate: dict[str, Any]
    existing, candidate = _candidate(
        {
            "where": "old_member > 1",
            "having": "old_member > 5",
            "filters": [{"col": "old_member", "op": "==", "val": "x"}],
            "order_by_cols": ['["old_member", false]'],
        },
        config,
    )
    assert prove_table_reselection(config, config, existing, candidate) is None
    assert not candidate.get("where")
    assert not candidate.get("having")
    assert not candidate.get("filters")
    assert not candidate.get("order_by_cols")


def test_plugin_restored_percent_metric_refuses() -> None:
    """Table finalization can restore a role that the config cannot reselect."""
    config: TableChartConfig = TableChartConfig(
        columns=[ColumnRef(name="member_id", saved_metric=True)], filters=[]
    )
    existing: dict[str, Any]
    candidate: dict[str, Any]
    existing, candidate = _candidate(
        {
            "query_mode": "aggregate",
            "percent_metrics": ["member_id"],
        },
        config,
    )
    assert candidate["percent_metrics"] == ["member_id"]
    assert prove_table_reselection(config, config, existing, candidate) is not None


@pytest.mark.parametrize(
    "key", ["where", "having", "filters", "extra_filters", "adhoc_filters"]
)
@pytest.mark.parametrize(
    "saved_value", ["legacy predicate", False, 0, {"unknown": True}]
)
def test_nonempty_replacement_does_not_clear_saved_predicates(
    key: str, saved_value: Any
) -> None:
    """Even malformed aliases cannot disappear under a fresh non-empty filter list."""
    config: TableChartConfig = TableChartConfig.model_validate(
        {
            "columns": [{"name": "member_id"}],
            "filters": [{"column": "member_id", "op": "=", "value": "selected"}],
        }
    )
    existing: dict[str, Any]
    candidate: dict[str, Any]
    existing, candidate = _candidate({}, config)
    existing[key] = saved_value
    assert prove_table_reselection(config, config, existing, candidate) == (
        "saved WHERE/HAVING predicates"
    )


@pytest.mark.parametrize(
    "saved",
    [
        {},
        {
            "where": "",
            "having": "",
            "adhoc_filters": [],
            "filters": [],
            "extra_filters": [],
        },
        {
            "where": None,
            "having": None,
            "adhoc_filters": None,
            "filters": None,
            "extra_filters": None,
        },
    ],
)
def test_nonempty_filters_without_saved_predicates_can_be_certified(
    saved: dict[str, Any],
) -> None:
    """Known neutral aliases do not prevent genuine fresh filter selection."""
    config: TableChartConfig = TableChartConfig.model_validate(
        {
            "columns": [{"name": "member_id"}],
            "filters": [{"column": "member_id", "op": "=", "value": "selected"}],
        }
    )
    existing: dict[str, Any]
    candidate: dict[str, Any]
    existing, candidate = _candidate(saved, config)
    assert prove_table_reselection(config, config, existing, candidate) is None


def test_disappearing_rebind_control_is_not_a_clear() -> None:
    """A source rebind's scrub cannot manufacture explicit reset intent."""
    config: TableChartConfig = TableChartConfig(
        columns=[ColumnRef(name="member_id")], filters=[]
    )
    existing: dict[str, Any]
    candidate: dict[str, Any]
    existing, candidate = _candidate({"granularity_sqla": "old_time"}, config)
    candidate.pop("granularity_sqla", None)
    assert prove_table_reselection(config, config, existing, candidate) is not None


def test_rebind_cannot_silently_change_an_omitted_limit() -> None:
    """A mapper default is not permission to broaden a saved row limit."""
    config: TableChartConfig = TableChartConfig(
        columns=[ColumnRef(name="member_id")], filters=[]
    )
    existing: dict[str, Any]
    candidate: dict[str, Any]
    existing, candidate = _candidate({"row_limit": 20}, config)
    candidate["row_limit"] = 1000
    assert prove_table_reselection(config, config, existing, candidate) == "row limits"
