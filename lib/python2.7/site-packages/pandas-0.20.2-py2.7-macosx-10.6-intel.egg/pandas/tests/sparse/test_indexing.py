# pylint: disable-msg=E1101,W0612

import pytest
import numpy as np
import pandas as pd
import pandas.util.testing as tm


class TestSparseSeriesIndexing(object):

    def setup_method(self, method):
        self.orig = pd.Series([1, np.nan, np.nan, 3, np.nan])
        self.sparse = self.orig.to_sparse()

    def test_getitem(self):
        orig = self.orig
        sparse = self.sparse

        assert sparse[0] == 1
        assert np.isnan(sparse[1])
        assert sparse[3] == 3

        result = sparse[[1, 3, 4]]
        exp = orig[[1, 3, 4]].to_sparse()
        tm.assert_sp_series_equal(result, exp)

        # dense array
        result = sparse[orig % 2 == 1]
        exp = orig[orig % 2 == 1].to_sparse()
        tm.assert_sp_series_equal(result, exp)

        # sparse array (actuary it coerces to normal Series)
        result = sparse[sparse % 2 == 1]
        exp = orig[orig % 2 == 1].to_sparse()
        tm.assert_sp_series_equal(result, exp)

        # sparse array
        result = sparse[pd.SparseArray(sparse % 2 == 1, dtype=bool)]
        tm.assert_sp_series_equal(result, exp)

    def test_getitem_slice(self):
        orig = self.orig
        sparse = self.sparse

        tm.assert_sp_series_equal(sparse[:2], orig[:2].to_sparse())
        tm.assert_sp_series_equal(sparse[4:2], orig[4:2].to_sparse())
        tm.assert_sp_series_equal(sparse[::2], orig[::2].to_sparse())
        tm.assert_sp_series_equal(sparse[-5:], orig[-5:].to_sparse())

    def test_getitem_int_dtype(self):
        # GH 8292
        s = pd.SparseSeries([0, 1, 2, 3, 4, 5, 6], name='xxx')
        res = s[::2]
        exp = pd.SparseSeries([0, 2, 4, 6], index=[0, 2, 4, 6], name='xxx')
        tm.assert_sp_series_equal(res, exp)
        assert res.dtype == np.int64

        s = pd.SparseSeries([0, 1, 2, 3, 4, 5, 6], fill_value=0, name='xxx')
        res = s[::2]
        exp = pd.SparseSeries([0, 2, 4, 6], index=[0, 2, 4, 6],
                              fill_value=0, name='xxx')
        tm.assert_sp_series_equal(res, exp)
        assert res.dtype == np.int64

    def test_getitem_fill_value(self):
        orig = pd.Series([1, np.nan, 0, 3, 0])
        sparse = orig.to_sparse(fill_value=0)

        assert sparse[0] == 1
        assert np.isnan(sparse[1])
        assert sparse[2] == 0
        assert sparse[3] == 3

        result = sparse[[1, 3, 4]]
        exp = orig[[1, 3, 4]].to_sparse(fill_value=0)
        tm.assert_sp_series_equal(result, exp)

        # dense array
        result = sparse[orig % 2 == 1]
        exp = orig[orig % 2 == 1].to_sparse(fill_value=0)
        tm.assert_sp_series_equal(result, exp)

        # sparse array (actuary it coerces to normal Series)
        result = sparse[sparse % 2 == 1]
        exp = orig[orig % 2 == 1].to_sparse(fill_value=0)
        tm.assert_sp_series_equal(result, exp)

        # sparse array
        result = sparse[pd.SparseArray(sparse % 2 == 1, dtype=bool)]
        tm.assert_sp_series_equal(result, exp)

    def test_getitem_ellipsis(self):
        # GH 9467
        s = pd.SparseSeries([1, np.nan, 2, 0, np.nan])
        tm.assert_sp_series_equal(s[...], s)

        s = pd.SparseSeries([1, np.nan, 2, 0, np.nan], fill_value=0)
        tm.assert_sp_series_equal(s[...], s)

    def test_getitem_slice_fill_value(self):
        orig = pd.Series([1, np.nan, 0, 3, 0])
        sparse = orig.to_sparse(fill_value=0)
        tm.assert_sp_series_equal(sparse[:2],
                                  orig[:2].to_sparse(fill_value=0))
        tm.assert_sp_series_equal(sparse[4:2],
                                  orig[4:2].to_sparse(fill_value=0))
        tm.assert_sp_series_equal(sparse[::2],
                                  orig[::2].to_sparse(fill_value=0))
        tm.assert_sp_series_equal(sparse[-5:],
                                  orig[-5:].to_sparse(fill_value=0))

    def test_loc(self):
        orig = self.orig
        sparse = self.sparse

        assert sparse.loc[0] == 1
        assert np.isnan(sparse.loc[1])

        result = sparse.loc[[1, 3, 4]]
        exp = orig.loc[[1, 3, 4]].to_sparse()
        tm.assert_sp_series_equal(result, exp)

        # exceeds the bounds
        result = sparse.loc[[1, 3, 4, 5]]
        exp = orig.loc[[1, 3, 4, 5]].to_sparse()
        tm.assert_sp_series_equal(result, exp)
        # padded with NaN
        assert np.isnan(result[-1])

        # dense array
        result = sparse.loc[orig % 2 == 1]
        exp = orig.loc[orig % 2 == 1].to_sparse()
        tm.assert_sp_series_equal(result, exp)

        # sparse array (actuary it coerces to normal Series)
        result = sparse.loc[sparse % 2 == 1]
        exp = orig.loc[orig % 2 == 1].to_sparse()
        tm.assert_sp_series_equal(result, exp)

        # sparse array
        result = sparse.loc[pd.SparseArray(sparse % 2 == 1, dtype=bool)]
        tm.assert_sp_series_equal(result, exp)

    def test_loc_index(self):
        orig = pd.Series([1, np.nan, np.nan, 3, np.nan], index=list('ABCDE'))
        sparse = orig.to_sparse()

        assert sparse.loc['A'] == 1
        assert np.isnan(sparse.loc['B'])

        result = sparse.loc[['A', 'C', 'D']]
        exp = orig.loc[['A', 'C', 'D']].to_sparse()
        tm.assert_sp_series_equal(result, exp)

        # dense array
        result = sparse.loc[orig % 2 == 1]
        exp = orig.loc[orig % 2 == 1].to_sparse()
        tm.assert_sp_series_equal(result, exp)

        # sparse array (actuary it coerces to normal Series)
        result = sparse.loc[sparse % 2 == 1]
        exp = orig.loc[orig % 2 == 1].to_sparse()
        tm.assert_sp_series_equal(result, exp)

        # sparse array
        result = sparse[pd.SparseArray(sparse % 2 == 1, dtype=bool)]
        tm.assert_sp_series_equal(result, exp)

    def test_loc_index_fill_value(self):
        orig = pd.Series([1, np.nan, 0, 3, 0], index=list('ABCDE'))
        sparse = orig.to_sparse(fill_value=0)

        assert sparse.loc['A'] == 1
        assert np.isnan(sparse.loc['B'])

        result = sparse.loc[['A', 'C', 'D']]
        exp = orig.loc[['A', 'C', 'D']].to_sparse(fill_value=0)
        tm.assert_sp_series_equal(result, exp)

        # dense array
        result = sparse.loc[orig % 2 == 1]
        exp = orig.loc[orig % 2 == 1].to_sparse(fill_value=0)
        tm.assert_sp_series_equal(result, exp)

        # sparse array (actuary it coerces to normal Series)
        result = sparse.loc[sparse % 2 == 1]
        exp = orig.loc[orig % 2 == 1].to_sparse(fill_value=0)
        tm.assert_sp_series_equal(result, exp)

    def test_loc_slice(self):
        orig = self.orig
        sparse = self.sparse
        tm.assert_sp_series_equal(sparse.loc[2:], orig.loc[2:].to_sparse())

    def test_loc_slice_index_fill_value(self):
        orig = pd.Series([1, np.nan, 0, 3, 0], index=list('ABCDE'))
        sparse = orig.to_sparse(fill_value=0)

        tm.assert_sp_series_equal(sparse.loc['C':],
                                  orig.loc['C':].to_sparse(fill_value=0))

    def test_loc_slice_fill_value(self):
        orig = pd.Series([1, np.nan, 0, 3, 0])
        sparse = orig.to_sparse(fill_value=0)
        tm.assert_sp_series_equal(sparse.loc[2:],
                                  orig.loc[2:].to_sparse(fill_value=0))

    def test_iloc(self):
        orig = self.orig
        sparse = self.sparse

        assert sparse.iloc[3] == 3
        assert np.isnan(sparse.iloc[2])

        result = sparse.iloc[[1, 3, 4]]
        exp = orig.iloc[[1, 3, 4]].to_sparse()
        tm.assert_sp_series_equal(result, exp)

        result = sparse.iloc[[1, -2, -4]]
        exp = orig.iloc[[1, -2, -4]].to_sparse()
        tm.assert_sp_series_equal(result, exp)

        with pytest.raises(IndexError):
            sparse.iloc[[1, 3, 5]]

    def test_iloc_fill_value(self):
        orig = pd.Series([1, np.nan, 0, 3, 0])
        sparse = orig.to_sparse(fill_value=0)

        assert sparse.iloc[3] == 3
        assert np.isnan(sparse.iloc[1])
        assert sparse.iloc[4] == 0

        result = sparse.iloc[[1, 3, 4]]
        exp = orig.iloc[[1, 3, 4]].to_sparse(fill_value=0)
        tm.assert_sp_series_equal(result, exp)

    def test_iloc_slice(self):
        orig = pd.Series([1, np.nan, np.nan, 3, np.nan])
        sparse = orig.to_sparse()
        tm.assert_sp_series_equal(sparse.iloc[2:], orig.iloc[2:].to_sparse())

    def test_iloc_slice_fill_value(self):
        orig = pd.Series([1, np.nan, 0, 3, 0])
        sparse = orig.to_sparse(fill_value=0)
        tm.assert_sp_series_equal(sparse.iloc[2:],
                                  orig.iloc[2:].to_sparse(fill_value=0))

    def test_at(self):
        orig = pd.Series([1, np.nan, np.nan, 3, np.nan])
        sparse = orig.to_sparse()
        assert sparse.at[0] == orig.at[0]
        assert np.isnan(sparse.at[1])
        assert np.isnan(sparse.at[2])
        assert sparse.at[3] == orig.at[3]
        assert np.isnan(sparse.at[4])

        orig = pd.Series([1, np.nan, np.nan, 3, np.nan],
                         index=list('abcde'))
        sparse = orig.to_sparse()
        assert sparse.at['a'] == orig.at['a']
        assert np.isnan(sparse.at['b'])
        assert np.isnan(sparse.at['c'])
        assert sparse.at['d'] == orig.at['d']
        assert np.isnan(sparse.at['e'])

    def test_at_fill_value(self):
        orig = pd.Series([1, np.nan, 0, 3, 0],
                         index=list('abcde'))
        sparse = orig.to_sparse(fill_value=0)
        assert sparse.at['a'] == orig.at['a']
        assert np.isnan(sparse.at['b'])
        assert sparse.at['c'] == orig.at['c']
        assert sparse.at['d'] == orig.at['d']
        assert sparse.at['e'] == orig.at['e']

    def test_iat(self):
        orig = self.orig
        sparse = self.sparse

        assert sparse.iat[0] == orig.iat[0]
        assert np.isnan(sparse.iat[1])
        assert np.isnan(sparse.iat[2])
        assert sparse.iat[3] == orig.iat[3]
        assert np.isnan(sparse.iat[4])

        assert np.isnan(sparse.iat[-1])
        assert sparse.iat[-5] == orig.iat[-5]

    def test_iat_fill_value(self):
        orig = pd.Series([1, np.nan, 0, 3, 0])
        sparse = orig.to_sparse()
        assert sparse.iat[0] == orig.iat[0]
        assert np.isnan(sparse.iat[1])
        assert sparse.iat[2] == orig.iat[2]
        assert sparse.iat[3] == orig.iat[3]
        assert sparse.iat[4] == orig.iat[4]

        assert sparse.iat[-1] == orig.iat[-1]
        assert sparse.iat[-5] == orig.iat[-5]

    def test_get(self):
        s = pd.SparseSeries([1, np.nan, np.nan, 3, np.nan])
        assert s.get(0) == 1
        assert np.isnan(s.get(1))
        assert s.get(5) is None

        s = pd.SparseSeries([1, np.nan, 0, 3, 0], index=list('ABCDE'))
        assert s.get('A') == 1
        assert np.isnan(s.get('B'))
        assert s.get('C') == 0
        assert s.get('XX') is None

        s = pd.SparseSeries([1, np.nan, 0, 3, 0], index=list('ABCDE'),
                            fill_value=0)
        assert s.get('A') == 1
        assert np.isnan(s.get('B'))
        assert s.get('C') == 0
        assert s.get('XX') is None

    def test_take(self):
        orig = pd.Series([1, np.nan, np.nan, 3, np.nan],
                         index=list('ABCDE'))
        sparse = orig.to_sparse()

        tm.assert_sp_series_equal(sparse.take([0]),
                                  orig.take([0]).to_sparse())
        tm.assert_sp_series_equal(sparse.take([0, 1, 3]),
                                  orig.take([0, 1, 3]).to_sparse())
        tm.assert_sp_series_equal(sparse.take([-1, -2]),
                                  orig.take([-1, -2]).to_sparse())

    def test_take_fill_value(self):
        orig = pd.Series([1, np.nan, 0, 3, 0],
                         index=list('ABCDE'))
        sparse = orig.to_sparse(fill_value=0)

        tm.assert_sp_series_equal(sparse.take([0]),
                                  orig.take([0]).to_sparse(fill_value=0))

        exp = orig.take([0, 1, 3]).to_sparse(fill_value=0)
        tm.assert_sp_series_equal(sparse.take([0, 1, 3]), exp)

        exp = orig.take([-1, -2]).to_sparse(fill_value=0)
        tm.assert_sp_series_equal(sparse.take([-1, -2]), exp)

    def test_reindex(self):
        orig = pd.Series([1, np.nan, np.nan, 3, np.nan],
                         index=list('ABCDE'))
        sparse = orig.to_sparse()

        res = sparse.reindex(['A', 'E', 'C', 'D'])
        exp = orig.reindex(['A', 'E', 'C', 'D']).to_sparse()
        tm.assert_sp_series_equal(res, exp)

        # all missing & fill_value
        res = sparse.reindex(['B', 'E', 'C'])
        exp = orig.reindex(['B', 'E', 'C']).to_sparse()
        tm.assert_sp_series_equal(res, exp)

        orig = pd.Series([np.nan, np.nan, np.nan, np.nan, np.nan],
                         index=list('ABCDE'))
        sparse = orig.to_sparse()

        res = sparse.reindex(['A', 'E', 'C', 'D'])
        exp = orig.reindex(['A', 'E', 'C', 'D']).to_sparse()
        tm.assert_sp_series_equal(res, exp)

    def test_fill_value_reindex(self):
        orig = pd.Series([1, np.nan, 0, 3, 0], index=list('ABCDE'))
        sparse = orig.to_sparse(fill_value=0)

        res = sparse.reindex(['A', 'E', 'C', 'D'])
        exp = orig.reindex(['A', 'E', 'C', 'D']).to_sparse(fill_value=0)
        tm.assert_sp_series_equal(res, exp)

        # includes missing and fill_value
        res = sparse.reindex(['A', 'B', 'C'])
        exp = orig.reindex(['A', 'B', 'C']).to_sparse(fill_value=0)
        tm.assert_sp_series_equal(res, exp)

        # all missing
        orig = pd.Series([np.nan, np.nan, np.nan, np.nan, np.nan],
                         index=list('ABCDE'))
        sparse = orig.to_sparse(fill_value=0)

        res = sparse.reindex(['A', 'E', 'C', 'D'])
        exp = orig.reindex(['A', 'E', 'C', 'D']).to_sparse(fill_value=0)
        tm.assert_sp_series_equal(res, exp)

        # all fill_value
        orig = pd.Series([0., 0., 0., 0., 0.],
                         index=list('ABCDE'))
        sparse = orig.to_sparse(fill_value=0)

        res = sparse.reindex(['A', 'E', 'C', 'D'])
        exp = orig.reindex(['A', 'E', 'C', 'D']).to_sparse(fill_value=0)
        tm.assert_sp_series_equal(res, exp)

    def test_reindex_fill_value(self):
        floats = pd.Series([1., 2., 3.]).to_sparse()
        result = floats.reindex([1, 2, 3], fill_value=0)
        expected = pd.Series([2., 3., 0], index=[1, 2, 3]).to_sparse()
        tm.assert_sp_series_equal(result, expected)

    def test_reindex_nearest(self):
        s = pd.Series(np.arange(10, dtype='float64')).to_sparse()
        target = [0.1, 0.9, 1.5, 2.0]
        actual = s.reindex(target, method='nearest')
        expected = pd.Series(np.around(target), target).to_sparse()
        tm.assert_sp_series_equal(expected, actual)

        actual = s.reindex(target, method='nearest', tolerance=0.2)
        expected = pd.Series([0, 1, np.nan, 2], target).to_sparse()
        tm.assert_sp_series_equal(expected, actual)

    def tests_indexing_with_sparse(self):
        # GH 13985

        for kind in ['integer', 'block']:
            for fill in [True, False, np.nan]:
                arr = pd.SparseArray([1, 2, 3], kind=kind)
                indexer = pd.SparseArray([True, False, True], fill_value=fill,
                                         dtype=bool)

                tm.assert_sp_array_equal(pd.SparseArray([1, 3], kind=kind),
                                         arr[indexer])

                s = pd.SparseSeries(arr, index=['a', 'b', 'c'],
                                    dtype=np.float64)
                exp = pd.SparseSeries([1, 3], index=['a', 'c'],
                                      dtype=np.float64, kind=kind)
                tm.assert_sp_series_equal(s[indexer], exp)
                tm.assert_sp_series_equal(s.loc[indexer], exp)
                tm.assert_sp_series_equal(s.iloc[indexer], exp)

                indexer = pd.SparseSeries(indexer, index=['a', 'b', 'c'])
                tm.assert_sp_series_equal(s[indexer], exp)
                tm.assert_sp_series_equal(s.loc[indexer], exp)

                msg = ("iLocation based boolean indexing cannot use an "
                       "indexable as a mask")
                with tm.assert_raises_regex(ValueError, msg):
                    s.iloc[indexer]


