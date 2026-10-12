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
    SunburstChartConfig,
    TableChartConfig,
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
    if (
        isinstance(form_data.get("x_axis"), str)
        and form_data["x_axis"] in expected_columns
    ):
        expected_columns = [
            {
                "columnType": "BASE_AXIS",
                "sqlExpression": form_data["x_axis"],
                "label": form_data["x_axis"],
                "expressionType": "SQL",
                "isColumnReference": True,
            }
            if column == form_data["x_axis"]
            else column
            for column in expected_columns
        ]
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
        assert queries[1]["columns"] == [
            {
                "columnType": "BASE_AXIS",
                "sqlExpression": "ds",
                "label": "ds",
                "expressionType": "SQL",
                "isColumnReference": True,
            },
            "product",
        ]
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
    assert trend["columns"] == []
    assert trend["is_timeseries"] is True
    assert trend["post_processing"][0]["options"]["index"] == ["__timestamp"]
    assert [rule["operation"] for rule in trend["post_processing"]] == [
        "pivot",
        "flatten",
    ]
    assert overall["columns"] == []
    assert overall["is_timeseries"] is False
    assert overall["post_processing"] == []


def _sunburst_replacement_config() -> SunburstChartConfig:
    return SunburstChartConfig(
        hierarchy=[{"name": "region"}, {"name": "country"}],
        metric={"name": "sales", "aggregate": "SUM"},
    )


def test_cached_table_rebind_drops_legacy_sql_predicates() -> None:
    """Top-level ``where``/``having`` reference the previous dataset."""
    cached = {
        "viz_type": "table",
        "datasource": "10__table",
        "query_mode": "aggregate",
        "groupby": ["region"],
        "metrics": ["count"],
        "where": "region = 'EMEA'",
        "having": "COUNT(*) > 5",
        "show_cell_bars": True,
    }
    config = TableChartConfig(columns=[{"name": "region"}])
    new_form_data = map_config_to_form_data(config)

    merged = merge_form_data_for_update(
        cached, new_form_data, config, dataset_rebind=True
    )

    assert "where" not in merged
    assert "having" not in merged
    with patch(
        "superset.mcp_service.chart.chart_helpers.resolve_datasource_engine",
        return_value="base",
    ):
        (query,) = build_query_dicts_from_form_data(merged, 99, "table")
    assert "region = 'EMEA'" not in str(query)
    assert "COUNT(*) > 5" not in str(query)


def test_cross_viz_rebind_from_unregistered_viz_uses_mapped_target() -> None:
    """A complete config replaces a source viz that has no role contract."""
    saved = {
        "viz_type": "word_cloud",
        "datasource": "10__table",
        "series": "old_word",
        "metric": "old_count",
        "rotation": "square",
        "adhoc_filters": [{"subject": "old_word"}],
        "color_scheme": "supersetColors",
    }
    config = _sunburst_replacement_config()
    new_form_data = map_config_to_form_data(config)

    merged = merge_form_data_for_update(
        saved, new_form_data, config, dataset_rebind=True
    )

    assert merged["viz_type"] == "sunburst_v2"
    assert merged["columns"] == ["region", "country"]
    assert merged["color_scheme"] == "supersetColors"
    assert {"series", "rotation", "adhoc_filters"}.isdisjoint(merged)
    assert "old_word" not in str(merged)
    assert "old_count" not in str(merged)


def test_cross_viz_dataset_only_scrub_still_requires_role_contract() -> None:
    """Without a replacement viz, an unknown source still fails closed."""
    with pytest.raises(ValueError, match="no complete dataset role contract"):
        scrub_dataset_bound_form_data({"viz_type": "word_cloud", "series": "old"})


