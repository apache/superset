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

from functools import wraps
from typing import Any, Callable
from unittest.mock import patch

import pytest

from superset.commands.report.base import BaseReportScheduleCommand
from superset.commands.report.exceptions import ReportScheduleFrequencyNotAllowed
from superset.reports.models import ReportScheduleType

REPORT_TYPES = {
    ReportScheduleType.ALERT,
    ReportScheduleType.REPORT,
}

TEST_SCHEDULES_EVERY_MINUTE = {
    "* * * * *",
    "1-5 * * * *",
    "10-20 * * * *",
    "0,45,10-20 * * * *",
    "23,45,50,51 * * * *",
    "10,20,30,40-45 * * * *",
}

TEST_SCHEDULES_SINGLE_MINUTES = {
    "1,5,8,10,12 * * * *",
    "10 1 * * *",
    "27,2 1-5 * * *",
}

TEST_SCHEDULES = TEST_SCHEDULES_EVERY_MINUTE.union(TEST_SCHEDULES_SINGLE_MINUTES)


def app_custom_config(
    alert_minimal: int | None = None,
    report_minimal: int | None = None,
) -> Callable[[Callable[..., Any]], Callable[..., Any]]:
    """
    Decorator to mock the current_app.config values dynamically for each test.

    :param alert_minimal: Minimum interval in minutes for alerts. Defaults to None.
    :param report_minimal: Minimum interval in minutes for reports. Defaults to None.

    :returns: A decorator that wraps a function.
    """

    def decorator(func: Callable[..., Any]) -> Callable[..., Any]:
        @wraps(func)
        def wrapper(*args: Any, **kwargs: Any) -> Any:
            with patch(
                "superset.commands.report.base.current_app.config"
            ) as mock_config:
                mock_config.get.side_effect = lambda key: {
                    "ALERT_MINIMAL_INTERVAL_MINUTES": alert_minimal,
                    "REPORT_MINIMAL_INTERVAL_MINUTES": report_minimal,
                }.get(key)
                return func(*args, **kwargs)

        return wrapper

    return decorator


@app_custom_config()
def test_validate_report_frequency() -> None:
    """
    Test the ``validate_report_frequency`` method when there's
    no minimal frequency configured.
    """
    for report_type in REPORT_TYPES:
        for schedule in TEST_SCHEDULES:
            BaseReportScheduleCommand().validate_report_frequency(
                schedule,
                report_type,
            )


@app_custom_config(alert_minimal=4, report_minimal=5)
def test_validate_report_frequency_minimal_set() -> None:
    """
    Test the ``validate_report_frequency`` method when there's
    minimal frequencies configured.
    """

    BaseReportScheduleCommand().validate_report_frequency(
        "1,5 * * * *",
        ReportScheduleType.ALERT,
    )
    BaseReportScheduleCommand().validate_report_frequency(
        "6,11 * * * *",
        ReportScheduleType.REPORT,
    )


@app_custom_config(alert_minimal=2, report_minimal=5)
def test_validate_report_frequency_invalid_schedule() -> None:
    """
    Test the ``validate_report_frequency`` method when the configured
    schedule exceeds the limit.
    """
    with pytest.raises(ReportScheduleFrequencyNotAllowed):
        BaseReportScheduleCommand().validate_report_frequency(
            "1,2 * * * *",
            ReportScheduleType.ALERT,
        )

    with pytest.raises(ReportScheduleFrequencyNotAllowed):
        BaseReportScheduleCommand().validate_report_frequency(
            "1,5 * * * *",
            ReportScheduleType.REPORT,
        )


@app_custom_config(alert_minimal=10)
def test_validate_report_frequency_alert_only() -> None:
    """
    Test the ``validate_report_frequency`` method when there's
    only a configuration for alerts and user is creating report.
    """
    for schedule in TEST_SCHEDULES:
        BaseReportScheduleCommand().validate_report_frequency(
            schedule,
            ReportScheduleType.REPORT,
        )


@app_custom_config(report_minimal=10)
def test_validate_report_frequency_report_only() -> None:
    """
    Test the ``validate_report_frequency`` method when there's
    only a configuration for reports and user is creating alert.
    """
    for schedule in TEST_SCHEDULES:
        BaseReportScheduleCommand().validate_report_frequency(
            schedule,
            ReportScheduleType.ALERT,
        )


@app_custom_config(alert_minimal=1, report_minimal=1)
def test_validate_report_frequency_accepts_every_minute_with_one() -> None:
    """
    Test the ``validate_report_frequency`` method when configuration
    is set to `1`. Validates the usage of `-` and `*` in the cron.
    """
    for report_type in REPORT_TYPES:
        for schedule in TEST_SCHEDULES:
            BaseReportScheduleCommand().validate_report_frequency(
                schedule,
                report_type,
            )


@app_custom_config(alert_minimal=2, report_minimal=2)
def test_validate_report_frequency_accepts_every_minute_with_two() -> None:
    """
    Test the ``validate_report_frequency`` method when configuration
    is set to `2`. Validates the usage of `-` and `*` in the cron.
    """
    for report_type in REPORT_TYPES:
        # Should fail for schedules with `-` and `*`
        for schedule in TEST_SCHEDULES_EVERY_MINUTE:
            with pytest.raises(ReportScheduleFrequencyNotAllowed):
                BaseReportScheduleCommand().validate_report_frequency(
                    schedule,
                    report_type,
                )

        # Should work for schedules with single with bigger intervals
        for schedule in TEST_SCHEDULES_SINGLE_MINUTES:
            BaseReportScheduleCommand().validate_report_frequency(
                schedule,
                report_type,
            )
