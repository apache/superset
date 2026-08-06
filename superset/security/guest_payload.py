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
    "right_axis_metric",
    "secondary_metric",
    "series_limit_metric",
    "size",
    "timeseries_limit_metric",
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
    "end_time",
    "entity",
    "granularity_sqla",
    "groupby",
    "groupbyColumns",
    "groupbyRows",
    "id",
    "name",
    "order_by_cols",
    "parent",
    "series",
    "series_columns",
    "source",
    "start_time",
    "target",
    "tooltip_columns",
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

    Matching itself stays exact; only the shape of each value is normalized.
    """
    values: set[str] = set()
    for key in keys:
        values |= {_normalize(item) for item in _as_items(params.get(key))}
    return values