class TestSparseSeriesMultiIndexing(TestSparseSeriesIndexing):

    def setup_method(self, method):
        # Mi with duplicated values
        idx = pd.MultiIndex.from_tuples([('A', 0), ('A', 1), ('B', 0),
                                         ('C', 0), ('C', 1)])
        self.orig = pd.Series([1, np.nan, np.nan, 3, np.nan], index=idx)
        self.sparse = self.orig.to_sparse()

    def test_getitem_multi(self):
        orig = self.orig
        sparse = self.sparse

        assert sparse[0] == orig[0]
        assert np.isnan(sparse[1])
        assert sparse[3] == orig[3]

        tm.assert_sp_series_equal(sparse['A'], orig['A'].to_sparse())
        tm.assert_sp_series_equal(sparse['B'], orig['B'].to_sparse())

        result = sparse[[1, 3, 4]]
        exp = orig[[1, 3, 4]].to_sparse()
        tm.assert_sp_series_equal(result, exp)

        # dense array
        result = sparse[orig % 2 == 1]
        exp = orig[orig % 2 == 1].to_sparse()
        tm.assert_sp_series_equal(result, exp)

        # sparse array (actuary it coerces to normal Series)
        result = sparse[sparse % 2 == 1]
        exp = orig[orig % 2 == 1].to_sparse()
        tm.assert_sp_series_equal(result, exp)

        # sparse array
        result = sparse[pd.SparseArray(sparse % 2 == 1, dtype=bool)]
        tm.assert_sp_series_equal(result, exp)

    def test_getitem_multi_tuple(self):
        orig = self.orig
        sparse = self.sparse

        assert sparse['C', 0] == orig['C', 0]
        assert np.isnan(sparse['A', 1])
        assert np.isnan(sparse['B', 0])

    def test_getitems_slice_multi(self):
        orig = self.orig
        sparse = self.sparse

        tm.assert_sp_series_equal(sparse[2:], orig[2:].to_sparse())
        tm.assert_sp_series_equal(sparse.loc['B':], orig.loc['B':].to_sparse())
        tm.assert_sp_series_equal(sparse.loc['C':], orig.loc['C':].to_sparse())

        tm.assert_sp_series_equal(sparse.loc['A':'B'],
                                  orig.loc['A':'B'].to_sparse())
        tm.assert_sp_series_equal(sparse.loc[:'B'], orig.loc[:'B'].to_sparse())

    def test_loc(self):
        # need to be override to use different label
        orig = self.orig
        sparse = self.sparse

        tm.assert_sp_series_equal(sparse.loc['A'],
                                  orig.loc['A'].to_sparse())
        tm.assert_sp_series_equal(sparse.loc['B'],
                                  orig.loc['B'].to_sparse())

        result = sparse.loc[[1, 3, 4]]
        exp = orig.loc[[1, 3, 4]].to_sparse()
        tm.assert_sp_series_equal(result, exp)

        # exceeds the bounds
        result = sparse.loc[[1, 3, 4, 5]]
        exp = orig.loc[[1, 3, 4, 5]].to_sparse()
        tm.assert_sp_series_equal(result, exp)

        # single element list (GH 15447)
        result = sparse.loc[['A']]
        exp = orig.loc[['A']].to_sparse()
        tm.assert_sp_series_equal(result, exp)

        # dense array
        result = sparse.loc[orig % 2 == 1]
        exp = orig.loc[orig % 2 == 1].to_sparse()
        tm.assert_sp_series_equal(result, exp)

        # sparse array (actuary it coerces to normal Series)
        result = sparse.loc[sparse % 2 == 1]
        exp = orig.loc[orig % 2 == 1].to_sparse()
        tm.assert_sp_series_equal(result, exp)

        # sparse array
        result = sparse.loc[pd.SparseArray(sparse % 2 == 1, dtype=bool)]
        tm.assert_sp_series_equal(result, exp)

    def test_loc_multi_tuple(self):
        orig = self.orig
        sparse = self.sparse

        assert sparse.loc['C', 0] == orig.loc['C', 0]
        assert np.isnan(sparse.loc['A', 1])
        assert np.isnan(sparse.loc['B', 0])

    def test_loc_slice(self):
        orig = self.orig
        sparse = self.sparse
        tm.assert_sp_series_equal(sparse.loc['A':], orig.loc['A':].to_sparse())
        tm.assert_sp_series_equal(sparse.loc['B':], orig.loc['B':].to_sparse())
        tm.assert_sp_series_equal(sparse.loc['C':], orig.loc['C':].to_sparse())

        tm.assert_sp_series_equal(sparse.loc['A':'B'],
                                  orig.loc['A':'B'].to_sparse())
        tm.assert_sp_series_equal(sparse.loc[:'B'], orig.loc[:'B'].to_sparse())

    def test_reindex(self):
        # GH 15447
        orig = self.orig
        sparse = self.sparse

        res = sparse.reindex([('A', 0), ('C', 1)])
        exp = orig.reindex([('A', 0), ('C', 1)]).to_sparse()
        tm.assert_sp_series_equal(res, exp)

        # On specific level:
        res = sparse.reindex(['A', 'C', 'B'], level=0)
        exp = orig.reindex(['A', 'C', 'B'], level=0).to_sparse()
        tm.assert_sp_series_equal(res, exp)

        # single element list (GH 15447)
        res = sparse.reindex(['A'], level=0)
        exp = orig.reindex(['A'], level=0).to_sparse()
        tm.assert_sp_series_equal(res, exp)

        with pytest.raises(TypeError):
            # Incomplete keys are not accepted for reindexing:
            sparse.reindex(['A', 'C'])

        # "copy" argument:
        res = sparse.reindex(sparse.index, copy=True)
        exp = orig.reindex(orig.index, copy=True).to_sparse()
        tm.assert_sp_series_equal(res, exp)
        assert sparse is not res


