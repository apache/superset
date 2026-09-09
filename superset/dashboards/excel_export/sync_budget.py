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
Plan an export that has to be served as the response to one request.

An inline export has to finish inside its request, so its size is settled
*before* any query runs, by adding up the rows it is allowed to ask for: the
``row_limit`` of every query it would run. A request/server timeout is the
last-resort backstop, not the criterion — a timed-out export wastes the work
already done and tells the user nothing actionable, whereas an up-front refusal
can name the fix.

Working that total out means resolving each chart's query context, which is what
the export itself runs. The plan therefore hands those contexts back and the
export reuses them, so the queries that run are exactly the ones the budget was
measured against — resolution can be expensive and, through
``EXCEL_EXPORT_QUERY_CONTEXT_BUILDER``, is not guaranteed to be deterministic.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from flask import current_app

from superset.dashboards.excel_export.layout import get_charts_in_layout_order
from superset.dashboards.excel_export.workbook import (
    resolve_query_context,
    ResolvedQueryContexts,
)


@dataclass(frozen=True)
class InlineExportPlan:
    """What an inline export would run, and whether it is small enough to."""

    #: Every chart's resolved query context, keyed by chart id. A ``None`` value
    #: is an answer, not a gap: that chart cannot be exported and will be listed
    #: as skipped.
    query_contexts: ResolvedQueryContexts
    #: Rows every query is allowed to return, or ``None`` when any query has no
    #: finite limit and the size of the export is therefore unknowable.
    requested_rows: int | None
    #: The configured ceiling this plan was measured against.
    max_rows: int

    @property
    def fits_row_budget(self) -> bool:
        """Whether this export may run inline, as the response to one request."""
        return self.requested_rows is not None and self.requested_rows <= self.max_rows


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


def _row_total(query_contexts: ResolvedQueryContexts) -> int | None:
    """Rows every resolved query may return, or ``None`` if any is unbounded."""
    total = 0
    for query_context in query_contexts.values():
        if query_context is None:
            # Nothing to run: the export skips this chart and lists it instead.
            continue
        for query in query_context["queries"]:
            row_limit = _finite_row_limit(query)
            if row_limit is None:
                return None
            total += row_limit
    return total


def plan_inline_export(dashboard: Any) -> InlineExportPlan:
    """
    Resolve what an inline export of ``dashboard`` would run, and size it.

    Only ever called for a data export: an image export renders charts through
    the headless webdriver, which is not work a request can wait on, so it is
    refused before it gets here.
    """
    query_contexts: ResolvedQueryContexts = {
        chart.id: resolve_query_context(chart)
        for chart in get_charts_in_layout_order(dashboard)
    }
    return InlineExportPlan(
        query_contexts=query_contexts,
        requested_rows=_row_total(query_contexts),
        max_rows=current_app.config["EXCEL_EXPORT_SYNC_MAX_ROWS"],
    )
