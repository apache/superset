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
from datetime import datetime, timedelta
from typing import List, Optional
from unittest.mock import Mock, patch

import pytest
from contextlib2 import contextmanager
from flask_sqlalchemy import BaseQuery
from freezegun import freeze_time
from sqlalchemy.sql import func

from superset import db
from superset.models.core import Database
from superset.models.dashboard import Dashboard
from superset.models.reports import (
    ReportExecutionLog,
    ReportRecipients,
    ReportRecipientType,
    ReportSchedule,
    ReportScheduleType,
    ReportScheduleValidatorType,
    ReportState,
)
from superset.models.slice import Slice
from superset.reports.commands.exceptions import (
    AlertQueryError,
    AlertQueryInvalidTypeError,
    AlertQueryMultipleColumnsError,
    AlertQueryMultipleRowsError,
    ReportScheduleNotFoundError,
    ReportScheduleNotificationError,
    ReportSchedulePreviousWorkingError,
    ReportScheduleWorkingTimeoutError,
)
from superset.reports.commands.execute import AsyncExecuteReportScheduleCommand
from superset.utils.core import get_example_database
from tests.fixtures.birth_names_dashboard import load_birth_names_dashboard_with_slices
from tests.fixtures.world_bank_dashboard import (
    load_world_bank_dashboard_with_slices_module_scope,
)
from tests.reports.utils import insert_report_schedule
from tests.test_app import app
from tests.utils import read_fixture

pytestmark = pytest.mark.usefixtures(
    "load_world_bank_dashboard_with_slices_module_scope"
)


def get_target_from_report_schedule(report_schedule: ReportSchedule) -> List[str]:
    return [
        json.loads(recipient.recipient_config_json)["target"]
        for recipient in report_schedule.recipients
    ]


def get_error_logs_query(report_schedule: ReportSchedule) -> BaseQuery:
    return (
        db.session.query(ReportExecutionLog)
        .filter(
            ReportExecutionLog.report_schedule == report_schedule,
            ReportExecutionLog.state == ReportState.ERROR,
        )
        .order_by(ReportExecutionLog.end_dttm.desc())
    )


def get_notification_error_sent_count(report_schedule: ReportSchedule) -> int:
    logs = get_error_logs_query(report_schedule).all()
    notification_sent_logs = [
        log.error_message
        for log in logs
        if log.error_message == "Notification sent with error"
    ]
    return len(notification_sent_logs)


def assert_log(state: str, error_message: Optional[str] = None):
    db.session.commit()
    logs = db.session.query(ReportExecutionLog).all()
    if state == ReportState.WORKING:
        assert len(logs) == 1
        assert logs[0].error_message == error_message
        assert logs[0].state == state
        return
    # On error we send an email
    if state == ReportState.ERROR:
        assert len(logs) == 3
    else:
        assert len(logs) == 2
    log_states = [log.state for log in logs]
    assert ReportState.WORKING in log_states
    assert state in log_states
    assert error_message in [log.error_message for log in logs]


def create_report_notification(
    email_target: Optional[str] = None,
    slack_channel: Optional[str] = None,
    chart: Optional[Slice] = None,
    dashboard: Optional[Dashboard] = None,
    database: Optional[Database] = None,
    sql: Optional[str] = None,
    report_type: Optional[str] = None,
    validator_type: Optional[str] = None,
    validator_config_json: Optional[str] = None,
    grace_period: Optional[int] = None,
) -> ReportSchedule:
    report_type = report_type or ReportScheduleType.REPORT
    target = email_target or slack_channel
    config_json = {"target": target}
    if slack_channel:
        recipient = ReportRecipients(
            type=ReportRecipientType.SLACK,
            recipient_config_json=json.dumps(config_json),
        )
    else:
        recipient = ReportRecipients(
            type=ReportRecipientType.EMAIL,
            recipient_config_json=json.dumps(config_json),
        )

    report_schedule = insert_report_schedule(
        type=report_type,
        name=f"report",
        crontab=f"0 9 * * *",
        description=f"Daily report",
        sql=sql,
        chart=chart,
        dashboard=dashboard,
        database=database,
        recipients=[recipient],
        validator_type=validator_type,
        validator_config_json=validator_config_json,
        grace_period=grace_period,
    )
    return report_schedule


