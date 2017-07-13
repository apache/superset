# pylint: disable-msg=E1101,W0612

import numpy as np
import pandas as pd
import pandas.util.testing as tm


class TestSparseSeriesConcat(object):

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


class TestSparseDataFrameConcat(object):

    def setup_method(self, method):

        self.dense1 = pd.DataFrame({'A': [0., 1., 2., np.nan],
                                    'B': [0., 0., 0., 0.],
                                    'C': [np.nan, np.nan, np.nan, np.nan],
                                    'D': [1., 2., 3., 4.]})

        self.dense2 = pd.DataFrame({'A': [5., 6., 7., 8.],
                                    'B': [np.nan, 0., 7., 8.],
                                    'C': [5., 6., np.nan, np.nan],
                                    'D': [np.nan, np.nan, np.nan, np.nan]})

        self.dense3 = pd.DataFrame({'E': [5., 6., 7., 8.],
                                    'F': [np.nan, 0., 7., 8.],
                                    'G': [5., 6., np.nan, np.nan],
                                    'H': [np.nan, np.nan, np.nan, np.nan]})

    def test_concat(self):
        # fill_value = np.nan
        sparse = self.dense1.to_sparse()
        sparse2 = self.dense2.to_sparse()

        res = pd.concat([sparse, sparse])
        exp = pd.concat([self.dense1, self.dense1]).to_sparse()
        tm.assert_sp_frame_equal(res, exp)

        res = pd.concat([sparse2, sparse2])
        exp = pd.concat([self.dense2, self.dense2]).to_sparse()
        tm.assert_sp_frame_equal(res, exp)

        res = pd.concat([sparse, sparse2])
        exp = pd.concat([self.dense1, self.dense2]).to_sparse()
        tm.assert_sp_frame_equal(res, exp)

        res = pd.concat([sparse2, sparse])
        exp = pd.concat([self.dense2, self.dense1]).to_sparse()
        tm.assert_sp_frame_equal(res, exp)

        # fill_value = 0
        sparse = self.dense1.to_sparse(fill_value=0)
        sparse2 = self.dense2.to_sparse(fill_value=0)

        res = pd.concat([sparse, sparse])
        exp = pd.concat([self.dense1, self.dense1]).to_sparse(fill_value=0)
        exp._default_fill_value = np.nan
        tm.assert_sp_frame_equal(res, exp)

        res = pd.concat([sparse2, sparse2])
        exp = pd.concat([self.dense2, self.dense2]).to_sparse(fill_value=0)
        exp._default_fill_value = np.nan
        tm.assert_sp_frame_equal(res, exp)

        res = pd.concat([sparse, sparse2])
        exp = pd.concat([self.dense1, self.dense2]).to_sparse(fill_value=0)
        exp._default_fill_value = np.nan
        tm.assert_sp_frame_equal(res, exp)

        res = pd.concat([sparse2, sparse])
        exp = pd.concat([self.dense2, self.dense1]).to_sparse(fill_value=0)
        exp._default_fill_value = np.nan
        tm.assert_sp_frame_equal(res, exp)

    def test_concat_different_fill_value(self):
        # 1st fill_value will be used
        sparse = self.dense1.to_sparse()
        sparse2 = self.dense2.to_sparse(fill_value=0)

        res = pd.concat([sparse, sparse2])
        exp = pd.concat([self.dense1, self.dense2]).to_sparse()
        tm.assert_sp_frame_equal(res, exp)

        res = pd.concat([sparse2, sparse])
        exp = pd.concat([self.dense2, self.dense1]).to_sparse(fill_value=0)
        exp._default_fill_value = np.nan
        tm.assert_sp_frame_equal(res, exp)

    def test_concat_different_columns(self):
        # fill_value = np.nan
        sparse = self.dense1.to_sparse()
        sparse3 = self.dense3.to_sparse()

        res = pd.concat([sparse, sparse3])
        exp = pd.concat([self.dense1, self.dense3]).to_sparse()
        tm.assert_sp_frame_equal(res, exp)

        res = pd.concat([sparse3, sparse])
        exp = pd.concat([self.dense3, self.dense1]).to_sparse()
        exp._default_fill_value = np.nan
        tm.assert_sp_frame_equal(res, exp)

        # fill_value = 0
        sparse = self.dense1.to_sparse(fill_value=0)
        sparse3 = self.dense3.to_sparse(fill_value=0)

        res = pd.concat([sparse, sparse3])
        exp = pd.concat([self.dense1, self.dense3]).to_sparse(fill_value=0)
        exp._default_fill_value = np.nan
        tm.assert_sp_frame_equal(res, exp)

        res = pd.concat([sparse3, sparse])
        exp = pd.concat([self.dense3, self.dense1]).to_sparse(fill_value=0)
        exp._default_fill_value = np.nan
        tm.assert_sp_frame_equal(res, exp)

        # different fill values
        sparse = self.dense1.to_sparse()
        sparse3 = self.dense3.to_sparse(fill_value=0)
        # each columns keeps its fill_value, thus compare in dense
        res = pd.concat([sparse, sparse3])
        exp = pd.concat([self.dense1, self.dense3])
        assert isinstance(res, pd.SparseDataFrame)
        tm.assert_frame_equal(res.to_dense(), exp)

        res = pd.concat([sparse3, sparse])
        exp = pd.concat([self.dense3, self.dense1])
        assert isinstance(res, pd.SparseDataFrame)
        tm.assert_frame_equal(res.to_dense(), exp)

    def test_concat_series(self):
        # fill_value = np.nan
        sparse = self.dense1.to_sparse()
        sparse2 = self.dense2.to_sparse()

        for col in ['A', 'D']:
            res = pd.concat([sparse, sparse2[col]])
            exp = pd.concat([self.dense1, self.dense2[col]]).to_sparse()
            tm.assert_sp_frame_equal(res, exp)

            res = pd.concat([sparse2[col], sparse])
            exp = pd.concat([self.dense2[col], self.dense1]).to_sparse()
            tm.assert_sp_frame_equal(res, exp)

        # fill_value = 0
        sparse = self.dense1.to_sparse(fill_value=0)
        sparse2 = self.dense2.to_sparse(fill_value=0)

        for col in ['C', 'D']:
            res = pd.concat([sparse, sparse2[col]])
            exp = pd.concat([self.dense1,
                             self.dense2[col]]).to_sparse(fill_value=0)
            exp._default_fill_value = np.nan
            tm.assert_sp_frame_equal(res, exp)

            res = pd.concat([sparse2[col], sparse])
            exp = pd.concat([self.dense2[col],
                             self.dense1]).to_sparse(fill_value=0)
            exp._default_fill_value = np.nan
            tm.assert_sp_frame_equal(res, exp)

    def test_concat_axis1(self):
        # fill_value = np.nan
        sparse = self.dense1.to_sparse()
        sparse3 = self.dense3.to_sparse()

        res = pd.concat([sparse, sparse3], axis=1)
        exp = pd.concat([self.dense1, self.dense3], axis=1).to_sparse()
        tm.assert_sp_frame_equal(res, exp)

        res = pd.concat([sparse3, sparse], axis=1)
        exp = pd.concat([self.dense3, self.dense1], axis=1).to_sparse()
        exp._default_fill_value = np.nan
        tm.assert_sp_frame_equal(res, exp)

        # fill_value = 0
        sparse = self.dense1.to_sparse(fill_value=0)
        sparse3 = self.dense3.to_sparse(fill_value=0)

        res = pd.concat([sparse, sparse3], axis=1)
        exp = pd.concat([self.dense1, self.dense3],
                        axis=1).to_sparse(fill_value=0)
        exp._default_fill_value = np.nan
        tm.assert_sp_frame_equal(res, exp)

        res = pd.concat([sparse3, sparse], axis=1)
        exp = pd.concat([self.dense3, self.dense1],
                        axis=1).to_sparse(fill_value=0)
        exp._default_fill_value = np.nan
        tm.assert_sp_frame_equal(res, exp)

        # different fill values
        sparse = self.dense1.to_sparse()
        sparse3 = self.dense3.to_sparse(fill_value=0)
        # each columns keeps its fill_value, thus compare in dense
        res = pd.concat([sparse, sparse3], axis=1)
        exp = pd.concat([self.dense1, self.dense3], axis=1)
        assert isinstance(res, pd.SparseDataFrame)
        tm.assert_frame_equal(res.to_dense(), exp)

        res = pd.concat([sparse3, sparse], axis=1)
        exp = pd.concat([self.dense3, self.dense1], axis=1)
        assert isinstance(res, pd.SparseDataFrame)
        tm.assert_frame_equal(res.to_dense(), exp)

    def test_concat_sparse_dense(self):
        sparse = self.dense1.to_sparse()

        res = pd.concat([sparse, self.dense2])
        exp = pd.concat([self.dense1, self.dense2])
        assert isinstance(res, pd.SparseDataFrame)
        tm.assert_frame_equal(res.to_dense(), exp)

        res = pd.concat([self.dense2, sparse])
        exp = pd.concat([self.dense2, self.dense1])
        assert isinstance(res, pd.SparseDataFrame)
        tm.assert_frame_equal(res.to_dense(), exp)

        sparse = self.dense1.to_sparse(fill_value=0)

        res = pd.concat([sparse, self.dense2])
        exp = pd.concat([self.dense1, self.dense2])
        assert isinstance(res, pd.SparseDataFrame)
        tm.assert_frame_equal(res.to_dense(), exp)

        res = pd.concat([self.dense2, sparse])
        exp = pd.concat([self.dense2, self.dense1])
        assert isinstance(res, pd.SparseDataFrame)
        tm.assert_frame_equal(res.to_dense(), exp)

        res = pd.concat([self.dense3, sparse], axis=1)
        exp = pd.concat([self.dense3, self.dense1], axis=1)
        assert isinstance(res, pd.SparseDataFrame)
        tm.assert_frame_equal(res, exp)

        res = pd.concat([sparse, self.dense3], axis=1)
        exp = pd.concat([self.dense1, self.dense3], axis=1)
        assert isinstance(res, pd.SparseDataFrame)
        tm.assert_frame_equal(res, exp)
