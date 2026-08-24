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
from datetime import datetime

import pytest
from croniter import croniter
from freezegun.api import FakeDatetime

from superset.tasks.cron_util import cron_schedule_window, get_cron_description


@pytest.mark.parametrize(
    "current_dttm, cron, expected",
    [
        ("2020-01-01T08:59:01+00:00", "0 1 * * *", []),
        (
            "2020-01-01T08:59:32+00:00",
            "0 1 * * *",
            [FakeDatetime(2020, 1, 1, 9, 0).strftime("%A, %d %B %Y, %H:%M:%S")],
        ),
        (
            "2020-01-01T08:59:59+00:00",
            "0 1 * * *",
            [FakeDatetime(2020, 1, 1, 9, 0).strftime("%A, %d %B %Y, %H:%M:%S")],
        ),
        (
            "2020-01-01T09:00:00+00:00",
            "0 1 * * *",
            [FakeDatetime(2020, 1, 1, 9, 0).strftime("%A, %d %B %Y, %H:%M:%S")],
        ),
        (
            "2020-01-01T09:00:01+00:00",
            "0 1 * * *",
            [FakeDatetime(2020, 1, 1, 9, 0).strftime("%A, %d %B %Y, %H:%M:%S")],
        ),
        ("2020-01-01T09:00:30+00:00", "0 1 * * *", []),
    ],
)
def test_cron_schedule_window_los_angeles(
    current_dttm: str, cron: str, expected: list[FakeDatetime]
) -> None:
    """
    Reports scheduler: Test cron schedule window for "America/Los_Angeles"
    """

    datetimes = cron_schedule_window(
        datetime.fromisoformat(current_dttm), cron, "America/Los_Angeles"
    )
    assert (
        list(cron.strftime("%A, %d %B %Y, %H:%M:%S") for cron in datetimes) == expected  # noqa: C400
    )


@pytest.mark.parametrize(
    "current_dttm, cron, expected",
    [
        ("2020-01-01T00:59:01+00:00", "0 1 * * *", []),
        ("2020-01-01T00:59:02+00:00", "0 1 * * *", []),
        (
            "2020-01-01T00:59:59+00:00",
            "0 1 * * *",
            [FakeDatetime(2020, 1, 1, 1, 0).strftime("%A, %d %B %Y, %H:%M:%S")],
        ),
        (
            "2020-01-01T01:00:00+00:00",
            "0 1 * * *",
            [FakeDatetime(2020, 1, 1, 1, 0).strftime("%A, %d %B %Y, %H:%M:%S")],
        ),
        (
            "2020-01-01T01:00:01+00:00",
            "0 1 * * *",
            [FakeDatetime(2020, 1, 1, 1, 0).strftime("%A, %d %B %Y, %H:%M:%S")],
        ),
        (
            "2020-01-01T01:00:29+00:00",
            "0 1 * * *",
            [FakeDatetime(2020, 1, 1, 1, 0).strftime("%A, %d %B %Y, %H:%M:%S")],
        ),
        ("2020-01-01T01:00:30+00:00", "0 1 * * *", []),
    ],
)
def test_cron_schedule_window_invalid_timezone(
    current_dttm: str, cron: str, expected: list[FakeDatetime]
) -> None:
    """
    Reports scheduler: Test cron schedule window for "invalid timezone"
    """

    datetimes = cron_schedule_window(
        datetime.fromisoformat(current_dttm), cron, "invalid timezone"
    )
    # it should default to UTC
    assert (
        list(cron.strftime("%A, %d %B %Y, %H:%M:%S") for cron in datetimes) == expected  # noqa: C400
    )


@pytest.mark.parametrize(
    "current_dttm, cron, expected",
    [
        ("2020-01-01T05:59:01+00:00", "0 1 * * *", []),
        ("2020-01-01T05:59:02+00:00", "0 1 * * *", []),
        (
            "2020-01-01T05:59:59+00:00",
            "0 1 * * *",
            [FakeDatetime(2020, 1, 1, 6, 0).strftime("%A, %d %B %Y, %H:%M:%S")],
        ),
        (
            "2020-01-01T06:00:00+00:00",
            "0 1 * * *",
            [FakeDatetime(2020, 1, 1, 6, 0).strftime("%A, %d %B %Y, %H:%M:%S")],
        ),
        (
            "2020-01-01T06:00:01+00:00",
            "0 1 * * *",
            [FakeDatetime(2020, 1, 1, 6, 0).strftime("%A, %d %B %Y, %H:%M:%S")],
        ),
        (
            "2020-01-01T06:00:29+00:00",
            "0 1 * * *",
            [FakeDatetime(2020, 1, 1, 6, 0).strftime("%A, %d %B %Y, %H:%M:%S")],
        ),
        ("2020-01-01T06:00:30+00:00", "0 1 * * *", []),
    ],
)
def test_cron_schedule_window_new_york(
    current_dttm: str, cron: str, expected: list[FakeDatetime]
) -> None:
    """
    Reports scheduler: Test cron schedule window for "America/New_York"
    """

    datetimes = cron_schedule_window(
        datetime.fromisoformat(current_dttm), cron, "America/New_York"
    )
    assert (
        list(cron.strftime("%A, %d %B %Y, %H:%M:%S") for cron in datetimes) == expected  # noqa: C400
    )


