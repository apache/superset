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

import re
from typing import Annotated, Any, ClassVar, Literal

from pydantic import (
    BaseModel,
    ConfigDict,
    Discriminator,
    Field,
    field_validator,
    model_validator,
    Tag,
    TypeAdapter,
    ValidationError,
    ValidatorFunctionWrapHandler,
)
from superset_core.widgets import MetricControl

FilterScalar = str | int | float | bool

# A string that is JavaScript source rather than a value: `function (p) {...}`
# or an arrow function. ECharts template strings (`{c} USD`) don't match.
_JAVASCRIPT_FUNCTION = re.compile(
    r"^\s*(?:async\s+)?(?:"
    r"function\b\s*[\w$]*\s*\("  # function keyword, with its parameter list
    r"|(?:\([^)]*\)|[\w$]+)\s*=>\s*(?:[{(\"'`]|[\w$]+\s*[.(\[])"  # arrow + body
    r")"
)
FUNCTION_ALTERNATIVES = (
    'use {"$template": "<Handlebars>"} where ECharts takes a formatter, or an '
    "ECharts template string such as '{c} USD'"
)


def javascript_functions(value: Any, path: str = "") -> list[str]:
    """Dotted paths of the strings in ``value`` that are JavaScript functions.

    A JSON option can't carry a function: ECharts draws the source text as the
    label or tooltip, so such a string is refused rather than stored.
    """
    if isinstance(value, str):
        return [path] if _JAVASCRIPT_FUNCTION.match(value) else []
    if isinstance(value, dict):
        return [
            found
            for key, item in value.items()
            for found in javascript_functions(item, f"{path}.{key}" if path else key)
        ]
    if isinstance(value, list):
        return [
            found
            for index, item in enumerate(value)
            for found in javascript_functions(item, f"{path}[{index}]")
        ]
    return []


ColumnOperator = Literal[
    "=",
    "!=",
    ">",
    ">=",
    "<",
    "<=",
    "LIKE",
    "NOT LIKE",
    "ILIKE",
    "NOT ILIKE",
    "IN",
    "NOT IN",
    "IS NULL",
    "IS NOT NULL",
    "IS TRUE",
    "IS FALSE",
    "TEMPORAL_RANGE",
]
NO_VALUE_OPERATORS = frozenset({"IS NULL", "IS NOT NULL", "IS TRUE", "IS FALSE"})
LIST_OPERATORS = frozenset({"IN", "NOT IN"})


class ColumnFilter(BaseModel):
    """A fixed filter on one column of the binding's dataset."""

    model_config = ConfigDict(extra="forbid")

    column: str = Field(min_length=1, description="A column of the dataset.")
    op: ColumnOperator = Field(
        description=(
            "LIKE / NOT LIKE / ILIKE / NOT ILIKE take % wildcards; IN / NOT IN "
            "take a list; IS NULL / IS NOT NULL / IS TRUE / IS FALSE take no "
            "value; TEMPORAL_RANGE takes a time range on a temporal column, "
            "such as `Last month` or `2024-01-01 : 2024-07-01`."
        ),
    )
    value: FilterScalar | list[FilterScalar] | None = Field(
        default=None,
        description=(
            "The value compared against: one scalar, a list for IN / NOT IN, "
            "omitted for IS NULL / IS NOT NULL / IS TRUE / IS FALSE."
        ),
    )

    @model_validator(mode="after")
    def _value_fits_operator(self) -> ColumnFilter:
        if self.op in NO_VALUE_OPERATORS:
            if self.value is not None:
                raise ValueError(f"{self.op} takes no value")
        elif self.op in LIST_OPERATORS:
            if not isinstance(self.value, list) or not self.value:
                raise ValueError(f"{self.op} takes a non-empty list of values")
        elif self.op == "TEMPORAL_RANGE":
            if not isinstance(self.value, str) or not self.value:
                raise ValueError("TEMPORAL_RANGE takes a time range string")
        elif self.value is None or isinstance(self.value, list):
            raise ValueError(f"{self.op} takes a single value")
        return self


