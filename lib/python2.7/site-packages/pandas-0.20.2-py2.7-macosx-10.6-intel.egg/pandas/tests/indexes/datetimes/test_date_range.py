"""
test date_range, bdate_range, cdate_range
construction from the convenience range functions
"""

import pytest

import numpy as np
from datetime import datetime, timedelta, time

import pandas as pd
import pandas.util.testing as tm
from pandas import compat
from pandas.core.indexes.datetimes import bdate_range, cdate_range
from pandas import date_range, offsets, DatetimeIndex, Timestamp
from pandas.tseries.offsets import (generate_range, CDay, BDay,
                                    DateOffset, MonthEnd)

from pandas.tests.series.common import TestData

START, END = datetime(2009, 1, 1), datetime(2010, 1, 1)


def eq_gen_range(kwargs, expected):
    rng = generate_range(**kwargs)
    assert (np.array_equal(list(rng), expected))


class TestDateRanges(TestData):

    def test_date_range_gen_error(self):
        rng = date_range('1/1/2000 00:00', '1/1/2000 00:18', freq='5min')
        assert len(rng) == 4

    def test_date_range_negative_freq(self):
        # GH 11018
        rng = date_range('2011-12-31', freq='-2A', periods=3)
        exp = pd.DatetimeIndex(['2011-12-31', '2009-12-31',
                                '2007-12-31'], freq='-2A')
        tm.assert_index_equal(rng, exp)
        assert rng.freq == '-2A'

        rng = date_range('2011-01-31', freq='-2M', periods=3)
        exp = pd.DatetimeIndex(['2011-01-31', '2010-11-30',
                                '2010-09-30'], freq='-2M')
        tm.assert_index_equal(rng, exp)
        assert rng.freq == '-2M'

    def test_date_range_bms_bug(self):
        # #1645
        rng = date_range('1/1/2000', periods=10, freq='BMS')

        ex_first = Timestamp('2000-01-03')
        assert rng[0] == ex_first

    def test_date_range_normalize(self):
        snap = datetime.today()
        n = 50

        rng = date_range(snap, periods=n, normalize=False, freq='2D')

        offset = timedelta(2)
        values = DatetimeIndex([snap + i * offset for i in range(n)])

        tm.assert_index_equal(rng, values)

        rng = date_range('1/1/2000 08:15', periods=n, normalize=False,
                         freq='B')
        the_time = time(8, 15)
        for val in rng:
            assert val.time() == the_time

    def test_date_range_fy5252(self):
        dr = date_range(start="2013-01-01", periods=2, freq=offsets.FY5253(
            startingMonth=1, weekday=3, variation="nearest"))
        assert dr[0] == Timestamp('2013-01-31')
        assert dr[1] == Timestamp('2014-01-30')

    def test_date_range_ambiguous_arguments(self):
        # #2538
        start = datetime(2011, 1, 1, 5, 3, 40)
        end = datetime(2011, 1, 1, 8, 9, 40)

        pytest.raises(ValueError, date_range, start, end, freq='s',
                      periods=10)

    def test_date_range_businesshour(self):
        idx = DatetimeIndex(['2014-07-04 09:00', '2014-07-04 10:00',
                             '2014-07-04 11:00',
                             '2014-07-04 12:00', '2014-07-04 13:00',
                             '2014-07-04 14:00',
                             '2014-07-04 15:00', '2014-07-04 16:00'],
                            freq='BH')
        rng = date_range('2014-07-04 09:00', '2014-07-04 16:00', freq='BH')
        tm.assert_index_equal(idx, rng)

        idx = DatetimeIndex(
            ['2014-07-04 16:00', '2014-07-07 09:00'], freq='BH')
        rng = date_range('2014-07-04 16:00', '2014-07-07 09:00', freq='BH')
        tm.assert_index_equal(idx, rng)

        idx = DatetimeIndex(['2014-07-04 09:00', '2014-07-04 10:00',
                             '2014-07-04 11:00',
                             '2014-07-04 12:00', '2014-07-04 13:00',
                             '2014-07-04 14:00',
                             '2014-07-04 15:00', '2014-07-04 16:00',
                             '2014-07-07 09:00', '2014-07-07 10:00',
                             '2014-07-07 11:00',
                             '2014-07-07 12:00', '2014-07-07 13:00',
                             '2014-07-07 14:00',
                             '2014-07-07 15:00', '2014-07-07 16:00',
                             '2014-07-08 09:00', '2014-07-08 10:00',
                             '2014-07-08 11:00',
                             '2014-07-08 12:00', '2014-07-08 13:00',
                             '2014-07-08 14:00',
                             '2014-07-08 15:00', '2014-07-08 16:00'],
                            freq='BH')
        rng = date_range('2014-07-04 09:00', '2014-07-08 16:00', freq='BH')
        tm.assert_index_equal(idx, rng)

    def test_range_misspecified(self):
        # GH #1095

        pytest.raises(ValueError, date_range, '1/1/2000')
        pytest.raises(ValueError, date_range, end='1/1/2000')
        pytest.raises(ValueError, date_range, periods=10)

        pytest.raises(ValueError, date_range, '1/1/2000', freq='H')
        pytest.raises(ValueError, date_range, end='1/1/2000', freq='H')
        pytest.raises(ValueError, date_range, periods=10, freq='H')

    def test_compat_replace(self):
        # https://github.com/statsmodels/statsmodels/issues/3349
        # replace should take ints/longs for compat

        for f in [compat.long, int]:
            result = date_range(Timestamp('1960-04-01 00:00:00',
                                          freq='QS-JAN'),
                                periods=f(76),
                                freq='QS-JAN')
            assert len(result) == 76

    def test_catch_infinite_loop(self):
        offset = offsets.DateOffset(minute=5)
        # blow up, don't loop forever
        pytest.raises(Exception, date_range, datetime(2011, 11, 11),
                      datetime(2011, 11, 12), freq=offset)


