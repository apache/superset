from datetime import datetime, timedelta
from pandas.compat import range

import pytest
import numpy as np

from pandas import (Index, DatetimeIndex, Timestamp, Series,
                    date_range, period_range)

import pandas.tseries.frequencies as frequencies
from pandas.core.tools.datetimes import to_datetime

import pandas.tseries.offsets as offsets
from pandas.core.indexes.period import PeriodIndex
import pandas.compat as compat
from pandas.compat import is_platform_windows

import pandas.util.testing as tm
from pandas import Timedelta


class TestToOffset(object):

    def test_to_offset_multiple(self):
        freqstr = '2h30min'
        freqstr2 = '2h 30min'

        result = frequencies.to_offset(freqstr)
        assert (result == frequencies.to_offset(freqstr2))
        expected = offsets.Minute(150)
        assert (result == expected)

        freqstr = '2h30min15s'
        result = frequencies.to_offset(freqstr)
        expected = offsets.Second(150 * 60 + 15)
        assert (result == expected)

        freqstr = '2h 60min'
        result = frequencies.to_offset(freqstr)
        expected = offsets.Hour(3)
        assert (result == expected)

        freqstr = '2h 20.5min'
        result = frequencies.to_offset(freqstr)
        expected = offsets.Second(8430)
        assert (result == expected)

        freqstr = '1.5min'
        result = frequencies.to_offset(freqstr)
        expected = offsets.Second(90)
        assert (result == expected)

        freqstr = '0.5S'
        result = frequencies.to_offset(freqstr)
        expected = offsets.Milli(500)
        assert (result == expected)

        freqstr = '15l500u'
        result = frequencies.to_offset(freqstr)
        expected = offsets.Micro(15500)
        assert (result == expected)

        freqstr = '10s75L'
        result = frequencies.to_offset(freqstr)
        expected = offsets.Milli(10075)
        assert (result == expected)

        freqstr = '1s0.25ms'
        result = frequencies.to_offset(freqstr)
        expected = offsets.Micro(1000250)
        assert (result == expected)

        freqstr = '1s0.25L'
        result = frequencies.to_offset(freqstr)
        expected = offsets.Micro(1000250)
        assert (result == expected)

        freqstr = '2800N'
        result = frequencies.to_offset(freqstr)
        expected = offsets.Nano(2800)
        assert (result == expected)

        freqstr = '2SM'
        result = frequencies.to_offset(freqstr)
        expected = offsets.SemiMonthEnd(2)
        assert (result == expected)

        freqstr = '2SM-16'
        result = frequencies.to_offset(freqstr)
        expected = offsets.SemiMonthEnd(2, day_of_month=16)
        assert (result == expected)

        freqstr = '2SMS-14'
        result = frequencies.to_offset(freqstr)
        expected = offsets.SemiMonthBegin(2, day_of_month=14)
        assert (result == expected)

        freqstr = '2SMS-15'
        result = frequencies.to_offset(freqstr)
        expected = offsets.SemiMonthBegin(2)
        assert (result == expected)

        # malformed
        with tm.assert_raises_regex(ValueError,
                                    'Invalid frequency: 2h20m'):
            frequencies.to_offset('2h20m')

    def test_to_offset_negative(self):
        freqstr = '-1S'
        result = frequencies.to_offset(freqstr)
        assert (result.n == -1)

        freqstr = '-5min10s'
        result = frequencies.to_offset(freqstr)
        assert (result.n == -310)

        freqstr = '-2SM'
        result = frequencies.to_offset(freqstr)
        assert (result.n == -2)

        freqstr = '-1SMS'
        result = frequencies.to_offset(freqstr)
        assert (result.n == -1)

    def test_to_offset_invalid(self):
        # GH 13930
        with tm.assert_raises_regex(ValueError,
                                    'Invalid frequency: U1'):
            frequencies.to_offset('U1')
        with tm.assert_raises_regex(ValueError,
                                    'Invalid frequency: -U'):
            frequencies.to_offset('-U')
        with tm.assert_raises_regex(ValueError,
                                    'Invalid frequency: 3U1'):
            frequencies.to_offset('3U1')
        with tm.assert_raises_regex(ValueError,
                                    'Invalid frequency: -2-3U'):
            frequencies.to_offset('-2-3U')
        with tm.assert_raises_regex(ValueError,
                                    'Invalid frequency: -2D:3H'):
            frequencies.to_offset('-2D:3H')
        with tm.assert_raises_regex(ValueError,
                                    'Invalid frequency: 1.5.0S'):
            frequencies.to_offset('1.5.0S')

        # split offsets with spaces are valid
        assert frequencies.to_offset('2D 3H') == offsets.Hour(51)
        assert frequencies.to_offset('2 D3 H') == offsets.Hour(51)
        assert frequencies.to_offset('2 D 3 H') == offsets.Hour(51)
        assert frequencies.to_offset('  2 D 3 H  ') == offsets.Hour(51)
        assert frequencies.to_offset('   H    ') == offsets.Hour()
        assert frequencies.to_offset(' 3  H    ') == offsets.Hour(3)

        # special cases
        assert frequencies.to_offset('2SMS-15') == offsets.SemiMonthBegin(2)
        with tm.assert_raises_regex(ValueError,
                                    'Invalid frequency: 2SMS-15-15'):
            frequencies.to_offset('2SMS-15-15')
        with tm.assert_raises_regex(ValueError,
                                    'Invalid frequency: 2SMS-15D'):
            frequencies.to_offset('2SMS-15D')

    def test_to_offset_leading_zero(self):
        freqstr = '00H 00T 01S'
        result = frequencies.to_offset(freqstr)
        assert (result.n == 1)

        freqstr = '-00H 03T 14S'
        result = frequencies.to_offset(freqstr)
        assert (result.n == -194)

    def test_to_offset_pd_timedelta(self):
        # Tests for #9064
        td = Timedelta(days=1, seconds=1)
        result = frequencies.to_offset(td)
        expected = offsets.Second(86401)
        assert (expected == result)

        td = Timedelta(days=-1, seconds=1)
        result = frequencies.to_offset(td)
        expected = offsets.Second(-86399)
        assert (expected == result)

        td = Timedelta(hours=1, minutes=10)
        result = frequencies.to_offset(td)
        expected = offsets.Minute(70)
        assert (expected == result)

        td = Timedelta(hours=1, minutes=-10)
        result = frequencies.to_offset(td)
        expected = offsets.Minute(50)
        assert (expected == result)

        td = Timedelta(weeks=1)
        result = frequencies.to_offset(td)
        expected = offsets.Day(7)
        assert (expected == result)

        td1 = Timedelta(hours=1)
        result1 = frequencies.to_offset(td1)
        result2 = frequencies.to_offset('60min')
        assert (result1 == result2)

        td = Timedelta(microseconds=1)
        result = frequencies.to_offset(td)
        expected = offsets.Micro(1)
        assert (expected == result)

        td = Timedelta(microseconds=0)
        pytest.raises(ValueError, lambda: frequencies.to_offset(td))

    def test_anchored_shortcuts(self):
        result = frequencies.to_offset('W')
        expected = frequencies.to_offset('W-SUN')
        assert (result == expected)

        result1 = frequencies.to_offset('Q')
        result2 = frequencies.to_offset('Q-DEC')
        expected = offsets.QuarterEnd(startingMonth=12)
        assert (result1 == expected)
        assert (result2 == expected)

        result1 = frequencies.to_offset('Q-MAY')
        expected = offsets.QuarterEnd(startingMonth=5)
        assert (result1 == expected)

        result1 = frequencies.to_offset('SM')
        result2 = frequencies.to_offset('SM-15')
        expected = offsets.SemiMonthEnd(day_of_month=15)
        assert (result1 == expected)
        assert (result2 == expected)

        result = frequencies.to_offset('SM-1')
        expected = offsets.SemiMonthEnd(day_of_month=1)
        assert (result == expected)

        result = frequencies.to_offset('SM-27')
        expected = offsets.SemiMonthEnd(day_of_month=27)
        assert (result == expected)

        result = frequencies.to_offset('SMS-2')
        expected = offsets.SemiMonthBegin(day_of_month=2)
        assert (result == expected)

        result = frequencies.to_offset('SMS-27')
        expected = offsets.SemiMonthBegin(day_of_month=27)
        assert (result == expected)

        # ensure invalid cases fail as expected
        invalid_anchors = ['SM-0', 'SM-28', 'SM-29',
                           'SM-FOO', 'BSM', 'SM--1'
                           'SMS-1', 'SMS-28', 'SMS-30',
                           'SMS-BAR', 'BSMS', 'SMS--2']
        for invalid_anchor in invalid_anchors:
            with tm.assert_raises_regex(ValueError,
                                        'Invalid frequency: '):
                frequencies.to_offset(invalid_anchor)


