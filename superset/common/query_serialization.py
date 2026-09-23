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
"""Canonical, JSON-safe serialization of a single chart-data query.

A chart-data request is a query *context* wrapping N ``QueryObject`` s over one
datasource. To run a single query on its own (e.g. as an async task), we need a
self-contained, JSON-safe payload that reconstructs to an identical query — one
that yields the same ``query_cache_key``, so the reconstructed query reads and
writes the same DATA-cache entry as the synchronous path.

The payload is the *raw* query dict (the schema-shaped input, as stored in
``QueryContext.cache_values["queries"]``) plus the context-level inputs needed to
rebuild it: ``datasource``, ``form_data``, ``result_type``/``result_format``, and
``force``/``custom_cache_timeout``. Reconstruction feeds these straight back into
:class:`~superset.common.query_context_factory.QueryContextFactory`, i.e. the same
path that produced the original key. This avoids serializing the *processed*
``QueryObject`` (whose ``to_dict()`` emits raw datetimes, renames ``filters`` to
``filter``, and drops ``time_range``/``datasource``/``result_type``), which would
not rebuild to the same key.

The raw query and datasource dicts originate from JSON (the HTTP body or
``Slice.query_context``), so the payload contains only JSON-native types and needs
no custom encoder.
"""

from __future__ import annotations

from typing import Any, NotRequired, TYPE_CHECKING, TypedDict

from superset.common.chart_data import ChartDataResultFormat, ChartDataResultType
from superset.utils.core import DatasourceDict

if TYPE_CHECKING:
    from superset.common.query_context import QueryContext


class SerializedQuery(TypedDict):
    """JSON-safe, self-contained representation of one chart-data query."""

    datasource: DatasourceDict
    query: dict[str, Any]
    form_data: dict[str, Any] | None
    result_type: str
    result_format: str
    force: bool
    force_nonce: NotRequired[str | None]
    custom_cache_timeout: int | None
    preserve_null_row_limit: NotRequired[bool]


def _preserve_null_row_limit(
    query_context: "QueryContext",
    query_index: int,
) -> bool:
    raw_query = query_context.cache_values["queries"][query_index]
    return (
        "row_limit" in raw_query
        and raw_query["row_limit"] is None
        and query_context.queries[query_index].row_limit is None
    )


def serialize_query(query_context: "QueryContext", query_index: int) -> SerializedQuery:
    """Serialize the query at ``query_index`` into a JSON-safe payload.

    Reads the *raw* query dict from ``cache_values`` (not the processed
    ``QueryObject``) so the payload rebuilds to an identical ``query_cache_key``.
    ``force`` and ``custom_cache_timeout`` are carried explicitly — they live on
    the context, not the query, and would otherwise be lost per query. So is
    ``force_nonce``, so the async task and the follow-up read-back share one
    forced-refresh idempotency token.

    :param query_context: the source query context
    :param query_index: index of the query within ``query_context.queries``
    :returns: a JSON-safe :class:`SerializedQuery`
    """
    cache_values = query_context.cache_values
    payload = SerializedQuery(
        datasource=cache_values["datasource"],
        query=cache_values["queries"][query_index],
        form_data=query_context.form_data,
        result_type=ChartDataResultType(query_context.result_type).value,
        result_format=ChartDataResultFormat(query_context.result_format).value,
        force=query_context.force,
        force_nonce=query_context.force_nonce,
        custom_cache_timeout=query_context.custom_cache_timeout,
    )
    if _preserve_null_row_limit(query_context, query_index):
        payload["preserve_null_row_limit"] = True
    return payload


def load_serialized_query(payload: SerializedQuery) -> "QueryContext":
    """Reconstruct a single-query :class:`QueryContext` from a serialized payload.

    Feeds the payload back through :class:`QueryContextFactory`, the same path
    that produced the original context, so the resulting query's
    ``query_cache_key`` matches the original. The returned context holds exactly
    one query; run it via ``QueryContextProcessor.get_df_payload_result``.

    :param payload: a :class:`SerializedQuery` produced by :func:`serialize_query`
    :returns: a query context containing the single reconstructed query
    """
    from superset.common.query_context_factory import QueryContextFactory

    factory = QueryContextFactory()
    return factory.create(
        datasource=payload["datasource"],
        queries=[payload["query"]],
        form_data=payload["form_data"],
        result_type=ChartDataResultType(payload["result_type"]),
        result_format=ChartDataResultFormat(payload["result_format"]),
        force=payload["force"],
        force_nonce=payload.get("force_nonce"),
        custom_cache_timeout=payload["custom_cache_timeout"],
        preserve_null_row_limit=bool(payload.get("preserve_null_row_limit")),
    )
