import pytest

import numpy as np

import pandas as pd
from pandas.util import testing as tm
from pandas import (Series, period_range, DatetimeIndex, PeriodIndex,
                    DataFrame, _np_version_under1p12, Period)


class TestPeriodIndex(object):

    def setup_method(self, method):
        pass

    def test_slice_with_negative_step(self):
        ts = Series(np.arange(20),
                    period_range('2014-01', periods=20, freq='M'))
        SLC = pd.IndexSlice

        def assert_slices_equivalent(l_slc, i_slc):
            tm.assert_series_equal(ts[l_slc], ts.iloc[i_slc])
            tm.assert_series_equal(ts.loc[l_slc], ts.iloc[i_slc])
            tm.assert_series_equal(ts.loc[l_slc], ts.iloc[i_slc])

        assert_slices_equivalent(SLC[Period('2014-10')::-1], SLC[9::-1])
        assert_slices_equivalent(SLC['2014-10'::-1], SLC[9::-1])

        assert_slices_equivalent(SLC[:Period('2014-10'):-1], SLC[:8:-1])
        assert_slices_equivalent(SLC[:'2014-10':-1], SLC[:8:-1])

        assert_slices_equivalent(SLC['2015-02':'2014-10':-1], SLC[13:8:-1])
        assert_slices_equivalent(SLC[Period('2015-02'):Period('2014-10'):-1],
                                 SLC[13:8:-1])
        assert_slices_equivalent(SLC['2015-02':Period('2014-10'):-1],
                                 SLC[13:8:-1])
        assert_slices_equivalent(SLC[Period('2015-02'):'2014-10':-1],
                                 SLC[13:8:-1])

        assert_slices_equivalent(SLC['2014-10':'2015-02':-1], SLC[:0])

    def test_slice_with_zero_step_raises(self):
        ts = Series(np.arange(20),
                    period_range('2014-01', periods=20, freq='M'))
        tm.assert_raises_regex(ValueError, 'slice step cannot be zero',
                               lambda: ts[::0])
        tm.assert_raises_regex(ValueError, 'slice step cannot be zero',
                               lambda: ts.loc[::0])
        tm.assert_raises_regex(ValueError, 'slice step cannot be zero',
                               lambda: ts.loc[::0])

    def test_slice_keep_name(self):
        idx = period_range('20010101', periods=10, freq='D', name='bob')
        assert idx.name == idx[1:].name

    def test_pindex_slice_index(self):
        pi = PeriodIndex(start='1/1/10', end='12/31/12', freq='M')
        s = Series(np.random.rand(len(pi)), index=pi)
        res = s['2010']
        exp = s[0:12]
        tm.assert_series_equal(res, exp)
        res = s['2011']
        exp = s[12:24]
        tm.assert_series_equal(res, exp)

    def test_range_slice_day(self):
        # GH 6716
        didx = DatetimeIndex(start='2013/01/01', freq='D', periods=400)
        pidx = PeriodIndex(start='2013/01/01', freq='D', periods=400)

        # changed to TypeError in 1.12
        # https://github.com/numpy/numpy/pull/6271
        exc = IndexError if _np_version_under1p12 else TypeError

        for idx in [didx, pidx]:
            # slices against index should raise IndexError
            values = ['2014', '2013/02', '2013/01/02', '2013/02/01 9H',
                      '2013/02/01 09:00']
            for v in values:
                with pytest.raises(exc):
                    idx[v:]

            s = Series(np.random.rand(len(idx)), index=idx)

            tm.assert_series_equal(s['2013/01/02':], s[1:])
            tm.assert_series_equal(s['2013/01/02':'2013/01/05'], s[1:5])
            tm.assert_series_equal(s['2013/02':], s[31:])
            tm.assert_series_equal(s['2014':], s[365:])

            invalid = ['2013/02/01 9H', '2013/02/01 09:00']
            for v in invalid:
                with pytest.raises(exc):
                    idx[v:]

    def test_range_slice_seconds(self):
        # GH 6716
        didx = DatetimeIndex(start='2013/01/01 09:00:00', freq='S',
                             periods=4000)
        pidx = PeriodIndex(start='2013/01/01 09:00:00', freq='S', periods=4000)

        # changed to TypeError in 1.12
        # https://github.com/numpy/numpy/pull/6271
        exc = IndexError if _np_version_under1p12 else TypeError

        for idx in [didx, pidx]:
            # slices against index should raise IndexError
            values = ['2014', '2013/02', '2013/01/02', '2013/02/01 9H',
                      '2013/02/01 09:00']
            for v in values:
                with pytest.raises(exc):
                    idx[v:]

            s = Series(np.random.rand(len(idx)), index=idx)

            tm.assert_series_equal(s['2013/01/01 09:05':'2013/01/01 09:10'],
                                   s[300:660])
            tm.assert_series_equal(s['2013/01/01 10:00':'2013/01/01 10:05'],
                                   s[3600:3960])
            tm.assert_series_equal(s['2013/01/01 10H':], s[3600:])
            tm.assert_series_equal(s[:'2013/01/01 09:30'], s[:1860])
            for d in ['2013/01/01', '2013/01', '2013']:
                tm.assert_series_equal(s[d:], s)

    def test_range_slice_outofbounds(self):
        # GH 5407
        didx = DatetimeIndex(start='2013/10/01', freq='D', periods=10)
        pidx = PeriodIndex(start='2013/10/01', freq='D', periods=10)

        for idx in [didx, pidx]:
            df = DataFrame(dict(units=[100 + i for i in range(10)]), index=idx)
            empty = DataFrame(index=idx.__class__([], freq='D'),
                              columns=['units'])
            empty['units'] = empty['units'].astype('int64')

            tm.assert_frame_equal(df['2013/09/01':'2013/09/30'], empty)
            tm.assert_frame_equal(df['2013/09/30':'2013/10/02'], df.iloc[:2])
            tm.assert_frame_equal(df['2013/10/01':'2013/10/02'], df.iloc[:2])
            tm.assert_frame_equal(df['2013/10/02':'2013/09/30'], empty)
            tm.assert_frame_equal(df['2013/10/15':'2013/10/17'], empty)
            tm.assert_frame_equal(df['2013-06':'2013-09'], empty)
            tm.assert_frame_equal(df['2013-11':'2013-12'], empty)
