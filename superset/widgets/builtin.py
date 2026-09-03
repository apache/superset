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

import logging
from copy import deepcopy
from typing import Any, ClassVar

from pydantic import BaseModel
from superset_core.widgets import EnricherFn, Widget, widget

from superset.daos.dataset import DatasetDAO
from superset.exceptions import SupersetSecurityException
from superset.widgets.controls import (
    AgGridTableControls,
    BalloonsControls,
    EchartsControls,
    FilterBarControls,
    FilterSelectControls,
    MarkdownControls,
    MetricTileControls,
)

logger = logging.getLogger(__name__)


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


@widget(
    widget_type="filter.select",
    name="Filter",
    description="A value/multi-select dashboard filter.",
)
class FilterSelect(Widget):
    """
    A leaf ``filter.*`` widget: reads ``datasetId``/``column`` and, at
    render time, either the author's static ``options`` or the column's own
    distinct values. Its live selection travels over the widget event bus
    (``dashboard.emit``/``getValue``), not ``props`` — see the frontend
    ``FilterSelectWidget`` and ``collectActiveFilters`` — so nothing about
    that selection lives in this schema.
    """

    controls_class = FilterSelectControls

    @staticmethod
    def _populate_datasets(
        _schema: dict[str, Any],
        node: dict[str, Any],
        _parsed: BaseModel | None,
        _series: list[str],
        _upstream: dict[str, Any],
    ) -> None:
        """Populate the dataset picker with datasets the caller can view."""
        datasets = DatasetDAO.find_all()
        node["enum"] = [dataset.id for dataset in datasets]
        node["x-enumNames"] = [dataset.name for dataset in datasets]

    @staticmethod
    def _populate_columns(
        _schema: dict[str, Any],
        node: dict[str, Any],
        parsed: BaseModel | None,
        _series: list[str],
        _upstream: dict[str, Any],
    ) -> None:
        # Every early-return below leaves `enum` explicitly blank (rather than
        # merely absent) so the field degrades to a plain text input instead
        # of an enum-typed control with no choices. `build_configuration_schema`
        # already does this when `parsed` is None; these branches cover the
        # cases it doesn't (a dataset that's unset, missing, or inaccessible).
        node["enum"] = []
        dataset_id = getattr(parsed, "dataset_id", None) if parsed else None
        if not dataset_id:
            return
        dataset = DatasetDAO.find_by_id(dataset_id)
        if dataset is None:
            return
        try:
            dataset.raise_for_access()
        except SupersetSecurityException:
            # Same fail-open as an unset dataset: the field just falls back to
            # a plain text input rather than a 500 or a schema that leaks
            # column names for a dataset this caller cannot read.
            logger.info(
                "Access denied enriching filter.select column enum for dataset %s",
                dataset_id,
            )
            return
        node["enum"] = dataset.filterable_column_names

    enrichers: ClassVar[dict[str, EnricherFn]] = {
        "datasetId": _populate_datasets,
        "column": _populate_columns,
    }


@widget(
    widget_type="filter.bar",
    name="Filter Bar",
    description="A plain arranging container for filter.* children.",
)
class FilterBar(Widget):
    controls_class = FilterBarControls
