# -*- coding: utf-8 -*-

from __future__ import print_function

import pytest

from datetime import datetime

import warnings
import numpy as np

from pandas import (notnull, DataFrame, Series, MultiIndex, date_range,
                    Timestamp, compat)
import pandas as pd
from pandas.core.dtypes.dtypes import CategoricalDtype
from pandas.util.testing import (assert_series_equal,
                                 assert_frame_equal)
import pandas.util.testing as tm
from pandas.tests.frame.common import TestData


class TestDataFrameApply(TestData):

    def test_apply(self):
        with np.errstate(all='ignore'):
            # ufunc
            applied = self.frame.apply(np.sqrt)
            tm.assert_series_equal(np.sqrt(self.frame['A']), applied['A'])

            # aggregator
            applied = self.frame.apply(np.mean)
            assert applied['A'] == np.mean(self.frame['A'])

            d = self.frame.index[0]
            applied = self.frame.apply(np.mean, axis=1)
            assert applied[d] == np.mean(self.frame.xs(d))
            assert applied.index is self.frame.index  # want this

        # invalid axis
        df = DataFrame(
            [[1, 2, 3], [4, 5, 6], [7, 8, 9]], index=['a', 'a', 'c'])
        pytest.raises(ValueError, df.apply, lambda x: x, 2)

        # see gh-9573
        df = DataFrame({'c0': ['A', 'A', 'B', 'B'],
                        'c1': ['C', 'C', 'D', 'D']})
        df = df.apply(lambda ts: ts.astype('category'))

        assert df.shape == (4, 2)
        assert isinstance(df['c0'].dtype, CategoricalDtype)
        assert isinstance(df['c1'].dtype, CategoricalDtype)

    def test_apply_mixed_datetimelike(self):
        # mixed datetimelike
        # GH 7778
        df = DataFrame({'A': date_range('20130101', periods=3),
                        'B': pd.to_timedelta(np.arange(3), unit='s')})
        result = df.apply(lambda x: x, axis=1)
        assert_frame_equal(result, df)

    def test_apply_empty(self):
        # empty
        applied = self.empty.apply(np.sqrt)
        assert applied.empty

        applied = self.empty.apply(np.mean)
        assert applied.empty

        no_rows = self.frame[:0]
        result = no_rows.apply(lambda x: x.mean())
        expected = Series(np.nan, index=self.frame.columns)
        assert_series_equal(result, expected)

        no_cols = self.frame.loc[:, []]
        result = no_cols.apply(lambda x: x.mean(), axis=1)
        expected = Series(np.nan, index=self.frame.index)
        assert_series_equal(result, expected)

        # 2476
        xp = DataFrame(index=['a'])
        rs = xp.apply(lambda x: x['a'], axis=1)
        assert_frame_equal(xp, rs)

        # reduce with an empty DataFrame
        x = []
        result = self.empty.apply(x.append, axis=1, reduce=False)
        assert_frame_equal(result, self.empty)
        result = self.empty.apply(x.append, axis=1, reduce=True)
        assert_series_equal(result, Series(
            [], index=pd.Index([], dtype=object)))

        empty_with_cols = DataFrame(columns=['a', 'b', 'c'])
        result = empty_with_cols.apply(x.append, axis=1, reduce=False)
        assert_frame_equal(result, empty_with_cols)
        result = empty_with_cols.apply(x.append, axis=1, reduce=True)
        assert_series_equal(result, Series(
            [], index=pd.Index([], dtype=object)))

        # Ensure that x.append hasn't been called
        assert x == []

    def test_apply_standard_nonunique(self):
        df = DataFrame(
            [[1, 2, 3], [4, 5, 6], [7, 8, 9]], index=['a', 'a', 'c'])
        rs = df.apply(lambda s: s[0], axis=1)
        xp = Series([1, 4, 7], ['a', 'a', 'c'])
        assert_series_equal(rs, xp)

        rs = df.T.apply(lambda s: s[0], axis=0)
        assert_series_equal(rs, xp)

    def test_with_string_args(self):

        for arg in ['sum', 'mean', 'min', 'max', 'std']:
            result = self.frame.apply(arg)
            expected = getattr(self.frame, arg)()
            tm.assert_series_equal(result, expected)

            result = self.frame.apply(arg, axis=1)
            expected = getattr(self.frame, arg)(axis=1)
            tm.assert_series_equal(result, expected)

    def test_apply_broadcast(self):
        broadcasted = self.frame.apply(np.mean, broadcast=True)
        agged = self.frame.apply(np.mean)

        for col, ts in compat.iteritems(broadcasted):
            assert (ts == agged[col]).all()

        broadcasted = self.frame.apply(np.mean, axis=1, broadcast=True)
        agged = self.frame.apply(np.mean, axis=1)
        for idx in broadcasted.index:
            assert (broadcasted.xs(idx) == agged[idx]).all()

    def test_apply_raw(self):
        result0 = self.frame.apply(np.mean, raw=True)
        result1 = self.frame.apply(np.mean, axis=1, raw=True)

        expected0 = self.frame.apply(lambda x: x.values.mean())
        expected1 = self.frame.apply(lambda x: x.values.mean(), axis=1)

        assert_series_equal(result0, expected0)
        assert_series_equal(result1, expected1)

        # no reduction
        result = self.frame.apply(lambda x: x * 2, raw=True)
        expected = self.frame * 2
        assert_frame_equal(result, expected)

    def test_apply_axis1(self):
        d = self.frame.index[0]
        tapplied = self.frame.apply(np.mean, axis=1)
        assert tapplied[d] == np.mean(self.frame.xs(d))

    def test_apply_ignore_failures(self):
        result = self.mixed_frame._apply_standard(np.mean, 0,
                                                  ignore_failures=True)
        expected = self.mixed_frame._get_numeric_data().apply(np.mean)
        assert_series_equal(result, expected)

    def test_apply_mixed_dtype_corner(self):
        df = DataFrame({'A': ['foo'],
                        'B': [1.]})
        result = df[:0].apply(np.mean, axis=1)
        # the result here is actually kind of ambiguous, should it be a Series
        # or a DataFrame?
        expected = Series(np.nan, index=pd.Index([], dtype='int64'))
        assert_series_equal(result, expected)

        df = DataFrame({'A': ['foo'],
                        'B': [1.]})
        result = df.apply(lambda x: x['A'], axis=1)
        expected = Series(['foo'], index=[0])
        assert_series_equal(result, expected)

        result = df.apply(lambda x: x['B'], axis=1)
        expected = Series([1.], index=[0])
        assert_series_equal(result, expected)

    def test_apply_empty_infer_type(self):
        no_cols = DataFrame(index=['a', 'b', 'c'])
        no_index = DataFrame(columns=['a', 'b', 'c'])

        def _check(df, f):
            with warnings.catch_warnings(record=True):
                test_res = f(np.array([], dtype='f8'))
            is_reduction = not isinstance(test_res, np.ndarray)

            def _checkit(axis=0, raw=False):
                res = df.apply(f, axis=axis, raw=raw)
                if is_reduction:
                    agg_axis = df._get_agg_axis(axis)
                    assert isinstance(res, Series)
                    assert res.index is agg_axis
                else:
                    assert isinstance(res, DataFrame)

            _checkit()
            _checkit(axis=1)
            _checkit(raw=True)
            _checkit(axis=0, raw=True)

        with np.errstate(all='ignore'):
            _check(no_cols, lambda x: x)
            _check(no_cols, lambda x: x.mean())
            _check(no_index, lambda x: x)
            _check(no_index, lambda x: x.mean())

        result = no_cols.apply(lambda x: x.mean(), broadcast=True)
        assert isinstance(result, DataFrame)

    def test_apply_with_args_kwds(self):
        def add_some(x, howmuch=0):
            return x + howmuch

        def agg_and_add(x, howmuch=0):
            return x.mean() + howmuch

        def subtract_and_divide(x, sub, divide=1):
            return (x - sub) / divide

        result = self.frame.apply(add_some, howmuch=2)
        exp = self.frame.apply(lambda x: x + 2)
        assert_frame_equal(result, exp)

        result = self.frame.apply(agg_and_add, howmuch=2)
        exp = self.frame.apply(lambda x: x.mean() + 2)
        assert_series_equal(result, exp)

        res = self.frame.apply(subtract_and_divide, args=(2,), divide=2)
        exp = self.frame.apply(lambda x: (x - 2.) / 2.)
        assert_frame_equal(res, exp)

    def test_apply_yield_list(self):
        result = self.frame.apply(list)
        assert_frame_equal(result, self.frame)

    def test_apply_reduce_Series(self):
        self.frame.loc[::2, 'A'] = np.nan
        expected = self.frame.mean(1)
        result = self.frame.apply(np.mean, axis=1)
        assert_series_equal(result, expected)

    def test_apply_differently_indexed(self):
        df = DataFrame(np.random.randn(20, 10))

        result0 = df.apply(Series.describe, axis=0)
        expected0 = DataFrame(dict((i, v.describe())
                                   for i, v in compat.iteritems(df)),
                              columns=df.columns)
        assert_frame_equal(result0, expected0)

        result1 = df.apply(Series.describe, axis=1)
        expected1 = DataFrame(dict((i, v.describe())
                                   for i, v in compat.iteritems(df.T)),
                              columns=df.index).T
        assert_frame_equal(result1, expected1)

    def test_apply_modify_traceback(self):
        data = DataFrame({'A': ['foo', 'foo', 'foo', 'foo',
                                'bar', 'bar', 'bar', 'bar',
                                'foo', 'foo', 'foo'],
                          'B': ['one', 'one', 'one', 'two',
                                'one', 'one', 'one', 'two',
                                'two', 'two', 'one'],
                          'C': ['dull', 'dull', 'shiny', 'dull',
                                'dull', 'shiny', 'shiny', 'dull',
                                'shiny', 'shiny', 'shiny'],
                          'D': np.random.randn(11),
                          'E': np.random.randn(11),
                          'F': np.random.randn(11)})

        data.loc[4, 'C'] = np.nan

        def transform(row):
            if row['C'].startswith('shin') and row['A'] == 'foo':
                row['D'] = 7
            return row

        def transform2(row):
            if (notnull(row['C']) and row['C'].startswith('shin') and
                    row['A'] == 'foo'):
                row['D'] = 7
            return row

        try:
            data.apply(transform, axis=1)
        except AttributeError as e:
            assert len(e.args) == 2
            assert e.args[1] == 'occurred at index 4'
            assert e.args[0] == "'float' object has no attribute 'startswith'"

    def test_apply_bug(self):

        # GH 6125
        positions = pd.DataFrame([[1, 'ABC0', 50], [1, 'YUM0', 20],
                                  [1, 'DEF0', 20], [2, 'ABC1', 50],
                                  [2, 'YUM1', 20], [2, 'DEF1', 20]],
                                 columns=['a', 'market', 'position'])

        def f(r):
            return r['market']
        expected = positions.apply(f, axis=1)

        positions = DataFrame([[datetime(2013, 1, 1), 'ABC0', 50],
                               [datetime(2013, 1, 2), 'YUM0', 20],
                               [datetime(2013, 1, 3), 'DEF0', 20],
                               [datetime(2013, 1, 4), 'ABC1', 50],
                               [datetime(2013, 1, 5), 'YUM1', 20],
                               [datetime(2013, 1, 6), 'DEF1', 20]],
                              columns=['a', 'market', 'position'])
        result = positions.apply(f, axis=1)
        assert_series_equal(result, expected)

    def test_apply_convert_objects(self):
        data = DataFrame({'A': ['foo', 'foo', 'foo', 'foo',
                                'bar', 'bar', 'bar', 'bar',
                                'foo', 'foo', 'foo'],
                          'B': ['one', 'one', 'one', 'two',
                                'one', 'one', 'one', 'two',
                                'two', 'two', 'one'],
                          'C': ['dull', 'dull', 'shiny', 'dull',
                                'dull', 'shiny', 'shiny', 'dull',
                                'shiny', 'shiny', 'shiny'],
                          'D': np.random.randn(11),
                          'E': np.random.randn(11),
                          'F': np.random.randn(11)})

        result = data.apply(lambda x: x, axis=1)
        assert_frame_equal(result._convert(datetime=True), data)

    def test_apply_attach_name(self):
        result = self.frame.apply(lambda x: x.name)
        expected = Series(self.frame.columns, index=self.frame.columns)
        assert_series_equal(result, expected)

        result = self.frame.apply(lambda x: x.name, axis=1)
        expected = Series(self.frame.index, index=self.frame.index)
        assert_series_equal(result, expected)

        # non-reductions
        result = self.frame.apply(lambda x: np.repeat(x.name, len(x)))
        expected = DataFrame(np.tile(self.frame.columns,
                                     (len(self.frame.index), 1)),
                             index=self.frame.index,
                             columns=self.frame.columns)
        assert_frame_equal(result, expected)

        result = self.frame.apply(lambda x: np.repeat(x.name, len(x)),
                                  axis=1)
        expected = DataFrame(np.tile(self.frame.index,
                                     (len(self.frame.columns), 1)).T,
                             index=self.frame.index,
                             columns=self.frame.columns)
        assert_frame_equal(result, expected)

    def test_apply_multi_index(self):
        s = DataFrame([[1, 2], [3, 4], [5, 6]])
        s.index = MultiIndex.from_arrays([['a', 'a', 'b'], ['c', 'd', 'd']])
        s.columns = ['col1', 'col2']
        res = s.apply(lambda x: Series({'min': min(x), 'max': max(x)}), 1)
        assert isinstance(res.index, MultiIndex)

    def test_apply_dict(self):

        # GH 8735
        A = DataFrame([['foo', 'bar'], ['spam', 'eggs']])
        A_dicts = pd.Series([dict([(0, 'foo'), (1, 'spam')]),
                             dict([(0, 'bar'), (1, 'eggs')])])
        B = DataFrame([[0, 1], [2, 3]])
        B_dicts = pd.Series([dict([(0, 0), (1, 2)]), dict([(0, 1), (1, 3)])])
        fn = lambda x: x.to_dict()

        for df, dicts in [(A, A_dicts), (B, B_dicts)]:
            reduce_true = df.apply(fn, reduce=True)
            reduce_false = df.apply(fn, reduce=False)
            reduce_none = df.apply(fn, reduce=None)

            assert_series_equal(reduce_true, dicts)
            assert_frame_equal(reduce_false, df)
            assert_series_equal(reduce_none, dicts)

    def test_applymap(self):
        applied = self.frame.applymap(lambda x: x * 2)
        tm.assert_frame_equal(applied, self.frame * 2)
        self.frame.applymap(type)

        # gh-465: function returning tuples
        result = self.frame.applymap(lambda x: (x, x))
        assert isinstance(result['A'][0], tuple)

        # gh-2909: object conversion to float in constructor?
        df = DataFrame(data=[1, 'a'])
        result = df.applymap(lambda x: x)
        assert result.dtypes[0] == object

        df = DataFrame(data=[1., 'a'])
        result = df.applymap(lambda x: x)
        assert result.dtypes[0] == object

        # see gh-2786
        df = DataFrame(np.random.random((3, 4)))
        df2 = df.copy()
        cols = ['a', 'a', 'a', 'a']
        df.columns = cols

        expected = df2.applymap(str)
        expected.columns = cols
        result = df.applymap(str)
        tm.assert_frame_equal(result, expected)

        # datetime/timedelta
        df['datetime'] = Timestamp('20130101')
        df['timedelta'] = pd.Timedelta('1 min')
        result = df.applymap(str)
        for f in ['datetime', 'timedelta']:
            assert result.loc[0, f] == str(df.loc[0, f])

        # see gh-8222
        empty_frames = [pd.DataFrame(),
                        pd.DataFrame(columns=list('ABC')),
                        pd.DataFrame(index=list('ABC')),
                        pd.DataFrame({'A': [], 'B': [], 'C': []})]
        for frame in empty_frames:
            for func in [round, lambda x: x]:
                result = frame.applymap(func)
                tm.assert_frame_equal(result, frame)

    def test_applymap_box(self):
        # ufunc will not be boxed. Same test cases as the test_map_box
        df = pd.DataFrame({'a': [pd.Timestamp('2011-01-01'),
                                 pd.Timestamp('2011-01-02')],
                           'b': [pd.Timestamp('2011-01-01', tz='US/Eastern'),
                                 pd.Timestamp('2011-01-02', tz='US/Eastern')],
                           'c': [pd.Timedelta('1 days'),
                                 pd.Timedelta('2 days')],
                           'd': [pd.Period('2011-01-01', freq='M'),
                                 pd.Period('2011-01-02', freq='M')]})

        res = df.applymap(lambda x: '{0}'.format(x.__class__.__name__))
        exp = pd.DataFrame({'a': ['Timestamp', 'Timestamp'],
                            'b': ['Timestamp', 'Timestamp'],
                            'c': ['Timedelta', 'Timedelta'],
                            'd': ['Period', 'Period']})
        tm.assert_frame_equal(res, exp)

    def test_frame_apply_dont_convert_datetime64(self):
        from pandas.tseries.offsets import BDay
        df = DataFrame({'x1': [datetime(1996, 1, 1)]})

        df = df.applymap(lambda x: x + BDay())
        df = df.applymap(lambda x: x + BDay())

        assert df.x1.dtype == 'M8[ns]'

    # See gh-12244
    def test_apply_non_numpy_dtype(self):
        df = DataFrame({'dt': pd.date_range(
            "2015-01-01", periods=3, tz='Europe/Brussels')})
        result = df.apply(lambda x: x)
        assert_frame_equal(result, df)

        result = df.apply(lambda x: x + pd.Timedelta('1day'))
        expected = DataFrame({'dt': pd.date_range(
            "2015-01-02", periods=3, tz='Europe/Brussels')})
        assert_frame_equal(result, expected)

        df = DataFrame({'dt': ['a', 'b', 'c', 'a']}, dtype='category')
        result = df.apply(lambda x: x)
        assert_frame_equal(result, df)


