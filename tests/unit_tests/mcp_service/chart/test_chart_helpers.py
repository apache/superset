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

from typing import Any
from unittest.mock import MagicMock, patch

import pandas as pd
import pytest

from superset.common.query_object import QueryObject
from superset.mcp_service.chart.chart_helpers import (
    _deck_gl_null_filters,
    _is_metric_ref,
    _resolve_deck_gl_metrics,
    apply_form_data_filters_to_query,
    build_query_dicts_from_form_data,
    extract_form_data_key_from_url,
    find_chart_by_identifier,
    get_cached_form_data,
    merge_extra_form_data_filters_into_query,
    merge_form_data_filters_into_query,
    prepare_form_data_for_query,
    resolve_deck_gl_columns,
    resolve_metrics,
    resolve_metrics_and_groupby,
)
from superset.mcp_service.chart.chart_utils import map_big_number_config
from superset.mcp_service.chart.schemas import (
    BigNumberChartConfig,
    ColumnRef,
    FilterConfig,
)
from superset.utils.core import DTTM_ALIAS


def _query_objects(form_data: dict[str, Any]) -> list[QueryObject]:
    """Build the concrete objects consumed by ChartDataCommand."""
    query_dicts = build_query_dicts_from_form_data(form_data, 1, "table")
    return [QueryObject(**query_dict) for query_dict in query_dicts]


def test_extract_form_data_key_from_url_with_key():
    url = "http://localhost:8088/explore/?form_data_key=abc123&slice_id=1"
    assert extract_form_data_key_from_url(url) == "abc123"


def test_extract_form_data_key_from_url_no_key():
    url = "http://localhost:8088/explore/?slice_id=1"
    assert extract_form_data_key_from_url(url) is None


def test_extract_form_data_key_from_url_none():
    assert extract_form_data_key_from_url(None) is None


def test_extract_form_data_key_from_url_empty():
    assert extract_form_data_key_from_url("") is None


def test_extract_form_data_key_from_url_multiple_params():
    url = "http://localhost:8088/explore/?slice_id=5&form_data_key=xyz789&other=val"
    assert extract_form_data_key_from_url(url) == "xyz789"


@patch("superset.daos.chart.ChartDAO.find_by_id")
def test_find_chart_by_identifier_int(mock_find):
    mock_chart = MagicMock()
    mock_chart.id = 42
    mock_find.return_value = mock_chart

    result = find_chart_by_identifier(42)
    mock_find.assert_called_once_with(42)
    assert result == mock_chart


@patch("superset.daos.chart.ChartDAO.find_by_id")
def test_find_chart_by_identifier_str_digit(mock_find):
    mock_chart = MagicMock()
    mock_find.return_value = mock_chart

    result = find_chart_by_identifier("123")
    mock_find.assert_called_once_with(123)
    assert result == mock_chart


@patch("superset.daos.chart.ChartDAO.find_by_id")
def test_find_chart_by_identifier_uuid(mock_find):
    mock_chart = MagicMock()
    mock_find.return_value = mock_chart

    uuid_str = "a1b2c3d4-5678-90ab-cdef-1234567890ab"
    result = find_chart_by_identifier(uuid_str)
    mock_find.assert_called_once_with(uuid_str, id_column="uuid")
    assert result == mock_chart


@patch("superset.daos.chart.ChartDAO.find_by_id")
def test_find_chart_by_identifier_not_found(mock_find):
    mock_find.return_value = None
    result = find_chart_by_identifier(999)
    assert result is None


@patch(
    "superset.commands.explore.form_data.get.GetFormDataCommand.run",
    return_value='{"viz_type": "table"}',
)
@patch("superset.commands.explore.form_data.get.GetFormDataCommand.__init__")
def test_get_cached_form_data_success(mock_init, mock_run):
    mock_init.return_value = None
    result = get_cached_form_data("test_key")
    assert result == '{"viz_type": "table"}'


@patch(
    "superset.commands.explore.form_data.get.GetFormDataCommand.run",
    side_effect=KeyError("not found"),
)
@patch("superset.commands.explore.form_data.get.GetFormDataCommand.__init__")
def test_get_cached_form_data_key_error(mock_init, mock_run):
    mock_init.return_value = None
    result = get_cached_form_data("bad_key")
    assert result is None


def test_prepare_form_data_for_query_preserves_existing_filters_with_adhoc(
    monkeypatch,
):
    monkeypatch.setattr(
        "superset.mcp_service.chart.chart_helpers.resolve_datasource_engine",
        lambda datasource_id, datasource_type: "base",
    )
    form_data = {
        "filters": [{"col": "gender", "op": "==", "val": "boy"}],
        "adhoc_filters": [
            {
                "clause": "WHERE",
                "expressionType": "SIMPLE",
                "subject": "gender",
                "operator": "==",
                "comparator": "girl",
            }
        ],
    }
    query = {}

    prepare_form_data_for_query(form_data, 1, "table")
    apply_form_data_filters_to_query(query, form_data)

    assert query["filters"] == [
        {"col": "gender", "op": "==", "val": "boy"},
        {"col": "gender", "op": "==", "val": "girl"},
    ]


def test_prepare_form_data_for_query_merges_cached_and_request_extra_form_data(
    monkeypatch,
):
    monkeypatch.setattr(
        "superset.mcp_service.chart.chart_helpers.resolve_datasource_engine",
        lambda datasource_id, datasource_type: "base",
    )
    form_data = {
        "adhoc_filters": [],
        "extra_form_data": {
            "adhoc_filters": [
                {
                    "clause": "WHERE",
                    "expressionType": "SIMPLE",
                    "subject": "country",
                    "operator": "==",
                    "comparator": "US",
                }
            ],
            "time_range": "Last year",
        },
    }
    query = {}

    prepare_form_data_for_query(
        form_data,
        1,
        "table",
        {
            "adhoc_filters": [
                {
                    "clause": "WHERE",
                    "expressionType": "SIMPLE",
                    "subject": "gender",
                    "operator": "==",
                    "comparator": "boy",
                }
            ],
            "time_range": "No filter",
        },
    )
    apply_form_data_filters_to_query(query, form_data)

    assert query["filters"] == [
        {"col": "country", "op": "==", "val": "US"},
        {"col": "gender", "op": "==", "val": "boy"},
    ]
    assert query["time_range"] == "No filter"


def test_build_query_dicts_from_form_data_uses_raw_all_columns(monkeypatch):
    monkeypatch.setattr(
        "superset.mcp_service.chart.chart_helpers.resolve_datasource_engine",
        lambda datasource_id, datasource_type: "base",
    )
    form_data = {
        "viz_type": "handlebars",
        "query_mode": "raw",
        "all_columns": ["state", "city"],
        "adhoc_filters": [],
    }

    queries = build_query_dicts_from_form_data(form_data, 1, "table")

    assert queries == [
        {
            "columns": ["state", "city"],
            "metrics": [],
            "filters": [],
        }
    ]


def test_build_query_dicts_scopes_mixed_timeseries_ordering(monkeypatch):
    """Primary ordering must never leak into the secondary metric contract."""
    monkeypatch.setattr(
        "superset.mcp_service.chart.chart_helpers.resolve_datasource_engine",
        lambda datasource_id, datasource_type: "base",
    )
    m1 = {"expressionType": "SQL", "sqlExpression": "SUM(a)", "label": "m1"}
    m2 = {"expressionType": "SQL", "sqlExpression": "SUM(b)", "label": "m2"}
    form_data = {
        "viz_type": "mixed_timeseries",
        "x_axis": "ds",
        "metrics": [m1],
        "metrics_b": [m2],
        "groupby": ["primary_group"],
        "groupby_b": ["secondary_group"],
        "orderby": [[m1, False]],
        "orderby_b": [[m2, True]],
    }

    primary, secondary = build_query_dicts_from_form_data(form_data, 1, "table")

    assert primary["metrics"] == [m1]
    assert primary["orderby"] == [[m1, False]]
    assert secondary["metrics"] == [m2]
    assert secondary["orderby"] == [[m2, True]]


def test_build_query_dicts_mixed_secondary_does_not_inherit_primary_orderby(
    monkeypatch,
):
    monkeypatch.setattr(
        "superset.mcp_service.chart.chart_helpers.resolve_datasource_engine",
        lambda datasource_id, datasource_type: "base",
    )
    form_data = {
        "viz_type": "mixed_timeseries",
        "metrics": ["m1"],
        "metrics_b": ["m2"],
        "orderby": [["m1", False]],
    }

    primary, secondary = build_query_dicts_from_form_data(form_data, 1, "table")

    assert primary["orderby"] == [["m1", False]]
    assert secondary["orderby"] == [["m2", False]]


