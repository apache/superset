# -*- coding: utf-8 -*-

"""
we test .agg behavior / note that .apply is tested
generally in test_groupby.py
"""

from __future__ import print_function

import pytest

from datetime import datetime, timedelta
from functools import partial

import numpy as np
from numpy import nan
import pandas as pd

from pandas import (date_range, MultiIndex, DataFrame,
                    Series, Index, bdate_range, concat)
from pandas.util.testing import assert_frame_equal, assert_series_equal
from pandas.core.groupby import SpecificationError, DataError
from pandas.compat import OrderedDict
from pandas.io.formats.printing import pprint_thing
import pandas.util.testing as tm


class TestGroupByAggregate(object):

    def setup_method(self, method):
        self.ts = tm.makeTimeSeries()

        self.seriesd = tm.getSeriesData()
        self.tsd = tm.getTimeSeriesData()
        self.frame = DataFrame(self.seriesd)
        self.tsframe = DataFrame(self.tsd)

        self.df = DataFrame(
            {'A': ['foo', 'bar', 'foo', 'bar', 'foo', 'bar', 'foo', 'foo'],
             'B': ['one', 'one', 'two', 'three', 'two', 'two', 'one', 'three'],
             'C': np.random.randn(8),
             'D': np.random.randn(8)})

        self.df_mixed_floats = DataFrame(
            {'A': ['foo', 'bar', 'foo', 'bar', 'foo', 'bar', 'foo', 'foo'],
             'B': ['one', 'one', 'two', 'three', 'two', 'two', 'one', 'three'],
             'C': np.random.randn(8),
             'D': np.array(
                 np.random.randn(8), dtype='float32')})

        index = MultiIndex(levels=[['foo', 'bar', 'baz', 'qux'], ['one', 'two',
                                                                  'three']],
                           labels=[[0, 0, 0, 1, 1, 2, 2, 3, 3, 3],
                                   [0, 1, 2, 0, 1, 1, 2, 0, 1, 2]],
                           names=['first', 'second'])
        self.mframe = DataFrame(np.random.randn(10, 3), index=index,
                                columns=['A', 'B', 'C'])

        self.three_group = DataFrame(
            {'A': ['foo', 'foo', 'foo', 'foo', 'bar', 'bar', 'bar', 'bar',
                   'foo', 'foo', 'foo'],
             'B': ['one', 'one', 'one', 'two', 'one', 'one', 'one', 'two',
                   'two', 'two', 'one'],
             'C': ['dull', 'dull', 'shiny', 'dull', 'dull', 'shiny', 'shiny',
                   'dull', 'shiny', 'shiny', 'shiny'],
             'D': np.random.randn(11),
             'E': np.random.randn(11),
             'F': np.random.randn(11)})

    def test_agg_api(self):

        # GH 6337
        # http://stackoverflow.com/questions/21706030/pandas-groupby-agg-function-column-dtype-error
        # different api for agg when passed custom function with mixed frame

        df = DataFrame({'data1': np.random.randn(5),
                        'data2': np.random.randn(5),
                        'key1': ['a', 'a', 'b', 'b', 'a'],
                        'key2': ['one', 'two', 'one', 'two', 'one']})
        grouped = df.groupby('key1')

        def peak_to_peak(arr):
            return arr.max() - arr.min()

        expected = grouped.agg([peak_to_peak])
        expected.columns = ['data1', 'data2']
        result = grouped.agg(peak_to_peak)
        assert_frame_equal(result, expected)

    def test_agg_regression1(self):
        grouped = self.tsframe.groupby([lambda x: x.year, lambda x: x.month])
        result = grouped.agg(np.mean)
        expected = grouped.mean()
        assert_frame_equal(result, expected)

    def test_agg_datetimes_mixed(self):
        data = [[1, '2012-01-01', 1.0], [2, '2012-01-02', 2.0], [3, None, 3.0]]

        df1 = DataFrame({'key': [x[0] for x in data],
                         'date': [x[1] for x in data],
                         'value': [x[2] for x in data]})

        data = [[row[0], datetime.strptime(row[1], '%Y-%m-%d').date() if row[1]
                 else None, row[2]] for row in data]

        df2 = DataFrame({'key': [x[0] for x in data],
                         'date': [x[1] for x in data],
                         'value': [x[2] for x in data]})

        df1['weights'] = df1['value'] / df1['value'].sum()
        gb1 = df1.groupby('date').aggregate(np.sum)

        df2['weights'] = df1['value'] / df1['value'].sum()
        gb2 = df2.groupby('date').aggregate(np.sum)

        assert (len(gb1) == len(gb2))

    def test_agg_period_index(self):
        from pandas import period_range, PeriodIndex
        prng = period_range('2012-1-1', freq='M', periods=3)
        df = DataFrame(np.random.randn(3, 2), index=prng)
        rs = df.groupby(level=0).sum()
        assert isinstance(rs.index, PeriodIndex)

        # GH 3579
        index = period_range(start='1999-01', periods=5, freq='M')
        s1 = Series(np.random.rand(len(index)), index=index)
        s2 = Series(np.random.rand(len(index)), index=index)
        series = [('s1', s1), ('s2', s2)]
        df = DataFrame.from_items(series)
        grouped = df.groupby(df.index.month)
        list(grouped)

    def test_agg_dict_parameter_cast_result_dtypes(self):
        # GH 12821

        df = DataFrame(
            {'class': ['A', 'A', 'B', 'B', 'C', 'C', 'D', 'D'],
             'time': date_range('1/1/2011', periods=8, freq='H')})
        df.loc[[0, 1, 2, 5], 'time'] = None

        # test for `first` function
        exp = df.loc[[0, 3, 4, 6]].set_index('class')
        grouped = df.groupby('class')
        assert_frame_equal(grouped.first(), exp)
        assert_frame_equal(grouped.agg('first'), exp)
        assert_frame_equal(grouped.agg({'time': 'first'}), exp)
        assert_series_equal(grouped.time.first(), exp['time'])
        assert_series_equal(grouped.time.agg('first'), exp['time'])

        # test for `last` function
        exp = df.loc[[0, 3, 4, 7]].set_index('class')
        grouped = df.groupby('class')
        assert_frame_equal(grouped.last(), exp)
        assert_frame_equal(grouped.agg('last'), exp)
        assert_frame_equal(grouped.agg({'time': 'last'}), exp)
        assert_series_equal(grouped.time.last(), exp['time'])
        assert_series_equal(grouped.time.agg('last'), exp['time'])

        # count
        exp = pd.Series([2, 2, 2, 2],
                        index=Index(list('ABCD'), name='class'),
                        name='time')
        assert_series_equal(grouped.time.agg(len), exp)
        assert_series_equal(grouped.time.size(), exp)

        exp = pd.Series([0, 1, 1, 2],
                        index=Index(list('ABCD'), name='class'),
                        name='time')
        assert_series_equal(grouped.time.count(), exp)

    def test_agg_cast_results_dtypes(self):
        # similar to GH12821
        # xref #11444
        u = [datetime(2015, x + 1, 1) for x in range(12)]
        v = list('aaabbbbbbccd')
        df = pd.DataFrame({'X': v, 'Y': u})

        result = df.groupby('X')['Y'].agg(len)
        expected = df.groupby('X')['Y'].count()
        assert_series_equal(result, expected)

    def test_agg_must_agg(self):
        grouped = self.df.groupby('A')['C']
        pytest.raises(Exception, grouped.agg, lambda x: x.describe())
        pytest.raises(Exception, grouped.agg, lambda x: x.index[:2])

    def test_agg_ser_multi_key(self):
        # TODO(wesm): unused
        ser = self.df.C  # noqa

        f = lambda x: x.sum()
        results = self.df.C.groupby([self.df.A, self.df.B]).aggregate(f)
        expected = self.df.groupby(['A', 'B']).sum()['C']
        assert_series_equal(results, expected)

    def test_agg_apply_corner(self):
        # nothing to group, all NA
        grouped = self.ts.groupby(self.ts * np.nan)
        assert self.ts.dtype == np.float64

        # groupby float64 values results in Float64Index
        exp = Series([], dtype=np.float64, index=pd.Index(
            [], dtype=np.float64))
        assert_series_equal(grouped.sum(), exp)
        assert_series_equal(grouped.agg(np.sum), exp)
        assert_series_equal(grouped.apply(np.sum), exp, check_index_type=False)

        # DataFrame
        grouped = self.tsframe.groupby(self.tsframe['A'] * np.nan)
        exp_df = DataFrame(columns=self.tsframe.columns, dtype=float,
                           index=pd.Index([], dtype=np.float64))
        assert_frame_equal(grouped.sum(), exp_df, check_names=False)
        assert_frame_equal(grouped.agg(np.sum), exp_df, check_names=False)
        assert_frame_equal(grouped.apply(np.sum), exp_df.iloc[:, :0],
                           check_names=False)

    def test_agg_grouping_is_list_tuple(self):
        from pandas.core.groupby import Grouping

        df = tm.makeTimeDataFrame()

        grouped = df.groupby(lambda x: x.year)
        grouper = grouped.grouper.groupings[0].grouper
        grouped.grouper.groupings[0] = Grouping(self.ts.index, list(grouper))

        result = grouped.agg(np.mean)
        expected = grouped.mean()
        tm.assert_frame_equal(result, expected)

        grouped.grouper.groupings[0] = Grouping(self.ts.index, tuple(grouper))

        result = grouped.agg(np.mean)
        expected = grouped.mean()
        tm.assert_frame_equal(result, expected)

    def test_aggregate_api_consistency(self):
        # GH 9052
        # make sure that the aggregates via dict
        # are consistent

        df = DataFrame({'A': ['foo', 'bar', 'foo', 'bar',
                              'foo', 'bar', 'foo', 'foo'],
                        'B': ['one', 'one', 'two', 'two',
                              'two', 'two', 'one', 'two'],
                        'C': np.random.randn(8) + 1.0,
                        'D': np.arange(8)})

        grouped = df.groupby(['A', 'B'])
        c_mean = grouped['C'].mean()
        c_sum = grouped['C'].sum()
        d_mean = grouped['D'].mean()
        d_sum = grouped['D'].sum()

        result = grouped['D'].agg(['sum', 'mean'])
        expected = pd.concat([d_sum, d_mean],
                             axis=1)
        expected.columns = ['sum', 'mean']
        assert_frame_equal(result, expected, check_like=True)

        result = grouped.agg([np.sum, np.mean])
        expected = pd.concat([c_sum,
                              c_mean,
                              d_sum,
                              d_mean],
                             axis=1)
        expected.columns = MultiIndex.from_product([['C', 'D'],
                                                    ['sum', 'mean']])
        assert_frame_equal(result, expected, check_like=True)

        result = grouped[['D', 'C']].agg([np.sum, np.mean])
        expected = pd.concat([d_sum,
                              d_mean,
                              c_sum,
                              c_mean],
                             axis=1)
        expected.columns = MultiIndex.from_product([['D', 'C'],
                                                    ['sum', 'mean']])
        assert_frame_equal(result, expected, check_like=True)

        result = grouped.agg({'C': 'mean', 'D': 'sum'})
        expected = pd.concat([d_sum,
                              c_mean],
                             axis=1)
        assert_frame_equal(result, expected, check_like=True)

        result = grouped.agg({'C': ['mean', 'sum'],
                              'D': ['mean', 'sum']})
        expected = pd.concat([c_mean,
                              c_sum,
                              d_mean,
                              d_sum],
                             axis=1)
        expected.columns = MultiIndex.from_product([['C', 'D'],
                                                    ['mean', 'sum']])

        with tm.assert_produces_warning(FutureWarning,
                                        check_stacklevel=False):
            result = grouped[['D', 'C']].agg({'r': np.sum,
                                              'r2': np.mean})
        expected = pd.concat([d_sum,
                              c_sum,
                              d_mean,
                              c_mean],
                             axis=1)
        expected.columns = MultiIndex.from_product([['r', 'r2'],
                                                    ['D', 'C']])
        assert_frame_equal(result, expected, check_like=True)

    def test_agg_dict_renaming_deprecation(self):
        # 15931
        df = pd.DataFrame({'A': [1, 1, 1, 2, 2],
                           'B': range(5),
                           'C': range(5)})

        with tm.assert_produces_warning(FutureWarning,
                                        check_stacklevel=False) as w:
            df.groupby('A').agg({'B': {'foo': ['sum', 'max']},
                                 'C': {'bar': ['count', 'min']}})
            assert "using a dict with renaming" in str(w[0].message)

        with tm.assert_produces_warning(FutureWarning,
                                        check_stacklevel=False):
            df.groupby('A')[['B', 'C']].agg({'ma': 'max'})

        with tm.assert_produces_warning(FutureWarning) as w:
            df.groupby('A').B.agg({'foo': 'count'})
            assert "using a dict on a Series for aggregation" in str(
                w[0].message)

    def test_agg_compat(self):

        # GH 12334

        df = DataFrame({'A': ['foo', 'bar', 'foo', 'bar',
                              'foo', 'bar', 'foo', 'foo'],
                        'B': ['one', 'one', 'two', 'two',
                              'two', 'two', 'one', 'two'],
                        'C': np.random.randn(8) + 1.0,
                        'D': np.arange(8)})

        g = df.groupby(['A', 'B'])

        expected = pd.concat([g['D'].sum(),
                              g['D'].std()],
                             axis=1)
        expected.columns = MultiIndex.from_tuples([('C', 'sum'),
                                                   ('C', 'std')])
        with tm.assert_produces_warning(FutureWarning,
                                        check_stacklevel=False):
            result = g['D'].agg({'C': ['sum', 'std']})
        assert_frame_equal(result, expected, check_like=True)

        expected = pd.concat([g['D'].sum(),
                              g['D'].std()],
                             axis=1)
        expected.columns = ['C', 'D']

        with tm.assert_produces_warning(FutureWarning,
                                        check_stacklevel=False):
            result = g['D'].agg({'C': 'sum', 'D': 'std'})
        assert_frame_equal(result, expected, check_like=True)

    def test_agg_nested_dicts(self):

        # API change for disallowing these types of nested dicts
        df = DataFrame({'A': ['foo', 'bar', 'foo', 'bar',
                              'foo', 'bar', 'foo', 'foo'],
                        'B': ['one', 'one', 'two', 'two',
                              'two', 'two', 'one', 'two'],
                        'C': np.random.randn(8) + 1.0,
                        'D': np.arange(8)})

        g = df.groupby(['A', 'B'])

        def f():
            g.aggregate({'r1': {'C': ['mean', 'sum']},
                         'r2': {'D': ['mean', 'sum']}})

        pytest.raises(SpecificationError, f)

        with tm.assert_produces_warning(FutureWarning,
                                        check_stacklevel=False):
            result = g.agg({'C': {'ra': ['mean', 'std']},
                            'D': {'rb': ['mean', 'std']}})
        expected = pd.concat([g['C'].mean(), g['C'].std(), g['D'].mean(),
                              g['D'].std()], axis=1)
        expected.columns = pd.MultiIndex.from_tuples([('ra', 'mean'), (
            'ra', 'std'), ('rb', 'mean'), ('rb', 'std')])
        assert_frame_equal(result, expected, check_like=True)

        # same name as the original column
        # GH9052
        with tm.assert_produces_warning(FutureWarning,
                                        check_stacklevel=False):
            expected = g['D'].agg({'result1': np.sum, 'result2': np.mean})
        expected = expected.rename(columns={'result1': 'D'})

        with tm.assert_produces_warning(FutureWarning,
                                        check_stacklevel=False):
            result = g['D'].agg({'D': np.sum, 'result2': np.mean})
        assert_frame_equal(result, expected, check_like=True)

    def test_agg_python_multiindex(self):
        grouped = self.mframe.groupby(['A', 'B'])

        result = grouped.agg(np.mean)
        expected = grouped.mean()
        tm.assert_frame_equal(result, expected)

    def test_aggregate_str_func(self):
        def _check_results(grouped):
            # single series
            result = grouped['A'].agg('std')
            expected = grouped['A'].std()
            assert_series_equal(result, expected)

            # group frame by function name
            result = grouped.aggregate('var')
            expected = grouped.var()
            assert_frame_equal(result, expected)

            # group frame by function dict
            result = grouped.agg(OrderedDict([['A', 'var'], ['B', 'std'],
                                              ['C', 'mean'], ['D', 'sem']]))
            expected = DataFrame(OrderedDict([['A', grouped['A'].var(
            )], ['B', grouped['B'].std()], ['C', grouped['C'].mean()],
                ['D', grouped['D'].sem()]]))
            assert_frame_equal(result, expected)

        by_weekday = self.tsframe.groupby(lambda x: x.weekday())
        _check_results(by_weekday)

        by_mwkday = self.tsframe.groupby([lambda x: x.month,
                                          lambda x: x.weekday()])
        _check_results(by_mwkday)

    def test_aggregate_item_by_item(self):

        df = self.df.copy()
        df['E'] = ['a'] * len(self.df)
        grouped = self.df.groupby('A')

        # API change in 0.11
        # def aggfun(ser):
        #     return len(ser + 'a')
        # result = grouped.agg(aggfun)
        # assert len(result.columns) == 1

        aggfun = lambda ser: ser.size
        result = grouped.agg(aggfun)
        foo = (self.df.A == 'foo').sum()
        bar = (self.df.A == 'bar').sum()
        K = len(result.columns)

        # GH5782
        # odd comparisons can result here, so cast to make easy
        exp = pd.Series(np.array([foo] * K), index=list('BCD'),
                        dtype=np.float64, name='foo')
        tm.assert_series_equal(result.xs('foo'), exp)

        exp = pd.Series(np.array([bar] * K), index=list('BCD'),
                        dtype=np.float64, name='bar')
        tm.assert_almost_equal(result.xs('bar'), exp)

        def aggfun(ser):
            return ser.size

        result = DataFrame().groupby(self.df.A).agg(aggfun)
        assert isinstance(result, DataFrame)
        assert len(result) == 0

    def test_agg_item_by_item_raise_typeerror(self):
        from numpy.random import randint

        df = DataFrame(randint(10, size=(20, 10)))

        def raiseException(df):
            pprint_thing('----------------------------------------')
            pprint_thing(df.to_string())
            raise TypeError

        pytest.raises(TypeError, df.groupby(0).agg, raiseException)

    def test_series_agg_multikey(self):
        ts = tm.makeTimeSeries()
        grouped = ts.groupby([lambda x: x.year, lambda x: x.month])

        result = grouped.agg(np.sum)
        expected = grouped.sum()
        assert_series_equal(result, expected)

    def test_series_agg_multi_pure_python(self):
        data = DataFrame(
            {'A': ['foo', 'foo', 'foo', 'foo', 'bar', 'bar', 'bar', 'bar',
                   'foo', 'foo', 'foo'],
             'B': ['one', 'one', 'one', 'two', 'one', 'one', 'one', 'two',
                   'two', 'two', 'one'],
             'C': ['dull', 'dull', 'shiny', 'dull', 'dull', 'shiny', 'shiny',
                   'dull', 'shiny', 'shiny', 'shiny'],
             'D': np.random.randn(11),
             'E': np.random.randn(11),
             'F': np.random.randn(11)})

        def bad(x):
            assert (len(x.base) > 0)
            return 'foo'

        result = data.groupby(['A', 'B']).agg(bad)
        expected = data.groupby(['A', 'B']).agg(lambda x: 'foo')
        assert_frame_equal(result, expected)

    def test_cythonized_aggers(self):
        data = {'A': [0, 0, 0, 0, 1, 1, 1, 1, 1, 1., nan, nan],
                'B': ['A', 'B'] * 6,
                'C': np.random.randn(12)}
        df = DataFrame(data)
        df.loc[2:10:2, 'C'] = nan

        def _testit(name):

            op = lambda x: getattr(x, name)()

            # single column
            grouped = df.drop(['B'], axis=1).groupby('A')
            exp = {}
            for cat, group in grouped:
                exp[cat] = op(group['C'])
            exp = DataFrame({'C': exp})
            exp.index.name = 'A'
            result = op(grouped)
            assert_frame_equal(result, exp)

            # multiple columns
            grouped = df.groupby(['A', 'B'])
            expd = {}
            for (cat1, cat2), group in grouped:
                expd.setdefault(cat1, {})[cat2] = op(group['C'])
            exp = DataFrame(expd).T.stack(dropna=False)
            exp.index.names = ['A', 'B']
            exp.name = 'C'

            result = op(grouped)['C']
            if not tm._incompat_bottleneck_version(name):
                assert_series_equal(result, exp)

        _testit('count')
        _testit('sum')
        _testit('std')
        _testit('var')
        _testit('sem')
        _testit('mean')
        _testit('median')
        _testit('prod')
        _testit('min')
        _testit('max')

    def test_cython_agg_boolean(self):
        frame = DataFrame({'a': np.random.randint(0, 5, 50),
                           'b': np.random.randint(0, 2, 50).astype('bool')})
        result = frame.groupby('a')['b'].mean()
        expected = frame.groupby('a')['b'].agg(np.mean)

        assert_series_equal(result, expected)

    def test_cython_agg_nothing_to_agg(self):
        frame = DataFrame({'a': np.random.randint(0, 5, 50),
                           'b': ['foo', 'bar'] * 25})
        pytest.raises(DataError, frame.groupby('a')['b'].mean)

        frame = DataFrame({'a': np.random.randint(0, 5, 50),
                           'b': ['foo', 'bar'] * 25})
        pytest.raises(DataError, frame[['b']].groupby(frame['a']).mean)

    def test_cython_agg_nothing_to_agg_with_dates(self):
        frame = DataFrame({'a': np.random.randint(0, 5, 50),
                           'b': ['foo', 'bar'] * 25,
                           'dates': pd.date_range('now', periods=50,
                                                  freq='T')})
        with tm.assert_raises_regex(DataError,
                                    "No numeric types to aggregate"):
            frame.groupby('b').dates.mean()

    def test_cython_agg_frame_columns(self):
        # #2113
        df = DataFrame({'x': [1, 2, 3], 'y': [3, 4, 5]})

        df.groupby(level=0, axis='columns').mean()
        df.groupby(level=0, axis='columns').mean()
        df.groupby(level=0, axis='columns').mean()
        df.groupby(level=0, axis='columns').mean()

    def test_cython_fail_agg(self):
        dr = bdate_range('1/1/2000', periods=50)
        ts = Series(['A', 'B', 'C', 'D', 'E'] * 10, index=dr)

        grouped = ts.groupby(lambda x: x.month)
        summed = grouped.sum()
        expected = grouped.agg(np.sum)
        assert_series_equal(summed, expected)

    def test_agg_consistency(self):
        # agg with ([]) and () not consistent
        # GH 6715

        def P1(a):
            try:
                return np.percentile(a.dropna(), q=1)
            except:
                return np.nan

        import datetime as dt
        df = DataFrame({'col1': [1, 2, 3, 4],
                        'col2': [10, 25, 26, 31],
                        'date': [dt.date(2013, 2, 10), dt.date(2013, 2, 10),
                                 dt.date(2013, 2, 11), dt.date(2013, 2, 11)]})

        g = df.groupby('date')

        expected = g.agg([P1])
        expected.columns = expected.columns.levels[0]

        result = g.agg(P1)
        assert_frame_equal(result, expected)

    def test_wrap_agg_out(self):
        grouped = self.three_group.groupby(['A', 'B'])

        def func(ser):
            if ser.dtype == np.object:
                raise TypeError
            else:
                return ser.sum()

        result = grouped.aggregate(func)
        exp_grouped = self.three_group.loc[:, self.three_group.columns != 'C']
        expected = exp_grouped.groupby(['A', 'B']).aggregate(func)
        assert_frame_equal(result, expected)

    def test_agg_multiple_functions_maintain_order(self):
        # GH #610
        funcs = [('mean', np.mean), ('max', np.max), ('min', np.min)]
        result = self.df.groupby('A')['C'].agg(funcs)
        exp_cols = Index(['mean', 'max', 'min'])

        tm.assert_index_equal(result.columns, exp_cols)

    def test_multiple_functions_tuples_and_non_tuples(self):
        # #1359

        funcs = [('foo', 'mean'), 'std']
        ex_funcs = [('foo', 'mean'), ('std', 'std')]

        result = self.df.groupby('A')['C'].agg(funcs)
        expected = self.df.groupby('A')['C'].agg(ex_funcs)
        assert_frame_equal(result, expected)

        result = self.df.groupby('A').agg(funcs)
        expected = self.df.groupby('A').agg(ex_funcs)
        assert_frame_equal(result, expected)

    def test_agg_multiple_functions_too_many_lambdas(self):
        grouped = self.df.groupby('A')
        funcs = ['mean', lambda x: x.mean(), lambda x: x.std()]

        pytest.raises(SpecificationError, grouped.agg, funcs)

    def test_more_flexible_frame_multi_function(self):

        grouped = self.df.groupby('A')

        exmean = grouped.agg(OrderedDict([['C', np.mean], ['D', np.mean]]))
        exstd = grouped.agg(OrderedDict([['C', np.std], ['D', np.std]]))

        expected = concat([exmean, exstd], keys=['mean', 'std'], axis=1)
        expected = expected.swaplevel(0, 1, axis=1).sort_index(level=0, axis=1)

        d = OrderedDict([['C', [np.mean, np.std]], ['D', [np.mean, np.std]]])
        result = grouped.aggregate(d)

        assert_frame_equal(result, expected)

        # be careful
        result = grouped.aggregate(OrderedDict([['C', np.mean],
                                                ['D', [np.mean, np.std]]]))
        expected = grouped.aggregate(OrderedDict([['C', np.mean],
                                                  ['D', [np.mean, np.std]]]))
        assert_frame_equal(result, expected)

        def foo(x):
            return np.mean(x)

        def bar(x):
            return np.std(x, ddof=1)

        # this uses column selection & renaming
        with tm.assert_produces_warning(FutureWarning,
                                        check_stacklevel=False):
            d = OrderedDict([['C', np.mean], ['D', OrderedDict(
                [['foo', np.mean], ['bar', np.std]])]])
            result = grouped.aggregate(d)

        d = OrderedDict([['C', [np.mean]], ['D', [foo, bar]]])
        expected = grouped.aggregate(d)

        assert_frame_equal(result, expected)

    def test_multi_function_flexible_mix(self):
        # GH #1268
        grouped = self.df.groupby('A')

        d = OrderedDict([['C', OrderedDict([['foo', 'mean'], [
            'bar', 'std'
        ]])], ['D', 'sum']])

        # this uses column selection & renaming
        with tm.assert_produces_warning(FutureWarning,
                                        check_stacklevel=False):
            result = grouped.aggregate(d)

        d2 = OrderedDict([['C', OrderedDict([['foo', 'mean'], [
            'bar', 'std'
        ]])], ['D', ['sum']]])

        # this uses column selection & renaming
        with tm.assert_produces_warning(FutureWarning,
                                        check_stacklevel=False):
            result2 = grouped.aggregate(d2)

        d3 = OrderedDict([['C', OrderedDict([['foo', 'mean'], [
            'bar', 'std'
        ]])], ['D', {'sum': 'sum'}]])

        # this uses column selection & renaming
        with tm.assert_produces_warning(FutureWarning,
                                        check_stacklevel=False):
            expected = grouped.aggregate(d3)

        assert_frame_equal(result, expected)
        assert_frame_equal(result2, expected)

    def test_agg_callables(self):
        # GH 7929
        df = DataFrame({'foo': [1, 2], 'bar': [3, 4]}).astype(np.int64)

        class fn_class(object):

            def __call__(self, x):
                return sum(x)

        equiv_callables = [sum, np.sum, lambda x: sum(x), lambda x: x.sum(),
                           partial(sum), fn_class()]

        expected = df.groupby("foo").agg(sum)
        for ecall in equiv_callables:
            result = df.groupby('foo').agg(ecall)
            assert_frame_equal(result, expected)

    def test__cython_agg_general(self):
        ops = [('mean', np.mean),
               ('median', np.median),
               ('var', np.var),
               ('add', np.sum),
               ('prod', np.prod),
               ('min', np.min),
               ('max', np.max),
               ('first', lambda x: x.iloc[0]),
               ('last', lambda x: x.iloc[-1]), ]
        df = DataFrame(np.random.randn(1000))
        labels = np.random.randint(0, 50, size=1000).astype(float)

        for op, targop in ops:
            result = df.groupby(labels)._cython_agg_general(op)
            expected = df.groupby(labels).agg(targop)
            try:
                tm.assert_frame_equal(result, expected)
            except BaseException as exc:
                exc.args += ('operation: %s' % op, )
                raise

    def test_cython_agg_empty_buckets(self):
        ops = [('mean', np.mean),
               ('median', lambda x: np.median(x) if len(x) > 0 else np.nan),
               ('var', lambda x: np.var(x, ddof=1)),
               ('add', lambda x: np.sum(x) if len(x) > 0 else np.nan),
               ('prod', np.prod),
               ('min', np.min),
               ('max', np.max), ]

        df = pd.DataFrame([11, 12, 13])
        grps = range(0, 55, 5)

        for op, targop in ops:
            result = df.groupby(pd.cut(df[0], grps))._cython_agg_general(op)
            expected = df.groupby(pd.cut(df[0], grps)).agg(lambda x: targop(x))
            try:
                tm.assert_frame_equal(result, expected)
            except BaseException as exc:
                exc.args += ('operation: %s' % op,)
                raise

    def test_agg_over_numpy_arrays(self):
        # GH 3788
        df = pd.DataFrame([[1, np.array([10, 20, 30])],
                           [1, np.array([40, 50, 60])],
                           [2, np.array([20, 30, 40])]],
                          columns=['category', 'arraydata'])
        result = df.groupby('category').agg(sum)

        expected_data = [[np.array([50, 70, 90])], [np.array([20, 30, 40])]]
        expected_index = pd.Index([1, 2], name='category')
        expected_column = ['arraydata']
        expected = pd.DataFrame(expected_data,
                                index=expected_index,
                                columns=expected_column)

        assert_frame_equal(result, expected)

    def test_agg_timezone_round_trip(self):
        # GH 15426
        ts = pd.Timestamp("2016-01-01 12:00:00", tz='US/Pacific')
        df = pd.DataFrame({'a': 1, 'b': [ts + timedelta(minutes=nn)
                                         for nn in range(10)]})

        result1 = df.groupby('a')['b'].agg(np.min).iloc[0]
        result2 = df.groupby('a')['b'].agg(lambda x: np.min(x)).iloc[0]
        result3 = df.groupby('a')['b'].min().iloc[0]

        assert result1 == ts
        assert result2 == ts
        assert result3 == ts

        dates = [pd.Timestamp("2016-01-0%d 12:00:00" % i, tz='US/Pacific')
                 for i in range(1, 5)]
        df = pd.DataFrame({'A': ['a', 'b'] * 2, 'B': dates})
        grouped = df.groupby('A')

        ts = df['B'].iloc[0]
        assert ts == grouped.nth(0)['B'].iloc[0]
        assert ts == grouped.head(1)['B'].iloc[0]
        assert ts == grouped.first()['B'].iloc[0]
        assert ts == grouped.apply(lambda x: x.iloc[0])[0]

        ts = df['B'].iloc[2]
        assert ts == grouped.last()['B'].iloc[0]
        assert ts == grouped.apply(lambda x: x.iloc[-1])[0]
