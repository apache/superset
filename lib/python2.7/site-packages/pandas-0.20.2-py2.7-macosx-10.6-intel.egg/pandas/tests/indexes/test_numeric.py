# -*- coding: utf-8 -*-

import pytest

from datetime import datetime
from pandas.compat import range, PY3

import numpy as np

from pandas import (date_range, notnull, Series, Index, Float64Index,
                    Int64Index, UInt64Index, RangeIndex)

import pandas.util.testing as tm

import pandas as pd
from pandas._libs.lib import Timestamp

from pandas.tests.indexes.common import Base


def full_like(array, value):
    """Compatibility for numpy<1.8.0
    """
    ret = np.empty(array.shape, dtype=np.array(value).dtype)
    ret.fill(value)
    return ret


class Numeric(Base):

    def test_numeric_compat(self):

        idx = self.create_index()
        didx = idx * idx

        result = idx * 1
        tm.assert_index_equal(result, idx)

        result = 1 * idx
        tm.assert_index_equal(result, idx)

        # in general not true for RangeIndex
        if not isinstance(idx, RangeIndex):
            result = idx * idx
            tm.assert_index_equal(result, idx ** 2)

        # truediv under PY3
        result = idx / 1
        expected = idx
        if PY3:
            expected = expected.astype('float64')
        tm.assert_index_equal(result, expected)

        result = idx / 2
        if PY3:
            expected = expected.astype('float64')
        expected = Index(idx.values / 2)
        tm.assert_index_equal(result, expected)

        result = idx // 1
        tm.assert_index_equal(result, idx)

        result = idx * np.array(5, dtype='int64')
        tm.assert_index_equal(result, idx * 5)

        arr_dtype = 'uint64' if isinstance(idx, UInt64Index) else 'int64'
        result = idx * np.arange(5, dtype=arr_dtype)
        tm.assert_index_equal(result, didx)

        result = idx * Series(np.arange(5, dtype=arr_dtype))
        tm.assert_index_equal(result, didx)

        result = idx * Series(np.arange(5, dtype='float64') + 0.1)
        expected = Float64Index(np.arange(5, dtype='float64') *
                                (np.arange(5, dtype='float64') + 0.1))
        tm.assert_index_equal(result, expected)

        # invalid
        pytest.raises(TypeError,
                      lambda: idx * date_range('20130101', periods=5))
        pytest.raises(ValueError, lambda: idx * idx[0:3])
        pytest.raises(ValueError, lambda: idx * np.array([1, 2]))

        result = divmod(idx, 2)
        with np.errstate(all='ignore'):
            div, mod = divmod(idx.values, 2)
            expected = Index(div), Index(mod)
        for r, e in zip(result, expected):
            tm.assert_index_equal(r, e)

        result = divmod(idx, full_like(idx.values, 2))
        with np.errstate(all='ignore'):
            div, mod = divmod(idx.values, full_like(idx.values, 2))
            expected = Index(div), Index(mod)
        for r, e in zip(result, expected):
            tm.assert_index_equal(r, e)

        result = divmod(idx, Series(full_like(idx.values, 2)))
        with np.errstate(all='ignore'):
            div, mod = divmod(
                idx.values,
                full_like(idx.values, 2),
            )
            expected = Index(div), Index(mod)
        for r, e in zip(result, expected):
            tm.assert_index_equal(r, e)

        # test power calculations both ways, GH 14973
        expected = pd.Float64Index(2.0**idx.values)
        result = 2.0**idx
        tm.assert_index_equal(result, expected)

        expected = pd.Float64Index(idx.values**2.0)
        result = idx**2.0
        tm.assert_index_equal(result, expected)

    def test_explicit_conversions(self):

        # GH 8608
        # add/sub are overriden explicity for Float/Int Index
        idx = self._holder(np.arange(5, dtype='int64'))

        # float conversions
        arr = np.arange(5, dtype='int64') * 3.2
        expected = Float64Index(arr)
        fidx = idx * 3.2
        tm.assert_index_equal(fidx, expected)
        fidx = 3.2 * idx
        tm.assert_index_equal(fidx, expected)

        # interops with numpy arrays
        expected = Float64Index(arr)
        a = np.zeros(5, dtype='float64')
        result = fidx - a
        tm.assert_index_equal(result, expected)

        expected = Float64Index(-arr)
        a = np.zeros(5, dtype='float64')
        result = a - fidx
        tm.assert_index_equal(result, expected)

    def test_ufunc_compat(self):
        idx = self._holder(np.arange(5, dtype='int64'))
        result = np.sin(idx)
        expected = Float64Index(np.sin(np.arange(5, dtype='int64')))
        tm.assert_index_equal(result, expected)

    def test_index_groupby(self):
        int_idx = Index(range(6))
        float_idx = Index(np.arange(0, 0.6, 0.1))
        obj_idx = Index('A B C D E F'.split())
        dt_idx = pd.date_range('2013-01-01', freq='M', periods=6)

        for idx in [int_idx, float_idx, obj_idx, dt_idx]:
            to_groupby = np.array([1, 2, np.nan, np.nan, 2, 1])
            tm.assert_dict_equal(idx.groupby(to_groupby),
                                 {1.0: idx[[0, 5]], 2.0: idx[[1, 4]]})

            to_groupby = Index([datetime(2011, 11, 1),
                                datetime(2011, 12, 1),
                                pd.NaT,
                                pd.NaT,
                                datetime(2011, 12, 1),
                                datetime(2011, 11, 1)],
                               tz='UTC').values

            ex_keys = [Timestamp('2011-11-01'), Timestamp('2011-12-01')]
            expected = {ex_keys[0]: idx[[0, 5]],
                        ex_keys[1]: idx[[1, 4]]}
            tm.assert_dict_equal(idx.groupby(to_groupby), expected)

    def test_modulo(self):
        # GH 9244
        index = self.create_index()
        expected = Index(index.values % 2)
        tm.assert_index_equal(index % 2, expected)


