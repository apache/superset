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

from random import randint
from unittest.mock import patch

import pytest
from flask_appbuilder.security.sqla.models import User
from freezegun import freeze_time
from freezegun.api import FakeDatetime

from superset.extensions import db
from superset.reports.models import ReportScheduleType
from superset.tasks.scheduler import execute, scheduler
from tests.integration_tests.reports.utils import insert_report_schedule
from tests.integration_tests.test_app import app


@pytest.fixture
def owners(get_user) -> list[User]:
    return [get_user("admin")]


@pytest.mark.usefixtures("app_context")
@patch("superset.tasks.scheduler.execute.apply_async")
def test_scheduler_celery_timeout_ny(execute_mock, owners):
    """
    Reports scheduler: Test scheduler setting celery soft and hard timeout
    """
    report_schedule = insert_report_schedule(
        type=ReportScheduleType.ALERT,
        name="report",
        crontab="0 4 * * *",
        timezone="America/New_York",
        owners=owners,
    )

    with freeze_time("2020-01-01T09:00:00Z"):
        scheduler()
        assert execute_mock.call_args[1]["soft_time_limit"] == 3601
        assert execute_mock.call_args[1]["time_limit"] == 3610
    db.session.delete(report_schedule)
    db.session.commit()


@pytest.mark.usefixtures("app_context")
@patch("superset.tasks.scheduler.execute.apply_async")
def test_scheduler_celery_no_timeout_ny(execute_mock, owners):
    """
    Reports scheduler: Test scheduler setting celery soft and hard timeout
    """
    app.config["ALERT_REPORTS_WORKING_TIME_OUT_KILL"] = False
    report_schedule = insert_report_schedule(
        type=ReportScheduleType.ALERT,
        name="report",
        crontab="0 4 * * *",
        timezone="America/New_York",
        owners=owners,
    )

    with freeze_time("2020-01-01T09:00:00Z"):
        scheduler()
        assert execute_mock.call_args[1] == {"eta": FakeDatetime(2020, 1, 1, 9, 0)}
    db.session.delete(report_schedule)
    db.session.commit()
    app.config["ALERT_REPORTS_WORKING_TIME_OUT_KILL"] = True


@pytest.mark.usefixtures("app_context")
@patch("superset.tasks.scheduler.execute.apply_async")
def test_scheduler_celery_timeout_utc(execute_mock, owners):
    """
    Reports scheduler: Test scheduler setting celery soft and hard timeout
    """
    report_schedule = insert_report_schedule(
        type=ReportScheduleType.ALERT,
        name="report",
        crontab="0 9 * * *",
        timezone="UTC",
        owners=owners,
    )

    with freeze_time("2020-01-01T09:00:00Z"):
        scheduler()
        assert execute_mock.call_args[1]["soft_time_limit"] == 3601
        assert execute_mock.call_args[1]["time_limit"] == 3610
    db.session.delete(report_schedule)
    db.session.commit()


@pytest.mark.usefixtures("app_context")
@patch("superset.tasks.scheduler.execute.apply_async")
def test_scheduler_celery_no_timeout_utc(execute_mock, owners):
    """
    Reports scheduler: Test scheduler setting celery soft and hard timeout
    """
    app.config["ALERT_REPORTS_WORKING_TIME_OUT_KILL"] = False
    report_schedule = insert_report_schedule(
        type=ReportScheduleType.ALERT,
        name="report",
        crontab="0 9 * * *",
        timezone="UTC",
        owners=owners,
    )

    with freeze_time("2020-01-01T09:00:00Z"):
        scheduler()
        assert execute_mock.call_args[1] == {"eta": FakeDatetime(2020, 1, 1, 9, 0)}
    db.session.delete(report_schedule)
    db.session.commit()
    app.config["ALERT_REPORTS_WORKING_TIME_OUT_KILL"] = True


@pytest.mark.usefixtures("app_context")
@patch("superset.tasks.scheduler.is_feature_enabled")
@patch("superset.tasks.scheduler.execute.apply_async")
def test_scheduler_feature_flag_off(execute_mock, is_feature_enabled, owners):
    """
    Reports scheduler: Test scheduler with feature flag off
    """
    is_feature_enabled.return_value = False
    report_schedule = insert_report_schedule(
        type=ReportScheduleType.ALERT,
        name="report",
        crontab="0 9 * * *",
        timezone="UTC",
        owners=owners,
    )

    with freeze_time("2020-01-01T09:00:00Z"):
        scheduler()
        execute_mock.assert_not_called()
    db.session.delete(report_schedule)
    db.session.commit()


@pytest.mark.usefixtures("app_context")
@patch("superset.commands.report.execute.AsyncExecuteReportScheduleCommand.__init__")
@patch("superset.commands.report.execute.AsyncExecuteReportScheduleCommand.run")
@patch("superset.tasks.scheduler.execute.update_state")
def test_execute_task(update_state_mock, command_mock, init_mock, owners):
    from superset.commands.report.exceptions import ReportScheduleUnexpectedError

    report_schedule = insert_report_schedule(
        type=ReportScheduleType.ALERT,
        name=f"report-{randint(0,1000)}",
        crontab="0 4 * * *",
        timezone="America/New_York",
        owners=owners,
    )
    init_mock.return_value = None
    command_mock.side_effect = ReportScheduleUnexpectedError("Unexpected error")
    with freeze_time("2020-01-01T09:00:00Z"):
        execute(report_schedule.id)
        update_state_mock.assert_called_with(state="FAILURE")

    db.session.delete(report_schedule)
    db.session.commit()


@pytest.mark.usefixtures("app_context")
@patch("superset.commands.report.execute.AsyncExecuteReportScheduleCommand.__init__")
@patch("superset.commands.report.execute.AsyncExecuteReportScheduleCommand.run")
@patch("superset.tasks.scheduler.execute.update_state")
@patch("superset.utils.log.logger")
def test_execute_task_with_command_exception(
    logger_mock, update_state_mock, command_mock, init_mock, owners
):
    from superset.commands.exceptions import CommandException

    report_schedule = insert_report_schedule(
        type=ReportScheduleType.ALERT,
        name=f"report-{randint(0,1000)}",
        crontab="0 4 * * *",
        timezone="America/New_York",
        owners=owners,
    )
    init_mock.return_value = None
    command_mock.side_effect = CommandException("Unexpected error")
    with freeze_time("2020-01-01T09:00:00Z"):
        execute(report_schedule.id)
        update_state_mock.assert_called_with(state="FAILURE")
        logger_mock.exception.assert_called_with(
            "A downstream exception occurred while generating a report: None. Unexpected error",
            exc_info=True,
        )

    db.session.delete(report_schedule)
    db.session.commit()
