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
"""
A test-only widget with runtime-discovered series (``x-dynamic`` fed by the
client's ``series`` values), exercising the dynamic control schema machinery
no built-in widget uses.
"""

from __future__ import annotations

from collections.abc import Iterator
from copy import deepcopy
from typing import Any, ClassVar

import pytest
from pydantic import BaseModel, ConfigDict, Field, model_validator
from superset_core.widgets import (
    EnricherFn,
    Widget,
    widget,
    WidgetBehavior,
    WidgetUi,
)

from superset.widgets.controls import DataBinding
from superset.widgets.registry import registry

WIDGET_TYPE = "series-test"


class SeriesStyle(BaseModel):
    """Per-series mark styling, populated dynamically once the grouping
    dimension is set and its distinct values are known."""

    color: str = Field(
        default="#e74c3c",
        title="Color",
        json_schema_extra={"x-control": "color"},
    )
    size_scale: float = Field(
        default=1.0,
        ge=0.25,
        le=4.0,
        alias="sizeScale",
        title="Size scale (×)",
        description=(
            "Multiplier on the metric-derived mark size for this series "
            "(1 = as-is, 2 = twice as big)."
        ),
        json_schema_extra={"x-step": 0.25},
    )


class Customization(BaseModel):
    """Per-series customization for the series widget widget.

    ``series`` is ``x-dynamic``: empty until the ``dataBinding`` grouping
    dimension is set, then the backend fills in one styled entry per distinct
    dimension value the frontend discovered from the query results.
    """

    series: dict[str, SeriesStyle] = Field(
        default_factory=dict,
        title="Per-series styling",
        json_schema_extra={
            "x-dynamic": True,
            "x-dependsOn": ["dataBinding"],
            # The valid keys of this map are the distinct values of the widget's
            # color dimension — named by the ``colorDimension`` prop, or the last
            # ``dataBinding`` dimension when that's unset. Declaring the source
            # lets a generic client enumerate/validate the keys (rather than a
            # consumer guessing values like "F" for "girl").
            "x-key-source": {
                "dimensionFromProp": "colorDimension",
                "fallback": "lastDimension",
            },
        },
    )


class SeriesControls(BaseModel):
    """Controls for the ``series widget`` chart widget .

    One mark per query row, colored and sized per series (the distinct
    values of the first grouping dimension). ``customize`` is optional and
    populated on demand.
    """

    model_config = ConfigDict(populate_by_name=True)

    data_binding: DataBinding = Field(
        alias="dataBinding",
        title="Data",
        description=(
            "The query behind the series widget. Group by one or more dimensions "
            "(one mark per resulting row); the metric sizes each mark."
        ),
    )
    color_dimension: str = Field(
        default="",
        alias="colorDimension",
        title="Color dimension",
        description=(
            "Which grouping dimension colors the series widget — its distinct values "
            "become the customizable series. The value MUST be one of "
            "`dataBinding.dimensions`; if the dimension you want to color by "
            "isn't grouped yet, add it to `dimensions` as well (it is not enough "
            "to name it here). Leave empty to color by the last dimension. "
            'E.g. to color by gender: set this to "gender" AND include "gender" '
            'in dimensions (e.g. dimensions ["name", "gender"]).'
        ),
        json_schema_extra={"x-control": "column"},
    )
    customize: Customization = Field(
        default_factory=Customization,
        title="Customize",
        description="Per-series color and size overrides.",
    )

    @model_validator(mode="after")
    def _color_dimension_must_be_grouped(self) -> "SeriesControls":
        """``colorDimension`` colors series widget by a dimension's distinct values,
        so that dimension must actually be grouped. Naming it here without
        adding it to ``dataBinding.dimensions`` would silently color by nothing;
        surface it as a validation error instead (the message tells the caller
        exactly what to fix)."""
        dimensions = self.data_binding.dimensions
        if self.color_dimension and self.color_dimension not in dimensions:
            raise ValueError(
                f'colorDimension "{self.color_dimension}" must be one of the '
                f"dataBinding dimensions {dimensions}; add it to `dimensions` "
                f"as well."
            )
        return self


class SeriesWidget(Widget):
    """
    Explicit/typed chart: renders one mark per query row, colored and sized
    per series. The per-series ``customize`` section is populated dynamically
    once a grouping dimension is chosen and the frontend reports the distinct
    series values (the SIP's ``x-dynamic`` pattern).
    """

    controls_class = SeriesControls
    behavior = WidgetBehavior(filterable=True)
    ui = WidgetUi(default_size=(12, 8))

    # Default color per series index. Must match the frontend widget's palette
    # so a series' color is stable before the author touches the customize
    # control.
    PALETTE = ["#e74c3c", "#3498db", "#2ecc71", "#f1c40f", "#9b59b6", "#1abc9c"]

    # Upper bound on distinct series inlined into the schema, so a caller can't
    # force unbounded schema construction / serialization by submitting a huge
    # (or duplicate-heavy) series list.
    MAX_SERIES = 100

    @staticmethod
    def _populate_series(
        schema: dict[str, Any],
        node: dict[str, Any],
        parsed: BaseModel | None,
        series: list[str],
        upstream: dict[str, Any],
    ) -> None:
        # `node` is Customization.series's own fragment; `SeriesStyle` is a
        # sibling $defs entry, only reachable via the full `schema`.
        style_def = schema.get("$defs", {}).get("SeriesStyle")
        if style_def is None:
            return
        # The x-dependsOn: ["dataBinding"] gate (run by run_enrichers before
        # this is ever called) only confirms a dataBinding was parsed at all
        # -- it can't express "dimensions is non-empty" (a nested attribute)
        # or "series is non-empty" (a runtime parameter, not a field on
        # parsed), so both stay checked here.
        dimensions = None
        if parsed is not None:
            data_binding = getattr(parsed, "data_binding", None)
            dimensions = getattr(data_binding, "dimensions", None)
        if not dimensions or not series:
            return
        # Dedupe (preserving order) and cap before doing per-series work, so an
        # oversized/duplicate list can't blow up CPU, memory, or response size.
        unique_series = list(dict.fromkeys(series))[: SeriesWidget.MAX_SERIES]
        # Replace the open-ended map with one inlined, pre-colored style per series.
        node.pop("additionalProperties", None)
        properties: dict[str, Any] = {}
        for index, value in enumerate(unique_series):
            style = deepcopy(style_def)
            style["properties"]["color"]["default"] = SeriesWidget.PALETTE[
                index % len(SeriesWidget.PALETTE)
            ]
            # Title each group with the series value so the control panel labels
            # it by series rather than by the shared model name ("SeriesStyle").
            style["title"] = value
            properties[value] = style
        node["properties"] = properties

    enrichers: ClassVar[dict[str, EnricherFn]] = {"customize/series": _populate_series}


@pytest.fixture
def series_widget() -> Iterator[type[Widget]]:
    """Registers ``SeriesWidget`` through the real decorator for one test."""
    widget(widget_type=WIDGET_TYPE, name="Series", description="Series test")(
        SeriesWidget
    )
    yield SeriesWidget
    registry.pop(WIDGET_TYPE, None)
