# -*- coding: utf-8 -*-
# pylint: disable-msg=W0612,E1101,W0141
from warnings import catch_warnings
import datetime
import itertools
import pytest

from numpy.random import randn
import numpy as np

from pandas.core.index import Index, MultiIndex
from pandas import Panel, DataFrame, Series, notnull, isnull, Timestamp

from pandas.core.dtypes.common import is_float_dtype, is_integer_dtype
import pandas.core.common as com
import pandas.util.testing as tm
from pandas.compat import (range, lrange, StringIO, lzip, u, product as
                           cart_product, zip)
import pandas as pd
import pandas._libs.index as _index


class Base(object):

    def setup_method(self, method):

        index = MultiIndex(levels=[['foo', 'bar', 'baz', 'qux'], ['one', 'two',
                                                                  'three']],
                           labels=[[0, 0, 0, 1, 1, 2, 2, 3, 3, 3],
                                   [0, 1, 2, 0, 1, 1, 2, 0, 1, 2]],
                           names=['first', 'second'])
        self.frame = DataFrame(np.random.randn(10, 3), index=index,
                               columns=Index(['A', 'B', 'C'], name='exp'))

        self.single_level = MultiIndex(levels=[['foo', 'bar', 'baz', 'qux']],
                                       labels=[[0, 1, 2, 3]], names=['first'])

        # create test series object
        arrays = [['bar', 'bar', 'baz', 'baz', 'qux', 'qux', 'foo', 'foo'],
                  ['one', 'two', 'one', 'two', 'one', 'two', 'one', 'two']]
        tuples = lzip(*arrays)
        index = MultiIndex.from_tuples(tuples)
        s = Series(randn(8), index=index)
        s[3] = np.NaN
        self.series = s

        tm.N = 100
        self.tdf = tm.makeTimeDataFrame()
        self.ymd = self.tdf.groupby([lambda x: x.year, lambda x: x.month,
                                     lambda x: x.day]).sum()

        # use Int64Index, to make sure things work
        self.ymd.index.set_levels([lev.astype('i8')
                                   for lev in self.ymd.index.levels],
                                  inplace=True)
        self.ymd.index.set_names(['year', 'month', 'day'], inplace=True)