class TestFloat64Index(Numeric):
    _holder = Float64Index

    def setup_method(self, method):
        self.indices = dict(mixed=Float64Index([1.5, 2, 3, 4, 5]),
                            float=Float64Index(np.arange(5) * 2.5))
        self.setup_indices()

    def create_index(self):
        return Float64Index(np.arange(5, dtype='float64'))

    def test_repr_roundtrip(self):
        for ind in (self.mixed, self.float):
            tm.assert_index_equal(eval(repr(ind)), ind)

    def check_is_index(self, i):
        assert isinstance(i, Index)
        assert not isinstance(i, Float64Index)

    def check_coerce(self, a, b, is_float_index=True):
        assert a.equals(b)
        tm.assert_index_equal(a, b, exact=False)
        if is_float_index:
            assert isinstance(b, Float64Index)
        else:
            self.check_is_index(b)

    def test_constructor(self):

        # explicit construction
        index = Float64Index([1, 2, 3, 4, 5])
        assert isinstance(index, Float64Index)
        expected = np.array([1, 2, 3, 4, 5], dtype='float64')
        tm.assert_numpy_array_equal(index.values, expected)
        index = Float64Index(np.array([1, 2, 3, 4, 5]))
        assert isinstance(index, Float64Index)
        index = Float64Index([1., 2, 3, 4, 5])
        assert isinstance(index, Float64Index)
        index = Float64Index(np.array([1., 2, 3, 4, 5]))
        assert isinstance(index, Float64Index)
        assert index.dtype == float

        index = Float64Index(np.array([1., 2, 3, 4, 5]), dtype=np.float32)
        assert isinstance(index, Float64Index)
        assert index.dtype == np.float64

        index = Float64Index(np.array([1, 2, 3, 4, 5]), dtype=np.float32)
        assert isinstance(index, Float64Index)
        assert index.dtype == np.float64

        # nan handling
        result = Float64Index([np.nan, np.nan])
        assert pd.isnull(result.values).all()
        result = Float64Index(np.array([np.nan]))
        assert pd.isnull(result.values).all()
        result = Index(np.array([np.nan]))
        assert pd.isnull(result.values).all()

    def test_constructor_invalid(self):

        # invalid
        pytest.raises(TypeError, Float64Index, 0.)
        pytest.raises(TypeError, Float64Index, ['a', 'b', 0.])
        pytest.raises(TypeError, Float64Index, [Timestamp('20130101')])

    def test_constructor_coerce(self):

        self.check_coerce(self.mixed, Index([1.5, 2, 3, 4, 5]))
        self.check_coerce(self.float, Index(np.arange(5) * 2.5))
        self.check_coerce(self.float, Index(np.array(
            np.arange(5) * 2.5, dtype=object)))

    def test_constructor_explicit(self):

        # these don't auto convert
        self.check_coerce(self.float,
                          Index((np.arange(5) * 2.5), dtype=object),
                          is_float_index=False)
        self.check_coerce(self.mixed, Index(
            [1.5, 2, 3, 4, 5], dtype=object), is_float_index=False)

    def test_astype(self):

        result = self.float.astype(object)
        assert result.equals(self.float)
        assert self.float.equals(result)
        self.check_is_index(result)

        i = self.mixed.copy()
        i.name = 'foo'
        result = i.astype(object)
        assert result.equals(i)
        assert i.equals(result)
        self.check_is_index(result)

        # GH 12881
        # a float astype int
        for dtype in ['int16', 'int32', 'int64']:
            i = Float64Index([0, 1, 2])
            result = i.astype(dtype)
            expected = Int64Index([0, 1, 2])
            tm.assert_index_equal(result, expected)

            i = Float64Index([0, 1.1, 2])
            result = i.astype(dtype)
            expected = Int64Index([0, 1, 2])
            tm.assert_index_equal(result, expected)

        for dtype in ['float32', 'float64']:
            i = Float64Index([0, 1, 2])
            result = i.astype(dtype)
            expected = i
            tm.assert_index_equal(result, expected)

            i = Float64Index([0, 1.1, 2])
            result = i.astype(dtype)
            expected = Index(i.values.astype(dtype))
            tm.assert_index_equal(result, expected)

        # invalid
        for dtype in ['M8[ns]', 'm8[ns]']:
            pytest.raises(TypeError, lambda: i.astype(dtype))

        # GH 13149
        for dtype in ['int16', 'int32', 'int64']:
            i = Float64Index([0, 1.1, np.NAN])
            pytest.raises(ValueError, lambda: i.astype(dtype))

    def test_equals_numeric(self):

        i = Float64Index([1.0, 2.0])
        assert i.equals(i)
        assert i.identical(i)

        i2 = Float64Index([1.0, 2.0])
        assert i.equals(i2)

        i = Float64Index([1.0, np.nan])
        assert i.equals(i)
        assert i.identical(i)

        i2 = Float64Index([1.0, np.nan])
        assert i.equals(i2)

    def test_get_indexer(self):
        idx = Float64Index([0.0, 1.0, 2.0])
        tm.assert_numpy_array_equal(idx.get_indexer(idx),
                                    np.array([0, 1, 2], dtype=np.intp))

        target = [-0.1, 0.5, 1.1]
        tm.assert_numpy_array_equal(idx.get_indexer(target, 'pad'),
                                    np.array([-1, 0, 1], dtype=np.intp))
        tm.assert_numpy_array_equal(idx.get_indexer(target, 'backfill'),
                                    np.array([0, 1, 2], dtype=np.intp))
        tm.assert_numpy_array_equal(idx.get_indexer(target, 'nearest'),
                                    np.array([0, 1, 1], dtype=np.intp))

    def test_get_loc(self):
        idx = Float64Index([0.0, 1.0, 2.0])
        for method in [None, 'pad', 'backfill', 'nearest']:
            assert idx.get_loc(1, method) == 1
            if method is not None:
                assert idx.get_loc(1, method, tolerance=0) == 1

        for method, loc in [('pad', 1), ('backfill', 2), ('nearest', 1)]:
            assert idx.get_loc(1.1, method) == loc
            assert idx.get_loc(1.1, method, tolerance=0.9) == loc

        pytest.raises(KeyError, idx.get_loc, 'foo')
        pytest.raises(KeyError, idx.get_loc, 1.5)
        pytest.raises(KeyError, idx.get_loc, 1.5, method='pad',
                      tolerance=0.1)

        with tm.assert_raises_regex(ValueError, 'must be numeric'):
            idx.get_loc(1.4, method='nearest', tolerance='foo')

    def test_get_loc_na(self):
        idx = Float64Index([np.nan, 1, 2])
        assert idx.get_loc(1) == 1
        assert idx.get_loc(np.nan) == 0

        idx = Float64Index([np.nan, 1, np.nan])
        assert idx.get_loc(1) == 1

        # representable by slice [0:2:2]
        # pytest.raises(KeyError, idx.slice_locs, np.nan)
        sliced = idx.slice_locs(np.nan)
        assert isinstance(sliced, tuple)
        assert sliced == (0, 3)

        # not representable by slice
        idx = Float64Index([np.nan, 1, np.nan, np.nan])
        assert idx.get_loc(1) == 1
        pytest.raises(KeyError, idx.slice_locs, np.nan)

    def test_contains_nans(self):
        i = Float64Index([1.0, 2.0, np.nan])
        assert np.nan in i

    def test_contains_not_nans(self):
        i = Float64Index([1.0, 2.0, np.nan])
        assert 1.0 in i

    def test_doesnt_contain_all_the_things(self):
        i = Float64Index([np.nan])
        assert not i.isin([0]).item()
        assert not i.isin([1]).item()
        assert i.isin([np.nan]).item()

    def test_nan_multiple_containment(self):
        i = Float64Index([1.0, np.nan])
        tm.assert_numpy_array_equal(i.isin([1.0]), np.array([True, False]))
        tm.assert_numpy_array_equal(i.isin([2.0, np.pi]),
                                    np.array([False, False]))
        tm.assert_numpy_array_equal(i.isin([np.nan]), np.array([False, True]))
        tm.assert_numpy_array_equal(i.isin([1.0, np.nan]),
                                    np.array([True, True]))
        i = Float64Index([1.0, 2.0])
        tm.assert_numpy_array_equal(i.isin([np.nan]), np.array([False, False]))

    def test_astype_from_object(self):
        index = Index([1.0, np.nan, 0.2], dtype='object')
        result = index.astype(float)
        expected = Float64Index([1.0, np.nan, 0.2])
        assert result.dtype == expected.dtype
        tm.assert_index_equal(result, expected)

    def test_fillna_float64(self):
        # GH 11343
        idx = Index([1.0, np.nan, 3.0], dtype=float, name='x')
        # can't downcast
        exp = Index([1.0, 0.1, 3.0], name='x')
        tm.assert_index_equal(idx.fillna(0.1), exp)

        # downcast
        exp = Float64Index([1.0, 2.0, 3.0], name='x')
        tm.assert_index_equal(idx.fillna(2), exp)

        # object
        exp = Index([1.0, 'obj', 3.0], name='x')
        tm.assert_index_equal(idx.fillna('obj'), exp)

    def test_take_fill_value(self):
        # GH 12631
        idx = pd.Float64Index([1., 2., 3.], name='xxx')
        result = idx.take(np.array([1, 0, -1]))
        expected = pd.Float64Index([2., 1., 3.], name='xxx')
        tm.assert_index_equal(result, expected)

        # fill_value
        result = idx.take(np.array([1, 0, -1]), fill_value=True)
        expected = pd.Float64Index([2., 1., np.nan], name='xxx')
        tm.assert_index_equal(result, expected)

        # allow_fill=False
        result = idx.take(np.array([1, 0, -1]), allow_fill=False,
                          fill_value=True)
        expected = pd.Float64Index([2., 1., 3.], name='xxx')
        tm.assert_index_equal(result, expected)

        msg = ('When allow_fill=True and fill_value is not None, '
               'all indices must be >= -1')
        with tm.assert_raises_regex(ValueError, msg):
            idx.take(np.array([1, 0, -2]), fill_value=True)
        with tm.assert_raises_regex(ValueError, msg):
            idx.take(np.array([1, 0, -5]), fill_value=True)

        with pytest.raises(IndexError):
            idx.take(np.array([1, -5]))


