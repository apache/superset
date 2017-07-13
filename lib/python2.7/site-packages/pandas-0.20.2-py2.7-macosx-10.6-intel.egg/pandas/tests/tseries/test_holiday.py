import pytest

from datetime import datetime
import pandas.util.testing as tm
from pandas import compat
from pandas import DatetimeIndex
from pandas.tseries.holiday import (USFederalHolidayCalendar, USMemorialDay,
                                    USThanksgivingDay, nearest_workday,
                                    next_monday_or_tuesday, next_monday,
                                    previous_friday, sunday_to_monday, Holiday,
                                    DateOffset, MO, SA, Timestamp,
                                    AbstractHolidayCalendar, get_calendar,
                                    HolidayCalendarFactory, next_workday,
                                    previous_workday, before_nearest_workday,
                                    EasterMonday, GoodFriday,
                                    after_nearest_workday, weekend_to_monday,
                                    USLaborDay, USColumbusDay,
                                    USMartinLutherKingJr, USPresidentsDay)
from pytz import utc


class TestCalendar(object):

    def setup_method(self, method):
        self.holiday_list = [
            datetime(2012, 1, 2),
            datetime(2012, 1, 16),
            datetime(2012, 2, 20),
            datetime(2012, 5, 28),
            datetime(2012, 7, 4),
            datetime(2012, 9, 3),
            datetime(2012, 10, 8),
            datetime(2012, 11, 12),
            datetime(2012, 11, 22),
            datetime(2012, 12, 25)]

        self.start_date = datetime(2012, 1, 1)
        self.end_date = datetime(2012, 12, 31)

    def test_calendar(self):

        calendar = USFederalHolidayCalendar()
        holidays = calendar.holidays(self.start_date, self.end_date)

        holidays_1 = calendar.holidays(
            self.start_date.strftime('%Y-%m-%d'),
            self.end_date.strftime('%Y-%m-%d'))
        holidays_2 = calendar.holidays(
            Timestamp(self.start_date),
            Timestamp(self.end_date))

        assert list(holidays.to_pydatetime()) == self.holiday_list
        assert list(holidays_1.to_pydatetime()) == self.holiday_list
        assert list(holidays_2.to_pydatetime()) == self.holiday_list

    def test_calendar_caching(self):
        # Test for issue #9552

        class TestCalendar(AbstractHolidayCalendar):

            def __init__(self, name=None, rules=None):
                super(TestCalendar, self).__init__(name=name, rules=rules)

        jan1 = TestCalendar(rules=[Holiday('jan1', year=2015, month=1, day=1)])
        jan2 = TestCalendar(rules=[Holiday('jan2', year=2015, month=1, day=2)])

        tm.assert_index_equal(jan1.holidays(), DatetimeIndex(['01-Jan-2015']))
        tm.assert_index_equal(jan2.holidays(), DatetimeIndex(['02-Jan-2015']))

    def test_calendar_observance_dates(self):
        # Test for issue 11477
        USFedCal = get_calendar('USFederalHolidayCalendar')
        holidays0 = USFedCal.holidays(datetime(2015, 7, 3), datetime(
            2015, 7, 3))  # <-- same start and end dates
        holidays1 = USFedCal.holidays(datetime(2015, 7, 3), datetime(
            2015, 7, 6))  # <-- different start and end dates
        holidays2 = USFedCal.holidays(datetime(2015, 7, 3), datetime(
            2015, 7, 3))  # <-- same start and end dates

        tm.assert_index_equal(holidays0, holidays1)
        tm.assert_index_equal(holidays0, holidays2)

    def test_rule_from_name(self):
        USFedCal = get_calendar('USFederalHolidayCalendar')
        assert USFedCal.rule_from_name('Thanksgiving') == USThanksgivingDay