def test_explicit_empty_filters_clear_legacy_predicates_on_cross_viz_update() -> None:
    """``filters=[]`` removes adhoc, legacy structured, and free-form SQL state."""
    saved = {
        "viz_type": "table",
        "datasource": "10__table",
        "query_mode": "aggregate",
        "groupby": ["region"],
        "metrics": ["count"],
        "adhoc_filters": [
            {
                "clause": "WHERE",
                "expressionType": "SIMPLE",
                "subject": "region",
                "operator": "==",
                "comparator": "EMEA",
            }
        ],
        "filters": [{"col": "region", "op": "==", "val": "EMEA"}],
        "where": "region = 'EMEA'",
        "having": "COUNT(*) > 5",
    }
    config = SunburstChartConfig(
        hierarchy=[{"name": "region"}, {"name": "country"}],
        metric={"name": "sales", "aggregate": "SUM"},
        filters=[],
    )
    new_form_data = map_config_to_form_data(config)

    merged = merge_form_data_for_update(saved, new_form_data, config)

    assert {"adhoc_filters", "filters", "where", "having"}.isdisjoint(merged)
    with patch(
        "superset.mcp_service.chart.chart_helpers.resolve_datasource_engine",
        return_value="base",
    ):
        (query,) = build_query_dicts_from_form_data(merged, 10, "table")
    assert query["filters"] == []
    assert "EMEA" not in str(query)


@pytest.mark.parametrize("chart_type", ["xy", "bar", "echarts_timeseries_bar"])
def test_typed_xy_metrics_alias_keeps_column_semantics(chart_type: str) -> None:
    """Only native Explore payloads read ``metrics`` strings as saved metrics."""
    request = GenerateChartRequest.model_validate(
        {
            "dataset_id": 7,
            "config": {
                "chart_type": chart_type,
                "x": {"name": "region"},
                "metrics": ["revenue"],
            },
        }
    )

    assert request.config is not None
    (metric,) = request.config.y
    assert metric.name == "revenue"
    assert metric.saved_metric is False
    mapped = map_config_to_form_data(request.config, dataset_id=7)
    (mapped_metric,) = mapped["metrics"]
    assert mapped_metric["expressionType"] == "SIMPLE"
    assert mapped_metric["aggregate"] == "SUM"
    assert mapped_metric["column"]["column_name"] == "revenue"


def test_native_xy_metrics_strings_remain_saved_metric_references() -> None:
    request = GenerateChartRequest.model_validate(
        {
            "dataset_id": 7,
            "config": {
                "viz_type": "echarts_timeseries_bar",
                "x_axis": "region",
                "metrics": ["revenue"],
            },
        }
    )

    assert request.config is not None
    (metric,) = request.config.y
    assert metric.name == "revenue"
    assert metric.saved_metric is True


def test_replacement_filters_drop_legacy_predicates_on_cross_viz_update() -> None:
    """Typed filters replace every saved predicate source, not only adhoc ones."""
    saved = {
        "viz_type": "table",
        "datasource": "10__table",
        "query_mode": "aggregate",
        "groupby": ["region"],
        "metrics": ["count"],
        "filters": [{"col": "region", "op": "==", "val": "EMEA"}],
        "extra_filters": [{"col": "region", "op": "in", "val": ["EMEA"]}],
        "where": "region = 'EMEA'",
        "having": "COUNT(*) > 5",
    }
    config = SunburstChartConfig(
        hierarchy=[{"name": "region"}, {"name": "country"}],
        metric={"name": "sales", "aggregate": "SUM"},
        filters=[{"column": "region", "op": "=", "value": "APAC"}],
    )
    new_form_data = map_config_to_form_data(config)

    merged = merge_form_data_for_update(saved, new_form_data, config)

    assert {"filters", "extra_filters", "where", "having"}.isdisjoint(merged)
    assert merged["adhoc_filters"] == new_form_data["adhoc_filters"]
    with patch(
        "superset.mcp_service.chart.chart_helpers.resolve_datasource_engine",
        return_value="base",
    ):
        (query,) = build_query_dicts_from_form_data(merged, 10, "table")
    assert "EMEA" not in str(query)
    assert "APAC" in str(query)


