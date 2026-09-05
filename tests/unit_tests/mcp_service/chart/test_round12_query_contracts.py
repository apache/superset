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
from unittest.mock import patch

import pytest

from superset.common.form_data_query_context import (
    build_query_objects_from_form_data,
)
from superset.mcp_service.chart.chart_helpers import (
    build_query_dicts_from_form_data,
)
from superset.mcp_service.chart.chart_utils import scrub_dataset_bound_form_data


def _base_axis(column: str, grain: str | None = None) -> dict[str, object]:
    axis: dict[str, object] = {
        "columnType": "BASE_AXIS",
        "sqlExpression": column,
        "label": column,
        "expressionType": "SQL",
        "isColumnReference": True,
    }
    if grain is not None:
        axis["timeGrain"] = grain
    return axis


@pytest.mark.parametrize(
    "form_data",
    [
        {"viz_type": "big_number", "metric": "revenue"},
        {
            "viz_type": "echarts_timeseries_line",
            "metrics": ["revenue"],
            "groupby": ["region"],
        },
        {"viz_type": "waterfall", "metric": "revenue"},
    ],
)
def test_final_query_mutator_normalizes_every_physical_x_axis(
    form_data: dict[str, object],
) -> None:
    query = build_query_objects_from_form_data(
        {
            **form_data,
            "x_axis": "event_time",
            "time_grain_sqla": "P1D",
            "temporal_columns_lookup": {"event_time": False},
        }
    )[0]

    assert query["columns"][0] == _base_axis("event_time", "P1D")
    assert "is_timeseries" not in query


def test_final_query_mutator_preserves_adhoc_axis_fields() -> None:
    axis = {
        "expressionType": "SQL",
        "sqlExpression": "DATE_TRUNC('month', event_time)",
        "label": "Month",
        "columnType": "CUSTOM_OVERRIDE",
    }
    query = build_query_objects_from_form_data(
        {
            "viz_type": "echarts_timeseries_line",
            "x_axis": axis,
            "metrics": ["revenue"],
            "time_grain_sqla": "P1M",
        }
    )[0]

    assert query["columns"] == [{"timeGrain": "P1M", **axis}]
    assert "is_timeseries" not in query


@pytest.mark.parametrize(
    ("lookup", "granularity", "converted"),
    [
        (None, "event_time", False),
        ({"event_time": False}, "event_time", False),
        ({"event_time": True}, "other_time", True),
        ({"event_time": True}, "event_time", True),
    ],
)
def test_box_plot_only_temporalizes_confirmed_physical_columns(
    lookup: dict[str, bool] | None,
    granularity: str,
    converted: bool,
) -> None:
    form_data: dict[str, object] = {
        "viz_type": "box_plot",
        "columns": ["event_time"],
        "metrics": ["revenue"],
        "time_grain_sqla": "P1D",
        "granularity_sqla": granularity,
    }
    if lookup is not None:
        form_data["temporal_columns_lookup"] = lookup

    query = build_query_objects_from_form_data(form_data)[0]
    assert isinstance(query["columns"][0], dict) is converted


def test_box_plot_legacy_granularity_still_needs_temporal_confirmation() -> None:
    query = build_query_objects_from_form_data(
        {
            "viz_type": "box_plot",
            "columns": [],
            "granularity_sqla": "event_time",
            "time_grain_sqla": "P1D",
            "temporal_columns_lookup": {"event_time": False},
            "metrics": ["revenue"],
        }
    )[0]
    assert query["columns"] == ["event_time"]


def test_table_resolves_custom_offsets_for_all_metric_aliases() -> None:
    query = build_query_objects_from_form_data(
        {
            "viz_type": "table",
            "query_mode": "aggregate",
            "groupby": ["region"],
            "metrics": ["revenue", "profit"],
            "percent_metrics": ["revenue"],
            "time_compare": ["1 year ago", "custom"],
            "start_date_offset": "3 months ago",
            "comparison_type": "difference",
        }
    )[0]

    assert query["time_offsets"] == ["1 year ago", "3 months ago"]
    contribution, compare = query["post_processing"]
    assert contribution["options"]["columns"] == [
        "revenue",
        "revenue__1 year ago",
        "revenue__3 months ago",
    ]
    assert compare["options"]["compare_columns"] == [
        "revenue__1 year ago",
        "revenue__3 months ago",
        "profit__1 year ago",
        "profit__3 months ago",
    ]


@pytest.mark.parametrize(
    ("time_compare", "start_date_offset", "expected"),
    [([], None, []), (None, None, []), (["custom"], None, [])],
)
def test_table_empty_custom_offset_state_is_safe(
    time_compare: object, start_date_offset: object, expected: list[object]
) -> None:
    query = build_query_objects_from_form_data(
        {
            "viz_type": "table",
            "groupby": ["region"],
            "metrics": ["revenue"],
            "time_compare": time_compare,
            "start_date_offset": start_date_offset,
            "comparison_type": "difference",
        }
    )[0]
    assert query["time_offsets"] == expected


