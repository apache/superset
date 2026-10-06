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

"""Headline value of Big Number charts.

A Big Number chart renders one number. For the trendline variant (``big_number``)
that number is derived client-side from the time series; for ``big_number_total``
it is the single metric value. Neither is any of the first sample rows, so this
module reproduces the frontend computation:

- ``aggregationChoices`` in ``superset-ui-chart-controls`` (``customControls.tsx``)
- ``BigNumberWithTrendline/transformProps.ts`` and ``BigNumberTotal/transformProps.ts``

A headline is only returned when it is exact. Otherwise ``value`` is null with a
``reason``: a wrong number is worse than none.
"""

from __future__ import annotations

import math
import statistics
from collections.abc import Callable, Mapping, Sequence
from datetime import date, datetime, timezone
from decimal import Decimal
from typing import Any, cast

from superset.mcp_service.chart.schemas import BigNumberHeadline
from superset.superset_typing import Metric
from superset.utils.core import DTTM_ALIAS, get_metric_name

BIG_NUMBER_TRENDLINE_VIZ_TYPE = "big_number"
BIG_NUMBER_TOTAL_VIZ_TYPE = "big_number_total"

DEFAULT_AGGREGATION = "LAST_VALUE"
RAW_AGGREGATION = "raw"

# Metric-value transforms for the trend series. Keys and order mirror the
# frontend's `aggregationChoices`. `LAST_VALUE` and `raw` receive values ordered
# newest first and take the first, so they need no entry beyond that.
_AGGREGATIONS: dict[str, Callable[[list[float]], float | None]] = {
    "raw": lambda values: values[0] if values else None,
    "LAST_VALUE": lambda values: values[0] if values else None,
    "sum": lambda values: sum(values) if values else None,
    "mean": lambda values: sum(values) / len(values) if values else None,
    "min": lambda values: min(values) if values else None,
    "max": lambda values: max(values) if values else None,
    "median": lambda values: statistics.median(values) if values else None,
}

# Rolling types that make the query add a `rolling` (sum, mean, std) or `cum`
# (cumsum) post-processing step, as in the frontend's `rollingWindowOperator`.
_ROLLING_OPERATIONS = {
    "cumsum": "cum",
    "sum": "rolling",
    "mean": "rolling",
    "std": "rolling",
}


def is_big_number_viz_type(viz_type: str | None) -> bool:
    """Whether the visualization displays a Big Number headline."""
    return viz_type in (BIG_NUMBER_TRENDLINE_VIZ_TYPE, BIG_NUMBER_TOTAL_VIZ_TYPE)


def executed_query_facts(query_context: Any) -> tuple[int | None, list[str]]:
    """Row limit and post-processing operations of the first executed query.

    Read from the query that actually ran, so it reflects any row-limit override
    and shows whether the chart's advanced analytics were part of the query.
    """
    queries = getattr(query_context, "queries", None) or []
    if not queries:
        return None, []
    first = queries[0]
    row_limit = getattr(first, "row_limit", None)
    operations = [
        str(step.get("operation"))
        for step in getattr(first, "post_processing", None) or []
        if isinstance(step, Mapping) and step.get("operation")
    ]
    return (row_limit if isinstance(row_limit, int) else None), operations


def _unavailable(aggregation: str | None, reason: str) -> BigNumberHeadline:
    """Return an unavailable headline with its explanation."""
    return BigNumberHeadline(value=None, aggregation=aggregation, reason=reason)


def _parse_date_ms(value: str) -> int | None:
    """Epoch milliseconds for an ISO-8601 string, else None (frontend:
    strict `dayjs.utc` parse in `parseMetricValue`)."""
    try:
        parsed = datetime.fromisoformat(value)
    except ValueError:
        return None
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return int(parsed.timestamp() * 1000)


def _parse_metric_value(value: Any) -> int | float | None:
    """Mirror of the frontend's `parseMetricValue`, plus JSON-safety: numbers
    pass through, date strings become epoch ms, anything else (including NaN and
    infinities, which serialize as null) is null."""
    if isinstance(value, bool) or value is None:
        return None
    if isinstance(value, Decimal):
        value = float(value)
    if isinstance(value, (int, float)):
        try:
            return value if math.isfinite(value) else None
        except OverflowError:
            return None
    if isinstance(value, datetime):
        if value.tzinfo is None:
            value = value.replace(tzinfo=timezone.utc)
        return int(value.timestamp() * 1000)
    if isinstance(value, str):
        return _parse_date_ms(value)
    return None


