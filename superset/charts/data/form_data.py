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

from __future__ import annotations

from typing import Any, TYPE_CHECKING

from flask import g

from superset.utils.core import FilterOperator

if TYPE_CHECKING:
    from superset.common.query_context import QueryContext
    from superset.common.query_object import QueryObject


def set_form_data(form_data: dict[str, Any]) -> None:
    """Expose chart data request fields to Jinja template macros."""
    g.form_data = form_data


def _as_form_data_dict(value: Any) -> dict[str, Any]:
    return value if isinstance(value, dict) else {}


def _as_query_list(value: Any) -> list[Any]:
    if isinstance(value, (list, tuple)):
        return list(value)
    return []


def _filter_op(op: Any) -> str | None:
    if isinstance(op, FilterOperator):
        return op.value
    return op if isinstance(op, str) else None


def _raw_query_dicts(query_context: QueryContext) -> list[Any]:
    cache_values = getattr(query_context, "cache_values", None)
    if not isinstance(cache_values, dict):
        return []
    return _as_query_list(cache_values.get("queries"))


def _time_range_from_filters(filters: Any, time_column: Any = None) -> str | None:
    """Read a time range for Jinja get_time_filter().

    Prefer a TEMPORAL_RANGE comparator (datasets and two-sided views).
    Semantic views rewrite one-sided ranges to ``>=`` / ``<`` on the
    granularity column and emit no TEMPORAL_RANGE, so reconstruct those
    in the ``since : until`` grammar get_time_filter() already parses.
    """
    if not isinstance(filters, list):
        return None

    since: str | None = None
    until: str | None = None
    for flt in filters:
        if not isinstance(flt, dict):
            continue
        op = _filter_op(flt.get("op"))
        val = flt.get("val")
        if op == FilterOperator.TEMPORAL_RANGE.value and isinstance(val, str):
            return val
        if time_column is None or flt.get("col") != time_column:
            continue
        if not isinstance(val, str):
            continue
        if op == FilterOperator.GREATER_THAN_OR_EQUALS.value and since is None:
            since = val
        elif op == FilterOperator.LESS_THAN.value and until is None:
            until = val

    if since is None and until is None:
        return None
    return f"{since or ''} : {until or ''}"


def _hoisted_time_range(
    query: QueryObject,
    filters: Any,
    raw_query: Any = None,
) -> str | None:
    if (time_range := getattr(query, "time_range", None)) is not None:
        return time_range
    granularity = getattr(query, "granularity", None)
    if hoisted := _time_range_from_filters(filters, granularity):
        return hoisted
    raw = raw_query if isinstance(raw_query, dict) else {}
    # QueryContextFactory._apply_granularity deletes TEMPORAL_RANGE on the
    # granularity column before this helper runs. The raw pre-processing
    # dict in cache_values still has it.
    return _time_range_from_filters(
        raw.get("filters"), granularity or raw.get("granularity")
    )


def _serialize_query(
    query: QueryObject,
    form_data: dict[str, Any],
    raw_query: Any = None,
) -> dict[str, Any] | None:
    """Serialize query fields consumed by the Jinja form-data fallback.

    Incomplete stubs (unit-test doubles without ``to_dict``) are skipped so
    callers can still publish datasource context for Jinja without requiring a
    full ``QueryObject``.
    """
    to_dict = getattr(query, "to_dict", None)
    if not callable(to_dict):
        return None

    query_data = dict(to_dict())
    filters = getattr(query, "filter", None)
    query_data["filters"] = filters
    if hoisted := _hoisted_time_range(query, filters, raw_query):
        # Prefer QueryObject.time_range for cache keys / Explore payloads.
        # Tabular queries omit that field so relative ranges keep
        # from_dttm/to_dttm in the cache key; hoist the range here so Jinja
        # sees it. _apply_granularity may have already stripped TEMPORAL_RANGE
        # from the processed query, so fall back to cache_values. One-sided
        # semantic views rewrite to >= / <; _time_range_from_filters
        # reconstructs those too.
        query_data["time_range"] = hoisted
    if url_params := form_data.get("url_params"):
        query_data["url_params"] = url_params
    return query_data


def set_query_context_form_data(
    query_context: QueryContext,
    datasource_id: int | str,
    datasource_type: str,
) -> None:
    """Expose a programmatically-created query like a chart data API request."""
    form_data = _as_form_data_dict(getattr(query_context, "form_data", None))
    queries = _as_query_list(getattr(query_context, "queries", None))
    raw_queries = _raw_query_dicts(query_context)
    serialized: list[dict[str, Any]] = []
    for index, query in enumerate(queries):
        raw = raw_queries[index] if index < len(raw_queries) else None
        if (payload := _serialize_query(query, form_data, raw)) is not None:
            serialized.append(payload)
    set_form_data(
        {
            "datasource": {"id": datasource_id, "type": datasource_type},
            "queries": serialized,
            "form_data": form_data,
        }
    )
