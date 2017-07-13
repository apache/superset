# -*- coding: utf-8 -*-

"""
These the test the public routines exposed in types/common.py
related to inference and not otherwise tested in types/test_common.py

"""
from warnings import catch_warnings
import collections
import re
from datetime import datetime, date, timedelta, time
import numpy as np
import pytz
import pytest

import pandas as pd
from pandas._libs import tslib, lib
from pandas import (Series, Index, DataFrame, Timedelta,
                    DatetimeIndex, TimedeltaIndex, Timestamp,
                    Panel, Period, Categorical)
from pandas.compat import u, PY2, PY3, StringIO, lrange
from pandas.core.dtypes import inference
from pandas.core.dtypes.common import (
    is_timedelta64_dtype,
    is_timedelta64_ns_dtype,
    is_datetime64_dtype,
    is_datetime64_ns_dtype,
    is_datetime64_any_dtype,
    is_datetime64tz_dtype,
    is_number,
    is_integer,
    is_float,
    is_bool,
    is_scalar,
    is_scipy_sparse,
    _ensure_int32,
    _ensure_categorical)
from pandas.core.dtypes.missing import isnull
from pandas.util import testing as tm


def test_is_sequence():
    is_seq = inference.is_sequence
    assert (is_seq((1, 2)))
    assert (is_seq([1, 2]))
    assert (not is_seq("abcd"))
    assert (not is_seq(u("abcd")))
    assert (not is_seq(np.int64))

    class A(object):

        def __getitem__(self):
            return 1

    assert (not is_seq(A()))


def test_is_list_like():
    passes = ([], [1], (1, ), (1, 2), {'a': 1}, set([1, 'a']), Series([1]),
              Series([]), Series(['a']).str)
    fails = (1, '2', object())

    for p in passes:
        assert inference.is_list_like(p)

    for f in fails:
        assert not inference.is_list_like(f)


@pytest.mark.parametrize('inner', [
    [], [1], (1, ), (1, 2), {'a': 1}, set([1, 'a']), Series([1]),
    Series([]), Series(['a']).str, (x for x in range(5))
])
@pytest.mark.parametrize('outer', [
    list, Series, np.array, tuple
])
def test_is_nested_list_like_passes(inner, outer):
    result = outer([inner for _ in range(5)])
    assert inference.is_list_like(result)


@pytest.mark.parametrize('obj', [
    'abc', [], [1], (1,), ['a'], 'a', {'a'},
    [1, 2, 3], Series([1]), DataFrame({"A": [1]}),
    ([1, 2] for _ in range(5)),
])
def test_is_nested_list_like_fails(obj):
    assert not inference.is_nested_list_like(obj)


def test_is_dict_like():
    passes = [{}, {'A': 1}, Series([1])]
    fails = ['1', 1, [1, 2], (1, 2), range(2), Index([1])]

    for p in passes:
        assert inference.is_dict_like(p)

    for f in fails:
        assert not inference.is_dict_like(f)


def test_is_file_like():
    class MockFile(object):
        pass

    is_file = inference.is_file_like

    data = StringIO("data")
    assert is_file(data)

    # No read / write attributes
    # No iterator attributes
    m = MockFile()
    assert not is_file(m)

    MockFile.write = lambda self: 0

    # Write attribute but not an iterator
    m = MockFile()
    assert not is_file(m)

    # gh-16530: Valid iterator just means we have the
    # __iter__ attribute for our purposes.
    MockFile.__iter__ = lambda self: self

    # Valid write-only file
    m = MockFile()
    assert is_file(m)

    del MockFile.write
    MockFile.read = lambda self: 0

    # Valid read-only file
    m = MockFile()
    assert is_file(m)

    # Iterator but no read / write attributes
    data = [1, 2, 3]
    assert not is_file(data)

    if PY3:
        from unittest import mock
        assert not is_file(mock.Mock())


def test_is_named_tuple():
    passes = (collections.namedtuple('Test', list('abc'))(1, 2, 3), )
    fails = ((1, 2, 3), 'a', Series({'pi': 3.14}))

    for p in passes:
        assert inference.is_named_tuple(p)

    for f in fails:
        assert not inference.is_named_tuple(f)