def test_replacement_filters_drop_legacy_predicates_on_same_viz_update() -> None:
    """A same-dataset Table replacement removes every legacy SQL source."""
    saved = {
        "viz_type": "table",
        "datasource": "10__table",
        "query_mode": "aggregate",
        "groupby": ["region"],
        "metrics": ["count"],
        "filters": [{"col": "region", "op": "==", "val": "EMEA"}],
        "extra_filters": [{"col": "region", "op": "in", "val": ["EMEA"]}],
        "where": "region = 'EMEA'",
        "having": "COUNT(*) > 5",
    }
    config = TableChartConfig(
        columns=[{"name": "region"}, {"name": "sales", "aggregate": "SUM"}],
        filters=[{"column": "region", "op": "=", "value": "APAC"}],
    )
    mapped = map_config_to_form_data(config, dataset_id=10)
    merged = merge_form_data_for_update(saved, mapped, config)

    assert merged["viz_type"] == saved["viz_type"]
    assert merged["datasource"] == saved["datasource"]
    assert {"filters", "extra_filters", "where", "having"}.isdisjoint(merged)
    with patch(
        "superset.mcp_service.chart.chart_helpers.resolve_datasource_engine",
        return_value="base",
    ):
        (query,) = build_query_dicts_from_form_data(merged, 10, "table")
    assert query["filters"] == [{"col": "region", "op": "==", "val": "APAC"}]
    assert not query.get("where")
    assert not query.get("having")
    assert not query.get("extras", {}).get("where")
    assert not query.get("extras", {}).get("having")
    assert "EMEA" not in str(query)


@pytest.mark.parametrize("viz_type", ["funnel", "unregistered_chart", ""])
def test_unadapted_viz_keeps_metric_ordering(viz_type: str) -> None:
    """Unadapted saved charts keep their top-N fallback ordering."""
    from superset.common.form_data_query_context import (
        build_query_context_from_form_data as build_common_context,
    )

    form_data = {
        "viz_type": viz_type,
        "groupby": ["stage"],
        "metric": "revenue",
        "sort_by_metric": True,
        "row_limit": 2,
    }
    (common_query,) = build_common_context(
        deepcopy(form_data), {"id": 10, "type": "table"}
    )["queries"]
    with patch(
        "superset.mcp_service.chart.chart_helpers.resolve_datasource_engine",
        return_value="base",
    ):
        (mcp_query,) = build_query_dicts_from_form_data(
            deepcopy(form_data), 10, "table"
        )
    for query in (common_query, mcp_query):
        assert query["columns"] == ["stage"]
        assert query["metrics"] == ["revenue"]
        assert query["row_limit"] == 2
        assert query["orderby"] == [["revenue", False]]


@pytest.mark.parametrize("replace_controls", [False, True])
def test_mixed_update_retains_omitted_secondary_query_controls(
    replace_controls: bool,
) -> None:
    """Presentation updates preserve query B without changing its semantics."""
    from superset.mcp_service.chart.schemas import MixedTimeseriesChartConfig

    secondary_controls = {
        "time_range_b": "2025-01-01 : 2025-02-01",
        "time_grain_sqla_b": "P1D",
        "row_limit_b": 27,
        "row_offset_b": 3,
        "series_limit_b": 4,
        "order_desc_b": False,
        "rolling_type_b": "sum",
        "rolling_periods_b": 3,
        "min_periods_b": 1,
        "resample_rule_b": "1D",
        "resample_method_b": "sum",
    }
    config_data = {
        "x": {"name": "event_time"},
        "y": [{"name": "revenue", "saved_metric": True}],
        "y_secondary": [{"name": "profit", "saved_metric": True}],
        "show_legend": False,
    }
    if replace_controls:
        config_data.update(time_range_b="Last year", row_limit_b=1)
    config = MixedTimeseriesChartConfig.model_validate(config_data)
    saved = {
        "viz_type": "mixed_timeseries",
        "datasource": "10__table",
        "x_axis": "event_time",
        "metrics": ["revenue"],
        "metrics_b": ["profit"],
        "granularity_sqla": "event_time",
        "time_range": "No filter",
        **secondary_controls,
    }
    merged = merge_form_data_for_update(
        saved, map_config_to_form_data(config, dataset_id=10), config
    )
    expected = {
        **secondary_controls,
        **({"time_range_b": "Last year", "row_limit_b": 1} if replace_controls else {}),
    }
    for key, value in expected.items():
        assert merged[key] == value
    with patch(
        "superset.mcp_service.chart.chart_helpers.resolve_datasource_engine",
        return_value="base",
    ):
        before = build_query_dicts_from_form_data(deepcopy(saved), 10, "table")[1]
        after = build_query_dicts_from_form_data(deepcopy(merged), 10, "table")[1]
    if replace_controls:
        assert after["time_range"] == "Last year"
        assert after["row_limit"] == 1
    else:
        assert after == before
        assert after["time_range"] == secondary_controls["time_range_b"]
        assert after["row_limit"] == 27


