# coding=utf-8
# pylint: disable-msg=E1101,W0612

import pytz
import pytest

from datetime import timedelta, datetime

from distutils.version import LooseVersion
from numpy import nan
import numpy as np
import pandas as pd

from pandas import (Series, DataFrame, isnull, date_range,
                    MultiIndex, Index, Timestamp, NaT, IntervalIndex)
from pandas.compat import range
from pandas._libs.tslib import iNaT
from pandas.util.testing import assert_series_equal, assert_frame_equal
import pandas.util.testing as tm

from .common import TestData

try:
    import scipy
    _is_scipy_ge_0190 = scipy.__version__ >= LooseVersion('0.19.0')
except:
    _is_scipy_ge_0190 = False


def _skip_if_no_pchip():
    try:
        from scipy.interpolate import pchip_interpolate  # noqa
    except ImportError:
        import pytest
        pytest.skip('scipy.interpolate.pchip missing')


def _skip_if_no_akima():
    try:
        from scipy.interpolate import Akima1DInterpolator  # noqa
    except ImportError:
        import pytest
        pytest.skip('scipy.interpolate.Akima1DInterpolator missing')


def _simple_ts(start, end, freq='D'):
    rng = date_range(start, end, freq=freq)
    return Series(np.random.randn(len(rng)), index=rng)


