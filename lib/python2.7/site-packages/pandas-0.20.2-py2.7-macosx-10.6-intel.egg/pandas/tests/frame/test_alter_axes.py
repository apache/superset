# -*- coding: utf-8 -*-

from __future__ import print_function

import pytest

from datetime import datetime, timedelta

import numpy as np

from pandas.compat import lrange
from pandas import (DataFrame, Series, Index, MultiIndex,
                    RangeIndex, date_range, IntervalIndex,
                    to_datetime)
from pandas.core.dtypes.common import (
    is_object_dtype,
    is_categorical_dtype,
    is_interval_dtype)
import pandas as pd

from pandas.util.testing import assert_series_equal, assert_frame_equal

import pandas.util.testing as tm

from pandas.tests.frame.common import TestData


class TestDataFrameAlterAxes(TestData):

    def test_set_index(self):
        idx = Index(np.arange(len(self.mixed_frame)))

        # cache it
        _ = self.mixed_frame['foo']  # noqa
        self.mixed_frame.index = idx
        assert self.mixed_frame['foo'].index is idx
        with tm.assert_raises_regex(ValueError, 'Length mismatch'):
            self.mixed_frame.index = idx[::2]

    def test_set_index_cast(self):

        # issue casting an index then set_index
        df = DataFrame({'A': [1.1, 2.2, 3.3], 'B': [5.0, 6.1, 7.2]},
                       index=[2010, 2011, 2012])
        expected = df.loc[2010]
        new_index = df.index.astype(np.int32)
        df.index = new_index
        result = df.loc[2010]
        assert_series_equal(result, expected)

    def test_set_index2(self):
        df = DataFrame({'A': ['foo', 'foo', 'foo', 'bar', 'bar'],
                        'B': ['one', 'two', 'three', 'one', 'two'],
                        'C': ['a', 'b', 'c', 'd', 'e'],
                        'D': np.random.randn(5),
                        'E': np.random.randn(5)})

        # new object, single-column
        result = df.set_index('C')
        result_nodrop = df.set_index('C', drop=False)

        index = Index(df['C'], name='C')

        expected = df.loc[:, ['A', 'B', 'D', 'E']]
        expected.index = index

        expected_nodrop = df.copy()
        expected_nodrop.index = index

        assert_frame_equal(result, expected)
        assert_frame_equal(result_nodrop, expected_nodrop)
        assert result.index.name == index.name

        # inplace, single
        df2 = df.copy()

        df2.set_index('C', inplace=True)

        assert_frame_equal(df2, expected)

        df3 = df.copy()
        df3.set_index('C', drop=False, inplace=True)

        assert_frame_equal(df3, expected_nodrop)

        # create new object, multi-column
        result = df.set_index(['A', 'B'])
        result_nodrop = df.set_index(['A', 'B'], drop=False)

        index = MultiIndex.from_arrays([df['A'], df['B']], names=['A', 'B'])

        expected = df.loc[:, ['C', 'D', 'E']]
        expected.index = index

        expected_nodrop = df.copy()
        expected_nodrop.index = index

        assert_frame_equal(result, expected)
        assert_frame_equal(result_nodrop, expected_nodrop)
        assert result.index.names == index.names

        # inplace
        df2 = df.copy()
        df2.set_index(['A', 'B'], inplace=True)
        assert_frame_equal(df2, expected)

        df3 = df.copy()
        df3.set_index(['A', 'B'], drop=False, inplace=True)
        assert_frame_equal(df3, expected_nodrop)

        # corner case
        with tm.assert_raises_regex(ValueError,
                                    'Index has duplicate keys'):
            df.set_index('A', verify_integrity=True)

        # append
        result = df.set_index(['A', 'B'], append=True)
        xp = df.reset_index().set_index(['index', 'A', 'B'])
        xp.index.names = [None, 'A', 'B']
        assert_frame_equal(result, xp)

        # append to existing multiindex
        rdf = df.set_index(['A'], append=True)
        rdf = rdf.set_index(['B', 'C'], append=True)
        expected = df.set_index(['A', 'B', 'C'], append=True)
        assert_frame_equal(rdf, expected)

        # Series
        result = df.set_index(df.C)
        assert result.index.name == 'C'

    def test_set_index_nonuniq(self):
        df = DataFrame({'A': ['foo', 'foo', 'foo', 'bar', 'bar'],
                        'B': ['one', 'two', 'three', 'one', 'two'],
                        'C': ['a', 'b', 'c', 'd', 'e'],
                        'D': np.random.randn(5),
                        'E': np.random.randn(5)})
        with tm.assert_raises_regex(ValueError,
                                    'Index has duplicate keys'):
            df.set_index('A', verify_integrity=True, inplace=True)
        assert 'A' in df

    def test_set_index_bug(self):
        # GH1590
        df = DataFrame({'val': [0, 1, 2], 'key': ['a', 'b', 'c']})
        df2 = df.select(lambda indx: indx >= 1)
        rs = df2.set_index('key')
        xp = DataFrame({'val': [1, 2]},
                       Index(['b', 'c'], name='key'))
        assert_frame_equal(rs, xp)

    def test_set_index_pass_arrays(self):
        df = DataFrame({'A': ['foo', 'bar', 'foo', 'bar',
                              'foo', 'bar', 'foo', 'foo'],
                        'B': ['one', 'one', 'two', 'three',
                              'two', 'two', 'one', 'three'],
                        'C': np.random.randn(8),
                        'D': np.random.randn(8)})

        # multiple columns
        result = df.set_index(['A', df['B'].values], drop=False)
        expected = df.set_index(['A', 'B'], drop=False)

        # TODO should set_index check_names ?
        assert_frame_equal(result, expected, check_names=False)

    def test_construction_with_categorical_index(self):

        ci = tm.makeCategoricalIndex(10)

        # with Categorical
        df = DataFrame({'A': np.random.randn(10),
                        'B': ci.values})
        idf = df.set_index('B')
        str(idf)
        tm.assert_index_equal(idf.index, ci, check_names=False)
        assert idf.index.name == 'B'

        # from a CategoricalIndex
        df = DataFrame({'A': np.random.randn(10),
                        'B': ci})
        idf = df.set_index('B')
        str(idf)
        tm.assert_index_equal(idf.index, ci, check_names=False)
        assert idf.index.name == 'B'

        idf = df.set_index('B').reset_index().set_index('B')
        str(idf)
        tm.assert_index_equal(idf.index, ci, check_names=False)
        assert idf.index.name == 'B'

        new_df = idf.reset_index()
        new_df.index = df.B
        tm.assert_index_equal(new_df.index, ci, check_names=False)
        assert idf.index.name == 'B'

    def test_set_index_cast_datetimeindex(self):
        df = DataFrame({'A': [datetime(2000, 1, 1) + timedelta(i)
                              for i in range(1000)],
                        'B': np.random.randn(1000)})

        idf = df.set_index('A')
        assert isinstance(idf.index, pd.DatetimeIndex)

        # don't cast a DatetimeIndex WITH a tz, leave as object
        # GH 6032
        i = (pd.DatetimeIndex(
            to_datetime(['2013-1-1 13:00',
                         '2013-1-2 14:00'], errors="raise"))
             .tz_localize('US/Pacific'))
        df = DataFrame(np.random.randn(2, 1), columns=['A'])

        expected = Series(np.array([pd.Timestamp('2013-01-01 13:00:00-0800',
                                                 tz='US/Pacific'),
                                    pd.Timestamp('2013-01-02 14:00:00-0800',
                                                 tz='US/Pacific')],
                                   dtype="object"))

        # convert index to series
        result = Series(i)
        assert_series_equal(result, expected)

        # assignt to frame
        df['B'] = i
        result = df['B']
        assert_series_equal(result, expected, check_names=False)
        assert result.name == 'B'

        # keep the timezone
        result = i.to_series(keep_tz=True)
        assert_series_equal(result.reset_index(drop=True), expected)

        # convert to utc
        df['C'] = i.to_series().reset_index(drop=True)
        result = df['C']
        comp = pd.DatetimeIndex(expected.values).copy()
        comp.tz = None
        tm.assert_numpy_array_equal(result.values, comp.values)

        # list of datetimes with a tz
        df['D'] = i.to_pydatetime()
        result = df['D']
        assert_series_equal(result, expected, check_names=False)
        assert result.name == 'D'

        # GH 6785
        # set the index manually
        import pytz
        df = DataFrame(
            [{'ts': datetime(2014, 4, 1, tzinfo=pytz.utc), 'foo': 1}])
        expected = df.set_index('ts')
        df.index = df['ts']
        df.pop('ts')
        assert_frame_equal(df, expected)

        # GH 3950
        # reset_index with single level
        for tz in ['UTC', 'Asia/Tokyo', 'US/Eastern']:
            idx = pd.date_range('1/1/2011', periods=5,
                                freq='D', tz=tz, name='idx')
            df = pd.DataFrame(
                {'a': range(5), 'b': ['A', 'B', 'C', 'D', 'E']}, index=idx)

            expected = pd.DataFrame({'idx': [datetime(2011, 1, 1),
                                             datetime(2011, 1, 2),
                                             datetime(2011, 1, 3),
                                             datetime(2011, 1, 4),
                                             datetime(2011, 1, 5)],
                                     'a': range(5),
                                     'b': ['A', 'B', 'C', 'D', 'E']},
                                    columns=['idx', 'a', 'b'])
            expected['idx'] = expected['idx'].apply(
                lambda d: pd.Timestamp(d, tz=tz))
            assert_frame_equal(df.reset_index(), expected)

    def test_set_index_timezone(self):
        # GH 12358
        # tz-aware Series should retain the tz
        i = pd.to_datetime(["2014-01-01 10:10:10"],
                           utc=True).tz_convert('Europe/Rome')
        df = DataFrame({'i': i})
        assert df.set_index(i).index[0].hour == 11
        assert pd.DatetimeIndex(pd.Series(df.i))[0].hour == 11
        assert df.set_index(df.i).index[0].hour == 11

    def test_set_index_dst(self):
        di = pd.date_range('2006-10-29 00:00:00', periods=3,
                           req='H', tz='US/Pacific')

        df = pd.DataFrame(data={'a': [0, 1, 2], 'b': [3, 4, 5]},
                          index=di).reset_index()
        # single level
        res = df.set_index('index')
        exp = pd.DataFrame(data={'a': [0, 1, 2], 'b': [3, 4, 5]},
                           index=pd.Index(di, name='index'))
        tm.assert_frame_equal(res, exp)

        # GH 12920
        res = df.set_index(['index', 'a'])
        exp_index = pd.MultiIndex.from_arrays([di, [0, 1, 2]],
                                              names=['index', 'a'])
        exp = pd.DataFrame({'b': [3, 4, 5]}, index=exp_index)
        tm.assert_frame_equal(res, exp)

    def test_reset_index_with_intervals(self):
        idx = pd.IntervalIndex.from_breaks(np.arange(11), name='x')
        original = pd.DataFrame({'x': idx, 'y': np.arange(10)})[['x', 'y']]

        result = original.set_index('x')
        expected = pd.DataFrame({'y': np.arange(10)}, index=idx)
        assert_frame_equal(result, expected)

        result2 = result.reset_index()
        assert_frame_equal(result2, original)

    def test_set_index_multiindexcolumns(self):
        columns = MultiIndex.from_tuples([('foo', 1), ('foo', 2), ('bar', 1)])
        df = DataFrame(np.random.randn(3, 3), columns=columns)
        rs = df.set_index(df.columns[0])
        xp = df.iloc[:, 1:]
        xp.index = df.iloc[:, 0].values
        xp.index.names = [df.columns[0]]
        assert_frame_equal(rs, xp)

    def test_set_index_empty_column(self):
        # #1971
        df = DataFrame([
            dict(a=1, p=0),
            dict(a=2, m=10),
            dict(a=3, m=11, p=20),
            dict(a=4, m=12, p=21)
        ], columns=('a', 'm', 'p', 'x'))

        # it works!
        result = df.set_index(['a', 'x'])
        repr(result)

    def test_set_columns(self):
        cols = Index(np.arange(len(self.mixed_frame.columns)))
        self.mixed_frame.columns = cols
        with tm.assert_raises_regex(ValueError, 'Length mismatch'):
            self.mixed_frame.columns = cols[::2]

    def test_dti_set_index_reindex(self):
        # GH 6631
        df = DataFrame(np.random.random(6))
        idx1 = date_range('2011/01/01', periods=6, freq='M', tz='US/Eastern')
        idx2 = date_range('2013', periods=6, freq='A', tz='Asia/Tokyo')

        df = df.set_index(idx1)
        tm.assert_index_equal(df.index, idx1)
        df = df.reindex(idx2)
        tm.assert_index_equal(df.index, idx2)

        # 11314
        # with tz
        index = date_range(datetime(2015, 10, 1),
                           datetime(2015, 10, 1, 23),
                           freq='H', tz='US/Eastern')
        df = DataFrame(np.random.randn(24, 1), columns=['a'], index=index)
        new_index = date_range(datetime(2015, 10, 2),
                               datetime(2015, 10, 2, 23),
                               freq='H', tz='US/Eastern')

        # TODO: unused?
        result = df.set_index(new_index)  # noqa

        assert new_index.freq == index.freq

    # Renaming

    def test_rename(self):
        mapping = {
            'A': 'a',
            'B': 'b',
            'C': 'c',
            'D': 'd'
        }

        renamed = self.frame.rename(columns=mapping)
        renamed2 = self.frame.rename(columns=str.lower)

        assert_frame_equal(renamed, renamed2)
        assert_frame_equal(renamed2.rename(columns=str.upper),
                           self.frame, check_names=False)

        # index
        data = {
            'A': {'foo': 0, 'bar': 1}
        }

        # gets sorted alphabetical
        df = DataFrame(data)
        renamed = df.rename(index={'foo': 'bar', 'bar': 'foo'})
        tm.assert_index_equal(renamed.index, pd.Index(['foo', 'bar']))

        renamed = df.rename(index=str.upper)
        tm.assert_index_equal(renamed.index, pd.Index(['BAR', 'FOO']))

        # have to pass something
        pytest.raises(TypeError, self.frame.rename)

        # partial columns
        renamed = self.frame.rename(columns={'C': 'foo', 'D': 'bar'})
        tm.assert_index_equal(renamed.columns,
                              pd.Index(['A', 'B', 'foo', 'bar']))

        # other axis
        renamed = self.frame.T.rename(index={'C': 'foo', 'D': 'bar'})
        tm.assert_index_equal(renamed.index,
                              pd.Index(['A', 'B', 'foo', 'bar']))

        # index with name
        index = Index(['foo', 'bar'], name='name')
        renamer = DataFrame(data, index=index)
        renamed = renamer.rename(index={'foo': 'bar', 'bar': 'foo'})
        tm.assert_index_equal(renamed.index,
                              pd.Index(['bar', 'foo'], name='name'))
        assert renamed.index.name == renamer.index.name

    def test_rename_multiindex(self):

        tuples_index = [('foo1', 'bar1'), ('foo2', 'bar2')]
        tuples_columns = [('fizz1', 'buzz1'), ('fizz2', 'buzz2')]
        index = MultiIndex.from_tuples(tuples_index, names=['foo', 'bar'])
        columns = MultiIndex.from_tuples(
            tuples_columns, names=['fizz', 'buzz'])
        df = DataFrame([(0, 0), (1, 1)], index=index, columns=columns)

        #
        # without specifying level -> accross all levels

        renamed = df.rename(index={'foo1': 'foo3', 'bar2': 'bar3'},
                            columns={'fizz1': 'fizz3', 'buzz2': 'buzz3'})
        new_index = MultiIndex.from_tuples([('foo3', 'bar1'),
                                            ('foo2', 'bar3')],
                                           names=['foo', 'bar'])
        new_columns = MultiIndex.from_tuples([('fizz3', 'buzz1'),
                                              ('fizz2', 'buzz3')],
                                             names=['fizz', 'buzz'])
        tm.assert_index_equal(renamed.index, new_index)
        tm.assert_index_equal(renamed.columns, new_columns)
        assert renamed.index.names == df.index.names
        assert renamed.columns.names == df.columns.names

        #
        # with specifying a level (GH13766)

        # dict
        new_columns = MultiIndex.from_tuples([('fizz3', 'buzz1'),
                                              ('fizz2', 'buzz2')],
                                             names=['fizz', 'buzz'])
        renamed = df.rename(columns={'fizz1': 'fizz3', 'buzz2': 'buzz3'},
                            level=0)
        tm.assert_index_equal(renamed.columns, new_columns)
        renamed = df.rename(columns={'fizz1': 'fizz3', 'buzz2': 'buzz3'},
                            level='fizz')
        tm.assert_index_equal(renamed.columns, new_columns)

        new_columns = MultiIndex.from_tuples([('fizz1', 'buzz1'),
                                              ('fizz2', 'buzz3')],
                                             names=['fizz', 'buzz'])
        renamed = df.rename(columns={'fizz1': 'fizz3', 'buzz2': 'buzz3'},
                            level=1)
        tm.assert_index_equal(renamed.columns, new_columns)
        renamed = df.rename(columns={'fizz1': 'fizz3', 'buzz2': 'buzz3'},
                            level='buzz')
        tm.assert_index_equal(renamed.columns, new_columns)

        # function
        func = str.upper
        new_columns = MultiIndex.from_tuples([('FIZZ1', 'buzz1'),
                                              ('FIZZ2', 'buzz2')],
                                             names=['fizz', 'buzz'])
        renamed = df.rename(columns=func, level=0)
        tm.assert_index_equal(renamed.columns, new_columns)
        renamed = df.rename(columns=func, level='fizz')
        tm.assert_index_equal(renamed.columns, new_columns)

        new_columns = MultiIndex.from_tuples([('fizz1', 'BUZZ1'),
                                              ('fizz2', 'BUZZ2')],
                                             names=['fizz', 'buzz'])
        renamed = df.rename(columns=func, level=1)
        tm.assert_index_equal(renamed.columns, new_columns)
        renamed = df.rename(columns=func, level='buzz')
        tm.assert_index_equal(renamed.columns, new_columns)

        # index
        new_index = MultiIndex.from_tuples([('foo3', 'bar1'),
                                            ('foo2', 'bar2')],
                                           names=['foo', 'bar'])
        renamed = df.rename(index={'foo1': 'foo3', 'bar2': 'bar3'},
                            level=0)
        tm.assert_index_equal(renamed.index, new_index)

    def test_rename_nocopy(self):
        renamed = self.frame.rename(columns={'C': 'foo'}, copy=False)
        renamed['foo'] = 1.
        assert (self.frame['C'] == 1.).all()

    def test_rename_inplace(self):
        self.frame.rename(columns={'C': 'foo'})
        assert 'C' in self.frame
        assert 'foo' not in self.frame

        c_id = id(self.frame['C'])
        frame = self.frame.copy()
        frame.rename(columns={'C': 'foo'}, inplace=True)

        assert 'C' not in frame
        assert 'foo' in frame
        assert id(frame['foo']) != c_id

    def test_rename_bug(self):
        # GH 5344
        # rename set ref_locs, and set_index was not resetting
        df = DataFrame({0: ['foo', 'bar'], 1: ['bah', 'bas'], 2: [1, 2]})
        df = df.rename(columns={0: 'a'})
        df = df.rename(columns={1: 'b'})
        df = df.set_index(['a', 'b'])
        df.columns = ['2001-01-01']
        expected = DataFrame([[1], [2]],
                             index=MultiIndex.from_tuples(
                                 [('foo', 'bah'), ('bar', 'bas')],
                                 names=['a', 'b']),
                             columns=['2001-01-01'])
        assert_frame_equal(df, expected)

    def test_reorder_levels(self):
        index = MultiIndex(levels=[['bar'], ['one', 'two', 'three'], [0, 1]],
                           labels=[[0, 0, 0, 0, 0, 0],
                                   [0, 1, 2, 0, 1, 2],
                                   [0, 1, 0, 1, 0, 1]],
                           names=['L0', 'L1', 'L2'])
        df = DataFrame({'A': np.arange(6), 'B': np.arange(6)}, index=index)

        # no change, position
        result = df.reorder_levels([0, 1, 2])
        assert_frame_equal(df, result)

        # no change, labels
        result = df.reorder_levels(['L0', 'L1', 'L2'])
        assert_frame_equal(df, result)

        # rotate, position
        result = df.reorder_levels([1, 2, 0])
        e_idx = MultiIndex(levels=[['one', 'two', 'three'], [0, 1], ['bar']],
                           labels=[[0, 1, 2, 0, 1, 2],
                                   [0, 1, 0, 1, 0, 1],
                                   [0, 0, 0, 0, 0, 0]],
                           names=['L1', 'L2', 'L0'])
        expected = DataFrame({'A': np.arange(6), 'B': np.arange(6)},
                             index=e_idx)
        assert_frame_equal(result, expected)

        result = df.reorder_levels([0, 0, 0])
        e_idx = MultiIndex(levels=[['bar'], ['bar'], ['bar']],
                           labels=[[0, 0, 0, 0, 0, 0],
                                   [0, 0, 0, 0, 0, 0],
                                   [0, 0, 0, 0, 0, 0]],
                           names=['L0', 'L0', 'L0'])
        expected = DataFrame({'A': np.arange(6), 'B': np.arange(6)},
                             index=e_idx)
        assert_frame_equal(result, expected)

        result = df.reorder_levels(['L0', 'L0', 'L0'])
        assert_frame_equal(result, expected)

    def test_reset_index(self):
        stacked = self.frame.stack()[::2]
        stacked = DataFrame({'foo': stacked, 'bar': stacked})

        names = ['first', 'second']
        stacked.index.names = names
        deleveled = stacked.reset_index()
        for i, (lev, lab) in enumerate(zip(stacked.index.levels,
                                           stacked.index.labels)):
            values = lev.take(lab)
            name = names[i]
            tm.assert_index_equal(values, Index(deleveled[name]))

        stacked.index.names = [None, None]
        deleveled2 = stacked.reset_index()
        tm.assert_series_equal(deleveled['first'], deleveled2['level_0'],
                               check_names=False)
        tm.assert_series_equal(deleveled['second'], deleveled2['level_1'],
                               check_names=False)

        # default name assigned
        rdf = self.frame.reset_index()
        exp = pd.Series(self.frame.index.values, name='index')
        tm.assert_series_equal(rdf['index'], exp)

        # default name assigned, corner case
        df = self.frame.copy()
        df['index'] = 'foo'
        rdf = df.reset_index()
        exp = pd.Series(self.frame.index.values, name='level_0')
        tm.assert_series_equal(rdf['level_0'], exp)

        # but this is ok
        self.frame.index.name = 'index'
        deleveled = self.frame.reset_index()
        tm.assert_series_equal(deleveled['index'],
                               pd.Series(self.frame.index))
        tm.assert_index_equal(deleveled.index,
                              pd.Index(np.arange(len(deleveled))))

        # preserve column names
        self.frame.columns.name = 'columns'
        resetted = self.frame.reset_index()
        assert resetted.columns.name == 'columns'

        # only remove certain columns
        frame = self.frame.reset_index().set_index(['index', 'A', 'B'])
        rs = frame.reset_index(['A', 'B'])

        # TODO should reset_index check_names ?
        assert_frame_equal(rs, self.frame, check_names=False)

        rs = frame.reset_index(['index', 'A', 'B'])
        assert_frame_equal(rs, self.frame.reset_index(), check_names=False)

        rs = frame.reset_index(['index', 'A', 'B'])
        assert_frame_equal(rs, self.frame.reset_index(), check_names=False)

        rs = frame.reset_index('A')
        xp = self.frame.reset_index().set_index(['index', 'B'])
        assert_frame_equal(rs, xp, check_names=False)

        # test resetting in place
        df = self.frame.copy()
        resetted = self.frame.reset_index()
        df.reset_index(inplace=True)
        assert_frame_equal(df, resetted, check_names=False)

        frame = self.frame.reset_index().set_index(['index', 'A', 'B'])
        rs = frame.reset_index('A', drop=True)
        xp = self.frame.copy()
        del xp['A']
        xp = xp.set_index(['B'], append=True)
        assert_frame_equal(rs, xp, check_names=False)

    def test_reset_index_level(self):
        df = pd.DataFrame([[1, 2, 3, 4], [5, 6, 7, 8]],
                          columns=['A', 'B', 'C', 'D'])

        for levels in ['A', 'B'], [0, 1]:
            # With MultiIndex
            result = df.set_index(['A', 'B']).reset_index(level=levels[0])
            tm.assert_frame_equal(result, df.set_index('B'))

            result = df.set_index(['A', 'B']).reset_index(level=levels[:1])
            tm.assert_frame_equal(result, df.set_index('B'))

            result = df.set_index(['A', 'B']).reset_index(level=levels)
            tm.assert_frame_equal(result, df)

            result = df.set_index(['A', 'B']).reset_index(level=levels,
                                                          drop=True)
            tm.assert_frame_equal(result, df[['C', 'D']])

            # With single-level Index (GH 16263)
            result = df.set_index('A').reset_index(level=levels[0])
            tm.assert_frame_equal(result, df)

            result = df.set_index('A').reset_index(level=levels[:1])
            tm.assert_frame_equal(result, df)

            result = df.set_index(['A']).reset_index(level=levels[0],
                                                     drop=True)
            tm.assert_frame_equal(result, df[['B', 'C', 'D']])

        # Missing levels - for both MultiIndex and single-level Index:
        for idx_lev in ['A', 'B'], ['A']:
            with tm.assert_raises_regex(KeyError, 'Level E '):
                df.set_index(idx_lev).reset_index(level=['A', 'E'])
            with tm.assert_raises_regex(IndexError, 'Too many levels'):
                df.set_index(idx_lev).reset_index(level=[0, 1, 2])

    def test_reset_index_right_dtype(self):
        time = np.arange(0.0, 10, np.sqrt(2) / 2)
        s1 = Series((9.81 * time ** 2) / 2,
                    index=Index(time, name='time'),
                    name='speed')
        df = DataFrame(s1)

        resetted = s1.reset_index()
        assert resetted['time'].dtype == np.float64

        resetted = df.reset_index()
        assert resetted['time'].dtype == np.float64

    def test_reset_index_multiindex_col(self):
        vals = np.random.randn(3, 3).astype(object)
        idx = ['x', 'y', 'z']
        full = np.hstack(([[x] for x in idx], vals))
        df = DataFrame(vals, Index(idx, name='a'),
                       columns=[['b', 'b', 'c'], ['mean', 'median', 'mean']])
        rs = df.reset_index()
        xp = DataFrame(full, columns=[['a', 'b', 'b', 'c'],
                                      ['', 'mean', 'median', 'mean']])
        assert_frame_equal(rs, xp)

        rs = df.reset_index(col_fill=None)
        xp = DataFrame(full, columns=[['a', 'b', 'b', 'c'],
                                      ['a', 'mean', 'median', 'mean']])
        assert_frame_equal(rs, xp)

        rs = df.reset_index(col_level=1, col_fill='blah')
        xp = DataFrame(full, columns=[['blah', 'b', 'b', 'c'],
                                      ['a', 'mean', 'median', 'mean']])
        assert_frame_equal(rs, xp)

        df = DataFrame(vals,
                       MultiIndex.from_arrays([[0, 1, 2], ['x', 'y', 'z']],
                                              names=['d', 'a']),
                       columns=[['b', 'b', 'c'], ['mean', 'median', 'mean']])
        rs = df.reset_index('a', )
        xp = DataFrame(full, Index([0, 1, 2], name='d'),
                       columns=[['a', 'b', 'b', 'c'],
                                ['', 'mean', 'median', 'mean']])
        assert_frame_equal(rs, xp)

        rs = df.reset_index('a', col_fill=None)
        xp = DataFrame(full, Index(lrange(3), name='d'),
                       columns=[['a', 'b', 'b', 'c'],
                                ['a', 'mean', 'median', 'mean']])
        assert_frame_equal(rs, xp)

        rs = df.reset_index('a', col_fill='blah', col_level=1)
        xp = DataFrame(full, Index(lrange(3), name='d'),
                       columns=[['blah', 'b', 'b', 'c'],
                                ['a', 'mean', 'median', 'mean']])
        assert_frame_equal(rs, xp)

    def test_reset_index_multiindex_nan(self):
        # GH6322, testing reset_index on MultiIndexes
        # when we have a nan or all nan
        df = pd.DataFrame({'A': ['a', 'b', 'c'],
                           'B': [0, 1, np.nan],
                           'C': np.random.rand(3)})
        rs = df.set_index(['A', 'B']).reset_index()
        assert_frame_equal(rs, df)

        df = pd.DataFrame({'A': [np.nan, 'b', 'c'],
                           'B': [0, 1, 2],
                           'C': np.random.rand(3)})
        rs = df.set_index(['A', 'B']).reset_index()
        assert_frame_equal(rs, df)

        df = pd.DataFrame({'A': ['a', 'b', 'c'],
                           'B': [0, 1, 2],
                           'C': [np.nan, 1.1, 2.2]})
        rs = df.set_index(['A', 'B']).reset_index()
        assert_frame_equal(rs, df)

        df = pd.DataFrame({'A': ['a', 'b', 'c'],
                           'B': [np.nan, np.nan, np.nan],
                           'C': np.random.rand(3)})
        rs = df.set_index(['A', 'B']).reset_index()
        assert_frame_equal(rs, df)

    def test_reset_index_with_datetimeindex_cols(self):
        # GH5818
        #
        df = pd.DataFrame([[1, 2], [3, 4]],
                          columns=pd.date_range('1/1/2013', '1/2/2013'),
                          index=['A', 'B'])

        result = df.reset_index()
        expected = pd.DataFrame([['A', 1, 2], ['B', 3, 4]],
                                columns=['index', datetime(2013, 1, 1),
                                         datetime(2013, 1, 2)])
        assert_frame_equal(result, expected)

    def test_reset_index_range(self):
        # GH 12071
        df = pd.DataFrame([[0, 0], [1, 1]], columns=['A', 'B'],
                          index=RangeIndex(stop=2))
        result = df.reset_index()
        assert isinstance(result.index, RangeIndex)
        expected = pd.DataFrame([[0, 0, 0], [1, 1, 1]],
                                columns=['index', 'A', 'B'],
                                index=RangeIndex(stop=2))
        assert_frame_equal(result, expected)

    def test_set_index_names(self):
        df = pd.util.testing.makeDataFrame()
        df.index.name = 'name'

        assert df.set_index(df.index).index.names == ['name']

        mi = MultiIndex.from_arrays(df[['A', 'B']].T.values, names=['A', 'B'])
        mi2 = MultiIndex.from_arrays(df[['A', 'B', 'A', 'B']].T.values,
                                     names=['A', 'B', 'A', 'B'])

        df = df.set_index(['A', 'B'])

        assert df.set_index(df.index).index.names == ['A', 'B']

        # Check that set_index isn't converting a MultiIndex into an Index
        assert isinstance(df.set_index(df.index).index, MultiIndex)

        # Check actual equality
        tm.assert_index_equal(df.set_index(df.index).index, mi)

        # Check that [MultiIndex, MultiIndex] yields a MultiIndex rather
        # than a pair of tuples
        assert isinstance(df.set_index(
            [df.index, df.index]).index, MultiIndex)

        # Check equality
        tm.assert_index_equal(df.set_index([df.index, df.index]).index, mi2)

    def test_rename_objects(self):
        renamed = self.mixed_frame.rename(columns=str.upper)

        assert 'FOO' in renamed
        assert 'foo' not in renamed

    def test_assign_columns(self):
        self.frame['hi'] = 'there'

        frame = self.frame.copy()
        frame.columns = ['foo', 'bar', 'baz', 'quux', 'foo2']
        assert_series_equal(self.frame['C'], frame['baz'], check_names=False)
        assert_series_equal(self.frame['hi'], frame['foo2'], check_names=False)

    def test_set_index_preserve_categorical_dtype(self):
        # GH13743, GH13854
        df = DataFrame({'A': [1, 2, 1, 1, 2],
                        'B': [10, 16, 22, 28, 34],
                        'C1': pd.Categorical(list("abaab"),
                                             categories=list("bac"),
                                             ordered=False),
                        'C2': pd.Categorical(list("abaab"),
                                             categories=list("bac"),
                                             ordered=True)})
        for cols in ['C1', 'C2', ['A', 'C1'], ['A', 'C2'], ['C1', 'C2']]:
            result = df.set_index(cols).reset_index()
            result = result.reindex(columns=df.columns)
            tm.assert_frame_equal(result, df)