class NumericInt(Numeric):

    def test_view(self):
        super(NumericInt, self).test_view()

        i = self._holder([], name='Foo')
        i_view = i.view()
        assert i_view.name == 'Foo'

        i_view = i.view(self._dtype)
        tm.assert_index_equal(i, self._holder(i_view, name='Foo'))

        i_view = i.view(self._holder)
        tm.assert_index_equal(i, self._holder(i_view, name='Foo'))

    def test_is_monotonic(self):
        assert self.index.is_monotonic
        assert self.index.is_monotonic_increasing
        assert self.index._is_strictly_monotonic_increasing
        assert not self.index.is_monotonic_decreasing
        assert not self.index._is_strictly_monotonic_decreasing

        index = self._holder([4, 3, 2, 1])
        assert not index.is_monotonic
        assert not index._is_strictly_monotonic_increasing
        assert index._is_strictly_monotonic_decreasing

        index = self._holder([1])
        assert index.is_monotonic
        assert index.is_monotonic_increasing
        assert index.is_monotonic_decreasing
        assert index._is_strictly_monotonic_increasing
        assert index._is_strictly_monotonic_decreasing

    def test_is_strictly_monotonic(self):
        index = self._holder([1, 1, 2, 3])
        assert index.is_monotonic_increasing
        assert not index._is_strictly_monotonic_increasing

        index = self._holder([3, 2, 1, 1])
        assert index.is_monotonic_decreasing
        assert not index._is_strictly_monotonic_decreasing

        index = self._holder([1, 1])
        assert index.is_monotonic_increasing
        assert index.is_monotonic_decreasing
        assert not index._is_strictly_monotonic_increasing
        assert not index._is_strictly_monotonic_decreasing

    def test_logical_compat(self):
        idx = self.create_index()
        assert idx.all() == idx.values.all()
        assert idx.any() == idx.values.any()

    def test_identical(self):
        i = Index(self.index.copy())
        assert i.identical(self.index)

        same_values_different_type = Index(i, dtype=object)
        assert not i.identical(same_values_different_type)

        i = self.index.copy(dtype=object)
        i = i.rename('foo')
        same_values = Index(i, dtype=object)
        assert same_values.identical(i)

        assert not i.identical(self.index)
        assert Index(same_values, name='foo', dtype=object).identical(i)

        assert not self.index.copy(dtype=object).identical(
            self.index.copy(dtype=self._dtype))

    def test_join_non_unique(self):
        left = Index([4, 4, 3, 3])

        joined, lidx, ridx = left.join(left, return_indexers=True)

        exp_joined = Index([3, 3, 3, 3, 4, 4, 4, 4])
        tm.assert_index_equal(joined, exp_joined)

        exp_lidx = np.array([2, 2, 3, 3, 0, 0, 1, 1], dtype=np.intp)
        tm.assert_numpy_array_equal(lidx, exp_lidx)

        exp_ridx = np.array([2, 3, 2, 3, 0, 1, 0, 1], dtype=np.intp)
        tm.assert_numpy_array_equal(ridx, exp_ridx)

    def test_join_self(self):
        kinds = 'outer', 'inner', 'left', 'right'
        for kind in kinds:
            joined = self.index.join(self.index, how=kind)
            assert self.index is joined

    def test_union_noncomparable(self):
        from datetime import datetime, timedelta
        # corner case, non-Int64Index
        now = datetime.now()
        other = Index([now + timedelta(i) for i in range(4)], dtype=object)
        result = self.index.union(other)
        expected = Index(np.concatenate((self.index, other)))
        tm.assert_index_equal(result, expected)

        result = other.union(self.index)
        expected = Index(np.concatenate((other, self.index)))
        tm.assert_index_equal(result, expected)

    def test_cant_or_shouldnt_cast(self):
        # can't
        data = ['foo', 'bar', 'baz']
        pytest.raises(TypeError, self._holder, data)

        # shouldn't
        data = ['0', '1', '2']
        pytest.raises(TypeError, self._holder, data)

    def test_view_index(self):
        self.index.view(Index)

    def test_prevent_casting(self):
        result = self.index.astype('O')
        assert result.dtype == np.object_

    def test_take_preserve_name(self):
        index = self._holder([1, 2, 3, 4], name='foo')
        taken = index.take([3, 0, 1])
        assert index.name == taken.name

    def test_take_fill_value(self):
        # see gh-12631
        idx = self._holder([1, 2, 3], name='xxx')
        result = idx.take(np.array([1, 0, -1]))
        expected = self._holder([2, 1, 3], name='xxx')
        tm.assert_index_equal(result, expected)

        name = self._holder.__name__
        msg = ("Unable to fill values because "
               "{name} cannot contain NA").format(name=name)

        # fill_value=True
        with tm.assert_raises_regex(ValueError, msg):
            idx.take(np.array([1, 0, -1]), fill_value=True)

        # allow_fill=False
        result = idx.take(np.array([1, 0, -1]), allow_fill=False,
                          fill_value=True)
        expected = self._holder([2, 1, 3], name='xxx')
        tm.assert_index_equal(result, expected)

        with tm.assert_raises_regex(ValueError, msg):
            idx.take(np.array([1, 0, -2]), fill_value=True)
        with tm.assert_raises_regex(ValueError, msg):
            idx.take(np.array([1, 0, -5]), fill_value=True)

        with pytest.raises(IndexError):
            idx.take(np.array([1, -5]))

    def test_slice_keep_name(self):
        idx = self._holder([1, 2], name='asdf')
        assert idx.name == idx[1:].name

    def test_ufunc_coercions(self):
        idx = self._holder([1, 2, 3, 4, 5], name='x')

        result = np.sqrt(idx)
        assert isinstance(result, Float64Index)
        exp = Float64Index(np.sqrt(np.array([1, 2, 3, 4, 5])), name='x')
        tm.assert_index_equal(result, exp)

        result = np.divide(idx, 2.)
        assert isinstance(result, Float64Index)
        exp = Float64Index([0.5, 1., 1.5, 2., 2.5], name='x')
        tm.assert_index_equal(result, exp)

        # _evaluate_numeric_binop
        result = idx + 2.
        assert isinstance(result, Float64Index)
        exp = Float64Index([3., 4., 5., 6., 7.], name='x')
        tm.assert_index_equal(result, exp)

        result = idx - 2.
        assert isinstance(result, Float64Index)
        exp = Float64Index([-1., 0., 1., 2., 3.], name='x')
        tm.assert_index_equal(result, exp)

        result = idx * 1.
        assert isinstance(result, Float64Index)
        exp = Float64Index([1., 2., 3., 4., 5.], name='x')
        tm.assert_index_equal(result, exp)

        result = idx / 2.
        assert isinstance(result, Float64Index)
        exp = Float64Index([0.5, 1., 1.5, 2., 2.5], name='x')
        tm.assert_index_equal(result, exp)


