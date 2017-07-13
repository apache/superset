# coding=utf-8

import pytest

import numpy as np
import random

from pandas import DataFrame, Series, MultiIndex, IntervalIndex

from pandas.util.testing import assert_series_equal, assert_almost_equal
import pandas.util.testing as tm

from .common import TestData


class TestSeriesSorting(TestData):

    def test_sortlevel_deprecated(self):
        ts = self.ts.copy()

        # see gh-9816
        with tm.assert_produces_warning(FutureWarning):
            ts.sortlevel()

    def test_sort_values(self):

        # check indexes are reordered corresponding with the values
        ser = Series([3, 2, 4, 1], ['A', 'B', 'C', 'D'])
        expected = Series([1, 2, 3, 4], ['D', 'B', 'A', 'C'])
        result = ser.sort_values()
        tm.assert_series_equal(expected, result)

        ts = self.ts.copy()
        ts[:5] = np.NaN
        vals = ts.values

        result = ts.sort_values()
        assert np.isnan(result[-5:]).all()
        tm.assert_numpy_array_equal(result[:-5].values, np.sort(vals[5:]))

        # na_position
        result = ts.sort_values(na_position='first')
        assert np.isnan(result[:5]).all()
        tm.assert_numpy_array_equal(result[5:].values, np.sort(vals[5:]))

        # something object-type
        ser = Series(['A', 'B'], [1, 2])
        # no failure
        ser.sort_values()

        # ascending=False
        ordered = ts.sort_values(ascending=False)
        expected = np.sort(ts.valid().values)[::-1]
        assert_almost_equal(expected, ordered.valid().values)
        ordered = ts.sort_values(ascending=False, na_position='first')
        assert_almost_equal(expected, ordered.valid().values)

        # ascending=[False] should behave the same as ascending=False
        ordered = ts.sort_values(ascending=[False])
        expected = ts.sort_values(ascending=False)
        assert_series_equal(expected, ordered)
        ordered = ts.sort_values(ascending=[False], na_position='first')
        expected = ts.sort_values(ascending=False, na_position='first')
        assert_series_equal(expected, ordered)

        pytest.raises(ValueError,
                      lambda: ts.sort_values(ascending=None))
        pytest.raises(ValueError,
                      lambda: ts.sort_values(ascending=[]))
        pytest.raises(ValueError,
                      lambda: ts.sort_values(ascending=[1, 2, 3]))
        pytest.raises(ValueError,
                      lambda: ts.sort_values(ascending=[False, False]))
        pytest.raises(ValueError,
                      lambda: ts.sort_values(ascending='foobar'))

        # inplace=True
        ts = self.ts.copy()
        ts.sort_values(ascending=False, inplace=True)
        tm.assert_series_equal(ts, self.ts.sort_values(ascending=False))
        tm.assert_index_equal(ts.index,
                              self.ts.sort_values(ascending=False).index)

        # GH 5856/5853
        # Series.sort_values operating on a view
        df = DataFrame(np.random.randn(10, 4))
        s = df.iloc[:, 0]

        def f():
            s.sort_values(inplace=True)

        pytest.raises(ValueError, f)

    def test_sort_index(self):
        rindex = list(self.ts.index)
        random.shuffle(rindex)

        random_order = self.ts.reindex(rindex)
        sorted_series = random_order.sort_index()
        assert_series_equal(sorted_series, self.ts)

        # descending
        sorted_series = random_order.sort_index(ascending=False)
        assert_series_equal(sorted_series,
                            self.ts.reindex(self.ts.index[::-1]))

        # compat on level
        sorted_series = random_order.sort_index(level=0)
        assert_series_equal(sorted_series, self.ts)

        # compat on axis
        sorted_series = random_order.sort_index(axis=0)
        assert_series_equal(sorted_series, self.ts)

        pytest.raises(ValueError, lambda: random_order.sort_values(axis=1))

        sorted_series = random_order.sort_index(level=0, axis=0)
        assert_series_equal(sorted_series, self.ts)

        pytest.raises(ValueError,
                      lambda: random_order.sort_index(level=0, axis=1))

    def test_sort_index_inplace(self):

        # For #11402
        rindex = list(self.ts.index)
        random.shuffle(rindex)

        # descending
        random_order = self.ts.reindex(rindex)
        result = random_order.sort_index(ascending=False, inplace=True)

        assert result is None
        tm.assert_series_equal(random_order, self.ts.reindex(
            self.ts.index[::-1]))

        # ascending
        random_order = self.ts.reindex(rindex)
        result = random_order.sort_index(ascending=True, inplace=True)

        assert result is None
        tm.assert_series_equal(random_order, self.ts)

    def test_sort_index_multiindex(self):

        mi = MultiIndex.from_tuples([[1, 1, 3], [1, 1, 1]], names=list('ABC'))
        s = Series([1, 2], mi)
        backwards = s.iloc[[1, 0]]

        # implicit sort_remaining=True
        res = s.sort_index(level='A')
        assert_series_equal(backwards, res)

        # GH13496
        # rows share same level='A': sort has no effect without remaining lvls
        res = s.sort_index(level='A', sort_remaining=False)
        assert_series_equal(s, res)

    def test_sort_index_kind(self):
        # GH #14444 & #13589:  Add support for sort algo choosing
        series = Series(index=[3, 2, 1, 4, 3])
        expected_series = Series(index=[1, 2, 3, 3, 4])

        index_sorted_series = series.sort_index(kind='mergesort')
        assert_series_equal(expected_series, index_sorted_series)

        index_sorted_series = series.sort_index(kind='quicksort')
        assert_series_equal(expected_series, index_sorted_series)

        index_sorted_series = series.sort_index(kind='heapsort')
        assert_series_equal(expected_series, index_sorted_series)

    def test_sort_index_na_position(self):
        series = Series(index=[3, 2, 1, 4, 3, np.nan])

        expected_series_first = Series(index=[np.nan, 1, 2, 3, 3, 4])
        index_sorted_series = series.sort_index(na_position='first')
        assert_series_equal(expected_series_first, index_sorted_series)

        expected_series_last = Series(index=[1, 2, 3, 3, 4, np.nan])
        index_sorted_series = series.sort_index(na_position='last')
        assert_series_equal(expected_series_last, index_sorted_series)

    def test_sort_index_intervals(self):
        s = Series([np.nan, 1, 2, 3], IntervalIndex.from_arrays(
            [0, 1, 2, 3],
            [1, 2, 3, 4]))

        result = s.sort_index()
        expected = s
        assert_series_equal(result, expected)

        result = s.sort_index(ascending=False)
        expected = Series([3, 2, 1, np.nan], IntervalIndex.from_arrays(
            [3, 2, 1, 0],
            [4, 3, 2, 1]))
        assert_series_equal(result, expected)
