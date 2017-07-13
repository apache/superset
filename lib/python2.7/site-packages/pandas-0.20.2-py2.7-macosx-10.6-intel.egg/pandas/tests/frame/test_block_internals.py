# -*- coding: utf-8 -*-

from __future__ import print_function

import pytest

from datetime import datetime, timedelta
import itertools

from numpy import nan
import numpy as np

from pandas import (DataFrame, Series, Timestamp, date_range, compat,
                    option_context)
from pandas.compat import StringIO
import pandas as pd

from pandas.util.testing import (assert_almost_equal,
                                 assert_series_equal,
                                 assert_frame_equal)

import pandas.util.testing as tm

from pandas.tests.frame.common import TestData


# Segregated collection of methods that require the BlockManager internal data
# structure


class TestDataFrameBlockInternals(TestData):

    def test_cast_internals(self):
        casted = DataFrame(self.frame._data, dtype=int)
        expected = DataFrame(self.frame._series, dtype=int)
        assert_frame_equal(casted, expected)

        casted = DataFrame(self.frame._data, dtype=np.int32)
        expected = DataFrame(self.frame._series, dtype=np.int32)
        assert_frame_equal(casted, expected)

    def test_consolidate(self):
        self.frame['E'] = 7.
        consolidated = self.frame._consolidate()
        assert len(consolidated._data.blocks) == 1

        # Ensure copy, do I want this?
        recons = consolidated._consolidate()
        assert recons is not consolidated
        tm.assert_frame_equal(recons, consolidated)

        self.frame['F'] = 8.
        assert len(self.frame._data.blocks) == 3

        self.frame._consolidate(inplace=True)
        assert len(self.frame._data.blocks) == 1

    def test_consolidate_deprecation(self):
        self.frame['E'] = 7
        with tm.assert_produces_warning(FutureWarning):
            self.frame.consolidate()

    def test_consolidate_inplace(self):
        frame = self.frame.copy()  # noqa

        # triggers in-place consolidation
        for letter in range(ord('A'), ord('Z')):
            self.frame[chr(letter)] = chr(letter)

    def test_as_matrix_consolidate(self):
        self.frame['E'] = 7.
        assert not self.frame._data.is_consolidated()
        _ = self.frame.as_matrix()  # noqa
        assert self.frame._data.is_consolidated()

    def test_modify_values(self):
        self.frame.values[5] = 5
        assert (self.frame.values[5] == 5).all()

        # unconsolidated
        self.frame['E'] = 7.
        self.frame.values[6] = 6
        assert (self.frame.values[6] == 6).all()

    def test_boolean_set_uncons(self):
        self.frame['E'] = 7.

        expected = self.frame.values.copy()
        expected[expected > 1] = 2

        self.frame[self.frame > 1] = 2
        assert_almost_equal(expected, self.frame.values)

    def test_as_matrix_numeric_cols(self):
        self.frame['foo'] = 'bar'

        values = self.frame.as_matrix(['A', 'B', 'C', 'D'])
        assert values.dtype == np.float64

    def test_as_matrix_lcd(self):

        # mixed lcd
        values = self.mixed_float.as_matrix(['A', 'B', 'C', 'D'])
        assert values.dtype == np.float64

        values = self.mixed_float.as_matrix(['A', 'B', 'C'])
        assert values.dtype == np.float32

        values = self.mixed_float.as_matrix(['C'])
        assert values.dtype == np.float16

        # GH 10364
        # B uint64 forces float because there are other signed int types
        values = self.mixed_int.as_matrix(['A', 'B', 'C', 'D'])
        assert values.dtype == np.float64

        values = self.mixed_int.as_matrix(['A', 'D'])
        assert values.dtype == np.int64

        # B uint64 forces float because there are other signed int types
        values = self.mixed_int.as_matrix(['A', 'B', 'C'])
        assert values.dtype == np.float64

        # as B and C are both unsigned, no forcing to float is needed
        values = self.mixed_int.as_matrix(['B', 'C'])
        assert values.dtype == np.uint64

        values = self.mixed_int.as_matrix(['A', 'C'])
        assert values.dtype == np.int32

        values = self.mixed_int.as_matrix(['C', 'D'])
        assert values.dtype == np.int64

        values = self.mixed_int.as_matrix(['A'])
        assert values.dtype == np.int32

        values = self.mixed_int.as_matrix(['C'])
        assert values.dtype == np.uint8

    def test_constructor_with_convert(self):
        # this is actually mostly a test of lib.maybe_convert_objects
        # #2845
        df = DataFrame({'A': [2 ** 63 - 1]})
        result = df['A']
        expected = Series(np.asarray([2 ** 63 - 1], np.int64), name='A')
        assert_series_equal(result, expected)

        df = DataFrame({'A': [2 ** 63]})
        result = df['A']
        expected = Series(np.asarray([2 ** 63], np.uint64), name='A')
        assert_series_equal(result, expected)

        df = DataFrame({'A': [datetime(2005, 1, 1), True]})
        result = df['A']
        expected = Series(np.asarray([datetime(2005, 1, 1), True], np.object_),
                          name='A')
        assert_series_equal(result, expected)

        df = DataFrame({'A': [None, 1]})
        result = df['A']
        expected = Series(np.asarray([np.nan, 1], np.float_), name='A')
        assert_series_equal(result, expected)

        df = DataFrame({'A': [1.0, 2]})
        result = df['A']
        expected = Series(np.asarray([1.0, 2], np.float_), name='A')
        assert_series_equal(result, expected)

        df = DataFrame({'A': [1.0 + 2.0j, 3]})
        result = df['A']
        expected = Series(np.asarray([1.0 + 2.0j, 3], np.complex_), name='A')
        assert_series_equal(result, expected)

        df = DataFrame({'A': [1.0 + 2.0j, 3.0]})
        result = df['A']
        expected = Series(np.asarray([1.0 + 2.0j, 3.0], np.complex_), name='A')
        assert_series_equal(result, expected)

        df = DataFrame({'A': [1.0 + 2.0j, True]})
        result = df['A']
        expected = Series(np.asarray([1.0 + 2.0j, True], np.object_), name='A')
        assert_series_equal(result, expected)

        df = DataFrame({'A': [1.0, None]})
        result = df['A']
        expected = Series(np.asarray([1.0, np.nan], np.float_), name='A')
        assert_series_equal(result, expected)

        df = DataFrame({'A': [1.0 + 2.0j, None]})
        result = df['A']
        expected = Series(np.asarray(
            [1.0 + 2.0j, np.nan], np.complex_), name='A')
        assert_series_equal(result, expected)

        df = DataFrame({'A': [2.0, 1, True, None]})
        result = df['A']
        expected = Series(np.asarray(
            [2.0, 1, True, None], np.object_), name='A')
        assert_series_equal(result, expected)

        df = DataFrame({'A': [2.0, 1, datetime(2006, 1, 1), None]})
        result = df['A']
        expected = Series(np.asarray([2.0, 1, datetime(2006, 1, 1),
                                      None], np.object_), name='A')
        assert_series_equal(result, expected)

    def test_construction_with_mixed(self):
        # test construction edge cases with mixed types

        # f7u12, this does not work without extensive workaround
        data = [[datetime(2001, 1, 5), nan, datetime(2001, 1, 2)],
                [datetime(2000, 1, 2), datetime(2000, 1, 3),
                 datetime(2000, 1, 1)]]
        df = DataFrame(data)

        # check dtypes
        result = df.get_dtype_counts().sort_values()
        expected = Series({'datetime64[ns]': 3})

        # mixed-type frames
        self.mixed_frame['datetime'] = datetime.now()
        self.mixed_frame['timedelta'] = timedelta(days=1, seconds=1)
        assert self.mixed_frame['datetime'].dtype == 'M8[ns]'
        assert self.mixed_frame['timedelta'].dtype == 'm8[ns]'
        result = self.mixed_frame.get_dtype_counts().sort_values()
        expected = Series({'float64': 4,
                           'object': 1,
                           'datetime64[ns]': 1,
                           'timedelta64[ns]': 1}).sort_values()
        assert_series_equal(result, expected)

    def test_construction_with_conversions(self):

        # convert from a numpy array of non-ns timedelta64
        arr = np.array([1, 2, 3], dtype='timedelta64[s]')
        s = Series(arr)
        expected = Series(pd.timedelta_range('00:00:01', periods=3, freq='s'))
        assert_series_equal(s, expected)

        df = DataFrame(index=range(3))
        df['A'] = arr
        expected = DataFrame({'A': pd.timedelta_range('00:00:01', periods=3,
                                                      freq='s')},
                             index=range(3))
        assert_frame_equal(df, expected)

        # convert from a numpy array of non-ns datetime64
        # note that creating a numpy datetime64 is in LOCAL time!!!!
        # seems to work for M8[D], but not for M8[s]

        s = Series(np.array(['2013-01-01', '2013-01-02',
                             '2013-01-03'], dtype='datetime64[D]'))
        assert_series_equal(s, Series(date_range('20130101', periods=3,
                                                 freq='D')))

        # s = Series(np.array(['2013-01-01 00:00:01','2013-01-01
        # 00:00:02','2013-01-01 00:00:03'],dtype='datetime64[s]'))

        # assert_series_equal(s,date_range('20130101
        # 00:00:01',period=3,freq='s'))

        expected = DataFrame({
            'dt1': Timestamp('20130101'),
            'dt2': date_range('20130101', periods=3),
            # 'dt3' : date_range('20130101 00:00:01',periods=3,freq='s'),
        }, index=range(3))

        df = DataFrame(index=range(3))
        df['dt1'] = np.datetime64('2013-01-01')
        df['dt2'] = np.array(['2013-01-01', '2013-01-02', '2013-01-03'],
                             dtype='datetime64[D]')

        # df['dt3'] = np.array(['2013-01-01 00:00:01','2013-01-01
        # 00:00:02','2013-01-01 00:00:03'],dtype='datetime64[s]')

        assert_frame_equal(df, expected)

    def test_constructor_compound_dtypes(self):
        # GH 5191
        # compound dtypes should raise not-implementederror

        def f(dtype):
            data = list(itertools.repeat((datetime(2001, 1, 1),
                                          "aa", 20), 9))
            return DataFrame(data=data,
                             columns=["A", "B", "C"],
                             dtype=dtype)

        pytest.raises(NotImplementedError, f,
                      [("A", "datetime64[h]"),
                       ("B", "str"),
                       ("C", "int32")])

        # these work (though results may be unexpected)
        f('int64')
        f('float64')

        # 10822
        # invalid error message on dt inference
        if not compat.is_platform_windows():
            f('M8[ns]')

    def test_equals_different_blocks(self):
        # GH 9330
        df0 = pd.DataFrame({"A": ["x", "y"], "B": [1, 2],
                            "C": ["w", "z"]})
        df1 = df0.reset_index()[["A", "B", "C"]]
        # this assert verifies that the above operations have
        # induced a block rearrangement
        assert (df0._data.blocks[0].dtype != df1._data.blocks[0].dtype)

        # do the real tests
        assert_frame_equal(df0, df1)
        assert df0.equals(df1)
        assert df1.equals(df0)

    def test_copy_blocks(self):
        # API/ENH 9607
        df = DataFrame(self.frame, copy=True)
        column = df.columns[0]

        # use the default copy=True, change a column
        blocks = df.as_blocks()
        for dtype, _df in blocks.items():
            if column in _df:
                _df.loc[:, column] = _df[column] + 1

        # make sure we did not change the original DataFrame
        assert not _df[column].equals(df[column])

    def test_no_copy_blocks(self):
        # API/ENH 9607
        df = DataFrame(self.frame, copy=True)
        column = df.columns[0]

        # use the copy=False, change a column
        blocks = df.as_blocks(copy=False)
        for dtype, _df in blocks.items():
            if column in _df:
                _df.loc[:, column] = _df[column] + 1

        # make sure we did change the original DataFrame
        assert _df[column].equals(df[column])

    def test_copy(self):
        cop = self.frame.copy()
        cop['E'] = cop['A']
        assert 'E' not in self.frame

        # copy objects
        copy = self.mixed_frame.copy()
        assert copy._data is not self.mixed_frame._data

    def test_pickle(self):
        unpickled = tm.round_trip_pickle(self.mixed_frame)
        assert_frame_equal(self.mixed_frame, unpickled)

        # buglet
        self.mixed_frame._data.ndim

        # empty
        unpickled = tm.round_trip_pickle(self.empty)
        repr(unpickled)

        # tz frame
        unpickled = tm.round_trip_pickle(self.tzframe)
        assert_frame_equal(self.tzframe, unpickled)

    def test_consolidate_datetime64(self):
        # numpy vstack bug

        data = """\
starting,ending,measure
2012-06-21 00:00,2012-06-23 07:00,77
2012-06-23 07:00,2012-06-23 16:30,65
2012-06-23 16:30,2012-06-25 08:00,77
2012-06-25 08:00,2012-06-26 12:00,0
2012-06-26 12:00,2012-06-27 08:00,77
"""
        df = pd.read_csv(StringIO(data), parse_dates=[0, 1])

        ser_starting = df.starting
        ser_starting.index = ser_starting.values
        ser_starting = ser_starting.tz_localize('US/Eastern')
        ser_starting = ser_starting.tz_convert('UTC')
        ser_starting.index.name = 'starting'

        ser_ending = df.ending
        ser_ending.index = ser_ending.values
        ser_ending = ser_ending.tz_localize('US/Eastern')
        ser_ending = ser_ending.tz_convert('UTC')
        ser_ending.index.name = 'ending'

        df.starting = ser_starting.index
        df.ending = ser_ending.index

        tm.assert_index_equal(pd.DatetimeIndex(
            df.starting), ser_starting.index)
        tm.assert_index_equal(pd.DatetimeIndex(df.ending), ser_ending.index)

    def test_is_mixed_type(self):
        assert not self.frame._is_mixed_type
        assert self.mixed_frame._is_mixed_type

    def test_get_numeric_data(self):
        # TODO(wesm): unused?
        intname = np.dtype(np.int_).name  # noqa
        floatname = np.dtype(np.float_).name  # noqa

        datetime64name = np.dtype('M8[ns]').name
        objectname = np.dtype(np.object_).name

        df = DataFrame({'a': 1., 'b': 2, 'c': 'foo',
                        'f': Timestamp('20010102')},
                       index=np.arange(10))
        result = df.get_dtype_counts()
        expected = Series({'int64': 1, 'float64': 1,
                           datetime64name: 1, objectname: 1})
        result.sort_index()
        expected.sort_index()
        assert_series_equal(result, expected)

        df = DataFrame({'a': 1., 'b': 2, 'c': 'foo',
                        'd': np.array([1.] * 10, dtype='float32'),
                        'e': np.array([1] * 10, dtype='int32'),
                        'f': np.array([1] * 10, dtype='int16'),
                        'g': Timestamp('20010102')},
                       index=np.arange(10))

        result = df._get_numeric_data()
        expected = df.loc[:, ['a', 'b', 'd', 'e', 'f']]
        assert_frame_equal(result, expected)

        only_obj = df.loc[:, ['c', 'g']]
        result = only_obj._get_numeric_data()
        expected = df.loc[:, []]
        assert_frame_equal(result, expected)

        df = DataFrame.from_dict(
            {'a': [1, 2], 'b': ['foo', 'bar'], 'c': [np.pi, np.e]})
        result = df._get_numeric_data()
        expected = DataFrame.from_dict({'a': [1, 2], 'c': [np.pi, np.e]})
        assert_frame_equal(result, expected)

        df = result.copy()
        result = df._get_numeric_data()
        expected = df
        assert_frame_equal(result, expected)

    def test_convert_objects(self):

        oops = self.mixed_frame.T.T
        converted = oops._convert(datetime=True)
        assert_frame_equal(converted, self.mixed_frame)
        assert converted['A'].dtype == np.float64

        # force numeric conversion
        self.mixed_frame['H'] = '1.'
        self.mixed_frame['I'] = '1'

        # add in some items that will be nan
        l = len(self.mixed_frame)
        self.mixed_frame['J'] = '1.'
        self.mixed_frame['K'] = '1'
        self.mixed_frame.loc[0:5, ['J', 'K']] = 'garbled'
        converted = self.mixed_frame._convert(datetime=True, numeric=True)
        assert converted['H'].dtype == 'float64'
        assert converted['I'].dtype == 'int64'
        assert converted['J'].dtype == 'float64'
        assert converted['K'].dtype == 'float64'
        assert len(converted['J'].dropna()) == l - 5
        assert len(converted['K'].dropna()) == l - 5

        # via astype
        converted = self.mixed_frame.copy()
        converted['H'] = converted['H'].astype('float64')
        converted['I'] = converted['I'].astype('int64')
        assert converted['H'].dtype == 'float64'
        assert converted['I'].dtype == 'int64'

        # via astype, but errors
        converted = self.mixed_frame.copy()
        with tm.assert_raises_regex(ValueError, 'invalid literal'):
            converted['H'].astype('int32')

        # mixed in a single column
        df = DataFrame(dict(s=Series([1, 'na', 3, 4])))
        result = df._convert(datetime=True, numeric=True)
        expected = DataFrame(dict(s=Series([1, np.nan, 3, 4])))
        assert_frame_equal(result, expected)

    def test_convert_objects_no_conversion(self):
        mixed1 = DataFrame(
            {'a': [1, 2, 3], 'b': [4.0, 5, 6], 'c': ['x', 'y', 'z']})
        mixed2 = mixed1._convert(datetime=True)
        assert_frame_equal(mixed1, mixed2)

    def test_stale_cached_series_bug_473(self):

        # this is chained, but ok
        with option_context('chained_assignment', None):
            Y = DataFrame(np.random.random((4, 4)), index=('a', 'b', 'c', 'd'),
                          columns=('e', 'f', 'g', 'h'))
            repr(Y)
            Y['e'] = Y['e'].astype('object')
            Y['g']['c'] = np.NaN
            repr(Y)
            result = Y.sum()  # noqa
            exp = Y['g'].sum()  # noqa
            assert pd.isnull(Y['g']['c'])

    def test_get_X_columns(self):
        # numeric and object columns

        df = DataFrame({'a': [1, 2, 3],
                        'b': [True, False, True],
                        'c': ['foo', 'bar', 'baz'],
                        'd': [None, None, None],
                        'e': [3.14, 0.577, 2.773]})

        tm.assert_index_equal(df._get_numeric_data().columns,
                              pd.Index(['a', 'b', 'e']))

    def test_strange_column_corruption_issue(self):
        # (wesm) Unclear how exactly this is related to internal matters
        df = DataFrame(index=[0, 1])
        df[0] = nan
        wasCol = {}
        # uncommenting these makes the results match
        # for col in xrange(100, 200):
        #    wasCol[col] = 1
        #    df[col] = nan

        for i, dt in enumerate(df.index):
            for col in range(100, 200):
                if col not in wasCol:
                    wasCol[col] = 1
                    df[col] = nan
                df[col][dt] = i

        myid = 100

        first = len(df.loc[pd.isnull(df[myid]), [myid]])
        second = len(df.loc[pd.isnull(df[myid]), [myid]])
        assert first == second == 0