def test_ms_vs_MS():
    left = frequencies.get_offset('ms')
    right = frequencies.get_offset('MS')
    assert left == offsets.Milli()
    assert right == offsets.MonthBegin()


def test_rule_aliases():
    rule = frequencies.to_offset('10us')
    assert rule == offsets.Micro(10)


def test_get_rule_month():
    result = frequencies._get_rule_month('W')
    assert (result == 'DEC')
    result = frequencies._get_rule_month(offsets.Week())
    assert (result == 'DEC')

    result = frequencies._get_rule_month('D')
    assert (result == 'DEC')
    result = frequencies._get_rule_month(offsets.Day())
    assert (result == 'DEC')

    result = frequencies._get_rule_month('Q')
    assert (result == 'DEC')
    result = frequencies._get_rule_month(offsets.QuarterEnd(startingMonth=12))
    print(result == 'DEC')

    result = frequencies._get_rule_month('Q-JAN')
    assert (result == 'JAN')
    result = frequencies._get_rule_month(offsets.QuarterEnd(startingMonth=1))
    assert (result == 'JAN')

    result = frequencies._get_rule_month('A-DEC')
    assert (result == 'DEC')
    result = frequencies._get_rule_month(offsets.YearEnd())
    assert (result == 'DEC')

    result = frequencies._get_rule_month('A-MAY')
    assert (result == 'MAY')
    result = frequencies._get_rule_month(offsets.YearEnd(month=5))
    assert (result == 'MAY')