def cleanup_report_schedule(report_schedule: ReportSchedule) -> None:
    db.session.query(ReportExecutionLog).filter(
        ReportExecutionLog.report_schedule == report_schedule
    ).delete()
    db.session.query(ReportRecipients).filter(
        ReportRecipients.report_schedule == report_schedule
    ).delete()

    db.session.delete(report_schedule)
    db.session.commit()


@contextmanager
def create_test_table_context(database: Database):
    database.get_sqla_engine().execute(
        "CREATE TABLE test_table AS SELECT 1 as first, 2 as second"
    )
    database.get_sqla_engine().execute(
        "INSERT INTO test_table (first, second) VALUES (1, 2)"
    )
    database.get_sqla_engine().execute(
        "INSERT INTO test_table (first, second) VALUES (3, 4)"
    )

    yield db.session
    database.get_sqla_engine().execute("DROP TABLE test_table")


@pytest.yield_fixture()
def create_report_email_chart():
    with app.app_context():
        chart = db.session.query(Slice).first()
        report_schedule = create_report_notification(
            email_target="target@email.com", chart=chart
        )
        yield report_schedule

        cleanup_report_schedule(report_schedule)


@pytest.yield_fixture()
def create_report_email_dashboard():
    with app.app_context():
        dashboard = db.session.query(Dashboard).first()
        report_schedule = create_report_notification(
            email_target="target@email.com", dashboard=dashboard
        )
        yield report_schedule

        cleanup_report_schedule(report_schedule)


@pytest.yield_fixture()
def create_report_slack_chart():
    with app.app_context():
        chart = db.session.query(Slice).first()
        report_schedule = create_report_notification(
            slack_channel="slack_channel", chart=chart
        )
        yield report_schedule

        cleanup_report_schedule(report_schedule)


@pytest.yield_fixture()
def create_report_slack_chart_working():
    with app.app_context():
        chart = db.session.query(Slice).first()
        report_schedule = create_report_notification(
            slack_channel="slack_channel", chart=chart
        )
        report_schedule.last_state = ReportState.WORKING
        report_schedule.last_eval_dttm = datetime(2020, 1, 1, 0, 0)
        db.session.commit()
        yield report_schedule

        cleanup_report_schedule(report_schedule)


@pytest.yield_fixture()
def create_alert_slack_chart_success():
    with app.app_context():
        chart = db.session.query(Slice).first()
        report_schedule = create_report_notification(
            slack_channel="slack_channel",
            chart=chart,
            report_type=ReportScheduleType.ALERT,
        )
        report_schedule.last_state = ReportState.SUCCESS
        report_schedule.last_eval_dttm = datetime(2020, 1, 1, 0, 0)

        log = ReportExecutionLog(
            report_schedule=report_schedule,
            state=ReportState.SUCCESS,
            start_dttm=report_schedule.last_eval_dttm,
            end_dttm=report_schedule.last_eval_dttm,
            scheduled_dttm=report_schedule.last_eval_dttm,
        )
        db.session.add(log)
        db.session.commit()
        yield report_schedule

        cleanup_report_schedule(report_schedule)


@pytest.yield_fixture()
def create_alert_slack_chart_grace():
    with app.app_context():
        chart = db.session.query(Slice).first()
        report_schedule = create_report_notification(
            slack_channel="slack_channel",
            chart=chart,
            report_type=ReportScheduleType.ALERT,
        )
        report_schedule.last_state = ReportState.GRACE
        report_schedule.last_eval_dttm = datetime(2020, 1, 1, 0, 0)

        log = ReportExecutionLog(
            report_schedule=report_schedule,
            state=ReportState.SUCCESS,
            start_dttm=report_schedule.last_eval_dttm,
            end_dttm=report_schedule.last_eval_dttm,
            scheduled_dttm=report_schedule.last_eval_dttm,
        )
        db.session.add(log)
        db.session.commit()
        yield report_schedule

        cleanup_report_schedule(report_schedule)


