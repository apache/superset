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

"""Regression coverage for saved native chart compatibility."""

from decimal import getcontext
from typing import Any

import pytest

from superset.mcp_service.chart.chart_helpers import build_query_dicts_from_form_data
from superset.mcp_service.chart.chart_utils import map_bullet_config
from superset.mcp_service.chart.compile import _native_reference_error
from superset.mcp_service.chart.plugins.bullet import BulletChartPlugin
from superset.mcp_service.chart.preview_utils import (
    _bullet_category_value,
    _format_bullet_number,
    _generate_bullet_vega_lite_preview,
    BulletOutputError,
    resolve_bullet_render_model,
)
from superset.mcp_service.chart.schemas import BulletChartConfig
from superset.mcp_service.common.error_schemas import DatasetContext
from superset.utils import json


@pytest.fixture(autouse=True)
def native_query_engine(monkeypatch: pytest.MonkeyPatch) -> None:
    """Avoid datasource lookup when reconstructing native query objects."""
    monkeypatch.setattr(
        "superset.mcp_service.chart.chart_helpers.resolve_datasource_engine",
        lambda *_args: "base",
    )


def test_bullet_update_preserves_legacy_predicates_and_ordering() -> None:
    """A presentation change must not replace saved query semantics."""
    config = BulletChartConfig(metric="revenue", show_labels=True)
    existing = {
        "viz_type": "bullet",
        "metric": "revenue",
        "groupby": ["region"],
        "where": "region != 'NA'",
        "having": "SUM(revenue) > 0",
        "filters": [{"col": "region", "op": "==", "val": "US"}],
        "order_by_cols": ['["region", true]'],
        "row_limit": 1,
    }
    merged = BulletChartPlugin().merge_update_form_data(
        existing, map_bullet_config(config), config, dataset_rebind=False
    )
    assert merged is not None
    query = build_query_dicts_from_form_data(merged, 1, "table")[0]
    assert query["where"] == f"({existing['where']})"
    assert query["having"] == f"({existing['having']})"
    assert query["filters"] == existing["filters"]
    assert query["orderby"] == [["region", True]]
    assert query["row_limit"] == 1


@pytest.mark.parametrize("role", ["groupby", "metrics", "all_columns"])
def test_table_saved_scalar_roles_are_not_split(role: str) -> None:
    """Saved scalar controls follow ensureIsArray instead of string iteration."""
    form: dict[str, Any] = {
        "viz_type": "table",
        "query_mode": "aggregate",
        "groupby": ["region"],
        "metrics": ["revenue"],
    }
    if role == "all_columns":
        form.update(query_mode="raw", all_columns="region")
    else:
        form[role] = "region" if role == "groupby" else "revenue"
    query = build_query_dicts_from_form_data(form, 1, "table")[0]
    assert query["columns"] == ["region"]
    assert query["metrics"] == ([] if role == "all_columns" else ["revenue"])


@pytest.mark.parametrize("viz_type", ["echarts_timeseries_line", "mixed_timeseries"])
def test_timeseries_saved_singular_metric(viz_type: str) -> None:
    """The common metric alias remains usable for saved charts."""
    query = build_query_dicts_from_form_data(
        {"viz_type": viz_type, "metric": "revenue"}, 1, "table"
    )[0]
    assert query["metrics"] == ["revenue"]


@pytest.mark.parametrize("viz_type", ["big_number", "big_number_total"])
def test_big_number_saved_plural_metrics(viz_type: str) -> None:
    """Migrated Big Number forms retain the plural-metric fallback."""
    query = build_query_dicts_from_form_data(
        {"viz_type": viz_type, "metrics": ["count"]}, 1, "table"
    )[0]
    assert query["metrics"] == ["count"]


def test_pivot_rebind_resolves_grouping_set_logical_labels() -> None:
    """A Custom SQL dimension label is not a physical column reference."""
    form = {
        "viz_type": "pivot_table_v2",
        "groupbyRows": [
            {
                "expressionType": "SQL",
                "sqlExpression": "UPPER(region)",
                "label": "RegionUpper",
            }
        ],
        "groupbyColumns": [],
        "metrics": ["count"],
        "rowTotals": True,
        "colTotals": True,
    }
    context = DatasetContext(
        id=2,
        table_name="compatible",
        database_name="test",
        available_columns=[{"name": "region", "type": "STRING"}],
        available_metrics=[{"name": "count"}],
    )
    queries = build_query_dicts_from_form_data(form, 2, "table")
    assert ["RegionUpper"] in queries[0]["grouping_sets"]
    error = _native_reference_error(form, context, 2, strict_all_form_refs=True)
    assert error is None, error


def test_bullet_sql_metric_adapter_uses_expression_as_label() -> None:
    """Native SQL metrics without labels survive compatible update validation."""
    native = {
        "viz_type": "bullet",
        "metric": {"expressionType": "SQL", "sqlExpression": "SUM(revenue)"},
    }
    assert (
        resolve_bullet_render_model([{"SUM(revenue)": 10}], native).metric_field
        == "SUM(revenue)"
    )
    config = BulletChartConfig.model_validate(native)
    assert config.metric.label == "SUM(revenue)"
    assert map_bullet_config(config)["metric"]["label"] == "SUM(revenue)"


