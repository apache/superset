# -*- coding: utf-8 -*-

import pytest
import numpy as np
import pandas as pd

from pandas.core.dtypes.dtypes import (DatetimeTZDtype, PeriodDtype,
                                       CategoricalDtype, IntervalDtype)

import pandas.core.dtypes.common as com
import pandas.util.testing as tm


class TestPandasDtype(object):

    # Passing invalid dtype, both as a string or object, must raise TypeError
    # Per issue GH15520
    def test_invalid_dtype_error(self):
        msg = 'not understood'
        invalid_list = [pd.Timestamp, 'pd.Timestamp', list]
        for dtype in invalid_list:
            with tm.assert_raises_regex(TypeError, msg):
                com.pandas_dtype(dtype)

        valid_list = [object, 'float64', np.object_, np.dtype('object'), 'O',
                      np.float64, float, np.dtype('float64')]
        for dtype in valid_list:
            com.pandas_dtype(dtype)

    def test_numpy_dtype(self):
        for dtype in ['M8[ns]', 'm8[ns]', 'object', 'float64', 'int64']:
            assert com.pandas_dtype(dtype) == np.dtype(dtype)

    def test_numpy_string_dtype(self):
        # do not parse freq-like string as period dtype
        assert com.pandas_dtype('U') == np.dtype('U')
        assert com.pandas_dtype('S') == np.dtype('S')

    def test_datetimetz_dtype(self):
        for dtype in ['datetime64[ns, US/Eastern]',
                      'datetime64[ns, Asia/Tokyo]',
                      'datetime64[ns, UTC]']:
            assert com.pandas_dtype(dtype) is DatetimeTZDtype(dtype)
            assert com.pandas_dtype(dtype) == DatetimeTZDtype(dtype)
            assert com.pandas_dtype(dtype) == dtype

    def test_categorical_dtype(self):
        assert com.pandas_dtype('category') == CategoricalDtype()

    def test_period_dtype(self):
        for dtype in ['period[D]', 'period[3M]', 'period[U]',
                      'Period[D]', 'Period[3M]', 'Period[U]']:
            assert com.pandas_dtype(dtype) is PeriodDtype(dtype)
            assert com.pandas_dtype(dtype) == PeriodDtype(dtype)
            assert com.pandas_dtype(dtype) == dtype


dtypes = dict(datetime_tz=com.pandas_dtype('datetime64[ns, US/Eastern]'),
              datetime=com.pandas_dtype('datetime64[ns]'),
              timedelta=com.pandas_dtype('timedelta64[ns]'),
              period=PeriodDtype('D'),
              integer=np.dtype(np.int64),
              float=np.dtype(np.float64),
              object=np.dtype(np.object),
              category=com.pandas_dtype('category'))


@pytest.mark.parametrize('name1,dtype1',
                         list(dtypes.items()),
                         ids=lambda x: str(x))
@pytest.mark.parametrize('name2,dtype2',
                         list(dtypes.items()),
                         ids=lambda x: str(x))
def test_dtype_equal(name1, dtype1, name2, dtype2):

    # match equal to self, but not equal to other
    assert com.is_dtype_equal(dtype1, dtype1)
    if name1 != name2:
        assert not com.is_dtype_equal(dtype1, dtype2)


def test_dtype_equal_strict():

    # we are strict on kind equality
    for dtype in [np.int8, np.int16, np.int32]:
        assert not com.is_dtype_equal(np.int64, dtype)

    for dtype in [np.float32]:
        assert not com.is_dtype_equal(np.float64, dtype)

    # strict w.r.t. PeriodDtype
    assert not com.is_dtype_equal(PeriodDtype('D'), PeriodDtype('2D'))

    # strict w.r.t. datetime64
    assert not com.is_dtype_equal(
        com.pandas_dtype('datetime64[ns, US/Eastern]'),
        com.pandas_dtype('datetime64[ns, CET]'))

    # see gh-15941: no exception should be raised
    assert not com.is_dtype_equal(None, None)


def get_is_dtype_funcs():
    """
    Get all functions in pandas.core.dtypes.common that
    begin with 'is_' and end with 'dtype'

    """

    fnames = [f for f in dir(com) if (f.startswith('is_') and
                                      f.endswith('dtype'))]
    return [getattr(com, fname) for fname in fnames]


@pytest.mark.parametrize('func',
                         get_is_dtype_funcs(),
                         ids=lambda x: x.__name__)
def test_get_dtype_error_catch(func):
    # see gh-15941
    #
    # No exception should be raised.

    assert not func(None)