@pytest.yield_fixture(
    params=["alert1", "alert2", "alert3", "alert4", "alert5", "alert6", "alert7",]
)
def create_alert_email_chart(request):
    param_config = {
        "alert1": {
            "sql": "SELECT 10 as metric",
            "validator_type": ReportScheduleValidatorType.OPERATOR,
            "validator_config_json": '{"op": ">", "threshold": 9}',
        },
        "alert2": {
            "sql": "SELECT 10 as metric",
            "validator_type": ReportScheduleValidatorType.OPERATOR,
            "validator_config_json": '{"op": ">=", "threshold": 10}',
        },
        "alert3": {
            "sql": "SELECT 10 as metric",
            "validator_type": ReportScheduleValidatorType.OPERATOR,
            "validator_config_json": '{"op": "<", "threshold": 11}',
        },
        "alert4": {
            "sql": "SELECT 10 as metric",
            "validator_type": ReportScheduleValidatorType.OPERATOR,
            "validator_config_json": '{"op": "<=", "threshold": 10}',
        },
        "alert5": {
            "sql": "SELECT 10 as metric",
            "validator_type": ReportScheduleValidatorType.OPERATOR,
            "validator_config_json": '{"op": "!=", "threshold": 11}',
        },
        "alert6": {
            "sql": "SELECT 'something' as metric",
            "validator_type": ReportScheduleValidatorType.NOT_NULL,
            "validator_config_json": "{}",
        },
        "alert7": {
            "sql": "SELECT {{ 5 + 5 }} as metric",
            "validator_type": ReportScheduleValidatorType.OPERATOR,
            "validator_config_json": '{"op": "!=", "threshold": 11}',
        },
    }
    with app.app_context():
        chart = db.session.query(Slice).first()
        example_database = get_example_database()
        with create_test_table_context(example_database):

            report_schedule = create_report_notification(
                email_target="target@email.com",
                chart=chart,
                report_type=ReportScheduleType.ALERT,
                database=example_database,
                sql=param_config[request.param]["sql"],
                validator_type=param_config[request.param]["validator_type"],
                validator_config_json=param_config[request.param][
                    "validator_config_json"
                ],
            )
            yield report_schedule

            cleanup_report_schedule(report_schedule)


@pytest.yield_fixture(
    params=[
        "alert1",
        "alert2",
        "alert3",
        "alert4",
        "alert5",
        "alert6",
        "alert7",
        "alert8",
        "alert9",
    ]
)
def create_no_alert_email_chart(request):
    param_config = {
        "alert1": {
            "sql": "SELECT 10 as metric",
            "validator_type": ReportScheduleValidatorType.OPERATOR,
            "validator_config_json": '{"op": "<", "threshold": 10}',
        },
        "alert2": {
            "sql": "SELECT 10 as metric",
            "validator_type": ReportScheduleValidatorType.OPERATOR,
            "validator_config_json": '{"op": ">=", "threshold": 11}',
        },
        "alert3": {
            "sql": "SELECT 10 as metric",
            "validator_type": ReportScheduleValidatorType.OPERATOR,
            "validator_config_json": '{"op": "<", "threshold": 10}',
        },
        "alert4": {
            "sql": "SELECT 10 as metric",
            "validator_type": ReportScheduleValidatorType.OPERATOR,
            "validator_config_json": '{"op": "<=", "threshold": 9}',
        },
        "alert5": {
            "sql": "SELECT 10 as metric",
            "validator_type": ReportScheduleValidatorType.OPERATOR,
            "validator_config_json": '{"op": "!=", "threshold": 10}',
        },
        "alert6": {
            "sql": "SELECT first from test_table where 1=0",
            "validator_type": ReportScheduleValidatorType.NOT_NULL,
            "validator_config_json": "{}",
        },
        "alert7": {
            "sql": "SELECT first from test_table where 1=0",
            "validator_type": ReportScheduleValidatorType.OPERATOR,
            "validator_config_json": '{"op": ">", "threshold": 0}',
        },
        "alert8": {
            "sql": "SELECT Null as metric",
            "validator_type": ReportScheduleValidatorType.NOT_NULL,
            "validator_config_json": "{}",
        },
        "alert9": {
            "sql": "SELECT Null as metric",
            "validator_type": ReportScheduleValidatorType.OPERATOR,
            "validator_config_json": '{"op": ">", "threshold": 0}',
        },
    }
    with app.app_context():
        chart = db.session.query(Slice).first()
        example_database = get_example_database()
        with create_test_table_context(example_database):

            report_schedule = create_report_notification(
                email_target="target@email.com",
                chart=chart,
                report_type=ReportScheduleType.ALERT,
                database=example_database,
                sql=param_config[request.param]["sql"],
                validator_type=param_config[request.param]["validator_type"],
                validator_config_json=param_config[request.param][
                    "validator_config_json"
                ],
            )
            yield report_schedule

            cleanup_report_schedule(report_schedule)


