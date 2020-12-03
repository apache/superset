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
from abc import abstractmethod
from datetime import datetime, timedelta
from typing import List, Optional

from flask_appbuilder.security.sqla.models import User
from sqlalchemy.orm import Session

from superset import app, thumbnail_cache
from superset.commands.base import BaseCommand
from superset.models.reports import (
    ReportExecutionLog,
    ReportLogState,
    ReportSchedule,
    ReportScheduleType,
)
from superset.reports.commands.alert import AlertCommand
from superset.reports.commands.exceptions import (
    ReportScheduleAlertGracePeriodError,
    ReportScheduleExecuteUnexpectedError,
    ReportScheduleNotFoundError,
    ReportScheduleNotificationError,
    ReportSchedulePreviousWorkingError,
    ReportScheduleScreenshotFailedError,
    ReportScheduleSelleniumUserNotFoundError,
    ReportScheduleUnexpectedError,
    ReportScheduleWorkingTimeoutError,
)
from superset.reports.dao import ReportScheduleDAO
from superset.reports.notifications import create_notification
from superset.reports.notifications.base import NotificationContent, ScreenshotData
from superset.reports.notifications.exceptions import NotificationError
from superset.utils.celery import session_scope
from superset.utils.screenshots import (
    BaseScreenshot,
    ChartScreenshot,
    DashboardScreenshot,
)
from superset.utils.urls import get_url_path

logger = logging.getLogger(__name__)


class BaseReportState:
    current_states: List[ReportLogState] = []

    def __init__(
        self,
        session: Session,
        report_schedule: ReportSchedule,
        scheduled_dttm: datetime,
    ) -> None:
        self._session = session
        self._report_schedule = report_schedule
        self._scheduled_dttm = scheduled_dttm
        self._start_dttm = datetime.utcnow()

    def set_state_and_log(
        self, state: ReportLogState, error_message: Optional[str] = None,
    ) -> None:
        """
        Updates current ReportSchedule state and TS. If on final state writes the log
        for this execution
        """
        now_dttm = datetime.utcnow()
        if state == ReportLogState.WORKING:
            self.set_state(state, now_dttm)
            return
        self.set_state(state, now_dttm)
        self.create_log(
            state, error_message=error_message,
        )

    def set_state(self, state: ReportLogState, dttm: datetime) -> None:
        """
        Set the current report schedule state, on this case we want to
        commit immediately
        """
        self._report_schedule.last_state = state
        self._report_schedule.last_eval_dttm = dttm
        self._session.commit()

    def create_log(  # pylint: disable=too-many-arguments
        self, state: ReportLogState, error_message: Optional[str] = None,
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
        )
        self._session.add(log)

    def _get_url(self, user_friendly: bool = False) -> str:
        """
        Get the url for this report schedule: chart or dashboard
        """
        if self._report_schedule.chart:
            return get_url_path(
                "Superset.slice",
                user_friendly=user_friendly,
                slice_id=self._report_schedule.chart_id,
                standalone="true",
            )
        return get_url_path(
            "Superset.dashboard",
            user_friendly=user_friendly,
            dashboard_id_or_slug=self._report_schedule.dashboard_id,
        )

    def _get_screenshot_user(self) -> User:
        user = (
            self._session.query(User)
            .filter(User.username == app.config["THUMBNAIL_SELENIUM_USER"])
            .one_or_none()
        )
        if not user:
            raise ReportScheduleSelleniumUserNotFoundError()
        return user

    def _get_screenshot(self) -> ScreenshotData:
        """
        Get a chart or dashboard screenshot
        :raises: ReportScheduleScreenshotFailedError
        """
        url = self._get_url()
        screenshot: Optional[BaseScreenshot] = None
        if self._report_schedule.chart:
            screenshot = ChartScreenshot(url, self._report_schedule.chart.digest)
        else:
            screenshot = DashboardScreenshot(
                url, self._report_schedule.dashboard.digest
            )
        image_url = self._get_url(user_friendly=True)
        user = self._get_screenshot_user()
        image_data = screenshot.compute_and_cache(
            user=user, cache=thumbnail_cache, force=True,
        )
        if not image_data:
            raise ReportScheduleScreenshotFailedError()
        return ScreenshotData(url=image_url, image=image_data)

    def _get_notification_content(self) -> NotificationContent:
        """
        Gets a notification content, this is composed by a title and a screenshot
        :raises: ReportScheduleScreenshotFailedError
        """
        screenshot_data = self._get_screenshot()
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
        return NotificationContent(name=name, screenshot=screenshot_data)

    def _send(self) -> None:
        """
        Creates the notification content and sends them to all recipients

        :raises: ReportScheduleNotificationError
        """
        notification_errors = []
        notification_content = self._get_notification_content()
        for recipient in self._report_schedule.recipients:
            notification = create_notification(recipient, notification_content)
            try:
                notification.send()
            except NotificationError as ex:
                # collect notification errors but keep processing them
                notification_errors.append(str(ex))
        if notification_errors:
            raise ReportScheduleNotificationError(";".join(notification_errors))

    def next(self) -> None:
        raise NotImplementedError()


