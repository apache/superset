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

import pytest
import pytz
from dateutil import parser
from freezegun import freeze_time
from freezegun.api import FakeDatetime

from superset.tasks.cron_util import cron_schedule_window


@pytest.mark.parametrize(
    "current_dttm, cron, expected",
    [
        ("2020-01-01T08:59:01Z", "0 1 * * *", []),
        (
            "2020-01-01T08:59:02Z",
            "0 1 * * *",
            [FakeDatetime(2020, 1, 1, 9, 0).strftime("%A, %d %B %Y, %H:%M:%S")],
        ),
        (
            "2020-01-01T08:59:59Z",
            "0 1 * * *",
            [FakeDatetime(2020, 1, 1, 9, 0).strftime("%A, %d %B %Y, %H:%M:%S")],
        ),
        (
            "2020-01-01T09:00:00Z",
            "0 1 * * *",
            [FakeDatetime(2020, 1, 1, 9, 0).strftime("%A, %d %B %Y, %H:%M:%S")],
        ),
        ("2020-01-01T09:00:01Z", "0 1 * * *", []),
    ],
)
def test_cron_schedule_window_los_angeles(
    current_dttm: str, cron: str, expected: list[FakeDatetime]
) -> None:
    """
    Reports scheduler: Test cron schedule window for "America/Los_Angeles"
    """

    with freeze_time(current_dttm):
        datetimes = cron_schedule_window(cron, "America/Los_Angeles")
        assert (
            list(cron.strftime("%A, %d %B %Y, %H:%M:%S") for cron in datetimes)
            == expected
        )


@pytest.mark.parametrize(
    "current_dttm, cron, expected",
    [
        ("2020-01-01T00:59:01Z", "0 1 * * *", []),
        (
            "2020-01-01T00:59:02Z",
            "0 1 * * *",
            [FakeDatetime(2020, 1, 1, 1, 0).strftime("%A, %d %B %Y, %H:%M:%S")],
        ),
        (
            "2020-01-01T00:59:59Z",
            "0 1 * * *",
            [FakeDatetime(2020, 1, 1, 1, 0).strftime("%A, %d %B %Y, %H:%M:%S")],
        ),
        (
            "2020-01-01T01:00:00Z",
            "0 1 * * *",
            [FakeDatetime(2020, 1, 1, 1, 0).strftime("%A, %d %B %Y, %H:%M:%S")],
        ),
        ("2020-01-01T01:00:01Z", "0 1 * * *", []),
    ],
)
def test_cron_schedule_window_invalid_timezone(
    current_dttm: str, cron: str, expected: list[FakeDatetime]
) -> None:
    """
    Reports scheduler: Test cron schedule window for "invalid timezone"
    """

    with freeze_time(current_dttm):
        datetimes = cron_schedule_window(cron, "invalid timezone")
        # it should default to UTC
        assert (
            list(cron.strftime("%A, %d %B %Y, %H:%M:%S") for cron in datetimes)
            == expected
        )


@pytest.mark.parametrize(
    "current_dttm, cron, expected",
    [
        ("2020-01-01T05:59:01Z", "0 1 * * *", []),
        (
            "2020-01-01T05:59:02Z",
            "0 1 * * *",
            [FakeDatetime(2020, 1, 1, 6, 0).strftime("%A, %d %B %Y, %H:%M:%S")],
        ),
        (
            "2020-01-01T5:59:59Z",
            "0 1 * * *",
            [FakeDatetime(2020, 1, 1, 6, 0).strftime("%A, %d %B %Y, %H:%M:%S")],
        ),
        (
            "2020-01-01T6:00:00",
            "0 1 * * *",
            [FakeDatetime(2020, 1, 1, 6, 0).strftime("%A, %d %B %Y, %H:%M:%S")],
        ),
        ("2020-01-01T6:00:01Z", "0 1 * * *", []),
    ],
)
def test_cron_schedule_window_new_york(
    current_dttm: str, cron: str, expected: list[FakeDatetime]
) -> None:
    """
    Reports scheduler: Test cron schedule window for "America/New_York"
    """

    with freeze_time(current_dttm, tz_offset=0):
        datetimes = cron_schedule_window(cron, "America/New_York")
        assert (
            list(cron.strftime("%A, %d %B %Y, %H:%M:%S") for cron in datetimes)
            == expected
        )


@pytest.mark.parametrize(
    "current_dttm, cron, expected",
    [
        ("2020-01-01T06:59:01Z", "0 1 * * *", []),
        (
            "2020-01-01T06:59:02Z",
            "0 1 * * *",
            [FakeDatetime(2020, 1, 1, 7, 0).strftime("%A, %d %B %Y, %H:%M:%S")],
        ),
        (
            "2020-01-01T06:59:59Z",
            "0 1 * * *",
            [FakeDatetime(2020, 1, 1, 7, 0).strftime("%A, %d %B %Y, %H:%M:%S")],
        ),
        (
            "2020-01-01T07:00:00",
            "0 1 * * *",
            [FakeDatetime(2020, 1, 1, 7, 0).strftime("%A, %d %B %Y, %H:%M:%S")],
        ),
        ("2020-01-01T07:00:01Z", "0 1 * * *", []),
    ],
)
def test_cron_schedule_window_chicago(
    current_dttm: str, cron: str, expected: list[FakeDatetime]
) -> None:
    """
    Reports scheduler: Test cron schedule window for "America/Chicago"
    """

    with freeze_time(current_dttm, tz_offset=0):
        datetimes = cron_schedule_window(cron, "America/Chicago")
        assert (
            list(cron.strftime("%A, %d %B %Y, %H:%M:%S") for cron in datetimes)
            == expected
        )


@pytest.mark.parametrize(
    "current_dttm, cron, expected",
    [
        ("2020-07-01T05:59:01Z", "0 1 * * *", []),
        (
            "2020-07-01T05:59:02Z",
            "0 1 * * *",
            [FakeDatetime(2020, 7, 1, 6, 0).strftime("%A, %d %B %Y, %H:%M:%S")],
        ),
        (
            "2020-07-01T05:59:59Z",
            "0 1 * * *",
            [FakeDatetime(2020, 7, 1, 6, 0).strftime("%A, %d %B %Y, %H:%M:%S")],
        ),
        (
            "2020-07-01T06:00:00",
            "0 1 * * *",
            [FakeDatetime(2020, 7, 1, 6, 0).strftime("%A, %d %B %Y, %H:%M:%S")],
        ),
        ("2020-07-01T06:00:01Z", "0 1 * * *", []),
    ],
)
def test_cron_schedule_window_chicago_daylight(
    current_dttm: str, cron: str, expected: list[FakeDatetime]
) -> None:
    """
    Reports scheduler: Test cron schedule window for "America/Chicago"
    """

    with freeze_time(current_dttm, tz_offset=0):
        datetimes = cron_schedule_window(cron, "America/Chicago")
        assert (
            list(cron.strftime("%A, %d %B %Y, %H:%M:%S") for cron in datetimes)
            == expected
        )