def test_is_hashable():

    # all new-style classes are hashable by default
    class HashableClass(object):
        pass

    class UnhashableClass1(object):
        __hash__ = None

    class UnhashableClass2(object):

        def __hash__(self):
            raise TypeError("Not hashable")

    hashable = (1,
                3.14,
                np.float64(3.14),
                'a',
                tuple(),
                (1, ),
                HashableClass(), )
    not_hashable = ([], UnhashableClass1(), )
    abc_hashable_not_really_hashable = (([], ), UnhashableClass2(), )

    for i in hashable:
        assert inference.is_hashable(i)
    for i in not_hashable:
        assert not inference.is_hashable(i)
    for i in abc_hashable_not_really_hashable:
        assert not inference.is_hashable(i)

    # numpy.array is no longer collections.Hashable as of
    # https://github.com/numpy/numpy/pull/5326, just test
    # is_hashable()
    assert not inference.is_hashable(np.array([]))

    # old-style classes in Python 2 don't appear hashable to
    # collections.Hashable but also seem to support hash() by default
    if PY2:

        class OldStyleClass():
            pass

        c = OldStyleClass()
        assert not isinstance(c, collections.Hashable)
        assert inference.is_hashable(c)
        hash(c)  # this will not raise


def test_is_re():
    passes = re.compile('ad'),
    fails = 'x', 2, 3, object()

    for p in passes:
        assert inference.is_re(p)

    for f in fails:
        assert not inference.is_re(f)


def test_is_recompilable():
    passes = (r'a', u('x'), r'asdf', re.compile('adsf'), u(r'\u2233\s*'),
              re.compile(r''))
    fails = 1, [], object()

    for p in passes:
        assert inference.is_re_compilable(p)

    for f in fails:
        assert not inference.is_re_compilable(f)


