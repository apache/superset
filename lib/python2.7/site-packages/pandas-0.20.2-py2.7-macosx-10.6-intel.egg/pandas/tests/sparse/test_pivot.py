import numpy as np
import pandas as pd
import pandas.util.testing as tm


class TestPivotTable(object):

    def setup_method(self, method):
        self.dense = pd.DataFrame({'A': ['foo', 'bar', 'foo', 'bar',
                                         'foo', 'bar', 'foo', 'foo'],
                                   'B': ['one', 'one', 'two', 'three',
                                         'two', 'two', 'one', 'three'],
                                   'C': np.random.randn(8),
                                   'D': np.random.randn(8),
                                   'E': [np.nan, np.nan, 1, 2,
                                         np.nan, 1, np.nan, np.nan]})
        self.sparse = self.dense.to_sparse()

    def test_pivot_table(self):
        res_sparse = pd.pivot_table(self.sparse, index='A', columns='B',
                                    values='C')
        res_dense = pd.pivot_table(self.dense, index='A', columns='B',
                                   values='C')
        tm.assert_frame_equal(res_sparse, res_dense)

        res_sparse = pd.pivot_table(self.sparse, index='A', columns='B',
                                    values='E')
        res_dense = pd.pivot_table(self.dense, index='A', columns='B',
                                   values='E')
        tm.assert_frame_equal(res_sparse, res_dense)

        res_sparse = pd.pivot_table(self.sparse, index='A', columns='B',
                                    values='E', aggfunc='mean')
        res_dense = pd.pivot_table(self.dense, index='A', columns='B',
                                   values='E', aggfunc='mean')
        tm.assert_frame_equal(res_sparse, res_dense)

        # ToDo: sum doesn't handle nan properly
        # res_sparse = pd.pivot_table(self.sparse, index='A', columns='B',
        #                             values='E', aggfunc='sum')
        # res_dense = pd.pivot_table(self.dense, index='A', columns='B',
        #                            values='E', aggfunc='sum')
        # tm.assert_frame_equal(res_sparse, res_dense)

    def test_pivot_table_multi(self):
        res_sparse = pd.pivot_table(self.sparse, index='A', columns='B',
                                    values=['D', 'E'])
        res_dense = pd.pivot_table(self.dense, index='A', columns='B',
                                   values=['D', 'E'])
        tm.assert_frame_equal(res_sparse, res_dense)