class TestGenRangeGeneration(object):

    def test_generate(self):
        rng1 = list(generate_range(START, END, offset=BDay()))
        rng2 = list(generate_range(START, END, time_rule='B'))
        assert rng1 == rng2

    def test_generate_cday(self):
        rng1 = list(generate_range(START, END, offset=CDay()))
        rng2 = list(generate_range(START, END, time_rule='C'))
        assert rng1 == rng2

    def test_1(self):
        eq_gen_range(dict(start=datetime(2009, 3, 25), periods=2),
                     [datetime(2009, 3, 25), datetime(2009, 3, 26)])

    def test_2(self):
        eq_gen_range(dict(start=datetime(2008, 1, 1),
                          end=datetime(2008, 1, 3)),
                     [datetime(2008, 1, 1),
                      datetime(2008, 1, 2),
                      datetime(2008, 1, 3)])

    def test_3(self):
        eq_gen_range(dict(start=datetime(2008, 1, 5),
                          end=datetime(2008, 1, 6)),
                     [])

    def test_precision_finer_than_offset(self):
        # GH 9907
        result1 = DatetimeIndex(start='2015-04-15 00:00:03',
                                end='2016-04-22 00:00:00', freq='Q')
        result2 = DatetimeIndex(start='2015-04-15 00:00:03',
                                end='2015-06-22 00:00:04', freq='W')
        expected1_list = ['2015-06-30 00:00:03', '2015-09-30 00:00:03',
                          '2015-12-31 00:00:03', '2016-03-31 00:00:03']
        expected2_list = ['2015-04-19 00:00:03', '2015-04-26 00:00:03',
                          '2015-05-03 00:00:03', '2015-05-10 00:00:03',
                          '2015-05-17 00:00:03', '2015-05-24 00:00:03',
                          '2015-05-31 00:00:03', '2015-06-07 00:00:03',
                          '2015-06-14 00:00:03', '2015-06-21 00:00:03']
        expected1 = DatetimeIndex(expected1_list, dtype='datetime64[ns]',
                                  freq='Q-DEC', tz=None)
        expected2 = DatetimeIndex(expected2_list, dtype='datetime64[ns]',
                                  freq='W-SUN', tz=None)
        tm.assert_index_equal(result1, expected1)
        tm.assert_index_equal(result2, expected2)