@pytest.mark.parametrize(
    "current_dttm, cron, expected",
    [
        ("2020-01-01T06:59:01+00:00", "0 1 * * *", []),
        ("2020-01-01T06:59:02+00:00", "0 1 * * *", []),
        (
            "2020-01-01T06:59:59+00:00",
            "0 1 * * *",
            [FakeDatetime(2020, 1, 1, 7, 0).strftime("%A, %d %B %Y, %H:%M:%S")],
        ),
        (
            "2020-01-01T07:00:00+00:00",
            "0 1 * * *",
            [FakeDatetime(2020, 1, 1, 7, 0).strftime("%A, %d %B %Y, %H:%M:%S")],
        ),
        (
            "2020-01-01T07:00:01+00:00",
            "0 1 * * *",
            [FakeDatetime(2020, 1, 1, 7, 0).strftime("%A, %d %B %Y, %H:%M:%S")],
        ),
        (
            "2020-01-01T07:00:29+00:00",
            "0 1 * * *",
            [FakeDatetime(2020, 1, 1, 7, 0).strftime("%A, %d %B %Y, %H:%M:%S")],
        ),
        ("2020-01-01T07:00:30+00:00", "0 1 * * *", []),
    ],
)
def test_cron_schedule_window_chicago(
    current_dttm: str, cron: str, expected: list[FakeDatetime]
) -> None:
    """
    Reports scheduler: Test cron schedule window for "America/Chicago"
    """

    datetimes = cron_schedule_window(
        datetime.fromisoformat(current_dttm), cron, "America/Chicago"
    )
    assert (
        list(cron.strftime("%A, %d %B %Y, %H:%M:%S") for cron in datetimes) == expected  # noqa: C400
    )


@pytest.mark.parametrize(
    "current_dttm, cron, expected",
    [
        ("2020-07-01T05:59:01+00:00", "0 1 * * *", []),
        ("2020-07-01T05:59:02+00:00", "0 1 * * *", []),
        (
            "2020-07-01T05:59:59+00:00",
            "0 1 * * *",
            [FakeDatetime(2020, 7, 1, 6, 0).strftime("%A, %d %B %Y, %H:%M:%S")],
        ),
        (
            "2020-07-01T06:00:00+00:00",
            "0 1 * * *",
            [FakeDatetime(2020, 7, 1, 6, 0).strftime("%A, %d %B %Y, %H:%M:%S")],
        ),
        (
            "2020-07-01T06:00:01+00:00",
            "0 1 * * *",
            [FakeDatetime(2020, 7, 1, 6, 0).strftime("%A, %d %B %Y, %H:%M:%S")],
        ),
        (
            "2020-07-01T06:00:29+00:00",
            "0 1 * * *",
            [FakeDatetime(2020, 7, 1, 6, 0).strftime("%A, %d %B %Y, %H:%M:%S")],
        ),
        ("2020-07-01T06:00:30+00:00", "0 1 * * *", []),
    ],
)
def test_cron_schedule_window_chicago_daylight(
    current_dttm: str, cron: str, expected: list[FakeDatetime]
) -> None:
    """
    Reports scheduler: Test cron schedule window for "America/Chicago"
    """

    datetimes = cron_schedule_window(
        datetime.fromisoformat(current_dttm), cron, "America/Chicago"
    )
    assert (
        list(cron.strftime("%A, %d %B %Y, %H:%M:%S") for cron in datetimes) == expected  # noqa: C400
    )


@pytest.mark.parametrize(
    "current_dttm, cron, expected",
    [
        ("2020-01-01T08:59:01+00:00", "0 0 30 2 *", []),
        ("2020-01-01T08:59:01+00:00", "0 0 31 4 *", []),
    ],
)
def test_cron_schedule_window_invalid_cron_date(
    current_dttm: str, cron: str, expected: list[FakeDatetime]
) -> None:
    """
    Reports scheduler: Test cron schedule window for a cron that is
    syntactically valid but can never match a real calendar date
    """

    datetimes = cron_schedule_window(datetime.fromisoformat(current_dttm), cron, "UTC")
    assert (
        list(cron.strftime("%A, %d %B %Y, %H:%M:%S") for cron in datetimes) == expected  # noqa: C400
    )


@pytest.mark.parametrize(
    "cron, expected",
    [
        # only the day-of-month is restricted
        (
            "0 9 7-11,19-23 * *",
            "At 09:00 AM, on day 7 through 11 and 19 through 23 of the month",
        ),
        # only the day-of-week is restricted
        ("0 9 * * 2", "At 09:00 AM, only on Tuesday"),
        ("0 9 ? * 2", "At 09:00 AM, only on Tuesday"),
        # neither is restricted
        ("0 9 * * *", "At 09:00 AM"),
        # both are restricted: cron unions them, so the description must too
        (
            "0 9 7-11,19-23 * 2",
            "At 09:00 AM, on day 7 through 11 and 19 through 23 of the month, "
            "or on Tuesday",
        ),
        (
            "0 9 1,15 * 1-5",
            "At 09:00 AM, on day 1 and 15 of the month, or Monday through Friday",
        ),
        (
            "0 9 15 3 2#1",
            "At 09:00 AM, on day 15 of the month, or on the first Tuesday of the "
            "month, only in March",
        ),
        ("0 9 L * 5", "At 09:00 AM, on the last day of the month, or on Friday"),
    ],
)
def test_get_cron_description(cron: str, expected: str) -> None:
    """
    Test that the humanized cron matches the days the schedule actually fires on.
    """

    assert get_cron_description(cron) == expected


def test_get_cron_description_matches_fire_times() -> None:
    """
    A restricted day-of-month and day-of-week are OR'ed, never AND'ed.
    """

    cron = "0 9 7-11,19-23 * 2"
    # 2026-09-01 is a Tuesday that falls outside both day-of-month ranges, so
    # an AND reading of the description would have skipped it
    first_fire_time = croniter(cron, datetime(2026, 9, 1)).get_next(datetime)

    assert first_fire_time == datetime(2026, 9, 1, 9, 0)
    assert "or on Tuesday" in get_cron_description(cron)
