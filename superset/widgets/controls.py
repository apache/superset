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
Pydantic control models for built-in Dashboard V2 widgets.

Field aliases are the camelCase names the frontend reads from ``node.props``
(e.g. ``datasetId``); Pydantic emits JSON Schema by alias by default, so the
served schema's property names match what widgets and ``fetchQueryData`` use.

Genuinely-required controls (``datasetId``, ``metrics``, ``dataBinding``) carry
no default so they land in the schema's ``required`` array. That is what makes
the MCP "minimum viable object" view meaningful: it surfaces exactly those
mandatory leaves, leaving optional/styling fields behind a drill-in.
"""

from __future__ import annotations

from typing import Any, ClassVar, Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator
from superset_core.widgets import MetricControl


class DataBinding(MetricControl):
    """Query binding for a data-backed widget (mirrors the frontend
    ``DataBindingSpec``). ``datasetId`` and ``metrics`` are mandatory; the rest
    are optional."""

    model_config = ConfigDict(populate_by_name=True)

    # Pydantic places an inherited field (``metrics``, from ``MetricControl``)
    # ahead of this class's own fields in ``model_fields`` regardless of
    # declaration order, so the rendered field order needs to be pinned
    # explicitly to match what this class served before composing MetricControl.
    field_order: ClassVar[list[str]] = [
        "datasetId",
        "metrics",
        "dimensions",
        "rowLimit",
    ]

    dataset_id: int = Field(
        alias="datasetId",
        title="Dataset ID",
        description="Numeric id of the dataset to query.",
    )
    dimensions: list[str] = Field(
        default_factory=list,
        title="Dimensions",
        description="Columns to group by (the categories / series).",
        json_schema_extra={"x-control": "column-multi"},
    )
    row_limit: int = Field(
        default=1000,
        ge=1,
        alias="rowLimit",
        title="Row limit",
        description="Maximum number of rows to fetch.",
    )


class MetricTileControls(BaseModel):
    """Controls for the ``metric-tile`` widget (a single "big number")."""

    model_config = ConfigDict(populate_by_name=True)

    data_binding: DataBinding = Field(
        alias="dataBinding",
        title="Data",
        description=(
            "The query behind the tile. Resolve one metric; the first result "
            "row's value is shown."
        ),
    )
    decimals: int = Field(
        default=0,
        ge=0,
        le=10,
        title="Decimal places",
        description="How many decimal places to show.",
    )
    prefix: str = Field(
        default="",
        title="Prefix",
        description='Text shown before the value (e.g. "$").',
    )
    suffix: str = Field(
        default="",
        title="Suffix",
        description='Text shown after the value (e.g. "%").',
    )
    label: str = Field(
        default="",
        title="Label",
        description="Caption under the number. Defaults to the column name.",
    )


class AgGridTableControls(BaseModel):
    """Controls for the ``ag-grid-table`` widget (query results as a table)."""

    model_config = ConfigDict(populate_by_name=True)

    data_binding: DataBinding = Field(
        alias="dataBinding",
        title="Data",
        description="The query whose rows fill the table.",
    )
    column_defs: list[dict[str, Any]] = Field(
        default_factory=list,
        alias="columnDefs",
        title="Column definitions",
        description=(
            "Optional AG Grid column definitions. When empty, columns are "
            "derived one-to-one from the query result columns."
        ),
        json_schema_extra={"x-control": "code", "x-language": "json"},
    )


class SeriesStyle(BaseModel):
    """Per-series balloon styling, populated dynamically once the grouping
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
            "Multiplier on the metric-derived balloon size for this series "
            "(1 = as-is, 2 = twice as big)."
        ),
        json_schema_extra={"x-step": 0.25},
    )


class Customization(BaseModel):
    """Per-series customization for the balloons widget.

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


class BalloonsControls(BaseModel):
    """Controls for the ``balloons`` chart widget (Chart Framework v2 POC).

    One balloon per query row, colored and sized per series (the distinct
    values of the first grouping dimension). ``customize`` is optional and
    populated on demand.
    """

    model_config = ConfigDict(populate_by_name=True)

    data_binding: DataBinding = Field(
        alias="dataBinding",
        title="Data",
        description=(
            "The query behind the balloons. Group by one or more dimensions "
            "(one balloon per resulting row); the metric sizes each balloon."
        ),
    )
    color_dimension: str = Field(
        default="",
        alias="colorDimension",
        title="Color dimension",
        description=(
            "Which grouping dimension colors the balloons — its distinct values "
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
    def _color_dimension_must_be_grouped(self) -> "BalloonsControls":
        """``colorDimension`` colors balloons by a dimension's distinct values,
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


