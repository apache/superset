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

"""Helpers for interpreting ChartDataCommand result envelopes."""

import math
from collections.abc import Mapping
from decimal import Decimal
from numbers import Real
from typing import Any

from superset.mcp_service.chart.schemas import ChartError

FAILED_QUERY_STATUSES = frozenset(
    {"error", "failed", "stopped", "timed_out", "cancelled", "canceled"}
)


def _query_error_text(value: Any) -> str | None:
    """Convert a bounded query error payload into a useful message."""
    if value is None or value is False:
        return None
    if isinstance(value, Mapping):
        for key in ("error", "error_message", "message", "detail"):
            if text := _query_error_text(value.get(key)):
                return text
        return None
    if isinstance(value, (list, tuple)):
        parts = [text for item in value if (text := _query_error_text(item))]
        return "; ".join(parts[:3]) or None
    text = str(value)
    return text[:2000] if text else None


def _failure_for_query_payload(
    payload: Mapping[str, Any], label: str
) -> ChartError | None:
    """Extract one failure from a top-level or per-query payload."""
    for key in ("error", "errors", "error_message"):
        if message := _query_error_text(payload.get(key)):
            return ChartError(
                error=f"{label} failed: {message}", error_type="QueryError"
            )

    raw_status = payload.get("status")
    status = str(getattr(raw_status, "value", raw_status) or "")
    normalized_status = status.strip().casefold().replace("-", "_").replace(" ", "_")
    if normalized_status in FAILED_QUERY_STATUSES:
        message = (
            _query_error_text(payload.get("message"))
            or _query_error_text(payload.get("error_message"))
            or normalized_status
        )
        return ChartError(error=f"{label} failed: {message}", error_type="QueryError")
    if payload.get("success") is False:
        message = _query_error_text(payload.get("message")) or "request failed"
        return ChartError(error=f"{label} failed: {message}", error_type="QueryError")
    if (
        raw_status is None
        and "data" not in payload
        and "queries" not in payload
        and (message := _query_error_text(payload.get("message")))
    ):
        return ChartError(error=f"{label} failed: {message}", error_type="QueryError")
    return None


def query_result_failure(result: Any) -> ChartError | None:
    """Return a structured failure embedded in a ChartDataCommand payload."""
    if not isinstance(result, Mapping):
        return None

    if failure := _failure_for_query_payload(result, "Chart query"):
        return failure
    queries = result.get("queries")
    if isinstance(queries, list):
        for index, query in enumerate(queries, start=1):
            if isinstance(query, Mapping) and (
                failure := _failure_for_query_payload(query, f"Chart query {index}")
            ):
                return failure
    return None


def metric_result_label(metric: Any) -> str | None:
    """Resolve the query-result key using frontend ``getMetricLabel`` rules."""
    if isinstance(metric, str) and metric:
        return metric
    if not isinstance(metric, Mapping):
        return None
    label = metric.get("label")
    if isinstance(label, str) and label:
        return label
    if label not in (None, ""):
        return None
    expression_type = metric.get("expressionType")
    if expression_type == "SIMPLE":
        aggregate = metric.get("aggregate")
        column = metric.get("column")
        if not isinstance(aggregate, str) or not isinstance(column, Mapping):
            return None
        column_name = column.get("columnName") or column.get("column_name")
        if isinstance(column_name, str) and column_name:
            return f"{aggregate}({column_name})"
        return None
    if expression_type == "SQL":
        sql_expression = metric.get("sqlExpression")
        if isinstance(sql_expression, str) and sql_expression:
            return sql_expression
    return None