def test_period_str_to_code():
    assert (frequencies._period_str_to_code('A') == 1000)
    assert (frequencies._period_str_to_code('A-DEC') == 1000)
    assert (frequencies._period_str_to_code('A-JAN') == 1001)
    assert (frequencies._period_str_to_code('Q') == 2000)
    assert (frequencies._period_str_to_code('Q-DEC') == 2000)
    assert (frequencies._period_str_to_code('Q-FEB') == 2002)

    def _assert_depr(freq, expected, aliases):
        assert isinstance(aliases, list)
        assert (frequencies._period_str_to_code(freq) == expected)

        msg = frequencies._INVALID_FREQ_ERROR
        for alias in aliases:
            with tm.assert_raises_regex(ValueError, msg):
                frequencies._period_str_to_code(alias)

    _assert_depr("M", 3000, ["MTH", "MONTH", "MONTHLY"])

    assert (frequencies._period_str_to_code('W') == 4000)
    assert (frequencies._period_str_to_code('W-SUN') == 4000)
    assert (frequencies._period_str_to_code('W-FRI') == 4005)

    _assert_depr("B", 5000, ["BUS", "BUSINESS", "BUSINESSLY", "WEEKDAY"])
    _assert_depr("D", 6000, ["DAY", "DLY", "DAILY"])
    _assert_depr("H", 7000, ["HR", "HOUR", "HRLY", "HOURLY"])

    _assert_depr("T", 8000, ["minute", "MINUTE", "MINUTELY"])
    assert (frequencies._period_str_to_code('Min') == 8000)

    _assert_depr("S", 9000, ["sec", "SEC", "SECOND", "SECONDLY"])
    _assert_depr("L", 10000, ["MILLISECOND", "MILLISECONDLY"])
    assert (frequencies._period_str_to_code('ms') == 10000)

    _assert_depr("U", 11000, ["MICROSECOND", "MICROSECONDLY"])
    assert (frequencies._period_str_to_code('US') == 11000)

    _assert_depr("N", 12000, ["NANOSECOND", "NANOSECONDLY"])
    assert (frequencies._period_str_to_code('NS') == 12000)


