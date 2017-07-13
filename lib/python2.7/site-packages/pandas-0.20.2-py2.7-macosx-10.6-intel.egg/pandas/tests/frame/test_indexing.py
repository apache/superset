# -*- coding: utf-8 -*-

from __future__ import print_function
from warnings import catch_warnings

from datetime import datetime, date, timedelta, time

from pandas.compat import map, zip, range, lrange, lzip, long
from pandas import compat

from numpy import nan
from numpy.random import randn

import pytest
import numpy as np

import pandas.core.common as com
from pandas import (DataFrame, Index, Series, notnull, isnull,
                    MultiIndex, DatetimeIndex, Timestamp,
                    date_range)
import pandas as pd

from pandas._libs.tslib import iNaT
from pandas.tseries.offsets import BDay
from pandas.core.dtypes.common import (
    is_float_dtype,
    is_integer,
    is_scalar)
from pandas.util.testing import (assert_almost_equal,
                                 assert_series_equal,
                                 assert_frame_equal)
from pandas.core.indexing import IndexingError

import pandas.util.testing as tm

from pandas.tests.frame.common import TestData


class TestDataFrameIndexing(TestData):

    def test_getitem(self):
        # Slicing
        sl = self.frame[:20]
        assert len(sl.index) == 20

        # Column access
        for _, series in compat.iteritems(sl):
            assert len(series.index) == 20
            assert tm.equalContents(series.index, sl.index)

        for key, _ in compat.iteritems(self.frame._series):
            assert self.frame[key] is not None

        assert 'random' not in self.frame
        with tm.assert_raises_regex(KeyError, 'random'):
            self.frame['random']

        df = self.frame.copy()
        df['$10'] = randn(len(df))

        ad = randn(len(df))
        df['@awesome_domain'] = ad

        with pytest.raises(KeyError):
            df.__getitem__('df["$10"]')

        res = df['@awesome_domain']
        tm.assert_numpy_array_equal(ad, res.values)

    def test_getitem_dupe_cols(self):
        df = DataFrame([[1, 2, 3], [4, 5, 6]], columns=['a', 'a', 'b'])
        try:
            df[['baf']]
        except KeyError:
            pass
        else:
            self.fail("Dataframe failed to raise KeyError")

    def test_get(self):
        b = self.frame.get('B')
        assert_series_equal(b, self.frame['B'])

        assert self.frame.get('foo') is None
        assert_series_equal(self.frame.get('foo', self.frame['B']),
                            self.frame['B'])
        # None
        # GH 5652
        for df in [DataFrame(), DataFrame(columns=list('AB')),
                   DataFrame(columns=list('AB'), index=range(3))]:
            result = df.get(None)
            assert result is None

    def test_getitem_iterator(self):
        idx = iter(['A', 'B', 'C'])
        result = self.frame.loc[:, idx]
        expected = self.frame.loc[:, ['A', 'B', 'C']]
        assert_frame_equal(result, expected)

        idx = iter(['A', 'B', 'C'])
        result = self.frame.loc[:, idx]
        expected = self.frame.loc[:, ['A', 'B', 'C']]
        assert_frame_equal(result, expected)

    def test_getitem_list(self):
        self.frame.columns.name = 'foo'

        result = self.frame[['B', 'A']]
        result2 = self.frame[Index(['B', 'A'])]

        expected = self.frame.loc[:, ['B', 'A']]
        expected.columns.name = 'foo'

        assert_frame_equal(result, expected)
        assert_frame_equal(result2, expected)

        assert result.columns.name == 'foo'

        with tm.assert_raises_regex(KeyError, 'not in index'):
            self.frame[['B', 'A', 'food']]
        with tm.assert_raises_regex(KeyError, 'not in index'):
            self.frame[Index(['B', 'A', 'foo'])]

        # tuples
        df = DataFrame(randn(8, 3),
                       columns=Index([('foo', 'bar'), ('baz', 'qux'),
                                      ('peek', 'aboo')], name=['sth', 'sth2']))

        result = df[[('foo', 'bar'), ('baz', 'qux')]]
        expected = df.iloc[:, :2]
        assert_frame_equal(result, expected)
        assert result.columns.names == ['sth', 'sth2']

    def test_getitem_callable(self):
        # GH 12533
        result = self.frame[lambda x: 'A']
        tm.assert_series_equal(result, self.frame.loc[:, 'A'])

        result = self.frame[lambda x: ['A', 'B']]
        tm.assert_frame_equal(result, self.frame.loc[:, ['A', 'B']])

        df = self.frame[:3]
        result = df[lambda x: [True, False, True]]
        tm.assert_frame_equal(result, self.frame.iloc[[0, 2], :])

    def test_setitem_list(self):

        self.frame['E'] = 'foo'
        data = self.frame[['A', 'B']]
        self.frame[['B', 'A']] = data

        assert_series_equal(self.frame['B'], data['A'], check_names=False)
        assert_series_equal(self.frame['A'], data['B'], check_names=False)

        with tm.assert_raises_regex(ValueError,
                                    'Columns must be same length as key'):
            data[['A']] = self.frame[['A', 'B']]

        with tm.assert_raises_regex(ValueError, 'Length of values '
                                    'does not match '
                                    'length of index'):
            data['A'] = range(len(data.index) - 1)

        df = DataFrame(0, lrange(3), ['tt1', 'tt2'], dtype=np.int_)
        df.loc[1, ['tt1', 'tt2']] = [1, 2]

        result = df.loc[df.index[1], ['tt1', 'tt2']]
        expected = Series([1, 2], df.columns, dtype=np.int_, name=1)
        assert_series_equal(result, expected)

        df['tt1'] = df['tt2'] = '0'
        df.loc[df.index[1], ['tt1', 'tt2']] = ['1', '2']
        result = df.loc[df.index[1], ['tt1', 'tt2']]
        expected = Series(['1', '2'], df.columns, name=1)
        assert_series_equal(result, expected)

    def test_setitem_list_not_dataframe(self):
        data = np.random.randn(len(self.frame), 2)
        self.frame[['A', 'B']] = data
        assert_almost_equal(self.frame[['A', 'B']].values, data)

    def test_setitem_list_of_tuples(self):
        tuples = lzip(self.frame['A'], self.frame['B'])
        self.frame['tuples'] = tuples

        result = self.frame['tuples']
        expected = Series(tuples, index=self.frame.index, name='tuples')
        assert_series_equal(result, expected)

    def test_setitem_mulit_index(self):
        # GH7655, test that assigning to a sub-frame of a frame
        # with multi-index columns aligns both rows and columns
        it = ['jim', 'joe', 'jolie'], ['first', 'last'], \
             ['left', 'center', 'right']

        cols = MultiIndex.from_product(it)
        index = pd.date_range('20141006', periods=20)
        vals = np.random.randint(1, 1000, (len(index), len(cols)))
        df = pd.DataFrame(vals, columns=cols, index=index)

        i, j = df.index.values.copy(), it[-1][:]

        np.random.shuffle(i)
        df['jim'] = df['jolie'].loc[i, ::-1]
        assert_frame_equal(df['jim'], df['jolie'])

        np.random.shuffle(j)
        df[('joe', 'first')] = df[('jolie', 'last')].loc[i, j]
        assert_frame_equal(df[('joe', 'first')], df[('jolie', 'last')])

        np.random.shuffle(j)
        df[('joe', 'last')] = df[('jolie', 'first')].loc[i, j]
        assert_frame_equal(df[('joe', 'last')], df[('jolie', 'first')])

    def test_setitem_callable(self):
        # GH 12533
        df = pd.DataFrame({'A': [1, 2, 3, 4], 'B': [5, 6, 7, 8]})
        df[lambda x: 'A'] = [11, 12, 13, 14]

        exp = pd.DataFrame({'A': [11, 12, 13, 14], 'B': [5, 6, 7, 8]})
        tm.assert_frame_equal(df, exp)

    def test_setitem_other_callable(self):
        # GH 13299
        inc = lambda x: x + 1

        df = pd.DataFrame([[-1, 1], [1, -1]])
        df[df > 0] = inc

        expected = pd.DataFrame([[-1, inc], [inc, -1]])
        tm.assert_frame_equal(df, expected)

    def test_getitem_boolean(self):
        # boolean indexing
        d = self.tsframe.index[10]
        indexer = self.tsframe.index > d
        indexer_obj = indexer.astype(object)

        subindex = self.tsframe.index[indexer]
        subframe = self.tsframe[indexer]

        tm.assert_index_equal(subindex, subframe.index)
        with tm.assert_raises_regex(ValueError, 'Item wrong length'):
            self.tsframe[indexer[:-1]]

        subframe_obj = self.tsframe[indexer_obj]
        assert_frame_equal(subframe_obj, subframe)

        with tm.assert_raises_regex(ValueError, 'boolean values only'):
            self.tsframe[self.tsframe]

        # test that Series work
        indexer_obj = Series(indexer_obj, self.tsframe.index)

        subframe_obj = self.tsframe[indexer_obj]
        assert_frame_equal(subframe_obj, subframe)

        # test that Series indexers reindex
        # we are producing a warning that since the passed boolean
        # key is not the same as the given index, we will reindex
        # not sure this is really necessary
        with tm.assert_produces_warning(UserWarning, check_stacklevel=False):
            indexer_obj = indexer_obj.reindex(self.tsframe.index[::-1])
            subframe_obj = self.tsframe[indexer_obj]
            assert_frame_equal(subframe_obj, subframe)

        # test df[df > 0]
        for df in [self.tsframe, self.mixed_frame,
                   self.mixed_float, self.mixed_int]:

            data = df._get_numeric_data()
            bif = df[df > 0]
            bifw = DataFrame(dict([(c, np.where(data[c] > 0, data[c], np.nan))
                                   for c in data.columns]),
                             index=data.index, columns=data.columns)

            # add back other columns to compare
            for c in df.columns:
                if c not in bifw:
                    bifw[c] = df[c]
            bifw = bifw.reindex(columns=df.columns)

            assert_frame_equal(bif, bifw, check_dtype=False)
            for c in df.columns:
                if bif[c].dtype != bifw[c].dtype:
                    assert bif[c].dtype == df[c].dtype

    def test_getitem_boolean_casting(self):

        # don't upcast if we don't need to
        df = self.tsframe.copy()
        df['E'] = 1
        df['E'] = df['E'].astype('int32')
        df['E1'] = df['E'].copy()
        df['F'] = 1
        df['F'] = df['F'].astype('int64')
        df['F1'] = df['F'].copy()

        casted = df[df > 0]
        result = casted.get_dtype_counts()
        expected = Series({'float64': 4, 'int32': 2, 'int64': 2})
        assert_series_equal(result, expected)

        # int block splitting
        df.loc[df.index[1:3], ['E1', 'F1']] = 0
        casted = df[df > 0]
        result = casted.get_dtype_counts()
        expected = Series({'float64': 6, 'int32': 1, 'int64': 1})
        assert_series_equal(result, expected)

        # where dtype conversions
        # GH 3733
        df = DataFrame(data=np.random.randn(100, 50))
        df = df.where(df > 0)  # create nans
        bools = df > 0
        mask = isnull(df)
        expected = bools.astype(float).mask(mask)
        result = bools.mask(mask)
        assert_frame_equal(result, expected)

    def test_getitem_boolean_list(self):
        df = DataFrame(np.arange(12).reshape(3, 4))

        def _checkit(lst):
            result = df[lst]
            expected = df.loc[df.index[lst]]
            assert_frame_equal(result, expected)

        _checkit([True, False, True])
        _checkit([True, True, True])
        _checkit([False, False, False])

    def test_getitem_boolean_iadd(self):
        arr = randn(5, 5)

        df = DataFrame(arr.copy(), columns=['A', 'B', 'C', 'D', 'E'])

        df[df < 0] += 1
        arr[arr < 0] += 1

        assert_almost_equal(df.values, arr)

    def test_boolean_index_empty_corner(self):
        # #2096
        blah = DataFrame(np.empty([0, 1]), columns=['A'],
                         index=DatetimeIndex([]))

        # both of these should succeed trivially
        k = np.array([], bool)

        blah[k]
        blah[k] = 0

    def test_getitem_ix_mixed_integer(self):
        df = DataFrame(np.random.randn(4, 3),
                       index=[1, 10, 'C', 'E'], columns=[1, 2, 3])

        result = df.iloc[:-1]
        expected = df.loc[df.index[:-1]]
        assert_frame_equal(result, expected)

        with catch_warnings(record=True):
            result = df.ix[[1, 10]]
            expected = df.ix[Index([1, 10], dtype=object)]
        assert_frame_equal(result, expected)

        # 11320
        df = pd.DataFrame({"rna": (1.5, 2.2, 3.2, 4.5),
                           -1000: [11, 21, 36, 40],
                           0: [10, 22, 43, 34],
                           1000: [0, 10, 20, 30]},
                          columns=['rna', -1000, 0, 1000])
        result = df[[1000]]
        expected = df.iloc[:, [3]]
        assert_frame_equal(result, expected)
        result = df[[-1000]]
        expected = df.iloc[:, [1]]
        assert_frame_equal(result, expected)

    def test_getitem_setitem_ix_negative_integers(self):
        with catch_warnings(record=True):
            result = self.frame.ix[:, -1]
        assert_series_equal(result, self.frame['D'])

        with catch_warnings(record=True):
            result = self.frame.ix[:, [-1]]
        assert_frame_equal(result, self.frame[['D']])

        with catch_warnings(record=True):
            result = self.frame.ix[:, [-1, -2]]
        assert_frame_equal(result, self.frame[['D', 'C']])

        with catch_warnings(record=True):
            self.frame.ix[:, [-1]] = 0
        assert (self.frame['D'] == 0).all()

        df = DataFrame(np.random.randn(8, 4))
        with catch_warnings(record=True):
            assert isnull(df.ix[:, [-1]].values).all()

        # #1942
        a = DataFrame(randn(20, 2), index=[chr(x + 65) for x in range(20)])
        with catch_warnings(record=True):
            a.ix[-1] = a.ix[-2]

        with catch_warnings(record=True):
            assert_series_equal(a.ix[-1], a.ix[-2], check_names=False)
            assert a.ix[-1].name == 'T'
            assert a.ix[-2].name == 'S'

    def test_getattr(self):
        assert_series_equal(self.frame.A, self.frame['A'])
        pytest.raises(AttributeError, getattr, self.frame,
                      'NONEXISTENT_NAME')

    def test_setattr_column(self):
        df = DataFrame({'foobar': 1}, index=lrange(10))

        df.foobar = 5
        assert (df.foobar == 5).all()

    def test_setitem(self):
        # not sure what else to do here
        series = self.frame['A'][::2]
        self.frame['col5'] = series
        assert 'col5' in self.frame

        assert len(series) == 15
        assert len(self.frame) == 30

        exp = np.ravel(np.column_stack((series.values, [np.nan] * 15)))
        exp = Series(exp, index=self.frame.index, name='col5')
        tm.assert_series_equal(self.frame['col5'], exp)

        series = self.frame['A']
        self.frame['col6'] = series
        tm.assert_series_equal(series, self.frame['col6'], check_names=False)

        with pytest.raises(KeyError):
            self.frame[randn(len(self.frame) + 1)] = 1

        # set ndarray
        arr = randn(len(self.frame))
        self.frame['col9'] = arr
        assert (self.frame['col9'] == arr).all()

        self.frame['col7'] = 5
        assert((self.frame['col7'] == 5).all())

        self.frame['col0'] = 3.14
        assert((self.frame['col0'] == 3.14).all())

        self.frame['col8'] = 'foo'
        assert((self.frame['col8'] == 'foo').all())

        # this is partially a view (e.g. some blocks are view)
        # so raise/warn
        smaller = self.frame[:2]

        def f():
            smaller['col10'] = ['1', '2']
        pytest.raises(com.SettingWithCopyError, f)
        assert smaller['col10'].dtype == np.object_
        assert (smaller['col10'] == ['1', '2']).all()

        # with a dtype
        for dtype in ['int32', 'int64', 'float32', 'float64']:
            self.frame[dtype] = np.array(arr, dtype=dtype)
            assert self.frame[dtype].dtype.name == dtype

        # dtype changing GH4204
        df = DataFrame([[0, 0]])
        df.iloc[0] = np.nan
        expected = DataFrame([[np.nan, np.nan]])
        assert_frame_equal(df, expected)

        df = DataFrame([[0, 0]])
        df.loc[0] = np.nan
        assert_frame_equal(df, expected)

    def test_setitem_tuple(self):
        self.frame['A', 'B'] = self.frame['A']
        assert_series_equal(self.frame['A', 'B'], self.frame[
                            'A'], check_names=False)

    def test_setitem_always_copy(self):
        s = self.frame['A'].copy()
        self.frame['E'] = s

        self.frame['E'][5:10] = nan
        assert notnull(s[5:10]).all()

    def test_setitem_boolean(self):
        df = self.frame.copy()
        values = self.frame.values

        df[df['A'] > 0] = 4
        values[values[:, 0] > 0] = 4
        assert_almost_equal(df.values, values)

        # test that column reindexing works
        series = df['A'] == 4
        series = series.reindex(df.index[::-1])
        df[series] = 1
        values[values[:, 0] == 4] = 1
        assert_almost_equal(df.values, values)

        df[df > 0] = 5
        values[values > 0] = 5
        assert_almost_equal(df.values, values)

        df[df == 5] = 0
        values[values == 5] = 0
        assert_almost_equal(df.values, values)

        # a df that needs alignment first
        df[df[:-1] < 0] = 2
        np.putmask(values[:-1], values[:-1] < 0, 2)
        assert_almost_equal(df.values, values)

        # indexed with same shape but rows-reversed df
        df[df[::-1] == 2] = 3
        values[values == 2] = 3
        assert_almost_equal(df.values, values)

        with tm.assert_raises_regex(TypeError, 'Must pass '
                                    'DataFrame with '
                                    'boolean values only'):
            df[df * 0] = 2

        # index with DataFrame
        mask = df > np.abs(df)
        expected = df.copy()
        df[df > np.abs(df)] = nan
        expected.values[mask.values] = nan
        assert_frame_equal(df, expected)

        # set from DataFrame
        expected = df.copy()
        df[df > np.abs(df)] = df * 2
        np.putmask(expected.values, mask.values, df.values * 2)
        assert_frame_equal(df, expected)

    def test_setitem_cast(self):
        self.frame['D'] = self.frame['D'].astype('i8')
        assert self.frame['D'].dtype == np.int64

        # #669, should not cast?
        # this is now set to int64, which means a replacement of the column to
        # the value dtype (and nothing to do with the existing dtype)
        self.frame['B'] = 0
        assert self.frame['B'].dtype == np.int64

        # cast if pass array of course
        self.frame['B'] = np.arange(len(self.frame))
        assert issubclass(self.frame['B'].dtype.type, np.integer)

        self.frame['foo'] = 'bar'
        self.frame['foo'] = 0
        assert self.frame['foo'].dtype == np.int64

        self.frame['foo'] = 'bar'
        self.frame['foo'] = 2.5
        assert self.frame['foo'].dtype == np.float64

        self.frame['something'] = 0
        assert self.frame['something'].dtype == np.int64
        self.frame['something'] = 2
        assert self.frame['something'].dtype == np.int64
        self.frame['something'] = 2.5
        assert self.frame['something'].dtype == np.float64

        # GH 7704
        # dtype conversion on setting
        df = DataFrame(np.random.rand(30, 3), columns=tuple('ABC'))
        df['event'] = np.nan
        df.loc[10, 'event'] = 'foo'
        result = df.get_dtype_counts().sort_values()
        expected = Series({'float64': 3, 'object': 1}).sort_values()
        assert_series_equal(result, expected)

        # Test that data type is preserved . #5782
        df = DataFrame({'one': np.arange(6, dtype=np.int8)})
        df.loc[1, 'one'] = 6
        assert df.dtypes.one == np.dtype(np.int8)
        df.one = np.int8(7)
        assert df.dtypes.one == np.dtype(np.int8)

    def test_setitem_boolean_column(self):
        expected = self.frame.copy()
        mask = self.frame['A'] > 0

        self.frame.loc[mask, 'B'] = 0
        expected.values[mask.values, 1] = 0

        assert_frame_equal(self.frame, expected)

    def test_setitem_corner(self):
        # corner case
        df = DataFrame({'B': [1., 2., 3.],
                        'C': ['a', 'b', 'c']},
                       index=np.arange(3))
        del df['B']
        df['B'] = [1., 2., 3.]
        assert 'B' in df
        assert len(df.columns) == 2

        df['A'] = 'beginning'
        df['E'] = 'foo'
        df['D'] = 'bar'
        df[datetime.now()] = 'date'
        df[datetime.now()] = 5.

        # what to do when empty frame with index
        dm = DataFrame(index=self.frame.index)
        dm['A'] = 'foo'
        dm['B'] = 'bar'
        assert len(dm.columns) == 2
        assert dm.values.dtype == np.object_

        # upcast
        dm['C'] = 1
        assert dm['C'].dtype == np.int64

        dm['E'] = 1.
        assert dm['E'].dtype == np.float64

        # set existing column
        dm['A'] = 'bar'
        assert 'bar' == dm['A'][0]

        dm = DataFrame(index=np.arange(3))
        dm['A'] = 1
        dm['foo'] = 'bar'
        del dm['foo']
        dm['foo'] = 'bar'
        assert dm['foo'].dtype == np.object_

        dm['coercable'] = ['1', '2', '3']
        assert dm['coercable'].dtype == np.object_

    def test_setitem_corner2(self):
        data = {"title": ['foobar', 'bar', 'foobar'] + ['foobar'] * 17,
                "cruft": np.random.random(20)}

        df = DataFrame(data)
        ix = df[df['title'] == 'bar'].index

        df.loc[ix, ['title']] = 'foobar'
        df.loc[ix, ['cruft']] = 0

        assert df.loc[1, 'title'] == 'foobar'
        assert df.loc[1, 'cruft'] == 0

    def test_setitem_ambig(self):
        # Difficulties with mixed-type data
        from decimal import Decimal

        # Created as float type
        dm = DataFrame(index=lrange(3), columns=lrange(3))

        coercable_series = Series([Decimal(1) for _ in range(3)],
                                  index=lrange(3))
        uncoercable_series = Series(['foo', 'bzr', 'baz'], index=lrange(3))

        dm[0] = np.ones(3)
        assert len(dm.columns) == 3

        dm[1] = coercable_series
        assert len(dm.columns) == 3

        dm[2] = uncoercable_series
        assert len(dm.columns) == 3
        assert dm[2].dtype == np.object_

    def test_setitem_clear_caches(self):
        # see gh-304
        df = DataFrame({'x': [1.1, 2.1, 3.1, 4.1], 'y': [5.1, 6.1, 7.1, 8.1]},
                       index=[0, 1, 2, 3])
        df.insert(2, 'z', np.nan)

        # cache it
        foo = df['z']
        df.loc[df.index[2:], 'z'] = 42

        expected = Series([np.nan, np.nan, 42, 42], index=df.index, name='z')

        assert df['z'] is not foo
        tm.assert_series_equal(df['z'], expected)

    def test_setitem_None(self):
        # GH #766
        self.frame[None] = self.frame['A']
        assert_series_equal(
            self.frame.iloc[:, -1], self.frame['A'], check_names=False)
        assert_series_equal(self.frame.loc[:, None], self.frame[
                            'A'], check_names=False)
        assert_series_equal(self.frame[None], self.frame[
                            'A'], check_names=False)
        repr(self.frame)

    def test_setitem_empty(self):
        # GH 9596
        df = pd.DataFrame({'a': ['1', '2', '3'],
                           'b': ['11', '22', '33'],
                           'c': ['111', '222', '333']})

        result = df.copy()
        result.loc[result.b.isnull(), 'a'] = result.a
        assert_frame_equal(result, df)

    def test_setitem_empty_frame_with_boolean(self):
        # Test for issue #10126

        for dtype in ('float', 'int64'):
            for df in [
                    pd.DataFrame(dtype=dtype),
                    pd.DataFrame(dtype=dtype, index=[1]),
                    pd.DataFrame(dtype=dtype, columns=['A']),
            ]:
                df2 = df.copy()
                df[df > df2] = 47
                assert_frame_equal(df, df2)

    def test_getitem_empty_frame_with_boolean(self):
        # Test for issue #11859

        df = pd.DataFrame()
        df2 = df[df > 0]
        assert_frame_equal(df, df2)

    def test_delitem_corner(self):
        f = self.frame.copy()
        del f['D']
        assert len(f.columns) == 3
        pytest.raises(KeyError, f.__delitem__, 'D')
        del f['B']
        assert len(f.columns) == 2

    def test_getitem_fancy_2d(self):
        f = self.frame

        with catch_warnings(record=True):
            assert_frame_equal(f.ix[:, ['B', 'A']],
                               f.reindex(columns=['B', 'A']))

        subidx = self.frame.index[[5, 4, 1]]
        with catch_warnings(record=True):
            assert_frame_equal(f.ix[subidx, ['B', 'A']],
                               f.reindex(index=subidx, columns=['B', 'A']))

        # slicing rows, etc.
        with catch_warnings(record=True):
            assert_frame_equal(f.ix[5:10], f[5:10])
            assert_frame_equal(f.ix[5:10, :], f[5:10])
            assert_frame_equal(f.ix[:5, ['A', 'B']],
                               f.reindex(index=f.index[:5],
                                         columns=['A', 'B']))

        # slice rows with labels, inclusive!
        with catch_warnings(record=True):
            expected = f.ix[5:11]
            result = f.ix[f.index[5]:f.index[10]]
        assert_frame_equal(expected, result)

        # slice columns
        with catch_warnings(record=True):
            assert_frame_equal(f.ix[:, :2], f.reindex(columns=['A', 'B']))

        # get view
        with catch_warnings(record=True):
            exp = f.copy()
            f.ix[5:10].values[:] = 5
            exp.values[5:10] = 5
            assert_frame_equal(f, exp)

        with catch_warnings(record=True):
            pytest.raises(ValueError, f.ix.__getitem__, f > 0.5)

    def test_slice_floats(self):
        index = [52195.504153, 52196.303147, 52198.369883]
        df = DataFrame(np.random.rand(3, 2), index=index)

        s1 = df.loc[52195.1:52196.5]
        assert len(s1) == 2

        s1 = df.loc[52195.1:52196.6]
        assert len(s1) == 2

        s1 = df.loc[52195.1:52198.9]
        assert len(s1) == 3

    def test_getitem_fancy_slice_integers_step(self):
        df = DataFrame(np.random.randn(10, 5))

        # this is OK
        result = df.iloc[:8:2]  # noqa
        df.iloc[:8:2] = np.nan
        assert isnull(df.iloc[:8:2]).values.all()

    def test_getitem_setitem_integer_slice_keyerrors(self):
        df = DataFrame(np.random.randn(10, 5), index=lrange(0, 20, 2))

        # this is OK
        cp = df.copy()
        cp.iloc[4:10] = 0
        assert (cp.iloc[4:10] == 0).values.all()

        # so is this
        cp = df.copy()
        cp.iloc[3:11] = 0
        assert (cp.iloc[3:11] == 0).values.all()

        result = df.iloc[2:6]
        result2 = df.loc[3:11]
        expected = df.reindex([4, 6, 8, 10])

        assert_frame_equal(result, expected)
        assert_frame_equal(result2, expected)

        # non-monotonic, raise KeyError
        df2 = df.iloc[lrange(5) + lrange(5, 10)[::-1]]
        pytest.raises(KeyError, df2.loc.__getitem__, slice(3, 11))
        pytest.raises(KeyError, df2.loc.__setitem__, slice(3, 11), 0)

    def test_setitem_fancy_2d(self):

        # case 1
        frame = self.frame.copy()
        expected = frame.copy()

        with catch_warnings(record=True):
            frame.ix[:, ['B', 'A']] = 1
        expected['B'] = 1.
        expected['A'] = 1.
        assert_frame_equal(frame, expected)

        # case 2
        frame = self.frame.copy()
        frame2 = self.frame.copy()

        expected = frame.copy()

        subidx = self.frame.index[[5, 4, 1]]
        values = randn(3, 2)

        with catch_warnings(record=True):
            frame.ix[subidx, ['B', 'A']] = values
            frame2.ix[[5, 4, 1], ['B', 'A']] = values

            expected['B'].ix[subidx] = values[:, 0]
            expected['A'].ix[subidx] = values[:, 1]

        assert_frame_equal(frame, expected)
        assert_frame_equal(frame2, expected)

        # case 3: slicing rows, etc.
        frame = self.frame.copy()

        with catch_warnings(record=True):
            expected1 = self.frame.copy()
            frame.ix[5:10] = 1.
            expected1.values[5:10] = 1.
        assert_frame_equal(frame, expected1)

        with catch_warnings(record=True):
            expected2 = self.frame.copy()
            arr = randn(5, len(frame.columns))
            frame.ix[5:10] = arr
            expected2.values[5:10] = arr
        assert_frame_equal(frame, expected2)

        # case 4
        with catch_warnings(record=True):
            frame = self.frame.copy()
            frame.ix[5:10, :] = 1.
            assert_frame_equal(frame, expected1)
            frame.ix[5:10, :] = arr
        assert_frame_equal(frame, expected2)

        # case 5
        with catch_warnings(record=True):
            frame = self.frame.copy()
            frame2 = self.frame.copy()

            expected = self.frame.copy()
            values = randn(5, 2)

            frame.ix[:5, ['A', 'B']] = values
            expected['A'][:5] = values[:, 0]
            expected['B'][:5] = values[:, 1]
        assert_frame_equal(frame, expected)

        with catch_warnings(record=True):
            frame2.ix[:5, [0, 1]] = values
        assert_frame_equal(frame2, expected)

        # case 6: slice rows with labels, inclusive!
        with catch_warnings(record=True):
            frame = self.frame.copy()
            expected = self.frame.copy()

            frame.ix[frame.index[5]:frame.index[10]] = 5.
            expected.values[5:11] = 5
        assert_frame_equal(frame, expected)

        # case 7: slice columns
        with catch_warnings(record=True):
            frame = self.frame.copy()
            frame2 = self.frame.copy()
            expected = self.frame.copy()

            # slice indices
            frame.ix[:, 1:3] = 4.
            expected.values[:, 1:3] = 4.
            assert_frame_equal(frame, expected)

            # slice with labels
            frame.ix[:, 'B':'C'] = 4.
            assert_frame_equal(frame, expected)

        # new corner case of boolean slicing / setting
        frame = DataFrame(lzip([2, 3, 9, 6, 7], [np.nan] * 5),
                          columns=['a', 'b'])
        lst = [100]
        lst.extend([np.nan] * 4)
        expected = DataFrame(lzip([100, 3, 9, 6, 7], lst),
                             columns=['a', 'b'])
        frame[frame['a'] == 2] = 100
        assert_frame_equal(frame, expected)

    def test_fancy_getitem_slice_mixed(self):
        sliced = self.mixed_frame.iloc[:, -3:]
        assert sliced['D'].dtype == np.float64

        # get view with single block
        # setting it triggers setting with copy
        sliced = self.frame.iloc[:, -3:]

        def f():
            sliced['C'] = 4.
        pytest.raises(com.SettingWithCopyError, f)
        assert (self.frame['C'] == 4).all()

    def test_fancy_setitem_int_labels(self):
        # integer index defers to label-based indexing

        df = DataFrame(np.random.randn(10, 5), index=np.arange(0, 20, 2))

        with catch_warnings(record=True):
            tmp = df.copy()
            exp = df.copy()
            tmp.ix[[0, 2, 4]] = 5
            exp.values[:3] = 5
        assert_frame_equal(tmp, exp)

        with catch_warnings(record=True):
            tmp = df.copy()
            exp = df.copy()
            tmp.ix[6] = 5
            exp.values[3] = 5
        assert_frame_equal(tmp, exp)

        with catch_warnings(record=True):
            tmp = df.copy()
            exp = df.copy()
            tmp.ix[:, 2] = 5

        # tmp correctly sets the dtype
        # so match the exp way
        exp[2] = 5
        assert_frame_equal(tmp, exp)

    def test_fancy_getitem_int_labels(self):
        df = DataFrame(np.random.randn(10, 5), index=np.arange(0, 20, 2))

        with catch_warnings(record=True):
            result = df.ix[[4, 2, 0], [2, 0]]
            expected = df.reindex(index=[4, 2, 0], columns=[2, 0])
        assert_frame_equal(result, expected)

        with catch_warnings(record=True):
            result = df.ix[[4, 2, 0]]
            expected = df.reindex(index=[4, 2, 0])
        assert_frame_equal(result, expected)

        with catch_warnings(record=True):
            result = df.ix[4]
            expected = df.xs(4)
        assert_series_equal(result, expected)

        with catch_warnings(record=True):
            result = df.ix[:, 3]
            expected = df[3]
        assert_series_equal(result, expected)

    def test_fancy_index_int_labels_exceptions(self):
        df = DataFrame(np.random.randn(10, 5), index=np.arange(0, 20, 2))

        with catch_warnings(record=True):

            # labels that aren't contained
            pytest.raises(KeyError, df.ix.__setitem__,
                          ([0, 1, 2], [2, 3, 4]), 5)

            # try to set indices not contained in frame
            pytest.raises(KeyError, self.frame.ix.__setitem__,
                          ['foo', 'bar', 'baz'], 1)
            pytest.raises(KeyError, self.frame.ix.__setitem__,
                          (slice(None, None), ['E']), 1)

            # partial setting now allows this GH2578
            # pytest.raises(KeyError, self.frame.ix.__setitem__,
            #               (slice(None, None), 'E'), 1)

    def test_setitem_fancy_mixed_2d(self):

        with catch_warnings(record=True):
            self.mixed_frame.ix[:5, ['C', 'B', 'A']] = 5
            result = self.mixed_frame.ix[:5, ['C', 'B', 'A']]
            assert (result.values == 5).all()

            self.mixed_frame.ix[5] = np.nan
            assert isnull(self.mixed_frame.ix[5]).all()

            self.mixed_frame.ix[5] = self.mixed_frame.ix[6]
            assert_series_equal(self.mixed_frame.ix[5], self.mixed_frame.ix[6],
                                check_names=False)

        # #1432
        with catch_warnings(record=True):
            df = DataFrame({1: [1., 2., 3.],
                            2: [3, 4, 5]})
            assert df._is_mixed_type

            df.ix[1] = [5, 10]

            expected = DataFrame({1: [1., 5., 3.],
                                  2: [3, 10, 5]})

            assert_frame_equal(df, expected)

    def test_ix_align(self):
        b = Series(randn(10), name=0).sort_values()
        df_orig = DataFrame(randn(10, 4))
        df = df_orig.copy()

        with catch_warnings(record=True):
            df.ix[:, 0] = b
            assert_series_equal(df.ix[:, 0].reindex(b.index), b)

        with catch_warnings(record=True):
            dft = df_orig.T
            dft.ix[0, :] = b
            assert_series_equal(dft.ix[0, :].reindex(b.index), b)

        with catch_warnings(record=True):
            df = df_orig.copy()
            df.ix[:5, 0] = b
            s = df.ix[:5, 0]
            assert_series_equal(s, b.reindex(s.index))

        with catch_warnings(record=True):
            dft = df_orig.T
            dft.ix[0, :5] = b
            s = dft.ix[0, :5]
            assert_series_equal(s, b.reindex(s.index))

        with catch_warnings(record=True):
            df = df_orig.copy()
            idx = [0, 1, 3, 5]
            df.ix[idx, 0] = b
            s = df.ix[idx, 0]
            assert_series_equal(s, b.reindex(s.index))

        with catch_warnings(record=True):
            dft = df_orig.T
            dft.ix[0, idx] = b
            s = dft.ix[0, idx]
            assert_series_equal(s, b.reindex(s.index))

    def test_ix_frame_align(self):
        b = DataFrame(np.random.randn(3, 4))
        df_orig = DataFrame(randn(10, 4))
        df = df_orig.copy()

        with catch_warnings(record=True):
            df.ix[:3] = b
            out = b.ix[:3]
            assert_frame_equal(out, b)

        b.sort_index(inplace=True)

        with catch_warnings(record=True):
            df = df_orig.copy()
            df.ix[[0, 1, 2]] = b
            out = df.ix[[0, 1, 2]].reindex(b.index)
            assert_frame_equal(out, b)

        with catch_warnings(record=True):
            df = df_orig.copy()
            df.ix[:3] = b
            out = df.ix[:3]
            assert_frame_equal(out, b.reindex(out.index))

    def test_getitem_setitem_non_ix_labels(self):
        df = tm.makeTimeDataFrame()

        start, end = df.index[[5, 10]]

        result = df.loc[start:end]
        result2 = df[start:end]
        expected = df[5:11]
        assert_frame_equal(result, expected)
        assert_frame_equal(result2, expected)

        result = df.copy()
        result.loc[start:end] = 0
        result2 = df.copy()
        result2[start:end] = 0
        expected = df.copy()
        expected[5:11] = 0
        assert_frame_equal(result, expected)
        assert_frame_equal(result2, expected)

    def test_ix_multi_take(self):
        df = DataFrame(np.random.randn(3, 2))
        rs = df.loc[df.index == 0, :]
        xp = df.reindex([0])
        assert_frame_equal(rs, xp)

        """ #1321
        df = DataFrame(np.random.randn(3, 2))
        rs = df.loc[df.index==0, df.columns==1]
        xp = df.reindex([0], [1])
        assert_frame_equal(rs, xp)
        """

    def test_ix_multi_take_nonint_index(self):
        df = DataFrame(np.random.randn(3, 2), index=['x', 'y', 'z'],
                       columns=['a', 'b'])
        with catch_warnings(record=True):
            rs = df.ix[[0], [0]]
        xp = df.reindex(['x'], columns=['a'])
        assert_frame_equal(rs, xp)

    def test_ix_multi_take_multiindex(self):
        df = DataFrame(np.random.randn(3, 2), index=['x', 'y', 'z'],
                       columns=[['a', 'b'], ['1', '2']])
        with catch_warnings(record=True):
            rs = df.ix[[0], [0]]
        xp = df.reindex(['x'], columns=[('a', '1')])
        assert_frame_equal(rs, xp)

    def test_ix_dup(self):
        idx = Index(['a', 'a', 'b', 'c', 'd', 'd'])
        df = DataFrame(np.random.randn(len(idx), 3), idx)

        with catch_warnings(record=True):
            sub = df.ix[:'d']
            assert_frame_equal(sub, df)

        with catch_warnings(record=True):
            sub = df.ix['a':'c']
            assert_frame_equal(sub, df.ix[0:4])

        with catch_warnings(record=True):
            sub = df.ix['b':'d']
            assert_frame_equal(sub, df.ix[2:])

    def test_getitem_fancy_1d(self):
        f = self.frame

        # return self if no slicing...for now
        with catch_warnings(record=True):
            assert f.ix[:, :] is f

        # low dimensional slice
        with catch_warnings(record=True):
            xs1 = f.ix[2, ['C', 'B', 'A']]
        xs2 = f.xs(f.index[2]).reindex(['C', 'B', 'A'])
        tm.assert_series_equal(xs1, xs2)

        with catch_warnings(record=True):
            ts1 = f.ix[5:10, 2]
        ts2 = f[f.columns[2]][5:10]
        tm.assert_series_equal(ts1, ts2)

        # positional xs
        with catch_warnings(record=True):
            xs1 = f.ix[0]
        xs2 = f.xs(f.index[0])
        tm.assert_series_equal(xs1, xs2)

        with catch_warnings(record=True):
            xs1 = f.ix[f.index[5]]
        xs2 = f.xs(f.index[5])
        tm.assert_series_equal(xs1, xs2)

        # single column
        with catch_warnings(record=True):
            assert_series_equal(f.ix[:, 'A'], f['A'])

        # return view
        with catch_warnings(record=True):
            exp = f.copy()
            exp.values[5] = 4
            f.ix[5][:] = 4
        tm.assert_frame_equal(exp, f)

        with catch_warnings(record=True):
            exp.values[:, 1] = 6
            f.ix[:, 1][:] = 6
        tm.assert_frame_equal(exp, f)

        # slice of mixed-frame
        with catch_warnings(record=True):
            xs = self.mixed_frame.ix[5]
        exp = self.mixed_frame.xs(self.mixed_frame.index[5])
        tm.assert_series_equal(xs, exp)

    def test_setitem_fancy_1d(self):

        # case 1: set cross-section for indices
        frame = self.frame.copy()
        expected = self.frame.copy()

        with catch_warnings(record=True):
            frame.ix[2, ['C', 'B', 'A']] = [1., 2., 3.]
        expected['C'][2] = 1.
        expected['B'][2] = 2.
        expected['A'][2] = 3.
        assert_frame_equal(frame, expected)

        with catch_warnings(record=True):
            frame2 = self.frame.copy()
            frame2.ix[2, [3, 2, 1]] = [1., 2., 3.]
        assert_frame_equal(frame, expected)

        # case 2, set a section of a column
        frame = self.frame.copy()
        expected = self.frame.copy()

        with catch_warnings(record=True):
            vals = randn(5)
            expected.values[5:10, 2] = vals
            frame.ix[5:10, 2] = vals
        assert_frame_equal(frame, expected)

        with catch_warnings(record=True):
            frame2 = self.frame.copy()
            frame2.ix[5:10, 'B'] = vals
        assert_frame_equal(frame, expected)

        # case 3: full xs
        frame = self.frame.copy()
        expected = self.frame.copy()

        with catch_warnings(record=True):
            frame.ix[4] = 5.
            expected.values[4] = 5.
        assert_frame_equal(frame, expected)

        with catch_warnings(record=True):
            frame.ix[frame.index[4]] = 6.
            expected.values[4] = 6.
        assert_frame_equal(frame, expected)

        # single column
        frame = self.frame.copy()
        expected = self.frame.copy()

        with catch_warnings(record=True):
            frame.ix[:, 'A'] = 7.
            expected['A'] = 7.
        assert_frame_equal(frame, expected)

    def test_getitem_fancy_scalar(self):
        f = self.frame
        ix = f.loc

        # individual value
        for col in f.columns:
            ts = f[col]
            for idx in f.index[::5]:
                assert ix[idx, col] == ts[idx]

    def test_setitem_fancy_scalar(self):
        f = self.frame
        expected = self.frame.copy()
        ix = f.loc

        # individual value
        for j, col in enumerate(f.columns):
            ts = f[col]  # noqa
            for idx in f.index[::5]:
                i = f.index.get_loc(idx)
                val = randn()
                expected.values[i, j] = val

                ix[idx, col] = val
                assert_frame_equal(f, expected)

    def test_getitem_fancy_boolean(self):
        f = self.frame
        ix = f.loc

        expected = f.reindex(columns=['B', 'D'])
        result = ix[:, [False, True, False, True]]
        assert_frame_equal(result, expected)

        expected = f.reindex(index=f.index[5:10], columns=['B', 'D'])
        result = ix[f.index[5:10], [False, True, False, True]]
        assert_frame_equal(result, expected)

        boolvec = f.index > f.index[7]
        expected = f.reindex(index=f.index[boolvec])
        result = ix[boolvec]
        assert_frame_equal(result, expected)
        result = ix[boolvec, :]
        assert_frame_equal(result, expected)

        result = ix[boolvec, f.columns[2:]]
        expected = f.reindex(index=f.index[boolvec],
                             columns=['C', 'D'])
        assert_frame_equal(result, expected)

    def test_setitem_fancy_boolean(self):
        # from 2d, set with booleans
        frame = self.frame.copy()
        expected = self.frame.copy()

        mask = frame['A'] > 0
        frame.loc[mask] = 0.
        expected.values[mask.values] = 0.
        assert_frame_equal(frame, expected)

        frame = self.frame.copy()
        expected = self.frame.copy()
        frame.loc[mask, ['A', 'B']] = 0.
        expected.values[mask.values, :2] = 0.
        assert_frame_equal(frame, expected)

    def test_getitem_fancy_ints(self):
        result = self.frame.iloc[[1, 4, 7]]
        expected = self.frame.loc[self.frame.index[[1, 4, 7]]]
        assert_frame_equal(result, expected)

        result = self.frame.iloc[:, [2, 0, 1]]
        expected = self.frame.loc[:, self.frame.columns[[2, 0, 1]]]
        assert_frame_equal(result, expected)

    def test_getitem_setitem_fancy_exceptions(self):
        ix = self.frame.iloc
        with tm.assert_raises_regex(IndexingError, 'Too many indexers'):
            ix[:, :, :]

        with pytest.raises(IndexingError):
            ix[:, :, :] = 1

    def test_getitem_setitem_boolean_misaligned(self):
        # boolean index misaligned labels
        mask = self.frame['A'][::-1] > 1

        result = self.frame.loc[mask]
        expected = self.frame.loc[mask[::-1]]
        assert_frame_equal(result, expected)

        cp = self.frame.copy()
        expected = self.frame.copy()
        cp.loc[mask] = 0
        expected.loc[mask] = 0
        assert_frame_equal(cp, expected)

    def test_getitem_setitem_boolean_multi(self):
        df = DataFrame(np.random.randn(3, 2))

        # get
        k1 = np.array([True, False, True])
        k2 = np.array([False, True])
        result = df.loc[k1, k2]
        expected = df.loc[[0, 2], [1]]
        assert_frame_equal(result, expected)

        expected = df.copy()
        df.loc[np.array([True, False, True]),
               np.array([False, True])] = 5
        expected.loc[[0, 2], [1]] = 5
        assert_frame_equal(df, expected)

    def test_getitem_setitem_float_labels(self):
        index = Index([1.5, 2, 3, 4, 5])
        df = DataFrame(np.random.randn(5, 5), index=index)

        result = df.loc[1.5:4]
        expected = df.reindex([1.5, 2, 3, 4])
        assert_frame_equal(result, expected)
        assert len(result) == 4

        result = df.loc[4:5]
        expected = df.reindex([4, 5])  # reindex with int
        assert_frame_equal(result, expected, check_index_type=False)
        assert len(result) == 2

        result = df.loc[4:5]
        expected = df.reindex([4.0, 5.0])  # reindex with float
        assert_frame_equal(result, expected)
        assert len(result) == 2

        # loc_float changes this to work properly
        result = df.loc[1:2]
        expected = df.iloc[0:2]
        assert_frame_equal(result, expected)

        df.loc[1:2] = 0
        result = df[1:2]
        assert (result == 0).all().all()

        # #2727
        index = Index([1.0, 2.5, 3.5, 4.5, 5.0])
        df = DataFrame(np.random.randn(5, 5), index=index)

        # positional slicing only via iloc!
        pytest.raises(TypeError, lambda: df.iloc[1.0:5])

        result = df.iloc[4:5]
        expected = df.reindex([5.0])
        assert_frame_equal(result, expected)
        assert len(result) == 1

        cp = df.copy()

        def f():
            cp.iloc[1.0:5] = 0
        pytest.raises(TypeError, f)

        def f():
            result = cp.iloc[1.0:5] == 0  # noqa

        pytest.raises(TypeError, f)
        assert result.values.all()
        assert (cp.iloc[0:1] == df.iloc[0:1]).values.all()

        cp = df.copy()
        cp.iloc[4:5] = 0
        assert (cp.iloc[4:5] == 0).values.all()
        assert (cp.iloc[0:4] == df.iloc[0:4]).values.all()

        # float slicing
        result = df.loc[1.0:5]
        expected = df
        assert_frame_equal(result, expected)
        assert len(result) == 5

        result = df.loc[1.1:5]
        expected = df.reindex([2.5, 3.5, 4.5, 5.0])
        assert_frame_equal(result, expected)
        assert len(result) == 4

        result = df.loc[4.51:5]
        expected = df.reindex([5.0])
        assert_frame_equal(result, expected)
        assert len(result) == 1

        result = df.loc[1.0:5.0]
        expected = df.reindex([1.0, 2.5, 3.5, 4.5, 5.0])
        assert_frame_equal(result, expected)
        assert len(result) == 5

        cp = df.copy()
        cp.loc[1.0:5.0] = 0
        result = cp.loc[1.0:5.0]
        assert (result == 0).values.all()

    def test_setitem_single_column_mixed(self):
        df = DataFrame(randn(5, 3), index=['a', 'b', 'c', 'd', 'e'],
                       columns=['foo', 'bar', 'baz'])
        df['str'] = 'qux'
        df.loc[df.index[::2], 'str'] = nan
        expected = np.array([nan, 'qux', nan, 'qux', nan], dtype=object)
        assert_almost_equal(df['str'].values, expected)

    def test_setitem_single_column_mixed_datetime(self):
        df = DataFrame(randn(5, 3), index=['a', 'b', 'c', 'd', 'e'],
                       columns=['foo', 'bar', 'baz'])

        df['timestamp'] = Timestamp('20010102')

        # check our dtypes
        result = df.get_dtype_counts()
        expected = Series({'float64': 3, 'datetime64[ns]': 1})
        assert_series_equal(result, expected)

        # set an allowable datetime64 type
        df.loc['b', 'timestamp'] = iNaT
        assert isnull(df.loc['b', 'timestamp'])

        # allow this syntax
        df.loc['c', 'timestamp'] = nan
        assert isnull(df.loc['c', 'timestamp'])

        # allow this syntax
        df.loc['d', :] = nan
        assert not isnull(df.loc['c', :]).all()

        # as of GH 3216 this will now work!
        # try to set with a list like item
        # pytest.raises(
        #    Exception, df.loc.__setitem__, ('d', 'timestamp'), [nan])

    def test_setitem_frame(self):
        piece = self.frame.loc[self.frame.index[:2], ['A', 'B']]
        self.frame.loc[self.frame.index[-2]:, ['A', 'B']] = piece.values
        result = self.frame.loc[self.frame.index[-2:], ['A', 'B']].values
        expected = piece.values
        assert_almost_equal(result, expected)

        # GH 3216

        # already aligned
        f = self.mixed_frame.copy()
        piece = DataFrame([[1., 2.], [3., 4.]],
                          index=f.index[0:2], columns=['A', 'B'])
        key = (slice(None, 2), ['A', 'B'])
        f.loc[key] = piece
        assert_almost_equal(f.loc[f.index[0:2], ['A', 'B']].values,
                            piece.values)

        # rows unaligned
        f = self.mixed_frame.copy()
        piece = DataFrame([[1., 2.], [3., 4.], [5., 6.], [7., 8.]],
                          index=list(f.index[0:2]) + ['foo', 'bar'],
                          columns=['A', 'B'])
        key = (slice(None, 2), ['A', 'B'])
        f.loc[key] = piece
        assert_almost_equal(f.loc[f.index[0:2:], ['A', 'B']].values,
                            piece.values[0:2])

        # key is unaligned with values
        f = self.mixed_frame.copy()
        piece = f.loc[f.index[:2], ['A']]
        piece.index = f.index[-2:]
        key = (slice(-2, None), ['A', 'B'])
        f.loc[key] = piece
        piece['B'] = np.nan
        assert_almost_equal(f.loc[f.index[-2:], ['A', 'B']].values,
                            piece.values)

        # ndarray
        f = self.mixed_frame.copy()
        piece = self.mixed_frame.loc[f.index[:2], ['A', 'B']]
        key = (slice(-2, None), ['A', 'B'])
        f.loc[key] = piece.values
        assert_almost_equal(f.loc[f.index[-2:], ['A', 'B']].values,
                            piece.values)

        # needs upcasting
        df = DataFrame([[1, 2, 'foo'], [3, 4, 'bar']], columns=['A', 'B', 'C'])
        df2 = df.copy()
        df2.loc[:, ['A', 'B']] = df.loc[:, ['A', 'B']] + 0.5
        expected = df.reindex(columns=['A', 'B'])
        expected += 0.5
        expected['C'] = df['C']
        assert_frame_equal(df2, expected)

    def test_setitem_frame_align(self):
        piece = self.frame.loc[self.frame.index[:2], ['A', 'B']]
        piece.index = self.frame.index[-2:]
        piece.columns = ['A', 'B']
        self.frame.loc[self.frame.index[-2:], ['A', 'B']] = piece
        result = self.frame.loc[self.frame.index[-2:], ['A', 'B']].values
        expected = piece.values
        assert_almost_equal(result, expected)

    def test_getitem_setitem_ix_duplicates(self):
        # #1201
        df = DataFrame(np.random.randn(5, 3),
                       index=['foo', 'foo', 'bar', 'baz', 'bar'])

        result = df.loc['foo']
        expected = df[:2]
        assert_frame_equal(result, expected)

        result = df.loc['bar']
        expected = df.iloc[[2, 4]]
        assert_frame_equal(result, expected)

        result = df.loc['baz']
        expected = df.iloc[3]
        assert_series_equal(result, expected)

    def test_getitem_ix_boolean_duplicates_multiple(self):
        # #1201
        df = DataFrame(np.random.randn(5, 3),
                       index=['foo', 'foo', 'bar', 'baz', 'bar'])

        result = df.loc[['bar']]
        exp = df.iloc[[2, 4]]
        assert_frame_equal(result, exp)

        result = df.loc[df[1] > 0]
        exp = df[df[1] > 0]
        assert_frame_equal(result, exp)

        result = df.loc[df[0] > 0]
        exp = df[df[0] > 0]
        assert_frame_equal(result, exp)

    def test_getitem_setitem_ix_bool_keyerror(self):
        # #2199
        df = DataFrame({'a': [1, 2, 3]})

        pytest.raises(KeyError, df.loc.__getitem__, False)
        pytest.raises(KeyError, df.loc.__getitem__, True)

        pytest.raises(KeyError, df.loc.__setitem__, False, 0)
        pytest.raises(KeyError, df.loc.__setitem__, True, 0)

    def test_getitem_list_duplicates(self):
        # #1943
        df = DataFrame(np.random.randn(4, 4), columns=list('AABC'))
        df.columns.name = 'foo'

        result = df[['B', 'C']]
        assert result.columns.name == 'foo'

        expected = df.iloc[:, 2:]
        assert_frame_equal(result, expected)

    def test_get_value(self):
        for idx in self.frame.index:
            for col in self.frame.columns:
                result = self.frame.get_value(idx, col)
                expected = self.frame[col][idx]
                assert result == expected

    def test_lookup(self):
        def alt(df, rows, cols, dtype):
            result = []
            for r, c in zip(rows, cols):
                result.append(df.get_value(r, c))
            return np.array(result, dtype=dtype)

        def testit(df):
            rows = list(df.index) * len(df.columns)
            cols = list(df.columns) * len(df.index)
            result = df.lookup(rows, cols)
            expected = alt(df, rows, cols, dtype=np.object_)
            tm.assert_almost_equal(result, expected, check_dtype=False)

        testit(self.mixed_frame)
        testit(self.frame)

        df = DataFrame({'label': ['a', 'b', 'a', 'c'],
                        'mask_a': [True, True, False, True],
                        'mask_b': [True, False, False, False],
                        'mask_c': [False, True, False, True]})
        df['mask'] = df.lookup(df.index, 'mask_' + df['label'])
        exp_mask = alt(df, df.index, 'mask_' + df['label'], dtype=np.bool_)
        tm.assert_series_equal(df['mask'], pd.Series(exp_mask, name='mask'))
        assert df['mask'].dtype == np.bool_

        with pytest.raises(KeyError):
            self.frame.lookup(['xyz'], ['A'])

        with pytest.raises(KeyError):
            self.frame.lookup([self.frame.index[0]], ['xyz'])

        with tm.assert_raises_regex(ValueError, 'same size'):
            self.frame.lookup(['a', 'b', 'c'], ['a'])

    def test_set_value(self):
        for idx in self.frame.index:
            for col in self.frame.columns:
                self.frame.set_value(idx, col, 1)
                assert self.frame[col][idx] == 1

    def test_set_value_resize(self):

        res = self.frame.set_value('foobar', 'B', 0)
        assert res is self.frame
        assert res.index[-1] == 'foobar'
        assert res.get_value('foobar', 'B') == 0

        self.frame.loc['foobar', 'qux'] = 0
        assert self.frame.get_value('foobar', 'qux') == 0

        res = self.frame.copy()
        res3 = res.set_value('foobar', 'baz', 'sam')
        assert res3['baz'].dtype == np.object_

        res = self.frame.copy()
        res3 = res.set_value('foobar', 'baz', True)
        assert res3['baz'].dtype == np.object_

        res = self.frame.copy()
        res3 = res.set_value('foobar', 'baz', 5)
        assert is_float_dtype(res3['baz'])
        assert isnull(res3['baz'].drop(['foobar'])).all()
        pytest.raises(ValueError, res3.set_value, 'foobar', 'baz', 'sam')

    def test_set_value_with_index_dtype_change(self):
        df_orig = DataFrame(randn(3, 3), index=lrange(3), columns=list('ABC'))

        # this is actually ambiguous as the 2 is interpreted as a positional
        # so column is not created
        df = df_orig.copy()
        df.set_value('C', 2, 1.0)
        assert list(df.index) == list(df_orig.index) + ['C']
        # assert list(df.columns) == list(df_orig.columns) + [2]

        df = df_orig.copy()
        df.loc['C', 2] = 1.0
        assert list(df.index) == list(df_orig.index) + ['C']
        # assert list(df.columns) == list(df_orig.columns) + [2]

        # create both new
        df = df_orig.copy()
        df.set_value('C', 'D', 1.0)
        assert list(df.index) == list(df_orig.index) + ['C']
        assert list(df.columns) == list(df_orig.columns) + ['D']

        df = df_orig.copy()
        df.loc['C', 'D'] = 1.0
        assert list(df.index) == list(df_orig.index) + ['C']
        assert list(df.columns) == list(df_orig.columns) + ['D']

    def test_get_set_value_no_partial_indexing(self):
        # partial w/ MultiIndex raise exception
        index = MultiIndex.from_tuples([(0, 1), (0, 2), (1, 1), (1, 2)])
        df = DataFrame(index=index, columns=lrange(4))
        pytest.raises(KeyError, df.get_value, 0, 1)
        # pytest.raises(KeyError, df.set_value, 0, 1, 0)

    def test_single_element_ix_dont_upcast(self):
        self.frame['E'] = 1
        assert issubclass(self.frame['E'].dtype.type, (int, np.integer))

        with catch_warnings(record=True):
            result = self.frame.ix[self.frame.index[5], 'E']
            assert is_integer(result)

        result = self.frame.loc[self.frame.index[5], 'E']
        assert is_integer(result)

        # GH 11617
        df = pd.DataFrame(dict(a=[1.23]))
        df["b"] = 666

        with catch_warnings(record=True):
            result = df.ix[0, "b"]
        assert is_integer(result)
        result = df.loc[0, "b"]
        assert is_integer(result)

        expected = Series([666], [0], name='b')
        with catch_warnings(record=True):
            result = df.ix[[0], "b"]
        assert_series_equal(result, expected)
        result = df.loc[[0], "b"]
        assert_series_equal(result, expected)

    def test_iloc_row(self):
        df = DataFrame(np.random.randn(10, 4), index=lrange(0, 20, 2))

        result = df.iloc[1]
        exp = df.loc[2]
        assert_series_equal(result, exp)

        result = df.iloc[2]
        exp = df.loc[4]
        assert_series_equal(result, exp)

        # slice
        result = df.iloc[slice(4, 8)]
        expected = df.loc[8:14]
        assert_frame_equal(result, expected)

        # verify slice is view
        # setting it makes it raise/warn
        def f():
            result[2] = 0.
        pytest.raises(com.SettingWithCopyError, f)
        exp_col = df[2].copy()
        exp_col[4:8] = 0.
        assert_series_equal(df[2], exp_col)

        # list of integers
        result = df.iloc[[1, 2, 4, 6]]
        expected = df.reindex(df.index[[1, 2, 4, 6]])
        assert_frame_equal(result, expected)

    def test_iloc_col(self):

        df = DataFrame(np.random.randn(4, 10), columns=lrange(0, 20, 2))

        result = df.iloc[:, 1]
        exp = df.loc[:, 2]
        assert_series_equal(result, exp)

        result = df.iloc[:, 2]
        exp = df.loc[:, 4]
        assert_series_equal(result, exp)

        # slice
        result = df.iloc[:, slice(4, 8)]
        expected = df.loc[:, 8:14]
        assert_frame_equal(result, expected)

        # verify slice is view
        # and that we are setting a copy
        def f():
            result[8] = 0.
        pytest.raises(com.SettingWithCopyError, f)
        assert (df[8] == 0).all()

        # list of integers
        result = df.iloc[:, [1, 2, 4, 6]]
        expected = df.reindex(columns=df.columns[[1, 2, 4, 6]])
        assert_frame_equal(result, expected)

    def test_iloc_duplicates(self):

        df = DataFrame(np.random.rand(3, 3), columns=list('ABC'),
                       index=list('aab'))

        result = df.iloc[0]
        with catch_warnings(record=True):
            result2 = df.ix[0]
        assert isinstance(result, Series)
        assert_almost_equal(result.values, df.values[0])
        assert_series_equal(result, result2)

        with catch_warnings(record=True):
            result = df.T.iloc[:, 0]
            result2 = df.T.ix[:, 0]
        assert isinstance(result, Series)
        assert_almost_equal(result.values, df.values[0])
        assert_series_equal(result, result2)

        # multiindex
        df = DataFrame(np.random.randn(3, 3),
                       columns=[['i', 'i', 'j'], ['A', 'A', 'B']],
                       index=[['i', 'i', 'j'], ['X', 'X', 'Y']])

        with catch_warnings(record=True):
            rs = df.iloc[0]
            xp = df.ix[0]
        assert_series_equal(rs, xp)

        with catch_warnings(record=True):
            rs = df.iloc[:, 0]
            xp = df.T.ix[0]
        assert_series_equal(rs, xp)

        with catch_warnings(record=True):
            rs = df.iloc[:, [0]]
            xp = df.ix[:, [0]]
        assert_frame_equal(rs, xp)

        # #2259
        df = DataFrame([[1, 2, 3], [4, 5, 6]], columns=[1, 1, 2])
        result = df.iloc[:, [0]]
        expected = df.take([0], axis=1)
        assert_frame_equal(result, expected)

    def test_iloc_sparse_propegate_fill_value(self):
        from pandas.core.sparse.api import SparseDataFrame
        df = SparseDataFrame({'A': [999, 1]}, default_fill_value=999)
        assert len(df['A'].sp_values) == len(df.iloc[:, 0].sp_values)

    def test_iat(self):

        for i, row in enumerate(self.frame.index):
            for j, col in enumerate(self.frame.columns):
                result = self.frame.iat[i, j]
                expected = self.frame.at[row, col]
                assert result == expected

    def test_nested_exception(self):
        # Ignore the strange way of triggering the problem
        # (which may get fixed), it's just a way to trigger
        # the issue or reraising an outer exception without
        # a named argument
        df = DataFrame({"a": [1, 2, 3], "b": [4, 5, 6],
                        "c": [7, 8, 9]}).set_index(["a", "b"])
        l = list(df.index)
        l[0] = ["a", "b"]
        df.index = l

        try:
            repr(df)
        except Exception as e:
            assert type(e) != UnboundLocalError

    def test_reindex_methods(self):
        df = pd.DataFrame({'x': list(range(5))})
        target = np.array([-0.1, 0.9, 1.1, 1.5])

        for method, expected_values in [('nearest', [0, 1, 1, 2]),
                                        ('pad', [np.nan, 0, 1, 1]),
                                        ('backfill', [0, 1, 2, 2])]:
            expected = pd.DataFrame({'x': expected_values}, index=target)
            actual = df.reindex(target, method=method)
            assert_frame_equal(expected, actual)

            actual = df.reindex_like(df, method=method, tolerance=0)
            assert_frame_equal(df, actual)

            actual = df.reindex(target, method=method, tolerance=1)
            assert_frame_equal(expected, actual)

            e2 = expected[::-1]
            actual = df.reindex(target[::-1], method=method)
            assert_frame_equal(e2, actual)

            new_order = [3, 0, 2, 1]
            e2 = expected.iloc[new_order]
            actual = df.reindex(target[new_order], method=method)
            assert_frame_equal(e2, actual)

            switched_method = ('pad' if method == 'backfill'
                               else 'backfill' if method == 'pad'
                               else method)
            actual = df[::-1].reindex(target, method=switched_method)
            assert_frame_equal(expected, actual)

        expected = pd.DataFrame({'x': [0, 1, 1, np.nan]}, index=target)
        actual = df.reindex(target, method='nearest', tolerance=0.2)
        assert_frame_equal(expected, actual)

    def test_reindex_frame_add_nat(self):
        rng = date_range('1/1/2000 00:00:00', periods=10, freq='10s')
        df = DataFrame({'A': np.random.randn(len(rng)), 'B': rng})

        result = df.reindex(lrange(15))
        assert np.issubdtype(result['B'].dtype, np.dtype('M8[ns]'))

        mask = com.isnull(result)['B']
        assert mask[-5:].all()
        assert not mask[:-5].any()

    def test_set_dataframe_column_ns_dtype(self):
        x = DataFrame([datetime.now(), datetime.now()])
        assert x[0].dtype == np.dtype('M8[ns]')

    def test_non_monotonic_reindex_methods(self):
        dr = pd.date_range('2013-08-01', periods=6, freq='B')
        data = np.random.randn(6, 1)
        df = pd.DataFrame(data, index=dr, columns=list('A'))
        df_rev = pd.DataFrame(data, index=dr[[3, 4, 5] + [0, 1, 2]],
                              columns=list('A'))
        # index is not monotonic increasing or decreasing
        pytest.raises(ValueError, df_rev.reindex, df.index, method='pad')
        pytest.raises(ValueError, df_rev.reindex, df.index, method='ffill')
        pytest.raises(ValueError, df_rev.reindex, df.index, method='bfill')
        pytest.raises(ValueError, df_rev.reindex, df.index, method='nearest')

    def test_reindex_level(self):
        from itertools import permutations
        icol = ['jim', 'joe', 'jolie']

        def verify_first_level(df, level, idx, check_index_type=True):
            f = lambda val: np.nonzero(df[level] == val)[0]
            i = np.concatenate(list(map(f, idx)))
            left = df.set_index(icol).reindex(idx, level=level)
            right = df.iloc[i].set_index(icol)
            assert_frame_equal(left, right, check_index_type=check_index_type)

        def verify(df, level, idx, indexer, check_index_type=True):
            left = df.set_index(icol).reindex(idx, level=level)
            right = df.iloc[indexer].set_index(icol)
            assert_frame_equal(left, right, check_index_type=check_index_type)

        df = pd.DataFrame({'jim': list('B' * 4 + 'A' * 2 + 'C' * 3),
                           'joe': list('abcdeabcd')[::-1],
                           'jolie': [10, 20, 30] * 3,
                           'joline': np.random.randint(0, 1000, 9)})

        target = [['C', 'B', 'A'], ['F', 'C', 'A', 'D'], ['A'],
                  ['A', 'B', 'C'], ['C', 'A', 'B'], ['C', 'B'], ['C', 'A'],
                  ['A', 'B'], ['B', 'A', 'C']]

        for idx in target:
            verify_first_level(df, 'jim', idx)

        # reindex by these causes different MultiIndex levels
        for idx in [['D', 'F'], ['A', 'C', 'B']]:
            verify_first_level(df, 'jim', idx, check_index_type=False)

        verify(df, 'joe', list('abcde'), [3, 2, 1, 0, 5, 4, 8, 7, 6])
        verify(df, 'joe', list('abcd'), [3, 2, 1, 0, 5, 8, 7, 6])
        verify(df, 'joe', list('abc'), [3, 2, 1, 8, 7, 6])
        verify(df, 'joe', list('eca'), [1, 3, 4, 6, 8])
        verify(df, 'joe', list('edc'), [0, 1, 4, 5, 6])
        verify(df, 'joe', list('eadbc'), [3, 0, 2, 1, 4, 5, 8, 7, 6])
        verify(df, 'joe', list('edwq'), [0, 4, 5])
        verify(df, 'joe', list('wq'), [], check_index_type=False)

        df = DataFrame({'jim': ['mid'] * 5 + ['btm'] * 8 + ['top'] * 7,
                        'joe': ['3rd'] * 2 + ['1st'] * 3 + ['2nd'] * 3 +
                        ['1st'] * 2 + ['3rd'] * 3 + ['1st'] * 2 +
                        ['3rd'] * 3 + ['2nd'] * 2,
                        # this needs to be jointly unique with jim and joe or
                        # reindexing will fail ~1.5% of the time, this works
                        # out to needing unique groups of same size as joe
                        'jolie': np.concatenate([
                            np.random.choice(1000, x, replace=False)
                            for x in [2, 3, 3, 2, 3, 2, 3, 2]]),
                        'joline': np.random.randn(20).round(3) * 10})

        for idx in permutations(df['jim'].unique()):
            for i in range(3):
                verify_first_level(df, 'jim', idx[:i + 1])

        i = [2, 3, 4, 0, 1, 8, 9, 5, 6, 7, 10,
             11, 12, 13, 14, 18, 19, 15, 16, 17]
        verify(df, 'joe', ['1st', '2nd', '3rd'], i)

        i = [0, 1, 2, 3, 4, 10, 11, 12, 5, 6,
             7, 8, 9, 15, 16, 17, 18, 19, 13, 14]
        verify(df, 'joe', ['3rd', '2nd', '1st'], i)

        i = [0, 1, 5, 6, 7, 10, 11, 12, 18, 19, 15, 16, 17]
        verify(df, 'joe', ['2nd', '3rd'], i)

        i = [0, 1, 2, 3, 4, 10, 11, 12, 8, 9, 15, 16, 17, 13, 14]
        verify(df, 'joe', ['3rd', '1st'], i)

    def test_getitem_ix_float_duplicates(self):
        df = pd.DataFrame(np.random.randn(3, 3),
                          index=[0.1, 0.2, 0.2], columns=list('abc'))
        expect = df.iloc[1:]
        assert_frame_equal(df.loc[0.2], expect)
        with catch_warnings(record=True):
            assert_frame_equal(df.ix[0.2], expect)

        expect = df.iloc[1:, 0]
        assert_series_equal(df.loc[0.2, 'a'], expect)

        df.index = [1, 0.2, 0.2]
        expect = df.iloc[1:]
        assert_frame_equal(df.loc[0.2], expect)
        with catch_warnings(record=True):
            assert_frame_equal(df.ix[0.2], expect)

        expect = df.iloc[1:, 0]
        assert_series_equal(df.loc[0.2, 'a'], expect)

        df = pd.DataFrame(np.random.randn(4, 3),
                          index=[1, 0.2, 0.2, 1], columns=list('abc'))
        expect = df.iloc[1:-1]
        assert_frame_equal(df.loc[0.2], expect)
        with catch_warnings(record=True):
            assert_frame_equal(df.ix[0.2], expect)

        expect = df.iloc[1:-1, 0]
        assert_series_equal(df.loc[0.2, 'a'], expect)

        df.index = [0.1, 0.2, 2, 0.2]
        expect = df.iloc[[1, -1]]
        assert_frame_equal(df.loc[0.2], expect)
        with catch_warnings(record=True):
            assert_frame_equal(df.ix[0.2], expect)

        expect = df.iloc[[1, -1], 0]
        assert_series_equal(df.loc[0.2, 'a'], expect)

    def test_setitem_with_sparse_value(self):
        # GH8131
        df = pd.DataFrame({'c_1': ['a', 'b', 'c'], 'n_1': [1., 2., 3.]})
        sp_series = pd.Series([0, 0, 1]).to_sparse(fill_value=0)
        df['new_column'] = sp_series
        assert_series_equal(df['new_column'], sp_series, check_names=False)

    def test_setitem_with_unaligned_sparse_value(self):
        df = pd.DataFrame({'c_1': ['a', 'b', 'c'], 'n_1': [1., 2., 3.]})
        sp_series = (pd.Series([0, 0, 1], index=[2, 1, 0])
                     .to_sparse(fill_value=0))
        df['new_column'] = sp_series
        exp = pd.Series([1, 0, 0], name='new_column')
        assert_series_equal(df['new_column'], exp)

    def test_setitem_with_unaligned_tz_aware_datetime_column(self):
        # GH 12981
        # Assignment of unaligned offset-aware datetime series.
        # Make sure timezone isn't lost
        column = pd.Series(pd.date_range('2015-01-01', periods=3, tz='utc'),
                           name='dates')
        df = pd.DataFrame({'dates': column})
        df['dates'] = column[[1, 0, 2]]
        assert_series_equal(df['dates'], column)

        df = pd.DataFrame({'dates': column})
        df.loc[[0, 1, 2], 'dates'] = column[[1, 0, 2]]
        assert_series_equal(df['dates'], column)

    def test_setitem_datetime_coercion(self):
        # gh-1048
        df = pd.DataFrame({'c': [pd.Timestamp('2010-10-01')] * 3})
        df.loc[0:1, 'c'] = np.datetime64('2008-08-08')
        assert pd.Timestamp('2008-08-08') == df.loc[0, 'c']
        assert pd.Timestamp('2008-08-08') == df.loc[1, 'c']
        df.loc[2, 'c'] = date(2005, 5, 5)
        assert pd.Timestamp('2005-05-05') == df.loc[2, 'c']

    def test_setitem_datetimelike_with_inference(self):
        # GH 7592
        # assignment of timedeltas with NaT

        one_hour = timedelta(hours=1)
        df = DataFrame(index=date_range('20130101', periods=4))
        df['A'] = np.array([1 * one_hour] * 4, dtype='m8[ns]')
        df.loc[:, 'B'] = np.array([2 * one_hour] * 4, dtype='m8[ns]')
        df.loc[:3, 'C'] = np.array([3 * one_hour] * 3, dtype='m8[ns]')
        df.loc[:, 'D'] = np.array([4 * one_hour] * 4, dtype='m8[ns]')
        df.loc[df.index[:3], 'E'] = np.array([5 * one_hour] * 3,
                                             dtype='m8[ns]')
        df['F'] = np.timedelta64('NaT')
        df.loc[df.index[:-1], 'F'] = np.array([6 * one_hour] * 3,
                                              dtype='m8[ns]')
        df.loc[df.index[-3]:, 'G'] = date_range('20130101', periods=3)
        df['H'] = np.datetime64('NaT')
        result = df.dtypes
        expected = Series([np.dtype('timedelta64[ns]')] * 6 +
                          [np.dtype('datetime64[ns]')] * 2,
                          index=list('ABCDEFGH'))
        assert_series_equal(result, expected)

    def test_at_time_between_time_datetimeindex(self):
        index = date_range("2012-01-01", "2012-01-05", freq='30min')
        df = DataFrame(randn(len(index), 5), index=index)
        akey = time(12, 0, 0)
        bkey = slice(time(13, 0, 0), time(14, 0, 0))
        ainds = [24, 72, 120, 168]
        binds = [26, 27, 28, 74, 75, 76, 122, 123, 124, 170, 171, 172]

        result = df.at_time(akey)
        expected = df.loc[akey]
        expected2 = df.iloc[ainds]
        assert_frame_equal(result, expected)
        assert_frame_equal(result, expected2)
        assert len(result) == 4

        result = df.between_time(bkey.start, bkey.stop)
        expected = df.loc[bkey]
        expected2 = df.iloc[binds]
        assert_frame_equal(result, expected)
        assert_frame_equal(result, expected2)
        assert len(result) == 12

        result = df.copy()
        result.loc[akey] = 0
        result = result.loc[akey]
        expected = df.loc[akey].copy()
        expected.loc[:] = 0
        assert_frame_equal(result, expected)

        result = df.copy()
        result.loc[akey] = 0
        result.loc[akey] = df.iloc[ainds]
        assert_frame_equal(result, df)

        result = df.copy()
        result.loc[bkey] = 0
        result = result.loc[bkey]
        expected = df.loc[bkey].copy()
        expected.loc[:] = 0
        assert_frame_equal(result, expected)

        result = df.copy()
        result.loc[bkey] = 0
        result.loc[bkey] = df.iloc[binds]
        assert_frame_equal(result, df)

    def test_xs(self):
        idx = self.frame.index[5]
        xs = self.frame.xs(idx)
        for item, value in compat.iteritems(xs):
            if np.isnan(value):
                assert np.isnan(self.frame[item][idx])
            else:
                assert value == self.frame[item][idx]

        # mixed-type xs
        test_data = {
            'A': {'1': 1, '2': 2},
            'B': {'1': '1', '2': '2', '3': '3'},
        }
        frame = DataFrame(test_data)
        xs = frame.xs('1')
        assert xs.dtype == np.object_
        assert xs['A'] == 1
        assert xs['B'] == '1'

        with pytest.raises(KeyError):
            self.tsframe.xs(self.tsframe.index[0] - BDay())

        # xs get column
        series = self.frame.xs('A', axis=1)
        expected = self.frame['A']
        assert_series_equal(series, expected)

        # view is returned if possible
        series = self.frame.xs('A', axis=1)
        series[:] = 5
        assert (expected == 5).all()

    def test_xs_corner(self):
        # pathological mixed-type reordering case
        df = DataFrame(index=[0])
        df['A'] = 1.
        df['B'] = 'foo'
        df['C'] = 2.
        df['D'] = 'bar'
        df['E'] = 3.

        xs = df.xs(0)
        exp = pd.Series([1., 'foo', 2., 'bar', 3.],
                        index=list('ABCDE'), name=0)
        tm.assert_series_equal(xs, exp)

        # no columns but Index(dtype=object)
        df = DataFrame(index=['a', 'b', 'c'])
        result = df.xs('a')
        expected = Series([], name='a', index=pd.Index([], dtype=object))
        assert_series_equal(result, expected)

    def test_xs_duplicates(self):
        df = DataFrame(randn(5, 2), index=['b', 'b', 'c', 'b', 'a'])

        cross = df.xs('c')
        exp = df.iloc[2]
        assert_series_equal(cross, exp)

    def test_xs_keep_level(self):
        df = (DataFrame({'day': {0: 'sat', 1: 'sun'},
                         'flavour': {0: 'strawberry', 1: 'strawberry'},
                         'sales': {0: 10, 1: 12},
                         'year': {0: 2008, 1: 2008}})
              .set_index(['year', 'flavour', 'day']))
        result = df.xs('sat', level='day', drop_level=False)
        expected = df[:1]
        assert_frame_equal(result, expected)

        result = df.xs([2008, 'sat'], level=['year', 'day'], drop_level=False)
        assert_frame_equal(result, expected)

    def test_xs_view(self):
        # in 0.14 this will return a view if possible a copy otherwise, but
        # this is numpy dependent

        dm = DataFrame(np.arange(20.).reshape(4, 5),
                       index=lrange(4), columns=lrange(5))

        dm.xs(2)[:] = 10
        assert (dm.xs(2) == 10).all()

    def test_index_namedtuple(self):
        from collections import namedtuple
        IndexType = namedtuple("IndexType", ["a", "b"])
        idx1 = IndexType("foo", "bar")
        idx2 = IndexType("baz", "bof")
        index = Index([idx1, idx2],
                      name="composite_index", tupleize_cols=False)
        df = DataFrame([(1, 2), (3, 4)], index=index, columns=["A", "B"])

        with catch_warnings(record=True):
            result = df.ix[IndexType("foo", "bar")]["A"]
        assert result == 1

        result = df.loc[IndexType("foo", "bar")]["A"]
        assert result == 1

    def test_boolean_indexing(self):
        idx = lrange(3)
        cols = ['A', 'B', 'C']
        df1 = DataFrame(index=idx, columns=cols,
                        data=np.array([[0.0, 0.5, 1.0],
                                       [1.5, 2.0, 2.5],
                                       [3.0, 3.5, 4.0]],
                                      dtype=float))
        df2 = DataFrame(index=idx, columns=cols,
                        data=np.ones((len(idx), len(cols))))

        expected = DataFrame(index=idx, columns=cols,
                             data=np.array([[0.0, 0.5, 1.0],
                                            [1.5, 2.0, -1],
                                            [-1, -1, -1]], dtype=float))

        df1[df1 > 2.0 * df2] = -1
        assert_frame_equal(df1, expected)
        with tm.assert_raises_regex(ValueError, 'Item wrong length'):
            df1[df1.index[:-1] > 2] = -1

    def test_boolean_indexing_mixed(self):
        df = DataFrame({
            long(0): {35: np.nan, 40: np.nan, 43: np.nan,
                      49: np.nan, 50: np.nan},
            long(1): {35: np.nan,
                      40: 0.32632316859446198,
                      43: np.nan,
                      49: 0.32632316859446198,
                      50: 0.39114724480578139},
            long(2): {35: np.nan, 40: np.nan, 43: 0.29012581014105987,
                      49: np.nan, 50: np.nan},
            long(3): {35: np.nan, 40: np.nan, 43: np.nan, 49: np.nan,
                      50: np.nan},
            long(4): {35: 0.34215328467153283, 40: np.nan, 43: np.nan,
                      49: np.nan, 50: np.nan},
            'y': {35: 0, 40: 0, 43: 0, 49: 0, 50: 1}})

        # mixed int/float ok
        df2 = df.copy()
        df2[df2 > 0.3] = 1
        expected = df.copy()
        expected.loc[40, 1] = 1
        expected.loc[49, 1] = 1
        expected.loc[50, 1] = 1
        expected.loc[35, 4] = 1
        assert_frame_equal(df2, expected)

        df['foo'] = 'test'
        with tm.assert_raises_regex(TypeError, 'boolean setting '
                                    'on mixed-type'):
            df[df > 0.3] = 1

    def test_where(self):
        default_frame = DataFrame(np.random.randn(5, 3),
                                  columns=['A', 'B', 'C'])

        def _safe_add(df):
            # only add to the numeric items
            def is_ok(s):
                return (issubclass(s.dtype.type, (np.integer, np.floating)) and
                        s.dtype != 'uint8')

            return DataFrame(dict([(c, s + 1) if is_ok(s) else (c, s)
                                   for c, s in compat.iteritems(df)]))

        def _check_get(df, cond, check_dtypes=True):
            other1 = _safe_add(df)
            rs = df.where(cond, other1)
            rs2 = df.where(cond.values, other1)
            for k, v in rs.iteritems():
                exp = Series(
                    np.where(cond[k], df[k], other1[k]), index=v.index)
                assert_series_equal(v, exp, check_names=False)
            assert_frame_equal(rs, rs2)

            # dtypes
            if check_dtypes:
                assert (rs.dtypes == df.dtypes).all()

        # check getting
        for df in [default_frame, self.mixed_frame,
                   self.mixed_float, self.mixed_int]:
            cond = df > 0
            _check_get(df, cond)

        # upcasting case (GH # 2794)
        df = DataFrame(dict([(c, Series([1] * 3, dtype=c))
                             for c in ['int64', 'int32',
                                       'float32', 'float64']]))
        df.iloc[1, :] = 0
        result = df.where(df >= 0).get_dtype_counts()

        # when we don't preserve boolean casts
        #
        # expected = Series({ 'float32' : 1, 'float64' : 3 })

        expected = Series({'float32': 1, 'float64': 1, 'int32': 1, 'int64': 1})
        assert_series_equal(result, expected)

        # aligning
        def _check_align(df, cond, other, check_dtypes=True):
            rs = df.where(cond, other)
            for i, k in enumerate(rs.columns):
                result = rs[k]
                d = df[k].values
                c = cond[k].reindex(df[k].index).fillna(False).values

                if is_scalar(other):
                    o = other
                else:
                    if isinstance(other, np.ndarray):
                        o = Series(other[:, i], index=result.index).values
                    else:
                        o = other[k].values

                new_values = d if c.all() else np.where(c, d, o)
                expected = Series(new_values, index=result.index, name=k)

                # since we can't always have the correct numpy dtype
                # as numpy doesn't know how to downcast, don't check
                assert_series_equal(result, expected, check_dtype=False)

            # dtypes
            # can't check dtype when other is an ndarray

            if check_dtypes and not isinstance(other, np.ndarray):
                assert (rs.dtypes == df.dtypes).all()

        for df in [self.mixed_frame, self.mixed_float, self.mixed_int]:

            # other is a frame
            cond = (df > 0)[1:]
            _check_align(df, cond, _safe_add(df))

            # check other is ndarray
            cond = df > 0
            _check_align(df, cond, (_safe_add(df).values))

            # integers are upcast, so don't check the dtypes
            cond = df > 0
            check_dtypes = all([not issubclass(s.type, np.integer)
                                for s in df.dtypes])
            _check_align(df, cond, np.nan, check_dtypes=check_dtypes)

        # invalid conditions
        df = default_frame
        err1 = (df + 1).values[0:2, :]
        pytest.raises(ValueError, df.where, cond, err1)

        err2 = cond.iloc[:2, :].values
        other1 = _safe_add(df)
        pytest.raises(ValueError, df.where, err2, other1)

        pytest.raises(ValueError, df.mask, True)
        pytest.raises(ValueError, df.mask, 0)

        # where inplace
        def _check_set(df, cond, check_dtypes=True):
            dfi = df.copy()
            econd = cond.reindex_like(df).fillna(True)
            expected = dfi.mask(~econd)

            dfi.where(cond, np.nan, inplace=True)
            assert_frame_equal(dfi, expected)

            # dtypes (and confirm upcasts)x
            if check_dtypes:
                for k, v in compat.iteritems(df.dtypes):
                    if issubclass(v.type, np.integer) and not cond[k].all():
                        v = np.dtype('float64')
                    assert dfi[k].dtype == v

        for df in [default_frame, self.mixed_frame, self.mixed_float,
                   self.mixed_int]:

            cond = df > 0
            _check_set(df, cond)

            cond = df >= 0
            _check_set(df, cond)

            # aligining
            cond = (df >= 0)[1:]
            _check_set(df, cond)

        # GH 10218
        # test DataFrame.where with Series slicing
        df = DataFrame({'a': range(3), 'b': range(4, 7)})
        result = df.where(df['a'] == 1)
        expected = df[df['a'] == 1].reindex(df.index)
        assert_frame_equal(result, expected)

    def test_where_array_like(self):
        # see gh-15414
        klasses = [list, tuple, np.array]

        df = DataFrame({'a': [1, 2, 3]})
        cond = [[False], [True], [True]]
        expected = DataFrame({'a': [np.nan, 2, 3]})

        for klass in klasses:
            result = df.where(klass(cond))
            assert_frame_equal(result, expected)

        df['b'] = 2
        expected['b'] = [2, np.nan, 2]
        cond = [[False, True], [True, False], [True, True]]

        for klass in klasses:
            result = df.where(klass(cond))
            assert_frame_equal(result, expected)

    def test_where_invalid_input(self):
        # see gh-15414: only boolean arrays accepted
        df = DataFrame({'a': [1, 2, 3]})
        msg = "Boolean array expected for the condition"

        conds = [
            [[1], [0], [1]],
            Series([[2], [5], [7]]),
            DataFrame({'a': [2, 5, 7]}),
            [["True"], ["False"], ["True"]],
            [[Timestamp("2017-01-01")],
             [pd.NaT], [Timestamp("2017-01-02")]]
        ]

        for cond in conds:
            with tm.assert_raises_regex(ValueError, msg):
                df.where(cond)

        df['b'] = 2
        conds = [
            [[0, 1], [1, 0], [1, 1]],
            Series([[0, 2], [5, 0], [4, 7]]),
            [["False", "True"], ["True", "False"],
             ["True", "True"]],
            DataFrame({'a': [2, 5, 7], 'b': [4, 8, 9]}),
            [[pd.NaT, Timestamp("2017-01-01")],
             [Timestamp("2017-01-02"), pd.NaT],
             [Timestamp("2017-01-03"), Timestamp("2017-01-03")]]
        ]

        for cond in conds:
            with tm.assert_raises_regex(ValueError, msg):
                df.where(cond)

    def test_where_dataframe_col_match(self):
        df = DataFrame([[1, 2, 3], [4, 5, 6]])
        cond = DataFrame([[True, False, True], [False, False, True]])

        out = df.where(cond)
        expected = DataFrame([[1.0, np.nan, 3], [np.nan, np.nan, 6]])
        tm.assert_frame_equal(out, expected)

        cond.columns = ["a", "b", "c"]  # Columns no longer match.
        msg = "Boolean array expected for the condition"
        with tm.assert_raises_regex(ValueError, msg):
            df.where(cond)

    def test_where_ndframe_align(self):
        msg = "Array conditional must be same shape as self"
        df = DataFrame([[1, 2, 3], [4, 5, 6]])

        cond = [True]
        with tm.assert_raises_regex(ValueError, msg):
            df.where(cond)

        expected = DataFrame([[1, 2, 3], [np.nan, np.nan, np.nan]])

        out = df.where(Series(cond))
        tm.assert_frame_equal(out, expected)

        cond = np.array([False, True, False, True])
        with tm.assert_raises_regex(ValueError, msg):
            df.where(cond)

        expected = DataFrame([[np.nan, np.nan, np.nan], [4, 5, 6]])

        out = df.where(Series(cond))
        tm.assert_frame_equal(out, expected)

    def test_where_bug(self):

        # GH 2793

        df = DataFrame({'a': [1.0, 2.0, 3.0, 4.0], 'b': [
                       4.0, 3.0, 2.0, 1.0]}, dtype='float64')
        expected = DataFrame({'a': [np.nan, np.nan, 3.0, 4.0], 'b': [
                             4.0, 3.0, np.nan, np.nan]}, dtype='float64')
        result = df.where(df > 2, np.nan)
        assert_frame_equal(result, expected)

        result = df.copy()
        result.where(result > 2, np.nan, inplace=True)
        assert_frame_equal(result, expected)

        # mixed
        for dtype in ['int16', 'int8', 'int32', 'int64']:
            df = DataFrame({'a': np.array([1, 2, 3, 4], dtype=dtype),
                            'b': np.array([4.0, 3.0, 2.0, 1.0],
                                          dtype='float64')})

            expected = DataFrame({'a': [np.nan, np.nan, 3.0, 4.0],
                                  'b': [4.0, 3.0, np.nan, np.nan]},
                                 dtype='float64')

            result = df.where(df > 2, np.nan)
            assert_frame_equal(result, expected)

            result = df.copy()
            result.where(result > 2, np.nan, inplace=True)
            assert_frame_equal(result, expected)

        # transpositional issue
        # GH7506
        a = DataFrame({0: [1, 2], 1: [3, 4], 2: [5, 6]})
        b = DataFrame({0: [np.nan, 8], 1: [9, np.nan], 2: [np.nan, np.nan]})
        do_not_replace = b.isnull() | (a > b)

        expected = a.copy()
        expected[~do_not_replace] = b

        result = a.where(do_not_replace, b)
        assert_frame_equal(result, expected)

        a = DataFrame({0: [4, 6], 1: [1, 0]})
        b = DataFrame({0: [np.nan, 3], 1: [3, np.nan]})
        do_not_replace = b.isnull() | (a > b)

        expected = a.copy()
        expected[~do_not_replace] = b

        result = a.where(do_not_replace, b)
        assert_frame_equal(result, expected)

    def test_where_datetime(self):

        # GH 3311
        df = DataFrame(dict(A=date_range('20130102', periods=5),
                            B=date_range('20130104', periods=5),
                            C=np.random.randn(5)))

        stamp = datetime(2013, 1, 3)
        result = df[df > stamp]
        expected = df.copy()
        expected.loc[[0, 1], 'A'] = np.nan
        assert_frame_equal(result, expected)

    def test_where_none(self):
        # GH 4667
        # setting with None changes dtype
        df = DataFrame({'series': Series(range(10))}).astype(float)
        df[df > 7] = None
        expected = DataFrame(
            {'series': Series([0, 1, 2, 3, 4, 5, 6, 7, np.nan, np.nan])})
        assert_frame_equal(df, expected)

        # GH 7656
        df = DataFrame([{'A': 1, 'B': np.nan, 'C': 'Test'}, {
                       'A': np.nan, 'B': 'Test', 'C': np.nan}])
        expected = df.where(~isnull(df), None)
        with tm.assert_raises_regex(TypeError, 'boolean setting '
                                    'on mixed-type'):
            df.where(~isnull(df), None, inplace=True)

    def test_where_align(self):

        def create():
            df = DataFrame(np.random.randn(10, 3))
            df.iloc[3:5, 0] = np.nan
            df.iloc[4:6, 1] = np.nan
            df.iloc[5:8, 2] = np.nan
            return df

        # series
        df = create()
        expected = df.fillna(df.mean())
        result = df.where(pd.notnull(df), df.mean(), axis='columns')
        assert_frame_equal(result, expected)

        df.where(pd.notnull(df), df.mean(), inplace=True, axis='columns')
        assert_frame_equal(df, expected)

        df = create().fillna(0)
        expected = df.apply(lambda x, y: x.where(x > 0, y), y=df[0])
        result = df.where(df > 0, df[0], axis='index')
        assert_frame_equal(result, expected)
        result = df.where(df > 0, df[0], axis='rows')
        assert_frame_equal(result, expected)

        # frame
        df = create()
        expected = df.fillna(1)
        result = df.where(pd.notnull(df), DataFrame(
            1, index=df.index, columns=df.columns))
        assert_frame_equal(result, expected)

    def test_where_complex(self):
        # GH 6345
        expected = DataFrame(
            [[1 + 1j, 2], [np.nan, 4 + 1j]], columns=['a', 'b'])
        df = DataFrame([[1 + 1j, 2], [5 + 1j, 4 + 1j]], columns=['a', 'b'])
        df[df.abs() >= 5] = np.nan
        assert_frame_equal(df, expected)

    def test_where_axis(self):
        # GH 9736
        df = DataFrame(np.random.randn(2, 2))
        mask = DataFrame([[False, False], [False, False]])
        s = Series([0, 1])

        expected = DataFrame([[0, 0], [1, 1]], dtype='float64')
        result = df.where(mask, s, axis='index')
        assert_frame_equal(result, expected)

        result = df.copy()
        result.where(mask, s, axis='index', inplace=True)
        assert_frame_equal(result, expected)

        expected = DataFrame([[0, 1], [0, 1]], dtype='float64')
        result = df.where(mask, s, axis='columns')
        assert_frame_equal(result, expected)

        result = df.copy()
        result.where(mask, s, axis='columns', inplace=True)
        assert_frame_equal(result, expected)

        # Upcast needed
        df = DataFrame([[1, 2], [3, 4]], dtype='int64')
        mask = DataFrame([[False, False], [False, False]])
        s = Series([0, np.nan])

        expected = DataFrame([[0, 0], [np.nan, np.nan]], dtype='float64')
        result = df.where(mask, s, axis='index')
        assert_frame_equal(result, expected)

        result = df.copy()
        result.where(mask, s, axis='index', inplace=True)
        assert_frame_equal(result, expected)

        expected = DataFrame([[0, np.nan], [0, np.nan]], dtype='float64')
        result = df.where(mask, s, axis='columns')
        assert_frame_equal(result, expected)

        expected = DataFrame({0: np.array([0, 0], dtype='int64'),
                              1: np.array([np.nan, np.nan], dtype='float64')})
        result = df.copy()
        result.where(mask, s, axis='columns', inplace=True)
        assert_frame_equal(result, expected)

        # Multiple dtypes (=> multiple Blocks)
        df = pd.concat([DataFrame(np.random.randn(10, 2)),
                        DataFrame(np.random.randint(0, 10, size=(10, 2)))],
                       ignore_index=True, axis=1)
        mask = DataFrame(False, columns=df.columns, index=df.index)
        s1 = Series(1, index=df.columns)
        s2 = Series(2, index=df.index)

        result = df.where(mask, s1, axis='columns')
        expected = DataFrame(1.0, columns=df.columns, index=df.index)
        expected[2] = expected[2].astype(int)
        expected[3] = expected[3].astype(int)
        assert_frame_equal(result, expected)

        result = df.copy()
        result.where(mask, s1, axis='columns', inplace=True)
        assert_frame_equal(result, expected)

        result = df.where(mask, s2, axis='index')
        expected = DataFrame(2.0, columns=df.columns, index=df.index)
        expected[2] = expected[2].astype(int)
        expected[3] = expected[3].astype(int)
        assert_frame_equal(result, expected)

        result = df.copy()
        result.where(mask, s2, axis='index', inplace=True)
        assert_frame_equal(result, expected)

        # DataFrame vs DataFrame
        d1 = df.copy().drop(1, axis=0)
        expected = df.copy()
        expected.loc[1, :] = np.nan

        result = df.where(mask, d1)
        assert_frame_equal(result, expected)
        result = df.where(mask, d1, axis='index')
        assert_frame_equal(result, expected)
        result = df.copy()
        result.where(mask, d1, inplace=True)
        assert_frame_equal(result, expected)
        result = df.copy()
        result.where(mask, d1, inplace=True, axis='index')
        assert_frame_equal(result, expected)

        d2 = df.copy().drop(1, axis=1)
        expected = df.copy()
        expected.loc[:, 1] = np.nan

        result = df.where(mask, d2)
        assert_frame_equal(result, expected)
        result = df.where(mask, d2, axis='columns')
        assert_frame_equal(result, expected)
        result = df.copy()
        result.where(mask, d2, inplace=True)
        assert_frame_equal(result, expected)
        result = df.copy()
        result.where(mask, d2, inplace=True, axis='columns')
        assert_frame_equal(result, expected)

    def test_where_callable(self):
        # GH 12533
        df = DataFrame([[1, 2, 3], [4, 5, 6], [7, 8, 9]])
        result = df.where(lambda x: x > 4, lambda x: x + 1)
        exp = DataFrame([[2, 3, 4], [5, 5, 6], [7, 8, 9]])
        tm.assert_frame_equal(result, exp)
        tm.assert_frame_equal(result, df.where(df > 4, df + 1))

        # return ndarray and scalar
        result = df.where(lambda x: (x % 2 == 0).values, lambda x: 99)
        exp = DataFrame([[99, 2, 99], [4, 99, 6], [99, 8, 99]])
        tm.assert_frame_equal(result, exp)
        tm.assert_frame_equal(result, df.where(df % 2 == 0, 99))

        # chain
        result = (df + 2).where(lambda x: x > 8, lambda x: x + 10)
        exp = DataFrame([[13, 14, 15], [16, 17, 18], [9, 10, 11]])
        tm.assert_frame_equal(result, exp)
        tm.assert_frame_equal(result,
                              (df + 2).where((df + 2) > 8, (df + 2) + 10))

    def test_mask(self):
        df = DataFrame(np.random.randn(5, 3))
        cond = df > 0

        rs = df.where(cond, np.nan)
        assert_frame_equal(rs, df.mask(df <= 0))
        assert_frame_equal(rs, df.mask(~cond))

        other = DataFrame(np.random.randn(5, 3))
        rs = df.where(cond, other)
        assert_frame_equal(rs, df.mask(df <= 0, other))
        assert_frame_equal(rs, df.mask(~cond, other))

    def test_mask_inplace(self):
        # GH8801
        df = DataFrame(np.random.randn(5, 3))
        cond = df > 0

        rdf = df.copy()

        rdf.where(cond, inplace=True)
        assert_frame_equal(rdf, df.where(cond))
        assert_frame_equal(rdf, df.mask(~cond))

        rdf = df.copy()
        rdf.where(cond, -df, inplace=True)
        assert_frame_equal(rdf, df.where(cond, -df))
        assert_frame_equal(rdf, df.mask(~cond, -df))

    def test_mask_edge_case_1xN_frame(self):
        # GH4071
        df = DataFrame([[1, 2]])
        res = df.mask(DataFrame([[True, False]]))
        expec = DataFrame([[nan, 2]])
        assert_frame_equal(res, expec)

    def test_mask_callable(self):
        # GH 12533
        df = DataFrame([[1, 2, 3], [4, 5, 6], [7, 8, 9]])
        result = df.mask(lambda x: x > 4, lambda x: x + 1)
        exp = DataFrame([[1, 2, 3], [4, 6, 7], [8, 9, 10]])
        tm.assert_frame_equal(result, exp)
        tm.assert_frame_equal(result, df.mask(df > 4, df + 1))

        # return ndarray and scalar
        result = df.mask(lambda x: (x % 2 == 0).values, lambda x: 99)
        exp = DataFrame([[1, 99, 3], [99, 5, 99], [7, 99, 9]])
        tm.assert_frame_equal(result, exp)
        tm.assert_frame_equal(result, df.mask(df % 2 == 0, 99))

        # chain
        result = (df + 2).mask(lambda x: x > 8, lambda x: x + 10)
        exp = DataFrame([[3, 4, 5], [6, 7, 8], [19, 20, 21]])
        tm.assert_frame_equal(result, exp)
        tm.assert_frame_equal(result,
                              (df + 2).mask((df + 2) > 8, (df + 2) + 10))

    def test_head_tail(self):
        assert_frame_equal(self.frame.head(), self.frame[:5])
        assert_frame_equal(self.frame.tail(), self.frame[-5:])

        assert_frame_equal(self.frame.head(0), self.frame[0:0])
        assert_frame_equal(self.frame.tail(0), self.frame[0:0])

        assert_frame_equal(self.frame.head(-1), self.frame[:-1])
        assert_frame_equal(self.frame.tail(-1), self.frame[1:])
        assert_frame_equal(self.frame.head(1), self.frame[:1])
        assert_frame_equal(self.frame.tail(1), self.frame[-1:])
        # with a float index
        df = self.frame.copy()
        df.index = np.arange(len(self.frame)) + 0.1
        assert_frame_equal(df.head(), df.iloc[:5])
        assert_frame_equal(df.tail(), df.iloc[-5:])
        assert_frame_equal(df.head(0), df[0:0])
        assert_frame_equal(df.tail(0), df[0:0])
        assert_frame_equal(df.head(-1), df.iloc[:-1])
        assert_frame_equal(df.tail(-1), df.iloc[1:])
        # test empty dataframe
        empty_df = DataFrame()
        assert_frame_equal(empty_df.tail(), empty_df)
        assert_frame_equal(empty_df.head(), empty_df)

    def test_type_error_multiindex(self):
        # See gh-12218
        df = DataFrame(columns=['i', 'c', 'x', 'y'],
                       data=[[0, 0, 1, 2], [1, 0, 3, 4],
                             [0, 1, 1, 2], [1, 1, 3, 4]])
        dg = df.pivot_table(index='i', columns='c',
                            values=['x', 'y'])

        with tm.assert_raises_regex(TypeError, "is an invalid key"):
            str(dg[:, 0])

        index = Index(range(2), name='i')
        columns = MultiIndex(levels=[['x', 'y'], [0, 1]],
                             labels=[[0, 1], [0, 0]],
                             names=[None, 'c'])
        expected = DataFrame([[1, 2], [3, 4]], columns=columns, index=index)

        result = dg.loc[:, (slice(None), 0)]
        assert_frame_equal(result, expected)

        name = ('x', 0)
        index = Index(range(2), name='i')
        expected = Series([1, 3], index=index, name=name)

        result = dg['x', 0]
        assert_series_equal(result, expected)


