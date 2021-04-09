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
from typing import List
from unittest.mock import patch

import pytest
from freezegun import freeze_time
from freezegun.api import FakeDatetime  # type: ignore

from superset.extensions import db
from superset.models.reports import ReportScheduleType
from superset.tasks.scheduler import cron_schedule_window, scheduler
from tests.reports.utils import insert_report_schedule
from tests.test_app import app


@pytest.mark.parametrize(
    "current_dttm, cron, excepted",
    [
        ("2020-01-01T08:59:01Z", "0 9 * * *", []),
        ("2020-01-01T08:59:02Z", "0 9 * * *", [FakeDatetime(2020, 1, 1, 9, 0)]),
        ("2020-01-01T08:59:59Z", "0 9 * * *", [FakeDatetime(2020, 1, 1, 9, 0)]),
        ("2020-01-01T09:00:00Z", "0 9 * * *", [FakeDatetime(2020, 1, 1, 9, 0)]),
        ("2020-01-01T09:00:01Z", "0 9 * * *", []),
    ],
)
def test_cron_schedule_window(
    current_dttm: str, cron: str, excepted: List[FakeDatetime]
):
    """
    Reports scheduler: Test cron schedule window
    """
    with app.app_context():

        with freeze_time(current_dttm):
            datetimes = cron_schedule_window(cron)
            assert list(datetimes) == excepted


@patch("superset.tasks.scheduler.execute.apply_async")
def test_scheduler_celery_timeout(execute_mock):
    """
    Reports scheduler: Test scheduler setting celery soft and hard timeout
    """
    with app.app_context():

        report_schedule = insert_report_schedule(
            type=ReportScheduleType.ALERT, name=f"report", crontab=f"0 9 * * *",
        )

        with freeze_time("2020-01-01T09:00:00Z"):
            scheduler()
            assert execute_mock.call_args[1]["soft_time_limit"] == 3601
            assert execute_mock.call_args[1]["time_limit"] == 3610
        db.session.delete(report_schedule)
        db.session.commit()


@patch("superset.tasks.scheduler.execute.apply_async")
def test_scheduler_celery_no_timeout(execute_mock):
    """
    Reports scheduler: Test scheduler setting celery soft and hard timeout
    """
    with app.app_context():
        app.config["ALERT_REPORTS_WORKING_TIME_OUT_KILL"] = False
        report_schedule = insert_report_schedule(
            type=ReportScheduleType.ALERT, name=f"report", crontab=f"0 9 * * *",
        )

        with freeze_time("2020-01-01T09:00:00Z"):
            scheduler()
            assert execute_mock.call_args[1] == {"eta": FakeDatetime(2020, 1, 1, 9, 0)}
        db.session.delete(report_schedule)
        db.session.commit()
