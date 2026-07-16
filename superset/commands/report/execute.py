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
import logging
import urllib.parse
import urllib.request
from collections.abc import Sequence
from contextlib import closing
from datetime import datetime, timedelta
from typing import Any, Optional, TYPE_CHECKING, Union
from urllib.error import URLError
from uuid import UUID

import pandas as pd
from celery.exceptions import SoftTimeLimitExceeded
from flask import current_app as app

from superset import db, security_manager
from superset.commands.base import BaseCommand
from superset.commands.dashboard.permalink.create import CreateDashboardPermalinkCommand
from superset.commands.exceptions import CommandException, UpdateFailedError
from superset.commands.report.alert import AlertCommand
from superset.commands.report.exceptions import (
    ReportScheduleAlertGracePeriodError,
    ReportScheduleClientErrorsException,
    ReportScheduleCsvFailedError,
    ReportScheduleCsvTimeout,
    ReportScheduleDataFrameFailedError,
    ReportScheduleDataFrameTimeout,
    ReportScheduleExecuteUnexpectedError,
    ReportScheduleExecutorNotFoundError,
    ReportScheduleNotFoundError,
    ReportSchedulePreviousWorkingError,
    ReportScheduleScreenshotFailedError,
    ReportScheduleScreenshotTimeout,
    ReportScheduleStateNotFoundError,
    ReportScheduleSystemErrorsException,
    ReportScheduleTargetChartDeletedError,
    ReportScheduleTargetDashboardDeletedError,
    ReportScheduleUnexpectedError,
    ReportScheduleWorkingTimeoutError,
    ReportScheduleXlsxFailedError,
    ReportScheduleXlsxTimeout,
)
from superset.common.chart_data import ChartDataResultFormat, ChartDataResultType
from superset.daos.report import (
    REPORT_SCHEDULE_ERROR_NOTIFICATION_MARKER,
    ReportScheduleDAO,
)
from superset.dashboards.permalink.types import DashboardPermalinkState
from superset.errors import ErrorLevel, SupersetError, SupersetErrorType
from superset.exceptions import SupersetErrorsException, SupersetException
from superset.extensions import feature_flag_manager, machine_auth_provider_factory
from superset.reports.models import (
    ReportDataFormat,
    ReportExecutionLog,
    ReportRecipients,
    ReportRecipientType,
    ReportSchedule,
    ReportScheduleType,
    ReportSourceFormat,
    ReportState,
)
from superset.reports.notifications import create_notification
from superset.reports.notifications.base import NotificationContent
from superset.reports.notifications.exceptions import (
    NotificationError,
    NotificationParamException,
    SlackV1NotificationError,
)
from superset.subjects.types import SubjectType
from superset.tasks.utils import get_executor
from superset.utils import json
from superset.utils.core import HeaderDataType, override_user, recipients_string_to_list
from superset.utils.csv import get_chart_csv_data, get_chart_dataframe
from superset.utils.decorators import logs_context, transaction
from superset.utils.file import sanitize_title
from superset.utils.pdf import build_pdf_from_screenshots
from superset.utils.screenshots import ChartScreenshot, DashboardScreenshot
from superset.utils.slack import get_channels_with_search, SlackChannelTypes
from superset.utils.urls import get_url_path

if TYPE_CHECKING:
    from flask_appbuilder.security.sqla.models import User

logger = logging.getLogger(__name__)


def resolve_executor_user(model: ReportSchedule) -> tuple["User", str]:
    """
    Resolve the executor user for a report schedule.

    Determines the configured executor username via ``get_executor`` and looks up
    the corresponding user. A deleted/disabled user or a misconfigured
    ``ALERT_REPORTS_EXECUTORS`` makes ``security_manager.find_user`` return
    ``None``; rather than passing ``None`` into the webdriver/auth flow (which
    fails with an opaque NoneType error), raise a dedicated, actionable error.

    :returns: the ``(user, username)`` pair — the username is returned alongside
        the user because several call sites log it after resolution.
    :raises ReportScheduleExecutorNotFoundError: if the executor user is missing.
    """
    _, username = get_executor(
        executors=app.config["ALERT_REPORTS_EXECUTORS"],
        model=model,
    )
    user = security_manager.find_user(username)
    if user is None:
        raise ReportScheduleExecutorNotFoundError(username)
    return user, username


