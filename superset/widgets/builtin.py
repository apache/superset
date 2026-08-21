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
from typing import Any

from pydantic import BaseModel
from superset_core.widgets import Widget, widget

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
    controls_class = EchartsControls


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

    @classmethod
    def enrich_schema(
        cls,
        schema: dict[str, Any],
        parsed: BaseModel | None,
        series: list[str],  # noqa: ARG003
    ) -> None:
        # Unlike `column` below, this doesn't depend on any other field, so
        # it's populated unconditionally with every dataset the caller can
        # view — `enum` carries the ids the widget actually stores, and
        # `x-enumNames` the display names the control panel shows instead
        # (see `EnumNamesControl` on the frontend).
        if (dataset_prop := schema.get("properties", {}).get("datasetId")) is not None:
            datasets = DatasetDAO.find_all()
            dataset_prop["enum"] = [dataset.id for dataset in datasets]
            dataset_prop["x-enumNames"] = [dataset.name for dataset in datasets]

        column_prop = schema.get("properties", {}).get("column")
        if column_prop is None:
            return
        # Every early-return below leaves `enum` explicitly blank (rather than
        # merely absent) so the field degrades to a plain text input instead
        # of an enum-typed control with no choices. `build_configuration_schema`
        # already does this when `parsed` is None; these branches cover the
        # cases it doesn't (a dataset that's unset, missing, or inaccessible).
        column_prop["enum"] = []
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
        column_prop["enum"] = dataset.filterable_column_names


@widget(
    widget_type="filter.bar",
    name="Filter Bar",
    description="A plain arranging container for filter.* children.",
)
class FilterBar(Widget):
    controls_class = FilterBarControls