@pytest.mark.parametrize(
    ("value", "text"),
    [
        ([1, 2], "1,2"),
        ([1, None, [2, 3]], "1,,2,3"),
        ({"region": "US"}, "[object Object]"),
    ],
)
def test_bullet_bounded_container_dimension(value: Any, text: str) -> None:
    """Native container values retain their wire values and frontend labels."""
    model = resolve_bullet_render_model(
        [{"region": value, "revenue": 10}],
        {"viz_type": "bullet", "metric": "revenue", "groupby": ["region"]},
    )
    assert model.rows[0]["region"] == value
    assert _bullet_category_value(model.rows[0]["region"], "region", 0) == (value, text)


def test_bullet_threshold_tooltips_use_valid_field_definitions() -> None:
    """Vega-Lite tooltip arrays require field definitions, not constants."""
    preview = _generate_bullet_vega_lite_preview(
        [{"revenue": 10}],
        {
            "viz_type": "bullet",
            "metric": "revenue",
            "ranges": "20",
            "range_labels": "Good",
            "markers": "15",
            "marker_labels": "Target",
            "marker_lines": "12",
            "marker_line_labels": "Goal",
        },
    )
    layers = [
        layer
        for layer in preview.specification["layer"]
        if layer["mark"]["type"] in {"rect", "point", "rule"}
    ]
    assert len(layers) == 3
    for layer, label, number in zip(
        layers, ["Good", "Target", "Goal"], [20, 15, 12], strict=True
    ):
        tooltip = layer["encoding"]["tooltip"]
        assert all(
            "field" in definition and "value" not in definition
            for definition in tooltip
        )
        fields = {
            transform["as"]: json.loads(transform["calculate"])
            for transform in layer["transform"]
        }
        assert fields[tooltip[0]["field"]] == label
        assert fields[tooltip[1]["field"]] == number


def test_bullet_bounded_precision_formats_large_measure() -> None:
    """Accepted precision must not depend on the ambient Decimal context."""
    precision = getcontext().prec
    model = resolve_bullet_render_model(
        [{"revenue": 10000000000.0}],
        {"viz_type": "bullet", "metric": "revenue", "y_axis_format": ".20f"},
    )
    assert (
        _format_bullet_number(model.y_axis_format, model.measures[0])
        == "10000000000.00000000000000000000"
    )
    assert getcontext().prec == precision


@pytest.mark.parametrize("clear", [[], None])
def test_bullet_explicit_clears_override_legacy_controls(
    clear: list[Any] | None,
) -> None:
    """Canonicalized aliases cannot undo explicit filter or ordering clears."""
    config = BulletChartConfig(metric="revenue", filters=[], order_by=clear)
    existing = {
        "viz_type": "bullet",
        "metric": "revenue",
        "groupby": ["region"],
        "where": "region != 'NA'",
        "having": "SUM(revenue) > 0",
        "filters": [{"col": "region", "op": "==", "val": "US"}],
        "adhoc_filters": [
            {
                "expressionType": "SIMPLE",
                "clause": "WHERE",
                "subject": "region",
                "operator": "!=",
                "comparator": "CA",
            }
        ],
        "order_by_cols": ['["region", true]'],
    }
    merged = BulletChartPlugin().merge_update_form_data(
        existing, map_bullet_config(config), config, dataset_rebind=False
    )
    assert merged is not None
    assert merged["adhoc_filters"] == []
    assert merged["orderby"] == []
    assert not ({"where", "having", "filters", "order_by_cols"} & merged.keys())
    query = build_query_dicts_from_form_data(merged, 1, "table")[0]
    assert query["filters"] == []
    assert not query.get("where")
    assert not query.get("having")


def test_bullet_container_data_and_export_paths_preserve_arrays() -> None:
    """The shared result model must accept arrays on reads as well as previews."""
    form = {"viz_type": "bullet", "metric": "revenue", "groupby": ["region"]}
    result = {"queries": [{"data": [{"region": [1, 2], "revenue": 10}]}]}
    plugin = BulletChartPlugin()
    assert plugin.normalize_query_result(result, form) is result
    rows, failure = plugin.sanitize_data_rows(result["queries"][0]["data"], form)
    assert failure is None
    assert rows == [{"region": [1, 2], "revenue": 10}]
    preview = _generate_bullet_vega_lite_preview(rows, form)
    bar = next(
        layer
        for layer in preview.specification["layer"]
        if layer["mark"]["type"] == "bar"
    )
    category = bar["encoding"]["tooltip"][0]["field"]
    assert preview.specification["data"]["values"][0][category] == "1,2"


@pytest.mark.parametrize("kind", ["cycle", "depth", "width", "text", "unsupported"])
def test_bullet_container_dimension_keeps_bounded_guards(kind: str) -> None:
    """Container support does not relax the shared normalization/text limits."""
    value: list[Any] = []
    if kind == "cycle":
        value.append(value)
    elif kind == "depth":
        for _ in range(34):
            value = [value]
    elif kind == "width":
        value = [1] * 4097
    elif kind == "text":
        value = ["x" * 4096, "y"]
    else:
        value = [object()]
    with pytest.raises(BulletOutputError):
        _bullet_category_value(value, "region", 0)


@pytest.mark.parametrize(
    ("metric", "expected"), [(None, "SUM(revenue)"), ("Sales", "Sales")]
)
def test_bullet_sql_metric_explicit_label_precedence(
    metric: str | None, expected: str
) -> None:
    """Expression fallback also handles null labels without replacing real ones."""
    config = BulletChartConfig.model_validate(
        {
            "viz_type": "bullet",
            "metric": {
                "expressionType": "SQL",
                "sqlExpression": "SUM(revenue)",
                "label": metric,
            },
        }
    )
    assert config.metric.label == expected
