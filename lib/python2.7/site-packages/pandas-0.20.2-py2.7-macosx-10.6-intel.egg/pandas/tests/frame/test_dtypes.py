# -*- coding: utf-8 -*-

from __future__ import print_function

import pytest

from datetime import timedelta

import numpy as np
from pandas import (DataFrame, Series, date_range, Timedelta, Timestamp,
                    compat, concat, option_context)
from pandas.compat import u
from pandas.core.dtypes.dtypes import DatetimeTZDtype
from pandas.tests.frame.common import TestData
from pandas.util.testing import (assert_series_equal,
                                 assert_frame_equal,
                                 makeCustomDataframe as mkdf)
import pandas.util.testing as tm
import pandas as pd


class TestDataFrameDataTypes(TestData):

    def test_concat_empty_dataframe_dtypes(self):
        df = DataFrame(columns=list("abc"))
        df['a'] = df['a'].astype(np.bool_)
        df['b'] = df['b'].astype(np.int32)
        df['c'] = df['c'].astype(np.float64)

        result = pd.concat([df, df])
        assert result['a'].dtype == np.bool_
        assert result['b'].dtype == np.int32
        assert result['c'].dtype == np.float64

        result = pd.concat([df, df.astype(np.float64)])
        assert result['a'].dtype == np.object_
        assert result['b'].dtype == np.float64
        assert result['c'].dtype == np.float64

    def test_empty_frame_dtypes_ftypes(self):
        empty_df = pd.DataFrame()
        assert_series_equal(empty_df.dtypes, pd.Series(dtype=np.object))
        assert_series_equal(empty_df.ftypes, pd.Series(dtype=np.object))

        nocols_df = pd.DataFrame(index=[1, 2, 3])
        assert_series_equal(nocols_df.dtypes, pd.Series(dtype=np.object))
        assert_series_equal(nocols_df.ftypes, pd.Series(dtype=np.object))

        norows_df = pd.DataFrame(columns=list("abc"))
        assert_series_equal(norows_df.dtypes, pd.Series(
            np.object, index=list("abc")))
        assert_series_equal(norows_df.ftypes, pd.Series(
            'object:dense', index=list("abc")))

        norows_int_df = pd.DataFrame(columns=list("abc")).astype(np.int32)
        assert_series_equal(norows_int_df.dtypes, pd.Series(
            np.dtype('int32'), index=list("abc")))
        assert_series_equal(norows_int_df.ftypes, pd.Series(
            'int32:dense', index=list("abc")))

        odict = compat.OrderedDict
        df = pd.DataFrame(odict([('a', 1), ('b', True), ('c', 1.0)]),
                          index=[1, 2, 3])
        ex_dtypes = pd.Series(odict([('a', np.int64),
                                     ('b', np.bool),
                                     ('c', np.float64)]))
        ex_ftypes = pd.Series(odict([('a', 'int64:dense'),
                                     ('b', 'bool:dense'),
                                     ('c', 'float64:dense')]))
        assert_series_equal(df.dtypes, ex_dtypes)
        assert_series_equal(df.ftypes, ex_ftypes)

        # same but for empty slice of df
        assert_series_equal(df[:0].dtypes, ex_dtypes)
        assert_series_equal(df[:0].ftypes, ex_ftypes)

    def test_datetime_with_tz_dtypes(self):
        tzframe = DataFrame({'A': date_range('20130101', periods=3),
                             'B': date_range('20130101', periods=3,
                                             tz='US/Eastern'),
                             'C': date_range('20130101', periods=3, tz='CET')})
        tzframe.iloc[1, 1] = pd.NaT
        tzframe.iloc[1, 2] = pd.NaT
        result = tzframe.dtypes.sort_index()
        expected = Series([np.dtype('datetime64[ns]'),
                           DatetimeTZDtype('datetime64[ns, US/Eastern]'),
                           DatetimeTZDtype('datetime64[ns, CET]')],
                          ['A', 'B', 'C'])

        assert_series_equal(result, expected)

    def test_dtypes_are_correct_after_column_slice(self):
        # GH6525
        df = pd.DataFrame(index=range(5), columns=list("abc"), dtype=np.float_)
        odict = compat.OrderedDict
        assert_series_equal(df.dtypes,
                            pd.Series(odict([('a', np.float_),
                                             ('b', np.float_),
                                             ('c', np.float_)])))
        assert_series_equal(df.iloc[:, 2:].dtypes,
                            pd.Series(odict([('c', np.float_)])))
        assert_series_equal(df.dtypes,
                            pd.Series(odict([('a', np.float_),
                                             ('b', np.float_),
                                             ('c', np.float_)])))

    def test_select_dtypes_include(self):
        df = DataFrame({'a': list('abc'),
                        'b': list(range(1, 4)),
                        'c': np.arange(3, 6).astype('u1'),
                        'd': np.arange(4.0, 7.0, dtype='float64'),
                        'e': [True, False, True],
                        'f': pd.Categorical(list('abc')),
                        'g': pd.date_range('20130101', periods=3),
                        'h': pd.date_range('20130101', periods=3,
                                           tz='US/Eastern'),
                        'i': pd.date_range('20130101', periods=3,
                                           tz='CET'),
                        'j': pd.period_range('2013-01', periods=3,
                                             freq='M'),
                        'k': pd.timedelta_range('1 day', periods=3)})

        ri = df.select_dtypes(include=[np.number])
        ei = df[['b', 'c', 'd', 'k']]
        assert_frame_equal(ri, ei)

        ri = df.select_dtypes(include=[np.number], exclude=['timedelta'])
        ei = df[['b', 'c', 'd']]
        assert_frame_equal(ri, ei)

        ri = df.select_dtypes(include=[np.number, 'category'],
                              exclude=['timedelta'])
        ei = df[['b', 'c', 'd', 'f']]
        assert_frame_equal(ri, ei)

        ri = df.select_dtypes(include=['datetime'])
        ei = df[['g']]
        assert_frame_equal(ri, ei)

        ri = df.select_dtypes(include=['datetime64'])
        ei = df[['g']]
        assert_frame_equal(ri, ei)

        ri = df.select_dtypes(include=['datetimetz'])
        ei = df[['h', 'i']]
        assert_frame_equal(ri, ei)

        ri = df.select_dtypes(include=['timedelta'])
        ei = df[['k']]
        assert_frame_equal(ri, ei)

        pytest.raises(NotImplementedError,
                      lambda: df.select_dtypes(include=['period']))

    def test_select_dtypes_exclude(self):
        df = DataFrame({'a': list('abc'),
                        'b': list(range(1, 4)),
                        'c': np.arange(3, 6).astype('u1'),
                        'd': np.arange(4.0, 7.0, dtype='float64'),
                        'e': [True, False, True]})
        re = df.select_dtypes(exclude=[np.number])
        ee = df[['a', 'e']]
        assert_frame_equal(re, ee)

    def test_select_dtypes_exclude_include(self):
        df = DataFrame({'a': list('abc'),
                        'b': list(range(1, 4)),
                        'c': np.arange(3, 6).astype('u1'),
                        'd': np.arange(4.0, 7.0, dtype='float64'),
                        'e': [True, False, True],
                        'f': pd.date_range('now', periods=3).values})
        exclude = np.datetime64,
        include = np.bool_, 'integer'
        r = df.select_dtypes(include=include, exclude=exclude)
        e = df[['b', 'c', 'e']]
        assert_frame_equal(r, e)

        exclude = 'datetime',
        include = 'bool', 'int64', 'int32'
        r = df.select_dtypes(include=include, exclude=exclude)
        e = df[['b', 'e']]
        assert_frame_equal(r, e)

    def test_select_dtypes_not_an_attr_but_still_valid_dtype(self):
        df = DataFrame({'a': list('abc'),
                        'b': list(range(1, 4)),
                        'c': np.arange(3, 6).astype('u1'),
                        'd': np.arange(4.0, 7.0, dtype='float64'),
                        'e': [True, False, True],
                        'f': pd.date_range('now', periods=3).values})
        df['g'] = df.f.diff()
        assert not hasattr(np, 'u8')
        r = df.select_dtypes(include=['i8', 'O'], exclude=['timedelta'])
        e = df[['a', 'b']]
        assert_frame_equal(r, e)

        r = df.select_dtypes(include=['i8', 'O', 'timedelta64[ns]'])
        e = df[['a', 'b', 'g']]
        assert_frame_equal(r, e)

    def test_select_dtypes_empty(self):
        df = DataFrame({'a': list('abc'), 'b': list(range(1, 4))})
        with tm.assert_raises_regex(ValueError, 'at least one of '
                                    'include or exclude '
                                    'must be nonempty'):
            df.select_dtypes()

    def test_select_dtypes_raises_on_string(self):
        df = DataFrame({'a': list('abc'), 'b': list(range(1, 4))})
        with tm.assert_raises_regex(TypeError, 'include and exclude '
                                    '.+ non-'):
            df.select_dtypes(include='object')
        with tm.assert_raises_regex(TypeError, 'include and exclude '
                                    '.+ non-'):
            df.select_dtypes(exclude='object')
        with tm.assert_raises_regex(TypeError, 'include and exclude '
                                    '.+ non-'):
            df.select_dtypes(include=int, exclude='object')

    def test_select_dtypes_bad_datetime64(self):
        df = DataFrame({'a': list('abc'),
                        'b': list(range(1, 4)),
                        'c': np.arange(3, 6).astype('u1'),
                        'd': np.arange(4.0, 7.0, dtype='float64'),
                        'e': [True, False, True],
                        'f': pd.date_range('now', periods=3).values})
        with tm.assert_raises_regex(ValueError, '.+ is too specific'):
            df.select_dtypes(include=['datetime64[D]'])

        with tm.assert_raises_regex(ValueError, '.+ is too specific'):
            df.select_dtypes(exclude=['datetime64[as]'])

    def test_select_dtypes_datetime_with_tz(self):

        df2 = DataFrame(dict(A=Timestamp('20130102', tz='US/Eastern'),
                             B=Timestamp('20130603', tz='CET')),
                        index=range(5))
        df3 = pd.concat([df2.A.to_frame(), df2.B.to_frame()], axis=1)
        result = df3.select_dtypes(include=['datetime64[ns]'])
        expected = df3.reindex(columns=[])
        assert_frame_equal(result, expected)

    def test_select_dtypes_str_raises(self):
        df = DataFrame({'a': list('abc'),
                        'g': list(u('abc')),
                        'b': list(range(1, 4)),
                        'c': np.arange(3, 6).astype('u1'),
                        'd': np.arange(4.0, 7.0, dtype='float64'),
                        'e': [True, False, True],
                        'f': pd.date_range('now', periods=3).values})
        string_dtypes = set((str, 'str', np.string_, 'S1',
                             'unicode', np.unicode_, 'U1'))
        try:
            string_dtypes.add(unicode)
        except NameError:
            pass
        for dt in string_dtypes:
            with tm.assert_raises_regex(TypeError,
                                        'string dtypes are not allowed'):
                df.select_dtypes(include=[dt])
            with tm.assert_raises_regex(TypeError,
                                        'string dtypes are not allowed'):
                df.select_dtypes(exclude=[dt])

    def test_select_dtypes_bad_arg_raises(self):
        df = DataFrame({'a': list('abc'),
                        'g': list(u('abc')),
                        'b': list(range(1, 4)),
                        'c': np.arange(3, 6).astype('u1'),
                        'd': np.arange(4.0, 7.0, dtype='float64'),
                        'e': [True, False, True],
                        'f': pd.date_range('now', periods=3).values})
        with tm.assert_raises_regex(TypeError, 'data type.'
                                    '*not understood'):
            df.select_dtypes(['blargy, blarg, blarg'])

    def test_select_dtypes_typecodes(self):
        # GH 11990
        df = mkdf(30, 3, data_gen_f=lambda x, y: np.random.random())
        expected = df
        FLOAT_TYPES = list(np.typecodes['AllFloat'])
        assert_frame_equal(df.select_dtypes(FLOAT_TYPES), expected)

    def test_dtypes_gh8722(self):
        self.mixed_frame['bool'] = self.mixed_frame['A'] > 0
        result = self.mixed_frame.dtypes
        expected = Series(dict((k, v.dtype)
                               for k, v in compat.iteritems(self.mixed_frame)),
                          index=result.index)
        assert_series_equal(result, expected)

        # compat, GH 8722
        with option_context('use_inf_as_null', True):
            df = DataFrame([[1]])
            result = df.dtypes
            assert_series_equal(result, Series({0: np.dtype('int64')}))

    def test_ftypes(self):
        frame = self.mixed_float
        expected = Series(dict(A='float32:dense',
                               B='float32:dense',
                               C='float16:dense',
                               D='float64:dense')).sort_values()
        result = frame.ftypes.sort_values()
        assert_series_equal(result, expected)

    def test_astype(self):
        casted = self.frame.astype(int)
        expected = DataFrame(self.frame.values.astype(int),
                             index=self.frame.index,
                             columns=self.frame.columns)
        assert_frame_equal(casted, expected)

        casted = self.frame.astype(np.int32)
        expected = DataFrame(self.frame.values.astype(np.int32),
                             index=self.frame.index,
                             columns=self.frame.columns)
        assert_frame_equal(casted, expected)

        self.frame['foo'] = '5'
        casted = self.frame.astype(int)
        expected = DataFrame(self.frame.values.astype(int),
                             index=self.frame.index,
                             columns=self.frame.columns)
        assert_frame_equal(casted, expected)

        # mixed casting
        def _check_cast(df, v):
            assert (list(set([s.dtype.name for
                              _, s in compat.iteritems(df)]))[0] == v)

        mn = self.all_mixed._get_numeric_data().copy()
        mn['little_float'] = np.array(12345., dtype='float16')
        mn['big_float'] = np.array(123456789101112., dtype='float64')

        casted = mn.astype('float64')
        _check_cast(casted, 'float64')

        casted = mn.astype('int64')
        _check_cast(casted, 'int64')

        casted = self.mixed_float.reindex(columns=['A', 'B']).astype('float32')
        _check_cast(casted, 'float32')

        casted = mn.reindex(columns=['little_float']).astype('float16')
        _check_cast(casted, 'float16')

        casted = self.mixed_float.reindex(columns=['A', 'B']).astype('float16')
        _check_cast(casted, 'float16')

        casted = mn.astype('float32')
        _check_cast(casted, 'float32')

        casted = mn.astype('int32')
        _check_cast(casted, 'int32')

        # to object
        casted = mn.astype('O')
        _check_cast(casted, 'object')

    def test_astype_with_exclude_string(self):
        df = self.frame.copy()
        expected = self.frame.astype(int)
        df['string'] = 'foo'
        casted = df.astype(int, errors='ignore')

        expected['string'] = 'foo'
        assert_frame_equal(casted, expected)

        df = self.frame.copy()
        expected = self.frame.astype(np.int32)
        df['string'] = 'foo'
        casted = df.astype(np.int32, errors='ignore')

        expected['string'] = 'foo'
        assert_frame_equal(casted, expected)

    def test_astype_with_view(self):

        tf = self.mixed_float.reindex(columns=['A', 'B', 'C'])

        casted = tf.astype(np.int64)

        casted = tf.astype(np.float32)

        # this is the only real reason to do it this way
        tf = np.round(self.frame).astype(np.int32)
        casted = tf.astype(np.float32, copy=False)

        # TODO(wesm): verification?
        tf = self.frame.astype(np.float64)
        casted = tf.astype(np.int64, copy=False)  # noqa

    def test_astype_cast_nan_inf_int(self):
        # GH14265, check nan and inf raise error when converting to int
        types = [np.int32, np.int64]
        values = [np.nan, np.inf]
        msg = 'Cannot convert non-finite values \\(NA or inf\\) to integer'

        for this_type in types:
            for this_val in values:
                df = DataFrame([this_val])
                with tm.assert_raises_regex(ValueError, msg):
                    df.astype(this_type)

    def test_astype_str(self):
        # GH9757
        a = Series(date_range('2010-01-04', periods=5))
        b = Series(date_range('3/6/2012 00:00', periods=5, tz='US/Eastern'))
        c = Series([Timedelta(x, unit='d') for x in range(5)])
        d = Series(range(5))
        e = Series([0.0, 0.2, 0.4, 0.6, 0.8])

        df = DataFrame({'a': a, 'b': b, 'c': c, 'd': d, 'e': e})

        # datetimelike
        # Test str and unicode on python 2.x and just str on python 3.x
        for tt in set([str, compat.text_type]):
            result = df.astype(tt)

            expected = DataFrame({
                'a': list(map(tt, map(lambda x: Timestamp(x)._date_repr,
                                      a._values))),
                'b': list(map(tt, map(Timestamp, b._values))),
                'c': list(map(tt, map(lambda x: Timedelta(x)
                                      ._repr_base(format='all'), c._values))),
                'd': list(map(tt, d._values)),
                'e': list(map(tt, e._values)),
            })

            assert_frame_equal(result, expected)

        # float/nan
        # 11302
        # consistency in astype(str)
        for tt in set([str, compat.text_type]):
            result = DataFrame([np.NaN]).astype(tt)
            expected = DataFrame(['nan'])
            assert_frame_equal(result, expected)

            result = DataFrame([1.12345678901234567890]).astype(tt)
            expected = DataFrame(['1.12345678901'])
            assert_frame_equal(result, expected)

    def test_astype_dict(self):
        # GH7271
        a = Series(date_range('2010-01-04', periods=5))
        b = Series(range(5))
        c = Series([0.0, 0.2, 0.4, 0.6, 0.8])
        d = Series(['1.0', '2', '3.14', '4', '5.4'])
        df = DataFrame({'a': a, 'b': b, 'c': c, 'd': d})
        original = df.copy(deep=True)

        # change type of a subset of columns
        result = df.astype({'b': 'str', 'd': 'float32'})
        expected = DataFrame({
            'a': a,
            'b': Series(['0', '1', '2', '3', '4']),
            'c': c,
            'd': Series([1.0, 2.0, 3.14, 4.0, 5.4], dtype='float32')})
        assert_frame_equal(result, expected)
        assert_frame_equal(df, original)

        result = df.astype({'b': np.float32, 'c': 'float32', 'd': np.float64})
        expected = DataFrame({
            'a': a,
            'b': Series([0.0, 1.0, 2.0, 3.0, 4.0], dtype='float32'),
            'c': Series([0.0, 0.2, 0.4, 0.6, 0.8], dtype='float32'),
            'd': Series([1.0, 2.0, 3.14, 4.0, 5.4], dtype='float64')})
        assert_frame_equal(result, expected)
        assert_frame_equal(df, original)

        # change all columns
        assert_frame_equal(df.astype({'a': str, 'b': str, 'c': str, 'd': str}),
                           df.astype(str))
        assert_frame_equal(df, original)

        # error should be raised when using something other than column labels
        # in the keys of the dtype dict
        pytest.raises(KeyError, df.astype, {'b': str, 2: str})
        pytest.raises(KeyError, df.astype, {'e': str})
        assert_frame_equal(df, original)

        # if the dtypes provided are the same as the original dtypes, the
        # resulting DataFrame should be the same as the original DataFrame
        equiv = df.astype({col: df[col].dtype for col in df.columns})
        assert_frame_equal(df, equiv)
        assert_frame_equal(df, original)

    def test_astype_duplicate_col(self):
        a1 = Series([1, 2, 3, 4, 5], name='a')
        b = Series([0.1, 0.2, 0.4, 0.6, 0.8], name='b')
        a2 = Series([0, 1, 2, 3, 4], name='a')
        df = concat([a1, b, a2], axis=1)

        result = df.astype(str)
        a1_str = Series(['1', '2', '3', '4', '5'], dtype='str', name='a')
        b_str = Series(['0.1', '0.2', '0.4', '0.6', '0.8'], dtype=str,
                       name='b')
        a2_str = Series(['0', '1', '2', '3', '4'], dtype='str', name='a')
        expected = concat([a1_str, b_str, a2_str], axis=1)
        assert_frame_equal(result, expected)

        result = df.astype({'a': 'str'})
        expected = concat([a1_str, b, a2_str], axis=1)
        assert_frame_equal(result, expected)

    def test_timedeltas(self):
        df = DataFrame(dict(A=Series(date_range('2012-1-1', periods=3,
                                                freq='D')),
                            B=Series([timedelta(days=i) for i in range(3)])))
        result = df.get_dtype_counts().sort_values()
        expected = Series(
            {'datetime64[ns]': 1, 'timedelta64[ns]': 1}).sort_values()
        assert_series_equal(result, expected)

        df['C'] = df['A'] + df['B']
        expected = Series(
            {'datetime64[ns]': 2, 'timedelta64[ns]': 1}).sort_values()
        result = df.get_dtype_counts().sort_values()
        assert_series_equal(result, expected)

        # mixed int types
        df['D'] = 1
        expected = Series({'datetime64[ns]': 2,
                           'timedelta64[ns]': 1,
                           'int64': 1}).sort_values()
        result = df.get_dtype_counts().sort_values()
        assert_series_equal(result, expected)

    def test_arg_for_errors_in_astype(self):
        # issue #14878

        df = DataFrame([1, 2, 3])

        with pytest.raises(ValueError):
            df.astype(np.float64, errors=True)

        with tm.assert_produces_warning(FutureWarning):
            df.astype(np.int8, raise_on_error=False)

        df.astype(np.int8, errors='ignore')