def normalize_gauge_query_result(  # noqa: C901
    result: Any, form_data: Mapping[str, Any]
) -> Any:
    """Copy Gauge query envelopes with only finite dials; preserve empty results.

    Malformed envelopes/aliases remain errors. Invalid dial values are skipped,
    but a nonempty query with no finite dials returns an actionable error.
    Non-Gauge results and the caller's query payloads are left untouched.
    """
    if form_data.get("viz_type") != "gauge_chart":
        return result
    if failure := query_result_failure(result):
        return failure

    metric_label = metric_result_label(form_data.get("metric"))
    if metric_label is None:
        return ChartError(
            error="Gauge form_data has no resolvable metric result label.",
            error_type="InvalidGaugeFormData",
        )
    if not isinstance(result, Mapping):
        return ChartError(
            error="Gauge query result is not an object.",
            error_type="InvalidGaugeResult",
        )
    queries = result.get("queries")
    if not isinstance(queries, list):
        return ChartError(
            error="Gauge query result has no queries array.",
            error_type="InvalidGaugeResult",
        )
    normalized_queries = []
    for query_index, query in enumerate(queries):
        if not isinstance(query, Mapping):
            return ChartError(
                error=f"Gauge query {query_index} is not an object.",
                error_type="InvalidGaugeResult",
            )
        data = query.get("data", [])
        if not isinstance(data, list):
            return ChartError(
                error=f"Gauge query {query_index} data is not an array of rows.",
                error_type="InvalidGaugeResult",
            )
        finite_rows = []
        value_error = None
        for row_index, row in enumerate(data):
            if not isinstance(row, Mapping):
                return ChartError(
                    error=(
                        f"Gauge query {query_index} row {row_index} is not an object."
                    ),
                    error_type="InvalidGaugeResult",
                )
            if metric_label not in row:
                return ChartError(
                    error=(
                        f"Gauge query {query_index} row {row_index} is missing "
                        f"metric output {metric_label!r}."
                    ),
                    error_type="InvalidGaugeResult",
                )
            value = row[metric_label]
            if isinstance(value, bool) or not isinstance(value, (int, float)):
                value_error = value_error or ChartError(
                    error=(
                        f"Gauge query {query_index} row {row_index} metric "
                        f"{metric_label!r} is not numeric."
                    ),
                    error_type="NonNumericGaugeMetric",
                )
                continue
            try:
                finite = math.isfinite(float(value))
            except (OverflowError, ValueError):
                finite = False
            if not finite:
                value_error = value_error or ChartError(
                    error=(
                        f"Gauge query {query_index} row {row_index} metric "
                        f"{metric_label!r} is not finite."
                    ),
                    error_type="NonFiniteGaugeMetric",
                )
                continue
            finite_rows.append(row)
        if data and not finite_rows:
            return value_error
        normalized_query = {**query, "data": finite_rows}
        if len(finite_rows) != len(data) and "rowcount" in query:
            normalized_query["rowcount"] = len(finite_rows)
        normalized_queries.append(normalized_query)
    return {**result, "queries": normalized_queries}


def validate_gauge_query_result(
    result: Any, form_data: Mapping[str, Any]
) -> ChartError | None:
    """Check Gauge results using the same finite-dial contract as rendering."""
    normalized = normalize_gauge_query_result(result, form_data)
    return normalized if isinstance(normalized, ChartError) else None


def normalize_chart_query_result(result: Any, form_data: Mapping[str, Any]) -> Any:
    """Validate chart-specific result contracts before consumers use rows."""
    if form_data.get("viz_type") != "treemap_v2":
        return normalize_gauge_query_result(result, form_data)
    if failure := query_result_failure(result):
        return failure
    label = metric_result_label(form_data.get("metric"))
    hierarchy = form_data.get("groupby")
    if (
        not label
        or not isinstance(hierarchy, list)
        or not hierarchy
        or not all(isinstance(column, str) and column for column in hierarchy)
        or len(set(hierarchy)) != len(hierarchy)
        or label in hierarchy
    ):
        return ChartError(
            error=(
                "Treemap requires unique hierarchy columns and a distinct metric label."
            ),
            error_type="InvalidTreemapFormData",
        )
    queries = result.get("queries") if isinstance(result, Mapping) else None
    if not isinstance(queries, list) or len(queries) != 1:
        return ChartError(
            error="Treemap requires exactly one query result.",
            error_type="InvalidTreemapResult",
        )
    query = queries[0]
    rows = query.get("data") if isinstance(query, Mapping) else None
    if not isinstance(rows, list):
        return ChartError(
            error="Treemap query data must be an array of rows.",
            error_type="InvalidTreemapResult",
        )
    if failure := _validate_treemap_rows(rows, hierarchy, label):
        return failure
    return result


def _validate_treemap_rows(
    rows: list[Any], hierarchy: list[str], label: str
) -> ChartError | None:
    """Require complete hierarchy outputs and finite numeric metric values."""
    for index, row in enumerate(rows):
        if not isinstance(row, Mapping) or any(
            column not in row for column in [*hierarchy, label]
        ):
            return ChartError(
                error=f"Treemap row {index} is missing hierarchy or metric outputs.",
                error_type="InvalidTreemapResult",
            )
        value = row[label]
        try:
            valid = (
                not isinstance(value, bool)
                and isinstance(value, (Real, Decimal))
                and (
                    value.is_finite()
                    if isinstance(value, Decimal)
                    else math.isfinite(value)
                )
            )
        except (OverflowError, ValueError):
            valid = False
        if not valid:
            return ChartError(
                error=(
                    f"Treemap row {index} metric {label!r} must be finite and numeric."
                ),
                error_type="InvalidTreemapMetric",
            )
        if any(isinstance(row[column], (dict, list)) for column in hierarchy):
            return ChartError(
                error=f"Treemap row {index} hierarchy values must be scalar.",
                error_type="InvalidTreemapResult",
            )
    return None
