""" test the scalar Timestamp """

import sys
import pytest
import operator
import calendar
import numpy as np
from datetime import datetime, timedelta
from distutils.version import LooseVersion

import pandas.util.testing as tm
from pandas.tseries import offsets, frequencies
from pandas._libs import tslib, period
from pandas._libs.tslib import get_timezone

from pandas.compat import lrange, long
from pandas.util.testing import assert_series_equal
from pandas.compat.numpy import np_datetime64_compat
from pandas import (Timestamp, date_range, Period, Timedelta, compat,
                    Series, NaT, DataFrame, DatetimeIndex)
from pandas.tseries.frequencies import (RESO_DAY, RESO_HR, RESO_MIN, RESO_US,
                                        RESO_MS, RESO_SEC)


class TestTimestamp(object):

    def test_constructor(self):
        base_str = '2014-07-01 09:00'
        base_dt = datetime(2014, 7, 1, 9)
        base_expected = 1404205200000000000

        # confirm base representation is correct
        import calendar
        assert (calendar.timegm(base_dt.timetuple()) * 1000000000 ==
                base_expected)

        tests = [(base_str, base_dt, base_expected),
                 ('2014-07-01 10:00', datetime(2014, 7, 1, 10),
                  base_expected + 3600 * 1000000000),
                 ('2014-07-01 09:00:00.000008000',
                  datetime(2014, 7, 1, 9, 0, 0, 8),
                  base_expected + 8000),
                 ('2014-07-01 09:00:00.000000005',
                  Timestamp('2014-07-01 09:00:00.000000005'),
                  base_expected + 5)]

        tm._skip_if_no_pytz()
        tm._skip_if_no_dateutil()
        import pytz
        import dateutil
        timezones = [(None, 0), ('UTC', 0), (pytz.utc, 0), ('Asia/Tokyo', 9),
                     ('US/Eastern', -4), ('dateutil/US/Pacific', -7),
                     (pytz.FixedOffset(-180), -3),
                     (dateutil.tz.tzoffset(None, 18000), 5)]

        for date_str, date, expected in tests:
            for result in [Timestamp(date_str), Timestamp(date)]:
                # only with timestring
                assert result.value == expected
                assert tslib.pydt_to_i8(result) == expected

                # re-creation shouldn't affect to internal value
                result = Timestamp(result)
                assert result.value == expected
                assert tslib.pydt_to_i8(result) == expected

            # with timezone
            for tz, offset in timezones:
                for result in [Timestamp(date_str, tz=tz), Timestamp(date,
                                                                     tz=tz)]:
                    expected_tz = expected - offset * 3600 * 1000000000
                    assert result.value == expected_tz
                    assert tslib.pydt_to_i8(result) == expected_tz

                    # should preserve tz
                    result = Timestamp(result)
                    assert result.value == expected_tz
                    assert tslib.pydt_to_i8(result) == expected_tz

                    # should convert to UTC
                    result = Timestamp(result, tz='UTC')
                    expected_utc = expected - offset * 3600 * 1000000000
                    assert result.value == expected_utc
                    assert tslib.pydt_to_i8(result) == expected_utc

    def test_constructor_with_stringoffset(self):
        # GH 7833
        base_str = '2014-07-01 11:00:00+02:00'
        base_dt = datetime(2014, 7, 1, 9)
        base_expected = 1404205200000000000

        # confirm base representation is correct
        import calendar
        assert (calendar.timegm(base_dt.timetuple()) * 1000000000 ==
                base_expected)

        tests = [(base_str, base_expected),
                 ('2014-07-01 12:00:00+02:00',
                  base_expected + 3600 * 1000000000),
                 ('2014-07-01 11:00:00.000008000+02:00', base_expected + 8000),
                 ('2014-07-01 11:00:00.000000005+02:00', base_expected + 5)]

        tm._skip_if_no_pytz()
        tm._skip_if_no_dateutil()
        import pytz
        import dateutil
        timezones = [(None, 0), ('UTC', 0), (pytz.utc, 0), ('Asia/Tokyo', 9),
                     ('US/Eastern', -4), ('dateutil/US/Pacific', -7),
                     (pytz.FixedOffset(-180), -3),
                     (dateutil.tz.tzoffset(None, 18000), 5)]

        for date_str, expected in tests:
            for result in [Timestamp(date_str)]:
                # only with timestring
                assert result.value == expected
                assert tslib.pydt_to_i8(result) == expected

                # re-creation shouldn't affect to internal value
                result = Timestamp(result)
                assert result.value == expected
                assert tslib.pydt_to_i8(result) == expected

            # with timezone
            for tz, offset in timezones:
                result = Timestamp(date_str, tz=tz)
                expected_tz = expected
                assert result.value == expected_tz
                assert tslib.pydt_to_i8(result) == expected_tz

                # should preserve tz
                result = Timestamp(result)
                assert result.value == expected_tz
                assert tslib.pydt_to_i8(result) == expected_tz

                # should convert to UTC
                result = Timestamp(result, tz='UTC')
                expected_utc = expected
                assert result.value == expected_utc
                assert tslib.pydt_to_i8(result) == expected_utc

        # This should be 2013-11-01 05:00 in UTC
        # converted to Chicago tz
        result = Timestamp('2013-11-01 00:00:00-0500', tz='America/Chicago')
        assert result.value == Timestamp('2013-11-01 05:00').value
        expected = "Timestamp('2013-11-01 00:00:00-0500', tz='America/Chicago')"  # noqa
        assert repr(result) == expected
        assert result == eval(repr(result))

        # This should be 2013-11-01 05:00 in UTC
        # converted to Tokyo tz (+09:00)
        result = Timestamp('2013-11-01 00:00:00-0500', tz='Asia/Tokyo')
        assert result.value == Timestamp('2013-11-01 05:00').value
        expected = "Timestamp('2013-11-01 14:00:00+0900', tz='Asia/Tokyo')"
        assert repr(result) == expected
        assert result == eval(repr(result))

        # GH11708
        # This should be 2015-11-18 10:00 in UTC
        # converted to Asia/Katmandu
        result = Timestamp("2015-11-18 15:45:00+05:45", tz="Asia/Katmandu")
        assert result.value == Timestamp("2015-11-18 10:00").value
        expected = "Timestamp('2015-11-18 15:45:00+0545', tz='Asia/Katmandu')"
        assert repr(result) == expected
        assert result == eval(repr(result))

        # This should be 2015-11-18 10:00 in UTC
        # converted to Asia/Kolkata
        result = Timestamp("2015-11-18 15:30:00+05:30", tz="Asia/Kolkata")
        assert result.value == Timestamp("2015-11-18 10:00").value
        expected = "Timestamp('2015-11-18 15:30:00+0530', tz='Asia/Kolkata')"
        assert repr(result) == expected
        assert result == eval(repr(result))

    def test_constructor_invalid(self):
        with tm.assert_raises_regex(TypeError, 'Cannot convert input'):
            Timestamp(slice(2))
        with tm.assert_raises_regex(ValueError, 'Cannot convert Period'):
            Timestamp(Period('1000-01-01'))

    def test_constructor_positional(self):
        # see gh-10758
        with pytest.raises(TypeError):
            Timestamp(2000, 1)
        with pytest.raises(ValueError):
            Timestamp(2000, 0, 1)
        with pytest.raises(ValueError):
            Timestamp(2000, 13, 1)
        with pytest.raises(ValueError):
            Timestamp(2000, 1, 0)
        with pytest.raises(ValueError):
            Timestamp(2000, 1, 32)

        # see gh-11630
        assert (repr(Timestamp(2015, 11, 12)) ==
                repr(Timestamp('20151112')))
        assert (repr(Timestamp(2015, 11, 12, 1, 2, 3, 999999)) ==
                repr(Timestamp('2015-11-12 01:02:03.999999')))

    def test_constructor_keyword(self):
        # GH 10758
        with pytest.raises(TypeError):
            Timestamp(year=2000, month=1)
        with pytest.raises(ValueError):
            Timestamp(year=2000, month=0, day=1)
        with pytest.raises(ValueError):
            Timestamp(year=2000, month=13, day=1)
        with pytest.raises(ValueError):
            Timestamp(year=2000, month=1, day=0)
        with pytest.raises(ValueError):
            Timestamp(year=2000, month=1, day=32)

        assert (repr(Timestamp(year=2015, month=11, day=12)) ==
                repr(Timestamp('20151112')))

        assert (repr(Timestamp(year=2015, month=11, day=12, hour=1, minute=2,
                               second=3, microsecond=999999)) ==
                repr(Timestamp('2015-11-12 01:02:03.999999')))

    def test_constructor_fromordinal(self):
        base = datetime(2000, 1, 1)

        ts = Timestamp.fromordinal(base.toordinal(), freq='D')
        assert base == ts
        assert ts.freq == 'D'
        assert base.toordinal() == ts.toordinal()

        ts = Timestamp.fromordinal(base.toordinal(), tz='US/Eastern')
        assert Timestamp('2000-01-01', tz='US/Eastern') == ts
        assert base.toordinal() == ts.toordinal()

    def test_constructor_offset_depr(self):
        # see gh-12160
        with tm.assert_produces_warning(FutureWarning,
                                        check_stacklevel=False):
            ts = Timestamp('2011-01-01', offset='D')
        assert ts.freq == 'D'

        with tm.assert_produces_warning(FutureWarning,
                                        check_stacklevel=False):
            assert ts.offset == 'D'

        msg = "Can only specify freq or offset, not both"
        with tm.assert_raises_regex(TypeError, msg):
            Timestamp('2011-01-01', offset='D', freq='D')

    def test_constructor_offset_depr_fromordinal(self):
        # GH 12160
        base = datetime(2000, 1, 1)

        with tm.assert_produces_warning(FutureWarning,
                                        check_stacklevel=False):
            ts = Timestamp.fromordinal(base.toordinal(), offset='D')
        assert Timestamp('2000-01-01') == ts
        assert ts.freq == 'D'
        assert base.toordinal() == ts.toordinal()

        msg = "Can only specify freq or offset, not both"
        with tm.assert_raises_regex(TypeError, msg):
            Timestamp.fromordinal(base.toordinal(), offset='D', freq='D')

    def test_conversion(self):
        # GH 9255
        ts = Timestamp('2000-01-01')

        result = ts.to_pydatetime()
        expected = datetime(2000, 1, 1)
        assert result == expected
        assert type(result) == type(expected)

        result = ts.to_datetime64()
        expected = np.datetime64(ts.value, 'ns')
        assert result == expected
        assert type(result) == type(expected)
        assert result.dtype == expected.dtype

    def test_repr(self):
        tm._skip_if_no_pytz()
        tm._skip_if_no_dateutil()

        dates = ['2014-03-07', '2014-01-01 09:00',
                 '2014-01-01 00:00:00.000000001']

        # dateutil zone change (only matters for repr)
        import dateutil
        if (dateutil.__version__ >= LooseVersion('2.3') and
            (dateutil.__version__ <= LooseVersion('2.4.0') or
             dateutil.__version__ >= LooseVersion('2.6.0'))):
            timezones = ['UTC', 'Asia/Tokyo', 'US/Eastern',
                         'dateutil/US/Pacific']
        else:
            timezones = ['UTC', 'Asia/Tokyo', 'US/Eastern',
                         'dateutil/America/Los_Angeles']

        freqs = ['D', 'M', 'S', 'N']

        for date in dates:
            for tz in timezones:
                for freq in freqs:

                    # avoid to match with timezone name
                    freq_repr = "'{0}'".format(freq)
                    if tz.startswith('dateutil'):
                        tz_repr = tz.replace('dateutil', '')
                    else:
                        tz_repr = tz

                    date_only = Timestamp(date)
                    assert date in repr(date_only)
                    assert tz_repr not in repr(date_only)
                    assert freq_repr not in repr(date_only)
                    assert date_only == eval(repr(date_only))

                    date_tz = Timestamp(date, tz=tz)
                    assert date in repr(date_tz)
                    assert tz_repr in repr(date_tz)
                    assert freq_repr not in repr(date_tz)
                    assert date_tz == eval(repr(date_tz))

                    date_freq = Timestamp(date, freq=freq)
                    assert date in repr(date_freq)
                    assert tz_repr not in repr(date_freq)
                    assert freq_repr in repr(date_freq)
                    assert date_freq == eval(repr(date_freq))

                    date_tz_freq = Timestamp(date, tz=tz, freq=freq)
                    assert date in repr(date_tz_freq)
                    assert tz_repr in repr(date_tz_freq)
                    assert freq_repr in repr(date_tz_freq)
                    assert date_tz_freq == eval(repr(date_tz_freq))

        # This can cause the tz field to be populated, but it's redundant to
        # include this information in the date-string.
        tm._skip_if_no_pytz()
        import pytz  # noqa
        date_with_utc_offset = Timestamp('2014-03-13 00:00:00-0400', tz=None)
        assert '2014-03-13 00:00:00-0400' in repr(date_with_utc_offset)
        assert 'tzoffset' not in repr(date_with_utc_offset)
        assert 'pytz.FixedOffset(-240)' in repr(date_with_utc_offset)
        expr = repr(date_with_utc_offset).replace("'pytz.FixedOffset(-240)'",
                                                  'pytz.FixedOffset(-240)')
        assert date_with_utc_offset == eval(expr)

    def test_bounds_with_different_units(self):
        out_of_bounds_dates = ('1677-09-21', '2262-04-12', )

        time_units = ('D', 'h', 'm', 's', 'ms', 'us')

        for date_string in out_of_bounds_dates:
            for unit in time_units:
                pytest.raises(ValueError, Timestamp, np.datetime64(
                    date_string, dtype='M8[%s]' % unit))

        in_bounds_dates = ('1677-09-23', '2262-04-11', )

        for date_string in in_bounds_dates:
            for unit in time_units:
                Timestamp(np.datetime64(date_string, dtype='M8[%s]' % unit))

    def test_tz(self):
        t = '2014-02-01 09:00'
        ts = Timestamp(t)
        local = ts.tz_localize('Asia/Tokyo')
        assert local.hour == 9
        assert local == Timestamp(t, tz='Asia/Tokyo')
        conv = local.tz_convert('US/Eastern')
        assert conv == Timestamp('2014-01-31 19:00', tz='US/Eastern')
        assert conv.hour == 19

        # preserves nanosecond
        ts = Timestamp(t) + offsets.Nano(5)
        local = ts.tz_localize('Asia/Tokyo')
        assert local.hour == 9
        assert local.nanosecond == 5
        conv = local.tz_convert('US/Eastern')
        assert conv.nanosecond == 5
        assert conv.hour == 19

    def test_tz_localize_ambiguous(self):

        ts = Timestamp('2014-11-02 01:00')
        ts_dst = ts.tz_localize('US/Eastern', ambiguous=True)
        ts_no_dst = ts.tz_localize('US/Eastern', ambiguous=False)

        rng = date_range('2014-11-02', periods=3, freq='H', tz='US/Eastern')
        assert rng[1] == ts_dst
        assert rng[2] == ts_no_dst
        pytest.raises(ValueError, ts.tz_localize, 'US/Eastern',
                      ambiguous='infer')

        # GH 8025
        with tm.assert_raises_regex(TypeError,
                                    'Cannot localize tz-aware Timestamp, '
                                    'use tz_convert for conversions'):
            Timestamp('2011-01-01', tz='US/Eastern').tz_localize('Asia/Tokyo')

        with tm.assert_raises_regex(TypeError,
                                    'Cannot convert tz-naive Timestamp, '
                                    'use tz_localize to localize'):
            Timestamp('2011-01-01').tz_convert('Asia/Tokyo')

    def test_tz_localize_nonexistent(self):
        # See issue 13057
        from pytz.exceptions import NonExistentTimeError
        times = ['2015-03-08 02:00', '2015-03-08 02:30',
                 '2015-03-29 02:00', '2015-03-29 02:30']
        timezones = ['US/Eastern', 'US/Pacific',
                     'Europe/Paris', 'Europe/Belgrade']
        for t, tz in zip(times, timezones):
            ts = Timestamp(t)
            pytest.raises(NonExistentTimeError, ts.tz_localize,
                          tz)
            pytest.raises(NonExistentTimeError, ts.tz_localize,
                          tz, errors='raise')
            assert ts.tz_localize(tz, errors='coerce') is NaT

    def test_tz_localize_errors_ambiguous(self):
        # See issue 13057
        from pytz.exceptions import AmbiguousTimeError
        ts = Timestamp('2015-11-1 01:00')
        pytest.raises(AmbiguousTimeError,
                      ts.tz_localize, 'US/Pacific', errors='coerce')

    def test_tz_localize_roundtrip(self):
        for tz in ['UTC', 'Asia/Tokyo', 'US/Eastern', 'dateutil/US/Pacific']:
            for t in ['2014-02-01 09:00', '2014-07-08 09:00',
                      '2014-11-01 17:00', '2014-11-05 00:00']:
                ts = Timestamp(t)
                localized = ts.tz_localize(tz)
                assert localized == Timestamp(t, tz=tz)

                with pytest.raises(TypeError):
                    localized.tz_localize(tz)

                reset = localized.tz_localize(None)
                assert reset == ts
                assert reset.tzinfo is None

    def test_tz_convert_roundtrip(self):
        for tz in ['UTC', 'Asia/Tokyo', 'US/Eastern', 'dateutil/US/Pacific']:
            for t in ['2014-02-01 09:00', '2014-07-08 09:00',
                      '2014-11-01 17:00', '2014-11-05 00:00']:
                ts = Timestamp(t, tz='UTC')
                converted = ts.tz_convert(tz)

                reset = converted.tz_convert(None)
                assert reset == Timestamp(t)
                assert reset.tzinfo is None
                assert reset == converted.tz_convert('UTC').tz_localize(None)

    def test_barely_oob_dts(self):
        one_us = np.timedelta64(1).astype('timedelta64[us]')

        # By definition we can't go out of bounds in [ns], so we
        # convert the datetime64s to [us] so we can go out of bounds
        min_ts_us = np.datetime64(Timestamp.min).astype('M8[us]')
        max_ts_us = np.datetime64(Timestamp.max).astype('M8[us]')

        # No error for the min/max datetimes
        Timestamp(min_ts_us)
        Timestamp(max_ts_us)

        # One us less than the minimum is an error
        pytest.raises(ValueError, Timestamp, min_ts_us - one_us)

        # One us more than the maximum is an error
        pytest.raises(ValueError, Timestamp, max_ts_us + one_us)

    def test_utc_z_designator(self):
        assert get_timezone(Timestamp('2014-11-02 01:00Z').tzinfo) == 'UTC'

    def test_now(self):
        # #9000
        ts_from_string = Timestamp('now')
        ts_from_method = Timestamp.now()
        ts_datetime = datetime.now()

        ts_from_string_tz = Timestamp('now', tz='US/Eastern')
        ts_from_method_tz = Timestamp.now(tz='US/Eastern')

        # Check that the delta between the times is less than 1s (arbitrarily
        # small)
        delta = Timedelta(seconds=1)
        assert abs(ts_from_method - ts_from_string) < delta
        assert abs(ts_datetime - ts_from_method) < delta
        assert abs(ts_from_method_tz - ts_from_string_tz) < delta
        assert (abs(ts_from_string_tz.tz_localize(None) -
                    ts_from_method_tz.tz_localize(None)) < delta)

    def test_today(self):

        ts_from_string = Timestamp('today')
        ts_from_method = Timestamp.today()
        ts_datetime = datetime.today()

        ts_from_string_tz = Timestamp('today', tz='US/Eastern')
        ts_from_method_tz = Timestamp.today(tz='US/Eastern')

        # Check that the delta between the times is less than 1s (arbitrarily
        # small)
        delta = Timedelta(seconds=1)
        assert abs(ts_from_method - ts_from_string) < delta
        assert abs(ts_datetime - ts_from_method) < delta
        assert abs(ts_from_method_tz - ts_from_string_tz) < delta
        assert (abs(ts_from_string_tz.tz_localize(None) -
                    ts_from_method_tz.tz_localize(None)) < delta)

    def test_asm8(self):
        np.random.seed(7960929)
        ns = [Timestamp.min.value, Timestamp.max.value, 1000]

        for n in ns:
            assert (Timestamp(n).asm8.view('i8') ==
                    np.datetime64(n, 'ns').view('i8') == n)

        assert (Timestamp('nat').asm8.view('i8') ==
                np.datetime64('nat', 'ns').view('i8'))

    def test_fields(self):
        def check(value, equal):
            # that we are int/long like
            assert isinstance(value, (int, compat.long))
            assert value == equal

        # GH 10050
        ts = Timestamp('2015-05-10 09:06:03.000100001')
        check(ts.year, 2015)
        check(ts.month, 5)
        check(ts.day, 10)
        check(ts.hour, 9)
        check(ts.minute, 6)
        check(ts.second, 3)
        pytest.raises(AttributeError, lambda: ts.millisecond)
        check(ts.microsecond, 100)
        check(ts.nanosecond, 1)
        check(ts.dayofweek, 6)
        check(ts.quarter, 2)
        check(ts.dayofyear, 130)
        check(ts.week, 19)
        check(ts.daysinmonth, 31)
        check(ts.daysinmonth, 31)

        # GH 13303
        ts = Timestamp('2014-12-31 23:59:00-05:00', tz='US/Eastern')
        check(ts.year, 2014)
        check(ts.month, 12)
        check(ts.day, 31)
        check(ts.hour, 23)
        check(ts.minute, 59)
        check(ts.second, 0)
        pytest.raises(AttributeError, lambda: ts.millisecond)
        check(ts.microsecond, 0)
        check(ts.nanosecond, 0)
        check(ts.dayofweek, 2)
        check(ts.quarter, 4)
        check(ts.dayofyear, 365)
        check(ts.week, 1)
        check(ts.daysinmonth, 31)

        ts = Timestamp('2014-01-01 00:00:00+01:00')
        starts = ['is_month_start', 'is_quarter_start', 'is_year_start']
        for start in starts:
            assert getattr(ts, start)
        ts = Timestamp('2014-12-31 23:59:59+01:00')
        ends = ['is_month_end', 'is_year_end', 'is_quarter_end']
        for end in ends:
            assert getattr(ts, end)

    def test_pprint(self):
        # GH12622
        import pprint
        nested_obj = {'foo': 1,
                      'bar': [{'w': {'a': Timestamp('2011-01-01')}}] * 10}
        result = pprint.pformat(nested_obj, width=50)
        expected = r"""{'bar': [{'w': {'a': Timestamp('2011-01-01 00:00:00')}},
         {'w': {'a': Timestamp('2011-01-01 00:00:00')}},
         {'w': {'a': Timestamp('2011-01-01 00:00:00')}},
         {'w': {'a': Timestamp('2011-01-01 00:00:00')}},
         {'w': {'a': Timestamp('2011-01-01 00:00:00')}},
         {'w': {'a': Timestamp('2011-01-01 00:00:00')}},
         {'w': {'a': Timestamp('2011-01-01 00:00:00')}},
         {'w': {'a': Timestamp('2011-01-01 00:00:00')}},
         {'w': {'a': Timestamp('2011-01-01 00:00:00')}},
         {'w': {'a': Timestamp('2011-01-01 00:00:00')}}],
 'foo': 1}"""
        assert result == expected

    def to_datetime_depr(self):
        # see gh-8254
        ts = Timestamp('2011-01-01')

        with tm.assert_produces_warning(FutureWarning,
                                        check_stacklevel=False):
            expected = datetime(2011, 1, 1)
            result = ts.to_datetime()
            assert result == expected

    def to_pydatetime_nonzero_nano(self):
        ts = Timestamp('2011-01-01 9:00:00.123456789')

        # Warn the user of data loss (nanoseconds).
        with tm.assert_produces_warning(UserWarning,
                                        check_stacklevel=False):
            expected = datetime(2011, 1, 1, 9, 0, 0, 123456)
            result = ts.to_pydatetime()
            assert result == expected

    def test_round(self):

        # round
        dt = Timestamp('20130101 09:10:11')
        result = dt.round('D')
        expected = Timestamp('20130101')
        assert result == expected

        dt = Timestamp('20130101 19:10:11')
        result = dt.round('D')
        expected = Timestamp('20130102')
        assert result == expected

        dt = Timestamp('20130201 12:00:00')
        result = dt.round('D')
        expected = Timestamp('20130202')
        assert result == expected

        dt = Timestamp('20130104 12:00:00')
        result = dt.round('D')
        expected = Timestamp('20130105')
        assert result == expected

        dt = Timestamp('20130104 12:32:00')
        result = dt.round('30Min')
        expected = Timestamp('20130104 12:30:00')
        assert result == expected

        dti = date_range('20130101 09:10:11', periods=5)
        result = dti.round('D')
        expected = date_range('20130101', periods=5)
        tm.assert_index_equal(result, expected)

        # floor
        dt = Timestamp('20130101 09:10:11')
        result = dt.floor('D')
        expected = Timestamp('20130101')
        assert result == expected

        # ceil
        dt = Timestamp('20130101 09:10:11')
        result = dt.ceil('D')
        expected = Timestamp('20130102')
        assert result == expected

        # round with tz
        dt = Timestamp('20130101 09:10:11', tz='US/Eastern')
        result = dt.round('D')
        expected = Timestamp('20130101', tz='US/Eastern')
        assert result == expected

        dt = Timestamp('20130101 09:10:11', tz='US/Eastern')
        result = dt.round('s')
        assert result == dt

        dti = date_range('20130101 09:10:11',
                         periods=5).tz_localize('UTC').tz_convert('US/Eastern')
        result = dti.round('D')
        expected = date_range('20130101', periods=5).tz_localize('US/Eastern')
        tm.assert_index_equal(result, expected)

        result = dti.round('s')
        tm.assert_index_equal(result, dti)

        # invalid
        for freq in ['Y', 'M', 'foobar']:
            pytest.raises(ValueError, lambda: dti.round(freq))

        # GH 14440 & 15578
        result = Timestamp('2016-10-17 12:00:00.0015').round('ms')
        expected = Timestamp('2016-10-17 12:00:00.002000')
        assert result == expected

        result = Timestamp('2016-10-17 12:00:00.00149').round('ms')
        expected = Timestamp('2016-10-17 12:00:00.001000')
        assert result == expected

        ts = Timestamp('2016-10-17 12:00:00.0015')
        for freq in ['us', 'ns']:
            assert ts == ts.round(freq)

        result = Timestamp('2016-10-17 12:00:00.001501031').round('10ns')
        expected = Timestamp('2016-10-17 12:00:00.001501030')
        assert result == expected

        with tm.assert_produces_warning():
            Timestamp('2016-10-17 12:00:00.001501031').round('1010ns')

    def test_round_misc(self):
        stamp = Timestamp('2000-01-05 05:09:15.13')

        def _check_round(freq, expected):
            result = stamp.round(freq=freq)
            assert result == expected

        for freq, expected in [('D', Timestamp('2000-01-05 00:00:00')),
                               ('H', Timestamp('2000-01-05 05:00:00')),
                               ('S', Timestamp('2000-01-05 05:09:15'))]:
            _check_round(freq, expected)

        msg = frequencies._INVALID_FREQ_ERROR
        with tm.assert_raises_regex(ValueError, msg):
            stamp.round('foo')

    def test_class_ops_pytz(self):
        tm._skip_if_no_pytz()
        from pytz import timezone

        def compare(x, y):
            assert (int(Timestamp(x).value / 1e9) ==
                    int(Timestamp(y).value / 1e9))

        compare(Timestamp.now(), datetime.now())
        compare(Timestamp.now('UTC'), datetime.now(timezone('UTC')))
        compare(Timestamp.utcnow(), datetime.utcnow())
        compare(Timestamp.today(), datetime.today())
        current_time = calendar.timegm(datetime.now().utctimetuple())
        compare(Timestamp.utcfromtimestamp(current_time),
                datetime.utcfromtimestamp(current_time))
        compare(Timestamp.fromtimestamp(current_time),
                datetime.fromtimestamp(current_time))

        date_component = datetime.utcnow()
        time_component = (date_component + timedelta(minutes=10)).time()
        compare(Timestamp.combine(date_component, time_component),
                datetime.combine(date_component, time_component))

    def test_class_ops_dateutil(self):
        tm._skip_if_no_dateutil()
        from dateutil.tz import tzutc

        def compare(x, y):
            assert (int(np.round(Timestamp(x).value / 1e9)) ==
                    int(np.round(Timestamp(y).value / 1e9)))

        compare(Timestamp.now(), datetime.now())
        compare(Timestamp.now('UTC'), datetime.now(tzutc()))
        compare(Timestamp.utcnow(), datetime.utcnow())
        compare(Timestamp.today(), datetime.today())
        current_time = calendar.timegm(datetime.now().utctimetuple())
        compare(Timestamp.utcfromtimestamp(current_time),
                datetime.utcfromtimestamp(current_time))
        compare(Timestamp.fromtimestamp(current_time),
                datetime.fromtimestamp(current_time))

        date_component = datetime.utcnow()
        time_component = (date_component + timedelta(minutes=10)).time()
        compare(Timestamp.combine(date_component, time_component),
                datetime.combine(date_component, time_component))

    def test_basics_nanos(self):
        val = np.int64(946684800000000000).view('M8[ns]')
        stamp = Timestamp(val.view('i8') + 500)
        assert stamp.year == 2000
        assert stamp.month == 1
        assert stamp.microsecond == 0
        assert stamp.nanosecond == 500

        # GH 14415
        val = np.iinfo(np.int64).min + 80000000000000
        stamp = Timestamp(val)
        assert stamp.year == 1677
        assert stamp.month == 9
        assert stamp.day == 21
        assert stamp.microsecond == 145224
        assert stamp.nanosecond == 192

    def test_unit(self):

        def check(val, unit=None, h=1, s=1, us=0):
            stamp = Timestamp(val, unit=unit)
            assert stamp.year == 2000
            assert stamp.month == 1
            assert stamp.day == 1
            assert stamp.hour == h
            if unit != 'D':
                assert stamp.minute == 1
                assert stamp.second == s
                assert stamp.microsecond == us
            else:
                assert stamp.minute == 0
                assert stamp.second == 0
                assert stamp.microsecond == 0
            assert stamp.nanosecond == 0

        ts = Timestamp('20000101 01:01:01')
        val = ts.value
        days = (ts - Timestamp('1970-01-01')).days

        check(val)
        check(val / long(1000), unit='us')
        check(val / long(1000000), unit='ms')
        check(val / long(1000000000), unit='s')
        check(days, unit='D', h=0)

        # using truediv, so these are like floats
        if compat.PY3:
            check((val + 500000) / long(1000000000), unit='s', us=500)
            check((val + 500000000) / long(1000000000), unit='s', us=500000)
            check((val + 500000) / long(1000000), unit='ms', us=500)

        # get chopped in py2
        else:
            check((val + 500000) / long(1000000000), unit='s')
            check((val + 500000000) / long(1000000000), unit='s')
            check((val + 500000) / long(1000000), unit='ms')

        # ok
        check((val + 500000) / long(1000), unit='us', us=500)
        check((val + 500000000) / long(1000000), unit='ms', us=500000)

        # floats
        check(val / 1000.0 + 5, unit='us', us=5)
        check(val / 1000.0 + 5000, unit='us', us=5000)
        check(val / 1000000.0 + 0.5, unit='ms', us=500)
        check(val / 1000000.0 + 0.005, unit='ms', us=5)
        check(val / 1000000000.0 + 0.5, unit='s', us=500000)
        check(days + 0.5, unit='D', h=12)

    def test_roundtrip(self):

        # test value to string and back conversions
        # further test accessors
        base = Timestamp('20140101 00:00:00')

        result = Timestamp(base.value + Timedelta('5ms').value)
        assert result == Timestamp(str(base) + ".005000")
        assert result.microsecond == 5000

        result = Timestamp(base.value + Timedelta('5us').value)
        assert result == Timestamp(str(base) + ".000005")
        assert result.microsecond == 5

        result = Timestamp(base.value + Timedelta('5ns').value)
        assert result == Timestamp(str(base) + ".000000005")
        assert result.nanosecond == 5
        assert result.microsecond == 0

        result = Timestamp(base.value + Timedelta('6ms 5us').value)
        assert result == Timestamp(str(base) + ".006005")
        assert result.microsecond == 5 + 6 * 1000

        result = Timestamp(base.value + Timedelta('200ms 5us').value)
        assert result == Timestamp(str(base) + ".200005")
        assert result.microsecond == 5 + 200 * 1000

    def test_comparison(self):
        # 5-18-2012 00:00:00.000
        stamp = long(1337299200000000000)

        val = Timestamp(stamp)

        assert val == val
        assert not val != val
        assert not val < val
        assert val <= val
        assert not val > val
        assert val >= val

        other = datetime(2012, 5, 18)
        assert val == other
        assert not val != other
        assert not val < other
        assert val <= other
        assert not val > other
        assert val >= other

        other = Timestamp(stamp + 100)

        assert val != other
        assert val != other
        assert val < other
        assert val <= other
        assert other > val
        assert other >= val

    def test_compare_invalid(self):

        # GH 8058
        val = Timestamp('20130101 12:01:02')
        assert not val == 'foo'
        assert not val == 10.0
        assert not val == 1
        assert not val == long(1)
        assert not val == []
        assert not val == {'foo': 1}
        assert not val == np.float64(1)
        assert not val == np.int64(1)

        assert val != 'foo'
        assert val != 10.0
        assert val != 1
        assert val != long(1)
        assert val != []
        assert val != {'foo': 1}
        assert val != np.float64(1)
        assert val != np.int64(1)

        # ops testing
        df = DataFrame(np.random.randn(5, 2))
        a = df[0]
        b = Series(np.random.randn(5))
        b.name = Timestamp('2000-01-01')
        tm.assert_series_equal(a / b, 1 / (b / a))

    def test_cant_compare_tz_naive_w_aware(self):
        tm._skip_if_no_pytz()
        # #1404
        a = Timestamp('3/12/2012')
        b = Timestamp('3/12/2012', tz='utc')

        pytest.raises(Exception, a.__eq__, b)
        pytest.raises(Exception, a.__ne__, b)
        pytest.raises(Exception, a.__lt__, b)
        pytest.raises(Exception, a.__gt__, b)
        pytest.raises(Exception, b.__eq__, a)
        pytest.raises(Exception, b.__ne__, a)
        pytest.raises(Exception, b.__lt__, a)
        pytest.raises(Exception, b.__gt__, a)

        if sys.version_info < (3, 3):
            pytest.raises(Exception, a.__eq__, b.to_pydatetime())
            pytest.raises(Exception, a.to_pydatetime().__eq__, b)
        else:
            assert not a == b.to_pydatetime()
            assert not a.to_pydatetime() == b

    def test_cant_compare_tz_naive_w_aware_explicit_pytz(self):
        tm._skip_if_no_pytz()
        from pytz import utc
        # #1404
        a = Timestamp('3/12/2012')
        b = Timestamp('3/12/2012', tz=utc)

        pytest.raises(Exception, a.__eq__, b)
        pytest.raises(Exception, a.__ne__, b)
        pytest.raises(Exception, a.__lt__, b)
        pytest.raises(Exception, a.__gt__, b)
        pytest.raises(Exception, b.__eq__, a)
        pytest.raises(Exception, b.__ne__, a)
        pytest.raises(Exception, b.__lt__, a)
        pytest.raises(Exception, b.__gt__, a)

        if sys.version_info < (3, 3):
            pytest.raises(Exception, a.__eq__, b.to_pydatetime())
            pytest.raises(Exception, a.to_pydatetime().__eq__, b)
        else:
            assert not a == b.to_pydatetime()
            assert not a.to_pydatetime() == b

    def test_cant_compare_tz_naive_w_aware_dateutil(self):
        tm._skip_if_no_dateutil()
        from dateutil.tz import tzutc
        utc = tzutc()
        # #1404
        a = Timestamp('3/12/2012')
        b = Timestamp('3/12/2012', tz=utc)

        pytest.raises(Exception, a.__eq__, b)
        pytest.raises(Exception, a.__ne__, b)
        pytest.raises(Exception, a.__lt__, b)
        pytest.raises(Exception, a.__gt__, b)
        pytest.raises(Exception, b.__eq__, a)
        pytest.raises(Exception, b.__ne__, a)
        pytest.raises(Exception, b.__lt__, a)
        pytest.raises(Exception, b.__gt__, a)

        if sys.version_info < (3, 3):
            pytest.raises(Exception, a.__eq__, b.to_pydatetime())
            pytest.raises(Exception, a.to_pydatetime().__eq__, b)
        else:
            assert not a == b.to_pydatetime()
            assert not a.to_pydatetime() == b

    def test_delta_preserve_nanos(self):
        val = Timestamp(long(1337299200000000123))
        result = val + timedelta(1)
        assert result.nanosecond == val.nanosecond

    def test_frequency_misc(self):
        assert (frequencies.get_freq_group('T') ==
                frequencies.FreqGroup.FR_MIN)

        code, stride = frequencies.get_freq_code(offsets.Hour())
        assert code == frequencies.FreqGroup.FR_HR

        code, stride = frequencies.get_freq_code((5, 'T'))
        assert code == frequencies.FreqGroup.FR_MIN
        assert stride == 5

        offset = offsets.Hour()
        result = frequencies.to_offset(offset)
        assert result == offset

        result = frequencies.to_offset((5, 'T'))
        expected = offsets.Minute(5)
        assert result == expected

        pytest.raises(ValueError, frequencies.get_freq_code, (5, 'baz'))

        pytest.raises(ValueError, frequencies.to_offset, '100foo')

        pytest.raises(ValueError, frequencies.to_offset, ('', ''))

        with tm.assert_produces_warning(FutureWarning, check_stacklevel=False):
            result = frequencies.get_standard_freq(offsets.Hour())
        assert result == 'H'

    def test_hash_equivalent(self):
        d = {datetime(2011, 1, 1): 5}
        stamp = Timestamp(datetime(2011, 1, 1))
        assert d[stamp] == 5

    def test_timestamp_compare_scalars(self):
        # case where ndim == 0
        lhs = np.datetime64(datetime(2013, 12, 6))
        rhs = Timestamp('now')
        nat = Timestamp('nat')

        ops = {'gt': 'lt',
               'lt': 'gt',
               'ge': 'le',
               'le': 'ge',
               'eq': 'eq',
               'ne': 'ne'}

        for left, right in ops.items():
            left_f = getattr(operator, left)
            right_f = getattr(operator, right)
            expected = left_f(lhs, rhs)

            result = right_f(rhs, lhs)
            assert result == expected

            expected = left_f(rhs, nat)
            result = right_f(nat, rhs)
            assert result == expected

    def test_timestamp_compare_series(self):
        # make sure we can compare Timestamps on the right AND left hand side
        # GH4982
        s = Series(date_range('20010101', periods=10), name='dates')
        s_nat = s.copy(deep=True)

        s[0] = Timestamp('nat')
        s[3] = Timestamp('nat')

        ops = {'lt': 'gt', 'le': 'ge', 'eq': 'eq', 'ne': 'ne'}

        for left, right in ops.items():
            left_f = getattr(operator, left)
            right_f = getattr(operator, right)

            # no nats
            expected = left_f(s, Timestamp('20010109'))
            result = right_f(Timestamp('20010109'), s)
            tm.assert_series_equal(result, expected)

            # nats
            expected = left_f(s, Timestamp('nat'))
            result = right_f(Timestamp('nat'), s)
            tm.assert_series_equal(result, expected)

            # compare to timestamp with series containing nats
            expected = left_f(s_nat, Timestamp('20010109'))
            result = right_f(Timestamp('20010109'), s_nat)
            tm.assert_series_equal(result, expected)

            # compare to nat with series containing nats
            expected = left_f(s_nat, Timestamp('nat'))
            result = right_f(Timestamp('nat'), s_nat)
            tm.assert_series_equal(result, expected)

    def test_is_leap_year(self):
        # GH 13727
        for tz in [None, 'UTC', 'US/Eastern', 'Asia/Tokyo']:
            dt = Timestamp('2000-01-01 00:00:00', tz=tz)
            assert dt.is_leap_year
            assert isinstance(dt.is_leap_year, bool)

            dt = Timestamp('1999-01-01 00:00:00', tz=tz)
            assert not dt.is_leap_year

            dt = Timestamp('2004-01-01 00:00:00', tz=tz)
            assert dt.is_leap_year

            dt = Timestamp('2100-01-01 00:00:00', tz=tz)
            assert not dt.is_leap_year


