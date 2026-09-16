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

In ``"data"`` mode the task re-runs each chart's saved query context under the
requesting user, applies the live dashboard filter state, and streams the results
row-by-row into a constant-memory workbook so large dashboards never load all
data at once. In ``"images"`` mode non-table charts are instead rendered to
images (through the same headless path as scheduled reports, reflecting the live
filters) and embedded, while table-like charts stay tabular.
"""

from __future__ import annotations

import copy
import logging
import os
import tempfile
from datetime import datetime, timedelta, timezone
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
from superset.commands.distributed_lock.release import ReleaseDistributedLock
from superset.common.chart_data import ChartDataResultFormat, ChartDataResultType
from superset.common.form_data_query_context import (
    build_query_context_from_form_data,
    is_raw_query_mode,
)
from superset.dashboards.excel_export import email
from superset.dashboards.excel_export.layout import get_charts_in_layout_order
from superset.dashboards.excel_export.screenshot import render_chart_image
from superset.extensions import celery_app
from superset.utils import json, s3
from superset.utils.core import override_user
from superset.utils.excel_streaming import StreamingXlsxWriter

logger = logging.getLogger(__name__)

# Export modes: "data" streams every chart's tabular result (the default,
# unchanged behavior); "images" embeds non-table charts as rendered images and
# keeps only table-like charts tabular.
EXPORT_MODE_DATA = "data"
EXPORT_MODE_IMAGES = "images"

# Viz types kept as tabular data in image mode; everything else is rendered as an
# image. Operators can override the set via ``EXCEL_EXPORT_TABLE_VIZ_TYPES``.
TABLE_VIZ_TYPES = {"table", "pivot_table_v2", "pivot_table"}

# Viz types whose missing query context may be rebuilt from saved form data.
# Conservative: only charts whose data maps faithfully to a single plain query
# (no post-processing, no multi-query fan-out). Every other viz type without a
# saved query context is skipped and listed for the user to re-save in Explore.
REBUILD_VIZ_TYPES = {"table", "big_number_total", "big_number", "pie"}

EXPORT_SOFT_TIME_LIMIT = 600
EXPORT_HARD_TIME_LIMIT = 660

# Namespace + TTL for the per-user+dashboard in-flight lock the API acquires
# before enqueue and this task releases when it settles. The lock uses the
# shared, atomic DistributedLock backend (Redis when configured, the metadata
# DB otherwise) so it actually synchronizes across the web server and workers —
# unlike a plain cache, which is a no-op under the default ``NullCache``.
# The TTL outlives the hard time limit so a worker killed at that limit (which
# skips the ``finally`` release) cannot hold the lock forever; the release in
# ``finally`` is the fast path that frees it as soon as the task settles.
EXPORT_LOCK_NAMESPACE = "excel_export"
EXPORT_LOCK_TTL_SECONDS = EXPORT_HARD_TIME_LIMIT + 60


def export_lock_params(user_id: int, dashboard_id: int) -> dict[str, int]:
    """Key parameters identifying the per-user+dashboard in-flight lock."""
    return {"user_id": user_id, "dashboard_id": dashboard_id}


class _ChartSkippedError(Exception):
    """Signals a chart that could not be exported and should be listed as skipped."""


def _chart_label(chart: Any) -> str:
    """Human-readable label for a chart in the skipped-charts list."""
    return f"{chart.id} - {chart.slice_name or ''}".strip()


def _usable_query_context(value: Any) -> dict[str, Any] | None:
    """
    ``value`` when it is a usable query-context payload, else ``None``.

    A payload is usable only if it is a dict with a non-empty ``queries`` list; a
    blank, query-less, mistyped, or non-object value (e.g. ``{}``,
    ``{"queries": []}``, ``{"queries": "oops"}``, ``None``) is treated the same as
    a missing context. Shared by the saved-context path and the builder hook so
    both apply the same validity rule — and so a malformed builder return falls
    through to the built-in rebuild instead of failing later in the general
    error bucket.
    """
    if not isinstance(value, dict) or not isinstance(value.get("queries"), list):
        return None
    return value if value["queries"] else None


def _saved_query_context(raw: Any) -> dict[str, Any] | None:
    """
    The chart's saved query context parsed to a dict, or ``None`` when it is
    missing or unusable.

    Returns ``None`` for a blank value, a string that does not parse as JSON, and
    any value that is not a dict with a non-empty ``queries`` list.
    """
    if not raw:
        return None
    try:
        parsed = json.loads(raw)
    except (TypeError, ValueError):
        return None
    return _usable_query_context(parsed)


# Form-data keys whose behavior needs plugin post-processing or extra queries
# (contribution/time comparison, rolling window, resampling, raw big-number
# aggregation) that the single-query rebuild cannot reproduce. A chart using any
# of these is skipped rather than exported with values that differ from the chart.
_UNSUPPORTED_PROCESSING_KEYS = ("time_compare", "rolling_type", "resample_rule")


def _needs_unsupported_processing(form_data: dict[str, Any]) -> bool:
    """Whether the form data relies on processing the rebuild can't reproduce."""
    # ``percent_metrics`` are "% of total" columns produced by contribution
    # post-processing the rebuild can't apply; skip so the export doesn't silently
    # omit columns the user sees.
    if form_data.get("percent_metrics"):
        return True
    # ``show_totals`` adds a totals row via a *second* query
    # (``plugin-chart-table/src/buildQuery.ts``, gated on aggregate mode); the
    # single-query rebuild would silently drop that row. The mode check mirrors
    # the frontend so a raw-mode table carrying a stale value still exports.
    if form_data.get("show_totals") and not is_raw_query_mode(form_data):
        return True
    for key in _UNSUPPORTED_PROCESSING_KEYS:
        value = form_data.get(key)
        # ``rolling_type`` is often the literal string ``"None"`` when unset.
        if value and value != "None":
            return True
    return form_data.get("aggregation") == "raw"


