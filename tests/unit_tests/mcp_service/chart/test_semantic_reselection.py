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

from pathlib import Path
from typing import Any
from unittest.mock import Mock

import pytest
import yaml

from superset.common.form_data_query_context import build_query_objects_from_form_data
from superset.mcp_service.chart.datasource_resolver import ChartDatasource
from superset.mcp_service.chart.schemas import (
    ColumnRef,
    TableChartConfig,
    UpdateChartRequest,
)
from superset.mcp_service.chart.semantic_reselection import prove_table_reselection
from superset.mcp_service.chart.tool.update_chart import (
    _build_update_payload,
    _prepare_semantic_reselection,
)
from superset.utils import json
from superset.utils.core import DatasourceType


@pytest.mark.parametrize(
    "case", ["aggregate_sort", "explore_controls", "temporal", "unmodified"]
)
def test_reselection_of_exported_explore_table(case: str) -> None:
    """Keep all shipped temporal controls when reselecting non-temporal columns."""
    path: Path = (
        Path(__file__).resolve().parents[4]
        / "superset/examples/featured_charts/charts/Table.yaml"
    )
    saved: dict[str, Any] = yaml.safe_load(path.read_text())["params"]
    saved["datasource"] = "7__semantic_view"
    if case not in {"explore_controls", "unmodified"}:
        for key in (
            "dashboards",
            "server_page_length",
            "allow_render_html",
            "color_pn",
            "annotation_layers",
        ):
            saved.pop(key)
    elif case == "explore_controls":
        saved["conditional_formatting"] = []
    config: TableChartConfig = TableChartConfig.model_validate(
        {
            "columns": [{"name": "sales", "aggregate": "SUM"}]
            if case == "aggregate_sort"
            else [{"name": "product_line"}],
            "filters": [],
            "sort_by": [],
            **({"temporal_column": "order_date"} if case == "temporal" else {}),
        }
    )
    chart: Mock = Mock(
        id=12,
        datasource_id=7,
        datasource_type="semantic_view",
        viz_type="table",
        slice_name="Table",
        params=json.dumps(saved),
    )
    payload: Any = _build_update_payload(
        UpdateChartRequest(identifier=12, config=config),
        chart,
        config,
        temporal_columns={"order_date"},
    )
    assert isinstance(payload, dict)
    candidate: dict[str, Any] = json.loads(payload["params"])
    assert (
        prove_table_reselection(
            config, config, saved, candidate, temporal_columns={"order_date"}
        )
        is None
    )
    assert candidate["order_desc"] is True
    if case == "temporal":
        assert candidate["_mcp_dashboard_time_filter_subject"] == "order_date"
        assert candidate["adhoc_filters"][0]["subject"] == "order_date"
    target: ChartDatasource = ChartDatasource(
        Mock(implementation=Mock(selection_identity_version="v1")),
        DatasourceType.SEMANTIC_VIEW,
        7,
        "Table",
    )
    prepared: Any = _prepare_semantic_reselection(
        UpdateChartRequest(identifier=12, config=config),
        chart,
        config,
        target,
        {"order_date"},
        False,
    )
    assert isinstance(prepared, dict)
    assert json.loads(prepared["params"])["semantic_selection_version"] == "v1"
    assert "time_grain_sqla" not in json.loads(prepared["params"])
    queries: list[dict[str, Any]] = build_query_objects_from_form_data(
        json.loads(prepared["params"])
    )
    assert queries
    assert all("time_grain_sqla" not in query.get("extras", {}) for query in queries)


def test_unpublished_explicit_temporal_column_refuses_without_binding() -> None:
    """The candidate and proof must not silently drop the same requested member."""
    config: TableChartConfig = TableChartConfig(
        columns=[ColumnRef(name="member_id")], filters=[], temporal_column="missing"
    )
    existing: dict[str, Any]
    candidate: dict[str, Any]
    existing, candidate = _candidate({}, config, temporal_columns=set())
    assert "_mcp_dashboard_time_filter_subject" not in candidate
    assert (
        prove_table_reselection(
            config, config, existing, candidate, temporal_columns=set()
        )
        == "temporal selections"
    )


def test_order_direction_mismatch_reports_sorting() -> None:
    """Direct callers get the actionable category even with explicit sorting."""
    config: TableChartConfig = TableChartConfig(
        columns=[ColumnRef(name="member_id")], filters=[], sort_by=[]
    )
    existing: dict[str, Any]
    candidate: dict[str, Any]
    existing, candidate = _candidate({}, config)
    candidate["order_desc"] = not candidate["order_desc"]
    assert prove_table_reselection(config, config, existing, candidate) == "sorting"


