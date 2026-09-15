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
"""Build dashboard Excel workbooks for direct and queued exports."""

from __future__ import annotations

import copy
import logging
from typing import Any

from celery.exceptions import SoftTimeLimitExceeded
from flask import current_app, g

from superset.charts.data.dashboard_filter_context import (
    apply_dashboard_filter_context,
    get_dashboard_filter_context,
)
from superset.charts.schemas import ChartDataQueryContextSchema
from superset.commands.chart.data.get_data_command import ChartDataCommand
from superset.common.chart_data import ChartDataResultFormat, ChartDataResultType
from superset.common.form_data_query_context import (
    build_query_context_from_form_data,
    is_raw_query_mode,
)
from superset.dashboards.excel_export import email
from superset.dashboards.excel_export.layout import get_charts_in_layout_order
from superset.dashboards.excel_export.screenshot import render_chart_image
from superset.utils import json
from superset.utils.excel_streaming import StreamingXlsxWriter

logger = logging.getLogger(__name__)

# Data mode writes chart results; image mode renders non-table charts.
EXPORT_MODE_DATA = "data"
EXPORT_MODE_IMAGES = "images"

# Viz types that remain tabular in image mode.
TABLE_VIZ_TYPES = {"table", "pivot_table_v2", "pivot_table"}

# Viz types that can be rebuilt as a single query without post-processing.
REBUILD_VIZ_TYPES = {"table", "big_number_total", "big_number", "pie"}

#: Resolved query contexts by chart id. ``None`` marks a skipped chart.
ResolvedQueryContexts = dict[int, dict[str, Any] | None]


class ChartSkippedError(Exception):
    """Raised when a chart should be listed as skipped."""


def chart_label(chart: Any) -> str:
    """Return the chart label used in the export summary."""
    return f"{chart.id} - {chart.slice_name or ''}".strip()


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


def resolve_query_context(chart: Any) -> dict[str, Any] | None:
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
        form_data,
        {"id": chart.datasource_id, "type": chart.datasource_type or "table"},
        chart.viz_type,
    )


def _record_to_row(record: dict[str, Any], colnames: list[str]) -> list[Any]:
    return [record.get(col) for col in colnames]


def _table_viz_types() -> set[str]:
    """Viz types kept tabular in image mode (config override or built-in default)."""
    return current_app.config.get("EXCEL_EXPORT_TABLE_VIZ_TYPES") or TABLE_VIZ_TYPES


def renders_as_image(chart: Any, mode: str) -> bool:
    """Return whether the chart is exported as an image."""
    return mode == EXPORT_MODE_IMAGES and chart.viz_type not in _table_viz_types()


def _write_chart_image_sheet(
    writer: StreamingXlsxWriter,
    chart: Any,
    dashboard_id: int,
    active_data_mask: dict[str, Any],
    user: Any,
) -> None:
    """Render a chart into a worksheet.

    :raises ChartSkippedError: if rendering fails
    """
    image = render_chart_image(chart, dashboard_id, active_data_mask, user)
    if image is None:
        raise ChartSkippedError
    writer.add_image_sheet(chart_label(chart), image)


def _write_chart_sheets(
    writer: StreamingXlsxWriter,
    chart: Any,
    json_body: dict[str, Any],
    dashboard_id: int,
    active_data_mask: dict[str, Any],
) -> None:
    """Run a chart's queries and write each result to a worksheet."""
    # Preserve the caller's top-level query-context values.
    json_body = dict(json_body)
    # Export full JSON results, regardless of saved values.
    json_body["result_format"] = ChartDataResultFormat.JSON
    json_body["result_type"] = ChartDataResultType.FULL
    json_body.pop("force", None)

    filter_context = get_dashboard_filter_context(
        dashboard_id=dashboard_id,
        chart_id=chart.id,
        active_data_mask=active_data_mask,
    )
    if filter_context.extra_form_data:
        apply_dashboard_filter_context(json_body, filter_context.extra_form_data)

    # Jinja macros read the query context from ``g.form_data``.
    g.form_data = json_body

    query_context = ChartDataQueryContextSchema().load(json_body)
    command = ChartDataCommand(query_context)
    command.validate()
    result = command.run()

    for index, query in enumerate(result["queries"]):
        colnames = query.get("colnames") or []
        data = query.get("data") or []
        if index == 0:
            name = f"{chart.id} - {chart.slice_name or ''}"
        else:
            name = f"{chart.id}.{index} - {chart.slice_name or ''}"
        writer.add_sheet(
            name,
            colnames,
            (_record_to_row(record, colnames) for record in data),
        )


def build_workbook(  # pylint: disable=too-many-arguments
    path: str,
    dashboard: Any,
    active_data_mask: dict[str, Any],
    job_id: str,
    mode: str,
    user: Any,
    query_contexts: ResolvedQueryContexts | None = None,
) -> dict[str, list[str]]:
    """Build the workbook on disk.

    Return skipped charts grouped by ``email.ERROR_*`` reason.

    :param path: Destination path for the ``.xlsx`` file
    :param dashboard: The dashboard whose charts to export
    :param active_data_mask: Live dashboard filter state keyed by native filter id
    :param job_id: Correlation id used in log lines
    :param mode: ``"data"`` or ``"images"``
    :param user: The requesting user (used to render images)
    :param query_contexts: Pre-resolved contexts. Missing charts are resolved here.
    """
    errored: dict[str, list[str]] = {}
    resolved = query_contexts or {}
    writer = StreamingXlsxWriter(path)
    try:
        for chart in get_charts_in_layout_order(dashboard):
            label = chart_label(chart)
            try:
                if renders_as_image(chart, mode):
                    # Image charts do not need a query context.
                    _write_chart_image_sheet(
                        writer, chart, dashboard.id, active_data_mask, user
                    )
                else:
                    # Reuse a planned context or resolve one here.
                    json_body = (
                        resolved[chart.id]
                        if chart.id in resolved
                        else resolve_query_context(chart)
                    )
                    if json_body is None:
                        errored.setdefault(email.ERROR_NO_QUERY_CONTEXT, []).append(
                            label
                        )
                        continue
                    _write_chart_sheets(
                        writer, chart, json_body, dashboard.id, active_data_mask
                    )
            except SoftTimeLimitExceeded:
                # Let the task handler report the timeout and clean up.
                raise
            except ChartSkippedError:
                logger.warning(
                    "Skipping chart %s in dashboard export %s (could not render)",
                    chart.id,
                    job_id,
                )
                errored.setdefault(email.ERROR_GENERAL, []).append(label)
            except Exception:  # pylint: disable=broad-except
                logger.exception(
                    "Skipping chart %s in dashboard export %s", chart.id, job_id
                )
                errored.setdefault(email.ERROR_GENERAL, []).append(label)

        # Include skipped charts in the workbook for both delivery paths.
        if writer.sheet_count == 0 or errored:
            flat = [label for labels in errored.values() for label in labels]
            header = (
                "No chart data could be exported."
                if writer.sheet_count == 0
                else "Charts that could not be exported:"
            )
            writer.add_summary_sheet("Export Summary", [header, *flat])
    finally:
        writer.close()
    return errored
