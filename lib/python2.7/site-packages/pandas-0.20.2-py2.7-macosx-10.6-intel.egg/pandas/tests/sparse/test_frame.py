# pylint: disable-msg=E1101,W0612

import operator

import pytest
from warnings import catch_warnings
from numpy import nan
import numpy as np
import pandas as pd

from pandas import Series, DataFrame, bdate_range, Panel
from pandas.core.dtypes.common import (
    is_bool_dtype,
    is_float_dtype,
    is_object_dtype,
    is_float)
from pandas.core.indexes.datetimes import DatetimeIndex
from pandas.tseries.offsets import BDay
from pandas.util import testing as tm
from pandas.compat import lrange
from pandas import compat
from pandas.core.sparse import frame as spf

from pandas._libs.sparse import BlockIndex, IntIndex
from pandas.core.sparse.api import SparseSeries, SparseDataFrame, SparseArray
from pandas.tests.frame.test_api import SharedWithSparse


class TestSparseDataFrame(SharedWithSparse):
    klass = SparseDataFrame

    def setup_method(self, method):
        self.data = {'A': [nan, nan, nan, 0, 1, 2, 3, 4, 5, 6],
                     'B': [0, 1, 2, nan, nan, nan, 3, 4, 5, 6],
                     'C': np.arange(10, dtype=np.float64),
                     'D': [0, 1, 2, 3, 4, 5, nan, nan, nan, nan]}

        self.dates = bdate_range('1/1/2011', periods=10)

        self.orig = pd.DataFrame(self.data, index=self.dates)
        self.iorig = pd.DataFrame(self.data, index=self.dates)

        self.frame = SparseDataFrame(self.data, index=self.dates)
        self.iframe = SparseDataFrame(self.data, index=self.dates,
                                      default_kind='integer')

        values = self.frame.values.copy()
        values[np.isnan(values)] = 0

        self.zorig = pd.DataFrame(values, columns=['A', 'B', 'C', 'D'],
                                  index=self.dates)
        self.zframe = SparseDataFrame(values, columns=['A', 'B', 'C', 'D'],
                                      default_fill_value=0, index=self.dates)

        values = self.frame.values.copy()
        values[np.isnan(values)] = 2

        self.fill_orig = pd.DataFrame(values, columns=['A', 'B', 'C', 'D'],
                                      index=self.dates)
        self.fill_frame = SparseDataFrame(values, columns=['A', 'B', 'C', 'D'],
                                          default_fill_value=2,
                                          index=self.dates)

        self.empty = SparseDataFrame()

    def test_fill_value_when_combine_const(self):
        # GH12723
        dat = np.array([0, 1, np.nan, 3, 4, 5], dtype='float')
        df = SparseDataFrame({'foo': dat}, index=range(6))

        exp = df.fillna(0).add(2)
        res = df.add(2, fill_value=0)
        tm.assert_sp_frame_equal(res, exp)

    def test_as_matrix(self):
        empty = self.empty.as_matrix()
        assert empty.shape == (0, 0)

        no_cols = SparseDataFrame(index=np.arange(10))
        mat = no_cols.as_matrix()
        assert mat.shape == (10, 0)

        no_index = SparseDataFrame(columns=np.arange(10))
        mat = no_index.as_matrix()
        assert mat.shape == (0, 10)

    def test_copy(self):
        cp = self.frame.copy()
        assert isinstance(cp, SparseDataFrame)
        tm.assert_sp_frame_equal(cp, self.frame)

        # as of v0.15.0
        # this is now identical (but not is_a )
        assert cp.index.identical(self.frame.index)

    def test_constructor(self):
        for col, series in compat.iteritems(self.frame):
            assert isinstance(series, SparseSeries)

        assert isinstance(self.iframe['A'].sp_index, IntIndex)

        # constructed zframe from matrix above
        assert self.zframe['A'].fill_value == 0
        tm.assert_numpy_array_equal(pd.SparseArray([1., 2., 3., 4., 5., 6.]),
                                    self.zframe['A'].values)
        tm.assert_numpy_array_equal(np.array([0., 0., 0., 0., 1., 2.,
                                              3., 4., 5., 6.]),
                                    self.zframe['A'].to_dense().values)

        # construct no data
        sdf = SparseDataFrame(columns=np.arange(10), index=np.arange(10))
        for col, series in compat.iteritems(sdf):
            assert isinstance(series, SparseSeries)

        # construct from nested dict
        data = {}
        for c, s in compat.iteritems(self.frame):
            data[c] = s.to_dict()

        sdf = SparseDataFrame(data)
        tm.assert_sp_frame_equal(sdf, self.frame)

        # TODO: test data is copied from inputs

        # init dict with different index
        idx = self.frame.index[:5]
        cons = SparseDataFrame(
            self.frame, index=idx, columns=self.frame.columns,
            default_fill_value=self.frame.default_fill_value,
            default_kind=self.frame.default_kind, copy=True)
        reindexed = self.frame.reindex(idx)

        tm.assert_sp_frame_equal(cons, reindexed, exact_indices=False)

        # assert level parameter breaks reindex
        with pytest.raises(TypeError):
            self.frame.reindex(idx, level=0)

        repr(self.frame)

    def test_constructor_ndarray(self):
        # no index or columns
        sp = SparseDataFrame(self.frame.values)

        # 1d
        sp = SparseDataFrame(self.data['A'], index=self.dates, columns=['A'])
        tm.assert_sp_frame_equal(sp, self.frame.reindex(columns=['A']))

        # raise on level argument
        pytest.raises(TypeError, self.frame.reindex, columns=['A'],
                      level=1)

        # wrong length index / columns
        with tm.assert_raises_regex(ValueError, "^Index length"):
            SparseDataFrame(self.frame.values, index=self.frame.index[:-1])

        with tm.assert_raises_regex(ValueError, "^Column length"):
            SparseDataFrame(self.frame.values, columns=self.frame.columns[:-1])

    # GH 9272
    def test_constructor_empty(self):
        sp = SparseDataFrame()
        assert len(sp.index) == 0
        assert len(sp.columns) == 0

    def test_constructor_dataframe(self):
        dense = self.frame.to_dense()
        sp = SparseDataFrame(dense)
        tm.assert_sp_frame_equal(sp, self.frame)

    def test_constructor_convert_index_once(self):
        arr = np.array([1.5, 2.5, 3.5])
        sdf = SparseDataFrame(columns=lrange(4), index=arr)
        assert sdf[0].index is sdf[1].index

    def test_constructor_from_series(self):

        # GH 2873
        x = Series(np.random.randn(10000), name='a')
        x = x.to_sparse(fill_value=0)
        assert isinstance(x, SparseSeries)
        df = SparseDataFrame(x)
        assert isinstance(df, SparseDataFrame)

        x = Series(np.random.randn(10000), name='a')
        y = Series(np.random.randn(10000), name='b')
        x2 = x.astype(float)
        x2.loc[:9998] = np.NaN
        # TODO: x_sparse is unused...fix
        x_sparse = x2.to_sparse(fill_value=np.NaN)  # noqa

        # Currently fails too with weird ufunc error
        # df1 = SparseDataFrame([x_sparse, y])

        y.loc[:9998] = 0
        # TODO: y_sparse is unsused...fix
        y_sparse = y.to_sparse(fill_value=0)  # noqa
        # without sparse value raises error
        # df2 = SparseDataFrame([x2_sparse, y])

    def test_constructor_preserve_attr(self):
        # GH 13866
        arr = pd.SparseArray([1, 0, 3, 0], dtype=np.int64, fill_value=0)
        assert arr.dtype == np.int64
        assert arr.fill_value == 0

        df = pd.SparseDataFrame({'x': arr})
        assert df['x'].dtype == np.int64
        assert df['x'].fill_value == 0

        s = pd.SparseSeries(arr, name='x')
        assert s.dtype == np.int64
        assert s.fill_value == 0

        df = pd.SparseDataFrame(s)
        assert df['x'].dtype == np.int64
        assert df['x'].fill_value == 0

        df = pd.SparseDataFrame({'x': s})
        assert df['x'].dtype == np.int64
        assert df['x'].fill_value == 0

    def test_constructor_nan_dataframe(self):
        # GH 10079
        trains = np.arange(100)
        tresholds = [10, 20, 30, 40, 50, 60]
        tuples = [(i, j) for i in trains for j in tresholds]
        index = pd.MultiIndex.from_tuples(tuples,
                                          names=['trains', 'tresholds'])
        matrix = np.empty((len(index), len(trains)))
        matrix.fill(np.nan)
        df = pd.DataFrame(matrix, index=index, columns=trains, dtype=float)
        result = df.to_sparse()
        expected = pd.SparseDataFrame(matrix, index=index, columns=trains,
                                      dtype=float)
        tm.assert_sp_frame_equal(result, expected)

    def test_type_coercion_at_construction(self):
        # GH 15682
        result = pd.SparseDataFrame(
            {'a': [1, 0, 0], 'b': [0, 1, 0], 'c': [0, 0, 1]}, dtype='uint8',
            default_fill_value=0)
        expected = pd.SparseDataFrame(
            {'a': pd.SparseSeries([1, 0, 0], dtype='uint8'),
             'b': pd.SparseSeries([0, 1, 0], dtype='uint8'),
             'c': pd.SparseSeries([0, 0, 1], dtype='uint8')},
            default_fill_value=0)
        tm.assert_sp_frame_equal(result, expected)

    def test_dtypes(self):
        df = DataFrame(np.random.randn(10000, 4))
        df.loc[:9998] = np.nan
        sdf = df.to_sparse()

        result = sdf.get_dtype_counts()
        expected = Series({'float64': 4})
        tm.assert_series_equal(result, expected)

    def test_shape(self):
        # see gh-10452
        assert self.frame.shape == (10, 4)
        assert self.iframe.shape == (10, 4)
        assert self.zframe.shape == (10, 4)
        assert self.fill_frame.shape == (10, 4)

    def test_str(self):
        df = DataFrame(np.random.randn(10000, 4))
        df.loc[:9998] = np.nan

        sdf = df.to_sparse()
        str(sdf)

    def test_array_interface(self):
        res = np.sqrt(self.frame)
        dres = np.sqrt(self.frame.to_dense())
        tm.assert_frame_equal(res.to_dense(), dres)

    def test_pickle(self):

        def _test_roundtrip(frame, orig):
            result = tm.round_trip_pickle(frame)
            tm.assert_sp_frame_equal(frame, result)
            tm.assert_frame_equal(result.to_dense(), orig, check_dtype=False)

        _test_roundtrip(SparseDataFrame(), DataFrame())
        self._check_all(_test_roundtrip)

    def test_dense_to_sparse(self):
        df = DataFrame({'A': [nan, nan, nan, 1, 2],
                        'B': [1, 2, nan, nan, nan]})
        sdf = df.to_sparse()
        assert isinstance(sdf, SparseDataFrame)
        assert np.isnan(sdf.default_fill_value)
        assert isinstance(sdf['A'].sp_index, BlockIndex)
        tm.assert_frame_equal(sdf.to_dense(), df)

        sdf = df.to_sparse(kind='integer')
        assert isinstance(sdf['A'].sp_index, IntIndex)

        df = DataFrame({'A': [0, 0, 0, 1, 2],
                        'B': [1, 2, 0, 0, 0]}, dtype=float)
        sdf = df.to_sparse(fill_value=0)
        assert sdf.default_fill_value == 0
        tm.assert_frame_equal(sdf.to_dense(), df)

    def test_density(self):
        df = SparseSeries([nan, nan, nan, 0, 1, 2, 3, 4, 5, 6])
        assert df.density == 0.7

        df = SparseDataFrame({'A': [nan, nan, nan, 0, 1, 2, 3, 4, 5, 6],
                              'B': [0, 1, 2, nan, nan, nan, 3, 4, 5, 6],
                              'C': np.arange(10),
                              'D': [0, 1, 2, 3, 4, 5, nan, nan, nan, nan]})

        assert df.density == 0.75

    def test_sparse_to_dense(self):
        pass

    def test_sparse_series_ops(self):
        self._check_frame_ops(self.frame)

    def test_sparse_series_ops_i(self):
        self._check_frame_ops(self.iframe)

    def test_sparse_series_ops_z(self):
        self._check_frame_ops(self.zframe)

    def test_sparse_series_ops_fill(self):
        self._check_frame_ops(self.fill_frame)

    def _check_frame_ops(self, frame):

        def _compare_to_dense(a, b, da, db, op):
            sparse_result = op(a, b)
            dense_result = op(da, db)

            fill = sparse_result.default_fill_value
            dense_result = dense_result.to_sparse(fill_value=fill)
            tm.assert_sp_frame_equal(sparse_result, dense_result,
                                     exact_indices=False)

            if isinstance(a, DataFrame) and isinstance(db, DataFrame):
                mixed_result = op(a, db)
                assert isinstance(mixed_result, SparseDataFrame)
                tm.assert_sp_frame_equal(mixed_result, sparse_result,
                                         exact_indices=False)

        opnames = ['add', 'sub', 'mul', 'truediv', 'floordiv']
        ops = [getattr(operator, name) for name in opnames]

        fidx = frame.index

        # time series operations

        series = [frame['A'], frame['B'], frame['C'], frame['D'],
                  frame['A'].reindex(fidx[:7]), frame['A'].reindex(fidx[::2]),
                  SparseSeries(
                      [], index=[])]

        for op in opnames:
            _compare_to_dense(frame, frame[::2], frame.to_dense(),
                              frame[::2].to_dense(), getattr(operator, op))

            # 2304, no auto-broadcasting
            for i, s in enumerate(series):
                f = lambda a, b: getattr(a, op)(b, axis='index')
                _compare_to_dense(frame, s, frame.to_dense(), s.to_dense(), f)

                # rops are not implemented
                # _compare_to_dense(s, frame, s.to_dense(),
                #                   frame.to_dense(), f)

                # cross-sectional operations
        series = [frame.xs(fidx[0]), frame.xs(fidx[3]), frame.xs(fidx[5]),
                  frame.xs(fidx[7]), frame.xs(fidx[5])[:2]]

        for op in ops:
            for s in series:
                _compare_to_dense(frame, s, frame.to_dense(), s, op)
                _compare_to_dense(s, frame, s, frame.to_dense(), op)

        # it works!
        result = self.frame + self.frame.loc[:, ['A', 'B']]  # noqa

    def test_op_corners(self):
        empty = self.empty + self.empty
        assert empty.empty

        foo = self.frame + self.empty
        assert isinstance(foo.index, DatetimeIndex)
        tm.assert_frame_equal(foo, self.frame * np.nan)

        foo = self.empty + self.frame
        tm.assert_frame_equal(foo, self.frame * np.nan)

    def test_scalar_ops(self):
        pass

    def test_getitem(self):
        # 1585 select multiple columns
        sdf = SparseDataFrame(index=[0, 1, 2], columns=['a', 'b', 'c'])

        result = sdf[['a', 'b']]
        exp = sdf.reindex(columns=['a', 'b'])
        tm.assert_sp_frame_equal(result, exp)

        pytest.raises(Exception, sdf.__getitem__, ['a', 'd'])

    def test_iloc(self):

        # 2227
        result = self.frame.iloc[:, 0]
        assert isinstance(result, SparseSeries)
        tm.assert_sp_series_equal(result, self.frame['A'])

        # preserve sparse index type. #2251
        data = {'A': [0, 1]}
        iframe = SparseDataFrame(data, default_kind='integer')
        tm.assert_class_equal(iframe['A'].sp_index,
                              iframe.iloc[:, 0].sp_index)

    def test_set_value(self):

        # ok, as the index gets converted to object
        frame = self.frame.copy()
        res = frame.set_value('foobar', 'B', 1.5)
        assert res.index.dtype == 'object'

        res = self.frame
        res.index = res.index.astype(object)

        res = self.frame.set_value('foobar', 'B', 1.5)
        assert res is not self.frame
        assert res.index[-1] == 'foobar'
        assert res.get_value('foobar', 'B') == 1.5

        res2 = res.set_value('foobar', 'qux', 1.5)
        assert res2 is not res
        tm.assert_index_equal(res2.columns,
                              pd.Index(list(self.frame.columns) + ['qux']))
        assert res2.get_value('foobar', 'qux') == 1.5

    def test_fancy_index_misc(self):
        # axis = 0
        sliced = self.frame.iloc[-2:, :]
        expected = self.frame.reindex(index=self.frame.index[-2:])
        tm.assert_sp_frame_equal(sliced, expected)

        # axis = 1
        sliced = self.frame.iloc[:, -2:]
        expected = self.frame.reindex(columns=self.frame.columns[-2:])
        tm.assert_sp_frame_equal(sliced, expected)

    def test_getitem_overload(self):
        # slicing
        sl = self.frame[:20]
        tm.assert_sp_frame_equal(sl, self.frame.reindex(self.frame.index[:20]))

        # boolean indexing
        d = self.frame.index[5]
        indexer = self.frame.index > d

        subindex = self.frame.index[indexer]
        subframe = self.frame[indexer]

        tm.assert_index_equal(subindex, subframe.index)
        pytest.raises(Exception, self.frame.__getitem__, indexer[:-1])

    def test_setitem(self):

        def _check_frame(frame, orig):
            N = len(frame)

            # insert SparseSeries
            frame['E'] = frame['A']
            assert isinstance(frame['E'], SparseSeries)
            tm.assert_sp_series_equal(frame['E'], frame['A'],
                                      check_names=False)

            # insert SparseSeries differently-indexed
            to_insert = frame['A'][::2]
            frame['E'] = to_insert
            expected = to_insert.to_dense().reindex(frame.index)
            result = frame['E'].to_dense()
            tm.assert_series_equal(result, expected, check_names=False)
            assert result.name == 'E'

            # insert Series
            frame['F'] = frame['A'].to_dense()
            assert isinstance(frame['F'], SparseSeries)
            tm.assert_sp_series_equal(frame['F'], frame['A'],
                                      check_names=False)

            # insert Series differently-indexed
            to_insert = frame['A'].to_dense()[::2]
            frame['G'] = to_insert
            expected = to_insert.reindex(frame.index)
            expected.name = 'G'
            tm.assert_series_equal(frame['G'].to_dense(), expected)

            # insert ndarray
            frame['H'] = np.random.randn(N)
            assert isinstance(frame['H'], SparseSeries)

            to_sparsify = np.random.randn(N)
            to_sparsify[N // 2:] = frame.default_fill_value
            frame['I'] = to_sparsify
            assert len(frame['I'].sp_values) == N // 2

            # insert ndarray wrong size
            pytest.raises(Exception, frame.__setitem__, 'foo',
                          np.random.randn(N - 1))

            # scalar value
            frame['J'] = 5
            assert len(frame['J'].sp_values) == N
            assert (frame['J'].sp_values == 5).all()

            frame['K'] = frame.default_fill_value
            assert len(frame['K'].sp_values) == 0

        self._check_all(_check_frame)

    def test_setitem_corner(self):
        self.frame['a'] = self.frame['B']
        tm.assert_sp_series_equal(self.frame['a'], self.frame['B'],
                                  check_names=False)

    def test_setitem_array(self):
        arr = self.frame['B']

        self.frame['E'] = arr
        tm.assert_sp_series_equal(self.frame['E'], self.frame['B'],
                                  check_names=False)

        self.frame['F'] = arr[:-1]
        index = self.frame.index[:-1]
        tm.assert_sp_series_equal(self.frame['E'].reindex(index),
                                  self.frame['F'].reindex(index),
                                  check_names=False)

    def test_delitem(self):
        A = self.frame['A']
        C = self.frame['C']

        del self.frame['B']
        assert 'B' not in self.frame
        tm.assert_sp_series_equal(self.frame['A'], A)
        tm.assert_sp_series_equal(self.frame['C'], C)

        del self.frame['D']
        assert 'D' not in self.frame

        del self.frame['A']
        assert 'A' not in self.frame

    def test_set_columns(self):
        self.frame.columns = self.frame.columns
        pytest.raises(Exception, setattr, self.frame, 'columns',
                      self.frame.columns[:-1])

    def test_set_index(self):
        self.frame.index = self.frame.index
        pytest.raises(Exception, setattr, self.frame, 'index',
                      self.frame.index[:-1])

    def test_append(self):
        a = self.frame[:5]
        b = self.frame[5:]

        appended = a.append(b)
        tm.assert_sp_frame_equal(appended, self.frame, exact_indices=False)

        a = self.frame.iloc[:5, :3]
        b = self.frame.iloc[5:]
        appended = a.append(b)
        tm.assert_sp_frame_equal(appended.iloc[:, :3], self.frame.iloc[:, :3],
                                 exact_indices=False)

    def test_apply(self):
        applied = self.frame.apply(np.sqrt)
        assert isinstance(applied, SparseDataFrame)
        tm.assert_almost_equal(applied.values, np.sqrt(self.frame.values))

        applied = self.fill_frame.apply(np.sqrt)
        assert applied['A'].fill_value == np.sqrt(2)

        # agg / broadcast
        broadcasted = self.frame.apply(np.sum, broadcast=True)
        assert isinstance(broadcasted, SparseDataFrame)

        exp = self.frame.to_dense().apply(np.sum, broadcast=True)
        tm.assert_frame_equal(broadcasted.to_dense(), exp)

        assert self.empty.apply(np.sqrt) is self.empty

        from pandas.core import nanops
        applied = self.frame.apply(np.sum)
        tm.assert_series_equal(applied,
                               self.frame.to_dense().apply(nanops.nansum))

    def test_apply_nonuq(self):
        orig = DataFrame([[1, 2, 3], [4, 5, 6], [7, 8, 9]],
                         index=['a', 'a', 'c'])
        sparse = orig.to_sparse()
        res = sparse.apply(lambda s: s[0], axis=1)
        exp = orig.apply(lambda s: s[0], axis=1)
        # dtype must be kept
        assert res.dtype == np.int64
        # ToDo: apply must return subclassed dtype
        assert isinstance(res, pd.Series)
        tm.assert_series_equal(res.to_dense(), exp)

        # df.T breaks
        sparse = orig.T.to_sparse()
        res = sparse.apply(lambda s: s[0], axis=0)  # noqa
        exp = orig.T.apply(lambda s: s[0], axis=0)
        # TODO: no non-unique columns supported in sparse yet
        # tm.assert_series_equal(res.to_dense(), exp)

    def test_applymap(self):
        # just test that it works
        result = self.frame.applymap(lambda x: x * 2)
        assert isinstance(result, SparseDataFrame)

    def test_astype(self):
        sparse = pd.SparseDataFrame({'A': SparseArray([1, 2, 3, 4],
                                                      dtype=np.int64),
                                     'B': SparseArray([4, 5, 6, 7],
                                                      dtype=np.int64)})
        assert sparse['A'].dtype == np.int64
        assert sparse['B'].dtype == np.int64

        res = sparse.astype(np.float64)
        exp = pd.SparseDataFrame({'A': SparseArray([1., 2., 3., 4.],
                                                   fill_value=0.),
                                  'B': SparseArray([4., 5., 6., 7.],
                                                   fill_value=0.)},
                                 default_fill_value=np.nan)
        tm.assert_sp_frame_equal(res, exp)
        assert res['A'].dtype == np.float64
        assert res['B'].dtype == np.float64

        sparse = pd.SparseDataFrame({'A': SparseArray([0, 2, 0, 4],
                                                      dtype=np.int64),
                                     'B': SparseArray([0, 5, 0, 7],
                                                      dtype=np.int64)},
                                    default_fill_value=0)
        assert sparse['A'].dtype == np.int64
        assert sparse['B'].dtype == np.int64

        res = sparse.astype(np.float64)
        exp = pd.SparseDataFrame({'A': SparseArray([0., 2., 0., 4.],
                                                   fill_value=0.),
                                  'B': SparseArray([0., 5., 0., 7.],
                                                   fill_value=0.)},
                                 default_fill_value=0.)
        tm.assert_sp_frame_equal(res, exp)
        assert res['A'].dtype == np.float64
        assert res['B'].dtype == np.float64

    def test_astype_bool(self):
        sparse = pd.SparseDataFrame({'A': SparseArray([0, 2, 0, 4],
                                                      fill_value=0,
                                                      dtype=np.int64),
                                     'B': SparseArray([0, 5, 0, 7],
                                                      fill_value=0,
                                                      dtype=np.int64)},
                                    default_fill_value=0)
        assert sparse['A'].dtype == np.int64
        assert sparse['B'].dtype == np.int64

        res = sparse.astype(bool)
        exp = pd.SparseDataFrame({'A': SparseArray([False, True, False, True],
                                                   dtype=np.bool,
                                                   fill_value=False),
                                  'B': SparseArray([False, True, False, True],
                                                   dtype=np.bool,
                                                   fill_value=False)},
                                 default_fill_value=False)
        tm.assert_sp_frame_equal(res, exp)
        assert res['A'].dtype == np.bool
        assert res['B'].dtype == np.bool

    def test_fillna(self):
        df = self.zframe.reindex(lrange(5))
        dense = self.zorig.reindex(lrange(5))

        result = df.fillna(0)
        expected = dense.fillna(0)
        tm.assert_sp_frame_equal(result, expected.to_sparse(fill_value=0),
                                 exact_indices=False)
        tm.assert_frame_equal(result.to_dense(), expected)

        result = df.copy()
        result.fillna(0, inplace=True)
        expected = dense.fillna(0)

        tm.assert_sp_frame_equal(result, expected.to_sparse(fill_value=0),
                                 exact_indices=False)
        tm.assert_frame_equal(result.to_dense(), expected)

        result = df.copy()
        result = df['A']
        result.fillna(0, inplace=True)

        expected = dense['A'].fillna(0)
        # this changes internal SparseArray repr
        # tm.assert_sp_series_equal(result, expected.to_sparse(fill_value=0))
        tm.assert_series_equal(result.to_dense(), expected)

    def test_fillna_fill_value(self):
        df = pd.DataFrame({'A': [1, 0, 0], 'B': [np.nan, np.nan, 4]})

        sparse = pd.SparseDataFrame(df)
        tm.assert_frame_equal(sparse.fillna(-1).to_dense(),
                              df.fillna(-1), check_dtype=False)

        sparse = pd.SparseDataFrame(df, default_fill_value=0)
        tm.assert_frame_equal(sparse.fillna(-1).to_dense(),
                              df.fillna(-1), check_dtype=False)

    def test_sparse_frame_pad_backfill_limit(self):
        index = np.arange(10)
        df = DataFrame(np.random.randn(10, 4), index=index)
        sdf = df.to_sparse()

        result = sdf[:2].reindex(index, method='pad', limit=5)

        expected = sdf[:2].reindex(index).fillna(method='pad')
        expected = expected.to_dense()
        expected.values[-3:] = np.nan
        expected = expected.to_sparse()
        tm.assert_frame_equal(result, expected)

        result = sdf[-2:].reindex(index, method='backfill', limit=5)

        expected = sdf[-2:].reindex(index).fillna(method='backfill')
        expected = expected.to_dense()
        expected.values[:3] = np.nan
        expected = expected.to_sparse()
        tm.assert_frame_equal(result, expected)

    def test_sparse_frame_fillna_limit(self):
        index = np.arange(10)
        df = DataFrame(np.random.randn(10, 4), index=index)
        sdf = df.to_sparse()

        result = sdf[:2].reindex(index)
        result = result.fillna(method='pad', limit=5)

        expected = sdf[:2].reindex(index).fillna(method='pad')
        expected = expected.to_dense()
        expected.values[-3:] = np.nan
        expected = expected.to_sparse()
        tm.assert_frame_equal(result, expected)

        result = sdf[-2:].reindex(index)
        result = result.fillna(method='backfill', limit=5)

        expected = sdf[-2:].reindex(index).fillna(method='backfill')
        expected = expected.to_dense()
        expected.values[:3] = np.nan
        expected = expected.to_sparse()
        tm.assert_frame_equal(result, expected)

    def test_rename(self):
        result = self.frame.rename(index=str)
        expected = SparseDataFrame(self.data, index=self.dates.strftime(
            "%Y-%m-%d %H:%M:%S"))
        tm.assert_sp_frame_equal(result, expected)

        result = self.frame.rename(columns=lambda x: '%s%d' % (x, len(x)))
        data = {'A1': [nan, nan, nan, 0, 1, 2, 3, 4, 5, 6],
                'B1': [0, 1, 2, nan, nan, nan, 3, 4, 5, 6],
                'C1': np.arange(10, dtype=np.float64),
                'D1': [0, 1, 2, 3, 4, 5, nan, nan, nan, nan]}
        expected = SparseDataFrame(data, index=self.dates)
        tm.assert_sp_frame_equal(result, expected)

    def test_corr(self):
        res = self.frame.corr()
        tm.assert_frame_equal(res, self.frame.to_dense().corr())

    def test_describe(self):
        self.frame['foo'] = np.nan
        self.frame.get_dtype_counts()
        str(self.frame)
        desc = self.frame.describe()  # noqa

    def test_join(self):
        left = self.frame.loc[:, ['A', 'B']]
        right = self.frame.loc[:, ['C', 'D']]
        joined = left.join(right)
        tm.assert_sp_frame_equal(joined, self.frame, exact_indices=False)

        right = self.frame.loc[:, ['B', 'D']]
        pytest.raises(Exception, left.join, right)

        with tm.assert_raises_regex(ValueError,
                                    'Other Series must have a name'):
            self.frame.join(Series(
                np.random.randn(len(self.frame)), index=self.frame.index))

    def test_reindex(self):

        def _check_frame(frame):
            index = frame.index
            sidx = index[::2]
            sidx2 = index[:5]  # noqa

            sparse_result = frame.reindex(sidx)
            dense_result = frame.to_dense().reindex(sidx)
            tm.assert_frame_equal(sparse_result.to_dense(), dense_result)

            tm.assert_frame_equal(frame.reindex(list(sidx)).to_dense(),
                                  dense_result)

            sparse_result2 = sparse_result.reindex(index)
            dense_result2 = dense_result.reindex(index)
            tm.assert_frame_equal(sparse_result2.to_dense(), dense_result2)

            # propagate CORRECT fill value
            tm.assert_almost_equal(sparse_result.default_fill_value,
                                   frame.default_fill_value)
            tm.assert_almost_equal(sparse_result['A'].fill_value,
                                   frame['A'].fill_value)

            # length zero
            length_zero = frame.reindex([])
            assert len(length_zero) == 0
            assert len(length_zero.columns) == len(frame.columns)
            assert len(length_zero['A']) == 0

            # frame being reindexed has length zero
            length_n = length_zero.reindex(index)
            assert len(length_n) == len(frame)
            assert len(length_n.columns) == len(frame.columns)
            assert len(length_n['A']) == len(frame)

            # reindex columns
            reindexed = frame.reindex(columns=['A', 'B', 'Z'])
            assert len(reindexed.columns) == 3
            tm.assert_almost_equal(reindexed['Z'].fill_value,
                                   frame.default_fill_value)
            assert np.isnan(reindexed['Z'].sp_values).all()

        _check_frame(self.frame)
        _check_frame(self.iframe)
        _check_frame(self.zframe)
        _check_frame(self.fill_frame)

        # with copy=False
        reindexed = self.frame.reindex(self.frame.index, copy=False)
        reindexed['F'] = reindexed['A']
        assert 'F' in self.frame

        reindexed = self.frame.reindex(self.frame.index)
        reindexed['G'] = reindexed['A']
        assert 'G' not in self.frame

    def test_reindex_fill_value(self):
        rng = bdate_range('20110110', periods=20)

        result = self.zframe.reindex(rng, fill_value=0)
        exp = self.zorig.reindex(rng, fill_value=0)
        exp = exp.to_sparse(self.zframe.default_fill_value)
        tm.assert_sp_frame_equal(result, exp)

    def test_reindex_method(self):

        sparse = SparseDataFrame(data=[[11., 12., 14.],
                                       [21., 22., 24.],
                                       [41., 42., 44.]],
                                 index=[1, 2, 4],
                                 columns=[1, 2, 4],
                                 dtype=float)

        # Over indices

        # default method
        result = sparse.reindex(index=range(6))
        expected = SparseDataFrame(data=[[nan, nan, nan],
                                         [11., 12., 14.],
                                         [21., 22., 24.],
                                         [nan, nan, nan],
                                         [41., 42., 44.],
                                         [nan, nan, nan]],
                                   index=range(6),
                                   columns=[1, 2, 4],
                                   dtype=float)
        tm.assert_sp_frame_equal(result, expected)

        # method='bfill'
        result = sparse.reindex(index=range(6), method='bfill')
        expected = SparseDataFrame(data=[[11., 12., 14.],
                                         [11., 12., 14.],
                                         [21., 22., 24.],
                                         [41., 42., 44.],
                                         [41., 42., 44.],
                                         [nan, nan, nan]],
                                   index=range(6),
                                   columns=[1, 2, 4],
                                   dtype=float)
        tm.assert_sp_frame_equal(result, expected)

        # method='ffill'
        result = sparse.reindex(index=range(6), method='ffill')
        expected = SparseDataFrame(data=[[nan, nan, nan],
                                         [11., 12., 14.],
                                         [21., 22., 24.],
                                         [21., 22., 24.],
                                         [41., 42., 44.],
                                         [41., 42., 44.]],
                                   index=range(6),
                                   columns=[1, 2, 4],
                                   dtype=float)
        tm.assert_sp_frame_equal(result, expected)

        # Over columns

        # default method
        result = sparse.reindex(columns=range(6))
        expected = SparseDataFrame(data=[[nan, 11., 12., nan, 14., nan],
                                         [nan, 21., 22., nan, 24., nan],
                                         [nan, 41., 42., nan, 44., nan]],
                                   index=[1, 2, 4],
                                   columns=range(6),
                                   dtype=float)
        tm.assert_sp_frame_equal(result, expected)

        # method='bfill'
        with pytest.raises(NotImplementedError):
            sparse.reindex(columns=range(6), method='bfill')

        # method='ffill'
        with pytest.raises(NotImplementedError):
            sparse.reindex(columns=range(6), method='ffill')

    def test_take(self):
        result = self.frame.take([1, 0, 2], axis=1)
        expected = self.frame.reindex(columns=['B', 'A', 'C'])
        tm.assert_sp_frame_equal(result, expected)

    def test_to_dense(self):
        def _check(frame, orig):
            dense_dm = frame.to_dense()
            tm.assert_frame_equal(frame, dense_dm)
            tm.assert_frame_equal(dense_dm, orig, check_dtype=False)

        self._check_all(_check)

    def test_stack_sparse_frame(self):
        with catch_warnings(record=True):

            def _check(frame):
                dense_frame = frame.to_dense()  # noqa

                wp = Panel.from_dict({'foo': frame})
                from_dense_lp = wp.to_frame()

                from_sparse_lp = spf.stack_sparse_frame(frame)

                tm.assert_numpy_array_equal(from_dense_lp.values,
                                            from_sparse_lp.values)

            _check(self.frame)
            _check(self.iframe)

            # for now
            pytest.raises(Exception, _check, self.zframe)
            pytest.raises(Exception, _check, self.fill_frame)

    def test_transpose(self):

        def _check(frame, orig):
            transposed = frame.T
            untransposed = transposed.T
            tm.assert_sp_frame_equal(frame, untransposed)

            tm.assert_frame_equal(frame.T.to_dense(), orig.T)
            tm.assert_frame_equal(frame.T.T.to_dense(), orig.T.T)
            tm.assert_sp_frame_equal(frame, frame.T.T, exact_indices=False)

        self._check_all(_check)

    def test_shift(self):

        def _check(frame, orig):
            shifted = frame.shift(0)
            exp = orig.shift(0)
            tm.assert_frame_equal(shifted.to_dense(), exp)

            shifted = frame.shift(1)
            exp = orig.shift(1)
            tm.assert_frame_equal(shifted, exp)

            shifted = frame.shift(-2)
            exp = orig.shift(-2)
            tm.assert_frame_equal(shifted, exp)

            shifted = frame.shift(2, freq='B')
            exp = orig.shift(2, freq='B')
            exp = exp.to_sparse(frame.default_fill_value)
            tm.assert_frame_equal(shifted, exp)

            shifted = frame.shift(2, freq=BDay())
            exp = orig.shift(2, freq=BDay())
            exp = exp.to_sparse(frame.default_fill_value)
            tm.assert_frame_equal(shifted, exp)

        self._check_all(_check)

    def test_count(self):
        dense_result = self.frame.to_dense().count()

        result = self.frame.count()
        tm.assert_series_equal(result, dense_result)

        result = self.frame.count(axis=None)
        tm.assert_series_equal(result, dense_result)

        result = self.frame.count(axis=0)
        tm.assert_series_equal(result, dense_result)

        result = self.frame.count(axis=1)
        dense_result = self.frame.to_dense().count(axis=1)

        # win32 don't check dtype
        tm.assert_series_equal(result, dense_result, check_dtype=False)

    def _check_all(self, check_func):
        check_func(self.frame, self.orig)
        check_func(self.iframe, self.iorig)
        check_func(self.zframe, self.zorig)
        check_func(self.fill_frame, self.fill_orig)

    def test_numpy_transpose(self):
        sdf = SparseDataFrame([1, 2, 3], index=[1, 2, 3], columns=['a'])
        result = np.transpose(np.transpose(sdf))
        tm.assert_sp_frame_equal(result, sdf)

        msg = "the 'axes' parameter is not supported"
        tm.assert_raises_regex(ValueError, msg, np.transpose, sdf, axes=1)

    def test_combine_first(self):
        df = self.frame

        result = df[::2].combine_first(df)
        result2 = df[::2].combine_first(df.to_dense())

        expected = df[::2].to_dense().combine_first(df.to_dense())
        expected = expected.to_sparse(fill_value=df.default_fill_value)

        tm.assert_sp_frame_equal(result, result2)
        tm.assert_sp_frame_equal(result, expected)

    def test_combine_add(self):
        df = self.frame.to_dense()
        df2 = df.copy()
        df2['C'][:3] = np.nan
        df['A'][:3] = 5.7

        result = df.to_sparse().add(df2.to_sparse(), fill_value=0)
        expected = df.add(df2, fill_value=0).to_sparse()
        tm.assert_sp_frame_equal(result, expected)

    def test_isin(self):
        sparse_df = DataFrame({'flag': [1., 0., 1.]}).to_sparse(fill_value=0.)
        xp = sparse_df[sparse_df.flag == 1.]
        rs = sparse_df[sparse_df.flag.isin([1.])]
        tm.assert_frame_equal(xp, rs)

    def test_sparse_pow_issue(self):
        # 2220
        df = SparseDataFrame({'A': [1.1, 3.3], 'B': [2.5, -3.9]})

        # note : no error without nan
        df = SparseDataFrame({'A': [nan, 0, 1]})

        # note that 2 ** df works fine, also df ** 1
        result = 1 ** df

        r1 = result.take([0], 1)['A']
        r2 = result['A']

        assert len(r2.sp_values) == len(r1.sp_values)

    def test_as_blocks(self):
        df = SparseDataFrame({'A': [1.1, 3.3], 'B': [nan, -3.9]},
                             dtype='float64')

        df_blocks = df.blocks
        assert list(df_blocks.keys()) == ['float64']
        tm.assert_frame_equal(df_blocks['float64'], df)

    def test_nan_columnname(self):
        # GH 8822
        nan_colname = DataFrame(Series(1.0, index=[0]), columns=[nan])
        nan_colname_sparse = nan_colname.to_sparse()
        assert np.isnan(nan_colname_sparse.columns[0])

    def test_isnull(self):
        # GH 8276
        df = pd.SparseDataFrame({'A': [np.nan, np.nan, 1, 2, np.nan],
                                 'B': [0, np.nan, np.nan, 2, np.nan]})

        res = df.isnull()
        exp = pd.SparseDataFrame({'A': [True, True, False, False, True],
                                  'B': [False, True, True, False, True]},
                                 default_fill_value=True)
        exp._default_fill_value = np.nan
        tm.assert_sp_frame_equal(res, exp)

        # if fill_value is not nan, True can be included in sp_values
        df = pd.SparseDataFrame({'A': [0, 0, 1, 2, np.nan],
                                 'B': [0, np.nan, 0, 2, np.nan]},
                                default_fill_value=0.)
        res = df.isnull()
        assert isinstance(res, pd.SparseDataFrame)
        exp = pd.DataFrame({'A': [False, False, False, False, True],
                            'B': [False, True, False, False, True]})
        tm.assert_frame_equal(res.to_dense(), exp)

    def test_isnotnull(self):
        # GH 8276
        df = pd.SparseDataFrame({'A': [np.nan, np.nan, 1, 2, np.nan],
                                 'B': [0, np.nan, np.nan, 2, np.nan]})

        res = df.isnotnull()
        exp = pd.SparseDataFrame({'A': [False, False, True, True, False],
                                  'B': [True, False, False, True, False]},
                                 default_fill_value=False)
        exp._default_fill_value = np.nan
        tm.assert_sp_frame_equal(res, exp)

        # if fill_value is not nan, True can be included in sp_values
        df = pd.SparseDataFrame({'A': [0, 0, 1, 2, np.nan],
                                 'B': [0, np.nan, 0, 2, np.nan]},
                                default_fill_value=0.)
        res = df.isnotnull()
        assert isinstance(res, pd.SparseDataFrame)
        exp = pd.DataFrame({'A': [True, True, True, True, False],
                            'B': [True, False, True, True, False]})
        tm.assert_frame_equal(res.to_dense(), exp)


@pytest.mark.parametrize('index', [None, list('abc')])  # noqa: F811
@pytest.mark.parametrize('columns', [None, list('def')])
@pytest.mark.parametrize('fill_value', [None, 0, np.nan])
@pytest.mark.parametrize('dtype', [bool, int, float, np.uint16])
def test_from_to_scipy(spmatrix, index, columns, fill_value, dtype):
    # GH 4343
    tm.skip_if_no_package('scipy')

    # Make one ndarray and from it one sparse matrix, both to be used for
    # constructing frames and comparing results
    arr = np.eye(3, dtype=dtype)
    # GH 16179
    arr[0, 1] = dtype(2)
    try:
        spm = spmatrix(arr)
        assert spm.dtype == arr.dtype
    except (TypeError, AssertionError):
        # If conversion to sparse fails for this spmatrix type and arr.dtype,
        # then the combination is not currently supported in NumPy, so we
        # can just skip testing it thoroughly
        return

    sdf = pd.SparseDataFrame(spm, index=index, columns=columns,
                             default_fill_value=fill_value)

    # Expected result construction is kind of tricky for all
    # dtype-fill_value combinations; easiest to cast to something generic
    # and except later on
    rarr = arr.astype(object)
    rarr[arr == 0] = np.nan
    expected = pd.SparseDataFrame(rarr, index=index, columns=columns).fillna(
        fill_value if fill_value is not None else np.nan)

    # Assert frame is as expected
    sdf_obj = sdf.astype(object)
    tm.assert_sp_frame_equal(sdf_obj, expected)
    tm.assert_frame_equal(sdf_obj.to_dense(), expected.to_dense())

    # Assert spmatrices equal
    assert dict(sdf.to_coo().todok()) == dict(spm.todok())

    # Ensure dtype is preserved if possible
    was_upcast = ((fill_value is None or is_float(fill_value)) and
                  not is_object_dtype(dtype) and
                  not is_float_dtype(dtype))
    res_dtype = (bool if is_bool_dtype(dtype) else
                 float if was_upcast else
                 dtype)
    tm.assert_contains_all(sdf.dtypes, {np.dtype(res_dtype)})
    assert sdf.to_coo().dtype == res_dtype

    # However, adding a str column results in an upcast to object
    sdf['strings'] = np.arange(len(sdf)).astype(str)
    assert sdf.to_coo().dtype == np.object_


@pytest.mark.parametrize('fill_value', [None, 0, np.nan])  # noqa: F811
def test_from_to_scipy_object(spmatrix, fill_value):
    # GH 4343
    dtype = object
    columns = list('cd')
    index = list('ab')
    tm.skip_if_no_package('scipy', max_version='0.19.0')

    # Make one ndarray and from it one sparse matrix, both to be used for
    # constructing frames and comparing results
    arr = np.eye(2, dtype=dtype)
    try:
        spm = spmatrix(arr)
        assert spm.dtype == arr.dtype
    except (TypeError, AssertionError):
        # If conversion to sparse fails for this spmatrix type and arr.dtype,
        # then the combination is not currently supported in NumPy, so we
        # can just skip testing it thoroughly
        return

    sdf = pd.SparseDataFrame(spm, index=index, columns=columns,
                             default_fill_value=fill_value)

    # Expected result construction is kind of tricky for all
    # dtype-fill_value combinations; easiest to cast to something generic
    # and except later on
    rarr = arr.astype(object)
    rarr[arr == 0] = np.nan
    expected = pd.SparseDataFrame(rarr, index=index, columns=columns).fillna(
        fill_value if fill_value is not None else np.nan)

    # Assert frame is as expected
    sdf_obj = sdf.astype(object)
    tm.assert_sp_frame_equal(sdf_obj, expected)
    tm.assert_frame_equal(sdf_obj.to_dense(), expected.to_dense())

    # Assert spmatrices equal
    assert dict(sdf.to_coo().todok()) == dict(spm.todok())

    # Ensure dtype is preserved if possible
    res_dtype = object
    tm.assert_contains_all(sdf.dtypes, {np.dtype(res_dtype)})
    assert sdf.to_coo().dtype == res_dtype


def test_from_scipy_correct_ordering(spmatrix):
    # GH 16179
    tm.skip_if_no_package('scipy')

    arr = np.arange(1, 5).reshape(2, 2)
    try:
        spm = spmatrix(arr)
        assert spm.dtype == arr.dtype
    except (TypeError, AssertionError):
        # If conversion to sparse fails for this spmatrix type and arr.dtype,
        # then the combination is not currently supported in NumPy, so we
        # can just skip testing it thoroughly
        return

    sdf = pd.SparseDataFrame(spm)
    expected = pd.SparseDataFrame(arr)
    tm.assert_sp_frame_equal(sdf, expected)
    tm.assert_frame_equal(sdf.to_dense(), expected.to_dense())


class TestSparseDataFrameArithmetic(object):

    def test_numeric_op_scalar(self):
        df = pd.DataFrame({'A': [nan, nan, 0, 1, ],
                           'B': [0, 1, 2, nan],
                           'C': [1., 2., 3., 4.],
                           'D': [nan, nan, nan, nan]})
        sparse = df.to_sparse()

        tm.assert_sp_frame_equal(sparse + 1, (df + 1).to_sparse())

    def test_comparison_op_scalar(self):
        # GH 13001
        df = pd.DataFrame({'A': [nan, nan, 0, 1, ],
                           'B': [0, 1, 2, nan],
                           'C': [1., 2., 3., 4.],
                           'D': [nan, nan, nan, nan]})
        sparse = df.to_sparse()

        # comparison changes internal repr, compare with dense
        res = sparse > 1
        assert isinstance(res, pd.SparseDataFrame)
        tm.assert_frame_equal(res.to_dense(), df > 1)

        res = sparse != 0
        assert isinstance(res, pd.SparseDataFrame)
        tm.assert_frame_equal(res.to_dense(), df != 0)


class TestSparseDataFrameAnalytics(object):
    def setup_method(self, method):
        self.data = {'A': [nan, nan, nan, 0, 1, 2, 3, 4, 5, 6],
                     'B': [0, 1, 2, nan, nan, nan, 3, 4, 5, 6],
                     'C': np.arange(10, dtype=float),
                     'D': [0, 1, 2, 3, 4, 5, nan, nan, nan, nan]}

        self.dates = bdate_range('1/1/2011', periods=10)

        self.frame = SparseDataFrame(self.data, index=self.dates)

    def test_cumsum(self):
        expected = SparseDataFrame(self.frame.to_dense().cumsum())

        result = self.frame.cumsum()
        tm.assert_sp_frame_equal(result, expected)

        result = self.frame.cumsum(axis=None)
        tm.assert_sp_frame_equal(result, expected)

        result = self.frame.cumsum(axis=0)
        tm.assert_sp_frame_equal(result, expected)

    def test_numpy_cumsum(self):
        result = np.cumsum(self.frame)
        expected = SparseDataFrame(self.frame.to_dense().cumsum())
        tm.assert_sp_frame_equal(result, expected)

        msg = "the 'dtype' parameter is not supported"
        tm.assert_raises_regex(ValueError, msg, np.cumsum,
                               self.frame, dtype=np.int64)

        msg = "the 'out' parameter is not supported"
        tm.assert_raises_regex(ValueError, msg, np.cumsum,
                               self.frame, out=result)

    def test_numpy_func_call(self):
        # no exception should be raised even though
        # numpy passes in 'axis=None' or `axis=-1'
        funcs = ['sum', 'cumsum', 'var',
                 'mean', 'prod', 'cumprod',
                 'std', 'min', 'max']
        for func in funcs:
            getattr(np, func)(self.frame)