@pytest.mark.parametrize(
    "request_model",
    [GenerateChartRequest, UpdateChartRequest, UpdateChartPreviewRequest],
)
@pytest.mark.parametrize(
    "panel_grain,expected_grain",
    [
        ({}, "P1M"),
        ({"time_grain": "P1D"}, "P1D"),
        ({"time_grain_sqla": "P1W"}, "P1W"),
        ({"time_grain": None}, None),
    ],
    ids=["native-monthly", "typed-override", "native-panel-override", "explicit-clear"],
)
def test_native_xy_base_axis_grain_reaches_generated_and_updated_queries(
    request_model: type[
        GenerateChartRequest | UpdateChartRequest | UpdateChartPreviewRequest
    ],
    panel_grain: dict[str, str | None],
    expected_grain: str | None,
) -> None:
    """Native axis bucketing survives normalization without overriding panel state."""
    request = request_model.model_validate(
        {
            "dataset_id": 7,
            "identifier": 19,
            "config": {
                "viz_type": "echarts_timeseries_line",
                "x_axis": {
                    "expressionType": "SQL",
                    "columnType": "BASE_AXIS",
                    "sqlExpression": "ds",
                    "label": "ds",
                    "timeGrain": "P1M",
                },
                "metrics": ["revenue"],
                **panel_grain,
            },
        }
    )
    config = request.config
    assert config is not None
    assert config.time_grain == expected_grain
    with patch(
        "superset.mcp_service.chart.chart_utils.is_column_truly_temporal",
        return_value=True,
    ):
        mapped = map_config_to_form_data(config, dataset_id=7)
    if request_model is not GenerateChartRequest:
        mapped = merge_form_data_for_update(
            {
                "viz_type": "echarts_timeseries_line",
                "x_axis": "ds",
                "metrics": ["revenue"],
                **({"time_grain_sqla": "P1Y"} if expected_grain else {}),
            },
            mapped,
            config,
        )
    with patch(
        "superset.mcp_service.chart.chart_helpers.resolve_datasource_engine",
        return_value="base",
    ):
        query = build_query_dicts_from_form_data(mapped, 7, "table")[0]
    assert query["columns"][0]["sqlExpression"] == "ds"
    assert query["columns"][0].get("timeGrain") == expected_grain