def zip_frames(*frames):
    """
    take a list of frames, zip the columns together for each
    assume that these all have the first frame columns

    return a new frame
    """
    columns = frames[0].columns
    zipped = [f[c] for c in columns for f in frames]
    return pd.concat(zipped, axis=1)


class TestDataFrameAggregate(TestData):

    _multiprocess_can_split_ = True

    def test_agg_transform(self):

        with np.errstate(all='ignore'):

            f_sqrt = np.sqrt(self.frame)
            f_abs = np.abs(self.frame)

            # ufunc
            result = self.frame.transform(np.sqrt)
            expected = f_sqrt.copy()
            assert_frame_equal(result, expected)

            result = self.frame.apply(np.sqrt)
            assert_frame_equal(result, expected)

            result = self.frame.transform(np.sqrt)
            assert_frame_equal(result, expected)

            # list-like
            result = self.frame.apply([np.sqrt])
            expected = f_sqrt.copy()
            expected.columns = pd.MultiIndex.from_product(
                [self.frame.columns, ['sqrt']])
            assert_frame_equal(result, expected)

            result = self.frame.transform([np.sqrt])
            assert_frame_equal(result, expected)

            # multiple items in list
            # these are in the order as if we are applying both
            # functions per series and then concatting
            expected = zip_frames(f_sqrt, f_abs)
            expected.columns = pd.MultiIndex.from_product(
                [self.frame.columns, ['sqrt', 'absolute']])
            result = self.frame.apply([np.sqrt, np.abs])
            assert_frame_equal(result, expected)

            result = self.frame.transform(['sqrt', np.abs])
            assert_frame_equal(result, expected)

    def test_transform_and_agg_err(self):
        # cannot both transform and agg
        def f():
            self.frame.transform(['max', 'min'])
        pytest.raises(ValueError, f)

        def f():
            with np.errstate(all='ignore'):
                self.frame.agg(['max', 'sqrt'])
        pytest.raises(ValueError, f)

        def f():
            with np.errstate(all='ignore'):
                self.frame.transform(['max', 'sqrt'])
        pytest.raises(ValueError, f)

        df = pd.DataFrame({'A': range(5), 'B': 5})

        def f():
            with np.errstate(all='ignore'):
                df.agg({'A': ['abs', 'sum'], 'B': ['mean', 'max']})

    def test_demo(self):
        # demonstration tests
        df = pd.DataFrame({'A': range(5), 'B': 5})

        result = df.agg(['min', 'max'])
        expected = DataFrame({'A': [0, 4], 'B': [5, 5]},
                             columns=['A', 'B'],
                             index=['min', 'max'])
        tm.assert_frame_equal(result, expected)

        result = df.agg({'A': ['min', 'max'], 'B': ['sum', 'max']})
        expected = DataFrame({'A': [4.0, 0.0, np.nan],
                              'B': [5.0, np.nan, 25.0]},
                             columns=['A', 'B'],
                             index=['max', 'min', 'sum'])
        tm.assert_frame_equal(result.reindex_like(expected), expected)

    def test_agg_dict_nested_renaming_depr(self):

        df = pd.DataFrame({'A': range(5), 'B': 5})

        # nested renaming
        with tm.assert_produces_warning(FutureWarning):
            df.agg({'A': {'foo': 'min'},
                    'B': {'bar': 'max'}})

    def test_agg_reduce(self):
        # all reducers
        expected = zip_frames(self.frame.mean().to_frame(),
                              self.frame.max().to_frame(),
                              self.frame.sum().to_frame()).T
        expected.index = ['mean', 'max', 'sum']
        result = self.frame.agg(['mean', 'max', 'sum'])
        assert_frame_equal(result, expected)

        # dict input with scalars
        result = self.frame.agg({'A': 'mean', 'B': 'sum'})
        expected = Series([self.frame.A.mean(), self.frame.B.sum()],
                          index=['A', 'B'])
        assert_series_equal(result.reindex_like(expected), expected)

        # dict input with lists
        result = self.frame.agg({'A': ['mean'], 'B': ['sum']})
        expected = DataFrame({'A': Series([self.frame.A.mean()],
                                          index=['mean']),
                              'B': Series([self.frame.B.sum()],
                                          index=['sum'])})
        assert_frame_equal(result.reindex_like(expected), expected)

        # dict input with lists with multiple
        result = self.frame.agg({'A': ['mean', 'sum'],
                                 'B': ['sum', 'max']})
        expected = DataFrame({'A': Series([self.frame.A.mean(),
                                           self.frame.A.sum()],
                                          index=['mean', 'sum']),
                              'B': Series([self.frame.B.sum(),
                                           self.frame.B.max()],
                                          index=['sum', 'max'])})
        assert_frame_equal(result.reindex_like(expected), expected)

    def test_nuiscance_columns(self):

        # GH 15015
        df = DataFrame({'A': [1, 2, 3],
                        'B': [1., 2., 3.],
                        'C': ['foo', 'bar', 'baz'],
                        'D': pd.date_range('20130101', periods=3)})

        result = df.agg('min')
        expected = Series([1, 1., 'bar', pd.Timestamp('20130101')],
                          index=df.columns)
        assert_series_equal(result, expected)

        result = df.agg(['min'])
        expected = DataFrame([[1, 1., 'bar', pd.Timestamp('20130101')]],
                             index=['min'], columns=df.columns)
        assert_frame_equal(result, expected)

        result = df.agg('sum')
        expected = Series([6, 6., 'foobarbaz'],
                          index=['A', 'B', 'C'])
        assert_series_equal(result, expected)

        result = df.agg(['sum'])
        expected = DataFrame([[6, 6., 'foobarbaz']],
                             index=['sum'], columns=['A', 'B', 'C'])
        assert_frame_equal(result, expected)

    def test_non_callable_aggregates(self):

        # GH 16405
        # 'size' is a property of frame/series
        # validate that this is working
        df = DataFrame({'A': [None, 2, 3],
                        'B': [1.0, np.nan, 3.0],
                        'C': ['foo', None, 'bar']})

        # Function aggregate
        result = df.agg({'A': 'count'})
        expected = pd.Series({'A': 2})

        assert_series_equal(result, expected)

        # Non-function aggregate
        result = df.agg({'A': 'size'})
        expected = pd.Series({'A': 3})

        assert_series_equal(result, expected)

        # Mix function and non-function aggs
        result1 = df.agg(['count', 'size'])
        result2 = df.agg({'A': ['count', 'size'],
                          'B': ['count', 'size'],
                          'C': ['count', 'size']})
        expected = pd.DataFrame({'A': {'count': 2, 'size': 3},
                                 'B': {'count': 2, 'size': 3},
                                 'C': {'count': 2, 'size': 3}})

        assert_frame_equal(result1, result2, check_like=True)
        assert_frame_equal(result2, expected, check_like=True)

        # Just functional string arg is same as calling df.arg()
        result = df.agg('count')
        expected = df.count()

        assert_series_equal(result, expected)

        # Just a string attribute arg same as calling df.arg
        result = df.agg('size')
        expected = df.size

        assert result == expected
