# pylint: disable-msg=E1101,W0612

import operator
import pytest

from numpy import nan
import numpy as np
import pandas as pd

from pandas import Series, DataFrame, bdate_range
from pandas.core.common import isnull
from pandas.tseries.offsets import BDay
import pandas.util.testing as tm
from pandas.compat import range
from pandas import compat
from pandas.core.reshape.util import cartesian_product

import pandas.core.sparse.frame as spf

from pandas._libs.sparse import BlockIndex, IntIndex
from pandas.core.sparse.api import SparseSeries
from pandas.tests.series.test_api import SharedWithSparse


def _test_data1():
    # nan-based
    arr = np.arange(20, dtype=float)
    index = np.arange(20)
    arr[:2] = nan
    arr[5:10] = nan
    arr[-3:] = nan

    return arr, index


def _test_data2():
    # nan-based
    arr = np.arange(15, dtype=float)
    index = np.arange(15)
    arr[7:12] = nan
    arr[-1:] = nan
    return arr, index


def _test_data1_zero():
    # zero-based
    arr, index = _test_data1()
    arr[np.isnan(arr)] = 0
    return arr, index


def _test_data2_zero():
    # zero-based
    arr, index = _test_data2()
    arr[np.isnan(arr)] = 0
    return arr, index


class TestSparseSeries(SharedWithSparse):

    def setup_method(self, method):
        arr, index = _test_data1()

        date_index = bdate_range('1/1/2011', periods=len(index))

        self.bseries = SparseSeries(arr, index=index, kind='block',
                                    name='bseries')
        self.ts = self.bseries

        self.btseries = SparseSeries(arr, index=date_index, kind='block')

        self.iseries = SparseSeries(arr, index=index, kind='integer',
                                    name='iseries')

        arr, index = _test_data2()
        self.bseries2 = SparseSeries(arr, index=index, kind='block')
        self.iseries2 = SparseSeries(arr, index=index, kind='integer')

        arr, index = _test_data1_zero()
        self.zbseries = SparseSeries(arr, index=index, kind='block',
                                     fill_value=0, name='zbseries')
        self.ziseries = SparseSeries(arr, index=index, kind='integer',
                                     fill_value=0)

        arr, index = _test_data2_zero()
        self.zbseries2 = SparseSeries(arr, index=index, kind='block',
                                      fill_value=0)
        self.ziseries2 = SparseSeries(arr, index=index, kind='integer',
                                      fill_value=0)

    def test_constructor_dtype(self):
        arr = SparseSeries([np.nan, 1, 2, np.nan])
        assert arr.dtype == np.float64
        assert np.isnan(arr.fill_value)

        arr = SparseSeries([np.nan, 1, 2, np.nan], fill_value=0)
        assert arr.dtype == np.float64
        assert arr.fill_value == 0

        arr = SparseSeries([0, 1, 2, 4], dtype=np.int64, fill_value=np.nan)
        assert arr.dtype == np.int64
        assert np.isnan(arr.fill_value)

        arr = SparseSeries([0, 1, 2, 4], dtype=np.int64)
        assert arr.dtype == np.int64
        assert arr.fill_value == 0

        arr = SparseSeries([0, 1, 2, 4], fill_value=0, dtype=np.int64)
        assert arr.dtype == np.int64
        assert arr.fill_value == 0

    def test_iteration_and_str(self):
        [x for x in self.bseries]
        str(self.bseries)

    def test_construct_DataFrame_with_sp_series(self):
        # it works!
        df = DataFrame({'col': self.bseries})

        # printing & access
        df.iloc[:1]
        df['col']
        df.dtypes
        str(df)

        tm.assert_sp_series_equal(df['col'], self.bseries, check_names=False)

        result = df.iloc[:, 0]
        tm.assert_sp_series_equal(result, self.bseries, check_names=False)

        # blocking
        expected = Series({'col': 'float64:sparse'})
        result = df.ftypes
        tm.assert_series_equal(expected, result)

    def test_constructor_preserve_attr(self):
        arr = pd.SparseArray([1, 0, 3, 0], dtype=np.int64, fill_value=0)
        assert arr.dtype == np.int64
        assert arr.fill_value == 0

        s = pd.SparseSeries(arr, name='x')
        assert s.dtype == np.int64
        assert s.fill_value == 0

    def test_series_density(self):
        # GH2803
        ts = Series(np.random.randn(10))
        ts[2:-2] = nan
        sts = ts.to_sparse()
        density = sts.density  # don't die
        assert density == 4 / 10.0

    def test_sparse_to_dense(self):
        arr, index = _test_data1()
        series = self.bseries.to_dense()
        tm.assert_series_equal(series, Series(arr, name='bseries'))

        # see gh-14647
        with tm.assert_produces_warning(FutureWarning,
                                        check_stacklevel=False):
            series = self.bseries.to_dense(sparse_only=True)

        indexer = np.isfinite(arr)
        exp = Series(arr[indexer], index=index[indexer], name='bseries')
        tm.assert_series_equal(series, exp)

        series = self.iseries.to_dense()
        tm.assert_series_equal(series, Series(arr, name='iseries'))

        arr, index = _test_data1_zero()
        series = self.zbseries.to_dense()
        tm.assert_series_equal(series, Series(arr, name='zbseries'))

        series = self.ziseries.to_dense()
        tm.assert_series_equal(series, Series(arr))

    def test_to_dense_fill_value(self):
        s = pd.Series([1, np.nan, np.nan, 3, np.nan])
        res = SparseSeries(s).to_dense()
        tm.assert_series_equal(res, s)

        res = SparseSeries(s, fill_value=0).to_dense()
        tm.assert_series_equal(res, s)

        s = pd.Series([1, np.nan, 0, 3, 0])
        res = SparseSeries(s, fill_value=0).to_dense()
        tm.assert_series_equal(res, s)

        res = SparseSeries(s, fill_value=0).to_dense()
        tm.assert_series_equal(res, s)

        s = pd.Series([np.nan, np.nan, np.nan, np.nan, np.nan])
        res = SparseSeries(s).to_dense()
        tm.assert_series_equal(res, s)

        s = pd.Series([np.nan, np.nan, np.nan, np.nan, np.nan])
        res = SparseSeries(s, fill_value=0).to_dense()
        tm.assert_series_equal(res, s)

    def test_dense_to_sparse(self):
        series = self.bseries.to_dense()
        bseries = series.to_sparse(kind='block')
        iseries = series.to_sparse(kind='integer')
        tm.assert_sp_series_equal(bseries, self.bseries)
        tm.assert_sp_series_equal(iseries, self.iseries, check_names=False)
        assert iseries.name == self.bseries.name

        assert len(series) == len(bseries)
        assert len(series) == len(iseries)
        assert series.shape == bseries.shape
        assert series.shape == iseries.shape

        # non-NaN fill value
        series = self.zbseries.to_dense()
        zbseries = series.to_sparse(kind='block', fill_value=0)
        ziseries = series.to_sparse(kind='integer', fill_value=0)
        tm.assert_sp_series_equal(zbseries, self.zbseries)
        tm.assert_sp_series_equal(ziseries, self.ziseries, check_names=False)
        assert ziseries.name == self.zbseries.name

        assert len(series) == len(zbseries)
        assert len(series) == len(ziseries)
        assert series.shape == zbseries.shape
        assert series.shape == ziseries.shape

    def test_to_dense_preserve_name(self):
        assert (self.bseries.name is not None)
        result = self.bseries.to_dense()
        assert result.name == self.bseries.name

    def test_constructor(self):
        # test setup guys
        assert np.isnan(self.bseries.fill_value)
        assert isinstance(self.bseries.sp_index, BlockIndex)
        assert np.isnan(self.iseries.fill_value)
        assert isinstance(self.iseries.sp_index, IntIndex)

        assert self.zbseries.fill_value == 0
        tm.assert_numpy_array_equal(self.zbseries.values.values,
                                    self.bseries.to_dense().fillna(0).values)

        # pass SparseSeries
        def _check_const(sparse, name):
            # use passed series name
            result = SparseSeries(sparse)
            tm.assert_sp_series_equal(result, sparse)
            assert sparse.name == name
            assert result.name == name

            # use passed name
            result = SparseSeries(sparse, name='x')
            tm.assert_sp_series_equal(result, sparse, check_names=False)
            assert result.name == 'x'

        _check_const(self.bseries, 'bseries')
        _check_const(self.iseries, 'iseries')
        _check_const(self.zbseries, 'zbseries')

        # Sparse time series works
        date_index = bdate_range('1/1/2000', periods=len(self.bseries))
        s5 = SparseSeries(self.bseries, index=date_index)
        assert isinstance(s5, SparseSeries)

        # pass Series
        bseries2 = SparseSeries(self.bseries.to_dense())
        tm.assert_numpy_array_equal(self.bseries.sp_values, bseries2.sp_values)

        # pass dict?

        # don't copy the data by default
        values = np.ones(self.bseries.npoints)
        sp = SparseSeries(values, sparse_index=self.bseries.sp_index)
        sp.sp_values[:5] = 97
        assert values[0] == 97

        assert len(sp) == 20
        assert sp.shape == (20, )

        # but can make it copy!
        sp = SparseSeries(values, sparse_index=self.bseries.sp_index,
                          copy=True)
        sp.sp_values[:5] = 100
        assert values[0] == 97

        assert len(sp) == 20
        assert sp.shape == (20, )

    def test_constructor_scalar(self):
        data = 5
        sp = SparseSeries(data, np.arange(100))
        sp = sp.reindex(np.arange(200))
        assert (sp.loc[:99] == data).all()
        assert isnull(sp.loc[100:]).all()

        data = np.nan
        sp = SparseSeries(data, np.arange(100))
        assert len(sp) == 100
        assert sp.shape == (100, )

    def test_constructor_ndarray(self):
        pass

    def test_constructor_nonnan(self):
        arr = [0, 0, 0, nan, nan]
        sp_series = SparseSeries(arr, fill_value=0)
        tm.assert_numpy_array_equal(sp_series.values.values, np.array(arr))
        assert len(sp_series) == 5
        assert sp_series.shape == (5, )

    def test_constructor_empty(self):
        # see gh-9272
        sp = SparseSeries()
        assert len(sp.index) == 0
        assert sp.shape == (0, )

    def test_copy_astype(self):
        cop = self.bseries.astype(np.float64)
        assert cop is not self.bseries
        assert cop.sp_index is self.bseries.sp_index
        assert cop.dtype == np.float64

        cop2 = self.iseries.copy()

        tm.assert_sp_series_equal(cop, self.bseries)
        tm.assert_sp_series_equal(cop2, self.iseries)

        # test that data is copied
        cop[:5] = 97
        assert cop.sp_values[0] == 97
        assert self.bseries.sp_values[0] != 97

        # correct fill value
        zbcop = self.zbseries.copy()
        zicop = self.ziseries.copy()

        tm.assert_sp_series_equal(zbcop, self.zbseries)
        tm.assert_sp_series_equal(zicop, self.ziseries)

        # no deep copy
        view = self.bseries.copy(deep=False)
        view.sp_values[:5] = 5
        assert (self.bseries.sp_values[:5] == 5).all()

    def test_shape(self):
        # see gh-10452
        assert self.bseries.shape == (20, )
        assert self.btseries.shape == (20, )
        assert self.iseries.shape == (20, )

        assert self.bseries2.shape == (15, )
        assert self.iseries2.shape == (15, )

        assert self.zbseries2.shape == (15, )
        assert self.ziseries2.shape == (15, )

    def test_astype(self):
        with pytest.raises(ValueError):
            self.bseries.astype(np.int64)

    def test_astype_all(self):
        orig = pd.Series(np.array([1, 2, 3]))
        s = SparseSeries(orig)

        types = [np.float64, np.float32, np.int64,
                 np.int32, np.int16, np.int8]
        for typ in types:
            res = s.astype(typ)
            assert res.dtype == typ
            tm.assert_series_equal(res.to_dense(), orig.astype(typ))

    def test_kind(self):
        assert self.bseries.kind == 'block'
        assert self.iseries.kind == 'integer'

    def test_to_frame(self):
        # GH 9850
        s = pd.SparseSeries([1, 2, 0, nan, 4, nan, 0], name='x')
        exp = pd.SparseDataFrame({'x': [1, 2, 0, nan, 4, nan, 0]})
        tm.assert_sp_frame_equal(s.to_frame(), exp)

        exp = pd.SparseDataFrame({'y': [1, 2, 0, nan, 4, nan, 0]})
        tm.assert_sp_frame_equal(s.to_frame(name='y'), exp)

        s = pd.SparseSeries([1, 2, 0, nan, 4, nan, 0], name='x', fill_value=0)
        exp = pd.SparseDataFrame({'x': [1, 2, 0, nan, 4, nan, 0]},
                                 default_fill_value=0)

        tm.assert_sp_frame_equal(s.to_frame(), exp)
        exp = pd.DataFrame({'y': [1, 2, 0, nan, 4, nan, 0]})
        tm.assert_frame_equal(s.to_frame(name='y').to_dense(), exp)

    def test_pickle(self):
        def _test_roundtrip(series):
            unpickled = tm.round_trip_pickle(series)
            tm.assert_sp_series_equal(series, unpickled)
            tm.assert_series_equal(series.to_dense(), unpickled.to_dense())

        self._check_all(_test_roundtrip)

    def _check_all(self, check_func):
        check_func(self.bseries)
        check_func(self.iseries)
        check_func(self.zbseries)
        check_func(self.ziseries)

    def test_getitem(self):
        def _check_getitem(sp, dense):
            for idx, val in compat.iteritems(dense):
                tm.assert_almost_equal(val, sp[idx])

            for i in range(len(dense)):
                tm.assert_almost_equal(sp[i], dense[i])
                # j = np.float64(i)
                # assert_almost_equal(sp[j], dense[j])

                # API change 1/6/2012
                # negative getitem works
                # for i in xrange(len(dense)):
                #     assert_almost_equal(sp[-i], dense[-i])

        _check_getitem(self.bseries, self.bseries.to_dense())
        _check_getitem(self.btseries, self.btseries.to_dense())

        _check_getitem(self.zbseries, self.zbseries.to_dense())
        _check_getitem(self.iseries, self.iseries.to_dense())
        _check_getitem(self.ziseries, self.ziseries.to_dense())

        # exception handling
        pytest.raises(Exception, self.bseries.__getitem__,
                      len(self.bseries) + 1)

        # index not contained
        pytest.raises(Exception, self.btseries.__getitem__,
                      self.btseries.index[-1] + BDay())

    def test_get_get_value(self):
        tm.assert_almost_equal(self.bseries.get(10), self.bseries[10])
        assert self.bseries.get(len(self.bseries) + 1) is None

        dt = self.btseries.index[10]
        result = self.btseries.get(dt)
        expected = self.btseries.to_dense()[dt]
        tm.assert_almost_equal(result, expected)

        tm.assert_almost_equal(self.bseries.get_value(10), self.bseries[10])

    def test_set_value(self):

        idx = self.btseries.index[7]
        self.btseries.set_value(idx, 0)
        assert self.btseries[idx] == 0

        self.iseries.set_value('foobar', 0)
        assert self.iseries.index[-1] == 'foobar'
        assert self.iseries['foobar'] == 0

    def test_getitem_slice(self):
        idx = self.bseries.index
        res = self.bseries[::2]
        assert isinstance(res, SparseSeries)

        expected = self.bseries.reindex(idx[::2])
        tm.assert_sp_series_equal(res, expected)

        res = self.bseries[:5]
        assert isinstance(res, SparseSeries)
        tm.assert_sp_series_equal(res, self.bseries.reindex(idx[:5]))

        res = self.bseries[5:]
        tm.assert_sp_series_equal(res, self.bseries.reindex(idx[5:]))

        # negative indices
        res = self.bseries[:-3]
        tm.assert_sp_series_equal(res, self.bseries.reindex(idx[:-3]))

    def test_take(self):
        def _compare_with_dense(sp):
            dense = sp.to_dense()

            def _compare(idx):
                dense_result = dense.take(idx).values
                sparse_result = sp.take(idx)
                assert isinstance(sparse_result, SparseSeries)
                tm.assert_almost_equal(dense_result,
                                       sparse_result.values.values)

            _compare([1., 2., 3., 4., 5., 0.])
            _compare([7, 2, 9, 0, 4])
            _compare([3, 6, 3, 4, 7])

        self._check_all(_compare_with_dense)

        pytest.raises(Exception, self.bseries.take,
                      [0, len(self.bseries) + 1])

        # Corner case
        sp = SparseSeries(np.ones(10) * nan)
        exp = pd.Series(np.repeat(nan, 5))
        tm.assert_series_equal(sp.take([0, 1, 2, 3, 4]), exp)

    def test_numpy_take(self):
        sp = SparseSeries([1.0, 2.0, 3.0])
        indices = [1, 2]

        tm.assert_series_equal(np.take(sp, indices, axis=0).to_dense(),
                               np.take(sp.to_dense(), indices, axis=0))

        msg = "the 'out' parameter is not supported"
        tm.assert_raises_regex(ValueError, msg, np.take,
                               sp, indices, out=np.empty(sp.shape))

        msg = "the 'mode' parameter is not supported"
        tm.assert_raises_regex(ValueError, msg, np.take,
                               sp, indices, mode='clip')

    def test_setitem(self):
        self.bseries[5] = 7.
        assert self.bseries[5] == 7.

    def test_setslice(self):
        self.bseries[5:10] = 7.
        tm.assert_series_equal(self.bseries[5:10].to_dense(),
                               Series(7., index=range(5, 10),
                                      name=self.bseries.name))

    def test_operators(self):

        def _check_op(a, b, op):
            sp_result = op(a, b)
            adense = a.to_dense() if isinstance(a, SparseSeries) else a
            bdense = b.to_dense() if isinstance(b, SparseSeries) else b
            dense_result = op(adense, bdense)
            tm.assert_almost_equal(sp_result.to_dense(), dense_result)

        def check(a, b):
            _check_op(a, b, operator.add)
            _check_op(a, b, operator.sub)
            _check_op(a, b, operator.truediv)
            _check_op(a, b, operator.floordiv)
            _check_op(a, b, operator.mul)

            _check_op(a, b, lambda x, y: operator.add(y, x))
            _check_op(a, b, lambda x, y: operator.sub(y, x))
            _check_op(a, b, lambda x, y: operator.truediv(y, x))
            _check_op(a, b, lambda x, y: operator.floordiv(y, x))
            _check_op(a, b, lambda x, y: operator.mul(y, x))

            # NaN ** 0 = 1 in C?
            # _check_op(a, b, operator.pow)
            # _check_op(a, b, lambda x, y: operator.pow(y, x))

        check(self.bseries, self.bseries)
        check(self.iseries, self.iseries)
        check(self.bseries, self.iseries)

        check(self.bseries, self.bseries2)
        check(self.bseries, self.iseries2)
        check(self.iseries, self.iseries2)

        # scalar value
        check(self.bseries, 5)

        # zero-based
        check(self.zbseries, self.zbseries * 2)
        check(self.zbseries, self.zbseries2)
        check(self.ziseries, self.ziseries2)

        # with dense
        result = self.bseries + self.bseries.to_dense()
        tm.assert_sp_series_equal(result, self.bseries + self.bseries)

    def test_binary_operators(self):

        # skipping for now #####
        import pytest
        pytest.skip("skipping sparse binary operators test")

        def _check_inplace_op(iop, op):
            tmp = self.bseries.copy()

            expected = op(tmp, self.bseries)
            iop(tmp, self.bseries)
            tm.assert_sp_series_equal(tmp, expected)

        inplace_ops = ['add', 'sub', 'mul', 'truediv', 'floordiv', 'pow']
        for op in inplace_ops:
            _check_inplace_op(getattr(operator, "i%s" % op),
                              getattr(operator, op))

    def test_abs(self):
        s = SparseSeries([1, 2, -3], name='x')
        expected = SparseSeries([1, 2, 3], name='x')
        result = s.abs()
        tm.assert_sp_series_equal(result, expected)
        assert result.name == 'x'

        result = abs(s)
        tm.assert_sp_series_equal(result, expected)
        assert result.name == 'x'

        result = np.abs(s)
        tm.assert_sp_series_equal(result, expected)
        assert result.name == 'x'

        s = SparseSeries([1, -2, 2, -3], fill_value=-2, name='x')
        expected = SparseSeries([1, 2, 3], sparse_index=s.sp_index,
                                fill_value=2, name='x')
        result = s.abs()
        tm.assert_sp_series_equal(result, expected)
        assert result.name == 'x'

        result = abs(s)
        tm.assert_sp_series_equal(result, expected)
        assert result.name == 'x'

        result = np.abs(s)
        tm.assert_sp_series_equal(result, expected)
        assert result.name == 'x'

    def test_reindex(self):
        def _compare_with_series(sps, new_index):
            spsre = sps.reindex(new_index)

            series = sps.to_dense()
            seriesre = series.reindex(new_index)
            seriesre = seriesre.to_sparse(fill_value=sps.fill_value)

            tm.assert_sp_series_equal(spsre, seriesre)
            tm.assert_series_equal(spsre.to_dense(), seriesre.to_dense())

        _compare_with_series(self.bseries, self.bseries.index[::2])
        _compare_with_series(self.bseries, list(self.bseries.index[::2]))
        _compare_with_series(self.bseries, self.bseries.index[:10])
        _compare_with_series(self.bseries, self.bseries.index[5:])

        _compare_with_series(self.zbseries, self.zbseries.index[::2])
        _compare_with_series(self.zbseries, self.zbseries.index[:10])
        _compare_with_series(self.zbseries, self.zbseries.index[5:])

        # special cases
        same_index = self.bseries.reindex(self.bseries.index)
        tm.assert_sp_series_equal(self.bseries, same_index)
        assert same_index is not self.bseries

        # corner cases
        sp = SparseSeries([], index=[])
        # TODO: sp_zero is not used anywhere...remove?
        sp_zero = SparseSeries([], index=[], fill_value=0)  # noqa
        _compare_with_series(sp, np.arange(10))

        # with copy=False
        reindexed = self.bseries.reindex(self.bseries.index, copy=True)
        reindexed.sp_values[:] = 1.
        assert (self.bseries.sp_values != 1.).all()

        reindexed = self.bseries.reindex(self.bseries.index, copy=False)
        reindexed.sp_values[:] = 1.
        tm.assert_numpy_array_equal(self.bseries.sp_values, np.repeat(1., 10))

    def test_sparse_reindex(self):
        length = 10

        def _check(values, index1, index2, fill_value):
            first_series = SparseSeries(values, sparse_index=index1,
                                        fill_value=fill_value)
            reindexed = first_series.sparse_reindex(index2)
            assert reindexed.sp_index is index2

            int_indices1 = index1.to_int_index().indices
            int_indices2 = index2.to_int_index().indices

            expected = Series(values, index=int_indices1)
            expected = expected.reindex(int_indices2).fillna(fill_value)
            tm.assert_almost_equal(expected.values, reindexed.sp_values)

            # make sure level argument asserts
            # TODO: expected is not used anywhere...remove?
            expected = expected.reindex(int_indices2).fillna(fill_value)  # noqa

        def _check_with_fill_value(values, first, second, fill_value=nan):
            i_index1 = IntIndex(length, first)
            i_index2 = IntIndex(length, second)

            b_index1 = i_index1.to_block_index()
            b_index2 = i_index2.to_block_index()

            _check(values, i_index1, i_index2, fill_value)
            _check(values, b_index1, b_index2, fill_value)

        def _check_all(values, first, second):
            _check_with_fill_value(values, first, second, fill_value=nan)
            _check_with_fill_value(values, first, second, fill_value=0)

        index1 = [2, 4, 5, 6, 8, 9]
        values1 = np.arange(6.)

        _check_all(values1, index1, [2, 4, 5])
        _check_all(values1, index1, [2, 3, 4, 5, 6, 7, 8, 9])
        _check_all(values1, index1, [0, 1])
        _check_all(values1, index1, [0, 1, 7, 8, 9])
        _check_all(values1, index1, [])

        first_series = SparseSeries(values1,
                                    sparse_index=IntIndex(length, index1),
                                    fill_value=nan)
        with tm.assert_raises_regex(TypeError,
                                    'new index must be a SparseIndex'):
            reindexed = first_series.sparse_reindex(0)  # noqa

    def test_repr(self):
        # TODO: These aren't used
        bsrepr = repr(self.bseries)  # noqa
        isrepr = repr(self.iseries)  # noqa

    def test_iter(self):
        pass

    def test_truncate(self):
        pass

    def test_fillna(self):
        pass

    def test_groupby(self):
        pass

    def test_reductions(self):
        def _compare_with_dense(obj, op):
            sparse_result = getattr(obj, op)()
            series = obj.to_dense()
            dense_result = getattr(series, op)()
            assert sparse_result == dense_result

        to_compare = ['count', 'sum', 'mean', 'std', 'var', 'skew']

        def _compare_all(obj):
            for op in to_compare:
                _compare_with_dense(obj, op)

        _compare_all(self.bseries)

        self.bseries.sp_values[5:10] = np.NaN
        _compare_all(self.bseries)

        _compare_all(self.zbseries)
        self.zbseries.sp_values[5:10] = np.NaN
        _compare_all(self.zbseries)

        series = self.zbseries.copy()
        series.fill_value = 2
        _compare_all(series)

        nonna = Series(np.random.randn(20)).to_sparse()
        _compare_all(nonna)

        nonna2 = Series(np.random.randn(20)).to_sparse(fill_value=0)
        _compare_all(nonna2)

    def test_dropna(self):
        sp = SparseSeries([0, 0, 0, nan, nan, 5, 6], fill_value=0)

        sp_valid = sp.valid()

        expected = sp.to_dense().valid()
        expected = expected[expected != 0]
        exp_arr = pd.SparseArray(expected.values, fill_value=0, kind='block')
        tm.assert_sp_array_equal(sp_valid.values, exp_arr)
        tm.assert_index_equal(sp_valid.index, expected.index)
        assert len(sp_valid.sp_values) == 2

        result = self.bseries.dropna()
        expected = self.bseries.to_dense().dropna()
        assert not isinstance(result, SparseSeries)
        tm.assert_series_equal(result, expected)

    def test_homogenize(self):
        def _check_matches(indices, expected):
            data = {}
            for i, idx in enumerate(indices):
                data[i] = SparseSeries(idx.to_int_index().indices,
                                       sparse_index=idx, fill_value=np.nan)
            # homogenized is only valid with NaN fill values
            homogenized = spf.homogenize(data)

            for k, v in compat.iteritems(homogenized):
                assert (v.sp_index.equals(expected))

        indices1 = [BlockIndex(10, [2], [7]), BlockIndex(10, [1, 6], [3, 4]),
                    BlockIndex(10, [0], [10])]
        expected1 = BlockIndex(10, [2, 6], [2, 3])
        _check_matches(indices1, expected1)

        indices2 = [BlockIndex(10, [2], [7]), BlockIndex(10, [2], [7])]
        expected2 = indices2[0]
        _check_matches(indices2, expected2)

        # must have NaN fill value
        data = {'a': SparseSeries(np.arange(7), sparse_index=expected2,
                                  fill_value=0)}
        with tm.assert_raises_regex(TypeError, "NaN fill value"):
            spf.homogenize(data)

    def test_fill_value_corner(self):
        cop = self.zbseries.copy()
        cop.fill_value = 0
        result = self.bseries / cop

        assert np.isnan(result.fill_value)

        cop2 = self.zbseries.copy()
        cop2.fill_value = 1
        result = cop2 / cop
        # 1 / 0 is inf
        assert np.isinf(result.fill_value)

    def test_fill_value_when_combine_const(self):
        # GH12723
        s = SparseSeries([0, 1, np.nan, 3, 4, 5], index=np.arange(6))

        exp = s.fillna(0).add(2)
        res = s.add(2, fill_value=0)
        tm.assert_series_equal(res, exp)

    def test_shift(self):
        series = SparseSeries([nan, 1., 2., 3., nan, nan], index=np.arange(6))

        shifted = series.shift(0)
        assert shifted is not series
        tm.assert_sp_series_equal(shifted, series)

        f = lambda s: s.shift(1)
        _dense_series_compare(series, f)

        f = lambda s: s.shift(-2)
        _dense_series_compare(series, f)

        series = SparseSeries([nan, 1., 2., 3., nan, nan],
                              index=bdate_range('1/1/2000', periods=6))
        f = lambda s: s.shift(2, freq='B')
        _dense_series_compare(series, f)

        f = lambda s: s.shift(2, freq=BDay())
        _dense_series_compare(series, f)

    def test_shift_nan(self):
        # GH 12908
        orig = pd.Series([np.nan, 2, np.nan, 4, 0, np.nan, 0])
        sparse = orig.to_sparse()

        tm.assert_sp_series_equal(sparse.shift(0), orig.shift(0).to_sparse())
        tm.assert_sp_series_equal(sparse.shift(1), orig.shift(1).to_sparse())
        tm.assert_sp_series_equal(sparse.shift(2), orig.shift(2).to_sparse())
        tm.assert_sp_series_equal(sparse.shift(3), orig.shift(3).to_sparse())

        tm.assert_sp_series_equal(sparse.shift(-1), orig.shift(-1).to_sparse())
        tm.assert_sp_series_equal(sparse.shift(-2), orig.shift(-2).to_sparse())
        tm.assert_sp_series_equal(sparse.shift(-3), orig.shift(-3).to_sparse())
        tm.assert_sp_series_equal(sparse.shift(-4), orig.shift(-4).to_sparse())

        sparse = orig.to_sparse(fill_value=0)
        tm.assert_sp_series_equal(sparse.shift(0),
                                  orig.shift(0).to_sparse(fill_value=0))
        tm.assert_sp_series_equal(sparse.shift(1),
                                  orig.shift(1).to_sparse(fill_value=0))
        tm.assert_sp_series_equal(sparse.shift(2),
                                  orig.shift(2).to_sparse(fill_value=0))
        tm.assert_sp_series_equal(sparse.shift(3),
                                  orig.shift(3).to_sparse(fill_value=0))

        tm.assert_sp_series_equal(sparse.shift(-1),
                                  orig.shift(-1).to_sparse(fill_value=0))
        tm.assert_sp_series_equal(sparse.shift(-2),
                                  orig.shift(-2).to_sparse(fill_value=0))
        tm.assert_sp_series_equal(sparse.shift(-3),
                                  orig.shift(-3).to_sparse(fill_value=0))
        tm.assert_sp_series_equal(sparse.shift(-4),
                                  orig.shift(-4).to_sparse(fill_value=0))

    def test_shift_dtype(self):
        # GH 12908
        orig = pd.Series([1, 2, 3, 4], dtype=np.int64)

        sparse = orig.to_sparse()
        tm.assert_sp_series_equal(sparse.shift(0), orig.shift(0).to_sparse())

        sparse = orig.to_sparse(fill_value=np.nan)
        tm.assert_sp_series_equal(sparse.shift(0),
                                  orig.shift(0).to_sparse(fill_value=np.nan))
        # shift(1) or more span changes dtype to float64
        tm.assert_sp_series_equal(sparse.shift(1), orig.shift(1).to_sparse())
        tm.assert_sp_series_equal(sparse.shift(2), orig.shift(2).to_sparse())
        tm.assert_sp_series_equal(sparse.shift(3), orig.shift(3).to_sparse())

        tm.assert_sp_series_equal(sparse.shift(-1), orig.shift(-1).to_sparse())
        tm.assert_sp_series_equal(sparse.shift(-2), orig.shift(-2).to_sparse())
        tm.assert_sp_series_equal(sparse.shift(-3), orig.shift(-3).to_sparse())
        tm.assert_sp_series_equal(sparse.shift(-4), orig.shift(-4).to_sparse())

    def test_shift_dtype_fill_value(self):
        # GH 12908
        orig = pd.Series([1, 0, 0, 4], dtype=np.int64)

        for v in [0, 1, np.nan]:
            sparse = orig.to_sparse(fill_value=v)

            tm.assert_sp_series_equal(sparse.shift(0),
                                      orig.shift(0).to_sparse(fill_value=v))
            tm.assert_sp_series_equal(sparse.shift(1),
                                      orig.shift(1).to_sparse(fill_value=v))
            tm.assert_sp_series_equal(sparse.shift(2),
                                      orig.shift(2).to_sparse(fill_value=v))
            tm.assert_sp_series_equal(sparse.shift(3),
                                      orig.shift(3).to_sparse(fill_value=v))

            tm.assert_sp_series_equal(sparse.shift(-1),
                                      orig.shift(-1).to_sparse(fill_value=v))
            tm.assert_sp_series_equal(sparse.shift(-2),
                                      orig.shift(-2).to_sparse(fill_value=v))
            tm.assert_sp_series_equal(sparse.shift(-3),
                                      orig.shift(-3).to_sparse(fill_value=v))
            tm.assert_sp_series_equal(sparse.shift(-4),
                                      orig.shift(-4).to_sparse(fill_value=v))

    def test_combine_first(self):
        s = self.bseries

        result = s[::2].combine_first(s)
        result2 = s[::2].combine_first(s.to_dense())

        expected = s[::2].to_dense().combine_first(s.to_dense())
        expected = expected.to_sparse(fill_value=s.fill_value)

        tm.assert_sp_series_equal(result, result2)
        tm.assert_sp_series_equal(result, expected)