class MarkdownControls(BaseModel):
    """Controls for the ``markdown`` widget (rich text)."""

    model_config = ConfigDict(populate_by_name=True)

    content: str = Field(
        title="Text",
        description="Markdown content rendered by the widget.",
        json_schema_extra={"x-control": "markdown"},
    )


class SeriesOverride(BaseModel):
    """One structured chart series' visual override, matched to a
    ``dataBinding`` metric by its stable label (the same label ECharts'
    `getMetricLabel`-equivalent computes and the query result column is
    named after), not by array position."""

    color: str = Field(
        default="",
        title="Color",
        description="Empty keeps the palette-assigned default.",
        json_schema_extra={"x-control": "color"},
    )
    visible: bool = Field(
        default=True,
        title="Visible",
        description="Unchecking omits this series from the rendered chart.",
    )
    display_name: str = Field(
        default="",
        alias="displayName",
        title="Display name",
        description=(
            "Overrides the series' legend/tooltip label. Empty keeps the "
            "metric's own label."
        ),
    )


class EchartsCustomization(BaseModel):
    """Per-series overrides for a structured (``chartType`` set) echarts
    chart.

    ``series`` is ``x-dynamic``: inlined with one entry per ``dataBinding``
    metric once ``chartType`` is set, plus any already-stored override whose
    metric was since removed from ``dataBinding.metrics`` — so switching
    metrics around doesn't silently discard configuration (see
    ``Echarts._populate_chart_series``).
    """

    series: dict[str, SeriesOverride] = Field(
        default_factory=dict,
        title="Per-series overrides",
        json_schema_extra={
            "x-dynamic": True,
            "x-dependsOn": ["dataBinding", "chartType"],
        },
    )


class EchartsChrome(BaseModel):
    """Structured chart chrome — title, legend, tooltip, axis labels — each
    field independently optional and layered on top of the matching
    `echartsOptions` section. A field left at its default doesn't touch
    `echartsOptions` at all; only the specific key(s) a set field manages are
    merged onto that section, so an unmanaged sibling property there (e.g. a
    hand-authored `legend.orient`) survives.

    Deliberately flat (not grouped into `title`/`legend`/`tooltip`/`xAxis`/
    `yAxis` sub-objects — the natural modeling) rather than nested two levels
    under `chrome`: JsonForms' generated control panel only renders one level
    of nested-object properties (the same depth `DataBinding`/`Customization`
    already rely on), so a `chrome.title.text`-style double nesting would
    render an empty group with no fields inside it.
    """

    model_config = ConfigDict(populate_by_name=True)

    title_text: str = Field(
        default="",
        alias="titleText",
        title="Title",
        description="Empty leaves echartsOptions.title exactly as authored.",
    )
    legend_show: bool = Field(
        default=True,
        alias="legendShow",
        title="Show legend",
        description="Unchecking hides the legend, regardless of echartsOptions.",
    )
    legend_position: Literal["top", "bottom", "left", "right"] | None = Field(
        default=None,
        alias="legendPosition",
        title="Legend position",
        description=(
            "Unset leaves echartsOptions.legend's own position (or "
            "ECharts' default) untouched."
        ),
        json_schema_extra={
            "x-control": "select",
            "x-options": ["top", "bottom", "left", "right"],
        },
    )
    tooltip_trigger: Literal["item", "axis"] | None = Field(
        default=None,
        alias="tooltipTrigger",
        title="Tooltip trigger",
        description=(
            "Unset leaves echartsOptions.tooltip's own trigger (or "
            "ECharts' default) untouched."
        ),
        json_schema_extra={
            "x-control": "select",
            "x-options": ["item", "axis"],
        },
    )
    x_axis_name: str = Field(
        default="",
        alias="xAxisName",
        title="X axis name",
        description="Empty leaves the axis's own `name` (or none) untouched.",
    )
    x_axis_rotate: int = Field(
        default=0,
        ge=-90,
        le=90,
        alias="xAxisRotate",
        title="X axis label rotation (°)",
        description="0 leaves the axis's own `axisLabel.rotate` (or none) untouched.",
    )
    x_axis_format: str = Field(
        default="",
        alias="xAxisFormat",
        title="X axis label format",
        description=(
            'An ECharts axisLabel formatter template, e.g. "{value} kg". Empty '
            "leaves the axis's own `axisLabel.formatter` (or none) untouched."
        ),
    )
    y_axis_name: str = Field(
        default="",
        alias="yAxisName",
        title="Y axis name",
        description="Empty leaves the axis's own `name` (or none) untouched.",
    )
    y_axis_rotate: int = Field(
        default=0,
        ge=-90,
        le=90,
        alias="yAxisRotate",
        title="Y axis label rotation (°)",
        description="0 leaves the axis's own `axisLabel.rotate` (or none) untouched.",
    )
    y_axis_format: str = Field(
        default="",
        alias="yAxisFormat",
        title="Y axis label format",
        description=(
            'An ECharts axisLabel formatter template, e.g. "{value} kg". Empty '
            "leaves the axis's own `axisLabel.formatter` (or none) untouched."
        ),
    )


