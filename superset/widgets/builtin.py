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
"""Built-in Dashboard V2 widget control sets. Importing this registers them."""

from __future__ import annotations

from copy import deepcopy
from typing import Any

from pydantic import BaseModel

from superset.widgets.controls import (
    AgGridTableControls,
    BalloonsControls,
    EchartsControls,
    MarkdownControls,
    MetricTileControls,
)
from superset.widgets.registry import registry, WidgetControls


@registry.register
class Markdown(WidgetControls):
    widget_type = "markdown"
    name = "Markdown"
    description = "Rich text authored in Markdown."
    controls_class = MarkdownControls


@registry.register
class Echarts(WidgetControls):
    widget_type = "echarts"
    name = "ECharts"
    description = "A chart from a raw ECharts option with $bind data markers."
    controls_class = EchartsControls


@registry.register
class MetricTile(WidgetControls):
    widget_type = "metric-tile"
    name = "Metric Tile"
    description = "A single live metric value rendered as a big number."
    controls_class = MetricTileControls


@registry.register
class AgGridTable(WidgetControls):
    widget_type = "ag-grid-table"
    name = "Table"
    description = "Query results rendered as an AG Grid table."
    controls_class = AgGridTableControls


@registry.register
class Balloons(WidgetControls):
    """
    Explicit/typed chart: renders one balloon per query row, colored and sized
    per series. The per-series ``customize`` section is populated dynamically
    once a grouping dimension is chosen and the frontend reports the distinct
    series values (the SIP's ``x-dynamic`` pattern).
    """

    widget_type = "balloons"
    name = "Balloons"
    description = "Bouncing colored balls, one per query row (Chart Framework v2 POC)."
    controls_class = BalloonsControls

    # Default color per series index. Must match the frontend widget's palette
    # so a series' color is stable before the author touches the customize
    # control.
    PALETTE = ["#e74c3c", "#3498db", "#2ecc71", "#f1c40f", "#9b59b6", "#1abc9c"]

    # Upper bound on distinct series inlined into the schema, so a caller can't
    # force unbounded schema construction / serialization by submitting a huge
    # (or duplicate-heavy) series list.
    MAX_SERIES = 100

    @classmethod
    def enrich_schema(
        cls,
        schema: dict[str, Any],
        parsed: BaseModel | None,
        series: list[str],
    ) -> None:
        # Nested models land in $defs; the x-dynamic field is Customization.series.
        defs = schema.get("$defs", {})
        series_prop = defs.get("Customization", {}).get("properties", {}).get("series")
        style_def = defs.get("SeriesStyle")
        if series_prop is None or style_def is None:
            return
        # Only populate once a grouping dimension is set and the frontend has
        # reported the distinct series values from the query results.
        dimensions = None
        if parsed is not None:
            data_binding = getattr(parsed, "data_binding", None)
            dimensions = getattr(data_binding, "dimensions", None)
        if not dimensions or not series:
            return
        # Dedupe (preserving order) and cap before doing per-series work, so an
        # oversized/duplicate list can't blow up CPU, memory, or response size.
        unique_series = list(dict.fromkeys(series))[: cls.MAX_SERIES]
        # Replace the open-ended map with one inlined, pre-colored style per series.
        series_prop.pop("additionalProperties", None)
        properties: dict[str, Any] = {}
        for index, value in enumerate(unique_series):
            style = deepcopy(style_def)
            style["properties"]["color"]["default"] = cls.PALETTE[
                index % len(cls.PALETTE)
            ]
            # Title each group with the series value so the control panel labels
            # it by series rather than by the shared model name ("SeriesStyle").
            style["title"] = value
            properties[value] = style
        series_prop["properties"] = properties
