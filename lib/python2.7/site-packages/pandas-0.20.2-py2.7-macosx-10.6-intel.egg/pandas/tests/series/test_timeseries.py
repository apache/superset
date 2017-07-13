# coding=utf-8
# pylint: disable-msg=E1101,W0612

import pytest

import numpy as np
from datetime import datetime, timedelta, time

import pandas as pd
import pandas.util.testing as tm
from pandas._libs.tslib import iNaT
from pandas.compat import lrange, StringIO, product
from pandas.core.indexes.timedeltas import TimedeltaIndex
from pandas.core.indexes.datetimes import DatetimeIndex
from pandas.tseries.offsets import BDay, BMonthEnd
from pandas import (Index, Series, date_range, NaT, concat, DataFrame,
                    Timestamp, to_datetime, offsets,
                    timedelta_range)
from pandas.util.testing import (assert_series_equal, assert_almost_equal,
                                 assert_frame_equal, _skip_if_has_locale)

from pandas.tests.series.common import TestData


def _simple_ts(start, end, freq='D'):
    rng = date_range(start, end, freq=freq)
    return Series(np.random.randn(len(rng)), index=rng)


def assert_range_equal(left, right):
    assert (left.equals(right))
    assert (left.freq == right.freq)
    assert (left.tz == right.tz)