class TestInference(object):

    def test_infer_dtype_bytes(self):
        compare = 'string' if PY2 else 'bytes'

        # string array of bytes
        arr = np.array(list('abc'), dtype='S1')
        assert lib.infer_dtype(arr) == compare

        # object array of bytes
        arr = arr.astype(object)
        assert lib.infer_dtype(arr) == compare

    def test_isinf_scalar(self):
        # GH 11352
        assert lib.isposinf_scalar(float('inf'))
        assert lib.isposinf_scalar(np.inf)
        assert not lib.isposinf_scalar(-np.inf)
        assert not lib.isposinf_scalar(1)
        assert not lib.isposinf_scalar('a')

        assert lib.isneginf_scalar(float('-inf'))
        assert lib.isneginf_scalar(-np.inf)
        assert not lib.isneginf_scalar(np.inf)
        assert not lib.isneginf_scalar(1)
        assert not lib.isneginf_scalar('a')

    def test_maybe_convert_numeric_infinities(self):
        # see gh-13274
        infinities = ['inf', 'inF', 'iNf', 'Inf',
                      'iNF', 'InF', 'INf', 'INF']
        na_values = set(['', 'NULL', 'nan'])

        pos = np.array(['inf'], dtype=np.float64)
        neg = np.array(['-inf'], dtype=np.float64)

        msg = "Unable to parse string"

        for infinity in infinities:
            for maybe_int in (True, False):
                out = lib.maybe_convert_numeric(
                    np.array([infinity], dtype=object),
                    na_values, maybe_int)
                tm.assert_numpy_array_equal(out, pos)

                out = lib.maybe_convert_numeric(
                    np.array(['-' + infinity], dtype=object),
                    na_values, maybe_int)
                tm.assert_numpy_array_equal(out, neg)

                out = lib.maybe_convert_numeric(
                    np.array([u(infinity)], dtype=object),
                    na_values, maybe_int)
                tm.assert_numpy_array_equal(out, pos)

                out = lib.maybe_convert_numeric(
                    np.array(['+' + infinity], dtype=object),
                    na_values, maybe_int)
                tm.assert_numpy_array_equal(out, pos)

                # too many characters
                with tm.assert_raises_regex(ValueError, msg):
                    lib.maybe_convert_numeric(
                        np.array(['foo_' + infinity], dtype=object),
                        na_values, maybe_int)

    def test_maybe_convert_numeric_post_floatify_nan(self):
        # see gh-13314
        data = np.array(['1.200', '-999.000', '4.500'], dtype=object)
        expected = np.array([1.2, np.nan, 4.5], dtype=np.float64)
        nan_values = set([-999, -999.0])

        for coerce_type in (True, False):
            out = lib.maybe_convert_numeric(data, nan_values, coerce_type)
            tm.assert_numpy_array_equal(out, expected)

    def test_convert_infs(self):
        arr = np.array(['inf', 'inf', 'inf'], dtype='O')
        result = lib.maybe_convert_numeric(arr, set(), False)
        assert result.dtype == np.float64

        arr = np.array(['-inf', '-inf', '-inf'], dtype='O')
        result = lib.maybe_convert_numeric(arr, set(), False)
        assert result.dtype == np.float64

    def test_scientific_no_exponent(self):
        # See PR 12215
        arr = np.array(['42E', '2E', '99e', '6e'], dtype='O')
        result = lib.maybe_convert_numeric(arr, set(), False, True)
        assert np.all(np.isnan(result))

    def test_convert_non_hashable(self):
        # GH13324
        # make sure that we are handing non-hashables
        arr = np.array([[10.0, 2], 1.0, 'apple'])
        result = lib.maybe_convert_numeric(arr, set(), False, True)
        tm.assert_numpy_array_equal(result, np.array([np.nan, 1.0, np.nan]))

    def test_convert_numeric_uint64(self):
        arr = np.array([2**63], dtype=object)
        exp = np.array([2**63], dtype=np.uint64)
        tm.assert_numpy_array_equal(lib.maybe_convert_numeric(arr, set()), exp)

        arr = np.array([str(2**63)], dtype=object)
        exp = np.array([2**63], dtype=np.uint64)
        tm.assert_numpy_array_equal(lib.maybe_convert_numeric(arr, set()), exp)

        arr = np.array([np.uint64(2**63)], dtype=object)
        exp = np.array([2**63], dtype=np.uint64)
        tm.assert_numpy_array_equal(lib.maybe_convert_numeric(arr, set()), exp)

    def test_convert_numeric_uint64_nan(self):
        msg = 'uint64 array detected'
        cases = [(np.array([2**63, np.nan], dtype=object), set()),
                 (np.array([str(2**63), np.nan], dtype=object), set()),
                 (np.array([np.nan, 2**63], dtype=object), set()),
                 (np.array([np.nan, str(2**63)], dtype=object), set()),
                 (np.array([2**63, 2**63 + 1], dtype=object), set([2**63])),
                 (np.array([str(2**63), str(2**63 + 1)],
                           dtype=object), set([2**63]))]

        for coerce in (True, False):
            for arr, na_values in cases:
                if coerce:
                    with tm.assert_raises_regex(ValueError, msg):
                        lib.maybe_convert_numeric(arr, na_values,
                                                  coerce_numeric=coerce)
                else:
                    tm.assert_numpy_array_equal(lib.maybe_convert_numeric(
                        arr, na_values), arr)

    def test_convert_numeric_int64_uint64(self):
        msg = 'uint64 and negative values detected'
        cases = [np.array([2**63, -1], dtype=object),
                 np.array([str(2**63), -1], dtype=object),
                 np.array([str(2**63), str(-1)], dtype=object),
                 np.array([-1, 2**63], dtype=object),
                 np.array([-1, str(2**63)], dtype=object),
                 np.array([str(-1), str(2**63)], dtype=object)]

        for coerce in (True, False):
            for case in cases:
                if coerce:
                    with tm.assert_raises_regex(ValueError, msg):
                        lib.maybe_convert_numeric(case, set(),
                                                  coerce_numeric=coerce)
                else:
                    tm.assert_numpy_array_equal(lib.maybe_convert_numeric(
                        case, set()), case)

    def test_maybe_convert_objects_uint64(self):
        # see gh-4471
        arr = np.array([2**63], dtype=object)
        exp = np.array([2**63], dtype=np.uint64)
        tm.assert_numpy_array_equal(lib.maybe_convert_objects(arr), exp)

        # NumPy bug: can't compare uint64 to int64, as that
        # results in both casting to float64, so we should
        # make sure that this function is robust against it
        arr = np.array([np.uint64(2**63)], dtype=object)
        exp = np.array([2**63], dtype=np.uint64)
        tm.assert_numpy_array_equal(lib.maybe_convert_objects(arr), exp)

        arr = np.array([2, -1], dtype=object)
        exp = np.array([2, -1], dtype=np.int64)
        tm.assert_numpy_array_equal(lib.maybe_convert_objects(arr), exp)

        arr = np.array([2**63, -1], dtype=object)
        exp = np.array([2**63, -1], dtype=object)
        tm.assert_numpy_array_equal(lib.maybe_convert_objects(arr), exp)

    def test_mixed_dtypes_remain_object_array(self):
        # GH14956
        array = np.array([datetime(2015, 1, 1, tzinfo=pytz.utc), 1],
                         dtype=object)
        result = lib.maybe_convert_objects(array, convert_datetime=1)
        tm.assert_numpy_array_equal(result, array)


