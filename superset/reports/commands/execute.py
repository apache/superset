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
import json
import logging
from datetime import datetime, timedelta
from typing import Any, List, Optional
from uuid import UUID

import pandas as pd
from celery.exceptions import SoftTimeLimitExceeded
from flask_appbuilder.security.sqla.models import User
from sqlalchemy.orm import Session

from superset import app
from superset.commands.base import BaseCommand
from superset.commands.exceptions import CommandException
from superset.extensions import feature_flag_manager, machine_auth_provider_factory
from superset.models.reports import (
    ReportDataFormat,
    ReportExecutionLog,
    ReportRecipients,
    ReportRecipientType,
    ReportSchedule,
    ReportScheduleType,
    ReportState,
)
from superset.reports.commands.alert import AlertCommand
from superset.reports.commands.exceptions import (
    ReportScheduleAlertGracePeriodError,
    ReportScheduleCsvFailedError,
    ReportScheduleCsvTimeout,
    ReportScheduleDataFrameFailedError,
    ReportScheduleDataFrameTimeout,
    ReportScheduleExecuteUnexpectedError,
    ReportScheduleNotFoundError,
    ReportScheduleNotificationError,
    ReportSchedulePreviousWorkingError,
    ReportScheduleScreenshotFailedError,
    ReportScheduleScreenshotTimeout,
    ReportScheduleSelleniumUserNotFoundError,
    ReportScheduleStateNotFoundError,
    ReportScheduleUnexpectedError,
    ReportScheduleWorkingTimeoutError,
)
from superset.reports.dao import (
    REPORT_SCHEDULE_ERROR_NOTIFICATION_MARKER,
    ReportScheduleDAO,
)
from superset.reports.notifications import create_notification
from superset.reports.notifications.base import NotificationContent
from superset.reports.notifications.exceptions import NotificationError
from superset.utils.celery import session_scope
from superset.utils.core import ChartDataResultFormat, ChartDataResultType
from superset.utils.csv import get_chart_csv_data, get_chart_dataframe
from superset.utils.screenshots import (
    BaseScreenshot,
    ChartScreenshot,
    DashboardScreenshot,
)
from superset.utils.urls import get_url_path

logger = logging.getLogger(__name__)


