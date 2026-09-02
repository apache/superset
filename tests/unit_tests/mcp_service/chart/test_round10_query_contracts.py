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

from copy import deepcopy
from unittest.mock import MagicMock, patch

import pytest
from pydantic import ValidationError

from superset.mcp_service.chart.chart_helpers import (
    build_query_context_from_form_data,
    build_query_dicts_from_form_data,
)
from superset.mcp_service.chart.chart_utils import (
    map_config_to_form_data,
    merge_form_data_for_update,
    scrub_dataset_bound_form_data,
)
from superset.mcp_service.chart.schemas import (
    GenerateChartRequest,
    UpdateChartPreviewRequest,
    UpdateChartRequest,
)


@pytest.mark.parametrize(
    "form_data,expected_columns,expected_metrics,expected_queries",
    [
        (
            {
                "viz_type": "histogram_v2",
                "column": "revenue",
                "groupby": ["region"],
                "bins": 8,
            },
            ["region", "revenue"],
            [],
            1,
        ),
        (
            {
                "viz_type": "pivot_table_v2",
                "groupbyRows": ["region"],
                "groupbyColumns": ["product"],
                "metrics": ["sum_revenue"],
            },
            ["region", "product"],
            ["sum_revenue"],
            1,
        ),
        (
            {
                "viz_type": "waterfall",
                "x_axis": "month",
                "groupby": ["region"],
                "metric": "sum_revenue",
            },
            ["month", "region"],
            ["sum_revenue"],
            1,
        ),
        (
            {
                "viz_type": "gantt_chart",
                "start_time": "started_at",
                "end_time": "ended_at",
                "y_axis": "task",
                "series": ["team"],
                "tooltip_columns": ["owner"],
                "tooltip_metrics": ["duration"],
                "order_by_cols": ['["started_at", true]'],
            },
            ["started_at", "ended_at", "task", "team", "owner"],
            ["duration"],
            1,
        ),
        (
            {
                "viz_type": "mixed_timeseries",
                "x_axis": "ds",
                "groupby": ["region"],
                "metrics": ["revenue"],
                "groupby_b": ["product"],
                "metrics_b": ["profit"],
            },
            ["ds", "region"],
            ["revenue"],
            2,
        ),
        (
            {
                "viz_type": "table",
                "query_mode": "raw",
                "all_columns": ["region", "revenue"],
                "order_by_cols": ['["revenue", false]'],
            },
            ["region", "revenue"],
            [],
            1,
        ),
        (
            {
                "viz_type": "echarts_timeseries_line",
                "x_axis": "ds",
                "groupby": ["region"],
                "metrics": ["revenue"],
                "series_limit": 5,
                "series_limit_metric": "revenue",
                "order_desc": False,
            },
            ["ds", "region"],
            ["revenue"],
            1,
        ),
        (
            {
                "viz_type": "box_plot",
                "columns": ["revenue"],
                "groupby": ["region"],
                "metrics": ["avg_revenue"],
                "whiskerOptions": "Tukey",
            },
            ["revenue", "region"],
            ["avg_revenue"],
            1,
        ),
        (
            {
                "viz_type": "ag-grid-pivot-table",
                "groupby": ["region", "product"],
                "metrics": ["revenue"],
            },
            ["region", "product"],
            ["revenue"],
            1,
        ),
    ],
    ids=[
        "histogram",
        "pivot",
        "waterfall",
        "gantt",
        "mixed",
        "raw-table",
        "xy",
        "box-plot",
        "interactive-pivot",
    ],
)
def test_product_query_context_uses_registered_frontend_adapters(
    form_data: dict[str, object],
    expected_columns: list[object],
    expected_metrics: list[object],
    expected_queries: int,
) -> None:
    """Exercise production QueryObject dictionaries at the factory boundary."""
    factory = MagicMock()
    factory.create.return_value = object()
    query_form_data = {"datasource": "7__table", **deepcopy(form_data)}
    with (
        patch(
            "superset.mcp_service.chart.chart_helpers.resolve_datasource_engine",
            return_value="base",
        ),
        patch(
            "superset.common.query_context_factory.QueryContextFactory",
            return_value=factory,
        ),
    ):
        build_query_context_from_form_data(query_form_data)

    queries = factory.create.call_args.kwargs["queries"]
    assert len(queries) == expected_queries
    assert queries[0]["columns"] == expected_columns
    assert queries[0]["metrics"] == expected_metrics

    if form_data["viz_type"] == "histogram_v2":
        assert queries[0]["post_processing"][0]["operation"] == "histogram"
    if form_data["viz_type"] == "box_plot":
        assert queries[0]["post_processing"][0]["operation"] == "boxplot"
    if form_data["viz_type"] == "echarts_timeseries_line":
        assert queries[0]["series_columns"] == ["region"]
        assert queries[0]["orderby"] == [["revenue", True]]
        assert [rule["operation"] for rule in queries[0]["post_processing"]] == [
            "pivot",
            "flatten",
        ]
    if form_data["viz_type"] == "waterfall":
        assert queries[0]["orderby"] == [["month", True], ["region", True]]
    if form_data["viz_type"] == "gantt_chart":
        assert queries[0]["series_columns"] == ["team"]
        assert queries[0]["orderby"] == [["started_at", True]]
    if form_data["viz_type"] == "mixed_timeseries":
        assert queries[1]["columns"] == ["ds", "product"]
        assert queries[1]["metrics"] == ["profit"]