class TestTypeInference(object):

    def test_length_zero(self):
        result = lib.infer_dtype(np.array([], dtype='i4'))
        assert result == 'integer'

        result = lib.infer_dtype([])
        assert result == 'empty'

    def test_integers(self):
        arr = np.array([1, 2, 3, np.int64(4), np.int32(5)], dtype='O')
        result = lib.infer_dtype(arr)
        assert result == 'integer'

        arr = np.array([1, 2, 3, np.int64(4), np.int32(5), 'foo'], dtype='O')
        result = lib.infer_dtype(arr)
        assert result == 'mixed-integer'

        arr = np.array([1, 2, 3, 4, 5], dtype='i4')
        result = lib.infer_dtype(arr)
        assert result == 'integer'

    def test_bools(self):
        arr = np.array([True, False, True, True, True], dtype='O')
        result = lib.infer_dtype(arr)
        assert result == 'boolean'

        arr = np.array([np.bool_(True), np.bool_(False)], dtype='O')
        result = lib.infer_dtype(arr)
        assert result == 'boolean'

        arr = np.array([True, False, True, 'foo'], dtype='O')
        result = lib.infer_dtype(arr)
        assert result == 'mixed'

        arr = np.array([True, False, True], dtype=bool)
        result = lib.infer_dtype(arr)
        assert result == 'boolean'

    def test_floats(self):
        arr = np.array([1., 2., 3., np.float64(4), np.float32(5)], dtype='O')
        result = lib.infer_dtype(arr)
        assert result == 'floating'

        arr = np.array([1, 2, 3, np.float64(4), np.float32(5), 'foo'],
                       dtype='O')
        result = lib.infer_dtype(arr)
        assert result == 'mixed-integer'

        arr = np.array([1, 2, 3, 4, 5], dtype='f4')
        result = lib.infer_dtype(arr)
        assert result == 'floating'

        arr = np.array([1, 2, 3, 4, 5], dtype='f8')
        result = lib.infer_dtype(arr)
        assert result == 'floating'

    def test_string(self):
        pass

    def test_unicode(self):
        pass

    def test_datetime(self):

        dates = [datetime(2012, 1, x) for x in range(1, 20)]
        index = Index(dates)
        assert index.inferred_type == 'datetime64'

    def test_infer_dtype_datetime(self):

        arr = np.array([Timestamp('2011-01-01'),
                        Timestamp('2011-01-02')])
        assert lib.infer_dtype(arr) == 'datetime'

        arr = np.array([np.datetime64('2011-01-01'),
                        np.datetime64('2011-01-01')], dtype=object)
        assert lib.infer_dtype(arr) == 'datetime64'

        arr = np.array([datetime(2011, 1, 1), datetime(2012, 2, 1)])
        assert lib.infer_dtype(arr) == 'datetime'

        # starts with nan
        for n in [pd.NaT, np.nan]:
            arr = np.array([n, pd.Timestamp('2011-01-02')])
            assert lib.infer_dtype(arr) == 'datetime'

            arr = np.array([n, np.datetime64('2011-01-02')])
            assert lib.infer_dtype(arr) == 'datetime64'

            arr = np.array([n, datetime(2011, 1, 1)])
            assert lib.infer_dtype(arr) == 'datetime'

            arr = np.array([n, pd.Timestamp('2011-01-02'), n])
            assert lib.infer_dtype(arr) == 'datetime'

            arr = np.array([n, np.datetime64('2011-01-02'), n])
            assert lib.infer_dtype(arr) == 'datetime64'

            arr = np.array([n, datetime(2011, 1, 1), n])
            assert lib.infer_dtype(arr) == 'datetime'

        # different type of nat
        arr = np.array([np.timedelta64('nat'),
                        np.datetime64('2011-01-02')], dtype=object)
        assert lib.infer_dtype(arr) == 'mixed'

        arr = np.array([np.datetime64('2011-01-02'),
                        np.timedelta64('nat')], dtype=object)
        assert lib.infer_dtype(arr) == 'mixed'

        # mixed datetime
        arr = np.array([datetime(2011, 1, 1),
                        pd.Timestamp('2011-01-02')])
        assert lib.infer_dtype(arr) == 'datetime'

        # should be datetime?
        arr = np.array([np.datetime64('2011-01-01'),
                        pd.Timestamp('2011-01-02')])
        assert lib.infer_dtype(arr) == 'mixed'

        arr = np.array([pd.Timestamp('2011-01-02'),
                        np.datetime64('2011-01-01')])
        assert lib.infer_dtype(arr) == 'mixed'

        arr = np.array([np.nan, pd.Timestamp('2011-01-02'), 1])
        assert lib.infer_dtype(arr) == 'mixed-integer'

        arr = np.array([np.nan, pd.Timestamp('2011-01-02'), 1.1])
        assert lib.infer_dtype(arr) == 'mixed'

        arr = np.array([np.nan, '2011-01-01', pd.Timestamp('2011-01-02')])
        assert lib.infer_dtype(arr) == 'mixed'

    def test_infer_dtype_timedelta(self):

        arr = np.array([pd.Timedelta('1 days'),
                        pd.Timedelta('2 days')])
        assert lib.infer_dtype(arr) == 'timedelta'

        arr = np.array([np.timedelta64(1, 'D'),
                        np.timedelta64(2, 'D')], dtype=object)
        assert lib.infer_dtype(arr) == 'timedelta'

        arr = np.array([timedelta(1), timedelta(2)])
        assert lib.infer_dtype(arr) == 'timedelta'

        # starts with nan
        for n in [pd.NaT, np.nan]:
            arr = np.array([n, Timedelta('1 days')])
            assert lib.infer_dtype(arr) == 'timedelta'

            arr = np.array([n, np.timedelta64(1, 'D')])
            assert lib.infer_dtype(arr) == 'timedelta'

            arr = np.array([n, timedelta(1)])
            assert lib.infer_dtype(arr) == 'timedelta'

            arr = np.array([n, pd.Timedelta('1 days'), n])
            assert lib.infer_dtype(arr) == 'timedelta'

            arr = np.array([n, np.timedelta64(1, 'D'), n])
            assert lib.infer_dtype(arr) == 'timedelta'

            arr = np.array([n, timedelta(1), n])
            assert lib.infer_dtype(arr) == 'timedelta'

        # different type of nat
        arr = np.array([np.datetime64('nat'), np.timedelta64(1, 'D')],
                       dtype=object)
        assert lib.infer_dtype(arr) == 'mixed'

        arr = np.array([np.timedelta64(1, 'D'), np.datetime64('nat')],
                       dtype=object)
        assert lib.infer_dtype(arr) == 'mixed'

    def test_infer_dtype_period(self):
        # GH 13664
        arr = np.array([pd.Period('2011-01', freq='D'),
                        pd.Period('2011-02', freq='D')])
        assert lib.infer_dtype(arr) == 'period'

        arr = np.array([pd.Period('2011-01', freq='D'),
                        pd.Period('2011-02', freq='M')])
        assert lib.infer_dtype(arr) == 'period'

        # starts with nan
        for n in [pd.NaT, np.nan]:
            arr = np.array([n, pd.Period('2011-01', freq='D')])
            assert lib.infer_dtype(arr) == 'period'

            arr = np.array([n, pd.Period('2011-01', freq='D'), n])
            assert lib.infer_dtype(arr) == 'period'

        # different type of nat
        arr = np.array([np.datetime64('nat'), pd.Period('2011-01', freq='M')],
                       dtype=object)
        assert lib.infer_dtype(arr) == 'mixed'

        arr = np.array([pd.Period('2011-01', freq='M'), np.datetime64('nat')],
                       dtype=object)
        assert lib.infer_dtype(arr) == 'mixed'

    def test_infer_dtype_all_nan_nat_like(self):
        arr = np.array([np.nan, np.nan])
        assert lib.infer_dtype(arr) == 'floating'

        # nan and None mix are result in mixed
        arr = np.array([np.nan, np.nan, None])
        assert lib.infer_dtype(arr) == 'mixed'

        arr = np.array([None, np.nan, np.nan])
        assert lib.infer_dtype(arr) == 'mixed'

        # pd.NaT
        arr = np.array([pd.NaT])
        assert lib.infer_dtype(arr) == 'datetime'

        arr = np.array([pd.NaT, np.nan])
        assert lib.infer_dtype(arr) == 'datetime'

        arr = np.array([np.nan, pd.NaT])
        assert lib.infer_dtype(arr) == 'datetime'

        arr = np.array([np.nan, pd.NaT, np.nan])
        assert lib.infer_dtype(arr) == 'datetime'

        arr = np.array([None, pd.NaT, None])
        assert lib.infer_dtype(arr) == 'datetime'

        # np.datetime64(nat)
        arr = np.array([np.datetime64('nat')])
        assert lib.infer_dtype(arr) == 'datetime64'

        for n in [np.nan, pd.NaT, None]:
            arr = np.array([n, np.datetime64('nat'), n])
            assert lib.infer_dtype(arr) == 'datetime64'

            arr = np.array([pd.NaT, n, np.datetime64('nat'), n])
            assert lib.infer_dtype(arr) == 'datetime64'

        arr = np.array([np.timedelta64('nat')], dtype=object)
        assert lib.infer_dtype(arr) == 'timedelta'

        for n in [np.nan, pd.NaT, None]:
            arr = np.array([n, np.timedelta64('nat'), n])
            assert lib.infer_dtype(arr) == 'timedelta'

            arr = np.array([pd.NaT, n, np.timedelta64('nat'), n])
            assert lib.infer_dtype(arr) == 'timedelta'

        # datetime / timedelta mixed
        arr = np.array([pd.NaT, np.datetime64('nat'),
                        np.timedelta64('nat'), np.nan])
        assert lib.infer_dtype(arr) == 'mixed'

        arr = np.array([np.timedelta64('nat'), np.datetime64('nat')],
                       dtype=object)
        assert lib.infer_dtype(arr) == 'mixed'

    def test_is_datetimelike_array_all_nan_nat_like(self):
        arr = np.array([np.nan, pd.NaT, np.datetime64('nat')])
        assert lib.is_datetime_array(arr)
        assert lib.is_datetime64_array(arr)
        assert not lib.is_timedelta_array(arr)
        assert not lib.is_timedelta64_array(arr)
        assert not lib.is_timedelta_or_timedelta64_array(arr)

        arr = np.array([np.nan, pd.NaT, np.timedelta64('nat')])
        assert not lib.is_datetime_array(arr)
        assert not lib.is_datetime64_array(arr)
        assert lib.is_timedelta_array(arr)
        assert lib.is_timedelta64_array(arr)
        assert lib.is_timedelta_or_timedelta64_array(arr)

        arr = np.array([np.nan, pd.NaT, np.datetime64('nat'),
                        np.timedelta64('nat')])
        assert not lib.is_datetime_array(arr)
        assert not lib.is_datetime64_array(arr)
        assert not lib.is_timedelta_array(arr)
        assert not lib.is_timedelta64_array(arr)
        assert not lib.is_timedelta_or_timedelta64_array(arr)

        arr = np.array([np.nan, pd.NaT])
        assert lib.is_datetime_array(arr)
        assert lib.is_datetime64_array(arr)
        assert lib.is_timedelta_array(arr)
        assert lib.is_timedelta64_array(arr)
        assert lib.is_timedelta_or_timedelta64_array(arr)

        arr = np.array([np.nan, np.nan], dtype=object)
        assert not lib.is_datetime_array(arr)
        assert not lib.is_datetime64_array(arr)
        assert not lib.is_timedelta_array(arr)
        assert not lib.is_timedelta64_array(arr)
        assert not lib.is_timedelta_or_timedelta64_array(arr)

    def test_date(self):

        dates = [date(2012, 1, x) for x in range(1, 20)]
        index = Index(dates)
        assert index.inferred_type == 'date'

    def test_to_object_array_tuples(self):
        r = (5, 6)
        values = [r]
        result = lib.to_object_array_tuples(values)

        try:
            # make sure record array works
            from collections import namedtuple
            record = namedtuple('record', 'x y')
            r = record(5, 6)
            values = [r]
            result = lib.to_object_array_tuples(values)  # noqa
        except ImportError:
            pass

    def test_object(self):

        # GH 7431
        # cannot infer more than this as only a single element
        arr = np.array([None], dtype='O')
        result = lib.infer_dtype(arr)
        assert result == 'mixed'

    def test_to_object_array_width(self):
        # see gh-13320
        rows = [[1, 2, 3], [4, 5, 6]]

        expected = np.array(rows, dtype=object)
        out = lib.to_object_array(rows)
        tm.assert_numpy_array_equal(out, expected)

        expected = np.array(rows, dtype=object)
        out = lib.to_object_array(rows, min_width=1)
        tm.assert_numpy_array_equal(out, expected)

        expected = np.array([[1, 2, 3, None, None],
                             [4, 5, 6, None, None]], dtype=object)
        out = lib.to_object_array(rows, min_width=5)
        tm.assert_numpy_array_equal(out, expected)

    def test_is_period(self):
        assert lib.is_period(pd.Period('2011-01', freq='M'))
        assert not lib.is_period(pd.PeriodIndex(['2011-01'], freq='M'))
        assert not lib.is_period(pd.Timestamp('2011-01'))
        assert not lib.is_period(1)
        assert not lib.is_period(np.nan)

    def test_categorical(self):

        # GH 8974
        from pandas import Categorical, Series
        arr = Categorical(list('abc'))
        result = lib.infer_dtype(arr)
        assert result == 'categorical'

        result = lib.infer_dtype(Series(arr))
        assert result == 'categorical'

        arr = Categorical(list('abc'), categories=['cegfab'], ordered=True)
        result = lib.infer_dtype(arr)
        assert result == 'categorical'

        result = lib.infer_dtype(Series(arr))
        assert result == 'categorical'


