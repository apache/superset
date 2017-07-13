# -*- coding: utf-8 -*-

from __future__ import print_function

import pytest

from distutils.version import LooseVersion
from numpy import nan, random
import numpy as np

from pandas.compat import lrange
from pandas import (DataFrame, Series, Timestamp,
                    date_range)
import pandas as pd

from pandas.util.testing import assert_series_equal, assert_frame_equal

import pandas.util.testing as tm
from pandas.tests.frame.common import TestData, _check_mixed_float


try:
    import scipy
    _is_scipy_ge_0190 = scipy.__version__ >= LooseVersion('0.19.0')
except:
    _is_scipy_ge_0190 = False


def _skip_if_no_pchip():
    try:
        from scipy.interpolate import pchip_interpolate  # noqa
    except ImportError:
        import pytest
        pytest.skip('scipy.interpolate.pchip missing')


class TestDataFrameMissingData(TestData):

    def test_dropEmptyRows(self):
        N = len(self.frame.index)
        mat = random.randn(N)
        mat[:5] = nan

        frame = DataFrame({'foo': mat}, index=self.frame.index)
        original = Series(mat, index=self.frame.index, name='foo')
        expected = original.dropna()
        inplace_frame1, inplace_frame2 = frame.copy(), frame.copy()

        smaller_frame = frame.dropna(how='all')
        # check that original was preserved
        assert_series_equal(frame['foo'], original)
        inplace_frame1.dropna(how='all', inplace=True)
        assert_series_equal(smaller_frame['foo'], expected)
        assert_series_equal(inplace_frame1['foo'], expected)

        smaller_frame = frame.dropna(how='all', subset=['foo'])
        inplace_frame2.dropna(how='all', subset=['foo'], inplace=True)
        assert_series_equal(smaller_frame['foo'], expected)
        assert_series_equal(inplace_frame2['foo'], expected)

    def test_dropIncompleteRows(self):
        N = len(self.frame.index)
        mat = random.randn(N)
        mat[:5] = nan

        frame = DataFrame({'foo': mat}, index=self.frame.index)
        frame['bar'] = 5
        original = Series(mat, index=self.frame.index, name='foo')
        inp_frame1, inp_frame2 = frame.copy(), frame.copy()

        smaller_frame = frame.dropna()
        assert_series_equal(frame['foo'], original)
        inp_frame1.dropna(inplace=True)

        exp = Series(mat[5:], index=self.frame.index[5:], name='foo')
        tm.assert_series_equal(smaller_frame['foo'], exp)
        tm.assert_series_equal(inp_frame1['foo'], exp)

        samesize_frame = frame.dropna(subset=['bar'])
        assert_series_equal(frame['foo'], original)
        assert (frame['bar'] == 5).all()
        inp_frame2.dropna(subset=['bar'], inplace=True)
        tm.assert_index_equal(samesize_frame.index, self.frame.index)
        tm.assert_index_equal(inp_frame2.index, self.frame.index)

    def test_dropna(self):
        df = DataFrame(np.random.randn(6, 4))
        df[2][:2] = nan

        dropped = df.dropna(axis=1)
        expected = df.loc[:, [0, 1, 3]]
        inp = df.copy()
        inp.dropna(axis=1, inplace=True)
        assert_frame_equal(dropped, expected)
        assert_frame_equal(inp, expected)

        dropped = df.dropna(axis=0)
        expected = df.loc[lrange(2, 6)]
        inp = df.copy()
        inp.dropna(axis=0, inplace=True)
        assert_frame_equal(dropped, expected)
        assert_frame_equal(inp, expected)

        # threshold
        dropped = df.dropna(axis=1, thresh=5)
        expected = df.loc[:, [0, 1, 3]]
        inp = df.copy()
        inp.dropna(axis=1, thresh=5, inplace=True)
        assert_frame_equal(dropped, expected)
        assert_frame_equal(inp, expected)

        dropped = df.dropna(axis=0, thresh=4)
        expected = df.loc[lrange(2, 6)]
        inp = df.copy()
        inp.dropna(axis=0, thresh=4, inplace=True)
        assert_frame_equal(dropped, expected)
        assert_frame_equal(inp, expected)

        dropped = df.dropna(axis=1, thresh=4)
        assert_frame_equal(dropped, df)

        dropped = df.dropna(axis=1, thresh=3)
        assert_frame_equal(dropped, df)

        # subset
        dropped = df.dropna(axis=0, subset=[0, 1, 3])
        inp = df.copy()
        inp.dropna(axis=0, subset=[0, 1, 3], inplace=True)
        assert_frame_equal(dropped, df)
        assert_frame_equal(inp, df)

        # all
        dropped = df.dropna(axis=1, how='all')
        assert_frame_equal(dropped, df)

        df[2] = nan
        dropped = df.dropna(axis=1, how='all')
        expected = df.loc[:, [0, 1, 3]]
        assert_frame_equal(dropped, expected)

        # bad input
        pytest.raises(ValueError, df.dropna, axis=3)

    def test_drop_and_dropna_caching(self):
        # tst that cacher updates
        original = Series([1, 2, np.nan], name='A')
        expected = Series([1, 2], dtype=original.dtype, name='A')
        df = pd.DataFrame({'A': original.values.copy()})
        df2 = df.copy()
        df['A'].dropna()
        assert_series_equal(df['A'], original)
        df['A'].dropna(inplace=True)
        assert_series_equal(df['A'], expected)
        df2['A'].drop([1])
        assert_series_equal(df2['A'], original)
        df2['A'].drop([1], inplace=True)
        assert_series_equal(df2['A'], original.drop([1]))

    def test_dropna_corner(self):
        # bad input
        pytest.raises(ValueError, self.frame.dropna, how='foo')
        pytest.raises(TypeError, self.frame.dropna, how=None)
        # non-existent column - 8303
        pytest.raises(KeyError, self.frame.dropna, subset=['A', 'X'])

    def test_dropna_multiple_axes(self):
        df = DataFrame([[1, np.nan, 2, 3],
                        [4, np.nan, 5, 6],
                        [np.nan, np.nan, np.nan, np.nan],
                        [7, np.nan, 8, 9]])
        cp = df.copy()
        result = df.dropna(how='all', axis=[0, 1])
        result2 = df.dropna(how='all', axis=(0, 1))
        expected = df.dropna(how='all').dropna(how='all', axis=1)

        assert_frame_equal(result, expected)
        assert_frame_equal(result2, expected)
        assert_frame_equal(df, cp)

        inp = df.copy()
        inp.dropna(how='all', axis=(0, 1), inplace=True)
        assert_frame_equal(inp, expected)

    def test_fillna(self):
        tf = self.tsframe
        tf.loc[tf.index[:5], 'A'] = nan
        tf.loc[tf.index[-5:], 'A'] = nan

        zero_filled = self.tsframe.fillna(0)
        assert (zero_filled.loc[zero_filled.index[:5], 'A'] == 0).all()

        padded = self.tsframe.fillna(method='pad')
        assert np.isnan(padded.loc[padded.index[:5], 'A']).all()
        assert (padded.loc[padded.index[-5:], 'A'] ==
                padded.loc[padded.index[-5], 'A']).all()

        # mixed type
        mf = self.mixed_frame
        mf.loc[mf.index[5:20], 'foo'] = nan
        mf.loc[mf.index[-10:], 'A'] = nan
        result = self.mixed_frame.fillna(value=0)
        result = self.mixed_frame.fillna(method='pad')

        pytest.raises(ValueError, self.tsframe.fillna)
        pytest.raises(ValueError, self.tsframe.fillna, 5, method='ffill')

        # mixed numeric (but no float16)
        mf = self.mixed_float.reindex(columns=['A', 'B', 'D'])
        mf.loc[mf.index[-10:], 'A'] = nan
        result = mf.fillna(value=0)
        _check_mixed_float(result, dtype=dict(C=None))

        result = mf.fillna(method='pad')
        _check_mixed_float(result, dtype=dict(C=None))

        # empty frame (GH #2778)
        df = DataFrame(columns=['x'])
        for m in ['pad', 'backfill']:
            df.x.fillna(method=m, inplace=True)
            df.x.fillna(method=m)

        # with different dtype (GH3386)
        df = DataFrame([['a', 'a', np.nan, 'a'], [
                       'b', 'b', np.nan, 'b'], ['c', 'c', np.nan, 'c']])

        result = df.fillna({2: 'foo'})
        expected = DataFrame([['a', 'a', 'foo', 'a'],
                              ['b', 'b', 'foo', 'b'],
                              ['c', 'c', 'foo', 'c']])
        assert_frame_equal(result, expected)

        df.fillna({2: 'foo'}, inplace=True)
        assert_frame_equal(df, expected)

        # limit and value
        df = DataFrame(np.random.randn(10, 3))
        df.iloc[2:7, 0] = np.nan
        df.iloc[3:5, 2] = np.nan

        expected = df.copy()
        expected.iloc[2, 0] = 999
        expected.iloc[3, 2] = 999
        result = df.fillna(999, limit=1)
        assert_frame_equal(result, expected)

        # with datelike
        # GH 6344
        df = DataFrame({
            'Date': [pd.NaT, Timestamp("2014-1-1")],
            'Date2': [Timestamp("2013-1-1"), pd.NaT]
        })

        expected = df.copy()
        expected['Date'] = expected['Date'].fillna(
            df.loc[df.index[0], 'Date2'])
        result = df.fillna(value={'Date': df['Date2']})
        assert_frame_equal(result, expected)

        # with timezone
        # GH 15855
        df = pd.DataFrame({'A': [pd.Timestamp('2012-11-11 00:00:00+01:00'),
                                 pd.NaT]})
        exp = pd.DataFrame({'A': [pd.Timestamp('2012-11-11 00:00:00+01:00'),
                                  pd.Timestamp('2012-11-11 00:00:00+01:00')]})
        assert_frame_equal(df.fillna(method='pad'), exp)

        df = pd.DataFrame({'A': [pd.NaT,
                                 pd.Timestamp('2012-11-11 00:00:00+01:00')]})
        exp = pd.DataFrame({'A': [pd.Timestamp('2012-11-11 00:00:00+01:00'),
                                  pd.Timestamp('2012-11-11 00:00:00+01:00')]})
        assert_frame_equal(df.fillna(method='bfill'), exp)

    def test_fillna_downcast(self):
        # GH 15277
        # infer int64 from float64
        df = pd.DataFrame({'a': [1., np.nan]})
        result = df.fillna(0, downcast='infer')
        expected = pd.DataFrame({'a': [1, 0]})
        assert_frame_equal(result, expected)

        # infer int64 from float64 when fillna value is a dict
        df = pd.DataFrame({'a': [1., np.nan]})
        result = df.fillna({'a': 0}, downcast='infer')
        expected = pd.DataFrame({'a': [1, 0]})
        assert_frame_equal(result, expected)

    def test_fillna_dtype_conversion(self):
        # make sure that fillna on an empty frame works
        df = DataFrame(index=["A", "B", "C"], columns=[1, 2, 3, 4, 5])
        result = df.get_dtype_counts().sort_values()
        expected = Series({'object': 5})
        assert_series_equal(result, expected)

        result = df.fillna(1)
        expected = DataFrame(1, index=["A", "B", "C"], columns=[1, 2, 3, 4, 5])
        result = result.get_dtype_counts().sort_values()
        expected = Series({'int64': 5})
        assert_series_equal(result, expected)

        # empty block
        df = DataFrame(index=lrange(3), columns=['A', 'B'], dtype='float64')
        result = df.fillna('nan')
        expected = DataFrame('nan', index=lrange(3), columns=['A', 'B'])
        assert_frame_equal(result, expected)

        # equiv of replace
        df = DataFrame(dict(A=[1, np.nan], B=[1., 2.]))
        for v in ['', 1, np.nan, 1.0]:
            expected = df.replace(np.nan, v)
            result = df.fillna(v)
            assert_frame_equal(result, expected)

    def test_fillna_datetime_columns(self):
        # GH 7095
        df = pd.DataFrame({'A': [-1, -2, np.nan],
                           'B': date_range('20130101', periods=3),
                           'C': ['foo', 'bar', None],
                           'D': ['foo2', 'bar2', None]},
                          index=date_range('20130110', periods=3))
        result = df.fillna('?')
        expected = pd.DataFrame({'A': [-1, -2, '?'],
                                 'B': date_range('20130101', periods=3),
                                 'C': ['foo', 'bar', '?'],
                                 'D': ['foo2', 'bar2', '?']},
                                index=date_range('20130110', periods=3))
        tm.assert_frame_equal(result, expected)

        df = pd.DataFrame({'A': [-1, -2, np.nan],
                           'B': [pd.Timestamp('2013-01-01'),
                                 pd.Timestamp('2013-01-02'), pd.NaT],
                           'C': ['foo', 'bar', None],
                           'D': ['foo2', 'bar2', None]},
                          index=date_range('20130110', periods=3))
        result = df.fillna('?')
        expected = pd.DataFrame({'A': [-1, -2, '?'],
                                 'B': [pd.Timestamp('2013-01-01'),
                                       pd.Timestamp('2013-01-02'), '?'],
                                 'C': ['foo', 'bar', '?'],
                                 'D': ['foo2', 'bar2', '?']},
                                index=pd.date_range('20130110', periods=3))
        tm.assert_frame_equal(result, expected)

    def test_ffill(self):
        self.tsframe['A'][:5] = nan
        self.tsframe['A'][-5:] = nan

        assert_frame_equal(self.tsframe.ffill(),
                           self.tsframe.fillna(method='ffill'))

    def test_bfill(self):
        self.tsframe['A'][:5] = nan
        self.tsframe['A'][-5:] = nan

        assert_frame_equal(self.tsframe.bfill(),
                           self.tsframe.fillna(method='bfill'))

    def test_frame_pad_backfill_limit(self):
        index = np.arange(10)
        df = DataFrame(np.random.randn(10, 4), index=index)

        result = df[:2].reindex(index, method='pad', limit=5)

        expected = df[:2].reindex(index).fillna(method='pad')
        expected.values[-3:] = np.nan
        tm.assert_frame_equal(result, expected)

        result = df[-2:].reindex(index, method='backfill', limit=5)

        expected = df[-2:].reindex(index).fillna(method='backfill')
        expected.values[:3] = np.nan
        tm.assert_frame_equal(result, expected)

    def test_frame_fillna_limit(self):
        index = np.arange(10)
        df = DataFrame(np.random.randn(10, 4), index=index)

        result = df[:2].reindex(index)
        result = result.fillna(method='pad', limit=5)

        expected = df[:2].reindex(index).fillna(method='pad')
        expected.values[-3:] = np.nan
        tm.assert_frame_equal(result, expected)

        result = df[-2:].reindex(index)
        result = result.fillna(method='backfill', limit=5)

        expected = df[-2:].reindex(index).fillna(method='backfill')
        expected.values[:3] = np.nan
        tm.assert_frame_equal(result, expected)

    def test_fillna_skip_certain_blocks(self):
        # don't try to fill boolean, int blocks

        df = DataFrame(np.random.randn(10, 4).astype(int))

        # it works!
        df.fillna(np.nan)

    def test_fillna_inplace(self):
        df = DataFrame(np.random.randn(10, 4))
        df[1][:4] = np.nan
        df[3][-4:] = np.nan

        expected = df.fillna(value=0)
        assert expected is not df

        df.fillna(value=0, inplace=True)
        tm.assert_frame_equal(df, expected)

        df[1][:4] = np.nan
        df[3][-4:] = np.nan
        expected = df.fillna(method='ffill')
        assert expected is not df

        df.fillna(method='ffill', inplace=True)
        tm.assert_frame_equal(df, expected)

    def test_fillna_dict_series(self):
        df = DataFrame({'a': [nan, 1, 2, nan, nan],
                        'b': [1, 2, 3, nan, nan],
                        'c': [nan, 1, 2, 3, 4]})

        result = df.fillna({'a': 0, 'b': 5})

        expected = df.copy()
        expected['a'] = expected['a'].fillna(0)
        expected['b'] = expected['b'].fillna(5)
        assert_frame_equal(result, expected)

        # it works
        result = df.fillna({'a': 0, 'b': 5, 'd': 7})

        # Series treated same as dict
        result = df.fillna(df.max())
        expected = df.fillna(df.max().to_dict())
        assert_frame_equal(result, expected)

        # disable this for now
        with tm.assert_raises_regex(NotImplementedError,
                                    'column by column'):
            df.fillna(df.max(1), axis=1)

    def test_fillna_dataframe(self):
        # GH 8377
        df = DataFrame({'a': [nan, 1, 2, nan, nan],
                        'b': [1, 2, 3, nan, nan],
                        'c': [nan, 1, 2, 3, 4]},
                       index=list('VWXYZ'))

        # df2 may have different index and columns
        df2 = DataFrame({'a': [nan, 10, 20, 30, 40],
                         'b': [50, 60, 70, 80, 90],
                         'foo': ['bar'] * 5},
                        index=list('VWXuZ'))

        result = df.fillna(df2)

        # only those columns and indices which are shared get filled
        expected = DataFrame({'a': [nan, 1, 2, nan, 40],
                              'b': [1, 2, 3, nan, 90],
                              'c': [nan, 1, 2, 3, 4]},
                             index=list('VWXYZ'))

        assert_frame_equal(result, expected)

    def test_fillna_columns(self):
        df = DataFrame(np.random.randn(10, 10))
        df.values[:, ::2] = np.nan

        result = df.fillna(method='ffill', axis=1)
        expected = df.T.fillna(method='pad').T
        assert_frame_equal(result, expected)

        df.insert(6, 'foo', 5)
        result = df.fillna(method='ffill', axis=1)
        expected = df.astype(float).fillna(method='ffill', axis=1)
        assert_frame_equal(result, expected)

    def test_fillna_invalid_method(self):
        with tm.assert_raises_regex(ValueError, 'ffil'):
            self.frame.fillna(method='ffil')

    def test_fillna_invalid_value(self):
        # list
        pytest.raises(TypeError, self.frame.fillna, [1, 2])
        # tuple
        pytest.raises(TypeError, self.frame.fillna, (1, 2))
        # frame with series
        pytest.raises(ValueError, self.frame.iloc[:, 0].fillna, self.frame)

    def test_fillna_col_reordering(self):
        cols = ["COL." + str(i) for i in range(5, 0, -1)]
        data = np.random.rand(20, 5)
        df = DataFrame(index=lrange(20), columns=cols, data=data)
        filled = df.fillna(method='ffill')
        assert df.columns.tolist() == filled.columns.tolist()

    def test_fill_corner(self):
        mf = self.mixed_frame
        mf.loc[mf.index[5:20], 'foo'] = nan
        mf.loc[mf.index[-10:], 'A'] = nan

        filled = self.mixed_frame.fillna(value=0)
        assert (filled.loc[filled.index[5:20], 'foo'] == 0).all()
        del self.mixed_frame['foo']

        empty_float = self.frame.reindex(columns=[])

        # TODO(wesm): unused?
        result = empty_float.fillna(value=0)  # noqa

    def test_fill_value_when_combine_const(self):
        # GH12723
        dat = np.array([0, 1, np.nan, 3, 4, 5], dtype='float')
        df = DataFrame({'foo': dat}, index=range(6))

        exp = df.fillna(0).add(2)
        res = df.add(2, fill_value=0)
        assert_frame_equal(res, exp)