@pytest.yield_fixture(params=["alert1", "alert2"])
def create_mul_alert_email_chart(request):
    param_config = {
        "alert1": {
            "sql": "SELECT first, second from test_table",
            "validator_type": ReportScheduleValidatorType.OPERATOR,
            "validator_config_json": '{"op": "<", "threshold": 10}',
        },
        "alert2": {
            "sql": "SELECT first from test_table",
            "validator_type": ReportScheduleValidatorType.OPERATOR,
            "validator_config_json": '{"op": "<", "threshold": 10}',
        },
    }
    with app.app_context():
        chart = db.session.query(Slice).first()
        example_database = get_example_database()
        with create_test_table_context(example_database):

            report_schedule = create_report_notification(
                email_target="target@email.com",
                chart=chart,
                report_type=ReportScheduleType.ALERT,
                database=example_database,
                sql=param_config[request.param]["sql"],
                validator_type=param_config[request.param]["validator_type"],
                validator_config_json=param_config[request.param][
                    "validator_config_json"
                ],
            )
            yield report_schedule

            cleanup_report_schedule(report_schedule)


@pytest.yield_fixture(params=["alert1", "alert2"])
def create_invalid_sql_alert_email_chart(request):
    param_config = {
        "alert1": {
            "sql": "SELECT 'string' ",
            "validator_type": ReportScheduleValidatorType.OPERATOR,
            "validator_config_json": '{"op": "<", "threshold": 10}',
        },
        "alert2": {
            "sql": "SELECT first from foo_table",
            "validator_type": ReportScheduleValidatorType.OPERATOR,
            "validator_config_json": '{"op": "<", "threshold": 10}',
        },
    }
    with app.app_context():
        chart = db.session.query(Slice).first()
        example_database = get_example_database()
        with create_test_table_context(example_database):

            report_schedule = create_report_notification(
                email_target="target@email.com",
                chart=chart,
                report_type=ReportScheduleType.ALERT,
                database=example_database,
                sql=param_config[request.param]["sql"],
                validator_type=param_config[request.param]["validator_type"],
                validator_config_json=param_config[request.param][
                    "validator_config_json"
                ],
                grace_period=60 * 60,
            )
            yield report_schedule

            cleanup_report_schedule(report_schedule)