class TestSeriesMissingData(TestData):

    def test_timedelta_fillna(self):
        # GH 3371
        s = Series([Timestamp('20130101'), Timestamp('20130101'), Timestamp(
            '20130102'), Timestamp('20130103 9:01:01')])
        td = s.diff()

        # reg fillna
        result = td.fillna(0)
        expected = Series([timedelta(0), timedelta(0), timedelta(1), timedelta(
            days=1, seconds=9 * 3600 + 60 + 1)])
        assert_series_equal(result, expected)

        # interprested as seconds
        result = td.fillna(1)
        expected = Series([timedelta(seconds=1), timedelta(0), timedelta(1),
                           timedelta(days=1, seconds=9 * 3600 + 60 + 1)])
        assert_series_equal(result, expected)

        result = td.fillna(timedelta(days=1, seconds=1))
        expected = Series([timedelta(days=1, seconds=1), timedelta(
            0), timedelta(1), timedelta(days=1, seconds=9 * 3600 + 60 + 1)])
        assert_series_equal(result, expected)

        result = td.fillna(np.timedelta64(int(1e9)))
        expected = Series([timedelta(seconds=1), timedelta(0), timedelta(1),
                           timedelta(days=1, seconds=9 * 3600 + 60 + 1)])
        assert_series_equal(result, expected)

        result = td.fillna(NaT)
        expected = Series([NaT, timedelta(0), timedelta(1),
                           timedelta(days=1, seconds=9 * 3600 + 60 + 1)],
                          dtype='m8[ns]')
        assert_series_equal(result, expected)

        # ffill
        td[2] = np.nan
        result = td.ffill()
        expected = td.fillna(0)
        expected[0] = np.nan
        assert_series_equal(result, expected)

        # bfill
        td[2] = np.nan
        result = td.bfill()
        expected = td.fillna(0)
        expected[2] = timedelta(days=1, seconds=9 * 3600 + 60 + 1)
        assert_series_equal(result, expected)

    def test_datetime64_fillna(self):

        s = Series([Timestamp('20130101'), Timestamp('20130101'), Timestamp(
            '20130102'), Timestamp('20130103 9:01:01')])
        s[2] = np.nan

        # reg fillna
        result = s.fillna(Timestamp('20130104'))
        expected = Series([Timestamp('20130101'), Timestamp(
            '20130101'), Timestamp('20130104'), Timestamp('20130103 9:01:01')])
        assert_series_equal(result, expected)

        result = s.fillna(NaT)
        expected = s
        assert_series_equal(result, expected)

        # ffill
        result = s.ffill()
        expected = Series([Timestamp('20130101'), Timestamp(
            '20130101'), Timestamp('20130101'), Timestamp('20130103 9:01:01')])
        assert_series_equal(result, expected)

        # bfill
        result = s.bfill()
        expected = Series([Timestamp('20130101'), Timestamp('20130101'),
                           Timestamp('20130103 9:01:01'), Timestamp(
                               '20130103 9:01:01')])
        assert_series_equal(result, expected)

        # GH 6587
        # make sure that we are treating as integer when filling
        # this also tests inference of a datetime-like with NaT's
        s = Series([pd.NaT, pd.NaT, '2013-08-05 15:30:00.000001'])
        expected = Series(
            ['2013-08-05 15:30:00.000001', '2013-08-05 15:30:00.000001',
             '2013-08-05 15:30:00.000001'], dtype='M8[ns]')
        result = s.fillna(method='backfill')
        assert_series_equal(result, expected)

    def test_datetime64_tz_fillna(self):
        for tz in ['US/Eastern', 'Asia/Tokyo']:
            # DatetimeBlock
            s = Series([Timestamp('2011-01-01 10:00'), pd.NaT,
                        Timestamp('2011-01-03 10:00'), pd.NaT])
            null_loc = pd.Series([False, True, False, True])

            result = s.fillna(pd.Timestamp('2011-01-02 10:00'))
            expected = Series([Timestamp('2011-01-01 10:00'),
                               Timestamp('2011-01-02 10:00'),
                               Timestamp('2011-01-03 10:00'),
                               Timestamp('2011-01-02 10:00')])
            tm.assert_series_equal(expected, result)
            # check s is not changed
            tm.assert_series_equal(pd.isnull(s), null_loc)

            result = s.fillna(pd.Timestamp('2011-01-02 10:00', tz=tz))
            expected = Series([Timestamp('2011-01-01 10:00'),
                               Timestamp('2011-01-02 10:00', tz=tz),
                               Timestamp('2011-01-03 10:00'),
                               Timestamp('2011-01-02 10:00', tz=tz)])
            tm.assert_series_equal(expected, result)
            tm.assert_series_equal(pd.isnull(s), null_loc)

            result = s.fillna('AAA')
            expected = Series([Timestamp('2011-01-01 10:00'), 'AAA',
                               Timestamp('2011-01-03 10:00'), 'AAA'],
                              dtype=object)
            tm.assert_series_equal(expected, result)
            tm.assert_series_equal(pd.isnull(s), null_loc)

            result = s.fillna({1: pd.Timestamp('2011-01-02 10:00', tz=tz),
                               3: pd.Timestamp('2011-01-04 10:00')})
            expected = Series([Timestamp('2011-01-01 10:00'),
                               Timestamp('2011-01-02 10:00', tz=tz),
                               Timestamp('2011-01-03 10:00'),
                               Timestamp('2011-01-04 10:00')])
            tm.assert_series_equal(expected, result)
            tm.assert_series_equal(pd.isnull(s), null_loc)

            result = s.fillna({1: pd.Timestamp('2011-01-02 10:00'),
                               3: pd.Timestamp('2011-01-04 10:00')})
            expected = Series([Timestamp('2011-01-01 10:00'),
                               Timestamp('2011-01-02 10:00'),
                               Timestamp('2011-01-03 10:00'),
                               Timestamp('2011-01-04 10:00')])
            tm.assert_series_equal(expected, result)
            tm.assert_series_equal(pd.isnull(s), null_loc)

            # DatetimeBlockTZ
            idx = pd.DatetimeIndex(['2011-01-01 10:00', pd.NaT,
                                    '2011-01-03 10:00', pd.NaT], tz=tz)
            s = pd.Series(idx)
            assert s.dtype == 'datetime64[ns, {0}]'.format(tz)
            tm.assert_series_equal(pd.isnull(s), null_loc)

            result = s.fillna(pd.Timestamp('2011-01-02 10:00'))
            expected = Series([Timestamp('2011-01-01 10:00', tz=tz),
                               Timestamp('2011-01-02 10:00'),
                               Timestamp('2011-01-03 10:00', tz=tz),
                               Timestamp('2011-01-02 10:00')])
            tm.assert_series_equal(expected, result)
            tm.assert_series_equal(pd.isnull(s), null_loc)

            result = s.fillna(pd.Timestamp('2011-01-02 10:00', tz=tz))
            idx = pd.DatetimeIndex(['2011-01-01 10:00', '2011-01-02 10:00',
                                    '2011-01-03 10:00', '2011-01-02 10:00'],
                                   tz=tz)
            expected = Series(idx)
            tm.assert_series_equal(expected, result)
            tm.assert_series_equal(pd.isnull(s), null_loc)

            result = s.fillna(pd.Timestamp('2011-01-02 10:00',
                                           tz=tz).to_pydatetime())
            idx = pd.DatetimeIndex(['2011-01-01 10:00', '2011-01-02 10:00',
                                    '2011-01-03 10:00', '2011-01-02 10:00'],
                                   tz=tz)
            expected = Series(idx)
            tm.assert_series_equal(expected, result)
            tm.assert_series_equal(pd.isnull(s), null_loc)

            result = s.fillna('AAA')
            expected = Series([Timestamp('2011-01-01 10:00', tz=tz), 'AAA',
                               Timestamp('2011-01-03 10:00', tz=tz), 'AAA'],
                              dtype=object)
            tm.assert_series_equal(expected, result)
            tm.assert_series_equal(pd.isnull(s), null_loc)

            result = s.fillna({1: pd.Timestamp('2011-01-02 10:00', tz=tz),
                               3: pd.Timestamp('2011-01-04 10:00')})
            expected = Series([Timestamp('2011-01-01 10:00', tz=tz),
                               Timestamp('2011-01-02 10:00', tz=tz),
                               Timestamp('2011-01-03 10:00', tz=tz),
                               Timestamp('2011-01-04 10:00')])
            tm.assert_series_equal(expected, result)
            tm.assert_series_equal(pd.isnull(s), null_loc)

            result = s.fillna({1: pd.Timestamp('2011-01-02 10:00', tz=tz),
                               3: pd.Timestamp('2011-01-04 10:00', tz=tz)})
            expected = Series([Timestamp('2011-01-01 10:00', tz=tz),
                               Timestamp('2011-01-02 10:00', tz=tz),
                               Timestamp('2011-01-03 10:00', tz=tz),
                               Timestamp('2011-01-04 10:00', tz=tz)])
            tm.assert_series_equal(expected, result)
            tm.assert_series_equal(pd.isnull(s), null_loc)

            # filling with a naive/other zone, coerce to object
            result = s.fillna(Timestamp('20130101'))
            expected = Series([Timestamp('2011-01-01 10:00', tz=tz),
                               Timestamp('2013-01-01'),
                               Timestamp('2011-01-03 10:00', tz=tz),
                               Timestamp('2013-01-01')])
            tm.assert_series_equal(expected, result)
            tm.assert_series_equal(pd.isnull(s), null_loc)

            result = s.fillna(Timestamp('20130101', tz='US/Pacific'))
            expected = Series([Timestamp('2011-01-01 10:00', tz=tz),
                               Timestamp('2013-01-01', tz='US/Pacific'),
                               Timestamp('2011-01-03 10:00', tz=tz),
                               Timestamp('2013-01-01', tz='US/Pacific')])
            tm.assert_series_equal(expected, result)
            tm.assert_series_equal(pd.isnull(s), null_loc)

        # with timezone
        # GH 15855
        df = pd.Series([pd.Timestamp('2012-11-11 00:00:00+01:00'), pd.NaT])
        exp = pd.Series([pd.Timestamp('2012-11-11 00:00:00+01:00'),
                         pd.Timestamp('2012-11-11 00:00:00+01:00')])
        assert_series_equal(df.fillna(method='pad'), exp)

        df = pd.Series([pd.NaT, pd.Timestamp('2012-11-11 00:00:00+01:00')])
        exp = pd.Series([pd.Timestamp('2012-11-11 00:00:00+01:00'),
                         pd.Timestamp('2012-11-11 00:00:00+01:00')])
        assert_series_equal(df.fillna(method='bfill'), exp)

    def test_datetime64tz_fillna_round_issue(self):
        # GH 14872

        data = pd.Series([pd.NaT, pd.NaT,
                          datetime(2016, 12, 12, 22, 24, 6, 100001,
                                   tzinfo=pytz.utc)])

        filled = data.fillna(method='bfill')

        expected = pd.Series([datetime(2016, 12, 12, 22, 24, 6,
                                       100001, tzinfo=pytz.utc),
                              datetime(2016, 12, 12, 22, 24, 6,
                                       100001, tzinfo=pytz.utc),
                              datetime(2016, 12, 12, 22, 24, 6,
                                       100001, tzinfo=pytz.utc)])

        assert_series_equal(filled, expected)

    def test_fillna_downcast(self):
        # GH 15277
        # infer int64 from float64
        s = pd.Series([1., np.nan])
        result = s.fillna(0, downcast='infer')
        expected = pd.Series([1, 0])
        assert_series_equal(result, expected)

        # infer int64 from float64 when fillna value is a dict
        s = pd.Series([1., np.nan])
        result = s.fillna({1: 0}, downcast='infer')
        expected = pd.Series([1, 0])
        assert_series_equal(result, expected)

    def test_fillna_int(self):
        s = Series(np.random.randint(-100, 100, 50))
        s.fillna(method='ffill', inplace=True)
        assert_series_equal(s.fillna(method='ffill', inplace=False), s)

    def test_fillna_raise(self):
        s = Series(np.random.randint(-100, 100, 50))
        pytest.raises(TypeError, s.fillna, [1, 2])
        pytest.raises(TypeError, s.fillna, (1, 2))

        # related GH 9217, make sure limit is an int and greater than 0
        s = Series([1, 2, 3, None])
        for limit in [-1, 0, 1., 2.]:
            for method in ['backfill', 'bfill', 'pad', 'ffill', None]:
                with pytest.raises(ValueError):
                    s.fillna(1, limit=limit, method=method)

    def test_fillna_nat(self):
        series = Series([0, 1, 2, iNaT], dtype='M8[ns]')

        filled = series.fillna(method='pad')
        filled2 = series.fillna(value=series.values[2])

        expected = series.copy()
        expected.values[3] = expected.values[2]

        assert_series_equal(filled, expected)
        assert_series_equal(filled2, expected)

        df = DataFrame({'A': series})
        filled = df.fillna(method='pad')
        filled2 = df.fillna(value=series.values[2])
        expected = DataFrame({'A': expected})
        assert_frame_equal(filled, expected)
        assert_frame_equal(filled2, expected)

        series = Series([iNaT, 0, 1, 2], dtype='M8[ns]')

        filled = series.fillna(method='bfill')
        filled2 = series.fillna(value=series[1])

        expected = series.copy()
        expected[0] = expected[1]

        assert_series_equal(filled, expected)
        assert_series_equal(filled2, expected)

        df = DataFrame({'A': series})
        filled = df.fillna(method='bfill')
        filled2 = df.fillna(value=series[1])
        expected = DataFrame({'A': expected})
        assert_frame_equal(filled, expected)
        assert_frame_equal(filled2, expected)

    def test_isnull_for_inf(self):
        s = Series(['a', np.inf, np.nan, 1.0])
        with pd.option_context('mode.use_inf_as_null', True):
            r = s.isnull()
            dr = s.dropna()
        e = Series([False, True, True, False])
        de = Series(['a', 1.0], index=[0, 3])
        tm.assert_series_equal(r, e)
        tm.assert_series_equal(dr, de)

    def test_fillna(self):
        ts = Series([0., 1., 2., 3., 4.], index=tm.makeDateIndex(5))

        tm.assert_series_equal(ts, ts.fillna(method='ffill'))

        ts[2] = np.NaN

        exp = Series([0., 1., 1., 3., 4.], index=ts.index)
        tm.assert_series_equal(ts.fillna(method='ffill'), exp)

        exp = Series([0., 1., 3., 3., 4.], index=ts.index)
        tm.assert_series_equal(ts.fillna(method='backfill'), exp)

        exp = Series([0., 1., 5., 3., 4.], index=ts.index)
        tm.assert_series_equal(ts.fillna(value=5), exp)

        pytest.raises(ValueError, ts.fillna)
        pytest.raises(ValueError, self.ts.fillna, value=0, method='ffill')

        # GH 5703
        s1 = Series([np.nan])
        s2 = Series([1])
        result = s1.fillna(s2)
        expected = Series([1.])
        assert_series_equal(result, expected)
        result = s1.fillna({})
        assert_series_equal(result, s1)
        result = s1.fillna(Series(()))
        assert_series_equal(result, s1)
        result = s2.fillna(s1)
        assert_series_equal(result, s2)
        result = s1.fillna({0: 1})
        assert_series_equal(result, expected)
        result = s1.fillna({1: 1})
        assert_series_equal(result, Series([np.nan]))
        result = s1.fillna({0: 1, 1: 1})
        assert_series_equal(result, expected)
        result = s1.fillna(Series({0: 1, 1: 1}))
        assert_series_equal(result, expected)
        result = s1.fillna(Series({0: 1, 1: 1}, index=[4, 5]))
        assert_series_equal(result, s1)

        s1 = Series([0, 1, 2], list('abc'))
        s2 = Series([0, np.nan, 2], list('bac'))
        result = s2.fillna(s1)
        expected = Series([0, 0, 2.], list('bac'))
        assert_series_equal(result, expected)

        # limit
        s = Series(np.nan, index=[0, 1, 2])
        result = s.fillna(999, limit=1)
        expected = Series([999, np.nan, np.nan], index=[0, 1, 2])
        assert_series_equal(result, expected)

        result = s.fillna(999, limit=2)
        expected = Series([999, 999, np.nan], index=[0, 1, 2])
        assert_series_equal(result, expected)

        # GH 9043
        # make sure a string representation of int/float values can be filled
        # correctly without raising errors or being converted
        vals = ['0', '1.5', '-0.3']
        for val in vals:
            s = Series([0, 1, np.nan, np.nan, 4], dtype='float64')
            result = s.fillna(val)
            expected = Series([0, 1, val, val, 4], dtype='object')
            assert_series_equal(result, expected)

    def test_fillna_bug(self):
        x = Series([nan, 1., nan, 3., nan], ['z', 'a', 'b', 'c', 'd'])
        filled = x.fillna(method='ffill')
        expected = Series([nan, 1., 1., 3., 3.], x.index)
        assert_series_equal(filled, expected)

        filled = x.fillna(method='bfill')
        expected = Series([1., 1., 3., 3., nan], x.index)
        assert_series_equal(filled, expected)

    def test_fillna_inplace(self):
        x = Series([nan, 1., nan, 3., nan], ['z', 'a', 'b', 'c', 'd'])
        y = x.copy()

        y.fillna(value=0, inplace=True)

        expected = x.fillna(value=0)
        assert_series_equal(y, expected)

    def test_fillna_invalid_method(self):
        try:
            self.ts.fillna(method='ffil')
        except ValueError as inst:
            assert 'ffil' in str(inst)

    def test_ffill(self):
        ts = Series([0., 1., 2., 3., 4.], index=tm.makeDateIndex(5))
        ts[2] = np.NaN
        assert_series_equal(ts.ffill(), ts.fillna(method='ffill'))

    def test_ffill_mixed_dtypes_without_missing_data(self):
        # GH14956
        series = pd.Series([datetime(2015, 1, 1, tzinfo=pytz.utc), 1])
        result = series.ffill()
        assert_series_equal(series, result)

    def test_bfill(self):
        ts = Series([0., 1., 2., 3., 4.], index=tm.makeDateIndex(5))
        ts[2] = np.NaN
        assert_series_equal(ts.bfill(), ts.fillna(method='bfill'))

    def test_timedelta64_nan(self):

        td = Series([timedelta(days=i) for i in range(10)])

        # nan ops on timedeltas
        td1 = td.copy()
        td1[0] = np.nan
        assert isnull(td1[0])
        assert td1[0].value == iNaT
        td1[0] = td[0]
        assert not isnull(td1[0])

        td1[1] = iNaT
        assert isnull(td1[1])
        assert td1[1].value == iNaT
        td1[1] = td[1]
        assert not isnull(td1[1])

        td1[2] = NaT
        assert isnull(td1[2])
        assert td1[2].value == iNaT
        td1[2] = td[2]
        assert not isnull(td1[2])

        # boolean setting
        # this doesn't work, not sure numpy even supports it
        # result = td[(td>np.timedelta64(timedelta(days=3))) &
        # td<np.timedelta64(timedelta(days=7)))] = np.nan
        # assert isnull(result).sum() == 7

        # NumPy limitiation =(

        # def test_logical_range_select(self):
        #     np.random.seed(12345)
        #     selector = -0.5 <= self.ts <= 0.5
        #     expected = (self.ts >= -0.5) & (self.ts <= 0.5)
        #     assert_series_equal(selector, expected)

    def test_dropna_empty(self):
        s = Series([])
        assert len(s.dropna()) == 0
        s.dropna(inplace=True)
        assert len(s) == 0

        # invalid axis
        pytest.raises(ValueError, s.dropna, axis=1)

    def test_datetime64_tz_dropna(self):
        # DatetimeBlock
        s = Series([Timestamp('2011-01-01 10:00'), pd.NaT, Timestamp(
            '2011-01-03 10:00'), pd.NaT])
        result = s.dropna()
        expected = Series([Timestamp('2011-01-01 10:00'),
                           Timestamp('2011-01-03 10:00')], index=[0, 2])
        tm.assert_series_equal(result, expected)

        # DatetimeBlockTZ
        idx = pd.DatetimeIndex(['2011-01-01 10:00', pd.NaT,
                                '2011-01-03 10:00', pd.NaT],
                               tz='Asia/Tokyo')
        s = pd.Series(idx)
        assert s.dtype == 'datetime64[ns, Asia/Tokyo]'
        result = s.dropna()
        expected = Series([Timestamp('2011-01-01 10:00', tz='Asia/Tokyo'),
                           Timestamp('2011-01-03 10:00', tz='Asia/Tokyo')],
                          index=[0, 2])
        assert result.dtype == 'datetime64[ns, Asia/Tokyo]'
        tm.assert_series_equal(result, expected)

    def test_dropna_no_nan(self):
        for s in [Series([1, 2, 3], name='x'), Series(
                [False, True, False], name='x')]:

            result = s.dropna()
            tm.assert_series_equal(result, s)
            assert result is not s

            s2 = s.copy()
            s2.dropna(inplace=True)
            tm.assert_series_equal(s2, s)

    def test_dropna_intervals(self):
        s = Series([np.nan, 1, 2, 3], IntervalIndex.from_arrays(
            [np.nan, 0, 1, 2],
            [np.nan, 1, 2, 3]))

        result = s.dropna()
        expected = s.iloc[1:]
        assert_series_equal(result, expected)

    def test_valid(self):
        ts = self.ts.copy()
        ts[::2] = np.NaN

        result = ts.valid()
        assert len(result) == ts.count()
        tm.assert_series_equal(result, ts[1::2])
        tm.assert_series_equal(result, ts[pd.notnull(ts)])

    def test_isnull(self):
        ser = Series([0, 5.4, 3, nan, -0.001])
        np.array_equal(ser.isnull(),
                       Series([False, False, False, True, False]).values)
        ser = Series(["hi", "", nan])
        np.array_equal(ser.isnull(), Series([False, False, True]).values)

    def test_notnull(self):
        ser = Series([0, 5.4, 3, nan, -0.001])
        np.array_equal(ser.notnull(),
                       Series([True, True, True, False, True]).values)
        ser = Series(["hi", "", nan])
        np.array_equal(ser.notnull(), Series([True, True, False]).values)

    def test_pad_nan(self):
        x = Series([np.nan, 1., np.nan, 3., np.nan], ['z', 'a', 'b', 'c', 'd'],
                   dtype=float)

        x.fillna(method='pad', inplace=True)

        expected = Series([np.nan, 1.0, 1.0, 3.0, 3.0],
                          ['z', 'a', 'b', 'c', 'd'], dtype=float)
        assert_series_equal(x[1:], expected[1:])
        assert np.isnan(x[0]), np.isnan(expected[0])

    def test_pad_require_monotonicity(self):
        rng = date_range('1/1/2000', '3/1/2000', freq='B')

        # neither monotonic increasing or decreasing
        rng2 = rng[[1, 0, 2]]

        pytest.raises(ValueError, rng2.get_indexer, rng, method='pad')

    def test_dropna_preserve_name(self):
        self.ts[:5] = np.nan
        result = self.ts.dropna()
        assert result.name == self.ts.name
        name = self.ts.name
        ts = self.ts.copy()
        ts.dropna(inplace=True)
        assert ts.name == name

    def test_fill_value_when_combine_const(self):
        # GH12723
        s = Series([0, 1, np.nan, 3, 4, 5])

        exp = s.fillna(0).add(2)
        res = s.add(2, fill_value=0)
        assert_series_equal(res, exp)

    def test_series_fillna_limit(self):
        index = np.arange(10)
        s = Series(np.random.randn(10), index=index)

        result = s[:2].reindex(index)
        result = result.fillna(method='pad', limit=5)

        expected = s[:2].reindex(index).fillna(method='pad')
        expected[-3:] = np.nan
        assert_series_equal(result, expected)

        result = s[-2:].reindex(index)
        result = result.fillna(method='bfill', limit=5)

        expected = s[-2:].reindex(index).fillna(method='backfill')
        expected[:3] = np.nan
        assert_series_equal(result, expected)

    def test_sparse_series_fillna_limit(self):
        index = np.arange(10)
        s = Series(np.random.randn(10), index=index)

        ss = s[:2].reindex(index).to_sparse()
        result = ss.fillna(method='pad', limit=5)
        expected = ss.fillna(method='pad', limit=5)
        expected = expected.to_dense()
        expected[-3:] = np.nan
        expected = expected.to_sparse()
        assert_series_equal(result, expected)

        ss = s[-2:].reindex(index).to_sparse()
        result = ss.fillna(method='backfill', limit=5)
        expected = ss.fillna(method='backfill')
        expected = expected.to_dense()
        expected[:3] = np.nan
        expected = expected.to_sparse()
        assert_series_equal(result, expected)

    def test_sparse_series_pad_backfill_limit(self):
        index = np.arange(10)
        s = Series(np.random.randn(10), index=index)
        s = s.to_sparse()

        result = s[:2].reindex(index, method='pad', limit=5)
        expected = s[:2].reindex(index).fillna(method='pad')
        expected = expected.to_dense()
        expected[-3:] = np.nan
        expected = expected.to_sparse()
        assert_series_equal(result, expected)

        result = s[-2:].reindex(index, method='backfill', limit=5)
        expected = s[-2:].reindex(index).fillna(method='backfill')
        expected = expected.to_dense()
        expected[:3] = np.nan
        expected = expected.to_sparse()
        assert_series_equal(result, expected)

    def test_series_pad_backfill_limit(self):
        index = np.arange(10)
        s = Series(np.random.randn(10), index=index)

        result = s[:2].reindex(index, method='pad', limit=5)

        expected = s[:2].reindex(index).fillna(method='pad')
        expected[-3:] = np.nan
        assert_series_equal(result, expected)

        result = s[-2:].reindex(index, method='backfill', limit=5)

        expected = s[-2:].reindex(index).fillna(method='backfill')
        expected[:3] = np.nan
        assert_series_equal(result, expected)


