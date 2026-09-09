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
Decide whether a dashboard is small enough to export inline.

An export served as the HTTP response has to finish inside one request, so the
size of the workbook is settled *before* any query runs, by adding up the rows
the export is allowed to ask for: the ``row_limit`` of every query it would run.
A request/server timeout is the last-resort backstop, not the criterion — a
timed-out export wastes the work already done and tells the user nothing
actionable, whereas an up-front refusal can name the fix.

The total is deliberately the *requested* row count rather than the delivered
one. It is knowable without touching a database, and it is an upper bound: an
export that clears the budget cannot exceed it once the queries run.
"""

from __future__ import annotations

from typing import Any

from flask import current_app

from superset.dashboards.excel_export.layout import get_charts_in_layout_order
from superset.dashboards.excel_export.workbook import (
    renders_as_image,
    resolve_query_context,
)


def _finite_row_limit(query: Any) -> int | None:
    """
    A query's ``row_limit`` when it bounds the result, else ``None``.

    Anything else — absent, ``0`` (which defers to the deployment's configured
    limits), negative, or not an integer — leaves the query's size unknown.
    ``bool`` is rejected too: it is an ``int`` subclass, so ``True`` would
    otherwise pass as a limit of one row.
    """
    if not isinstance(query, dict):
        return None
    row_limit = query.get("row_limit")
    if isinstance(row_limit, bool) or not isinstance(row_limit, int):
        return None
    return row_limit if row_limit > 0 else None


def requested_row_total(dashboard: Any, mode: str) -> int | None:
    """
    Total rows every query in this export is allowed to return.

    Returns ``None`` when any query the export would run has no finite row limit,
    which makes the total — and so the size of the export — indeterminate.

    Charts the export cannot run contribute nothing: one with no usable query
    context is skipped by the export itself, and in image mode a non-table chart
    is rendered rather than queried.

    Note that this resolves each chart's query context, which the export then
    resolves again when it builds the workbook. For a saved context that is a
    JSON parse; a deployment using ``EXCEL_EXPORT_QUERY_CONTEXT_BUILDER`` pays
    for its hook twice on this path.
    """
    total = 0
    for chart in get_charts_in_layout_order(dashboard):
        if renders_as_image(chart, mode):
            continue
        query_context = resolve_query_context(chart)
        if query_context is None:
            continue
        for query in query_context["queries"]:
            row_limit = _finite_row_limit(query)
            if row_limit is None:
                return None
            total += row_limit
    return total


def is_within_sync_row_budget(dashboard: Any, mode: str) -> bool:
    """Whether this export may run inline, as the response to one request."""
    total = requested_row_total(dashboard, mode)
    return (
        total is not None and total <= current_app.config["EXCEL_EXPORT_SYNC_MAX_ROWS"]
    )