class TestTimestampNsOperations(object):

    def setup_method(self, method):
        self.timestamp = Timestamp(datetime.utcnow())

    def assert_ns_timedelta(self, modified_timestamp, expected_value):
        value = self.timestamp.value
        modified_value = modified_timestamp.value

        assert modified_value - value == expected_value

    def test_timedelta_ns_arithmetic(self):
        self.assert_ns_timedelta(self.timestamp + np.timedelta64(-123, 'ns'),
                                 -123)

    def test_timedelta_ns_based_arithmetic(self):
        self.assert_ns_timedelta(self.timestamp + np.timedelta64(
            1234567898, 'ns'), 1234567898)

    def test_timedelta_us_arithmetic(self):
        self.assert_ns_timedelta(self.timestamp + np.timedelta64(-123, 'us'),
                                 -123000)

    def test_timedelta_ms_arithmetic(self):
        time = self.timestamp + np.timedelta64(-123, 'ms')
        self.assert_ns_timedelta(time, -123000000)

    def test_nanosecond_string_parsing(self):
        ts = Timestamp('2013-05-01 07:15:45.123456789')
        # GH 7878
        expected_repr = '2013-05-01 07:15:45.123456789'
        expected_value = 1367392545123456789
        assert ts.value == expected_value
        assert expected_repr in repr(ts)

        ts = Timestamp('2013-05-01 07:15:45.123456789+09:00', tz='Asia/Tokyo')
        assert ts.value == expected_value - 9 * 3600 * 1000000000
        assert expected_repr in repr(ts)

        ts = Timestamp('2013-05-01 07:15:45.123456789', tz='UTC')
        assert ts.value == expected_value
        assert expected_repr in repr(ts)

        ts = Timestamp('2013-05-01 07:15:45.123456789', tz='US/Eastern')
        assert ts.value == expected_value + 4 * 3600 * 1000000000
        assert expected_repr in repr(ts)

        # GH 10041
        ts = Timestamp('20130501T071545.123456789')
        assert ts.value == expected_value
        assert expected_repr in repr(ts)

    def test_nanosecond_timestamp(self):
        # GH 7610
        expected = 1293840000000000005
        t = Timestamp('2011-01-01') + offsets.Nano(5)
        assert repr(t) == "Timestamp('2011-01-01 00:00:00.000000005')"
        assert t.value == expected
        assert t.nanosecond == 5

        t = Timestamp(t)
        assert repr(t) == "Timestamp('2011-01-01 00:00:00.000000005')"
        assert t.value == expected
        assert t.nanosecond == 5

        t = Timestamp(np_datetime64_compat('2011-01-01 00:00:00.000000005Z'))
        assert repr(t) == "Timestamp('2011-01-01 00:00:00.000000005')"
        assert t.value == expected
        assert t.nanosecond == 5

        expected = 1293840000000000010
        t = t + offsets.Nano(5)
        assert repr(t) == "Timestamp('2011-01-01 00:00:00.000000010')"
        assert t.value == expected
        assert t.nanosecond == 10

        t = Timestamp(t)
        assert repr(t) == "Timestamp('2011-01-01 00:00:00.000000010')"
        assert t.value == expected
        assert t.nanosecond == 10

        t = Timestamp(np_datetime64_compat('2011-01-01 00:00:00.000000010Z'))
        assert repr(t) == "Timestamp('2011-01-01 00:00:00.000000010')"
        assert t.value == expected
        assert t.nanosecond == 10