class TestSeriesInterpolateData(TestData):

    def test_interpolate(self):
        ts = Series(np.arange(len(self.ts), dtype=float), self.ts.index)

        ts_copy = ts.copy()
        ts_copy[5:10] = np.NaN

        linear_interp = ts_copy.interpolate(method='linear')
        tm.assert_series_equal(linear_interp, ts)

        ord_ts = Series([d.toordinal() for d in self.ts.index],
                        index=self.ts.index).astype(float)

        ord_ts_copy = ord_ts.copy()
        ord_ts_copy[5:10] = np.NaN

        time_interp = ord_ts_copy.interpolate(method='time')
        tm.assert_series_equal(time_interp, ord_ts)

        # try time interpolation on a non-TimeSeries
        # Only raises ValueError if there are NaNs.
        non_ts = self.series.copy()
        non_ts[0] = np.NaN
        pytest.raises(ValueError, non_ts.interpolate, method='time')

    def test_interpolate_pchip(self):
        tm._skip_if_no_scipy()
        _skip_if_no_pchip()

        ser = Series(np.sort(np.random.uniform(size=100)))

        # interpolate at new_index
        new_index = ser.index.union(Index([49.25, 49.5, 49.75, 50.25, 50.5,
                                           50.75]))
        interp_s = ser.reindex(new_index).interpolate(method='pchip')
        # does not blow up, GH5977
        interp_s[49:51]

    def test_interpolate_akima(self):
        tm._skip_if_no_scipy()
        _skip_if_no_akima()

        ser = Series([10, 11, 12, 13])

        expected = Series([11.00, 11.25, 11.50, 11.75,
                           12.00, 12.25, 12.50, 12.75, 13.00],
                          index=Index([1.0, 1.25, 1.5, 1.75,
                                       2.0, 2.25, 2.5, 2.75, 3.0]))
        # interpolate at new_index
        new_index = ser.index.union(Index([1.25, 1.5, 1.75, 2.25, 2.5, 2.75]))
        interp_s = ser.reindex(new_index).interpolate(method='akima')
        assert_series_equal(interp_s[1:3], expected)

    def test_interpolate_piecewise_polynomial(self):
        tm._skip_if_no_scipy()

        ser = Series([10, 11, 12, 13])

        expected = Series([11.00, 11.25, 11.50, 11.75,
                           12.00, 12.25, 12.50, 12.75, 13.00],
                          index=Index([1.0, 1.25, 1.5, 1.75,
                                       2.0, 2.25, 2.5, 2.75, 3.0]))
        # interpolate at new_index
        new_index = ser.index.union(Index([1.25, 1.5, 1.75, 2.25, 2.5, 2.75]))
        interp_s = ser.reindex(new_index).interpolate(
            method='piecewise_polynomial')
        assert_series_equal(interp_s[1:3], expected)

    def test_interpolate_from_derivatives(self):
        tm._skip_if_no_scipy()

        ser = Series([10, 11, 12, 13])

        expected = Series([11.00, 11.25, 11.50, 11.75,
                           12.00, 12.25, 12.50, 12.75, 13.00],
                          index=Index([1.0, 1.25, 1.5, 1.75,
                                       2.0, 2.25, 2.5, 2.75, 3.0]))
        # interpolate at new_index
        new_index = ser.index.union(Index([1.25, 1.5, 1.75, 2.25, 2.5, 2.75]))
        interp_s = ser.reindex(new_index).interpolate(
            method='from_derivatives')
        assert_series_equal(interp_s[1:3], expected)

    def test_interpolate_corners(self):
        s = Series([np.nan, np.nan])
        assert_series_equal(s.interpolate(), s)

        s = Series([]).interpolate()
        assert_series_equal(s.interpolate(), s)

        tm._skip_if_no_scipy()
        s = Series([np.nan, np.nan])
        assert_series_equal(s.interpolate(method='polynomial', order=1), s)

        s = Series([]).interpolate()
        assert_series_equal(s.interpolate(method='polynomial', order=1), s)

    def test_interpolate_index_values(self):
        s = Series(np.nan, index=np.sort(np.random.rand(30)))
        s[::3] = np.random.randn(10)

        vals = s.index.values.astype(float)

        result = s.interpolate(method='index')

        expected = s.copy()
        bad = isnull(expected.values)
        good = ~bad
        expected = Series(np.interp(vals[bad], vals[good],
                                    s.values[good]),
                          index=s.index[bad])

        assert_series_equal(result[bad], expected)

        # 'values' is synonymous with 'index' for the method kwarg
        other_result = s.interpolate(method='values')

        assert_series_equal(other_result, result)
        assert_series_equal(other_result[bad], expected)

    def test_interpolate_non_ts(self):
        s = Series([1, 3, np.nan, np.nan, np.nan, 11])
        with pytest.raises(ValueError):
            s.interpolate(method='time')

    # New interpolation tests
    def test_nan_interpolate(self):
        s = Series([0, 1, np.nan, 3])
        result = s.interpolate()
        expected = Series([0., 1., 2., 3.])
        assert_series_equal(result, expected)

        tm._skip_if_no_scipy()
        result = s.interpolate(method='polynomial', order=1)
        assert_series_equal(result, expected)

    def test_nan_irregular_index(self):
        s = Series([1, 2, np.nan, 4], index=[1, 3, 5, 9])
        result = s.interpolate()
        expected = Series([1., 2., 3., 4.], index=[1, 3, 5, 9])
        assert_series_equal(result, expected)

    def test_nan_str_index(self):
        s = Series([0, 1, 2, np.nan], index=list('abcd'))
        result = s.interpolate()
        expected = Series([0., 1., 2., 2.], index=list('abcd'))
        assert_series_equal(result, expected)

    def test_interp_quad(self):
        tm._skip_if_no_scipy()
        sq = Series([1, 4, np.nan, 16], index=[1, 2, 3, 4])
        result = sq.interpolate(method='quadratic')
        expected = Series([1., 4., 9., 16.], index=[1, 2, 3, 4])
        assert_series_equal(result, expected)

    def test_interp_scipy_basic(self):
        tm._skip_if_no_scipy()

        s = Series([1, 3, np.nan, 12, np.nan, 25])
        # slinear
        expected = Series([1., 3., 7.5, 12., 18.5, 25.])
        result = s.interpolate(method='slinear')
        assert_series_equal(result, expected)

        result = s.interpolate(method='slinear', downcast='infer')
        assert_series_equal(result, expected)
        # nearest
        expected = Series([1, 3, 3, 12, 12, 25])
        result = s.interpolate(method='nearest')
        assert_series_equal(result, expected.astype('float'))

        result = s.interpolate(method='nearest', downcast='infer')
        assert_series_equal(result, expected)
        # zero
        expected = Series([1, 3, 3, 12, 12, 25])
        result = s.interpolate(method='zero')
        assert_series_equal(result, expected.astype('float'))

        result = s.interpolate(method='zero', downcast='infer')
        assert_series_equal(result, expected)
        # quadratic
        # GH #15662.
        # new cubic and quadratic interpolation algorithms from scipy 0.19.0.
        # previously `splmake` was used. See scipy/scipy#6710
        if _is_scipy_ge_0190:
            expected = Series([1, 3., 6.823529, 12., 18.058824, 25.])
        else:
            expected = Series([1, 3., 6.769231, 12., 18.230769, 25.])
        result = s.interpolate(method='quadratic')
        assert_series_equal(result, expected)

        result = s.interpolate(method='quadratic', downcast='infer')
        assert_series_equal(result, expected)
        # cubic
        expected = Series([1., 3., 6.8, 12., 18.2, 25.])
        result = s.interpolate(method='cubic')
        assert_series_equal(result, expected)

    def test_interp_limit(self):
        s = Series([1, 3, np.nan, np.nan, np.nan, 11])

        expected = Series([1., 3., 5., 7., np.nan, 11.])
        result = s.interpolate(method='linear', limit=2)
        assert_series_equal(result, expected)

        # GH 9217, make sure limit is an int and greater than 0
        methods = ['linear', 'time', 'index', 'values', 'nearest', 'zero',
                   'slinear', 'quadratic', 'cubic', 'barycentric', 'krogh',
                   'polynomial', 'spline', 'piecewise_polynomial', None,
                   'from_derivatives', 'pchip', 'akima']
        s = pd.Series([1, 2, np.nan, np.nan, 5])
        for limit in [-1, 0, 1., 2.]:
            for method in methods:
                with pytest.raises(ValueError):
                    s.interpolate(limit=limit, method=method)

    def test_interp_limit_forward(self):
        s = Series([1, 3, np.nan, np.nan, np.nan, 11])

        # Provide 'forward' (the default) explicitly here.
        expected = Series([1., 3., 5., 7., np.nan, 11.])

        result = s.interpolate(method='linear', limit=2,
                               limit_direction='forward')
        assert_series_equal(result, expected)

        result = s.interpolate(method='linear', limit=2,
                               limit_direction='FORWARD')
        assert_series_equal(result, expected)

    def test_interp_unlimited(self):
        # these test are for issue #16282 default Limit=None is unlimited
        s = Series([np.nan, 1., 3., np.nan, np.nan, np.nan, 11., np.nan])
        expected = Series([1., 1., 3., 5., 7., 9., 11., 11.])
        result = s.interpolate(method='linear',
                               limit_direction='both')
        assert_series_equal(result, expected)

        expected = Series([np.nan, 1., 3., 5., 7., 9., 11., 11.])
        result = s.interpolate(method='linear',
                               limit_direction='forward')
        assert_series_equal(result, expected)

        expected = Series([1., 1., 3., 5., 7., 9., 11., np.nan])
        result = s.interpolate(method='linear',
                               limit_direction='backward')
        assert_series_equal(result, expected)

    def test_interp_limit_bad_direction(self):
        s = Series([1, 3, np.nan, np.nan, np.nan, 11])

        pytest.raises(ValueError, s.interpolate, method='linear', limit=2,
                      limit_direction='abc')

        # raises an error even if no limit is specified.
        pytest.raises(ValueError, s.interpolate, method='linear',
                      limit_direction='abc')

    def test_interp_limit_direction(self):
        # These tests are for issue #9218 -- fill NaNs in both directions.
        s = Series([1, 3, np.nan, np.nan, np.nan, 11])

        expected = Series([1., 3., np.nan, 7., 9., 11.])
        result = s.interpolate(method='linear', limit=2,
                               limit_direction='backward')
        assert_series_equal(result, expected)

        expected = Series([1., 3., 5., np.nan, 9., 11.])
        result = s.interpolate(method='linear', limit=1,
                               limit_direction='both')
        assert_series_equal(result, expected)

        # Check that this works on a longer series of nans.
        s = Series([1, 3, np.nan, np.nan, np.nan, 7, 9, np.nan, np.nan, 12,
                    np.nan])

        expected = Series([1., 3., 4., 5., 6., 7., 9., 10., 11., 12., 12.])
        result = s.interpolate(method='linear', limit=2,
                               limit_direction='both')
        assert_series_equal(result, expected)

        expected = Series([1., 3., 4., np.nan, 6., 7., 9., 10., 11., 12., 12.])
        result = s.interpolate(method='linear', limit=1,
                               limit_direction='both')
        assert_series_equal(result, expected)

    def test_interp_limit_to_ends(self):
        # These test are for issue #10420 -- flow back to beginning.
        s = Series([np.nan, np.nan, 5, 7, 9, np.nan])

        expected = Series([5., 5., 5., 7., 9., np.nan])
        result = s.interpolate(method='linear', limit=2,
                               limit_direction='backward')
        assert_series_equal(result, expected)

        expected = Series([5., 5., 5., 7., 9., 9.])
        result = s.interpolate(method='linear', limit=2,
                               limit_direction='both')
        assert_series_equal(result, expected)

    def test_interp_limit_before_ends(self):
        # These test are for issue #11115 -- limit ends properly.
        s = Series([np.nan, np.nan, 5, 7, np.nan, np.nan])

        expected = Series([np.nan, np.nan, 5., 7., 7., np.nan])
        result = s.interpolate(method='linear', limit=1,
                               limit_direction='forward')
        assert_series_equal(result, expected)

        expected = Series([np.nan, 5., 5., 7., np.nan, np.nan])
        result = s.interpolate(method='linear', limit=1,
                               limit_direction='backward')
        assert_series_equal(result, expected)

        expected = Series([np.nan, 5., 5., 7., 7., np.nan])
        result = s.interpolate(method='linear', limit=1,
                               limit_direction='both')
        assert_series_equal(result, expected)

    def test_interp_all_good(self):
        # scipy
        tm._skip_if_no_scipy()
        s = Series([1, 2, 3])
        result = s.interpolate(method='polynomial', order=1)
        assert_series_equal(result, s)

        # non-scipy
        result = s.interpolate()
        assert_series_equal(result, s)

    def test_interp_multiIndex(self):
        idx = MultiIndex.from_tuples([(0, 'a'), (1, 'b'), (2, 'c')])
        s = Series([1, 2, np.nan], index=idx)

        expected = s.copy()
        expected.loc[2] = 2
        result = s.interpolate()
        assert_series_equal(result, expected)

        tm._skip_if_no_scipy()
        with pytest.raises(ValueError):
            s.interpolate(method='polynomial', order=1)

    def test_interp_nonmono_raise(self):
        tm._skip_if_no_scipy()
        s = Series([1, np.nan, 3], index=[0, 2, 1])
        with pytest.raises(ValueError):
            s.interpolate(method='krogh')

    def test_interp_datetime64(self):
        tm._skip_if_no_scipy()
        df = Series([1, np.nan, 3], index=date_range('1/1/2000', periods=3))
        result = df.interpolate(method='nearest')
        expected = Series([1., 1., 3.],
                          index=date_range('1/1/2000', periods=3))
        assert_series_equal(result, expected)

    def test_interp_limit_no_nans(self):
        # GH 7173
        s = pd.Series([1., 2., 3.])
        result = s.interpolate(limit=1)
        expected = s
        assert_series_equal(result, expected)

    def test_no_order(self):
        tm._skip_if_no_scipy()
        s = Series([0, 1, np.nan, 3])
        with pytest.raises(ValueError):
            s.interpolate(method='polynomial')
        with pytest.raises(ValueError):
            s.interpolate(method='spline')

    def test_spline(self):
        tm._skip_if_no_scipy()
        s = Series([1, 2, np.nan, 4, 5, np.nan, 7])
        result = s.interpolate(method='spline', order=1)
        expected = Series([1., 2., 3., 4., 5., 6., 7.])
        assert_series_equal(result, expected)

    def test_spline_extrapolate(self):
        tm.skip_if_no_package(
            'scipy', min_version='0.15',
            app='setting ext on scipy.interpolate.UnivariateSpline')
        s = Series([1, 2, 3, 4, np.nan, 6, np.nan])
        result3 = s.interpolate(method='spline', order=1, ext=3)
        expected3 = Series([1., 2., 3., 4., 5., 6., 6.])
        assert_series_equal(result3, expected3)

        result1 = s.interpolate(method='spline', order=1, ext=0)
        expected1 = Series([1., 2., 3., 4., 5., 6., 7.])
        assert_series_equal(result1, expected1)

    def test_spline_smooth(self):
        tm._skip_if_no_scipy()
        s = Series([1, 2, np.nan, 4, 5.1, np.nan, 7])
        assert (s.interpolate(method='spline', order=3, s=0)[5] !=
                s.interpolate(method='spline', order=3)[5])

    def test_spline_interpolation(self):
        tm._skip_if_no_scipy()

        s = Series(np.arange(10) ** 2)
        s[np.random.randint(0, 9, 3)] = np.nan
        result1 = s.interpolate(method='spline', order=1)
        expected1 = s.interpolate(method='spline', order=1)
        assert_series_equal(result1, expected1)

    def test_spline_error(self):
        # see gh-10633
        tm._skip_if_no_scipy()

        s = pd.Series(np.arange(10) ** 2)
        s[np.random.randint(0, 9, 3)] = np.nan
        with pytest.raises(ValueError):
            s.interpolate(method='spline')

        with pytest.raises(ValueError):
            s.interpolate(method='spline', order=0)

    def test_interp_timedelta64(self):
        # GH 6424
        df = Series([1, np.nan, 3],
                    index=pd.to_timedelta([1, 2, 3]))
        result = df.interpolate(method='time')
        expected = Series([1., 2., 3.],
                          index=pd.to_timedelta([1, 2, 3]))
        assert_series_equal(result, expected)

        # test for non uniform spacing
        df = Series([1, np.nan, 3],
                    index=pd.to_timedelta([1, 2, 4]))
        result = df.interpolate(method='time')
        expected = Series([1., 1.666667, 3.],
                          index=pd.to_timedelta([1, 2, 4]))
        assert_series_equal(result, expected)

    def test_series_interpolate_method_values(self):
        # #1646
        ts = _simple_ts('1/1/2000', '1/20/2000')
        ts[::2] = np.nan

        result = ts.interpolate(method='values')
        exp = ts.interpolate()
        assert_series_equal(result, exp)

    def test_series_interpolate_intraday(self):
        # #1698
        index = pd.date_range('1/1/2012', periods=4, freq='12D')
        ts = pd.Series([0, 12, 24, 36], index)
        new_index = index.append(index + pd.DateOffset(days=1)).sort_values()

        exp = ts.reindex(new_index).interpolate(method='time')

        index = pd.date_range('1/1/2012', periods=4, freq='12H')
        ts = pd.Series([0, 12, 24, 36], index)
        new_index = index.append(index + pd.DateOffset(hours=1)).sort_values()
        result = ts.reindex(new_index).interpolate(method='time')

        tm.assert_numpy_array_equal(result.values, exp.values)
