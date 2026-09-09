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
"""Plan and size dashboard Excel exports served in the HTTP response."""

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
    """Queries planned for a direct download and their row budget."""

    #: Resolved query contexts by chart id. ``None`` marks a skipped chart.
    query_contexts: ResolvedQueryContexts
    #: Combined row limit, or ``None`` when any query has no finite limit.
    requested_rows: int | None
    #: Configured limit for direct downloads.
    max_rows: int

    @property
    def fits_row_budget(self) -> bool:
        """Return whether the export can run during the request."""
        return self.requested_rows is not None and self.requested_rows <= self.max_rows


def _finite_row_limit(query: Any) -> int | None:
    """Return the query's row limit, using ``ROW_LIMIT`` when omitted."""
    if not isinstance(query, dict):
        return None
    row_limit = query.get("row_limit") or current_app.config["ROW_LIMIT"]
    if isinstance(row_limit, bool) or not isinstance(row_limit, int):
        return None
    return row_limit if row_limit > 0 else None


def _row_total(query_contexts: ResolvedQueryContexts) -> int | None:
    """Rows every resolved query may return, or ``None`` if any is unbounded."""
    total = 0
    for query_context in query_contexts.values():
        if query_context is None:
            # Skipped charts do not add to the row budget.
            continue
        for query in query_context["queries"]:
            row_limit = _finite_row_limit(query)
            if row_limit is None:
                return None
            total += row_limit
    return total


def plan_inline_export(dashboard: Any) -> InlineExportPlan:
    """Resolve a dashboard's queries and calculate its direct-download size."""
    query_contexts: ResolvedQueryContexts = {
        chart.id: resolve_query_context(chart)
        for chart in get_charts_in_layout_order(dashboard)
    }
    return InlineExportPlan(
        query_contexts=query_contexts,
        requested_rows=_row_total(query_contexts),
        max_rows=current_app.config["EXCEL_EXPORT_SYNC_MAX_ROWS"],
    )
