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
"""Tests for the `echarts` widget's structured chartType/customize layer —
the backend half of the merge described in `EchartsControls`'s docstring:
`chartType` unset keeps `echartsOptions` fully authoritative; set, it drives
one series per `dataBinding` metric, styled by `customize.series` (matched by
stable metric label, not position)."""

from __future__ import annotations

from superset.utils import json
from superset.widgets.builtin import _metric_key, Echarts
from superset.widgets.registry import registry


def _series_properties(control_values, series=None):
    widget = registry.get("echarts")
    assert widget is not None
    schema = widget.get_control_schema(control_values, series)
    return schema["$defs"]["EchartsCustomization"]["properties"]["series"]


def test_metric_key_matches_frontend_getmetriclabel_precedence() -> None:
    # A saved-metric string is used verbatim.
    assert _metric_key("count") == "count"
    # An explicit label always wins.
    assert _metric_key({"label": "Total sales"}) == "Total sales"
    # A SIMPLE ad-hoc metric without a label: aggregate(column).
    assert (
        _metric_key(
            {
                "expressionType": "SIMPLE",
                "aggregate": "SUM",
                "column": {"column_name": "sales"},
            }
        )
        == "SUM(sales)"
    )
    # A SQL ad-hoc metric without a label: the raw expression.
    assert (
        _metric_key({"expressionType": "SQL", "sqlExpression": "COUNT(*)"})
        == "COUNT(*)"
    )


def test_chart_type_unset_leaves_series_schema_unenriched() -> None:
    # The x-dependsOn: ["dataBinding", "chartType"] gate blocks enrichment
    # entirely when chartType is unset — schema stays the open-ended map.
    series = _series_properties({"dataBinding": {"datasetId": 1, "metrics": ["count"]}})
    assert "properties" not in series
    assert series.get("additionalProperties")


def test_chart_type_set_populates_one_entry_per_metric() -> None:
    series = _series_properties(
        {
            "dataBinding": {"datasetId": 1, "metrics": ["count", "sum__sales"]},
            "chartType": "bar",
        }
    )
    assert set(series["properties"]) == {"count", "sum__sales"}
    assert "additionalProperties" not in series
    assert series["properties"]["count"]["title"] == "count"
    assert (
        series["properties"]["count"]["properties"]["color"]["default"]
        == Echarts.PALETTE[0]
    )
    assert (
        series["properties"]["sum__sales"]["properties"]["color"]["default"]
        == Echarts.PALETTE[1]
    )


def test_ad_hoc_metric_keyed_by_its_stable_label() -> None:
    series = _series_properties(
        {
            "dataBinding": {
                "datasetId": 1,
                "metrics": [
                    {
                        "expressionType": "SIMPLE",
                        "aggregate": "AVG",
                        "column": {"column_name": "price"},
                    }
                ],
            },
            "chartType": "line",
        }
    )
    assert set(series["properties"]) == {"AVG(price)"}


def test_stored_override_for_a_removed_metric_stays_visible() -> None:
    # A metric that was customized, then dropped from dataBinding.metrics,
    # must not silently lose its stored override from the schema's known keys.
    series = _series_properties(
        {
            "dataBinding": {"datasetId": 1, "metrics": ["count"]},
            "chartType": "bar",
            "customize": {
                "series": {"sum__sales": {"color": "#123456", "visible": False}}
            },
        }
    )
    assert set(series["properties"]) == {"count", "sum__sales"}


def test_series_deduped_and_capped() -> None:
    many_metrics = [f"m{i}" for i in range(Echarts.MAX_SERIES + 50)]
    series = _series_properties(
        {
            "dataBinding": {"datasetId": 1, "metrics": many_metrics},
            "chartType": "bar",
        }
    )
    assert len(series["properties"]) == Echarts.MAX_SERIES


def test_valid_control_values_pass_strict_validation() -> None:
    widget = registry.get("echarts")
    assert widget is not None
    errors = widget.validate_control_values(
        {
            "dataBinding": {"datasetId": 1, "metrics": ["count"]},
            "chartType": "bar",
            "customize": {
                "series": {
                    "count": {
                        "color": "#e74c3c",
                        "visible": True,
                        "displayName": "Total",
                    }
                }
            },
        }
    )
    assert errors == []


def test_raw_only_widget_without_chart_type_still_validates() -> None:
    # Pre-existing raw-only echarts widgets carry neither chartType nor
    # customize — must still validate cleanly (no forced migration).
    widget = registry.get("echarts")
    assert widget is not None
    errors = widget.validate_control_values(
        {
            "dataBinding": {"datasetId": 1, "metrics": ["count"]},
            "echartsOptions": {"series": [{"type": "pie", "data": []}]},
        }
    )
    assert errors == []


def test_control_schema_rest_endpoint_exposes_chart_type_and_customize(
    client, full_api_access
) -> None:
    # The same schema a browser Inspector renders is what a headless/MCP
    # caller sees through this REST route — no separate structured-field
    # surface for the two.
    resp = client.get("/api/v1/widgets/type/echarts/control-schema")
    assert resp.status_code == 200
    schema = resp.get_json()["result"]
    assert "chartType" in schema["properties"]
    assert schema["properties"]["chartType"]["x-options"] == [
        "bar",
        "line",
        "scatter",
    ]
    assert "customize" in schema["properties"]
    # Redundant with the Inspector's JSON tab (which edits the whole props
    # record as text) — flagged so the Form tab doesn't also render its own
    # raw-JSON box for it.
    assert schema["properties"]["echartsOptions"]["x-hidden-in-form"] is True


def test_validate_rest_endpoint_accepts_structured_fields(
    client, full_api_access
) -> None:
    resp = client.post(
        "/api/v1/widgets/type/echarts/validate",
        data=json.dumps(
            {
                "control_values": {
                    "dataBinding": {"datasetId": 1, "metrics": ["count"]},
                    "chartType": "line",
                    "customize": {
                        "series": {"count": {"color": "#3498db", "visible": True}}
                    },
                }
            }
        ),
        content_type="application/json",
    )
    assert resp.status_code == 200
    assert resp.get_json()["result"]["errors"] == []
