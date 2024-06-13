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

from __future__ import annotations

import logging
from datetime import timedelta
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


def dynamic_alert_minimum_interval(**kwargs) -> int:
    return int(timedelta(minutes=10).total_seconds())


def dynamic_report_minimum_interval(**kwargs) -> int:
    return int(timedelta(minutes=5).total_seconds())


def app_custom_config(
    alert_minimum_interval: int | str | Callable[[], int] = 0,
    report_minimum_interval: int | str | Callable[[], int] = 0,
) -> Callable[[Callable[..., Any]], Callable[..., Any]]:
    """
    Decorator to mock the current_app.config values dynamically for each test.

    :param alert_minimum_interval: Minimum interval. Defaults to None.
    :param report_minimum_interval: Minimum interval. Defaults to None.

    :returns: A decorator that wraps a function.
    """

    def decorator(func: Callable[..., Any]) -> Callable[..., Any]:
        @wraps(func)
        def wrapper(*args: Any, **kwargs: Any) -> Any:
            with patch(
                "superset.commands.report.base.current_app.config"
            ) as mock_config:
                mock_config.get.side_effect = lambda key, default=0: {
                    "ALERT_MINIMUM_INTERVAL": alert_minimum_interval,
                    "REPORT_MINIMUM_INTERVAL": report_minimum_interval,
                }.get(key, default)
                return func(*args, **kwargs)

        return wrapper

    return decorator


@pytest.mark.parametrize("report_type", REPORT_TYPES)
@pytest.mark.parametrize("schedule", TEST_SCHEDULES)
@app_custom_config()
def test_validate_report_frequency(report_type: str, schedule: str) -> None:
    """
    Test the ``validate_report_frequency`` method when there's
    no minimum frequency configured.
    """
    BaseReportScheduleCommand().validate_report_frequency(
        schedule,
        report_type,
    )


@app_custom_config(
    alert_minimum_interval=int(timedelta(minutes=4).total_seconds()),
    report_minimum_interval=int(timedelta(minutes=5).total_seconds()),
)
def test_validate_report_frequency_minimum_set() -> None:
    """
    Test the ``validate_report_frequency`` method when there's
    minimum frequencies configured.
    """

    BaseReportScheduleCommand().validate_report_frequency(
        "1,5 * * * *",
        ReportScheduleType.ALERT,
    )
    BaseReportScheduleCommand().validate_report_frequency(
        "6,11 * * * *",
        ReportScheduleType.REPORT,
    )


@app_custom_config(
    alert_minimum_interval=int(timedelta(minutes=2).total_seconds()),
    report_minimum_interval=int(timedelta(minutes=5).total_seconds()),
)
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


@pytest.mark.parametrize("schedule", TEST_SCHEDULES)
@app_custom_config(
    alert_minimum_interval=int(timedelta(minutes=10).total_seconds()),
)
def test_validate_report_frequency_alert_only(schedule: str) -> None:
    """
    Test the ``validate_report_frequency`` method when there's
    only a configuration for alerts and user is creating report.
    """
    BaseReportScheduleCommand().validate_report_frequency(
        schedule,
        ReportScheduleType.REPORT,
    )


@pytest.mark.parametrize("schedule", TEST_SCHEDULES)
@app_custom_config(
    report_minimum_interval=int(timedelta(minutes=10).total_seconds()),
)
def test_validate_report_frequency_report_only(schedule: str) -> None:
    """
    Test the ``validate_report_frequency`` method when there's
    only a configuration for reports and user is creating alert.
    """
    BaseReportScheduleCommand().validate_report_frequency(
        schedule,
        ReportScheduleType.ALERT,
    )


