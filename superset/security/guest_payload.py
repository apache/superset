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
Helpers for comparing a guest user's chart data request against the stored chart.

Used by ``query_context_modified`` to ensure guest users on embedded dashboards can
only read the metrics and columns the chart was saved with.
"""

from typing import Any

from superset.utils import json

#: Chart ``params`` keys that can hold a chart's metrics. A request always carries its
#: metrics under ``metrics``, but each chart type saves them under its own control name:
#: big number and pie store ``metric``, bubble stores ``x``/``y``/``size``, and so on.
#: Broader than ``METRIC_FORM_DATA_PARAMS`` in ``superset.connectors.sqla.models``,
#: which omits several of these; kept separate to avoid importing that module here.
STORED_METRIC_PARAMS = (
    "metric",
    "metric_2",
    "metrics",
    "metrics_b",
    "percent_metrics",
    "point_radius_fixed",
    "right_axis_metric",
    "secondary_metric",
    "series_limit_metric",
    "series_limit_metric_b",
    "size",
    "timeseries_limit_metric",
    "timeseries_limit_metric_b",
    "tooltip_metrics",
    "x",
    "y",
)

#: Chart ``params`` keys that can hold a chart's columns or group-bys. As with the
#: metrics above, a request carries them under ``columns``/``groupby`` while charts save
#: them under control names such as ``all_columns`` (table), ``source``/``target``
#: (sankey), or ``x_axis`` (time series).
STORED_COLUMN_PARAMS = (
    "all_columns",
    "all_columns_x",
    "column",
    "columns",
    "dimension",
    "end_spatial",
    "end_time",
    "entity",
    "geom_column",
    "granularity_sqla",
    "groupby",
    "groupbyColumns",
    "groupbyRows",
    "groupby_b",
    "id",
    "js_columns",
    "line_column",
    "name",
    "order_by_cols",
    "parent",
    "series",
    "series_columns",
    "source",
    "source_category",
    "spatial",
    "start_spatial",
    "start_time",
    "target",
    "target_category",
    "tooltip_columns",
    "tooltip_contents",
    "x_axis",
    "y_axis",
)

#: Keys that ``normalizeTimeColumn`` (superset-ui-core) adds when it synthesizes a
#: chart's saved x-axis into a ``BASE_AXIS`` column. They describe how the axis is
#: rendered rather than which data is read.
BASE_AXIS_SYNTHETIC_KEYS = frozenset({"columnType", "isColumnReference", "timeGrain"})


def freeze_value(value: Any) -> str:
    """
    Used to compare column and metric sets.
    """
    return json.dumps(value, sort_keys=True)


def collapse_column_reference(value: Any) -> Any:
    """
    Reduce an adhoc column that merely names a physical column to that column's name.

    A physical column is saved in a chart's ``params`` as a bare string, but the
    frontend may send it as an adhoc column that only points back at it — either
    tagged ``columnType: "BASE_AXIS"`` with ``isColumnReference`` (how a saved x-axis
    is normalized), or as a plain adhoc column whose ``sqlExpression`` is its own
    label. Neither reads data beyond the saved column, yet neither appears verbatim in
    ``params``, so a guest merely loading such a chart would otherwise be rejected as
    a tamperer.

    Collapsing only rewrites the reference to the name it points at; the result still
    has to match a value stored on the chart, so pointing at an unrelated column or
    wrapping free-form SQL grants no additional access. Adhoc x-axis columns keep
    their definition and shed only the synthetic markers. Other values are returned
    unchanged.
    """
    if not isinstance(value, dict):
        return value

    expression = value.get("sqlExpression")
    if isinstance(expression, str) and (
        value.get("isColumnReference") or expression == value.get("label")
    ):
        return expression

    if value.get("columnType") == "BASE_AXIS":
        return {
            key: val
            for key, val in value.items()
            if key not in BASE_AXIS_SYNTHETIC_KEYS
        }

    return value


def unwrap_orderby(value: Any) -> Any:
    """
    Return the expression an ``orderby`` entry sorts on.

    Entries are ``[expression, is_ascending]`` pairs; only the expression selects data
    and therefore needs to be validated.
    """
    if (
        isinstance(value, (list, tuple))
        and len(value) == 2
        and isinstance(value[1], bool)
    ):
        return value[0]
    return value


def _as_items(value: Any) -> list[Any]:
    """
    The individual values held by a control, which may be scalar or list-valued.

    Scalar-valued controls (``metric``, ``x_axis``, heatmap's ``groupby``, ...) hold a
    single value. Wrapping them keeps a bare string from being iterated character by
    character, which would compare nothing meaningful.
    """
    if value is None or value == "":
        return []
    if isinstance(value, (list, tuple)):
        return [item for item in value if item is not None and item != ""]
    return [value]


def _decode_orderby_pair(value: Any) -> Any:
    """
    Decode an ``order_by_cols`` entry, which stores its pair JSON-encoded in a string.

    Only strings holding a ``[column, is_ascending]`` list are decoded, so a column
    whose name happens to be valid JSON is left alone.
    """
    if not isinstance(value, str):
        return value
    try:
        decoded = json.loads(value)
    except ValueError:
        return value
    return decoded if isinstance(decoded, list) else value


#: Controls whose stored value is a nested lat/lon/geohash configuration rather than a
#: column name. The frontend decomposes them with ``getSpatialColumns()`` and queries
#: the columns they name, so the stored config has to be decomposed the same way to be
#: comparable against the flat column names a request carries.
SPATIAL_PARAMS = frozenset({"end_spatial", "spatial", "start_spatial"})

#: Keys a spatial configuration can name a column under, per ``getSpatialColumns()``.
SPATIAL_COLUMN_KEYS = ("geohashCol", "latCol", "lonCol", "lonlatCol")

#: Control holding a chart definition JSON-encoded inside a string, with its own metrics
#: and columns nested within. Scanning the outer ``params`` keys never looks inside it.
EMBEDDED_CHART_PARAM = "selected_chart"


def decompose_spatial(value: Any) -> list[Any]:
    """
    The columns a spatial configuration names, mirroring ``getSpatialColumns()``.

    A configuration names its columns under ``lonCol``/``latCol`` (latlong),
    ``lonlatCol`` (delimited) or ``geohashCol`` (geohash). All of them are returned
    regardless of the declared ``type``, since every one is a column the chart is saved
    with; the request still has to name one of them exactly.
    """
    if not isinstance(value, dict):
        return [value]
    return [value[key] for key in SPATIAL_COLUMN_KEYS if value.get(key)]


def decompose_tooltip_contents(value: Any) -> list[Any]:
    """
    The columns a deck.gl tooltip entry reads, mirroring ``extractTooltipColumns()``.

    An entry is either a bare column name or a tooltip-config object wrapping one. Only
    ``item_type: "column"`` entries reach the query's columns; metric entries are read
    from data already fetched and add nothing to select.
    """
    if isinstance(value, dict):
        if value.get("item_type") == "column" and value.get("column_name"):
            return [value["column_name"]]
        return []
    return [value]


def decompose_fixed_or_metric(value: Any) -> list[Any]:
    """
    The metric a fixed-or-metric control holds, if it holds one.

    deck.gl's ``point_radius_fixed`` is either a legacy bare metric name or
    ``{"type": "fix" | "metric", "value": ...}``, where only the ``metric`` variant
    contributes a metric to the query.
    """
    if not isinstance(value, dict):
        return [value]
    if value.get("type") == "metric" and value.get("value") is not None:
        return [value["value"]]
    return []


def embedded_chart_params(value: Any) -> dict[str, Any]:
    """
    The ``params`` of a chart definition nested inside a control's value.

    Cartodiagram stores the chart it renders per feature in ``selected_chart`` as a
    JSON string whose ``params`` is itself a JSON string. Its metrics and columns are
    the ones actually queried, so they have to be reachable.
    """
    definition = _decode_json(value)
    if not isinstance(definition, dict):
        return {}
    params = _decode_json(definition.get("params"))
    return params if isinstance(params, dict) else {}


def _decode_json(value: Any) -> Any:
    """
    Decode a JSON-encoded string, leaving anything else untouched.
    """
    if not isinstance(value, str):
        return value
    try:
        return json.loads(value)
    except ValueError:
        return None


def _decompose(key: str, value: Any) -> list[Any]:
    """
    The individual metrics or columns a control's value holds.

    Most controls hold their values flat, as a name or a list of names. The ones that
    wrap them in a nested structure are decomposed into the names they point at, so that
    they compare against the flat names a request carries.
    """
    if key in SPATIAL_PARAMS:
        return decompose_spatial(value)
    if key == "tooltip_contents":
        return decompose_tooltip_contents(value)
    if key == "point_radius_fixed":
        return decompose_fixed_or_metric(value)
    return [value]


def _normalize(value: Any) -> str:
    """
    Frozen form of a single metric or column, ready to be compared.

    Sort entries are reduced to the expression they sort on, and adhoc references to the
    column they point at, so that the same underlying metric or column compares equal
    however the request and the chart's ``params`` happen to spell it.
    """
    value = unwrap_orderby(_decode_orderby_pair(unwrap_orderby(value)))
    return freeze_value(collapse_column_reference(value))


def requested_values(values: Any) -> set[str]:
    """
    Frozen values from a request, comparable against ``stored_param_values``.
    """
    return {_normalize(value) for value in _as_items(values)}


def stored_param_values(params: dict[str, Any], keys: tuple[str, ...]) -> set[str]:
    """
    Frozen values stored under any of the given chart ``params`` keys.

    A chart nested in ``selected_chart`` is descended into, since its own metrics and
    columns are what get queried. Matching itself stays exact; only the shape of each
    value is normalized.
    """
    values: set[str] = set()
    for key in keys:
        for item in _as_items(params.get(key)):
            values |= {_normalize(part) for part in _decompose(key, item)}

    if nested := embedded_chart_params(params.get(EMBEDDED_CHART_PARAM)):
        values |= stored_param_values(nested, keys)

    return values