class TestDataFrameIndexingDatetimeWithTZ(TestData):

    def setup_method(self, method):
        self.idx = Index(date_range('20130101', periods=3, tz='US/Eastern'),
                         name='foo')
        self.dr = date_range('20130110', periods=3)
        self.df = DataFrame({'A': self.idx, 'B': self.dr})

    def test_setitem(self):

        df = self.df
        idx = self.idx

        # setitem
        df['C'] = idx
        assert_series_equal(df['C'], Series(idx, name='C'))

        df['D'] = 'foo'
        df['D'] = idx
        assert_series_equal(df['D'], Series(idx, name='D'))
        del df['D']

        # assert that A & C are not sharing the same base (e.g. they
        # are copies)
        b1 = df._data.blocks[1]
        b2 = df._data.blocks[2]
        assert b1.values.equals(b2.values)
        assert id(b1.values.values.base) != id(b2.values.values.base)

        # with nan
        df2 = df.copy()
        df2.iloc[1, 1] = pd.NaT
        df2.iloc[1, 2] = pd.NaT
        result = df2['B']
        assert_series_equal(notnull(result), Series(
            [True, False, True], name='B'))
        assert_series_equal(df2.dtypes, df.dtypes)

    def test_set_reset(self):

        idx = self.idx

        # set/reset
        df = DataFrame({'A': [0, 1, 2]}, index=idx)
        result = df.reset_index()
        assert result['foo'].dtype, 'M8[ns, US/Eastern'

        df = result.set_index('foo')
        tm.assert_index_equal(df.index, idx)

    def test_transpose(self):

        result = self.df.T
        expected = DataFrame(self.df.values.T)
        expected.index = ['A', 'B']
        assert_frame_equal(result, expected)