@pytest.mark.usefixtures(
    "load_birth_names_dashboard_with_slices", "create_report_email_chart"
)
@patch("superset.reports.notifications.email.send_email_smtp")
@patch("superset.utils.screenshots.ChartScreenshot.compute_and_cache")
def test_email_chart_report_schedule(
    screenshot_mock, email_mock, create_report_email_chart
):
    """
    ExecuteReport Command: Test chart email report schedule
    """
    # setup screenshot mock
    screenshot = read_fixture("sample.png")
    screenshot_mock.return_value = screenshot

    with freeze_time("2020-01-01T00:00:00Z"):
        AsyncExecuteReportScheduleCommand(
            create_report_email_chart.id, datetime.utcnow()
        ).run()

        notification_targets = get_target_from_report_schedule(
            create_report_email_chart
        )
        # assert that the link sent is correct
        assert (
            f'<a href="http://0.0.0.0:8080/superset/slice/'
            f'{create_report_email_chart.chart.id}/">Explore in Superset</a>'
            in email_mock.call_args[0][2]
        )
        # Assert the email smtp address
        assert email_mock.call_args[0][0] == notification_targets[0]
        # Assert the email inline screenshot
        smtp_images = email_mock.call_args[1]["images"]
        assert smtp_images[list(smtp_images.keys())[0]] == screenshot
        # Assert logs are correct
        assert_log(ReportState.SUCCESS)


@pytest.mark.usefixtures(
    "load_birth_names_dashboard_with_slices", "create_report_email_dashboard"
)
@patch("superset.reports.notifications.email.send_email_smtp")
@patch("superset.utils.screenshots.DashboardScreenshot.compute_and_cache")
def test_email_dashboard_report_schedule(
    screenshot_mock, email_mock, create_report_email_dashboard
):
    """
    ExecuteReport Command: Test dashboard email report schedule
    """
    # setup screenshot mock
    screenshot = read_fixture("sample.png")
    screenshot_mock.return_value = screenshot

    with freeze_time("2020-01-01T00:00:00Z"):
        AsyncExecuteReportScheduleCommand(
            create_report_email_dashboard.id, datetime.utcnow()
        ).run()

        notification_targets = get_target_from_report_schedule(
            create_report_email_dashboard
        )
        # Assert the email smtp address
        assert email_mock.call_args[0][0] == notification_targets[0]
        # Assert the email inline screenshot
        smtp_images = email_mock.call_args[1]["images"]
        assert smtp_images[list(smtp_images.keys())[0]] == screenshot
        # Assert logs are correct
        assert_log(ReportState.SUCCESS)


@pytest.mark.usefixtures(
    "load_birth_names_dashboard_with_slices", "create_report_slack_chart"
)
@patch("superset.reports.notifications.slack.WebClient.files_upload")
@patch("superset.utils.screenshots.ChartScreenshot.compute_and_cache")
def test_slack_chart_report_schedule(
    screenshot_mock, file_upload_mock, create_report_slack_chart
):
    """
    ExecuteReport Command: Test chart slack report schedule
    """
    # setup screenshot mock
    screenshot = read_fixture("sample.png")
    screenshot_mock.return_value = screenshot

    with freeze_time("2020-01-01T00:00:00Z"):
        AsyncExecuteReportScheduleCommand(
            create_report_slack_chart.id, datetime.utcnow()
        ).run()

        notification_targets = get_target_from_report_schedule(
            create_report_slack_chart
        )
        assert file_upload_mock.call_args[1]["channels"] == notification_targets[0]
        assert file_upload_mock.call_args[1]["file"] == screenshot

        # Assert logs are correct
        assert_log(ReportState.SUCCESS)


@pytest.mark.usefixtures("create_report_slack_chart")
def test_report_schedule_not_found(create_report_slack_chart):
    """
    ExecuteReport Command: Test report schedule not found
    """
    max_id = db.session.query(func.max(ReportSchedule.id)).scalar()
    with pytest.raises(ReportScheduleNotFoundError):
        AsyncExecuteReportScheduleCommand(max_id + 1, datetime.utcnow()).run()


@pytest.mark.usefixtures("create_report_slack_chart_working")
def test_report_schedule_working(create_report_slack_chart_working):
    """
    ExecuteReport Command: Test report schedule still working
    """
    # setup screenshot mock
    with freeze_time("2020-01-01T00:00:00Z"):
        with pytest.raises(ReportSchedulePreviousWorkingError):
            AsyncExecuteReportScheduleCommand(
                create_report_slack_chart_working.id, datetime.utcnow()
            ).run()

        assert_log(
            ReportState.WORKING,
            error_message=ReportSchedulePreviousWorkingError.message,
        )
        assert create_report_slack_chart_working.last_state == ReportState.WORKING