class BaseReportState:
    current_states: List[ReportState] = []
    initial: bool = False

    def __init__(
        self,
        session: Session,
        report_schedule: ReportSchedule,
        scheduled_dttm: datetime,
        execution_id: UUID,
    ) -> None:
        self._session = session
        self._report_schedule = report_schedule
        self._scheduled_dttm = scheduled_dttm
        self._start_dttm = datetime.utcnow()
        self._execution_id = execution_id

    def set_state_and_log(
        self, state: ReportState, error_message: Optional[str] = None,
    ) -> None:
        """
        Updates current ReportSchedule state and TS. If on final state writes the log
        for this execution
        """
        now_dttm = datetime.utcnow()
        self.set_state(state, now_dttm)
        self.create_log(
            state, error_message=error_message,
        )

    def set_state(self, state: ReportState, dttm: datetime) -> None:
        """
        Set the current report schedule state, on this case we want to
        commit immediately
        """
        self._report_schedule.last_state = state
        self._report_schedule.last_eval_dttm = dttm
        self._session.merge(self._report_schedule)
        self._session.commit()

    def create_log(
        self, state: ReportState, error_message: Optional[str] = None
    ) -> None:
        """
        Creates a Report execution log, uses the current computed last_value for Alerts
        """
        log = ReportExecutionLog(
            scheduled_dttm=self._scheduled_dttm,
            start_dttm=self._start_dttm,
            end_dttm=datetime.utcnow(),
            value=self._report_schedule.last_value,
            value_row_json=self._report_schedule.last_value_row_json,
            state=state,
            error_message=error_message,
            report_schedule=self._report_schedule,
            uuid=self._execution_id,
        )
        self._session.add(log)
        self._session.commit()

    def _get_url(
        self,
        user_friendly: bool = False,
        result_format: Optional[ChartDataResultFormat] = None,
        **kwargs: Any,
    ) -> str:
        """
        Get the url for this report schedule: chart or dashboard
        """
        if self._report_schedule.chart:
            if result_format in {
                ChartDataResultFormat.CSV,
                ChartDataResultFormat.JSON,
            }:
                return get_url_path(
                    "ChartRestApi.get_data",
                    pk=self._report_schedule.chart_id,
                    format=result_format.value,
                    type=ChartDataResultType.POST_PROCESSED.value,
                )
            return get_url_path(
                "Superset.slice",
                user_friendly=user_friendly,
                slice_id=self._report_schedule.chart_id,
                **kwargs,
            )
        return get_url_path(
            "Superset.dashboard",
            user_friendly=user_friendly,
            dashboard_id_or_slug=self._report_schedule.dashboard_id,
            **kwargs,
        )

    def _get_user(self) -> User:
        user = (
            self._session.query(User)
            .filter(User.username == app.config["THUMBNAIL_SELENIUM_USER"])
            .one_or_none()
        )
        if not user:
            raise ReportScheduleSelleniumUserNotFoundError()
        return user

    def _get_screenshot(self) -> bytes:
        """
        Get a chart or dashboard screenshot

        :raises: ReportScheduleScreenshotFailedError
        """
        screenshot: Optional[BaseScreenshot] = None
        if self._report_schedule.chart:
            url = self._get_url(standalone="true")
            logger.info("Screenshotting chart at %s", url)
            screenshot = ChartScreenshot(
                url,
                self._report_schedule.chart.digest,
                window_size=app.config["WEBDRIVER_WINDOW"]["slice"],
                thumb_size=app.config["WEBDRIVER_WINDOW"]["slice"],
            )
        else:
            url = self._get_url()
            logger.info("Screenshotting dashboard at %s", url)
            screenshot = DashboardScreenshot(
                url,
                self._report_schedule.dashboard.digest,
                window_size=app.config["WEBDRIVER_WINDOW"]["dashboard"],
                thumb_size=app.config["WEBDRIVER_WINDOW"]["dashboard"],
            )
        user = self._get_user()
        try:
            image_data = screenshot.get_screenshot(user=user)
        except SoftTimeLimitExceeded as ex:
            logger.warning("A timeout occurred while taking a screenshot.")
            raise ReportScheduleScreenshotTimeout() from ex
        except Exception as ex:
            raise ReportScheduleScreenshotFailedError(
                f"Failed taking a screenshot {str(ex)}"
            ) from ex
        if not image_data:
            raise ReportScheduleScreenshotFailedError()
        return image_data

    def _get_csv_data(self) -> bytes:
        url = self._get_url(result_format=ChartDataResultFormat.CSV)
        auth_cookies = machine_auth_provider_factory.instance.get_auth_cookies(
            self._get_user()
        )

        if self._report_schedule.chart.query_context is None:
            logger.warning("No query context found, taking a screenshot to generate it")
            self._update_query_context()

        try:
            logger.info("Getting chart from %s", url)
            csv_data = get_chart_csv_data(url, auth_cookies)
        except SoftTimeLimitExceeded as ex:
            raise ReportScheduleCsvTimeout() from ex
        except Exception as ex:
            raise ReportScheduleCsvFailedError(
                f"Failed generating csv {str(ex)}"
            ) from ex
        if not csv_data:
            raise ReportScheduleCsvFailedError()
        return csv_data

    def _get_embedded_data(self) -> pd.DataFrame:
        """
        Return data as a Pandas dataframe, to embed in notifications as a table.
        """
        url = self._get_url(result_format=ChartDataResultFormat.JSON)
        auth_cookies = machine_auth_provider_factory.instance.get_auth_cookies(
            self._get_user()
        )

        if self._report_schedule.chart.query_context is None:
            logger.warning("No query context found, taking a screenshot to generate it")
            self._update_query_context()

        try:
            logger.info("Getting chart from %s", url)
            dataframe = get_chart_dataframe(url, auth_cookies)
        except SoftTimeLimitExceeded as ex:
            raise ReportScheduleDataFrameTimeout() from ex
        except Exception as ex:
            raise ReportScheduleDataFrameFailedError(
                f"Failed generating dataframe {str(ex)}"
            ) from ex
        if dataframe is None:
            raise ReportScheduleCsvFailedError()
        return dataframe

    def _update_query_context(self) -> None:
        """
        Update chart query context.

        To load CSV data from the endpoint the chart must have been saved
        with its query context. For charts without saved query context we
        get a screenshot to force the chart to produce and save the query
        context.
        """
        try:
            self._get_screenshot()
        except (
            ReportScheduleScreenshotFailedError,
            ReportScheduleScreenshotTimeout,
        ) as ex:
            raise ReportScheduleCsvFailedError(
                "Unable to fetch data because the chart has no query context "
                "saved, and an error occurred when fetching it via a screenshot. "
                "Please try loading the chart and saving it again."
            ) from ex

    def _get_notification_content(self) -> NotificationContent:
        """
        Gets a notification content, this is composed by a title and a screenshot

        :raises: ReportScheduleScreenshotFailedError
        """
        csv_data = None
        embedded_data = None
        error_text = None
        screenshot_data = None
        url = self._get_url(user_friendly=True)
        if (
            feature_flag_manager.is_feature_enabled("ALERTS_ATTACH_REPORTS")
            or self._report_schedule.type == ReportScheduleType.REPORT
        ):
            if self._report_schedule.report_format == ReportDataFormat.VISUALIZATION:
                screenshot_data = self._get_screenshot()
                if not screenshot_data:
                    error_text = "Unexpected missing screenshot"
            elif (
                self._report_schedule.chart
                and self._report_schedule.report_format == ReportDataFormat.DATA
            ):
                csv_data = self._get_csv_data()
                if not csv_data:
                    error_text = "Unexpected missing csv file"
            if error_text:
                return NotificationContent(
                    name=self._report_schedule.name, text=error_text
                )

        if (
            self._report_schedule.chart
            and self._report_schedule.report_format == ReportDataFormat.TEXT
        ):
            embedded_data = self._get_embedded_data()

        if self._report_schedule.chart:
            name = (
                f"{self._report_schedule.name}: "
                f"{self._report_schedule.chart.slice_name}"
            )
        else:
            name = (
                f"{self._report_schedule.name}: "
                f"{self._report_schedule.dashboard.dashboard_title}"
            )
        return NotificationContent(
            name=name,
            url=url,
            screenshot=screenshot_data,
            description=self._report_schedule.description,
            csv=csv_data,
            embedded_data=embedded_data,
        )

    def _send(
        self,
        notification_content: NotificationContent,
        recipients: List[ReportRecipients],
    ) -> None:
        """
        Sends a notification to all recipients

        :raises: ReportScheduleNotificationError
        """
        notification_errors = []
        for recipient in recipients:
            notification = create_notification(recipient, notification_content)
            try:
                if app.config["ALERT_REPORTS_NOTIFICATION_DRY_RUN"]:
                    logger.info(
                        "Would send notification for alert %s, to %s",
                        self._report_schedule.name,
                        recipient.recipient_config_json,
                    )
                else:
                    notification.send()
            except NotificationError as ex:
                # collect notification errors but keep processing them
                notification_errors.append(str(ex))
        if notification_errors:
            raise ReportScheduleNotificationError(";".join(notification_errors))

    def send(self) -> None:
        """
        Creates the notification content and sends them to all recipients

        :raises: ReportScheduleNotificationError
        """
        notification_content = self._get_notification_content()
        self._send(notification_content, self._report_schedule.recipients)

    def send_error(self, name: str, message: str) -> None:
        """
        Creates and sends a notification for an error, to all recipients

        :raises: ReportScheduleNotificationError
        """
        notification_content = NotificationContent(name=name, text=message)

        # filter recipients to recipients who are also owners
        owner_recipients = [
            ReportRecipients(
                type=ReportRecipientType.EMAIL,
                recipient_config_json=json.dumps({"target": owner.email}),
            )
            for owner in self._report_schedule.owners
        ]

        self._send(notification_content, owner_recipients)

    def is_in_grace_period(self) -> bool:
        """
        Checks if an alert is in it's grace period
        """
        last_success = ReportScheduleDAO.find_last_success_log(
            self._report_schedule, session=self._session
        )
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
            self._report_schedule, session=self._session
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
            self._report_schedule, session=self._session
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

    def next(self) -> None:
        self.set_state_and_log(ReportState.WORKING)
        try:
            # If it's an alert check if the alert is triggered
            if self._report_schedule.type == ReportScheduleType.ALERT:
                if not AlertCommand(self._report_schedule).run():
                    self.set_state_and_log(ReportState.NOOP)
                    return
            self.send()
            self.set_state_and_log(ReportState.SUCCESS)
        except CommandException as first_ex:
            self.set_state_and_log(ReportState.ERROR, error_message=str(first_ex))
            # TODO (dpgaspar) convert this logic to a new state eg: ERROR_ON_GRACE
            if not self.is_in_error_grace_period():
                try:
                    self.send_error(
                        f"Error occurred for {self._report_schedule.type}:"
                        f" {self._report_schedule.name}",
                        str(first_ex),
                    )
                    self.set_state_and_log(
                        ReportState.ERROR,
                        error_message=REPORT_SCHEDULE_ERROR_NOTIFICATION_MARKER,
                    )
                except CommandException as second_ex:
                    self.set_state_and_log(
                        ReportState.ERROR, error_message=str(second_ex)
                    )
            raise first_ex


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
            exception_timeout = ReportScheduleWorkingTimeoutError()
            self.set_state_and_log(
                ReportState.ERROR, error_message=str(exception_timeout),
            )
            raise exception_timeout
        exception_working = ReportSchedulePreviousWorkingError()
        self.set_state_and_log(
            ReportState.WORKING, error_message=str(exception_working),
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
                self.set_state_and_log(
                    ReportState.GRACE,
                    error_message=str(ReportScheduleAlertGracePeriodError()),
                )
                return
            self.set_state_and_log(ReportState.WORKING)
            try:
                if not AlertCommand(self._report_schedule).run():
                    self.set_state_and_log(ReportState.NOOP)
                    return
            except CommandException as ex:
                self.send_error(
                    f"Error occurred for {self._report_schedule.type}:"
                    f" {self._report_schedule.name}",
                    str(ex),
                )
                self.set_state_and_log(
                    ReportState.ERROR,
                    error_message=REPORT_SCHEDULE_ERROR_NOTIFICATION_MARKER,
                )
                raise ex

        try:
            self.send()
            self.set_state_and_log(ReportState.SUCCESS)
        except CommandException as ex:
            self.set_state_and_log(ReportState.ERROR, error_message=str(ex))


class ReportScheduleStateMachine:  # pylint: disable=too-few-public-methods
    """
    Simple state machine for Alerts/Reports states
    """

    states_cls = [ReportWorkingState, ReportNotTriggeredErrorState, ReportSuccessState]

    def __init__(
        self,
        session: Session,
        task_uuid: UUID,
        report_schedule: ReportSchedule,
        scheduled_dttm: datetime,
    ):
        self._session = session
        self._execution_id = task_uuid
        self._report_schedule = report_schedule
        self._scheduled_dttm = scheduled_dttm

    def run(self) -> None:
        state_found = False
        for state_cls in self.states_cls:
            if (self._report_schedule.last_state is None and state_cls.initial) or (
                self._report_schedule.last_state in state_cls.current_states
            ):
                state_cls(
                    self._session,
                    self._report_schedule,
                    self._scheduled_dttm,
                    self._execution_id,
                ).next()
                state_found = True
                break
        if not state_found:
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
        with session_scope(nullpool=True) as session:
            try:
                self.validate(session=session)
                if not self._model:
                    raise ReportScheduleExecuteUnexpectedError()
                ReportScheduleStateMachine(
                    session, self._execution_id, self._model, self._scheduled_dttm
                ).run()
            except CommandException as ex:
                raise ex
            except Exception as ex:
                raise ReportScheduleUnexpectedError(str(ex)) from ex

    def validate(  # pylint: disable=arguments-differ
        self, session: Session = None
    ) -> None:
        # Validate/populate model exists
        self._model = ReportScheduleDAO.find_by_id(self._model_id, session=session)
        if not self._model:
            raise ReportScheduleNotFoundError()