class TestFrequencyCode(object):

    def test_freq_code(self):
        assert frequencies.get_freq('A') == 1000
        assert frequencies.get_freq('3A') == 1000
        assert frequencies.get_freq('-1A') == 1000

        assert frequencies.get_freq('W') == 4000
        assert frequencies.get_freq('W-MON') == 4001
        assert frequencies.get_freq('W-FRI') == 4005

        for freqstr, code in compat.iteritems(frequencies._period_code_map):
            result = frequencies.get_freq(freqstr)
            assert result == code

            result = frequencies.get_freq_group(freqstr)
            assert result == code // 1000 * 1000

            result = frequencies.get_freq_group(code)
            assert result == code // 1000 * 1000

    def test_freq_group(self):
        assert frequencies.get_freq_group('A') == 1000
        assert frequencies.get_freq_group('3A') == 1000
        assert frequencies.get_freq_group('-1A') == 1000
        assert frequencies.get_freq_group('A-JAN') == 1000
        assert frequencies.get_freq_group('A-MAY') == 1000
        assert frequencies.get_freq_group(offsets.YearEnd()) == 1000
        assert frequencies.get_freq_group(offsets.YearEnd(month=1)) == 1000
        assert frequencies.get_freq_group(offsets.YearEnd(month=5)) == 1000

        assert frequencies.get_freq_group('W') == 4000
        assert frequencies.get_freq_group('W-MON') == 4000
        assert frequencies.get_freq_group('W-FRI') == 4000
        assert frequencies.get_freq_group(offsets.Week()) == 4000
        assert frequencies.get_freq_group(offsets.Week(weekday=1)) == 4000
        assert frequencies.get_freq_group(offsets.Week(weekday=5)) == 4000

    def test_get_to_timestamp_base(self):
        tsb = frequencies.get_to_timestamp_base

        assert (tsb(frequencies.get_freq_code('D')[0]) ==
                frequencies.get_freq_code('D')[0])
        assert (tsb(frequencies.get_freq_code('W')[0]) ==
                frequencies.get_freq_code('D')[0])
        assert (tsb(frequencies.get_freq_code('M')[0]) ==
                frequencies.get_freq_code('D')[0])

        assert (tsb(frequencies.get_freq_code('S')[0]) ==
                frequencies.get_freq_code('S')[0])
        assert (tsb(frequencies.get_freq_code('T')[0]) ==
                frequencies.get_freq_code('S')[0])
        assert (tsb(frequencies.get_freq_code('H')[0]) ==
                frequencies.get_freq_code('S')[0])

    def test_freq_to_reso(self):
        Reso = frequencies.Resolution

        assert Reso.get_str_from_freq('A') == 'year'
        assert Reso.get_str_from_freq('Q') == 'quarter'
        assert Reso.get_str_from_freq('M') == 'month'
        assert Reso.get_str_from_freq('D') == 'day'
        assert Reso.get_str_from_freq('H') == 'hour'
        assert Reso.get_str_from_freq('T') == 'minute'
        assert Reso.get_str_from_freq('S') == 'second'
        assert Reso.get_str_from_freq('L') == 'millisecond'
        assert Reso.get_str_from_freq('U') == 'microsecond'
        assert Reso.get_str_from_freq('N') == 'nanosecond'

        for freq in ['A', 'Q', 'M', 'D', 'H', 'T', 'S', 'L', 'U', 'N']:
            # check roundtrip
            result = Reso.get_freq(Reso.get_str_from_freq(freq))
            assert freq == result

        for freq in ['D', 'H', 'T', 'S', 'L', 'U']:
            result = Reso.get_freq(Reso.get_str(Reso.get_reso_from_freq(freq)))
            assert freq == result

    def test_resolution_bumping(self):
        # see gh-14378
        Reso = frequencies.Resolution

        assert Reso.get_stride_from_decimal(1.5, 'T') == (90, 'S')
        assert Reso.get_stride_from_decimal(62.4, 'T') == (3744, 'S')
        assert Reso.get_stride_from_decimal(1.04, 'H') == (3744, 'S')
        assert Reso.get_stride_from_decimal(1, 'D') == (1, 'D')
        assert (Reso.get_stride_from_decimal(0.342931, 'H') ==
                (1234551600, 'U'))
        assert Reso.get_stride_from_decimal(1.2345, 'D') == (106660800, 'L')

        with pytest.raises(ValueError):
            Reso.get_stride_from_decimal(0.5, 'N')

        # too much precision in the input can prevent
        with pytest.raises(ValueError):
            Reso.get_stride_from_decimal(0.3429324798798269273987982, 'H')

    def test_get_freq_code(self):
        # frequency str
        assert (frequencies.get_freq_code('A') ==
                (frequencies.get_freq('A'), 1))
        assert (frequencies.get_freq_code('3D') ==
                (frequencies.get_freq('D'), 3))
        assert (frequencies.get_freq_code('-2M') ==
                (frequencies.get_freq('M'), -2))

        # tuple
        assert (frequencies.get_freq_code(('D', 1)) ==
                (frequencies.get_freq('D'), 1))
        assert (frequencies.get_freq_code(('A', 3)) ==
                (frequencies.get_freq('A'), 3))
        assert (frequencies.get_freq_code(('M', -2)) ==
                (frequencies.get_freq('M'), -2))

        # numeric tuple
        assert frequencies.get_freq_code((1000, 1)) == (1000, 1)

        # offsets
        assert (frequencies.get_freq_code(offsets.Day()) ==
                (frequencies.get_freq('D'), 1))
        assert (frequencies.get_freq_code(offsets.Day(3)) ==
                (frequencies.get_freq('D'), 3))
        assert (frequencies.get_freq_code(offsets.Day(-2)) ==
                (frequencies.get_freq('D'), -2))

        assert (frequencies.get_freq_code(offsets.MonthEnd()) ==
                (frequencies.get_freq('M'), 1))
        assert (frequencies.get_freq_code(offsets.MonthEnd(3)) ==
                (frequencies.get_freq('M'), 3))
        assert (frequencies.get_freq_code(offsets.MonthEnd(-2)) ==
                (frequencies.get_freq('M'), -2))

        assert (frequencies.get_freq_code(offsets.Week()) ==
                (frequencies.get_freq('W'), 1))
        assert (frequencies.get_freq_code(offsets.Week(3)) ==
                (frequencies.get_freq('W'), 3))
        assert (frequencies.get_freq_code(offsets.Week(-2)) ==
                (frequencies.get_freq('W'), -2))

        # Monday is weekday=0
        assert (frequencies.get_freq_code(offsets.Week(weekday=1)) ==
                (frequencies.get_freq('W-TUE'), 1))
        assert (frequencies.get_freq_code(offsets.Week(3, weekday=0)) ==
                (frequencies.get_freq('W-MON'), 3))
        assert (frequencies.get_freq_code(offsets.Week(-2, weekday=4)) ==
                (frequencies.get_freq('W-FRI'), -2))


