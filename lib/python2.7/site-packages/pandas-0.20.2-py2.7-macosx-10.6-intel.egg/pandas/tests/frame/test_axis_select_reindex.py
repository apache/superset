# -*- coding: utf-8 -*-

from __future__ import print_function

import pytest

from datetime import datetime

from numpy import random
import numpy as np

from pandas.compat import lrange, lzip, u
from pandas import (compat, DataFrame, Series, Index, MultiIndex,
                    date_range, isnull)
import pandas as pd

from pandas.util.testing import assert_frame_equal

from pandas.errors import PerformanceWarning
import pandas.util.testing as tm

from pandas.tests.frame.common import TestData


class TestDataFrameSelectReindex(TestData):
    # These are specific reindex-based tests; other indexing tests should go in
    # test_indexing

    def test_drop_names(self):
        df = DataFrame([[1, 2, 3], [3, 4, 5], [5, 6, 7]],
                       index=['a', 'b', 'c'],
                       columns=['d', 'e', 'f'])
        df.index.name, df.columns.name = 'first', 'second'
        df_dropped_b = df.drop('b')
        df_dropped_e = df.drop('e', axis=1)
        df_inplace_b, df_inplace_e = df.copy(), df.copy()
        df_inplace_b.drop('b', inplace=True)
        df_inplace_e.drop('e', axis=1, inplace=True)
        for obj in (df_dropped_b, df_dropped_e, df_inplace_b, df_inplace_e):
            assert obj.index.name == 'first'
            assert obj.columns.name == 'second'
        assert list(df.columns) == ['d', 'e', 'f']

        pytest.raises(ValueError, df.drop, ['g'])
        pytest.raises(ValueError, df.drop, ['g'], 1)

        # errors = 'ignore'
        dropped = df.drop(['g'], errors='ignore')
        expected = Index(['a', 'b', 'c'], name='first')
        tm.assert_index_equal(dropped.index, expected)

        dropped = df.drop(['b', 'g'], errors='ignore')
        expected = Index(['a', 'c'], name='first')
        tm.assert_index_equal(dropped.index, expected)

        dropped = df.drop(['g'], axis=1, errors='ignore')
        expected = Index(['d', 'e', 'f'], name='second')
        tm.assert_index_equal(dropped.columns, expected)

        dropped = df.drop(['d', 'g'], axis=1, errors='ignore')
        expected = Index(['e', 'f'], name='second')
        tm.assert_index_equal(dropped.columns, expected)

        # GH 16398
        dropped = df.drop([], errors='ignore')
        expected = Index(['a', 'b', 'c'], name='first')
        tm.assert_index_equal(dropped.index, expected)

    def test_drop_col_still_multiindex(self):
        arrays = [['a', 'b', 'c', 'top'],
                  ['', '', '', 'OD'],
                  ['', '', '', 'wx']]

        tuples = sorted(zip(*arrays))
        index = MultiIndex.from_tuples(tuples)

        df = DataFrame(np.random.randn(3, 4), columns=index)
        del df[('a', '', '')]
        assert(isinstance(df.columns, MultiIndex))

    def test_drop(self):
        simple = DataFrame({"A": [1, 2, 3, 4], "B": [0, 1, 2, 3]})
        assert_frame_equal(simple.drop("A", axis=1), simple[['B']])
        assert_frame_equal(simple.drop(["A", "B"], axis='columns'),
                           simple[[]])
        assert_frame_equal(simple.drop([0, 1, 3], axis=0), simple.loc[[2], :])
        assert_frame_equal(simple.drop(
            [0, 3], axis='index'), simple.loc[[1, 2], :])

        pytest.raises(ValueError, simple.drop, 5)
        pytest.raises(ValueError, simple.drop, 'C', 1)
        pytest.raises(ValueError, simple.drop, [1, 5])
        pytest.raises(ValueError, simple.drop, ['A', 'C'], 1)

        # errors = 'ignore'
        assert_frame_equal(simple.drop(5, errors='ignore'), simple)
        assert_frame_equal(simple.drop([0, 5], errors='ignore'),
                           simple.loc[[1, 2, 3], :])
        assert_frame_equal(simple.drop('C', axis=1, errors='ignore'), simple)
        assert_frame_equal(simple.drop(['A', 'C'], axis=1, errors='ignore'),
                           simple[['B']])

        # non-unique - wheee!
        nu_df = DataFrame(lzip(range(3), range(-3, 1), list('abc')),
                          columns=['a', 'a', 'b'])
        assert_frame_equal(nu_df.drop('a', axis=1), nu_df[['b']])
        assert_frame_equal(nu_df.drop('b', axis='columns'), nu_df['a'])
        assert_frame_equal(nu_df.drop([]), nu_df)  # GH 16398

        nu_df = nu_df.set_index(pd.Index(['X', 'Y', 'X']))
        nu_df.columns = list('abc')
        assert_frame_equal(nu_df.drop('X', axis='rows'), nu_df.loc[["Y"], :])
        assert_frame_equal(nu_df.drop(['X', 'Y'], axis=0), nu_df.loc[[], :])

        # inplace cache issue
        # GH 5628
        df = pd.DataFrame(np.random.randn(10, 3), columns=list('abc'))
        expected = df[~(df.b > 0)]
        df.drop(labels=df[df.b > 0].index, inplace=True)
        assert_frame_equal(df, expected)

    def test_drop_multiindex_not_lexsorted(self):
        # GH 11640

        # define the lexsorted version
        lexsorted_mi = MultiIndex.from_tuples(
            [('a', ''), ('b1', 'c1'), ('b2', 'c2')], names=['b', 'c'])
        lexsorted_df = DataFrame([[1, 3, 4]], columns=lexsorted_mi)
        assert lexsorted_df.columns.is_lexsorted()

        # define the non-lexsorted version
        not_lexsorted_df = DataFrame(columns=['a', 'b', 'c', 'd'],
                                     data=[[1, 'b1', 'c1', 3],
                                           [1, 'b2', 'c2', 4]])
        not_lexsorted_df = not_lexsorted_df.pivot_table(
            index='a', columns=['b', 'c'], values='d')
        not_lexsorted_df = not_lexsorted_df.reset_index()
        assert not not_lexsorted_df.columns.is_lexsorted()

        # compare the results
        tm.assert_frame_equal(lexsorted_df, not_lexsorted_df)

        expected = lexsorted_df.drop('a', axis=1)
        with tm.assert_produces_warning(PerformanceWarning):
            result = not_lexsorted_df.drop('a', axis=1)

        tm.assert_frame_equal(result, expected)

    def test_merge_join_different_levels(self):
        # GH 9455

        # first dataframe
        df1 = DataFrame(columns=['a', 'b'], data=[[1, 11], [0, 22]])

        # second dataframe
        columns = MultiIndex.from_tuples([('a', ''), ('c', 'c1')])
        df2 = DataFrame(columns=columns, data=[[1, 33], [0, 44]])

        # merge
        columns = ['a', 'b', ('c', 'c1')]
        expected = DataFrame(columns=columns, data=[[1, 11, 33], [0, 22, 44]])
        with tm.assert_produces_warning(UserWarning):
            result = pd.merge(df1, df2, on='a')
        tm.assert_frame_equal(result, expected)

        # join, see discussion in GH 12219
        columns = ['a', 'b', ('a', ''), ('c', 'c1')]
        expected = DataFrame(columns=columns,
                             data=[[1, 11, 0, 44], [0, 22, 1, 33]])
        with tm.assert_produces_warning(UserWarning):
            result = df1.join(df2, on='a')
        tm.assert_frame_equal(result, expected)

    def test_reindex(self):
        newFrame = self.frame.reindex(self.ts1.index)

        for col in newFrame.columns:
            for idx, val in compat.iteritems(newFrame[col]):
                if idx in self.frame.index:
                    if np.isnan(val):
                        assert np.isnan(self.frame[col][idx])
                    else:
                        assert val == self.frame[col][idx]
                else:
                    assert np.isnan(val)

        for col, series in compat.iteritems(newFrame):
            assert tm.equalContents(series.index, newFrame.index)
        emptyFrame = self.frame.reindex(Index([]))
        assert len(emptyFrame.index) == 0

        # Cython code should be unit-tested directly
        nonContigFrame = self.frame.reindex(self.ts1.index[::2])

        for col in nonContigFrame.columns:
            for idx, val in compat.iteritems(nonContigFrame[col]):
                if idx in self.frame.index:
                    if np.isnan(val):
                        assert np.isnan(self.frame[col][idx])
                    else:
                        assert val == self.frame[col][idx]
                else:
                    assert np.isnan(val)

        for col, series in compat.iteritems(nonContigFrame):
            assert tm.equalContents(series.index, nonContigFrame.index)

        # corner cases

        # Same index, copies values but not index if copy=False
        newFrame = self.frame.reindex(self.frame.index, copy=False)
        assert newFrame.index is self.frame.index

        # length zero
        newFrame = self.frame.reindex([])
        assert newFrame.empty
        assert len(newFrame.columns) == len(self.frame.columns)

        # length zero with columns reindexed with non-empty index
        newFrame = self.frame.reindex([])
        newFrame = newFrame.reindex(self.frame.index)
        assert len(newFrame.index) == len(self.frame.index)
        assert len(newFrame.columns) == len(self.frame.columns)

        # pass non-Index
        newFrame = self.frame.reindex(list(self.ts1.index))
        tm.assert_index_equal(newFrame.index, self.ts1.index)

        # copy with no axes
        result = self.frame.reindex()
        assert_frame_equal(result, self.frame)
        assert result is not self.frame

    def test_reindex_nan(self):
        df = pd.DataFrame([[1, 2], [3, 5], [7, 11], [9, 23]],
                          index=[2, np.nan, 1, 5],
                          columns=['joe', 'jim'])

        i, j = [np.nan, 5, 5, np.nan, 1, 2, np.nan], [1, 3, 3, 1, 2, 0, 1]
        assert_frame_equal(df.reindex(i), df.iloc[j])

        df.index = df.index.astype('object')
        assert_frame_equal(df.reindex(i), df.iloc[j], check_index_type=False)

        # GH10388
        df = pd.DataFrame({'other': ['a', 'b', np.nan, 'c'],
                           'date': ['2015-03-22', np.nan,
                                    '2012-01-08', np.nan],
                           'amount': [2, 3, 4, 5]})

        df['date'] = pd.to_datetime(df.date)
        df['delta'] = (pd.to_datetime('2015-06-18') - df['date']).shift(1)

        left = df.set_index(['delta', 'other', 'date']).reset_index()
        right = df.reindex(columns=['delta', 'other', 'date', 'amount'])
        assert_frame_equal(left, right)

    def test_reindex_name_remains(self):
        s = Series(random.rand(10))
        df = DataFrame(s, index=np.arange(len(s)))
        i = Series(np.arange(10), name='iname')

        df = df.reindex(i)
        assert df.index.name == 'iname'

        df = df.reindex(Index(np.arange(10), name='tmpname'))
        assert df.index.name == 'tmpname'

        s = Series(random.rand(10))
        df = DataFrame(s.T, index=np.arange(len(s)))
        i = Series(np.arange(10), name='iname')
        df = df.reindex(columns=i)
        assert df.columns.name == 'iname'

    def test_reindex_int(self):
        smaller = self.intframe.reindex(self.intframe.index[::2])

        assert smaller['A'].dtype == np.int64

        bigger = smaller.reindex(self.intframe.index)
        assert bigger['A'].dtype == np.float64

        smaller = self.intframe.reindex(columns=['A', 'B'])
        assert smaller['A'].dtype == np.int64

    def test_reindex_like(self):
        other = self.frame.reindex(index=self.frame.index[:10],
                                   columns=['C', 'B'])

        assert_frame_equal(other, self.frame.reindex_like(other))

    def test_reindex_columns(self):
        new_frame = self.frame.reindex(columns=['A', 'B', 'E'])

        tm.assert_series_equal(new_frame['B'], self.frame['B'])
        assert np.isnan(new_frame['E']).all()
        assert 'C' not in new_frame

        # Length zero
        new_frame = self.frame.reindex(columns=[])
        assert new_frame.empty

    def test_reindex_columns_method(self):

        # GH 14992, reindexing over columns ignored method
        df = DataFrame(data=[[11, 12, 13], [21, 22, 23], [31, 32, 33]],
                       index=[1, 2, 4],
                       columns=[1, 2, 4],
                       dtype=float)

        # default method
        result = df.reindex(columns=range(6))
        expected = DataFrame(data=[[np.nan, 11, 12, np.nan, 13, np.nan],
                                   [np.nan, 21, 22, np.nan, 23, np.nan],
                                   [np.nan, 31, 32, np.nan, 33, np.nan]],
                             index=[1, 2, 4],
                             columns=range(6),
                             dtype=float)
        assert_frame_equal(result, expected)

        # method='ffill'
        result = df.reindex(columns=range(6), method='ffill')
        expected = DataFrame(data=[[np.nan, 11, 12, 12, 13, 13],
                                   [np.nan, 21, 22, 22, 23, 23],
                                   [np.nan, 31, 32, 32, 33, 33]],
                             index=[1, 2, 4],
                             columns=range(6),
                             dtype=float)
        assert_frame_equal(result, expected)

        # method='bfill'
        result = df.reindex(columns=range(6), method='bfill')
        expected = DataFrame(data=[[11, 11, 12, 13, 13, np.nan],
                                   [21, 21, 22, 23, 23, np.nan],
                                   [31, 31, 32, 33, 33, np.nan]],
                             index=[1, 2, 4],
                             columns=range(6),
                             dtype=float)
        assert_frame_equal(result, expected)

    def test_reindex_axes(self):
        # GH 3317, reindexing by both axes loses freq of the index
        df = DataFrame(np.ones((3, 3)),
                       index=[datetime(2012, 1, 1),
                              datetime(2012, 1, 2),
                              datetime(2012, 1, 3)],
                       columns=['a', 'b', 'c'])
        time_freq = date_range('2012-01-01', '2012-01-03', freq='d')
        some_cols = ['a', 'b']

        index_freq = df.reindex(index=time_freq).index.freq
        both_freq = df.reindex(index=time_freq, columns=some_cols).index.freq
        seq_freq = df.reindex(index=time_freq).reindex(
            columns=some_cols).index.freq
        assert index_freq == both_freq
        assert index_freq == seq_freq

    def test_reindex_fill_value(self):
        df = DataFrame(np.random.randn(10, 4))

        # axis=0
        result = df.reindex(lrange(15))
        assert np.isnan(result.values[-5:]).all()

        result = df.reindex(lrange(15), fill_value=0)
        expected = df.reindex(lrange(15)).fillna(0)
        assert_frame_equal(result, expected)

        # axis=1
        result = df.reindex(columns=lrange(5), fill_value=0.)
        expected = df.copy()
        expected[4] = 0.
        assert_frame_equal(result, expected)

        result = df.reindex(columns=lrange(5), fill_value=0)
        expected = df.copy()
        expected[4] = 0
        assert_frame_equal(result, expected)

        result = df.reindex(columns=lrange(5), fill_value='foo')
        expected = df.copy()
        expected[4] = 'foo'
        assert_frame_equal(result, expected)

        # reindex_axis
        result = df.reindex_axis(lrange(15), fill_value=0., axis=0)
        expected = df.reindex(lrange(15)).fillna(0)
        assert_frame_equal(result, expected)

        result = df.reindex_axis(lrange(5), fill_value=0., axis=1)
        expected = df.reindex(columns=lrange(5)).fillna(0)
        assert_frame_equal(result, expected)

        # other dtypes
        df['foo'] = 'foo'
        result = df.reindex(lrange(15), fill_value=0)
        expected = df.reindex(lrange(15)).fillna(0)
        assert_frame_equal(result, expected)

    def test_reindex_dups(self):

        # GH4746, reindex on duplicate index error messages
        arr = np.random.randn(10)
        df = DataFrame(arr, index=[1, 2, 3, 4, 5, 1, 2, 3, 4, 5])

        # set index is ok
        result = df.copy()
        result.index = list(range(len(df)))
        expected = DataFrame(arr, index=list(range(len(df))))
        assert_frame_equal(result, expected)

        # reindex fails
        pytest.raises(ValueError, df.reindex, index=list(range(len(df))))

    def test_align(self):
        af, bf = self.frame.align(self.frame)
        assert af._data is not self.frame._data

        af, bf = self.frame.align(self.frame, copy=False)
        assert af._data is self.frame._data

        # axis = 0
        other = self.frame.iloc[:-5, :3]
        af, bf = self.frame.align(other, axis=0, fill_value=-1)

        tm.assert_index_equal(bf.columns, other.columns)

        # test fill value
        join_idx = self.frame.index.join(other.index)
        diff_a = self.frame.index.difference(join_idx)
        diff_b = other.index.difference(join_idx)
        diff_a_vals = af.reindex(diff_a).values
        diff_b_vals = bf.reindex(diff_b).values
        assert (diff_a_vals == -1).all()

        af, bf = self.frame.align(other, join='right', axis=0)
        tm.assert_index_equal(bf.columns, other.columns)
        tm.assert_index_equal(bf.index, other.index)
        tm.assert_index_equal(af.index, other.index)

        # axis = 1
        other = self.frame.iloc[:-5, :3].copy()
        af, bf = self.frame.align(other, axis=1)
        tm.assert_index_equal(bf.columns, self.frame.columns)
        tm.assert_index_equal(bf.index, other.index)

        # test fill value
        join_idx = self.frame.index.join(other.index)
        diff_a = self.frame.index.difference(join_idx)
        diff_b = other.index.difference(join_idx)
        diff_a_vals = af.reindex(diff_a).values

        # TODO(wesm): unused?
        diff_b_vals = bf.reindex(diff_b).values  # noqa

        assert (diff_a_vals == -1).all()

        af, bf = self.frame.align(other, join='inner', axis=1)
        tm.assert_index_equal(bf.columns, other.columns)

        af, bf = self.frame.align(other, join='inner', axis=1, method='pad')
        tm.assert_index_equal(bf.columns, other.columns)

        # test other non-float types
        af, bf = self.intframe.align(other, join='inner', axis=1, method='pad')
        tm.assert_index_equal(bf.columns, other.columns)

        af, bf = self.mixed_frame.align(self.mixed_frame,
                                        join='inner', axis=1, method='pad')
        tm.assert_index_equal(bf.columns, self.mixed_frame.columns)

        af, bf = self.frame.align(other.iloc[:, 0], join='inner', axis=1,
                                  method=None, fill_value=None)
        tm.assert_index_equal(bf.index, Index([]))

        af, bf = self.frame.align(other.iloc[:, 0], join='inner', axis=1,
                                  method=None, fill_value=0)
        tm.assert_index_equal(bf.index, Index([]))

        # mixed floats/ints
        af, bf = self.mixed_float.align(other.iloc[:, 0], join='inner', axis=1,
                                        method=None, fill_value=0)
        tm.assert_index_equal(bf.index, Index([]))

        af, bf = self.mixed_int.align(other.iloc[:, 0], join='inner', axis=1,
                                      method=None, fill_value=0)
        tm.assert_index_equal(bf.index, Index([]))

        # Try to align DataFrame to Series along bad axis
        with pytest.raises(ValueError):
            self.frame.align(af.iloc[0, :3], join='inner', axis=2)

        # align dataframe to series with broadcast or not
        idx = self.frame.index
        s = Series(range(len(idx)), index=idx)

        left, right = self.frame.align(s, axis=0)
        tm.assert_index_equal(left.index, self.frame.index)
        tm.assert_index_equal(right.index, self.frame.index)
        assert isinstance(right, Series)

        left, right = self.frame.align(s, broadcast_axis=1)
        tm.assert_index_equal(left.index, self.frame.index)
        expected = {}
        for c in self.frame.columns:
            expected[c] = s
        expected = DataFrame(expected, index=self.frame.index,
                             columns=self.frame.columns)
        tm.assert_frame_equal(right, expected)

        # see gh-9558
        df = DataFrame({'a': [1, 2, 3], 'b': [4, 5, 6]})
        result = df[df['a'] == 2]
        expected = DataFrame([[2, 5]], index=[1], columns=['a', 'b'])
        tm.assert_frame_equal(result, expected)

        result = df.where(df['a'] == 2, 0)
        expected = DataFrame({'a': [0, 2, 0], 'b': [0, 5, 0]})
        tm.assert_frame_equal(result, expected)

    def _check_align(self, a, b, axis, fill_axis, how, method, limit=None):
        aa, ab = a.align(b, axis=axis, join=how, method=method, limit=limit,
                         fill_axis=fill_axis)

        join_index, join_columns = None, None

        ea, eb = a, b
        if axis is None or axis == 0:
            join_index = a.index.join(b.index, how=how)
            ea = ea.reindex(index=join_index)
            eb = eb.reindex(index=join_index)

        if axis is None or axis == 1:
            join_columns = a.columns.join(b.columns, how=how)
            ea = ea.reindex(columns=join_columns)
            eb = eb.reindex(columns=join_columns)

        ea = ea.fillna(axis=fill_axis, method=method, limit=limit)
        eb = eb.fillna(axis=fill_axis, method=method, limit=limit)

        assert_frame_equal(aa, ea)
        assert_frame_equal(ab, eb)

    def test_align_fill_method_inner(self):
        for meth in ['pad', 'bfill']:
            for ax in [0, 1, None]:
                for fax in [0, 1]:
                    self._check_align_fill('inner', meth, ax, fax)

    def test_align_fill_method_outer(self):
        for meth in ['pad', 'bfill']:
            for ax in [0, 1, None]:
                for fax in [0, 1]:
                    self._check_align_fill('outer', meth, ax, fax)

    def test_align_fill_method_left(self):
        for meth in ['pad', 'bfill']:
            for ax in [0, 1, None]:
                for fax in [0, 1]:
                    self._check_align_fill('left', meth, ax, fax)

    def test_align_fill_method_right(self):
        for meth in ['pad', 'bfill']:
            for ax in [0, 1, None]:
                for fax in [0, 1]:
                    self._check_align_fill('right', meth, ax, fax)

    def _check_align_fill(self, kind, meth, ax, fax):
        left = self.frame.iloc[0:4, :10]
        right = self.frame.iloc[2:, 6:]
        empty = self.frame.iloc[:0, :0]

        self._check_align(left, right, axis=ax, fill_axis=fax,
                          how=kind, method=meth)
        self._check_align(left, right, axis=ax, fill_axis=fax,
                          how=kind, method=meth, limit=1)

        # empty left
        self._check_align(empty, right, axis=ax, fill_axis=fax,
                          how=kind, method=meth)
        self._check_align(empty, right, axis=ax, fill_axis=fax,
                          how=kind, method=meth, limit=1)

        # empty right
        self._check_align(left, empty, axis=ax, fill_axis=fax,
                          how=kind, method=meth)
        self._check_align(left, empty, axis=ax, fill_axis=fax,
                          how=kind, method=meth, limit=1)

        # both empty
        self._check_align(empty, empty, axis=ax, fill_axis=fax,
                          how=kind, method=meth)
        self._check_align(empty, empty, axis=ax, fill_axis=fax,
                          how=kind, method=meth, limit=1)

    def test_align_int_fill_bug(self):
        # GH #910
        X = np.arange(10 * 10, dtype='float64').reshape(10, 10)
        Y = np.ones((10, 1), dtype=int)

        df1 = DataFrame(X)
        df1['0.X'] = Y.squeeze()

        df2 = df1.astype(float)

        result = df1 - df1.mean()
        expected = df2 - df2.mean()
        assert_frame_equal(result, expected)

    def test_align_multiindex(self):
        # GH 10665
        # same test cases as test_align_multiindex in test_series.py

        midx = pd.MultiIndex.from_product([range(2), range(3), range(2)],
                                          names=('a', 'b', 'c'))
        idx = pd.Index(range(2), name='b')
        df1 = pd.DataFrame(np.arange(12, dtype='int64'), index=midx)
        df2 = pd.DataFrame(np.arange(2, dtype='int64'), index=idx)

        # these must be the same results (but flipped)
        res1l, res1r = df1.align(df2, join='left')
        res2l, res2r = df2.align(df1, join='right')

        expl = df1
        assert_frame_equal(expl, res1l)
        assert_frame_equal(expl, res2r)
        expr = pd.DataFrame([0, 0, 1, 1, np.nan, np.nan] * 2, index=midx)
        assert_frame_equal(expr, res1r)
        assert_frame_equal(expr, res2l)

        res1l, res1r = df1.align(df2, join='right')
        res2l, res2r = df2.align(df1, join='left')

        exp_idx = pd.MultiIndex.from_product([range(2), range(2), range(2)],
                                             names=('a', 'b', 'c'))
        expl = pd.DataFrame([0, 1, 2, 3, 6, 7, 8, 9], index=exp_idx)
        assert_frame_equal(expl, res1l)
        assert_frame_equal(expl, res2r)
        expr = pd.DataFrame([0, 0, 1, 1] * 2, index=exp_idx)
        assert_frame_equal(expr, res1r)
        assert_frame_equal(expr, res2l)

    def test_align_series_combinations(self):
        df = pd.DataFrame({'a': [1, 3, 5],
                           'b': [1, 3, 5]}, index=list('ACE'))
        s = pd.Series([1, 2, 4], index=list('ABD'), name='x')

        # frame + series
        res1, res2 = df.align(s, axis=0)
        exp1 = pd.DataFrame({'a': [1, np.nan, 3, np.nan, 5],
                             'b': [1, np.nan, 3, np.nan, 5]},
                            index=list('ABCDE'))
        exp2 = pd.Series([1, 2, np.nan, 4, np.nan],
                         index=list('ABCDE'), name='x')

        tm.assert_frame_equal(res1, exp1)
        tm.assert_series_equal(res2, exp2)

        # series + frame
        res1, res2 = s.align(df)
        tm.assert_series_equal(res1, exp2)
        tm.assert_frame_equal(res2, exp1)

    def test_filter(self):
        # Items
        filtered = self.frame.filter(['A', 'B', 'E'])
        assert len(filtered.columns) == 2
        assert 'E' not in filtered

        filtered = self.frame.filter(['A', 'B', 'E'], axis='columns')
        assert len(filtered.columns) == 2
        assert 'E' not in filtered

        # Other axis
        idx = self.frame.index[0:4]
        filtered = self.frame.filter(idx, axis='index')
        expected = self.frame.reindex(index=idx)
        tm.assert_frame_equal(filtered, expected)

        # like
        fcopy = self.frame.copy()
        fcopy['AA'] = 1

        filtered = fcopy.filter(like='A')
        assert len(filtered.columns) == 2
        assert 'AA' in filtered

        # like with ints in column names
        df = DataFrame(0., index=[0, 1, 2], columns=[0, 1, '_A', '_B'])
        filtered = df.filter(like='_')
        assert len(filtered.columns) == 2

        # regex with ints in column names
        # from PR #10384
        df = DataFrame(0., index=[0, 1, 2], columns=['A1', 1, 'B', 2, 'C'])
        expected = DataFrame(
            0., index=[0, 1, 2], columns=pd.Index([1, 2], dtype=object))
        filtered = df.filter(regex='^[0-9]+$')
        tm.assert_frame_equal(filtered, expected)

        expected = DataFrame(0., index=[0, 1, 2], columns=[0, '0', 1, '1'])
        # shouldn't remove anything
        filtered = expected.filter(regex='^[0-9]+$')
        tm.assert_frame_equal(filtered, expected)

        # pass in None
        with tm.assert_raises_regex(TypeError, 'Must pass'):
            self.frame.filter()
        with tm.assert_raises_regex(TypeError, 'Must pass'):
            self.frame.filter(items=None)
        with tm.assert_raises_regex(TypeError, 'Must pass'):
            self.frame.filter(axis=1)

        # test mutually exclusive arguments
        with tm.assert_raises_regex(TypeError, 'mutually exclusive'):
            self.frame.filter(items=['one', 'three'], regex='e$', like='bbi')
        with tm.assert_raises_regex(TypeError, 'mutually exclusive'):
            self.frame.filter(items=['one', 'three'], regex='e$', axis=1)
        with tm.assert_raises_regex(TypeError, 'mutually exclusive'):
            self.frame.filter(items=['one', 'three'], regex='e$')
        with tm.assert_raises_regex(TypeError, 'mutually exclusive'):
            self.frame.filter(items=['one', 'three'], like='bbi', axis=0)
        with tm.assert_raises_regex(TypeError, 'mutually exclusive'):
            self.frame.filter(items=['one', 'three'], like='bbi')

        # objects
        filtered = self.mixed_frame.filter(like='foo')
        assert 'foo' in filtered

        # unicode columns, won't ascii-encode
        df = self.frame.rename(columns={'B': u('\u2202')})
        filtered = df.filter(like='C')
        assert 'C' in filtered

    def test_filter_regex_search(self):
        fcopy = self.frame.copy()
        fcopy['AA'] = 1

        # regex
        filtered = fcopy.filter(regex='[A]+')
        assert len(filtered.columns) == 2
        assert 'AA' in filtered

        # doesn't have to be at beginning
        df = DataFrame({'aBBa': [1, 2],
                        'BBaBB': [1, 2],
                        'aCCa': [1, 2],
                        'aCCaBB': [1, 2]})

        result = df.filter(regex='BB')
        exp = df[[x for x in df.columns if 'BB' in x]]
        assert_frame_equal(result, exp)

    def test_filter_corner(self):
        empty = DataFrame()

        result = empty.filter([])
        assert_frame_equal(result, empty)

        result = empty.filter(like='foo')
        assert_frame_equal(result, empty)

    def test_select(self):
        f = lambda x: x.weekday() == 2
        result = self.tsframe.select(f, axis=0)
        expected = self.tsframe.reindex(
            index=self.tsframe.index[[f(x) for x in self.tsframe.index]])
        assert_frame_equal(result, expected)

        result = self.frame.select(lambda x: x in ('B', 'D'), axis=1)
        expected = self.frame.reindex(columns=['B', 'D'])

        # TODO should reindex check_names?
        assert_frame_equal(result, expected, check_names=False)

    def test_take(self):
        # homogeneous
        order = [3, 1, 2, 0]
        for df in [self.frame]:

            result = df.take(order, axis=0)
            expected = df.reindex(df.index.take(order))
            assert_frame_equal(result, expected)

            # axis = 1
            result = df.take(order, axis=1)
            expected = df.loc[:, ['D', 'B', 'C', 'A']]
            assert_frame_equal(result, expected, check_names=False)

        # neg indicies
        order = [2, 1, -1]
        for df in [self.frame]:

            result = df.take(order, axis=0)
            expected = df.reindex(df.index.take(order))
            assert_frame_equal(result, expected)

            # axis = 1
            result = df.take(order, axis=1)
            expected = df.loc[:, ['C', 'B', 'D']]
            assert_frame_equal(result, expected, check_names=False)

        # illegal indices
        pytest.raises(IndexError, df.take, [3, 1, 2, 30], axis=0)
        pytest.raises(IndexError, df.take, [3, 1, 2, -31], axis=0)
        pytest.raises(IndexError, df.take, [3, 1, 2, 5], axis=1)
        pytest.raises(IndexError, df.take, [3, 1, 2, -5], axis=1)

        # mixed-dtype
        order = [4, 1, 2, 0, 3]
        for df in [self.mixed_frame]:

            result = df.take(order, axis=0)
            expected = df.reindex(df.index.take(order))
            assert_frame_equal(result, expected)

            # axis = 1
            result = df.take(order, axis=1)
            expected = df.loc[:, ['foo', 'B', 'C', 'A', 'D']]
            assert_frame_equal(result, expected)

        # neg indicies
        order = [4, 1, -2]
        for df in [self.mixed_frame]:

            result = df.take(order, axis=0)
            expected = df.reindex(df.index.take(order))
            assert_frame_equal(result, expected)

            # axis = 1
            result = df.take(order, axis=1)
            expected = df.loc[:, ['foo', 'B', 'D']]
            assert_frame_equal(result, expected)

        # by dtype
        order = [1, 2, 0, 3]
        for df in [self.mixed_float, self.mixed_int]:

            result = df.take(order, axis=0)
            expected = df.reindex(df.index.take(order))
            assert_frame_equal(result, expected)

            # axis = 1
            result = df.take(order, axis=1)
            expected = df.loc[:, ['B', 'C', 'A', 'D']]
            assert_frame_equal(result, expected)

    def test_reindex_boolean(self):
        frame = DataFrame(np.ones((10, 2), dtype=bool),
                          index=np.arange(0, 20, 2),
                          columns=[0, 2])

        reindexed = frame.reindex(np.arange(10))
        assert reindexed.values.dtype == np.object_
        assert isnull(reindexed[0][1])

        reindexed = frame.reindex(columns=lrange(3))
        assert reindexed.values.dtype == np.object_
        assert isnull(reindexed[1]).all()

    def test_reindex_objects(self):
        reindexed = self.mixed_frame.reindex(columns=['foo', 'A', 'B'])
        assert 'foo' in reindexed

        reindexed = self.mixed_frame.reindex(columns=['A', 'B'])
        assert 'foo' not in reindexed

    def test_reindex_corner(self):
        index = Index(['a', 'b', 'c'])
        dm = self.empty.reindex(index=[1, 2, 3])
        reindexed = dm.reindex(columns=index)
        tm.assert_index_equal(reindexed.columns, index)

        # ints are weird
        smaller = self.intframe.reindex(columns=['A', 'B', 'E'])
        assert smaller['E'].dtype == np.float64

    def test_reindex_axis(self):
        cols = ['A', 'B', 'E']
        reindexed1 = self.intframe.reindex_axis(cols, axis=1)
        reindexed2 = self.intframe.reindex(columns=cols)
        assert_frame_equal(reindexed1, reindexed2)

        rows = self.intframe.index[0:5]
        reindexed1 = self.intframe.reindex_axis(rows, axis=0)
        reindexed2 = self.intframe.reindex(index=rows)
        assert_frame_equal(reindexed1, reindexed2)

        pytest.raises(ValueError, self.intframe.reindex_axis, rows, axis=2)

        # no-op case
        cols = self.frame.columns.copy()
        newFrame = self.frame.reindex_axis(cols, axis=1)
        assert_frame_equal(newFrame, self.frame)

    def test_reindex_with_nans(self):
        df = DataFrame([[1, 2], [3, 4], [np.nan, np.nan], [7, 8], [9, 10]],
                       columns=['a', 'b'],
                       index=[100.0, 101.0, np.nan, 102.0, 103.0])

        result = df.reindex(index=[101.0, 102.0, 103.0])
        expected = df.iloc[[1, 3, 4]]
        assert_frame_equal(result, expected)

        result = df.reindex(index=[103.0])
        expected = df.iloc[[4]]
        assert_frame_equal(result, expected)

        result = df.reindex(index=[101.0])
        expected = df.iloc[[1]]
        assert_frame_equal(result, expected)

    def test_reindex_multi(self):
        df = DataFrame(np.random.randn(3, 3))

        result = df.reindex(lrange(4), lrange(4))
        expected = df.reindex(lrange(4)).reindex(columns=lrange(4))

        assert_frame_equal(result, expected)

        df = DataFrame(np.random.randint(0, 10, (3, 3)))

        result = df.reindex(lrange(4), lrange(4))
        expected = df.reindex(lrange(4)).reindex(columns=lrange(4))

        assert_frame_equal(result, expected)

        df = DataFrame(np.random.randint(0, 10, (3, 3)))

        result = df.reindex(lrange(2), lrange(2))
        expected = df.reindex(lrange(2)).reindex(columns=lrange(2))

        assert_frame_equal(result, expected)

        df = DataFrame(np.random.randn(5, 3) + 1j, columns=['a', 'b', 'c'])

        result = df.reindex(index=[0, 1], columns=['a', 'b'])
        expected = df.reindex([0, 1]).reindex(columns=['a', 'b'])

        assert_frame_equal(result, expected)
