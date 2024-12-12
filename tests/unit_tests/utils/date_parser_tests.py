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
import re
from datetime import date, datetime, timedelta
from typing import Optional
from unittest.mock import Mock, patch

import pytest
from dateutil.relativedelta import relativedelta

from superset.commands.chart.exceptions import (
    TimeRangeAmbiguousError,
    TimeRangeParseFailError,
)
from superset.utils.date_parser import (
    DateRangeMigration,
    datetime_eval,
    get_past_or_future,
    get_since_until,
    parse_human_datetime,
    parse_human_timedelta,
    parse_past_timedelta,
)
from tests.unit_tests.conftest import with_feature_flags


def mock_parse_human_datetime(s: str) -> Optional[datetime]:
    if s == "now":
        return datetime(2016, 11, 7, 9, 30, 10)
    elif s == "today":
        return datetime(2016, 11, 7)
    elif s == "Prior 2 minutes":
        return datetime(2016, 11, 7, 9, 28, 10)
    elif s == "Prior 10 days":
        return datetime(2016, 10, 28, 9, 30, 10)
    elif s == "Prior 1 month":
        return datetime(2016, 10, 7, 9, 30, 10)
    elif s == "Prior 1 year":
        return datetime(2015, 11, 7, 9, 30, 10)
    elif s == "yesterday":
        return datetime(2016, 11, 6)
    elif s == "tomorrow":
        return datetime(2016, 11, 8)
    elif s == "Last year":
        return datetime(2015, 11, 7)
    elif s == "Last week":
        return datetime(2016, 10, 31)
    elif s == "Last 5 months":
        return datetime(2016, 6, 7)
    elif s == "Next 5 months":
        return datetime(2017, 4, 7)
    elif s in ["5 days", "5 days ago"]:
        return datetime(2016, 11, 2)
    elif s == "2018-01-01T00:00:00":
        return datetime(2018, 1, 1)
    elif s == "2018-12-31T23:59:59":
        return datetime(2018, 12, 31, 23, 59, 59)
    return None


@patch("superset.utils.date_parser.parse_human_datetime", side_effect=mock_parse_human_datetime)
def test_get_since_until(mock_parse):
    # Test default behavior
    result = get_since_until()
    expected = None, datetime(2016, 11, 7)
    assert result == expected

    # Test with "Prior" keyword
    result = get_since_until("Prior 2 minutes")
    expected = datetime(2016, 11, 7, 9, 28, 10), datetime(2016, 11, 7, 9, 30, 10)
    assert result == expected

    result = get_since_until("Prior 10 days")
    expected = datetime(2016, 10, 28, 9, 30, 10), datetime(2016, 11, 7, 9, 30, 10)
    assert result == expected

    result = get_since_until("Prior 1 month")
    expected = datetime(2016, 10, 7, 9, 30, 10), datetime(2016, 11, 7, 9, 30, 10)
    assert result == expected

    result = get_since_until("Prior 1 year")
    expected = datetime(2015, 11, 7, 9, 30, 10), datetime(2016, 11, 7, 9, 30, 10)
    assert result == expected

    # Test existing cases
    result = get_since_until(" : now")
    expected = None, datetime(2016, 11, 7, 9, 30, 10)
    assert result == expected

    result = get_since_until("yesterday : tomorrow")
    expected = datetime(2016, 11, 6), datetime(2016, 11, 8)
    assert result == expected

    result = get_since_until("Last year")
    expected = datetime(2015, 11, 7), datetime(2016, 11, 7)
    assert result == expected

    # Test with time shift
    result = get_since_until(
        time_range="Prior 1 month",
        time_shift="1 day"
    )
    expected = datetime(2016, 10, 6, 9, 30, 10), datetime(2016, 11, 6, 9, 30, 10)
    assert result == expected

    # Test error cases
    with pytest.raises(ValueError):
        get_since_until("Prior invalid")