def test_is_object():
    assert com.is_object_dtype(object)
    assert com.is_object_dtype(np.array([], dtype=object))

    assert not com.is_object_dtype(int)
    assert not com.is_object_dtype(np.array([], dtype=int))
    assert not com.is_object_dtype([1, 2, 3])


def test_is_sparse():
    assert com.is_sparse(pd.SparseArray([1, 2, 3]))
    assert com.is_sparse(pd.SparseSeries([1, 2, 3]))

    assert not com.is_sparse(np.array([1, 2, 3]))

    # This test will only skip if the previous assertions
    # pass AND scipy is not installed.
    sparse = pytest.importorskip("scipy.sparse")
    assert not com.is_sparse(sparse.bsr_matrix([1, 2, 3]))


def test_is_scipy_sparse():
    tm._skip_if_no_scipy()

    from scipy.sparse import bsr_matrix
    assert com.is_scipy_sparse(bsr_matrix([1, 2, 3]))

    assert not com.is_scipy_sparse(pd.SparseArray([1, 2, 3]))
    assert not com.is_scipy_sparse(pd.SparseSeries([1, 2, 3]))


def test_is_categorical():
    cat = pd.Categorical([1, 2, 3])
    assert com.is_categorical(cat)
    assert com.is_categorical(pd.Series(cat))
    assert com.is_categorical(pd.CategoricalIndex([1, 2, 3]))

    assert not com.is_categorical([1, 2, 3])


def test_is_datetimetz():
    assert not com.is_datetimetz([1, 2, 3])
    assert not com.is_datetimetz(pd.DatetimeIndex([1, 2, 3]))

    assert com.is_datetimetz(pd.DatetimeIndex([1, 2, 3], tz="US/Eastern"))

    dtype = DatetimeTZDtype("ns", tz="US/Eastern")
    s = pd.Series([], dtype=dtype)
    assert com.is_datetimetz(s)


def test_is_period():
    assert not com.is_period([1, 2, 3])
    assert not com.is_period(pd.Index([1, 2, 3]))
    assert com.is_period(pd.PeriodIndex(["2017-01-01"], freq="D"))


def test_is_datetime64_dtype():
    assert not com.is_datetime64_dtype(object)
    assert not com.is_datetime64_dtype([1, 2, 3])
    assert not com.is_datetime64_dtype(np.array([], dtype=int))

    assert com.is_datetime64_dtype(np.datetime64)
    assert com.is_datetime64_dtype(np.array([], dtype=np.datetime64))


def test_is_datetime64tz_dtype():
    assert not com.is_datetime64tz_dtype(object)
    assert not com.is_datetime64tz_dtype([1, 2, 3])
    assert not com.is_datetime64tz_dtype(pd.DatetimeIndex([1, 2, 3]))
    assert com.is_datetime64tz_dtype(pd.DatetimeIndex(
        [1, 2, 3], tz="US/Eastern"))


def test_is_timedelta64_dtype():
    assert not com.is_timedelta64_dtype(object)
    assert not com.is_timedelta64_dtype([1, 2, 3])

    assert com.is_timedelta64_dtype(np.timedelta64)
    assert com.is_timedelta64_dtype(pd.Series([], dtype="timedelta64[ns]"))


def test_is_period_dtype():
    assert not com.is_period_dtype(object)
    assert not com.is_period_dtype([1, 2, 3])
    assert not com.is_period_dtype(pd.Period("2017-01-01"))

    assert com.is_period_dtype(PeriodDtype(freq="D"))
    assert com.is_period_dtype(pd.PeriodIndex([], freq="A"))


def test_is_interval_dtype():
    assert not com.is_interval_dtype(object)
    assert not com.is_interval_dtype([1, 2, 3])

    assert com.is_interval_dtype(IntervalDtype())

    interval = pd.Interval(1, 2, closed="right")
    assert not com.is_interval_dtype(interval)
    assert com.is_interval_dtype(pd.IntervalIndex([interval]))


def test_is_categorical_dtype():
    assert not com.is_categorical_dtype(object)
    assert not com.is_categorical_dtype([1, 2, 3])

    assert com.is_categorical_dtype(CategoricalDtype())
    assert com.is_categorical_dtype(pd.Categorical([1, 2, 3]))
    assert com.is_categorical_dtype(pd.CategoricalIndex([1, 2, 3]))


def test_is_string_dtype():
    assert not com.is_string_dtype(int)
    assert not com.is_string_dtype(pd.Series([1, 2]))

    assert com.is_string_dtype(str)
    assert com.is_string_dtype(object)
    assert com.is_string_dtype(np.array(['a', 'b']))


