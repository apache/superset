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

from contextlib import contextmanager
from typing import Any, Optional
from uuid import uuid4

from flask_appbuilder.security.sqla.models import User

from superset import db, security_manager
from superset.key_value.models import KeyValueEntry
from superset.models.core import Database
from superset.models.dashboard import Dashboard
from superset.models.slice import Slice
from superset.reports.models import (
    ReportDataFormat,
    ReportExecutionLog,
    ReportRecipients,
    ReportRecipientType,
    ReportSchedule,
    ReportScheduleType,
    ReportState,
)
from superset.utils import json
from superset.utils.core import override_user
from tests.integration_tests.test_app import app  # noqa: F401
from tests.integration_tests.utils import read_fixture

TEST_ID = str(uuid4())
CSV_FILE = read_fixture("trends.csv")
SCREENSHOT_FILE = read_fixture("sample.png")
DEFAULT_OWNER_EMAIL = "admin@fab.org"


def insert_report_schedule(
    type: str,
    name: str,
    crontab: str,
    owners: list[User],
    timezone: Optional[str] = None,
    sql: Optional[str] = None,
    description: Optional[str] = None,
    chart: Optional[Slice] = None,
    dashboard: Optional[Dashboard] = None,
    database: Optional[Database] = None,
    validator_type: Optional[str] = None,
    validator_config_json: Optional[str] = None,
    log_retention: Optional[int] = None,
    last_state: Optional[ReportState] = None,
    grace_period: Optional[int] = None,
    recipients: Optional[list[ReportRecipients]] = None,
    report_format: Optional[ReportDataFormat] = None,
    logs: Optional[list[ReportExecutionLog]] = None,
    extra: Optional[dict[Any, Any]] = None,
    force_screenshot: bool = False,
) -> ReportSchedule:
    owners = owners or []
    recipients = recipients or []
    logs = logs or []
    last_state = last_state or ReportState.NOOP

    with override_user(owners[0]):
        report_schedule = ReportSchedule(
            type=type,
            name=name,
            crontab=crontab,
            timezone=timezone,
            sql=sql,
            description=description,
            chart=chart,
            dashboard=dashboard,
            database=database,
            owners=owners,
            validator_type=validator_type,
            validator_config_json=validator_config_json,
            log_retention=log_retention,
            grace_period=grace_period,
            recipients=recipients,
            logs=logs,
            last_state=last_state,
            report_format=report_format,
            extra=extra,
            force_screenshot=force_screenshot,
        )
    db.session.add(report_schedule)
    db.session.commit()
    return report_schedule


def create_report_notification(
    email_target: Optional[str] = None,
    slack_channel: Optional[str] = None,
    chart: Optional[Slice] = None,
    dashboard: Optional[Dashboard] = None,
    database: Optional[Database] = None,
    sql: Optional[str] = None,
    report_type: ReportScheduleType = ReportScheduleType.REPORT,
    validator_type: Optional[str] = None,
    validator_config_json: Optional[str] = None,
    grace_period: Optional[int] = None,
    report_format: Optional[ReportDataFormat] = None,
    name: Optional[str] = None,
    extra: Optional[dict[str, Any]] = None,
    force_screenshot: bool = False,
    owners: Optional[list[User]] = None,
    ccTarget: Optional[str] = None,  # noqa: N803
    bccTarget: Optional[str] = None,  # noqa: N803
) -> ReportSchedule:
    if not owners:
        owners = [
            (
                db.session.query(security_manager.user_model)
                .filter_by(email=DEFAULT_OWNER_EMAIL)
                .one_or_none()
            )
        ]

    if slack_channel:
        recipient = ReportRecipients(
            type=ReportRecipientType.SLACK,
            recipient_config_json=json.dumps(
                {
                    "target": slack_channel,
                }
            ),
        )
    else:
        recipient = ReportRecipients(
            type=ReportRecipientType.EMAIL,
            recipient_config_json=json.dumps(
                {"target": email_target, "ccTarget": ccTarget, "bccTarget": bccTarget}
            ),
        )

    if name is None:
        name = "report_with_csv" if report_format else "report"

    report_schedule = insert_report_schedule(
        report_type,
        name=name,
        crontab="0 9 * * *",
        description="Daily report",
        sql=sql,
        chart=chart,
        dashboard=dashboard,
        database=database,
        recipients=[recipient],
        owners=owners,
        validator_type=validator_type,
        validator_config_json=validator_config_json,
        grace_period=grace_period,
        report_format=report_format or ReportDataFormat.PNG,
        extra=extra,
        force_screenshot=force_screenshot,
    )
    return report_schedule


def cleanup_report_schedule(report_schedule: Optional[ReportSchedule] = None) -> None:
    if report_schedule:
        db.session.query(ReportExecutionLog).filter(
            ReportExecutionLog.report_schedule == report_schedule
        ).delete()
        db.session.query(ReportRecipients).filter(
            ReportRecipients.report_schedule == report_schedule
        ).delete()
        db.session.delete(report_schedule)
    else:
        db.session.query(ReportExecutionLog).delete()
        db.session.query(ReportRecipients).delete()
        db.session.query(ReportSchedule).delete()
    db.session.commit()


@contextmanager
def create_dashboard_report(dashboard, extra, **kwargs):
    report_schedule = create_report_notification(
        email_target="target@example.com",
        dashboard=dashboard,
        extra={
            "dashboard": extra,
        },
        **kwargs,
    )
    error = None

    try:
        yield report_schedule
    except Exception as ex:  # pylint: disable=broad-except
        error = ex

    # make sure to clean up in case of yield exceptions
    cleanup_report_schedule(report_schedule)

    if error:
        raise error


def reset_key_values() -> None:
    db.session.query(KeyValueEntry).delete()
    db.session.commit()