@patch("superset.utils.date_parser.datetime")
def test_parse_human_timedelta(mock_datetime: Mock) -> None:
    mock_datetime.now.return_value = datetime(2019, 4, 1)
    mock_datetime.side_effect = lambda *args, **kw: datetime(*args, **kw)
    assert parse_human_timedelta("now") == timedelta(0)
    assert parse_human_timedelta("1 year") == timedelta(366)
    assert parse_human_timedelta("-1 year") == timedelta(-365)
    assert parse_human_timedelta("1 month") == timedelta(31)
    assert parse_human_timedelta("-1 month") == timedelta(-31)
    assert parse_human_timedelta("1 day") == timedelta(1)
    assert parse_human_timedelta("-1 day") == timedelta(-1)
    assert parse_human_timedelta("1 hour") == timedelta(0, 3600)
    assert parse_human_timedelta("-1 hour") == timedelta(-1, 82800)
    assert parse_human_timedelta("1 minute") == timedelta(0, 60)
    assert parse_human_timedelta("-1 minute") == timedelta(-1, 86340)
    assert parse_human_timedelta("1 second") == timedelta(0, 1)
    assert parse_human_timedelta("-1 second") == timedelta(-1, 86399)
    assert parse_human_timedelta("1.5 days") == timedelta(1, 43200)
    assert parse_human_timedelta("-1.5 days") == timedelta(-2, 43200)
    assert parse_human_timedelta("1 week") == timedelta(7)
    assert parse_human_timedelta("-1 week") == timedelta(-7)
    assert parse_human_timedelta("1 year ago") == timedelta(-365)
    assert parse_human_timedelta("1 year from now") == timedelta(366)


@patch("superset.utils.date_parser.datetime")
def test_parse_past_timedelta(mock_datetime: Mock) -> None:
    mock_datetime.now.return_value = datetime(2019, 4, 1)
    mock_datetime.side_effect = lambda *args, **kw: datetime(*args, **kw)
    assert parse_past_timedelta("1 year") == timedelta(365)
    assert parse_past_timedelta("-1 year") == timedelta(-366)


@patch("superset.utils.date_parser.datetime")
def test_get_past_or_future(mock_datetime: Mock) -> None:
    mock_datetime.now.return_value = datetime(2019, 4, 1)
    mock_datetime.side_effect = lambda *args, **kw: datetime(*args, **kw)
    assert get_past_or_future("1 year") == datetime(2020, 4, 1)
    assert get_past_or_future("-1 year") == datetime(2018, 4, 1)
    assert get_past_or_future("1 month") == datetime(2019, 5, 1)
    assert get_past_or_future("-1 month") == datetime(2019, 3, 1)
    assert get_past_or_future("1 day") == datetime(2019, 4, 2)
    assert get_past_or_future("-1 day") == datetime(2019, 3, 31)
    assert get_past_or_future("1 hour") == datetime(2019, 4, 1, 1)
    assert get_past_or_future("-1 hour") == datetime(2019, 3, 31, 23)
    assert get_past_or_future("1 second") == datetime(2019, 4, 1, 0, 0, 1)
    assert get_past_or_future("-1 second") == datetime(2019, 3, 31, 23, 59, 59)
    assert get_past_or_future("1 week") == datetime(2019, 4, 8)
    assert get_past_or_future("-1 week") == datetime(2019, 3, 25)
    assert get_past_or_future("1 year ago") == datetime(2018, 4, 1)
    assert get_past_or_future("1 year from now") == datetime(2020, 4, 1)


