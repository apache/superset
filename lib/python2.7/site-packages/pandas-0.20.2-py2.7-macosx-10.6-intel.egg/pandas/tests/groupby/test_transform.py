""" test with the .transform """

import pytest

import numpy as np
import pandas as pd
from pandas.util import testing as tm
from pandas import Series, DataFrame, Timestamp, MultiIndex, concat, date_range
from pandas.core.dtypes.common import (
    _ensure_platform_int, is_timedelta64_dtype)
from pandas.compat import StringIO
from pandas._libs import groupby
from .common import MixIn, assert_fp_equal

from pandas.util.testing import assert_frame_equal, assert_series_equal
from pandas.core.groupby import DataError
from pandas.core.config import option_context


class TestGroupBy(MixIn):

    def test_transform(self):
        data = Series(np.arange(9) // 3, index=np.arange(9))

        index = np.arange(9)
        np.random.shuffle(index)
        data = data.reindex(index)

        grouped = data.groupby(lambda x: x // 3)

        transformed = grouped.transform(lambda x: x * x.sum())
        assert transformed[7] == 12

        # GH 8046
        # make sure that we preserve the input order

        df = DataFrame(
            np.arange(6, dtype='int64').reshape(
                3, 2), columns=["a", "b"], index=[0, 2, 1])
        key = [0, 0, 1]
        expected = df.sort_index().groupby(key).transform(
            lambda x: x - x.mean()).groupby(key).mean()
        result = df.groupby(key).transform(lambda x: x - x.mean()).groupby(
            key).mean()
        assert_frame_equal(result, expected)

        def demean(arr):
            return arr - arr.mean()

        people = DataFrame(np.random.randn(5, 5),
                           columns=['a', 'b', 'c', 'd', 'e'],
                           index=['Joe', 'Steve', 'Wes', 'Jim', 'Travis'])
        key = ['one', 'two', 'one', 'two', 'one']
        result = people.groupby(key).transform(demean).groupby(key).mean()
        expected = people.groupby(key).apply(demean).groupby(key).mean()
        assert_frame_equal(result, expected)

        # GH 8430
        df = tm.makeTimeDataFrame()
        g = df.groupby(pd.TimeGrouper('M'))
        g.transform(lambda x: x - 1)

        # GH 9700
        df = DataFrame({'a': range(5, 10), 'b': range(5)})
        result = df.groupby('a').transform(max)
        expected = DataFrame({'b': range(5)})
        tm.assert_frame_equal(result, expected)

    def test_transform_fast(self):

        df = DataFrame({'id': np.arange(100000) / 3,
                        'val': np.random.randn(100000)})

        grp = df.groupby('id')['val']

        values = np.repeat(grp.mean().values,
                           _ensure_platform_int(grp.count().values))
        expected = pd.Series(values, index=df.index, name='val')

        result = grp.transform(np.mean)
        assert_series_equal(result, expected)

        result = grp.transform('mean')
        assert_series_equal(result, expected)

        # GH 12737
        df = pd.DataFrame({'grouping': [0, 1, 1, 3], 'f': [1.1, 2.1, 3.1, 4.5],
                           'd': pd.date_range('2014-1-1', '2014-1-4'),
                           'i': [1, 2, 3, 4]},
                          columns=['grouping', 'f', 'i', 'd'])
        result = df.groupby('grouping').transform('first')

        dates = [pd.Timestamp('2014-1-1'), pd.Timestamp('2014-1-2'),
                 pd.Timestamp('2014-1-2'), pd.Timestamp('2014-1-4')]
        expected = pd.DataFrame({'f': [1.1, 2.1, 2.1, 4.5],
                                 'd': dates,
                                 'i': [1, 2, 2, 4]},
                                columns=['f', 'i', 'd'])
        assert_frame_equal(result, expected)

        # selection
        result = df.groupby('grouping')[['f', 'i']].transform('first')
        expected = expected[['f', 'i']]
        assert_frame_equal(result, expected)

        # dup columns
        df = pd.DataFrame([[1, 2, 3], [4, 5, 6]], columns=['g', 'a', 'a'])
        result = df.groupby('g').transform('first')
        expected = df.drop('g', axis=1)
        assert_frame_equal(result, expected)

    def test_transform_broadcast(self):
        grouped = self.ts.groupby(lambda x: x.month)
        result = grouped.transform(np.mean)

        tm.assert_index_equal(result.index, self.ts.index)
        for _, gp in grouped:
            assert_fp_equal(result.reindex(gp.index), gp.mean())

        grouped = self.tsframe.groupby(lambda x: x.month)
        result = grouped.transform(np.mean)
        tm.assert_index_equal(result.index, self.tsframe.index)
        for _, gp in grouped:
            agged = gp.mean()
            res = result.reindex(gp.index)
            for col in self.tsframe:
                assert_fp_equal(res[col], agged[col])

        # group columns
        grouped = self.tsframe.groupby({'A': 0, 'B': 0, 'C': 1, 'D': 1},
                                       axis=1)
        result = grouped.transform(np.mean)
        tm.assert_index_equal(result.index, self.tsframe.index)
        tm.assert_index_equal(result.columns, self.tsframe.columns)
        for _, gp in grouped:
            agged = gp.mean(1)
            res = result.reindex(columns=gp.columns)
            for idx in gp.index:
                assert_fp_equal(res.xs(idx), agged[idx])

    def test_transform_axis(self):

        # make sure that we are setting the axes
        # correctly when on axis=0 or 1
        # in the presence of a non-monotonic indexer
        # GH12713

        base = self.tsframe.iloc[0:5]
        r = len(base.index)
        c = len(base.columns)
        tso = DataFrame(np.random.randn(r, c),
                        index=base.index,
                        columns=base.columns,
                        dtype='float64')
        # monotonic
        ts = tso
        grouped = ts.groupby(lambda x: x.weekday())
        result = ts - grouped.transform('mean')
        expected = grouped.apply(lambda x: x - x.mean())
        assert_frame_equal(result, expected)

        ts = ts.T
        grouped = ts.groupby(lambda x: x.weekday(), axis=1)
        result = ts - grouped.transform('mean')
        expected = grouped.apply(lambda x: (x.T - x.mean(1)).T)
        assert_frame_equal(result, expected)

        # non-monotonic
        ts = tso.iloc[[1, 0] + list(range(2, len(base)))]
        grouped = ts.groupby(lambda x: x.weekday())
        result = ts - grouped.transform('mean')
        expected = grouped.apply(lambda x: x - x.mean())
        assert_frame_equal(result, expected)

        ts = ts.T
        grouped = ts.groupby(lambda x: x.weekday(), axis=1)
        result = ts - grouped.transform('mean')
        expected = grouped.apply(lambda x: (x.T - x.mean(1)).T)
        assert_frame_equal(result, expected)

    def test_transform_dtype(self):
        # GH 9807
        # Check transform dtype output is preserved
        df = DataFrame([[1, 3], [2, 3]])
        result = df.groupby(1).transform('mean')
        expected = DataFrame([[1.5], [1.5]])
        assert_frame_equal(result, expected)

    def test_transform_bug(self):
        # GH 5712
        # transforming on a datetime column
        df = DataFrame(dict(A=Timestamp('20130101'), B=np.arange(5)))
        result = df.groupby('A')['B'].transform(
            lambda x: x.rank(ascending=False))
        expected = Series(np.arange(5, 0, step=-1), name='B')
        assert_series_equal(result, expected)

    def test_transform_datetime_to_timedelta(self):
        # GH 15429
        # transforming a datetime to timedelta
        df = DataFrame(dict(A=Timestamp('20130101'), B=np.arange(5)))
        expected = pd.Series([
            Timestamp('20130101') - Timestamp('20130101')] * 5, name='A')

        # this does date math without changing result type in transform
        base_time = df['A'][0]
        result = df.groupby('A')['A'].transform(
            lambda x: x.max() - x.min() + base_time) - base_time
        assert_series_equal(result, expected)

        # this does date math and causes the transform to return timedelta
        result = df.groupby('A')['A'].transform(lambda x: x.max() - x.min())
        assert_series_equal(result, expected)

    def test_transform_datetime_to_numeric(self):
        # GH 10972
        # convert dt to float
        df = DataFrame({
            'a': 1, 'b': date_range('2015-01-01', periods=2, freq='D')})
        result = df.groupby('a').b.transform(
            lambda x: x.dt.dayofweek - x.dt.dayofweek.mean())

        expected = Series([-0.5, 0.5], name='b')
        assert_series_equal(result, expected)

        # convert dt to int
        df = DataFrame({
            'a': 1, 'b': date_range('2015-01-01', periods=2, freq='D')})
        result = df.groupby('a').b.transform(
            lambda x: x.dt.dayofweek - x.dt.dayofweek.min())

        expected = Series([0, 1], name='b')
        assert_series_equal(result, expected)

    def test_transform_casting(self):
        # 13046
        data = """
        idx     A         ID3              DATETIME
        0   B-028  b76cd912ff "2014-10-08 13:43:27"
        1   B-054  4a57ed0b02 "2014-10-08 14:26:19"
        2   B-076  1a682034f8 "2014-10-08 14:29:01"
        3   B-023  b76cd912ff "2014-10-08 18:39:34"
        4   B-023  f88g8d7sds "2014-10-08 18:40:18"
        5   B-033  b76cd912ff "2014-10-08 18:44:30"
        6   B-032  b76cd912ff "2014-10-08 18:46:00"
        7   B-037  b76cd912ff "2014-10-08 18:52:15"
        8   B-046  db959faf02 "2014-10-08 18:59:59"
        9   B-053  b76cd912ff "2014-10-08 19:17:48"
        10  B-065  b76cd912ff "2014-10-08 19:21:38"
        """
        df = pd.read_csv(StringIO(data), sep='\s+',
                         index_col=[0], parse_dates=['DATETIME'])

        result = df.groupby('ID3')['DATETIME'].transform(lambda x: x.diff())
        assert is_timedelta64_dtype(result.dtype)

        result = df[['ID3', 'DATETIME']].groupby('ID3').transform(
            lambda x: x.diff())
        assert is_timedelta64_dtype(result.DATETIME.dtype)

    def test_transform_multiple(self):
        grouped = self.ts.groupby([lambda x: x.year, lambda x: x.month])

        grouped.transform(lambda x: x * 2)
        grouped.transform(np.mean)

    def test_dispatch_transform(self):
        df = self.tsframe[::5].reindex(self.tsframe.index)

        grouped = df.groupby(lambda x: x.month)

        filled = grouped.fillna(method='pad')
        fillit = lambda x: x.fillna(method='pad')
        expected = df.groupby(lambda x: x.month).transform(fillit)
        assert_frame_equal(filled, expected)

    def test_transform_select_columns(self):
        f = lambda x: x.mean()
        result = self.df.groupby('A')['C', 'D'].transform(f)

        selection = self.df[['C', 'D']]
        expected = selection.groupby(self.df['A']).transform(f)

        assert_frame_equal(result, expected)

    def test_transform_exclude_nuisance(self):

        # this also tests orderings in transform between
        # series/frame to make sure it's consistent
        expected = {}
        grouped = self.df.groupby('A')
        expected['C'] = grouped['C'].transform(np.mean)
        expected['D'] = grouped['D'].transform(np.mean)
        expected = DataFrame(expected)
        result = self.df.groupby('A').transform(np.mean)

        assert_frame_equal(result, expected)

    def test_transform_function_aliases(self):
        result = self.df.groupby('A').transform('mean')
        expected = self.df.groupby('A').transform(np.mean)
        assert_frame_equal(result, expected)

        result = self.df.groupby('A')['C'].transform('mean')
        expected = self.df.groupby('A')['C'].transform(np.mean)
        assert_series_equal(result, expected)

    def test_series_fast_transform_date(self):
        # GH 13191
        df = pd.DataFrame({'grouping': [np.nan, 1, 1, 3],
                           'd': pd.date_range('2014-1-1', '2014-1-4')})
        result = df.groupby('grouping')['d'].transform('first')
        dates = [pd.NaT, pd.Timestamp('2014-1-2'), pd.Timestamp('2014-1-2'),
                 pd.Timestamp('2014-1-4')]
        expected = pd.Series(dates, name='d')
        assert_series_equal(result, expected)

    def test_transform_length(self):
        # GH 9697
        df = pd.DataFrame({'col1': [1, 1, 2, 2], 'col2': [1, 2, 3, np.nan]})
        expected = pd.Series([3.0] * 4)

        def nsum(x):
            return np.nansum(x)

        results = [df.groupby('col1').transform(sum)['col2'],
                   df.groupby('col1')['col2'].transform(sum),
                   df.groupby('col1').transform(nsum)['col2'],
                   df.groupby('col1')['col2'].transform(nsum)]
        for result in results:
            assert_series_equal(result, expected, check_names=False)

    def test_transform_coercion(self):

        # 14457
        # when we are transforming be sure to not coerce
        # via assignment
        df = pd.DataFrame(dict(A=['a', 'a'], B=[0, 1]))
        g = df.groupby('A')

        expected = g.transform(np.mean)
        result = g.transform(lambda x: np.mean(x))
        assert_frame_equal(result, expected)

    def test_groupby_transform_with_int(self):

        # GH 3740, make sure that we might upcast on item-by-item transform

        # floats
        df = DataFrame(dict(A=[1, 1, 1, 2, 2, 2], B=Series(1, dtype='float64'),
                            C=Series(
                                [1, 2, 3, 1, 2, 3], dtype='float64'), D='foo'))
        with np.errstate(all='ignore'):
            result = df.groupby('A').transform(
                lambda x: (x - x.mean()) / x.std())
        expected = DataFrame(dict(B=np.nan, C=Series(
            [-1, 0, 1, -1, 0, 1], dtype='float64')))
        assert_frame_equal(result, expected)

        # int case
        df = DataFrame(dict(A=[1, 1, 1, 2, 2, 2], B=1,
                            C=[1, 2, 3, 1, 2, 3], D='foo'))
        with np.errstate(all='ignore'):
            result = df.groupby('A').transform(
                lambda x: (x - x.mean()) / x.std())
        expected = DataFrame(dict(B=np.nan, C=[-1, 0, 1, -1, 0, 1]))
        assert_frame_equal(result, expected)

        # int that needs float conversion
        s = Series([2, 3, 4, 10, 5, -1])
        df = DataFrame(dict(A=[1, 1, 1, 2, 2, 2], B=1, C=s, D='foo'))
        with np.errstate(all='ignore'):
            result = df.groupby('A').transform(
                lambda x: (x - x.mean()) / x.std())

        s1 = s.iloc[0:3]
        s1 = (s1 - s1.mean()) / s1.std()
        s2 = s.iloc[3:6]
        s2 = (s2 - s2.mean()) / s2.std()
        expected = DataFrame(dict(B=np.nan, C=concat([s1, s2])))
        assert_frame_equal(result, expected)

        # int downcasting
        result = df.groupby('A').transform(lambda x: x * 2 / 2)
        expected = DataFrame(dict(B=1, C=[2, 3, 4, 10, 5, -1]))
        assert_frame_equal(result, expected)

    def test_groupby_transform_with_nan_group(self):
        # GH 9941
        df = pd.DataFrame({'a': range(10),
                           'b': [1, 1, 2, 3, np.nan, 4, 4, 5, 5, 5]})
        result = df.groupby(df.b)['a'].transform(max)
        expected = pd.Series([1., 1., 2., 3., np.nan, 6., 6., 9., 9., 9.],
                             name='a')
        assert_series_equal(result, expected)

    def test_transform_mixed_type(self):
        index = MultiIndex.from_arrays([[0, 0, 0, 1, 1, 1], [1, 2, 3, 1, 2, 3]
                                        ])
        df = DataFrame({'d': [1., 1., 1., 2., 2., 2.],
                        'c': np.tile(['a', 'b', 'c'], 2),
                        'v': np.arange(1., 7.)}, index=index)

        def f(group):
            group['g'] = group['d'] * 2
            return group[:1]

        grouped = df.groupby('c')
        result = grouped.apply(f)

        assert result['d'].dtype == np.float64

        # this is by definition a mutating operation!
        with option_context('mode.chained_assignment', None):
            for key, group in grouped:
                res = f(group)
                assert_frame_equal(res, result.loc[key])

    def test_cython_group_transform_algos(self):
        # GH 4095
        dtypes = [np.int8, np.int16, np.int32, np.int64, np.uint8, np.uint32,
                  np.uint64, np.float32, np.float64]

        ops = [(groupby.group_cumprod_float64, np.cumproduct, [np.float64]),
               (groupby.group_cumsum, np.cumsum, dtypes)]

        is_datetimelike = False
        for pd_op, np_op, dtypes in ops:
            for dtype in dtypes:
                data = np.array([[1], [2], [3], [4]], dtype=dtype)
                ans = np.zeros_like(data)
                labels = np.array([0, 0, 0, 0], dtype=np.int64)
                pd_op(ans, data, labels, is_datetimelike)
                tm.assert_numpy_array_equal(np_op(data), ans[:, 0],
                                            check_dtype=False)

        # with nans
        labels = np.array([0, 0, 0, 0, 0], dtype=np.int64)

        data = np.array([[1], [2], [3], [np.nan], [4]], dtype='float64')
        actual = np.zeros_like(data)
        actual.fill(np.nan)
        groupby.group_cumprod_float64(actual, data, labels, is_datetimelike)
        expected = np.array([1, 2, 6, np.nan, 24], dtype='float64')
        tm.assert_numpy_array_equal(actual[:, 0], expected)

        actual = np.zeros_like(data)
        actual.fill(np.nan)
        groupby.group_cumsum(actual, data, labels, is_datetimelike)
        expected = np.array([1, 3, 6, np.nan, 10], dtype='float64')
        tm.assert_numpy_array_equal(actual[:, 0], expected)

        # timedelta
        is_datetimelike = True
        data = np.array([np.timedelta64(1, 'ns')] * 5, dtype='m8[ns]')[:, None]
        actual = np.zeros_like(data, dtype='int64')
        groupby.group_cumsum(actual, data.view('int64'), labels,
                             is_datetimelike)
        expected = np.array([np.timedelta64(1, 'ns'), np.timedelta64(
            2, 'ns'), np.timedelta64(3, 'ns'), np.timedelta64(4, 'ns'),
            np.timedelta64(5, 'ns')])
        tm.assert_numpy_array_equal(actual[:, 0].view('m8[ns]'), expected)

    def test_cython_transform(self):
        # GH 4095
        ops = [(('cumprod',
                 ()), lambda x: x.cumprod()), (('cumsum', ()),
                                               lambda x: x.cumsum()),
               (('shift', (-1, )),
                lambda x: x.shift(-1)), (('shift',
                                          (1, )), lambda x: x.shift())]

        s = Series(np.random.randn(1000))
        s_missing = s.copy()
        s_missing.iloc[2:10] = np.nan
        labels = np.random.randint(0, 50, size=1000).astype(float)

        # series
        for (op, args), targop in ops:
            for data in [s, s_missing]:
                # print(data.head())
                expected = data.groupby(labels).transform(targop)

                tm.assert_series_equal(expected,
                                       data.groupby(labels).transform(op,
                                                                      *args))
                tm.assert_series_equal(expected, getattr(
                    data.groupby(labels), op)(*args))

        strings = list('qwertyuiopasdfghjklz')
        strings_missing = strings[:]
        strings_missing[5] = np.nan
        df = DataFrame({'float': s,
                        'float_missing': s_missing,
                        'int': [1, 1, 1, 1, 2] * 200,
                        'datetime': pd.date_range('1990-1-1', periods=1000),
                        'timedelta': pd.timedelta_range(1, freq='s',
                                                        periods=1000),
                        'string': strings * 50,
                        'string_missing': strings_missing * 50})
        df['cat'] = df['string'].astype('category')

        df2 = df.copy()
        df2.index = pd.MultiIndex.from_product([range(100), range(10)])

        # DataFrame - Single and MultiIndex,
        # group by values, index level, columns
        for df in [df, df2]:
            for gb_target in [dict(by=labels), dict(level=0), dict(by='string')
                              ]:  # dict(by='string_missing')]:
                # dict(by=['int','string'])]:

                gb = df.groupby(**gb_target)
                # whitelisted methods set the selection before applying
                # bit a of hack to make sure the cythonized shift
                # is equivalent to pre 0.17.1 behavior
                if op == 'shift':
                    gb._set_group_selection()

                for (op, args), targop in ops:
                    if op != 'shift' and 'int' not in gb_target:
                        # numeric apply fastpath promotes dtype so have
                        # to apply seperately and concat
                        i = gb[['int']].apply(targop)
                        f = gb[['float', 'float_missing']].apply(targop)
                        expected = pd.concat([f, i], axis=1)
                    else:
                        expected = gb.apply(targop)

                    expected = expected.sort_index(axis=1)
                    tm.assert_frame_equal(expected,
                                          gb.transform(op, *args).sort_index(
                                              axis=1))
                    tm.assert_frame_equal(expected, getattr(gb, op)(*args))
                    # individual columns
                    for c in df:
                        if c not in ['float', 'int', 'float_missing'
                                     ] and op != 'shift':
                            pytest.raises(DataError, gb[c].transform, op)
                            pytest.raises(DataError, getattr(gb[c], op))
                        else:
                            expected = gb[c].apply(targop)
                            expected.name = c
                            tm.assert_series_equal(expected,
                                                   gb[c].transform(op, *args))
                            tm.assert_series_equal(expected,
                                                   getattr(gb[c], op)(*args))

    def test_transform_with_non_scalar_group(self):
        # GH 10165
        cols = pd.MultiIndex.from_tuples([
            ('syn', 'A'), ('mis', 'A'), ('non', 'A'),
            ('syn', 'C'), ('mis', 'C'), ('non', 'C'),
            ('syn', 'T'), ('mis', 'T'), ('non', 'T'),
            ('syn', 'G'), ('mis', 'G'), ('non', 'G')])
        df = pd.DataFrame(np.random.randint(1, 10, (4, 12)),
                          columns=cols,
                          index=['A', 'C', 'G', 'T'])
        tm.assert_raises_regex(ValueError, 'transform must return '
                               'a scalar value for each '
                               'group.*',
                               df.groupby(axis=1, level=1).transform,
                               lambda z: z.div(z.sum(axis=1), axis=0))