class TestInt64Index(NumericInt):
    _dtype = 'int64'
    _holder = Int64Index

    def setup_method(self, method):
        self.indices = dict(index=Int64Index(np.arange(0, 20, 2)))
        self.setup_indices()

    def create_index(self):
        return Int64Index(np.arange(5, dtype='int64'))

    def test_constructor(self):
        # pass list, coerce fine
        index = Int64Index([-5, 0, 1, 2])
        expected = Index([-5, 0, 1, 2], dtype=np.int64)
        tm.assert_index_equal(index, expected)

        # from iterable
        index = Int64Index(iter([-5, 0, 1, 2]))
        tm.assert_index_equal(index, expected)

        # scalar raise Exception
        pytest.raises(TypeError, Int64Index, 5)

        # copy
        arr = self.index.values
        new_index = Int64Index(arr, copy=True)
        tm.assert_index_equal(new_index, self.index)
        val = arr[0] + 3000

        # this should not change index
        arr[0] = val
        assert new_index[0] != val

        # interpret list-like
        expected = Int64Index([5, 0])
        for cls in [Index, Int64Index]:
            for idx in [cls([5, 0], dtype='int64'),
                        cls(np.array([5, 0]), dtype='int64'),
                        cls(Series([5, 0]), dtype='int64')]:
                tm.assert_index_equal(idx, expected)

    def test_constructor_corner(self):
        arr = np.array([1, 2, 3, 4], dtype=object)
        index = Int64Index(arr)
        assert index.values.dtype == np.int64
        tm.assert_index_equal(index, Index(arr))

        # preventing casting
        arr = np.array([1, '2', 3, '4'], dtype=object)
        with tm.assert_raises_regex(TypeError, 'casting'):
            Int64Index(arr)

        arr_with_floats = [0, 2, 3, 4, 5, 1.25, 3, -1]
        with tm.assert_raises_regex(TypeError, 'casting'):
            Int64Index(arr_with_floats)

    def test_coerce_list(self):
        # coerce things
        arr = Index([1, 2, 3, 4])
        assert isinstance(arr, Int64Index)

        # but not if explicit dtype passed
        arr = Index([1, 2, 3, 4], dtype=object)
        assert isinstance(arr, Index)

    def test_where(self):
        i = self.create_index()
        result = i.where(notnull(i))
        expected = i
        tm.assert_index_equal(result, expected)

        _nan = i._na_value
        cond = [False] + [True] * len(i[1:])
        expected = pd.Index([_nan] + i[1:].tolist())

        result = i.where(cond)
        tm.assert_index_equal(result, expected)

    def test_where_array_like(self):
        i = self.create_index()

        _nan = i._na_value
        cond = [False] + [True] * (len(i) - 1)
        klasses = [list, tuple, np.array, pd.Series]
        expected = pd.Index([_nan] + i[1:].tolist())

        for klass in klasses:
            result = i.where(klass(cond))
            tm.assert_index_equal(result, expected)

    def test_get_indexer(self):
        target = Int64Index(np.arange(10))
        indexer = self.index.get_indexer(target)
        expected = np.array([0, -1, 1, -1, 2, -1, 3, -1, 4, -1], dtype=np.intp)
        tm.assert_numpy_array_equal(indexer, expected)

        target = Int64Index(np.arange(10))
        indexer = self.index.get_indexer(target, method='pad')
        expected = np.array([0, 0, 1, 1, 2, 2, 3, 3, 4, 4], dtype=np.intp)
        tm.assert_numpy_array_equal(indexer, expected)

        target = Int64Index(np.arange(10))
        indexer = self.index.get_indexer(target, method='backfill')
        expected = np.array([0, 1, 1, 2, 2, 3, 3, 4, 4, 5], dtype=np.intp)
        tm.assert_numpy_array_equal(indexer, expected)

    def test_intersection(self):
        other = Index([1, 2, 3, 4, 5])
        result = self.index.intersection(other)
        expected = Index(np.sort(np.intersect1d(self.index.values,
                                                other.values)))
        tm.assert_index_equal(result, expected)

        result = other.intersection(self.index)
        expected = Index(np.sort(np.asarray(np.intersect1d(self.index.values,
                                                           other.values))))
        tm.assert_index_equal(result, expected)

    def test_join_inner(self):
        other = Int64Index([7, 12, 25, 1, 2, 5])
        other_mono = Int64Index([1, 2, 5, 7, 12, 25])

        # not monotonic
        res, lidx, ridx = self.index.join(other, how='inner',
                                          return_indexers=True)

        # no guarantee of sortedness, so sort for comparison purposes
        ind = res.argsort()
        res = res.take(ind)
        lidx = lidx.take(ind)
        ridx = ridx.take(ind)

        eres = Int64Index([2, 12])
        elidx = np.array([1, 6], dtype=np.intp)
        eridx = np.array([4, 1], dtype=np.intp)

        assert isinstance(res, Int64Index)
        tm.assert_index_equal(res, eres)
        tm.assert_numpy_array_equal(lidx, elidx)
        tm.assert_numpy_array_equal(ridx, eridx)

        # monotonic
        res, lidx, ridx = self.index.join(other_mono, how='inner',
                                          return_indexers=True)

        res2 = self.index.intersection(other_mono)
        tm.assert_index_equal(res, res2)

        elidx = np.array([1, 6], dtype=np.intp)
        eridx = np.array([1, 4], dtype=np.intp)
        assert isinstance(res, Int64Index)
        tm.assert_index_equal(res, eres)
        tm.assert_numpy_array_equal(lidx, elidx)
        tm.assert_numpy_array_equal(ridx, eridx)

    def test_join_left(self):
        other = Int64Index([7, 12, 25, 1, 2, 5])
        other_mono = Int64Index([1, 2, 5, 7, 12, 25])

        # not monotonic
        res, lidx, ridx = self.index.join(other, how='left',
                                          return_indexers=True)
        eres = self.index
        eridx = np.array([-1, 4, -1, -1, -1, -1, 1, -1, -1, -1],
                         dtype=np.intp)

        assert isinstance(res, Int64Index)
        tm.assert_index_equal(res, eres)
        assert lidx is None
        tm.assert_numpy_array_equal(ridx, eridx)

        # monotonic
        res, lidx, ridx = self.index.join(other_mono, how='left',
                                          return_indexers=True)
        eridx = np.array([-1, 1, -1, -1, -1, -1, 4, -1, -1, -1],
                         dtype=np.intp)
        assert isinstance(res, Int64Index)
        tm.assert_index_equal(res, eres)
        assert lidx is None
        tm.assert_numpy_array_equal(ridx, eridx)

        # non-unique
        idx = Index([1, 1, 2, 5])
        idx2 = Index([1, 2, 5, 7, 9])
        res, lidx, ridx = idx2.join(idx, how='left', return_indexers=True)
        eres = Index([1, 1, 2, 5, 7, 9])  # 1 is in idx2, so it should be x2
        eridx = np.array([0, 1, 2, 3, -1, -1], dtype=np.intp)
        elidx = np.array([0, 0, 1, 2, 3, 4], dtype=np.intp)
        tm.assert_index_equal(res, eres)
        tm.assert_numpy_array_equal(lidx, elidx)
        tm.assert_numpy_array_equal(ridx, eridx)

    def test_join_right(self):
        other = Int64Index([7, 12, 25, 1, 2, 5])
        other_mono = Int64Index([1, 2, 5, 7, 12, 25])

        # not monotonic
        res, lidx, ridx = self.index.join(other, how='right',
                                          return_indexers=True)
        eres = other
        elidx = np.array([-1, 6, -1, -1, 1, -1], dtype=np.intp)

        assert isinstance(other, Int64Index)
        tm.assert_index_equal(res, eres)
        tm.assert_numpy_array_equal(lidx, elidx)
        assert ridx is None

        # monotonic
        res, lidx, ridx = self.index.join(other_mono, how='right',
                                          return_indexers=True)
        eres = other_mono
        elidx = np.array([-1, 1, -1, -1, 6, -1], dtype=np.intp)
        assert isinstance(other, Int64Index)
        tm.assert_index_equal(res, eres)
        tm.assert_numpy_array_equal(lidx, elidx)
        assert ridx is None

        # non-unique
        idx = Index([1, 1, 2, 5])
        idx2 = Index([1, 2, 5, 7, 9])
        res, lidx, ridx = idx.join(idx2, how='right', return_indexers=True)
        eres = Index([1, 1, 2, 5, 7, 9])  # 1 is in idx2, so it should be x2
        elidx = np.array([0, 1, 2, 3, -1, -1], dtype=np.intp)
        eridx = np.array([0, 0, 1, 2, 3, 4], dtype=np.intp)
        tm.assert_index_equal(res, eres)
        tm.assert_numpy_array_equal(lidx, elidx)
        tm.assert_numpy_array_equal(ridx, eridx)

    def test_join_non_int_index(self):
        other = Index([3, 6, 7, 8, 10], dtype=object)

        outer = self.index.join(other, how='outer')
        outer2 = other.join(self.index, how='outer')
        expected = Index([0, 2, 3, 4, 6, 7, 8, 10, 12, 14, 16, 18])
        tm.assert_index_equal(outer, outer2)
        tm.assert_index_equal(outer, expected)

        inner = self.index.join(other, how='inner')
        inner2 = other.join(self.index, how='inner')
        expected = Index([6, 8, 10])
        tm.assert_index_equal(inner, inner2)
        tm.assert_index_equal(inner, expected)

        left = self.index.join(other, how='left')
        tm.assert_index_equal(left, self.index.astype(object))

        left2 = other.join(self.index, how='left')
        tm.assert_index_equal(left2, other)

        right = self.index.join(other, how='right')
        tm.assert_index_equal(right, other)

        right2 = other.join(self.index, how='right')
        tm.assert_index_equal(right2, self.index.astype(object))

    def test_join_outer(self):
        other = Int64Index([7, 12, 25, 1, 2, 5])
        other_mono = Int64Index([1, 2, 5, 7, 12, 25])

        # not monotonic
        # guarantee of sortedness
        res, lidx, ridx = self.index.join(other, how='outer',
                                          return_indexers=True)
        noidx_res = self.index.join(other, how='outer')
        tm.assert_index_equal(res, noidx_res)

        eres = Int64Index([0, 1, 2, 4, 5, 6, 7, 8, 10, 12, 14, 16, 18, 25])
        elidx = np.array([0, -1, 1, 2, -1, 3, -1, 4, 5, 6, 7, 8, 9, -1],
                         dtype=np.intp)
        eridx = np.array([-1, 3, 4, -1, 5, -1, 0, -1, -1, 1, -1, -1, -1, 2],
                         dtype=np.intp)

        assert isinstance(res, Int64Index)
        tm.assert_index_equal(res, eres)
        tm.assert_numpy_array_equal(lidx, elidx)
        tm.assert_numpy_array_equal(ridx, eridx)

        # monotonic
        res, lidx, ridx = self.index.join(other_mono, how='outer',
                                          return_indexers=True)
        noidx_res = self.index.join(other_mono, how='outer')
        tm.assert_index_equal(res, noidx_res)

        elidx = np.array([0, -1, 1, 2, -1, 3, -1, 4, 5, 6, 7, 8, 9, -1],
                         dtype=np.intp)
        eridx = np.array([-1, 0, 1, -1, 2, -1, 3, -1, -1, 4, -1, -1, -1, 5],
                         dtype=np.intp)
        assert isinstance(res, Int64Index)
        tm.assert_index_equal(res, eres)
        tm.assert_numpy_array_equal(lidx, elidx)
        tm.assert_numpy_array_equal(ridx, eridx)