class TestDataFrameInterpolate(TestData):

    def test_interp_basic(self):
        df = DataFrame({'A': [1, 2, np.nan, 4],
                        'B': [1, 4, 9, np.nan],
                        'C': [1, 2, 3, 5],
                        'D': list('abcd')})
        expected = DataFrame({'A': [1., 2., 3., 4.],
                              'B': [1., 4., 9., 9.],
                              'C': [1, 2, 3, 5],
                              'D': list('abcd')})
        result = df.interpolate()
        assert_frame_equal(result, expected)

        result = df.set_index('C').interpolate()
        expected = df.set_index('C')
        expected.loc[3, 'A'] = 3
        expected.loc[5, 'B'] = 9
        assert_frame_equal(result, expected)

    def test_interp_bad_method(self):
        df = DataFrame({'A': [1, 2, np.nan, 4],
                        'B': [1, 4, 9, np.nan],
                        'C': [1, 2, 3, 5],
                        'D': list('abcd')})
        with pytest.raises(ValueError):
            df.interpolate(method='not_a_method')

    def test_interp_combo(self):
        df = DataFrame({'A': [1., 2., np.nan, 4.],
                        'B': [1, 4, 9, np.nan],
                        'C': [1, 2, 3, 5],
                        'D': list('abcd')})

        result = df['A'].interpolate()
        expected = Series([1., 2., 3., 4.], name='A')
        assert_series_equal(result, expected)

        result = df['A'].interpolate(downcast='infer')
        expected = Series([1, 2, 3, 4], name='A')
        assert_series_equal(result, expected)

    def test_interp_nan_idx(self):
        df = DataFrame({'A': [1, 2, np.nan, 4], 'B': [np.nan, 2, 3, 4]})
        df = df.set_index('A')
        with pytest.raises(NotImplementedError):
            df.interpolate(method='values')

    def test_interp_various(self):
        tm._skip_if_no_scipy()

        df = DataFrame({'A': [1, 2, np.nan, 4, 5, np.nan, 7],
                        'C': [1, 2, 3, 5, 8, 13, 21]})
        df = df.set_index('C')
        expected = df.copy()
        result = df.interpolate(method='polynomial', order=1)

        expected.A.loc[3] = 2.66666667
        expected.A.loc[13] = 5.76923076
        assert_frame_equal(result, expected)

        result = df.interpolate(method='cubic')
        # GH #15662.
        # new cubic and quadratic interpolation algorithms from scipy 0.19.0.
        # previously `splmake` was used. See scipy/scipy#6710
        if _is_scipy_ge_0190:
            expected.A.loc[3] = 2.81547781
            expected.A.loc[13] = 5.52964175
        else:
            expected.A.loc[3] = 2.81621174
            expected.A.loc[13] = 5.64146581
        assert_frame_equal(result, expected)

        result = df.interpolate(method='nearest')
        expected.A.loc[3] = 2
        expected.A.loc[13] = 5
        assert_frame_equal(result, expected, check_dtype=False)

        result = df.interpolate(method='quadratic')
        if _is_scipy_ge_0190:
            expected.A.loc[3] = 2.82150771
            expected.A.loc[13] = 6.12648668
        else:
            expected.A.loc[3] = 2.82533638
            expected.A.loc[13] = 6.02817974
        assert_frame_equal(result, expected)

        result = df.interpolate(method='slinear')
        expected.A.loc[3] = 2.66666667
        expected.A.loc[13] = 5.76923077
        assert_frame_equal(result, expected)

        result = df.interpolate(method='zero')
        expected.A.loc[3] = 2.
        expected.A.loc[13] = 5
        assert_frame_equal(result, expected, check_dtype=False)

    def test_interp_alt_scipy(self):
        tm._skip_if_no_scipy()
        df = DataFrame({'A': [1, 2, np.nan, 4, 5, np.nan, 7],
                        'C': [1, 2, 3, 5, 8, 13, 21]})
        result = df.interpolate(method='barycentric')
        expected = df.copy()
        expected.loc[2, 'A'] = 3
        expected.loc[5, 'A'] = 6
        assert_frame_equal(result, expected)

        result = df.interpolate(method='barycentric', downcast='infer')
        assert_frame_equal(result, expected.astype(np.int64))

        result = df.interpolate(method='krogh')
        expectedk = df.copy()
        expectedk['A'] = expected['A']
        assert_frame_equal(result, expectedk)

        _skip_if_no_pchip()
        import scipy
        result = df.interpolate(method='pchip')
        expected.loc[2, 'A'] = 3

        if LooseVersion(scipy.__version__) >= '0.17.0':
            expected.loc[5, 'A'] = 6.0
        else:
            expected.loc[5, 'A'] = 6.125

        assert_frame_equal(result, expected)

    def test_interp_rowwise(self):
        df = DataFrame({0: [1, 2, np.nan, 4],
                        1: [2, 3, 4, np.nan],
                        2: [np.nan, 4, 5, 6],
                        3: [4, np.nan, 6, 7],
                        4: [1, 2, 3, 4]})
        result = df.interpolate(axis=1)
        expected = df.copy()
        expected.loc[3, 1] = 5
        expected.loc[0, 2] = 3
        expected.loc[1, 3] = 3
        expected[4] = expected[4].astype(np.float64)
        assert_frame_equal(result, expected)

        # scipy route
        tm._skip_if_no_scipy()
        result = df.interpolate(axis=1, method='values')
        assert_frame_equal(result, expected)

        result = df.interpolate(axis=0)
        expected = df.interpolate()
        assert_frame_equal(result, expected)

    def test_rowwise_alt(self):
        df = DataFrame({0: [0, .5, 1., np.nan, 4, 8, np.nan, np.nan, 64],
                        1: [1, 2, 3, 4, 3, 2, 1, 0, -1]})
        df.interpolate(axis=0)

    def test_interp_leading_nans(self):
        df = DataFrame({"A": [np.nan, np.nan, .5, .25, 0],
                        "B": [np.nan, -3, -3.5, np.nan, -4]})
        result = df.interpolate()
        expected = df.copy()
        expected['B'].loc[3] = -3.75
        assert_frame_equal(result, expected)

        tm._skip_if_no_scipy()
        result = df.interpolate(method='polynomial', order=1)
        assert_frame_equal(result, expected)

    def test_interp_raise_on_only_mixed(self):
        df = DataFrame({'A': [1, 2, np.nan, 4],
                        'B': ['a', 'b', 'c', 'd'],
                        'C': [np.nan, 2, 5, 7],
                        'D': [np.nan, np.nan, 9, 9],
                        'E': [1, 2, 3, 4]})
        with pytest.raises(TypeError):
            df.interpolate(axis=1)

    def test_interp_inplace(self):
        df = DataFrame({'a': [1., 2., np.nan, 4.]})
        expected = DataFrame({'a': [1., 2., 3., 4.]})
        result = df.copy()
        result['a'].interpolate(inplace=True)
        assert_frame_equal(result, expected)

        result = df.copy()
        result['a'].interpolate(inplace=True, downcast='infer')
        assert_frame_equal(result, expected.astype('int64'))

    def test_interp_inplace_row(self):
        # GH 10395
        result = DataFrame({'a': [1., 2., 3., 4.],
                            'b': [np.nan, 2., 3., 4.],
                            'c': [3, 2, 2, 2]})
        expected = result.interpolate(method='linear', axis=1, inplace=False)
        result.interpolate(method='linear', axis=1, inplace=True)
        assert_frame_equal(result, expected)

    def test_interp_ignore_all_good(self):
        # GH
        df = DataFrame({'A': [1, 2, np.nan, 4],
                        'B': [1, 2, 3, 4],
                        'C': [1., 2., np.nan, 4.],
                        'D': [1., 2., 3., 4.]})
        expected = DataFrame({'A': np.array(
            [1, 2, 3, 4], dtype='float64'),
            'B': np.array(
            [1, 2, 3, 4], dtype='int64'),
            'C': np.array(
            [1., 2., 3, 4.], dtype='float64'),
            'D': np.array(
            [1., 2., 3., 4.], dtype='float64')})

        result = df.interpolate(downcast=None)
        assert_frame_equal(result, expected)

        # all good
        result = df[['B', 'D']].interpolate(downcast=None)
        assert_frame_equal(result, df[['B', 'D']])