class TestHoliday(object):

    def setup_method(self, method):
        self.start_date = datetime(2011, 1, 1)
        self.end_date = datetime(2020, 12, 31)

    def check_results(self, holiday, start, end, expected):
        assert list(holiday.dates(start, end)) == expected

        # Verify that timezone info is preserved.
        assert (list(holiday.dates(utc.localize(Timestamp(start)),
                                   utc.localize(Timestamp(end)))) ==
                [utc.localize(dt) for dt in expected])

    def test_usmemorialday(self):
        self.check_results(holiday=USMemorialDay,
                           start=self.start_date,
                           end=self.end_date,
                           expected=[
                               datetime(2011, 5, 30),
                               datetime(2012, 5, 28),
                               datetime(2013, 5, 27),
                               datetime(2014, 5, 26),
                               datetime(2015, 5, 25),
                               datetime(2016, 5, 30),
                               datetime(2017, 5, 29),
                               datetime(2018, 5, 28),
                               datetime(2019, 5, 27),
                               datetime(2020, 5, 25),
                           ], )

    def test_non_observed_holiday(self):

        self.check_results(
            Holiday('July 4th Eve', month=7, day=3),
            start="2001-01-01",
            end="2003-03-03",
            expected=[
                Timestamp('2001-07-03 00:00:00'),
                Timestamp('2002-07-03 00:00:00')
            ]
        )

        self.check_results(
            Holiday('July 4th Eve', month=7, day=3, days_of_week=(0, 1, 2, 3)),
            start="2001-01-01",
            end="2008-03-03",
            expected=[
                Timestamp('2001-07-03 00:00:00'),
                Timestamp('2002-07-03 00:00:00'),
                Timestamp('2003-07-03 00:00:00'),
                Timestamp('2006-07-03 00:00:00'),
                Timestamp('2007-07-03 00:00:00'),
            ]
        )

    def test_easter(self):

        self.check_results(EasterMonday,
                           start=self.start_date,
                           end=self.end_date,
                           expected=[
                               Timestamp('2011-04-25 00:00:00'),
                               Timestamp('2012-04-09 00:00:00'),
                               Timestamp('2013-04-01 00:00:00'),
                               Timestamp('2014-04-21 00:00:00'),
                               Timestamp('2015-04-06 00:00:00'),
                               Timestamp('2016-03-28 00:00:00'),
                               Timestamp('2017-04-17 00:00:00'),
                               Timestamp('2018-04-02 00:00:00'),
                               Timestamp('2019-04-22 00:00:00'),
                               Timestamp('2020-04-13 00:00:00'),
                           ], )
        self.check_results(GoodFriday,
                           start=self.start_date,
                           end=self.end_date,
                           expected=[
                               Timestamp('2011-04-22 00:00:00'),
                               Timestamp('2012-04-06 00:00:00'),
                               Timestamp('2013-03-29 00:00:00'),
                               Timestamp('2014-04-18 00:00:00'),
                               Timestamp('2015-04-03 00:00:00'),
                               Timestamp('2016-03-25 00:00:00'),
                               Timestamp('2017-04-14 00:00:00'),
                               Timestamp('2018-03-30 00:00:00'),
                               Timestamp('2019-04-19 00:00:00'),
                               Timestamp('2020-04-10 00:00:00'),
                           ], )

    def test_usthanksgivingday(self):

        self.check_results(USThanksgivingDay,
                           start=self.start_date,
                           end=self.end_date,
                           expected=[
                               datetime(2011, 11, 24),
                               datetime(2012, 11, 22),
                               datetime(2013, 11, 28),
                               datetime(2014, 11, 27),
                               datetime(2015, 11, 26),
                               datetime(2016, 11, 24),
                               datetime(2017, 11, 23),
                               datetime(2018, 11, 22),
                               datetime(2019, 11, 28),
                               datetime(2020, 11, 26),
                           ], )

    def test_holidays_within_dates(self):
        # Fix holiday behavior found in #11477
        # where holiday.dates returned dates outside start/end date
        # or observed rules could not be applied as the holiday
        # was not in the original date range (e.g., 7/4/2015 -> 7/3/2015)
        start_date = datetime(2015, 7, 1)
        end_date = datetime(2015, 7, 1)

        calendar = get_calendar('USFederalHolidayCalendar')
        new_years = calendar.rule_from_name('New Years Day')
        july_4th = calendar.rule_from_name('July 4th')
        veterans_day = calendar.rule_from_name('Veterans Day')
        christmas = calendar.rule_from_name('Christmas')

        # Holiday: (start/end date, holiday)
        holidays = {USMemorialDay: ("2015-05-25", "2015-05-25"),
                    USLaborDay: ("2015-09-07", "2015-09-07"),
                    USColumbusDay: ("2015-10-12", "2015-10-12"),
                    USThanksgivingDay: ("2015-11-26", "2015-11-26"),
                    USMartinLutherKingJr: ("2015-01-19", "2015-01-19"),
                    USPresidentsDay: ("2015-02-16", "2015-02-16"),
                    GoodFriday: ("2015-04-03", "2015-04-03"),
                    EasterMonday: [("2015-04-06", "2015-04-06"),
                                   ("2015-04-05", [])],
                    new_years: [("2015-01-01", "2015-01-01"),
                                ("2011-01-01", []),
                                ("2010-12-31", "2010-12-31")],
                    july_4th: [("2015-07-03", "2015-07-03"),
                               ("2015-07-04", [])],
                    veterans_day: [("2012-11-11", []),
                                   ("2012-11-12", "2012-11-12")],
                    christmas: [("2011-12-25", []),
                                ("2011-12-26", "2011-12-26")]}

        for rule, dates in compat.iteritems(holidays):
            empty_dates = rule.dates(start_date, end_date)
            assert empty_dates.tolist() == []

            if isinstance(dates, tuple):
                dates = [dates]

            for start, expected in dates:
                if len(expected):
                    expected = [Timestamp(expected)]
                self.check_results(rule, start, start, expected)

    def test_argument_types(self):
        holidays = USThanksgivingDay.dates(self.start_date, self.end_date)

        holidays_1 = USThanksgivingDay.dates(
            self.start_date.strftime('%Y-%m-%d'),
            self.end_date.strftime('%Y-%m-%d'))

        holidays_2 = USThanksgivingDay.dates(
            Timestamp(self.start_date),
            Timestamp(self.end_date))

        tm.assert_index_equal(holidays, holidays_1)
        tm.assert_index_equal(holidays, holidays_2)

    def test_special_holidays(self):
        base_date = [datetime(2012, 5, 28)]
        holiday_1 = Holiday('One-Time', year=2012, month=5, day=28)
        holiday_2 = Holiday('Range', month=5, day=28,
                            start_date=datetime(2012, 1, 1),
                            end_date=datetime(2012, 12, 31),
                            offset=DateOffset(weekday=MO(1)))

        assert base_date == holiday_1.dates(self.start_date, self.end_date)
        assert base_date == holiday_2.dates(self.start_date, self.end_date)

    def test_get_calendar(self):
        class TestCalendar(AbstractHolidayCalendar):
            rules = []

        calendar = get_calendar('TestCalendar')
        assert TestCalendar == calendar.__class__

    def test_factory(self):
        class_1 = HolidayCalendarFactory('MemorialDay',
                                         AbstractHolidayCalendar,
                                         USMemorialDay)
        class_2 = HolidayCalendarFactory('Thansksgiving',
                                         AbstractHolidayCalendar,
                                         USThanksgivingDay)
        class_3 = HolidayCalendarFactory('Combined', class_1, class_2)

        assert len(class_1.rules) == 1
        assert len(class_2.rules) == 1
        assert len(class_3.rules) == 2


