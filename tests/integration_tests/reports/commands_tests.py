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
from contextlib import contextmanager
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional
from unittest.mock import Mock, patch
from uuid import uuid4

import pytest
from flask_sqlalchemy import BaseQuery
from freezegun import freeze_time
from sqlalchemy.sql import func

from superset import db, security_manager
from superset.models.core import Database
from superset.models.dashboard import Dashboard
from superset.models.reports import (
    ReportDataFormat,
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
    ReportScheduleCsvFailedError,
    ReportScheduleCsvTimeout,
    ReportScheduleNotFoundError,
    ReportScheduleNotificationError,
    ReportSchedulePreviousWorkingError,
    ReportScheduleScreenshotFailedError,
    ReportScheduleScreenshotTimeout,
    ReportScheduleWorkingTimeoutError,
)
from superset.reports.commands.execute import AsyncExecuteReportScheduleCommand
from superset.reports.commands.log_prune import AsyncPruneReportScheduleLogCommand
from superset.utils.database import get_example_database
from tests.integration_tests.fixtures.birth_names_dashboard import (
    load_birth_names_dashboard_with_slices,
    load_birth_names_data,
)
from tests.integration_tests.fixtures.tabbed_dashboard import tabbed_dashboard
from tests.integration_tests.fixtures.world_bank_dashboard import (
    load_world_bank_dashboard_with_slices_module_scope,
    load_world_bank_data,
)
from tests.integration_tests.reports.utils import insert_report_schedule
from tests.integration_tests.test_app import app
from tests.integration_tests.utils import read_fixture

pytestmark = pytest.mark.usefixtures(
    "load_world_bank_dashboard_with_slices_module_scope"
)