@pytest.mark.parametrize(
    "lookup,grain,column,temporal_columns",
    [
        ({"order_date": True}, "P1D", "order_date", {"order_date"}),
        ({"order_date": False}, "P1D", "order_date", {"order_date"}),
        ({}, "P1D", "order_date", {"order_date"}),
        ({"old_date": True}, "P1D", "member_id", {"order_date"}),
        ({"order_date": 1}, "P1D", "member_id", {"order_date"}),
        ({"order_date": "true"}, "P1D", "member_id", {"order_date"}),
        ({1: False}, "P1D", "member_id", {"order_date"}),
        ([], "P1D", "member_id", {"order_date"}),
        (None, "P1D", "member_id", {"order_date"}),
        ({"order_date": True}, "P1D", "member_id", None),
        ({"order_date": True}, "P999D", "member_id", {"order_date"}),
        ({"order_date": True}, "P1W/1970-01-04T00:00:00Z", "member_id", {"order_date"}),
        ({"order_date": True}, "%Y-%m", "member_id", {"order_date"}),
        ({"order_date": True}, ["P1D"], "member_id", {"order_date"}),
    ],
)
def test_temporal_metadata_does_not_certify_active_or_unknown_grain(
    lookup: Any, grain: Any, column: str, temporal_columns: set[str] | None
) -> None:
    """Only authorized boolean lookup metadata with dormant durations is safe."""
    config: TableChartConfig = TableChartConfig(
        columns=[ColumnRef(name=column)], filters=[], sort_by=[]
    )
    existing: dict[str, Any]
    candidate: dict[str, Any]
    existing, candidate = _candidate(
        {"temporal_columns_lookup": lookup, "time_grain_sqla": grain}, config
    )
    assert (
        prove_table_reselection(
            config, config, existing, candidate, temporal_columns=temporal_columns
        )
        == "temporal selections"
    )


def test_authorized_temporal_lookup_without_grain_is_metadata() -> None:
    """Selecting an ungrained time column does not inherit a time transform."""
    config: TableChartConfig = TableChartConfig(
        columns=[ColumnRef(name="order_date")], filters=[]
    )
    existing: dict[str, Any]
    candidate: dict[str, Any]
    existing, candidate = _candidate(
        {"temporal_columns_lookup": {"order_date": True}}, config
    )
    assert (
        prove_table_reselection(
            config, config, existing, candidate, temporal_columns={"order_date"}
        )
        is None
    )


@pytest.mark.parametrize(
    "retained",
    [
        {"conditional_formatting": [{"column": "old_member"}]},
        {"annotation_layers": [{"name": "old_layer"}]},
        {"server_pagination": True},
        {"unknown_plugin_state": []},
        {"_mcp_dashboard_time_filter_subject": "old_member"},
    ],
)
def test_explore_classification_still_refuses_query_state(
    retained: dict[str, Any],
) -> None:
    """Safe display keys must not broaden permission to keep query identities."""
    config: TableChartConfig = TableChartConfig(
        columns=[ColumnRef(name="member_id")], filters=[]
    )
    existing: dict[str, Any]
    candidate: dict[str, Any]
    existing, candidate = _candidate(retained, config)
    assert prove_table_reselection(config, config, existing, candidate) is not None


@pytest.mark.parametrize("tamper", ["subject", "filter", "unpublished"])
def test_explicit_temporal_binding_must_match_authorized_fresh_mapping(
    tamper: str,
) -> None:
    """A copied marker alone cannot certify a different or unpublished member."""
    config: TableChartConfig = TableChartConfig(
        columns=[ColumnRef(name="member_id")], filters=[], temporal_column="order_date"
    )
    chart: Mock = Mock(
        id=12,
        datasource_id=7,
        datasource_type="semantic_view",
        viz_type="table",
        slice_name="Table",
        params='{"viz_type":"table"}',
    )
    payload: Any = _build_update_payload(
        UpdateChartRequest(identifier=12, config=config),
        chart,
        config,
        temporal_columns={"order_date"},
    )
    candidate: dict[str, Any] = json.loads(payload["params"])
    if tamper == "subject":
        candidate["_mcp_dashboard_time_filter_subject"] = "other_date"
    elif tamper == "filter":
        candidate["adhoc_filters"][0]["subject"] = "other_date"
    assert (
        prove_table_reselection(
            config,
            config,
            {"viz_type": "table"},
            candidate,
            temporal_columns=set() if tamper == "unpublished" else {"order_date"},
        )
        is not None
    )


def _candidate(
    saved: dict[str, Any],
    config: TableChartConfig,
    *,
    temporal_columns: set[str] | None = None,
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
        UpdateChartRequest(identifier=12, config=config),
        chart,
        config,
        temporal_columns=temporal_columns,
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
