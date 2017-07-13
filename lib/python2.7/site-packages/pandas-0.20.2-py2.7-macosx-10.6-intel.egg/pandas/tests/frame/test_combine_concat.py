# -*- coding: utf-8 -*-

from __future__ import print_function

from datetime import datetime

import numpy as np
from numpy import nan

import pandas as pd

from pandas import DataFrame, Index, Series, Timestamp, date_range
from pandas.compat import lrange

from pandas.tests.frame.common import TestData

import pandas.util.testing as tm
from pandas.util.testing import assert_frame_equal, assert_series_equal


class TestDataFrameConcatCommon(TestData):

    def test_concat_multiple_frames_dtypes(self):

        # GH 2759
        A = DataFrame(data=np.ones((10, 2)), columns=[
                      'foo', 'bar'], dtype=np.float64)
        B = DataFrame(data=np.ones((10, 2)), dtype=np.float32)
        results = pd.concat((A, B), axis=1).get_dtype_counts()
        expected = Series(dict(float64=2, float32=2))
        assert_series_equal(results, expected)

    def test_concat_multiple_tzs(self):
        # GH 12467
        # combining datetime tz-aware and naive DataFrames
        ts1 = Timestamp('2015-01-01', tz=None)
        ts2 = Timestamp('2015-01-01', tz='UTC')
        ts3 = Timestamp('2015-01-01', tz='EST')

        df1 = DataFrame(dict(time=[ts1]))
        df2 = DataFrame(dict(time=[ts2]))
        df3 = DataFrame(dict(time=[ts3]))

        results = pd.concat([df1, df2]).reset_index(drop=True)
        expected = DataFrame(dict(time=[ts1, ts2]), dtype=object)
        assert_frame_equal(results, expected)

        results = pd.concat([df1, df3]).reset_index(drop=True)
        expected = DataFrame(dict(time=[ts1, ts3]), dtype=object)
        assert_frame_equal(results, expected)

        results = pd.concat([df2, df3]).reset_index(drop=True)
        expected = DataFrame(dict(time=[ts2, ts3]))
        assert_frame_equal(results, expected)

    def test_concat_tuple_keys(self):
        # GH 14438
        df1 = pd.DataFrame(np.ones((2, 2)), columns=list('AB'))
        df2 = pd.DataFrame(np.ones((3, 2)) * 2, columns=list('AB'))
        results = pd.concat((df1, df2), keys=[('bee', 'bah'), ('bee', 'boo')])
        expected = pd.DataFrame(
            {'A': {('bee', 'bah', 0): 1.0,
                   ('bee', 'bah', 1): 1.0,
                   ('bee', 'boo', 0): 2.0,
                   ('bee', 'boo', 1): 2.0,
                   ('bee', 'boo', 2): 2.0},
             'B': {('bee', 'bah', 0): 1.0,
                   ('bee', 'bah', 1): 1.0,
                   ('bee', 'boo', 0): 2.0,
                   ('bee', 'boo', 1): 2.0,
                   ('bee', 'boo', 2): 2.0}})
        assert_frame_equal(results, expected)

    def test_append_series_dict(self):
        df = DataFrame(np.random.randn(5, 4),
                       columns=['foo', 'bar', 'baz', 'qux'])

        series = df.loc[4]
        with tm.assert_raises_regex(ValueError,
                                    'Indexes have overlapping values'):
            df.append(series, verify_integrity=True)
        series.name = None
        with tm.assert_raises_regex(TypeError,
                                    'Can only append a Series if '
                                    'ignore_index=True'):
            df.append(series, verify_integrity=True)

        result = df.append(series[::-1], ignore_index=True)
        expected = df.append(DataFrame({0: series[::-1]}, index=df.columns).T,
                             ignore_index=True)
        assert_frame_equal(result, expected)

        # dict
        result = df.append(series.to_dict(), ignore_index=True)
        assert_frame_equal(result, expected)

        result = df.append(series[::-1][:3], ignore_index=True)
        expected = df.append(DataFrame({0: series[::-1][:3]}).T,
                             ignore_index=True)
        assert_frame_equal(result, expected.loc[:, result.columns])

        # can append when name set
        row = df.loc[4]
        row.name = 5
        result = df.append(row)
        expected = df.append(df[-1:], ignore_index=True)
        assert_frame_equal(result, expected)

    def test_append_list_of_series_dicts(self):
        df = DataFrame(np.random.randn(5, 4),
                       columns=['foo', 'bar', 'baz', 'qux'])

        dicts = [x.to_dict() for idx, x in df.iterrows()]

        result = df.append(dicts, ignore_index=True)
        expected = df.append(df, ignore_index=True)
        assert_frame_equal(result, expected)

        # different columns
        dicts = [{'foo': 1, 'bar': 2, 'baz': 3, 'peekaboo': 4},
                 {'foo': 5, 'bar': 6, 'baz': 7, 'peekaboo': 8}]
        result = df.append(dicts, ignore_index=True)
        expected = df.append(DataFrame(dicts), ignore_index=True)
        assert_frame_equal(result, expected)

    def test_append_empty_dataframe(self):

        # Empty df append empty df
        df1 = DataFrame([])
        df2 = DataFrame([])
        result = df1.append(df2)
        expected = df1.copy()
        assert_frame_equal(result, expected)

        # Non-empty df append empty df
        df1 = DataFrame(np.random.randn(5, 2))
        df2 = DataFrame()
        result = df1.append(df2)
        expected = df1.copy()
        assert_frame_equal(result, expected)

        # Empty df with columns append empty df
        df1 = DataFrame(columns=['bar', 'foo'])
        df2 = DataFrame()
        result = df1.append(df2)
        expected = df1.copy()
        assert_frame_equal(result, expected)

        # Non-Empty df with columns append empty df
        df1 = DataFrame(np.random.randn(5, 2), columns=['bar', 'foo'])
        df2 = DataFrame()
        result = df1.append(df2)
        expected = df1.copy()
        assert_frame_equal(result, expected)

    def test_append_dtypes(self):

        # GH 5754
        # row appends of different dtypes (so need to do by-item)
        # can sometimes infer the correct type

        df1 = DataFrame({'bar': Timestamp('20130101')}, index=lrange(5))
        df2 = DataFrame()
        result = df1.append(df2)
        expected = df1.copy()
        assert_frame_equal(result, expected)

        df1 = DataFrame({'bar': Timestamp('20130101')}, index=lrange(1))
        df2 = DataFrame({'bar': 'foo'}, index=lrange(1, 2))
        result = df1.append(df2)
        expected = DataFrame({'bar': [Timestamp('20130101'), 'foo']})
        assert_frame_equal(result, expected)

        df1 = DataFrame({'bar': Timestamp('20130101')}, index=lrange(1))
        df2 = DataFrame({'bar': np.nan}, index=lrange(1, 2))
        result = df1.append(df2)
        expected = DataFrame(
            {'bar': Series([Timestamp('20130101'), np.nan], dtype='M8[ns]')})
        assert_frame_equal(result, expected)

        df1 = DataFrame({'bar': Timestamp('20130101')}, index=lrange(1))
        df2 = DataFrame({'bar': np.nan}, index=lrange(1, 2), dtype=object)
        result = df1.append(df2)
        expected = DataFrame(
            {'bar': Series([Timestamp('20130101'), np.nan], dtype='M8[ns]')})
        assert_frame_equal(result, expected)

        df1 = DataFrame({'bar': np.nan}, index=lrange(1))
        df2 = DataFrame({'bar': Timestamp('20130101')}, index=lrange(1, 2))
        result = df1.append(df2)
        expected = DataFrame(
            {'bar': Series([np.nan, Timestamp('20130101')], dtype='M8[ns]')})
        assert_frame_equal(result, expected)

        df1 = DataFrame({'bar': Timestamp('20130101')}, index=lrange(1))
        df2 = DataFrame({'bar': 1}, index=lrange(1, 2), dtype=object)
        result = df1.append(df2)
        expected = DataFrame({'bar': Series([Timestamp('20130101'), 1])})
        assert_frame_equal(result, expected)

    def test_update(self):
        df = DataFrame([[1.5, nan, 3.],
                        [1.5, nan, 3.],
                        [1.5, nan, 3],
                        [1.5, nan, 3]])

        other = DataFrame([[3.6, 2., np.nan],
                           [np.nan, np.nan, 7]], index=[1, 3])

        df.update(other)

        expected = DataFrame([[1.5, nan, 3],
                              [3.6, 2, 3],
                              [1.5, nan, 3],
                              [1.5, nan, 7.]])
        assert_frame_equal(df, expected)

    def test_update_dtypes(self):

        # gh 3016
        df = DataFrame([[1., 2., False, True], [4., 5., True, False]],
                       columns=['A', 'B', 'bool1', 'bool2'])

        other = DataFrame([[45, 45]], index=[0], columns=['A', 'B'])
        df.update(other)

        expected = DataFrame([[45., 45., False, True], [4., 5., True, False]],
                             columns=['A', 'B', 'bool1', 'bool2'])
        assert_frame_equal(df, expected)

    def test_update_nooverwrite(self):
        df = DataFrame([[1.5, nan, 3.],
                        [1.5, nan, 3.],
                        [1.5, nan, 3],
                        [1.5, nan, 3]])

        other = DataFrame([[3.6, 2., np.nan],
                           [np.nan, np.nan, 7]], index=[1, 3])

        df.update(other, overwrite=False)

        expected = DataFrame([[1.5, nan, 3],
                              [1.5, 2, 3],
                              [1.5, nan, 3],
                              [1.5, nan, 3.]])
        assert_frame_equal(df, expected)

    def test_update_filtered(self):
        df = DataFrame([[1.5, nan, 3.],
                        [1.5, nan, 3.],
                        [1.5, nan, 3],
                        [1.5, nan, 3]])

        other = DataFrame([[3.6, 2., np.nan],
                           [np.nan, np.nan, 7]], index=[1, 3])

        df.update(other, filter_func=lambda x: x > 2)

        expected = DataFrame([[1.5, nan, 3],
                              [1.5, nan, 3],
                              [1.5, nan, 3],
                              [1.5, nan, 7.]])
        assert_frame_equal(df, expected)

    def test_update_raise(self):
        df = DataFrame([[1.5, 1, 3.],
                        [1.5, nan, 3.],
                        [1.5, nan, 3],
                        [1.5, nan, 3]])

        other = DataFrame([[2., nan],
                           [nan, 7]], index=[1, 3], columns=[1, 2])
        with tm.assert_raises_regex(ValueError, "Data overlaps"):
            df.update(other, raise_conflict=True)

    def test_update_from_non_df(self):
        d = {'a': Series([1, 2, 3, 4]), 'b': Series([5, 6, 7, 8])}
        df = DataFrame(d)

        d['a'] = Series([5, 6, 7, 8])
        df.update(d)

        expected = DataFrame(d)

        assert_frame_equal(df, expected)

        d = {'a': [1, 2, 3, 4], 'b': [5, 6, 7, 8]}
        df = DataFrame(d)

        d['a'] = [5, 6, 7, 8]
        df.update(d)

        expected = DataFrame(d)

        assert_frame_equal(df, expected)

    def test_join_str_datetime(self):
        str_dates = ['20120209', '20120222']
        dt_dates = [datetime(2012, 2, 9), datetime(2012, 2, 22)]

        A = DataFrame(str_dates, index=lrange(2), columns=['aa'])
        C = DataFrame([[1, 2], [3, 4]], index=str_dates, columns=dt_dates)

        tst = A.join(C, on='aa')

        assert len(tst.columns) == 3

    def test_join_multiindex_leftright(self):
        # GH 10741
        df1 = (pd.DataFrame([['a', 'x', 0.471780], ['a', 'y', 0.774908],
                             ['a', 'z', 0.563634], ['b', 'x', -0.353756],
                             ['b', 'y', 0.368062], ['b', 'z', -1.721840],
                             ['c', 'x', 1], ['c', 'y', 2], ['c', 'z', 3]],
                            columns=['first', 'second', 'value1'])
               .set_index(['first', 'second']))

        df2 = (pd.DataFrame([['a', 10], ['b', 20]],
                            columns=['first', 'value2'])
               .set_index(['first']))

        exp = pd.DataFrame([[0.471780, 10], [0.774908, 10], [0.563634, 10],
                            [-0.353756, 20], [0.368062, 20],
                            [-1.721840, 20],
                            [1.000000, np.nan], [2.000000, np.nan],
                            [3.000000, np.nan]],
                           index=df1.index, columns=['value1', 'value2'])

        # these must be the same results (but columns are flipped)
        assert_frame_equal(df1.join(df2, how='left'), exp)
        assert_frame_equal(df2.join(df1, how='right'),
                           exp[['value2', 'value1']])

        exp_idx = pd.MultiIndex.from_product([['a', 'b'], ['x', 'y', 'z']],
                                             names=['first', 'second'])
        exp = pd.DataFrame([[0.471780, 10], [0.774908, 10], [0.563634, 10],
                            [-0.353756, 20], [0.368062, 20], [-1.721840, 20]],
                           index=exp_idx, columns=['value1', 'value2'])

        assert_frame_equal(df1.join(df2, how='right'), exp)
        assert_frame_equal(df2.join(df1, how='left'),
                           exp[['value2', 'value1']])

    def test_concat_named_keys(self):
        # GH 14252
        df = pd.DataFrame({'foo': [1, 2], 'bar': [0.1, 0.2]})
        index = Index(['a', 'b'], name='baz')
        concatted_named_from_keys = pd.concat([df, df], keys=index)
        expected_named = pd.DataFrame(
            {'foo': [1, 2, 1, 2], 'bar': [0.1, 0.2, 0.1, 0.2]},
            index=pd.MultiIndex.from_product((['a', 'b'], [0, 1]),
                                             names=['baz', None]))
        assert_frame_equal(concatted_named_from_keys, expected_named)

        index_no_name = Index(['a', 'b'], name=None)
        concatted_named_from_names = pd.concat(
            [df, df], keys=index_no_name, names=['baz'])
        assert_frame_equal(concatted_named_from_names, expected_named)

        concatted_unnamed = pd.concat([df, df], keys=index_no_name)
        expected_unnamed = pd.DataFrame(
            {'foo': [1, 2, 1, 2], 'bar': [0.1, 0.2, 0.1, 0.2]},
            index=pd.MultiIndex.from_product((['a', 'b'], [0, 1]),
                                             names=[None, None]))
        assert_frame_equal(concatted_unnamed, expected_unnamed)

    def test_concat_axis_parameter(self):
        # GH 14369
        df1 = pd.DataFrame({'A': [0.1, 0.2]}, index=range(2))
        df2 = pd.DataFrame({'A': [0.3, 0.4]}, index=range(2))

        # Index/row/0 DataFrame
        expected_index = pd.DataFrame(
            {'A': [0.1, 0.2, 0.3, 0.4]}, index=[0, 1, 0, 1])

        concatted_index = pd.concat([df1, df2], axis='index')
        assert_frame_equal(concatted_index, expected_index)

        concatted_row = pd.concat([df1, df2], axis='rows')
        assert_frame_equal(concatted_row, expected_index)

        concatted_0 = pd.concat([df1, df2], axis=0)
        assert_frame_equal(concatted_0, expected_index)

        # Columns/1 DataFrame
        expected_columns = pd.DataFrame(
            [[0.1, 0.3], [0.2, 0.4]], index=[0, 1], columns=['A', 'A'])

        concatted_columns = pd.concat([df1, df2], axis='columns')
        assert_frame_equal(concatted_columns, expected_columns)

        concatted_1 = pd.concat([df1, df2], axis=1)
        assert_frame_equal(concatted_1, expected_columns)

        series1 = pd.Series([0.1, 0.2])
        series2 = pd.Series([0.3, 0.4])

        # Index/row/0 Series
        expected_index_series = pd.Series(
            [0.1, 0.2, 0.3, 0.4], index=[0, 1, 0, 1])

        concatted_index_series = pd.concat([series1, series2], axis='index')
        assert_series_equal(concatted_index_series, expected_index_series)

        concatted_row_series = pd.concat([series1, series2], axis='rows')
        assert_series_equal(concatted_row_series, expected_index_series)

        concatted_0_series = pd.concat([series1, series2], axis=0)
        assert_series_equal(concatted_0_series, expected_index_series)

        # Columns/1 Series
        expected_columns_series = pd.DataFrame(
            [[0.1, 0.3], [0.2, 0.4]], index=[0, 1], columns=[0, 1])

        concatted_columns_series = pd.concat(
            [series1, series2], axis='columns')
        assert_frame_equal(concatted_columns_series, expected_columns_series)

        concatted_1_series = pd.concat([series1, series2], axis=1)
        assert_frame_equal(concatted_1_series, expected_columns_series)

        # Testing ValueError
        with tm.assert_raises_regex(ValueError, 'No axis named'):
            pd.concat([series1, series2], axis='something')

    def test_concat_numerical_names(self):
        # #15262  # #12223
        df = pd.DataFrame({'col': range(9)},
                          dtype='int32',
                          index=(pd.MultiIndex
                                 .from_product([['A0', 'A1', 'A2'],
                                                ['B0', 'B1', 'B2']],
                                               names=[1, 2])))
        result = pd.concat((df.iloc[:2, :], df.iloc[-2:, :]))
        expected = pd.DataFrame({'col': [0, 1, 7, 8]},
                                dtype='int32',
                                index=pd.MultiIndex.from_tuples([('A0', 'B0'),
                                                                 ('A0', 'B1'),
                                                                 ('A2', 'B1'),
                                                                 ('A2', 'B2')],
                                                                names=[1, 2]))
        tm.assert_frame_equal(result, expected)