@pytest.mark.parametrize("kind", ["line", "bar", "area", "scatter"])
@pytest.mark.parametrize(
    "grouping,expected",
    [
        ({}, ["region"]),
        ({"group_by": []}, []),
        ({"group_by": [{"name": "product"}]}, ["product"]),
        ({"groupby": []}, []),
    ],
    ids=["omitted", "clear", "replace", "native-clear"],
)
def test_xy_update_preserves_grouping_only_when_omitted(
    kind: str,
    grouping: dict[str, object],
    expected: list[str],
) -> None:
    """Stacking updates retain saved series; explicit grouping owns replacement."""
    from superset.mcp_service.chart.schemas import XYChartConfig

    config = XYChartConfig.model_validate(
        {
            "x": {"name": "ds"},
            "y": [{"name": "revenue", "saved_metric": True}],
            "kind": kind,
            "stacked": True,
            **grouping,
        }
    )
    with patch(
        "superset.mcp_service.chart.chart_utils.is_column_truly_temporal",
        return_value=True,
    ):
        mapped = map_config_to_form_data(config, dataset_id=7)
    saved = {
        "viz_type": mapped["viz_type"],
        "x_axis": "ds",
        "metrics": ["revenue"],
        "groupby": ["region"],
    }
    merged = merge_form_data_for_update(saved, deepcopy(mapped), config)
    assert merged.get("groupby", []) == expected
    assert merged["stack"] == "Stack"
    with patch(
        "superset.mcp_service.chart.chart_helpers.resolve_datasource_engine",
        return_value="base",
    ):
        query = build_query_dicts_from_form_data(merged, 7, "table")[0]
    assert query["series_columns"] == expected
    assert query["columns"][1:] == expected

    cross_viz = merge_form_data_for_update(
        {**saved, "viz_type": "pie"}, deepcopy(mapped), config
    )
    assert cross_viz.get("groupby", []) == (
        ["product"] if expected == ["product"] else []
    )


@pytest.mark.parametrize(
    "grouping,primary,secondary",
    [
        ({}, ["region"], ["product"]),
        ({"group_by": []}, [], ["product"]),
        ({"group_by_secondary": []}, ["region"], []),
        ({"group_by_secondary": None}, ["region"], []),
        ({"group_by": [], "group_by_secondary": []}, [], []),
        ({"group_by": None, "group_by_secondary": None}, [], []),
        ({"groupby": ["product"], "groupby_b": ["region"]}, ["product"], ["region"]),
    ],
)
def test_mixed_update_preserves_only_omitted_grouping(
    grouping: dict[str, list[str] | None], primary: list[str], secondary: list[str]
) -> None:
    """Presentation updates keep both queries' grouping, but explicit clears win."""
    from superset.mcp_service.chart.schemas import MixedTimeseriesChartConfig

    config = MixedTimeseriesChartConfig.model_validate(
        {
            "x": {"name": "ds"},
            "y": [{"name": "revenue", "saved_metric": True}],
            "y_secondary": [{"name": "cost", "saved_metric": True}],
            "show_value": True,
            **{
                key: ([{"name": value} for value in values] if values else values)
                for key, values in grouping.items()
            },
        }
    )
    with patch(
        "superset.mcp_service.chart.chart_utils.is_column_truly_temporal",
        return_value=True,
    ):
        mapped = map_config_to_form_data(config, dataset_id=7)
    saved = {
        "viz_type": "mixed_timeseries",
        "x_axis": "ds",
        "metrics": ["revenue"],
        "metrics_b": ["cost"],
        "groupby": ["region"],
        "groupby_b": ["product"],
    }
    merged = merge_form_data_for_update(saved, deepcopy(mapped), config)
    with patch(
        "superset.mcp_service.chart.chart_helpers.resolve_datasource_engine",
        return_value="base",
    ):
        queries = build_query_dicts_from_form_data(merged, 7, "table")
    assert [q["series_columns"] for q in queries] == [primary, secondary]
    assert merged["show_value"] is True
    cross = merge_form_data_for_update(
        {**saved, "viz_type": "pie"}, deepcopy(mapped), config
    )
    assert cross.get("groupby", []) == (
        primary if {"group_by", "groupby"} & grouping.keys() else []
    )
    assert cross.get("groupby_b", []) == (
        secondary if {"group_by_secondary", "groupby_b"} & grouping.keys() else []
    )


