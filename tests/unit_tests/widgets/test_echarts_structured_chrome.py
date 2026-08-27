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
"""Tests for the `echarts` widget's `chrome` structured layer — title,
legend, tooltip, and axis labels, each independently optional and applying
regardless of `chartType` (see `EchartsChrome` in `superset/widgets/controls.py`).
`EchartsChrome`'s fields are deliberately flat (`titleText`, `legendShow`,
`xAxisName`, ...) rather than nested into `title`/`legend`/`xAxis` sub-objects
— JsonForms only renders one level of nested-object properties, so a
two-level-deep `chrome.title.text` would render as an empty group with
nothing inside it (verified against the actual control panel). The actual
merge onto `echartsOptions` happens on the frontend
(`echartsStructuredChrome.ts`); this covers the backend's half — the schema
shape served, and strict validation of the control values it accepts."""

from __future__ import annotations

from superset.utils import json
from superset.widgets.registry import registry


def _echarts_schema(control_values=None):
    widget = registry.get("echarts")
    assert widget is not None
    return widget.get_control_schema(control_values, None)


def test_chrome_schema_is_flat_one_level_under_chrome() -> None:
    schema = _echarts_schema()
    chrome_ref = schema["properties"]["chrome"]
    assert chrome_ref["$ref"] == "#/$defs/EchartsChrome"
    chrome_def = schema["$defs"]["EchartsChrome"]
    assert set(chrome_def["properties"]) == {
        "titleText",
        "legendShow",
        "legendPosition",
        "tooltipTrigger",
        "xAxisName",
        "xAxisRotate",
        "xAxisFormat",
        "yAxisName",
        "yAxisRotate",
        "yAxisFormat",
    }
    # Flat, not nested: every field's own schema is a plain scalar (string,
    # boolean, integer, or a nullable enum) — never another $ref to a
    # sub-object.
    for name, prop in chrome_def["properties"].items():
        assert "$ref" not in prop, f"{name} must not be a nested object"


def test_legend_position_and_tooltip_trigger_offer_their_option_lists() -> None:
    schema = _echarts_schema()
    chrome_def = schema["$defs"]["EchartsChrome"]
    assert chrome_def["properties"]["legendPosition"]["x-options"] == [
        "top",
        "bottom",
        "left",
        "right",
    ]
    assert chrome_def["properties"]["tooltipTrigger"]["x-options"] == [
        "item",
        "axis",
    ]


def test_axis_rotate_is_bounded() -> None:
    schema = _echarts_schema()
    chrome_def = schema["$defs"]["EchartsChrome"]
    assert chrome_def["properties"]["xAxisRotate"]["minimum"] == -90
    assert chrome_def["properties"]["xAxisRotate"]["maximum"] == 90
    assert chrome_def["properties"]["yAxisRotate"]["minimum"] == -90
    assert chrome_def["properties"]["yAxisRotate"]["maximum"] == 90


def test_valid_chrome_control_values_pass_strict_validation() -> None:
    widget = registry.get("echarts")
    assert widget is not None
    errors = widget.validate_control_values(
        {
            "dataBinding": {"datasetId": 1, "metrics": ["count"]},
            "chrome": {
                "titleText": "Sales",
                "legendShow": False,
                "legendPosition": "right",
                "tooltipTrigger": "axis",
                "xAxisName": "Product",
                "xAxisRotate": 45,
                "xAxisFormat": "{value} kg",
                "yAxisName": "Sales",
            },
        }
    )
    assert errors == []


def test_out_of_range_rotate_is_rejected() -> None:
    widget = registry.get("echarts")
    assert widget is not None
    errors = widget.validate_control_values(
        {
            "dataBinding": {"datasetId": 1, "metrics": ["count"]},
            "chrome": {"xAxisRotate": 200},
        }
    )
    locs = [tuple(error["loc"]) for error in errors]
    assert ("chrome", "xAxisRotate") in locs


def test_invalid_legend_position_is_rejected() -> None:
    widget = registry.get("echarts")
    assert widget is not None
    errors = widget.validate_control_values(
        {
            "dataBinding": {"datasetId": 1, "metrics": ["count"]},
            "chrome": {"legendPosition": "center"},
        }
    )
    assert errors != []


def test_a_widget_without_any_chrome_still_validates_cleanly() -> None:
    # Pre-existing raw-only widgets carry no `chrome` at all.
    widget = registry.get("echarts")
    assert widget is not None
    errors = widget.validate_control_values(
        {"dataBinding": {"datasetId": 1, "metrics": ["count"]}}
    )
    assert errors == []


def test_control_schema_rest_endpoint_exposes_chrome(client, full_api_access) -> None:
    resp = client.get("/api/v1/widgets/type/echarts/control-schema")
    assert resp.status_code == 200
    schema = resp.get_json()["result"]
    assert "chrome" in schema["properties"]


def test_validate_rest_endpoint_accepts_chrome_fields(client, full_api_access) -> None:
    resp = client.post(
        "/api/v1/widgets/type/echarts/validate",
        data=json.dumps(
            {
                "control_values": {
                    "dataBinding": {"datasetId": 1, "metrics": ["count"]},
                    "chrome": {"titleText": "Sales", "legendShow": False},
                }
            }
        ),
        content_type="application/json",
    )
    assert resp.status_code == 200
    assert resp.get_json()["result"]["errors"] == []