@pytest.mark.parametrize("secondary_key", ["adhoc_filters_b", "filters_b"])
def test_mixed_secondary_explicit_filter_clear_never_inherits_primary(
    secondary_key: str,
) -> None:
    primary_filter = {
        "clause": "WHERE",
        "expressionType": "SIMPLE",
        "subject": "region",
        "operator": "==",
        "comparator": "EMEA",
    }
    form_data = {
        "viz_type": "mixed_timeseries",
        "x_axis": "ds",
        "metrics": ["revenue"],
        "metrics_b": ["profit"],
        "adhoc_filters": [primary_filter],
        secondary_key: [],
        "time_range": "Last year",
        "time_range_b": None,
    }
    with patch(
        "superset.mcp_service.chart.chart_helpers.resolve_datasource_engine",
        return_value="base",
    ):
        primary, secondary = build_query_dicts_from_form_data(form_data, 7, "table")

    assert primary["filters"] == [{"col": "region", "op": "==", "val": "EMEA"}]
    assert secondary["filters"] == []
    assert secondary.get("time_range") is None


@pytest.mark.parametrize(
    "viz_type,roles",
    [
        ("table", {"all_columns": ["old"], "order_by_cols": ['["old", true]']}),
        ("pivot_table_v2", {"groupbyRows": ["old"], "groupbyColumns": ["old2"]}),
        ("histogram_v2", {"column": "old", "groupby": ["old2"]}),
        ("waterfall", {"x_axis": "old", "groupby": ["old2"]}),
        ("echarts_timeseries_line", {"x_axis": "old", "series_columns": ["old2"]}),
        ("mixed_timeseries", {"metrics_b": ["old"], "adhoc_filters_b": []}),
        ("gantt_chart", {"start_time": "old", "tooltip_columns": ["old2"]}),
        ("world_map", {"entity": "old", "metric": "old_metric"}),
        ("deck_scatter", {"spatial": {"type": "latlong", "lonCol": "old"}}),
    ],
)
def test_dataset_rebind_scrubs_complete_query_role_contracts(
    viz_type: str, roles: dict[str, object]
) -> None:
    scrubbed = scrub_dataset_bound_form_data(
        {"viz_type": viz_type, **roles, "show_legend": True}
    )
    assert set(roles).isdisjoint(scrubbed)
    assert scrubbed == {"viz_type": viz_type, "show_legend": True}


def test_dataset_rebind_fails_closed_without_a_complete_viz_contract() -> None:
    with pytest.raises(ValueError, match="no complete dataset role contract"):
        scrub_dataset_bound_form_data(
            {"viz_type": "third_party_unknown", "mystery_column": "old"}
        )


_NATIVE_METRICS = [
    "saved_revenue",
    {
        "expressionType": "SIMPLE",
        "column": {"column_name": "revenue"},
        "aggregate": "SUM",
        "label": "SUM(revenue)",
        "hasCustomLabel": False,
        "optionName": "metric_revenue",
        "datasourceWarning": False,
        "sqlExpression": None,
    },
    {
        "expressionType": "SQL",
        "column": None,
        "aggregate": None,
        "sqlExpression": "COUNT(*)",
        "label": "Count",
        "hasCustomLabel": True,
        "optionName": "metric_count",
        "datasourceWarning": False,
    },
]


