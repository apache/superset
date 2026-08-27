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
from __future__ import annotations

from typing import Any

import pytest
from pydantic import BaseModel, Field
from superset_core.widgets import Widget, widget

from superset.widgets.controls import BalloonsControls
from superset.widgets.registry import registry


def _block(widget_type: str) -> type[Widget]:
    widget_cls = registry.get(widget_type)
    assert widget_cls is not None
    return widget_cls


def test_registry_lists_built_in_widget_types() -> None:
    ids = {cls.widget_type for cls in registry.values()}
    assert {"metric-tile", "ag-grid-table", "balloons"} <= ids


def test_core_contract_is_importable() -> None:
    # Extensions register widgets via exactly these two public symbols.
    assert Widget is not None
    assert callable(widget)


def test_duplicate_widget_type_raises_naming_both() -> None:
    @widget(widget_type="dup-test-widget", name="First")
    class First(Widget):
        controls_class = BalloonsControls

    try:
        with pytest.raises(ValueError, match="already registered"):

            @widget(widget_type="dup-test-widget", name="Second")
            class Second(Widget):
                controls_class = BalloonsControls
    finally:
        registry.pop("dup-test-widget", None)


def test_get_control_schema_base_shape() -> None:
    schema = _block("balloons").get_control_schema(None, None)
    # Field order preserved (dataBinding before customize), $defs present.
    assert list(schema["properties"]) == [
        "dataBinding",
        "colorDimension",
        "customize",
    ]
    assert schema["required"] == ["dataBinding"]
    assert {"DataBinding", "Customization", "SeriesStyle"} <= set(schema["$defs"])


def test_get_control_schema_tolerates_invalid_values() -> None:
    # Partial / malformed control values during editing must not raise; the base
    # schema is returned instead.
    schema = _block("balloons").get_control_schema(
        {"dataBinding": "not-an-object"}, None
    )
    assert "properties" in schema


def test_get_control_schema_accepts_camel_case_props() -> None:
    # node.props uses camelCase aliases; validation must accept them.
    schema = _block("metric-tile").get_control_schema(
        {"dataBinding": {"datasetId": 1, "metrics": ["count"]}, "decimals": 2}, None
    )
    assert "dataBinding" in schema["properties"]


def test_minimal_object_validates_against_model() -> None:
    # datasetId + metrics are the only mandatory leaves; everything else is
    # optional, so this minimal object is a valid instance.
    BalloonsControls.model_validate(
        {"dataBinding": {"datasetId": 1, "metrics": ["count"]}}
    )


def test_validate_control_values_passes_for_valid_props() -> None:
    errors = _block("balloons").validate_control_values(
        {
            "dataBinding": {
                "datasetId": 1,
                "metrics": ["count"],
                "dimensions": ["gender"],
            },
            "colorDimension": "gender",
        }
    )
    assert errors == []


def test_validate_control_values_flags_color_dimension_not_grouped() -> None:
    # colorDimension names a dimension that isn't in dataBinding.dimensions —
    # the declarative cross-field rule must surface an actionable error.
    errors = _block("balloons").validate_control_values(
        {
            "dataBinding": {
                "datasetId": 1,
                "metrics": ["count"],
                "dimensions": ["name"],
            },
            "colorDimension": "gender",
        }
    )
    assert errors
    assert any("colorDimension" in error["message"] for error in errors)


def test_validate_control_values_empty_when_no_values() -> None:
    # Nothing to validate (required-field checks live elsewhere).
    assert _block("balloons").validate_control_values(None) == []


def test_data_binding_declares_column_and_metric_controls() -> None:
    schema = _block("balloons").get_control_schema(None, None)
    data_binding_props = schema["$defs"]["DataBinding"]["properties"]
    assert data_binding_props["dimensions"]["x-control"] == "column-multi"
    assert data_binding_props["metrics"]["x-control"] == "metric-multi"


def test_color_dimension_declares_column_control() -> None:
    schema = _block("balloons").get_control_schema(None, None)
    assert schema["properties"]["colorDimension"]["x-control"] == "column"