class TestNumberScalar(object):

    def test_is_number(self):

        assert is_number(True)
        assert is_number(1)
        assert is_number(1.1)
        assert is_number(1 + 3j)
        assert is_number(np.bool(False))
        assert is_number(np.int64(1))
        assert is_number(np.float64(1.1))
        assert is_number(np.complex128(1 + 3j))
        assert is_number(np.nan)

        assert not is_number(None)
        assert not is_number('x')
        assert not is_number(datetime(2011, 1, 1))
        assert not is_number(np.datetime64('2011-01-01'))
        assert not is_number(Timestamp('2011-01-01'))
        assert not is_number(Timestamp('2011-01-01', tz='US/Eastern'))
        assert not is_number(timedelta(1000))
        assert not is_number(Timedelta('1 days'))

        # questionable
        assert not is_number(np.bool_(False))
        assert is_number(np.timedelta64(1, 'D'))

    def test_is_bool(self):
        assert is_bool(True)
        assert is_bool(np.bool(False))
        assert is_bool(np.bool_(False))

        assert not is_bool(1)
        assert not is_bool(1.1)
        assert not is_bool(1 + 3j)
        assert not is_bool(np.int64(1))
        assert not is_bool(np.float64(1.1))
        assert not is_bool(np.complex128(1 + 3j))
        assert not is_bool(np.nan)
        assert not is_bool(None)
        assert not is_bool('x')
        assert not is_bool(datetime(2011, 1, 1))
        assert not is_bool(np.datetime64('2011-01-01'))
        assert not is_bool(Timestamp('2011-01-01'))
        assert not is_bool(Timestamp('2011-01-01', tz='US/Eastern'))
        assert not is_bool(timedelta(1000))
        assert not is_bool(np.timedelta64(1, 'D'))
        assert not is_bool(Timedelta('1 days'))

    def test_is_integer(self):
        assert is_integer(1)
        assert is_integer(np.int64(1))

        assert not is_integer(True)
        assert not is_integer(1.1)
        assert not is_integer(1 + 3j)
        assert not is_integer(np.bool(False))
        assert not is_integer(np.bool_(False))
        assert not is_integer(np.float64(1.1))
        assert not is_integer(np.complex128(1 + 3j))
        assert not is_integer(np.nan)
        assert not is_integer(None)
        assert not is_integer('x')
        assert not is_integer(datetime(2011, 1, 1))
        assert not is_integer(np.datetime64('2011-01-01'))
        assert not is_integer(Timestamp('2011-01-01'))
        assert not is_integer(Timestamp('2011-01-01', tz='US/Eastern'))
        assert not is_integer(timedelta(1000))
        assert not is_integer(Timedelta('1 days'))

        # questionable
        assert is_integer(np.timedelta64(1, 'D'))

    def test_is_float(self):
        assert is_float(1.1)
        assert is_float(np.float64(1.1))
        assert is_float(np.nan)

        assert not is_float(True)
        assert not is_float(1)
        assert not is_float(1 + 3j)
        assert not is_float(np.bool(False))
        assert not is_float(np.bool_(False))
        assert not is_float(np.int64(1))
        assert not is_float(np.complex128(1 + 3j))
        assert not is_float(None)
        assert not is_float('x')
        assert not is_float(datetime(2011, 1, 1))
        assert not is_float(np.datetime64('2011-01-01'))
        assert not is_float(Timestamp('2011-01-01'))
        assert not is_float(Timestamp('2011-01-01', tz='US/Eastern'))
        assert not is_float(timedelta(1000))
        assert not is_float(np.timedelta64(1, 'D'))
        assert not is_float(Timedelta('1 days'))

    def test_is_datetime_dtypes(self):

        ts = pd.date_range('20130101', periods=3)
        tsa = pd.date_range('20130101', periods=3, tz='US/Eastern')

        assert is_datetime64_dtype('datetime64')
        assert is_datetime64_dtype('datetime64[ns]')
        assert is_datetime64_dtype(ts)
        assert not is_datetime64_dtype(tsa)

        assert not is_datetime64_ns_dtype('datetime64')
        assert is_datetime64_ns_dtype('datetime64[ns]')
        assert is_datetime64_ns_dtype(ts)
        assert is_datetime64_ns_dtype(tsa)

        assert is_datetime64_any_dtype('datetime64')
        assert is_datetime64_any_dtype('datetime64[ns]')
        assert is_datetime64_any_dtype(ts)
        assert is_datetime64_any_dtype(tsa)

        assert not is_datetime64tz_dtype('datetime64')
        assert not is_datetime64tz_dtype('datetime64[ns]')
        assert not is_datetime64tz_dtype(ts)
        assert is_datetime64tz_dtype(tsa)

        for tz in ['US/Eastern', 'UTC']:
            dtype = 'datetime64[ns, {}]'.format(tz)
            assert not is_datetime64_dtype(dtype)
            assert is_datetime64tz_dtype(dtype)
            assert is_datetime64_ns_dtype(dtype)
            assert is_datetime64_any_dtype(dtype)

    def test_is_timedelta(self):
        assert is_timedelta64_dtype('timedelta64')
        assert is_timedelta64_dtype('timedelta64[ns]')
        assert not is_timedelta64_ns_dtype('timedelta64')
        assert is_timedelta64_ns_dtype('timedelta64[ns]')

        tdi = TimedeltaIndex([1e14, 2e14], dtype='timedelta64')
        assert is_timedelta64_dtype(tdi)
        assert is_timedelta64_ns_dtype(tdi)
        assert is_timedelta64_ns_dtype(tdi.astype('timedelta64[ns]'))

        # Conversion to Int64Index:
        assert not is_timedelta64_ns_dtype(tdi.astype('timedelta64'))
        assert not is_timedelta64_ns_dtype(tdi.astype('timedelta64[h]'))