@pytest.mark.usefixtures("create_report_slack_chart_working")
def test_report_schedule_working_timeout(create_report_slack_chart_working):
    """
    ExecuteReport Command: Test report schedule still working but should timed out
    """
    # setup screenshot mock
    current_time = create_report_slack_chart_working.last_eval_dttm + timedelta(
        seconds=create_report_slack_chart_working.working_timeout + 1
    )

    with freeze_time(current_time):
        with pytest.raises(ReportScheduleWorkingTimeoutError):
            AsyncExecuteReportScheduleCommand(
                create_report_slack_chart_working.id, datetime.utcnow()
            ).run()

    # Only needed for MySQL, understand why
    db.session.commit()
    logs = db.session.query(ReportExecutionLog).all()
    assert len(logs) == 1
    assert logs[0].error_message == ReportScheduleWorkingTimeoutError.message
    assert logs[0].state == ReportState.ERROR

    assert create_report_slack_chart_working.last_state == ReportState.ERROR


@pytest.mark.usefixtures("create_alert_slack_chart_success")
def test_report_schedule_success_grace(create_alert_slack_chart_success):
    """
    ExecuteReport Command: Test report schedule on success to grace
    """
    # set current time to within the grace period
    current_time = create_alert_slack_chart_success.last_eval_dttm + timedelta(
        seconds=create_alert_slack_chart_success.grace_period - 10
    )

    with freeze_time(current_time):
        AsyncExecuteReportScheduleCommand(
            create_alert_slack_chart_success.id, datetime.utcnow()
        ).run()

    db.session.commit()
    assert create_alert_slack_chart_success.last_state == ReportState.GRACE


@pytest.mark.usefixtures("create_alert_slack_chart_grace")
def test_report_schedule_success_grace_end(create_alert_slack_chart_grace):
    """
    ExecuteReport Command: Test report schedule on grace to noop
    """
    # set current time to within the grace period
    current_time = create_alert_slack_chart_grace.last_eval_dttm + timedelta(
        seconds=create_alert_slack_chart_grace.grace_period + 1
    )

    with freeze_time(current_time):
        AsyncExecuteReportScheduleCommand(
            create_alert_slack_chart_grace.id, datetime.utcnow()
        ).run()

    db.session.commit()
    assert create_alert_slack_chart_grace.last_state == ReportState.NOOP


@pytest.mark.usefixtures("create_alert_email_chart")
@patch("superset.reports.notifications.email.send_email_smtp")
@patch("superset.utils.screenshots.ChartScreenshot.compute_and_cache")
def test_alert_limit_is_applied(screenshot_mock, email_mock, create_alert_email_chart):
    """
    ExecuteReport Command: Test that all alerts apply a SQL limit to stmts
    """

    with patch.object(
        create_alert_email_chart.database.db_engine_spec, "execute", return_value=None
    ) as execute_mock:
        with patch.object(
            create_alert_email_chart.database.db_engine_spec,
            "fetch_data",
            return_value=None,
        ) as fetch_data_mock:
            AsyncExecuteReportScheduleCommand(
                create_alert_email_chart.id, datetime.utcnow()
            ).run()
            assert "LIMIT 2" in execute_mock.call_args[0][1]


@pytest.mark.usefixtures(
    "load_birth_names_dashboard_with_slices", "create_report_email_dashboard"
)
@patch("superset.reports.notifications.email.send_email_smtp")
@patch("superset.utils.screenshots.DashboardScreenshot.compute_and_cache")
def test_email_dashboard_report_fails(
    screenshot_mock, email_mock, create_report_email_dashboard
):
    """
    ExecuteReport Command: Test dashboard email report schedule notification fails
    """
    # setup screenshot mock
    from smtplib import SMTPException

    screenshot = read_fixture("sample.png")
    screenshot_mock.return_value = screenshot
    email_mock.side_effect = SMTPException("Could not connect to SMTP XPTO")

    with pytest.raises(ReportScheduleNotificationError):
        AsyncExecuteReportScheduleCommand(
            create_report_email_dashboard.id, datetime.utcnow()
        ).run()

    assert_log(ReportState.ERROR, error_message="Could not connect to SMTP XPTO")