class TestTimeSeries(TestData):

    def test_shift(self):
        shifted = self.ts.shift(1)
        unshifted = shifted.shift(-1)

        tm.assert_index_equal(shifted.index, self.ts.index)
        tm.assert_index_equal(unshifted.index, self.ts.index)
        tm.assert_numpy_array_equal(unshifted.valid().values,
                                    self.ts.values[:-1])

        offset = BDay()
        shifted = self.ts.shift(1, freq=offset)
        unshifted = shifted.shift(-1, freq=offset)

        assert_series_equal(unshifted, self.ts)

        unshifted = self.ts.shift(0, freq=offset)
        assert_series_equal(unshifted, self.ts)

        shifted = self.ts.shift(1, freq='B')
        unshifted = shifted.shift(-1, freq='B')

        assert_series_equal(unshifted, self.ts)

        # corner case
        unshifted = self.ts.shift(0)
        assert_series_equal(unshifted, self.ts)

        # Shifting with PeriodIndex
        ps = tm.makePeriodSeries()
        shifted = ps.shift(1)
        unshifted = shifted.shift(-1)
        tm.assert_index_equal(shifted.index, ps.index)
        tm.assert_index_equal(unshifted.index, ps.index)
        tm.assert_numpy_array_equal(unshifted.valid().values, ps.values[:-1])

        shifted2 = ps.shift(1, 'B')
        shifted3 = ps.shift(1, BDay())
        assert_series_equal(shifted2, shifted3)
        assert_series_equal(ps, shifted2.shift(-1, 'B'))

        pytest.raises(ValueError, ps.shift, freq='D')

        # legacy support
        shifted4 = ps.shift(1, freq='B')
        assert_series_equal(shifted2, shifted4)

        shifted5 = ps.shift(1, freq=BDay())
        assert_series_equal(shifted5, shifted4)

        # 32-bit taking
        # GH 8129
        index = date_range('2000-01-01', periods=5)
        for dtype in ['int32', 'int64']:
            s1 = Series(np.arange(5, dtype=dtype), index=index)
            p = s1.iloc[1]
            result = s1.shift(periods=p)
            expected = Series([np.nan, 0, 1, 2, 3], index=index)
            assert_series_equal(result, expected)

        # xref 8260
        # with tz
        s = Series(date_range('2000-01-01 09:00:00', periods=5,
                              tz='US/Eastern'), name='foo')
        result = s - s.shift()

        exp = Series(TimedeltaIndex(['NaT'] + ['1 days'] * 4), name='foo')
        assert_series_equal(result, exp)

        # incompat tz
        s2 = Series(date_range('2000-01-01 09:00:00', periods=5,
                               tz='CET'), name='foo')
        pytest.raises(ValueError, lambda: s - s2)

    def test_shift2(self):
        ts = Series(np.random.randn(5),
                    index=date_range('1/1/2000', periods=5, freq='H'))

        result = ts.shift(1, freq='5T')
        exp_index = ts.index.shift(1, freq='5T')
        tm.assert_index_equal(result.index, exp_index)

        # GH #1063, multiple of same base
        result = ts.shift(1, freq='4H')
        exp_index = ts.index + offsets.Hour(4)
        tm.assert_index_equal(result.index, exp_index)

        idx = DatetimeIndex(['2000-01-01', '2000-01-02', '2000-01-04'])
        pytest.raises(ValueError, idx.shift, 1)

    def test_shift_dst(self):
        # GH 13926
        dates = date_range('2016-11-06', freq='H', periods=10, tz='US/Eastern')
        s = Series(dates)

        res = s.shift(0)
        tm.assert_series_equal(res, s)
        assert res.dtype == 'datetime64[ns, US/Eastern]'

        res = s.shift(1)
        exp_vals = [NaT] + dates.asobject.values.tolist()[:9]
        exp = Series(exp_vals)
        tm.assert_series_equal(res, exp)
        assert res.dtype == 'datetime64[ns, US/Eastern]'

        res = s.shift(-2)
        exp_vals = dates.asobject.values.tolist()[2:] + [NaT, NaT]
        exp = Series(exp_vals)
        tm.assert_series_equal(res, exp)
        assert res.dtype == 'datetime64[ns, US/Eastern]'

        for ex in [10, -10, 20, -20]:
            res = s.shift(ex)
            exp = Series([NaT] * 10, dtype='datetime64[ns, US/Eastern]')
            tm.assert_series_equal(res, exp)
            assert res.dtype == 'datetime64[ns, US/Eastern]'

    def test_tshift(self):
        # PeriodIndex
        ps = tm.makePeriodSeries()
        shifted = ps.tshift(1)
        unshifted = shifted.tshift(-1)

        assert_series_equal(unshifted, ps)

        shifted2 = ps.tshift(freq='B')
        assert_series_equal(shifted, shifted2)

        shifted3 = ps.tshift(freq=BDay())
        assert_series_equal(shifted, shifted3)

        pytest.raises(ValueError, ps.tshift, freq='M')

        # DatetimeIndex
        shifted = self.ts.tshift(1)
        unshifted = shifted.tshift(-1)

        assert_series_equal(self.ts, unshifted)

        shifted2 = self.ts.tshift(freq=self.ts.index.freq)
        assert_series_equal(shifted, shifted2)

        inferred_ts = Series(self.ts.values, Index(np.asarray(self.ts.index)),
                             name='ts')
        shifted = inferred_ts.tshift(1)
        unshifted = shifted.tshift(-1)
        assert_series_equal(shifted, self.ts.tshift(1))
        assert_series_equal(unshifted, inferred_ts)

        no_freq = self.ts[[0, 5, 7]]
        pytest.raises(ValueError, no_freq.tshift)

    def test_truncate(self):
        offset = BDay()

        ts = self.ts[::3]

        start, end = self.ts.index[3], self.ts.index[6]
        start_missing, end_missing = self.ts.index[2], self.ts.index[7]

        # neither specified
        truncated = ts.truncate()
        assert_series_equal(truncated, ts)

        # both specified
        expected = ts[1:3]

        truncated = ts.truncate(start, end)
        assert_series_equal(truncated, expected)

        truncated = ts.truncate(start_missing, end_missing)
        assert_series_equal(truncated, expected)

        # start specified
        expected = ts[1:]

        truncated = ts.truncate(before=start)
        assert_series_equal(truncated, expected)

        truncated = ts.truncate(before=start_missing)
        assert_series_equal(truncated, expected)

        # end specified
        expected = ts[:3]

        truncated = ts.truncate(after=end)
        assert_series_equal(truncated, expected)

        truncated = ts.truncate(after=end_missing)
        assert_series_equal(truncated, expected)

        # corner case, empty series returned
        truncated = ts.truncate(after=self.ts.index[0] - offset)
        assert (len(truncated) == 0)

        truncated = ts.truncate(before=self.ts.index[-1] + offset)
        assert (len(truncated) == 0)

        pytest.raises(ValueError, ts.truncate,
                      before=self.ts.index[-1] + offset,
                      after=self.ts.index[0] - offset)

    def test_asfreq(self):
        ts = Series([0., 1., 2.], index=[datetime(2009, 10, 30), datetime(
            2009, 11, 30), datetime(2009, 12, 31)])

        daily_ts = ts.asfreq('B')
        monthly_ts = daily_ts.asfreq('BM')
        tm.assert_series_equal(monthly_ts, ts)

        daily_ts = ts.asfreq('B', method='pad')
        monthly_ts = daily_ts.asfreq('BM')
        tm.assert_series_equal(monthly_ts, ts)

        daily_ts = ts.asfreq(BDay())
        monthly_ts = daily_ts.asfreq(BMonthEnd())
        tm.assert_series_equal(monthly_ts, ts)

        result = ts[:0].asfreq('M')
        assert len(result) == 0
        assert result is not ts

        daily_ts = ts.asfreq('D', fill_value=-1)
        result = daily_ts.value_counts().sort_index()
        expected = Series([60, 1, 1, 1],
                          index=[-1.0, 2.0, 1.0, 0.0]).sort_index()
        tm.assert_series_equal(result, expected)

    def test_asfreq_datetimeindex_empty_series(self):
        # GH 14320
        expected = Series(index=pd.DatetimeIndex(
            ["2016-09-29 11:00"])).asfreq('H')
        result = Series(index=pd.DatetimeIndex(["2016-09-29 11:00"]),
                        data=[3]).asfreq('H')
        tm.assert_index_equal(expected.index, result.index)

    def test_diff(self):
        # Just run the function
        self.ts.diff()

        # int dtype
        a = 10000000000000000
        b = a + 1
        s = Series([a, b])

        rs = s.diff()
        assert rs[1] == 1

        # neg n
        rs = self.ts.diff(-1)
        xp = self.ts - self.ts.shift(-1)
        assert_series_equal(rs, xp)

        # 0
        rs = self.ts.diff(0)
        xp = self.ts - self.ts
        assert_series_equal(rs, xp)

        # datetime diff (GH3100)
        s = Series(date_range('20130102', periods=5))
        rs = s - s.shift(1)
        xp = s.diff()
        assert_series_equal(rs, xp)

        # timedelta diff
        nrs = rs - rs.shift(1)
        nxp = xp.diff()
        assert_series_equal(nrs, nxp)

        # with tz
        s = Series(
            date_range('2000-01-01 09:00:00', periods=5,
                       tz='US/Eastern'), name='foo')
        result = s.diff()
        assert_series_equal(result, Series(
            TimedeltaIndex(['NaT'] + ['1 days'] * 4), name='foo'))

    def test_pct_change(self):
        rs = self.ts.pct_change(fill_method=None)
        assert_series_equal(rs, self.ts / self.ts.shift(1) - 1)

        rs = self.ts.pct_change(2)
        filled = self.ts.fillna(method='pad')
        assert_series_equal(rs, filled / filled.shift(2) - 1)

        rs = self.ts.pct_change(fill_method='bfill', limit=1)
        filled = self.ts.fillna(method='bfill', limit=1)
        assert_series_equal(rs, filled / filled.shift(1) - 1)

        rs = self.ts.pct_change(freq='5D')
        filled = self.ts.fillna(method='pad')
        assert_series_equal(rs, filled / filled.shift(freq='5D') - 1)

    def test_pct_change_shift_over_nas(self):
        s = Series([1., 1.5, np.nan, 2.5, 3.])

        chg = s.pct_change()
        expected = Series([np.nan, 0.5, np.nan, 2.5 / 1.5 - 1, .2])
        assert_series_equal(chg, expected)

    def test_autocorr(self):
        # Just run the function
        corr1 = self.ts.autocorr()

        # Now run it with the lag parameter
        corr2 = self.ts.autocorr(lag=1)

        # corr() with lag needs Series of at least length 2
        if len(self.ts) <= 2:
            assert np.isnan(corr1)
            assert np.isnan(corr2)
        else:
            assert corr1 == corr2

        # Choose a random lag between 1 and length of Series - 2
        # and compare the result with the Series corr() function
        n = 1 + np.random.randint(max(1, len(self.ts) - 2))
        corr1 = self.ts.corr(self.ts.shift(n))
        corr2 = self.ts.autocorr(lag=n)

        # corr() with lag needs Series of at least length 2
        if len(self.ts) <= 2:
            assert np.isnan(corr1)
            assert np.isnan(corr2)
        else:
            assert corr1 == corr2

    def test_first_last_valid(self):
        ts = self.ts.copy()
        ts[:5] = np.NaN

        index = ts.first_valid_index()
        assert index == ts.index[5]

        ts[-5:] = np.NaN
        index = ts.last_valid_index()
        assert index == ts.index[-6]

        ts[:] = np.nan
        assert ts.last_valid_index() is None
        assert ts.first_valid_index() is None

        ser = Series([], index=[])
        assert ser.last_valid_index() is None
        assert ser.first_valid_index() is None

        # GH12800
        empty = Series()
        assert empty.last_valid_index() is None
        assert empty.first_valid_index() is None

    def test_mpl_compat_hack(self):
        result = self.ts[:, np.newaxis]
        expected = self.ts.values[:, np.newaxis]
        assert_almost_equal(result, expected)

    def test_timeseries_coercion(self):
        idx = tm.makeDateIndex(10000)
        ser = Series(np.random.randn(len(idx)), idx.astype(object))
        assert ser.index.is_all_dates
        assert isinstance(ser.index, DatetimeIndex)

    def test_empty_series_ops(self):
        # see issue #13844
        a = Series(dtype='M8[ns]')
        b = Series(dtype='m8[ns]')
        assert_series_equal(a, a + b)
        assert_series_equal(a, a - b)
        assert_series_equal(a, b + a)
        pytest.raises(TypeError, lambda x, y: x - y, b, a)

    def test_contiguous_boolean_preserve_freq(self):
        rng = date_range('1/1/2000', '3/1/2000', freq='B')

        mask = np.zeros(len(rng), dtype=bool)
        mask[10:20] = True

        masked = rng[mask]
        expected = rng[10:20]
        assert expected.freq is not None
        assert_range_equal(masked, expected)

        mask[22] = True
        masked = rng[mask]
        assert masked.freq is None

    def test_to_datetime_unit(self):

        epoch = 1370745748
        s = Series([epoch + t for t in range(20)])
        result = to_datetime(s, unit='s')
        expected = Series([Timestamp('2013-06-09 02:42:28') + timedelta(
            seconds=t) for t in range(20)])
        assert_series_equal(result, expected)

        s = Series([epoch + t for t in range(20)]).astype(float)
        result = to_datetime(s, unit='s')
        expected = Series([Timestamp('2013-06-09 02:42:28') + timedelta(
            seconds=t) for t in range(20)])
        assert_series_equal(result, expected)

        s = Series([epoch + t for t in range(20)] + [iNaT])
        result = to_datetime(s, unit='s')
        expected = Series([Timestamp('2013-06-09 02:42:28') + timedelta(
            seconds=t) for t in range(20)] + [NaT])
        assert_series_equal(result, expected)

        s = Series([epoch + t for t in range(20)] + [iNaT]).astype(float)
        result = to_datetime(s, unit='s')
        expected = Series([Timestamp('2013-06-09 02:42:28') + timedelta(
            seconds=t) for t in range(20)] + [NaT])
        assert_series_equal(result, expected)

        # GH13834
        s = Series([epoch + t for t in np.arange(0, 2, .25)] +
                   [iNaT]).astype(float)
        result = to_datetime(s, unit='s')
        expected = Series([Timestamp('2013-06-09 02:42:28') + timedelta(
            seconds=t) for t in np.arange(0, 2, .25)] + [NaT])
        assert_series_equal(result, expected)

        s = concat([Series([epoch + t for t in range(20)]
                           ).astype(float), Series([np.nan])],
                   ignore_index=True)
        result = to_datetime(s, unit='s')
        expected = Series([Timestamp('2013-06-09 02:42:28') + timedelta(
            seconds=t) for t in range(20)] + [NaT])
        assert_series_equal(result, expected)

        result = to_datetime([1, 2, 'NaT', pd.NaT, np.nan], unit='D')
        expected = DatetimeIndex([Timestamp('1970-01-02'),
                                  Timestamp('1970-01-03')] + ['NaT'] * 3)
        tm.assert_index_equal(result, expected)

        with pytest.raises(ValueError):
            to_datetime([1, 2, 'foo'], unit='D')
        with pytest.raises(ValueError):
            to_datetime([1, 2, 111111111], unit='D')

        # coerce we can process
        expected = DatetimeIndex([Timestamp('1970-01-02'),
                                  Timestamp('1970-01-03')] + ['NaT'] * 1)
        result = to_datetime([1, 2, 'foo'], unit='D', errors='coerce')
        tm.assert_index_equal(result, expected)

        result = to_datetime([1, 2, 111111111], unit='D', errors='coerce')
        tm.assert_index_equal(result, expected)

    def test_series_ctor_datetime64(self):
        rng = date_range('1/1/2000 00:00:00', '1/1/2000 1:59:50', freq='10s')
        dates = np.asarray(rng)

        series = Series(dates)
        assert np.issubdtype(series.dtype, np.dtype('M8[ns]'))

    def test_series_repr_nat(self):
        series = Series([0, 1000, 2000, iNaT], dtype='M8[ns]')

        result = repr(series)
        expected = ('0   1970-01-01 00:00:00.000000\n'
                    '1   1970-01-01 00:00:00.000001\n'
                    '2   1970-01-01 00:00:00.000002\n'
                    '3                          NaT\n'
                    'dtype: datetime64[ns]')
        assert result == expected

    def test_asfreq_keep_index_name(self):
        # GH #9854
        index_name = 'bar'
        index = pd.date_range('20130101', periods=20, name=index_name)
        df = pd.DataFrame([x for x in range(20)], columns=['foo'], index=index)

        assert index_name == df.index.name
        assert index_name == df.asfreq('10D').index.name

    def test_promote_datetime_date(self):
        rng = date_range('1/1/2000', periods=20)
        ts = Series(np.random.randn(20), index=rng)

        ts_slice = ts[5:]
        ts2 = ts_slice.copy()
        ts2.index = [x.date() for x in ts2.index]

        result = ts + ts2
        result2 = ts2 + ts
        expected = ts + ts[5:]
        assert_series_equal(result, expected)
        assert_series_equal(result2, expected)

        # test asfreq
        result = ts2.asfreq('4H', method='ffill')
        expected = ts[5:].asfreq('4H', method='ffill')
        assert_series_equal(result, expected)

        result = rng.get_indexer(ts2.index)
        expected = rng.get_indexer(ts_slice.index)
        tm.assert_numpy_array_equal(result, expected)

    def test_asfreq_normalize(self):
        rng = date_range('1/1/2000 09:30', periods=20)
        norm = date_range('1/1/2000', periods=20)
        vals = np.random.randn(20)
        ts = Series(vals, index=rng)

        result = ts.asfreq('D', normalize=True)
        norm = date_range('1/1/2000', periods=20)
        expected = Series(vals, index=norm)

        assert_series_equal(result, expected)

        vals = np.random.randn(20, 3)
        ts = DataFrame(vals, index=rng)

        result = ts.asfreq('D', normalize=True)
        expected = DataFrame(vals, index=norm)

        assert_frame_equal(result, expected)

    def test_first_subset(self):
        ts = _simple_ts('1/1/2000', '1/1/2010', freq='12h')
        result = ts.first('10d')
        assert len(result) == 20

        ts = _simple_ts('1/1/2000', '1/1/2010')
        result = ts.first('10d')
        assert len(result) == 10

        result = ts.first('3M')
        expected = ts[:'3/31/2000']
        assert_series_equal(result, expected)

        result = ts.first('21D')
        expected = ts[:21]
        assert_series_equal(result, expected)

        result = ts[:0].first('3M')
        assert_series_equal(result, ts[:0])

    def test_last_subset(self):
        ts = _simple_ts('1/1/2000', '1/1/2010', freq='12h')
        result = ts.last('10d')
        assert len(result) == 20

        ts = _simple_ts('1/1/2000', '1/1/2010')
        result = ts.last('10d')
        assert len(result) == 10

        result = ts.last('21D')
        expected = ts['12/12/2009':]
        assert_series_equal(result, expected)

        result = ts.last('21D')
        expected = ts[-21:]
        assert_series_equal(result, expected)

        result = ts[:0].last('3M')
        assert_series_equal(result, ts[:0])

    def test_format_pre_1900_dates(self):
        rng = date_range('1/1/1850', '1/1/1950', freq='A-DEC')
        rng.format()
        ts = Series(1, index=rng)
        repr(ts)

    def test_at_time(self):
        rng = date_range('1/1/2000', '1/5/2000', freq='5min')
        ts = Series(np.random.randn(len(rng)), index=rng)
        rs = ts.at_time(rng[1])
        assert (rs.index.hour == rng[1].hour).all()
        assert (rs.index.minute == rng[1].minute).all()
        assert (rs.index.second == rng[1].second).all()

        result = ts.at_time('9:30')
        expected = ts.at_time(time(9, 30))
        assert_series_equal(result, expected)

        df = DataFrame(np.random.randn(len(rng), 3), index=rng)

        result = ts[time(9, 30)]
        result_df = df.loc[time(9, 30)]
        expected = ts[(rng.hour == 9) & (rng.minute == 30)]
        exp_df = df[(rng.hour == 9) & (rng.minute == 30)]

        # expected.index = date_range('1/1/2000', '1/4/2000')

        assert_series_equal(result, expected)
        tm.assert_frame_equal(result_df, exp_df)

        chunk = df.loc['1/4/2000':]
        result = chunk.loc[time(9, 30)]
        expected = result_df[-1:]
        tm.assert_frame_equal(result, expected)

        # midnight, everything
        rng = date_range('1/1/2000', '1/31/2000')
        ts = Series(np.random.randn(len(rng)), index=rng)

        result = ts.at_time(time(0, 0))
        assert_series_equal(result, ts)

        # time doesn't exist
        rng = date_range('1/1/2012', freq='23Min', periods=384)
        ts = Series(np.random.randn(len(rng)), rng)
        rs = ts.at_time('16:00')
        assert len(rs) == 0

    def test_between(self):
        series = Series(date_range('1/1/2000', periods=10))
        left, right = series[[2, 7]]

        result = series.between(left, right)
        expected = (series >= left) & (series <= right)
        assert_series_equal(result, expected)

    def test_between_time(self):
        rng = date_range('1/1/2000', '1/5/2000', freq='5min')
        ts = Series(np.random.randn(len(rng)), index=rng)
        stime = time(0, 0)
        etime = time(1, 0)

        close_open = product([True, False], [True, False])
        for inc_start, inc_end in close_open:
            filtered = ts.between_time(stime, etime, inc_start, inc_end)
            exp_len = 13 * 4 + 1
            if not inc_start:
                exp_len -= 5
            if not inc_end:
                exp_len -= 4

            assert len(filtered) == exp_len
            for rs in filtered.index:
                t = rs.time()
                if inc_start:
                    assert t >= stime
                else:
                    assert t > stime

                if inc_end:
                    assert t <= etime
                else:
                    assert t < etime

        result = ts.between_time('00:00', '01:00')
        expected = ts.between_time(stime, etime)
        assert_series_equal(result, expected)

        # across midnight
        rng = date_range('1/1/2000', '1/5/2000', freq='5min')
        ts = Series(np.random.randn(len(rng)), index=rng)
        stime = time(22, 0)
        etime = time(9, 0)

        close_open = product([True, False], [True, False])
        for inc_start, inc_end in close_open:
            filtered = ts.between_time(stime, etime, inc_start, inc_end)
            exp_len = (12 * 11 + 1) * 4 + 1
            if not inc_start:
                exp_len -= 4
            if not inc_end:
                exp_len -= 4

            assert len(filtered) == exp_len
            for rs in filtered.index:
                t = rs.time()
                if inc_start:
                    assert (t >= stime) or (t <= etime)
                else:
                    assert (t > stime) or (t <= etime)

                if inc_end:
                    assert (t <= etime) or (t >= stime)
                else:
                    assert (t < etime) or (t >= stime)

    def test_between_time_types(self):
        # GH11818
        rng = date_range('1/1/2000', '1/5/2000', freq='5min')
        pytest.raises(ValueError, rng.indexer_between_time,
                      datetime(2010, 1, 2, 1), datetime(2010, 1, 2, 5))

        frame = DataFrame({'A': 0}, index=rng)
        pytest.raises(ValueError, frame.between_time,
                      datetime(2010, 1, 2, 1), datetime(2010, 1, 2, 5))

        series = Series(0, index=rng)
        pytest.raises(ValueError, series.between_time,
                      datetime(2010, 1, 2, 1), datetime(2010, 1, 2, 5))

    def test_between_time_formats(self):
        # GH11818
        _skip_if_has_locale()

        rng = date_range('1/1/2000', '1/5/2000', freq='5min')
        ts = DataFrame(np.random.randn(len(rng), 2), index=rng)

        strings = [("2:00", "2:30"), ("0200", "0230"), ("2:00am", "2:30am"),
                   ("0200am", "0230am"), ("2:00:00", "2:30:00"),
                   ("020000", "023000"), ("2:00:00am", "2:30:00am"),
                   ("020000am", "023000am")]
        expected_length = 28

        for time_string in strings:
            assert len(ts.between_time(*time_string)) == expected_length

    def test_to_period(self):
        from pandas.core.indexes.period import period_range

        ts = _simple_ts('1/1/2000', '1/1/2001')

        pts = ts.to_period()
        exp = ts.copy()
        exp.index = period_range('1/1/2000', '1/1/2001')
        assert_series_equal(pts, exp)

        pts = ts.to_period('M')
        exp.index = exp.index.asfreq('M')
        tm.assert_index_equal(pts.index, exp.index.asfreq('M'))
        assert_series_equal(pts, exp)

        # GH 7606 without freq
        idx = DatetimeIndex(['2011-01-01', '2011-01-02', '2011-01-03',
                             '2011-01-04'])
        exp_idx = pd.PeriodIndex(['2011-01-01', '2011-01-02', '2011-01-03',
                                  '2011-01-04'], freq='D')

        s = Series(np.random.randn(4), index=idx)
        expected = s.copy()
        expected.index = exp_idx
        assert_series_equal(s.to_period(), expected)

        df = DataFrame(np.random.randn(4, 4), index=idx, columns=idx)
        expected = df.copy()
        expected.index = exp_idx
        assert_frame_equal(df.to_period(), expected)

        expected = df.copy()
        expected.columns = exp_idx
        assert_frame_equal(df.to_period(axis=1), expected)

    def test_groupby_count_dateparseerror(self):
        dr = date_range(start='1/1/2012', freq='5min', periods=10)

        # BAD Example, datetimes first
        s = Series(np.arange(10), index=[dr, lrange(10)])
        grouped = s.groupby(lambda x: x[1] % 2 == 0)
        result = grouped.count()

        s = Series(np.arange(10), index=[lrange(10), dr])
        grouped = s.groupby(lambda x: x[0] % 2 == 0)
        expected = grouped.count()

        assert_series_equal(result, expected)

    def test_to_csv_numpy_16_bug(self):
        frame = DataFrame({'a': date_range('1/1/2000', periods=10)})

        buf = StringIO()
        frame.to_csv(buf)

        result = buf.getvalue()
        assert '2000-01-01' in result

    def test_series_map_box_timedelta(self):
        # GH 11349
        s = Series(timedelta_range('1 day 1 s', periods=5, freq='h'))

        def f(x):
            return x.total_seconds()

        s.map(f)
        s.apply(f)
        DataFrame(s).applymap(f)

    def test_asfreq_resample_set_correct_freq(self):
        # GH5613
        # we test if .asfreq() and .resample() set the correct value for .freq
        df = pd.DataFrame({'date': ["2012-01-01", "2012-01-02", "2012-01-03"],
                           'col': [1, 2, 3]})
        df = df.set_index(pd.to_datetime(df.date))

        # testing the settings before calling .asfreq() and .resample()
        assert df.index.freq is None
        assert df.index.inferred_freq == 'D'

        # does .asfreq() set .freq correctly?
        assert df.asfreq('D').index.freq == 'D'

        # does .resample() set .freq correctly?
        assert df.resample('D').asfreq().index.freq == 'D'

    def test_pickle(self):

        # GH4606
        p = tm.round_trip_pickle(NaT)
        assert p is NaT

        idx = pd.to_datetime(['2013-01-01', NaT, '2014-01-06'])
        idx_p = tm.round_trip_pickle(idx)
        assert idx_p[0] == idx[0]
        assert idx_p[1] is NaT
        assert idx_p[2] == idx[2]

        # GH11002
        # don't infer freq
        idx = date_range('1750-1-1', '2050-1-1', freq='7D')
        idx_p = tm.round_trip_pickle(idx)
        tm.assert_index_equal(idx, idx_p)

    def test_setops_preserve_freq(self):
        for tz in [None, 'Asia/Tokyo', 'US/Eastern']:
            rng = date_range('1/1/2000', '1/1/2002', name='idx', tz=tz)

            result = rng[:50].union(rng[50:100])
            assert result.name == rng.name
            assert result.freq == rng.freq
            assert result.tz == rng.tz

            result = rng[:50].union(rng[30:100])
            assert result.name == rng.name
            assert result.freq == rng.freq
            assert result.tz == rng.tz

            result = rng[:50].union(rng[60:100])
            assert result.name == rng.name
            assert result.freq is None
            assert result.tz == rng.tz

            result = rng[:50].intersection(rng[25:75])
            assert result.name == rng.name
            assert result.freqstr == 'D'
            assert result.tz == rng.tz

            nofreq = DatetimeIndex(list(rng[25:75]), name='other')
            result = rng[:50].union(nofreq)
            assert result.name is None
            assert result.freq == rng.freq
            assert result.tz == rng.tz

            result = rng[:50].intersection(nofreq)
            assert result.name is None
            assert result.freq == rng.freq
            assert result.tz == rng.tz

    def test_min_max(self):
        rng = date_range('1/1/2000', '12/31/2000')
        rng2 = rng.take(np.random.permutation(len(rng)))

        the_min = rng2.min()
        the_max = rng2.max()
        assert isinstance(the_min, Timestamp)
        assert isinstance(the_max, Timestamp)
        assert the_min == rng[0]
        assert the_max == rng[-1]

        assert rng.min() == rng[0]
        assert rng.max() == rng[-1]

    def test_min_max_series(self):
        rng = date_range('1/1/2000', periods=10, freq='4h')
        lvls = ['A', 'A', 'A', 'B', 'B', 'B', 'C', 'C', 'C', 'C']
        df = DataFrame({'TS': rng, 'V': np.random.randn(len(rng)), 'L': lvls})

        result = df.TS.max()
        exp = Timestamp(df.TS.iat[-1])
        assert isinstance(result, Timestamp)
        assert result == exp

        result = df.TS.min()
        exp = Timestamp(df.TS.iat[0])
        assert isinstance(result, Timestamp)
        assert result == exp

    def test_from_M8_structured(self):
        dates = [(datetime(2012, 9, 9, 0, 0), datetime(2012, 9, 8, 15, 10))]
        arr = np.array(dates,
                       dtype=[('Date', 'M8[us]'), ('Forecasting', 'M8[us]')])
        df = DataFrame(arr)

        assert df['Date'][0] == dates[0][0]
        assert df['Forecasting'][0] == dates[0][1]

        s = Series(arr['Date'])
        assert s[0], Timestamp
        assert s[0] == dates[0][0]

        s = Series.from_array(arr['Date'], Index([0]))
        assert s[0] == dates[0][0]

    def test_get_level_values_box(self):
        from pandas import MultiIndex

        dates = date_range('1/1/2000', periods=4)
        levels = [dates, [0, 1]]
        labels = [[0, 0, 1, 1, 2, 2, 3, 3], [0, 1, 0, 1, 0, 1, 0, 1]]

        index = MultiIndex(levels=levels, labels=labels)

        assert isinstance(index.get_level_values(0)[0], Timestamp)