class TestTimestampOps(object):

    def test_timestamp_and_datetime(self):
        assert ((Timestamp(datetime(2013, 10, 13)) -
                 datetime(2013, 10, 12)).days == 1)
        assert ((datetime(2013, 10, 12) -
                 Timestamp(datetime(2013, 10, 13))).days == -1)

    def test_timestamp_and_series(self):
        timestamp_series = Series(date_range('2014-03-17', periods=2, freq='D',
                                             tz='US/Eastern'))
        first_timestamp = timestamp_series[0]

        delta_series = Series([np.timedelta64(0, 'D'), np.timedelta64(1, 'D')])
        assert_series_equal(timestamp_series - first_timestamp, delta_series)
        assert_series_equal(first_timestamp - timestamp_series, -delta_series)

    def test_addition_subtraction_types(self):
        # Assert on the types resulting from Timestamp +/- various date/time
        # objects
        datetime_instance = datetime(2014, 3, 4)
        timedelta_instance = timedelta(seconds=1)
        # build a timestamp with a frequency, since then it supports
        # addition/subtraction of integers
        timestamp_instance = date_range(datetime_instance, periods=1,
                                        freq='D')[0]

        assert type(timestamp_instance + 1) == Timestamp
        assert type(timestamp_instance - 1) == Timestamp

        # Timestamp + datetime not supported, though subtraction is supported
        # and yields timedelta more tests in tseries/base/tests/test_base.py
        assert type(timestamp_instance - datetime_instance) == Timedelta
        assert type(timestamp_instance + timedelta_instance) == Timestamp
        assert type(timestamp_instance - timedelta_instance) == Timestamp

        # Timestamp +/- datetime64 not supported, so not tested (could possibly
        # assert error raised?)
        timedelta64_instance = np.timedelta64(1, 'D')
        assert type(timestamp_instance + timedelta64_instance) == Timestamp
        assert type(timestamp_instance - timedelta64_instance) == Timestamp

    def test_addition_subtraction_preserve_frequency(self):
        timestamp_instance = date_range('2014-03-05', periods=1, freq='D')[0]
        timedelta_instance = timedelta(days=1)
        original_freq = timestamp_instance.freq

        assert (timestamp_instance + 1).freq == original_freq
        assert (timestamp_instance - 1).freq == original_freq
        assert (timestamp_instance + timedelta_instance).freq == original_freq
        assert (timestamp_instance - timedelta_instance).freq == original_freq

        timedelta64_instance = np.timedelta64(1, 'D')
        assert (timestamp_instance +
                timedelta64_instance).freq == original_freq
        assert (timestamp_instance -
                timedelta64_instance).freq == original_freq

    def test_resolution(self):

        for freq, expected in zip(['A', 'Q', 'M', 'D', 'H', 'T',
                                   'S', 'L', 'U'],
                                  [RESO_DAY, RESO_DAY,
                                   RESO_DAY, RESO_DAY,
                                   RESO_HR, RESO_MIN,
                                   RESO_SEC, RESO_MS,
                                   RESO_US]):
            for tz in [None, 'Asia/Tokyo', 'US/Eastern',
                       'dateutil/US/Eastern']:
                idx = date_range(start='2013-04-01', periods=30, freq=freq,
                                 tz=tz)
                result = period.resolution(idx.asi8, idx.tz)
                assert result == expected