def test_is_period_arraylike():
    assert not com.is_period_arraylike([1, 2, 3])
    assert not com.is_period_arraylike(pd.Index([1, 2, 3]))
    assert com.is_period_arraylike(pd.PeriodIndex(["2017-01-01"], freq="D"))


def test_is_datetime_arraylike():
    assert not com.is_datetime_arraylike([1, 2, 3])
    assert not com.is_datetime_arraylike(pd.Index([1, 2, 3]))
    assert com.is_datetime_arraylike(pd.DatetimeIndex([1, 2, 3]))


def test_is_datetimelike():
    assert not com.is_datetimelike([1, 2, 3])
    assert not com.is_datetimelike(pd.Index([1, 2, 3]))

    assert com.is_datetimelike(pd.DatetimeIndex([1, 2, 3]))
    assert com.is_datetimelike(pd.PeriodIndex([], freq="A"))
    assert com.is_datetimelike(np.array([], dtype=np.datetime64))
    assert com.is_datetimelike(pd.Series([], dtype="timedelta64[ns]"))
    assert com.is_datetimelike(pd.DatetimeIndex([1, 2, 3], tz="US/Eastern"))

    dtype = DatetimeTZDtype("ns", tz="US/Eastern")
    s = pd.Series([], dtype=dtype)
    assert com.is_datetimelike(s)


def test_is_integer_dtype():
    assert not com.is_integer_dtype(str)
    assert not com.is_integer_dtype(float)
    assert not com.is_integer_dtype(np.datetime64)
    assert not com.is_integer_dtype(np.timedelta64)
    assert not com.is_integer_dtype(pd.Index([1, 2.]))
    assert not com.is_integer_dtype(np.array(['a', 'b']))
    assert not com.is_integer_dtype(np.array([], dtype=np.timedelta64))

    assert com.is_integer_dtype(int)
    assert com.is_integer_dtype(np.uint64)
    assert com.is_integer_dtype(pd.Series([1, 2]))


def test_is_signed_integer_dtype():
    assert not com.is_signed_integer_dtype(str)
    assert not com.is_signed_integer_dtype(float)
    assert not com.is_signed_integer_dtype(np.uint64)
    assert not com.is_signed_integer_dtype(np.datetime64)
    assert not com.is_signed_integer_dtype(np.timedelta64)
    assert not com.is_signed_integer_dtype(pd.Index([1, 2.]))
    assert not com.is_signed_integer_dtype(np.array(['a', 'b']))
    assert not com.is_signed_integer_dtype(np.array([1, 2], dtype=np.uint32))
    assert not com.is_signed_integer_dtype(np.array([], dtype=np.timedelta64))

    assert com.is_signed_integer_dtype(int)
    assert com.is_signed_integer_dtype(pd.Series([1, 2]))


def test_is_unsigned_integer_dtype():
    assert not com.is_unsigned_integer_dtype(str)
    assert not com.is_unsigned_integer_dtype(int)
    assert not com.is_unsigned_integer_dtype(float)
    assert not com.is_unsigned_integer_dtype(pd.Series([1, 2]))
    assert not com.is_unsigned_integer_dtype(pd.Index([1, 2.]))
    assert not com.is_unsigned_integer_dtype(np.array(['a', 'b']))

    assert com.is_unsigned_integer_dtype(np.uint64)
    assert com.is_unsigned_integer_dtype(np.array([1, 2], dtype=np.uint32))


def test_is_int64_dtype():
    assert not com.is_int64_dtype(str)
    assert not com.is_int64_dtype(float)
    assert not com.is_int64_dtype(np.int32)
    assert not com.is_int64_dtype(np.uint64)
    assert not com.is_int64_dtype(pd.Index([1, 2.]))
    assert not com.is_int64_dtype(np.array(['a', 'b']))
    assert not com.is_int64_dtype(np.array([1, 2], dtype=np.uint32))

    assert com.is_int64_dtype(np.int64)
    assert com.is_int64_dtype(np.array([1, 2], dtype=np.int64))


def test_is_int_or_datetime_dtype():
    assert not com.is_int_or_datetime_dtype(str)
    assert not com.is_int_or_datetime_dtype(float)
    assert not com.is_int_or_datetime_dtype(pd.Index([1, 2.]))
    assert not com.is_int_or_datetime_dtype(np.array(['a', 'b']))

    assert com.is_int_or_datetime_dtype(int)
    assert com.is_int_or_datetime_dtype(np.uint64)
    assert com.is_int_or_datetime_dtype(np.datetime64)
    assert com.is_int_or_datetime_dtype(np.timedelta64)
    assert com.is_int_or_datetime_dtype(pd.Series([1, 2]))
    assert com.is_int_or_datetime_dtype(np.array([], dtype=np.datetime64))
    assert com.is_int_or_datetime_dtype(np.array([], dtype=np.timedelta64))


