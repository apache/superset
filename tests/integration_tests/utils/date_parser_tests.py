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
from datetime import date, datetime, timedelta
from unittest.mock import patch

from dateutil.relativedelta import relativedelta

from superset.charts.commands.exceptions import (
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
from tests.integration_tests.base_tests import SupersetTestCase


def mock_parse_human_datetime(s):
    if s == "now":
        return datetime(2016, 11, 7, 9, 30, 10)
    elif s == "2018":
        return datetime(2018, 1, 1)
    elif s == "2018-9":
        return datetime(2018, 9, 1)
    elif s == "today":
        return datetime(2016, 11, 7)
    elif s == "yesterday":
        return datetime(2016, 11, 6)
    elif s == "tomorrow":
        return datetime(2016, 11, 8)
    elif s == "Last year":
        return datetime(2015, 11, 7)
    elif s == "Last week":
        return datetime(2015, 10, 31)
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


class TestDateParser(SupersetTestCase):
    @patch("superset.utils.date_parser.parse_human_datetime", mock_parse_human_datetime)
    def test_get_since_until(self):
        result = get_since_until()
        expected = None, datetime(2016, 11, 7)
        self.assertEqual(result, expected)

        result = get_since_until(" : now")
        expected = None, datetime(2016, 11, 7, 9, 30, 10)
        self.assertEqual(result, expected)

        result = get_since_until("yesterday : tomorrow")
        expected = datetime(2016, 11, 6), datetime(2016, 11, 8)
        self.assertEqual(result, expected)

        result = get_since_until("2018-01-01T00:00:00 : 2018-12-31T23:59:59")
        expected = datetime(2018, 1, 1), datetime(2018, 12, 31, 23, 59, 59)
        self.assertEqual(result, expected)

        result = get_since_until("Last year")
        expected = datetime(2015, 11, 7), datetime(2016, 11, 7)
        self.assertEqual(result, expected)

        result = get_since_until("Last quarter")
        expected = datetime(2016, 8, 7), datetime(2016, 11, 7)
        self.assertEqual(result, expected)

        result = get_since_until("Last 5 months")
        expected = datetime(2016, 6, 7), datetime(2016, 11, 7)
        self.assertEqual(result, expected)

        result = get_since_until("Last 1 month")
        expected = datetime(2016, 10, 7), datetime(2016, 11, 7)
        self.assertEqual(result, expected)

        result = get_since_until("Next 5 months")
        expected = datetime(2016, 11, 7), datetime(2017, 4, 7)
        self.assertEqual(result, expected)

        result = get_since_until("Next 1 month")
        expected = datetime(2016, 11, 7), datetime(2016, 12, 7)
        self.assertEqual(result, expected)

        result = get_since_until(since="5 days")
        expected = datetime(2016, 11, 2), datetime(2016, 11, 7)
        self.assertEqual(result, expected)

        result = get_since_until(since="5 days ago", until="tomorrow")
        expected = datetime(2016, 11, 2), datetime(2016, 11, 8)
        self.assertEqual(result, expected)

        result = get_since_until(time_range="yesterday : tomorrow", time_shift="1 day")
        expected = datetime(2016, 11, 5), datetime(2016, 11, 7)
        self.assertEqual(result, expected)

        result = get_since_until(time_range="5 days : now")
        expected = datetime(2016, 11, 2), datetime(2016, 11, 7, 9, 30, 10)
        self.assertEqual(result, expected)

        result = get_since_until("Last week", relative_end="now")
        expected = datetime(2016, 10, 31), datetime(2016, 11, 7, 9, 30, 10)
        self.assertEqual(result, expected)

        result = get_since_until("Last week", relative_start="now")
        expected = datetime(2016, 10, 31, 9, 30, 10), datetime(2016, 11, 7)
        self.assertEqual(result, expected)

        result = get_since_until("Last week", relative_start="now", relative_end="now")
        expected = datetime(2016, 10, 31, 9, 30, 10), datetime(2016, 11, 7, 9, 30, 10)
        self.assertEqual(result, expected)

        result = get_since_until("previous calendar week")
        expected = datetime(2016, 10, 31, 0, 0, 0), datetime(2016, 11, 7, 0, 0, 0)
        self.assertEqual(result, expected)

        result = get_since_until("previous calendar month")
        expected = datetime(2016, 10, 1, 0, 0, 0), datetime(2016, 11, 1, 0, 0, 0)
        self.assertEqual(result, expected)

        result = get_since_until("previous calendar year")
        expected = datetime(2015, 1, 1, 0, 0, 0), datetime(2016, 1, 1, 0, 0, 0)
        self.assertEqual(result, expected)

        with self.assertRaises(ValueError):
            get_since_until(time_range="tomorrow : yesterday")

    @patch("superset.utils.date_parser.parse_human_datetime", mock_parse_human_datetime)
    def test_datetime_eval(self):
        result = datetime_eval("datetime('now')")
        expected = datetime(2016, 11, 7, 9, 30, 10)
        self.assertEqual(result, expected)

        result = datetime_eval("datetime('today'  )")
        expected = datetime(2016, 11, 7)
        self.assertEqual(result, expected)

        result = datetime_eval("datetime('2018')")
        expected = datetime(2018, 1, 1)
        self.assertEqual(result, expected)

        result = datetime_eval("datetime('2018-9')")
        expected = datetime(2018, 9, 1)
        self.assertEqual(result, expected)

        # Parse compact arguments spelling
        result = datetime_eval("dateadd(datetime('today'),1,year,)")
        expected = datetime(2017, 11, 7)
        self.assertEqual(result, expected)

        result = datetime_eval("dateadd(datetime('today'), -2, year)")
        expected = datetime(2014, 11, 7)
        self.assertEqual(result, expected)

        result = datetime_eval("dateadd(datetime('today'), 2, quarter)")
        expected = datetime(2017, 5, 7)
        self.assertEqual(result, expected)

        result = datetime_eval("dateadd(datetime('today'), 3, month)")
        expected = datetime(2017, 2, 7)
        self.assertEqual(result, expected)

        result = datetime_eval("dateadd(datetime('today'), -3, week)")
        expected = datetime(2016, 10, 17)
        self.assertEqual(result, expected)

        result = datetime_eval("dateadd(datetime('today'), 3, day)")
        expected = datetime(2016, 11, 10)
        self.assertEqual(result, expected)

        result = datetime_eval("dateadd(datetime('now'), 3, hour)")
        expected = datetime(2016, 11, 7, 12, 30, 10)
        self.assertEqual(result, expected)

        result = datetime_eval("dateadd(datetime('now'), 40, minute)")
        expected = datetime(2016, 11, 7, 10, 10, 10)
        self.assertEqual(result, expected)

        result = datetime_eval("dateadd(datetime('now'), -11, second)")
        expected = datetime(2016, 11, 7, 9, 29, 59)
        self.assertEqual(result, expected)

        result = datetime_eval("datetrunc(datetime('now'), year)")
        expected = datetime(2016, 1, 1, 0, 0, 0)
        self.assertEqual(result, expected)

        result = datetime_eval("datetrunc(datetime('now'), month)")
        expected = datetime(2016, 11, 1, 0, 0, 0)
        self.assertEqual(result, expected)

        result = datetime_eval("datetrunc(datetime('now'), day)")
        expected = datetime(2016, 11, 7, 0, 0, 0)
        self.assertEqual(result, expected)

        result = datetime_eval("datetrunc(datetime('now'), week)")
        expected = datetime(2016, 11, 7, 0, 0, 0)
        self.assertEqual(result, expected)

        result = datetime_eval("datetrunc(datetime('now'), hour)")
        expected = datetime(2016, 11, 7, 9, 0, 0)
        self.assertEqual(result, expected)

        result = datetime_eval("datetrunc(datetime('now'), minute)")
        expected = datetime(2016, 11, 7, 9, 30, 0)
        self.assertEqual(result, expected)

        result = datetime_eval("datetrunc(datetime('now'), second)")
        expected = datetime(2016, 11, 7, 9, 30, 10)
        self.assertEqual(result, expected)

        result = datetime_eval("lastday(datetime('now'), year)")
        expected = datetime(2016, 12, 31, 0, 0, 0)
        self.assertEqual(result, expected)

        result = datetime_eval("lastday(datetime('today'), month)")
        expected = datetime(2016, 11, 30, 0, 0, 0)
        self.assertEqual(result, expected)

        result = datetime_eval("holiday('Christmas')")
        expected = datetime(2016, 12, 25, 0, 0, 0)
        self.assertEqual(result, expected)

        result = datetime_eval("holiday('Labor day', datetime('2018-01-01T00:00:00'))")
        expected = datetime(2018, 9, 3, 0, 0, 0)
        self.assertEqual(result, expected)

        result = datetime_eval(
            "holiday('Boxing day', datetime('2018-01-01T00:00:00'), 'UK')"
        )
        expected = datetime(2018, 12, 26, 0, 0, 0)
        self.assertEqual(result, expected)

        result = datetime_eval(
            "lastday(dateadd(datetime('2018-01-01T00:00:00'), 1, month), month)"
        )
        expected = datetime(2018, 2, 28, 0, 0, 0)
        self.assertEqual(result, expected)

    @patch("superset.utils.date_parser.datetime")
    def test_parse_human_timedelta(self, mock_datetime):
        mock_datetime.now.return_value = datetime(2019, 4, 1)
        mock_datetime.side_effect = lambda *args, **kw: datetime(*args, **kw)
        self.assertEqual(parse_human_timedelta("now"), timedelta(0))
        self.assertEqual(parse_human_timedelta("1 year"), timedelta(366))
        self.assertEqual(parse_human_timedelta("-1 year"), timedelta(-365))
        self.assertEqual(parse_human_timedelta(None), timedelta(0))
        self.assertEqual(
            parse_human_timedelta("1 month", datetime(2019, 4, 1)), timedelta(30),
        )
        self.assertEqual(
            parse_human_timedelta("1 month", datetime(2019, 5, 1)), timedelta(31),
        )
        self.assertEqual(
            parse_human_timedelta("1 month", datetime(2019, 2, 1)), timedelta(28),
        )
        self.assertEqual(
            parse_human_timedelta("-1 month", datetime(2019, 2, 1)), timedelta(-31),
        )

    @patch("superset.utils.date_parser.datetime")
    def test_parse_past_timedelta(self, mock_datetime):
        mock_datetime.now.return_value = datetime(2019, 4, 1)
        mock_datetime.side_effect = lambda *args, **kw: datetime(*args, **kw)
        self.assertEqual(parse_past_timedelta("1 year"), timedelta(365))
        self.assertEqual(parse_past_timedelta("-1 year"), timedelta(365))
        self.assertEqual(parse_past_timedelta("52 weeks"), timedelta(364))
        self.assertEqual(parse_past_timedelta("1 month"), timedelta(31))

    def test_get_past_or_future(self):
        # 2020 is a leap year
        dttm = datetime(2020, 2, 29)
        self.assertEqual(get_past_or_future("1 year", dttm), datetime(2021, 2, 28))
        self.assertEqual(get_past_or_future("-1 year", dttm), datetime(2019, 2, 28))
        self.assertEqual(get_past_or_future("1 month", dttm), datetime(2020, 3, 29))
        self.assertEqual(get_past_or_future("3 month", dttm), datetime(2020, 5, 29))

    def test_parse_human_datetime(self):
        with self.assertRaises(TimeRangeAmbiguousError):
            parse_human_datetime("  2 days  ")

        with self.assertRaises(TimeRangeAmbiguousError):
            parse_human_datetime("2 day")

        with self.assertRaises(TimeRangeParseFailError):
            parse_human_datetime("xxxxxxx")

        self.assertEqual(parse_human_datetime("2015-04-03"), datetime(2015, 4, 3, 0, 0))

        self.assertEqual(
            parse_human_datetime("2/3/1969"), datetime(1969, 2, 3, 0, 0),
        )

        self.assertLessEqual(parse_human_datetime("now"), datetime.now())

        self.assertLess(parse_human_datetime("yesterday"), datetime.now())

        self.assertEqual(
            date.today() - timedelta(1), parse_human_datetime("yesterday").date()
        )

        self.assertEqual(
            parse_human_datetime("one year ago").date(),
            (datetime.now() - relativedelta(years=1)).date(),
        )

        self.assertEqual(
            parse_human_datetime("2 years after").date(),
            (datetime.now() + relativedelta(years=2)).date(),
        )

    def test_DateRangeMigration(self):
        params = '{"time_range": "   8 days     : 2020-03-10T00:00:00"}'
        self.assertRegex(params, DateRangeMigration.x_dateunit_in_since)

        params = '{"time_range": "2020-03-10T00:00:00 :    8 days    "}'
        self.assertRegex(params, DateRangeMigration.x_dateunit_in_until)

        params = '{"time_range": "   2 weeks    :    8 days    "}'
        self.assertRegex(params, DateRangeMigration.x_dateunit_in_since)
        self.assertRegex(params, DateRangeMigration.x_dateunit_in_until)

        params = '{"time_range": "2 weeks ago : 8 days later"}'
        self.assertNotRegex(params, DateRangeMigration.x_dateunit_in_since)
        self.assertNotRegex(params, DateRangeMigration.x_dateunit_in_until)

        field = "   8 days   "
        self.assertRegex(field, DateRangeMigration.x_dateunit)

        field = "last week"
        self.assertNotRegex(field, DateRangeMigration.x_dateunit)

        field = "10 years ago"
        self.assertNotRegex(field, DateRangeMigration.x_dateunit)
