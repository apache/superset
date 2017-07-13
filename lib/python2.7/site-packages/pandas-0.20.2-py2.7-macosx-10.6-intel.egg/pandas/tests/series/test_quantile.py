# coding=utf-8
# pylint: disable-msg=E1101,W0612

import pytest
import numpy as np
import pandas as pd

from pandas import (Index, Series, _np_version_under1p9)
from pandas.core.indexes.datetimes import Timestamp
from pandas.core.dtypes.common import is_integer
import pandas.util.testing as tm

from .common import TestData


class TestSeriesQuantile(TestData):

    def test_quantile(self):

        q = self.ts.quantile(0.1)
        assert q == np.percentile(self.ts.valid(), 10)

        q = self.ts.quantile(0.9)
        assert q == np.percentile(self.ts.valid(), 90)

        # object dtype
        q = Series(self.ts, dtype=object).quantile(0.9)
        assert q == np.percentile(self.ts.valid(), 90)

        # datetime64[ns] dtype
        dts = self.ts.index.to_series()
        q = dts.quantile(.2)
        assert q == Timestamp('2000-01-10 19:12:00')

        # timedelta64[ns] dtype
        tds = dts.diff()
        q = tds.quantile(.25)
        assert q == pd.to_timedelta('24:00:00')

        # GH7661
        result = Series([np.timedelta64('NaT')]).sum()
        assert result is pd.NaT

        msg = 'percentiles should all be in the interval \\[0, 1\\]'
        for invalid in [-1, 2, [0.5, -1], [0.5, 2]]:
            with tm.assert_raises_regex(ValueError, msg):
                self.ts.quantile(invalid)

    def test_quantile_multi(self):

        qs = [.1, .9]
        result = self.ts.quantile(qs)
        expected = pd.Series([np.percentile(self.ts.valid(), 10),
                              np.percentile(self.ts.valid(), 90)],
                             index=qs, name=self.ts.name)
        tm.assert_series_equal(result, expected)

        dts = self.ts.index.to_series()
        dts.name = 'xxx'
        result = dts.quantile((.2, .2))
        expected = Series([Timestamp('2000-01-10 19:12:00'),
                           Timestamp('2000-01-10 19:12:00')],
                          index=[.2, .2], name='xxx')
        tm.assert_series_equal(result, expected)

        result = self.ts.quantile([])
        expected = pd.Series([], name=self.ts.name, index=Index(
            [], dtype=float))
        tm.assert_series_equal(result, expected)

    @pytest.mark.skipif(_np_version_under1p9,
                        reason="Numpy version is under 1.9")
    def test_quantile_interpolation(self):
        # see gh-10174

        # interpolation = linear (default case)
        q = self.ts.quantile(0.1, interpolation='linear')
        assert q == np.percentile(self.ts.valid(), 10)
        q1 = self.ts.quantile(0.1)
        assert q1 == np.percentile(self.ts.valid(), 10)

        # test with and without interpolation keyword
        assert q == q1

    @pytest.mark.skipif(_np_version_under1p9,
                        reason="Numpy version is under 1.9")
    def test_quantile_interpolation_dtype(self):
        # GH #10174

        # interpolation = linear (default case)
        q = pd.Series([1, 3, 4]).quantile(0.5, interpolation='lower')
        assert q == np.percentile(np.array([1, 3, 4]), 50)
        assert is_integer(q)

        q = pd.Series([1, 3, 4]).quantile(0.5, interpolation='higher')
        assert q == np.percentile(np.array([1, 3, 4]), 50)
        assert is_integer(q)

    @pytest.mark.skipif(not _np_version_under1p9,
                        reason="Numpy version is greater 1.9")
    def test_quantile_interpolation_np_lt_1p9(self):
        # GH #10174

        # interpolation = linear (default case)
        q = self.ts.quantile(0.1, interpolation='linear')
        assert q == np.percentile(self.ts.valid(), 10)
        q1 = self.ts.quantile(0.1)
        assert q1 == np.percentile(self.ts.valid(), 10)

        # interpolation other than linear
        msg = "Interpolation methods other than "
        with tm.assert_raises_regex(ValueError, msg):
            self.ts.quantile(0.9, interpolation='nearest')

        # object dtype
        with tm.assert_raises_regex(ValueError, msg):
            Series(self.ts, dtype=object).quantile(0.7, interpolation='higher')

    def test_quantile_nan(self):

        # GH 13098
        s = pd.Series([1, 2, 3, 4, np.nan])
        result = s.quantile(0.5)
        expected = 2.5
        assert result == expected

        # all nan/empty
        cases = [Series([]), Series([np.nan, np.nan])]

        for s in cases:
            res = s.quantile(0.5)
            assert np.isnan(res)

            res = s.quantile([0.5])
            tm.assert_series_equal(res, pd.Series([np.nan], index=[0.5]))

            res = s.quantile([0.2, 0.3])
            tm.assert_series_equal(res, pd.Series([np.nan, np.nan],
                                                  index=[0.2, 0.3]))

    def test_quantile_box(self):
        cases = [[pd.Timestamp('2011-01-01'), pd.Timestamp('2011-01-02'),
                  pd.Timestamp('2011-01-03')],
                 [pd.Timestamp('2011-01-01', tz='US/Eastern'),
                  pd.Timestamp('2011-01-02', tz='US/Eastern'),
                  pd.Timestamp('2011-01-03', tz='US/Eastern')],
                 [pd.Timedelta('1 days'), pd.Timedelta('2 days'),
                  pd.Timedelta('3 days')],
                 # NaT
                 [pd.Timestamp('2011-01-01'), pd.Timestamp('2011-01-02'),
                  pd.Timestamp('2011-01-03'), pd.NaT],
                 [pd.Timestamp('2011-01-01', tz='US/Eastern'),
                  pd.Timestamp('2011-01-02', tz='US/Eastern'),
                  pd.Timestamp('2011-01-03', tz='US/Eastern'), pd.NaT],
                 [pd.Timedelta('1 days'), pd.Timedelta('2 days'),
                  pd.Timedelta('3 days'), pd.NaT]]

        for case in cases:
            s = pd.Series(case, name='XXX')
            res = s.quantile(0.5)
            assert res == case[1]

            res = s.quantile([0.5])
            exp = pd.Series([case[1]], index=[0.5], name='XXX')
            tm.assert_series_equal(res, exp)

    def test_datetime_timedelta_quantiles(self):
        # covers #9694
        assert pd.isnull(Series([], dtype='M8[ns]').quantile(.5))
        assert pd.isnull(Series([], dtype='m8[ns]').quantile(.5))

    def test_quantile_nat(self):
        res = Series([pd.NaT, pd.NaT]).quantile(0.5)
        assert res is pd.NaT

        res = Series([pd.NaT, pd.NaT]).quantile([0.5])
        tm.assert_series_equal(res, pd.Series([pd.NaT], index=[0.5]))

    def test_quantile_empty(self):

        # floats
        s = Series([], dtype='float64')

        res = s.quantile(0.5)
        assert np.isnan(res)

        res = s.quantile([0.5])
        exp = Series([np.nan], index=[0.5])
        tm.assert_series_equal(res, exp)

        # int
        s = Series([], dtype='int64')

        res = s.quantile(0.5)
        assert np.isnan(res)

        res = s.quantile([0.5])
        exp = Series([np.nan], index=[0.5])
        tm.assert_series_equal(res, exp)

        # datetime
        s = Series([], dtype='datetime64[ns]')

        res = s.quantile(0.5)
        assert res is pd.NaT

        res = s.quantile([0.5])
        exp = Series([pd.NaT], index=[0.5])
        tm.assert_series_equal(res, exp)