@pytest.mark.parametrize(
    "saved_key", ["series_limit_metric", "timeseries_limit_metric"]
)
@pytest.mark.parametrize("key", ["series_limit_metric", "timeseries_limit_metric"])
@pytest.mark.parametrize(
    "update,expected",
    [({}, "profit"), ({"metric": None}, None), ({"metric": "cost"}, "cost")],
)
def test_xy_update_keeps_omitted_series_ranking_metric(
    key: str, saved_key: str, update: dict[str, object], expected: str | None
) -> None:
    """An unrelated update cannot change which series survive the saved limit."""
    from superset.mcp_service.chart.schemas import XYChartConfig

    config = XYChartConfig.model_validate(
        {
            "x": "ds",
            "y": [{"name": "revenue", "saved_metric": True}],
            "stacked": True,
            **(
                {
                    key: {"name": update["metric"], "saved_metric": True}
                    if update["metric"]
                    else None
                }
                if update
                else {}
            ),
        }
    )
    with patch(
        "superset.mcp_service.chart.chart_utils.is_column_truly_temporal",
        return_value=True,
    ):
        mapped = map_config_to_form_data(config, dataset_id=7)
    saved = {
        "viz_type": mapped["viz_type"],
        "x_axis": "ds",
        "metrics": ["revenue"],
        "groupby": ["region"],
        "series_limit": 1,
        saved_key: "profit",
    }
    merged = merge_form_data_for_update(saved, deepcopy(mapped), config)
    assert merged.get(key if update else saved_key) == expected
    if update and key != saved_key:
        assert saved_key not in merged
    with patch(
        "superset.mcp_service.chart.chart_helpers.resolve_datasource_engine",
        return_value="base",
    ):
        query = build_query_dicts_from_form_data(merged, 7, "table")[0]
    assert query.get("series_limit_metric") == expected
    assert query["series_limit"] == 1
    cross = merge_form_data_for_update(
        {**saved, "viz_type": "pie"}, deepcopy(mapped), config
    )
    assert cross.get(key) == (expected if update else None)


@pytest.mark.parametrize("key", ["series_limit_metric", "timeseries_limit_metric"])
def test_xy_explicit_ranking_metric_wins_over_implicit_default(key: str) -> None:
    """Creating a limited chart ranks by the requested metric, not the first Y."""
    from superset.mcp_service.chart.plugins.xy import XYChartPlugin
    from superset.mcp_service.chart.schemas import XYChartConfig

    metric = {
        "expressionType": "SIMPLE",
        "column": {"column_name": "profit"},
        "aggregate": "SUM",
        "label": "Profit",
        "hasCustomLabel": True,
    }
    config = XYChartConfig.model_validate(
        {
            "x": "ds",
            "y": [{"name": "revenue", "saved_metric": True}],
            "group_by": [{"name": "region"}],
            "series_limit": 1,
            key: metric,
        }
    )
    assert getattr(config, key) in XYChartPlugin().extract_column_refs(config)
    with patch(
        "superset.mcp_service.chart.chart_utils.is_column_truly_temporal",
        return_value=True,
    ):
        mapped = map_config_to_form_data(config, dataset_id=7)
    with patch(
        "superset.mcp_service.chart.chart_helpers.resolve_datasource_engine",
        return_value="base",
    ):
        query = build_query_dicts_from_form_data(mapped, 7, "table")[0]
    assert query["series_limit_metric"]["column"]["column_name"] == "profit"
    assert query["series_limit_metric"]["aggregate"] == "SUM"


@pytest.mark.parametrize("key", ["series_limit_metric", "timeseries_limit_metric"])
def test_xy_ranking_metric_rejects_dimension_reference(key: str) -> None:
    """Ranking accepts metrics, not bare dimension references."""
    from superset.mcp_service.chart.schemas import XYChartConfig

    with pytest.raises(ValueError, match="Series ranking requires"):
        XYChartConfig.model_validate(
            {
                "x": "ds",
                "y": [{"name": "revenue", "saved_metric": True}],
                key: {"name": "profit"},
            }
        )


@pytest.mark.parametrize("key", ["series_limit_metric", "timeseries_limit_metric"])
def test_xy_native_saved_ranking_metric_round_trips(key: str) -> None:
    """Saved ranking strings normalize like native Y metrics and map back to strings."""
    config = GenerateChartRequest.model_validate(
        {
            "dataset_id": 7,
            "config": {
                "viz_type": "echarts_timeseries_line",
                "x_axis": "ds",
                "metrics": ["count"],
                "series_limit": 1,
                key: "count",
            },
        }
    ).config
    assert getattr(config, key).saved_metric
    with patch(
        "superset.mcp_service.chart.chart_utils.is_column_truly_temporal",
        return_value=True,
    ):
        mapped = map_config_to_form_data(config, dataset_id=7)
    assert mapped[key] == "count"