class TestSparseHandlingMultiIndexes(object):

    def setup_method(self, method):
        miindex = pd.MultiIndex.from_product(
            [["x", "y"], ["10", "20"]], names=['row-foo', 'row-bar'])
        micol = pd.MultiIndex.from_product(
            [['a', 'b', 'c'], ["1", "2"]], names=['col-foo', 'col-bar'])
        dense_multiindex_frame = pd.DataFrame(
            index=miindex, columns=micol).sort_index().sort_index(axis=1)
        self.dense_multiindex_frame = dense_multiindex_frame.fillna(value=3.14)

    def test_to_sparse_preserve_multiindex_names_columns(self):
        sparse_multiindex_frame = self.dense_multiindex_frame.to_sparse()
        sparse_multiindex_frame = sparse_multiindex_frame.copy()
        tm.assert_index_equal(sparse_multiindex_frame.columns,
                              self.dense_multiindex_frame.columns)

    def test_round_trip_preserve_multiindex_names(self):
        sparse_multiindex_frame = self.dense_multiindex_frame.to_sparse()
        round_trip_multiindex_frame = sparse_multiindex_frame.to_dense()
        tm.assert_frame_equal(self.dense_multiindex_frame,
                              round_trip_multiindex_frame,
                              check_column_type=True,
                              check_names=True)