class EchartsControls(BaseModel):
    """Controls for the ``echarts`` widget (a chart from a raw ECharts option).

    Not modeled field-by-field: ``echartsOptions`` is a near-raw ECharts
    ``option`` edited as JSON, with ``$bind`` markers splicing in the queried
    data. The query itself is the standard ``dataBinding``.

    ``chartType``/``customize`` are an optional structured layer on top:
    when ``chartType`` is set, the frontend replaces `option.series` with one
    generated series per ``dataBinding`` metric (styled per ``customize``).
    Leaving ``chartType`` unset ("Custom") keeps ``echartsOptions.series``
    fully authoritative, including mixed-series or non-Cartesian (e.g. pie)
    shapes the structured layer doesn't cover.

    ``chrome`` is a second, independent structured layer — title, legend,
    tooltip, and axis labels — each leaf optional and applying (or not)
    regardless of ``chartType``. See ``EchartsChrome`` for its own
    leaf-by-leaf precedence.
    """

    model_config = ConfigDict(populate_by_name=True)

    data_binding: DataBinding = Field(
        alias="dataBinding",
        title="Data",
        description="The query whose rows the ECharts option's $bind markers read.",
    )
    echarts_options: dict[str, Any] = Field(
        default_factory=dict,
        alias="echartsOptions",
        title="ECharts option",
        description=(
            "A near-raw ECharts `option` object "
            "(https://echarts.apache.org/en/option.html). Anywhere a literal "
            "value would normally go, use a $bind marker to splice in the "
            'queried data or a theme token: {"$bind": {"source": "metric", '
            '"alias": "<metric name>"}} or {"source": "dimension", "alias": '
            '"<column name>"}} yields one array of that column\'s values (add '
            '"single": true to unwrap a single-row value); {"$bind": {"source": '
            '"records", "fields": {"name": "<col>", "value": "<col>"}}} yields '
            "an array of {name, value} objects (e.g. for pie series data); and "
            '{"$bind": {"source": "theme", "token": "<token>"}} yields a Superset '
            "theme value. The $bind wrapper is required."
        ),
        json_schema_extra={
            "x-control": "code",
            "x-language": "json",
            "x-spec-dialect": "echarts",
            # The Inspector's JSON tab already edits the whole `node.props`
            # record as text — including this field — so a second, redundant
            # raw-JSON box in the Form tab just duplicates it. Hidden there;
            # still fully editable via the JSON tab (or `chartType`/
            # `customize` for what those manage).
            "x-hidden-in-form": True,
        },
    )
    chart_type: Literal["bar", "line", "scatter"] | None = Field(
        default=None,
        alias="chartType",
        title="Chart type",
        description=(
            "Renders a structured chart — one series per dataBinding metric — "
            "layered on top of echartsOptions. Leave unset ('Custom') to use "
            "echartsOptions exactly as authored, including mixed-series or "
            "non-Cartesian (e.g. pie) configurations. Pie isn't offered here: "
            "its data shape (one series, categories as data points) doesn't "
            "match the one-series-per-metric model this picker drives."
        ),
        json_schema_extra={
            "x-control": "select",
            "x-options": ["bar", "line", "scatter"],
        },
    )
    customize: EchartsCustomization = Field(
        default_factory=EchartsCustomization,
        title="Customize",
        description="Per-series color, visibility, and display-name overrides.",
    )
    chrome: EchartsChrome = Field(
        default_factory=EchartsChrome,
        title="Chrome",
        description="Structured title, legend, tooltip, and axis label overrides.",
    )
    cross_filter: bool = Field(
        default=False,
        alias="crossFilter",
        title="Cross-filter on click",
        description=(
            "Emit a cross-filter from the first grouping dimension when a "
            "point is clicked (requires dataBinding.dimensions to have at "
            "least one entry). Clicking the same point again clears it."
        ),
    )


