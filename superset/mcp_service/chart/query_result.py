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

from collections.abc import Mapping
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
    """Return a structured failure embedded in a ChartDataCommand payload.

    ChartDataCommand can return an HTTP-successful envelope whose top level or
    any query reports a failure. Every query is inspected before callers accept
    data from the result. Successful statuses may carry informational messages,
    so ``message`` alone is not treated as an error.
    """
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