class TestSparseSeriesScipyInteraction(object):
    # Issue 8048: add SparseSeries coo methods

    def setup_method(self, method):
        tm._skip_if_no_scipy()
        import scipy.sparse
        # SparseSeries inputs used in tests, the tests rely on the order
        self.sparse_series = []
        s = pd.Series([3.0, nan, 1.0, 2.0, nan, nan])
        s.index = pd.MultiIndex.from_tuples([(1, 2, 'a', 0),
                                             (1, 2, 'a', 1),
                                             (1, 1, 'b', 0),
                                             (1, 1, 'b', 1),
                                             (2, 1, 'b', 0),
                                             (2, 1, 'b', 1)],
                                            names=['A', 'B', 'C', 'D'])
        self.sparse_series.append(s.to_sparse())

        ss = self.sparse_series[0].copy()
        ss.index.names = [3, 0, 1, 2]
        self.sparse_series.append(ss)

        ss = pd.Series([
            nan
        ] * 12, index=cartesian_product((range(3), range(4)))).to_sparse()
        for k, v in zip([(0, 0), (1, 2), (1, 3)], [3.0, 1.0, 2.0]):
            ss[k] = v
        self.sparse_series.append(ss)

        # results used in tests
        self.coo_matrices = []
        self.coo_matrices.append(scipy.sparse.coo_matrix(
            ([3.0, 1.0, 2.0], ([0, 1, 1], [0, 2, 3])), shape=(3, 4)))
        self.coo_matrices.append(scipy.sparse.coo_matrix(
            ([3.0, 1.0, 2.0], ([1, 0, 0], [0, 2, 3])), shape=(3, 4)))
        self.coo_matrices.append(scipy.sparse.coo_matrix(
            ([3.0, 1.0, 2.0], ([0, 1, 1], [0, 0, 1])), shape=(3, 2)))
        self.ils = [[(1, 2), (1, 1), (2, 1)], [(1, 1), (1, 2), (2, 1)],
                    [(1, 2, 'a'), (1, 1, 'b'), (2, 1, 'b')]]
        self.jls = [[('a', 0), ('a', 1), ('b', 0), ('b', 1)], [0, 1]]

    def test_to_coo_text_names_integer_row_levels_nosort(self):
        ss = self.sparse_series[0]
        kwargs = {'row_levels': [0, 1], 'column_levels': [2, 3]}
        result = (self.coo_matrices[0], self.ils[0], self.jls[0])
        self._run_test(ss, kwargs, result)

    def test_to_coo_text_names_integer_row_levels_sort(self):
        ss = self.sparse_series[0]
        kwargs = {'row_levels': [0, 1],
                  'column_levels': [2, 3],
                  'sort_labels': True}
        result = (self.coo_matrices[1], self.ils[1], self.jls[0])
        self._run_test(ss, kwargs, result)

    def test_to_coo_text_names_text_row_levels_nosort_col_level_single(self):
        ss = self.sparse_series[0]
        kwargs = {'row_levels': ['A', 'B', 'C'],
                  'column_levels': ['D'],
                  'sort_labels': False}
        result = (self.coo_matrices[2], self.ils[2], self.jls[1])
        self._run_test(ss, kwargs, result)

    def test_to_coo_integer_names_integer_row_levels_nosort(self):
        ss = self.sparse_series[1]
        kwargs = {'row_levels': [3, 0], 'column_levels': [1, 2]}
        result = (self.coo_matrices[0], self.ils[0], self.jls[0])
        self._run_test(ss, kwargs, result)

    def test_to_coo_text_names_text_row_levels_nosort(self):
        ss = self.sparse_series[0]
        kwargs = {'row_levels': ['A', 'B'], 'column_levels': ['C', 'D']}
        result = (self.coo_matrices[0], self.ils[0], self.jls[0])
        self._run_test(ss, kwargs, result)

    def test_to_coo_bad_partition_nonnull_intersection(self):
        ss = self.sparse_series[0]
        pytest.raises(ValueError, ss.to_coo, ['A', 'B', 'C'], ['C', 'D'])

    def test_to_coo_bad_partition_small_union(self):
        ss = self.sparse_series[0]
        pytest.raises(ValueError, ss.to_coo, ['A'], ['C', 'D'])

    def test_to_coo_nlevels_less_than_two(self):
        ss = self.sparse_series[0]
        ss.index = np.arange(len(ss.index))
        pytest.raises(ValueError, ss.to_coo)

    def test_to_coo_bad_ilevel(self):
        ss = self.sparse_series[0]
        pytest.raises(KeyError, ss.to_coo, ['A', 'B'], ['C', 'D', 'E'])

    def test_to_coo_duplicate_index_entries(self):
        ss = pd.concat([self.sparse_series[0],
                        self.sparse_series[0]]).to_sparse()
        pytest.raises(ValueError, ss.to_coo, ['A', 'B'], ['C', 'D'])

    def test_from_coo_dense_index(self):
        ss = SparseSeries.from_coo(self.coo_matrices[0], dense_index=True)
        check = self.sparse_series[2]
        tm.assert_sp_series_equal(ss, check)

    def test_from_coo_nodense_index(self):
        ss = SparseSeries.from_coo(self.coo_matrices[0], dense_index=False)
        check = self.sparse_series[2]
        check = check.dropna().to_sparse()
        tm.assert_sp_series_equal(ss, check)

    def test_from_coo_long_repr(self):
        # GH 13114
        # test it doesn't raise error. Formatting is tested in test_format
        tm._skip_if_no_scipy()
        import scipy.sparse

        sparse = SparseSeries.from_coo(scipy.sparse.rand(350, 18))
        repr(sparse)

    def _run_test(self, ss, kwargs, check):
        results = ss.to_coo(**kwargs)
        self._check_results_to_coo(results, check)
        # for every test, also test symmetry property (transpose), switch
        # row_levels and column_levels
        d = kwargs.copy()
        d['row_levels'] = kwargs['column_levels']
        d['column_levels'] = kwargs['row_levels']
        results = ss.to_coo(**d)
        results = (results[0].T, results[2], results[1])
        self._check_results_to_coo(results, check)

    def _check_results_to_coo(self, results, check):
        (A, il, jl) = results
        (A_result, il_result, jl_result) = check
        # convert to dense and compare
        tm.assert_numpy_array_equal(A.todense(), A_result.todense())
        # or compare directly as difference of sparse
        # assert(abs(A - A_result).max() < 1e-12) # max is failing in python
        # 2.6
        assert il == il_result
        assert jl == jl_result

    def test_concat(self):
        val1 = np.array([1, 2, np.nan, np.nan, 0, np.nan])
        val2 = np.array([3, np.nan, 4, 0, 0])

        for kind in ['integer', 'block']:
            sparse1 = pd.SparseSeries(val1, name='x', kind=kind)
            sparse2 = pd.SparseSeries(val2, name='y', kind=kind)

            res = pd.concat([sparse1, sparse2])
            exp = pd.concat([pd.Series(val1), pd.Series(val2)])
            exp = pd.SparseSeries(exp, kind=kind)
            tm.assert_sp_series_equal(res, exp)

            sparse1 = pd.SparseSeries(val1, fill_value=0, name='x', kind=kind)
            sparse2 = pd.SparseSeries(val2, fill_value=0, name='y', kind=kind)

            res = pd.concat([sparse1, sparse2])
            exp = pd.concat([pd.Series(val1), pd.Series(val2)])
            exp = pd.SparseSeries(exp, fill_value=0, kind=kind)
            tm.assert_sp_series_equal(res, exp)

    def test_concat_axis1(self):
        val1 = np.array([1, 2, np.nan, np.nan, 0, np.nan])
        val2 = np.array([3, np.nan, 4, 0, 0])

        sparse1 = pd.SparseSeries(val1, name='x')
        sparse2 = pd.SparseSeries(val2, name='y')

        res = pd.concat([sparse1, sparse2], axis=1)
        exp = pd.concat([pd.Series(val1, name='x'),
                         pd.Series(val2, name='y')], axis=1)
        exp = pd.SparseDataFrame(exp)
        tm.assert_sp_frame_equal(res, exp)

    def test_concat_different_fill(self):
        val1 = np.array([1, 2, np.nan, np.nan, 0, np.nan])
        val2 = np.array([3, np.nan, 4, 0, 0])

        for kind in ['integer', 'block']:
            sparse1 = pd.SparseSeries(val1, name='x', kind=kind)
            sparse2 = pd.SparseSeries(val2, name='y', kind=kind, fill_value=0)

            res = pd.concat([sparse1, sparse2])
            exp = pd.concat([pd.Series(val1), pd.Series(val2)])
            exp = pd.SparseSeries(exp, kind=kind)
            tm.assert_sp_series_equal(res, exp)

            res = pd.concat([sparse2, sparse1])
            exp = pd.concat([pd.Series(val2), pd.Series(val1)])
            exp = pd.SparseSeries(exp, kind=kind, fill_value=0)
            tm.assert_sp_series_equal(res, exp)

    def test_concat_axis1_different_fill(self):
        val1 = np.array([1, 2, np.nan, np.nan, 0, np.nan])
        val2 = np.array([3, np.nan, 4, 0, 0])

        sparse1 = pd.SparseSeries(val1, name='x')
        sparse2 = pd.SparseSeries(val2, name='y', fill_value=0)

        res = pd.concat([sparse1, sparse2], axis=1)
        exp = pd.concat([pd.Series(val1, name='x'),
                         pd.Series(val2, name='y')], axis=1)
        assert isinstance(res, pd.SparseDataFrame)
        tm.assert_frame_equal(res.to_dense(), exp)

    def test_concat_different_kind(self):
        val1 = np.array([1, 2, np.nan, np.nan, 0, np.nan])
        val2 = np.array([3, np.nan, 4, 0, 0])

        sparse1 = pd.SparseSeries(val1, name='x', kind='integer')
        sparse2 = pd.SparseSeries(val2, name='y', kind='block', fill_value=0)

        res = pd.concat([sparse1, sparse2])
        exp = pd.concat([pd.Series(val1), pd.Series(val2)])
        exp = pd.SparseSeries(exp, kind='integer')
        tm.assert_sp_series_equal(res, exp)

        res = pd.concat([sparse2, sparse1])
        exp = pd.concat([pd.Series(val2), pd.Series(val1)])
        exp = pd.SparseSeries(exp, kind='block', fill_value=0)
        tm.assert_sp_series_equal(res, exp)

    def test_concat_sparse_dense(self):
        # use first input's fill_value
        val1 = np.array([1, 2, np.nan, np.nan, 0, np.nan])
        val2 = np.array([3, np.nan, 4, 0, 0])

        for kind in ['integer', 'block']:
            sparse = pd.SparseSeries(val1, name='x', kind=kind)
            dense = pd.Series(val2, name='y')

            res = pd.concat([sparse, dense])
            exp = pd.concat([pd.Series(val1), dense])
            exp = pd.SparseSeries(exp, kind=kind)
            tm.assert_sp_series_equal(res, exp)

            res = pd.concat([dense, sparse, dense])
            exp = pd.concat([dense, pd.Series(val1), dense])
            exp = pd.SparseSeries(exp, kind=kind)
            tm.assert_sp_series_equal(res, exp)

            sparse = pd.SparseSeries(val1, name='x', kind=kind, fill_value=0)
            dense = pd.Series(val2, name='y')

            res = pd.concat([sparse, dense])
            exp = pd.concat([pd.Series(val1), dense])
            exp = pd.SparseSeries(exp, kind=kind, fill_value=0)
            tm.assert_sp_series_equal(res, exp)

            res = pd.concat([dense, sparse, dense])
            exp = pd.concat([dense, pd.Series(val1), dense])
            exp = pd.SparseSeries(exp, kind=kind, fill_value=0)
            tm.assert_sp_series_equal(res, exp)

    def test_value_counts(self):
        vals = [1, 2, nan, 0, nan, 1, 2, nan, nan, 1, 2, 0, 1, 1]
        dense = pd.Series(vals, name='xx')

        sparse = pd.SparseSeries(vals, name='xx')
        tm.assert_series_equal(sparse.value_counts(),
                               dense.value_counts())
        tm.assert_series_equal(sparse.value_counts(dropna=False),
                               dense.value_counts(dropna=False))

        sparse = pd.SparseSeries(vals, name='xx', fill_value=0)
        tm.assert_series_equal(sparse.value_counts(),
                               dense.value_counts())
        tm.assert_series_equal(sparse.value_counts(dropna=False),
                               dense.value_counts(dropna=False))

    def test_value_counts_dup(self):
        vals = [1, 2, nan, 0, nan, 1, 2, nan, nan, 1, 2, 0, 1, 1]

        # numeric op may cause sp_values to include the same value as
        # fill_value
        dense = pd.Series(vals, name='xx') / 0.
        sparse = pd.SparseSeries(vals, name='xx') / 0.
        tm.assert_series_equal(sparse.value_counts(),
                               dense.value_counts())
        tm.assert_series_equal(sparse.value_counts(dropna=False),
                               dense.value_counts(dropna=False))

        vals = [1, 2, 0, 0, 0, 1, 2, 0, 0, 1, 2, 0, 1, 1]

        dense = pd.Series(vals, name='xx') * 0.
        sparse = pd.SparseSeries(vals, name='xx') * 0.
        tm.assert_series_equal(sparse.value_counts(),
                               dense.value_counts())
        tm.assert_series_equal(sparse.value_counts(dropna=False),
                               dense.value_counts(dropna=False))

    def test_value_counts_int(self):
        vals = [1, 2, 0, 1, 2, 1, 2, 0, 1, 1]
        dense = pd.Series(vals, name='xx')

        # fill_value is np.nan, but should not be included in the result
        sparse = pd.SparseSeries(vals, name='xx')
        tm.assert_series_equal(sparse.value_counts(),
                               dense.value_counts())
        tm.assert_series_equal(sparse.value_counts(dropna=False),
                               dense.value_counts(dropna=False))

        sparse = pd.SparseSeries(vals, name='xx', fill_value=0)
        tm.assert_series_equal(sparse.value_counts(),
                               dense.value_counts())
        tm.assert_series_equal(sparse.value_counts(dropna=False),
                               dense.value_counts(dropna=False))

    def test_isnull(self):
        # GH 8276
        s = pd.SparseSeries([np.nan, np.nan, 1, 2, np.nan], name='xxx')

        res = s.isnull()
        exp = pd.SparseSeries([True, True, False, False, True], name='xxx',
                              fill_value=True)
        tm.assert_sp_series_equal(res, exp)

        # if fill_value is not nan, True can be included in sp_values
        s = pd.SparseSeries([np.nan, 0., 1., 2., 0.], name='xxx',
                            fill_value=0.)
        res = s.isnull()
        assert isinstance(res, pd.SparseSeries)
        exp = pd.Series([True, False, False, False, False], name='xxx')
        tm.assert_series_equal(res.to_dense(), exp)

    def test_isnotnull(self):
        # GH 8276
        s = pd.SparseSeries([np.nan, np.nan, 1, 2, np.nan], name='xxx')

        res = s.isnotnull()
        exp = pd.SparseSeries([False, False, True, True, False], name='xxx',
                              fill_value=False)
        tm.assert_sp_series_equal(res, exp)

        # if fill_value is not nan, True can be included in sp_values
        s = pd.SparseSeries([np.nan, 0., 1., 2., 0.], name='xxx',
                            fill_value=0.)
        res = s.isnotnull()
        assert isinstance(res, pd.SparseSeries)
        exp = pd.Series([False, True, True, True, True], name='xxx')
        tm.assert_series_equal(res.to_dense(), exp)