class BaseReportState:
    current_states: list[ReportState] = []
    initial: bool = False

    @logs_context()
    def __init__(
        self,
        report_schedule: ReportSchedule,
        scheduled_dttm: datetime,
        execution_id: UUID,
    ) -> None:
        self._report_schedule = report_schedule
        self._scheduled_dttm = scheduled_dttm
        self._start_dttm = datetime.utcnow()
        self._execution_id = execution_id
        self._filter_warnings: list[str] = []

    def update_report_schedule_and_log(
        self,
        state: ReportState,
        error_message: Optional[str] = None,
    ) -> None:
        """
        Update the report schedule state et al. and reflect the change in the execution
        log.
        """
        self.update_report_schedule(state)
        self.create_log(error_message)

    def update_report_schedule(self, state: ReportState) -> None:
        """
        Update the report schedule state et al.

        When the report state is WORKING we must ensure that the values from the last
        execution run are cleared to ensure that they are not propagated to the
        execution log.
        """

        if state == ReportState.WORKING:
            self._report_schedule.last_value = None
            self._report_schedule.last_value_row_json = None

        self._report_schedule.last_state = state
        self._report_schedule.last_eval_dttm = datetime.utcnow()

    def update_report_schedule_slack_v2(self) -> None:
        """
        Update the report schedule type and channels for all slack recipients to v2.
        V2 uses ids instead of names for channels.

        Channel ids for every Slack recipient are resolved first and the
        recipients are only mutated once all of them resolve. This keeps the
        upgrade all-or-nothing: a single unresolvable channel can no longer
        leave the schedule with some recipients already switched to v2 (and
        persisted by a later error-log commit) while others are untouched.
        """
        resolved: list[tuple[ReportRecipients, str]] = []
        try:
            for recipient in self._report_schedule.recipients:
                if recipient.type != ReportRecipientType.SLACK:
                    continue
                slack_recipients = json.loads(recipient.recipient_config_json)
                # V1 method allowed to use leading `#` in the channel name
                channel_names = (slack_recipients["target"] or "").replace("#", "")
                # we need to ensure that existing reports can also fetch
                # ids from private channels
                channels = get_channels_with_search(
                    search_string=channel_names,
                    types=[
                        SlackChannelTypes.PRIVATE,
                        SlackChannelTypes.PUBLIC,
                    ],
                    exact_match=True,
                )
                channels_list = recipients_string_to_list(channel_names)
                if len(channels_list) != len(channels):
                    missing_channels = set(channels_list) - {
                        channel["name"] for channel in channels
                    }
                    msg = (
                        "Could not find the following channels: "
                        f"{', '.join(missing_channels)}"
                    )
                    raise UpdateFailedError(msg)
                channel_ids = ",".join(channel["id"] for channel in channels)
                resolved.append((recipient, json.dumps({"target": channel_ids})))
        except Exception as ex:
            # No recipient has been mutated yet, so there is no partial upgrade
            # to revert; surface the failure so the configuration can be fixed
            # manually.
            msg = f"Failed to update slack recipients to v2: {str(ex)}"
            logger.exception(msg)
            raise UpdateFailedError(msg) from ex

        # Every Slack recipient resolved; apply the upgrade atomically.
        for recipient, recipient_config_json in resolved:
            recipient.type = ReportRecipientType.SLACKV2
            recipient.recipient_config_json = recipient_config_json

    def create_log(self, error_message: Optional[str] = None) -> None:
        """
        Creates a Report execution log, uses the current computed last_value for Alerts
        """
        from sqlalchemy.orm.exc import StaleDataError

        try:
            log = ReportExecutionLog(
                scheduled_dttm=self._scheduled_dttm,
                start_dttm=self._start_dttm,
                end_dttm=datetime.utcnow(),
                value=self._report_schedule.last_value,
                value_row_json=self._report_schedule.last_value_row_json,
                state=self._report_schedule.last_state,
                error_message=error_message,
                report_schedule=self._report_schedule,
                uuid=self._execution_id,
            )
            db.session.add(log)
            db.session.commit()  # pylint: disable=consider-using-transaction
        except StaleDataError as ex:
            # Report schedule was modified or deleted by another process
            db.session.rollback()  # pylint: disable=consider-using-transaction
            logger.warning(
                "Report schedule (execution %s) was modified or deleted "
                "during execution. This can occur when a report is deleted "
                "while running.",
                self._execution_id,
            )
            raise ReportScheduleUnexpectedError(
                "Report schedule was modified or deleted by another process "
                "during execution"
            ) from ex

    def _get_url(
        self,
        user_friendly: bool = False,
        result_format: Optional[ChartDataResultFormat] = None,
        **kwargs: Any,
    ) -> str:
        """
        Get the url for this report schedule: chart or dashboard
        """
        chart = self._report_schedule.chart
        dashboard = self._report_schedule.dashboard

        # Soft delete removed the FK-level guarantee that a report's target
        # chart exists: ``chart`` is a visibility-filtered relationship, so a
        # chart soft-deleted after this report was created (or attached via a
        # validate/commit race with DeleteChartCommand) loads as ``None``
        # while ``chart_id`` is still set. Without this guard the branch
        # below silently falls through to the dashboard path and fails
        # opaquely; raising here surfaces a clear, actionable error inside
        # the state-machine envelope (ERROR log row + notification dispatch).
        # Every content path (_get_screenshots, _get_csv_data,
        # _get_embedded_data, _get_notification_content) funnels through this
        # method, so this is the single choke point.
        if chart is None and dashboard is None:
            if self._report_schedule.chart_id is not None:
                raise ReportScheduleTargetChartDeletedError()
            # Symmetric guard for dashboard targets. Dashboard soft delete lands
            # in the sibling rollout; until then this cannot fire (a dashboard
            # with dependent reports cannot be deleted), which makes it inert
            # rather than wrong — and it keeps the report-target error vocabulary
            # parallel across entities from day one.
            if self._report_schedule.dashboard_id is not None:
                raise ReportScheduleTargetDashboardDeletedError()
            # Defensive fallback for a malformed report with no target IDs.
            # Missing relationships with a target ID are handled by the
            # dedicated deleted-target errors above.
            raise ReportScheduleUnexpectedError(
                f"Report schedule {self._report_schedule.id} "
                f"({self._report_schedule.name!r}) has no resolvable target "
                f"(chart_id={self._report_schedule.chart_id}, "
                f"dashboard_id={self._report_schedule.dashboard_id}); "
                "the report has neither a chart nor a dashboard."
            )

        force = "true" if self._report_schedule.force_screenshot else "false"
        if chart:
            if result_format in {
                ChartDataResultFormat.CSV,
                ChartDataResultFormat.XLSX,
                ChartDataResultFormat.JSON,
            }:
                return get_url_path(
                    "ChartDataRestApi.get_data",
                    pk=self._report_schedule.chart_id,
                    format=result_format.value,
                    type=ChartDataResultType.POST_PROCESSED.value,
                    force=force,
                )
            return get_url_path(
                "ExploreView.root",
                user_friendly=user_friendly,
                form_data=json.dumps({"slice_id": self._report_schedule.chart_id}),
                force=force,
                **kwargs,
            )
        # If we need to render dashboard in a specific state, use stateful permalink
        if (
            dashboard_state := self._report_schedule.extra.get("dashboard")
        ) and feature_flag_manager.is_feature_enabled("ALERT_REPORT_TABS"):
            return self._get_tab_url(dashboard_state, user_friendly=user_friendly)

        dashboard_id_or_slug = (
            dashboard.uuid if dashboard.uuid is not None else dashboard.id
        )
        return get_url_path(
            "Superset.dashboard",
            user_friendly=user_friendly,
            dashboard_id_or_slug=dashboard_id_or_slug,
            force=force,
            **kwargs,
        )

    def get_dashboard_urls(
        self, user_friendly: bool = False, **kwargs: Any
    ) -> list[str]:
        """
        Retrieve the URL for the dashboard tabs, or return the dashboard URL if no tabs are available.
        """  # noqa: E501
        # Called directly from AsyncExecuteReportScheduleCommand.run (permalink
        # pre-commit) without passing through _get_url, so it needs the same
        # deleted-target guard.
        if (
            self._report_schedule.dashboard_id is not None
            and self._report_schedule.dashboard is None
        ):
            raise ReportScheduleTargetDashboardDeletedError()
        force = "true" if self._report_schedule.force_screenshot else "false"

        if (
            dashboard_state := self._report_schedule.extra.get("dashboard")
        ) and feature_flag_manager.is_feature_enabled("ALERT_REPORT_TABS"):
            native_filter_params, filter_warnings = (
                self._report_schedule.get_native_filters_params()
            )
            if filter_warnings:
                self._filter_warnings.extend(filter_warnings)
            if anchor := dashboard_state.get("anchor"):
                try:
                    anchor_list = json.loads(anchor)
                    if not isinstance(anchor_list, list):
                        raise json.JSONDecodeError(
                            "Anchor value is not a list", anchor, 0
                        )
                    urls = self._get_tabs_urls(
                        anchor_list,
                        dashboard_state=dashboard_state,
                        native_filter_params=native_filter_params,
                        user_friendly=user_friendly,
                    )
                    return urls
                except json.JSONDecodeError:
                    logger.debug("Anchor value is not a list, Fall back to single tab")

            # Skip the permalink when there is nothing meaningful to encode —
            # an empty dashboard_state falls through to the plain URL below.
            # A non-empty anchor means a single tab was selected (it failed
            # JSON list parsing above) and still needs a permalink. Non-filter
            # state such as urlParams (e.g. standalone=true) must also be
            # preserved via a permalink.
            if (
                anchor
                or dashboard_state.get("urlParams")
                or (native_filter_params and native_filter_params != "()")
            ):
                state: DashboardPermalinkState = {**dashboard_state}
                state["urlParams"] = self._merge_native_filters_into_url_params(
                    state.get("urlParams"), native_filter_params
                )
                return [
                    self._get_tab_url(
                        state,
                        user_friendly=user_friendly,
                    )
                ]

        native_filter_params, filter_warnings = (
            self._report_schedule.get_native_filters_params()
        )
        if filter_warnings:
            self._filter_warnings.extend(filter_warnings)
        if native_filter_params and native_filter_params != "()":
            # Preserve any urlParams from extra.dashboard (e.g. standalone=true)
            # set via API even when ALERT_REPORT_TABS is off — same merge
            # semantics as the protected branch above.
            fallback_state = self._report_schedule.extra.get("dashboard") or {}
            return [
                self._get_tab_url(
                    {
                        "urlParams": self._merge_native_filters_into_url_params(
                            fallback_state.get("urlParams"),
                            native_filter_params,
                        )
                    },
                    user_friendly=user_friendly,
                )
            ]

        dashboard = self._report_schedule.dashboard
        dashboard_id_or_slug = (
            dashboard.uuid if dashboard and dashboard.uuid else dashboard.id
        )

        return [
            get_url_path(
                "Superset.dashboard",
                user_friendly=user_friendly,
                dashboard_id_or_slug=dashboard_id_or_slug,
                force=force,
                **kwargs,
            )
        ]

    def _get_tab_url(
        self, dashboard_state: DashboardPermalinkState, user_friendly: bool = False
    ) -> str:
        """
        Get one tab url
        """
        permalink_key = CreateDashboardPermalinkCommand(
            dashboard_id=str(self._report_schedule.dashboard.uuid),
            state=dashboard_state,
        ).run()

        # The report-generation flow runs inside an outer ``@transaction``
        # block (``ReportScheduleStateMachine.run``). Because of that,
        # ``CreateDashboardPermalinkCommand``'s inner ``@transaction``
        # decorator detects the active transaction and skips its own
        # commit — the new row is flushed to the session but not yet
        # visible to other database connections. Playwright then opens
        # the permalink URL on a separate connection to render the
        # report, which 404s because the row isn't committed. Commit
        # explicitly here so the permalink is visible before navigation
        # (#40996).
        db.session.commit()  # pylint: disable=consider-using-transaction

        return get_url_path(
            "Superset.dashboard_permalink",
            key=permalink_key,
            user_friendly=user_friendly,
        )

    @staticmethod
    def _merge_native_filters_into_url_params(
        existing: Optional[Sequence[Sequence[str]]],
        native_filter_params: Optional[str],
    ) -> list[Sequence[str]]:
        """
        Merge the report's ``native_filters`` into a permalink's existing
        ``urlParams``, deduping any prior ``native_filters`` entry so the
        report's value wins. All other params (e.g. ``standalone=true``)
        survive in their original order.
        """
        merged: list[Sequence[str]] = [
            list(p) for p in (existing or []) if p[0] != "native_filters"
        ]
        merged.append(["native_filters", native_filter_params or ""])
        return merged

    def _get_tabs_urls(
        self,
        tab_anchors: list[str],
        dashboard_state: Optional[DashboardPermalinkState] = None,
        native_filter_params: Optional[str] = None,
        user_friendly: bool = False,
    ) -> list[str]:
        """
        Get multiple tabs urls.

        Each per-tab permalink merges the report's ``native_filters`` into
        the original ``dashboard_state.urlParams`` (deduping any prior
        ``native_filters`` entry), so params like ``standalone=true`` are
        preserved — matching the precedence rules of the single-tab branch
        in :meth:`get_dashboard_urls`.
        """
        base_state: DashboardPermalinkState = dashboard_state or {}
        merged_params = self._merge_native_filters_into_url_params(
            base_state.get("urlParams"), native_filter_params
        )
        return [
            self._get_tab_url(
                {
                    "anchor": tab_anchor,
                    "dataMask": None,
                    "activeTabs": None,
                    "urlParams": merged_params,
                },
                user_friendly=user_friendly,
            )
            for tab_anchor in tab_anchors
        ]

    def _get_screenshots(self) -> list[bytes]:
        """
        Get chart or dashboard screenshots
        :raises: ReportScheduleScreenshotFailedError
        """
        start_time = datetime.utcnow()

        user, _ = resolve_executor_user(self._report_schedule)

        max_width = app.config["ALERT_REPORTS_MAX_CUSTOM_SCREENSHOT_WIDTH"]

        if self._report_schedule.chart:
            url = self._get_url()

            window_width, window_height = app.config["WEBDRIVER_WINDOW"]["slice"]
            width = min(max_width, self._report_schedule.custom_width or window_width)
            height = self._report_schedule.custom_height or window_height
            window_size = (width, height)

            screenshots: list[Union[ChartScreenshot, DashboardScreenshot]] = [
                ChartScreenshot(
                    url,
                    self._report_schedule.chart.digest,
                    window_size=window_size,
                    thumb_size=app.config["WEBDRIVER_WINDOW"]["slice"],
                )
            ]
        else:
            urls = self.get_dashboard_urls()
            window_width, window_height = app.config["WEBDRIVER_WINDOW"]["dashboard"]
            width = min(max_width, self._report_schedule.custom_width or window_width)
            height = self._report_schedule.custom_height or window_height
            window_size = (width, height)

            screenshots = [
                DashboardScreenshot(
                    url,
                    self._report_schedule.dashboard.digest,
                    window_size=window_size,
                    thumb_size=app.config["WEBDRIVER_WINDOW"]["dashboard"],
                )
                for url in urls
            ]
        try:
            imges = []
            for screenshot in screenshots:
                imge = screenshot.get_screenshot(user=user)
                if imge is None:
                    raise ReportScheduleScreenshotFailedError(
                        "Screenshot failed; aborting to avoid sending a partial report"
                    )
                imges.append(imge)
            elapsed_seconds = (datetime.utcnow() - start_time).total_seconds()
            logger.info(
                "Screenshot capture took %.2fs - execution_id: %s",
                elapsed_seconds,
                self._execution_id,
            )
        except SoftTimeLimitExceeded as ex:
            elapsed_seconds = (datetime.utcnow() - start_time).total_seconds()
            logger.warning(
                "Screenshot timeout after %.2fs - execution_id: %s",
                elapsed_seconds,
                self._execution_id,
            )
            raise ReportScheduleScreenshotTimeout() from ex
        except Exception as ex:
            elapsed_seconds = (datetime.utcnow() - start_time).total_seconds()
            logger.error(
                "Screenshot failed after %.2fs - execution_id: %s",
                elapsed_seconds,
                self._execution_id,
            )
            raise ReportScheduleScreenshotFailedError(
                f"Failed taking a screenshot {str(ex)}"
            ) from ex
        if not imges:
            raise ReportScheduleScreenshotFailedError()
        return imges

    def _get_pdf(self) -> bytes:
        """
        Get chart or dashboard pdf
        :raises: ReportSchedulePdfFailedError
        """
        screenshots = self._get_screenshots()
        pdf = build_pdf_from_screenshots(screenshots)

        return pdf

    def _get_chart_data_request_payload(
        self,
        result_format: ChartDataResultFormat,
    ) -> dict[str, Any]:
        """
        Build the POST payload used for chart data exports.

        :param result_format: Desired table-like chart data format.
        :return: Query context updated with export result format/type and pagination.
        :raises ReportScheduleExecuteUnexpectedError: If the chart query context is
            missing or invalid.
        """
        try:
            query_context = json.loads(self._report_schedule.chart.query_context)
        except (TypeError, json.JSONDecodeError) as ex:
            raise ReportScheduleExecuteUnexpectedError(
                "Chart has no valid query context saved."
            ) from ex

        if not isinstance(query_context, dict):
            raise ReportScheduleExecuteUnexpectedError(
                "Chart has no valid query context saved."
            )

        result_type = ChartDataResultType.POST_PROCESSED.value
        force = bool(self._report_schedule.force_screenshot)
        query_context["result_format"] = result_format.value
        query_context["result_type"] = result_type
        query_context["force"] = force

        form_data = query_context.get("form_data")
        if isinstance(form_data, dict):
            form_data["result_format"] = result_format.value
            form_data["result_type"] = result_type
            form_data["force"] = force

            if form_data.get("server_pagination"):
                row_limit = form_data.get("row_limit") or 0
                queries = query_context.get("queries")
                if isinstance(queries, list):
                    data_query_updated = False
                    download_queries = []
                    for query in queries:
                        if isinstance(query, dict) and query.get("is_rowcount"):
                            continue
                        if isinstance(query, dict) and not data_query_updated:
                            query = {
                                **query,
                                "row_limit": row_limit,
                                "row_offset": 0,
                            }
                            data_query_updated = True
                        download_queries.append(query)
                    query_context["queries"] = download_queries

        return query_context

    @staticmethod
    def _post_chart_data(
        chart_url: str,
        auth_cookies: Optional[dict[str, str]],
        request_payload: dict[str, Any],
        timeout: Optional[float] = None,
    ) -> Optional[bytes]:
        """
        POST a chart data request using report executor authentication.

        :param chart_url: HTTP(S) chart data endpoint URL.
        :param auth_cookies: Authentication cookies to attach to the request.
        :param request_payload: Prepared chart data request payload.
        :param timeout: Optional request timeout in seconds.
        :return: Response body bytes, or None when response content is missing.
        :raises URLError: If the URL scheme is unsupported or the response fails.
        """
        if not auth_cookies:
            raise URLError("Missing authentication cookies for chart data request")

        cookie_str = ";".join([f"{key}={val}" for key, val in auth_cookies.items()])
        request_body = urllib.parse.urlencode(
            {"form_data": json.dumps(request_payload)}
        ).encode("utf-8")
        parsed_url = urllib.parse.urlparse(chart_url)
        if parsed_url.scheme not in {"http", "https"}:
            raise URLError(f"Unsupported chart data URL scheme: {parsed_url.scheme}")

        request = urllib.request.Request(  # noqa: S310
            chart_url,
            data=request_body,
            headers={
                "Content-Type": "application/x-www-form-urlencoded",
                "Cookie": cookie_str,
            },
            method="POST",
        )
        with closing(
            urllib.request.build_opener().open(request, timeout=timeout)  # noqa: S310
        ) as response:
            content = response.read()
            if response.getcode() != 200:
                raise URLError(response.getcode())
        return content or None

    def _get_data(self, result_format: ChartDataResultFormat) -> bytes:
        """
        Fetch tabular chart data (CSV or Excel) as raw bytes.

        Both formats are produced by the chart data export endpoint, so the
        bytes are fetched the same way and only differ by ``result_format``.
        This reuses the export path's post-processing and index handling,
        keeping report output consistent with a chart's manual export.
        """
        timeout_error: type[CommandException]
        failed_error: type[CommandException]
        if result_format == ChartDataResultFormat.XLSX:
            label, timeout_error, failed_error = (
                "Excel",
                ReportScheduleXlsxTimeout,
                ReportScheduleXlsxFailedError,
            )
        else:
            label, timeout_error, failed_error = (
                "CSV",
                ReportScheduleCsvTimeout,
                ReportScheduleCsvFailedError,
            )

        start_time = datetime.utcnow()
        user, username = resolve_executor_user(self._report_schedule)
        auth_cookies = machine_auth_provider_factory.instance.get_auth_cookies(user)

        if self._report_schedule.chart.query_context is None:
            logger.warning("No query context found, taking a screenshot to generate it")
            self._update_query_context(failed_error)
            db.session.refresh(self._report_schedule.chart)

        try:
            if self._report_schedule.chart.query_context is None:
                url = self._get_url(result_format=result_format)
                data = get_chart_csv_data(
                    chart_url=url,
                    auth_cookies=auth_cookies,
                    timeout=app.config["ALERT_REPORTS_CSV_REQUEST_TIMEOUT"],
                )
            else:
                request_payload = self._get_chart_data_request_payload(result_format)
                url = get_url_path("ChartDataRestApi.data")
                data = self._post_chart_data(
                    chart_url=url,
                    auth_cookies=auth_cookies,
                    request_payload=request_payload,
                    timeout=app.config["ALERT_REPORTS_CSV_REQUEST_TIMEOUT"],
                )
            elapsed_seconds = (datetime.utcnow() - start_time).total_seconds()
            logger.info(
                "%s data generation from %s as user %s took %.2fs - execution_id: %s",
                label,
                url,
                username,
                elapsed_seconds,
                self._execution_id,
            )
        except SoftTimeLimitExceeded as ex:
            elapsed_seconds = (datetime.utcnow() - start_time).total_seconds()
            logger.warning(
                "%s generation timeout after %.2fs - execution_id: %s",
                label,
                elapsed_seconds,
                self._execution_id,
            )
            raise timeout_error() from ex
        except Exception as ex:
            elapsed_seconds = (datetime.utcnow() - start_time).total_seconds()
            logger.exception(
                "%s generation failed after %.2fs - execution_id: %s",
                label,
                elapsed_seconds,
                self._execution_id,
            )
            raise failed_error(f"Failed generating {label.lower()} {str(ex)}") from ex
        if not data:
            raise failed_error()
        return data

    def _get_embedded_data(self) -> pd.DataFrame:
        """
        Return data as a Pandas dataframe, to embed in notifications as a table.
        """
        start_time = datetime.utcnow()

        url = self._get_url(result_format=ChartDataResultFormat.JSON)
        user, username = resolve_executor_user(self._report_schedule)
        auth_cookies = machine_auth_provider_factory.instance.get_auth_cookies(user)

        if self._report_schedule.chart.query_context is None:
            logger.warning("No query context found, taking a screenshot to generate it")
            self._update_query_context()

        try:
            dataframe = get_chart_dataframe(
                url,
                auth_cookies,
                timeout=app.config["ALERT_REPORTS_CSV_REQUEST_TIMEOUT"],
            )
            elapsed_seconds = (datetime.utcnow() - start_time).total_seconds()
            logger.info(
                "DataFrame generation from %s as user %s took %.2fs - execution_id: %s",
                url,
                username,
                elapsed_seconds,
                self._execution_id,
            )
        except SoftTimeLimitExceeded as ex:
            elapsed_seconds = (datetime.utcnow() - start_time).total_seconds()
            logger.warning(
                "DataFrame generation timeout after %.2fs - execution_id: %s",
                elapsed_seconds,
                self._execution_id,
            )
            raise ReportScheduleDataFrameTimeout() from ex
        except Exception as ex:
            elapsed_seconds = (datetime.utcnow() - start_time).total_seconds()
            logger.error(
                "DataFrame generation failed after %.2fs - execution_id: %s",
                elapsed_seconds,
                self._execution_id,
            )
            raise ReportScheduleDataFrameFailedError(
                f"Failed generating dataframe {str(ex)}"
            ) from ex
        if dataframe is None:
            raise ReportScheduleCsvFailedError()
        return dataframe

    def _update_query_context(
        self,
        failed_error: type[CommandException] = ReportScheduleCsvFailedError,
    ) -> None:
        """
        Update chart query context.

        To load data from the endpoint the chart must have been saved
        with its query context. For charts without saved query context we
        get a screenshot to force the chart to produce and save the query
        context. ``failed_error`` lets the caller surface a format-specific
        failure (e.g. Excel vs CSV) when the screenshot fallback fails.
        """
        try:
            self._get_screenshots()
        except (
            ReportScheduleScreenshotFailedError,
            ReportScheduleScreenshotTimeout,
        ) as ex:
            raise failed_error(
                "Unable to fetch data because the chart has no query context "
                "saved, and an error occurred when fetching it via a screenshot. "
                "Please try loading the chart and saving it again."
            ) from ex

    def _get_log_data(self) -> HeaderDataType:
        chart_id = None
        dashboard_id = None
        report_source = None
        slack_channels = None
        if self._report_schedule.chart:
            report_source = ReportSourceFormat.CHART
            chart_id = self._report_schedule.chart_id
        else:
            report_source = ReportSourceFormat.DASHBOARD
            dashboard_id = self._report_schedule.dashboard_id

        if self._report_schedule.recipients:
            slack_channels = [
                recipient.recipient_config_json
                for recipient in self._report_schedule.recipients
                if recipient.type
                in [ReportRecipientType.SLACK, ReportRecipientType.SLACKV2]
            ]

        log_data: HeaderDataType = {
            "notification_type": self._report_schedule.type,
            "notification_source": report_source,
            "notification_format": self._report_schedule.report_format,
            "chart_id": chart_id,
            "dashboard_id": dashboard_id,
            "editors": [
                s.user.id
                for s in self._report_schedule.editors
                if s.type == SubjectType.USER and s.user
            ],
            "slack_channels": slack_channels,
            "execution_id": str(self._execution_id),
        }
        return log_data

    def _get_notification_content(self) -> NotificationContent:  # noqa: C901
        """
        Gets a notification content, this is composed by a title and a screenshot

        :raises: ReportScheduleScreenshotFailedError
        """
        csv_data: bytes | None = None
        xlsx_data: bytes | None = None
        screenshot_data = []
        pdf_data = None
        embedded_data = None
        error_text = None
        header_data = self._get_log_data()
        url = self._get_url(user_friendly=True)

        if (
            feature_flag_manager.is_feature_enabled("ALERTS_ATTACH_REPORTS")
            or self._report_schedule.type == ReportScheduleType.REPORT
        ):
            if self._report_schedule.report_format == ReportDataFormat.PNG:
                screenshot_data = self._get_screenshots()
                if not screenshot_data:
                    error_text = "Unexpected missing screenshot"
            elif self._report_schedule.report_format == ReportDataFormat.PDF:
                pdf_data = self._get_pdf()
                if not pdf_data:
                    error_text = "Unexpected missing pdf"
            elif (
                self._report_schedule.chart
                and self._report_schedule.report_format in ReportDataFormat.tabular()
            ):
                if self._report_schedule.report_format == ReportDataFormat.XLSX:
                    xlsx_data = self._get_data(ChartDataResultFormat.XLSX)
                    if not xlsx_data:
                        error_text = "Unexpected missing Excel file"
                else:
                    csv_data = self._get_data(ChartDataResultFormat.CSV)
                    if not csv_data:
                        error_text = "Unexpected missing csv file"
            if error_text:
                return NotificationContent(
                    name=sanitize_title(self._report_schedule.name),
                    text=error_text,
                    header_data=header_data,
                    url=url,
                )

        if (
            self._report_schedule.chart
            and self._report_schedule.report_format == ReportDataFormat.TEXT
        ):
            embedded_data = self._get_embedded_data()

        if self._report_schedule.email_subject:
            name = sanitize_title(self._report_schedule.email_subject)
        else:
            if self._report_schedule.chart:
                name = sanitize_title(
                    f"{self._report_schedule.name}: "
                    f"{self._report_schedule.chart.slice_name}"
                )
            else:
                name = sanitize_title(
                    f"{self._report_schedule.name}: "
                    f"{self._report_schedule.dashboard.dashboard_title}"
                )

        return NotificationContent(
            name=name,
            url=url,
            screenshots=screenshot_data,
            pdf=pdf_data,
            description=self._report_schedule.description,
            csv=csv_data,
            xlsx=xlsx_data,
            embedded_data=embedded_data,
            header_data=header_data,
        )

    def _send(
        self,
        notification_content: NotificationContent,
        recipients: list[ReportRecipients],
    ) -> None:
        """
        Sends a notification to all recipients

        :raises: CommandException
        """
        notification_errors: list[SupersetError] = []
        for recipient in recipients:
            notification = create_notification(recipient, notification_content)
            try:
                try:
                    if app.config["ALERT_REPORTS_NOTIFICATION_DRY_RUN"]:
                        logger.info(
                            "Would send notification for alert %s, to %s. "
                            "ALERT_REPORTS_NOTIFICATION_DRY_RUN is enabled, "
                            "set it to False to send notifications.",
                            self._report_schedule.name,
                            recipient.recipient_config_json,
                        )
                    else:
                        notification.send()
                except SlackV1NotificationError as ex:
                    # The slack notification should be sent with the v2 api
                    logger.info(
                        "Attempting to upgrade the report to Slackv2: %s", str(ex)
                    )
                    self.update_report_schedule_slack_v2()
                    recipient.type = ReportRecipientType.SLACKV2
                    notification = create_notification(recipient, notification_content)
                    notification.send()
            except (
                UpdateFailedError,
                NotificationParamException,
                NotificationError,
                SupersetException,
            ) as ex:
                # collect errors but keep processing them
                notification_errors.append(
                    SupersetError(
                        message=ex.message,
                        error_type=SupersetErrorType.REPORT_NOTIFICATION_ERROR,
                        level=(
                            ErrorLevel.ERROR if ex.status >= 500 else ErrorLevel.WARNING
                        ),
                    )
                )
        if notification_errors:
            # log all errors but raise based on the most severe
            for error in notification_errors:
                logger.warning(str(error))

            if any(error.level == ErrorLevel.ERROR for error in notification_errors):
                raise ReportScheduleSystemErrorsException(errors=notification_errors)
            if any(error.level == ErrorLevel.WARNING for error in notification_errors):
                raise ReportScheduleClientErrorsException(errors=notification_errors)

    def send(self) -> None:
        """
        Creates the notification content and sends them to all recipients

        :raises: CommandException
        """
        notification_content = self._get_notification_content()
        self._send(notification_content, self._report_schedule.recipients)

    def send_error(self, name: str, message: str) -> None:
        """
        Creates and sends a notification for an error, to all recipients

        :raises: CommandException
        """
        header_data = self._get_log_data()
        url = self._get_url(user_friendly=True)
        logger.info(
            "header_data in notifications for alerts and reports %s, taskid, %s",
            header_data,
            self._execution_id,
        )
        notification_content = NotificationContent(
            name=sanitize_title(name), text=message, header_data=header_data, url=url
        )

        # filter recipients to recipients who are also editors
        editor_recipients = [
            ReportRecipients(
                type=ReportRecipientType.EMAIL,
                recipient_config_json=json.dumps({"target": s.user.email}),
            )
            for s in self._report_schedule.editors
            if s.type == SubjectType.USER and s.user
        ]

        self._send(notification_content, editor_recipients)

    def is_in_grace_period(self) -> bool:
        """
        Checks if an alert is in it's grace period
        """
        last_success = ReportScheduleDAO.find_last_success_log(self._report_schedule)
        return (
            last_success is not None
            and self._report_schedule.grace_period
            and datetime.utcnow()
            - timedelta(seconds=self._report_schedule.grace_period)
            < last_success.end_dttm
        )

    def is_in_error_grace_period(self) -> bool:
        """
        Checks if an alert/report on error is in it's notification grace period
        """
        last_success = ReportScheduleDAO.find_last_error_notification(
            self._report_schedule
        )
        if not last_success:
            return False
        return (
            last_success is not None
            and self._report_schedule.grace_period
            and datetime.utcnow()
            - timedelta(seconds=self._report_schedule.grace_period)
            < last_success.end_dttm
        )

    def is_on_working_timeout(self) -> bool:
        """
        Checks if an alert is in a working timeout
        """
        last_working = ReportScheduleDAO.find_last_entered_working_log(
            self._report_schedule
        )
        if not last_working:
            return False
        return (
            self._report_schedule.working_timeout is not None
            and self._report_schedule.last_eval_dttm is not None
            and datetime.utcnow()
            - timedelta(seconds=self._report_schedule.working_timeout)
            > last_working.end_dttm
        )

    def next(self) -> None:
        raise NotImplementedError()


