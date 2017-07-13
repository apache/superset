""" test the scalar Timedelta """
import pytest

import numpy as np
from datetime import timedelta

import pandas as pd
import pandas.util.testing as tm
from pandas.core.tools.timedeltas import _coerce_scalar_to_timedelta_type as ct
from pandas import (Timedelta, TimedeltaIndex, timedelta_range, Series,
                    to_timedelta, compat)
from pandas._libs.tslib import iNaT, NaTType


class TestTimedeltas(object):
    _multiprocess_can_split_ = True

    def setup_method(self, method):
        pass

    def test_construction(self):

        expected = np.timedelta64(10, 'D').astype('m8[ns]').view('i8')
        assert Timedelta(10, unit='d').value == expected
        assert Timedelta(10.0, unit='d').value == expected
        assert Timedelta('10 days').value == expected
        assert Timedelta(days=10).value == expected
        assert Timedelta(days=10.0).value == expected

        expected += np.timedelta64(10, 's').astype('m8[ns]').view('i8')
        assert Timedelta('10 days 00:00:10').value == expected
        assert Timedelta(days=10, seconds=10).value == expected
        assert Timedelta(days=10, milliseconds=10 * 1000).value == expected
        assert (Timedelta(days=10, microseconds=10 * 1000 * 1000)
                .value == expected)

        # gh-8757: test construction with np dtypes
        timedelta_kwargs = {'days': 'D',
                            'seconds': 's',
                            'microseconds': 'us',
                            'milliseconds': 'ms',
                            'minutes': 'm',
                            'hours': 'h',
                            'weeks': 'W'}
        npdtypes = [np.int64, np.int32, np.int16, np.float64, np.float32,
                    np.float16]
        for npdtype in npdtypes:
            for pykwarg, npkwarg in timedelta_kwargs.items():
                expected = np.timedelta64(1, npkwarg).astype(
                    'm8[ns]').view('i8')
                assert Timedelta(**{pykwarg: npdtype(1)}).value == expected

        # rounding cases
        assert Timedelta(82739999850000).value == 82739999850000
        assert ('0 days 22:58:59.999850' in str(Timedelta(82739999850000)))
        assert Timedelta(123072001000000).value == 123072001000000
        assert ('1 days 10:11:12.001' in str(Timedelta(123072001000000)))

        # string conversion with/without leading zero
        # GH 9570
        assert Timedelta('0:00:00') == timedelta(hours=0)
        assert Timedelta('00:00:00') == timedelta(hours=0)
        assert Timedelta('-1:00:00') == -timedelta(hours=1)
        assert Timedelta('-01:00:00') == -timedelta(hours=1)

        # more strings & abbrevs
        # GH 8190
        assert Timedelta('1 h') == timedelta(hours=1)
        assert Timedelta('1 hour') == timedelta(hours=1)
        assert Timedelta('1 hr') == timedelta(hours=1)
        assert Timedelta('1 hours') == timedelta(hours=1)
        assert Timedelta('-1 hours') == -timedelta(hours=1)
        assert Timedelta('1 m') == timedelta(minutes=1)
        assert Timedelta('1.5 m') == timedelta(seconds=90)
        assert Timedelta('1 minute') == timedelta(minutes=1)
        assert Timedelta('1 minutes') == timedelta(minutes=1)
        assert Timedelta('1 s') == timedelta(seconds=1)
        assert Timedelta('1 second') == timedelta(seconds=1)
        assert Timedelta('1 seconds') == timedelta(seconds=1)
        assert Timedelta('1 ms') == timedelta(milliseconds=1)
        assert Timedelta('1 milli') == timedelta(milliseconds=1)
        assert Timedelta('1 millisecond') == timedelta(milliseconds=1)
        assert Timedelta('1 us') == timedelta(microseconds=1)
        assert Timedelta('1 micros') == timedelta(microseconds=1)
        assert Timedelta('1 microsecond') == timedelta(microseconds=1)
        assert Timedelta('1.5 microsecond') == Timedelta('00:00:00.000001500')
        assert Timedelta('1 ns') == Timedelta('00:00:00.000000001')
        assert Timedelta('1 nano') == Timedelta('00:00:00.000000001')
        assert Timedelta('1 nanosecond') == Timedelta('00:00:00.000000001')

        # combos
        assert Timedelta('10 days 1 hour') == timedelta(days=10, hours=1)
        assert Timedelta('10 days 1 h') == timedelta(days=10, hours=1)
        assert Timedelta('10 days 1 h 1m 1s') == timedelta(
            days=10, hours=1, minutes=1, seconds=1)
        assert Timedelta('-10 days 1 h 1m 1s') == -timedelta(
            days=10, hours=1, minutes=1, seconds=1)
        assert Timedelta('-10 days 1 h 1m 1s') == -timedelta(
            days=10, hours=1, minutes=1, seconds=1)
        assert Timedelta('-10 days 1 h 1m 1s 3us') == -timedelta(
            days=10, hours=1, minutes=1, seconds=1, microseconds=3)
        assert Timedelta('-10 days 1 h 1.5m 1s 3us'), -timedelta(
            days=10, hours=1, minutes=1, seconds=31, microseconds=3)

        # Currently invalid as it has a - on the hh:mm:dd part
        # (only allowed on the days)
        pytest.raises(ValueError,
                      lambda: Timedelta('-10 days -1 h 1.5m 1s 3us'))

        # only leading neg signs are allowed
        pytest.raises(ValueError,
                      lambda: Timedelta('10 days -1 h 1.5m 1s 3us'))

        # no units specified
        pytest.raises(ValueError, lambda: Timedelta('3.1415'))

        # invalid construction
        tm.assert_raises_regex(ValueError, "cannot construct a Timedelta",
                               lambda: Timedelta())
        tm.assert_raises_regex(ValueError,
                               "unit abbreviation w/o a number",
                               lambda: Timedelta('foo'))
        tm.assert_raises_regex(ValueError,
                               "cannot construct a Timedelta from the "
                               "passed arguments, allowed keywords are ",
                               lambda: Timedelta(day=10))

        # round-trip both for string and value
        for v in ['1s', '-1s', '1us', '-1us', '1 day', '-1 day',
                  '-23:59:59.999999', '-1 days +23:59:59.999999', '-1ns',
                  '1ns', '-23:59:59.999999999']:

            td = Timedelta(v)
            assert Timedelta(td.value) == td

            # str does not normally display nanos
            if not td.nanoseconds:
                assert Timedelta(str(td)) == td
            assert Timedelta(td._repr_base(format='all')) == td

        # floats
        expected = np.timedelta64(
            10, 's').astype('m8[ns]').view('i8') + np.timedelta64(
                500, 'ms').astype('m8[ns]').view('i8')
        assert Timedelta(10.5, unit='s').value == expected

        # offset
        assert (to_timedelta(pd.offsets.Hour(2)) ==
                Timedelta('0 days, 02:00:00'))
        assert (Timedelta(pd.offsets.Hour(2)) ==
                Timedelta('0 days, 02:00:00'))
        assert (Timedelta(pd.offsets.Second(2)) ==
                Timedelta('0 days, 00:00:02'))

        # gh-11995: unicode
        expected = Timedelta('1H')
        result = pd.Timedelta(u'1H')
        assert result == expected
        assert (to_timedelta(pd.offsets.Hour(2)) ==
                Timedelta(u'0 days, 02:00:00'))

        pytest.raises(ValueError, lambda: Timedelta(u'foo bar'))

    def test_overflow_on_construction(self):
        # xref https://github.com/statsmodels/statsmodels/issues/3374
        value = pd.Timedelta('1day').value * 20169940
        pytest.raises(OverflowError, pd.Timedelta, value)

    def test_total_seconds_scalar(self):
        # see gh-10939
        rng = Timedelta('1 days, 10:11:12.100123456')
        expt = 1 * 86400 + 10 * 3600 + 11 * 60 + 12 + 100123456. / 1e9
        tm.assert_almost_equal(rng.total_seconds(), expt)

        rng = Timedelta(np.nan)
        assert np.isnan(rng.total_seconds())

    def test_repr(self):

        assert (repr(Timedelta(10, unit='d')) ==
                "Timedelta('10 days 00:00:00')")
        assert (repr(Timedelta(10, unit='s')) ==
                "Timedelta('0 days 00:00:10')")
        assert (repr(Timedelta(10, unit='ms')) ==
                "Timedelta('0 days 00:00:00.010000')")
        assert (repr(Timedelta(-10, unit='ms')) ==
                "Timedelta('-1 days +23:59:59.990000')")

    def test_conversion(self):

        for td in [Timedelta(10, unit='d'),
                   Timedelta('1 days, 10:11:12.012345')]:
            pydt = td.to_pytimedelta()
            assert td == Timedelta(pydt)
            assert td == pydt
            assert (isinstance(pydt, timedelta) and not isinstance(
                pydt, Timedelta))

            assert td == np.timedelta64(td.value, 'ns')
            td64 = td.to_timedelta64()

            assert td64 == np.timedelta64(td.value, 'ns')
            assert td == td64

            assert isinstance(td64, np.timedelta64)

        # this is NOT equal and cannot be roundtriped (because of the nanos)
        td = Timedelta('1 days, 10:11:12.012345678')
        assert td != td.to_pytimedelta()

    def test_freq_conversion(self):

        # truediv
        td = Timedelta('1 days 2 hours 3 ns')
        result = td / np.timedelta64(1, 'D')
        assert result == td.value / float(86400 * 1e9)
        result = td / np.timedelta64(1, 's')
        assert result == td.value / float(1e9)
        result = td / np.timedelta64(1, 'ns')
        assert result == td.value

        # floordiv
        td = Timedelta('1 days 2 hours 3 ns')
        result = td // np.timedelta64(1, 'D')
        assert result == 1
        result = td // np.timedelta64(1, 's')
        assert result == 93600
        result = td // np.timedelta64(1, 'ns')
        assert result == td.value

    def test_fields(self):
        def check(value):
            # that we are int/long like
            assert isinstance(value, (int, compat.long))

        # compat to datetime.timedelta
        rng = to_timedelta('1 days, 10:11:12')
        assert rng.days == 1
        assert rng.seconds == 10 * 3600 + 11 * 60 + 12
        assert rng.microseconds == 0
        assert rng.nanoseconds == 0

        pytest.raises(AttributeError, lambda: rng.hours)
        pytest.raises(AttributeError, lambda: rng.minutes)
        pytest.raises(AttributeError, lambda: rng.milliseconds)

        # GH 10050
        check(rng.days)
        check(rng.seconds)
        check(rng.microseconds)
        check(rng.nanoseconds)

        td = Timedelta('-1 days, 10:11:12')
        assert abs(td) == Timedelta('13:48:48')
        assert str(td) == "-1 days +10:11:12"
        assert -td == Timedelta('0 days 13:48:48')
        assert -Timedelta('-1 days, 10:11:12').value == 49728000000000
        assert Timedelta('-1 days, 10:11:12').value == -49728000000000

        rng = to_timedelta('-1 days, 10:11:12.100123456')
        assert rng.days == -1
        assert rng.seconds == 10 * 3600 + 11 * 60 + 12
        assert rng.microseconds == 100 * 1000 + 123
        assert rng.nanoseconds == 456
        pytest.raises(AttributeError, lambda: rng.hours)
        pytest.raises(AttributeError, lambda: rng.minutes)
        pytest.raises(AttributeError, lambda: rng.milliseconds)

        # components
        tup = pd.to_timedelta(-1, 'us').components
        assert tup.days == -1
        assert tup.hours == 23
        assert tup.minutes == 59
        assert tup.seconds == 59
        assert tup.milliseconds == 999
        assert tup.microseconds == 999
        assert tup.nanoseconds == 0

        # GH 10050
        check(tup.days)
        check(tup.hours)
        check(tup.minutes)
        check(tup.seconds)
        check(tup.milliseconds)
        check(tup.microseconds)
        check(tup.nanoseconds)

        tup = Timedelta('-1 days 1 us').components
        assert tup.days == -2
        assert tup.hours == 23
        assert tup.minutes == 59
        assert tup.seconds == 59
        assert tup.milliseconds == 999
        assert tup.microseconds == 999
        assert tup.nanoseconds == 0

    def test_nat_converters(self):
        assert to_timedelta('nat', box=False).astype('int64') == iNaT
        assert to_timedelta('nan', box=False).astype('int64') == iNaT

        def testit(unit, transform):

            # array
            result = to_timedelta(np.arange(5), unit=unit)
            expected = TimedeltaIndex([np.timedelta64(i, transform(unit))
                                       for i in np.arange(5).tolist()])
            tm.assert_index_equal(result, expected)

            # scalar
            result = to_timedelta(2, unit=unit)
            expected = Timedelta(np.timedelta64(2, transform(unit)).astype(
                'timedelta64[ns]'))
            assert result == expected

        # validate all units
        # GH 6855
        for unit in ['Y', 'M', 'W', 'D', 'y', 'w', 'd']:
            testit(unit, lambda x: x.upper())
        for unit in ['days', 'day', 'Day', 'Days']:
            testit(unit, lambda x: 'D')
        for unit in ['h', 'm', 's', 'ms', 'us', 'ns', 'H', 'S', 'MS', 'US',
                     'NS']:
            testit(unit, lambda x: x.lower())

        # offsets

        # m
        testit('T', lambda x: 'm')

        # ms
        testit('L', lambda x: 'ms')

    def test_numeric_conversions(self):
        assert ct(0) == np.timedelta64(0, 'ns')
        assert ct(10) == np.timedelta64(10, 'ns')
        assert ct(10, unit='ns') == np.timedelta64(10, 'ns').astype('m8[ns]')

        assert ct(10, unit='us') == np.timedelta64(10, 'us').astype('m8[ns]')
        assert ct(10, unit='ms') == np.timedelta64(10, 'ms').astype('m8[ns]')
        assert ct(10, unit='s') == np.timedelta64(10, 's').astype('m8[ns]')
        assert ct(10, unit='d') == np.timedelta64(10, 'D').astype('m8[ns]')

    def test_timedelta_conversions(self):
        assert (ct(timedelta(seconds=1)) ==
                np.timedelta64(1, 's').astype('m8[ns]'))
        assert (ct(timedelta(microseconds=1)) ==
                np.timedelta64(1, 'us').astype('m8[ns]'))
        assert (ct(timedelta(days=1)) ==
                np.timedelta64(1, 'D').astype('m8[ns]'))

    def test_round(self):

        t1 = Timedelta('1 days 02:34:56.789123456')
        t2 = Timedelta('-1 days 02:34:56.789123456')

        for (freq, s1, s2) in [('N', t1, t2),
                               ('U', Timedelta('1 days 02:34:56.789123000'),
                                Timedelta('-1 days 02:34:56.789123000')),
                               ('L', Timedelta('1 days 02:34:56.789000000'),
                                Timedelta('-1 days 02:34:56.789000000')),
                               ('S', Timedelta('1 days 02:34:57'),
                                Timedelta('-1 days 02:34:57')),
                               ('2S', Timedelta('1 days 02:34:56'),
                                Timedelta('-1 days 02:34:56')),
                               ('5S', Timedelta('1 days 02:34:55'),
                                Timedelta('-1 days 02:34:55')),
                               ('T', Timedelta('1 days 02:35:00'),
                                Timedelta('-1 days 02:35:00')),
                               ('12T', Timedelta('1 days 02:36:00'),
                                Timedelta('-1 days 02:36:00')),
                               ('H', Timedelta('1 days 03:00:00'),
                                Timedelta('-1 days 03:00:00')),
                               ('d', Timedelta('1 days'),
                                Timedelta('-1 days'))]:
            r1 = t1.round(freq)
            assert r1 == s1
            r2 = t2.round(freq)
            assert r2 == s2

        # invalid
        for freq in ['Y', 'M', 'foobar']:
            pytest.raises(ValueError, lambda: t1.round(freq))

        t1 = timedelta_range('1 days', periods=3, freq='1 min 2 s 3 us')
        t2 = -1 * t1
        t1a = timedelta_range('1 days', periods=3, freq='1 min 2 s')
        t1c = pd.TimedeltaIndex([1, 1, 1], unit='D')

        # note that negative times round DOWN! so don't give whole numbers
        for (freq, s1, s2) in [('N', t1, t2),
                               ('U', t1, t2),
                               ('L', t1a,
                                TimedeltaIndex(['-1 days +00:00:00',
                                                '-2 days +23:58:58',
                                                '-2 days +23:57:56'],
                                               dtype='timedelta64[ns]',
                                               freq=None)
                                ),
                               ('S', t1a,
                                TimedeltaIndex(['-1 days +00:00:00',
                                                '-2 days +23:58:58',
                                                '-2 days +23:57:56'],
                                               dtype='timedelta64[ns]',
                                               freq=None)
                                ),
                               ('12T', t1c,
                                TimedeltaIndex(['-1 days',
                                                '-1 days',
                                                '-1 days'],
                                               dtype='timedelta64[ns]',
                                               freq=None)
                                ),
                               ('H', t1c,
                                TimedeltaIndex(['-1 days',
                                                '-1 days',
                                                '-1 days'],
                                               dtype='timedelta64[ns]',
                                               freq=None)
                                ),
                               ('d', t1c,
                                pd.TimedeltaIndex([-1, -1, -1], unit='D')
                                )]:

            r1 = t1.round(freq)
            tm.assert_index_equal(r1, s1)
            r2 = t2.round(freq)
        tm.assert_index_equal(r2, s2)

        # invalid
        for freq in ['Y', 'M', 'foobar']:
            pytest.raises(ValueError, lambda: t1.round(freq))

    def test_contains(self):
        # Checking for any NaT-like objects
        # GH 13603
        td = to_timedelta(range(5), unit='d') + pd.offsets.Hour(1)
        for v in [pd.NaT, None, float('nan'), np.nan]:
            assert not (v in td)

        td = to_timedelta([pd.NaT])
        for v in [pd.NaT, None, float('nan'), np.nan]:
            assert (v in td)

    def test_identity(self):

        td = Timedelta(10, unit='d')
        assert isinstance(td, Timedelta)
        assert isinstance(td, timedelta)

    def test_short_format_converters(self):
        def conv(v):
            return v.astype('m8[ns]')

        assert ct('10') == np.timedelta64(10, 'ns')
        assert ct('10ns') == np.timedelta64(10, 'ns')
        assert ct('100') == np.timedelta64(100, 'ns')
        assert ct('100ns') == np.timedelta64(100, 'ns')

        assert ct('1000') == np.timedelta64(1000, 'ns')
        assert ct('1000ns') == np.timedelta64(1000, 'ns')
        assert ct('1000NS') == np.timedelta64(1000, 'ns')

        assert ct('10us') == np.timedelta64(10000, 'ns')
        assert ct('100us') == np.timedelta64(100000, 'ns')
        assert ct('1000us') == np.timedelta64(1000000, 'ns')
        assert ct('1000Us') == np.timedelta64(1000000, 'ns')
        assert ct('1000uS') == np.timedelta64(1000000, 'ns')

        assert ct('1ms') == np.timedelta64(1000000, 'ns')
        assert ct('10ms') == np.timedelta64(10000000, 'ns')
        assert ct('100ms') == np.timedelta64(100000000, 'ns')
        assert ct('1000ms') == np.timedelta64(1000000000, 'ns')

        assert ct('-1s') == -np.timedelta64(1000000000, 'ns')
        assert ct('1s') == np.timedelta64(1000000000, 'ns')
        assert ct('10s') == np.timedelta64(10000000000, 'ns')
        assert ct('100s') == np.timedelta64(100000000000, 'ns')
        assert ct('1000s') == np.timedelta64(1000000000000, 'ns')

        assert ct('1d') == conv(np.timedelta64(1, 'D'))
        assert ct('-1d') == -conv(np.timedelta64(1, 'D'))
        assert ct('1D') == conv(np.timedelta64(1, 'D'))
        assert ct('10D') == conv(np.timedelta64(10, 'D'))
        assert ct('100D') == conv(np.timedelta64(100, 'D'))
        assert ct('1000D') == conv(np.timedelta64(1000, 'D'))
        assert ct('10000D') == conv(np.timedelta64(10000, 'D'))

        # space
        assert ct(' 10000D ') == conv(np.timedelta64(10000, 'D'))
        assert ct(' - 10000D ') == -conv(np.timedelta64(10000, 'D'))

        # invalid
        pytest.raises(ValueError, ct, '1foo')
        pytest.raises(ValueError, ct, 'foo')

    def test_full_format_converters(self):
        def conv(v):
            return v.astype('m8[ns]')

        d1 = np.timedelta64(1, 'D')

        assert ct('1days') == conv(d1)
        assert ct('1days,') == conv(d1)
        assert ct('- 1days,') == -conv(d1)

        assert ct('00:00:01') == conv(np.timedelta64(1, 's'))
        assert ct('06:00:01') == conv(np.timedelta64(6 * 3600 + 1, 's'))
        assert ct('06:00:01.0') == conv(np.timedelta64(6 * 3600 + 1, 's'))
        assert ct('06:00:01.01') == conv(np.timedelta64(
            1000 * (6 * 3600 + 1) + 10, 'ms'))

        assert (ct('- 1days, 00:00:01') ==
                conv(-d1 + np.timedelta64(1, 's')))
        assert (ct('1days, 06:00:01') ==
                conv(d1 + np.timedelta64(6 * 3600 + 1, 's')))
        assert (ct('1days, 06:00:01.01') ==
                conv(d1 + np.timedelta64(1000 * (6 * 3600 + 1) + 10, 'ms')))

        # invalid
        pytest.raises(ValueError, ct, '- 1days, 00')

    def test_overflow(self):
        # GH 9442
        s = Series(pd.date_range('20130101', periods=100000, freq='H'))
        s[0] += pd.Timedelta('1s 1ms')

        # mean
        result = (s - s.min()).mean()
        expected = pd.Timedelta((pd.DatetimeIndex((s - s.min())).asi8 / len(s)
                                 ).sum())

        # the computation is converted to float so
        # might be some loss of precision
        assert np.allclose(result.value / 1000, expected.value / 1000)

        # sum
        pytest.raises(ValueError, lambda: (s - s.min()).sum())
        s1 = s[0:10000]
        pytest.raises(ValueError, lambda: (s1 - s1.min()).sum())
        s2 = s[0:1000]
        result = (s2 - s2.min()).sum()

    def test_pickle(self):

        v = Timedelta('1 days 10:11:12.0123456')
        v_p = tm.round_trip_pickle(v)
        assert v == v_p

    def test_timedelta_hash_equality(self):
        # GH 11129
        v = Timedelta(1, 'D')
        td = timedelta(days=1)
        assert hash(v) == hash(td)

        d = {td: 2}
        assert d[v] == 2

        tds = timedelta_range('1 second', periods=20)
        assert all(hash(td) == hash(td.to_pytimedelta()) for td in tds)

        # python timedeltas drop ns resolution
        ns_td = Timedelta(1, 'ns')
        assert hash(ns_td) != hash(ns_td.to_pytimedelta())

    def test_implementation_limits(self):
        min_td = Timedelta(Timedelta.min)
        max_td = Timedelta(Timedelta.max)

        # GH 12727
        # timedelta limits correspond to int64 boundaries
        assert min_td.value == np.iinfo(np.int64).min + 1
        assert max_td.value == np.iinfo(np.int64).max

        # Beyond lower limit, a NAT before the Overflow
        assert isinstance(min_td - Timedelta(1, 'ns'), NaTType)

        with pytest.raises(OverflowError):
            min_td - Timedelta(2, 'ns')

        with pytest.raises(OverflowError):
            max_td + Timedelta(1, 'ns')

        # Same tests using the internal nanosecond values
        td = Timedelta(min_td.value - 1, 'ns')
        assert isinstance(td, NaTType)

        with pytest.raises(OverflowError):
            Timedelta(min_td.value - 2, 'ns')

        with pytest.raises(OverflowError):
            Timedelta(max_td.value + 1, 'ns')

    def test_timedelta_arithmetic(self):
        data = pd.Series(['nat', '32 days'], dtype='timedelta64[ns]')
        deltas = [timedelta(days=1), Timedelta(1, unit='D')]
        for delta in deltas:
            result_method = data.add(delta)
            result_operator = data + delta
            expected = pd.Series(['nat', '33 days'], dtype='timedelta64[ns]')
            tm.assert_series_equal(result_operator, expected)
            tm.assert_series_equal(result_method, expected)

            result_method = data.sub(delta)
            result_operator = data - delta
            expected = pd.Series(['nat', '31 days'], dtype='timedelta64[ns]')
            tm.assert_series_equal(result_operator, expected)
            tm.assert_series_equal(result_method, expected)
            # GH 9396
            result_method = data.div(delta)
            result_operator = data / delta
            expected = pd.Series([np.nan, 32.], dtype='float64')
            tm.assert_series_equal(result_operator, expected)
            tm.assert_series_equal(result_method, expected)

    def test_apply_to_timedelta(self):
        timedelta_NaT = pd.to_timedelta('NaT')

        list_of_valid_strings = ['00:00:01', '00:00:02']
        a = pd.to_timedelta(list_of_valid_strings)
        b = Series(list_of_valid_strings).apply(pd.to_timedelta)
        # Can't compare until apply on a Series gives the correct dtype
        # assert_series_equal(a, b)

        list_of_strings = ['00:00:01', np.nan, pd.NaT, timedelta_NaT]

        # TODO: unused?
        a = pd.to_timedelta(list_of_strings)  # noqa
        b = Series(list_of_strings).apply(pd.to_timedelta)  # noqa
        # Can't compare until apply on a Series gives the correct dtype
        # assert_series_equal(a, b)

    def test_components(self):
        rng = timedelta_range('1 days, 10:11:12', periods=2, freq='s')
        rng.components

        # with nat
        s = Series(rng)
        s[1] = np.nan

        result = s.dt.components
        assert not result.iloc[0].isnull().all()
        assert result.iloc[1].isnull().all()

    def test_isoformat(self):
        td = Timedelta(days=6, minutes=50, seconds=3,
                       milliseconds=10, microseconds=10, nanoseconds=12)
        expected = 'P6DT0H50M3.010010012S'
        result = td.isoformat()
        assert result == expected

        td = Timedelta(days=4, hours=12, minutes=30, seconds=5)
        result = td.isoformat()
        expected = 'P4DT12H30M5S'
        assert result == expected

        td = Timedelta(nanoseconds=123)
        result = td.isoformat()
        expected = 'P0DT0H0M0.000000123S'
        assert result == expected

        # trim nano
        td = Timedelta(microseconds=10)
        result = td.isoformat()
        expected = 'P0DT0H0M0.00001S'
        assert result == expected

        # trim micro
        td = Timedelta(milliseconds=1)
        result = td.isoformat()
        expected = 'P0DT0H0M0.001S'
        assert result == expected

        # don't strip every 0
        result = Timedelta(minutes=1).isoformat()
        expected = 'P0DT0H1M0S'
        assert result == expected

    def test_ops_error_str(self):
        # GH 13624
        td = Timedelta('1 day')

        for l, r in [(td, 'a'), ('a', td)]:

            with pytest.raises(TypeError):
                l + r

            with pytest.raises(TypeError):
                l > r

            assert not l == r
            assert l != r