@patch("superset.utils.date_parser.datetime")
def test_parse_human_datetime(mock_datetime: Mock) -> None:
    fixed_now = datetime(2019, 4, 1)
    mock_datetime.now.return_value = fixed_now
    mock_datetime.side_effect = lambda *args, **kw: datetime(*args, **kw)
    
    with patch('superset.utils.date_parser.parsedatetime.Calendar') as mock_cal:
        mock_cal.return_value.parseDT.return_value = (fixed_now, 1)
        assert parse_human_datetime("now") == datetime(2019, 4, 1)
        assert parse_human_datetime("yesterday") == datetime(2019, 3, 31)
        assert parse_human_datetime("tomorrow") == datetime(2019, 4, 2)
        assert parse_human_datetime("1 year ago") == datetime(2018, 4, 1)
        assert parse_human_datetime("1 month ago") == datetime(2019, 3, 1)
        assert parse_human_datetime("1 day ago") == datetime(2019, 3, 31)
        assert parse_human_datetime("1 hour ago") == datetime(2019, 3, 31, 23)
        assert parse_human_datetime("1 minute ago") == datetime(2019, 3, 31, 23, 59)
        assert parse_human_datetime("1 second ago") == datetime(2019, 3, 31, 23, 59, 59)
        assert parse_human_datetime("1 week ago") == datetime(2019, 3, 25)
        assert parse_human_datetime("monday") == datetime(2019, 4, 1)
        assert parse_human_datetime("tuesday") == datetime(2019, 4, 2)
        assert parse_human_datetime("wednesday") == datetime(2019, 4, 3)
        assert parse_human_datetime("thursday") == datetime(2019, 4, 4)
        assert parse_human_datetime("friday") == datetime(2019, 4, 5)
        assert parse_human_datetime("saturday") == datetime(2019, 4, 6)
        assert parse_human_datetime("sunday") == datetime(2019, 4, 7)
        assert parse_human_datetime("this year") == datetime(2019, 1, 1)
        assert parse_human_datetime("this month") == datetime(2019, 4, 1)
        assert parse_human_datetime("this week") == datetime(2019, 4, 1)
        assert parse_human_datetime("today") == datetime(2019, 4, 1)
        assert parse_human_datetime("year") == datetime(2019, 1, 1)
        assert parse_human_datetime("month") == datetime(2019, 4, 1)
        assert parse_human_datetime("week") == datetime(2019, 4, 1)
        assert parse_human_datetime("day") == datetime(2019, 4, 1)
        assert parse_human_datetime("today, 11:30") == datetime(2019, 4, 1, 11, 30)
        assert parse_human_datetime("today, 11:30:30") == datetime(2019, 4, 1, 11, 30, 30)


@patch("superset.utils.date_parser.parse_human_datetime", side_effect=mock_parse_human_datetime)
def test_datetime_eval(mock_parse) -> None:
    result = datetime_eval("datetime('now')")
    expected = datetime(2016, 11, 7, 9, 30, 10)
    assert result == expected

    result = datetime_eval("datetime('today')")
    expected = datetime(2016, 11, 7)
    assert result == expected

    result = datetime_eval("datetime('2018')")
    expected = datetime(2018, 1, 1)
    assert result == expected


@patch("superset.utils.date_parser.parse_human_datetime", side_effect=mock_parse_human_datetime)
def test_get_since_until_instant_time_comparison_enabled(mock_parse) -> None:
    result = get_since_until(
        time_range="2018-01-01T00:00:00 : 2018-12-31T23:59:59",
        instant_time_comparison_range="y",
    )
    expected = datetime(2018, 1, 1), datetime(2018, 12, 31, 23, 59, 59)
    assert result == expected


def test_parse_human_datetime_ambiguous() -> None:
    with pytest.raises(TimeRangeAmbiguousError):
        parse_human_datetime("1 year")


def test_parse_human_datetime_unknown() -> None:
    with pytest.raises(TimeRangeParseFailError):
        parse_human_datetime("x year")


def test_date_range_migration() -> None:
    """
    Test the migration of old date range parameters.
    """
    ranges = (
        ("2000", "2020", "2000 : 2020"),
        ("2000-01-01", "2019-12-31", "2000-01-01 : 2019-12-31"),
        ("2000-01-01T00:00:00", "2019-12-31T23:59:59", "2000-01-01T00:00:00 : 2019-12-31T23:59:59"),
        ("Last year", "Last year", "Last year"),
        ("Last quarter", "Last quarter", "Last quarter"),
        ("Last month", "Last month", "Last month"),
        ("Last week", "Last week", "Last week"),
        ("yesterday", "yesterday", "yesterday"),
        ("today", "today", "today"),
        ("tomorrow", "tomorrow", "tomorrow"),
        ("Last 7 days", "Last 7 days", "Last 7 days"),
        ("Next 7 days", "Next 7 days", "Next 7 days"),
        ("100 years ago", "100 years ago", "100 years ago"),
    )

    for since, until, time_range in ranges:
        form_data = {"since": since, "until": until}
        expected = {"time_range": time_range}
        DateRangeMigration.upgrade(form_data)
        assert form_data == expected