def test_build_query_dicts_preserves_native_orderby_for_single_query(monkeypatch):
    monkeypatch.setattr(
        "superset.mcp_service.chart.chart_helpers.resolve_datasource_engine",
        lambda datasource_id, datasource_type: "base",
    )
    orderby = [["SUM(revenue)", False]]
    queries = build_query_dicts_from_form_data(
        {
            "viz_type": "bullet",
            "metric": "SUM(revenue)",
            "groupby": ["region"],
            "orderby": orderby,
        },
        1,
        "table",
    )

    assert queries == [
        {
            "columns": ["region"],
            "filters": [],
            "metrics": ["SUM(revenue)"],
            "orderby": orderby,
        }
    ]


@pytest.mark.parametrize(
    "viz_type",
    [
        "echarts_timeseries_line",
        "table",
        "pie",
        "big_number",
        "gantt",
        "sunburst_v2",
        "bullet",
    ],
)
def test_common_temporal_fields_reach_final_non_deck_query_objects(
    monkeypatch: pytest.MonkeyPatch, viz_type: str
) -> None:
    """Common frontend time controls survive QueryObject construction."""
    monkeypatch.setattr(
        "superset.mcp_service.chart.chart_helpers.resolve_datasource_engine",
        lambda *_args: "base",
    )
    form_data = {
        "viz_type": viz_type,
        "metric": "count",
        "metrics": ["count"],
        "groupby": ["region"],
        "granularity_sqla": "event_time",
        "time_grain_sqla": "P1D",
        "adhoc_filters": [],
    }
    if viz_type == "gantt":
        form_data.update(
            {"start_time": "event_time", "end_time": "event_end", "y_axis": "region"}
        )
    query = _query_objects(form_data)[0]

    assert query.granularity == "event_time"
    assert query.extras["time_grain_sqla"] == "P1D"


@pytest.mark.parametrize(
    "form_data",
    [
        {"viz_type": "table", "metrics": ["count"], "groupby": ["region"]},
        {
            "viz_type": "table",
            "metrics": ["count"],
            "groupby": ["region"],
            "granularity_sqla": None,
            "time_grain_sqla": None,
            "extras": {"time_grain_sqla": "P1Y"},
        },
    ],
)
def test_omitted_and_cleared_grains_stay_absent_from_final_query_object(
    monkeypatch: pytest.MonkeyPatch, form_data: dict[str, Any]
) -> None:
    monkeypatch.setattr(
        "superset.mcp_service.chart.chart_helpers.resolve_datasource_engine",
        lambda *_args: "base",
    )

    query = _query_objects(form_data)[0]

    assert query.granularity is None
    assert "time_grain_sqla" not in query.extras