class Testisscalar(object):

    def test_isscalar_builtin_scalars(self):
        assert is_scalar(None)
        assert is_scalar(True)
        assert is_scalar(False)
        assert is_scalar(0.)
        assert is_scalar(np.nan)
        assert is_scalar('foobar')
        assert is_scalar(b'foobar')
        assert is_scalar(u('efoobar'))
        assert is_scalar(datetime(2014, 1, 1))
        assert is_scalar(date(2014, 1, 1))
        assert is_scalar(time(12, 0))
        assert is_scalar(timedelta(hours=1))
        assert is_scalar(pd.NaT)

    def test_isscalar_builtin_nonscalars(self):
        assert not is_scalar({})
        assert not is_scalar([])
        assert not is_scalar([1])
        assert not is_scalar(())
        assert not is_scalar((1, ))
        assert not is_scalar(slice(None))
        assert not is_scalar(Ellipsis)

    def test_isscalar_numpy_array_scalars(self):
        assert is_scalar(np.int64(1))
        assert is_scalar(np.float64(1.))
        assert is_scalar(np.int32(1))
        assert is_scalar(np.object_('foobar'))
        assert is_scalar(np.str_('foobar'))
        assert is_scalar(np.unicode_(u('foobar')))
        assert is_scalar(np.bytes_(b'foobar'))
        assert is_scalar(np.datetime64('2014-01-01'))
        assert is_scalar(np.timedelta64(1, 'h'))

    def test_isscalar_numpy_zerodim_arrays(self):
        for zerodim in [np.array(1), np.array('foobar'),
                        np.array(np.datetime64('2014-01-01')),
                        np.array(np.timedelta64(1, 'h')),
                        np.array(np.datetime64('NaT'))]:
            assert not is_scalar(zerodim)
            assert is_scalar(lib.item_from_zerodim(zerodim))

    def test_isscalar_numpy_arrays(self):
        assert not is_scalar(np.array([]))
        assert not is_scalar(np.array([[]]))
        assert not is_scalar(np.matrix('1; 2'))

    def test_isscalar_pandas_scalars(self):
        assert is_scalar(Timestamp('2014-01-01'))
        assert is_scalar(Timedelta(hours=1))
        assert is_scalar(Period('2014-01-01'))

    def test_lisscalar_pandas_containers(self):
        assert not is_scalar(Series())
        assert not is_scalar(Series([1]))
        assert not is_scalar(DataFrame())
        assert not is_scalar(DataFrame([[1]]))
        with catch_warnings(record=True):
            assert not is_scalar(Panel())
            assert not is_scalar(Panel([[[1]]]))
        assert not is_scalar(Index([]))
        assert not is_scalar(Index([1]))