class TestObservanceRules(object):

    def setup_method(self, method):
        self.we = datetime(2014, 4, 9)
        self.th = datetime(2014, 4, 10)
        self.fr = datetime(2014, 4, 11)
        self.sa = datetime(2014, 4, 12)
        self.su = datetime(2014, 4, 13)
        self.mo = datetime(2014, 4, 14)
        self.tu = datetime(2014, 4, 15)

    def test_next_monday(self):
        assert next_monday(self.sa) == self.mo
        assert next_monday(self.su) == self.mo

    def test_next_monday_or_tuesday(self):
        assert next_monday_or_tuesday(self.sa) == self.mo
        assert next_monday_or_tuesday(self.su) == self.tu
        assert next_monday_or_tuesday(self.mo) == self.tu

    def test_previous_friday(self):
        assert previous_friday(self.sa) == self.fr
        assert previous_friday(self.su) == self.fr

    def test_sunday_to_monday(self):
        assert sunday_to_monday(self.su) == self.mo

    def test_nearest_workday(self):
        assert nearest_workday(self.sa) == self.fr
        assert nearest_workday(self.su) == self.mo
        assert nearest_workday(self.mo) == self.mo

    def test_weekend_to_monday(self):
        assert weekend_to_monday(self.sa) == self.mo
        assert weekend_to_monday(self.su) == self.mo
        assert weekend_to_monday(self.mo) == self.mo

    def test_next_workday(self):
        assert next_workday(self.sa) == self.mo
        assert next_workday(self.su) == self.mo
        assert next_workday(self.mo) == self.tu

    def test_previous_workday(self):
        assert previous_workday(self.sa) == self.fr
        assert previous_workday(self.su) == self.fr
        assert previous_workday(self.tu) == self.mo

    def test_before_nearest_workday(self):
        assert before_nearest_workday(self.sa) == self.th
        assert before_nearest_workday(self.su) == self.fr
        assert before_nearest_workday(self.tu) == self.mo

    def test_after_nearest_workday(self):
        assert after_nearest_workday(self.sa) == self.mo
        assert after_nearest_workday(self.su) == self.tu
        assert after_nearest_workday(self.fr) == self.mo


class TestFederalHolidayCalendar(object):

    def test_no_mlk_before_1984(self):
        # see gh-10278
        class MLKCalendar(AbstractHolidayCalendar):
            rules = [USMartinLutherKingJr]

        holidays = MLKCalendar().holidays(start='1984',
                                          end='1988').to_pydatetime().tolist()

        # Testing to make sure holiday is not incorrectly observed before 1986
        assert holidays == [datetime(1986, 1, 20, 0, 0),
                            datetime(1987, 1, 19, 0, 0)]

    def test_memorial_day(self):
        class MemorialDay(AbstractHolidayCalendar):
            rules = [USMemorialDay]

        holidays = MemorialDay().holidays(start='1971',
                                          end='1980').to_pydatetime().tolist()

        # Fixes 5/31 error and checked manually against Wikipedia
        assert holidays == [datetime(1971, 5, 31, 0, 0),
                            datetime(1972, 5, 29, 0, 0),
                            datetime(1973, 5, 28, 0, 0),
                            datetime(1974, 5, 27, 0, 0),
                            datetime(1975, 5, 26, 0, 0),
                            datetime(1976, 5, 31, 0, 0),
                            datetime(1977, 5, 30, 0, 0),
                            datetime(1978, 5, 29, 0, 0),
                            datetime(1979, 5, 28, 0, 0)]


class TestHolidayConflictingArguments(object):

    def test_both_offset_observance_raises(self):
        # see gh-10217
        with pytest.raises(NotImplementedError):
            Holiday("Cyber Monday", month=11, day=1,
                    offset=[DateOffset(weekday=SA(4))],
                    observance=next_monday)
