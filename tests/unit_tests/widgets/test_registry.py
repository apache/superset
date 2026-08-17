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

from superset.widgets.controls import BalloonsControls
from superset.widgets.registry import registry, WidgetControls


def _block(widget_type: str) -> type[WidgetControls]:
    widget = registry.get(widget_type)
    assert widget is not None
    return widget


def test_registry_lists_built_in_widget_types() -> None:
    ids = {cls.widget_type for cls in registry.list()}
    assert {"metric-tile", "ag-grid-table", "balloons"} <= ids


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