class ReportNotTriggeredErrorState(BaseReportState):
    """
    Handle Not triggered and Error state
    next final states:
    - Not Triggered
    - Success
    - Error
    """

    current_states = [ReportState.NOOP, ReportState.ERROR]
    initial = True

    def next(self) -> None:  # noqa: C901
        self.update_report_schedule_and_log(ReportState.WORKING)
        try:
            # If it's an alert check if the alert is triggered
            if self._report_schedule.type == ReportScheduleType.ALERT:
                triggered, message = AlertCommand(
                    self._report_schedule, self._execution_id
                ).run()
                if not triggered:
                    self.update_report_schedule_and_log(
                        ReportState.NOOP, error_message=message
                    )
                    return
            self.send()
            # Include filter warnings in the log if any were collected
            warning_message = (
                ";".join(self._filter_warnings) if self._filter_warnings else None
            )
            self.update_report_schedule_and_log(
                ReportState.SUCCESS, error_message=warning_message
            )
        except (SupersetErrorsException, Exception) as first_ex:
            error_message = str(first_ex)
            if isinstance(first_ex, SupersetErrorsException):
                error_message = ";".join([error.message for error in first_ex.errors])

            try:
                self.update_report_schedule_and_log(
                    ReportState.ERROR, error_message=error_message
                )
            except ReportScheduleUnexpectedError as logging_ex:
                # Logging failed (likely StaleDataError), but we still want to
                # raise the original error so the root cause remains visible
                logger.warning(
                    "Failed to log error for report schedule (execution %s) "
                    "due to database issue",
                    self._execution_id,
                    exc_info=True,
                )
                # Re-raise the original exception, not the logging failure
                raise first_ex from logging_ex

            # TODO (dpgaspar) convert this logic to a new state eg: ERROR_ON_GRACE
            if not self.is_in_error_grace_period():
                second_error_message = REPORT_SCHEDULE_ERROR_NOTIFICATION_MARKER
                try:
                    self.send_error(
                        f"Error occurred for {self._report_schedule.type}:"
                        f" {self._report_schedule.name}",
                        str(first_ex),
                    )

                except SupersetErrorsException as second_ex:
                    second_error_message = ";".join(
                        [error.message for error in second_ex.errors]
                    )
                except ReportScheduleUnexpectedError:
                    # send_error failed due to logging issue, log and continue
                    # to raise the original error
                    logger.warning(
                        "Failed to send error notification due to database issue",
                        exc_info=True,
                    )
                except Exception as second_ex:  # pylint: disable=broad-except
                    second_error_message = str(second_ex)
                finally:
                    try:
                        self.update_report_schedule_and_log(
                            ReportState.ERROR, error_message=second_error_message
                        )
                    except ReportScheduleUnexpectedError:
                        # Logging failed again, log it but don't let it hide first_ex
                        logger.warning(
                            "Failed to log final error state due to database issue",
                            exc_info=True,
                        )
            raise