class TestSparseDataFrameIndexing(object):

    def test_getitem(self):
        orig = pd.DataFrame([[1, np.nan, np.nan],
                             [2, 3, np.nan],
                             [np.nan, np.nan, 4],
                             [0, np.nan, 5]],
                            columns=list('xyz'))
        sparse = orig.to_sparse()

        tm.assert_sp_series_equal(sparse['x'], orig['x'].to_sparse())
        tm.assert_sp_frame_equal(sparse[['x']], orig[['x']].to_sparse())
        tm.assert_sp_frame_equal(sparse[['z', 'x']],
                                 orig[['z', 'x']].to_sparse())

        tm.assert_sp_frame_equal(sparse[[True, False, True, True]],
                                 orig[[True, False, True, True]].to_sparse())

        tm.assert_sp_frame_equal(sparse.iloc[[1, 2]],
                                 orig.iloc[[1, 2]].to_sparse())

    def test_getitem_fill_value(self):
        orig = pd.DataFrame([[1, np.nan, 0],
                             [2, 3, np.nan],
                             [0, np.nan, 4],
                             [0, np.nan, 5]],
                            columns=list('xyz'))
        sparse = orig.to_sparse(fill_value=0)

        tm.assert_sp_series_equal(sparse['y'],
                                  orig['y'].to_sparse(fill_value=0))

        exp = orig[['x']].to_sparse(fill_value=0)
        exp._default_fill_value = np.nan
        tm.assert_sp_frame_equal(sparse[['x']], exp)

        exp = orig[['z', 'x']].to_sparse(fill_value=0)
        exp._default_fill_value = np.nan
        tm.assert_sp_frame_equal(sparse[['z', 'x']], exp)

        indexer = [True, False, True, True]
        exp = orig[indexer].to_sparse(fill_value=0)
        exp._default_fill_value = np.nan
        tm.assert_sp_frame_equal(sparse[indexer], exp)

        exp = orig.iloc[[1, 2]].to_sparse(fill_value=0)
        exp._default_fill_value = np.nan
        tm.assert_sp_frame_equal(sparse.iloc[[1, 2]], exp)

    def test_loc(self):
        orig = pd.DataFrame([[1, np.nan, np.nan],
                             [2, 3, np.nan],
                             [np.nan, np.nan, 4]],
                            columns=list('xyz'))
        sparse = orig.to_sparse()

        assert sparse.loc[0, 'x'] == 1
        assert np.isnan(sparse.loc[1, 'z'])
        assert sparse.loc[2, 'z'] == 4

        tm.assert_sp_series_equal(sparse.loc[0], orig.loc[0].to_sparse())
        tm.assert_sp_series_equal(sparse.loc[1], orig.loc[1].to_sparse())
        tm.assert_sp_series_equal(sparse.loc[2, :],
                                  orig.loc[2, :].to_sparse())
        tm.assert_sp_series_equal(sparse.loc[2, :],
                                  orig.loc[2, :].to_sparse())
        tm.assert_sp_series_equal(sparse.loc[:, 'y'],
                                  orig.loc[:, 'y'].to_sparse())
        tm.assert_sp_series_equal(sparse.loc[:, 'y'],
                                  orig.loc[:, 'y'].to_sparse())

        result = sparse.loc[[1, 2]]
        exp = orig.loc[[1, 2]].to_sparse()
        tm.assert_sp_frame_equal(result, exp)

        result = sparse.loc[[1, 2], :]
        exp = orig.loc[[1, 2], :].to_sparse()
        tm.assert_sp_frame_equal(result, exp)

        result = sparse.loc[:, ['x', 'z']]
        exp = orig.loc[:, ['x', 'z']].to_sparse()
        tm.assert_sp_frame_equal(result, exp)

        result = sparse.loc[[0, 2], ['x', 'z']]
        exp = orig.loc[[0, 2], ['x', 'z']].to_sparse()
        tm.assert_sp_frame_equal(result, exp)

        # exceeds the bounds
        result = sparse.loc[[1, 3, 4, 5]]
        exp = orig.loc[[1, 3, 4, 5]].to_sparse()
        tm.assert_sp_frame_equal(result, exp)

        # dense array
        result = sparse.loc[orig.x % 2 == 1]
        exp = orig.loc[orig.x % 2 == 1].to_sparse()
        tm.assert_sp_frame_equal(result, exp)

        # sparse array (actuary it coerces to normal Series)
        result = sparse.loc[sparse.x % 2 == 1]
        exp = orig.loc[orig.x % 2 == 1].to_sparse()
        tm.assert_sp_frame_equal(result, exp)

        # sparse array
        result = sparse.loc[pd.SparseArray(sparse.x % 2 == 1, dtype=bool)]
        tm.assert_sp_frame_equal(result, exp)

    def test_loc_index(self):
        orig = pd.DataFrame([[1, np.nan, np.nan],
                             [2, 3, np.nan],
                             [np.nan, np.nan, 4]],
                            index=list('abc'), columns=list('xyz'))
        sparse = orig.to_sparse()

        assert sparse.loc['a', 'x'] == 1
        assert np.isnan(sparse.loc['b', 'z'])
        assert sparse.loc['c', 'z'] == 4

        tm.assert_sp_series_equal(sparse.loc['a'], orig.loc['a'].to_sparse())
        tm.assert_sp_series_equal(sparse.loc['b'], orig.loc['b'].to_sparse())
        tm.assert_sp_series_equal(sparse.loc['b', :],
                                  orig.loc['b', :].to_sparse())
        tm.assert_sp_series_equal(sparse.loc['b', :],
                                  orig.loc['b', :].to_sparse())

        tm.assert_sp_series_equal(sparse.loc[:, 'z'],
                                  orig.loc[:, 'z'].to_sparse())
        tm.assert_sp_series_equal(sparse.loc[:, 'z'],
                                  orig.loc[:, 'z'].to_sparse())

        result = sparse.loc[['a', 'b']]
        exp = orig.loc[['a', 'b']].to_sparse()
        tm.assert_sp_frame_equal(result, exp)

        result = sparse.loc[['a', 'b'], :]
        exp = orig.loc[['a', 'b'], :].to_sparse()
        tm.assert_sp_frame_equal(result, exp)

        result = sparse.loc[:, ['x', 'z']]
        exp = orig.loc[:, ['x', 'z']].to_sparse()
        tm.assert_sp_frame_equal(result, exp)

        result = sparse.loc[['c', 'a'], ['x', 'z']]
        exp = orig.loc[['c', 'a'], ['x', 'z']].to_sparse()
        tm.assert_sp_frame_equal(result, exp)

        # dense array
        result = sparse.loc[orig.x % 2 == 1]
        exp = orig.loc[orig.x % 2 == 1].to_sparse()
        tm.assert_sp_frame_equal(result, exp)

        # sparse array (actuary it coerces to normal Series)
        result = sparse.loc[sparse.x % 2 == 1]
        exp = orig.loc[orig.x % 2 == 1].to_sparse()
        tm.assert_sp_frame_equal(result, exp)

        # sparse array
        result = sparse.loc[pd.SparseArray(sparse.x % 2 == 1, dtype=bool)]
        tm.assert_sp_frame_equal(result, exp)

    def test_loc_slice(self):
        orig = pd.DataFrame([[1, np.nan, np.nan],
                             [2, 3, np.nan],
                             [np.nan, np.nan, 4]],
                            columns=list('xyz'))
        sparse = orig.to_sparse()
        tm.assert_sp_frame_equal(sparse.loc[2:], orig.loc[2:].to_sparse())

    def test_iloc(self):
        orig = pd.DataFrame([[1, np.nan, np.nan],
                             [2, 3, np.nan],
                             [np.nan, np.nan, 4]])
        sparse = orig.to_sparse()

        assert sparse.iloc[1, 1] == 3
        assert np.isnan(sparse.iloc[2, 0])

        tm.assert_sp_series_equal(sparse.iloc[0], orig.loc[0].to_sparse())
        tm.assert_sp_series_equal(sparse.iloc[1], orig.loc[1].to_sparse())
        tm.assert_sp_series_equal(sparse.iloc[2, :],
                                  orig.iloc[2, :].to_sparse())
        tm.assert_sp_series_equal(sparse.iloc[2, :],
                                  orig.iloc[2, :].to_sparse())
        tm.assert_sp_series_equal(sparse.iloc[:, 1],
                                  orig.iloc[:, 1].to_sparse())
        tm.assert_sp_series_equal(sparse.iloc[:, 1],
                                  orig.iloc[:, 1].to_sparse())

        result = sparse.iloc[[1, 2]]
        exp = orig.iloc[[1, 2]].to_sparse()
        tm.assert_sp_frame_equal(result, exp)

        result = sparse.iloc[[1, 2], :]
        exp = orig.iloc[[1, 2], :].to_sparse()
        tm.assert_sp_frame_equal(result, exp)

        result = sparse.iloc[:, [1, 0]]
        exp = orig.iloc[:, [1, 0]].to_sparse()
        tm.assert_sp_frame_equal(result, exp)

        result = sparse.iloc[[2], [1, 0]]
        exp = orig.iloc[[2], [1, 0]].to_sparse()
        tm.assert_sp_frame_equal(result, exp)

        with pytest.raises(IndexError):
            sparse.iloc[[1, 3, 5]]

    def test_iloc_slice(self):
        orig = pd.DataFrame([[1, np.nan, np.nan],
                             [2, 3, np.nan],
                             [np.nan, np.nan, 4]],
                            columns=list('xyz'))
        sparse = orig.to_sparse()
        tm.assert_sp_frame_equal(sparse.iloc[2:], orig.iloc[2:].to_sparse())

    def test_at(self):
        orig = pd.DataFrame([[1, np.nan, 0],
                             [2, 3, np.nan],
                             [0, np.nan, 4],
                             [0, np.nan, 5]],
                            index=list('ABCD'), columns=list('xyz'))
        sparse = orig.to_sparse()
        assert sparse.at['A', 'x'] == orig.at['A', 'x']
        assert np.isnan(sparse.at['B', 'z'])
        assert np.isnan(sparse.at['C', 'y'])
        assert sparse.at['D', 'x'] == orig.at['D', 'x']

    def test_at_fill_value(self):
        orig = pd.DataFrame([[1, np.nan, 0],
                             [2, 3, np.nan],
                             [0, np.nan, 4],
                             [0, np.nan, 5]],
                            index=list('ABCD'), columns=list('xyz'))
        sparse = orig.to_sparse(fill_value=0)
        assert sparse.at['A', 'x'] == orig.at['A', 'x']
        assert np.isnan(sparse.at['B', 'z'])
        assert np.isnan(sparse.at['C', 'y'])
        assert sparse.at['D', 'x'] == orig.at['D', 'x']

    def test_iat(self):
        orig = pd.DataFrame([[1, np.nan, 0],
                             [2, 3, np.nan],
                             [0, np.nan, 4],
                             [0, np.nan, 5]],
                            index=list('ABCD'), columns=list('xyz'))
        sparse = orig.to_sparse()
        assert sparse.iat[0, 0] == orig.iat[0, 0]
        assert np.isnan(sparse.iat[1, 2])
        assert np.isnan(sparse.iat[2, 1])
        assert sparse.iat[2, 0] == orig.iat[2, 0]

        assert np.isnan(sparse.iat[-1, -2])
        assert sparse.iat[-1, -1] == orig.iat[-1, -1]

    def test_iat_fill_value(self):
        orig = pd.DataFrame([[1, np.nan, 0],
                             [2, 3, np.nan],
                             [0, np.nan, 4],
                             [0, np.nan, 5]],
                            index=list('ABCD'), columns=list('xyz'))
        sparse = orig.to_sparse(fill_value=0)
        assert sparse.iat[0, 0] == orig.iat[0, 0]
        assert np.isnan(sparse.iat[1, 2])
        assert np.isnan(sparse.iat[2, 1])
        assert sparse.iat[2, 0] == orig.iat[2, 0]

        assert np.isnan(sparse.iat[-1, -2])
        assert sparse.iat[-1, -1] == orig.iat[-1, -1]

    def test_take(self):
        orig = pd.DataFrame([[1, np.nan, 0],
                             [2, 3, np.nan],
                             [0, np.nan, 4],
                             [0, np.nan, 5]],
                            columns=list('xyz'))
        sparse = orig.to_sparse()

        tm.assert_sp_frame_equal(sparse.take([0]),
                                 orig.take([0]).to_sparse())
        tm.assert_sp_frame_equal(sparse.take([0, 1]),
                                 orig.take([0, 1]).to_sparse())
        tm.assert_sp_frame_equal(sparse.take([-1, -2]),
                                 orig.take([-1, -2]).to_sparse())

    def test_take_fill_value(self):
        orig = pd.DataFrame([[1, np.nan, 0],
                             [2, 3, np.nan],
                             [0, np.nan, 4],
                             [0, np.nan, 5]],
                            columns=list('xyz'))
        sparse = orig.to_sparse(fill_value=0)

        exp = orig.take([0]).to_sparse(fill_value=0)
        exp._default_fill_value = np.nan
        tm.assert_sp_frame_equal(sparse.take([0]), exp)

        exp = orig.take([0, 1]).to_sparse(fill_value=0)
        exp._default_fill_value = np.nan
        tm.assert_sp_frame_equal(sparse.take([0, 1]), exp)

        exp = orig.take([-1, -2]).to_sparse(fill_value=0)
        exp._default_fill_value = np.nan
        tm.assert_sp_frame_equal(sparse.take([-1, -2]), exp)

    def test_reindex(self):
        orig = pd.DataFrame([[1, np.nan, 0],
                             [2, 3, np.nan],
                             [0, np.nan, 4],
                             [0, np.nan, 5]],
                            index=list('ABCD'), columns=list('xyz'))
        sparse = orig.to_sparse()

        res = sparse.reindex(['A', 'C', 'B'])
        exp = orig.reindex(['A', 'C', 'B']).to_sparse()
        tm.assert_sp_frame_equal(res, exp)

        orig = pd.DataFrame([[np.nan, np.nan, np.nan],
                             [np.nan, np.nan, np.nan],
                             [np.nan, np.nan, np.nan],
                             [np.nan, np.nan, np.nan]],
                            index=list('ABCD'), columns=list('xyz'))
        sparse = orig.to_sparse()

        res = sparse.reindex(['A', 'C', 'B'])
        exp = orig.reindex(['A', 'C', 'B']).to_sparse()
        tm.assert_sp_frame_equal(res, exp)

    def test_reindex_fill_value(self):
        orig = pd.DataFrame([[1, np.nan, 0],
                             [2, 3, np.nan],
                             [0, np.nan, 4],
                             [0, np.nan, 5]],
                            index=list('ABCD'), columns=list('xyz'))
        sparse = orig.to_sparse(fill_value=0)

        res = sparse.reindex(['A', 'C', 'B'])
        exp = orig.reindex(['A', 'C', 'B']).to_sparse(fill_value=0)
        tm.assert_sp_frame_equal(res, exp)

        # all missing
        orig = pd.DataFrame([[np.nan, np.nan, np.nan],
                             [np.nan, np.nan, np.nan],
                             [np.nan, np.nan, np.nan],
                             [np.nan, np.nan, np.nan]],
                            index=list('ABCD'), columns=list('xyz'))
        sparse = orig.to_sparse(fill_value=0)

        res = sparse.reindex(['A', 'C', 'B'])
        exp = orig.reindex(['A', 'C', 'B']).to_sparse(fill_value=0)
        tm.assert_sp_frame_equal(res, exp)

        # all fill_value
        orig = pd.DataFrame([[0, 0, 0],
                             [0, 0, 0],
                             [0, 0, 0],
                             [0, 0, 0]],
                            index=list('ABCD'), columns=list('xyz'))
        sparse = orig.to_sparse(fill_value=0)

        res = sparse.reindex(['A', 'C', 'B'])
        exp = orig.reindex(['A', 'C', 'B']).to_sparse(fill_value=0)
        tm.assert_sp_frame_equal(res, exp)


