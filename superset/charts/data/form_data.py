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


def _time_range_from_filters(filters: Any) -> str | None:
    """Read the first TEMPORAL_RANGE comparator for Jinja get_time_filter()."""
    if not isinstance(filters, list):
        return None
    for flt in filters:
        if (
            isinstance(flt, dict)
            and flt.get("op") == "TEMPORAL_RANGE"
            and isinstance(flt.get("val"), str)
        ):
            return flt["val"]
    return None


def _serialize_query(
    query: QueryObject,
    form_data: dict[str, Any],
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
    if (time_range := getattr(query, "time_range", None)) is not None:
        query_data["time_range"] = time_range
    elif (hoisted := _time_range_from_filters(filters)) is not None:
        # Prefer QueryObject.time_range for cache keys / Explore payloads.
        # MCP tabular queries often only put the range in TEMPORAL_RANGE
        # filters; hoist it here so Jinja sees it without changing cache keys.
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
    serialized = [
        payload
        for query in _as_query_list(getattr(query_context, "queries", None))
        if (payload := _serialize_query(query, form_data)) is not None
    ]
    set_form_data(
        {
            "datasource": {"id": datasource_id, "type": datasource_type},
            "queries": serialized,
            "form_data": form_data,
        }
    )
