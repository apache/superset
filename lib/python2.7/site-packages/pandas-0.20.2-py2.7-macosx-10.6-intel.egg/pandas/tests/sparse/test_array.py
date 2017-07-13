from pandas.compat import range

import re
import operator
import pytest
import warnings

from numpy import nan
import numpy as np

from pandas import _np_version_under1p8
from pandas.core.sparse.api import SparseArray, SparseSeries
from pandas._libs.sparse import IntIndex
from pandas.util.testing import assert_almost_equal
import pandas.util.testing as tm


class TestSparseArray(object):

    def setup_method(self, method):
        self.arr_data = np.array([nan, nan, 1, 2, 3, nan, 4, 5, nan, 6])
        self.arr = SparseArray(self.arr_data)
        self.zarr = SparseArray([0, 0, 1, 2, 3, 0, 4, 5, 0, 6], fill_value=0)

    def test_constructor_dtype(self):
        arr = SparseArray([np.nan, 1, 2, np.nan])
        assert arr.dtype == np.float64
        assert np.isnan(arr.fill_value)

        arr = SparseArray([np.nan, 1, 2, np.nan], fill_value=0)
        assert arr.dtype == np.float64
        assert arr.fill_value == 0

        arr = SparseArray([0, 1, 2, 4], dtype=np.float64)
        assert arr.dtype == np.float64
        assert np.isnan(arr.fill_value)

        arr = SparseArray([0, 1, 2, 4], dtype=np.int64)
        assert arr.dtype == np.int64
        assert arr.fill_value == 0

        arr = SparseArray([0, 1, 2, 4], fill_value=0, dtype=np.int64)
        assert arr.dtype == np.int64
        assert arr.fill_value == 0

        arr = SparseArray([0, 1, 2, 4], dtype=None)
        assert arr.dtype == np.int64
        assert arr.fill_value == 0

        arr = SparseArray([0, 1, 2, 4], fill_value=0, dtype=None)
        assert arr.dtype == np.int64
        assert arr.fill_value == 0

    def test_constructor_object_dtype(self):
        # GH 11856
        arr = SparseArray(['A', 'A', np.nan, 'B'], dtype=np.object)
        assert arr.dtype == np.object
        assert np.isnan(arr.fill_value)

        arr = SparseArray(['A', 'A', np.nan, 'B'], dtype=np.object,
                          fill_value='A')
        assert arr.dtype == np.object
        assert arr.fill_value == 'A'

    def test_constructor_spindex_dtype(self):
        arr = SparseArray(data=[1, 2], sparse_index=IntIndex(4, [1, 2]))
        tm.assert_sp_array_equal(arr, SparseArray([np.nan, 1, 2, np.nan]))
        assert arr.dtype == np.float64
        assert np.isnan(arr.fill_value)

        arr = SparseArray(data=[1, 2, 3],
                          sparse_index=IntIndex(4, [1, 2, 3]),
                          dtype=np.int64, fill_value=0)
        exp = SparseArray([0, 1, 2, 3], dtype=np.int64, fill_value=0)
        tm.assert_sp_array_equal(arr, exp)
        assert arr.dtype == np.int64
        assert arr.fill_value == 0

        arr = SparseArray(data=[1, 2], sparse_index=IntIndex(4, [1, 2]),
                          fill_value=0, dtype=np.int64)
        exp = SparseArray([0, 1, 2, 0], fill_value=0, dtype=np.int64)
        tm.assert_sp_array_equal(arr, exp)
        assert arr.dtype == np.int64
        assert arr.fill_value == 0

        arr = SparseArray(data=[1, 2, 3],
                          sparse_index=IntIndex(4, [1, 2, 3]),
                          dtype=None, fill_value=0)
        exp = SparseArray([0, 1, 2, 3], dtype=None)
        tm.assert_sp_array_equal(arr, exp)
        assert arr.dtype == np.int64
        assert arr.fill_value == 0

        # scalar input
        arr = SparseArray(data=1, sparse_index=IntIndex(1, [0]), dtype=None)
        exp = SparseArray([1], dtype=None)
        tm.assert_sp_array_equal(arr, exp)
        assert arr.dtype == np.int64
        assert arr.fill_value == 0

        arr = SparseArray(data=[1, 2], sparse_index=IntIndex(4, [1, 2]),
                          fill_value=0, dtype=None)
        exp = SparseArray([0, 1, 2, 0], fill_value=0, dtype=None)
        tm.assert_sp_array_equal(arr, exp)
        assert arr.dtype == np.int64
        assert arr.fill_value == 0

    def test_sparseseries_roundtrip(self):
        # GH 13999
        for kind in ['integer', 'block']:
            for fill in [1, np.nan, 0]:
                arr = SparseArray([np.nan, 1, np.nan, 2, 3], kind=kind,
                                  fill_value=fill)
                res = SparseArray(SparseSeries(arr))
                tm.assert_sp_array_equal(arr, res)

                arr = SparseArray([0, 0, 0, 1, 1, 2], dtype=np.int64,
                                  kind=kind, fill_value=fill)
                res = SparseArray(SparseSeries(arr), dtype=np.int64)
                tm.assert_sp_array_equal(arr, res)

                res = SparseArray(SparseSeries(arr))
                tm.assert_sp_array_equal(arr, res)

            for fill in [True, False, np.nan]:
                arr = SparseArray([True, False, True, True], dtype=np.bool,
                                  kind=kind, fill_value=fill)
                res = SparseArray(SparseSeries(arr))
                tm.assert_sp_array_equal(arr, res)

                res = SparseArray(SparseSeries(arr))
                tm.assert_sp_array_equal(arr, res)

    def test_get_item(self):

        assert np.isnan(self.arr[1])
        assert self.arr[2] == 1
        assert self.arr[7] == 5

        assert self.zarr[0] == 0
        assert self.zarr[2] == 1
        assert self.zarr[7] == 5

        errmsg = re.compile("bounds")
        tm.assert_raises_regex(IndexError, errmsg, lambda: self.arr[11])
        tm.assert_raises_regex(IndexError, errmsg, lambda: self.arr[-11])
        assert self.arr[-1] == self.arr[len(self.arr) - 1]

    def test_take(self):
        assert np.isnan(self.arr.take(0))
        assert np.isscalar(self.arr.take(2))

        # np.take in < 1.8 doesn't support scalar indexing
        if not _np_version_under1p8:
            assert self.arr.take(2) == np.take(self.arr_data, 2)
            assert self.arr.take(6) == np.take(self.arr_data, 6)

        exp = SparseArray(np.take(self.arr_data, [2, 3]))
        tm.assert_sp_array_equal(self.arr.take([2, 3]), exp)

        exp = SparseArray(np.take(self.arr_data, [0, 1, 2]))
        tm.assert_sp_array_equal(self.arr.take([0, 1, 2]), exp)

    def test_take_fill_value(self):
        data = np.array([1, np.nan, 0, 3, 0])
        sparse = SparseArray(data, fill_value=0)

        exp = SparseArray(np.take(data, [0]), fill_value=0)
        tm.assert_sp_array_equal(sparse.take([0]), exp)

        exp = SparseArray(np.take(data, [1, 3, 4]), fill_value=0)
        tm.assert_sp_array_equal(sparse.take([1, 3, 4]), exp)

    def test_take_negative(self):
        exp = SparseArray(np.take(self.arr_data, [-1]))
        tm.assert_sp_array_equal(self.arr.take([-1]), exp)

        exp = SparseArray(np.take(self.arr_data, [-4, -3, -2]))
        tm.assert_sp_array_equal(self.arr.take([-4, -3, -2]), exp)

    def test_bad_take(self):
        tm.assert_raises_regex(
            IndexError, "bounds", lambda: self.arr.take(11))
        pytest.raises(IndexError, lambda: self.arr.take(-11))

    def test_take_invalid_kwargs(self):
        msg = r"take\(\) got an unexpected keyword argument 'foo'"
        tm.assert_raises_regex(TypeError, msg, self.arr.take,
                               [2, 3], foo=2)

        msg = "the 'out' parameter is not supported"
        tm.assert_raises_regex(ValueError, msg, self.arr.take,
                               [2, 3], out=self.arr)

        msg = "the 'mode' parameter is not supported"
        tm.assert_raises_regex(ValueError, msg, self.arr.take,
                               [2, 3], mode='clip')

    def test_take_filling(self):
        # similar tests as GH 12631
        sparse = SparseArray([np.nan, np.nan, 1, np.nan, 4])
        result = sparse.take(np.array([1, 0, -1]))
        expected = SparseArray([np.nan, np.nan, 4])
        tm.assert_sp_array_equal(result, expected)

        # fill_value
        result = sparse.take(np.array([1, 0, -1]), fill_value=True)
        expected = SparseArray([np.nan, np.nan, np.nan])
        tm.assert_sp_array_equal(result, expected)

        # allow_fill=False
        result = sparse.take(np.array([1, 0, -1]),
                             allow_fill=False, fill_value=True)
        expected = SparseArray([np.nan, np.nan, 4])
        tm.assert_sp_array_equal(result, expected)

        msg = ('When allow_fill=True and fill_value is not None, '
               'all indices must be >= -1')
        with tm.assert_raises_regex(ValueError, msg):
            sparse.take(np.array([1, 0, -2]), fill_value=True)
        with tm.assert_raises_regex(ValueError, msg):
            sparse.take(np.array([1, 0, -5]), fill_value=True)

        with pytest.raises(IndexError):
            sparse.take(np.array([1, -6]))
        with pytest.raises(IndexError):
            sparse.take(np.array([1, 5]))
        with pytest.raises(IndexError):
            sparse.take(np.array([1, 5]), fill_value=True)

    def test_take_filling_fill_value(self):
        # same tests as GH 12631
        sparse = SparseArray([np.nan, 0, 1, 0, 4], fill_value=0)
        result = sparse.take(np.array([1, 0, -1]))
        expected = SparseArray([0, np.nan, 4], fill_value=0)
        tm.assert_sp_array_equal(result, expected)

        # fill_value
        result = sparse.take(np.array([1, 0, -1]), fill_value=True)
        expected = SparseArray([0, np.nan, 0], fill_value=0)
        tm.assert_sp_array_equal(result, expected)

        # allow_fill=False
        result = sparse.take(np.array([1, 0, -1]),
                             allow_fill=False, fill_value=True)
        expected = SparseArray([0, np.nan, 4], fill_value=0)
        tm.assert_sp_array_equal(result, expected)

        msg = ('When allow_fill=True and fill_value is not None, '
               'all indices must be >= -1')
        with tm.assert_raises_regex(ValueError, msg):
            sparse.take(np.array([1, 0, -2]), fill_value=True)
        with tm.assert_raises_regex(ValueError, msg):
            sparse.take(np.array([1, 0, -5]), fill_value=True)

        with pytest.raises(IndexError):
            sparse.take(np.array([1, -6]))
        with pytest.raises(IndexError):
            sparse.take(np.array([1, 5]))
        with pytest.raises(IndexError):
            sparse.take(np.array([1, 5]), fill_value=True)

    def test_take_filling_all_nan(self):
        sparse = SparseArray([np.nan, np.nan, np.nan, np.nan, np.nan])
        result = sparse.take(np.array([1, 0, -1]))
        expected = SparseArray([np.nan, np.nan, np.nan])
        tm.assert_sp_array_equal(result, expected)

        result = sparse.take(np.array([1, 0, -1]), fill_value=True)
        expected = SparseArray([np.nan, np.nan, np.nan])
        tm.assert_sp_array_equal(result, expected)

        with pytest.raises(IndexError):
            sparse.take(np.array([1, -6]))
        with pytest.raises(IndexError):
            sparse.take(np.array([1, 5]))
        with pytest.raises(IndexError):
            sparse.take(np.array([1, 5]), fill_value=True)

    def test_set_item(self):
        def setitem():
            self.arr[5] = 3

        def setslice():
            self.arr[1:5] = 2

        tm.assert_raises_regex(TypeError, "item assignment", setitem)
        tm.assert_raises_regex(TypeError, "item assignment", setslice)

    def test_constructor_from_too_large_array(self):
        tm.assert_raises_regex(TypeError, "expected dimension <= 1 data",
                               SparseArray, np.arange(10).reshape((2, 5)))

    def test_constructor_from_sparse(self):
        res = SparseArray(self.zarr)
        assert res.fill_value == 0
        assert_almost_equal(res.sp_values, self.zarr.sp_values)

    def test_constructor_copy(self):
        cp = SparseArray(self.arr, copy=True)
        cp.sp_values[:3] = 0
        assert not (self.arr.sp_values[:3] == 0).any()

        not_copy = SparseArray(self.arr)
        not_copy.sp_values[:3] = 0
        assert (self.arr.sp_values[:3] == 0).all()

    def test_constructor_bool(self):
        # GH 10648
        data = np.array([False, False, True, True, False, False])
        arr = SparseArray(data, fill_value=False, dtype=bool)

        assert arr.dtype == bool
        tm.assert_numpy_array_equal(arr.sp_values, np.array([True, True]))
        tm.assert_numpy_array_equal(arr.sp_values, np.asarray(arr))
        tm.assert_numpy_array_equal(arr.sp_index.indices,
                                    np.array([2, 3], np.int32))

        for dense in [arr.to_dense(), arr.values]:
            assert dense.dtype == bool
            tm.assert_numpy_array_equal(dense, data)

    def test_constructor_bool_fill_value(self):
        arr = SparseArray([True, False, True], dtype=None)
        assert arr.dtype == np.bool
        assert not arr.fill_value

        arr = SparseArray([True, False, True], dtype=np.bool)
        assert arr.dtype == np.bool
        assert not arr.fill_value

        arr = SparseArray([True, False, True], dtype=np.bool, fill_value=True)
        assert arr.dtype == np.bool
        assert arr.fill_value

    def test_constructor_float32(self):
        # GH 10648
        data = np.array([1., np.nan, 3], dtype=np.float32)
        arr = SparseArray(data, dtype=np.float32)

        assert arr.dtype == np.float32
        tm.assert_numpy_array_equal(arr.sp_values,
                                    np.array([1, 3], dtype=np.float32))
        tm.assert_numpy_array_equal(arr.sp_values, np.asarray(arr))
        tm.assert_numpy_array_equal(arr.sp_index.indices,
                                    np.array([0, 2], dtype=np.int32))

        for dense in [arr.to_dense(), arr.values]:
            assert dense.dtype == np.float32
            tm.assert_numpy_array_equal(dense, data)

    def test_astype(self):
        res = self.arr.astype('f8')
        res.sp_values[:3] = 27
        assert not (self.arr.sp_values[:3] == 27).any()

        msg = "unable to coerce current fill_value nan to int64 dtype"
        with tm.assert_raises_regex(ValueError, msg):
            self.arr.astype('i8')

        arr = SparseArray([0, np.nan, 0, 1])
        with tm.assert_raises_regex(ValueError, msg):
            arr.astype('i8')

        arr = SparseArray([0, np.nan, 0, 1], fill_value=0)
        msg = 'Cannot convert non-finite values \\(NA or inf\\) to integer'
        with tm.assert_raises_regex(ValueError, msg):
            arr.astype('i8')

    def test_astype_all(self):
        vals = np.array([1, 2, 3])
        arr = SparseArray(vals, fill_value=1)

        types = [np.float64, np.float32, np.int64,
                 np.int32, np.int16, np.int8]
        for typ in types:
            res = arr.astype(typ)
            assert res.dtype == typ
            assert res.sp_values.dtype == typ

            tm.assert_numpy_array_equal(res.values, vals.astype(typ))

    def test_set_fill_value(self):
        arr = SparseArray([1., np.nan, 2.], fill_value=np.nan)
        arr.fill_value = 2
        assert arr.fill_value == 2

        arr = SparseArray([1, 0, 2], fill_value=0, dtype=np.int64)
        arr.fill_value = 2
        assert arr.fill_value == 2

        # coerces to int
        msg = "unable to set fill_value 3\\.1 to int64 dtype"
        with tm.assert_raises_regex(ValueError, msg):
            arr.fill_value = 3.1

        msg = "unable to set fill_value nan to int64 dtype"
        with tm.assert_raises_regex(ValueError, msg):
            arr.fill_value = np.nan

        arr = SparseArray([True, False, True], fill_value=False, dtype=np.bool)
        arr.fill_value = True
        assert arr.fill_value

        # coerces to bool
        msg = "unable to set fill_value 0 to bool dtype"
        with tm.assert_raises_regex(ValueError, msg):
            arr.fill_value = 0

        msg = "unable to set fill_value nan to bool dtype"
        with tm.assert_raises_regex(ValueError, msg):
            arr.fill_value = np.nan

        # invalid
        msg = "fill_value must be a scalar"
        for val in [[1, 2, 3], np.array([1, 2]), (1, 2, 3)]:
            with tm.assert_raises_regex(ValueError, msg):
                arr.fill_value = val

    def test_copy_shallow(self):
        arr2 = self.arr.copy(deep=False)

        def _get_base(values):
            base = values.base
            while base.base is not None:
                base = base.base
            return base

        assert (_get_base(arr2) is _get_base(self.arr))

    def test_values_asarray(self):
        assert_almost_equal(self.arr.values, self.arr_data)
        assert_almost_equal(self.arr.to_dense(), self.arr_data)
        assert_almost_equal(self.arr.sp_values, np.asarray(self.arr))

    def test_to_dense(self):
        vals = np.array([1, np.nan, np.nan, 3, np.nan])
        res = SparseArray(vals).to_dense()
        tm.assert_numpy_array_equal(res, vals)

        res = SparseArray(vals, fill_value=0).to_dense()
        tm.assert_numpy_array_equal(res, vals)

        vals = np.array([1, np.nan, 0, 3, 0])
        res = SparseArray(vals).to_dense()
        tm.assert_numpy_array_equal(res, vals)

        res = SparseArray(vals, fill_value=0).to_dense()
        tm.assert_numpy_array_equal(res, vals)

        vals = np.array([np.nan, np.nan, np.nan, np.nan, np.nan])
        res = SparseArray(vals).to_dense()
        tm.assert_numpy_array_equal(res, vals)

        res = SparseArray(vals, fill_value=0).to_dense()
        tm.assert_numpy_array_equal(res, vals)

        # see gh-14647
        with tm.assert_produces_warning(FutureWarning,
                                        check_stacklevel=False):
            SparseArray(vals).to_dense(fill=2)

    def test_getitem(self):
        def _checkit(i):
            assert_almost_equal(self.arr[i], self.arr.values[i])

        for i in range(len(self.arr)):
            _checkit(i)
            _checkit(-i)

    def test_getslice(self):
        result = self.arr[:-3]
        exp = SparseArray(self.arr.values[:-3])
        tm.assert_sp_array_equal(result, exp)

        result = self.arr[-4:]
        exp = SparseArray(self.arr.values[-4:])
        tm.assert_sp_array_equal(result, exp)

        # two corner cases from Series
        result = self.arr[-12:]
        exp = SparseArray(self.arr)
        tm.assert_sp_array_equal(result, exp)

        result = self.arr[:-12]
        exp = SparseArray(self.arr.values[:0])
        tm.assert_sp_array_equal(result, exp)

    def test_getslice_tuple(self):
        dense = np.array([np.nan, 0, 3, 4, 0, 5, np.nan, np.nan, 0])

        sparse = SparseArray(dense)
        res = sparse[4:, ]
        exp = SparseArray(dense[4:, ])
        tm.assert_sp_array_equal(res, exp)

        sparse = SparseArray(dense, fill_value=0)
        res = sparse[4:, ]
        exp = SparseArray(dense[4:, ], fill_value=0)
        tm.assert_sp_array_equal(res, exp)

        with pytest.raises(IndexError):
            sparse[4:, :]

        with pytest.raises(IndexError):
            # check numpy compat
            dense[4:, :]

    def test_binary_operators(self):
        data1 = np.random.randn(20)
        data2 = np.random.randn(20)
        data1[::2] = np.nan
        data2[::3] = np.nan

        arr1 = SparseArray(data1)
        arr2 = SparseArray(data2)

        data1[::2] = 3
        data2[::3] = 3
        farr1 = SparseArray(data1, fill_value=3)
        farr2 = SparseArray(data2, fill_value=3)

        def _check_op(op, first, second):
            res = op(first, second)
            exp = SparseArray(op(first.values, second.values),
                              fill_value=first.fill_value)
            assert isinstance(res, SparseArray)
            assert_almost_equal(res.values, exp.values)

            res2 = op(first, second.values)
            assert isinstance(res2, SparseArray)
            tm.assert_sp_array_equal(res, res2)

            res3 = op(first.values, second)
            assert isinstance(res3, SparseArray)
            tm.assert_sp_array_equal(res, res3)

            res4 = op(first, 4)
            assert isinstance(res4, SparseArray)

            # ignore this if the actual op raises (e.g. pow)
            try:
                exp = op(first.values, 4)
                exp_fv = op(first.fill_value, 4)
                assert_almost_equal(res4.fill_value, exp_fv)
                assert_almost_equal(res4.values, exp)
            except ValueError:
                pass

        def _check_inplace_op(op):
            tmp = arr1.copy()
            pytest.raises(NotImplementedError, op, tmp, arr2)

        with np.errstate(all='ignore'):
            bin_ops = [operator.add, operator.sub, operator.mul,
                       operator.truediv, operator.floordiv, operator.pow]
            for op in bin_ops:
                _check_op(op, arr1, arr2)
                _check_op(op, farr1, farr2)

            inplace_ops = ['iadd', 'isub', 'imul', 'itruediv', 'ifloordiv',
                           'ipow']
            for op in inplace_ops:
                _check_inplace_op(getattr(operator, op))

    def test_pickle(self):
        def _check_roundtrip(obj):
            unpickled = tm.round_trip_pickle(obj)
            tm.assert_sp_array_equal(unpickled, obj)

        _check_roundtrip(self.arr)
        _check_roundtrip(self.zarr)

    def test_generator_warnings(self):
        sp_arr = SparseArray([1, 2, 3])
        with warnings.catch_warnings(record=True) as w:
            warnings.filterwarnings(action='always',
                                    category=DeprecationWarning)
            warnings.filterwarnings(action='always',
                                    category=PendingDeprecationWarning)
            for _ in sp_arr:
                pass
            assert len(w) == 0

    def test_fillna(self):
        s = SparseArray([1, np.nan, np.nan, 3, np.nan])
        res = s.fillna(-1)
        exp = SparseArray([1, -1, -1, 3, -1], fill_value=-1, dtype=np.float64)
        tm.assert_sp_array_equal(res, exp)

        s = SparseArray([1, np.nan, np.nan, 3, np.nan], fill_value=0)
        res = s.fillna(-1)
        exp = SparseArray([1, -1, -1, 3, -1], fill_value=0, dtype=np.float64)
        tm.assert_sp_array_equal(res, exp)

        s = SparseArray([1, np.nan, 0, 3, 0])
        res = s.fillna(-1)
        exp = SparseArray([1, -1, 0, 3, 0], fill_value=-1, dtype=np.float64)
        tm.assert_sp_array_equal(res, exp)

        s = SparseArray([1, np.nan, 0, 3, 0], fill_value=0)
        res = s.fillna(-1)
        exp = SparseArray([1, -1, 0, 3, 0], fill_value=0, dtype=np.float64)
        tm.assert_sp_array_equal(res, exp)

        s = SparseArray([np.nan, np.nan, np.nan, np.nan])
        res = s.fillna(-1)
        exp = SparseArray([-1, -1, -1, -1], fill_value=-1, dtype=np.float64)
        tm.assert_sp_array_equal(res, exp)

        s = SparseArray([np.nan, np.nan, np.nan, np.nan], fill_value=0)
        res = s.fillna(-1)
        exp = SparseArray([-1, -1, -1, -1], fill_value=0, dtype=np.float64)
        tm.assert_sp_array_equal(res, exp)

        # float dtype's fill_value is np.nan, replaced by -1
        s = SparseArray([0., 0., 0., 0.])
        res = s.fillna(-1)
        exp = SparseArray([0., 0., 0., 0.], fill_value=-1)
        tm.assert_sp_array_equal(res, exp)

        # int dtype shouldn't have missing. No changes.
        s = SparseArray([0, 0, 0, 0])
        assert s.dtype == np.int64
        assert s.fill_value == 0
        res = s.fillna(-1)
        tm.assert_sp_array_equal(res, s)

        s = SparseArray([0, 0, 0, 0], fill_value=0)
        assert s.dtype == np.int64
        assert s.fill_value == 0
        res = s.fillna(-1)
        exp = SparseArray([0, 0, 0, 0], fill_value=0)
        tm.assert_sp_array_equal(res, exp)

        # fill_value can be nan if there is no missing hole.
        # only fill_value will be changed
        s = SparseArray([0, 0, 0, 0], fill_value=np.nan)
        assert s.dtype == np.int64
        assert np.isnan(s.fill_value)
        res = s.fillna(-1)
        exp = SparseArray([0, 0, 0, 0], fill_value=-1)
        tm.assert_sp_array_equal(res, exp)

    def test_fillna_overlap(self):
        s = SparseArray([1, np.nan, np.nan, 3, np.nan])
        # filling with existing value doesn't replace existing value with
        # fill_value, i.e. existing 3 remains in sp_values
        res = s.fillna(3)
        exp = np.array([1, 3, 3, 3, 3], dtype=np.float64)
        tm.assert_numpy_array_equal(res.to_dense(), exp)

        s = SparseArray([1, np.nan, np.nan, 3, np.nan], fill_value=0)
        res = s.fillna(3)
        exp = SparseArray([1, 3, 3, 3, 3], fill_value=0, dtype=np.float64)
        tm.assert_sp_array_equal(res, exp)