@pytest.mark.parametrize("request_type", ["generate", "update", "preview"])
@pytest.mark.parametrize("metric", _NATIVE_METRICS, ids=["saved", "simple", "sql"])
def test_native_xy_form_data_round_trips_through_every_request_model(
    request_type: str, metric: object
) -> None:
    config = {
        "viz_type": "echarts_timeseries_bar",
        "x_axis": "ds",
        "x_axis_title": "Date",
        "x_axis_format": "smart_date",
        "y_axis_title": "Revenue",
        "y_axis_scale": "log",
        "metrics": [metric],
        "groupby": ["region"],
        "row_limit": 123,
    }
    payload: dict[str, object]
    request_model: type[
        GenerateChartRequest | UpdateChartRequest | UpdateChartPreviewRequest
    ]
    if request_type == "generate":
        request_model = GenerateChartRequest
        payload = {"dataset_id": 7, "config": config}
    elif request_type == "update":
        request_model = UpdateChartRequest
        payload = {"identifier": 19, "config": config}
    else:
        request_model = UpdateChartPreviewRequest
        payload = {"dataset_id": 7, "config": config}

    request = request_model.model_validate(payload)
    xy = request.config
    assert xy is not None
    assert xy.x is not None
    assert xy.x.name == "ds"
    assert xy.x_axis is not None
    assert xy.x_axis.title == "Date"
    assert xy.y_axis is not None
    assert xy.y_axis.scale == "log"

    with patch(
        "superset.mcp_service.chart.chart_utils.is_column_truly_temporal",
        return_value=True,
    ):
        mapped = map_config_to_form_data(xy, dataset_id=7)
    assert mapped["x_axis"] == "ds"
    assert mapped["x_axis_title"] == "Date"
    assert mapped["x_axis_format"] == "smart_date"
    assert mapped["metrics"][0]


def test_native_xy_object_axis_config_remains_presentation_state() -> None:
    request = GenerateChartRequest.model_validate(
        {
            "dataset_id": 7,
            "config": {
                "viz_type": "echarts_timeseries_line",
                "x": {"name": "ds"},
                "x_axis": {"title": "Date", "format": "smart_date"},
                "metrics": ["saved_revenue"],
            },
        }
    )
    assert request.config.x is not None
    assert request.config.x.name == "ds"
    assert request.config.x_axis is not None
    assert request.config.x_axis.title == "Date"


@pytest.mark.parametrize(
    "x_axis",
    [
        {"title": "Date", "formt": "smart_date"},
        {"column_name": "ds", "column_nmae": "typo"},
        {
            "expressionType": "SIMPLE",
            "column": {"column_name": "ds", "column_nmae": "typo"},
        },
    ],
)
def test_native_xy_rejects_malformed_nested_axis_state(x_axis: object) -> None:
    with pytest.raises(ValidationError, match="Unknown"):
        GenerateChartRequest.model_validate(
            {
                "dataset_id": 7,
                "config": {
                    "viz_type": "echarts_timeseries_line",
                    "x_axis": x_axis,
                    "metrics": ["saved_revenue"],
                },
            }
        )


def test_native_xy_explicit_axis_reset_survives_sparse_merge() -> None:
    request = UpdateChartRequest.model_validate(
        {
            "identifier": 19,
            "config": {
                "viz_type": "echarts_timeseries_line",
                "x_axis": "ds",
                "x_axis_title": None,
                "metrics": ["saved_revenue"],
            },
        }
    )
    assert request.config is not None
    with patch(
        "superset.mcp_service.chart.chart_utils.is_column_truly_temporal",
        return_value=True,
    ):
        mapped = map_config_to_form_data(request.config, dataset_id=7)
    merged = merge_form_data_for_update(
        {
            "viz_type": "echarts_timeseries_line",
            "x_axis": "old_ds",
            "metrics": ["old_metric"],
            "x_axis_title": "Old title",
        },
        mapped,
        request.config,
    )
    assert "x_axis_title" not in merged


