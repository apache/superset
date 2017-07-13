# -*- coding: utf-8 -*-

from __future__ import print_function


import pytest
import numpy as np

from pandas import (DataFrame, Series, Timestamp, _np_version_under1p11)
import pandas as pd

from pandas.util.testing import assert_series_equal, assert_frame_equal

import pandas.util.testing as tm
from pandas import _np_version_under1p9

from pandas.tests.frame.common import TestData


class TestDataFrameQuantile(TestData):

    def test_quantile(self):
        from numpy import percentile

        q = self.tsframe.quantile(0.1, axis=0)
        assert q['A'] == percentile(self.tsframe['A'], 10)
        tm.assert_index_equal(q.index, self.tsframe.columns)

        q = self.tsframe.quantile(0.9, axis=1)
        assert (q['2000-01-17'] ==
                percentile(self.tsframe.loc['2000-01-17'], 90))
        tm.assert_index_equal(q.index, self.tsframe.index)

        # test degenerate case
        q = DataFrame({'x': [], 'y': []}).quantile(0.1, axis=0)
        assert(np.isnan(q['x']) and np.isnan(q['y']))

        # non-numeric exclusion
        df = DataFrame({'col1': ['A', 'A', 'B', 'B'], 'col2': [1, 2, 3, 4]})
        rs = df.quantile(0.5)
        xp = df.median().rename(0.5)
        assert_series_equal(rs, xp)

        # axis
        df = DataFrame({"A": [1, 2, 3], "B": [2, 3, 4]}, index=[1, 2, 3])
        result = df.quantile(.5, axis=1)
        expected = Series([1.5, 2.5, 3.5], index=[1, 2, 3], name=0.5)
        assert_series_equal(result, expected)

        result = df.quantile([.5, .75], axis=1)
        expected = DataFrame({1: [1.5, 1.75], 2: [2.5, 2.75],
                              3: [3.5, 3.75]}, index=[0.5, 0.75])
        assert_frame_equal(result, expected, check_index_type=True)

        # We may want to break API in the future to change this
        # so that we exclude non-numeric along the same axis
        # See GH #7312
        df = DataFrame([[1, 2, 3],
                        ['a', 'b', 4]])
        result = df.quantile(.5, axis=1)
        expected = Series([3., 4.], index=[0, 1], name=0.5)
        assert_series_equal(result, expected)

    def test_quantile_axis_mixed(self):

        # mixed on axis=1
        df = DataFrame({"A": [1, 2, 3],
                        "B": [2., 3., 4.],
                        "C": pd.date_range('20130101', periods=3),
                        "D": ['foo', 'bar', 'baz']})
        result = df.quantile(.5, axis=1)
        expected = Series([1.5, 2.5, 3.5], name=0.5)
        assert_series_equal(result, expected)

        # must raise
        def f():
            df.quantile(.5, axis=1, numeric_only=False)
        pytest.raises(TypeError, f)

    def test_quantile_axis_parameter(self):
        # GH 9543/9544

        df = DataFrame({"A": [1, 2, 3], "B": [2, 3, 4]}, index=[1, 2, 3])

        result = df.quantile(.5, axis=0)

        expected = Series([2., 3.], index=["A", "B"], name=0.5)
        assert_series_equal(result, expected)

        expected = df.quantile(.5, axis="index")
        assert_series_equal(result, expected)

        result = df.quantile(.5, axis=1)

        expected = Series([1.5, 2.5, 3.5], index=[1, 2, 3], name=0.5)
        assert_series_equal(result, expected)

        result = df.quantile(.5, axis="columns")
        assert_series_equal(result, expected)

        pytest.raises(ValueError, df.quantile, 0.1, axis=-1)
        pytest.raises(ValueError, df.quantile, 0.1, axis="column")

    def test_quantile_interpolation(self):
        # see gh-10174
        if _np_version_under1p9:
            pytest.skip("Numpy version under 1.9")

        from numpy import percentile

        # interpolation = linear (default case)
        q = self.tsframe.quantile(0.1, axis=0, interpolation='linear')
        assert q['A'] == percentile(self.tsframe['A'], 10)
        q = self.intframe.quantile(0.1)
        assert q['A'] == percentile(self.intframe['A'], 10)

        # test with and without interpolation keyword
        q1 = self.intframe.quantile(0.1)
        assert q1['A'] == np.percentile(self.intframe['A'], 10)
        tm.assert_series_equal(q, q1)

        # interpolation method other than default linear
        df = DataFrame({"A": [1, 2, 3], "B": [2, 3, 4]}, index=[1, 2, 3])
        result = df.quantile(.5, axis=1, interpolation='nearest')
        expected = Series([1, 2, 3], index=[1, 2, 3], name=0.5)
        tm.assert_series_equal(result, expected)

        # cross-check interpolation=nearest results in original dtype
        exp = np.percentile(np.array([[1, 2, 3], [2, 3, 4]]), .5,
                            axis=0, interpolation='nearest')
        expected = Series(exp, index=[1, 2, 3], name=0.5, dtype='int64')
        tm.assert_series_equal(result, expected)

        # float
        df = DataFrame({"A": [1., 2., 3.], "B": [2., 3., 4.]}, index=[1, 2, 3])
        result = df.quantile(.5, axis=1, interpolation='nearest')
        expected = Series([1., 2., 3.], index=[1, 2, 3], name=0.5)
        tm.assert_series_equal(result, expected)
        exp = np.percentile(np.array([[1., 2., 3.], [2., 3., 4.]]), .5,
                            axis=0, interpolation='nearest')
        expected = Series(exp, index=[1, 2, 3], name=0.5, dtype='float64')
        assert_series_equal(result, expected)

        # axis
        result = df.quantile([.5, .75], axis=1, interpolation='lower')
        expected = DataFrame({1: [1., 1.], 2: [2., 2.],
                              3: [3., 3.]}, index=[0.5, 0.75])
        assert_frame_equal(result, expected)

        # test degenerate case
        df = DataFrame({'x': [], 'y': []})
        q = df.quantile(0.1, axis=0, interpolation='higher')
        assert(np.isnan(q['x']) and np.isnan(q['y']))

        # multi
        df = DataFrame([[1, 1, 1], [2, 2, 2], [3, 3, 3]],
                       columns=['a', 'b', 'c'])
        result = df.quantile([.25, .5], interpolation='midpoint')

        # https://github.com/numpy/numpy/issues/7163
        if _np_version_under1p11:
            expected = DataFrame([[1.5, 1.5, 1.5], [2.5, 2.5, 2.5]],
                                 index=[.25, .5], columns=['a', 'b', 'c'])
        else:
            expected = DataFrame([[1.5, 1.5, 1.5], [2.0, 2.0, 2.0]],
                                 index=[.25, .5], columns=['a', 'b', 'c'])
        assert_frame_equal(result, expected)

    def test_quantile_interpolation_np_lt_1p9(self):
        # see gh-10174
        if not _np_version_under1p9:
            pytest.skip("Numpy version is greater than 1.9")

        from numpy import percentile

        # interpolation = linear (default case)
        q = self.tsframe.quantile(0.1, axis=0, interpolation='linear')
        assert q['A'] == percentile(self.tsframe['A'], 10)
        q = self.intframe.quantile(0.1)
        assert q['A'] == percentile(self.intframe['A'], 10)

        # test with and without interpolation keyword
        q1 = self.intframe.quantile(0.1)
        assert q1['A'] == np.percentile(self.intframe['A'], 10)
        assert_series_equal(q, q1)

        # interpolation method other than default linear
        msg = "Interpolation methods other than linear"
        df = DataFrame({"A": [1, 2, 3], "B": [2, 3, 4]}, index=[1, 2, 3])
        with tm.assert_raises_regex(ValueError, msg):
            df.quantile(.5, axis=1, interpolation='nearest')

        with tm.assert_raises_regex(ValueError, msg):
            df.quantile([.5, .75], axis=1, interpolation='lower')

        # test degenerate case
        df = DataFrame({'x': [], 'y': []})
        with tm.assert_raises_regex(ValueError, msg):
            q = df.quantile(0.1, axis=0, interpolation='higher')

        # multi
        df = DataFrame([[1, 1, 1], [2, 2, 2], [3, 3, 3]],
                       columns=['a', 'b', 'c'])
        with tm.assert_raises_regex(ValueError, msg):
            df.quantile([.25, .5], interpolation='midpoint')

    def test_quantile_multi(self):
        df = DataFrame([[1, 1, 1], [2, 2, 2], [3, 3, 3]],
                       columns=['a', 'b', 'c'])
        result = df.quantile([.25, .5])
        expected = DataFrame([[1.5, 1.5, 1.5], [2., 2., 2.]],
                             index=[.25, .5], columns=['a', 'b', 'c'])
        assert_frame_equal(result, expected)

        # axis = 1
        result = df.quantile([.25, .5], axis=1)
        expected = DataFrame([[1.5, 1.5, 1.5], [2., 2., 2.]],
                             index=[.25, .5], columns=[0, 1, 2])

        # empty
        result = DataFrame({'x': [], 'y': []}).quantile([0.1, .9], axis=0)
        expected = DataFrame({'x': [np.nan, np.nan], 'y': [np.nan, np.nan]},
                             index=[.1, .9])
        assert_frame_equal(result, expected)

    def test_quantile_datetime(self):
        df = DataFrame({'a': pd.to_datetime(['2010', '2011']), 'b': [0, 5]})

        # exclude datetime
        result = df.quantile(.5)
        expected = Series([2.5], index=['b'])

        # datetime
        result = df.quantile(.5, numeric_only=False)
        expected = Series([Timestamp('2010-07-02 12:00:00'), 2.5],
                          index=['a', 'b'],
                          name=0.5)
        assert_series_equal(result, expected)

        # datetime w/ multi
        result = df.quantile([.5], numeric_only=False)
        expected = DataFrame([[Timestamp('2010-07-02 12:00:00'), 2.5]],
                             index=[.5], columns=['a', 'b'])
        assert_frame_equal(result, expected)

        # axis = 1
        df['c'] = pd.to_datetime(['2011', '2012'])
        result = df[['a', 'c']].quantile(.5, axis=1, numeric_only=False)
        expected = Series([Timestamp('2010-07-02 12:00:00'),
                           Timestamp('2011-07-02 12:00:00')],
                          index=[0, 1],
                          name=0.5)
        assert_series_equal(result, expected)

        result = df[['a', 'c']].quantile([.5], axis=1, numeric_only=False)
        expected = DataFrame([[Timestamp('2010-07-02 12:00:00'),
                               Timestamp('2011-07-02 12:00:00')]],
                             index=[0.5], columns=[0, 1])
        assert_frame_equal(result, expected)

        # empty when numeric_only=True
        # FIXME (gives empty frame in 0.18.1, broken in 0.19.0)
        # result = df[['a', 'c']].quantile(.5)
        # result = df[['a', 'c']].quantile([.5])

    def test_quantile_invalid(self):
        msg = 'percentiles should all be in the interval \\[0, 1\\]'
        for invalid in [-1, 2, [0.5, -1], [0.5, 2]]:
            with tm.assert_raises_regex(ValueError, msg):
                self.tsframe.quantile(invalid)

    def test_quantile_box(self):
        df = DataFrame({'A': [pd.Timestamp('2011-01-01'),
                              pd.Timestamp('2011-01-02'),
                              pd.Timestamp('2011-01-03')],
                        'B': [pd.Timestamp('2011-01-01', tz='US/Eastern'),
                              pd.Timestamp('2011-01-02', tz='US/Eastern'),
                              pd.Timestamp('2011-01-03', tz='US/Eastern')],
                        'C': [pd.Timedelta('1 days'),
                              pd.Timedelta('2 days'),
                              pd.Timedelta('3 days')]})

        res = df.quantile(0.5, numeric_only=False)

        exp = pd.Series([pd.Timestamp('2011-01-02'),
                         pd.Timestamp('2011-01-02', tz='US/Eastern'),
                         pd.Timedelta('2 days')],
                        name=0.5, index=['A', 'B', 'C'])
        tm.assert_series_equal(res, exp)

        res = df.quantile([0.5], numeric_only=False)
        exp = pd.DataFrame([[pd.Timestamp('2011-01-02'),
                             pd.Timestamp('2011-01-02', tz='US/Eastern'),
                             pd.Timedelta('2 days')]],
                           index=[0.5], columns=['A', 'B', 'C'])
        tm.assert_frame_equal(res, exp)

        # DatetimeBlock may be consolidated and contain NaT in different loc
        df = DataFrame({'A': [pd.Timestamp('2011-01-01'),
                              pd.NaT,
                              pd.Timestamp('2011-01-02'),
                              pd.Timestamp('2011-01-03')],
                        'a': [pd.Timestamp('2011-01-01'),
                              pd.Timestamp('2011-01-02'),
                              pd.NaT,
                              pd.Timestamp('2011-01-03')],
                        'B': [pd.Timestamp('2011-01-01', tz='US/Eastern'),
                              pd.NaT,
                              pd.Timestamp('2011-01-02', tz='US/Eastern'),
                              pd.Timestamp('2011-01-03', tz='US/Eastern')],
                        'b': [pd.Timestamp('2011-01-01', tz='US/Eastern'),
                              pd.Timestamp('2011-01-02', tz='US/Eastern'),
                              pd.NaT,
                              pd.Timestamp('2011-01-03', tz='US/Eastern')],
                        'C': [pd.Timedelta('1 days'),
                              pd.Timedelta('2 days'),
                              pd.Timedelta('3 days'),
                              pd.NaT],
                        'c': [pd.NaT,
                              pd.Timedelta('1 days'),
                              pd.Timedelta('2 days'),
                              pd.Timedelta('3 days')]},
                       columns=list('AaBbCc'))

        res = df.quantile(0.5, numeric_only=False)
        exp = pd.Series([pd.Timestamp('2011-01-02'),
                         pd.Timestamp('2011-01-02'),
                         pd.Timestamp('2011-01-02', tz='US/Eastern'),
                         pd.Timestamp('2011-01-02', tz='US/Eastern'),
                         pd.Timedelta('2 days'),
                         pd.Timedelta('2 days')],
                        name=0.5, index=list('AaBbCc'))
        tm.assert_series_equal(res, exp)

        res = df.quantile([0.5], numeric_only=False)
        exp = pd.DataFrame([[pd.Timestamp('2011-01-02'),
                             pd.Timestamp('2011-01-02'),
                             pd.Timestamp('2011-01-02', tz='US/Eastern'),
                             pd.Timestamp('2011-01-02', tz='US/Eastern'),
                             pd.Timedelta('2 days'),
                             pd.Timedelta('2 days')]],
                           index=[0.5], columns=list('AaBbCc'))
        tm.assert_frame_equal(res, exp)

    def test_quantile_nan(self):

        # GH 14357 - float block where some cols have missing values
        df = DataFrame({'a': np.arange(1, 6.0), 'b': np.arange(1, 6.0)})
        df.iloc[-1, 1] = np.nan

        res = df.quantile(0.5)
        exp = Series([3.0, 2.5], index=['a', 'b'], name=0.5)
        tm.assert_series_equal(res, exp)

        res = df.quantile([0.5, 0.75])
        exp = DataFrame({'a': [3.0, 4.0], 'b': [2.5, 3.25]}, index=[0.5, 0.75])
        tm.assert_frame_equal(res, exp)

        res = df.quantile(0.5, axis=1)
        exp = Series(np.arange(1.0, 6.0), name=0.5)
        tm.assert_series_equal(res, exp)

        res = df.quantile([0.5, 0.75], axis=1)
        exp = DataFrame([np.arange(1.0, 6.0)] * 2, index=[0.5, 0.75])
        tm.assert_frame_equal(res, exp)

        # full-nan column
        df['b'] = np.nan

        res = df.quantile(0.5)
        exp = Series([3.0, np.nan], index=['a', 'b'], name=0.5)
        tm.assert_series_equal(res, exp)

        res = df.quantile([0.5, 0.75])
        exp = DataFrame({'a': [3.0, 4.0], 'b': [np.nan, np.nan]},
                        index=[0.5, 0.75])
        tm.assert_frame_equal(res, exp)

    def test_quantile_nat(self):

        # full NaT column
        df = DataFrame({'a': [pd.NaT, pd.NaT, pd.NaT]})

        res = df.quantile(0.5, numeric_only=False)
        exp = Series([pd.NaT], index=['a'], name=0.5)
        tm.assert_series_equal(res, exp)

        res = df.quantile([0.5], numeric_only=False)
        exp = DataFrame({'a': [pd.NaT]}, index=[0.5])
        tm.assert_frame_equal(res, exp)

        # mixed non-null / full null column
        df = DataFrame({'a': [pd.Timestamp('2012-01-01'),
                              pd.Timestamp('2012-01-02'),
                              pd.Timestamp('2012-01-03')],
                        'b': [pd.NaT, pd.NaT, pd.NaT]})

        res = df.quantile(0.5, numeric_only=False)
        exp = Series([pd.Timestamp('2012-01-02'), pd.NaT], index=['a', 'b'],
                     name=0.5)
        tm.assert_series_equal(res, exp)

        res = df.quantile([0.5], numeric_only=False)
        exp = DataFrame([[pd.Timestamp('2012-01-02'), pd.NaT]], index=[0.5],
                        columns=['a', 'b'])
        tm.assert_frame_equal(res, exp)

    def test_quantile_empty(self):

        # floats
        df = DataFrame(columns=['a', 'b'], dtype='float64')

        res = df.quantile(0.5)
        exp = Series([np.nan, np.nan], index=['a', 'b'], name=0.5)
        tm.assert_series_equal(res, exp)

        res = df.quantile([0.5])
        exp = DataFrame([[np.nan, np.nan]], columns=['a', 'b'], index=[0.5])
        tm.assert_frame_equal(res, exp)

        # FIXME (gives empty frame in 0.18.1, broken in 0.19.0)
        # res = df.quantile(0.5, axis=1)
        # res = df.quantile([0.5], axis=1)

        # ints
        df = DataFrame(columns=['a', 'b'], dtype='int64')

        # FIXME (gives empty frame in 0.18.1, broken in 0.19.0)
        # res = df.quantile(0.5)

        # datetimes
        df = DataFrame(columns=['a', 'b'], dtype='datetime64[ns]')

        # FIXME (gives NaNs instead of NaT in 0.18.1 or 0.19.0)
        # res = df.quantile(0.5, numeric_only=False)