def _dense_series_compare(s, f):
    result = f(s)
    assert (isinstance(result, SparseSeries))
    dense_result = f(s.to_dense())
    tm.assert_series_equal(result.to_dense(), dense_result)


class TestSparseSeriesAnalytics(object):

    def setup_method(self, method):
        arr, index = _test_data1()
        self.bseries = SparseSeries(arr, index=index, kind='block',
                                    name='bseries')

        arr, index = _test_data1_zero()
        self.zbseries = SparseSeries(arr, index=index, kind='block',
                                     fill_value=0, name='zbseries')

    def test_cumsum(self):
        result = self.bseries.cumsum()
        expected = SparseSeries(self.bseries.to_dense().cumsum())
        tm.assert_sp_series_equal(result, expected)

        result = self.zbseries.cumsum()
        expected = self.zbseries.to_dense().cumsum()
        tm.assert_series_equal(result, expected)

        axis = 1  # Series is 1-D, so only axis = 0 is valid.
        msg = "No axis named {axis}".format(axis=axis)
        with tm.assert_raises_regex(ValueError, msg):
            self.bseries.cumsum(axis=axis)

    def test_numpy_cumsum(self):
        result = np.cumsum(self.bseries)
        expected = SparseSeries(self.bseries.to_dense().cumsum())
        tm.assert_sp_series_equal(result, expected)

        result = np.cumsum(self.zbseries)
        expected = self.zbseries.to_dense().cumsum()
        tm.assert_series_equal(result, expected)

        msg = "the 'dtype' parameter is not supported"
        tm.assert_raises_regex(ValueError, msg, np.cumsum,
                               self.bseries, dtype=np.int64)

        msg = "the 'out' parameter is not supported"
        tm.assert_raises_regex(ValueError, msg, np.cumsum,
                               self.zbseries, out=result)

    def test_numpy_func_call(self):
        # no exception should be raised even though
        # numpy passes in 'axis=None' or `axis=-1'
        funcs = ['sum', 'cumsum', 'var', 'mean',
                 'prod', 'cumprod', 'std', 'argsort',
                 'argmin', 'argmax', 'min', 'max']
        for func in funcs:
            for series in ('bseries', 'zbseries'):
                getattr(np, func)(getattr(self, series))