_dti = DatetimeIndex


class TestFrequencyInference(object):

    def test_raise_if_period_index(self):
        index = PeriodIndex(start="1/1/1990", periods=20, freq="M")
        pytest.raises(TypeError, frequencies.infer_freq, index)

    def test_raise_if_too_few(self):
        index = _dti(['12/31/1998', '1/3/1999'])
        pytest.raises(ValueError, frequencies.infer_freq, index)

    def test_business_daily(self):
        index = _dti(['12/31/1998', '1/3/1999', '1/4/1999'])
        assert frequencies.infer_freq(index) == 'B'

    def test_day(self):
        self._check_tick(timedelta(1), 'D')

    def test_day_corner(self):
        index = _dti(['1/1/2000', '1/2/2000', '1/3/2000'])
        assert frequencies.infer_freq(index) == 'D'

    def test_non_datetimeindex(self):
        dates = to_datetime(['1/1/2000', '1/2/2000', '1/3/2000'])
        assert frequencies.infer_freq(dates) == 'D'

    def test_hour(self):
        self._check_tick(timedelta(hours=1), 'H')

    def test_minute(self):
        self._check_tick(timedelta(minutes=1), 'T')

    def test_second(self):
        self._check_tick(timedelta(seconds=1), 'S')

    def test_millisecond(self):
        self._check_tick(timedelta(microseconds=1000), 'L')

    def test_microsecond(self):
        self._check_tick(timedelta(microseconds=1), 'U')

    def test_nanosecond(self):
        self._check_tick(np.timedelta64(1, 'ns'), 'N')

    def _check_tick(self, base_delta, code):
        b = Timestamp(datetime.now())
        for i in range(1, 5):
            inc = base_delta * i
            index = _dti([b + inc * j for j in range(3)])
            if i > 1:
                exp_freq = '%d%s' % (i, code)
            else:
                exp_freq = code
            assert frequencies.infer_freq(index) == exp_freq

        index = _dti([b + base_delta * 7] + [b + base_delta * j for j in range(
            3)])
        assert frequencies.infer_freq(index) is None

        index = _dti([b + base_delta * j for j in range(3)] + [b + base_delta *
                                                               7])

        assert frequencies.infer_freq(index) is None

    def test_weekly(self):
        days = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN']

        for day in days:
            self._check_generated_range('1/1/2000', 'W-%s' % day)

    def test_week_of_month(self):
        days = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN']

        for day in days:
            for i in range(1, 5):
                self._check_generated_range('1/1/2000', 'WOM-%d%s' % (i, day))

    def test_fifth_week_of_month(self):
        # Only supports freq up to WOM-4. See #9425
        func = lambda: date_range('2014-01-01', freq='WOM-5MON')
        pytest.raises(ValueError, func)

    def test_fifth_week_of_month_infer(self):
        # Only attempts to infer up to WOM-4. See #9425
        index = DatetimeIndex(["2014-03-31", "2014-06-30", "2015-03-30"])
        assert frequencies.infer_freq(index) is None

    def test_week_of_month_fake(self):
        # All of these dates are on same day of week and are 4 or 5 weeks apart
        index = DatetimeIndex(["2013-08-27", "2013-10-01", "2013-10-29",
                               "2013-11-26"])
        assert frequencies.infer_freq(index) != 'WOM-4TUE'

    def test_monthly(self):
        self._check_generated_range('1/1/2000', 'M')

    def test_monthly_ambiguous(self):
        rng = _dti(['1/31/2000', '2/29/2000', '3/31/2000'])
        assert rng.inferred_freq == 'M'

    def test_business_monthly(self):
        self._check_generated_range('1/1/2000', 'BM')

    def test_business_start_monthly(self):
        self._check_generated_range('1/1/2000', 'BMS')

    def test_quarterly(self):
        for month in ['JAN', 'FEB', 'MAR']:
            self._check_generated_range('1/1/2000', 'Q-%s' % month)

    def test_annual(self):
        for month in MONTHS:
            self._check_generated_range('1/1/2000', 'A-%s' % month)

    def test_business_annual(self):
        for month in MONTHS:
            self._check_generated_range('1/1/2000', 'BA-%s' % month)

    def test_annual_ambiguous(self):
        rng = _dti(['1/31/2000', '1/31/2001', '1/31/2002'])
        assert rng.inferred_freq == 'A-JAN'

    def _check_generated_range(self, start, freq):
        freq = freq.upper()

        gen = date_range(start, periods=7, freq=freq)
        index = _dti(gen.values)
        if not freq.startswith('Q-'):
            assert frequencies.infer_freq(index) == gen.freqstr
        else:
            inf_freq = frequencies.infer_freq(index)
            is_dec_range = inf_freq == 'Q-DEC' and gen.freqstr in (
                'Q', 'Q-DEC', 'Q-SEP', 'Q-JUN', 'Q-MAR')
            is_nov_range = inf_freq == 'Q-NOV' and gen.freqstr in (
                'Q-NOV', 'Q-AUG', 'Q-MAY', 'Q-FEB')
            is_oct_range = inf_freq == 'Q-OCT' and gen.freqstr in (
                'Q-OCT', 'Q-JUL', 'Q-APR', 'Q-JAN')
            assert is_dec_range or is_nov_range or is_oct_range

        gen = date_range(start, periods=5, freq=freq)
        index = _dti(gen.values)

        if not freq.startswith('Q-'):
            assert frequencies.infer_freq(index) == gen.freqstr
        else:
            inf_freq = frequencies.infer_freq(index)
            is_dec_range = inf_freq == 'Q-DEC' and gen.freqstr in (
                'Q', 'Q-DEC', 'Q-SEP', 'Q-JUN', 'Q-MAR')
            is_nov_range = inf_freq == 'Q-NOV' and gen.freqstr in (
                'Q-NOV', 'Q-AUG', 'Q-MAY', 'Q-FEB')
            is_oct_range = inf_freq == 'Q-OCT' and gen.freqstr in (
                'Q-OCT', 'Q-JUL', 'Q-APR', 'Q-JAN')

            assert is_dec_range or is_nov_range or is_oct_range

    def test_infer_freq(self):
        rng = period_range('1959Q2', '2009Q3', freq='Q')
        rng = Index(rng.to_timestamp('D', how='e').asobject)
        assert rng.inferred_freq == 'Q-DEC'

        rng = period_range('1959Q2', '2009Q3', freq='Q-NOV')
        rng = Index(rng.to_timestamp('D', how='e').asobject)
        assert rng.inferred_freq == 'Q-NOV'

        rng = period_range('1959Q2', '2009Q3', freq='Q-OCT')
        rng = Index(rng.to_timestamp('D', how='e').asobject)
        assert rng.inferred_freq == 'Q-OCT'

    def test_infer_freq_tz(self):

        freqs = {'AS-JAN':
                 ['2009-01-01', '2010-01-01', '2011-01-01', '2012-01-01'],
                 'Q-OCT':
                 ['2009-01-31', '2009-04-30', '2009-07-31', '2009-10-31'],
                 'M': ['2010-11-30', '2010-12-31', '2011-01-31', '2011-02-28'],
                 'W-SAT':
                 ['2010-12-25', '2011-01-01', '2011-01-08', '2011-01-15'],
                 'D': ['2011-01-01', '2011-01-02', '2011-01-03', '2011-01-04'],
                 'H': ['2011-12-31 22:00', '2011-12-31 23:00',
                       '2012-01-01 00:00', '2012-01-01 01:00']}

        # GH 7310
        for tz in [None, 'Australia/Sydney', 'Asia/Tokyo', 'Europe/Paris',
                   'US/Pacific', 'US/Eastern']:
            for expected, dates in compat.iteritems(freqs):
                idx = DatetimeIndex(dates, tz=tz)
                assert idx.inferred_freq == expected

    def test_infer_freq_tz_transition(self):
        # Tests for #8772
        date_pairs = [['2013-11-02', '2013-11-5'],  # Fall DST
                      ['2014-03-08', '2014-03-11'],  # Spring DST
                      ['2014-01-01', '2014-01-03']]  # Regular Time
        freqs = ['3H', '10T', '3601S', '3600001L', '3600000001U',
                 '3600000000001N']

        for tz in [None, 'Australia/Sydney', 'Asia/Tokyo', 'Europe/Paris',
                   'US/Pacific', 'US/Eastern']:
            for date_pair in date_pairs:
                for freq in freqs:
                    idx = date_range(date_pair[0], date_pair[
                        1], freq=freq, tz=tz)
                    assert idx.inferred_freq == freq

        index = date_range("2013-11-03", periods=5,
                           freq="3H").tz_localize("America/Chicago")
        assert index.inferred_freq is None

    def test_infer_freq_businesshour(self):
        # GH 7905
        idx = DatetimeIndex(
            ['2014-07-01 09:00', '2014-07-01 10:00', '2014-07-01 11:00',
             '2014-07-01 12:00', '2014-07-01 13:00', '2014-07-01 14:00'])
        # hourly freq in a day must result in 'H'
        assert idx.inferred_freq == 'H'

        idx = DatetimeIndex(
            ['2014-07-01 09:00', '2014-07-01 10:00', '2014-07-01 11:00',
             '2014-07-01 12:00', '2014-07-01 13:00', '2014-07-01 14:00',
             '2014-07-01 15:00', '2014-07-01 16:00', '2014-07-02 09:00',
             '2014-07-02 10:00', '2014-07-02 11:00'])
        assert idx.inferred_freq == 'BH'

        idx = DatetimeIndex(
            ['2014-07-04 09:00', '2014-07-04 10:00', '2014-07-04 11:00',
             '2014-07-04 12:00', '2014-07-04 13:00', '2014-07-04 14:00',
             '2014-07-04 15:00', '2014-07-04 16:00', '2014-07-07 09:00',
             '2014-07-07 10:00', '2014-07-07 11:00'])
        assert idx.inferred_freq == 'BH'

        idx = DatetimeIndex(
            ['2014-07-04 09:00', '2014-07-04 10:00', '2014-07-04 11:00',
             '2014-07-04 12:00', '2014-07-04 13:00', '2014-07-04 14:00',
             '2014-07-04 15:00', '2014-07-04 16:00', '2014-07-07 09:00',
             '2014-07-07 10:00', '2014-07-07 11:00', '2014-07-07 12:00',
             '2014-07-07 13:00', '2014-07-07 14:00', '2014-07-07 15:00',
             '2014-07-07 16:00', '2014-07-08 09:00', '2014-07-08 10:00',
             '2014-07-08 11:00', '2014-07-08 12:00', '2014-07-08 13:00',
             '2014-07-08 14:00', '2014-07-08 15:00', '2014-07-08 16:00'])
        assert idx.inferred_freq == 'BH'

    def test_not_monotonic(self):
        rng = _dti(['1/31/2000', '1/31/2001', '1/31/2002'])
        rng = rng[::-1]
        assert rng.inferred_freq == '-1A-JAN'

    def test_non_datetimeindex2(self):
        rng = _dti(['1/31/2000', '1/31/2001', '1/31/2002'])

        vals = rng.to_pydatetime()

        result = frequencies.infer_freq(vals)
        assert result == rng.inferred_freq

    def test_invalid_index_types(self):

        # test all index types
        for i in [tm.makeIntIndex(10), tm.makeFloatIndex(10),
                  tm.makePeriodIndex(10)]:
            pytest.raises(TypeError, lambda: frequencies.infer_freq(i))

        # GH 10822
        # odd error message on conversions to datetime for unicode
        if not is_platform_windows():
            for i in [tm.makeStringIndex(10), tm.makeUnicodeIndex(10)]:
                pytest.raises(ValueError, lambda: frequencies.infer_freq(i))

    def test_string_datetimelike_compat(self):

        # GH 6463
        expected = frequencies.infer_freq(['2004-01', '2004-02', '2004-03',
                                           '2004-04'])
        result = frequencies.infer_freq(Index(['2004-01', '2004-02', '2004-03',
                                               '2004-04']))
        assert result == expected

    def test_series(self):

        # GH6407
        # inferring series

        # invalid type of Series
        for s in [Series(np.arange(10)), Series(np.arange(10.))]:
            pytest.raises(TypeError, lambda: frequencies.infer_freq(s))

        # a non-convertible string
        pytest.raises(ValueError, lambda: frequencies.infer_freq(
            Series(['foo', 'bar'])))

        # cannot infer on PeriodIndex
        for freq in [None, 'L']:
            s = Series(period_range('2013', periods=10, freq=freq))
            pytest.raises(TypeError, lambda: frequencies.infer_freq(s))
        for freq in ['Y']:

            msg = frequencies._INVALID_FREQ_ERROR
            with tm.assert_raises_regex(ValueError, msg):
                s = Series(period_range('2013', periods=10, freq=freq))
            pytest.raises(TypeError, lambda: frequencies.infer_freq(s))

        # DateTimeIndex
        for freq in ['M', 'L', 'S']:
            s = Series(date_range('20130101', periods=10, freq=freq))
            inferred = frequencies.infer_freq(s)
            assert inferred == freq

        s = Series(date_range('20130101', '20130110'))
        inferred = frequencies.infer_freq(s)
        assert inferred == 'D'

    def test_legacy_offset_warnings(self):
        freqs = ['WEEKDAY', 'EOM', 'W@MON', 'W@TUE', 'W@WED', 'W@THU',
                 'W@FRI', 'W@SAT', 'W@SUN', 'Q@JAN', 'Q@FEB', 'Q@MAR',
                 'A@JAN', 'A@FEB', 'A@MAR', 'A@APR', 'A@MAY', 'A@JUN',
                 'A@JUL', 'A@AUG', 'A@SEP', 'A@OCT', 'A@NOV', 'A@DEC',
                 'WOM@1MON', 'WOM@2MON', 'WOM@3MON', 'WOM@4MON',
                 'WOM@1TUE', 'WOM@2TUE', 'WOM@3TUE', 'WOM@4TUE',
                 'WOM@1WED', 'WOM@2WED', 'WOM@3WED', 'WOM@4WED',
                 'WOM@1THU', 'WOM@2THU', 'WOM@3THU', 'WOM@4THU'
                 'WOM@1FRI', 'WOM@2FRI', 'WOM@3FRI', 'WOM@4FRI']

        msg = frequencies._INVALID_FREQ_ERROR
        for freq in freqs:
            with tm.assert_raises_regex(ValueError, msg):
                frequencies.get_offset(freq)

            with tm.assert_raises_regex(ValueError, msg):
                date_range('2011-01-01', periods=5, freq=freq)


MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT',
          'NOV', 'DEC']


def test_is_superperiod_subperiod():

    # input validation
    assert not (frequencies.is_superperiod(offsets.YearEnd(), None))
    assert not (frequencies.is_subperiod(offsets.MonthEnd(), None))
    assert not (frequencies.is_superperiod(None, offsets.YearEnd()))
    assert not (frequencies.is_subperiod(None, offsets.MonthEnd()))
    assert not (frequencies.is_superperiod(None, None))
    assert not (frequencies.is_subperiod(None, None))

    assert (frequencies.is_superperiod(offsets.YearEnd(), offsets.MonthEnd()))
    assert (frequencies.is_subperiod(offsets.MonthEnd(), offsets.YearEnd()))

    assert (frequencies.is_superperiod(offsets.Hour(), offsets.Minute()))
    assert (frequencies.is_subperiod(offsets.Minute(), offsets.Hour()))

    assert (frequencies.is_superperiod(offsets.Second(), offsets.Milli()))
    assert (frequencies.is_subperiod(offsets.Milli(), offsets.Second()))

    assert (frequencies.is_superperiod(offsets.Milli(), offsets.Micro()))
    assert (frequencies.is_subperiod(offsets.Micro(), offsets.Milli()))

    assert (frequencies.is_superperiod(offsets.Micro(), offsets.Nano()))
    assert (frequencies.is_subperiod(offsets.Nano(), offsets.Micro()))