class SqlFilter(BaseModel):
    """A free SQL predicate, on rows (``WHERE``) or on aggregates
    (``HAVING``)."""

    model_config = ConfigDict(extra="forbid")

    sql: str = Field(
        min_length=1,
        description=(
            "A boolean SQL expression in the dataset's dialect, e.g. "
            "`order_date >= '2024-01-01'` or `SUM(sales) > 1000` with "
            '`"clause": "HAVING"`.'
        ),
    )
    clause: Literal["WHERE", "HAVING"] = Field(
        default="WHERE",
        description="WHERE filters rows before aggregation, HAVING after it.",
    )


def _filter_kind(value: Any) -> str:
    """Which filter a stored value means, by the key only one of them has, so
    a bad value is reported against that filter's fields."""
    if isinstance(value, SqlFilter) or (isinstance(value, dict) and "sql" in value):
        return "sql"
    return "column"


BindingFilter = Annotated[
    Annotated[ColumnFilter, Tag("column")] | Annotated[SqlFilter, Tag("sql")],
    Discriminator(_filter_kind),
]

_binding_filters = TypeAdapter(list[BindingFilter])


def parse_binding_filters(value: Any) -> list[ColumnFilter | SqlFilter]:
    """``value`` as a binding's filters, or ``ValidationError`` whose locations
    are ``(index, field)``: the union tag pydantic puts between them is not a
    level of the stored value."""
    try:
        return _binding_filters.validate_python(value)
    except ValidationError as ex:
        errors = []
        for error in ex.errors(include_url=False):
            loc = error["loc"]
            if len(loc) >= 2 and loc[1] in ("column", "sql"):
                loc = (loc[0], *loc[2:])
            errors.append({**error, "loc": loc})
        raise ValidationError.from_exception_data(ex.title, errors) from None


class SortKey(BaseModel):
    """One sort key of a ``dataBinding``: a metric label or a dimension."""

    field: str = Field(
        min_length=1,
        description="A metric's label or a dimension column name.",
    )
    descending: bool = False


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
        "filters",
        "orderBy",
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
    filters: list[BindingFilter] = Field(
        default_factory=list,
        title="Filters",
        description=(
            "The chart's own fixed filters, all applied (AND), on top of what "
            "the canvas's filter widgets add at view time. "
            '`{"column": "country", "op": "=", "value": "FR"}` filters one '
            'column; `{"sql": "<predicate>"}` is a free SQL predicate, with '
            '`"clause": "HAVING"` to filter aggregates.'
        ),
    )
    row_limit: int = Field(
        default=1000,
        ge=1,
        alias="rowLimit",
        title="Row limit",
        description="Maximum number of rows to fetch.",
    )
    order_by: list[SortKey] = Field(
        default_factory=list,
        alias="orderBy",
        title="Sort",
        description=(
            "Sort keys applied before the row limit, e.g. "
            '`[{"field": "revenue", "descending": true}]` for a top N.'
        ),
    )

    @field_validator("filters", mode="wrap")
    @classmethod
    def _filters_without_union_tags(
        cls, value: Any, handler: ValidatorFunctionWrapHandler
    ) -> Any:
        try:
            return handler(value)
        except ValidationError as ex:
            raise ValidationError.from_exception_data(
                ex.title,
                [
                    {**error, "loc": (error["loc"][0], *error["loc"][2:])}
                    if len(error["loc"]) >= 2 and error["loc"][1] in ("column", "sql")
                    else error
                    for error in ex.errors(include_url=False)
                ],
            ) from None


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


class MarkdownControls(BaseModel):
    """Controls for the ``markdown`` widget (rich text)."""

    model_config = ConfigDict(populate_by_name=True)

    content: str = Field(
        title="Text",
        description=(
            "Markdown content rendered by the widget. With a dataBinding, "
            "`{{alias}}` is replaced by the first row's value for a metric "
            "or dimension alias, `{{alias|format}}` formats a number with a "
            "d3-format string (e.g. `{{revenue|$,.2s}}`), and "
            "`{{#rows}}...{{/rows}}` repeats its content once per row."
        ),
        json_schema_extra={"x-control": "markdown"},
    )
    data_binding: DataBinding | None = Field(
        default=None,
        alias="dataBinding",
        title="Data",
        description="Optional query whose results fill the content's placeholders.",
    )