class TestMultiLevel(Base):

    def test_append(self):
        a, b = self.frame[:5], self.frame[5:]

        result = a.append(b)
        tm.assert_frame_equal(result, self.frame)

        result = a['A'].append(b['A'])
        tm.assert_series_equal(result, self.frame['A'])

    def test_append_index(self):
        tm._skip_if_no_pytz()

        idx1 = Index([1.1, 1.2, 1.3])
        idx2 = pd.date_range('2011-01-01', freq='D', periods=3,
                             tz='Asia/Tokyo')
        idx3 = Index(['A', 'B', 'C'])

        midx_lv2 = MultiIndex.from_arrays([idx1, idx2])
        midx_lv3 = MultiIndex.from_arrays([idx1, idx2, idx3])

        result = idx1.append(midx_lv2)

        # GH 7112
        import pytz
        tz = pytz.timezone('Asia/Tokyo')
        expected_tuples = [(1.1, tz.localize(datetime.datetime(2011, 1, 1))),
                           (1.2, tz.localize(datetime.datetime(2011, 1, 2))),
                           (1.3, tz.localize(datetime.datetime(2011, 1, 3)))]
        expected = Index([1.1, 1.2, 1.3] + expected_tuples)
        tm.assert_index_equal(result, expected)

        result = midx_lv2.append(idx1)
        expected = Index(expected_tuples + [1.1, 1.2, 1.3])
        tm.assert_index_equal(result, expected)

        result = midx_lv2.append(midx_lv2)
        expected = MultiIndex.from_arrays([idx1.append(idx1),
                                           idx2.append(idx2)])
        tm.assert_index_equal(result, expected)

        result = midx_lv2.append(midx_lv3)
        tm.assert_index_equal(result, expected)

        result = midx_lv3.append(midx_lv2)
        expected = Index._simple_new(
            np.array([(1.1, tz.localize(datetime.datetime(2011, 1, 1)), 'A'),
                      (1.2, tz.localize(datetime.datetime(2011, 1, 2)), 'B'),
                      (1.3, tz.localize(datetime.datetime(2011, 1, 3)), 'C')] +
                     expected_tuples), None)
        tm.assert_index_equal(result, expected)

    def test_dataframe_constructor(self):
        multi = DataFrame(np.random.randn(4, 4),
                          index=[np.array(['a', 'a', 'b', 'b']),
                                 np.array(['x', 'y', 'x', 'y'])])
        assert isinstance(multi.index, MultiIndex)
        assert not isinstance(multi.columns, MultiIndex)

        multi = DataFrame(np.random.randn(4, 4),
                          columns=[['a', 'a', 'b', 'b'],
                                   ['x', 'y', 'x', 'y']])
        assert isinstance(multi.columns, MultiIndex)

    def test_series_constructor(self):
        multi = Series(1., index=[np.array(['a', 'a', 'b', 'b']), np.array(
            ['x', 'y', 'x', 'y'])])
        assert isinstance(multi.index, MultiIndex)

        multi = Series(1., index=[['a', 'a', 'b', 'b'], ['x', 'y', 'x', 'y']])
        assert isinstance(multi.index, MultiIndex)

        multi = Series(lrange(4), index=[['a', 'a', 'b', 'b'],
                                         ['x', 'y', 'x', 'y']])
        assert isinstance(multi.index, MultiIndex)

    def test_reindex_level(self):
        # axis=0
        month_sums = self.ymd.sum(level='month')
        result = month_sums.reindex(self.ymd.index, level=1)
        expected = self.ymd.groupby(level='month').transform(np.sum)

        tm.assert_frame_equal(result, expected)

        # Series
        result = month_sums['A'].reindex(self.ymd.index, level=1)
        expected = self.ymd['A'].groupby(level='month').transform(np.sum)
        tm.assert_series_equal(result, expected, check_names=False)

        # axis=1
        month_sums = self.ymd.T.sum(axis=1, level='month')
        result = month_sums.reindex(columns=self.ymd.index, level=1)
        expected = self.ymd.groupby(level='month').transform(np.sum).T
        tm.assert_frame_equal(result, expected)

    def test_binops_level(self):
        def _check_op(opname):
            op = getattr(DataFrame, opname)
            month_sums = self.ymd.sum(level='month')
            result = op(self.ymd, month_sums, level='month')

            broadcasted = self.ymd.groupby(level='month').transform(np.sum)
            expected = op(self.ymd, broadcasted)
            tm.assert_frame_equal(result, expected)

            # Series
            op = getattr(Series, opname)
            result = op(self.ymd['A'], month_sums['A'], level='month')
            broadcasted = self.ymd['A'].groupby(level='month').transform(
                np.sum)
            expected = op(self.ymd['A'], broadcasted)
            expected.name = 'A'
            tm.assert_series_equal(result, expected)

        _check_op('sub')
        _check_op('add')
        _check_op('mul')
        _check_op('div')

    def test_pickle(self):
        def _test_roundtrip(frame):
            unpickled = tm.round_trip_pickle(frame)
            tm.assert_frame_equal(frame, unpickled)

        _test_roundtrip(self.frame)
        _test_roundtrip(self.frame.T)
        _test_roundtrip(self.ymd)
        _test_roundtrip(self.ymd.T)

    def test_reindex(self):
        expected = self.frame.iloc[[0, 3]]
        reindexed = self.frame.loc[[('foo', 'one'), ('bar', 'one')]]
        tm.assert_frame_equal(reindexed, expected)

        with catch_warnings(record=True):
            reindexed = self.frame.ix[[('foo', 'one'), ('bar', 'one')]]
        tm.assert_frame_equal(reindexed, expected)

    def test_reindex_preserve_levels(self):
        new_index = self.ymd.index[::10]
        chunk = self.ymd.reindex(new_index)
        assert chunk.index is new_index

        chunk = self.ymd.loc[new_index]
        assert chunk.index is new_index

        with catch_warnings(record=True):
            chunk = self.ymd.ix[new_index]
        assert chunk.index is new_index

        ymdT = self.ymd.T
        chunk = ymdT.reindex(columns=new_index)
        assert chunk.columns is new_index

        chunk = ymdT.loc[:, new_index]
        assert chunk.columns is new_index

    def test_repr_to_string(self):
        repr(self.frame)
        repr(self.ymd)
        repr(self.frame.T)
        repr(self.ymd.T)

        buf = StringIO()
        self.frame.to_string(buf=buf)
        self.ymd.to_string(buf=buf)
        self.frame.T.to_string(buf=buf)
        self.ymd.T.to_string(buf=buf)

    def test_repr_name_coincide(self):
        index = MultiIndex.from_tuples([('a', 0, 'foo'), ('b', 1, 'bar')],
                                       names=['a', 'b', 'c'])

        df = DataFrame({'value': [0, 1]}, index=index)

        lines = repr(df).split('\n')
        assert lines[2].startswith('a 0 foo')

    def test_getitem_simple(self):
        df = self.frame.T

        col = df['foo', 'one']
        tm.assert_almost_equal(col.values, df.values[:, 0])
        with pytest.raises(KeyError):
            df[('foo', 'four')]
        with pytest.raises(KeyError):
            df['foobar']

    def test_series_getitem(self):
        s = self.ymd['A']

        result = s[2000, 3]

        # TODO(wesm): unused?
        # result2 = s.loc[2000, 3]

        expected = s.reindex(s.index[42:65])
        expected.index = expected.index.droplevel(0).droplevel(0)
        tm.assert_series_equal(result, expected)

        result = s[2000, 3, 10]
        expected = s[49]
        assert result == expected

        # fancy
        expected = s.reindex(s.index[49:51])
        result = s.loc[[(2000, 3, 10), (2000, 3, 13)]]
        tm.assert_series_equal(result, expected)

        with catch_warnings(record=True):
            result = s.ix[[(2000, 3, 10), (2000, 3, 13)]]
        tm.assert_series_equal(result, expected)

        # key error
        pytest.raises(KeyError, s.__getitem__, (2000, 3, 4))

    def test_series_getitem_corner(self):
        s = self.ymd['A']

        # don't segfault, GH #495
        # out of bounds access
        pytest.raises(IndexError, s.__getitem__, len(self.ymd))

        # generator
        result = s[(x > 0 for x in s)]
        expected = s[s > 0]
        tm.assert_series_equal(result, expected)

    def test_series_setitem(self):
        s = self.ymd['A']

        s[2000, 3] = np.nan
        assert isnull(s.values[42:65]).all()
        assert notnull(s.values[:42]).all()
        assert notnull(s.values[65:]).all()

        s[2000, 3, 10] = np.nan
        assert isnull(s[49])

    def test_series_slice_partial(self):
        pass

    def test_frame_getitem_setitem_boolean(self):
        df = self.frame.T.copy()
        values = df.values

        result = df[df > 0]
        expected = df.where(df > 0)
        tm.assert_frame_equal(result, expected)

        df[df > 0] = 5
        values[values > 0] = 5
        tm.assert_almost_equal(df.values, values)

        df[df == 5] = 0
        values[values == 5] = 0
        tm.assert_almost_equal(df.values, values)

        # a df that needs alignment first
        df[df[:-1] < 0] = 2
        np.putmask(values[:-1], values[:-1] < 0, 2)
        tm.assert_almost_equal(df.values, values)

        with tm.assert_raises_regex(TypeError, 'boolean values only'):
            df[df * 0] = 2

    def test_frame_getitem_setitem_slice(self):
        # getitem
        result = self.frame.iloc[:4]
        expected = self.frame[:4]
        tm.assert_frame_equal(result, expected)

        # setitem
        cp = self.frame.copy()
        cp.iloc[:4] = 0

        assert (cp.values[:4] == 0).all()
        assert (cp.values[4:] != 0).all()

    def test_frame_getitem_setitem_multislice(self):
        levels = [['t1', 't2'], ['a', 'b', 'c']]
        labels = [[0, 0, 0, 1, 1], [0, 1, 2, 0, 1]]
        midx = MultiIndex(labels=labels, levels=levels, names=[None, 'id'])
        df = DataFrame({'value': [1, 2, 3, 7, 8]}, index=midx)

        result = df.loc[:, 'value']
        tm.assert_series_equal(df['value'], result)

        with catch_warnings(record=True):
            result = df.ix[:, 'value']
        tm.assert_series_equal(df['value'], result)

        result = df.loc[df.index[1:3], 'value']
        tm.assert_series_equal(df['value'][1:3], result)

        result = df.loc[:, :]
        tm.assert_frame_equal(df, result)

        result = df
        df.loc[:, 'value'] = 10
        result['value'] = 10
        tm.assert_frame_equal(df, result)

        df.loc[:, :] = 10
        tm.assert_frame_equal(df, result)

    def test_frame_getitem_multicolumn_empty_level(self):
        f = DataFrame({'a': ['1', '2', '3'], 'b': ['2', '3', '4']})
        f.columns = [['level1 item1', 'level1 item2'], ['', 'level2 item2'],
                     ['level3 item1', 'level3 item2']]

        result = f['level1 item1']
        expected = DataFrame([['1'], ['2'], ['3']], index=f.index,
                             columns=['level3 item1'])
        tm.assert_frame_equal(result, expected)

    def test_frame_setitem_multi_column(self):
        df = DataFrame(randn(10, 4), columns=[['a', 'a', 'b', 'b'],
                                              [0, 1, 0, 1]])

        cp = df.copy()
        cp['a'] = cp['b']
        tm.assert_frame_equal(cp['a'], cp['b'])

        # set with ndarray
        cp = df.copy()
        cp['a'] = cp['b'].values
        tm.assert_frame_equal(cp['a'], cp['b'])

        # ---------------------------------------
        # #1803
        columns = MultiIndex.from_tuples([('A', '1'), ('A', '2'), ('B', '1')])
        df = DataFrame(index=[1, 3, 5], columns=columns)

        # Works, but adds a column instead of updating the two existing ones
        df['A'] = 0.0  # Doesn't work
        assert (df['A'].values == 0).all()

        # it broadcasts
        df['B', '1'] = [1, 2, 3]
        df['A'] = df['B', '1']

        sliced_a1 = df['A', '1']
        sliced_a2 = df['A', '2']
        sliced_b1 = df['B', '1']
        tm.assert_series_equal(sliced_a1, sliced_b1, check_names=False)
        tm.assert_series_equal(sliced_a2, sliced_b1, check_names=False)
        assert sliced_a1.name == ('A', '1')
        assert sliced_a2.name == ('A', '2')
        assert sliced_b1.name == ('B', '1')

    def test_getitem_tuple_plus_slice(self):
        # GH #671
        df = DataFrame({'a': lrange(10),
                        'b': lrange(10),
                        'c': np.random.randn(10),
                        'd': np.random.randn(10)})

        idf = df.set_index(['a', 'b'])

        result = idf.loc[(0, 0), :]
        expected = idf.loc[0, 0]
        expected2 = idf.xs((0, 0))
        with catch_warnings(record=True):
            expected3 = idf.ix[0, 0]

        tm.assert_series_equal(result, expected)
        tm.assert_series_equal(result, expected2)
        tm.assert_series_equal(result, expected3)

    def test_getitem_setitem_tuple_plus_columns(self):
        # GH #1013

        df = self.ymd[:5]

        result = df.loc[(2000, 1, 6), ['A', 'B', 'C']]
        expected = df.loc[2000, 1, 6][['A', 'B', 'C']]
        tm.assert_series_equal(result, expected)

    def test_xs(self):
        xs = self.frame.xs(('bar', 'two'))
        xs2 = self.frame.loc[('bar', 'two')]

        tm.assert_series_equal(xs, xs2)
        tm.assert_almost_equal(xs.values, self.frame.values[4])

        # GH 6574
        # missing values in returned index should be preserrved
        acc = [
            ('a', 'abcde', 1),
            ('b', 'bbcde', 2),
            ('y', 'yzcde', 25),
            ('z', 'xbcde', 24),
            ('z', None, 26),
            ('z', 'zbcde', 25),
            ('z', 'ybcde', 26),
        ]
        df = DataFrame(acc,
                       columns=['a1', 'a2', 'cnt']).set_index(['a1', 'a2'])
        expected = DataFrame({'cnt': [24, 26, 25, 26]}, index=Index(
            ['xbcde', np.nan, 'zbcde', 'ybcde'], name='a2'))

        result = df.xs('z', level='a1')
        tm.assert_frame_equal(result, expected)

    def test_xs_partial(self):
        result = self.frame.xs('foo')
        result2 = self.frame.loc['foo']
        expected = self.frame.T['foo'].T
        tm.assert_frame_equal(result, expected)
        tm.assert_frame_equal(result, result2)

        result = self.ymd.xs((2000, 4))
        expected = self.ymd.loc[2000, 4]
        tm.assert_frame_equal(result, expected)

        # ex from #1796
        index = MultiIndex(levels=[['foo', 'bar'], ['one', 'two'], [-1, 1]],
                           labels=[[0, 0, 0, 0, 1, 1, 1, 1],
                                   [0, 0, 1, 1, 0, 0, 1, 1], [0, 1, 0, 1, 0, 1,
                                                              0, 1]])
        df = DataFrame(np.random.randn(8, 4), index=index,
                       columns=list('abcd'))

        result = df.xs(['foo', 'one'])
        expected = df.loc['foo', 'one']
        tm.assert_frame_equal(result, expected)

    def test_xs_level(self):
        result = self.frame.xs('two', level='second')
        expected = self.frame[self.frame.index.get_level_values(1) == 'two']
        expected.index = expected.index.droplevel(1)

        tm.assert_frame_equal(result, expected)

        index = MultiIndex.from_tuples([('x', 'y', 'z'), ('a', 'b', 'c'), (
            'p', 'q', 'r')])
        df = DataFrame(np.random.randn(3, 5), index=index)
        result = df.xs('c', level=2)
        expected = df[1:2]
        expected.index = expected.index.droplevel(2)
        tm.assert_frame_equal(result, expected)

        # this is a copy in 0.14
        result = self.frame.xs('two', level='second')

        # setting this will give a SettingWithCopyError
        # as we are trying to write a view
        def f(x):
            x[:] = 10

        pytest.raises(com.SettingWithCopyError, f, result)

    def test_xs_level_multiple(self):
        from pandas import read_table
        text = """                      A       B       C       D        E
one two three   four
a   b   10.0032 5    -0.5109 -2.3358 -0.4645  0.05076  0.3640
a   q   20      4     0.4473  1.4152  0.2834  1.00661  0.1744
x   q   30      3    -0.6662 -0.5243 -0.3580  0.89145  2.5838"""

        df = read_table(StringIO(text), sep=r'\s+', engine='python')

        result = df.xs(('a', 4), level=['one', 'four'])
        expected = df.xs('a').xs(4, level='four')
        tm.assert_frame_equal(result, expected)

        # this is a copy in 0.14
        result = df.xs(('a', 4), level=['one', 'four'])

        # setting this will give a SettingWithCopyError
        # as we are trying to write a view
        def f(x):
            x[:] = 10

        pytest.raises(com.SettingWithCopyError, f, result)

        # GH2107
        dates = lrange(20111201, 20111205)
        ids = 'abcde'
        idx = MultiIndex.from_tuples([x for x in cart_product(dates, ids)])
        idx.names = ['date', 'secid']
        df = DataFrame(np.random.randn(len(idx), 3), idx, ['X', 'Y', 'Z'])

        rs = df.xs(20111201, level='date')
        xp = df.loc[20111201, :]
        tm.assert_frame_equal(rs, xp)

    def test_xs_level0(self):
        from pandas import read_table
        text = """                      A       B       C       D        E
one two three   four
a   b   10.0032 5    -0.5109 -2.3358 -0.4645  0.05076  0.3640
a   q   20      4     0.4473  1.4152  0.2834  1.00661  0.1744
x   q   30      3    -0.6662 -0.5243 -0.3580  0.89145  2.5838"""

        df = read_table(StringIO(text), sep=r'\s+', engine='python')

        result = df.xs('a', level=0)
        expected = df.xs('a')
        assert len(result) == 2
        tm.assert_frame_equal(result, expected)

    def test_xs_level_series(self):
        s = self.frame['A']
        result = s[:, 'two']
        expected = self.frame.xs('two', level=1)['A']
        tm.assert_series_equal(result, expected)

        s = self.ymd['A']
        result = s[2000, 5]
        expected = self.ymd.loc[2000, 5]['A']
        tm.assert_series_equal(result, expected)

        # not implementing this for now

        pytest.raises(TypeError, s.__getitem__, (2000, slice(3, 4)))

        # result = s[2000, 3:4]
        # lv =s.index.get_level_values(1)
        # expected = s[(lv == 3) | (lv == 4)]
        # expected.index = expected.index.droplevel(0)
        # tm.assert_series_equal(result, expected)

        # can do this though

    def test_get_loc_single_level(self):
        s = Series(np.random.randn(len(self.single_level)),
                   index=self.single_level)
        for k in self.single_level.values:
            s[k]

    def test_getitem_toplevel(self):
        df = self.frame.T

        result = df['foo']
        expected = df.reindex(columns=df.columns[:3])
        expected.columns = expected.columns.droplevel(0)
        tm.assert_frame_equal(result, expected)

        result = df['bar']
        result2 = df.loc[:, 'bar']

        expected = df.reindex(columns=df.columns[3:5])
        expected.columns = expected.columns.droplevel(0)
        tm.assert_frame_equal(result, expected)
        tm.assert_frame_equal(result, result2)

    def test_getitem_setitem_slice_integers(self):
        index = MultiIndex(levels=[[0, 1, 2], [0, 2]],
                           labels=[[0, 0, 1, 1, 2, 2], [0, 1, 0, 1, 0, 1]])

        frame = DataFrame(np.random.randn(len(index), 4), index=index,
                          columns=['a', 'b', 'c', 'd'])
        res = frame.loc[1:2]
        exp = frame.reindex(frame.index[2:])
        tm.assert_frame_equal(res, exp)

        frame.loc[1:2] = 7
        assert (frame.loc[1:2] == 7).values.all()

        series = Series(np.random.randn(len(index)), index=index)

        res = series.loc[1:2]
        exp = series.reindex(series.index[2:])
        tm.assert_series_equal(res, exp)

        series.loc[1:2] = 7
        assert (series.loc[1:2] == 7).values.all()

    def test_getitem_int(self):
        levels = [[0, 1], [0, 1, 2]]
        labels = [[0, 0, 0, 1, 1, 1], [0, 1, 2, 0, 1, 2]]
        index = MultiIndex(levels=levels, labels=labels)

        frame = DataFrame(np.random.randn(6, 2), index=index)

        result = frame.loc[1]
        expected = frame[-3:]
        expected.index = expected.index.droplevel(0)
        tm.assert_frame_equal(result, expected)

        # raises exception
        pytest.raises(KeyError, frame.loc.__getitem__, 3)

        # however this will work
        result = self.frame.iloc[2]
        expected = self.frame.xs(self.frame.index[2])
        tm.assert_series_equal(result, expected)

    def test_getitem_partial(self):
        ymd = self.ymd.T
        result = ymd[2000, 2]

        expected = ymd.reindex(columns=ymd.columns[ymd.columns.labels[1] == 1])
        expected.columns = expected.columns.droplevel(0).droplevel(0)
        tm.assert_frame_equal(result, expected)

    def test_setitem_change_dtype(self):
        dft = self.frame.T
        s = dft['foo', 'two']
        dft['foo', 'two'] = s > s.median()
        tm.assert_series_equal(dft['foo', 'two'], s > s.median())
        # assert isinstance(dft._data.blocks[1].items, MultiIndex)

        reindexed = dft.reindex(columns=[('foo', 'two')])
        tm.assert_series_equal(reindexed['foo', 'two'], s > s.median())

    def test_frame_setitem_ix(self):
        self.frame.loc[('bar', 'two'), 'B'] = 5
        assert self.frame.loc[('bar', 'two'), 'B'] == 5

        # with integer labels
        df = self.frame.copy()
        df.columns = lrange(3)
        df.loc[('bar', 'two'), 1] = 7
        assert df.loc[('bar', 'two'), 1] == 7

        with catch_warnings(record=True):
            df = self.frame.copy()
            df.columns = lrange(3)
            df.ix[('bar', 'two'), 1] = 7
        assert df.loc[('bar', 'two'), 1] == 7

    def test_fancy_slice_partial(self):
        result = self.frame.loc['bar':'baz']
        expected = self.frame[3:7]
        tm.assert_frame_equal(result, expected)

        result = self.ymd.loc[(2000, 2):(2000, 4)]
        lev = self.ymd.index.labels[1]
        expected = self.ymd[(lev >= 1) & (lev <= 3)]
        tm.assert_frame_equal(result, expected)

    def test_getitem_partial_column_select(self):
        idx = MultiIndex(labels=[[0, 0, 0], [0, 1, 1], [1, 0, 1]],
                         levels=[['a', 'b'], ['x', 'y'], ['p', 'q']])
        df = DataFrame(np.random.rand(3, 2), index=idx)

        result = df.loc[('a', 'y'), :]
        expected = df.loc[('a', 'y')]
        tm.assert_frame_equal(result, expected)

        result = df.loc[('a', 'y'), [1, 0]]
        expected = df.loc[('a', 'y')][[1, 0]]
        tm.assert_frame_equal(result, expected)

        with catch_warnings(record=True):
            result = df.ix[('a', 'y'), [1, 0]]
        tm.assert_frame_equal(result, expected)

        pytest.raises(KeyError, df.loc.__getitem__,
                      (('a', 'foo'), slice(None, None)))

    def test_delevel_infer_dtype(self):
        tuples = [tuple
                  for tuple in cart_product(
                      ['foo', 'bar'], [10, 20], [1.0, 1.1])]
        index = MultiIndex.from_tuples(tuples, names=['prm0', 'prm1', 'prm2'])
        df = DataFrame(np.random.randn(8, 3), columns=['A', 'B', 'C'],
                       index=index)
        deleveled = df.reset_index()
        assert is_integer_dtype(deleveled['prm1'])
        assert is_float_dtype(deleveled['prm2'])

    def test_reset_index_with_drop(self):
        deleveled = self.ymd.reset_index(drop=True)
        assert len(deleveled.columns) == len(self.ymd.columns)

        deleveled = self.series.reset_index()
        assert isinstance(deleveled, DataFrame)
        assert len(deleveled.columns) == len(self.series.index.levels) + 1

        deleveled = self.series.reset_index(drop=True)
        assert isinstance(deleveled, Series)

    def test_count_level(self):
        def _check_counts(frame, axis=0):
            index = frame._get_axis(axis)
            for i in range(index.nlevels):
                result = frame.count(axis=axis, level=i)
                expected = frame.groupby(axis=axis, level=i).count()
                expected = expected.reindex_like(result).astype('i8')
                tm.assert_frame_equal(result, expected)

        self.frame.iloc[1, [1, 2]] = np.nan
        self.frame.iloc[7, [0, 1]] = np.nan
        self.ymd.iloc[1, [1, 2]] = np.nan
        self.ymd.iloc[7, [0, 1]] = np.nan

        _check_counts(self.frame)
        _check_counts(self.ymd)
        _check_counts(self.frame.T, axis=1)
        _check_counts(self.ymd.T, axis=1)

        # can't call with level on regular DataFrame
        df = tm.makeTimeDataFrame()
        tm.assert_raises_regex(
            TypeError, 'hierarchical', df.count, level=0)

        self.frame['D'] = 'foo'
        result = self.frame.count(level=0, numeric_only=True)
        tm.assert_index_equal(result.columns,
                              pd.Index(['A', 'B', 'C'], name='exp'))

    def test_count_level_series(self):
        index = MultiIndex(levels=[['foo', 'bar', 'baz'], ['one', 'two',
                                                           'three', 'four']],
                           labels=[[0, 0, 0, 2, 2], [2, 0, 1, 1, 2]])

        s = Series(np.random.randn(len(index)), index=index)

        result = s.count(level=0)
        expected = s.groupby(level=0).count()
        tm.assert_series_equal(
            result.astype('f8'), expected.reindex(result.index).fillna(0))

        result = s.count(level=1)
        expected = s.groupby(level=1).count()
        tm.assert_series_equal(
            result.astype('f8'), expected.reindex(result.index).fillna(0))

    def test_count_level_corner(self):
        s = self.frame['A'][:0]
        result = s.count(level=0)
        expected = Series(0, index=s.index.levels[0], name='A')
        tm.assert_series_equal(result, expected)

        df = self.frame[:0]
        result = df.count(level=0)
        expected = DataFrame({}, index=s.index.levels[0],
                             columns=df.columns).fillna(0).astype(np.int64)
        tm.assert_frame_equal(result, expected)

    def test_get_level_number_out_of_bounds(self):
        with tm.assert_raises_regex(IndexError, "Too many levels"):
            self.frame.index._get_level_number(2)
        with tm.assert_raises_regex(IndexError,
                                    "not a valid level number"):
            self.frame.index._get_level_number(-3)

    def test_unstack(self):
        # just check that it works for now
        unstacked = self.ymd.unstack()
        unstacked.unstack()

        # test that ints work
        self.ymd.astype(int).unstack()

        # test that int32 work
        self.ymd.astype(np.int32).unstack()

    def test_unstack_multiple_no_empty_columns(self):
        index = MultiIndex.from_tuples([(0, 'foo', 0), (0, 'bar', 0), (
            1, 'baz', 1), (1, 'qux', 1)])

        s = Series(np.random.randn(4), index=index)

        unstacked = s.unstack([1, 2])
        expected = unstacked.dropna(axis=1, how='all')
        tm.assert_frame_equal(unstacked, expected)

    def test_stack(self):
        # regular roundtrip
        unstacked = self.ymd.unstack()
        restacked = unstacked.stack()
        tm.assert_frame_equal(restacked, self.ymd)

        unlexsorted = self.ymd.sort_index(level=2)

        unstacked = unlexsorted.unstack(2)
        restacked = unstacked.stack()
        tm.assert_frame_equal(restacked.sort_index(level=0), self.ymd)

        unlexsorted = unlexsorted[::-1]
        unstacked = unlexsorted.unstack(1)
        restacked = unstacked.stack().swaplevel(1, 2)
        tm.assert_frame_equal(restacked.sort_index(level=0), self.ymd)

        unlexsorted = unlexsorted.swaplevel(0, 1)
        unstacked = unlexsorted.unstack(0).swaplevel(0, 1, axis=1)
        restacked = unstacked.stack(0).swaplevel(1, 2)
        tm.assert_frame_equal(restacked.sort_index(level=0), self.ymd)

        # columns unsorted
        unstacked = self.ymd.unstack()
        unstacked = unstacked.sort_index(axis=1, ascending=False)
        restacked = unstacked.stack()
        tm.assert_frame_equal(restacked, self.ymd)

        # more than 2 levels in the columns
        unstacked = self.ymd.unstack(1).unstack(1)

        result = unstacked.stack(1)
        expected = self.ymd.unstack()
        tm.assert_frame_equal(result, expected)

        result = unstacked.stack(2)
        expected = self.ymd.unstack(1)
        tm.assert_frame_equal(result, expected)

        result = unstacked.stack(0)
        expected = self.ymd.stack().unstack(1).unstack(1)
        tm.assert_frame_equal(result, expected)

        # not all levels present in each echelon
        unstacked = self.ymd.unstack(2).loc[:, ::3]
        stacked = unstacked.stack().stack()
        ymd_stacked = self.ymd.stack()
        tm.assert_series_equal(stacked, ymd_stacked.reindex(stacked.index))

        # stack with negative number
        result = self.ymd.unstack(0).stack(-2)
        expected = self.ymd.unstack(0).stack(0)

        # GH10417
        def check(left, right):
            tm.assert_series_equal(left, right)
            assert not left.index.is_unique
            li, ri = left.index, right.index
            tm.assert_index_equal(li, ri)

        df = DataFrame(np.arange(12).reshape(4, 3),
                       index=list('abab'),
                       columns=['1st', '2nd', '3rd'])

        mi = MultiIndex(levels=[['a', 'b'], ['1st', '2nd', '3rd']],
                        labels=[np.tile(
                            np.arange(2).repeat(3), 2), np.tile(
                                np.arange(3), 4)])

        left, right = df.stack(), Series(np.arange(12), index=mi)
        check(left, right)

        df.columns = ['1st', '2nd', '1st']
        mi = MultiIndex(levels=[['a', 'b'], ['1st', '2nd']], labels=[np.tile(
            np.arange(2).repeat(3), 2), np.tile(
                [0, 1, 0], 4)])

        left, right = df.stack(), Series(np.arange(12), index=mi)
        check(left, right)

        tpls = ('a', 2), ('b', 1), ('a', 1), ('b', 2)
        df.index = MultiIndex.from_tuples(tpls)
        mi = MultiIndex(levels=[['a', 'b'], [1, 2], ['1st', '2nd']],
                        labels=[np.tile(
                            np.arange(2).repeat(3), 2), np.repeat(
                                [1, 0, 1], [3, 6, 3]), np.tile(
                                    [0, 1, 0], 4)])

        left, right = df.stack(), Series(np.arange(12), index=mi)
        check(left, right)

    def test_unstack_odd_failure(self):
        data = """day,time,smoker,sum,len
Fri,Dinner,No,8.25,3.
Fri,Dinner,Yes,27.03,9
Fri,Lunch,No,3.0,1
Fri,Lunch,Yes,13.68,6
Sat,Dinner,No,139.63,45
Sat,Dinner,Yes,120.77,42
Sun,Dinner,No,180.57,57
Sun,Dinner,Yes,66.82,19
Thur,Dinner,No,3.0,1
Thur,Lunch,No,117.32,44
Thur,Lunch,Yes,51.51,17"""

        df = pd.read_csv(StringIO(data)).set_index(['day', 'time', 'smoker'])

        # it works, #2100
        result = df.unstack(2)

        recons = result.stack()
        tm.assert_frame_equal(recons, df)

    def test_stack_mixed_dtype(self):
        df = self.frame.T
        df['foo', 'four'] = 'foo'
        df = df.sort_index(level=1, axis=1)

        stacked = df.stack()
        result = df['foo'].stack().sort_index()
        tm.assert_series_equal(stacked['foo'], result, check_names=False)
        assert result.name is None
        assert stacked['bar'].dtype == np.float_

    def test_unstack_bug(self):
        df = DataFrame({'state': ['naive', 'naive', 'naive', 'activ', 'activ',
                                  'activ'],
                        'exp': ['a', 'b', 'b', 'b', 'a', 'a'],
                        'barcode': [1, 2, 3, 4, 1, 3],
                        'v': ['hi', 'hi', 'bye', 'bye', 'bye', 'peace'],
                        'extra': np.arange(6.)})

        result = df.groupby(['state', 'exp', 'barcode', 'v']).apply(len)

        unstacked = result.unstack()
        restacked = unstacked.stack()
        tm.assert_series_equal(
            restacked, result.reindex(restacked.index).astype(float))

    def test_stack_unstack_preserve_names(self):
        unstacked = self.frame.unstack()
        assert unstacked.index.name == 'first'
        assert unstacked.columns.names == ['exp', 'second']

        restacked = unstacked.stack()
        assert restacked.index.names == self.frame.index.names

    def test_unstack_level_name(self):
        result = self.frame.unstack('second')
        expected = self.frame.unstack(level=1)
        tm.assert_frame_equal(result, expected)

    def test_stack_level_name(self):
        unstacked = self.frame.unstack('second')
        result = unstacked.stack('exp')
        expected = self.frame.unstack().stack(0)
        tm.assert_frame_equal(result, expected)

        result = self.frame.stack('exp')
        expected = self.frame.stack()
        tm.assert_series_equal(result, expected)

    def test_stack_unstack_multiple(self):
        unstacked = self.ymd.unstack(['year', 'month'])
        expected = self.ymd.unstack('year').unstack('month')
        tm.assert_frame_equal(unstacked, expected)
        assert unstacked.columns.names == expected.columns.names

        # series
        s = self.ymd['A']
        s_unstacked = s.unstack(['year', 'month'])
        tm.assert_frame_equal(s_unstacked, expected['A'])

        restacked = unstacked.stack(['year', 'month'])
        restacked = restacked.swaplevel(0, 1).swaplevel(1, 2)
        restacked = restacked.sort_index(level=0)

        tm.assert_frame_equal(restacked, self.ymd)
        assert restacked.index.names == self.ymd.index.names

        # GH #451
        unstacked = self.ymd.unstack([1, 2])
        expected = self.ymd.unstack(1).unstack(1).dropna(axis=1, how='all')
        tm.assert_frame_equal(unstacked, expected)

        unstacked = self.ymd.unstack([2, 1])
        expected = self.ymd.unstack(2).unstack(1).dropna(axis=1, how='all')
        tm.assert_frame_equal(unstacked, expected.loc[:, unstacked.columns])

    def test_stack_names_and_numbers(self):
        unstacked = self.ymd.unstack(['year', 'month'])

        # Can't use mixture of names and numbers to stack
        with tm.assert_raises_regex(ValueError, "level should contain"):
            unstacked.stack([0, 'month'])

    def test_stack_multiple_out_of_bounds(self):
        # nlevels == 3
        unstacked = self.ymd.unstack(['year', 'month'])

        with tm.assert_raises_regex(IndexError, "Too many levels"):
            unstacked.stack([2, 3])
        with tm.assert_raises_regex(IndexError,
                                    "not a valid level number"):
            unstacked.stack([-4, -3])

    def test_unstack_period_series(self):
        # GH 4342
        idx1 = pd.PeriodIndex(['2013-01', '2013-01', '2013-02', '2013-02',
                               '2013-03', '2013-03'], freq='M', name='period')
        idx2 = Index(['A', 'B'] * 3, name='str')
        value = [1, 2, 3, 4, 5, 6]

        idx = MultiIndex.from_arrays([idx1, idx2])
        s = Series(value, index=idx)

        result1 = s.unstack()
        result2 = s.unstack(level=1)
        result3 = s.unstack(level=0)

        e_idx = pd.PeriodIndex(
            ['2013-01', '2013-02', '2013-03'], freq='M', name='period')
        expected = DataFrame({'A': [1, 3, 5], 'B': [2, 4, 6]}, index=e_idx,
                             columns=['A', 'B'])
        expected.columns.name = 'str'

        tm.assert_frame_equal(result1, expected)
        tm.assert_frame_equal(result2, expected)
        tm.assert_frame_equal(result3, expected.T)

        idx1 = pd.PeriodIndex(['2013-01', '2013-01', '2013-02', '2013-02',
                               '2013-03', '2013-03'], freq='M', name='period1')

        idx2 = pd.PeriodIndex(['2013-12', '2013-11', '2013-10', '2013-09',
                               '2013-08', '2013-07'], freq='M', name='period2')
        idx = pd.MultiIndex.from_arrays([idx1, idx2])
        s = Series(value, index=idx)

        result1 = s.unstack()
        result2 = s.unstack(level=1)
        result3 = s.unstack(level=0)

        e_idx = pd.PeriodIndex(
            ['2013-01', '2013-02', '2013-03'], freq='M', name='period1')
        e_cols = pd.PeriodIndex(['2013-07', '2013-08', '2013-09', '2013-10',
                                 '2013-11', '2013-12'],
                                freq='M', name='period2')
        expected = DataFrame([[np.nan, np.nan, np.nan, np.nan, 2, 1],
                              [np.nan, np.nan, 4, 3, np.nan, np.nan],
                              [6, 5, np.nan, np.nan, np.nan, np.nan]],
                             index=e_idx, columns=e_cols)

        tm.assert_frame_equal(result1, expected)
        tm.assert_frame_equal(result2, expected)
        tm.assert_frame_equal(result3, expected.T)

    def test_unstack_period_frame(self):
        # GH 4342
        idx1 = pd.PeriodIndex(['2014-01', '2014-02', '2014-02', '2014-02',
                               '2014-01', '2014-01'],
                              freq='M', name='period1')
        idx2 = pd.PeriodIndex(['2013-12', '2013-12', '2014-02', '2013-10',
                               '2013-10', '2014-02'],
                              freq='M', name='period2')
        value = {'A': [1, 2, 3, 4, 5, 6], 'B': [6, 5, 4, 3, 2, 1]}
        idx = pd.MultiIndex.from_arrays([idx1, idx2])
        df = pd.DataFrame(value, index=idx)

        result1 = df.unstack()
        result2 = df.unstack(level=1)
        result3 = df.unstack(level=0)

        e_1 = pd.PeriodIndex(['2014-01', '2014-02'], freq='M', name='period1')
        e_2 = pd.PeriodIndex(['2013-10', '2013-12', '2014-02', '2013-10',
                              '2013-12', '2014-02'], freq='M', name='period2')
        e_cols = pd.MultiIndex.from_arrays(['A A A B B B'.split(), e_2])
        expected = DataFrame([[5, 1, 6, 2, 6, 1], [4, 2, 3, 3, 5, 4]],
                             index=e_1, columns=e_cols)

        tm.assert_frame_equal(result1, expected)
        tm.assert_frame_equal(result2, expected)

        e_1 = pd.PeriodIndex(['2014-01', '2014-02', '2014-01',
                              '2014-02'], freq='M', name='period1')
        e_2 = pd.PeriodIndex(
            ['2013-10', '2013-12', '2014-02'], freq='M', name='period2')
        e_cols = pd.MultiIndex.from_arrays(['A A B B'.split(), e_1])
        expected = DataFrame([[5, 4, 2, 3], [1, 2, 6, 5], [6, 3, 1, 4]],
                             index=e_2, columns=e_cols)

        tm.assert_frame_equal(result3, expected)

    def test_stack_multiple_bug(self):
        """ bug when some uniques are not present in the data #3170"""
        id_col = ([1] * 3) + ([2] * 3)
        name = (['a'] * 3) + (['b'] * 3)
        date = pd.to_datetime(['2013-01-03', '2013-01-04', '2013-01-05'] * 2)
        var1 = np.random.randint(0, 100, 6)
        df = DataFrame(dict(ID=id_col, NAME=name, DATE=date, VAR1=var1))

        multi = df.set_index(['DATE', 'ID'])
        multi.columns.name = 'Params'
        unst = multi.unstack('ID')
        down = unst.resample('W-THU').mean()

        rs = down.stack('ID')
        xp = unst.loc[:, ['VAR1']].resample('W-THU').mean().stack('ID')
        xp.columns.name = 'Params'
        tm.assert_frame_equal(rs, xp)

    def test_stack_dropna(self):
        # GH #3997
        df = pd.DataFrame({'A': ['a1', 'a2'], 'B': ['b1', 'b2'], 'C': [1, 1]})
        df = df.set_index(['A', 'B'])

        stacked = df.unstack().stack(dropna=False)
        assert len(stacked) > len(stacked.dropna())

        stacked = df.unstack().stack(dropna=True)
        tm.assert_frame_equal(stacked, stacked.dropna())

    def test_unstack_multiple_hierarchical(self):
        df = DataFrame(index=[[0, 0, 0, 0, 1, 1, 1, 1],
                              [0, 0, 1, 1, 0, 0, 1, 1], [0, 1, 0, 1, 0, 1, 0, 1
                                                         ]],
                       columns=[[0, 0, 1, 1], [0, 1, 0, 1]])

        df.index.names = ['a', 'b', 'c']
        df.columns.names = ['d', 'e']

        # it works!
        df.unstack(['b', 'c'])

    def test_groupby_transform(self):
        s = self.frame['A']
        grouper = s.index.get_level_values(0)

        grouped = s.groupby(grouper)

        applied = grouped.apply(lambda x: x * 2)
        expected = grouped.transform(lambda x: x * 2)
        result = applied.reindex(expected.index)
        tm.assert_series_equal(result, expected, check_names=False)

    def test_unstack_sparse_keyspace(self):
        # memory problems with naive impl #2278
        # Generate Long File & Test Pivot
        NUM_ROWS = 1000

        df = DataFrame({'A': np.random.randint(100, size=NUM_ROWS),
                        'B': np.random.randint(300, size=NUM_ROWS),
                        'C': np.random.randint(-7, 7, size=NUM_ROWS),
                        'D': np.random.randint(-19, 19, size=NUM_ROWS),
                        'E': np.random.randint(3000, size=NUM_ROWS),
                        'F': np.random.randn(NUM_ROWS)})

        idf = df.set_index(['A', 'B', 'C', 'D', 'E'])

        # it works! is sufficient
        idf.unstack('E')

    def test_unstack_unobserved_keys(self):
        # related to #2278 refactoring
        levels = [[0, 1], [0, 1, 2, 3]]
        labels = [[0, 0, 1, 1], [0, 2, 0, 2]]

        index = MultiIndex(levels, labels)

        df = DataFrame(np.random.randn(4, 2), index=index)

        result = df.unstack()
        assert len(result.columns) == 4

        recons = result.stack()
        tm.assert_frame_equal(recons, df)

    def test_stack_order_with_unsorted_levels(self):
        # GH 16323

        def manual_compare_stacked(df, df_stacked, lev0, lev1):
            assert all(df.loc[row, col] ==
                       df_stacked.loc[(row, col[lev0]), col[lev1]]
                       for row in df.index for col in df.columns)

        # deep check for 1-row case
        for width in [2, 3]:
            levels_poss = itertools.product(
                itertools.permutations([0, 1, 2], width),
                repeat=2)

            for levels in levels_poss:
                columns = MultiIndex(levels=levels,
                                     labels=[[0, 0, 1, 1],
                                             [0, 1, 0, 1]])
                df = DataFrame(columns=columns, data=[range(4)])
                for stack_lev in range(2):
                    df_stacked = df.stack(stack_lev)
                    manual_compare_stacked(df, df_stacked,
                                           stack_lev, 1 - stack_lev)

        # check multi-row case
        mi = MultiIndex(levels=[["A", "C", "B"], ["B", "A", "C"]],
                        labels=[np.repeat(range(3), 3), np.tile(range(3), 3)])
        df = DataFrame(columns=mi, index=range(5),
                       data=np.arange(5 * len(mi)).reshape(5, -1))
        manual_compare_stacked(df, df.stack(0), 0, 1)

    def test_groupby_corner(self):
        midx = MultiIndex(levels=[['foo'], ['bar'], ['baz']],
                          labels=[[0], [0], [0]],
                          names=['one', 'two', 'three'])
        df = DataFrame([np.random.rand(4)], columns=['a', 'b', 'c', 'd'],
                       index=midx)
        # should work
        df.groupby(level='three')

    def test_groupby_level_no_obs(self):
        # #1697
        midx = MultiIndex.from_tuples([('f1', 's1'), ('f1', 's2'), (
            'f2', 's1'), ('f2', 's2'), ('f3', 's1'), ('f3', 's2')])
        df = DataFrame(
            [[1, 2, 3, 4, 5, 6], [7, 8, 9, 10, 11, 12]], columns=midx)
        df1 = df.select(lambda u: u[0] in ['f2', 'f3'], axis=1)

        grouped = df1.groupby(axis=1, level=0)
        result = grouped.sum()
        assert (result.columns == ['f2', 'f3']).all()

    def test_join(self):
        a = self.frame.loc[self.frame.index[:5], ['A']]
        b = self.frame.loc[self.frame.index[2:], ['B', 'C']]

        joined = a.join(b, how='outer').reindex(self.frame.index)
        expected = self.frame.copy()
        expected.values[np.isnan(joined.values)] = np.nan

        assert not np.isnan(joined.values).all()

        # TODO what should join do with names ?
        tm.assert_frame_equal(joined, expected, check_names=False)

    def test_swaplevel(self):
        swapped = self.frame['A'].swaplevel()
        swapped2 = self.frame['A'].swaplevel(0)
        swapped3 = self.frame['A'].swaplevel(0, 1)
        swapped4 = self.frame['A'].swaplevel('first', 'second')
        assert not swapped.index.equals(self.frame.index)
        tm.assert_series_equal(swapped, swapped2)
        tm.assert_series_equal(swapped, swapped3)
        tm.assert_series_equal(swapped, swapped4)

        back = swapped.swaplevel()
        back2 = swapped.swaplevel(0)
        back3 = swapped.swaplevel(0, 1)
        back4 = swapped.swaplevel('second', 'first')
        assert back.index.equals(self.frame.index)
        tm.assert_series_equal(back, back2)
        tm.assert_series_equal(back, back3)
        tm.assert_series_equal(back, back4)

        ft = self.frame.T
        swapped = ft.swaplevel('first', 'second', axis=1)
        exp = self.frame.swaplevel('first', 'second').T
        tm.assert_frame_equal(swapped, exp)

    def test_swaplevel_panel(self):
        with catch_warnings(record=True):
            panel = Panel({'ItemA': self.frame, 'ItemB': self.frame * 2})
            expected = panel.copy()
            expected.major_axis = expected.major_axis.swaplevel(0, 1)

            for result in (panel.swaplevel(axis='major'),
                           panel.swaplevel(0, axis='major'),
                           panel.swaplevel(0, 1, axis='major')):
                tm.assert_panel_equal(result, expected)

    def test_reorder_levels(self):
        result = self.ymd.reorder_levels(['month', 'day', 'year'])
        expected = self.ymd.swaplevel(0, 1).swaplevel(1, 2)
        tm.assert_frame_equal(result, expected)

        result = self.ymd['A'].reorder_levels(['month', 'day', 'year'])
        expected = self.ymd['A'].swaplevel(0, 1).swaplevel(1, 2)
        tm.assert_series_equal(result, expected)

        result = self.ymd.T.reorder_levels(['month', 'day', 'year'], axis=1)
        expected = self.ymd.T.swaplevel(0, 1, axis=1).swaplevel(1, 2, axis=1)
        tm.assert_frame_equal(result, expected)

        with tm.assert_raises_regex(TypeError, 'hierarchical axis'):
            self.ymd.reorder_levels([1, 2], axis=1)

        with tm.assert_raises_regex(IndexError, 'Too many levels'):
            self.ymd.index.reorder_levels([1, 2, 3])

    def test_insert_index(self):
        df = self.ymd[:5].T
        df[2000, 1, 10] = df[2000, 1, 7]
        assert isinstance(df.columns, MultiIndex)
        assert (df[2000, 1, 10] == df[2000, 1, 7]).all()

    def test_alignment(self):
        x = Series(data=[1, 2, 3], index=MultiIndex.from_tuples([("A", 1), (
            "A", 2), ("B", 3)]))

        y = Series(data=[4, 5, 6], index=MultiIndex.from_tuples([("Z", 1), (
            "Z", 2), ("B", 3)]))

        res = x - y
        exp_index = x.index.union(y.index)
        exp = x.reindex(exp_index) - y.reindex(exp_index)
        tm.assert_series_equal(res, exp)

        # hit non-monotonic code path
        res = x[::-1] - y[::-1]
        exp_index = x.index.union(y.index)
        exp = x.reindex(exp_index) - y.reindex(exp_index)
        tm.assert_series_equal(res, exp)

    def test_frame_getitem_view(self):
        df = self.frame.T.copy()

        # this works because we are modifying the underlying array
        # really a no-no
        df['foo'].values[:] = 0
        assert (df['foo'].values == 0).all()

        # but not if it's mixed-type
        df['foo', 'four'] = 'foo'
        df = df.sort_index(level=0, axis=1)

        # this will work, but will raise/warn as its chained assignment
        def f():
            df['foo']['one'] = 2
            return df

        pytest.raises(com.SettingWithCopyError, f)

        try:
            df = f()
        except:
            pass
        assert (df['foo', 'one'] == 0).all()

    def test_count(self):
        frame = self.frame.copy()
        frame.index.names = ['a', 'b']

        result = frame.count(level='b')
        expect = self.frame.count(level=1)
        tm.assert_frame_equal(result, expect, check_names=False)

        result = frame.count(level='a')
        expect = self.frame.count(level=0)
        tm.assert_frame_equal(result, expect, check_names=False)

        series = self.series.copy()
        series.index.names = ['a', 'b']

        result = series.count(level='b')
        expect = self.series.count(level=1)
        tm.assert_series_equal(result, expect, check_names=False)
        assert result.index.name == 'b'

        result = series.count(level='a')
        expect = self.series.count(level=0)
        tm.assert_series_equal(result, expect, check_names=False)
        assert result.index.name == 'a'

        pytest.raises(KeyError, series.count, 'x')
        pytest.raises(KeyError, frame.count, level='x')

    AGG_FUNCTIONS = ['sum', 'prod', 'min', 'max', 'median', 'mean', 'skew',
                     'mad', 'std', 'var', 'sem']

    def test_series_group_min_max(self):
        for op, level, skipna in cart_product(self.AGG_FUNCTIONS, lrange(2),
                                              [False, True]):
            grouped = self.series.groupby(level=level)
            aggf = lambda x: getattr(x, op)(skipna=skipna)
            # skipna=True
            leftside = grouped.agg(aggf)
            rightside = getattr(self.series, op)(level=level, skipna=skipna)
            tm.assert_series_equal(leftside, rightside)

    def test_frame_group_ops(self):
        self.frame.iloc[1, [1, 2]] = np.nan
        self.frame.iloc[7, [0, 1]] = np.nan

        for op, level, axis, skipna in cart_product(self.AGG_FUNCTIONS,
                                                    lrange(2), lrange(2),
                                                    [False, True]):

            if axis == 0:
                frame = self.frame
            else:
                frame = self.frame.T

            grouped = frame.groupby(level=level, axis=axis)

            pieces = []

            def aggf(x):
                pieces.append(x)
                return getattr(x, op)(skipna=skipna, axis=axis)

            leftside = grouped.agg(aggf)
            rightside = getattr(frame, op)(level=level, axis=axis,
                                           skipna=skipna)

            # for good measure, groupby detail
            level_index = frame._get_axis(axis).levels[level]

            tm.assert_index_equal(leftside._get_axis(axis), level_index)
            tm.assert_index_equal(rightside._get_axis(axis), level_index)

            tm.assert_frame_equal(leftside, rightside)

    def test_stat_op_corner(self):
        obj = Series([10.0], index=MultiIndex.from_tuples([(2, 3)]))

        result = obj.sum(level=0)
        expected = Series([10.0], index=[2])
        tm.assert_series_equal(result, expected)

    def test_frame_any_all_group(self):
        df = DataFrame(
            {'data': [False, False, True, False, True, False, True]},
            index=[
                ['one', 'one', 'two', 'one', 'two', 'two', 'two'],
                [0, 1, 0, 2, 1, 2, 3]])

        result = df.any(level=0)
        ex = DataFrame({'data': [False, True]}, index=['one', 'two'])
        tm.assert_frame_equal(result, ex)

        result = df.all(level=0)
        ex = DataFrame({'data': [False, False]}, index=['one', 'two'])
        tm.assert_frame_equal(result, ex)

    def test_std_var_pass_ddof(self):
        index = MultiIndex.from_arrays([np.arange(5).repeat(10), np.tile(
            np.arange(10), 5)])
        df = DataFrame(np.random.randn(len(index), 5), index=index)

        for meth in ['var', 'std']:
            ddof = 4
            alt = lambda x: getattr(x, meth)(ddof=ddof)

            result = getattr(df[0], meth)(level=0, ddof=ddof)
            expected = df[0].groupby(level=0).agg(alt)
            tm.assert_series_equal(result, expected)

            result = getattr(df, meth)(level=0, ddof=ddof)
            expected = df.groupby(level=0).agg(alt)
            tm.assert_frame_equal(result, expected)

    def test_frame_series_agg_multiple_levels(self):
        result = self.ymd.sum(level=['year', 'month'])
        expected = self.ymd.groupby(level=['year', 'month']).sum()
        tm.assert_frame_equal(result, expected)

        result = self.ymd['A'].sum(level=['year', 'month'])
        expected = self.ymd['A'].groupby(level=['year', 'month']).sum()
        tm.assert_series_equal(result, expected)

    def test_groupby_multilevel(self):
        result = self.ymd.groupby(level=[0, 1]).mean()

        k1 = self.ymd.index.get_level_values(0)
        k2 = self.ymd.index.get_level_values(1)

        expected = self.ymd.groupby([k1, k2]).mean()

        # TODO groupby with level_values drops names
        tm.assert_frame_equal(result, expected, check_names=False)
        assert result.index.names == self.ymd.index.names[:2]

        result2 = self.ymd.groupby(level=self.ymd.index.names[:2]).mean()
        tm.assert_frame_equal(result, result2)

    def test_groupby_multilevel_with_transform(self):
        pass

    def test_multilevel_consolidate(self):
        index = MultiIndex.from_tuples([('foo', 'one'), ('foo', 'two'), (
            'bar', 'one'), ('bar', 'two')])
        df = DataFrame(np.random.randn(4, 4), index=index, columns=index)
        df['Totals', ''] = df.sum(1)
        df = df._consolidate()

    def test_ix_preserve_names(self):
        result = self.ymd.loc[2000]
        result2 = self.ymd['A'].loc[2000]
        assert result.index.names == self.ymd.index.names[1:]
        assert result2.index.names == self.ymd.index.names[1:]

        result = self.ymd.loc[2000, 2]
        result2 = self.ymd['A'].loc[2000, 2]
        assert result.index.name == self.ymd.index.names[2]
        assert result2.index.name == self.ymd.index.names[2]

    def test_partial_set(self):
        # GH #397
        df = self.ymd.copy()
        exp = self.ymd.copy()
        df.loc[2000, 4] = 0
        exp.loc[2000, 4].values[:] = 0
        tm.assert_frame_equal(df, exp)

        df['A'].loc[2000, 4] = 1
        exp['A'].loc[2000, 4].values[:] = 1
        tm.assert_frame_equal(df, exp)

        df.loc[2000] = 5
        exp.loc[2000].values[:] = 5
        tm.assert_frame_equal(df, exp)

        # this works...for now
        df['A'].iloc[14] = 5
        assert df['A'][14] == 5

    def test_unstack_preserve_types(self):
        # GH #403
        self.ymd['E'] = 'foo'
        self.ymd['F'] = 2

        unstacked = self.ymd.unstack('month')
        assert unstacked['A', 1].dtype == np.float64
        assert unstacked['E', 1].dtype == np.object_
        assert unstacked['F', 1].dtype == np.float64

    def test_unstack_group_index_overflow(self):
        labels = np.tile(np.arange(500), 2)
        level = np.arange(500)

        index = MultiIndex(levels=[level] * 8 + [[0, 1]],
                           labels=[labels] * 8 + [np.arange(2).repeat(500)])

        s = Series(np.arange(1000), index=index)
        result = s.unstack()
        assert result.shape == (500, 2)

        # test roundtrip
        stacked = result.stack()
        tm.assert_series_equal(s, stacked.reindex(s.index))

        # put it at beginning
        index = MultiIndex(levels=[[0, 1]] + [level] * 8,
                           labels=[np.arange(2).repeat(500)] + [labels] * 8)

        s = Series(np.arange(1000), index=index)
        result = s.unstack(0)
        assert result.shape == (500, 2)

        # put it in middle
        index = MultiIndex(levels=[level] * 4 + [[0, 1]] + [level] * 4,
                           labels=([labels] * 4 + [np.arange(2).repeat(500)] +
                                   [labels] * 4))

        s = Series(np.arange(1000), index=index)
        result = s.unstack(4)
        assert result.shape == (500, 2)

    def test_getitem_lowerdim_corner(self):
        pytest.raises(KeyError, self.frame.loc.__getitem__,
                      (('bar', 'three'), 'B'))

        # in theory should be inserting in a sorted space????
        self.frame.loc[('bar', 'three'), 'B'] = 0
        assert self.frame.sort_index().loc[('bar', 'three'), 'B'] == 0

    # ---------------------------------------------------------------------
    # AMBIGUOUS CASES!

    def test_partial_ix_missing(self):
        pytest.skip("skipping for now")

        result = self.ymd.loc[2000, 0]
        expected = self.ymd.loc[2000]['A']
        tm.assert_series_equal(result, expected)

        # need to put in some work here

        # self.ymd.loc[2000, 0] = 0
        # assert (self.ymd.loc[2000]['A'] == 0).all()

        # Pretty sure the second (and maybe even the first) is already wrong.
        pytest.raises(Exception, self.ymd.loc.__getitem__, (2000, 6))
        pytest.raises(Exception, self.ymd.loc.__getitem__, (2000, 6), 0)

    # ---------------------------------------------------------------------

    def test_to_html(self):
        self.ymd.columns.name = 'foo'
        self.ymd.to_html()
        self.ymd.T.to_html()

    def test_level_with_tuples(self):
        index = MultiIndex(levels=[[('foo', 'bar', 0), ('foo', 'baz', 0), (
            'foo', 'qux', 0)], [0, 1]],
            labels=[[0, 0, 1, 1, 2, 2], [0, 1, 0, 1, 0, 1]])

        series = Series(np.random.randn(6), index=index)
        frame = DataFrame(np.random.randn(6, 4), index=index)

        result = series[('foo', 'bar', 0)]
        result2 = series.loc[('foo', 'bar', 0)]
        expected = series[:2]
        expected.index = expected.index.droplevel(0)
        tm.assert_series_equal(result, expected)
        tm.assert_series_equal(result2, expected)

        pytest.raises(KeyError, series.__getitem__, (('foo', 'bar', 0), 2))

        result = frame.loc[('foo', 'bar', 0)]
        result2 = frame.xs(('foo', 'bar', 0))
        expected = frame[:2]
        expected.index = expected.index.droplevel(0)
        tm.assert_frame_equal(result, expected)
        tm.assert_frame_equal(result2, expected)

        index = MultiIndex(levels=[[('foo', 'bar'), ('foo', 'baz'), (
            'foo', 'qux')], [0, 1]],
            labels=[[0, 0, 1, 1, 2, 2], [0, 1, 0, 1, 0, 1]])

        series = Series(np.random.randn(6), index=index)
        frame = DataFrame(np.random.randn(6, 4), index=index)

        result = series[('foo', 'bar')]
        result2 = series.loc[('foo', 'bar')]
        expected = series[:2]
        expected.index = expected.index.droplevel(0)
        tm.assert_series_equal(result, expected)
        tm.assert_series_equal(result2, expected)

        result = frame.loc[('foo', 'bar')]
        result2 = frame.xs(('foo', 'bar'))
        expected = frame[:2]
        expected.index = expected.index.droplevel(0)
        tm.assert_frame_equal(result, expected)
        tm.assert_frame_equal(result2, expected)

    def test_int_series_slicing(self):
        s = self.ymd['A']
        result = s[5:]
        expected = s.reindex(s.index[5:])
        tm.assert_series_equal(result, expected)

        exp = self.ymd['A'].copy()
        s[5:] = 0
        exp.values[5:] = 0
        tm.assert_numpy_array_equal(s.values, exp.values)

        result = self.ymd[5:]
        expected = self.ymd.reindex(s.index[5:])
        tm.assert_frame_equal(result, expected)

    def test_mixed_depth_get(self):
        arrays = [['a', 'top', 'top', 'routine1', 'routine1', 'routine2'],
                  ['', 'OD', 'OD', 'result1', 'result2', 'result1'],
                  ['', 'wx', 'wy', '', '', '']]

        tuples = sorted(zip(*arrays))
        index = MultiIndex.from_tuples(tuples)
        df = DataFrame(randn(4, 6), columns=index)

        result = df['a']
        expected = df['a', '', '']
        tm.assert_series_equal(result, expected, check_names=False)
        assert result.name == 'a'

        result = df['routine1', 'result1']
        expected = df['routine1', 'result1', '']
        tm.assert_series_equal(result, expected, check_names=False)
        assert result.name == ('routine1', 'result1')

    def test_mixed_depth_insert(self):
        arrays = [['a', 'top', 'top', 'routine1', 'routine1', 'routine2'],
                  ['', 'OD', 'OD', 'result1', 'result2', 'result1'],
                  ['', 'wx', 'wy', '', '', '']]

        tuples = sorted(zip(*arrays))
        index = MultiIndex.from_tuples(tuples)
        df = DataFrame(randn(4, 6), columns=index)

        result = df.copy()
        expected = df.copy()
        result['b'] = [1, 2, 3, 4]
        expected['b', '', ''] = [1, 2, 3, 4]
        tm.assert_frame_equal(result, expected)

    def test_mixed_depth_drop(self):
        arrays = [['a', 'top', 'top', 'routine1', 'routine1', 'routine2'],
                  ['', 'OD', 'OD', 'result1', 'result2', 'result1'],
                  ['', 'wx', 'wy', '', '', '']]

        tuples = sorted(zip(*arrays))
        index = MultiIndex.from_tuples(tuples)
        df = DataFrame(randn(4, 6), columns=index)

        result = df.drop('a', axis=1)
        expected = df.drop([('a', '', '')], axis=1)
        tm.assert_frame_equal(expected, result)

        result = df.drop(['top'], axis=1)
        expected = df.drop([('top', 'OD', 'wx')], axis=1)
        expected = expected.drop([('top', 'OD', 'wy')], axis=1)
        tm.assert_frame_equal(expected, result)

        result = df.drop(('top', 'OD', 'wx'), axis=1)
        expected = df.drop([('top', 'OD', 'wx')], axis=1)
        tm.assert_frame_equal(expected, result)

        expected = df.drop([('top', 'OD', 'wy')], axis=1)
        expected = df.drop('top', axis=1)

        result = df.drop('result1', level=1, axis=1)
        expected = df.drop([('routine1', 'result1', ''),
                            ('routine2', 'result1', '')], axis=1)
        tm.assert_frame_equal(expected, result)

    def test_drop_nonunique(self):
        df = DataFrame([["x-a", "x", "a", 1.5], ["x-a", "x", "a", 1.2],
                        ["z-c", "z", "c", 3.1], ["x-a", "x", "a", 4.1],
                        ["x-b", "x", "b", 5.1], ["x-b", "x", "b", 4.1],
                        ["x-b", "x", "b", 2.2],
                        ["y-a", "y", "a", 1.2], ["z-b", "z", "b", 2.1]],
                       columns=["var1", "var2", "var3", "var4"])

        grp_size = df.groupby("var1").size()
        drop_idx = grp_size.loc[grp_size == 1]

        idf = df.set_index(["var1", "var2", "var3"])

        # it works! #2101
        result = idf.drop(drop_idx.index, level=0).reset_index()
        expected = df[-df.var1.isin(drop_idx.index)]

        result.index = expected.index

        tm.assert_frame_equal(result, expected)

    def test_mixed_depth_pop(self):
        arrays = [['a', 'top', 'top', 'routine1', 'routine1', 'routine2'],
                  ['', 'OD', 'OD', 'result1', 'result2', 'result1'],
                  ['', 'wx', 'wy', '', '', '']]

        tuples = sorted(zip(*arrays))
        index = MultiIndex.from_tuples(tuples)
        df = DataFrame(randn(4, 6), columns=index)

        df1 = df.copy()
        df2 = df.copy()
        result = df1.pop('a')
        expected = df2.pop(('a', '', ''))
        tm.assert_series_equal(expected, result, check_names=False)
        tm.assert_frame_equal(df1, df2)
        assert result.name == 'a'

        expected = df1['top']
        df1 = df1.drop(['top'], axis=1)
        result = df2.pop('top')
        tm.assert_frame_equal(expected, result)
        tm.assert_frame_equal(df1, df2)

    def test_reindex_level_partial_selection(self):
        result = self.frame.reindex(['foo', 'qux'], level=0)
        expected = self.frame.iloc[[0, 1, 2, 7, 8, 9]]
        tm.assert_frame_equal(result, expected)

        result = self.frame.T.reindex_axis(['foo', 'qux'], axis=1, level=0)
        tm.assert_frame_equal(result, expected.T)

        result = self.frame.loc[['foo', 'qux']]
        tm.assert_frame_equal(result, expected)

        result = self.frame['A'].loc[['foo', 'qux']]
        tm.assert_series_equal(result, expected['A'])

        result = self.frame.T.loc[:, ['foo', 'qux']]
        tm.assert_frame_equal(result, expected.T)

    def test_setitem_multiple_partial(self):
        expected = self.frame.copy()
        result = self.frame.copy()
        result.loc[['foo', 'bar']] = 0
        expected.loc['foo'] = 0
        expected.loc['bar'] = 0
        tm.assert_frame_equal(result, expected)

        expected = self.frame.copy()
        result = self.frame.copy()
        result.loc['foo':'bar'] = 0
        expected.loc['foo'] = 0
        expected.loc['bar'] = 0
        tm.assert_frame_equal(result, expected)

        expected = self.frame['A'].copy()
        result = self.frame['A'].copy()
        result.loc[['foo', 'bar']] = 0
        expected.loc['foo'] = 0
        expected.loc['bar'] = 0
        tm.assert_series_equal(result, expected)

        expected = self.frame['A'].copy()
        result = self.frame['A'].copy()
        result.loc['foo':'bar'] = 0
        expected.loc['foo'] = 0
        expected.loc['bar'] = 0
        tm.assert_series_equal(result, expected)

    def test_drop_level(self):
        result = self.frame.drop(['bar', 'qux'], level='first')
        expected = self.frame.iloc[[0, 1, 2, 5, 6]]
        tm.assert_frame_equal(result, expected)

        result = self.frame.drop(['two'], level='second')
        expected = self.frame.iloc[[0, 2, 3, 6, 7, 9]]
        tm.assert_frame_equal(result, expected)

        result = self.frame.T.drop(['bar', 'qux'], axis=1, level='first')
        expected = self.frame.iloc[[0, 1, 2, 5, 6]].T
        tm.assert_frame_equal(result, expected)

        result = self.frame.T.drop(['two'], axis=1, level='second')
        expected = self.frame.iloc[[0, 2, 3, 6, 7, 9]].T
        tm.assert_frame_equal(result, expected)

    def test_drop_level_nonunique_datetime(self):
        # GH 12701
        idx = pd.Index([2, 3, 4, 4, 5], name='id')
        idxdt = pd.to_datetime(['201603231400',
                                '201603231500',
                                '201603231600',
                                '201603231600',
                                '201603231700'])
        df = DataFrame(np.arange(10).reshape(5, 2),
                       columns=list('ab'), index=idx)
        df['tstamp'] = idxdt
        df = df.set_index('tstamp', append=True)
        ts = pd.Timestamp('201603231600')
        assert not df.index.is_unique

        result = df.drop(ts, level='tstamp')
        expected = df.loc[idx != 4]
        tm.assert_frame_equal(result, expected)

    def test_drop_preserve_names(self):
        index = MultiIndex.from_arrays([[0, 0, 0, 1, 1, 1],
                                        [1, 2, 3, 1, 2, 3]],
                                       names=['one', 'two'])

        df = DataFrame(np.random.randn(6, 3), index=index)

        result = df.drop([(0, 2)])
        assert result.index.names == ('one', 'two')

    def test_unicode_repr_issues(self):
        levels = [Index([u('a/\u03c3'), u('b/\u03c3'), u('c/\u03c3')]),
                  Index([0, 1])]
        labels = [np.arange(3).repeat(2), np.tile(np.arange(2), 3)]
        index = MultiIndex(levels=levels, labels=labels)

        repr(index.levels)

        # NumPy bug
        # repr(index.get_level_values(1))

    def test_unicode_repr_level_names(self):
        index = MultiIndex.from_tuples([(0, 0), (1, 1)],
                                       names=[u('\u0394'), 'i1'])

        s = Series(lrange(2), index=index)
        df = DataFrame(np.random.randn(2, 4), index=index)
        repr(s)
        repr(df)

    def test_dataframe_insert_column_all_na(self):
        # GH #1534
        mix = MultiIndex.from_tuples([('1a', '2a'), ('1a', '2b'), ('1a', '2c')
                                      ])
        df = DataFrame([[1, 2], [3, 4], [5, 6]], index=mix)
        s = Series({(1, 1): 1, (1, 2): 2})
        df['new'] = s
        assert df['new'].isnull().all()

    def test_join_segfault(self):
        # 1532
        df1 = DataFrame({'a': [1, 1], 'b': [1, 2], 'x': [1, 2]})
        df2 = DataFrame({'a': [2, 2], 'b': [1, 2], 'y': [1, 2]})
        df1 = df1.set_index(['a', 'b'])
        df2 = df2.set_index(['a', 'b'])
        # it works!
        for how in ['left', 'right', 'outer']:
            df1.join(df2, how=how)

    def test_set_column_scalar_with_ix(self):
        subset = self.frame.index[[1, 4, 5]]

        self.frame.loc[subset] = 99
        assert (self.frame.loc[subset].values == 99).all()

        col = self.frame['B']
        col[subset] = 97
        assert (self.frame.loc[subset, 'B'] == 97).all()

    def test_frame_dict_constructor_empty_series(self):
        s1 = Series([
            1, 2, 3, 4
        ], index=MultiIndex.from_tuples([(1, 2), (1, 3), (2, 2), (2, 4)]))
        s2 = Series([
            1, 2, 3, 4
        ], index=MultiIndex.from_tuples([(1, 2), (1, 3), (3, 2), (3, 4)]))
        s3 = Series()

        # it works!
        DataFrame({'foo': s1, 'bar': s2, 'baz': s3})
        DataFrame.from_dict({'foo': s1, 'baz': s3, 'bar': s2})

    def test_indexing_ambiguity_bug_1678(self):
        columns = MultiIndex.from_tuples([('Ohio', 'Green'), ('Ohio', 'Red'), (
            'Colorado', 'Green')])
        index = MultiIndex.from_tuples([('a', 1), ('a', 2), ('b', 1), ('b', 2)
                                        ])

        frame = DataFrame(np.arange(12).reshape((4, 3)), index=index,
                          columns=columns)

        result = frame.iloc[:, 1]
        exp = frame.loc[:, ('Ohio', 'Red')]
        assert isinstance(result, Series)
        tm.assert_series_equal(result, exp)

    def test_nonunique_assignment_1750(self):
        df = DataFrame([[1, 1, "x", "X"], [1, 1, "y", "Y"], [1, 2, "z", "Z"]],
                       columns=list("ABCD"))

        df = df.set_index(['A', 'B'])
        ix = MultiIndex.from_tuples([(1, 1)])

        df.loc[ix, "C"] = '_'

        assert (df.xs((1, 1))['C'] == '_').all()

    def test_indexing_over_hashtable_size_cutoff(self):
        n = 10000

        old_cutoff = _index._SIZE_CUTOFF
        _index._SIZE_CUTOFF = 20000

        s = Series(np.arange(n),
                   MultiIndex.from_arrays((["a"] * n, np.arange(n))))

        # hai it works!
        assert s[("a", 5)] == 5
        assert s[("a", 6)] == 6
        assert s[("a", 7)] == 7

        _index._SIZE_CUTOFF = old_cutoff

    def test_multiindex_na_repr(self):
        # only an issue with long columns

        from numpy import nan
        df3 = DataFrame({
            'A' * 30: {('A', 'A0006000', 'nuit'): 'A0006000'},
            'B' * 30: {('A', 'A0006000', 'nuit'): nan},
            'C' * 30: {('A', 'A0006000', 'nuit'): nan},
            'D' * 30: {('A', 'A0006000', 'nuit'): nan},
            'E' * 30: {('A', 'A0006000', 'nuit'): 'A'},
            'F' * 30: {('A', 'A0006000', 'nuit'): nan},
        })

        idf = df3.set_index(['A' * 30, 'C' * 30])
        repr(idf)

    def test_assign_index_sequences(self):
        # #2200
        df = DataFrame({"a": [1, 2, 3],
                        "b": [4, 5, 6],
                        "c": [7, 8, 9]}).set_index(["a", "b"])
        l = list(df.index)
        l[0] = ("faz", "boo")
        df.index = l
        repr(df)

        # this travels an improper code path
        l[0] = ["faz", "boo"]
        df.index = l
        repr(df)

    def test_tuples_have_na(self):
        index = MultiIndex(levels=[[1, 0], [0, 1, 2, 3]],
                           labels=[[1, 1, 1, 1, -1, 0, 0, 0], [0, 1, 2, 3, 0,
                                                               1, 2, 3]])

        assert isnull(index[4][0])
        assert isnull(index.values[4][0])

    def test_duplicate_groupby_issues(self):
        idx_tp = [('600809', '20061231'), ('600809', '20070331'),
                  ('600809', '20070630'), ('600809', '20070331')]
        dt = ['demo', 'demo', 'demo', 'demo']

        idx = MultiIndex.from_tuples(idx_tp, names=['STK_ID', 'RPT_Date'])
        s = Series(dt, index=idx)

        result = s.groupby(s.index).first()
        assert len(result) == 3

    def test_duplicate_mi(self):
        # GH 4516
        df = DataFrame([['foo', 'bar', 1.0, 1], ['foo', 'bar', 2.0, 2],
                        ['bah', 'bam', 3.0, 3],
                        ['bah', 'bam', 4.0, 4], ['foo', 'bar', 5.0, 5],
                        ['bah', 'bam', 6.0, 6]],
                       columns=list('ABCD'))
        df = df.set_index(['A', 'B'])
        df = df.sort_index(level=0)
        expected = DataFrame([['foo', 'bar', 1.0, 1], ['foo', 'bar', 2.0, 2],
                              ['foo', 'bar', 5.0, 5]],
                             columns=list('ABCD')).set_index(['A', 'B'])
        result = df.loc[('foo', 'bar')]
        tm.assert_frame_equal(result, expected)

    def test_duplicated_drop_duplicates(self):
        # GH 4060
        idx = MultiIndex.from_arrays(([1, 2, 3, 1, 2, 3], [1, 1, 1, 1, 2, 2]))

        expected = np.array(
            [False, False, False, True, False, False], dtype=bool)
        duplicated = idx.duplicated()
        tm.assert_numpy_array_equal(duplicated, expected)
        assert duplicated.dtype == bool
        expected = MultiIndex.from_arrays(([1, 2, 3, 2, 3], [1, 1, 1, 2, 2]))
        tm.assert_index_equal(idx.drop_duplicates(), expected)

        expected = np.array([True, False, False, False, False, False])
        duplicated = idx.duplicated(keep='last')
        tm.assert_numpy_array_equal(duplicated, expected)
        assert duplicated.dtype == bool
        expected = MultiIndex.from_arrays(([2, 3, 1, 2, 3], [1, 1, 1, 2, 2]))
        tm.assert_index_equal(idx.drop_duplicates(keep='last'), expected)

        expected = np.array([True, False, False, True, False, False])
        duplicated = idx.duplicated(keep=False)
        tm.assert_numpy_array_equal(duplicated, expected)
        assert duplicated.dtype == bool
        expected = MultiIndex.from_arrays(([2, 3, 2, 3], [1, 1, 2, 2]))
        tm.assert_index_equal(idx.drop_duplicates(keep=False), expected)

    def test_multiindex_set_index(self):
        # segfault in #3308
        d = {'t1': [2, 2.5, 3], 't2': [4, 5, 6]}
        df = DataFrame(d)
        tuples = [(0, 1), (0, 2), (1, 2)]
        df['tuples'] = tuples

        index = MultiIndex.from_tuples(df['tuples'])
        # it works!
        df.set_index(index)

    def test_datetimeindex(self):
        idx1 = pd.DatetimeIndex(
            ['2013-04-01 9:00', '2013-04-02 9:00', '2013-04-03 9:00'
             ] * 2, tz='Asia/Tokyo')
        idx2 = pd.date_range('2010/01/01', periods=6, freq='M',
                             tz='US/Eastern')
        idx = MultiIndex.from_arrays([idx1, idx2])

        expected1 = pd.DatetimeIndex(['2013-04-01 9:00', '2013-04-02 9:00',
                                      '2013-04-03 9:00'], tz='Asia/Tokyo')

        tm.assert_index_equal(idx.levels[0], expected1)
        tm.assert_index_equal(idx.levels[1], idx2)

        # from datetime combos
        # GH 7888
        date1 = datetime.date.today()
        date2 = datetime.datetime.today()
        date3 = Timestamp.today()

        for d1, d2 in itertools.product(
                [date1, date2, date3], [date1, date2, date3]):
            index = pd.MultiIndex.from_product([[d1], [d2]])
            assert isinstance(index.levels[0], pd.DatetimeIndex)
            assert isinstance(index.levels[1], pd.DatetimeIndex)

    def test_constructor_with_tz(self):

        index = pd.DatetimeIndex(['2013/01/01 09:00', '2013/01/02 09:00'],
                                 name='dt1', tz='US/Pacific')
        columns = pd.DatetimeIndex(['2014/01/01 09:00', '2014/01/02 09:00'],
                                   name='dt2', tz='Asia/Tokyo')

        result = MultiIndex.from_arrays([index, columns])
        tm.assert_index_equal(result.levels[0], index)
        tm.assert_index_equal(result.levels[1], columns)

        result = MultiIndex.from_arrays([Series(index), Series(columns)])
        tm.assert_index_equal(result.levels[0], index)
        tm.assert_index_equal(result.levels[1], columns)

    def test_set_index_datetime(self):
        # GH 3950
        df = pd.DataFrame(
            {'label': ['a', 'a', 'a', 'b', 'b', 'b'],
             'datetime': ['2011-07-19 07:00:00', '2011-07-19 08:00:00',
                          '2011-07-19 09:00:00', '2011-07-19 07:00:00',
                          '2011-07-19 08:00:00', '2011-07-19 09:00:00'],
             'value': range(6)})
        df.index = pd.to_datetime(df.pop('datetime'), utc=True)
        df.index = df.index.tz_localize('UTC').tz_convert('US/Pacific')

        expected = pd.DatetimeIndex(['2011-07-19 07:00:00',
                                     '2011-07-19 08:00:00',
                                     '2011-07-19 09:00:00'], name='datetime')
        expected = expected.tz_localize('UTC').tz_convert('US/Pacific')

        df = df.set_index('label', append=True)
        tm.assert_index_equal(df.index.levels[0], expected)
        tm.assert_index_equal(df.index.levels[1],
                              pd.Index(['a', 'b'], name='label'))

        df = df.swaplevel(0, 1)
        tm.assert_index_equal(df.index.levels[0],
                              pd.Index(['a', 'b'], name='label'))
        tm.assert_index_equal(df.index.levels[1], expected)

        df = DataFrame(np.random.random(6))
        idx1 = pd.DatetimeIndex(['2011-07-19 07:00:00', '2011-07-19 08:00:00',
                                 '2011-07-19 09:00:00', '2011-07-19 07:00:00',
                                 '2011-07-19 08:00:00', '2011-07-19 09:00:00'],
                                tz='US/Eastern')
        idx2 = pd.DatetimeIndex(['2012-04-01 09:00', '2012-04-01 09:00',
                                 '2012-04-01 09:00', '2012-04-02 09:00',
                                 '2012-04-02 09:00', '2012-04-02 09:00'],
                                tz='US/Eastern')
        idx3 = pd.date_range('2011-01-01 09:00', periods=6, tz='Asia/Tokyo')

        df = df.set_index(idx1)
        df = df.set_index(idx2, append=True)
        df = df.set_index(idx3, append=True)

        expected1 = pd.DatetimeIndex(['2011-07-19 07:00:00',
                                      '2011-07-19 08:00:00',
                                      '2011-07-19 09:00:00'], tz='US/Eastern')
        expected2 = pd.DatetimeIndex(['2012-04-01 09:00', '2012-04-02 09:00'],
                                     tz='US/Eastern')

        tm.assert_index_equal(df.index.levels[0], expected1)
        tm.assert_index_equal(df.index.levels[1], expected2)
        tm.assert_index_equal(df.index.levels[2], idx3)

        # GH 7092
        tm.assert_index_equal(df.index.get_level_values(0), idx1)
        tm.assert_index_equal(df.index.get_level_values(1), idx2)
        tm.assert_index_equal(df.index.get_level_values(2), idx3)

    def test_reset_index_datetime(self):
        # GH 3950
        for tz in ['UTC', 'Asia/Tokyo', 'US/Eastern']:
            idx1 = pd.date_range('1/1/2011', periods=5, freq='D', tz=tz,
                                 name='idx1')
            idx2 = pd.Index(range(5), name='idx2', dtype='int64')
            idx = pd.MultiIndex.from_arrays([idx1, idx2])
            df = pd.DataFrame(
                {'a': np.arange(5, dtype='int64'),
                 'b': ['A', 'B', 'C', 'D', 'E']}, index=idx)

            expected = pd.DataFrame({'idx1': [datetime.datetime(2011, 1, 1),
                                              datetime.datetime(2011, 1, 2),
                                              datetime.datetime(2011, 1, 3),
                                              datetime.datetime(2011, 1, 4),
                                              datetime.datetime(2011, 1, 5)],
                                     'idx2': np.arange(5, dtype='int64'),
                                     'a': np.arange(5, dtype='int64'),
                                     'b': ['A', 'B', 'C', 'D', 'E']},
                                    columns=['idx1', 'idx2', 'a', 'b'])
            expected['idx1'] = expected['idx1'].apply(
                lambda d: pd.Timestamp(d, tz=tz))

            tm.assert_frame_equal(df.reset_index(), expected)

            idx3 = pd.date_range('1/1/2012', periods=5, freq='MS',
                                 tz='Europe/Paris', name='idx3')
            idx = pd.MultiIndex.from_arrays([idx1, idx2, idx3])
            df = pd.DataFrame(
                {'a': np.arange(5, dtype='int64'),
                 'b': ['A', 'B', 'C', 'D', 'E']}, index=idx)

            expected = pd.DataFrame({'idx1': [datetime.datetime(2011, 1, 1),
                                              datetime.datetime(2011, 1, 2),
                                              datetime.datetime(2011, 1, 3),
                                              datetime.datetime(2011, 1, 4),
                                              datetime.datetime(2011, 1, 5)],
                                     'idx2': np.arange(5, dtype='int64'),
                                     'idx3': [datetime.datetime(2012, 1, 1),
                                              datetime.datetime(2012, 2, 1),
                                              datetime.datetime(2012, 3, 1),
                                              datetime.datetime(2012, 4, 1),
                                              datetime.datetime(2012, 5, 1)],
                                     'a': np.arange(5, dtype='int64'),
                                     'b': ['A', 'B', 'C', 'D', 'E']},
                                    columns=['idx1', 'idx2', 'idx3', 'a', 'b'])
            expected['idx1'] = expected['idx1'].apply(
                lambda d: pd.Timestamp(d, tz=tz))
            expected['idx3'] = expected['idx3'].apply(
                lambda d: pd.Timestamp(d, tz='Europe/Paris'))
            tm.assert_frame_equal(df.reset_index(), expected)

            # GH 7793
            idx = pd.MultiIndex.from_product([['a', 'b'], pd.date_range(
                '20130101', periods=3, tz=tz)])
            df = pd.DataFrame(
                np.arange(6, dtype='int64').reshape(
                    6, 1), columns=['a'], index=idx)

            expected = pd.DataFrame({'level_0': 'a a a b b b'.split(),
                                     'level_1': [
                                         datetime.datetime(2013, 1, 1),
                                         datetime.datetime(2013, 1, 2),
                                         datetime.datetime(2013, 1, 3)] * 2,
                                     'a': np.arange(6, dtype='int64')},
                                    columns=['level_0', 'level_1', 'a'])
            expected['level_1'] = expected['level_1'].apply(
                lambda d: pd.Timestamp(d, freq='D', tz=tz))
            tm.assert_frame_equal(df.reset_index(), expected)

    def test_reset_index_period(self):
        # GH 7746
        idx = pd.MultiIndex.from_product([pd.period_range('20130101',
                                                          periods=3, freq='M'),
                                          ['a', 'b', 'c']],
                                         names=['month', 'feature'])

        df = pd.DataFrame(np.arange(9, dtype='int64')
                          .reshape(-1, 1),
                          index=idx, columns=['a'])
        expected = pd.DataFrame({
            'month': ([pd.Period('2013-01', freq='M')] * 3 +
                      [pd.Period('2013-02', freq='M')] * 3 +
                      [pd.Period('2013-03', freq='M')] * 3),
            'feature': ['a', 'b', 'c'] * 3,
            'a': np.arange(9, dtype='int64')
        }, columns=['month', 'feature', 'a'])
        tm.assert_frame_equal(df.reset_index(), expected)

    def test_reset_index_multiindex_columns(self):
        levels = [['A', ''], ['B', 'b']]
        df = pd.DataFrame([[0, 2], [1, 3]],
                          columns=pd.MultiIndex.from_tuples(levels))
        result = df[['B']].rename_axis('A').reset_index()
        tm.assert_frame_equal(result, df)

        # gh-16120: already existing column
        with tm.assert_raises_regex(ValueError,
                                    ("cannot insert \('A', ''\), "
                                     "already exists")):
            df.rename_axis('A').reset_index()

        # gh-16164: multiindex (tuple) full key
        result = df.set_index([('A', '')]).reset_index()
        tm.assert_frame_equal(result, df)

        # with additional (unnamed) index level
        idx_col = pd.DataFrame([[0], [1]],
                               columns=pd.MultiIndex.from_tuples([('level_0',
                                                                   '')]))
        expected = pd.concat([idx_col, df[[('B', 'b'), ('A', '')]]], axis=1)
        result = df.set_index([('B', 'b')], append=True).reset_index()
        tm.assert_frame_equal(result, expected)

        # with index name which is a too long tuple...
        with tm.assert_raises_regex(ValueError,
                                    ("Item must have length equal to number "
                                     "of levels.")):
            df.rename_axis([('C', 'c', 'i')]).reset_index()

        # or too short...
        levels = [['A', 'a', ''], ['B', 'b', 'i']]
        df2 = pd.DataFrame([[0, 2], [1, 3]],
                           columns=pd.MultiIndex.from_tuples(levels))
        idx_col = pd.DataFrame([[0], [1]],
                               columns=pd.MultiIndex.from_tuples([('C',
                                                                   'c',
                                                                   'ii')]))
        expected = pd.concat([idx_col, df2], axis=1)
        result = df2.rename_axis([('C', 'c')]).reset_index(col_fill='ii')
        tm.assert_frame_equal(result, expected)

        # ... which is incompatible with col_fill=None
        with tm.assert_raises_regex(ValueError,
                                    ("col_fill=None is incompatible with "
                                     "incomplete column name \('C', 'c'\)")):
            df2.rename_axis([('C', 'c')]).reset_index(col_fill=None)

        # with col_level != 0
        result = df2.rename_axis([('c', 'ii')]).reset_index(col_level=1,
                                                            col_fill='C')
        tm.assert_frame_equal(result, expected)

    def test_set_index_period(self):
        # GH 6631
        df = DataFrame(np.random.random(6))
        idx1 = pd.period_range('2011-01-01', periods=3, freq='M')
        idx1 = idx1.append(idx1)
        idx2 = pd.period_range('2013-01-01 09:00', periods=2, freq='H')
        idx2 = idx2.append(idx2).append(idx2)
        idx3 = pd.period_range('2005', periods=6, freq='A')

        df = df.set_index(idx1)
        df = df.set_index(idx2, append=True)
        df = df.set_index(idx3, append=True)

        expected1 = pd.period_range('2011-01-01', periods=3, freq='M')
        expected2 = pd.period_range('2013-01-01 09:00', periods=2, freq='H')

        tm.assert_index_equal(df.index.levels[0], expected1)
        tm.assert_index_equal(df.index.levels[1], expected2)
        tm.assert_index_equal(df.index.levels[2], idx3)

        tm.assert_index_equal(df.index.get_level_values(0), idx1)
        tm.assert_index_equal(df.index.get_level_values(1), idx2)
        tm.assert_index_equal(df.index.get_level_values(2), idx3)

    def test_repeat(self):
        # GH 9361
        # fixed by # GH 7891
        m_idx = pd.MultiIndex.from_tuples([(1, 2), (3, 4), (5, 6), (7, 8)])
        data = ['a', 'b', 'c', 'd']
        m_df = pd.Series(data, index=m_idx)
        assert m_df.repeat(3).shape == (3 * len(data), )

    def test_iloc_mi(self):
        # GH 13797
        # Test if iloc can handle integer locations in MultiIndexed DataFrame

        data = [
            ['str00', 'str01'],
            ['str10', 'str11'],
            ['str20', 'srt21'],
            ['str30', 'str31'],
            ['str40', 'str41']
        ]

        mi = pd.MultiIndex.from_tuples(
            [('CC', 'A'),
             ('CC', 'B'),
             ('CC', 'B'),
             ('BB', 'a'),
             ('BB', 'b')
             ])

        expected = pd.DataFrame(data)
        df_mi = pd.DataFrame(data, index=mi)

        result = pd.DataFrame([[df_mi.iloc[r, c] for c in range(2)]
                               for r in range(5)])

        tm.assert_frame_equal(result, expected)


