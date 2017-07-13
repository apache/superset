from __future__ import division

import pytest
import numpy as np

from pandas import (Interval, IntervalIndex, Index, isnull,
                    interval_range, Timestamp, Timedelta,
                    compat)
from pandas._libs.interval import IntervalTree
from pandas.tests.indexes.common import Base
import pandas.util.testing as tm
import pandas as pd


class TestIntervalIndex(Base):
    _holder = IntervalIndex

    def setup_method(self, method):
        self.index = IntervalIndex.from_arrays([0, 1], [1, 2])
        self.index_with_nan = IntervalIndex.from_tuples(
            [(0, 1), np.nan, (1, 2)])
        self.indices = dict(intervalIndex=tm.makeIntervalIndex(10))

    def create_index(self):
        return IntervalIndex.from_breaks(np.arange(10))

    def test_constructors(self):
        expected = self.index
        actual = IntervalIndex.from_breaks(np.arange(3), closed='right')
        assert expected.equals(actual)

        alternate = IntervalIndex.from_breaks(np.arange(3), closed='left')
        assert not expected.equals(alternate)

        actual = IntervalIndex.from_intervals([Interval(0, 1), Interval(1, 2)])
        assert expected.equals(actual)

        actual = IntervalIndex([Interval(0, 1), Interval(1, 2)])
        assert expected.equals(actual)

        actual = IntervalIndex.from_arrays(np.arange(2), np.arange(2) + 1,
                                           closed='right')
        assert expected.equals(actual)

        actual = Index([Interval(0, 1), Interval(1, 2)])
        assert isinstance(actual, IntervalIndex)
        assert expected.equals(actual)

        actual = Index(expected)
        assert isinstance(actual, IntervalIndex)
        assert expected.equals(actual)

    def test_constructors_other(self):

        # all-nan
        result = IntervalIndex.from_intervals([np.nan])
        expected = np.array([np.nan], dtype=object)
        tm.assert_numpy_array_equal(result.values, expected)

        # empty
        result = IntervalIndex.from_intervals([])
        expected = np.array([], dtype=object)
        tm.assert_numpy_array_equal(result.values, expected)

    def test_constructors_errors(self):

        # scalar
        with pytest.raises(TypeError):
            IntervalIndex(5)

        # not an interval
        with pytest.raises(TypeError):
            IntervalIndex([0, 1])

        with pytest.raises(TypeError):
            IntervalIndex.from_intervals([0, 1])

        # invalid closed
        with pytest.raises(ValueError):
            IntervalIndex.from_arrays([0, 1], [1, 2], closed='invalid')

        # mismatched closed
        with pytest.raises(ValueError):
            IntervalIndex.from_intervals([Interval(0, 1),
                                          Interval(1, 2, closed='left')])

        with pytest.raises(ValueError):
            IntervalIndex.from_arrays([0, 10], [3, 5])

        with pytest.raises(ValueError):
            Index([Interval(0, 1), Interval(2, 3, closed='left')])

        # no point in nesting periods in an IntervalIndex
        with pytest.raises(ValueError):
            IntervalIndex.from_breaks(
                pd.period_range('2000-01-01', periods=3))

    def test_constructors_datetimelike(self):

        # DTI / TDI
        for idx in [pd.date_range('20130101', periods=5),
                    pd.timedelta_range('1 day', periods=5)]:
            result = IntervalIndex.from_breaks(idx)
            expected = IntervalIndex.from_breaks(idx.values)
            tm.assert_index_equal(result, expected)

            expected_scalar_type = type(idx[0])
            i = result[0]
            assert isinstance(i.left, expected_scalar_type)
            assert isinstance(i.right, expected_scalar_type)

    def test_constructors_error(self):

        # non-intervals
        def f():
            IntervalIndex.from_intervals([0.997, 4.0])
        pytest.raises(TypeError, f)

    def test_properties(self):
        index = self.index
        assert len(index) == 2
        assert index.size == 2
        assert index.shape == (2, )

        tm.assert_index_equal(index.left, Index([0, 1]))
        tm.assert_index_equal(index.right, Index([1, 2]))
        tm.assert_index_equal(index.mid, Index([0.5, 1.5]))

        assert index.closed == 'right'

        expected = np.array([Interval(0, 1), Interval(1, 2)], dtype=object)
        tm.assert_numpy_array_equal(np.asarray(index), expected)
        tm.assert_numpy_array_equal(index.values, expected)

        # with nans
        index = self.index_with_nan
        assert len(index) == 3
        assert index.size == 3
        assert index.shape == (3, )

        tm.assert_index_equal(index.left, Index([0, np.nan, 1]))
        tm.assert_index_equal(index.right, Index([1, np.nan, 2]))
        tm.assert_index_equal(index.mid, Index([0.5, np.nan, 1.5]))

        assert index.closed == 'right'

        expected = np.array([Interval(0, 1), np.nan,
                             Interval(1, 2)], dtype=object)
        tm.assert_numpy_array_equal(np.asarray(index), expected)
        tm.assert_numpy_array_equal(index.values, expected)

    def test_with_nans(self):
        index = self.index
        assert not index.hasnans
        tm.assert_numpy_array_equal(index.isnull(),
                                    np.array([False, False]))
        tm.assert_numpy_array_equal(index.notnull(),
                                    np.array([True, True]))

        index = self.index_with_nan
        assert index.hasnans
        tm.assert_numpy_array_equal(index.notnull(),
                                    np.array([True, False, True]))
        tm.assert_numpy_array_equal(index.isnull(),
                                    np.array([False, True, False]))

    def test_copy(self):
        actual = self.index.copy()
        assert actual.equals(self.index)

        actual = self.index.copy(deep=True)
        assert actual.equals(self.index)
        assert actual.left is not self.index.left

    def test_ensure_copied_data(self):
        # exercise the copy flag in the constructor

        # not copying
        index = self.index
        result = IntervalIndex(index, copy=False)
        tm.assert_numpy_array_equal(index.left.values, result.left.values,
                                    check_same='same')
        tm.assert_numpy_array_equal(index.right.values, result.right.values,
                                    check_same='same')

        # by-definition make a copy
        result = IntervalIndex.from_intervals(index.values, copy=False)
        tm.assert_numpy_array_equal(index.left.values, result.left.values,
                                    check_same='copy')
        tm.assert_numpy_array_equal(index.right.values, result.right.values,
                                    check_same='copy')

    def test_equals(self):

        idx = self.index
        assert idx.equals(idx)
        assert idx.equals(idx.copy())

        assert not idx.equals(idx.astype(object))
        assert not idx.equals(np.array(idx))
        assert not idx.equals(list(idx))

        assert not idx.equals([1, 2])
        assert not idx.equals(np.array([1, 2]))
        assert not idx.equals(pd.date_range('20130101', periods=2))

    def test_astype(self):

        idx = self.index

        for dtype in [np.int64, np.float64, 'datetime64[ns]',
                      'datetime64[ns, US/Eastern]', 'timedelta64',
                      'period[M]']:
            pytest.raises(ValueError, idx.astype, dtype)

        result = idx.astype(object)
        tm.assert_index_equal(result, Index(idx.values, dtype='object'))
        assert not idx.equals(result)
        assert idx.equals(IntervalIndex.from_intervals(result))

        result = idx.astype('interval')
        tm.assert_index_equal(result, idx)
        assert result.equals(idx)

        result = idx.astype('category')
        expected = pd.Categorical(idx, ordered=True)
        tm.assert_categorical_equal(result, expected)

    def test_where(self):
        expected = self.index
        result = self.index.where(self.index.notnull())
        tm.assert_index_equal(result, expected)

        idx = IntervalIndex.from_breaks([1, 2])
        result = idx.where([True, False])
        expected = IntervalIndex.from_intervals(
            [Interval(1.0, 2.0, closed='right'), np.nan])
        tm.assert_index_equal(result, expected)

    def test_where_array_like(self):
        pass

    def test_delete(self):
        expected = IntervalIndex.from_breaks([1, 2])
        actual = self.index.delete(0)
        assert expected.equals(actual)

    def test_insert(self):
        expected = IntervalIndex.from_breaks(range(4))
        actual = self.index.insert(2, Interval(2, 3))
        assert expected.equals(actual)

        pytest.raises(ValueError, self.index.insert, 0, 1)
        pytest.raises(ValueError, self.index.insert, 0,
                      Interval(2, 3, closed='left'))

    def test_take(self):
        actual = self.index.take([0, 1])
        assert self.index.equals(actual)

        expected = IntervalIndex.from_arrays([0, 0, 1], [1, 1, 2])
        actual = self.index.take([0, 0, 1])
        assert expected.equals(actual)

    def test_monotonic_and_unique(self):
        assert self.index.is_monotonic
        assert self.index.is_unique

        idx = IntervalIndex.from_tuples([(0, 1), (0.5, 1.5)])
        assert idx.is_monotonic
        assert idx.is_unique

        idx = IntervalIndex.from_tuples([(0, 1), (2, 3), (1, 2)])
        assert not idx.is_monotonic
        assert idx.is_unique

        idx = IntervalIndex.from_tuples([(0, 2), (0, 2)])
        assert not idx.is_unique
        assert idx.is_monotonic

    @pytest.mark.xfail(reason='not a valid repr as we use interval notation')
    def test_repr(self):
        i = IntervalIndex.from_tuples([(0, 1), (1, 2)], closed='right')
        expected = ("IntervalIndex(left=[0, 1],"
                    "\n              right=[1, 2],"
                    "\n              closed='right',"
                    "\n              dtype='interval[int64]')")
        assert repr(i) == expected

        i = IntervalIndex.from_tuples((Timestamp('20130101'),
                                       Timestamp('20130102')),
                                      (Timestamp('20130102'),
                                       Timestamp('20130103')),
                                      closed='right')
        expected = ("IntervalIndex(left=['2013-01-01', '2013-01-02'],"
                    "\n              right=['2013-01-02', '2013-01-03'],"
                    "\n              closed='right',"
                    "\n              dtype='interval[datetime64[ns]]')")
        assert repr(i) == expected

    @pytest.mark.xfail(reason='not a valid repr as we use interval notation')
    def test_repr_max_seq_item_setting(self):
        super(TestIntervalIndex, self).test_repr_max_seq_item_setting()

    @pytest.mark.xfail(reason='not a valid repr as we use interval notation')
    def test_repr_roundtrip(self):
        super(TestIntervalIndex, self).test_repr_roundtrip()

    def test_get_item(self):
        i = IntervalIndex.from_arrays((0, 1, np.nan), (1, 2, np.nan),
                                      closed='right')
        assert i[0] == Interval(0.0, 1.0)
        assert i[1] == Interval(1.0, 2.0)
        assert isnull(i[2])

        result = i[0:1]
        expected = IntervalIndex.from_arrays((0.,), (1.,), closed='right')
        tm.assert_index_equal(result, expected)

        result = i[0:2]
        expected = IntervalIndex.from_arrays((0., 1), (1., 2.), closed='right')
        tm.assert_index_equal(result, expected)

        result = i[1:3]
        expected = IntervalIndex.from_arrays((1., np.nan), (2., np.nan),
                                             closed='right')
        tm.assert_index_equal(result, expected)

    def test_get_loc_value(self):
        pytest.raises(KeyError, self.index.get_loc, 0)
        assert self.index.get_loc(0.5) == 0
        assert self.index.get_loc(1) == 0
        assert self.index.get_loc(1.5) == 1
        assert self.index.get_loc(2) == 1
        pytest.raises(KeyError, self.index.get_loc, -1)
        pytest.raises(KeyError, self.index.get_loc, 3)

        idx = IntervalIndex.from_tuples([(0, 2), (1, 3)])
        assert idx.get_loc(0.5) == 0
        assert idx.get_loc(1) == 0
        tm.assert_numpy_array_equal(idx.get_loc(1.5),
                                    np.array([0, 1], dtype='int64'))
        tm.assert_numpy_array_equal(np.sort(idx.get_loc(2)),
                                    np.array([0, 1], dtype='int64'))
        assert idx.get_loc(3) == 1
        pytest.raises(KeyError, idx.get_loc, 3.5)

        idx = IntervalIndex.from_arrays([0, 2], [1, 3])
        pytest.raises(KeyError, idx.get_loc, 1.5)

    def slice_locs_cases(self, breaks):
        # TODO: same tests for more index types
        index = IntervalIndex.from_breaks([0, 1, 2], closed='right')
        assert index.slice_locs() == (0, 2)
        assert index.slice_locs(0, 1) == (0, 1)
        assert index.slice_locs(1, 1) == (0, 1)
        assert index.slice_locs(0, 2) == (0, 2)
        assert index.slice_locs(0.5, 1.5) == (0, 2)
        assert index.slice_locs(0, 0.5) == (0, 1)
        assert index.slice_locs(start=1) == (0, 2)
        assert index.slice_locs(start=1.2) == (1, 2)
        assert index.slice_locs(end=1) == (0, 1)
        assert index.slice_locs(end=1.1) == (0, 2)
        assert index.slice_locs(end=1.0) == (0, 1)
        assert index.slice_locs(-1, -1) == (0, 0)

        index = IntervalIndex.from_breaks([0, 1, 2], closed='neither')
        assert index.slice_locs(0, 1) == (0, 1)
        assert index.slice_locs(0, 2) == (0, 2)
        assert index.slice_locs(0.5, 1.5) == (0, 2)
        assert index.slice_locs(1, 1) == (1, 1)
        assert index.slice_locs(1, 2) == (1, 2)

        index = IntervalIndex.from_breaks([0, 1, 2], closed='both')
        assert index.slice_locs(1, 1) == (0, 2)
        assert index.slice_locs(1, 2) == (0, 2)

    def test_slice_locs_int64(self):
        self.slice_locs_cases([0, 1, 2])

    def test_slice_locs_float64(self):
        self.slice_locs_cases([0.0, 1.0, 2.0])

    def slice_locs_decreasing_cases(self, tuples):
        index = IntervalIndex.from_tuples(tuples)
        assert index.slice_locs(1.5, 0.5) == (1, 3)
        assert index.slice_locs(2, 0) == (1, 3)
        assert index.slice_locs(2, 1) == (1, 3)
        assert index.slice_locs(3, 1.1) == (0, 3)
        assert index.slice_locs(3, 3) == (0, 2)
        assert index.slice_locs(3.5, 3.3) == (0, 1)
        assert index.slice_locs(1, -3) == (2, 3)

        slice_locs = index.slice_locs(-1, -1)
        assert slice_locs[0] == slice_locs[1]

    def test_slice_locs_decreasing_int64(self):
        self.slice_locs_cases([(2, 4), (1, 3), (0, 2)])

    def test_slice_locs_decreasing_float64(self):
        self.slice_locs_cases([(2., 4.), (1., 3.), (0., 2.)])

    def test_slice_locs_fails(self):
        index = IntervalIndex.from_tuples([(1, 2), (0, 1), (2, 3)])
        with pytest.raises(KeyError):
            index.slice_locs(1, 2)

    def test_get_loc_interval(self):
        assert self.index.get_loc(Interval(0, 1)) == 0
        assert self.index.get_loc(Interval(0, 0.5)) == 0
        assert self.index.get_loc(Interval(0, 1, 'left')) == 0
        pytest.raises(KeyError, self.index.get_loc, Interval(2, 3))
        pytest.raises(KeyError, self.index.get_loc,
                      Interval(-1, 0, 'left'))

    def test_get_indexer(self):
        actual = self.index.get_indexer([-1, 0, 0.5, 1, 1.5, 2, 3])
        expected = np.array([-1, -1, 0, 0, 1, 1, -1], dtype='intp')
        tm.assert_numpy_array_equal(actual, expected)

        actual = self.index.get_indexer(self.index)
        expected = np.array([0, 1], dtype='intp')
        tm.assert_numpy_array_equal(actual, expected)

        index = IntervalIndex.from_breaks([0, 1, 2], closed='left')
        actual = index.get_indexer([-1, 0, 0.5, 1, 1.5, 2, 3])
        expected = np.array([-1, 0, 0, 1, 1, -1, -1], dtype='intp')
        tm.assert_numpy_array_equal(actual, expected)

        actual = self.index.get_indexer(index[:1])
        expected = np.array([0], dtype='intp')
        tm.assert_numpy_array_equal(actual, expected)

        actual = self.index.get_indexer(index)
        expected = np.array([-1, 1], dtype='intp')
        tm.assert_numpy_array_equal(actual, expected)

    def test_get_indexer_subintervals(self):

        # TODO: is this right?
        # return indexers for wholly contained subintervals
        target = IntervalIndex.from_breaks(np.linspace(0, 2, 5))
        actual = self.index.get_indexer(target)
        expected = np.array([0, 0, 1, 1], dtype='p')
        tm.assert_numpy_array_equal(actual, expected)

        target = IntervalIndex.from_breaks([0, 0.67, 1.33, 2])
        actual = self.index.get_indexer(target)
        expected = np.array([0, 0, 1, 1], dtype='intp')
        tm.assert_numpy_array_equal(actual, expected)

        actual = self.index.get_indexer(target[[0, -1]])
        expected = np.array([0, 1], dtype='intp')
        tm.assert_numpy_array_equal(actual, expected)

        target = IntervalIndex.from_breaks([0, 0.33, 0.67, 1], closed='left')
        actual = self.index.get_indexer(target)
        expected = np.array([0, 0, 0], dtype='intp')
        tm.assert_numpy_array_equal(actual, expected)

    def test_contains(self):
        # Only endpoints are valid.
        i = IntervalIndex.from_arrays([0, 1], [1, 2])

        # Invalid
        assert 0 not in i
        assert 1 not in i
        assert 2 not in i

        # Valid
        assert Interval(0, 1) in i
        assert Interval(0, 2) in i
        assert Interval(0, 0.5) in i
        assert Interval(3, 5) not in i
        assert Interval(-1, 0, closed='left') not in i

    def testcontains(self):
        # can select values that are IN the range of a value
        i = IntervalIndex.from_arrays([0, 1], [1, 2])

        assert i.contains(0.1)
        assert i.contains(0.5)
        assert i.contains(1)
        assert i.contains(Interval(0, 1))
        assert i.contains(Interval(0, 2))

        # these overlaps completely
        assert i.contains(Interval(0, 3))
        assert i.contains(Interval(1, 3))

        assert not i.contains(20)
        assert not i.contains(-20)

    def test_dropna(self):

        expected = IntervalIndex.from_tuples([(0.0, 1.0), (1.0, 2.0)])

        ii = IntervalIndex.from_tuples([(0, 1), (1, 2), np.nan])
        result = ii.dropna()
        tm.assert_index_equal(result, expected)

        ii = IntervalIndex.from_arrays([0, 1, np.nan], [1, 2, np.nan])
        result = ii.dropna()
        tm.assert_index_equal(result, expected)

    def test_non_contiguous(self):
        index = IntervalIndex.from_tuples([(0, 1), (2, 3)])
        target = [0.5, 1.5, 2.5]
        actual = index.get_indexer(target)
        expected = np.array([0, -1, 1], dtype='intp')
        tm.assert_numpy_array_equal(actual, expected)

        assert 1.5 not in index

    def test_union(self):
        other = IntervalIndex.from_arrays([2], [3])
        expected = IntervalIndex.from_arrays(range(3), range(1, 4))
        actual = self.index.union(other)
        assert expected.equals(actual)

        actual = other.union(self.index)
        assert expected.equals(actual)

        tm.assert_index_equal(self.index.union(self.index), self.index)
        tm.assert_index_equal(self.index.union(self.index[:1]),
                              self.index)

    def test_intersection(self):
        other = IntervalIndex.from_breaks([1, 2, 3])
        expected = IntervalIndex.from_breaks([1, 2])
        actual = self.index.intersection(other)
        assert expected.equals(actual)

        tm.assert_index_equal(self.index.intersection(self.index),
                              self.index)

    def test_difference(self):
        tm.assert_index_equal(self.index.difference(self.index[:1]),
                              self.index[1:])

    def test_symmetric_difference(self):
        result = self.index[:1].symmetric_difference(self.index[1:])
        expected = self.index
        tm.assert_index_equal(result, expected)

    def test_set_operation_errors(self):
        pytest.raises(ValueError, self.index.union, self.index.left)

        other = IntervalIndex.from_breaks([0, 1, 2], closed='neither')
        pytest.raises(ValueError, self.index.union, other)

    def test_isin(self):
        actual = self.index.isin(self.index)
        tm.assert_numpy_array_equal(np.array([True, True]), actual)

        actual = self.index.isin(self.index[:1])
        tm.assert_numpy_array_equal(np.array([True, False]), actual)

    def test_comparison(self):
        actual = Interval(0, 1) < self.index
        expected = np.array([False, True])
        tm.assert_numpy_array_equal(actual, expected)

        actual = Interval(0.5, 1.5) < self.index
        expected = np.array([False, True])
        tm.assert_numpy_array_equal(actual, expected)
        actual = self.index > Interval(0.5, 1.5)
        tm.assert_numpy_array_equal(actual, expected)

        actual = self.index == self.index
        expected = np.array([True, True])
        tm.assert_numpy_array_equal(actual, expected)
        actual = self.index <= self.index
        tm.assert_numpy_array_equal(actual, expected)
        actual = self.index >= self.index
        tm.assert_numpy_array_equal(actual, expected)

        actual = self.index < self.index
        expected = np.array([False, False])
        tm.assert_numpy_array_equal(actual, expected)
        actual = self.index > self.index
        tm.assert_numpy_array_equal(actual, expected)

        actual = self.index == IntervalIndex.from_breaks([0, 1, 2], 'left')
        tm.assert_numpy_array_equal(actual, expected)

        actual = self.index == self.index.values
        tm.assert_numpy_array_equal(actual, np.array([True, True]))
        actual = self.index.values == self.index
        tm.assert_numpy_array_equal(actual, np.array([True, True]))
        actual = self.index <= self.index.values
        tm.assert_numpy_array_equal(actual, np.array([True, True]))
        actual = self.index != self.index.values
        tm.assert_numpy_array_equal(actual, np.array([False, False]))
        actual = self.index > self.index.values
        tm.assert_numpy_array_equal(actual, np.array([False, False]))
        actual = self.index.values > self.index
        tm.assert_numpy_array_equal(actual, np.array([False, False]))

        # invalid comparisons
        actual = self.index == 0
        tm.assert_numpy_array_equal(actual, np.array([False, False]))
        actual = self.index == self.index.left
        tm.assert_numpy_array_equal(actual, np.array([False, False]))

        with tm.assert_raises_regex(TypeError, 'unorderable types'):
            self.index > 0
        with tm.assert_raises_regex(TypeError, 'unorderable types'):
            self.index <= 0
        with pytest.raises(TypeError):
            self.index > np.arange(2)
        with pytest.raises(ValueError):
            self.index > np.arange(3)

    def test_missing_values(self):
        idx = pd.Index([np.nan, pd.Interval(0, 1), pd.Interval(1, 2)])
        idx2 = pd.IntervalIndex.from_arrays([np.nan, 0, 1], [np.nan, 1, 2])
        assert idx.equals(idx2)

        with pytest.raises(ValueError):
            IntervalIndex.from_arrays([np.nan, 0, 1], np.array([0, 1, 2]))

        tm.assert_numpy_array_equal(isnull(idx),
                                    np.array([True, False, False]))

    def test_sort_values(self):
        expected = IntervalIndex.from_breaks([1, 2, 3, 4])
        actual = IntervalIndex.from_tuples([(3, 4), (1, 2),
                                            (2, 3)]).sort_values()
        tm.assert_index_equal(expected, actual)

        # nan
        idx = self.index_with_nan
        mask = idx.isnull()
        tm.assert_numpy_array_equal(mask, np.array([False, True, False]))

        result = idx.sort_values()
        mask = result.isnull()
        tm.assert_numpy_array_equal(mask, np.array([False, False, True]))

        result = idx.sort_values(ascending=False)
        mask = result.isnull()
        tm.assert_numpy_array_equal(mask, np.array([True, False, False]))

    def test_datetime(self):
        dates = pd.date_range('2000', periods=3)
        idx = IntervalIndex.from_breaks(dates)

        tm.assert_index_equal(idx.left, dates[:2])
        tm.assert_index_equal(idx.right, dates[-2:])

        expected = pd.date_range('2000-01-01T12:00', periods=2)
        tm.assert_index_equal(idx.mid, expected)

        assert pd.Timestamp('2000-01-01T12') not in idx
        assert pd.Timestamp('2000-01-01T12') not in idx

        target = pd.date_range('1999-12-31T12:00', periods=7, freq='12H')
        actual = idx.get_indexer(target)

        expected = np.array([-1, -1, 0, 0, 1, 1, -1], dtype='intp')
        tm.assert_numpy_array_equal(actual, expected)

    def test_append(self):

        index1 = IntervalIndex.from_arrays([0, 1], [1, 2])
        index2 = IntervalIndex.from_arrays([1, 2], [2, 3])

        result = index1.append(index2)
        expected = IntervalIndex.from_arrays([0, 1, 1, 2], [1, 2, 2, 3])
        tm.assert_index_equal(result, expected)

        result = index1.append([index1, index2])
        expected = IntervalIndex.from_arrays([0, 1, 0, 1, 1, 2],
                                             [1, 2, 1, 2, 2, 3])
        tm.assert_index_equal(result, expected)

        def f():
            index1.append(IntervalIndex.from_arrays([0, 1], [1, 2],
                                                    closed='both'))

        pytest.raises(ValueError, f)