class ReportWorkingState(BaseReportState):
    """
    Handle Working state
    next states:
    - Error
    - Working
    """

    current_states = [ReportState.WORKING]

    def next(self) -> None:
        if self.is_on_working_timeout():
            last_working = ReportScheduleDAO.find_last_entered_working_log(
                self._report_schedule
            )
            elapsed_seconds = (
                (datetime.utcnow() - last_working.end_dttm).total_seconds()
                if last_working
                else None
            )
            logger.error(
                "Working state timeout after %.2fs - execution_id: %s",
                elapsed_seconds if elapsed_seconds else 0,
                self._execution_id,
            )
            exception_timeout = ReportScheduleWorkingTimeoutError()
            self.update_report_schedule_and_log(
                ReportState.ERROR,
                error_message=str(exception_timeout),
            )
            raise exception_timeout
        logger.warning(
            "Report still in working state, refusing to re-compute - execution_id: %s",
            self._execution_id,
        )
        exception_working = ReportSchedulePreviousWorkingError()
        self.update_report_schedule_and_log(
            ReportState.WORKING,
            error_message=str(exception_working),
        )
        raise exception_working


class ReportSuccessState(BaseReportState):
    """
    Handle Success, Grace state
    next states:
    - Grace
    - Not triggered
    - Success
    """

    current_states = [ReportState.SUCCESS, ReportState.GRACE]

    def next(self) -> None:
        if self._report_schedule.type == ReportScheduleType.ALERT:
            if self.is_in_grace_period():
                self.update_report_schedule_and_log(
                    ReportState.GRACE,
                    error_message=str(ReportScheduleAlertGracePeriodError()),
                )
                return
            self.update_report_schedule_and_log(ReportState.WORKING)
            try:
                triggered, message = AlertCommand(
                    self._report_schedule, self._execution_id
                ).run()
                if not triggered:
                    self.update_report_schedule_and_log(
                        ReportState.NOOP, error_message=message
                    )
                    return
            except Exception as ex:
                # Ensure the schedule always transitions out of WORKING to
                # ERROR, even if sending the error notification itself fails —
                # otherwise the schedule is stuck in WORKING until the working
                # timeout. Mirrors ReportNotTriggeredErrorState.next().
                # Only record the marker when the notification was actually
                # delivered; otherwise record the send failure so the grace-
                # period check doesn't incorrectly suppress future notifications.
                error_message = REPORT_SCHEDULE_ERROR_NOTIFICATION_MARKER
                try:
                    self.send_error(
                        f"Error occurred for {self._report_schedule.type}:"
                        f" {self._report_schedule.name}",
                        str(ex),
                    )
                except Exception as send_ex:  # noqa: BLE001  # pylint: disable=broad-except
                    error_message = str(send_ex) or str(ex)
                    logger.warning(
                        "Failed to send error notification for report schedule "
                        "(execution %s)",
                        self._execution_id,
                        exc_info=True,
                    )
                finally:
                    try:
                        self.update_report_schedule_and_log(
                            ReportState.ERROR,
                            error_message=error_message,
                        )
                    except ReportScheduleUnexpectedError:
                        logger.warning(
                            "Failed to log ERROR state for report schedule "
                            "(execution %s) due to database issue",
                            self._execution_id,
                            exc_info=True,
                        )
                raise

        # For REPORT types the ALERT branch above is skipped, so WORKING has not
        # been set yet. Set it before the (potentially slow) send() so a
        # concurrent scheduler tick is blocked by ReportWorkingState, preventing
        # duplicate notifications. ALERT types already set WORKING above.
        if self._report_schedule.type != ReportScheduleType.ALERT:
            self.update_report_schedule_and_log(ReportState.WORKING)

        try:
            self.send()
            # Include filter warnings in the log if any were collected
            warning_message = (
                ";".join(self._filter_warnings) if self._filter_warnings else None
            )
            self.update_report_schedule_and_log(
                ReportState.SUCCESS, error_message=warning_message
            )
        except Exception as ex:  # pylint: disable=broad-except
            try:
                self.update_report_schedule_and_log(
                    ReportState.ERROR, error_message=str(ex)
                )
            except ReportScheduleUnexpectedError as logging_ex:
                # Logging failed (likely StaleDataError), but we still want to
                # raise the original error so the root cause remains visible
                logger.warning(
                    "Failed to log error for report schedule (execution %s) "
                    "due to database issue",
                    self._execution_id,
                    exc_info=True,
                )
                # Re-raise the original exception, not the logging failure
                raise ex from logging_ex
            raise