class TestSorted(Base):
    """ everthing you wanted to test about sorting """

    def test_sort_index_preserve_levels(self):
        result = self.frame.sort_index()
        assert result.index.names == self.frame.index.names

    def test_sorting_repr_8017(self):

        np.random.seed(0)
        data = np.random.randn(3, 4)

        for gen, extra in [([1., 3., 2., 5.], 4.), ([1, 3, 2, 5], 4),
                           ([Timestamp('20130101'), Timestamp('20130103'),
                             Timestamp('20130102'), Timestamp('20130105')],
                            Timestamp('20130104')),
                           (['1one', '3one', '2one', '5one'], '4one')]:
            columns = MultiIndex.from_tuples([('red', i) for i in gen])
            df = DataFrame(data, index=list('def'), columns=columns)
            df2 = pd.concat([df,
                             DataFrame('world', index=list('def'),
                                       columns=MultiIndex.from_tuples(
                                           [('red', extra)]))], axis=1)

            # check that the repr is good
            # make sure that we have a correct sparsified repr
            # e.g. only 1 header of read
            assert str(df2).splitlines()[0].split() == ['red']

            # GH 8017
            # sorting fails after columns added

            # construct single-dtype then sort
            result = df.copy().sort_index(axis=1)
            expected = df.iloc[:, [0, 2, 1, 3]]
            tm.assert_frame_equal(result, expected)

            result = df2.sort_index(axis=1)
            expected = df2.iloc[:, [0, 2, 1, 4, 3]]
            tm.assert_frame_equal(result, expected)

            # setitem then sort
            result = df.copy()
            result[('red', extra)] = 'world'

            result = result.sort_index(axis=1)
            tm.assert_frame_equal(result, expected)

    def test_sort_index_level(self):
        df = self.frame.copy()
        df.index = np.arange(len(df))

        # axis=1

        # series
        a_sorted = self.frame['A'].sort_index(level=0)

        # preserve names
        assert a_sorted.index.names == self.frame.index.names

        # inplace
        rs = self.frame.copy()
        rs.sort_index(level=0, inplace=True)
        tm.assert_frame_equal(rs, self.frame.sort_index(level=0))

    def test_sort_index_level_large_cardinality(self):

        # #2684 (int64)
        index = MultiIndex.from_arrays([np.arange(4000)] * 3)
        df = DataFrame(np.random.randn(4000), index=index, dtype=np.int64)

        # it works!
        result = df.sort_index(level=0)
        assert result.index.lexsort_depth == 3

        # #2684 (int32)
        index = MultiIndex.from_arrays([np.arange(4000)] * 3)
        df = DataFrame(np.random.randn(4000), index=index, dtype=np.int32)

        # it works!
        result = df.sort_index(level=0)
        assert (result.dtypes.values == df.dtypes.values).all()
        assert result.index.lexsort_depth == 3

    def test_sort_index_level_by_name(self):
        self.frame.index.names = ['first', 'second']
        result = self.frame.sort_index(level='second')
        expected = self.frame.sort_index(level=1)
        tm.assert_frame_equal(result, expected)

    def test_sort_index_level_mixed(self):
        sorted_before = self.frame.sort_index(level=1)

        df = self.frame.copy()
        df['foo'] = 'bar'
        sorted_after = df.sort_index(level=1)
        tm.assert_frame_equal(sorted_before,
                              sorted_after.drop(['foo'], axis=1))

        dft = self.frame.T
        sorted_before = dft.sort_index(level=1, axis=1)
        dft['foo', 'three'] = 'bar'

        sorted_after = dft.sort_index(level=1, axis=1)
        tm.assert_frame_equal(sorted_before.drop([('foo', 'three')], axis=1),
                              sorted_after.drop([('foo', 'three')], axis=1))

    def test_is_lexsorted(self):
        levels = [[0, 1], [0, 1, 2]]

        index = MultiIndex(levels=levels,
                           labels=[[0, 0, 0, 1, 1, 1], [0, 1, 2, 0, 1, 2]])
        assert index.is_lexsorted()

        index = MultiIndex(levels=levels,
                           labels=[[0, 0, 0, 1, 1, 1], [0, 1, 2, 0, 2, 1]])
        assert not index.is_lexsorted()

        index = MultiIndex(levels=levels,
                           labels=[[0, 0, 1, 0, 1, 1], [0, 1, 0, 2, 2, 1]])
        assert not index.is_lexsorted()
        assert index.lexsort_depth == 0

    def test_getitem_multilevel_index_tuple_not_sorted(self):
        index_columns = list("abc")
        df = DataFrame([[0, 1, 0, "x"], [0, 0, 1, "y"]],
                       columns=index_columns + ["data"])
        df = df.set_index(index_columns)
        query_index = df.index[:1]
        rs = df.loc[query_index, "data"]

        xp_idx = MultiIndex.from_tuples([(0, 1, 0)], names=['a', 'b', 'c'])
        xp = Series(['x'], index=xp_idx, name='data')
        tm.assert_series_equal(rs, xp)

    def test_getitem_slice_not_sorted(self):
        df = self.frame.sort_index(level=1).T

        # buglet with int typechecking
        result = df.iloc[:, :np.int32(3)]
        expected = df.reindex(columns=df.columns[:3])
        tm.assert_frame_equal(result, expected)

    def test_frame_getitem_not_sorted2(self):
        # 13431
        df = DataFrame({'col1': ['b', 'd', 'b', 'a'],
                        'col2': [3, 1, 1, 2],
                        'data': ['one', 'two', 'three', 'four']})

        df2 = df.set_index(['col1', 'col2'])
        df2_original = df2.copy()

        df2.index.set_levels(['b', 'd', 'a'], level='col1', inplace=True)
        df2.index.set_labels([0, 1, 0, 2], level='col1', inplace=True)
        assert not df2.index.is_lexsorted()
        assert not df2.index.is_monotonic

        assert df2_original.index.equals(df2.index)
        expected = df2.sort_index()
        assert expected.index.is_lexsorted()
        assert expected.index.is_monotonic

        result = df2.sort_index(level=0)
        assert result.index.is_lexsorted()
        assert result.index.is_monotonic
        tm.assert_frame_equal(result, expected)

    def test_frame_getitem_not_sorted(self):
        df = self.frame.T
        df['foo', 'four'] = 'foo'

        arrays = [np.array(x) for x in zip(*df.columns.values)]

        result = df['foo']
        result2 = df.loc[:, 'foo']
        expected = df.reindex(columns=df.columns[arrays[0] == 'foo'])
        expected.columns = expected.columns.droplevel(0)
        tm.assert_frame_equal(result, expected)
        tm.assert_frame_equal(result2, expected)

        df = df.T
        result = df.xs('foo')
        result2 = df.loc['foo']
        expected = df.reindex(df.index[arrays[0] == 'foo'])
        expected.index = expected.index.droplevel(0)
        tm.assert_frame_equal(result, expected)
        tm.assert_frame_equal(result2, expected)

    def test_series_getitem_not_sorted(self):
        arrays = [['bar', 'bar', 'baz', 'baz', 'qux', 'qux', 'foo', 'foo'],
                  ['one', 'two', 'one', 'two', 'one', 'two', 'one', 'two']]
        tuples = lzip(*arrays)
        index = MultiIndex.from_tuples(tuples)
        s = Series(randn(8), index=index)

        arrays = [np.array(x) for x in zip(*index.values)]

        result = s['qux']
        result2 = s.loc['qux']
        expected = s[arrays[0] == 'qux']
        expected.index = expected.index.droplevel(0)
        tm.assert_series_equal(result, expected)
        tm.assert_series_equal(result2, expected)

    def test_sort_index_and_reconstruction(self):

        # 15622
        # lexsortedness should be identical
        # across MultiIndex consruction methods

        df = DataFrame([[1, 1], [2, 2]], index=list('ab'))
        expected = DataFrame([[1, 1], [2, 2], [1, 1], [2, 2]],
                             index=MultiIndex.from_tuples([(0.5, 'a'),
                                                           (0.5, 'b'),
                                                           (0.8, 'a'),
                                                           (0.8, 'b')]))
        assert expected.index.is_lexsorted()

        result = DataFrame(
            [[1, 1], [2, 2], [1, 1], [2, 2]],
            index=MultiIndex.from_product([[0.5, 0.8], list('ab')]))
        result = result.sort_index()
        assert result.index.is_lexsorted()
        assert result.index.is_monotonic

        tm.assert_frame_equal(result, expected)

        result = DataFrame(
            [[1, 1], [2, 2], [1, 1], [2, 2]],
            index=MultiIndex(levels=[[0.5, 0.8], ['a', 'b']],
                             labels=[[0, 0, 1, 1], [0, 1, 0, 1]]))
        result = result.sort_index()
        assert result.index.is_lexsorted()

        tm.assert_frame_equal(result, expected)

        concatted = pd.concat([df, df], keys=[0.8, 0.5])
        result = concatted.sort_index()

        assert result.index.is_lexsorted()
        assert result.index.is_monotonic

        tm.assert_frame_equal(result, expected)

        # 14015
        df = DataFrame([[1, 2], [6, 7]],
                       columns=MultiIndex.from_tuples(
                           [(0, '20160811 12:00:00'),
                            (0, '20160809 12:00:00')],
                           names=['l1', 'Date']))

        df.columns.set_levels(pd.to_datetime(df.columns.levels[1]),
                              level=1,
                              inplace=True)
        assert not df.columns.is_lexsorted()
        assert not df.columns.is_monotonic
        result = df.sort_index(axis=1)
        assert result.columns.is_lexsorted()
        assert result.columns.is_monotonic
        result = df.sort_index(axis=1, level=1)
        assert result.columns.is_lexsorted()
        assert result.columns.is_monotonic

    def test_sort_index_and_reconstruction_doc_example(self):
        # doc example
        df = DataFrame({'value': [1, 2, 3, 4]},
                       index=MultiIndex(
                           levels=[['a', 'b'], ['bb', 'aa']],
                           labels=[[0, 0, 1, 1], [0, 1, 0, 1]]))
        assert df.index.is_lexsorted()
        assert not df.index.is_monotonic

        # sort it
        expected = DataFrame({'value': [2, 1, 4, 3]},
                             index=MultiIndex(
                                 levels=[['a', 'b'], ['aa', 'bb']],
                                 labels=[[0, 0, 1, 1], [0, 1, 0, 1]]))
        result = df.sort_index()
        assert result.index.is_lexsorted()
        assert result.index.is_monotonic

        tm.assert_frame_equal(result, expected)

        # reconstruct
        result = df.sort_index().copy()
        result.index = result.index._sort_levels_monotonic()
        assert result.index.is_lexsorted()
        assert result.index.is_monotonic

        tm.assert_frame_equal(result, expected)

    def test_sort_index_reorder_on_ops(self):
        # 15687
        df = pd.DataFrame(
            np.random.randn(8, 2),
            index=MultiIndex.from_product(
                [['a', 'b'],
                 ['big', 'small'],
                 ['red', 'blu']],
                names=['letter', 'size', 'color']),
            columns=['near', 'far'])
        df = df.sort_index()

        def my_func(group):
            group.index = ['newz', 'newa']
            return group

        result = df.groupby(level=['letter', 'size']).apply(
            my_func).sort_index()
        expected = MultiIndex.from_product(
            [['a', 'b'],
             ['big', 'small'],
             ['newa', 'newz']],
            names=['letter', 'size', None])

        tm.assert_index_equal(result.index, expected)

    def test_sort_non_lexsorted(self):
        # degenerate case where we sort but don't
        # have a satisfying result :<
        # GH 15797
        idx = MultiIndex([['A', 'B', 'C'],
                          ['c', 'b', 'a']],
                         [[0, 1, 2, 0, 1, 2],
                          [0, 2, 1, 1, 0, 2]])

        df = DataFrame({'col': range(len(idx))},
                       index=idx,
                       dtype='int64')
        assert df.index.is_lexsorted() is False
        assert df.index.is_monotonic is False

        sorted = df.sort_index()
        assert sorted.index.is_lexsorted() is True
        assert sorted.index.is_monotonic is True

        expected = DataFrame(
            {'col': [1, 4, 5, 2]},
            index=MultiIndex.from_tuples([('B', 'a'), ('B', 'c'),
                                          ('C', 'a'), ('C', 'b')]),
            dtype='int64')
        result = sorted.loc[pd.IndexSlice['B':'C', 'a':'c'], :]
        tm.assert_frame_equal(result, expected)

    def test_sort_index_nan(self):
        # GH 14784
        # incorrect sorting w.r.t. nans
        tuples = [[12, 13], [np.nan, np.nan], [np.nan, 3], [1, 2]]
        mi = MultiIndex.from_tuples(tuples)

        df = DataFrame(np.arange(16).reshape(4, 4),
                       index=mi, columns=list('ABCD'))
        s = Series(np.arange(4), index=mi)

        df2 = DataFrame({
            'date': pd.to_datetime([
                '20121002', '20121007', '20130130', '20130202', '20130305',
                '20121002', '20121207', '20130130', '20130202', '20130305',
                '20130202', '20130305'
            ]),
            'user_id': [1, 1, 1, 1, 1, 3, 3, 3, 5, 5, 5, 5],
            'whole_cost': [1790, np.nan, 280, 259, np.nan, 623, 90, 312,
                           np.nan, 301, 359, 801],
            'cost': [12, 15, 10, 24, 39, 1, 0, np.nan, 45, 34, 1, 12]
        }).set_index(['date', 'user_id'])

        # sorting frame, default nan position is last
        result = df.sort_index()
        expected = df.iloc[[3, 0, 2, 1], :]
        tm.assert_frame_equal(result, expected)

        # sorting frame, nan position last
        result = df.sort_index(na_position='last')
        expected = df.iloc[[3, 0, 2, 1], :]
        tm.assert_frame_equal(result, expected)

        # sorting frame, nan position first
        result = df.sort_index(na_position='first')
        expected = df.iloc[[1, 2, 3, 0], :]
        tm.assert_frame_equal(result, expected)

        # sorting frame with removed rows
        result = df2.dropna().sort_index()
        expected = df2.sort_index().dropna()
        tm.assert_frame_equal(result, expected)

        # sorting series, default nan position is last
        result = s.sort_index()
        expected = s.iloc[[3, 0, 2, 1]]
        tm.assert_series_equal(result, expected)

        # sorting series, nan position last
        result = s.sort_index(na_position='last')
        expected = s.iloc[[3, 0, 2, 1]]
        tm.assert_series_equal(result, expected)

        # sorting series, nan position first
        result = s.sort_index(na_position='first')
        expected = s.iloc[[1, 2, 3, 0]]
        tm.assert_series_equal(result, expected)