def test_datetimeindex_from_empty_datetime64_array():
    for unit in ['ms', 'us', 'ns']:
        idx = DatetimeIndex(np.array([], dtype='datetime64[%s]' % unit))
        assert (len(idx) == 0)


def test_nan_to_nat_conversions():

    df = DataFrame(dict({
        'A': np.asarray(
            lrange(10), dtype='float64'),
        'B': Timestamp('20010101')
    }))
    df.iloc[3:6, :] = np.nan
    result = df.loc[4, 'B'].value
    assert (result == tslib.iNaT)

    s = df['B'].copy()
    s._data = s._data.setitem(indexer=tuple([slice(8, 9)]), value=np.nan)
    assert (isnull(s[8]))

    # numpy < 1.7.0 is wrong
    from distutils.version import LooseVersion
    if LooseVersion(np.__version__) >= '1.7.0':
        assert (s[8].value == np.datetime64('NaT').astype(np.int64))


def test_is_scipy_sparse(spmatrix):  # noqa: F811
    tm._skip_if_no_scipy()
    assert is_scipy_sparse(spmatrix([[0, 1]]))
    assert not is_scipy_sparse(np.array([1]))


def test_ensure_int32():
    values = np.arange(10, dtype=np.int32)
    result = _ensure_int32(values)
    assert (result.dtype == np.int32)

    values = np.arange(10, dtype=np.int64)
    result = _ensure_int32(values)
    assert (result.dtype == np.int32)


def test_ensure_categorical():
    values = np.arange(10, dtype=np.int32)
    result = _ensure_categorical(values)
    assert (result.dtype == 'category')

    values = Categorical(values)
    result = _ensure_categorical(values)
    tm.assert_categorical_equal(result, values)