def _timestamp_ms(value: Any) -> float | None:
    """Sortable time value for an x-axis cell (the API serializes these as epoch
    ms; direct query results may carry datetimes)."""
    if isinstance(value, date) and not isinstance(value, datetime):
        value = datetime(value.year, value.month, value.day, tzinfo=timezone.utc)
    return _parse_metric_value(value)


def _metric_label(form_data: Mapping[str, Any]) -> str | None:
    """Resolve the metric label using the frontend column-name aliases."""
    metric = form_data.get("metric")
    if not metric:
        return None
    if (
        isinstance(metric, Mapping)
        and not metric.get("label")
        and metric.get("expressionType") == "SIMPLE"
    ):
        column = metric.get("column")
        if isinstance(column, Mapping) and column.get("columnName"):
            return f"{metric.get('aggregate')}({column['columnName']})"
    try:
        return get_metric_name(cast(Metric, metric)) or None
    except (ValueError, TypeError, AttributeError):
        return None


def _x_axis_labels(form_data: Mapping[str, Any]) -> list[str]:
    """Candidate time-column labels: the configured x-axis, then `__timestamp`.

    Without an x-axis, the legacy ``granularity_sqla`` column is a candidate
    too: the MCP query (``resolve_big_number_columns``) selects it by name,
    while a frontend-built query aliases it as `__timestamp`.
    """
    labels: list[str] = []
    x_axis = form_data.get("x_axis")
    if isinstance(x_axis, str) and x_axis:
        labels.append(x_axis)
    elif isinstance(x_axis, Mapping):
        label = x_axis.get("label") or x_axis.get("column_name")
        if isinstance(label, str) and label:
            labels.append(label)
    if not labels:
        granularity = form_data.get("granularity_sqla")
        if isinstance(granularity, str) and granularity:
            labels.append(granularity)
    labels.append(DTTM_ALIAS)
    return labels


def _total_headline(
    form_data: Mapping[str, Any], rows: Sequence[Mapping[str, Any]]
) -> BigNumberHeadline:
    """`big_number_total`: the single metric value of the first row."""
    label = _metric_label(form_data)
    if not rows:
        return _unavailable("total", "The query returned no rows.")
    if label is None or label not in rows[0]:
        return _unavailable("total", "The metric column was not in the result.")
    raw = rows[0][label]
    parsed = _parse_metric_value(raw)
    if parsed is None and isinstance(raw, str) and raw.strip():
        return BigNumberHeadline(value=raw, aggregation="total", rows_used=1)
    if parsed is None:
        return _unavailable("total", "The metric value is null.")
    return BigNumberHeadline(value=parsed, aggregation="total", rows_used=1)


def _overall_value(
    label: str, x_labels: Sequence[str], rows: Sequence[Mapping[str, Any]]
) -> int | float | str | None:
    """Value of the `raw` ("Overall value") query layer, as the frontend reads
    it: the metric column, else the first other numeric column."""
    row = rows[0]
    value = row.get(label)
    if value is None:
        value = next(
            (
                cell
                for key, cell in row.items()
                if key not in x_labels
                and isinstance(cell, (int, float, Decimal))
                and not isinstance(cell, bool)
            ),
            None,
        )
    if isinstance(value, Decimal):
        value = float(value)
    if isinstance(value, float) and not math.isfinite(value):
        return None
    return value if isinstance(value, (int, float, str)) else None


def _raw_headline(
    label: str,
    x_labels: Sequence[str],
    queries: Sequence[Mapping[str, Any]],
) -> BigNumberHeadline:
    """`raw` ("Overall value"): read from the second, un-trended query layer."""
    overall_rows = queries[1].get("data") if len(queries) > 1 else None
    if not overall_rows:
        return _unavailable(
            RAW_AGGREGATION,
            "The overall-value (raw) query layer did not return a value.",
        )
    value = _overall_value(label, x_labels, overall_rows)
    if value is None:
        return _unavailable(
            RAW_AGGREGATION, "The overall-value (raw) query returned null."
        )
    return BigNumberHeadline(
        value=value, aggregation=RAW_AGGREGATION, rows_used=len(overall_rows)
    )