class SeriesOverride(BaseModel):
    """One structured chart series' visual override, matched to a
    ``dataBinding`` metric by its stable label (the same label ECharts'
    `getMetricLabel`-equivalent computes and the query result column is
    named after), not by array position."""

    color: str = Field(
        default="",
        title="Color",
        description="Empty means no explicit color; the renderer chooses.",
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
    tooltip_template: str = Field(
        default="",
        alias="tooltipTemplate",
        title="Tooltip template",
        description=(
            "A Handlebars template for the tooltip's text, the syntax deck.gl "
            "tooltips use. It sees the hovered item's ECharts params "
            "(`seriesName`, `name`, `value`, `data`, `percent`, `marker`, ...) "
            "and `items`, every item under the pointer for an axis trigger: "
            '`{{marker}} {{seriesName}}: {{formatNumber value ",.2f"}}` or '
            "`{{name}}\\n{{#each items}}{{marker}} {{seriesName}}: {{value}}\\n"
            "{{/each}}`. Helpers: `formatNumber value d3-format`, "
            "`formatDate value d3-time-format`, `default value fallback`. Plain "
            "text, not HTML. Empty leaves the tooltip's own `formatter` (or "
            "none) untouched."
        ),
        json_schema_extra={"x-control": "code", "x-language": "handlebars"},
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

    @field_validator("echarts_options")
    @classmethod
    def _no_javascript(cls, options: dict[str, Any]) -> dict[str, Any]:
        if found := javascript_functions(options):
            raise ValueError(
                f"{found[0]} is a JavaScript function, which a JSON option "
                f"cannot carry; {FUNCTION_ALTERNATIVES}"
            )
        return options

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
            "A near-raw ECharts 6 `option` object "
            "(https://echarts.apache.org/en/option.html). Anywhere a literal "
            "value would normally go, use a $bind marker to splice in the "
            'queried data or a theme token: {"$bind": {"source": "metric", '
            '"alias": "<metric name>"}} or {"source": "dimension", "alias": '
            '"<column name>"}} yields one array of that column\'s values (add '
            '"single": true to unwrap a single-row value); {"$bind": {"source": '
            '"records", "fields": {"name": "<col>", "value": "<col>"}}} yields '
            "an array of {name, value} objects (e.g. for pie series data; a "
            'dotted key such as "label.fontSize" nests); {"$bind": {"source": '
            '"tuples", "fields": ["<col>", "<col>", ...]}} yields one array per '
            "row, for series whose data items are arrays (themeRiver, "
            "candlestick, boxplot, heatmap); and "
            '{"$bind": {"source": "theme", "token": "<token>"}} yields a Superset '
            "theme value. The $bind wrapper is required. Function-valued "
            "options are not allowed; where ECharts takes a formatter function "
            '(`formatter`, `valueFormatter`) use {"$template": "<Handlebars>"} '
            "(see `chrome.tooltipTemplate` for the syntax) or an ECharts "
            "template string. Features new in ECharts 6 are available: a "
            "beeswarm is a scatter on a category axis with `jitter` and "
            "`jitterOverlap: false`, and an axis takes `breaks` to skip a "
            "value range."
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


class FilterBarControls(BaseModel):
    """Controls for the ``filter.bar`` widget — a plain arranging container
    for ``filter.*`` children; it holds no data of its own."""

    model_config = ConfigDict(populate_by_name=True)

    orientation: Literal["horizontal", "vertical"] = Field(
        default="horizontal",
        title="Orientation",
        description="Whether filters lay out side by side or stacked.",
    )


class TabsControls(BaseModel):
    """Controls for the ``tabs`` container; its tabs are its children."""

    model_config = ConfigDict(populate_by_name=True)


class TabControls(BaseModel):
    """Controls for a ``tab`` inside ``tabs``."""

    model_config = ConfigDict(populate_by_name=True)

    title: str = Field(
        default="",
        title="Title",
        description="The tab's label.",
    )


class GroupControls(BaseModel):
    """Controls for a ``group``: a container with its own grid."""

    model_config = ConfigDict(populate_by_name=True)

    title: str = Field(
        default="",
        title="Title",
        description="Optional heading shown above the group.",
    )