def test_data_binding_schema_is_unchanged_after_metric_control_extraction() -> None:
    # Golden fixture captured before DataBinding composed MetricControl, via
    # registry.get("metric-tile").get_control_schema(None, None). Guards
    # against both the MetricControl extraction and the field_order fix
    # regressing the served schema — checked at the same boundary the
    # Inspector consumes, not just raw model_json_schema().
    schema = _block("metric-tile").get_control_schema(None, None)
    data_binding = schema["$defs"]["DataBinding"]

    assert list(data_binding["properties"]) == [
        "datasetId",
        "metrics",
        "dimensions",
        "rowLimit",
    ]
    assert data_binding["required"] == ["datasetId", "metrics"]
    assert data_binding["properties"]["metrics"] == {
        "description": (
            "Metrics to fetch. Each entry is EITHER a string naming a saved "
            'metric on the dataset (e.g. "count"), OR an ad-hoc aggregate '
            "object of the shape "
            '{"expressionType": "SIMPLE", "column": {"column_name": "<col>"}, '
            '"aggregate": "SUM"|"AVG"|"COUNT"|"COUNT_DISTINCT"|"MIN"|"MAX", '
            '"label": "<optional display label>"}. Do not pass a raw SQL string '
            'like "SUM(sales)" — a plain string is looked up as a saved-metric '
            "name, not evaluated as an expression."
        ),
        "items": {},
        "title": "Metrics",
        "type": "array",
        "x-control": "metric-multi",
        "x-language": "json",
    }
    assert data_binding["properties"]["datasetId"] == {
        "description": "Numeric id of the dataset to query.",
        "title": "Dataset ID",
        "type": "integer",
    }
    assert data_binding["properties"]["dimensions"] == {
        "description": "Columns to group by (the categories / series).",
        "items": {"type": "string"},
        "title": "Dimensions",
        "type": "array",
        "x-control": "column-multi",
    }
    assert data_binding["properties"]["rowLimit"] == {
        "default": 1000,
        "description": "Maximum number of rows to fetch.",
        "minimum": 1,
        "title": "Row limit",
        "type": "integer",
    }


def test_data_binding_schema_unchanged_via_mcp_boundary() -> None:
    from superset.mcp_service.widgets.tool.get_widget_control_schema import (
        _get_widget_control_schema_impl,
    )

    # dataBinding is mandatory, so the minimal-viable pruning inlines it
    # (recursing into its own mandatory leaves) rather than leaving a $ref
    # into $defs -- a different code path through schema_tools.py than the
    # REST/get_control_schema boundary above, so this exercises the field
    # order fix against progressive disclosure too.
    result = _get_widget_control_schema_impl("metric-tile")
    data_binding = result["properties"]["dataBinding"]
    assert list(data_binding["properties"]) == [
        "datasetId",
        "metrics",
        "dimensions",
        "rowLimit",
    ]


def test_widget_registration_raises_on_cyclic_dependency() -> None:
    class _CyclicControls(BaseModel):
        a: dict[str, Any] = Field(
            default_factory=dict,
            json_schema_extra={"x-dynamic": True, "x-dependsOn": ["b"]},
        )
        b: dict[str, Any] = Field(
            default_factory=dict,
            json_schema_extra={"x-dynamic": True, "x-dependsOn": ["a"]},
        )

    with pytest.raises(ValueError, match="Cyclic control dependency"):

        @widget(widget_type="cyclic-test-widget", name="Cyclic")
        class _Cyclic(Widget):
            controls_class = _CyclicControls

    # The widget must not remain half-registered after the failure.
    assert registry.get("cyclic-test-widget") is None


def test_widget_registration_does_not_run_enrichers() -> None:
    class _RuntimeControls(BaseModel):
        options: list[str] = Field(
            default_factory=list,
            json_schema_extra={"x-dynamic": True},
        )

    calls: list[bool] = []

    def _populate_options(
        _schema: dict[str, Any],
        node: dict[str, Any],
        _parsed: BaseModel | None,
        _series: list[str],
        _upstream: dict[str, Any],
    ) -> None:
        calls.append(True)
        node["enum"] = ["one"]

    @widget(widget_type="runtime-enricher-test-widget", name="Runtime enricher")
    class _RuntimeEnricher(Widget):
        controls_class = _RuntimeControls
        enrichers = {"options": _populate_options}

    try:
        assert calls == []

        schema = _RuntimeEnricher.get_control_schema(None, None)

        assert calls == [True]
        assert schema["properties"]["options"]["enum"] == ["one"]
    finally:
        registry.pop("runtime-enricher-test-widget", None)