class ReportScheduleStateMachine:  # pylint: disable=too-few-public-methods
    """
    Simple state machine for Alerts/Reports states
    """

    states_cls = [ReportWorkingState, ReportNotTriggeredErrorState, ReportSuccessState]

    def __init__(
        self,
        task_uuid: UUID,
        report_schedule: ReportSchedule,
        scheduled_dttm: datetime,
    ):
        self._execution_id = task_uuid
        self._report_schedule = report_schedule
        self._scheduled_dttm = scheduled_dttm

    @transaction()
    def run(self) -> None:
        for state_cls in self.states_cls:
            if (self._report_schedule.last_state is None and state_cls.initial) or (
                self._report_schedule.last_state in state_cls.current_states
            ):
                state_cls(
                    self._report_schedule,
                    self._scheduled_dttm,
                    self._execution_id,
                ).next()
                break
        else:
            raise ReportScheduleStateNotFoundError()


class AsyncExecuteReportScheduleCommand(BaseCommand):
    """
    Execute all types of report schedules.
    - On reports takes chart or dashboard screenshots and sends configured notifications
    - On Alerts uses related Command AlertCommand and sends configured notifications
    """

    def __init__(self, task_id: str, model_id: int, scheduled_dttm: datetime):
        self._model_id = model_id
        self._model: Optional[ReportSchedule] = None
        self._scheduled_dttm = scheduled_dttm
        self._execution_id = UUID(task_id)

    def run(self) -> None:
        try:
            self.validate()
            if not self._model:
                raise ReportScheduleExecuteUnexpectedError()

            # Resolve the executor at the run() boundary, tolerating a missing
            # user (find_user -> None) so the state machine still runs and its
            # error envelope writes the ERROR execution-log row and sends the
            # editor notification. The dedicated ReportScheduleExecutorNotFoundError
            # guard lives at the content sites (_get_screenshots / _get_data /
            # _get_embedded_data), which raise inside that envelope. Guarding here
            # instead would surface the executor error above the state machine,
            # suppressing both the log row and the editor notification. The
            # alert-query path (AlertCommand) is intentionally left unchanged — a
            # missing executor there surfaces as a query error, not the dedicated
            # executor error; tightening it is out of scope here.
            _, username = get_executor(
                executors=app.config["ALERT_REPORTS_EXECUTORS"],
                model=self._model,
            )
            user = security_manager.find_user(username)

            start_time = datetime.utcnow()
            with override_user(user):
                # Pre-commit any permalink rows before the state machine's
                # @transaction() opens. When called inside a transaction,
                # CreateDashboardPermalinkCommand only flushes (not commits),
                # leaving the row invisible to Playwright's separate DB
                # connection. Running get_dashboard_urls() here — outside any
                # transaction — lets the command commit normally. The state
                # machine's inner call to get_dashboard_urls() hits get_entry()
                # for the same deterministic UUID and returns the
                # already-committed row without a second INSERT.
                if self._model.dashboard_id:
                    BaseReportState(
                        self._model, self._scheduled_dttm, self._execution_id
                    ).get_dashboard_urls()
                ReportScheduleStateMachine(
                    self._execution_id, self._model, self._scheduled_dttm
                ).run()

            elapsed_seconds = (datetime.utcnow() - start_time).total_seconds()
            logger.info(
                "Report execution as user %s completed in %.2fs - execution_id: %s",
                username,
                elapsed_seconds,
                self._execution_id,
            )
        except CommandException:
            raise
        except Exception as ex:
            raise ReportScheduleUnexpectedError(str(ex)) from ex

    def validate(self) -> None:
        # Validate/populate model exists
        logger.info(
            "session is validated: id %s, executionid: %s",
            self._model_id,
            self._execution_id,
        )
        self._model = (
            db.session.query(ReportSchedule).filter_by(id=self._model_id).one_or_none()
        )
        if not self._model:
            raise ReportScheduleNotFoundError()
