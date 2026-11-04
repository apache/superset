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
"""Resolve, prepare and run one dashboard chart's export queries.

Excel workbooks and the ``superset_core.exports`` extension API share these steps,
so both list the same charts as skipped for the same reasons.
"""

from __future__ import annotations

import copy
import logging
from collections.abc import Iterator
from typing import Any, cast, Final, TYPE_CHECKING

from celery.exceptions import SoftTimeLimitExceeded
from flask import current_app
from superset_core.exports.types import ChartResult, SkipReason

from superset.charts.data.dashboard_filter_context import (
    apply_dashboard_filter_context,
    get_dashboard_filter_context,
)
from superset.charts.data.run_query_context import run_query_context
from superset.common.chart_data import ChartDataResultFormat, ChartDataResultType
from superset.common.form_data_query_context import (
    build_query_context_from_form_data,
    is_raw_query_mode,
)
from superset.daos.dashboard import DashboardDAO
from superset.dashboards.excel_export.layout import get_charts_in_layout_order
from superset.utils import json

if TYPE_CHECKING:
    from superset.models.slice import Slice

logger = logging.getLogger(__name__)

# Viz types that can be rebuilt as a single query without post-processing.
REBUILD_VIZ_TYPES = {"table", "big_number_total", "big_number", "pie"}

# Default for ``chart_result``'s ``query_context``: resolve it from the chart.
MISSING: Final = object()


def _usable_query_context(value: Any) -> dict[str, Any] | None:
    """Return a query context with a non-empty ``queries`` list."""
    if not isinstance(value, dict) or not isinstance(value.get("queries"), list):
        return None
    return value if value["queries"] else None


def _saved_query_context(raw: Any) -> dict[str, Any] | None:
    """Parse a saved query context, returning ``None`` if it is unusable."""
    if not raw:
        return None
    try:
        parsed = json.loads(raw)
    except (TypeError, ValueError):
        return None
    return _usable_query_context(parsed)


# Form-data features the single-query rebuild cannot reproduce.
_UNSUPPORTED_PROCESSING_KEYS = ("time_compare", "rolling_type", "resample_rule")


def _needs_unsupported_processing(form_data: dict[str, Any]) -> bool:
    """Return whether the chart needs unsupported post-processing."""
    # ``percent_metrics`` are produced by contribution post-processing.
    if form_data.get("percent_metrics"):
        return True
    # Aggregate table totals require a second query.
    if form_data.get("show_totals") and not is_raw_query_mode(form_data):
        return True
    for key in _UNSUPPORTED_PROCESSING_KEYS:
        value = form_data.get(key)
        # ``rolling_type`` may contain the string ``"None"`` when unset.
        if value and value != "None":
            return True
    return form_data.get("aggregation") == "raw"


def _export_form_data(form_data: dict[str, Any], viz_type: str) -> dict[str, Any]:
    """Remove interactive table pagination before export planning and execution."""
    if viz_type == "table":
        # Direct downloads must budget the full-limit query that the workbook
        # executes, without a pagination-only rowcount query or page offset.
        return {**form_data, "server_pagination": False, "row_offset": 0}
    return form_data


def resolve_query_context(chart: Slice) -> dict[str, Any] | None:
    """Resolve a saved, custom-built, or built-in query context for a chart."""
    if saved := _saved_query_context(chart.query_context):
        return saved

    # Builder failures fall back to the built-in query-context rebuild.
    if builder := current_app.config.get("EXCEL_EXPORT_QUERY_CONTEXT_BUILDER"):
        try:
            built = builder(chart.form_data)
        except SoftTimeLimitExceeded:
            # A task timeout must stop the whole export.
            raise
        except Exception:  # pylint: disable=broad-except
            logger.warning(
                "EXCEL_EXPORT_QUERY_CONTEXT_BUILDER failed for chart %s; "
                "falling back to the built-in rebuild",
                chart.id,
                exc_info=True,
            )
            built = None
        if (from_builder := _usable_query_context(built)) is not None:
            # Filters mutate nested queries, so do not modify a shared payload.
            return copy.deepcopy(from_builder)

    # Only the built-in rebuild is limited to simple chart types.
    if chart.viz_type not in REBUILD_VIZ_TYPES or chart.datasource_id is None:
        return None
    try:
        form_data = json.loads(chart.params) if chart.params else {}
    except (TypeError, ValueError):
        return None
    if not isinstance(form_data, dict) or not form_data:
        return None
    if _needs_unsupported_processing(form_data):
        return None

    return build_query_context_from_form_data(
        _export_form_data(form_data, chart.viz_type),
        {"id": chart.datasource_id, "type": chart.datasource_type or "table"},
        chart.viz_type,
    )


def prepare_for_export(
    body: dict[str, Any],
    chart: Slice,
    dashboard_id: int,
    active_data_mask: dict[str, Any],
) -> dict[str, Any]:
    """Return a copy of ``body`` set up to export the chart's full results."""
    # Preserve the caller's top-level query-context values.
    json_body = dict(body)
    # Export full JSON results, regardless of saved values.
    json_body["result_format"] = ChartDataResultFormat.JSON
    json_body["result_type"] = ChartDataResultType.FULL
    json_body.pop("force", None)

    # Guest authorization links a chart to its dashboard through
    # ``form_data.dashboardId`` (raise_for_access); saved contexts don't carry
    # it, so stamp it the way the browser does on interactive requests.
    form_data = dict(json_body.get("form_data") or {})
    form_data["dashboardId"] = dashboard_id
    # ``Slice.form_data`` restamps ``slice_id`` on interactive requests, but a
    # saved context is replayed verbatim, so a chart copied with "Save as" can
    # carry the source chart's id and fail the guest payload check.
    form_data["slice_id"] = chart.id
    json_body["form_data"] = form_data

    filter_context = get_dashboard_filter_context(
        dashboard_id=dashboard_id,
        chart_id=chart.id,
        active_data_mask=active_data_mask,
    )
    if filter_context.extra_form_data:
        apply_dashboard_filter_context(json_body, filter_context.extra_form_data)

    return json_body


def chart_result(
    chart: Slice,
    dashboard_id: int,
    active_data_mask: dict[str, Any],
    query_context: dict[str, Any] | None | object = MISSING,
) -> ChartResult:
    """
    Run one chart's export queries, or report why the chart is skipped.

    :param query_context: A resolved context, ``None`` for a chart known to have
        none, or omitted to resolve it here
    :raises SoftTimeLimitExceeded: So a task timeout stops the whole export
    """
    name = chart.slice_name or ""
    try:
        body = (
            resolve_query_context(chart) if query_context is MISSING else query_context
        )
        if body is None:
            return ChartResult(chart.id, name, [], SkipReason.NO_QUERY_CONTEXT)
        payload = prepare_for_export(
            cast(dict[str, Any], body), chart, dashboard_id, active_data_mask
        )
        queries = run_query_context(payload)
    except SoftTimeLimitExceeded:
        raise
    except Exception:  # pylint: disable=broad-except
        logger.exception("Skipping chart %s in dashboard export", chart.id)
        return ChartResult(chart.id, name, [], SkipReason.GENERAL)
    return ChartResult(chart.id, name, queries, None)


def iter_dashboard_chart_results(
    dashboard_id: int, active_data_mask: dict[str, Any]
) -> Iterator[ChartResult]:
    """Yield each chart's result in layout order; nothing for a missing dashboard."""
    dashboard = DashboardDAO.find_by_id(dashboard_id)
    if dashboard is None:
        return
    for chart in get_charts_in_layout_order(dashboard):
        yield chart_result(chart, dashboard_id, active_data_mask)
