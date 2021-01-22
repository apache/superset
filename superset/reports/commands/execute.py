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
from datetime import datetime, timedelta
from typing import Any, List, Optional

from flask_appbuilder.security.sqla.models import User
from sqlalchemy.orm import Session

from superset import app, thumbnail_cache
from superset.commands.base import BaseCommand
from superset.commands.exceptions import CommandException
from superset.models.reports import (
    ReportExecutionLog,
    ReportSchedule,
    ReportScheduleType,
    ReportState,
)
from superset.reports.commands.alert import AlertCommand
from superset.reports.commands.exceptions import (
    ReportScheduleAlertEndGracePeriodError,
    ReportScheduleAlertGracePeriodError,
    ReportScheduleExecuteUnexpectedError,
    ReportScheduleNotFoundError,
    ReportScheduleNotificationError,
    ReportSchedulePreviousWorkingError,
    ReportScheduleScreenshotFailedError,
    ReportScheduleSelleniumUserNotFoundError,
    ReportScheduleStateNotFoundError,
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
    current_states: List[ReportState] = []
    initial: bool = False

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

    def create_log(  # pylint: disable=too-many-arguments
        self, state: ReportState, error_message: Optional[str] = None,
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
        self._session.commit()

    def _get_url(self, user_friendly: bool = False, **kwargs: Any) -> str:
        """
        Get the url for this report schedule: chart or dashboard
        """
        if self._report_schedule.chart:
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
        screenshot: Optional[BaseScreenshot] = None
        if self._report_schedule.chart:
            url = self._get_url(standalone="true")
            screenshot = ChartScreenshot(url, self._report_schedule.chart.digest)
        else:
            url = self._get_url()
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

    def send(self) -> None:
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

    def is_in_grace_period(self) -> bool:
        """
        Checks if an alert is on it's grace period
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

    def is_on_working_timeout(self) -> bool:
        """
        Checks if an alert is on a working timeout
        """
        return (
            self._report_schedule.working_timeout is not None
            and self._report_schedule.last_eval_dttm is not None
            and datetime.utcnow()
            - timedelta(seconds=self._report_schedule.working_timeout)
            > self._report_schedule.last_eval_dttm
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
        except CommandException as ex:
            self.set_state_and_log(ReportState.ERROR, error_message=str(ex))
            raise ex


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
        self.set_state_and_log(ReportState.WORKING)
        if self._report_schedule.type == ReportScheduleType.ALERT:
            if self.is_in_grace_period():
                self.set_state_and_log(
                    ReportState.GRACE,
                    error_message=str(ReportScheduleAlertGracePeriodError()),
                )
                return
            self.set_state_and_log(
                ReportState.NOOP,
                error_message=str(ReportScheduleAlertEndGracePeriodError()),
            )
            return
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
        report_schedule: ReportSchedule,
        scheduled_dttm: datetime,
    ):
        self._session = session
        self._report_schedule = report_schedule
        self._scheduled_dttm = scheduled_dttm

    def run(self) -> None:
        state_found = False
        for state_cls in self.states_cls:
            if (self._report_schedule.last_state is None and state_cls.initial) or (
                self._report_schedule.last_state in state_cls.current_states
            ):
                state_cls(
                    self._session, self._report_schedule, self._scheduled_dttm
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
                ReportScheduleStateMachine(
                    session, self._model, self._scheduled_dttm
                ).run()
            except CommandException as ex:
                raise ex
            except Exception as ex:
                raise ReportScheduleUnexpectedError(str(ex))

    def validate(  # pylint: disable=arguments-differ
        self, session: Session = None
    ) -> None:
        # Validate/populate model exists
        self._model = ReportScheduleDAO.find_by_id(self._model_id, session=session)
        if not self._model:
            raise ReportScheduleNotFoundError()