def test_is_datetime64_any_dtype():
    assert not com.is_datetime64_any_dtype(int)
    assert not com.is_datetime64_any_dtype(str)
    assert not com.is_datetime64_any_dtype(np.array([1, 2]))
    assert not com.is_datetime64_any_dtype(np.array(['a', 'b']))

    assert com.is_datetime64_any_dtype(np.datetime64)
    assert com.is_datetime64_any_dtype(np.array([], dtype=np.datetime64))
    assert com.is_datetime64_any_dtype(DatetimeTZDtype("ns", "US/Eastern"))
    assert com.is_datetime64_any_dtype(pd.DatetimeIndex([1, 2, 3],
                                                        dtype=np.datetime64))


def test_is_datetime64_ns_dtype():
    assert not com.is_datetime64_ns_dtype(int)
    assert not com.is_datetime64_ns_dtype(str)
    assert not com.is_datetime64_ns_dtype(np.datetime64)
    assert not com.is_datetime64_ns_dtype(np.array([1, 2]))
    assert not com.is_datetime64_ns_dtype(np.array(['a', 'b']))
    assert not com.is_datetime64_ns_dtype(np.array([], dtype=np.datetime64))

    # This datetime array has the wrong unit (ps instead of ns)
    assert not com.is_datetime64_ns_dtype(np.array([], dtype="datetime64[ps]"))

    assert com.is_datetime64_ns_dtype(DatetimeTZDtype("ns", "US/Eastern"))
    assert com.is_datetime64_ns_dtype(pd.DatetimeIndex([1, 2, 3],
                                                       dtype=np.datetime64))


def test_is_timedelta64_ns_dtype():
    assert not com.is_timedelta64_ns_dtype(np.dtype('m8[ps]'))
    assert not com.is_timedelta64_ns_dtype(
        np.array([1, 2], dtype=np.timedelta64))

    assert com.is_timedelta64_ns_dtype(np.dtype('m8[ns]'))
    assert com.is_timedelta64_ns_dtype(np.array([1, 2], dtype='m8[ns]'))


def test_is_datetime_or_timedelta_dtype():
    assert not com.is_datetime_or_timedelta_dtype(int)
    assert not com.is_datetime_or_timedelta_dtype(str)
    assert not com.is_datetime_or_timedelta_dtype(pd.Series([1, 2]))
    assert not com.is_datetime_or_timedelta_dtype(np.array(['a', 'b']))

    assert com.is_datetime_or_timedelta_dtype(np.datetime64)
    assert com.is_datetime_or_timedelta_dtype(np.timedelta64)
    assert com.is_datetime_or_timedelta_dtype(
        np.array([], dtype=np.timedelta64))
    assert com.is_datetime_or_timedelta_dtype(
        np.array([], dtype=np.datetime64))


def test_is_numeric_v_string_like():
    assert not com.is_numeric_v_string_like(1, 1)
    assert not com.is_numeric_v_string_like(1, "foo")
    assert not com.is_numeric_v_string_like("foo", "foo")
    assert not com.is_numeric_v_string_like(np.array([1]), np.array([2]))
    assert not com.is_numeric_v_string_like(
        np.array(["foo"]), np.array(["foo"]))

    assert com.is_numeric_v_string_like(np.array([1]), "foo")
    assert com.is_numeric_v_string_like("foo", np.array([1]))
    assert com.is_numeric_v_string_like(np.array([1, 2]), np.array(["foo"]))
    assert com.is_numeric_v_string_like(np.array(["foo"]), np.array([1, 2]))


def test_is_datetimelike_v_numeric():
    dt = np.datetime64(pd.datetime(2017, 1, 1))

    assert not com.is_datetimelike_v_numeric(1, 1)
    assert not com.is_datetimelike_v_numeric(dt, dt)
    assert not com.is_datetimelike_v_numeric(np.array([1]), np.array([2]))
    assert not com.is_datetimelike_v_numeric(np.array([dt]), np.array([dt]))

    assert com.is_datetimelike_v_numeric(1, dt)
    assert com.is_datetimelike_v_numeric(1, dt)
    assert com.is_datetimelike_v_numeric(np.array([dt]), 1)
    assert com.is_datetimelike_v_numeric(np.array([1]), dt)
    assert com.is_datetimelike_v_numeric(np.array([dt]), np.array([1]))


