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
"""Enforce the time range limits on chart data queries."""

from __future__ import annotations

import copy
import logging
import re
from collections.abc import Callable, Mapping
from datetime import datetime, timedelta
from typing import Any, cast, Literal, NamedTuple, TYPE_CHECKING

from jinja2 import nodes
from jinja2.exceptions import TemplateSyntaxError
from jinja2.sandbox import SandboxedEnvironment
from marshmallow import ValidationError

from superset.common.chart_data import ChartDataResultType
from superset.common.utils.time_range_utils import (
    get_offset_custom_or_inherit,
    get_since_until_from_query_object,
    get_since_until_from_time_range,
    get_time_offset_range,
    is_valid_date,
    is_valid_date_range,
)
from superset.constants import EXTRA_FORM_DATA_OVERRIDE_REGULAR_MAPPINGS, TimeGrain
from superset.dashboards.layout import _first_container_path
from superset.exceptions import QueryObjectValidationError
from superset.extensions import feature_flag_manager, security_manager
from superset.superset_typing import TimeWindow
from superset.time_range_limits.policy import (
    date_range_failure,
    FEATURE_FLAG,
    get_effective_time_range_limits,
    load_global,
    load_level,
    server_timezone,
    TimeRangeLimits,
    TimeRangeLimitsInvalidError,
    TimeRangeLimitsUnavailableError,
    UnparsableFilterRangeError,
    validate_date_range,
    value_list_window,
)
from superset.time_range_limits.telemetry import known_field, limit_scope
from superset.utils import json
from superset.utils.core import (
    AdhocMetricExpressionType,
    DatasourceType,
    DTTM_ALIAS,
    FilterOperator,
    is_adhoc_column,
)

if TYPE_CHECKING:
    from superset.common.query_context import QueryContext
    from superset.common.query_object import QueryObject
    from superset.connectors.sqla.models import SqlaTable
    from superset.explorables.base import Explorable
    from superset.models.dashboard import Dashboard
    from superset.models.slice import Slice

logger = logging.getLogger(__name__)

DateRange = tuple[datetime | None, datetime | None, str | None]
# Where a range comes from: ``(kind, index)``, see ``RANGE_SOURCE_KINDS``.
Origin = tuple[str, int | None]
# A range with every origin it was read from; none when no origin can be named.
SourcedRange = tuple[datetime | None, datetime | None, str | None, tuple[Origin, ...]]
# A sourced range with the column it bounds, ``None`` when it bounds no known column.
ColumnRange = tuple[
    str | None, datetime | None, datetime | None, str | None, tuple[Origin, ...]
]

# What a range's origin is: the query's ``time_range`` (a filter Superset rewrote
# to it), one of its adhoc filters, its main range on the time column, a time
# comparison, or its ``time_shift``.
RANGE_SOURCE_KINDS = (
    "time_range",
    "adhoc_filter",
    "granularity",
    "time_comparison",
    "time_shift",
)

_UNCHECKED_RESULT_TYPES = frozenset(
    {ChartDataResultType.COLUMNS, ChartDataResultType.TIMEGRAINS}
)
_NO_TIMESERIES_RESULT_TYPES = frozenset(
    {ChartDataResultType.SAMPLES, ChartDataResultType.DRILL_DETAIL}
)
# The Jinja macros that can remove a filter, with the position of ``remove_filter``.
_REMOVING_MACROS = {"get_time_filter": 4, "get_filters": 1, "filter_values": 2}
_EVERY_COLUMN: Literal["every"] = "every"
RemovedColumns = set[str] | Literal["every"]

# Dashboard.id is a 32-bit integer; a larger ID would be a database error.
_MAX_ID = 2**31 - 1

_FIXED_GRAINS: dict[str, timedelta] = {
    TimeGrain.SECOND: timedelta(seconds=1),
    TimeGrain.FIVE_SECONDS: timedelta(seconds=5),
    TimeGrain.THIRTY_SECONDS: timedelta(seconds=30),
    TimeGrain.MINUTE: timedelta(minutes=1),
    TimeGrain.FIVE_MINUTES: timedelta(minutes=5),
    TimeGrain.TEN_MINUTES: timedelta(minutes=10),
    TimeGrain.FIFTEEN_MINUTES: timedelta(minutes=15),
    TimeGrain.THIRTY_MINUTES: timedelta(minutes=30),
    TimeGrain.HALF_HOUR: timedelta(minutes=30),
    TimeGrain.HOUR: timedelta(hours=1),
    TimeGrain.SIX_HOURS: timedelta(hours=6),
    TimeGrain.DAY: timedelta(days=1),
}
_MONTH_GRAINS: dict[str, int] = {
    TimeGrain.MONTH: 1,
    TimeGrain.QUARTER: 3,
    TimeGrain.QUARTER_YEAR: 3,
    TimeGrain.YEAR: 12,
}
# The weekdays (Monday is 0) a week of the grain starts on, and the days from that
# start to the value the SQL compares. Engines start a plain week on either day.
_WEEK_GRAINS: dict[str, tuple[tuple[int, ...], int]] = {
    TimeGrain.WEEK: ((0, 6), 0),
    TimeGrain.WEEK_STARTING_SUNDAY: ((6,), 0),
    TimeGrain.WEEK_STARTING_MONDAY: ((0,), 0),
    TimeGrain.WEEK_ENDING_SATURDAY: ((6,), 6),
    TimeGrain.WEEK_ENDING_SUNDAY: ((0,), 6),
}


