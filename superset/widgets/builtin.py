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
"""Built-in Dashboard V2 widgets. Importing this registers them.

Built-ins use the exact same public contract an extension does — ``@widget`` +
``Widget`` from ``superset_core.widgets`` — so there is no parallel registration
path. This module is imported (for its decorator side-effects) by
``inject_widget_implementations`` once the decorator is concrete.
"""

from __future__ import annotations

from copy import deepcopy
from typing import Any, ClassVar

from pydantic import BaseModel
from superset_core.widgets import EnricherFn, Widget, widget

from superset.widgets.controls import (
    AgGridTableControls,
    BalloonsControls,
    EchartsControls,
    MarkdownControls,
    MetricTileControls,
)


def _metric_key(metric: Any) -> str:
    """The stable label a `dataBinding` metric renders/queries under —
    mirrors the frontend's `getMetricLabel` (`@superset-ui/core`) exactly,
    since the two must agree: this is also the query result column name a
    structured series reads its data from."""
    if isinstance(metric, str):
        return metric
    if isinstance(metric, dict):
        label = metric.get("label")
        if label:
            return str(label)
        if metric.get("expressionType") != "SQL":
            column = metric.get("column") or {}
            column_name = column.get("columnName") or column.get("column_name") or ""
            aggregate = metric.get("aggregate") or ""
            return f"{aggregate}({column_name})"
        return str(metric.get("sqlExpression", ""))
    return str(metric)


@widget(
    widget_type="markdown",
    name="Markdown",
    description="Rich text authored in Markdown.",
)
class Markdown(Widget):
    controls_class = MarkdownControls


@widget(
    widget_type="echarts",
    name="ECharts",
    description="A chart from a raw ECharts option with $bind data markers.",
)
class Echarts(Widget):
    """
    A raw-ECharts-option chart, plus an optional structured layer: when
    ``chartType`` is set, ``customize.series`` offers one entry per
    ``dataBinding`` metric (the SIP's ``x-dynamic`` pattern, as ``Balloons``
    uses for its per-series styling) so a series can be colored, hidden, or
    relabeled without hand-editing ``echartsOptions``.
    """

    controls_class = EchartsControls

    # Default color per series index, matching the frontend's structured
    # series builder so a series' color is stable before the author touches
    # customize (same convention as Balloons.PALETTE).
    PALETTE = ["#e74c3c", "#3498db", "#2ecc71", "#f1c40f", "#9b59b6", "#1abc9c"]

    # Upper bound on distinct series inlined into the schema (see Balloons.MAX_SERIES).
    MAX_SERIES = 100

    @staticmethod
    def _populate_chart_series(
        schema: dict[str, Any],
        node: dict[str, Any],
        parsed: BaseModel | None,
        series: list[str],
        upstream: dict[str, Any],
    ) -> None:
        # Unlike Balloons (where dimension *values* are only known once the
        # frontend reports them, so an extra runtime guard is needed beyond
        # the x-dependsOn gate), a structured series' identity comes entirely
        # from `dataBinding.metrics` — a field already on `parsed` once the
        # `dataBinding`/`chartType` gate above has passed.
        style_def = schema.get("$defs", {}).get("SeriesOverride")
        if style_def is None:
            return
        data_binding = getattr(parsed, "data_binding", None) if parsed else None
        metrics = getattr(data_binding, "metrics", None) or []
        discovered_keys = [_metric_key(metric) for metric in metrics]
        customize = getattr(parsed, "customize", None) if parsed else None
        stored = getattr(customize, "series", None) or {}
        # Union with already-stored override keys, so an override for a
        # metric temporarily removed from dataBinding.metrics stays visible
        # (and thus editable/removable) instead of silently disappearing.
        combined_keys = list(dict.fromkeys([*discovered_keys, *stored.keys()]))
        if not combined_keys:
            # Also sidesteps a forward reference to `Echarts.MAX_SERIES`
            # below: this enricher runs once during the class's own
            # `@widget` registration check (control_values=None), before the
            # `Echarts` name is bound in this module.
            return
        all_keys = combined_keys[: Echarts.MAX_SERIES]
        node.pop("additionalProperties", None)
        properties: dict[str, Any] = {}
        for index, key in enumerate(all_keys):
            style = deepcopy(style_def)
            style["properties"]["color"]["default"] = Echarts.PALETTE[
                index % len(Echarts.PALETTE)
            ]
            style["title"] = key
            properties[key] = style
        node["properties"] = properties

    enrichers: ClassVar[dict[str, EnricherFn]] = {
        "customize/series": _populate_chart_series
    }


@widget(
    widget_type="metric-tile",
    name="Metric Tile",
    description="A single live metric value rendered as a big number.",
)
class MetricTile(Widget):
    controls_class = MetricTileControls


@widget(
    widget_type="ag-grid-table",
    name="Table",
    description="Query results rendered as an AG Grid table.",
)
class AgGridTable(Widget):
    controls_class = AgGridTableControls


@widget(
    widget_type="balloons",
    name="Balloons",
    description=(
        "Rising colored balloons, one per query row — colored and sized by the "
        "query (Chart Framework v2 POC)."
    ),
)
class Balloons(Widget):
    """
    Explicit/typed chart: renders one balloon per query row, colored and sized
    per series. The per-series ``customize`` section is populated dynamically
    once a grouping dimension is chosen and the frontend reports the distinct
    series values (the SIP's ``x-dynamic`` pattern).
    """

    controls_class = BalloonsControls

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
        unique_series = list(dict.fromkeys(series))[: Balloons.MAX_SERIES]
        # Replace the open-ended map with one inlined, pre-colored style per series.
        node.pop("additionalProperties", None)
        properties: dict[str, Any] = {}
        for index, value in enumerate(unique_series):
            style = deepcopy(style_def)
            style["properties"]["color"]["default"] = Balloons.PALETTE[
                index % len(Balloons.PALETTE)
            ]
            # Title each group with the series value so the control panel labels
            # it by series rather than by the shared model name ("SeriesStyle").
            style["title"] = value
            properties[value] = style
        node["properties"] = properties

    enrichers: ClassVar[dict[str, EnricherFn]] = {"customize/series": _populate_series}