@pytest.mark.parametrize(
    "column,valid", [("regoin", False), ("count", False), ("REGION", True)]
)
def test_mixed_secondary_filters_validate_and_normalize(
    column: str, valid: bool
) -> None:
    """Query B filter subjects are checked as columns and normalized before mapping."""
    from superset.mcp_service.chart.plugins.mixed_timeseries import (
        MixedTimeseriesChartPlugin,
    )
    from superset.mcp_service.chart.schemas import MixedTimeseriesChartConfig
    from superset.mcp_service.chart.validation.dataset_validator import DatasetValidator
    from superset.mcp_service.common.error_schemas import DatasetContext

    config = MixedTimeseriesChartConfig.model_validate(
        {
            "x": {"name": "ds"},
            "y": [{"name": "count", "saved_metric": True}],
            "y_secondary": [{"name": "count", "saved_metric": True}],
            "filters_secondary": [{"column": column, "op": "=", "value": "EMEA"}],
        }
    )
    context = DatasetContext(
        id=7,
        table_name="sales",
        schema="public",
        database_name="examples",
        available_columns=[
            {"name": "ds", "type": "TIMESTAMP", "is_temporal": True},
            {"name": "region", "type": "VARCHAR", "is_temporal": False},
        ],
        available_metrics=[{"name": "count", "expression": "COUNT(*)"}],
    )
    is_valid, error = DatasetValidator.validate_against_dataset(
        config, dataset_id=7, dataset_context=context
    )
    assert is_valid is valid
    if not valid:
        assert error is not None
        return
    normalized = MixedTimeseriesChartPlugin().normalize_column_refs(config, context)
    with patch(
        "superset.mcp_service.chart.chart_utils.is_column_truly_temporal",
        return_value=True,
    ):
        mapped = map_config_to_form_data(normalized, dataset_id=7)
    assert mapped["adhoc_filters_b"][0]["subject"] == "region"
    with patch(
        "superset.mcp_service.chart.chart_helpers.resolve_datasource_engine",
        return_value="base",
    ):
        queries = build_query_dicts_from_form_data(mapped, 7, "table")
    assert {"col": "region", "op": "==", "val": "EMEA"} in queries[1]["filters"]
    assert not any(f.get("col") == "region" for f in queries[0]["filters"])


@pytest.mark.parametrize("grain", ["P1M", None])
def test_xy_grain_only_update_keeps_saved_temporal_range(grain: str | None) -> None:
    """Changing or clearing aggregation grain must not widen the saved range."""
    from superset.mcp_service.chart.schemas import XYChartConfig

    config = XYChartConfig(
        x={"name": "ds"},
        y=[{"name": "revenue", "saved_metric": True}],
        kind="line",
        time_grain=grain,
    )
    saved_filter = {
        "clause": "WHERE",
        "expressionType": "SIMPLE",
        "subject": "ds",
        "operator": "TEMPORAL_RANGE",
        "comparator": "Last year",
    }
    with patch(
        "superset.mcp_service.chart.chart_utils.is_column_truly_temporal",
        return_value=True,
    ):
        mapped = map_config_to_form_data(config, dataset_id=7)
    saved = {
        "viz_type": mapped["viz_type"],
        "x_axis": "ds",
        "metrics": ["revenue"],
        "time_grain_sqla": "P1D",
        "adhoc_filters": [saved_filter],
    }
    merged = merge_form_data_for_update(saved, deepcopy(mapped), config)
    assert merged["adhoc_filters"] == [saved_filter]
    with patch(
        "superset.mcp_service.chart.chart_helpers.resolve_datasource_engine",
        return_value="base",
    ):
        query = build_query_dicts_from_form_data(merged, 7, "table")[0]
    assert {"col": "ds", "op": "TEMPORAL_RANGE", "val": "Last year"} in query["filters"]