@pytest.mark.parametrize("report_type", REPORT_TYPES)
@pytest.mark.parametrize("schedule", TEST_SCHEDULES)
@app_custom_config(
    alert_minimum_interval=int(timedelta(minutes=1).total_seconds()),
    report_minimum_interval=int(timedelta(minutes=1).total_seconds()),
)
def test_validate_report_frequency_accepts_every_minute_with_one(
    report_type: str, schedule: str
) -> None:
    """
    Test the ``validate_report_frequency`` method when configuration
    is set to `1`. Validates the usage of `-` and `*` in the cron.
    """
    BaseReportScheduleCommand().validate_report_frequency(
        schedule,
        report_type,
    )


@pytest.mark.parametrize("report_type", REPORT_TYPES)
@pytest.mark.parametrize("schedule", TEST_SCHEDULES_SINGLE_MINUTES)
@app_custom_config(
    alert_minimum_interval=int(timedelta(minutes=2).total_seconds()),
    report_minimum_interval=int(timedelta(minutes=2).total_seconds()),
)
def test_validate_report_frequency_accepts_every_minute_with_two(
    report_type: str,
    schedule: str,
) -> None:
    """
    Test the ``validate_report_frequency`` method when configuration
    is set to `2`.
    """
    BaseReportScheduleCommand().validate_report_frequency(
        schedule,
        report_type,
    )


@pytest.mark.parametrize("report_type", REPORT_TYPES)
@pytest.mark.parametrize("schedule", TEST_SCHEDULES_EVERY_MINUTE)
@app_custom_config(
    alert_minimum_interval=int(timedelta(minutes=2).total_seconds()),
    report_minimum_interval=int(timedelta(minutes=2).total_seconds()),
)
def test_validate_report_frequency_accepts_every_minute_with_two_raises(
    report_type: str,
    schedule: str,
) -> None:
    """
    Test the ``validate_report_frequency`` method when configuration
    is set to `2`. Validates the usage of `-` and `*` in the cron.
    """
    # Should fail for schedules with `-` and `*`
    with pytest.raises(ReportScheduleFrequencyNotAllowed):
        BaseReportScheduleCommand().validate_report_frequency(
            schedule,
            report_type,
        )


@pytest.mark.parametrize("report_type", REPORT_TYPES)
@pytest.mark.parametrize("schedule", TEST_SCHEDULES)
@app_custom_config(
    alert_minimum_interval="10 minutes",
    report_minimum_interval="10 minutes",
)
def test_validate_report_frequency_invalid_config(
    caplog: pytest.LogCaptureFixture,
    report_type: str,
    schedule: str,
) -> None:
    """
    Test the ``validate_report_frequency`` method when the configuration
    is invalid.
    """
    caplog.set_level(logging.ERROR)
    BaseReportScheduleCommand().validate_report_frequency(
        schedule,
        report_type,
    )
    expected_error_message = (
        f"invalid value for {report_type}_MINIMUM_INTERVAL: 10 minutes"
    )
    assert expected_error_message.lower() in caplog.text.lower()


@app_custom_config(
    alert_minimum_interval=dynamic_alert_minimum_interval,
    report_minimum_interval=dynamic_report_minimum_interval,
)
def test_validate_report_frequency_using_callable() -> None:
    """
    Test the ``validate_report_frequency`` method when the config
    values are set to a function.
    """
    # Should fail with a 9 minutes interval, and work with 10
    with pytest.raises(ReportScheduleFrequencyNotAllowed):
        BaseReportScheduleCommand().validate_report_frequency(
            "1,10 * * * *",
            ReportScheduleType.ALERT,
        )

    BaseReportScheduleCommand().validate_report_frequency(
        "1,11 * * * *",
        ReportScheduleType.ALERT,
    )

    # Should fail with a 4 minutes interval, and work with 5
    with pytest.raises(ReportScheduleFrequencyNotAllowed):
        BaseReportScheduleCommand().validate_report_frequency(
            "1,5 * * * *",
            ReportScheduleType.REPORT,
        )

    BaseReportScheduleCommand().validate_report_frequency(
        "1,6 * * * *",
        ReportScheduleType.REPORT,
    )
