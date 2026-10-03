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


def _serialize_query(
    query: QueryObject,
    form_data: dict[str, Any],
    time_range: str | None = None,
) -> dict[str, Any]:
    """Serialize query fields consumed by the Jinja form-data fallback.

    ``QueryObject.to_dict()`` uses ``filter``; Jinja's form-data fallback
    reads ``filters``. ``time_range`` is an optional overlay for callers that
    deliberately leave ``QueryObject.time_range`` unset (tabular queries, so
    relative ranges keep ``from_dttm``/``to_dttm`` in the cache key). Chart
    and async callers omit it so ``get_time_filter()`` matches the chart-data
    API: a TEMPORAL_RANGE filter alone is not a published time range.
    """
    query_data = dict(query.to_dict())
    query_data["filters"] = query.filter
    resolved = time_range if time_range is not None else query.time_range
    if isinstance(resolved, str):
        query_data["time_range"] = resolved
    if url_params := form_data.get("url_params"):
        query_data["url_params"] = url_params
    return query_data


def set_query_context_form_data(
    query_context: QueryContext,
    datasource_id: int | str,
    datasource_type: str,
    time_range: str | None = None,
) -> None:
    """Expose a programmatically-created query like a chart data API request."""
    form_data = _as_form_data_dict(getattr(query_context, "form_data", None))
    queries = _as_query_list(getattr(query_context, "queries", None))
    serialized = [_serialize_query(query, form_data, time_range) for query in queries]
    set_form_data(
        {
            "datasource": {"id": datasource_id, "type": datasource_type},
            "queries": serialized,
            "form_data": form_data,
        }
    )