def _grain_ceil(value: datetime, grain: str, weekday: int) -> datetime:
    """The first start of a ``grain`` period at or after ``value``."""
    day = value.replace(hour=0, minute=0, second=0, microsecond=0)
    if step := _FIXED_GRAINS.get(grain):
        return day - (day - value) // step * step
    if months := _MONTH_GRAINS.get(grain):
        start = day.replace(day=1, month=(day.month - 1) // months * months + 1)
        if start == value:
            return start
        month = start.month - 1 + months
        return start.replace(year=start.year + month // 12, month=month % 12 + 1)
    start = day - timedelta(days=(day.weekday() - weekday) % 7)
    return start if start == value else start + timedelta(days=7)


def _with_grain(
    grain: Any, since: datetime | None, until: datetime | None
) -> tuple[datetime | None, datetime | None]:
    """
    The range a filter covers when the SQL compares its column truncated to
    ``grain``: every row whose period starts in ``[since, until)``. An unknown grain
    is open on both sides, so ``_combine`` drops it when the same comparison has a
    closed range. For a day or coarser grain ``since`` starts at midnight, as engines
    that truncate to a ``DATE`` compare it. An end past the calendar's edge is open.
    """
    if not grain:
        return since, until
    if not isinstance(grain, str):
        return None, None
    if grain in _WEEK_GRAINS:
        weekdays, label = _WEEK_GRAINS[grain]
    elif grain in _FIXED_GRAINS or grain in _MONTH_GRAINS:
        weekdays, label = (0,), 0
    else:
        return None, None
    shift = timedelta(days=label)
    if since is not None:
        try:
            if _FIXED_GRAINS.get(grain, timedelta(days=1)) >= timedelta(days=1):
                since = since.replace(hour=0, minute=0, second=0, microsecond=0)
            since = min(
                [since, *(_grain_ceil(since - shift, grain, w) for w in weekdays)]
            )
        except (OverflowError, ValueError):
            since = None
    if until is not None:
        try:
            until = max(_grain_ceil(until - shift, grain, w) for w in weekdays)
        except (OverflowError, ValueError):
            until = None
    return since, until


def _bounding_filters(
    datasource: Explorable,
    filters: list[Any],
    is_timeseries: bool,
    dttm_col: str | None,
) -> list[tuple[str, dict[str, Any]]]:
    """
    Return ``(column, filter)`` of the ``TEMPORAL_RANGE`` filters on a temporal
    column that reach the SQL.

    Mirrors the column lookup of ``get_sqla_query`` (name, then verbose name): a
    filter whose column isn't found is skipped there, and one on an adhoc column or
    a metric fails the query, so neither bounds anything. A filter on a column that
    isn't temporal bounds nothing either. A filter a dataset template removes still
    counts.
    """
    dttm_cols = set(getattr(datasource, "dttm_cols", None) or [])
    names = {col.column_name for col in datasource.columns}
    by_verbose_name: dict[str, str] = {}
    for col in datasource.columns:
        if col.verbose_name:
            by_verbose_name.setdefault(col.verbose_name, col.column_name)
    bounding = []
    for flt in filters:
        if not (flt.get("col") and flt.get("op")):
            continue
        if str(flt["op"]).upper() != FilterOperator.TEMPORAL_RANGE:
            continue
        column: Any = flt["col"]
        if column == DTTM_ALIAS and is_timeseries and dttm_col:
            bounding.append((dttm_col, flt))
        elif (
            not is_adhoc_column(column)
            and (name := column if column in names else by_verbose_name.get(column))
            in dttm_cols
            and name is not None
        ):
            bounding.append((name, flt))
    return bounding


def get_query_ranges(
    datasource: Explorable,
    query_object: QueryObject,
    result_type: ChartDataResultType | None,
) -> list[DateRange]:
    """
    Return every time range the SQL for ``query_object`` uses.

    Each entry is ``(since, until, time_offset)``; ``time_offset`` is ``None`` for
    the main range. ``result_type`` is the query's effective result type. Mirrors
    ``get_sqla_query`` and ``processing_time_offsets``. An unbounded query on a
    datasource with temporal columns gives one open entry; on one without, nothing.
    A time comparison Superset can't resolve gives no entry: it raises its own error
    before it runs that SQL. The ranges on one column are combined, see
    ``_combine``. A filter the chart's own Jinja can remove is read as open, see
    ``_chart_removed_columns``.
    """
    return [
        (since, until, offset)
        for since, until, offset, _origins in get_sourced_query_ranges(
            datasource, query_object, result_type
        )
    ]


def _filter_range(
    value: str, query: Mapping[str, Any]
) -> tuple[datetime | None, datetime | None]:
    """The range of a time filter's ``value``, a query error when it can't be parsed."""
    try:
        return get_since_until_from_time_range(
            time_range=value,
            time_shift=query.get("time_shift"),
            extras=query.get("extras"),
        )
    except ValueError as ex:
        raise UnparsableFilterRangeError(str(ex)) from ex


def get_sourced_query_ranges(
    datasource: Explorable,
    query_object: QueryObject,
    result_type: ChartDataResultType | None,
) -> list[SourcedRange]:
    """
    The ranges of ``get_query_ranges``, each with the origins it was read from.

    A filter is named by its index in the query's ``filter``: ``time_range`` when
    Superset rewrote its value to the query's ``time_range``, else ``adhoc_filter``.
    The main range on the time column is ``granularity``, a time comparison range
    ``time_comparison`` with the offset's index. A range the query's
    ``time_shift`` moved also names ``time_shift``. The open range of a query
    nothing bounds names no origin.
    """
    if datasource.type == DatasourceType.SEMANTIC_VIEW:
        return _combine(_semantic_view_ranges(datasource, query_object))
    from_time_range = bool(getattr(query_object, "time_range", None))
    original = query_object
    if removed := _chart_removed_columns(datasource, query_object.to_dict()):
        query_object = _as_the_sql_reads(datasource, query_object, removed)
    query = query_object.to_dict()
    dttm_cols = list(getattr(datasource, "dttm_cols", None) or [])
    is_timeseries = bool(query.get("is_timeseries")) and (
        result_type not in _NO_TIMESERIES_RESULT_TYPES
    )
    shifted: tuple[Origin, ...] = (
        (("time_shift", None),) if query.get("time_shift") else ()
    )

    granularity = _granularity(datasource, query)
    column_names = {col.column_name for col in datasource.columns}
    dttm_col = granularity if granularity in column_names else None

    ranges: list[ColumnRange] = []
    if granularity and result_type != ChartDataResultType.SAMPLES:
        since, until = query.get("from_dttm"), query.get("to_dttm")
        if since is not None or until is not None:
            ranges.append(
                (
                    granularity,
                    since,
                    until,
                    None,
                    (("granularity", None), *shifted),
                )
            )

    query_filters = query.get("filter") or []
    filters = _bounding_filters(datasource, query_filters, is_timeseries, dttm_col)
    positions = {id(flt): index for index, flt in enumerate(query_filters)}
    kind = "time_range" if from_time_range else "adhoc_filter"
    for column, flt in filters:
        origins: tuple[Origin, ...] = ((kind, positions.get(id(flt))), *shifted)
        value = flt.get("val")
        if isinstance(value, str):
            since, until = _filter_range(value, query)
            ranges.append(
                (column, *_with_grain(flt.get("grain"), since, until), None, origins)
            )
        else:
            ranges.append((column, None, None, None, origins))

    ranking_ranges = _inline_series_ranges(datasource, query, is_timeseries, ranges)

    if not ranges and dttm_cols:
        ranges.append((None, None, None, None, ()))

    if query_object.time_offsets:
        ranges.extend(_time_offset_ranges(original, filters))
    if _is_templated(datasource):
        return [
            (since, until, offset, origins)
            for _column, since, until, offset, origins in ranges
        ] + ranking_ranges
    return [*_combine(ranges), *ranking_ranges]


def _inline_series_ranges(
    datasource: Explorable,
    query: Mapping[str, Any],
    is_timeseries: bool,
    ranges: list[ColumnRange],
) -> list[SourcedRange]:
    """Check the ranking subquery independently of the outer time window."""
    if datasource.type != DatasourceType.TABLE:
        return []
    spec = cast("SqlaTable", datasource).db_engine_spec
    if (
        query.get("series_limit")
        and query.get("metrics")
        and any(column != DTTM_ALIAS for column in query.get("columns") or [])
        and (is_timeseries or query.get("series_columns"))
        and spec.allows_joins
        and spec.allows_subqueries
        and spec.time_groupby_inline
    ):
        ranking_filters = [entry for entry in ranges if entry[4][0][0] != "granularity"]
        return _combine(ranking_filters) or [(None, None, None, ())]

    return []


def has_temporal_column(datasource: Explorable) -> bool:
    """Whether a query on ``datasource`` can be bounded in time: a dataset with a
    temporal column, or a semantic view with a temporal dimension."""
    if datasource.type == DatasourceType.SEMANTIC_VIEW:
        return any(col.is_dttm for col in datasource.columns)
    return bool(getattr(datasource, "dttm_cols", None))


def _semantic_view_ranges(
    datasource: Explorable, query_object: QueryObject
) -> list[ColumnRange]:
    """
    The ranges of a query on a semantic view, as the semantic layer mapper turns
    the query into provider filters, for the main query and each time comparison.

    The mapper's time axis is bounded by ``from_dttm`` and ``to_dttm`` only when
    both are set, and those bounds replace the axis filter they came from. Any
    other ``TEMPORAL_RANGE`` filter bounds its own temporal dimension. A query
    nothing bounds gives an open entry on a view with a temporal dimension, and
    nothing on a view without one. A time comparison the mapper can't resolve
    gives no entry: the mapper raises its own error before the provider runs.
    """
    # pylint: disable=import-outside-toplevel
    from superset.semantic_layers.dimension_resolution import (
        DimensionUsage,
        resolve_dimensions,
    )
    from superset.semantic_layers.exceptions import (
        discover_dimensions,
        DiscoveryTarget,
    )
    from superset.semantic_layers.mapper import (
        _get_time_axis_column,
        _get_time_bounds,
        _normalize_column,
        SemanticQueryInputError,
    )
    from superset.semantic_layers.models import SemanticView

    temporal = {col.column_name for col in datasource.columns if col.is_dttm}
    if not temporal:
        return []
    view = cast(SemanticView, datasource)
    dimensions = resolve_dimensions(
        discover_dimensions(lambda: view.implementation, DiscoveryTarget.of(view)),
        usage=DimensionUsage.FILTER,
    )
    validated = cast(Any, query_object)
    axis = _get_time_axis_column(validated, dimensions)
    try:
        selected = {
            _normalize_column(column, set(dimensions))
            for column in query_object.columns or []
        }
    except SemanticQueryInputError:
        selected = set()
    is_time_series = axis is not None and axis in selected

    ranges: list[ColumnRange] = []
    for position, offset in enumerate([None, *(query_object.time_offsets or [])]):
        try:
            since, until = (
                _get_time_bounds(validated, offset)
                if axis is not None and axis in dimensions
                else (None, None)
            )
            ranges.extend(
                _semantic_query_ranges(
                    query_object,
                    temporal,
                    axis if since is not None and until is not None else None,
                    (since, until),
                    offset,
                    () if offset is None else (("time_comparison", position - 1),),
                    is_time_series,
                )
            )
        except ValueError:
            if offset is None:
                ranges.append((None, None, None, None, ()))
    return ranges


def _semantic_query_ranges(  # pylint: disable=too-many-arguments
    query_object: QueryObject,
    temporal: set[str],
    bounded_axis: str | None,
    bounds: tuple[datetime | None, datetime | None],
    offset: str | None,
    comparison: tuple[Origin, ...],
    is_time_series: bool,
) -> list[ColumnRange]:
    """The ranges of one query the mapper sends: the main one or a time
    comparison, see ``_semantic_view_ranges``."""
    from superset.common.utils.time_range_utils import get_time_range_from_filters
    from superset.constants import NO_TIME_RANGE

    filters = query_object.filter or []
    kind = "time_range" if query_object.time_range else "adhoc_filter"
    replaced = (
        get_time_range_from_filters(
            query_object.time_range, filters, query_object.columns
        )
        if bounded_axis is not None
        else None
    )
    axis_origins: list[Origin] = (
        [("granularity", None)] if query_object.granularity else []
    )
    ranges: list[ColumnRange] = []
    for index, flt in enumerate(filters):
        if str(flt.get("op") or "").upper() != FilterOperator.TEMPORAL_RANGE:
            continue
        column, value = flt.get("col"), flt.get("val")
        if (
            bounded_axis is not None
            and column == bounded_axis
            and ((offset is not None and is_time_series) or value == replaced)
        ):
            axis_origins.append((kind, index))
            continue
        if (
            not isinstance(column, str)
            or column not in temporal
            or not isinstance(value, str)
            or value == NO_TIME_RANGE
        ):
            continue
        since, until = _with_grain(
            flt.get("grain"),
            *get_since_until_from_time_range(
                time_range=value,
                time_shift=offset if not is_time_series else None,
            ),
        )
        if since is not None or until is not None:
            ranges.append((column, since, until, offset, ((kind, index), *comparison)))
    if bounded_axis is not None:
        ranges.insert(0, (bounded_axis, *bounds, offset, (*axis_origins, *comparison)))
    if not ranges:
        ranges.append((None, None, None, offset, comparison))
    return ranges


def _is_templated(datasource: Explorable) -> bool:
    """
    Whether the dataset has Jinja in its SQL, in a column expression or in a saved
    metric expression. A template such as ``get_time_filter(remove_filter=True)``
    can drop the outer clauses, so their overlap isn't what the SQL reads.
    """
    sources = [getattr(datasource, "sql", None)]
    for attr in ("columns", "metrics"):
        sources += [
            getattr(item, "expression", None)
            for item in getattr(datasource, attr, None) or []
        ]
    return any(_has_jinja(sql) for sql in sources)


def _has_jinja(text: Any) -> bool:
    return isinstance(text, str) and ("{{" in text or "{%" in text)


def _granularity(datasource: Explorable, query: Mapping[str, Any]) -> str | None:
    """The time column of ``query`` as ``get_sqla_query`` resolves it."""
    from superset.connectors.sqla.models import SqlaTable

    granularity = query.get("granularity")
    if granularity is not None and granularity not in (
        getattr(datasource, "dttm_cols", None) or []
    ):
        # Query.main_dttm_col raises, so only a dataset falls back to it.
        granularity = (
            datasource.main_dttm_col if isinstance(datasource, SqlaTable) else None
        )
    return granularity


def _chart_removed_columns(
    datasource: Explorable, query: Mapping[str, Any]
) -> RemovedColumns:
    """
    The columns whose filters the chart's own Jinja can remove from the SQL, or
    ``"every"`` when it can remove any temporal column's.

    Reads, with Jinja's parser and no render, the texts Superset renders before its
    filter loop: SQL adhoc metrics, adhoc and expression columns, order-by metrics
    and adhoc filter columns. ``extras.where`` and ``having`` render after the
    filter loop, and the dataset's own templates are its editors', so neither is
    read. A text that doesn't parse fails before any SQL.
    """
    if not feature_flag_manager.is_feature_enabled("ENABLE_TEMPLATE_PROCESSING"):
        return set()
    if any(_has_jinja(text) for text in _order_by_texts(query)):
        # Superset writes the rendered text back and renders it again for the time
        # offsets, the series limit prequery and the cache key, so the text those
        # renders read isn't the one sent.
        return _EVERY_COLUMN

    env = SandboxedEnvironment()
    removed: set[str] = set()
    for text in _chart_texts(datasource, query):
        try:
            tree = env.parse(text)
        except (TemplateSyntaxError, RecursionError):
            continue
        try:
            found = _removed_by(tree)
        except RecursionError:
            return _EVERY_COLUMN
        if not isinstance(found, set):
            return found
        removed |= found
    return removed


def _order_by_texts(query: Mapping[str, Any]) -> list[Any]:
    return [
        item[0].get("sqlExpression")
        for item in query.get("orderby") or []
        if isinstance(item, (list, tuple)) and item and isinstance(item[0], dict)
    ]


def _chart_texts(datasource: Explorable, query: Mapping[str, Any]) -> list[str]:
    """The chart's texts with Jinja other than the order-by, each also quoted when
    Superset quotes it before rendering."""
    names = {col.column_name for col in datasource.columns}
    raw_columns = not query.get("metrics") and not query.get("groupby")
    found: list[tuple[Any, bool]] = [
        (metric.get("sqlExpression"), False)
        for metric in query.get("metrics") or []
        if isinstance(metric, dict)
        and metric.get("expressionType") == AdhocMetricExpressionType.SQL
    ]
    columns = [
        (column, raw_columns and key == "columns")
        for key in ("columns", "groupby")
        for column in query.get(key) or []
    ] + [
        (flt["col"], False)
        for flt in query.get("filter") or []
        if is_adhoc_column(flt.get("col"))
    ]
    for column, raw in columns:
        if is_adhoc_column(column):
            text = column["sqlExpression"]
            found.append(
                (text, bool(column.get("isColumnReference")) and text not in names)
            )
        elif isinstance(column, str) and (raw or column not in names):
            found.append((column, raw))

    database = getattr(datasource, "database", None)
    texts: list[str] = []
    for text, quoted in found:
        if _has_jinja(text):
            texts.append(text)
            if quoted and database is not None:
                # Quoting doubles each '"', which changes what Jinja reads.
                texts.append(database.quote_identifier(text))
    return texts


def _removed_by(tree: nodes.Template) -> RemovedColumns:
    """
    The columns the removing macro calls in ``tree`` can remove, or ``"every"``.

    Every call counts, also in a branch or macro that may never run. A macro
    reached other than by a direct call, and any use of ``metric``, can remove any
    filter: ``metric`` holds the Jinja environment and context, and renders a
    saved metric with this query's context, of a dataset the request can choose.
    """
    removed: set[str] = set()
    callees: set[int] = set()
    for call in tree.find_all(nodes.Call):
        if not isinstance(call.node, nodes.Name):
            continue
        name = call.node.name
        starred = call.dyn_args is not None or call.dyn_kwargs is not None
        if name in _REMOVING_MACROS:
            callees.add(id(call.node))
            found = _removed_by_call(call, _REMOVING_MACROS[name], starred)
            if not isinstance(found, set):
                return found
            removed |= found
    for node in tree.find_all(nodes.Name):
        if node.name == "metric" or (
            node.name in _REMOVING_MACROS and id(node) not in callees
        ):
            return _EVERY_COLUMN
    return removed


def _removed_by_call(
    call: nodes.Call, flag_index: int, starred: bool
) -> RemovedColumns:
    flag = _argument(call, flag_index, "remove_filter")
    if not starred and (
        flag is None or (isinstance(flag, nodes.Const) and not flag.value)
    ):
        return set()
    column = _argument(call, 0, "column")
    if column is None or (isinstance(column, nodes.Const) and column.value is None):
        # Nothing is removed without a column, but one can come in *args or **kwargs.
        return _EVERY_COLUMN if starred else set()
    if isinstance(column, nodes.Const) and isinstance(column.value, str):
        return {column.value}
    return _EVERY_COLUMN


def _argument(call: nodes.Call, index: int, name: str) -> nodes.Expr | None:
    for keyword in call.kwargs:
        if keyword.key == name:
            return keyword.value
    return call.args[index] if len(call.args) > index else None


class _QueryAsRead:
    """The parts of a query object that ``get_query_ranges`` reads, as the SQL
    reads them once the chart's Jinja removed some filters."""

    def __init__(
        self,
        query_object: QueryObject,
        query: dict[str, Any],
        granularity_removed: bool,
    ) -> None:
        self._query = query
        self.filter = query["filter"]
        self.extras = query.get("extras")
        self.time_offsets = query_object.time_offsets
        self.time_shift = query_object.time_shift
        self.time_range = (
            None if granularity_removed else getattr(query_object, "time_range", None)
        )

    def to_dict(self) -> dict[str, Any]:
        return self._query


def _as_the_sql_reads(
    datasource: Explorable, query_object: QueryObject, removed: RemovedColumns
) -> QueryObject:
    """
    A copy of ``query_object`` with the filters Superset skips for the ``removed``
    columns read as open, and no main range when its time column is removed.

    Mirrors the skip in ``get_sqla_query``: a filter is skipped by its raw column
    name, and the time column and ``__timestamp`` by the resolved time column.
    ``query_object`` and its filters are never changed.
    """
    query: dict[str, Any] = dict(query_object.to_dict())
    granularity = _granularity(datasource, query)
    if not isinstance(removed, set):
        temporal = [
            col
            for col in datasource.columns
            if col.column_name in (getattr(datasource, "dttm_cols", None) or [])
        ]
        removed = {
            DTTM_ALIAS,
            *([granularity] if granularity else []),
            *(col.column_name for col in temporal),
            *(name for col in temporal if (name := getattr(col, "verbose_name", None))),
        }
    granularity_removed = granularity in removed or DTTM_ALIAS in removed
    if granularity_removed:
        query["from_dttm"] = query["to_dttm"] = None
    query["filter"] = [
        {**flt, "val": None}
        if isinstance(col := flt.get("col"), str)
        and (col in removed or (col == DTTM_ALIAS and granularity_removed))
        else flt
        for flt in query.get("filter") or []
    ]
    return cast("QueryObject", _QueryAsRead(query_object, query, granularity_removed))


def _combine(ranges: list[ColumnRange]) -> list[SourcedRange]:
    """
    The overlap of the ranges on each column, per time comparison, in the order
    each column first appears.

    A side is open only when every range on the column is open on that side. A
    column open on both sides is dropped when another column of the same time
    comparison has a closed range: it adds no clause to the SQL. A column whose
    ranges don't overlap gives its ranges each alone. A range with no column stays
    on its own. A combined range names the origins of every range in it.
    """
    groups: dict[Any, list[SourcedRange]] = {}
    for index, (column, since, until, offset, origins) in enumerate(ranges):
        key = index if column is None else (column, offset)
        groups.setdefault(key, []).append((since, until, offset, origins))

    combined: dict[Any, SourcedRange] = {}
    for key, group in groups.items():
        sinces = [since for since, _until, _offset, _o in group if since is not None]
        untils = [until for _since, until, _offset, _o in group if until is not None]
        combined[key] = (
            max(sinces) if sinces else None,
            min(untils) if untils else None,
            group[0][2],
            tuple(
                dict.fromkeys(origin for *_r, origins in group for origin in origins)
            ),
        )
    closed = {
        key[1]
        for key, (since, until, _offset, _origins) in combined.items()
        if isinstance(key, tuple) and since is not None and until is not None
    }

    result: list[SourcedRange] = []
    for key, (since, until, offset, origins) in combined.items():
        if since is not None and until is not None and since > until:
            result.extend(groups[key])
        elif not (
            isinstance(key, tuple)
            and since is None
            and until is None
            and offset in closed
        ):
            result.append((since, until, offset, origins))
    return result


def _time_offset_ranges(
    query_object: QueryObject, filters: list[tuple[str, dict[str, Any]]]
) -> list[ColumnRange]:
    outer_since, outer_until = get_since_until_from_query_object(query_object)
    if not outer_since or not outer_until:
        return []

    ranges: list[ColumnRange] = []
    for position, name in enumerate(query_object.time_offsets):
        origins: tuple[Origin, ...] = (("time_comparison", position),)
        offset = name
        try:
            is_date_range = is_valid_date_range(offset)
            if not is_date_range and (is_valid_date(offset) or offset == "inherit"):
                offset = get_offset_custom_or_inherit(offset, outer_since, outer_until)
            since, until = get_time_offset_range(offset, outer_since, outer_until)
        except (ValueError, QueryObjectValidationError):
            continue
        ranges.append((None, since, until, name, origins))
        # The helper range and its rewrites bound no column of their own.
        rewritten: list[tuple[str | None, Any, datetime | None, datetime | None]] = (
            [(None, None, since, until)] if query_object.time_shift else []
        )
        for column, flt in [] if is_date_range else filters:
            if grain := flt.get("grain"):
                rewritten.append((None, grain, since, until))
            if isinstance(value := flt.get("val"), str):
                rewritten.append(
                    (
                        column,
                        grain,
                        *get_since_until_from_time_range(
                            time_range=value, time_shift=offset
                        ),
                    )
                )
        ranges.extend(
            (
                column,
                *_with_grain(grain, *_as_filter(query_object, *pair)),
                name,
                origins,
            )
            for column, grain, *pair in rewritten
        )
    return ranges


def _as_filter(
    query_object: QueryObject, since: datetime | None, until: datetime | None
) -> tuple[datetime | None, datetime | None]:
    """
    The range the SQL uses for a filter Superset rewrote to ``"since : until"``.

    The SQL parses that text again with the query's ``time_shift``, so a query with
    both a time shift and a time comparison is shifted twice.
    """
    if since is None or until is None:
        return since, until
    return get_since_until_from_time_range(
        time_range=f"{since} : {until}",
        time_shift=query_object.time_shift,
        extras=query_object.extras,
    )


_UNREADABLE = object()


def _dashboard_id(form_data: dict[str, Any]) -> Any:
    """
    The ``dashboardId`` of ``form_data`` as an ``int``, ``None`` when there is none,
    or ``_UNREADABLE`` when it isn't a plain decimal integer in range.

    Strict on purpose: the access check compares the raw value in SQL, where some
    databases match ``"5.0"`` or ``"5_0"`` to dashboard 5 and Python's ``int()``
    reads them differently or not at all.
    """
    value = form_data.get("dashboardId")
    if value is None or value == "":
        return None
    if isinstance(value, int) and not isinstance(value, bool):
        dashboard_id = value
    elif isinstance(value, str) and value.isascii() and value.isdigit():
        try:
            dashboard_id = int(value)
        except ValueError:
            return _UNREADABLE
    else:
        return _UNREADABLE
    return dashboard_id if 0 < dashboard_id <= _MAX_ID else _UNREADABLE


def _reached_through_dashboard(datasource: Explorable) -> bool:
    """Whether ``raise_for_access`` only let this user in through a dashboard."""
    return datasource.type != DatasourceType.QUERY and (
        security_manager.is_guest_user() or not _has_dataset_access(datasource)
    )


def _load_dashboard(
    datasource: Explorable, form_data: dict[str, Any]
) -> Dashboard | None:
    """
    The dashboard ``form_data`` names. Raises ``TimeRangeLimitsUnavailableError``
    when its ID can't be read and the user reached the datasource through it.
    """
    from superset.daos.dashboard import DashboardDAO

    dashboard_id = _dashboard_id(form_data)
    if dashboard_id is _UNREADABLE:
        if _reached_through_dashboard(datasource):
            raise TimeRangeLimitsUnavailableError(
                source="dashboard", field="dashboardId"
            )
        return None
    if dashboard_id is None:
        return None
    return DashboardDAO.find_by_id(dashboard_id, skip_base_filter=True)


def _native_filter(
    datasource: Explorable, dashboard: Dashboard, filter_id: Any
) -> tuple[str, dict[str, Any]] | None:
    """
    The filter column and config of ``filter_id``, if it targets this dataset or
    semantic view. A target with no ``datasourceType`` is a dataset one.
    """
    from superset.security.manager import _datasource_matches

    if datasource.type not in (DatasourceType.TABLE, DatasourceType.SEMANTIC_VIEW):
        return None
    try:
        metadata = json.loads(dashboard.json_metadata or "{}")
    except (TypeError, ValueError, RecursionError):
        return None
    if not isinstance(metadata, dict):
        return None
    for native_filter in metadata.get("native_filter_configuration") or []:
        if not isinstance(native_filter, dict) or native_filter.get("id") != filter_id:
            continue
        for target in native_filter.get("targets") or []:
            if (
                isinstance(target, dict)
                and _datasource_matches(
                    datasource,
                    target.get("datasetId"),
                    target.get("datasourceType") or DatasourceType.TABLE,
                )
                and isinstance(target.get("column"), dict)
                and (column := target["column"].get("name"))
            ):
                return column, native_filter
    return None


def _is_min_max_of(metric: Any, column: str) -> bool:
    return (
        isinstance(metric, dict)
        and metric.get("expressionType") == "SIMPLE"
        and str(metric.get("aggregate") or "").upper() in {"MIN", "MAX"}
        and isinstance(metric.get("column"), dict)
        and metric["column"].get("column_name") == column
    )


def native_filter_dashboard(
    datasource: Explorable,
    query_object: QueryObject,
    form_data: dict[str, Any],
    dashboard: Dashboard | None = None,
) -> tuple[Dashboard, str] | None:
    """
    Return the dashboard and filter column of a native filter option query.

    Only when the named dashboard has that filter on this datasource, and the query
    reads nothing but the filter's column, in the shape the Select and Range filters
    send. Such a query may have no time range.
    ``dashboard`` is the dashboard already loaded from ``form_data``, if any.
    """
    if form_data.get("type") != "NATIVE_FILTER" or not (
        filter_id := form_data.get("native_filter_id")
    ):
        return None
    if (
        dashboard is None
        and (dashboard := _load_dashboard(datasource, form_data)) is None
    ):
        return None
    if (found := _native_filter(datasource, dashboard, filter_id)) is None:
        return None
    column, native_filter = found

    if any(col != column for col in query_object.columns or []):
        return None
    sort_metric = native_filter.get("sortMetric") or (
        native_filter.get("controlValues") or {}
    ).get("sortMetric")
    if not all(
        _is_min_max_of(metric, column) or (sort_metric and metric == sort_metric)
        for metric in query_object.metrics or []
    ):
        return None
    if (
        query_object.is_timeseries
        or query_object.time_offsets
        or query_object.series_columns
        or query_object.series_limit
        or query_object.series_limit_metric
        or query_object.post_processing
        or query_object.annotation_layers
        or (query_object.extras or {}).get("having")
        or (
            query_object.granularity
            and query_object.granularity != native_filter.get("granularity_sqla")
        )
        or not all(
            isinstance(item, (list, tuple))
            and item
            and item[0] is not None
            and item[0] in (column, sort_metric)
            for item in query_object.orderby or []
        )
    ):
        return None
    return dashboard, column


def _has_dataset_access(datasource: Explorable) -> bool:
    """
    Whether the user can open ``datasource`` without a dashboard, by the rules of
    the datasource branch of ``raise_for_access``.
    """
    return bool(
        security_manager.can_access_schema(datasource)
        or security_manager.can_access("datasource_access", datasource.perm or "")
        or security_manager._semantic_layer_grant_allows(  # pylint: disable=protected-access
            datasource
        )
        or security_manager.is_editor(datasource)
    )


def _read_id(value: Any) -> int | None:
    """``value`` as a positive integer ID, read as ``_dashboard_id`` reads one."""
    found = _dashboard_id({"dashboardId": value})
    return found if isinstance(found, int) else None


def scope_dataset_id(datasource: Explorable) -> int | None:
    """The dataset ID a rejection on ``datasource`` is logged with: none for a
    datasource that isn't a dataset."""
    if datasource.type != DatasourceType.TABLE:
        return None
    return _read_id(datasource.id)


def load_dashboard_by_id(value: Any) -> Dashboard | None:
    """The dashboard a server-side caller names, or ``None`` when ``value`` isn't
    a readable ID."""
    from superset.daos.dashboard import DashboardDAO

    if (dashboard_id := _read_id(value)) is None:
        return None
    return DashboardDAO.find_by_id(dashboard_id, skip_base_filter=True)


class Target:
    """
    The dashboard a check looks at, where its ID came from, and the slice ID to
    match on it. ``can_open`` asks ``can_access_dashboard`` at most once.
    """

    def __init__(
        self,
        datasource: Explorable,
        form_data: dict[str, Any],
        limit_dashboard_id: Any,
        limit_slice_id: Any,
    ) -> None:
        self.parent_slice_id = form_data.get("parent_slice_id")
        self.from_form_data = limit_dashboard_id is None
        if self.from_form_data:
            self.dashboard = _load_dashboard(datasource, form_data)
            self.slice_id = (
                limit_slice_id
                if limit_slice_id is not None
                else form_data.get("slice_id")
            )
        else:
            self.dashboard = load_dashboard_by_id(limit_dashboard_id)
            self.slice_id = limit_slice_id
        self._can_open: bool | None = None
        self.resolved: tuple[Dashboard | None, list[bool]] | None = None
        self.verified = False

    def can_open(self) -> bool:
        if self._can_open is None:
            self._can_open = bool(
                self.dashboard is not None
                and security_manager.can_access_dashboard(self.dashboard)
            )
        return self._can_open

    def through_dashboard(self, datasource: Explorable) -> bool:
        """Whether the user reached the datasource through the ``form_data``
        dashboard, which ``raise_for_access`` already checked, or the dashboard
        was resolved for the request this query serves."""
        return self.verified or (
            self.from_form_data and _reached_through_dashboard(datasource)
        )


def _target(
    datasource: Explorable,
    form_data: dict[str, Any],
    holder: QueryContext,
) -> Target:
    """The ``Target`` of ``holder``, loaded once per query context while the IDs
    it is read from stay the same."""
    key = _target_key(holder, form_data)
    if holder.limit_target is not None and holder.limit_target[0] == key:
        return holder.limit_target[1]
    target = Target(
        datasource,
        form_data,
        holder.limit_dashboard_id,
        holder.limit_slice_id,
    )
    holder.limit_target = (key, target)
    return target


def _target_key(holder: QueryContext, form_data: dict[str, Any]) -> tuple[Any, ...]:
    return (
        holder.limit_dashboard_id,
        holder.limit_slice_id,
        form_data.get("dashboardId"),
        form_data.get("slice_id"),
        form_data.get("parent_slice_id"),
    )


def apply_request_dashboard(
    query_context: QueryContext, dashboard: Dashboard | None
) -> None:
    """
    Make the check of ``query_context``, a query run for another request such as
    an annotation layer's, apply ``dashboard``: the dashboard whose limits apply
    to that request, already resolved for it.
    """
    if dashboard is None:
        return
    form_data = query_context.form_data or {}
    target = Target(query_context.datasource, {}, None, None)
    target.dashboard = dashboard
    target.verified = True
    query_context.limit_target = (_target_key(query_context, form_data), target)


def chart_dashboard(datasource: Explorable, target: Target) -> Dashboard | None:
    """
    The dashboard whose limits apply to a query that isn't a native filter one.

    Its own when the user reached the datasource through it. Otherwise only when
    the named chart is on it and uses this datasource (or, with no chart named,
    one of its charts does), and the user can open it.
    """
    dashboard = target.dashboard
    if dashboard is None:
        return None
    if target.through_dashboard(datasource):
        return dashboard
    member = (
        _has_parent_chart(dashboard, datasource, target)
        if target.parent_slice_id is not None
        else _has_member_chart(dashboard, datasource, _read_id(target.slice_id))
    )
    return dashboard if member and target.can_open() else None


def _has_parent_chart(
    dashboard: Dashboard, datasource: Explorable, target: Target
) -> bool:
    """Match the configured layer and its datasource through a dashboard parent."""
    from superset import db
    from superset.models.slice import Slice
    from superset.security.manager import _datasource_matches

    parent_id = _read_id(target.parent_slice_id)
    child_id = _read_id(target.slice_id)
    parent = next((slc for slc in dashboard.slices if slc.id == parent_id), None)
    if parent is None or child_id is None:
        return False
    if not security_manager._validate_child_in_parent_multilayer(  # pylint: disable=protected-access
        child_slice_id=child_id, parent_slice=parent
    ):
        return False
    child = db.session.get(Slice, child_id)
    return child is not None and _datasource_matches(
        datasource, child.datasource_id, child.datasource_type
    )


def _has_member_chart(
    dashboard: Dashboard, datasource: Explorable, slice_id: int | None
) -> bool:
    """
    Whether chart ``slice_id`` (any chart, when ``None``) of ``dashboard`` uses
    ``datasource``. Asks the database with one ``EXISTS`` unless the dashboard's
    charts are already loaded.
    """
    from sqlalchemy import inspect

    from superset import db
    from superset.models.dashboard import dashboard_slices
    from superset.models.slice import Slice

    if "slices" not in inspect(dashboard).unloaded:
        return any(
            slc.datasource_id == datasource.id
            and slc.datasource_type == datasource.type
            and (slice_id is None or slc.id == slice_id)
            for slc in dashboard.slices
        )
    if not isinstance(datasource.id, int):
        return False
    members = (
        db.session.query(Slice.id)
        .join(dashboard_slices, dashboard_slices.c.slice_id == Slice.id)
        .filter(
            dashboard_slices.c.dashboard_id == dashboard.id,
            Slice.datasource_id == datasource.id,
            Slice.datasource_type == datasource.type,
        )
    )
    if slice_id is not None:
        members = members.filter(Slice.id == slice_id)
    return bool(db.session.query(members.exists()).scalar())


def _contribution_totals_index(queries: list[QueryObject]) -> int | None:
    """
    The query ``ensure_totals_available`` runs as is, whatever its result type.

    Found with the rule of ``QueryContextProcessor._prepare_contribution_totals``,
    which can't be called here because it changes the query's row limit.
    """
    if not any(
        post_processing.get("operation") == "contribution"
        for query in queries
        for post_processing in getattr(query, "post_processing", []) or []
    ):
        return None
    return next(
        (
            index
            for index, query in enumerate(queries)
            if not query.columns and query.metrics and not query.post_processing
        ),
        None,
    )


def _query_checks(
    query_context: QueryContext,
) -> list[tuple[QueryObject, ChartDataResultType, list[DateRange], bool]]:
    """
    ``(query, result type, ranges, is the totals query)`` of each query whose SQL
    runs. The contribution totals query runs as ``full`` whatever its result type.
    """
    totals_index = _contribution_totals_index(query_context.queries)
    checks = []
    for index, query_object in enumerate(query_context.queries):
        result_type = query_object.result_type or query_context.result_type
        if index == totals_index:
            result_type = ChartDataResultType.FULL
        elif result_type in _UNCHECKED_RESULT_TYPES:
            continue
        ranges = get_query_ranges(query_context.datasource, query_object, result_type)
        checks.append((query_object, result_type, ranges, index == totals_index))
    return checks


def sourced_query_checks(
    query_context: QueryContext,
) -> list[tuple[int, QueryObject, ChartDataResultType, list[SourcedRange], bool]]:
    """
    ``_query_checks`` with each query's index and each range's origins, read
    with ``get_sourced_query_ranges``.
    """
    totals_index = _contribution_totals_index(query_context.queries)
    checks = []
    for index, query_object in enumerate(query_context.queries):
        result_type = query_object.result_type or query_context.result_type
        if index == totals_index:
            result_type = ChartDataResultType.FULL
        elif result_type in _UNCHECKED_RESULT_TYPES:
            continue
        ranges = get_sourced_query_ranges(
            query_context.datasource, query_object, result_type
        )
        checks.append((index, query_object, result_type, ranges, index == totals_index))
    return checks


def check_query_context_date_ranges(query_context: QueryContext) -> None:
    """
    Check every query of ``query_context`` against the time range limits.

    Runs after the access check, before any cache read or SQL. Does nothing while
    the feature flag is off. A native Select filter option query with no time
    range is first bounded by the window the limits allow, see
    ``_bound_value_lists``, so this changes the query. Raises
    ``TimeRangeLimitError`` on the first range that breaks the limits, and
    ``TimeRangeLimitsUnavailableError`` when the limits can't be loaded.
    """
    if not feature_flag_manager.is_feature_enabled(FEATURE_FLAG):
        return

    with limit_scope(
        dataset_id=scope_dataset_id(query_context.datasource),
        chart_id=_chart_id(query_context.limit_slice_id, query_context.form_data or {}),
    ):
        _check_query_context(query_context)


def _check_query_context(query_context: QueryContext) -> None:
    datasource = query_context.datasource
    if not (checks := _query_checks(query_context)):
        return

    now = datetime.now()
    form_data = query_context.form_data or {}
    filter_preview = form_data.get("type") == "NATIVE_FILTER" and not form_data.get(
        "native_filter_id"
    )

    loaded = _target(datasource, form_data, query_context).dashboard
    if (
        loaded is not None
        and _sets_no_dashboard_limits(loaded)
        and _passes_without_dashboard(
            datasource,
            now,
            [ranges for _query_object, _result_type, ranges, _is_totals in checks],
        )
    ):
        return

    dashboard, native = query_context_dashboard(
        query_context,
        [
            (query_object, result_type, is_totals)
            for query_object, result_type, _r, is_totals in checks
        ],
    )

    checks, native = _bound_value_lists(query_context, dashboard, now, checks, native)
    _check_ranges(
        datasource,
        dashboard,
        now,
        [
            (ranges, is_native)
            for (_query_object, _result_type, ranges, _is_totals), is_native in zip(
                checks, native, strict=True
            )
        ],
        filter_preview=filter_preview,
    )


def _value_list_column(datasource: SqlaTable, query_object: QueryObject) -> str | None:
    """The column a value list's window bounds: the query's time column, else
    the dataset's default datetime column, when it is temporal."""
    dttm_cols = datasource.dttm_cols or []
    if query_object.granularity in dttm_cols:
        return query_object.granularity
    return datasource.main_dttm_col if datasource.main_dttm_col in dttm_cols else None


def _is_select_filter(
    datasource: Explorable, dashboard: Dashboard, form_data: dict[str, Any]
) -> bool:
    """Whether the request's native filter is a Select filter. A Range filter's
    min and max aren't bounded: a user can't enter a value past the slider."""
    found = _native_filter(datasource, dashboard, form_data.get("native_filter_id"))
    return found is not None and found[1].get("filterType") == "filter_select"


def _bound_value_lists(
    query_context: QueryContext,
    dashboard: Dashboard | None,
    now: datetime,
    checks: list[tuple[QueryObject, ChartDataResultType, list[DateRange], bool]],
    native: list[bool],
) -> tuple[
    list[tuple[QueryObject, ChartDataResultType, list[DateRange], bool]], list[bool]
]:
    """
    Bound each native Select filter option query on a dataset that has no time
    range by ``value_list_window`` of the limits that apply on ``dashboard``, and
    read its ranges again for the check. The window replaces the query's
    ``time_range`` too, as absolute dates, so the cache key names the window.

    A query that carries a range keeps it, and the check applies to it as to a
    chart's. When the window is empty the query loses its open-range exemption,
    so the check refuses it. Limits that can't be loaded are left to the check,
    which refuses them. A query bounded here is a dated query for a later check
    of the same context, so check a context once. The context is marked
    ``limit_value_list_window``: the window depends on when it is built, so the
    chart data API runs the request synchronously, see ``_should_run_async``.
    """
    from superset.connectors.sqla.models import SqlaTable

    datasource = query_context.datasource
    if (
        not isinstance(datasource, SqlaTable)
        or dashboard is None
        or not any(native)
        or not _is_select_filter(datasource, dashboard, query_context.form_data or {})
    ):
        return checks, native
    try:
        limits = get_effective_time_range_limits(datasource, now, dashboard)
    except TimeRangeLimitsInvalidError:
        return checks, native
    if limits is None or (window := value_list_window(limits, now)) is None:
        return checks, native
    since, until = window
    bounded, allowed = [], []
    for check, is_native in zip(checks, native, strict=True):
        query_object, result_type, ranges, is_totals = check
        if (
            is_native
            and ranges
            and all(entry == (None, None, None) for entry in ranges)
            and (column := _value_list_column(datasource, query_object)) is not None
        ):
            if since == until:
                is_native = False
            else:
                query_object.granularity = column
                query_object.from_dttm, query_object.to_dttm = since, until
                query_object.time_range = f"{since.isoformat()} : {until.isoformat()}"
                query_context.limit_value_list_window = True
                ranges = get_query_ranges(datasource, query_object, result_type)
                check = (query_object, result_type, ranges, is_totals)
        bounded.append(check)
        allowed.append(is_native)
    return bounded, allowed


def column_values_window(datasource: Explorable) -> TimeWindow | None:
    """
    The column and window that bound a dataset's column values list, which has
    no time range and no dashboard: ``value_list_window`` of the global and
    dataset limits, on the dataset's default datetime column.

    ``None`` while the feature flag is off, for a datasource that isn't a
    dataset, without a temporal default datetime column, or when no rule gives
    a start. Raises ``TimeRangeLimitError`` when the window is empty, as an open
    query is refused, and ``TimeRangeLimitsUnavailableError`` when the limits
    can't be loaded.
    """
    from superset.connectors.sqla.models import SqlaTable

    if not feature_flag_manager.is_feature_enabled(FEATURE_FLAG) or not isinstance(
        datasource, SqlaTable
    ):
        return None
    if (column := datasource.main_dttm_col) not in (datasource.dttm_cols or []):
        return None
    now = datetime.now()
    with limit_scope(dataset_id=scope_dataset_id(datasource)):
        try:
            limits = get_effective_time_range_limits(datasource, now)
        except TimeRangeLimitsInvalidError as ex:
            logger.exception(
                "Time range limits can't be loaded for column values of %s %s",
                datasource.type,
                datasource.id,
            )
            raise unavailable_error(datasource, None) from ex
        if limits is None or (window := value_list_window(limits, now)) is None:
            return None
        since, until = window
        if since == until:
            validate_date_range(None, None, limits, timezone=server_timezone(now))
    return column, since, until


def _sets_no_dashboard_limits(dashboard: Dashboard) -> bool:
    """
    Whether ``dashboard`` sets no limits, read as ``load_level`` reads them. A
    policy that can't be read is left to the full check, which refuses it.
    """
    try:
        return load_level(dashboard.json_metadata, "Dashboard json_metadata") is None
    except TimeRangeLimitsInvalidError:
        return False


def _passes_without_dashboard(
    datasource: Explorable,
    now: datetime,
    checks: list[list[DateRange]],
) -> bool:
    """
    Whether each of the ``checks`` ranges passes the limits of ``datasource``
    with no dashboard level. When the dashboard sets no limits, a pass here
    is the check's answer whichever dashboard applies, so the caller can skip
    working out which one does. Anything else is left to the full check.
    """
    try:
        limits = get_effective_time_range_limits(datasource, now)
        if limits is None:
            return True
        return all(
            date_range_failure(since, until, limits, time_offset=offset) is None
            for ranges in checks
            for since, until, offset in ranges
        )
    except (TimeRangeLimitsInvalidError, ValueError):
        return False


def query_context_dashboard(
    query_context: QueryContext,
    checks: list[tuple[QueryObject, ChartDataResultType, bool]],
) -> tuple[Dashboard | None, list[bool]]:
    """
    The dashboard whose limits apply to the checked queries of ``query_context``,
    each ``(query, result type, is the totals query)``, and whether each is a
    native filter query, which may run open. Raises
    ``TimeRangeLimitsUnavailableError`` as ``_load_dashboard``.
    """
    datasource = query_context.datasource
    form_data = query_context.form_data or {}
    target = _target(datasource, form_data, query_context)
    if target.resolved is not None:
        return target.resolved
    loaded = target.dashboard
    native = [
        not is_totals
        and result_type == ChartDataResultType.FULL
        and loaded is not None
        and native_filter_dashboard(datasource, query_object, form_data, loaded)
        is not None
        and (target.through_dashboard(datasource) or target.can_open())
        for query_object, result_type, is_totals in checks
    ]
    dashboard = loaded if any(native) else chart_dashboard(datasource, target)
    target.resolved = (dashboard, native)
    return target.resolved


def limit_task_key(query_context: QueryContext) -> str | None:
    """
    The part of an async query task's key that names the dashboard whose limits
    the task's re-check applies, so two requests for the same query share a task
    only when the same limits apply to both. ``None`` while the feature flag is
    off. Raises as ``check_query_context_date_ranges`` loads the dashboard.
    """
    if not feature_flag_manager.is_feature_enabled(FEATURE_FLAG):
        return None
    dashboard = request_dashboard(query_context)
    return f"time_range_limits:{dashboard.id if dashboard is not None else ''}"


def request_dashboard(query_context: QueryContext) -> Dashboard | None:
    """
    The dashboard whose limits the check of ``query_context`` applies, or
    ``None`` while the feature flag is off. Raises as
    ``check_query_context_date_ranges`` loads the dashboard.
    """
    if not feature_flag_manager.is_feature_enabled(FEATURE_FLAG):
        return None
    if not (checks := _query_checks(query_context)):
        return None
    dashboard, _native = query_context_dashboard(
        query_context,
        [
            (query_object, result_type, is_totals)
            for query_object, result_type, _r, is_totals in checks
        ],
    )
    return dashboard


def _chart_id(limit_slice_id: Any, form_data: dict[str, Any]) -> int | None:
    return _read_id(
        limit_slice_id if limit_slice_id is not None else form_data.get("slice_id")
    )


def unavailable_error(
    datasource: Explorable, dashboard: Dashboard | None
) -> TimeRangeLimitsUnavailableError:
    """
    The 503 for limits ``get_effective_time_range_limits`` can't load, naming the
    first level that fails, in its order. The stored value stays out of it.
    """
    from superset.connectors.sqla.models import SqlaTable

    levels: list[tuple[str, int | None, Callable[[], TimeRangeLimits | None]]] = [
        ("global", None, load_global)
    ]
    if isinstance(datasource, SqlaTable):
        levels.append(
            (
                "dataset",
                datasource.id,
                lambda: load_level(datasource.extra, "Dataset extra"),
            )
        )
    if dashboard is not None:
        levels.append(
            (
                "dashboard",
                None,
                lambda: load_level(dashboard.json_metadata, "Dashboard json_metadata"),
            )
        )
    for source, dataset_id, load in levels:
        try:
            load()
        except TimeRangeLimitsInvalidError as ex:
            return TimeRangeLimitsUnavailableError(
                source=source, field=known_field(ex.field), dataset_id=dataset_id
            )
    return TimeRangeLimitsUnavailableError()


def _check_ranges(
    datasource: Explorable,
    dashboard: Dashboard | None,
    now: datetime,
    checks: list[tuple[list[DateRange], bool]],
    *,
    filter_preview: bool = False,
) -> None:
    """
    Check each ``(ranges, allow_open)`` against the limits that apply to
    ``datasource`` on ``dashboard``. An open range passes when ``allow_open``.
    ``filter_preview`` is as in ``date_range_failure``.
    """
    with limit_scope(dashboard_id=dashboard.id if dashboard is not None else None):
        _check_limits(datasource, dashboard, now, checks, filter_preview=filter_preview)


def _check_limits(
    datasource: Explorable,
    dashboard: Dashboard | None,
    now: datetime,
    checks: list[tuple[list[DateRange], bool]],
    *,
    filter_preview: bool = False,
) -> None:
    try:
        limits = get_effective_time_range_limits(datasource, now, dashboard)
    except TimeRangeLimitsInvalidError as ex:
        logger.exception(
            "Time range limits can't be loaded for %s %s, dashboard %s",
            datasource.type,
            datasource.id,
            dashboard.id if dashboard is not None else None,
        )
        raise unavailable_error(datasource, dashboard) from ex
    if limits is None:
        return

    dashboard_id = dashboard.id if dashboard is not None else None
    timezone = server_timezone(now)
    for ranges, allow_open in checks:
        for since, until, offset in ranges:
            if allow_open and since is None and until is None:
                continue
            validate_date_range(
                since,
                until,
                limits,
                time_offset=offset,
                dashboard_id=dashboard_id,
                filter_preview=filter_preview,
                timezone=timezone,
            )


class _DictQuery:
    """The parts of a ``QueryObject`` that ``get_query_ranges`` reads, for a
    plain query dict."""

    def __init__(self, query: dict[str, Any]) -> None:
        self._query = query
        self.time_offsets: list[str] = []
        self.time_shift = None
        self.time_range = None
        self.granularity = None
        self.columns: list[Any] = []
        self.filter: list[dict[str, Any]] = []
        self.from_dttm = None
        self.to_dttm = None

    def to_dict(self) -> dict[str, Any]:
        return self._query


def check_datasource_open_query(
    datasource: Explorable, dashboard: Dashboard | None = None
) -> None:
    """
    Check a query on ``datasource`` with no time filter on ``dashboard``, such as
    the data of a dashboard example export, against the time range limits.

    Does nothing while the feature flag is off. Raises ``TimeRangeLimitError``
    when the datasource has a temporal column and a limit applies, and
    ``TimeRangeLimitsUnavailableError`` when the limits can't be loaded.
    """
    if not feature_flag_manager.is_feature_enabled(FEATURE_FLAG):
        return
    with limit_scope(dataset_id=scope_dataset_id(datasource)):
        ranges = get_query_ranges(datasource, cast("QueryObject", _DictQuery({})), None)
        _check_ranges(datasource, dashboard, datetime.now(), [(ranges, False)])


_TIME_FILTER_TYPES = {
    "filter_time": "time_range",
    "filter_timecolumn": "granularity_sqla",
    "filter_timegrain": "time_grain_sqla",
}
_NO_TIME_RANGE = "No filter"
_NATIVE_FILTER_PREFIX = "NATIVE_FILTER-"
# A deck.gl layer the filter's scope selects, as ``getChartIdsInFilterScope`` reads it.
_LAYER_KEY = re.compile(r"chart-([0-9]+)-layer-[0-9]+")


def _layout_walk(
    position: dict[str, Any],
) -> tuple[dict[str, list[str]], dict[int, list[str]]] | None:
    """
    The layout parents of every item and of each chart, walked from ``ROOT_ID`` as
    the dashboard's ``updateComponentParentsList`` does. A chart id that appears
    twice keeps the parents of the first one the walk pops. ``None`` when the walk
    meets an item twice.
    """
    parents: dict[str, list[str]] = {"ROOT_ID": []}
    charts: dict[int, list[str]] = {}
    stack = ["ROOT_ID"] if isinstance(position.get("ROOT_ID"), dict) else []
    while stack:
        item_id = stack.pop()
        item = position[item_id]
        if item.get("type") == "CHART" and isinstance(item.get("meta"), dict):
            chart_id = item["meta"].get("chartId")
            if isinstance(chart_id, int) and chart_id not in charts:
                charts[chart_id] = parents[item_id]
        for child_id in _children(position, item_id):
            if not isinstance(child_id, str) or not isinstance(
                position.get(child_id), dict
            ):
                continue
            if child_id in parents:
                return None
            parents[child_id] = [*parents[item_id], item_id]
            stack.append(child_id)
    return parents, charts


def _in_scope(native_filter: dict[str, Any], parents: list[str], slice_id: int) -> bool:
    """The scope rule of the dashboard's ``getChartIdsInFilterScope``."""
    scope = native_filter.get("scope")
    if not isinstance(scope, dict):
        return False
    excluded, root_path = scope.get("excluded"), scope.get("rootPath")
    if not isinstance(excluded, list) or not isinstance(root_path, list):
        return False
    layers = scope.get("selectedLayers")
    if isinstance(layers, list) and any(
        isinstance(layer, str)
        and (match := _LAYER_KEY.fullmatch(layer)) is not None
        and int(match[1]) == slice_id
        for layer in layers
    ):
        return True
    return slice_id not in excluded and any(item in root_path for item in parents)


def time_filter_value(filter_type: str, data_mask: Any) -> Any:
    """The value a time filter's ``data_mask`` sends, state first."""
    if not isinstance(data_mask, dict):
        return None
    state = data_mask.get("filterState")
    value = state.get("value") if isinstance(state, dict) else None
    if filter_type != "filter_time":
        value = value[0] if isinstance(value, list) and value else None
    if not value or not isinstance(value, str):
        extra = data_mask.get("extraFormData")
        value = (
            extra.get(_TIME_FILTER_TYPES[filter_type])
            if isinstance(extra, dict)
            else None
        )
    if not value or not isinstance(value, str) or value == _NO_TIME_RANGE:
        return None
    return value


def _time_filters_in_scope(dashboard: Dashboard, slice_id: int) -> list[dict[str, Any]]:
    """
    The Time Range, Time Column and Time Grain native filters of ``dashboard`` in
    scope of chart ``slice_id``, in their order. ``[]`` when the chart isn't on the
    dashboard or its JSON can't be read.
    """
    if slice_id not in {slc.id for slc in dashboard.slices}:
        return []
    try:
        metadata = json.loads(dashboard.json_metadata or "{}")
        position = json.loads(dashboard.position_json or "{}")
    except (TypeError, ValueError, RecursionError):
        return []
    if not isinstance(metadata, dict) or not isinstance(position, dict):
        return []
    if (walk := _layout_walk(position)) is None:
        return []
    parents = walk[1].get(slice_id, ["ROOT_ID", "GRID_ID"])
    filters = metadata.get("native_filter_configuration")
    return [
        native_filter
        for native_filter in (filters if isinstance(filters, list) else [])
        if isinstance(native_filter, dict)
        and native_filter.get("filterType") in _TIME_FILTER_TYPES
        and _in_scope(native_filter, parents, slice_id)
    ]


def time_filter_ids_in_scope(dashboard: Dashboard, slice_id: int) -> set[str]:
    """The ids of the time native filters of ``dashboard`` in scope of chart
    ``slice_id``."""
    return {
        filter_id
        for native_filter in _time_filters_in_scope(dashboard, slice_id)
        if isinstance(filter_id := native_filter.get("id"), str)
    }


def _open_time_range(
    dashboard: Dashboard, slice_id: int, data_mask: dict[str, Any] | None
) -> bool | None:
    """
    Whether chart ``slice_id`` gets "No filter" as its ``time_range`` from the
    Time Range filters in its scope, as the page sends them, last one wins:
    ``True`` when that value comes from ``data_mask``, ``False`` when it comes
    from the filter's default, ``None`` when the last value sent is another one
    or none is sent.
    """
    open_range: bool | None = None
    for native_filter in _time_filters_in_scope(dashboard, slice_id):
        if native_filter["filterType"] != "filter_time":
            continue
        filter_id = native_filter.get("id")
        mask, on_report = native_filter.get("defaultDataMask"), False
        if (
            data_mask is not None
            and isinstance(filter_id, str)
            and filter_id in data_mask
        ):
            mask, on_report = data_mask[filter_id], True
        extra = mask.get("extraFormData") if isinstance(mask, dict) else None
        value = extra.get("time_range") if isinstance(extra, dict) else None
        if value and isinstance(value, str):
            open_range = on_report if value == _NO_TIME_RANGE else None
    return open_range


def dashboard_time_extras(
    dashboard: Dashboard,
    slice_id: int,
    data_mask: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """
    The ``extra_form_data`` time parts the dashboard's native filters send for
    chart ``slice_id``: ``time_range``, ``granularity_sqla`` and
    ``time_grain_sqla`` from the Time Range, Time Column and Time Grain filters in
    scope of the chart, last one wins.

    A filter's value comes from ``data_mask[filter_id]`` when given, else from its
    default. ``{}`` when the chart isn't on the dashboard or its JSON can't be
    read. Runs no SQL.
    """
    extras: dict[str, Any] = {}
    for native_filter in _time_filters_in_scope(dashboard, slice_id):
        filter_type = native_filter["filterType"]
        filter_id = native_filter.get("id")
        mask = (
            data_mask[filter_id]
            if data_mask is not None
            and isinstance(filter_id, str)
            and filter_id in data_mask
            else native_filter.get("defaultDataMask")
        )
        if (value := time_filter_value(filter_type, mask)) is not None:
            extras[_TIME_FILTER_TYPES[filter_type]] = value
    return extras


class TimeRangeFilter(NamedTuple):
    """A Time Range native filter and the default value it sends."""

    id: Any
    name: Any
    value: str


def dashboard_time_filter(dashboard: Dashboard, chart: Slice) -> TimeRangeFilter | None:
    """
    The time range filter whose default gives ``chart`` its ``time_range`` in
    ``dashboard_time_extras``: the last one in scope that has a value. A filter
    with no default, or "No filter", gives none.
    """
    found: TimeRangeFilter | None = None
    for native_filter in _time_filters_in_scope(dashboard, chart.id):
        if native_filter["filterType"] != "filter_time":
            continue
        value = time_filter_value("filter_time", native_filter.get("defaultDataMask"))
        if value is not None:
            found = TimeRangeFilter(
                native_filter.get("id"), native_filter.get("name"), value
            )
    return found


def report_time_data_mask(native_filters: Any) -> dict[str, Any]:
    """
    The data mask of the Time Range, Time Column and Time Grain values stored in
    a report's ``extra.dashboard.nativeFilters``, by filter id, as
    ``dashboard_time_extras`` reads it. A stored Time Range that isn't a
    non-empty string reads as "No filter"; a Time Column or Time Grain that isn't
    a string, and an entry with no value, are skipped, as the report's URL skips
    them. A later entry for the same id wins.
    """
    mask: dict[str, Any] = {}
    for native_filter in native_filters if isinstance(native_filters, list) else []:
        if not isinstance(native_filter, dict):
            continue
        filter_id = native_filter.get("nativeFilterId")
        filter_type = native_filter.get("filterType")
        values = native_filter.get("filterValues")
        if (
            not isinstance(filter_id, str)
            or not isinstance(filter_type, str)
            or filter_type not in _TIME_FILTER_TYPES
            or not isinstance(values, list)
            or not values
        ):
            continue
        value = values[0]
        if filter_type == "filter_time":
            if not value or not isinstance(value, str):
                value = _NO_TIME_RANGE
        elif not isinstance(value, str):
            continue
        mask[filter_id] = {
            "extraFormData": {_TIME_FILTER_TYPES[filter_type]: value},
            "filterState": {
                "value": value if filter_type == "filter_time" else [value]
            },
        }
    return mask


def data_mask_is_readable(dashboard: Dashboard, data_mask: dict[str, Any]) -> bool:
    """
    Whether every entry of a stored ``data_mask`` is shaped as
    ``dashboard_time_extras`` reads it: a time filter's entry has its
    ``filterState`` and an ``extraFormData`` with its own time key only (the page
    fills a missing part from the filter's default), and any other entry sends
    only ``filters`` that aren't time ranges. Entries for native filter IDs
    (``NATIVE_FILTER-…``) the dashboard doesn't have are skipped, as the page
    drops them; every other entry is checked.
    """
    metadata = json.loads(dashboard.json_metadata or "{}")
    filters = metadata.get("native_filter_configuration")
    native_filters = [
        native_filter
        for native_filter in (filters if isinstance(filters, list) else [])
        if isinstance(native_filter, dict)
    ]
    filter_ids = {native_filter.get("id") for native_filter in native_filters}
    time_keys = {
        native_filter.get("id"): _TIME_FILTER_TYPES[native_filter["filterType"]]
        for native_filter in native_filters
        if native_filter.get("filterType") in _TIME_FILTER_TYPES
    }
    for filter_id, mask in data_mask.items():
        if (
            filter_id not in filter_ids
            and isinstance(filter_id, str)
            and filter_id.startswith(_NATIVE_FILTER_PREFIX)
        ):
            continue
        if not isinstance(mask, dict):
            return False
        extra = mask.get("extraFormData", {})
        if filter_id in time_keys:
            allowed = {time_keys[filter_id]}
            if "extraFormData" not in mask or not isinstance(
                mask.get("filterState"), dict
            ):
                return False
        else:
            allowed = {"filters"}
        if not isinstance(extra, dict) or set(extra) - allowed:
            return False
        extra_filters = extra.get("filters", [])
        if not isinstance(extra_filters, list) or any(
            not isinstance(flt, dict)
            or str(flt.get("op") or "").upper() == FilterOperator.TEMPORAL_RANGE
            for flt in extra_filters
        ):
            return False
    return True


def chart_query_context(
    chart: Slice, time_extras: dict[str, Any]
) -> QueryContext | None:
    """
    The saved query context of ``chart``, with the dashboard's ``time_extras``, as
    the dashboard and warm-up build it, or ``None`` when it has none. Runs no SQL.
    """
    if time_extras:
        query_context = chart.get_query_context(_query_overrides(time_extras))
        if query_context is not None:
            _set_time_grain(query_context, time_extras)
        return query_context
    return chart.get_query_context()


def _chart_dataset(chart: Slice) -> Explorable:
    if (datasource := chart.resolved_datasource) is None:
        raise ValueError(f"The dataset of chart {chart.id} does not exist")
    return cast("Explorable", datasource)


def _query_overrides(time_extras: dict[str, Any]) -> dict[str, Any]:
    return {
        EXTRA_FORM_DATA_OVERRIDE_REGULAR_MAPPINGS[key]: value
        for key, value in time_extras.items()
        if key in ("time_range", "granularity_sqla")
    }


def _set_time_grain(query_context: QueryContext, time_extras: dict[str, Any]) -> None:
    """
    Set the grain of the dashboard's Time Grain filter on the queries of
    ``query_context`` as the browser's ``buildQuery`` sets it: in ``extras`` and
    on the x-axis column.
    """
    if not (grain := time_extras.get("time_grain_sqla")):
        return
    for query in query_context.queries:
        query.extras["time_grain_sqla"] = grain
        for column in query.columns:
            if is_adhoc_column(column) and column.get("columnType") == "BASE_AXIS":
                column["timeGrain"] = grain


def _form_data_query_context(
    chart: Slice, form_data: dict[str, Any], time_extras: dict[str, Any]
) -> QueryContext:
    """
    A query context with only the time parts the browser's ``buildQueryObject``
    sends, for a chart saved with no query context.
    """
    from superset.common.query_context_factory import QueryContextFactory
    from superset.utils.core import (
        convert_legacy_filters_into_adhoc,
        split_adhoc_filters_into_base_filters,
    )

    datasource = _chart_dataset(chart)
    if datasource.type != DatasourceType.TABLE:
        raise ValueError(f"Chart {chart.id} has no saved query context")
    data = copy.deepcopy(form_data)
    convert_legacy_filters_into_adhoc(data)
    data["adhoc_filters"] = [
        adhoc_filter
        for adhoc_filter in data.get("adhoc_filters") or []
        if isinstance(adhoc_filter, dict)
        and adhoc_filter.get("expressionType") == "SIMPLE"
        and adhoc_filter.get("clause") == "WHERE"
        and str(adhoc_filter.get("operator") or "").upper()
        == FilterOperator.TEMPORAL_RANGE
    ]
    split_adhoc_filters_into_base_filters(
        data, cast("SqlaTable", datasource).database.backend
    )
    time_compare = data.get("time_compare") or []
    if not isinstance(time_compare, list):
        time_compare = [time_compare]
    query = {
        "columns": [],
        "metrics": [],
        "granularity": data.get("granularity_sqla") or data.get("granularity"),
        "time_range": data.get("time_range"),
        "filters": data["filters"],
        "time_offsets": [offset for offset in time_compare if isinstance(offset, str)],
        "annotation_layers": _line_or_table_layers(data),
        **_query_overrides(time_extras),
    }
    query_context = QueryContextFactory().create(
        datasource={"id": datasource.id, "type": datasource.type},
        # A multi-layer chart issues no query of its own; its layers are charts.
        queries=[] if chart.viz_type == "deck_multi" else [query],
        form_data=form_data,
        current_slice=chart,
    )
    return query_context


def _line_or_table_layers(form_data: dict[str, Any]) -> list[dict[str, Any]]:
    """The well-formed ``line`` and ``table`` annotation layers of ``form_data``."""
    return [
        layer
        for layer in form_data.get("annotation_layers") or []
        if isinstance(layer, dict)
        and "annotationType" in layer
        and layer.get("sourceType") in ("line", "table")
    ]


def _chart_source(
    chart: Slice,
    dashboard: Dashboard | None,
    data_mask: dict[str, Any] | None = None,
) -> QueryContext:
    """
    The query context of the saved ``chart``, on ``dashboard`` with its native
    filter defaults and ``data_mask`` when given, as the rendered chart sends it.
    Runs no SQL. Raises when the chart's query can't be built.
    """
    _chart_dataset(chart)
    time_extras = (
        dashboard_time_extras(dashboard, chart.id, data_mask or None)
        if dashboard is not None
        else {}
    )
    form_data = chart.form_data
    source = chart_query_context(chart, time_extras)
    if source is None:
        if chart.query_context:
            raise ValueError(f"The query context of chart {chart.id} can't be read")
        source = _form_data_query_context(chart, form_data, time_extras)
    return source


def check_chart_date_ranges(
    chart: Slice,
    *,
    dashboard: Dashboard | None = None,
    data_mask: dict[str, Any] | None = None,
) -> None:
    """
    Check the saved ``chart`` against the time range limits, on ``dashboard``
    with its native filter defaults and ``data_mask`` when given, as the chart
    data request of the rendered chart would be checked. Runs no SQL, and no
    access check except on annotation layers.

    The chart's annotation layers are checked after its own queries, as their
    load would check them. A layer the user can't access is skipped.

    On ``dashboard``, a "No filter" ``time_range`` that its Time Range filters
    send to the chart is an open range, and fails while a limit applies.

    Raises ``TimeRangeLimitError`` or ``TimeRangeLimitsUnavailableError`` as the
    checks do, and any other error when the chart's query can't be built.
    """
    if (
        dashboard is not None
        and (on_report := _open_time_range(dashboard, chart.id, data_mask or None))
        is not None
    ):
        datasource = _chart_dataset(chart)
        if has_temporal_column(datasource):
            with limit_scope(
                dataset_id=scope_dataset_id(datasource), chart_id=chart.id
            ):
                # ``filter_preview`` only picks the message: the open-range one for
                # the report's own value, the dashboard editor's for a default.
                _check_ranges(
                    datasource,
                    dashboard,
                    datetime.now(),
                    [([(None, None, None)], False)],
                    filter_preview=on_report,
                )
    query_context = _chart_source(chart, dashboard, data_mask)
    query_context.limit_slice_id = chart.id
    if dashboard is not None:
        query_context.limit_dashboard_id = dashboard.id
    check_query_context_date_ranges(query_context)
    try:
        query_context.check_annotation_layers()
    except QueryObjectValidationError:
        logger.debug("Annotation layers of chart %s not checked", chart.id)


def chart_date_ranges(
    chart: Slice, *, dashboard: Dashboard | None = None
) -> list[DateRange]:
    """
    Every time range the saved ``chart``'s queries use, on ``dashboard`` with its
    native filter defaults when given, in the order the query check judges them.
    Loads no dashboard, judges nothing and builds no error. Runs no SQL. Raises
    when the chart's query can't be built.
    """
    return [
        (since, until, offset)
        for _index, (since, until, offset, _origins) in chart_source_ranges(
            _chart_source(chart, dashboard)
        )
    ]


def chart_source_ranges(
    query_context: QueryContext,
    *,
    checks: list[tuple[int, QueryObject, ChartDataResultType, list[SourcedRange], bool]]
    | None = None,
    native: list[bool] | None = None,
) -> list[tuple[int, SourcedRange]]:
    """
    ``(query index, range)`` of every time range the queries of ``query_context``
    use, in the order the query check judges them. Runs no SQL and builds no
    error.

    A range open at both ends is left out for a query that may run open: a
    query ``native`` marks as a native filter query.
    ``checks`` are the query context's ``sourced_query_checks``, when already
    read.
    """
    if checks is None:
        checks = sourced_query_checks(query_context)
    return [
        (index, sourced)
        for (index, _query, _result_type, ranges, _is_totals), is_native in zip(
            checks, native or [False] * len(checks), strict=True
        )
        for sourced in ranges
        if not (is_native and sourced[0] is None and sourced[1] is None)
    ]


class RequestRanges(NamedTuple):
    """
    What the query check of one chart data request reads: ``(query index,
    range)`` of every range, the dashboard whose limits apply, and whether the
    check fails with a 503 because the request's dashboard ID can't be read.
    """

    ranges: list[tuple[int, SourcedRange]]
    dashboard: Dashboard | None
    dashboard_unreadable: bool


def _dashboard_unreadable(datasource: Explorable, form_data: dict[str, Any]) -> bool:
    """Whether ``_load_dashboard`` would raise for ``form_data``."""
    return _dashboard_id(form_data) is _UNREADABLE and _reached_through_dashboard(
        datasource
    )


def request_date_ranges(query_context: QueryContext) -> RequestRanges:
    """
    The ranges and the dashboard ``check_query_context_date_ranges`` reads for the
    query context of a chart data request, after its access check. Judges
    nothing, builds no error and loads no limits. Runs no SQL. Raises as reading
    the ranges does.
    """
    if not (checks := sourced_query_checks(query_context)):
        return RequestRanges([], None, False)
    if _dashboard_unreadable(query_context.datasource, query_context.form_data or {}):
        return RequestRanges([], None, True)
    dashboard, native = query_context_dashboard(
        query_context,
        [
            (query_object, result_type, is_totals)
            for _index, query_object, result_type, _ranges, is_totals in checks
        ],
    )
    return RequestRanges(
        chart_source_ranges(query_context, checks=checks, native=native),
        dashboard,
        False,
    )


def _resolves_to(value: str, since: datetime | None, until: datetime | None) -> bool:
    try:
        return get_since_until_from_time_range(time_range=value) == (since, until)
    except (ValueError, ValidationError):
        return False


def chart_range_label(
    chart: Slice,
    failing: tuple[datetime | None, datetime | None] | None = None,
) -> str | None:
    """
    The saved time range of ``chart`` to show, read from its ``params``: the
    ``TEMPORAL_RANGE`` filter value, or else the ``time_range``, that resolves
    to the ``failing`` range, else the first ``TEMPORAL_RANGE`` filter value,
    else ``time_range``. ``None`` when there is none or it is "No filter".
    """
    try:
        params = json.loads(chart.params or "{}")
    except (TypeError, ValueError, RecursionError):
        return None
    if not isinstance(params, dict):
        return None
    adhoc_filters = params.get("adhoc_filters")
    values = [
        comparator
        for adhoc_filter in (adhoc_filters if isinstance(adhoc_filters, list) else [])
        if isinstance(adhoc_filter, dict)
        and str(adhoc_filter.get("operator") or "").upper()
        == FilterOperator.TEMPORAL_RANGE
        and isinstance(comparator := adhoc_filter.get("comparator"), str)
    ]
    time_range = params.get("time_range")
    label = values[0] if values else time_range
    if failing is not None:
        candidates = [*values]
        if isinstance(time_range, str) and time_range != _NO_TIME_RANGE:
            candidates.append(time_range)
        label = next(
            (value for value in candidates if _resolves_to(value, *failing)), label
        )
    return (
        label if isinstance(label, str) and label != _NO_TIME_RANGE and label else None
    )


def _children(position: dict[str, Any], item_id: str) -> list[Any]:
    children = position[item_id].get("children")
    return children if isinstance(children, list) else []


def _shown(
    position: dict[str, Any],
    parents: list[str],
    anchor_path: list[str],
    active_tabs: list[str] | None = None,
) -> bool:
    """
    Whether a chart with ``parents`` is on the active tab of every tab group above
    it: the tab on ``anchor_path``, else the group's first tab, as the dashboard's
    ``Tabs`` picks it with ``findTabIndexByComponentId``. When that is the first
    tab, the group's first tab after its first one listed in ``active_tabs`` wins,
    as ``Tabs`` does, except for the root-level group.
    """
    # A report page doesn't mount the root-level Tabs: its tab comes from the anchor.
    root_tabs = (
        _children(position, "ROOT_ID")[:1]
        if isinstance(position.get("ROOT_ID"), dict)
        else []
    )
    for index, item_id in enumerate(parents):
        item = position.get(item_id)
        if not isinstance(item, dict) or item.get("type") != "TABS":
            continue
        tabs = _children(position, item_id)
        active = tabs[0] if tabs else None
        if item_id in anchor_path:
            following = anchor_path.index(item_id) + 1
            if following < len(anchor_path) and anchor_path[following] in tabs:
                active = anchor_path[following]
        if active_tabs and tabs and active == tabs[0] and item_id not in root_tabs:
            active = next((tab for tab in tabs[1:] if tab in active_tabs), active)
        if index + 1 < len(parents) and parents[index + 1] != active:
            return False
    return True


def report_state_charts(
    dashboard: Dashboard, dashboard_state: Any, tabs_enabled: bool
) -> list[Slice]:
    """
    The charts of ``dashboard`` a report with the stored ``dashboard_state``
    renders, by its anchor and active tabs as the report's page reads them
    while ``ALERT_REPORT_TABS`` is ``tabs_enabled``. Its URL parameters and data
    mask aren't read.
    """
    anchors: list[str] | None = None
    active_tabs: list[str] | None = None
    if tabs_enabled and isinstance(dashboard_state, dict):
        tabs = dashboard_state.get("activeTabs")
        if isinstance(tabs, list) and all(isinstance(tab, str) for tab in tabs):
            active_tabs = tabs
        anchor = dashboard_state.get("anchor")
        try:
            anchor_list = json.loads(anchor) if anchor else None
        except (TypeError, ValueError):
            anchor_list = None
        tab = dashboard_state.get("anchor", dashboard_state.get("hash"))
        if isinstance(anchor_list, list):
            anchors = [item if isinstance(item, str) else "" for item in anchor_list]
            active_tabs = None
        elif isinstance(tab, str) and tab:
            anchors = [tab]
    return report_dashboard_charts(dashboard, anchors, active_tabs)


def report_dashboard_charts(
    dashboard: Dashboard,
    anchors: list[str] | None,
    active_tabs: list[str] | None = None,
) -> list[Slice]:
    """
    The charts of ``dashboard`` a report renders: those on the active tab of each
    tab group, for each of the report's ``anchors`` (a page per anchor), or with no
    anchor when there is none, and with the page's ``active_tabs``. An anchor that
    isn't in the layout counts as no anchor. A chart missing from the layout sits
    where the dashboard places it. Every chart when the layout can't be read.
    """
    charts = list(dashboard.slices)
    try:
        position = json.loads(dashboard.position_json or "{}")
    except (TypeError, ValueError, RecursionError):
        return charts
    if not isinstance(position, dict):
        return charts
    if (walk := _layout_walk(position)) is None:
        return charts
    items, chart_parents = walk

    missing = _first_container_path(position) or ["ROOT_ID", "GRID_ID"]
    anchor_paths = (
        [[*items[anchor], anchor] if anchor in items else [] for anchor in anchors]
        if anchors
        else [[]]
    )
    return [
        chart
        for chart in charts
        if any(
            _shown(position, chart_parents.get(chart.id, missing), path, active_tabs)
            for path in anchor_paths
        )
    ]
