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

from unittest.mock import MagicMock, patch

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
)


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
    assert query["time_grain"] == "P1D"
    assert query["time_grain_sqla"] == "P1D"
    assert query["where"] == "(region = 'NA') AND (name IS NOT NULL)"
    assert query["having"] == "(SUM(num) > 10) AND (COUNT(*) > 1)"


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
    assert query["time_grain_sqla"] == "P1D"


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


def test_resolve_deck_gl_columns_with_dimension_and_js_columns():
    form_data = {
        "spatial": {"type": "latlong", "lonCol": "lon", "latCol": "lat"},
        "dimension": "category",
        "js_columns": ["name", "value"],
    }
    cols = resolve_deck_gl_columns(form_data)
    assert "lon" in cols
    assert "lat" in cols
    assert "category" in cols
    assert "name" in cols
    assert "value" in cols


def test_resolve_deck_gl_columns_deduplicates():
    form_data = {
        "spatial": {"type": "latlong", "lonCol": "lon", "latCol": "lat"},
        "dimension": "lon",  # same as lonCol — should not duplicate
    }
    cols = resolve_deck_gl_columns(form_data)
    assert cols.count("lon") == 1


def test_resolve_deck_gl_columns_empty():
    assert resolve_deck_gl_columns({}) == []


def test_resolve_deck_gl_columns_ignores_non_string_js_columns():
    form_data = {
        "js_columns": [42, None, "valid_col"],
    }
    assert resolve_deck_gl_columns(form_data) == ["valid_col"]


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