@pytest.mark.usefixtures(
    "load_birth_names_dashboard_with_slices", "create_alert_email_chart"
)
@patch("superset.reports.notifications.email.send_email_smtp")
@patch("superset.utils.screenshots.ChartScreenshot.compute_and_cache")
def test_slack_chart_alert(screenshot_mock, email_mock, create_alert_email_chart):
    """
    ExecuteReport Command: Test chart slack alert
    """
    # setup screenshot mock
    screenshot = read_fixture("sample.png")
    screenshot_mock.return_value = screenshot

    with freeze_time("2020-01-01T00:00:00Z"):
        AsyncExecuteReportScheduleCommand(
            create_alert_email_chart.id, datetime.utcnow()
        ).run()

        notification_targets = get_target_from_report_schedule(create_alert_email_chart)
        # Assert the email smtp address
        assert email_mock.call_args[0][0] == notification_targets[0]
        # Assert the email inline screenshot
        smtp_images = email_mock.call_args[1]["images"]
        assert smtp_images[list(smtp_images.keys())[0]] == screenshot
        # Assert logs are correct
        assert_log(ReportState.SUCCESS)


@pytest.mark.usefixtures("create_no_alert_email_chart")
def test_email_chart_no_alert(create_no_alert_email_chart):
    """
    ExecuteReport Command: Test chart email no alert
    """
    with freeze_time("2020-01-01T00:00:00Z"):
        AsyncExecuteReportScheduleCommand(
            create_no_alert_email_chart.id, datetime.utcnow()
        ).run()
    assert_log(ReportState.NOOP)


@pytest.mark.usefixtures("create_mul_alert_email_chart")
def test_email_mul_alert(create_mul_alert_email_chart):
    """
    ExecuteReport Command: Test chart email multiple rows
    """
    with freeze_time("2020-01-01T00:00:00Z"):
        with pytest.raises(
            (AlertQueryMultipleRowsError, AlertQueryMultipleColumnsError)
        ):
            AsyncExecuteReportScheduleCommand(
                create_mul_alert_email_chart.id, datetime.utcnow()
            ).run()


@pytest.mark.usefixtures("create_invalid_sql_alert_email_chart")
@patch("superset.reports.notifications.email.send_email_smtp")
def test_invalid_sql_alert(email_mock, create_invalid_sql_alert_email_chart):
    """
    ExecuteReport Command: Test alert with invalid SQL statements
    """
    with freeze_time("2020-01-01T00:00:00Z"):
        with pytest.raises((AlertQueryError, AlertQueryInvalidTypeError)):
            AsyncExecuteReportScheduleCommand(
                create_invalid_sql_alert_email_chart.id, datetime.utcnow()
            ).run()

        notification_targets = get_target_from_report_schedule(
            create_invalid_sql_alert_email_chart
        )
        # Assert the email smtp address, asserts a notification was sent with the error
        assert email_mock.call_args[0][0] == notification_targets[0]