TEST_ID = str(uuid4())
CSV_FILE = read_fixture("trends.csv")
SCREENSHOT_FILE = read_fixture("sample.png")
OWNER_EMAIL = "admin@fab.org"


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

    if state == ReportState.ERROR:
        # On error we send an email
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
    report_format: Optional[ReportDataFormat] = None,
    name: Optional[str] = None,
    extra: Optional[Dict[str, Any]] = None,
    force_screenshot: bool = False,
) -> ReportSchedule:
    report_type = report_type or ReportScheduleType.REPORT
    target = email_target or slack_channel
    config_json = {"target": target}
    owner = (
        db.session.query(security_manager.user_model)
        .filter_by(email=OWNER_EMAIL)
        .one_or_none()
    )

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

    if name is None:
        name = "report_with_csv" if report_format else "report"

    report_schedule = insert_report_schedule(
        type=report_type,
        name=name,
        crontab="0 9 * * *",
        description="Daily report",
        sql=sql,
        chart=chart,
        dashboard=dashboard,
        database=database,
        recipients=[recipient],
        owners=[owner],
        validator_type=validator_type,
        validator_config_json=validator_config_json,
        grace_period=grace_period,
        report_format=report_format or ReportDataFormat.VISUALIZATION,
        extra=extra,
        force_screenshot=force_screenshot,
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


@pytest.fixture()
def create_report_email_chart():
    with app.app_context():
        chart = db.session.query(Slice).first()
        report_schedule = create_report_notification(
            email_target="target@email.com", chart=chart
        )
        yield report_schedule

        cleanup_report_schedule(report_schedule)


@pytest.fixture()
def create_report_email_chart_force_screenshot():
    with app.app_context():
        chart = db.session.query(Slice).first()
        report_schedule = create_report_notification(
            email_target="target@email.com", chart=chart, force_screenshot=True
        )
        yield report_schedule

        cleanup_report_schedule(report_schedule)


@pytest.fixture()
def create_report_email_chart_with_csv():
    with app.app_context():
        chart = db.session.query(Slice).first()
        chart.query_context = '{"mock": "query_context"}'
        report_schedule = create_report_notification(
            email_target="target@email.com",
            chart=chart,
            report_format=ReportDataFormat.DATA,
        )
        yield report_schedule
        cleanup_report_schedule(report_schedule)


@pytest.fixture()
def create_report_email_chart_with_text():
    with app.app_context():
        chart = db.session.query(Slice).first()
        chart.query_context = '{"mock": "query_context"}'
        report_schedule = create_report_notification(
            email_target="target@email.com",
            chart=chart,
            report_format=ReportDataFormat.TEXT,
        )
        yield report_schedule
        cleanup_report_schedule(report_schedule)


@pytest.fixture()
def create_report_email_chart_with_csv_no_query_context():
    with app.app_context():
        chart = db.session.query(Slice).first()
        chart.query_context = None
        report_schedule = create_report_notification(
            email_target="target@email.com",
            chart=chart,
            report_format=ReportDataFormat.DATA,
            name="report_csv_no_query_context",
        )
        yield report_schedule
        cleanup_report_schedule(report_schedule)


@pytest.fixture()
def create_report_email_dashboard():
    with app.app_context():
        dashboard = db.session.query(Dashboard).first()
        report_schedule = create_report_notification(
            email_target="target@email.com", dashboard=dashboard
        )
        yield report_schedule

        cleanup_report_schedule(report_schedule)


@pytest.fixture()
def create_report_email_dashboard_force_screenshot():
    with app.app_context():
        dashboard = db.session.query(Dashboard).first()
        report_schedule = create_report_notification(
            email_target="target@email.com", dashboard=dashboard, force_screenshot=True
        )
        yield report_schedule

        cleanup_report_schedule(report_schedule)


@pytest.fixture()
def create_report_email_tabbed_dashboard(tabbed_dashboard):
    with app.app_context():
        report_schedule = create_report_notification(
            email_target="target@email.com",
            dashboard=tabbed_dashboard,
            extra={"dashboard_tab_ids": ["TAB-j53G4gtKGF", "TAB-nerWR09Ju",]},
        )
        yield report_schedule
        cleanup_report_schedule(report_schedule)


@pytest.fixture()
def create_report_slack_chart():
    with app.app_context():
        chart = db.session.query(Slice).first()
        report_schedule = create_report_notification(
            slack_channel="slack_channel", chart=chart
        )
        yield report_schedule

        cleanup_report_schedule(report_schedule)


@pytest.fixture()
def create_report_slack_chart_with_csv():
    with app.app_context():
        chart = db.session.query(Slice).first()
        chart.query_context = '{"mock": "query_context"}'
        report_schedule = create_report_notification(
            slack_channel="slack_channel",
            chart=chart,
            report_format=ReportDataFormat.DATA,
        )
        yield report_schedule

        cleanup_report_schedule(report_schedule)


@pytest.fixture()
def create_report_slack_chart_with_text():
    with app.app_context():
        chart = db.session.query(Slice).first()
        chart.query_context = '{"mock": "query_context"}'
        report_schedule = create_report_notification(
            slack_channel="slack_channel",
            chart=chart,
            report_format=ReportDataFormat.TEXT,
        )
        yield report_schedule

        cleanup_report_schedule(report_schedule)


@pytest.fixture()
def create_report_slack_chart_working():
    with app.app_context():
        chart = db.session.query(Slice).first()
        report_schedule = create_report_notification(
            slack_channel="slack_channel", chart=chart
        )
        report_schedule.last_state = ReportState.WORKING
        report_schedule.last_eval_dttm = datetime(2020, 1, 1, 0, 0)
        db.session.commit()
        log = ReportExecutionLog(
            scheduled_dttm=report_schedule.last_eval_dttm,
            start_dttm=report_schedule.last_eval_dttm,
            end_dttm=report_schedule.last_eval_dttm,
            state=ReportState.WORKING,
            report_schedule=report_schedule,
            uuid=uuid4(),
        )
        db.session.add(log)
        db.session.commit()

        yield report_schedule

        cleanup_report_schedule(report_schedule)


@pytest.fixture()
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


@pytest.fixture(
    params=["alert1",]
)
def create_alert_slack_chart_grace(request):
    param_config = {
        "alert1": {
            "sql": "SELECT count(*) from test_table",
            "validator_type": ReportScheduleValidatorType.OPERATOR,
            "validator_config_json": '{"op": "<", "threshold": 10}',
        },
    }
    with app.app_context():
        chart = db.session.query(Slice).first()
        example_database = get_example_database()
        with create_test_table_context(example_database):
            report_schedule = create_report_notification(
                slack_channel="slack_channel",
                chart=chart,
                report_type=ReportScheduleType.ALERT,
                database=example_database,
                sql=param_config[request.param]["sql"],
                validator_type=param_config[request.param]["validator_type"],
                validator_config_json=param_config[request.param][
                    "validator_config_json"
                ],
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


@pytest.fixture(
    params=[
        "alert1",
        "alert2",
        "alert3",
        "alert4",
        "alert5",
        "alert6",
        "alert7",
        "alert8",
    ]
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
        "alert8": {
            "sql": "SELECT 55 as metric",
            "validator_type": ReportScheduleValidatorType.OPERATOR,
            "validator_config_json": '{"op": ">", "threshold": 54.999}',
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
                force_screenshot=True,
            )
            yield report_schedule

            cleanup_report_schedule(report_schedule)


@pytest.fixture(
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


@pytest.fixture(params=["alert1", "alert2"])
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


@pytest.fixture(params=["alert1", "alert2"])
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
@patch("superset.utils.screenshots.ChartScreenshot.get_screenshot")
def test_email_chart_report_schedule(
    screenshot_mock, email_mock, create_report_email_chart,
):
    """
    ExecuteReport Command: Test chart email report schedule with screenshot
    """
    # setup screenshot mock
    screenshot_mock.return_value = SCREENSHOT_FILE

    with freeze_time("2020-01-01T00:00:00Z"):
        AsyncExecuteReportScheduleCommand(
            TEST_ID, create_report_email_chart.id, datetime.utcnow()
        ).run()

        notification_targets = get_target_from_report_schedule(
            create_report_email_chart
        )
        # assert that the link sent is correct
        assert (
            '<a href="http://0.0.0.0:8080/superset/explore/?'
            "form_data=%7B%22slice_id%22%3A%20"
            f"{create_report_email_chart.chart.id}%7D&"
            'standalone=0&force=false">Explore in Superset</a>'
            in email_mock.call_args[0][2]
        )
        # Assert the email smtp address
        assert email_mock.call_args[0][0] == notification_targets[0]
        # Assert the email inline screenshot
        smtp_images = email_mock.call_args[1]["images"]
        assert smtp_images[list(smtp_images.keys())[0]] == SCREENSHOT_FILE
        # Assert logs are correct
        assert_log(ReportState.SUCCESS)


@pytest.mark.usefixtures(
    "load_birth_names_dashboard_with_slices",
    "create_report_email_chart_force_screenshot",
)
@patch("superset.reports.notifications.email.send_email_smtp")
@patch("superset.utils.screenshots.ChartScreenshot.get_screenshot")
def test_email_chart_report_schedule_force_screenshot(
    screenshot_mock, email_mock, create_report_email_chart_force_screenshot,
):
    """
    ExecuteReport Command: Test chart email report schedule with screenshot

    In this test ``force_screenshot`` is true, and the screenshot URL should
    reflect that.
    """
    # setup screenshot mock
    screenshot_mock.return_value = SCREENSHOT_FILE

    with freeze_time("2020-01-01T00:00:00Z"):
        AsyncExecuteReportScheduleCommand(
            TEST_ID, create_report_email_chart_force_screenshot.id, datetime.utcnow()
        ).run()

        notification_targets = get_target_from_report_schedule(
            create_report_email_chart_force_screenshot
        )
        # assert that the link sent is correct
        assert (
            '<a href="http://0.0.0.0:8080/superset/explore/?'
            "form_data=%7B%22slice_id%22%3A%20"
            f"{create_report_email_chart_force_screenshot.chart.id}%7D&"
            'standalone=0&force=true">Explore in Superset</a>'
            in email_mock.call_args[0][2]
        )
        # Assert the email smtp address
        assert email_mock.call_args[0][0] == notification_targets[0]
        # Assert the email inline screenshot
        smtp_images = email_mock.call_args[1]["images"]
        assert smtp_images[list(smtp_images.keys())[0]] == SCREENSHOT_FILE
        # Assert logs are correct
        assert_log(ReportState.SUCCESS)


@pytest.mark.usefixtures(
    "load_birth_names_dashboard_with_slices", "create_alert_email_chart"
)
@patch("superset.reports.notifications.email.send_email_smtp")
@patch("superset.utils.screenshots.ChartScreenshot.get_screenshot")
def test_email_chart_alert_schedule(
    screenshot_mock, email_mock, create_alert_email_chart,
):
    """
    ExecuteReport Command: Test chart email alert schedule with screenshot
    """
    # setup screenshot mock
    screenshot_mock.return_value = SCREENSHOT_FILE

    with freeze_time("2020-01-01T00:00:00Z"):
        AsyncExecuteReportScheduleCommand(
            TEST_ID, create_alert_email_chart.id, datetime.utcnow()
        ).run()

        notification_targets = get_target_from_report_schedule(create_alert_email_chart)
        # assert that the link sent is correct
        assert (
            '<a href="http://0.0.0.0:8080/superset/explore/?'
            "form_data=%7B%22slice_id%22%3A%20"
            f"{create_alert_email_chart.chart.id}%7D&"
            'standalone=0&force=true">Explore in Superset</a>'
            in email_mock.call_args[0][2]
        )
        # Assert the email smtp address
        assert email_mock.call_args[0][0] == notification_targets[0]
        # Assert the email inline screenshot
        smtp_images = email_mock.call_args[1]["images"]
        assert smtp_images[list(smtp_images.keys())[0]] == SCREENSHOT_FILE
        # Assert logs are correct
        assert_log(ReportState.SUCCESS)


@pytest.mark.usefixtures(
    "load_birth_names_dashboard_with_slices", "create_report_email_chart"
)
@patch("superset.reports.notifications.email.send_email_smtp")
@patch("superset.utils.screenshots.ChartScreenshot.get_screenshot")
def test_email_chart_report_dry_run(
    screenshot_mock, email_mock, create_report_email_chart,
):
    """
    ExecuteReport Command: Test chart email report schedule dry run
    """
    # setup screenshot mock
    screenshot_mock.return_value = SCREENSHOT_FILE
    app.config["ALERT_REPORTS_NOTIFICATION_DRY_RUN"] = True
    with freeze_time("2020-01-01T00:00:00Z"):
        AsyncExecuteReportScheduleCommand(
            TEST_ID, create_report_email_chart.id, datetime.utcnow()
        ).run()

        email_mock.assert_not_called()
    app.config["ALERT_REPORTS_NOTIFICATION_DRY_RUN"] = False


@pytest.mark.usefixtures(
    "load_birth_names_dashboard_with_slices", "create_report_email_chart_with_csv"
)
@patch("superset.utils.csv.urllib.request.urlopen")
@patch("superset.utils.csv.urllib.request.OpenerDirector.open")
@patch("superset.reports.notifications.email.send_email_smtp")
@patch("superset.utils.csv.get_chart_csv_data")
def test_email_chart_report_schedule_with_csv(
    csv_mock, email_mock, mock_open, mock_urlopen, create_report_email_chart_with_csv,
):
    """
    ExecuteReport Command: Test chart email report schedule with CSV
    """
    # setup csv mock
    response = Mock()
    mock_open.return_value = response
    mock_urlopen.return_value = response
    mock_urlopen.return_value.getcode.return_value = 200
    response.read.return_value = CSV_FILE

    with freeze_time("2020-01-01T00:00:00Z"):
        AsyncExecuteReportScheduleCommand(
            TEST_ID, create_report_email_chart_with_csv.id, datetime.utcnow()
        ).run()

        notification_targets = get_target_from_report_schedule(
            create_report_email_chart_with_csv
        )
        # assert that the link sent is correct
        assert (
            '<a href="http://0.0.0.0:8080/superset/explore/?'
            "form_data=%7B%22slice_id%22%3A%20"
            f"{create_report_email_chart_with_csv.chart.id}%7D&"
            'standalone=0&force=false">Explore in Superset</a>'
            in email_mock.call_args[0][2]
        )
        # Assert the email smtp address
        assert email_mock.call_args[0][0] == notification_targets[0]
        # Assert the email csv file
        smtp_images = email_mock.call_args[1]["data"]
        assert smtp_images[list(smtp_images.keys())[0]] == CSV_FILE
        # Assert logs are correct
        assert_log(ReportState.SUCCESS)


@pytest.mark.usefixtures(
    "load_birth_names_dashboard_with_slices",
    "create_report_email_chart_with_csv_no_query_context",
)
@patch("superset.utils.csv.urllib.request.urlopen")
@patch("superset.utils.csv.urllib.request.OpenerDirector.open")
@patch("superset.reports.notifications.email.send_email_smtp")
@patch("superset.utils.csv.get_chart_csv_data")
@patch("superset.utils.screenshots.ChartScreenshot.get_screenshot")
def test_email_chart_report_schedule_with_csv_no_query_context(
    screenshot_mock,
    csv_mock,
    email_mock,
    mock_open,
    mock_urlopen,
    create_report_email_chart_with_csv_no_query_context,
):
    """
    ExecuteReport Command: Test chart email report schedule with CSV (no query context)
    """
    # setup screenshot mock
    screenshot_mock.return_value = SCREENSHOT_FILE

    # setup csv mock
    response = Mock()
    mock_open.return_value = response
    mock_urlopen.return_value = response
    mock_urlopen.return_value.getcode.return_value = 200
    response.read.return_value = CSV_FILE

    with freeze_time("2020-01-01T00:00:00Z"):
        AsyncExecuteReportScheduleCommand(
            TEST_ID,
            create_report_email_chart_with_csv_no_query_context.id,
            datetime.utcnow(),
        ).run()

        # verify that when query context is null we request a screenshot
        screenshot_mock.assert_called_once()


@pytest.mark.usefixtures(
    "load_birth_names_dashboard_with_slices", "create_report_email_chart_with_text"
)
@patch("superset.utils.csv.urllib.request.urlopen")
@patch("superset.utils.csv.urllib.request.OpenerDirector.open")
@patch("superset.reports.notifications.email.send_email_smtp")
@patch("superset.utils.csv.get_chart_dataframe")
def test_email_chart_report_schedule_with_text(
    dataframe_mock,
    email_mock,
    mock_open,
    mock_urlopen,
    create_report_email_chart_with_text,
):
    """
    ExecuteReport Command: Test chart email report schedule with text
    """
    # setup dataframe mock
    response = Mock()
    mock_open.return_value = response
    mock_urlopen.return_value = response
    mock_urlopen.return_value.getcode.return_value = 200
    response.read.return_value = json.dumps(
        {
            "result": [
                {
                    "data": {
                        "t1": {0: "c11", 1: "c21"},
                        "t2": {0: "c12", 1: "c22"},
                        "t3__sum": {0: "c13", 1: "c23"},
                    },
                    "colnames": [("t1",), ("t2",), ("t3__sum",)],
                    "indexnames": [(0,), (1,)],
                },
            ],
        }
    ).encode("utf-8")

    with freeze_time("2020-01-01T00:00:00Z"):
        AsyncExecuteReportScheduleCommand(
            TEST_ID, create_report_email_chart_with_text.id, datetime.utcnow()
        ).run()

        # assert that the data is embedded correctly
        table_html = """<table border="1" class="dataframe">
  <thead>
    <tr>
      <th></th>
      <th>t1</th>
      <th>t2</th>
      <th>t3__sum</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <th>0</th>
      <td>c11</td>
      <td>c12</td>
      <td>c13</td>
    </tr>
    <tr>
      <th>1</th>
      <td>c21</td>
      <td>c22</td>
      <td>c23</td>
    </tr>
  </tbody>
</table>"""
        assert table_html in email_mock.call_args[0][2]

        # Assert logs are correct
        assert_log(ReportState.SUCCESS)


@pytest.mark.usefixtures(
    "load_birth_names_dashboard_with_slices", "create_report_email_dashboard"
)
@patch("superset.reports.notifications.email.send_email_smtp")
@patch("superset.utils.screenshots.DashboardScreenshot.get_screenshot")
def test_email_dashboard_report_schedule(
    screenshot_mock, email_mock, create_report_email_dashboard
):
    """
    ExecuteReport Command: Test dashboard email report schedule
    """
    # setup screenshot mock
    screenshot_mock.return_value = SCREENSHOT_FILE

    with freeze_time("2020-01-01T00:00:00Z"):
        AsyncExecuteReportScheduleCommand(
            TEST_ID, create_report_email_dashboard.id, datetime.utcnow()
        ).run()

        notification_targets = get_target_from_report_schedule(
            create_report_email_dashboard
        )
        # Assert the email smtp address
        assert email_mock.call_args[0][0] == notification_targets[0]
        # Assert the email inline screenshot
        smtp_images = email_mock.call_args[1]["images"]
        assert smtp_images[list(smtp_images.keys())[0]] == SCREENSHOT_FILE
        # Assert logs are correct
        assert_log(ReportState.SUCCESS)


@pytest.mark.usefixtures(
    "load_birth_names_dashboard_with_slices",
    "create_report_email_dashboard_force_screenshot",
)
@patch("superset.reports.notifications.email.send_email_smtp")
@patch("superset.utils.screenshots.DashboardScreenshot.get_screenshot")
def test_email_dashboard_report_schedule_force_screenshot(
    screenshot_mock, email_mock, create_report_email_dashboard_force_screenshot
):
    """
    ExecuteReport Command: Test dashboard email report schedule
    """
    # setup screenshot mock
    screenshot_mock.return_value = SCREENSHOT_FILE

    with freeze_time("2020-01-01T00:00:00Z"):
        AsyncExecuteReportScheduleCommand(
            TEST_ID,
            create_report_email_dashboard_force_screenshot.id,
            datetime.utcnow(),
        ).run()

        notification_targets = get_target_from_report_schedule(
            create_report_email_dashboard_force_screenshot
        )

        # Assert the email smtp address
        assert email_mock.call_args[0][0] == notification_targets[0]
        # Assert the email inline screenshot
        smtp_images = email_mock.call_args[1]["images"]
        assert smtp_images[list(smtp_images.keys())[0]] == SCREENSHOT_FILE
        # Assert logs are correct
        assert_log(ReportState.SUCCESS)


@pytest.mark.usefixtures(
    "load_birth_names_dashboard_with_slices", "create_report_slack_chart"
)
@patch("superset.reports.notifications.slack.WebClient.files_upload")
@patch("superset.utils.screenshots.ChartScreenshot.get_screenshot")
def test_slack_chart_report_schedule(
    screenshot_mock, file_upload_mock, create_report_slack_chart,
):
    """
    ExecuteReport Command: Test chart slack report schedule
    """
    # setup screenshot mock
    screenshot_mock.return_value = SCREENSHOT_FILE

    with freeze_time("2020-01-01T00:00:00Z"):
        AsyncExecuteReportScheduleCommand(
            TEST_ID, create_report_slack_chart.id, datetime.utcnow()
        ).run()

        notification_targets = get_target_from_report_schedule(
            create_report_slack_chart
        )

        assert file_upload_mock.call_args[1]["channels"] == notification_targets[0]
        assert file_upload_mock.call_args[1]["file"] == SCREENSHOT_FILE

        # Assert logs are correct
        assert_log(ReportState.SUCCESS)


@pytest.mark.usefixtures(
    "load_birth_names_dashboard_with_slices", "create_report_slack_chart_with_csv"
)
@patch("superset.reports.notifications.slack.WebClient.files_upload")
@patch("superset.utils.csv.urllib.request.urlopen")
@patch("superset.utils.csv.urllib.request.OpenerDirector.open")
@patch("superset.utils.csv.get_chart_csv_data")
def test_slack_chart_report_schedule_with_csv(
    csv_mock,
    mock_open,
    mock_urlopen,
    file_upload_mock,
    create_report_slack_chart_with_csv,
):
    """
    ExecuteReport Command: Test chart slack report schedule with CSV
    """
    # setup csv mock
    response = Mock()
    mock_open.return_value = response
    mock_urlopen.return_value = response
    mock_urlopen.return_value.getcode.return_value = 200
    response.read.return_value = CSV_FILE

    with freeze_time("2020-01-01T00:00:00Z"):
        AsyncExecuteReportScheduleCommand(
            TEST_ID, create_report_slack_chart_with_csv.id, datetime.utcnow()
        ).run()

        notification_targets = get_target_from_report_schedule(
            create_report_slack_chart_with_csv
        )
        assert file_upload_mock.call_args[1]["channels"] == notification_targets[0]
        assert file_upload_mock.call_args[1]["file"] == CSV_FILE

        # Assert logs are correct
        assert_log(ReportState.SUCCESS)


@pytest.mark.usefixtures(
    "load_birth_names_dashboard_with_slices", "create_report_slack_chart_with_text"
)
@patch("superset.reports.notifications.slack.WebClient.chat_postMessage")
@patch("superset.utils.csv.urllib.request.urlopen")
@patch("superset.utils.csv.urllib.request.OpenerDirector.open")
@patch("superset.utils.csv.get_chart_dataframe")
def test_slack_chart_report_schedule_with_text(
    dataframe_mock,
    mock_open,
    mock_urlopen,
    post_message_mock,
    create_report_slack_chart_with_text,
):
    """
    ExecuteReport Command: Test chart slack report schedule with text
    """
    # setup dataframe mock
    response = Mock()
    mock_open.return_value = response
    mock_urlopen.return_value = response
    mock_urlopen.return_value.getcode.return_value = 200
    response.read.return_value = json.dumps(
        {
            "result": [
                {
                    "data": {
                        "t1": {0: "c11", 1: "c21"},
                        "t2": {0: "c12", 1: "c22"},
                        "t3__sum": {0: "c13", 1: "c23"},
                    },
                    "colnames": [("t1",), ("t2",), ("t3__sum",)],
                    "indexnames": [(0,), (1,)],
                },
            ],
        }
    ).encode("utf-8")

    with freeze_time("2020-01-01T00:00:00Z"):
        AsyncExecuteReportScheduleCommand(
            TEST_ID, create_report_slack_chart_with_text.id, datetime.utcnow()
        ).run()

        table_markdown = """|    | t1   | t2   | t3__sum   |
|---:|:-----|:-----|:----------|
|  0 | c11  | c12  | c13       |
|  1 | c21  | c22  | c23       |"""
        assert table_markdown in post_message_mock.call_args[1]["text"]
        assert (
            f"<http://0.0.0.0:8080/superset/explore/?form_data=%7B%22slice_id%22%3A%20{create_report_slack_chart_with_text.chart.id}%7D&standalone=0&force=false|Explore in Superset>"
            in post_message_mock.call_args[1]["text"]
        )

        # Assert logs are correct
        assert_log(ReportState.SUCCESS)


@pytest.mark.usefixtures("create_report_slack_chart")
def test_report_schedule_not_found(create_report_slack_chart):
    """
    ExecuteReport Command: Test report schedule not found
    """
    max_id = db.session.query(func.max(ReportSchedule.id)).scalar()
    with pytest.raises(ReportScheduleNotFoundError):
        AsyncExecuteReportScheduleCommand(TEST_ID, max_id + 1, datetime.utcnow()).run()


@pytest.mark.usefixtures("create_report_slack_chart_working")
def test_report_schedule_working(create_report_slack_chart_working):
    """
    ExecuteReport Command: Test report schedule still working
    """
    # setup screenshot mock
    with freeze_time("2020-01-01T00:00:00Z"):
        with pytest.raises(ReportSchedulePreviousWorkingError):
            AsyncExecuteReportScheduleCommand(
                TEST_ID, create_report_slack_chart_working.id, datetime.utcnow()
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
    current_time = create_report_slack_chart_working.last_eval_dttm + timedelta(
        seconds=create_report_slack_chart_working.working_timeout + 1
    )
    with freeze_time(current_time):

        with pytest.raises(ReportScheduleWorkingTimeoutError):
            AsyncExecuteReportScheduleCommand(
                TEST_ID, create_report_slack_chart_working.id, datetime.utcnow()
            ).run()

    # Only needed for MySQL, understand why
    db.session.commit()
    logs = db.session.query(ReportExecutionLog).all()
    # Two logs, first is created by fixture
    assert len(logs) == 2
    assert ReportScheduleWorkingTimeoutError.message in [
        log.error_message for log in logs
    ]
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
            TEST_ID, create_alert_slack_chart_success.id, datetime.utcnow()
        ).run()

    db.session.commit()
    assert create_alert_slack_chart_success.last_state == ReportState.GRACE


@pytest.mark.usefixtures("create_alert_slack_chart_grace")
@patch("superset.reports.notifications.slack.WebClient.files_upload")
@patch("superset.utils.screenshots.ChartScreenshot.get_screenshot")
def test_report_schedule_success_grace_end(
    screenshot_mock, file_upload_mock, create_alert_slack_chart_grace
):
    """
    ExecuteReport Command: Test report schedule on grace to noop
    """

    screenshot_mock.return_value = SCREENSHOT_FILE

    # set current time to after the grace period
    current_time = create_alert_slack_chart_grace.last_eval_dttm + timedelta(
        seconds=create_alert_slack_chart_grace.grace_period + 1
    )

    with freeze_time(current_time):
        AsyncExecuteReportScheduleCommand(
            TEST_ID, create_alert_slack_chart_grace.id, datetime.utcnow()
        ).run()

    db.session.commit()
    assert create_alert_slack_chart_grace.last_state == ReportState.SUCCESS


@pytest.mark.usefixtures("create_alert_email_chart")
@patch("superset.reports.notifications.email.send_email_smtp")
@patch("superset.utils.screenshots.ChartScreenshot.get_screenshot")
def test_alert_limit_is_applied(
    screenshot_mock, email_mock, create_alert_email_chart,
):
    """
    ExecuteReport Command: Test that all alerts apply a SQL limit to stmts
    """
    screenshot_mock.return_value = SCREENSHOT_FILE

    with patch.object(
        create_alert_email_chart.database.db_engine_spec, "execute", return_value=None
    ) as execute_mock:
        with patch.object(
            create_alert_email_chart.database.db_engine_spec,
            "fetch_data",
            return_value=None,
        ) as fetch_data_mock:
            AsyncExecuteReportScheduleCommand(
                TEST_ID, create_alert_email_chart.id, datetime.utcnow()
            ).run()
            assert "LIMIT 2" in execute_mock.call_args[0][1]


@pytest.mark.usefixtures(
    "load_birth_names_dashboard_with_slices", "create_report_email_dashboard"
)
@patch("superset.reports.notifications.email.send_email_smtp")
@patch("superset.utils.screenshots.DashboardScreenshot.get_screenshot")
def test_email_dashboard_report_fails(
    screenshot_mock, email_mock, create_report_email_dashboard
):
    """
    ExecuteReport Command: Test dashboard email report schedule notification fails
    """
    # setup screenshot mock
    from smtplib import SMTPException

    screenshot_mock.return_value = SCREENSHOT_FILE
    email_mock.side_effect = SMTPException("Could not connect to SMTP XPTO")

    with pytest.raises(ReportScheduleNotificationError):
        AsyncExecuteReportScheduleCommand(
            TEST_ID, create_report_email_dashboard.id, datetime.utcnow()
        ).run()

    assert_log(ReportState.ERROR, error_message="Could not connect to SMTP XPTO")


@pytest.mark.usefixtures(
    "load_birth_names_dashboard_with_slices", "create_alert_email_chart"
)
@patch("superset.reports.notifications.email.send_email_smtp")
@patch("superset.utils.screenshots.ChartScreenshot.get_screenshot")
@patch.dict(
    "superset.extensions.feature_flag_manager._feature_flags",
    ALERTS_ATTACH_REPORTS=True,
)
def test_slack_chart_alert(
    screenshot_mock, email_mock, create_alert_email_chart,
):
    """
    ExecuteReport Command: Test chart slack alert
    """
    # setup screenshot mock
    screenshot_mock.return_value = SCREENSHOT_FILE

    with freeze_time("2020-01-01T00:00:00Z"):
        AsyncExecuteReportScheduleCommand(
            TEST_ID, create_alert_email_chart.id, datetime.utcnow()
        ).run()

        notification_targets = get_target_from_report_schedule(create_alert_email_chart)
        # Assert the email smtp address
        assert email_mock.call_args[0][0] == notification_targets[0]
        # Assert the email inline screenshot
        smtp_images = email_mock.call_args[1]["images"]
        assert smtp_images[list(smtp_images.keys())[0]] == SCREENSHOT_FILE
        # Assert logs are correct
        assert_log(ReportState.SUCCESS)


@pytest.mark.usefixtures(
    "load_birth_names_dashboard_with_slices", "create_alert_email_chart"
)
@patch("superset.reports.notifications.email.send_email_smtp")
@patch.dict(
    "superset.extensions.feature_flag_manager._feature_flags",
    ALERTS_ATTACH_REPORTS=False,
)
def test_slack_chart_alert_no_attachment(email_mock, create_alert_email_chart):
    """
    ExecuteReport Command: Test chart slack alert
    """
    # setup screenshot mock

    with freeze_time("2020-01-01T00:00:00Z"):
        AsyncExecuteReportScheduleCommand(
            TEST_ID, create_alert_email_chart.id, datetime.utcnow()
        ).run()

        notification_targets = get_target_from_report_schedule(create_alert_email_chart)
        # Assert the email smtp address
        assert email_mock.call_args[0][0] == notification_targets[0]
        # Assert the there is no attached image
        assert email_mock.call_args[1]["images"] == {}
        # Assert logs are correct
        assert_log(ReportState.SUCCESS)


@pytest.mark.usefixtures(
    "load_birth_names_dashboard_with_slices", "create_report_slack_chart"
)
@patch("superset.reports.notifications.slack.WebClient")
@patch("superset.utils.screenshots.ChartScreenshot.get_screenshot")
def test_slack_token_callable_chart_report(
    screenshot_mock, slack_client_mock_class, create_report_slack_chart,
):
    """
    ExecuteReport Command: Test chart slack alert (slack token callable)
    """
    slack_client_mock_class.return_value = Mock()
    app.config["SLACK_API_TOKEN"] = Mock(return_value="cool_code")
    # setup screenshot mock
    screenshot_mock.return_value = SCREENSHOT_FILE

    with freeze_time("2020-01-01T00:00:00Z"):
        AsyncExecuteReportScheduleCommand(
            TEST_ID, create_report_slack_chart.id, datetime.utcnow()
        ).run()
        app.config["SLACK_API_TOKEN"].assert_called_once()
        assert slack_client_mock_class.called_with(token="cool_code", proxy="")
        assert_log(ReportState.SUCCESS)


@pytest.mark.usefixtures("create_no_alert_email_chart")
def test_email_chart_no_alert(create_no_alert_email_chart):
    """
    ExecuteReport Command: Test chart email no alert
    """
    with freeze_time("2020-01-01T00:00:00Z"):
        AsyncExecuteReportScheduleCommand(
            TEST_ID, create_no_alert_email_chart.id, datetime.utcnow()
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
                TEST_ID, create_mul_alert_email_chart.id, datetime.utcnow()
            ).run()


@pytest.mark.usefixtures(
    "load_birth_names_dashboard_with_slices", "create_alert_email_chart"
)
@patch("superset.reports.notifications.email.send_email_smtp")
def test_soft_timeout_alert(email_mock, create_alert_email_chart):
    """
    ExecuteReport Command: Test soft timeout on alert queries
    """
    from celery.exceptions import SoftTimeLimitExceeded

    from superset.reports.commands.exceptions import AlertQueryTimeout

    with patch.object(
        create_alert_email_chart.database.db_engine_spec, "execute", return_value=None
    ) as execute_mock:
        execute_mock.side_effect = SoftTimeLimitExceeded()
        with pytest.raises(AlertQueryTimeout):
            AsyncExecuteReportScheduleCommand(
                TEST_ID, create_alert_email_chart.id, datetime.utcnow()
            ).run()

    notification_targets = get_target_from_report_schedule(create_alert_email_chart)
    # Assert the email smtp address, asserts a notification was sent with the error
    assert email_mock.call_args[0][0] == OWNER_EMAIL

    assert_log(
        ReportState.ERROR, error_message="A timeout occurred while executing the query."
    )


@pytest.mark.usefixtures(
    "load_birth_names_dashboard_with_slices", "create_alert_email_chart"
)
@patch("superset.reports.notifications.email.send_email_smtp")
@patch("superset.utils.screenshots.ChartScreenshot.get_screenshot")
@patch.dict(
    "superset.extensions.feature_flag_manager._feature_flags",
    ALERTS_ATTACH_REPORTS=True,
)
def test_soft_timeout_screenshot(screenshot_mock, email_mock, create_alert_email_chart):
    """
    ExecuteReport Command: Test soft timeout on screenshot
    """
    from celery.exceptions import SoftTimeLimitExceeded

    screenshot_mock.side_effect = SoftTimeLimitExceeded()
    with pytest.raises(ReportScheduleScreenshotTimeout):
        AsyncExecuteReportScheduleCommand(
            TEST_ID, create_alert_email_chart.id, datetime.utcnow()
        ).run()

    # Assert the email smtp address, asserts a notification was sent with the error
    assert email_mock.call_args[0][0] == OWNER_EMAIL

    assert_log(
        ReportState.ERROR, error_message="A timeout occurred while taking a screenshot."
    )


@pytest.mark.usefixtures(
    "load_birth_names_dashboard_with_slices", "create_report_email_chart_with_csv"
)
@patch("superset.utils.csv.urllib.request.urlopen")
@patch("superset.utils.csv.urllib.request.OpenerDirector.open")
@patch("superset.reports.notifications.email.send_email_smtp")
@patch("superset.utils.csv.get_chart_csv_data")
def test_soft_timeout_csv(
    csv_mock, email_mock, mock_open, mock_urlopen, create_report_email_chart_with_csv,
):
    """
    ExecuteReport Command: Test fail on generating csv
    """
    from celery.exceptions import SoftTimeLimitExceeded

    response = Mock()
    mock_open.return_value = response
    mock_urlopen.return_value = response
    mock_urlopen.return_value.getcode.side_effect = SoftTimeLimitExceeded()

    with pytest.raises(ReportScheduleCsvTimeout):
        AsyncExecuteReportScheduleCommand(
            TEST_ID, create_report_email_chart_with_csv.id, datetime.utcnow()
        ).run()

    notification_targets = get_target_from_report_schedule(
        create_report_email_chart_with_csv
    )
    # Assert the email smtp address, asserts a notification was sent with the error
    assert email_mock.call_args[0][0] == OWNER_EMAIL

    assert_log(
        ReportState.ERROR, error_message="A timeout occurred while generating a csv.",
    )


@pytest.mark.usefixtures(
    "load_birth_names_dashboard_with_slices", "create_report_email_chart_with_csv"
)
@patch("superset.utils.csv.urllib.request.urlopen")
@patch("superset.utils.csv.urllib.request.OpenerDirector.open")
@patch("superset.reports.notifications.email.send_email_smtp")
@patch("superset.utils.csv.get_chart_csv_data")
def test_generate_no_csv(
    csv_mock, email_mock, mock_open, mock_urlopen, create_report_email_chart_with_csv,
):
    """
    ExecuteReport Command: Test fail on generating csv
    """
    response = Mock()
    mock_open.return_value = response
    mock_urlopen.return_value = response
    mock_urlopen.return_value.getcode.return_value = 200
    response.read.return_value = None

    with pytest.raises(ReportScheduleCsvFailedError):
        AsyncExecuteReportScheduleCommand(
            TEST_ID, create_report_email_chart_with_csv.id, datetime.utcnow()
        ).run()

    notification_targets = get_target_from_report_schedule(
        create_report_email_chart_with_csv
    )
    # Assert the email smtp address, asserts a notification was sent with the error
    assert email_mock.call_args[0][0] == OWNER_EMAIL

    assert_log(
        ReportState.ERROR,
        error_message="Report Schedule execution failed when generating a csv.",
    )


@pytest.mark.usefixtures(
    "load_birth_names_dashboard_with_slices", "create_report_email_chart"
)
@patch("superset.reports.notifications.email.send_email_smtp")
@patch("superset.utils.screenshots.ChartScreenshot.get_screenshot")
def test_fail_screenshot(screenshot_mock, email_mock, create_report_email_chart):
    """
    ExecuteReport Command: Test soft timeout on screenshot
    """
    from celery.exceptions import SoftTimeLimitExceeded

    from superset.reports.commands.exceptions import AlertQueryTimeout

    screenshot_mock.side_effect = Exception("Unexpected error")
    with pytest.raises(ReportScheduleScreenshotFailedError):
        AsyncExecuteReportScheduleCommand(
            TEST_ID, create_report_email_chart.id, datetime.utcnow()
        ).run()

    notification_targets = get_target_from_report_schedule(create_report_email_chart)
    # Assert the email smtp address, asserts a notification was sent with the error
    assert email_mock.call_args[0][0] == OWNER_EMAIL

    assert_log(
        ReportState.ERROR, error_message="Failed taking a screenshot Unexpected error"
    )


@pytest.mark.usefixtures(
    "load_birth_names_dashboard_with_slices", "create_report_email_chart_with_csv"
)
@patch("superset.reports.notifications.email.send_email_smtp")
@patch("superset.utils.csv.urllib.request.urlopen")
@patch("superset.utils.csv.urllib.request.OpenerDirector.open")
@patch("superset.utils.csv.get_chart_csv_data")
def test_fail_csv(
    csv_mock, mock_open, mock_urlopen, email_mock, create_report_email_chart_with_csv
):
    """
    ExecuteReport Command: Test error on csv
    """

    response = Mock()
    mock_open.return_value = response
    mock_urlopen.return_value = response
    mock_urlopen.return_value.getcode.return_value = 500

    with pytest.raises(ReportScheduleCsvFailedError):
        AsyncExecuteReportScheduleCommand(
            TEST_ID, create_report_email_chart_with_csv.id, datetime.utcnow()
        ).run()

    get_target_from_report_schedule(create_report_email_chart_with_csv)
    # Assert the email smtp address, asserts a notification was sent with the error
    assert email_mock.call_args[0][0] == OWNER_EMAIL

    assert_log(
        ReportState.ERROR, error_message="Failed generating csv <urlopen error 500>"
    )


@pytest.mark.usefixtures(
    "load_birth_names_dashboard_with_slices", "create_alert_email_chart"
)
@patch("superset.reports.notifications.email.send_email_smtp")
@patch.dict(
    "superset.extensions.feature_flag_manager._feature_flags",
    ALERTS_ATTACH_REPORTS=False,
)
def test_email_disable_screenshot(email_mock, create_alert_email_chart):
    """
    ExecuteReport Command: Test soft timeout on screenshot
    """

    AsyncExecuteReportScheduleCommand(
        TEST_ID, create_alert_email_chart.id, datetime.utcnow()
    ).run()

    notification_targets = get_target_from_report_schedule(create_alert_email_chart)
    # Assert the email smtp address, asserts a notification was sent with the error
    assert email_mock.call_args[0][0] == notification_targets[0]
    # Assert the there is no attached image
    assert email_mock.call_args[1]["images"] == {}

    assert_log(ReportState.SUCCESS)


@pytest.mark.usefixtures("create_invalid_sql_alert_email_chart")
@patch("superset.reports.notifications.email.send_email_smtp")
def test_invalid_sql_alert(email_mock, create_invalid_sql_alert_email_chart):
    """
    ExecuteReport Command: Test alert with invalid SQL statements
    """
    with freeze_time("2020-01-01T00:00:00Z"):
        with pytest.raises((AlertQueryError, AlertQueryInvalidTypeError)):
            AsyncExecuteReportScheduleCommand(
                TEST_ID, create_invalid_sql_alert_email_chart.id, datetime.utcnow()
            ).run()

        notification_targets = get_target_from_report_schedule(
            create_invalid_sql_alert_email_chart
        )
        # Assert the email smtp address, asserts a notification was sent with the error
        assert email_mock.call_args[0][0] == OWNER_EMAIL


@pytest.mark.usefixtures("create_invalid_sql_alert_email_chart")
@patch("superset.reports.notifications.email.send_email_smtp")
def test_grace_period_error(email_mock, create_invalid_sql_alert_email_chart):
    """
    ExecuteReport Command: Test alert grace period on error
    """
    with freeze_time("2020-01-01T00:00:00Z"):
        with pytest.raises((AlertQueryError, AlertQueryInvalidTypeError)):
            AsyncExecuteReportScheduleCommand(
                TEST_ID, create_invalid_sql_alert_email_chart.id, datetime.utcnow()
            ).run()

        # Only needed for MySQL, understand why
        db.session.commit()
        notification_targets = get_target_from_report_schedule(
            create_invalid_sql_alert_email_chart
        )
        # Assert the email smtp address, asserts a notification was sent with the error
        assert email_mock.call_args[0][0] == OWNER_EMAIL
        assert (
            get_notification_error_sent_count(create_invalid_sql_alert_email_chart) == 1
        )

    with freeze_time("2020-01-01T00:30:00Z"):
        with pytest.raises((AlertQueryError, AlertQueryInvalidTypeError)):
            AsyncExecuteReportScheduleCommand(
                TEST_ID, create_invalid_sql_alert_email_chart.id, datetime.utcnow()
            ).run()
        db.session.commit()
        assert (
            get_notification_error_sent_count(create_invalid_sql_alert_email_chart) == 1
        )

    # Grace period ends, assert a notification was sent
    with freeze_time("2020-01-01T01:30:00Z"):
        with pytest.raises((AlertQueryError, AlertQueryInvalidTypeError)):
            AsyncExecuteReportScheduleCommand(
                TEST_ID, create_invalid_sql_alert_email_chart.id, datetime.utcnow()
            ).run()
        db.session.commit()
        assert (
            get_notification_error_sent_count(create_invalid_sql_alert_email_chart) == 2
        )


@pytest.mark.usefixtures("create_invalid_sql_alert_email_chart")
@patch("superset.reports.notifications.email.send_email_smtp")
@patch("superset.utils.screenshots.ChartScreenshot.get_screenshot")
def test_grace_period_error_flap(
    screenshot_mock, email_mock, create_invalid_sql_alert_email_chart,
):
    """
    ExecuteReport Command: Test alert grace period on error
    """
    with freeze_time("2020-01-01T00:00:00Z"):
        with pytest.raises((AlertQueryError, AlertQueryInvalidTypeError)):
            AsyncExecuteReportScheduleCommand(
                TEST_ID, create_invalid_sql_alert_email_chart.id, datetime.utcnow()
            ).run()
        db.session.commit()
        # Assert we have 1 notification sent on the log
        assert (
            get_notification_error_sent_count(create_invalid_sql_alert_email_chart) == 1
        )

    with freeze_time("2020-01-01T00:30:00Z"):
        with pytest.raises((AlertQueryError, AlertQueryInvalidTypeError)):
            AsyncExecuteReportScheduleCommand(
                TEST_ID, create_invalid_sql_alert_email_chart.id, datetime.utcnow()
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
            TEST_ID, create_invalid_sql_alert_email_chart.id, datetime.utcnow()
        ).run()
        # Grace period ends
        AsyncExecuteReportScheduleCommand(
            TEST_ID, create_invalid_sql_alert_email_chart.id, datetime.utcnow()
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
                TEST_ID, create_invalid_sql_alert_email_chart.id, datetime.utcnow()
            ).run()
        db.session.commit()
        assert (
            get_notification_error_sent_count(create_invalid_sql_alert_email_chart) == 2
        )


@pytest.mark.usefixtures(
    "load_birth_names_dashboard_with_slices", "create_report_email_dashboard"
)
@patch("superset.reports.dao.ReportScheduleDAO.bulk_delete_logs")
def test_prune_log_soft_time_out(bulk_delete_logs, create_report_email_dashboard):
    from datetime import datetime, timedelta

    from celery.exceptions import SoftTimeLimitExceeded

    bulk_delete_logs.side_effect = SoftTimeLimitExceeded()
    with pytest.raises(SoftTimeLimitExceeded) as excinfo:
        AsyncPruneReportScheduleLogCommand().run()
    assert str(excinfo.value) == "SoftTimeLimitExceeded()"


@pytest.mark.usefixtures("create_report_email_tabbed_dashboard",)
@patch("superset.reports.notifications.email.send_email_smtp")
@patch("superset.reports.commands.execute.DashboardScreenshot",)
def test_when_tabs_are_selected_it_takes_screenshots_for_every_tabs(
    dashboard_screenshot_mock,
    send_email_smtp_mock,
    create_report_email_tabbed_dashboard,
):
    dashboard_screenshot_mock.get_screenshot.return_value = b"test-image"
    dashboard = create_report_email_tabbed_dashboard.dashboard

    AsyncExecuteReportScheduleCommand(
        TEST_ID, create_report_email_tabbed_dashboard.id, datetime.utcnow()
    ).run()

    tabs = json.loads(create_report_email_tabbed_dashboard.extra)["dashboard_tab_ids"]
    assert dashboard_screenshot_mock.call_count == 2
    for index, tab in enumerate(tabs):
        assert dashboard_screenshot_mock.call_args_list[index].args == (
            f"http://0.0.0.0:8080/superset/dashboard/{dashboard.id}/?standalone=3&force=false#{tab}",
            f"{dashboard.digest}",
        )
    assert send_email_smtp_mock.called is True
    assert len(send_email_smtp_mock.call_args.kwargs["images"]) == 2