class TestDataFrameCombineFirst(TestData):

    def test_combine_first_mixed(self):
        a = Series(['a', 'b'], index=lrange(2))
        b = Series(lrange(2), index=lrange(2))
        f = DataFrame({'A': a, 'B': b})

        a = Series(['a', 'b'], index=lrange(5, 7))
        b = Series(lrange(2), index=lrange(5, 7))
        g = DataFrame({'A': a, 'B': b})

        exp = pd.DataFrame({'A': list('abab'), 'B': [0., 1., 0., 1.]},
                           index=[0, 1, 5, 6])
        combined = f.combine_first(g)
        tm.assert_frame_equal(combined, exp)

    def test_combine_first(self):
        # disjoint
        head, tail = self.frame[:5], self.frame[5:]

        combined = head.combine_first(tail)
        reordered_frame = self.frame.reindex(combined.index)
        assert_frame_equal(combined, reordered_frame)
        assert tm.equalContents(combined.columns, self.frame.columns)
        assert_series_equal(combined['A'], reordered_frame['A'])

        # same index
        fcopy = self.frame.copy()
        fcopy['A'] = 1
        del fcopy['C']

        fcopy2 = self.frame.copy()
        fcopy2['B'] = 0
        del fcopy2['D']

        combined = fcopy.combine_first(fcopy2)

        assert (combined['A'] == 1).all()
        assert_series_equal(combined['B'], fcopy['B'])
        assert_series_equal(combined['C'], fcopy2['C'])
        assert_series_equal(combined['D'], fcopy['D'])

        # overlap
        head, tail = reordered_frame[:10].copy(), reordered_frame
        head['A'] = 1

        combined = head.combine_first(tail)
        assert (combined['A'][:10] == 1).all()

        # reverse overlap
        tail['A'][:10] = 0
        combined = tail.combine_first(head)
        assert (combined['A'][:10] == 0).all()

        # no overlap
        f = self.frame[:10]
        g = self.frame[10:]
        combined = f.combine_first(g)
        assert_series_equal(combined['A'].reindex(f.index), f['A'])
        assert_series_equal(combined['A'].reindex(g.index), g['A'])

        # corner cases
        comb = self.frame.combine_first(self.empty)
        assert_frame_equal(comb, self.frame)

        comb = self.empty.combine_first(self.frame)
        assert_frame_equal(comb, self.frame)

        comb = self.frame.combine_first(DataFrame(index=["faz", "boo"]))
        assert "faz" in comb.index

        # #2525
        df = DataFrame({'a': [1]}, index=[datetime(2012, 1, 1)])
        df2 = DataFrame({}, columns=['b'])
        result = df.combine_first(df2)
        assert 'b' in result

    def test_combine_first_mixed_bug(self):
        idx = Index(['a', 'b', 'c', 'e'])
        ser1 = Series([5.0, -9.0, 4.0, 100.], index=idx)
        ser2 = Series(['a', 'b', 'c', 'e'], index=idx)
        ser3 = Series([12, 4, 5, 97], index=idx)

        frame1 = DataFrame({"col0": ser1,
                            "col2": ser2,
                            "col3": ser3})

        idx = Index(['a', 'b', 'c', 'f'])
        ser1 = Series([5.0, -9.0, 4.0, 100.], index=idx)
        ser2 = Series(['a', 'b', 'c', 'f'], index=idx)
        ser3 = Series([12, 4, 5, 97], index=idx)

        frame2 = DataFrame({"col1": ser1,
                            "col2": ser2,
                            "col5": ser3})

        combined = frame1.combine_first(frame2)
        assert len(combined.columns) == 5

        # gh 3016 (same as in update)
        df = DataFrame([[1., 2., False, True], [4., 5., True, False]],
                       columns=['A', 'B', 'bool1', 'bool2'])

        other = DataFrame([[45, 45]], index=[0], columns=['A', 'B'])
        result = df.combine_first(other)
        assert_frame_equal(result, df)

        df.loc[0, 'A'] = np.nan
        result = df.combine_first(other)
        df.loc[0, 'A'] = 45
        assert_frame_equal(result, df)

        # doc example
        df1 = DataFrame({'A': [1., np.nan, 3., 5., np.nan],
                         'B': [np.nan, 2., 3., np.nan, 6.]})

        df2 = DataFrame({'A': [5., 2., 4., np.nan, 3., 7.],
                         'B': [np.nan, np.nan, 3., 4., 6., 8.]})

        result = df1.combine_first(df2)
        expected = DataFrame(
            {'A': [1, 2, 3, 5, 3, 7.], 'B': [np.nan, 2, 3, 4, 6, 8]})
        assert_frame_equal(result, expected)

        # GH3552, return object dtype with bools
        df1 = DataFrame(
            [[np.nan, 3., True], [-4.6, np.nan, True], [np.nan, 7., False]])
        df2 = DataFrame(
            [[-42.6, np.nan, True], [-5., 1.6, False]], index=[1, 2])

        result = df1.combine_first(df2)[2]
        expected = Series([True, True, False], name=2)
        assert_series_equal(result, expected)

        # GH 3593, converting datetime64[ns] incorrecly
        df0 = DataFrame({"a": [datetime(2000, 1, 1),
                               datetime(2000, 1, 2),
                               datetime(2000, 1, 3)]})
        df1 = DataFrame({"a": [None, None, None]})
        df2 = df1.combine_first(df0)
        assert_frame_equal(df2, df0)

        df2 = df0.combine_first(df1)
        assert_frame_equal(df2, df0)

        df0 = DataFrame({"a": [datetime(2000, 1, 1),
                               datetime(2000, 1, 2),
                               datetime(2000, 1, 3)]})
        df1 = DataFrame({"a": [datetime(2000, 1, 2), None, None]})
        df2 = df1.combine_first(df0)
        result = df0.copy()
        result.iloc[0, :] = df1.iloc[0, :]
        assert_frame_equal(df2, result)

        df2 = df0.combine_first(df1)
        assert_frame_equal(df2, df0)

    def test_combine_first_align_nan(self):
        # GH 7509 (not fixed)
        dfa = pd.DataFrame([[pd.Timestamp('2011-01-01'), 2]],
                           columns=['a', 'b'])
        dfb = pd.DataFrame([[4], [5]], columns=['b'])
        assert dfa['a'].dtype == 'datetime64[ns]'
        assert dfa['b'].dtype == 'int64'

        res = dfa.combine_first(dfb)
        exp = pd.DataFrame({'a': [pd.Timestamp('2011-01-01'), pd.NaT],
                            'b': [2., 5.]}, columns=['a', 'b'])
        tm.assert_frame_equal(res, exp)
        assert res['a'].dtype == 'datetime64[ns]'
        # ToDo: this must be int64
        assert res['b'].dtype == 'float64'

        res = dfa.iloc[:0].combine_first(dfb)
        exp = pd.DataFrame({'a': [np.nan, np.nan],
                            'b': [4, 5]}, columns=['a', 'b'])
        tm.assert_frame_equal(res, exp)
        # ToDo: this must be datetime64
        assert res['a'].dtype == 'float64'
        # ToDo: this must be int64
        assert res['b'].dtype == 'int64'

    def test_combine_first_timezone(self):
        # see gh-7630
        data1 = pd.to_datetime('20100101 01:01').tz_localize('UTC')
        df1 = pd.DataFrame(columns=['UTCdatetime', 'abc'],
                           data=data1,
                           index=pd.date_range('20140627', periods=1))
        data2 = pd.to_datetime('20121212 12:12').tz_localize('UTC')
        df2 = pd.DataFrame(columns=['UTCdatetime', 'xyz'],
                           data=data2,
                           index=pd.date_range('20140628', periods=1))
        res = df2[['UTCdatetime']].combine_first(df1)
        exp = pd.DataFrame({'UTCdatetime': [pd.Timestamp('2010-01-01 01:01',
                                                         tz='UTC'),
                                            pd.Timestamp('2012-12-12 12:12',
                                                         tz='UTC')],
                            'abc': [pd.Timestamp('2010-01-01 01:01:00',
                                                 tz='UTC'), pd.NaT]},
                           columns=['UTCdatetime', 'abc'],
                           index=pd.date_range('20140627', periods=2,
                                               freq='D'))
        tm.assert_frame_equal(res, exp)
        assert res['UTCdatetime'].dtype == 'datetime64[ns, UTC]'
        assert res['abc'].dtype == 'datetime64[ns, UTC]'

        # see gh-10567
        dts1 = pd.date_range('2015-01-01', '2015-01-05', tz='UTC')
        df1 = pd.DataFrame({'DATE': dts1})
        dts2 = pd.date_range('2015-01-03', '2015-01-05', tz='UTC')
        df2 = pd.DataFrame({'DATE': dts2})

        res = df1.combine_first(df2)
        tm.assert_frame_equal(res, df1)
        assert res['DATE'].dtype == 'datetime64[ns, UTC]'

        dts1 = pd.DatetimeIndex(['2011-01-01', 'NaT', '2011-01-03',
                                 '2011-01-04'], tz='US/Eastern')
        df1 = pd.DataFrame({'DATE': dts1}, index=[1, 3, 5, 7])
        dts2 = pd.DatetimeIndex(['2012-01-01', '2012-01-02',
                                 '2012-01-03'], tz='US/Eastern')
        df2 = pd.DataFrame({'DATE': dts2}, index=[2, 4, 5])

        res = df1.combine_first(df2)
        exp_dts = pd.DatetimeIndex(['2011-01-01', '2012-01-01', 'NaT',
                                    '2012-01-02', '2011-01-03', '2011-01-04'],
                                   tz='US/Eastern')
        exp = pd.DataFrame({'DATE': exp_dts}, index=[1, 2, 3, 4, 5, 7])
        tm.assert_frame_equal(res, exp)

        # different tz
        dts1 = pd.date_range('2015-01-01', '2015-01-05', tz='US/Eastern')
        df1 = pd.DataFrame({'DATE': dts1})
        dts2 = pd.date_range('2015-01-03', '2015-01-05')
        df2 = pd.DataFrame({'DATE': dts2})

        # if df1 doesn't have NaN, keep its dtype
        res = df1.combine_first(df2)
        tm.assert_frame_equal(res, df1)
        assert res['DATE'].dtype == 'datetime64[ns, US/Eastern]'

        dts1 = pd.date_range('2015-01-01', '2015-01-02', tz='US/Eastern')
        df1 = pd.DataFrame({'DATE': dts1})
        dts2 = pd.date_range('2015-01-01', '2015-01-03')
        df2 = pd.DataFrame({'DATE': dts2})

        res = df1.combine_first(df2)
        exp_dts = [pd.Timestamp('2015-01-01', tz='US/Eastern'),
                   pd.Timestamp('2015-01-02', tz='US/Eastern'),
                   pd.Timestamp('2015-01-03')]
        exp = pd.DataFrame({'DATE': exp_dts})
        tm.assert_frame_equal(res, exp)
        assert res['DATE'].dtype == 'object'

    def test_combine_first_timedelta(self):
        data1 = pd.TimedeltaIndex(['1 day', 'NaT', '3 day', '4day'])
        df1 = pd.DataFrame({'TD': data1}, index=[1, 3, 5, 7])
        data2 = pd.TimedeltaIndex(['10 day', '11 day', '12 day'])
        df2 = pd.DataFrame({'TD': data2}, index=[2, 4, 5])

        res = df1.combine_first(df2)
        exp_dts = pd.TimedeltaIndex(['1 day', '10 day', 'NaT',
                                     '11 day', '3 day', '4 day'])
        exp = pd.DataFrame({'TD': exp_dts}, index=[1, 2, 3, 4, 5, 7])
        tm.assert_frame_equal(res, exp)
        assert res['TD'].dtype == 'timedelta64[ns]'

    def test_combine_first_period(self):
        data1 = pd.PeriodIndex(['2011-01', 'NaT', '2011-03',
                                '2011-04'], freq='M')
        df1 = pd.DataFrame({'P': data1}, index=[1, 3, 5, 7])
        data2 = pd.PeriodIndex(['2012-01-01', '2012-02',
                                '2012-03'], freq='M')
        df2 = pd.DataFrame({'P': data2}, index=[2, 4, 5])

        res = df1.combine_first(df2)
        exp_dts = pd.PeriodIndex(['2011-01', '2012-01', 'NaT',
                                  '2012-02', '2011-03', '2011-04'],
                                 freq='M')
        exp = pd.DataFrame({'P': exp_dts}, index=[1, 2, 3, 4, 5, 7])
        tm.assert_frame_equal(res, exp)
        assert res['P'].dtype == 'object'

        # different freq
        dts2 = pd.PeriodIndex(['2012-01-01', '2012-01-02',
                               '2012-01-03'], freq='D')
        df2 = pd.DataFrame({'P': dts2}, index=[2, 4, 5])

        res = df1.combine_first(df2)
        exp_dts = [pd.Period('2011-01', freq='M'),
                   pd.Period('2012-01-01', freq='D'),
                   pd.NaT,
                   pd.Period('2012-01-02', freq='D'),
                   pd.Period('2011-03', freq='M'),
                   pd.Period('2011-04', freq='M')]
        exp = pd.DataFrame({'P': exp_dts}, index=[1, 2, 3, 4, 5, 7])
        tm.assert_frame_equal(res, exp)
        assert res['P'].dtype == 'object'

    def test_combine_first_int(self):
        # GH14687 - integer series that do no align exactly

        df1 = pd.DataFrame({'a': [0, 1, 3, 5]}, dtype='int64')
        df2 = pd.DataFrame({'a': [1, 4]}, dtype='int64')

        res = df1.combine_first(df2)
        tm.assert_frame_equal(res, df1)
        assert res['a'].dtype == 'int64'

    def test_concat_datetime_datetime64_frame(self):
        # #2624
        rows = []
        rows.append([datetime(2010, 1, 1), 1])
        rows.append([datetime(2010, 1, 2), 'hi'])

        df2_obj = DataFrame.from_records(rows, columns=['date', 'test'])

        ind = date_range(start="2000/1/1", freq="D", periods=10)
        df1 = DataFrame({'date': ind, 'test': lrange(10)})

        # it works!
        pd.concat([df1, df2_obj])


class TestDataFrameUpdate(TestData):

    def test_update_nan(self):
        # #15593 #15617
        # test 1
        df1 = DataFrame({'A': [1.0, 2, 3], 'B': date_range('2000', periods=3)})
        df2 = DataFrame({'A': [None, 2, 3]})
        expected = df1.copy()
        df1.update(df2, overwrite=False)

        tm.assert_frame_equal(df1, expected)

        # test 2
        df1 = DataFrame({'A': [1.0, None, 3],
                         'B': date_range('2000', periods=3)})
        df2 = DataFrame({'A': [None, 2, 3]})
        expected = DataFrame({'A': [1.0, 2, 3],
                              'B': date_range('2000', periods=3)})
        df1.update(df2, overwrite=False)

        tm.assert_frame_equal(df1, expected)