def test_table_inherits_extra_form_data_comparison_offset() -> None:
    query = build_query_objects_from_form_data(
        {
            "viz_type": "table",
            "groupby": ["region"],
            "metrics": ["revenue"],
            "time_compare": ["custom", "1 year ago"],
            "start_date_offset": "3 months ago",
            "comparison_type": "ratio",
            "extra_form_data": {"time_compare": "2 weeks ago"},
        }
    )[0]
    assert query["time_offsets"] == ["2 weeks ago"]
    assert query["post_processing"][0]["options"]["compare_columns"] == [
        "revenue__2 weeks ago"
    ]


def test_mixed_absent_b_roles_inherit_primary_frontend_state() -> None:
    primary, secondary = build_query_objects_from_form_data(
        {
            "viz_type": "mixed_timeseries",
            "x_axis": "event_time",
            "metrics": ["revenue"],
            "groupby": ["region"],
            "time_range": "Last year",
        }
    )
    assert secondary["metrics"] == primary["metrics"]
    assert secondary["columns"] == primary["columns"]
    assert secondary["series_columns"] == primary["series_columns"]
    assert secondary["time_range"] == primary["time_range"]


@pytest.mark.parametrize("explicit", [[], None])
def test_mixed_explicit_b_clears_do_not_inherit(explicit: object) -> None:
    _, secondary = build_query_objects_from_form_data(
        {
            "viz_type": "mixed_timeseries",
            "x_axis": "event_time",
            "metrics": ["revenue"],
            "groupby": ["region"],
            "metrics_b": explicit,
            "groupby_b": explicit,
        }
    )
    assert secondary["metrics"] == []
    assert secondary["series_columns"] == []
    assert secondary["columns"] == [_base_axis("event_time")]


def _deck_query(form_data: dict[str, object]) -> dict[str, object]:
    with patch(
        "superset.mcp_service.chart.chart_helpers.resolve_datasource_engine",
        return_value="base",
    ):
        return build_query_dicts_from_form_data(form_data, 7, "table")[0]


def test_deck_geojson_matches_frontend_geometry_cross_filter_and_tooltips() -> None:
    query = _deck_query(
        {
            "viz_type": "deck_geojson",
            "geojson": "geometry",
            "metric": "must_be_removed",
            "cross_filter_column": "region",
            "tooltip_contents": [
                "name",
                {"item_type": "column", "column_name": "population"},
                {"item_type": "metric", "column_name": "ignored"},
            ],
        }
    )
    assert query["columns"] == ["geometry", "region", "name", "population"]
    assert query["metrics"] == []
    assert query["groupby"] == []
    assert query["filters"] == [{"col": "geometry", "op": "IS NOT NULL"}]
    assert query["is_timeseries"] is False


def test_deck_polygon_matches_metric_temporal_and_tooltip_contract() -> None:
    query = _deck_query(
        {
            "viz_type": "deck_polygon",
            "line_column": "geometry",
            "metric": "population",
            "point_radius_fixed": {"type": "metric", "value": "height"},
            "cross_filter_column": "region",
            "tooltip_contents": ["name"],
            "time_grain_sqla": "P1D",
            "granularity_sqla": "event_time",
        }
    )
    assert query["columns"] == ["geometry", "region", "name"]
    assert query["metrics"] == ["population", "height"]
    assert query["filters"] == [
        {"col": "geometry", "op": "IS NOT NULL"},
        {"col": "population", "op": "IS NOT NULL"},
    ]
    assert query["is_timeseries"] is False
    assert query["extras"] == {"time_grain_sqla": "P1D"}


def test_deck_path_distinguishes_metric_roles_and_grouping() -> None:
    query = _deck_query(
        {
            "viz_type": "deck_path",
            "line_column": "path",
            "metric": "revenue",
            "line_width": {"type": "metric", "value": "width"},
            "breakpoint_metric": "breakpoints",
            "dimension": "region",
            "tooltip_contents": ["name"],
            "time_grain_sqla": "P1D",
        }
    )
    assert query["columns"] == ["region", "name"]
    assert query["groupby"] == ["path", "name"]
    assert query["metrics"] == ["revenue", "width", "breakpoints"]
    assert query["filters"] == [{"col": "path", "op": "IS NOT NULL"}]
    assert query["is_timeseries"] is True


def test_deck_dataset_rebind_scrubs_every_layer_dataset_role() -> None:
    form_data = {
        "viz_type": "deck_path",
        "line_column": "old_path",
        "line_width": {"type": "metric", "value": "old_width"},
        "breakpoint_metric": "old_breakpoint",
        "dimension": "old_dimension",
        "tooltip_contents": ["old_tooltip"],
        "color_scheme": "supersetColors",
    }
    assert scrub_dataset_bound_form_data(deepcopy(form_data)) == {
        "viz_type": "deck_path",
        "color_scheme": "supersetColors",
    }


def test_deck_adapter_fails_closed_for_incomplete_spatial_role() -> None:
    with pytest.raises(ValueError, match="incomplete"):
        _deck_query(
            {
                "viz_type": "deck_scatter",
                "spatial": {"type": "latlong", "lonCol": "longitude"},
            }
        )