class TestDataFrameDatetimeWithTZ(TestData):

    def test_interleave(self):

        # interleave with object
        result = self.tzframe.assign(D='foo').values
        expected = np.array([[Timestamp('2013-01-01 00:00:00'),
                              Timestamp('2013-01-02 00:00:00'),
                              Timestamp('2013-01-03 00:00:00')],
                             [Timestamp('2013-01-01 00:00:00-0500',
                                        tz='US/Eastern'),
                              pd.NaT,
                              Timestamp('2013-01-03 00:00:00-0500',
                                        tz='US/Eastern')],
                             [Timestamp('2013-01-01 00:00:00+0100', tz='CET'),
                              pd.NaT,
                              Timestamp('2013-01-03 00:00:00+0100', tz='CET')],
                             ['foo', 'foo', 'foo']], dtype=object).T
        tm.assert_numpy_array_equal(result, expected)

        # interleave with only datetime64[ns]
        result = self.tzframe.values
        expected = np.array([[Timestamp('2013-01-01 00:00:00'),
                              Timestamp('2013-01-02 00:00:00'),
                              Timestamp('2013-01-03 00:00:00')],
                             [Timestamp('2013-01-01 00:00:00-0500',
                                        tz='US/Eastern'),
                              pd.NaT,
                              Timestamp('2013-01-03 00:00:00-0500',
                                        tz='US/Eastern')],
                             [Timestamp('2013-01-01 00:00:00+0100', tz='CET'),
                              pd.NaT,
                              Timestamp('2013-01-03 00:00:00+0100',
                                        tz='CET')]], dtype=object).T
        tm.assert_numpy_array_equal(result, expected)

    def test_astype(self):
        # astype
        expected = np.array([[Timestamp('2013-01-01 00:00:00'),
                              Timestamp('2013-01-02 00:00:00'),
                              Timestamp('2013-01-03 00:00:00')],
                             [Timestamp('2013-01-01 00:00:00-0500',
                                        tz='US/Eastern'),
                              pd.NaT,
                              Timestamp('2013-01-03 00:00:00-0500',
                                        tz='US/Eastern')],
                             [Timestamp('2013-01-01 00:00:00+0100', tz='CET'),
                              pd.NaT,
                              Timestamp('2013-01-03 00:00:00+0100',
                                        tz='CET')]],
                            dtype=object).T
        result = self.tzframe.astype(object)
        assert_frame_equal(result, DataFrame(
            expected, index=self.tzframe.index, columns=self.tzframe.columns))

        result = self.tzframe.astype('datetime64[ns]')
        expected = DataFrame({'A': date_range('20130101', periods=3),
                              'B': (date_range('20130101', periods=3,
                                               tz='US/Eastern')
                                    .tz_convert('UTC')
                                    .tz_localize(None)),
                              'C': (date_range('20130101', periods=3,
                                               tz='CET')
                                    .tz_convert('UTC')
                                    .tz_localize(None))})
        expected.iloc[1, 1] = pd.NaT
        expected.iloc[1, 2] = pd.NaT
        assert_frame_equal(result, expected)

    def test_astype_str(self):
        # str formatting
        result = self.tzframe.astype(str)
        expected = DataFrame([['2013-01-01', '2013-01-01 00:00:00-05:00',
                               '2013-01-01 00:00:00+01:00'],
                              ['2013-01-02', 'NaT', 'NaT'],
                              ['2013-01-03', '2013-01-03 00:00:00-05:00',
                               '2013-01-03 00:00:00+01:00']],
                             columns=self.tzframe.columns)
        tm.assert_frame_equal(result, expected)

        result = str(self.tzframe)
        assert ('0 2013-01-01 2013-01-01 00:00:00-05:00 '
                '2013-01-01 00:00:00+01:00') in result
        assert ('1 2013-01-02                       '
                'NaT                       NaT') in result
        assert ('2 2013-01-03 2013-01-03 00:00:00-05:00 '
                '2013-01-03 00:00:00+01:00') in result