class TestDataFrameIndexingUInt64(TestData):

    def setup_method(self, method):
        self.ir = Index(np.arange(3), dtype=np.uint64)
        self.idx = Index([2**63, 2**63 + 5, 2**63 + 10], name='foo')

        self.df = DataFrame({'A': self.idx, 'B': self.ir})

    def test_setitem(self):

        df = self.df
        idx = self.idx

        # setitem
        df['C'] = idx
        assert_series_equal(df['C'], Series(idx, name='C'))

        df['D'] = 'foo'
        df['D'] = idx
        assert_series_equal(df['D'], Series(idx, name='D'))
        del df['D']

        # With NaN: because uint64 has no NaN element,
        # the column should be cast to object.
        df2 = df.copy()
        df2.iloc[1, 1] = pd.NaT
        df2.iloc[1, 2] = pd.NaT
        result = df2['B']
        assert_series_equal(notnull(result), Series(
            [True, False, True], name='B'))
        assert_series_equal(df2.dtypes, Series([np.dtype('uint64'),
                                                np.dtype('O'), np.dtype('O')],
                                               index=['A', 'B', 'C']))

    def test_set_reset(self):

        idx = self.idx

        # set/reset
        df = DataFrame({'A': [0, 1, 2]}, index=idx)
        result = df.reset_index()
        assert result['foo'].dtype == np.dtype('uint64')

        df = result.set_index('foo')
        tm.assert_index_equal(df.index, idx)

    def test_transpose(self):

        result = self.df.T
        expected = DataFrame(self.df.values.T)
        expected.index = ['A', 'B']
        assert_frame_equal(result, expected)