class ReportNotTriggeredErrorState(BaseReportState):

    current_states = [ReportLogState.NOOP, ReportLogState.ERROR]

    def next(self) -> None:
        self.set_state_and_log(ReportLogState.WORKING)
        try:
            # If it's an alert check if the alert is triggered
            if self._report_schedule.type == ReportScheduleType.ALERT:
                if not AlertCommand(self._report_schedule).run():
                    self.set_state_and_log(ReportLogState.NOOP)
                    return
            self._send()
            self.set_state_and_log(ReportLogState.SUCCESS)
        except Exception as ex:
            self.set_state_and_log(ReportLogState.ERROR, error_message=str(ex))
            # We want to actually commit the state and log inside the scope
            self._session.commit()


class ReportWorkingState(BaseReportState):

    current_states = [ReportLogState.WORKING]

    def next(self) -> None:
        if (
            self._report_schedule.working_timeout is not None
            and datetime.utcnow()
            - timedelta(seconds=self._report_schedule.working_timeout)
            > self._report_schedule.last_eval_dttm
        ):
            self.set_state_and_log(
                ReportLogState.ERROR,
                error_message=str(ReportScheduleWorkingTimeoutError()),
            )
        # Just log state remains the same
        self.create_log(
            state=ReportLogState.ERROR,
            error_message=str(ReportSchedulePreviousWorkingError()),
        )
        self._session.commit()


class ReportSuccessState(BaseReportState):

    current_states = [ReportLogState.SUCCESS]

    def next(self) -> None:
        if self._report_schedule.type == ReportScheduleType.ALERT:
            last_success = ReportScheduleDAO.find_last_success_log(
                self._report_schedule, session=self._session
            )
            if (
                last_success is not None
                and self._report_schedule.last_state == ReportLogState.SUCCESS
                and self._report_schedule.grace_period
                and datetime.utcnow()
                - timedelta(seconds=self._report_schedule.grace_period)
                < last_success.end_dttm
            ):
                self.set_state_and_log(
                    ReportLogState.SUCCESS,
                    error_message=str(ReportScheduleAlertGracePeriodError()),
                )
            self.set_state_and_log(
                ReportLogState.NOOP,
                error_message=str(ReportScheduleAlertGracePeriodError()),
            )


class ReportScheduleStateMachine:
    states_cls = [ReportWorkingState, ReportNotTriggeredErrorState, ReportSuccessState]

    def run(
        self,
        session: Session,
        report_schedule: ReportSchedule,
        scheduled_dttm: datetime,
    ) -> None:
        for state_cls in self.states_cls:
            if report_schedule.last_state in state_cls.current_states:
                state_cls(session, report_schedule, scheduled_dttm).next()


class AsyncExecuteReportScheduleCommand(BaseCommand):
    """
    Execute all types of report schedules.
    - On reports takes chart or dashboard screenshots and sends configured notifications
    - On Alerts uses related Command AlertCommand and sends configured notifications
    """

    def __init__(self, model_id: int, scheduled_dttm: datetime):
        self._model_id = model_id
        self._model: Optional[ReportSchedule] = None
        self._scheduled_dttm = scheduled_dttm

    def run(self) -> None:
        with session_scope(nullpool=True) as session:
            try:
                self.validate(session=session)
                if not self._model:
                    raise ReportScheduleExecuteUnexpectedError()
                ReportScheduleStateMachine().run(
                    session, self._model, self._scheduled_dttm
                )
            except Exception as ex:
                raise ReportScheduleUnexpectedError(str(ex))

    def validate(  # pylint: disable=arguments-differ
        self, session: Session = None
    ) -> None:
        # Validate/populate model exists
        self._model = ReportScheduleDAO.find_by_id(self._model_id, session=session)
        if not self._model:
            raise ReportScheduleNotFoundError()