class TestIntervalRange(object):

    def test_construction(self):
        result = interval_range(0, 5, name='foo', closed='both')
        expected = IntervalIndex.from_breaks(
            np.arange(0, 5), name='foo', closed='both')
        tm.assert_index_equal(result, expected)

    def test_errors(self):

        # not enough params
        def f():
            interval_range(0)

        pytest.raises(ValueError, f)

        def f():
            interval_range(periods=2)

        pytest.raises(ValueError, f)

        def f():
            interval_range()

        pytest.raises(ValueError, f)

        # mixed units
        def f():
            interval_range(0, Timestamp('20130101'), freq=2)

        pytest.raises(ValueError, f)

        def f():
            interval_range(0, 10, freq=Timedelta('1day'))

        pytest.raises(ValueError, f)


class TestIntervalTree(object):
    def setup_method(self, method):
        gentree = lambda dtype: IntervalTree(np.arange(5, dtype=dtype),
                                             np.arange(5, dtype=dtype) + 2)
        self.tree = gentree('int64')
        self.trees = {dtype: gentree(dtype)
                      for dtype in ['int32', 'int64', 'float32', 'float64']}

    def test_get_loc(self):
        for dtype, tree in self.trees.items():
            tm.assert_numpy_array_equal(tree.get_loc(1),
                                        np.array([0], dtype='int64'))
            tm.assert_numpy_array_equal(np.sort(tree.get_loc(2)),
                                        np.array([0, 1], dtype='int64'))
            with pytest.raises(KeyError):
                tree.get_loc(-1)

    def test_get_indexer(self):
        for dtype, tree in self.trees.items():
            tm.assert_numpy_array_equal(
                tree.get_indexer(np.array([1.0, 5.5, 6.5])),
                np.array([0, 4, -1], dtype='int64'))
            with pytest.raises(KeyError):
                tree.get_indexer(np.array([3.0]))

    def test_get_indexer_non_unique(self):
        indexer, missing = self.tree.get_indexer_non_unique(
            np.array([1.0, 2.0, 6.5]))
        tm.assert_numpy_array_equal(indexer[:1],
                                    np.array([0], dtype='int64'))
        tm.assert_numpy_array_equal(np.sort(indexer[1:3]),
                                    np.array([0, 1], dtype='int64'))
        tm.assert_numpy_array_equal(np.sort(indexer[3:]),
                                    np.array([-1], dtype='int64'))
        tm.assert_numpy_array_equal(missing, np.array([2], dtype='int64'))

    def test_duplicates(self):
        tree = IntervalTree([0, 0, 0], [1, 1, 1])
        tm.assert_numpy_array_equal(np.sort(tree.get_loc(0.5)),
                                    np.array([0, 1, 2], dtype='int64'))

        with pytest.raises(KeyError):
            tree.get_indexer(np.array([0.5]))

        indexer, missing = tree.get_indexer_non_unique(np.array([0.5]))
        tm.assert_numpy_array_equal(np.sort(indexer),
                                    np.array([0, 1, 2], dtype='int64'))
        tm.assert_numpy_array_equal(missing, np.array([], dtype='int64'))

    def test_get_loc_closed(self):
        for closed in ['left', 'right', 'both', 'neither']:
            tree = IntervalTree([0], [1], closed=closed)
            for p, errors in [(0, tree.open_left),
                              (1, tree.open_right)]:
                if errors:
                    with pytest.raises(KeyError):
                        tree.get_loc(p)
                else:
                    tm.assert_numpy_array_equal(tree.get_loc(p),
                                                np.array([0], dtype='int64'))

    @pytest.mark.skipif(compat.is_platform_32bit(),
                        reason="int type mismatch on 32bit")
    def test_get_indexer_closed(self):
        x = np.arange(1000, dtype='float64')
        found = x.astype('intp')
        not_found = (-1 * np.ones(1000)).astype('intp')

        for leaf_size in [1, 10, 100, 10000]:
            for closed in ['left', 'right', 'both', 'neither']:
                tree = IntervalTree(x, x + 0.5, closed=closed,
                                    leaf_size=leaf_size)
                tm.assert_numpy_array_equal(found,
                                            tree.get_indexer(x + 0.25))

                expected = found if tree.closed_left else not_found
                tm.assert_numpy_array_equal(expected,
                                            tree.get_indexer(x + 0.0))

                expected = found if tree.closed_right else not_found
                tm.assert_numpy_array_equal(expected,
                                            tree.get_indexer(x + 0.5))