def _resolve_query_context(chart: Any) -> dict[str, Any] | None:
    """
    The query-context payload to run for a chart's data export, or ``None`` when
    none can be obtained.

    Resolution order:

    1. the chart's saved ``query_context``;
    2. an optional ``EXCEL_EXPORT_QUERY_CONTEXT_BUILDER`` hook, letting a deployment
       supply a faithful context (e.g. from a service running the chart's real
       frontend ``buildQuery``) for viz types the built-in rebuild can't handle;
    3. the built-in form-data rebuild, restricted to viz types whose data maps
       faithfully to a single plain query (``REBUILD_VIZ_TYPES``) without
       post-processing or extra queries.

    Returns ``None`` when none apply, so the caller lists the chart for re-saving
    rather than exporting inaccurate data.
    """
    if saved := _saved_query_context(chart.query_context):
        return saved

    # The hook receives the chart's form data and must return ``None`` — not a
    # partial/stub context — whenever it can't build the chart faithfully, so we
    # fall through to the built-in rebuild (which handles the allowlisted viz types
    # well). A hook failure falls through too, preserving "builder problem →
    # rebuild, don't fail the export" — the one exception being a task-level
    # timeout, which has to abort the whole export rather than this chart.
    if builder := current_app.config.get("EXCEL_EXPORT_QUERY_CONTEXT_BUILDER"):
        try:
            built = builder(chart.form_data)
        except SoftTimeLimitExceeded:
            # A soft timeout is a task-level signal, not a builder failure: let it
            # propagate to _build_workbook so the export aborts cleanly instead of
            # continuing on to rebuild this chart and start the next one.
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
            # Copy: the payload's ``queries`` are mutated in place downstream (by
            # ``apply_dashboard_filter_context``), and a builder is free to
            # memoize or otherwise share its return value — which would then
            # accumulate filters across charts and across exports.
            return copy.deepcopy(from_builder)

    # The allowlist and ``_needs_unsupported_processing`` bound only the built-in
    # rebuild below; the builder hook above is intentionally not gated by them (a
    # faithful builder includes the post-processing the built-in rebuild lacks).
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


def _renders_as_image(chart: Any, mode: str) -> bool:
    """Whether this chart is embedded as an image rather than streamed as data."""
    return mode == EXPORT_MODE_IMAGES and chart.viz_type not in _table_viz_types()


def _write_chart_image_sheet(
    writer: StreamingXlsxWriter,
    chart: Any,
    dashboard_id: int,
    active_data_mask: dict[str, Any],
    user: Any,
) -> None:
    """
    Render a single chart to an image and embed it as its own sheet.

    :raises _ChartSkippedError: if the chart could not be rendered
    """
    image = render_chart_image(chart, dashboard_id, active_data_mask, user)
    if image is None:
        raise _ChartSkippedError
    writer.add_image_sheet(_chart_label(chart), image)