def test_xy_and_both_mixed_queries_preserve_common_temporal_fields(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(
        "superset.mcp_service.chart.chart_helpers.resolve_datasource_engine",
        lambda *_args: "base",
    )
    common = {
        "x_axis": "event_time",
        "granularity_sqla": "event_time",
        "time_grain_sqla": "P1M",
        "adhoc_filters": [],
    }

    xy = _query_objects(
        {
            **common,
            "viz_type": "echarts_timeseries_bar",
            "metrics": ["sales"],
            "groupby": ["region"],
        }
    )
    mixed = _query_objects(
        {
            **common,
            "viz_type": "mixed_timeseries",
            "metrics": ["sales"],
            "metrics_b": ["orders"],
            "groupby": ["region"],
            "groupby_b": ["channel"],
            "orderby": [["sales", False]],
        }
    )

    assert [(q.granularity, q.extras["time_grain_sqla"]) for q in xy] == [
        ("event_time", "P1M")
    ]
    assert [(q.granularity, q.extras["time_grain_sqla"]) for q in mixed] == [
        ("event_time", "P1M"),
        ("event_time", "P1M"),
    ]
    assert mixed[0].orderby == [["sales", False]]
    assert mixed[1].orderby == [["orders", False]]


@pytest.mark.parametrize(
    ("frontend_builder", "form_data", "expected"),
    [
        (
            "plugin-chart-echarts/src/Histogram/buildQuery.ts",
            {
                "viz_type": "histogram_v2",
                "column": "value",
                "groupby": ["region"],
                "bins": 8,
                "normalize": True,
                "cumulative": False,
            },
            [(["region", "value"], [], [], ["histogram"])],
        ),
        (
            "plugin-chart-echarts/src/BoxPlot/buildQuery.ts",
            {
                "viz_type": "box_plot",
                "columns": ["event_time"],
                "groupby": ["region"],
                "metrics": ["revenue"],
                "whiskerOptions": "10/90 percentiles",
            },
            [
                (
                    ["event_time", "region"],
                    ["revenue"],
                    ["region"],
                    ["boxplot"],
                )
            ],
        ),
        (
            "plugin-chart-pivot-table/src/plugin/buildQuery.ts",
            {
                "viz_type": "pivot_table_v2",
                "groupbyRows": ["region"],
                "groupbyColumns": ["channel"],
                "metrics": ["revenue"],
                "rowTotals": True,
                "colTotals": True,
            },
            [(["region", "channel"], ["revenue"], [], [])],
        ),
        (
            "plugin-chart-echarts/src/Pie/buildQuery.ts",
            {
                "viz_type": "pie",
                "groupby": ["region"],
                "metric": "revenue",
                "sort_by_metric": True,
            },
            [(["region"], ["revenue"], [], ["contribution"])],
        ),
        (
            "plugin-chart-table/src/buildQuery.ts (raw mode)",
            {
                "viz_type": "table",
                "query_mode": "raw",
                "all_columns": ["region", "revenue"],
                "order_by_cols": ['["revenue", false]'],
            },
            [(["region", "revenue"], [], [], [])],
        ),
        (
            "plugin-chart-echarts/src/Waterfall/buildQuery.ts",
            {
                "viz_type": "waterfall",
                "x_axis": "event_time",
                "groupby": ["region"],
                "metric": "revenue",
            },
            [(["event_time", "region"], ["revenue"], [], [])],
        ),
        (
            "plugin-chart-echarts/src/Gantt/buildQuery.ts",
            {
                "viz_type": "gantt_chart",
                "start_time": "started",
                "end_time": "ended",
                "y_axis": "task",
                "series": "team",
                "tooltip_columns": ["owner"],
                "tooltip_metrics": ["duration"],
                "order_by_cols": ['["started", true]'],
            },
            [
                (
                    ["started", "ended", "task", "team", "owner"],
                    ["duration"],
                    ["team"],
                    [],
                )
            ],
        ),
        (
            "plugin-chart-echarts/src/Bullet/buildQuery.ts",
            {"viz_type": "bullet", "groupby": ["region"], "metric": "revenue"},
            [(["region"], ["revenue"], [], [])],
        ),
        (
            "plugin-chart-echarts/src/Sunburst/buildQuery.ts",
            {
                "viz_type": "sunburst_v2",
                "groupby": ["region", "channel"],
                "metric": "revenue",
                "sort_by_metric": True,
            },
            [(["region", "channel"], ["revenue"], [], [])],
        ),
        (
            "plugin-chart-echarts/src/BigNumber/BigNumberTotal/buildQuery.ts",
            {"viz_type": "big_number_total", "metric": "revenue"},
            [([], ["revenue"], [], [])],
        ),
        (
            "plugin-chart-echarts/src/Timeseries/buildQuery.ts",
            {
                "viz_type": "echarts_timeseries_line",
                "x_axis": "event_time",
                "groupby": ["region"],
                "metrics": ["revenue"],
            },
            [
                (
                    [
                        {
                            "columnType": "BASE_AXIS",
                            "sqlExpression": "event_time",
                            "label": "event_time",
                            "expressionType": "SQL",
                            "isColumnReference": True,
                        },
                        "region",
                    ],
                    ["revenue"],
                    ["region"],
                    ["pivot", "flatten"],
                )
            ],
        ),
        (
            "interactive-pivot native buildQuery contract",
            {
                "viz_type": "ag-grid-pivot-table",
                "groupby": ["region", "channel"],
                "metrics": ["revenue"],
            },
            [(["region", "channel"], ["revenue"], [], [])],
        ),
        (
            "Handlebars common buildQueryObject contract",
            {
                "viz_type": "handlebars",
                "query_mode": "aggregate",
                "groupby": ["region"],
                "metrics": ["revenue"],
            },
            [(["region"], ["revenue"], [], [])],
        ),
    ],
    ids=lambda value: value if isinstance(value, str) else None,
)
def test_frontend_query_builder_parity_matrix_uses_concrete_query_objects(
    monkeypatch: pytest.MonkeyPatch,
    frontend_builder: str,
    form_data: dict[str, Any],
    expected: list[tuple[list[Any], list[Any], list[Any], list[str]]],
) -> None:
    """Pin native frontend buildQuery outputs at the QueryObject boundary."""
    monkeypatch.setattr(
        "superset.mcp_service.chart.chart_helpers.resolve_datasource_engine",
        lambda *_args: "base",
    )

    queries = _query_objects(form_data)
    actual = [
        (
            query.columns,
            query.metrics or [],
            query.series_columns,
            [item["operation"] for item in query.post_processing],
        )
        for query in queries
    ]

    assert frontend_builder
    assert actual == expected


def test_mixed_timeseries_frontend_parity_keeps_suffixed_layers_independent(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Pin the two concrete Mixed buildQuery outputs, including operator state."""
    monkeypatch.setattr(
        "superset.mcp_service.chart.chart_helpers.resolve_datasource_engine",
        lambda *_args: "base",
    )
    primary, secondary = _query_objects(
        {
            "viz_type": "mixed_timeseries",
            "x_axis": "event_time",
            "metrics": ["revenue"],
            "groupby": ["region"],
            "orderby": [["revenue", False]],
            "time_compare": ["1 year ago"],
            "comparison_type": "percentage",
            "resample_method": "zerofill",
            "resample_rule": "D",
            "rolling_type": "mean",
            "rolling_periods": 3,
            "metrics_b": ["orders"],
            "groupby_b": ["channel"],
            "orderby_b": [["orders", True]],
            "time_compare_b": ["1 month ago"],
            "comparison_type_b": "values",
            "resample_method_b": "pad",
            "resample_rule_b": "W",
            "rolling_type_b": "cumsum",
        }
    )

    assert primary.columns == [
        {
            "columnType": "BASE_AXIS",
            "sqlExpression": "event_time",
            "label": "event_time",
            "expressionType": "SQL",
            "isColumnReference": True,
        },
        "region",
    ]
    assert primary.series_columns == ["region"]
    assert primary.orderby == [["revenue", False]]
    assert primary.time_offsets == ["1 year ago"]
    assert [item["operation"] for item in primary.post_processing] == [
        "pivot",
        "resample",
        "rolling",
        "compare",
        "rename",
        "flatten",
    ]
    assert secondary.columns == [
        {
            "columnType": "BASE_AXIS",
            "sqlExpression": "event_time",
            "label": "event_time",
            "expressionType": "SQL",
            "isColumnReference": True,
        },
        "channel",
    ]
    assert secondary.series_columns == ["channel"]
    assert secondary.orderby == [["orders", True]]
    assert secondary.time_offsets == ["1 month ago"]
    assert [item["operation"] for item in secondary.post_processing] == [
        "pivot",
        "resample",
        "cum",
        "rename",
        "flatten",
    ]


def test_ungrouped_timeseries_and_mixed_pivot_on_axis_with_no_series(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """An explicit empty series array is truthy in the frontend builder."""
    monkeypatch.setattr(
        "superset.mcp_service.chart.chart_helpers.resolve_datasource_engine",
        lambda *_args: "base",
    )

    timeseries = _query_objects(
        {
            "viz_type": "echarts_timeseries_line",
            "x_axis": "event_time",
            "groupby": [],
            "metrics": ["revenue"],
        }
    )[0]
    mixed_primary, mixed_secondary = _query_objects(
        {
            "viz_type": "mixed_timeseries",
            "x_axis": "event_time",
            "groupby": [],
            "metrics": ["revenue"],
            "groupby_b": [],
            "metrics_b": ["orders"],
        }
    )

    for query in (timeseries, mixed_primary, mixed_secondary):
        pivot = query.post_processing[0]
        assert pivot["operation"] == "pivot"
        assert pivot["options"]["index"] == ["event_time"]
        assert pivot["options"]["columns"] == []
        assert query.series_columns == []


def test_ungrouped_timeseries_and_mixed_execute_real_pandas_post_processing(
    monkeypatch: pytest.MonkeyPatch,
    app_context: None,
) -> None:
    """Execute the generated pivot/flatten chain, not only its dictionary."""
    monkeypatch.setattr(
        "superset.mcp_service.chart.chart_helpers.resolve_datasource_engine",
        lambda *_args: "base",
    )
    queries = [
        _query_objects(
            {
                "viz_type": "echarts_timeseries_line",
                "x_axis": "event_time",
                "groupby": [],
                "metrics": ["revenue"],
            }
        )[0],
        *_query_objects(
            {
                "viz_type": "mixed_timeseries",
                "x_axis": "event_time",
                "groupby": [],
                "metrics": ["revenue"],
                "groupby_b": [],
                "metrics_b": ["orders"],
            }
        ),
    ]

    for query in queries:
        assert query.metrics
        metric = query.metrics[0]
        assert isinstance(metric, str)
        result = query.exec_post_processing(
            pd.DataFrame(
                {
                    "event_time": pd.to_datetime(["2024-01-01", "2024-01-02"]),
                    metric: [1.0, 2.0],
                }
            )
        )
        assert list(result.columns) == ["event_time", metric]
        assert result[metric].tolist() == [1.0, 2.0]


def test_timeseries_complete_frontend_query_and_operator_contract(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(
        "superset.mcp_service.chart.chart_helpers.resolve_datasource_engine",
        lambda *_args: "base",
    )
    revenue = {
        "expressionType": "SIMPLE",
        "column": {"column_name": "revenue"},
        "aggregate": "SUM",
        "label": "SUM(revenue)",
    }
    orders = {
        "expressionType": "SIMPLE",
        "column": {"column_name": "orders"},
        "aggregate": "COUNT",
        "label": "COUNT(orders)",
    }
    rank = {
        "expressionType": "SIMPLE",
        "column": {"column_name": "rank_value"},
        "aggregate": "MAX",
        "label": "MAX(rank_value)",
    }
    query = _query_objects(
        {
            "viz_type": "echarts_timeseries_bar",
            "x_axis": "event_time",
            "groupby": [],
            "metrics": [revenue, orders],
            "size": "size_metric",
            "timeseries_limit_metric": rank,
            "x_axis_sort": "MAX(rank_value)",
            "x_axis_sort_asc": False,
            "limit": 7,
            "order_desc": False,
            "time_compare": ["1 year ago"],
            "comparison_type": "values",
            "contributionMode": "row",
            "resample_method": "zerofill",
            "resample_rule": "D",
            "rolling_type": "mean",
            "rolling_periods": 3,
            "min_periods": 1,
            "forecastEnabled": True,
            "forecastPeriods": "5",
            "forecastInterval": "0.9",
            "forecastSeasonalityYearly": True,
            "forecastSeasonalityWeekly": False,
            "forecastSeasonalityDaily": None,
        }
    )[0]

    assert query.metrics == [revenue, orders, "size_metric", rank]
    assert query.series_limit == 7
    assert query.series_limit_metric == rank
    assert query.order_desc is False
    assert query.orderby == [[rank, True]]
    assert query.series_columns == []
    assert query.time_offsets == ["1 year ago"]
    assert [operator["operation"] for operator in query.post_processing] == [
        "pivot",
        "resample",
        "rolling",
        "contribution",
        "rename",
        "sort",
        "flatten",
        "prophet",
    ]
    pivot = query.post_processing[0]["options"]
    assert pivot["columns"] == []
    assert set(pivot["aggregates"]) == {
        "SUM(revenue)",
        "SUM(revenue)__1 year ago",
        "COUNT(orders)",
        "COUNT(orders)__1 year ago",
        "size_metric",
        "size_metric__1 year ago",
    }
    contribution = query.post_processing[3]
    assert contribution["options"] == {
        "orientation": "row",
        "time_shifts": ["1 year ago"],
    }
    assert query.post_processing[5]["options"] == {
        "by": "MAX(rank_value)",
        "ascending": False,
    }
    assert query.post_processing[-1]["options"] == {
        "time_grain": "P1D",
        "periods": 5,
        "confidence_interval": 0.9,
        "yearly_seasonality": True,
        "weekly_seasonality": False,
        "daily_seasonality": None,
        "index": "event_time",
    }


def test_grouped_timeseries_keeps_ranking_metric_out_of_value_metrics(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(
        "superset.mcp_service.chart.chart_helpers.resolve_datasource_engine",
        lambda *_args: "base",
    )
    query = _query_objects(
        {
            "viz_type": "echarts_timeseries_line",
            "x_axis": "event_time",
            "groupby": ["region"],
            "metrics": ["revenue", "orders"],
            "timeseries_limit_metric": "ranking",
            "x_axis_sort": "ranking",
        }
    )[0]

    assert query.metrics == ["revenue", "orders"]
    assert query.series_limit_metric == "ranking"
    assert query.series_columns == ["region"]
    assert query.post_processing[0]["options"]["columns"] == ["region"]
    assert "sort" not in [item["operation"] for item in query.post_processing]


def test_mixed_secondary_analytics_and_series_limits_do_not_leak_from_primary(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(
        "superset.mcp_service.chart.chart_helpers.resolve_datasource_engine",
        lambda *_args: "base",
    )
    primary, secondary = _query_objects(
        {
            "viz_type": "mixed_timeseries",
            "x_axis": "event_time",
            "metrics": ["revenue"],
            "groupby": ["region"],
            "limit": 5,
            "timeseries_limit_metric": "revenue_rank",
            "order_desc": False,
            "time_compare": ["1 year ago"],
            "comparison_type": "difference",
            "rolling_type": "cumsum",
            "resample_method": "zerofill",
            "resample_rule": "D",
            "metrics_b": ["orders"],
            "groupby_b": [],
        }
    )

    assert primary.series_limit == 5
    assert primary.series_limit_metric == "revenue_rank"
    assert primary.time_offsets == ["1 year ago"]
    assert [item["operation"] for item in primary.post_processing] == [
        "pivot",
        "resample",
        "cum",
        "compare",
        "rename",
        "flatten",
    ]
    assert secondary.series_limit == 0
    assert secondary.series_limit_metric is None
    assert secondary.order_desc is True
    assert secondary.time_offsets == []
    assert [item["operation"] for item in secondary.post_processing] == [
        "pivot",
        "flatten",
    ]
    assert secondary.post_processing[0]["options"]["columns"] == []


def test_frontend_parity_matrix_pins_ordering_and_operator_options(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(
        "superset.mcp_service.chart.chart_helpers.resolve_datasource_engine",
        lambda *_args: "base",
    )

    histogram = _query_objects(
        {
            "viz_type": "histogram_v2",
            "column": "value",
            "groupby": ["region"],
            "bins": "12",
            "normalize": True,
            "cumulative": False,
        }
    )[0]
    box = _query_objects(
        {
            "viz_type": "box_plot",
            "columns": ["event_time"],
            "groupby": ["region"],
            "metrics": ["revenue"],
            "whiskerOptions": "10/90 percentiles",
        }
    )[0]
    raw_table = _query_objects(
        {
            "viz_type": "table",
            "query_mode": "raw",
            "all_columns": ["region", "revenue"],
            "order_by_cols": ['["revenue", false]'],
        }
    )[0]
    pie = _query_objects(
        {
            "viz_type": "pie",
            "groupby": ["region"],
            "metric": "revenue",
            "sort_by_metric": True,
        }
    )[0]
    pivot = _query_objects(
        {
            "viz_type": "pivot_table_v2",
            "groupbyRows": ["region"],
            "groupbyColumns": ["channel"],
            "metrics": ["revenue"],
            "rowTotals": True,
            "colTotals": True,
        }
    )[0]

    assert histogram.post_processing[0]["options"] == {
        "column": "value",
        "groupby": ["region"],
        "bins": 12,
        "cumulative": False,
        "normalize": True,
    }
    assert box.post_processing[0]["options"] == {
        "whisker_type": "percentile",
        "percentiles": [10, 90],
        "groupby": ["region"],
        "metrics": ["revenue"],
    }
    assert raw_table.orderby == [["revenue", False]]
    assert pie.orderby == [["revenue", False]]
    assert pie.post_processing[0]["options"] == {
        "columns": ["revenue"],
        "rename_columns": ["revenue__contribution"],
    }
    assert pivot.orderby == [["revenue", False]]
    assert pivot.grouping_sets == [[], ["channel"], ["region"], ["region", "channel"]]


def test_table_frontend_contract_includes_pagination_percent_and_totals_queries(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(
        "superset.mcp_service.chart.chart_helpers.resolve_datasource_engine",
        lambda *_args: "base",
    )
    metric = {
        "expressionType": "SIMPLE",
        "column": {"column_name": "revenue"},
        "aggregate": "SUM",
        "label": "revenue",
    }
    queries = _query_objects(
        {
            "viz_type": "table",
            "query_mode": "aggregate",
            "groupby": ["event_time", "region"],
            "metrics": [metric],
            "percent_metrics": [metric],
            "percent_metric_calculation": "all_records",
            "show_totals": True,
            "totals_aggregate": "AVG",
            "server_pagination": True,
            "server_page_length": 25,
            "row_limit": 100,
            "time_compare": ["1 year ago"],
            "comparison_type": "difference",
            "time_grain_sqla": "P1D",
            "temporal_columns_lookup": {"event_time": True},
        }
    )

    assert len(queries) == 4
    main, rowcount, all_records, totals = queries
    temporal_column = main.columns[0]
    assert isinstance(temporal_column, dict)
    assert temporal_column["columnType"] == "BASE_AXIS"
    assert main.row_limit == 25
    assert main.time_offsets == ["1 year ago"]
    assert [item["operation"] for item in main.post_processing] == [
        "contribution",
        "compare",
    ]
    assert rowcount.is_rowcount is True
    assert rowcount.row_limit == 100
    assert all_records.columns == []
    assert all_records.metrics == [metric]
    assert totals.columns == []
    assert totals.metrics is not None
    totals_metric = totals.metrics[0]
    assert isinstance(totals_metric, dict)
    assert totals_metric["aggregate"] == "AVG"
    assert totals.post_processing[0]["operation"] == "contribution"


def test_big_number_raw_frontend_contract_has_isolated_second_query(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(
        "superset.mcp_service.chart.chart_helpers.resolve_datasource_engine",
        lambda *_args: "base",
    )
    trend, raw = _query_objects(
        {
            "viz_type": "big_number",
            "metric": "revenue",
            "x_axis": "event_time",
            "aggregation": "raw",
        }
    )

    assert trend.columns == ["event_time"]
    assert trend.series_columns == []
    assert trend.post_processing[0]["options"]["index"] == ["event_time"]
    assert trend.post_processing[0]["options"]["columns"] == []
    assert trend.post_processing[-1]["operation"] == "flatten"
    assert raw.columns == []
    assert raw.series_columns == []
    assert raw.is_timeseries is False
    assert raw.post_processing == []


@pytest.mark.parametrize(
    "metric, metric_label, temporal_form_data, axis_label",
    [
        (
            "saved_revenue",
            "saved_revenue",
            {"x_axis": "event_time"},
            "event_time",
        ),
        (
            {
                "expressionType": "SIMPLE",
                "column": {"column_name": "revenue"},
                "aggregate": "SUM",
                "label": "Gross revenue",
            },
            "Gross revenue",
            {"granularity_sqla": "event_time"},
            DTTM_ALIAS,
        ),
        (
            {
                "expressionType": "SQL",
                "sqlExpression": "SUM(revenue) - SUM(cost)",
                "label": "Net revenue",
            },
            "Net revenue",
            {"granularity_sqla": "event_time"},
            DTTM_ALIAS,
        ),
    ],
)
def test_big_number_trendline_query_and_pandas_metric_alias_parity(
    monkeypatch: pytest.MonkeyPatch,
    app_context: None,
    metric: Any,
    metric_label: str,
    temporal_form_data: dict[str, Any],
    axis_label: str,
) -> None:
    """Pin saved/SIMPLE/SQL aliases through final pandas post-processing."""
    monkeypatch.setattr(
        "superset.mcp_service.chart.chart_helpers.resolve_datasource_engine",
        lambda *_args: "base",
    )
    trend, raw = _query_objects(
        {
            "viz_type": "big_number",
            "metric": metric,
            "aggregation": "raw",
            "time_grain_sqla": "P1D",
            "time_range": "Last week",
            "adhoc_filters": [
                {
                    "clause": "WHERE",
                    "expressionType": "SIMPLE",
                    "subject": "region",
                    "operator": "==",
                    "comparator": "North",
                }
            ],
            **temporal_form_data,
        }
    )

    expected_columns = ["event_time"] if "x_axis" in temporal_form_data else []
    assert trend.columns == expected_columns
    assert trend.series_columns == []
    assert trend.metrics == [metric]
    assert trend.granularity == temporal_form_data.get("granularity_sqla")
    assert trend.extras["time_grain_sqla"] == "P1D"
    assert trend.time_range == "Last week"
    assert trend.filter == [{"col": "region", "op": "==", "val": "North"}]
    assert trend.post_processing[0]["options"] == {
        "index": [axis_label],
        "columns": [],
        "aggregates": {metric_label: {"operator": "mean"}},
        "drop_missing_columns": True,
    }

    result = trend.exec_post_processing(
        pd.DataFrame(
            {
                axis_label: pd.to_datetime(["2024-01-01", "2024-01-02"]),
                metric_label: [10.0, 12.5],
            }
        )
    )
    assert list(result.columns) == [axis_label, metric_label]
    assert result[metric_label].tolist() == [10.0, 12.5]

    assert raw.columns == []
    assert raw.series_columns == []
    assert raw.metrics == [metric]
    assert raw.is_timeseries is False
    assert raw.post_processing == []


def test_typed_big_number_temporal_mapping_uses_backend_timestamp_only(
    monkeypatch: pytest.MonkeyPatch,
    app_context: None,
) -> None:
    """Typed temporal_column maps to granularity without a redundant raw field."""
    monkeypatch.setattr(
        "superset.mcp_service.chart.chart_helpers.resolve_datasource_engine",
        lambda *_args: "base",
    )
    form_data = map_big_number_config(
        BigNumberChartConfig(
            chart_type="big_number",
            metric=ColumnRef(
                name="revenue",
                aggregate="SUM",
                label="Typed revenue",
            ),
            temporal_column="event_time",
            time_grain="P1M",
            show_trendline=True,
            aggregation="sum",
            filters=[FilterConfig(column="region", op="=", value="North")],
        )
    )

    assert "x_axis" not in form_data
    query = _query_objects(form_data)[0]
    assert query.columns == []
    assert query.series_columns == []
    assert query.granularity == "event_time"
    assert query.is_timeseries is True
    assert query.extras["time_grain_sqla"] == "P1M"
    assert query.post_processing[0]["options"]["index"] == [DTTM_ALIAS]
    assert query.post_processing[0]["options"]["columns"] == []

    # The backend timeseries alias is sufficient; the physical event_time field
    # is deliberately absent from the dataframe returned by the raw SQL query.
    result = query.exec_post_processing(
        pd.DataFrame(
            {
                DTTM_ALIAS: pd.to_datetime(["2024-01-01", "2024-02-01"]),
                "Typed revenue": [20.0, 30.0],
            }
        )
    )
    assert list(result.columns) == [DTTM_ALIAS, "Typed revenue"]
    assert result["Typed revenue"].tolist() == [20.0, 30.0]


def test_big_number_total_query_remains_non_timeseries_and_unprocessed(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(
        "superset.mcp_service.chart.chart_helpers.resolve_datasource_engine",
        lambda *_args: "base",
    )
    metric = {
        "expressionType": "SQL",
        "sqlExpression": "SUM(revenue)",
        "label": "Total revenue",
    }
    query = _query_objects(
        {
            "viz_type": "big_number_total",
            "metric": metric,
            "granularity_sqla": "event_time",
        }
    )[0]

    assert query.columns == []
    assert query.metrics == [metric]
    assert query.series_columns == []
    assert query.is_timeseries is False
    assert query.post_processing == []


@pytest.mark.parametrize(
    "form_data, message",
    [
        (
            {
                "start_time": "started",
                "end_time": "ended",
                "y_axis": "task",
                "order_by_cols": ['["started", 1]'],
            },
            "ascending_boolean",
        ),
        (
            {"start_time": "started", "end_time": "ended", "y_axis": "task"},
            None,
        ),
    ],
)
def test_gantt_frontend_contract_is_strict_and_bounded(
    monkeypatch: pytest.MonkeyPatch,
    form_data: dict[str, object],
    message: str | None,
) -> None:
    monkeypatch.setattr(
        "superset.mcp_service.chart.chart_helpers.resolve_datasource_engine",
        lambda *_args: "base",
    )
    form_data = {"viz_type": "gantt_chart", **form_data}
    if message is None:
        form_data["tooltip_columns"] = [f"column_{index}" for index in range(51)]
        message = "at most 50"
    with pytest.raises(ValueError, match=message):
        _query_objects(form_data)


def test_waterfall_final_query_matches_frontend_column_and_ordering_semantics(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(
        "superset.mcp_service.chart.chart_helpers.resolve_datasource_engine",
        lambda *_args: "base",
    )
    query = _query_objects(
        {
            "viz_type": "waterfall",
            "x_axis": "event_time",
            "granularity_sqla": "event_time",
            "time_grain_sqla": "P1M",
            "metric": "revenue",
            "groupby": ["region", "channel"],
            # Waterfall's plugin intentionally replaces generic orderby.
            "orderby": [["revenue", False]],
            "adhoc_filters": [],
        }
    )[0]

    assert query.columns == ["event_time", "region", "channel"]
    assert query.orderby == [
        ["event_time", True],
        ["region", True],
        ["channel", True],
    ]
    assert query.granularity == "event_time"
    assert query.extras["time_grain_sqla"] == "P1M"


def test_waterfall_uses_granularity_subject_when_x_axis_is_absent(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(
        "superset.mcp_service.chart.chart_helpers.resolve_datasource_engine",
        lambda *_args: "base",
    )
    query = _query_objects(
        {
            "viz_type": "waterfall",
            "granularity_sqla": "event_time",
            "metric": "revenue",
            "groupby": ["region"],
            "adhoc_filters": [],
        }
    )[0]

    assert query.columns == ["event_time", "region"]
    assert query.orderby == [["event_time", True], ["region", True]]


def test_merge_form_data_filters_into_query_applies_regular_overrides():
    query = {
        "filters": [{"col": "country", "op": "==", "val": "US"}],
        "time_range": "Last year",
        "granularity": "created_at",
        "time_grain": "P1Y",
        "time_grain_sqla": "P1Y",
        "where": "region = 'NA'",
        "having": "SUM(num) > 10",
    }

    merge_form_data_filters_into_query(
        query,
        {
            "filters": [{"col": "gender", "op": "==", "val": "boy"}],
            "time_range": "No filter",
            "granularity": "updated_at",
            "time_grain": "P1D",
            "time_grain_sqla": "P1D",
            "where": "name IS NOT NULL",
            "having": "COUNT(*) > 1",
        },
    )

    assert query["filters"] == [
        {"col": "country", "op": "==", "val": "US"},
        {"col": "gender", "op": "==", "val": "boy"},
    ]
    assert query["time_range"] == "No filter"
    assert query["granularity"] == "updated_at"
    # time_grain_sqla is an extras field on the query object, not a top-level one.
    assert query["extras"]["time_grain_sqla"] == "P1D"
    # time_grain is not a query object field, so the merge leaves whatever the
    # saved query context already had rather than writing a key the schema drops.
    assert query["time_grain"] == "P1Y"
    assert query["where"] == "(region = 'NA') AND (name IS NOT NULL)"
    assert query["having"] == "(SUM(num) > 10) AND (COUNT(*) > 1)"


def test_filter_helpers_copy_relative_time_extras():
    """Relative time anchors reach both saved and freshly built queries."""
    extras = {"relative_start": "now", "relative_end": "today"}

    fresh_query = {"extras": {"where": "country = 'US'"}}
    apply_form_data_filters_to_query(fresh_query, {"extras": extras})
    assert fresh_query["extras"] == {"where": "country = 'US'", **extras}

    saved_query = {"extras": {"having": "COUNT(*) > 1"}}
    merge_form_data_filters_into_query(saved_query, {"extras": extras})
    assert saved_query["extras"] == {"having": "COUNT(*) > 1", **extras}


def test_merge_extra_form_data_filters_into_query_adds_only_extra_predicates(
    monkeypatch,
):
    monkeypatch.setattr(
        "superset.mcp_service.chart.chart_helpers.resolve_datasource_engine",
        lambda datasource_id, datasource_type: "base",
    )
    query = {
        "filters": [{"col": "country", "op": "==", "val": "US"}],
        "time_range": "Last year",
        "granularity": "created_at",
        "time_grain_sqla": "P1Y",
    }

    merge_extra_form_data_filters_into_query(
        query,
        {
            "filters": [{"col": "gender", "op": "==", "val": "boy"}],
            "granularity_sqla": "updated_at",
            "time_range": "No filter",
            "time_grain_sqla": "P1D",
        },
        1,
        "table",
    )

    assert query["filters"] == [
        {"col": "country", "op": "==", "val": "US"},
        {"col": "gender", "op": "==", "val": "boy"},
    ]
    assert query["time_range"] == "No filter"
    assert query["granularity"] == "updated_at"
    # The grain belongs in extras: a top-level time_grain_sqla is dropped by
    # ChartDataQueryObjectSchema (unknown = EXCLUDE) and never reaches the query.
    assert query["extras"]["time_grain_sqla"] == "P1D"


def test_merge_extra_form_data_time_grain_override_lands_in_extras(monkeypatch):
    """A time_grain_sqla override must reach the query object.

    Regression test: the override used to be written as a top-level query key,
    where ChartDataQueryObjectSchema silently discarded it, so callers passing
    a grain through extra_form_data got the chart's original grain back.
    """
    monkeypatch.setattr(
        "superset.mcp_service.chart.chart_helpers.resolve_datasource_engine",
        lambda datasource_id, datasource_type: "base",
    )
    query: dict = {"columns": ["country"], "metrics": ["count"], "filters": []}

    merge_extra_form_data_filters_into_query(
        query, {"time_grain_sqla": "P1M"}, 1, "table"
    )

    assert query["extras"]["time_grain_sqla"] == "P1M"


def test_merge_extra_form_data_time_grain_preserves_existing_extras(monkeypatch):
    """Routing the grain into extras must not clobber other extras."""
    monkeypatch.setattr(
        "superset.mcp_service.chart.chart_helpers.resolve_datasource_engine",
        lambda datasource_id, datasource_type: "base",
    )
    query: dict = {"filters": [], "extras": {"where": "country = 'US'"}}

    merge_extra_form_data_filters_into_query(
        query, {"time_grain_sqla": "P1M"}, 1, "table"
    )

    assert query["extras"]["time_grain_sqla"] == "P1M"
    assert query["extras"]["where"] == "country = 'US'"


# ---------------------------------------------------------------------------
# resolve_deck_gl_columns
# ---------------------------------------------------------------------------


def test_resolve_deck_gl_columns_latlong():
    form_data = {
        "spatial": {"type": "latlong", "lonCol": "longitude", "latCol": "latitude"},
    }
    assert resolve_deck_gl_columns(form_data) == ["longitude", "latitude"]


def test_resolve_deck_gl_columns_delimited():
    form_data = {
        "spatial": {"type": "delimited", "lonlatCol": "coords"},
    }
    assert resolve_deck_gl_columns(form_data) == ["coords"]


def test_resolve_deck_gl_columns_geohash():
    form_data = {
        "spatial": {"type": "geohash", "geohashCol": "geo"},
    }
    assert resolve_deck_gl_columns(form_data) == ["geo"]


def test_resolve_deck_gl_columns_arc_start_end():
    form_data = {
        "start_spatial": {
            "type": "latlong",
            "lonCol": "start_lon",
            "latCol": "start_lat",
        },
        "end_spatial": {"type": "latlong", "lonCol": "end_lon", "latCol": "end_lat"},
    }
    cols = resolve_deck_gl_columns(form_data)
    assert cols == ["start_lon", "start_lat", "end_lon", "end_lat"]


def test_resolve_deck_gl_columns_path_line_column():
    form_data = {
        "line_column": "path_wkt",
    }
    assert resolve_deck_gl_columns(form_data) == ["path_wkt"]


def test_resolve_deck_gl_columns_geojson():
    form_data = {
        "geojson": "geom_col",
    }
    assert resolve_deck_gl_columns(form_data) == ["geom_col"]


def test_resolve_deck_gl_columns_with_dimension():
    form_data = {
        "spatial": {"type": "latlong", "lonCol": "lon", "latCol": "lat"},
        "dimension": "category",
    }
    cols = resolve_deck_gl_columns(form_data)
    assert "lon" in cols
    assert "lat" in cols
    assert "category" in cols


def test_resolve_deck_gl_columns_deduplicates():
    form_data = {
        "spatial": {"type": "latlong", "lonCol": "lon", "latCol": "lat"},
        "dimension": "lon",  # same as lonCol — should not duplicate
    }
    cols = resolve_deck_gl_columns(form_data)
    assert cols.count("lon") == 1


def test_resolve_deck_gl_columns_empty():
    assert resolve_deck_gl_columns({}) == []


# ---------------------------------------------------------------------------
# build_query_dicts_from_form_data — Deck.gl branch
# ---------------------------------------------------------------------------


def test_build_query_dicts_deck_scatter_latlong(monkeypatch):
    monkeypatch.setattr(
        "superset.mcp_service.chart.chart_helpers.resolve_datasource_engine",
        lambda datasource_id, datasource_type: "base",
    )
    form_data = {
        "viz_type": "deck_scatter",
        "spatial": {"type": "latlong", "lonCol": "lon", "latCol": "lat"},
        "adhoc_filters": [],
    }

    queries = build_query_dicts_from_form_data(form_data, 1, "table")

    assert len(queries) == 1
    assert queries[0]["columns"] == ["lon", "lat"]
    assert queries[0]["metrics"] == []


def test_build_query_dicts_deck_scatter_with_size_metric(monkeypatch):
    monkeypatch.setattr(
        "superset.mcp_service.chart.chart_helpers.resolve_datasource_engine",
        lambda datasource_id, datasource_type: "base",
    )
    metric = {
        "expressionType": "SIMPLE",
        "column": {"column_name": "sales"},
        "aggregate": "SUM",
    }
    form_data = {
        "viz_type": "deck_scatter",
        "spatial": {"type": "latlong", "lonCol": "lon", "latCol": "lat"},
        "size": metric,
        "adhoc_filters": [],
    }

    queries = build_query_dicts_from_form_data(form_data, 1, "table")

    assert len(queries) == 1
    assert queries[0]["columns"] == ["lon", "lat"]
    assert queries[0]["metrics"] == [metric]


def test_build_query_dicts_deck_arc(monkeypatch):
    monkeypatch.setattr(
        "superset.mcp_service.chart.chart_helpers.resolve_datasource_engine",
        lambda datasource_id, datasource_type: "base",
    )
    form_data = {
        "viz_type": "deck_arc",
        "start_spatial": {
            "type": "latlong",
            "lonCol": "origin_lon",
            "latCol": "origin_lat",
        },
        "end_spatial": {"type": "latlong", "lonCol": "dest_lon", "latCol": "dest_lat"},
        "adhoc_filters": [],
    }

    queries = build_query_dicts_from_form_data(form_data, 1, "table")

    assert len(queries) == 1
    assert queries[0]["columns"] == ["origin_lon", "origin_lat", "dest_lon", "dest_lat"]
    assert queries[0]["metrics"] == []


def test_build_query_dicts_deck_geojson(monkeypatch):
    monkeypatch.setattr(
        "superset.mcp_service.chart.chart_helpers.resolve_datasource_engine",
        lambda datasource_id, datasource_type: "base",
    )
    form_data = {
        "viz_type": "deck_geojson",
        "geojson": "geometry",
        "adhoc_filters": [],
    }

    queries = build_query_dicts_from_form_data(form_data, 1, "table")

    assert len(queries) == 1
    assert queries[0]["columns"] == ["geometry"]
    assert queries[0]["metrics"] == []


def test_build_query_dicts_deck_hex_geohash(monkeypatch):
    monkeypatch.setattr(
        "superset.mcp_service.chart.chart_helpers.resolve_datasource_engine",
        lambda datasource_id, datasource_type: "base",
    )
    form_data = {
        "viz_type": "deck_hex",
        "spatial": {"type": "geohash", "geohashCol": "geohash"},
        "adhoc_filters": [],
    }

    queries = build_query_dicts_from_form_data(form_data, 1, "table")

    assert len(queries) == 1
    assert queries[0]["columns"] == ["geohash"]


def test_build_query_dicts_deck_path_with_row_limit(monkeypatch):
    monkeypatch.setattr(
        "superset.mcp_service.chart.chart_helpers.resolve_datasource_engine",
        lambda datasource_id, datasource_type: "base",
    )
    form_data = {
        "viz_type": "deck_path",
        "line_column": "path_col",
        "adhoc_filters": [],
    }

    queries = build_query_dicts_from_form_data(form_data, 1, "table", row_limit=50)

    assert queries[0]["columns"] == ["path_col"]
    assert queries[0]["row_limit"] == 50


# ---------------------------------------------------------------------------
# resolve_deck_gl_columns — display-only fields excluded
# ---------------------------------------------------------------------------


def test_resolve_deck_gl_columns_ignores_tooltip_contents():
    # tooltip_contents are display-only; BaseDeckGLViz.query_obj() does not
    # include them in columns/groupby, so the fallback should not either.
    form_data = {
        "spatial": {"type": "latlong", "lonCol": "lon", "latCol": "lat"},
        "tooltip_contents": ["name", "category"],
    }
    cols = resolve_deck_gl_columns(form_data)
    assert "name" not in cols
    assert "category" not in cols


def test_resolve_deck_gl_columns_ignores_cross_filter_column():
    form_data = {
        "spatial": {"type": "latlong", "lonCol": "lon", "latCol": "lat"},
        "cross_filter_column": "region",
    }
    cols = resolve_deck_gl_columns(form_data)
    assert "region" not in cols


# ---------------------------------------------------------------------------
# _is_metric_ref
# ---------------------------------------------------------------------------


def test_is_metric_ref_dict():
    assert _is_metric_ref({"expressionType": "SIMPLE"}) is True


def test_is_metric_ref_string_key():
    assert _is_metric_ref("count") is True
    assert _is_metric_ref("sum__sales") is True


def test_is_metric_ref_numeric_string_excluded():
    assert _is_metric_ref("100") is False
    assert _is_metric_ref("3.14") is False
    assert _is_metric_ref("0") is False


def test_is_metric_ref_integer_excluded():
    assert _is_metric_ref(100) is False


def test_is_metric_ref_none_and_empty():
    assert _is_metric_ref(None) is False
    assert _is_metric_ref("") is False


# ---------------------------------------------------------------------------
# _resolve_deck_gl_metrics (Fix 2)
# ---------------------------------------------------------------------------


def test_resolve_deck_gl_metrics_no_metrics():
    assert _resolve_deck_gl_metrics({}) == []


def test_resolve_deck_gl_metrics_size_field():
    metric = {"expressionType": "SIMPLE", "aggregate": "COUNT", "column": None}
    result = _resolve_deck_gl_metrics({"size": metric})
    assert result == [metric]


def test_resolve_deck_gl_metrics_metric_field():
    metric = {"expressionType": "SIMPLE", "aggregate": "SUM"}
    result = _resolve_deck_gl_metrics({"metric": metric})
    assert result == [metric]


def test_resolve_deck_gl_metrics_point_radius_fixed_metric():
    prf_metric = {"expressionType": "SIMPLE", "aggregate": "AVG"}
    prf = {"type": "metric", "value": prf_metric}
    result = _resolve_deck_gl_metrics({"point_radius_fixed": prf})
    assert result == [prf_metric]


def test_resolve_deck_gl_metrics_point_radius_fixed_not_metric():
    prf = {"type": "fix", "value": 100}
    result = _resolve_deck_gl_metrics({"point_radius_fixed": prf})
    assert result == []


def test_resolve_deck_gl_metrics_polygon_both_metric_and_prf():
    base_metric = {"expressionType": "SIMPLE", "aggregate": "SUM"}
    elevation_metric = {"expressionType": "SIMPLE", "aggregate": "AVG"}
    prf = {"type": "metric", "value": elevation_metric}
    result = _resolve_deck_gl_metrics(
        {"metric": base_metric, "point_radius_fixed": prf}
    )
    assert result == [base_metric, elevation_metric]


def test_resolve_deck_gl_metrics_geojson_returns_empty():
    # deck_geojson.query_obj() forces metrics=[] regardless of form_data
    metric = {"expressionType": "SIMPLE", "aggregate": "SUM"}
    result = _resolve_deck_gl_metrics(
        {"size": metric, "metric": metric}, "deck_geojson"
    )
    assert result == []


def test_resolve_deck_gl_metrics_scalar_size_excluded():
    # Numeric string size values (fixed display settings) must not be metrics
    result = _resolve_deck_gl_metrics({"size": "100"}, "deck_hex")
    assert result == []


def test_resolve_deck_gl_metrics_integer_size_excluded():
    result = _resolve_deck_gl_metrics({"size": 100}, "deck_path")
    assert result == []


def test_resolve_deck_gl_metrics_string_metric_included():
    # Non-numeric string metrics (saved metric keys) must be preserved
    result = _resolve_deck_gl_metrics({"size": "count"}, "deck_hex")
    assert result == ["count"]


def test_resolve_deck_gl_metrics_string_metric_field():
    result = _resolve_deck_gl_metrics({"metric": "sum__sales"}, "deck_arc")
    assert result == ["sum__sales"]


def test_resolve_deck_gl_metrics_string_point_radius_fixed():
    # Legacy deck_scatter: point_radius_fixed as a bare metric key string
    result = _resolve_deck_gl_metrics({"point_radius_fixed": "count"}, "deck_scatter")
    assert result == ["count"]


def test_resolve_deck_gl_metrics_numeric_point_radius_fixed_excluded():
    # Numeric string point_radius_fixed is a fixed pixel radius, not a metric
    result = _resolve_deck_gl_metrics({"point_radius_fixed": "100"}, "deck_scatter")
    assert result == []


def test_resolve_deck_gl_metrics_non_string_point_radius_fixed_excluded():
    # Non-string point_radius_fixed values (int, None, list) are excluded by
    # the isinstance(prf, str) guard in the elif branch
    assert _resolve_deck_gl_metrics({"point_radius_fixed": 100}, "deck_scatter") == []
    assert _resolve_deck_gl_metrics({"point_radius_fixed": None}, "deck_scatter") == []
    assert (
        _resolve_deck_gl_metrics({"point_radius_fixed": ["bad"]}, "deck_scatter") == []
    )


# ---------------------------------------------------------------------------
# _deck_gl_null_filters (Fix 3)
# ---------------------------------------------------------------------------


def test_deck_gl_null_filters_latlong():
    form_data = {
        "spatial": {"type": "latlong", "lonCol": "lon", "latCol": "lat"},
    }
    result = _deck_gl_null_filters(form_data)
    assert result == [
        {"col": "lon", "op": "IS NOT NULL", "val": ""},
        {"col": "lat", "op": "IS NOT NULL", "val": ""},
    ]


def test_deck_gl_null_filters_arc_start_end():
    form_data = {
        "start_spatial": {"type": "latlong", "lonCol": "s_lon", "latCol": "s_lat"},
        "end_spatial": {"type": "latlong", "lonCol": "e_lon", "latCol": "e_lat"},
    }
    result = _deck_gl_null_filters(form_data)
    assert result == [
        {"col": "s_lon", "op": "IS NOT NULL", "val": ""},
        {"col": "s_lat", "op": "IS NOT NULL", "val": ""},
        {"col": "e_lon", "op": "IS NOT NULL", "val": ""},
        {"col": "e_lat", "op": "IS NOT NULL", "val": ""},
    ]


def test_deck_gl_null_filters_line_column():
    form_data = {"line_column": "path_col"}
    result = _deck_gl_null_filters(form_data)
    assert result == [{"col": "path_col", "op": "IS NOT NULL", "val": ""}]


def test_deck_gl_null_filters_empty():
    assert _deck_gl_null_filters({}) == []


def test_deck_gl_null_filters_geojson_column():
    # geojson column gets an IS NOT NULL filter just like spatial columns
    form_data = {"geojson": "geometry"}
    assert _deck_gl_null_filters(form_data) == [
        {"col": "geometry", "op": "IS NOT NULL", "val": ""}
    ]


# ---------------------------------------------------------------------------
# build_query_dicts_from_form_data — null filters behavior (Fix 3)
# ---------------------------------------------------------------------------


def test_build_query_dicts_deck_scatter_adds_null_filters_by_default(monkeypatch):
    monkeypatch.setattr(
        "superset.mcp_service.chart.chart_helpers.resolve_datasource_engine",
        lambda datasource_id, datasource_type: "base",
    )
    form_data = {
        "viz_type": "deck_scatter",
        "spatial": {"type": "latlong", "lonCol": "lon", "latCol": "lat"},
        "adhoc_filters": [],
    }

    queries = build_query_dicts_from_form_data(form_data, 1, "table")

    assert {"col": "lon", "op": "IS NOT NULL", "val": ""} in queries[0]["filters"]
    assert {"col": "lat", "op": "IS NOT NULL", "val": ""} in queries[0]["filters"]


def test_build_query_dicts_deck_scatter_filter_nulls_false(monkeypatch):
    monkeypatch.setattr(
        "superset.mcp_service.chart.chart_helpers.resolve_datasource_engine",
        lambda datasource_id, datasource_type: "base",
    )
    form_data = {
        "viz_type": "deck_scatter",
        "spatial": {"type": "latlong", "lonCol": "lon", "latCol": "lat"},
        "filter_nulls": False,
        "adhoc_filters": [],
    }

    queries = build_query_dicts_from_form_data(form_data, 1, "table")

    null_filters = [
        f for f in queries[0].get("filters", []) if f.get("op") == "IS NOT NULL"
    ]
    assert null_filters == []


def test_build_query_dicts_deck_scatter_point_radius_fixed_metric(monkeypatch):
    monkeypatch.setattr(
        "superset.mcp_service.chart.chart_helpers.resolve_datasource_engine",
        lambda datasource_id, datasource_type: "base",
    )
    radius_metric = {
        "expressionType": "SIMPLE",
        "aggregate": "AVG",
        "column": {"column_name": "radius"},
    }
    form_data = {
        "viz_type": "deck_scatter",
        "spatial": {"type": "latlong", "lonCol": "lon", "latCol": "lat"},
        "point_radius_fixed": {"type": "metric", "value": radius_metric},
        "adhoc_filters": [],
    }

    queries = build_query_dicts_from_form_data(form_data, 1, "table")

    assert queries[0]["metrics"] == [radius_metric]


def test_build_query_dicts_deck_geojson_scalar_size_produces_no_metrics(monkeypatch):
    # Regression: deck_geojson fixture has size='100' (scalar, not a metric).
    # The fallback must produce metrics=[] to match DeckGeoJson.query_obj().
    monkeypatch.setattr(
        "superset.mcp_service.chart.chart_helpers.resolve_datasource_engine",
        lambda datasource_id, datasource_type: "base",
    )
    form_data = {
        "viz_type": "deck_geojson",
        "geojson": "geometry",
        "size": "100",
        "adhoc_filters": [],
    }

    queries = build_query_dicts_from_form_data(form_data, 1, "table")

    assert queries[0]["metrics"] == []


def test_build_query_dicts_deck_path_scalar_size_produces_no_metrics(monkeypatch):
    # deck_path fixture also has size='100' — scalar must not become a metric.
    monkeypatch.setattr(
        "superset.mcp_service.chart.chart_helpers.resolve_datasource_engine",
        lambda datasource_id, datasource_type: "base",
    )
    form_data = {
        "viz_type": "deck_path",
        "line_column": "path_col",
        "size": "100",
        "adhoc_filters": [],
    }

    queries = build_query_dicts_from_form_data(form_data, 1, "table")

    assert queries[0]["metrics"] == []


def test_build_query_dicts_deck_geojson_adds_geojson_null_filter(monkeypatch):
    # deck_geojson should add IS NOT NULL on the geojson column when filter_nulls
    monkeypatch.setattr(
        "superset.mcp_service.chart.chart_helpers.resolve_datasource_engine",
        lambda datasource_id, datasource_type: "base",
    )
    form_data = {
        "viz_type": "deck_geojson",
        "geojson": "geometry_col",
        "adhoc_filters": [],
    }

    queries = build_query_dicts_from_form_data(form_data, 1, "table")

    assert {"col": "geometry_col", "op": "IS NOT NULL", "val": ""} in queries[0][
        "filters"
    ]


def test_build_query_dicts_deck_hex_string_metric(monkeypatch):
    # Non-numeric string size (saved metric key) must be included as a metric
    monkeypatch.setattr(
        "superset.mcp_service.chart.chart_helpers.resolve_datasource_engine",
        lambda datasource_id, datasource_type: "base",
    )
    form_data = {
        "viz_type": "deck_hex",
        "spatial": {"type": "geohash", "geohashCol": "geo"},
        "size": "count",
        "adhoc_filters": [],
    }

    queries = build_query_dicts_from_form_data(form_data, 1, "table")

    assert queries[0]["metrics"] == ["count"]


def test_build_query_dicts_deck_scatter_string_point_radius_fixed(monkeypatch):
    # Legacy deck_scatter with point_radius_fixed as a bare metric key string
    monkeypatch.setattr(
        "superset.mcp_service.chart.chart_helpers.resolve_datasource_engine",
        lambda datasource_id, datasource_type: "base",
    )
    form_data = {
        "viz_type": "deck_scatter",
        "spatial": {"type": "latlong", "lonCol": "lon", "latCol": "lat"},
        "point_radius_fixed": "count",
        "adhoc_filters": [],
    }

    queries = build_query_dicts_from_form_data(form_data, 1, "table")

    assert queries[0]["metrics"] == ["count"]


def test_build_query_dicts_deck_hex_orderby_when_metrics_present(monkeypatch):
    # Mirrors BaseDeckGLViz.query_obj(): orderby set from first metric (desc by default)
    monkeypatch.setattr(
        "superset.mcp_service.chart.chart_helpers.resolve_datasource_engine",
        lambda datasource_id, datasource_type: "base",
    )
    metric = {"expressionType": "SIMPLE", "aggregate": "COUNT", "column": None}
    form_data = {
        "viz_type": "deck_hex",
        "spatial": {"type": "geohash", "geohashCol": "geo"},
        "size": metric,
        "adhoc_filters": [],
    }

    queries = build_query_dicts_from_form_data(form_data, 1, "table")

    assert queries[0]["orderby"] == [(metric, False)]


def test_build_query_dicts_deck_scatter_no_orderby_without_metrics(monkeypatch):
    # No metrics → no orderby (pure spatial column query)
    monkeypatch.setattr(
        "superset.mcp_service.chart.chart_helpers.resolve_datasource_engine",
        lambda datasource_id, datasource_type: "base",
    )
    form_data = {
        "viz_type": "deck_scatter",
        "spatial": {"type": "latlong", "lonCol": "lon", "latCol": "lat"},
        "adhoc_filters": [],
    }

    queries = build_query_dicts_from_form_data(form_data, 1, "table")

    assert "orderby" not in queries[0]


def test_build_query_dicts_deck_arc_time_grain(monkeypatch):
    # deck_arc with time_grain_sqla → is_timeseries, granularity, extras set
    monkeypatch.setattr(
        "superset.mcp_service.chart.chart_helpers.resolve_datasource_engine",
        lambda datasource_id, datasource_type: "base",
    )
    form_data = {
        "viz_type": "deck_arc",
        "spatial": {"type": "latlong", "lonCol": "start_lon", "latCol": "start_lat"},
        "end_spatial": {
            "type": "latlong",
            "lonCol": "end_lon",
            "latCol": "end_lat",
        },
        "granularity_sqla": "ts",
        "time_grain_sqla": "P1D",
        "adhoc_filters": [],
    }

    queries = build_query_dicts_from_form_data(form_data, 1, "table")

    assert queries[0]["is_timeseries"] is True
    assert queries[0]["granularity"] == "ts"
    assert queries[0].get("extras", {}).get("time_grain_sqla") == "P1D"


def test_build_query_dicts_deck_geojson_ignores_time_grain(monkeypatch):
    # deck_geojson is not in _DECK_TIMESERIES_VIZ_TYPES; time grain fields not added
    monkeypatch.setattr(
        "superset.mcp_service.chart.chart_helpers.resolve_datasource_engine",
        lambda datasource_id, datasource_type: "base",
    )
    form_data = {
        "viz_type": "deck_geojson",
        "geojson": "geometry",
        "granularity_sqla": "ts",
        "time_grain_sqla": "P1D",
        "adhoc_filters": [],
    }

    queries = build_query_dicts_from_form_data(form_data, 1, "table")

    assert "is_timeseries" not in queries[0]
    assert queries[0].get("extras", {}).get("time_grain_sqla") is None


def test_resolve_metrics_plural():
    assert resolve_metrics({"metrics": ["count"]}, "echarts_timeseries_line") == [
        "count"
    ]


def test_resolve_metrics_singular_fallback():
    assert resolve_metrics({"metric": "count"}, "pie") == ["count"]


def test_resolve_metrics_explicit_none_does_not_crash():
    # form_data["metrics"] can be explicitly null (e.g. a cleared control),
    # not just absent — must not leak None past this function.
    assert resolve_metrics({"metrics": None}, "echarts_timeseries_line") == []


def test_resolve_metrics_explicit_none_falls_back_to_singular():
    assert resolve_metrics({"metrics": None, "metric": "count"}, "pie") == ["count"]


def test_resolve_metrics_and_groupby_big_number_singular_metric():
    metrics, groupby = resolve_metrics_and_groupby(
        {"viz_type": "big_number", "metric": "count", "groupby": ["region"]}
    )
    assert metrics == ["count"]
    # big_number never groups by, even if groupby is present in form_data
    assert groupby == []


def test_resolve_metrics_and_groupby_big_number_falls_back_to_plural_metrics():
    # Some saved/migrated form_data stores the metric under "metrics" (plural)
    # even for single-metric chart types; previously this metric was dropped
    # entirely, producing a chart with no metrics and no columns.
    metrics, groupby = resolve_metrics_and_groupby(
        {"viz_type": "big_number_total", "metrics": ["count"]}
    )
    assert metrics == ["count"]
    assert groupby == []


def test_resolve_metrics_and_groupby_big_number_no_metric_returns_empty():
    metrics, groupby = resolve_metrics_and_groupby({"viz_type": "big_number"})
    assert metrics == []
    assert groupby == []


def test_resolve_metrics_and_groupby_non_singular_viz_type_uses_standard_resolution():
    metrics, groupby = resolve_metrics_and_groupby(
        {
            "viz_type": "echarts_timeseries_line",
            "metrics": ["count"],
            "groupby": ["region"],
        }
    )
    assert metrics == ["count"]
    assert groupby == ["region"]
