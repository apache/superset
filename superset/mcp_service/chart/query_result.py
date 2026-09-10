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
from functools import lru_cache
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


GEOGRAPHIC_VIZ_TYPES = frozenset({"country_map", "world_map", "deck_scatter"})


def _geographic_metric_labels(form_data: Mapping[str, Any]) -> list[str]:
    """Resolve metrics once, including fixed versus metric point sizing."""
    if form_data.get("viz_type") == "deck_scatter":
        radius = form_data.get("point_radius_fixed")
        if not isinstance(radius, Mapping) or radius.get("type") not in {
            "fix",
            "metric",
        }:
            raise ValueError("Invalid geographic point radius configuration")
        metrics = [radius.get("value")] if radius["type"] == "metric" else []
    else:
        metrics = [form_data.get("metric")]
        secondary = form_data.get("secondary_metric")
        if form_data.get("show_bubbles") and secondary is None:
            raise ValueError("show_bubbles requires secondary_metric")
        if secondary is not None:
            metrics.append(secondary)
    labels = [metric_result_label(metric) for metric in metrics]
    if any(label is None for label in labels):
        raise ValueError("Geographic metric has no resolvable result label")
    return [label for label in labels if label is not None]


def _validate_geographic_metrics(
    row: Mapping[str, Any], labels: list[str], form_data: Mapping[str, Any]
) -> None:
    """Validate every selected metric without dropping invalid rows."""
    secondary = metric_result_label(form_data.get("secondary_metric"))
    for label in labels:
        value = row.get(label)
        if (
            isinstance(value, bool)
            or not isinstance(value, (int, float))
            or not math.isfinite(value)
        ):
            raise ValueError(f"Geographic metric {label!r} must be a finite number")
        if value < 0 and (
            form_data.get("viz_type") == "deck_scatter" or label == secondary
        ):
            raise ValueError("Geographic size metrics must be nonnegative")


@lru_cache(maxsize=4)
def _world_country_entries(field: str) -> tuple[tuple[str, str], ...]:
    """Reuse immutable country aliases for the four supported world formats."""
    from superset.examples.countries import countries

    return tuple(
        (country[field], country["cca3"]) for country in countries if country[field]
    )


def _geographic_row_identifier(
    row: Mapping[str, Any], form_data: Mapping[str, Any]
) -> str | None:
    """Resolve a polygon identifier or validate numeric point coordinates."""
    from superset.utils.geographic import resolve_geographic_value, resolve_region

    viz = form_data["viz_type"]
    entity = form_data.get("entity")
    if viz != "deck_scatter" and not isinstance(entity, str):
        raise ValueError("Geographic maps require an entity column")
    if viz == "country_map":
        return resolve_region(
            row.get(entity or ""),
            form_data.get("select_country", ""),
            form_data.get("region_format", ""),
        )
    if viz == "world_map":
        field = form_data.get("country_fieldtype")
        if field not in {"name", "cca2", "cca3", "cioc"}:
            raise ValueError("Choose country_format name, cca2, cca3, or cioc")
        return resolve_geographic_value(
            row.get(entity or ""),
            _world_country_entries(field),
            fold_diacritics=False,
        )
    spatial = form_data.get("spatial")
    if not isinstance(spatial, Mapping) or spatial.get("type") != "latlong":
        raise ValueError("Geographic points require latlong spatial columns")
    for role, bound in (("latCol", 90), ("lonCol", 180)):
        column = spatial.get(role)
        if not isinstance(column, str):
            raise ValueError(f"{role} requires a named coordinate column")
        value = row.get(column)
        if (
            isinstance(value, bool)
            or not isinstance(value, (int, float))
            or not math.isfinite(value)
            or not -bound <= value <= bound
        ):
            raise ValueError(
                f"{role} must be a finite number between {-bound} and {bound}"
            )
    return None


def validate_geographic_query_result(
    result: Any, form_data: Mapping[str, Any]
) -> ChartError | None:
    """Reject unresolved regions and malformed or nonfinite geographic results.

    Preserve source values for exports and filtering. The native transform owns
    display-only ISO mapping using the same bundled boundary identifiers.
    Legacy charts without the typed MCP contract retain their native behavior.
    """
    if form_data.get("viz_type") not in GEOGRAPHIC_VIZ_TYPES or not form_data.get(
        "mcp_geographic"
    ):
        return None
    try:
        if (
            not isinstance(result, Mapping)
            or not isinstance(result.get("queries"), list)
            or len(result["queries"]) != 1
        ):
            raise ValueError("Expected exactly one geographic query result")
        query = result["queries"][0]
        if not isinstance(query, Mapping) or not isinstance(query.get("data"), list):
            raise ValueError("Expected geographic query data to be a list of records")
        labels = _geographic_metric_labels(form_data)
        seen: set[str] = set()
        for row in query["data"]:
            if not isinstance(row, Mapping):
                raise ValueError("Expected geographic rows to be records")
            _validate_geographic_metrics(row, labels, form_data)
            if identifier := _geographic_row_identifier(row, form_data):
                if identifier in seen:
                    raise ValueError(
                        f"Multiple result rows resolve to {identifier}; "
                        "normalize source values before aggregation"
                    )
                seen.add(identifier)
    except (ValueError, TypeError, KeyError) as exc:
        return ChartError(error=str(exc), error_type="InvalidGeographicResult")
    return None


def normalize_chart_query_result(result: Any, form_data: Mapping[str, Any]) -> Any:
    """Apply typed result contracts without modifying unrelated chart results."""
    if failure := query_result_failure(result):
        return failure
    if failure := validate_geographic_query_result(result, form_data):
        return failure
    return normalize_gauge_query_result(result, form_data)