class FilterScope(BaseModel):
    """Which widgets a filter's selection reaches.

    Empty ``targets`` (the default) means every query-bound widget reading
    the same ``datasetId`` as the filter. A non-empty ``targets`` REPLACES
    that dataset-match default rather than adding to it.
    """

    model_config = ConfigDict(populate_by_name=True)

    targets: list[str] = Field(
        default_factory=list,
        title="Targets",
        description=(
            "Node ids this filter applies to. Leave empty to apply to every "
            "widget reading the same dataset instead."
        ),
    )


class FilterSelectControls(BaseModel):
    """Controls for the ``filter.select`` widget (a value/multi-select
    dashboard filter).

    Deliberately not a ``dataBinding`` — a filter has no metrics, just a
    target column. ``datasetId``'s enum (every dataset the caller can view)
    and ``column``'s enum (that dataset's own columns, populated once
    ``datasetId`` is set) are both populated dynamically — see
    ``FilterSelect.enrichers``.
    """

    model_config = ConfigDict(populate_by_name=True)

    dataset_id: int = Field(
        alias="datasetId",
        title="Dataset ID",
        description="Numeric id of the dataset this filter targets.",
        json_schema_extra={"x-dynamic": True},
    )
    # Defaulted (unlike `dataset_id`) even though a real filter needs one:
    # the control panel posts control_values as the author fills fields in,
    # and until a dataset is chosen there's no `column` value to send at
    # all. Without a default, validating that partial payload would raise
    # on the *missing* field, `Widget.get_control_schema` would swallow that
    # and fall back to `parsed=None`, and the column enricher would never
    # see the `dataset_id` it needs to populate this very field's `enum` —
    # i.e. picking a dataset would never turn `column` into a working
    # dropdown. `min_length=1` keeps an explicit empty value invalid at
    # commit time (`validate_control_values`), since Pydantic only checks
    # defaults against a field's validators when asked to, not on every
    # validate() (see `validate_default` if that ever needs to change).
    column: str = Field(
        default="",
        min_length=1,
        title="Column",
        description="The column this filter constrains.",
        json_schema_extra={"x-dynamic": True, "x-dependsOn": ["datasetId"]},
    )
    # Both hidden from the generated Form (see `x-hidden` in `buildUiSchema`):
    # a raw string-list "Add one at a time" control is more clutter than help
    # for what's meant to be an edge case, not the primary way to configure a
    # filter. Still real fields — present in the schema/JSON tab and fully
    # functional — just not offered as a first-class Form control.
    options: list[str] = Field(
        default_factory=list,
        title="Options",
        description=(
            "Optional static list of selectable values. Leave empty to query "
            "the target column's own distinct values at render time instead."
        ),
        json_schema_extra={"x-hidden": True},
    )
    default_selection: list[str] = Field(
        default_factory=list,
        alias="defaultSelection",
        title="Default selection",
        description=(
            "Starting selection, applied once the first time this filter "
            "renders with no live viewer selection yet."
        ),
        json_schema_extra={"x-hidden": True},
    )
    scope: FilterScope = Field(
        default_factory=FilterScope,
        title="Scope",
        description="Which widgets this filter's selection reaches.",
    )


class FilterBarControls(BaseModel):
    """Controls for the ``filter.bar`` widget — a plain arranging container
    for ``filter.*`` children; it holds no data of its own."""

    model_config = ConfigDict(populate_by_name=True)

    orientation: Literal["horizontal", "vertical"] = Field(
        default="horizontal",
        title="Orientation",
        description="Whether filters lay out side by side or stacked.",
    )