def _series_problem(
    form_data: Mapping[str, Any],
    first: Mapping[str, Any],
    row_limit: int | None,
    post_processing_operations: Sequence[str],
) -> str | None:
    """Why the returned trend rows cannot give an exact headline, if they can't."""
    rolling_type = form_data.get("rolling_type")
    expected_operation = _ROLLING_OPERATIONS.get(str(rolling_type))
    if expected_operation and expected_operation not in post_processing_operations:
        return (
            f"The chart uses a rolling window ({rolling_type}) that the returned "
            "rows do not reflect."
        )
    # As in the frontend's `resampleOperator`, both controls add the step.
    if (
        form_data.get("resample_rule")
        and form_data.get("resample_method")
        and "resample" not in post_processing_operations
    ):
        return (
            f"The chart resamples the series ({form_data['resample_rule']}, "
            f"{form_data['resample_method']}), which the returned rows do not "
            "reflect."
        )
    rows = first.get("data") or []
    returned_total = first.get("rowcount")
    if (row_limit and len(rows) >= row_limit) or (
        isinstance(returned_total, int) and returned_total > len(rows)
    ):
        return (
            "The fetch was truncated at the row limit, so the series is "
            "incomplete; the headline cannot be computed exactly."
        )
    return None


def _trend_values(
    label: str,
    x_labels: Sequence[str],
    rows: Sequence[Mapping[str, Any]],
    *,
    newest_first: bool,
) -> list[int | float] | None:
    """Non-null metric values, newest first when the aggregation needs it.

    Returns None when the newest value cannot be determined exactly. The
    frontend sorts with a comparator that treats a row lacking a usable
    timestamp as equal to every other row, so with such a row present the order
    it renders depends on the input order and the browser's sort, and the value
    it shows need not be the newest dated one.
    """
    values = [_parse_metric_value(row.get(label)) for row in rows]
    if not newest_first:
        return [value for value in values if value is not None]
    x_label = next(
        (name for name in x_labels if any(name in row for row in rows)), None
    )
    timestamps = [_timestamp_ms(row.get(x_label)) if x_label else None for row in rows]
    non_null = [value for value in values if value is not None]
    if None in timestamps and len(set(non_null)) > 1:
        return None
    # Descending by time; ties retain their input order, as in the stable
    # frontend sort.
    ordered = sorted(
        zip(timestamps, values, strict=True), key=lambda item: -(item[0] or 0)
    )
    return [value for _, value in ordered if value is not None]


def compute_big_number_headline(
    viz_type: str | None,
    form_data: Mapping[str, Any],
    queries: Sequence[Mapping[str, Any]],
    *,
    row_limit: int | None = None,
    post_processing_operations: Sequence[str] = (),
) -> BigNumberHeadline | None:
    """Headline of a Big Number chart from its executed query results.

    Args:
        viz_type: The chart's viz type; anything but a Big Number returns None.
        form_data: The chart's form data (metric, aggregation, rolling_type, ...).
        queries: The executed query results, in query-context order.
        row_limit: The row limit the first query ran with, used to detect a
            truncated fetch.
        post_processing_operations: Operations of the first executed query.
    """
    if not is_big_number_viz_type(viz_type):
        return None

    first = queries[0] if queries else {}
    rows: Sequence[Mapping[str, Any]] = first.get("data") or []
    if viz_type == BIG_NUMBER_TOTAL_VIZ_TYPE:
        return _total_headline(form_data, rows)

    # Case-insensitive lookup with a LAST_VALUE fallback, as the frontend does.
    requested = str(form_data.get("aggregation") or "")
    key = next(
        (name for name in _AGGREGATIONS if name.lower() == requested.lower()),
        DEFAULT_AGGREGATION,
    )
    label = _metric_label(form_data)
    if not rows:
        return _unavailable(key, "The query returned no rows.")
    if label is None or label not in rows[0]:
        return _unavailable(key, "The metric column was not in the result.")
    x_labels = _x_axis_labels(form_data)

    # Only an exact "raw" selects the server-side overall value; the frontend
    # adds that second query layer for the same exact match.
    if requested == RAW_AGGREGATION:
        return _raw_headline(label, x_labels, queries)

    if problem := _series_problem(
        form_data, first, row_limit, post_processing_operations
    ):
        return _unavailable(key, problem)

    # `raw` reaches here only for a non-exact spelling, where the frontend takes
    # the newest value just like LAST_VALUE.
    values = _trend_values(
        label,
        x_labels,
        rows,
        newest_first=key in (DEFAULT_AGGREGATION, RAW_AGGREGATION),
    )
    if values is None:
        return _unavailable(
            key,
            "Some rows have no usable timestamp, so the latest value the chart "
            "shows depends on row order and cannot be determined exactly.",
        )
    result = _AGGREGATIONS[key](values)
    if result is None:
        return _unavailable(key, "The series has no non-null values.")
    return BigNumberHeadline(value=result, aggregation=key, rows_used=len(values))