class TestBusinessDateRange(object):

    def setup_method(self, method):
        self.rng = bdate_range(START, END)

    def test_constructor(self):
        bdate_range(START, END, freq=BDay())
        bdate_range(START, periods=20, freq=BDay())
        bdate_range(end=START, periods=20, freq=BDay())
        pytest.raises(ValueError, date_range, '2011-1-1', '2012-1-1', 'B')
        pytest.raises(ValueError, bdate_range, '2011-1-1', '2012-1-1', 'B')

    def test_naive_aware_conflicts(self):
        naive = bdate_range(START, END, freq=BDay(), tz=None)
        aware = bdate_range(START, END, freq=BDay(),
                            tz="Asia/Hong_Kong")
        tm.assert_raises_regex(TypeError, "tz-naive.*tz-aware",
                               naive.join, aware)
        tm.assert_raises_regex(TypeError, "tz-naive.*tz-aware",
                               aware.join, naive)

    def test_cached_range(self):
        DatetimeIndex._cached_range(START, END, offset=BDay())
        DatetimeIndex._cached_range(START, periods=20, offset=BDay())
        DatetimeIndex._cached_range(end=START, periods=20, offset=BDay())

        tm.assert_raises_regex(TypeError, "offset",
                               DatetimeIndex._cached_range,
                               START, END)

        tm.assert_raises_regex(TypeError, "specify period",
                               DatetimeIndex._cached_range, START,
                               offset=BDay())

        tm.assert_raises_regex(TypeError, "specify period",
                               DatetimeIndex._cached_range, end=END,
                               offset=BDay())

        tm.assert_raises_regex(TypeError, "start or end",
                               DatetimeIndex._cached_range, periods=20,
                               offset=BDay())

    def test_cached_range_bug(self):
        rng = date_range('2010-09-01 05:00:00', periods=50,
                         freq=DateOffset(hours=6))
        assert len(rng) == 50
        assert rng[0] == datetime(2010, 9, 1, 5)

    def test_timezone_comparaison_bug(self):
        # smoke test
        start = Timestamp('20130220 10:00', tz='US/Eastern')
        result = date_range(start, periods=2, tz='US/Eastern')
        assert len(result) == 2

    def test_timezone_comparaison_assert(self):
        start = Timestamp('20130220 10:00', tz='US/Eastern')
        pytest.raises(AssertionError, date_range, start, periods=2,
                      tz='Europe/Berlin')

    def test_misc(self):
        end = datetime(2009, 5, 13)
        dr = bdate_range(end=end, periods=20)
        firstDate = end - 19 * BDay()

        assert len(dr) == 20
        assert dr[0] == firstDate
        assert dr[-1] == end

    def test_date_parse_failure(self):
        badly_formed_date = '2007/100/1'

        pytest.raises(ValueError, Timestamp, badly_formed_date)

        pytest.raises(ValueError, bdate_range, start=badly_formed_date,
                      periods=10)
        pytest.raises(ValueError, bdate_range, end=badly_formed_date,
                      periods=10)
        pytest.raises(ValueError, bdate_range, badly_formed_date,
                      badly_formed_date)

    def test_daterange_bug_456(self):
        # GH #456
        rng1 = bdate_range('12/5/2011', '12/5/2011')
        rng2 = bdate_range('12/2/2011', '12/5/2011')
        rng2.offset = BDay()

        result = rng1.union(rng2)
        assert isinstance(result, DatetimeIndex)

    def test_error_with_zero_monthends(self):
        pytest.raises(ValueError, date_range, '1/1/2000', '1/1/2001',
                      freq=MonthEnd(0))

    def test_range_bug(self):
        # GH #770
        offset = DateOffset(months=3)
        result = date_range("2011-1-1", "2012-1-31", freq=offset)

        start = datetime(2011, 1, 1)
        exp_values = [start + i * offset for i in range(5)]
        tm.assert_index_equal(result, DatetimeIndex(exp_values))

    def test_range_tz_pytz(self):
        # GH 2906
        tm._skip_if_no_pytz()
        from pytz import timezone

        tz = timezone('US/Eastern')
        start = tz.localize(datetime(2011, 1, 1))
        end = tz.localize(datetime(2011, 1, 3))

        dr = date_range(start=start, periods=3)
        assert dr.tz.zone == tz.zone
        assert dr[0] == start
        assert dr[2] == end

        dr = date_range(end=end, periods=3)
        assert dr.tz.zone == tz.zone
        assert dr[0] == start
        assert dr[2] == end

        dr = date_range(start=start, end=end)
        assert dr.tz.zone == tz.zone
        assert dr[0] == start
        assert dr[2] == end

    def test_range_tz_dst_straddle_pytz(self):

        tm._skip_if_no_pytz()
        from pytz import timezone
        tz = timezone('US/Eastern')
        dates = [(tz.localize(datetime(2014, 3, 6)),
                  tz.localize(datetime(2014, 3, 12))),
                 (tz.localize(datetime(2013, 11, 1)),
                  tz.localize(datetime(2013, 11, 6)))]
        for (start, end) in dates:
            dr = date_range(start, end, freq='D')
            assert dr[0] == start
            assert dr[-1] == end
            assert np.all(dr.hour == 0)

            dr = date_range(start, end, freq='D', tz='US/Eastern')
            assert dr[0] == start
            assert dr[-1] == end
            assert np.all(dr.hour == 0)

            dr = date_range(start.replace(tzinfo=None), end.replace(
                tzinfo=None), freq='D', tz='US/Eastern')
            assert dr[0] == start
            assert dr[-1] == end
            assert np.all(dr.hour == 0)

    def test_range_tz_dateutil(self):
        # GH 2906
        tm._skip_if_no_dateutil()
        # Use maybe_get_tz to fix filename in tz under dateutil.
        from pandas._libs.tslib import maybe_get_tz
        tz = lambda x: maybe_get_tz('dateutil/' + x)

        start = datetime(2011, 1, 1, tzinfo=tz('US/Eastern'))
        end = datetime(2011, 1, 3, tzinfo=tz('US/Eastern'))

        dr = date_range(start=start, periods=3)
        assert dr.tz == tz('US/Eastern')
        assert dr[0] == start
        assert dr[2] == end

        dr = date_range(end=end, periods=3)
        assert dr.tz == tz('US/Eastern')
        assert dr[0] == start
        assert dr[2] == end

        dr = date_range(start=start, end=end)
        assert dr.tz == tz('US/Eastern')
        assert dr[0] == start
        assert dr[2] == end

    def test_range_closed(self):
        begin = datetime(2011, 1, 1)
        end = datetime(2014, 1, 1)

        for freq in ["1D", "3D", "2M", "7W", "3H", "A"]:
            closed = date_range(begin, end, closed=None, freq=freq)
            left = date_range(begin, end, closed="left", freq=freq)
            right = date_range(begin, end, closed="right", freq=freq)
            expected_left = left
            expected_right = right

            if end == closed[-1]:
                expected_left = closed[:-1]
            if begin == closed[0]:
                expected_right = closed[1:]

            tm.assert_index_equal(expected_left, left)
            tm.assert_index_equal(expected_right, right)

    def test_range_closed_with_tz_aware_start_end(self):
        # GH12409, GH12684
        begin = Timestamp('2011/1/1', tz='US/Eastern')
        end = Timestamp('2014/1/1', tz='US/Eastern')

        for freq in ["1D", "3D", "2M", "7W", "3H", "A"]:
            closed = date_range(begin, end, closed=None, freq=freq)
            left = date_range(begin, end, closed="left", freq=freq)
            right = date_range(begin, end, closed="right", freq=freq)
            expected_left = left
            expected_right = right

            if end == closed[-1]:
                expected_left = closed[:-1]
            if begin == closed[0]:
                expected_right = closed[1:]

            tm.assert_index_equal(expected_left, left)
            tm.assert_index_equal(expected_right, right)

        begin = Timestamp('2011/1/1')
        end = Timestamp('2014/1/1')
        begintz = Timestamp('2011/1/1', tz='US/Eastern')
        endtz = Timestamp('2014/1/1', tz='US/Eastern')

        for freq in ["1D", "3D", "2M", "7W", "3H", "A"]:
            closed = date_range(begin, end, closed=None, freq=freq,
                                tz='US/Eastern')
            left = date_range(begin, end, closed="left", freq=freq,
                              tz='US/Eastern')
            right = date_range(begin, end, closed="right", freq=freq,
                               tz='US/Eastern')
            expected_left = left
            expected_right = right

            if endtz == closed[-1]:
                expected_left = closed[:-1]
            if begintz == closed[0]:
                expected_right = closed[1:]

            tm.assert_index_equal(expected_left, left)
            tm.assert_index_equal(expected_right, right)

    def test_range_closed_boundary(self):
        # GH 11804
        for closed in ['right', 'left', None]:
            right_boundary = date_range('2015-09-12', '2015-12-01',
                                        freq='QS-MAR', closed=closed)
            left_boundary = date_range('2015-09-01', '2015-09-12',
                                       freq='QS-MAR', closed=closed)
            both_boundary = date_range('2015-09-01', '2015-12-01',
                                       freq='QS-MAR', closed=closed)
            expected_right = expected_left = expected_both = both_boundary

            if closed == 'right':
                expected_left = both_boundary[1:]
            if closed == 'left':
                expected_right = both_boundary[:-1]
            if closed is None:
                expected_right = both_boundary[1:]
                expected_left = both_boundary[:-1]

            tm.assert_index_equal(right_boundary, expected_right)
            tm.assert_index_equal(left_boundary, expected_left)
            tm.assert_index_equal(both_boundary, expected_both)

    def test_years_only(self):
        # GH 6961
        dr = date_range('2014', '2015', freq='M')
        assert dr[0] == datetime(2014, 1, 31)
        assert dr[-1] == datetime(2014, 12, 31)

    def test_freq_divides_end_in_nanos(self):
        # GH 10885
        result_1 = date_range('2005-01-12 10:00', '2005-01-12 16:00',
                              freq='345min')
        result_2 = date_range('2005-01-13 10:00', '2005-01-13 16:00',
                              freq='345min')
        expected_1 = DatetimeIndex(['2005-01-12 10:00:00',
                                    '2005-01-12 15:45:00'],
                                   dtype='datetime64[ns]', freq='345T',
                                   tz=None)
        expected_2 = DatetimeIndex(['2005-01-13 10:00:00',
                                    '2005-01-13 15:45:00'],
                                   dtype='datetime64[ns]', freq='345T',
                                   tz=None)
        tm.assert_index_equal(result_1, expected_1)
        tm.assert_index_equal(result_2, expected_2)