class TestIntervalIndex(object):

    def test_setitem(self):

        df = DataFrame({'A': range(10)})
        s = pd.cut(df.A, 5)
        assert isinstance(s.cat.categories, IntervalIndex)

        # B & D end up as Categoricals
        # the remainer are converted to in-line objects
        # contining an IntervalIndex.values
        df['B'] = s
        df['C'] = np.array(s)
        df['D'] = s.values
        df['E'] = np.array(s.values)

        assert is_categorical_dtype(df['B'])
        assert is_interval_dtype(df['B'].cat.categories)
        assert is_categorical_dtype(df['D'])
        assert is_interval_dtype(df['D'].cat.categories)

        assert is_object_dtype(df['C'])
        assert is_object_dtype(df['E'])

        # they compare equal as Index
        # when converted to numpy objects
        c = lambda x: Index(np.array(x))
        tm.assert_index_equal(c(df.B), c(df.B), check_names=False)
        tm.assert_index_equal(c(df.B), c(df.C), check_names=False)
        tm.assert_index_equal(c(df.B), c(df.D), check_names=False)
        tm.assert_index_equal(c(df.B), c(df.D), check_names=False)

        # B & D are the same Series
        tm.assert_series_equal(df['B'], df['B'], check_names=False)
        tm.assert_series_equal(df['B'], df['D'], check_names=False)

        # C & E are the same Series
        tm.assert_series_equal(df['C'], df['C'], check_names=False)
        tm.assert_series_equal(df['C'], df['E'], check_names=False)

    def test_set_reset_index(self):

        df = DataFrame({'A': range(10)})
        s = pd.cut(df.A, 5)
        df['B'] = s
        df = df.set_index('B')

        df = df.reset_index()