def _write_chart_sheets(
    writer: StreamingXlsxWriter,
    chart: Any,
    json_body: dict[str, Any],
    dashboard_id: int,
    active_data_mask: dict[str, Any],
) -> None:
    """
    Run a single chart's query and stream its result(s) into the workbook.

    ``json_body`` is the resolved query-context payload (the chart's saved
    context or one synthesized from its form data). Charts may yield more than
    one query (e.g. mixed-series charts); each becomes its own sheet. Raises if
    the chart cannot be exported, so the caller can skip it and note it in the
    email.
    """
    # Shallow-copy before setting our own top-level keys so the caller's payload
    # keeps its original result_format/result_type. (The nested ``queries`` are
    # mutated in place by apply_dashboard_filter_context below, which is safe
    # because every payload ``_resolve_query_context`` returns is this chart's
    # alone: freshly parsed, freshly built, or deep-copied from the builder hook.)
    json_body = dict(json_body)
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
    mode: str,
    user: Any,
) -> dict[str, list[str]]:
    """Build the workbook on disk.

    Return the charts that could not be exported, grouped by the reason they
    were omitted (see the ``email.ERROR_*`` reason keys), so the notification
    can explain each group separately.
    """
    errored: dict[str, list[str]] = {}
    writer = StreamingXlsxWriter(path)
    try:
        for chart in get_charts_in_layout_order(dashboard):
            label = _chart_label(chart)
            try:
                if _renders_as_image(chart, mode):
                    # Image charts render from their saved params via the
                    # webdriver and don't need a query context.
                    _write_chart_image_sheet(
                        writer, chart, dashboard.id, active_data_mask, user
                    )
                else:
                    # Data charts need a query context: use the saved one, or
                    # rebuild it from form data for eligible viz types. Skip
                    # cleanly when none is available rather than failing.
                    json_body = _resolve_query_context(chart)
                    if json_body is None:
                        errored.setdefault(email.ERROR_NO_QUERY_CONTEXT, []).append(
                            label
                        )
                        continue
                    _write_chart_sheets(
                        writer, chart, json_body, dashboard.id, active_data_mask
                    )
            except SoftTimeLimitExceeded:
                # A soft timeout is a task-level signal, not a per-chart failure:
                # let it propagate so the outer handler emails a failure and runs
                # cleanup, rather than continuing until the hard limit kills the
                # worker (which would skip cleanup, leak temp files, and hold the
                # in-flight lock until its TTL). ``except Exception`` below would
                # otherwise swallow it, since it subclasses ``Exception``.
                raise
            except _ChartSkippedError:
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

        if writer.sheet_count == 0:
            flat = [label for labels in errored.values() for label in labels]
            writer.add_summary_sheet(
                "Export Summary",
                ["No chart data could be exported.", *flat],
            )
    finally:
        writer.close()
    return errored


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
    soft_time_limit=EXPORT_SOFT_TIME_LIMIT,
    time_limit=EXPORT_HARD_TIME_LIMIT,
    max_retries=0,
)
def export_dashboard_excel(
    self: Any,  # pylint: disable=unused-argument
    dashboard_id: int,
    user_id: int,
    active_data_mask: dict[str, Any],
    job_id: str,
    mode: str = EXPORT_MODE_DATA,
) -> None:
    """
    Export a dashboard's charts to an ``.xlsx`` and email a download link.

    :param dashboard_id: The dashboard to export
    :param user_id: The requesting user (the task runs with their permissions)
    :param active_data_mask: Live dashboard filter state keyed by native filter id
    :param job_id: Correlation id, also the Celery task id and S3 object name
    :param mode: ``"data"`` streams every chart's tabular result; ``"images"``
        embeds non-table charts as rendered images and keeps tables tabular
    """
    # pylint: disable=import-outside-toplevel
    from superset.models.dashboard import Dashboard

    requested_at = datetime.now(tz=timezone.utc)
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

            errored = _build_workbook(
                tmp_path, dashboard, active_data_mask, job_id, mode, user
            )

            bucket = current_app.config["EXCEL_EXPORT_S3_BUCKET"]
            key = (
                f"{current_app.config['EXCEL_EXPORT_S3_KEY_PREFIX']}"
                f"{dashboard_id}/{job_id}.xlsx"
            )
            ttl = current_app.config["EXCEL_EXPORT_LINK_TTL_SECONDS"]

            s3.upload_file_to_s3(tmp_path, bucket, key)
            download_url = s3.generate_presigned_url(bucket, key, ttl)
            expires_at = datetime.now(tz=timezone.utc) + timedelta(seconds=ttl)

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
                            errored=errored,
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
        try:
            ReleaseDistributedLock(
                EXPORT_LOCK_NAMESPACE,
                export_lock_params(user_id, dashboard_id),
            ).run()
        except Exception:  # pylint: disable=broad-except
            # Best-effort: the lock's TTL is the backstop if this fails.
            logger.exception(
                "Failed to release in-flight export lock for user %s dashboard %s",
                user_id,
                dashboard_id,
            )
        if tmp_path and os.path.exists(tmp_path):
            os.remove(tmp_path)