class TestTimestampToJulianDate(object):

    def test_compare_1700(self):
        r = Timestamp('1700-06-23').to_julian_date()
        assert r == 2342145.5

    def test_compare_2000(self):
        r = Timestamp('2000-04-12').to_julian_date()
        assert r == 2451646.5

    def test_compare_2100(self):
        r = Timestamp('2100-08-12').to_julian_date()
        assert r == 2488292.5

    def test_compare_hour01(self):
        r = Timestamp('2000-08-12T01:00:00').to_julian_date()
        assert r == 2451768.5416666666666666

    def test_compare_hour13(self):
        r = Timestamp('2000-08-12T13:00:00').to_julian_date()
        assert r == 2451769.0416666666666666


class TestTimeSeries(object):

    def test_timestamp_to_datetime(self):
        tm._skip_if_no_pytz()
        rng = date_range('20090415', '20090519', tz='US/Eastern')

        stamp = rng[0]
        dtval = stamp.to_pydatetime()
        assert stamp == dtval
        assert stamp.tzinfo == dtval.tzinfo

    def test_timestamp_to_datetime_dateutil(self):
        tm._skip_if_no_pytz()
        rng = date_range('20090415', '20090519', tz='dateutil/US/Eastern')

        stamp = rng[0]
        dtval = stamp.to_pydatetime()
        assert stamp == dtval
        assert stamp.tzinfo == dtval.tzinfo

    def test_timestamp_to_datetime_explicit_pytz(self):
        tm._skip_if_no_pytz()
        import pytz
        rng = date_range('20090415', '20090519',
                         tz=pytz.timezone('US/Eastern'))

        stamp = rng[0]
        dtval = stamp.to_pydatetime()
        assert stamp == dtval
        assert stamp.tzinfo == dtval.tzinfo

    def test_timestamp_to_datetime_explicit_dateutil(self):
        tm._skip_if_windows_python_3()
        tm._skip_if_no_dateutil()
        from pandas._libs.tslib import _dateutil_gettz as gettz
        rng = date_range('20090415', '20090519', tz=gettz('US/Eastern'))

        stamp = rng[0]
        dtval = stamp.to_pydatetime()
        assert stamp == dtval
        assert stamp.tzinfo == dtval.tzinfo

    def test_timestamp_fields(self):
        # extra fields from DatetimeIndex like quarter and week
        idx = tm.makeDateIndex(100)

        fields = ['dayofweek', 'dayofyear', 'week', 'weekofyear', 'quarter',
                  'days_in_month', 'is_month_start', 'is_month_end',
                  'is_quarter_start', 'is_quarter_end', 'is_year_start',
                  'is_year_end', 'weekday_name']
        for f in fields:
            expected = getattr(idx, f)[-1]
            result = getattr(Timestamp(idx[-1]), f)
            assert result == expected

        assert idx.freq == Timestamp(idx[-1], idx.freq).freq
        assert idx.freqstr == Timestamp(idx[-1], idx.freq).freqstr

    def test_timestamp_date_out_of_range(self):
        pytest.raises(ValueError, Timestamp, '1676-01-01')
        pytest.raises(ValueError, Timestamp, '2263-01-01')

        # see gh-1475
        pytest.raises(ValueError, DatetimeIndex, ['1400-01-01'])
        pytest.raises(ValueError, DatetimeIndex, [datetime(1400, 1, 1)])

    def test_timestamp_repr(self):
        # pre-1900
        stamp = Timestamp('1850-01-01', tz='US/Eastern')
        repr(stamp)

        iso8601 = '1850-01-01 01:23:45.012345'
        stamp = Timestamp(iso8601, tz='US/Eastern')
        result = repr(stamp)
        assert iso8601 in result

    def test_timestamp_from_ordinal(self):

        # GH 3042
        dt = datetime(2011, 4, 16, 0, 0)
        ts = Timestamp.fromordinal(dt.toordinal())
        assert ts.to_pydatetime() == dt

        # with a tzinfo
        stamp = Timestamp('2011-4-16', tz='US/Eastern')
        dt_tz = stamp.to_pydatetime()
        ts = Timestamp.fromordinal(dt_tz.toordinal(), tz='US/Eastern')
        assert ts.to_pydatetime() == dt_tz

    def test_timestamp_compare_with_early_datetime(self):
        # e.g. datetime.min
        stamp = Timestamp('2012-01-01')

        assert not stamp == datetime.min
        assert not stamp == datetime(1600, 1, 1)
        assert not stamp == datetime(2700, 1, 1)
        assert stamp != datetime.min
        assert stamp != datetime(1600, 1, 1)
        assert stamp != datetime(2700, 1, 1)
        assert stamp > datetime(1600, 1, 1)
        assert stamp >= datetime(1600, 1, 1)
        assert stamp < datetime(2700, 1, 1)
        assert stamp <= datetime(2700, 1, 1)

    def test_timestamp_equality(self):

        # GH 11034
        s = Series([Timestamp('2000-01-29 01:59:00'), 'NaT'])
        result = s != s
        assert_series_equal(result, Series([False, True]))
        result = s != s[0]
        assert_series_equal(result, Series([False, True]))
        result = s != s[1]
        assert_series_equal(result, Series([True, True]))

        result = s == s
        assert_series_equal(result, Series([True, False]))
        result = s == s[0]
        assert_series_equal(result, Series([True, False]))
        result = s == s[1]
        assert_series_equal(result, Series([False, False]))

    def test_series_box_timestamp(self):
        rng = date_range('20090415', '20090519', freq='B')
        s = Series(rng)

        assert isinstance(s[5], Timestamp)

        rng = date_range('20090415', '20090519', freq='B')
        s = Series(rng, index=rng)
        assert isinstance(s[5], Timestamp)

        assert isinstance(s.iat[5], Timestamp)

    def test_frame_setitem_timestamp(self):
        # 2155
        columns = DatetimeIndex(start='1/1/2012', end='2/1/2012',
                                freq=offsets.BDay())
        index = lrange(10)
        data = DataFrame(columns=columns, index=index)
        t = datetime(2012, 11, 1)
        ts = Timestamp(t)
        data[ts] = np.nan  # works

    def test_to_html_timestamp(self):
        rng = date_range('2000-01-01', periods=10)
        df = DataFrame(np.random.randn(10, 4), index=rng)

        result = df.to_html()
        assert '2000-01-01' in result

    def test_series_map_box_timestamps(self):
        # #2689, #2627
        s = Series(date_range('1/1/2000', periods=10))

        def f(x):
            return (x.hour, x.day, x.month)

        # it works!
        s.map(f)
        s.apply(f)
        DataFrame(s).applymap(f)

    def test_dti_slicing(self):
        dti = DatetimeIndex(start='1/1/2005', end='12/1/2005', freq='M')
        dti2 = dti[[1, 3, 5]]

        v1 = dti2[0]
        v2 = dti2[1]
        v3 = dti2[2]

        assert v1 == Timestamp('2/28/2005')
        assert v2 == Timestamp('4/30/2005')
        assert v3 == Timestamp('6/30/2005')

        # don't carry freq through irregular slicing
        assert dti2.freq is None

    def test_woy_boundary(self):
        # make sure weeks at year boundaries are correct
        d = datetime(2013, 12, 31)
        result = Timestamp(d).week
        expected = 1  # ISO standard
        assert result == expected

        d = datetime(2008, 12, 28)
        result = Timestamp(d).week
        expected = 52  # ISO standard
        assert result == expected

        d = datetime(2009, 12, 31)
        result = Timestamp(d).week
        expected = 53  # ISO standard
        assert result == expected

        d = datetime(2010, 1, 1)
        result = Timestamp(d).week
        expected = 53  # ISO standard
        assert result == expected

        d = datetime(2010, 1, 3)
        result = Timestamp(d).week
        expected = 53  # ISO standard
        assert result == expected

        result = np.array([Timestamp(datetime(*args)).week
                           for args in [(2000, 1, 1), (2000, 1, 2), (
                               2005, 1, 1), (2005, 1, 2)]])
        assert (result == [52, 52, 53, 53]).all()


class TestTsUtil(object):

    def test_min_valid(self):
        # Ensure that Timestamp.min is a valid Timestamp
        Timestamp(Timestamp.min)

    def test_max_valid(self):
        # Ensure that Timestamp.max is a valid Timestamp
        Timestamp(Timestamp.max)

    def test_to_datetime_bijective(self):
        # Ensure that converting to datetime and back only loses precision
        # by going from nanoseconds to microseconds.
        exp_warning = None if Timestamp.max.nanosecond == 0 else UserWarning
        with tm.assert_produces_warning(exp_warning, check_stacklevel=False):
            assert (Timestamp(Timestamp.max.to_pydatetime()).value / 1000 ==
                    Timestamp.max.value / 1000)

        exp_warning = None if Timestamp.min.nanosecond == 0 else UserWarning
        with tm.assert_produces_warning(exp_warning, check_stacklevel=False):
            assert (Timestamp(Timestamp.min.to_pydatetime()).value / 1000 ==
                    Timestamp.min.value / 1000)