@pytest.mark.usefixtures("create_invalid_sql_alert_email_chart")
@patch("superset.reports.notifications.email.send_email_smtp")
def test_grace_period_error(email_mock, create_invalid_sql_alert_email_chart):
    """
    ExecuteReport Command: Test alert grace period on error
    """
    with freeze_time("2020-01-01T00:00:00Z"):
        with pytest.raises((AlertQueryError, AlertQueryInvalidTypeError)):
            AsyncExecuteReportScheduleCommand(
                create_invalid_sql_alert_email_chart.id, datetime.utcnow()
            ).run()

        # Only needed for MySQL, understand why
        db.session.commit()
        notification_targets = get_target_from_report_schedule(
            create_invalid_sql_alert_email_chart
        )
        # Assert the email smtp address, asserts a notification was sent with the error
        assert email_mock.call_args[0][0] == notification_targets[0]
        assert (
            get_notification_error_sent_count(create_invalid_sql_alert_email_chart) == 1
        )

    with freeze_time("2020-01-01T00:30:00Z"):
        with pytest.raises((AlertQueryError, AlertQueryInvalidTypeError)):
            AsyncExecuteReportScheduleCommand(
                create_invalid_sql_alert_email_chart.id, datetime.utcnow()
            ).run()
        db.session.commit()
        assert (
            get_notification_error_sent_count(create_invalid_sql_alert_email_chart) == 1
        )

    # Grace period ends, assert a notification was sent
    with freeze_time("2020-01-01T01:30:00Z"):
        with pytest.raises((AlertQueryError, AlertQueryInvalidTypeError)):
            AsyncExecuteReportScheduleCommand(
                create_invalid_sql_alert_email_chart.id, datetime.utcnow()
            ).run()
        db.session.commit()
        assert (
            get_notification_error_sent_count(create_invalid_sql_alert_email_chart) == 2
        )


@pytest.mark.usefixtures("create_invalid_sql_alert_email_chart")
@patch("superset.reports.notifications.email.send_email_smtp")
@patch("superset.utils.screenshots.ChartScreenshot.compute_and_cache")
def test_grace_period_error_flap(
    screenshot_mock, email_mock, create_invalid_sql_alert_email_chart
):
    """
    ExecuteReport Command: Test alert grace period on error
    """
    with freeze_time("2020-01-01T00:00:00Z"):
        with pytest.raises((AlertQueryError, AlertQueryInvalidTypeError)):
            AsyncExecuteReportScheduleCommand(
                create_invalid_sql_alert_email_chart.id, datetime.utcnow()
            ).run()
        db.session.commit()
        # Assert we have 1 notification sent on the log
        assert (
            get_notification_error_sent_count(create_invalid_sql_alert_email_chart) == 1
        )

    with freeze_time("2020-01-01T00:30:00Z"):
        with pytest.raises((AlertQueryError, AlertQueryInvalidTypeError)):
            AsyncExecuteReportScheduleCommand(
                create_invalid_sql_alert_email_chart.id, datetime.utcnow()
            ).run()
        db.session.commit()
        assert (
            get_notification_error_sent_count(create_invalid_sql_alert_email_chart) == 1
        )

    # Change report_schedule to valid
    create_invalid_sql_alert_email_chart.sql = "SELECT 1 AS metric"
    create_invalid_sql_alert_email_chart.grace_period = 0
    db.session.merge(create_invalid_sql_alert_email_chart)
    db.session.commit()

    with freeze_time("2020-01-01T00:31:00Z"):
        # One success
        AsyncExecuteReportScheduleCommand(
            create_invalid_sql_alert_email_chart.id, datetime.utcnow()
        ).run()
        # Grace period ends
        AsyncExecuteReportScheduleCommand(
            create_invalid_sql_alert_email_chart.id, datetime.utcnow()
        ).run()

        db.session.commit()

    create_invalid_sql_alert_email_chart.sql = "SELECT 'first'"
    create_invalid_sql_alert_email_chart.grace_period = 10
    db.session.merge(create_invalid_sql_alert_email_chart)
    db.session.commit()

    # assert that after a success, when back to error we send the error notification
    # again
    with freeze_time("2020-01-01T00:32:00Z"):
        with pytest.raises((AlertQueryError, AlertQueryInvalidTypeError)):
            AsyncExecuteReportScheduleCommand(
                create_invalid_sql_alert_email_chart.id, datetime.utcnow()
            ).run()
        db.session.commit()
        assert (
            get_notification_error_sent_count(create_invalid_sql_alert_email_chart) == 2
        )