class TestUInt64Index(NumericInt):

    _dtype = 'uint64'
    _holder = UInt64Index

    def setup_method(self, method):
        self.indices = dict(index=UInt64Index([2**63, 2**63 + 10, 2**63 + 15,
                                               2**63 + 20, 2**63 + 25]))
        self.setup_indices()

    def create_index(self):
        return UInt64Index(np.arange(5, dtype='uint64'))

    def test_constructor(self):
        idx = UInt64Index([1, 2, 3])
        res = Index([1, 2, 3], dtype=np.uint64)
        tm.assert_index_equal(res, idx)

        idx = UInt64Index([1, 2**63])
        res = Index([1, 2**63], dtype=np.uint64)
        tm.assert_index_equal(res, idx)

        idx = UInt64Index([1, 2**63])
        res = Index([1, 2**63])
        tm.assert_index_equal(res, idx)

        idx = Index([-1, 2**63], dtype=object)
        res = Index(np.array([-1, 2**63], dtype=object))
        tm.assert_index_equal(res, idx)

    def test_get_indexer(self):
        target = UInt64Index(np.arange(10).astype('uint64') * 5 + 2**63)
        indexer = self.index.get_indexer(target)
        expected = np.array([0, -1, 1, 2, 3, 4,
                             -1, -1, -1, -1], dtype=np.intp)
        tm.assert_numpy_array_equal(indexer, expected)

        target = UInt64Index(np.arange(10).astype('uint64') * 5 + 2**63)
        indexer = self.index.get_indexer(target, method='pad')
        expected = np.array([0, 0, 1, 2, 3, 4,
                             4, 4, 4, 4], dtype=np.intp)
        tm.assert_numpy_array_equal(indexer, expected)

        target = UInt64Index(np.arange(10).astype('uint64') * 5 + 2**63)
        indexer = self.index.get_indexer(target, method='backfill')
        expected = np.array([0, 1, 1, 2, 3, 4,
                             -1, -1, -1, -1], dtype=np.intp)
        tm.assert_numpy_array_equal(indexer, expected)

    def test_intersection(self):
        other = Index([2**63, 2**63 + 5, 2**63 + 10, 2**63 + 15, 2**63 + 20])
        result = self.index.intersection(other)
        expected = Index(np.sort(np.intersect1d(self.index.values,
                                                other.values)))
        tm.assert_index_equal(result, expected)

        result = other.intersection(self.index)
        expected = Index(np.sort(np.asarray(np.intersect1d(self.index.values,
                                                           other.values))))
        tm.assert_index_equal(result, expected)

    def test_join_inner(self):
        other = UInt64Index(2**63 + np.array(
            [7, 12, 25, 1, 2, 10], dtype='uint64'))
        other_mono = UInt64Index(2**63 + np.array(
            [1, 2, 7, 10, 12, 25], dtype='uint64'))

        # not monotonic
        res, lidx, ridx = self.index.join(other, how='inner',
                                          return_indexers=True)

        # no guarantee of sortedness, so sort for comparison purposes
        ind = res.argsort()
        res = res.take(ind)
        lidx = lidx.take(ind)
        ridx = ridx.take(ind)

        eres = UInt64Index(2**63 + np.array([10, 25], dtype='uint64'))
        elidx = np.array([1, 4], dtype=np.intp)
        eridx = np.array([5, 2], dtype=np.intp)

        assert isinstance(res, UInt64Index)
        tm.assert_index_equal(res, eres)
        tm.assert_numpy_array_equal(lidx, elidx)
        tm.assert_numpy_array_equal(ridx, eridx)

        # monotonic
        res, lidx, ridx = self.index.join(other_mono, how='inner',
                                          return_indexers=True)

        res2 = self.index.intersection(other_mono)
        tm.assert_index_equal(res, res2)

        elidx = np.array([1, 4], dtype=np.intp)
        eridx = np.array([3, 5], dtype=np.intp)

        assert isinstance(res, UInt64Index)
        tm.assert_index_equal(res, eres)
        tm.assert_numpy_array_equal(lidx, elidx)
        tm.assert_numpy_array_equal(ridx, eridx)

    def test_join_left(self):
        other = UInt64Index(2**63 + np.array(
            [7, 12, 25, 1, 2, 10], dtype='uint64'))
        other_mono = UInt64Index(2**63 + np.array(
            [1, 2, 7, 10, 12, 25], dtype='uint64'))

        # not monotonic
        res, lidx, ridx = self.index.join(other, how='left',
                                          return_indexers=True)
        eres = self.index
        eridx = np.array([-1, 5, -1, -1, 2], dtype=np.intp)

        assert isinstance(res, UInt64Index)
        tm.assert_index_equal(res, eres)
        assert lidx is None
        tm.assert_numpy_array_equal(ridx, eridx)

        # monotonic
        res, lidx, ridx = self.index.join(other_mono, how='left',
                                          return_indexers=True)
        eridx = np.array([-1, 3, -1, -1, 5], dtype=np.intp)

        assert isinstance(res, UInt64Index)
        tm.assert_index_equal(res, eres)
        assert lidx is None
        tm.assert_numpy_array_equal(ridx, eridx)

        # non-unique
        idx = UInt64Index(2**63 + np.array([1, 1, 2, 5], dtype='uint64'))
        idx2 = UInt64Index(2**63 + np.array([1, 2, 5, 7, 9], dtype='uint64'))
        res, lidx, ridx = idx2.join(idx, how='left', return_indexers=True)

        # 1 is in idx2, so it should be x2
        eres = UInt64Index(2**63 + np.array(
            [1, 1, 2, 5, 7, 9], dtype='uint64'))
        eridx = np.array([0, 1, 2, 3, -1, -1], dtype=np.intp)
        elidx = np.array([0, 0, 1, 2, 3, 4], dtype=np.intp)

        tm.assert_index_equal(res, eres)
        tm.assert_numpy_array_equal(lidx, elidx)
        tm.assert_numpy_array_equal(ridx, eridx)

    def test_join_right(self):
        other = UInt64Index(2**63 + np.array(
            [7, 12, 25, 1, 2, 10], dtype='uint64'))
        other_mono = UInt64Index(2**63 + np.array(
            [1, 2, 7, 10, 12, 25], dtype='uint64'))

        # not monotonic
        res, lidx, ridx = self.index.join(other, how='right',
                                          return_indexers=True)
        eres = other
        elidx = np.array([-1, -1, 4, -1, -1, 1], dtype=np.intp)

        tm.assert_numpy_array_equal(lidx, elidx)
        assert isinstance(other, UInt64Index)
        tm.assert_index_equal(res, eres)
        assert ridx is None

        # monotonic
        res, lidx, ridx = self.index.join(other_mono, how='right',
                                          return_indexers=True)
        eres = other_mono
        elidx = np.array([-1, -1, -1, 1, -1, 4], dtype=np.intp)

        assert isinstance(other, UInt64Index)
        tm.assert_numpy_array_equal(lidx, elidx)
        tm.assert_index_equal(res, eres)
        assert ridx is None

        # non-unique
        idx = UInt64Index(2**63 + np.array([1, 1, 2, 5], dtype='uint64'))
        idx2 = UInt64Index(2**63 + np.array([1, 2, 5, 7, 9], dtype='uint64'))
        res, lidx, ridx = idx.join(idx2, how='right', return_indexers=True)

        # 1 is in idx2, so it should be x2
        eres = UInt64Index(2**63 + np.array(
            [1, 1, 2, 5, 7, 9], dtype='uint64'))
        elidx = np.array([0, 1, 2, 3, -1, -1], dtype=np.intp)
        eridx = np.array([0, 0, 1, 2, 3, 4], dtype=np.intp)

        tm.assert_index_equal(res, eres)
        tm.assert_numpy_array_equal(lidx, elidx)
        tm.assert_numpy_array_equal(ridx, eridx)

    def test_join_non_int_index(self):
        other = Index(2**63 + np.array(
            [1, 5, 7, 10, 20], dtype='uint64'), dtype=object)

        outer = self.index.join(other, how='outer')
        outer2 = other.join(self.index, how='outer')
        expected = Index(2**63 + np.array(
            [0, 1, 5, 7, 10, 15, 20, 25], dtype='uint64'))
        tm.assert_index_equal(outer, outer2)
        tm.assert_index_equal(outer, expected)

        inner = self.index.join(other, how='inner')
        inner2 = other.join(self.index, how='inner')
        expected = Index(2**63 + np.array([10, 20], dtype='uint64'))
        tm.assert_index_equal(inner, inner2)
        tm.assert_index_equal(inner, expected)

        left = self.index.join(other, how='left')
        tm.assert_index_equal(left, self.index.astype(object))

        left2 = other.join(self.index, how='left')
        tm.assert_index_equal(left2, other)

        right = self.index.join(other, how='right')
        tm.assert_index_equal(right, other)

        right2 = other.join(self.index, how='right')
        tm.assert_index_equal(right2, self.index.astype(object))

    def test_join_outer(self):
        other = UInt64Index(2**63 + np.array(
            [7, 12, 25, 1, 2, 10], dtype='uint64'))
        other_mono = UInt64Index(2**63 + np.array(
            [1, 2, 7, 10, 12, 25], dtype='uint64'))

        # not monotonic
        # guarantee of sortedness
        res, lidx, ridx = self.index.join(other, how='outer',
                                          return_indexers=True)
        noidx_res = self.index.join(other, how='outer')
        tm.assert_index_equal(res, noidx_res)

        eres = UInt64Index(2**63 + np.array(
            [0, 1, 2, 7, 10, 12, 15, 20, 25], dtype='uint64'))
        elidx = np.array([0, -1, -1, -1, 1, -1, 2, 3, 4], dtype=np.intp)
        eridx = np.array([-1, 3, 4, 0, 5, 1, -1, -1, 2], dtype=np.intp)

        assert isinstance(res, UInt64Index)
        tm.assert_index_equal(res, eres)
        tm.assert_numpy_array_equal(lidx, elidx)
        tm.assert_numpy_array_equal(ridx, eridx)

        # monotonic
        res, lidx, ridx = self.index.join(other_mono, how='outer',
                                          return_indexers=True)
        noidx_res = self.index.join(other_mono, how='outer')
        tm.assert_index_equal(res, noidx_res)

        elidx = np.array([0, -1, -1, -1, 1, -1, 2, 3, 4], dtype=np.intp)
        eridx = np.array([-1, 0, 1, 2, 3, 4, -1, -1, 5], dtype=np.intp)

        assert isinstance(res, UInt64Index)
        tm.assert_index_equal(res, eres)
        tm.assert_numpy_array_equal(lidx, elidx)
        tm.assert_numpy_array_equal(ridx, eridx)
