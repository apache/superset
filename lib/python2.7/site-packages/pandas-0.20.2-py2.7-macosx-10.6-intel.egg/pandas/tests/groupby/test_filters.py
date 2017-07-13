# -*- coding: utf-8 -*-
from __future__ import print_function
from numpy import nan

import pytest

from pandas import Timestamp
from pandas.core.index import MultiIndex
from pandas.core.api import DataFrame

from pandas.core.series import Series

from pandas.util.testing import (assert_frame_equal, assert_series_equal
                                 )
from pandas.compat import (lmap)

from pandas import compat

import pandas.core.common as com
import numpy as np

import pandas.util.testing as tm
import pandas as pd


class TestGroupByFilter(object):

    def setup_method(self, method):
        self.ts = tm.makeTimeSeries()

        self.seriesd = tm.getSeriesData()
        self.tsd = tm.getTimeSeriesData()
        self.frame = DataFrame(self.seriesd)
        self.tsframe = DataFrame(self.tsd)

        self.df = DataFrame(
            {'A': ['foo', 'bar', 'foo', 'bar', 'foo', 'bar', 'foo', 'foo'],
             'B': ['one', 'one', 'two', 'three', 'two', 'two', 'one', 'three'],
             'C': np.random.randn(8),
             'D': np.random.randn(8)})

        self.df_mixed_floats = DataFrame(
            {'A': ['foo', 'bar', 'foo', 'bar', 'foo', 'bar', 'foo', 'foo'],
             'B': ['one', 'one', 'two', 'three', 'two', 'two', 'one', 'three'],
             'C': np.random.randn(8),
             'D': np.array(
                 np.random.randn(8), dtype='float32')})

        index = MultiIndex(levels=[['foo', 'bar', 'baz', 'qux'], ['one', 'two',
                                                                  'three']],
                           labels=[[0, 0, 0, 1, 1, 2, 2, 3, 3, 3],
                                   [0, 1, 2, 0, 1, 1, 2, 0, 1, 2]],
                           names=['first', 'second'])
        self.mframe = DataFrame(np.random.randn(10, 3), index=index,
                                columns=['A', 'B', 'C'])

        self.three_group = DataFrame(
            {'A': ['foo', 'foo', 'foo', 'foo', 'bar', 'bar', 'bar', 'bar',
                   'foo', 'foo', 'foo'],
             'B': ['one', 'one', 'one', 'two', 'one', 'one', 'one', 'two',
                   'two', 'two', 'one'],
             'C': ['dull', 'dull', 'shiny', 'dull', 'dull', 'shiny', 'shiny',
                   'dull', 'shiny', 'shiny', 'shiny'],
             'D': np.random.randn(11),
             'E': np.random.randn(11),
             'F': np.random.randn(11)})

    def test_filter_series(self):
        s = pd.Series([1, 3, 20, 5, 22, 24, 7])
        expected_odd = pd.Series([1, 3, 5, 7], index=[0, 1, 3, 6])
        expected_even = pd.Series([20, 22, 24], index=[2, 4, 5])
        grouper = s.apply(lambda x: x % 2)
        grouped = s.groupby(grouper)
        assert_series_equal(
            grouped.filter(lambda x: x.mean() < 10), expected_odd)
        assert_series_equal(
            grouped.filter(lambda x: x.mean() > 10), expected_even)
        # Test dropna=False.
        assert_series_equal(
            grouped.filter(lambda x: x.mean() < 10, dropna=False),
            expected_odd.reindex(s.index))
        assert_series_equal(
            grouped.filter(lambda x: x.mean() > 10, dropna=False),
            expected_even.reindex(s.index))

    def test_filter_single_column_df(self):
        df = pd.DataFrame([1, 3, 20, 5, 22, 24, 7])
        expected_odd = pd.DataFrame([1, 3, 5, 7], index=[0, 1, 3, 6])
        expected_even = pd.DataFrame([20, 22, 24], index=[2, 4, 5])
        grouper = df[0].apply(lambda x: x % 2)
        grouped = df.groupby(grouper)
        assert_frame_equal(
            grouped.filter(lambda x: x.mean() < 10), expected_odd)
        assert_frame_equal(
            grouped.filter(lambda x: x.mean() > 10), expected_even)
        # Test dropna=False.
        assert_frame_equal(
            grouped.filter(lambda x: x.mean() < 10, dropna=False),
            expected_odd.reindex(df.index))
        assert_frame_equal(
            grouped.filter(lambda x: x.mean() > 10, dropna=False),
            expected_even.reindex(df.index))

    def test_filter_multi_column_df(self):
        df = pd.DataFrame({'A': [1, 12, 12, 1], 'B': [1, 1, 1, 1]})
        grouper = df['A'].apply(lambda x: x % 2)
        grouped = df.groupby(grouper)
        expected = pd.DataFrame({'A': [12, 12], 'B': [1, 1]}, index=[1, 2])
        assert_frame_equal(
            grouped.filter(lambda x: x['A'].sum() - x['B'].sum() > 10),
            expected)

    def test_filter_mixed_df(self):
        df = pd.DataFrame({'A': [1, 12, 12, 1], 'B': 'a b c d'.split()})
        grouper = df['A'].apply(lambda x: x % 2)
        grouped = df.groupby(grouper)
        expected = pd.DataFrame({'A': [12, 12], 'B': ['b', 'c']}, index=[1, 2])
        assert_frame_equal(
            grouped.filter(lambda x: x['A'].sum() > 10), expected)

    def test_filter_out_all_groups(self):
        s = pd.Series([1, 3, 20, 5, 22, 24, 7])
        grouper = s.apply(lambda x: x % 2)
        grouped = s.groupby(grouper)
        assert_series_equal(grouped.filter(lambda x: x.mean() > 1000), s[[]])
        df = pd.DataFrame({'A': [1, 12, 12, 1], 'B': 'a b c d'.split()})
        grouper = df['A'].apply(lambda x: x % 2)
        grouped = df.groupby(grouper)
        assert_frame_equal(
            grouped.filter(lambda x: x['A'].sum() > 1000), df.loc[[]])

    def test_filter_out_no_groups(self):
        s = pd.Series([1, 3, 20, 5, 22, 24, 7])
        grouper = s.apply(lambda x: x % 2)
        grouped = s.groupby(grouper)
        filtered = grouped.filter(lambda x: x.mean() > 0)
        assert_series_equal(filtered, s)
        df = pd.DataFrame({'A': [1, 12, 12, 1], 'B': 'a b c d'.split()})
        grouper = df['A'].apply(lambda x: x % 2)
        grouped = df.groupby(grouper)
        filtered = grouped.filter(lambda x: x['A'].mean() > 0)
        assert_frame_equal(filtered, df)

    def test_filter_out_all_groups_in_df(self):
        # GH12768
        df = pd.DataFrame({'a': [1, 1, 2], 'b': [1, 2, 0]})
        res = df.groupby('a')
        res = res.filter(lambda x: x['b'].sum() > 5, dropna=False)
        expected = pd.DataFrame({'a': [nan] * 3, 'b': [nan] * 3})
        assert_frame_equal(expected, res)

        df = pd.DataFrame({'a': [1, 1, 2], 'b': [1, 2, 0]})
        res = df.groupby('a')
        res = res.filter(lambda x: x['b'].sum() > 5, dropna=True)
        expected = pd.DataFrame({'a': [], 'b': []}, dtype="int64")
        assert_frame_equal(expected, res)

    def test_filter_condition_raises(self):
        def raise_if_sum_is_zero(x):
            if x.sum() == 0:
                raise ValueError
            else:
                return x.sum() > 0

        s = pd.Series([-1, 0, 1, 2])
        grouper = s.apply(lambda x: x % 2)
        grouped = s.groupby(grouper)
        pytest.raises(TypeError,
                      lambda: grouped.filter(raise_if_sum_is_zero))

    def test_filter_with_axis_in_groupby(self):
        # issue 11041
        index = pd.MultiIndex.from_product([range(10), [0, 1]])
        data = pd.DataFrame(
            np.arange(100).reshape(-1, 20), columns=index, dtype='int64')
        result = data.groupby(level=0,
                              axis=1).filter(lambda x: x.iloc[0, 0] > 10)
        expected = data.iloc[:, 12:20]
        assert_frame_equal(result, expected)

    def test_filter_bad_shapes(self):
        df = DataFrame({'A': np.arange(8),
                        'B': list('aabbbbcc'),
                        'C': np.arange(8)})
        s = df['B']
        g_df = df.groupby('B')
        g_s = s.groupby(s)

        f = lambda x: x
        pytest.raises(TypeError, lambda: g_df.filter(f))
        pytest.raises(TypeError, lambda: g_s.filter(f))

        f = lambda x: x == 1
        pytest.raises(TypeError, lambda: g_df.filter(f))
        pytest.raises(TypeError, lambda: g_s.filter(f))

        f = lambda x: np.outer(x, x)
        pytest.raises(TypeError, lambda: g_df.filter(f))
        pytest.raises(TypeError, lambda: g_s.filter(f))

    def test_filter_nan_is_false(self):
        df = DataFrame({'A': np.arange(8),
                        'B': list('aabbbbcc'),
                        'C': np.arange(8)})
        s = df['B']
        g_df = df.groupby(df['B'])
        g_s = s.groupby(s)

        f = lambda x: np.nan
        assert_frame_equal(g_df.filter(f), df.loc[[]])
        assert_series_equal(g_s.filter(f), s[[]])

    def test_filter_against_workaround(self):
        np.random.seed(0)
        # Series of ints
        s = Series(np.random.randint(0, 100, 1000))
        grouper = s.apply(lambda x: np.round(x, -1))
        grouped = s.groupby(grouper)
        f = lambda x: x.mean() > 10

        old_way = s[grouped.transform(f).astype('bool')]
        new_way = grouped.filter(f)
        assert_series_equal(new_way.sort_values(), old_way.sort_values())

        # Series of floats
        s = 100 * Series(np.random.random(1000))
        grouper = s.apply(lambda x: np.round(x, -1))
        grouped = s.groupby(grouper)
        f = lambda x: x.mean() > 10
        old_way = s[grouped.transform(f).astype('bool')]
        new_way = grouped.filter(f)
        assert_series_equal(new_way.sort_values(), old_way.sort_values())

        # Set up DataFrame of ints, floats, strings.
        from string import ascii_lowercase
        letters = np.array(list(ascii_lowercase))
        N = 1000
        random_letters = letters.take(np.random.randint(0, 26, N))
        df = DataFrame({'ints': Series(np.random.randint(0, 100, N)),
                        'floats': N / 10 * Series(np.random.random(N)),
                        'letters': Series(random_letters)})

        # Group by ints; filter on floats.
        grouped = df.groupby('ints')
        old_way = df[grouped.floats.
                     transform(lambda x: x.mean() > N / 20).astype('bool')]
        new_way = grouped.filter(lambda x: x['floats'].mean() > N / 20)
        assert_frame_equal(new_way, old_way)

        # Group by floats (rounded); filter on strings.
        grouper = df.floats.apply(lambda x: np.round(x, -1))
        grouped = df.groupby(grouper)
        old_way = df[grouped.letters.
                     transform(lambda x: len(x) < N / 10).astype('bool')]
        new_way = grouped.filter(lambda x: len(x.letters) < N / 10)
        assert_frame_equal(new_way, old_way)

        # Group by strings; filter on ints.
        grouped = df.groupby('letters')
        old_way = df[grouped.ints.
                     transform(lambda x: x.mean() > N / 20).astype('bool')]
        new_way = grouped.filter(lambda x: x['ints'].mean() > N / 20)
        assert_frame_equal(new_way, old_way)

    def test_filter_using_len(self):
        # BUG GH4447
        df = DataFrame({'A': np.arange(8),
                        'B': list('aabbbbcc'),
                        'C': np.arange(8)})
        grouped = df.groupby('B')
        actual = grouped.filter(lambda x: len(x) > 2)
        expected = DataFrame(
            {'A': np.arange(2, 6),
             'B': list('bbbb'),
             'C': np.arange(2, 6)}, index=np.arange(2, 6))
        assert_frame_equal(actual, expected)

        actual = grouped.filter(lambda x: len(x) > 4)
        expected = df.loc[[]]
        assert_frame_equal(actual, expected)

        # Series have always worked properly, but we'll test anyway.
        s = df['B']
        grouped = s.groupby(s)
        actual = grouped.filter(lambda x: len(x) > 2)
        expected = Series(4 * ['b'], index=np.arange(2, 6), name='B')
        assert_series_equal(actual, expected)

        actual = grouped.filter(lambda x: len(x) > 4)
        expected = s[[]]
        assert_series_equal(actual, expected)

    def test_filter_maintains_ordering(self):
        # Simple case: index is sequential. #4621
        df = DataFrame({'pid': [1, 1, 1, 2, 2, 3, 3, 3],
                        'tag': [23, 45, 62, 24, 45, 34, 25, 62]})
        s = df['pid']
        grouped = df.groupby('tag')
        actual = grouped.filter(lambda x: len(x) > 1)
        expected = df.iloc[[1, 2, 4, 7]]
        assert_frame_equal(actual, expected)

        grouped = s.groupby(df['tag'])
        actual = grouped.filter(lambda x: len(x) > 1)
        expected = s.iloc[[1, 2, 4, 7]]
        assert_series_equal(actual, expected)

        # Now index is sequentially decreasing.
        df.index = np.arange(len(df) - 1, -1, -1)
        s = df['pid']
        grouped = df.groupby('tag')
        actual = grouped.filter(lambda x: len(x) > 1)
        expected = df.iloc[[1, 2, 4, 7]]
        assert_frame_equal(actual, expected)

        grouped = s.groupby(df['tag'])
        actual = grouped.filter(lambda x: len(x) > 1)
        expected = s.iloc[[1, 2, 4, 7]]
        assert_series_equal(actual, expected)

        # Index is shuffled.
        SHUFFLED = [4, 6, 7, 2, 1, 0, 5, 3]
        df.index = df.index[SHUFFLED]
        s = df['pid']
        grouped = df.groupby('tag')
        actual = grouped.filter(lambda x: len(x) > 1)
        expected = df.iloc[[1, 2, 4, 7]]
        assert_frame_equal(actual, expected)

        grouped = s.groupby(df['tag'])
        actual = grouped.filter(lambda x: len(x) > 1)
        expected = s.iloc[[1, 2, 4, 7]]
        assert_series_equal(actual, expected)

    def test_filter_multiple_timestamp(self):
        # GH 10114
        df = DataFrame({'A': np.arange(5, dtype='int64'),
                        'B': ['foo', 'bar', 'foo', 'bar', 'bar'],
                        'C': Timestamp('20130101')})

        grouped = df.groupby(['B', 'C'])

        result = grouped['A'].filter(lambda x: True)
        assert_series_equal(df['A'], result)

        result = grouped['A'].transform(len)
        expected = Series([2, 3, 2, 3, 3], name='A')
        assert_series_equal(result, expected)

        result = grouped.filter(lambda x: True)
        assert_frame_equal(df, result)

        result = grouped.transform('sum')
        expected = DataFrame({'A': [2, 8, 2, 8, 8]})
        assert_frame_equal(result, expected)

        result = grouped.transform(len)
        expected = DataFrame({'A': [2, 3, 2, 3, 3]})
        assert_frame_equal(result, expected)

    def test_filter_and_transform_with_non_unique_int_index(self):
        # GH4620
        index = [1, 1, 1, 2, 1, 1, 0, 1]
        df = DataFrame({'pid': [1, 1, 1, 2, 2, 3, 3, 3],
                        'tag': [23, 45, 62, 24, 45, 34, 25, 62]}, index=index)
        grouped_df = df.groupby('tag')
        ser = df['pid']
        grouped_ser = ser.groupby(df['tag'])
        expected_indexes = [1, 2, 4, 7]

        # Filter DataFrame
        actual = grouped_df.filter(lambda x: len(x) > 1)
        expected = df.iloc[expected_indexes]
        assert_frame_equal(actual, expected)

        actual = grouped_df.filter(lambda x: len(x) > 1, dropna=False)
        expected = df.copy()
        expected.iloc[[0, 3, 5, 6]] = np.nan
        assert_frame_equal(actual, expected)

        # Filter Series
        actual = grouped_ser.filter(lambda x: len(x) > 1)
        expected = ser.take(expected_indexes)
        assert_series_equal(actual, expected)

        actual = grouped_ser.filter(lambda x: len(x) > 1, dropna=False)
        NA = np.nan
        expected = Series([NA, 1, 1, NA, 2, NA, NA, 3], index, name='pid')
        # ^ made manually because this can get confusing!
        assert_series_equal(actual, expected)

        # Transform Series
        actual = grouped_ser.transform(len)
        expected = Series([1, 2, 2, 1, 2, 1, 1, 2], index, name='pid')
        assert_series_equal(actual, expected)

        # Transform (a column from) DataFrameGroupBy
        actual = grouped_df.pid.transform(len)
        assert_series_equal(actual, expected)

    def test_filter_and_transform_with_multiple_non_unique_int_index(self):
        # GH4620
        index = [1, 1, 1, 2, 0, 0, 0, 1]
        df = DataFrame({'pid': [1, 1, 1, 2, 2, 3, 3, 3],
                        'tag': [23, 45, 62, 24, 45, 34, 25, 62]}, index=index)
        grouped_df = df.groupby('tag')
        ser = df['pid']
        grouped_ser = ser.groupby(df['tag'])
        expected_indexes = [1, 2, 4, 7]

        # Filter DataFrame
        actual = grouped_df.filter(lambda x: len(x) > 1)
        expected = df.iloc[expected_indexes]
        assert_frame_equal(actual, expected)

        actual = grouped_df.filter(lambda x: len(x) > 1, dropna=False)
        expected = df.copy()
        expected.iloc[[0, 3, 5, 6]] = np.nan
        assert_frame_equal(actual, expected)

        # Filter Series
        actual = grouped_ser.filter(lambda x: len(x) > 1)
        expected = ser.take(expected_indexes)
        assert_series_equal(actual, expected)

        actual = grouped_ser.filter(lambda x: len(x) > 1, dropna=False)
        NA = np.nan
        expected = Series([NA, 1, 1, NA, 2, NA, NA, 3], index, name='pid')
        # ^ made manually because this can get confusing!
        assert_series_equal(actual, expected)

        # Transform Series
        actual = grouped_ser.transform(len)
        expected = Series([1, 2, 2, 1, 2, 1, 1, 2], index, name='pid')
        assert_series_equal(actual, expected)

        # Transform (a column from) DataFrameGroupBy
        actual = grouped_df.pid.transform(len)
        assert_series_equal(actual, expected)

    def test_filter_and_transform_with_non_unique_float_index(self):
        # GH4620
        index = np.array([1, 1, 1, 2, 1, 1, 0, 1], dtype=float)
        df = DataFrame({'pid': [1, 1, 1, 2, 2, 3, 3, 3],
                        'tag': [23, 45, 62, 24, 45, 34, 25, 62]}, index=index)
        grouped_df = df.groupby('tag')
        ser = df['pid']
        grouped_ser = ser.groupby(df['tag'])
        expected_indexes = [1, 2, 4, 7]

        # Filter DataFrame
        actual = grouped_df.filter(lambda x: len(x) > 1)
        expected = df.iloc[expected_indexes]
        assert_frame_equal(actual, expected)

        actual = grouped_df.filter(lambda x: len(x) > 1, dropna=False)
        expected = df.copy()
        expected.iloc[[0, 3, 5, 6]] = np.nan
        assert_frame_equal(actual, expected)

        # Filter Series
        actual = grouped_ser.filter(lambda x: len(x) > 1)
        expected = ser.take(expected_indexes)
        assert_series_equal(actual, expected)

        actual = grouped_ser.filter(lambda x: len(x) > 1, dropna=False)
        NA = np.nan
        expected = Series([NA, 1, 1, NA, 2, NA, NA, 3], index, name='pid')
        # ^ made manually because this can get confusing!
        assert_series_equal(actual, expected)

        # Transform Series
        actual = grouped_ser.transform(len)
        expected = Series([1, 2, 2, 1, 2, 1, 1, 2], index, name='pid')
        assert_series_equal(actual, expected)

        # Transform (a column from) DataFrameGroupBy
        actual = grouped_df.pid.transform(len)
        assert_series_equal(actual, expected)

    def test_filter_and_transform_with_non_unique_timestamp_index(self):
        # GH4620
        t0 = Timestamp('2013-09-30 00:05:00')
        t1 = Timestamp('2013-10-30 00:05:00')
        t2 = Timestamp('2013-11-30 00:05:00')
        index = [t1, t1, t1, t2, t1, t1, t0, t1]
        df = DataFrame({'pid': [1, 1, 1, 2, 2, 3, 3, 3],
                        'tag': [23, 45, 62, 24, 45, 34, 25, 62]}, index=index)
        grouped_df = df.groupby('tag')
        ser = df['pid']
        grouped_ser = ser.groupby(df['tag'])
        expected_indexes = [1, 2, 4, 7]

        # Filter DataFrame
        actual = grouped_df.filter(lambda x: len(x) > 1)
        expected = df.iloc[expected_indexes]
        assert_frame_equal(actual, expected)

        actual = grouped_df.filter(lambda x: len(x) > 1, dropna=False)
        expected = df.copy()
        expected.iloc[[0, 3, 5, 6]] = np.nan
        assert_frame_equal(actual, expected)

        # Filter Series
        actual = grouped_ser.filter(lambda x: len(x) > 1)
        expected = ser.take(expected_indexes)
        assert_series_equal(actual, expected)

        actual = grouped_ser.filter(lambda x: len(x) > 1, dropna=False)
        NA = np.nan
        expected = Series([NA, 1, 1, NA, 2, NA, NA, 3], index, name='pid')
        # ^ made manually because this can get confusing!
        assert_series_equal(actual, expected)

        # Transform Series
        actual = grouped_ser.transform(len)
        expected = Series([1, 2, 2, 1, 2, 1, 1, 2], index, name='pid')
        assert_series_equal(actual, expected)

        # Transform (a column from) DataFrameGroupBy
        actual = grouped_df.pid.transform(len)
        assert_series_equal(actual, expected)

    def test_filter_and_transform_with_non_unique_string_index(self):
        # GH4620
        index = list('bbbcbbab')
        df = DataFrame({'pid': [1, 1, 1, 2, 2, 3, 3, 3],
                        'tag': [23, 45, 62, 24, 45, 34, 25, 62]}, index=index)
        grouped_df = df.groupby('tag')
        ser = df['pid']
        grouped_ser = ser.groupby(df['tag'])
        expected_indexes = [1, 2, 4, 7]

        # Filter DataFrame
        actual = grouped_df.filter(lambda x: len(x) > 1)
        expected = df.iloc[expected_indexes]
        assert_frame_equal(actual, expected)

        actual = grouped_df.filter(lambda x: len(x) > 1, dropna=False)
        expected = df.copy()
        expected.iloc[[0, 3, 5, 6]] = np.nan
        assert_frame_equal(actual, expected)

        # Filter Series
        actual = grouped_ser.filter(lambda x: len(x) > 1)
        expected = ser.take(expected_indexes)
        assert_series_equal(actual, expected)

        actual = grouped_ser.filter(lambda x: len(x) > 1, dropna=False)
        NA = np.nan
        expected = Series([NA, 1, 1, NA, 2, NA, NA, 3], index, name='pid')
        # ^ made manually because this can get confusing!
        assert_series_equal(actual, expected)

        # Transform Series
        actual = grouped_ser.transform(len)
        expected = Series([1, 2, 2, 1, 2, 1, 1, 2], index, name='pid')
        assert_series_equal(actual, expected)

        # Transform (a column from) DataFrameGroupBy
        actual = grouped_df.pid.transform(len)
        assert_series_equal(actual, expected)

    def test_filter_has_access_to_grouped_cols(self):
        df = DataFrame([[1, 2], [1, 3], [5, 6]], columns=['A', 'B'])
        g = df.groupby('A')
        # previously didn't have access to col A #????
        filt = g.filter(lambda x: x['A'].sum() == 2)
        assert_frame_equal(filt, df.iloc[[0, 1]])

    def test_filter_enforces_scalarness(self):
        df = pd.DataFrame([
            ['best', 'a', 'x'],
            ['worst', 'b', 'y'],
            ['best', 'c', 'x'],
            ['best', 'd', 'y'],
            ['worst', 'd', 'y'],
            ['worst', 'd', 'y'],
            ['best', 'd', 'z'],
        ], columns=['a', 'b', 'c'])
        with tm.assert_raises_regex(TypeError,
                                    'filter function returned a.*'):
            df.groupby('c').filter(lambda g: g['a'] == 'best')

    def test_filter_non_bool_raises(self):
        df = pd.DataFrame([
            ['best', 'a', 1],
            ['worst', 'b', 1],
            ['best', 'c', 1],
            ['best', 'd', 1],
            ['worst', 'd', 1],
            ['worst', 'd', 1],
            ['best', 'd', 1],
        ], columns=['a', 'b', 'c'])
        with tm.assert_raises_regex(TypeError,
                                    'filter function returned a.*'):
            df.groupby('a').filter(lambda g: g.c.mean())

    def test_filter_dropna_with_empty_groups(self):
        # GH 10780
        data = pd.Series(np.random.rand(9), index=np.repeat([1, 2, 3], 3))
        groupped = data.groupby(level=0)
        result_false = groupped.filter(lambda x: x.mean() > 1, dropna=False)
        expected_false = pd.Series([np.nan] * 9,
                                   index=np.repeat([1, 2, 3], 3))
        tm.assert_series_equal(result_false, expected_false)

        result_true = groupped.filter(lambda x: x.mean() > 1, dropna=True)
        expected_true = pd.Series(index=pd.Index([], dtype=int))
        tm.assert_series_equal(result_true, expected_true)


def assert_fp_equal(a, b):
    assert (np.abs(a - b) < 1e-12).all()


def _check_groupby(df, result, keys, field, f=lambda x: x.sum()):
    tups = lmap(tuple, df[keys].values)
    tups = com._asarray_tuplesafe(tups)
    expected = f(df.groupby(tups)[field])
    for k, v in compat.iteritems(expected):
        assert (result[k] == v)