class TestCustomDateRange(object):
    def setup_method(self, method):
        self.rng = cdate_range(START, END)

    def test_constructor(self):
        cdate_range(START, END, freq=CDay())
        cdate_range(START, periods=20, freq=CDay())
        cdate_range(end=START, periods=20, freq=CDay())
        pytest.raises(ValueError, date_range, '2011-1-1', '2012-1-1', 'C')
        pytest.raises(ValueError, cdate_range, '2011-1-1', '2012-1-1', 'C')

    def test_cached_range(self):
        DatetimeIndex._cached_range(START, END, offset=CDay())
        DatetimeIndex._cached_range(START, periods=20,
                                    offset=CDay())
        DatetimeIndex._cached_range(end=START, periods=20,
                                    offset=CDay())

        pytest.raises(Exception, DatetimeIndex._cached_range, START, END)

        pytest.raises(Exception, DatetimeIndex._cached_range, START,
                      freq=CDay())

        pytest.raises(Exception, DatetimeIndex._cached_range, end=END,
                      freq=CDay())

        pytest.raises(Exception, DatetimeIndex._cached_range, periods=20,
                      freq=CDay())

    def test_misc(self):
        end = datetime(2009, 5, 13)
        dr = cdate_range(end=end, periods=20)
        firstDate = end - 19 * CDay()

        assert len(dr) == 20
        assert dr[0] == firstDate
        assert dr[-1] == end

    def test_date_parse_failure(self):
        badly_formed_date = '2007/100/1'

        pytest.raises(ValueError, Timestamp, badly_formed_date)

        pytest.raises(ValueError, cdate_range, start=badly_formed_date,
                      periods=10)
        pytest.raises(ValueError, cdate_range, end=badly_formed_date,
                      periods=10)
        pytest.raises(ValueError, cdate_range, badly_formed_date,
                      badly_formed_date)

    def test_daterange_bug_456(self):
        # GH #456
        rng1 = cdate_range('12/5/2011', '12/5/2011')
        rng2 = cdate_range('12/2/2011', '12/5/2011')
        rng2.offset = CDay()

        result = rng1.union(rng2)
        assert isinstance(result, DatetimeIndex)

    def test_cdaterange(self):
        rng = cdate_range('2013-05-01', periods=3)
        xp = DatetimeIndex(['2013-05-01', '2013-05-02', '2013-05-03'])
        tm.assert_index_equal(xp, rng)

    def test_cdaterange_weekmask(self):
        rng = cdate_range('2013-05-01', periods=3,
                          weekmask='Sun Mon Tue Wed Thu')
        xp = DatetimeIndex(['2013-05-01', '2013-05-02', '2013-05-05'])
        tm.assert_index_equal(xp, rng)

    def test_cdaterange_holidays(self):
        rng = cdate_range('2013-05-01', periods=3, holidays=['2013-05-01'])
        xp = DatetimeIndex(['2013-05-02', '2013-05-03', '2013-05-06'])
        tm.assert_index_equal(xp, rng)

    def test_cdaterange_weekmask_and_holidays(self):
        rng = cdate_range('2013-05-01', periods=3,
                          weekmask='Sun Mon Tue Wed Thu',
                          holidays=['2013-05-01'])
        xp = DatetimeIndex(['2013-05-02', '2013-05-05', '2013-05-06'])
        tm.assert_index_equal(xp, rng)