class TestMultitype(object):

    def setup_method(self, method):
        self.cols = ['string', 'int', 'float', 'object']

        self.string_series = pd.SparseSeries(['a', 'b', 'c'])
        self.int_series = pd.SparseSeries([1, 2, 3])
        self.float_series = pd.SparseSeries([1.1, 1.2, 1.3])
        self.object_series = pd.SparseSeries([[], {}, set()])
        self.sdf = pd.SparseDataFrame({
            'string': self.string_series,
            'int': self.int_series,
            'float': self.float_series,
            'object': self.object_series,
        })
        self.sdf = self.sdf[self.cols]
        self.ss = pd.SparseSeries(['a', 1, 1.1, []], index=self.cols)

    def test_frame_basic_dtypes(self):
        for _, row in self.sdf.iterrows():
            assert row.dtype == object
        tm.assert_sp_series_equal(self.sdf['string'], self.string_series,
                                  check_names=False)
        tm.assert_sp_series_equal(self.sdf['int'], self.int_series,
                                  check_names=False)
        tm.assert_sp_series_equal(self.sdf['float'], self.float_series,
                                  check_names=False)
        tm.assert_sp_series_equal(self.sdf['object'], self.object_series,
                                  check_names=False)

    def test_frame_indexing_single(self):
        tm.assert_sp_series_equal(self.sdf.iloc[0],
                                  pd.SparseSeries(['a', 1, 1.1, []],
                                                  index=self.cols),
                                  check_names=False)
        tm.assert_sp_series_equal(self.sdf.iloc[1],
                                  pd.SparseSeries(['b', 2, 1.2, {}],
                                                  index=self.cols),
                                  check_names=False)
        tm.assert_sp_series_equal(self.sdf.iloc[2],
                                  pd.SparseSeries(['c', 3, 1.3, set()],
                                                  index=self.cols),
                                  check_names=False)

    def test_frame_indexing_multiple(self):
        tm.assert_sp_frame_equal(self.sdf, self.sdf[:])
        tm.assert_sp_frame_equal(self.sdf, self.sdf.loc[:])
        tm.assert_sp_frame_equal(self.sdf.iloc[[1, 2]],
                                 pd.SparseDataFrame({
                                     'string': self.string_series.iloc[[1, 2]],
                                     'int': self.int_series.iloc[[1, 2]],
                                     'float': self.float_series.iloc[[1, 2]],
                                     'object': self.object_series.iloc[[1, 2]]
                                 }, index=[1, 2])[self.cols])
        tm.assert_sp_frame_equal(self.sdf[['int', 'string']],
                                 pd.SparseDataFrame({
                                     'int': self.int_series,
                                     'string': self.string_series,
                                 }))

    def test_series_indexing_single(self):
        for i, idx in enumerate(self.cols):
            assert self.ss.iloc[i] == self.ss[idx]
            tm.assert_class_equal(self.ss.iloc[i], self.ss[idx],
                                  obj="series index")

        assert self.ss['string'] == 'a'
        assert self.ss['int'] == 1
        assert self.ss['float'] == 1.1
        assert self.ss['object'] == []

    def test_series_indexing_multiple(self):
        tm.assert_sp_series_equal(self.ss.loc[['string', 'int']],
                                  pd.SparseSeries(['a', 1],
                                                  index=['string', 'int']))
        tm.assert_sp_series_equal(self.ss.loc[['string', 'object']],
                                  pd.SparseSeries(['a', []],
                                                  index=['string', 'object']))