class TestSparseArrayAnalytics(object):

    def test_sum(self):
        data = np.arange(10).astype(float)
        out = SparseArray(data).sum()
        assert out == 45.0

        data[5] = np.nan
        out = SparseArray(data, fill_value=2).sum()
        assert out == 40.0

        out = SparseArray(data, fill_value=np.nan).sum()
        assert out == 40.0

    def test_numpy_sum(self):
        data = np.arange(10).astype(float)
        out = np.sum(SparseArray(data))
        assert out == 45.0

        data[5] = np.nan
        out = np.sum(SparseArray(data, fill_value=2))
        assert out == 40.0

        out = np.sum(SparseArray(data, fill_value=np.nan))
        assert out == 40.0

        msg = "the 'dtype' parameter is not supported"
        tm.assert_raises_regex(ValueError, msg, np.sum,
                               SparseArray(data), dtype=np.int64)

        msg = "the 'out' parameter is not supported"
        tm.assert_raises_regex(ValueError, msg, np.sum,
                               SparseArray(data), out=out)

    def test_cumsum(self):
        non_null_data = np.array([1, 2, 3, 4, 5], dtype=float)
        non_null_expected = SparseArray(non_null_data.cumsum())

        null_data = np.array([1, 2, np.nan, 4, 5], dtype=float)
        null_expected = SparseArray(np.array([1.0, 3.0, np.nan, 7.0, 12.0]))

        for data, expected in [
            (null_data, null_expected),
            (non_null_data, non_null_expected)
        ]:
            out = SparseArray(data).cumsum()
            tm.assert_sp_array_equal(out, expected)

            out = SparseArray(data, fill_value=np.nan).cumsum()
            tm.assert_sp_array_equal(out, expected)

            out = SparseArray(data, fill_value=2).cumsum()
            tm.assert_sp_array_equal(out, expected)

            axis = 1  # SparseArray currently 1-D, so only axis = 0 is valid.
            msg = "axis\\(={axis}\\) out of bounds".format(axis=axis)
            with tm.assert_raises_regex(ValueError, msg):
                SparseArray(data).cumsum(axis=axis)

    def test_numpy_cumsum(self):
        non_null_data = np.array([1, 2, 3, 4, 5], dtype=float)
        non_null_expected = SparseArray(non_null_data.cumsum())

        null_data = np.array([1, 2, np.nan, 4, 5], dtype=float)
        null_expected = SparseArray(np.array([1.0, 3.0, np.nan, 7.0, 12.0]))

        for data, expected in [
            (null_data, null_expected),
            (non_null_data, non_null_expected)
        ]:
            out = np.cumsum(SparseArray(data))
            tm.assert_sp_array_equal(out, expected)

            out = np.cumsum(SparseArray(data, fill_value=np.nan))
            tm.assert_sp_array_equal(out, expected)

            out = np.cumsum(SparseArray(data, fill_value=2))
            tm.assert_sp_array_equal(out, expected)

            msg = "the 'dtype' parameter is not supported"
            tm.assert_raises_regex(ValueError, msg, np.cumsum,
                                   SparseArray(data), dtype=np.int64)

            msg = "the 'out' parameter is not supported"
            tm.assert_raises_regex(ValueError, msg, np.cumsum,
                                   SparseArray(data), out=out)

    def test_mean(self):
        data = np.arange(10).astype(float)
        out = SparseArray(data).mean()
        assert out == 4.5

        data[5] = np.nan
        out = SparseArray(data).mean()
        assert out == 40.0 / 9

    def test_numpy_mean(self):
        data = np.arange(10).astype(float)
        out = np.mean(SparseArray(data))
        assert out == 4.5

        data[5] = np.nan
        out = np.mean(SparseArray(data))
        assert out == 40.0 / 9

        msg = "the 'dtype' parameter is not supported"
        tm.assert_raises_regex(ValueError, msg, np.mean,
                               SparseArray(data), dtype=np.int64)

        msg = "the 'out' parameter is not supported"
        tm.assert_raises_regex(ValueError, msg, np.mean,
                               SparseArray(data), out=out)

    def test_ufunc(self):
        # GH 13853 make sure ufunc is applied to fill_value
        sparse = SparseArray([1, np.nan, 2, np.nan, -2])
        result = SparseArray([1, np.nan, 2, np.nan, 2])
        tm.assert_sp_array_equal(abs(sparse), result)
        tm.assert_sp_array_equal(np.abs(sparse), result)

        sparse = SparseArray([1, -1, 2, -2], fill_value=1)
        result = SparseArray([1, 2, 2], sparse_index=sparse.sp_index,
                             fill_value=1)
        tm.assert_sp_array_equal(abs(sparse), result)
        tm.assert_sp_array_equal(np.abs(sparse), result)

        sparse = SparseArray([1, -1, 2, -2], fill_value=-1)
        result = SparseArray([1, 2, 2], sparse_index=sparse.sp_index,
                             fill_value=1)
        tm.assert_sp_array_equal(abs(sparse), result)
        tm.assert_sp_array_equal(np.abs(sparse), result)

        sparse = SparseArray([1, np.nan, 2, np.nan, -2])
        result = SparseArray(np.sin([1, np.nan, 2, np.nan, -2]))
        tm.assert_sp_array_equal(np.sin(sparse), result)

        sparse = SparseArray([1, -1, 2, -2], fill_value=1)
        result = SparseArray(np.sin([1, -1, 2, -2]), fill_value=np.sin(1))
        tm.assert_sp_array_equal(np.sin(sparse), result)

        sparse = SparseArray([1, -1, 0, -2], fill_value=0)
        result = SparseArray(np.sin([1, -1, 0, -2]), fill_value=np.sin(0))
        tm.assert_sp_array_equal(np.sin(sparse), result)

    def test_ufunc_args(self):
        # GH 13853 make sure ufunc is applied to fill_value, including its arg
        sparse = SparseArray([1, np.nan, 2, np.nan, -2])
        result = SparseArray([2, np.nan, 3, np.nan, -1])
        tm.assert_sp_array_equal(np.add(sparse, 1), result)

        sparse = SparseArray([1, -1, 2, -2], fill_value=1)
        result = SparseArray([2, 0, 3, -1], fill_value=2)
        tm.assert_sp_array_equal(np.add(sparse, 1), result)

        sparse = SparseArray([1, -1, 0, -2], fill_value=0)
        result = SparseArray([2, 0, 1, -1], fill_value=1)
        tm.assert_sp_array_equal(np.add(sparse, 1), result)