def test_mixed_typed_secondary_nulls_remain_explicit_query_clears() -> None:
    request = GenerateChartRequest.model_validate(
        {
            "dataset_id": 7,
            "config": {
                "chart_type": "mixed_timeseries",
                "x": {"name": "ds"},
                "y": [{"name": "revenue", "aggregate": "SUM"}],
                "y_secondary": [{"name": "profit", "aggregate": "SUM"}],
                "adhoc_filters_b": None,
                "time_range_b": None,
                "annotation_layers_b": [],
            },
        }
    )
    with patch(
        "superset.mcp_service.chart.chart_utils.is_column_truly_temporal",
        return_value=True,
    ):
        form_data = map_config_to_form_data(request.config, dataset_id=7)
    form_data.update(
        {
            "adhoc_filters": [
                {
                    "clause": "WHERE",
                    "expressionType": "SIMPLE",
                    "subject": "region",
                    "operator": "==",
                    "comparator": "EMEA",
                }
            ],
            "time_range": "Last year",
        }
    )
    with patch(
        "superset.mcp_service.chart.chart_helpers.resolve_datasource_engine",
        return_value="base",
    ):
        _, secondary = build_query_dicts_from_form_data(form_data, 7, "table")
    assert secondary["filters"] == []
    assert "time_range" not in secondary
    assert secondary["annotation_layers"] == []


def test_mixed_secondary_receives_dashboard_extra_form_data() -> None:
    form_data = {
        "viz_type": "mixed_timeseries",
        "x_axis": "ds",
        "metrics": ["revenue"],
        "metrics_b": ["profit"],
    }
    extra_form_data = {"filters": [{"col": "region", "op": "IN", "val": ["EMEA"]}]}
    with patch(
        "superset.mcp_service.chart.chart_helpers.resolve_datasource_engine",
        return_value="base",
    ):
        primary, secondary = build_query_dicts_from_form_data(
            form_data, 7, "table", extra_form_data=extra_form_data
        )
    assert primary["filters"] == secondary["filters"]
    assert secondary["filters"] == extra_form_data["filters"]


def test_gantt_adapter_accepts_native_adhoc_axis_objects() -> None:
    y_axis = {
        "label": "Task",
        "sqlExpression": "task_name",
        "expressionType": "SQL",
    }
    with patch(
        "superset.mcp_service.chart.chart_helpers.resolve_datasource_engine",
        return_value="base",
    ):
        query = build_query_dicts_from_form_data(
            {
                "viz_type": "gantt_chart",
                "start_time": "started_at",
                "end_time": "ended_at",
                "y_axis": y_axis,
                "series": "team",
                "tooltip_metrics": ["duration"],
                "order_by_cols": ['["started_at", true]'],
            },
            7,
            "table",
        )[0]
    assert query["columns"] == ["started_at", "ended_at", y_axis, "team"]
    assert query["series_columns"] == ["team"]


def test_pivot_non_additive_metrics_preserve_grouping_sets_contract() -> None:
    with patch(
        "superset.mcp_service.chart.chart_helpers.resolve_datasource_engine",
        return_value="base",
    ):
        query = build_query_dicts_from_form_data(
            {
                "viz_type": "pivot_table_v2",
                "groupbyRows": ["region"],
                "groupbyColumns": ["product"],
                "metrics": ["saved_revenue"],
                "rowTotals": True,
                "colTotals": True,
            },
            7,
            "table",
        )[0]
    assert query["grouping_sets"] == [
        [],
        ["product"],
        ["region"],
        ["region", "product"],
    ]


def test_big_number_raw_aggregation_preserves_two_query_contract() -> None:
    with patch(
        "superset.mcp_service.chart.chart_helpers.resolve_datasource_engine",
        return_value="base",
    ):
        trend, overall = build_query_dicts_from_form_data(
            {
                "viz_type": "big_number",
                "metric": "saved_ratio",
                "granularity_sqla": "ds",
                "aggregation": "raw",
            },
            7,
            "table",
        )
    assert trend["columns"] == ["ds"]
    assert [rule["operation"] for rule in trend["post_processing"]] == [
        "pivot",
        "flatten",
    ]
    assert overall["columns"] == []
    assert overall["is_timeseries"] is True
    assert overall["post_processing"] == []
