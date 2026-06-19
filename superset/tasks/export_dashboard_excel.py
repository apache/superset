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
Celery task that exports every chart on a dashboard to a single multi-sheet
``.xlsx`` file, uploads it to S3, and emails the requesting user a pre-signed
download link.

The task re-runs each chart's saved query context under the requesting user,
applies the live dashboard filter state, and streams the results row-by-row into
a constant-memory workbook so large dashboards never load all data at once.
"""

from __future__ import annotations

import logging
import os
import tempfile
from datetime import datetime, timedelta
from typing import Any

from celery.exceptions import SoftTimeLimitExceeded
from flask import current_app, g

from superset import db, security_manager
from superset.charts.data.dashboard_filter_context import (
    apply_dashboard_filter_context,
    get_dashboard_filter_context,
)
from superset.charts.schemas import ChartDataQueryContextSchema
from superset.commands.chart.data.get_data_command import ChartDataCommand
from superset.common.chart_data import ChartDataResultFormat, ChartDataResultType
from superset.dashboards.excel_export import email
from superset.dashboards.excel_export.layout import get_charts_in_layout_order
from superset.extensions import celery_app
from superset.utils import json, s3
from superset.utils.core import override_user
from superset.utils.excel_streaming import StreamingXlsxWriter

logger = logging.getLogger(__name__)


def _chart_label(chart: Any) -> str:
    """Human-readable label for a chart in the skipped-charts list."""
    return f"{chart.id} - {chart.slice_name or ''}".strip()


def _record_to_row(record: dict[str, Any], colnames: list[str]) -> list[Any]:
    return [record.get(col) for col in colnames]


def _write_chart_sheets(
    writer: StreamingXlsxWriter,
    chart: Any,
    dashboard_id: int,
    active_data_mask: dict[str, Any],
) -> None:
    """
    Run a single chart's query and stream its result(s) into the workbook.

    Charts may yield more than one query (e.g. mixed-series charts); each becomes
    its own sheet. Raises if the chart cannot be exported, so the caller can skip
    it and note it in the email.
    """
    json_body = json.loads(chart.query_context)
    # Override any stale saved values: we always want full JSON results.
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

    # Jinja macros resolve form data from g.form_data; expose the saved context.
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


def _build_workbook(
    path: str,
    dashboard: Any,
    active_data_mask: dict[str, Any],
    job_id: str,
) -> list[str]:
    """Build the workbook on disk; return the list of skipped chart labels."""
    skipped: list[str] = []
    writer = StreamingXlsxWriter(path)
    try:
        for chart in get_charts_in_layout_order(dashboard):
            if not chart.query_context:
                skipped.append(_chart_label(chart))
                continue
            try:
                _write_chart_sheets(writer, chart, dashboard.id, active_data_mask)
            except Exception:  # pylint: disable=broad-except
                logger.exception(
                    "Skipping chart %s in dashboard export %s", chart.id, job_id
                )
                skipped.append(_chart_label(chart))

        if writer.sheet_count == 0:
            writer.add_summary_sheet(
                "Export Summary",
                ["No chart data could be exported.", *skipped],
            )
    finally:
        writer.close()
    return skipped


def _send_failure_email(
    user: Any, dashboard_title: str, requested_at: datetime
) -> None:
    if not (user and getattr(user, "email", None)):
        return
    try:
        email.send_export_email(
            user.email,
            email.build_subject(dashboard_title, success=False),
            email.build_failure_email(dashboard_title, requested_at),
        )
    except Exception:  # pylint: disable=broad-except
        logger.exception("Failed to send export failure email")


@celery_app.task(
    name="export_dashboard_excel",
    bind=True,
    soft_time_limit=600,
    time_limit=660,
    max_retries=0,
)
def export_dashboard_excel(
    self: Any,  # pylint: disable=unused-argument
    dashboard_id: int,
    user_id: int,
    active_data_mask: dict[str, Any],
    job_id: str,
) -> None:
    """
    Export a dashboard's chart data to an ``.xlsx`` and email a download link.

    :param dashboard_id: The dashboard to export
    :param user_id: The requesting user (the task runs with their permissions)
    :param active_data_mask: Live dashboard filter state keyed by native filter id
    :param job_id: Correlation id, also the Celery task id and S3 object name
    """
    # pylint: disable=import-outside-toplevel
    from superset.models.dashboard import Dashboard

    requested_at = datetime.utcnow()
    user = security_manager.get_user_by_id(user_id)
    dashboard_title = ""
    tmp_path: str | None = None

    try:
        with override_user(user, force=False):
            dashboard = (
                db.session.query(Dashboard).filter_by(id=dashboard_id).one_or_none()
            )
            if dashboard is None:
                raise ValueError(f"Dashboard {dashboard_id} not found")
            dashboard_title = dashboard.dashboard_title or f"Dashboard {dashboard_id}"

            file_descriptor, tmp_path = tempfile.mkstemp(
                suffix=".xlsx", prefix=f"dash-export-{job_id}-"
            )
            os.close(file_descriptor)

            skipped = _build_workbook(tmp_path, dashboard, active_data_mask, job_id)

            bucket = current_app.config["EXCEL_EXPORT_S3_BUCKET"]
            key = (
                f"{current_app.config['EXCEL_EXPORT_S3_KEY_PREFIX']}"
                f"{dashboard_id}/{job_id}.xlsx"
            )
            ttl = current_app.config["EXCEL_EXPORT_LINK_TTL_SECONDS"]

            s3.upload_file_to_s3(tmp_path, bucket, key)
            download_url = s3.generate_presigned_url(bucket, key, ttl)
            expires_at = datetime.utcnow() + timedelta(seconds=ttl)

            if user and getattr(user, "email", None):
                try:
                    email.send_export_email(
                        user.email,
                        email.build_subject(dashboard_title, success=True),
                        email.build_success_email(
                            dashboard_title=dashboard_title,
                            download_url=download_url,
                            requested_at=requested_at,
                            expires_at=expires_at,
                            ttl_seconds=ttl,
                            skipped_charts=skipped,
                        ),
                    )
                except Exception:  # pylint: disable=broad-except
                    # The file is already in S3; a send failure should not trigger
                    # a misleading failure email.
                    logger.exception("Failed to send export success email")
    except SoftTimeLimitExceeded:
        logger.warning("Dashboard excel export %s timed out", job_id)
        _send_failure_email(user, dashboard_title, requested_at)
        raise
    except Exception:
        logger.exception("Dashboard excel export %s failed", job_id)
        _send_failure_email(user, dashboard_title, requested_at)
        raise
    finally:
        if tmp_path and os.path.exists(tmp_path):
            os.remove(tmp_path)