def test_is_datetimelike_v_object():
    obj = object()
    dt = np.datetime64(pd.datetime(2017, 1, 1))

    assert not com.is_datetimelike_v_object(dt, dt)
    assert not com.is_datetimelike_v_object(obj, obj)
    assert not com.is_datetimelike_v_object(np.array([dt]), np.array([1]))
    assert not com.is_datetimelike_v_object(np.array([dt]), np.array([dt]))
    assert not com.is_datetimelike_v_object(np.array([obj]), np.array([obj]))

    assert com.is_datetimelike_v_object(dt, obj)
    assert com.is_datetimelike_v_object(obj, dt)
    assert com.is_datetimelike_v_object(np.array([dt]), obj)
    assert com.is_datetimelike_v_object(np.array([obj]), dt)
    assert com.is_datetimelike_v_object(np.array([dt]), np.array([obj]))


def test_needs_i8_conversion():
    assert not com.needs_i8_conversion(str)
    assert not com.needs_i8_conversion(np.int64)
    assert not com.needs_i8_conversion(pd.Series([1, 2]))
    assert not com.needs_i8_conversion(np.array(['a', 'b']))

    assert com.needs_i8_conversion(np.datetime64)
    assert com.needs_i8_conversion(pd.Series([], dtype="timedelta64[ns]"))
    assert com.needs_i8_conversion(pd.DatetimeIndex(
        [1, 2, 3], tz="US/Eastern"))


def test_is_numeric_dtype():
    assert not com.is_numeric_dtype(str)
    assert not com.is_numeric_dtype(np.datetime64)
    assert not com.is_numeric_dtype(np.timedelta64)
    assert not com.is_numeric_dtype(np.array(['a', 'b']))
    assert not com.is_numeric_dtype(np.array([], dtype=np.timedelta64))

    assert com.is_numeric_dtype(int)
    assert com.is_numeric_dtype(float)
    assert com.is_numeric_dtype(np.uint64)
    assert com.is_numeric_dtype(pd.Series([1, 2]))
    assert com.is_numeric_dtype(pd.Index([1, 2.]))


def test_is_string_like_dtype():
    assert not com.is_string_like_dtype(object)
    assert not com.is_string_like_dtype(pd.Series([1, 2]))

    assert com.is_string_like_dtype(str)
    assert com.is_string_like_dtype(np.array(['a', 'b']))


def test_is_float_dtype():
    assert not com.is_float_dtype(str)
    assert not com.is_float_dtype(int)
    assert not com.is_float_dtype(pd.Series([1, 2]))
    assert not com.is_float_dtype(np.array(['a', 'b']))

    assert com.is_float_dtype(float)
    assert com.is_float_dtype(pd.Index([1, 2.]))


def test_is_bool_dtype():
    assert not com.is_bool_dtype(int)
    assert not com.is_bool_dtype(str)
    assert not com.is_bool_dtype(pd.Series([1, 2]))
    assert not com.is_bool_dtype(np.array(['a', 'b']))

    assert com.is_bool_dtype(bool)
    assert com.is_bool_dtype(np.bool)
    assert com.is_bool_dtype(np.array([True, False]))


def test_is_extension_type():
    assert not com.is_extension_type([1, 2, 3])
    assert not com.is_extension_type(np.array([1, 2, 3]))
    assert not com.is_extension_type(pd.DatetimeIndex([1, 2, 3]))

    cat = pd.Categorical([1, 2, 3])
    assert com.is_extension_type(cat)
    assert com.is_extension_type(pd.Series(cat))
    assert com.is_extension_type(pd.SparseArray([1, 2, 3]))
    assert com.is_extension_type(pd.SparseSeries([1, 2, 3]))
    assert com.is_extension_type(pd.DatetimeIndex([1, 2, 3], tz="US/Eastern"))

    dtype = DatetimeTZDtype("ns", tz="US/Eastern")
    s = pd.Series([], dtype=dtype)
    assert com.is_extension_type(s)

    # This test will only skip if the previous assertions
    # pass AND scipy is not installed.
    sparse = pytest.importorskip("scipy.sparse")
    assert not com.is_extension_type(sparse.bsr_matrix([1, 2, 3]))


def test_is_complex_dtype():
    assert not com.is_complex_dtype(int)
    assert not com.is_complex_dtype(str)
    assert not com.is_complex_dtype(pd.Series([1, 2]))
    assert not com.is_complex_dtype(np.array(['a', 'b']))

    assert com.is_complex_dtype(np.complex)
    assert com.is_complex_dtype(np.array([1 + 1j, 5]))
