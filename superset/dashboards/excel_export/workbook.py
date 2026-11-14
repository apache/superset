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

import logging
from typing import Any

from celery.exceptions import SoftTimeLimitExceeded
from flask import current_app
from superset_core.exports.types import ChartQueryResult

from superset.dashboards.excel_export import email
from superset.dashboards.excel_export.chart_results import (  # noqa: F401
    chart_result,
    MISSING,
    REBUILD_VIZ_TYPES,
    resolve_query_context,
)
from superset.dashboards.excel_export.layout import get_charts_in_layout_order
from superset.dashboards.excel_export.screenshot import render_chart_image
from superset.utils.excel_streaming import StreamingXlsxWriter

logger = logging.getLogger(__name__)

# Data mode writes chart results; image mode renders non-table charts.
EXPORT_MODE_DATA = "data"
EXPORT_MODE_IMAGES = "images"

# Viz types that remain tabular in image mode.
TABLE_VIZ_TYPES = {"table", "pivot_table_v2", "pivot_table"}

#: Resolved query contexts by chart id. ``None`` marks a skipped chart.
ResolvedQueryContexts = dict[int, dict[str, Any] | None]


class ChartSkippedError(Exception):
    """Raised when a chart should be listed as skipped."""


def chart_label(chart: Any) -> str:
    """Return the chart label used in the export summary."""
    return f"{chart.id} - {chart.slice_name or ''}".strip()


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


def _write_query_sheets(
    writer: StreamingXlsxWriter, chart: Any, queries: list[ChartQueryResult]
) -> None:
    """Write each query result of a chart to its own worksheet."""
    for index, query in enumerate(queries):
        if index == 0:
            name = f"{chart.id} - {chart.slice_name or ''}"
        else:
            name = f"{chart.id}.{index} - {chart.slice_name or ''}"
        writer.add_sheet(
            name,
            query.colnames,
            (_record_to_row(record, query.colnames) for record in query.data),
        )


def build_workbook(  # pylint: disable=too-many-arguments
    path: str,
    dashboard: Any,
    active_data_mask: dict[str, Any],
    job_id: str,
    mode: str,
    user: Any,
    query_contexts: ResolvedQueryContexts | None = None,
    skipped_charts: dict[int, str] | None = None,
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
    :param skipped_charts: Charts to list as omitted without running them,
        mapped to their ``email.ERROR_*`` reason
    """
    errored: dict[str, list[str]] = {}
    resolved = query_contexts or {}
    skipped = skipped_charts or {}
    writer = StreamingXlsxWriter(path)
    try:
        for chart in get_charts_in_layout_order(dashboard):
            label = chart_label(chart)
            if (reason := skipped.get(chart.id)) is not None:
                errored.setdefault(reason, []).append(label)
                continue
            try:
                if renders_as_image(chart, mode):
                    # Image charts do not need a query context.
                    _write_chart_image_sheet(
                        writer, chart, dashboard.id, active_data_mask, user
                    )
                else:
                    # Reuse a planned context or resolve one in chart_result.
                    result = chart_result(
                        chart,
                        dashboard.id,
                        active_data_mask,
                        resolved.get(chart.id, MISSING),
                    )
                    if result.skipped_reason is not None:
                        errored.setdefault(result.skipped_reason.value, []).append(
                            label
                        )
                        continue
                    _write_query_sheets(writer, chart, result.queries)
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

        # The workbook itself carries the skipped-charts list: direct downloads
        # and sessions with no email (guests, Public role) have no other way to
        # learn that part of the requested workbook was omitted.
        if writer.sheet_count == 0 or errored:
            lines = [
                "No chart data could be exported."
                if writer.sheet_count == 0
                else "Charts that could not be exported:"
            ]
            # Same per-reason notes as the email; some sessions only see this sheet.
            for note, labels in email.errored_groups(errored):
                lines.extend(["", str(note), *labels])
            writer.add_summary_sheet("Export Summary", lines)
    finally:
        writer.close()
    return errored
